/**
 * Tests for search-history.ts module
 * Tests search history management
 * Note: Dropdown UI tests are limited due to jsdom AbortSignal compatibility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
} from '../../src/modules/search-history.ts';

describe('search-history - getSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should return empty array when no history exists', () => {
        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should return stored history', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['wrench', 'medkit']));

        const result = getSearchHistory();
        expect(result).toEqual(['wrench', 'medkit']);
    });

    it('should handle invalid JSON gracefully', () => {
        localStorage.setItem('megabonk_search_history', 'invalid json');

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should handle localStorage errors gracefully', () => {
        const originalGetItem = localStorage.getItem;
        localStorage.getItem = vi.fn(() => {
            throw new Error('Storage unavailable');
        });

        const result = getSearchHistory();
        expect(result).toEqual([]);

        localStorage.getItem = originalGetItem;
    });

    it('should return array of correct type', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['test']));

        const result = getSearchHistory();
        expect(Array.isArray(result)).toBe(true);
    });

    it('should return exact items from storage', () => {
        const items = ['item1', 'item2', 'item3'];
        localStorage.setItem('megabonk_search_history', JSON.stringify(items));

        const result = getSearchHistory();
        expect(result).toEqual(items);
        expect(result.length).toBe(3);
    });
});

describe('search-history - addToSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should add term to history', () => {
        addToSearchHistory('wrench');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('wrench');
    });

    it('should add term to front of history', () => {
        addToSearchHistory('wrench');
        addToSearchHistory('medkit');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('medkit');
        expect(stored[1]).toBe('wrench');
    });

    it('should remove duplicates', () => {
        addToSearchHistory('wrench');
        addToSearchHistory('medkit');
        addToSearchHistory('wrench');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toEqual(['wrench', 'medkit']);
    });

    it('should limit history to 10 items', () => {
        for (let i = 0; i < 15; i++) {
            addToSearchHistory(`item${i}`);
        }

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored.length).toBe(10);
    });

    it('should keep most recent items when over limit', () => {
        for (let i = 0; i < 15; i++) {
            addToSearchHistory(`item${i}`);
        }

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('item14'); // Most recent
    });

    it('should ignore empty strings', () => {
        addToSearchHistory('');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should ignore whitespace-only strings', () => {
        addToSearchHistory('   ');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should ignore terms shorter than 2 characters', () => {
        addToSearchHistory('a');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should accept terms with 2 characters', () => {
        addToSearchHistory('ab');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('ab');
    });

    it('should accept terms with many characters', () => {
        addToSearchHistory('this is a long search term');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('this is a long search term');
    });

    it('should handle localStorage errors gracefully', () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => {
            throw new Error('Storage full');
        });

        expect(() => addToSearchHistory('test')).not.toThrow();

        localStorage.setItem = originalSetItem;
    });

    it('should preserve existing items when adding new one', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['existing']));

        addToSearchHistory('new');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('existing');
        expect(stored).toContain('new');
    });

    it('should move duplicate to front instead of adding twice', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');
        addToSearchHistory('third');
        addToSearchHistory('first');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('first');
        expect(stored.filter((x: string) => x === 'first').length).toBe(1);
    });
});

describe('search-history - clearSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should remove history from localStorage', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['wrench', 'medkit']));

        clearSearchHistory();

        expect(localStorage.getItem('megabonk_search_history')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
        const originalRemoveItem = localStorage.removeItem;
        localStorage.removeItem = vi.fn(() => {
            throw new Error('Storage unavailable');
        });

        expect(() => clearSearchHistory()).not.toThrow();

        localStorage.removeItem = originalRemoveItem;
    });

    it('should not throw when no history exists', () => {
        expect(() => clearSearchHistory()).not.toThrow();
    });

    it('should clear all items', () => {
        addToSearchHistory('item1');
        addToSearchHistory('item2');
        addToSearchHistory('item3');

        clearSearchHistory();

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });
});

describe('search-history - integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should work end-to-end: add, get, clear', () => {
        // Add items
        addToSearchHistory('test1');
        addToSearchHistory('test2');

        // Get items
        let history = getSearchHistory();
        expect(history).toEqual(['test2', 'test1']);

        // Clear
        clearSearchHistory();

        // Verify cleared
        history = getSearchHistory();
        expect(history).toEqual([]);
    });

    it('should persist across get calls', () => {
        addToSearchHistory('persistent');

        const first = getSearchHistory();
        const second = getSearchHistory();

        expect(first).toEqual(second);
    });

    it('should handle special characters in search terms', () => {
        addToSearchHistory('test@#$%');
        addToSearchHistory('日本語');
        addToSearchHistory('emoji 🎮');

        const history = getSearchHistory();
        expect(history).toContain('test@#$%');
        expect(history).toContain('日本語');
        expect(history).toContain('emoji 🎮');
    });
});
