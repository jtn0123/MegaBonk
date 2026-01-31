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
 * Get detailed hierarchical color category from ImageData
 * More accurate than simple dominant color for template matching
 */
export function getDetailedColorCategory(imageData: ImageData): DetailedColorCategory {
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

    if (count === 0) {
        return { primary: 'gray', secondary: 'neutral', saturation: 'low', brightness: 'medium' };
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    // Calculate HSL-like values
    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;
    const lightness = (maxChannel + minChannel) / 2;
    const saturationValue = diff === 0 ? 0 : diff / (255 - Math.abs(2 * lightness - 255));

    // Determine saturation level
    let saturation: 'low' | 'medium' | 'high';
    if (saturationValue < 0.2) saturation = 'low';
    else if (saturationValue < 0.5) saturation = 'medium';
    else saturation = 'high';

    // Determine brightness level
    let brightness: 'dark' | 'medium' | 'bright';
    if (lightness < 80) brightness = 'dark';
    else if (lightness < 180) brightness = 'medium';
    else brightness = 'bright';

    // Determine primary and secondary colors
    let primary: string;
    let secondary: string;

    // Low saturation = achromatic
    if (diff < 30) {
        primary = 'gray';
        if (lightness < 60) secondary = 'black';
        else if (lightness > 200) secondary = 'white';
        else secondary = 'neutral';
        return { primary, secondary, saturation, brightness };
    }

    // Chromatic colors - determine by dominant channel
    if (avgR >= avgG && avgR >= avgB) {
        // Red dominant
        primary = 'red';
        if (avgG > avgB * 1.5 && avgG > 100) {
            secondary = avgG > 180 ? 'yellow' : 'orange';
        } else if (avgB > avgG * 1.2 && avgB > 80) {
            secondary = 'magenta';
        } else {
            secondary = avgR > 200 ? 'bright_red' : 'dark_red';
        }
    } else if (avgG >= avgR && avgG >= avgB) {
        // Green dominant
        primary = 'green';
        if (avgB > avgR * 1.3 && avgB > 80) {
            secondary = 'cyan';
        } else if (avgR > avgB && avgR > 100) {
            secondary = 'lime';
        } else {
            secondary = avgG > 200 ? 'bright_green' : 'forest';
        }
    } else {
        // Blue dominant
        primary = 'blue';
        if (avgR > avgG * 1.3 && avgR > 80) {
            secondary = 'purple';
        } else if (avgG > avgR && avgG > 100) {
            secondary = 'sky';
        } else {
            secondary = avgB > 200 ? 'bright_blue' : 'navy';
        }
    }

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
