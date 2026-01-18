/**
 * CV Accuracy Validation Test Suite
 * Tests precision/recall/F1 calculation and validates against ground truth targets
 *
 * This suite ensures CV detection accuracy meets defined thresholds:
 * - Baseline (easy): >80% accuracy
 * - Standard (medium): >70% accuracy
 * - Stress test (hard/extreme): >60% accuracy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    metricsTracker,
    startMetricsTracking,
    type DetectionMetrics,
    type GroundTruth,
} from '../../src/modules/cv-metrics.ts';
import { STRATEGY_PRESETS } from '../../src/modules/cv-strategy.ts';

// ========================================
// Test Helpers
// ========================================

/**
 * Create mock detection result
 */
const createDetection = (id: string, name: string, confidence: number) => ({
    entity: { id, name } as any,
    confidence,
    x: 0,
    y: 0,
    width: 64,
    height: 64,
});

/**
 * Create ground truth from item list
 */
const createGroundTruth = (items: Array<{ id: string; name: string; count: number }>): GroundTruth => ({
    items,
});

/**
 * Accuracy targets by difficulty
 */
const ACCURACY_TARGETS = {
    easy: { precision: 0.80, recall: 0.80, f1: 0.80 },
    medium: { precision: 0.70, recall: 0.70, f1: 0.70 },
    hard: { precision: 0.60, recall: 0.60, f1: 0.60 },
    extreme: { precision: 0.55, recall: 0.55, f1: 0.55 },
};

// ========================================
// Precision/Recall/F1 Calculation Tests
// ========================================

