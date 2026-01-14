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

// Template cache for item images
interface TemplateData {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}

const itemTemplates = new Map<string, TemplateData>();
const templatesByColor = new Map<string, Item[]>();
let templatesLoaded = false;
let priorityTemplatesLoaded = false;

// Detection result cache (key = image hash, value = results)
const detectionCache = new Map<string, { results: CVDetectionResult[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

/**
 * Initialize computer vision module
 */
export function initCV(gameData: AllGameData): void {
    // Bug fix #4: Handle null/undefined gameData
    allData = gameData || {};

    logger.info({
        operation: 'cv.init',
        data: {
            itemsCount: gameData?.items?.items?.length || 0,
        },
    });
}

/**
 * Check if all templates are fully loaded (not just priority)
 * Use this to prevent detection with incomplete template set
 */
export function isFullyLoaded(): boolean {
    return templatesLoaded;
}

/**
 * Check if priority templates are loaded (enough for basic detection)
 */
export function isPriorityLoaded(): boolean {
    return priorityTemplatesLoaded;
}

/**
 * Categorize items by priority (common items first)
 */
function prioritizeItems(items: Item[]): { priority: Item[]; standard: Item[] } {
    const priority: Item[] = [];
    const standard: Item[] = [];

    // High-priority items (common, frequently seen)
    const priorityRarities = ['common', 'uncommon'];

    items.forEach(item => {
        if (priorityRarities.includes(item.rarity)) {
            priority.push(item);
        } else {
            standard.push(item);
        }
    });

    return { priority, standard };
}

/**
 * Load item templates progressively (priority items first)
 */
async function loadTemplatesBatch(items: Item[]): Promise<number> {
    let loaded = 0;

    const loadPromises = items.map(async item => {
        try {
            // Try WebP first (smaller), fallback to PNG
            const imagePath = item.image.replace('.png', '.webp');
            const img = new Image();

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0);

                    itemTemplates.set(item.id, {
                        image: img,
                        canvas,
                        ctx,
                        width: img.width,
                        height: img.height,
                    });

                    loaded++;
                    resolve();
                };

                img.onerror = () => {
                    // Try PNG fallback
                    const pngImg = new Image();
                    pngImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = pngImg.width;
                        canvas.height = pngImg.height;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });

                        if (!ctx) {
                            reject(new Error('Failed to get canvas context'));
                            return;
                        }

                        ctx.drawImage(pngImg, 0, 0);

                        itemTemplates.set(item.id, {
                            image: pngImg,
                            canvas,
                            ctx,
                            width: pngImg.width,
                            height: pngImg.height,
                        });

                        loaded++;
                        resolve();
                    };
                    pngImg.onerror = () => reject(new Error(`Failed to load: ${item.image}`));
                    pngImg.src = item.image;
                };

                img.src = imagePath;
            });
        } catch (error) {
            logger.error({
                operation: 'cv.load_template',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                    itemId: item.id,
                },
            });
        }
    });

    await Promise.all(loadPromises);

    return loaded;
}

/**
 * Group loaded templates by dominant color
 */
function groupTemplatesByColor(items: Item[]): void {
    items.forEach(item => {
        const template = itemTemplates.get(item.id);
        if (!template) return;

        const imageData = template.ctx.getImageData(0, 0, template.width, template.height);
        const colorCategory = getDominantColor(imageData);

        if (!templatesByColor.has(colorCategory)) {
            templatesByColor.set(colorCategory, []);
        }
        templatesByColor.get(colorCategory)!.push(item);
    });
}

/**
 * Load all item template images into memory (with progressive loading)
 */
