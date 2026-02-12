// ========================================
// Computer Vision Strategy Configuration
// ========================================
// Allows mixing and matching different detection strategies
// to find optimal combinations
// ========================================

import type { Item } from '../types/index.ts';
import { logger } from './logger.ts';

/**
 * Strategy configuration for CV detection
 * Each flag can be toggled to test different combinations
 */
export interface CVStrategy {
    // Color filtering approach
    colorFiltering: 'rarity-first' | 'color-first' | 'none';

    // Color analysis method
    colorAnalysis: 'single-dominant' | 'multi-region' | 'hsv-based';

    // Confidence thresholds
    confidenceThresholds: 'fixed' | 'adaptive-rarity' | 'adaptive-gap';

    // Template matching algorithm
    matchingAlgorithm: 'ncc' | 'ssd' | 'ssim';

    // Context boosting
    useContextBoosting: boolean;

    // Border rarity validation
    useBorderValidation: boolean;

    // User feedback loop
    useFeedbackLoop: boolean;

    // Empty cell detection
    useEmptyCellDetection: boolean;

    // Multi-pass matching
    multiPassEnabled: boolean;
}

/**
 * Predefined strategy presets for quick testing
 */
export const STRATEGY_PRESETS: Record<string, CVStrategy> = {
    // Current production strategy (with adaptive rarity thresholds)
    current: {
        colorFiltering: 'color-first',
        colorAnalysis: 'single-dominant',
        confidenceThresholds: 'adaptive-rarity',
        matchingAlgorithm: 'ncc',
        useContextBoosting: true,
        useBorderValidation: true,
        useFeedbackLoop: false,
        useEmptyCellDetection: true,
        multiPassEnabled: true,
    },

    // Recommended optimized strategy (all 5 improvements)
    optimized: {
        colorFiltering: 'rarity-first',
        colorAnalysis: 'multi-region',
        confidenceThresholds: 'adaptive-rarity',
        matchingAlgorithm: 'ncc',
        useContextBoosting: true,
        useBorderValidation: true,
        useFeedbackLoop: true,
        useEmptyCellDetection: true,
        multiPassEnabled: true,
    },

    // Maximum speed (sacrifice some accuracy)
    fast: {
        colorFiltering: 'rarity-first',
        colorAnalysis: 'single-dominant',
        confidenceThresholds: 'fixed',
        matchingAlgorithm: 'ssd',
        useContextBoosting: false,
        useBorderValidation: false,
        useFeedbackLoop: false,
        useEmptyCellDetection: true,
        multiPassEnabled: false,
    },

    // Maximum accuracy (slower)
    accurate: {
        colorFiltering: 'rarity-first',
        colorAnalysis: 'multi-region',
        confidenceThresholds: 'adaptive-gap',
        matchingAlgorithm: 'ssim',
        useContextBoosting: true,
        useBorderValidation: true,
        useFeedbackLoop: true,
        useEmptyCellDetection: true,
        multiPassEnabled: true,
    },

    // Balanced approach
    balanced: {
        colorFiltering: 'rarity-first',
        colorAnalysis: 'hsv-based',
        confidenceThresholds: 'adaptive-rarity',
        matchingAlgorithm: 'ncc',
        useContextBoosting: true,
        useBorderValidation: true,
        useFeedbackLoop: false,
        useEmptyCellDetection: true,
        multiPassEnabled: true,
    },

    // Tuned strategy - optimized thresholds for higher recall
    tuned: {
        colorFiltering: 'rarity-first',
        colorAnalysis: 'multi-region',
        confidenceThresholds: 'adaptive-rarity',
        matchingAlgorithm: 'ncc',
        useContextBoosting: true,
        useBorderValidation: true,
        useFeedbackLoop: true,
        useEmptyCellDetection: true,
        multiPassEnabled: true,
    },
};

/**
 * Default strategy (current production)
 */
export const DEFAULT_STRATEGY: CVStrategy = STRATEGY_PRESETS.current!;

/**
 * Active strategy (can be changed at runtime)
 */
let activeStrategy: CVStrategy = { ...DEFAULT_STRATEGY };

