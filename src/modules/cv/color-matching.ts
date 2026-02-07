// ========================================
// CV Color Matching
// Color comparison, similarity, and matching algorithms
// ========================================

import {
    rgbToHsl,
    RARITY_BORDER_COLORS,
    EMPTY_CELL_MEAN_THRESHOLD,
    EMPTY_DETECTION_CONFIG,
    calculateAverageSaturation,
    calculateHistogramWidth,
    calculateCenterEdgeRatio,
    calculateEdgeDensity,
} from './color-utils.js';
import { extractBorderPixels, type DetailedColorCategory } from './color-extraction.js';

/**
 * Check if a color matches a specific rarity border color
 */
export function matchesRarityColor(r: number, g: number, b: number, rarity: string): boolean {
    const def = RARITY_BORDER_COLORS[rarity];
    if (!def) return false;

    // Quick RGB range check first (faster)
    if (r < def.rgb.r[0] || r > def.rgb.r[1]) return false;
    if (g < def.rgb.g[0] || g > def.rgb.g[1]) return false;
    if (b < def.rgb.b[0] || b > def.rgb.b[1]) return false;

    // HSL check for more accuracy
    const hsl = rgbToHsl(r, g, b);

    // Handle hue wraparound for red/orange
    let hueMatch = false;
    if (def.h[0] <= def.h[1]) {
        hueMatch = hsl.h >= def.h[0] && hsl.h <= def.h[1];
    } else {
        hueMatch = hsl.h >= def.h[0] || hsl.h <= def.h[1];
    }

    const satMatch = hsl.s >= def.s[0] && hsl.s <= def.s[1];
    const lumMatch = hsl.l >= def.l[0] && hsl.l <= def.l[1];

    return hueMatch && satMatch && lumMatch;
}

/**
 * Detect rarity at a specific pixel
 * Returns rarity string or null if no match
 */
export function detectRarityAtPixel(r: number, g: number, b: number): string | null {
    for (const rarity of Object.keys(RARITY_BORDER_COLORS)) {
        if (matchesRarityColor(r, g, b, rarity)) {
            return rarity;
        }
    }
    return null;
}

/**
 * Calculate color category match score between two detailed categories
 * Returns score from 0 (no match) to 1 (perfect match)
 */
export function matchColorCategories(category1: DetailedColorCategory, category2: DetailedColorCategory): number {
    let score = 0;

    // Primary color match (most important)
    if (category1.primary === category2.primary) {
        score += 0.5;
        // Bonus for secondary match
        if (category1.secondary === category2.secondary) {
            score += 0.25;
        }
    }

    // Saturation match
    if (category1.saturation === category2.saturation) {
        score += 0.15;
    } else if (
        (category1.saturation === 'low' && category2.saturation === 'medium') ||
        (category1.saturation === 'medium' && category2.saturation === 'low') ||
        (category1.saturation === 'medium' && category2.saturation === 'high') ||
        (category1.saturation === 'high' && category2.saturation === 'medium')
    ) {
        score += 0.08; // Adjacent saturation levels
    }

    // Brightness match
    if (category1.brightness === category2.brightness) {
        score += 0.1;
    }

    return score;
}

/**
 * Check if cell color matches inventory background
 * Inventory backgrounds are typically dark, low-saturation colors.
 */
export function isInventoryBackground(imageData: ImageData): boolean {
    const pixels = imageData.data;
    let darkLowSatPixels = 0;
    let count = 0;

    const width = imageData.width;
    const height = imageData.height;
    const margin = Math.floor(Math.min(width, height) * 0.2);

    for (let y = margin; y < height - margin; y += 2) {
        for (let x = margin; x < width - margin; x += 2) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            // Check if pixel is dark and low-saturation
            const brightness = (r + g + b) / 3;
            const maxChannel = Math.max(r, g, b);
            const minChannel = Math.min(r, g, b);
            const saturation = maxChannel - minChannel;

            // Dark (< 80 brightness) and low saturation (< 40 spread)
            if (brightness < 80 && saturation < 40) {
                darkLowSatPixels++;
            }
            count++;
        }
    }

    // If >60% of center pixels are dark & low-saturation, likely empty background
    return count > 0 && darkLowSatPixels / count > 0.6;
}

/**
 * Check if a cell is likely empty (mostly uniform background)
 * Uses multiple signals: variance, edge density, background color, saturation, histogram
 *
 * Strategy: Be generous with empty detection (use higher variance threshold),
 * but use edge density to rescue cells that have low variance but contain items.
 *
 * New methods (#2, #3, #7) provide additional detection for textured backgrounds
 * like grey brick that fool the basic variance check.
 */
