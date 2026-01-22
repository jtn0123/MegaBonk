// ========================================
// CV Accuracy Tracker
// ========================================
// Tracks detection accuracy over time and provides insights
// for improving training data and identifying weak items

import { logger } from '../logger.ts';

// ========================================
// Types
// ========================================

/**
 * Metrics for a single item's detection performance
 */
export interface ItemAccuracyMetrics {
    itemId: string;
    itemName: string;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1: number;
    sampleCount: number;
}

/**
 * Metrics for a single image's detection performance
 */
export interface ImageAccuracyMetrics {
    imagePath: string;
    resolution: string;
    itemCount: number;
    detected: number;
    correct: number;
    f1: number;
    precision: number;
    recall: number;
    deltaFromPrevious?: number;
}

/**
 * A single benchmark run record
 */
export interface BenchmarkRun {
    id: string;
    timestamp: string;
    mode: 'full' | 'quick' | 'single';
    imageCount: number;
    totalItems: number;
    trainingDataVersion?: string;
    trainingDataSamples?: number;
    metrics: {
        accuracy: number;
        precision: number;
        recall: number;
        f1: number;
        avgF1: number;
    };
    timing: {
        totalMs: number;
        avgPerImageMs: number;
    };
    perImage?: ImageAccuracyMetrics[];
    perItem?: Record<string, ItemAccuracyMetrics>;
    config?: {
        threshold: number;
        templateCount: number;
    };
}

/**
 * Full benchmark history file structure
 */
export interface BenchmarkHistory {
    version: number;
    runs: BenchmarkRun[];
}

/**
 * Summary of accuracy for display
 */
export interface AccuracySummary {
    overallF1: number;
    overallPrecision: number;
    overallRecall: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
    weakItems: { itemId: string; itemName: string; f1: number }[];
    strongItems: { itemId: string; itemName: string; f1: number }[];
    lastRunTimestamp: string;
    runCount: number;
}

/**
 * Trend analysis comparing recent runs to older runs
 */
export interface TrendAnalysis {
    recentF1: number;
    olderF1: number;
    delta: number;
    percentChange: number;
    direction: 'improving' | 'stable' | 'declining';
    itemTrends: {
        improved: string[];
        declined: string[];
        stable: string[];
    };
}

// ========================================
// State
// ========================================

let benchmarkHistory: BenchmarkHistory | null = null;
let historyLoaded = false;

// ========================================
// Loading
// ========================================

/**
 * Load benchmark history from data directory
 */
