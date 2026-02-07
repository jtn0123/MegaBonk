// ========================================
// Entity Detection from OCR Text
// ========================================
// Fuzzy matching to detect items, tomes, characters, weapons

import type { AllGameData, Item, Tome, Character, Weapon } from '../../types/index.ts';
import Fuse from 'fuse.js';
import { logger } from '../logger.ts';
import { splitIntoSegments } from './utils.ts';
import type {
    DetectionResult,
    EntityWithId,
    DetectEntitiesOptions,
    AutoDetectResult,
    OCRProgressCallback,
} from './types.ts';
import { extractTextFromImage } from './extraction.ts';

// Fuse.js instances for fuzzy matching
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
        // Guard against empty results array before accessing first element
        if (results.length === 0) continue;
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
    // Guard against empty results array
    if (results.length === 0) return null;
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
    // Guard against empty results array
    if (results.length === 0) return null;
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
): Promise<AutoDetectResult> {
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
 * Reset detection state (for testing)
 */
export function __resetDetectionForTesting(): void {
    itemFuse = null;
    tomeFuse = null;
    characterFuse = null;
    weaponFuse = null;
}
