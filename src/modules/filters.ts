// ========================================
// MegaBonk Filters Module
// ========================================
// Main filter UI and data filtering logic
// Split into focused modules for maintainability

import type { Entity, EntityType, ChangelogPatch, SortBy } from '../types/index.ts';
import { isItem, isShrine, isInputElement, isSelectElement } from '../types/index.ts';
import { safeGetElementById, safeQuerySelectorAll, sortData } from './utils.ts';
import { logger } from './logger.ts';
import { isFavorite } from './favorites.ts';
import { getState } from './store.ts';

// Re-export from split modules for backwards compatibility
export {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    showSearchHistoryDropdown,
} from './search-history.ts';

export {
    getAllFilterStates,
    saveFilterState,
    restoreFilterState,
    clearAllFilterStates,
    type FilterState,
} from './filter-state.ts';

export {
    fuzzyMatchScore,
    parseAdvancedSearch,
    matchesAdvancedFilters,
    type FuzzyMatchResult,
    type AdvancedSearchCriteria,
} from './fuzzy-match.ts';

export { globalSearch, type GlobalSearchResult } from './global-search.ts';

// Import for internal use
import { addToSearchHistory } from './search-history.ts';
import { saveFilterState } from './filter-state.ts';
import { fuzzyMatchScore, parseAdvancedSearch, matchesAdvancedFilters } from './fuzzy-match.ts';
import { globalSearch } from './global-search.ts';
import { hideSearchDropdown } from './search-dropdown.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Item with match context (internal)
 */
interface ItemWithMatchContext extends Record<string, unknown> {
    _matchContext?: {
        score: number;
        matchType: string;
        field: string;
    };
}

// ========================================
// Filter UI
// ========================================

/**
 * Update filter dropdowns based on active tab
 * @param tabName - Current tab name
 */
