// ========================================
// CV Main Detection Logic
// ========================================

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';
import { detectResolution } from '../test-utils.ts';
import type { CVDetectionResult, ROI, TemplateData } from './types.ts';
import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    isPriorityTemplatesLoaded,
    getResizedTemplate,
    setResizedTemplate,
    getMultiScaleTemplate,
    hasMultiScaleTemplates,
    COMMON_ICON_SIZES,
    CACHE_TTL,
    MAX_CACHE_SIZE,
} from './state.ts';
import { loadItemTemplates } from './templates.ts';
import {
    getDominantColor,
    isEmptyCell,
    calculateColorVariance,
    detectBorderRarity,
    countRarityBorderPixels,
    detectRarityAtPixel,
} from './color.ts';
import { calculateEnhancedSimilarity } from './similarity.ts';
import { getTrainingTemplatesForItem, isTrainingDataLoaded } from './training.ts';
import type { TrainingTemplate } from './training.ts';

// ========================================
// Configuration
// ========================================

/** Base path for worker scripts - can be overridden for subdirectory deployments */
let workerBasePath = '';

/**
 * Set the base path for worker scripts
 * Useful for deployments where the app is not at the root URL
 * @param path The base path (e.g., '/megabonk' or '' for root)
 */
export function setWorkerBasePath(path: string): void {
    // Normalize: remove trailing slash if present
    workerBasePath = path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Get the full path to a worker script
 */
function getWorkerPath(workerName: string): string {
    return `${workerBasePath}/workers/${workerName}`;
}

// ========================================
// Image Loading
// ========================================

/** Default timeout for image loading (30 seconds) */
const IMAGE_LOAD_TIMEOUT_MS = 30000;

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
 * Generate hash from image data URL for caching
 * Uses DJB2 hash algorithm with higher sample count for better collision resistance
 */
function hashImageDataUrl(dataUrl: string): string {
    const len = dataUrl.length;
    let hash1 = 5381; // DJB2 initial value
    let hash2 = 0;

    // Sample more characters for better collision resistance
    // Use 500 samples instead of 100, and include start/middle/end regions
    const sampleCount = Math.min(500, len);
    const step = Math.max(1, Math.floor(len / sampleCount));

    // DJB2 hash on sampled characters
    // Use >>> 0 inside loop to keep values as unsigned 32-bit integers
    // This prevents overflow beyond JS safe integer range
    for (let i = 0; i < len; i += step) {
        const char = dataUrl.charCodeAt(i);
        hash1 = (((hash1 << 5) + hash1) ^ char) >>> 0; // hash * 33 ^ char, kept as uint32
    }

    // Secondary hash from end of string for additional uniqueness
    const endSampleStart = Math.max(0, len - 1000);
    for (let i = endSampleStart; i < len; i += 10) {
        const char = dataUrl.charCodeAt(i);
        hash2 = ((hash2 << 5) + hash2 + char) >>> 0; // kept as uint32
    }

    // Combine both hashes with length for final key
    // Use >>> 0 to ensure unsigned 32-bit integer
    return `img_${(hash1 >>> 0).toString(16)}_${(hash2 >>> 0).toString(16)}_${len}`;
}

/**
 * Get cached detection results if available
 */
function getCachedResults(imageHash: string): CVDetectionResult[] | null {
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
function cacheResults(imageHash: string, results: CVDetectionResult[]): void {
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
// Similarity Calculation
// ========================================

/**
 * Calculate similarity between two image regions using enhanced multi-method approach
 * Returns similarity score (0-1, higher is better)
 * Uses preprocessing (contrast + normalization) and multiple similarity metrics (NCC, SSIM, histogram, edges)
 * Scientific testing showed +41.8% F1 improvement with this approach
 */
export function calculateSimilarity(imageData1: ImageData, imageData2: ImageData): number {
    return calculateEnhancedSimilarity(imageData1, imageData2);
}

/**
 * Calculate Intersection over Union (IoU) between two boxes
 * Used for Non-Maximum Suppression
 */
export function calculateIoU(box1: ROI, box2: ROI): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;

    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Non-Maximum Suppression to remove overlapping detections
 * Keeps highest confidence detection when boxes overlap
 */
export function nonMaxSuppression(detections: CVDetectionResult[], iouThreshold: number = 0.3): CVDetectionResult[] {
    if (detections.length === 0) return [];

    // Sort by confidence (highest first)
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: CVDetectionResult[] = [];

    for (const detection of sorted) {
        if (!detection.position) {
            kept.push(detection);
            continue;
        }

        // Check if this detection overlaps with any already kept
        let shouldKeep = true;
        for (const keptDetection of kept) {
            if (!keptDetection.position) continue;

            const iou = calculateIoU(detection.position, keptDetection.position);
            if (iou > iouThreshold) {
                shouldKeep = false;
                break;
            }
        }

        if (shouldKeep) {
            kept.push(detection);
        }
    }

    return kept;
}

// ========================================
// Icon Size and Grid Detection
// ========================================

/**
 * Enhanced hotbar region detection using rarity border analysis
 * Returns the Y coordinates of the detected hotbar band
 */
export function detectHotbarRegion(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): { topY: number; bottomY: number; confidence: number } {
    // Scan bottom 35% of screen (hotbar is at very bottom)
    const scanStartY = Math.floor(height * 0.65);
    const scanEndY = height - 5;

    // Sample center 70% of width (hotbar is centered)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    // Analyze horizontal strips
    const stripHeight = 2;
    const strips: Array<{
        y: number;
        rarityRatio: number;
        colorfulRatio: number;
        variance: number;
    }> = [];

    for (let y = scanStartY; y < scanEndY; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const stats = countRarityBorderPixels(imageData);
        const variance = calculateColorVariance(imageData);

        strips.push({
            y,
            rarityRatio: stats.rarityCount / stats.total,
            colorfulRatio: stats.colorfulCount / stats.total,
            variance,
        });
    }

    // Find the best hotbar band using sliding window
    const windowSize = 35; // ~70px window
    let bestScore = 0;
    let bestBandStart = scanStartY;
    let bestBandEnd = scanEndY;

    for (let i = 0; i < strips.length - windowSize; i++) {
        const windowSlice = strips.slice(i, i + windowSize);

        const avgRarityRatio = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.variance, 0) / windowSlice.length;

        let score = 0;

        // Rarity borders are a strong signal
        if (avgRarityRatio > 0.01) {
            score += avgRarityRatio * 200;
        }

        // Colorful pixels indicate icons
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }

        // High variance means varied content (icons)
        if (avgVariance > 200) {
            score += Math.min(30, avgVariance / 50);
        }

        // Prefer lower on screen (hotbar is at very bottom)
        const yPosition = windowSlice[0].y / height;
        if (yPosition > 0.88) {
            score += 30;
        } else if (yPosition > 0.82) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = windowSlice[0].y;
            bestBandEnd = windowSlice[windowSlice.length - 1].y + stripHeight;
        }
    }

    // Constrain band height
    const maxBandHeight = Math.floor(height * 0.15);
    const minBandHeight = Math.floor(height * 0.05);

    if (bestBandEnd - bestBandStart > maxBandHeight) {
        bestBandStart = bestBandEnd - maxBandHeight;
    }
    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    // Fallback if nothing detected
    if (bestScore < 10) {
        bestBandStart = Math.floor(height * 0.85);
        bestBandEnd = height - 5;
    }

    return {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        confidence: Math.min(1, bestScore / 100),
    };
}

