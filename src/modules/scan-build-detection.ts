// ========================================
// MegaBonk Scan Build - Detection Module
// ========================================
// Handles OCR, CV, and hybrid detection
// ========================================

import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { autoDetectFromImage, type DetectionResult } from './ocr/index.ts';
import {
    detectItemsWithCV,
    combineDetections,
    aggregateDuplicates,
    createDebugOverlay,
} from './computer-vision.ts';
import { setLastOverlayUrl, updateStats, updateLogViewer, isDebugEnabled } from './debug-ui.ts';
import { createProgressIndicator } from './dom-utils.ts';
import { logError, logWarning } from './error-utils.ts';
import type { Mutex } from './async-utils.ts';

// Re-export DetectionResult for consumers
export type { DetectionResult };

/**
 * Result structure from detection operations
 */
export interface DetectionResults {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
}

/**
 * Combine OCR and CV detection results into unified hybrid results
 */
export function combineHybridResults(
    ocrResults: Awaited<ReturnType<typeof autoDetectFromImage>>,
    cvResults: Awaited<ReturnType<typeof detectItemsWithCV>>
): DetectionResults & { rawText: string } {
    // Convert CV results to OCR format
    const cvAsOCR: DetectionResult[] = cvResults.map(cv => ({
        type: cv.type,
        entity: cv.entity,
        confidence: cv.confidence,
        rawText: `cv_detected_${cv.entity.name}`,
    }));

    // Combine and aggregate items
    const combinedItems = combineDetections(
        [...ocrResults.items, ...cvAsOCR.filter(r => r.type === 'item')],
        cvResults.filter(r => r.type === 'item')
    );
    const combinedTomes = combineDetections(
        [...ocrResults.tomes, ...cvAsOCR.filter(r => r.type === 'tome')],
        cvResults.filter(r => r.type === 'tome')
    );

    const aggregatedItems = aggregateDuplicates(combinedItems);
    const aggregatedTomes = aggregateDuplicates(combinedTomes);

    // Determine character (OCR takes priority, fallback to CV)
    let character: DetectionResult | null = ocrResults.character;
    if (!character) {
        const charResult = cvResults.find(r => r.type === 'character');
        if (charResult) {
            character = {
                type: 'character' as const,
                entity: charResult.entity,
                confidence: charResult.confidence,
                rawText: 'hybrid_cv',
            };
        }
    }

    // Determine weapon (OCR takes priority, fallback to CV)
    let weapon: DetectionResult | null = ocrResults.weapon;
    if (!weapon) {
        const weaponResult = cvResults.find(r => r.type === 'weapon');
        if (weaponResult) {
            weapon = {
                type: 'weapon' as const,
                entity: weaponResult.entity,
                confidence: weaponResult.confidence,
                rawText: 'hybrid_cv',
            };
        }
    }

    return {
        items: aggregatedItems.map(r => ({
            type: r.type as 'item',
            entity: r.entity,
            confidence: r.confidence,
            rawText: `hybrid_${r.method}`,
            count: r.count,
        })),
        tomes: aggregatedTomes.map(r => ({
            type: r.type as 'tome',
            entity: r.entity,
            confidence: r.confidence,
            rawText: `hybrid_${r.method}`,
            count: r.count,
        })),
        character,
        weapon,
        rawText: 'hybrid_detection',
    };
}

/**
 * Display debug overlay if debug mode is enabled
 */
export async function displayDebugOverlay(
    image: string,
    cvResults: Awaited<ReturnType<typeof detectItemsWithCV>>,
    hybridResults: { items: DetectionResult[]; tomes: DetectionResult[] }
): Promise<void> {
    if (isDebugEnabled()) {
        const debugOverlayUrl = await createDebugOverlay(image, cvResults);
        setLastOverlayUrl(debugOverlayUrl);

        const imagePreview = document.getElementById('scan-image-preview');
        if (imagePreview) {
            imagePreview.innerHTML = `
                <img src="${debugOverlayUrl}" alt="Debug Overlay" style="max-width: 100%; border-radius: 8px;" />
                <p style="text-align: center; margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                    Debug Mode: Green=High confidence, Orange=Medium, Red=Low
                </p>
            `;
        }
        ToastManager.success(
            `Hybrid Detection: ${hybridResults.items.length} items, ${hybridResults.tomes.length} tomes (Debug overlay shown)`
        );
    } else {
        setLastOverlayUrl(null);
        ToastManager.success(
            `Hybrid Detection: ${hybridResults.items.length} items, ${hybridResults.tomes.length} tomes (Enhanced accuracy!)`
        );
    }
}

/**
 * Handle auto-detect (OCR only) with CV fallback
 */
