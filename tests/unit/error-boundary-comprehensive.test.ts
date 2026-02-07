/**
 * @vitest-environment jsdom
 * Error Boundary Module - Comprehensive Coverage Tests
 * Target: >60% coverage for error-boundary.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
        getSessionId: vi.fn(() => 'test-session-123'),
    },
}));

vi.mock('../../src/modules/breadcrumbs.ts', () => ({
    recordError: vi.fn(),
    captureStateSnapshot: vi.fn(() => ({
        currentTab: 'items',
        filterState: { rarity: 'all' },
        timestamp: Date.now(),
    })),
    getRecentBreadcrumbs: vi.fn(() => [
        { type: 'action', message: 'User clicked button', timestamp: Date.now() - 1000 },
        { type: 'navigation', message: 'Switched to items tab', timestamp: Date.now() - 500 },
    ]),
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
    type ErrorBoundaryOptions,
    type ModuleInitOptions,
    type ErrorStats,
    type ErrorReport,
} from '../../src/modules/error-boundary.ts';

describe('Error Boundary Module - Comprehensive Coverage', () => {
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
    // registerErrorBoundary Tests
    // ========================================
    describe('registerErrorBoundary', () => {
        it('should register boundary with fallback function', () => {
            const fallback = vi.fn(() => 'fallback result');
            registerErrorBoundary('test-module', fallback);
            
            const boundaries = getAllErrorBoundaries();
            expect(boundaries.has('test-module')).toBe(true);
            expect(boundaries.get('test-module')?.fallback).toBe(fallback);
        });

        it('should initialize error count to zero', () => {
            registerErrorBoundary('new-module', vi.fn());
            
            const stats = getErrorStats('new-module');
            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should allow re-registration with new fallback', () => {
            const fallback1 = vi.fn();
            const fallback2 = vi.fn();
            
            registerErrorBoundary('reregister', fallback1);
            registerErrorBoundary('reregister', fallback2);
            
            const boundary = getAllErrorBoundaries().get('reregister');
            expect(boundary?.fallback).toBe(fallback2);
        });
    });

    // ========================================
    // withErrorBoundary Tests
    // ========================================
    describe('withErrorBoundary', () => {
        it('should execute function successfully and return result', async () => {
            const fn = vi.fn().mockReturnValue('success');
            const wrapped = withErrorBoundary('success-module', fn);
            
            const result = await wrapped();
            
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should handle async functions', async () => {
            const asyncFn = vi.fn().mockResolvedValue({ data: 'async result' });
            const wrapped = withErrorBoundary('async-module', asyncFn);
            
            const result = await wrapped();
            
            expect(result).toEqual({ data: 'async result' });
        });

        it('should pass through arguments to wrapped function', async () => {
            const fn = vi.fn((a: number, b: string) => `${a}-${b}`);
            const wrapped = withErrorBoundary('args-module', fn);
            
            const result = await wrapped(42, 'test');
            
            expect(result).toBe('42-test');
            expect(fn).toHaveBeenCalledWith(42, 'test');
        });

        it('should catch errors and log them', async () => {
            const error = new Error('Test failure');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('error-module', fn);
            
            await expect(wrapped()).rejects.toThrow('Test failure');
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should record error in breadcrumbs', async () => {
            const error = new Error('Breadcrumb test');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('breadcrumb-module', fn);
            
            try {
                await wrapped();
            } catch {
                // Expected
            }
            
            const { recordError } = await import('../../src/modules/breadcrumbs.ts');
            expect(recordError).toHaveBeenCalledWith(error, 'breadcrumb-module');
        });

        it('should update boundary error stats on failure', async () => {
            const error = new Error('Stats test');
            const fn = vi.fn().mockRejectedValue(error);
            
            registerErrorBoundary('stats-module', vi.fn());
            const wrapped = withErrorBoundary('stats-module', fn);
            
            try {
                await wrapped();
            } catch {
                // Expected
            }
            
            const stats = getErrorStats('stats-module');
            expect(stats.errorCount).toBe(1);
            expect(stats.lastError).toBe(error);
        });

        it('should call fallback function on error', async () => {
            const error = new Error('Fallback test');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn().mockReturnValue('fallback value');
            
            const wrapped = withErrorBoundary('fallback-module', fn, { fallback });
            
            const result = await wrapped();
            
            expect(fallback).toHaveBeenCalledWith(error);
            expect(result).toBe('fallback value');
        });

        it('should call onError handler when provided', async () => {
            const error = new Error('Handler test');
            const fn = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();
            const fallback = vi.fn();
            
            const wrapped = withErrorBoundary('handler-module', fn, { onError, fallback });
            
            await wrapped();
            
            expect(onError).toHaveBeenCalledWith(error, 0);
        });

        it('should handle onError handler that throws', async () => {
            const error = new Error('Original error');
            const fn = vi.fn().mockRejectedValue(error);
            const onError = vi.fn().mockRejectedValue(new Error('Handler error'));
            const fallback = vi.fn().mockReturnValue('recovered');
            
            const wrapped = withErrorBoundary('handler-error-module', fn, { onError, fallback });
            
            // Should not throw because fallback handles it
            const result = await wrapped();
            expect(result).toBe('recovered');
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should not show toast when silent is true', async () => {
            const error = new Error('Silent error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('silent-module', fn, { silent: true });
            
            try {
                await wrapped();
            } catch {
                // Expected
            }
            
            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).not.toHaveBeenCalled();
        });

        it('should show toast when silent is false (default)', async () => {
            const error = new Error('Loud error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('loud-module', fn, { silent: false });
            
            try {
                await wrapped();
            } catch {
                // Expected
            }
            
            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should retry specified number of times', async () => {
            const error = new Error('Retry error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('retry-module', fn, { maxRetries: 2, silent: true });
            
            try {
                await wrapped();
            } catch {
                // Expected
            }
            
            // Original + 2 retries = 3 calls
            expect(fn).toHaveBeenCalledTimes(3);
        }, 15000);

        it('should succeed after retry', async () => {
            let callCount = 0;
            const fn = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 2) {
                    throw new Error('Temporary failure');
                }
                return 'success after retry';
            });
            
            const wrapped = withErrorBoundary('retry-success', fn, { maxRetries: 2, silent: true });
            
            const result = await wrapped();
            
            expect(result).toBe('success after retry');
            expect(fn).toHaveBeenCalledTimes(2);
        }, 15000);

        it('should use registered boundary fallback when no inline fallback', async () => {
            const error = new Error('Boundary fallback test');
            const fn = vi.fn().mockRejectedValue(error);
            const boundaryFallback = vi.fn().mockReturnValue('boundary result');
            
            registerErrorBoundary('boundary-test', boundaryFallback);
            const wrapped = withErrorBoundary('boundary-test', fn);
            
            const result = await wrapped();
            
            expect(boundaryFallback).toHaveBeenCalledWith(error);
            expect(result).toBe('boundary result');
        });

        it('should prefer inline fallback over boundary fallback', async () => {
            const error = new Error('Preference test');
            const fn = vi.fn().mockRejectedValue(error);
            const inlineFallback = vi.fn().mockReturnValue('inline');
            const boundaryFallback = vi.fn().mockReturnValue('boundary');
            
            registerErrorBoundary('preference-test', boundaryFallback);
            const wrapped = withErrorBoundary('preference-test', fn, { fallback: inlineFallback });
            
            const result = await wrapped();
            
            expect(inlineFallback).toHaveBeenCalled();
            expect(boundaryFallback).not.toHaveBeenCalled();
            expect(result).toBe('inline');
        });

        it('should handle fallback that throws', async () => {
            const error = new Error('Original');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn().mockRejectedValue(new Error('Fallback failed'));
            
            const wrapped = withErrorBoundary('fallback-error', fn, { fallback });
            
            await expect(wrapped()).rejects.toThrow('Fallback failed');
        });

        it('should handle boundary fallback that throws', async () => {
            const error = new Error('Original');
            const fn = vi.fn().mockRejectedValue(error);
            const boundaryFallback = vi.fn().mockImplementation(() => {
                throw new Error('Boundary fallback failed');
            });
            
            registerErrorBoundary('boundary-error', boundaryFallback);
            const wrapped = withErrorBoundary('boundary-error', fn);
            
            await expect(wrapped()).rejects.toThrow('Original');
        });
    });

    // ========================================
    // safeModuleInit Tests
    // ========================================
    describe('safeModuleInit', () => {
        it('should successfully initialize module', async () => {
            const initFn = vi.fn().mockReturnValue({ ready: true });
            
            const result = await safeModuleInit('init-success', initFn);
            
            expect(result).toEqual({ ready: true });
            expect(initFn).toHaveBeenCalled();
        });

        it('should handle async initialization', async () => {
            const initFn = vi.fn().mockResolvedValue({ async: true });
            
            const result = await safeModuleInit('async-init', initFn);
            
            expect(result).toEqual({ async: true });
        });

        it('should return degraded result on error with gracefulDegradation', async () => {
            const error = new Error('Init failed');
            const initFn = vi.fn().mockRejectedValue(error);
            
            const result = await safeModuleInit('degraded-init', initFn, { gracefulDegradation: true });
            
            expect(result).toEqual({ degraded: true, error });
        });

        it('should throw on error when gracefulDegradation is false', async () => {
            const error = new Error('Critical failure');
            const initFn = vi.fn().mockRejectedValue(error);
            
            await expect(
                safeModuleInit('no-degrade', initFn, { gracefulDegradation: false })
            ).rejects.toThrow('Critical failure');
        });

        it('should show critical toast for required modules', async () => {
            const error = new Error('Required failure');
            const initFn = vi.fn().mockRejectedValue(error);
            
            await safeModuleInit('required-module', initFn, { required: true });
            
            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalledWith(
                expect.stringContaining('Critical error')
            );
        });

        it('should handle required option without throwing', async () => {
            const error = new Error('Required fail');
            const initFn = vi.fn().mockRejectedValue(error);
            
            // Should not throw even with required: true because gracefulDegradation is true by default
            const result = await safeModuleInit('required-graceful', initFn, { required: true });
            
            expect(result).toEqual({ degraded: true, error });
        });

        it('should log module init failure', async () => {
            const error = new Error('Log test');
            const initFn = vi.fn().mockRejectedValue(error);
            
            await safeModuleInit('log-module', initFn);
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // getErrorStats Tests
    // ========================================
    describe('getErrorStats', () => {
        it('should return default stats for unregistered module', () => {
            const stats = getErrorStats('unknown-module');
            
            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should return correct stats after errors', async () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const fn = vi.fn()
                .mockRejectedValueOnce(error1)
                .mockRejectedValueOnce(error2);
            const fallback = vi.fn();
            
            registerErrorBoundary('multi-error', vi.fn());
            const wrapped = withErrorBoundary('multi-error', fn, { fallback });
            
            await wrapped();
            await wrapped();
            
            const stats = getErrorStats('multi-error');
            expect(stats.errorCount).toBe(2);
            expect(stats.lastError).toBe(error2);
        });
    });

    // ========================================
    // resetErrorStats Tests
    // ========================================
    describe('resetErrorStats', () => {
        it('should reset error count to zero', async () => {
            const error = new Error('Reset test');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn();
            
            registerErrorBoundary('reset-module', vi.fn());
            const wrapped = withErrorBoundary('reset-module', fn, { fallback });
            
            await wrapped();
            expect(getErrorStats('reset-module').errorCount).toBe(1);
            
            resetErrorStats('reset-module');
            
            const stats = getErrorStats('reset-module');
            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should not throw for unregistered module', () => {
            expect(() => resetErrorStats('nonexistent')).not.toThrow();
        });
    });

    // ========================================
    // getAllErrorBoundaries Tests
    // ========================================
    describe('getAllErrorBoundaries', () => {
        it('should return a Map', () => {
            const boundaries = getAllErrorBoundaries();
            expect(boundaries instanceof Map).toBe(true);
        });

        it('should return a copy (not the original)', () => {
            registerErrorBoundary('copy-test', vi.fn());
            
            const boundaries = getAllErrorBoundaries();
            boundaries.delete('copy-test');
            
            const fresh = getAllErrorBoundaries();
            expect(fresh.has('copy-test')).toBe(true);
        });

        it('should contain all registered boundaries', () => {
            registerErrorBoundary('boundary-a', vi.fn());
            registerErrorBoundary('boundary-b', vi.fn());
            registerErrorBoundary('boundary-c', vi.fn());
            
            const boundaries = getAllErrorBoundaries();
            
            expect(boundaries.has('boundary-a')).toBe(true);
            expect(boundaries.has('boundary-b')).toBe(true);
            expect(boundaries.has('boundary-c')).toBe(true);
        });
    });

    // ========================================
    // buildErrorReport Tests
    // ========================================
    describe('buildErrorReport', () => {
        it('should build a complete error report', async () => {
            const error = new Error('Report test error');
            error.stack = 'Error: Report test error\n    at test.js:1:1';
            
            const report = buildErrorReport(error, 'report-module');
            
            expect(report.timestamp).toBeGreaterThan(0);
            expect(report.error.name).toBe('Error');
            expect(report.error.message).toBe('Report test error');
            expect(report.error.stack).toBeDefined();
            expect(report.error.module).toBe('report-module');
            expect(report.stateSnapshot).toBeDefined();
            expect(Array.isArray(report.breadcrumbs)).toBe(true);
            expect(report.context).toBe('report-module');
            expect(report.sessionId).toBe('test-session-123');
        });

        it('should record error in breadcrumbs', async () => {
            const error = new Error('Breadcrumb report');
            
            buildErrorReport(error, 'breadcrumb-report');
            
            const { recordError } = await import('../../src/modules/breadcrumbs.ts');
            expect(recordError).toHaveBeenCalledWith(error, 'breadcrumb-report');
        });

        it('should capture state snapshot', async () => {
            const error = new Error('Snapshot test');
            
            const report = buildErrorReport(error);
            
            expect(report.stateSnapshot).toEqual({
                currentTab: 'items',
                filterState: { rarity: 'all' },
                timestamp: expect.any(Number),
            });
        });

        it('should include recent breadcrumbs', async () => {
            const error = new Error('Breadcrumbs test');
            
            const report = buildErrorReport(error);
            
            expect(report.breadcrumbs.length).toBeGreaterThan(0);
            expect(report.breadcrumbs[0]).toHaveProperty('type');
            expect(report.breadcrumbs[0]).toHaveProperty('message');
        });

        it('should work without module name', async () => {
            const error = new Error('No module');
            
            const report = buildErrorReport(error);
            
            expect(report.error.module).toBeUndefined();
            expect(report.context).toBeUndefined();
        });
    });

    // ========================================
    // exportErrorReport Tests
    // ========================================
    describe('exportErrorReport', () => {
        it('should export report as JSON string', () => {
            const error = new Error('Export test');
            
            const json = exportErrorReport(error, 'export-module');
            
            expect(typeof json).toBe('string');
            const parsed = JSON.parse(json);
            expect(parsed.error.message).toBe('Export test');
            expect(parsed.error.module).toBe('export-module');
        });

        it('should produce valid JSON', () => {
            const error = new Error('JSON validity');
            
            const json = exportErrorReport(error);
            
            expect(() => JSON.parse(json)).not.toThrow();
        });

        it('should include all report fields in export', () => {
            const error = new Error('Full export');
            error.stack = 'test stack';
            
            const json = exportErrorReport(error, 'full-module');
            const parsed = JSON.parse(json);
            
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('error');
            expect(parsed).toHaveProperty('stateSnapshot');
            expect(parsed).toHaveProperty('breadcrumbs');
            expect(parsed).toHaveProperty('sessionId');
        });

        it('should format JSON with indentation', () => {
            const error = new Error('Formatted');
            
            const json = exportErrorReport(error);
            
            // Should contain newlines from JSON.stringify(x, null, 2)
            expect(json).toContain('\n');
        });
    });

    // ========================================
    // initGlobalErrorHandlers Tests
    // ========================================
    describe('initGlobalErrorHandlers', () => {
        let unhandledRejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;
        let errorHandler: ((e: ErrorEvent) => void) | null = null;
        const originalAddEventListener = window.addEventListener;
        
        beforeEach(() => {
            // Mock addEventListener to capture handlers
            window.addEventListener = vi.fn((type: string, handler: any) => {
                if (type === 'unhandledrejection') {
                    unhandledRejectionHandler = handler;
                } else if (type === 'error') {
                    errorHandler = handler;
                }
            });
        });
        
        afterEach(() => {
            window.addEventListener = originalAddEventListener;
            unhandledRejectionHandler = null;
            errorHandler = null;
        });

        it('should register unhandledrejection handler', () => {
            initGlobalErrorHandlers();
            
            expect(window.addEventListener).toHaveBeenCalledWith(
                'unhandledrejection',
                expect.any(Function)
            );
        });

        it('should register error handler', () => {
            initGlobalErrorHandlers();
            
            expect(window.addEventListener).toHaveBeenCalledWith(
                'error',
                expect.any(Function)
            );
        });

        it('should log initialization info', async () => {
            initGlobalErrorHandlers();
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.info).toHaveBeenCalledWith({
                operation: 'error.handlers_initialized',
                data: { handlers: ['unhandledrejection', 'error'] },
            });
        });

        it('should handle unhandled promise rejection with Error', async () => {
            initGlobalErrorHandlers();
            
            const error = new Error('Unhandled rejection');
            const event = {
                reason: error,
            } as PromiseRejectionEvent;
            
            if (unhandledRejectionHandler) {
                unhandledRejectionHandler(event);
            }
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'error.unhandled_rejection',
                    error: expect.objectContaining({
                        message: 'Unhandled rejection',
                    }),
                })
            );
        });

        it('should handle unhandled promise rejection with non-Error', async () => {
            initGlobalErrorHandlers();
            
            const event = {
                reason: 'string error message',
            } as PromiseRejectionEvent;
            
            if (unhandledRejectionHandler) {
                unhandledRejectionHandler(event);
            }
            
            const { logger } = await import('../../src/modules/logger.ts');
            const { recordError } = await import('../../src/modules/breadcrumbs.ts');
            
            expect(recordError).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle uncaught error event', async () => {
            initGlobalErrorHandlers();
            
            const error = new Error('Uncaught error');
            const event = {
                error,
                message: 'Uncaught error',
                filename: 'test.js',
                lineno: 42,
                colno: 10,
            } as ErrorEvent;
            
            if (errorHandler) {
                errorHandler(event);
            }
            
            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'error.uncaught',
                    data: expect.objectContaining({
                        filename: 'test.js',
                        lineno: 42,
                        colno: 10,
                    }),
                })
            );
        });

        it('should handle error event without error object', async () => {
            initGlobalErrorHandlers();
            
            const event = {
                error: null,
                message: 'Script error',
                filename: 'unknown.js',
                lineno: 0,
                colno: 0,
            } as ErrorEvent;
            
            if (errorHandler) {
                errorHandler(event);
            }
            
            const { recordError } = await import('../../src/modules/breadcrumbs.ts');
            expect(recordError).toHaveBeenCalled();
        });
    });

    // ========================================
    // Type Export Tests
    // ========================================
    describe('Type Exports', () => {
        it('should export ErrorBoundaryOptions type', () => {
            const options: ErrorBoundaryOptions = {
                fallback: (error) => error.message,
                silent: true,
                maxRetries: 3,
                onError: async (error, retries) => {},
            };
            expect(options.silent).toBe(true);
        });

        it('should export ModuleInitOptions type', () => {
            const options: ModuleInitOptions = {
                required: true,
                gracefulDegradation: false,
            };
            expect(options.required).toBe(true);
        });

        it('should export ErrorStats type', () => {
            const stats: ErrorStats = {
                errorCount: 5,
                lastError: new Error('test'),
            };
            expect(stats.errorCount).toBe(5);
        });

        it('should export ErrorReport type', () => {
            const report: ErrorReport = {
                timestamp: Date.now(),
                error: {
                    name: 'Error',
                    message: 'Test',
                    stack: 'stack trace',
                    module: 'test-module',
                },
                stateSnapshot: {},
                breadcrumbs: [],
                context: 'test',
                sessionId: 'session-123',
            };
            expect(report.timestamp).toBeGreaterThan(0);
        });
    });
});
