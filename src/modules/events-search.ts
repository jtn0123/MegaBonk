// ========================================
// Search Events Module
// Search functionality, filtering, and results navigation
// ========================================

import { safeGetElementById, debounce } from './utils.ts';
import { handleSearch } from './filters.ts';
import { showSearchHistoryDropdown } from './search-history.ts';
import type { TabName } from './store.ts';
import type { EntityType } from '../types/index.ts';
import { switchTab } from './events-tabs.ts';
import { openDetailModal } from './modal.ts';

/**
 * Clear highlight timeout (no-op, kept for backward compatibility)
 * Previously used for scroll-highlight behavior, now modal opens directly
 */
export function clearHighlightTimeout(): void {
    // No-op - highlight behavior replaced with modal
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
 * Handle search result card click to open detail modal
 * @param target - The clicked element
 */
export async function handleSearchResultClick(target: Element): Promise<void> {
    const card = target.closest('.search-result-card') as HTMLElement | null;
    const tabType = card?.dataset.tabType as TabName | undefined;
    const entityId = card?.dataset.entityId;

    if (!tabType || !entityId) return;

    // Switch to the correct tab so user is on the right tab when modal closes
    if (typeof switchTab === 'function') {
        await switchTab(tabType);
    }

    // Clear search input after opening modal
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    // Open the detail modal directly
    await openDetailModal(tabType as EntityType, entityId);
}
