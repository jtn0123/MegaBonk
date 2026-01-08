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
    changelog: null,
};

// ========================================
// Data Validation
// ========================================

/**
 * Validate data structure
 * @param {Object} data - Data object to validate
 * @param {string} type - Data type (items, weapons, etc.)
 * @returns {boolean} True if valid
 */
function validateData(data, type) {
    if (!data || typeof data !== 'object') {
        console.error(`[Data Validation] Invalid structure for ${type}: not an object`);
        return false;
    }

    // Check for version and last_updated fields
    if (!data.version || !data.last_updated) {
        console.warn(`[Data Validation] Missing version/last_updated in ${type}`);
    }

    // Check for main data array
    const dataKey = type === 'changelog' ? 'patches' : type;
    if (!Array.isArray(data[dataKey])) {
        console.error(`[Data Validation] Invalid structure for ${type}: missing ${dataKey} array`);
        return false;
    }

    // Validate array has items
    if (data[dataKey].length === 0) {
        console.warn(`[Data Validation] Empty ${dataKey} array in ${type}`);
    }

    // Basic validation of first item (check for id and name)
    if (data[dataKey].length > 0 && type !== 'stats') {
        const firstItem = data[dataKey][0];
        if (!firstItem.id) {
            console.error(`[Data Validation] First item in ${dataKey} missing id field`);
            return false;
        }
        if (type !== 'changelog' && !firstItem.name) {
            console.warn(`[Data Validation] First item in ${dataKey} missing name field`);
        }
    }

    console.log(`[Data Validation] ✓ ${type}: ${data[dataKey]?.length || 0} entries`);
    return true;
}

// ========================================
// Data Loading
// ========================================

/**
 * Fetch with timeout to prevent indefinite waiting
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds (default 30s)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout: ${url}`);
        }
        throw error;
    }
}

/**
 * Load all game data from JSON files
 */
async function loadAllData() {
    showLoading();

    try {
        const responses = await Promise.all([
            fetchWithTimeout('../data/items.json'),
            fetchWithTimeout('../data/weapons.json'),
            fetchWithTimeout('../data/tomes.json'),
            fetchWithTimeout('../data/characters.json'),
            fetchWithTimeout('../data/shrines.json'),
            fetchWithTimeout('../data/stats.json'),
            fetchWithTimeout('../data/changelog.json'),
        ]);

        // Check for HTTP errors and parse JSON safely
        const [items, weapons, tomes, characters, shrines, stats, changelog] = await Promise.all(
            responses.map(async r => {
                if (!r.ok) {
                    throw new Error(`Failed to load ${r.url}: ${r.status} ${r.statusText}`);
                }
                return r.json();
            })
        );

        // Validate all data
        const dataTypes = [
            { data: items, type: 'items' },
            { data: weapons, type: 'weapons' },
            { data: tomes, type: 'tomes' },
            { data: characters, type: 'characters' },
            { data: shrines, type: 'shrines' },
            { data: stats, type: 'stats' },
            { data: changelog, type: 'changelog' },
        ];

        for (const { data, type } of dataTypes) {
            if (!validateData(data, type)) {
                throw new Error(`Data validation failed for ${type}. Data may be corrupted.`);
            }
        }

        allData = { items, weapons, tomes, characters, shrines, stats, changelog };

        // Update version info
        const versionEl = safeGetElementById('version');
        const updatedEl = safeGetElementById('last-updated');
        if (versionEl) versionEl.textContent = `Version: ${items.version || 'Unknown'}`;
        if (updatedEl) updatedEl.textContent = `Last Updated: ${items.last_updated || 'Unknown'}`;

        hideLoading();

        // Initialize UI
        switchTab('items');

        // Load build from URL if present
        if (typeof loadBuildFromURL === 'function') {
            loadBuildFromURL();
        }
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
        case 'items':
            return allData.items?.items || [];
        case 'weapons':
            return allData.weapons?.weapons || [];
        case 'tomes':
            return allData.tomes?.tomes || [];
        case 'characters':
            return allData.characters?.characters || [];
        case 'shrines':
            return allData.shrines?.shrines || [];
        case 'changelog':
            return allData.changelog?.patches || [];
        default:
            return [];
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
