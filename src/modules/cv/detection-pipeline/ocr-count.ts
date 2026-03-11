// ========================================
// Detection Pipeline - OCR Count Detection
// ========================================

import type { ROI } from '../types.ts';
import { logger } from '../../logger.ts';
import { extractCountRegion } from '../detection-utils.ts';
import { loadImageToCanvas } from '../detection-processing.ts';
import { detectStackCountsBatch } from '../../ocr/index.ts';

/**
 * Extract count numbers from item cells using OCR
 * Returns a map of cell labels to counts
 */
export async function detectItemCounts(imageDataUrl: string, cells: ROI[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    // Load screenshot
    const { canvas: srcCanvas } = await loadImageToCanvas(imageDataUrl);

    const countRegionDataUrls = cells.map(cell => {
        const countROI = extractCountRegion(cell);
        const countCanvas = document.createElement('canvas');
        countCanvas.width = countROI.width;
        countCanvas.height = countROI.height;
        const countCtx = countCanvas.getContext('2d', { willReadFrequently: true });
        if (!countCtx) {
            throw new Error('Failed to get count canvas context');
        }

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

        return countCanvas.toDataURL();
    });

    try {
        const batchResults = await detectStackCountsBatch(countRegionDataUrls);
        batchResults.forEach((result, index) => {
            const cell = cells[index];
            if (!cell || result.count === null || result.count <= 1 || result.count > 20) {
                return;
            }
            counts.set(cell.label || '', result.count);
        });
    } catch (error) {
        logger.error({
            operation: 'cv.detect_count',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
    }

    return counts;
}
