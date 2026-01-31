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
import {
    getDynamicMinConfidence,
    isCVDetectionInProgress,
    setCVDetectionInProgress,
} from '../detection-config.ts';
import { hashImageDataUrl } from '../detection-utils.ts';
import {
    detectHotbarRegion,
    getAdaptiveIconSizes,
    verifyGridPattern,
    detectGridPositions,
} from '../detection-grid.ts';
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
 * Detect items using template matching against stored item icons
 * Uses smart sliding window detection to find icons anywhere on screen
 */
export async function detectItemsWithCV(
    imageDataUrl: string,
    progressCallback?: ProgressCallback,
    useWorkers: boolean = false
): Promise<CVDetectionResult[]> {
    // Race condition fix: Prevent concurrent CV detection runs
    // Multiple simultaneous calls would corrupt metrics and cause confusing progress updates
    if (isCVDetectionInProgress()) {
        logger.warn({
            operation: 'cv.detect_concurrent_rejected',
            data: { message: 'CV detection already in progress' },
        });
        // Return empty results rather than corrupt state
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

        // Start metrics collection for this run
        const resolution = detectResolution(width, height);
        metrics.startRun(width, height, resolution.category);

        // Select optimal detection strategies based on resolution
        const selectedStrategies = selectStrategiesForImage(width, height);
        const resolutionTier = getResolutionTier(width, height);
        logger.info({
            operation: 'cv.strategy_selection',
            data: {
                resolutionTier,
                selectedStrategies,
                dynamicThreshold: getDynamicMinConfidence(width, height),
            },
        });

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
            minConfidence: getDynamicMinConfidence(width, height),
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
                minConfidence: getDynamicMinConfidence(width, height),
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

        // Record grid verification metrics
        metrics.recordGridVerification(allDetections.length, verifiedDetections.length);

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
        const validationStartTime = performance.now();
        boostedDetections = boostedDetections
            .map(detection => {
                const validated = validateWithBorderRarity(detection, ctx, false);
                // Record validation result
                if (validated === null) {
                    metrics.recordRarityValidation(false, true);
                } else if (validated.confidence > detection.confidence) {
                    metrics.recordRarityValidation(true, false);
                } else {
                    metrics.recordRarityValidation(false, false);
                }
                return validated;
            })
            .filter((d): d is CVDetectionResult => d !== null);
        metrics.recordValidationTime(performance.now() - validationStartTime);

        // Detect item counts (stack sizes like x2, x3, x5)
        if (progressCallback) {
            progressCallback(98, 'Detecting item counts...');
        }
        const imageData = ctx.getImageData(0, 0, width, height);
        for (const detection of boostedDetections) {
            if (detection.position) {
                const { x, y, width: cellW, height: cellH } = detection.position;
                // Quick check if count overlay might exist
                if (hasCountOverlay(imageData, x, y, cellW, cellH, height)) {
                    const countResult = detectCount(imageData, x, y, cellW, cellH, height);
                    if (countResult.count > 1 && countResult.confidence > 0.5) {
                        // Add count to detection metadata
                        (
                            detection as CVDetectionResult & { stackCount?: number; countConfidence?: number }
                        ).stackCount = countResult.count;
                        (
                            detection as CVDetectionResult & { stackCount?: number; countConfidence?: number }
                        ).countConfidence = countResult.confidence;
                    }
                }
            }
        }

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

        // Active learning: flag uncertain detections for potential user feedback
        // Convert CVDetectionResult to DetectionForFeedback format
        const feedbackDetections = boostedDetections
            .filter(d => d.position) // Need position for feedback
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
                    totalDetections: boostedDetections.length,
                    topUncertain: uncertainDetections.slice(0, 3).map(u => ({
                        item: u.detection.detectedItemName,
                        confidence: u.detection.confidence.toFixed(2),
                        alternatives: u.alternatives.length,
                    })),
                },
            });
        }

        // End metrics run
        metrics.endRun(performance.now() - runStartTime);

        return boostedDetections;
    } catch (error) {
        logger.error({
            operation: 'cv.detect_items',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        // End metrics run even on error
        metrics.endRun(performance.now() - runStartTime);
        throw error;
    } finally {
        // Race condition fix: Always release lock when done
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
