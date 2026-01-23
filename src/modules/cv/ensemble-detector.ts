// ========================================
// Ensemble Detector Module
// ========================================
// Combines multiple detection strategies for improved accuracy
// Uses voting and confidence aggregation

import { getProfileForResolution, type StrategyProfile } from './resolution-profiles.ts';
import { getScoringConfig, passesThreshold } from './scoring-config.ts';
import { combineVotes, type TemplateVote, type VotingResult } from './voting.ts';
import { shouldSkipTemplate, recordMatchResult } from './template-ranking.ts';

/**
 * Detection strategy identifier
 */
export type StrategyId =
    | 'default'
    | 'high-precision'
    | 'high-recall'
    | 'edge-focused'
    | 'color-focused'
    | 'fast';

/**
 * Strategy configuration
 */
export interface DetectionStrategy {
    id: StrategyId;
    name: string;
    description: string;
    /** Weight for this strategy in ensemble voting (0-1) */
    weight: number;
    /** Minimum confidence threshold override */
    minConfidence?: number;
    /** Preprocessing options */
    preprocessing: {
        contrastEnhance: boolean;
        contrastFactor: number;
        colorNormalize: boolean;
        edgeEnhance: boolean;
    };
    /** Metric weights override */
    metricWeights?: {
        ncc: number;
        ssim: number;
        histogram: number;
        edge: number;
    };
    /** Template selection options */
    templates: {
        useRanking: boolean;
        skipPoorPerformers: boolean;
        maxTemplatesPerItem: number;
    };
}

/**
 * Single detection from a strategy
 */
export interface StrategyDetection {
    /** Strategy that produced this detection */
    strategyId: StrategyId;
    /** Detected item ID */
    itemId: string;
    /** Confidence score */
    confidence: number;
    /** Cell position */
    position: { x: number; y: number; width: number; height: number };
    /** Template used */
    templateId: string;
    /** Individual metrics (if available) */
    metrics?: {
        ncc: number;
        ssim: number;
        histogram: number;
        edge: number;
    };
}

/**
 * Ensemble detection result
 */
export interface EnsembleResult {
    /** Winning item ID */
    itemId: string;
    /** Combined confidence */
    confidence: number;
    /** Position */
    position: { x: number; y: number; width: number; height: number };
    /** Strategy that had the best match */
    bestStrategy: StrategyId;
    /** All strategy detections for this cell */
    strategyResults: StrategyDetection[];
    /** Agreement level (0-1) */
    agreement: number;
    /** Whether result passes threshold */
    passesThreshold: boolean;
    /** Item count (if detected) */
    count?: number;
}

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
    /** Strategies to use */
    strategies: StrategyId[];
    /** Minimum strategies that must agree */
    minAgreement: number;
    /** How to combine results */
    combineMethod: 'voting' | 'max' | 'average' | 'weighted';
    /** Early exit if first strategy is confident enough */
    earlyExitThreshold: number;
    /** Run strategies in parallel or sequential */
    parallel: boolean;
}

// ========================================
// Strategy Definitions
// ========================================

/**
 * Default balanced strategy
 */
export const DEFAULT_STRATEGY: DetectionStrategy = {
    id: 'default',
    name: 'Balanced',
    description: 'Balanced precision/recall with standard preprocessing',
    weight: 1.0,
    preprocessing: {
        contrastEnhance: true,
        contrastFactor: 1.5,
        colorNormalize: true,
        edgeEnhance: false,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: true,
        maxTemplatesPerItem: 5,
    },
};

/**
 * High precision strategy - fewer false positives
 */
export const HIGH_PRECISION_STRATEGY: DetectionStrategy = {
    id: 'high-precision',
    name: 'High Precision',
    description: 'Stricter matching to reduce false positives',
    weight: 0.9,
    minConfidence: 0.55,
    preprocessing: {
        contrastEnhance: true,
        contrastFactor: 1.3,
        colorNormalize: true,
        edgeEnhance: false,
    },
    metricWeights: {
        ssim: 0.45,
        ncc: 0.20,
        histogram: 0.20,
        edge: 0.15,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: true,
        maxTemplatesPerItem: 3,
    },
};

/**
 * High recall strategy - fewer misses
 */
export const HIGH_RECALL_STRATEGY: DetectionStrategy = {
    id: 'high-recall',
    name: 'High Recall',
    description: 'Lenient matching to catch more items',
    weight: 0.8,
    minConfidence: 0.35,
    preprocessing: {
        contrastEnhance: true,
        contrastFactor: 1.8,
        colorNormalize: true,
        edgeEnhance: false,
    },
    metricWeights: {
        ssim: 0.30,
        ncc: 0.30,
        histogram: 0.25,
        edge: 0.15,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: false,
        maxTemplatesPerItem: 8,
    },
};

/**
 * Edge-focused strategy - good for blurry/compressed images
 */
