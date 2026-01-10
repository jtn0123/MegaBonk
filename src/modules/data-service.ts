// ========================================
// MegaBonk Data Service Module
// ========================================

import { ToastManager } from './toast.ts';
import { validateAllData, logValidationResults, validateWithZod } from './data-validation.ts';
import type { AllGameData, Entity, EntityType, ChangelogData, ChangelogPatch } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Data type union including changelog
 */
type DataType = EntityType | 'stats' | 'changelog';

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

// Global data storage
let allData: AllGameData = {
    items: undefined,
    weapons: undefined,
    tomes: undefined,
    characters: undefined,
    shrines: undefined,
    stats: undefined,
    changelog: undefined,
};

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
    validateWithZod(data, type);

    // Return true even if validation fails to allow app to load
    return true;
}

// ========================================
// Data Loading
// ========================================

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
        if ((error as Error).name === 'AbortError') {
            throw new Error(`Request timeout: ${url}`);
        }
        throw error;
    }
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(url: string, maxRetries: number = 4, initialDelay: number = 2000): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url);

            if (response.ok) {
                return response;
            }

            // HTTP error
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
            lastError = error as Error;
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
            const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Load all game data from JSON files
 */
export async function loadAllData(): Promise<void> {
    showLoading();

    try {
        const responses = await Promise.all([
            fetchWithRetry('../data/items.json'),
            fetchWithRetry('../data/weapons.json'),
            fetchWithRetry('../data/tomes.json'),
            fetchWithRetry('../data/characters.json'),
            fetchWithRetry('../data/shrines.json'),
            fetchWithRetry('../data/stats.json'),
            fetchWithRetry('../data/changelog.json'),
        ]);

        // Check for HTTP errors and parse JSON safely
        const [items, weapons, tomes, characters, shrines, stats, changelog] = await Promise.all(
            responses.map(async r => {
                if (!r.ok) {
                    throw new Error(`Failed to load ${r.url}: ${r.status} ${r.statusText}`);
                }
                return r.json();
            })
        );

        // Validate all data
        const dataTypes: Array<{ data: unknown; type: DataType }> = [
            { data: items, type: 'items' },
            { data: weapons, type: 'weapons' },
            { data: tomes, type: 'tomes' },
            { data: characters, type: 'characters' },
            { data: shrines, type: 'shrines' },
            { data: stats, type: 'stats' },
            { data: changelog, type: 'changelog' },
        ];

        for (const { data, type } of dataTypes) {
            if (!validateData(data, type)) {
                throw new Error(`Data validation failed for ${type}. Data may be corrupted.`);
            }
        }

        allData = { items, weapons, tomes, characters, shrines, stats, changelog };

        // Run comprehensive validation
        const validationResult = validateAllData(allData);
        logValidationResults(validationResult);

        // Show warning if validation fails critically
        if (!validationResult.valid && validationResult.errors.length > 10) {
            ToastManager.warning('Some game data may be incomplete. Check console for details.');
        }

        // Update version info
        const versionEl = safeGetElementById('version');
        const updatedEl = safeGetElementById('last-updated');
        if (versionEl) versionEl.textContent = `Version: ${items.version || 'Unknown'}`;
        if (updatedEl) updatedEl.textContent = `Last Updated: ${items.last_updated || 'Unknown'}`;

        hideLoading();

        // Initialize UI
        // Note: switchTab is a global function from script.js
        const windowWithSwitchTab = window as Window & { switchTab?: (tab: string) => void };
        if (typeof windowWithSwitchTab.switchTab === 'function') {
            windowWithSwitchTab.switchTab('items');
        }

        // Load build from URL if present
        // Note: loadBuildFromURL is a global function from build-planner.js
        const windowWithLoadBuild = window as Window & { loadBuildFromURL?: () => void };
        if (typeof windowWithLoadBuild.loadBuildFromURL === 'function') {
            windowWithLoadBuild.loadBuildFromURL();
        }
    } catch (error) {
        hideLoading();
        showErrorMessage(
            `Could not load game data. ${(error as Error).message || 'Please check your connection and try again.'}`
        );
    }
}

/**
 * Get data array for a specific tab
 */
export function getDataForTab(tabName: string): Entity[] | ChangelogPatch[] {
    switch (tabName) {
        case 'items':
            return allData.items?.items || [];
        case 'weapons':
            return allData.weapons?.weapons || [];
        case 'tomes':
            return allData.tomes?.tomes || [];
        case 'characters':
            return allData.characters?.characters || [];
        case 'shrines':
            return allData.shrines?.shrines || [];
        case 'changelog':
            return allData.changelog?.patches || [];
        default:
            return [];
    }
}

/**
 * Get all data object
 */
export function getAllData(): AllGameData {
    return allData;
}

// Export allData object for direct access if needed
export { allData };
