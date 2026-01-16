// ========================================
// Computer Vision Performance Metrics
// ========================================
// Tracks and compares performance of different CV strategies
// ========================================

import type { CVDetectionResult } from './computer-vision.ts';
import type { CVStrategy } from './cv-strategy.ts';
import type { Item } from '../types/index.ts';

/**
 * Performance metrics for a detection run
 */
export interface DetectionMetrics {
    // Timing metrics
    totalTime: number; // Total detection time (ms)
    loadTime: number; // Image/template loading time (ms)
    preprocessTime: number; // Preprocessing time (ms)
    matchingTime: number; // Template matching time (ms)
    postprocessTime: number; // Post-processing time (ms)

    // Accuracy metrics (if ground truth available)
    truePositives?: number; // Correctly detected items
    falsePositives?: number; // Incorrectly detected items
    falseNegatives?: number; // Missed items
    precision?: number; // TP / (TP + FP)
    recall?: number; // TP / (TP + FN)
    f1Score?: number; // 2 * (precision * recall) / (precision + recall)
    accuracy?: number; // TP / (TP + FP + FN)

    // Detection statistics
    totalDetections: number;
    averageConfidence: number;
    medianConfidence: number;
    highConfidenceDetections: number; // >0.85
    mediumConfidenceDetections: number; // 0.70-0.85
    lowConfidenceDetections: number; // <0.70

    // Pass statistics (multi-pass detection)
    pass1Detections?: number;
    pass2Detections?: number;
    pass3Detections?: number;

    // Cell statistics
    totalCells: number;
    emptyCells: number;
    validCells: number;
    matchedCells: number;
    matchRate: number; // matchedCells / validCells

    // Strategy used
    strategy: CVStrategy;
    strategyName: string;
    timestamp: number;
}

/**
 * Ground truth data for validation
 */
export interface GroundTruth {
    items: Array<{
        id: string;
        name: string;
        count: number;
    }>;
    tomes?: string[];
    character?: string;
    weapon?: string;
}

/**
 * Comparison report for multiple strategies
 */
export interface StrategyComparison {
    strategies: string[];
    metrics: DetectionMetrics[];

    // Summary statistics
    summary: {
        fastestStrategy: string;
        fastestTime: number;
        mostAccurateStrategy?: string;
        bestAccuracy?: number;
        bestF1Strategy?: string;
        bestF1Score?: number;
    };

    // Recommendations
    recommendations: {
        forSpeed: string;
        forAccuracy: string;
        forBalance: string;
    };
}

/**
 * Metrics tracker singleton
 */
class MetricsTracker {
    private runs: DetectionMetrics[] = [];
    private maxRuns = 100; // Keep last 100 runs

    /**
     * Start a new metrics tracking session
     */
    startTracking(strategy: CVStrategy, strategyName: string): MetricsSession {
        return new MetricsSession(strategy, strategyName, this);
    }

    /**
     * Record completed metrics
     */
    recordMetrics(metrics: DetectionMetrics): void {
        this.runs.push(metrics);

        // Keep only last maxRuns
        if (this.runs.length > this.maxRuns) {
            this.runs = this.runs.slice(-this.maxRuns);
        }
    }

    /**
     * Get all recorded metrics
     */
    getAllMetrics(): DetectionMetrics[] {
        return [...this.runs];
    }

    /**
     * Get metrics for a specific strategy
     */
    getMetricsForStrategy(strategyName: string): DetectionMetrics[] {
        return this.runs.filter(m => m.strategyName === strategyName);
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.runs = [];
    }

