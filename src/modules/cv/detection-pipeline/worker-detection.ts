// ========================================
// Detection Pipeline - Worker-based Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import type { CVDetectionResult, ROI } from '../types.ts';
import { getItemTemplates } from '../state.ts';
import { getWorkerPath } from '../detection-config.ts';
import { extractIconRegion } from '../detection-utils.ts';
import { endValidatorStage, updateValidatorStageProgress, upsertSlotTrace } from '../validator-trace.ts';
import type { WorkerMatchResult, ProgressCallback } from './types.ts';

const TEMPLATE_WORKER_COUNT = 4;
const TEMPLATE_WORKER_BATCH_TIMEOUT_MS = 15000;

/**
 * Detect items using Web Workers for parallel processing (optional)
 * Offloads template matching to workers to avoid blocking UI
 */
export async function detectItemsWithWorkers(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    items: Item[],
    progressCallback?: ProgressCallback,
    minConfidence: number = 0
): Promise<CVDetectionResult[]> {
    if (typeof Worker === 'undefined') {
        throw new Error('Template matching workers are not supported in this environment');
    }

    const itemTemplates = getItemTemplates();
    // Create worker pool (4 workers for parallel processing)
    const workers: Worker[] = [];
    const itemsById = new Map(items.map(item => [item.id, item] as const));
    // Track all batch cleanup functions so we can clean up all pending batches on early rejection
    const batchCleanups: Array<() => void> = [];

    try {
        endValidatorStage('grid_detection', {
            metadata: {
                success: true,
                mode: 'worker_grid',
                gridPositions: gridPositions.length,
            },
            inputCount: gridPositions.length,
            outputCount: gridPositions.length,
        });
        updateValidatorStageProgress(
            'candidate_generation',
            {
                metadata: {
                    slotsProcessed: 0,
                    slotsTotal: gridPositions.length,
                    candidateCount: 0,
                    workerBatchesPending: 0,
                },
                inputCount: gridPositions.length,
                outputCount: 0,
            },
            'Preparing worker batches'
        );

        // Initialize workers
        for (let i = 0; i < TEMPLATE_WORKER_COUNT; i++) {
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
        const batchSize = Math.max(1, Math.ceil(gridPositions.length / TEMPLATE_WORKER_COUNT));
        const batches: ROI[][] = [];

        for (let i = 0; i < gridPositions.length; i += batchSize) {
            batches.push(gridPositions.slice(i, i + batchSize));
        }

        // Send batches to workers and collect results
        let completedBatches = 0;
        let matchedCandidates = 0;
        const batchPromises = batches.map((batch, batchIndex) => {
            return new Promise<WorkerMatchResult[]>((resolve, reject) => {
                const worker = workers[batchIndex % TEMPLATE_WORKER_COUNT];
                if (!worker) {
                    reject(new Error(`No worker available for batch ${batchIndex}`));
                    return;
                }

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
                let timeoutId: ReturnType<typeof setTimeout> | null = null;
                const cleanup = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    worker.removeEventListener('message', handler);
                    worker.removeEventListener('error', errorHandler);
                };
                const handler = (e: MessageEvent) => {
                    if (e.data.type === 'BATCH_COMPLETE' && e.data.data.batchId === batchIndex) {
                        cleanup();
                        completedBatches += 1;
                        matchedCandidates += e.data.data.results.length;
                        updateValidatorStageProgress(
                            'candidate_generation',
                            {
                                metadata: {
                                    slotsProcessed: Math.min(gridPositions.length, completedBatches * batchSize),
                                    slotsTotal: gridPositions.length,
                                    candidateCount: matchedCandidates,
                                    workerBatchesPending: Math.max(0, batches.length - completedBatches),
                                },
                                inputCount: gridPositions.length,
                                outputCount: matchedCandidates,
                            },
                            `Worker batches ${completedBatches}/${batches.length}`
                        );
                        resolve(e.data.data.results);
                    }
                };
                const errorHandler = (event: ErrorEvent) => {
                    cleanup();
                    reject(new Error(event.message || `Worker batch ${batchIndex} failed`));
                };

                worker.addEventListener('message', handler);
                worker.addEventListener('error', errorHandler);
                batchCleanups.push(cleanup);
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(
                        new Error(`Worker batch ${batchIndex} timed out after ${TEMPLATE_WORKER_BATCH_TIMEOUT_MS}ms`)
                    );
                }, TEMPLATE_WORKER_BATCH_TIMEOUT_MS);

                // Send batch to worker
                try {
                    worker.postMessage({
                        type: 'MATCH_BATCH',
                        data: {
                            batchId: batchIndex,
                            cells,
                            templates: templateData,
                        },
                    });
                } catch (error) {
                    cleanup();
                    reject(error as Error);
                }
            });
        });

        // Wait for all batches to complete
        if (progressCallback) {
            progressCallback(60, 'Processing with workers...');
        }
        updateValidatorStageProgress(
            'candidate_generation',
            {
                metadata: {
                    slotsProcessed: 0,
                    slotsTotal: gridPositions.length,
                    candidateCount: 0,
                    workerBatchesPending: batches.length,
                    usedWorkers: true,
                    mode: 'worker_grid',
                },
                inputCount: gridPositions.length,
                outputCount: 0,
            },
            'Worker candidate generation started'
        );

        const allResults = await Promise.all(batchPromises);

        // Flatten results
        const flatResults = allResults.flat();

        // Convert to CVDetectionResult format
        const detections: CVDetectionResult[] = flatResults
            .map(result => {
                if (result.similarity < minConfidence) {
                    const slotId =
                        result.position.label ||
                        `${result.position.x}:${result.position.y}:${result.position.width}:${result.position.height}`;
                    upsertSlotTrace(slotId, {
                        label: result.position.label,
                        bounds: {
                            x: result.position.x,
                            y: result.position.y,
                            width: result.position.width,
                            height: result.position.height,
                        },
                        status: 'filtered',
                        notes: ['worker_candidate_below_threshold'],
                    });
                    return null;
                }

                const item = itemsById.get(result.itemId);
                if (!item) return null;

                const slotId =
                    result.position.label ||
                    `${result.position.x}:${result.position.y}:${result.position.width}:${result.position.height}`;
                upsertSlotTrace(slotId, {
                    label: result.position.label,
                    bounds: {
                        x: result.position.x,
                        y: result.position.y,
                        width: result.position.width,
                        height: result.position.height,
                    },
                    status: 'matched',
                    candidateCount: 1,
                    finalDetection: {
                        itemId: item.id,
                        itemName: item.name,
                        confidence: result.similarity,
                        method: 'template_match',
                    },
                });

                return {
                    type: 'item' as const,
                    entity: item,
                    confidence: result.similarity,
                    position: result.position,
                    method: 'template_match' as const,
                };
            })
            .filter(d => d !== null) as CVDetectionResult[];

        endValidatorStage('candidate_generation', {
            metadata: {
                mode: 'worker_grid',
                gridPositions: gridPositions.length,
                workerMatches: flatResults.length,
            },
            inputCount: gridPositions.length,
            outputCount: detections.length,
        });

        return detections;
    } finally {
        // Clean up all pending batch listeners before terminating workers
        batchCleanups.forEach(fn => fn());
        // Terminate all workers
        workers.forEach(w => w.terminate());
    }
}
