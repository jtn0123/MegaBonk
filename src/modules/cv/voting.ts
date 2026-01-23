// ========================================
// Weighted Voting Module for CV Detection
// ========================================
// Combines scores from multiple templates using ensemble voting
// Improves accuracy by reducing false positives from individual matches

import { getScoringConfig, passesThreshold } from './scoring-config.ts';
import { getTemplateRanking } from './template-ranking.ts';

/**
 * A single vote from a template match
 */
export interface TemplateVote {
    /** Template identifier */
    templateId: string;
    /** Item ID this template represents */
    itemId: string;
    /** Confidence score from matching */
    confidence: number;
    /** Item rarity for threshold adjustment */
    rarity?: string;
    /** Individual metric scores */
    metrics?: {
        ncc: number;
        ssim: number;
        histogram: number;
        edge: number;
    };
}

/**
 * Result from voting aggregation
 */
export interface VotingResult {
    /** Winning item ID */
    itemId: string;
    /** Final aggregated confidence */
    confidence: number;
    /** Number of templates that voted for this item */
    voteCount: number;
    /** Total votes cast */
    totalVotes: number;
    /** Whether this result passes the threshold */
    passesThreshold: boolean;
    /** Voting breakdown by item */
    votingBreakdown: Map<string, VoteAggregate>;
    /** Confidence in the winning item (ratio of votes) */
    consensus: number;
}

/**
 * Aggregate statistics for votes for a single item
 */
export interface VoteAggregate {
    itemId: string;
    voteCount: number;
    totalWeight: number;
    avgConfidence: number;
    maxConfidence: number;
    weightedConfidence: number;
}

/**
 * Voting configuration
 */
export interface VotingConfig {
    /** Minimum votes required for a valid result */
    minVotes: number;
    /** Minimum consensus ratio (votes for winner / total votes) */
    minConsensus: number;
    /** Weight boost for templates with good historical performance */
    usePerformanceWeighting: boolean;
    /** Weight for template ranking (0 = ignore, 1 = full weight) */
    performanceWeight: number;
    /** Voting method */
    method: 'weighted-average' | 'max' | 'median' | 'ranked-choice';
    /** Penalty for templates with multiple item matches (confusion) */
    confusionPenalty: number;
}

/**
 * Default voting configuration
 */
export const DEFAULT_VOTING_CONFIG: VotingConfig = {
    minVotes: 1,
    minConsensus: 0.5,
    usePerformanceWeighting: true,
    performanceWeight: 0.3,
    method: 'weighted-average',
    confusionPenalty: 0.1,
};

/**
 * Strict voting configuration - requires higher consensus
 */
export const STRICT_VOTING_CONFIG: VotingConfig = {
    minVotes: 2,
    minConsensus: 0.7,
    usePerformanceWeighting: true,
    performanceWeight: 0.4,
    method: 'weighted-average',
    confusionPenalty: 0.15,
};

/**
 * Lenient voting configuration - accepts more results
 */
export const LENIENT_VOTING_CONFIG: VotingConfig = {
    minVotes: 1,
    minConsensus: 0.3,
    usePerformanceWeighting: true,
    performanceWeight: 0.2,
    method: 'max',
    confusionPenalty: 0.05,
};

// Active configuration
let activeConfig = DEFAULT_VOTING_CONFIG;

/**
 * Set voting configuration
 */
export function setVotingConfig(config: VotingConfig): void {
    activeConfig = config;
}

/**
 * Get current voting configuration
 */
export function getVotingConfig(): VotingConfig {
    return activeConfig;
}

/**
 * Calculate template weight based on historical performance
 */
function getTemplateWeight(templateId: string, config: VotingConfig): number {
    if (!config.usePerformanceWeighting) {
        return 1.0;
    }

    const ranking = getTemplateRanking(templateId);
    if (!ranking) {
        return 1.0; // No history, use default weight
    }

    // Base weight from success rate
    let weight = 0.5 + ranking.successRate * 0.5; // Range: 0.5 to 1.0

    // Boost for templates with more data (more reliable)
    const dataBonus = Math.min(ranking.matchCount / 100, 0.2); // Up to 0.2 bonus
    weight += dataBonus;

    // Apply confusion penalty
    if (ranking.confusionRate > 0) {
        weight -= ranking.confusionRate * config.confusionPenalty;
    }

    return Math.max(0.1, Math.min(1.5, weight)); // Clamp to reasonable range
}

/**
 * Aggregate votes for each item
 */
function aggregateVotes(votes: TemplateVote[], config: VotingConfig): Map<string, VoteAggregate> {
    const aggregates = new Map<string, VoteAggregate>();

    for (const vote of votes) {
        const existing = aggregates.get(vote.itemId);
        const templateWeight = getTemplateWeight(vote.templateId, config);
        const weightedScore = vote.confidence * templateWeight;

        if (existing) {
            existing.voteCount++;
            existing.totalWeight += templateWeight;
            existing.avgConfidence = (existing.avgConfidence * (existing.voteCount - 1) + vote.confidence) / existing.voteCount;
            existing.maxConfidence = Math.max(existing.maxConfidence, vote.confidence);
            existing.weightedConfidence += weightedScore;
        } else {
            aggregates.set(vote.itemId, {
                itemId: vote.itemId,
                voteCount: 1,
                totalWeight: templateWeight,
                avgConfidence: vote.confidence,
                maxConfidence: vote.confidence,
                weightedConfidence: weightedScore,
            });
        }
    }

    // Normalize weighted confidence by total weight
    for (const agg of aggregates.values()) {
        if (agg.totalWeight > 0) {
            agg.weightedConfidence /= agg.totalWeight;
        }
    }

    return aggregates;
}

/**
 * Calculate final confidence using the configured method
 */
