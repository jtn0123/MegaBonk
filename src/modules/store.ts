// ========================================
// MegaBonk Centralized State Store
// Simple pub/sub store for shared application state
// ========================================

import type { AllGameData, Entity, Build, FavoritesState } from '../types/index.ts';
import { logger } from './logger.ts';

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
    | 'changelog'
    | 'about';

// Re-export types for backwards compatibility
export type { Build, FavoritesState } from '../types/index.ts';

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
const deepCloneInitialState = (): AppState => structuredClone(initialState);

// Subscribers map: key -> Set of callbacks
// Internal storage uses (value: unknown) => void since we store mixed callback types
// Type safety is enforced at the subscribe() API boundary
type InternalSubscriber = (value: unknown) => void;
const subscribers = new Map<keyof AppState, Set<InternalSubscriber>>();

/**
 * Window sync enabled flag - enabled by default for backwards compatibility.
 * Legacy code may access window.allData, window.currentTab, etc.
 * Performance impact is minimal (just object assignment on state change).
 * Can be disabled with disableWindowSync() if not needed.
 */
let windowSyncEnabled = true;

/**
 * Sync a state key to the window object for backwards compatibility
 * This helper avoids 'as any' casts by using explicit property assignments
 */
function syncStateKeyToWindow<K extends keyof AppState>(key: K, value: AppState[K] | undefined): void {
    switch (key) {
        case 'currentTab':
            window.currentTab = value as string;
            break;
        case 'filteredData':
            window.filteredData = value as Entity[];
            break;
        case 'allData':
            window.allData = value as AllGameData;
            break;
        case 'currentBuild':
            window.currentBuild = value as Build;
            break;
        case 'compareItems':
            window.compareItems = value as string[];
            break;
        case 'favorites':
            window.favorites = value as FavoritesState;
            break;
    }
}

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
export function setState<K extends keyof AppState>(key: K, value: AppState[K] | ((prev: AppState[K]) => AppState[K])): void {
    const resolvedValue = typeof value === 'function' ? (value as (prev: AppState[K]) => AppState[K])(state[key]) : value;
    state[key] = resolvedValue;

    // Sync to window for backwards compatibility
    if (windowSyncEnabled && typeof window !== 'undefined') {
        syncStateKeyToWindow(key, resolvedValue);
    }

    // Notify subscribers asynchronously via microtask to batch updates
    // and prevent mutations during callbacks from affecting other subscribers
    const keySubscribers = subscribers.get(key);
    if (keySubscribers && keySubscribers.size > 0) {
        const snapshot = resolvedValue;
        const callbacks = [...keySubscribers];
        queueMicrotask(() => {
            callbacks.forEach(callback => {
                try {
                    callback(snapshot);
                } catch (error) {
                    const err = error as Error;
                    logger.error({
                        operation: 'store.subscriber_error',
                        error: { name: err.name, message: err.message },
                        data: { key },
                    });
                }
            });
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
    // Cast to InternalSubscriber for storage - type safety maintained at API boundary
    const internalCallback = callback as InternalSubscriber;
    keySubscribers.add(internalCallback);

    // Return unsubscribe function
    return () => {
        keySubscribers.delete(internalCallback);
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
        window.currentTab = state.currentTab;
        window.filteredData = state.filteredData;
        window.allData = state.allData;
        window.currentBuild = state.currentBuild;
        window.compareItems = state.compareItems;
        window.favorites = state.favorites;
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
        window.currentTab = state.currentTab;
        window.filteredData = state.filteredData;
        window.allData = state.allData;
        window.currentBuild = state.currentBuild;
        window.compareItems = state.compareItems;
        window.favorites = state.favorites;
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
 * Type-safe state key assignment helper
 * Uses switch statement to provide proper type narrowing for each key
 */
function assignStateKey<K extends keyof AppState>(key: K, value: AppState[K]): void {
    switch (key) {
        case 'currentTab':
            state.currentTab = value as TabName;
            break;
        case 'filteredData':
            state.filteredData = value as Entity[];
            break;
        case 'allData':
            state.allData = value as AllGameData;
            break;
        case 'currentBuild':
            state.currentBuild = value as Build;
            break;
        case 'compareItems':
            state.compareItems = value as string[];
            break;
        case 'favorites':
            state.favorites = value as FavoritesState;
            break;
    }
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
        const value = updates[key];
        if (value !== undefined) {
            assignStateKey(key, value as AppState[typeof key]);
            changedKeys.add(key);

            // Sync to window
            if (windowSyncEnabled && typeof window !== 'undefined') {
                syncStateKeyToWindow(key, value as AppState[typeof key]);
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
                    const err = error as Error;
                    logger.error({
                        operation: 'store.subscriber_error',
                        error: { name: err.name, message: err.message },
                        data: { key },
                    });
                }
            });
        }
    });
}

// ========================================
// Window sync is disabled by default for performance
// ========================================
// Call enableWindowSync() explicitly if backwards compatibility with
// window.allData, window.currentTab, etc. is needed.
// All new code should use getState() and setState() instead.