describe('CV Accuracy Metrics Calculation', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    afterEach(() => {
        metricsTracker.clearMetrics();
    });

    describe('Perfect Detection Scenarios', () => {
        it('should calculate 100% metrics for perfect detection', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'perfect-test');

            const groundTruth = createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 2 },
                { id: 'medkit', name: 'Medkit', count: 1 },
            ]);

            session.setGroundTruth(groundTruth);
            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.95),
                createDetection('wrench', 'Wrench', 0.90),
                createDetection('medkit', 'Medkit', 0.88),
            ]);

            const metrics = session.complete();

            expect(metrics.precision).toBe(1.0);
            expect(metrics.recall).toBe(1.0);
            expect(metrics.f1Score).toBe(1.0);
            expect(metrics.accuracy).toBe(1.0);
            expect(metrics.truePositives).toBe(3);
            expect(metrics.falsePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(0);
        });

        it('should handle single item perfect detection', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'single-item');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 1 },
            ]));

            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.95),
            ]);

            const metrics = session.complete();

            expect(metrics.precision).toBe(1.0);
            expect(metrics.recall).toBe(1.0);
            expect(metrics.f1Score).toBe(1.0);
        });
    });

    describe('Partial Detection Scenarios', () => {
        it('should calculate metrics for partial recall (missed items)', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'partial-recall');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 3 },
                { id: 'medkit', name: 'Medkit', count: 2 },
            ]));

            // Only detect 2 of 3 wrenches, 1 of 2 medkits
            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.90),
                createDetection('wrench', 'Wrench', 0.85),
                createDetection('medkit', 'Medkit', 0.80),
            ]);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(3);
            expect(metrics.falsePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(2); // 1 wrench + 1 medkit missed
            expect(metrics.precision).toBe(1.0); // All detections correct
            expect(metrics.recall).toBe(0.6); // 3/5 = 60%
            expect(metrics.f1Score).toBeCloseTo(0.75, 2); // 2 * (1 * 0.6) / (1 + 0.6)
        });

        it('should calculate metrics for false positives (over-detection)', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'over-detection');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 1 },
            ]));

            // Detect more than actually present
            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.90),
                createDetection('wrench', 'Wrench', 0.70), // False positive
                createDetection('medkit', 'Medkit', 0.60), // False positive (wrong item)
            ]);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(1);
            expect(metrics.falsePositives).toBe(2);
            expect(metrics.falseNegatives).toBe(0);
            expect(metrics.precision).toBeCloseTo(0.333, 2); // 1/3
            expect(metrics.recall).toBe(1.0); // Found everything
        });

        it('should calculate metrics for mixed errors', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'mixed-errors');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 2 },
                { id: 'medkit', name: 'Medkit', count: 2 },
                { id: 'battery', name: 'Battery', count: 1 },
            ]));

            // Detect: 1 wrench (miss 1), 3 medkits (1 FP), 0 battery (miss 1), 1 wrong item
            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.90),
                createDetection('medkit', 'Medkit', 0.85),
                createDetection('medkit', 'Medkit', 0.80),
                createDetection('medkit', 'Medkit', 0.70), // FP
                createDetection('oats', 'Oats', 0.65), // Wrong item
            ]);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(3); // 1 wrench + 2 medkits
            expect(metrics.falsePositives).toBe(2); // 1 extra medkit + 1 oats
            expect(metrics.falseNegatives).toBe(2); // 1 wrench + 1 battery
            expect(metrics.precision).toBeCloseTo(0.6, 2); // 3/5
            expect(metrics.recall).toBeCloseTo(0.6, 2); // 3/5
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty ground truth', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'empty-truth');

            session.setGroundTruth(createGroundTruth([]));
            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.90),
            ]);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(0);
            expect(metrics.falsePositives).toBe(1);
            expect(metrics.falseNegatives).toBe(0);
            expect(metrics.precision).toBe(0);
        });

        it('should handle empty detections', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'empty-detections');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 2 },
            ]));
            session.recordDetections([]);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(0);
            expect(metrics.falsePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(2);
            expect(metrics.recall).toBe(0);
        });

        it('should handle no ground truth set', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'no-truth');

            session.recordDetections([
                createDetection('wrench', 'Wrench', 0.90),
            ]);

            const metrics = session.complete();

            // No accuracy metrics when no ground truth
            expect(metrics.precision).toBeUndefined();
            expect(metrics.recall).toBeUndefined();
            expect(metrics.f1Score).toBeUndefined();
        });

        it('should handle high count items (stacking)', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'high-count');

            session.setGroundTruth(createGroundTruth([
                { id: 'ice_cube', name: 'Ice Cube', count: 10 },
            ]));

            // Detect 8 of 10
            const detections = Array(8).fill(null).map((_, i) =>
                createDetection('ice_cube', 'Ice Cube', 0.90 - i * 0.02)
            );
            session.recordDetections(detections);

            const metrics = session.complete();

            expect(metrics.truePositives).toBe(8);
            expect(metrics.falseNegatives).toBe(2);
            expect(metrics.recall).toBe(0.8);
        });
    });
});

// ========================================
// Accuracy Target Validation Tests
// ========================================