function calculateFinalConfidence(aggregate: VoteAggregate, votes: TemplateVote[], config: VotingConfig): number {
    switch (config.method) {
        case 'max':
            return aggregate.maxConfidence;

        case 'median': {
            const itemVotes = votes
                .filter(v => v.itemId === aggregate.itemId)
                .map(v => v.confidence)
                .sort((a, b) => a - b);
            const mid = Math.floor(itemVotes.length / 2);
            return itemVotes.length % 2 === 0
                ? ((itemVotes[mid - 1] ?? 0) + (itemVotes[mid] ?? 0)) / 2
                : (itemVotes[mid] ?? 0);
        }

        case 'ranked-choice': {
            // Weight by vote rank (first choice counts more)
            const itemVotes = votes
                .filter(v => v.itemId === aggregate.itemId)
                .map(v => v.confidence)
                .sort((a, b) => b - a);
            let total = 0;
            let weightSum = 0;
            for (let i = 0; i < itemVotes.length; i++) {
                const rankWeight = 1 / (i + 1); // 1, 0.5, 0.33, ...
                total += (itemVotes[i] ?? 0) * rankWeight;
                weightSum += rankWeight;
            }
            return weightSum > 0 ? total / weightSum : 0;
        }

        case 'weighted-average':
        default:
            return aggregate.weightedConfidence;
    }
}

/**
 * Combine votes from multiple template matches using weighted voting
 */
export function combineVotes(votes: TemplateVote[], config?: Partial<VotingConfig>): VotingResult | null {
    const effectiveConfig = { ...activeConfig, ...config };

    if (votes.length === 0) {
        return null;
    }

    // Aggregate votes by item
    const aggregates = aggregateVotes(votes, effectiveConfig);

    if (aggregates.size === 0) {
        return null;
    }

    // Find the winner
    let winner: VoteAggregate | null = null;
    let maxScore = -1;

    for (const agg of aggregates.values()) {
        const score = calculateFinalConfidence(agg, votes, effectiveConfig);
        if (score > maxScore) {
            maxScore = score;
            winner = agg;
        }
    }

    if (!winner) {
        return null;
    }

    // Calculate consensus
    const totalVotes = votes.length;
    const consensus = winner.voteCount / totalVotes;

    // Check minimum requirements
    if (winner.voteCount < effectiveConfig.minVotes) {
        return null;
    }

    if (consensus < effectiveConfig.minConsensus) {
        // Low consensus - might be ambiguous
        // Still return result but with lower confidence
        maxScore *= consensus; // Penalize ambiguous results
    }

    // Get rarity from first vote for threshold check
    const rarity = votes.find(v => v.itemId === winner!.itemId)?.rarity;

    return {
        itemId: winner.itemId,
        confidence: Math.min(0.99, maxScore),
        voteCount: winner.voteCount,
        totalVotes,
        passesThreshold: passesThreshold(maxScore, rarity),
        votingBreakdown: aggregates,
        consensus,
    };
}

/**
 * Simple majority voting - returns item with most votes
 */
export function majorityVote(votes: TemplateVote[]): { itemId: string; voteCount: number; confidence: number } | null {
    if (votes.length === 0) {
        return null;
    }

    const counts = new Map<string, { count: number; maxConf: number }>();

    for (const vote of votes) {
        const existing = counts.get(vote.itemId);
        if (existing) {
            existing.count++;
            existing.maxConf = Math.max(existing.maxConf, vote.confidence);
        } else {
            counts.set(vote.itemId, { count: 1, maxConf: vote.confidence });
        }
    }

    let winner: string | null = null;
    let maxCount = 0;
    let winnerConf = 0;

    for (const [itemId, data] of counts) {
        if (data.count > maxCount) {
            maxCount = data.count;
            winner = itemId;
            winnerConf = data.maxConf;
        }
    }

    return winner ? { itemId: winner, voteCount: maxCount, confidence: winnerConf } : null;
}

/**
 * Weighted voting with confidence threshold filtering
 * Only considers votes that pass the threshold
 */
export function thresholdVote(votes: TemplateVote[], rarity?: string): VotingResult | null {
    const scoringConfig = getScoringConfig();

    // Filter votes that pass threshold
    const passingVotes = votes.filter(vote =>
        passesThreshold(vote.confidence, vote.rarity ?? rarity)
    );

    if (passingVotes.length === 0) {
        return null;
    }

    return combineVotes(passingVotes);
}

/**
 * Ensemble voting - combines results from multiple detection strategies
 */
export function ensembleVote(
    strategyResults: Array<{ strategy: string; votes: TemplateVote[]; weight: number }>
): VotingResult | null {
    // Flatten all votes with strategy weights applied
    const allVotes: TemplateVote[] = [];

    for (const { votes, weight } of strategyResults) {
        for (const vote of votes) {
            allVotes.push({
                ...vote,
                confidence: vote.confidence * weight, // Apply strategy weight
            });
        }
    }

    return combineVotes(allVotes);
}

/**
 * Get voting statistics for debugging
 */
export function describeVotingResult(result: VotingResult): string {
    const lines: string[] = [
        `Winner: ${result.itemId} (${(result.confidence * 100).toFixed(1)}%)`,
        `Votes: ${result.voteCount}/${result.totalVotes} (${(result.consensus * 100).toFixed(0)}% consensus)`,
        `Passes threshold: ${result.passesThreshold ? 'Yes' : 'No'}`,
        '',
        'Breakdown:',
    ];

    for (const [itemId, agg] of result.votingBreakdown) {
        lines.push(
            `  ${itemId}: ${agg.voteCount} votes, avg=${(agg.avgConfidence * 100).toFixed(1)}%, max=${(agg.maxConfidence * 100).toFixed(1)}%`
        );
    }

    return lines.join('\n');
}
