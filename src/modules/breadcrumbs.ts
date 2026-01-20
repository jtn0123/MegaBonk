// ========================================
// Breadcrumbs Module
// ========================================
// Tracks user actions for debugging and error reporting
// Implements circular buffer of last N user actions
// ========================================

import { logger } from './logger.ts';
import { getState } from './store.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Breadcrumb action types
 */
export type BreadcrumbType =
    | 'tab_switch'
    | 'search'
    | 'filter_change'
    | 'item_click'
    | 'modal_open'
    | 'modal_close'
    | 'build_update'
    | 'compare_toggle'
    | 'favorite_toggle'
    | 'navigation'
    | 'keyboard_shortcut'
    | 'error'
    | 'custom';

/**
 * Breadcrumb entry
 */
export interface Breadcrumb {
    type: BreadcrumbType;
    timestamp: number;
    message: string;
    data?: Record<string, unknown>;
    category?: string;
}

/**
 * Breadcrumb configuration
 */
export interface BreadcrumbConfig {
    maxBreadcrumbs: number;
    enableAutoCapture: boolean;
    enableConsoleLog: boolean;
}

// ========================================
// State
// ========================================

const DEFAULT_MAX_BREADCRUMBS = 50;
let breadcrumbs: Breadcrumb[] = [];
let config: BreadcrumbConfig = {
    maxBreadcrumbs: DEFAULT_MAX_BREADCRUMBS,
    enableAutoCapture: true,
    enableConsoleLog: false,
};

// ========================================
// Core Functions
// ========================================

/**
 * Configure breadcrumbs system
 * @param newConfig - Partial configuration to apply
 */
export function configureBreadcrumbs(newConfig: Partial<BreadcrumbConfig>): void {
    config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 * @returns Current breadcrumb configuration
 */
export function getBreadcrumbConfig(): BreadcrumbConfig {
    return { ...config };
}

/**
 * Add a breadcrumb to the trail
 * @param breadcrumb - Breadcrumb to add
 */
export function addBreadcrumb(
    type: BreadcrumbType,
    message: string,
    data?: Record<string, unknown>,
    category?: string
): void {
    const breadcrumb: Breadcrumb = {
        type,
        timestamp: Date.now(),
        message,
        data,
        category,
    };

    // Add to circular buffer
    breadcrumbs.push(breadcrumb);

    // Maintain max size
    if (breadcrumbs.length > config.maxBreadcrumbs) {
        breadcrumbs = breadcrumbs.slice(-config.maxBreadcrumbs);
    }

    // Log if enabled
    if (config.enableConsoleLog) {
        console.debug('[Breadcrumb]', type, message, data);
    }
}

/**
 * Get all breadcrumbs (copy)
 * @returns Array of breadcrumbs
 */
export function getBreadcrumbs(): Breadcrumb[] {
    return [...breadcrumbs];
}

/**
 * Get breadcrumbs for a specific time range
 * @param sinceMs - Milliseconds ago to start from
 * @returns Filtered breadcrumbs
 */
export function getRecentBreadcrumbs(sinceMs: number = 60000): Breadcrumb[] {
    const cutoff = Date.now() - sinceMs;
    return breadcrumbs.filter(b => b.timestamp >= cutoff);
}

/**
 * Clear all breadcrumbs
 */
export function clearBreadcrumbs(): void {
    breadcrumbs = [];
}

/**
 * Export breadcrumbs as JSON string
 * @returns JSON string of breadcrumbs
 */
export function exportBreadcrumbs(): string {
    return JSON.stringify(
        {
            exported: Date.now(),
            count: breadcrumbs.length,
            breadcrumbs: breadcrumbs,
        },
        null,
        2
    );
}

// ========================================
// Auto-Capture Helpers
// ========================================

/**
 * Record a tab switch
 * @param fromTab - Previous tab
 * @param toTab - New tab
 */
export function recordTabSwitch(fromTab: string, toTab: string): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('tab_switch', `Switched from ${fromTab} to ${toTab}`, { fromTab, toTab }, 'navigation');
}

/**
 * Record a search action
 * @param query - Search query
 * @param resultCount - Number of results
 */
export function recordSearch(query: string, resultCount?: number): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('search', `Searched: "${query}"`, { query, resultCount }, 'filter');
}

/**
 * Record a filter change
 * @param filterName - Filter that changed
 * @param value - New value
 */
export function recordFilterChange(filterName: string, value: unknown): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('filter_change', `Filter ${filterName} changed to ${value}`, { filterName, value }, 'filter');
}

/**
 * Record an item click/selection
 * @param itemId - Item ID
 * @param itemName - Item name
 * @param action - Type of action
 */
export function recordItemClick(itemId: string, itemName: string, action: string = 'clicked'): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('item_click', `Item ${action}: ${itemName}`, { itemId, itemName, action }, 'interaction');
}

