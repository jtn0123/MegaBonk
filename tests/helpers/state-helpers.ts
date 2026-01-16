// ========================================
// Test State Helpers
// Utilities for setting up and inspecting state in tests
// ========================================

import { getState, setState, getFullState, resetStore, type AppState } from '../../src/modules/store.ts';

/**
 * Set up test state with partial values
 * Useful for initializing state for a specific test scenario
 * @param state - Partial state object with values to set
 */
export function setupTestState(state: Partial<AppState>): void {
    for (const key of Object.keys(state) as (keyof AppState)[]) {
        if (state[key] !== undefined) {
            setState(key, state[key] as any);
        }
    }
}

/**
 * Get the current test state
 * Returns a copy of the full state for inspection
 * @returns Full application state
 */
export function getTestState(): AppState {
    return getFullState();
}

/**
 * Reset state to initial values
 * Alias for resetStore for clarity in tests
 */
export function resetTestState(): void {
    resetStore();
}

/**
 * Get a specific state value for testing
 * @param key - State key to retrieve
 * @returns The state value
 */
export function getTestStateValue<K extends keyof AppState>(key: K): AppState[K] {
    return getState(key);
}

// Re-export store functions for convenience
export { getState, setState, resetStore, getFullState };
