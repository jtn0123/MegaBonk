// ========================================
// MegaBonk Events Module
// Event delegation to replace inline handlers
// ========================================

import { ToastManager } from './toast.ts';
import { safeGetElementById, debounce, escapeHtml } from './utils.ts';
import { logger } from './logger.ts';
import { loadAllData } from './data-service.ts';
import { closeModal, openDetailModal } from './modal.ts';
import { closeCompareModal, toggleCompareItem, updateCompareDisplay, openCompareModal } from './compare.ts';
import { quickCalc } from './calculator.ts';
import { toggleFavorite } from './favorites.ts';
import {
    clearFilters,
    handleSearch,
    updateFilters,
    restoreFilterState,
    saveFilterState,
    showSearchHistoryDropdown,
} from './filters.ts';
import { destroyAllCharts } from './charts.ts';
import { setupBuildPlannerEvents, updateBuildAnalysis } from './build-planner.ts';
import { renderTabContent } from './renderers.ts';
import { toggleChangelogExpand } from './changelog.ts';
import { getState, setState, type TabName } from './store.ts';

import type { EntityType } from '../types/index.ts';

// LocalStorage key for persisting tab selection
const TAB_STORAGE_KEY = 'megabonk-current-tab';

// Valid tab names for validation
const VALID_TABS: TabName[] = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator'];

// ========================================
// Memory Management: AbortController for event cleanup
// ========================================
// This prevents memory leaks from accumulated event listeners
let eventAbortController: AbortController | null = null;

/**
 * Check if AbortSignal is properly supported in addEventListener
 * jsdom has incomplete AbortSignal support that causes TypeErrors
 */
function isAbortSignalSupported(): boolean {
    if (typeof AbortController === 'undefined') return false;

    try {
        // Create a test to see if signal works in addEventListener
        const controller = new AbortController();
        const testHandler = (): void => {};

        // Try adding and immediately removing a listener with signal
        // In jsdom, this throws: "parameter 3 dictionary has member 'signal' that is not of type 'AbortSignal'"
        const testDiv = document.createElement('div');
        testDiv.addEventListener('test', testHandler, { signal: controller.signal });
        testDiv.removeEventListener('test', testHandler);
        return true;
    } catch {
        return false;
    }
}

// Cache the result - check once at module load
let _abortSignalSupported: boolean | null = null;
function getAbortSignalSupported(): boolean {
    if (_abortSignalSupported === null) {
        _abortSignalSupported = isAbortSignalSupported();
    }
    return _abortSignalSupported;
}

/**
 * Get or create the AbortController for event listeners
 * Returns undefined if AbortSignal isn't properly supported (e.g., jsdom)
 */
function getEventAbortSignal(): AbortSignal | undefined {
    if (!getAbortSignalSupported()) {
        return undefined;
    }

    if (!eventAbortController) {
        eventAbortController = new AbortController();
    }
    return eventAbortController.signal;
}

/**
 * Get event listener options with optional signal
 * Returns options that work in both browser and jsdom environments
 */
function getListenerOptions(options?: { passive?: boolean }): AddEventListenerOptions | undefined {
    const signal = getEventAbortSignal();
    if (signal) {
        return options ? { ...options, signal } : { signal };
    }
    return options;
}

/**
 * Cleanup all event listeners registered via getEventAbortSignal()
 * Call this when reinitializing the app or cleaning up
 */
export function cleanupEventListeners(): void {
    if (eventAbortController) {
        eventAbortController.abort();
        eventAbortController = null;
        logger.info({
            operation: 'events.cleanup',
            data: { message: 'All event listeners cleaned up' },
        });
    }
}

/**
 * Toggle text expansion on click
 * @param {HTMLElement} element - The expandable text element
 */
