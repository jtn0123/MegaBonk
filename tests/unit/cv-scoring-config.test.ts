// ========================================
// CV Scoring Configuration Module - Unit Tests
// ========================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
    setScoringConfig,
    getScoringConfig,
    getThresholdForRarity,
    calculateWeightedScore,
    passesThreshold,
    getConfidenceGrade,
    describeScoringConfig,
    mergeWithDefaults,
    DEFAULT_SCORING_CONFIG,
    PRECISION_SCORING_CONFIG,
    RECALL_SCORING_CONFIG,
    FAST_SCORING_CONFIG,
    type ScoringConfig,
} from '../../src/modules/cv/scoring-config.ts';

describe('Scoring Configuration', () => {
    beforeEach(() => {
        // Reset to default config before each test
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('setScoringConfig / getScoringConfig', () => {
        it('should get default config initially', () => {
            const config = getScoringConfig();
            expect(config).toEqual(DEFAULT_SCORING_CONFIG);
        });

        it('should update config when set', () => {
            setScoringConfig(PRECISION_SCORING_CONFIG);
            expect(getScoringConfig()).toEqual(PRECISION_SCORING_CONFIG);
        });

        it('should allow custom config', () => {
            const customConfig: ScoringConfig = {
                ...DEFAULT_SCORING_CONFIG,
                baseThreshold: 0.6,
            };
            setScoringConfig(customConfig);
            expect(getScoringConfig().baseThreshold).toBe(0.6);
        });
    });

    describe('Preset Configurations', () => {
        it('DEFAULT_SCORING_CONFIG weights should sum close to 1.0', () => {
            const w = DEFAULT_SCORING_CONFIG.weights;
            const sum = w.ncc + w.ssim + w.histogram + w.edge;
            expect(sum).toBeCloseTo(1.0, 5);
        });

        it('PRECISION_SCORING_CONFIG should have higher threshold', () => {
            expect(PRECISION_SCORING_CONFIG.baseThreshold).toBeGreaterThan(DEFAULT_SCORING_CONFIG.baseThreshold);
        });

        it('RECALL_SCORING_CONFIG should have lower threshold', () => {
            expect(RECALL_SCORING_CONFIG.baseThreshold).toBeLessThan(DEFAULT_SCORING_CONFIG.baseThreshold);
        });

        it('FAST_SCORING_CONFIG should only use NCC and SSIM', () => {
            expect(FAST_SCORING_CONFIG.weights.histogram).toBe(0);
            expect(FAST_SCORING_CONFIG.weights.edge).toBe(0);
            expect(FAST_SCORING_CONFIG.weights.ncc).toBeGreaterThan(0);
            expect(FAST_SCORING_CONFIG.weights.ssim).toBeGreaterThan(0);
        });

        it('FAST_SCORING_CONFIG should have agreement disabled', () => {
            expect(FAST_SCORING_CONFIG.agreement.enabled).toBe(false);
        });
    });
});

describe('getThresholdForRarity', () => {
    beforeEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('Rarity-Based Thresholds', () => {
        it('should return lower threshold for common items', () => {
            const commonThreshold = getThresholdForRarity('common');
            const rareThreshold = getThresholdForRarity('rare');
            expect(commonThreshold).toBeLessThan(rareThreshold);
        });

        it('should return higher threshold for legendary items', () => {
            const legendaryThreshold = getThresholdForRarity('legendary');
            const commonThreshold = getThresholdForRarity('common');
            expect(legendaryThreshold).toBeGreaterThan(commonThreshold);
        });

        it('should return base threshold for rare (no adjustment)', () => {
            const config = getScoringConfig();
            // The threshold is base + adjustment, rare adjustment is 0
            expect(getThresholdForRarity('rare')).toBe(config.baseThreshold);
        });

        it('should handle unknown rarity with higher threshold', () => {
            const unknownThreshold = getThresholdForRarity('unknown');
            const rareThreshold = getThresholdForRarity('rare');
            expect(unknownThreshold).toBeGreaterThan(rareThreshold);
        });
    });

    describe('Case Insensitivity', () => {
        it('should handle uppercase rarity', () => {
            const threshold1 = getThresholdForRarity('LEGENDARY');
            const threshold2 = getThresholdForRarity('legendary');
            expect(threshold1).toBe(threshold2);
        });

        it('should handle mixed case rarity', () => {
            const threshold1 = getThresholdForRarity('Rare');
            const threshold2 = getThresholdForRarity('rare');
            expect(threshold1).toBe(threshold2);
        });
    });

    describe('Undefined/Null Handling', () => {
        it('should use unknown threshold for undefined rarity', () => {
            const threshold = getThresholdForRarity(undefined);
            // Should use unknown adjustment from config
            expect(threshold).toBeGreaterThan(DEFAULT_SCORING_CONFIG.baseThreshold);
        });

        it('should use unknown threshold for unrecognized rarity', () => {
            const threshold = getThresholdForRarity('mythical');
            const unknownThreshold = getThresholdForRarity('unknown');
            expect(threshold).toBe(unknownThreshold);
        });
    });

    describe('Minimum Confidence Enforcement', () => {
        it('should not return below minConfidence', () => {
            const config = getScoringConfig();
            const threshold = getThresholdForRarity('common');
            expect(threshold).toBeGreaterThanOrEqual(config.minConfidence);
        });

        it('should enforce minConfidence for all rarities', () => {
            const config = getScoringConfig();
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unknown'];

            for (const rarity of rarities) {
                const threshold = getThresholdForRarity(rarity);
                expect(threshold).toBeGreaterThanOrEqual(config.minConfidence);
            }
        });
    });
});

describe('calculateWeightedScore', () => {
    beforeEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('Basic Weighted Calculation', () => {
        it('should return perfect score for perfect metrics', () => {
            const score = calculateWeightedScore(1.0, 1.0, 1.0, 1.0);
            // With agreement bonus, should be close to maxConfidence
            expect(score).toBeGreaterThanOrEqual(0.99);
        });

        it('should return low score for poor metrics', () => {
            const score = calculateWeightedScore(0.1, 0.1, 0.1, 0.1);
            // Should be at or near minConfidence
            expect(score).toBeLessThanOrEqual(0.4);
        });

        it('should weight SSIM highest by default', () => {
            // If only SSIM is high, score should still be decent
            const ssimOnly = calculateWeightedScore(0.1, 0.9, 0.1, 0.1);
            // If only NCC is high, score should be lower (NCC weight is less)
            const nccOnly = calculateWeightedScore(0.9, 0.1, 0.1, 0.1);

            expect(ssimOnly).toBeGreaterThan(nccOnly);
        });

        it('should handle zero metrics', () => {
            const score = calculateWeightedScore(0, 0, 0, 0);
            expect(score).toBe(DEFAULT_SCORING_CONFIG.minConfidence);
        });
    });

    describe('Agreement Bonus', () => {
        it('should add bonus when multiple metrics agree', () => {
            // All metrics above agreement threshold (0.55)
            const allAgree = calculateWeightedScore(0.6, 0.6, 0.6, 0.6);
            // Only one metric above threshold
            const oneAgrees = calculateWeightedScore(0.6, 0.3, 0.3, 0.3);

            expect(allAgree).toBeGreaterThan(oneAgrees);
        });

        it('should respect maxBonus cap', () => {
            // Perfect metrics should get bonus but capped at maxBonus
            const score = calculateWeightedScore(1.0, 1.0, 1.0, 1.0);
            expect(score).toBeLessThanOrEqual(DEFAULT_SCORING_CONFIG.maxConfidence);
        });

        it('should not add bonus below minMetricsForBonus', () => {
            setScoringConfig({
                ...DEFAULT_SCORING_CONFIG,
                agreement: {
                    ...DEFAULT_SCORING_CONFIG.agreement,
                    minMetricsForBonus: 4,
                },
            });

            // Only 3 metrics above threshold
            const score = calculateWeightedScore(0.7, 0.7, 0.7, 0.3);
            // Base weighted without bonus
            const baseScore = 0.7 * 0.25 + 0.7 * 0.35 + 0.7 * 0.25 + 0.3 * 0.15;

            expect(score).toBeCloseTo(baseScore, 1);
        });
    });

    describe('Config Variations', () => {
        it('should respect disabled agreement bonus', () => {
            setScoringConfig(FAST_SCORING_CONFIG);

            // FAST config has agreement disabled
            const score1 = calculateWeightedScore(0.8, 0.8, 0.0, 0.0);
            // Should just be weighted average without bonus
            const expected = 0.8 * 0.5 + 0.8 * 0.5;
            expect(score1).toBeCloseTo(expected, 1);
        });

        it('should only count enabled metrics for agreement', () => {
            setScoringConfig(FAST_SCORING_CONFIG);

            // Histogram and edge are 0 weight, so they shouldn't count
            const score = calculateWeightedScore(0.8, 0.8, 0.1, 0.1);
            // NCC and SSIM are 0.5 each
            expect(score).toBeCloseTo(0.8, 1);
        });
    });

    describe('Clamping', () => {
        it('should clamp to minConfidence', () => {
            const score = calculateWeightedScore(0, 0, 0, 0);
            expect(score).toBe(DEFAULT_SCORING_CONFIG.minConfidence);
        });

        it('should clamp to maxConfidence', () => {
            const score = calculateWeightedScore(1.0, 1.0, 1.0, 1.0);
            expect(score).toBeLessThanOrEqual(DEFAULT_SCORING_CONFIG.maxConfidence);
        });
    });
});

describe('passesThreshold', () => {
    beforeEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('Basic Threshold Checking', () => {
        it('should return true for score above threshold', () => {
            expect(passesThreshold(0.9, 'common')).toBe(true);
        });

        it('should return false for score below threshold', () => {
            expect(passesThreshold(0.2, 'legendary')).toBe(false);
        });

        it('should return true for exact threshold', () => {
            const threshold = getThresholdForRarity('rare');
            expect(passesThreshold(threshold, 'rare')).toBe(true);
        });
    });

    describe('Rarity Consideration', () => {
        it('should be more lenient for common items', () => {
            // Same score, common should pass more easily
            const score = 0.43;
            expect(passesThreshold(score, 'common')).toBe(true);
            expect(passesThreshold(score, 'legendary')).toBe(false);
        });
    });
});

describe('getConfidenceGrade', () => {
    describe('Grade Assignments', () => {
        it('should return A for excellent scores', () => {
            const grade = getConfidenceGrade(0.9);
            expect(grade.grade).toBe('A');
            expect(grade.label).toBe('Excellent');
        });

        it('should return B for good scores', () => {
            const grade = getConfidenceGrade(0.75);
            expect(grade.grade).toBe('B');
            expect(grade.label).toBe('Good');
        });

        it('should return C for fair scores', () => {
            const grade = getConfidenceGrade(0.6);
            expect(grade.grade).toBe('C');
            expect(grade.label).toBe('Fair');
        });

        it('should return D for poor scores', () => {
            const grade = getConfidenceGrade(0.45);
            expect(grade.grade).toBe('D');
            expect(grade.label).toBe('Poor');
        });

        it('should return F for failing scores', () => {
            const grade = getConfidenceGrade(0.3);
            expect(grade.grade).toBe('F');
            expect(grade.label).toBe('Fail');
        });
    });

    describe('Boundary Cases', () => {
        it('should handle exact boundaries correctly', () => {
            expect(getConfidenceGrade(0.85).grade).toBe('A');
            expect(getConfidenceGrade(0.7).grade).toBe('B');
            expect(getConfidenceGrade(0.55).grade).toBe('C');
            expect(getConfidenceGrade(0.4).grade).toBe('D');
        });

        it('should handle 0 score', () => {
            const grade = getConfidenceGrade(0);
            expect(grade.grade).toBe('F');
        });

        it('should handle 1.0 score', () => {
            const grade = getConfidenceGrade(1.0);
            expect(grade.grade).toBe('A');
        });
    });

    describe('Color Assignment', () => {
        it('should return green-ish color for A grade', () => {
            const grade = getConfidenceGrade(0.9);
            expect(grade.color).toMatch(/#[A-Fa-f0-9]{6}/);
        });

        it('should return different colors for different grades', () => {
            const gradeA = getConfidenceGrade(0.9);
            const gradeF = getConfidenceGrade(0.2);
            expect(gradeA.color).not.toBe(gradeF.color);
        });
    });
});

describe('describeScoringConfig', () => {
    it('should include weight information', () => {
        const description = describeScoringConfig();
        expect(description).toContain('Weights');
        expect(description).toContain('SSIM');
        expect(description).toContain('NCC');
    });

    it('should include agreement status', () => {
        const description = describeScoringConfig();
        expect(description).toMatch(/Agreement: (ON|OFF)/);
    });

    it('should include threshold information', () => {
        const description = describeScoringConfig();
        expect(description).toContain('threshold');
    });

    it('should reflect current config', () => {
        setScoringConfig(FAST_SCORING_CONFIG);
        const description = describeScoringConfig();
        expect(description).toContain('OFF'); // Agreement disabled in FAST config
    });
});

describe('mergeWithDefaults', () => {
    describe('Partial Merging', () => {
        it('should return defaults for empty partial', () => {
            const merged = mergeWithDefaults({});
            expect(merged).toEqual(DEFAULT_SCORING_CONFIG);
        });

        it('should override baseThreshold', () => {
            const merged = mergeWithDefaults({ baseThreshold: 0.6 });
            expect(merged.baseThreshold).toBe(0.6);
            expect(merged.weights).toEqual(DEFAULT_SCORING_CONFIG.weights);
        });

        it('should override minConfidence', () => {
            const merged = mergeWithDefaults({ minConfidence: 0.2 });
            expect(merged.minConfidence).toBe(0.2);
        });

        it('should override maxConfidence', () => {
            const merged = mergeWithDefaults({ maxConfidence: 0.95 });
            expect(merged.maxConfidence).toBe(0.95);
        });
    });

    describe('Nested Object Merging', () => {
        it('should merge weights partially', () => {
            const merged = mergeWithDefaults({
                weights: { ssim: 0.5 } as any,
            });
            expect(merged.weights.ssim).toBe(0.5);
            expect(merged.weights.ncc).toBe(DEFAULT_SCORING_CONFIG.weights.ncc);
        });

        it('should merge agreement config partially', () => {
            const merged = mergeWithDefaults({
                agreement: { enabled: false } as any,
            });
            expect(merged.agreement.enabled).toBe(false);
            expect(merged.agreement.threshold).toBe(DEFAULT_SCORING_CONFIG.agreement.threshold);
        });

        it('should merge rarityThresholds partially', () => {
            const merged = mergeWithDefaults({
                rarityThresholds: { legendary: 0.1 } as any,
            });
            expect(merged.rarityThresholds.legendary).toBe(0.1);
            expect(merged.rarityThresholds.common).toBe(DEFAULT_SCORING_CONFIG.rarityThresholds.common);
        });
    });

    describe('Complete Override', () => {
        it('should allow complete config override', () => {
            const custom: ScoringConfig = {
                weights: { ncc: 0.1, ssim: 0.1, histogram: 0.4, edge: 0.4 },
                agreement: {
                    enabled: false,
                    threshold: 0.8,
                    minMetricsForBonus: 4,
                    bonusPerMetric: 0.01,
                    maxBonus: 0.02,
                },
                baseThreshold: 0.7,
                rarityThresholds: {
                    common: 0,
                    uncommon: 0,
                    rare: 0,
                    epic: 0,
                    legendary: 0,
                    unknown: 0,
                },
                minConfidence: 0.5,
                maxConfidence: 0.9,
            };
            const merged = mergeWithDefaults(custom);
            expect(merged).toEqual(custom);
        });
    });
});
