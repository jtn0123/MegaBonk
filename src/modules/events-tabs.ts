// ========================================
// Tab Management Module
// Tab switching, loading, and persistence
// ========================================

import { logger } from './logger.ts';
import { saveFilterState, updateFilters, restoreFilterState } from './filters.ts';
import { renderTabContent } from './renderers.ts';
import { getState, setState, type TabName } from './store.ts';
import { registerFunction } from './registry.ts';
import { showTabSkeleton } from './skeleton-loader.ts';
import { loadTabModules, preloadCommonModules } from './tab-loader.ts';

// LocalStorage key for persisting tab selection
const TAB_STORAGE_KEY = 'megabonk-current-tab';

// Valid tab names for validation
export const VALID_TABS: TabName[] = [
    'items',
    'weapons',
    'tomes',
    'characters',
    'shrines',
    'build-planner',
    'calculator',
    'advisor',
    'changelog',
    'about',
];

// Track tab switch timing to prevent rapid switching issues
let lastTabSwitchTime = 0;
const TAB_SWITCH_DEBOUNCE_MS = 100;

// Lock to prevent concurrent tab switches (race condition fix)
let tabSwitchInProgress = false;

// Current tab state - kept for backwards compatibility
export let currentTab: TabName = getState('currentTab');

/**
 * Reset internal timers for testing purposes
 * @internal
 */
export function __resetTimersForTesting(): void {
    lastTabSwitchTime = 0;
    tabSwitchInProgress = false;
}

/**
 * Get the current tab (backwards compatibility)
 */
export function getCurrentTab(): TabName {
    return getState('currentTab');
}

/**
 * Check if tab switch should proceed (validation and debouncing)
 * @returns true if switch should proceed, false otherwise
 */
function shouldProceedWithTabSwitch(tabName: TabName): boolean {
    // Runtime validation
    if (!VALID_TABS.includes(tabName)) {
        logger.warn({
            operation: 'tab.switch',
            error: { name: 'InvalidTabError', message: `Invalid tab name: ${tabName}` },
        });
        return false;
    }

    // Debounce rapid switches
    const now = Date.now();
    if (now - lastTabSwitchTime < TAB_SWITCH_DEBOUNCE_MS) {
        return false;
    }

    // Prevent concurrent switches
    if (tabSwitchInProgress) {
        logger.info({
            operation: 'tab.switch.skipped',
            data: { reason: 'switch_in_progress', requestedTab: tabName },
        });
        return false;
    }

    return true;
}

/**
 * Check if this is the initial render (no content rendered yet)
 */
function isInitialTabRender(): boolean {
    return (
        !document.querySelector('#itemsContainer .item-card') &&
        !document.querySelector('#weaponsContainer .item-card') &&
        !document.querySelector('#tomesContainer .item-card')
    );
}

/**
 * Save current tab state and destroy charts
 */
async function cleanupPreviousTab(previousTab: TabName): Promise<void> {
    if (previousTab && typeof saveFilterState === 'function') {
        saveFilterState(previousTab);
    }

    try {
        const { destroyAllCharts } = await import('./charts.ts');
        destroyAllCharts();
    } catch {
        // Charts module may not be loaded yet, that's fine
    }
}

/**
 * Update global state for the new tab
 */
function updateTabState(tabName: TabName, previousTab: TabName): void {
    setState('currentTab', tabName);
    currentTab = tabName;
    localStorage.setItem(TAB_STORAGE_KEY, tabName);
    logger.setContext('currentTab', tabName);

    // Get item count for logging
    let itemCount = 0;
    if (typeof allData !== 'undefined' && allData) {
        const tabDataMap: Record<string, unknown[] | undefined> = {
            items: allData.items?.items,
            weapons: allData.weapons?.weapons,
            tomes: allData.tomes?.tomes,
            characters: allData.characters?.characters,
            shrines: allData.shrines?.shrines,
        };
        const tabData = tabDataMap[tabName];
        if (Array.isArray(tabData)) {
            itemCount = tabData.length;
        }
    }

    logger.info({
        operation: 'tab.switch',
        data: { fromTab: previousTab, toTab: tabName, itemCount },
    });
}

/**
 * Update UI elements for the new tab
 */
function updateTabUI(tabName: TabName): void {
    // Update tab buttons
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update tab content visibility
    document.querySelectorAll<HTMLElement>('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const tabContent = document.getElementById(`${tabName}-tab`) as HTMLElement | null;
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Update filters
    updateFilters(tabName);
    restoreFilterState(tabName);
}

/**
 * Load modules and render content for the tab
 */
async function loadAndRenderTab(tabName: TabName): Promise<void> {
    showTabSkeleton(tabName);

    try {
        await loadTabModules(tabName);
    } catch (error) {
        logger.error({
            operation: 'tab.module_load_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'events-tabs',
            },
            data: { tabName },
        });
    }

    await renderTabContent(tabName);
}

/**
 * Switch to a different tab
 * Loads tab-specific modules lazily for better initial load performance
 * @param {string} tabName - Tab name to switch to
 */
export async function switchTab(tabName: TabName): Promise<void> {
    if (!shouldProceedWithTabSwitch(tabName)) {
        return;
    }

    tabSwitchInProgress = true;
    lastTabSwitchTime = Date.now();

    try {
        const previousTab = getState('currentTab');

        // Skip if already on this tab (unless initial render)
        if (previousTab === tabName && !isInitialTabRender()) {
            return;
        }

        await cleanupPreviousTab(previousTab);
        updateTabState(tabName, previousTab);
        updateTabUI(tabName);
        await loadAndRenderTab(tabName);
    } finally {
        tabSwitchInProgress = false;
    }
}

/**
 * Preload modules for common tabs after initial render
 * Call this after the app has initialized
 */
export function scheduleModulePreload(): void {
    // Use requestIdleCallback if available for non-blocking preload
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => preloadCommonModules());
    } else {
        setTimeout(preloadCommonModules, 2000);
    }
}

/**
 * Get the saved tab from localStorage
 * Returns the saved tab if valid, otherwise defaults to 'items'
 * @returns Valid tab name
 */
export function getSavedTab(): TabName {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved && VALID_TABS.includes(saved as TabName)) {
        return saved as TabName;
    }
    return 'items'; // Default fallback
}

// ========================================
// Registry & Global Assignments
// ========================================
// Register switchTab for type-safe cross-module access
registerFunction('switchTab', switchTab);

// Keep window assignment for backwards compatibility during migration
if (typeof window !== 'undefined') {
    // Type assertion: switchTab accepts TabName but window type uses string for flexibility
    window.switchTab = switchTab as typeof window.switchTab;
}