/**
 * Record a modal opening
 * @param modalType - Type of modal
 * @param entityId - Related entity ID
 */
export function recordModalOpen(modalType: string, entityId?: string): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('modal_open', `Opened ${modalType} modal`, { modalType, entityId }, 'ui');
}

/**
 * Record a modal closing
 * @param modalType - Type of modal
 */
export function recordModalClose(modalType: string): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('modal_close', `Closed ${modalType} modal`, { modalType }, 'ui');
}

/**
 * Record a build update
 * @param action - Build action type
 * @param details - Additional details
 */
export function recordBuildUpdate(action: string, details?: Record<string, unknown>): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('build_update', `Build ${action}`, details, 'build');
}

/**
 * Record a compare toggle
 * @param itemId - Item ID
 * @param added - Whether item was added or removed
 */
export function recordCompareToggle(itemId: string, added: boolean): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb(
        'compare_toggle',
        `${added ? 'Added to' : 'Removed from'} compare: ${itemId}`,
        { itemId, added },
        'compare'
    );
}

/**
 * Record a favorite toggle
 * @param entityId - Entity ID
 * @param entityType - Type of entity
 * @param favorited - Whether favorited or unfavorited
 */
export function recordFavoriteToggle(entityId: string, entityType: string, favorited: boolean): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb(
        'favorite_toggle',
        `${favorited ? 'Favorited' : 'Unfavorited'} ${entityType}: ${entityId}`,
        { entityId, entityType, favorited },
        'favorite'
    );
}

/**
 * Record a keyboard shortcut
 * @param shortcut - Shortcut pressed
 * @param action - Action triggered
 */
export function recordKeyboardShortcut(shortcut: string, action: string): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('keyboard_shortcut', `Keyboard: ${shortcut} → ${action}`, { shortcut, action }, 'keyboard');
}

/**
 * Record an error
 * @param error - Error object
 * @param context - Additional context
 */
export function recordError(error: Error, context?: string): void {
    // Always record errors regardless of enableAutoCapture
    addBreadcrumb(
        'error',
        `Error: ${error.message}`,
        {
            name: error.name,
            message: error.message,
            stack: error.stack,
            context,
        },
        'error'
    );
}

/**
 * Record a custom breadcrumb
 * @param message - Custom message
 * @param data - Additional data
 * @param category - Category
 */
export function recordCustom(message: string, data?: Record<string, unknown>, category?: string): void {
    if (!config.enableAutoCapture) return;

    addBreadcrumb('custom', message, data, category);
}

// ========================================
// State Snapshot
// ========================================

/**
 * Capture current application state snapshot
 * Used for error reporting
 * @returns State snapshot with sensitive data redacted
 */
export function captureStateSnapshot(): Record<string, unknown> {
    try {
        const currentTab = getState('currentTab');
        const filteredData = getState('filteredData');
        const currentBuild = getState('currentBuild');
        const compareItems = getState('compareItems');

        return {
            timestamp: Date.now(),
            currentTab,
            filteredDataCount: filteredData?.length ?? 0,
            currentBuild: currentBuild
                ? {
                      hasCharacter: !!currentBuild.character,
                      hasWeapon: !!currentBuild.weapon,
                      tomesCount: currentBuild.tomes?.length ?? 0,
                      itemsCount: currentBuild.items?.length ?? 0,
                  }
                : null,
            compareItemsCount: compareItems?.length ?? 0,
            windowSize: {
                width: typeof window !== 'undefined' ? window.innerWidth : 0,
                height: typeof window !== 'undefined' ? window.innerHeight : 0,
            },
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            online: typeof navigator !== 'undefined' ? navigator.onLine : true,
            url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        };
    } catch (error) {
        return {
            timestamp: Date.now(),
            error: 'Failed to capture state snapshot',
            message: (error as Error).message,
        };
    }
}

// ========================================
// Error Report Builder
// ========================================

/**
 * Build comprehensive error report with breadcrumbs and state
 * @param error - The error that occurred
 * @param context - Additional context
 * @returns Error report object
 */
export function buildErrorReport(error: Error, context?: string): Record<string, unknown> {
    // Record the error as a breadcrumb
    recordError(error, context);

    return {
        timestamp: Date.now(),
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        context,
        stateSnapshot: captureStateSnapshot(),
        breadcrumbs: getRecentBreadcrumbs(300000), // Last 5 minutes
        sessionId: logger.getSessionId(),
    };
}

// ========================================
// Integration Helpers
// ========================================

/**
 * Initialize breadcrumbs with error boundary integration
 */
export function initBreadcrumbs(): void {
    logger.info({
        operation: 'breadcrumbs.init',
        data: { maxBreadcrumbs: config.maxBreadcrumbs },
    });
}

/**
 * Cleanup breadcrumbs
 */
export function cleanupBreadcrumbs(): void {
    clearBreadcrumbs();
}