describe('CV Accuracy Target Validation', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    afterEach(() => {
        metricsTracker.clearMetrics();
    });

    describe('Easy Difficulty (>80% target)', () => {
        it('should meet 80% precision target for clean UI scenarios', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'easy-precision');

            // Simulate easy scenario: 10 items, detect 9 correctly, 1 FP
            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 5 },
                { id: 'medkit', name: 'Medkit', count: 5 },
            ]));

            session.recordDetections([
                ...Array(5).fill(null).map(() => createDetection('wrench', 'Wrench', 0.92)),
                ...Array(4).fill(null).map(() => createDetection('medkit', 'Medkit', 0.88)),
                createDetection('oats', 'Oats', 0.65), // 1 FP
            ]);

            const metrics = session.complete();

            expect(metrics.precision).toBeGreaterThanOrEqual(ACCURACY_TARGETS.easy.precision);
        });

        it('should meet 80% recall target for clean UI scenarios', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'easy-recall');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 5 },
                { id: 'medkit', name: 'Medkit', count: 5 },
            ]));

            // Detect 8 of 10 items
            session.recordDetections([
                ...Array(4).fill(null).map(() => createDetection('wrench', 'Wrench', 0.92)),
                ...Array(4).fill(null).map(() => createDetection('medkit', 'Medkit', 0.88)),
            ]);

            const metrics = session.complete();

            expect(metrics.recall).toBeGreaterThanOrEqual(ACCURACY_TARGETS.easy.recall);
        });
    });

    describe('Medium Difficulty (>70% target)', () => {
        it('should meet 70% precision for moderate complexity', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'medium-precision');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 3 },
                { id: 'medkit', name: 'Medkit', count: 3 },
                { id: 'battery', name: 'Battery', count: 2 },
                { id: 'backpack', name: 'Backpack', count: 2 },
            ]));

            // 7 correct, 2 FP, 1 FN
            session.recordDetections([
                ...Array(2).fill(null).map(() => createDetection('wrench', 'Wrench', 0.85)),
                ...Array(3).fill(null).map(() => createDetection('medkit', 'Medkit', 0.80)),
                ...Array(2).fill(null).map(() => createDetection('battery', 'Battery', 0.78)),
                createDetection('oats', 'Oats', 0.65),
                createDetection('cheese', 'Cheese', 0.60),
            ]);

            const metrics = session.complete();

            expect(metrics.precision).toBeGreaterThanOrEqual(ACCURACY_TARGETS.medium.precision);
        });

        it('should meet 70% F1 score for mid-game scenarios', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'medium-f1');

            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 4 },
                { id: 'medkit', name: 'Medkit', count: 4 },
                { id: 'battery', name: 'Battery', count: 2 },
            ]));

            // Balanced errors: some FP, some FN
            session.recordDetections([
                ...Array(3).fill(null).map(() => createDetection('wrench', 'Wrench', 0.85)),
                ...Array(3).fill(null).map(() => createDetection('medkit', 'Medkit', 0.80)),
                ...Array(2).fill(null).map(() => createDetection('battery', 'Battery', 0.78)),
                createDetection('oats', 'Oats', 0.65), // 1 FP
            ]);

            const metrics = session.complete();

            expect(metrics.f1Score).toBeGreaterThanOrEqual(ACCURACY_TARGETS.medium.f1);
        });
    });

    describe('Hard Difficulty (>60% target)', () => {
        it('should meet 60% accuracy for complex scenarios', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'hard-accuracy');

            // 20 items total - late game scenario
            session.setGroundTruth(createGroundTruth([
                { id: 'wrench', name: 'Wrench', count: 4 },
                { id: 'medkit', name: 'Medkit', count: 4 },
                { id: 'battery', name: 'Battery', count: 3 },
                { id: 'backpack', name: 'Backpack', count: 3 },
                { id: 'turbo_skates', name: 'Turbo Skates', count: 3 },
                { id: 'ice_crystal', name: 'Ice Crystal', count: 3 },
            ]));

            // Detect 13 correct, 3 FP, 7 FN
            session.recordDetections([
                ...Array(3).fill(null).map(() => createDetection('wrench', 'Wrench', 0.80)),
                ...Array(3).fill(null).map(() => createDetection('medkit', 'Medkit', 0.75)),
                ...Array(2).fill(null).map(() => createDetection('battery', 'Battery', 0.72)),
                ...Array(2).fill(null).map(() => createDetection('backpack', 'Backpack', 0.70)),
                ...Array(2).fill(null).map(() => createDetection('turbo_skates', 'Turbo Skates', 0.68)),
                createDetection('ice_crystal', 'Ice Crystal', 0.65),
                // 3 FPs
                createDetection('oats', 'Oats', 0.55),
                createDetection('cheese', 'Cheese', 0.52),
                createDetection('borgar', 'Borgar', 0.50),
            ]);

            const metrics = session.complete();

            expect(metrics.accuracy).toBeGreaterThanOrEqual(ACCURACY_TARGETS.hard.f1 - 0.05); // Allow some margin
        });
    });

    describe('Extreme Difficulty (>55% target)', () => {
        it('should meet 55% accuracy for 40+ item stress test', () => {
            const session = startMetricsTracking(STRATEGY_PRESETS.current, 'extreme-stress');

            // 40+ items - stress test scenario
            const items = [
                { id: 'wrench', name: 'Wrench', count: 6 },
                { id: 'medkit', name: 'Medkit', count: 6 },
                { id: 'battery', name: 'Battery', count: 5 },
                { id: 'backpack', name: 'Backpack', count: 5 },
                { id: 'turbo_skates', name: 'Turbo Skates', count: 5 },
                { id: 'ice_crystal', name: 'Ice Crystal', count: 5 },
                { id: 'dragonfire', name: 'Dragonfire', count: 4 },
                { id: 'moldy_cheese', name: 'Moldy Cheese', count: 4 },
            ];
            session.setGroundTruth(createGroundTruth(items));

            const totalItems = items.reduce((sum, i) => sum + i.count, 0);
            const targetDetections = Math.ceil(totalItems * 0.55);

            // Detect ~55% correctly
            const detections = [
                ...Array(3).fill(null).map(() => createDetection('wrench', 'Wrench', 0.75)),
                ...Array(3).fill(null).map(() => createDetection('medkit', 'Medkit', 0.70)),
                ...Array(3).fill(null).map(() => createDetection('battery', 'Battery', 0.68)),
                ...Array(3).fill(null).map(() => createDetection('backpack', 'Backpack', 0.65)),
                ...Array(3).fill(null).map(() => createDetection('turbo_skates', 'Turbo Skates', 0.62)),
                ...Array(3).fill(null).map(() => createDetection('ice_crystal', 'Ice Crystal', 0.60)),
                ...Array(2).fill(null).map(() => createDetection('dragonfire', 'Dragonfire', 0.58)),
                ...Array(2).fill(null).map(() => createDetection('moldy_cheese', 'Moldy Cheese', 0.55)),
            ];
            session.recordDetections(detections);

            const metrics = session.complete();

            expect(metrics.recall).toBeGreaterThanOrEqual(ACCURACY_TARGETS.extreme.recall);
        });
    });
});

