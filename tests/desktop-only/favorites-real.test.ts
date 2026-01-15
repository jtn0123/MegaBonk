/**
 * Real Integration Tests for Favorites Module
 * No mocking - tests actual favorites implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    loadFavorites,
    isFavorite,
    toggleFavorite,
    getFavorites,
    clearAllFavorites,
} from '../../src/modules/favorites.ts';

// ========================================
// Constants
// ========================================

const FAVORITES_KEY = 'megabonk_favorites';

// ========================================
// loadFavorites Tests
// ========================================

describe('loadFavorites - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        // Reset module state
        clearAllFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should load empty favorites from empty localStorage', () => {
        loadFavorites();

        // After loading, getFavorites should return empty arrays
        expect(getFavorites('items')).toEqual([]);
    });

    it('should load saved favorites from localStorage', () => {
        const savedFavorites = {
            items: ['item1', 'item2'],
            weapons: [],
            tomes: [],
            characters: [],
            shrines: [],
        };
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(savedFavorites));

        loadFavorites();

        expect(getFavorites('items')).toEqual(['item1', 'item2']);
    });

    it('should handle invalid JSON in localStorage', () => {
        localStorage.setItem(FAVORITES_KEY, 'invalid json');

        // Should not throw
        expect(() => loadFavorites()).not.toThrow();
    });

    it('should handle partial favorites data', () => {
        const partialFavorites = {
            items: ['item1'],
            // Missing other properties
        };
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(partialFavorites));

        loadFavorites();

        expect(getFavorites('items')).toEqual(['item1']);
    });
});

// ========================================
// isFavorite Tests
// ========================================

describe('isFavorite - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should return false for unfavorited item', () => {
        const result = isFavorite('items', 'nonexistent');
        expect(result).toBe(false);
    });

    it('should return true for favorited item', () => {
        toggleFavorite('items', 'test-item');

        const result = isFavorite('items', 'test-item');
        expect(result).toBe(true);
    });

    it('should check correct tab', () => {
        toggleFavorite('items', 'test-item');

        expect(isFavorite('items', 'test-item')).toBe(true);
        expect(isFavorite('weapons', 'test-item')).toBe(false);
    });

    it('should handle empty tab name array', () => {
        const result = isFavorite('items', 'anything');
        expect(typeof result).toBe('boolean');
    });
});

// ========================================
// toggleFavorite Tests
// ========================================

describe('toggleFavorite - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should add item to favorites', () => {
        const result = toggleFavorite('items', 'new-item');

        expect(result).toBe(true);
        expect(isFavorite('items', 'new-item')).toBe(true);
    });

    it('should remove item from favorites', () => {
        toggleFavorite('items', 'item-to-remove');
        const result = toggleFavorite('items', 'item-to-remove');

        expect(result).toBe(false);
        expect(isFavorite('items', 'item-to-remove')).toBe(false);
    });

    it('should toggle correctly multiple times', () => {
        expect(toggleFavorite('items', 'toggle-item')).toBe(true);
        expect(toggleFavorite('items', 'toggle-item')).toBe(false);
        expect(toggleFavorite('items', 'toggle-item')).toBe(true);
        expect(toggleFavorite('items', 'toggle-item')).toBe(false);
    });

    it('should persist to localStorage', () => {
        toggleFavorite('items', 'persist-item');

        const stored = localStorage.getItem(FAVORITES_KEY);
        expect(stored).not.toBeNull();

        const parsed = JSON.parse(stored!);
        expect(parsed.items).toContain('persist-item');
    });

    it('should work with different tabs', () => {
        toggleFavorite('items', 'item1');
        toggleFavorite('weapons', 'weapon1');
        toggleFavorite('tomes', 'tome1');
        toggleFavorite('characters', 'char1');
        toggleFavorite('shrines', 'shrine1');

        expect(isFavorite('items', 'item1')).toBe(true);
        expect(isFavorite('weapons', 'weapon1')).toBe(true);
        expect(isFavorite('tomes', 'tome1')).toBe(true);
        expect(isFavorite('characters', 'char1')).toBe(true);
        expect(isFavorite('shrines', 'shrine1')).toBe(true);
    });

    it('should not affect other tabs when toggling', () => {
        toggleFavorite('items', 'test-item');

        expect(getFavorites('weapons')).toEqual([]);
        expect(getFavorites('tomes')).toEqual([]);
    });
});

// ========================================
// getFavorites Tests
// ========================================

describe('getFavorites - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should return empty array for empty tab', () => {
        const favorites = getFavorites('items');
        expect(favorites).toEqual([]);
    });

    it('should return all favorited items for tab', () => {
        toggleFavorite('items', 'item1');
        toggleFavorite('items', 'item2');
        toggleFavorite('items', 'item3');

        const favorites = getFavorites('items');
        expect(favorites).toHaveLength(3);
        expect(favorites).toContain('item1');
        expect(favorites).toContain('item2');
        expect(favorites).toContain('item3');
    });

    it('should return array for valid tab names', () => {
        const tabs: ('items' | 'weapons' | 'tomes' | 'characters' | 'shrines')[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

        tabs.forEach(tab => {
            expect(Array.isArray(getFavorites(tab))).toBe(true);
        });
    });

    it('should maintain order of favorites', () => {
        toggleFavorite('items', 'first');
        toggleFavorite('items', 'second');
        toggleFavorite('items', 'third');

        const favorites = getFavorites('items');
        expect(favorites[0]).toBe('first');
        expect(favorites[1]).toBe('second');
        expect(favorites[2]).toBe('third');
    });
});

// ========================================
// clearAllFavorites Tests
// ========================================

describe('clearAllFavorites - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should clear all favorites in all tabs', () => {
        toggleFavorite('items', 'item1');
        toggleFavorite('weapons', 'weapon1');
        toggleFavorite('tomes', 'tome1');

        clearAllFavorites();

        expect(getFavorites('items')).toEqual([]);
        expect(getFavorites('weapons')).toEqual([]);
        expect(getFavorites('tomes')).toEqual([]);
    });

    it('should persist cleared state to localStorage', () => {
        toggleFavorite('items', 'item1');
        clearAllFavorites();

        const stored = localStorage.getItem(FAVORITES_KEY);
        const parsed = JSON.parse(stored!);

        expect(parsed.items).toEqual([]);
    });

    it('should not throw when no favorites exist', () => {
        expect(() => clearAllFavorites()).not.toThrow();
    });

    it('should allow adding favorites after clearing', () => {
        toggleFavorite('items', 'item1');
        clearAllFavorites();
        toggleFavorite('items', 'new-item');

        expect(isFavorite('items', 'new-item')).toBe(true);
    });
});

// ========================================
// Persistence Tests
// ========================================

describe('Favorites Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should persist favorites across loadFavorites calls', () => {
        loadFavorites();
        toggleFavorite('items', 'persistent-item');

        // Simulate reload
        loadFavorites();

        expect(isFavorite('items', 'persistent-item')).toBe(true);
    });

    it('should correctly save structure to localStorage', () => {
        loadFavorites();
        toggleFavorite('items', 'item1');
        toggleFavorite('weapons', 'weapon1');

        const stored = localStorage.getItem(FAVORITES_KEY);
        const parsed = JSON.parse(stored!);

        expect(parsed.items).toBeDefined();
        expect(parsed.weapons).toBeDefined();
        expect(parsed.tomes).toBeDefined();
        expect(parsed.characters).toBeDefined();
        expect(parsed.shrines).toBeDefined();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Favorites Edge Cases', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should handle empty string item ID', () => {
        toggleFavorite('items', '');

        expect(isFavorite('items', '')).toBe(true);
    });

    it('should handle special characters in item ID', () => {
        const specialId = 'item-with-special!@#$%^&*()_+';
        toggleFavorite('items', specialId);

        expect(isFavorite('items', specialId)).toBe(true);
    });

    it('should handle unicode in item ID', () => {
        const unicodeId = 'アイテム_日本語_🔥';
        toggleFavorite('items', unicodeId);

        expect(isFavorite('items', unicodeId)).toBe(true);
    });

    it('should handle very long item IDs', () => {
        const longId = 'a'.repeat(1000);
        toggleFavorite('items', longId);

        expect(isFavorite('items', longId)).toBe(true);
    });

    it('should handle many favorites', () => {
        for (let i = 0; i < 100; i++) {
            toggleFavorite('items', `item-${i}`);
        }

        expect(getFavorites('items')).toHaveLength(100);
    });

    it('should not duplicate favorites', () => {
        toggleFavorite('items', 'duplicate'); // Add
        toggleFavorite('items', 'duplicate'); // Remove
        toggleFavorite('items', 'duplicate'); // Add again

        // 3 toggles: add -> remove -> add, so it should be present
        expect(isFavorite('items', 'duplicate')).toBe(true);
        // But there should be no duplicates in the list
        const favorites = getFavorites('items');
        const count = favorites.filter(id => id === 'duplicate').length;
        expect(count).toBe(1);
    });
});

// ========================================
// Type Safety Tests
// ========================================

describe('Favorites Type Safety', () => {
    beforeEach(() => {
        localStorage.clear();
        clearAllFavorites();
        loadFavorites();
    });

    afterEach(() => {
        localStorage.clear();
        clearAllFavorites();
    });

    it('should accept items tab', () => {
        expect(() => toggleFavorite('items', 'test')).not.toThrow();
    });

    it('should accept weapons tab', () => {
        expect(() => toggleFavorite('weapons', 'test')).not.toThrow();
    });

    it('should accept tomes tab', () => {
        expect(() => toggleFavorite('tomes', 'test')).not.toThrow();
    });

    it('should accept characters tab', () => {
        expect(() => toggleFavorite('characters', 'test')).not.toThrow();
    });

    it('should accept shrines tab', () => {
        expect(() => toggleFavorite('shrines', 'test')).not.toThrow();
    });
});
