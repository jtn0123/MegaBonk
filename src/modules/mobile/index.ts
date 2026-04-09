// ========================================
// Mobile Module Barrel
// ========================================
// Re-exports all mobile-specific functionality

export { initMobileNav, hideMoreMenu, showMoreMenu, toggleMoreMenu } from './mobile-nav.ts';

export {
    showFilterSheet,
    hideFilterSheet,
    toggleFilterSheet,
    updateFilterBadge,
    initMobileFilters,
} from './mobile-filters.ts';

export { PULL_REFRESH_CONFIG, initPullRefresh, cleanupPullRefresh } from './pull-refresh.ts';

export type { FilterConfig } from './mobile-filter-sheet.ts';
export {
    createFilterSheet,
    renderFilterGroups,
    setupSheetEventListeners,
    handleKeyboardNavigation,
    handleFocusTrap,
} from './mobile-filter-sheet.ts';

export {
    syncFiltersToSheet,
    applyFiltersFromSheet,
    clearSheetFilters,
    countActiveFilters,
} from './mobile-filter-logic.ts';