/**
 * Detect vertical edges (icon borders) using rarity colors
 * Returns X positions of detected edges
 */
export function detectIconEdges(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandRegion: { topY: number; bottomY: number }
): number[] {
    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // Only scan center 70% of width
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    // Scan multiple horizontal lines within the band
    const scanYOffsets = [0.1, 0.25, 0.5, 0.75, 0.9];
    const edgeCounts = new Map<number, number>();

    for (const yOffset of scanYOffsets) {
        const scanY = Math.floor(topY + bandHeight * yOffset);
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX;
            const idx = localX * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            const rarity = detectRarityAtPixel(r, g, b);

            if (rarity && !inBorder) {
                inBorder = true;
                borderStart = x;
            } else if (!rarity && inBorder) {
                const borderWidth = x - borderStart;

                // Valid borders are 2-8 pixels wide
                if (borderWidth >= 2 && borderWidth <= 8) {
                    // Record edge at start of border
                    const bucket = Math.round(borderStart / 4) * 4; // 4px tolerance
                    edgeCounts.set(bucket, (edgeCounts.get(bucket) || 0) + 1);
                }

                inBorder = false;
            }
        }
    }

    // Filter to edges detected in multiple scan lines
    const consistentEdges: number[] = [];
    for (const [x, count] of edgeCounts) {
        if (count >= 2) {
            consistentEdges.push(x);
        }
    }

    // Sort by X position
    consistentEdges.sort((a, b) => a - b);

    // Filter by spacing consistency
    return filterByConsistentSpacing(consistentEdges);
}

/**
 * Filter edges to keep only those with consistent spacing
 */
function filterByConsistentSpacing(edges: number[]): number[] {
    if (edges.length < 3) return edges;

    // Calculate gaps
    const gaps: Array<{ gap: number; fromIdx: number; toIdx: number }> = [];
    for (let i = 1; i < edges.length; i++) {
        const gap = edges[i] - edges[i - 1];
        if (gap > 20 && gap < 120) {
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) return edges;

    // Find mode gap (most common spacing)
    const gapCounts = new Map<number, number>();
    const tolerance = 4;

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    let modeGap = 0;
    let modeCount = 0;
    for (const [bucket, count] of gapCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeGap = bucket;
        }
    }

    if (modeCount < 2) return edges;

    // Keep edges that fit the mode spacing
    const consistentIndices = new Set<number>();
    for (const { gap, fromIdx, toIdx } of gaps) {
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentIndices.add(fromIdx);
            consistentIndices.add(toIdx);
        }
    }

    return edges.filter((_, idx) => consistentIndices.has(idx));
}

// ========================================
// Two-Phase Grid Detection (Performance Optimization)
// ========================================

/**
 * Grid parameters detected from icon edges
 */
interface GridParameters {
    startX: number;
    startY: number;
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
    confidence: number;
}

/**
 * Infer grid structure from detected edges
 * Returns grid parameters if a consistent grid pattern is found
 */
function inferGridFromEdges(
    edges: number[],
    hotbarRegion: { topY: number; bottomY: number },
    width: number
): GridParameters | null {
    if (edges.length < 2) {
        return null;
    }

    // Calculate spacings between edges
    const spacings: number[] = [];
    for (let i = 1; i < edges.length; i++) {
        const spacing = edges[i] - edges[i - 1];
        if (spacing > 20 && spacing < 120) {
            spacings.push(spacing);
        }
    }

    if (spacings.length < 1) {
        return null;
    }

    // Find the mode spacing (most common cell size)
    const spacingCounts = new Map<number, number>();
    const tolerance = 6; // 6px tolerance for grouping

    for (const spacing of spacings) {
        const bucket = Math.round(spacing / tolerance) * tolerance;
        spacingCounts.set(bucket, (spacingCounts.get(bucket) || 0) + 1);
    }

    let modeSpacing = 0;
    let modeCount = 0;
    for (const [bucket, count] of spacingCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeSpacing = bucket;
        }
    }

    // Need at least 2 consistent gaps
    if (modeCount < 2 || modeSpacing < 25) {
        return null;
    }

    // Find the first edge that starts a consistent sequence
    let startX = edges[0];
    for (let i = 0; i < edges.length - 1; i++) {
        const gap = edges[i + 1] - edges[i];
        if (Math.abs(gap - modeSpacing) <= tolerance) {
            startX = edges[i];
            break;
        }
    }

    // Count consistent columns
    let columns = 1;
    let lastEdge = startX;
    for (let i = 0; i < edges.length; i++) {
        if (edges[i] <= lastEdge) continue;
        const gap = edges[i] - lastEdge;
        if (Math.abs(gap - modeSpacing) <= tolerance) {
            columns++;
            lastEdge = edges[i];
        }
    }

    // Calculate confidence based on consistency
    const expectedEdges = columns;
    const actualConsistentEdges = modeCount + 1;
    const confidence = Math.min(1, actualConsistentEdges / Math.max(3, expectedEdges));

    // Determine rows based on hotbar height
    const bandHeight = hotbarRegion.bottomY - hotbarRegion.topY;
    const rows = Math.max(1, Math.round(bandHeight / modeSpacing));

    return {
        startX,
        startY: hotbarRegion.topY,
        cellWidth: modeSpacing,
        cellHeight: modeSpacing,
        columns,
        rows,
        confidence,
    };
}

/**
 * Generate grid cell ROIs from grid parameters
 */
