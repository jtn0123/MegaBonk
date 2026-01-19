// ========================================
// MegaBonk Filters Module
// ========================================

import type {
    Entity,
    EntityType,
    Item,
    Weapon,
    Tome,
    Character,
    Shrine,
    ChangelogPatch,
    SortBy,
    AllGameData,
} from '../types/index.ts';
import { isItem, isShrine } from '../types/index.ts';
import { safeGetElementById, safeQuerySelectorAll, sortData } from './utils.ts';
import { logger } from './logger.ts';
import { isFavorite } from './favorites.ts';
import { getState } from './store.ts';

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
 * Global search result with type and score
 */
export interface GlobalSearchResult {
    type: EntityType;
    item: Item | Weapon | Tome | Character | Shrine;
    score: number;
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
// Search History Management
// ========================================
// Note: Window interface is declared in types/index.ts

/**
 * Get search history from localStorage
 * @returns {string[]} Search history array
 */
export function getSearchHistory(): string[] {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        // localStorage may be unavailable in some contexts
        console.debug('[filters] localStorage unavailable for search history:', (error as Error).message);
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
        console.debug('[filters] localStorage unavailable for saving history:', (error as Error).message);
    }
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
        console.debug('[filters] localStorage unavailable for clearing history:', (error as Error).message);
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
        // sessionStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[filters] sessionStorage unavailable for reading filter states:', (error as Error).message);
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
            sortBy: sortBy?.value || 'rarity',
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
        // sessionStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[filters] sessionStorage unavailable for saving filter state:', (error as Error).message);
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
        // sessionStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[filters] sessionStorage unavailable for restoring filter state:', (error as Error).message);
    }
}

/**
 * Clear all saved filter states
 */
