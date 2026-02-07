// ========================================
// Adaptive Icon Scale Detection
// ========================================

import { logger } from '../../logger.ts';
import { detectResolution } from '../../test-utils.ts';
import type { ROI } from '../types.ts';
import type { ScaleDetectionResult } from './grid-types.ts';
import { detectHotbarRegion } from './hotbar-detection.ts';
import { detectIconEdges } from './edge-detection.ts';

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