export const EDGE_FOCUSED_STRATEGY: DetectionStrategy = {
    id: 'edge-focused',
    name: 'Edge Focused',
    description: 'Emphasizes edge structure over color',
    weight: 0.85,
    preprocessing: {
        contrastEnhance: true,
        contrastFactor: 1.4,
        colorNormalize: false,
        edgeEnhance: true,
    },
    metricWeights: {
        ssim: 0.25,
        ncc: 0.15,
        histogram: 0.15,
        edge: 0.45,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: true,
        maxTemplatesPerItem: 5,
    },
};

/**
 * Color-focused strategy - good for distinguishing similar items
 */
export const COLOR_FOCUSED_STRATEGY: DetectionStrategy = {
    id: 'color-focused',
    name: 'Color Focused',
    description: 'Emphasizes color matching for similar-shaped items',
    weight: 0.85,
    preprocessing: {
        contrastEnhance: false,
        contrastFactor: 1.0,
        colorNormalize: false,
        edgeEnhance: false,
    },
    metricWeights: {
        ssim: 0.20,
        ncc: 0.20,
        histogram: 0.45,
        edge: 0.15,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: true,
        maxTemplatesPerItem: 5,
    },
};

/**
 * Fast strategy - for quick scanning
 */
export const FAST_STRATEGY: DetectionStrategy = {
    id: 'fast',
    name: 'Fast',
    description: 'Quick detection with minimal processing',
    weight: 0.7,
    minConfidence: 0.50,
    preprocessing: {
        contrastEnhance: false,
        contrastFactor: 1.0,
        colorNormalize: false,
        edgeEnhance: false,
    },
    metricWeights: {
        ssim: 0.50,
        ncc: 0.50,
        histogram: 0.0,
        edge: 0.0,
    },
    templates: {
        useRanking: true,
        skipPoorPerformers: true,
        maxTemplatesPerItem: 2,
    },
};

/**
 * All strategies indexed by ID
 */
export const STRATEGIES: Record<StrategyId, DetectionStrategy> = {
    default: DEFAULT_STRATEGY,
    'high-precision': HIGH_PRECISION_STRATEGY,
    'high-recall': HIGH_RECALL_STRATEGY,
    'edge-focused': EDGE_FOCUSED_STRATEGY,
    'color-focused': COLOR_FOCUSED_STRATEGY,
    fast: FAST_STRATEGY,
};

/**
 * Default ensemble configuration
 */
export const DEFAULT_ENSEMBLE_CONFIG: EnsembleConfig = {
    strategies: ['default', 'high-precision', 'edge-focused'],
    minAgreement: 2,
    combineMethod: 'voting',
    earlyExitThreshold: 0.90,
    parallel: true,
};

/**
 * Precision-focused ensemble
 */
export const PRECISION_ENSEMBLE_CONFIG: EnsembleConfig = {
    strategies: ['high-precision', 'default', 'edge-focused'],
    minAgreement: 2,
    combineMethod: 'voting',
    earlyExitThreshold: 0.95,
    parallel: true,
};

/**
 * Recall-focused ensemble
 */
export const RECALL_ENSEMBLE_CONFIG: EnsembleConfig = {
    strategies: ['high-recall', 'default', 'color-focused'],
    minAgreement: 1,
    combineMethod: 'max',
    earlyExitThreshold: 0.85,
    parallel: true,
};

/**
 * Fast ensemble for quick scanning
 */
export const FAST_ENSEMBLE_CONFIG: EnsembleConfig = {
    strategies: ['fast'],
    minAgreement: 1,
    combineMethod: 'max',
    earlyExitThreshold: 0.80,
    parallel: false,
};

// Active configuration
let activeConfig = DEFAULT_ENSEMBLE_CONFIG;

/**
 * Set ensemble configuration
 */
export function setEnsembleConfig(config: EnsembleConfig): void {
    activeConfig = config;
}

/**
 * Get current ensemble configuration
 */
export function getEnsembleConfig(): EnsembleConfig {
    return activeConfig;
}

/**
 * Get strategy by ID
 */
export function getStrategy(id: StrategyId): DetectionStrategy {
    return STRATEGIES[id];
}

/**
 * Combine strategy detections into ensemble result
 */
