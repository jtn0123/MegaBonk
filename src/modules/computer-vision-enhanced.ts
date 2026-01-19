// ========================================
// Enhanced Computer Vision Module
// ========================================
// Extends base CV module with advanced strategies
// Implements Ideas 1-5: Rarity-first, multi-region, adaptive thresholds, HSV, feedback loop
// ========================================

import type { AllGameData, Item } from '../types/index.ts';
import type { CVDetectionResult, ROI } from './computer-vision.ts';
import { detectGridPositions, aggregateDuplicates } from './computer-vision.ts';
import type { CVStrategy, ColorProfile, HSVColor } from './cv-strategy.ts';
import {
    getActiveStrategy,
    getConfidenceThresholds,
    rgbToHSV,
    extractColorProfile,
    compareColorProfiles,
    getSimilarityPenalty,
} from './cv-strategy.ts';
import { startMetricsTracking } from './cv-metrics.ts';
import { logger } from './logger.ts';
import { getAllData, setAllData, isTemplatesLoaded as isBaseTemplatesLoaded, setTemplatesLoaded } from './cv/state.ts';
import { isEmptyCell, detectBorderRarity } from './cv/color.ts';

// Re-export types
export type { CVDetectionResult, ROI, CVStrategy, ColorProfile };

/**
 * Template data with enhanced color information
 */
interface EnhancedTemplateData {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    colorProfile: ColorProfile;
    hsvColor: HSVColor;
    rarity: string;
}

// Enhanced template storage (extends base with color analysis)
const enhancedTemplates = new Map<string, EnhancedTemplateData>();
const templatesByRarity = new Map<string, Item[]>();
const enhancedTemplatesByColor = new Map<string, Item[]>();

// Track enhanced-specific loading state (separate from base templates)
let enhancedTemplatesLoaded = false;

/**
 * Initialize enhanced CV module
 */
export function initEnhancedCV(gameData: AllGameData): void {
    setAllData(gameData);

    logger.info({
        operation: 'cv_enhanced.init',
        data: {
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Load templates with enhanced color analysis
 */
export async function loadEnhancedTemplates(): Promise<void> {
    if (enhancedTemplatesLoaded) return;

    const gameData = getAllData();
    const items = gameData.items?.items || [];

    logger.info({
        operation: 'cv_enhanced.load_templates',
        data: { phase: 'start', totalItems: items.length },
    });

    // Load all items with enhanced analysis
    const loadPromises = items.map(async item => {
        try {
            if (!item.image) return;
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

                    // Extract enhanced color information
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const colorProfile = extractColorProfile(imageData);

                    // Calculate average HSV
                    let sumH = 0,
                        sumS = 0,
                        sumV = 0,
                        count = 0;
                    for (let i = 0; i < imageData.data.length; i += 16) {
                        const hsv = rgbToHSV(
                            imageData.data[i] ?? 0,
                            imageData.data[i + 1] ?? 0,
                            imageData.data[i + 2] ?? 0
                        );
                        sumH += hsv.h;
                        sumS += hsv.s;
                        sumV += hsv.v;
                        count++;
                    }

                    const avgHSV: HSVColor = {
                        h: sumH / count,
                        s: sumS / count,
                        v: sumV / count,
                    };

                    enhancedTemplates.set(item.id, {
                        image: img,
                        canvas,
                        ctx,
                        width: img.width,
                        height: img.height,
                        colorProfile,
                        hsvColor: avgHSV,
                        rarity: item.rarity,
                    });

                    // Group by rarity
                    let rarityArray = templatesByRarity.get(item.rarity);
                    if (!rarityArray) {
                        rarityArray = [];
                        templatesByRarity.set(item.rarity, rarityArray);
                    }
                    rarityArray.push(item);

                    // Group by dominant color
                    let colorArray = enhancedTemplatesByColor.get(colorProfile.dominant);
                    if (!colorArray) {
                        colorArray = [];
                        enhancedTemplatesByColor.set(colorProfile.dominant, colorArray);
                    }
                    colorArray.push(item);

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
                        const imageData = ctx.getImageData(0, 0, pngImg.width, pngImg.height);
                        const colorProfile = extractColorProfile(imageData);

                        let sumH = 0,
                            sumS = 0,
                            sumV = 0,
                            count = 0;
                        for (let i = 0; i < imageData.data.length; i += 16) {
                            const hsv = rgbToHSV(
                                imageData.data[i] ?? 0,
                                imageData.data[i + 1] ?? 0,
                                imageData.data[i + 2] ?? 0
                            );
                            sumH += hsv.h;
                            sumS += hsv.s;
                            sumV += hsv.v;
                            count++;
                        }

                        const avgHSV: HSVColor = {
                            h: sumH / count,
                            s: sumS / count,
                            v: sumV / count,
                        };

                        enhancedTemplates.set(item.id, {
                            image: pngImg,
                            canvas,
                            ctx,
                            width: pngImg.width,
                            height: pngImg.height,
                            colorProfile,
                            hsvColor: avgHSV,
                            rarity: item.rarity,
                        });

                        if (!templatesByRarity.has(item.rarity)) {
                            templatesByRarity.set(item.rarity, []);
                        }
                        templatesByRarity.get(item.rarity)!.push(item);

                        if (!enhancedTemplatesByColor.has(colorProfile.dominant)) {
                            enhancedTemplatesByColor.set(colorProfile.dominant, []);
                        }
                        enhancedTemplatesByColor.get(colorProfile.dominant)!.push(item);

                        resolve();
                    };
                    pngImg.onerror = () => reject(new Error(`Failed to load: ${item.image ?? 'unknown'}`));
                    pngImg.src = item.image ?? '';
                };

                img.src = imagePath;
            });
        } catch (error) {
            logger.error({
                operation: 'cv_enhanced.load_template',
                error: {
                    name: (error as Error).name,
                    message: `${(error as Error).message} (item: ${item.id})`,
                },
            });
        }
    });

    await Promise.all(loadPromises);

    enhancedTemplatesLoaded = true;

    logger.info({
        operation: 'cv_enhanced.load_templates',
        data: {
            phase: 'complete',
            total: enhancedTemplates.size,
            byRarity: Object.fromEntries(
                Array.from(templatesByRarity.entries()).map(([k, v]: [string, Item[]]) => [k, v.length])
            ),
            byColor: Object.fromEntries(
                Array.from(enhancedTemplatesByColor.entries()).map(([k, v]: [string, Item[]]) => [k, v.length])
            ),
        },
    });
}

