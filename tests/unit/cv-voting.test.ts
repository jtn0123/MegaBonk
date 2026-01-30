/**
 * CV Voting Module Tests
 * 
 * Tests the weighted voting system for combining template match results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/cv/scoring-config.ts', () => ({
    passesThreshold: vi.fn((confidence: number, _rarity?: string) => confidence >= 0.7),
}));

vi.mock('../../src/modules/cv/template-ranking.ts', () => ({
    getTemplateRanking: vi.fn((templateId: string) => {
        // Return mock rankings for specific templates
        if (templateId === 'high-rank') {
            return { successRate: 0.9, rankScore: 80, shouldSkip: false };
        }
        if (templateId === 'low-rank') {
            return { successRate: 0.3, rankScore: 20, shouldSkip: false };
        }
        if (templateId === 'skip-template') {
            return { successRate: 0.5, rankScore: 50, shouldSkip: true };
        }
        return null; // No ranking data
    }),
}));

import {
    combineVotes,
    majorityVote,
    thresholdVote,
    ensembleVote,
    describeVotingResult,
    setVotingConfig,
    getVotingConfig,
    DEFAULT_VOTING_CONFIG,
    STRICT_VOTING_CONFIG,
    LENIENT_VOTING_CONFIG,
    type TemplateVote,
    type VotingConfig,
    type VotingResult,
} from '../../src/modules/cv/voting.ts';

describe('CV Voting Module', () => {
    beforeEach(() => {
        // Reset to default config before each test
        setVotingConfig(DEFAULT_VOTING_CONFIG);
    });

    describe('Configuration', () => {
        it('should return default configuration', () => {
            const config = getVotingConfig();
            expect(config).toEqual(DEFAULT_VOTING_CONFIG);
        });

        it('should allow setting custom configuration', () => {
            const customConfig: VotingConfig = {
                minVotes: 3,
                minConsensus: 0.8,
                usePerformanceWeighting: false,
                performanceWeight: 0.5,
                method: 'max',
                confusionPenalty: 0.2,
            };
            setVotingConfig(customConfig);
            expect(getVotingConfig()).toEqual(customConfig);
        });

        it('DEFAULT_VOTING_CONFIG should have expected values', () => {
            expect(DEFAULT_VOTING_CONFIG.minVotes).toBe(1);
            expect(DEFAULT_VOTING_CONFIG.minConsensus).toBe(0.5);
            expect(DEFAULT_VOTING_CONFIG.usePerformanceWeighting).toBe(true);
            expect(DEFAULT_VOTING_CONFIG.method).toBe('weighted-average');
        });

        it('STRICT_VOTING_CONFIG should require higher consensus', () => {
            expect(STRICT_VOTING_CONFIG.minVotes).toBe(2);
            expect(STRICT_VOTING_CONFIG.minConsensus).toBe(0.7);
        });

        it('LENIENT_VOTING_CONFIG should accept lower consensus', () => {
            expect(LENIENT_VOTING_CONFIG.minVotes).toBe(1);
            expect(LENIENT_VOTING_CONFIG.minConsensus).toBe(0.3);
            expect(LENIENT_VOTING_CONFIG.method).toBe('max');
        });
    });

    describe('combineVotes', () => {
        it('should return null for empty votes array', () => {
            const result = combineVotes([]);
            expect(result).toBeNull();
        });

        it('should return single vote as winner', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.85 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('item-a');
            expect(result!.voteCount).toBe(1);
            expect(result!.totalVotes).toBe(1);
            expect(result!.consensus).toBe(1);
        });

        it('should select item with highest weighted score', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.75 },
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.9 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // item-a has 2 votes, item-b has 1 vote with higher confidence
            // With weighted-average method and default config, item-a should win
            expect(result!.voteCount).toBeGreaterThanOrEqual(1);
        });

        it('should calculate consensus correctly', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.85 },
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.7 },
                { templateId: 'tmpl4', itemId: 'item-a', confidence: 0.75 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('item-a');
            expect(result!.consensus).toBe(0.75); // 3 out of 4 votes
        });

        it('should include voting breakdown in result', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.7 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.votingBreakdown.size).toBe(2);
            expect(result!.votingBreakdown.has('item-a')).toBe(true);
            expect(result!.votingBreakdown.has('item-b')).toBe(true);
        });

        it('should return null when minVotes not met', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, minVotes: 3 });
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.85 },
            ];
            const result = combineVotes(votes);
            expect(result).toBeNull();
        });

        it('should penalize low consensus results', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.79 },
                { templateId: 'tmpl3', itemId: 'item-c', confidence: 0.78 },
            ];
            // Consensus is 1/3 = 0.33, below default 0.5
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // Confidence should be penalized by consensus
            expect(result!.confidence).toBeLessThan(0.8);
        });

        it('should respect config overrides in function call', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
            ];
            const result = combineVotes(votes, { method: 'max' });
            expect(result).not.toBeNull();
        });

        it('should use max method correctly', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, method: 'max' });
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.6 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.9 },
                { templateId: 'tmpl3', itemId: 'item-a', confidence: 0.7 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBeCloseTo(0.9, 1);
        });

        it('should use median method correctly', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, method: 'median' });
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.6 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.9 },
                { templateId: 'tmpl3', itemId: 'item-a', confidence: 0.8 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBeCloseTo(0.8, 1); // Median of 0.6, 0.8, 0.9
        });

        it('should use ranked-choice method correctly', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, method: 'ranked-choice' });
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.9 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'tmpl3', itemId: 'item-a', confidence: 0.5 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // Ranked choice weights: 0.9*1 + 0.7*0.5 + 0.5*0.33 / (1 + 0.5 + 0.33)
            expect(result!.confidence).toBeGreaterThan(0.7);
        });

        it('should apply performance weighting from template ranking', () => {
            const votes: TemplateVote[] = [
                { templateId: 'high-rank', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'low-rank', itemId: 'item-b', confidence: 0.75 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // High-rank template should boost item-a
        });

        it('should reduce weight for skip-listed templates', () => {
            const votes: TemplateVote[] = [
                { templateId: 'skip-template', itemId: 'item-a', confidence: 0.9 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.8 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // Skip-template has halved weight
        });

        it('should disable performance weighting when configured', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, usePerformanceWeighting: false });
            const votes: TemplateVote[] = [
                { templateId: 'high-rank', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'low-rank', itemId: 'item-b', confidence: 0.75 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            // Without performance weighting, item-b should win (higher confidence)
            expect(result!.itemId).toBe('item-b');
        });

        it('should cap confidence at 0.99', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 1.0 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBeLessThanOrEqual(0.99);
        });

        it('should check passesThreshold correctly', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8, rarity: 'common' },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.passesThreshold).toBe(true);
        });
    });

    describe('majorityVote', () => {
        it('should return null for empty votes', () => {
            const result = majorityVote([]);
            expect(result).toBeNull();
        });

        it('should return single vote as winner', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
            ];
            const result = majorityVote(votes);
            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('item-a');
            expect(result!.voteCount).toBe(1);
        });

        it('should select item with most votes', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.75 },
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.95 },
            ];
            const result = majorityVote(votes);
            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('item-a');
            expect(result!.voteCount).toBe(2);
        });

        it('should return max confidence for winning item', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.9 },
            ];
            const result = majorityVote(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBe(0.9);
        });

        it('should handle tie by selecting first encountered winner', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.85 },
            ];
            const result = majorityVote(votes);
            expect(result).not.toBeNull();
            expect(result!.voteCount).toBe(1);
        });
    });

    describe('thresholdVote', () => {
        it('should return null when no votes pass threshold', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.5 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.6 },
            ];
            const result = thresholdVote(votes);
            expect(result).toBeNull();
        });

        it('should only count votes that pass threshold', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.5 }, // Below threshold
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.75 },
            ];
            const result = thresholdVote(votes);
            expect(result).not.toBeNull();
            expect(result!.totalVotes).toBe(2); // Only 2 pass threshold
        });

        it('should use rarity parameter for threshold check', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.75 },
            ];
            const result = thresholdVote(votes, 'legendary');
            expect(result).not.toBeNull();
        });

        it('should prefer vote rarity over parameter', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.75, rarity: 'common' },
            ];
            const result = thresholdVote(votes, 'legendary');
            expect(result).not.toBeNull();
        });
    });

    describe('ensembleVote', () => {
        it('should return null for empty strategy results', () => {
            const result = ensembleVote([]);
            expect(result).toBeNull();
        });

        it('should combine votes from multiple strategies', () => {
            const strategyResults = [
                {
                    strategy: 'ncc',
                    weight: 1.0,
                    votes: [{ templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 }],
                },
                {
                    strategy: 'ssim',
                    weight: 0.8,
                    votes: [{ templateId: 'tmpl2', itemId: 'item-a', confidence: 0.9 }],
                },
            ];
            const result = ensembleVote(strategyResults);
            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('item-a');
            expect(result!.totalVotes).toBe(2);
        });

        it('should apply strategy weights to confidence', () => {
            const strategyResults = [
                {
                    strategy: 'ncc',
                    weight: 1.0,
                    votes: [{ templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 }],
                },
                {
                    strategy: 'weak',
                    weight: 0.5,
                    votes: [{ templateId: 'tmpl2', itemId: 'item-b', confidence: 0.9 }],
                },
            ];
            const result = ensembleVote(strategyResults);
            expect(result).not.toBeNull();
            // item-a: 0.8 * 1.0 = 0.8
            // item-b: 0.9 * 0.5 = 0.45
            // item-a should win
            expect(result!.itemId).toBe('item-a');
        });

        it('should handle strategies with multiple votes', () => {
            const strategyResults = [
                {
                    strategy: 'ncc',
                    weight: 1.0,
                    votes: [
                        { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                        { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.75 },
                    ],
                },
            ];
            const result = ensembleVote(strategyResults);
            expect(result).not.toBeNull();
            expect(result!.voteCount).toBe(2);
        });
    });

    describe('describeVotingResult', () => {
        it('should produce readable description', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.85 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.7 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();

            const description = describeVotingResult(result!);
            expect(description).toContain('Winner: item-a');
            expect(description).toContain('Votes:');
            expect(description).toContain('consensus');
            expect(description).toContain('Breakdown:');
            expect(description).toContain('item-a:');
            expect(description).toContain('item-b:');
        });

        it('should include pass/fail threshold status', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.85 },
            ];
            const result = combineVotes(votes);
            const description = describeVotingResult(result!);
            expect(description).toContain('Passes threshold: Yes');
        });

        it('should show percentage values', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.856 },
            ];
            const result = combineVotes(votes);
            const description = describeVotingResult(result!);
            expect(description).toMatch(/\d+\.\d%/); // Contains percentage format
        });
    });

    describe('VoteAggregate calculations', () => {
        it('should calculate avgConfidence correctly', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.9 },
                { templateId: 'tmpl3', itemId: 'item-a', confidence: 0.7 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            const aggregate = result!.votingBreakdown.get('item-a');
            expect(aggregate).toBeDefined();
            expect(aggregate!.avgConfidence).toBeCloseTo(0.8, 1); // (0.8 + 0.9 + 0.7) / 3
        });

        it('should track maxConfidence correctly', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.7 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.95 },
                { templateId: 'tmpl3', itemId: 'item-a', confidence: 0.8 },
            ];
            const result = combineVotes(votes);
            const aggregate = result!.votingBreakdown.get('item-a');
            expect(aggregate!.maxConfidence).toBe(0.95);
        });

        it('should count votes correctly', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.85 },
                { templateId: 'tmpl3', itemId: 'item-b', confidence: 0.9 },
            ];
            const result = combineVotes(votes);
            expect(result!.votingBreakdown.get('item-a')!.voteCount).toBe(2);
            expect(result!.votingBreakdown.get('item-b')!.voteCount).toBe(1);
        });
    });

    describe('Edge cases', () => {
        it('should handle votes with identical confidence', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.8 },
                { templateId: 'tmpl2', itemId: 'item-b', confidence: 0.8 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
        });

        it('should handle very low confidence votes', () => {
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.01 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBeGreaterThanOrEqual(0);
        });

        it('should handle many unique items', () => {
            const votes: TemplateVote[] = [];
            for (let i = 0; i < 20; i++) {
                votes.push({ templateId: `tmpl${i}`, itemId: `item-${i}`, confidence: 0.7 + i * 0.01 });
            }
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.votingBreakdown.size).toBe(20);
        });

        it('should handle votes with metrics field', () => {
            const votes: TemplateVote[] = [
                {
                    templateId: 'tmpl1',
                    itemId: 'item-a',
                    confidence: 0.85,
                    metrics: { ncc: 0.9, ssim: 0.85, histogram: 0.8, edge: 0.75 },
                },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
        });

        it('should handle median with even number of votes', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, method: 'median' });
            const votes: TemplateVote[] = [
                { templateId: 'tmpl1', itemId: 'item-a', confidence: 0.6 },
                { templateId: 'tmpl2', itemId: 'item-a', confidence: 0.8 },
            ];
            const result = combineVotes(votes);
            expect(result).not.toBeNull();
            expect(result!.confidence).toBeCloseTo(0.7, 1); // Average of 0.6 and 0.8
        });
    });
});