export function combineStrategyDetections(
    detections: StrategyDetection[],
    position: { x: number; y: number; width: number; height: number },
    config: EnsembleConfig = activeConfig
): EnsembleResult | null {
    if (detections.length === 0) {
        return null;
    }

    // Group by item ID
    const byItem = new Map<string, StrategyDetection[]>();
    for (const det of detections) {
        const existing = byItem.get(det.itemId) ?? [];
        existing.push(det);
        byItem.set(det.itemId, existing);
    }

    // Find winning item based on combine method
    let winnerItemId: string | null = null;
    let winnerConfidence = 0;
    let winnerDetections: StrategyDetection[] = [];

    switch (config.combineMethod) {
        case 'voting': {
            // Use voting module
            const votes: TemplateVote[] = detections.map(d => ({
                templateId: d.templateId,
                itemId: d.itemId,
                confidence: d.confidence * STRATEGIES[d.strategyId].weight,
            }));
            const result = combineVotes(votes);
            if (result) {
                winnerItemId = result.itemId;
                winnerConfidence = result.confidence;
                winnerDetections = byItem.get(result.itemId) ?? [];
            }
            break;
        }

        case 'max': {
            // Pick item with highest single confidence
            for (const [itemId, dets] of byItem) {
                const maxConf = Math.max(...dets.map(d => d.confidence));
                if (maxConf > winnerConfidence) {
                    winnerConfidence = maxConf;
                    winnerItemId = itemId;
                    winnerDetections = dets;
                }
            }
            break;
        }

        case 'average': {
            // Pick item with highest average confidence
            for (const [itemId, dets] of byItem) {
                const avgConf = dets.reduce((sum, d) => sum + d.confidence, 0) / dets.length;
                if (avgConf > winnerConfidence) {
                    winnerConfidence = avgConf;
                    winnerItemId = itemId;
                    winnerDetections = dets;
                }
            }
            break;
        }

        case 'weighted': {
            // Weight by strategy weight
            for (const [itemId, dets] of byItem) {
                let totalWeight = 0;
                let weightedSum = 0;
                for (const d of dets) {
                    const weight = STRATEGIES[d.strategyId].weight;
                    weightedSum += d.confidence * weight;
                    totalWeight += weight;
                }
                const weightedConf = weightedSum / totalWeight;
                if (weightedConf > winnerConfidence) {
                    winnerConfidence = weightedConf;
                    winnerItemId = itemId;
                    winnerDetections = dets;
                }
            }
            break;
        }
    }

    if (!winnerItemId) {
        return null;
    }

    // Check minimum agreement
    const agreement = winnerDetections.length / detections.length;
    if (winnerDetections.length < config.minAgreement) {
        // Not enough agreement, reduce confidence
        winnerConfidence *= agreement;
    }

    // Find best strategy
    const bestDet = winnerDetections.reduce((best, d) =>
        d.confidence > best.confidence ? d : best
    );

    return {
        itemId: winnerItemId,
        confidence: Math.min(0.99, winnerConfidence),
        position,
        bestStrategy: bestDet.strategyId,
        strategyResults: detections,
        agreement,
        passesThreshold: passesThreshold(winnerConfidence),
    };
}

/**
 * Select optimal strategies for given image conditions
 */
export function selectStrategiesForImage(
    width: number,
    height: number,
    sceneType?: 'bright' | 'dark' | 'normal' | 'noisy'
): StrategyId[] {
    const profile = getProfileForResolution(width, height);
    const strategies: StrategyId[] = ['default'];

    // Add precision for high-res images
    if (profile.tier === 'high' || profile.tier === 'ultra') {
        strategies.push('high-precision');
    }

    // Add recall for low-res images (harder to match)
    if (profile.tier === 'low') {
        strategies.push('high-recall');
    }

    // Scene-specific strategies
    switch (sceneType) {
        case 'dark':
            strategies.push('edge-focused');
            break;
        case 'bright':
            strategies.push('color-focused');
            break;
        case 'noisy':
            strategies.push('edge-focused');
            break;
    }

    // Limit to 3 strategies for performance
    return strategies.slice(0, 3);
}

/**
 * Describe ensemble configuration for debugging
 */
export function describeEnsembleConfig(config: EnsembleConfig = activeConfig): string {
    const lines: string[] = [
        `Ensemble Configuration:`,
        `  Strategies: ${config.strategies.join(', ')}`,
        `  Min Agreement: ${config.minAgreement}`,
        `  Combine Method: ${config.combineMethod}`,
        `  Early Exit: ${(config.earlyExitThreshold * 100).toFixed(0)}%`,
        `  Parallel: ${config.parallel}`,
        '',
        'Strategy Details:',
    ];

    for (const id of config.strategies) {
        const s = STRATEGIES[id];
        lines.push(`  ${s.name} (weight=${s.weight}): ${s.description}`);
    }

    return lines.join('\n');
}

/**
 * Get recommended ensemble config based on use case
 */
export function getRecommendedConfig(
    useCase: 'scanning' | 'verification' | 'training' | 'fast'
): EnsembleConfig {
    switch (useCase) {
        case 'scanning':
            return DEFAULT_ENSEMBLE_CONFIG;
        case 'verification':
            return PRECISION_ENSEMBLE_CONFIG;
        case 'training':
            return RECALL_ENSEMBLE_CONFIG;
        case 'fast':
            return FAST_ENSEMBLE_CONFIG;
    }
}
