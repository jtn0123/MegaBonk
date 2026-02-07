// ========================================
// Grid Structure Inference
// ========================================

import type { ROI } from '../types.ts';
import type { GridParameters } from './grid-types.ts';

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
