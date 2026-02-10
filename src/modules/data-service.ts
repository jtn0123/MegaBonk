// ========================================
// MegaBonk Data Service Module
// ========================================

import { ToastManager } from './toast.ts';
import { validateAllData, logValidationResults, validateWithZod } from './data-validation.ts';
import { logger } from './logger.ts';
import { getSavedTab } from './events.ts';
import { getState, setState } from './store.ts';
import { recordDataSync } from './offline-ui.ts';
import type { AllGameData, Entity, EntityType, ChangelogData, ChangelogPatch, ShrinesData, Stats, ItemsData, WeaponsData, TomesData, CharactersData } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Data type union including changelog
 */
type DataType = EntityType | 'stats' | 'changelog';

/**
 * Enhanced error with fetch metadata for retry logic
 */
interface FetchError extends Error {
    type?: 'timeout' | 'network' | 'cors' | 'parse' | 'http' | 'unknown';
    retriable?: boolean;
}

// ========================================
// UI Helper Functions
// ========================================

function showLoading(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showErrorMessage(message: string): void {
    ToastManager.error(message);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        // Use textContent to prevent XSS - error messages should be displayed as plain text
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        mainContent.innerHTML = '';
        mainContent.appendChild(errorDiv);
    }
}

function safeGetElementById(id: string): HTMLElement | null {
    return document.getElementById(id);
}

// Global data storage - uses centralized store as single source of truth
// Export getter for backwards compatibility with modules that import allData
function getCurrentData(): AllGameData {
    return getState('allData');
}

// ========================================
// Data Validation
// ========================================

/**
 * Validate data structure
 */
function validateData(data: unknown, type: DataType): boolean {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Skip Zod validation for changelog (schema not yet implemented)
    if (type === 'changelog') {
        const changelogData = data as ChangelogData;
        if (!changelogData.patches || !Array.isArray(changelogData.patches)) {
            return false;
        }
        return true;
    }

    // Use Zod validation for typed data (items, weapons, tomes, characters, shrines, stats)
    // Validation errors are logged by the validation module itself
    // Return the actual validation result to properly reject corrupt data
    const result = validateWithZod(data, type);
    return result.valid;
}

// ========================================
// Data Loading
// ========================================

/**
 * Result of loading data (for testing)
 */
export interface LoadDataResult {
    success: boolean;
    data?: AllGameData;
    error?: Error;
}

/**
 * Pure function to load data from URLs (testable)
 * This is a simplified version without retry logic for unit testing
 * @param urls - Object with URLs for each data type
 * @returns Promise with load result
 */
export async function loadDataFromUrls(urls: {
    items: string;
    weapons: string;
    tomes: string;
    characters: string;
    shrines: string;
    stats: string;
}): Promise<LoadDataResult> {
    try {
        const [itemsRes, weaponsRes, tomesRes, charsRes, shrinesRes, statsRes] = await Promise.all([
            fetch(urls.items),
            fetch(urls.weapons),
            fetch(urls.tomes),
            fetch(urls.characters),
            fetch(urls.shrines),
            fetch(urls.stats),
        ]);

        // Bug fix: Check response.ok before parsing JSON to catch HTTP errors
        const responses = [
            { res: itemsRes, name: 'items', url: urls.items },
            { res: weaponsRes, name: 'weapons', url: urls.weapons },
            { res: tomesRes, name: 'tomes', url: urls.tomes },
            { res: charsRes, name: 'characters', url: urls.characters },
            { res: shrinesRes, name: 'shrines', url: urls.shrines },
            { res: statsRes, name: 'stats', url: urls.stats },
        ];

        for (const { res, name, url } of responses) {
            if (!res.ok) {
                throw new Error(`Failed to load ${name} from ${url}: HTTP ${res.status} ${res.statusText}`);
            }
        }

        // Parse JSON only after verifying all responses are OK
        const [items, weapons, tomes, characters, shrines, stats] = await Promise.all([
            itemsRes.json(),
            weaponsRes.json(),
            tomesRes.json(),
            charsRes.json(),
            shrinesRes.json(),
            statsRes.json(),
        ]);

        const data: AllGameData = {
            items,
            weapons,
            tomes,
            characters,
            shrines,
            stats,
            changelog: undefined,
        };

        return { success: true, data };
    } catch (error) {
        return { success: false, error: error as Error };
    }
}

/**
 * Categorize fetch errors for better error handling
 */
