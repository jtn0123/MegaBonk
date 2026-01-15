// ========================================
// Filters Module - Real Integration Tests
// No mocking - tests actual code execution
// ========================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    fuzzyMatchScore,
    parseAdvancedSearch,
    matchesAdvancedFilters,
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    getAllFilterStates,
    saveFilterState,
    restoreFilterState,
    clearAllFilterStates,
    filterData,
    updateFilters,
    clearFilters,
    type FuzzyMatchResult,
    type AdvancedSearchCriteria,
    type FilterState,
} from '../../src/modules/filters.ts';

// ========================================
// Fuzzy Match Score Tests - Pure Functions
// ========================================

describe('fuzzyMatchScore - Pure Function Tests', () => {
    describe('Exact Match', () => {
        it('should return highest score for exact match', () => {
            const result = fuzzyMatchScore('sword', 'sword', 'name');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
            expect(result.field).toBe('name');
        });

        it('should be case insensitive for exact match', () => {
            const result = fuzzyMatchScore('SWORD', 'sword', 'name');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should match mixed case exactly', () => {
            const result = fuzzyMatchScore('SwOrD', 'sWoRd', 'name');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });
    });

    describe('Starts With Match', () => {
        it('should return high score for starts_with match', () => {
            const result = fuzzyMatchScore('pow', 'power crystal', 'name');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should be case insensitive for starts_with', () => {
            const result = fuzzyMatchScore('POW', 'Power Crystal', 'name');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should match single character prefix', () => {
            const result = fuzzyMatchScore('p', 'power', 'name');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });
    });

    describe('Contains Match', () => {
        it('should return medium score for substring match', () => {
            const result = fuzzyMatchScore('crystal', 'power crystal', 'name');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });

        it('should find substring in middle', () => {
            const result = fuzzyMatchScore('er cr', 'power crystal', 'name');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });

        it('should be case insensitive for contains', () => {
            const result = fuzzyMatchScore('CRYSTAL', 'Power Crystal', 'name');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });
    });

    describe('Fuzzy Match', () => {
        it('should find fuzzy match with scattered characters', () => {
            const result = fuzzyMatchScore('pcl', 'power crystal', 'name');

            expect(result.score).toBeGreaterThan(0);
            expect(result.matchType).toBe('fuzzy');
        });

        it('should give higher score for consecutive matches', () => {
            const result1 = fuzzyMatchScore('pow', 'power crystal', 'name'); // starts_with
            const result2 = fuzzyMatchScore('pcr', 'power crystal', 'name'); // fuzzy, scattered

            // starts_with should beat fuzzy
            expect(result1.score).toBeGreaterThan(result2.score);
        });

        it('should match abbreviated forms', () => {
            const result = fuzzyMatchScore('pwrcrstl', 'power crystal', 'name');

            expect(result.score).toBeGreaterThan(0);
            expect(result.matchType).toBe('fuzzy');
        });
    });

    describe('No Match', () => {
        it('should return 0 for no match', () => {
            const result = fuzzyMatchScore('xyz', 'power crystal', 'name');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should return 0 for partial character match that does not complete', () => {
            const result = fuzzyMatchScore('powerz', 'power crystal', 'name');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should return 0 for empty search term', () => {
            const result = fuzzyMatchScore('', 'power crystal', 'name');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should return 0 for empty text', () => {
            const result = fuzzyMatchScore('power', '', 'name');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });
    });

    describe('Field Name Tracking', () => {
        it('should track field name in result', () => {
            const result1 = fuzzyMatchScore('test', 'test', 'name');
            const result2 = fuzzyMatchScore('test', 'test', 'description');
            const result3 = fuzzyMatchScore('test', 'test', 'effect');

            expect(result1.field).toBe('name');
            expect(result2.field).toBe('description');
            expect(result3.field).toBe('effect');
        });

        it('should use default field name', () => {
            const result = fuzzyMatchScore('test', 'test');

            expect(result.field).toBe('text');
        });
    });
});

// ========================================
// Advanced Search Parser Tests
// ========================================

