// ========================================
// MegaBonk Filters Module
// ========================================

import type { Entity, EntityType, Item, SortBy } from '../types/index.ts';
import { safeGetElementById, safeQuerySelectorAll, sortData } from './utils.ts';

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

/**
 * Fuzzy match result with context
 */
export interface FuzzyMatchResult {
    score: number;
    matchType: 'exact' | 'starts_with' | 'contains' | 'fuzzy' | 'none';
    field: string;
}

/**
 * Advanced search criteria
 */
export interface AdvancedSearchCriteria {
    text: string[];
    filters: Record<string, string>;
}

/**
 * Item with match context (internal)
 */
interface ItemWithMatchContext extends Record<string, unknown> {
    _matchContext?: FuzzyMatchResult;
}

// ========================================
// Constants
// ========================================

const SEARCH_HISTORY_KEY = 'megabonk_search_history';
const MAX_SEARCH_HISTORY = 10;
const FILTER_STATE_KEY = 'megabonk_filter_state';

// ========================================
// Global Function Types (from window object)
// ========================================

// Note: TabName type includes all tabs (items, weapons, tomes, characters, shrines, build-planner, calculator)
// while EntityType only includes entity tabs. Window.currentTab uses TabName to support all tabs.
type TabName = 'items' | 'weapons' | 'tomes' | 'characters' | 'shrines' | 'build-planner' | 'calculator';

declare global {
    interface Window {
        isFavorite?: (tabName: EntityType, id: string) => boolean;
        renderTabContent?: (tabName: TabName) => void;
        currentTab?: TabName;
        clearFilters?: () => void;
        toggleTextExpand?: (element: HTMLElement) => void;
        filteredData?: Entity[];
    }
}

// ========================================
// Search History Management
// ========================================

/**
 * Get search history from localStorage
 * @returns {string[]} Search history array
 */
export function getSearchHistory(): string[] {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        // localStorage may be unavailable
        return [];
    }
}

/**
 * Add search term to history
 * @param {string} term - Search term to add
 */
export function addToSearchHistory(term: string): void {
    if (!term || term.trim().length < 2) return;

    try {
        let history = getSearchHistory();

        // Remove duplicates and add to front
        history = history.filter(item => item !== term);
        history.unshift(term);

        // Keep only MAX_SEARCH_HISTORY items
        history = history.slice(0, MAX_SEARCH_HISTORY);

        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        // localStorage may be unavailable
    }
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
        // localStorage may be unavailable
    }
}

// ========================================
// Filter State Persistence (Per-Tab)
// ========================================

/**
 * Get all filter states from sessionStorage
 * @returns {Record<string, FilterState>} Object with filter states per tab
 */
export function getAllFilterStates(): Record<string, FilterState> {
    try {
        const states = window.sessionStorage.getItem(FILTER_STATE_KEY);
        return states ? JSON.parse(states) : {};
    } catch (error) {
        // sessionStorage may be unavailable
        return {};
    }
}

/**
 * Save current filter state for a specific tab
 * @param {string} tabName - Tab name
 */
export function saveFilterState(tabName: string): void {
    if (!tabName || ['build-planner', 'calculator', 'shrines', 'changelog'].includes(tabName)) {
        return; // Don't save state for tabs without filters
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
            sortBy: sortBy?.value || 'name',
        };

        // Add items-specific filters
        if (tabName === 'items') {
            const rarityFilter = safeGetElementById('rarityFilter') as HTMLSelectElement | null;
            const stackingFilter = safeGetElementById('stackingFilter') as HTMLSelectElement | null;
            state.rarityFilter = rarityFilter?.value || 'all';
            state.stackingFilter = stackingFilter?.value || 'all';
        }

        // Get all states
        const allStates = getAllFilterStates();
        allStates[tabName] = state;

        window.sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(allStates));
    } catch (error) {
        // sessionStorage may be unavailable
    }
}

/**
 * Restore filter state for a specific tab
 * @param {string} tabName - Tab name
 */