export function updateFilters(tabName: string): void {
    const filtersContainer = safeGetElementById('filters') as HTMLDivElement | null;
    if (!filtersContainer) return;

    filtersContainer.innerHTML = '';

    if (tabName === 'items') {
        // DISABLED: Favorites Only checkbox hidden (feature UI disabled)
        filtersContainer.innerHTML = `
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
        // DISABLED: Favorites Only checkbox hidden (feature UI disabled)
        filtersContainer.innerHTML = `
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
        // DISABLED: Favorites Only checkbox hidden (feature UI disabled)
        filtersContainer.innerHTML = `
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
}

/**
 * Filter data based on current filter settings
 * @param data - Data array to filter
 * @param tabName - Current tab name
 * @returns Filtered data array
 */
export function filterData(data: Entity[], tabName: string): Entity[] {
    const filterStartTime = performance.now();
    const originalCount = data.length;
    let filtered = [...data];

    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value || '';

    // Advanced search with fuzzy matching
    if (searchQuery.trim()) {
        const criteria = parseAdvancedSearch(searchQuery);

        // Apply text search with match context
        if (criteria.text.length > 0) {
            const searchTerm = criteria.text.join(' ').toLowerCase();

            filtered = filtered
                .map(item => {
                    const name = item.name || '';
                    const description = item.description || '';
                    const baseEffect = isItem(item) ? item.base_effect || '' : '';
                    const tags = (item.tags || []).join(' ');

                    const matches = [
                        fuzzyMatchScore(searchTerm, name, 'name'),
                        fuzzyMatchScore(searchTerm, description, 'description'),
                        fuzzyMatchScore(searchTerm, baseEffect, 'effect'),
                        fuzzyMatchScore(searchTerm, tags, 'tags'),
                    ];

                    const bestMatch = matches.reduce((best, current) => (current.score > best.score ? current : best));

                    return {
                        item: { ...item, _matchContext: bestMatch } as Entity & ItemWithMatchContext,
                        score: bestMatch.score,
                    };
                })
                .filter(result => result.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(result => result.item as Entity);
        }

        // Apply advanced filter criteria
        if (Object.keys(criteria.filters).length > 0) {
            filtered = filtered.filter(item =>
                matchesAdvancedFilters(item as unknown as Record<string, unknown>, criteria.filters)
            );
        }
    }

    // Favorites filter
    const favoritesOnlyEl = safeGetElementById('favoritesOnly');
    const favoritesOnly = isInputElement(favoritesOnlyEl) ? favoritesOnlyEl.checked : false;
    if (favoritesOnly) {
        filtered = filtered.filter(item => isFavorite(tabName as EntityType, item.id));
    }

    // Tier filter
    const tierFilterEl = safeGetElementById('tierFilter');
    const tierFilter = isSelectElement(tierFilterEl) ? tierFilterEl.value : 'all';
    if (tierFilter && tierFilter !== 'all') {
        filtered = filtered.filter(item => item.tier === tierFilter);
    }

    // Rarity filter (items only)
    if (tabName === 'items') {
        const rarityFilterEl = safeGetElementById('rarityFilter');
        const rarityFilter = isSelectElement(rarityFilterEl) ? rarityFilterEl.value : 'all';
        if (rarityFilter && rarityFilter !== 'all') {
            filtered = filtered.filter(item => isItem(item) && item.rarity === rarityFilter);
        }

        const stackingFilterEl = safeGetElementById('stackingFilter');
        const stackingFilter = isSelectElement(stackingFilterEl) ? stackingFilterEl.value : 'all';
        if (stackingFilter === 'stacks_well') {
            filtered = filtered.filter(item => isItem(item) && item.stacks_well === true);
        } else if (stackingFilter === 'one_and_done') {
            filtered = filtered.filter(item => isItem(item) && item.one_and_done === true);
        }
    }

    // Type filter (shrines only)
    if (tabName === 'shrines') {
        const typeFilterEl = safeGetElementById('typeFilter');
        const typeFilter = isSelectElement(typeFilterEl) ? typeFilterEl.value : 'all';
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(shrine => isShrine(shrine) && shrine.type === typeFilter);
        }
    }

    // Changelog-specific filtering
    if (tabName === 'changelog') {
        type PatchWithCategories = ChangelogPatch & {
            categories?: Record<string, unknown[]>;
        };
        const patches = filtered as unknown as PatchWithCategories[];
        const categoryFilterEl = safeGetElementById('categoryFilter');
        const categoryFilter = isSelectElement(categoryFilterEl) ? categoryFilterEl.value : 'all';
        if (categoryFilter && categoryFilter !== 'all') {
            const filteredPatches = patches.filter(patch => {
                if (patch.categories && categoryFilter in patch.categories) {
                    const categoryItems = patch.categories[categoryFilter];
                    return categoryItems && categoryItems.length > 0;
                }
                return false;
            });
            filtered = filteredPatches as unknown as Entity[];
        }

        // Date sorting - pre-compute date values for O(n) instead of O(n log n) date parsing
        const sortByEl = safeGetElementById('sortBy');
        const sortBy = isSelectElement(sortByEl) ? sortByEl.value : 'date_desc';
        const patchesForSort = filtered as unknown as ChangelogPatch[];

        // Pre-compute date values once (avoids repeated parsing during sort comparisons)
        const dateCache = new Map<string, number>();
        const defaultValue = sortBy === 'date_asc' ? Infinity : -Infinity;
        patchesForSort.forEach(patch => {
            // Bug fix: Handle undefined/null patch.date to prevent Map key issues and invalid dates
            const dateKey = patch.date ?? '';
            if (!dateCache.has(dateKey)) {
                const d = new Date(dateKey);
                // If date is empty or invalid, use default value for proper sorting
                dateCache.set(dateKey, !dateKey || isNaN(d.getTime()) ? defaultValue : d.getTime());
            }
        });

        // Sort using cached date values
        if (sortBy === 'date_asc') {
            patchesForSort.sort(
                (a, b) => (dateCache.get(a.date ?? '') ?? defaultValue) - (dateCache.get(b.date ?? '') ?? defaultValue)
            );
        } else {
            patchesForSort.sort(
                (a, b) => (dateCache.get(b.date ?? '') ?? defaultValue) - (dateCache.get(a.date ?? '') ?? defaultValue)
            );
        }

        logFilterEvent(filterStartTime, tabName, searchQuery, originalCount, patchesForSort.length);
        return patchesForSort as unknown as Entity[];
    }

    // Standard sorting
    const standardSortByEl = safeGetElementById('sortBy');
    const standardSortBy = isSelectElement(standardSortByEl) ? standardSortByEl.value : null;
    if (standardSortBy) {
        sortData(filtered, standardSortBy as SortBy);
    }

    logFilterEvent(filterStartTime, tabName, searchQuery, originalCount, filtered.length);
    return filtered;
}

/**
 * Log filter event for debugging
 */
function logFilterEvent(
    startTime: number,
    tabName: string,
    searchQuery: string,
    originalCount: number,
    filteredCount: number
): void {
    const duration = Math.round(performance.now() - startTime);
    const tierFilterEl = safeGetElementById('tierFilter') as HTMLSelectElement | null;
    const favoritesOnlyEl = safeGetElementById('favoritesOnly') as HTMLInputElement | null;

    if (searchQuery.trim() || tierFilterEl?.value !== 'all' || favoritesOnlyEl?.checked) {
        logger.debug({
            operation: 'filter.apply',
            durationMs: duration,
            data: {
                tabName,
                searchQuery: searchQuery.trim(),
                totalItems: originalCount,
                matchedItems: filteredCount,
            },
        });
    }
}

/**
 * Handle search input - renders results in main content area
 * Shows current tab's matches first, then other tabs' matches
 */
export function handleSearch(): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value || '';
    const trimmedQuery = searchQuery.trim();

    // Add to search history for queries >= 2 chars
    if (trimmedQuery.length >= 2) {
        addToSearchHistory(trimmedQuery);
    }

    const currentTab = getState('currentTab');

    // Hide the dropdown (we're using main content area instead)
    hideSearchDropdown();

    // For queries >= 2 chars, show global search results in main content
    if (trimmedQuery.length >= 2) {
        const allData = getState('allData');
        if (allData && window.renderGlobalSearchResults) {
            const results = globalSearch(trimmedQuery, allData);
            // Render results in main content area with current tab prioritized
            window.renderGlobalSearchResults(results, currentTab, trimmedQuery);
        }
    } else {
        // No search or short query - render normal tab content
        if (window.renderTabContent && currentTab) {
            window.renderTabContent(currentTab);
        }
    }

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

    // Hide the search dropdown
    hideSearchDropdown();

    safeQuerySelectorAll('#filters select').forEach(el => {
        const select = el as HTMLSelectElement;
        select.value = 'all';
    });

    const currentTab = getState('currentTab');
    if (window.renderTabContent && currentTab) {
        window.renderTabContent(currentTab);
    }
}

// ========================================
// Global Scope Exports (backwards compatibility)
// ========================================

if (typeof window !== 'undefined') {
    Object.assign(window, {
        updateFilters,
        filterData,
        handleSearch,
        clearFilters,
    });
}
