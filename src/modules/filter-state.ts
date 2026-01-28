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
 * Validate that a filter state object has the expected types
 * Bug fix: Prevents corrupted localStorage from causing runtime errors
 * @param state - State object to validate
 * @returns True if state is valid
 */
function isValidFilterState(state: unknown): state is FilterState {
    if (!state || typeof state !== 'object') return false;
    const s = state as Record<string, unknown>;

    // Validate required fields are correct types
    if (s.search !== undefined && typeof s.search !== 'string') return false;
    if (s.favoritesOnly !== undefined && typeof s.favoritesOnly !== 'boolean') return false;
    if (s.tierFilter !== undefined && typeof s.tierFilter !== 'string') return false;
    if (s.sortBy !== undefined && typeof s.sortBy !== 'string') return false;
    if (s.rarityFilter !== undefined && typeof s.rarityFilter !== 'string') return false;
    if (s.stackingFilter !== undefined && typeof s.stackingFilter !== 'string') return false;

    return true;
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

        // Bug fix: Validate state structure before using it
        if (!state || !isValidFilterState(state)) return;

        // Restore search input
        const searchInputEl = safeGetElementById('searchInput');
        if (isInputElement(searchInputEl) && typeof state.search === 'string') {
            searchInputEl.value = state.search;
        }

        // Restore favorites checkbox
        const favoritesOnlyEl = safeGetElementById('favoritesOnly');
        if (isInputElement(favoritesOnlyEl) && typeof state.favoritesOnly === 'boolean') {
            favoritesOnlyEl.checked = state.favoritesOnly;
        }

        // Restore tier filter
        const tierFilterEl = safeGetElementById('tierFilter');
        if (isSelectElement(tierFilterEl) && typeof state.tierFilter === 'string') {
            tierFilterEl.value = state.tierFilter;
        }

        // Restore sort order
        const sortByEl = safeGetElementById('sortBy');
        if (isSelectElement(sortByEl) && typeof state.sortBy === 'string') {
            sortByEl.value = state.sortBy;
        }

        // Restore items-specific filters
        if (tabName === 'items') {
            const rarityFilterEl = safeGetElementById('rarityFilter');
            if (isSelectElement(rarityFilterEl) && typeof state.rarityFilter === 'string') {
                rarityFilterEl.value = state.rarityFilter;
            }

            const stackingFilterEl = safeGetElementById('stackingFilter');
            if (isSelectElement(stackingFilterEl) && typeof state.stackingFilter === 'string') {
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
