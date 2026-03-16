// ========================================
// Core Events Module
// Event delegation infrastructure and orchestrator
// Re-exports from keyboard, click, and resize sub-modules
// ========================================

import { safeGetElementById, escapeHtml } from './utils.ts';
import { logger } from './logger.ts';
import { loadAllData } from './data-service.ts';
import { closeModal, openDetailModal } from './modal.ts';
import { clearFilters, saveFilterState } from './filters.ts';
import { setupDropdownClickHandlers } from './search-dropdown.ts';
import { renderTabContent } from './renderers.ts';
import { getState, type TabName } from './store.ts';
import { switchTab } from './events-tabs.ts';
import { clearHighlightTimeout, setupSearchListeners, handleSearchResultClick } from './events-search.ts';
import { normalizeEntityType } from '../types/index.ts';

// Import from sub-modules
import { handleKeydownDelegation } from './events-keyboard.ts';
import {
    handleViewDetailsClick,
    handleCardClick,
    handleCompareCheckboxClick,
    handleRemoveCompareClick,
    handleBreakpointCardClick,
    handleFavoriteClick,
} from './events-click.ts';
import {
    isMobileViewport,
    cleanupTabScrollListeners,
    setupTabScrollIndicators as _setupTabScrollIndicators,
    setupStickySearchHideOnScroll as _setupStickySearchHideOnScroll,
} from './events-resize.ts';

// Re-export keyboard module
export {
    handleEscapeKey,
    handleTabArrowNavigation,
    handleNumberKeyTabSwitch,
    handleSearchShortcut,
    handleActivationKey,
    handleBreakpointCardActivation,
    handleKeydownDelegation,
} from './events-keyboard.ts';

// Re-export click module
export {
    handleViewDetailsClick,
    handleCardClick,
    handleCompareCheckboxClick,
    handleRemoveCompareClick,
    handleBreakpointCardClick,
    handleFavoriteClick,
} from './events-click.ts';

// Re-export resize module
export { isMobileViewport, cleanupTabScrollListeners } from './events-resize.ts';

// ========================================
// Memory Management: AbortController for event cleanup
// ========================================
let eventAbortController: AbortController | null = null;

// Track modal close timing to prevent double-handling from click+touchend events
let lastModalCloseTime = 0;
const MODAL_CLOSE_DEBOUNCE_MS = 300;

/**
 * Reset modal close timer for testing
 * @internal
 */
export function __resetModalTimerForTesting(): void {
    lastModalCloseTime = 0;
}

/**
 * Check if AbortSignal is properly supported in addEventListener
 * jsdom has incomplete AbortSignal support that causes TypeErrors
 */
