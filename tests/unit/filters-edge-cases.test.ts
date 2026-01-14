import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM, createItemsFilterUI } from '../helpers/dom-setup.js';
import {
    showSearchHistoryDropdown,
    addToSearchHistory,
    getSearchHistory,
    fuzzyMatchScore,
    parseAdvancedSearch,
    matchesAdvancedFilters,
    updateFilters,
    filterData,
    handleSearch,
    clearFilters,
} from '../../src/modules/filters.ts';

// Mock renderers module
vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: vi.fn(),
    updateStats: vi.fn(),
    renderItems: vi.fn(),
    renderWeapons: vi.fn(),
    renderTomes: vi.fn(),
    renderCharacters: vi.fn(),
    renderShrines: vi.fn(),
}));

// Mock data-service
vi.mock('../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn(() => []),
    currentTab: 'items',
}));

describe('filters.ts - Dropdown Interaction Edge Cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        createItemsFilterUI();
        localStorage.clear();

        // Add some search history
        addToSearchHistory('previous search');
        addToSearchHistory('another search');
    });

    afterEach(() => {
        localStorage.clear();
    });

    // Note: Dropdown interaction tests skipped due to jsdom AbortController limitations
    // These tests would need to run in a real browser environment
    describe.skip('showSearchHistoryDropdown - browser-only tests', () => {
        it('should close dropdown when clicking outside', () => {
            // Requires full browser environment with AbortController support
            expect(true).toBe(true);
        });

        it('should close dropdown on Escape key', () => {
            // Requires full browser environment with AbortController support
            expect(true).toBe(true);
        });
    });

    describe('fuzzyMatchScore - edge cases', () => {
        it('should handle empty search term', () => {
            const result = fuzzyMatchScore('', 'some text');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        it('should handle empty text', () => {
            const result = fuzzyMatchScore('search', '');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        it('should handle very long search terms', () => {
            const longTerm = 'a'.repeat(1000);
            const result = fuzzyMatchScore(longTerm, 'short text');
            expect(result.matchType).toBe('none');
        });

        it('should handle special regex characters', () => {
            const result = fuzzyMatchScore('.*+?^${}()|[]\\', 'some text with .*+?');
            // Should not throw, should handle gracefully
            expect(result).toBeDefined();
        });

        it('should be case insensitive', () => {
            const result1 = fuzzyMatchScore('test', 'This is a TEST');
            const result2 = fuzzyMatchScore('TEST', 'This is a test');
            expect(result1.matchType).not.toBe('none');
            expect(result2.matchType).not.toBe('none');
        });

        it('should score exact matches higher than partial matches', () => {
            const exact = fuzzyMatchScore('test', 'test');
            const partial = fuzzyMatchScore('test', 'testing things');
            expect(exact.score).toBeGreaterThan(partial.score);
        });
    });

    describe('parseAdvancedSearch - edge cases', () => {
        it('should handle malformed filters', () => {
            const result = parseAdvancedSearch('tier: rarity:');
            expect(result.filters).toEqual({});
        });

        it('should handle filters without values', () => {
            const result = parseAdvancedSearch('tier:');
            expect(result.filters.tier).toBeUndefined();
        });

        it('should handle multiple colons', () => {
            const result = parseAdvancedSearch('tier:S:extra');
            // Should handle gracefully
            expect(result).toBeDefined();
        });

        it('should handle very long filter values', () => {
            const longValue = 'a'.repeat(10000);
            const result = parseAdvancedSearch(`tier:${longValue}`);
            expect(result.filters.tier).toBe(longValue);
        });

        it('should extract terms after filters', () => {
            const result = parseAdvancedSearch('tier:S remaining terms');
            expect(result.text).toContain('remaining');
            expect(result.text).toContain('terms');
        });
    });

    describe('matchesAdvancedFilters - edge cases', () => {
        it('should handle missing fields in item', () => {
            const item = { name: 'Test' };
            const filters = { tier: 'S', rarity: 'legendary' };
            const result = matchesAdvancedFilters(item, filters);
            expect(result).toBe(false);
        });

        it('should handle null/undefined filter values', () => {
            const item = { tier: 'S', rarity: 'rare' };
            const filters = { tier: null as any, rarity: undefined as any };
            const result = matchesAdvancedFilters(item, filters);
            // Should handle gracefully
            expect(result).toBeDefined();
        });

        it('should be case insensitive for filter matching', () => {
            const item = { tier: 'S', rarity: 'LEGENDARY' };
            const filters = { tier: 's', rarity: 'legendary' };
            const result = matchesAdvancedFilters(item, filters);
            expect(result).toBe(true);
        });

        it('should handle nested object properties', () => {
            const item = { stats: { attack: 100, defense: 50 } };
            const filters = { 'stats.attack': '100' };
            // This might not be supported, but should not throw
            expect(() => matchesAdvancedFilters(item, filters)).not.toThrow();
        });
    });

    describe('updateFilters - edge cases', () => {
        it('should handle missing filter elements', () => {
            // Remove all filter elements
            document.getElementById('tier-filter')?.remove();
            document.getElementById('rarity-filter')?.remove();

            // Should not throw
            expect(() => updateFilters('items')).not.toThrow();
        });

        it('should handle invalid tab names', () => {
            expect(() => updateFilters('invalid-tab' as any)).not.toThrow();
        });
    });

    describe('filterData - edge cases', () => {
        it('should handle empty data array', () => {
            const result = filterData([], 'items');
            expect(result).toEqual([]);
        });

        it('should handle data with missing properties', () => {
            const data = [
                { name: 'Item 1' },
                { name: 'Item 2', tier: 'S' },
            ] as any[];

            const result = filterData(data, 'items');
            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle very large datasets', () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`,
                tier: 'A',
                rarity: 'common',
            })) as any[];

            // Should not timeout or crash
            const result = filterData(largeData, 'items');
            expect(result).toBeDefined();
            expect(result.length).toBeLessThanOrEqual(10000);
        });
    });

    describe('handleSearch - edge cases', () => {
        it('should handle search with no input element', () => {
            document.getElementById('search-items')?.remove();

            // Should not throw
            expect(() => handleSearch()).not.toThrow();
        });

        it('should handle search with empty input', () => {
            const input = document.getElementById('search-items') as HTMLInputElement;
            if (input) {
                input.value = '';
                expect(() => handleSearch()).not.toThrow();
            }
        });
    });

    describe('clearFilters - edge cases', () => {
        it('should handle missing filter elements', () => {
            document.getElementById('tier-filter')?.remove();
            document.getElementById('rarity-filter')?.remove();
            document.getElementById('search-items')?.remove();

            // Should not throw
            expect(() => clearFilters()).not.toThrow();
        });
    });
});

// Helper function to create search input if it doesn't exist
function createSearchInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.id = 'search-items';
    input.type = 'text';
    document.body.appendChild(input);
    return input;
}