function categorizeFetchError(error: Error, url: string): { type: string; retriable: boolean; message: string } {
    const errorMessage = error.message.toLowerCase();

    if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
        return { type: 'timeout', retriable: true, message: `Request timed out: ${url}` };
    }

    if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
        return { type: 'network', retriable: true, message: `Network error: ${url}` };
    }

    if (errorMessage.includes('cors')) {
        return { type: 'cors', retriable: false, message: `CORS error: ${url}` };
    }

    if (errorMessage.includes('json')) {
        return { type: 'parse', retriable: false, message: `JSON parse error: ${url}` };
    }

    return { type: 'unknown', retriable: true, message: error.message };
}

/**
 * Fetch with timeout to prevent indefinite waiting
 */
async function fetchWithTimeout(url: string, timeout: number = 30000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        const categorized = categorizeFetchError(error as Error, url);
        const enhancedError = new Error(categorized.message) as FetchError;
        enhancedError.type = categorized.type as FetchError['type'];
        enhancedError.retriable = categorized.retriable;
        throw enhancedError;
    }
}

/**
 * Fetch with retry and exponential backoff
 * Only retries on retriable errors (network, timeout)
 */
async function fetchWithRetry(url: string, maxRetries: number = 4, initialDelay: number = 2000): Promise<Response> {
    let lastError: FetchError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url);

            if (response.ok) {
                return response;
            }

            // HTTP error - categorize by status code
            const status = response.status;
            const retriable = status >= 500 || status === 429; // Server errors and rate limiting are retriable
            lastError = new Error(`HTTP ${status}: ${response.statusText}`) as FetchError;
            lastError.type = 'http';
            lastError.retriable = retriable;

            // Don't retry non-retriable HTTP errors (4xx except 429)
            if (!retriable) {
                break;
            }
        } catch (error) {
            lastError = error as FetchError;

            // Don't retry non-retriable errors
            if (lastError.retriable === false) {
                break;
            }
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
            const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
            logger.debug({
                operation: 'data.fetch_retry',
                data: {
                    url,
                    attempt: attempt + 1,
                    maxRetries,
                    delayMs: delay,
                    errorType: lastError?.type,
                },
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Fetch and parse a single JSON data file with validation
 */
async function fetchAndValidate(url: string, type: DataType): Promise<unknown> {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${response.url}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!validateData(data, type)) {
        throw new Error(`Data validation failed for ${type}. Data may be corrupted.`);
    }
    return data;
}

/**
 * Load deferred (non-essential) data in the background.
 * Merges into the existing store without blocking the UI.
 */
async function loadDeferredData(): Promise<void> {
    try {
        const [shrines, stats, changelog] = await Promise.all([
            fetchAndValidate('./data/shrines.json', 'shrines'),
            fetchAndValidate('./data/stats.json', 'stats'),
            fetchAndValidate('./data/changelog.json', 'changelog'),
        ]) as [ShrinesData, Stats, ChangelogData];

        const current = getState('allData') as AllGameData;
        setState('allData', { ...current, shrines, stats, changelog });

        logger.debug({
            operation: 'data.deferred_load',
            data: { filesLoaded: ['shrines', 'stats', 'changelog'] },
        });
    } catch (error) {
        const err = error as Error;
        logger.warn({
            operation: 'data.deferred_load',
            error: { name: err.name, message: err.message, module: 'data-service' },
        });
    }
}

/**
 * Load all game data from JSON files.
 * Essential data (items, weapons, tomes, characters) loads first;
 * secondary data (shrines, stats, changelog) is deferred.
 */
export async function loadAllData(): Promise<void> {
    showLoading();
    const loadStartTime = performance.now();

    try {
        // Phase 1: Load essential data needed for the default tab
        const [items, weapons, tomes, characters] = await Promise.all([
            fetchAndValidate('./data/items.json', 'items'),
            fetchAndValidate('./data/weapons.json', 'weapons'),
            fetchAndValidate('./data/tomes.json', 'tomes'),
            fetchAndValidate('./data/characters.json', 'characters'),
        ]) as [ItemsData, WeaponsData, TomesData, CharactersData];

        // Update store with essential data (deferred fields will be merged later)
        const newData: AllGameData = { items, weapons, tomes, characters };
        setState('allData', newData);

        // Invalidate build stats cache when data changes
        // Using dynamic import to avoid blocking and circular dependency
        import('./build-planner.ts')
            .then(({ invalidateBuildStatsCache }) => invalidateBuildStatsCache())
            .catch(error => {
                // Log the error for debugging - build planner might not be loaded yet
                logger.debug({
                    operation: 'data.cache_invalidation',
                    data: {
                        module: 'build-planner',
                        reason: 'module_not_loaded',
                        error: (error as Error).message,
                    },
                });
            });

        // Run comprehensive validation
        const validationResult = validateAllData(newData);
        logValidationResults(validationResult);

        // Log data load wide event
        const loadDuration = Math.round(performance.now() - loadStartTime);
        logger.info({
            operation: 'data.load',
            durationMs: loadDuration,
            success: true,
            data: {
                filesLoaded: ['items', 'weapons', 'tomes', 'characters'],
                deferredFiles: ['shrines', 'stats', 'changelog'],
                itemCounts: {
                    items: items?.items?.length || 0,
                    weapons: weapons?.weapons?.length || 0,
                    tomes: tomes?.tomes?.length || 0,
                    characters: characters?.characters?.length || 0,
                },
                validationResults: {
                    valid: validationResult.valid,
                    errorCount: validationResult.errors.length,
                    warningCount: validationResult.warnings.length,
                },
                version: items?.version || 'unknown',
            },
        });

        // Show warning if validation fails critically
        if (!validationResult.valid && validationResult.errors.length > 10) {
            ToastManager.warning('Some game data may be incomplete. Check console for details.');
        }

        // Update version info
        const versionEl = safeGetElementById('version');
        const updatedEl = safeGetElementById('last-updated');
        if (versionEl) versionEl.textContent = `Version: ${items?.version || 'Unknown'}`;
        if (updatedEl) updatedEl.textContent = `Last Updated: ${items?.last_updated || 'Unknown'}`;

        hideLoading();

        // Record successful data sync for offline indicator
        recordDataSync();

        // Initialize UI - restore saved tab or default to 'items'
        // Note: switchTab is a global function from script.js
        const windowWithSwitchTab = window as Window & { switchTab?: (tab: string) => void };
        if (typeof windowWithSwitchTab.switchTab === 'function') {
            windowWithSwitchTab.switchTab(getSavedTab());
        }

        // Load build from URL if present
        // Note: loadBuildFromURL is a global function from build-planner.js
        const windowWithLoadBuild = window as Window & { loadBuildFromURL?: () => void };
        if (typeof windowWithLoadBuild.loadBuildFromURL === 'function') {
            windowWithLoadBuild.loadBuildFromURL();
            window.addEventListener('hashchange', () => windowWithLoadBuild.loadBuildFromURL!());
        }

        // Initialize advisor with loaded data
        // Note: initAdvisor is a global function from advisor.ts
        const windowWithAdvisor = window as Window & { initAdvisor?: (data: AllGameData) => void };
        if (typeof windowWithAdvisor.initAdvisor === 'function') {
            windowWithAdvisor.initAdvisor(newData);
        }

        // Initialize scan build module
        // Note: initScanBuild is a global function from scan-build.ts
        const windowWithScanBuild = window as Window & { initScanBuild?: (data: AllGameData) => void };
        if (typeof windowWithScanBuild.initScanBuild === 'function') {
            windowWithScanBuild.initScanBuild(newData);
        }

        // Phase 2: Load deferred data (shrines, stats, changelog) in background
        loadDeferredData();
    } catch (error) {
        const loadDuration = Math.round(performance.now() - loadStartTime);
        const err = error as Error;

        logger.error({
            operation: 'data.load',
            durationMs: loadDuration,
            success: false,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
                module: 'data-service',
                retriable: true, // Network errors are often transient
            },
        });

        hideLoading();
        showErrorMessage(`Could not load game data. ${err.message || 'Please check your connection and try again.'}`);
    }
}

/**
 * Get data array for a specific tab
 */
export function getDataForTab(tabName: string): Entity[] | ChangelogPatch[] {
    return getDataForTabFromData(getCurrentData(), tabName);
}

/**
 * Pure function to get data array for a specific tab (testable)
 * @param data - All game data object
 * @param tabName - Tab name to get data for
 * @returns Array of entities for the tab
 */
export function getDataForTabFromData(data: AllGameData, tabName: string): Entity[] | ChangelogPatch[] {
    switch (tabName) {
        case 'items':
            return data.items?.items || [];
        case 'weapons':
            return data.weapons?.weapons || [];
        case 'tomes':
            return data.tomes?.tomes || [];
        case 'characters':
            return data.characters?.characters || [];
        case 'shrines':
            return data.shrines?.shrines || [];
        case 'changelog':
            return data.changelog?.patches || [];
        default:
            return [];
    }
}

/**
 * Get all data object
 */
export function getAllData(): AllGameData {
    return getState('allData');
}

// Export allData getter for backwards compatibility
// Uses Object.defineProperty to create a getter that always returns current store value
export const allData: AllGameData = new Proxy({} as AllGameData, {
    get(_target, prop) {
        return getCurrentData()[prop as keyof AllGameData];
    },
    set() {
        throw new Error('allData is read-only. Use setState("allData", data) to update.');
    },
});
