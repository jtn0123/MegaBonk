// ========================================
// Detection Pipeline - Main Orchestration
// ========================================

import type { CVDetectionResult, ROI } from '../types.ts';
import { logger } from '../../logger.ts';
import { detectResolution } from '../../test-utils.ts';
import { getAllData, getItemTemplates, isPriorityTemplatesLoaded } from '../state.ts';
import { loadItemTemplates } from '../templates.ts';
import { getMetricsCollector } from '../metrics.ts';
import { selectStrategiesForImage } from '../ensemble-detector.ts';
import { getResolutionTier } from '../resolution-profiles.ts';
import { findUncertainDetections, shouldPromptForLearning } from '../active-learning.ts';
import { detectCount, hasCountOverlay } from '../count-detection.ts';
import { getDynamicMinConfidence, isCVDetectionInProgress, setCVDetectionInProgress } from '../detection-config.ts';
import { hashImageDataUrl } from '../detection-utils.ts';
import { detectHotbarRegion, getAdaptiveIconSizes, verifyGridPattern, detectGridPositions } from '../detection-grid.ts';
import {
    loadImageToCanvas,
    getCachedResults,
    cacheResults,
    boostConfidenceWithContext,
    validateWithBorderRarity,
} from '../detection-processing.ts';

// Import from sibling modules
import { detectIconsWithTwoPhase } from './two-phase.ts';
import { detectIconsWithSlidingWindow, detectEquipmentRegion } from './sliding-window.ts';
import { detectItemsWithWorkers } from './worker-detection.ts';
import type { ProgressCallback } from './types.ts';

/**
 * Run worker-based detection (legacy path)
 */
async function runWorkerDetection(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: import('../../../types/index.ts').Item[],
    imageHash: string,
    progressCallback?: ProgressCallback
): Promise<CVDetectionResult[]> {
    const gridPositions = detectGridPositions(width, height);
    logger.info({ operation: 'cv.detect_items_workers', data: { gridPositions: gridPositions.length, workers: 4 } });

    const workerResults = await detectItemsWithWorkers(ctx, gridPositions, items, progressCallback);
    progressCallback?.(100, 'Worker processing complete');

    logger.info({
        operation: 'cv.detect_items_workers_complete',
        data: { detectionsCount: workerResults.length, gridPositions: gridPositions.length },
    });

    cacheResults(imageHash, workerResults);
    return workerResults;
}

/**
 * Detect hotbar items using two-phase or sliding window fallback
 */
async function detectHotbarItems(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: import('../../../types/index.ts').Item[],
    progressCallback?: ProgressCallback
): Promise<{ detections: CVDetectionResult[]; gridUsed: boolean }> {
    progressCallback?.(18, 'Attempting two-phase grid detection...');

    const twoPhaseResult = await detectIconsWithTwoPhase(ctx, width, height, items, {
        minConfidence: getDynamicMinConfidence(width, height),
        progressCallback,
    });

    if (twoPhaseResult.gridUsed && twoPhaseResult.detections.length > 0) {
        logger.info({
            operation: 'cv.two_phase_success',
            data: {
                detections: twoPhaseResult.detections.length,
                gridColumns: twoPhaseResult.grid?.columns || 0,
                gridRows: twoPhaseResult.grid?.rows || 0,
            },
        });
        return { detections: twoPhaseResult.detections, gridUsed: true };
    }

    // Fall back to sliding window
    logger.info({
        operation: 'cv.two_phase_fallback',
        data: { reason: !twoPhaseResult.gridUsed ? 'grid_detection_failed' : 'no_detections' },
    });
    progressCallback?.(25, 'Falling back to sliding window...');

    const detectedHotbar = detectHotbarRegion(ctx, width, height);
    const useDetected = detectedHotbar.confidence > 0.3;
    const hotbarROI: ROI = {
        x: 0,
        y: useDetected ? detectedHotbar.topY : Math.floor(height * 0.8),
        width,
        height: useDetected ? detectedHotbar.bottomY - detectedHotbar.topY : Math.floor(height * 0.2),
        label: 'hotbar_region',
    };

    logger.info({ operation: 'cv.hotbar_detection', data: { detected: detectedHotbar, usingROI: hotbarROI } });

    const detections = await detectIconsWithSlidingWindow(ctx, width, height, items, {
        stepSize: 10,
        minConfidence: getDynamicMinConfidence(width, height),
        regionOfInterest: hotbarROI,
        progressCallback,
    });

    return { detections, gridUsed: false };
}

