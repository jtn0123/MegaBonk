/**
 * Tests for web-vitals.ts - Web Vitals Monitoring Module
 * Tests performance monitoring and metric tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Metric as WebVitalsMetric } from 'web-vitals';
import { getRating, getMetrics, logSummary, THRESHOLDS } from '../../src/modules/web-vitals.ts';
import type { MetricName, MetricRating } from '../../src/types/index.ts';

// Mock the web-vitals library
vi.mock('web-vitals', () => ({
    onCLS: vi.fn((callback: (metric: WebVitalsMetric) => void) => {
        // Simulate CLS callback after a delay
        setTimeout(() => {
            callback({
                name: 'CLS',
                value: 0.05,
                delta: 0.05,
                rating: 'good',
                id: 'test-cls-1',
                entries: [],
                navigationType: 'navigate',
            });
        }, 100);
    }),
    onFCP: vi.fn(),
    onLCP: vi.fn(),
    onTTFB: vi.fn(),
    onINP: vi.fn(),
}));

describe('Web Vitals Module', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleGroupCollapsedSpy: ReturnType<typeof vi.spyOn>;
    let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleGroupCollapsedSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleGroupCollapsedSpy.mockRestore();
        consoleGroupEndSpy.mockRestore();
        vi.clearAllMocks();
    });

    describe('getRating', () => {
        describe('LCP (Largest Contentful Paint)', () => {
            it('should rate LCP <= 2500ms as good', () => {
                expect(getRating('LCP', 2000)).toBe('good');
                expect(getRating('LCP', 2500)).toBe('good');
            });

            it('should rate LCP 2500-4000ms as needs-improvement', () => {
                expect(getRating('LCP', 2600)).toBe('needs-improvement');
                expect(getRating('LCP', 3500)).toBe('needs-improvement');
                expect(getRating('LCP', 4000)).toBe('needs-improvement');
            });

            it('should rate LCP > 4000ms as poor', () => {
                expect(getRating('LCP', 4001)).toBe('poor');
                expect(getRating('LCP', 5000)).toBe('poor');
            });
        });

        describe('CLS (Cumulative Layout Shift)', () => {
            it('should rate CLS <= 0.1 as good', () => {
                expect(getRating('CLS', 0)).toBe('good');
                expect(getRating('CLS', 0.05)).toBe('good');
                expect(getRating('CLS', 0.1)).toBe('good');
            });

            it('should rate CLS 0.1-0.25 as needs-improvement', () => {
                expect(getRating('CLS', 0.11)).toBe('needs-improvement');
                expect(getRating('CLS', 0.2)).toBe('needs-improvement');
                expect(getRating('CLS', 0.25)).toBe('needs-improvement');
            });

            it('should rate CLS > 0.25 as poor', () => {
                expect(getRating('CLS', 0.26)).toBe('poor');
                expect(getRating('CLS', 0.5)).toBe('poor');
            });
        });

        describe('FCP (First Contentful Paint)', () => {
            it('should rate FCP <= 1800ms as good', () => {
                expect(getRating('FCP', 1500)).toBe('good');
                expect(getRating('FCP', 1800)).toBe('good');
            });

            it('should rate FCP 1800-3000ms as needs-improvement', () => {
                expect(getRating('FCP', 1900)).toBe('needs-improvement');
                expect(getRating('FCP', 2500)).toBe('needs-improvement');
                expect(getRating('FCP', 3000)).toBe('needs-improvement');
            });

            it('should rate FCP > 3000ms as poor', () => {
                expect(getRating('FCP', 3001)).toBe('poor');
                expect(getRating('FCP', 5000)).toBe('poor');
            });
        });

        describe('TTFB (Time to First Byte)', () => {
            it('should rate TTFB <= 800ms as good', () => {
                expect(getRating('TTFB', 500)).toBe('good');
                expect(getRating('TTFB', 800)).toBe('good');
            });

            it('should rate TTFB 800-1800ms as needs-improvement', () => {
                expect(getRating('TTFB', 900)).toBe('needs-improvement');
                expect(getRating('TTFB', 1500)).toBe('needs-improvement');
                expect(getRating('TTFB', 1800)).toBe('needs-improvement');
            });

            it('should rate TTFB > 1800ms as poor', () => {
                expect(getRating('TTFB', 1801)).toBe('poor');
                expect(getRating('TTFB', 3000)).toBe('poor');
            });
        });

        describe('INP (Interaction to Next Paint)', () => {
            it('should rate INP <= 200ms as good', () => {
                expect(getRating('INP', 100)).toBe('good');
                expect(getRating('INP', 200)).toBe('good');
            });

            it('should rate INP 200-500ms as needs-improvement', () => {
                expect(getRating('INP', 250)).toBe('needs-improvement');
                expect(getRating('INP', 400)).toBe('needs-improvement');
                expect(getRating('INP', 500)).toBe('needs-improvement');
            });

            it('should rate INP > 500ms as poor', () => {
                expect(getRating('INP', 501)).toBe('poor');
                expect(getRating('INP', 1000)).toBe('poor');
            });
        });

        describe('Edge Cases', () => {
            it('should handle zero values', () => {
                expect(getRating('CLS', 0)).toBe('good');
                expect(getRating('LCP', 0)).toBe('good');
                expect(getRating('FCP', 0)).toBe('good');
                expect(getRating('TTFB', 0)).toBe('good');
                expect(getRating('INP', 0)).toBe('good');
            });

            it('should handle very large values', () => {
                expect(getRating('LCP', 100000)).toBe('poor');
                expect(getRating('FCP', 100000)).toBe('poor');
                expect(getRating('TTFB', 100000)).toBe('poor');
                expect(getRating('INP', 100000)).toBe('poor');
            });

            it('should handle decimal values for CLS', () => {
                expect(getRating('CLS', 0.099)).toBe('good');
                expect(getRating('CLS', 0.101)).toBe('needs-improvement');
                expect(getRating('CLS', 0.251)).toBe('poor');
            });

            it('should handle boundary values exactly', () => {
                // Test exact threshold boundaries
                expect(getRating('LCP', 2500)).toBe('good');
                expect(getRating('LCP', 2501)).toBe('needs-improvement');
                expect(getRating('LCP', 4000)).toBe('needs-improvement');
                expect(getRating('LCP', 4001)).toBe('poor');
            });

            it('should return unknown for invalid metric name', () => {
                expect(getRating('INVALID' as MetricName, 100)).toBe('unknown');
            });
        });
    });

    describe('THRESHOLDS', () => {
        it('should export correct LCP thresholds', () => {
            expect(THRESHOLDS.LCP.good).toBe(2500);
            expect(THRESHOLDS.LCP.needsImprovement).toBe(4000);
        });

        it('should export correct CLS thresholds', () => {
            expect(THRESHOLDS.CLS.good).toBe(0.1);
            expect(THRESHOLDS.CLS.needsImprovement).toBe(0.25);
        });

        it('should export correct FCP thresholds', () => {
            expect(THRESHOLDS.FCP.good).toBe(1800);
            expect(THRESHOLDS.FCP.needsImprovement).toBe(3000);
        });

        it('should export correct TTFB thresholds', () => {
            expect(THRESHOLDS.TTFB.good).toBe(800);
            expect(THRESHOLDS.TTFB.needsImprovement).toBe(1800);
        });

        it('should export correct INP thresholds', () => {
            expect(THRESHOLDS.INP.good).toBe(200);
            expect(THRESHOLDS.INP.needsImprovement).toBe(500);
        });

        it('should have all five metric thresholds', () => {
            expect(Object.keys(THRESHOLDS)).toHaveLength(5);
            expect(THRESHOLDS).toHaveProperty('LCP');
            expect(THRESHOLDS).toHaveProperty('CLS');
            expect(THRESHOLDS).toHaveProperty('FCP');
            expect(THRESHOLDS).toHaveProperty('TTFB');
            expect(THRESHOLDS).toHaveProperty('INP');
        });
    });

    describe('getMetrics', () => {
        it('should return metrics collection object', () => {
            const metrics = getMetrics();

            expect(metrics).toBeDefined();
            expect(metrics).toHaveProperty('LCP');
            expect(metrics).toHaveProperty('CLS');
            expect(metrics).toHaveProperty('FCP');
            expect(metrics).toHaveProperty('TTFB');
            expect(metrics).toHaveProperty('INP');
        });

        it('should return all metrics as null initially', () => {
            const metrics = getMetrics();

            expect(metrics.LCP).toBeNull();
            expect(metrics.CLS).toBeNull();
            expect(metrics.FCP).toBeNull();
            expect(metrics.TTFB).toBeNull();
            expect(metrics.INP).toBeNull();
        });

        it('should not allow modification of original metrics', () => {
            const metrics1 = getMetrics();
            const metrics2 = getMetrics();

            // They should be different objects
            expect(metrics1).not.toBe(metrics2);
        });
    });

    describe('logSummary', () => {
        it('should log message when no metrics collected', () => {
            logSummary();

            expect(consoleGroupCollapsedSpy).toHaveBeenCalledWith('[Web Vitals] Performance Summary');
            expect(consoleLogSpy).toHaveBeenCalledWith('No metrics collected yet');
            expect(consoleGroupEndSpy).toHaveBeenCalled();
        });

        it('should use console.groupCollapsed for summary', () => {
            logSummary();

            expect(consoleGroupCollapsedSpy).toHaveBeenCalled();
        });

        it('should close console group after logging', () => {
            logSummary();

            expect(consoleGroupEndSpy).toHaveBeenCalled();
        });
    });

    describe('Rating System', () => {
        it('should use consistent rating thresholds', () => {
            const metrics: Array<{ name: MetricName; good: number; needsImprovement: number }> = [
                { name: 'LCP', good: 2500, needsImprovement: 4000 },
                { name: 'CLS', good: 0.1, needsImprovement: 0.25 },
                { name: 'FCP', good: 1800, needsImprovement: 3000 },
                { name: 'TTFB', good: 800, needsImprovement: 1800 },
                { name: 'INP', good: 200, needsImprovement: 500 },
            ];

            metrics.forEach(({ name, good, needsImprovement }) => {
                // Test that good threshold is exactly at the boundary
                expect(getRating(name, good)).toBe('good');

                // Test that needs-improvement starts after good
                expect(getRating(name, good + (name === 'CLS' ? 0.01 : 1))).toBe('needs-improvement');

                // Test that needs-improvement ends at the boundary
                expect(getRating(name, needsImprovement)).toBe('needs-improvement');

                // Test that poor starts after needs-improvement
                expect(getRating(name, needsImprovement + (name === 'CLS' ? 0.01 : 1))).toBe('poor');
            });
        });

        it('should provide three distinct ratings for each metric', () => {
            const testValues: Record<MetricName, number[]> = {
                LCP: [1000, 3000, 5000],
                CLS: [0.05, 0.15, 0.3],
                FCP: [1000, 2000, 4000],
                TTFB: [500, 1000, 2000],
                INP: [100, 300, 600],
            };

            Object.entries(testValues).forEach(([name, [goodVal, needsImprovementVal, poorVal]]) => {
                expect(getRating(name as MetricName, goodVal)).toBe('good');
                expect(getRating(name as MetricName, needsImprovementVal)).toBe('needs-improvement');
                expect(getRating(name as MetricName, poorVal)).toBe('poor');
            });
        });
    });

    describe('Metric Types', () => {
        it('should handle all core web vitals metric names', () => {
            const metricNames: MetricName[] = ['LCP', 'CLS', 'FCP', 'TTFB', 'INP'];

            metricNames.forEach(name => {
                expect(getRating(name, 0)).toBeDefined();
                expect(['good', 'needs-improvement', 'poor', 'unknown']).toContain(getRating(name, 0));
            });
        });

        it('should match web-vitals library metric names', () => {
            // Ensure our types match the web-vitals library expectations
            const expectedMetrics = ['LCP', 'CLS', 'FCP', 'TTFB', 'INP'];

            expectedMetrics.forEach(name => {
                expect(THRESHOLDS).toHaveProperty(name);
            });
        });
    });

    describe('Integration', () => {
        it('should have consistent threshold structure across all metrics', () => {
            Object.values(THRESHOLDS).forEach(threshold => {
                expect(threshold).toHaveProperty('good');
                expect(threshold).toHaveProperty('needsImprovement');
                expect(typeof threshold.good).toBe('number');
                expect(typeof threshold.needsImprovement).toBe('number');
                expect(threshold.needsImprovement).toBeGreaterThan(threshold.good);
            });
        });

        it('should calculate ratings consistently with thresholds', () => {
            Object.entries(THRESHOLDS).forEach(([name, threshold]) => {
                const metricName = name as MetricName;

                // Test at boundaries
                expect(getRating(metricName, threshold.good)).toBe('good');
                expect(getRating(metricName, threshold.needsImprovement)).toBe('needs-improvement');

                // Test just below/above boundaries
                const epsilon = metricName === 'CLS' ? 0.001 : 1;

                expect(getRating(metricName, threshold.good - epsilon)).toBe('good');
                expect(getRating(metricName, threshold.good + epsilon)).toBe('needs-improvement');
                expect(getRating(metricName, threshold.needsImprovement + epsilon)).toBe('poor');
            });
        });
    });

    describe('Performance Monitoring Best Practices', () => {
        it('should track INP instead of deprecated FID', () => {
            // INP (Interaction to Next Paint) replaced FID in web-vitals v3+
            expect(THRESHOLDS).toHaveProperty('INP');
            expect(THRESHOLDS).not.toHaveProperty('FID');
        });

        it('should use recommended Core Web Vitals thresholds', () => {
            // Verify against Google's recommended thresholds
            expect(THRESHOLDS.LCP.good).toBe(2500); // <= 2.5s
            expect(THRESHOLDS.FCP.good).toBe(1800); // <= 1.8s
            expect(THRESHOLDS.CLS.good).toBe(0.1); // <= 0.1
            expect(THRESHOLDS.INP.good).toBe(200); // <= 200ms
        });

        it('should have reasonable needsImprovement thresholds', () => {
            // needsImprovement should be between good and poor
            Object.entries(THRESHOLDS).forEach(([name, threshold]) => {
                expect(threshold.needsImprovement).toBeGreaterThan(threshold.good);

                // Verify specific values match Google's recommendations
                if (name === 'LCP') expect(threshold.needsImprovement).toBe(4000); // <= 4s
                if (name === 'CLS') expect(threshold.needsImprovement).toBe(0.25); // <= 0.25
                if (name === 'FCP') expect(threshold.needsImprovement).toBe(3000); // <= 3s
                if (name === 'INP') expect(threshold.needsImprovement).toBe(500); // <= 500ms
            });
        });
    });
});