/**
 * Get current active strategy
 */
export function getActiveStrategy(): CVStrategy {
    return { ...activeStrategy };
}

/**
 * Set active strategy
 */
export function setActiveStrategy(strategy: CVStrategy | string): void {
    if (typeof strategy === 'string') {
        const preset = STRATEGY_PRESETS[strategy];
        if (!preset) {
            throw new Error(`Unknown strategy preset: ${strategy}`);
        }
        activeStrategy = { ...preset };
    } else {
        activeStrategy = { ...strategy };
    }
}

/**
 * Get confidence thresholds based on strategy
 *
 * Adaptive-rarity logic:
 * - Common items: HIGHER thresholds (stricter) because they're easy to detect
 *   and often confused with each other
 * - Rare/Legendary items: LOWER thresholds (more lenient) because they have
 *   unique visuals and false negatives are more costly
 */
export function getConfidenceThresholds(
    strategy: CVStrategy,
    rarity?: string
): {
    pass1: number;
    pass2: number;
    pass3: number;
} {
    if (strategy.confidenceThresholds === 'fixed') {
        return { pass1: 0.85, pass2: 0.7, pass3: 0.6 };
    }

    if (strategy.confidenceThresholds === 'adaptive-rarity' && rarity) {
        // Thresholds ordered by strictness:
        // Common items need higher confidence (more strict) to avoid confusion
        // Rare items can have lower confidence (more lenient) - unique visuals
        const thresholdMap: Record<string, { pass1: number; pass2: number; pass3: number }> = {
            common: { pass1: 0.88, pass2: 0.75, pass3: 0.65 },
            uncommon: { pass1: 0.85, pass2: 0.72, pass3: 0.62 },
            rare: { pass1: 0.82, pass2: 0.68, pass3: 0.58 },
            epic: { pass1: 0.78, pass2: 0.65, pass3: 0.55 },
            legendary: { pass1: 0.75, pass2: 0.62, pass3: 0.52 },
        };

        return thresholdMap[rarity] || { pass1: 0.85, pass2: 0.7, pass3: 0.6 };
    }

    // adaptive-gap is calculated dynamically, return defaults here
    return { pass1: 0.85, pass2: 0.7, pass3: 0.6 };
}

/**
 * Color profile for multi-region analysis
 */
export interface ColorProfile {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    center: string;
    border: string;
    dominant: string;
}

/**
 * HSV color representation
 */
export interface HSVColor {
    h: number; // Hue (0-360)
    s: number; // Saturation (0-100)
    v: number; // Value/Brightness (0-100)
}

/**
 * Convert RGB to HSV
 */
export function rgbToHSV(r: number, g: number, b: number): HSVColor {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    const s = max === 0 ? 0 : (diff / max) * 100;
    const v = max * 100;

    if (diff !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / diff) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / diff + 2);
        } else {
            h = 60 * ((r - g) / diff + 4);
        }
    }

    if (h < 0) h += 360;

    return { h, s, v };
}

/**
 * Get color category from HSV
 */
function getGrayscaleCategory(v: number): string {
    if (v < 25) return 'black';
    if (v > 75) return 'white';
    return 'gray';
}

function getHueCategory(h: number): string {
    if (h < 30 || h >= 330) return 'red';
    if (h < 60) return 'orange';
    if (h < 90) return 'yellow';
    if (h < 150) return 'green';
    if (h < 180) return 'cyan';
    if (h < 240) return 'blue';
    if (h < 300) return 'purple';
    if (h < 330) return 'magenta';
    return 'mixed';
}

export function getColorCategoryHSV(hsv: HSVColor): string {
    if (hsv.s < 15) return getGrayscaleCategory(hsv.v);
    return getHueCategory(hsv.h);
}

/**
 * Extract multi-region color profile from ImageData
 */