export async function loadItemTemplates(): Promise<void> {
    if (templatesLoaded) return;

    const items = allData.items?.items || [];

    logger.info({
        operation: 'cv.load_templates',
        data: { phase: 'start', totalItems: items.length },
    });

    // Prioritize items (common/uncommon first)
    const { priority, standard } = prioritizeItems(items);

    // Load priority items first
    const priorityLoaded = await loadTemplatesBatch(priority);
    groupTemplatesByColor(priority);
    priorityTemplatesLoaded = true;

    logger.info({
        operation: 'cv.load_templates',
        data: {
            phase: 'priority_complete',
            priorityLoaded,
            priorityTotal: priority.length,
        },
    });

    // Load remaining items in background (non-blocking)
    setTimeout(async () => {
        try {
            const standardLoaded = await loadTemplatesBatch(standard);
            groupTemplatesByColor(standard);
            templatesLoaded = true;

            logger.info({
                operation: 'cv.load_templates',
                data: {
                    phase: 'complete',
                    priorityLoaded,
                    standardLoaded,
                    total: items.length,
                    colorGroups: Object.fromEntries(
                        Array.from(templatesByColor.entries()).map(([color, items]) => [color, items.length])
                    ),
                },
            });
        } catch (error) {
            logger.error({
                operation: 'cv.load_templates',
                data: {
                    phase: 'error',
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            // Still mark as loaded to prevent infinite retries
            templatesLoaded = true;
        }
    }, 100); // Small delay to allow UI to update
}

/**
 * Generate simple hash from image data URL
 * Used for caching detection results
 */
function hashImageDataUrl(dataUrl: string): string {
    // Simple hash based on data URL length and sample characters
    const len = dataUrl.length;
    let hash = 0;

    // Sample characters at regular intervals
    const sampleCount = Math.min(100, len);
    const step = Math.floor(len / sampleCount);

    for (let i = 0; i < len; i += step) {
        const char = dataUrl.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return `img_${hash}_${len}`;
}

/**
 * Get cached detection results if available
 */
function getCachedResults(imageHash: string): CVDetectionResult[] | null {
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
    detectionCache.set(imageHash, {
        results,
        timestamp: Date.now(),
    });

    // Cleanup old cache entries (keep last 50)
    if (detectionCache.size > 50) {
        const entries = Array.from(detectionCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 10 entries
        for (let i = 0; i < 10; i++) {
            detectionCache.delete(entries[i][0]);
        }
    }
}

/**
 * Clear detection cache
 */
export function clearDetectionCache(): void {
    detectionCache.clear();
    logger.info({
        operation: 'cv.cache_cleared',
        data: { cleared: true },
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
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
 * Detect the inventory bar region (typically at bottom of screen)
 */
function detectInventoryRegion(ctx: CanvasRenderingContext2D, width: number, height: number): ROI {
    // Inventory is typically in bottom 15-20% of screen
    const inventoryHeight = Math.floor(height * 0.15);
    const inventoryY = height - inventoryHeight;

    return {
        x: 0,
        y: inventoryY,
        width: width,
        height: inventoryHeight,
        label: 'inventory',
    };
}

/**
 * Calculate Intersection over Union (IoU) between two boxes
 * Used for Non-Maximum Suppression
 */
function calculateIoU(box1: ROI, box2: ROI): number {
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
function nonMaxSuppression(detections: CVDetectionResult[], iouThreshold: number = 0.3): CVDetectionResult[] {
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

/**
 * Get adaptive icon sizes based on image dimensions
 * Returns array of sizes to try for multi-scale detection
 */
function getAdaptiveIconSizes(width: number, height: number): number[] {
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
 * Sliding window detection to find icons anywhere on screen
 * Returns detected icons with their positions
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
    } = {}
): Promise<CVDetectionResult[]> {
    const { stepSize = 12, minConfidence = 0.72, regionOfInterest, progressCallback } = options;

    const detections: CVDetectionResult[] = [];
    const iconSizes = getAdaptiveIconSizes(width, height);
    const primarySize = iconSizes[1] || 48; // Use middle size as primary

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
            iconSize: primarySize,
            stepSize,
            totalSteps,
            templatesLoaded: itemTemplates.size,
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

            // Extract window region
            const windowROI: ROI = {
                x,
                y,
                width: primarySize,
                height: primarySize,
            };

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

            // Match against candidate templates
            let bestMatch: { item: Item; similarity: number } | null = null;

            for (const item of itemsToCheck) {
                const template = itemTemplates.get(item.id);
                if (!template) continue;

                const similarity = matchTemplate(ctx, windowROI, template);

                if (similarity > minConfidence && (!bestMatch || similarity > bestMatch.similarity)) {
                    bestMatch = { item, similarity };
                }
            }

            if (bestMatch) {
                detections.push({
                    type: 'item',
                    entity: bestMatch.item,
                    confidence: bestMatch.similarity,
                    position: { ...windowROI },
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
        minConfidence: 0.7,
        regionOfInterest: equipmentROI,
    });

    return equipmentDetections;
}

/**
 * Detect grid structure in image (for item grids)
 * Returns potential grid positions with dynamic detection
 * @deprecated Use detectIconsWithSlidingWindow for better accuracy
 */
export function detectGridPositions(width: number, height: number, gridSize: number = 64): ROI[] {
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

/**
 * Extract icon region from cell, excluding count number area
 * Count numbers are typically in bottom-right corner (last 25-30% of cell)
 */
function extractIconRegion(ctx: CanvasRenderingContext2D, cell: ROI): ImageData {
    // Extract 80% of cell to avoid count number area in bottom-right
    const iconWidth = Math.floor(cell.width * 0.8);
    const iconHeight = Math.floor(cell.height * 0.8);

    return ctx.getImageData(cell.x, cell.y, iconWidth, iconHeight);
}

/**
 * Resize ImageData to target dimensions
 */
function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(imageData, 0, 0);

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })!;
    outputCtx.drawImage(canvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    return outputCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Match a screenshot cell against an item template
 * Returns similarity score (0-1, higher is better)
 */
function matchTemplate(screenshotCtx: CanvasRenderingContext2D, cell: ROI, template: TemplateData): number {
    // Extract icon region from screenshot (exclude count area)
    const iconRegion = extractIconRegion(screenshotCtx, cell);

    // Get template image data
    const templateImageData = template.ctx.getImageData(0, 0, template.width, template.height);

    // Resize template to match icon region size
    const resizedTemplate = resizeImageData(templateImageData, iconRegion.width, iconRegion.height);

    // Calculate similarity
    return calculateSimilarity(iconRegion, resizedTemplate);
}

/**
 * Extract count number region from cell (bottom-right corner)
 */
function extractCountRegion(cell: ROI): ROI {
    const countSize = Math.min(25, Math.floor(cell.width * 0.25));

    return {
        x: cell.x + cell.width - countSize,
        y: cell.y + cell.height - countSize,
        width: countSize,
        height: countSize,
        label: `${cell.label}_count`,
    };
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
 * Check if a cell is likely empty (mostly uniform background)
 * Empty cells have low color variance
 */
function isEmptyCell(imageData: ImageData): boolean {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumSquareR = 0;
    let sumSquareG = 0;
    let sumSquareB = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        sumR += r;
        sumG += g;
        sumB += b;
        sumSquareR += r * r;
        sumSquareG += g * g;
        sumSquareB += b * b;
        count++;
    }

    // Calculate variance for each channel
    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    const varianceR = sumSquareR / count - meanR * meanR;
    const varianceG = sumSquareG / count - meanG * meanG;
    const varianceB = sumSquareB / count - meanB * meanB;

    const totalVariance = varianceR + varianceG + varianceB;

    // Low variance = uniform color = likely empty
    // Threshold: < 500 is very uniform (empty cell or solid background)
    const EMPTY_THRESHOLD = 500;

    return totalVariance < EMPTY_THRESHOLD;
}

/**
 * Calculate color variance to detect empty cells or low-detail regions
 */
function calculateColorVariance(imageData: ImageData): number {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i];
        sumG += pixels[i + 1];
        sumB += pixels[i + 2];
        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    let varianceSum = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        const diffR = pixels[i] - meanR;
        const diffG = pixels[i + 1] - meanG;
        const diffB = pixels[i + 2] - meanB;
        varianceSum += diffR * diffR + diffG * diffG + diffB * diffB;
    }

    return varianceSum / count;
}

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
    // Create worker pool (4 workers for parallel processing)
    const workerCount = 4;
    const workers: Worker[] = [];

    try {
        // Initialize workers
        for (let i = 0; i < workerCount; i++) {
            workers.push(new Worker('/workers/template-matcher-worker.js'));
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
                        worker.removeEventListener('message', handler);
                        resolve(e.data.data.results);
                    }
                };

                worker.addEventListener('message', handler);

                // Send batch to worker
                worker.postMessage({
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
        if (!priorityTemplatesLoaded) {
            if (progressCallback) {
                progressCallback(5, 'Loading item templates...');
            }
            await loadItemTemplates();
        }

        const { canvas, ctx, width, height } = await loadImageToCanvas(imageDataUrl);

        if (progressCallback) {
            progressCallback(15, 'Analyzing image structure...');
        }

        const items = allData.items?.items || [];

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

        // NEW: Smart sliding window detection
        // Scan hotbar region (bottom 20% of screen)
        const hotbarROI: ROI = {
            x: 0,
            y: Math.floor(height * 0.8),
            width: width,
            height: Math.floor(height * 0.2),
            label: 'hotbar_region',
        };

        if (progressCallback) {
            progressCallback(20, 'Scanning hotbar region...');
        }

        const hotbarDetections = await detectIconsWithSlidingWindow(ctx, width, height, items, {
            stepSize: 10,
            minConfidence: 0.72,
            regionOfInterest: hotbarROI,
            progressCallback,
        });

        // Scan equipment region (top-left for weapons/tomes)
        const equipmentDetections = await detectEquipmentRegion(ctx, width, height, items, progressCallback);

        // Combine all detections
        const allDetections = [...hotbarDetections, ...equipmentDetections];

        if (progressCallback) {
            progressCallback(92, 'Applying context boosting...');
        }

        // Apply confidence boosting with game context
        let boostedDetections = boostConfidenceWithContext(allDetections);

        if (progressCallback) {
            progressCallback(96, 'Validating with border rarity...');
        }

        // Validate detections with border rarity check
        boostedDetections = boostedDetections.map(detection => validateWithBorderRarity(detection, ctx));

        if (progressCallback) {
            progressCallback(100, 'Smart detection complete');
        }

        // Log detailed results
        const logData: Record<string, unknown> = {
            detectionsCount: boostedDetections.length,
            hotbarDetections: hotbarDetections.length,
            equipmentDetections: equipmentDetections.length,
            mode: 'sliding_window',
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

/**
 * Calculate adaptive similarity threshold based on match score distribution
 * Finds natural gap between good and bad matches
 */
function calculateAdaptiveThreshold(similarities: number[]): number {
    if (similarities.length === 0) return 0.75; // Fallback

    // Sort similarities descending
    const sorted = [...similarities].sort((a, b) => b - a);

    // Find largest gap in similarities
    let maxGap = 0;
    let gapIndex = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i] - sorted[i + 1];
        if (gap > maxGap) {
            maxGap = gap;
            gapIndex = i;
        }
    }

    // Threshold is just below the gap (or use default if gap too small)
    if (maxGap > 0.05) {
        const threshold = sorted[gapIndex + 1] + 0.02; // Slightly above low side
        // Clamp between 0.60 and 0.90
        return Math.max(0.6, Math.min(0.9, threshold));
    }

    // Fallback: use 75th percentile
    const percentile75Index = Math.floor(sorted.length * 0.25);
    const threshold = sorted[percentile75Index];
    return Math.max(0.65, Math.min(0.85, threshold));
}

/**
 * Aggregate duplicate detections into single entries with counts
 * Converts [Wrench, Wrench, Wrench] → [Wrench x3]
 */
export function aggregateDuplicates(detections: CVDetectionResult[]): Array<CVDetectionResult & { count: number }> {
    const grouped = new Map<string, Array<CVDetectionResult & { count?: number }>>();

    // Group by entity ID
    detections.forEach(detection => {
        const key = detection.entity.id;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(detection);
    });

    // Aggregate each group
    const aggregated: Array<CVDetectionResult & { count: number }> = [];

    grouped.forEach((group, entityId) => {
        // Sum up counts (default to 1 per detection)
        const totalCount = group.reduce((sum, d) => sum + (d.count || 1), 0);

        // Use highest confidence from group
        const maxConfidence = Math.max(...group.map(d => d.confidence));

        // Keep first detection's position
        const firstDetection = group[0];

        aggregated.push({
            type: firstDetection.type,
            entity: firstDetection.entity,
            confidence: maxConfidence,
            position: firstDetection.position,
            method: firstDetection.method,
            count: totalCount,
        });
    });

    // Sort by entity name for consistent ordering
    return aggregated.sort((a, b) => a.entity.name.localeCompare(b.entity.name));
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
 * Extract count numbers from item cells using OCR
 * Returns a map of cell labels to counts
 */
export async function detectItemCounts(imageDataUrl: string, cells: ROI[]): Promise<Map<string, number>> {
    const Tesseract = await import('tesseract.js');
    const counts = new Map<string, number>();

    // Load screenshot
    const { canvas, ctx } = await loadImageToCanvas(imageDataUrl);

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
                canvas,
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
            const result = await Tesseract.recognize(countCanvas.toDataURL(), 'eng', {
                tessedit_char_whitelist: 'x×0123456789', // Only numbers and x/×
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
            });

            const text = result.data.text.trim();

            // Parse count (look for patterns like "x5", "5", "×3")
            const countMatch = text.match(/[x×]?(\d+)/);
            if (countMatch) {
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
                    cell: cell.label,
                },
            });
        }
    }

    return counts;
}

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
 * Extract border pixels from an image region
 * Used for rarity detection
 */
function extractBorderPixels(imageData: ImageData, borderWidth: number = 2): Uint8ClampedArray {
    const { width, height, data } = imageData;
    const borderPixels: number[] = [];

    // Top and bottom borders
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < borderWidth; y++) {
            // Top border
            const topIndex = (y * width + x) * 4;
            borderPixels.push(data[topIndex], data[topIndex + 1], data[topIndex + 2]);

            // Bottom border
            const bottomIndex = ((height - 1 - y) * width + x) * 4;
            borderPixels.push(data[bottomIndex], data[bottomIndex + 1], data[bottomIndex + 2]);
        }
    }

    // Left and right borders
    for (let y = borderWidth; y < height - borderWidth; y++) {
        for (let x = 0; x < borderWidth; x++) {
            // Left border
            const leftIndex = (y * width + x) * 4;
            borderPixels.push(data[leftIndex], data[leftIndex + 1], data[leftIndex + 2]);

            // Right border
            const rightIndex = (y * width + (width - 1 - x)) * 4;
            borderPixels.push(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2]);
        }
    }

    return new Uint8ClampedArray(borderPixels);
}

/**
 * Detect rarity from border color
 * Returns rarity string or null if no clear match
 */
function detectBorderRarity(imageData: ImageData): string | null {
    const borderPixels = extractBorderPixels(imageData, 3);

    // Calculate average RGB
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let i = 0; i < borderPixels.length; i += 3) {
        sumR += borderPixels[i];
        sumG += borderPixels[i + 1];
        sumB += borderPixels[i + 2];
        count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    // Define rarity colors (approximate, may need tuning)
    const rarityColors: Record<string, { r: number; g: number; b: number; tolerance: number }> = {
        common: { r: 128, g: 128, b: 128, tolerance: 40 }, // Gray
        uncommon: { r: 0, g: 255, b: 0, tolerance: 60 }, // Green
        rare: { r: 0, g: 128, b: 255, tolerance: 60 }, // Blue
        epic: { r: 128, g: 0, b: 255, tolerance: 60 }, // Purple
        legendary: { r: 255, g: 165, b: 0, tolerance: 60 }, // Orange/Gold
    };

    // Find closest color match
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [rarity, color] of Object.entries(rarityColors)) {
        const distance = Math.sqrt(
            Math.pow(avgR - color.r, 2) + Math.pow(avgG - color.g, 2) + Math.pow(avgB - color.b, 2)
        );

        if (distance < color.tolerance && distance < bestDistance) {
            bestMatch = rarity;
            bestDistance = distance;
        }
    }

    return bestMatch;
}

/**
 * Validate detections using border rarity check
 * Reduces confidence if border color doesn't match expected rarity
 */
function validateWithBorderRarity(detection: CVDetectionResult, ctx: CanvasRenderingContext2D): CVDetectionResult {
    if (!detection.position) return detection;

    const entity = detection.entity as Item;
    const pos = detection.position;

    // Extract cell image data
    const cellImageData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

    // Detect border rarity
    const detectedRarity = detectBorderRarity(cellImageData);

    if (!detectedRarity) {
        // No clear border detected, keep original confidence
        return detection;
    }

    // Check if detected rarity matches item rarity
    if (detectedRarity === entity.rarity) {
        // Match! Boost confidence slightly
        return {
            ...detection,
            confidence: Math.min(0.99, detection.confidence * 1.05),
        };
    } else {
        // Mismatch - reduce confidence
        return {
            ...detection,
            confidence: detection.confidence * 0.85,
        };
    }
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
 * Get dominant color category from ImageData
 * Used for color-based pre-filtering
 */
function getDominantColor(imageData: ImageData): string {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    // Sample pixels (skip alpha, sample every 4th pixel)
    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i];
        sumG += pixels[i + 1];
        sumB += pixels[i + 2];
        count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    // Categorize into color buckets
    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;

    // Low saturation = gray/white/black
    if (diff < 30) {
        const brightness = (avgR + avgG + avgB) / 3;
        if (brightness < 60) return 'black';
        if (brightness > 200) return 'white';
        return 'gray';
    }

    // High saturation = color
    if (avgR > avgG && avgR > avgB) {
        // Red dominant
        if (avgG > avgB * 1.3) return 'orange';
        if (avgR > 180 && avgG > 140) return 'yellow';
        return 'red';
    } else if (avgG > avgR && avgG > avgB) {
        // Green dominant
        if (avgB > avgR * 1.3) return 'cyan';
        if (avgG > 180 && avgB < 100) return 'lime';
        return 'green';
    } else if (avgB > avgR && avgB > avgG) {
        // Blue dominant
        if (avgR > avgG * 1.3) return 'purple';
        if (avgB > 180 && avgG < 100) return 'blue';
        return 'blue';
    }

    // Mixed colors
    if (avgR > 150 && avgG < 100 && avgB > 150) return 'magenta';
    if (avgR > 100 && avgG > 100 && avgB < 80) return 'brown';

    return 'mixed'; // Fallback
}

/**
 * Detect if screenshot shows pause menu or gameplay by analyzing bottom hotbar region
 * Gameplay has colorful icons at bottom, pause menu has empty/dark bottom
 */
function detectScreenType(ctx: CanvasRenderingContext2D, width: number, height: number): 'pause_menu' | 'gameplay' {
    // Sample bottom 20% of screen (where hotbar is during gameplay)
    const hotbarY = Math.floor(height * 0.8);
    const hotbarHeight = height - hotbarY;
    const imageData = ctx.getImageData(0, hotbarY, width, hotbarHeight);
    const pixels = imageData.data;

    // Calculate brightness and color variance
    let totalBrightness = 0;
    let totalVariance = 0;
    let sampleCount = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < pixels.length; i += 40) {
        // 40 = 10 pixels * 4 channels (RGBA)
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        // Brightness (0-255)
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Color variance (how different are R, G, B from each other)
        const mean = brightness;
        const variance = Math.pow(r - mean, 2) + Math.pow(g - mean, 2) + Math.pow(b - mean, 2);
        totalVariance += variance;

        sampleCount++;
    }

    if (sampleCount === 0) {
        // No pixels sampled, assume pause menu (fully transparent bottom)
        return 'pause_menu';
    }

    const avgBrightness = totalBrightness / sampleCount;
    const avgVariance = totalVariance / sampleCount;

    // Thresholds:
    // - Gameplay: Bright colorful icons (brightness > 80, variance > 1000)
    // - Pause menu: Dark or uniform bottom (brightness < 60 or variance < 800)
    const isGameplay = avgBrightness > 70 && avgVariance > 900;

    logger.info({
        operation: 'cv.detect_screen_type',
        data: {
            avgBrightness: Math.round(avgBrightness),
            avgVariance: Math.round(avgVariance),
            sampleCount,
            screenType: isGameplay ? 'gameplay' : 'pause_menu',
        },
    });

    return isGameplay ? 'gameplay' : 'pause_menu';
}

/**
 * Detect UI regions (for finding inventory, stats, etc.)
 * Adapts to different UI layouts (PC vs Steam Deck)
 *
 * @param ctxOrWidth - Canvas context for screen type detection, or width if called without context
 * @param widthOrHeight - Width if ctx provided, or height if called without context
 * @param height - Height (only used when ctx is provided)
 */
export function detectUIRegions(
    ctxOrWidth: CanvasRenderingContext2D | number,
    widthOrHeight: number,
    height?: number
): { inventory?: ROI; stats?: ROI; character?: ROI; pauseMenu?: ROI; gameplay?: ROI } {
    // Handle both signatures: detectUIRegions(ctx, width, height) or detectUIRegions(width, height)
    let ctx: CanvasRenderingContext2D | null = null;
    let width: number;
    let actualHeight: number;

    if (typeof ctxOrWidth === 'number') {
        // Called as detectUIRegions(width, height)
        width = ctxOrWidth;
        actualHeight = widthOrHeight;
    } else {
        // Called as detectUIRegions(ctx, width, height)
        ctx = ctxOrWidth;
        width = widthOrHeight;
        actualHeight = height!;
    }

    const uiLayout = detectUILayout(width, actualHeight);
    const resolution = detectResolution(width, actualHeight);

    // Detect if this is pause menu or gameplay by analyzing bottom hotbar region
    // If no context provided, default to pause_menu for backwards compatibility
    const screenType = ctx ? detectScreenType(ctx, width, actualHeight) : 'pause_menu';

    logger.info({
        operation: 'cv.detect_ui_regions',
        data: {
            width,
            height: actualHeight,
            uiLayout,
            resolution: resolution.category,
            screenType,
            hasContext: ctx !== null,
        },
    });

    if (screenType === 'pause_menu') {
        return detectPauseMenuRegions(width, actualHeight, uiLayout);
    } else {
        return detectGameplayRegions(width, actualHeight, uiLayout);
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

/**
 * Render debug overlay showing scan regions and detections
 * Draws colored boxes around detections with confidence scores
 */
export async function renderDebugOverlay(
    canvas: HTMLCanvasElement,
    imageDataUrl: string,
    scanRegions: ROI[],
    detections: CVDetectionResult[],
    _emptyCells?: Set<number> // Deprecated, kept for compatibility
): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Wait for image to load properly (fixes race condition)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for debug overlay'));
        image.src = imageDataUrl;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Draw scan regions (dashed cyan boxes)
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Cyan, semi-transparent
    ctx.font = '14px monospace';

    scanRegions.forEach(region => {
        ctx.strokeRect(region.x, region.y, region.width, region.height);

        // Label the region
        if (region.label) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            const labelText = region.label.replace('_', ' ').toUpperCase();
            ctx.fillRect(region.x, region.y - 20, ctx.measureText(labelText).width + 10, 20);
            ctx.fillStyle = 'black';
            ctx.fillText(labelText, region.x + 5, region.y - 5);
        }
    });

    // Reset line dash for detections
    ctx.setLineDash([]);

    // Draw detections with confidence-based colors
    detections.forEach(detection => {
        if (!detection.position) return;

        const pos = detection.position;
        const confidence = detection.confidence;

        // Color based on confidence
        let color: string;
        if (confidence >= 0.85) {
            color = 'rgba(0, 255, 0, 0.8)'; // Green = high confidence
        } else if (confidence >= 0.7) {
            color = 'rgba(255, 165, 0, 0.8)'; // Orange = medium confidence
        } else {
            color = 'rgba(255, 0, 0, 0.8)'; // Red = low confidence
        }

        // Draw detection border (thicker)
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

        // Draw label background
        const label = `${detection.entity.name}`;
        const confidenceText = `${(confidence * 100).toFixed(0)}%`;
        const labelWidth = Math.max(ctx.measureText(label).width, ctx.measureText(confidenceText).width) + 10;

        ctx.fillStyle = color;
        ctx.fillRect(pos.x, pos.y + pos.height, labelWidth, 36);

        // Draw label text
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(label, pos.x + 5, pos.y + pos.height + 14);
        ctx.fillText(confidenceText, pos.x + 5, pos.y + pos.height + 30);
    });

    // Draw legend
    const legendX = 10;
    const legendY = 10;
    const legendHeight = 140;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(legendX, legendY, 220, legendHeight);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Smart Detection Overlay', legendX + 10, legendY + 20);

    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0, 255, 0, 1)';
    ctx.fillText('■ High (≥85%)', legendX + 10, legendY + 45);

    ctx.fillStyle = 'rgba(255, 165, 0, 1)';
    ctx.fillText('■ Medium (70-85%)', legendX + 10, legendY + 65);

    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillText('■ Low (<70%)', legendX + 10, legendY + 85);

    ctx.fillStyle = 'rgba(0, 255, 255, 1)';
    ctx.fillText('┄ Scan regions', legendX + 10, legendY + 105);

    ctx.fillStyle = 'rgba(200, 200, 200, 1)';
    ctx.fillText(`Detections: ${detections.length}`, legendX + 10, legendY + 125);
}

/**
 * Create debug overlay canvas and return as data URL
 * Shows scan regions and detected icons with confidence scores
 */
export async function createDebugOverlay(imageDataUrl: string, detections: CVDetectionResult[]): Promise<string> {
    const { width, height } = await loadImageToCanvas(imageDataUrl);

    // Define scan regions (same as used in detectItemsWithCV)
    const scanRegions: ROI[] = [
        {
            x: 0,
            y: Math.floor(height * 0.8),
            width: width,
            height: Math.floor(height * 0.2),
            label: 'hotbar_region',
        },
        {
            x: 0,
            y: 0,
            width: Math.floor(width * 0.25),
            height: Math.floor(height * 0.4),
            label: 'equipment_region',
        },
    ];

    // Create canvas for debug overlay
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Wait for debug overlay to fully render
    await renderDebugOverlay(canvas, imageDataUrl, scanRegions, detections);

    return canvas.toDataURL('image/png');
}

// ========================================
// Global Assignments
// ========================================
if (typeof window !== 'undefined') {
    (window as any).initCV = initCV;
}