export function restoreFilterState(tabName: string): void {
    if (!tabName || ['build-planner', 'calculator', 'shrines', 'changelog'].includes(tabName)) {
        return; // No filters to restore for these tabs
    }

    try {
        const allStates = getAllFilterStates();
        const state = allStates[tabName];

        if (!state) return; // No saved state for this tab

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
        // sessionStorage may be unavailable
    }
}

/**
 * Clear all saved filter states
 */
export function clearAllFilterStates(): void {
    try {
        window.sessionStorage.removeItem(FILTER_STATE_KEY);
    } catch (error) {
        // sessionStorage may be unavailable
    }
}

// ========================================
// Fuzzy Search Algorithm
// ========================================

/**
 * Calculate fuzzy match score between search term and text
 * Returns both score and match type for UX context
 * @param {string} searchTerm - Search term
 * @param {string} text - Text to search in
 * @param {string} fieldName - Name of field being searched (for context)
 * @returns {FuzzyMatchResult} Match result with context
 */
export function fuzzyMatchScore(searchTerm: string, text: string, fieldName: string = 'text'): FuzzyMatchResult {
    if (!searchTerm || !text) return { score: 0, matchType: 'none', field: fieldName };

    searchTerm = searchTerm.toLowerCase();
    text = text.toLowerCase();

    // Exact match gets highest score
    if (text === searchTerm) {
        return { score: 2000, matchType: 'exact', field: fieldName };
    }

    // Starts with search term (very relevant)
    if (text.startsWith(searchTerm)) {
        return { score: 1500, matchType: 'starts_with', field: fieldName };
    }

    // Contains search term (substring match)
    if (text.includes(searchTerm)) {
        return { score: 1000, matchType: 'contains', field: fieldName };
    }

    // Calculate fuzzy match score (character sequence)
    let score = 0;
    let searchIndex = 0;
    let consecutiveMatches = 0;

    for (let i = 0; i < text.length && searchIndex < searchTerm.length; i++) {
        if (text[i] === searchTerm[searchIndex]) {
            score += 1 + consecutiveMatches;
            consecutiveMatches++;
            searchIndex++;
        } else {
            consecutiveMatches = 0;
        }
    }

    // Return 0 if not all characters matched
    if (searchIndex !== searchTerm.length) {
        return { score: 0, matchType: 'none', field: fieldName };
    }

    return { score, matchType: 'fuzzy', field: fieldName };
}

// ========================================
// Advanced Search Syntax Parser
// ========================================

/**
 * Parse advanced search syntax
 * Examples: "tier:SS damage:>100 stacks_well:true fire"
 * @param {string} query - Search query
 * @returns {AdvancedSearchCriteria} Parsed search criteria
 */
export function parseAdvancedSearch(query: string): AdvancedSearchCriteria {
    const criteria: AdvancedSearchCriteria = {
        text: [],
        filters: {},
    };

    if (!query) return criteria;

    // Split by spaces but preserve quoted strings
    const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    tokens.forEach(token => {
        // Remove quotes if present
        token = token.replace(/^"(.*)"$/, '$1');

        // Check if it's a filter syntax (key:value)
        const filterMatch = token.match(/^(\w+):([\w><=!]+)$/);

        if (filterMatch) {
            const [, key, value] = filterMatch;
            if (key && value) {
                criteria.filters[key] = value;
            }
        } else {
            // Regular search term
            criteria.text.push(token);
        }
    });

    return criteria;
}

/**
 * Apply advanced filter criteria to an item
 * @param {Record<string, unknown>} item - Item to check
 * @param {Record<string, string>} filters - Filter criteria
 * @returns {boolean} True if item matches all filters
 */
export function matchesAdvancedFilters(item: Record<string, unknown>, filters: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(filters)) {
        const itemValue = item[key];

        // Bug fix: Handle undefined/null itemValue
        if (itemValue === undefined || itemValue === null) {
            return false; // Item doesn't have this property, so it doesn't match
        }

        // Handle comparison operators
        if (value.startsWith('>=')) {
            // Check >= before > since > would match >=
            const threshold = parseFloat(value.substring(2));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue < threshold) return false;
        } else if (value.startsWith('<=')) {
            // Check <= before < since < would match <=
            const threshold = parseFloat(value.substring(2));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue > threshold) return false;
        } else if (value.startsWith('>')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue <= threshold) return false;
        } else if (value.startsWith('<')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue >= threshold) return false;
        } else if (value.startsWith('!')) {
            // Not equal
            if (String(itemValue).toLowerCase() === value.substring(1).toLowerCase()) return false;
        } else {
            // Exact match (case insensitive)
            if (String(itemValue).toLowerCase() !== value.toLowerCase()) return false;
        }
    }

    return true;
}

