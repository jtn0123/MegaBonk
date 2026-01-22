// ========================================
// CV Detection Metrics Collection
// ========================================
// Tracks performance and accuracy metrics for CV detection
// Used for empirical validation and optimization

import { logger } from '../logger.ts';

// ========================================
// Types
// ========================================

/**
 * Metrics for a single detection run
 */
export interface CVDetectionMetrics {
    // Timing metrics
    totalTimeMs: number;
    gridDetectionTimeMs: number;
    templateMatchingTimeMs: number;
    validationTimeMs: number;

    // Two-phase detection metrics
    twoPhaseAttempted: boolean;
    twoPhaseSucceeded: boolean;
    twoPhaseFailureReason: string | null;
    gridConfidence: number;
    gridCellsGenerated: number;

    // Grid verification metrics
    gridVerificationInput: number;
    gridVerificationOutput: number;
    gridVerificationRejected: number;

    // Color pre-filtering metrics
    colorFilterAttempts: number;
    colorExactMatches: number;
    colorMixedFallbacks: number;
    avgCandidatesAfterColorFilter: number;

    // Detection results
    totalDetections: number;
    highConfidenceDetections: number; // >0.8
    mediumConfidenceDetections: number; // 0.65-0.8
    lowConfidenceDetections: number; // <0.65

    // Confidence distribution (buckets)
    confidenceHistogram: {
        '0.5-0.6': number;
        '0.6-0.7': number;
        '0.7-0.8': number;
        '0.8-0.9': number;
        '0.9-1.0': number;
    };

    // Rarity validation metrics
    rarityValidationMatches: number;
    rarityValidationMismatches: number;
    rarityValidationRejections: number;

    // Per-rarity detection counts
    detectionsByRarity: Record<string, number>;

    // Image info
    imageWidth: number;
    imageHeight: number;
    resolution: string;
}

/**
 * Aggregated metrics across multiple runs
 */
export interface CVAggregatedMetrics {
    runCount: number;

    // Two-phase success rate
    twoPhaseSuccessRate: number;
    avgGridConfidence: number;

    // Grid verification stats
    avgGridRetentionRate: number;

    // Color filtering stats
    avgColorExactMatchRate: number;
    avgColorMixedFallbackRate: number;
    avgCandidatesAfterFilter: number;

    // Detection stats
    avgDetectionsPerRun: number;
    avgHighConfidenceRate: number;

    // Timing stats
    avgTotalTimeMs: number;
    avgGridDetectionTimeMs: number;
    avgTemplateMatchingTimeMs: number;

    // Per-difficulty stats
    byDifficulty: Record<
        string,
        {
            avgF1: number;
            avgPrecision: number;
            avgRecall: number;
            avgDetections: number;
        }
    >;
}

// ========================================
// Metrics Collector Class
// ========================================

/**
 * Singleton metrics collector for CV detection
 */
