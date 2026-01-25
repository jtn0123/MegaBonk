// ========================================
// MegaBonk Batch Screenshot Processing
// ========================================
// Process multiple screenshots at once and compare detected builds

import type { Item, Tome, AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import {
    detectItemsWithCV,
    initCV,
    loadItemTemplates,
    combineDetections,
    aggregateDuplicates,
    isFullyLoaded as isCVFullyLoaded,
} from './cv/index.ts';
import { autoDetectFromImage, initOCR, type DetectionResult } from './ocr.ts';
import { escapeHtml } from './utils.ts';

// ========================================
// Types
// ========================================

/**
 * Detection result for a single screenshot
 */
export interface BatchDetectionResult {
    id: string;
    filename: string;
    imageDataUrl: string;
    thumbnail: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error?: string;
    detectedBuild?: {
        character: Character | null;
        weapon: Weapon | null;
        items: Array<{ item: Item; count: number; confidence: number }>;
        tomes: Array<{ tome: Tome; confidence: number }>;
    };
    stats?: {
        totalItems: number;
        avgConfidence: number;
        processingTimeMs: number;
    };
}

/**
 * Batch processing progress
 */
export interface BatchProgress {
    total: number;
    completed: number;
    current: string;
    overallProgress: number;
}

type ProgressCallback = (progress: BatchProgress) => void;

// ========================================
// State
// ========================================

// Note: gameData is stored by initCV and initOCR, no need to store here
let isInitialized = false;
let batchResults: BatchDetectionResult[] = [];

// ========================================
// Initialization
// ========================================

/**
 * Initialize batch scan module
 */
export function initBatchScan(gameData: AllGameData): void {
    if (isInitialized) return;

    initCV(gameData);
    initOCR(gameData);

    // Preload templates
    loadItemTemplates().catch(error => {
        logger.warn({
            operation: 'batch_scan.templates_load_failed',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    });

    isInitialized = true;

    logger.info({
        operation: 'batch_scan.init',
        data: { itemsCount: gameData.items?.items.length || 0 },
    });
}

// ========================================
// Image Processing
// ========================================

/**
 * Read file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                resolve(result);
            } else {
                reject(new Error('Failed to read image'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Generate thumbnail from image
 */
function generateThumbnail(imageDataUrl: string, maxSize: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * Detect build from single image
 */
async function detectBuildFromImage(imageData: string): Promise<BatchDetectionResult['detectedBuild']> {
    // Run OCR detection
    let ocrResults: {
        items: DetectionResult[];
        tomes: DetectionResult[];
        character: DetectionResult | null;
        weapon: DetectionResult | null;
    } = { items: [], tomes: [], character: null, weapon: null };

    try {
        ocrResults = await autoDetectFromImage(imageData);
    } catch (error) {
        logger.warn({
            operation: 'batch_scan.ocr_failed',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }

    // Run CV detection
    let cvResults: Array<{
        entity: Item | Tome | Character | Weapon;
        confidence: number;
        type: string;
        method: 'template_match' | 'icon_similarity' | 'hybrid';
    }> = [];

    if (isCVFullyLoaded()) {
        try {
            const rawCvResults = await detectItemsWithCV(imageData);
            // Add method property to match CVDetectionResult type
            cvResults = rawCvResults.map(r => ({
                ...r,
                method: 'template_match' as const,
            }));
        } catch (error) {
            logger.warn({
                operation: 'batch_scan.cv_failed',
                error: { name: (error as Error).name, message: (error as Error).message },
            });
        }
    }

    // Convert CV results to OCR format
    const cvAsOCR: DetectionResult[] = cvResults.map(cv => ({
        type: cv.type as 'item' | 'tome' | 'character' | 'weapon',
        entity: cv.entity,
        confidence: cv.confidence,
        rawText: `cv_detected_${cv.entity.name}`,
    }));

    // Combine and aggregate - pass CV results as CVDetectionResult[]
    const cvItemResults = cvResults
        .filter(r => r.type === 'item')
        .map(r => ({ ...r, type: r.type as 'item' | 'tome' | 'character' | 'weapon' }));
    const cvTomeResults = cvResults
        .filter(r => r.type === 'tome')
        .map(r => ({ ...r, type: r.type as 'item' | 'tome' | 'character' | 'weapon' }));

    const combinedItems = combineDetections(
        [...ocrResults.items, ...cvAsOCR.filter(r => r.type === 'item')],
        cvItemResults
    );
    const combinedTomes = combineDetections(
        [...ocrResults.tomes, ...cvAsOCR.filter(r => r.type === 'tome')],
        cvTomeResults
    );

    const aggregatedItems = aggregateDuplicates(combinedItems);
    const aggregatedTomes = aggregateDuplicates(combinedTomes);

    return {
        character: ocrResults.character
            ? (ocrResults.character.entity as Character)
            : (cvResults.find(r => r.type === 'character')?.entity as Character) || null,
        weapon: ocrResults.weapon
            ? (ocrResults.weapon.entity as Weapon)
            : (cvResults.find(r => r.type === 'weapon')?.entity as Weapon) || null,
        items: aggregatedItems.map(r => ({
            item: r.entity as Item,
            count: r.count || 1,
            confidence: r.confidence,
        })),
        tomes: aggregatedTomes.map(r => ({
            tome: r.entity as Tome,
            confidence: r.confidence,
        })),
    };
}

// ========================================
// Batch Processing
// ========================================

/**
 * Process multiple screenshots
 */
export async function processBatch(
    files: FileList | File[],
    onProgress?: ProgressCallback
): Promise<BatchDetectionResult[]> {
    const fileArray = Array.from(files);

    // Validate files
    const validFiles = fileArray.filter(file => {
        if (!file.type.startsWith('image/')) {
            logger.warn({
                operation: 'batch_scan.invalid_file',
                data: { filename: file.name, type: file.type },
            });
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            logger.warn({
                operation: 'batch_scan.file_too_large',
                data: { filename: file.name, size: file.size },
            });
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) {
        ToastManager.error('No valid image files selected');
        return [];
    }

    // Clear previous results
    batchResults = [];

    // Initialize results
    for (const file of validFiles) {
        batchResults.push({
            id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filename: file.name,
            imageDataUrl: '',
            thumbnail: '',
            timestamp: new Date().toISOString(),
            status: 'pending',
        });
    }

    // Process each file
    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const result = batchResults[i];

        // Skip if file or result is undefined (should never happen, but satisfies TypeScript)
        if (!file || !result) continue;

        onProgress?.({
            total: validFiles.length,
            completed: i,
            current: file.name,
            overallProgress: (i / validFiles.length) * 100,
        });

        result.status = 'processing';
        const startTime = Date.now();

        try {
            // Read and generate thumbnail
            result.imageDataUrl = await readFileAsDataURL(file);
            result.thumbnail = await generateThumbnail(result.imageDataUrl);

            // Detect build
            const detectedBuild = await detectBuildFromImage(result.imageDataUrl);
            result.detectedBuild = detectedBuild;

            // Calculate stats (detectedBuild is guaranteed to exist from detectBuildFromImage)
            const totalItems = detectedBuild?.items.reduce((sum, item) => sum + item.count, 0) ?? 0;
            const allConfidences = [
                ...(detectedBuild?.items.map(item => item.confidence) ?? []),
                ...(detectedBuild?.tomes.map(t => t.confidence) ?? []),
            ];
            const avgConfidence =
                allConfidences.length > 0 ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length : 0;

            result.stats = {
                totalItems,
                avgConfidence,
                processingTimeMs: Date.now() - startTime,
            };

            result.status = 'complete';

            logger.info({
                operation: 'batch_scan.file_processed',
                data: {
                    filename: file.name,
                    itemsDetected: totalItems,
                    avgConfidence: Math.round(avgConfidence * 100),
                    timeMs: result.stats.processingTimeMs,
                },
            });
        } catch (error) {
            result.status = 'error';
            result.error = (error as Error).message;

            logger.error({
                operation: 'batch_scan.file_error',
                error: { name: (error as Error).name, message: (error as Error).message },
                data: { filename: file.name },
            });
        }
    }

    onProgress?.({
        total: validFiles.length,
        completed: validFiles.length,
        current: 'Complete',
        overallProgress: 100,
    });

    logger.info({
        operation: 'batch_scan.complete',
        data: {
            totalFiles: validFiles.length,
            successful: batchResults.filter(r => r.status === 'complete').length,
            failed: batchResults.filter(r => r.status === 'error').length,
        },
    });

    return batchResults;
}

// ========================================
// Results Management
// ========================================

/**
 * Get all batch results
 */
export function getBatchResults(): BatchDetectionResult[] {
    return [...batchResults];
}

/**
 * Get result by ID
 */
export function getBatchResultById(id: string): BatchDetectionResult | undefined {
    return batchResults.find(r => r.id === id);
}

/**
 * Clear batch results
 */
export function clearBatchResults(): void {
    batchResults = [];
}

/**
 * Remove a result from batch
 */
export function removeBatchResult(id: string): boolean {
    const index = batchResults.findIndex(r => r.id === id);
    if (index === -1) return false;
    batchResults.splice(index, 1);
    return true;
}

// ========================================
// Comparison
// ========================================

/**
 * Compare two batch results
 */
export function compareBatchResults(
    id1: string,
    id2: string
): {
    result1: BatchDetectionResult;
    result2: BatchDetectionResult;
    commonItems: string[];
    uniqueToFirst: string[];
    uniqueToSecond: string[];
} | null {
    const result1 = getBatchResultById(id1);
    const result2 = getBatchResultById(id2);

    if (!result1 || !result2 || !result1.detectedBuild || !result2.detectedBuild) {
        return null;
    }

    const items1 = new Set(result1.detectedBuild.items.map(i => i.item.id));
    const items2 = new Set(result2.detectedBuild.items.map(i => i.item.id));

    const commonItems = [...items1].filter(id => items2.has(id));
    const uniqueToFirst = [...items1].filter(id => !items2.has(id));
    const uniqueToSecond = [...items2].filter(id => !items1.has(id));

    return {
        result1,
        result2,
        commonItems,
        uniqueToFirst,
        uniqueToSecond,
    };
}

/**
 * Get summary stats across all batch results
 */
export function getBatchSummary(): {
    totalScreenshots: number;
    successfulScans: number;
    totalItemsDetected: number;
    avgConfidence: number;
    mostCommonItems: Array<{ itemId: string; itemName: string; count: number }>;
} {
    const successful = batchResults.filter(r => r.status === 'complete' && r.detectedBuild);

    if (successful.length === 0) {
        return {
            totalScreenshots: batchResults.length,
            successfulScans: 0,
            totalItemsDetected: 0,
            avgConfidence: 0,
            mostCommonItems: [],
        };
    }

    // Count item occurrences across all screenshots
    const itemCounts = new Map<string, { name: string; count: number }>();

    let totalItems = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const result of successful) {
        if (!result.detectedBuild) continue;

        for (const { item, count, confidence } of result.detectedBuild.items) {
            totalItems += count;
            totalConfidence += confidence;
            confidenceCount++;

            const existing = itemCounts.get(item.id);
            if (existing) {
                existing.count += count;
            } else {
                itemCounts.set(item.id, { name: item.name, count });
            }
        }
    }

    // Sort by count and take top 10
    const mostCommonItems = [...itemCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([itemId, { name, count }]) => ({ itemId, itemName: name, count }));

    return {
        totalScreenshots: batchResults.length,
        successfulScans: successful.length,
        totalItemsDetected: totalItems,
        avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        mostCommonItems,
    };
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render batch results grid
 */
export function renderBatchResultsGrid(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (batchResults.length === 0) {
        container.innerHTML = `
            <div class="batch-empty-state">
                <p>No screenshots processed yet.</p>
                <p>Upload multiple screenshots to compare builds.</p>
            </div>
        `;
        return;
    }

    const summary = getBatchSummary();

    container.innerHTML = `
        <div class="batch-summary">
            <div class="batch-stat">
                <span class="stat-value">${summary.successfulScans}/${summary.totalScreenshots}</span>
                <span class="stat-label">Processed</span>
            </div>
            <div class="batch-stat">
                <span class="stat-value">${summary.totalItemsDetected}</span>
                <span class="stat-label">Items Found</span>
            </div>
            <div class="batch-stat">
                <span class="stat-value">${Math.round(summary.avgConfidence * 100)}%</span>
                <span class="stat-label">Avg Confidence</span>
            </div>
        </div>

        <div class="batch-results-grid">
            ${batchResults
                .map(
                    result => `
                <div class="batch-result-card ${result.status}" data-id="${result.id}">
                    <div class="batch-thumbnail">
                        ${result.thumbnail ? `<img src="${result.thumbnail}" alt="${escapeHtml(result.filename)}" />` : '<div class="batch-thumbnail-placeholder">Loading...</div>'}
                        <div class="batch-status-badge status-${result.status}">
                            ${result.status === 'complete' ? '✓' : result.status === 'error' ? '✗' : '...'}
                        </div>
                    </div>
                    <div class="batch-info">
                        <div class="batch-filename">${escapeHtml(result.filename)}</div>
                        ${
                            result.status === 'complete' && result.stats
                                ? `
                            <div class="batch-stats">
                                <span>${result.stats.totalItems} items</span>
                                <span>${Math.round(result.stats.avgConfidence * 100)}%</span>
                            </div>
                        `
                                : result.status === 'error'
                                  ? `<div class="batch-error">${escapeHtml(result.error || 'Unknown error')}</div>`
                                  : '<div class="batch-processing">Processing...</div>'
                        }
                    </div>
                    ${
                        result.status === 'complete'
                            ? `
                        <div class="batch-actions">
                            <button class="btn-small batch-view-btn" data-id="${result.id}">View</button>
                            <button class="btn-small batch-apply-btn" data-id="${result.id}">Apply</button>
                        </div>
                    `
                            : ''
                    }
                </div>
            `
                )
                .join('')}
        </div>

        ${
            summary.mostCommonItems.length > 0
                ? `
            <div class="batch-common-items">
                <h4>Most Common Items</h4>
                <div class="common-items-list">
                    ${summary.mostCommonItems
                        .slice(0, 5)
                        .map(
                            item => `
                        <span class="common-item">${escapeHtml(item.itemName)} (${item.count})</span>
                    `
                        )
                        .join('')}
                </div>
            </div>
        `
                : ''
        }
    `;
}

// ========================================
// Reset for testing
// ========================================

export function __resetForTesting(): void {
    batchResults = [];
    isInitialized = false;
}