describe('parseAdvancedSearch - Pure Function Tests', () => {
    describe('Basic Text Parsing', () => {
        it('should parse simple text search', () => {
            const result = parseAdvancedSearch('sword');

            expect(result.text).toEqual(['sword']);
            expect(Object.keys(result.filters)).toHaveLength(0);
        });

        it('should parse multiple words', () => {
            const result = parseAdvancedSearch('power crystal');

            expect(result.text).toEqual(['power', 'crystal']);
        });

        it('should handle empty query', () => {
            const result = parseAdvancedSearch('');

            expect(result.text).toEqual([]);
            expect(Object.keys(result.filters)).toHaveLength(0);
        });
    });

    describe('Filter Syntax', () => {
        it('should parse tier filter', () => {
            const result = parseAdvancedSearch('tier:SS');

            expect(result.text).toEqual([]);
            expect(result.filters.tier).toBe('SS');
        });

        it('should parse multiple filters', () => {
            const result = parseAdvancedSearch('tier:S rarity:legendary');

            expect(result.filters.tier).toBe('S');
            expect(result.filters.rarity).toBe('legendary');
        });

        it('should parse mixed text and filters', () => {
            const result = parseAdvancedSearch('fire tier:S damage');

            expect(result.text).toContain('fire');
            expect(result.text).toContain('damage');
            expect(result.filters.tier).toBe('S');
        });

        it('should parse comparison operators', () => {
            const result = parseAdvancedSearch('damage:>100');

            expect(result.filters.damage).toBe('>100');
        });

        it('should parse not equals', () => {
            const result = parseAdvancedSearch('tier:!C');

            expect(result.filters.tier).toBe('!C');
        });
    });

    describe('Quoted Strings', () => {
        it('should parse quoted strings as single term', () => {
            const result = parseAdvancedSearch('"power crystal"');

            expect(result.text).toEqual(['power crystal']);
        });

        it('should handle mixed quoted and unquoted', () => {
            const result = parseAdvancedSearch('"fire sword" tier:S shield');

            expect(result.text).toContain('fire sword');
            expect(result.text).toContain('shield');
            expect(result.filters.tier).toBe('S');
        });
    });

    describe('Edge Cases', () => {
        it('should handle filter with no value gracefully', () => {
            const result = parseAdvancedSearch('tier:');

            // The regex won't match 'tier:' without a value
            expect(result.text).toEqual(['tier:']);
        });

        it('should handle extra whitespace', () => {
            const result = parseAdvancedSearch('  sword   shield  ');

            expect(result.text).toEqual(['sword', 'shield']);
        });
    });
});

// ========================================
// Advanced Filter Matching Tests
// ========================================