    /**
     * Compare multiple strategies
     */
    compareStrategies(strategyNames: string[]): StrategyComparison {
        const metrics: DetectionMetrics[] = strategyNames.map(name => {
            const strategyMetrics = this.getMetricsForStrategy(name);
            if (strategyMetrics.length === 0) {
                throw new Error(`No metrics found for strategy: ${name}`);
            }
            // Return most recent run
            return strategyMetrics[strategyMetrics.length - 1]!;
        });

        // Find fastest
        let fastestStrategy = '';
        let fastestTime = Infinity;
        metrics.forEach((m, i) => {
            if (m.totalTime < fastestTime) {
                fastestTime = m.totalTime;
                fastestStrategy = strategyNames[i] ?? '';
            }
        });

        // Find most accurate (by F1 score if available)
        let mostAccurateStrategy: string | undefined;
        let bestAccuracy: number | undefined;
        let bestF1Strategy: string | undefined;
        let bestF1Score: number | undefined;

        metrics.forEach((m, i) => {
            if (m.accuracy !== undefined) {
                if (bestAccuracy === undefined || m.accuracy > bestAccuracy) {
                    bestAccuracy = m.accuracy;
                    mostAccurateStrategy = strategyNames[i] ?? '';
                }
            }

            if (m.f1Score !== undefined) {
                if (bestF1Score === undefined || m.f1Score > bestF1Score) {
                    bestF1Score = m.f1Score;
                    bestF1Strategy = strategyNames[i] ?? '';
                }
            }
        });

        // Determine recommendations
        const recommendations = {
            forSpeed: fastestStrategy,
            forAccuracy: bestF1Strategy || mostAccurateStrategy || fastestStrategy,
            forBalance: this.findBalancedStrategy(metrics, strategyNames),
        };

        return {
            strategies: strategyNames,
            metrics,
            summary: {
                fastestStrategy,
                fastestTime,
                mostAccurateStrategy,
                bestAccuracy,
                bestF1Strategy,
                bestF1Score,
            },
            recommendations,
        };
    }

    /**
     * Find balanced strategy (best speed/accuracy trade-off)
     */
    private findBalancedStrategy(metrics: DetectionMetrics[], strategyNames: string[]): string {
        let bestScore = -Infinity;
        let bestStrategy = strategyNames[0] ?? '';

        metrics.forEach((m, i) => {
            // Normalize speed (inverse) and accuracy to 0-1 scale
            const speedScore = 1 - m.totalTime / 10000; // Assume max 10s
            const accuracyScore = m.f1Score || m.accuracy || m.matchRate;

            // Balanced score (equal weight)
            const balancedScore = (speedScore + accuracyScore) / 2;

            if (balancedScore > bestScore) {
                bestScore = balancedScore;
                bestStrategy = strategyNames[i] ?? '';
            }
        });

        return bestStrategy;
    }

    /**
     * Export metrics to JSON
     */
    exportMetrics(): string {
        return JSON.stringify(this.runs, null, 2);
    }

    /**
     * Generate markdown report
     */
    generateReport(strategyNames?: string[]): string {
        const metricsToReport = strategyNames
            ? strategyNames.flatMap(name => this.getMetricsForStrategy(name))
            : this.runs;

        if (metricsToReport.length === 0) {
            return '# No metrics available';
        }

        let report = '# Computer Vision Performance Report\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;
        report += `Total runs: ${metricsToReport.length}\n\n`;

        // Summary table
        report += '## Performance Summary\n\n';
        report += '| Strategy | Total Time | Detections | Avg Confidence | Precision | Recall | F1 Score |\n';
        report += '|----------|-----------|------------|----------------|-----------|--------|----------|\n';

        metricsToReport.forEach(m => {
            const precision = m.precision !== undefined ? m.precision.toFixed(3) : 'N/A';
            const recall = m.recall !== undefined ? m.recall.toFixed(3) : 'N/A';
            const f1 = m.f1Score !== undefined ? m.f1Score.toFixed(3) : 'N/A';

            report += `| ${m.strategyName} | ${m.totalTime}ms | ${m.totalDetections} | ${m.averageConfidence.toFixed(2)} | ${precision} | ${recall} | ${f1} |\n`;
        });

        report += '\n';

        // Detailed metrics for each run
        report += '## Detailed Metrics\n\n';
        metricsToReport.forEach((m, i) => {
            report += `### Run ${i + 1}: ${m.strategyName}\n\n`;
            report += `- **Timestamp:** ${new Date(m.timestamp).toISOString()}\n`;
            report += `- **Total Time:** ${m.totalTime}ms\n`;
            report += `  - Load Time: ${m.loadTime}ms\n`;
            report += `  - Preprocess Time: ${m.preprocessTime}ms\n`;
            report += `  - Matching Time: ${m.matchingTime}ms\n`;
            report += `  - Postprocess Time: ${m.postprocessTime}ms\n`;
            report += `- **Detections:** ${m.totalDetections}\n`;
            report += `  - High Confidence (>0.85): ${m.highConfidenceDetections}\n`;
            report += `  - Medium Confidence (0.70-0.85): ${m.mediumConfidenceDetections}\n`;
            report += `  - Low Confidence (<0.70): ${m.lowConfidenceDetections}\n`;
            report += `- **Cell Statistics:**\n`;
            report += `  - Total Cells: ${m.totalCells}\n`;
            report += `  - Empty Cells: ${m.emptyCells}\n`;
            report += `  - Valid Cells: ${m.validCells}\n`;
            report += `  - Matched Cells: ${m.matchedCells}\n`;
            report += `  - Match Rate: ${(m.matchRate * 100).toFixed(1)}%\n`;

            if (m.precision !== undefined) {
                report += `- **Accuracy Metrics:**\n`;
                report += `  - True Positives: ${m.truePositives}\n`;
                report += `  - False Positives: ${m.falsePositives}\n`;
                report += `  - False Negatives: ${m.falseNegatives}\n`;
                report += `  - Precision: ${(m.precision * 100).toFixed(1)}%\n`;
                report += `  - Recall: ${((m.recall ?? 0) * 100).toFixed(1)}%\n`;
                report += `  - F1 Score: ${((m.f1Score ?? 0) * 100).toFixed(1)}%\n`;
                report += `  - Accuracy: ${((m.accuracy ?? 0) * 100).toFixed(1)}%\n`;
            }

            report += '\n';
        });

        return report;
    }
}

