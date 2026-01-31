// ========================================
// Grid Pattern Verification
// ========================================

import { logger } from '../../logger.ts';
import type { CVDetectionResult } from '../types.ts';
import type { GridVerificationResult } from './grid-types.ts';

/**
 * Find the mode (most common value) in an array with tolerance
 */
export function findMode(values: number[], tolerance: number): { mode: number; count: number; stdDev: number } {
    if (values.length === 0) {
        return { mode: 0, count: 0, stdDev: 0 };
    }

    const buckets = new Map<number, number[]>();
    for (const value of values) {
        const bucket = Math.round(value / tolerance) * tolerance;
        if (!buckets.has(bucket)) {
            buckets.set(bucket, []);
        }
        buckets.get(bucket)!.push(value);
    }

    let mode = 0;
    let maxCount = 0;
    let modeValues: number[] = [];
    for (const [bucket, vals] of buckets) {
        if (vals.length > maxCount) {
            maxCount = vals.length;
            mode = bucket;
            modeValues = vals;
        }
    }

    // Calculate standard deviation of values in the mode bucket
    let stdDev = 0;
    if (modeValues.length > 1) {
        const mean = modeValues.reduce((a, b) => a + b, 0) / modeValues.length;
        const variance = modeValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / modeValues.length;
        stdDev = Math.sqrt(variance);
    }

    return { mode, count: maxCount, stdDev };
}

/**
 * Calculate adaptive tolerance based on actual spacing variance
 * Uses 2 * standard deviation, clamped to reasonable range
 */
export function calculateAdaptiveTolerance(spacings: number[], expectedIconSize: number, baseStdDev: number): number {
    // Base tolerance from expected icon size
    const baseTolerance = expectedIconSize * 0.2; // 20% base

    if (spacings.length < 3 || baseStdDev === 0) {
        return baseTolerance;
    }

    // Adaptive tolerance: 2 * stdDev, but clamped
    const adaptiveTolerance = baseStdDev * 2;

    // Clamp between 15% and 35% of expected icon size
    const minTolerance = expectedIconSize * 0.15;
    const maxTolerance = expectedIconSize * 0.35;

    return Math.max(minTolerance, Math.min(maxTolerance, Math.max(adaptiveTolerance, baseTolerance)));
}

/**
 * Check if a value fits within a grid with given spacing
 * @internal Reserved for future grid validation enhancements
 */
export function fitsGrid(value: number, gridStart: number, spacing: number, tolerance: number): boolean {
    if (spacing <= 0) return true;
    const offset = (value - gridStart) % spacing;
    return offset <= tolerance || offset >= spacing - tolerance;
}

/**
 * Cluster detections into rows based on Y position
 * Returns array of rows, each containing positions with similar Y
 */
export function clusterByY(
    positions: Array<{ x: number; y: number; detection: CVDetectionResult }>,
    yTolerance: number
): Array<Array<{ x: number; y: number; detection: CVDetectionResult }>> {
    if (positions.length === 0) return [];

    // Sort by Y
    const sorted = [...positions].sort((a, b) => a.y - b.y);
    const firstItem = sorted[0];
    if (!firstItem) return [];

    const rows: Array<Array<{ x: number; y: number; detection: CVDetectionResult }>> = [];
    let currentRow: typeof positions = [firstItem];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const previous = sorted[i - 1];
        if (!current || !previous) continue;

        const yDiff = current.y - previous.y;
        if (yDiff <= yTolerance) {
            // Same row
            currentRow.push(current);
        } else {
            // New row
            rows.push(currentRow);
            currentRow = [current];
        }
    }
    rows.push(currentRow);

    return rows;
}

/**
 * Verify that detections form a consistent grid pattern
 * Uses row-aware verification and adaptive tolerance for better accuracy
 */
