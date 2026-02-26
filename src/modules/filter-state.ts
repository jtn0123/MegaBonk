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
function restoreInputValue(id: string, value: unknown): void {
    if (typeof value !== 'string') return;
    const el = safeGetElementById(id);
    if (isInputElement(el)) el.value = value;
}

function restoreSelectValue(id: string, value: unknown): void {
    if (typeof value !== 'string') return;
    const el = safeGetElementById(id);
    if (isSelectElement(el)) el.value = value;
}

function restoreCheckbox(id: string, value: unknown): void {
    if (typeof value !== 'boolean') return;
    const el = safeGetElementById(id);
    if (isInputElement(el)) el.checked = value;
}

export function restoreFilterState(tabName: string): void {
    if (!tabName || TABS_WITHOUT_FILTERS.includes(tabName)) return;

    try {
        const allStates = getAllFilterStates();
        const state = allStates[tabName];
        if (!state || !isValidFilterState(state)) return;

        restoreInputValue('searchInput', state.search);
        restoreCheckbox('favoritesOnly', state.favoritesOnly);
        restoreSelectValue('tierFilter', state.tierFilter);
        restoreSelectValue('sortBy', state.sortBy);

        if (tabName === 'items') {
            restoreSelectValue('rarityFilter', state.rarityFilter);
            restoreSelectValue('stackingFilter', state.stackingFilter);
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