/**
 * Metrics tracking session
 */
class MetricsSession {
    private startTime: number;
    private loadStartTime?: number;
    private preprocessStartTime?: number;
    private matchingStartTime?: number;
    private postprocessStartTime?: number;

    private loadTime = 0;
    private preprocessTime = 0;
    private matchingTime = 0;
    private postprocessTime = 0;

    private detections: CVDetectionResult[] = [];
    private groundTruth?: GroundTruth;

    private cellStats = {
        total: 0,
        empty: 0,
        valid: 0,
        matched: 0,
    };

    private passStats = {
        pass1: 0,
        pass2: 0,
        pass3: 0,
    };

    constructor(
        private strategy: CVStrategy,
        private strategyName: string,
        private tracker: MetricsTracker
    ) {
        this.startTime = performance.now();
    }

    /**
     * Mark start of loading phase
     */
    startLoad(): void {
        this.loadStartTime = performance.now();
    }

    /**
     * Mark end of loading phase
     */
    endLoad(): void {
        if (this.loadStartTime) {
            this.loadTime = performance.now() - this.loadStartTime;
        }
    }

    /**
     * Mark start of preprocessing phase
     */
    startPreprocess(): void {
        this.preprocessStartTime = performance.now();
    }

    /**
     * Mark end of preprocessing phase
     */
    endPreprocess(): void {
        if (this.preprocessStartTime) {
            this.preprocessTime = performance.now() - this.preprocessStartTime;
        }
    }

    /**
     * Mark start of matching phase
     */
    startMatching(): void {
        this.matchingStartTime = performance.now();
    }

    /**
     * Mark end of matching phase
     */
    endMatching(): void {
        if (this.matchingStartTime) {
            this.matchingTime = performance.now() - this.matchingStartTime;
        }
    }

    /**
     * Mark start of postprocessing phase
     */
    startPostprocess(): void {
        this.postprocessStartTime = performance.now();
    }

    /**
     * Mark end of postprocessing phase
     */
    endPostprocess(): void {
        if (this.postprocessStartTime) {
            this.postprocessTime = performance.now() - this.postprocessStartTime;
        }
    }

    /**
     * Set ground truth for accuracy calculation
     */
    setGroundTruth(groundTruth: GroundTruth): void {
        this.groundTruth = groundTruth;
    }

    /**
     * Record detections
     */
    recordDetections(detections: CVDetectionResult[]): void {
        this.detections = detections;
    }

    /**
     * Record cell statistics
     */
    recordCellStats(total: number, empty: number, valid: number, matched: number): void {
        this.cellStats = { total, empty, valid, matched };
    }

