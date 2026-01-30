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
    type AppState,
    type TabName,
} from '../../src/modules/store.ts';

describe('State Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
    });

    afterEach(() => {
        resetStore();
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
        it('should call subscriber when state changes', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            setState('currentTab', 'weapons');
            
            expect(callback).toHaveBeenCalledWith('weapons');
        });

        it('should not call subscriber for different key changes', () => {
            const callback = vi.fn();
            subscribe('currentTab', callback);
            
            setState('compareItems', ['test']);
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should call multiple subscribers', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            subscribe('currentTab', callback1);
            subscribe('currentTab', callback2);
            
            setState('currentTab', 'shrines');
            
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

        it('should handle unsubscribe correctly with multiple subscribers', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            const unsub1 = subscribe('currentTab', callback1);
            subscribe('currentTab', callback2);
            
            unsub1();
            setState('currentTab', 'advisor');
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith('advisor');
        });

        it('should receive new value in subscriber', () => {
            let receivedValue: TabName | null = null;
            subscribe('currentTab', (value) => {
                receivedValue = value;
            });
            
            setState('currentTab', 'changelog');
            
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
    });
});