export function clearAllFilterStates(): void {
    try {
        window.sessionStorage.removeItem(FILTER_STATE_KEY);
    } catch (error) {
        // sessionStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[filters] sessionStorage unavailable for clearing filter states:', (error as Error).message);
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
    // Handle null/undefined/empty inputs
    if (!searchTerm || !text || typeof searchTerm !== 'string' || typeof text !== 'string') {
        return { score: 0, matchType: 'none', field: fieldName };
    }

    // Trim and normalize whitespace
    searchTerm = searchTerm.trim().toLowerCase();
    text = text.trim().toLowerCase();

    // Return early if either is empty after trimming
    if (searchTerm.length === 0 || text.length === 0) {
        return { score: 0, matchType: 'none', field: fieldName };
    }

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
// Global Search
// ========================================

/**
 * Search across all data types (items, weapons, tomes, characters, shrines)
 * Returns results sorted by match score
 * Optimized with early termination and result limits to prevent slowness
 * @param {string} query - Search query
 * @param {AllGameData} allData - All game data
 * @returns {GlobalSearchResult[]} Sorted array of search results
 */
export function globalSearch(query: string, allData: AllGameData): GlobalSearchResult[] {
    if (!query || !query.trim()) {
        return [];
    }

    const results: GlobalSearchResult[] = [];
    const searchTerm = query.trim().toLowerCase();

    // Prioritize fields by importance - check most important first for early termination
    const searchFields = [
        'name', // Most important - exact name matches
        'base_effect', // Key for items
        'attack_pattern', // Key for weapons
        'passive_ability', // Key for characters
        'reward', // Key for shrines
        'description', // General fallback
        'effect',
        'passive',
    ];

    // Score thresholds for early termination
    const EXACT_MATCH_SCORE = 2000;
    const STARTS_WITH_SCORE = 1500;
    const MAX_TOTAL_RESULTS = 100; // Limit total results to prevent slowness

    // Define data sources with their types
    const dataSources: Array<{ type: EntityType; data: Entity[] | undefined }> = [
        { type: 'items', data: allData.items?.items },
        { type: 'weapons', data: allData.weapons?.weapons },
        { type: 'tomes', data: allData.tomes?.tomes },
        { type: 'characters', data: allData.characters?.characters },
        { type: 'shrines', data: allData.shrines?.shrines },
    ];

    // Search each data type
    for (const { type, data } of dataSources) {
        if (!data) continue;

        for (const item of data) {
            // Calculate match score across relevant fields with early termination
            let bestScore = 0;

            // Check fields in priority order, stop early if we get a high-quality match
            for (const field of searchFields) {
                const value = (item as unknown as Record<string, unknown>)[field];
                if (typeof value === 'string' && value) {
                    const match = fuzzyMatchScore(searchTerm, value, field);
                    if (match.score > bestScore) {
                        bestScore = match.score;
                        // Early termination: exact match or starts_with on name is good enough
                        if (bestScore >= STARTS_WITH_SCORE && field === 'name') {
                            break;
                        }
                        if (bestScore >= EXACT_MATCH_SCORE) {
                            break;
                        }
                    }
                }
            }

            // Only check tags if we don't have a strong match yet
            if (bestScore < STARTS_WITH_SCORE) {
                const tags = item.tags;
                if (Array.isArray(tags)) {
                    const tagsString = tags.join(' ');
                    const match = fuzzyMatchScore(searchTerm, tagsString, 'tags');
                    if (match.score > bestScore) {
                        bestScore = match.score;
                    }
                }
            }

            if (bestScore > 0) {
                results.push({
                    type,
                    item: item as Item | Weapon | Tome | Character | Shrine,
                    score: bestScore,
                });
            }
        }

        // Early termination: if we have enough high-quality results, stop searching
        if (results.length >= MAX_TOTAL_RESULTS) {
            break;
        }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
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

    // Handle null/undefined/non-string inputs
    if (!query || typeof query !== 'string') return criteria;

    // Trim and check for empty string
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return criteria;

    // Limit query length to prevent ReDoS attacks
    const safeQuery = trimmedQuery.slice(0, 1000);

    // Split by spaces but preserve quoted strings
    // This regex is safe because it's bounded by the input length limit
    const tokens = safeQuery.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    // Limit token count to prevent DoS from queries with many small tokens
    const maxTokens = 50;
    const limitedTokens = tokens.slice(0, maxTokens);

    limitedTokens.forEach(token => {
        // Skip empty tokens
        if (!token || token.length === 0) return;

        // Remove quotes if present (handle both single and double quotes)
        token = token.replace(/^["'](.*)["']$/, '$1');

        // Skip if token becomes empty after quote removal
        if (token.length === 0) return;

        // Check if it's a filter syntax (key:value)
        // Extended to support decimal values and quoted values
        const filterMatch = token.match(/^(\w+):([\w><=!.+-]+)$/);

        if (filterMatch) {
            const [, key, value] = filterMatch;
            if (key && value && key.length <= 50 && value.length <= 100) {
                // Sanitize key and value to prevent injection
                criteria.filters[key] = value;
            }
        } else {
            // Regular search term - limit individual term length
            if (token.length <= 200) {
                criteria.text.push(token);
            }
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

        // Bug fix: Handle undefined/null filter value
        if (value === undefined || value === null) {
            continue; // Skip invalid filter
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
    const filterStartTime = performance.now();
    const originalCount = data.length;
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
                    const name = item.name || '';
                    const description = item.description || '';
                    // base_effect is only on Item type, use type guard
                    const baseEffect = isItem(item) ? item.base_effect || '' : '';
                    const tags = (item.tags || []).join(' ');

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
                        item: { ...item, _matchContext: bestMatch } as Entity & ItemWithMatchContext,
                        score: bestMatch.score,
                    };
                })
                .filter(result => result.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(result => result.item as Entity);
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
    if (favoritesOnly) {
        filtered = filtered.filter(item => isFavorite(tabName as EntityType, item.id));
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
            filtered = filtered.filter(item => isItem(item) && item.stacks_well === true);
        } else if (stackingFilter === 'one_and_done') {
            filtered = filtered.filter(item => isItem(item) && item.one_and_done === true);
        }
    }

    // Type filter (shrines only)
    if (tabName === 'shrines') {
        const typeFilterEl = safeGetElementById('typeFilter') as HTMLSelectElement | null;
        const typeFilter = typeFilterEl?.value;
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(shrine => isShrine(shrine) && shrine.type === typeFilter);
        }
    }

    // Category filter and sorting (changelog only)
    if (tabName === 'changelog') {
        // Extended patch type with categories for filtering
        type PatchWithCategories = ChangelogPatch & {
            categories?: Record<string, unknown[]>;
        };
        const patches = filtered as unknown as PatchWithCategories[];
        const categoryFilterEl = safeGetElementById('categoryFilter') as HTMLSelectElement | null;
        const categoryFilter = categoryFilterEl?.value;
        if (categoryFilter && categoryFilter !== 'all') {
            const filteredPatches = patches.filter(patch => {
                if (patch.categories && categoryFilter in patch.categories) {
                    const categoryItems = patch.categories[categoryFilter];
                    return categoryItems && categoryItems.length > 0;
                }
                return false;
            });
            // Update filtered for the rest of the function
            filtered = filteredPatches as unknown as Entity[];
        }

        // Changelog date sorting
        // Bug fix: Handle invalid dates by putting them at the end
        const sortByEl = safeGetElementById('sortBy') as HTMLSelectElement | null;
        const sortBy = sortByEl?.value;
        const getDateValue = (dateStr: string): number => {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? (sortBy === 'date_asc' ? Infinity : -Infinity) : d.getTime();
        };
        const patchesForSort = filtered as unknown as ChangelogPatch[];
        if (sortBy === 'date_asc') {
            patchesForSort.sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
        } else {
            // Default: newest first
            patchesForSort.sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
        }

        // Log filter event for changelog
        const filterDuration = Math.round(performance.now() - filterStartTime);
        if (searchQuery.trim() || categoryFilter !== 'all') {
            logger.debug({
                operation: 'filter.apply',
                durationMs: filterDuration,
                data: {
                    tabName,
                    searchQuery: searchQuery.trim(),
                    filters: { category: categoryFilter, sortBy },
                    totalItems: originalCount,
                    matchedItems: patchesForSort.length,
                },
            });
        }

        return patchesForSort as unknown as Entity[];
    }

    // Sorting
    const sortByEl = safeGetElementById('sortBy') as HTMLSelectElement | null;
    const sortBy = sortByEl?.value;
    if (sortBy) {
        sortData(filtered, sortBy as SortBy);
    }

    // Log filter event
    const filterDuration = Math.round(performance.now() - filterStartTime);
    const logTierFilter = tierFilterEl?.value || 'all';
    const logFavoritesOnly = favoritesOnlyEl?.checked || false;

    // Only log if there's an active filter (not just initial load)
    if (searchQuery.trim() || logTierFilter !== 'all' || logFavoritesOnly) {
        logger.debug({
            operation: 'filter.apply',
            durationMs: filterDuration,
            data: {
                tabName,
                searchQuery: searchQuery.trim(),
                filters: {
                    tier: logTierFilter,
                    favoritesOnly: logFavoritesOnly,
                    sortBy,
                },
                totalItems: originalCount,
                matchedItems: filtered.length,
                matchType: searchQuery.trim() ? 'fuzzy' : 'standard',
            },
        });
    }

    return filtered;
}

/**
 * Handle search input - performs global search across all tabs
 */
export function handleSearch(): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value || '';

    // Save to search history if query is substantial
    if (searchQuery.trim().length >= 2) {
        addToSearchHistory(searchQuery.trim());
    }

    // If there's a search query, perform global search
    if (searchQuery.trim()) {
        // Get allData from global scope
        const allData = window.allData;
        if (allData && window.renderGlobalSearchResults) {
            const results = globalSearch(searchQuery.trim(), allData);
            window.renderGlobalSearchResults(results);
            return;
        }
    }

    // No search query - render normal tab content
    const currentTab = getState('currentTab');
    if (window.renderTabContent && currentTab) {
        window.renderTabContent(currentTab);
    }

    // Save filter state when search changes
    if (currentTab) {
        saveFilterState(currentTab);
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

    const currentTab = getState('currentTab');
    if (window.renderTabContent && currentTab) {
        window.renderTabContent(currentTab);
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
                    (term, index) => `
                <li class="search-history-item" role="option" tabindex="0" data-term="${term.replace(/"/g, '&quot;')}" data-index="${index}" aria-selected="false">
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

    const historyItems = dropdown.querySelectorAll('.search-history-item');
    let currentIndex = -1;

    // Helper to update active item state
    const updateActiveItem = (): void => {
        historyItems.forEach((item, i) => {
            const isActive = i === currentIndex;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (isActive) {
                (item as HTMLElement).focus();
            }
        });
    };

    // Helper to select current item
    const selectCurrentItem = (): void => {
        if (currentIndex >= 0 && currentIndex < historyItems.length) {
            const item = historyItems[currentIndex] as HTMLElement;
            const term = item.getAttribute('data-term');
            if (term && searchInput) {
                searchInput.value = term;
                handleSearch();
                closeDropdown();
            }
        }
    };

    // Close dropdown when clicking outside - use AbortController to prevent memory leaks
    // NOTE: AbortController must be created BEFORE adding event listeners to avoid memory leaks
    const abortController = new AbortController();

    historyItems.forEach(item => {
        item.addEventListener(
            'click',
            () => {
                const term = item.getAttribute('data-term');
                if (term && searchInput) {
                    searchInput.value = term;
                    handleSearch();
                    closeDropdown();
                }
            },
            { signal: abortController.signal }
        );
    });

    // Keyboard navigation for search history
    searchInput.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, historyItems.length - 1);
                updateActiveItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                updateActiveItem();
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                selectCurrentItem();
            }
        },
        { signal: abortController.signal }
    );

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
        globalSearch,
    });
}
