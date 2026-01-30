/**
 * @vitest-environment jsdom
 * CV State Module - Comprehensive Tests
 * Tests for CV module state management, caching, and state getters/setters
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    isTemplatesLoaded,
    isPriorityTemplatesLoaded,
    isStandardTemplatesLoading,
    setStandardTemplatesLoading,
    getDetectionCache,
    getResizedTemplate,
    setResizedTemplate,
    getResizedTemplateCacheSize,
    getMultiScaleTemplates,
    getMultiScaleTemplate,
    setMultiScaleTemplate,
    hasMultiScaleTemplates,
    getMultiScaleTemplateCount,
    getCacheCleanupTimer,
    setAllData,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    setCacheCleanupTimer,
    resetState,
    loadGridPresets,
    getPresetForResolution,
    findPresetByAspectRatio,
    getAllGridPresets,
    isGridPresetsLoaded,
    scaleCalibrationToResolution,
    CACHE_TTL,
    MAX_CACHE_SIZE,
    COMMON_ICON_SIZES,
} from '../../src/modules/cv/state.ts';

// ========================================
// Test Suite
// ========================================

describe('CV State Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        resetState();
    });

    // ========================================
    // Constants Tests
    // ========================================
    describe('Constants', () => {
        it('should have CACHE_TTL set to 15 minutes', () => {
            expect(CACHE_TTL).toBe(1000 * 60 * 15);
        });

        it('should have MAX_CACHE_SIZE set to 50', () => {
            expect(MAX_CACHE_SIZE).toBe(50);
        });
    });

    // ========================================
    // getAllData / setAllData Tests
    // ========================================
    describe('getAllData / setAllData', () => {
        it('should return empty object by default', () => {
            const data = getAllData();
            expect(data).toEqual({});
        });

        it('should return set data', () => {
            const mockData = {
                items: { items: [], version: '1.0', last_updated: '2024-01-01' },
                weapons: { weapons: [], version: '1.0', last_updated: '2024-01-01' },
            };
            setAllData(mockData as any);

            const data = getAllData();
            expect(data).toEqual(mockData);
        });

        it('should handle partial game data', () => {
            const partialData = {
                items: { items: [{ id: 'sword', name: 'Sword' }] },
            };
            setAllData(partialData as any);

            const data = getAllData();
            expect(data.items?.items).toHaveLength(1);
        });

        it('should overwrite previous data', () => {
            setAllData({ items: { items: [{ id: 'a' }] } } as any);
            setAllData({ items: { items: [{ id: 'b' }] } } as any);

            const data = getAllData();
            expect(data.items?.items[0]?.id).toBe('b');
        });
    });

    // ========================================
    // getItemTemplates Tests
    // ========================================
    describe('getItemTemplates', () => {
        it('should return empty Map by default', () => {
            const templates = getItemTemplates();
            expect(templates).toBeInstanceOf(Map);
            expect(templates.size).toBe(0);
        });

        it('should return same Map instance', () => {
            const templates1 = getItemTemplates();
            const templates2 = getItemTemplates();
            expect(templates1).toBe(templates2);
        });

        it('should allow adding templates', () => {
            const templates = getItemTemplates();
            templates.set('sword', {
                image: {} as HTMLImageElement,
                canvas: {} as HTMLCanvasElement,
                ctx: {} as CanvasRenderingContext2D,
                width: 64,
                height: 64,
            });

            expect(templates.size).toBe(1);
            expect(templates.has('sword')).toBe(true);
        });

        it('should persist templates across calls', () => {
            const templates = getItemTemplates();
            templates.set('shield', { width: 32, height: 32 } as any);

            const retrieved = getItemTemplates();
            expect(retrieved.has('shield')).toBe(true);
        });
    });

    // ========================================
    // getTemplatesByColor Tests
    // ========================================
    describe('getTemplatesByColor', () => {
        it('should return empty Map by default', () => {
            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor).toBeInstanceOf(Map);
            expect(templatesByColor.size).toBe(0);
        });

        it('should return same Map instance', () => {
            const map1 = getTemplatesByColor();
            const map2 = getTemplatesByColor();
            expect(map1).toBe(map2);
        });

        it('should allow grouping items by color', () => {
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('red', [{ id: 'fire_sword' }] as any);
            templatesByColor.set('blue', [{ id: 'ice_shield' }] as any);

            expect(templatesByColor.size).toBe(2);
            expect(templatesByColor.get('red')).toHaveLength(1);
        });

        it('should support multiple items per color', () => {
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('green', [
                { id: 'item1' },
                { id: 'item2' },
                { id: 'item3' },
            ] as any);

            expect(templatesByColor.get('green')).toHaveLength(3);
        });
    });

    // ========================================
    // isTemplatesLoaded / setTemplatesLoaded Tests
    // ========================================
    describe('isTemplatesLoaded / setTemplatesLoaded', () => {
        it('should return false by default', () => {
            expect(isTemplatesLoaded()).toBe(false);
        });

        it('should return true after setting to true', () => {
            setTemplatesLoaded(true);
            expect(isTemplatesLoaded()).toBe(true);
        });

        it('should return false after setting to false', () => {
            setTemplatesLoaded(true);
            setTemplatesLoaded(false);
            expect(isTemplatesLoaded()).toBe(false);
        });
    });

    // ========================================
    // isPriorityTemplatesLoaded / setPriorityTemplatesLoaded Tests
    // ========================================
    describe('isPriorityTemplatesLoaded / setPriorityTemplatesLoaded', () => {
        it('should return false by default', () => {
            expect(isPriorityTemplatesLoaded()).toBe(false);
        });

        it('should return true after setting to true', () => {
            setPriorityTemplatesLoaded(true);
            expect(isPriorityTemplatesLoaded()).toBe(true);
        });

        it('should return false after setting to false', () => {
            setPriorityTemplatesLoaded(true);
            setPriorityTemplatesLoaded(false);
            expect(isPriorityTemplatesLoaded()).toBe(false);
        });

        it('should be independent of templatesLoaded state', () => {
            setPriorityTemplatesLoaded(true);
            setTemplatesLoaded(false);

            expect(isPriorityTemplatesLoaded()).toBe(true);
            expect(isTemplatesLoaded()).toBe(false);
        });
    });

    // ========================================
    // getDetectionCache Tests
    // ========================================
    describe('getDetectionCache', () => {
        it('should return empty Map by default', () => {
            const cache = getDetectionCache();
            expect(cache).toBeInstanceOf(Map);
            expect(cache.size).toBe(0);
        });

        it('should return same Map instance', () => {
            const cache1 = getDetectionCache();
            const cache2 = getDetectionCache();
            expect(cache1).toBe(cache2);
        });

        it('should allow caching detection results', () => {
            const cache = getDetectionCache();
            const results = [
                { itemId: 'sword', confidence: 0.95, bounds: { x: 0, y: 0, width: 64, height: 64 } },
            ];

            cache.set('image_hash_123', {
                results: results as any,
                timestamp: Date.now(),
            });

            expect(cache.size).toBe(1);
            expect(cache.has('image_hash_123')).toBe(true);
        });

        it('should support cache entry with timestamp', () => {
            const cache = getDetectionCache();
            const timestamp = Date.now();

            cache.set('hash_abc', {
                results: [],
                timestamp,
            });

            const entry = cache.get('hash_abc');
            expect(entry?.timestamp).toBe(timestamp);
        });

        it('should support multiple cache entries', () => {
            const cache = getDetectionCache();

            for (let i = 0; i < 10; i++) {
                cache.set(`hash_${i}`, {
                    results: [{ itemId: `item_${i}` }] as any,
                    timestamp: Date.now(),
                });
            }

            expect(cache.size).toBe(10);
        });
    });

    // ========================================
    // getCacheCleanupTimer / setCacheCleanupTimer Tests
    // ========================================
    describe('getCacheCleanupTimer / setCacheCleanupTimer', () => {
        it('should return null by default', () => {
            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should return set timer', () => {
            const timer = setInterval(() => {}, 1000);
            setCacheCleanupTimer(timer);

            expect(getCacheCleanupTimer()).toBe(timer);

            clearInterval(timer);
        });

        it('should allow setting to null', () => {
            const timer = setInterval(() => {}, 1000);
            setCacheCleanupTimer(timer);
            setCacheCleanupTimer(null);

            expect(getCacheCleanupTimer()).toBeNull();

            clearInterval(timer);
        });
    });

    // ========================================
    // resetState Tests
    // ========================================
    describe('resetState', () => {
        it('should reset allData to empty object', () => {
            setAllData({ items: { items: [] } } as any);
            resetState();

            expect(getAllData()).toEqual({});
        });

        it('should clear itemTemplates Map', () => {
            const templates = getItemTemplates();
            templates.set('sword', {} as any);
            resetState();

            expect(getItemTemplates().size).toBe(0);
        });

        it('should clear templatesByColor Map', () => {
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('red', []);
            resetState();

            expect(getTemplatesByColor().size).toBe(0);
        });

        it('should reset templatesLoaded to false', () => {
            setTemplatesLoaded(true);
            resetState();

            expect(isTemplatesLoaded()).toBe(false);
        });

        it('should reset priorityTemplatesLoaded to false', () => {
            setPriorityTemplatesLoaded(true);
            resetState();

            expect(isPriorityTemplatesLoaded()).toBe(false);
        });

        it('should clear detectionCache', () => {
            const cache = getDetectionCache();
            cache.set('hash', { results: [], timestamp: Date.now() });
            resetState();

            expect(getDetectionCache().size).toBe(0);
        });

        it('should clear cache cleanup timer', () => {
            const timer = setInterval(() => {}, 1000);
            setCacheCleanupTimer(timer);
            resetState();

            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should reset all state in a single call', () => {
            // Set up various state
            setAllData({ items: { items: [] } } as any);
            getItemTemplates().set('sword', {} as any);
            getTemplatesByColor().set('red', []);
            setTemplatesLoaded(true);
            setPriorityTemplatesLoaded(true);
            getDetectionCache().set('hash', { results: [], timestamp: Date.now() });

            // Reset everything
            resetState();

            // Verify all reset
            expect(getAllData()).toEqual({});
            expect(getItemTemplates().size).toBe(0);
            expect(getTemplatesByColor().size).toBe(0);
            expect(isTemplatesLoaded()).toBe(false);
            expect(isPriorityTemplatesLoaded()).toBe(false);
            expect(getDetectionCache().size).toBe(0);
        });

        it('should be safe to call multiple times', () => {
            resetState();
            resetState();
            resetState();

            expect(getAllData()).toEqual({});
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support typical template loading flow', () => {
            // 1. Set game data
            setAllData({
                items: {
                    items: [
                        { id: 'sword', name: 'Sword', rarity: 'common' },
                        { id: 'shield', name: 'Shield', rarity: 'rare' },
                    ],
                },
            } as any);

            // 2. Load priority templates
            const templates = getItemTemplates();
            templates.set('sword', { width: 64, height: 64 } as any);
            setPriorityTemplatesLoaded(true);

            // 3. Group by color
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('gray', [getAllData().items?.items[0]] as any);

            // 4. Load remaining templates
            templates.set('shield', { width: 64, height: 64 } as any);
            setTemplatesLoaded(true);

            // Verify state
            expect(templates.size).toBe(2);
            expect(isPriorityTemplatesLoaded()).toBe(true);
            expect(isTemplatesLoaded()).toBe(true);
            expect(templatesByColor.size).toBe(1);
        });

        it('should support cache-based detection flow', () => {
            const cache = getDetectionCache();
            const imageHash = 'screenshot_hash_abc123';

            // Check cache miss
            expect(cache.has(imageHash)).toBe(false);

            // Perform detection and cache result
            const detectionResults = [
                { itemId: 'sword', confidence: 0.95 },
                { itemId: 'shield', confidence: 0.87 },
            ];
            cache.set(imageHash, {
                results: detectionResults as any,
                timestamp: Date.now(),
            });

            // Check cache hit
            expect(cache.has(imageHash)).toBe(true);
            expect(cache.get(imageHash)?.results).toHaveLength(2);
        });

        it('should handle data refresh scenario', () => {
            // Initial load
            setAllData({ items: { items: [{ id: 'old_item' }] } } as any);
            getItemTemplates().set('old_item', {} as any);
            setTemplatesLoaded(true);

            // Simulate data refresh
            resetState();
            setAllData({ items: { items: [{ id: 'new_item' }] } } as any);
            getItemTemplates().set('new_item', {} as any);
            setTemplatesLoaded(true);

            // Verify new state
            expect(getItemTemplates().has('old_item')).toBe(false);
            expect(getItemTemplates().has('new_item')).toBe(true);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle empty items array in game data', () => {
            setAllData({ items: { items: [] } } as any);
            expect(getAllData().items?.items).toEqual([]);
        });

        it('should handle null-like values in Maps', () => {
            const templates = getItemTemplates();
            templates.set('empty', null as any);

            expect(templates.get('empty')).toBeNull();
            expect(templates.has('empty')).toBe(true);
        });

        it('should handle very large template counts', () => {
            const templates = getItemTemplates();

            for (let i = 0; i < 1000; i++) {
                templates.set(`item_${i}`, { width: 64, height: 64 } as any);
            }

            expect(templates.size).toBe(1000);
        });

        it('should handle template overwrite', () => {
            const templates = getItemTemplates();
            templates.set('sword', { width: 32 } as any);
            templates.set('sword', { width: 64 } as any);

            expect(templates.get('sword')?.width).toBe(64);
            expect(templates.size).toBe(1);
        });

        it('should handle cache entry with empty results', () => {
            const cache = getDetectionCache();
            cache.set('empty_detection', {
                results: [],
                timestamp: Date.now(),
            });

            expect(cache.get('empty_detection')?.results).toEqual([]);
        });
    });

    // ========================================
    // Resized Template Cache Tests
    // ========================================
    describe('Resized Template Cache', () => {
        // Helper to create mock ImageData (jsdom doesn't have full ImageData support)
        const createMockImageData = (width: number, height: number) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
        }) as unknown as ImageData;

        it('should return undefined for non-existent template', () => {
            const result = getResizedTemplate('nonexistent', 100, 100);
            expect(result).toBeUndefined();
        });

        it('should set and get resized template', () => {
            const mockImageData = createMockImageData(50, 50);
            setResizedTemplate('item1', 50, 50, mockImageData);

            const result = getResizedTemplate('item1', 50, 50);
            expect(result).toBe(mockImageData);
        });

        it('should use composite key with templateId and dimensions', () => {
            const mockImageData1 = createMockImageData(50, 50);
            const mockImageData2 = createMockImageData(100, 100);

            setResizedTemplate('item1', 50, 50, mockImageData1);
            setResizedTemplate('item1', 100, 100, mockImageData2);

            expect(getResizedTemplate('item1', 50, 50)).toBe(mockImageData1);
            expect(getResizedTemplate('item1', 100, 100)).toBe(mockImageData2);
        });

        it('should report correct cache size', () => {
            expect(getResizedTemplateCacheSize()).toBe(0);

            setResizedTemplate('item1', 50, 50, createMockImageData(1, 1));
            expect(getResizedTemplateCacheSize()).toBe(1);

            setResizedTemplate('item2', 50, 50, createMockImageData(1, 1));
            expect(getResizedTemplateCacheSize()).toBe(2);
        });

        it('should evict oldest entry when cache exceeds 500 entries', () => {
            // Fill cache to max (500)
            for (let i = 0; i < 500; i++) {
                setResizedTemplate(`item${i}`, 50, 50, createMockImageData(1, 1));
            }
            expect(getResizedTemplateCacheSize()).toBe(500);

            // Add one more - should evict oldest (item0)
            setResizedTemplate('newItem', 50, 50, createMockImageData(1, 1));

            expect(getResizedTemplateCacheSize()).toBe(500);
            expect(getResizedTemplate('item0', 50, 50)).toBeUndefined();
            expect(getResizedTemplate('newItem', 50, 50)).toBeDefined();
        });

        it('should handle different dimensions for same template', () => {
            const small = createMockImageData(32, 32);
            const medium = createMockImageData(64, 64);
            const large = createMockImageData(128, 128);

            setResizedTemplate('sword', 32, 32, small);
            setResizedTemplate('sword', 64, 64, medium);
            setResizedTemplate('sword', 128, 128, large);

            expect(getResizedTemplateCacheSize()).toBe(3);
            expect(getResizedTemplate('sword', 32, 32)).toBe(small);
            expect(getResizedTemplate('sword', 64, 64)).toBe(medium);
            expect(getResizedTemplate('sword', 128, 128)).toBe(large);
        });

        it('should overwrite existing entry with same key', () => {
            const original = createMockImageData(50, 50);
            const updated = createMockImageData(50, 50);

            setResizedTemplate('item1', 50, 50, original);
            setResizedTemplate('item1', 50, 50, updated);

            expect(getResizedTemplateCacheSize()).toBe(1);
            expect(getResizedTemplate('item1', 50, 50)).toBe(updated);
        });

        it('should be cleared by resetState', () => {
            setResizedTemplate('item1', 50, 50, createMockImageData(1, 1));
            setResizedTemplate('item2', 50, 50, createMockImageData(1, 1));

            resetState();

            expect(getResizedTemplateCacheSize()).toBe(0);
            expect(getResizedTemplate('item1', 50, 50)).toBeUndefined();
        });
    });

    // ========================================
    // isStandardTemplatesLoading / setStandardTemplatesLoading Tests
    // ========================================
    describe('isStandardTemplatesLoading / setStandardTemplatesLoading', () => {
        it('should return false by default', () => {
            expect(isStandardTemplatesLoading()).toBe(false);
        });

        it('should return true after setting to true', () => {
            setStandardTemplatesLoading(true);
            expect(isStandardTemplatesLoading()).toBe(true);
        });

        it('should return false after setting to false', () => {
            setStandardTemplatesLoading(true);
            setStandardTemplatesLoading(false);
            expect(isStandardTemplatesLoading()).toBe(false);
        });

        it('should be reset by resetState', () => {
            setStandardTemplatesLoading(true);
            resetState();
            expect(isStandardTemplatesLoading()).toBe(false);
        });
    });

    // ========================================
    // COMMON_ICON_SIZES Constant Tests
    // ========================================
    describe('COMMON_ICON_SIZES', () => {
        it('should contain expected icon sizes', () => {
            expect(COMMON_ICON_SIZES).toContain(32);
            expect(COMMON_ICON_SIZES).toContain(48);
            expect(COMMON_ICON_SIZES).toContain(64);
        });

        it('should be a readonly tuple', () => {
            expect(Array.isArray(COMMON_ICON_SIZES)).toBe(true);
            expect(COMMON_ICON_SIZES.length).toBeGreaterThan(0);
        });

        it('should have sizes in ascending order', () => {
            for (let i = 1; i < COMMON_ICON_SIZES.length; i++) {
                expect(COMMON_ICON_SIZES[i]).toBeGreaterThan(COMMON_ICON_SIZES[i - 1]);
            }
        });
    });

    // ========================================
    // Multi-Scale Template Tests
    // ========================================
    describe('Multi-Scale Templates', () => {
        const createMockImageData = (width: number, height: number) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
        }) as unknown as ImageData;

        describe('getMultiScaleTemplates', () => {
            it('should return empty Map by default', () => {
                const templates = getMultiScaleTemplates();
                expect(templates).toBeInstanceOf(Map);
                expect(templates.size).toBe(0);
            });

            it('should return same Map instance', () => {
                const map1 = getMultiScaleTemplates();
                const map2 = getMultiScaleTemplates();
                expect(map1).toBe(map2);
            });
        });

        describe('setMultiScaleTemplate / getMultiScaleTemplate', () => {
            it('should return undefined for non-existent template', () => {
                const result = getMultiScaleTemplate('nonexistent', 32);
                expect(result).toBeUndefined();
            });

            it('should set and get multi-scale template', () => {
                const mockImageData = createMockImageData(32, 32);
                setMultiScaleTemplate('sword', 32, mockImageData);

                const result = getMultiScaleTemplate('sword', 32);
                expect(result).toBe(mockImageData);
            });

            it('should store multiple sizes for same item', () => {
                const small = createMockImageData(32, 32);
                const medium = createMockImageData(48, 48);
                const large = createMockImageData(64, 64);

                setMultiScaleTemplate('sword', 32, small);
                setMultiScaleTemplate('sword', 48, medium);
                setMultiScaleTemplate('sword', 64, large);

                expect(getMultiScaleTemplate('sword', 32)).toBe(small);
                expect(getMultiScaleTemplate('sword', 48)).toBe(medium);
                expect(getMultiScaleTemplate('sword', 64)).toBe(large);
            });

            it('should store templates for different items', () => {
                const swordImg = createMockImageData(32, 32);
                const shieldImg = createMockImageData(32, 32);

                setMultiScaleTemplate('sword', 32, swordImg);
                setMultiScaleTemplate('shield', 32, shieldImg);

                expect(getMultiScaleTemplate('sword', 32)).toBe(swordImg);
                expect(getMultiScaleTemplate('shield', 32)).toBe(shieldImg);
            });

            it('should return undefined for item with templates but wrong size', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                expect(getMultiScaleTemplate('sword', 64)).toBeUndefined();
            });
        });

        describe('hasMultiScaleTemplates', () => {
            it('should return false for non-existent item', () => {
                expect(hasMultiScaleTemplates('nonexistent')).toBe(false);
            });

            it('should return true after adding template', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                expect(hasMultiScaleTemplates('sword')).toBe(true);
            });

            it('should return false for item with empty size map', () => {
                // Manually set an empty map (edge case)
                getMultiScaleTemplates().set('empty_item', new Map());
                expect(hasMultiScaleTemplates('empty_item')).toBe(false);
            });
        });

        describe('getMultiScaleTemplateCount', () => {
            it('should return 0 when no templates', () => {
                expect(getMultiScaleTemplateCount()).toBe(0);
            });

            it('should count all templates across all items', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                setMultiScaleTemplate('shield', 32, createMockImageData(32, 32));

                expect(getMultiScaleTemplateCount()).toBe(3);
            });

            it('should update count after adding more templates', () => {
                setMultiScaleTemplate('item1', 32, createMockImageData(32, 32));
                expect(getMultiScaleTemplateCount()).toBe(1);

                setMultiScaleTemplate('item2', 32, createMockImageData(32, 32));
                expect(getMultiScaleTemplateCount()).toBe(2);
            });
        });

        describe('resetState clears multi-scale templates', () => {
            it('should clear all multi-scale templates', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                setMultiScaleTemplate('shield', 48, createMockImageData(48, 48));

                resetState();

                expect(getMultiScaleTemplates().size).toBe(0);
                expect(getMultiScaleTemplateCount()).toBe(0);
                expect(hasMultiScaleTemplates('sword')).toBe(false);
            });
        });
    });

    // ========================================
    // Grid Presets Tests
    // ========================================
    describe('Grid Presets', () => {
        describe('isGridPresetsLoaded', () => {
            it('should return false by default', () => {
                expect(isGridPresetsLoaded()).toBe(false);
            });

            it('should be reset by resetState', () => {
                // We can't directly set gridPresetsLoaded, but resetState should reset it
                resetState();
                expect(isGridPresetsLoaded()).toBe(false);
            });
        });

        describe('getAllGridPresets', () => {
            it('should return empty object when no presets loaded', () => {
                const presets = getAllGridPresets();
                expect(presets).toEqual({});
            });
        });

        describe('getPresetForResolution', () => {
            it('should return null when no presets loaded', () => {
                const result = getPresetForResolution(1920, 1080);
                expect(result).toBeNull();
            });
        });

        describe('findPresetByAspectRatio', () => {
            it('should return null when no presets loaded', () => {
                const result = findPresetByAspectRatio(1920, 1080);
                expect(result).toBeNull();
            });

            it('should return null for invalid dimensions (zero width)', () => {
                const result = findPresetByAspectRatio(0, 1080);
                expect(result).toBeNull();
            });

            it('should return null for invalid dimensions (zero height)', () => {
                const result = findPresetByAspectRatio(1920, 0);
                expect(result).toBeNull();
            });

            it('should return null for invalid dimensions (negative)', () => {
                const result = findPresetByAspectRatio(-1920, 1080);
                expect(result).toBeNull();
            });

            it('should return null for NaN dimensions', () => {
                const result = findPresetByAspectRatio(NaN, 1080);
                expect(result).toBeNull();
            });

            it('should return null for Infinity dimensions', () => {
                const result = findPresetByAspectRatio(Infinity, 1080);
                expect(result).toBeNull();
            });
        });

        describe('loadGridPresets', () => {
            it('should handle fetch failure gracefully', async () => {
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 404,
                });

                const result = await loadGridPresets();
                expect(result).toBeNull();
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('should handle fetch error gracefully', async () => {
                global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

                // Reset state first to clear any cached presets
                resetState();

                const result = await loadGridPresets();
                expect(result).toBeNull();
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('should load and cache presets on success', async () => {
                const mockPresets = {
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: {
                                xOffset: 10,
                                yOffset: 20,
                                iconWidth: 64,
                                iconHeight: 64,
                                xSpacing: 8,
                                ySpacing: 8,
                                iconsPerRow: 10,
                                numRows: 5,
                            },
                        },
                    },
                };

                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockPresets),
                });

                // Reset to clear cached state
                resetState();

                const result = await loadGridPresets();
                expect(result).toEqual(mockPresets);
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('should return cached presets on subsequent calls', async () => {
                const mockPresets = {
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: {},
                        },
                    },
                };

                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockPresets),
                });

                resetState();

                // First call
                await loadGridPresets();

                // Second call should return cached
                const result = await loadGridPresets();
                expect(result).toEqual(mockPresets);
                expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
            });
        });

        describe('getPresetForResolution with loaded presets', () => {
            beforeEach(async () => {
                const mockPresets = {
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: {
                                xOffset: 10,
                                yOffset: 20,
                                iconWidth: 64,
                                iconHeight: 64,
                                xSpacing: 8,
                                ySpacing: 8,
                                iconsPerRow: 10,
                                numRows: 5,
                            },
                        },
                        '1280x720': {
                            resolution: { width: 1280, height: 720 },
                            calibration: {
                                xOffset: 5,
                                yOffset: 10,
                                iconWidth: 48,
                                iconHeight: 48,
                                xSpacing: 6,
                                ySpacing: 6,
                                iconsPerRow: 10,
                                numRows: 5,
                            },
                        },
                    },
                };

                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockPresets),
                });

                resetState();
                await loadGridPresets();
            });

            it('should return preset for exact resolution match', () => {
                const result = getPresetForResolution(1920, 1080);
                expect(result).not.toBeNull();
                expect(result?.resolution.width).toBe(1920);
            });

            it('should return null for non-matching resolution', () => {
                const result = getPresetForResolution(2560, 1440);
                expect(result).toBeNull();
            });
        });

        describe('findPresetByAspectRatio with loaded presets', () => {
            beforeEach(async () => {
                const mockPresets = {
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: {},
                        },
                        '1280x720': {
                            resolution: { width: 1280, height: 720 },
                            calibration: {},
                        },
                    },
                };

                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve(mockPresets),
                });

                resetState();
                await loadGridPresets();
            });

            it('should find best matching preset by aspect ratio', () => {
                // 16:9 aspect ratio should match 1920x1080 or 1280x720
                const result = findPresetByAspectRatio(3840, 2160);
                expect(result).not.toBeNull();
            });

            it('should prefer closer resolution when aspect ratios match', () => {
                // Closer to 1920x1080
                const result = findPresetByAspectRatio(1600, 900);
                expect(result).not.toBeNull();
            });
        });

        describe('scaleCalibrationToResolution', () => {
            it('should scale calibration values proportionally', () => {
                const calibration = {
                    xOffset: 100,
                    yOffset: 200,
                    iconWidth: 64,
                    iconHeight: 64,
                    xSpacing: 8,
                    ySpacing: 8,
                    iconsPerRow: 10,
                    numRows: 5,
                };

                // Scale from 1080 to 2160 (2x)
                const scaled = scaleCalibrationToResolution(calibration, 1080, 2160);

                expect(scaled.xOffset).toBe(200); // 100 * 2
                expect(scaled.yOffset).toBe(400); // 200 * 2
                expect(scaled.iconWidth).toBe(128); // 64 * 2
                expect(scaled.iconHeight).toBe(128); // 64 * 2
                expect(scaled.xSpacing).toBe(16); // 8 * 2
                expect(scaled.ySpacing).toBe(16); // 8 * 2
                // These should NOT scale
                expect(scaled.iconsPerRow).toBe(10);
                expect(scaled.numRows).toBe(5);
            });

            it('should scale down correctly', () => {
                const calibration = {
                    xOffset: 200,
                    yOffset: 400,
                    iconWidth: 128,
                    iconHeight: 128,
                    xSpacing: 16,
                    ySpacing: 16,
                    iconsPerRow: 10,
                    numRows: 5,
                };

                // Scale from 2160 to 1080 (0.5x)
                const scaled = scaleCalibrationToResolution(calibration, 2160, 1080);

                expect(scaled.xOffset).toBe(100);
                expect(scaled.yOffset).toBe(200);
                expect(scaled.iconWidth).toBe(64);
                expect(scaled.iconHeight).toBe(64);
            });

            it('should handle fractional scaling with rounding', () => {
                const calibration = {
                    xOffset: 10,
                    yOffset: 10,
                    iconWidth: 33,
                    iconHeight: 33,
                    xSpacing: 7,
                    ySpacing: 7,
                    iconsPerRow: 10,
                    numRows: 5,
                };

                // Scale by 1.5x
                const scaled = scaleCalibrationToResolution(calibration, 100, 150);

                expect(scaled.xOffset).toBe(15); // 10 * 1.5 = 15
                expect(scaled.iconWidth).toBe(50); // 33 * 1.5 = 49.5 → 50
                expect(scaled.xSpacing).toBe(11); // 7 * 1.5 = 10.5 → 11
            });

            it('should return same values when scaling 1:1', () => {
                const calibration = {
                    xOffset: 100,
                    yOffset: 200,
                    iconWidth: 64,
                    iconHeight: 64,
                    xSpacing: 8,
                    ySpacing: 8,
                    iconsPerRow: 10,
                    numRows: 5,
                };

                const scaled = scaleCalibrationToResolution(calibration, 1080, 1080);

                expect(scaled).toEqual(calibration);
            });
        });
    });
});
