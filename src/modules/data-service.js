// ========================================
// MegaBonk Data Service Module
// ========================================

// Global data storage
let allData = {
    items: null,
    weapons: null,
    tomes: null,
    characters: null,
    shrines: null,
    stats: null,
    changelog: null
};

// ========================================
// Data Loading
// ========================================

/**
 * Load all game data from JSON files
 */
async function loadAllData() {
    showLoading();

    try {
        const responses = await Promise.all([
            fetch('../data/items.json'),
            fetch('../data/weapons.json'),
            fetch('../data/tomes.json'),
            fetch('../data/characters.json'),
            fetch('../data/shrines.json'),
            fetch('../data/stats.json'),
            fetch('../data/changelog.json')
        ]);

        // Check for HTTP errors
        const failedResponses = responses.filter(r => !r.ok);
        if (failedResponses.length > 0) {
            const failedUrls = failedResponses.map(r => r.url).join(', ');
            throw new Error(`Failed to load: ${failedUrls}`);
        }

        const [items, weapons, tomes, characters, shrines, stats, changelog] = await Promise.all(
            responses.map(r => r.json())
        );

        allData = { items, weapons, tomes, characters, shrines, stats, changelog };

        // Update version info
        const versionEl = safeGetElementById('version');
        const updatedEl = safeGetElementById('last-updated');
        if (versionEl) versionEl.textContent = `Version: ${items.version || 'Unknown'}`;
        if (updatedEl) updatedEl.textContent = `Last Updated: ${items.last_updated || 'Unknown'}`;

        hideLoading();

        // Initialize UI
        switchTab('items');

    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showErrorMessage(`Could not load game data. ${error.message || 'Please check your connection and try again.'}`);
    }
}

/**
 * Get data array for a specific tab
 * @param {string} tabName - Tab name
 * @returns {Array} Data array for the tab
 */
function getDataForTab(tabName) {
    switch (tabName) {
        case 'items': return allData.items?.items || [];
        case 'weapons': return allData.weapons?.weapons || [];
        case 'tomes': return allData.tomes?.tomes || [];
        case 'characters': return allData.characters?.characters || [];
        case 'shrines': return allData.shrines?.shrines || [];
        case 'changelog': return allData.changelog?.patches || [];
        default: return [];
    }
}

/**
 * Get all data object
 * @returns {Object} All loaded data
 */
function getAllData() {
    return allData;
}

// ========================================
// Expose to global scope
// ========================================

window.allData = allData;
window.loadAllData = loadAllData;
window.getDataForTab = getDataForTab;
window.getAllData = getAllData;
