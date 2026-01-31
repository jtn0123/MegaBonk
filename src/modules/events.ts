// ========================================
// MegaBonk Events Module
// Entry point - orchestrates and re-exports event modules
// ========================================

// Import for combined reset
import { __resetTimersForTesting as resetTabTimers } from './events-tabs.ts';
import { __resetModalTimerForTesting as resetModalTimer } from './events-core.ts';

/**
 * Reset all internal timers for testing purposes
 * @internal
 */
export function __resetTimersForTesting(): void {
    resetTabTimers();
    resetModalTimer();
}

// Re-export tab management
export {
    currentTab,
    getCurrentTab,
    switchTab,
    getSavedTab,
    scheduleModulePreload,
    VALID_TABS,
} from './events-tabs.ts';

// Re-export search functionality
export {
    handleSearchResultClick,
    clearHighlightTimeout,
    setupSearchListeners,
} from './events-search.ts';

// Re-export core event infrastructure
export {
    // Cleanup
    cleanupEventListeners,
    cleanupTabScrollListeners,
    
    // Setup functions
    setupEventListeners,
    setupEventDelegation,
    setupTabButtonListeners,
    setupTabScrollIndicators,
    setupModalListeners,
    setupCompareButtonListener,
    setupFilterToggle,
    
    // UI helpers
    toggleTextExpand,
    
    // Loading/Error UI
    showLoading,
    hideLoading,
    showErrorMessage,
    dismissError,
    
    // Internal (for testing)
    __resetModalTimerForTesting,
    getListenerOptions,
} from './events-core.ts';
