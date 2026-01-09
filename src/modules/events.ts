// ========================================
// MegaBonk Events Module
// Event delegation to replace inline handlers
// ========================================

import { ToastManager } from './toast.js';
import { safeGetElementById } from './utils.js';
import { loadAllData } from './data-service.js';
import { closeModal, openDetailModal } from './modal.js';
import { closeCompareModal, toggleCompareItem, updateCompareDisplay } from './compare.js';
import { quickCalc } from './calculator.js';
import { toggleFavorite } from './favorites.js';
import { clearFilters, handleSearch, updateFilters, restoreFilterState, saveFilterState } from './filters.js';
import { renderTabContent } from './renderers.js';
import { toggleChangelogExpand } from './changelog.js';

import type { EntityType } from '../types/index.js';

// Type definitions for tab names
type TabName = 'items' | 'weapons' | 'tomes' | 'characters' | 'shrines' | 'build-planner' | 'calculator';

// Declare global functions that may exist on window
declare global {
    // Note: Window.currentTab is declared in filters.ts to avoid duplicate declarations
    // Functions that may be globally available
    function switchTab(tabName: TabName): void;
    function updateBuildAnalysis(): void;
    function openCompareModal(): void;
    function setupBuildPlannerEvents(): void;
    function destroyAllCharts(): void;
    function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void;
    function showSearchHistoryDropdown(input: HTMLInputElement): void;
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
    document.addEventListener('keydown', (e: KeyboardEvent) => {
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
    });

    // Main click delegation
    document.addEventListener('click', (e: MouseEvent) => {
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

        // Compare checkbox
        if (target.classList.contains('compare-checkbox')) {
            const checkbox = target as HTMLInputElement;
            const id = target.dataset.id || checkbox.value;
            if (id) {
                toggleCompareItem(id);
            }
            return;
        }

        // Expandable text
        if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
            const expandable = target.classList.contains('expandable-text')
                ? target
                : target.closest('.expandable-text') as HTMLElement | null;
            if (expandable) {
                toggleTextExpand(expandable);
            }
            return;
        }

        // Remove from comparison button
        if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
            const btn = target.classList.contains('remove-compare-btn')
                ? target
                : target.closest('.remove-compare-btn') as HTMLElement | null;
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
            const btn = (target.classList.contains('favorite-btn') ? target : target.closest('.favorite-btn')) as HTMLButtonElement | null;
            const tabName = btn?.dataset.tab as TabName | undefined;
            const itemId = btn?.dataset.id;
            // Type guard: favorites only work for entity tabs, not build-planner or calculator
            const isEntityTab = (tab: TabName | undefined): tab is EntityType => {
                return tab === 'items' || tab === 'weapons' || tab === 'tomes' || tab === 'characters' || tab === 'shrines';
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
    });

    // Change event delegation for checkboxes in build planner
    document.addEventListener('change', (e: Event) => {
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

        // Filter select changes
        if (target.closest('#filters') && target.tagName === 'SELECT') {
            renderTabContent(currentTab as TabName);
            // Save filter state when filters change
            if (typeof saveFilterState === 'function') {
                saveFilterState(currentTab as TabName);
            }
            return;
        }

        // Favorites filter checkbox
        if ((target as HTMLInputElement).id === 'favoritesOnly') {
            renderTabContent(currentTab as TabName);
            // Save filter state when favorites checkbox changes
            if (typeof saveFilterState === 'function') {
                saveFilterState(currentTab as TabName);
            }
            return;
        }
    });
}

/**
 * Setup all event listeners
 */
export function setupEventListeners(): void {
    // Tab buttons
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab') as TabName | null;
            if (tabName) {
                switchTab(tabName);
            }
        });
    });

    // Search input - Bug fix: Add debounce to prevent excessive re-renders
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));

        // Show search history on focus
        searchInput.addEventListener('focus', () => {
            if (typeof showSearchHistoryDropdown === 'function') {
                showSearchHistoryDropdown(searchInput);
            }
        });
    }

    // Modal close buttons
    document.querySelectorAll<HTMLElement>('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal);
    });

    // Close compare modal button
    const closeCompare = safeGetElementById('closeCompare') as HTMLButtonElement | null;
    if (closeCompare) {
        closeCompare.addEventListener('click', () => {
            const modal = safeGetElementById('compareModal') as HTMLElement | null;
            if (modal) modal.style.display = 'none';
        });
    }

    // Click outside modal to close
    window.addEventListener('click', (e: MouseEvent) => {
        const itemModal = safeGetElementById('itemModal') as HTMLElement | null;
        const compareModal = safeGetElementById('compareModal') as HTMLElement | null;
        if (e.target === itemModal) closeModal();
        if (e.target === compareModal && compareModal) compareModal.style.display = 'none';
    });

    // Compare button
    const compareBtn = safeGetElementById('compare-btn') as HTMLButtonElement | null;
    if (compareBtn) {
        compareBtn.addEventListener('click', openCompareModal);
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
    errorContainer.innerHTML = `
        <div class="error-message">
            <span class="error-icon">⚠️</span>
            <div class="error-content">
                <strong>Error Loading Data</strong>
                <p>${message}</p>
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

// Current tab state
export let currentTab: TabName = 'items';

/**
 * Switch to a different tab
 * @param {string} tabName - Tab name to switch to
 */
export function switchTab(tabName: TabName): void {
    // Save current tab's filter state before switching
    if (currentTab && typeof saveFilterState === 'function') {
        saveFilterState(currentTab);
    }

    // Destroy existing charts before switching tabs
    destroyAllCharts();

    currentTab = tabName;
    // Bug fix: Keep window.currentTab in sync for external code
    window.currentTab = tabName;

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
// Exported API
// ========================================
// All functions and currentTab variable are exported above
