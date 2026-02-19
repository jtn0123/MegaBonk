// ========================================
// Detection Pipeline - Sliding Window Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import { logger } from '../../logger.ts';
import type { CVDetectionResult, ROI } from '../types.ts';
import { getItemTemplates, getTemplatesByColor } from '../state.ts';
import { getDominantColor, getColorCandidates, isEmptyCell, calculateColorVariance } from '../color.ts';
import { getTrainingTemplatesForItem, isTrainingDataLoaded } from '../training.ts';
import { getDynamicMinConfidence } from '../detection-config.ts';
import { nonMaxSuppression } from '../detection-utils.ts';
import { getAdaptiveIconSizes } from '../detection-grid.ts';
import { matchTemplate, matchTemplateMulti } from '../detection-matching.ts';
import type { TemplateData } from '../types.ts';
import type { SlidingWindowOptions, ProgressCallback } from './types.ts';

/** Context passed to window processing helpers */
interface ScanContext {
    ctx: CanvasRenderingContext2D;
    primarySize: number;
    itemTemplates: Map<string, TemplateData>;
    templatesByColor: Map<string, Item[]>;
    items: Item[];
    sizesToUse: number[];
    minConfidence: number;
    useMultiTemplate: boolean;
}

/**
 * Check if a window position should be skipped (empty or low-detail)
 */
function shouldSkipWindow(windowData: ImageData): boolean {
    if (isEmptyCell(windowData)) return true;
    return calculateColorVariance(windowData) < 800;
}

/**
 * Gather candidate items by color-based pre-filtering
 */
function getCandidateItems(windowData: ImageData, scanCtx: ScanContext): Item[] {
    const windowColor = getDominantColor(windowData);
    const colorsToCheck = getColorCandidates(windowColor);
    const candidateItems: Item[] = [];
    const seenIds = new Set<string>();

    for (const color of colorsToCheck) {
        const colorItems = scanCtx.templatesByColor.get(color) || [];
        for (const item of colorItems) {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                candidateItems.push(item);
            }
        }
    }

    return candidateItems.length > 0 ? candidateItems : scanCtx.items.slice(0, 30);
}

/**
 * Get scale-aware confidence adjustment
 */
function getScaleAdjustment(scaleSize: number): number {
    if (scaleSize < 40) return -0.02;
    if (scaleSize > 60) return 0.01;
    return 0;
}

/**
 * Find the best matching item across all scales for a given position
 */
function findBestMatchAtPosition(
    x: number,
    y: number,
    candidateItems: Item[],
    scanCtx: ScanContext
): { item: Item; similarity: number; scale: number } | null {
    let bestMatch: { item: Item; similarity: number; scale: number } | null = null;

    for (const item of candidateItems) {
        const template = scanCtx.itemTemplates.get(item.id);
        if (!template) continue;

        const trainingTemplates = scanCtx.useMultiTemplate ? getTrainingTemplatesForItem(item.id) : [];

        for (const scaleSize of scanCtx.sizesToUse) {
            const scaleROI: ROI = { x, y, width: scaleSize, height: scaleSize };
            const similarity: number =
                trainingTemplates.length > 0
                    ? matchTemplateMulti(scanCtx.ctx, scaleROI, template, item.id, trainingTemplates)
                    : matchTemplate(scanCtx.ctx, scaleROI, template, item.id);

            const adjustedThreshold = scanCtx.minConfidence + getScaleAdjustment(scaleSize);

            if (similarity > adjustedThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
                bestMatch = { item, similarity, scale: scaleSize };
            }
        }
    }

    return bestMatch;
}

/**
 * Sliding window detection to find icons anywhere on screen
 * Returns detected icons with their positions
 * Supports multi-scale matching for better accuracy across resolutions
 */
export async function detectIconsWithSlidingWindow(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    options: SlidingWindowOptions = {}
): Promise<CVDetectionResult[]> {
    const dynamicThreshold = getDynamicMinConfidence(width, height);
    const {
        stepSize = 12,
        minConfidence = dynamicThreshold,
        regionOfInterest,
        progressCallback,
        multiScale = true,
    } = options;

    const detections: CVDetectionResult[] = [];
    const iconSizes = getAdaptiveIconSizes(width, height);
    const sizesToUse = multiScale ? iconSizes : [iconSizes[1] || 48];
    const primarySize = iconSizes[1] || 48;

    const scanCtx: ScanContext = {
        ctx,
        primarySize,
        itemTemplates: getItemTemplates(),
        templatesByColor: getTemplatesByColor(),
        items,
        sizesToUse,
        minConfidence,
        useMultiTemplate: isTrainingDataLoaded(),
    };

    const scanX = regionOfInterest?.x ?? 0;
    const scanY = regionOfInterest?.y ?? 0;
    const scanWidth = regionOfInterest?.width ?? width;
    const scanHeight = regionOfInterest?.height ?? height;

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
            templatesLoaded: scanCtx.itemTemplates.size,
            trainingDataLoaded: scanCtx.useMultiTemplate,
        },
    });

    for (let y = scanY; y <= scanY + scanHeight - primarySize; y += stepSize) {
        for (let x = scanX; x <= scanX + scanWidth - primarySize; x += stepSize) {
            currentStep++;

            if (progressCallback && currentStep % 100 === 0) {
                const progress = Math.floor((currentStep / totalSteps) * 60) + 20;
                progressCallback(progress, `Scanning ${currentStep}/${totalSteps}...`);
            }

            const windowData = ctx.getImageData(x, y, primarySize, primarySize);
            if (shouldSkipWindow(windowData)) continue;

            const candidateItems = getCandidateItems(windowData, scanCtx);
            const bestMatch = findBestMatchAtPosition(x, y, candidateItems, scanCtx);

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
        data: { rawDetections: detections.length, scannedPositions: currentStep },
    });

    const nmsDetections = nonMaxSuppression(detections, 0.3);

    logger.info({
        operation: 'cv.nms_complete',
        data: { beforeNMS: detections.length, afterNMS: nmsDetections.length },
    });

    return nmsDetections;
}

/**
 * Detect equipment (weapons/tomes) in top-left area of screen
 * These appear in a different location than inventory items
 */
export async function detectEquipmentRegion(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    progressCallback?: ProgressCallback
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
        minConfidence: getDynamicMinConfidence(width, height), // Dynamic threshold
        regionOfInterest: equipmentROI,
    });

    return equipmentDetections;
}
