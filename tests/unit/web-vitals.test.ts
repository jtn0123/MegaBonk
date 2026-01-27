// ========================================
// Web Vitals Module Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the web-vitals library before importing the module
vi.mock('web-vitals', () => ({
    onCLS: vi.fn(),
    onFCP: vi.fn(),
    onLCP: vi.fn(),
    onTTFB: vi.fn(),
    onINP: vi.fn(),
}));

// Mock the logger module - use vi.hoisted to ensure mock functions are available before import
const { mockLoggerInfo, mockLoggerError } = vi.hoisted(() => ({
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: mockLoggerInfo,
        error: mockLoggerError,
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

import { getRating, getMetrics, logSummary, initWebVitals, createPerformanceBadge, THRESHOLDS } from '../../src/modules/web-vitals.ts';
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

describe('Web Vitals Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup basic DOM
        document.body.innerHTML = '';

        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(THRESHOLDS)).toBe(true);
        });
    });

    describe('getRating', () => {
        describe('LCP ratings', () => {
            it('should return "good" for LCP values <= 2500ms', () => {
                expect(getRating('LCP', 2500)).toBe('good');
                expect(getRating('LCP', 1000)).toBe('good');
                expect(getRating('LCP', 0)).toBe('good');
            });

            it('should return "needs-improvement" for LCP values between 2501-4000ms', () => {
                expect(getRating('LCP', 2501)).toBe('needs-improvement');
                expect(getRating('LCP', 4000)).toBe('needs-improvement');
                expect(getRating('LCP', 3000)).toBe('needs-improvement');
            });

            it('should return "poor" for LCP values > 4000ms', () => {
                expect(getRating('LCP', 4001)).toBe('poor');
                expect(getRating('LCP', 5000)).toBe('poor');
                expect(getRating('LCP', 10000)).toBe('poor');
            });
        });

        describe('CLS ratings', () => {
            it('should return "good" for CLS values <= 0.1', () => {
                expect(getRating('CLS', 0.1)).toBe('good');
                expect(getRating('CLS', 0.05)).toBe('good');
                expect(getRating('CLS', 0)).toBe('good');
            });

            it('should return "needs-improvement" for CLS values between 0.1-0.25', () => {
                expect(getRating('CLS', 0.11)).toBe('needs-improvement');
                expect(getRating('CLS', 0.25)).toBe('needs-improvement');
                expect(getRating('CLS', 0.2)).toBe('needs-improvement');
            });

            it('should return "poor" for CLS values > 0.25', () => {
                expect(getRating('CLS', 0.26)).toBe('poor');
                expect(getRating('CLS', 0.5)).toBe('poor');
                expect(getRating('CLS', 1)).toBe('poor');
            });
        });

        describe('FCP ratings', () => {
            it('should return "good" for FCP values <= 1800ms', () => {
                expect(getRating('FCP', 1800)).toBe('good');
                expect(getRating('FCP', 1000)).toBe('good');
            });

            it('should return "needs-improvement" for FCP values between 1801-3000ms', () => {
                expect(getRating('FCP', 1801)).toBe('needs-improvement');
                expect(getRating('FCP', 3000)).toBe('needs-improvement');
            });

            it('should return "poor" for FCP values > 3000ms', () => {
                expect(getRating('FCP', 3001)).toBe('poor');
            });
        });

        describe('TTFB ratings', () => {
            it('should return "good" for TTFB values <= 800ms', () => {
                expect(getRating('TTFB', 800)).toBe('good');
                expect(getRating('TTFB', 500)).toBe('good');
            });

            it('should return "needs-improvement" for TTFB values between 801-1800ms', () => {
                expect(getRating('TTFB', 801)).toBe('needs-improvement');
                expect(getRating('TTFB', 1800)).toBe('needs-improvement');
            });

            it('should return "poor" for TTFB values > 1800ms', () => {
                expect(getRating('TTFB', 1801)).toBe('poor');
            });
        });

        describe('INP ratings', () => {
            it('should return "good" for INP values <= 200ms', () => {
                expect(getRating('INP', 200)).toBe('good');
                expect(getRating('INP', 100)).toBe('good');
            });

            it('should return "needs-improvement" for INP values between 201-500ms', () => {
                expect(getRating('INP', 201)).toBe('needs-improvement');
                expect(getRating('INP', 500)).toBe('needs-improvement');
            });

            it('should return "poor" for INP values > 500ms', () => {
                expect(getRating('INP', 501)).toBe('poor');
            });
        });

        describe('Unknown metric', () => {
            it('should return "unknown" for unrecognized metric names', () => {
                expect(getRating('UNKNOWN' as any, 100)).toBe('unknown');
                expect(getRating('FID' as any, 100)).toBe('unknown');
            });
        });
    });

    describe('getMetrics', () => {
        it('should return a copy of metrics object', () => {
            const metrics = getMetrics();
            expect(metrics).toHaveProperty('CLS');
            expect(metrics).toHaveProperty('FCP');
            expect(metrics).toHaveProperty('LCP');
            expect(metrics).toHaveProperty('TTFB');
            expect(metrics).toHaveProperty('INP');
        });

        it('should return null values for uncollected metrics', () => {
            const metrics = getMetrics();
            // Initially all should be null
            expect(metrics.CLS).toBeNull();
            expect(metrics.FCP).toBeNull();
            expect(metrics.LCP).toBeNull();
            expect(metrics.TTFB).toBeNull();
            expect(metrics.INP).toBeNull();
        });

        it('should return a new object each time (not the same reference)', () => {
            const metrics1 = getMetrics();
            const metrics2 = getMetrics();
            expect(metrics1).not.toBe(metrics2);
            expect(metrics1).toEqual(metrics2);
        });
    });

    describe('initWebVitals', () => {
        it('should register all web vitals callbacks', () => {
            initWebVitals();

            expect(onCLS).toHaveBeenCalledTimes(1);
            expect(onFCP).toHaveBeenCalledTimes(1);
            expect(onLCP).toHaveBeenCalledTimes(1);
            expect(onTTFB).toHaveBeenCalledTimes(1);
            expect(onINP).toHaveBeenCalledTimes(1);
        });

        it('should log initialization message', () => {
            initWebVitals();
            expect(mockLoggerInfo).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'webvitals.init',
                    data: { status: 'initialized' },
                })
            );
        });

        it('should add a load event listener for summary', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            initWebVitals();
            expect(addEventListenerSpy).toHaveBeenCalledWith('load', expect.any(Function));
        });

        it('should handle initialization errors gracefully', () => {
            // Mock onCLS to throw
            vi.mocked(onCLS).mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            initWebVitals();

            expect(mockLoggerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'webvitals.init',
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'Test error',
                    }),
                })
            );
        });
    });

    describe('logSummary', () => {
        it('should log "No metrics collected yet" when no metrics are available', () => {
            logSummary();
            expect(console.groupCollapsed).toHaveBeenCalledWith('[Web Vitals] Performance Summary');
            expect(console.log).toHaveBeenCalledWith('No metrics collected yet');
            expect(console.groupEnd).toHaveBeenCalled();
        });
    });

    describe('createPerformanceBadge', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // JSDOM sets hostname to 'localhost' by default, which allows badge creation
        });

        afterEach(() => {
            vi.useRealTimers();
            // Clean up badge if created
            const badge = document.getElementById('perf-badge');
            if (badge) badge.remove();
        });

        it('should create badge on localhost (JSDOM default)', () => {
            // JSDOM defaults to localhost, so badge should be created
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge).not.toBeNull();
            expect(badge?.className).toContain('perf-badge');
        });

        it('should show 0% score when no metrics collected', () => {
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge?.textContent).toContain('Perf: 0%');
        });

        it('should call logSummary when badge is clicked', () => {
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            badge?.click();

            expect(console.groupCollapsed).toHaveBeenCalledWith('[Web Vitals] Performance Summary');
        });

        it('should change opacity on mouseenter', () => {
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge') as HTMLElement;

            // Trigger mouseenter - should update to opacity 1
            badge.dispatchEvent(new Event('mouseenter'));
            expect(badge.style.opacity).toBe('1');

            // Trigger mouseleave - should reset to 0.7
            badge.dispatchEvent(new Event('mouseleave'));
            expect(badge.style.opacity).toBe('0.7');
        });

        it('should have correct title attribute', () => {
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge?.title).toBe('Click to view Web Vitals details');
        });

        it('should create badge with perf-badge class', () => {
            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge') as HTMLElement;
            // Verify badge has correct ID and class
            expect(badge).not.toBeNull();
            expect(badge?.id).toBe('perf-badge');
            expect(badge?.classList.contains('perf-badge')).toBe(true);
        });
    });

    describe('Metric handling integration', () => {
        it('should properly handle metrics via callbacks', () => {
            initWebVitals();

            // Get the callback that was passed to onLCP
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];

            // Simulate a metric being reported
            const mockMetric = {
                name: 'LCP',
                value: 2000,
                rating: 'good',
                delta: 2000,
                id: 'test-id',
            };

            lcpCallback(mockMetric as any);

            // Check that the metric was logged
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('[Web Vitals]')
            );
        });

        it('should store metrics after callback', () => {
            initWebVitals();

            // Simulate all metrics being reported
            const callbacks = {
                CLS: vi.mocked(onCLS).mock.calls[0][0],
                FCP: vi.mocked(onFCP).mock.calls[0][0],
                LCP: vi.mocked(onLCP).mock.calls[0][0],
                TTFB: vi.mocked(onTTFB).mock.calls[0][0],
                INP: vi.mocked(onINP).mock.calls[0][0],
            };

            callbacks.LCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            callbacks.CLS({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'cls-1' } as any);
            callbacks.FCP({ name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'fcp-1' } as any);

            const metrics = getMetrics();
            expect(metrics.LCP).not.toBeNull();
            expect(metrics.LCP?.value).toBe(2000);
            expect(metrics.CLS).not.toBeNull();
            expect(metrics.CLS?.value).toBe(0.05);
            expect(metrics.FCP).not.toBeNull();
        });

        it('should format CLS values with 3 decimal places', () => {
            initWebVitals();

            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];
            clsCallback({ name: 'CLS', value: 0.05678, rating: 'good', delta: 0.05678, id: 'cls-1' } as any);

            const metrics = getMetrics();
            expect(metrics.CLS?.formattedValue).toBe('0.057');
        });

        it('should format non-CLS values with ms suffix', () => {
            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 2345.67, rating: 'good', delta: 2345.67, id: 'lcp-1' } as any);

            const metrics = getMetrics();
            expect(metrics.LCP?.formattedValue).toBe('2346ms');
        });

        it('should log with correct emoji for good rating', () => {
            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅'));
        });

        it('should log with correct emoji for needs-improvement rating', () => {
            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 3000, rating: 'needs-improvement', delta: 3000, id: 'lcp-1' } as any);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
        });

        it('should log with correct emoji for poor rating', () => {
            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: 'lcp-1' } as any);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌'));
        });
    });

    describe('logSummary with collected metrics', () => {
        it('should log metrics summary when metrics are collected', () => {
            initWebVitals();

            // Simulate metrics
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];

            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            clsCallback({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'cls-1' } as any);

            vi.clearAllMocks(); // Clear previous log calls
            logSummary();

            expect(console.groupCollapsed).toHaveBeenCalledWith('[Web Vitals] Performance Summary');
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('LCP'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CLS'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Overall Score'));
            expect(console.groupEnd).toHaveBeenCalled();
        });

        it('should calculate overall score and display it', () => {
            initWebVitals();

            // Add a good metric
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);

            vi.clearAllMocks();
            logSummary();

            // Should log an overall score line (format varies based on accumulated metrics)
            expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/Overall Score: \d+%/));
        });

        it('should include metrics fraction in score', () => {
            initWebVitals();

            // Add metrics
            const fcpCallback = vi.mocked(onFCP).mock.calls[0][0];
            fcpCallback({ name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'fcp-1' } as any);

            vi.clearAllMocks();
            logSummary();

            // Should log a fraction like "(N/M metrics good)"
            expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/\d+\/\d+ metrics good/));
        });

        it('should log each metric with correct emoji', () => {
            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            const fcpCallback = vi.mocked(onFCP).mock.calls[0][0];

            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            fcpCallback({ name: 'FCP', value: 2500, rating: 'needs-improvement', delta: 2500, id: 'fcp-1' } as any);

            vi.clearAllMocks();
            logSummary();

            // Should have both good (✅) and needs-improvement (⚠️) emojis
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
        });
    });

    describe('Performance badge score emojis', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            const badge = document.getElementById('perf-badge');
            if (badge) badge.remove();
        });

        it('should show rocket emoji for score >= 80%', () => {
            initWebVitals();

            // All good metrics = 100%
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            const fcpCallback = vi.mocked(onFCP).mock.calls[0][0];
            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];
            const ttfbCallback = vi.mocked(onTTFB).mock.calls[0][0];
            const inpCallback = vi.mocked(onINP).mock.calls[0][0];

            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            fcpCallback({ name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'fcp-1' } as any);
            clsCallback({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'cls-1' } as any);
            ttfbCallback({ name: 'TTFB', value: 500, rating: 'good', delta: 500, id: 'ttfb-1' } as any);
            inpCallback({ name: 'INP', value: 100, rating: 'good', delta: 100, id: 'inp-1' } as any);

            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge?.textContent).toContain('🚀');
            expect(badge?.textContent).toContain('100%');
        });

        it('should show lightning emoji for score between 60-79%', () => {
            initWebVitals();

            // 3 good, 2 not = 60%
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            const fcpCallback = vi.mocked(onFCP).mock.calls[0][0];
            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];
            const ttfbCallback = vi.mocked(onTTFB).mock.calls[0][0];
            const inpCallback = vi.mocked(onINP).mock.calls[0][0];

            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            fcpCallback({ name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'fcp-1' } as any);
            clsCallback({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'cls-1' } as any);
            ttfbCallback({ name: 'TTFB', value: 2000, rating: 'poor', delta: 2000, id: 'ttfb-1' } as any);
            inpCallback({ name: 'INP', value: 600, rating: 'poor', delta: 600, id: 'inp-1' } as any);

            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge?.textContent).toContain('⚡');
            expect(badge?.textContent).toContain('60%');
        });

        it('should show snail emoji for low scores', () => {
            initWebVitals();

            // Add many poor metrics to push score below 60%
            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            const fcpCallback = vi.mocked(onFCP).mock.calls[0][0];
            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];
            const ttfbCallback = vi.mocked(onTTFB).mock.calls[0][0];
            const inpCallback = vi.mocked(onINP).mock.calls[0][0];

            // All poor metrics = 0%
            lcpCallback({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: 'lcp-1' } as any);
            fcpCallback({ name: 'FCP', value: 5000, rating: 'poor', delta: 5000, id: 'fcp-1' } as any);
            clsCallback({ name: 'CLS', value: 0.5, rating: 'poor', delta: 0.5, id: 'cls-1' } as any);
            ttfbCallback({ name: 'TTFB', value: 3000, rating: 'poor', delta: 3000, id: 'ttfb-1' } as any);
            inpCallback({ name: 'INP', value: 600, rating: 'poor', delta: 600, id: 'inp-1' } as any);

            createPerformanceBadge();
            vi.advanceTimersByTime(3500);

            const badge = document.getElementById('perf-badge');
            expect(badge?.textContent).toContain('🐌');
        });
    });

    describe('Analytics integration', () => {
        it('should send to gtag when available', () => {
            const mockGtag = vi.fn();
            (globalThis as any).gtag = mockGtag;

            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
            lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);

            expect(mockGtag).toHaveBeenCalledWith('event', 'LCP', expect.objectContaining({
                value: 2000,
                metric_id: 'lcp-1',
                metric_value: 2000,
                metric_delta: 2000,
                metric_rating: 'good',
            }));

            delete (globalThis as any).gtag;
        });

        it('should multiply CLS value by 1000 when sending to gtag', () => {
            const mockGtag = vi.fn();
            (globalThis as any).gtag = mockGtag;

            initWebVitals();

            const clsCallback = vi.mocked(onCLS).mock.calls[0][0];
            clsCallback({ name: 'CLS', value: 0.1, rating: 'good', delta: 0.1, id: 'cls-1' } as any);

            expect(mockGtag).toHaveBeenCalledWith('event', 'CLS', expect.objectContaining({
                value: 100, // 0.1 * 1000
            }));

            delete (globalThis as any).gtag;
        });

        it('should not throw when gtag is undefined', () => {
            delete (globalThis as any).gtag;

            initWebVitals();

            const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];

            expect(() => {
                lcpCallback({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'lcp-1' } as any);
            }).not.toThrow();
        });
    });

    // Note: Badge hostname check tests skipped because jsdom doesn't allow
    // redefining window.location. The badge creation on localhost is tested
    // indirectly by the other badge tests since jsdom defaults to localhost.
});
