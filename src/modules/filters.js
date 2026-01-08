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

    if (tabName === 'items') {
        filtersContainer.innerHTML = `
            <label>Rarity:</label>
            <select id="rarityFilter">
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
            </select>
            <label>Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label>Stacking:</label>
            <select id="stackingFilter">
                <option value="all">All</option>
                <option value="stacks_well">Stacks Well</option>
                <option value="one_and_done">One-and-Done</option>
            </select>
            <label>Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
                <option value="rarity">Rarity</option>
            </select>
        `;
    } else if (['weapons', 'tomes', 'characters'].includes(tabName)) {
        filtersContainer.innerHTML = `
            <label>Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label>Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
            </select>
        `;
    } else if (tabName === 'shrines') {
        filtersContainer.innerHTML = `
            <label>Type:</label>
            <select id="typeFilter">
                <option value="all">All Types</option>
                <option value="stat_upgrade">Stat Upgrade</option>
                <option value="combat">Combat</option>
                <option value="utility">Utility</option>
                <option value="risk_reward">Risk/Reward</option>
            </select>
        `;
    }

    // Re-attach event listeners
    const filterSelects = filtersContainer.querySelectorAll('select');
    filterSelects.forEach(select => {
        select.addEventListener('change', () => renderTabContent(currentTab));
    });
}

/**
 * Filter data based on current filter settings
 * @param {Array} data - Data array to filter
 * @param {string} tabName - Current tab name
 * @returns {Array} Filtered data array
 */
function filterData(data, tabName) {
    let filtered = [...data];
    const searchTerm = safeGetElementById('searchInput')?.value.toLowerCase() || '';

    // Search filter
    filtered = filtered.filter(item => {
        const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
        return searchable.includes(searchTerm);
    });

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
