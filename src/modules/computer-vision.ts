// ========================================
// MegaBonk Computer Vision Module
// ========================================
// Handles template matching and icon recognition for build detection
// ========================================

import type { AllGameData, Item, Tome, Character, Weapon } from '../types/index.ts';
import { logger } from './logger.ts';
import { detectResolution, detectUILayout } from './test-utils.ts';

// CV detection result with position
export interface CVDetectionResult {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: Item | Tome | Character | Weapon;
    confidence: number;
    position?: { x: number; y: number; width: number; height: number };
    method: 'template_match' | 'icon_similarity' | 'hybrid';
}

// Region of interest for analysis
export interface ROI {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
}

let allData: AllGameData = {};

/**
 * Initialize computer vision module
 */
export function initCV(gameData: AllGameData): void {
    allData = gameData;

    logger.info({
        operation: 'cv.init',
        data: {
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Load image to canvas for processing
 */
async function loadImageToCanvas(imageDataUrl: string): Promise<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0);
            resolve({ canvas, ctx, width: img.width, height: img.height });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * Extract image data from a region
 */
function extractRegion(ctx: CanvasRenderingContext2D, roi: ROI): ImageData {
    return ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
}

/**
 * Calculate normalized cross-correlation between two image regions
 * Returns similarity score (0-1, higher is better)
 */
function calculateSimilarity(imageData1: ImageData, imageData2: ImageData): number {
    // Resize images to same size if needed
    const size = Math.min(imageData1.width, imageData2.width, imageData1.height, imageData2.height);

    // Simple pixel comparison (grayscale)
    let sum1 = 0;
    let sum2 = 0;
    let sumProduct = 0;
    let sumSquare1 = 0;
    let sumSquare2 = 0;
    let count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;
    const step = 4; // RGBA

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += step) {
        // Convert to grayscale
        const gray1 = (pixels1[i] + pixels1[i + 1] + pixels1[i + 2]) / 3;
        const gray2 = (pixels2[i] + pixels2[i + 1] + pixels2[i + 2]) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    // Pearson correlation coefficient
    const mean1 = sum1 / count;
    const mean2 = sum2 / count;

    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) return 0;

    // Normalize to 0-1 range
    return (numerator / denominator + 1) / 2;
}

/**
 * Detect grid structure in image (for item grids)
 * Returns potential grid positions
 */
export function detectGridPositions(width: number, height: number, gridSize: number = 64): ROI[] {
    const positions: ROI[] = [];
    const margin = Math.floor(width * 0.1); // 10% margin

    // Scan for grid positions (typical game UI layout)
    for (let y = margin; y < height - margin - gridSize; y += gridSize + 10) {
        for (let x = margin; x < width - margin - gridSize; x += gridSize + 10) {
            positions.push({
                x,
                y,
                width: gridSize,
                height: gridSize,
                label: `grid_${positions.length}`,
            });
        }
    }

    return positions;
}

/**
 * Pre-process image for better recognition
 */
function preprocessImage(imageData: ImageData): ImageData {
    const processed = new ImageData(imageData.width, imageData.height);
    const pixels = imageData.data;
    const output = processed.data;

    for (let i = 0; i < pixels.length; i += 4) {
        // Convert to grayscale with enhanced contrast
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

        // Apply threshold to reduce noise
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;

        output[i] = value;
        output[i + 1] = value;
        output[i + 2] = value;
        output[i + 3] = pixels[i + 3]; // Keep alpha
    }

    return processed;
}

/**
 * Detect items using template matching
 * (Simplified version - in production would use actual icon templates)
 */
export async function detectItemsWithCV(
    imageDataUrl: string,
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    try {
        if (progressCallback) {
            progressCallback(0, 'Loading image...');
        }

        const { canvas, ctx, width, height } = await loadImageToCanvas(imageDataUrl);

        if (progressCallback) {
            progressCallback(20, 'Analyzing image structure...');
        }

        // Detect potential grid positions
        const gridPositions = detectGridPositions(width, height);

        if (progressCallback) {
            progressCallback(40, 'Detecting items...');
        }

        const detections: CVDetectionResult[] = [];

        // Analyze image regions for patterns
        // In a full implementation, we would compare against actual item icon templates
        // For now, we'll use heuristics based on color patterns and positions

        const fullImageData = ctx.getImageData(0, 0, width, height);

        // Analyze color distribution to infer possible items
        const colorStats = analyzeColorDistribution(fullImageData);

        if (progressCallback) {
            progressCallback(60, 'Matching patterns...');
        }

        // Use color heuristics to make educated guesses
        // This is a placeholder - real implementation would use actual templates
        if (colorStats.hasGreenTint) {
            // Might indicate health/HP items
            const hpItems =
                allData.items?.items.filter(
                    item =>
                        item.base_effect.toLowerCase().includes('hp') ||
                        item.base_effect.toLowerCase().includes('health')
                ) || [];

            if (hpItems.length > 0) {
                detections.push({
                    type: 'item',
                    entity: hpItems[0],
                    confidence: 0.55, // Lower confidence for heuristic-based detection
                    method: 'icon_similarity',
                });
            }
        }

        if (colorStats.hasRedTint) {
            // Might indicate damage items
            const damageItems =
                allData.items?.items.filter(item => item.base_effect.toLowerCase().includes('damage')) || [];

            if (damageItems.length > 0 && Math.random() > 0.5) {
                detections.push({
                    type: 'item',
                    entity: damageItems[0],
                    confidence: 0.52,
                    method: 'icon_similarity',
                });
            }
        }

        if (progressCallback) {
            progressCallback(100, 'Analysis complete');
        }

        logger.info({
            operation: 'cv.detect_items',
            data: {
                detectionsCount: detections.length,
                gridPositions: gridPositions.length,
            },
        });

        return detections;
    } catch (error) {
        logger.error({
            operation: 'cv.detect_items',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        throw error;
    }
}

/**
 * Analyze color distribution in image
 */
function analyzeColorDistribution(imageData: ImageData): {
    hasRedTint: boolean;
    hasGreenTint: boolean;
    hasBlueTint: boolean;
    brightness: number;
} {
    const pixels = imageData.data;
    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        totalRed += pixels[i];
        totalGreen += pixels[i + 1];
        totalBlue += pixels[i + 2];
        count++;
    }

    const avgRed = totalRed / count;
    const avgGreen = totalGreen / count;
    const avgBlue = totalBlue / count;
    const avgBrightness = (avgRed + avgGreen + avgBlue) / 3;

    return {
        hasRedTint: avgRed > avgGreen * 1.2 && avgRed > avgBlue * 1.2,
        hasGreenTint: avgGreen > avgRed * 1.2 && avgGreen > avgBlue * 1.2,
        hasBlueTint: avgBlue > avgRed * 1.2 && avgBlue > avgGreen * 1.2,
        brightness: avgBrightness,
    };
}

/**
 * Combine OCR and CV results for hybrid detection
 */
export function combineDetections(ocrResults: any[], cvResults: CVDetectionResult[]): CVDetectionResult[] {
    const combined: CVDetectionResult[] = [];
    const seen = new Set<string>();

    // Merge results, boosting confidence when both methods agree
    [...ocrResults, ...cvResults].forEach(result => {
        const entity = result.entity;
        const key = `${entity.id}_${result.type}`;

        if (seen.has(key)) {
            // Already added - boost confidence if found by both methods
            const existing = combined.find(r => r.entity.id === entity.id && r.type === result.type);
            if (existing) {
                existing.confidence = Math.min(0.98, existing.confidence * 1.2);
                existing.method = 'hybrid';
            }
        } else {
            seen.add(key);
            combined.push({
                type: result.type,
                entity: result.entity,
                confidence: result.confidence,
                position: result.position,
                method: result.method || 'template_match',
            });
        }
    });

    // Sort by confidence
    return combined.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract dominant colors from image region
 * Useful for icon-based matching
 */
export function extractDominantColors(
    imageData: ImageData,
    numColors: number = 5
): { r: number; g: number; b: number; frequency: number }[] {
    const pixels = imageData.data;
    const colorMap = new Map<string, number>();

    // Sample pixels (every 4th pixel for performance)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = Math.floor(pixels[i] / 32) * 32;
        const g = Math.floor(pixels[i + 1] / 32) * 32;
        const b = Math.floor(pixels[i + 2] / 32) * 32;
        const key = `${r},${g},${b}`;

        colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // Get top colors
    const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, numColors)
        .map(([key, freq]) => {
            const [r, g, b] = key.split(',').map(Number);
            return { r, g, b, frequency: freq };
        });

    return sortedColors;
}

/**
 * Detect UI regions (for finding inventory, stats, etc.)
 * Adapts to different UI layouts (PC vs Steam Deck)
 */
export function detectUIRegions(
    width: number,
    height: number
): { inventory?: ROI; stats?: ROI; character?: ROI; pauseMenu?: ROI; gameplay?: ROI } {
    const uiLayout = detectUILayout(width, height);
    const resolution = detectResolution(width, height);

    logger.info({
        operation: 'cv.detect_ui_regions',
        data: {
            width,
            height,
            uiLayout,
            resolution: resolution.category,
        },
    });

    // Detect if this is pause menu or gameplay
    // Pause menu typically has centered UI, gameplay has distributed UI
    const isPauseMenu = true; // TODO: Add heuristic detection

    if (isPauseMenu) {
        return detectPauseMenuRegions(width, height, uiLayout);
    } else {
        return detectGameplayRegions(width, height, uiLayout);
    }
}

/**
 * Detect regions for pause menu layout
 */
function detectPauseMenuRegions(
    width: number,
    height: number,
    uiLayout: 'pc' | 'steam_deck' | 'unknown'
): { inventory?: ROI; stats?: ROI; character?: ROI; pauseMenu?: ROI } {
    if (uiLayout === 'steam_deck') {
        // Steam Deck: More compact layout
        return {
            pauseMenu: {
                x: Math.floor(width * 0.15),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.7),
                height: Math.floor(height * 0.7),
                label: 'pause_menu',
            },
            stats: {
                x: Math.floor(width * 0.2),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.6),
                height: Math.floor(height * 0.2),
                label: 'stats',
            },
            inventory: {
                x: Math.floor(width * 0.2),
                y: Math.floor(height * 0.4),
                width: Math.floor(width * 0.6),
                height: Math.floor(height * 0.45),
                label: 'inventory',
            },
        };
    } else {
        // PC: Standard layout
        return {
            pauseMenu: {
                x: Math.floor(width * 0.15),
                y: Math.floor(height * 0.1),
                width: Math.floor(width * 0.7),
                height: Math.floor(height * 0.8),
                label: 'pause_menu',
            },
            stats: {
                x: Math.floor(width * 0.25),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.5),
                height: Math.floor(height * 0.2),
                label: 'stats',
            },
            inventory: {
                x: Math.floor(width * 0.25),
                y: Math.floor(height * 0.4),
                width: Math.floor(width * 0.5),
                height: Math.floor(height * 0.5),
                label: 'inventory',
            },
        };
    }
}

/**
 * Detect regions for gameplay layout
 */
function detectGameplayRegions(
    width: number,
    height: number,
    uiLayout: 'pc' | 'steam_deck' | 'unknown'
): { stats?: ROI; character?: ROI; gameplay?: ROI } {
    return {
        gameplay: {
            x: 0,
            y: 0,
            width,
            height,
            label: 'gameplay',
        },
        stats: {
            x: Math.floor(width * 0.02),
            y: Math.floor(height * 0.02),
            width: Math.floor(width * 0.15),
            height: Math.floor(height * 0.12),
            label: 'stats',
        },
        character: {
            x: Math.floor(width * 0.02),
            y: Math.floor(height * 0.2),
            width: Math.floor(width * 0.15),
            height: Math.floor(height * 0.4),
            label: 'character',
        },
    };
}

// ========================================
// Global Assignments
// ========================================
(window as any).initCV = initCV;
