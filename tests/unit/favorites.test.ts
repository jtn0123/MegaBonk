/**
 * @vitest-environment jsdom
 * Favorites Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    loadFavorites,
    toggleFavorite,
    isFavorite,
    getFavorites,
    clearAllFavorites,
} from '../../src/modules/favorites.ts';
import { getState, setState, resetStore } from '../../src/modules/store.ts';

// Mock ToastManager
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

describe('Favorites Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        resetStore();
    });

    afterEach(() => {
        localStorage.clear();
        resetStore();
    });

    // ========================================
    // loadFavorites Tests
    // ========================================
    describe('loadFavorites', () => {
        it('should return true when localStorage is available', () => {
            const result = loadFavorites();
            expect(result).toBe(true);
        });

        it('should load stored favorites from localStorage', () => {
            const favorites = {
                items: ['item1', 'item2'],
                weapons: ['weapon1'],
                tomes: [],
                characters: [],
                shrines: [],
            };
            localStorage.setItem('megabonk_favorites', JSON.stringify(favorites));

            loadFavorites();

            const state = getState('favorites');
            expect(state.items).toContain('item1');
            expect(state.items).toContain('item2');
            expect(state.weapons).toContain('weapon1');
        });

        it('should handle empty localStorage', () => {
            const result = loadFavorites();
            
            expect(result).toBe(true);
            const state = getState('favorites');
            expect(state.items).toEqual([]);
        });

        it('should handle invalid JSON in localStorage', () => {
            localStorage.setItem('megabonk_favorites', 'not valid json');

            // Should not crash
            expect(() => loadFavorites()).not.toThrow();
        });
    });

    // ========================================
    // toggleFavorite Tests
    // ========================================
    describe('toggleFavorite', () => {
        it('should add item to favorites when not present', () => {
            const result = toggleFavorite('items', 'new_item');

            expect(result).toBe(true);
            expect(getState('favorites').items).toContain('new_item');
        });

        it('should remove item from favorites when already present', () => {
            setState('favorites', {
                items: ['existing_item'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            const result = toggleFavorite('items', 'existing_item');

            expect(result).toBe(false);
            expect(getState('favorites').items).not.toContain('existing_item');
        });

        it('should work with weapons', () => {
            toggleFavorite('weapons', 'sword');
            expect(getState('favorites').weapons).toContain('sword');
        });

        it('should work with tomes', () => {
            toggleFavorite('tomes', 'fire_tome');
            expect(getState('favorites').tomes).toContain('fire_tome');
        });

        it('should work with characters', () => {
            toggleFavorite('characters', 'warrior');
            expect(getState('favorites').characters).toContain('warrior');
        });

        it('should work with shrines', () => {
            toggleFavorite('shrines', 'health_shrine');
            expect(getState('favorites').shrines).toContain('health_shrine');
        });

        it('should toggle multiple times correctly', () => {
            toggleFavorite('items', 'toggle_item'); // Add
            expect(getState('favorites').items).toContain('toggle_item');
            
            toggleFavorite('items', 'toggle_item'); // Remove
            expect(getState('favorites').items).not.toContain('toggle_item');
            
            toggleFavorite('items', 'toggle_item'); // Add again
            expect(getState('favorites').items).toContain('toggle_item');
        });

        it('should not create duplicates', () => {
            toggleFavorite('items', 'unique_item');
            toggleFavorite('items', 'unique_item');
            toggleFavorite('items', 'unique_item'); // Should be added after remove

            const items = getState('favorites').items.filter(i => i === 'unique_item');
            expect(items.length).toBe(1);
        });

        it('should save to localStorage after toggle', () => {
            toggleFavorite('items', 'persisted_item');

            const stored = localStorage.getItem('megabonk_favorites');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.items).toContain('persisted_item');
        });
    });

    // ========================================
    // isFavorite Tests
    // ========================================
    describe('isFavorite', () => {
        it('should return true for favorited item', () => {
            setState('favorites', {
                items: ['fav_item'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            expect(isFavorite('items', 'fav_item')).toBe(true);
        });

        it('should return false for non-favorited item', () => {
            expect(isFavorite('items', 'not_fav')).toBe(false);
        });

        it('should work across different types', () => {
            setState('favorites', {
                items: ['item1'],
                weapons: ['weapon1'],
                tomes: ['tome1'],
                characters: ['char1'],
                shrines: ['shrine1'],
            });

            expect(isFavorite('items', 'item1')).toBe(true);
            expect(isFavorite('weapons', 'weapon1')).toBe(true);
            expect(isFavorite('tomes', 'tome1')).toBe(true);
            expect(isFavorite('characters', 'char1')).toBe(true);
            expect(isFavorite('shrines', 'shrine1')).toBe(true);
        });

        it('should return false for wrong type', () => {
            setState('favorites', {
                items: ['cross_item'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            // Same ID but different type
            expect(isFavorite('weapons', 'cross_item')).toBe(false);
        });
    });

    // ========================================
    // getFavorites Tests
    // ========================================
    describe('getFavorites', () => {
        it('should return favorites for given type', () => {
            setState('favorites', {
                items: ['a', 'b', 'c'],
                weapons: ['x'],
                tomes: [],
                characters: [],
                shrines: [],
            });

            expect(getFavorites('items')).toEqual(['a', 'b', 'c']);
            expect(getFavorites('weapons')).toEqual(['x']);
            expect(getFavorites('tomes')).toEqual([]);
        });

        it('should return empty array for type with no favorites', () => {
            expect(getFavorites('items')).toEqual([]);
        });

        it('should return the correct favorites array', () => {
            setState('favorites', {
                items: ['original'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            const result = getFavorites('items');
            
            expect(result).toContain('original');
            expect(result.length).toBe(1);
        });
    });

    // ========================================
    // clearAllFavorites Tests
    // ========================================
    describe('clearAllFavorites', () => {
        it('should clear all favorites', () => {
            setState('favorites', {
                items: ['a', 'b'],
                weapons: ['c'],
                tomes: ['d'],
                characters: ['e'],
                shrines: ['f'],
            });

            clearAllFavorites();

            const state = getState('favorites');
            expect(state.items).toEqual([]);
            expect(state.weapons).toEqual([]);
            expect(state.tomes).toEqual([]);
            expect(state.characters).toEqual([]);
            expect(state.shrines).toEqual([]);
        });

        it('should clear localStorage', () => {
            localStorage.setItem('megabonk_favorites', JSON.stringify({ items: ['test'] }));

            clearAllFavorites();

            const stored = localStorage.getItem('megabonk_favorites');
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.items).toEqual([]);
            }
        });

        it('should handle already empty favorites', () => {
            expect(() => clearAllFavorites()).not.toThrow();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty string item id', () => {
            toggleFavorite('items', '');
            expect(getState('favorites').items).toContain('');
        });

        it('should handle special characters in id', () => {
            toggleFavorite('items', 'item-with-dashes');
            toggleFavorite('items', 'item_with_underscores');

            expect(getState('favorites').items).toContain('item-with-dashes');
            expect(getState('favorites').items).toContain('item_with_underscores');
        });

        it('should handle rapid toggles', () => {
            for (let i = 0; i < 100; i++) {
                toggleFavorite('items', `item_${i % 10}`);
            }

            // Each item toggled 10 times (even number) = not in favorites
            const state = getState('favorites');
            expect(state.items.length).toBe(0);
        });
    });
});
