import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    DEFAULT_SCORING_CONFIG,
    PRECISION_SCORING_CONFIG,
    RECALL_SCORING_CONFIG,
    FAST_SCORING_CONFIG,
    setScoringConfig,
    getScoringConfig,
    getThresholdForRarity,
    calculateWeightedScore,
    passesThreshold,
    getConfidenceGrade,
    describeScoringConfig,
    mergeWithDefaults,
    type ScoringConfig,
    type MetricWeights,
    type AgreementConfig,
    type RarityThresholds,
} from '../../src/modules/cv/scoring-config.js';

describe('scoring-config', () => {
    // Reset to default config before each test
    beforeEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    afterEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('Configuration Constants', () => {
        describe('DEFAULT_SCORING_CONFIG', () => {
            it('should have weights that sum to approximately 1.0', () => {
                const { weights } = DEFAULT_SCORING_CONFIG;
                const sum = weights.ncc + weights.ssim + weights.histogram + weights.edge;
                expect(sum).toBeCloseTo(1.0, 2);
            });

            it('should have SSIM as the highest weighted metric', () => {
                const { weights } = DEFAULT_SCORING_CONFIG;
                expect(weights.ssim).toBeGreaterThan(weights.ncc);
                expect(weights.ssim).toBeGreaterThan(weights.histogram);
                expect(weights.ssim).toBeGreaterThan(weights.edge);
            });

            it('should have agreement bonus enabled', () => {
                expect(DEFAULT_SCORING_CONFIG.agreement.enabled).toBe(true);
            });

            it('should have valid confidence range', () => {
                expect(DEFAULT_SCORING_CONFIG.minConfidence).toBeLessThan(DEFAULT_SCORING_CONFIG.maxConfidence);
                expect(DEFAULT_SCORING_CONFIG.minConfidence).toBeGreaterThan(0);
                expect(DEFAULT_SCORING_CONFIG.maxConfidence).toBeLessThanOrEqual(1);
            });

            it('should have all rarity thresholds defined', () => {
                const rarities: (keyof RarityThresholds)[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unknown'];
                rarities.forEach(rarity => {
                    expect(DEFAULT_SCORING_CONFIG.rarityThresholds[rarity]).toBeDefined();
                    expect(typeof DEFAULT_SCORING_CONFIG.rarityThresholds[rarity]).toBe('number');
                });
            });
        });

        describe('PRECISION_SCORING_CONFIG', () => {
            it('should have higher base threshold than default', () => {
                expect(PRECISION_SCORING_CONFIG.baseThreshold).toBeGreaterThan(DEFAULT_SCORING_CONFIG.baseThreshold);
            });

            it('should have higher agreement threshold', () => {
                expect(PRECISION_SCORING_CONFIG.agreement.threshold).toBeGreaterThan(DEFAULT_SCORING_CONFIG.agreement.threshold);
            });

            it('should require more metrics for bonus', () => {
                expect(PRECISION_SCORING_CONFIG.agreement.minMetricsForBonus).toBeGreaterThanOrEqual(
                    DEFAULT_SCORING_CONFIG.agreement.minMetricsForBonus
                );
            });

            it('should have weights summing to ~1.0', () => {
                const { weights } = PRECISION_SCORING_CONFIG;
                const sum = weights.ncc + weights.ssim + weights.histogram + weights.edge;
                expect(sum).toBeCloseTo(1.0, 2);
            });
        });

        describe('RECALL_SCORING_CONFIG', () => {
            it('should have lower base threshold than default', () => {
                expect(RECALL_SCORING_CONFIG.baseThreshold).toBeLessThan(DEFAULT_SCORING_CONFIG.baseThreshold);
            });

            it('should have lower agreement threshold', () => {
                expect(RECALL_SCORING_CONFIG.agreement.threshold).toBeLessThan(DEFAULT_SCORING_CONFIG.agreement.threshold);
            });

            it('should have higher max bonus', () => {
                expect(RECALL_SCORING_CONFIG.agreement.maxBonus).toBeGreaterThan(DEFAULT_SCORING_CONFIG.agreement.maxBonus);
            });

            it('should have lower minConfidence', () => {
                expect(RECALL_SCORING_CONFIG.minConfidence).toBeLessThan(DEFAULT_SCORING_CONFIG.minConfidence);
            });
        });

        describe('FAST_SCORING_CONFIG', () => {
            it('should disable histogram and edge metrics', () => {
                expect(FAST_SCORING_CONFIG.weights.histogram).toBe(0);
                expect(FAST_SCORING_CONFIG.weights.edge).toBe(0);
            });

            it('should only use SSIM and NCC', () => {
                const { weights } = FAST_SCORING_CONFIG;
                expect(weights.ssim + weights.ncc).toBe(1.0);
            });

            it('should disable agreement bonus', () => {
                expect(FAST_SCORING_CONFIG.agreement.enabled).toBe(false);
            });

            it('should have bonusPerMetric and maxBonus of 0', () => {
                expect(FAST_SCORING_CONFIG.agreement.bonusPerMetric).toBe(0);
                expect(FAST_SCORING_CONFIG.agreement.maxBonus).toBe(0);
            });
        });
    });

    describe('setScoringConfig / getScoringConfig', () => {
        it('should return default config initially', () => {
            const config = getScoringConfig();
            expect(config).toEqual(DEFAULT_SCORING_CONFIG);
        });

        it('should update active config when set', () => {
            setScoringConfig(PRECISION_SCORING_CONFIG);
            expect(getScoringConfig()).toEqual(PRECISION_SCORING_CONFIG);
        });

        it('should allow switching between configs', () => {
            setScoringConfig(RECALL_SCORING_CONFIG);
            expect(getScoringConfig()).toEqual(RECALL_SCORING_CONFIG);

            setScoringConfig(FAST_SCORING_CONFIG);
            expect(getScoringConfig()).toEqual(FAST_SCORING_CONFIG);

            setScoringConfig(DEFAULT_SCORING_CONFIG);
            expect(getScoringConfig()).toEqual(DEFAULT_SCORING_CONFIG);
        });

        it('should accept custom config', () => {
            const customConfig: ScoringConfig = {
                weights: { ncc: 0.4, ssim: 0.4, histogram: 0.1, edge: 0.1 },
                agreement: {
                    enabled: false,
                    threshold: 0.5,
                    minMetricsForBonus: 2,
                    bonusPerMetric: 0,
                    maxBonus: 0,
                },
                baseThreshold: 0.5,
                rarityThresholds: {
                    common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, unknown: 0,
                },
                minConfidence: 0.3,
                maxConfidence: 0.95,
            };

            setScoringConfig(customConfig);
            expect(getScoringConfig()).toEqual(customConfig);
        });
    });

    describe('getThresholdForRarity', () => {
        beforeEach(() => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
        });

        it('should return base + unknown adjustment when rarity is undefined', () => {
            const threshold = getThresholdForRarity(undefined);
            const expected = DEFAULT_SCORING_CONFIG.baseThreshold + DEFAULT_SCORING_CONFIG.rarityThresholds.unknown;
            expect(threshold).toBe(expected);
        });

        it('should return base + common adjustment for common rarity', () => {
            const threshold = getThresholdForRarity('common');
            const expected = DEFAULT_SCORING_CONFIG.baseThreshold + DEFAULT_SCORING_CONFIG.rarityThresholds.common;
            expect(threshold).toBe(expected);
        });

        it('should handle case-insensitive rarity names', () => {
            const thresholdLower = getThresholdForRarity('legendary');
            const thresholdUpper = getThresholdForRarity('LEGENDARY');
            const thresholdMixed = getThresholdForRarity('LeGeNdArY');

            expect(thresholdLower).toBe(thresholdUpper);
            expect(thresholdLower).toBe(thresholdMixed);
        });

        it('should return lower threshold for legendary (more lenient)', () => {
            const commonThreshold = getThresholdForRarity('common');
            const legendaryThreshold = getThresholdForRarity('legendary');
            expect(legendaryThreshold).toBeLessThan(commonThreshold);
        });

        it('should return higher threshold for unknown (more strict)', () => {
            const commonThreshold = getThresholdForRarity('common');
            const unknownThreshold = getThresholdForRarity('unknown');
            expect(unknownThreshold).toBeGreaterThan(commonThreshold);
        });

        it('should use unknown adjustment for invalid rarity', () => {
            const threshold = getThresholdForRarity('mythical'); // Not a real rarity
            const expected = DEFAULT_SCORING_CONFIG.baseThreshold + DEFAULT_SCORING_CONFIG.rarityThresholds.unknown;
            expect(threshold).toBe(expected);
        });

        it('should never return below minConfidence', () => {
            // Create config with very negative adjustment
            const testConfig: ScoringConfig = {
                ...DEFAULT_SCORING_CONFIG,
                baseThreshold: 0.1,
                rarityThresholds: {
                    ...DEFAULT_SCORING_CONFIG.rarityThresholds,
                    legendary: -0.5, // Would make it negative
                },
                minConfidence: 0.2,
            };
            setScoringConfig(testConfig);

            const threshold = getThresholdForRarity('legendary');
            expect(threshold).toBe(testConfig.minConfidence);
        });

        it('should return different thresholds for each rarity', () => {
            setScoringConfig(PRECISION_SCORING_CONFIG);
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unknown'];
            const thresholds = rarities.map(r => getThresholdForRarity(r));

            // At least some should differ
            const uniqueThresholds = new Set(thresholds);
            expect(uniqueThresholds.size).toBeGreaterThan(1);
        });
    });

    describe('calculateWeightedScore', () => {
        beforeEach(() => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
        });

        it('should calculate weighted average of metrics', () => {
            // All 1.0 should give max (capped to maxConfidence)
            const score = calculateWeightedScore(1.0, 1.0, 1.0, 1.0);
            expect(score).toBeLessThanOrEqual(DEFAULT_SCORING_CONFIG.maxConfidence);
        });

        it('should handle all zeros', () => {
            const score = calculateWeightedScore(0, 0, 0, 0);
            expect(score).toBe(DEFAULT_SCORING_CONFIG.minConfidence);
        });

        it('should weight SSIM highest', () => {
            // Use moderate values so we're not clamped to minConfidence
            // High SSIM only (0.8 SSIM, 0.3 others)
            const highSsim = calculateWeightedScore(0.3, 0.8, 0.3, 0.3);
            // High NCC only (0.8 NCC, 0.3 others)
            const highNcc = calculateWeightedScore(0.8, 0.3, 0.3, 0.3);

            // SSIM weight (0.35) > NCC weight (0.25), so boosting SSIM gives higher score
            expect(highSsim).toBeGreaterThan(highNcc);
        });

        it('should add agreement bonus when metrics agree', () => {
            // All metrics high (above threshold)
            const allHigh = calculateWeightedScore(0.8, 0.8, 0.8, 0.8);

            // Calculate expected base without bonus
            const w = DEFAULT_SCORING_CONFIG.weights;
            const baseScore = 0.8 * w.ncc + 0.8 * w.ssim + 0.8 * w.histogram + 0.8 * w.edge;

            expect(allHigh).toBeGreaterThan(baseScore);
        });

        it('should not add agreement bonus when disabled', () => {
            setScoringConfig(FAST_SCORING_CONFIG);

            const score = calculateWeightedScore(0.8, 0.8, 0.8, 0.8);

            // With FAST config (histogram=0, edge=0), only SSIM and NCC count
            const w = FAST_SCORING_CONFIG.weights;
            const expected = 0.8 * w.ncc + 0.8 * w.ssim;
            expect(score).toBe(expected);
        });

        it('should not add bonus when too few metrics agree', () => {
            // Only 1 metric above threshold
            const score = calculateWeightedScore(0.2, 0.9, 0.2, 0.2);

            const w = DEFAULT_SCORING_CONFIG.weights;
            const expectedBase = 0.2 * w.ncc + 0.9 * w.ssim + 0.2 * w.histogram + 0.2 * w.edge;

            // Should be close to base (maybe clamped)
            expect(score).toBeCloseTo(Math.max(DEFAULT_SCORING_CONFIG.minConfidence, expectedBase), 2);
        });

        it('should cap bonus at maxBonus', () => {
            // All 4 metrics super high
            const score = calculateWeightedScore(0.95, 0.95, 0.95, 0.95);

            const w = DEFAULT_SCORING_CONFIG.weights;
            const baseScore = 0.95 * w.ncc + 0.95 * w.ssim + 0.95 * w.histogram + 0.95 * w.edge;
            const maxWithBonus = baseScore + DEFAULT_SCORING_CONFIG.agreement.maxBonus;

            expect(score).toBeLessThanOrEqual(Math.min(DEFAULT_SCORING_CONFIG.maxConfidence, maxWithBonus));
        });

        it('should clamp score to minConfidence', () => {
            const score = calculateWeightedScore(0, 0, 0, 0);
            expect(score).toBe(DEFAULT_SCORING_CONFIG.minConfidence);
        });

        it('should clamp score to maxConfidence', () => {
            const score = calculateWeightedScore(1.0, 1.0, 1.0, 1.0);
            expect(score).toBeLessThanOrEqual(DEFAULT_SCORING_CONFIG.maxConfidence);
        });

        it('should handle mixed metric values', () => {
            const score = calculateWeightedScore(0.3, 0.7, 0.5, 0.6);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(1);
        });

        it('should only count enabled metrics for agreement bonus', () => {
            setScoringConfig(FAST_SCORING_CONFIG);

            // Even though histogram=0.9 and edge=0.9 are high, they're disabled (weight=0)
            // Use values that produce a score above minConfidence
            const score = calculateWeightedScore(0.5, 0.5, 0.9, 0.9);

            // Only SSIM and NCC count (histogram and edge weights are 0)
            // Agreement is disabled in FAST config, so no bonus
            const w = FAST_SCORING_CONFIG.weights;
            const expected = 0.5 * w.ncc + 0.5 * w.ssim; // = 0.5 * 0.5 + 0.5 * 0.5 = 0.5
            expect(score).toBe(expected);
        });
    });

    describe('passesThreshold', () => {
        beforeEach(() => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
        });

        it('should return true when score equals threshold', () => {
            const threshold = getThresholdForRarity('common');
            expect(passesThreshold(threshold, 'common')).toBe(true);
        });

        it('should return true when score exceeds threshold', () => {
            const threshold = getThresholdForRarity('common');
            expect(passesThreshold(threshold + 0.1, 'common')).toBe(true);
        });

        it('should return false when score below threshold', () => {
            const threshold = getThresholdForRarity('common');
            expect(passesThreshold(threshold - 0.1, 'common')).toBe(false);
        });

        it('should use unknown threshold when rarity undefined', () => {
            const threshold = getThresholdForRarity(undefined);
            expect(passesThreshold(threshold, undefined)).toBe(true);
            expect(passesThreshold(threshold - 0.01, undefined)).toBe(false);
        });

        it('should be more lenient for legendary', () => {
            const commonThreshold = getThresholdForRarity('common');
            const legendaryThreshold = getThresholdForRarity('legendary');

            // Score that fails common but passes legendary
            const midScore = (commonThreshold + legendaryThreshold) / 2;
            if (legendaryThreshold < commonThreshold) {
                expect(passesThreshold(midScore, 'legendary')).toBe(true);
            }
        });
    });

    describe('getConfidenceGrade', () => {
        it('should return A grade for score >= 0.85', () => {
            expect(getConfidenceGrade(0.85)).toEqual({ grade: 'A', label: 'Excellent', color: '#4CAF50' });
            expect(getConfidenceGrade(0.95)).toEqual({ grade: 'A', label: 'Excellent', color: '#4CAF50' });
            expect(getConfidenceGrade(1.0)).toEqual({ grade: 'A', label: 'Excellent', color: '#4CAF50' });
        });

        it('should return B grade for score >= 0.7 and < 0.85', () => {
            expect(getConfidenceGrade(0.7)).toEqual({ grade: 'B', label: 'Good', color: '#8BC34A' });
            expect(getConfidenceGrade(0.84)).toEqual({ grade: 'B', label: 'Good', color: '#8BC34A' });
        });

        it('should return C grade for score >= 0.55 and < 0.7', () => {
            expect(getConfidenceGrade(0.55)).toEqual({ grade: 'C', label: 'Fair', color: '#FFC107' });
            expect(getConfidenceGrade(0.69)).toEqual({ grade: 'C', label: 'Fair', color: '#FFC107' });
        });

        it('should return D grade for score >= 0.4 and < 0.55', () => {
            expect(getConfidenceGrade(0.4)).toEqual({ grade: 'D', label: 'Poor', color: '#FF9800' });
            expect(getConfidenceGrade(0.54)).toEqual({ grade: 'D', label: 'Poor', color: '#FF9800' });
        });

        it('should return F grade for score < 0.4', () => {
            expect(getConfidenceGrade(0.39)).toEqual({ grade: 'F', label: 'Fail', color: '#F44336' });
            expect(getConfidenceGrade(0.0)).toEqual({ grade: 'F', label: 'Fail', color: '#F44336' });
            expect(getConfidenceGrade(0.1)).toEqual({ grade: 'F', label: 'Fail', color: '#F44336' });
        });

        it('should return correct grade at boundary values', () => {
            expect(getConfidenceGrade(0.849).grade).toBe('B');
            expect(getConfidenceGrade(0.85).grade).toBe('A');
            expect(getConfidenceGrade(0.699).grade).toBe('C');
            expect(getConfidenceGrade(0.7).grade).toBe('B');
        });
    });

    describe('describeScoringConfig', () => {
        it('should include weight values', () => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
            const desc = describeScoringConfig();

            expect(desc).toContain('SSIM=0.35');
            expect(desc).toContain('NCC=0.25');
            expect(desc).toContain('Hist=0.25');
            expect(desc).toContain('Edge=0.15');
        });

        it('should indicate agreement status', () => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
            expect(describeScoringConfig()).toContain('Agreement: ON');

            setScoringConfig(FAST_SCORING_CONFIG);
            expect(describeScoringConfig()).toContain('Agreement: OFF');
        });

        it('should include base threshold', () => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
            const desc = describeScoringConfig();
            expect(desc).toContain(`Base threshold: ${DEFAULT_SCORING_CONFIG.baseThreshold}`);
        });

        it('should include rarity adjustments', () => {
            setScoringConfig(DEFAULT_SCORING_CONFIG);
            const desc = describeScoringConfig();
            expect(desc).toContain('Common=');
            expect(desc).toContain('Legendary=');
        });

        it('should reflect current config', () => {
            setScoringConfig(PRECISION_SCORING_CONFIG);
            const desc = describeScoringConfig();
            expect(desc).toContain('SSIM=0.4');
            expect(desc).toContain(`Base threshold: ${PRECISION_SCORING_CONFIG.baseThreshold}`);
        });
    });

    describe('mergeWithDefaults', () => {
        it('should return default config when given empty object', () => {
            const merged = mergeWithDefaults({});
            expect(merged).toEqual(DEFAULT_SCORING_CONFIG);
        });

        it('should override baseThreshold', () => {
            const merged = mergeWithDefaults({ baseThreshold: 0.6 });
            expect(merged.baseThreshold).toBe(0.6);
            expect(merged.weights).toEqual(DEFAULT_SCORING_CONFIG.weights);
        });

        it('should partially override weights', () => {
            const merged = mergeWithDefaults({
                weights: { ssim: 0.5 } as MetricWeights,
            });
            expect(merged.weights.ssim).toBe(0.5);
            expect(merged.weights.ncc).toBe(DEFAULT_SCORING_CONFIG.weights.ncc);
            expect(merged.weights.histogram).toBe(DEFAULT_SCORING_CONFIG.weights.histogram);
            expect(merged.weights.edge).toBe(DEFAULT_SCORING_CONFIG.weights.edge);
        });

        it('should partially override agreement config', () => {
            const merged = mergeWithDefaults({
                agreement: { enabled: false } as AgreementConfig,
            });
            expect(merged.agreement.enabled).toBe(false);
            expect(merged.agreement.threshold).toBe(DEFAULT_SCORING_CONFIG.agreement.threshold);
            expect(merged.agreement.maxBonus).toBe(DEFAULT_SCORING_CONFIG.agreement.maxBonus);
        });

        it('should partially override rarity thresholds', () => {
            const merged = mergeWithDefaults({
                rarityThresholds: { legendary: -0.1 } as RarityThresholds,
            });
            expect(merged.rarityThresholds.legendary).toBe(-0.1);
            expect(merged.rarityThresholds.common).toBe(DEFAULT_SCORING_CONFIG.rarityThresholds.common);
        });

        it('should override minConfidence and maxConfidence', () => {
            const merged = mergeWithDefaults({
                minConfidence: 0.2,
                maxConfidence: 0.9,
            });
            expect(merged.minConfidence).toBe(0.2);
            expect(merged.maxConfidence).toBe(0.9);
        });

        it('should handle multiple partial overrides', () => {
            const merged = mergeWithDefaults({
                baseThreshold: 0.5,
                weights: { ssim: 0.6 } as MetricWeights,
                agreement: { enabled: false } as AgreementConfig,
                minConfidence: 0.25,
            });

            expect(merged.baseThreshold).toBe(0.5);
            expect(merged.weights.ssim).toBe(0.6);
            expect(merged.weights.ncc).toBe(DEFAULT_SCORING_CONFIG.weights.ncc);
            expect(merged.agreement.enabled).toBe(false);
            expect(merged.agreement.threshold).toBe(DEFAULT_SCORING_CONFIG.agreement.threshold);
            expect(merged.minConfidence).toBe(0.25);
            expect(merged.maxConfidence).toBe(DEFAULT_SCORING_CONFIG.maxConfidence);
        });

        it('should not mutate the default config', () => {
            const originalWeights = { ...DEFAULT_SCORING_CONFIG.weights };
            mergeWithDefaults({ weights: { ssim: 0.99 } as MetricWeights });
            expect(DEFAULT_SCORING_CONFIG.weights).toEqual(originalWeights);
        });
    });
});
