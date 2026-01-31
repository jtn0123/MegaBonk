// ========================================
// CV Grid Detection and Verification
// ========================================

import { logger } from '../logger.ts';
import { detectResolution } from '../test-utils.ts';
import type { CVDetectionResult, ROI } from './types.ts';
import {
    calculateColorVariance,
    countRarityBorderPixels,
    detectRarityAtPixel,
} from './color.ts';

// ========================================
// Grid Parameters Interface
// ========================================

/**
 * Grid parameters detected from icon edges
 */
export interface GridParameters {
    startX: number;
    startY: number;
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
    confidence: number;
}

/**
 * Result of grid verification
 */
export interface GridVerificationResult {
    isValid: boolean;
    confidence: number;
    filteredDetections: CVDetectionResult[];
    gridParams: {
        xSpacing: number;
        ySpacing: number;
        tolerance: number;
    } | null;
}

// ========================================
// Hotbar and Edge Detection
// ========================================

/**
 * Enhanced hotbar region detection using rarity border analysis
 * Returns the Y coordinates of the detected hotbar band
 */
export function detectHotbarRegion(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): { topY: number; bottomY: number; confidence: number } {
    // Scan bottom 35% of screen (hotbar is at very bottom)
    const scanStartY = Math.floor(height * 0.65);
    const scanEndY = height - 5;

    // Sample center 70% of width (hotbar is centered)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    // Analyze horizontal strips
    const stripHeight = 2;
    const strips: Array<{
        y: number;
        rarityRatio: number;
        colorfulRatio: number;
        variance: number;
    }> = [];

    for (let y = scanStartY; y < scanEndY; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const stats = countRarityBorderPixels(imageData);
        const variance = calculateColorVariance(imageData);

        strips.push({
            y,
            rarityRatio: stats.rarityCount / stats.total,
            colorfulRatio: stats.colorfulCount / stats.total,
            variance,
        });
    }

    // Find the best hotbar band using sliding window
    const windowSize = 35; // ~70px window
    let bestScore = 0;
    let bestBandStart = scanStartY;
    let bestBandEnd = scanEndY;

    for (let i = 0; i < strips.length - windowSize; i++) {
        const windowSlice = strips.slice(i, i + windowSize);

        const avgRarityRatio = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.variance, 0) / windowSlice.length;

        let score = 0;

        // Rarity borders are a strong signal
        if (avgRarityRatio > 0.01) {
            score += avgRarityRatio * 200;
        }

        // Colorful pixels indicate icons
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }

        // High variance means varied content (icons)
        if (avgVariance > 200) {
            score += Math.min(30, avgVariance / 50);
        }

        // Prefer lower on screen (hotbar is at very bottom)
        const firstStrip = windowSlice[0];
        const lastStrip = windowSlice[windowSlice.length - 1];
        if (!firstStrip || !lastStrip) continue;

        const yPosition = firstStrip.y / height;
        if (yPosition > 0.88) {
            score += 30;
        } else if (yPosition > 0.82) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = firstStrip.y;
            bestBandEnd = lastStrip.y + stripHeight;
        }
    }

    // Constrain band height
    const maxBandHeight = Math.floor(height * 0.15);
    const minBandHeight = Math.floor(height * 0.05);

    if (bestBandEnd - bestBandStart > maxBandHeight) {
        bestBandStart = bestBandEnd - maxBandHeight;
    }
    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    // Fallback if nothing detected
    if (bestScore < 10) {
        bestBandStart = Math.floor(height * 0.85);
        bestBandEnd = height - 5;
    }

    return {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        confidence: Math.min(1, bestScore / 100),
    };
}

/**
 * Detect vertical edges (icon borders) using rarity colors
 * Returns X positions of detected edges
 */
export function detectIconEdges(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandRegion: { topY: number; bottomY: number }
): number[] {
    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // Only scan center 70% of width
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    // Scan multiple horizontal lines within the band
    const scanYOffsets = [0.1, 0.25, 0.5, 0.75, 0.9];
    const edgeCounts = new Map<number, number>();

    for (const yOffset of scanYOffsets) {
        const scanY = Math.floor(topY + bandHeight * yOffset);
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX;
            const idx = localX * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            const rarity = detectRarityAtPixel(r, g, b);

            if (rarity && !inBorder) {
                inBorder = true;
                borderStart = x;
            } else if (!rarity && inBorder) {
                const borderWidth = x - borderStart;

                // Valid borders are 2-8 pixels wide
                if (borderWidth >= 2 && borderWidth <= 8) {
                    // Record edge at start of border
                    const bucket = Math.round(borderStart / 4) * 4; // 4px tolerance
                    edgeCounts.set(bucket, (edgeCounts.get(bucket) || 0) + 1);
                }

                inBorder = false;
            }
        }
    }

    // Filter to edges detected in multiple scan lines
    const consistentEdges: number[] = [];
    for (const [x, count] of edgeCounts) {
        if (count >= 2) {
            consistentEdges.push(x);
        }
    }

    // Sort by X position
    consistentEdges.sort((a, b) => a - b);

    // Filter by spacing consistency
    return filterByConsistentSpacing(consistentEdges);
}

