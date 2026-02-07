// ========================================
// CV Voting Module - Unit Tests
// ========================================

import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../../src/modules/cv/voting.ts';

// Helper to create template votes
function createVote(
    templateId: string,
    itemId: string,
    confidence: number,
    rarity?: string
): TemplateVote {
    return { templateId, itemId, confidence, rarity };
}

describe('Voting Configuration', () => {
    beforeEach(() => {
        // Reset to default config before each test
        setVotingConfig(DEFAULT_VOTING_CONFIG);
    });

    describe('setVotingConfig / getVotingConfig', () => {
        it('should get default config initially', () => {
            const config = getVotingConfig();
            expect(config).toEqual(DEFAULT_VOTING_CONFIG);
        });

        it('should update config when set', () => {
            setVotingConfig(STRICT_VOTING_CONFIG);
            expect(getVotingConfig()).toEqual(STRICT_VOTING_CONFIG);
        });

        it('should allow custom config', () => {
            const customConfig: VotingConfig = {
                minVotes: 5,
                minConsensus: 0.8,
                usePerformanceWeighting: false,
                performanceWeight: 0,
                method: 'max',
                confusionPenalty: 0.2,
            };
            setVotingConfig(customConfig);
            expect(getVotingConfig()).toEqual(customConfig);
        });
    });

    describe('Preset Configurations', () => {
        it('DEFAULT_VOTING_CONFIG should have reasonable defaults', () => {
            expect(DEFAULT_VOTING_CONFIG.minVotes).toBe(1);
            expect(DEFAULT_VOTING_CONFIG.minConsensus).toBe(0.5);
            expect(DEFAULT_VOTING_CONFIG.method).toBe('weighted-average');
        });

        it('STRICT_VOTING_CONFIG should require higher consensus', () => {
            expect(STRICT_VOTING_CONFIG.minVotes).toBeGreaterThan(DEFAULT_VOTING_CONFIG.minVotes);
            expect(STRICT_VOTING_CONFIG.minConsensus).toBeGreaterThan(DEFAULT_VOTING_CONFIG.minConsensus);
        });

        it('LENIENT_VOTING_CONFIG should accept more results', () => {
            expect(LENIENT_VOTING_CONFIG.minConsensus).toBeLessThan(DEFAULT_VOTING_CONFIG.minConsensus);
        });
    });
});

