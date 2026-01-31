// ========================================
// Detection Pipeline - Sliding Window Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import { logger } from '../../logger.ts';
import type { CVDetectionResult, ROI } from '../types.ts';
import { getItemTemplates, getTemplatesByColor } from '../state.ts';
import {
    getDominantColor,
    getColorCandidates,
    isEmptyCell,
    calculateColorVariance,
} from '../color.ts';
import { getTrainingTemplatesForItem, isTrainingDataLoaded } from '../training.ts';
import { getDynamicMinConfidence } from '../detection-config.ts';
import { nonMaxSuppression } from '../detection-utils.ts';
import { getAdaptiveIconSizes } from '../detection-grid.ts';
import { matchTemplate, matchTemplateMulti } from '../detection-matching.ts';
import type { SlidingWindowOptions, ProgressCallback } from './types.ts';

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
    // Use dynamic threshold based on resolution and scoring config
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

    // Check if training data is loaded for multi-template matching
    const useMultiTemplate = isTrainingDataLoaded();

    logger.info({
        operation: 'cv.sliding_window_start',
        data: {
            scanRegion: { x: scanX, y: scanY, w: scanWidth, h: scanHeight },
            iconSizes: sizesToUse,
            multiScale,
            stepSize,
            totalSteps,
            templatesLoaded: itemTemplates.size,
            trainingDataLoaded: useMultiTemplate,
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

            // Color-based pre-filtering using adjacent colors
            const windowColor = getDominantColor(windowData);
            const colorsToCheck = getColorCandidates(windowColor);

            // Gather candidates from exact match and adjacent colors
            const candidateItems: Item[] = [];
            const seenIds = new Set<string>();

            for (const color of colorsToCheck) {
                const colorItems = templatesByColor.get(color) || [];
                for (const item of colorItems) {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        candidateItems.push(item);
                    }
                }
            }

            const itemsToCheck = candidateItems.length > 0 ? candidateItems : items.slice(0, 30);

            // Match against candidate templates at multiple scales
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