export function extractColorProfile(imageData: ImageData): ColorProfile {
    const { width, height, data } = imageData;

    // Define regions
    const regions = {
        topLeft: { x: 0, y: 0, w: Math.floor(width / 2), h: Math.floor(height / 2) },
        topRight: { x: Math.floor(width / 2), y: 0, w: Math.floor(width / 2), h: Math.floor(height / 2) },
        bottomLeft: { x: 0, y: Math.floor(height / 2), w: Math.floor(width / 2), h: Math.floor(height / 2) },
        bottomRight: {
            x: Math.floor(width / 2),
            y: Math.floor(height / 2),
            w: Math.floor(width / 2),
            h: Math.floor(height / 2),
        },
        center: {
            x: Math.floor(width / 4),
            y: Math.floor(height / 4),
            w: Math.floor(width / 2),
            h: Math.floor(height / 2),
        },
    };

    const getDominantColorInRegion = (region: { x: number; y: number; w: number; h: number }): string => {
        let sumR = 0,
            sumG = 0,
            sumB = 0,
            count = 0;

        for (let y = region.y; y < region.y + region.h && y < height; y++) {
            for (let x = region.x; x < region.x + region.w && x < width; x++) {
                const idx = (y * width + x) * 4;
                sumR += data[idx] ?? 0;
                sumG += data[idx + 1] ?? 0;
                sumB += data[idx + 2] ?? 0;
                count++;
            }
        }

        if (count === 0) return 'mixed';

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        return getDominantColorRGB(avgR, avgG, avgB);
    };

    // Extract border color
    const borderColor = extractBorderDominantColor(imageData);

    return {
        topLeft: getDominantColorInRegion(regions.topLeft),
        topRight: getDominantColorInRegion(regions.topRight),
        bottomLeft: getDominantColorInRegion(regions.bottomLeft),
        bottomRight: getDominantColorInRegion(regions.bottomRight),
        center: getDominantColorInRegion(regions.center),
        border: borderColor,
        dominant: getDominantColorInRegion({ x: 0, y: 0, w: width, h: height }),
    };
}

/**
 * Extract border dominant color
 */
function extractBorderDominantColor(imageData: ImageData): string {
    const { width, height, data } = imageData;
    const borderWidth = 3;

    let sumR = 0,
        sumG = 0,
        sumB = 0,
        count = 0;

    // Top and bottom borders
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < borderWidth; y++) {
            // Top
            const topIdx = (y * width + x) * 4;
            sumR += data[topIdx] ?? 0;
            sumG += data[topIdx + 1] ?? 0;
            sumB += data[topIdx + 2] ?? 0;
            count++;

            // Bottom
            const bottomIdx = ((height - 1 - y) * width + x) * 4;
            sumR += data[bottomIdx] ?? 0;
            sumG += data[bottomIdx + 1] ?? 0;
            sumB += data[bottomIdx + 2] ?? 0;
            count++;
        }
    }

    // Left and right borders
    for (let y = borderWidth; y < height - borderWidth; y++) {
        for (let x = 0; x < borderWidth; x++) {
            // Left
            const leftIdx = (y * width + x) * 4;
            sumR += data[leftIdx] ?? 0;
            sumG += data[leftIdx + 1] ?? 0;
            sumB += data[leftIdx + 2] ?? 0;
            count++;

            // Right
            const rightIdx = (y * width + (width - 1 - x)) * 4;
            sumR += data[rightIdx] ?? 0;
            sumG += data[rightIdx + 1] ?? 0;
            sumB += data[rightIdx + 2] ?? 0;
            count++;
        }
    }

    if (count === 0) return 'mixed';

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    return getDominantColorRGB(avgR, avgG, avgB);
}

/**
 * Get dominant color category from RGB (helper function)
 */
function getLowSaturationColor(avgR: number, avgG: number, avgB: number): string {
    const brightness = (avgR + avgG + avgB) / 3;
    if (brightness < 60) return 'black';
    if (brightness > 200) return 'white';
    return 'gray';
}

function getRedDominantColor(avgR: number, avgG: number, avgB: number): string {
    if (avgG > avgB * 1.3) return 'orange';
    if (avgR > 180 && avgG > 140) return 'yellow';
    return 'red';
}

function getGreenDominantColor(avgR: number, avgG: number, avgB: number): string {
    if (avgB > avgR * 1.3) return 'cyan';
    if (avgG > 180 && avgB < 100) return 'lime';
    return 'green';
}

