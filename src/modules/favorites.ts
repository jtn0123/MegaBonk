// ========================================
// MegaBonk Favorites Module
// ========================================

import type { EntityType } from '../types/index.ts';
import { getState, setState, type FavoritesState } from './store.ts';

// Re-export type for backwards compatibility
export type { FavoritesState } from './store.ts';

// Note: Global declarations (ToastManager) are in types/index.ts

// ========================================
// Constants
// ========================================

const FAVORITES_KEY = 'megabonk_favorites';

// ========================================
// State
// ========================================

// Favorites state - uses centralized store
// No local copy - always read from store for proper test isolation

// ========================================
// Exported Functions
// ========================================

/**
 * Load favorites from localStorage
 * @returns True if favorites were loaded successfully, false otherwise
 */
export function loadFavorites(): boolean {
    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate structure before setting state
            if (typeof parsed === 'object' && parsed !== null) {
                setState('favorites', parsed as FavoritesState);
                return true;
            }
        }
        return true; // No favorites stored is not an error
    } catch (error) {
        // localStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[favorites] localStorage unavailable for loading favorites:', (error as Error).message);
        // Show user feedback for load failures (matching save failure behavior)
        if (typeof ToastManager !== 'undefined') {
            ToastManager.warning('Could not load saved favorites. Using fresh list.');
        }
        return false;
    }
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(): void {
    try {
        const favorites = getState('favorites');
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
        // localStorage may be unavailable in some contexts (private browsing, etc.)
        console.debug('[favorites] localStorage unavailable for saving favorites:', (error as Error).message);
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
    const favs = getState('favorites');
    return favs[tabName]?.includes(itemId) || false;
}

/**
 * Toggle favorite status for an item
 * @param tabName - Tab name
 * @param itemId - Item ID
 * @returns New favorite status
 */
export function toggleFavorite(tabName: EntityType, itemId: string): boolean {
    const favorites = getState('favorites');
    const newFavorites = { ...favorites };
    if (!newFavorites[tabName]) {
        newFavorites[tabName] = [];
    } else {
        newFavorites[tabName] = [...newFavorites[tabName]];
    }

    const index = newFavorites[tabName].indexOf(itemId);
    if (index > -1) {
        // Remove from favorites
        newFavorites[tabName].splice(index, 1);
        setState('favorites', newFavorites);
        saveFavorites();
        return false;
    } else {
        // Add to favorites
        newFavorites[tabName].push(itemId);
        setState('favorites', newFavorites);
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
    const favs = getState('favorites');
    return favs[tabName] || [];
}

/**
 * Clear all favorites
 */
export function clearAllFavorites(): void {
    setState('favorites', {
        items: [],
        weapons: [],
        tomes: [],
        characters: [],
        shrines: [],
    });
    saveFavorites();
    if (typeof ToastManager !== 'undefined') {
        ToastManager.success('All favorites cleared');
    }
}
