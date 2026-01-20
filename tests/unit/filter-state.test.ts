// ========================================
// Filter State Module Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
}));

// Mock type guards - use the actual implementation logic
vi.mock('../../src/types/index.ts', () => ({
    isInputElement: (element: Element | null): element is HTMLInputElement =>
        element !== null && element.tagName === 'INPUT',
    isSelectElement: (element: Element | null): element is HTMLSelectElement =>
        element !== null && element.tagName === 'SELECT',
}));

import {
    getAllFilterStates,
    saveFilterState,
    restoreFilterState,
    clearAllFilterStates,
    type FilterState,
} from '../../src/modules/filter-state.ts';

// ========================================
// Test Helpers
// ========================================

function createFilterInputs() {
    // Create search input
    const searchInput = document.createElement('input');
    searchInput.id = 'searchInput';
    searchInput.type = 'text';
    document.body.appendChild(searchInput);

    // Create favorites checkbox
    const favoritesOnly = document.createElement('input');
    favoritesOnly.id = 'favoritesOnly';
    favoritesOnly.type = 'checkbox';
    document.body.appendChild(favoritesOnly);

    // Create tier filter select
    const tierFilter = document.createElement('select');
    tierFilter.id = 'tierFilter';
    tierFilter.innerHTML = `
        <option value="all">All Tiers</option>
        <option value="SS">SS</option>
        <option value="S">S</option>
        <option value="A">A</option>
    `;
    document.body.appendChild(tierFilter);

    // Create sort by select
    const sortBy = document.createElement('select');
    sortBy.id = 'sortBy';
    sortBy.innerHTML = `
        <option value="rarity">Rarity</option>
        <option value="name">Name</option>
        <option value="tier">Tier</option>
    `;
    document.body.appendChild(sortBy);

    // Create items-specific filters
    const rarityFilter = document.createElement('select');
    rarityFilter.id = 'rarityFilter';
    rarityFilter.innerHTML = `
        <option value="all">All Rarities</option>
        <option value="legendary">Legendary</option>
        <option value="epic">Epic</option>
    `;
    document.body.appendChild(rarityFilter);

    const stackingFilter = document.createElement('select');
    stackingFilter.id = 'stackingFilter';
    stackingFilter.innerHTML = `
        <option value="all">All</option>
        <option value="stackable">Stackable</option>
        <option value="non-stackable">Non-Stackable</option>
    `;
    document.body.appendChild(stackingFilter);

    return {
        searchInput,
        favoritesOnly,
        tierFilter,
        sortBy,
        rarityFilter,
        stackingFilter,
    };
}