function getBlueDominantColor(avgR: number, avgG: number, _avgB: number): string {
    if (avgR > avgG * 1.3) return 'purple';
    return 'blue';
}

function getDominantColorRGB(avgR: number, avgG: number, avgB: number): string {
    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;

    if (diff < 30) return getLowSaturationColor(avgR, avgG, avgB);
    if (avgR > avgG && avgR > avgB) return getRedDominantColor(avgR, avgG, avgB);
    if (avgG > avgR && avgG > avgB) return getGreenDominantColor(avgR, avgG, avgB);
    if (avgB > avgR && avgB > avgG) return getBlueDominantColor(avgR, avgG, avgB);
    if (avgR > 150 && avgG < 100 && avgB > 150) return 'magenta';
    if (avgR > 100 && avgG > 100 && avgB < 80) return 'brown';

    return 'mixed';
}

/**
 * Compare two color profiles for similarity
 */
export function compareColorProfiles(profile1: ColorProfile, profile2: ColorProfile): number {
    let matches = 0;
    const keys: (keyof ColorProfile)[] = [
        'topLeft',
        'topRight',
        'bottomLeft',
        'bottomRight',
        'center',
        'border',
        'dominant',
    ];

    for (const key of keys) {
        if (profile1[key] === profile2[key]) {
            matches++;
        }
    }

    return matches / keys.length;
}

/**
 * User feedback correction record
 */
export interface FeedbackCorrection {
    detected: string; // Item ID
    actual: string; // Item ID
    confidence: number;
    timestamp: number;
    imageHash: string;
}

/**
 * Feedback loop storage (in-memory for now, could use IndexedDB)
 */
const feedbackCorrections: FeedbackCorrection[] = [];
const itemSimilarityPenalties = new Map<string, number>();

/**
 * Confusion matrix tracking - counts how often each item pair is confused
 * Key format: "detectedId->actualId", value: count
 */
const confusionMatrix = new Map<string, number>();

/**
 * Confusion matrix entry for reporting
 */
export interface ConfusionPair {
    detectedId: string;
    actualId: string;
    count: number;
    lastOccurrence: number;
}

/**
 * Record a user correction
 * Updates confusion matrix and applies proportional penalties
 */
export function recordCorrection(detectedItem: Item, actualItem: Item, confidence: number, imageHash: string): void {
    const timestamp = Date.now();

    feedbackCorrections.push({
        detected: detectedItem.id,
        actual: actualItem.id,
        confidence,
        timestamp,
        imageHash,
    });

    // Update confusion matrix
    const confusionKey = `${detectedItem.id}->${actualItem.id}`;
    const currentCount = confusionMatrix.get(confusionKey) || 0;
    const newCount = currentCount + 1;
    confusionMatrix.set(confusionKey, newCount);

    // Apply proportional penalty based on confusion frequency
    // More confusions = stronger penalty (up to -0.15 max)
    const mistakeKey = `${detectedItem.id}-${actualItem.id}`;
    if (newCount >= 2) {
        // Scale penalty: 2 confusions = -0.06, 5+ confusions = -0.15 (capped)
        const penalty = Math.max(-0.03 * newCount, -0.15);
        itemSimilarityPenalties.set(mistakeKey, penalty);
    }

    // Log confusion event for debugging
    logger.debug({
        operation: 'cv.confusion',
        data: {
            detectedId: detectedItem.id,
            actualId: actualItem.id,
            count: newCount,
            confidence: Number(confidence.toFixed(3)),
        },
    });
}

/**
 * Get similarity penalty for an item pair
 */
export function getSimilarityPenalty(detectedId: string, templateId: string): number {
    const key = `${templateId}-${detectedId}`;
    return itemSimilarityPenalties.get(key) || 0;
}

/**
 * Clear all feedback corrections and confusion matrix
 */
export function clearFeedbackCorrections(): void {
    feedbackCorrections.length = 0;
    itemSimilarityPenalties.clear();
    confusionMatrix.clear();
}

