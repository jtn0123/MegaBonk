/**
 * @vitest-environment jsdom
 * CV Metrics Summary Rendering Tests
 * 
 * Tests the HTML rendering functions and helper utilities
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
    renderMetricsSummary,
    renderSystemAccuracyBadge,
    renderCompactMetrics,
    logMetricsSummary,
    type MetricsSummary,
    type SystemAccuracy,
} from '../../src/modules/cv/metrics-summary.ts';
import { logger } from '../../src/modules/logger.ts';

describe('CV Metrics Summary Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ========================================
    // renderMetricsSummary Tests
    // ========================================
    describe('renderMetricsSummary', () => {
        it('should render valid HTML for basic metrics', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test Item', confidence: 0.85 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('metrics-summary');
            expect(html).toContain('metrics-header');
            expect(html).toContain('metrics-stats');
        });

        it('should include grade information', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test Item', confidence: 0.95 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('metrics-grade');
            expect(html).toContain('grade-letter');
            expect(html).toContain('A');
        });

        it('should use correct grade class', () => {
            const metricsA = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.95 },
            ]);
            const metricsF = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.3 },
            ]);
            
            const htmlA = renderMetricsSummary(metricsA);
            const htmlF = renderMetricsSummary(metricsF);
            
            expect(htmlA).toContain('grade-a');
            expect(htmlF).toContain('grade-f');
        });

        it('should include confidence value', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test Item', confidence: 0.85 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('confidence-value');
            expect(html).toContain('Avg Confidence');
        });

        it('should include stats (total items, unique items)', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.8 },
                { itemId: 'item-2', itemName: 'Item 2', confidence: 0.7 },
                { itemId: 'item-1', itemName: 'Item 1', confidence: 0.9 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('Total Items');
            expect(html).toContain('Unique Items');
            expect(html).toContain('Min Conf.');
            expect(html).toContain('Max Conf.');
        });

        it('should include confidence distribution bar', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'High', confidence: 0.95 },
                { itemId: 'item-2', itemName: 'Medium', confidence: 0.65 },
                { itemId: 'item-3', itemName: 'Low', confidence: 0.3 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('distribution-bar');
            expect(html).toContain('dist-high');
            expect(html).toContain('dist-medium');
            expect(html).toContain('dist-low');
        });

        it('should render weak detections section when present', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Weak Item', confidence: 0.3 },
                { itemId: 'item-2', itemName: 'Another Weak', confidence: 0.4 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('metrics-weak');
            expect(html).toContain('Low Confidence Detections');
            expect(html).toContain('Weak Item');
        });

        it('should not render weak section when no weak detections', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Strong Item', confidence: 0.9 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).not.toContain('metrics-weak');
        });

        it('should limit weak detections to 5 and show more count', () => {
            const detections = [];
            for (let i = 0; i < 10; i++) {
                detections.push({
                    itemId: `item-${i}`,
                    itemName: `Weak ${i}`,
                    confidence: 0.3 + i * 0.01,
                });
            }
            const metrics = calculateMetricsSummary(detections);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('+5 more');
        });

        it('should render rarity breakdown when present', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Common', confidence: 0.8, rarity: 'common' },
                { itemId: 'item-2', itemName: 'Rare', confidence: 0.9, rarity: 'rare' },
                { itemId: 'item-3', itemName: 'Legendary', confidence: 0.95, rarity: 'legendary' },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('metrics-rarity');
            expect(html).toContain('By Rarity');
            expect(html).toContain('Common');
            expect(html).toContain('Rare');
            expect(html).toContain('Legendary');
        });

        it('should escape HTML in item names', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: '<script>alert("xss")</script>', confidence: 0.3 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            // Should not contain raw script tag
            expect(html).not.toContain('<script>');
        });

        it('should handle empty metrics', () => {
            const metrics = calculateMetricsSummary([]);
            
            const html = renderMetricsSummary(metrics);
            
            expect(html).toContain('F');
            expect(html).toContain('No items detected');
        });

        it('should calculate distribution percentages correctly', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'High', confidence: 0.9 },
                { itemId: 'item-2', itemName: 'High', confidence: 0.85 },
            ]);
            
            const html = renderMetricsSummary(metrics);
            
            // Both items are high confidence, so dist-high should be 100%
            expect(html).toContain('style="width: 100%"');
        });
    });

    // ========================================
    // renderSystemAccuracyBadge Tests
    // ========================================
    describe('renderSystemAccuracyBadge', () => {
        it('should render badge with grade', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.85,
                grade: 'B',
                trend: 'stable',
                runCount: 10,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('system-accuracy-badge');
            expect(html).toContain('accuracy-grade');
            expect(html).toContain('B');
        });

        it('should show correct trend icon for improving', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.9,
                grade: 'A',
                trend: 'improving',
                runCount: 15,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('↑');
            expect(html).toContain('Improving');
        });

        it('should show correct trend icon for declining', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.6,
                grade: 'D',
                trend: 'declining',
                runCount: 8,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('↓');
            expect(html).toContain('Declining');
        });

        it('should show correct trend icon for stable', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.85,
                grade: 'B',
                trend: 'stable',
                runCount: 10,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('→');
            expect(html).toContain('Stable');
        });

        it('should show correct trend icon for unknown', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.75,
                grade: 'C',
                trend: 'unknown',
                runCount: 2,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('→');
            expect(html).toContain('Unknown');
        });

        it('should include F1 score percentage', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.85,
                grade: 'B',
                trend: 'stable',
                runCount: 10,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('F1');
            expect(html).toContain('accuracy-f1');
        });

        it('should use correct grade class', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.95,
                grade: 'A',
                trend: 'stable',
                runCount: 10,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('grade-a');
        });

        it('should include trend class', () => {
            const accuracy: SystemAccuracy = {
                overallF1: 0.85,
                grade: 'B',
                trend: 'improving',
                runCount: 10,
                weakItems: [],
            };
            
            const html = renderSystemAccuracyBadge(accuracy);
            
            expect(html).toContain('accuracy-trend improving');
        });
    });

    // ========================================
    // renderCompactMetrics Tests
    // ========================================
    describe('renderCompactMetrics', () => {
        it('should render compact view', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.85 },
            ]);
            
            const html = renderCompactMetrics(metrics);
            
            expect(html).toContain('metrics-compact');
        });

        it('should include grade', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.95 },
            ]);
            
            const html = renderCompactMetrics(metrics);
            
            expect(html).toContain('compact-grade');
            expect(html).toContain('A');
        });

        it('should include confidence', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.75 },
            ]);
            
            const html = renderCompactMetrics(metrics);
            
            expect(html).toContain('compact-conf');
        });

        it('should include item count', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test 1', confidence: 0.8 },
                { itemId: 'item-2', itemName: 'Test 2', confidence: 0.7 },
            ]);
            
            const html = renderCompactMetrics(metrics);
            
            expect(html).toContain('2 items');
        });

        it('should use correct grade class', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.5 },
            ]);
            
            const html = renderCompactMetrics(metrics);
            
            // Grade should be 'F' for low confidence
            expect(html).toContain('grade-f');
        });
    });

    // ========================================
    // logMetricsSummary Tests
    // ========================================
    describe('logMetricsSummary', () => {
        it('should log metrics info', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test 1', confidence: 0.85 },
                { itemId: 'item-2', itemName: 'Test 2', confidence: 0.65 },
                { itemId: 'item-3', itemName: 'Test 3', confidence: 0.3 },
            ]);
            
            logMetricsSummary(metrics);
            
            expect(logger.info).toHaveBeenCalled();
            const call = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>;
            expect(call.operation).toBe('metrics_summary');
        });

        it('should include all metrics data in log', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'High', confidence: 0.9 },
                { itemId: 'item-2', itemName: 'Medium', confidence: 0.6 },
                { itemId: 'item-3', itemName: 'Low', confidence: 0.3 },
            ]);
            
            logMetricsSummary(metrics);
            
            const call = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>;
            const data = call.data as Record<string, unknown>;
            
            expect(data.totalItems).toBe(3);
            expect(data.uniqueItems).toBe(3);
            expect(data.grade).toBeDefined();
            expect(data.highConf).toBeDefined();
            expect(data.medConf).toBeDefined();
            expect(data.lowConf).toBeDefined();
        });

        it('should round avgConfidence to integer percentage', () => {
            const metrics = calculateMetricsSummary([
                { itemId: 'item-1', itemName: 'Test', confidence: 0.856 },
            ]);
            
            logMetricsSummary(metrics);
            
            const call = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>;
            const data = call.data as Record<string, unknown>;
            
            // Should be 86 (rounded from 85.6)
            expect(data.avgConfidence).toBe(86);
        });

        it('should handle empty metrics', () => {
            const metrics = calculateMetricsSummary([]);
            
            logMetricsSummary(metrics);
            
            expect(logger.info).toHaveBeenCalled();
            const call = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>;
            const data = call.data as Record<string, unknown>;
            
            expect(data.totalItems).toBe(0);
            expect(data.avgConfidence).toBe(0);
        });
    });
});
