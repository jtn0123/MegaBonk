// ========================================
// Detection Pipeline - Two-Phase Grid Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import { logger } from '../../logger.ts';
import type { CVDetectionResult } from '../types.ts';
import { getTemplatesByColor } from '../state.ts';
import { getDominantColor, getColorCandidates, isEmptyCell, calculateColorVariance } from '../color.ts';
import { isTrainingDataLoaded } from '../training.ts';
import { getMetricsCollector } from '../metrics.ts';
import { getDynamicMinConfidence } from '../detection-config.ts';
import { detectHotbarRegion, detectIconEdges, inferGridFromEdges, generateGridROIs } from '../detection-grid.ts';
import { findBestTemplateMatch } from '../detection-matching.ts';
import type { TwoPhaseOptions, TwoPhaseResult } from './types.ts';

/**
 * Two-phase detection: first detect grid, then match only at grid positions
 * Much faster than sliding window (100-200x speedup)
 */
export async function detectIconsWithTwoPhase(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: Item[],
    options: TwoPhaseOptions = {}
): Promise<TwoPhaseResult> {
    // Use dynamic threshold based on resolution (width/height available from ctx)
    const { minConfidence = getDynamicMinConfidence(width, height), progressCallback } = options;
    const metrics = getMetricsCollector();
    const gridStartTime = performance.now();

    // Phase 1: Detect grid structure
    if (progressCallback) {
        progressCallback(20, 'Phase 1: Detecting grid structure...');
    }

    const hotbarRegion = detectHotbarRegion(ctx, width, height);
    const edges = detectIconEdges(ctx, width, hotbarRegion);
    const grid = inferGridFromEdges(edges, hotbarRegion, width);

    metrics.recordGridDetectionTime(performance.now() - gridStartTime);

    logger.info({
        operation: 'cv.two_phase.grid_detection',
        data: {
            hotbarConfidence: hotbarRegion.confidence,
            edgesFound: edges.length,
            gridDetected: !!grid,
            gridConfidence: grid?.confidence || 0,
        },
    });

    // If grid detection failed or low confidence, fall back to sliding window
    if (!grid || grid.confidence < 0.4 || grid.columns < 3) {
        let failureReason: string;
        if (!grid) {
            failureReason = 'no_grid';
        } else if (grid.confidence < 0.4) {
            failureReason = 'low_confidence';
        } else {
            failureReason = 'too_few_columns';
        }
        logger.info({
            operation: 'cv.two_phase.fallback_to_sliding_window',
            data: { reason: failureReason },
        });
        metrics.recordTwoPhaseAttempt(false, failureReason, grid?.confidence || 0, 0);
        return { detections: [], gridUsed: false, grid: null };
    }

    // Phase 2: Match templates only at grid positions
    if (progressCallback) {
        progressCallback(30, 'Phase 2: Matching templates at grid positions...');
    }

    const gridCells = generateGridROIs(grid);
    const detections: CVDetectionResult[] = [];
    const templatesByColor = getTemplatesByColor();
    const useMultiTemplate = isTrainingDataLoaded();

    logger.info({
        operation: 'cv.two_phase.matching_start',
        data: {
            gridCells: gridCells.length,
            columns: grid.columns,
            rows: grid.rows,
            cellSize: grid.cellWidth,
        },
    });

    for (let i = 0; i < gridCells.length; i++) {
        const cell = gridCells[i];
        if (!cell) continue; // TypeScript guard

        // Update progress
        if (progressCallback && i % 5 === 0) {
            const progress = 30 + Math.floor((i / gridCells.length) * 50);
            progressCallback(progress, `Matching cell ${i + 1}/${gridCells.length}...`);
        }

        // Extract cell image data for pre-filtering
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        // Skip empty cells
        if (isEmptyCell(cellData)) {
            continue;
        }

        // Check variance
        const variance = calculateColorVariance(cellData);
        if (variance < 800) {
            continue;
        }

        // Color-based pre-filtering using adjacent colors
        const cellColor = getDominantColor(cellData);
        const colorsToCheck = getColorCandidates(cellColor);

        // Gather candidates from exact match and adjacent colors
        const candidateItems: Item[] = [];
        const seenIds = new Set<string>();
        let usedExactMatch = false;

        for (const color of colorsToCheck) {
            const colorItems = templatesByColor.get(color) || [];
            if (color === cellColor && colorItems.length > 0) {
                usedExactMatch = true;
            }
            for (const item of colorItems) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    candidateItems.push(item);
                }
            }
        }

        const itemsToCheck = candidateItems.length > 0 ? candidateItems : items.slice(0, 30);
        const usedAdjacent = !usedExactMatch && candidateItems.length > 0;

        // Record color filter metrics
        metrics.recordColorFilter(usedExactMatch, usedAdjacent, itemsToCheck.length);

        // Match against candidate templates
        const bestMatch = findBestTemplateMatch(ctx, cell, itemsToCheck, minConfidence, useMultiTemplate);

        if (bestMatch) {
            detections.push({
                type: 'item',
                entity: bestMatch.item,
                confidence: bestMatch.similarity,
                position: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
                method: 'template_match',
            });
            // Record detection metrics
            metrics.recordDetection(bestMatch.similarity, bestMatch.item.rarity);
        }
    }

    const templateMatchingTime = performance.now() - gridStartTime;
    metrics.recordTemplateMatchingTime(templateMatchingTime);

    logger.info({
        operation: 'cv.two_phase.complete',
        data: {
            detections: detections.length,
            cellsScanned: gridCells.length,
        },
    });

    // Record successful two-phase attempt
    metrics.recordTwoPhaseAttempt(true, null, grid.confidence, gridCells.length);

    return { detections, gridUsed: true, grid };
}