function cleanupFilterInputs() {
    const ids = ['searchInput', 'favoritesOnly', 'tierFilter', 'sortBy', 'rarityFilter', 'stackingFilter'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

// ========================================
// Tests
// ========================================

describe('filter-state module', () => {
    let sessionStorageMock: Record<string, string>;

    beforeEach(() => {
        // Reset sessionStorage mock
        sessionStorageMock = {};

        // Mock sessionStorage
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: vi.fn((key: string) => sessionStorageMock[key] || null),
                setItem: vi.fn((key: string, value: string) => {
                    sessionStorageMock[key] = value;
                }),
                removeItem: vi.fn((key: string) => {
                    delete sessionStorageMock[key];
                }),
                clear: vi.fn(() => {
                    sessionStorageMock = {};
                }),
            },
            writable: true,
            configurable: true,
        });

        // Create filter inputs in DOM
        createFilterInputs();
    });

    afterEach(() => {
        cleanupFilterInputs();
        vi.clearAllMocks();
    });

    // ========================================
    // getAllFilterStates Tests
    // ========================================
    describe('getAllFilterStates', () => {
        it('should return empty object when no state saved', () => {
            const result = getAllFilterStates();
            expect(result).toEqual({});
        });

        it('should return saved states', () => {
            const savedState = {
                items: {
                    search: 'fire',
                    favoritesOnly: true,
                    tierFilter: 'SS',
                    sortBy: 'name',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            const result = getAllFilterStates();
            expect(result).toEqual(savedState);
        });

        it('should handle malformed JSON gracefully', () => {
            sessionStorageMock['megabonk_filter_state'] = 'invalid json {';

            // Should not throw
            const result = getAllFilterStates();
            expect(result).toEqual({});
        });

        it('should return empty object when sessionStorage throws', () => {
            Object.defineProperty(window, 'sessionStorage', {
                value: {
                    getItem: () => {
                        throw new Error('Storage unavailable');
                    },
                },
                writable: true,
                configurable: true,
            });

            const result = getAllFilterStates();
            expect(result).toEqual({});
        });
    });

    // ========================================
    // saveFilterState Tests
    // ========================================
    describe('saveFilterState', () => {
        it('should save current filter state for tab', () => {
            const inputs = document.getElementById('searchInput') as HTMLInputElement;
            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            const sortBy = document.getElementById('sortBy') as HTMLSelectElement;

            inputs.value = 'fire sword';
            favoritesOnly.checked = true;
            tierFilter.value = 'SS';
            sortBy.value = 'name';

            saveFilterState('weapons');

            expect(window.sessionStorage.setItem).toHaveBeenCalled();

            const savedData = JSON.parse(sessionStorageMock['megabonk_filter_state']);
            expect(savedData.weapons).toEqual({
                search: 'fire sword',
                favoritesOnly: true,
                tierFilter: 'SS',
                sortBy: 'name',
            });
        });

        it('should save items-specific filters for items tab', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;

            searchInput.value = 'legendary';
            rarityFilter.value = 'legendary';
            stackingFilter.value = 'stackable';

            saveFilterState('items');

            const savedData = JSON.parse(sessionStorageMock['megabonk_filter_state']);
            expect(savedData.items.rarityFilter).toBe('legendary');
            expect(savedData.items.stackingFilter).toBe('stackable');
        });

        it('should not save for tabs without filters', () => {
            saveFilterState('build-planner');
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();

            saveFilterState('calculator');
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();

            saveFilterState('shrines');
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();

            saveFilterState('changelog');
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
        });

        it('should not save for empty tab name', () => {
            saveFilterState('');
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
        });

        it('should not save for null tab name', () => {
            saveFilterState(null as unknown as string);
            expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
        });

        it('should merge with existing states', () => {
            const existingState = {
                tomes: {
                    search: 'heal',
                    favoritesOnly: false,
                    tierFilter: 'A',
                    sortBy: 'rarity',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(existingState);

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'fire';
            saveFilterState('weapons');

            const savedData = JSON.parse(sessionStorageMock['megabonk_filter_state']);
            expect(savedData.tomes).toEqual(existingState.tomes);
            expect(savedData.weapons).toBeDefined();
        });

        it('should handle sessionStorage quota exceeded gracefully', () => {
            Object.defineProperty(window, 'sessionStorage', {
                value: {
                    getItem: vi.fn(() => null),
                    setItem: vi.fn(() => {
                        throw new Error('QuotaExceededError');
                    }),
                },
                writable: true,
                configurable: true,
            });

            // Should not throw
            expect(() => saveFilterState('items')).not.toThrow();
        });

        it('should handle missing filter elements', () => {
            cleanupFilterInputs();

            // Should not throw when elements don't exist
            expect(() => saveFilterState('items')).not.toThrow();
        });
    });

    // ========================================
    // restoreFilterState Tests
    // ========================================
    describe('restoreFilterState', () => {
        it('should restore saved filter state', () => {
            const savedState = {
                weapons: {
                    search: 'fire sword',
                    favoritesOnly: true,
                    tierFilter: 'SS',
                    sortBy: 'name',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            restoreFilterState('weapons');

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            const sortBy = document.getElementById('sortBy') as HTMLSelectElement;

            expect(searchInput.value).toBe('fire sword');
            expect(favoritesOnly.checked).toBe(true);
            expect(tierFilter.value).toBe('SS');
            expect(sortBy.value).toBe('name');
        });

        it('should restore items-specific filters', () => {
            const savedState = {
                items: {
                    search: 'legendary',
                    favoritesOnly: false,
                    tierFilter: 'all',
                    sortBy: 'rarity',
                    rarityFilter: 'legendary',
                    stackingFilter: 'stackable',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            restoreFilterState('items');

            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            const stackingFilter = document.getElementById('stackingFilter') as HTMLSelectElement;

            expect(rarityFilter.value).toBe('legendary');
            expect(stackingFilter.value).toBe('stackable');
        });

        it('should not restore for tabs without filters', () => {
            const savedState = {
                'build-planner': {
                    search: 'should not restore',
                    favoritesOnly: true,
                    tierFilter: 'SS',
                    sortBy: 'name',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'original';

            restoreFilterState('build-planner');

            // Should remain unchanged
            expect(searchInput.value).toBe('original');
        });

        it('should do nothing when no saved state exists', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'original';

            restoreFilterState('weapons');

            expect(searchInput.value).toBe('original');
        });

        it('should handle empty tab name', () => {
            // Should not throw
            expect(() => restoreFilterState('')).not.toThrow();
        });

        it('should handle null tab name', () => {
            // Should not throw
            expect(() => restoreFilterState(null as unknown as string)).not.toThrow();
        });

        it('should handle sessionStorage unavailable', () => {
            Object.defineProperty(window, 'sessionStorage', {
                value: {
                    getItem: () => {
                        throw new Error('Storage unavailable');
                    },
                },
                writable: true,
                configurable: true,
            });

            // Should not throw
            expect(() => restoreFilterState('items')).not.toThrow();
        });

        it('should handle missing filter elements gracefully', () => {
            const savedState = {
                weapons: {
                    search: 'fire sword',
                    favoritesOnly: true,
                    tierFilter: 'SS',
                    sortBy: 'name',
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            cleanupFilterInputs();

            // Should not throw when elements don't exist
            expect(() => restoreFilterState('weapons')).not.toThrow();
        });

        it('should handle partial saved state', () => {
            const savedState = {
                weapons: {
                    search: 'fire sword',
                    // Missing other fields
                },
            };
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify(savedState);

            // Should not throw
            expect(() => restoreFilterState('weapons')).not.toThrow();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            expect(searchInput.value).toBe('fire sword');
        });
    });

    // ========================================
    // clearAllFilterStates Tests
    // ========================================
    describe('clearAllFilterStates', () => {
        it('should remove all saved filter states', () => {
            sessionStorageMock['megabonk_filter_state'] = JSON.stringify({
                items: { search: 'fire' },
                weapons: { search: 'sword' },
            });

            clearAllFilterStates();

            expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('megabonk_filter_state');
        });

        it('should handle sessionStorage unavailable', () => {
            Object.defineProperty(window, 'sessionStorage', {
                value: {
                    removeItem: () => {
                        throw new Error('Storage unavailable');
                    },
                },
                writable: true,
                configurable: true,
            });

            // Should not throw
            expect(() => clearAllFilterStates()).not.toThrow();
        });
    });

    // ========================================
    // Round-trip Tests
    // ========================================
    describe('round-trip persistence', () => {
        it('should save and restore state correctly', () => {
            // Set initial values
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            const sortBy = document.getElementById('sortBy') as HTMLSelectElement;

            searchInput.value = 'fire sword';
            favoritesOnly.checked = true;
            tierFilter.value = 'SS';
            sortBy.value = 'name';

            // Save state
            saveFilterState('weapons');

            // Reset all inputs
            searchInput.value = '';
            favoritesOnly.checked = false;
            tierFilter.value = 'all';
            sortBy.value = 'rarity';

            // Restore state
            restoreFilterState('weapons');

            // Verify restoration
            expect(searchInput.value).toBe('fire sword');
            expect(favoritesOnly.checked).toBe(true);
            expect(tierFilter.value).toBe('SS');
            expect(sortBy.value).toBe('name');
        });

        it('should maintain separate states for multiple tabs', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            // Save items state
            searchInput.value = 'legendary item';
            saveFilterState('items');

            // Save weapons state
            searchInput.value = 'epic weapon';
            saveFilterState('weapons');

            // Save tomes state
            searchInput.value = 'rare tome';
            saveFilterState('tomes');

            // Restore and verify each
            restoreFilterState('items');
            expect(searchInput.value).toBe('legendary item');

            restoreFilterState('weapons');
            expect(searchInput.value).toBe('epic weapon');

            restoreFilterState('tomes');
            expect(searchInput.value).toBe('rare tome');
        });

        it('should preserve existing tab states when saving new tab', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            // Save items state
            searchInput.value = 'legendary item';
            saveFilterState('items');

            // Save weapons state (should not affect items)
            searchInput.value = 'epic weapon';
            saveFilterState('weapons');

            // Verify items state is preserved
            const allStates = getAllFilterStates();
            expect(allStates.items.search).toBe('legendary item');
            expect(allStates.weapons.search).toBe('epic weapon');
        });
    });
});
