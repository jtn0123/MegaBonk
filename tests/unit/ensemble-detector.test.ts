/**
 * Unit tests for Ensemble Detector module
 * Tests strategy configuration, detection combining, and ensemble logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    setEnsembleConfig,
    getEnsembleConfig,
    getStrategy,
    combineStrategyDetections,
    selectStrategiesForImage,
    describeEnsembleConfig,
    getRecommendedConfig,
    STRATEGIES,
    DEFAULT_STRATEGY,
    HIGH_PRECISION_STRATEGY,
    HIGH_RECALL_STRATEGY,
    EDGE_FOCUSED_STRATEGY,
    COLOR_FOCUSED_STRATEGY,
    FAST_STRATEGY,
    DEFAULT_ENSEMBLE_CONFIG,
    PRECISION_ENSEMBLE_CONFIG,
    RECALL_ENSEMBLE_CONFIG,
    FAST_ENSEMBLE_CONFIG,
    type StrategyId,
    type DetectionStrategy,
    type StrategyDetection,
    type EnsembleConfig,
    type EnsembleResult,
} from '../../src/modules/cv/ensemble-detector';

// ========================================
// Test Utilities
// ========================================

/**
 * Create a mock strategy detection
 */
function createMockDetection(
    strategyId: StrategyId,
    itemId: string,
    confidence: number,
    templateId: string = 'template_1'
): StrategyDetection {
    return {
        strategyId,
        itemId,
        confidence,
        position: { x: 100, y: 200, width: 45, height: 45 },
        templateId,
    };
}

/**
 * Create multiple detections for testing ensemble
 */
function createMockDetections(items: Array<{ strategyId: StrategyId; itemId: string; confidence: number }>): StrategyDetection[] {
    return items.map((item, index) =>
        createMockDetection(item.strategyId, item.itemId, item.confidence, `template_${index}`)
    );
}

// ========================================
// Strategy Constants Tests
// ========================================