// ========================================
// Filter UI
// ========================================

/**
 * Update filter dropdowns based on active tab
 * @param {string} tabName - Current tab name
 */
export function updateFilters(tabName: string): void {
    const filtersContainer = safeGetElementById('filters') as HTMLDivElement | null;
    if (!filtersContainer) return;

    filtersContainer.innerHTML = '';

    // Bug fix: Add 'for' attributes to labels for accessibility (WCAG Level A)
    if (tabName === 'items') {
        filtersContainer.innerHTML = `
            <label for="favoritesOnly">
                <input type="checkbox" id="favoritesOnly" />
                ⭐ Favorites Only
            </label>
            <label for="rarityFilter">Rarity:</label>
            <select id="rarityFilter">
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
            </select>
            <label for="tierFilter">Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label for="stackingFilter">Stacking:</label>
            <select id="stackingFilter">
                <option value="all">All</option>
                <option value="stacks_well">Stacks Well</option>
                <option value="one_and_done">One-and-Done</option>
            </select>
            <label for="sortBy">Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
                <option value="rarity">Rarity</option>
            </select>
        `;
    } else if (['weapons', 'tomes', 'characters'].includes(tabName)) {
        filtersContainer.innerHTML = `
            <label for="favoritesOnly">
                <input type="checkbox" id="favoritesOnly" />
                ⭐ Favorites Only
            </label>
            <label for="tierFilter">Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label for="sortBy">Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
            </select>
        `;
    } else if (tabName === 'shrines') {
        filtersContainer.innerHTML = `
            <label for="favoritesOnly">
                <input type="checkbox" id="favoritesOnly" />
                ⭐ Favorites Only
            </label>
            <label for="typeFilter">Type:</label>
            <select id="typeFilter">
                <option value="all">All Types</option>
                <option value="stat_upgrade">Stat Upgrade</option>
                <option value="combat">Combat</option>
                <option value="utility">Utility</option>
                <option value="risk_reward">Risk/Reward</option>
            </select>
        `;
    } else if (tabName === 'changelog') {
        filtersContainer.innerHTML = `
            <label for="categoryFilter">Category:</label>
            <select id="categoryFilter">
                <option value="all">All Categories</option>
                <option value="balance">Balance Changes</option>
                <option value="new_content">New Content</option>
                <option value="bug_fixes">Bug Fixes</option>
                <option value="removed">Removed</option>
                <option value="other">Other</option>
            </select>
            <label for="sortBy">Sort:</label>
            <select id="sortBy">
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
            </select>
        `;
    }
    // Event listeners handled via delegation in events.js
}

/**
 * Filter data based on current filter settings
 * @param {Entity[]} data - Data array to filter
 * @param {string} tabName - Current tab name
 * @returns {Entity[]} Filtered data array
 */