/**
 * Get all feedback corrections
 */
export function getFeedbackCorrections(): FeedbackCorrection[] {
    return [...feedbackCorrections];
}

/**
 * Get top confused item pairs sorted by frequency
 */
export function getTopConfusedPairs(limit: number = 10): ConfusionPair[] {
    const pairs: ConfusionPair[] = [];

    for (const [key, count] of confusionMatrix.entries()) {
        const [detectedId, actualId] = key.split('->');
        if (!detectedId || !actualId) continue;

        // Find last occurrence timestamp
        const lastCorrection = feedbackCorrections
            .filter(c => c.detected === detectedId && c.actual === actualId)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        pairs.push({
            detectedId,
            actualId,
            count,
            lastOccurrence: lastCorrection?.timestamp || 0,
        });
    }

    // Sort by count descending
    return pairs.sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Get confusion count for a specific item pair
 */
export function getConfusionCount(detectedId: string, actualId: string): number {
    return confusionMatrix.get(`${detectedId}->${actualId}`) || 0;
}

/**
 * Get all items that a specific item is commonly confused with
 */
export function getConfusedWithItem(itemId: string): ConfusionPair[] {
    const pairs: ConfusionPair[] = [];

    for (const [key, count] of confusionMatrix.entries()) {
        const [detectedId, actualId] = key.split('->');
        if (!detectedId || !actualId) continue;

        // Include if this item was either the detected or actual item
        if (detectedId === itemId || actualId === itemId) {
            const lastCorrection = feedbackCorrections
                .filter(c => c.detected === detectedId && c.actual === actualId)
                .sort((a, b) => b.timestamp - a.timestamp)[0];

            pairs.push({
                detectedId,
                actualId,
                count,
                lastOccurrence: lastCorrection?.timestamp || 0,
            });
        }
    }

    return pairs.sort((a, b) => b.count - a.count);
}

/**
 * Get confusion matrix statistics
 */
export function getConfusionStats(): {
    totalConfusions: number;
    uniquePairs: number;
    mostConfusedPair: ConfusionPair | null;
    averageConfusionCount: number;
} {
    const pairs = getTopConfusedPairs(1);
    const totalConfusions = Array.from(confusionMatrix.values()).reduce((sum, count) => sum + count, 0);
    const uniquePairs = confusionMatrix.size;

    return {
        totalConfusions,
        uniquePairs,
        mostConfusedPair: pairs[0] || null,
        averageConfusionCount: uniquePairs > 0 ? totalConfusions / uniquePairs : 0,
    };
}

/**
 * Export feedback corrections to JSON
 */
export function exportFeedbackCorrections(): string {
    return JSON.stringify(feedbackCorrections, null, 2);
}

/**
 * Import feedback corrections from JSON
 * Rebuilds confusion matrix and proportional penalties
 */
export function importFeedbackCorrections(json: string): void {
    try {
        const imported = JSON.parse(json) as FeedbackCorrection[];
        feedbackCorrections.push(...imported);

        // Rebuild confusion matrix and penalties
        confusionMatrix.clear();
        itemSimilarityPenalties.clear();

        feedbackCorrections.forEach(correction => {
            // Update confusion matrix
            const confusionKey = `${correction.detected}->${correction.actual}`;
            confusionMatrix.set(confusionKey, (confusionMatrix.get(confusionKey) || 0) + 1);
        });

        // Apply proportional penalties based on confusion counts
        confusionMatrix.forEach((count, confusionKey) => {
            const [detectedId, actualId] = confusionKey.split('->');
            if (!detectedId || !actualId) return;

            if (count >= 2) {
                const mistakeKey = `${detectedId}-${actualId}`;
                const penalty = Math.max(-0.03 * count, -0.15);
                itemSimilarityPenalties.set(mistakeKey, penalty);
            }
        });

        logger.debug({
            operation: 'cv.import_corrections',
            data: {
                correctionsCount: imported.length,
                confusionPairsCount: confusionMatrix.size,
            },
        });
    } catch (error) {
        throw new Error('Failed to import feedback corrections: ' + (error as Error).message);
    }
}