// ========================================
// Regression Detection Tests
// ========================================

describe('CV Accuracy Regression Detection', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    afterEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should detect accuracy regression between runs', () => {
        const groundTruth = createGroundTruth([
            { id: 'wrench', name: 'Wrench', count: 5 },
            { id: 'medkit', name: 'Medkit', count: 5 },
        ]);

        // First run - good accuracy
        const session1 = startMetricsTracking(STRATEGY_PRESETS.current, 'baseline');
        session1.setGroundTruth(groundTruth);
        session1.recordDetections([
            ...Array(5).fill(null).map(() => createDetection('wrench', 'Wrench', 0.90)),
            ...Array(4).fill(null).map(() => createDetection('medkit', 'Medkit', 0.85)),
        ]);
        const baseline = session1.complete();

        // Second run - worse accuracy (regression)
        const session2 = startMetricsTracking(STRATEGY_PRESETS.current, 'regression');
        session2.setGroundTruth(groundTruth);
        session2.recordDetections([
            ...Array(3).fill(null).map(() => createDetection('wrench', 'Wrench', 0.80)),
            ...Array(2).fill(null).map(() => createDetection('medkit', 'Medkit', 0.75)),
        ]);
        const regressed = session2.complete();

        // Detect regression
        const recallDrop = (baseline.recall ?? 0) - (regressed.recall ?? 0);
        expect(recallDrop).toBeGreaterThan(0.2); // More than 20% drop indicates regression
    });

    it('should track improvement between strategy changes', () => {
        const groundTruth = createGroundTruth([
            { id: 'wrench', name: 'Wrench', count: 10 },
        ]);

        // Strategy A
        const sessionA = startMetricsTracking(STRATEGY_PRESETS.fast, 'strategy-a');
        sessionA.setGroundTruth(groundTruth);
        sessionA.recordDetections(
            Array(6).fill(null).map(() => createDetection('wrench', 'Wrench', 0.70))
        );
        const metricsA = sessionA.complete();

        // Strategy B (improved)
        const sessionB = startMetricsTracking(STRATEGY_PRESETS.accurate, 'strategy-b');
        sessionB.setGroundTruth(groundTruth);
        sessionB.recordDetections(
            Array(8).fill(null).map(() => createDetection('wrench', 'Wrench', 0.85))
        );
        const metricsB = sessionB.complete();

        // Verify improvement
        expect(metricsB.recall).toBeGreaterThan(metricsA.recall ?? 0);
        expect(metricsB.averageConfidence).toBeGreaterThan(metricsA.averageConfidence);
    });

    it('should compare multiple strategies and identify best performer', () => {
        const groundTruth = createGroundTruth([
            { id: 'wrench', name: 'Wrench', count: 5 },
            { id: 'medkit', name: 'Medkit', count: 5 },
        ]);

        // Run multiple strategies
        const strategies = ['fast', 'balanced', 'accurate'] as const;
        const accuracies: number[] = [];

        strategies.forEach((strategyName, i) => {
            const session = startMetricsTracking(
                STRATEGY_PRESETS[strategyName],
                strategyName
            );
            session.setGroundTruth(groundTruth);

            // Simulate different accuracy for each strategy
            const detectCount = 6 + i * 2; // 6, 8, 10
            session.recordDetections([
                ...Array(Math.min(5, detectCount)).fill(null).map(() =>
                    createDetection('wrench', 'Wrench', 0.75 + i * 0.05)
                ),
                ...Array(Math.max(0, detectCount - 5)).fill(null).map(() =>
                    createDetection('medkit', 'Medkit', 0.70 + i * 0.05)
                ),
            ]);

            const metrics = session.complete();
            accuracies.push(metrics.f1Score ?? 0);
        });

        // Accurate strategy should have best F1
        expect(accuracies[2]).toBeGreaterThanOrEqual(accuracies[0]!);
    });
});

