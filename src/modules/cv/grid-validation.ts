// ========================================
// Grid Validation - Verification and Validation Logic
// Cell validation, grid validation, preset comparison
// ========================================

import type {
    BandRegion,
    CellValidation,
    FieldComparison,
    GridCalibration,
    GridPosition,
    IconMetrics,
    PresetComparison,
    ValidatedCell,
    ValidationResult,
} from './grid-types.ts';

// ========================================
// Pass 5: Validate Grid
// ========================================

/**
 * Validate detected grid positions by checking cell contents
 */
export function validateGrid(ctx: CanvasRenderingContext2D, positions: GridPosition[]): ValidationResult {
    const validCells: ValidatedCell[] = [];
    const emptyCells: ValidatedCell[] = [];
    const suspiciousCells: ValidatedCell[] = [];

    for (const cell of positions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const validation = validateCell(cellData);

        if (validation.isEmpty) {
            emptyCells.push({ ...cell, validation });
        } else if (validation.isSuspicious) {
            suspiciousCells.push({ ...cell, validation });
        } else {
            validCells.push({ ...cell, validation });
        }
    }

    // Calculate overall confidence
    const totalCells = positions.length;
    const validRatio = validCells.length / totalCells;
    const emptyRatio = emptyCells.length / totalCells;

    // Good confidence if we have a reasonable number of valid cells
    // and not too many empty cells in the middle
    let confidence = validRatio;
    if (emptyRatio > 0.5) {
        confidence *= 0.5; // Penalize if mostly empty
    }

    return {
        validCells,
        emptyCells,
        suspiciousCells,
        totalCells,
        confidence,
        stats: {
            valid: validCells.length,
            empty: emptyCells.length,
            suspicious: suspiciousCells.length,
        },
    };
}

/**
 * Validate a single cell
 */
function validateCell(imageData: ImageData): CellValidation {
    const pixels = imageData.data;

    let sumR = 0,
        sumG = 0,
        sumB = 0;
    let sumSqR = 0,
        sumSqG = 0,
        sumSqB = 0;
    let colorfulPixels = 0;
    let count = 0;

    // Sample pixels
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        sumR += r;
        sumG += g;
        sumB += b;
        sumSqR += r * r;
        sumSqG += g * g;
        sumSqB += b * b;

        // Check for colorful pixels
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation > 40) colorfulPixels++;

        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;
    const meanBrightness = (meanR + meanG + meanB) / 3;

    const varianceR = sumSqR / count - meanR * meanR;
    const varianceG = sumSqG / count - meanG * meanG;
    const varianceB = sumSqB / count - meanB * meanB;
    const totalVariance = varianceR + varianceG + varianceB;

    const colorfulRatio = colorfulPixels / count;

    // Determine cell status
    // Variance <400 or brightness <30 = likely empty
    const isEmpty = totalVariance < 400 || meanBrightness < 30;
    // Variance <600 and colorful ratio <0.1 = suspicious
    const isSuspicious = totalVariance < 600 && colorfulRatio < 0.1;

    return {
        isEmpty,
        isSuspicious,
        meanBrightness,
        totalVariance,
        colorfulRatio,
    };
}

// ========================================
// Overall Confidence Calculation
// ========================================

/**
 * Calculate overall confidence score
 */
export function calculateOverallConfidence(
    bandRegion: BandRegion,
    metrics: IconMetrics,
    validation: ValidationResult
): number {
    const bandConf = bandRegion.confidence || 0;
    const metricsConf = metrics.confidence || 0;
    const validationConf = validation.confidence || 0;

    // Weighted average
    const overall = bandConf * 0.2 + metricsConf * 0.4 + validationConf * 0.4;

    return Math.min(1, Math.max(0, overall));
}

// ========================================
// Comparison with Presets
// ========================================

/**
 * Compare auto-detected calibration with a saved preset
 */
export function compareWithPreset(
    autoCalibration: GridCalibration | null,
    presetCalibration: GridCalibration | null
): PresetComparison | null {
    if (!autoCalibration || !presetCalibration) {
        return null;
    }

    const fieldNames = [
        'iconWidth',
        'iconHeight',
        'xSpacing',
        'ySpacing',
        'xOffset',
        'yOffset',
        'iconsPerRow',
        'numRows',
    ];

    const fields: Record<string, FieldComparison> = {};
    let totalDiff = 0;
    let matchingFields = 0;

    // Define tolerances for each field
    const tolerances: Record<string, number> = {
        iconWidth: 3,
        iconHeight: 3,
        xSpacing: 2,
        ySpacing: 2,
        xOffset: 10,
        yOffset: 10,
        iconsPerRow: 2,
        numRows: 1,
    };

    for (const field of fieldNames) {
        const autoVal = (autoCalibration as unknown as Record<string, number>)[field] ?? 0;
        const presetVal = (presetCalibration as unknown as Record<string, number>)[field] ?? 0;
        const diff = Math.abs(autoVal - presetVal);

        const tolerance = tolerances[field] ?? 5;
        const isClose = diff <= tolerance;

        fields[field] = {
            auto: autoVal,
            preset: presetVal,
            diff,
            isClose,
        };

        totalDiff += diff;
        if (isClose) matchingFields++;
    }

    const matchScore = (matchingFields / fieldNames.length) * 100;

    return {
        fields,
        matchScore,
        totalDiff,
        recommendation:
            matchScore >= 70
                ? 'Auto-detection matches preset well'
                : 'Auto-detection differs significantly from preset',
    };
}
