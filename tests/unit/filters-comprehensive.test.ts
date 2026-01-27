/**
 * Comprehensive tests for filters.ts module
 * Tests filter UI and data filtering logic
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    safeQuerySelectorAll: vi.fn((selector: string) => document.querySelectorAll(selector)),
    sortData: vi.fn(),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    isFavorite: vi.fn(() => false),
}));

vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return 'items';
        if (key === 'allData') return { items: { items: [] } };
        return null;
    }),
}));

vi.mock('../../src/modules/search-history.ts', () => ({
    getSearchHistory: vi.fn(() => []),
    addToSearchHistory: vi.fn(),
    clearSearchHistory: vi.fn(),
    showSearchHistoryDropdown: vi.fn(),
}));

vi.mock('../../src/modules/filter-state.ts', () => ({
    getAllFilterStates: vi.fn(() => ({})),
    saveFilterState: vi.fn(),
    restoreFilterState: vi.fn(),
    clearAllFilterStates: vi.fn(),
}));

vi.mock('../../src/modules/fuzzy-match.ts', () => ({
    fuzzyMatchScore: vi.fn(() => ({ score: 0, matchType: 'none', field: '' })),
    parseAdvancedSearch: vi.fn(() => ({ text: [], filters: {} })),
    matchesAdvancedFilters: vi.fn(() => true),
}));

vi.mock('../../src/modules/global-search.ts', () => ({
    globalSearch: vi.fn(() => ({ items: [], weapons: [], tomes: [], characters: [], shrines: [] })),
}));

import {
    updateFilters,
    filterData,
    handleSearch,
    clearFilters,
} from '../../src/modules/filters.ts';
import { isFavorite } from '../../src/modules/favorites.ts';
import { fuzzyMatchScore, parseAdvancedSearch } from '../../src/modules/fuzzy-match.ts';

describe('filters module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';

        // Reset window globals
        (window as any).renderGlobalSearchResults = undefined;
        (window as any).renderTabContent = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('updateFilters', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div id="filters"></div>';
        });

        it('should create item filters for items tab', () => {
            updateFilters('items');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('rarityFilter');
            expect(filtersContainer.innerHTML).toContain('tierFilter');
            expect(filtersContainer.innerHTML).toContain('stackingFilter');
            expect(filtersContainer.innerHTML).toContain('sortBy');
            expect(filtersContainer.innerHTML).toContain('favoritesOnly');
        });

        it('should include rarity options for items tab', () => {
            updateFilters('items');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('Common');
            expect(filtersContainer.innerHTML).toContain('Uncommon');
            expect(filtersContainer.innerHTML).toContain('Rare');
            expect(filtersContainer.innerHTML).toContain('Epic');
            expect(filtersContainer.innerHTML).toContain('Legendary');
        });

        it('should include tier options for items tab', () => {
            updateFilters('items');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('SS Tier');
            expect(filtersContainer.innerHTML).toContain('S Tier');
            expect(filtersContainer.innerHTML).toContain('A Tier');
            expect(filtersContainer.innerHTML).toContain('B Tier');
            expect(filtersContainer.innerHTML).toContain('C Tier');
        });

        it('should include stacking options for items tab', () => {
            updateFilters('items');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('Stacks Well');
            expect(filtersContainer.innerHTML).toContain('One-and-Done');
        });

        it('should create tier filters for weapons tab', () => {
            updateFilters('weapons');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('tierFilter');
            expect(filtersContainer.innerHTML).toContain('sortBy');
            expect(filtersContainer.innerHTML).toContain('favoritesOnly');
            expect(filtersContainer.innerHTML).not.toContain('rarityFilter');
        });

        it('should create tier filters for tomes tab', () => {
            updateFilters('tomes');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('tierFilter');
            expect(filtersContainer.innerHTML).not.toContain('rarityFilter');
        });

        it('should create tier filters for characters tab', () => {
            updateFilters('characters');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('tierFilter');
            expect(filtersContainer.innerHTML).not.toContain('rarityFilter');
        });

        it('should create type filter for shrines tab', () => {
            updateFilters('shrines');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('typeFilter');
            expect(filtersContainer.innerHTML).toContain('Stat Upgrade');
            expect(filtersContainer.innerHTML).toContain('Combat');
            expect(filtersContainer.innerHTML).toContain('Utility');
            expect(filtersContainer.innerHTML).toContain('Risk/Reward');
        });

        it('should create category filter for changelog tab', () => {
            updateFilters('changelog');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('categoryFilter');
            expect(filtersContainer.innerHTML).toContain('Balance Changes');
            expect(filtersContainer.innerHTML).toContain('New Content');
            expect(filtersContainer.innerHTML).toContain('Bug Fixes');
            expect(filtersContainer.innerHTML).toContain('Removed');
        });

        it('should create date sort options for changelog tab', () => {
            updateFilters('changelog');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toContain('Newest First');
            expect(filtersContainer.innerHTML).toContain('Oldest First');
        });

        it('should clear filters for unknown tab', () => {
            updateFilters('items'); // First add content
            updateFilters('unknown');

            const filtersContainer = document.getElementById('filters')!;

            expect(filtersContainer.innerHTML).toBe('');
        });

        it('should handle missing filters container', () => {
            document.body.innerHTML = '';

            expect(() => updateFilters('items')).not.toThrow();
        });
    });

    describe('filterData', () => {
        const mockItems = [
            { id: 'item1', name: 'Ring of Power', rarity: 'legendary', tier: 'SS', stacks_well: false, one_and_done: true },
            { id: 'item2', name: 'Amulet of Health', rarity: 'epic', tier: 'S', stacks_well: true, one_and_done: false },
            { id: 'item3', name: 'Boots of Speed', rarity: 'rare', tier: 'A', stacks_well: true, one_and_done: false },
            { id: 'item4', name: 'Shield of Defense', rarity: 'uncommon', tier: 'B', stacks_well: false, one_and_done: true },
            { id: 'item5', name: 'Helm of Wisdom', rarity: 'common', tier: 'C', stacks_well: true, one_and_done: false },
        ];

        beforeEach(() => {
            document.body.innerHTML = `
                <input id="searchInput" value="" />
                <input type="checkbox" id="favoritesOnly" />
                <select id="tierFilter"><option value="all">All</option><option value="S">S</option></select>
                <select id="rarityFilter"><option value="all">All</option><option value="epic">Epic</option></select>
                <select id="stackingFilter"><option value="all">All</option></select>
                <select id="sortBy"><option value="name">Name</option></select>
            `;
        });

        it('should return all items when no filters applied', () => {
            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(5);
        });

        it('should filter by tier', () => {
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            tierFilter.value = 'S';

            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item2');
        });

        it('should filter by rarity for items tab', () => {
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            rarityFilter.value = 'epic';

            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item2');
        });

        it('should filter by stacks_well', () => {
            // Update the existing stackingFilter value
            const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;
            stackingFilter.innerHTML = '<option value="all">All</option><option value="stacks_well">Stacks Well</option>';
            stackingFilter.value = 'stacks_well';

            const result = filterData(mockItems as any, 'items');

            expect(result.length).toBeGreaterThan(0);
            result.forEach(item => {
                expect((item as any).stacks_well).toBe(true);
            });
        });

        it('should filter by one_and_done', () => {
            const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;
            stackingFilter.innerHTML = '<option value="all">All</option><option value="one_and_done">One-and-Done</option>';
            stackingFilter.value = 'one_and_done';

            const result = filterData(mockItems as any, 'items');

            expect(result.length).toBeGreaterThan(0);
            result.forEach(item => {
                expect((item as any).one_and_done).toBe(true);
            });
        });

        it('should filter favorites only', () => {
            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            favoritesOnly.checked = true;

            // Mock isFavorite to return true for item1
            vi.mocked(isFavorite).mockImplementation((type, id) => id === 'item1');

            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item1');
        });

        it('should apply search with fuzzy matching', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'ring';

            vi.mocked(parseAdvancedSearch).mockReturnValue({
                text: ['ring'],
                filters: {},
            });

            vi.mocked(fuzzyMatchScore).mockImplementation((_term, text, field) => {
                if (text.toLowerCase().includes('ring')) {
                    return { score: 100, matchType: 'exact', field };
                }
                return { score: 0, matchType: 'none', field };
            });

            const result = filterData(mockItems as any, 'items');

            expect(result.length).toBeGreaterThan(0);
        });

        it('should not apply rarity filter for non-items tab', () => {
            const mockWeapons = [
                { id: 'w1', name: 'Sword', tier: 'S' },
                { id: 'w2', name: 'Axe', tier: 'A' },
            ];

            const result = filterData(mockWeapons as any, 'weapons');

            expect(result).toHaveLength(2);
        });

        describe('shrines filtering', () => {
            // Shrines need 'activation' or 'reward' property to pass isShrine type guard
            const mockShrines = [
                { id: 's1', name: 'Shrine of Power', type: 'stat_upgrade', activation: 'passive', reward: 'power boost' },
                { id: 's2', name: 'Shrine of Combat', type: 'combat', activation: 'touch', reward: 'combat bonus' },
                { id: 's3', name: 'Shrine of Utility', type: 'utility', activation: 'interact', reward: 'utility bonus' },
            ];

            beforeEach(() => {
                document.body.innerHTML = `
                    <input id="searchInput" value="" />
                    <input type="checkbox" id="favoritesOnly" />
                    <select id="typeFilter"><option value="all">All</option><option value="combat">Combat</option></select>
                `;
            });

            it('should filter shrines by type', () => {
                const typeFilter = document.getElementById('typeFilter') as HTMLSelectElement;
                typeFilter.value = 'combat';

                const result = filterData(mockShrines as any, 'shrines');

                expect(result).toHaveLength(1);
                expect(result[0].id).toBe('s2');
            });
        });

        describe('changelog filtering', () => {
            const mockPatches = [
                { id: 'p1', date: '2024-01-01', categories: { balance: ['change1'] } },
                { id: 'p2', date: '2024-02-01', categories: { new_content: ['feature1'] } },
                { id: 'p3', date: '2024-03-01', categories: { bug_fixes: ['fix1'] } },
            ];

            beforeEach(() => {
                document.body.innerHTML = `
                    <input id="searchInput" value="" />
                    <select id="categoryFilter"><option value="all">All</option><option value="balance">Balance</option></select>
                    <select id="sortBy"><option value="date_desc">Newest First</option><option value="date_asc">Oldest First</option></select>
                `;
            });

            it('should filter changelog by category', () => {
                const categoryFilter = document.getElementById('categoryFilter') as HTMLSelectElement;
                categoryFilter.value = 'balance';

                const result = filterData(mockPatches as any, 'changelog');

                expect(result).toHaveLength(1);
                expect(result[0].id).toBe('p1');
            });

            it('should sort changelog by date descending', () => {
                const sortBy = document.getElementById('sortBy') as HTMLSelectElement;
                sortBy.value = 'date_desc';

                const result = filterData(mockPatches as any, 'changelog');

                expect(result[0].id).toBe('p3'); // Newest first
                expect(result[2].id).toBe('p1'); // Oldest last
            });

            it('should sort changelog by date ascending', () => {
                const sortBy = document.getElementById('sortBy') as HTMLSelectElement;
                sortBy.value = 'date_asc';

                const result = filterData(mockPatches as any, 'changelog');

                expect(result[0].id).toBe('p1'); // Oldest first
                expect(result[2].id).toBe('p3'); // Newest last
            });

            it('should handle invalid dates', () => {
                const invalidPatches = [
                    { id: 'p1', date: 'invalid-date', categories: {} },
                    { id: 'p2', date: '2024-01-01', categories: {} },
                ];

                const sortBy = document.getElementById('sortBy') as HTMLSelectElement;
                sortBy.value = 'date_desc';

                expect(() => filterData(invalidPatches as any, 'changelog')).not.toThrow();
            });
        });
    });

    describe('handleSearch', () => {
        beforeEach(() => {
            document.body.innerHTML = '<input id="searchInput" value="" />';
        });

        it('should handle empty search', () => {
            (window as any).renderTabContent = vi.fn();

            handleSearch();

            // Should call renderTabContent for regular render
        });

        it('should add search term to history for terms >= 2 chars', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'ri';

            // Use the already-mocked import at the top
            const { addToSearchHistory } = await import('../../src/modules/search-history.ts');

            handleSearch();

            expect(addToSearchHistory).toHaveBeenCalledWith('ri');
        });

        it('should not add search term to history for terms < 2 chars', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'r';

            const { addToSearchHistory } = await import('../../src/modules/search-history.ts');

            // Clear previous calls
            vi.mocked(addToSearchHistory).mockClear();

            handleSearch();

            expect(addToSearchHistory).not.toHaveBeenCalled();
        });

        it('should call renderGlobalSearchResults when search has results', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test';

            (window as any).renderGlobalSearchResults = vi.fn();

            const { getState } = await import('../../src/modules/store.ts');
            vi.mocked(getState).mockImplementation((key: string) => {
                if (key === 'allData') return { items: { items: [] } };
                if (key === 'currentTab') return 'items';
                return null;
            });

            handleSearch();

            expect((window as any).renderGlobalSearchResults).toHaveBeenCalled();
        });

        it('should save filter state after search', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '';

            (window as any).renderTabContent = vi.fn();

            const { saveFilterState } = await import('../../src/modules/filter-state.ts');

            handleSearch();

            expect(saveFilterState).toHaveBeenCalled();
        });
    });

    describe('clearFilters', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <input id="searchInput" value="test search" />
                <div id="filters">
                    <select id="tierFilter"><option value="all">All</option><option value="S">S</option></select>
                    <select id="rarityFilter"><option value="all">All</option><option value="epic">Epic</option></select>
                </div>
            `;

            // Set filters to non-default values
            (document.getElementById('tierFilter') as HTMLSelectElement).value = 'S';
            (document.getElementById('rarityFilter') as HTMLSelectElement).value = 'epic';
        });

        it('should clear search input', () => {
            clearFilters();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            expect(searchInput.value).toBe('');
        });

        it('should reset all select filters to "all"', () => {
            clearFilters();

            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;

            expect(tierFilter.value).toBe('all');
            expect(rarityFilter.value).toBe('all');
        });

        it('should call renderTabContent after clearing', () => {
            (window as any).renderTabContent = vi.fn();

            clearFilters();

            expect((window as any).renderTabContent).toHaveBeenCalled();
        });
    });

    describe('combined filters', () => {
        const mockItems = [
            { id: 'item1', name: 'Ring of Power', rarity: 'legendary', tier: 'SS', stacks_well: false, one_and_done: true },
            { id: 'item2', name: 'Amulet of Health', rarity: 'epic', tier: 'S', stacks_well: true, one_and_done: false },
            { id: 'item3', name: 'Boots of Speed', rarity: 'rare', tier: 'A', stacks_well: true, one_and_done: false },
        ];

        beforeEach(() => {
            document.body.innerHTML = `
                <input id="searchInput" value="" />
                <input type="checkbox" id="favoritesOnly" />
                <select id="tierFilter"><option value="all">All</option><option value="S">S</option><option value="A">A</option></select>
                <select id="rarityFilter"><option value="all">All</option><option value="epic">Epic</option><option value="rare">Rare</option></select>
                <select id="stackingFilter"><option value="all">All</option><option value="stacks_well">Stacks Well</option></select>
                <select id="sortBy"><option value="name">Name</option></select>
            `;
        });

        it('should apply multiple filters together', () => {
            // Filter by tier S
            (document.getElementById('tierFilter') as HTMLSelectElement).value = 'S';
            // Filter by epic rarity
            (document.getElementById('rarityFilter') as HTMLSelectElement).value = 'epic';

            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item2');
        });

        it('should return empty array when no items match all filters', () => {
            // Filter by tier A
            (document.getElementById('tierFilter') as HTMLSelectElement).value = 'A';
            // Filter by epic rarity (no A tier items are epic)
            (document.getElementById('rarityFilter') as HTMLSelectElement).value = 'epic';

            const result = filterData(mockItems as any, 'items');

            expect(result).toHaveLength(0);
        });
    });
});