function isAbortSignalSupported(): boolean {
    if (typeof AbortController === 'undefined') return false;

    try {
        const controller = new AbortController();
        const testHandler = (): void => {};
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
    _abortSignalSupported ??= isAbortSignalSupported();
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

    eventAbortController ??= new AbortController();
    return eventAbortController.signal;
}

/**
 * Get event listener options with optional signal
 * Returns options that work in both browser and jsdom environments
 */
export function getListenerOptions(options?: { passive?: boolean }): AddEventListenerOptions | undefined {
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
    // Clean up any pending highlight timeouts
    clearHighlightTimeout();

    // Clean up scroll/resize listeners to prevent memory leaks
    cleanupTabScrollListeners();

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

    const textSpan = document.createElement('span');
    const indicator = document.createElement('span');
    indicator.className = 'expand-indicator';

    if (isTruncated) {
        textSpan.textContent = fullText;
        indicator.textContent = 'Click to collapse';
        element.innerHTML = '';
        element.appendChild(textSpan);
        element.appendChild(indicator);
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
    } else {
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

// ========================================
// Click Delegation (stays in core to avoid circular deps)
// ========================================

/**
 * Handle item card click (for mobile - whole card is tappable)
 */
function handleItemCardClick(target: Element): void {
    handleCardClick(target as HTMLElement);
}

function handleCardAreaClick(e: MouseEvent, target: Element): boolean {
    if (target.classList.contains('view-details-btn')) {
        handleViewDetailsClick(target as HTMLElement);
        return true;
    }
    if (isMobileViewport() && target.closest('.item-card')) {
        if (!target.closest('.favorite-btn, .compare-checkbox-label, .expandable-text, a, button')) {
            handleItemCardClick(target);
            return true;
        }
    }
    if (
        target.closest('.item-card') &&
        !target.closest('.favorite-btn, .compare-checkbox-label, .expandable-text') &&
        !target.classList.contains('view-details-btn')
    ) {
        handleCardClick(target as HTMLElement);
        return true;
    }
    if (target.closest('.compare-checkbox-label') && !target.classList.contains('compare-checkbox')) {
        handleCompareCheckboxClick(e, target);
        return true;
    }
    return false;
}

function handleUIElementClick(target: Element): boolean {
    if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
        const expandable = (
            target.classList.contains('expandable-text') ? target : target.closest('.expandable-text')
        ) as HTMLElement | null;
        if (expandable) toggleTextExpand(expandable);
        return true;
    }
    if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
        handleRemoveCompareClick(target);
        return true;
    }
    if (target.classList.contains('btn-secondary') && target.textContent?.includes('Clear Filters')) {
        clearFilters();
        return true;
    }
    if (target.classList.contains('favorite-btn') || target.closest('.favorite-btn')) {
        handleFavoriteClick(target);
        return true;
    }
    if (target.closest('.breakpoint-card')) {
        handleBreakpointCardClick(target);
        return true;
    }
    if (target.closest('.search-result-card')) {
        handleSearchResultClick(target);
        return true;
    }
    return false;
}

function handleDynamicImportClick(e: MouseEvent, target: Element): boolean {
    // changelog-expand-btn is handled by changelog.ts via container event delegation.
    // Do NOT handle it here — dual handlers cause a double-toggle bug.
    if (target.classList.contains('entity-link')) {
        e.preventDefault();
        const htmlTarget = target as HTMLElement;
        const rawType = htmlTarget.dataset.entityType;
        const id = htmlTarget.dataset.entityId;
        if (rawType && id) {
            const type = normalizeEntityType(rawType);
            if (type) openDetailModal(type, id);
        }
        return true;
    }
    if (target.classList.contains('empty-state-action') || target.closest('.suggestion-card')) {
        import('./empty-states.ts')
            .then(({ handleEmptyStateClick }) => handleEmptyStateClick(target))
            .catch(err =>
                logger.warn({ operation: 'import.empty-states', error: { name: 'ImportError', message: err.message } })
            );
        return true;
    }
    return false;
}

function handleClickDelegation(e: MouseEvent): void {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (handleCardAreaClick(e, target)) return;
    if (handleUIElementClick(target)) return;
    handleDynamicImportClick(e, target);
}

// ========================================
// Change Event Handlers
// ========================================

function handleChangeDelegation(e: Event): void {
    const target = e.target as HTMLElement;

    if (target.classList.contains('tome-checkbox') || target.classList.contains('item-checkbox')) {
        import('./build-planner.ts')
            .then(({ updateBuildAnalysis }) => updateBuildAnalysis())
            .catch(err =>
                logger.warn({ operation: 'import.build-planner', error: { name: 'ImportError', message: err.message } })
            );
        return;
    }

    if (target.closest('#filters') && target.tagName === 'SELECT') {
        const tab = getState('currentTab');
        if (tab) {
            renderTabContent(tab);
            if (typeof saveFilterState === 'function') saveFilterState(tab);
        }
        return;
    }

    if ((target as HTMLInputElement).id === 'favoritesOnly') {
        const tab = getState('currentTab');
        if (tab) {
            renderTabContent(tab);
            if (typeof saveFilterState === 'function') saveFilterState(tab);
        }
        return;
    }
}

// ========================================
// Event Delegation Setup
// ========================================

/**
 * Setup all event delegation handlers
 */
export function setupEventDelegation(): void {
    document.addEventListener('keydown', handleKeydownDelegation, getListenerOptions());
    document.addEventListener('click', handleClickDelegation, getListenerOptions());
    document.addEventListener('change', handleChangeDelegation, getListenerOptions());
    window.addEventListener('pagehide', () => cleanupEventListeners(), getListenerOptions());
}

// ========================================
// UI Component Setup
// ========================================

/**
 * Setup tab button click listeners
 */
export function setupTabButtonListeners(): void {
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        btn.addEventListener(
            'click',
            () => {
                const tabName = (btn.dataset.tab ?? null) as TabName | null;
                if (tabName) switchTab(tabName);
            },
            getListenerOptions()
        );
    });
}

/**
 * Setup tab scroll indicators for mobile
 */
export function setupTabScrollIndicators(): void {
    _setupTabScrollIndicators(getListenerOptions);
}

/**
 * Setup modal close and backdrop listeners
 */