function generateGridROIs(grid: GridParameters, maxCells: number = 50): ROI[] {
    const cells: ROI[] = [];

    for (let row = 0; row < grid.rows && cells.length < maxCells; row++) {
        for (let col = 0; col < grid.columns && cells.length < maxCells; col++) {
            cells.push({
                x: grid.startX + col * grid.cellWidth,
                y: grid.startY + row * grid.cellHeight,
                width: grid.cellWidth,
                height: grid.cellHeight,
                label: `grid_${row}_${col}`,
            });
        }
    }

    return cells;
}

/**
 * Two-phase detection: first detect grid, then match only at grid positions
 * Much faster than sliding window (100-200x speedup)
 */
async function detectIconsWithTwoPhase(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    options: {
        minConfidence?: number;
        progressCallback?: (progress: number, status: string) => void;
    } = {}
): Promise<{ detections: CVDetectionResult[]; gridUsed: boolean; grid: GridParameters | null }> {
    const { minConfidence = 0.65, progressCallback } = options;

    // Phase 1: Detect grid structure
    if (progressCallback) {
        progressCallback(20, 'Phase 1: Detecting grid structure...');
    }

    const hotbarRegion = detectHotbarRegion(ctx, width, height);
    const edges = detectIconEdges(ctx, width, hotbarRegion);
    const grid = inferGridFromEdges(edges, hotbarRegion, width);

    logger.info({
        operation: 'cv.two_phase.grid_detection',
        data: {
            hotbarConfidence: hotbarRegion.confidence,
            edgesFound: edges.length,
            gridDetected: !!grid,
            gridConfidence: grid?.confidence || 0,
        },
    });

    // If grid detection failed or low confidence, fall back to sliding window
    if (!grid || grid.confidence < 0.4 || grid.columns < 3) {
        logger.info({
            operation: 'cv.two_phase.fallback_to_sliding_window',
            data: { reason: !grid ? 'no_grid' : grid.confidence < 0.4 ? 'low_confidence' : 'too_few_columns' },
        });
        return { detections: [], gridUsed: false, grid: null };
    }

    // Phase 2: Match templates only at grid positions
    if (progressCallback) {
        progressCallback(30, 'Phase 2: Matching templates at grid positions...');
    }

    const gridCells = generateGridROIs(grid);
    const detections: CVDetectionResult[] = [];
    const itemTemplates = getItemTemplates();
    const templatesByColor = getTemplatesByColor();
    const useMultiTemplate = isTrainingDataLoaded();

    logger.info({
        operation: 'cv.two_phase.matching_start',
        data: {
            gridCells: gridCells.length,
            columns: grid.columns,
            rows: grid.rows,
            cellSize: grid.cellWidth,
        },
    });

    for (let i = 0; i < gridCells.length; i++) {
        const cell = gridCells[i];

        // Update progress
        if (progressCallback && i % 5 === 0) {
            const progress = 30 + Math.floor((i / gridCells.length) * 50);
            progressCallback(progress, `Matching cell ${i + 1}/${gridCells.length}...`);
        }

        // Extract cell image data for pre-filtering
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        // Skip empty cells
        if (isEmptyCell(cellData)) {
            continue;
        }

        // Check variance
        const variance = calculateColorVariance(cellData);
        if (variance < 800) {
            continue;
        }

        // Color-based pre-filtering
        const cellColor = getDominantColor(cellData);
        const colorCandidates = templatesByColor.get(cellColor) || [];
        const mixedCandidates = templatesByColor.get('mixed') || [];
        const candidateItems = [...colorCandidates, ...mixedCandidates];
        const itemsToCheck = candidateItems.length > 0 ? candidateItems : items.slice(0, 30);

        // Match against candidate templates
        let bestMatch: { item: Item; similarity: number } | null = null;

        for (const item of itemsToCheck) {
            const template = itemTemplates.get(item.id);
            if (!template) continue;

            // Get training templates if available
            const trainingTemplates = useMultiTemplate ? getTrainingTemplatesForItem(item.id) : [];

            // Match template
            const similarity =
                trainingTemplates.length > 0
                    ? matchTemplateMulti(ctx, cell, template, item.id, trainingTemplates)
                    : matchTemplate(ctx, cell, template, item.id);

            if (similarity > minConfidence && (!bestMatch || similarity > bestMatch.similarity)) {
                bestMatch = { item, similarity };
            }
        }

        if (bestMatch) {
            detections.push({
                type: 'item',
                entity: bestMatch.item,
                confidence: bestMatch.similarity,
                position: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
                method: 'template_match',
            });
        }
    }

    logger.info({
        operation: 'cv.two_phase.complete',
        data: {
            detections: detections.length,
            cellsScanned: gridCells.length,
        },
    });

    return { detections, gridUsed: true, grid };
}

/**
 * Get adaptive icon sizes based on image dimensions
 * Returns array of sizes to try for multi-scale detection
 */
export function getAdaptiveIconSizes(width: number, height: number): number[] {
    const resolution = detectResolution(width, height);

    // Base sizes for each resolution
    const baseSizes: Record<string, number[]> = {
        '720p': [32, 38, 44],
        '1080p': [40, 48, 56],
        '1440p': [48, 55, 64],
        '4K': [64, 72, 80],
        steam_deck: [36, 42, 48],
    };

    return baseSizes[resolution.category] || [40, 50, 60];
}

/**
 * Dynamic scale detection result
 */
interface ScaleDetectionResult {
    iconSize: number;
    confidence: number;
    method: 'edge_analysis' | 'resolution_fallback';
}

/**
 * Dynamically detect icon scale from border analysis
 * More accurate than resolution-based estimation
 */
export function detectIconScale(ctx: CanvasRenderingContext2D, width: number, height: number): ScaleDetectionResult {
    // First try to detect from edge analysis
    const hotbar = detectHotbarRegion(ctx, width, height);

    if (hotbar.confidence < 0.3) {
        // Low confidence in hotbar detection, use resolution fallback
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.5,
            method: 'resolution_fallback',
        };
    }

    const edges = detectIconEdges(ctx, width, hotbar);

    if (edges.length < 2) {
        // Not enough edges detected, use resolution fallback
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.4,
            method: 'resolution_fallback',
        };
    }

    // Compute spacings between edges
    const spacings: number[] = [];
    for (let i = 1; i < edges.length; i++) {
        const spacing = edges[i] - edges[i - 1];
        // Valid icon sizes are between 25 and 100 pixels
        if (spacing >= 25 && spacing <= 100) {
            spacings.push(spacing);
        }
    }

    if (spacings.length < 2) {
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.4,
            method: 'resolution_fallback',
        };
    }

    // Find mode spacing (most common)
    const tolerance = 4;
    const buckets = new Map<number, number>();
    for (const spacing of spacings) {
        const bucket = Math.round(spacing / tolerance) * tolerance;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    let modeSpacing = 0;
    let modeCount = 0;
    for (const [bucket, count] of buckets) {
        if (count > modeCount) {
            modeCount = count;
            modeSpacing = bucket;
        }
    }

    // Calculate confidence based on consistency
    const matchingSpacings = spacings.filter(s => Math.abs(s - modeSpacing) <= tolerance).length;
    const confidence = Math.min(0.95, matchingSpacings / spacings.length);

    logger.info({
        operation: 'cv.scale_detection',
        data: {
            edgesFound: edges.length,
            spacings: spacings.length,
            detectedSize: modeSpacing,
            confidence,
        },
    });

    return {
        iconSize: modeSpacing,
        confidence,
        method: 'edge_analysis',
    };
}