describe('combineVotes', () => {
    beforeEach(() => {
        setVotingConfig(DEFAULT_VOTING_CONFIG);
    });

    describe('Basic Voting', () => {
        it('should return null for empty votes', () => {
            const result = combineVotes([]);
            expect(result).toBeNull();
        });

        it('should return winner for single vote', () => {
            const votes = [createVote('t1', 'sword', 0.8)];
            const result = combineVotes(votes);

            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('sword');
            expect(result!.voteCount).toBe(1);
            expect(result!.totalVotes).toBe(1);
            expect(result!.consensus).toBe(1);
        });

        it('should find winner with most votes when confidence is similar', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'sword', 0.8),
                createVote('t3', 'shield', 0.8),
            ];
            const result = combineVotes(votes);

            expect(result!.itemId).toBe('sword');
            expect(result!.voteCount).toBe(2);
            expect(result!.totalVotes).toBe(3);
        });

        it('should track voting breakdown', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'shield', 0.7),
            ];
            const result = combineVotes(votes);

            expect(result!.votingBreakdown.has('sword')).toBe(true);
            expect(result!.votingBreakdown.has('shield')).toBe(true);
        });
    });

    describe('Consensus Calculation', () => {
        it('should calculate consensus correctly', () => {
            // Using equal confidences so vote count determines winner
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'sword', 0.8),
                createVote('t3', 'sword', 0.8),
                createVote('t4', 'shield', 0.8),
            ];
            const result = combineVotes(votes);

            expect(result!.itemId).toBe('sword');
            expect(result!.consensus).toBe(0.75); // 3/4 votes for sword
        });

        it('should return null when minVotes not met', () => {
            setVotingConfig({ ...DEFAULT_VOTING_CONFIG, minVotes: 3 });
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'sword', 0.7),
            ];
            const result = combineVotes(votes);

            expect(result).toBeNull();
        });

        it('should penalize low consensus', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'shield', 0.79),
                createVote('t3', 'potion', 0.78),
            ];
            // With minConsensus 0.5, 1/3 votes = 0.33 consensus is below threshold
            const result = combineVotes(votes);

            // Result is penalized when consensus < minConsensus
            expect(result!.confidence).toBeLessThan(0.8);
        });
    });

    describe('Voting Methods', () => {
        it('should use weighted-average method by default', () => {
            const votes = [
                createVote('t1', 'sword', 0.6),
                createVote('t2', 'sword', 0.8),
            ];
            const result = combineVotes(votes);

            // Weighted average should be between the two values
            expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
            expect(result!.confidence).toBeLessThanOrEqual(0.8);
        });

        it('should use max method when configured', () => {
            const votes = [
                createVote('t1', 'sword', 0.6),
                createVote('t2', 'sword', 0.9),
                createVote('t3', 'sword', 0.7),
            ];
            const result = combineVotes(votes, { method: 'max' });

            expect(result!.confidence).toBeCloseTo(0.9, 1);
        });

        it('should use median method when configured', () => {
            const votes = [
                createVote('t1', 'sword', 0.5),
                createVote('t2', 'sword', 0.7),
                createVote('t3', 'sword', 0.9),
            ];
            const result = combineVotes(votes, { method: 'median' });

            expect(result!.confidence).toBeCloseTo(0.7, 1);
        });

        it('should handle median with even number of votes', () => {
            const votes = [
                createVote('t1', 'sword', 0.6),
                createVote('t2', 'sword', 0.8),
            ];
            const result = combineVotes(votes, { method: 'median' });

            expect(result!.confidence).toBeCloseTo(0.7, 1);
        });

        it('should use ranked-choice method when configured', () => {
            const votes = [
                createVote('t1', 'sword', 0.9), // First choice (weight 1)
                createVote('t2', 'sword', 0.7), // Second choice (weight 0.5)
                createVote('t3', 'sword', 0.5), // Third choice (weight 0.33)
            ];
            const result = combineVotes(votes, { method: 'ranked-choice' });

            // Ranked choice gives more weight to higher confidence votes
            expect(result).not.toBeNull();
        });
    });

    describe('Config Override', () => {
        it('should allow partial config override', () => {
            const votes = [createVote('t1', 'sword', 0.8)];
            const result = combineVotes(votes, { minVotes: 1 });

            expect(result).not.toBeNull();
        });

        it('should merge override with active config', () => {
            setVotingConfig(STRICT_VOTING_CONFIG);
            const votes = [createVote('t1', 'sword', 0.8)];
            const result = combineVotes(votes, { minVotes: 1 });

            // Should use minVotes=1 from override but other values from STRICT
            expect(result).not.toBeNull();
        });
    });

    describe('Threshold Checking', () => {
        it('should indicate if result passes threshold', () => {
            const votes = [createVote('t1', 'sword', 0.8, 'common')];
            const result = combineVotes(votes);

            expect(result).not.toBeNull();
            expect(typeof result!.passesThreshold).toBe('boolean');
        });

        it('should cap confidence at 0.99', () => {
            const votes = [
                createVote('t1', 'sword', 0.99),
                createVote('t2', 'sword', 0.99),
            ];
            const result = combineVotes(votes);

            expect(result!.confidence).toBeLessThanOrEqual(0.99);
        });
    });

    describe('Edge Cases', () => {
        it('should handle all votes for same item', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'sword', 0.9),
                createVote('t3', 'sword', 0.7),
            ];
            const result = combineVotes(votes);

            expect(result!.itemId).toBe('sword');
            expect(result!.consensus).toBe(1);
        });

        it('should handle tie-breaking by confidence', () => {
            const votes = [
                createVote('t1', 'sword', 0.9),
                createVote('t2', 'shield', 0.8),
            ];
            const result = combineVotes(votes);

            // With equal votes, higher confidence should win
            expect(result!.itemId).toBe('sword');
        });

        it('should handle very low confidence votes', () => {
            const votes = [createVote('t1', 'sword', 0.01)];
            const result = combineVotes(votes);

            expect(result).not.toBeNull();
            expect(result!.confidence).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('majorityVote', () => {
    describe('Basic Majority', () => {
        it('should return null for empty votes', () => {
            const result = majorityVote([]);
            expect(result).toBeNull();
        });

        it('should return single item', () => {
            const votes = [createVote('t1', 'sword', 0.8)];
            const result = majorityVote(votes);

            expect(result!.itemId).toBe('sword');
            expect(result!.voteCount).toBe(1);
        });

        it('should return item with most votes', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'sword', 0.7),
                createVote('t3', 'shield', 0.9),
            ];
            const result = majorityVote(votes);

            expect(result!.itemId).toBe('sword');
            expect(result!.voteCount).toBe(2);
        });

        it('should use max confidence from winning group', () => {
            const votes = [
                createVote('t1', 'sword', 0.6),
                createVote('t2', 'sword', 0.9),
                createVote('t3', 'shield', 0.95),
            ];
            const result = majorityVote(votes);

            expect(result!.confidence).toBe(0.9);
        });
    });

    describe('Edge Cases', () => {
        it('should handle tie by picking first encountered', () => {
            const votes = [
                createVote('t1', 'sword', 0.8),
                createVote('t2', 'shield', 0.9),
            ];
            const result = majorityVote(votes);

            // With equal counts, first with higher count wins
            expect(result!.voteCount).toBe(1);
        });

        it('should handle many items', () => {
            const votes = [
                createVote('t1', 'a', 0.5),
                createVote('t2', 'b', 0.6),
                createVote('t3', 'c', 0.7),
                createVote('t4', 'a', 0.8),
                createVote('t5', 'a', 0.4),
            ];
            const result = majorityVote(votes);

            expect(result!.itemId).toBe('a');
            expect(result!.voteCount).toBe(3);
        });
    });
});

