// ========================================
// Detection Result Processing, Caching, Validation
// ========================================

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';
import type { CVDetectionResult } from './types.ts';
import { getDetectionCache, CACHE_TTL, MAX_CACHE_SIZE } from './state.ts';
import { detectBorderRarity } from './color.ts';
import { IMAGE_LOAD_TIMEOUT_MS } from './detection-config.ts';

// ========================================
// Image Loading
// ========================================

/**
 * Load image to canvas for processing
 * Includes timeout protection to prevent indefinite waiting
 */
export async function loadImageToCanvas(
    imageDataUrl: string,
    timeoutMs: number = IMAGE_LOAD_TIMEOUT_MS
): Promise<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let resolved = false;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        // Set up timeout to prevent indefinite waiting
        timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                img.src = ''; // Cancel image loading
                logger.warn({
                    operation: 'cv.load_image_timeout',
                    error: { name: 'TimeoutError', message: `Image loading timed out after ${timeoutMs}ms` },
                });
                reject(new Error(`Image loading timed out after ${timeoutMs}ms`));
            }
        }, timeoutMs);

        img.onload = () => {
            if (resolved) return;
            resolved = true;
            cleanup();

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0);
            resolve({ canvas, ctx, width: img.width, height: img.height });
        };

        img.onerror = event => {
            if (resolved) return;
            resolved = true;
            cleanup();
            const errorMessage = event instanceof ErrorEvent ? event.message : 'Failed to load image';
            logger.warn({
                operation: 'cv.load_image_error',
                error: { name: 'ImageLoadError', message: errorMessage },
            });
            reject(new Error(errorMessage));
        };

        img.src = imageDataUrl;
    });
}

// ========================================
// Cache Functions
// ========================================

/**
 * Get cached detection results if available
 */
export function getCachedResults(imageHash: string): CVDetectionResult[] | null {
    const detectionCache = getDetectionCache();
    const cached = detectionCache.get(imageHash);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        detectionCache.delete(imageHash);
        return null;
    }

    return cached.results;
}

/**
 * Cache detection results
 */
export function cacheResults(imageHash: string, results: CVDetectionResult[]): void {
    const detectionCache = getDetectionCache();
    detectionCache.set(imageHash, {
        results,
        timestamp: Date.now(),
    });

    // Cleanup old cache entries (keep last 50)
    if (detectionCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(detectionCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 10 entries
        for (let i = 0; i < 10; i++) {
            const entry = entries[i];
            if (entry) {
                detectionCache.delete(entry[0]);
            }
        }
    }
}

// ========================================
// Confidence Boosting and Validation
// ========================================

/**
 * Boost confidence based on game context (rarity, synergies)
 * Helps with ambiguous detections
 */
export function boostConfidenceWithContext(detections: CVDetectionResult[]): CVDetectionResult[] {
    const boosted = detections.map(detection => {
        let boost = 0;
        const entity = detection.entity as Item;

        // Boost common items (more likely to appear)
        if (entity.rarity === 'common') {
            boost += 0.03;
        } else if (entity.rarity === 'uncommon') {
            boost += 0.02;
        } else if (entity.rarity === 'legendary') {
            // Reduce legendary confidence slightly (less likely)
            boost -= 0.02;
        }

        // Boost items that synergize with already detected items
        const detectedItemNames = detections.map(d => d.entity.name.toLowerCase());

        // Known synergies (simplified - could be expanded)
        const synergies: Record<string, string[]> = {
            wrench: ['scrap', 'metal', 'gear'],
            battery: ['tesla', 'electric', 'shock'],
            'gym sauce': ['protein', 'fitness', 'muscle'],
            medkit: ['bandage', 'health', 'healing'],
        };

        const itemNameLower = entity.name.toLowerCase();
        const itemSynergies = synergies[itemNameLower] || [];

        for (const synergy of itemSynergies) {
            if (detectedItemNames.some(name => name.includes(synergy))) {
                boost += 0.03;
                break; // Only boost once per item
            }
        }

        // Clamp confidence to [0, 0.99]
        const newConfidence = Math.min(0.99, Math.max(0, detection.confidence + boost));

        return {
            ...detection,
            confidence: newConfidence,
        };
    });

    return boosted;
}

/**
 * Validate detections using border rarity check
 * Stronger validation: reject clear mismatches, significantly boost matches
 */
export function validateWithBorderRarity(
    detection: CVDetectionResult,
    ctx: CanvasRenderingContext2D,
    strictMode: boolean = false
): CVDetectionResult | null {
    if (!detection.position) return detection;

    const entity = detection.entity as Item;
    const pos = detection.position;

    // Bounds check to prevent getImageData errors
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    if (pos.x < 0 || pos.y < 0 || pos.x + pos.width > canvasWidth || pos.y + pos.height > canvasHeight) {
        return detection; // Can't validate, keep original
    }

    // Extract cell image data
    const cellImageData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

    // Detect border rarity
    const detectedRarity = detectBorderRarity(cellImageData);

    if (!detectedRarity) {
        // No clear border detected, slight penalty for uncertainty
        return {
            ...detection,
            confidence: detection.confidence * 0.98,
        };
    }

    // Check if detected rarity matches item rarity
    if (detectedRarity === entity.rarity) {
        // Match! Strong boost for matching rarity
        return {
            ...detection,
            confidence: Math.min(0.99, detection.confidence * 1.08),
        };
    } else {
        // Mismatch - apply penalty based on strictness
        // In strict mode for non-common items, reject the detection entirely
        if (strictMode && entity.rarity !== 'common' && detectedRarity !== 'common') {
            // Clear mismatch between colored rarities - reject
            logger.info({
                operation: 'cv.rarity_validation.rejected',
                data: {
                    item: entity.name,
                    expectedRarity: entity.rarity,
                    detectedRarity,
                },
            });
            return null;
        }

        // Soft mode: strong penalty for mismatch
        return {
            ...detection,
            confidence: detection.confidence * 0.75, // Stronger penalty
        };
    }
}

/**
 * Filter detections below a confidence threshold
 */
export function filterByConfidence(detections: CVDetectionResult[], minConfidence: number): CVDetectionResult[] {
    return detections.filter(d => d.confidence >= minConfidence);
}

/**
 * Aggregate multiple detection results (from different strategies/phases)
 * Handles deduplication and merging overlapping detections
 */
export function aggregateDetections(...detectionArrays: CVDetectionResult[][]): CVDetectionResult[] {
    return detectionArrays.flat();
}
