import { describe, it, expect, beforeEach, vi } from 'vitest';

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
} from '../../src/modules/error-boundary.ts';

describe('Error Boundary Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all boundaries between tests
        getAllErrorBoundaries().forEach((_, key) => {
            resetErrorStats(key);
        });
    });

    describe('registerErrorBoundary()', () => {
        it('should register a new error boundary', () => {
            const fallbackFn = vi.fn();
            registerErrorBoundary('test-module', fallbackFn);

            const boundaries = getAllErrorBoundaries();
            expect(boundaries.has('test-module')).toBe(true);
        });

        it('should initialize with zero error count', () => {
            registerErrorBoundary('test-module-2', vi.fn());

            const stats = getErrorStats('test-module-2');
            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should overwrite existing boundary', () => {
            const firstFallback = vi.fn();
            const secondFallback = vi.fn();

            registerErrorBoundary('overwrite-test', firstFallback);
            registerErrorBoundary('overwrite-test', secondFallback);

            const boundaries = getAllErrorBoundaries();
            const boundary = boundaries.get('overwrite-test');
            expect(boundary.fallback).toBe(secondFallback);
        });
    });

    describe('withErrorBoundary()', () => {
        it('should execute function successfully', async () => {
            const fn = vi.fn().mockResolvedValue('success');
            const wrapped = withErrorBoundary('success-test', fn);

            const result = await wrapped();

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalled();
        });

        it('should pass arguments to wrapped function', async () => {
            const fn = vi.fn().mockImplementation((a, b) => a + b);
            const wrapped = withErrorBoundary('args-test', fn);

            const result = await wrapped(2, 3);

            expect(result).toBe(5);
            expect(fn).toHaveBeenCalledWith(2, 3);
        });

        it('should catch and log errors', async () => {
            const error = new Error('Test error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('error-test', fn);

            await expect(wrapped()).rejects.toThrow('Test error');

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should update error stats when error occurs', async () => {
            const error = new Error('Stats error');
            const fn = vi.fn().mockRejectedValue(error);

            registerErrorBoundary('stats-test', vi.fn());
            const wrapped = withErrorBoundary('stats-test', fn);

            try {
                await wrapped();
            } catch {
                // Expected to throw
            }

            const stats = getErrorStats('stats-test');
            expect(stats.errorCount).toBe(1);
            expect(stats.lastError).toBe(error);
        });

        it('should call fallback function on error', async () => {
            const error = new Error('Fallback error');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn().mockReturnValue('fallback result');

            const wrapped = withErrorBoundary('fallback-test', fn, { fallback });

            const result = await wrapped();

            expect(fallback).toHaveBeenCalledWith(error);
            expect(result).toBe('fallback result');
        });

        it('should call onError handler on error', async () => {
            const error = new Error('Handler error');
            const fn = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();
            const fallback = vi.fn();

            const wrapped = withErrorBoundary('handler-test', fn, { onError, fallback });

            await wrapped();

            expect(onError).toHaveBeenCalledWith(error, 0);
        });

        it('should not show toast when silent is true', async () => {
            const error = new Error('Silent error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('silent-test', fn, { silent: true });

            try {
                await wrapped();
            } catch {
                // Expected to throw
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).not.toHaveBeenCalled();
        });

        it('should show toast when not silent', async () => {
            const error = new Error('Loud error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('loud-test', fn, { silent: false });

            try {
                await wrapped();
            } catch {
                // Expected to throw
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should retry specified number of times', async () => {
            const error = new Error('Retry error');
            const fn = vi.fn().mockRejectedValue(error);
            const wrapped = withErrorBoundary('retry-test', fn, { maxRetries: 2, silent: true });

            try {
                await wrapped();
            } catch {
                // Expected to throw
            }

            // Original call + 2 retries = 3 calls
            expect(fn).toHaveBeenCalledTimes(3);
        }, 15000); // Increase timeout for retry delays

        it('should succeed on retry', async () => {
            let attempts = 0;
            const fn = vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Temporary error');
                }
                return 'success on retry';
            });

            const wrapped = withErrorBoundary('retry-success-test', fn, { maxRetries: 2, silent: true });

            const result = await wrapped();

            expect(result).toBe('success on retry');
            expect(fn).toHaveBeenCalledTimes(2);
        }, 15000);

        it('should use registered boundary fallback', async () => {
            const error = new Error('Boundary error');
            const fn = vi.fn().mockRejectedValue(error);
            const boundaryFallback = vi.fn().mockReturnValue('boundary fallback result');

            registerErrorBoundary('boundary-fallback-test', boundaryFallback);
            const wrapped = withErrorBoundary('boundary-fallback-test', fn);

            const result = await wrapped();

            expect(boundaryFallback).toHaveBeenCalledWith(error);
            expect(result).toBe('boundary fallback result');
        });

        it('should prefer inline fallback over boundary fallback', async () => {
            const error = new Error('Preference error');
            const fn = vi.fn().mockRejectedValue(error);
            const inlineFallback = vi.fn().mockReturnValue('inline result');
            const boundaryFallback = vi.fn().mockReturnValue('boundary result');

            registerErrorBoundary('preference-test', boundaryFallback);
            const wrapped = withErrorBoundary('preference-test', fn, { fallback: inlineFallback });

            const result = await wrapped();

            expect(inlineFallback).toHaveBeenCalled();
            expect(boundaryFallback).not.toHaveBeenCalled();
            expect(result).toBe('inline result');
        });
    });

    describe('safeModuleInit()', () => {
        it('should successfully initialize module', async () => {
            const initFn = vi.fn().mockReturnValue({ initialized: true });

            const result = await safeModuleInit('init-success', initFn);

            expect(result).toEqual({ initialized: true });
        });

        it('should return degraded result on error when gracefulDegradation is true', async () => {
            const error = new Error('Init error');
            const initFn = vi.fn().mockRejectedValue(error);

            const result = await safeModuleInit('init-degraded', initFn, { gracefulDegradation: true });

            expect(result).toEqual({ degraded: true, error });
        });

        it('should show critical toast for required modules', async () => {
            const error = new Error('Critical error');
            const initFn = vi.fn().mockRejectedValue(error);

            await safeModuleInit('critical-test', initFn, { required: true });

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Critical error'));
        });

        it('should handle async init functions', async () => {
            const initFn = vi.fn().mockResolvedValue({ async: true });

            const result = await safeModuleInit('async-init', initFn);

            expect(result).toEqual({ async: true });
        });
    });

    describe('getErrorStats()', () => {
        it('should return default stats for unregistered module', () => {
            const stats = getErrorStats('unregistered-module');

            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should return correct stats for registered module', async () => {
            const error = new Error('Tracked error');
            const fn = vi.fn().mockRejectedValue(error);

            registerErrorBoundary('tracked-module', vi.fn());
            const wrapped = withErrorBoundary('tracked-module', fn);

            try {
                await wrapped();
            } catch {
                // Expected to throw
            }

            const stats = getErrorStats('tracked-module');
            expect(stats.errorCount).toBe(1);
            expect(stats.lastError).toBe(error);
        });

        it('should accumulate error count', async () => {
            const error = new Error('Multiple error');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn().mockReturnValue(null);

            registerErrorBoundary('accumulate-test', vi.fn());
            const wrapped = withErrorBoundary('accumulate-test', fn, { fallback });

            await wrapped();
            await wrapped();
            await wrapped();

            const stats = getErrorStats('accumulate-test');
            expect(stats.errorCount).toBe(3);
        });
    });

    describe('resetErrorStats()', () => {
        it('should reset error stats to zero', async () => {
            const error = new Error('Reset error');
            const fn = vi.fn().mockRejectedValue(error);
            const fallback = vi.fn();

            registerErrorBoundary('reset-test', vi.fn());
            const wrapped = withErrorBoundary('reset-test', fn, { fallback });

            await wrapped();

            resetErrorStats('reset-test');

            const stats = getErrorStats('reset-test');
            expect(stats.errorCount).toBe(0);
            expect(stats.lastError).toBeNull();
        });

        it('should not throw for unregistered module', () => {
            expect(() => resetErrorStats('nonexistent')).not.toThrow();
        });
    });

    describe('getAllErrorBoundaries()', () => {
        it('should return a Map of all boundaries', () => {
            registerErrorBoundary('boundary-1', vi.fn());
            registerErrorBoundary('boundary-2', vi.fn());

            const boundaries = getAllErrorBoundaries();

            expect(boundaries instanceof Map).toBe(true);
            expect(boundaries.has('boundary-1')).toBe(true);
            expect(boundaries.has('boundary-2')).toBe(true);
        });

        it('should return a copy (not modify original)', () => {
            registerErrorBoundary('original-boundary', vi.fn());

            const boundaries = getAllErrorBoundaries();
            boundaries.delete('original-boundary');

            const freshBoundaries = getAllErrorBoundaries();
            expect(freshBoundaries.has('original-boundary')).toBe(true);
        });
    });
});