export function verifyGridPattern(detections: CVDetectionResult[], expectedIconSize: number): GridVerificationResult {
    // Need at least 3 detections to verify a pattern
    if (detections.length < 3) {
        return {
            isValid: true, // Trust small sets
            confidence: 0.5,
            filteredDetections: detections,
            gridParams: null,
        };
    }

    // Extract positions
    const positions = detections
        .filter(d => d.position)
        .map(d => ({
            x: d.position!.x,
            y: d.position!.y,
            detection: d,
        }));

    if (positions.length < 3) {
        return {
            isValid: true,
            confidence: 0.5,
            filteredDetections: detections,
            gridParams: null,
        };
    }

    // Phase 1: Cluster into rows (row-aware approach)
    const yClusterTolerance = expectedIconSize * 0.3;
    const rows = clusterByY(positions, yClusterTolerance);

    // Phase 2: Calculate X spacings within each row
    const allXSpacings: number[] = [];
    for (const row of rows) {
        if (row.length < 2) continue;
        const sortedRow = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sortedRow.length; i++) {
            const current = sortedRow[i];
            const previous = sortedRow[i - 1];
            if (!current || !previous) continue;

            const gap = current.x - previous.x;
            if (gap > expectedIconSize * 0.5 && gap < expectedIconSize * 2.5) {
                allXSpacings.push(gap);
            }
        }
    }

    // Phase 3: Calculate Y spacings between row centers
    const ySpacings: number[] = [];
    if (rows.length > 1) {
        // Calculate row centers
        const rowCenters = rows
            .map(row => {
                const avgY = row.reduce((sum, p) => sum + p.y, 0) / row.length;
                return avgY;
            })
            .sort((a, b) => a - b);

        for (let i = 1; i < rowCenters.length; i++) {
            const current = rowCenters[i];
            const previous = rowCenters[i - 1];
            if (current === undefined || previous === undefined) continue;

            const gap = current - previous;
            if (gap > expectedIconSize * 0.5 && gap < expectedIconSize * 2.5) {
                ySpacings.push(gap);
            }
        }
    }

    // Find mode spacing with variance tracking
    const baseTolerance = Math.max(6, expectedIconSize * 0.15);
    const xMode = findMode(allXSpacings, baseTolerance);
    const yMode =
        ySpacings.length > 0 ? findMode(ySpacings, baseTolerance) : { mode: expectedIconSize, count: 0, stdDev: 0 };

    // Use expected icon size as fallback
    const xSpacing = xMode.count >= 2 ? xMode.mode : expectedIconSize;
    const ySpacing = yMode.count >= 2 ? yMode.mode : expectedIconSize;

    // Calculate adaptive tolerance based on observed variance
    const xTolerance = calculateAdaptiveTolerance(allXSpacings, expectedIconSize, xMode.stdDev);
    const yTolerance = calculateAdaptiveTolerance(ySpacings, expectedIconSize, yMode.stdDev);
    const tolerance = Math.max(xTolerance, yTolerance);

    // Phase 4: Filter detections using row-aware validation
    // Instead of strict grid origin check, verify that items are consistently spaced
    const filtered: typeof positions = [];

    for (const row of rows) {
        if (row.length === 0) continue;

        // For each row, verify X spacing between adjacent items
        const sortedRow = [...row].sort((a, b) => a.x - b.x);

        // Always include the first item in each row
        const firstInRow = sortedRow[0];
        if (firstInRow) {
            filtered.push(firstInRow);
        }

        // Check remaining items: they should be at consistent spacing from previous
        for (let i = 1; i < sortedRow.length; i++) {
            const current = sortedRow[i];
            const previous = sortedRow[i - 1];
            if (!current || !previous) continue;

            const gap = current.x - previous.x;

            // Accept if gap is close to expected spacing (within tolerance)
            const isConsistentSpacing = Math.abs(gap - xSpacing) <= tolerance;

            // Also accept if gap is a multiple of spacing (skipped slots)
            const isMultipleSpacing =
                (gap > xSpacing * 1.5 && Math.abs((gap % xSpacing) - 0) <= tolerance) ||
                Math.abs((gap % xSpacing) - xSpacing) <= tolerance;

            if (isConsistentSpacing || isMultipleSpacing) {
                filtered.push(current);
            }
        }
    }

    // Calculate confidence based on how many detections fit
    const fitRatio = filtered.length / positions.length;

    // More lenient validity check:
    // - At least 70% fit, OR
    // - At most 2 outliers for small sets, OR
    // - At least 80% of each row fits (row-aware)
    const maxOutliers = Math.max(2, Math.ceil(positions.length * 0.15));
    const isValid =
        fitRatio >= 0.7 || positions.length - filtered.length <= maxOutliers || filtered.length >= positions.length - 2;

    logger.info({
        operation: 'cv.grid_verification',
        data: {
            totalDetections: positions.length,
            filteredDetections: filtered.length,
            rows: rows.length,
            xSpacing,
            ySpacing,
            tolerance,
            adaptiveXTolerance: xTolerance,
            fitRatio,
            isValid,
        },
    });

    return {
        isValid,
        confidence: fitRatio,
        filteredDetections: filtered.map(p => p.detection),
        gridParams: {
            xSpacing,
            ySpacing,
            tolerance,
        },
    };
}
