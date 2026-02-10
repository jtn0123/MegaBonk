// ========================================
// MegaBonk Offline UI Module
// ========================================
// Handles offline UI indicators and cached data display

import { safeGetElementById, escapeHtml } from './utils.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';

// ========================================
// Constants
// ========================================

const LAST_SYNC_KEY = 'megabonk_last_sync';
const OFFLINE_INDICATOR_ID = 'offline-indicator';

// ========================================
// Sync Time Tracking
// ========================================

/**
 * Record the last successful data sync time
 */
export function recordDataSync(): void {
    try {
        const timestamp = Date.now();
        localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
        logger.debug({
            operation: 'offline.sync_recorded',
            data: { timestamp },
        });
    } catch (error) {
        // Silently fail if localStorage is unavailable
        logger.debug({
            operation: 'offline.sync_record_failed',
            error: { message: (error as Error).message, name: 'StorageError', module: 'offline-ui' },
        });
    }
}

/**
 * Get the last sync timestamp
 * @returns Timestamp in milliseconds or null if never synced
 */
export function getLastSyncTime(): number | null {
    try {
        const stored = localStorage.getItem(LAST_SYNC_KEY);
        return stored ? parseInt(stored, 10) : null;
    } catch {
        return null;
    }
}

/**
 * Format a timestamp as a relative time string
 * @param timestamp - Timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return days === 1 ? '1 day ago' : `${days} days ago`;
    }
    if (hours > 0) {
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    if (minutes > 0) {
        return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    }
    return 'just now';
}

// ========================================
// Offline UI Management
// ========================================

/**
 * Create the offline indicator element
 * @returns The created indicator element
 */
export function createOfflineIndicator(): HTMLElement {
    const existing = safeGetElementById(OFFLINE_INDICATOR_ID);
    if (existing) {
        return existing;
    }

    const indicator = document.createElement('div');
    indicator.id = OFFLINE_INDICATOR_ID;
    indicator.className = 'offline-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    indicator.style.display = 'none';
    document.body.prepend(indicator);

    return indicator;
}

/**
 * Update the offline indicator content and visibility
 * @param isOffline - Whether the app is currently offline
 */
export function updateOfflineIndicator(isOffline: boolean): void {
    const indicator = safeGetElementById(OFFLINE_INDICATOR_ID);
    if (!indicator) return;

    if (isOffline) {
        const lastSync = getLastSyncTime();
        let message = "You're offline - using cached data";

        if (lastSync) {
            const relativeTime = formatRelativeTime(lastSync);
            message = `You're offline - using data from ${relativeTime}`;
        }

        indicator.innerHTML = `
            <span class="offline-icon">📡</span>
            <span class="offline-message">${escapeHtml(message)}</span>
            <button class="offline-retry-btn" aria-label="Retry connection">Retry</button>
        `;

        // Add retry button handler
        const retryBtn = indicator.querySelector('.offline-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (navigator.onLine) {
                    updateOfflineIndicator(false);
                    ToastManager.success('Back online!');
                    // Optionally reload data
                    if (typeof window.loadAllData === 'function') {
                        window.loadAllData();
                    }
                } else {
                    ToastManager.info('Still offline. Please check your connection.');
                }
            });
        }

        indicator.style.display = 'flex';
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Cleanup function returned by setupOfflineListeners
 */
let offlineListenersCleanup: (() => void) | null = null;

/**
 * Remove offline event listeners to prevent memory leaks
 */
export function cleanupOfflineListeners(): void {
    if (offlineListenersCleanup) {
        offlineListenersCleanup();
        offlineListenersCleanup = null;
    }
}

/**
 * Setup offline event listeners
 */
export function setupOfflineListeners(): void {
    // Clean up any previous listeners first
    cleanupOfflineListeners();

    // Ensure the indicator element exists
    createOfflineIndicator();

    const handleOnline = (): void => {
        updateOfflineIndicator(false);
        logger.info({
            operation: 'app.online',
            data: { previousState: 'offline' },
        });
        // DISABLED: "Back online" toast notification hidden
        // ToastManager.success('Back online!');
        recordDataSync();
    };

    const handleOffline = (): void => {
        updateOfflineIndicator(true);
        logger.info({
            operation: 'app.offline',
            data: { previousState: 'online' },
        });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    offlineListenersCleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };

    // Initial state check
    if (!navigator.onLine) {
        updateOfflineIndicator(true);
    }
}

// ========================================
// Global Scope Exports (backwards compatibility)
// ========================================

if (typeof window !== 'undefined') {
    Object.assign(window, {
        recordDataSync,
        getLastSyncTime,
        updateOfflineIndicator,
    });
}
