// ========================================
// Scoring Configuration Module
// ========================================
// Optimized metric weights and confidence thresholds
// Based on ablation testing results

/**
 * Metric weight configuration
 */
export interface MetricWeights {
    /** Normalized Cross-Correlation weight */
    ncc: number;
    /** Structural Similarity Index weight */
    ssim: number;
    /** Color histogram similarity weight */
    histogram: number;
    /** Edge-based similarity weight */
    edge: number;
}

/**
 * Agreement bonus configuration
 */
export interface AgreementConfig {
    /** Enable agreement bonus */
    enabled: boolean;
    /** Threshold for counting a metric as "agreeing" */
    threshold: number;
    /** Minimum metrics above threshold for bonus */
    minMetricsForBonus: number;
    /** Bonus per agreeing metric (cumulative) */
    bonusPerMetric: number;
    /** Maximum total bonus */
    maxBonus: number;
}

/**
 * Rarity-specific confidence thresholds
 */
export interface RarityThresholds {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
    unknown: number;
}

/**
 * Complete scoring configuration
 */
export interface ScoringConfig {
    /** Metric weights (should sum to ~1.0) */
    weights: MetricWeights;
    /** Agreement bonus settings */
    agreement: AgreementConfig;
    /** Base confidence threshold */
    baseThreshold: number;
    /** Per-rarity threshold adjustments */
    rarityThresholds: RarityThresholds;
    /** Minimum confidence to report detection */
    minConfidence: number;
    /** Maximum confidence (cap) */
    maxConfidence: number;
}

/**
 * Default scoring configuration
 * Based on ablation results showing:
 * - SSIM is most reliable (weight 0.35)
 * - NCC is fast and decent (weight 0.25)
 * - Histogram helps with color matching (weight 0.25)
 * - Edge is slower but robust (weight 0.15)
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    weights: {
        ssim: 0.35,
        ncc: 0.25,
        histogram: 0.25,
        edge: 0.15,
    },
    agreement: {
        enabled: true,
        threshold: 0.55,
        minMetricsForBonus: 2,
        bonusPerMetric: 0.02,
        maxBonus: 0.06,
    },
    baseThreshold: 0.45,
    rarityThresholds: {
        common: 0.0,      // No adjustment
        uncommon: 0.0,    // No adjustment
        rare: 0.0,        // No adjustment
        epic: -0.02,      // Slightly lower (more lenient)
        legendary: -0.03, // Lower threshold (gold borders are distinctive)
        unknown: 0.05,    // Higher threshold when uncertain
    },
    minConfidence: 0.35,
    maxConfidence: 0.99,
};

/**
 * Optimized scoring configuration
 * Tuned for higher precision (fewer false positives)
 */
export const PRECISION_SCORING_CONFIG: ScoringConfig = {
    weights: {
        ssim: 0.40,
        ncc: 0.20,
        histogram: 0.25,
        edge: 0.15,
    },
    agreement: {
        enabled: true,
        threshold: 0.60,
        minMetricsForBonus: 3,
        bonusPerMetric: 0.015,
        maxBonus: 0.045,
    },
    baseThreshold: 0.55,
    rarityThresholds: {
        common: 0.02,
        uncommon: 0.01,
        rare: 0.0,
        epic: -0.01,
        legendary: -0.02,
        unknown: 0.08,
    },
    minConfidence: 0.45,
    maxConfidence: 0.99,
};

/**
 * Recall-optimized scoring configuration
 * Tuned for higher recall (fewer missed items)
 */
export const RECALL_SCORING_CONFIG: ScoringConfig = {
    weights: {
        ssim: 0.30,
        ncc: 0.30,
        histogram: 0.25,
        edge: 0.15,
    },
    agreement: {
        enabled: true,
        threshold: 0.50,
        minMetricsForBonus: 2,
        bonusPerMetric: 0.025,
        maxBonus: 0.075,
    },
    baseThreshold: 0.38,
    rarityThresholds: {
        common: -0.02,
        uncommon: -0.02,
        rare: -0.01,
        epic: -0.03,
        legendary: -0.05,
        unknown: 0.02,
    },
    minConfidence: 0.30,
    maxConfidence: 0.99,
};

/**
 * Fast scoring configuration
 * Minimal metrics for speed
 */