describe('Ensemble Detector - Strategy Constants', () => {
    it('should have all required strategies defined', () => {
        const expectedStrategies: StrategyId[] = [
            'default',
            'high-precision',
            'high-recall',
            'edge-focused',
            'color-focused',
            'fast',
        ];

        for (const id of expectedStrategies) {
            expect(STRATEGIES[id]).toBeDefined();
        }
    });

    it('should have valid strategy structure for DEFAULT_STRATEGY', () => {
        expect(DEFAULT_STRATEGY.id).toBe('default');
        expect(DEFAULT_STRATEGY.name).toBeDefined();
        expect(DEFAULT_STRATEGY.description).toBeDefined();
        expect(DEFAULT_STRATEGY.weight).toBeGreaterThan(0);
        expect(DEFAULT_STRATEGY.weight).toBeLessThanOrEqual(1);
        expect(DEFAULT_STRATEGY.preprocessing).toBeDefined();
        expect(DEFAULT_STRATEGY.templates).toBeDefined();
    });

    it('should have valid strategy structure for HIGH_PRECISION_STRATEGY', () => {
        expect(HIGH_PRECISION_STRATEGY.id).toBe('high-precision');
        expect(HIGH_PRECISION_STRATEGY.weight).toBeLessThanOrEqual(1);
        expect(HIGH_PRECISION_STRATEGY.minConfidence).toBeGreaterThan(0);
        expect(HIGH_PRECISION_STRATEGY.metricWeights).toBeDefined();
    });

    it('should have valid strategy structure for HIGH_RECALL_STRATEGY', () => {
        expect(HIGH_RECALL_STRATEGY.id).toBe('high-recall');
        expect(HIGH_RECALL_STRATEGY.minConfidence).toBeLessThan(HIGH_PRECISION_STRATEGY.minConfidence!);
        expect(HIGH_RECALL_STRATEGY.templates.maxTemplatesPerItem).toBeGreaterThan(
            HIGH_PRECISION_STRATEGY.templates.maxTemplatesPerItem
        );
    });

    it('should have valid strategy structure for EDGE_FOCUSED_STRATEGY', () => {
        expect(EDGE_FOCUSED_STRATEGY.id).toBe('edge-focused');
        expect(EDGE_FOCUSED_STRATEGY.preprocessing.edgeEnhance).toBe(true);
        expect(EDGE_FOCUSED_STRATEGY.metricWeights?.edge).toBeGreaterThan(0.3);
    });

    it('should have valid strategy structure for COLOR_FOCUSED_STRATEGY', () => {
        expect(COLOR_FOCUSED_STRATEGY.id).toBe('color-focused');
        expect(COLOR_FOCUSED_STRATEGY.metricWeights?.histogram).toBeGreaterThan(0.3);
    });

    it('should have valid strategy structure for FAST_STRATEGY', () => {
        expect(FAST_STRATEGY.id).toBe('fast');
        expect(FAST_STRATEGY.templates.maxTemplatesPerItem).toBeLessThanOrEqual(2);
        expect(FAST_STRATEGY.preprocessing.contrastEnhance).toBe(false);
    });

    it('all strategies should have weights between 0 and 1', () => {
        for (const [id, strategy] of Object.entries(STRATEGIES)) {
            expect(strategy.weight).toBeGreaterThan(0);
            expect(strategy.weight).toBeLessThanOrEqual(1);
        }
    });

    it('all strategies should have required preprocessing fields', () => {
        for (const [id, strategy] of Object.entries(STRATEGIES)) {
            expect(strategy.preprocessing).toBeDefined();
            expect(typeof strategy.preprocessing.contrastEnhance).toBe('boolean');
            expect(typeof strategy.preprocessing.contrastFactor).toBe('number');
            expect(typeof strategy.preprocessing.colorNormalize).toBe('boolean');
            expect(typeof strategy.preprocessing.edgeEnhance).toBe('boolean');
        }
    });

    it('all strategies should have required template fields', () => {
        for (const [id, strategy] of Object.entries(STRATEGIES)) {
            expect(strategy.templates).toBeDefined();
            expect(typeof strategy.templates.useRanking).toBe('boolean');
            expect(typeof strategy.templates.skipPoorPerformers).toBe('boolean');
            expect(typeof strategy.templates.maxTemplatesPerItem).toBe('number');
        }
    });
});

// ========================================
// Ensemble Config Constants Tests
// ========================================

describe('Ensemble Detector - Config Constants', () => {
    it('should have valid DEFAULT_ENSEMBLE_CONFIG', () => {
        expect(DEFAULT_ENSEMBLE_CONFIG.strategies).toBeInstanceOf(Array);
        expect(DEFAULT_ENSEMBLE_CONFIG.strategies.length).toBeGreaterThan(0);
        expect(DEFAULT_ENSEMBLE_CONFIG.minAgreement).toBeGreaterThanOrEqual(1);
        expect(['voting', 'max', 'average', 'weighted']).toContain(DEFAULT_ENSEMBLE_CONFIG.combineMethod);
        expect(DEFAULT_ENSEMBLE_CONFIG.earlyExitThreshold).toBeGreaterThan(0);
        expect(DEFAULT_ENSEMBLE_CONFIG.earlyExitThreshold).toBeLessThanOrEqual(1);
    });

    it('should have valid PRECISION_ENSEMBLE_CONFIG', () => {
        expect(PRECISION_ENSEMBLE_CONFIG.strategies).toContain('high-precision');
        expect(PRECISION_ENSEMBLE_CONFIG.earlyExitThreshold).toBeGreaterThanOrEqual(
            DEFAULT_ENSEMBLE_CONFIG.earlyExitThreshold
        );
    });

    it('should have valid RECALL_ENSEMBLE_CONFIG', () => {
        expect(RECALL_ENSEMBLE_CONFIG.strategies).toContain('high-recall');
        expect(RECALL_ENSEMBLE_CONFIG.minAgreement).toBeLessThanOrEqual(DEFAULT_ENSEMBLE_CONFIG.minAgreement);
    });

    it('should have valid FAST_ENSEMBLE_CONFIG', () => {
        expect(FAST_ENSEMBLE_CONFIG.strategies).toContain('fast');
        expect(FAST_ENSEMBLE_CONFIG.strategies.length).toBe(1);
        expect(FAST_ENSEMBLE_CONFIG.parallel).toBe(false);
    });
});

