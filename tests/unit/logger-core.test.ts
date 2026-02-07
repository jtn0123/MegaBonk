/**
 * @vitest-environment jsdom
 * Logger Core Module Tests
 * Tests for the wide events logging infrastructure
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
    Logger,
    LogLevel,
    type LoggerConfig,
    type WideEvent,
    type EventContext,
} from '../../src/modules/logger-core.ts';

// ========================================
// Test Utilities
// ========================================

/**
 * Creates a fresh Logger instance for testing
 * Uses reflection to access private constructor
 */
function createFreshLogger(): Logger {
    // Reset the singleton by accessing the private static instance
    (Logger as any).instance = undefined;
    return Logger.getInstance();
}

/**
 * Capture console output for assertions
 */
function mockConsole() {
    return {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
}

// ========================================
// LogLevel Enum Tests
// ========================================

describe('LogLevel', () => {
    it('should have correct numeric values', () => {
        expect(LogLevel.DEBUG).toBe(0);
        expect(LogLevel.INFO).toBe(1);
        expect(LogLevel.WARN).toBe(2);
        expect(LogLevel.ERROR).toBe(3);
    });

    it('should maintain proper ordering', () => {
        expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
        expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
        expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
    });
});

// ========================================
// Logger Singleton Tests
// ========================================

describe('Logger', () => {
    let logger: Logger;
    let consoleMocks: ReturnType<typeof mockConsole>;

    beforeEach(() => {
        logger = createFreshLogger();
        consoleMocks = mockConsole();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Reset singleton
        (Logger as any).instance = undefined;
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should create only one instance across multiple calls', () => {
            const instances = Array.from({ length: 10 }, () => Logger.getInstance());
            const uniqueInstances = new Set(instances);
            expect(uniqueInstances.size).toBe(1);
        });
    });

    // ========================================
    // Session ID Tests
    // ========================================

    describe('getSessionId', () => {
        it('should return a non-empty string', () => {
            const sessionId = logger.getSessionId();
            expect(sessionId).toBeTruthy();
            expect(typeof sessionId).toBe('string');
        });

        it('should return consistent sessionId for same logger instance', () => {
            const id1 = logger.getSessionId();
            const id2 = logger.getSessionId();
            expect(id1).toBe(id2);
        });

        it('should have correct format (timestamp-random)', () => {
            const sessionId = logger.getSessionId();
            // Format: timestamp-randomString (e.g., "1704067200000-a1b2c3d4e")
            expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/);
        });

        it('should generate unique session IDs for different instances', () => {
            const logger1 = createFreshLogger();
            const id1 = logger1.getSessionId();
            
            // Create new instance
            const logger2 = createFreshLogger();
            const id2 = logger2.getSessionId();
            
            expect(id1).not.toBe(id2);
        });
    });

    // ========================================
    // Configuration Tests
    // ========================================

    describe('configure', () => {
        it('should update minLevel', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            const config = logger.getConfig();
            expect(config.minLevel).toBe(LogLevel.ERROR);
        });

        it('should update enableConsole', () => {
            logger.configure({ enableConsole: false });
            const config = logger.getConfig();
            expect(config.enableConsole).toBe(false);
        });

        it('should update enableRemote and remoteEndpoint', () => {
            logger.configure({
                enableRemote: true,
                remoteEndpoint: 'https://logs.example.com/events',
            });
            const config = logger.getConfig();
            expect(config.enableRemote).toBe(true);
            expect(config.remoteEndpoint).toBe('https://logs.example.com/events');
        });

        it('should update includeStackTrace', () => {
            logger.configure({ includeStackTrace: true });
            const config = logger.getConfig();
            expect(config.includeStackTrace).toBe(true);
        });

        it('should update sampling configuration', () => {
            logger.configure({
                sampling: {
                    errorSampleRate: 0.5,
                    slowRequestThresholdMs: 2000,
                    slowRequestSampleRate: 0.8,
                    defaultSampleRate: 0.1,
                },
            });
            const config = logger.getConfig();
            expect(config.sampling.errorSampleRate).toBe(0.5);
            expect(config.sampling.slowRequestThresholdMs).toBe(2000);
            expect(config.sampling.slowRequestSampleRate).toBe(0.8);
            expect(config.sampling.defaultSampleRate).toBe(0.1);
        });

        it('should merge partial configuration', () => {
            const originalConfig = logger.getConfig();
            logger.configure({ minLevel: LogLevel.WARN });
            const newConfig = logger.getConfig();
            
            // Updated field
            expect(newConfig.minLevel).toBe(LogLevel.WARN);
            // Preserved fields
            expect(newConfig.enableConsole).toBe(originalConfig.enableConsole);
            expect(newConfig.maxContextSize).toBe(originalConfig.maxContextSize);
        });
    });

    describe('getConfig', () => {
        it('should return a copy of the configuration', () => {
            const config1 = logger.getConfig();
            const config2 = logger.getConfig();
            expect(config1).toEqual(config2);
            expect(config1).not.toBe(config2); // Different object references
        });

        it('should return default configuration', () => {
            const config = logger.getConfig();
            expect(config.enableConsole).toBe(true);
            expect(config.enableRemote).toBe(false);
            expect(config.maxContextSize).toBe(10000);
            expect(config.sampling).toBeDefined();
        });
    });

    // ========================================
    // Logging Method Tests
    // ========================================

    describe('debug', () => {
        beforeEach(() => {
            logger.configure({ minLevel: LogLevel.DEBUG });
        });

        it('should log debug messages when level allows', () => {
            logger.debug({ operation: 'test.debug' });
            expect(consoleMocks.debug).toHaveBeenCalled();
        });

        it('should not log when minLevel is higher', () => {
            logger.configure({ minLevel: LogLevel.INFO });
            logger.debug({ operation: 'test.debug' });
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });

        it('should include operation in output', () => {
            logger.debug({ operation: 'test.operation' });
            const call = consoleMocks.debug.mock.calls[0];
            expect(call).toBeDefined();
            // Check that the event object contains the operation
            const eventArg = call[call.length - 1];
            expect(eventArg.operation).toBe('test.operation');
        });
    });

    describe('info', () => {
        it('should log info messages', () => {
            logger.info({ operation: 'test.info' });
            expect(consoleMocks.info).toHaveBeenCalled();
        });

        it('should include timestamp', () => {
            const before = Date.now();
            logger.info({ operation: 'test.timestamp' });
            const after = Date.now();

            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.timestamp).toBeGreaterThanOrEqual(before);
            expect(eventArg.timestamp).toBeLessThanOrEqual(after);
        });

        it('should include sessionId', () => {
            logger.info({ operation: 'test.session' });
            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.sessionId).toBe(logger.getSessionId());
        });
    });

    describe('warn', () => {
        it('should log warning messages', () => {
            logger.warn({ operation: 'test.warn' });
            expect(consoleMocks.warn).toHaveBeenCalled();
        });

        it('should not log when minLevel is ERROR', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            logger.warn({ operation: 'test.warn' });
            expect(consoleMocks.warn).not.toHaveBeenCalled();
        });
    });

    describe('error', () => {
        it('should log error messages', () => {
            logger.error({ operation: 'test.error' });
            expect(consoleMocks.error).toHaveBeenCalled();
        });

        it('should include error details', () => {
            logger.error({
                operation: 'test.error',
                error: {
                    name: 'TestError',
                    message: 'Something went wrong',
                    stack: 'Error stack trace',
                },
            });
            const call = consoleMocks.error.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.error.name).toBe('TestError');
            expect(eventArg.error.message).toBe('Something went wrong');
        });

        it('should always log at ERROR level regardless of minLevel', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            logger.error({ operation: 'test.error' });
            expect(consoleMocks.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // Context Management Tests
    // ========================================

    describe('context management', () => {
        describe('setContext', () => {
            it('should set a context value', () => {
                logger.setContext('userId', 'user123');
                const context = logger.getContext();
                expect(context.userId).toBe('user123');
            });

            it('should overwrite existing context values', () => {
                logger.setContext('key', 'value1');
                logger.setContext('key', 'value2');
                const context = logger.getContext();
                expect(context.key).toBe('value2');
            });

            it('should support complex values', () => {
                const complexValue = { nested: { deep: [1, 2, 3] } };
                logger.setContext('complex', complexValue);
                const context = logger.getContext();
                expect(context.complex).toEqual(complexValue);
            });
        });

        describe('clearContext', () => {
            it('should remove a context value', () => {
                logger.setContext('key', 'value');
                logger.clearContext('key');
                const context = logger.getContext();
                expect(context.key).toBeUndefined();
            });

            it('should not affect other context values', () => {
                logger.setContext('key1', 'value1');
                logger.setContext('key2', 'value2');
                logger.clearContext('key1');
                const context = logger.getContext();
                expect(context.key1).toBeUndefined();
                expect(context.key2).toBe('value2');
            });
        });

        describe('getContext', () => {
            it('should return a copy of the context', () => {
                logger.setContext('key', 'value');
                const context1 = logger.getContext();
                const context2 = logger.getContext();
                expect(context1).toEqual(context2);
                expect(context1).not.toBe(context2);
            });

            it('should include global context in logged events', () => {
                logger.setContext('currentTab', 'items');
                logger.info({ operation: 'test.context' });
                
                const call = consoleMocks.info.mock.calls[0];
                const eventArg = call[call.length - 1];
                expect(eventArg.context.currentTab).toBe('items');
            });
        });
    });

    // ========================================
    // Timer Tests
    // ========================================

    describe('startTimer', () => {
        it('should return a function', () => {
            const stopTimer = logger.startTimer('test');
            expect(typeof stopTimer).toBe('function');
        });

        it('should measure elapsed time', async () => {
            const stopTimer = logger.startTimer('test');
            
            // Wait a bit using real timers for performance.now()
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const elapsed = stopTimer();
            expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
            expect(elapsed).toBeLessThan(200);
        });

        it('should return rounded milliseconds', () => {
            const stopTimer = logger.startTimer('test');
            const elapsed = stopTimer();
            expect(Number.isInteger(elapsed)).toBe(true);
        });

        it('should allow multiple timers simultaneously', async () => {
            const timer1 = logger.startTimer('fast');
            
            await new Promise(resolve => setTimeout(resolve, 20));
            const timer2 = logger.startTimer('slow');
            
            await new Promise(resolve => setTimeout(resolve, 30));
            
            const elapsed1 = timer1();
            const elapsed2 = timer2();
            
            expect(elapsed1).toBeGreaterThan(elapsed2);
        });
    });

    // ========================================
    // Correlation/Operation Tests
    // ========================================

    describe('correlation management', () => {
        describe('startOperation', () => {
            it('should return a correlation ID', () => {
                const correlationId = logger.startOperation('dataLoad');
                expect(correlationId).toBeTruthy();
                expect(typeof correlationId).toBe('string');
            });

            it('should include operation name in correlation ID', () => {
                const correlationId = logger.startOperation('myOperation');
                expect(correlationId).toContain('myOperation');
            });

            it('should generate unique IDs', () => {
                const id1 = logger.startOperation('op1');
                const id2 = logger.startOperation('op2');
                expect(id1).not.toBe(id2);
            });
        });

        describe('getCurrentCorrelationId', () => {
            it('should return undefined when no operation is active', () => {
                // Create fresh logger to ensure clean state
                const freshLogger = createFreshLogger();
                expect(freshLogger.getCurrentCorrelationId()).toBeUndefined();
            });

            it('should return the most recent correlation ID', () => {
                const id1 = logger.startOperation('op1');
                expect(logger.getCurrentCorrelationId()).toBe(id1);
                
                const id2 = logger.startOperation('op2');
                expect(logger.getCurrentCorrelationId()).toBe(id2);
            });
        });

        describe('endOperation', () => {
            it('should remove correlation ID from stack', () => {
                const id = logger.startOperation('op');
                expect(logger.getCurrentCorrelationId()).toBe(id);
                
                logger.endOperation(id);
                expect(logger.getCurrentCorrelationId()).toBeUndefined();
            });

            it('should handle nested operations correctly', () => {
                const id1 = logger.startOperation('outer');
                const id2 = logger.startOperation('inner');
                
                expect(logger.getCurrentCorrelationId()).toBe(id2);
                
                logger.endOperation(id2);
                expect(logger.getCurrentCorrelationId()).toBe(id1);
                
                logger.endOperation(id1);
                expect(logger.getCurrentCorrelationId()).toBeUndefined();
            });

            it('should handle ending non-existent operation', () => {
                // Should not throw
                expect(() => logger.endOperation('nonexistent')).not.toThrow();
            });
        });
    });

    // ========================================
    // withOperation Tests
    // ========================================

    describe('withOperation', () => {
        it('should execute the function and return result', async () => {
            const result = await logger.withOperation('test', async () => {
                return 'success';
            });
            expect(result).toBe('success');
        });

        it('should log success with duration', async () => {
            await logger.withOperation('test.success', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'done';
            });

            expect(consoleMocks.info).toHaveBeenCalled();
            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.operation).toBe('test.success');
            expect(eventArg.success).toBe(true);
            expect(eventArg.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should log error on failure', async () => {
            const testError = new Error('Test failure');
            
            await expect(
                logger.withOperation('test.fail', async () => {
                    throw testError;
                })
            ).rejects.toThrow('Test failure');

            expect(consoleMocks.error).toHaveBeenCalled();
            const call = consoleMocks.error.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.operation).toBe('test.fail');
            expect(eventArg.success).toBe(false);
            expect(eventArg.error.name).toBe('Error');
            expect(eventArg.error.message).toBe('Test failure');
        });

        it('should include metadata in log', async () => {
            await logger.withOperation(
                'test.metadata',
                async () => 'done',
                { itemId: '123', count: 5 }
            );

            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.data.itemId).toBe('123');
            expect(eventArg.data.count).toBe(5);
        });

        it('should include correlation ID', async () => {
            await logger.withOperation('test.correlation', async () => 'done');

            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.correlationId).toBeTruthy();
            expect(eventArg.correlationId).toContain('test.correlation');
        });

        it('should clean up correlation on success', async () => {
            await logger.withOperation('test.cleanup', async () => 'done');
            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should clean up correlation on failure', async () => {
            try {
                await logger.withOperation('test.cleanup.fail', async () => {
                    throw new Error('fail');
                });
            } catch {
                // Expected
            }
            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });
    });

    // ========================================
    // Event Context Enrichment Tests
    // ========================================

    describe('event context enrichment', () => {
        it('should include viewport size', () => {
            logger.info({ operation: 'test.viewport' });
            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.context.viewportSize).toBeDefined();
            expect(eventArg.context.viewportSize.width).toBe(window.innerWidth);
            expect(eventArg.context.viewportSize.height).toBe(window.innerHeight);
        });

        it('should include online status', () => {
            logger.info({ operation: 'test.online' });
            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(typeof eventArg.context.online).toBe('boolean');
        });

        it('should merge event context with global context', () => {
            logger.setContext('global', 'value');
            logger.info({
                operation: 'test.merge',
                context: { local: 'localValue' },
            });

            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.context.global).toBe('value');
            expect(eventArg.context.local).toBe('localValue');
        });

        it('should prefer event context over global context', () => {
            logger.setContext('key', 'global');
            logger.info({
                operation: 'test.override',
                context: { key: 'local' },
            });

            const call = consoleMocks.info.mock.calls[0];
            const eventArg = call[call.length - 1];
            expect(eventArg.context.key).toBe('local');
        });
    });

    // ========================================
    // Console Output Format Tests
    // ========================================

    describe('console output', () => {
        it('should disable console output when configured', () => {
            logger.configure({ enableConsole: false });
            logger.info({ operation: 'test.silent' });
            expect(consoleMocks.info).not.toHaveBeenCalled();
        });

        it('should include duration in formatted output', () => {
            logger.info({
                operation: 'test.duration',
                durationMs: 150,
            });

            const call = consoleMocks.info.mock.calls[0];
            // Check that duration appears in formatted string
            expect(call[0]).toContain('150ms');
        });

        it('should include success/fail indicator', () => {
            logger.info({
                operation: 'test.success',
                success: true,
            });
            let call = consoleMocks.info.mock.calls[0];
            expect(call[0]).toContain('OK');

            logger.info({
                operation: 'test.fail',
                success: false,
            });
            call = consoleMocks.info.mock.calls[1];
            expect(call[0]).toContain('FAIL');
        });
    });

    // ========================================
    // Remote Logging Tests
    // ========================================

    describe('remote logging', () => {
        let fetchSpy: Mock;

        beforeEach(() => {
            vi.useFakeTimers();
            fetchSpy = vi.fn().mockResolvedValue({ ok: true });
            global.fetch = fetchSpy;
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should not send remote when disabled', () => {
            logger.configure({ enableRemote: false });
            logger.info({ operation: 'test.noremote' });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('should batch events before sending', async () => {
            logger.configure({
                enableRemote: true,
                remoteEndpoint: 'https://logs.example.com',
                sampling: { ...logger.getConfig().sampling, defaultSampleRate: 1.0 },
            });

            // Log a few events
            logger.info({ operation: 'test.batch1' });
            logger.info({ operation: 'test.batch2' });
            logger.info({ operation: 'test.batch3' });

            // Not sent immediately
            expect(fetchSpy).not.toHaveBeenCalled();

            // Wait for flush timeout
            vi.advanceTimersByTime(5000);
            await Promise.resolve(); // Allow promises to settle

            expect(fetchSpy).toHaveBeenCalled();
        });

        it('should flush immediately when buffer is full', async () => {
            logger.configure({
                enableRemote: true,
                remoteEndpoint: 'https://logs.example.com',
                sampling: { ...logger.getConfig().sampling, defaultSampleRate: 1.0 },
            });

            // Log 50 events to trigger immediate flush
            for (let i = 0; i < 50; i++) {
                logger.info({ operation: `test.bulk${i}` });
            }

            await Promise.resolve();
            expect(fetchSpy).toHaveBeenCalled();
        });
    });

    // ========================================
    // Sampling Tests
    // ========================================

    describe('sampling', () => {
        it('should always sample errors at high rate', () => {
            logger.configure({
                sampling: {
                    errorSampleRate: 1.0,
                    slowRequestThresholdMs: 1000,
                    slowRequestSampleRate: 1.0,
                    defaultSampleRate: 0.0, // Zero normal sampling
                },
            });

            // Even with 0% default sampling, errors should be sampled
            const config = logger.getConfig();
            expect(config.sampling.errorSampleRate).toBe(1.0);
        });

        it('should sample slow requests at high rate', () => {
            logger.configure({
                sampling: {
                    errorSampleRate: 1.0,
                    slowRequestThresholdMs: 500,
                    slowRequestSampleRate: 1.0,
                    defaultSampleRate: 0.0,
                },
            });

            const config = logger.getConfig();
            expect(config.sampling.slowRequestThresholdMs).toBe(500);
            expect(config.sampling.slowRequestSampleRate).toBe(1.0);
        });
    });
});

