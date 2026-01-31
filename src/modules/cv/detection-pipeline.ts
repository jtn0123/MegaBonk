// ========================================
// Detection Pipeline - Main Flow & Orchestration
// ========================================

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';
import { detectResolution } from '../test-utils.ts';
import type { CVDetectionResult, ROI, TemplateData } from './types.ts';
import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    isPriorityTemplatesLoaded,
} from './state.ts';
import { loadItemTemplates } from './templates.ts';
import {
    getDominantColor,
    getColorCandidates,
    isEmptyCell,
    calculateColorVariance,
} from './color.ts';
import { getTrainingTemplatesForItem, isTrainingDataLoaded } from './training.ts';
import { getMetricsCollector } from './metrics.ts';
import {
    selectStrategiesForImage,
    getStrategy,
    combineStrategyDetections,
    getEnsembleConfig,
    type StrategyId,
    type StrategyDetection,
    type EnsembleResult,
} from './ensemble-detector.ts';
import { getResolutionTier } from './resolution-profiles.ts';
import { findUncertainDetections, shouldPromptForLearning } from './active-learning.ts';
import { shouldSkipTemplate } from './template-ranking.ts';
import { detectCount, hasCountOverlay } from './count-detection.ts';
import { getScoringConfig } from './scoring-config.ts';

// Import from detection-config
import {
    getDynamicMinConfidence,
    getWorkerPath,
    isCVDetectionInProgress,
    setCVDetectionInProgress,
} from './detection-config.ts';

// Import from detection-utils
import {
    nonMaxSuppression,
    extractIconRegion,
    extractCountRegion,
    hashImageDataUrl,
} from './detection-utils.ts';

// Import from detection-grid
import {
    detectHotbarRegion,
    detectIconEdges,
    inferGridFromEdges,
    generateGridROIs,
    getAdaptiveIconSizes,
    verifyGridPattern,
    type GridParameters,
} from './detection-grid.ts';

// Import from detection-matching
import {
    calculateSimilarity,
    matchTemplate,
    matchTemplateMulti,
    findBestTemplateMatch,
} from './detection-matching.ts';

// Import from detection-processing
import {
    loadImageToCanvas,
    getCachedResults,
    cacheResults,
    boostConfidenceWithContext,
    validateWithBorderRarity,
} from './detection-processing.ts';

// ========================================
// Worker Result Interface
// ========================================

/** Result from template matching worker */
interface WorkerMatchResult {
    itemId: string;
    similarity: number;
    position: ROI;
}

