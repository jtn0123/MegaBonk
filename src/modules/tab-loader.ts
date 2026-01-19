// ========================================
// MegaBonk Tab Loader Module
// ========================================
// Handles lazy loading of tab-specific modules for code splitting
// This reduces initial bundle size by deferring heavy modules

import { logger } from './logger.ts';
import type { TabName } from './store.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Module cache entry
 */
interface ModuleCache {
    loaded: boolean;
    loading: Promise<void> | null;
    error: Error | null;
}

/**
 * Tab module loaders map
 */
type TabModuleLoader = () => Promise<void>;

// ========================================
// Module Cache
// ========================================

// Cache to track loaded modules and prevent duplicate imports
const moduleCache: Map<string, ModuleCache> = new Map();

// ========================================
// Tab-Specific Module Loaders
// ========================================

/**
 * Lazy load the build planner module
 */
async function loadBuildPlannerModule(): Promise<void> {
    await import('./build-planner.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'build-planner' },
    });
}

/**
 * Lazy load the calculator module
 */
async function loadCalculatorModule(): Promise<void> {
    await import('./calculator.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'calculator' },
    });
}

/**
 * Lazy load the advisor module and its dependencies
 */
async function loadAdvisorModule(): Promise<void> {
    // Load scan-build first as advisor may depend on it
    await import('./scan-build.ts');
    await import('./advisor.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'advisor' },
    });
}

/**
 * Lazy load the changelog module
 */
async function loadChangelogModule(): Promise<void> {
    await import('./changelog.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'changelog' },
    });
}

/**
 * Lazy load the compare module
 */
async function loadCompareModule(): Promise<void> {
    await import('./compare.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'compare' },
    });
}

/**
 * Lazy load the charts module
 */
async function loadChartsModule(): Promise<void> {
    await import('./charts.ts');
    logger.debug({
        operation: 'tab_loader.loaded',
        data: { module: 'charts' },
    });
}

// ========================================
// Tab to Module Mapping
// ========================================

/**
 * Map of tabs to their required module loaders
 * Tabs not in this map use only core modules (already loaded)
 */
const TAB_MODULES: Partial<Record<TabName, TabModuleLoader[]>> = {
    'build-planner': [loadBuildPlannerModule],
    calculator: [loadCalculatorModule],
    advisor: [loadAdvisorModule],
    changelog: [loadChangelogModule],
    // Items and tomes need charts for scaling graphs
    items: [loadChartsModule, loadCompareModule],
    tomes: [loadChartsModule],
};

// ========================================
// Core API
// ========================================

/**
 * Load modules required for a specific tab
 * Uses caching to prevent duplicate loads
 * @param tabName - The tab to load modules for
 * @returns Promise that resolves when all modules are loaded
 */
export async function loadTabModules(tabName: TabName): Promise<void> {
    const loaders = TAB_MODULES[tabName];

    // No special modules needed for this tab
    if (!loaders || loaders.length === 0) {
        return;
    }

    const startTime = performance.now();

    // Load all required modules in parallel
    const loadPromises = loaders.map(loader => loadModuleWithCache(loader));

    try {
        await Promise.all(loadPromises);

        const duration = Math.round(performance.now() - startTime);
        if (duration > 50) {
            logger.debug({
                operation: 'tab_loader.complete',
                durationMs: duration,
                data: { tabName, moduleCount: loaders.length },
            });
        }
    } catch (error) {
        logger.error({
            operation: 'tab_loader.error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'tab-loader',
            },
            data: { tabName },
        });
        throw error;
    }
}

/**
 * Load a module with caching
 * Prevents duplicate loads and handles concurrent requests
 * @param loader - The module loader function
 * @returns Promise that resolves when module is loaded
 */
async function loadModuleWithCache(loader: TabModuleLoader): Promise<void> {
    const key = loader.name || loader.toString().slice(0, 50);

    // Check if already loaded
    const cached = moduleCache.get(key);
    if (cached?.loaded) {
        return;
    }

    // Check if currently loading (handle concurrent requests)
    if (cached?.loading) {
        return cached.loading;
    }

    // Start loading
    const loadingPromise = loader();
    moduleCache.set(key, {
        loaded: false,
        loading: loadingPromise,
        error: null,
    });

    try {
        await loadingPromise;
        moduleCache.set(key, {
            loaded: true,
            loading: null,
            error: null,
        });
    } catch (error) {
        moduleCache.set(key, {
            loaded: false,
            loading: null,
            error: error as Error,
        });
        throw error;
    }
}

/**
 * Preload modules for likely-to-be-visited tabs
 * Call this after initial render to warm the cache
 */
export function preloadCommonModules(): void {
    // Use requestIdleCallback if available, otherwise setTimeout
    const schedulePreload =
        typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 1000);

    schedulePreload(() => {
        // Preload compare module (often used from items tab)
        loadModuleWithCache(loadCompareModule).catch(() => {
            // Silently ignore preload failures
        });
    });
}

/**
 * Check if a module is already loaded
 * @param moduleName - Name of the module to check
 * @returns True if module is loaded
 */
export function isModuleLoaded(moduleName: string): boolean {
    const cached = moduleCache.get(moduleName);
    return cached?.loaded ?? false;
}

/**
 * Clear the module cache (useful for testing)
 */
export function clearModuleCache(): void {
    moduleCache.clear();
}

/**
 * Get the list of modules required for a tab
 * @param tabName - The tab name
 * @returns Array of module names (for debugging)
 */
export function getTabModules(tabName: TabName): string[] {
    const loaders = TAB_MODULES[tabName];
    if (!loaders) return [];
    return loaders.map(l => l.name || 'anonymous');
}
