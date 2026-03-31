// ========================================
// MegaBonk Favorites Module
// ========================================

import type { EntityType } from '../types/index.ts';
import { getState, setState, type FavoritesState } from './store.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';

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
/**
 * Safely show a toast warning, handling case where ToastManager isn't initialized
 */
function safeWarning(message: string): void {
    try {
        ToastManager.warning(message);
    } catch {
        // ToastManager not initialized yet, fail silently
    }
}

const FAVORITES_VERSION = 1;

/**
 * Migrate favorites data to current schema version
 */
function migrateFavoritesData(parsed: Record<string, unknown>): void {
    if (parsed._version && (parsed._version as number) >= FAVORITES_VERSION) return;

    const arrayKeys = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    for (const key of arrayKeys) {
        if (!Array.isArray(parsed[key])) parsed[key] = [];
    }
    parsed._version = FAVORITES_VERSION;

    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(parsed));
    } catch {
        // Best effort migration persist
    }
}

/**
 * Parse and apply stored favorites data
 */
function applyStoredFavorites(stored: string): boolean {
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return false;

    migrateFavoritesData(parsed as Record<string, unknown>);
    setState('favorites', parsed as FavoritesState);
    return true;
}

export function loadFavorites(): boolean {
    if (!isLocalStorageAvailable()) {
        logger.debug({
            operation: 'favorites.storage_unavailable',
            data: { reason: 'localStorage unavailable - favorites will not persist' },
        });
        safeWarning('Favorites will not be saved in this browser mode.');
        return false;
    }

    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) return applyStoredFavorites(stored);
        return true;
    } catch (error) {
        logger.debug({ operation: 'favorites.parse_failed', data: { error: (error as Error).message } });
        safeWarning('Could not load saved favorites. Using fresh list.');
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
                logger.debug({ operation: 'favorites.quota_exceeded', data: { error: err.message } });
                ToastManager.error('Storage full. Try clearing browser cache to save favorites.');
            } else if (err.name === 'SecurityError') {
                // Private browsing or cookies disabled
                logger.debug({
                    operation: 'favorites.storage_blocked',
                    data: { error: err.message, reason: 'private browsing' },
                });
                ToastManager.warning('Favorites disabled in private browsing mode');
            } else {
                // Other errors (general unavailability)
                logger.debug({ operation: 'favorites.storage_error', data: { error: err.message } });
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
    if (newFavorites[tabName]) {
        newFavorites[tabName] = [...newFavorites[tabName]];
    } else {
        newFavorites[tabName] = [];
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