// ========================================
// Two-Phase Grid Detection
// ========================================

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
    // Use dynamic threshold based on resolution (width/height available from ctx)
    const { minConfidence = getDynamicMinConfidence(width, height), progressCallback } = options;
    const metrics = getMetricsCollector();
    const gridStartTime = performance.now();

    // Phase 1: Detect grid structure
    if (progressCallback) {
        progressCallback(20, 'Phase 1: Detecting grid structure...');
    }

    const hotbarRegion = detectHotbarRegion(ctx, width, height);
    const edges = detectIconEdges(ctx, width, hotbarRegion);
    const grid = inferGridFromEdges(edges, hotbarRegion, width);

    metrics.recordGridDetectionTime(performance.now() - gridStartTime);

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
        const failureReason = !grid ? 'no_grid' : grid.confidence < 0.4 ? 'low_confidence' : 'too_few_columns';
        logger.info({
            operation: 'cv.two_phase.fallback_to_sliding_window',
            data: { reason: failureReason },
        });
        metrics.recordTwoPhaseAttempt(false, failureReason, grid?.confidence || 0, 0);
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
        if (!cell) continue; // TypeScript guard

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

        // Color-based pre-filtering using adjacent colors
        const cellColor = getDominantColor(cellData);
        const colorsToCheck = getColorCandidates(cellColor);

        // Gather candidates from exact match and adjacent colors
        const candidateItems: Item[] = [];
        const seenIds = new Set<string>();
        let usedExactMatch = false;

        for (const color of colorsToCheck) {
            const colorItems = templatesByColor.get(color) || [];
            if (color === cellColor && colorItems.length > 0) {
                usedExactMatch = true;
            }
            for (const item of colorItems) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    candidateItems.push(item);
                }
            }
        }

        const itemsToCheck = candidateItems.length > 0 ? candidateItems : items.slice(0, 30);
        const usedAdjacent = !usedExactMatch && candidateItems.length > 0;

        // Record color filter metrics
        metrics.recordColorFilter(usedExactMatch, usedAdjacent, itemsToCheck.length);

        // Match against candidate templates
        const bestMatch = findBestTemplateMatch(ctx, cell, itemsToCheck, minConfidence, useMultiTemplate);

        if (bestMatch) {
            detections.push({
                type: 'item',
                entity: bestMatch.item,
                confidence: bestMatch.similarity,
                position: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
                method: 'template_match',
            });
            // Record detection metrics
            metrics.recordDetection(bestMatch.similarity, bestMatch.item.rarity);
        }
    }

    const templateMatchingTime = performance.now() - gridStartTime - (metrics.isEnabled() ? 0 : 0);
    metrics.recordTemplateMatchingTime(templateMatchingTime);

    logger.info({
        operation: 'cv.two_phase.complete',
        data: {
            detections: detections.length,
            cellsScanned: gridCells.length,
        },
    });

    // Record successful two-phase attempt
    metrics.recordTwoPhaseAttempt(true, null, grid.confidence, gridCells.length);

    return { detections, gridUsed: true, grid };
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
        minConfidence: getDynamicMinConfidence(width, height), // Dynamic threshold
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
            return new Promise<WorkerMatchResult[]>(resolve => {
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
// Ensemble Detection
// ========================================

/**
 * Run ensemble detection with multiple strategies
 * Combines results from different strategies for better accuracy
 * @internal Reserved for future ensemble-based detection enhancements
 */
export async function runEnsembleDetection(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    _items: Item[],
    cell: ROI,
    _progressCallback?: (progress: number, status: string) => void
): Promise<EnsembleResult | null> {
    const strategies = selectStrategiesForImage(width, height);
    const config = getEnsembleConfig();
    const strategyDetections: StrategyDetection[] = [];

    // Run each strategy
    for (const strategyId of strategies) {
        const strategy = getStrategy(strategyId);
        const threshold = strategy.minConfidence ?? getDynamicMinConfidence(width, height);

        // Match against templates
        const itemTemplates = getItemTemplates();
        let bestMatch: { itemId: string; confidence: number; templateId: string } | null = null;

        for (const [itemId, template] of itemTemplates) {
            // Check template ranking - skip poor performers if enabled
            if (strategy.templates.skipPoorPerformers && shouldSkipTemplate(`${itemId}_primary`)) {
                continue;
            }

            const similarity = matchTemplate(ctx, cell, template, itemId);

            if (similarity > threshold && (!bestMatch || similarity > bestMatch.confidence)) {
                bestMatch = {
                    itemId,
                    confidence: similarity,
                    templateId: `${itemId}_primary`,
                };
            }
        }

        if (bestMatch) {
            strategyDetections.push({
                strategyId,
                itemId: bestMatch.itemId,
                confidence: bestMatch.confidence * strategy.weight,
                position: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
                templateId: bestMatch.templateId,
            });

            // Early exit if confidence is very high
            if (bestMatch.confidence >= config.earlyExitThreshold) {
                break;
            }
        }
    }

    if (strategyDetections.length === 0) {
        return null;
    }

    // Combine strategy results
    return combineStrategyDetections(
        strategyDetections,
        { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
        config
    );
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
            const { detectGridPositions } = await import('./detection-grid.ts');
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

// ========================================
// Item Count Detection (OCR)
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
            // Note: For simple Tesseract.recognize(), parameters like pageseg_mode
            // need to be passed differently. Using default settings for simplicity.
            // TODO: For better OCR accuracy, use createWorker with setParameters
            const result = await Tesseract.recognize(countCanvas.toDataURL(), 'eng');

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

// ========================================
// Metrics Export for UI/Debugging
// ========================================

/**
 * Get CV detection metrics for UI display
 * Returns run history and aggregated stats
 */
export function getCVMetrics(): {
    runs: ReturnType<typeof getMetricsCollector>['getRuns'] extends () => infer R ? R : never;
    aggregated: ReturnType<typeof getMetricsCollector>['getAggregatedMetrics'] extends () => infer R ? R : never;
    enabled: boolean;
} {
    const collector = getMetricsCollector();
    return {
        runs: collector.getRuns(),
        aggregated: collector.getAggregatedMetrics(),
        enabled: collector.isEnabled(),
    };
}

/**
 * Get current detection configuration for debugging
 */
export function getDetectionConfig(
    width?: number,
    height?: number
): {
    dynamicThreshold: number;
    resolutionTier: string;
    selectedStrategies: StrategyId[];
    scoringConfig: ReturnType<typeof getScoringConfig>;
} {
    const tier = width && height ? getResolutionTier(width, height) : 'medium';
    const strategies = width && height ? selectStrategiesForImage(width, height) : ['default' as StrategyId];

    return {
        dynamicThreshold: getDynamicMinConfidence(width, height),
        resolutionTier: tier,
        selectedStrategies: strategies,
        scoringConfig: getScoringConfig(),
    };
}

/**
 * Get uncertain detections from last run for active learning UI
 */
export function getUncertainDetectionsFromResults(
    detections: CVDetectionResult[]
): ReturnType<typeof findUncertainDetections> {
    // Convert CVDetectionResult to DetectionForFeedback format
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
    return findUncertainDetections(feedbackDetections);
}

/**
 * Reset detection state for testing
 * @internal
 */
export function __resetDetectionStateForTesting(): void {
    setCVDetectionInProgress(false);
}
