// ========================================
// CV Color Utilities
// Helper functions and color space conversions
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
        // Green - widened ranges for noise tolerance
        h: [85, 155],
        s: [30, 100],
        l: [20, 70],
        rgb: { r: [0, 150], g: [100, 255], b: [0, 150] },
    },
    rare: {
        name: 'rare',
        // Blue - widened red range to include pure blue [0, 128, 255]
        h: [190, 250],
        s: [50, 100],
        l: [35, 70],
        rgb: { r: [0, 150], g: [60, 220], b: [150, 255] },
    },
    epic: {
        name: 'epic',
        // Purple - widened green range to include [128, 0, 255]
        h: [260, 320],
        s: [40, 100],
        l: [25, 70],
        rgb: { r: [100, 220], g: [0, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        // Orange/Gold - widened blue range to include pure orange [255, 165, 0]
        h: [15, 55],
        s: [70, 100],
        l: [40, 80],
        rgb: { r: [200, 255], g: [80, 220], b: [0, 150] },
    },
};

/**
 * Get adjacent/related colors for a given primary color
 * Used for expanded color filtering when exact match fails
 */
export function getAdjacentColors(color: string): string[] {
    // Define color adjacency relationships based on color wheel and common variations
    const adjacencyMap: Record<string, string[]> = {
        red: ['orange', 'magenta', 'purple'],
        orange: ['red', 'yellow'],
        yellow: ['orange', 'lime', 'green'],
        green: ['lime', 'cyan', 'yellow'],
        lime: ['green', 'yellow', 'cyan'],
        cyan: ['green', 'blue', 'lime'],
        blue: ['cyan', 'purple', 'navy'],
        purple: ['blue', 'magenta', 'red'],
        magenta: ['purple', 'red'],
        gray: ['black', 'white'],
        black: ['gray'],
        white: ['gray'],
    };

    return adjacencyMap[color] || [];
}

/**
 * Get all color candidates for filtering, including adjacent colors
 * Returns array of colors in priority order: [exact, ...adjacent]
 */
export function getColorCandidates(color: string): string[] {
    const adjacent = getAdjacentColors(color);
    return [color, ...adjacent];
}

// ========================================
// Empty Cell Detection Constants
// ========================================

export const EMPTY_CELL_MEAN_THRESHOLD = 40; // Very dark cells are empty

// New detection method thresholds (Ideas #1, #2, #3, #7)
export const EMPTY_DETECTION_CONFIG = {
    // #1: Confidence threshold - discard matches below this after template matching
    MIN_CONFIDENCE: 0.5,
    // #2: Saturation check - low saturation cells are likely empty (grey backgrounds)
    MAX_SATURATION: 0.15,
    // #3: Histogram width - cells with few distinct colors are likely empty
    // Value of 3 means cells with ≤2 colors are considered empty (solid backgrounds)
    MIN_HISTOGRAM_BINS: 3,
    // #7: Center/edge ratio - uniform cells (no icon in center) are likely empty
    // Value of 1.1 means center variance should be at least 10% higher than edges
    // Lower threshold to avoid false positives on small/synthetic test images
    MIN_CENTER_EDGE_RATIO: 1.1,

    // Toggle which methods are active
    methods: {
        useVariance: true, // Existing method (variance + edge density)
        useConfidenceThreshold: true, // #1: Post-match confidence filter
        useSaturation: true, // #2: Low saturation = empty (good for grey backgrounds)
        useHistogram: true, // #3: Few colors = empty (enabled)
        useCenterEdge: true, // #7: Uniform = empty (enabled)
    },
};

// ========================================
// Color Calculation Utilities
// ========================================

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
 * #2: Calculate average color saturation (HSL-based)
 * Returns value from 0 (grayscale) to 1 (fully saturated)
 *
 * Why it works: Item icons have vibrant colors (high saturation)
 * while stone/brick backgrounds are grey (low saturation)
 */
export function calculateAverageSaturation(imageData: ImageData): number {
    const pixels = imageData.data;
    let totalSaturation = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        // Saturation formula (HSL-based)
        // Saturation = 0 when max == min (pure grey)
        let saturation = 0;
        if (max !== min) {
            const lightness = (max + min) / 2;
            if (lightness <= 127.5) {
                saturation = (max - min) / (max + min);
            } else {
                saturation = (max - min) / (510 - max - min);
            }
        }

        totalSaturation += saturation;
        count++;
    }

    return count > 0 ? totalSaturation / count : 0;
}

/**
 * #3: Calculate color histogram width (number of distinct color bins)
 * Returns count of occupied bins (0-512)
 *
 * Why it works: Item icons have multiple distinct colors (outline, fill, highlights)
 * while backgrounds have few colors (grey variations)
 */
