// ========================================
// MegaBonk Filters Module
// ========================================

// ========================================
// Search History Management
// ========================================

const SEARCH_HISTORY_KEY = 'megabonk_search_history';
const MAX_SEARCH_HISTORY = 10;
const FILTER_STATE_KEY = 'megabonk_filter_state';

/**
 * Get search history from localStorage
 * @returns {Array<string>} Search history array
 */
function getSearchHistory() {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('[Search History] Failed to load:', error);
        return [];
    }
}

/**
 * Add search term to history
 * @param {string} term - Search term to add
 */
function addToSearchHistory(term) {
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
        console.error('[Search History] Failed to save:', error);
    }
}

/**
 * Clear search history
 */
function clearSearchHistory() {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        console.log('[Search History] Cleared');
    } catch (error) {
        console.error('[Search History] Failed to clear:', error);
    }
}

// ========================================
// Filter State Persistence (Per-Tab)
// ========================================

/**
 * Get all filter states from sessionStorage
 * @returns {Object} Object with filter states per tab
 */
function getAllFilterStates() {
    try {
        const states = sessionStorage.getItem(FILTER_STATE_KEY);
        return states ? JSON.parse(states) : {};
    } catch (error) {
        console.error('[Filter State] Failed to load:', error);
        return {};
    }
}

/**
 * Save current filter state for a specific tab
 * @param {string} tabName - Tab name
 */
function saveFilterState(tabName) {
    if (!tabName || ['build-planner', 'calculator', 'shrines', 'changelog'].includes(tabName)) {
        return; // Don't save state for tabs without filters
    }

    try {
        const state = {
            search: safeGetElementById('searchInput')?.value || '',
            favoritesOnly: safeGetElementById('favoritesOnly')?.checked || false,
            tierFilter: safeGetElementById('tierFilter')?.value || 'all',
            sortBy: safeGetElementById('sortBy')?.value || 'name',
        };

        // Add items-specific filters
        if (tabName === 'items') {
            state.rarityFilter = safeGetElementById('rarityFilter')?.value || 'all';
            state.stackingFilter = safeGetElementById('stackingFilter')?.value || 'all';
        }

        // Get all states
        const allStates = getAllFilterStates();
        allStates[tabName] = state;

        sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(allStates));
    } catch (error) {
        console.error('[Filter State] Failed to save:', error);
    }
}

/**
 * Restore filter state for a specific tab
 * @param {string} tabName - Tab name
 */
function restoreFilterState(tabName) {
    if (!tabName || ['build-planner', 'calculator', 'shrines', 'changelog'].includes(tabName)) {
        return; // No filters to restore for these tabs
    }

    try {
        const allStates = getAllFilterStates();
        const state = allStates[tabName];

        if (!state) return; // No saved state for this tab

        // Restore search input
        const searchInput = safeGetElementById('searchInput');
        if (searchInput && state.search !== undefined) {
            searchInput.value = state.search;
        }

        // Restore favorites checkbox
        const favoritesOnly = safeGetElementById('favoritesOnly');
        if (favoritesOnly && state.favoritesOnly !== undefined) {
            favoritesOnly.checked = state.favoritesOnly;
        }

        // Restore tier filter
        const tierFilter = safeGetElementById('tierFilter');
        if (tierFilter && state.tierFilter) {
            tierFilter.value = state.tierFilter;
        }

        // Restore sort order
        const sortBy = safeGetElementById('sortBy');
        if (sortBy && state.sortBy) {
            sortBy.value = state.sortBy;
        }

        // Restore items-specific filters
        if (tabName === 'items') {
            const rarityFilter = safeGetElementById('rarityFilter');
            if (rarityFilter && state.rarityFilter) {
                rarityFilter.value = state.rarityFilter;
            }

            const stackingFilter = safeGetElementById('stackingFilter');
            if (stackingFilter && state.stackingFilter) {
                stackingFilter.value = state.stackingFilter;
            }
        }
    } catch (error) {
        console.error('[Filter State] Failed to restore:', error);
    }
}

/**
 * Clear all saved filter states
 */
function clearAllFilterStates() {
    try {
        sessionStorage.removeItem(FILTER_STATE_KEY);
        console.log('[Filter State] All states cleared');
    } catch (error) {
        console.error('[Filter State] Failed to clear:', error);
    }
}

// ========================================
// Fuzzy Search Algorithm
// ========================================

