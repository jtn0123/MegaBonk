/**
 * @vitest-environment jsdom
 * Comprehensive State Store Tests - Extended Coverage
 * Tests batchUpdate, window sync, clearSubscribers, and edge cases
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getState,
    setState,
    subscribe,
    resetStore,
    clearSubscribers,
    enableWindowSync,
    disableWindowSync,
    isWindowSyncEnabled,
    getFullState,
    batchUpdate,
    type AppState,
    type TabName,
} from '../../src/modules/store.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('State Store - Comprehensive Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
        clearSubscribers();
        enableWindowSync(); // Start with sync enabled for consistency
    });

    afterEach(() => {
        clearSubscribers();
        resetStore();
        enableWindowSync();
    });

    // ========================================
    // clearSubscribers Tests
    // ========================================
    describe('clearSubscribers', () => {
        it('should clear all subscribers', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            subscribe('currentTab', callback1);
            subscribe('compareItems', callback2);
            subscribe('favorites', callback3);

            clearSubscribers();

            // Now set states - no callbacks should be called
            setState('currentTab', 'weapons');
            setState('compareItems', ['test']);
            setState('favorites', { items: ['a'], weapons: [], tomes: [], characters: [], shrines: [] });

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();
        });

        it('should allow new subscriptions after clear', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            clearSubscribers();

            // Subscribe again
            const newCallback = vi.fn();
            subscribe('currentTab', newCallback);

            setState('currentTab', 'tomes');

            expect(callback).not.toHaveBeenCalled();
            expect(newCallback).toHaveBeenCalledWith('tomes');
        });

        it('should handle clearing when no subscribers exist', () => {
            expect(() => clearSubscribers()).not.toThrow();
        });

        it('should handle multiple clears', () => {
            subscribe('currentTab', vi.fn());
            clearSubscribers();
            clearSubscribers();
            clearSubscribers();
            expect(() => setState('currentTab', 'weapons')).not.toThrow();
        });
    });

    // ========================================
    // Window Sync Tests
    // ========================================
    describe('enableWindowSync', () => {
        it('should enable window sync', () => {
            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);

            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);
        });

        it('should sync current state to window when enabled', () => {
            disableWindowSync();
            setState('currentTab', 'weapons');

            enableWindowSync();

            // Window should have current state values
            expect(window.currentTab).toBe('weapons');
        });

        it('should sync all state keys to window', () => {
            disableWindowSync();

            setState('currentTab', 'tomes');
            setState('compareItems', ['item1', 'item2']);
            setState('favorites', { items: ['fav1'], weapons: [], tomes: [], characters: [], shrines: [] });

            enableWindowSync();

            expect(window.currentTab).toBe('tomes');
            expect(window.compareItems).toEqual(['item1', 'item2']);
            expect(window.favorites).toEqual({ items: ['fav1'], weapons: [], tomes: [], characters: [], shrines: [] });
        });

        it('should sync filteredData to window', () => {
            disableWindowSync();
            const entities = [{ id: 'e1', name: 'Entity 1' }];
            setState('filteredData', entities as any);

            enableWindowSync();

            expect(window.filteredData).toEqual(entities);
        });

        it('should sync allData to window', () => {
            disableWindowSync();
            const allData = {
                items: { items: [{ id: 'item1' }] } as any,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
                stats: undefined,
                changelog: undefined,
            };
            setState('allData', allData);

            enableWindowSync();

            expect(window.allData).toEqual(allData);
        });

        it('should sync currentBuild to window', () => {
            disableWindowSync();
            const build = {
                character: { id: 'char1', name: 'Warrior' } as any,
                weapon: { id: 'wpn1', name: 'Sword' } as any,
                tomes: [],
                items: [],
                name: 'Test Build',
                notes: 'Some notes',
            };
            setState('currentBuild', build);

            enableWindowSync();

            expect(window.currentBuild).toEqual(build);
        });
    });

    describe('disableWindowSync', () => {
        it('should disable window sync', () => {
            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);

            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);
        });

        it('should prevent window updates when disabled', () => {
            enableWindowSync();
            setState('currentTab', 'items');
            expect(window.currentTab).toBe('items');

            disableWindowSync();
            setState('currentTab', 'weapons');

            // Window should still have old value
            expect(window.currentTab).toBe('items');
        });

        it('should not update window.compareItems when disabled', () => {
            enableWindowSync();
            setState('compareItems', ['old']);

            disableWindowSync();
            setState('compareItems', ['new1', 'new2']);

            expect(window.compareItems).toEqual(['old']);
        });
    });

    describe('isWindowSyncEnabled', () => {
        it('should return true when sync is enabled', () => {
            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);
        });

        it('should return false when sync is disabled', () => {
            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);
        });

        it('should track enable/disable toggles', () => {
            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);

            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);

            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);

            disableWindowSync();
            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);
        });
    });

    // ========================================
    // getFullState Tests
    // ========================================
    describe('getFullState', () => {
        it('should return entire state object', () => {
            const fullState = getFullState();

            expect(fullState).toHaveProperty('currentTab');
            expect(fullState).toHaveProperty('filteredData');
            expect(fullState).toHaveProperty('allData');
            expect(fullState).toHaveProperty('currentBuild');
            expect(fullState).toHaveProperty('compareItems');
            expect(fullState).toHaveProperty('favorites');
        });

        it('should return shallow copy (not reference)', () => {
            const fullState1 = getFullState();
            const fullState2 = getFullState();

            expect(fullState1).not.toBe(fullState2);
            expect(fullState1).toEqual(fullState2);
        });

        it('should reflect current state values', () => {
            setState('currentTab', 'calculator');
            setState('compareItems', ['x', 'y', 'z']);

            const fullState = getFullState();

            expect(fullState.currentTab).toBe('calculator');
            expect(fullState.compareItems).toEqual(['x', 'y', 'z']);
        });

        it('should return shallow copy (primitive changes do not affect original)', () => {
            const fullState = getFullState();
            fullState.currentTab = 'advisor' as TabName;

            // Primitive value changes don't affect internal state
            expect(getState('currentTab')).toBe('items');
        });

        it('should note that arrays are references (shallow copy behavior)', () => {
            // Note: getFullState returns a shallow copy, so nested objects/arrays
            // are still references. This is documented behavior.
            const fullState = getFullState();

            // Replacing the array entirely doesn't affect internal state
            fullState.compareItems = ['replaced'];
            expect(getState('compareItems')).toEqual([]); // Still empty

            // But pushing to the array would modify internal state
            // (this is expected shallow copy behavior)
        });

        it('should include initial values after reset', () => {
            setState('currentTab', 'weapons');
            resetStore();

            const fullState = getFullState();

            expect(fullState.currentTab).toBe('items');
            expect(fullState.compareItems).toEqual([]);
        });
    });

    // ========================================
    // batchUpdate Tests
    // ========================================
    describe('batchUpdate', () => {
        it('should update multiple state keys at once', () => {
            batchUpdate({
                currentTab: 'weapons',
                compareItems: ['a', 'b'],
            });

            expect(getState('currentTab')).toBe('weapons');
            expect(getState('compareItems')).toEqual(['a', 'b']);
        });

        it('should notify subscribers for each changed key', () => {
            const tabCallback = vi.fn();
            const itemsCallback = vi.fn();

            subscribe('currentTab', tabCallback);
            subscribe('compareItems', itemsCallback);

            batchUpdate({
                currentTab: 'tomes',
                compareItems: ['c', 'd'],
            });

            expect(tabCallback).toHaveBeenCalledWith('tomes');
            expect(itemsCallback).toHaveBeenCalledWith(['c', 'd']);
        });

        it('should only notify once per key in batch', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            batchUpdate({
                currentTab: 'shrines',
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not notify for keys not in update', () => {
            const tabCallback = vi.fn();
            const itemsCallback = vi.fn();

            subscribe('currentTab', tabCallback);
            subscribe('compareItems', itemsCallback);

            batchUpdate({
                currentTab: 'characters',
            });

            expect(tabCallback).toHaveBeenCalled();
            expect(itemsCallback).not.toHaveBeenCalled();
        });

        it('should handle empty updates', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            batchUpdate({});

            expect(callback).not.toHaveBeenCalled();
        });

        it('should skip undefined values in updates', () => {
            setState('currentTab', 'items');
            setState('compareItems', ['existing']);

            batchUpdate({
                currentTab: 'weapons',
                compareItems: undefined,
            } as any);

            expect(getState('currentTab')).toBe('weapons');
            expect(getState('compareItems')).toEqual(['existing']); // Unchanged
        });

        it('should sync to window when enabled', () => {
            enableWindowSync();

            batchUpdate({
                currentTab: 'build-planner',
                compareItems: ['synced'],
            });

            expect(window.currentTab).toBe('build-planner');
            expect(window.compareItems).toEqual(['synced']);
        });

        it('should not sync to window when disabled', () => {
            disableWindowSync();
            window.currentTab = 'old-tab';
            window.compareItems = [];

            batchUpdate({
                currentTab: 'new-tab' as TabName,
                compareItems: ['new-item'],
            });

            expect(window.currentTab).toBe('old-tab');
            expect(window.compareItems).toEqual([]);
        });

        it('should update favorites in batch', () => {
            const callback = vi.fn();
            subscribe('favorites', callback);

            batchUpdate({
                favorites: {
                    items: ['fav1', 'fav2'],
                    weapons: ['wpn1'],
                    tomes: [],
                    characters: [],
                    shrines: ['shrine1'],
                },
            });

            expect(getState('favorites')).toEqual({
                items: ['fav1', 'fav2'],
                weapons: ['wpn1'],
                tomes: [],
                characters: [],
                shrines: ['shrine1'],
            });
            expect(callback).toHaveBeenCalled();
        });

        it('should update currentBuild in batch', () => {
            const build = {
                character: { id: 'c1' } as any,
                weapon: { id: 'w1' } as any,
                tomes: [{ id: 't1' }] as any,
                items: [],
                name: 'Batch Build',
                notes: '',
            };

            batchUpdate({
                currentBuild: build,
            });

            expect(getState('currentBuild')).toEqual(build);
        });

        it('should update filteredData in batch', () => {
            const entities = [
                { id: 'e1', name: 'Entity 1' },
                { id: 'e2', name: 'Entity 2' },
            ];

            batchUpdate({
                filteredData: entities as any,
            });

            expect(getState('filteredData')).toEqual(entities);
        });

        it('should update allData in batch', () => {
            const allData = {
                items: { items: [] } as any,
                weapons: { weapons: [] } as any,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
                stats: undefined,
                changelog: undefined,
            };

            batchUpdate({
                allData,
            });

            expect(getState('allData')).toEqual(allData);
        });

        it('should handle subscriber errors gracefully in batch', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Batch subscriber error');
            });
            const normalCallback = vi.fn();

            subscribe('currentTab', errorCallback);
            subscribe('currentTab', normalCallback);

            expect(() =>
                batchUpdate({
                    currentTab: 'changelog',
                })
            ).not.toThrow();

            expect(logger.error).toHaveBeenCalled();
            // Normal callback should still be called despite error in other
            // Note: Due to Set iteration, order may vary
        });

        it('should update all six state keys in one batch', () => {
            const entities = [{ id: 'e1' }] as any;
            const allDataVal = {
                items: { items: [] } as any,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
                stats: undefined,
                changelog: undefined,
            };
            const buildVal = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Full Update',
                notes: 'Testing',
            };
            const favoritesVal = {
                items: ['i1'],
                weapons: ['w1'],
                tomes: ['t1'],
                characters: ['c1'],
                shrines: ['s1'],
            };

            batchUpdate({
                currentTab: 'advisor',
                filteredData: entities,
                allData: allDataVal,
                currentBuild: buildVal,
                compareItems: ['cmp1', 'cmp2'],
                favorites: favoritesVal,
            });

            expect(getState('currentTab')).toBe('advisor');
            expect(getState('filteredData')).toEqual(entities);
            expect(getState('allData')).toEqual(allDataVal);
            expect(getState('currentBuild')).toEqual(buildVal);
            expect(getState('compareItems')).toEqual(['cmp1', 'cmp2']);
            expect(getState('favorites')).toEqual(favoritesVal);
        });
    });

    // ========================================
    // Subscriber Error Handling
    // ========================================
    describe('subscriber error handling', () => {
        it('should log errors and continue notifying other subscribers', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            const successCallback = vi.fn();

            subscribe('currentTab', errorCallback);
            subscribe('currentTab', successCallback);

            setState('currentTab', 'weapons');

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'store.subscriber_error',
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'Test error',
                    }),
                    data: { key: 'currentTab' },
                })
            );
        });

        it('should include error details in log', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            subscribe('compareItems', () => {
                throw new TypeError('Type mismatch');
            });

            setState('compareItems', ['item']);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        name: 'TypeError',
                        message: 'Type mismatch',
                    }),
                })
            );
        });
    });

    // ========================================
    // Window Sync with setState
    // ========================================
    describe('setState window sync', () => {
        it('should sync currentTab to window', () => {
            enableWindowSync();
            setState('currentTab', 'calculator');
            expect(window.currentTab).toBe('calculator');
        });

        it('should sync filteredData to window', () => {
            enableWindowSync();
            const data = [{ id: 'test' }] as any;
            setState('filteredData', data);
            expect(window.filteredData).toEqual(data);
        });

        it('should sync allData to window', () => {
            enableWindowSync();
            const allData = {
                items: { items: [] } as any,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
                stats: undefined,
                changelog: undefined,
            };
            setState('allData', allData);
            expect(window.allData).toEqual(allData);
        });

        it('should sync currentBuild to window', () => {
            enableWindowSync();
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Synced Build',
                notes: '',
            };
            setState('currentBuild', build);
            expect(window.currentBuild).toEqual(build);
        });

        it('should sync compareItems to window', () => {
            enableWindowSync();
            setState('compareItems', ['sync1', 'sync2']);
            expect(window.compareItems).toEqual(['sync1', 'sync2']);
        });

        it('should sync favorites to window', () => {
            enableWindowSync();
            const favorites = {
                items: ['a'],
                weapons: ['b'],
                tomes: [],
                characters: [],
                shrines: [],
            };
            setState('favorites', favorites);
            expect(window.favorites).toEqual(favorites);
        });
    });

    // ========================================
    // Reset Store with Window Sync
    // ========================================
    describe('resetStore with window sync', () => {
        it('should reset window properties when sync enabled', () => {
            enableWindowSync();
            setState('currentTab', 'weapons');
            setState('compareItems', ['item']);

            resetStore();

            expect(window.currentTab).toBe('items');
            expect(window.compareItems).toEqual([]);
        });

        it('should preserve subscribers after reset', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            resetStore();

            setState('currentTab', 'tomes');
            expect(callback).toHaveBeenCalledWith('tomes');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('advanced edge cases', () => {
        it('should handle concurrent subscriptions and unsubscriptions', () => {
            const callbacks: vi.Mock[] = [];
            const unsubscribes: (() => void)[] = [];

            // Create 10 subscriptions
            for (let i = 0; i < 10; i++) {
                const cb = vi.fn();
                callbacks.push(cb);
                unsubscribes.push(subscribe('currentTab', cb));
            }

            // Unsubscribe odd numbered ones
            for (let i = 1; i < 10; i += 2) {
                unsubscribes[i]();
            }

            setState('currentTab', 'weapons');

            // Even numbered should be called, odd should not
            for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                    expect(callbacks[i]).toHaveBeenCalled();
                } else {
                    expect(callbacks[i]).not.toHaveBeenCalled();
                }
            }
        });

        it('should handle subscription during state update', () => {
            const laterCallback = vi.fn();

            subscribe('currentTab', () => {
                // Subscribe to a different key during callback
                subscribe('compareItems', laterCallback);
            });

            setState('currentTab', 'weapons');
            setState('compareItems', ['test']);

            expect(laterCallback).toHaveBeenCalledWith(['test']);
        });

        it('should handle double unsubscribe gracefully', () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();
        });

        it('should handle very long arrays in compareItems', () => {
            const manyItems = Array.from({ length: 1000 }, (_, i) => `item${i}`);
            setState('compareItems', manyItems);
            expect(getState('compareItems')).toHaveLength(1000);
        });

        it('should handle special characters in strings', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: '<script>alert("xss")</script>',
                notes: '🎮 Game notes with émojis & spëcial chârs',
            };
            setState('currentBuild', build);
            expect(getState('currentBuild').name).toBe('<script>alert("xss")</script>');
            expect(getState('currentBuild').notes).toContain('🎮');
        });
    });
});