/**
 * Calculate similarity using specified algorithm
 */
function calculateSimilarity(imageData1: ImageData, imageData2: ImageData, algorithm: 'ncc' | 'ssd' | 'ssim'): number {
    switch (algorithm) {
        case 'ssd':
            return calculateSSD(imageData1, imageData2);
        case 'ssim':
            return calculateSSIM(imageData1, imageData2);
        case 'ncc':
        default:
            return calculateNCC(imageData1, imageData2);
    }
}

/**
 * Normalized Cross-Correlation (current method)
 */
function calculateNCC(imageData1: ImageData, imageData2: ImageData): number {
    let sum1 = 0,
        sum2 = 0,
        sumProduct = 0,
        sumSquare1 = 0,
        sumSquare2 = 0,
        count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    const mean1 = sum1 / count;
    const mean2 = sum2 / count;

    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) return 0;

    return (numerator / denominator + 1) / 2;
}

/**
 * Sum of Squared Differences (faster)
 */
function calculateSSD(imageData1: ImageData, imageData2: ImageData): number {
    let sum = 0;
    let count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        const diff = gray1 - gray2;
        sum += diff * diff;
        count++;
    }

    const avgSSD = sum / count;
    // Normalize to 0-1 (lower SSD = higher similarity)
    return 1 / (1 + avgSSD / 255);
}

/**
 * Structural Similarity Index (SSIM) - more accurate but slower
 */
function calculateSSIM(imageData1: ImageData, imageData2: ImageData): number {
    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;

    let sum1 = 0,
        sum2 = 0,
        sumSquare1 = 0,
        sumSquare2 = 0,
        sumProduct = 0,
        count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        sumProduct += gray1 * gray2;
        count++;
    }

    const mean1 = sum1 / count;
    const mean2 = sum2 / count;
    const var1 = sumSquare1 / count - mean1 * mean1;
    const var2 = sumSquare2 / count - mean2 * mean2;
    const covar = sumProduct / count - mean1 * mean2;

    const luminance = (2 * mean1 * mean2 + C1) / (mean1 * mean1 + mean2 * mean2 + C1);
    const contrast = (2 * Math.sqrt(var1) * Math.sqrt(var2) + C2) / (var1 + var2 + C2);
    const structure = (covar + C2 / 2) / (Math.sqrt(var1) * Math.sqrt(var2) + C2 / 2);

    return luminance * contrast * structure;
}

/**
 * Enhanced detection with strategy support
 */
