/**
 * @vitest-environment jsdom
 * Centralized State Store Tests
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

/** Flush pending queueMicrotask callbacks */
const flushMicrotasks = () => new Promise<void>(r => queueMicrotask(r));

describe('State Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
        clearSubscribers();
        enableWindowSync(); // Ensure consistent state for tests
    });

    afterEach(() => {
        resetStore();
        clearSubscribers();
    });

    // ========================================
    // getState Tests
    // ========================================
    describe('getState', () => {
        it('should return initial state for currentTab', () => {
            const tab = getState('currentTab');
            expect(tab).toBe('items');
        });

        it('should return empty array for filteredData', () => {
            const data = getState('filteredData');
            expect(data).toEqual([]);
        });

        it('should return empty array for compareItems', () => {
            const items = getState('compareItems');
            expect(items).toEqual([]);
        });

        it('should return initial build state', () => {
            const build = getState('currentBuild');
            expect(build).toMatchObject({
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            });
        });

        it('should return initial favorites state', () => {
            const favorites = getState('favorites');
            expect(favorites).toMatchObject({
                items: [],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });
        });

        it('should return undefined allData initially', () => {
            const allData = getState('allData');
            expect(allData.items).toBeUndefined();
            expect(allData.weapons).toBeUndefined();
        });
    });

    // ========================================
    // setState Tests
    // ========================================
    describe('setState', () => {
        it('should update currentTab', () => {
            setState('currentTab', 'weapons');
            expect(getState('currentTab')).toBe('weapons');
        });

        it('should update compareItems', () => {
            setState('compareItems', ['item1', 'item2']);
            expect(getState('compareItems')).toEqual(['item1', 'item2']);
        });

        it('should update filteredData', () => {
            const data = [{ id: 'test', name: 'Test' }];
            setState('filteredData', data as any);
            expect(getState('filteredData')).toEqual(data);
        });

        it('should update currentBuild', () => {
            const build = {
                character: { id: 'warrior', name: 'Warrior' } as any,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Test Build',
                notes: '',
            };
            setState('currentBuild', build);
            expect(getState('currentBuild')).toEqual(build);
        });

        it('should update favorites', () => {
            const favorites = {
                items: ['sword', 'shield'],
                weapons: ['axe'],
                tomes: [],
                characters: [],
                shrines: [],
            };
            setState('favorites', favorites);
            expect(getState('favorites')).toEqual(favorites);
        });

        it('should handle multiple updates', () => {
            setState('currentTab', 'tomes');
            setState('compareItems', ['a']);
            setState('currentTab', 'characters');
            
            expect(getState('currentTab')).toBe('characters');
            expect(getState('compareItems')).toEqual(['a']);
        });
    });

    // ========================================
    // subscribe Tests
    // ========================================
    describe('subscribe', () => {
        it('should call subscriber when state changes', async () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            setState('currentTab', 'weapons');
            await flushMicrotasks();
            
            expect(callback).toHaveBeenCalledWith('weapons');
        });

        it('should not call subscriber for different key changes', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            setState('compareItems', ['test']);
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should call multiple subscribers', async () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            subscribe('currentTab', callback1);
            subscribe('currentTab', callback2);
            
            setState('currentTab', 'shrines');
            await flushMicrotasks();
            
            expect(callback1).toHaveBeenCalledWith('shrines');
            expect(callback2).toHaveBeenCalledWith('shrines');
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);
            
            unsubscribe();
            setState('currentTab', 'calculator');
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should handle unsubscribe correctly with multiple subscribers', async () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            const unsub1 = subscribe('currentTab', callback1);
            subscribe('currentTab', callback2);
            
            unsub1();
            setState('currentTab', 'advisor');
            await flushMicrotasks();
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith('advisor');
        });

        it('should receive new value in subscriber', async () => {
            let receivedValue: TabName | null = null;
            subscribe('currentTab', (value) => {
                receivedValue = value;
            });
            
            setState('currentTab', 'changelog');
            await flushMicrotasks();
            
            expect(receivedValue).toBe('changelog');
        });
    });

    // ========================================
    // resetStore Tests
    // ========================================
    describe('resetStore', () => {
        it('should reset state to initial values', () => {
            setState('currentTab', 'weapons');
            setState('compareItems', ['item1', 'item2', 'item3']);
            
            resetStore();
            
            expect(getState('currentTab')).toBe('items');
            expect(getState('compareItems')).toEqual([]);
        });

        it('should reset currentBuild', () => {
            setState('currentBuild', {
                character: { id: 'test' } as any,
                weapon: { id: 'weapon' } as any,
                tomes: [{ id: 'tome' }] as any,
                items: [{ id: 'item' }] as any,
                name: 'My Build',
                notes: 'Notes',
            });
            
            resetStore();
            
            const build = getState('currentBuild');
            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
            expect(build.tomes).toEqual([]);
            expect(build.items).toEqual([]);
        });

        it('should reset favorites', () => {
            setState('favorites', {
                items: ['a', 'b'],
                weapons: ['c'],
                tomes: ['d'],
                characters: ['e'],
                shrines: ['f'],
            });
            
            resetStore();
            
            const favorites = getState('favorites');
            expect(favorites.items).toEqual([]);
            expect(favorites.weapons).toEqual([]);
        });
    });

    // ========================================
    // Tab Name Tests
    // ========================================
    describe('TabName types', () => {
        const validTabs: TabName[] = [
            'items',
            'weapons',
            'tomes',
            'characters',
            'shrines',
            'build-planner',
            'calculator',
            'advisor',
            'changelog',
        ];

        it.each(validTabs)('should accept %s as a valid tab', (tab) => {
            setState('currentTab', tab);
            expect(getState('currentTab')).toBe(tab);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty array updates', () => {
            setState('compareItems', ['a', 'b']);
            setState('compareItems', []);
            expect(getState('compareItems')).toEqual([]);
        });

        it('should handle null values in build', () => {
            setState('currentBuild', {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: '',
                notes: '',
            });
            
            const build = getState('currentBuild');
            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
        });

        it('should handle rapid state changes', () => {
            for (let i = 0; i < 100; i++) {
                setState('compareItems', [`item${i}`]);
            }
            expect(getState('compareItems')).toEqual(['item99']);
        });

        it('should handle subscriber errors gracefully', () => {
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Subscriber error');
            });
            const normalCallback = vi.fn();
            
            subscribe('currentTab', errorCallback);
            subscribe('currentTab', normalCallback);
            
            // Should not throw, other subscribers should still be called
            expect(() => setState('currentTab', 'weapons')).not.toThrow();
        });

        it('should continue calling other subscribers after one throws', async () => {
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Subscriber error');
            });
            const normalCallback = vi.fn();
            
            subscribe('currentTab', errorCallback);
            subscribe('currentTab', normalCallback);
            
            setState('currentTab', 'weapons');
            await flushMicrotasks();
            
            // Both should have been called - normal callback should still work
            expect(errorCallback).toHaveBeenCalledWith('weapons');
            expect(normalCallback).toHaveBeenCalledWith('weapons');
        });
    });

    // ========================================
    // clearSubscribers Tests
    // ========================================
    describe('clearSubscribers', () => {
        it('should remove all subscribers', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            subscribe('currentTab', callback1);
            subscribe('compareItems', callback2);
            
            clearSubscribers();
            
            setState('currentTab', 'weapons');
            setState('compareItems', ['item1']);
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });

        it('should allow new subscriptions after clearing', async () => {
            const callback = vi.fn();
            
            subscribe('currentTab', callback);
            clearSubscribers();
            
            const newCallback = vi.fn();
            subscribe('currentTab', newCallback);
            
            setState('currentTab', 'tomes');
            await flushMicrotasks();
            
            expect(callback).not.toHaveBeenCalled();
            expect(newCallback).toHaveBeenCalledWith('tomes');
        });

        it('should handle clearing when no subscribers exist', () => {
            expect(() => clearSubscribers()).not.toThrow();
        });
    });

    // ========================================
    // Window Sync Tests
    // ========================================
    describe('window sync', () => {
        it('should start with window sync enabled', () => {
            enableWindowSync(); // Reset to known state
            expect(isWindowSyncEnabled()).toBe(true);
        });

        it('should disable window sync', () => {
            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);
        });

        it('should enable window sync', () => {
            disableWindowSync();
            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);
        });

        it('should sync currentTab to window when enabled', () => {
            enableWindowSync();
            setState('currentTab', 'weapons');
            expect(window.currentTab).toBe('weapons');
        });

        it('should sync filteredData to window when enabled', () => {
            enableWindowSync();
            const data = [{ id: 'test', name: 'Test' }];
            setState('filteredData', data as any);
            expect(window.filteredData).toEqual(data);
        });

        it('should sync allData to window when enabled', () => {
            enableWindowSync();
            const allData = {
                items: [{ id: 'item1' }] as any,
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

        it('should sync currentBuild to window when enabled', () => {
            enableWindowSync();
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Test',
                notes: '',
            };
            setState('currentBuild', build);
            expect(window.currentBuild).toEqual(build);
        });

        it('should sync compareItems to window when enabled', () => {
            enableWindowSync();
            setState('compareItems', ['a', 'b', 'c']);
            expect(window.compareItems).toEqual(['a', 'b', 'c']);
        });

        it('should sync favorites to window when enabled', () => {
            enableWindowSync();
            const favorites = {
                items: ['x'],
                weapons: ['y'],
                tomes: [],
                characters: [],
                shrines: [],
            };
            setState('favorites', favorites);
            expect(window.favorites).toEqual(favorites);
        });

        it('should not sync to window when disabled', () => {
            disableWindowSync();
            // Store initial window values
            const initialTab = window.currentTab;
            
            setState('currentTab', 'changelog');
            
            // Window should not have been updated (or at least should reflect old state)
            // Note: In jsdom, window properties may persist, so we check it wasn't updated
            expect(window.currentTab).toBe(initialTab);
        });

        it('should sync all state to window when enabling', () => {
            disableWindowSync();
            setState('currentTab', 'advisor');
            setState('compareItems', ['test1', 'test2']);
            
            enableWindowSync();
            
            expect(window.currentTab).toBe('advisor');
            expect(window.compareItems).toEqual(['test1', 'test2']);
        });

        it('should sync state to window on resetStore when enabled', () => {
            enableWindowSync();
            setState('currentTab', 'weapons');
            
            resetStore();
            
            expect(window.currentTab).toBe('items');
            expect(window.compareItems).toEqual([]);
        });
    });

    // ========================================
    // getFullState Tests
    // ========================================
    describe('getFullState', () => {
        it('should return a copy of the entire state', () => {
            const fullState = getFullState();
            
            expect(fullState).toHaveProperty('currentTab');
            expect(fullState).toHaveProperty('filteredData');
            expect(fullState).toHaveProperty('allData');
            expect(fullState).toHaveProperty('currentBuild');
            expect(fullState).toHaveProperty('compareItems');
            expect(fullState).toHaveProperty('favorites');
        });

        it('should reflect current state values', () => {
            setState('currentTab', 'shrines');
            setState('compareItems', ['item1', 'item2']);
            
            const fullState = getFullState();
            
            expect(fullState.currentTab).toBe('shrines');
            expect(fullState.compareItems).toEqual(['item1', 'item2']);
        });

        it('should return a shallow copy', () => {
            const fullState1 = getFullState();
            const fullState2 = getFullState();
            
            // They should be different objects
            expect(fullState1).not.toBe(fullState2);
            
            // But contain the same values
            expect(fullState1.currentTab).toBe(fullState2.currentTab);
        });

        it('should not allow modifying internal state', () => {
            const fullState = getFullState();
            fullState.currentTab = 'changelog';
            
            // Internal state should be unchanged
            expect(getState('currentTab')).toBe('items');
        });
    });

    // ========================================
    // batchUpdate Tests
    // ========================================
    describe('batchUpdate', () => {
        it('should update multiple state values', () => {
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
                compareItems: ['x'],
            });
            
            expect(tabCallback).toHaveBeenCalledWith('tomes');
            expect(itemsCallback).toHaveBeenCalledWith(['x']);
        });

        it('should only notify subscribers once per key', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            batchUpdate({
                currentTab: 'calculator',
            });
            
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle empty updates', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            batchUpdate({});
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should skip undefined values', () => {
            setState('currentTab', 'weapons');
            
            batchUpdate({
                currentTab: undefined,
                compareItems: ['test'],
            });
            
            // currentTab should be unchanged
            expect(getState('currentTab')).toBe('weapons');
            expect(getState('compareItems')).toEqual(['test']);
        });

        it('should sync to window when enabled', () => {
            enableWindowSync();
            
            batchUpdate({
                currentTab: 'advisor',
                compareItems: ['batch1', 'batch2'],
            });
            
            expect(window.currentTab).toBe('advisor');
            expect(window.compareItems).toEqual(['batch1', 'batch2']);
        });

        it('should not sync to window when disabled', () => {
            disableWindowSync();
            const initialTab = window.currentTab;
            
            batchUpdate({
                currentTab: 'changelog',
            });
            
            expect(window.currentTab).toBe(initialTab);
        });

        it('should update all state keys', () => {
            const build = {
                character: { id: 'hero' } as any,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Batch Build',
                notes: 'From batch',
            };
            const favorites = {
                items: ['fav1'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            };
            const allData = {
                items: [{ id: 'i1' }] as any,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
                stats: undefined,
                changelog: undefined,
            };
            
            batchUpdate({
                currentTab: 'build-planner',
                filteredData: [{ id: 'f1', name: 'Filtered' }] as any,
                allData,
                currentBuild: build,
                compareItems: ['c1', 'c2'],
                favorites,
            });
            
            expect(getState('currentTab')).toBe('build-planner');
            expect(getState('filteredData')).toEqual([{ id: 'f1', name: 'Filtered' }]);
            expect(getState('allData')).toEqual(allData);
            expect(getState('currentBuild')).toEqual(build);
            expect(getState('compareItems')).toEqual(['c1', 'c2']);
            expect(getState('favorites')).toEqual(favorites);
        });

        it('should handle subscriber errors gracefully', () => {
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Batch subscriber error');
            });
            const normalCallback = vi.fn();
            
            subscribe('currentTab', errorCallback);
            subscribe('currentTab', normalCallback);
            
            expect(() => batchUpdate({ currentTab: 'weapons' })).not.toThrow();
            expect(normalCallback).toHaveBeenCalledWith('weapons');
        });
    });

    // ========================================
    // Additional Subscribe Edge Cases
    // ========================================
    describe('subscribe edge cases', () => {
        it('should clean up subscriber map when last subscriber unsubscribes', async () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);
            
            unsubscribe();
            
            // After unsubscribing the only subscriber, re-subscribing should work
            const newCallback = vi.fn();
            subscribe('currentTab', newCallback);
            
            setState('currentTab', 'weapons');
            await flushMicrotasks();
            
            expect(callback).not.toHaveBeenCalled();
            expect(newCallback).toHaveBeenCalledWith('weapons');
        });

        it('should handle subscribing to multiple keys', async () => {
            const results: string[] = [];
            
            subscribe('currentTab', (val) => results.push(`tab:${val}`));
            subscribe('compareItems', (val) => results.push(`items:${val.length}`));
            
            setState('currentTab', 'tomes');
            setState('compareItems', ['a', 'b', 'c']);
            await flushMicrotasks();
            
            expect(results).toContain('tab:tomes');
            expect(results).toContain('items:3');
        });

        it('should handle unsubscribe called multiple times', () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);
            
            unsubscribe();
            unsubscribe(); // Second call should be safe
            
            setState('currentTab', 'weapons');
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
