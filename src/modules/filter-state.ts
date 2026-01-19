// ========================================
// MegaBonk Filter State Module
// ========================================
// Manages filter state persistence per tab

import { safeGetElementById } from './utils.ts';
import { isInputElement, isSelectElement } from '../types/index.ts';

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
        const searchInputEl = safeGetElementById('searchInput');
        const favoritesOnlyEl = safeGetElementById('favoritesOnly');
        const tierFilterEl = safeGetElementById('tierFilter');
        const sortByEl = safeGetElementById('sortBy');

        const state: FilterState = {
            search: isInputElement(searchInputEl) ? searchInputEl.value : '',
            favoritesOnly: isInputElement(favoritesOnlyEl) ? favoritesOnlyEl.checked : false,
            tierFilter: isSelectElement(tierFilterEl) ? tierFilterEl.value : 'all',
            sortBy: isSelectElement(sortByEl) ? sortByEl.value : 'rarity',
        };

        // Add items-specific filters
        if (tabName === 'items') {
            const rarityFilterEl = safeGetElementById('rarityFilter');
            const stackingFilterEl = safeGetElementById('stackingFilter');
            state.rarityFilter = isSelectElement(rarityFilterEl) ? rarityFilterEl.value : 'all';
            state.stackingFilter = isSelectElement(stackingFilterEl) ? stackingFilterEl.value : 'all';
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
        const searchInputEl = safeGetElementById('searchInput');
        if (isInputElement(searchInputEl) && state.search !== undefined) {
            searchInputEl.value = state.search;
        }

        // Restore favorites checkbox
        const favoritesOnlyEl = safeGetElementById('favoritesOnly');
        if (isInputElement(favoritesOnlyEl) && state.favoritesOnly !== undefined) {
            favoritesOnlyEl.checked = state.favoritesOnly;
        }

        // Restore tier filter
        const tierFilterEl = safeGetElementById('tierFilter');
        if (isSelectElement(tierFilterEl) && state.tierFilter) {
            tierFilterEl.value = state.tierFilter;
        }

        // Restore sort order
        const sortByEl = safeGetElementById('sortBy');
        if (isSelectElement(sortByEl) && state.sortBy) {
            sortByEl.value = state.sortBy;
        }

        // Restore items-specific filters
        if (tabName === 'items') {
            const rarityFilterEl = safeGetElementById('rarityFilter');
            if (isSelectElement(rarityFilterEl) && state.rarityFilter) {
                rarityFilterEl.value = state.rarityFilter;
            }

            const stackingFilterEl = safeGetElementById('stackingFilter');
            if (isSelectElement(stackingFilterEl) && state.stackingFilter) {
                stackingFilterEl.value = state.stackingFilter;
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
