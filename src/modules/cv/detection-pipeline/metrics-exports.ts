// ========================================
// Detection Pipeline - Metrics & Config Exports
// ========================================

import type { CVDetectionResult } from '../types.ts';
import { getMetricsCollector } from '../metrics.ts';
import { getDynamicMinConfidence } from '../detection-config.ts';
import { getResolutionTier } from '../resolution-profiles.ts';
import { selectStrategiesForImage, type StrategyId } from '../ensemble-detector.ts';
import { findUncertainDetections } from '../active-learning.ts';
import { getScoringConfig } from '../scoring-config.ts';

/**
 * Get CV detection metrics for UI display
 * Returns run history and aggregated stats
 */
export function getCVMetrics(): {
    runs: ReturnType<typeof getMetricsCollector>['getRuns'] extends () => infer R ? R : never;
    aggregated: ReturnType<typeof getMetricsCollector>['getAggregatedMetrics'] extends () => infer R ? R : never;
    enabled: boolean;
} {
    const collector = getMetricsCollector();
    return {
        runs: collector.getRuns(),
        aggregated: collector.getAggregatedMetrics(),
        enabled: collector.isEnabled(),
    };
}

/**
 * Get current detection configuration for debugging
 */
export function getDetectionConfig(
    width?: number,
    height?: number
): {
    dynamicThreshold: number;
    resolutionTier: string;
    selectedStrategies: StrategyId[];
    scoringConfig: ReturnType<typeof getScoringConfig>;
} {
    const tier = width && height ? getResolutionTier(width, height) : 'medium';
    const strategies = width && height ? selectStrategiesForImage(width, height) : ['default' as StrategyId];

    return {
        dynamicThreshold: getDynamicMinConfidence(width, height),
        resolutionTier: tier,
        selectedStrategies: strategies,
        scoringConfig: getScoringConfig(),
    };
}

/**
 * Get uncertain detections from last run for active learning UI
 */
export function getUncertainDetectionsFromResults(
    detections: CVDetectionResult[]
): ReturnType<typeof findUncertainDetections> {
    // Convert CVDetectionResult to DetectionForFeedback format
    const feedbackDetections = detections
        .filter(d => d.position)
        .map(d => ({
            detectedItemId: d.entity.id,
            detectedItemName: d.entity.name,
            confidence: d.confidence,
            x: d.position!.x,
            y: d.position!.y,
            width: d.position!.width,
            height: d.position!.height,
        }));
    return findUncertainDetections(feedbackDetections);
}