/**
 * Filter edges to keep only those with consistent spacing
 */
export function filterByConsistentSpacing(edges: number[]): number[] {
    if (edges.length < 3) return edges;

    // Calculate gaps
    const gaps: Array<{ gap: number; fromIdx: number; toIdx: number }> = [];
    for (let i = 1; i < edges.length; i++) {
        const current = edges[i];
        const previous = edges[i - 1];
        if (current === undefined || previous === undefined) continue;

        const gap = current - previous;
        if (gap > 20 && gap < 120) {
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) return edges;

    // Find mode gap (most common spacing)
    const gapCounts = new Map<number, number>();
    const tolerance = 4;

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    let modeGap = 0;
    let modeCount = 0;
    for (const [bucket, count] of gapCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeGap = bucket;
        }
    }

    if (modeCount < 2) return edges;

    // Keep edges that fit the mode spacing
    const consistentIndices = new Set<number>();
    for (const { gap, fromIdx, toIdx } of gaps) {
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentIndices.add(fromIdx);
            consistentIndices.add(toIdx);
        }
    }

    return edges.filter((_, idx) => consistentIndices.has(idx));
}

// ========================================
// Grid Inference
// ========================================

/**
 * Infer grid structure from detected edges
 * Returns grid parameters if a consistent grid pattern is found
 */
export function inferGridFromEdges(
    edges: number[],
    hotbarRegion: { topY: number; bottomY: number },
    _width: number
): GridParameters | null {
    if (edges.length < 2) {
        return null;
    }

    // Calculate spacings between edges
    const spacings: number[] = [];
    for (let i = 1; i < edges.length; i++) {
        const current = edges[i];
        const previous = edges[i - 1];
        if (current === undefined || previous === undefined) continue;

        const spacing = current - previous;
        if (spacing > 20 && spacing < 120) {
            spacings.push(spacing);
        }
    }

    if (spacings.length < 1) {
        return null;
    }

    // Find the mode spacing (most common cell size)
    const spacingCounts = new Map<number, number>();
    const tolerance = 6; // 6px tolerance for grouping

    for (const spacing of spacings) {
        const bucket = Math.round(spacing / tolerance) * tolerance;
        spacingCounts.set(bucket, (spacingCounts.get(bucket) || 0) + 1);
    }

    let modeSpacing = 0;
    let modeCount = 0;
    for (const [bucket, count] of spacingCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeSpacing = bucket;
        }
    }

    // Need at least 2 consistent gaps
    if (modeCount < 2 || modeSpacing < 25) {
        return null;
    }

    // Find the first edge that starts a consistent sequence
    let startX = edges[0] ?? 0;
    for (let i = 0; i < edges.length - 1; i++) {
        const current = edges[i];
        const next = edges[i + 1];
        if (current === undefined || next === undefined) continue;

        const gap = next - current;
        if (Math.abs(gap - modeSpacing) <= tolerance) {
            startX = current;
            break;
        }
    }

    // Count consistent columns
    let columns = 1;
    let lastEdgeX = startX;
    for (let i = 0; i < edges.length; i++) {
        const edgeX = edges[i];
        if (edgeX === undefined || edgeX <= lastEdgeX) continue;
        const gap = edgeX - lastEdgeX;
        if (Math.abs(gap - modeSpacing) <= tolerance) {
            columns++;
            lastEdgeX = edgeX;
        }
    }

    // Calculate confidence based on consistency
    const expectedEdges = columns;
    const actualConsistentEdges = modeCount + 1;
    const confidence = Math.min(1, actualConsistentEdges / Math.max(3, expectedEdges));

    // Determine rows based on hotbar height
    const bandHeight = hotbarRegion.bottomY - hotbarRegion.topY;
    const rows = Math.max(1, Math.round(bandHeight / modeSpacing));

    return {
        startX,
        startY: hotbarRegion.topY,
        cellWidth: modeSpacing,
        cellHeight: modeSpacing,
        columns,
        rows,
        confidence,
    };
}

/**
 * Generate grid cell ROIs from grid parameters
 */
export function generateGridROIs(grid: GridParameters, maxCells: number = 50): ROI[] {
    const cells: ROI[] = [];

    for (let row = 0; row < grid.rows && cells.length < maxCells; row++) {
        for (let col = 0; col < grid.columns && cells.length < maxCells; col++) {
            cells.push({
                x: grid.startX + col * grid.cellWidth,
                y: grid.startY + row * grid.cellHeight,
                width: grid.cellWidth,
                height: grid.cellHeight,
                label: `grid_${row}_${col}`,
            });
        }
    }

    return cells;
}