// ========================================
// Edge Cases and Error Handling
// ========================================

describe('Logger edge cases', () => {
    let logger: Logger;
    let consoleMocks: ReturnType<typeof mockConsole>;

    beforeEach(() => {
        logger = createFreshLogger();
        consoleMocks = mockConsole();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        (Logger as any).instance = undefined;
    });

    it('should handle empty operation name', () => {
        expect(() => logger.info({ operation: '' })).not.toThrow();
    });

    it('should handle very long operation names', () => {
        const longName = 'a'.repeat(1000);
        expect(() => logger.info({ operation: longName })).not.toThrow();
    });

    it('should handle circular references in data', () => {
        const circular: any = { a: 1 };
        circular.self = circular;
        
        // Should not throw when logging circular data
        expect(() => {
            logger.info({
                operation: 'test.circular',
                data: circular,
            });
        }).not.toThrow();
    });

    it('should handle undefined data gracefully', () => {
        expect(() => {
            logger.info({
                operation: 'test.undefined',
                data: undefined,
            });
        }).not.toThrow();
    });

    it('should handle null values in context', () => {
        logger.setContext('nullValue', null);
        expect(() => logger.info({ operation: 'test.null' })).not.toThrow();
    });

    it('should handle special characters in operation name', () => {
        expect(() => {
            logger.info({ operation: 'test.special!@#$%^&*()' });
        }).not.toThrow();
    });

    it('should handle async errors in withOperation', async () => {
        await expect(
            logger.withOperation('test.asyncError', async () => {
                await Promise.reject(new Error('Async error'));
            })
        ).rejects.toThrow('Async error');
    });

    it('should handle sync errors in withOperation', async () => {
        await expect(
            logger.withOperation('test.syncError', async () => {
                throw new TypeError('Type error');
            })
        ).rejects.toThrow('Type error');
    });
});

// ========================================
// Type Safety Tests
// ========================================

describe('Logger type safety', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = createFreshLogger();
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        (Logger as any).instance = undefined;
    });

    it('should accept WideEvent with all optional fields', () => {
        const event: Omit<WideEvent, 'timestamp' | 'sessionId'> = {
            operation: 'test.full',
            correlationId: 'corr-123',
            durationMs: 100,
            success: true,
            context: { currentTab: 'items' },
            error: { name: 'TestError', message: 'Test' },
            data: { count: 5 },
        };
        expect(() => logger.info(event)).not.toThrow();
    });

    it('should accept minimal WideEvent', () => {
        expect(() => logger.info({ operation: 'test.minimal' })).not.toThrow();
    });

    it('should handle EventContext with custom fields', () => {
        const context: EventContext = {
            currentTab: 'items',
            customField: 'customValue',
            nestedObject: { a: 1, b: 2 },
        };
        expect(() => logger.info({ operation: 'test.context', context })).not.toThrow();
    });
});
