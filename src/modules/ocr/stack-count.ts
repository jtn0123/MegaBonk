// ========================================
// Stack Count Detection
// ========================================
// Specialized OCR for detecting item stack counts (1-2 digit numbers)

import { logger } from '../logger.ts';
import { getOrCreateWorker } from './worker.ts';
import { preprocessForDigits, loadImage, createCanvasFromImage } from './preprocessing.ts';
import type { StackCountResult, TesseractResult } from './types.ts';

/**
 * Detect stack count from a small image region (bottom-right corner of item cell)
 * Optimized for detecting 1-2 digit numbers like "x2", "x5", "12"
 */
export async function detectStackCount(imageDataUrl: string): Promise<StackCountResult> {
    try {
        // Create canvas from image
        const img = await loadImage(imageDataUrl);
        const canvas = createCanvasFromImage(img);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
            return { count: null, confidence: 0, rawText: '' };
        }

        // Preprocess for better digit recognition
        const processedCanvas = preprocessForDigits(canvas);

        // Get worker and recognize with digit-only whitelist
        const worker = await getOrCreateWorker();

        // Configure for single word/digits mode
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789x×X',
            tessedit_pageseg_mode: 8 as unknown as import('tesseract.js').PSM, // PSM 8 = Single word
        });

        const result = (await worker.recognize(processedCanvas.toDataURL())) as TesseractResult;

        // Reset parameters for future calls
        await worker.setParameters({
            tessedit_char_whitelist: '',
            tessedit_pageseg_mode: 3 as unknown as import('tesseract.js').PSM, // Default: auto page segmentation
        });

        const rawText = result.data.text.trim();
        const confidence = result.data.confidence / 100;

        // Parse count from recognized text
        // Look for patterns: "x2", "×3", "5", "12"
        const countMatch = rawText.match(/[x×X]?(\d{1,2})/);
        let count: number | null = null;

        if (countMatch && countMatch[1]) {
            const parsed = parseInt(countMatch[1], 10);
            // Valid counts are typically 1-20 in MegaBonk
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
                count = parsed;
            }
        }

        logger.info({
            operation: 'ocr.stack_count',
            data: {
                rawText,
                count,
                confidence,
            },
        });

        return { count, confidence, rawText };
    } catch (error) {
        logger.warn({
            operation: 'ocr.stack_count',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'ocr',
            },
        });
        return { count: null, confidence: 0, rawText: '' };
    }
}

/**
 * Batch detect stack counts for multiple cell regions
 * More efficient than calling detectStackCount multiple times
 */
export async function detectStackCountsBatch(imageDataUrls: string[]): Promise<Map<number, StackCountResult>> {
    const results = new Map<number, StackCountResult>();

    // Process in parallel with a concurrency limit
    const concurrency = 3;
    for (let i = 0; i < imageDataUrls.length; i += concurrency) {
        const batch = imageDataUrls.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(url => detectStackCount(url)));

        batchResults.forEach((result, idx) => {
            results.set(i + idx, result);
        });
    }

    return results;
}