    /**
     * Record pass statistics
     */
    recordPassStats(pass1: number, pass2: number, pass3: number): void {
        this.passStats = { pass1, pass2, pass3 };
    }

    /**
     * Complete tracking and generate metrics
     */
    complete(): DetectionMetrics {
        const totalTime = performance.now() - this.startTime;

        // Calculate confidence statistics
        const confidences = this.detections.map(d => d.confidence);
        const averageConfidence =
            confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

        const sortedConfidences = [...confidences].sort((a, b) => a - b);
        const medianConfidence =
            sortedConfidences.length > 0 ? (sortedConfidences[Math.floor(sortedConfidences.length / 2)] ?? 0) : 0;

        const highConfidenceDetections = confidences.filter(c => c >= 0.85).length;
        const mediumConfidenceDetections = confidences.filter(c => c >= 0.7 && c < 0.85).length;
        const lowConfidenceDetections = confidences.filter(c => c < 0.7).length;

        const matchRate = this.cellStats.valid > 0 ? this.cellStats.matched / this.cellStats.valid : 0;

        // Calculate accuracy metrics if ground truth available
        let accuracyMetrics: Partial<DetectionMetrics> = {};

        if (this.groundTruth) {
            accuracyMetrics = this.calculateAccuracyMetrics(this.detections, this.groundTruth);
        }

        const metrics: DetectionMetrics = {
            totalTime,
            loadTime: this.loadTime,
            preprocessTime: this.preprocessTime,
            matchingTime: this.matchingTime,
            postprocessTime: this.postprocessTime,

            totalDetections: this.detections.length,
            averageConfidence,
            medianConfidence,
            highConfidenceDetections,
            mediumConfidenceDetections,
            lowConfidenceDetections,

            pass1Detections: this.passStats.pass1,
            pass2Detections: this.passStats.pass2,
            pass3Detections: this.passStats.pass3,

            totalCells: this.cellStats.total,
            emptyCells: this.cellStats.empty,
            validCells: this.cellStats.valid,
            matchedCells: this.cellStats.matched,
            matchRate,

            strategy: this.strategy,
            strategyName: this.strategyName,
            timestamp: Date.now(),

            ...accuracyMetrics,
        };

        // Record in tracker
        this.tracker.recordMetrics(metrics);

        return metrics;
    }

    /**
     * Calculate accuracy metrics against ground truth
     */
    private calculateAccuracyMetrics(
        detections: CVDetectionResult[],
        groundTruth: GroundTruth
    ): Partial<DetectionMetrics> {
        // Convert detections to item counts
        const detectedItems = new Map<string, number>();
        detections.forEach(d => {
            const item = d.entity as Item;
            detectedItems.set(item.id, (detectedItems.get(item.id) || 0) + 1);
        });

        // Convert ground truth to map
        const truthItems = new Map<string, number>();
        groundTruth.items.forEach(item => {
            truthItems.set(item.id, item.count);
        });

        // Calculate TP, FP, FN
        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;

        // True positives: items correctly detected
        detectedItems.forEach((detectedCount, itemId) => {
            const truthCount = truthItems.get(itemId) || 0;
            truePositives += Math.min(detectedCount, truthCount);
            if (detectedCount > truthCount) {
                falsePositives += detectedCount - truthCount;
            }
        });

        // False negatives: items in truth but not detected
        truthItems.forEach((truthCount, itemId) => {
            const detectedCount = detectedItems.get(itemId) || 0;
            if (detectedCount < truthCount) {
                falseNegatives += truthCount - detectedCount;
            }
        });

        // Calculate metrics
        const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;

        const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;

        const f1Score = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

        const accuracy =
            truePositives + falsePositives + falseNegatives > 0
                ? truePositives / (truePositives + falsePositives + falseNegatives)
                : 0;

        return {
            truePositives,
            falsePositives,
            falseNegatives,
            precision,
            recall,
            f1Score,
            accuracy,
        };
    }
}

/**
 * Global metrics tracker instance
 */
export const metricsTracker = new MetricsTracker();

/**
 * Create a new metrics tracking session
 */
export function startMetricsTracking(strategy: CVStrategy, strategyName: string): MetricsSession {
    return metricsTracker.startTracking(strategy, strategyName);
}
