// ========================================
// MegaBonk Events Module
// Event delegation to replace inline handlers
// ========================================

import { ToastManager } from './toast.ts';
import { safeGetElementById, debounce, escapeHtml } from './utils.ts';
import { logger } from './logger.ts';
import { loadAllData } from './data-service.ts';
import { closeModal, openDetailModal } from './modal.ts';
// All tab-specific modules are lazy-loaded via dynamic imports for code splitting:
// - calculator.ts (quickCalc)
// - build-planner.ts (setupBuildPlannerEvents, updateBuildAnalysis)
// - changelog.ts (toggleChangelogExpand)
import { toggleFavorite } from './favorites.ts';
import { clearFilters, handleSearch, updateFilters, restoreFilterState, saveFilterState } from './filters.ts';
import { showSearchHistoryDropdown } from './search-history.ts';
// Charts module loaded on demand during tab switch
import { renderTabContent } from './renderers.ts';
import { getState, setState, type TabName } from './store.ts';
import { registerFunction } from './registry.ts';
import { showTabSkeleton } from './skeleton-loader.ts';
import { loadTabModules, preloadCommonModules } from './tab-loader.ts';

import type { EntityType } from '../types/index.ts';

// LocalStorage key for persisting tab selection
const TAB_STORAGE_KEY = 'megabonk-current-tab';

// Valid tab names for validation
const VALID_TABS: TabName[] = [
    'items',
    'weapons',
    'tomes',
    'characters',
    'shrines',
    'build-planner',
    'calculator',
    'advisor',
    'changelog',
];

// ========================================
// Memory Management: AbortController for event cleanup
// ========================================
// This prevents memory leaks from accumulated event listeners
let eventAbortController: AbortController | null = null;

// Track active highlight timeouts for cleanup
let activeHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

// Track tab switch timing to prevent rapid switching issues
let lastTabSwitchTime = 0;
const TAB_SWITCH_DEBOUNCE_MS = 100; // Minimum time between tab switches

// Track scroll/resize listener cleanup functions to prevent memory leaks
let scrollListenerCleanup: (() => void) | null = null;
let resizeListenerCleanup: (() => void) | null = null;

// Track modal close timing to prevent double-handling from click+touchend events
// Module-scoped to persist across setupEventListeners() calls
let lastModalCloseTime = 0;
const MODAL_CLOSE_DEBOUNCE_MS = 300;

/**
 * Reset internal timers for testing purposes
 * @internal
 */
