// ========================================
// Detection Pipeline - Ensemble Detection
// ========================================

import type { Item } from '../../../types/index.ts';
import type { ROI } from '../types.ts';
import { getItemTemplates } from '../state.ts';
import { getDynamicMinConfidence } from '../detection-config.ts';
import { matchTemplate } from '../detection-matching.ts';
import { shouldSkipTemplate } from '../template-ranking.ts';
import {
    selectStrategiesForImage,
    getStrategy,
    combineStrategyDetections,
    getEnsembleConfig,
    type StrategyDetection,
    type EnsembleResult,
} from '../ensemble-detector.ts';
import type { ProgressCallback } from './types.ts';

/**
 * Run ensemble detection with multiple strategies
 * Combines results from different strategies for better accuracy
 * @internal Reserved for future ensemble-based detection enhancements
 */
export async function runEnsembleDetection(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    _items: Item[],
    cell: ROI,
    _progressCallback?: ProgressCallback
): Promise<EnsembleResult | null> {
    const strategies = selectStrategiesForImage(width, height);
    const config = getEnsembleConfig();
    const strategyDetections: StrategyDetection[] = [];

    // Run each strategy
    for (const strategyId of strategies) {
        const strategy = getStrategy(strategyId);
        const threshold = strategy.minConfidence ?? getDynamicMinConfidence(width, height);

        // Match against templates
        const itemTemplates = getItemTemplates();
        let bestMatch: { itemId: string; confidence: number; templateId: string } | null = null;

        for (const [itemId, template] of itemTemplates) {
            // Check template ranking - skip poor performers if enabled
            if (strategy.templates.skipPoorPerformers && shouldSkipTemplate(`${itemId}_primary`)) {
                continue;
            }

            const similarity = matchTemplate(ctx, cell, template, itemId);

            if (similarity > threshold && (!bestMatch || similarity > bestMatch.confidence)) {
                bestMatch = {
                    itemId,
                    confidence: similarity,
                    templateId: `${itemId}_primary`,
                };
            }
        }

        if (bestMatch) {
            strategyDetections.push({
                strategyId,
                itemId: bestMatch.itemId,
                confidence: bestMatch.confidence * strategy.weight,
                position: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
                templateId: bestMatch.templateId,
            });

            // Early exit if confidence is very high
            if (bestMatch.confidence >= config.earlyExitThreshold) {
                break;
            }
        }
    }

    if (strategyDetections.length === 0) {
        return null;
    }

    // Combine strategy results
    return combineStrategyDetections(
        strategyDetections,
        { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
        config
    );
}
