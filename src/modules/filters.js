// ========================================
// MegaBonk Filters Module
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
    const searchTerm = safeGetElementById('searchInput')?.value?.toLowerCase() || '';

    // Search filter
    // Bug fix: Handle null item.name to prevent "null" string in searchable text
    filtered = filtered.filter(item => {
        const name = item.name || '';
        const description = item.description || '';
        const baseEffect = item.base_effect || '';
        const searchable = `${name} ${description} ${baseEffect}`.toLowerCase();
        return searchable.includes(searchTerm);
    });

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
        const getDateValue = (dateStr) => {
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
    renderTabContent(currentTab);
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

// ========================================
// Expose to global scope
// ========================================

window.updateFilters = updateFilters;
window.filterData = filterData;
window.handleSearch = handleSearch;
window.clearFilters = clearFilters;
