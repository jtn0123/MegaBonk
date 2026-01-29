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
    getDetectionCache,
    getResizedTemplate,
    setResizedTemplate,
    getResizedTemplateCacheSize,
    getCacheCleanupTimer,
    setAllData,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    setCacheCleanupTimer,
    resetState,
    CACHE_TTL,
    MAX_CACHE_SIZE,
    startPeriodicCacheCleanup,
    stopPeriodicCacheCleanup,
    cleanupStaleCacheEntries,
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
    // Periodic Cache Cleanup Tests (#8, #30)
    // ========================================
    describe('Periodic Cache Cleanup', () => {
        it('should start periodic cache cleanup', () => {
            startPeriodicCacheCleanup();

            // Verify timer is set
            expect(getCacheCleanupTimer()).not.toBeNull();

            // Cleanup
            stopPeriodicCacheCleanup();
        });

        it('should not create duplicate timers when called multiple times', () => {
            startPeriodicCacheCleanup();
            const timer1 = getCacheCleanupTimer();

            startPeriodicCacheCleanup();
            const timer2 = getCacheCleanupTimer();

            // Should be same timer (not overwritten)
            expect(timer1).toBe(timer2);

            // Cleanup
            stopPeriodicCacheCleanup();
        });

        it('should stop periodic cache cleanup', () => {
            startPeriodicCacheCleanup();
            expect(getCacheCleanupTimer()).not.toBeNull();

            stopPeriodicCacheCleanup();
            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should cleanup stale cache entries', () => {
            const cache = getDetectionCache();

            // Add fresh entry
            cache.set('fresh', {
                results: [],
                timestamp: Date.now(),
            });

            // Add stale entry (older than CACHE_TTL)
            cache.set('stale', {
                results: [],
                timestamp: Date.now() - CACHE_TTL - 1000,
            });

            expect(cache.size).toBe(2);

            // Run cleanup
            cleanupStaleCacheEntries();

            // Stale entry should be removed
            expect(cache.size).toBe(1);
            expect(cache.has('fresh')).toBe(true);
            expect(cache.has('stale')).toBe(false);
        });

        it('should not remove entries within TTL', () => {
            const cache = getDetectionCache();

            // Add entries with recent timestamps
            cache.set('recent1', {
                results: [],
                timestamp: Date.now() - 1000, // 1 second ago
            });
            cache.set('recent2', {
                results: [],
                timestamp: Date.now() - 60000, // 1 minute ago
            });

            expect(cache.size).toBe(2);

            cleanupStaleCacheEntries();

            // Both should remain
            expect(cache.size).toBe(2);
        });

        it('should handle empty cache gracefully', () => {
            const cache = getDetectionCache();
            expect(cache.size).toBe(0);

            // Should not throw
            expect(() => cleanupStaleCacheEntries()).not.toThrow();
        });

        it('should be stopped by resetState', () => {
            startPeriodicCacheCleanup();
            expect(getCacheCleanupTimer()).not.toBeNull();

            resetState();

            expect(getCacheCleanupTimer()).toBeNull();
        });
    });

    // ========================================
    // Cache Key Uniqueness Tests (#6, #30)
    // ========================================
    describe('Cache Key Uniqueness', () => {
        it('should distinguish cache entries by key', () => {
            const cache = getDetectionCache();

            cache.set('image_a', {
                results: [{ itemId: 'item_a' }] as any,
                timestamp: Date.now(),
            });
            cache.set('image_b', {
                results: [{ itemId: 'item_b' }] as any,
                timestamp: Date.now(),
            });

            expect(cache.size).toBe(2);
            expect(cache.get('image_a')?.results[0].itemId).toBe('item_a');
            expect(cache.get('image_b')?.results[0].itemId).toBe('item_b');
        });

        it('should handle keys with similar prefixes', () => {
            const cache = getDetectionCache();

            cache.set('item_1', { results: [], timestamp: Date.now() });
            cache.set('item_10', { results: [], timestamp: Date.now() });
            cache.set('item_100', { results: [], timestamp: Date.now() });

            expect(cache.size).toBe(3);
            expect(cache.has('item_1')).toBe(true);
            expect(cache.has('item_10')).toBe(true);
            expect(cache.has('item_100')).toBe(true);
        });

        it('should handle special characters in cache keys', () => {
            const cache = getDetectionCache();

            cache.set('key-with-dashes', { results: [], timestamp: Date.now() });
            cache.set('key_with_underscores', { results: [], timestamp: Date.now() });
            cache.set('key.with.dots', { results: [], timestamp: Date.now() });

            expect(cache.size).toBe(3);
        });
    });
});
