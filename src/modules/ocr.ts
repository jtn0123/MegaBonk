// ========================================
// MegaBonk OCR Module
// ========================================
// Handles text extraction from screenshots using Tesseract.js
// Tesseract is lazy-loaded to reduce initial bundle size
// ========================================

import type { AllGameData, Item, Tome, Character, Weapon } from '../types/index.ts';
import Fuse from 'fuse.js';
import { logger } from './logger.ts';

// Lazy-loaded Tesseract module reference
let tesseractModule: typeof import('tesseract.js') | null = null;

// Track active Tesseract workers for cleanup
let activeWorker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null = null;
let workerInitPromise: Promise<void> | null = null;

/**
 * Lazy load Tesseract.js only when needed
 * This reduces initial bundle size since OCR may not be used in every session
 */
async function getTesseract(): Promise<typeof import('tesseract.js')> {
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
 */
async function getOrCreateWorker(): Promise<Awaited<ReturnType<typeof import('tesseract.js').createWorker>>> {
    // If worker exists and is ready, return it
    if (activeWorker) {
        return activeWorker;
    }

    // If initialization is in progress, wait for it
    if (workerInitPromise) {
        await workerInitPromise;
        if (activeWorker) {
            return activeWorker;
        }
    }

    // Create new worker
    const Tesseract = await getTesseract();

    workerInitPromise = (async () => {
        logger.info({
            operation: 'ocr.worker_init',
            data: { phase: 'start' },
        });

        try {
            activeWorker = await Tesseract.createWorker('eng', 1, {
                logger: (info: { status: string; progress: number }) => {
                    if (info.status === 'loading tesseract core' || info.status === 'initializing api') {
                        logger.debug({
                            operation: 'ocr.worker_progress',
                            data: { status: info.status, progress: info.progress },
                        });
                    }
                },
            });

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

    await workerInitPromise;
    workerInitPromise = null;

    return activeWorker!;
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

// ========================================
// Type Definitions for Tesseract
// ========================================

/**
 * Tesseract recognition result (simplified type for our use case)
 */
interface TesseractResult {
    data: {
        text: string;
        confidence: number;
    };
}

// ========================================
// Constants
// ========================================

/** Default timeout for OCR operations (60 seconds) */
const OCR_TIMEOUT_MS = 60000;

/** Maximum retries for OCR operations */
const OCR_MAX_RETRIES = 2;

// OCR detection result
export interface DetectionResult {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: Item | Tome | Character | Weapon;
    confidence: number;
    rawText: string;
}

// OCR status callback
export type OCRProgressCallback = (progress: number, status: string) => void;

let itemFuse: Fuse<Item> | null = null;
let tomeFuse: Fuse<Tome> | null = null;
let characterFuse: Fuse<Character> | null = null;
let weaponFuse: Fuse<Weapon> | null = null;

/**
 * Initialize OCR module with game data
 */
export function initOCR(gameData: AllGameData): void {
    // Initialize Fuse.js for fuzzy matching
    const fuseOptions = {
        includeScore: true,
        threshold: 0.5, // 0 = perfect match, 1 = match anything (0.5 allows for OCR errors)
        keys: ['name'],
        ignoreLocation: true,
    };

    if (gameData.items?.items) {
        itemFuse = new Fuse(gameData.items.items, fuseOptions);
    }

    if (gameData.tomes?.tomes) {
        tomeFuse = new Fuse(gameData.tomes.tomes, fuseOptions);
    }

    if (gameData.characters?.characters) {
        characterFuse = new Fuse(gameData.characters.characters, fuseOptions);
    }

    if (gameData.weapons?.weapons) {
        weaponFuse = new Fuse(gameData.weapons.weapons, fuseOptions);
    }

    logger.info({
        operation: 'ocr.init',
        data: {
            itemsIndexed: gameData.items?.items.length || 0,
            tomesIndexed: gameData.tomes?.tomes.length || 0,
            charactersIndexed: gameData.characters?.characters.length || 0,
            weaponsIndexed: gameData.weapons?.weapons.length || 0,
        },
    });
}

/**
 * Wrap a promise with a timeout
 * Rejects with TimeoutError if the promise doesn't resolve within the timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
            .then(result => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract text from image using Tesseract OCR
 * Includes timeout protection and retry logic
 * Tesseract is lazy-loaded on first use
 */
export async function extractTextFromImage(
    imageDataUrl: string,
    progressCallback?: OCRProgressCallback,
    timeoutMs: number = OCR_TIMEOUT_MS,
    maxRetries: number = OCR_MAX_RETRIES
): Promise<string> {
    let lastError: Error | null = null;

    // Initialize worker (reused across calls)
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

            // Get or create reusable worker
            const worker = await getOrCreateWorker();

            // Progress tracking for recognition
            let lastProgress = 0;
            const progressInterval = progressCallback
                ? setInterval(() => {
                      // Simulate progress since worker.recognize doesn't have progress callback
                      if (lastProgress < 90) {
                          lastProgress += 10;
                          progressCallback(lastProgress, `Recognizing text... ${lastProgress}%`);
                      }
                  }, 500)
                : null;

            // Use worker.recognize instead of Tesseract.recognize (reuses worker)
            const recognizePromise = worker.recognize(imageDataUrl);

            // Wrap with timeout to prevent indefinite waiting
            const result = (await withTimeout(recognizePromise, timeoutMs, 'OCR recognition')) as TesseractResult;

            // Clear progress interval
            if (progressInterval) {
                clearInterval(progressInterval);
            }

            const extractedText = result.data.text;

            logger.info({
                operation: 'ocr.extract_text',
                data: {
                    phase: 'complete',
                    attempt: attempt + 1,
                    textLength: extractedText.length,
                    confidence: result.data.confidence,
                    textPreview: extractedText.substring(0, 500).replace(/\n/g, ' | '),
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

/**
 * Split text into searchable segments (by newlines and common delimiters)
 */
function splitIntoSegments(text: string): string[] {
    // Split by newlines first
    const lines = text.split('\n');
    const segments: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length <= 2) continue;

        // If line is very long (e.g., repeated items), also split by common delimiters
        if (trimmed.length > 50) {
            // Split by common OCR/game delimiters: comma, semicolon, pipe, tab
            const subSegments = trimmed.split(/[,;|\t]+/);
            for (const seg of subSegments) {
                const segTrimmed = seg.trim();
                if (segTrimmed.length > 2) {
                    segments.push(segTrimmed);
                }
            }
        } else {
            segments.push(trimmed);
        }
    }

    return segments;
}

/** Entity type for generic detection */
type EntityWithId = { id: string; name: string };

/** Options for the generic entity detection helper */
interface DetectEntitiesOptions {
    /** The entity type name (e.g., 'item', 'tome') */
    type: DetectionResult['type'];
    /** Whether to enable debug logging */
    debug?: boolean;
}

/**
 * Generic helper to detect entities from text using a Fuse index
 * Reduces code duplication across detectItemsFromText, detectTomesFromText, etc.
 */
function detectEntitiesFromText<T extends EntityWithId>(
    text: string,
    fuseInstance: Fuse<T> | null,
    options: DetectEntitiesOptions
): DetectionResult[] {
    if (!fuseInstance) return [];

    const segments = splitIntoSegments(text);
    const detections: DetectionResult[] = [];
    const seenEntities = new Set<string>();

    let bestUnmatchedScore = 1;
    let bestUnmatchedName = '';

    for (const segment of segments) {
        const results = fuseInstance.search(segment);
        const match = results[0];
        const score = match?.score;

        if (match && score !== undefined) {
            // Track best unmatched score for debugging
            if (options.debug && score >= 0.5 && score < bestUnmatchedScore) {
                bestUnmatchedScore = score;
                bestUnmatchedName = match.item.name;
            }

            // Only include matches with confidence > 50% (score < 0.5)
            if (score < 0.5 && !seenEntities.has(match.item.id)) {
                seenEntities.add(match.item.id);
                detections.push({
                    type: options.type,
                    // Type assertion through unknown: T extends EntityWithId includes Item/Tome/Character/Weapon
                    entity: match.item as unknown as Item | Tome | Character | Weapon,
                    confidence: 1 - score, // Fuse score is 0 (best) to 1 (worst), invert it
                    rawText: segment,
                });

                if (options.debug) {
                    logger.debug({
                        operation: `ocr.${options.type}_matched`,
                        data: {
                            segment: segment.substring(0, 30),
                            matchedEntity: match.item.name,
                            score: score.toFixed(3),
                        },
                    });
                }
            }
        }
    }

    // Log summary for debugging when nothing matched
    if (options.debug && detections.length === 0 && segments.length > 0) {
        logger.debug({
            operation: `ocr.no_${options.type}s_matched`,
            data: {
                segmentsChecked: segments.length,
                bestScore: bestUnmatchedScore < 1 ? bestUnmatchedScore.toFixed(3) : 'none',
                bestMatch: bestUnmatchedName || 'none',
                sampleSegments: segments.slice(0, 5).map(s => s.substring(0, 20)),
            },
        });
    }

    return detections;
}

/**
 * Detect items from extracted text
 */
export function detectItemsFromText(text: string): DetectionResult[] {
    return detectEntitiesFromText(text, itemFuse, { type: 'item', debug: true });
}

/**
 * Detect tomes from extracted text
 */
export function detectTomesFromText(text: string): DetectionResult[] {
    return detectEntitiesFromText(text, tomeFuse, { type: 'tome' });
}

/**
 * Detect character from extracted text
 */
export function detectCharacterFromText(text: string): DetectionResult | null {
    if (!characterFuse) return null;

    const results = characterFuse.search(text);
    const match = results[0];
    const score = match?.score;

    if (match && score !== undefined && score < 0.5) {
        return {
            type: 'character',
            entity: match.item,
            confidence: 1 - score,
            rawText: text,
        };
    }

    return null;
}

/**
 * Detect characters from extracted text (multiple lines)
 */
export function detectCharactersFromText(text: string): DetectionResult[] {
    return detectEntitiesFromText(text, characterFuse, { type: 'character' });
}

/**
 * Detect weapon from extracted text
 */
export function detectWeaponFromText(text: string): DetectionResult | null {
    if (!weaponFuse) return null;

    const results = weaponFuse.search(text);
    const match = results[0];
    const score = match?.score;

    if (match && score !== undefined && score < 0.5) {
        return {
            type: 'weapon',
            entity: match.item,
            confidence: 1 - score,
            rawText: text,
        };
    }

    return null;
}

/**
 * Detect weapons from extracted text (multiple lines)
 */
export function detectWeaponsFromText(text: string): DetectionResult[] {
    return detectEntitiesFromText(text, weaponFuse, { type: 'weapon' });
}

/**
 * Auto-detect all entities from image
 */
export async function autoDetectFromImage(
    imageDataUrl: string,
    progressCallback?: OCRProgressCallback
): Promise<{
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
    rawText: string;
}> {
    try {
        // Extract text from image
        if (progressCallback) {
            progressCallback(0, 'Starting OCR...');
        }

        const text = await extractTextFromImage(imageDataUrl, progressCallback);

        if (progressCallback) {
            progressCallback(100, 'Matching detected text...');
        }

        // Detect entities
        const items = detectItemsFromText(text);
        const tomes = detectTomesFromText(text);
        const character = detectCharacterFromText(text);
        const weapon = detectWeaponFromText(text);

        logger.info({
            operation: 'ocr.auto_detect',
            data: {
                itemsDetected: items.length,
                tomesDetected: tomes.length,
                characterDetected: character ? 1 : 0,
                weaponDetected: weapon ? 1 : 0,
            },
        });

        return {
            items,
            tomes,
            character,
            weapon,
            rawText: text,
        };
    } catch (error) {
        logger.error({
            operation: 'ocr.auto_detect',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'ocr',
            },
        });
        throw error;
    }
}

/**
 * Extract item counts from text (looks for patterns like "x3", "×2", etc.)
 */
export function extractItemCounts(text: string): Map<string, number> {
    const counts = new Map<string, number>();

    // Pattern: "item name x3" or "item name ×2" or "item name (3)"
    const patterns = [/(.+?)\s*[x×]\s*(\d+)/gi, /(.+?)\s*\((\d+)\)/gi, /(.+?)\s*:\s*(\d+)/gi];

    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const name = match[1]?.trim();
            const countStr = match[2];
            if (name && countStr) {
                const count = parseInt(countStr, 10);
                if (!isNaN(count) && count > 0) {
                    counts.set(name.toLowerCase(), count);
                }
            }
        }
    }

    return counts;
}

// ========================================
// Specialized Stack Count Detection
// ========================================

/**
 * Stack count detection result
 */
export interface StackCountResult {
    count: number | null;
    confidence: number;
    rawText: string;
}

/**
 * Preprocess image for digit OCR
 * Applies high contrast and thresholding for better digit recognition
 */
function preprocessForDigits(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and apply high contrast
    for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminosity method
        const gray = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);

        // Apply contrast enhancement
        const contrast = 2.0;
        const adjusted = Math.round(((gray / 255 - 0.5) * contrast + 0.5) * 255);
        const clamped = Math.max(0, Math.min(255, adjusted));

        // Threshold to binary (white text on dark background or vice versa)
        const threshold = 128;
        const binary = clamped > threshold ? 255 : 0;

        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Detect stack count from a small image region (bottom-right corner of item cell)
 * Optimized for detecting 1-2 digit numbers like "x2", "x5", "12"
 */
export async function detectStackCount(imageDataUrl: string): Promise<StackCountResult> {
    try {
        // Create canvas from image
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageDataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return { count: null, confidence: 0, rawText: '' };
        }
        ctx.drawImage(img, 0, 0);

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

/**
 * Reset OCR module state (for testing)
 */
export async function __resetForTesting(): Promise<void> {
    itemFuse = null;
    tomeFuse = null;
    characterFuse = null;
    weaponFuse = null;

    // Clean up worker
    await terminateOCRWorker();
}

// ========================================
// Global Assignments
// ========================================
// Window interface extensions are in types/index.ts

window.initOCR = initOCR;
window.terminateOCRWorker = terminateOCRWorker;
window.isOCRWorkerActive = isOCRWorkerActive;
