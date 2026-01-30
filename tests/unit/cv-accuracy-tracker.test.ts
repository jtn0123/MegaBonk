/**
 * @vitest-environment jsdom
 * CV Accuracy Tracker - Comprehensive Tests
 * Tests for accuracy tracking, grade calculation, and trend analysis
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    getGradeForF1,
    formatPercent,
    getQualityDescription,
    isHistoryLoaded,
    getRunCount,
    getLastRun,
    clearHistory,
    getAccuracySummary,
    getWeakItems,
    getPerImageMetrics,
    analyzeTrends,
    loadBenchmarkHistory,
    type BenchmarkRun,
    type BenchmarkHistory,
} from '../../src/modules/cv/accuracy-tracker.ts';

// ========================================
// Test Suite
// ========================================

describe('CV Accuracy Tracker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearHistory();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearHistory();
    });

    // ========================================
    // getGradeForF1 Tests
    // ========================================
    describe('getGradeForF1', () => {
        it('should return A for F1 >= 0.9', () => {
            expect(getGradeForF1(0.9)).toBe('A');
            expect(getGradeForF1(0.95)).toBe('A');
            expect(getGradeForF1(1.0)).toBe('A');
        });

        it('should return B for F1 >= 0.75 and < 0.9', () => {
            expect(getGradeForF1(0.75)).toBe('B');
            expect(getGradeForF1(0.85)).toBe('B');
            expect(getGradeForF1(0.899)).toBe('B');
        });

        it('should return C for F1 >= 0.6 and < 0.75', () => {
            expect(getGradeForF1(0.6)).toBe('C');
            expect(getGradeForF1(0.7)).toBe('C');
            expect(getGradeForF1(0.749)).toBe('C');
        });

        it('should return D for F1 >= 0.45 and < 0.6', () => {
            expect(getGradeForF1(0.45)).toBe('D');
            expect(getGradeForF1(0.5)).toBe('D');
            expect(getGradeForF1(0.599)).toBe('D');
        });

        it('should return F for F1 < 0.45', () => {
            expect(getGradeForF1(0.0)).toBe('F');
            expect(getGradeForF1(0.2)).toBe('F');
            expect(getGradeForF1(0.449)).toBe('F');
        });

        it('should handle edge cases', () => {
            expect(getGradeForF1(-0.1)).toBe('F');
            expect(getGradeForF1(1.5)).toBe('A'); // Above 1.0
        });
    });

    // ========================================
    // formatPercent Tests
    // ========================================
    describe('formatPercent', () => {
        it('should format decimal as percentage', () => {
            expect(formatPercent(0.5)).toBe('50%');
            expect(formatPercent(0.95)).toBe('95%');
            expect(formatPercent(1.0)).toBe('100%');
        });

        it('should handle zero', () => {
            expect(formatPercent(0)).toBe('0%');
        });

        it('should round to nearest integer', () => {
            expect(formatPercent(0.554)).toBe('55%');
            expect(formatPercent(0.555)).toBe('56%');
            expect(formatPercent(0.123)).toBe('12%');
        });

        it('should handle values over 1', () => {
            expect(formatPercent(1.5)).toBe('150%');
        });

        it('should handle negative values', () => {
            expect(formatPercent(-0.1)).toBe('-10%');
        });
    });

    // ========================================
    // getQualityDescription Tests
    // ========================================
    describe('getQualityDescription', () => {
        it('should return "Excellent" for F1 >= 0.9', () => {
            expect(getQualityDescription(0.9)).toBe('Excellent');
            expect(getQualityDescription(0.95)).toBe('Excellent');
            expect(getQualityDescription(1.0)).toBe('Excellent');
        });

        it('should return "Good" for F1 >= 0.75 and < 0.9', () => {
            expect(getQualityDescription(0.75)).toBe('Good');
            expect(getQualityDescription(0.85)).toBe('Good');
        });

        it('should return "Fair" for F1 >= 0.6 and < 0.75', () => {
            expect(getQualityDescription(0.6)).toBe('Fair');
            expect(getQualityDescription(0.7)).toBe('Fair');
        });

        it('should return "Poor" for F1 >= 0.45 and < 0.6', () => {
            expect(getQualityDescription(0.45)).toBe('Poor');
            expect(getQualityDescription(0.5)).toBe('Poor');
        });

        it('should return "Very Poor" for F1 < 0.45', () => {
            expect(getQualityDescription(0.0)).toBe('Very Poor');
            expect(getQualityDescription(0.3)).toBe('Very Poor');
            expect(getQualityDescription(0.449)).toBe('Very Poor');
        });
    });

    // ========================================
    // State Getters Tests
    // ========================================
    describe('State Getters', () => {
        describe('isHistoryLoaded', () => {
            it('should return false initially', () => {
                clearHistory();
                expect(isHistoryLoaded()).toBe(false);
            });
        });

        describe('getRunCount', () => {
            it('should return 0 when no history loaded', () => {
                clearHistory();
                expect(getRunCount()).toBe(0);
            });
        });

        describe('getLastRun', () => {
            it('should return null when no history loaded', () => {
                clearHistory();
                expect(getLastRun()).toBeNull();
            });
        });

        describe('clearHistory', () => {
            it('should clear history state', () => {
                clearHistory();
                expect(isHistoryLoaded()).toBe(false);
                expect(getRunCount()).toBe(0);
                expect(getLastRun()).toBeNull();
            });
        });
    });

    // ========================================
    // loadBenchmarkHistory Tests
    // ========================================
    describe('loadBenchmarkHistory', () => {
        it('should return null when fetch fails with non-ok status', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 404,
                })
            );

            clearHistory();
            const result = await loadBenchmarkHistory();

            expect(result).toBeNull();
            expect(isHistoryLoaded()).toBe(true);
        });

        it('should return null and set loaded when fetch throws', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            clearHistory();
            const result = await loadBenchmarkHistory();

            expect(result).toBeNull();
            expect(isHistoryLoaded()).toBe(true);
        });

        it('should return cached history on subsequent calls', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1' })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            const result1 = await loadBenchmarkHistory();
            const result2 = await loadBenchmarkHistory();

            expect(result1).toEqual(mockHistory);
            expect(result2).toEqual(mockHistory);
            expect(fetch).toHaveBeenCalledTimes(1); // Only called once due to caching
        });

        it('should load and parse benchmark history successfully', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1' }), createMockRun({ id: 'run-2' })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            const result = await loadBenchmarkHistory();

            expect(result).toEqual(mockHistory);
            expect(isHistoryLoaded()).toBe(true);
            expect(getRunCount()).toBe(2);
        });
    });

    // ========================================
    // getAccuracySummary Tests
    // ========================================
    describe('getAccuracySummary', () => {
        it('should return null when no history loaded', () => {
            clearHistory();
            expect(getAccuracySummary()).toBeNull();
        });

        it('should return summary from loaded history', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({ id: 'run-1', f1: 0.85 }),
                    createMockRun({ id: 'run-2', f1: 0.88 }),
                    createMockRun({ id: 'run-3', f1: 0.9 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary).not.toBeNull();
            expect(summary!.overallF1).toBe(0.9);
            expect(summary!.grade).toBe('A');
            expect(summary!.runCount).toBe(3);
        });

        it('should calculate trend as unknown with insufficient data', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1', f1: 0.85 })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.trend).toBe('unknown');
        });

        it('should detect improving trend', async () => {
            // Need 3 recent runs and at least 1 older run
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    // Older runs (index -10 to -5)
                    createMockRun({ id: 'old-1', f1: 0.6 }),
                    createMockRun({ id: 'old-2', f1: 0.62 }),
                    createMockRun({ id: 'old-3', f1: 0.63 }),
                    createMockRun({ id: 'old-4', f1: 0.64 }),
                    createMockRun({ id: 'old-5', f1: 0.65 }),
                    // Recent runs (last 5)
                    createMockRun({ id: 'new-1', f1: 0.85 }),
                    createMockRun({ id: 'new-2', f1: 0.87 }),
                    createMockRun({ id: 'new-3', f1: 0.89 }),
                    createMockRun({ id: 'new-4', f1: 0.9 }),
                    createMockRun({ id: 'new-5', f1: 0.92 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.trend).toBe('improving');
        });

        it('should detect declining trend', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    // Older runs with high scores
                    createMockRun({ id: 'old-1', f1: 0.9 }),
                    createMockRun({ id: 'old-2', f1: 0.91 }),
                    createMockRun({ id: 'old-3', f1: 0.92 }),
                    createMockRun({ id: 'old-4', f1: 0.91 }),
                    createMockRun({ id: 'old-5', f1: 0.9 }),
                    // Recent runs with lower scores
                    createMockRun({ id: 'new-1', f1: 0.6 }),
                    createMockRun({ id: 'new-2', f1: 0.58 }),
                    createMockRun({ id: 'new-3', f1: 0.55 }),
                    createMockRun({ id: 'new-4', f1: 0.52 }),
                    createMockRun({ id: 'new-5', f1: 0.5 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.trend).toBe('declining');
        });

        it('should detect stable trend', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({ id: 'old-1', f1: 0.8 }),
                    createMockRun({ id: 'old-2', f1: 0.81 }),
                    createMockRun({ id: 'old-3', f1: 0.79 }),
                    createMockRun({ id: 'old-4', f1: 0.8 }),
                    createMockRun({ id: 'old-5', f1: 0.81 }),
                    createMockRun({ id: 'new-1', f1: 0.8 }),
                    createMockRun({ id: 'new-2', f1: 0.81 }),
                    createMockRun({ id: 'new-3', f1: 0.8 }),
                    createMockRun({ id: 'new-4', f1: 0.79 }),
                    createMockRun({ id: 'new-5', f1: 0.8 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.trend).toBe('stable');
        });

        it('should identify weak items from perItem data', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        f1: 0.7,
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.3),
                            shield: createMockItemMetrics('shield', 'Shield', 0.9),
                            potion: createMockItemMetrics('potion', 'Potion', 0.4),
                        },
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.weakItems.length).toBeGreaterThan(0);
            expect(summary!.weakItems.some(item => item.itemId === 'sword')).toBe(true);
        });

        it('should identify strong items from perItem data', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        f1: 0.7,
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.3),
                            shield: createMockItemMetrics('shield', 'Shield', 0.95),
                            armor: createMockItemMetrics('armor', 'Armor', 0.88),
                        },
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const summary = getAccuracySummary();

            expect(summary!.strongItems.length).toBeGreaterThan(0);
            expect(summary!.strongItems.some(item => item.itemId === 'shield')).toBe(true);
        });
    });

    // ========================================
    // getWeakItems Tests
    // ========================================
    describe('getWeakItems', () => {
        it('should return empty array when no history loaded', () => {
            clearHistory();
            expect(getWeakItems()).toEqual([]);
        });

        it('should return items below threshold', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.3),
                            shield: createMockItemMetrics('shield', 'Shield', 0.9),
                            potion: createMockItemMetrics('potion', 'Potion', 0.4),
                        },
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const weakItems = getWeakItems(0.5);

            expect(weakItems.length).toBe(2);
            expect(weakItems[0].itemId).toBe('sword'); // Sorted by F1, lowest first
            expect(weakItems[1].itemId).toBe('potion');
        });

        it('should use default threshold of 0.5', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.6),
                            shield: createMockItemMetrics('shield', 'Shield', 0.3),
                        },
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const weakItems = getWeakItems();

            expect(weakItems.length).toBe(1);
            expect(weakItems[0].itemId).toBe('shield');
        });

        it('should return empty when no perItem data', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1' })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const weakItems = getWeakItems();

            expect(weakItems).toEqual([]);
        });
    });

    // ========================================
    // getPerImageMetrics Tests
    // ========================================
    describe('getPerImageMetrics', () => {
        it('should return empty array when no history loaded', () => {
            clearHistory();
            expect(getPerImageMetrics()).toEqual([]);
        });

        it('should return per-image metrics from last run', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        perImage: [
                            createMockImageMetrics('image1.png', 0.8),
                            createMockImageMetrics('image2.png', 0.9),
                        ],
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const metrics = getPerImageMetrics();

            expect(metrics.length).toBe(2);
            expect(metrics[0].imagePath).toBe('image1.png');
            expect(metrics[1].imagePath).toBe('image2.png');
        });

        it('should calculate delta from previous run', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({
                        id: 'run-1',
                        perImage: [createMockImageMetrics('image1.png', 0.7)],
                    }),
                    createMockRun({
                        id: 'run-2',
                        perImage: [createMockImageMetrics('image1.png', 0.85)],
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const metrics = getPerImageMetrics();

            expect(metrics[0].deltaFromPrevious).toBeCloseTo(0.15, 2);
        });

        it('should return empty array when no perImage data', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1' })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const metrics = getPerImageMetrics();

            expect(metrics).toEqual([]);
        });
    });

    // ========================================
    // analyzeTrends Tests
    // ========================================
    describe('analyzeTrends', () => {
        it('should return null when no history loaded', () => {
            clearHistory();
            expect(analyzeTrends()).toBeNull();
        });

        it('should return null with insufficient runs', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [createMockRun({ id: 'run-1' }), createMockRun({ id: 'run-2' })],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const trends = analyzeTrends();

            expect(trends).toBeNull();
        });

        it('should analyze improving trend', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({ id: 'old-1', f1: 0.5 }),
                    createMockRun({ id: 'old-2', f1: 0.52 }),
                    createMockRun({ id: 'old-3', f1: 0.53 }),
                    createMockRun({ id: 'old-4', f1: 0.54 }),
                    createMockRun({ id: 'old-5', f1: 0.55 }),
                    createMockRun({ id: 'new-1', f1: 0.85 }),
                    createMockRun({ id: 'new-2', f1: 0.87 }),
                    createMockRun({ id: 'new-3', f1: 0.89 }),
                    createMockRun({ id: 'new-4', f1: 0.9 }),
                    createMockRun({ id: 'new-5', f1: 0.92 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const trends = analyzeTrends();

            expect(trends).not.toBeNull();
            expect(trends!.direction).toBe('improving');
            expect(trends!.delta).toBeGreaterThan(0);
            expect(trends!.percentChange).toBeGreaterThan(0);
        });

        it('should analyze declining trend', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({ id: 'old-1', f1: 0.9 }),
                    createMockRun({ id: 'old-2', f1: 0.91 }),
                    createMockRun({ id: 'old-3', f1: 0.92 }),
                    createMockRun({ id: 'old-4', f1: 0.91 }),
                    createMockRun({ id: 'old-5', f1: 0.9 }),
                    createMockRun({ id: 'new-1', f1: 0.5 }),
                    createMockRun({ id: 'new-2', f1: 0.48 }),
                    createMockRun({ id: 'new-3', f1: 0.45 }),
                    createMockRun({ id: 'new-4', f1: 0.42 }),
                    createMockRun({ id: 'new-5', f1: 0.4 }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const trends = analyzeTrends();

            expect(trends).not.toBeNull();
            expect(trends!.direction).toBe('declining');
            expect(trends!.delta).toBeLessThan(0);
        });

        it('should track item trends', async () => {
            const mockHistory: BenchmarkHistory = {
                version: 1,
                runs: [
                    createMockRun({ id: 'old-1', f1: 0.7 }),
                    createMockRun({ id: 'old-2', f1: 0.7 }),
                    createMockRun({ id: 'old-3', f1: 0.7 }),
                    createMockRun({ id: 'old-4', f1: 0.7 }),
                    createMockRun({
                        id: 'old-5',
                        f1: 0.7,
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.5),
                            shield: createMockItemMetrics('shield', 'Shield', 0.9),
                        },
                    }),
                    createMockRun({ id: 'new-1', f1: 0.75 }),
                    createMockRun({ id: 'new-2', f1: 0.75 }),
                    createMockRun({ id: 'new-3', f1: 0.75 }),
                    createMockRun({ id: 'new-4', f1: 0.75 }),
                    createMockRun({
                        id: 'new-5',
                        f1: 0.75,
                        perItem: {
                            sword: createMockItemMetrics('sword', 'Sword', 0.8), // Improved
                            shield: createMockItemMetrics('shield', 'Shield', 0.7), // Declined
                        },
                    }),
                ],
            };

            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockHistory),
                })
            );

            clearHistory();
            await loadBenchmarkHistory();
            const trends = analyzeTrends();

            expect(trends).not.toBeNull();
            expect(trends!.itemTrends.improved).toContain('sword');
            expect(trends!.itemTrends.declined).toContain('shield');
        });
    });
});

// ========================================
// Test Helpers
// ========================================

function createMockRun(
    overrides: Partial<BenchmarkRun> & { f1?: number; perItem?: Record<string, any>; perImage?: any[] }
): BenchmarkRun {
    const f1 = overrides.f1 ?? 0.8;
    return {
        id: overrides.id || `run-${Date.now()}`,
        timestamp: overrides.timestamp || new Date().toISOString(),
        mode: overrides.mode || 'full',
        imageCount: overrides.imageCount || 10,
        totalItems: overrides.totalItems || 100,
        metrics: {
            accuracy: f1,
            precision: f1,
            recall: f1,
            f1: f1,
            avgF1: f1,
        },
        timing: {
            totalMs: 1000,
            avgPerImageMs: 100,
        },
        perItem: overrides.perItem,
        perImage: overrides.perImage,
    };
}

function createMockItemMetrics(itemId: string, itemName: string, f1: number) {
    return {
        itemId,
        itemName,
        truePositives: Math.round(f1 * 10),
        falsePositives: Math.round((1 - f1) * 5),
        falseNegatives: Math.round((1 - f1) * 5),
        precision: f1,
        recall: f1,
        f1,
        sampleCount: 10,
    };
}

function createMockImageMetrics(imagePath: string, f1: number) {
    return {
        imagePath,
        resolution: '1920x1080',
        itemCount: 10,
        detected: Math.round(f1 * 10),
        correct: Math.round(f1 * 10),
        f1,
        precision: f1,
        recall: f1,
    };
}
