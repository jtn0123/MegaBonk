// ========================================
// MegaBonk Favorites Module
// ========================================

import type { EntityType } from '../types/index.ts';
import { getState, setState, type FavoritesState } from './store.ts';
import { ToastManager } from './toast.ts';

// Re-export type for backwards compatibility
export type { FavoritesState } from './store.ts';

// Note: Global declarations (ToastManager) are in types/index.ts

// ========================================
// Constants
// ========================================

const FAVORITES_KEY = 'megabonk_favorites';

// Track localStorage availability to prevent repeated failed operations
let localStorageAvailable: boolean | null = null;

// ========================================
// State
// ========================================

// Favorites state - uses centralized store
// No local copy - always read from store for proper test isolation

// ========================================
// Helper Functions
// ========================================

/**
 * Check if localStorage is available
 * Uses a test write/read/delete cycle to verify functionality
 * Caches result to avoid repeated checks
 */
function isLocalStorageAvailable(): boolean {
    if (localStorageAvailable !== null) {
        return localStorageAvailable;
    }

    try {
        const testKey = '__megabonk_storage_test__';
        localStorage.setItem(testKey, 'test');
        const result = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        localStorageAvailable = result === 'test';
        return localStorageAvailable;
    } catch {
        localStorageAvailable = false;
        return false;
    }
}

// ========================================
// Exported Functions
// ========================================

/**
 * Load favorites from localStorage
 * @returns True if favorites were loaded successfully (including when no favorites are stored),
 *          false if localStorage is unavailable
 */
export function loadFavorites(): boolean {
    // First check if localStorage is available
    if (!isLocalStorageAvailable()) {
        console.debug('[favorites] localStorage unavailable - favorites will not persist');
        try {
            ToastManager.warning('Favorites will not be saved in this browser mode.');
        } catch {
            // ToastManager not initialized yet, fail silently
        }
        return false;
    }

    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate structure before setting state
            if (typeof parsed === 'object' && parsed !== null) {
                // Migrate data if needed
                const FAVORITES_VERSION = 1;
                if (!parsed._version || parsed._version < FAVORITES_VERSION) {
                    // Ensure all expected keys exist with defaults
                    if (!Array.isArray(parsed.items)) parsed.items = [];
                    if (!Array.isArray(parsed.weapons)) parsed.weapons = [];
                    if (!Array.isArray(parsed.tomes)) parsed.tomes = [];
                    if (!Array.isArray(parsed.characters)) parsed.characters = [];
                    if (!Array.isArray(parsed.shrines)) parsed.shrines = [];
                    parsed._version = FAVORITES_VERSION;
                    // Persist migrated data
                    try {
                        localStorage.setItem(FAVORITES_KEY, JSON.stringify(parsed));
                    } catch {
                        // Best effort migration persist
                    }
                }
                setState('favorites', parsed as FavoritesState);
                return true;
            }
        }
        // No favorites stored, but localStorage is available - this is success
        return true;
    } catch (error) {
        // Parse error or other issue
        console.debug('[favorites] Failed to parse stored favorites:', (error as Error).message);
        try {
            ToastManager.warning('Could not load saved favorites. Using fresh list.');
        } catch {
            // ToastManager not initialized yet, fail silently
        }
        return false;
    }
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(): void {
    // Skip if localStorage is known to be unavailable
    if (!isLocalStorageAvailable()) {
        return;
    }

    try {
        const favorites = getState('favorites');
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
        const err = error as Error;
        // Distinguish between different localStorage errors for better user feedback
        try {
            if (err.name === 'QuotaExceededError') {
                // Storage is full - suggest clearing cache
                console.debug('[favorites] localStorage quota exceeded:', err.message);
                ToastManager.error('Storage full. Try clearing browser cache to save favorites.');
            } else if (err.name === 'SecurityError') {
                // Private browsing or cookies disabled
                console.debug('[favorites] localStorage blocked (private browsing?):', err.message);
                ToastManager.warning('Favorites disabled in private browsing mode');
            } else {
                // Other errors (general unavailability)
                console.debug('[favorites] localStorage unavailable:', err.message);
                ToastManager.error('Failed to save favorite');
            }
        } catch {
            // ToastManager not initialized yet, fail silently
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
    try {
        ToastManager.success('All favorites cleared');
    } catch {
        // ToastManager not initialized yet, fail silently
    }
}
