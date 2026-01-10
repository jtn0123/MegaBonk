import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    loadFavorites,
    isFavorite,
    toggleFavorite,
    getFavorites,
    clearAllFavorites,
} from '../../src/modules/favorites.ts';

describe('Favorites Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Clear localStorage before each test
        localStorage.clear();
        // Clear internal state before each test
        clearAllFavorites();
        // Clear localStorage again (clearAllFavorites saves empty state)
        localStorage.clear();
    });

    describe('loadFavorites()', () => {
        it('should load empty favorites when localStorage is empty', () => {
            loadFavorites();

            expect(getFavorites('items')).toHaveLength(0);
            expect(getFavorites('weapons')).toHaveLength(0);
        });

        it('should load existing favorites from localStorage', () => {
            localStorage.setItem(
                'megabonk_favorites',
                JSON.stringify({
                    items: ['gym_sauce', 'beefy_ring'],
                    weapons: ['revolver'],
                    tomes: [],
                    characters: [],
                    shrines: [],
                })
            );

            loadFavorites();

            expect(getFavorites('items')).toEqual(['gym_sauce', 'beefy_ring']);
            expect(getFavorites('weapons')).toEqual(['revolver']);
        });

        it('should handle corrupted localStorage data gracefully', () => {
            localStorage.setItem('megabonk_favorites', 'invalid json{');

            // Should not throw
            expect(() => loadFavorites()).not.toThrow();
        });
    });

    describe('isFavorite()', () => {
        it('should return true for favorited items', () => {
            toggleFavorite('items', 'gym_sauce');

            expect(isFavorite('items', 'gym_sauce')).toBe(true);
        });

        it('should return false for non-favorited items', () => {
            expect(isFavorite('items', 'nonexistent_item')).toBe(false);
        });

        it('should return false for empty tab', () => {
            expect(isFavorite('weapons', 'revolver')).toBe(false);
        });
    });

    describe('toggleFavorite()', () => {
        it('should add item to favorites when not favorited', () => {
            const result = toggleFavorite('items', 'gym_sauce');

            expect(result).toBe(true);
            expect(isFavorite('items', 'gym_sauce')).toBe(true);
        });

        it('should remove item from favorites when already favorited', () => {
            toggleFavorite('items', 'gym_sauce');
            const result = toggleFavorite('items', 'gym_sauce');

            expect(result).toBe(false);
            expect(isFavorite('items', 'gym_sauce')).toBe(false);
        });

        it('should persist favorites to localStorage', () => {
            toggleFavorite('items', 'beefy_ring');

            const stored = JSON.parse(localStorage.getItem('megabonk_favorites') || '{}');
            expect(stored.items).toContain('beefy_ring');
        });

        it('should handle multiple tabs independently', () => {
            toggleFavorite('items', 'gym_sauce');
            toggleFavorite('weapons', 'revolver');
            toggleFavorite('tomes', 'damage');

            expect(isFavorite('items', 'gym_sauce')).toBe(true);
            expect(isFavorite('weapons', 'revolver')).toBe(true);
            expect(isFavorite('tomes', 'damage')).toBe(true);
        });

        it('should handle toggling same item multiple times', () => {
            expect(toggleFavorite('items', 'anvil')).toBe(true);
            expect(toggleFavorite('items', 'anvil')).toBe(false);
            expect(toggleFavorite('items', 'anvil')).toBe(true);
            expect(isFavorite('items', 'anvil')).toBe(true);
        });
    });

    describe('getFavorites()', () => {
        it('should return empty array for tab with no favorites', () => {
            const result = getFavorites('shrines');

            expect(result).toEqual([]);
        });

        it('should return all favorites for a tab', () => {
            toggleFavorite('items', 'gym_sauce');
            toggleFavorite('items', 'beefy_ring');
            toggleFavorite('items', 'anvil');

            const result = getFavorites('items');

            expect(result).toHaveLength(3);
            expect(result).toContain('gym_sauce');
            expect(result).toContain('beefy_ring');
            expect(result).toContain('anvil');
        });
    });

    describe('clearAllFavorites()', () => {
        it('should clear all favorites from all tabs', () => {
            toggleFavorite('items', 'gym_sauce');
            toggleFavorite('weapons', 'revolver');
            toggleFavorite('characters', 'cl4nk');

            clearAllFavorites();

            expect(getFavorites('items')).toHaveLength(0);
            expect(getFavorites('weapons')).toHaveLength(0);
            expect(getFavorites('characters')).toHaveLength(0);
        });

        it('should persist cleared state to localStorage', () => {
            toggleFavorite('items', 'gym_sauce');
            clearAllFavorites();

            const stored = JSON.parse(localStorage.getItem('megabonk_favorites') || '{}');
            expect(stored.items).toHaveLength(0);
        });
    });

    describe('localStorage unavailable', () => {
        it('should handle localStorage.setItem failure gracefully', () => {
            toggleFavorite('items', 'gym_sauce');

            // Mock localStorage.setItem to throw
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('QuotaExceeded');
            });

            // Should not throw even when localStorage fails
            expect(() => toggleFavorite('items', 'beefy_ring')).not.toThrow();

            // Restore
            localStorage.setItem = originalSetItem;
        });

        it('should handle localStorage.getItem failure gracefully', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = vi.fn(() => {
                throw new Error('SecurityError');
            });

            // Should not throw
            expect(() => loadFavorites()).not.toThrow();

            // Restore
            localStorage.getItem = originalGetItem;
        });
    });

    describe('edge cases', () => {
        it('should handle empty string item ID', () => {
            toggleFavorite('items', '');

            expect(isFavorite('items', '')).toBe(true);
        });

        it('should handle special characters in item ID', () => {
            const specialId = 'item-with_special.chars!@#$';
            toggleFavorite('items', specialId);

            expect(isFavorite('items', specialId)).toBe(true);
        });

        it('should handle many favorites', () => {
            // Add 100 favorites
            for (let i = 0; i < 100; i++) {
                toggleFavorite('items', `item_${i}`);
            }

            expect(getFavorites('items')).toHaveLength(100);
            expect(isFavorite('items', 'item_50')).toBe(true);
        });
    });
});
