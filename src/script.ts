// ========================================
// MegaBonk Complete Guide - Main Script
// ========================================
// This file serves as the entry point and initializes all modules.
// Uses ES6 modules for better code organization and tree-shaking.
// ========================================

// ========================================
// ES Module Imports
// ========================================

// Core utilities
import { ToastManager } from './modules/toast.ts';
import { loadAllData } from './modules/data-service.ts';
import { loadFavorites } from './modules/favorites.ts';
import { setupEventListeners, setupEventDelegation } from './modules/events.ts';
import { domCache } from './modules/dom-cache.ts';
import { safeModuleInit, registerErrorBoundary } from './modules/error-boundary.ts';
import { setupKeyboardShortcuts } from './modules/keyboard-shortcuts.ts';
import { themeManager } from './modules/theme-manager.ts';
import { initWebVitals, createPerformanceBadge } from './modules/web-vitals.ts';
import { setupImageFallbackHandler } from './modules/utils.ts';
import type { Entity } from './types/index.ts';
import { logger } from './modules/logger.ts';

// ========================================
// Global State (to be refactored into state module)
// ========================================

let filteredData: Entity[] = [];

// Export filteredData for module access
export { filteredData };

/**
 * Setup global error tracking
 */
function setupErrorTracking(): void {
    // Catch uncaught JavaScript errors
    window.onerror = (message, source, lineno, colno, error) => {
        const err = error as Error | undefined;
        logger.error({
            operation: 'error.unhandled',
            error: {
                name: err?.name || 'Error',
                message: String(message),
                stack: err?.stack,
                module: 'global',
            },
            data: {
                source,
                line: lineno,
                column: colno,
            },
        });

        // Show user-friendly error message
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Something went wrong. The error has been logged.');
        }

        // Return false to let browser handle error as well
        return false;
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        logger.error({
            operation: 'error.promise',
            error: {
                name: reason?.name || 'UnhandledRejection',
                message: reason?.message || String(reason),
                stack: reason?.stack,
                module: 'global',
            },
        });

        // Show user-friendly error message
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('An error occurred. Please try again.');
        }

        // Prevent default browser error handling
        event.preventDefault();
    });
}

/**
 * Setup offline/online indicator
 */
function setupOfflineIndicator(): void {
    // Create offline indicator
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className = 'offline-indicator';
    indicator.innerHTML = "📡 You're offline - using cached data";
    indicator.style.display = 'none';
    document.body.prepend(indicator);

    // Update indicator based on connection status
    const updateConnectionStatus = () => {
        if (!navigator.onLine) {
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    };

    // Listen for online/offline events
    window.addEventListener('online', () => {
        indicator.style.display = 'none';
        logger.info({
            operation: 'app.online',
            data: { previousState: 'offline' },
        });
        if (typeof ToastManager !== 'undefined') {
            ToastManager.success('Back online!');
        }
    });

    window.addEventListener('offline', () => {
        indicator.style.display = 'block';
        logger.info({
            operation: 'app.offline',
            data: { previousState: 'online' },
        });
        if (typeof ToastManager !== 'undefined') {
            ToastManager.info("You're offline - using cached data");
        }
    });

    // Initial check
    updateConnectionStatus();
}

// Track update interval ID for cleanup
let updateIntervalId: number | null = null;

/**
 * Setup service worker update notification
 * Note: Service worker is registered by VitePWA plugin
 */
function setupUpdateNotification(): void {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
        return;
    }

    // Wait for service worker to be ready (VitePWA handles registration)
    navigator.serviceWorker.ready
        .then((registration: ServiceWorkerRegistration) => {
            // Check for updates periodically (every hour)
            updateIntervalId = window.setInterval(
                () => {
                    registration.update();
                },
                60 * 60 * 1000
            );

            // Listen for waiting service worker (new version available)
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    // New service worker is waiting to activate
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Show update notification
                        showUpdateNotification(registration);
                    }
                });
            });
        })
        .catch((err: Error) => {
            logger.warn({
                operation: 'app.update',
                error: {
                    name: err.name,
                    message: err.message,
                    module: 'service-worker',
                },
                data: { reason: 'service_worker_not_available' },
            });
        });
}