export async function loadBenchmarkHistory(): Promise<BenchmarkHistory | null> {
    if (historyLoaded && benchmarkHistory) {
        return benchmarkHistory;
    }

    try {
        const response = await fetch('data/benchmark-history.json');
        if (!response.ok) {
            logger.info({
                operation: 'cv.accuracy.no_history',
                data: { status: response.status },
            });
            historyLoaded = true;
            return null;
        }

        benchmarkHistory = await response.json();
        historyLoaded = true;

        logger.info({
            operation: 'cv.accuracy.loaded',
            data: {
                runCount: benchmarkHistory?.runs?.length || 0,
            },
        });

        return benchmarkHistory;
    } catch (error) {
        logger.warn({
            operation: 'cv.accuracy.load_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        historyLoaded = true;
        return null;
    }
}

// ========================================
// Analysis Functions
// ========================================

/**
 * Get the grade letter for an F1 score
 */
export function getGradeForF1(f1: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (f1 >= 0.9) return 'A';
    if (f1 >= 0.75) return 'B';
    if (f1 >= 0.6) return 'C';
    if (f1 >= 0.45) return 'D';
    return 'F';
}

/**
 * Get accuracy summary for display on main site
 */
export function getAccuracySummary(): AccuracySummary | null {
    if (!benchmarkHistory || benchmarkHistory.runs.length === 0) {
        return null;
    }

    const lastRun = benchmarkHistory.runs[benchmarkHistory.runs.length - 1];
    const recentRuns = benchmarkHistory.runs.slice(-5);
    const olderRuns = benchmarkHistory.runs.slice(-10, -5);

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
    if (recentRuns.length >= 3 && olderRuns.length >= 1) {
        const recentAvgF1 = recentRuns.reduce((s, r) => s + r.metrics.f1, 0) / recentRuns.length;
        const olderAvgF1 = olderRuns.reduce((s, r) => s + r.metrics.f1, 0) / olderRuns.length;
        const delta = recentAvgF1 - olderAvgF1;

        if (delta > 0.02) trend = 'improving';
        else if (delta < -0.02) trend = 'declining';
        else trend = 'stable';
    }

    // Find weak and strong items from the last run with per-item data
    const weakItems: { itemId: string; itemName: string; f1: number }[] = [];
    const strongItems: { itemId: string; itemName: string; f1: number }[] = [];

    if (lastRun.perItem) {
        const itemMetrics = Object.values(lastRun.perItem);
        itemMetrics.sort((a, b) => a.f1 - b.f1);

        // Get bottom 5 (weak) and top 5 (strong)
        for (const item of itemMetrics.slice(0, 5)) {
            if (item.f1 < 0.5) {
                weakItems.push({
                    itemId: item.itemId,
                    itemName: item.itemName,
                    f1: item.f1,
                });
            }
        }

        for (const item of itemMetrics.slice(-5).reverse()) {
            if (item.f1 >= 0.8) {
                strongItems.push({
                    itemId: item.itemId,
                    itemName: item.itemName,
                    f1: item.f1,
                });
            }
        }
    }

    return {
        overallF1: lastRun.metrics.f1,
        overallPrecision: lastRun.metrics.precision,
        overallRecall: lastRun.metrics.recall,
        grade: getGradeForF1(lastRun.metrics.f1),
        trend,
        weakItems,
        strongItems,
        lastRunTimestamp: lastRun.timestamp,
        runCount: benchmarkHistory.runs.length,
    };
}

/**
 * Analyze trends between recent and older benchmark runs
 */
export function analyzeTrends(): TrendAnalysis | null {
    if (!benchmarkHistory || benchmarkHistory.runs.length < 5) {
        return null;
    }

    const recentRuns = benchmarkHistory.runs.slice(-5);
    const olderRuns = benchmarkHistory.runs.slice(-10, -5);

    if (olderRuns.length === 0) {
        return null;
    }

    const recentF1 = recentRuns.reduce((s, r) => s + r.metrics.f1, 0) / recentRuns.length;
    const olderF1 = olderRuns.reduce((s, r) => s + r.metrics.f1, 0) / olderRuns.length;
    const delta = recentF1 - olderF1;
    const percentChange = olderF1 > 0 ? (delta / olderF1) * 100 : 0;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (delta > 0.02) direction = 'improving';
    else if (delta < -0.02) direction = 'declining';

    // Compare per-item trends if available
    const itemTrends = {
        improved: [] as string[],
        declined: [] as string[],
        stable: [] as string[],
    };

    const lastRun = recentRuns[recentRuns.length - 1];
    const olderRun = olderRuns[olderRuns.length - 1];

    if (lastRun.perItem && olderRun?.perItem) {
        for (const [itemId, currentMetrics] of Object.entries(lastRun.perItem)) {
            const olderMetrics = olderRun.perItem[itemId];
            if (olderMetrics) {
                const itemDelta = currentMetrics.f1 - olderMetrics.f1;
                if (itemDelta > 0.1) {
                    itemTrends.improved.push(itemId);
                } else if (itemDelta < -0.1) {
                    itemTrends.declined.push(itemId);
                } else {
                    itemTrends.stable.push(itemId);
                }
            }
        }
    }

    return {
        recentF1,
        olderF1,
        delta,
        percentChange,
        direction,
        itemTrends,
    };
}

/**
 * Get items that need more training samples (low accuracy)
 */
export function getWeakItems(threshold: number = 0.5): ItemAccuracyMetrics[] {
    if (!benchmarkHistory || benchmarkHistory.runs.length === 0) {
        return [];
    }

    const lastRun = benchmarkHistory.runs[benchmarkHistory.runs.length - 1];
    if (!lastRun.perItem) {
        return [];
    }

    return Object.values(lastRun.perItem)
        .filter(item => item.f1 < threshold)
        .sort((a, b) => a.f1 - b.f1);
}

/**
 * Get per-image accuracy metrics from the last run
 */
export function getPerImageMetrics(): ImageAccuracyMetrics[] {
    if (!benchmarkHistory || benchmarkHistory.runs.length === 0) {
        return [];
    }

    const lastRun = benchmarkHistory.runs[benchmarkHistory.runs.length - 1];
    const previousRun =
        benchmarkHistory.runs.length > 1 ? benchmarkHistory.runs[benchmarkHistory.runs.length - 2] : null;

    if (!lastRun.perImage) {
        return [];
    }

    // Add delta from previous run
    return lastRun.perImage.map(img => {
        let deltaFromPrevious: number | undefined;

        if (previousRun?.perImage) {
            const prevImg = previousRun.perImage.find(p => p.imagePath === img.imagePath);
            if (prevImg) {
                deltaFromPrevious = img.f1 - prevImg.f1;
            }
        }

        return {
            ...img,
            deltaFromPrevious,
        };
    });
}

/**
 * Get detection quality description for display
 */
export function getQualityDescription(f1: number): string {
    if (f1 >= 0.9) return 'Excellent';
    if (f1 >= 0.75) return 'Good';
    if (f1 >= 0.6) return 'Fair';
    if (f1 >= 0.45) return 'Poor';
    return 'Very Poor';
}

/**
 * Format confidence as percentage string
 */
export function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

// ========================================
// Exports for Main Site
// ========================================

/**
 * Check if benchmark history has been loaded
 */
export function isHistoryLoaded(): boolean {
    return historyLoaded;
}

/**
 * Get the number of benchmark runs
 */
export function getRunCount(): number {
    return benchmarkHistory?.runs?.length || 0;
}

/**
 * Get the last benchmark run
 */
export function getLastRun(): BenchmarkRun | null {
    if (!benchmarkHistory || benchmarkHistory.runs.length === 0) {
        return null;
    }
    return benchmarkHistory.runs[benchmarkHistory.runs.length - 1];
}

/**
 * Clear loaded history (for cleanup)
 */
export function clearHistory(): void {
    benchmarkHistory = null;
    historyLoaded = false;
}