/**
 * Validate detections with border rarity and record metrics
 */
function validateDetections(
    detections: CVDetectionResult[],
    ctx: CanvasRenderingContext2D,
    metrics: ReturnType<typeof getMetricsCollector>
): CVDetectionResult[] {
    const validationStartTime = performance.now();
    const validated = detections
        .map(detection => {
            const result = validateWithBorderRarity(detection, ctx, false);
            if (result === null) {
                metrics.recordRarityValidation(false, true);
            } else if (result.confidence > detection.confidence) {
                metrics.recordRarityValidation(true, false);
            } else {
                metrics.recordRarityValidation(false, false);
            }
            return result;
        })
        .filter((d): d is CVDetectionResult => d !== null);
    metrics.recordValidationTime(performance.now() - validationStartTime);
    return validated;
}

/**
 * Annotate detections with stack count information
 */
function annotateStackCounts(
    detections: CVDetectionResult[],
    imageData: ImageData,
    screenHeight: number
): void {
    for (const detection of detections) {
        if (!detection.position) continue;
        const { x, y, width: cellW, height: cellH } = detection.position;
        if (!hasCountOverlay(imageData, x, y, cellW, cellH, screenHeight)) continue;

        const countResult = detectCount(imageData, x, y, cellW, cellH, screenHeight);
        if (countResult.count > 1 && countResult.confidence > 0.5) {
            const det = detection as CVDetectionResult & { stackCount?: number; countConfidence?: number };
            det.stackCount = countResult.count;
            det.countConfidence = countResult.confidence;
        }
    }
}

/**
 * Log active learning uncertain detections
 */
function logActiveLearning(detections: CVDetectionResult[]): void {
    const feedbackDetections = detections
        .filter(d => d.position)
        .map(d => ({
            detectedItemId: d.entity.id,
            detectedItemName: d.entity.name,
            confidence: d.confidence,
            x: d.position!.x,
            y: d.position!.y,
            width: d.position!.width,
            height: d.position!.height,
        }));

    const uncertainDetections = findUncertainDetections(feedbackDetections);
    if (uncertainDetections.length > 0 && shouldPromptForLearning(feedbackDetections)) {
        logger.info({
            operation: 'cv.active_learning.uncertain_found',
            data: {
                uncertainCount: uncertainDetections.length,
                totalDetections: detections.length,
                topUncertain: uncertainDetections.slice(0, 3).map(u => ({
                    item: u.detection.detectedItemName,
                    confidence: u.detection.confidence.toFixed(2),
                    alternatives: u.alternatives.length,
                })),
            },
        });
    }
}

/**
 * Detect items using template matching against stored item icons
 * Uses smart sliding window detection to find icons anywhere on screen
 */