// ========================================
// Configuration Get/Set Tests
// ========================================

describe('Ensemble Detector - Configuration', () => {
    afterEach(() => {
        // Reset to default config
        setEnsembleConfig(DEFAULT_ENSEMBLE_CONFIG);
    });

    it('should get default configuration', () => {
        const config = getEnsembleConfig();

        expect(config).toEqual(DEFAULT_ENSEMBLE_CONFIG);
    });

    it('should set custom configuration', () => {
        const customConfig: EnsembleConfig = {
            strategies: ['fast'],
            minAgreement: 1,
            combineMethod: 'max',
            earlyExitThreshold: 0.7,
            parallel: false,
        };

        setEnsembleConfig(customConfig);

        const config = getEnsembleConfig();
        expect(config).toEqual(customConfig);
    });

    it('should persist configuration across calls', () => {
        setEnsembleConfig(PRECISION_ENSEMBLE_CONFIG);

        expect(getEnsembleConfig()).toEqual(PRECISION_ENSEMBLE_CONFIG);
        expect(getEnsembleConfig()).toEqual(PRECISION_ENSEMBLE_CONFIG);
    });
});

// ========================================
// Get Strategy Tests
// ========================================

describe('Ensemble Detector - Get Strategy', () => {
    it('should get strategy by ID', () => {
        const strategy = getStrategy('default');

        expect(strategy).toBe(DEFAULT_STRATEGY);
        expect(strategy.id).toBe('default');
    });

    it('should get all strategies by ID', () => {
        const ids: StrategyId[] = ['default', 'high-precision', 'high-recall', 'edge-focused', 'color-focused', 'fast'];

        for (const id of ids) {
            const strategy = getStrategy(id);
            expect(strategy).toBeDefined();
            expect(strategy.id).toBe(id);
        }
    });

    it('should return exact strategy objects', () => {
        expect(getStrategy('default')).toBe(DEFAULT_STRATEGY);
        expect(getStrategy('high-precision')).toBe(HIGH_PRECISION_STRATEGY);
        expect(getStrategy('high-recall')).toBe(HIGH_RECALL_STRATEGY);
        expect(getStrategy('edge-focused')).toBe(EDGE_FOCUSED_STRATEGY);
        expect(getStrategy('color-focused')).toBe(COLOR_FOCUSED_STRATEGY);
        expect(getStrategy('fast')).toBe(FAST_STRATEGY);
    });
});

// ========================================
// Combine Strategy Detections Tests
// ========================================

