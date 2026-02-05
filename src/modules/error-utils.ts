// ========================================
// MegaBonk Error Utilities Module
// ========================================
// Shared error handling patterns for consistent logging
// ========================================

import { logger } from './logger.ts';

/**
 * Normalized error info for logging
 */
export interface ErrorInfo {
    name: string;
    message: string;
    stack?: string;
}

/**
 * Extract normalized error info from unknown error
 * @param error - Unknown error value
 * @param stackLines - Number of stack trace lines to include (default: 5)
 * @returns Normalized ErrorInfo object
 */
export function extractErrorInfo(error: unknown, stackLines: number = 5): ErrorInfo {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, stackLines).join(' -> '),
        };
    }

    // Handle non-Error values
    return {
        name: 'UnknownError',
        message: String(error),
    };
}

/**
 * Log error with consistent structure
 * @param operation - Operation identifier (e.g., 'scan_build.auto_detect')
 * @param error - Error to log
 * @param data - Additional context data
 */
export function logError(operation: string, error: unknown, data?: Record<string, unknown>): void {
    logger.error({
        operation,
        error: extractErrorInfo(error),
        data,
    });
}

/**
 * Log warning with consistent structure
 * @param operation - Operation identifier
 * @param error - Error to log
 * @param data - Additional context data
 */
export function logWarning(operation: string, error: unknown, data?: Record<string, unknown>): void {
    logger.warn({
        operation,
        error: extractErrorInfo(error),
        data,
    });
}

/**
 * Wrap an async function with automatic error logging
 * @param operation - Operation identifier for logging
 * @param fn - Async function to wrap
 * @param onError - Optional callback on error (receives extracted error info)
 * @returns Wrapped function that catches and logs errors
 */
export function withErrorLogging<T, Args extends unknown[]>(
    operation: string,
    fn: (...args: Args) => Promise<T>,
    onError?: (error: ErrorInfo) => void
): (...args: Args) => Promise<T | undefined> {
    return async (...args: Args): Promise<T | undefined> => {
        try {
            return await fn(...args);
        } catch (error) {
            const errorInfo = extractErrorInfo(error);
            logError(operation, error);
            onError?.(errorInfo);
            return undefined;
        }
    };
}

/**
 * Execute function with try/catch, returning result or default on error
 * @param fn - Function to execute
 * @param defaultValue - Value to return on error
 * @param operation - Optional operation name for logging (if not provided, error is silent)
 * @returns Function result or default value
 */
export function tryOrDefault<T>(fn: () => T, defaultValue: T, operation?: string): T {
    try {
        return fn();
    } catch (error) {
        if (operation) {
            logWarning(operation, error);
        }
        return defaultValue;
    }
}

/**
 * Execute async function with try/catch, returning result or default on error
 * @param fn - Async function to execute
 * @param defaultValue - Value to return on error
 * @param operation - Optional operation name for logging
 * @returns Promise of function result or default value
 */
export async function tryOrDefaultAsync<T>(fn: () => Promise<T>, defaultValue: T, operation?: string): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (operation) {
            logWarning(operation, error);
        }
        return defaultValue;
    }
}