export async function detectItemsWithEnhancedCV(
    imageDataUrl: string,
    strategyName: string = 'optimized',
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    const strategy = getActiveStrategy();

    // Start metrics tracking
    const metrics = startMetricsTracking(strategy, strategyName);
    metrics.startLoad();

    try {
        // Ensure templates loaded
        if (!enhancedTemplatesLoaded) {
            if (progressCallback) {
                progressCallback(5, 'Loading enhanced templates...');
            }
            await loadEnhancedTemplates();
        }

        metrics.endLoad();
        metrics.startPreprocess();

        // Load image
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageDataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);

        if (progressCallback) {
            progressCallback(20, 'Detecting grid positions...');
        }

        // Detect grid
        const gridPositions = detectGridPositions(img.width, img.height);

        metrics.endPreprocess();
        metrics.startMatching();

        if (progressCallback) {
            progressCallback(30, `Analyzing ${gridPositions.length} cells...`);
        }

        // Detect items using strategy
        const detections = await detectWithStrategy(ctx, gridPositions, strategy, progressCallback);

        metrics.endMatching();
        metrics.startPostprocess();

        if (progressCallback) {
            progressCallback(95, 'Aggregating results...');
        }

        // Aggregate duplicates
        const aggregated = aggregateDuplicates(detections);

        metrics.endPostprocess();

        // Record metrics
        metrics.recordDetections(aggregated);
        metrics.recordCellStats(
            gridPositions.length,
            0, // Empty cells calculation needed
            gridPositions.length,
            aggregated.length
        );

        const finalMetrics = metrics.complete();

        if (progressCallback) {
            progressCallback(
                100,
                `Complete! Detected ${aggregated.length} items in ${finalMetrics.totalTime.toFixed(0)}ms`
            );
        }

        logger.info({
            operation: 'cv_enhanced.detect_complete',
            data: {
                strategy: strategyName,
                detections: aggregated.length,
                time: finalMetrics.totalTime,
                avgConfidence: finalMetrics.averageConfidence,
            },
        });

        return aggregated;
    } catch (error) {
        logger.error({
            operation: 'cv_enhanced.detect_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        throw error;
    }
}

/**
 * Detect items using configured strategy
 */
async function detectWithStrategy(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    strategy: CVStrategy,
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    const gameData = getAllData();
    const items = gameData.items?.items || [];

    // Filter empty cells first
    const validCells: Array<{ cell: ROI; imageData: ImageData; rarity?: string; colorProfile?: ColorProfile }> = [];

    for (const cell of gridPositions) {
        const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        if (strategy.useEmptyCellDetection && isEmptyCell(cellImageData)) {
            continue;
        }

        // Extract rarity if using rarity-first filtering
        let cellRarity: string | undefined;
        if (strategy.colorFiltering === 'rarity-first') {
            cellRarity = detectBorderRarity(cellImageData) || undefined;
        }

        // Extract color profile for multi-region analysis
        let cellColorProfile: ColorProfile | undefined;
        if (strategy.colorAnalysis === 'multi-region') {
            cellColorProfile = extractColorProfile(cellImageData);
        }

        validCells.push({ cell, imageData: cellImageData, rarity: cellRarity, colorProfile: cellColorProfile });
    }

    // Multi-pass matching if enabled
    if (strategy.multiPassEnabled) {
        return await multiPassMatching(ctx, validCells, items, strategy, progressCallback);
    } else {
        return await singlePassMatching(ctx, validCells, items, strategy, progressCallback);
    }
}

/**
 * Multi-pass matching with strategy
 */
async function multiPassMatching(
    ctx: CanvasRenderingContext2D,
    validCells: Array<{ cell: ROI; imageData: ImageData; rarity?: string; colorProfile?: ColorProfile }>,
    items: Item[],
    strategy: CVStrategy,
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    const detections: CVDetectionResult[] = [];
    const matchedCells = new Set<ROI>();

    const allThresholds = getConfidenceThresholds(strategy);

    // Pass 1: High confidence
    if (progressCallback) progressCallback(40, 'Pass 1: High confidence...');

    for (const { cell, imageData, rarity, colorProfile } of validCells) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile, imageData);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(ctx, cell, imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass1) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    // Pass 2: Medium confidence
    if (progressCallback) progressCallback(60, 'Pass 2: Medium confidence...');

    const unmatchedAfterPass1 = validCells.filter(({ cell }) => !matchedCells.has(cell));

    for (const { cell, imageData, rarity, colorProfile } of unmatchedAfterPass1) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile, imageData);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(ctx, cell, imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass2) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    // Pass 3: Low confidence with context
    if (progressCallback) progressCallback(80, 'Pass 3: Low confidence with validation...');

    const unmatchedAfterPass2 = validCells.filter(({ cell }) => !matchedCells.has(cell));

    for (const { cell, imageData, rarity, colorProfile } of unmatchedAfterPass2) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile, imageData);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(ctx, cell, imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass3) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    return detections;
}

/**
 * Single-pass matching (for fast strategy)
 */
