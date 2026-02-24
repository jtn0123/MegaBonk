// ========================================
// CV Color Extraction
// Extracting colors from images, dominant color detection
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
 * Hierarchical color category with detailed information
 * Provides richer color matching for better pre-filtering
 */
export interface DetailedColorCategory {
    primary: string; // Main color category
    secondary: string; // More specific subcategory
    saturation: 'low' | 'medium' | 'high';
    brightness: 'dark' | 'medium' | 'bright';
}

/**
 * Compute average RGB from sampled pixels
 */
function computeAverageRGB(pixels: Uint8ClampedArray): { avgR: number; avgG: number; avgB: number; count: number } {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }
    return { avgR: count ? sumR / count : 0, avgG: count ? sumG / count : 0, avgB: count ? sumB / count : 0, count };
}

/**
 * Classify saturation level from a 0-1 value
 */
function classifySaturation(value: number): 'low' | 'medium' | 'high' {
    if (value < 0.2) return 'low';
    if (value < 0.5) return 'medium';
    return 'high';
}

/**
 * Classify brightness level from lightness value
 */
function classifyBrightness(lightness: number): 'dark' | 'medium' | 'bright' {
    if (lightness < 80) return 'dark';
    if (lightness < 180) return 'medium';
    return 'bright';
}

/**
 * Determine achromatic (gray) secondary color
 */
function getAchromaticSecondary(lightness: number): string {
    if (lightness < 60) return 'black';
    if (lightness > 200) return 'white';
    return 'neutral';
}

/**
 * Determine chromatic primary/secondary from dominant channel
 */
function classifyChromatic(avgR: number, avgG: number, avgB: number): { primary: string; secondary: string } {
    if (avgR >= avgG && avgR >= avgB) {
        // Red dominant
        if (avgG > avgB * 1.5 && avgG > 100) return { primary: 'red', secondary: avgG > 180 ? 'yellow' : 'orange' };
        if (avgB > avgG * 1.2 && avgB > 80) return { primary: 'red', secondary: 'magenta' };
        return { primary: 'red', secondary: avgR > 200 ? 'bright_red' : 'dark_red' };
    }
    if (avgG >= avgR && avgG >= avgB) {
        // Green dominant
        if (avgB > avgR * 1.3 && avgB > 80) return { primary: 'green', secondary: 'cyan' };
        if (avgR > avgB && avgR > 100) return { primary: 'green', secondary: 'lime' };
        return { primary: 'green', secondary: avgG > 200 ? 'bright_green' : 'forest' };
    }
    // Blue dominant
    if (avgR > avgG * 1.3 && avgR > 80) return { primary: 'blue', secondary: 'purple' };
    if (avgG > avgR && avgG > 100) return { primary: 'blue', secondary: 'sky' };
    return { primary: 'blue', secondary: avgB > 200 ? 'bright_blue' : 'navy' };
}

/**
 * Get detailed hierarchical color category from ImageData
 * More accurate than simple dominant color for template matching
 */
export function getDetailedColorCategory(imageData: ImageData): DetailedColorCategory {
    const { avgR, avgG, avgB, count } = computeAverageRGB(imageData.data);

    if (count === 0) {
        return { primary: 'gray', secondary: 'neutral', saturation: 'low', brightness: 'medium' };
    }

    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;
    const lightness = (maxChannel + minChannel) / 2;
    const saturationValue = diff === 0 ? 0 : diff / (255 - Math.abs(2 * lightness - 255));

    const saturation = classifySaturation(saturationValue);
    const brightness = classifyBrightness(lightness);

    // Low saturation = achromatic
    if (diff < 30) {
        return { primary: 'gray', secondary: getAchromaticSecondary(lightness), saturation, brightness };
    }

    const { primary, secondary } = classifyChromatic(avgR, avgG, avgB);
    return { primary, secondary, saturation, brightness };
}

/**
 * Get dominant color category from ImageData (legacy function)
 * Used for color-based pre-filtering
 */
export function getDominantColor(imageData: ImageData): string {
    const detailed = getDetailedColorCategory(imageData);

    // Map detailed category to simple color string for backward compatibility
    if (detailed.primary === 'gray') {
        if (detailed.secondary === 'black') return 'black';
        if (detailed.secondary === 'white') return 'white';
        return 'gray';
    }

    // Use secondary for more specific colors where available
    if (detailed.secondary === 'yellow' || detailed.secondary === 'orange') {
        return detailed.secondary;
    }
    if (detailed.secondary === 'cyan' || detailed.secondary === 'lime') {
        return detailed.secondary;
    }
    if (detailed.secondary === 'purple' || detailed.secondary === 'magenta') {
        return detailed.secondary;
    }

    return detailed.primary;
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