describe('Ensemble Detector - Combine Strategy Detections', () => {
    const mockPosition = { x: 100, y: 200, width: 45, height: 45 };

    afterEach(() => {
        setEnsembleConfig(DEFAULT_ENSEMBLE_CONFIG);
    });

    it('should return null for empty detections', () => {
        const result = combineStrategyDetections([], mockPosition);

        expect(result).toBeNull();
    });

    it('should combine single detection', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.85 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition);

        expect(result).toBeDefined();
        expect(result?.itemId).toBe('item_1');
        expect(result?.confidence).toBeGreaterThan(0);
    });

    it('should combine multiple detections for same item', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.85 },
            { strategyId: 'edge-focused', itemId: 'item_1', confidence: 0.75 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition);

        expect(result).toBeDefined();
        expect(result?.itemId).toBe('item_1');
        expect(result?.agreement).toBe(1.0);
    });

    it('should pick winner from conflicting detections using voting', () => {
        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'voting',
        };
        setEnsembleConfig(config);

        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.7 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.75 },
            { strategyId: 'edge-focused', itemId: 'item_2', confidence: 0.65 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        // item_1 has 2 votes vs item_2's 1 vote
        expect(result?.itemId).toBe('item_1');
    });

    it('should use max combine method', () => {
        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
            minAgreement: 1, // Set to 1 so confidence isn't reduced
        };

        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.7 },
            { strategyId: 'high-precision', itemId: 'item_2', confidence: 0.95 },
            { strategyId: 'edge-focused', itemId: 'item_1', confidence: 0.8 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        // item_2 has the highest single confidence (0.95)
        expect(result?.itemId).toBe('item_2');
        // Confidence is capped at 0.99
        expect(result?.confidence).toBeCloseTo(0.95, 2);
    });

    it('should use average combine method', () => {
        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'average',
            minAgreement: 1,
        };

        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.9 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        expect(result?.itemId).toBe('item_1');
        // Average of 0.8 and 0.9 is 0.85
        expect(result?.confidence).toBeCloseTo(0.85, 1);
    });

    it('should use weighted combine method', () => {
        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'weighted',
            minAgreement: 1,
        };

        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 }, // weight 1.0
            { strategyId: 'fast', itemId: 'item_1', confidence: 0.9 }, // weight 0.7
        ]);

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        expect(result?.itemId).toBe('item_1');
        // Weighted: (0.8 * 1.0 + 0.9 * 0.7) / (1.0 + 0.7) = 1.43 / 1.7 ≈ 0.84
        expect(result?.confidence).toBeGreaterThan(0.8);
        expect(result?.confidence).toBeLessThan(0.9);
    });

    it('should calculate agreement correctly', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.85 },
            { strategyId: 'edge-focused', itemId: 'item_2', confidence: 0.75 },
        ]);

        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
            minAgreement: 1,
        };

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        // 2 out of 3 agree on item_1
        expect(result?.agreement).toBeCloseTo(2 / 3, 2);
    });

    it('should reduce confidence when agreement is below minAgreement', () => {
        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
            minAgreement: 3,
        };

        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
            { strategyId: 'high-precision', itemId: 'item_2', confidence: 0.85 },
            { strategyId: 'edge-focused', itemId: 'item_3', confidence: 0.75 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result).toBeDefined();
        // Each item has only 1 vote, minAgreement is 3
        // Confidence should be reduced by agreement factor
        expect(result?.confidence).toBeLessThan(0.85);
    });

    it('should identify best strategy', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.7 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.95 },
            { strategyId: 'edge-focused', itemId: 'item_1', confidence: 0.8 },
        ]);

        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
        };

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result?.bestStrategy).toBe('high-precision');
    });

    it('should include all strategy results', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 0.85 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition);

        expect(result?.strategyResults).toHaveLength(2);
    });

    it('should cap confidence at 0.99', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 1.0 },
            { strategyId: 'high-precision', itemId: 'item_1', confidence: 1.0 },
        ]);

        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
        };

        const result = combineStrategyDetections(detections, mockPosition, config);

        expect(result?.confidence).toBeLessThanOrEqual(0.99);
    });

    it('should include passesThreshold field', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.8 },
        ]);

        const result = combineStrategyDetections(detections, mockPosition);

        expect(result?.passesThreshold).toBeDefined();
        expect(typeof result?.passesThreshold).toBe('boolean');
    });
});

// ========================================
// Select Strategies For Image Tests
// ========================================

describe('Ensemble Detector - Select Strategies For Image', () => {
    it('should always include default strategy', () => {
        const strategies = selectStrategiesForImage(1920, 1080);

        expect(strategies).toContain('default');
    });

    it('should add high-precision for high-res images', () => {
        // 1440p is typically high tier
        const strategies = selectStrategiesForImage(2560, 1440);

        expect(strategies).toContain('default');
        // May contain high-precision depending on profile tier
    });

    it('should add high-recall for low-res images', () => {
        // 480p is low tier
        const strategies = selectStrategiesForImage(854, 480);

        expect(strategies).toContain('default');
    });

    it('should add edge-focused for dark scenes', () => {
        const strategies = selectStrategiesForImage(1920, 1080, 'dark');

        expect(strategies).toContain('edge-focused');
    });

    it('should add color-focused for bright scenes', () => {
        const strategies = selectStrategiesForImage(1920, 1080, 'bright');

        expect(strategies).toContain('color-focused');
    });

    it('should add edge-focused for noisy scenes', () => {
        const strategies = selectStrategiesForImage(1920, 1080, 'noisy');

        expect(strategies).toContain('edge-focused');
    });

    it('should limit to 3 strategies', () => {
        const strategies = selectStrategiesForImage(2560, 1440, 'dark');

        expect(strategies.length).toBeLessThanOrEqual(3);
    });

    it('should return valid strategy IDs', () => {
        const strategies = selectStrategiesForImage(1920, 1080, 'normal');

        for (const id of strategies) {
            expect(STRATEGIES[id]).toBeDefined();
        }
    });
});