export function toggleTextExpand(element: HTMLElement): void {
    if (!element.dataset.fullText) return;

    const isTruncated = element.dataset.truncated === 'true';
    const fullText = element.dataset.fullText;

    // Bug fix: Use textContent for user data and separate span for indicator
    // This prevents XSS since dataset values are automatically decoded by browser
    const textSpan = document.createElement('span');
    const indicator = document.createElement('span');
    indicator.className = 'expand-indicator';

    if (isTruncated) {
        // Expand
        textSpan.textContent = fullText;
        indicator.textContent = 'Click to collapse';
        element.innerHTML = '';
        element.appendChild(textSpan);
        element.appendChild(indicator);
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
    } else {
        // Collapse
        const truncated = fullText.length > 120 ? fullText.substring(0, 120) + '...' : fullText;
        textSpan.textContent = truncated;
        indicator.textContent = 'Click to expand';
        element.innerHTML = '';
        element.appendChild(textSpan);
        element.appendChild(indicator);
        element.dataset.truncated = 'true';
        element.classList.remove('expanded');
    }
}

/**
 * Setup all event delegation handlers
 */
export function setupEventDelegation(): void {
    // Bug fix: Add keyboard event handler for breakpoint cards and Escape key for modals
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                closeModal();
                closeCompareModal();
                return;
            }

            // Ctrl+K or / to focus search (unless in input)
            if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
                // Don't trigger if already in an input or textarea
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return;
                }
                e.preventDefault();
                const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }

            // Number keys (1-7) to switch tabs
            if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                // Don't trigger if in an input or textarea
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return;
                }
                const tabMap: Record<string, TabName> = {
                    1: 'items',
                    2: 'weapons',
                    3: 'tomes',
                    4: 'characters',
                    5: 'shrines',
                    6: 'build-planner',
                    7: 'calculator',
                };
                const tabName = tabMap[e.key];
                if (tabName && typeof switchTab === 'function') {
                    e.preventDefault();
                    switchTab(tabName);
                }
                return;
            }

            // Enter or Space on breakpoint cards triggers quickCalc
            if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target as HTMLElement;
                if (target.classList.contains('breakpoint-card')) {
                    e.preventDefault();
                    const itemId = target.dataset.item;
                    const targetVal = target.dataset.target;
                    if (itemId && targetVal) {
                        const parsedTarget = parseInt(targetVal, 10);
                        if (!isNaN(parsedTarget)) {
                            quickCalc(itemId, parsedTarget);
                        }
                    }
                }
            }
        },
        getListenerOptions()
    );

    // Main click delegation
    document.addEventListener(
        'click',
        (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // View Details button
            if (target.classList.contains('view-details-btn')) {
                const type = target.dataset.type as EntityType | undefined;
                const id = target.dataset.id;
                if (type && id) {
                    openDetailModal(type, id);
                }
                return;
            }

            // Compare checkbox or its label
            // Only handle clicks on the label element itself, not the hidden checkbox
            // Use a timestamp to prevent rapid double-toggling from event bubbling
            if (target.closest('.compare-checkbox-label') && !target.classList.contains('compare-checkbox')) {
                const label = target.closest('.compare-checkbox-label') as HTMLElement;
                const checkbox = label?.querySelector('.compare-checkbox') as HTMLInputElement | null;
                if (checkbox) {
                    // Prevent double-toggling by checking last toggle time
                    const now = Date.now();
                    const lastToggle = parseInt(checkbox.dataset.lastToggle || '0', 10);
                    if (now - lastToggle < 100) {
                        return; // Ignore rapid repeated clicks
                    }
                    checkbox.dataset.lastToggle = now.toString();

                    const id = checkbox.dataset.id || checkbox.value;
                    if (id) {
                        e.preventDefault();
                        // Toggle the checkbox state manually since it may be hidden
                        checkbox.checked = !checkbox.checked;
                        toggleCompareItem(id);
                    }
                }
                return;
            }

            // Expandable text
            if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
                const expandable = target.classList.contains('expandable-text')
                    ? target
                    : (target.closest('.expandable-text') as HTMLElement | null);
                if (expandable) {
                    toggleTextExpand(expandable);
                }
                return;
            }

            // Remove from comparison button
            if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
                const btn = target.classList.contains('remove-compare-btn')
                    ? target
                    : (target.closest('.remove-compare-btn') as HTMLElement | null);
                const id = btn?.dataset.removeId;
                if (id) {
                    toggleCompareItem(id);
                    updateCompareDisplay();
                }
                return;
            }

            // Clear filters button (in empty state)
            if (target.classList.contains('btn-secondary') && target.textContent?.includes('Clear Filters')) {
                clearFilters();
                return;
            }

            // Changelog expand button
            if (target.classList.contains('changelog-expand-btn')) {
                toggleChangelogExpand(target as HTMLButtonElement);
                return;
            }

            // Entity link in changelog (deep linking)
            if (target.classList.contains('entity-link')) {
                e.preventDefault();
                const type = target.dataset.entityType as EntityType | undefined;
                const id = target.dataset.entityId;
                if (type && id) {
                    openDetailModal(type, id);
                }
                return;
            }

            // Breakpoint card click (calculator quick calc)
            if (target.closest('.breakpoint-card')) {
                const card = target.closest('.breakpoint-card') as HTMLElement | null;
                const itemId = card?.dataset.item;
                const targetVal = card?.dataset.target;
                if (itemId && targetVal) {
                    const parsedTarget = parseInt(targetVal, 10);
                    if (!isNaN(parsedTarget)) {
                        quickCalc(itemId, parsedTarget);
                    }
                }
                return;
            }

            // Favorite button click
            if (target.classList.contains('favorite-btn') || target.closest('.favorite-btn')) {
                const btn = (
                    target.classList.contains('favorite-btn') ? target : target.closest('.favorite-btn')
                ) as HTMLButtonElement | null;
                const tabName = btn?.dataset.tab as TabName | undefined;
                const itemId = btn?.dataset.id;
                // Type guard: favorites only work for entity tabs, not build-planner or calculator
                const isEntityTab = (tab: TabName | undefined): tab is EntityType => {
                    return (
                        tab === 'items' ||
                        tab === 'weapons' ||
                        tab === 'tomes' ||
                        tab === 'characters' ||
                        tab === 'shrines'
                    );
                };
                if (btn && tabName && isEntityTab(tabName) && itemId && typeof toggleFavorite === 'function') {
                    const nowFavorited = toggleFavorite(tabName, itemId);
                    // Update button appearance
                    btn.classList.toggle('favorited', nowFavorited);
                    btn.textContent = nowFavorited ? '⭐' : '☆';
                    btn.title = nowFavorited ? 'Remove from favorites' : 'Add to favorites';
                    btn.setAttribute('aria-label', nowFavorited ? 'Remove from favorites' : 'Add to favorites');
                    // Show toast
                    if (typeof ToastManager !== 'undefined') {
                        ToastManager.success(nowFavorited ? 'Added to favorites' : 'Removed from favorites');
                    }
                }
                return;
            }
        },
        getListenerOptions()
    );

    // Change event delegation for checkboxes in build planner
    document.addEventListener(
        'change',
        (e: Event) => {
            const target = e.target as HTMLElement;

            // Tome checkbox in build planner
            if (target.classList.contains('tome-checkbox')) {
                updateBuildAnalysis();
                return;
            }

            // Item checkbox in build planner
            if (target.classList.contains('item-checkbox')) {
                updateBuildAnalysis();
                return;
            }

            // Filter select changes - guard against uninitialized currentTab
            if (target.closest('#filters') && target.tagName === 'SELECT') {
                const tab = getState('currentTab');
                if (tab) {
                    renderTabContent(tab);
                    // Save filter state when filters change
                    if (typeof saveFilterState === 'function') {
                        saveFilterState(tab);
                    }
                }
                return;
            }

            // Favorites filter checkbox - guard against uninitialized currentTab
            if ((target as HTMLInputElement).id === 'favoritesOnly') {
                const tab = getState('currentTab');
                if (tab) {
                    renderTabContent(tab);
                    // Save filter state when favorites checkbox changes
                    if (typeof saveFilterState === 'function') {
                        saveFilterState(tab);
                    }
                }
                return;
            }
        },
        getListenerOptions()
    );
}