export const FAST_SCORING_CONFIG: ScoringConfig = {
    weights: {
        ssim: 0.50,
        ncc: 0.50,
        histogram: 0.0,  // Skip histogram
        edge: 0.0,       // Skip edge
    },
    agreement: {
        enabled: false,  // Disable for speed
        threshold: 0.55,
        minMetricsForBonus: 2,
        bonusPerMetric: 0.0,
        maxBonus: 0.0,
    },
    baseThreshold: 0.50,
    rarityThresholds: {
        common: 0.0,
        uncommon: 0.0,
        rare: 0.0,
        epic: 0.0,
        legendary: 0.0,
        unknown: 0.05,
    },
    minConfidence: 0.40,
    maxConfidence: 0.99,
};

// Active configuration
let activeConfig = DEFAULT_SCORING_CONFIG;

/**
 * Set active scoring configuration
 */
export function setScoringConfig(config: ScoringConfig): void {
    activeConfig = config;
}

/**
 * Get active scoring configuration
 */
export function getScoringConfig(): ScoringConfig {
    return activeConfig;
}

/**
 * Get confidence threshold for a specific rarity
 */
export function getThresholdForRarity(rarity?: string): number {
    const config = activeConfig;
    const base = config.baseThreshold;

    if (!rarity) {
        return base + config.rarityThresholds.unknown;
    }

    const key = rarity.toLowerCase() as keyof RarityThresholds;
    const adjustment = config.rarityThresholds[key] ?? config.rarityThresholds.unknown;

    return Math.max(config.minConfidence, base + adjustment);
}

/**
 * Calculate weighted similarity score
 */
export function calculateWeightedScore(
    ncc: number,
    ssim: number,
    histogram: number,
    edge: number
): number {
    const config = activeConfig;
    const w = config.weights;

    // Calculate base weighted score
    let score = ncc * w.ncc + ssim * w.ssim + histogram * w.histogram + edge * w.edge;

    // Apply agreement bonus
    if (config.agreement.enabled) {
        const scores = [ncc, ssim, histogram, edge];
        const weights = [w.ncc, w.ssim, w.histogram, w.edge];

        // Only count metrics that are enabled (weight > 0)
        const enabledScores = scores.filter((_, i) => weights[i] > 0);
        const aboveThreshold = enabledScores.filter(s => s >= config.agreement.threshold).length;

        if (aboveThreshold >= config.agreement.minMetricsForBonus) {
            const bonus = Math.min(
                (aboveThreshold - config.agreement.minMetricsForBonus + 1) * config.agreement.bonusPerMetric,
                config.agreement.maxBonus
            );
            score += bonus;
        }
    }

    // Clamp to valid range
    return Math.max(config.minConfidence, Math.min(config.maxConfidence, score));
}

/**
 * Check if score passes threshold for rarity
 */
export function passesThreshold(score: number, rarity?: string): boolean {
    return score >= getThresholdForRarity(rarity);
}

/**
 * Get grade for a confidence score (for UI display)
 */
export function getConfidenceGrade(score: number): {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    label: string;
    color: string;
} {
    if (score >= 0.85) {
        return { grade: 'A', label: 'Excellent', color: '#4CAF50' };
    } else if (score >= 0.70) {
        return { grade: 'B', label: 'Good', color: '#8BC34A' };
    } else if (score >= 0.55) {
        return { grade: 'C', label: 'Fair', color: '#FFC107' };
    } else if (score >= 0.40) {
        return { grade: 'D', label: 'Poor', color: '#FF9800' };
    } else {
        return { grade: 'F', label: 'Fail', color: '#F44336' };
    }
}

/**
 * Describe scoring configuration for debugging
 */
export function describeScoringConfig(): string {
    const config = activeConfig;
    const w = config.weights;

    return `Weights: SSIM=${w.ssim}, NCC=${w.ncc}, Hist=${w.histogram}, Edge=${w.edge}\n` +
        `Agreement: ${config.agreement.enabled ? 'ON' : 'OFF'} (threshold=${config.agreement.threshold})\n` +
        `Base threshold: ${config.baseThreshold}\n` +
        `Rarity adjustments: Common=${config.rarityThresholds.common}, Legendary=${config.rarityThresholds.legendary}`;
}

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(partial: Partial<ScoringConfig>): ScoringConfig {
    return {
        weights: { ...DEFAULT_SCORING_CONFIG.weights, ...partial.weights },
        agreement: { ...DEFAULT_SCORING_CONFIG.agreement, ...partial.agreement },
        baseThreshold: partial.baseThreshold ?? DEFAULT_SCORING_CONFIG.baseThreshold,
        rarityThresholds: { ...DEFAULT_SCORING_CONFIG.rarityThresholds, ...partial.rarityThresholds },
        minConfidence: partial.minConfidence ?? DEFAULT_SCORING_CONFIG.minConfidence,
        maxConfidence: partial.maxConfidence ?? DEFAULT_SCORING_CONFIG.maxConfidence,
    };
}