describe('thresholdVote', () => {
    beforeEach(() => {
        setVotingConfig(DEFAULT_VOTING_CONFIG);
    });

    describe('Threshold Filtering', () => {
        it('should return null when no votes pass threshold', () => {
            const votes = [
                createVote('t1', 'sword', 0.2),
                createVote('t2', 'shield', 0.1),
            ];
            const result = thresholdVote(votes, 'common');

            // Threshold for common is around 0.42 (base 0.45 - 0.03)
            expect(result).toBeNull();
        });

        it('should only consider votes above threshold', () => {
            const votes = [
                createVote('t1', 'sword', 0.3), // Below threshold
                createVote('t2', 'sword', 0.8), // Above threshold
                createVote('t3', 'shield', 0.9), // Above threshold
            ];
            const result = thresholdVote(votes, 'rare');

            expect(result).not.toBeNull();
            // Should not count the 0.3 vote
        });

        it('should use vote rarity over provided rarity', () => {
            const votes = [
                { ...createVote('t1', 'sword', 0.5), rarity: 'legendary' },
            ];
            const result = thresholdVote(votes);

            // Vote-level rarity (legendary) should be used
            expect(result).not.toBeNull();
        });
    });
});

describe('ensembleVote', () => {
    beforeEach(() => {
        setVotingConfig(DEFAULT_VOTING_CONFIG);
    });

    describe('Strategy Weighting', () => {
        it('should return null for empty strategies', () => {
            const result = ensembleVote([]);
            expect(result).toBeNull();
        });

        it('should apply strategy weights to votes', () => {
            const strategyResults = [
                {
                    strategy: 'template',
                    votes: [createVote('t1', 'sword', 0.8)],
                    weight: 1.0,
                },
            ];
            const result = ensembleVote(strategyResults);

            expect(result).not.toBeNull();
            expect(result!.itemId).toBe('sword');
        });

        it('should combine votes from multiple strategies', () => {
            const strategyResults = [
                {
                    strategy: 'template',
                    votes: [createVote('t1', 'sword', 0.8)],
                    weight: 1.0,
                },
                {
                    strategy: 'histogram',
                    votes: [createVote('h1', 'sword', 0.7)],
                    weight: 0.5,
                },
            ];
            const result = ensembleVote(strategyResults);

            expect(result!.itemId).toBe('sword');
            expect(result!.totalVotes).toBe(2);
        });

        it('should weight strategies differently', () => {
            const strategyResults = [
                {
                    strategy: 'strong',
                    votes: [createVote('s1', 'sword', 0.8)],
                    weight: 2.0,
                },
                {
                    strategy: 'weak',
                    votes: [createVote('w1', 'shield', 0.9)],
                    weight: 0.1,
                },
            ];
            const result = ensembleVote(strategyResults);

            // Strong strategy with weight 2.0 should dominate
            expect(result!.itemId).toBe('sword');
        });
    });

    describe('Empty Strategies', () => {
        it('should handle strategies with no votes', () => {
            const strategyResults = [
                { strategy: 'empty', votes: [], weight: 1.0 },
                { strategy: 'has_votes', votes: [createVote('t1', 'sword', 0.8)], weight: 1.0 },
            ];
            const result = ensembleVote(strategyResults);

            expect(result!.itemId).toBe('sword');
        });
    });
});

describe('describeVotingResult', () => {
    it('should generate human-readable description', () => {
        const votes = [
            createVote('t1', 'sword', 0.8),
            createVote('t2', 'sword', 0.7),
            createVote('t3', 'shield', 0.9),
        ];
        const result = combineVotes(votes);

        const description = describeVotingResult(result!);

        expect(description).toContain('sword');
        expect(description).toContain('Votes:');
        expect(description).toContain('consensus');
        expect(description).toContain('Breakdown');
    });

    it('should show percentage values', () => {
        const votes = [createVote('t1', 'sword', 0.85)];
        const result = combineVotes(votes);

        const description = describeVotingResult(result!);

        expect(description).toMatch(/\d+\.\d+%/); // Should contain percentage
    });
});
