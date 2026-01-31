// ========================================
// MegaBonk Module Registry
// ========================================
// Typed function registry for cross-module communication
// Replaces window globals with a type-safe alternative
// ========================================

import type { AllGameData, Character, Weapon, Item, Tome } from '../types/index.ts';
import type { TabName } from './store.ts';

// Re-export TabName for convenience
export type { TabName };

// ========================================
// Type Definitions
// ========================================

/**
 * Build state for scan-build module
 */
export interface BuildState {
    character: Character | null;
    weapon: Weapon | null;
    items: Item[];
    tomes: Tome[];
}

/**
 * Callback type for build state changes
 */
export type BuildStateCallback = (state: BuildState) => void;

/**
 * Registry of cross-module functions
 * Each function is nullable - null means not yet registered
 */
interface ModuleRegistry {
    // Core navigation
    switchTab: ((tabName: TabName) => void) | null;
    renderTabContent: ((tabName: string) => void) | null;

    // Advisor module
    initAdvisor: ((gameData: AllGameData) => void) | null;
    applyScannedBuild: ((state: BuildState) => void) | null;

    // Scan build module
    initScanBuild: ((gameData: AllGameData, callback?: BuildStateCallback) => void) | null;

    // CV/OCR modules (optional, may not be loaded)
    initCV: ((gameData: AllGameData) => void) | null;
    initOCR: ((gameData: AllGameData) => void) | null;
    initEnhancedCV: (() => Promise<void>) | null;
    detectItemsWithEnhancedCV: ((imageData: ImageData) => Promise<unknown>) | null;
    initEnhancedScanBuild: ((gameData: AllGameData) => void) | null;
    handleEnhancedHybridDetect: (() => Promise<void>) | null;
    compareStrategiesOnImage: ((imageData: ImageData) => Promise<unknown>) | null;
}

// ========================================
// Registry State
// ========================================

/**
 * The module registry instance
 * All functions start as null until registered
 */
const registry: ModuleRegistry = {
    switchTab: null,
    renderTabContent: null,
    initAdvisor: null,
    applyScannedBuild: null,
    initScanBuild: null,
    initCV: null,
    initOCR: null,
    initEnhancedCV: null,
    detectItemsWithEnhancedCV: null,
    initEnhancedScanBuild: null,
    handleEnhancedHybridDetect: null,
    compareStrategiesOnImage: null,
};

// ========================================
// Registry Functions
// ========================================

/**
 * Register a function in the module registry
 * @param name - The function name in the registry
 * @param fn - The function to register
 */
export function registerFunction<K extends keyof ModuleRegistry>(name: K, fn: ModuleRegistry[K]): void {
    registry[name] = fn;
}

/**
 * Get a function from the registry
 * @param name - The function name to retrieve
 * @returns The function or null if not registered
 */
export function getFunction<K extends keyof ModuleRegistry>(name: K): ModuleRegistry[K] {
    return registry[name];
}

/**
 * Call a registered function with arguments
 * Returns undefined if the function is not registered
 * @param name - The function name to call
 * @param args - Arguments to pass to the function
 * @returns The function's return value or undefined
 */
export function callFunction<K extends keyof ModuleRegistry>(
    name: K,
    ...args: ModuleRegistry[K] extends ((...args: infer A) => unknown) | null ? A : never[]
): ModuleRegistry[K] extends ((...args: unknown[]) => infer R) | null ? R | undefined : undefined {
    const fn = registry[name];
    if (fn) {
        type ReturnType = ModuleRegistry[K] extends ((...args: unknown[]) => infer R) | null ? R | undefined : undefined;
        return (fn as (...args: unknown[]) => unknown)(...args) as ReturnType;
    }
    type UndefinedReturn = ModuleRegistry[K] extends ((...args: unknown[]) => infer R) | null ? R | undefined : undefined;
    return undefined as UndefinedReturn;
}

/**
 * Check if a function is registered
 * @param name - The function name to check
 * @returns True if the function is registered
 */
export function isRegistered<K extends keyof ModuleRegistry>(name: K): boolean {
    return registry[name] !== null;
}

/**
 * Unregister a function from the registry
 * Useful for cleanup in tests
 * @param name - The function name to unregister
 */
export function unregisterFunction<K extends keyof ModuleRegistry>(name: K): void {
    registry[name] = null;
}

/**
 * Clear all registered functions
 * Useful for test cleanup
 */
export function clearRegistry(): void {
    const keys = Object.keys(registry) as (keyof ModuleRegistry)[];
    keys.forEach(key => {
        registry[key] = null;
    });
}

/**
 * Get list of registered function names
 * @returns Array of registered function names
 */
export function getRegisteredFunctions(): (keyof ModuleRegistry)[] {
    return (Object.keys(registry) as (keyof ModuleRegistry)[]).filter(key => registry[key] !== null);
}
