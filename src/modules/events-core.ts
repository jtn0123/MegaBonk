// ========================================
// Core Events Module
// Event delegation infrastructure and handlers
// ========================================

import { ToastManager } from './toast.ts';
import { safeGetElementById, debounce, escapeHtml } from './utils.ts';
import { logger } from './logger.ts';
import { loadAllData } from './data-service.ts';
import { closeModal, openDetailModal } from './modal.ts';
import { toggleFavorite } from './favorites.ts';
import { clearFilters, saveFilterState } from './filters.ts';
import {
    handleDropdownKeyboard,
    isSearchDropdownVisible,
    hideSearchDropdown,
    setupDropdownClickHandlers,
} from './search-dropdown.ts';
import { renderTabContent } from './renderers.ts';
import { getState, type TabName } from './store.ts';
import { switchTab } from './events-tabs.ts';
import { handleSearchResultClick, clearHighlightTimeout, setupSearchListeners } from './events-search.ts';

import { normalizeEntityType, type EntityType } from '../types/index.ts';

// ========================================
// Memory Management: AbortController for event cleanup
// ========================================
let eventAbortController: AbortController | null = null;

// Track scroll/resize listener cleanup functions to prevent memory leaks
let scrollListenerCleanup: (() => void) | null = null;
let resizeListenerCleanup: (() => void) | null = null;

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
export function getListenerOptions(options?: { passive?: boolean }): AddEventListenerOptions | undefined {
    const signal = getEventAbortSignal();
    if (signal) {
        return options ? { ...options, signal } : { signal };
    }
    return options;
}

/**
 * Clean up tab scroll/resize listeners
 * Prevents memory leaks from accumulated listeners
 */
export function cleanupTabScrollListeners(): void {
    if (scrollListenerCleanup) {
        scrollListenerCleanup();
        scrollListenerCleanup = null;
    }
    if (resizeListenerCleanup) {
        resizeListenerCleanup();
        resizeListenerCleanup = null;
    }
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
// Keyboard Event Handlers
// ========================================

/**
 * Handle Escape key to close modals and dropdowns
 */
function handleEscapeKey(): void {
    if (isSearchDropdownVisible()) {
        hideSearchDropdown();
        return;
    }
    closeModal();
    import('./compare.ts')
        .then(({ closeCompareModal }) => closeCompareModal())
        .catch(err => {
            logger.warn({
                operation: 'import.compare',
                error: { name: 'ImportError', message: err.message },
            });
            const compareModal = safeGetElementById('compareModal') as HTMLElement | null;
            if (compareModal) {
                compareModal.style.display = 'none';
                compareModal.classList.remove('active');
            }
        });
}

/**
 * Handle arrow key navigation between tabs
 */
function handleTabArrowNavigation(e: KeyboardEvent, target: HTMLButtonElement): void {
    e.preventDefault();
    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
    if (tabButtons.length === 0) return;
    const currentIndex = tabButtons.indexOf(target);
    if (currentIndex === -1) return;

    const nextIndex =
        e.key === 'ArrowRight'
            ? (currentIndex + 1) % tabButtons.length
            : (currentIndex - 1 + tabButtons.length) % tabButtons.length;

    const nextTab = tabButtons[nextIndex];
    if (nextTab) {
        nextTab.focus();
        const tabName = nextTab.getAttribute('data-tab') as TabName | null;
        if (tabName && typeof switchTab === 'function') {
            switchTab(tabName);
        }
    }
}

/**
 * Handle number key shortcuts for tab switching
 */
function handleNumberKeyTabSwitch(e: KeyboardEvent): void {
    const tabMap: Record<string, TabName> = {
        1: 'items',
        2: 'weapons',
        3: 'tomes',
        4: 'characters',
        5: 'shrines',
        6: 'build-planner',
        7: 'calculator',
        8: 'advisor',
        9: 'changelog',
    };
    const tabName = tabMap[e.key];
    if (tabName && typeof switchTab === 'function') {
        e.preventDefault();
        switchTab(tabName);
    }
}

/**
 * Handle Enter/Space activation on breakpoint cards
 */
function handleBreakpointCardActivation(e: KeyboardEvent, target: HTMLElement): void {
    e.preventDefault();
    const itemId = target.dataset.item;
    const targetVal = target.dataset.target;
    if (itemId && targetVal) {
        const parsedTarget = parseInt(targetVal, 10);
        if (!isNaN(parsedTarget)) {
            import('./calculator.ts')
                .then(({ quickCalc }) => quickCalc(itemId, parsedTarget))
                .catch(err => {
                    logger.warn({
                        operation: 'import.calculator',
                        error: { name: 'ImportError', message: err.message },
                    });
                });
        }
    }
}

/**
 * Handle keyboard events for navigation, shortcuts, and accessibility
 */
function handleKeydownDelegation(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const isSearchInputFocused = target.id === 'searchInput';

    if (isSearchInputFocused && isSearchDropdownVisible()) {
        if (handleDropdownKeyboard(e)) {
            return;
        }
    }

    if (e.key === 'Escape') {
        handleEscapeKey();
        return;
    }

    if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
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

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && target.classList.contains('tab-btn')) {
        handleTabArrowNavigation(e, target as HTMLButtonElement);
        return;
    }

    if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            handleNumberKeyTabSwitch(e);
        }
        return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && target.classList.contains('breakpoint-card')) {
        handleBreakpointCardActivation(e, target);
        return;
    }

    // Handle Enter/Space on suggestion cards (accessibility)
    if ((e.key === 'Enter' || e.key === ' ') && target.classList.contains('suggestion-card')) {
        e.preventDefault();
        import('./empty-states.ts')
            .then(({ handleEmptyStateClick }) => {
                handleEmptyStateClick(target);
            })
            .catch(err =>
                logger.warn({ operation: 'import.empty-states', error: { name: 'ImportError', message: err.message } })
            );
        return;
    }

    // Handle Enter/Space on item cards (accessibility) - opens detail modal
    if ((e.key === 'Enter' || e.key === ' ') && target.classList.contains('clickable-card')) {
        e.preventDefault();
        handleCardClick(target);
    }
}