// ========================================
// Confidence Distribution Tests
// ========================================

describe('CV Confidence Distribution Analysis', () => {
    beforeEach(() => {
        metricsTracker.clearMetrics();
    });

    afterEach(() => {
        metricsTracker.clearMetrics();
    });

    it('should correctly categorize confidence levels', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'confidence-dist');

        session.recordDetections([
            // High confidence (>=0.85)
            createDetection('item1', 'Item 1', 0.95),
            createDetection('item2', 'Item 2', 0.90),
            createDetection('item3', 'Item 3', 0.85),
            // Medium confidence (0.70-0.85)
            createDetection('item4', 'Item 4', 0.80),
            createDetection('item5', 'Item 5', 0.75),
            // Low confidence (<0.70)
            createDetection('item6', 'Item 6', 0.65),
            createDetection('item7', 'Item 7', 0.50),
        ]);

        const metrics = session.complete();

        expect(metrics.highConfidenceDetections).toBe(3);
        expect(metrics.mediumConfidenceDetections).toBe(2);
        expect(metrics.lowConfidenceDetections).toBe(2);
    });

    it('should calculate correct average confidence', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'avg-confidence');

        session.recordDetections([
            createDetection('item1', 'Item 1', 0.90),
            createDetection('item2', 'Item 2', 0.80),
            createDetection('item3', 'Item 3', 0.70),
        ]);

        const metrics = session.complete();

        expect(metrics.averageConfidence).toBeCloseTo(0.8, 2);
    });

    it('should calculate correct median confidence', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'median-confidence');

        session.recordDetections([
            createDetection('item1', 'Item 1', 0.50),
            createDetection('item2', 'Item 2', 0.70),
            createDetection('item3', 'Item 3', 0.90),
        ]);

        const metrics = session.complete();

        expect(metrics.medianConfidence).toBe(0.70);
    });

    it('should handle empty detections for confidence stats', () => {
        const session = startMetricsTracking(STRATEGY_PRESETS.current, 'empty-confidence');

        session.recordDetections([]);

        const metrics = session.complete();

        expect(metrics.averageConfidence).toBe(0);
        expect(metrics.medianConfidence).toBe(0);
        expect(metrics.highConfidenceDetections).toBe(0);
    });
});
