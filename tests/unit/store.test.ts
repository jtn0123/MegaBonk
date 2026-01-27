/**
 * @vitest-environment jsdom
 * Store Module - Comprehensive Tests
 * Tests for centralized state management functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger module - use vi.hoisted to ensure mock functions are available before import
const { mockLoggerError } = vi.hoisted(() => ({
    mockLoggerError: vi.fn(),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        error: mockLoggerError,
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

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
    type TabName,
    type AppState,
} from '../../src/modules/store.ts';

describe('Store Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
        clearSubscribers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetStore();
        clearSubscribers();
    });

    // ========================================
    // getState Tests
    // ========================================
    describe('getState', () => {
        it('should return default currentTab value', () => {
            const tab = getState('currentTab');
            expect(tab).toBe('items');
        });

        it('should return default filteredData as empty array', () => {
            const data = getState('filteredData');
            expect(data).toEqual([]);
        });

        it('should return default allData structure', () => {
            const allData = getState('allData');
            expect(allData).toHaveProperty('items');
            expect(allData).toHaveProperty('weapons');
            expect(allData).toHaveProperty('tomes');
            expect(allData).toHaveProperty('characters');
            expect(allData).toHaveProperty('shrines');
            expect(allData).toHaveProperty('stats');
            expect(allData).toHaveProperty('changelog');
        });

        it('should return default currentBuild structure', () => {
            const build = getState('currentBuild');
            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
            expect(build.tomes).toEqual([]);
            expect(build.items).toEqual([]);
        });

        it('should return default compareItems as empty array', () => {
            const items = getState('compareItems');
            expect(items).toEqual([]);
        });

        it('should return default favorites structure', () => {
            const favorites = getState('favorites');
            expect(favorites.items).toEqual([]);
            expect(favorites.weapons).toEqual([]);
            expect(favorites.tomes).toEqual([]);
            expect(favorites.characters).toEqual([]);
            expect(favorites.shrines).toEqual([]);
        });
    });

    // ========================================
    // setState Tests
    // ========================================
    describe('setState', () => {
        it('should update currentTab value', () => {
            setState('currentTab', 'weapons');
            expect(getState('currentTab')).toBe('weapons');
        });

        it('should update filteredData value', () => {
            const mockData = [{ id: 'test', name: 'Test' }];
            setState('filteredData', mockData as any);
            expect(getState('filteredData')).toEqual(mockData);
        });

        it('should update currentBuild value', () => {
            const mockBuild = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
                name: 'Test Build',
                notes: 'Test notes',
            };
            setState('currentBuild', mockBuild);
            expect(getState('currentBuild').name).toBe('Test Build');
        });

        it('should update compareItems value', () => {
            setState('compareItems', ['item1', 'item2']);
            expect(getState('compareItems')).toEqual(['item1', 'item2']);
        });

        it('should update favorites value', () => {
            const mockFavorites = {
                items: ['sword'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            };
            setState('favorites', mockFavorites);
            expect(getState('favorites').items).toContain('sword');
        });

        it('should sync to window when windowSync is enabled', () => {
            enableWindowSync();
            setState('currentTab', 'tomes');
            expect((window as any).currentTab).toBe('tomes');
        });

        it('should not sync to window when windowSync is disabled', () => {
            disableWindowSync();
            (window as any).currentTab = 'items';
            setState('currentTab', 'characters');
            // Window should not be updated
            expect((window as any).currentTab).toBe('items');
        });

        it('should notify subscribers when value changes', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            setState('currentTab', 'shrines');

            expect(callback).toHaveBeenCalledWith('shrines');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should notify multiple subscribers', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            subscribe('currentTab', callback1);
            subscribe('currentTab', callback2);

            setState('currentTab', 'build-planner');

            expect(callback1).toHaveBeenCalledWith('build-planner');
            expect(callback2).toHaveBeenCalledWith('build-planner');
        });
    });

    // ========================================
    // subscribe Tests
    // ========================================
    describe('subscribe', () => {
        it('should return an unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);
            expect(typeof unsubscribe).toBe('function');
        });

        it('should call callback when state changes', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            setState('currentTab', 'calculator');

            expect(callback).toHaveBeenCalledWith('calculator');
        });

        it('should not call callback after unsubscribe', () => {
            const callback = vi.fn();
            const unsubscribe = subscribe('currentTab', callback);

            setState('currentTab', 'weapons');
            expect(callback).toHaveBeenCalledTimes(1);

            unsubscribe();

            setState('currentTab', 'tomes');
            expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it('should handle multiple subscriptions to same key', () => {
            const callbacks = [vi.fn(), vi.fn(), vi.fn()];
            callbacks.forEach(cb => subscribe('filteredData', cb));

            setState('filteredData', []);

            callbacks.forEach(cb => expect(cb).toHaveBeenCalledTimes(1));
        });

        it('should handle subscriptions to different keys independently', () => {
            const tabCallback = vi.fn();
            const dataCallback = vi.fn();
            subscribe('currentTab', tabCallback);
            subscribe('filteredData', dataCallback);

            setState('currentTab', 'items');

            expect(tabCallback).toHaveBeenCalled();
            expect(dataCallback).not.toHaveBeenCalled();
        });

        it('should handle subscriber errors without breaking other subscribers', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Test error');
            });
            const successCallback = vi.fn();

            subscribe('currentTab', errorCallback);
            subscribe('currentTab', successCallback);

            // Should not throw
            expect(() => setState('currentTab', 'weapons')).not.toThrow();

            // Error should be logged via logger
            expect(mockLoggerError).toHaveBeenCalled();

            // Other subscriber should still be called
            expect(successCallback).toHaveBeenCalledWith('weapons');
        });

        it('should clean up subscriber Set when all unsubscribed', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const unsub1 = subscribe('currentTab', callback1);
            const unsub2 = subscribe('currentTab', callback2);

            unsub1();
            unsub2();

            // After unsubscribing, callbacks should not be called
            setState('currentTab', 'weapons');
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // resetStore Tests
    // ========================================
    describe('resetStore', () => {
        it('should reset currentTab to default', () => {
            setState('currentTab', 'calculator');
            resetStore();
            expect(getState('currentTab')).toBe('items');
        });

        it('should reset filteredData to empty array', () => {
            setState('filteredData', [{ id: 'test' }] as any);
            resetStore();
            expect(getState('filteredData')).toEqual([]);
        });

        it('should reset currentBuild to initial state', () => {
            setState('currentBuild', {
                character: { id: 'test' } as any,
                weapon: { id: 'sword' } as any,
                tomes: [],
                items: [],
            });
            resetStore();

            const build = getState('currentBuild');
            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
        });

        it('should reset compareItems to empty array', () => {
            setState('compareItems', ['item1', 'item2']);
            resetStore();
            expect(getState('compareItems')).toEqual([]);
        });

        it('should reset favorites to empty structure', () => {
            setState('favorites', {
                items: ['sword'],
                weapons: ['katana'],
                tomes: ['fire'],
                characters: ['hero'],
                shrines: ['power'],
            });
            resetStore();

            const favorites = getState('favorites');
            expect(favorites.items).toEqual([]);
            expect(favorites.weapons).toEqual([]);
        });

        it('should sync reset values to window when enabled', () => {
            enableWindowSync();
            setState('currentTab', 'weapons');
            resetStore();
            expect((window as any).currentTab).toBe('items');
        });

        it('should not clear subscribers', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            resetStore();
            setState('currentTab', 'weapons');

            expect(callback).toHaveBeenCalledWith('weapons');
        });
    });

    // ========================================
    // clearSubscribers Tests
    // ========================================
    describe('clearSubscribers', () => {
        it('should remove all subscribers', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            subscribe('filteredData', callback);
            subscribe('compareItems', callback);

            clearSubscribers();

            setState('currentTab', 'weapons');
            setState('filteredData', []);
            setState('compareItems', []);

            expect(callback).not.toHaveBeenCalled();
        });

        it('should allow new subscriptions after clearing', () => {
            const oldCallback = vi.fn();
            subscribe('currentTab', oldCallback);

            clearSubscribers();

            const newCallback = vi.fn();
            subscribe('currentTab', newCallback);

            setState('currentTab', 'tomes');

            expect(oldCallback).not.toHaveBeenCalled();
            expect(newCallback).toHaveBeenCalledWith('tomes');
        });
    });

    // ========================================
    // batchUpdate Tests
    // ========================================
    describe('batchUpdate', () => {
        it('should update multiple values at once', () => {
            batchUpdate({
                currentTab: 'weapons',
                compareItems: ['item1', 'item2'],
            });

            expect(getState('currentTab')).toBe('weapons');
            expect(getState('compareItems')).toEqual(['item1', 'item2']);
        });

        it('should notify subscribers for each changed key', () => {
            const tabCallback = vi.fn();
            const compareCallback = vi.fn();
            subscribe('currentTab', tabCallback);
            subscribe('compareItems', compareCallback);

            batchUpdate({
                currentTab: 'tomes',
                compareItems: ['item3'],
            });

            expect(tabCallback).toHaveBeenCalledWith('tomes');
            expect(compareCallback).toHaveBeenCalledWith(['item3']);
        });

        it('should only notify once per key in batch', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            batchUpdate({ currentTab: 'weapons' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should sync to window when enabled', () => {
            enableWindowSync();
            batchUpdate({
                currentTab: 'calculator',
                compareItems: ['test'],
            });

            expect((window as any).currentTab).toBe('calculator');
            expect((window as any).compareItems).toEqual(['test']);
        });

        it('should skip undefined values', () => {
            setState('currentTab', 'items');
            setState('compareItems', ['original']);

            batchUpdate({
                currentTab: 'weapons',
                compareItems: undefined,
            } as any);

            expect(getState('currentTab')).toBe('weapons');
            expect(getState('compareItems')).toEqual(['original']);
        });

        it('should handle subscriber errors without breaking batch', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Test error');
            });
            const successCallback = vi.fn();

            subscribe('currentTab', errorCallback);
            subscribe('compareItems', successCallback);

            expect(() => batchUpdate({
                currentTab: 'weapons',
                compareItems: ['test'],
            })).not.toThrow();

            expect(mockLoggerError).toHaveBeenCalled();
            expect(successCallback).toHaveBeenCalledWith(['test']);
        });

        it('should handle empty batch update', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            batchUpdate({});

            expect(callback).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // enableWindowSync / disableWindowSync Tests
    // ========================================
    describe('enableWindowSync / disableWindowSync', () => {
        it('should enable window sync and update window properties', () => {
            disableWindowSync();
            setState('currentTab', 'weapons');

            enableWindowSync();

            expect((window as any).currentTab).toBe('weapons');
        });

        it('should disable window sync', () => {
            enableWindowSync();
            (window as any).currentTab = 'items';

            disableWindowSync();
            setState('currentTab', 'weapons');

            expect((window as any).currentTab).toBe('items');
        });

        it('should report correct sync status', () => {
            enableWindowSync();
            expect(isWindowSyncEnabled()).toBe(true);

            disableWindowSync();
            expect(isWindowSyncEnabled()).toBe(false);
        });

        it('should sync all state properties to window on enable', () => {
            disableWindowSync();
            setState('currentTab', 'tomes');
            setState('compareItems', ['test']);

            enableWindowSync();

            expect((window as any).currentTab).toBe('tomes');
            expect((window as any).compareItems).toEqual(['test']);
            expect((window as any).filteredData).toEqual([]);
        });
    });

    // ========================================
    // getFullState Tests
    // ========================================
    describe('getFullState', () => {
        it('should return complete state object', () => {
            const fullState = getFullState();

            expect(fullState).toHaveProperty('currentTab');
            expect(fullState).toHaveProperty('filteredData');
            expect(fullState).toHaveProperty('allData');
            expect(fullState).toHaveProperty('currentBuild');
            expect(fullState).toHaveProperty('compareItems');
            expect(fullState).toHaveProperty('favorites');
        });

        it('should return a shallow copy', () => {
            const state1 = getFullState();
            const state2 = getFullState();

            expect(state1).not.toBe(state2);
            expect(state1).toEqual(state2);
        });

        it('should reflect current state values', () => {
            setState('currentTab', 'calculator');
            setState('compareItems', ['item1']);

            const fullState = getFullState();

            expect(fullState.currentTab).toBe('calculator');
            expect(fullState.compareItems).toEqual(['item1']);
        });

        it('should not allow mutation of internal state', () => {
            const fullState = getFullState();
            fullState.currentTab = 'weapons' as TabName;

            expect(getState('currentTab')).toBe('items');
        });
    });

    // ========================================
    // Edge Cases and Integration Tests
    // ========================================
    describe('Edge Cases', () => {
        it('should handle rapid state updates', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            const tabs: TabName[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
            tabs.forEach(tab => setState('currentTab', tab));

            expect(callback).toHaveBeenCalledTimes(5);
            expect(getState('currentTab')).toBe('shrines');
        });

        it('should handle setting same value multiple times', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);

            setState('currentTab', 'items');
            setState('currentTab', 'items');
            setState('currentTab', 'items');

            expect(callback).toHaveBeenCalledTimes(3);
        });

        it('should handle complex nested state updates', () => {
            const complexBuild = {
                character: { id: 'hero', name: 'Hero' } as any,
                weapon: { id: 'sword', name: 'Sword' } as any,
                tomes: [{ id: 'fire' }] as any[],
                items: [{ id: 'potion' }] as any[],
                name: 'My Build',
                notes: 'Some notes',
            };

            setState('currentBuild', complexBuild);

            const retrieved = getState('currentBuild');
            expect(retrieved.character?.id).toBe('hero');
            expect(retrieved.weapon?.id).toBe('sword');
            expect(retrieved.tomes.length).toBe(1);
            expect(retrieved.items.length).toBe(1);
        });

        it('should handle all valid tab names', () => {
            const tabs: TabName[] = [
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

            tabs.forEach(tab => {
                setState('currentTab', tab);
                expect(getState('currentTab')).toBe(tab);
            });
        });
    });
});