// ========================================
// Click Event Handlers
// ========================================

/**
 * Handle View Details button click
 */
function handleViewDetailsClick(target: HTMLElement): void {
    const type = target.dataset.type as EntityType | undefined;
    const id = target.dataset.id;
    if (type && id) openDetailModal(type, id);
}

/**
 * Handle item card click to open detail modal
 */
function handleCardClick(target: HTMLElement): void {
    const card = target.closest('.item-card') as HTMLElement | null;
    if (!card) return;

    // Map card classes/data to entity types
    const entityType = card.dataset.entityType as EntityType | undefined;
    const entityId = card.dataset.entityId;

    if (entityType && entityId) {
        const type = normalizeEntityType(entityType);
        if (type) openDetailModal(type, entityId);
    }
}

/**
 * Handle compare checkbox click with debouncing
 */
function handleCompareCheckboxClick(e: MouseEvent, target: Element): void {
    const label = target.closest('.compare-checkbox-label') as HTMLElement;
    const checkbox = label?.querySelector('.compare-checkbox') as HTMLInputElement | null;
    if (!checkbox) return;

    const now = Date.now();
    const lastToggle = parseInt(checkbox.dataset.lastToggle || '0', 10);
    if (now - lastToggle < 100) return;
    checkbox.dataset.lastToggle = now.toString();

    const id = checkbox.dataset.id || checkbox.value;
    if (id) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        import('./compare.ts')
            .then(({ toggleCompareItem }) => toggleCompareItem(id))
            .catch(err =>
                logger.warn({ operation: 'import.compare', error: { name: 'ImportError', message: err.message } })
            );
    }
}

/**
 * Handle remove from comparison button click
 */
function handleRemoveCompareClick(target: Element): void {
    const btn = target.classList.contains('remove-compare-btn')
        ? (target as HTMLElement)
        : (target.closest('.remove-compare-btn') as HTMLElement | null);
    const id = btn?.dataset.removeId;
    if (id) {
        import('./compare.ts')
            .then(({ toggleCompareItem, updateCompareDisplay }) => {
                toggleCompareItem(id);
                updateCompareDisplay();
            })
            .catch(err =>
                logger.warn({ operation: 'import.compare', error: { name: 'ImportError', message: err.message } })
            );
    }
}

/**
 * Handle breakpoint card click for quick calc
 */
function handleBreakpointCardClick(target: Element): void {
    const card = target.closest('.breakpoint-card') as HTMLElement | null;
    const itemId = card?.dataset.item;
    const targetVal = card?.dataset.target;
    if (itemId && targetVal) {
        const parsedTarget = parseInt(targetVal, 10);
        if (!isNaN(parsedTarget)) {
            import('./calculator.ts')
                .then(({ quickCalc }) => quickCalc(itemId, parsedTarget))
                .catch(err =>
                    logger.warn({
                        operation: 'import.calculator',
                        error: { name: 'ImportError', message: err.message },
                    })
                );
        }
    }
}