export function setupModalListeners(): void {
    document.querySelectorAll<HTMLElement>('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal, getListenerOptions());
    });

    const closeCompare = safeGetElementById('closeCompare') as HTMLButtonElement | null;
    if (closeCompare) {
        closeCompare.addEventListener(
            'click',
            () => {
                import('./compare.ts')
                    .then(({ closeCompareModal }) => closeCompareModal())
                    .catch(err =>
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        })
                    );
            },
            getListenerOptions()
        );
    }

    const handleModalBackdropInteraction = (e: MouseEvent | TouchEvent): void => {
        const now = Date.now();
        if (now - lastModalCloseTime < MODAL_CLOSE_DEBOUNCE_MS) return;

        const target = e.target as HTMLElement;
        const itemModal = safeGetElementById('itemModal');
        const compareModal = safeGetElementById('compareModal');

        if (itemModal?.classList.contains('active')) {
            const modalContent = itemModal.querySelector('.modal-content');
            if (target === itemModal || (itemModal.contains(target) && !modalContent?.contains(target))) {
                lastModalCloseTime = now;
                closeModal();
                return;
            }
        }

        if (compareModal?.classList.contains('active')) {
            const modalContent = compareModal.querySelector('.modal-content');
            if (target === compareModal || (compareModal.contains(target) && !modalContent?.contains(target))) {
                lastModalCloseTime = now;
                import('./compare.ts')
                    .then(({ closeCompareModal }) => closeCompareModal())
                    .catch(err =>
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        })
                    );
            }
        }
    };

    window.addEventListener('click', handleModalBackdropInteraction, getListenerOptions());
    window.addEventListener('touchend', handleModalBackdropInteraction, getListenerOptions());
}

/**
 * Setup compare button listener
 */
export function setupCompareButtonListener(): void {
    const compareBtn = safeGetElementById('compare-btn') as HTMLButtonElement | null;
    if (compareBtn) {
        compareBtn.addEventListener(
            'click',
            () => {
                import('./compare.ts')
                    .then(({ openCompareModal }) => openCompareModal())
                    .catch(err =>
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        })
                    );
            },
            getListenerOptions()
        );
    }
}

/**
 * Setup mobile filter toggle button
 */
export function setupFilterToggle(): void {
    const toggleBtn = safeGetElementById('filter-toggle-btn') as HTMLButtonElement | null;
    const filters = safeGetElementById('filters');

    if (!toggleBtn || !filters) return;

    toggleBtn.addEventListener(
        'click',
        () => {
            const isExpanded = filters.classList.toggle('filters-expanded');
            toggleBtn.classList.toggle('active', isExpanded);
            toggleBtn.setAttribute('aria-expanded', String(isExpanded));
        },
        getListenerOptions()
    );
}

/**
 * Setup sticky search bar that hides on scroll down, shows on scroll up
 */
export function setupStickySearchHideOnScroll(): void {
    _setupStickySearchHideOnScroll(getListenerOptions);
}

/**
 * Setup all event listeners
 */
export function setupEventListeners(): void {
    setupTabButtonListeners();
    setupTabScrollIndicators();
    setupSearchListeners(getListenerOptions);
    setupModalListeners();
    setupCompareButtonListener();
    setupFilterToggle();
    setupStickySearchHideOnScroll();
    setupEventDelegation();
    setupDropdownClickHandlers();
}

// ========================================
// Loading & Error UI Functions
// ========================================

/**
 * Show loading overlay
 */
export function showLoading(): void {
    const overlay = safeGetElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
export function hideLoading(): void {
    const overlay = safeGetElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

/**
 * Show error message banner
 * @param {string} message - Error message to display
 * @param {boolean} isRetryable - Whether to show retry button
 */
export function showErrorMessage(message: string, isRetryable: boolean = true): void {
    let errorContainer = safeGetElementById('error-container');
    let isNewContainer = false;

    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.className = 'error-container';
        document.body.prepend(errorContainer);
        isNewContainer = true;
    }

    if (!isNewContainer) {
        const messagePara = errorContainer.querySelector<HTMLParagraphElement>('.error-content p');
        if (messagePara) {
            messagePara.textContent = message;
            errorContainer.style.display = 'block';
            return;
        }
    }

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

    const retryBtn = errorContainer.querySelector<HTMLButtonElement>('.error-retry-btn');
    if (retryBtn && !retryBtn.dataset.listenerAttached) {
        retryBtn.dataset.listenerAttached = 'true';
        retryBtn.addEventListener('click', () => {
            dismissError();
            loadAllData();
        });
    }

    const closeBtn = errorContainer.querySelector<HTMLButtonElement>('.error-close');
    if (closeBtn && !closeBtn.dataset.listenerAttached) {
        closeBtn.dataset.listenerAttached = 'true';
        closeBtn.addEventListener('click', dismissError);
    }
}

/**
 * Dismiss error message
 */
export function dismissError(): void {
    const errorContainer = safeGetElementById('error-container');
    if (errorContainer) errorContainer.style.display = 'none';
}