async function singlePassMatching(
    ctx: CanvasRenderingContext2D,
    validCells: Array<{ cell: ROI; imageData: ImageData; rarity?: string; colorProfile?: ColorProfile }>,
    items: Item[],
    strategy: CVStrategy,
    progressCallback?: (progress: number, status: string) => void
): Promise<CVDetectionResult[]> {
    const detections: CVDetectionResult[] = [];

    for (let i = 0; i < validCells.length; i++) {
        const validCell = validCells[i];
        if (!validCell) continue;
        const { cell, imageData, rarity, colorProfile } = validCell;

        if (progressCallback && i % 5 === 0) {
            const progress = 40 + Math.floor((i / validCells.length) * 50);
            progressCallback(progress, `Matching ${i + 1}/${validCells.length}...`);
        }

        const candidates = filterCandidates(items, strategy, rarity, colorProfile, imageData);
        const match = matchCell(ctx, cell, imageData, candidates, strategy);

        // Use rarity-based thresholds per cell for adaptive detection
        const thresholds = getConfidenceThresholds(strategy, rarity);
        if (match && match.similarity >= thresholds.pass2) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
        }
    }

    return detections;
}

/**
 * Filter candidate items based on strategy
 */
function filterCandidates(
    items: Item[],
    strategy: CVStrategy,
    cellRarity?: string,
    cellColorProfile?: ColorProfile,
    _cellImageData?: ImageData
): Item[] {
    let candidates = items;

    if (strategy.colorFiltering === 'rarity-first' && cellRarity) {
        // Rarity-first: Filter by rarity AND color
        const rarityItems = templatesByRarity.get(cellRarity) || [];

        if (cellColorProfile) {
            candidates = rarityItems.filter(item => {
                const template = enhancedTemplates.get(item.id);
                if (!template) return false;

                const colorMatch = compareColorProfiles(template.colorProfile, cellColorProfile);
                return colorMatch >= 0.5; // At least 50% color profile match
            });
        } else {
            candidates = rarityItems;
        }

        // Fallback to all items if no matches
        if (candidates.length === 0) candidates = items;
    } else if (strategy.colorFiltering === 'color-first') {
        // Color-first: Filter by dominant color
        if (cellColorProfile) {
            const colorItems = enhancedTemplatesByColor.get(cellColorProfile.dominant) || [];
            candidates = colorItems.length > 0 ? colorItems : items;
        }
    }

    return candidates;
}

/**
 * Match a cell against candidate items
 */
function matchCell(
    _ctx: CanvasRenderingContext2D,
    _cell: ROI,
    cellImageData: ImageData,
    candidates: Item[],
    strategy: CVStrategy
): { item: Item; similarity: number } | null {
    let bestMatch: { item: Item; similarity: number } | null = null;

    for (const item of candidates) {
        const template = enhancedTemplates.get(item.id);
        if (!template) continue;

        // Get template image data
        const templateImageData = template.ctx.getImageData(0, 0, template.width, template.height);

        // Resize template to match cell size
        const resizedTemplate = resizeImageData(templateImageData, cellImageData.width, cellImageData.height);

        // Calculate similarity using strategy algorithm
        let similarity = calculateSimilarity(cellImageData, resizedTemplate, strategy.matchingAlgorithm);

        // Apply feedback loop penalty if enabled
        if (strategy.useFeedbackLoop) {
            const penalty = getSimilarityPenalty(item.id, item.id);
            similarity += penalty;
        }

        // Apply context boosting if enabled
        if (strategy.useContextBoosting) {
            if (item.rarity === 'common') similarity += 0.03;
            else if (item.rarity === 'uncommon') similarity += 0.02;
            else if (item.rarity === 'legendary') similarity -= 0.02;
        }

        // Apply border validation if enabled
        if (strategy.useBorderValidation) {
            const detectedRarity = detectBorderRarity(cellImageData);
            if (detectedRarity === item.rarity) {
                similarity *= 1.05;
            } else if (detectedRarity && detectedRarity !== item.rarity) {
                similarity *= 0.85;
            }
        }

        // Clamp similarity
        similarity = Math.max(0, Math.min(0.99, similarity));

        if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { item, similarity };
        }
    }

    return bestMatch;
}

/**
 * Resize ImageData
 */
function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(imageData, 0, 0);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })!;
    outputCtx.drawImage(canvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    return outputCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Reset enhanced CV state (for data refresh)
 * Clears all loaded templates and resets loading state
 */
export function resetEnhancedCVState(): void {
    enhancedTemplates.clear();
    templatesByRarity.clear();
    enhancedTemplatesByColor.clear();
    enhancedTemplatesLoaded = false;

    logger.info({
        operation: 'cv_enhanced.reset',
        data: { message: 'Enhanced CV state cleared' },
    });
}

// Export for window
if (typeof window !== 'undefined') {
    (window as any).initEnhancedCV = initEnhancedCV;
    (window as any).detectItemsWithEnhancedCV = detectItemsWithEnhancedCV;
    (window as any).resetEnhancedCVState = resetEnhancedCVState;
}