/**
 * Handle favorite button click
 */
function handleFavoriteClick(target: Element): void {
    const btn = (
        target.classList.contains('favorite-btn') ? target : target.closest('.favorite-btn')
    ) as HTMLButtonElement | null;
    const tabName = btn?.dataset.tab as TabName | undefined;
    const itemId = btn?.dataset.id;

    const isEntityTab = (tab: TabName | undefined): tab is EntityType => {
        return tab === 'items' || tab === 'weapons' || tab === 'tomes' || tab === 'characters' || tab === 'shrines';
    };

    if (btn && tabName && isEntityTab(tabName) && itemId && typeof toggleFavorite === 'function') {
        const nowFavorited = toggleFavorite(tabName, itemId);
        btn.classList.toggle('favorited', nowFavorited);
        btn.textContent = nowFavorited ? '⭐' : '☆';
        btn.title = nowFavorited ? 'Remove from favorites' : 'Add to favorites';
        btn.setAttribute('aria-label', nowFavorited ? 'Remove from favorites' : 'Add to favorites');
        if (typeof ToastManager !== 'undefined') {
            ToastManager.success(nowFavorited ? 'Added to favorites' : 'Removed from favorites');
        }
    }
}

/**
 * Check if we're on mobile (≤480px)
 */
function isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 480px)').matches;
}

/**
 * Handle item card click (for mobile - whole card is tappable)
 * Bug fix: Use card's data attributes directly instead of looking for hidden view-details-btn
 */
function handleItemCardClick(target: Element): void {
    const card = target.closest('.item-card') as HTMLElement | null;
    if (!card) return;

    // Use card's data attributes (same as handleCardClick)
    const entityType = card.dataset.entityType as EntityType | undefined;
    const entityId = card.dataset.entityId;

    if (entityType && entityId) {
        const type = normalizeEntityType(entityType);
        if (type) openDetailModal(type, entityId);
    }
}

/**
 * Handle click events via delegation
 */
function handleClickDelegation(e: MouseEvent): void {
    const target = e.target;

    if (!(target instanceof Element)) {
        return;
    }

    if (target.classList.contains('view-details-btn')) {
        handleViewDetailsClick(target as HTMLElement);
        return;
    }

    // On mobile, make entire card tappable (but not if clicking specific elements)
    if (isMobileViewport() && target.closest('.item-card')) {
        // Don't trigger if clicking on interactive elements within the card
        const isInteractive = target.closest('.favorite-btn, .compare-checkbox-label, .expandable-text, a, button');
        if (!isInteractive) {
            handleItemCardClick(target);
            return;
        }
    }

    // Handle card click to open detail modal (but not if clicking interactive elements)
    if (
        target.closest('.item-card') &&
        !target.closest('.favorite-btn') &&
        !target.closest('.compare-checkbox-label') &&
        !target.closest('.expandable-text') &&
        !target.classList.contains('view-details-btn')
    ) {
        handleCardClick(target as HTMLElement);
        return;
    }

    if (target.closest('.compare-checkbox-label') && !target.classList.contains('compare-checkbox')) {
        handleCompareCheckboxClick(e, target);
        return;
    }

    if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
        const expandable = target.classList.contains('expandable-text')
            ? (target as HTMLElement)
            : (target.closest('.expandable-text') as HTMLElement | null);
        if (expandable) toggleTextExpand(expandable);
        return;
    }

    if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
        handleRemoveCompareClick(target);
        return;
    }

    if (target.classList.contains('btn-secondary') && target.textContent?.includes('Clear Filters')) {
        clearFilters();
        return;
    }

    if (target.classList.contains('changelog-expand-btn')) {
        import('./changelog.ts')
            .then(({ toggleChangelogExpand }) => toggleChangelogExpand(target as HTMLButtonElement))
            .catch(err =>
                logger.warn({ operation: 'import.changelog', error: { name: 'ImportError', message: err.message } })
            );
        return;
    }

    if (target.classList.contains('entity-link')) {
        e.preventDefault();
        const htmlTarget = target as HTMLElement;
        const rawType = htmlTarget.dataset.entityType;
        const id = htmlTarget.dataset.entityId;
        if (rawType && id) {
            const type = normalizeEntityType(rawType);
            if (type) openDetailModal(type, id);
        }
        return;
    }

    if (target.closest('.breakpoint-card')) {
        handleBreakpointCardClick(target);
        return;
    }

    if (target.classList.contains('favorite-btn') || target.closest('.favorite-btn')) {
        handleFavoriteClick(target);
        return;
    }

    if (target.closest('.search-result-card')) {
        handleSearchResultClick(target);
        return;
    }

    // Handle empty state action buttons and suggestion cards
    if (target.classList.contains('empty-state-action') || target.closest('.suggestion-card')) {
        import('./empty-states.ts')
            .then(({ handleEmptyStateClick }) => {
                handleEmptyStateClick(target);
            })
            .catch(err =>
                logger.warn({ operation: 'import.empty-states', error: { name: 'ImportError', message: err.message } })
            );
        return;
    }
}

