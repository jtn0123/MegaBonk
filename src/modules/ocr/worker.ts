// ========================================
// Tesseract Worker Management
// ========================================
// Handles lazy loading and lifecycle of Tesseract.js workers

import { logger } from '../logger.ts';

// Lazy-loaded Tesseract module reference
let tesseractModule: typeof import('tesseract.js') | null = null;

// Track active Tesseract workers for cleanup
let activeWorker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null = null;
let workerInitPromise: Promise<void> | null = null;

/**
 * Lazy load Tesseract.js only when needed
 * This reduces initial bundle size since OCR may not be used in every session
 */
export async function getTesseract(): Promise<typeof import('tesseract.js')> {
    if (!tesseractModule) {
        logger.info({
            operation: 'ocr.lazy_load',
            data: { module: 'tesseract.js', phase: 'start' },
        });
        tesseractModule = await import('tesseract.js');
        logger.info({
            operation: 'ocr.lazy_load',
            data: { module: 'tesseract.js', phase: 'complete' },
        });
    }
    return tesseractModule;
}

/**
 * Get or create a reusable Tesseract worker
 * Workers are expensive to create, so we reuse them
 * Bug fix: Use mutex pattern to prevent race condition where multiple
 * concurrent calls could create multiple workers
 */
export async function getOrCreateWorker(): Promise<Awaited<ReturnType<typeof import('tesseract.js').createWorker>>> {
    // If worker exists and is ready, return it
    if (activeWorker) {
        return activeWorker;
    }

    // Bug fix: If initialization is in progress, wait for it and return the result
    // This prevents multiple concurrent callers from each creating their own worker
    if (workerInitPromise) {
        await workerInitPromise;
        // After awaiting, worker should be ready (or failed)
        if (activeWorker) {
            return activeWorker;
        }
        // If still no worker after waiting, fall through to create new one
        // This handles the case where previous initialization failed
    }

    // Create the initialization promise BEFORE any async operations
    // This ensures concurrent callers will see the promise and wait
    const Tesseract = await getTesseract();

    // Double-check after async operation - another caller may have created the worker
    if (activeWorker) {
        return activeWorker;
    }

    // Create initialization promise that will be awaited by concurrent callers
    workerInitPromise = (async () => {
        // Triple-check inside the promise to handle edge cases
        if (activeWorker) {
            return;
        }

        logger.info({
            operation: 'ocr.worker_init',
            data: { phase: 'start' },
        });

        try {
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: (info: { status: string; progress: number }) => {
                    if (info.status === 'loading tesseract core' || info.status === 'initializing api') {
                        logger.debug({
                            operation: 'ocr.worker_progress',
                            data: { status: info.status, progress: info.progress },
                        });
                    }
                },
            });

            // Only assign if still no active worker (prevent overwriting)
            if (!activeWorker) {
                activeWorker = worker;
            } else {
                // Another caller won the race, terminate the duplicate
                await worker.terminate();
            }

            logger.info({
                operation: 'ocr.worker_init',
                data: { phase: 'complete' },
            });
        } catch (error) {
            logger.error({
                operation: 'ocr.worker_init',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                    module: 'ocr',
                },
            });
            throw error;
        }
    })();

    try {
        await workerInitPromise;
    } finally {
        // Always clear the promise when done, even on error
        workerInitPromise = null;
    }

    if (!activeWorker) {
        throw new Error('Failed to initialize OCR worker');
    }

    return activeWorker;
}

/**
 * Terminate the Tesseract worker to free memory
 * Call this when OCR is no longer needed
 */
export async function terminateOCRWorker(): Promise<void> {
    if (activeWorker) {
        logger.info({
            operation: 'ocr.worker_terminate',
            data: { phase: 'start' },
        });

        try {
            await activeWorker.terminate();
            activeWorker = null;
            workerInitPromise = null;

            logger.info({
                operation: 'ocr.worker_terminate',
                data: { phase: 'complete' },
            });
        } catch (error) {
            logger.warn({
                operation: 'ocr.worker_terminate',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                    module: 'ocr',
                },
            });
            // Force cleanup even if terminate fails
            activeWorker = null;
            workerInitPromise = null;
        }
    }
}

/**
 * Check if OCR worker is currently active
 */
export function isOCRWorkerActive(): boolean {
    return activeWorker !== null;
}

/**
 * Reset worker state (for testing)
 */
export function __resetWorkerForTesting(): void {
    activeWorker = null;
    workerInitPromise = null;
}