export async function runAutoDetect(
    uploadedImage: string,
    detectionMutex: Mutex,
    onResults: (results: DetectionResults) => void
): Promise<void> {
    // Race condition fix: Prevent concurrent detection runs using mutex
    if (!detectionMutex.tryAcquire()) {
        ToastManager.info('Detection already in progress...');
        return;
    }

    // Create progress indicator before try block to ensure cleanup in finally
    const progress = createProgressIndicator('Initializing...');
    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.appendChild(progress.element);
    }

    try {
        ToastManager.info('Starting auto-detection...');

        // Run OCR
        const results = await autoDetectFromImage(uploadedImage, (pct, status) => {
            progress.update(pct, status);
        });

        // If OCR found nothing, try CV as fallback
        if (results.items.length === 0 && results.tomes.length === 0) {
            logger.info({
                operation: 'scan_build.ocr_empty_trying_cv',
                data: { message: 'OCR found no items, trying icon detection' },
            });

            progress.update(50, 'Trying icon detection...');
            ToastManager.info('No text found, trying icon detection...');

            try {
                const cvResults = await detectItemsWithCV(uploadedImage, (pct, status) => {
                    progress.update(50 + pct * 0.5, status);
                });

                if (cvResults.length > 0) {
                    // Convert CV results to detection format
                    const cvItems = cvResults
                        .filter(r => r.type === 'item')
                        .map(r => ({
                            type: 'item' as const,
                            entity: r.entity,
                            confidence: r.confidence,
                            rawText: `cv_detected_${r.entity.name}`,
                        }));

                    onResults({
                        items: cvItems,
                        tomes: [],
                        character: null,
                        weapon: null,
                    });

                    ToastManager.success(`Detected ${cvResults.length} items via icon matching`);

                    logger.info({
                        operation: 'scan_build.cv_fallback_success',
                        data: { itemsDetected: cvResults.length },
                    });
                    return;
                }
            } catch (cvError) {
                logWarning('scan_build.cv_fallback_failed', cvError);
            }
        }

        // Apply detected items
        onResults(results);

        if (results.items.length === 0 && results.tomes.length === 0) {
            ToastManager.info('No items detected. Try Hybrid mode or a clearer screenshot.');
        } else {
            ToastManager.success(
                `Detected: ${results.items.length} items, ${results.tomes.length} tomes` +
                    (results.character ? ', 1 character' : '') +
                    (results.weapon ? ', 1 weapon' : '')
            );
        }

        logger.info({
            operation: 'scan_build.auto_detect_complete',
            data: {
                itemsDetected: results.items.length,
                tomesDetected: results.tomes.length,
                characterDetected: results.character ? 1 : 0,
                weaponDetected: results.weapon ? 1 : 0,
            },
        });
    } catch (error) {
        logError('scan_build.auto_detect_error', error);
        ToastManager.error(`Auto-detection failed: ${(error as Error).message}`);
    } finally {
        // Always clean up progress indicator and release lock
        progress.remove();
        detectionMutex.release();
    }
}

/**
 * Handle hybrid detect (OCR + CV)
 */
export async function runHybridDetect(
    uploadedImage: string,
    detectionMutex: Mutex,
    templatesLoaded: boolean,
    templatesLoadError: Error | null,
    onResults: (results: DetectionResults) => void
): Promise<void> {
    if (!detectionMutex.tryAcquire()) {
        ToastManager.info('Detection already in progress...');
        return;
    }

    if (!templatesLoaded && !templatesLoadError) {
        ToastManager.info('Item templates are still loading. Please wait a moment and try again.');
        detectionMutex.release();
        return;
    }

    if (templatesLoadError) {
        ToastManager.warning('Item templates failed to load. Detection accuracy may be reduced.');
        logWarning('scan_build.hybrid_detect_degraded', templatesLoadError);
    }

    const progress = createProgressIndicator('Initializing...');
    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.appendChild(progress.element);
    }

    try {
        ToastManager.info('Starting hybrid detection (OCR + Computer Vision)...');

        // Run OCR phase
        progress.update(10, 'Running OCR...');
        const ocrResults = await autoDetectFromImage(uploadedImage, (pct, status) => {
            progress.update(10 + pct * 0.4, status);
        });

        // Run CV phase
        progress.update(50, 'Running computer vision...');
        const cvResults = await detectItemsWithCV(uploadedImage, (pct, status) => {
            progress.update(50 + pct * 0.4, status);
        });

        // Combine results
        progress.update(90, 'Combining detections...');
        const hybridResults = combineHybridResults(ocrResults, cvResults);

        onResults(hybridResults);
        updateStats();
        updateLogViewer();

        await displayDebugOverlay(uploadedImage, cvResults, hybridResults);

        logger.info({
            operation: 'scan_build.hybrid_detect_complete',
            data: {
                itemsDetected: hybridResults.items.length,
                tomesDetected: hybridResults.tomes.length,
                characterDetected: hybridResults.character ? 1 : 0,
                weaponDetected: hybridResults.weapon ? 1 : 0,
                ocrItems: ocrResults.items.length,
                cvItems: cvResults.length,
            },
        });
    } catch (error) {
        logError('scan_build.hybrid_detect_error', error);
        ToastManager.error(`Hybrid detection failed: ${(error as Error).message}`);
    } finally {
        progress.remove();
        detectionMutex.release();
    }
}
