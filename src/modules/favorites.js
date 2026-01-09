// ========================================
// MegaBonk Favorites Module
// ========================================

const FAVORITES_KEY = 'megabonk_favorites';

// Favorites state - maps tab name to array of item IDs
let favorites = {
    items: [],
    weapons: [],
    tomes: [],
    characters: [],
    shrines: [],
};

/**
 * Load favorites from localStorage
 */
function loadFavorites() {
    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
            favorites = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

/**
 * Save favorites to localStorage
 */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
        console.error('Failed to save favorites:', error);
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Failed to save favorite');
        }
    }
}

/**
 * Check if an item is favorited
 * @param {string} tabName - Tab name (items, weapons, etc.)
 * @param {string} itemId - Item ID
 * @returns {boolean} True if favorited
 */
function isFavorite(tabName, itemId) {
    return favorites[tabName]?.includes(itemId) || false;
}

/**
 * Toggle favorite status for an item
 * @param {string} tabName - Tab name
 * @param {string} itemId - Item ID
 * @returns {boolean} New favorite status
 */
function toggleFavorite(tabName, itemId) {
    if (!favorites[tabName]) {
        favorites[tabName] = [];
    }

    const index = favorites[tabName].indexOf(itemId);
    if (index > -1) {
        // Remove from favorites
        favorites[tabName].splice(index, 1);
        saveFavorites();
        return false;
    } else {
        // Add to favorites
        favorites[tabName].push(itemId);
        saveFavorites();
        return true;
    }
}

/**
 * Get all favorites for a tab
 * @param {string} tabName - Tab name
 * @returns {Array} Array of favorited item IDs
 */
function getFavorites(tabName) {
    return favorites[tabName] || [];
}

/**
 * Clear all favorites
 */
function clearAllFavorites() {
    favorites = {
        items: [],
        weapons: [],
        tomes: [],
        characters: [],
        shrines: [],
    };
    saveFavorites();
    if (typeof ToastManager !== 'undefined') {
        ToastManager.success('All favorites cleared');
    }
}

// ========================================
// Expose to global scope
// ========================================

window.loadFavorites = loadFavorites;
window.isFavorite = isFavorite;
window.toggleFavorite = toggleFavorite;
window.getFavorites = getFavorites;
window.clearAllFavorites = clearAllFavorites;
