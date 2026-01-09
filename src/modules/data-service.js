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

    // Check for main data array/object
    const dataKey = type === 'changelog' ? 'patches' : type;

    // Stats uses an object structure, not an array
    if (type === 'stats') {
        if (!data[dataKey] || typeof data[dataKey] !== 'object' || Array.isArray(data[dataKey])) {
            console.error(`[Data Validation] Invalid structure for ${type}: missing ${dataKey} object`);
            return false;
        }
        return true;
    }

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
 * Fetch with retry and exponential backoff
 * @param {string} url - URL to fetch
 * @param {number} maxRetries - Maximum retry attempts (default 4)
 * @param {number} initialDelay - Initial delay in milliseconds (default 2000)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, maxRetries = 4, initialDelay = 2000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Fetch] Attempting ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);
            const response = await fetchWithTimeout(url);

            if (response.ok) {
                console.log(`[Fetch] ✓ Success: ${url}`);
                return response;
            }

            // HTTP error
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            console.warn(`[Fetch] ✗ ${url}: ${lastError.message}`);
        } catch (error) {
            lastError = error;
            console.warn(`[Fetch] ✗ ${url}: ${error.message}`);
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
            const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
            console.log(`[Fetch] Retrying ${url} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Load all game data from JSON files
 */
async function loadAllData() {
    showLoading();

    try {
        const responses = await Promise.all([
            fetchWithRetry('../data/items.json'),
            fetchWithRetry('../data/weapons.json'),
            fetchWithRetry('../data/tomes.json'),
            fetchWithRetry('../data/characters.json'),
            fetchWithRetry('../data/shrines.json'),
            fetchWithRetry('../data/stats.json'),
            fetchWithRetry('../data/changelog.json'),
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

        // Run comprehensive validation if available
        if (typeof validateAllData === 'function') {
            const validationResult = validateAllData(allData);
            if (typeof logValidationResults === 'function') {
                logValidationResults(validationResult);
            }

            // Show warning if validation fails critically
            if (!validationResult.valid && validationResult.errors.length > 10) {
                console.error('[Data Service] ⚠ Multiple validation errors detected. Data may be inconsistent.');
            }
        }

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