export async function detectItemsWithCV(
    imageDataUrl: string,
    progressCallback?: ProgressCallback,
    useWorkers: boolean = false
): Promise<CVDetectionResult[]> {
    if (isCVDetectionInProgress()) {
        logger.warn({ operation: 'cv.detect_concurrent_rejected', data: { message: 'CV detection already in progress' } });
        return [];
    }
    setCVDetectionInProgress(true);

    const metrics = getMetricsCollector();
    const runStartTime = performance.now();

    try {
        // Check cache first
        const imageHash = hashImageDataUrl(imageDataUrl);
        const cachedResults = getCachedResults(imageHash);
        if (cachedResults) {
            logger.info({ operation: 'cv.cache_hit', data: { imageHash, resultCount: cachedResults.length } });
            progressCallback?.(100, 'Loaded from cache (instant)');
            return cachedResults;
        }

        progressCallback?.(0, 'Loading image...');

        if (!isPriorityTemplatesLoaded()) {
            progressCallback?.(5, 'Loading item templates...');
            await loadItemTemplates();
        }

        const { ctx, width, height } = await loadImageToCanvas(imageDataUrl);
        const resolution = detectResolution(width, height);
        metrics.startRun(width, height, resolution.category);

        const selectedStrategies = selectStrategiesForImage(width, height);
        const resolutionTier = getResolutionTier(width, height);
        logger.info({
            operation: 'cv.strategy_selection',
            data: { resolutionTier, selectedStrategies, dynamicThreshold: getDynamicMinConfidence(width, height) },
        });

        progressCallback?.(15, 'Analyzing image structure...');
        const items = getAllData().items?.items || [];
        const itemTemplates = getItemTemplates();
        logger.info({
            operation: 'cv.detect_start',
            data: { imageWidth: width, imageHeight: height, templatesLoaded: itemTemplates.size, mode: 'sliding_window' },
        });

        // Worker path (legacy)
        if (useWorkers) {
            return await runWorkerDetection(ctx, width, height, items, imageHash, progressCallback);
        }

        // Two-phase detection with sliding window fallback
        const { detections: hotbarDetections, gridUsed } = await detectHotbarItems(ctx, width, height, items, progressCallback);
        const equipmentDetections = await detectEquipmentRegion(ctx, width, height, items, progressCallback);
        const allDetections = [...hotbarDetections, ...equipmentDetections];

        // Grid verification
        progressCallback?.(88, 'Verifying grid pattern...');
        const iconSizes = getAdaptiveIconSizes(width, height);
        const gridVerification = verifyGridPattern(allDetections, iconSizes[1] || 48);
        const verifiedDetections = gridVerification.isValid ? gridVerification.filteredDetections : allDetections;
        metrics.recordGridVerification(allDetections.length, verifiedDetections.length);

        // Context boosting + validation
        progressCallback?.(92, 'Applying context boosting...');
        const boostedDetections = boostConfidenceWithContext(verifiedDetections);
        progressCallback?.(96, 'Validating with border rarity...');
        const validatedDetections = validateDetections(boostedDetections, ctx, metrics);

        // Stack counts
        progressCallback?.(98, 'Detecting item counts...');
        const imageData = ctx.getImageData(0, 0, width, height);
        annotateStackCounts(validatedDetections, imageData, height);

        progressCallback?.(100, 'Smart detection complete');

        // Logging
        const logData: Record<string, unknown> = {
            detectionsCount: validatedDetections.length,
            hotbarDetections: hotbarDetections.length,
            equipmentDetections: equipmentDetections.length,
            mode: gridUsed ? 'two_phase_grid' : 'sliding_window',
            gridUsed,
        };
        if (validatedDetections.length === 0) {
            logData.debugHint = 'No icons detected - ensure screenshot shows game UI with item icons';
            logData.suggestion = 'Try taking screenshot during gameplay with hotbar visible';
        } else {
            logData.detectedItems = validatedDetections.slice(0, 5).map(d => d.entity.name);
        }
        logger.info({ operation: 'cv.detect_items_smart', data: logData });

        cacheResults(imageHash, validatedDetections);
        logActiveLearning(validatedDetections);
        metrics.endRun(performance.now() - runStartTime);

        return validatedDetections;
    } catch (error) {
        logger.error({ operation: 'cv.detect_items', error: { name: (error as Error).name, message: (error as Error).message } });
        metrics.endRun(performance.now() - runStartTime);
        throw error;
    } finally {
        setCVDetectionInProgress(false);
    }
}

/**
 * Reset detection state for testing
 * @internal
 */
export function __resetDetectionStateForTesting(): void {
    setCVDetectionInProgress(false);
}