export function calculateHistogramWidth(imageData: ImageData): number {
    const pixels = imageData.data;
    const bins = new Set<number>();

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        // Quantize to 32 bins (5 bits per channel → 8 levels each)
        // This gives 8*8*8 = 512 possible unique bins
        const rBin = Math.floor(r / 32);
        const gBin = Math.floor(g / 32);
        const bBin = Math.floor(b / 32);
        const binIndex = (rBin << 6) | (gBin << 3) | bBin;

        bins.add(binIndex);
    }

    return bins.size;
}

/**
 * #7: Calculate center vs edge variance ratio
 * Returns ratio of center variance to edge variance
 *
 * Why it works: Item icons are centered, so center region should be
 * more detailed than edges. Uniform backgrounds have ratio ~1.0
 */
export function calculateCenterEdgeRatio(imageData: ImageData): number {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Define center region (inner 50%) and edge region (outer 25% ring)
    const marginX = Math.floor(width * 0.25);
    const marginY = Math.floor(height * 0.25);

    // Calculate variance for center region
    let centerSumR = 0,
        centerSumG = 0,
        centerSumB = 0;
    let centerSumSqR = 0,
        centerSumSqG = 0,
        centerSumSqB = 0;
    let centerCount = 0;

    // Calculate variance for edge region
    let edgeSumR = 0,
        edgeSumG = 0,
        edgeSumB = 0;
    let edgeSumSqR = 0,
        edgeSumSqG = 0,
        edgeSumSqB = 0;
    let edgeCount = 0;

    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            // Check if this pixel is in center or edge region
            const inCenterX = x >= marginX && x < width - marginX;
            const inCenterY = y >= marginY && y < height - marginY;

            if (inCenterX && inCenterY) {
                // Center region
                centerSumR += r;
                centerSumG += g;
                centerSumB += b;
                centerSumSqR += r * r;
                centerSumSqG += g * g;
                centerSumSqB += b * b;
                centerCount++;
            } else {
                // Edge region
                edgeSumR += r;
                edgeSumG += g;
                edgeSumB += b;
                edgeSumSqR += r * r;
                edgeSumSqG += g * g;
                edgeSumSqB += b * b;
                edgeCount++;
            }
        }
    }

    // Calculate variances
    if (centerCount === 0 || edgeCount === 0) return 1.0;

    const centerMeanR = centerSumR / centerCount;
    const centerMeanG = centerSumG / centerCount;
    const centerMeanB = centerSumB / centerCount;
    const centerVariance =
        centerSumSqR / centerCount -
        centerMeanR * centerMeanR +
        (centerSumSqG / centerCount - centerMeanG * centerMeanG) +
        (centerSumSqB / centerCount - centerMeanB * centerMeanB);

    const edgeMeanR = edgeSumR / edgeCount;
    const edgeMeanG = edgeSumG / edgeCount;
    const edgeMeanB = edgeSumB / edgeCount;
    const edgeVariance =
        edgeSumSqR / edgeCount -
        edgeMeanR * edgeMeanR +
        (edgeSumSqG / edgeCount - edgeMeanG * edgeMeanG) +
        (edgeSumSqB / edgeCount - edgeMeanB * edgeMeanB);

    // Return ratio (add 1 to avoid division by zero)
    return centerVariance / (edgeVariance + 1);
}

/**
 * Calculate edge density using gradient detection
 * Returns ratio of edge pixels to total pixels (0-1)
 */
export function calculateEdgeDensity(imageData: ImageData): number {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let edgePixels = 0;
    let totalPixels = 0;

    // Simple gradient detection: compare each pixel to neighbors
    for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
            const idx = (y * width + x) * 4;

            // Get grayscale values
            const center = ((pixels[idx] ?? 0) + (pixels[idx + 1] ?? 0) + (pixels[idx + 2] ?? 0)) / 3;
            const right = ((pixels[idx + 4] ?? 0) + (pixels[idx + 5] ?? 0) + (pixels[idx + 6] ?? 0)) / 3;
            const bottom =
                ((pixels[idx + width * 4] ?? 0) +
                    (pixels[idx + width * 4 + 1] ?? 0) +
                    (pixels[idx + width * 4 + 2] ?? 0)) /
                3;

            // Calculate gradient magnitude
            const gradX = Math.abs(right - center);
            const gradY = Math.abs(bottom - center);
            const gradient = gradX + gradY;

            if (gradient > 30) {
                edgePixels++;
            }
            totalPixels++;
        }
    }

    return totalPixels > 0 ? edgePixels / totalPixels : 0;
}
