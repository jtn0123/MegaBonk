// ========================================
// Error Boundary Module
// ========================================
// Provides module-level error recovery and graceful degradation
// Includes state snapshots and breadcrumb integration
// ========================================

import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { recordError, captureStateSnapshot, getRecentBreadcrumbs, type Breadcrumb } from './breadcrumbs.ts';

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

/**
 * Enhanced error report with state snapshot and breadcrumbs
 */
export interface ErrorReport {
    timestamp: number;
    error: {
        name: string;
        message: string;
        stack?: string;
        module?: string;
    };
    stateSnapshot: Record<string, unknown>;
    breadcrumbs: Breadcrumb[];
    context?: string;
    sessionId?: string;
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
function logBoundaryError(err: Error, moduleName: string, phase: string, data?: Record<string, unknown>): void {
    logger.error({
        operation: 'error.boundary',
        error: { name: err.name, message: err.message, stack: err.stack, module: moduleName },
        data: { phase, ...data },
    });
}

async function invokeErrorHandler(
    onError: ((error: Error, retryCount: number) => void | Promise<void>) | null,
    err: Error,
    retries: number,
    moduleName: string
): Promise<void> {
    if (!onError) return;
    try {
        await onError(err, retries);
    } catch (handlerError) {
        logBoundaryError(handlerError as Error, moduleName, 'handler_failed');
    }
}

async function tryFallback<TReturn>(
    fallback: ((error: Error) => unknown) | null | undefined,
    err: Error,
    moduleName: string,
    phase: string
): Promise<{ value: Awaited<TReturn>; ok: true } | { ok: false }> {
    if (!fallback) return { ok: false };
    try {
        const value = (await fallback(err)) as Awaited<TReturn>;
        return { value, ok: true };
    } catch (fallbackError) {
        logBoundaryError(fallbackError as Error, moduleName, phase, {
            recoveryAttempted: true,
            recoverySucceeded: false,
        });
        if (phase === 'fallback_failed') throw fallbackError;
        return { ok: false };
    }
}

export function withErrorBoundary<TArgs extends unknown[], TReturn>(
    moduleName: string,
    fn: (...args: TArgs) => TReturn,
    options: ErrorBoundaryOptions = {}
): (...args: TArgs) => Promise<Awaited<TReturn> | undefined> {
    const { fallback = null, silent = false, maxRetries = 0, onError = null } = options;

    return async function (...args: TArgs): Promise<Awaited<TReturn> | undefined> {
        const boundary = errorBoundaries.get(moduleName);
        let retries = 0;

        while (retries <= maxRetries) {
            try {
                return await fn(...args);
            } catch (error) {
                const err = error as Error;

                recordError(err, moduleName);
                const stateSnapshot = captureStateSnapshot();
                const recentBreadcrumbs = getRecentBreadcrumbs(60000);

                logBoundaryError(err, moduleName, 'caught', {
                    retries,
                    maxRetries,
                    stateSnapshot,
                    breadcrumbCount: recentBreadcrumbs.length,
                });

                if (boundary) {
                    boundary.errorCount++;
                    boundary.lastError = err;
                }

                await invokeErrorHandler(onError, err, retries, moduleName);

                if (retries < maxRetries) {
                    retries++;
                    const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (!silent) {
                    try {
                        ToastManager.error(`An error occurred in ${moduleName}. Some features may not work correctly.`);
                    } catch {
                        /* ToastManager not initialized */
                    }
                }

                const fallbackResult = await tryFallback<TReturn>(fallback, err, moduleName, 'fallback_failed');
                if (fallbackResult.ok) return fallbackResult.value;

                const boundaryResult = await tryFallback<TReturn>(
                    boundary?.fallback,
                    err,
                    moduleName,
                    'boundary_fallback_failed'
                );
                if (boundaryResult.ok) return boundaryResult.value;

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
                try {
                    ToastManager.error(`Critical error: ${moduleName} failed to load. Please refresh the page.`);
                } catch {
                    // ToastManager not initialized yet, fail silently
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

// ========================================
// Error Report Builder
// ========================================

/**
 * Build a comprehensive error report with state snapshot and breadcrumbs
 * @param error - The error that occurred
 * @param moduleName - Optional module name where error occurred
 * @returns Complete error report
 */
export function buildErrorReport(error: Error, moduleName?: string): ErrorReport {
    // Record error in breadcrumbs first
    recordError(error, moduleName);

    const stateSnapshot = captureStateSnapshot();
    const breadcrumbs = getRecentBreadcrumbs(300000); // Last 5 minutes

    return {
        timestamp: Date.now(),
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            module: moduleName,
        },
        stateSnapshot,
        breadcrumbs,
        context: moduleName,
        sessionId: logger.getSessionId(),
    };
}

/**
 * Export error report as JSON string for debugging
 * @param error - The error that occurred
 * @param moduleName - Optional module name
 * @returns JSON string of error report
 */
export function exportErrorReport(error: Error, moduleName?: string): string {
    const report = buildErrorReport(error, moduleName);
    return JSON.stringify(report, null, 2);
}

// ========================================
// Global Error Handlers
// ========================================

/**
 * Initialize global error handlers for uncaught exceptions and rejections
 * Call this once during app initialization
 */
export function initGlobalErrorHandlers(): void {
    // Handle uncaught promise rejections
    if (globalThis.window !== undefined) {
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

            // Record error and capture state
            recordError(error, 'global');
            const stateSnapshot = captureStateSnapshot();
            const recentBreadcrumbs = getRecentBreadcrumbs(60000);

            logger.error({
                operation: 'error.unhandled_rejection',
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
                data: {
                    type: 'unhandledrejection',
                    prevented: false,
                    stateSnapshot,
                    breadcrumbCount: recentBreadcrumbs.length,
                },
            });

            // Prevent default browser console error (optional - remove if you want both)
            // event.preventDefault();
        });

        // Handle uncaught errors
        window.addEventListener('error', (event: ErrorEvent) => {
            const error = event.error || new Error(event.message);

            // Record error and capture state
            recordError(error, 'global');
            const stateSnapshot = captureStateSnapshot();
            const recentBreadcrumbs = getRecentBreadcrumbs(60000);

            logger.error({
                operation: 'error.uncaught',
                error: {
                    name: event.error?.name || 'Error',
                    message: event.message,
                    stack: event.error?.stack,
                },
                data: {
                    type: 'error',
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stateSnapshot,
                    breadcrumbCount: recentBreadcrumbs.length,
                },
            });
        });

        logger.info({
            operation: 'error.handlers_initialized',
            data: { handlers: ['unhandledrejection', 'error'] },
        });
    }
}
