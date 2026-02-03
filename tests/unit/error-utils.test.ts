/**
 * Error Utilities Tests
 * Tests for error handling patterns: extraction, logging, and wrappers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    extractErrorInfo,
    logError,
    logWarning,
    withErrorLogging,
    tryOrDefault,
    tryOrDefaultAsync,
    type ErrorInfo,
} from '../../src/modules/error-utils.ts';
import { logger } from '../../src/modules/logger.ts';

// Mock the logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

// ========================================
// extractErrorInfo Tests
// ========================================

describe('extractErrorInfo', () => {
    it('should extract info from Error object', () => {
        const error = new Error('Test error message');
        const info = extractErrorInfo(error);

        expect(info.name).toBe('Error');
        expect(info.message).toBe('Test error message');
        expect(info.stack).toBeDefined();
    });

    it('should extract info from TypeError', () => {
        const error = new TypeError('Cannot read property');
        const info = extractErrorInfo(error);

        expect(info.name).toBe('TypeError');
        expect(info.message).toBe('Cannot read property');
    });

    it('should extract info from custom error', () => {
        class CustomError extends Error {
            constructor(message: string) {
                super(message);
                this.name = 'CustomError';
            }
        }

        const error = new CustomError('Custom message');
        const info = extractErrorInfo(error);

        expect(info.name).toBe('CustomError');
        expect(info.message).toBe('Custom message');
    });

    it('should handle string errors', () => {
        const info = extractErrorInfo('Plain string error');

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('Plain string error');
        expect(info.stack).toBeUndefined();
    });

    it('should handle number errors', () => {
        const info = extractErrorInfo(404);

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('404');
    });

    it('should handle object errors', () => {
        const info = extractErrorInfo({ code: 'ERR', reason: 'failed' });

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('[object Object]');
    });

    it('should handle null', () => {
        const info = extractErrorInfo(null);

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('null');
    });

    it('should handle undefined', () => {
        const info = extractErrorInfo(undefined);

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('undefined');
    });

    it('should limit stack trace lines', () => {
        const error = new Error('Test');
        // Create error with long stack
        Error.captureStackTrace?.(error);

        const info = extractErrorInfo(error, 3);

        if (info.stack) {
            const arrowCount = (info.stack.match(/ -> /g) || []).length;
            expect(arrowCount).toBeLessThanOrEqual(2); // 3 lines = 2 arrows
        }
    });

    it('should use default 5 stack lines', () => {
        const error = new Error('Test');
        const info = extractErrorInfo(error);

        if (info.stack) {
            const arrowCount = (info.stack.match(/ -> /g) || []).length;
            expect(arrowCount).toBeLessThanOrEqual(4); // 5 lines = 4 arrows
        }
    });
});

// ========================================
// logError Tests
// ========================================

describe('logError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log error with operation name', () => {
        const error = new Error('Test error');
        logError('test.operation', error);

        expect(logger.error).toHaveBeenCalledWith({
            operation: 'test.operation',
            error: expect.objectContaining({
                name: 'Error',
                message: 'Test error',
            }),
            data: undefined,
        });
    });

    it('should log error with additional data', () => {
        const error = new Error('Failed');
        logError('api.call', error, { endpoint: '/users', method: 'GET' });

        expect(logger.error).toHaveBeenCalledWith({
            operation: 'api.call',
            error: expect.objectContaining({
                message: 'Failed',
            }),
            data: { endpoint: '/users', method: 'GET' },
        });
    });

    it('should handle non-Error values', () => {
        logError('unknown.error', 'string error');

        expect(logger.error).toHaveBeenCalledWith({
            operation: 'unknown.error',
            error: {
                name: 'UnknownError',
                message: 'string error',
            },
            data: undefined,
        });
    });

    it('should use dot notation for operation names', () => {
        logError('module.submodule.action', new Error('test'));

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'module.submodule.action',
            })
        );
    });
});

// ========================================
// logWarning Tests
// ========================================

describe('logWarning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log warning with operation name', () => {
        const error = new Error('Warning message');
        logWarning('validation.warning', error);

        expect(logger.warn).toHaveBeenCalledWith({
            operation: 'validation.warning',
            error: expect.objectContaining({
                name: 'Error',
                message: 'Warning message',
            }),
            data: undefined,
        });
    });

    it('should log warning with additional data', () => {
        logWarning('cache.miss', new Error('Not found'), { key: 'user-123' });

        expect(logger.warn).toHaveBeenCalledWith({
            operation: 'cache.miss',
            error: expect.objectContaining({
                message: 'Not found',
            }),
            data: { key: 'user-123' },
        });
    });

    it('should handle string errors', () => {
        logWarning('soft.error', 'Something went slightly wrong');

        expect(logger.warn).toHaveBeenCalledWith({
            operation: 'soft.error',
            error: {
                name: 'UnknownError',
                message: 'Something went slightly wrong',
            },
            data: undefined,
        });
    });
});

// ========================================
// withErrorLogging Tests
// ========================================

describe('withErrorLogging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass through successful result', async () => {
        const fn = async () => 'success';
        const wrapped = withErrorLogging('test.operation', fn);

        const result = await wrapped();
        expect(result).toBe('success');
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log and return undefined on error', async () => {
        const fn = async () => {
            throw new Error('Failed');
        };
        const wrapped = withErrorLogging('test.operation', fn);

        const result = await wrapped();

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith({
            operation: 'test.operation',
            error: expect.objectContaining({
                message: 'Failed',
            }),
            data: undefined,
        });
    });

    it('should call onError callback', async () => {
        const onError = vi.fn();
        const fn = async () => {
            throw new Error('Callback test');
        };
        const wrapped = withErrorLogging('test.operation', fn, onError);

        await wrapped();

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Error',
                message: 'Callback test',
            })
        );
    });

    it('should pass arguments through', async () => {
        const fn = async (a: number, b: string) => `${b}-${a}`;
        const wrapped = withErrorLogging('test.operation', fn);

        const result = await wrapped(42, 'hello');
        expect(result).toBe('hello-42');
    });

    it('should preserve return types', async () => {
        interface User {
            id: string;
            name: string;
        }

        const fn = async (): Promise<User> => ({ id: '1', name: 'Test' });
        const wrapped = withErrorLogging('user.get', fn);

        const result = await wrapped();
        expect(result?.id).toBe('1');
        expect(result?.name).toBe('Test');
    });

    it('should catch and log different error types', async () => {
        const typeErrorFn = async () => {
            throw new TypeError('Type mismatch');
        };
        const wrapped = withErrorLogging('type.error', typeErrorFn);

        await wrapped();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    name: 'TypeError',
                    message: 'Type mismatch',
                }),
            })
        );
    });
});

// ========================================
// tryOrDefault Tests
// ========================================

describe('tryOrDefault', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return function result on success', () => {
        const result = tryOrDefault(() => 42, 0);
        expect(result).toBe(42);
    });

    it('should return default on error', () => {
        const result = tryOrDefault(() => {
            throw new Error('Fail');
        }, 'default');

        expect(result).toBe('default');
    });

    it('should not log when no operation provided', () => {
        tryOrDefault(() => {
            throw new Error('Fail');
        }, 'default');

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when operation provided', () => {
        tryOrDefault(() => {
            throw new Error('Logged fail');
        }, 'default', 'test.operation');

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'test.operation',
            })
        );
    });

    it('should handle complex default values', () => {
        interface Config {
            setting: string;
            value: number;
        }

        const defaultConfig: Config = { setting: 'default', value: 0 };

        const result = tryOrDefault(() => {
            throw new Error('Parse failed');
        }, defaultConfig);

        expect(result).toEqual({ setting: 'default', value: 0 });
    });

    it('should return null as default', () => {
        const result = tryOrDefault(() => {
            throw new Error('Fail');
        }, null);

        expect(result).toBeNull();
    });

    it('should handle JSON parse errors', () => {
        const result = tryOrDefault(
            () => JSON.parse('invalid json'),
            {},
            'json.parse'
        );

        expect(result).toEqual({});
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle property access errors', () => {
        const obj: { nested?: { value: number } } = {};

        const result = tryOrDefault(
            () => obj.nested!.value,
            -1,
            'property.access'
        );

        expect(result).toBe(-1);
    });
});

// ========================================
// tryOrDefaultAsync Tests
// ========================================

describe('tryOrDefaultAsync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return async function result on success', async () => {
        const result = await tryOrDefaultAsync(
            async () => 'async-success',
            'default'
        );

        expect(result).toBe('async-success');
    });

    it('should return default on async error', async () => {
        const result = await tryOrDefaultAsync(
            async () => {
                throw new Error('Async fail');
            },
            'default'
        );

        expect(result).toBe('default');
    });

    it('should not log when no operation provided', async () => {
        await tryOrDefaultAsync(
            async () => {
                throw new Error('Fail');
            },
            'default'
        );

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when operation provided', async () => {
        await tryOrDefaultAsync(
            async () => {
                throw new Error('Logged async fail');
            },
            'default',
            'async.operation'
        );

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'async.operation',
            })
        );
    });

    it('should handle fetch-like errors', async () => {
        const mockFetch = async () => {
            throw new Error('Network error');
        };

        const result = await tryOrDefaultAsync(
            mockFetch,
            { error: true, data: null },
            'api.fetch'
        );

        expect(result).toEqual({ error: true, data: null });
    });

    it('should handle rejected promises', async () => {
        const result = await tryOrDefaultAsync(
            () => Promise.reject(new Error('Rejected')),
            'fallback'
        );

        expect(result).toBe('fallback');
    });

    it('should handle async operations with delay', async () => {
        const result = await tryOrDefaultAsync(
            async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'delayed-success';
            },
            'default'
        );

        expect(result).toBe('delayed-success');
    });

    it('should work with array default', async () => {
        const result = await tryOrDefaultAsync(
            async () => {
                throw new Error('Load failed');
            },
            [] as string[],
            'load.items'
        );

        expect(result).toEqual([]);
        expect(Array.isArray(result)).toBe(true);
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Error Utils Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should chain error handling utilities', async () => {
        const onErrorCallback = vi.fn();

        // Simulate a data loading pipeline
        const loadData = withErrorLogging(
            'data.load',
            async () => {
                const rawData = tryOrDefault(
                    () => JSON.parse('{"value": 42}'),
                    { value: 0 },
                    'data.parse'
                );

                if (rawData.value === 0) {
                    throw new Error('Invalid data');
                }

                return rawData;
            },
            onErrorCallback
        );

        const result = await loadData();

        expect(result).toEqual({ value: 42 });
        expect(onErrorCallback).not.toHaveBeenCalled();
    });

    it('should handle nested errors gracefully', async () => {
        const processData = async () => {
            // First try with invalid JSON
            const step1 = tryOrDefault(
                () => JSON.parse('invalid'),
                null,
                'step1.parse'
            );

            if (!step1) {
                // Fallback to tryOrDefaultAsync
                return tryOrDefaultAsync(
                    async () => {
                        throw new Error('Fallback also failed');
                    },
                    { fallback: true },
                    'step2.fallback'
                );
            }

            return step1;
        };

        const result = await processData();

        expect(result).toEqual({ fallback: true });
        expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should extract and report errors consistently', () => {
        const errors: ErrorInfo[] = [];

        const onError = (info: ErrorInfo) => {
            errors.push(info);
        };

        // Test various error types
        const testCases = [
            new Error('Standard'),
            new TypeError('Type'),
            'string error',
            { custom: 'object' },
            null,
        ];

        testCases.forEach((error, index) => {
            const info = extractErrorInfo(error);
            onError(info);
        });

        expect(errors.length).toBe(5);
        expect(errors[0].name).toBe('Error');
        expect(errors[1].name).toBe('TypeError');
        expect(errors[2].name).toBe('UnknownError');
        expect(errors[3].name).toBe('UnknownError');
        expect(errors[4].name).toBe('UnknownError');
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Error Utils Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle error with no message', () => {
        const error = new Error();
        const info = extractErrorInfo(error);

        expect(info.message).toBe('');
    });

    it('should handle error with empty string message', () => {
        const error = new Error('');
        const info = extractErrorInfo(error);

        expect(info.message).toBe('');
    });

    it('should handle circular reference in error context', () => {
        // This shouldn't throw when logging
        const circularObj: Record<string, unknown> = {};
        circularObj.self = circularObj;

        // extractErrorInfo handles objects by stringifying
        expect(() => extractErrorInfo(circularObj)).not.toThrow();
    });

    it('should handle very long error messages', () => {
        const longMessage = 'x'.repeat(10000);
        const error = new Error(longMessage);
        const info = extractErrorInfo(error);

        expect(info.message).toBe(longMessage);
    });

    it('should handle symbols as errors', () => {
        const sym = Symbol('error');
        const info = extractErrorInfo(sym);

        expect(info.name).toBe('UnknownError');
        expect(info.message).toBe('Symbol(error)');
    });

    it('should handle BigInt as errors', () => {
        const info = extractErrorInfo(BigInt(12345678901234567890n));

        expect(info.name).toBe('UnknownError');
        expect(info.message).toContain('12345678901234567890');
    });
});
