// ========================================
// Detection Pipeline - Main Orchestration
// ========================================

import type { CVDetectionResult, ROI } from '../types.ts';
import { logger } from '../../logger.ts';
import { detectResolution } from '../../image-layout.ts';
import { getAllData, getItemTemplates, getTemplateReadinessState, isPriorityTemplatesLoaded } from '../state.ts';
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
    buildDetectionCacheKey,
    getCachedResults,
    cacheResults,
    boostConfidenceWithContext,
    validateWithBorderRarity,
} from '../detection-processing.ts';
import {
    addSlotCandidate,
    addValidatorStageWarning,
    endValidatorStage,
    startValidatorStage,
    updateValidatorStageProgress,
    updateValidatorTraceMetadata,
    upsertSlotTrace,
} from '../validator-trace.ts';

// Import from sibling modules
import { detectIconsWithTwoPhase } from './two-phase.ts';
import { detectIconsWithSlidingWindow, detectEquipmentRegion } from './sliding-window.ts';
import { detectItemsWithWorkers } from './worker-detection.ts';
import type { ProgressCallback } from './types.ts';

/**
 * Run worker-based candidate generation.
 */
async function runWorkerDetection(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: import('../../../types/index.ts').Item[],
    progressCallback?: ProgressCallback
): Promise<CVDetectionResult[]> {
    const gridPositions = detectGridPositions(width, height);
    logger.info({ operation: 'cv.detect_items_workers', data: { gridPositions: gridPositions.length, workers: 4 } });

    const workerResults = await detectItemsWithWorkers(
        ctx,
        gridPositions,
        items,
        progressCallback,
        getDynamicMinConfidence(width, height)
    );
    progressCallback?.(82, 'Worker candidates ready');

    logger.info({
        operation: 'cv.detect_items_workers_complete',
        data: { detectionsCount: workerResults.length, gridPositions: gridPositions.length },
    });

    return workerResults;
}

interface DetectionCandidateRun {
    detections: CVDetectionResult[];
    gridUsed: boolean;
    hotbarDetections: number;
    equipmentDetections: number;
    mode: 'worker_grid' | 'two_phase_grid' | 'sliding_window';
    usedWorkers: boolean;
}