/**
 * Setup all event listeners
 */
export function setupEventListeners(): void {
    // Tab buttons
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        btn.addEventListener(
            'click',
            () => {
                const tabName = btn.getAttribute('data-tab') as TabName | null;
                if (tabName) {
                    switchTab(tabName);
                }
            },
            getListenerOptions()
        );
    });

    // Tab scroll indicators (mobile)
    const tabContainer = document.querySelector('.tabs .container') as HTMLElement | null;
    const tabButtons = document.querySelector('.tab-buttons') as HTMLElement | null;

    if (tabContainer && tabButtons) {
        const updateTabScrollIndicators = (): void => {
            const canScrollLeft = tabButtons.scrollLeft > 5;
            const canScrollRight = tabButtons.scrollLeft < tabButtons.scrollWidth - tabButtons.clientWidth - 5;

            tabContainer.classList.toggle('can-scroll-left', canScrollLeft);
            tabContainer.classList.toggle('can-scroll-right', canScrollRight);
        };

        tabButtons.addEventListener('scroll', updateTabScrollIndicators, getListenerOptions({ passive: true }));
        // Initial check after a short delay to ensure layout is complete
        setTimeout(updateTabScrollIndicators, 100);
        // Recheck on resize
        window.addEventListener('resize', debounce(updateTabScrollIndicators, 100), getListenerOptions());
    }

    // Search input - Bug fix: Add debounce to prevent excessive re-renders
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300), getListenerOptions());

        // Show search history on focus
        searchInput.addEventListener(
            'focus',
            () => {
                if (typeof showSearchHistoryDropdown === 'function') {
                    showSearchHistoryDropdown(searchInput);
                }
            },
            getListenerOptions()
        );
    }

    // Modal close buttons
    document.querySelectorAll<HTMLElement>('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal, getListenerOptions());
    });

    // Close compare modal button
    const closeCompare = safeGetElementById('closeCompare') as HTMLButtonElement | null;
    if (closeCompare) {
        closeCompare.addEventListener(
            'click',
            () => {
                closeCompareModal(); // Use proper cleanup function
            },
            getListenerOptions()
        );
    }

    // Click/touch outside modal to close - handle backdrop clicks
    // Check if click is inside modal but outside modal-content (the backdrop area)
    const handleModalBackdropInteraction = (e: MouseEvent | TouchEvent): void => {
        const target = e.target as HTMLElement;
        const itemModal = safeGetElementById('itemModal') as HTMLElement | null;
        const compareModal = safeGetElementById('compareModal') as HTMLElement | null;

        // Close item modal if clicking on backdrop (modal element but not modal-content)
        if (itemModal && itemModal.classList.contains('active')) {
            const modalContent = itemModal.querySelector('.modal-content');
            if (target === itemModal || (itemModal.contains(target) && !modalContent?.contains(target))) {
                closeModal();
            }
        }

        // Close compare modal if clicking on backdrop
        if (compareModal && compareModal.classList.contains('active')) {
            const modalContent = compareModal.querySelector('.modal-content');
            if (target === compareModal || (compareModal.contains(target) && !modalContent?.contains(target))) {
                closeCompareModal();
            }
        }
    };

    // Handle both click and touch events for desktop/mobile compatibility
    window.addEventListener('click', handleModalBackdropInteraction, getListenerOptions());
    window.addEventListener('touchend', handleModalBackdropInteraction, getListenerOptions());

    // Compare button
    const compareBtn = safeGetElementById('compare-btn') as HTMLButtonElement | null;
    if (compareBtn) {
        compareBtn.addEventListener('click', openCompareModal, getListenerOptions());
    }

    // Build planner events
    setupBuildPlannerEvents();

    // Setup event delegation for dynamic elements
    setupEventDelegation();
}

