// ========================================
// Detection Pipeline - OCR Count Detection
// ========================================

import type { ROI } from '../types.ts';
import { logger } from '../../logger.ts';
import { extractCountRegion } from '../detection-utils.ts';
import { loadImageToCanvas } from '../detection-processing.ts';

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
