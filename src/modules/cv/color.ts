// ========================================
// CV Color Analysis
// ========================================

/**
 * Convert RGB to HSL color space
 * Returns { h: 0-360, s: 0-100, l: 0-100 }
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// ========================================
// Rarity Border Color Definitions (HSL ranges)
// ========================================

export interface RarityColorDef {
    name: string;
    h: [number, number];
    s: [number, number];
    l: [number, number];
    rgb: { r: [number, number]; g: [number, number]; b: [number, number] };
}

export const RARITY_BORDER_COLORS: Record<string, RarityColorDef> = {
    common: {
        name: 'common',
        // Gray - low saturation
        h: [0, 360],
        s: [0, 25],
        l: [35, 75],
        rgb: { r: [100, 200], g: [100, 200], b: [100, 200] },
    },
    uncommon: {
        name: 'uncommon',
        // Green
        h: [85, 155],
        s: [40, 100],
        l: [25, 65],
        rgb: { r: [30, 150], g: [120, 255], b: [30, 150] },
    },
    rare: {
        name: 'rare',
        // Blue
        h: [190, 250],
        s: [50, 100],
        l: [35, 70],
        rgb: { r: [30, 150], g: [80, 200], b: [150, 255] },
    },
    epic: {
        name: 'epic',
        // Purple
        h: [260, 320],
        s: [40, 100],
        l: [30, 65],
        rgb: { r: [120, 220], g: [30, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        // Orange/Gold
        h: [15, 55],
        s: [70, 100],
        l: [45, 75],
        rgb: { r: [200, 255], g: [100, 220], b: [20, 120] },
    },
};

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
 * Extract dominant colors from image region
 * Useful for icon-based matching
 */
export function extractDominantColors(
    imageData: ImageData,
    numColors: number = 5
): { r: number; g: number; b: number; frequency: number }[] {
    const pixels = imageData.data;
    const colorMap = new Map<string, number>();

    // Sample pixels (every 4th pixel for performance)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = Math.floor((pixels[i] ?? 0) / 32) * 32;
        const g = Math.floor((pixels[i + 1] ?? 0) / 32) * 32;
        const b = Math.floor((pixels[i + 2] ?? 0) / 32) * 32;
        const key = `${r},${g},${b}`;

        colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // Get top colors
    const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, numColors)
        .map(([key, freq]) => {
            const parts = key.split(',').map(Number);
            return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, frequency: freq };
        });

    return sortedColors;
}

/**
 * Get dominant color category from ImageData
 * Used for color-based pre-filtering
 */
export function getDominantColor(imageData: ImageData): string {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    // Sample pixels (skip alpha, sample every 4th pixel)
    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    // Categorize into color buckets
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
        // Red dominant
        if (avgG > avgB * 1.3) return 'orange';
        // Yellow requires high red, high green, AND low blue
        if (avgR > 180 && avgG > 140 && avgB < 120) return 'yellow';
        return 'red';
    } else if (avgG > avgR && avgG > avgB) {
        // Green dominant
        if (avgB > avgR * 1.3) return 'cyan';
        if (avgG > 180 && avgB < 100) return 'lime';
        return 'green';
    } else if (avgB > avgR && avgB > avgG) {
        // Blue dominant
        if (avgR > avgG * 1.3) return 'purple';
        if (avgB > 180 && avgG < 100) return 'blue';
        return 'blue';
    }

    // Mixed colors
    if (avgR > 150 && avgG < 100 && avgB > 150) return 'magenta';
    if (avgR > 100 && avgG > 100 && avgB < 80) return 'brown';

    return 'mixed'; // Fallback
}

/**
 * Calculate color variance to detect empty cells or low-detail regions
 */
export function calculateColorVariance(imageData: ImageData): number {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    let varianceSum = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        const diffR = (pixels[i] ?? 0) - meanR;
        const diffG = (pixels[i + 1] ?? 0) - meanG;
        const diffB = (pixels[i + 2] ?? 0) - meanB;
        varianceSum += diffR * diffR + diffG * diffG + diffB * diffB;
    }

    return varianceSum / count;
}

/**
 * Check if a cell is likely empty (mostly uniform background)
 * Empty cells have low color variance
 */
export function isEmptyCell(imageData: ImageData): boolean {
    const pixels = imageData.data;
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

    // Calculate variance for each channel
    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    const varianceR = sumSquareR / count - meanR * meanR;
    const varianceG = sumSquareG / count - meanG * meanG;
    const varianceB = sumSquareB / count - meanB * meanB;

    const totalVariance = varianceR + varianceG + varianceB;

    // Low variance = uniform color = likely empty
    // Threshold: < 500 is very uniform (empty cell or solid background)
    const EMPTY_THRESHOLD = 500;

    return totalVariance < EMPTY_THRESHOLD;
}

/**
 * Extract border pixels from an image region
 * Used for rarity detection
 */
export function extractBorderPixels(imageData: ImageData, borderWidth: number = 2): Uint8ClampedArray {
    const { width, height, data } = imageData;
    const borderPixels: number[] = [];

    // Top and bottom borders
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < borderWidth; y++) {
            // Top border
            const topIndex = (y * width + x) * 4;
            borderPixels.push(data[topIndex] ?? 0, data[topIndex + 1] ?? 0, data[topIndex + 2] ?? 0);

            // Bottom border
            const bottomIndex = ((height - 1 - y) * width + x) * 4;
            borderPixels.push(data[bottomIndex] ?? 0, data[bottomIndex + 1] ?? 0, data[bottomIndex + 2] ?? 0);
        }
    }

    // Left and right borders
    for (let y = borderWidth; y < height - borderWidth; y++) {
        for (let x = 0; x < borderWidth; x++) {
            // Left border
            const leftIndex = (y * width + x) * 4;
            borderPixels.push(data[leftIndex] ?? 0, data[leftIndex + 1] ?? 0, data[leftIndex + 2] ?? 0);

            // Right border
            const rightIndex = (y * width + (width - 1 - x)) * 4;
            borderPixels.push(data[rightIndex] ?? 0, data[rightIndex + 1] ?? 0, data[rightIndex + 2] ?? 0);
        }
    }

    return new Uint8ClampedArray(borderPixels);
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
            rarityVotes[rarity]++;
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