async function gatherDetectionCandidates(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: import('../../../types/index.ts').Item[],
    useWorkers: boolean,
    progressCallback?: ProgressCallback
): Promise<DetectionCandidateRun> {
    if (useWorkers) {
        if (typeof Worker === 'undefined') {
            addValidatorStageWarning('candidate_generation', 'Workers unavailable, falling back to main thread');
            logger.warn({
                operation: 'cv.worker_fallback',
                data: { reason: 'workers_not_supported', fallback: 'main_thread_pipeline' },
            });
        } else {
            try {
                progressCallback?.(25, 'Generating worker candidates...');
                const workerDetections = await runWorkerDetection(ctx, width, height, items, progressCallback);
                endValidatorStage('candidate_generation', {
                    metadata: {
                        mode: 'worker_grid',
                        usedWorkers: true,
                    },
                    inputCount: workerDetections.length,
                    outputCount: workerDetections.length,
                });
                return {
                    detections: workerDetections,
                    gridUsed: true,
                    hotbarDetections: workerDetections.length,
                    equipmentDetections: 0,
                    mode: 'worker_grid',
                    usedWorkers: true,
                };
            } catch (error) {
                addValidatorStageWarning('candidate_generation', `Worker path failed: ${(error as Error).message}`);
                logger.warn({
                    operation: 'cv.worker_fallback',
                    error: {
                        name: (error as Error).name,
                        message: (error as Error).message,
                    },
                    data: { fallback: 'main_thread_pipeline' },
                });
            }
        }
    }

    const { detections: hotbarDetections, gridUsed } = await detectHotbarItems(
        ctx,
        width,
        height,
        items,
        progressCallback
    );
    const equipmentDetections = await detectEquipmentRegion(ctx, width, height, items, progressCallback);
    return {
        detections: [...hotbarDetections, ...equipmentDetections],
        gridUsed,
        hotbarDetections: hotbarDetections.length,
        equipmentDetections: equipmentDetections.length,
        mode: gridUsed ? 'two_phase_grid' : 'sliding_window',
        usedWorkers: false,
    };
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
        data: { reason: twoPhaseResult.gridUsed ? 'no_detections' : 'grid_detection_failed' },
    });
    endValidatorStage('occupancy_filtering', {
        status: 'warning',
        metadata: {
            mode: 'sliding_window_fallback',
        },
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
    const validated: CVDetectionResult[] = [];
    let filteredCount = 0;

    detections.forEach((detection, index) => {
        const result = validateWithBorderRarity(detection, ctx, false);
        if (detection.position) {
            const slotId = `${detection.position.x}:${detection.position.y}:${detection.position.width}:${detection.position.height}`;
            if (result === null) {
                addSlotCandidate(
                    slotId,
                    {
                        itemId: detection.entity.id,
                        itemName: detection.entity.name,
                        confidence: detection.confidence,
                        reason: 'filtered_by_rarity',
                    },
                    true,
                    {
                        x: detection.position.x,
                        y: detection.position.y,
                        width: detection.position.width,
                        height: detection.position.height,
                    }
                );
                upsertSlotTrace(slotId, {
                    status: 'filtered',
                    notes: ['filtered_by_rarity'],
                });
            }
        }
        if (result === null) {
            filteredCount++;
            metrics.recordRarityValidation(false, true);
        } else {
            validated.push(result);
            if (result.confidence > detection.confidence) {
                metrics.recordRarityValidation(true, false);
            } else {
                metrics.recordRarityValidation(false, false);
            }
        }
        if (index % 5 === 0 || index === detections.length - 1) {
            updateValidatorStageProgress(
                'verification_filtering',
                {
                    metadata: {
                        keptCount: validated.length,
                        filteredCount,
                    },
                    inputCount: detections.length,
                    outputCount: validated.length,
                },
                `Validated ${index + 1}/${detections.length} detections`
            );
        }
    });
    metrics.recordValidationTime(performance.now() - validationStartTime);
    return validated;
}

/**
 * Annotate detections with stack count information
 */
function annotateStackCounts(detections: CVDetectionResult[], imageData: ImageData, screenHeight: number): void {
    let completed = 0;
    for (const detection of detections) {
        if (!detection.position) continue;
        const { x, y, width: cellW, height: cellH } = detection.position;
        if (hasCountOverlay(imageData, x, y, cellW, cellH, screenHeight)) {
            const countResult = detectCount(imageData, x, y, cellW, cellH, screenHeight);
            if (countResult.count > 1 && countResult.confidence > 0.5) {
                const det = detection as CVDetectionResult & { stackCount?: number; countConfidence?: number };
                det.stackCount = countResult.count;
                det.countConfidence = countResult.confidence;
                const slotId = `${x}:${y}:${cellW}:${cellH}`;
                upsertSlotTrace(slotId, {
                    status: 'count_adjusted',
                    countEvidence: {
                        count: countResult.count,
                        confidence: countResult.confidence,
                        rawText: countResult.rawText,
                        method: countResult.method,
                    },
                });
            }
        }
        completed++;
        updateValidatorStageProgress(
            'count_ocr',
            {
                metadata: {
                    ocrSlotsDone: completed,
                    ocrSlotsTotal: detections.length,
                },
                inputCount: detections.length,
                outputCount: completed,
            },
            `OCR ${completed}/${detections.length}`
        );
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
        logger.warn({
            operation: 'cv.detect_concurrent_rejected',
            data: { message: 'CV detection already in progress' },
        });
        return [];
    }
    setCVDetectionInProgress(true);

    const metrics = getMetricsCollector();
    const runStartTime = performance.now();

    try {
        progressCallback?.(0, 'Loading image...');
        startValidatorStage('template_readiness');

        if (!isPriorityTemplatesLoaded()) {
            progressCallback?.(5, 'Loading item templates...');
            await loadItemTemplates();
        }
        endValidatorStage('template_readiness', {
            metadata: {
                readiness: getTemplateReadinessState(),
            },
        });

        const imageHash = hashImageDataUrl(imageDataUrl);
        const requestedCacheKey = buildDetectionCacheKey(imageHash, useWorkers);
        updateValidatorTraceMetadata({
            cacheKey: requestedCacheKey,
            cacheHit: false,
            detectionMode: useWorkers ? 'worker' : 'main',
            requestedWorkerMode: useWorkers,
        });
        startValidatorStage('cache_lookup');
        updateValidatorStageProgress(
            'cache_lookup',
            {
                metadata: {
                    cacheKey: requestedCacheKey,
                    cacheHit: false,
                },
            },
            'Checking detection cache'
        );
        const cachedResults = getCachedResults(requestedCacheKey);
        if (cachedResults) {
            updateValidatorTraceMetadata({
                cacheHit: true,
                cacheKey: requestedCacheKey,
            });
            endValidatorStage('cache_lookup', {
                metadata: {
                    cacheKey: requestedCacheKey,
                    cacheHit: true,
                },
                inputCount: cachedResults.length,
                outputCount: cachedResults.length,
            });
            logger.info({
                operation: 'cv.cache_hit',
                data: { imageHash, resultCount: cachedResults.length, cacheKey: requestedCacheKey },
            });
            progressCallback?.(100, 'Loaded from cache (instant)');
            return cachedResults;
        }
        endValidatorStage('cache_lookup', {
            metadata: {
                cacheKey: requestedCacheKey,
                cacheHit: false,
            },
            inputCount: 0,
            outputCount: 0,
        });

        if (useWorkers && typeof Worker === 'undefined') {
            const fallbackCacheKey = buildDetectionCacheKey(imageHash, false);
            const fallbackCachedResults = getCachedResults(fallbackCacheKey);
            if (fallbackCachedResults) {
                updateValidatorTraceMetadata({
                    cacheHit: true,
                    cacheKey: fallbackCacheKey,
                    detectionMode: 'main',
                });
                logger.info({
                    operation: 'cv.cache_hit',
                    data: {
                        imageHash,
                        resultCount: fallbackCachedResults.length,
                        cacheKey: fallbackCacheKey,
                        fallback: true,
                    },
                });
                progressCallback?.(100, 'Loaded from main-thread cache (instant)');
                return fallbackCachedResults;
            }
        }

        const itemTemplates = getItemTemplates();
        startValidatorStage('image_load');
        const { ctx, width, height } = await loadImageToCanvas(imageDataUrl);
        updateValidatorStageProgress(
            'image_load',
            {
                metadata: {
                    imageWidth: width,
                    imageHeight: height,
                },
            },
            'Image loaded into canvas'
        );
        endValidatorStage('image_load', {
            metadata: {
                width,
                height,
            },
        });
        const resolution = detectResolution(width, height);
        updateValidatorTraceMetadata({
            imageWidth: width,
            imageHeight: height,
            templateReadiness: getTemplateReadinessState(),
            templateCount: itemTemplates.size,
        });
        metrics.startRun(width, height, resolution.category);

        const selectedStrategies = selectStrategiesForImage(width, height);
        const resolutionTier = getResolutionTier(width, height);
        updateValidatorTraceMetadata({
            pipelineConfig: {
                resolutionTier,
                selectedStrategies,
                dynamicThreshold: getDynamicMinConfidence(width, height),
                requestedMode: useWorkers ? 'worker' : 'main',
            },
        });
        logger.info({
            operation: 'cv.strategy_selection',
            data: { resolutionTier, selectedStrategies, dynamicThreshold: getDynamicMinConfidence(width, height) },
        });

        progressCallback?.(15, 'Analyzing image structure...');
        const items = getAllData().items?.items || [];
        logger.info({
            operation: 'cv.detect_start',
            data: {
                imageWidth: width,
                imageHeight: height,
                templatesLoaded: itemTemplates.size,
                mode: 'sliding_window',
            },
        });

        startValidatorStage('candidate_generation');
        startValidatorStage('grid_detection');
        startValidatorStage('occupancy_filtering');
        const candidateRun = await gatherDetectionCandidates(ctx, width, height, items, useWorkers, progressCallback);
        updateValidatorTraceMetadata({
            detectionMode: candidateRun.usedWorkers ? 'worker' : 'main',
        });
        endValidatorStage('candidate_generation', {
            metadata: {
                mode: candidateRun.mode,
                usedWorkers: candidateRun.usedWorkers,
            },
            inputCount: items.length,
            outputCount: candidateRun.detections.length,
        });

        // Grid verification
        progressCallback?.(88, 'Verifying grid pattern...');
        startValidatorStage('grid_verification');
        const iconSizes = getAdaptiveIconSizes(width, height);
        const gridVerification = verifyGridPattern(candidateRun.detections, iconSizes[1] || 48);
        const verifiedDetections = gridVerification.isValid
            ? gridVerification.filteredDetections
            : candidateRun.detections;
        metrics.recordGridVerification(candidateRun.detections.length, verifiedDetections.length);
        if (gridVerification.isValid) {
            const verifiedKeys = new Set(
                verifiedDetections
                    .filter(detection => detection.position)
                    .map(
                        detection =>
                            `${detection.position!.x}:${detection.position!.y}:${detection.position!.width}:${detection.position!.height}`
                    )
            );

            for (const detection of candidateRun.detections) {
                if (!detection.position) continue;
                const slotId = `${detection.position.x}:${detection.position.y}:${detection.position.width}:${detection.position.height}`;
                if (verifiedKeys.has(slotId)) continue;

                addSlotCandidate(
                    slotId,
                    {
                        itemId: detection.entity.id,
                        itemName: detection.entity.name,
                        confidence: detection.confidence,
                        reason: 'filtered_by_grid',
                    },
                    true,
                    {
                        x: detection.position.x,
                        y: detection.position.y,
                        width: detection.position.width,
                        height: detection.position.height,
                    }
                );
                upsertSlotTrace(slotId, {
                    status: 'filtered',
                    notes: ['filtered_by_grid_verification'],
                });
            }
        }
        endValidatorStage('grid_verification', {
            status: gridVerification.isValid ? 'ok' : 'warning',
            metadata: {
                isValid: gridVerification.isValid,
                confidence: gridVerification.confidence,
                verifiedSlots: verifiedDetections.length,
                rejectedSlots: Math.max(0, candidateRun.detections.length - verifiedDetections.length),
            },
            inputCount: candidateRun.detections.length,
            outputCount: verifiedDetections.length,
        });

        // Context boosting + validation
        progressCallback?.(92, 'Applying context boosting...');
        const boostedDetections = boostConfidenceWithContext(verifiedDetections);
        progressCallback?.(96, 'Validating with border rarity...');
        startValidatorStage('verification_filtering');
        const validatedDetections = validateDetections(boostedDetections, ctx, metrics);
        endValidatorStage('verification_filtering', {
            metadata: {
                boosted: boostedDetections.length,
                validated: validatedDetections.length,
                keptCount: validatedDetections.length,
                filteredCount: Math.max(0, boostedDetections.length - validatedDetections.length),
            },
            inputCount: boostedDetections.length,
            outputCount: validatedDetections.length,
        });
        validatedDetections.forEach(detection => {
            if (!detection.position) return;
            const slotId = `${detection.position.x}:${detection.position.y}:${detection.position.width}:${detection.position.height}`;
            upsertSlotTrace(slotId, {
                status: 'matched',
                finalDetection: {
                    itemId: detection.entity.id,
                    itemName: detection.entity.name,
                    confidence: detection.confidence,
                    method: detection.method,
                },
            });
        });

        // Stack counts
        progressCallback?.(98, 'Detecting item counts...');
        startValidatorStage('count_ocr');
        updateValidatorStageProgress(
            'count_ocr',
            {
                metadata: {
                    ocrSlotsDone: 0,
                    ocrSlotsTotal: validatedDetections.length,
                },
                inputCount: validatedDetections.length,
                outputCount: 0,
            },
            'Preparing OCR count pass'
        );
        const imageData = ctx.getImageData(0, 0, width, height);
        annotateStackCounts(validatedDetections, imageData, height);
        endValidatorStage('count_ocr', {
            inputCount: validatedDetections.length,
            outputCount: validatedDetections.length,
        });

        progressCallback?.(100, 'Smart detection complete');

        // Logging
        const logData: Record<string, unknown> = {
            detectionsCount: validatedDetections.length,
            hotbarDetections: candidateRun.hotbarDetections,
            equipmentDetections: candidateRun.equipmentDetections,
            mode: candidateRun.mode,
            gridUsed: candidateRun.gridUsed,
            usedWorkers: candidateRun.usedWorkers,
        };
        if (validatedDetections.length === 0) {
            logData.debugHint = 'No icons detected - ensure screenshot shows game UI with item icons';
            logData.suggestion = 'Try taking screenshot during gameplay with hotbar visible';
        } else {
            logData.detectedItems = validatedDetections.slice(0, 5).map(d => d.entity.name);
        }
        logger.info({ operation: 'cv.detect_items_smart', data: logData });

        startValidatorStage('dedupe_finalization');
        updateValidatorStageProgress(
            'dedupe_finalization',
            {
                metadata: {
                    detectionsIn: validatedDetections.length,
                    detectionsOut: validatedDetections.length,
                },
                inputCount: validatedDetections.length,
                outputCount: validatedDetections.length,
            },
            'Caching and finalizing results'
        );
        const effectiveCacheKey = buildDetectionCacheKey(imageHash, candidateRun.usedWorkers);
        cacheResults(effectiveCacheKey, validatedDetections);
        logActiveLearning(validatedDetections);
        metrics.endRun(performance.now() - runStartTime);
        endValidatorStage('dedupe_finalization', {
            metadata: {
                cacheKey: effectiveCacheKey,
                cached: true,
                resultCount: validatedDetections.length,
            },
            inputCount: validatedDetections.length,
            outputCount: validatedDetections.length,
        });

        return validatedDetections;
    } catch (error) {
        logger.error({
            operation: 'cv.detect_items',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
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