export function filterData(data: Entity[], tabName: string): Entity[] {
    let filtered = [...data];
    // Bug fix #12: Complete optional chaining to handle null element AND null value
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value || '';

    // Advanced search with fuzzy matching and syntax parsing
    if (searchQuery.trim()) {
        const criteria = parseAdvancedSearch(searchQuery);

        // Apply text search with match context for UX
        if (criteria.text.length > 0) {
            const searchTerm = criteria.text.join(' ').toLowerCase();

            filtered = filtered
                .map(item => {
                    const itemObj = item as unknown as Record<string, unknown>;
                    const name = (itemObj.name as string) || '';
                    const description = (itemObj.description as string) || '';
                    const baseEffect = (itemObj.base_effect as string) || '';
                    const tags = ((itemObj.tags as string[]) || []).join(' ');

                    // Check each field separately for match context
                    const matches = [
                        fuzzyMatchScore(searchTerm, name, 'name'),
                        fuzzyMatchScore(searchTerm, description, 'description'),
                        fuzzyMatchScore(searchTerm, baseEffect, 'effect'),
                        fuzzyMatchScore(searchTerm, tags, 'tags'),
                    ];

                    // Find best match
                    const bestMatch = matches.reduce((best, current) => (current.score > best.score ? current : best));

                    // Attach match context to item for rendering
                    return {
                        item: { ...itemObj, _matchContext: bestMatch } as ItemWithMatchContext,
                        score: bestMatch.score,
                    };
                })
                .filter(result => result.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(result => result.item as unknown as Entity);
        }

        // Apply advanced filter criteria (tier:SS, damage:>100, etc.)
        if (Object.keys(criteria.filters).length > 0) {
            filtered = filtered.filter(item =>
                matchesAdvancedFilters(item as unknown as Record<string, unknown>, criteria.filters)
            );
        }
    }

    // Favorites filter
    const favoritesOnlyEl = safeGetElementById('favoritesOnly') as HTMLInputElement | null;
    const favoritesOnly = favoritesOnlyEl?.checked;
    if (favoritesOnly && typeof window.isFavorite === 'function') {
        filtered = filtered.filter(item => window.isFavorite!(tabName as EntityType, item.id));
    }

    // Tier filter (for items, weapons, tomes, characters)
    const tierFilterEl = safeGetElementById('tierFilter') as HTMLSelectElement | null;
    const tierFilter = tierFilterEl?.value;
    if (tierFilter && tierFilter !== 'all') {
        filtered = filtered.filter(item => item.tier === tierFilter);
    }

    // Rarity filter (items only)
    if (tabName === 'items') {
        const rarityFilterEl = safeGetElementById('rarityFilter') as HTMLSelectElement | null;
        const rarityFilter = rarityFilterEl?.value;
        if (rarityFilter && rarityFilter !== 'all') {
            filtered = filtered.filter(item => (item as Item).rarity === rarityFilter);
        }

        const stackingFilterEl = safeGetElementById('stackingFilter') as HTMLSelectElement | null;
        const stackingFilter = stackingFilterEl?.value;
        if (stackingFilter === 'stacks_well') {
            filtered = filtered.filter(item => (item as unknown as Record<string, unknown>).stacks_well === true);
        } else if (stackingFilter === 'one_and_done') {
            filtered = filtered.filter(item => (item as unknown as Record<string, unknown>).one_and_done === true);
        }
    }

    // Type filter (shrines only)
    if (tabName === 'shrines') {
        const typeFilterEl = safeGetElementById('typeFilter') as HTMLSelectElement | null;
        const typeFilter = typeFilterEl?.value;
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(shrine => (shrine as unknown as Record<string, unknown>).type === typeFilter);
        }
    }

    // Category filter and sorting (changelog only)
    if (tabName === 'changelog') {
        const categoryFilterEl = safeGetElementById('categoryFilter') as HTMLSelectElement | null;
        const categoryFilter = categoryFilterEl?.value;
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(patch => {
                const categories = (patch as unknown as Record<string, unknown>).categories as
                    | Record<string, unknown[]>
                    | undefined;
                if (categories && categoryFilter in categories) {
                    return (categories[categoryFilter] as unknown[])?.length > 0;
                }
                return false;
            });
        }

        // Changelog date sorting
        // Bug fix: Handle invalid dates by putting them at the end
        const sortByEl = safeGetElementById('sortBy') as HTMLSelectElement | null;
        const sortBy = sortByEl?.value;
        const getDateValue = (dateStr: string): number => {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? (sortBy === 'date_asc' ? Infinity : -Infinity) : d.getTime();
        };
        if (sortBy === 'date_asc') {
            filtered.sort((a, b) => {
                const aDate = (a as unknown as Record<string, unknown>).date as string;
                const bDate = (b as unknown as Record<string, unknown>).date as string;
                return getDateValue(aDate) - getDateValue(bDate);
            });
        } else {
            // Default: newest first
            filtered.sort((a, b) => {
                const aDate = (a as unknown as Record<string, unknown>).date as string;
                const bDate = (b as unknown as Record<string, unknown>).date as string;
                return getDateValue(bDate) - getDateValue(aDate);
            });
        }
        return filtered;
    }

    // Sorting
    const sortByEl = safeGetElementById('sortBy') as HTMLSelectElement | null;
    const sortBy = sortByEl?.value;
    if (sortBy) {
        sortData(filtered, sortBy as SortBy);
    }

    return filtered;
}