/**
 * Detect grid structure in image (for item grids)
 * Returns potential grid positions with dynamic detection
 * @deprecated Use detectIconsWithSlidingWindow for better accuracy
 */
export function detectGridPositions(width: number, height: number, _gridSize: number = 64): ROI[] {
    // Use resolution-appropriate grid size
    const resolution = detectResolution(width, height);

    // MegaBonk icons are approximately 40-48px depending on resolution
    const gridSizes: Record<string, number> = {
        '720p': 38,
        '1080p': 45,
        '1440p': 55,
        '4K': 70,
        steam_deck: 40,
    };

    const adaptiveGridSize = gridSizes[resolution.category] || 45;

    const positions: ROI[] = [];
    const margin = 50; // Hotbar has margins on sides
    const spacing = Math.floor(adaptiveGridSize * 0.12); // Small gap between icons

    // MegaBonk hotbar is at the VERY BOTTOM of the screen (last 5-8%)
    // For 1080p: approximately y=1020-1030
    const hotbarY = height - adaptiveGridSize - 15; // 15px from bottom edge

    for (let x = margin; x < width - margin - adaptiveGridSize; x += adaptiveGridSize + spacing) {
        positions.push({
            x,
            y: hotbarY,
            width: adaptiveGridSize,
            height: adaptiveGridSize,
            label: `cell_${positions.length}`,
        });
    }

    // Limit to reasonable number of cells (typical inventory has 15-25 slots)
    return positions.slice(0, 30);
}

// ========================================
// Template Matching Helpers
// ========================================

/**
 * Extract icon region from cell, excluding count number area
 * Count numbers are typically in bottom-right corner (last 25-30% of cell)
 */
function extractIconRegion(ctx: CanvasRenderingContext2D, cell: ROI): ImageData {
    // Extract 80% of cell to avoid count number area in bottom-right
    let iconWidth = Math.floor(cell.width * 0.8);
    let iconHeight = Math.floor(cell.height * 0.8);

    // Ensure minimum size
    iconWidth = Math.max(1, iconWidth);
    iconHeight = Math.max(1, iconHeight);

    // Bounds check: ensure we don't exceed canvas dimensions
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const safeX = Math.max(0, Math.min(cell.x, canvasWidth - 1));
    const safeY = Math.max(0, Math.min(cell.y, canvasHeight - 1));
    const safeWidth = Math.min(iconWidth, canvasWidth - safeX);
    const safeHeight = Math.min(iconHeight, canvasHeight - safeY);

    // Return empty ImageData if dimensions are invalid
    if (safeWidth <= 0 || safeHeight <= 0) {
        return ctx.createImageData(1, 1);
    }

    return ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
}

/**
 * Resize ImageData to target dimensions
 * Returns null if canvas context cannot be obtained
 * Exported for use by CV Validator and other library consumers
 */