describe('matchesAdvancedFilters - Pure Function Tests', () => {
    describe('Exact Matching', () => {
        it('should match exact tier', () => {
            const item = { tier: 'SS', name: 'Test Item' };
            const filters = { tier: 'SS' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should not match different tier', () => {
            const item = { tier: 'A', name: 'Test Item' };
            const filters = { tier: 'SS' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should be case insensitive', () => {
            const item = { tier: 'ss', name: 'Test Item' };
            const filters = { tier: 'SS' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });
    });

    describe('Comparison Operators', () => {
        it('should match greater than', () => {
            const item = { damage: 150, name: 'Test' };
            const filters = { damage: '>100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should not match when not greater', () => {
            const item = { damage: 100, name: 'Test' };
            const filters = { damage: '>100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should match less than', () => {
            const item = { damage: 50, name: 'Test' };
            const filters = { damage: '<100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match greater than or equal', () => {
            const item = { damage: 100, name: 'Test' };
            const filters = { damage: '>=100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should match less than or equal', () => {
            const item = { damage: 100, name: 'Test' };
            const filters = { damage: '<=100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should not match when not less than or equal', () => {
            const item = { damage: 101, name: 'Test' };
            const filters = { damage: '<=100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });
    });

    describe('Not Equals Operator', () => {
        it('should match when not equal', () => {
            const item = { tier: 'S', name: 'Test' };
            const filters = { tier: '!C' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should not match when equal', () => {
            const item = { tier: 'C', name: 'Test' };
            const filters = { tier: '!C' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });
    });

    describe('Multiple Filters', () => {
        it('should require all filters to match', () => {
            const item = { tier: 'SS', rarity: 'legendary', damage: 150 };
            const filters = { tier: 'SS', rarity: 'legendary' };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should fail if any filter does not match', () => {
            const item = { tier: 'SS', rarity: 'epic', damage: 150 };
            const filters = { tier: 'SS', rarity: 'legendary' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should return false when item property is undefined', () => {
            const item = { name: 'Test' }; // no tier
            const filters = { tier: 'SS' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should return false when item property is null', () => {
            const item = { tier: null, name: 'Test' };
            const filters = { tier: 'SS' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });

        it('should skip undefined filter values', () => {
            const item = { tier: 'SS', name: 'Test' };
            const filters = { tier: undefined as any };

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should handle empty filters object', () => {
            const item = { tier: 'SS', name: 'Test' };
            const filters = {};

            expect(matchesAdvancedFilters(item, filters)).toBe(true);
        });

        it('should handle NaN in comparison', () => {
            const item = { damage: 'not a number', name: 'Test' };
            const filters = { damage: '>100' };

            expect(matchesAdvancedFilters(item, filters)).toBe(false);
        });
    });
});

// ========================================
// Search History Tests
// ========================================

describe('Search History - LocalStorage Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('getSearchHistory', () => {
        it('should return empty array when no history', () => {
            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should return stored history', () => {
            localStorage.setItem('megabonk_search_history', JSON.stringify(['sword', 'shield']));

            const history = getSearchHistory();
            expect(history).toEqual(['sword', 'shield']);
        });

        it('should handle invalid JSON gracefully', () => {
            localStorage.setItem('megabonk_search_history', 'invalid json');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });
    });

    describe('addToSearchHistory', () => {
        it('should add term to history', () => {
            addToSearchHistory('sword');

            const history = getSearchHistory();
            expect(history).toContain('sword');
        });

        it('should add to front of history', () => {
            addToSearchHistory('sword');
            addToSearchHistory('shield');

            const history = getSearchHistory();
            expect(history[0]).toBe('shield');
            expect(history[1]).toBe('sword');
        });

        it('should remove duplicates', () => {
            addToSearchHistory('sword');
            addToSearchHistory('shield');
            addToSearchHistory('sword');

            const history = getSearchHistory();
            expect(history).toEqual(['sword', 'shield']);
        });

        it('should limit to 10 items', () => {
            for (let i = 0; i < 15; i++) {
                addToSearchHistory(`term${i}`);
            }

            const history = getSearchHistory();
            expect(history.length).toBe(10);
            expect(history[0]).toBe('term14');
        });

        it('should not add empty terms', () => {
            addToSearchHistory('');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should not add short terms (< 2 chars)', () => {
            addToSearchHistory('a');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should not add whitespace-only terms', () => {
            addToSearchHistory('   ');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });
    });

    describe('clearSearchHistory', () => {
        it('should clear all history', () => {
            addToSearchHistory('sword');
            addToSearchHistory('shield');

            clearSearchHistory();

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });
    });
});

// ========================================
// Filter State Persistence Tests
// ========================================

describe('Filter State - SessionStorage Integration', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = `
            <input type="text" id="searchInput" value="" />
            <input type="checkbox" id="favoritesOnly" />
            <select id="tierFilter"><option value="all">All</option><option value="SS">SS</option></select>
            <select id="sortBy"><option value="name">Name</option><option value="tier">Tier</option></select>
            <select id="rarityFilter"><option value="all">All</option><option value="legendary">Legendary</option></select>
            <select id="stackingFilter"><option value="all">All</option><option value="stacks_well">Stacks Well</option></select>
        `;
    });

    afterEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = '';
    });

    describe('getAllFilterStates', () => {
        it('should return empty object when no states saved', () => {
            const states = getAllFilterStates();
            expect(states).toEqual({});
        });

        it('should return stored states', () => {
            const testState = { items: { search: 'test', favoritesOnly: false, tierFilter: 'all', sortBy: 'name' } };
            window.sessionStorage.setItem('megabonk_filter_state', JSON.stringify(testState));

            const states = getAllFilterStates();
            expect(states.items).toBeDefined();
        });
    });

    describe('saveFilterState', () => {
        it('should save current filter state for items tab', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;

            searchInput.value = 'test search';
            tierFilter.value = 'SS';

            saveFilterState('items');

            const states = getAllFilterStates();
            expect(states.items?.search).toBe('test search');
            expect(states.items?.tierFilter).toBe('SS');
        });

        it('should save rarity filter for items tab', () => {
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            rarityFilter.value = 'legendary';

            saveFilterState('items');

            const states = getAllFilterStates();
            expect(states.items?.rarityFilter).toBe('legendary');
        });

        it('should not save state for build-planner tab', () => {
            saveFilterState('build-planner');

            const states = getAllFilterStates();
            expect(states['build-planner']).toBeUndefined();
        });

        it('should not save state for calculator tab', () => {
            saveFilterState('calculator');

            const states = getAllFilterStates();
            expect(states.calculator).toBeUndefined();
        });
    });

    describe('restoreFilterState', () => {
        it('should restore saved filter state', () => {
            const testState = {
                items: {
                    search: 'restored search',
                    favoritesOnly: true,
                    tierFilter: 'SS',
                    sortBy: 'tier',
                },
            };
            window.sessionStorage.setItem('megabonk_filter_state', JSON.stringify(testState));

            restoreFilterState('items');

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            const sortBy = document.getElementById('sortBy') as HTMLSelectElement;

            expect(searchInput.value).toBe('restored search');
            expect(favoritesOnly.checked).toBe(true);
            expect(tierFilter.value).toBe('SS');
            expect(sortBy.value).toBe('tier');
        });

        it('should not throw when no saved state', () => {
            expect(() => restoreFilterState('items')).not.toThrow();
        });

        it('should skip tabs without filters', () => {
            expect(() => restoreFilterState('build-planner')).not.toThrow();
        });
    });

    describe('clearAllFilterStates', () => {
        it('should clear all saved states', () => {
            saveFilterState('items');

            clearAllFilterStates();

            const states = getAllFilterStates();
            expect(states).toEqual({});
        });
    });
});

// ========================================
// Filter UI Tests
// ========================================

describe('updateFilters - DOM Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="filters"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create items filters', () => {
        updateFilters('items');

        const filtersDiv = document.getElementById('filters');
        expect(filtersDiv?.innerHTML).toContain('rarityFilter');
        expect(filtersDiv?.innerHTML).toContain('tierFilter');
        expect(filtersDiv?.innerHTML).toContain('stackingFilter');
        expect(filtersDiv?.innerHTML).toContain('sortBy');
        expect(filtersDiv?.innerHTML).toContain('favoritesOnly');
    });

    it('should create weapons filters', () => {
        updateFilters('weapons');

        const filtersDiv = document.getElementById('filters');
        expect(filtersDiv?.innerHTML).toContain('tierFilter');
        expect(filtersDiv?.innerHTML).toContain('sortBy');
        expect(filtersDiv?.innerHTML).not.toContain('rarityFilter');
    });

    it('should create shrines filters', () => {
        updateFilters('shrines');

        const filtersDiv = document.getElementById('filters');
        expect(filtersDiv?.innerHTML).toContain('typeFilter');
        expect(filtersDiv?.innerHTML).toContain('favoritesOnly');
    });

    it('should create changelog filters', () => {
        updateFilters('changelog');

        const filtersDiv = document.getElementById('filters');
        expect(filtersDiv?.innerHTML).toContain('categoryFilter');
        expect(filtersDiv?.innerHTML).toContain('sortBy');
    });

    it('should not throw when filters container missing', () => {
        document.body.innerHTML = '';

        expect(() => updateFilters('items')).not.toThrow();
    });
});

// ========================================
// filterData Tests
// ========================================

describe('filterData - Integration Tests', () => {
    const testItems = [
        {
            id: 'item1',
            name: 'Power Crystal',
            tier: 'SS',
            rarity: 'legendary',
            description: 'Increases damage',
            base_effect: '+10% damage',
            stacks_well: true,
            one_and_done: false,
            tags: ['damage', 'offensive'],
        },
        {
            id: 'item2',
            name: 'Shield Amulet',
            tier: 'A',
            rarity: 'epic',
            description: 'Defensive item',
            base_effect: '+5 armor',
            stacks_well: true,
            one_and_done: false,
            tags: ['defense'],
        },
        {
            id: 'item3',
            name: 'Lucky Charm',
            tier: 'S',
            rarity: 'legendary',
            description: 'Increases luck',
            base_effect: '+5% crit chance',
            stacks_well: false,
            one_and_done: true,
            tags: ['crit'],
        },
        {
            id: 'item4',
            name: 'Basic Sword',
            tier: 'C',
            rarity: 'common',
            description: 'A simple weapon',
            base_effect: '+2 damage',
            stacks_well: true,
            one_and_done: false,
            tags: [],
        },
    ];

    beforeEach(() => {
        document.body.innerHTML = `
            <input type="text" id="searchInput" value="" />
            <input type="checkbox" id="favoritesOnly" />
            <select id="tierFilter"><option value="all">All</option></select>
            <select id="sortBy"><option value="name">Name</option></select>
            <select id="rarityFilter"><option value="all">All</option></select>
            <select id="stackingFilter"><option value="all">All</option></select>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return all items when no filters', () => {
        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(4);
    });

    it('should filter by search text', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = 'power';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Power Crystal');
    });

    it('should filter by tier', () => {
        const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
        tierFilter.innerHTML = '<option value="SS">SS</option>';
        tierFilter.value = 'SS';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].tier).toBe('SS');
    });

    it('should filter by rarity', () => {
        const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
        rarityFilter.innerHTML = '<option value="legendary">Legendary</option>';
        rarityFilter.value = 'legendary';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(2);
    });

    it('should filter by stacking (stacks_well)', () => {
        const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;
        stackingFilter.innerHTML = '<option value="stacks_well">Stacks Well</option>';
        stackingFilter.value = 'stacks_well';

        const result = filterData(testItems as any, 'items');
        expect(result.every(item => (item as any).stacks_well === true)).toBe(true);
    });

    it('should filter by stacking (one_and_done)', () => {
        const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;
        stackingFilter.innerHTML = '<option value="one_and_done">One-and-Done</option>';
        stackingFilter.value = 'one_and_done';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Lucky Charm');
    });

    it('should combine multiple filters', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;

        // Single word search that matches an item
        searchInput.value = 'crystal';
        tierFilter.innerHTML = '<option value="SS">SS</option>';
        tierFilter.value = 'SS';

        const result = filterData(testItems as any, 'items');
        // Should find Power Crystal which has tier SS
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Power Crystal');
    });

    it('should handle empty data array', () => {
        const result = filterData([], 'items');
        expect(result).toEqual([]);
    });

    it('should use fuzzy search for partial matches', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = 'pwr';

        const result = filterData(testItems as any, 'items');
        // Fuzzy match for 'pwr' in 'power'
        expect(result.some(item => item.name.toLowerCase().includes('power'))).toBe(true);
    });

    it('should search in description field', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        // Use exact term from description to avoid fuzzy matching issues
        searchInput.value = 'luck';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Lucky Charm');
    });

    it('should search in base_effect field', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = 'armor';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Shield Amulet');
    });

    it('should search in tags', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = 'offensive';

        const result = filterData(testItems as any, 'items');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Power Crystal');
    });
});

// ========================================
// clearFilters Tests
// ========================================

describe('clearFilters - DOM Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input type="text" id="searchInput" value="test search" />
            <div id="filters">
                <select id="tierFilter"><option value="SS">SS</option><option value="all">All</option></select>
                <select id="rarityFilter"><option value="legendary">Legendary</option><option value="all">All</option></select>
            </div>
        `;

        // Set non-default values
        (document.getElementById('tierFilter') as HTMLSelectElement).value = 'SS';
        (document.getElementById('rarityFilter') as HTMLSelectElement).value = 'legendary';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should clear search input', () => {
        clearFilters();

        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        expect(searchInput.value).toBe('');
    });

    it('should reset select elements to all', () => {
        clearFilters();

        const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
        const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;

        expect(tierFilter.value).toBe('all');
        expect(rarityFilter.value).toBe('all');
    });

    it('should not throw when elements are missing', () => {
        document.body.innerHTML = '';

        expect(() => clearFilters()).not.toThrow();
    });
});