/**
 * Handle search input
 */
export function handleSearch(): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value || '';

    // Save to search history if query is substantial
    if (searchQuery.trim().length >= 2) {
        addToSearchHistory(searchQuery.trim());
    }

    if (window.renderTabContent && window.currentTab) {
        window.renderTabContent(window.currentTab);
    }

    // Save filter state when search changes
    if (window.currentTab) {
        saveFilterState(window.currentTab);
    }
}

/**
 * Clear all filters and search
 */
export function clearFilters(): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    safeQuerySelectorAll('#filters select').forEach(el => {
        const select = el as HTMLSelectElement;
        select.value = 'all';
    });

    if (window.renderTabContent && window.currentTab) {
        window.renderTabContent(window.currentTab);
    }
}

/**
 * Show search history dropdown
 * @param {HTMLInputElement} searchInput - Search input element
 */
export function showSearchHistoryDropdown(searchInput: HTMLInputElement): void {
    const history = getSearchHistory();
    if (history.length === 0) return;

    // Remove existing dropdown if any
    const existingDropdown = document.querySelector('.search-history-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    // Create dropdown with ARIA attributes for accessibility
    const dropdown = document.createElement('div');
    dropdown.className = 'search-history-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Search history');
    searchInput.setAttribute('aria-expanded', 'true');
    searchInput.setAttribute('aria-haspopup', 'listbox');
    dropdown.innerHTML = `
        <div class="search-history-header">
            <span>Recent Searches</span>
            <button class="clear-history-btn" aria-label="Clear search history">Clear</button>
        </div>
        <ul class="search-history-list" role="group">
            ${history
                .map(
                    term => `
                <li class="search-history-item" role="option" data-term="${term.replace(/"/g, '&quot;')}">
                    ${term}
                </li>
            `
                )
                .join('')}
        </ul>
    `;

    // Position dropdown
    const searchBox = searchInput.parentElement;
    if (searchBox) {
        searchBox.style.position = 'relative';
        searchBox.appendChild(dropdown);
    }

    // Helper to close dropdown properly (will be set up after AbortController is created)
    let closeDropdown: () => void = () => dropdown.remove();

    // Event listeners
    const clearBtn = dropdown.querySelector('.clear-history-btn') as HTMLButtonElement | null;
    clearBtn?.addEventListener('click', e => {
        e.stopPropagation();
        clearSearchHistory();
        closeDropdown();
    });

    dropdown.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const term = item.getAttribute('data-term');
            if (term && searchInput) {
                searchInput.value = term;
                handleSearch();
                closeDropdown();
            }
        });
    });

    // Close dropdown when clicking outside - use AbortController to prevent memory leaks
    const abortController = new AbortController();

    const removeDropdown = (): void => {
        abortController.abort(); // Clean up the event listener
        searchInput.setAttribute('aria-expanded', 'false');
        if (dropdown.parentElement) {
            dropdown.remove();
        }
    };

    // Update closeDropdown to use the proper cleanup function
    closeDropdown = removeDropdown;

    document.addEventListener(
        'click',
        (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && e.target !== searchInput) {
                removeDropdown();
            }
        },
        { signal: abortController.signal }
    );

    // Also close on Escape key
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                removeDropdown();
                searchInput?.focus();
            }
        },
        { signal: abortController.signal }
    );
}

// ========================================
// Expose to global scope
// ========================================

// Export window methods if needed for backward compatibility
if (typeof window !== 'undefined') {
    Object.assign(window, {
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
        updateFilters,
        filterData,
        handleSearch,
        clearFilters,
        showSearchHistoryDropdown,
    });
}