class CVMetricsCollector {
    private static instance: CVMetricsCollector;
    private enabled: boolean = false;
    private runs: CVDetectionMetrics[] = [];
    private currentRun: Partial<CVDetectionMetrics> | null = null;
    private colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] as number[] };

    private constructor() {}

    static getInstance(): CVMetricsCollector {
        if (!CVMetricsCollector.instance) {
            CVMetricsCollector.instance = new CVMetricsCollector();
        }
        return CVMetricsCollector.instance;
    }

    /**
     * Enable or disable metrics collection
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) {
            logger.info({ operation: 'cv.metrics.enabled' });
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Start a new detection run
     */
    startRun(imageWidth: number, imageHeight: number, resolution: string): void {
        if (!this.enabled) return;

        this.currentRun = {
            totalTimeMs: 0,
            gridDetectionTimeMs: 0,
            templateMatchingTimeMs: 0,
            validationTimeMs: 0,
            twoPhaseAttempted: false,
            twoPhaseSucceeded: false,
            twoPhaseFailureReason: null,
            gridConfidence: 0,
            gridCellsGenerated: 0,
            gridVerificationInput: 0,
            gridVerificationOutput: 0,
            gridVerificationRejected: 0,
            colorFilterAttempts: 0,
            colorExactMatches: 0,
            colorMixedFallbacks: 0,
            avgCandidatesAfterColorFilter: 0,
            totalDetections: 0,
            highConfidenceDetections: 0,
            mediumConfidenceDetections: 0,
            lowConfidenceDetections: 0,
            confidenceHistogram: {
                '0.5-0.6': 0,
                '0.6-0.7': 0,
                '0.7-0.8': 0,
                '0.8-0.9': 0,
                '0.9-1.0': 0,
            },
            rarityValidationMatches: 0,
            rarityValidationMismatches: 0,
            rarityValidationRejections: 0,
            detectionsByRarity: {},
            imageWidth,
            imageHeight,
            resolution,
        };

        // Reset color filter stats for this run
        this.colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] };
    }

    /**
     * Record two-phase detection attempt
     */
    recordTwoPhaseAttempt(
        succeeded: boolean,
        failureReason: string | null,
        gridConfidence: number,
        gridCells: number
    ): void {
        if (!this.enabled || !this.currentRun) return;

        this.currentRun.twoPhaseAttempted = true;
        this.currentRun.twoPhaseSucceeded = succeeded;
        this.currentRun.twoPhaseFailureReason = failureReason;
        this.currentRun.gridConfidence = gridConfidence;
        this.currentRun.gridCellsGenerated = gridCells;
    }

    /**
     * Record grid detection timing
     */
    recordGridDetectionTime(timeMs: number): void {
        if (!this.enabled || !this.currentRun) return;
        this.currentRun.gridDetectionTimeMs = timeMs;
    }

    /**
     * Record template matching timing
     */
    recordTemplateMatchingTime(timeMs: number): void {
        if (!this.enabled || !this.currentRun) return;
        this.currentRun.templateMatchingTimeMs = timeMs;
    }

    /**
     * Record validation timing
     */
    recordValidationTime(timeMs: number): void {
        if (!this.enabled || !this.currentRun) return;
        this.currentRun.validationTimeMs = timeMs;
    }

    /**
     * Record grid verification results
     */
    recordGridVerification(inputCount: number, outputCount: number): void {
        if (!this.enabled || !this.currentRun) return;

        this.currentRun.gridVerificationInput = inputCount;
        this.currentRun.gridVerificationOutput = outputCount;
        this.currentRun.gridVerificationRejected = inputCount - outputCount;
    }

    /**
     * Record color filter usage
     */
    recordColorFilter(usedExactMatch: boolean, usedMixed: boolean, candidateCount: number): void {
        if (!this.enabled || !this.currentRun) return;

        this.colorFilterStats.attempts++;
        if (usedExactMatch) this.colorFilterStats.exactMatches++;
        if (usedMixed) this.colorFilterStats.mixedFallbacks++;
        this.colorFilterStats.candidateCounts.push(candidateCount);
    }

    /**
     * Record a detection with its confidence
     */
    recordDetection(confidence: number, rarity: string): void {
        if (!this.enabled || !this.currentRun) return;

        this.currentRun.totalDetections = (this.currentRun.totalDetections || 0) + 1;

        // Categorize by confidence
        if (confidence >= 0.8) {
            this.currentRun.highConfidenceDetections = (this.currentRun.highConfidenceDetections || 0) + 1;
        } else if (confidence >= 0.65) {
            this.currentRun.mediumConfidenceDetections = (this.currentRun.mediumConfidenceDetections || 0) + 1;
        } else {
            this.currentRun.lowConfidenceDetections = (this.currentRun.lowConfidenceDetections || 0) + 1;
        }

        // Update histogram
        const histogram = this.currentRun.confidenceHistogram!;
        if (confidence >= 0.9) histogram['0.9-1.0']++;
        else if (confidence >= 0.8) histogram['0.8-0.9']++;
        else if (confidence >= 0.7) histogram['0.7-0.8']++;
        else if (confidence >= 0.6) histogram['0.6-0.7']++;
        else histogram['0.5-0.6']++;

        // Track by rarity
        if (!this.currentRun.detectionsByRarity) {
            this.currentRun.detectionsByRarity = {};
        }
        this.currentRun.detectionsByRarity[rarity] = (this.currentRun.detectionsByRarity[rarity] || 0) + 1;
    }

    /**
     * Record rarity validation result
     */
    recordRarityValidation(matched: boolean, rejected: boolean): void {
        if (!this.enabled || !this.currentRun) return;

        if (rejected) {
            this.currentRun.rarityValidationRejections = (this.currentRun.rarityValidationRejections || 0) + 1;
        } else if (matched) {
            this.currentRun.rarityValidationMatches = (this.currentRun.rarityValidationMatches || 0) + 1;
        } else {
            this.currentRun.rarityValidationMismatches = (this.currentRun.rarityValidationMismatches || 0) + 1;
        }
    }

    /**
     * End the current run and record total time
     */
    endRun(totalTimeMs: number): CVDetectionMetrics | null {
        if (!this.enabled || !this.currentRun) return null;

        // Finalize color filter stats
        this.currentRun.colorFilterAttempts = this.colorFilterStats.attempts;
        this.currentRun.colorExactMatches = this.colorFilterStats.exactMatches;
        this.currentRun.colorMixedFallbacks = this.colorFilterStats.mixedFallbacks;
        this.currentRun.avgCandidatesAfterColorFilter =
            this.colorFilterStats.candidateCounts.length > 0
                ? this.colorFilterStats.candidateCounts.reduce((a, b) => a + b, 0) /
                  this.colorFilterStats.candidateCounts.length
                : 0;

        this.currentRun.totalTimeMs = totalTimeMs;

        const metrics = this.currentRun as CVDetectionMetrics;
        this.runs.push(metrics);
        this.currentRun = null;

        return metrics;
    }

    /**
     * Get all recorded runs
     */
    getRuns(): CVDetectionMetrics[] {
        return [...this.runs];
    }

    /**
     * Get aggregated metrics
     */
    getAggregatedMetrics(): CVAggregatedMetrics | null {
        if (this.runs.length === 0) return null;

        const runs = this.runs;
        const runCount = runs.length;

        // Two-phase success rate
        const twoPhaseAttempts = runs.filter(r => r.twoPhaseAttempted).length;
        const twoPhaseSuccesses = runs.filter(r => r.twoPhaseSucceeded).length;
        const twoPhaseSuccessRate = twoPhaseAttempts > 0 ? twoPhaseSuccesses / twoPhaseAttempts : 0;

        // Grid confidence
        const gridConfidences = runs.filter(r => r.twoPhaseAttempted).map(r => r.gridConfidence);
        const avgGridConfidence =
            gridConfidences.length > 0 ? gridConfidences.reduce((a, b) => a + b, 0) / gridConfidences.length : 0;

        // Grid retention rate
        const retentionRates = runs
            .filter(r => r.gridVerificationInput > 0)
            .map(r => r.gridVerificationOutput / r.gridVerificationInput);
        const avgGridRetentionRate =
            retentionRates.length > 0 ? retentionRates.reduce((a, b) => a + b, 0) / retentionRates.length : 1;

        // Color filtering
        const colorRuns = runs.filter(r => r.colorFilterAttempts > 0);
        const avgColorExactMatchRate =
            colorRuns.length > 0
                ? colorRuns.reduce((sum, r) => sum + r.colorExactMatches / r.colorFilterAttempts, 0) / colorRuns.length
                : 0;
        const avgColorMixedFallbackRate =
            colorRuns.length > 0
                ? colorRuns.reduce((sum, r) => sum + r.colorMixedFallbacks / r.colorFilterAttempts, 0) /
                  colorRuns.length
                : 0;
        const avgCandidatesAfterFilter =
            colorRuns.length > 0
                ? colorRuns.reduce((sum, r) => sum + r.avgCandidatesAfterColorFilter, 0) / colorRuns.length
                : 0;

        // Detection stats
        const avgDetectionsPerRun = runs.reduce((sum, r) => sum + r.totalDetections, 0) / runCount;
        const avgHighConfidenceRate =
            runs.reduce(
                (sum, r) => sum + (r.totalDetections > 0 ? r.highConfidenceDetections / r.totalDetections : 0),
                0
            ) / runCount;

        // Timing
        const avgTotalTimeMs = runs.reduce((sum, r) => sum + r.totalTimeMs, 0) / runCount;
        const avgGridDetectionTimeMs = runs.reduce((sum, r) => sum + r.gridDetectionTimeMs, 0) / runCount;
        const avgTemplateMatchingTimeMs = runs.reduce((sum, r) => sum + r.templateMatchingTimeMs, 0) / runCount;

        return {
            runCount,
            twoPhaseSuccessRate,
            avgGridConfidence,
            avgGridRetentionRate,
            avgColorExactMatchRate,
            avgColorMixedFallbackRate,
            avgCandidatesAfterFilter,
            avgDetectionsPerRun,
            avgHighConfidenceRate,
            avgTotalTimeMs,
            avgGridDetectionTimeMs,
            avgTemplateMatchingTimeMs,
            byDifficulty: {}, // Populated by test runner
        };
    }

    /**
     * Clear all recorded metrics
     */
    clear(): void {
        this.runs = [];
        this.currentRun = null;
        this.colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] };
    }

    /**
     * Export metrics to JSON
     */
    exportJSON(): string {
        return JSON.stringify(
            {
                runs: this.runs,
                aggregated: this.getAggregatedMetrics(),
                timestamp: new Date().toISOString(),
            },
            null,
            2
        );
    }
}

// ========================================
// Exported Functions
// ========================================

/**
 * Get the metrics collector instance
 */
export function getMetricsCollector(): CVMetricsCollector {
    return CVMetricsCollector.getInstance();
}

/**
 * Enable metrics collection
 */
export function enableMetrics(): void {
    getMetricsCollector().setEnabled(true);
}

/**
 * Disable metrics collection
 */
export function disableMetrics(): void {
    getMetricsCollector().setEnabled(false);
}

/**
 * Check if metrics collection is enabled
 */
export function isMetricsEnabled(): boolean {
    return getMetricsCollector().isEnabled();
}