// ========================================
// Loading & Error UI Functions
// ========================================

/**
 * Show loading overlay
 */
export function showLoading(): void {
    const overlay = safeGetElementById('loading-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
export function hideLoading(): void {
    const overlay = safeGetElementById('loading-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'none';
}

/**
 * Show error message banner
 * @param {string} message - Error message to display
 * @param {boolean} isRetryable - Whether to show retry button
 */
export function showErrorMessage(message: string, isRetryable: boolean = true): void {
    let errorContainer = safeGetElementById('error-container') as HTMLElement | null;
    let isNewContainer = false;

    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.className = 'error-container';
        document.body.prepend(errorContainer);
        isNewContainer = true;
    }

    // If container already exists, just update the message text for efficiency
    if (!isNewContainer) {
        const messagePara = errorContainer.querySelector<HTMLParagraphElement>('.error-content p');
        if (messagePara) {
            messagePara.textContent = message;
            errorContainer.style.display = 'block';
            return; // Listeners already attached, no need to recreate
        }
    }

    // First time or structure missing - create full HTML
    // Security: Use escapeHtml to prevent XSS from error messages
    errorContainer.innerHTML = `
        <div class="error-message">
            <span class="error-icon">⚠️</span>
            <div class="error-content">
                <strong>Error Loading Data</strong>
                <p>${escapeHtml(message)}</p>
            </div>
            ${isRetryable ? '<button class="btn-primary error-retry-btn">Retry</button>' : ''}
            <button class="error-close">&times;</button>
        </div>
    `;
    errorContainer.style.display = 'block';

    // Attach listeners only when creating new structure
    const retryBtn = errorContainer.querySelector<HTMLButtonElement>('.error-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            dismissError();
            loadAllData();
        });
    }

    const closeBtn = errorContainer.querySelector<HTMLButtonElement>('.error-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', dismissError);
    }
}

