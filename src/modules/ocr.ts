// ========================================
// MegaBonk OCR Module
// ========================================
// Handles text extraction from screenshots using Tesseract.js
// ========================================

import Tesseract from 'tesseract.js';
import type { AllGameData, Item, Tome, Character, Weapon } from '../types/index.ts';
import Fuse from 'fuse.js';
import { logger } from './logger.ts';

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
 */
export async function extractTextFromImage(
    imageDataUrl: string,
    progressCallback?: OCRProgressCallback,
    timeoutMs: number = OCR_TIMEOUT_MS,
    maxRetries: number = OCR_MAX_RETRIES
): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            logger.info({
                operation: 'ocr.extract_text',
                data: { phase: 'start', attempt: attempt + 1, maxRetries: maxRetries + 1 },
            });

            if (attempt > 0 && progressCallback) {
                progressCallback(0, `Retrying OCR (attempt ${attempt + 1}/${maxRetries + 1})...`);
            }

            const recognizePromise = Tesseract.recognize(imageDataUrl, 'eng', {
                logger: info => {
                    if (progressCallback && info.status === 'recognizing text') {
                        const progress = Math.round(info.progress * 100);
                        progressCallback(progress, `Recognizing text... ${progress}%`);
                    }
                },
            });

            // Wrap with timeout to prevent indefinite waiting
            const result = await withTimeout(recognizePromise, timeoutMs, 'OCR recognition');

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

/**
 * Reset OCR module state (for testing)
 */
export function __resetForTesting(): void {
    itemFuse = null;
    tomeFuse = null;
    characterFuse = null;
    weaponFuse = null;
}

// ========================================
// Global Assignments
// ========================================
window.initOCR = initOCR;
