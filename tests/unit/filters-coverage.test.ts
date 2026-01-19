/**
 * @vitest-environment jsdom
 * Comprehensive coverage tests for filters.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing filters
vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock store
vi.mock('../../src/modules/store', () => ({
    getState: vi.fn().mockReturnValue('items'),
    setState: vi.fn(),
}));

// Mock renderers
vi.mock('../../src/modules/renderers', () => ({
    renderTabContent: vi.fn(),
}));

// Mock registry
vi.mock('../../src/modules/registry', () => ({
    registerFunction: vi.fn(),
}));

// Import functions to test
import {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    getAllFilterStates,
    saveFilterState,
    restoreFilterState,
    clearAllFilterStates,
    fuzzyMatchScore,
    parseAdvancedSearch,
    matchesAdvancedFilters,
    globalSearch,
    filterData,
} from '../../src/modules/filters';

import type { AllGameData, Entity } from '../../src/types/index';

describe('filters.ts coverage tests', () => {
    beforeEach(() => {
        // Clear localStorage and sessionStorage
        localStorage.clear();
        sessionStorage.clear();

        // Setup minimal DOM
        document.body.innerHTML = `
            <input id="searchInput" type="text" />
            <div id="search-history-dropdown"></div>
            <select id="rarityFilter"><option value="">All</option><option value="legendary">Legendary</option></select>
            <select id="tierFilter"><option value="">All</option><option value="S">S</option></select>
            <select id="stackingFilter"><option value="">All</option><option value="stacks_well">Stacks Well</option></select>
            <input id="favoritesOnly" type="checkbox" />
        `;
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Search History', () => {
        it('should return empty array when no history exists', () => {
            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should add term to search history', () => {
            addToSearchHistory('test term');
            const history = getSearchHistory();
            expect(history).toContain('test term');
        });

        it('should not add duplicate terms', () => {
            addToSearchHistory('test');
            addToSearchHistory('test');
            const history = getSearchHistory();
            expect(history.filter(t => t === 'test').length).toBe(1);
        });

        it('should not add empty terms', () => {
            addToSearchHistory('');
            addToSearchHistory('   ');
            const history = getSearchHistory();
            expect(history.length).toBe(0);
        });

        it('should limit history to 10 items', () => {
            for (let i = 0; i < 15; i++) {
                addToSearchHistory(`term${i}`);
            }
            const history = getSearchHistory();
            expect(history.length).toBeLessThanOrEqual(10);
        });

        it('should clear search history', () => {
            addToSearchHistory('test1');
            addToSearchHistory('test2');
            clearSearchHistory();
            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should handle localStorage errors gracefully', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = () => {
                throw new Error('localStorage error');
            };

            expect(() => getSearchHistory()).not.toThrow();
            const history = getSearchHistory();
            expect(history).toEqual([]);

            localStorage.getItem = originalGetItem;
        });
    });

    describe('Filter State Persistence', () => {
        it('should return empty object when no states exist', () => {
            const states = getAllFilterStates();
            expect(states).toEqual({});
        });

        it('should save and restore filter state', () => {
            // Set filter values
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            searchInput.value = 'test search';
            rarityFilter.value = 'legendary';

            saveFilterState('items');

            // Clear values
            searchInput.value = '';
            rarityFilter.value = '';

            restoreFilterState('items');

            expect(searchInput.value).toBe('test search');
            expect(rarityFilter.value).toBe('legendary');
        });

        it('should clear all filter states', () => {
            saveFilterState('items');
            saveFilterState('weapons');
            clearAllFilterStates();
            const states = getAllFilterStates();
            expect(states).toEqual({});
        });

        it('should handle sessionStorage errors gracefully', () => {
            const originalGetItem = sessionStorage.getItem;
            sessionStorage.getItem = () => {
                throw new Error('sessionStorage error');
            };

            expect(() => getAllFilterStates()).not.toThrow();

            sessionStorage.getItem = originalGetItem;
        });
    });

    describe('fuzzyMatchScore', () => {
        it('should return highest score for exact match', () => {
            const result = fuzzyMatchScore('test', 'test');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(2000);
        });

        it('should return high score for starts_with match', () => {
            const result = fuzzyMatchScore('test', 'testing');
            expect(result.matchType).toBe('starts_with');
            expect(result.score).toBe(1500);
        });

        it('should return medium score for contains match', () => {
            const result = fuzzyMatchScore('test', 'my test here');
            expect(result.matchType).toBe('contains');
            expect(result.score).toBe(1000);
        });

        it('should return fuzzy score for partial character match', () => {
            const result = fuzzyMatchScore('tst', 'testing');
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        it('should return zero score for no match', () => {
            const result = fuzzyMatchScore('xyz', 'abc');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        it('should be case insensitive', () => {
            const result = fuzzyMatchScore('TEST', 'test');
            expect(result.matchType).toBe('exact');
        });

        it('should handle empty inputs', () => {
            expect(fuzzyMatchScore('', 'test').score).toBe(0);
            expect(fuzzyMatchScore('test', '').score).toBe(0);
        });

        it('should use provided field name', () => {
            const result = fuzzyMatchScore('test', 'test', 'name');
            expect(result.field).toBe('name');
        });
    });

    describe('parseAdvancedSearch', () => {
        it('should parse simple text query', () => {
            const result = parseAdvancedSearch('legendary sword');
            expect(result.text).toContain('legendary');
            expect(result.text).toContain('sword');
        });

        it('should parse filter syntax', () => {
            const result = parseAdvancedSearch('tier:S rarity:legendary');
            expect(result.filters.tier).toBe('S');
            expect(result.filters.rarity).toBe('legendary');
        });

        it('should handle mixed text and filters', () => {
            const result = parseAdvancedSearch('sword tier:S damage');
            expect(result.text).toContain('sword');
            expect(result.text).toContain('damage');
            expect(result.filters.tier).toBe('S');
        });

        it('should handle quoted strings', () => {
            const result = parseAdvancedSearch('"big bonk" tier:SS');
            expect(result.text).toContain('big bonk');
            expect(result.filters.tier).toBe('SS');
        });

        it('should handle comparison operators', () => {
            const result = parseAdvancedSearch('damage:>100 hp:<=50');
            expect(result.filters.damage).toBe('>100');
            expect(result.filters.hp).toBe('<=50');
        });

        it('should handle empty query', () => {
            const result = parseAdvancedSearch('');
            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({});
        });

        it('should limit query length', () => {
            const longQuery = 'a'.repeat(2000);
            const result = parseAdvancedSearch(longQuery);
            // Should not throw and should handle gracefully
            expect(result).toBeDefined();
        });

        it('should limit token count', () => {
            const manyTokens = Array(100).fill('word').join(' ');
            const result = parseAdvancedSearch(manyTokens);
            expect(result.text.length).toBeLessThanOrEqual(50);
        });
    });

    describe('matchesAdvancedFilters', () => {
        it('should match exact string value', () => {
            const item = { rarity: 'legendary', tier: 'S' };
            const filters = { rarity: 'legendary' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should not match different value', () => {
            const item = { rarity: 'common', tier: 'C' };
            const filters = { rarity: 'legendary' };
            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should match greater than comparison', () => {
            const item = { damage: 150 };
            const filters = { damage: '>100' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match less than comparison', () => {
            const item = { hp: 50 };
            const filters = { hp: '<100' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match greater than or equal comparison', () => {
            const item = { damage: 100 };
            const filters = { damage: '>=100' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match less than or equal comparison', () => {
            const item = { hp: 100 };
            const filters = { hp: '<=100' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match not equal comparison', () => {
            const item = { tier: 'S' };
            const filters = { tier: '!=C' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match boolean true', () => {
            const item = { stacks_well: true };
            const filters = { stacks_well: 'true' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match boolean false', () => {
            const item = { one_and_done: false };
            const filters = { one_and_done: 'false' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should handle missing property', () => {
            const item = { name: 'test' };
            const filters = { rarity: 'legendary' };
            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should match all filters (AND logic)', () => {
            const item = { rarity: 'legendary', tier: 'S' };
            const filters = { rarity: 'legendary', tier: 'S' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should fail if any filter does not match', () => {
            const item = { rarity: 'legendary', tier: 'C' };
            const filters = { rarity: 'legendary', tier: 'S' };
            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should handle string comparison with toString', () => {
            // matchesAdvancedFilters uses String() conversion for comparison
            const item = { count: 5 };
            const filters = { count: '5' };
            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });
    });

    describe('globalSearch', () => {
        const mockAllData: AllGameData = {
            items: {
                version: '1.0',
                last_updated: '2024-01-01',
                total_items: 2,
                items: [
                    { id: 'sword', name: 'Flame Sword', rarity: 'legendary', tier: 'S' } as any,
                    { id: 'shield', name: 'Iron Shield', rarity: 'common', tier: 'B' } as any,
                ],
            },
            weapons: {
                version: '1.0',
                last_updated: '2024-01-01',
                total_weapons: 1,
                weapons: [{ id: 'bow', name: 'Fire Bow', tier: 'A' } as any],
            },
            tomes: undefined,
            characters: undefined,
            shrines: undefined,
            stats: undefined,
            changelog: undefined,
        };

        it('should search across all entity types', () => {
            const results = globalSearch('fire', mockAllData);
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.item.name.toLowerCase().includes('fire'))).toBe(true);
        });

        it('should return results sorted by score', () => {
            const results = globalSearch('sword', mockAllData);
            if (results.length > 1) {
                for (let i = 1; i < results.length; i++) {
                    expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
                }
            }
        });

        it('should return empty array for no matches', () => {
            const results = globalSearch('xyz123', mockAllData);
            expect(results).toEqual([]);
        });

        it('should handle empty query', () => {
            const results = globalSearch('', mockAllData);
            expect(results).toEqual([]);
        });

        it('should include entity type in results', () => {
            const results = globalSearch('fire', mockAllData);
            results.forEach(result => {
                // EntityType uses plural form: 'items', 'weapons', etc.
                expect(['items', 'weapons', 'tomes', 'characters', 'shrines']).toContain(result.type);
            });
        });
    });

    describe('filterData', () => {
        const mockItems: Entity[] = [
            { id: '1', name: 'Legendary Sword', rarity: 'legendary', tier: 'S' } as any,
            { id: '2', name: 'Common Shield', rarity: 'common', tier: 'C' } as any,
            { id: '3', name: 'Rare Bow', rarity: 'rare', tier: 'A' } as any,
        ];

        it('should return all items when no filters applied', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '';
            const result = filterData(mockItems, 'items');
            expect(result.length).toBe(mockItems.length);
        });

        it('should filter by search term', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'sword';
            const result = filterData(mockItems, 'items');
            expect(result.every(item => item.name.toLowerCase().includes('sword'))).toBe(true);
        });

        it('should filter by rarity', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            searchInput.value = '';
            rarityFilter.value = 'legendary';
            const result = filterData(mockItems, 'items');
            expect(result.every(item => (item as any).rarity === 'legendary')).toBe(true);
        });

        it('should filter by tier', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            searchInput.value = '';
            tierFilter.value = 'S';
            const result = filterData(mockItems, 'items');
            expect(result.every(item => (item as any).tier === 'S')).toBe(true);
        });

        it('should handle empty data array', () => {
            const result = filterData([], 'items');
            expect(result).toEqual([]);
        });

        it('should handle missing filter elements gracefully', () => {
            document.body.innerHTML = ''; // Remove all elements
            const result = filterData(mockItems, 'items');
            expect(result).toBeDefined();
        });
    });
});
