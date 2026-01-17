/**
 * @vitest-environment jsdom
 * CV Core Module - Comprehensive Tests
 * Tests for CV initialization, cleanup, and cache management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    initCV,
    cleanupCV,
    startCacheCleanup,
    stopCacheCleanup,
    isFullyLoaded,
    isPriorityLoaded,
} from '../../src/modules/cv/core.ts';

import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    getCacheCleanupTimer,
    isTemplatesLoaded,
    isPriorityTemplatesLoaded,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    resetState,
    CACHE_TTL,
    MAX_CACHE_SIZE,
} from '../../src/modules/cv/state.ts';

import { logger } from '../../src/modules/logger.ts';

// ========================================
// Test Suite
// ========================================

describe('CV Core Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        cleanupCV();
        resetState();
    });

    // ========================================
    // initCV Tests
    // ========================================
    describe('initCV', () => {
        it('should initialize with game data', () => {
            const gameData = {
                items: {
                    items: [{ id: 'sword', name: 'Sword' }],
                    version: '1.0',
                    last_updated: '2024-01-01',
                },
            };

            initCV(gameData as any);

            const data = getAllData();
            expect(data.items?.items).toHaveLength(1);
            expect(data.items?.items[0].id).toBe('sword');
        });

        it('should handle null gameData', () => {
            expect(() => initCV(null as any)).not.toThrow();

            const data = getAllData();
            expect(data).toEqual({});
        });

        it('should handle undefined gameData', () => {
            expect(() => initCV(undefined as any)).not.toThrow();

            const data = getAllData();
            expect(data).toEqual({});
        });

        it('should handle empty gameData', () => {
            initCV({});

            const data = getAllData();
            expect(data).toEqual({});
        });

        it('should start cache cleanup timer', () => {
            initCV({});

            expect(getCacheCleanupTimer()).not.toBeNull();
        });

        it('should log initialization info', () => {
            const gameData = {
                items: {
                    items: [{ id: 'item1' }, { id: 'item2' }],
                },
            };

            initCV(gameData as any);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 2,
                    }),
                })
            );
        });

        it('should log 0 items when no items present', () => {
            initCV({});

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 0,
                    }),
                })
            );
        });

        it('should overwrite previous game data', () => {
            initCV({ items: { items: [{ id: 'old' }] } } as any);
            initCV({ items: { items: [{ id: 'new' }] } } as any);

            const data = getAllData();
            expect(data.items?.items[0].id).toBe('new');
        });
    });

    // ========================================
    // cleanupCV Tests
    // ========================================
    describe('cleanupCV', () => {
        it('should stop cache cleanup timer', () => {
            initCV({});
            expect(getCacheCleanupTimer()).not.toBeNull();

            cleanupCV();
            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should clear detection cache', () => {
            initCV({});
            const cache = getDetectionCache();
            cache.set('hash1', { results: [], timestamp: Date.now() });
            cache.set('hash2', { results: [], timestamp: Date.now() });

            cleanupCV();

            expect(getDetectionCache().size).toBe(0);
        });

        it('should clear item templates', () => {
            initCV({});
            const templates = getItemTemplates();
            templates.set('sword', {} as any);

            cleanupCV();

            expect(getItemTemplates().size).toBe(0);
        });

        it('should clear templates by color', () => {
            initCV({});
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('red', []);

            cleanupCV();

            expect(getTemplatesByColor().size).toBe(0);
        });

        it('should reset templatesLoaded flag', () => {
            initCV({});
            setTemplatesLoaded(true);

            cleanupCV();

            expect(isTemplatesLoaded()).toBe(false);
        });

        it('should reset priorityTemplatesLoaded flag', () => {
            initCV({});
            setPriorityTemplatesLoaded(true);

            cleanupCV();

            expect(isPriorityTemplatesLoaded()).toBe(false);
        });

        it('should reset allData', () => {
            initCV({ items: { items: [] } } as any);

            cleanupCV();

            expect(getAllData()).toEqual({});
        });

        it('should log cleanup info', () => {
            initCV({});

            cleanupCV();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.cleanup',
                    data: expect.objectContaining({
                        message: 'CV module cleaned up',
                    }),
                })
            );
        });

        it('should be safe to call multiple times', () => {
            initCV({});
            cleanupCV();
            cleanupCV();
            cleanupCV();

            expect(getDetectionCache().size).toBe(0);
        });

        it('should be safe to call without prior init', () => {
            expect(() => cleanupCV()).not.toThrow();
        });
    });

    // ========================================
    // startCacheCleanup Tests
    // ========================================
    describe('startCacheCleanup', () => {
        it('should set cache cleanup timer', () => {
            expect(getCacheCleanupTimer()).toBeNull();

            startCacheCleanup();

            expect(getCacheCleanupTimer()).not.toBeNull();
        });

        it('should not create duplicate timers', () => {
            startCacheCleanup();
            const timer1 = getCacheCleanupTimer();

            startCacheCleanup();
            const timer2 = getCacheCleanupTimer();

            expect(timer1).toBe(timer2);
        });

        it('should evict expired cache entries on interval', () => {
            startCacheCleanup();
            const cache = getDetectionCache();

            // Add expired entry
            const expiredTime = Date.now() - CACHE_TTL - 1000;
            cache.set('expired', { results: [], timestamp: expiredTime });

            // Add valid entry
            cache.set('valid', { results: [], timestamp: Date.now() });

            // Fast-forward 5 minutes (cleanup interval)
            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(cache.has('expired')).toBe(false);
            expect(cache.has('valid')).toBe(true);
        });

        it('should evict oldest entries when over max size', () => {
            startCacheCleanup();
            const cache = getDetectionCache();

            // Add more than MAX_CACHE_SIZE entries
            const now = Date.now();
            for (let i = 0; i < MAX_CACHE_SIZE + 20; i++) {
                cache.set(`hash_${i}`, {
                    results: [],
                    timestamp: now - i * 1000, // Older entries have smaller timestamps
                });
            }

            // Fast-forward 5 minutes (cleanup interval)
            vi.advanceTimersByTime(5 * 60 * 1000);

            // Should have removed entries to get under MAX_CACHE_SIZE
            expect(cache.size).toBeLessThanOrEqual(MAX_CACHE_SIZE);
        });

        it('should log when entries are evicted', () => {
            startCacheCleanup();
            const cache = getDetectionCache();

            // Add expired entry
            cache.set('expired', { results: [], timestamp: Date.now() - CACHE_TTL - 1000 });

            // Fast-forward 5 minutes
            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.cache_cleanup',
                    data: expect.objectContaining({
                        evicted: expect.any(Number),
                        remaining: expect.any(Number),
                    }),
                })
            );
        });

        it('should not log when no entries evicted', () => {
            startCacheCleanup();
            vi.clearAllMocks();

            // Fast-forward 5 minutes with empty cache
            vi.advanceTimersByTime(5 * 60 * 1000);

            // Should not have called logger.info for cache cleanup
            const calls = (logger.info as any).mock.calls;
            const cacheCleanupCalls = calls.filter(
                (call: any) => call[0]?.operation === 'cv.cache_cleanup'
            );
            expect(cacheCleanupCalls).toHaveLength(0);
        });
    });

    // ========================================
    // stopCacheCleanup Tests
    // ========================================
    describe('stopCacheCleanup', () => {
        it('should clear cache cleanup timer', () => {
            startCacheCleanup();
            expect(getCacheCleanupTimer()).not.toBeNull();

            stopCacheCleanup();
            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should be safe to call when no timer running', () => {
            expect(() => stopCacheCleanup()).not.toThrow();
            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should be safe to call multiple times', () => {
            startCacheCleanup();
            stopCacheCleanup();
            stopCacheCleanup();
            stopCacheCleanup();

            expect(getCacheCleanupTimer()).toBeNull();
        });

        it('should prevent further cache cleanups', () => {
            startCacheCleanup();
            const cache = getDetectionCache();

            // Add expired entry
            cache.set('expired', { results: [], timestamp: Date.now() - CACHE_TTL - 1000 });

            stopCacheCleanup();

            // Fast-forward 5 minutes
            vi.advanceTimersByTime(5 * 60 * 1000);

            // Expired entry should still be there
            expect(cache.has('expired')).toBe(true);
        });
    });

    // ========================================
    // isFullyLoaded Tests
    // ========================================
    describe('isFullyLoaded', () => {
        it('should return false by default', () => {
            expect(isFullyLoaded()).toBe(false);
        });

        it('should return true when templatesLoaded is true', () => {
            setTemplatesLoaded(true);
            expect(isFullyLoaded()).toBe(true);
        });

        it('should return false when templatesLoaded is false', () => {
            setTemplatesLoaded(false);
            expect(isFullyLoaded()).toBe(false);
        });

        it('should be independent of priorityTemplatesLoaded', () => {
            setPriorityTemplatesLoaded(true);
            setTemplatesLoaded(false);

            expect(isFullyLoaded()).toBe(false);
        });
    });

    // ========================================
    // isPriorityLoaded Tests
    // ========================================
    describe('isPriorityLoaded', () => {
        it('should return false by default', () => {
            expect(isPriorityLoaded()).toBe(false);
        });

        it('should return true when priorityTemplatesLoaded is true', () => {
            setPriorityTemplatesLoaded(true);
            expect(isPriorityLoaded()).toBe(true);
        });

        it('should return false when priorityTemplatesLoaded is false', () => {
            setPriorityTemplatesLoaded(false);
            expect(isPriorityLoaded()).toBe(false);
        });

        it('should be independent of templatesLoaded', () => {
            setTemplatesLoaded(true);
            setPriorityTemplatesLoaded(false);

            expect(isPriorityLoaded()).toBe(false);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support full CV lifecycle', () => {
            // 1. Initialize
            const gameData = {
                items: {
                    items: [
                        { id: 'sword', name: 'Sword', rarity: 'common' },
                        { id: 'shield', name: 'Shield', rarity: 'rare' },
                    ],
                },
            };
            initCV(gameData as any);

            expect(getAllData().items?.items).toHaveLength(2);
            expect(getCacheCleanupTimer()).not.toBeNull();

            // 2. Simulate template loading
            setPriorityTemplatesLoaded(true);
            expect(isPriorityLoaded()).toBe(true);
            expect(isFullyLoaded()).toBe(false);

            setTemplatesLoaded(true);
            expect(isFullyLoaded()).toBe(true);

            // 3. Simulate detection with caching
            const cache = getDetectionCache();
            cache.set('screenshot_1', {
                results: [{ itemId: 'sword', confidence: 0.95 }] as any,
                timestamp: Date.now(),
            });

            // 4. Cleanup
            cleanupCV();

            expect(getAllData()).toEqual({});
            expect(getDetectionCache().size).toBe(0);
            expect(isFullyLoaded()).toBe(false);
            expect(isPriorityLoaded()).toBe(false);
        });

        it('should handle reinitialize after cleanup', () => {
            // First initialization
            initCV({ items: { items: [{ id: 'old' }] } } as any);
            getItemTemplates().set('old', {} as any);
            setTemplatesLoaded(true);

            // Cleanup
            cleanupCV();

            // Second initialization
            initCV({ items: { items: [{ id: 'new' }] } } as any);

            expect(getAllData().items?.items[0].id).toBe('new');
            expect(getItemTemplates().size).toBe(0); // Templates need to be reloaded
            expect(isFullyLoaded()).toBe(false);
        });

        it('should clean up expired cache entries over time', () => {
            initCV({});
            const cache = getDetectionCache();

            // Add entry that will expire
            cache.set('will_expire', { results: [], timestamp: Date.now() });

            // Fast forward past TTL
            vi.advanceTimersByTime(CACHE_TTL + 5 * 60 * 1000);

            expect(cache.has('will_expire')).toBe(false);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle gameData with nested null values', () => {
            const gameData = {
                items: null,
                weapons: undefined,
                tomes: { tomes: null },
            };

            expect(() => initCV(gameData as any)).not.toThrow();
        });

        it('should handle rapid init/cleanup cycles', () => {
            for (let i = 0; i < 10; i++) {
                initCV({ items: { items: [{ id: `item_${i}` }] } } as any);
                cleanupCV();
            }

            expect(getAllData()).toEqual({});
        });

        it('should handle cache entries at exactly TTL boundary', () => {
            startCacheCleanup();
            const cache = getDetectionCache();

            // Add entry exactly at TTL boundary
            cache.set('boundary', { results: [], timestamp: Date.now() - CACHE_TTL });

            vi.advanceTimersByTime(5 * 60 * 1000);

            // Entry at exact boundary should be evicted
            expect(cache.has('boundary')).toBe(false);
        });

        it('should handle empty items array', () => {
            initCV({ items: { items: [] } } as any);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        itemsCount: 0,
                    }),
                })
            );
        });
    });
});
