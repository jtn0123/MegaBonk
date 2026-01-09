// ========================================
// Error Boundary Module
// ========================================
// Provides module-level error recovery and graceful degradation
// ========================================

import { ToastManager } from './toast.js';

/**
 * Error boundary configuration
 */
const errorBoundaries = new Map();

/**
 * Register an error boundary for a module
 * @param {string} moduleName - Name of the module
 * @param {Function} fallbackFn - Fallback function to execute on error
 */
export function registerErrorBoundary(moduleName, fallbackFn) {
    errorBoundaries.set(moduleName, {
        fallback: fallbackFn,
        errorCount: 0,
        lastError: null,
    });
}

/**
 * Wrap a function with error boundary protection
 * @param {string} moduleName - Name of the module
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Configuration options
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorBoundary(moduleName, fn, options = {}) {
    const { fallback = null, silent = false, maxRetries = 0, onError = null } = options;

    return async function (...args) {
        const boundary = errorBoundaries.get(moduleName);
        let retries = 0;

        while (retries <= maxRetries) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                // Log error
                console.error(`[ErrorBoundary:${moduleName}] Error caught:`, error);

                // Update boundary stats
                if (boundary) {
                    boundary.errorCount++;
                    boundary.lastError = error;
                }

                // Call custom error handler
                if (onError) {
                    try {
                        await onError(error, retries);
                    } catch (handlerError) {
                        console.error(`[ErrorBoundary:${moduleName}] Error handler failed:`, handlerError);
                    }
                }

                // Retry logic
                if (retries < maxRetries) {
                    retries++;
                    const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Show user notification if not silent
                if (!silent && typeof ToastManager !== 'undefined') {
                    ToastManager.error(`An error occurred in ${moduleName}. Some features may not work correctly.`);
                }

                // Execute fallback
                if (fallback) {
                    try {
                        return await fallback(error);
                    } catch (fallbackError) {
                        console.error(`[ErrorBoundary:${moduleName}] Fallback failed:`, fallbackError);
                    }
                }

                // Execute registered boundary fallback
                if (boundary && boundary.fallback) {
                    try {
                        return await boundary.fallback(error);
                    } catch (boundaryError) {
                        console.error(`[ErrorBoundary:${moduleName}] Boundary fallback failed:`, boundaryError);
                    }
                }

                // Re-throw if no recovery options
                throw error;
            }
        }
    };
}

/**
 * Wrap module initialization with error boundary
 * @param {string} moduleName - Module name
 * @param {Function} initFn - Initialization function
 * @param {Object} options - Configuration options
 */
export async function safeModuleInit(moduleName, initFn, options = {}) {
    const { required = false, gracefulDegradation = true } = options;

    const wrappedInit = withErrorBoundary(moduleName, initFn, {
        silent: false,
        maxRetries: 0,
        fallback: gracefulDegradation
            ? async error => {
                  console.warn(`[ErrorBoundary:${moduleName}] Module initialization failed, entering degraded mode`);
                  return { degraded: true, error };
              }
            : null,
        onError: async error => {
            console.error(`[ErrorBoundary] Failed to initialize ${moduleName}:`, error);

            if (required) {
                // Show critical error
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.error(`Critical error: ${moduleName} failed to load. Please refresh the page.`);
                }
            }
        },
    });

    return await wrappedInit();
}

/**
 * Get error stats for a module
 * @param {string} moduleName - Module name
 * @returns {Object} Error statistics
 */
export function getErrorStats(moduleName) {
    const boundary = errorBoundaries.get(moduleName);
    if (!boundary) {
        return { errorCount: 0, lastError: null };
    }
    return {
        errorCount: boundary.errorCount,
        lastError: boundary.lastError,
    };
}

/**
 * Reset error stats for a module
 * @param {string} moduleName - Module name
 */
export function resetErrorStats(moduleName) {
    const boundary = errorBoundaries.get(moduleName);
    if (boundary) {
        boundary.errorCount = 0;
        boundary.lastError = null;
    }
}

/**
 * Get all registered error boundaries
 * @returns {Map} All error boundaries
 */
export function getAllErrorBoundaries() {
    return new Map(errorBoundaries);
}