// ========================================
// Change Event Handlers
// ========================================

/**
 * Handle change events via delegation
 */
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
                const tabName = btn.getAttribute('data-tab') as TabName | null;
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
    const tabContainer = document.querySelector('.tabs .container') as HTMLElement | null;
    const tabButtons = document.querySelector('.tab-buttons') as HTMLElement | null;

    if (!tabContainer || !tabButtons) return;

    cleanupTabScrollListeners();

    const updateTabScrollIndicators = (): void => {
        const canScrollLeft = tabButtons.scrollLeft > 5;
        const canScrollRight = tabButtons.scrollLeft < tabButtons.scrollWidth - tabButtons.clientWidth - 5;
        tabContainer.classList.toggle('can-scroll-left', canScrollLeft);
        tabContainer.classList.toggle('can-scroll-right', canScrollRight);
    };

    let scrollRAFPending = false;
    const throttledScrollHandler = (): void => {
        if (scrollRAFPending) return;
        scrollRAFPending = true;
        requestAnimationFrame(() => {
            updateTabScrollIndicators();
            scrollRAFPending = false;
        });
    };

    const debouncedResizeHandler = debounce(updateTabScrollIndicators, 100);

    tabButtons.addEventListener('scroll', throttledScrollHandler, getListenerOptions({ passive: true }));
    window.addEventListener('resize', debouncedResizeHandler, getListenerOptions());

    scrollListenerCleanup = () => tabButtons.removeEventListener('scroll', throttledScrollHandler);
    resizeListenerCleanup = () => window.removeEventListener('resize', debouncedResizeHandler);

    setTimeout(updateTabScrollIndicators, 100);
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
        const itemModal = safeGetElementById('itemModal') as HTMLElement | null;
        const compareModal = safeGetElementById('compareModal') as HTMLElement | null;

        if (itemModal && itemModal.classList.contains('active')) {
            const modalContent = itemModal.querySelector('.modal-content');
            if (target === itemModal || (itemModal.contains(target) && !modalContent?.contains(target))) {
                lastModalCloseTime = now;
                closeModal();
                return;
            }
        }

        if (compareModal && compareModal.classList.contains('active')) {
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
    const filters = safeGetElementById('filters') as HTMLElement | null;

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
    const controls = document.querySelector('.controls') as HTMLElement | null;
    if (!controls) return;

    // Only enable on mobile
    const isMobile = window.matchMedia('(max-width: 768px)');
    if (!isMobile.matches) return;

    let lastScrollY = window.scrollY;
    let ticking = false;
    const scrollThreshold = 10; // Minimum scroll to trigger hide/show

    const handleScroll = (): void => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            const scrollDelta = currentScrollY - lastScrollY;

            // Don't hide if we're at the top
            if (currentScrollY <= 0) {
                controls.classList.remove('controls-hidden');
            } else if (scrollDelta > scrollThreshold) {
                // Scrolling down - hide
                controls.classList.add('controls-hidden');
            } else if (scrollDelta < -scrollThreshold) {
                // Scrolling up - show
                controls.classList.remove('controls-hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    };

    window.addEventListener('scroll', handleScroll, getListenerOptions({ passive: true }));

    // Re-check on resize
    isMobile.addEventListener('change', e => {
        if (!e.matches) {
            controls.classList.remove('controls-hidden');
        }
    });
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
    const errorContainer = safeGetElementById('error-container') as HTMLElement | null;
    if (errorContainer) errorContainer.style.display = 'none';
}