/**
 * Calculate fuzzy match score between search term and text
 * @param {string} searchTerm - Search term
 * @param {string} text - Text to search in
 * @returns {number} Match score (higher is better, 0 = no match)
 */
function fuzzyMatchScore(searchTerm, text) {
    if (!searchTerm || !text) return 0;

    searchTerm = searchTerm.toLowerCase();
    text = text.toLowerCase();

    // Exact match gets highest score
    if (text.includes(searchTerm)) {
        return 1000;
    }

    // Calculate fuzzy match score
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
        return 0;
    }

    return score;
}

// ========================================
// Advanced Search Syntax Parser
// ========================================

/**
 * Parse advanced search syntax
 * Examples: "tier:SS damage:>100 stacks_well:true fire"
 * @param {string} query - Search query
 * @returns {Object} Parsed search criteria
 */
function parseAdvancedSearch(query) {
    const criteria = {
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
            criteria.filters[key] = value;
        } else {
            // Regular search term
            criteria.text.push(token);
        }
    });

    return criteria;
}

/**
 * Apply advanced filter criteria to an item
 * @param {Object} item - Item to check
 * @param {Object} filters - Filter criteria
 * @returns {boolean} True if item matches all filters
 */
function matchesAdvancedFilters(item, filters) {
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
            const numValue = parseFloat(itemValue);
            if (isNaN(threshold) || isNaN(numValue) || numValue < threshold) return false;
        } else if (value.startsWith('<=')) {
            // Check <= before < since < would match <=
            const threshold = parseFloat(value.substring(2));
            const numValue = parseFloat(itemValue);
            if (isNaN(threshold) || isNaN(numValue) || numValue > threshold) return false;
        } else if (value.startsWith('>')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(itemValue);
            if (isNaN(threshold) || isNaN(numValue) || numValue <= threshold) return false;
        } else if (value.startsWith('<')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(itemValue);
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
function updateFilters(tabName) {
    const filtersContainer = safeGetElementById('filters');
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
 * @param {Array} data - Data array to filter
 * @param {string} tabName - Current tab name
 * @returns {Array} Filtered data array
 */
function filterData(data, tabName) {
    let filtered = [...data];
    // Bug fix #12: Complete optional chaining to handle null element AND null value
    const searchQuery = safeGetElementById('searchInput')?.value || '';

    // Advanced search with fuzzy matching and syntax parsing
    if (searchQuery.trim()) {
        const criteria = parseAdvancedSearch(searchQuery);

        // Apply text search (fuzzy if enabled, exact otherwise)
        if (criteria.text.length > 0) {
            const searchTerm = criteria.text.join(' ').toLowerCase();

            filtered = filtered
                .map(item => {
                    const name = item.name || '';
                    const description = item.description || '';
                    const baseEffect = item.base_effect || '';
                    const searchable = `${name} ${description} ${baseEffect}`;

                    // Try exact match first
                    if (searchable.toLowerCase().includes(searchTerm)) {
                        return { item, score: 1000 };
                    }

                    // Try fuzzy match
                    const score = fuzzyMatchScore(searchTerm, searchable);
                    return { item, score };
                })
                .filter(result => result.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(result => result.item);
        }

        // Apply advanced filter criteria (tier:SS, damage:>100, etc.)
        if (Object.keys(criteria.filters).length > 0) {
            filtered = filtered.filter(item => matchesAdvancedFilters(item, criteria.filters));
        }
    }

    // Favorites filter
    const favoritesOnly = safeGetElementById('favoritesOnly')?.checked;
    if (favoritesOnly && typeof isFavorite === 'function') {
        filtered = filtered.filter(item => isFavorite(tabName, item.id));
    }

    // Tier filter (for items, weapons, tomes, characters)
    const tierFilter = safeGetElementById('tierFilter')?.value;
    if (tierFilter && tierFilter !== 'all') {
        filtered = filtered.filter(item => item.tier === tierFilter);
    }

    // Rarity filter (items only)
    if (tabName === 'items') {
        const rarityFilter = safeGetElementById('rarityFilter')?.value;
        if (rarityFilter && rarityFilter !== 'all') {
            filtered = filtered.filter(item => item.rarity === rarityFilter);
        }

        const stackingFilter = safeGetElementById('stackingFilter')?.value;
        if (stackingFilter === 'stacks_well') {
            filtered = filtered.filter(item => item.stacks_well === true);
        } else if (stackingFilter === 'one_and_done') {
            filtered = filtered.filter(item => item.one_and_done === true);
        }
    }

    // Type filter (shrines only)
    if (tabName === 'shrines') {
        const typeFilter = safeGetElementById('typeFilter')?.value;
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(shrine => shrine.type === typeFilter);
        }
    }

    // Category filter and sorting (changelog only)
    if (tabName === 'changelog') {
        const categoryFilter = safeGetElementById('categoryFilter')?.value;
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(patch => {
                return patch.categories?.[categoryFilter]?.length > 0;
            });
        }

        // Changelog date sorting
        // Bug fix: Handle invalid dates by putting them at the end
        const sortBy = safeGetElementById('sortBy')?.value;
        const getDateValue = dateStr => {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? (sortBy === 'date_asc' ? Infinity : -Infinity) : d.getTime();
        };
        if (sortBy === 'date_asc') {
            filtered.sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
        } else {
            // Default: newest first
            filtered.sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
        }
        return filtered;
    }

    // Sorting
    const sortBy = safeGetElementById('sortBy')?.value;
    if (sortBy) {
        sortData(filtered, sortBy);
    }

    return filtered;
}

/**
 * Handle search input
 */
function handleSearch() {
    const searchInput = safeGetElementById('searchInput');
    const searchQuery = searchInput?.value || '';

    // Save to search history if query is substantial
    if (searchQuery.trim().length >= 2) {
        addToSearchHistory(searchQuery.trim());
    }

    renderTabContent(currentTab);

    // Save filter state when search changes
    if (typeof saveFilterState === 'function') {
        saveFilterState(currentTab);
    }
}

/**
 * Clear all filters and search
 */
function clearFilters() {
    const searchInput = safeGetElementById('searchInput');
    if (searchInput) searchInput.value = '';

    safeQuerySelectorAll('#filters select').forEach(select => {
        select.value = 'all';
    });

    renderTabContent(currentTab);
}

/**
 * Show search history dropdown
 * @param {HTMLInputElement} searchInput - Search input element
 */
function showSearchHistoryDropdown(searchInput) {
    const history = getSearchHistory();
    if (history.length === 0) return;

    // Remove existing dropdown if any
    const existingDropdown = document.querySelector('.search-history-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'search-history-dropdown';
    dropdown.innerHTML = `
        <div class="search-history-header">
            <span>Recent Searches</span>
            <button class="clear-history-btn" aria-label="Clear search history">Clear</button>
        </div>
        <ul class="search-history-list">
            ${history
                .map(
                    term => `
                <li class="search-history-item" data-term="${term.replace(/"/g, '&quot;')}">
                    ${term}
                </li>
            `
                )
                .join('')}
        </ul>
    `;

    // Position dropdown
    const searchBox = searchInput.parentElement;
    searchBox.style.position = 'relative';
    searchBox.appendChild(dropdown);

    // Helper to close dropdown properly (will be set up after AbortController is created)
    let closeDropdown = () => dropdown.remove();

    // Event listeners
    dropdown.querySelector('.clear-history-btn')?.addEventListener('click', e => {
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

    const removeDropdown = () => {
        abortController.abort(); // Clean up the event listener
        if (dropdown.parentElement) {
            dropdown.remove();
        }
    };

    // Update closeDropdown to use the proper cleanup function
    closeDropdown = removeDropdown;

    document.addEventListener(
        'click',
        e => {
            if (!dropdown.contains(e.target) && e.target !== searchInput) {
                removeDropdown();
            }
        },
        { signal: abortController.signal }
    );

    // Also close on Escape key
    document.addEventListener(
        'keydown',
        e => {
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

window.updateFilters = updateFilters;
window.filterData = filterData;
window.handleSearch = handleSearch;
window.clearFilters = clearFilters;
window.getSearchHistory = getSearchHistory;
window.addToSearchHistory = addToSearchHistory;
window.clearSearchHistory = clearSearchHistory;
window.showSearchHistoryDropdown = showSearchHistoryDropdown;
window.fuzzyMatchScore = fuzzyMatchScore;
window.parseAdvancedSearch = parseAdvancedSearch;
window.saveFilterState = saveFilterState;
window.restoreFilterState = restoreFilterState;
window.clearAllFilterStates = clearAllFilterStates;