// ========================================
// Adaptive Icon Sizes
// ========================================

/**
 * Get adaptive icon sizes based on image dimensions
 * Returns array of sizes to try for multi-scale detection
 */
export function getAdaptiveIconSizes(width: number, height: number): number[] {
    const resolution = detectResolution(width, height);

    // Base sizes for each resolution
    const baseSizes: Record<string, number[]> = {
        '720p': [32, 38, 44],
        '1080p': [40, 48, 56],
        '1440p': [48, 55, 64],
        '4K': [64, 72, 80],
        steam_deck: [36, 42, 48],
    };

    return baseSizes[resolution.category] || [40, 50, 60];
}

/**
 * Dynamic scale detection result
 */
export interface ScaleDetectionResult {
    iconSize: number;
    confidence: number;
    method: 'edge_analysis' | 'resolution_fallback';
}

/**
 * Dynamically detect icon scale from border analysis
 * More accurate than resolution-based estimation
 */
export function detectIconScale(ctx: CanvasRenderingContext2D, width: number, height: number): ScaleDetectionResult {
    // First try to detect from edge analysis
    const hotbar = detectHotbarRegion(ctx, width, height);

    if (hotbar.confidence < 0.3) {
        // Low confidence in hotbar detection, use resolution fallback
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.5,
            method: 'resolution_fallback',
        };
    }

    const edges = detectIconEdges(ctx, width, hotbar);

    if (edges.length < 2) {
        // Not enough edges detected, use resolution fallback
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.4,
            method: 'resolution_fallback',
        };
    }

    // Compute spacings between edges
    const spacings: number[] = [];
    for (let i = 1; i < edges.length; i++) {
        const current = edges[i];
        const previous = edges[i - 1];
        if (current === undefined || previous === undefined) continue;

        const spacing = current - previous;
        // Valid icon sizes are between 25 and 100 pixels
        if (spacing >= 25 && spacing <= 100) {
            spacings.push(spacing);
        }
    }

    if (spacings.length < 2) {
        const sizes = getAdaptiveIconSizes(width, height);
        return {
            iconSize: sizes[1] || 48,
            confidence: 0.4,
            method: 'resolution_fallback',
        };
    }

    // Find mode spacing (most common)
    const tolerance = 4;
    const buckets = new Map<number, number>();
    for (const spacing of spacings) {
        const bucket = Math.round(spacing / tolerance) * tolerance;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    let modeSpacing = 0;
    let modeCount = 0;
    for (const [bucket, count] of buckets) {
        if (count > modeCount) {
            modeCount = count;
            modeSpacing = bucket;
        }
    }

    // Calculate confidence based on consistency
    const matchingSpacings = spacings.filter(s => Math.abs(s - modeSpacing) <= tolerance).length;
    const confidence = Math.min(0.95, matchingSpacings / spacings.length);

    logger.info({
        operation: 'cv.scale_detection',
        data: {
            edgesFound: edges.length,
            spacings: spacings.length,
            detectedSize: modeSpacing,
            confidence,
        },
    });

    return {
        iconSize: modeSpacing,
        confidence,
        method: 'edge_analysis',
    };
}

/**
 * Detect grid structure in image (for item grids)
 * Returns potential grid positions with dynamic detection
 * @deprecated Use detectIconsWithSlidingWindow for better accuracy
 */
export function detectGridPositions(width: number, height: number, _gridSize: number = 64): ROI[] {
    // Use resolution-appropriate grid size
    const resolution = detectResolution(width, height);

    // MegaBonk icons are approximately 40-48px depending on resolution
    const gridSizes: Record<string, number> = {
        '720p': 38,
        '1080p': 45,
        '1440p': 55,
        '4K': 70,
        steam_deck: 40,
    };

    const adaptiveGridSize = gridSizes[resolution.category] || 45;

    const positions: ROI[] = [];
    const margin = 50; // Hotbar has margins on sides
    const spacing = Math.floor(adaptiveGridSize * 0.12); // Small gap between icons

    // MegaBonk hotbar is at the VERY BOTTOM of the screen (last 5-8%)
    // For 1080p: approximately y=1020-1030
    const hotbarY = height - adaptiveGridSize - 15; // 15px from bottom edge

    for (let x = margin; x < width - margin - adaptiveGridSize; x += adaptiveGridSize + spacing) {
        positions.push({
            x,
            y: hotbarY,
            width: adaptiveGridSize,
            height: adaptiveGridSize,
            label: `cell_${positions.length}`,
        });
    }

    // Limit to reasonable number of cells (typical inventory has 15-25 slots)
    return positions.slice(0, 30);
}

// ========================================
// Grid Verification
// ========================================

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
