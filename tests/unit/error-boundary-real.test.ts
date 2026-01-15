/**
 * Real Integration Tests for Error Boundary Module
 * No mocking - tests actual error boundary implementations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    registerErrorBoundary,
    withErrorBoundary,
    safeModuleInit,
    getErrorStats,
    resetErrorStats,
    getAllErrorBoundaries,
    type ErrorBoundaryOptions,
    type ModuleInitOptions,
} from '../../src/modules/error-boundary.ts';

// ========================================
// registerErrorBoundary Tests
// ========================================

describe('registerErrorBoundary - Real Integration Tests', () => {
    beforeEach(() => {
        // Reset any existing boundaries
        const boundaries = getAllErrorBoundaries();
        boundaries.forEach((_, key) => {
            resetErrorStats(key);
        });
    });

    it('should register a new error boundary', () => {
        const fallback = vi.fn();
        registerErrorBoundary('testModule', fallback);

        const stats = getErrorStats('testModule');
        expect(stats.errorCount).toBe(0);
        expect(stats.lastError).toBeNull();
    });

    it('should overwrite existing boundary', () => {
        const fallback1 = vi.fn();
        const fallback2 = vi.fn();

        registerErrorBoundary('overwriteModule', fallback1);
        registerErrorBoundary('overwriteModule', fallback2);

        // Boundary is registered (stats should still be fresh)
        const stats = getErrorStats('overwriteModule');
        expect(stats.errorCount).toBe(0);
    });

    it('should handle multiple different boundaries', () => {
        registerErrorBoundary('module1', vi.fn());
        registerErrorBoundary('module2', vi.fn());
        registerErrorBoundary('module3', vi.fn());

        expect(getErrorStats('module1').errorCount).toBe(0);
        expect(getErrorStats('module2').errorCount).toBe(0);
        expect(getErrorStats('module3').errorCount).toBe(0);
    });
});

// ========================================
// withErrorBoundary Tests
// ========================================

describe('withErrorBoundary - Real Integration Tests', () => {
    it('should execute function normally when no error', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const wrapped = withErrorBoundary('normalModule', fn);

        const result = await wrapped();

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should pass arguments to wrapped function', async () => {
        const fn = vi.fn((a: number, b: string) => Promise.resolve(`${a}-${b}`));
        const wrapped = withErrorBoundary('argsModule', fn);

        const result = await wrapped(42, 'test');

        expect(result).toBe('42-test');
        expect(fn).toHaveBeenCalledWith(42, 'test');
    });

    it('should execute fallback on error', async () => {
        const error = new Error('Test error');
        const fn = vi.fn().mockRejectedValue(error);
        const fallback = vi.fn().mockReturnValue('fallback result');

        const wrapped = withErrorBoundary('fallbackModule', fn, {
            fallback,
            silent: true,
        });

        const result = await wrapped();

        expect(result).toBe('fallback result');
        expect(fallback).toHaveBeenCalledWith(error);
    });

    it('should call onError handler when error occurs', async () => {
        const error = new Error('OnError test');
        const fn = vi.fn().mockRejectedValue(error);
        const onError = vi.fn();

        const wrapped = withErrorBoundary('onErrorModule', fn, {
            onError,
            silent: true,
            fallback: () => 'handled',
        });

        await wrapped();

        expect(onError).toHaveBeenCalledWith(error, 0);
    });

    it('should track error count in boundary stats', async () => {
        const error = new Error('Stats error');
        const fn = vi.fn().mockRejectedValue(error);

        registerErrorBoundary('statsModule', () => 'fallback');

        const wrapped = withErrorBoundary('statsModule', fn, {
            silent: true,
            fallback: () => 'handled',
        });

        await wrapped();

        const stats = getErrorStats('statsModule');
        expect(stats.errorCount).toBe(1);
        expect(stats.lastError?.message).toBe('Stats error');
    });

    it('should rethrow error when no fallback provided', async () => {
        const error = new Error('Rethrow error');
        const fn = vi.fn().mockRejectedValue(error);

        const wrapped = withErrorBoundary('rethrowModule', fn, {
            silent: true,
        });

        await expect(wrapped()).rejects.toThrow('Rethrow error');
    });

    it('should handle sync functions', async () => {
        const fn = vi.fn().mockReturnValue('sync result');
        const wrapped = withErrorBoundary('syncModule', fn);

        const result = await wrapped();

        expect(result).toBe('sync result');
    });

    it('should retry on failure when maxRetries is set', async () => {
        let callCount = 0;
        const fn = vi.fn(async () => {
            callCount++;
            if (callCount < 3) {
                throw new Error('Retry error');
            }
            return 'success after retry';
        });

        const wrapped = withErrorBoundary('retryModule', fn, {
            maxRetries: 2,
            silent: true,
        });

        const result = await wrapped();

        expect(result).toBe('success after retry');
        expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 15000); // Increase timeout for retries

    it('should fail after max retries exceeded', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

        const wrapped = withErrorBoundary('maxRetryModule', fn, {
            maxRetries: 1,
            silent: true,
        });

        await expect(wrapped()).rejects.toThrow('Always fails');
        expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    }, 15000);
});

// ========================================
// safeModuleInit Tests
// ========================================

describe('safeModuleInit - Real Integration Tests', () => {
    it('should initialize module successfully', async () => {
        const initFn = vi.fn().mockResolvedValue({ initialized: true });

        const result = await safeModuleInit('successModule', initFn);

        expect(result).toEqual({ initialized: true });
        expect(initFn).toHaveBeenCalledOnce();
    });

    it('should handle sync init function', async () => {
        const initFn = vi.fn().mockReturnValue('sync init');

        const result = await safeModuleInit('syncInitModule', initFn);

        expect(result).toBe('sync init');
    });

    it('should return degraded result on failure with graceful degradation', async () => {
        const initFn = vi.fn().mockRejectedValue(new Error('Init failed'));

        const result = await safeModuleInit('degradedModule', initFn, {
            gracefulDegradation: true,
        });

        expect(result).toHaveProperty('degraded', true);
        expect(result).toHaveProperty('error');
    });

    it('should throw when required module fails', async () => {
        const initFn = vi.fn().mockRejectedValue(new Error('Required init failed'));

        await expect(
            safeModuleInit('requiredModule', initFn, {
                required: true,
                gracefulDegradation: false,
            })
        ).rejects.toThrow('Required init failed');
    });

    it('should not throw when non-required module fails', async () => {
        const initFn = vi.fn().mockRejectedValue(new Error('Non-required failed'));

        const result = await safeModuleInit('nonRequiredModule', initFn, {
            required: false,
            gracefulDegradation: true,
        });

        expect(result).toHaveProperty('degraded', true);
    });
});

// ========================================
// getErrorStats Tests
// ========================================

describe('getErrorStats - Real Integration Tests', () => {
    it('should return zero stats for unregistered module', () => {
        const stats = getErrorStats('unregisteredModule');

        expect(stats.errorCount).toBe(0);
        expect(stats.lastError).toBeNull();
    });

    it('should return current stats for registered module', async () => {
        const error = new Error('Track this');
        registerErrorBoundary('trackedModule', () => 'handled');

        const fn = vi.fn().mockRejectedValue(error);
        const wrapped = withErrorBoundary('trackedModule', fn, {
            silent: true,
            fallback: () => 'ok',
        });

        await wrapped();

        const stats = getErrorStats('trackedModule');
        expect(stats.errorCount).toBe(1);
        expect(stats.lastError?.message).toBe('Track this');
    });

    it('should track multiple errors', async () => {
        registerErrorBoundary('multiErrorModule', () => 'handled');

        const fn = vi.fn().mockRejectedValue(new Error('Error'));
        const wrapped = withErrorBoundary('multiErrorModule', fn, {
            silent: true,
            fallback: () => 'ok',
        });

        await wrapped();
        await wrapped();
        await wrapped();

        const stats = getErrorStats('multiErrorModule');
        expect(stats.errorCount).toBe(3);
    });
});

// ========================================
// resetErrorStats Tests
// ========================================

describe('resetErrorStats - Real Integration Tests', () => {
    it('should reset error count and last error', async () => {
        registerErrorBoundary('resetModule', () => 'handled');

        const fn = vi.fn().mockRejectedValue(new Error('Error to reset'));
        const wrapped = withErrorBoundary('resetModule', fn, {
            silent: true,
            fallback: () => 'ok',
        });

        await wrapped();

        resetErrorStats('resetModule');

        const stats = getErrorStats('resetModule');
        expect(stats.errorCount).toBe(0);
        expect(stats.lastError).toBeNull();
    });

    it('should not throw for unregistered module', () => {
        expect(() => resetErrorStats('unknownModule')).not.toThrow();
    });
});

// ========================================
// getAllErrorBoundaries Tests
// ========================================

describe('getAllErrorBoundaries - Real Integration Tests', () => {
    it('should return all registered boundaries', () => {
        registerErrorBoundary('boundary1', vi.fn());
        registerErrorBoundary('boundary2', vi.fn());

        const boundaries = getAllErrorBoundaries();

        expect(boundaries.has('boundary1')).toBe(true);
        expect(boundaries.has('boundary2')).toBe(true);
    });

    it('should return a copy (not the original map)', () => {
        registerErrorBoundary('copyTestModule', vi.fn());

        const boundaries1 = getAllErrorBoundaries();
        const boundaries2 = getAllErrorBoundaries();

        expect(boundaries1).not.toBe(boundaries2);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Error Boundary Edge Cases', () => {
    it('should handle async fallback function', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Async fallback error'));
        const asyncFallback = vi.fn().mockResolvedValue('async fallback result');

        const wrapped = withErrorBoundary('asyncFallbackModule', fn, {
            fallback: asyncFallback,
            silent: true,
        });

        const result = await wrapped();

        expect(result).toBe('async fallback result');
    });

    it('should handle fallback that throws', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Original error'));
        const throwingFallback = vi.fn().mockRejectedValue(new Error('Fallback error'));

        const wrapped = withErrorBoundary('throwingFallbackModule', fn, {
            fallback: throwingFallback,
            silent: true,
        });

        // Should rethrow the original error when fallback also fails
        await expect(wrapped()).rejects.toThrow('Original error');
    });

    it('should handle onError that throws', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Main error'));
        const throwingOnError = vi.fn().mockRejectedValue(new Error('Handler error'));

        const wrapped = withErrorBoundary('throwingOnErrorModule', fn, {
            onError: throwingOnError,
            silent: true,
            fallback: () => 'recovered',
        });

        // Should still call fallback even if onError throws
        const result = await wrapped();
        expect(result).toBe('recovered');
    });

    it('should handle empty error message', async () => {
        const fn = vi.fn().mockRejectedValue(new Error(''));

        const wrapped = withErrorBoundary('emptyErrorModule', fn, {
            silent: true,
            fallback: () => 'handled',
        });

        const result = await wrapped();
        expect(result).toBe('handled');
    });

    it('should handle non-Error thrown values', async () => {
        const fn = vi.fn().mockRejectedValue('string error');

        const wrapped = withErrorBoundary('stringErrorModule', fn, {
            silent: true,
            fallback: () => 'handled non-error',
        });

        const result = await wrapped();
        expect(result).toBe('handled non-error');
    });
});

// ========================================
// Type Safety Tests
// ========================================

describe('Error Boundary Type Safety', () => {
    it('should preserve function return type', async () => {
        const fn = async (): Promise<{ count: number; name: string }> => ({
            count: 42,
            name: 'test',
        });

        const wrapped = withErrorBoundary('typeModule', fn);
        const result = await wrapped();

        expect(result?.count).toBe(42);
        expect(result?.name).toBe('test');
    });

    it('should preserve function argument types', async () => {
        const fn = async (a: number, b: string, c: boolean): Promise<string> => {
            return `${a}-${b}-${c}`;
        };

        const wrapped = withErrorBoundary('argTypeModule', fn);
        const result = await wrapped(1, 'two', true);

        expect(result).toBe('1-two-true');
    });
});
