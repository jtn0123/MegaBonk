// ========================================
// MegaBonk Complete Guide - Main Script
// ========================================
// This file serves as the entry point and initializes all modules.
// The functionality is split across:
//   - modules/constants.js - Constants and configuration
//   - modules/utils.js - Utility functions
//   - modules/data-service.js - Data loading
//   - modules/filters.js - Filtering and sorting
//   - modules/charts.js - Chart.js integration
//   - modules/renderers.js - Render functions
//   - modules/modal.js - Modal dialogs
//   - modules/build-planner.js - Build planner
//   - modules/compare.js - Compare mode
//   - modules/calculator.js - Breakpoint calculator
//   - modules/events.js - Event handling
// ========================================

// Global state
let filteredData = [];

/**
 * Setup global error tracking
 */
function setupErrorTracking() {
    // Catch uncaught JavaScript errors
    window.onerror = (message, source, lineno, colno, error) => {
        console.error('Global error caught:', {
            message,
            source,
            line: lineno,
            column: colno,
            error
        });

        // Show user-friendly error message
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Something went wrong. The error has been logged.');
        }

        // Return false to let browser handle error as well
        return false;
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', {
            reason: event.reason,
            promise: event.promise
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
function setupOfflineIndicator() {
    // Create offline indicator
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className = 'offline-indicator';
    indicator.innerHTML = '📡 You\'re offline - using cached data';
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
        if (typeof ToastManager !== 'undefined') {
            ToastManager.success('Back online!');
        }
    });

    window.addEventListener('offline', () => {
        indicator.style.display = 'block';
        if (typeof ToastManager !== 'undefined') {
            ToastManager.info('You\'re offline - using cached data');
        }
    });

    // Initial check
    updateConnectionStatus();
}

/**
 * Setup service worker update notification
 */
function setupUpdateNotification() {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
        return;
    }

    // Listen for service worker updates
    navigator.serviceWorker.register('./sw.js').then(registration => {
        // Check for updates periodically (every hour)
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000);

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
    }).catch(err => {
        console.warn('Service worker registration failed:', err);
    });
}

/**
 * Show update notification to user
 * @param {ServiceWorkerRegistration} registration - Service worker registration
 */
function showUpdateNotification(registration) {
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

    // Handle reload button
    const reloadBtn = document.getElementById('update-reload-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            // Tell waiting service worker to skip waiting
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            // Reload page when new service worker takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        });
    }

    // Handle dismiss button
    const dismissBtn = document.getElementById('update-dismiss-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            notification.remove();
        });
    }
}

/**
 * Initialize the application
 */
function init() {
    // Setup error tracking first
    setupErrorTracking();

    // Setup offline indicator
    setupOfflineIndicator();

    // Setup update notification
    setupUpdateNotification();

    // Load favorites from localStorage
    if (typeof loadFavorites === 'function') {
        loadFavorites();
    }

    // Setup event listeners
    setupEventListeners();

    // Load all game data
    loadAllData();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// ========================================
// Expose globals for backwards compatibility
// ========================================

window.filteredData = filteredData;
