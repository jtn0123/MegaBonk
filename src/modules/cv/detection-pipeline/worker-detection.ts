// ========================================
// Detection Pipeline - Worker-based Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import type { CVDetectionResult, ROI } from '../types.ts';
import { getItemTemplates } from '../state.ts';
import { getWorkerPath } from '../detection-config.ts';
import { extractIconRegion } from '../detection-utils.ts';
import type { WorkerMatchResult, ProgressCallback } from './types.ts';

/**
 * Detect items using Web Workers for parallel processing (optional)
 * Offloads template matching to workers to avoid blocking UI
 */
export async function detectItemsWithWorkers(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    items: Item[],
    progressCallback?: ProgressCallback
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
