// ========================================
// OCR Module Types
// ========================================

import type { Item, Tome, Character, Weapon } from '../../types/index.ts';

/**
 * Tesseract recognition result (simplified type for our use case)
 */
export interface TesseractResult {
    data: {
        text: string;
        confidence: number;
    };
}

/**
 * OCR detection result for entities
 */
export interface DetectionResult {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: Item | Tome | Character | Weapon;
    confidence: number;
    rawText: string;
}

/**
 * Stack count detection result
 */
export interface StackCountResult {
    count: number | null;
    confidence: number;
    rawText: string;
}

/**
 * OCR progress callback
 */
export type OCRProgressCallback = (progress: number, status: string) => void;

/**
 * Entity type for generic detection
 */
export type EntityWithId = { id: string; name: string };

/**
 * Options for the generic entity detection helper
 */
export interface DetectEntitiesOptions {
    /** The entity type name (e.g., 'item', 'tome') */
    type: DetectionResult['type'];
    /** Whether to enable debug logging */
    debug?: boolean;
}

/**
 * Auto-detect result containing all detected entities
 */
export interface AutoDetectResult {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
    rawText: string;
}
