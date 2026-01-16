// ========================================
// MegaBonk Centralized State Store
// Simple pub/sub store for shared application state
// ========================================

import type { AllGameData, Entity, Character, Weapon, Tome, Item } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Tab name type - includes all tabs (entity tabs + special tabs)
 */
export type TabName =
    | 'items'
    | 'weapons'
    | 'tomes'
    | 'characters'
    | 'shrines'
    | 'build-planner'
    | 'calculator'
    | 'advisor'
    | 'changelog';

/**
 * Favorites state structure - maps entity type to array of item IDs
 */
export interface FavoritesState {
    items: string[];
    weapons: string[];
    tomes: string[];
    characters: string[];
    shrines: string[];
}

/**
 * Build state structure for build planner
 */
export interface Build {
    character: Character | null;
    weapon: Weapon | null;
    tomes: Tome[];
    items: Item[];
    name?: string;
    notes?: string;
}

/**
 * Complete application state interface
 */
export interface AppState {
    currentTab: TabName;
    filteredData: Entity[];
    allData: AllGameData;
    currentBuild: Build;
    compareItems: string[];
    favorites: FavoritesState;
}

/**
 * Subscriber callback type
 */
type Subscriber<K extends keyof AppState> = (value: AppState[K]) => void;

// ========================================
// Initial State
// ========================================

const initialState: AppState = {
    currentTab: 'items',
    filteredData: [],
    allData: {
        items: undefined,
        weapons: undefined,
        tomes: undefined,
        characters: undefined,
        shrines: undefined,
        stats: undefined,
        changelog: undefined,
    },
    currentBuild: {
        character: null,
        weapon: null,
        tomes: [],
        items: [],
        name: '',
        notes: '',
    },
    compareItems: [],
    favorites: {
        items: [],
        weapons: [],
        tomes: [],
        characters: [],
        shrines: [],
    },
};

// ========================================
// Store State
// ========================================

// The actual state object
let state: AppState = { ...initialState };

// Deep clone initial state for reset
const deepCloneInitialState = (): AppState => ({
    currentTab: 'items',
    filteredData: [],
    allData: {
        items: undefined,
        weapons: undefined,
        tomes: undefined,
        characters: undefined,
        shrines: undefined,
        stats: undefined,
        changelog: undefined,
    },
    currentBuild: {
        character: null,
        weapon: null,
        tomes: [],
        items: [],
        name: '',
        notes: '',
    },
    compareItems: [],
    favorites: {
        items: [],
        weapons: [],
        tomes: [],
        characters: [],
        shrines: [],
    },
});

// Subscribers map: key -> Set of callbacks
const subscribers = new Map<keyof AppState, Set<Subscriber<any>>>();

// Window sync enabled flag
let windowSyncEnabled = true;

// ========================================
// Core Store API
// ========================================

/**
 * Get a value from the store
 * @param key - State key to retrieve
 * @returns The state value
 */
export function getState<K extends keyof AppState>(key: K): AppState[K] {
    return state[key];
}

/**
 * Set a value in the store and notify subscribers
 * @param key - State key to set
 * @param value - New value
 */
export function setState<K extends keyof AppState>(key: K, value: AppState[K]): void {
    state[key] = value;

    // Sync to window for backwards compatibility
    if (windowSyncEnabled && typeof window !== 'undefined') {
        (window as any)[key] = value;
    }

    // Notify subscribers
    const keySubscribers = subscribers.get(key);
    if (keySubscribers) {
        keySubscribers.forEach(callback => {
            try {
                callback(value);
            } catch (error) {
                console.error(`Store subscriber error for key "${key}":`, error);
            }
        });
    }
}

/**
 * Subscribe to state changes for a specific key
 * @param key - State key to subscribe to
 * @param callback - Function called when value changes
 * @returns Unsubscribe function
 */
export function subscribe<K extends keyof AppState>(key: K, callback: Subscriber<K>): () => void {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }

    const keySubscribers = subscribers.get(key)!;
    keySubscribers.add(callback);

    // Return unsubscribe function
    return () => {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
            subscribers.delete(key);
        }
    };
}

/**
 * Reset the store to initial state - critical for test isolation
 */
export function resetStore(): void {
    state = deepCloneInitialState();

    // Clear window properties if sync is enabled
    if (windowSyncEnabled && typeof window !== 'undefined') {
        (window as any).currentTab = state.currentTab;
        (window as any).filteredData = state.filteredData;
        (window as any).allData = state.allData;
        (window as any).currentBuild = state.currentBuild;
        (window as any).compareItems = state.compareItems;
        (window as any).favorites = state.favorites;
    }

    // Note: We don't clear subscribers here - use clearSubscribers() for full cleanup
}

/**
 * Clear all subscribers - critical for test isolation to prevent memory leaks
 * Call this in test teardown (afterEach) along with resetStore()
 */
export function clearSubscribers(): void {
    subscribers.clear();
}

/**
 * Enable window property synchronization (for backwards compatibility)
 */
export function enableWindowSync(): void {
    windowSyncEnabled = true;

    // Sync current state to window
    if (typeof window !== 'undefined') {
        (window as any).currentTab = state.currentTab;
        (window as any).filteredData = state.filteredData;
        (window as any).allData = state.allData;
        (window as any).currentBuild = state.currentBuild;
        (window as any).compareItems = state.compareItems;
        (window as any).favorites = state.favorites;
    }
}

/**
 * Disable window property synchronization (useful for tests)
 */
export function disableWindowSync(): void {
    windowSyncEnabled = false;
}

/**
 * Check if window sync is enabled
 */
export function isWindowSyncEnabled(): boolean {
    return windowSyncEnabled;
}

/**
 * Get the entire state object (returns a shallow copy)
 * Useful for debugging or state inspection
 */
export function getFullState(): AppState {
    return { ...state };
}

/**
 * Batch update multiple state values
 * Only notifies subscribers once per key after all updates
 * @param updates - Partial state object with values to update
 */
export function batchUpdate(updates: Partial<AppState>): void {
    const changedKeys = new Set<keyof AppState>();

    // Update all values without notifying
    for (const key of Object.keys(updates) as (keyof AppState)[]) {
        if (updates[key] !== undefined) {
            state[key] = updates[key] as any;
            changedKeys.add(key);

            // Sync to window
            if (windowSyncEnabled && typeof window !== 'undefined') {
                (window as any)[key] = updates[key];
            }
        }
    }

    // Now notify subscribers for changed keys
    changedKeys.forEach(key => {
        const keySubscribers = subscribers.get(key);
        if (keySubscribers) {
            keySubscribers.forEach(callback => {
                try {
                    callback(state[key]);
                } catch (error) {
                    console.error(`Store subscriber error for key "${key}":`, error);
                }
            });
        }
    });
}

// ========================================
// Initialize window sync on load
// ========================================

// Enable window sync by default when module loads in browser
if (typeof window !== 'undefined') {
    enableWindowSync();
}