/**
 * Dismiss error message
 */
export function dismissError(): void {
    const errorContainer = safeGetElementById('error-container') as HTMLElement | null;
    if (errorContainer) errorContainer.style.display = 'none';
}

// ========================================
// Tab Switching
// ========================================

// Current tab state - now uses centralized store
// Export getter for backwards compatibility
export function getCurrentTab(): TabName {
    return getState('currentTab');
}

// Keep exported variable for backwards compat (updated via switchTab)
export let currentTab: TabName = getState('currentTab');

/**
 * Switch to a different tab
 * @param {string} tabName - Tab name to switch to
 */
export function switchTab(tabName: TabName): void {
    const previousTab = getState('currentTab');

    // Save current tab's filter state before switching
    if (previousTab && typeof saveFilterState === 'function') {
        saveFilterState(previousTab);
    }

    // Destroy existing charts before switching tabs
    destroyAllCharts();

    // Update store (also syncs to window.currentTab automatically)
    setState('currentTab', tabName);
    currentTab = tabName; // Keep local export in sync

    // Persist tab selection to localStorage
    localStorage.setItem(TAB_STORAGE_KEY, tabName);

    // Update logger context with current tab
    logger.setContext('currentTab', tabName);

    // Get item count for the new tab (data tabs only)
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

    // Log tab switch event
    logger.info({
        operation: 'tab.switch',
        data: {
            fromTab: previousTab,
            toTab: tabName,
            itemCount,
        },
    });
    // Note: window.currentTab is synced automatically by the store

    // Update tab buttons
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update tab content
    document.querySelectorAll<HTMLElement>('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const tabContent = safeGetElementById(`${tabName}-tab`) as HTMLElement | null;
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Update filters based on tab
    updateFilters(tabName);

    // Restore filter state for new tab
    restoreFilterState(tabName);

    // Render content for the tab
    renderTabContent(tabName);
}

// ========================================
// Tab Persistence
// ========================================

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
// Global Assignments
// ========================================
// Expose switchTab globally for cross-module access (avoids circular dependencies)
(window as any).switchTab = switchTab;

// ========================================
// Exported API
// ========================================
// All functions and currentTab variable are exported above
