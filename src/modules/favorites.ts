// ========================================
// MegaBonk Favorites Module
// ========================================

import type { EntityType } from '../types/index.js';

// ========================================
// Type Definitions
// ========================================

/**
 * Favorites state structure
 */
interface FavoritesState {
    items: string[];
    weapons: string[];
    tomes: string[];
    characters: string[];
    shrines: string[];
}

// Note: Global declarations (ToastManager) are in types/index.ts

// ========================================
// Constants
// ========================================

const FAVORITES_KEY = 'megabonk_favorites';

// ========================================
// State
// ========================================

// Favorites state - maps tab name to array of item IDs
let favorites: FavoritesState = {
    items: [],
    weapons: [],
    tomes: [],
    characters: [],
    shrines: [],
};

// ========================================
// Exported Functions
// ========================================

/**
 * Load favorites from localStorage
 */
export function loadFavorites(): void {
    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
            favorites = JSON.parse(stored) as FavoritesState;
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(): void {
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
 * @param tabName - Tab name (items, weapons, etc.)
 * @param itemId - Item ID
 * @returns True if favorited
 */
export function isFavorite(tabName: EntityType, itemId: string): boolean {
    return favorites[tabName]?.includes(itemId) || false;
}

/**
 * Toggle favorite status for an item
 * @param tabName - Tab name
 * @param itemId - Item ID
 * @returns New favorite status
 */
export function toggleFavorite(tabName: EntityType, itemId: string): boolean {
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
 * @param tabName - Tab name
 * @returns Array of favorited item IDs
 */
export function getFavorites(tabName: EntityType): string[] {
    return favorites[tabName] || [];
}

/**
 * Clear all favorites
 */
export function clearAllFavorites(): void {
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
