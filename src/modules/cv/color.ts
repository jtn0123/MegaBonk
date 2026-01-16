// ========================================
// CV Color Analysis
// ========================================

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
        if (avgR > 180 && avgG > 140) return 'yellow';
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
 * Detect rarity from border color
 * Returns rarity string or null if no clear match
 */
export function detectBorderRarity(imageData: ImageData): string | null {
    const borderPixels = extractBorderPixels(imageData, 3);

    // Calculate average RGB
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let i = 0; i < borderPixels.length; i += 3) {
        sumR += borderPixels[i] ?? 0;
        sumG += borderPixels[i + 1] ?? 0;
        sumB += borderPixels[i + 2] ?? 0;
        count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    // Define rarity colors (approximate, may need tuning)
    const rarityColors: Record<string, { r: number; g: number; b: number; tolerance: number }> = {
        common: { r: 128, g: 128, b: 128, tolerance: 40 }, // Gray
        uncommon: { r: 0, g: 255, b: 0, tolerance: 60 }, // Green
        rare: { r: 0, g: 128, b: 255, tolerance: 60 }, // Blue
        epic: { r: 128, g: 0, b: 255, tolerance: 60 }, // Purple
        legendary: { r: 255, g: 165, b: 0, tolerance: 60 }, // Orange/Gold
    };

    // Find closest color match
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [rarity, color] of Object.entries(rarityColors)) {
        const distance = Math.sqrt(
            Math.pow(avgR - color.r, 2) + Math.pow(avgG - color.g, 2) + Math.pow(avgB - color.b, 2)
        );

        if (distance < color.tolerance && distance < bestDistance) {
            bestMatch = rarity;
            bestDistance = distance;
        }
    }

    return bestMatch;
}
