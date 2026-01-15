// ========================================
// MegaBonk OCR Module
// ========================================
// Handles text extraction from screenshots using Tesseract.js
// ========================================

import Tesseract from 'tesseract.js';
import type { AllGameData, Item, Tome, Character, Weapon } from '../types/index.ts';
import Fuse from 'fuse.js';
import { logger } from './logger.ts';

// OCR detection result
export interface DetectionResult {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: Item | Tome | Character | Weapon;
    confidence: number;
    rawText: string;
}

// OCR status callback
export type OCRProgressCallback = (progress: number, status: string) => void;

let allData: AllGameData = {};
let itemFuse: Fuse<Item> | null = null;
let tomeFuse: Fuse<Tome> | null = null;
let characterFuse: Fuse<Character> | null = null;
let weaponFuse: Fuse<Weapon> | null = null;

/**
 * Initialize OCR module with game data
 */
export function initOCR(gameData: AllGameData): void {
    allData = gameData;

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
 * Extract text from image using Tesseract OCR
 */
export async function extractTextFromImage(
    imageDataUrl: string,
    progressCallback?: OCRProgressCallback
): Promise<string> {
    try {
        logger.info({
            operation: 'ocr.extract_text',
            data: { phase: 'start' },
        });

        const result = await Tesseract.recognize(imageDataUrl, 'eng', {
            logger: info => {
                if (progressCallback && info.status === 'recognizing text') {
                    const progress = Math.round(info.progress * 100);
                    progressCallback(progress, `Recognizing text... ${progress}%`);
                }
            },
        });

        const extractedText = result.data.text;

        logger.info({
            operation: 'ocr.extract_text',
            data: {
                phase: 'complete',
                textLength: extractedText.length,
                confidence: result.data.confidence,
                textPreview: extractedText.substring(0, 500).replace(/\n/g, ' | '),
            },
        });

        return extractedText;
    } catch (error) {
        logger.error({
            operation: 'ocr.extract_text',
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

/**
 * Detect items from extracted text
 */
export function detectItemsFromText(text: string): DetectionResult[] {
    if (!itemFuse) return [];

    const segments = splitIntoSegments(text);
    const detections: DetectionResult[] = [];
    const seenEntities = new Set<string>(); // Avoid duplicates

    let bestUnmatchedScore = 1;
    let bestUnmatchedName = '';

    for (const segment of segments) {
        const results = itemFuse.search(segment);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];

            // Track best unmatched score for debugging
            if (match.score >= 0.5 && match.score < bestUnmatchedScore) {
                bestUnmatchedScore = match.score;
                bestUnmatchedName = match.item.name;
            }

            // Only include matches with confidence > 50% (score < 0.5)
            if (match.score < 0.5 && !seenEntities.has(match.item.id)) {
                seenEntities.add(match.item.id);
                detections.push({
                    type: 'item',
                    entity: match.item,
                    confidence: 1 - match.score, // Fuse score is 0 (best) to 1 (worst), invert it
                    rawText: segment,
                });

                logger.debug({
                    operation: 'ocr.item_matched',
                    data: {
                        segment: segment.substring(0, 30),
                        matchedItem: match.item.name,
                        score: match.score.toFixed(3),
                    },
                });
            }
        }
    }

    // Log summary for debugging when nothing matched
    if (detections.length === 0 && segments.length > 0) {
        logger.debug({
            operation: 'ocr.no_items_matched',
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
 * Detect tomes from extracted text
 */
export function detectTomesFromText(text: string): DetectionResult[] {
    if (!tomeFuse) return [];

    const segments = splitIntoSegments(text);
    const detections: DetectionResult[] = [];
    const seenEntities = new Set<string>();

    for (const segment of segments) {
        const results = tomeFuse.search(segment);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];
            if (match.score < 0.5 && !seenEntities.has(match.item.id)) {
                seenEntities.add(match.item.id);
                detections.push({
                    type: 'tome',
                    entity: match.item,
                    confidence: 1 - match.score,
                    rawText: segment,
                });
            }
        }
    }

    return detections;
}

/**
 * Detect character from extracted text
 */
export function detectCharacterFromText(text: string): DetectionResult | null {
    if (!characterFuse) return null;

    const results = characterFuse.search(text);

    if (results.length > 0 && results[0].score !== undefined) {
        const match = results[0];
        if (match.score < 0.5) {
            return {
                type: 'character',
                entity: match.item,
                confidence: 1 - match.score,
                rawText: text,
            };
        }
    }

    return null;
}

/**
 * Detect characters from extracted text (multiple lines)
 */
export function detectCharactersFromText(text: string): DetectionResult[] {
    if (!characterFuse) return [];

    const segments = splitIntoSegments(text);
    const detections: DetectionResult[] = [];
    const seenEntities = new Set<string>();

    for (const segment of segments) {
        const results = characterFuse.search(segment);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];
            if (match.score < 0.5 && !seenEntities.has(match.item.id)) {
                seenEntities.add(match.item.id);
                detections.push({
                    type: 'character',
                    entity: match.item,
                    confidence: 1 - match.score,
                    rawText: segment,
                });
            }
        }
    }

    return detections;
}

/**
 * Detect weapon from extracted text
 */
export function detectWeaponFromText(text: string): DetectionResult | null {
    if (!weaponFuse) return null;

    const results = weaponFuse.search(text);

    if (results.length > 0 && results[0].score !== undefined) {
        const match = results[0];
        if (match.score < 0.5) {
            return {
                type: 'weapon',
                entity: match.item,
                confidence: 1 - match.score,
                rawText: text,
            };
        }
    }

    return null;
}

/**
 * Detect weapons from extracted text (multiple lines)
 */
export function detectWeaponsFromText(text: string): DetectionResult[] {
    if (!weaponFuse) return [];

    const segments = splitIntoSegments(text);
    const detections: DetectionResult[] = [];
    const seenEntities = new Set<string>();

    for (const segment of segments) {
        const results = weaponFuse.search(segment);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];
            if (match.score < 0.5 && !seenEntities.has(match.item.id)) {
                seenEntities.add(match.item.id);
                detections.push({
                    type: 'weapon',
                    entity: match.item,
                    confidence: 1 - match.score,
                    rawText: segment,
                });
            }
        }
    }

    return detections;
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
            const name = match[1].trim();
            const count = parseInt(match[2], 10);
            if (!isNaN(count) && count > 0) {
                counts.set(name.toLowerCase(), count);
            }
        }
    }

    return counts;
}

/**
 * Reset OCR module state (for testing)
 */
export function __resetForTesting(): void {
    allData = {};
    itemFuse = null;
    tomeFuse = null;
    characterFuse = null;
    weaponFuse = null;
}

// ========================================
// Global Assignments
// ========================================
(window as any).initOCR = initOCR;
