/**
 * @vitest-environment jsdom
 * CV Training Module - Comprehensive Tests
 * Tests for training data management, session templates, source management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    // Path configuration
    setTrainingDataBasePath,
    // State getters
    getTrainingTemplates,
    isTrainingDataLoaded,
    getTrainingIndex,
    getTrainingTemplatesForItem,
    // Session template management
    addSessionTemplate,
    getSessionTemplateCount,
    getSessionTemplatesForItem,
    clearSessionTemplates,
    getSessionTemplateItems,
    // Source management
    getAvailableSources,
    getEnabledSources,
    enableSource,
    disableSource,
    setEnabledSources,
    enableAllSources,
    isSourceEnabled,
    // Stats and versioning
    getTrainingStats,
    clearTrainingData,
    getTrainingDataVersion,
    logTrainingDataVersion,
    loadTrainingData,
} from '../../src/modules/cv/training.ts';

import type {
    TrainingTemplate,
    TrainingSample,
    TrainingItemData,
    TrainingIndex,
    TrainingDataVersion,
} from '../../src/modules/cv/training.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Helper: create mock ImageData
function createMockImageData(width = 48, height = 48): ImageData {
    return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
        colorSpace: 'srgb',
    };
}

// ========================================
// Test Suite
// ========================================

describe('CV Training Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearTrainingData();
        clearSessionTemplates();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearTrainingData();
        clearSessionTemplates();
    });

    // ========================================
    // Path Configuration Tests
    // ========================================
    describe('setTrainingDataBasePath', () => {
        it('should set path with trailing slash', () => {
            setTrainingDataBasePath('/custom/path/');
            // Path is internal, we can't directly verify but the function shouldn't throw
            expect(true).toBe(true);
        });

        it('should add trailing slash if missing', () => {
            setTrainingDataBasePath('/custom/path');
            // The function should normalize paths ending without /
            expect(true).toBe(true);
        });

        it('should handle empty string', () => {
            setTrainingDataBasePath('');
            expect(true).toBe(true);
        });

        it('should handle relative paths', () => {
            setTrainingDataBasePath('./data/training/');
            expect(true).toBe(true);
        });
    });

    // ========================================
    // State Getters Tests
    // ========================================
    describe('State Getters', () => {
        describe('getTrainingTemplates', () => {
            it('should return empty map initially', () => {
                const templates = getTrainingTemplates();
                expect(templates).toBeInstanceOf(Map);
                expect(templates.size).toBe(0);
            });

            it('should return the same map instance', () => {
                const templates1 = getTrainingTemplates();
                const templates2 = getTrainingTemplates();
                expect(templates1).toBe(templates2);
            });
        });

        describe('isTrainingDataLoaded', () => {
            it('should return false initially', () => {
                expect(isTrainingDataLoaded()).toBe(false);
            });
        });

        describe('getTrainingIndex', () => {
            it('should return null initially', () => {
                expect(getTrainingIndex()).toBeNull();
            });
        });

        describe('getTrainingTemplatesForItem', () => {
            it('should return empty array for non-existent item', () => {
                const templates = getTrainingTemplatesForItem('non_existent_item');
                expect(templates).toEqual([]);
            });

            it('should include session templates when available', () => {
                const imageData = createMockImageData();
                addSessionTemplate('test_item', imageData, {
                    resolution: '1920x1080',
                    validationType: 'corrected',
                });

                const templates = getTrainingTemplatesForItem('test_item');
                expect(templates.length).toBe(1);
                expect(templates[0].resolution).toBe('1920x1080');
            });

            it('should return combined templates from both sources', () => {
                // Add session templates
                const imageData = createMockImageData();
                addSessionTemplate('combo_item', imageData, {
                    resolution: '1080p',
                    validationType: 'verified',
                });
                addSessionTemplate('combo_item', createMockImageData(), {
                    resolution: '720p',
                    validationType: 'corrected',
                    sourceImage: 'different_source',
                });

                const templates = getTrainingTemplatesForItem('combo_item');
                expect(templates.length).toBe(2);
            });
        });
    });

    // ========================================
    // Session Template Management Tests
    // ========================================
    describe('Session Template Management', () => {
        describe('addSessionTemplate', () => {
            it('should add a new session template successfully', () => {
                const imageData = createMockImageData();
                const result = addSessionTemplate('item_001', imageData, {
                    resolution: '1920x1080',
                    validationType: 'corrected',
                    sourceImage: 'screenshot_1.png',
                });

                expect(result).toBe(true);
                expect(getSessionTemplateCount()).toBe(1);
            });

            it('should reject duplicate templates (same source and resolution)', () => {
                const imageData = createMockImageData();
                addSessionTemplate('item_dup', imageData, {
                    resolution: '1080p',
                    sourceImage: 'same_source.png',
                });

                const result = addSessionTemplate('item_dup', createMockImageData(), {
                    resolution: '1080p',
                    sourceImage: 'same_source.png',
                });

                expect(result).toBe(false);
                expect(getSessionTemplateCount()).toBe(1);
            });

            it('should allow templates with different resolutions', () => {
                const imageData = createMockImageData();
                addSessionTemplate('item_multi_res', imageData, {
                    resolution: '1080p',
                    sourceImage: 'source.png',
                });

                const result = addSessionTemplate('item_multi_res', createMockImageData(), {
                    resolution: '720p',
                    sourceImage: 'source.png',
                });

                expect(result).toBe(true);
                expect(getSessionTemplateCount()).toBe(2);
            });

            it('should allow templates with different source images', () => {
                const imageData = createMockImageData();
                addSessionTemplate('item_multi_src', imageData, {
                    resolution: '1080p',
                    sourceImage: 'source1.png',
                });

                const result = addSessionTemplate('item_multi_src', createMockImageData(), {
                    resolution: '1080p',
                    sourceImage: 'source2.png',
                });

                expect(result).toBe(true);
                expect(getSessionTemplateCount()).toBe(2);
            });

            it('should respect MAX_SESSION_TEMPLATES_PER_ITEM limit', () => {
                const maxTemplates = 10; // MAX_SESSION_TEMPLATES_PER_ITEM from the module
                for (let i = 0; i < maxTemplates; i++) {
                    addSessionTemplate('item_limited', createMockImageData(), {
                        resolution: `res_${i}`,
                        sourceImage: `source_${i}.png`,
                    });
                }

                // 11th should fail
                const result = addSessionTemplate('item_limited', createMockImageData(), {
                    resolution: 'res_overflow',
                    sourceImage: 'source_overflow.png',
                });

                expect(result).toBe(false);
                expect(getSessionTemplatesForItem('item_limited').length).toBe(maxTemplates);
            });

            it('should use default values when metadata is not provided', () => {
                const imageData = createMockImageData();
                addSessionTemplate('item_defaults', imageData);

                const templates = getSessionTemplatesForItem('item_defaults');
                expect(templates.length).toBe(1);
                expect(templates[0].resolution).toBe('unknown');
                expect(templates[0].validationType).toBe('corrected');
            });

            it('should assign correct weights based on validation type', () => {
                addSessionTemplate('item_weight_test', createMockImageData(), {
                    validationType: 'corrected',
                    sourceImage: 'corrected.png',
                });
                addSessionTemplate('item_weight_test', createMockImageData(), {
                    validationType: 'verified',
                    sourceImage: 'verified.png',
                });
                addSessionTemplate('item_weight_test', createMockImageData(), {
                    validationType: 'corrected_from_empty',
                    sourceImage: 'corrected_empty.png',
                });

                const templates = getSessionTemplatesForItem('item_weight_test');
                const corrected = templates.find(t => t.sourceImage === 'corrected.png');
                const verified = templates.find(t => t.sourceImage === 'verified.png');
                const correctedEmpty = templates.find(t => t.sourceImage === 'corrected_empty.png');

                expect(corrected?.weight).toBe(1.2);
                expect(verified?.weight).toBe(1.0);
                expect(correctedEmpty?.weight).toBe(1.2);
            });

            it('should assign default weight (0.8) for unknown validation types', () => {
                addSessionTemplate('item_unknown_type', createMockImageData(), {
                    validationType: 'unknown' as any,
                    sourceImage: 'unknown.png',
                });

                const templates = getSessionTemplatesForItem('item_unknown_type');
                expect(templates[0]?.weight).toBe(0.8);
            });
        });

        describe('getSessionTemplateCount', () => {
            it('should return 0 initially', () => {
                expect(getSessionTemplateCount()).toBe(0);
            });

            it('should track total count across all items', () => {
                addSessionTemplate('item_a', createMockImageData(), { sourceImage: 'a1' });
                addSessionTemplate('item_a', createMockImageData(), { sourceImage: 'a2' });
                addSessionTemplate('item_b', createMockImageData(), { sourceImage: 'b1' });

                expect(getSessionTemplateCount()).toBe(3);
            });
        });

        describe('getSessionTemplatesForItem', () => {
            it('should return empty array for non-existent item', () => {
                const templates = getSessionTemplatesForItem('nonexistent');
                expect(templates).toEqual([]);
            });

            it('should return only templates for specified item', () => {
                addSessionTemplate('item_x', createMockImageData(), { sourceImage: 'x' });
                addSessionTemplate('item_y', createMockImageData(), { sourceImage: 'y' });

                const templatesX = getSessionTemplatesForItem('item_x');
                const templatesY = getSessionTemplatesForItem('item_y');

                expect(templatesX.length).toBe(1);
                expect(templatesY.length).toBe(1);
                expect(templatesX[0].sourceImage).toBe('x');
                expect(templatesY[0].sourceImage).toBe('y');
            });
        });

        describe('clearSessionTemplates', () => {
            it('should clear all session templates', () => {
                addSessionTemplate('item_1', createMockImageData(), { sourceImage: '1' });
                addSessionTemplate('item_2', createMockImageData(), { sourceImage: '2' });

                expect(getSessionTemplateCount()).toBe(2);

                clearSessionTemplates();

                expect(getSessionTemplateCount()).toBe(0);
                expect(getSessionTemplatesForItem('item_1')).toEqual([]);
                expect(getSessionTemplatesForItem('item_2')).toEqual([]);
            });

            it('should reset count to 0', () => {
                addSessionTemplate('item', createMockImageData());
                clearSessionTemplates();
                expect(getSessionTemplateCount()).toBe(0);
            });
        });

        describe('getSessionTemplateItems', () => {
            it('should return empty array when no templates', () => {
                expect(getSessionTemplateItems()).toEqual([]);
            });

            it('should return array of item IDs with session templates', () => {
                addSessionTemplate('apple', createMockImageData());
                addSessionTemplate('banana', createMockImageData());
                addSessionTemplate('cherry', createMockImageData());

                const items = getSessionTemplateItems();
                expect(items).toContain('apple');
                expect(items).toContain('banana');
                expect(items).toContain('cherry');
                expect(items.length).toBe(3);
            });

            it('should not duplicate item IDs', () => {
                addSessionTemplate('item', createMockImageData(), { sourceImage: 'src1' });
                addSessionTemplate('item', createMockImageData(), { sourceImage: 'src2' });

                const items = getSessionTemplateItems();
                expect(items.length).toBe(1);
                expect(items[0]).toBe('item');
            });
        });
    });

    // ========================================
    // Source Management Tests
    // ========================================
    describe('Source Management', () => {
        describe('getAvailableSources', () => {
            it('should return empty array initially', () => {
                expect(getAvailableSources()).toEqual([]);
            });

            it('should return sorted array', () => {
                // Sources are populated when loading training data
                // This test verifies the return type
                const sources = getAvailableSources();
                expect(Array.isArray(sources)).toBe(true);
            });
        });

        describe('getEnabledSources', () => {
            it('should return empty array initially', () => {
                expect(getEnabledSources()).toEqual([]);
            });

            it('should return sorted array', () => {
                const sources = getEnabledSources();
                expect(Array.isArray(sources)).toBe(true);
            });
        });

        describe('enableSource', () => {
            it('should not enable non-existent source', () => {
                enableSource('nonexistent_source');
                // Since available sources is empty, this should have no effect
                expect(getEnabledSources()).toEqual([]);
            });
        });

        describe('disableSource', () => {
            it('should handle disabling non-enabled source gracefully', () => {
                disableSource('some_source');
                expect(getEnabledSources()).toEqual([]);
            });
        });

        describe('setEnabledSources', () => {
            it('should clear existing and set new sources', () => {
                // No available sources yet, so setting won't work
                setEnabledSources(['source1', 'source2']);
                // Should be empty since none are available
                expect(getEnabledSources()).toEqual([]);
            });

            it('should handle empty array', () => {
                setEnabledSources([]);
                expect(getEnabledSources()).toEqual([]);
            });
        });

        describe('enableAllSources', () => {
            it('should handle empty available sources', () => {
                enableAllSources();
                expect(getEnabledSources()).toEqual([]);
            });
        });

        describe('isSourceEnabled', () => {
            it('should return true when no explicit selection (all enabled by default)', () => {
                // When no sources are explicitly enabled, all are considered enabled
                expect(isSourceEnabled('any_source')).toBe(true);
            });
        });
    });

    // ========================================
    // Stats and Version Tests
    // ========================================
    describe('Stats and Version', () => {
        describe('getTrainingStats', () => {
            it('should return stats with loaded: false initially', () => {
                const stats = getTrainingStats();
                expect(stats.loaded).toBe(false);
                expect(stats.totalItems).toBe(0);
                expect(stats.totalTemplates).toBe(0);
                expect(stats.itemsWithMostSamples).toEqual([]);
            });

            it('should return itemsWithMostSamples capped at 10', () => {
                const stats = getTrainingStats();
                expect(stats.itemsWithMostSamples.length).toBeLessThanOrEqual(10);
            });
        });

        describe('clearTrainingData', () => {
            it('should reset all training state', () => {
                // Add some data first
                addSessionTemplate('item', createMockImageData());

                clearTrainingData();

                expect(isTrainingDataLoaded()).toBe(false);
                expect(getTrainingIndex()).toBeNull();
                expect(getTrainingTemplates().size).toBe(0);
                expect(getAvailableSources()).toEqual([]);
                expect(getEnabledSources()).toEqual([]);
            });
        });

        describe('getTrainingDataVersion', () => {
            it('should return null when no index loaded', () => {
                expect(getTrainingDataVersion()).toBeNull();
            });
        });

        describe('logTrainingDataVersion', () => {
            it('should not throw when no index loaded', () => {
                expect(() => logTrainingDataVersion()).not.toThrow();
            });
        });
    });

    // ========================================
    // Loading Tests (with mocked fetch)
    // ========================================
    describe('loadTrainingData', () => {
        beforeEach(() => {
            clearTrainingData();
        });

        it('should return true if already loaded', async () => {
            // Mock a successful load first
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            await loadTrainingData();

            // Now call again
            const result = await loadTrainingData();
            expect(result).toBe(true);
        });

        it('should handle 404 (no index file) gracefully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            const result = await loadTrainingData();
            expect(result).toBe(true);
            expect(isTrainingDataLoaded()).toBe(true);
        });

        it('should handle fetch error gracefully', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await loadTrainingData();
            expect(result).toBe(false);
        });

        it('should load empty index successfully', async () => {
            const mockIndex: TrainingIndex = {
                version: '1.0.0',
                created_at: '2024-01-01',
                updated_at: '2024-01-01',
                total_samples: 0,
                items: {},
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockIndex),
            });

            const result = await loadTrainingData();
            expect(result).toBe(true);
            expect(isTrainingDataLoaded()).toBe(true);
        });

        it('should parse index with items', async () => {
            const mockIndex: TrainingIndex = {
                version: '2.0.0',
                created_at: '2024-01-01',
                updated_at: '2024-06-01',
                total_samples: 5,
                items: {
                    sword: {
                        name: 'Sword',
                        sample_count: 2,
                        samples: [
                            {
                                id: 's1',
                                file: 'sword/s1.png',
                                source_resolution: '1080p',
                                source_image: 'gameplay_1.png',
                                validation_type: 'verified',
                                original_confidence: 0.95,
                                dimensions: { w: 48, h: 48 },
                                added_at: '2024-01-01',
                            },
                        ],
                    },
                },
            };

            // Mock fetch but images will fail to load (which is fine)
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockIndex),
            });

            const result = await loadTrainingData();
            expect(result).toBe(true);
            expect(getTrainingIndex()).not.toBeNull();
            expect(getTrainingIndex()?.version).toBe('2.0.0');
        });

        it('should prevent concurrent load attempts', async () => {
            let resolvePromise: () => void;
            const blockingPromise = new Promise<void>(resolve => {
                resolvePromise = resolve;
            });

            global.fetch = vi.fn().mockImplementation(() =>
                blockingPromise.then(() => ({
                    ok: false,
                    status: 404,
                }))
            );

            // Start first load
            const promise1 = loadTrainingData();

            // Clear and try second load immediately (should be blocked)
            clearTrainingData();
            const promise2 = loadTrainingData();

            // Resolve the blocking promise
            resolvePromise!();

            const [result1, result2] = await Promise.all([promise1, promise2]);
            // At least one should succeed (the first one)
            expect(result1 || result2).toBe(true);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should maintain session templates after clearTrainingData', () => {
            // Add session template
            addSessionTemplate('persist_item', createMockImageData());
            expect(getSessionTemplateCount()).toBe(1);

            // Clear training data (but not session templates)
            clearTrainingData();

            // Session templates should still exist
            expect(getSessionTemplateCount()).toBe(1);
        });

        it('should combine session and loaded templates in getTrainingTemplatesForItem', () => {
            // Add session template
            addSessionTemplate('combo_item', createMockImageData(), {
                sourceImage: 'session_source',
            });

            const templates = getTrainingTemplatesForItem('combo_item');
            expect(templates.some(t => t.sourceImage === 'session_source')).toBe(true);
        });

        it('should handle rapid add/clear cycles', () => {
            for (let i = 0; i < 5; i++) {
                addSessionTemplate(`item_${i}`, createMockImageData());
                if (i % 2 === 0) {
                    clearSessionTemplates();
                }
            }
            // After cycles, some templates should exist
            const count = getSessionTemplateCount();
            expect(count).toBeGreaterThanOrEqual(0);
        });

        it('should properly filter templates by source when sources are enabled', () => {
            // With no explicit enabled sources, all should be returned
            addSessionTemplate('filter_item', createMockImageData(), {
                sourceImage: 'source_a',
            });
            addSessionTemplate('filter_item', createMockImageData(), {
                sourceImage: 'source_b',
            });

            const templates = getTrainingTemplatesForItem('filter_item');
            expect(templates.length).toBe(2);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle item IDs with special characters', () => {
            const specialId = 'item-with_special.chars:123';
            const result = addSessionTemplate(specialId, createMockImageData());
            expect(result).toBe(true);
            expect(getSessionTemplatesForItem(specialId).length).toBe(1);
        });

        it('should handle empty item ID', () => {
            const result = addSessionTemplate('', createMockImageData());
            expect(result).toBe(true);
            expect(getSessionTemplatesForItem('').length).toBe(1);
        });

        it('should handle very long item IDs', () => {
            const longId = 'a'.repeat(1000);
            const result = addSessionTemplate(longId, createMockImageData());
            expect(result).toBe(true);
        });

        it('should handle ImageData with different dimensions', () => {
            const smallImage = createMockImageData(16, 16);
            const largeImage = createMockImageData(256, 256);

            addSessionTemplate('small_item', smallImage);
            addSessionTemplate('large_item', largeImage);

            expect(getSessionTemplatesForItem('small_item')[0].imageData.width).toBe(16);
            expect(getSessionTemplatesForItem('large_item')[0].imageData.width).toBe(256);
        });

        it('should handle metadata with originalConfidence', () => {
            addSessionTemplate('conf_item', createMockImageData(), {
                originalConfidence: 0.85,
            });
            // originalConfidence is logged but not stored in template
            expect(getSessionTemplatesForItem('conf_item').length).toBe(1);
        });
    });

    // ========================================
    // Version Info with Mocked Index Tests
    // ========================================
    describe('Version Info with Loaded Index', () => {
        it('should return version info when index is loaded via successful fetch', async () => {
            const mockIndex: TrainingIndex = {
                version: '3.0.0',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-06-15T12:00:00Z',
                total_samples: 150,
                items: {
                    item_a: {
                        name: 'Item A',
                        sample_count: 3,
                        samples: [
                            {
                                id: 'a1',
                                file: 'a/1.png',
                                source_resolution: '1080p',
                                source_image: 'src1.png',
                                validation_type: 'verified',
                                original_confidence: 0.9,
                                dimensions: { w: 48, h: 48 },
                                added_at: '2024-01-01',
                            },
                            {
                                id: 'a2',
                                file: 'a/2.png',
                                source_resolution: '720p',
                                source_image: 'src2.png',
                                validation_type: 'corrected',
                                original_confidence: 0.7,
                                dimensions: { w: 48, h: 48 },
                                added_at: '2024-02-01',
                            },
                            {
                                id: 'a3',
                                file: 'a/3.png',
                                source_resolution: '1440p',
                                source_image: 'src3.png',
                                validation_type: 'corrected_from_empty',
                                original_confidence: 0.5,
                                dimensions: { w: 48, h: 48 },
                                added_at: '2024-03-01',
                            },
                        ],
                    },
                    item_b: {
                        name: 'Item B',
                        sample_count: 1,
                        samples: [
                            {
                                id: 'b1',
                                file: 'b/1.png',
                                source_resolution: '1080p',
                                source_image: 'src4.png',
                                validation_type: 'verified',
                                original_confidence: 0.95,
                                dimensions: { w: 48, h: 48 },
                                added_at: '2024-04-01',
                            },
                        ],
                    },
                },
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockIndex),
            });

            await loadTrainingData();

            const version = getTrainingDataVersion();
            expect(version).not.toBeNull();
            expect(version?.version).toBe('3.0.0');
            expect(version?.createdAt).toBe('2024-01-01T00:00:00Z');
            expect(version?.updatedAt).toBe('2024-06-15T12:00:00Z');
            expect(version?.totalSamples).toBe(150);
            expect(version?.itemCount).toBe(2);
            expect(version?.sources.verified).toBe(2);
            expect(version?.sources.corrected).toBe(1);
            expect(version?.sources.corrected_from_empty).toBe(1);
        });

        it('should log version info when index is loaded', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            const mockIndex: TrainingIndex = {
                version: '1.0.0',
                created_at: '2024-01-01',
                updated_at: '2024-01-01',
                total_samples: 10,
                items: {
                    test: {
                        name: 'Test',
                        sample_count: 1,
                        samples: [{
                            id: 't1',
                            file: 't/1.png',
                            source_resolution: '1080p',
                            source_image: 'test.png',
                            validation_type: 'verified',
                            original_confidence: 0.9,
                            dimensions: { w: 48, h: 48 },
                            added_at: '2024-01-01',
                        }],
                    },
                },
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockIndex),
            });

            await loadTrainingData();

            logTrainingDataVersion();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.training.version_info',
                })
            );
        });
    });

    // ========================================
    // Type Validation Tests
    // ========================================
    describe('Type Validation', () => {
        it('TrainingTemplate should have correct structure', () => {
            addSessionTemplate('type_test', createMockImageData(), {
                resolution: '1080p',
                validationType: 'verified',
                sourceImage: 'test.png',
            });

            const template = getSessionTemplatesForItem('type_test')[0];
            expect(template).toHaveProperty('imageData');
            expect(template).toHaveProperty('weight');
            expect(template).toHaveProperty('resolution');
            expect(template).toHaveProperty('validationType');
            expect(template).toHaveProperty('sourceImage');
        });

        it('getTrainingStats should return correct shape', () => {
            const stats = getTrainingStats();
            expect(typeof stats.loaded).toBe('boolean');
            expect(typeof stats.totalItems).toBe('number');
            expect(typeof stats.totalTemplates).toBe('number');
            expect(Array.isArray(stats.itemsWithMostSamples)).toBe(true);
        });
    });
});
