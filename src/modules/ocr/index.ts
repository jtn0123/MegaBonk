// ========================================
// MegaBonk OCR Module
// ========================================
// Handles text extraction from screenshots using Tesseract.js
// Tesseract is lazy-loaded to reduce initial bundle size
// ========================================

// Re-export all types
export type {
    TesseractResult,
    DetectionResult,
    StackCountResult,
    OCRProgressCallback,
    EntityWithId,
    DetectEntitiesOptions,
    AutoDetectResult,
} from './types.ts';

// Re-export utilities
export { OCR_TIMEOUT_MS, OCR_MAX_RETRIES, withTimeout, sleep, splitIntoSegments, extractItemCounts } from './utils.ts';

// Re-export worker management
export { getTesseract, getOrCreateWorker, terminateOCRWorker, isOCRWorkerActive } from './worker.ts';

// Re-export preprocessing
export { preprocessForDigits, loadImage, createCanvasFromImage } from './preprocessing.ts';

// Re-export text extraction
export { extractTextFromImage } from './extraction.ts';

// Re-export entity detection
export {
    initOCR,
    detectItemsFromText,
    detectTomesFromText,
    detectCharacterFromText,
    detectCharactersFromText,
    detectWeaponFromText,
    detectWeaponsFromText,
    autoDetectFromImage,
} from './detection.ts';

// Re-export stack count detection
export { detectStackCount, detectStackCountsBatch } from './stack-count.ts';

// Import for window assignments and reset
import { initOCR } from './detection.ts';
import { terminateOCRWorker, isOCRWorkerActive, __resetWorkerForTesting } from './worker.ts';
import { __resetDetectionForTesting } from './detection.ts';

/**
 * Reset OCR module state (for testing)
 */
export async function __resetForTesting(): Promise<void> {
    __resetDetectionForTesting();
    __resetWorkerForTesting();
    await terminateOCRWorker();
}

// ========================================
// Global Assignments
// ========================================
// Window interface extensions are in types/index.ts

window.initOCR = initOCR;
window.terminateOCRWorker = terminateOCRWorker;
window.isOCRWorkerActive = isOCRWorkerActive;
