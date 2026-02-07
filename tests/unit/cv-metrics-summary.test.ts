/**
 * CV Metrics Summary Module Tests
 * 
 * Tests the detection metrics calculation and summary functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/cv/accuracy-tracker.ts', () => ({
    getAccuracySummary: vi.fn(() => ({
        overallF1: 0.85,
        grade: 'B',
        trend: 'stable',
        runCount: 10,
        weakItems: [{ itemId: 'weak-1', itemName: 'Weak Item', f1: 0.45 }],
    })),
    getGradeForF1: vi.fn((f1: number) => {
        if (f1 >= 0.9) return 'A';
        if (f1 >= 0.8) return 'B';
        if (f1 >= 0.7) return 'C';
        if (f1 >= 0.6) return 'D';
        return 'F';
    }),
    getQualityDescription: vi.fn((f1: number) => {
        if (f1 >= 0.9) return 'Excellent';
        if (f1 >= 0.8) return 'Good';
        if (f1 >= 0.7) return 'Fair';
        if (f1 >= 0.6) return 'Poor';
        return 'Very Poor';
    }),
    formatPercent: vi.fn((value: number) => `${(value * 100).toFixed(1)}%`),
    isHistoryLoaded: vi.fn(() => true),
    loadBenchmarkHistory: vi.fn(() => Promise.resolve()),
}));

import {
    calculateMetricsSummary,
    getSystemAccuracy,
    type DetectionForMetrics,
} from '../../src/modules/cv/metrics-summary.ts';

describe('CV Metrics Summary Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateMetricsSummary', () => {
        it('should return empty summary for empty detections', () => {
            const summary = calculateMetricsSummary([]);
            
            expect(summary.totalItems).toBe(0);
            expect(summary.uniqueItems).toBe(0);
            expect(summary.avgConfidence).toBe(0);
            expect(summary.grade).toBe('F');
            expect(summary.qualityDescription).toBe('No items detected');
        });

        it('should calculate total items correctly', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.7 },
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.85 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.totalItems).toBe(3);
        });

        it('should calculate unique items correctly', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.7 },
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.85 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.uniqueItems).toBe(2);
        });

        it('should calculate average confidence', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.6 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.avgConfidence).toBeCloseTo(0.7, 2);
        });

        it('should find min and max confidence', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.5 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.9 },
                { itemId: 'item-3', itemName: 'Item 3', confidence: 0.7 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.minConfidence).toBe(0.5);
            expect(summary.maxConfidence).toBe(0.9);
        });

        it('should count by rarity', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8, rarity: 'common' },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.7, rarity: 'rare' },
                { itemId: 'item-3', itemName: 'Item 3', confidence: 0.9, rarity: 'common' },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.byRarity.common).toBe(2);
            expect(summary.byRarity.rare).toBe(1);
        });

        it('should use unknown for missing rarity', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.byRarity.unknown).toBe(1);
        });

        it('should calculate confidence distribution', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.95 }, // high
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.85 }, // high
                { itemId: 'item-3', itemName: 'Item 3', confidence: 0.65 }, // medium
                { itemId: 'item-4', itemName: 'Item 4', confidence: 0.3 },  // low
                { itemId: 'item-5', itemName: 'Item 5', confidence: 0.4 },  // low
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.confidenceDistribution.high).toBe(2);
            expect(summary.confidenceDistribution.medium).toBe(1);
            expect(summary.confidenceDistribution.low).toBe(2);
        });

        it('should identify weak detections', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.85 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.35 },
                { itemId: 'item-3', itemName: 'Item 3', confidence: 0.25 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.weakDetections).toHaveLength(2);
            // Should be sorted by confidence ascending
            expect(summary.weakDetections[0].confidence).toBe(0.25);
            expect(summary.weakDetections[1].confidence).toBe(0.35);
        });

        it('should assign grade based on average confidence', () => {
            const highConfidence: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.95 },
            ];
            
            const summary = calculateMetricsSummary(highConfidence);
            expect(summary.grade).toBe('A');
        });

        it('should handle single detection', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.75 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.totalItems).toBe(1);
            expect(summary.uniqueItems).toBe(1);
            expect(summary.avgConfidence).toBe(0.75);
            expect(summary.minConfidence).toBe(0.75);
            expect(summary.maxConfidence).toBe(0.75);
        });

        it('should handle many detections', () => {
            const detections: DetectionForMetrics[] = [];
            for (let i = 0; i < 100; i++) {
                detections.push({
                    itemId: `item-${i % 20}`, // 20 unique items
                    itemName: `Item ${i % 20}`,
                    confidence: 0.5 + Math.random() * 0.5,
                    rarity: ['common', 'rare', 'legendary'][i % 3],
                });
            }
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.totalItems).toBe(100);
            expect(summary.uniqueItems).toBe(20);
            expect(summary.avgConfidence).toBeGreaterThan(0.5);
        });
    });

    describe('getSystemAccuracy', () => {
        it('should return system accuracy from benchmark history', async () => {
            const accuracy = await getSystemAccuracy();
            
            expect(accuracy).not.toBeNull();
            expect(accuracy!.overallF1).toBe(0.85);
            expect(accuracy!.grade).toBe('B');
            expect(accuracy!.trend).toBe('stable');
            expect(accuracy!.runCount).toBe(10);
        });

        it('should include weak items', async () => {
            const accuracy = await getSystemAccuracy();
            
            expect(accuracy!.weakItems).toHaveLength(1);
            expect(accuracy!.weakItems[0].itemId).toBe('weak-1');
        });

        it('should load history if not loaded', async () => {
            const { isHistoryLoaded, loadBenchmarkHistory } = await import('../../src/modules/cv/accuracy-tracker.ts');
            
            vi.mocked(isHistoryLoaded).mockReturnValueOnce(false);
            
            await getSystemAccuracy();
            
            expect(loadBenchmarkHistory).toHaveBeenCalled();
        });

        it('should return null if no summary available', async () => {
            const { getAccuracySummary } = await import('../../src/modules/cv/accuracy-tracker.ts');
            vi.mocked(getAccuracySummary).mockReturnValueOnce(null);
            
            const accuracy = await getSystemAccuracy();
            expect(accuracy).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle all zero confidences', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.avgConfidence).toBe(0);
            expect(summary.confidenceDistribution.low).toBe(2);
        });

        it('should handle all max confidences', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 1 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 1 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.avgConfidence).toBe(1);
            expect(summary.confidenceDistribution.high).toBe(2);
        });

        it('should handle boundary confidence values', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },  // exactly at high boundary
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.5 },  // exactly at medium boundary
                { itemId: 'item-3', itemName: 'Item 3', confidence: 0.499 }, // just below medium
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.confidenceDistribution.high).toBe(1);
            expect(summary.confidenceDistribution.medium).toBe(1);
            expect(summary.confidenceDistribution.low).toBe(1);
        });

        it('should handle duplicate item IDs with same confidence', () => {
            const detections: DetectionForMetrics[] = [
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
            ];
            
            const summary = calculateMetricsSummary(detections);
            expect(summary.totalItems).toBe(2);
            expect(summary.uniqueItems).toBe(1);
        });
    });
});
