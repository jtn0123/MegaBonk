// ========================================
// Search Events Module
// Search functionality, filtering, and results navigation
// ========================================

import { safeGetElementById, debounce } from './utils.ts';
import { handleSearch } from './filters.ts';
import { showSearchHistoryDropdown } from './search-history.ts';
import type { TabName } from './store.ts';
import { switchTab } from './events-tabs.ts';

// Track active highlight timeouts for cleanup
let activeHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear highlight timeout (exported for cleanup)
 */
export function clearHighlightTimeout(): void {
    if (activeHighlightTimeout !== null) {
        clearTimeout(activeHighlightTimeout);
        activeHighlightTimeout = null;
    }
}

/**
 * Get event listener options with optional signal
 * Imported function type for compatibility
 */
type GetListenerOptionsFn = (options?: { passive?: boolean }) => AddEventListenerOptions | undefined;

/**
 * Setup search input listeners
 * @param getListenerOptions - Function to get listener options with AbortSignal
 */
export function setupSearchListeners(getListenerOptions: GetListenerOptionsFn): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce(handleSearch, 300), getListenerOptions());

    searchInput.addEventListener(
        'focus',
        () => {
            const currentQuery = searchInput.value.trim();
            if (currentQuery.length >= 2) {
                handleSearch();
            } else if (typeof showSearchHistoryDropdown === 'function') {
                showSearchHistoryDropdown(searchInput, handleSearch);
            }
        },
        getListenerOptions()
    );
}

/**
 * Handle search result card click to navigate to item
 * @param target - The clicked element
 */
export function handleSearchResultClick(target: Element): void {
    const card = target.closest('.search-result-card') as HTMLElement | null;
    const tabType = card?.dataset.tabType as TabName | undefined;
    const entityId = card?.dataset.entityId;

    if (!tabType || !entityId) return;

    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    if (typeof switchTab === 'function') switchTab(tabType);

    // Clear existing highlight timeout
    clearHighlightTimeout();
    const prevHighlighted = document.querySelector('.search-highlight');
    if (prevHighlighted) prevHighlighted.classList.remove('search-highlight');

    // Scroll to and highlight the item
    requestAnimationFrame(() => {
        const itemCard = document.querySelector(`[data-entity-id="${entityId}"]`) as HTMLElement | null;
        if (itemCard) {
            itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            itemCard.classList.add('search-highlight');
            activeHighlightTimeout = setTimeout(() => {
                itemCard.classList.remove('search-highlight');
                activeHighlightTimeout = null;
            }, 2000);
        }
    });
}
