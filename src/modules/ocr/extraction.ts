// ========================================
// Text Extraction from Images
// ========================================
// Core OCR functionality using Tesseract.js

import { logger } from '../logger.ts';
import { getOrCreateWorker, terminateOCRWorker } from './worker.ts';
import { withTimeout, sleep, OCR_TIMEOUT_MS, OCR_MAX_RETRIES } from './utils.ts';
import type { OCRProgressCallback } from './types.ts';

/**
 * Extract text from image using Tesseract OCR
 * Includes timeout protection and retry logic
 * Tesseract is lazy-loaded on first use
 */
async function attemptRecognition(
    imageDataUrl: string,
    progressCallback: OCRProgressCallback | undefined,
    timeoutMs: number
): Promise<string> {
    const worker = await getOrCreateWorker();

    let lastProgress = 0;
    const progressInterval = progressCallback
        ? setInterval(() => {
              if (lastProgress < 90) {
                  lastProgress += 10;
                  progressCallback(lastProgress, `Recognizing text... ${lastProgress}%`);
              }
          }, 500)
        : null;

    try {
        const recognizePromise = worker.recognize(imageDataUrl);
        const result = await withTimeout(recognizePromise, timeoutMs, 'OCR recognition');
        return result.data.text;
    } finally {
        if (progressInterval) clearInterval(progressInterval);
    }
}

export async function extractTextFromImage(
    imageDataUrl: string,
    progressCallback?: OCRProgressCallback,
    timeoutMs: number = OCR_TIMEOUT_MS,
    maxRetries: number = OCR_MAX_RETRIES
): Promise<string> {
    let lastError: Error | null = null;

    if (progressCallback) {
        progressCallback(0, 'Loading OCR engine...');
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            logger.info({
                operation: 'ocr.extract_text',
                data: { phase: 'start', attempt: attempt + 1, maxRetries: maxRetries + 1 },
            });

            if (attempt > 0 && progressCallback) {
                progressCallback(0, `Retrying OCR (attempt ${attempt + 1}/${maxRetries + 1})...`);
            }

            const extractedText = await attemptRecognition(imageDataUrl, progressCallback, timeoutMs);

            logger.info({
                operation: 'ocr.extract_text',
                data: {
                    phase: 'complete',
                    attempt: attempt + 1,
                    textLength: extractedText.length,
                    textPreview: extractedText.substring(0, 500).replaceAll('\n', ' | '),
                },
            });

            return extractedText;
        } catch (error) {
            lastError = error as Error;

            logger.warn({
                operation: 'ocr.extract_text',
                data: {
                    phase: 'retry',
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1,
                    willRetry: attempt < maxRetries,
                },
                error: {
                    name: lastError.name,
                    message: lastError.message,
                    module: 'ocr',
                },
            });

            // If worker failed, terminate it so a fresh one is created on retry
            if (lastError.message.includes('worker') || lastError.message.includes('timeout')) {
                await terminateOCRWorker();
            }

            // Don't sleep after the last attempt
            if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s...
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
                await sleep(backoffMs);
            }
        }
    }

    // All retries exhausted
    logger.error({
        operation: 'ocr.extract_text',
        error: {
            name: lastError?.name || 'UnknownError',
            message: lastError?.message || 'OCR failed after all retries',
            module: 'ocr',
            retriable: false, // All retries have been exhausted
        },
    });

    throw lastError || new Error('OCR failed after all retries');
}
