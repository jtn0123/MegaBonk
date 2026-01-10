// ========================================
// Error Boundary Module
// ========================================
// Provides module-level error recovery and graceful degradation
// ========================================

import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Error boundary state
 */
interface ErrorBoundary {
    fallback: ((error: Error) => unknown) | null;
    errorCount: number;
    lastError: Error | null;
}

/**
 * Error boundary options
 */
export interface ErrorBoundaryOptions {
    fallback?: ((error: Error) => unknown) | null;
    silent?: boolean;
    maxRetries?: number;
    onError?: ((error: Error, retries: number) => Promise<void> | void) | null;
}

/**
 * Module initialization options
 */
export interface ModuleInitOptions {
    required?: boolean;
    gracefulDegradation?: boolean;
}

/**
 * Error statistics for a module
 */
export interface ErrorStats {
    errorCount: number;
    lastError: Error | null;
}

/**
 * Degraded module result
 */
interface DegradedModuleResult {
    degraded: boolean;
    error: Error;
}

// ========================================
// Error Boundary State
// ========================================

/**
 * Error boundary configuration
 */
const errorBoundaries = new Map<string, ErrorBoundary>();

/**
 * Register an error boundary for a module
 * @param moduleName - Name of the module
 * @param fallbackFn - Fallback function to execute on error
 */
export function registerErrorBoundary(moduleName: string, fallbackFn: (error: Error) => unknown): void {
    errorBoundaries.set(moduleName, {
        fallback: fallbackFn,
        errorCount: 0,
        lastError: null,
    });
}

/**
 * Wrap a function with error boundary protection
 * @param moduleName - Name of the module
 * @param fn - Function to wrap
 * @param options - Configuration options
 * @returns Wrapped function with error handling
 */
export function withErrorBoundary<T extends (...args: any[]) => any>(
    moduleName: string,
    fn: T,
    options: ErrorBoundaryOptions = {}
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined> {
    const { fallback = null, silent = false, maxRetries = 0, onError = null } = options;

    return async function (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> {
        const boundary = errorBoundaries.get(moduleName);
        let retries = 0;

        while (retries <= maxRetries) {
            try {
                return await fn(...args);
            } catch (error) {
                const err = error as Error;

                // Log error with wide event
                logger.error({
                    operation: 'error.boundary',
                    error: {
                        name: err.name,
                        message: err.message,
                        stack: err.stack,
                        module: moduleName,
                    },
                    data: {
                        retries,
                        maxRetries,
                        phase: 'caught',
                    },
                });

                // Update boundary stats
                if (boundary) {
                    boundary.errorCount++;
                    boundary.lastError = err;
                }

                // Call custom error handler
                if (onError) {
                    try {
                        await onError(err, retries);
                    } catch (handlerError) {
                        const hErr = handlerError as Error;
                        logger.error({
                            operation: 'error.boundary',
                            error: {
                                name: hErr.name,
                                message: hErr.message,
                                stack: hErr.stack,
                                module: moduleName,
                            },
                            data: { phase: 'handler_failed' },
                        });
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
                        return (await fallback(err)) as Awaited<ReturnType<T>>;
                    } catch (fallbackError) {
                        const fErr = fallbackError as Error;
                        logger.error({
                            operation: 'error.boundary',
                            error: {
                                name: fErr.name,
                                message: fErr.message,
                                stack: fErr.stack,
                                module: moduleName,
                            },
                            data: { phase: 'fallback_failed', recoveryAttempted: true, recoverySucceeded: false },
                        });
                    }
                }

                // Execute registered boundary fallback
                if (boundary && boundary.fallback) {
                    try {
                        return (await boundary.fallback(err)) as Awaited<ReturnType<T>>;
                    } catch (boundaryError) {
                        const bErr = boundaryError as Error;
                        logger.error({
                            operation: 'error.boundary',
                            error: {
                                name: bErr.name,
                                message: bErr.message,
                                stack: bErr.stack,
                                module: moduleName,
                            },
                            data: {
                                phase: 'boundary_fallback_failed',
                                recoveryAttempted: true,
                                recoverySucceeded: false,
                            },
                        });
                    }
                }

                // Re-throw if no recovery options
                throw err;
            }
        }

        // Unreachable but TypeScript needs this
        return undefined;
    };
}

/**
 * Wrap module initialization with error boundary
 * @param moduleName - Module name
 * @param initFn - Initialization function
 * @param options - Configuration options
 * @returns Promise resolving to initialization result or degraded mode result
 */
export async function safeModuleInit<T = unknown>(
    moduleName: string,
    initFn: () => T | Promise<T>,
    options: ModuleInitOptions = {}
): Promise<T | DegradedModuleResult | undefined> {
    const { required = false, gracefulDegradation = true } = options;

    const wrappedInit = withErrorBoundary(moduleName, initFn, {
        silent: false,
        maxRetries: 0,
        fallback: gracefulDegradation
            ? async (error: Error): Promise<DegradedModuleResult> => {
                  logger.warn({
                      operation: 'module.degraded',
                      error: {
                          name: error.name,
                          message: error.message,
                          stack: error.stack,
                          module: moduleName,
                      },
                      data: { moduleName, gracefulDegradation: true },
                  });
                  return { degraded: true, error };
              }
            : null,
        onError: async (error: Error): Promise<void> => {
            logger.error({
                operation: 'module.init.failed',
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    module: moduleName,
                    retriable: true, // Module initialization can often be retried
                },
                data: { moduleName, required },
            });

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
 * @param moduleName - Module name
 * @returns Error statistics
 */
export function getErrorStats(moduleName: string): ErrorStats {
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
 * @param moduleName - Module name
 */
export function resetErrorStats(moduleName: string): void {
    const boundary = errorBoundaries.get(moduleName);
    if (boundary) {
        boundary.errorCount = 0;
        boundary.lastError = null;
    }
}

/**
 * Get all registered error boundaries
 * @returns All error boundaries
 */
export function getAllErrorBoundaries(): Map<string, ErrorBoundary> {
    return new Map(errorBoundaries);
}
