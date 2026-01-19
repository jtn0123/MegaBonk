// ========================================
// MegaBonk Filter State Module
// ========================================
// Manages filter state persistence per tab

import { safeGetElementById } from './utils.ts';

// ========================================
// Constants
// ========================================

const FILTER_STATE_KEY = 'megabonk_filter_state';

// Tabs that don't have filters
const TABS_WITHOUT_FILTERS = ['build-planner', 'calculator', 'shrines', 'changelog'];

// ========================================
// Type Definitions
// ========================================

/**
 * Filter state interface for persistence
 */
export interface FilterState {
    search: string;
    favoritesOnly: boolean;
    tierFilter: string;
    sortBy: string;
    rarityFilter?: string;
    stackingFilter?: string;
}

// ========================================
// Filter State Persistence
// ========================================

/**
 * Get all filter states from sessionStorage
 * @returns Object with filter states per tab
 */
export function getAllFilterStates(): Record<string, FilterState> {
    try {
        const states = window.sessionStorage.getItem(FILTER_STATE_KEY);
        return states ? JSON.parse(states) : {};
    } catch (error) {
        console.debug('[filter-state] sessionStorage unavailable:', (error as Error).message);
        return {};
    }
}

/**
 * Save current filter state for a specific tab
 * @param tabName - Tab name
 */
export function saveFilterState(tabName: string): void {
    if (!tabName || TABS_WITHOUT_FILTERS.includes(tabName)) {
        return;
    }

    try {
        const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
        const favoritesOnly = safeGetElementById('favoritesOnly') as HTMLInputElement | null;
        const tierFilter = safeGetElementById('tierFilter') as HTMLSelectElement | null;
        const sortBy = safeGetElementById('sortBy') as HTMLSelectElement | null;

        const state: FilterState = {
            search: searchInput?.value || '',
            favoritesOnly: favoritesOnly?.checked || false,
            tierFilter: tierFilter?.value || 'all',
            sortBy: sortBy?.value || 'rarity',
        };

        // Add items-specific filters
        if (tabName === 'items') {
            const rarityFilter = safeGetElementById('rarityFilter') as HTMLSelectElement | null;
            const stackingFilter = safeGetElementById('stackingFilter') as HTMLSelectElement | null;
            state.rarityFilter = rarityFilter?.value || 'all';
            state.stackingFilter = stackingFilter?.value || 'all';
        }

        const allStates = getAllFilterStates();
        allStates[tabName] = state;

        window.sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(allStates));
    } catch (error) {
        console.debug('[filter-state] sessionStorage unavailable:', (error as Error).message);
    }
}

/**
 * Restore filter state for a specific tab
 * @param tabName - Tab name
 */
export function restoreFilterState(tabName: string): void {
    if (!tabName || TABS_WITHOUT_FILTERS.includes(tabName)) {
        return;
    }

    try {
        const allStates = getAllFilterStates();
        const state = allStates[tabName];

        if (!state) return;

        // Restore search input
        const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
        if (searchInput && state.search !== undefined) {
            searchInput.value = state.search;
        }

        // Restore favorites checkbox
        const favoritesOnly = safeGetElementById('favoritesOnly') as HTMLInputElement | null;
        if (favoritesOnly && state.favoritesOnly !== undefined) {
            favoritesOnly.checked = state.favoritesOnly;
        }

        // Restore tier filter
        const tierFilter = safeGetElementById('tierFilter') as HTMLSelectElement | null;
        if (tierFilter && state.tierFilter) {
            tierFilter.value = state.tierFilter;
        }

        // Restore sort order
        const sortBy = safeGetElementById('sortBy') as HTMLSelectElement | null;
        if (sortBy && state.sortBy) {
            sortBy.value = state.sortBy;
        }

        // Restore items-specific filters
        if (tabName === 'items') {
            const rarityFilter = safeGetElementById('rarityFilter') as HTMLSelectElement | null;
            if (rarityFilter && state.rarityFilter) {
                rarityFilter.value = state.rarityFilter;
            }

            const stackingFilter = safeGetElementById('stackingFilter') as HTMLSelectElement | null;
            if (stackingFilter && state.stackingFilter) {
                stackingFilter.value = state.stackingFilter;
            }
        }
    } catch (error) {
        console.debug('[filter-state] sessionStorage unavailable:', (error as Error).message);
    }
}

/**
 * Clear all saved filter states
 */
export function clearAllFilterStates(): void {
    try {
        window.sessionStorage.removeItem(FILTER_STATE_KEY);
    } catch (error) {
        console.debug('[filter-state] sessionStorage unavailable:', (error as Error).message);
    }
}
