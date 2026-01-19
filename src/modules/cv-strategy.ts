// ========================================
// Computer Vision Strategy Configuration
// ========================================
// Allows mixing and matching different detection strategies
// to find optimal combinations
// ========================================

import type { Item } from '../types/index.ts';

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
export function getColorCategoryHSV(hsv: HSVColor): string {
    // Low saturation = grayscale
    if (hsv.s < 15) {
        if (hsv.v < 25) return 'black';
        if (hsv.v > 75) return 'white';
        return 'gray';
    }

    // Categorize by hue
    const h = hsv.h;

    if (h < 30 || h >= 330) return 'red';
    if (h >= 30 && h < 60) return 'orange';
    if (h >= 60 && h < 90) return 'yellow';
    if (h >= 90 && h < 150) return 'green';
    if (h >= 150 && h < 180) return 'cyan';
    if (h >= 180 && h < 240) return 'blue';
    if (h >= 240 && h < 300) return 'purple';
    if (h >= 300 && h < 330) return 'magenta';

    return 'mixed';
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
function getDominantColorRGB(avgR: number, avgG: number, avgB: number): string {
    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;

    // Low saturation = gray/white/black
    if (diff < 30) {
        const brightness = (avgR + avgG + avgB) / 3;
        if (brightness < 60) return 'black';
        if (brightness > 200) return 'white';
        return 'gray';
    }

    // High saturation = color
    if (avgR > avgG && avgR > avgB) {
        if (avgG > avgB * 1.3) return 'orange';
        if (avgR > 180 && avgG > 140) return 'yellow';
        return 'red';
    } else if (avgG > avgR && avgG > avgB) {
        if (avgB > avgR * 1.3) return 'cyan';
        if (avgG > 180 && avgB < 100) return 'lime';
        return 'green';
    } else if (avgB > avgR && avgB > avgG) {
        if (avgR > avgG * 1.3) return 'purple';
        if (avgB > 180 && avgG < 100) return 'blue';
        return 'blue';
    }

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
 * Record a user correction
 */
export function recordCorrection(detectedItem: Item, actualItem: Item, confidence: number, imageHash: string): void {
    feedbackCorrections.push({
        detected: detectedItem.id,
        actual: actualItem.id,
        confidence,
        timestamp: Date.now(),
        imageHash,
    });

    // If same mistake happens 3+ times, add penalty
    const mistakeKey = `${detectedItem.id}-${actualItem.id}`;
    const mistakeCount = feedbackCorrections.filter(
        c => c.detected === detectedItem.id && c.actual === actualItem.id
    ).length;

    if (mistakeCount >= 3) {
        itemSimilarityPenalties.set(mistakeKey, -0.05);
    }
}

/**
 * Get similarity penalty for an item pair
 */
export function getSimilarityPenalty(detectedId: string, templateId: string): number {
    const key = `${templateId}-${detectedId}`;
    return itemSimilarityPenalties.get(key) || 0;
}

/**
 * Clear all feedback corrections
 */
export function clearFeedbackCorrections(): void {
    feedbackCorrections.length = 0;
    itemSimilarityPenalties.clear();
}

/**
 * Get all feedback corrections
 */
export function getFeedbackCorrections(): FeedbackCorrection[] {
    return [...feedbackCorrections];
}

/**
 * Export feedback corrections to JSON
 */
export function exportFeedbackCorrections(): string {
    return JSON.stringify(feedbackCorrections, null, 2);
}

/**
 * Import feedback corrections from JSON
 */
export function importFeedbackCorrections(json: string): void {
    try {
        const imported = JSON.parse(json) as FeedbackCorrection[];
        feedbackCorrections.push(...imported);

        // Rebuild penalties
        itemSimilarityPenalties.clear();
        const mistakeCounts = new Map<string, number>();

        feedbackCorrections.forEach(correction => {
            const key = `${correction.detected}-${correction.actual}`;
            mistakeCounts.set(key, (mistakeCounts.get(key) || 0) + 1);
        });

        mistakeCounts.forEach((count, key) => {
            if (count >= 3) {
                itemSimilarityPenalties.set(key, -0.05);
            }
        });
    } catch (error) {
        throw new Error('Failed to import feedback corrections: ' + (error as Error).message);
    }
}
