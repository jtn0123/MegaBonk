// ========================================
// Enhanced CV Similarity Algorithms
// ========================================
// Similarity calculation algorithms for template matching
// NCC, SSD, and SSIM implementations

/**
 * Calculate similarity using specified algorithm
 */
export function calculateSimilarity(
    imageData1: ImageData,
    imageData2: ImageData,
    algorithm: 'ncc' | 'ssd' | 'ssim'
): number {
    switch (algorithm) {
        case 'ssd':
            return calculateSSD(imageData1, imageData2);
        case 'ssim':
            return calculateSSIM(imageData1, imageData2);
        case 'ncc':
        default:
            return calculateNCC(imageData1, imageData2);
    }
}

/**
 * Normalized Cross-Correlation (current method)
 */
export function calculateNCC(imageData1: ImageData, imageData2: ImageData): number {
    let sum1 = 0,
        sum2 = 0,
        sumProduct = 0,
        sumSquare1 = 0,
        sumSquare2 = 0,
        count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    const mean1 = sum1 / count;
    const mean2 = sum2 / count;

    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) return 0;

    return (numerator / denominator + 1) / 2;
}

/**
 * Sum of Squared Differences (faster)
 */
export function calculateSSD(imageData1: ImageData, imageData2: ImageData): number {
    let sum = 0;
    let count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        const diff = gray1 - gray2;
        sum += diff * diff;
        count++;
    }

    const avgSSD = sum / count;
    // Normalize to 0-1 (lower SSD = higher similarity)
    return 1 / (1 + avgSSD / 255);
}

/**
 * Structural Similarity Index (SSIM) - more accurate but slower
 */
export function calculateSSIM(imageData1: ImageData, imageData2: ImageData): number {
    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;

    let sum1 = 0,
        sum2 = 0,
        sumSquare1 = 0,
        sumSquare2 = 0,
        sumProduct = 0,
        count = 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 4) {
        const gray1 = ((pixels1[i] ?? 0) + (pixels1[i + 1] ?? 0) + (pixels1[i + 2] ?? 0)) / 3;
        const gray2 = ((pixels2[i] ?? 0) + (pixels2[i + 1] ?? 0) + (pixels2[i + 2] ?? 0)) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        sumProduct += gray1 * gray2;
        count++;
    }

    const mean1 = sum1 / count;
    const mean2 = sum2 / count;
    const var1 = sumSquare1 / count - mean1 * mean1;
    const var2 = sumSquare2 / count - mean2 * mean2;
    const covar = sumProduct / count - mean1 * mean2;

    const luminance = (2 * mean1 * mean2 + C1) / (mean1 * mean1 + mean2 * mean2 + C1);
    const contrast = (2 * Math.sqrt(var1) * Math.sqrt(var2) + C2) / (var1 + var2 + C2);
    const structure = (covar + C2 / 2) / (Math.sqrt(var1) * Math.sqrt(var2) + C2 / 2);

    return luminance * contrast * structure;
}