export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData | null {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        logger.warn({
            operation: 'cv.resize_image_data',
            error: { name: 'CanvasError', message: 'Failed to get source canvas 2D context' },
        });
        return null;
    }
    ctx.putImageData(imageData, 0, 0);

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    if (!outputCtx) {
        logger.warn({
            operation: 'cv.resize_image_data',
            error: { name: 'CanvasError', message: 'Failed to get output canvas 2D context' },
        });
        return null;
    }
    outputCtx.drawImage(canvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    return outputCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Find the closest pre-generated template size
 */
function findClosestTemplateSize(targetSize: number): number {
    let closest = COMMON_ICON_SIZES[0];
    let minDiff = Math.abs(targetSize - closest);

    for (const size of COMMON_ICON_SIZES) {
        const diff = Math.abs(targetSize - size);
        if (diff < minDiff) {
            minDiff = diff;
            closest = size;
        }
    }

    return closest;
}

/**
 * Match a screenshot cell against an item template
 * Returns similarity score (0-1, higher is better)
 * Returns 0 if template resizing fails
 * Uses pre-generated multi-scale templates when available, falls back to cache
 */
function matchTemplate(
    screenshotCtx: CanvasRenderingContext2D,
    cell: ROI,
    template: TemplateData,
    itemId?: string
): number {
    // Extract icon region from screenshot (exclude count area)
    const iconRegion = extractIconRegion(screenshotCtx, cell);

    // Try to use pre-generated multi-scale template first (much faster)
    let resizedTemplate: ImageData | undefined;
    if (itemId && hasMultiScaleTemplates(itemId)) {
        // Find closest pre-generated size
        const targetSize = Math.max(iconRegion.width, iconRegion.height);
        const closestSize = findClosestTemplateSize(targetSize);
        resizedTemplate = getMultiScaleTemplate(itemId, closestSize);

        // If sizes don't match exactly, we need to resize
        if (resizedTemplate && (closestSize !== iconRegion.width || closestSize !== iconRegion.height)) {
            const resized = resizeImageData(resizedTemplate, iconRegion.width, iconRegion.height);
            if (resized) {
                resizedTemplate = resized;
            }
        }
    }

    // Fall back to cache-based approach
    if (!resizedTemplate && itemId) {
        resizedTemplate = getResizedTemplate(itemId, iconRegion.width, iconRegion.height);
    }

    // Resize from original template if not found
    if (!resizedTemplate) {
        const templateImageData = template.ctx.getImageData(0, 0, template.width, template.height);
        // Convert null to undefined for type consistency
        resizedTemplate = resizeImageData(templateImageData, iconRegion.width, iconRegion.height) ?? undefined;

        // Handle resize failure gracefully
        if (!resizedTemplate) {
            return 0;
        }

        // Cache the resized template for reuse
        if (itemId) {
            setResizedTemplate(itemId, iconRegion.width, iconRegion.height, resizedTemplate);
        }
    }

    // Calculate similarity
    return calculateSimilarity(iconRegion, resizedTemplate);
}

/**
 * Match using multiple templates (primary + training data)
 * Returns aggregated similarity score with voting bonus
 */
function matchTemplateMulti(
    screenshotCtx: CanvasRenderingContext2D,
    cell: ROI,
    template: TemplateData,
    itemId: string,
    trainingTemplates: TrainingTemplate[]
): number {
    // Get primary template score
    const primaryScore = matchTemplate(screenshotCtx, cell, template, itemId);

    // If no training templates, return primary score
    if (!trainingTemplates || trainingTemplates.length === 0) {
        return primaryScore;
    }

    // Extract icon region for matching against training templates
    const iconRegion = extractIconRegion(screenshotCtx, cell);

    // Match against training templates - store raw scores and weights separately
    const trainingResults: Array<{ rawScore: number; weight: number }> = [];
    for (const trainingTpl of trainingTemplates) {
        // Resize training template to match icon region size
        const resizedTraining = resizeImageData(trainingTpl.imageData, iconRegion.width, iconRegion.height);
        if (!resizedTraining) continue;

        const rawScore = calculateSimilarity(iconRegion, resizedTraining);
        trainingResults.push({ rawScore, weight: trainingTpl.weight });
    }

    if (trainingResults.length === 0) {
        return primaryScore;
    }

    // Aggregation strategy:
    // 1. Compare all RAW scores to find best match
    // 2. Apply weight to the winning score
    // 3. Add voting bonus for multiple high-confidence matches
    const primaryWeight = 1.5;

    // Collect all raw scores for comparison (fair comparison without weights)
    const allRawScores = [primaryScore, ...trainingResults.map(t => t.rawScore)];
    const maxRawScore = Math.max(...allRawScores);

    // Determine which template won and apply its weight
    let finalBaseScore: number;
    if (primaryScore === maxRawScore) {
        // Primary template won - apply primary weight bonus
        finalBaseScore = primaryScore * Math.min(1.0, primaryWeight * 0.7); // Scaled bonus, max 1.0
    } else {
        // A training template won - find which one and apply its weight
        const winningTraining = trainingResults.find(t => t.rawScore === maxRawScore);
        const weight = winningTraining?.weight || 1.0;
        finalBaseScore = maxRawScore * Math.min(1.0, weight * 0.85); // Scaled bonus, max 1.0
    }

    // Voting bonus: count how many templates exceed threshold (using raw scores)
    const threshold = 0.5;
    const votesAboveThreshold = allRawScores.filter(s => s > threshold).length;
    const votingBonus = Math.min(0.08, votesAboveThreshold * 0.015); // Up to 8% bonus

    // Final score with voting bonus, capped at 0.99
    const finalScore = Math.min(0.99, finalBaseScore + votingBonus);

    return finalScore;
}

/**
 * Extract count region from cell (bottom-right corner)
 */
export function extractCountRegion(cell: ROI): ROI {
    const countSize = Math.min(25, Math.floor(cell.width * 0.25));

    return {
        x: cell.x + cell.width - countSize,
        y: cell.y + cell.height - countSize,
        width: countSize,
        height: countSize,
        label: `${cell.label || 'cell'}_count`,
    };
}

// ========================================
// Confidence Boosting
// ========================================

/**
 * Boost confidence based on game context (rarity, synergies)
 * Helps with ambiguous detections
 */
function boostConfidenceWithContext(detections: CVDetectionResult[]): CVDetectionResult[] {
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
function validateWithBorderRarity(
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

// ========================================
// Geometric Grid Verification
// ========================================

/**
 * Result of grid verification
 */
interface GridVerificationResult {
    isValid: boolean;
    confidence: number;
    filteredDetections: CVDetectionResult[];
    gridParams: {
        xSpacing: number;
        ySpacing: number;
        tolerance: number;
    } | null;
}

/**
 * Find the mode (most common value) in an array with tolerance
 */
function findMode(values: number[], tolerance: number): { mode: number; count: number } {
    if (values.length === 0) {
        return { mode: 0, count: 0 };
    }

    const buckets = new Map<number, number>();
    for (const value of values) {
        const bucket = Math.round(value / tolerance) * tolerance;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    let mode = 0;
    let maxCount = 0;
    for (const [bucket, count] of buckets) {
        if (count > maxCount) {
            maxCount = count;
            mode = bucket;
        }
    }

    return { mode, count: maxCount };
}

/**
 * Check if a value fits within a grid with given spacing
 */
function fitsGrid(value: number, gridStart: number, spacing: number, tolerance: number): boolean {
    if (spacing <= 0) return true;
    const offset = (value - gridStart) % spacing;
    return offset <= tolerance || offset >= spacing - tolerance;
}

/**
 * Verify that detections form a consistent grid pattern
 * Filters out outliers that don't fit the grid
 */
export function verifyGridPattern(detections: CVDetectionResult[], expectedIconSize: number): GridVerificationResult {
    // Need at least 3 detections to verify a pattern
    if (detections.length < 3) {
        return {
            isValid: true, // Trust small sets
            confidence: 0.5,
            filteredDetections: detections,
            gridParams: null,
        };
    }

    // Extract positions
    const positions = detections
        .filter(d => d.position)
        .map(d => ({
            x: d.position!.x,
            y: d.position!.y,
            detection: d,
        }));

    if (positions.length < 3) {
        return {
            isValid: true,
            confidence: 0.5,
            filteredDetections: detections,
            gridParams: null,
        };
    }

    // Calculate X spacings between adjacent items (sorted by X)
    const sortedByX = [...positions].sort((a, b) => a.x - b.x);
    const xSpacings: number[] = [];
    for (let i = 1; i < sortedByX.length; i++) {
        const gap = sortedByX[i].x - sortedByX[i - 1].x;
        if (gap > expectedIconSize * 0.5 && gap < expectedIconSize * 2.5) {
            xSpacings.push(gap);
        }
    }

    // Calculate Y spacings (for multi-row inventories)
    const sortedByY = [...positions].sort((a, b) => a.y - b.y);
    const ySpacings: number[] = [];
    for (let i = 1; i < sortedByY.length; i++) {
        const gap = sortedByY[i].y - sortedByY[i - 1].y;
        if (gap > expectedIconSize * 0.5 && gap < expectedIconSize * 2.5) {
            ySpacings.push(gap);
        }
    }

    // Find mode spacing (most common gap)
    const tolerance = Math.max(6, expectedIconSize * 0.15);
    const xMode = findMode(xSpacings, tolerance);
    const yMode = ySpacings.length > 0 ? findMode(ySpacings, tolerance) : { mode: expectedIconSize, count: 0 };

    // Use expected icon size as fallback
    const xSpacing = xMode.count >= 2 ? xMode.mode : expectedIconSize;
    const ySpacing = yMode.count >= 2 ? yMode.mode : expectedIconSize;

    // Find grid origin (leftmost, topmost detection)
    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));

    // Filter detections that fit the grid
    const filtered = positions.filter(p => {
        const fitsX = fitsGrid(p.x, minX, xSpacing, tolerance);
        const fitsY = fitsGrid(p.y, minY, ySpacing, tolerance);
        return fitsX && fitsY;
    });

    // Calculate confidence based on how many detections fit
    const fitRatio = filtered.length / positions.length;
    const isValid = fitRatio >= 0.7 || filtered.length >= positions.length - 1;

    logger.info({
        operation: 'cv.grid_verification',
        data: {
            totalDetections: positions.length,
            filteredDetections: filtered.length,
            xSpacing,
            ySpacing,
            fitRatio,
            isValid,
        },
    });

    return {
        isValid,
        confidence: fitRatio,
        filteredDetections: filtered.map(p => p.detection),
        gridParams: {
            xSpacing,
            ySpacing,
            tolerance,
        },
    };
}

// ========================================
// Sliding Window Detection
// ========================================

/**
 * Sliding window detection to find icons anywhere on screen
 * Returns detected icons with their positions
 * Supports multi-scale matching for better accuracy across resolutions
 */
async function detectIconsWithSlidingWindow(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    options: {
        stepSize?: number;
        minConfidence?: number;
        regionOfInterest?: ROI;
        progressCallback?: (progress: number, status: string) => void;
        multiScale?: boolean; // Enable multi-scale matching
    } = {}
): Promise<CVDetectionResult[]> {
    // Confidence threshold raised to 0.65 after fixing windowed SSIM
    // Higher threshold reduces false positives while maintaining good recall
    const { stepSize = 12, minConfidence = 0.65, regionOfInterest, progressCallback, multiScale = true } = options;

    const detections: CVDetectionResult[] = [];
    const iconSizes = getAdaptiveIconSizes(width, height);
    // Use all scales if multiScale is enabled, otherwise just the primary
    const sizesToUse = multiScale ? iconSizes : [iconSizes[1] || 48];
    const primarySize = iconSizes[1] || 48; // Primary size for window extraction
    const itemTemplates = getItemTemplates();
    const templatesByColor = getTemplatesByColor();

    // Define scan region (full image or ROI)
    const scanX = regionOfInterest?.x ?? 0;
    const scanY = regionOfInterest?.y ?? 0;
    const scanWidth = regionOfInterest?.width ?? width;
    const scanHeight = regionOfInterest?.height ?? height;

    // Calculate total steps for progress tracking
    const totalStepsX = Math.ceil((scanWidth - primarySize) / stepSize);
    const totalStepsY = Math.ceil((scanHeight - primarySize) / stepSize);
    const totalSteps = totalStepsX * totalStepsY;
    let currentStep = 0;

    logger.info({
        operation: 'cv.sliding_window_start',
        data: {
            scanRegion: { x: scanX, y: scanY, w: scanWidth, h: scanHeight },
            iconSizes: sizesToUse,
            multiScale,
            stepSize,
            totalSteps,
            templatesLoaded: itemTemplates.size,
            trainingDataLoaded: isTrainingDataLoaded(),
        },
    });

    // Scan across the region
    for (let y = scanY; y <= scanY + scanHeight - primarySize; y += stepSize) {
        for (let x = scanX; x <= scanX + scanWidth - primarySize; x += stepSize) {
            currentStep++;

            // Update progress periodically
            if (progressCallback && currentStep % 100 === 0) {
                const progress = Math.floor((currentStep / totalSteps) * 60) + 20;
                progressCallback(progress, `Scanning ${currentStep}/${totalSteps}...`);
            }

            // Extract window data for pre-filtering
            const windowData = ctx.getImageData(x, y, primarySize, primarySize);

            // Skip empty/uniform regions
            if (isEmptyCell(windowData)) {
                continue;
            }

            // Check variance - skip low-detail areas
            const variance = calculateColorVariance(windowData);
            if (variance < 800) {
                continue;
            }

            // Color-based pre-filtering
            const windowColor = getDominantColor(windowData);
            const colorCandidates = templatesByColor.get(windowColor) || [];
            const mixedCandidates = templatesByColor.get('mixed') || [];
            const candidateItems = [...colorCandidates, ...mixedCandidates];
            const itemsToCheck = candidateItems.length > 0 ? candidateItems : items.slice(0, 30);

            // Match against candidate templates at multiple scales
            // Use multi-template matching if training data is available
            const useMultiTemplate = isTrainingDataLoaded();
            let bestMatch: { item: Item; similarity: number; scale: number } | null = null;

            for (const item of itemsToCheck) {
                const template = itemTemplates.get(item.id);
                if (!template) continue;

                // Get training templates for this item (if available)
                const trainingTemplates = useMultiTemplate ? getTrainingTemplatesForItem(item.id) : [];

                // Try each scale and find the best match
                for (const scaleSize of sizesToUse) {
                    // Create ROI at this scale
                    const scaleROI: ROI = {
                        x,
                        y,
                        width: scaleSize,
                        height: scaleSize,
                    };

                    // Use multi-template matching if we have training data
                    const similarity =
                        trainingTemplates.length > 0
                            ? matchTemplateMulti(ctx, scaleROI, template, item.id, trainingTemplates)
                            : matchTemplate(ctx, scaleROI, template, item.id);

                    // Apply scale-aware confidence adjustment
                    // Smaller icons naturally have lower similarity due to pixelation
                    const scaleAdjustment = scaleSize < 40 ? -0.02 : scaleSize > 60 ? 0.01 : 0;
                    const adjustedThreshold = minConfidence + scaleAdjustment;

                    if (similarity > adjustedThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
                        bestMatch = { item, similarity, scale: scaleSize };
                    }
                }
            }

            if (bestMatch) {
                detections.push({
                    type: 'item',
                    entity: bestMatch.item,
                    confidence: bestMatch.similarity,
                    position: { x, y, width: bestMatch.scale, height: bestMatch.scale },
                    method: 'template_match',
                });
            }
        }
    }

    logger.info({
        operation: 'cv.sliding_window_complete',
        data: {
            rawDetections: detections.length,
            scannedPositions: currentStep,
        },
    });

    // Apply Non-Maximum Suppression to remove overlapping detections
    const nmsDetections = nonMaxSuppression(detections, 0.3);

    logger.info({
        operation: 'cv.nms_complete',
        data: {
            beforeNMS: detections.length,
            afterNMS: nmsDetections.length,
        },
    });

    return nmsDetections;
}

/**
 * Detect equipment (weapons/tomes) in top-left area of screen
 * These appear in a different location than inventory items
 */
async function detectEquipmentRegion(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    // Equipment is typically in top-left 25% of screen
    const equipmentROI: ROI = {
        x: 0,
        y: 0,
        width: Math.floor(width * 0.25),
        height: Math.floor(height * 0.4),
        label: 'equipment_region',
    };

    if (progressCallback) {
        progressCallback(85, 'Scanning equipment region...');
    }

    logger.info({
        operation: 'cv.equipment_region_scan',
        data: {
            region: equipmentROI,
        },
    });

    // Use sliding window on equipment region with smaller step for precision
    const equipmentDetections = await detectIconsWithSlidingWindow(ctx, width, height, items, {
        stepSize: 8,
        minConfidence: 0.65, // Raised threshold after SSIM fix
        regionOfInterest: equipmentROI,
    });

    return equipmentDetections;
}

// ========================================
// Worker-based Detection
// ========================================

/**
 * Detect items using Web Workers for parallel processing (optional)
 * Offloads template matching to workers to avoid blocking UI
 */
async function detectItemsWithWorkers(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    items: Item[],
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    const itemTemplates = getItemTemplates();
    // Create worker pool (4 workers for parallel processing)
    const workerCount = 4;
    const workers: Worker[] = [];

    try {
        // Initialize workers
        for (let i = 0; i < workerCount; i++) {
            workers.push(new Worker(getWorkerPath('template-matcher-worker.js')));
        }

        // Prepare template data for workers (serialize ImageData)
        const templateData = items
            .map(item => {
                const template = itemTemplates.get(item.id);
                if (!template) return null;

                const imageData = template.ctx.getImageData(0, 0, template.width, template.height);

                return {
                    itemId: item.id,
                    itemName: item.name,
                    imageData: {
                        width: imageData.width,
                        height: imageData.height,
                        data: Array.from(imageData.data), // Convert Uint8ClampedArray to regular array
                    },
                };
            })
            .filter(t => t !== null);

        // Split cells into batches for workers
        const batchSize = Math.ceil(gridPositions.length / workerCount);
        const batches: ROI[][] = [];

        for (let i = 0; i < gridPositions.length; i += batchSize) {
            batches.push(gridPositions.slice(i, i + batchSize));
        }

        // Send batches to workers and collect results
        const batchPromises = batches.map((batch, batchIndex) => {
            return new Promise<any[]>(resolve => {
                const worker = workers[batchIndex % workerCount];

                // Prepare cell data
                const cells = batch.map((cell, index) => {
                    const iconRegion = extractIconRegion(ctx, cell);

                    return {
                        index,
                        position: cell,
                        imageData: {
                            width: iconRegion.width,
                            height: iconRegion.height,
                            data: Array.from(iconRegion.data),
                        },
                    };
                });

                // Listen for response
                const handler = (e: MessageEvent) => {
                    if (e.data.type === 'BATCH_COMPLETE' && e.data.data.batchId === batchIndex) {
                        worker?.removeEventListener('message', handler);
                        resolve(e.data.data.results);
                    }
                };

                worker?.addEventListener('message', handler);

                // Send batch to worker
                worker?.postMessage({
                    type: 'MATCH_BATCH',
                    data: {
                        batchId: batchIndex,
                        cells,
                        templates: templateData,
                    },
                });
            });
        });

        // Wait for all batches to complete
        if (progressCallback) {
            progressCallback(60, 'Processing with workers...');
        }

        const allResults = await Promise.all(batchPromises);

        // Flatten results
        const flatResults = allResults.flat();

        // Convert to CVDetectionResult format
        const detections: CVDetectionResult[] = flatResults
            .map(result => {
                const item = items.find(i => i.id === result.itemId);
                if (!item) return null;

                return {
                    type: 'item' as const,
                    entity: item,
                    confidence: result.similarity,
                    position: result.position,
                    method: 'template_match' as const,
                };
            })
            .filter(d => d !== null) as CVDetectionResult[];

        return detections;
    } finally {
        // Terminate all workers
        workers.forEach(w => w.terminate());
    }
}

// ========================================
// Main Detection Function
// ========================================

/**
 * Detect items using template matching against stored item icons
 * Uses smart sliding window detection to find icons anywhere on screen
 */
export async function detectItemsWithCV(
    imageDataUrl: string,
    progressCallback?: (progress: number, status: string) => void,
    useWorkers: boolean = false
): Promise<CVDetectionResult[]> {
    try {
        // Check cache first
        const imageHash = hashImageDataUrl(imageDataUrl);
        const cachedResults = getCachedResults(imageHash);

        if (cachedResults) {
            logger.info({
                operation: 'cv.cache_hit',
                data: { imageHash, resultCount: cachedResults.length },
            });

            if (progressCallback) {
                progressCallback(100, 'Loaded from cache (instant)');
            }

            return cachedResults;
        }

        if (progressCallback) {
            progressCallback(0, 'Loading image...');
        }

        // Ensure templates are loaded (at least priority ones)
        if (!isPriorityTemplatesLoaded()) {
            if (progressCallback) {
                progressCallback(5, 'Loading item templates...');
            }
            await loadItemTemplates();
        }

        const { ctx, width, height } = await loadImageToCanvas(imageDataUrl);

        if (progressCallback) {
            progressCallback(15, 'Analyzing image structure...');
        }

        const items = getAllData().items?.items || [];
        const itemTemplates = getItemTemplates();

        // Log detection start with details
        logger.info({
            operation: 'cv.detect_start',
            data: {
                imageWidth: width,
                imageHeight: height,
                templatesLoaded: itemTemplates.size,
                mode: 'sliding_window',
            },
        });

        // Use workers for parallel processing if enabled (legacy path)
        if (useWorkers) {
            const gridPositions = detectGridPositions(width, height);
            logger.info({
                operation: 'cv.detect_items_workers',
                data: { gridPositions: gridPositions.length, workers: 4 },
            });

            const workerResults = await detectItemsWithWorkers(ctx, gridPositions, items, progressCallback);

            if (progressCallback) {
                progressCallback(100, 'Worker processing complete');
            }

            logger.info({
                operation: 'cv.detect_items_workers_complete',
                data: {
                    detectionsCount: workerResults.length,
                    gridPositions: gridPositions.length,
                },
            });

            // Cache worker results
            cacheResults(imageHash, workerResults);

            return workerResults;
        }

        // NEW: Two-phase detection strategy
        // Phase 1: Try fast grid-based detection first
        // Phase 2: Fall back to sliding window if grid detection fails
        if (progressCallback) {
            progressCallback(18, 'Attempting two-phase grid detection...');
        }

        const twoPhaseResult = await detectIconsWithTwoPhase(ctx, width, height, items, {
            minConfidence: 0.65,
            progressCallback,
        });

        let hotbarDetections: CVDetectionResult[];

        if (twoPhaseResult.gridUsed && twoPhaseResult.detections.length > 0) {
            // Two-phase detection succeeded
            hotbarDetections = twoPhaseResult.detections;
            logger.info({
                operation: 'cv.two_phase_success',
                data: {
                    detections: hotbarDetections.length,
                    gridColumns: twoPhaseResult.grid?.columns || 0,
                    gridRows: twoPhaseResult.grid?.rows || 0,
                },
            });
        } else {
            // Fall back to sliding window
            logger.info({
                operation: 'cv.two_phase_fallback',
                data: {
                    reason: !twoPhaseResult.gridUsed ? 'grid_detection_failed' : 'no_detections',
                },
            });

            if (progressCallback) {
                progressCallback(25, 'Falling back to sliding window...');
            }

            const detectedHotbar = detectHotbarRegion(ctx, width, height);

            // Use detected hotbar region, with fallback
            const hotbarROI: ROI = {
                x: 0,
                y: detectedHotbar.confidence > 0.3 ? detectedHotbar.topY : Math.floor(height * 0.8),
                width: width,
                height:
                    detectedHotbar.confidence > 0.3
                        ? detectedHotbar.bottomY - detectedHotbar.topY
                        : Math.floor(height * 0.2),
                label: 'hotbar_region',
            };

            logger.info({
                operation: 'cv.hotbar_detection',
                data: {
                    detected: detectedHotbar,
                    usingROI: hotbarROI,
                },
            });

            hotbarDetections = await detectIconsWithSlidingWindow(ctx, width, height, items, {
                stepSize: 10,
                minConfidence: 0.65,
                regionOfInterest: hotbarROI,
                progressCallback,
            });
        }

        // Scan equipment region (top-left for weapons/tomes)
        const equipmentDetections = await detectEquipmentRegion(ctx, width, height, items, progressCallback);

        // Combine all detections
        const allDetections = [...hotbarDetections, ...equipmentDetections];

        if (progressCallback) {
            progressCallback(88, 'Verifying grid pattern...');
        }

        // Apply geometric grid verification to filter outliers
        const iconSizes = getAdaptiveIconSizes(width, height);
        const expectedIconSize = iconSizes[1] || 48;
        const gridVerification = verifyGridPattern(allDetections, expectedIconSize);
        let verifiedDetections = gridVerification.isValid ? gridVerification.filteredDetections : allDetections;

        if (progressCallback) {
            progressCallback(92, 'Applying context boosting...');
        }

        // Apply confidence boosting with game context
        let boostedDetections = boostConfidenceWithContext(verifiedDetections);

        if (progressCallback) {
            progressCallback(96, 'Validating with border rarity...');
        }

        // Validate detections with border rarity check (stronger validation)
        // Filter out null results (rejected by strict rarity validation)
        boostedDetections = boostedDetections
            .map(detection => validateWithBorderRarity(detection, ctx, false))
            .filter((d): d is CVDetectionResult => d !== null);

        if (progressCallback) {
            progressCallback(100, 'Smart detection complete');
        }

        // Log detailed results
        const logData: Record<string, unknown> = {
            detectionsCount: boostedDetections.length,
            hotbarDetections: hotbarDetections.length,
            equipmentDetections: equipmentDetections.length,
            mode: twoPhaseResult.gridUsed ? 'two_phase_grid' : 'sliding_window',
            gridUsed: twoPhaseResult.gridUsed,
        };

        // If nothing detected, add debug hints
        if (boostedDetections.length === 0) {
            logData.debugHint = 'No icons detected - ensure screenshot shows game UI with item icons';
            logData.suggestion = 'Try taking screenshot during gameplay with hotbar visible';
        } else {
            logData.detectedItems = boostedDetections.slice(0, 5).map(d => d.entity.name);
        }

        logger.info({
            operation: 'cv.detect_items_smart',
            data: logData,
        });

        // Cache results for future use
        cacheResults(imageHash, boostedDetections);

        return boostedDetections;
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

// ========================================
// Item Count Detection
// ========================================

/**
 * Extract count numbers from item cells using OCR
 * Returns a map of cell labels to counts
 */
export async function detectItemCounts(imageDataUrl: string, cells: ROI[]): Promise<Map<string, number>> {
    const Tesseract = await import('tesseract.js');
    const counts = new Map<string, number>();

    // Load screenshot
    const { canvas: srcCanvas } = await loadImageToCanvas(imageDataUrl);

    for (const cell of cells) {
        try {
            // Extract count region (bottom-right corner)
            const countROI = extractCountRegion(cell);

            // Create canvas for just the count region
            const countCanvas = document.createElement('canvas');
            countCanvas.width = countROI.width;
            countCanvas.height = countROI.height;
            const countCtx = countCanvas.getContext('2d', { willReadFrequently: true })!;

            countCtx.drawImage(
                srcCanvas,
                countROI.x,
                countROI.y,
                countROI.width,
                countROI.height,
                0,
                0,
                countROI.width,
                countROI.height
            );

            // OCR just this tiny region
            // PSM 8 = SINGLE_WORD mode (optimized for single word recognition)
            // Using numeric value directly since Tesseract.PSM may not be accessible via dynamic import
            const result = await Tesseract.recognize(countCanvas.toDataURL(), 'eng', {
                tessedit_pageseg_mode: 8, // PSM.SINGLE_WORD
                tessedit_char_whitelist: '0123456789x×', // Only allow digits and count prefixes
            } as any);

            const text = result.data.text.trim();

            // Parse count (look for patterns like "x5", "5", "×3")
            const countMatch = text.match(/[x×]?(\d+)/);
            if (countMatch && countMatch[1]) {
                const count = parseInt(countMatch[1], 10);
                if (!isNaN(count) && count > 1 && count <= 20) {
                    counts.set(cell.label || '', count);
                }
            }
        } catch (error) {
            // Silently fail for individual cells, default to 1
            logger.error({
                operation: 'cv.detect_count',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
            });
        }
    }

    return counts;
}
