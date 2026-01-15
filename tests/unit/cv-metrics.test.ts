/**
 * Tests for CV Performance Metrics Module
 * Tests metrics tracking, comparison, and reporting functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    metricsTracker,
    startMetricsTracking,
    type DetectionMetrics,
    type GroundTruth,
} from '../../src/modules/cv-metrics.ts';
import { STRATEGY_PRESETS, type CVStrategy } from '../../src/modules/cv-strategy.ts';

// Helper to create mock CVDetectionResult
const createMockDetection = (id: string, name: string, confidence: number) => ({
    entity: { id, name } as any,
    confidence,
    x: 0,
    y: 0,
    width: 64,
    height: 64,
});

// ========================================
// Metrics Tracker Core Tests
// ========================================

describe('MetricsTracker', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    afterEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should start with empty metrics history', () => {
        const history = metricsTracker.getAllMetrics();
        expect(history).toEqual([]);
    });

    it('should track metrics session', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'current');
        expect(session).toBeDefined();
    });

    it('should record timing metrics using start/end pattern', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.startLoad();
        // Simulate some time passing
        session.endLoad();

        session.startPreprocess();
        session.endPreprocess();

        session.startMatching();
        session.endMatching();

        session.startPostprocess();
        session.endPostprocess();

        const metrics = session.complete();

        expect(metrics.loadTime).toBeGreaterThanOrEqual(0);
        expect(metrics.preprocessTime).toBeGreaterThanOrEqual(0);
        expect(metrics.matchingTime).toBeGreaterThanOrEqual(0);
        expect(metrics.postprocessTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total time', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const metrics = session.complete();

        expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should track detection counts', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.95),
            createMockDetection('item2', 'Item 2', 0.80),
            createMockDetection('item3', 'Item 3', 0.65),
        ]);

        const metrics = session.complete();

        expect(metrics.totalDetections).toBe(3);
    });

    it('should categorize confidence levels', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordDetections([
            // High confidence (>=0.85)
            createMockDetection('item1', 'Item 1', 0.95),
            createMockDetection('item2', 'Item 2', 0.90),
            // Medium confidence (0.70-0.85)
            createMockDetection('item3', 'Item 3', 0.80),
            createMockDetection('item4', 'Item 4', 0.75),
            // Low confidence (<0.70)
            createMockDetection('item5', 'Item 5', 0.60),
        ]);

        const metrics = session.complete();

        expect(metrics.highConfidenceDetections).toBe(2);
        expect(metrics.mediumConfidenceDetections).toBe(2);
        expect(metrics.lowConfidenceDetections).toBe(1);
    });

    it('should calculate average confidence', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.80),
            createMockDetection('item2', 'Item 2', 0.90),
            createMockDetection('item3', 'Item 3', 1.00),
        ]);

        const metrics = session.complete();

        expect(metrics.averageConfidence).toBeCloseTo(0.9, 1);
    });

    it('should calculate median confidence', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.60),
            createMockDetection('item2', 'Item 2', 0.80),
            createMockDetection('item3', 'Item 3', 0.90),
        ]);

        const metrics = session.complete();

        expect(metrics.medianConfidence).toBeCloseTo(0.80, 2);
    });

    it('should track cell statistics', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordCellStats(20, 5, 15, 12);

        const metrics = session.complete();

        expect(metrics.totalCells).toBe(20);
        expect(metrics.emptyCells).toBe(5);
        expect(metrics.validCells).toBe(15);
        expect(metrics.matchedCells).toBe(12);
        expect(metrics.matchRate).toBeCloseTo(0.8, 2);
    });

    it('should track multi-pass detections', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        session.recordPassStats(5, 3, 1);

        const metrics = session.complete();

        expect(metrics.pass1Detections).toBe(5);
        expect(metrics.pass2Detections).toBe(3);
        expect(metrics.pass3Detections).toBe(1);
    });

    it('should include timestamp', () => {
        const before = Date.now();
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        const metrics = session.complete();
        const after = Date.now();

        expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
        expect(metrics.timestamp).toBeLessThanOrEqual(after);
    });

    it('should store metrics in history', () => {
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'test1');
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'test2');
        session2.complete();

        const history = metricsTracker.getAllMetrics();
        expect(history.length).toBe(2);
    });

    it('should clear history', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        session.complete();

        metricsTracker.clearMetrics();

        expect(metricsTracker.getAllMetrics()).toEqual([]);
    });

    it('should get metrics for specific strategy', () => {
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'strategy-a');
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'strategy-b');
        session2.complete();

        const strategyAMetrics = metricsTracker.getMetricsForStrategy('strategy-a');
        expect(strategyAMetrics.length).toBe(1);
        expect(strategyAMetrics[0].strategyName).toBe('strategy-a');
    });
});

// ========================================
// Ground Truth Validation Tests
// ========================================

describe('Ground Truth Validation', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should calculate accuracy metrics with ground truth', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = {
            items: [
                { id: 'item1', name: 'Item 1', count: 1 },
                { id: 'item2', name: 'Item 2', count: 1 },
                { id: 'item3', name: 'Item 3', count: 1 },
            ],
        };

        // Simulate detections: 2 correct, 1 wrong, 1 missed
        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90), // True positive
            createMockDetection('item2', 'Item 2', 0.85), // True positive
            createMockDetection('item4', 'Wrong', 0.80), // False positive (wrong item)
        ]);
        // item3 is missed - false negative

        session.setGroundTruth(groundTruth);
        const metrics = session.complete();

        expect(metrics.truePositives).toBe(2);
        expect(metrics.falsePositives).toBe(1);
        expect(metrics.falseNegatives).toBe(1);
    });

    it('should calculate precision correctly', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = {
            items: [
                { id: 'item1', name: 'Item 1', count: 1 },
            ],
        };

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90), // TP
            createMockDetection('item2', 'Wrong', 0.80), // FP
        ]);

        session.setGroundTruth(groundTruth);
        const metrics = session.complete();

        // Precision = TP / (TP + FP) = 1 / 2 = 0.5
        expect(metrics.precision).toBeCloseTo(0.5, 2);
    });

    it('should calculate recall correctly', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = {
            items: [
                { id: 'item1', name: 'Item 1', count: 1 },
                { id: 'item2', name: 'Item 2', count: 1 },
            ],
        };

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90), // TP
        ]);
        // item2 is missed - FN

        session.setGroundTruth(groundTruth);
        const metrics = session.complete();

        // Recall = TP / (TP + FN) = 1 / 2 = 0.5
        expect(metrics.recall).toBeCloseTo(0.5, 2);
    });

    it('should calculate F1 score correctly', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = {
            items: [
                { id: 'item1', name: 'Item 1', count: 1 },
                { id: 'item2', name: 'Item 2', count: 1 },
            ],
        };

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90), // TP
            createMockDetection('item2', 'Item 2', 0.85), // TP
        ]);

        session.setGroundTruth(groundTruth);
        const metrics = session.complete();

        // Perfect precision and recall = F1 of 1.0
        expect(metrics.f1Score).toBeCloseTo(1.0, 2);
    });
});

// ========================================
// Strategy Comparison Tests
// ========================================

describe('Strategy Comparison', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should compare multiple strategies', () => {
        // Run with current strategy
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'current');
        session1.startMatching();
        session1.endMatching();
        session1.recordDetections([createMockDetection('item1', 'Item 1', 0.90)]);
        session1.complete();

        // Run with fast strategy
        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'fast');
        session2.startMatching();
        session2.endMatching();
        session2.recordDetections([createMockDetection('item1', 'Item 1', 0.85)]);
        session2.complete();

        const comparison = metricsTracker.compareStrategies(['current', 'fast']);

        expect(comparison.strategies).toContain('current');
        expect(comparison.strategies).toContain('fast');
        expect(comparison.metrics.length).toBe(2);
    });

    it('should identify fastest strategy', () => {
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'current');
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'fast');
        session2.complete();

        const comparison = metricsTracker.compareStrategies(['current', 'fast']);

        expect(comparison.summary.fastestStrategy).toBeDefined();
        expect(comparison.summary.fastestTime).toBeGreaterThanOrEqual(0);
    });

    it('should identify most accurate strategy with ground truth', () => {
        const groundTruth: GroundTruth = {
            items: [{ id: 'item1', name: 'Item 1', count: 1 }],
        };

        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'current');
        session1.recordDetections([createMockDetection('item1', 'Item 1', 0.90)]);
        session1.setGroundTruth(groundTruth);
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'fast');
        session2.recordDetections([createMockDetection('item2', 'Wrong', 0.80)]); // Wrong detection
        session2.setGroundTruth(groundTruth);
        session2.complete();

        const comparison = metricsTracker.compareStrategies(['current', 'fast']);

        expect(comparison.summary.mostAccurateStrategy).toBe('current');
    });

    it('should throw for unknown strategy', () => {
        expect(() => metricsTracker.compareStrategies(['nonexistent'])).toThrow();
    });

    it('should provide recommendations', () => {
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'current');
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'fast');
        session2.complete();

        const comparison = metricsTracker.compareStrategies(['current', 'fast']);

        expect(comparison.recommendations).toHaveProperty('forSpeed');
        expect(comparison.recommendations).toHaveProperty('forAccuracy');
        expect(comparison.recommendations).toHaveProperty('forBalance');
    });
});

// ========================================
// Metrics Export Tests
// ========================================

describe('Metrics Export', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should export metrics as JSON', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        session.recordDetections([createMockDetection('item1', 'Item 1', 0.90)]);
        session.complete();

        const json = metricsTracker.exportMetrics();
        const parsed = JSON.parse(json);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(1);
        expect(parsed[0].strategyName).toBe('test');
    });

    it('should generate summary report', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        session.startLoad();
        session.endLoad();
        session.startMatching();
        session.endMatching();
        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90),
            createMockDetection('item2', 'Item 2', 0.85),
        ]);
        session.complete();

        const report = metricsTracker.generateReport();

        expect(report).toContain('test');
        expect(report).toContain('Performance');
    });

    it('should generate report with no metrics', () => {
        const report = metricsTracker.generateReport();
        expect(report).toContain('No metrics available');
    });

    it('should generate report for specific strategies', () => {
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'strategy-a');
        session1.complete();

        const session2 = startMetricsTracking(STRATEGY_PRESETS.fast, 'strategy-b');
        session2.complete();

        const report = metricsTracker.generateReport(['strategy-a']);

        expect(report).toContain('strategy-a');
    });
});

// ========================================
// Edge Cases Tests
// ========================================

describe('Metrics Edge Cases', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should handle no detections', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        const metrics = session.complete();

        expect(metrics.totalDetections).toBe(0);
        expect(metrics.averageConfidence).toBe(0);
        expect(metrics.medianConfidence).toBe(0);
    });

    it('should handle single detection', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        session.recordDetections([createMockDetection('item1', 'Item 1', 0.85)]);
        const metrics = session.complete();

        expect(metrics.totalDetections).toBe(1);
        expect(metrics.averageConfidence).toBe(0.85);
        expect(metrics.medianConfidence).toBe(0.85);
    });

    it('should handle zero valid cells for match rate', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        session.recordCellStats(10, 10, 0, 0); // All empty cells
        const metrics = session.complete();

        expect(metrics.matchRate).toBe(0);
    });

    it('should handle empty ground truth', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = { items: [] };
        session.setGroundTruth(groundTruth);

        const metrics = session.complete();

        expect(metrics.truePositives).toBe(0);
    });

    it('should handle duplicate item ids in ground truth', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');

        const groundTruth: GroundTruth = {
            items: [
                { id: 'item1', name: 'Item 1', count: 2 },
            ],
        };

        session.recordDetections([
            createMockDetection('item1', 'Item 1', 0.90),
            createMockDetection('item1', 'Item 1', 0.85),
        ]);
        session.setGroundTruth(groundTruth);

        const metrics = session.complete();

        expect(metrics.truePositives).toBe(2);
    });

    it('should include strategy in metrics', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'test');
        const metrics = session.complete();

        expect(metrics.strategy).toEqual(STRATEGY_PRESETS.current);
        expect(metrics.strategyName).toBe('test');
    });

    it('should limit history to maxRuns', () => {
        // Record more than 100 runs
        for (let i = 0; i < 110; i++) {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, `test-${i}`);
            session.complete();
        }

        const history = metricsTracker.getAllMetrics();
        expect(history.length).toBe(100);
    });
});
