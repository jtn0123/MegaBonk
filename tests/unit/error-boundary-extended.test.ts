/**
 * Extended coverage tests for error-boundary.ts
 * Covers: buildErrorReport, exportErrorReport, initGlobalErrorHandlers,
 * fallback failures, onError handler failures
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock breadcrumbs module
vi.mock('../../src/modules/breadcrumbs.ts', () => ({
    recordError: vi.fn(),
    captureStateSnapshot: vi.fn().mockReturnValue({ test: 'snapshot' }),
    getRecentBreadcrumbs: vi.fn().mockReturnValue([
        { type: 'action', category: 'test', message: 'test action', timestamp: Date.now() },
    ]),
}));

// Mock dependencies before importing module
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        getSessionId: vi.fn().mockReturnValue('test-session-123'),
    },
}));

// Import after mocks are set up
import {
    registerErrorBoundary,
    withErrorBoundary,
    safeModuleInit,
    getErrorStats,
    resetErrorStats,
    getAllErrorBoundaries,
    buildErrorReport,
    exportErrorReport,
    initGlobalErrorHandlers,
} from '../../src/modules/error-boundary.ts';

import { recordError, captureStateSnapshot, getRecentBreadcrumbs } from '../../src/modules/breadcrumbs.ts';

describe('Error Boundary Module - Extended Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all boundaries between tests
        getAllErrorBoundaries().forEach((_, key) => {
            resetErrorStats(key);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // buildErrorReport Tests
    // ========================================
    describe('buildErrorReport()', () => {
        it('should build error report with all fields', () => {
            const error = new Error('Test error for report');
            error.stack = 'Error: Test error for report\n    at test.js:1:1';

            const report = buildErrorReport(error, 'test-module');

            expect(report.timestamp).toBeDefined();
            expect(report.timestamp).toBeGreaterThan(0);
            expect(report.error.name).toBe('Error');
            expect(report.error.message).toBe('Test error for report');
            expect(report.error.stack).toBe('Error: Test error for report\n    at test.js:1:1');
            expect(report.error.module).toBe('test-module');
            expect(report.context).toBe('test-module');
            expect(report.sessionId).toBe('test-session-123');
        });

        it('should call recordError with error and module', () => {
            const error = new Error('Record test');
            buildErrorReport(error, 'record-module');

            expect(recordError).toHaveBeenCalledWith(error, 'record-module');
        });

        it('should capture state snapshot', () => {
            const error = new Error('Snapshot test');
            const report = buildErrorReport(error);

            expect(captureStateSnapshot).toHaveBeenCalled();
            expect(report.stateSnapshot).toEqual({ test: 'snapshot' });
        });

        it('should get recent breadcrumbs (5 minutes)', () => {
            const error = new Error('Breadcrumb test');
            const report = buildErrorReport(error);

            expect(getRecentBreadcrumbs).toHaveBeenCalledWith(300000);
            expect(report.breadcrumbs.length).toBeGreaterThan(0);
        });

        it('should handle error without stack trace', () => {
            const error = new Error('No stack');
            delete error.stack;

            const report = buildErrorReport(error);

            expect(report.error.stack).toBeUndefined();
        });

        it('should handle missing module name', () => {
            const error = new Error('No module');
            const report = buildErrorReport(error);

            expect(report.error.module).toBeUndefined();
            expect(report.context).toBeUndefined();
        });
    });

    // ========================================
    // exportErrorReport Tests
    // ========================================
    describe('exportErrorReport()', () => {
        it('should export error report as JSON string', () => {
            const error = new Error('Export test');
            const jsonString = exportErrorReport(error, 'export-module');

            expect(typeof jsonString).toBe('string');
            const parsed = JSON.parse(jsonString);
            expect(parsed.error.name).toBe('Error');
            expect(parsed.error.message).toBe('Export test');
            expect(parsed.error.module).toBe('export-module');
        });

        it('should produce valid JSON with pretty formatting', () => {
            const error = new Error('Format test');
            const jsonString = exportErrorReport(error);

            // Check that it's pretty-printed (has newlines)
            expect(jsonString).toContain('\n');
            expect(() => JSON.parse(jsonString)).not.toThrow();
        });

        it('should include all report fields in export', () => {
            const error = new Error('Complete export');
            const jsonString = exportErrorReport(error, 'complete-module');
            const parsed = JSON.parse(jsonString);

            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('error');
            expect(parsed).toHaveProperty('stateSnapshot');
            expect(parsed).toHaveProperty('breadcrumbs');
            expect(parsed).toHaveProperty('context');
            expect(parsed).toHaveProperty('sessionId');
        });
    });

    // ========================================
    // withErrorBoundary - Fallback Failures
    // ========================================
    describe('withErrorBoundary() - Fallback Failures', () => {
        it('should re-throw when inline fallback fails', async () => {
            const originalError = new Error('Original error');
            const fallbackError = new Error('Fallback failed');
            const fn = vi.fn().mockRejectedValue(originalError);
            const fallback = vi.fn().mockImplementation(() => {
                throw fallbackError;
            });

            const wrapped = withErrorBoundary('fallback-fail-test', fn, { 
                fallback, 
                silent: true 
            });

            await expect(wrapped()).rejects.toThrow('Fallback failed');

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'error.boundary',
                data: expect.objectContaining({
                    phase: 'fallback_failed',
                    recoveryAttempted: true,
                    recoverySucceeded: false,
                }),
            }));
        });

        it('should handle boundary fallback failure', async () => {
            const originalError = new Error('Original error');
            const boundaryFallbackError = new Error('Boundary fallback failed');
            const fn = vi.fn().mockRejectedValue(originalError);
            const boundaryFallback = vi.fn().mockImplementation(() => {
                throw boundaryFallbackError;
            });

            registerErrorBoundary('boundary-fail-test', boundaryFallback);
            const wrapped = withErrorBoundary('boundary-fail-test', fn, { silent: true });

            // Should re-throw the original error when boundary fallback fails
            await expect(wrapped()).rejects.toThrow('Original error');

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'error.boundary',
                data: expect.objectContaining({
                    phase: 'boundary_fallback_failed',
                }),
            }));
        });

        it('should log when onError handler throws', async () => {
            const originalError = new Error('Original');
            const handlerError = new Error('Handler failed');
            const fn = vi.fn().mockRejectedValue(originalError);
            const onError = vi.fn().mockImplementation(() => {
                throw handlerError;
            });
            const fallback = vi.fn().mockReturnValue('recovered');

            const wrapped = withErrorBoundary('handler-fail-test', fn, { 
                onError, 
                fallback,
                silent: true 
            });

            const result = await wrapped();
            expect(result).toBe('recovered');

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'error.boundary',
                data: expect.objectContaining({
                    phase: 'handler_failed',
                }),
            }));
        });

        it('should handle async onError handler that throws', async () => {
            const originalError = new Error('Original async');
            const handlerError = new Error('Async handler failed');
            const fn = vi.fn().mockRejectedValue(originalError);
            const onError = vi.fn().mockRejectedValue(handlerError);
            const fallback = vi.fn().mockReturnValue('async recovered');

            const wrapped = withErrorBoundary('async-handler-fail', fn, { 
                onError, 
                fallback,
                silent: true 
            });

            const result = await wrapped();
            expect(result).toBe('async recovered');
        });

        it('should handle async fallback that throws', async () => {
            const originalError = new Error('Original');
            const fallbackError = new Error('Async fallback failed');
            const fn = vi.fn().mockRejectedValue(originalError);
            const fallback = vi.fn().mockRejectedValue(fallbackError);

            const wrapped = withErrorBoundary('async-fallback-fail', fn, { 
                fallback,
                silent: true 
            });

            await expect(wrapped()).rejects.toThrow('Async fallback failed');
        });
    });

    // ========================================
    // safeModuleInit - Edge Cases
    // ========================================
    describe('safeModuleInit() - Edge Cases', () => {
        it('should throw when gracefulDegradation is false and init fails', async () => {
            const error = new Error('Init failed');
            const initFn = vi.fn().mockRejectedValue(error);

            await expect(safeModuleInit('no-degrade-test', initFn, { 
                gracefulDegradation: false 
            })).rejects.toThrow('Init failed');
        });

        it('should handle required module with graceful degradation', async () => {
            const error = new Error('Required module init failed');
            const initFn = vi.fn().mockRejectedValue(error);

            const result = await safeModuleInit('required-degrade', initFn, { 
                required: true,
                gracefulDegradation: true,
            });

            expect(result).toEqual({ degraded: true, error });

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalledWith(
                expect.stringContaining('Critical error')
            );
        });

        it('should handle sync init function that throws', async () => {
            const error = new Error('Sync init failed');
            const initFn = vi.fn().mockImplementation(() => {
                throw error;
            });

            const result = await safeModuleInit('sync-fail', initFn, {
                gracefulDegradation: true,
            });

            expect(result).toEqual({ degraded: true, error });
        });

        it('should handle ToastManager not initialized', async () => {
            const { ToastManager } = await import('../../src/modules/toast.ts');
            (ToastManager.error as any).mockImplementation(() => {
                throw new Error('ToastManager not ready');
            });

            const error = new Error('Toast init test');
            const initFn = vi.fn().mockRejectedValue(error);

            // Should not throw even if ToastManager fails
            await expect(safeModuleInit('toast-fail', initFn, { 
                required: true,
                gracefulDegradation: true,
            })).resolves.toEqual({ degraded: true, error });
        });
    });

    // ========================================
    // initGlobalErrorHandlers Tests
    // ========================================
    describe('initGlobalErrorHandlers()', () => {
        let addEventListenerSpy: any;
        let eventHandlers: Map<string, Function>;

        beforeEach(() => {
            eventHandlers = new Map();
            
            // Mock window.addEventListener
            addEventListenerSpy = vi.fn((event: string, handler: Function) => {
                eventHandlers.set(event, handler);
            });

            // Setup window mock
            if (typeof window !== 'undefined') {
                vi.spyOn(window, 'addEventListener').mockImplementation(addEventListenerSpy);
            }
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should register unhandledrejection and error handlers', () => {
            initGlobalErrorHandlers();

            expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
        });

        it('should log initialization', async () => {
            initGlobalErrorHandlers();

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.info).toHaveBeenCalledWith({
                operation: 'error.handlers_initialized',
                data: { handlers: ['unhandledrejection', 'error'] },
            });
        });

        it('should handle unhandled rejection with Error', async () => {
            initGlobalErrorHandlers();

            const handler = eventHandlers.get('unhandledrejection');
            expect(handler).toBeDefined();

            const error = new Error('Unhandled promise rejection');
            const event = { reason: error };
            handler?.(event);

            expect(recordError).toHaveBeenCalledWith(error, 'global');
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'error.unhandled_rejection',
            }));
        });

        it('should handle unhandled rejection with non-Error value', () => {
            initGlobalErrorHandlers();

            const handler = eventHandlers.get('unhandledrejection');
            expect(handler).toBeDefined();

            const event = { reason: 'String rejection reason' };
            handler?.(event);

            expect(recordError).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'String rejection reason' }),
                'global'
            );
        });

        it('should handle uncaught error event', async () => {
            initGlobalErrorHandlers();

            const handler = eventHandlers.get('error');
            expect(handler).toBeDefined();

            const error = new Error('Uncaught error');
            const event = {
                error,
                message: 'Uncaught error',
                filename: 'test.js',
                lineno: 10,
                colno: 5,
            };
            handler?.(event);

            expect(recordError).toHaveBeenCalledWith(error, 'global');
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'error.uncaught',
                data: expect.objectContaining({
                    filename: 'test.js',
                    lineno: 10,
                    colno: 5,
                }),
            }));
        });

        it('should handle error event without error object', () => {
            initGlobalErrorHandlers();

            const handler = eventHandlers.get('error');
            expect(handler).toBeDefined();

            const event = {
                error: null,
                message: 'Script error',
                filename: 'external.js',
                lineno: 1,
                colno: 1,
            };
            handler?.(event);

            expect(recordError).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Script error' }),
                'global'
            );
        });
    });

    // ========================================
    // withErrorBoundary - No Recovery Options
    // ========================================
    describe('withErrorBoundary() - No Recovery', () => {
        it('should re-throw error when no fallback options available', async () => {
            const error = new Error('No recovery');
            const fn = vi.fn().mockRejectedValue(error);

            const wrapped = withErrorBoundary('no-recovery', fn, { silent: true });

            await expect(wrapped()).rejects.toThrow('No recovery');
        });

        it('should show toast and re-throw when not silent and no fallback', async () => {
            const error = new Error('Toast and throw');
            const fn = vi.fn().mockRejectedValue(error);

            const wrapped = withErrorBoundary('toast-throw', fn, { silent: false });

            await expect(wrapped()).rejects.toThrow('Toast and throw');

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // Retry with onError
    // ========================================
    describe('withErrorBoundary() - Retry with Handlers', () => {
        it('should call onError with correct retry count', async () => {
            const error = new Error('Retry handler test');
            const fn = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();

            const wrapped = withErrorBoundary('retry-handler', fn, { 
                maxRetries: 2, 
                onError,
                silent: true,
            });

            try {
                await wrapped();
            } catch {
                // Expected
            }

            // onError should be called for each attempt
            expect(onError).toHaveBeenCalledTimes(3); // 0, 1, 2 retries
            expect(onError).toHaveBeenNthCalledWith(1, error, 0);
            expect(onError).toHaveBeenNthCalledWith(2, error, 1);
            expect(onError).toHaveBeenNthCalledWith(3, error, 2);
        }, 15000);

        it('should continue retry even if onError throws', async () => {
            const error = new Error('Continue retry');
            let attempts = 0;
            const fn = vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) throw error;
                return 'success';
            });
            const onError = vi.fn().mockImplementation(() => {
                throw new Error('onError failed');
            });

            const wrapped = withErrorBoundary('continue-retry', fn, { 
                maxRetries: 3, 
                onError,
                silent: true,
            });

            const result = await wrapped();
            expect(result).toBe('success');
        }, 15000);
    });
});