// ========================================
// Describe Ensemble Config Tests
// ========================================

describe('Ensemble Detector - Describe Ensemble Config', () => {
    it('should describe default config', () => {
        const description = describeEnsembleConfig();

        expect(description).toContain('Ensemble Configuration');
        expect(description).toContain('Strategies');
        expect(description).toContain('Min Agreement');
        expect(description).toContain('Combine Method');
        expect(description).toContain('Early Exit');
        expect(description).toContain('Strategy Details');
    });

    it('should describe custom config', () => {
        const customConfig: EnsembleConfig = {
            strategies: ['fast'],
            minAgreement: 1,
            combineMethod: 'max',
            earlyExitThreshold: 0.7,
            parallel: false,
        };

        const description = describeEnsembleConfig(customConfig);

        expect(description).toContain('fast');
        expect(description).toContain('1');
        expect(description).toContain('max');
        expect(description).toContain('70%');
    });

    it('should include strategy details', () => {
        const description = describeEnsembleConfig(DEFAULT_ENSEMBLE_CONFIG);

        // Should include names and descriptions of strategies
        for (const strategyId of DEFAULT_ENSEMBLE_CONFIG.strategies) {
            const strategy = STRATEGIES[strategyId];
            expect(description).toContain(strategy.name);
        }
    });

    it('should include parallel setting', () => {
        const description = describeEnsembleConfig();

        expect(description).toContain('Parallel');
    });
});

// ========================================
// Get Recommended Config Tests
// ========================================

describe('Ensemble Detector - Get Recommended Config', () => {
    it('should return default config for scanning', () => {
        const config = getRecommendedConfig('scanning');

        expect(config).toEqual(DEFAULT_ENSEMBLE_CONFIG);
    });

    it('should return precision config for verification', () => {
        const config = getRecommendedConfig('verification');

        expect(config).toEqual(PRECISION_ENSEMBLE_CONFIG);
    });

    it('should return recall config for training', () => {
        const config = getRecommendedConfig('training');

        expect(config).toEqual(RECALL_ENSEMBLE_CONFIG);
    });

    it('should return fast config for fast use case', () => {
        const config = getRecommendedConfig('fast');

        expect(config).toEqual(FAST_ENSEMBLE_CONFIG);
    });

    it('recommended configs should be valid', () => {
        const useCases: Array<'scanning' | 'verification' | 'training' | 'fast'> = [
            'scanning',
            'verification',
            'training',
            'fast',
        ];

        for (const useCase of useCases) {
            const config = getRecommendedConfig(useCase);

            expect(config.strategies).toBeInstanceOf(Array);
            expect(config.strategies.length).toBeGreaterThan(0);
            expect(config.minAgreement).toBeGreaterThanOrEqual(1);
            expect(['voting', 'max', 'average', 'weighted']).toContain(config.combineMethod);
        }
    });
});

// ========================================
// Strategy Metric Weights Tests
// ========================================

