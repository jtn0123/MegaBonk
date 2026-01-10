/* global setTimeout */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, Logger, LogLevel } from '../../src/modules/logger.ts';

describe('Logger Module', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // Spy on console methods
        consoleSpy = {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
            info: vi.spyOn(console, 'info').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('LogLevel enum', () => {
        it('should have correct values', () => {
            expect(LogLevel.DEBUG).toBe(0);
            expect(LogLevel.INFO).toBe(1);
            expect(LogLevel.WARN).toBe(2);
            expect(LogLevel.ERROR).toBe(3);
        });
    });

    describe('Logger singleton', () => {
        it('should return same instance via getInstance()', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should export logger as singleton', () => {
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
        });
    });

    describe('configure()', () => {
        it('should update configuration', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            const config = logger.getConfig();
            expect(config.minLevel).toBe(LogLevel.ERROR);

            // Reset for other tests
            logger.configure({ minLevel: LogLevel.DEBUG });
        });

        it('should merge with existing config', () => {
            const originalConfig = logger.getConfig();
            logger.configure({ enableConsole: false });

            const newConfig = logger.getConfig();
            expect(newConfig.enableConsole).toBe(false);
            // Other values should remain
            expect(newConfig.maxContextSize).toBe(originalConfig.maxContextSize);

            // Reset
            logger.configure({ enableConsole: true });
        });
    });

    describe('getConfig()', () => {
        it('should return a copy of config', () => {
            const config1 = logger.getConfig();
            const config2 = logger.getConfig();

            expect(config1).toEqual(config2);
            expect(config1).not.toBe(config2); // Different objects
        });
    });

    describe('logging methods', () => {
        beforeEach(() => {
            logger.configure({ minLevel: LogLevel.DEBUG, enableConsole: true });
        });

        it('should log debug events', () => {
            logger.debug({ operation: 'test.debug' });
            expect(consoleSpy.debug).toHaveBeenCalled();
        });

        it('should log info events', () => {
            logger.info({ operation: 'test.info' });
            expect(consoleSpy.info).toHaveBeenCalled();
        });

        it('should log warn events', () => {
            logger.warn({ operation: 'test.warn' });
            expect(consoleSpy.warn).toHaveBeenCalled();
        });

        it('should log error events', () => {
            logger.error({ operation: 'test.error' });
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('should include operation in logged event', () => {
            logger.info({ operation: 'test.operation', data: { key: 'value' } });
            expect(consoleSpy.info).toHaveBeenCalled();
            // Check that operation is included (last arg contains full event)
            const callArgs = consoleSpy.info.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.operation).toBe('test.operation');
        });
    });

    describe('log level filtering', () => {
        it('should not log events below minLevel', () => {
            logger.configure({ minLevel: LogLevel.WARN, enableConsole: true });

            logger.debug({ operation: 'test.debug' });
            logger.info({ operation: 'test.info' });

            expect(consoleSpy.debug).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();

            // Reset
            logger.configure({ minLevel: LogLevel.DEBUG });
        });

        it('should log events at or above minLevel', () => {
            logger.configure({ minLevel: LogLevel.WARN, enableConsole: true });

            logger.warn({ operation: 'test.warn' });
            logger.error({ operation: 'test.error' });

            expect(consoleSpy.warn).toHaveBeenCalled();
            expect(consoleSpy.error).toHaveBeenCalled();

            // Reset
            logger.configure({ minLevel: LogLevel.DEBUG });
        });
    });

    describe('context management', () => {
        afterEach(() => {
            // Clean up any context set during tests
            logger.clearContext('testKey');
            logger.clearContext('anotherKey');
        });

        it('should set context values', () => {
            logger.setContext('testKey', 'testValue');
            const context = logger.getContext();
            expect(context.testKey).toBe('testValue');
        });

        it('should clear context values', () => {
            logger.setContext('testKey', 'testValue');
            logger.clearContext('testKey');
            const context = logger.getContext();
            expect(context.testKey).toBeUndefined();
        });

        it('should return copy of context', () => {
            logger.setContext('anotherKey', 'value');
            const context1 = logger.getContext();
            const context2 = logger.getContext();

            expect(context1).toEqual(context2);
            expect(context1).not.toBe(context2);
        });
    });

    describe('getSessionId()', () => {
        it('should return a string', () => {
            const sessionId = logger.getSessionId();
            expect(typeof sessionId).toBe('string');
        });

        it('should return consistent session ID', () => {
            const sessionId1 = logger.getSessionId();
            const sessionId2 = logger.getSessionId();
            expect(sessionId1).toBe(sessionId2);
        });

        it('should include timestamp component', () => {
            const sessionId = logger.getSessionId();
            const parts = sessionId.split('-');
            const timestampPart = parts[0];
            // Should be a valid number (timestamp)
            expect(Number.isNaN(parseInt(timestampPart, 10))).toBe(false);
        });
    });

    describe('startTimer()', () => {
        it('should return a stop function', () => {
            const stop = logger.startTimer('test-timer');
            expect(typeof stop).toBe('function');
        });

        it('should return elapsed time', async () => {
            const stop = logger.startTimer('test-timer');
            await new Promise(resolve => setTimeout(resolve, 50));
            const elapsed = stop();

            expect(elapsed).toBeGreaterThanOrEqual(40); // Some tolerance for timing
            expect(elapsed).toBeLessThan(200);
        });

        it('should return integer value', () => {
            const stop = logger.startTimer('test-timer');
            const elapsed = stop();
            expect(Number.isInteger(elapsed)).toBe(true);
        });
    });

    describe('correlation tracking', () => {
        afterEach(() => {
            // Clean up any correlation IDs
            const id = logger.getCurrentCorrelationId();
            if (id) logger.endOperation(id);
        });

        it('should start operation and return correlation ID', () => {
            const correlationId = logger.startOperation('test-op');

            expect(typeof correlationId).toBe('string');
            expect(correlationId).toContain('test-op');
        });

        it('should track current correlation ID', () => {
            const correlationId = logger.startOperation('tracked-op');

            expect(logger.getCurrentCorrelationId()).toBe(correlationId);

            logger.endOperation(correlationId);
        });

        it('should remove correlation ID after end', () => {
            const correlationId = logger.startOperation('end-op');
            logger.endOperation(correlationId);

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should support nested operations', () => {
            const outer = logger.startOperation('outer');
            const inner = logger.startOperation('inner');

            // Current should be inner (most recent)
            expect(logger.getCurrentCorrelationId()).toBe(inner);

            logger.endOperation(inner);
            expect(logger.getCurrentCorrelationId()).toBe(outer);

            logger.endOperation(outer);
            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });
    });

    describe('withOperation()', () => {
        beforeEach(() => {
            logger.configure({ minLevel: LogLevel.DEBUG, enableConsole: true });
        });

        it('should execute async function', async () => {
            const fn = vi.fn().mockResolvedValue('result');

            const result = await logger.withOperation('test-async', fn);

            expect(result).toBe('result');
            expect(fn).toHaveBeenCalled();
        });

        it('should log success on completion', async () => {
            await logger.withOperation('success-op', async () => 'done');

            expect(consoleSpy.info).toHaveBeenCalled();
            const callArgs = consoleSpy.info.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.success).toBe(true);
        });

        it('should log error on failure', async () => {
            const error = new Error('Test error');

            await expect(
                logger.withOperation('fail-op', async () => {
                    throw error;
                })
            ).rejects.toThrow('Test error');

            expect(consoleSpy.error).toHaveBeenCalled();
            const callArgs = consoleSpy.error.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.success).toBe(false);
        });

        it('should include duration in logged event', async () => {
            await logger.withOperation('timed-op', async () => {
                await new Promise(resolve => setTimeout(resolve, 20));
                return 'done';
            });

            const callArgs = consoleSpy.info.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.durationMs).toBeDefined();
            expect(eventArg.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should include metadata in logged event', async () => {
            await logger.withOperation('meta-op', async () => 'done', { extraKey: 'extraValue' });

            const callArgs = consoleSpy.info.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.data).toEqual({ extraKey: 'extraValue' });
        });

        it('should clean up correlation ID after completion', async () => {
            await logger.withOperation('cleanup-op', async () => 'done');

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should clean up correlation ID after error', async () => {
            try {
                await logger.withOperation('error-cleanup-op', async () => {
                    throw new Error('fail');
                });
            } catch {
                // Expected to throw
            }

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });
    });

    describe('console output disabled', () => {
        it('should not call console when enableConsole is false', () => {
            logger.configure({ enableConsole: false });

            logger.info({ operation: 'silent' });
            logger.error({ operation: 'silent-error' });

            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.error).not.toHaveBeenCalled();

            // Reset
            logger.configure({ enableConsole: true });
        });
    });
});