export function isEmptyCell(imageData: ImageData): boolean {
    const pixels = imageData.data;
    const methods = EMPTY_DETECTION_CONFIG.methods;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumSquareR = 0;
    let sumSquareG = 0;
    let sumSquareB = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        sumR += r;
        sumG += g;
        sumB += b;
        sumSquareR += r * r;
        sumSquareG += g * g;
        sumSquareB += b * b;
        count++;
    }

    if (count === 0) return true;

    // Calculate variance for each channel
    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    const varianceR = sumSquareR / count - meanR * meanR;
    const varianceG = sumSquareG / count - meanG * meanG;
    const varianceB = sumSquareB / count - meanB * meanB;

    const totalVariance = varianceR + varianceG + varianceB;
    const meanGray = (meanR + meanG + meanB) / 3;

    // Check 1: Very dark cells are empty (meanGray < 40)
    if (meanGray < EMPTY_CELL_MEAN_THRESHOLD) {
        return true;
    }

    // ----------------------------------------
    // Method #2: Saturation check (good for grey/brick backgrounds)
    // Low saturation + moderate variance = likely empty textured background
    // ----------------------------------------
    if (methods.useSaturation) {
        const saturation = calculateAverageSaturation(imageData);
        // Low saturation (< 15%) combined with moderate variance = empty
        // This catches grey brick that has variance ~400-600 but no color
        if (saturation < EMPTY_DETECTION_CONFIG.MAX_SATURATION && totalVariance < 800) {
            return true;
        }
    }

    // ----------------------------------------
    // Method #3: Histogram width check (experimental)
    // Few distinct colors = likely empty background
    // ----------------------------------------
    if (methods.useHistogram) {
        const histWidth = calculateHistogramWidth(imageData);
        if (histWidth < EMPTY_DETECTION_CONFIG.MIN_HISTOGRAM_BINS) {
            return true;
        }
    }

    // ----------------------------------------
    // Method #7: Center/edge ratio check (experimental)
    // Uniform variance across cell = likely empty (no centered icon)
    // ----------------------------------------
    if (methods.useCenterEdge) {
        const ratio = calculateCenterEdgeRatio(imageData);
        if (ratio < EMPTY_DETECTION_CONFIG.MIN_CENTER_EDGE_RATIO) {
            return true;
        }
    }

    // ----------------------------------------
    // Original variance-based checks
    // ----------------------------------------
    if (methods.useVariance) {
        // Check 2: Low variance = likely empty
        // Use higher threshold (500) to catch empty cells
        if (totalVariance < 500) {
            // If variance is VERY low (< 150), definitely empty - no further checks
            if (totalVariance < 150) {
                return true;
            }

            // For moderate variance (150-500), check if it has significant edges
            // Items have edges (icon outlines), empty backgrounds don't
            const edgeDensity = calculateEdgeDensity(imageData);

            // Low edges (< 5%) = empty background
            if (edgeDensity < 0.05) {
                return true;
            }

            // Has some edges but matches inventory background = still empty
            if (edgeDensity < 0.12 && isInventoryBackground(imageData)) {
                return true;
            }
        }

        // Check 3: Matches inventory background color (even with higher variance)
        // Some empty cells have texture/noise but are clearly background
        if (totalVariance < 800 && isInventoryBackground(imageData)) {
            const edgeDensity = calculateEdgeDensity(imageData);
            if (edgeDensity < 0.08) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Detect rarity from border color using HSL-based matching
 * Returns rarity string or null if no clear match
 */
export function detectBorderRarity(imageData: ImageData): string | null {
    const borderPixels = extractBorderPixels(imageData, 3);

    // Count votes for each rarity based on individual pixel matching
    const rarityVotes: Record<string, number> = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
    };

    let totalPixels = 0;

    for (let i = 0; i < borderPixels.length; i += 3) {
        const r = borderPixels[i] ?? 0;
        const g = borderPixels[i + 1] ?? 0;
        const b = borderPixels[i + 2] ?? 0;

        const rarity = detectRarityAtPixel(r, g, b);
        if (rarity) {
            rarityVotes[rarity] = (rarityVotes[rarity] ?? 0) + 1;
        }
        totalPixels++;
    }

    // Find rarity with most votes
    let bestMatch: string | null = null;
    let bestVotes = 0;

    for (const [rarity, votes] of Object.entries(rarityVotes)) {
        if (votes > bestVotes) {
            bestVotes = votes;
            bestMatch = rarity;
        }
    }

    // Require at least 10% of border pixels to match
    const minVoteRatio = 0.1;
    if (bestVotes < totalPixels * minVoteRatio) {
        return null;
    }

    return bestMatch;
}

/**
 * Count rarity border pixels in a horizontal scan line
 * Used for hotbar detection
 */
export function countRarityBorderPixels(imageData: ImageData): {
    total: number;
    rarityCount: number;
    colorfulCount: number;
    rarityCounts: Record<string, number>;
} {
    const pixels = imageData.data;
    let rarityCount = 0;
    let colorfulCount = 0;
    const rarityCounts: Record<string, number> = {};

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        // Check if colorful (potential border)
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation > 40) colorfulCount++;

        // Check specific rarity
        const rarity = detectRarityAtPixel(r, g, b);
        if (rarity) {
            rarityCount++;
            rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
        }
    }

    return {
        total: pixels.length / 4,
        rarityCount,
        colorfulCount,
        rarityCounts,
    };
}