/**
 * Cleanup service worker update checking
 * Exported for potential use in cleanup hooks or testing
 */
export function cleanupUpdateNotification(): void {
    if (updateIntervalId !== null) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
}

/**
 * Show update notification to user
 * @param registration - Service worker registration
 */
function showUpdateNotification(registration: ServiceWorkerRegistration): void {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <span class="update-icon">🎉</span>
            <div class="update-message">
                <strong>Update Available!</strong>
                <p>A new version of MegaBonk Guide is ready.</p>
            </div>
            <button class="update-btn" id="update-reload-btn">
                Reload Now
            </button>
            <button class="update-dismiss-btn" id="update-dismiss-btn">
                Later
            </button>
        </div>
    `;
    document.body.appendChild(notification);

    // Cleanup function to remove notification and event listeners
    const cleanup = () => {
        notification.remove();
    };

    // Handle reload button
    const reloadBtn = document.getElementById('update-reload-btn');
    if (reloadBtn) {
        const handleReload = () => {
            // Tell waiting service worker to skip waiting
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            // Reload page when new service worker takes control
            const handleControllerChange = () => {
                window.location.reload();
            };
            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
        };
        reloadBtn.addEventListener('click', handleReload, { once: true });
    }

    // Handle dismiss button
    const dismissBtn = document.getElementById('update-dismiss-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', cleanup, { once: true });
    }
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
    // Setup error tracking first (critical - no error boundary)
    setupErrorTracking();

    // Initialize theme manager early (before any UI rendering)
    await safeModuleInit(
        'theme-manager',
        async () => {
            themeManager.init();
        },
        { required: false }
    );

    // Register error boundaries for modules
    registerErrorBoundary('dom-cache', () => {
        console.warn('DOM cache failed, using direct DOM queries as fallback');
    });

    registerErrorBoundary('data-service', () => {
        console.warn('Data service failed, showing error state');
        ToastManager.error('Failed to load game data. Please refresh the page.');
    });

    // Setup offline indicator (non-critical)
    await safeModuleInit(
        'offline-indicator',
        async () => {
            setupOfflineIndicator();
        },
        { required: false }
    );

    // Setup update notification (non-critical)
    await safeModuleInit(
        'update-notification',
        async () => {
            setupUpdateNotification();
        },
        { required: false }
    );

    // Initialize DOM cache (important but can degrade)
    await safeModuleInit(
        'dom-cache',
        async () => {
            domCache.init();
        },
        { required: false, gracefulDegradation: true }
    );

    // Setup image fallback handler for CSP compliance (non-critical)
    await safeModuleInit(
        'image-fallback',
        async () => {
            setupImageFallbackHandler();
        },
        { required: false }
    );

    // Initialize toast manager (important)
    await safeModuleInit(
        'toast-manager',
        async () => {
            ToastManager.init();
        },
        { required: true }
    );

    // Load favorites from localStorage (non-critical)
    await safeModuleInit(
        'favorites',
        async () => {
            loadFavorites();
        },
        { required: false }
    );

    // Setup event delegation and listeners (critical)
    await safeModuleInit(
        'event-system',
        async () => {
            setupEventDelegation();
            setupEventListeners();
        },
        { required: true }
    );

    // Setup keyboard shortcuts (non-critical)
    await safeModuleInit(
        'keyboard-shortcuts',
        async () => {
            setupKeyboardShortcuts();
        },
        { required: false }
    );

    // Load all game data (critical)
    await safeModuleInit(
        'data-service',
        async () => {
            loadAllData();
        },
        { required: true }
    );

    // Initialize Web Vitals monitoring (non-critical)
    await safeModuleInit(
        'web-vitals',
        async () => {
            initWebVitals();
            createPerformanceBadge();
        },
        { required: false }
    );
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