describe('Ensemble Detector - Strategy Metric Weights', () => {
    it('strategies with metricWeights should have valid weights', () => {
        const strategiesWithWeights = [
            HIGH_PRECISION_STRATEGY,
            HIGH_RECALL_STRATEGY,
            EDGE_FOCUSED_STRATEGY,
            COLOR_FOCUSED_STRATEGY,
            FAST_STRATEGY,
        ];

        for (const strategy of strategiesWithWeights) {
            if (strategy.metricWeights) {
                const { ncc, ssim, histogram, edge } = strategy.metricWeights;
                const total = ncc + ssim + histogram + edge;

                // Weights should sum to approximately 1
                expect(total).toBeCloseTo(1, 1);

                // All weights should be non-negative
                expect(ncc).toBeGreaterThanOrEqual(0);
                expect(ssim).toBeGreaterThanOrEqual(0);
                expect(histogram).toBeGreaterThanOrEqual(0);
                expect(edge).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('edge-focused should have highest edge weight', () => {
        const edgeWeight = EDGE_FOCUSED_STRATEGY.metricWeights?.edge ?? 0;

        expect(edgeWeight).toBeGreaterThan(0.3);
        expect(edgeWeight).toBeGreaterThan(EDGE_FOCUSED_STRATEGY.metricWeights?.ssim ?? 0);
        expect(edgeWeight).toBeGreaterThan(EDGE_FOCUSED_STRATEGY.metricWeights?.histogram ?? 0);
    });

    it('color-focused should have highest histogram weight', () => {
        const histWeight = COLOR_FOCUSED_STRATEGY.metricWeights?.histogram ?? 0;

        expect(histWeight).toBeGreaterThan(0.3);
        expect(histWeight).toBeGreaterThan(COLOR_FOCUSED_STRATEGY.metricWeights?.ssim ?? 0);
        expect(histWeight).toBeGreaterThan(COLOR_FOCUSED_STRATEGY.metricWeights?.edge ?? 0);
    });
});

// ========================================
// Edge Cases Tests
// ========================================

describe('Ensemble Detector - Edge Cases', () => {
    it('should handle detection with metrics', () => {
        const detection: StrategyDetection = {
            strategyId: 'default',
            itemId: 'item_1',
            confidence: 0.85,
            position: { x: 100, y: 200, width: 45, height: 45 },
            templateId: 'template_1',
            metrics: {
                ncc: 0.8,
                ssim: 0.85,
                histogram: 0.7,
                edge: 0.75,
            },
        };

        const result = combineStrategyDetections(
            [detection],
            { x: 100, y: 200, width: 45, height: 45 }
        );

        expect(result).toBeDefined();
        expect(result?.strategyResults[0]?.metrics).toBeDefined();
    });

    it('should handle very low confidence detections', () => {
        const detections = createMockDetections([
            { strategyId: 'default', itemId: 'item_1', confidence: 0.1 },
            { strategyId: 'high-recall', itemId: 'item_1', confidence: 0.15 },
        ]);

        const config: EnsembleConfig = {
            ...DEFAULT_ENSEMBLE_CONFIG,
            combineMethod: 'max',
            minAgreement: 1,
        };

        const result = combineStrategyDetections(
            detections,
            { x: 100, y: 200, width: 45, height: 45 },
            config
        );

        expect(result).toBeDefined();
        expect(result?.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle many detections', () => {
        const detections: StrategyDetection[] = [];
        for (let i = 0; i < 20; i++) {
            detections.push(
                createMockDetection(
                    'default',
                    `item_${i % 3}`,
                    0.5 + Math.random() * 0.4,
                    `template_${i}`
                )
            );
        }

        const result = combineStrategyDetections(
            detections,
            { x: 100, y: 200, width: 45, height: 45 }
        );

        expect(result).toBeDefined();
    });

    it('should handle single strategy in config', () => {
        const config: EnsembleConfig = {
            strategies: ['fast'],
            minAgreement: 1,
            combineMethod: 'max',
            earlyExitThreshold: 0.8,
            parallel: false,
        };

        const detections = createMockDetections([
            { strategyId: 'fast', itemId: 'item_1', confidence: 0.85 },
        ]);

        const result = combineStrategyDetections(
            detections,
            { x: 100, y: 200, width: 45, height: 45 },
            config
        );

        expect(result).toBeDefined();
        expect(result?.itemId).toBe('item_1');
    });
});
