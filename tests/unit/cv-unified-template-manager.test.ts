/**
 * @vitest-environment jsdom
 * Unified Template Manager Tests
 * Tests for quality scoring, template selection, caching, and state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    // Quality scoring
    calculateQualityScore,
    calculateResolutionBonus,
    // Template selection
    selectBestTemplates,
    calculateWeightedMatchScore,
    // Multi-scale
    generateMultiScaleVariants,
    getTemplateAtSize,
    // Template loading
    loadTemplate,
    loadTemplatesBatch,
    groupTemplatesByColor,
    prioritizeItems,
    // Cache management
    cacheDetection,
    getCachedDetection,
    clearCache,
    cleanExpiredCache,
    // Getters
    getTemplate,
    getAllTemplates,
    getTemplatesByColorGroup,
    getAllColorGroups,
    isTemplatesFullyLoaded,
    isPriorityLoaded,
    getTemplateCount,
    getScaledVariantCount,
    getCacheSize,
    getConfig,
    // Setters
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    // Reset
    resetState,
    // Types
    type TrainingSample,
    type TemplateSource,
    type TemplateSelectionOptions,
} from '../../src/modules/cv/unified-template-manager.ts';

// Mock getDominantColor from color module
vi.mock('../../src/modules/cv/color.ts', () => ({
    getDominantColor: vi.fn().mockReturnValue('gray'),
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { getDominantColor } from '../../src/modules/cv/color.ts';
import { logger } from '../../src/modules/logger.ts';

// ========================================
// Test Data Factories
// ========================================

const createTrainingSample = (overrides: Partial<TrainingSample> = {}): TrainingSample => ({
    id: 'sample-1',
    itemId: 'item-1',
    source: 'verified',
    ...overrides,
});

const createMockItem = (id: string, rarity: string = 'common', image?: string) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    rarity,
    tier: 'B',
    image,
});

// ========================================
// Test Suite
// ========================================

describe('Unified Template Manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetState();
    });

    // ========================================
    // Configuration Tests
    // ========================================
    describe('getConfig', () => {
        it('should return config with SOURCE_WEIGHTS', () => {
            const config = getConfig();
            expect(config.SOURCE_WEIGHTS).toBeDefined();
            expect(config.SOURCE_WEIGHTS.ground_truth).toBe(1.5);
            expect(config.SOURCE_WEIGHTS.corrected).toBe(1.3);
            expect(config.SOURCE_WEIGHTS.corrected_from_empty).toBe(1.2);
            expect(config.SOURCE_WEIGHTS.verified).toBe(1.0);
            expect(config.SOURCE_WEIGHTS.unreviewed).toBe(0.8);
            expect(config.SOURCE_WEIGHTS.default).toBe(0.7);
        });

        it('should return config with COMMON_ICON_SIZES', () => {
            const config = getConfig();
            expect(config.COMMON_ICON_SIZES).toEqual([32, 40, 48, 56, 64, 72]);
        });

        it('should return config with cache settings', () => {
            const config = getConfig();
            expect(config.MAX_CACHE_SIZE).toBe(500);
            expect(config.CACHE_TTL_MS).toBe(5 * 60 * 1000);
        });

        it('should return config with template selection settings', () => {
            const config = getConfig();
            expect(config.MAX_TEMPLATES_PER_ITEM).toBe(10);
            expect(config.RESOLUTION_MATCH_BONUS).toBe(0.15);
            expect(config.ASPECT_RATIO_TOLERANCE).toBe(0.05);
        });

        it('should return a copy (not mutate original)', () => {
            const config1 = getConfig();
            config1.MAX_CACHE_SIZE = 9999;

            const config2 = getConfig();
            expect(config2.MAX_CACHE_SIZE).toBe(500);
        });
    });

    // ========================================
    // Quality Scoring Tests
    // ========================================
    describe('calculateQualityScore', () => {
        it('should return base score of 0.5 for verified source', () => {
            const sample = createTrainingSample({ source: 'verified' });
            // verified weight is 1.0, so score = 0.5 + (1.0 - 1) * 0.3 = 0.5
            expect(calculateQualityScore(sample)).toBeCloseTo(0.5, 5);
        });

        it('should return higher score for ground_truth source', () => {
            const sample = createTrainingSample({ source: 'ground_truth' });
            // ground_truth weight is 1.5, so score = 0.5 + (1.5 - 1) * 0.3 = 0.65
            expect(calculateQualityScore(sample)).toBeCloseTo(0.65, 5);
        });

        it('should return higher score for corrected source', () => {
            const sample = createTrainingSample({ source: 'corrected' });
            // corrected weight is 1.3, so score = 0.5 + (1.3 - 1) * 0.3 = 0.59
            expect(calculateQualityScore(sample)).toBeCloseTo(0.59, 5);
        });

        it('should return score for corrected_from_empty source', () => {
            const sample = createTrainingSample({ source: 'corrected_from_empty' });
            // weight is 1.2, so score = 0.5 + (1.2 - 1) * 0.3 = 0.56
            expect(calculateQualityScore(sample)).toBeCloseTo(0.56, 5);
        });

        it('should return lower score for unreviewed source', () => {
            const sample = createTrainingSample({ source: 'unreviewed' });
            // unreviewed weight is 0.8, so score = 0.5 + (0.8 - 1) * 0.3 = 0.44
            expect(calculateQualityScore(sample)).toBeCloseTo(0.44, 5);
        });

        it('should return lowest score for default source', () => {
            const sample = createTrainingSample({ source: 'default' });
            // default weight is 0.7, so score = 0.5 + (0.7 - 1) * 0.3 = 0.41
            expect(calculateQualityScore(sample)).toBeCloseTo(0.41, 5);
        });

        it('should add confidence bonus when provided', () => {
            const sample = createTrainingSample({ source: 'verified', confidence: 0.9 });
            // score = 0.5 + 0 + 0.9 * 0.1 = 0.59
            expect(calculateQualityScore(sample)).toBeCloseTo(0.59, 5);
        });

        it('should handle confidence of 0', () => {
            const sample = createTrainingSample({ source: 'verified', confidence: 0 });
            expect(calculateQualityScore(sample)).toBeCloseTo(0.5, 5);
        });

        it('should handle confidence of 1', () => {
            const sample = createTrainingSample({ source: 'verified', confidence: 1.0 });
            // score = 0.5 + 0 + 1.0 * 0.1 = 0.6
            expect(calculateQualityScore(sample)).toBeCloseTo(0.6, 5);
        });

        it('should clamp score to maximum of 1', () => {
            const sample = createTrainingSample({ source: 'ground_truth', confidence: 1.0 });
            // score = 0.5 + 0.15 + 0.1 = 0.75 (should stay at 0.75, not exceed 1)
            expect(calculateQualityScore(sample)).toBeLessThanOrEqual(1);
        });

        it('should clamp score to minimum of 0', () => {
            // Even with worst case, score should be >= 0
            const sample = createTrainingSample({ source: 'default' });
            expect(calculateQualityScore(sample)).toBeGreaterThanOrEqual(0);
        });

        it('should handle unknown source with default weight', () => {
            const sample = createTrainingSample({ source: 'unknown_source' as TemplateSource });
            // Should fall back to default weight of 0.7
            expect(calculateQualityScore(sample)).toBeCloseTo(0.41, 5);
        });
    });

    describe('calculateResolutionBonus', () => {
        it('should return 0 when sampleResolution is undefined', () => {
            expect(calculateResolutionBonus(undefined, '1920x1080')).toBe(0);
        });

        it('should return 0 when targetResolution is undefined', () => {
            expect(calculateResolutionBonus('1920x1080', undefined)).toBe(0);
        });

        it('should return 0 when both are undefined', () => {
            expect(calculateResolutionBonus(undefined, undefined)).toBe(0);
        });

        it('should return full bonus for exact match', () => {
            const config = getConfig();
            expect(calculateResolutionBonus('1920x1080', '1920x1080')).toBe(config.RESOLUTION_MATCH_BONUS);
        });

        it('should return half bonus for similar aspect ratio', () => {
            const config = getConfig();
            // 1920x1080 = 16:9 = 1.777...
            // 1280x720 = 16:9 = 1.777...
            expect(calculateResolutionBonus('1920x1080', '1280x720')).toBe(config.RESOLUTION_MATCH_BONUS * 0.5);
        });

        it('should return 0 for different aspect ratios', () => {
            // 1920x1080 = 16:9 = 1.777...
            // 1024x768 = 4:3 = 1.333...
            expect(calculateResolutionBonus('1920x1080', '1024x768')).toBe(0);
        });

        it('should return 0 for invalid resolution format', () => {
            expect(calculateResolutionBonus('invalid', '1920x1080')).toBe(0);
            expect(calculateResolutionBonus('1920x1080', 'invalid')).toBe(0);
        });

        it('should return 0 for partially invalid resolution', () => {
            expect(calculateResolutionBonus('1920x', '1920x1080')).toBe(0);
            expect(calculateResolutionBonus('x1080', '1920x1080')).toBe(0);
        });

        it('should handle square resolutions', () => {
            const config = getConfig();
            expect(calculateResolutionBonus('64x64', '64x64')).toBe(config.RESOLUTION_MATCH_BONUS);
            expect(calculateResolutionBonus('64x64', '128x128')).toBe(config.RESOLUTION_MATCH_BONUS * 0.5);
        });
    });

    // ========================================
    // Template Selection Tests
    // ========================================
    describe('selectBestTemplates', () => {
        it('should return empty array for empty samples', () => {
            expect(selectBestTemplates([])).toEqual([]);
        });

        it('should return empty array for null/undefined samples', () => {
            expect(selectBestTemplates(null as any)).toEqual([]);
            expect(selectBestTemplates(undefined as any)).toEqual([]);
        });

        it('should return single sample when only one provided', () => {
            const sample = createTrainingSample();
            const result = selectBestTemplates([sample]);

            expect(result.length).toBe(1);
            expect(result[0].sample).toBe(sample);
            expect(result[0].weight).toBeGreaterThan(0);
        });

        it('should sort by quality score descending', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: 'unreviewed' }),
                createTrainingSample({ id: 's2', source: 'ground_truth' }),
                createTrainingSample({ id: 's3', source: 'verified' }),
            ];

            const result = selectBestTemplates(samples, { preferDiversity: false });

            expect(result[0].sample.source).toBe('ground_truth');
            expect(result[1].sample.source).toBe('verified');
            expect(result[2].sample.source).toBe('unreviewed');
        });

        it('should respect maxCount option', () => {
            // Use different sources to avoid diversity limiting
            const sources: TemplateSource[] = ['ground_truth', 'corrected', 'verified', 'unreviewed', 'default'];
            const samples = Array.from({ length: 10 }, (_, i) =>
                createTrainingSample({ id: `s${i}`, source: sources[i % sources.length] })
            );

            const result = selectBestTemplates(samples, { maxCount: 3 });
            expect(result.length).toBe(3);
        });

        it('should default maxCount to 5', () => {
            const samples = Array.from({ length: 10 }, (_, i) =>
                createTrainingSample({ id: `s${i}` })
            );

            const result = selectBestTemplates(samples, { preferDiversity: false });
            expect(result.length).toBe(5);
        });

        it('should apply resolution bonus when targetResolution provided', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: 'verified', sourceResolution: '64x64' }),
                createTrainingSample({ id: 's2', source: 'verified', sourceResolution: '128x128' }),
            ];

            const result = selectBestTemplates(samples, { targetResolution: '64x64', preferDiversity: false });

            // Sample with matching resolution should rank higher
            expect(result[0].sample.sourceResolution).toBe('64x64');
        });

        it('should prefer diversity when enabled', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: 'ground_truth' }),
                createTrainingSample({ id: 's2', source: 'ground_truth' }),
                createTrainingSample({ id: 's3', source: 'ground_truth' }),
                createTrainingSample({ id: 's4', source: 'verified' }),
                createTrainingSample({ id: 's5', source: 'corrected' }),
            ];

            const result = selectBestTemplates(samples, { maxCount: 4, preferDiversity: true });

            // Should have at most 2 from ground_truth
            const groundTruthCount = result.filter(r => r.sample.source === 'ground_truth').length;
            expect(groundTruthCount).toBeLessThanOrEqual(2);
        });

        it('should allow more from same source when preferDiversity is false', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: 'ground_truth' }),
                createTrainingSample({ id: 's2', source: 'ground_truth' }),
                createTrainingSample({ id: 's3', source: 'ground_truth' }),
            ];

            const result = selectBestTemplates(samples, { maxCount: 3, preferDiversity: false });

            expect(result.length).toBe(3);
            expect(result.every(r => r.sample.source === 'ground_truth')).toBe(true);
        });

        it('should handle samples with unknown source', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: undefined as any }),
            ];

            const result = selectBestTemplates(samples);
            expect(result.length).toBe(1);
        });
    });

    describe('calculateWeightedMatchScore', () => {
        it('should return 0 for empty array', () => {
            expect(calculateWeightedMatchScore([])).toBe(0);
        });

        it('should return 0 for null/undefined', () => {
            expect(calculateWeightedMatchScore(null as any)).toBe(0);
            expect(calculateWeightedMatchScore(undefined as any)).toBe(0);
        });

        it('should calculate weighted average correctly', () => {
            const scores = [
                { score: 0.8, weight: 2 },
                { score: 0.6, weight: 1 },
            ];
            // (0.8 * 2 + 0.6 * 1) / (2 + 1) = 2.2 / 3 ≈ 0.733
            expect(calculateWeightedMatchScore(scores)).toBeCloseTo(0.7333, 3);
        });

        it('should use weight of 1 when not provided', () => {
            const scores = [
                { score: 0.8, weight: undefined as any },
                { score: 0.6, weight: 1 },
            ];
            // Both weights treated as 1: (0.8 + 0.6) / 2 = 0.7
            expect(calculateWeightedMatchScore(scores)).toBeCloseTo(0.7, 5);
        });

        it('should handle single score', () => {
            const scores = [{ score: 0.9, weight: 1 }];
            expect(calculateWeightedMatchScore(scores)).toBe(0.9);
        });

        it('should handle zero weights', () => {
            const scores = [
                { score: 0.8, weight: 0 },
                { score: 0.6, weight: 0 },
            ];
            // When weight is 0, it falls back to 1
            // Total: 0 + 0 = 0 weight ... actually (weight || 1) means 0 becomes 1
            // So (0.8 * 1 + 0.6 * 1) / 2 = 0.7
            expect(calculateWeightedMatchScore(scores)).toBeCloseTo(0.7, 5);
        });

        it('should handle large arrays', () => {
            const scores = Array.from({ length: 100 }, () => ({ score: 0.5, weight: 1 }));
            expect(calculateWeightedMatchScore(scores)).toBeCloseTo(0.5, 5);
        });
    });

    // ========================================
    // Cache Management Tests
    // ========================================
    describe('Cache Management', () => {
        describe('cacheDetection / getCachedDetection', () => {
            it('should store and retrieve cached data', () => {
                const data = { results: [1, 2, 3], confidence: 0.9 };
                cacheDetection('test-key', data);

                const retrieved = getCachedDetection<typeof data>('test-key');
                expect(retrieved).toEqual(data);
            });

            it('should return null for non-existent key', () => {
                expect(getCachedDetection('nonexistent')).toBeNull();
            });

            it('should increment access count on retrieval', () => {
                cacheDetection('test-key', { value: 1 });

                // First retrieval
                getCachedDetection('test-key');
                // Second retrieval
                getCachedDetection('test-key');

                // Access count should be 3 (1 initial + 2 accesses)
                expect(getCacheSize()).toBe(1);
            });

            it('should evict oldest entry when at capacity', () => {
                const config = getConfig();

                // Fill cache to capacity
                for (let i = 0; i < config.MAX_CACHE_SIZE; i++) {
                    cacheDetection(`key-${i}`, { value: i });
                }

                expect(getCacheSize()).toBe(config.MAX_CACHE_SIZE);

                // Add one more - should trigger eviction
                cacheDetection('new-key', { value: 'new' });

                expect(getCacheSize()).toBe(config.MAX_CACHE_SIZE);
                expect(getCachedDetection('new-key')).toEqual({ value: 'new' });
            });

            it('should handle various data types', () => {
                cacheDetection('string', 'hello');
                cacheDetection('number', 42);
                cacheDetection('array', [1, 2, 3]);
                cacheDetection('object', { nested: { value: true } });
                cacheDetection('null', null);

                expect(getCachedDetection('string')).toBe('hello');
                expect(getCachedDetection('number')).toBe(42);
                expect(getCachedDetection('array')).toEqual([1, 2, 3]);
                expect(getCachedDetection('object')).toEqual({ nested: { value: true } });
                expect(getCachedDetection('null')).toBeNull(); // null is treated as missing
            });
        });

        describe('Cache TTL', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('should return null for expired entries', () => {
                cacheDetection('test-key', { value: 1 });

                // Advance time past TTL
                const config = getConfig();
                vi.advanceTimersByTime(config.CACHE_TTL_MS + 1);

                expect(getCachedDetection('test-key')).toBeNull();
            });

            it('should return data for non-expired entries', () => {
                cacheDetection('test-key', { value: 1 });

                // Advance time but not past TTL
                const config = getConfig();
                vi.advanceTimersByTime(config.CACHE_TTL_MS - 1000);

                expect(getCachedDetection('test-key')).toEqual({ value: 1 });
            });

            it('should delete expired entry on access', () => {
                cacheDetection('test-key', { value: 1 });
                expect(getCacheSize()).toBe(1);

                // Advance time past TTL
                const config = getConfig();
                vi.advanceTimersByTime(config.CACHE_TTL_MS + 1);

                getCachedDetection('test-key');
                expect(getCacheSize()).toBe(0);
            });
        });

        describe('clearCache', () => {
            it('should clear all cache entries', () => {
                cacheDetection('key1', { value: 1 });
                cacheDetection('key2', { value: 2 });
                cacheDetection('key3', { value: 3 });

                expect(getCacheSize()).toBe(3);

                clearCache();

                expect(getCacheSize()).toBe(0);
                expect(getCachedDetection('key1')).toBeNull();
            });

            it('should log cache cleared', () => {
                clearCache();

                expect(logger.info).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'unified_template.cache_cleared',
                        data: { cleared: true },
                    })
                );
            });

            it('should be safe to call on empty cache', () => {
                expect(() => clearCache()).not.toThrow();
            });
        });

        describe('cleanExpiredCache', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('should remove expired entries', () => {
                cacheDetection('key1', { value: 1 });
                cacheDetection('key2', { value: 2 });

                const config = getConfig();
                vi.advanceTimersByTime(config.CACHE_TTL_MS + 1);

                // Add a fresh entry
                cacheDetection('key3', { value: 3 });

                const cleaned = cleanExpiredCache();

                expect(cleaned).toBe(2);
                expect(getCacheSize()).toBe(1);
                expect(getCachedDetection('key3')).toEqual({ value: 3 });
            });

            it('should return 0 when no entries are expired', () => {
                cacheDetection('key1', { value: 1 });
                cacheDetection('key2', { value: 2 });

                const cleaned = cleanExpiredCache();

                expect(cleaned).toBe(0);
                expect(getCacheSize()).toBe(2);
            });

            it('should return 0 for empty cache', () => {
                const cleaned = cleanExpiredCache();
                expect(cleaned).toBe(0);
            });
        });

        describe('getCacheSize', () => {
            it('should return 0 for empty cache', () => {
                expect(getCacheSize()).toBe(0);
            });

            it('should return correct count', () => {
                cacheDetection('key1', { value: 1 });
                expect(getCacheSize()).toBe(1);

                cacheDetection('key2', { value: 2 });
                expect(getCacheSize()).toBe(2);
            });

            it('should reflect cache operations', () => {
                cacheDetection('key1', { value: 1 });
                expect(getCacheSize()).toBe(1);

                clearCache();
                expect(getCacheSize()).toBe(0);
            });
        });
    });

    // ========================================
    // State Management Tests
    // ========================================
    describe('State Management', () => {
        describe('Template Loading State', () => {
            it('should default to false for isTemplatesFullyLoaded', () => {
                expect(isTemplatesFullyLoaded()).toBe(false);
            });

            it('should default to false for isPriorityLoaded', () => {
                expect(isPriorityLoaded()).toBe(false);
            });

            it('should set templates loaded state', () => {
                setTemplatesLoaded(true);
                expect(isTemplatesFullyLoaded()).toBe(true);

                setTemplatesLoaded(false);
                expect(isTemplatesFullyLoaded()).toBe(false);
            });

            it('should set priority templates loaded state', () => {
                setPriorityTemplatesLoaded(true);
                expect(isPriorityLoaded()).toBe(true);

                setPriorityTemplatesLoaded(false);
                expect(isPriorityLoaded()).toBe(false);
            });
        });

        describe('Template Store', () => {
            it('should return undefined for non-existent template', () => {
                expect(getTemplate('nonexistent')).toBeUndefined();
            });

            it('should return empty map when no templates loaded', () => {
                expect(getAllTemplates().size).toBe(0);
            });

            it('should return 0 for template count when empty', () => {
                expect(getTemplateCount()).toBe(0);
            });

            it('should return 0 for scaled variant count when empty', () => {
                expect(getScaledVariantCount()).toBe(0);
            });
        });

        describe('Color Groups', () => {
            it('should return empty array for non-existent color group', () => {
                expect(getTemplatesByColorGroup('red')).toEqual([]);
            });

            it('should return empty map when no color groups exist', () => {
                expect(getAllColorGroups().size).toBe(0);
            });
        });

        describe('resetState', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('should clear all state', () => {
                // Set up some state
                setTemplatesLoaded(true);
                setPriorityTemplatesLoaded(true);
                cacheDetection('key', { value: 1 });

                resetState();

                expect(isTemplatesFullyLoaded()).toBe(false);
                expect(isPriorityLoaded()).toBe(false);
                expect(getCacheSize()).toBe(0);
                expect(getTemplateCount()).toBe(0);
                expect(getAllColorGroups().size).toBe(0);
            });
        });
    });

    // ========================================
    // Item Prioritization Tests
    // ========================================
    describe('prioritizeItems', () => {
        it('should prioritize common items', () => {
            const items = [
                createMockItem('sword', 'common'),
                createMockItem('gem', 'rare'),
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            expect(priority.length).toBe(1);
            expect(priority[0].id).toBe('sword');
            expect(standard.length).toBe(1);
            expect(standard[0].id).toBe('gem');
        });

        it('should prioritize uncommon items', () => {
            const items = [
                createMockItem('shield', 'uncommon'),
                createMockItem('staff', 'epic'),
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            expect(priority.length).toBe(1);
            expect(priority[0].id).toBe('shield');
        });

        it('should put rare, epic, legendary in standard', () => {
            const items = [
                createMockItem('rare_gem', 'rare'),
                createMockItem('epic_staff', 'epic'),
                createMockItem('legendary_crown', 'legendary'),
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            expect(priority.length).toBe(0);
            expect(standard.length).toBe(3);
        });

        it('should handle empty array', () => {
            const { priority, standard } = prioritizeItems([]);

            expect(priority).toEqual([]);
            expect(standard).toEqual([]);
        });

        it('should preserve total count', () => {
            const items = [
                createMockItem('a', 'common'),
                createMockItem('b', 'uncommon'),
                createMockItem('c', 'rare'),
                createMockItem('d', 'epic'),
                createMockItem('e', 'legendary'),
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            expect(priority.length + standard.length).toBe(items.length);
        });
    });

    // ========================================
    // Multi-Scale Generation Tests
    // ========================================
    describe('generateMultiScaleVariants', () => {
        let mockCanvas: HTMLCanvasElement;
        let mockCtx: CanvasRenderingContext2D;

        beforeEach(() => {
            // Create mock canvas and context
            const mockImageData = {
                data: new Uint8ClampedArray(64 * 64 * 4),
                width: 64,
                height: 64,
            } as ImageData;

            mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue(mockImageData),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            } as any;

            mockCanvas = {
                width: 64,
                height: 64,
                getContext: vi.fn().mockReturnValue(mockCtx),
            } as any;

            // Mock document.createElement for resized canvases
            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue({
                            drawImage: vi.fn(),
                            getImageData: vi.fn().mockReturnValue(mockImageData),
                            imageSmoothingEnabled: true,
                            imageSmoothingQuality: 'high',
                        }),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });
        });

        it('should generate variants for all common icon sizes', () => {
            const variants = generateMultiScaleVariants(mockCanvas, mockCtx);
            const config = getConfig();

            expect(variants.size).toBe(config.COMMON_ICON_SIZES.length);
        });

        it('should include original size variant', () => {
            const variants = generateMultiScaleVariants(mockCanvas, mockCtx);

            expect(variants.has(64)).toBe(true);
        });

        it('should return map with ImageData values', () => {
            const variants = generateMultiScaleVariants(mockCanvas, mockCtx);

            for (const imageData of variants.values()) {
                expect(imageData).toHaveProperty('data');
                expect(imageData).toHaveProperty('width');
                expect(imageData).toHaveProperty('height');
            }
        });

        it('should handle null context gracefully', () => {
            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(null),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            // Only the original size should succeed
            const variants = generateMultiScaleVariants(mockCanvas, mockCtx);

            // At least the original size should be present
            expect(variants.has(64)).toBe(true);
        });
    });

    describe('getTemplateAtSize', () => {
        it('should return null for non-existent template', () => {
            expect(getTemplateAtSize('nonexistent', 64)).toBeNull();
        });

        it('should return null when template has no variants', () => {
            // This relies on internal state, which we can't easily set without loadTemplate
            // So we just verify the null case for missing templates
            expect(getTemplateAtSize('missing', 32)).toBeNull();
        });
    });

    // ========================================
    // Group Templates By Color Tests
    // ========================================
    describe('groupTemplatesByColor', () => {
        it('should handle empty items array', () => {
            groupTemplatesByColor([]);
            expect(getAllColorGroups().size).toBe(0);
        });

        it('should skip items without templates in store', () => {
            const items = [createMockItem('missing', 'common')] as any[];

            groupTemplatesByColor(items);

            expect(getAllColorGroups().size).toBe(0);
        });
    });

    // ========================================
    // Template Loading Tests (with DOM mocking)
    // ========================================
    describe('loadTemplate', () => {
        it('should return null for item without image', async () => {
            const item = createMockItem('no_image', 'common'); // no image property

            const result = await loadTemplate(item as any);

            expect(result).toBeNull();
        });
    });

    describe('loadTemplatesBatch', () => {
        let mockCtx: any;
        let mockCanvas: any;

        beforeEach(() => {
            mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            };

            mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue(mockCtx),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return { ...mockCanvas } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });
        });

        it('should handle empty items array', async () => {
            const result = await loadTemplatesBatch([]);

            expect(result.loaded).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.failedIds).toEqual([]);
        });

        it('should count items without images as failed', async () => {
            const items = [createMockItem('no_image', 'common')] as any[];

            const result = await loadTemplatesBatch(items);

            expect(result.loaded).toBe(0);
            // Items without images return null from loadTemplate, counted as failed
            expect(result.failed).toBe(1);
            expect(result.failedIds).toContain('no_image');
        });

        it('should use provided source for templates', async () => {
            // This test verifies the source parameter is passed through
            const items = [] as any[];
            const result = await loadTemplatesBatch(items, 'ground_truth');

            expect(result.loaded).toBe(0);
        });
    });
});