export function __resetTimersForTesting(): void {
    lastTabSwitchTime = 0;
    lastModalCloseTime = 0;
}

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
    // Clean up any pending highlight timeouts
    if (activeHighlightTimeout !== null) {
        clearTimeout(activeHighlightTimeout);
        activeHighlightTimeout = null;
    }

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
                // Dynamic import for code splitting with graceful fallback
                import('./compare.ts')
                    .then(({ closeCompareModal }) => {
                        closeCompareModal();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        });
                        // Bug fix: Fallback to hide compare modal via DOM if module fails to load
                        const compareModal = safeGetElementById('compareModal') as HTMLElement | null;
                        if (compareModal) {
                            compareModal.style.display = 'none';
                            compareModal.classList.remove('active');
                        }
                    });
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

            // Arrow key navigation for tabs (W3C WAI-ARIA recommendation)
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const target = e.target as HTMLElement;
                // Only handle when focus is on a tab button
                if (target.classList.contains('tab-btn')) {
                    e.preventDefault();
                    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
                    const currentIndex = tabButtons.indexOf(target as HTMLButtonElement);

                    let nextIndex: number;
                    if (e.key === 'ArrowRight') {
                        nextIndex = (currentIndex + 1) % tabButtons.length;
                    } else {
                        nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
                    }

                    const nextTab = tabButtons[nextIndex];
                    if (nextTab) {
                        nextTab.focus();
                        const tabName = nextTab.getAttribute('data-tab') as TabName | null;
                        if (tabName && typeof switchTab === 'function') {
                            switchTab(tabName);
                        }
                    }
                    return;
                }
            }

            // Number keys (1-9) to switch tabs
            if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
                    8: 'advisor',
                    9: 'changelog',
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
                            // Dynamic import for code splitting
                            import('./calculator.ts')
                                .then(({ quickCalc }) => {
                                    quickCalc(itemId, parsedTarget);
                                })
                                .catch(err => {
                                    logger.warn({
                                        operation: 'import.calculator',
                                        error: { name: 'ImportError', message: err.message },
                                    });
                                });
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
            const target = e.target;

            // Bug fix: Type guard to ensure target is an Element before accessing classList
            // e.target could be Text node, Document, or other non-Element types
            if (!(target instanceof Element)) {
                return;
            }

            // View Details button
            if (target.classList.contains('view-details-btn')) {
                const htmlTarget = target as HTMLElement;
                const type = htmlTarget.dataset.type as EntityType | undefined;
                const id = htmlTarget.dataset.id;
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
                        // Dynamic import for code splitting
                        import('./compare.ts')
                            .then(({ toggleCompareItem }) => {
                                toggleCompareItem(id);
                            })
                            .catch(err => {
                                logger.warn({
                                    operation: 'import.compare',
                                    error: { name: 'ImportError', message: err.message },
                                });
                            });
                    }
                }
                return;
            }

            // Expandable text
            if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
                const expandable = target.classList.contains('expandable-text')
                    ? (target as HTMLElement)
                    : (target.closest('.expandable-text') as HTMLElement | null);
                if (expandable) {
                    toggleTextExpand(expandable);
                }
                return;
            }

            // Remove from comparison button
            if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
                const btn = target.classList.contains('remove-compare-btn')
                    ? (target as HTMLElement)
                    : (target.closest('.remove-compare-btn') as HTMLElement | null);
                const id = btn?.dataset.removeId;
                if (id) {
                    // Dynamic import for code splitting
                    import('./compare.ts')
                        .then(({ toggleCompareItem, updateCompareDisplay }) => {
                            toggleCompareItem(id);
                            updateCompareDisplay();
                        })
                        .catch(err => {
                            logger.warn({
                                operation: 'import.compare',
                                error: { name: 'ImportError', message: err.message },
                            });
                        });
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
                // Dynamic import for code splitting
                import('./changelog.ts')
                    .then(({ toggleChangelogExpand }) => {
                        toggleChangelogExpand(target as HTMLButtonElement);
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.changelog',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
                return;
            }

            // Entity link in changelog (deep linking)
            if (target.classList.contains('entity-link')) {
                e.preventDefault();
                const htmlTarget = target as HTMLElement;
                const type = htmlTarget.dataset.entityType as EntityType | undefined;
                const id = htmlTarget.dataset.entityId;
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
                        // Dynamic import for code splitting
                        import('./calculator.ts')
                            .then(({ quickCalc }) => {
                                quickCalc(itemId, parsedTarget);
                            })
                            .catch(err => {
                                logger.warn({
                                    operation: 'import.calculator',
                                    error: { name: 'ImportError', message: err.message },
                                });
                            });
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

            // Global search result card click - navigate to item
            if (target.closest('.search-result-card')) {
                const card = target.closest('.search-result-card') as HTMLElement | null;
                const tabType = card?.dataset.tabType as TabName | undefined;
                const entityId = card?.dataset.entityId;

                if (tabType && entityId) {
                    // Clear search and switch to the appropriate tab
                    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
                    if (searchInput) {
                        searchInput.value = '';
                    }

                    // Switch to the target tab
                    if (typeof switchTab === 'function') {
                        switchTab(tabType);
                    }

                    // Clear any existing highlight timeout to prevent accumulation
                    if (activeHighlightTimeout !== null) {
                        clearTimeout(activeHighlightTimeout);
                        activeHighlightTimeout = null;
                        // Remove highlight from any previously highlighted card
                        const prevHighlighted = document.querySelector('.search-highlight');
                        if (prevHighlighted) {
                            prevHighlighted.classList.remove('search-highlight');
                        }
                    }

                    // After tab switch, scroll to and highlight the item
                    requestAnimationFrame(() => {
                        const itemCard = document.querySelector(`[data-entity-id="${entityId}"]`) as HTMLElement | null;
                        if (itemCard) {
                            // Scroll into view with smooth behavior
                            itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            // Add highlight animation with tracked timeout
                            itemCard.classList.add('search-highlight');
                            activeHighlightTimeout = setTimeout(() => {
                                itemCard.classList.remove('search-highlight');
                                activeHighlightTimeout = null;
                            }, 2000);
                        }
                    });
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
                // Dynamic import for code splitting
                import('./build-planner.ts')
                    .then(({ updateBuildAnalysis }) => {
                        updateBuildAnalysis();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.build-planner',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
                return;
            }

            // Item checkbox in build planner
            if (target.classList.contains('item-checkbox')) {
                // Dynamic import for code splitting
                import('./build-planner.ts')
                    .then(({ updateBuildAnalysis }) => {
                        updateBuildAnalysis();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.build-planner',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
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

    // Cleanup event listeners on page unload to prevent memory leaks
    // Using 'pagehide' instead of 'beforeunload' for better compatibility with bfcache
    window.addEventListener(
        'pagehide',
        () => {
            cleanupEventListeners();
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
        // Clean up any existing scroll/resize listeners before adding new ones
        cleanupTabScrollListeners();

        const updateTabScrollIndicators = (): void => {
            const canScrollLeft = tabButtons.scrollLeft > 5;
            const canScrollRight = tabButtons.scrollLeft < tabButtons.scrollWidth - tabButtons.clientWidth - 5;

            tabContainer.classList.toggle('can-scroll-left', canScrollLeft);
            tabContainer.classList.toggle('can-scroll-right', canScrollRight);
        };

        // Use requestAnimationFrame throttling for scroll events to prevent jank
        // This ensures we only update once per frame, not on every scroll pixel
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

        // Store cleanup functions to prevent memory leaks
        scrollListenerCleanup = () => tabButtons.removeEventListener('scroll', throttledScrollHandler);
        resizeListenerCleanup = () => window.removeEventListener('resize', debouncedResizeHandler);

        // Initial check after a short delay to ensure layout is complete
        setTimeout(updateTabScrollIndicators, 100);
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
                    showSearchHistoryDropdown(searchInput, handleSearch);
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
                // Dynamic import for code splitting
                import('./compare.ts')
                    .then(({ closeCompareModal }) => {
                        closeCompareModal();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
            },
            getListenerOptions()
        );
    }

    // Click/touch outside modal to close - handle backdrop clicks
    // Check if click is inside modal but outside modal-content (the backdrop area)
    // Uses module-scoped lastModalCloseTime to prevent double-handling
    const handleModalBackdropInteraction = (e: MouseEvent | TouchEvent): void => {
        // Prevent double-handling: on mobile, both touchend and click can fire for same tap
        const now = Date.now();
        if (now - lastModalCloseTime < MODAL_CLOSE_DEBOUNCE_MS) {
            return;
        }

        const target = e.target as HTMLElement;
        const itemModal = safeGetElementById('itemModal') as HTMLElement | null;
        const compareModal = safeGetElementById('compareModal') as HTMLElement | null;

        // Close item modal if clicking on backdrop (modal element but not modal-content)
        if (itemModal && itemModal.classList.contains('active')) {
            const modalContent = itemModal.querySelector('.modal-content');
            if (target === itemModal || (itemModal.contains(target) && !modalContent?.contains(target))) {
                lastModalCloseTime = now;
                closeModal();
                return; // Don't check compare modal if we just closed item modal
            }
        }

        // Close compare modal if clicking on backdrop
        if (compareModal && compareModal.classList.contains('active')) {
            const modalContent = compareModal.querySelector('.modal-content');
            if (target === compareModal || (compareModal.contains(target) && !modalContent?.contains(target))) {
                lastModalCloseTime = now;
                // Dynamic import for code splitting
                import('./compare.ts')
                    .then(({ closeCompareModal }) => {
                        closeCompareModal();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
            }
        }
    };

    // Handle both click and touch events for desktop/mobile compatibility
    window.addEventListener('click', handleModalBackdropInteraction, getListenerOptions());
    window.addEventListener('touchend', handleModalBackdropInteraction, getListenerOptions());

    // Compare button
    const compareBtn = safeGetElementById('compare-btn') as HTMLButtonElement | null;
    if (compareBtn) {
        compareBtn.addEventListener(
            'click',
            () => {
                // Dynamic import for code splitting
                import('./compare.ts')
                    .then(({ openCompareModal }) => {
                        openCompareModal();
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'import.compare',
                            error: { name: 'ImportError', message: err.message },
                        });
                    });
            },
            getListenerOptions()
        );
    }

    // Build planner events are set up lazily when the tab is first accessed
    // This is handled by the tab-loader and build-planner module initialization

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
    // Use data attribute to prevent double-attachment of listeners
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
 * Loads tab-specific modules lazily for better initial load performance
 * @param {string} tabName - Tab name to switch to
 */
export async function switchTab(tabName: TabName): Promise<void> {
    // Runtime validation for tab names to catch invalid calls early
    if (!VALID_TABS.includes(tabName)) {
        logger.warn({
            operation: 'tab.switch',
            error: { name: 'InvalidTabError', message: `Invalid tab name: ${tabName}` },
        });
        return;
    }

    // Debounce rapid tab switching to prevent performance issues
    const now = Date.now();
    if (now - lastTabSwitchTime < TAB_SWITCH_DEBOUNCE_MS) {
        return; // Ignore rapid successive tab switches
    }
    lastTabSwitchTime = now;

    const previousTab = getState('currentTab');

    // Don't switch if already on the same tab, UNLESS it's the initial render
    // Check if content has been rendered by looking for item cards in the container
    const isInitialRender =
        !document.querySelector('#itemsContainer .item-card') &&
        !document.querySelector('#weaponsContainer .item-card') &&
        !document.querySelector('#tomesContainer .item-card');
    if (previousTab === tabName && !isInitialRender) {
        return;
    }

    // Save current tab's filter state before switching
    if (previousTab && typeof saveFilterState === 'function') {
        saveFilterState(previousTab);
    }

    // Destroy existing charts before switching tabs (if charts module was loaded)
    try {
        const { destroyAllCharts } = await import('./charts.ts');
        destroyAllCharts();
    } catch {
        // Charts module may not be loaded yet, that's fine
    }

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

    // Show skeleton loading state before rendering (improves perceived performance)
    showTabSkeleton(tabName);

    // Lazy load tab-specific modules before rendering
    try {
        await loadTabModules(tabName);
    } catch (error) {
        logger.error({
            operation: 'tab.module_load_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'events',
            },
            data: { tabName },
        });
        // Continue with render attempt anyway - core functionality may still work
    }

    // Render content for the tab (will replace skeleton with actual content)
    await renderTabContent(tabName);
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
// Registry & Global Assignments
// ========================================
// Register switchTab for type-safe cross-module access
registerFunction('switchTab', switchTab);
// Keep window assignment for backwards compatibility during migration
if (typeof window !== 'undefined') {
    // Type assertion: switchTab accepts TabName but window type uses string for flexibility
    window.switchTab = switchTab as typeof window.switchTab;
}

// ========================================
// Exported API
// ========================================
// All functions and currentTab variable are exported above
