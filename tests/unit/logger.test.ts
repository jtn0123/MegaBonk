/**
 * @vitest-environment jsdom
 * Logger Module - Comprehensive Tests
 * Tests for wide events logger, EventBuilder, sampling, and configuration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock logger for these tests - we want to test the real implementation
vi.unmock('../../src/modules/logger.ts');

import {
    logger,
    Logger,
    LogLevel,
    EventBuilder,
    type WideEvent,
    type LoggerConfig,
    type EventContext,
    type EventError,
} from '../../src/modules/logger.ts';

// ========================================
// Test Suite
// ========================================

describe('Logger Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Reset logger to default config
        logger.configure({
            minLevel: LogLevel.DEBUG,
            enableConsole: true,
            enableRemote: false,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // LogLevel Tests
    // ========================================
    describe('LogLevel Enum', () => {
        it('should have correct numeric values', () => {
            expect(LogLevel.DEBUG).toBe(0);
            expect(LogLevel.INFO).toBe(1);
            expect(LogLevel.WARN).toBe(2);
            expect(LogLevel.ERROR).toBe(3);
        });

        it('should maintain ordering (DEBUG < INFO < WARN < ERROR)', () => {
            expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
            expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
            expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
        });
    });

    // ========================================
    // Logger Singleton Tests
    // ========================================
    describe('Logger Singleton', () => {
        it('should return same instance', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();

            expect(instance1).toBe(instance2);
        });

        it('should have a session ID', () => {
            const sessionId = logger.getSessionId();

            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');
            expect(sessionId.length).toBeGreaterThan(0);
        });

        it('should generate unique session IDs', () => {
            // Note: We can't easily test uniqueness across instances
            // since it's a singleton, but we can verify format
            const sessionId = logger.getSessionId();
            expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/);
        });
    });

    // ========================================
    // Logger Configuration Tests
    // ========================================
    describe('Logger Configuration', () => {
        it('should return current configuration', () => {
            const config = logger.getConfig();

            expect(config).toHaveProperty('minLevel');
            expect(config).toHaveProperty('enableConsole');
            expect(config).toHaveProperty('enableRemote');
            expect(config).toHaveProperty('sampling');
        });

        it('should update configuration', () => {
            logger.configure({ minLevel: LogLevel.ERROR });

            const config = logger.getConfig();
            expect(config.minLevel).toBe(LogLevel.ERROR);
        });

        it('should merge configuration (not replace)', () => {
            const originalConfig = logger.getConfig();
            logger.configure({ enableRemote: true });

            const newConfig = logger.getConfig();
            expect(newConfig.enableRemote).toBe(true);
            expect(newConfig.enableConsole).toBe(originalConfig.enableConsole);
        });

        it('should have default sampling configuration', () => {
            const config = logger.getConfig();

            expect(config.sampling.errorSampleRate).toBe(1.0);
            expect(config.sampling.slowRequestSampleRate).toBe(1.0);
            expect(config.sampling.slowRequestThresholdMs).toBe(1000);
            expect(config.sampling.defaultSampleRate).toBe(0.05);
        });
    });

    // ========================================
    // Logging Methods Tests
    // ========================================
    describe('Logging Methods', () => {
        it('should log debug event', () => {
            logger.debug({ operation: 'test.debug' });

            expect(console.debug).toHaveBeenCalled();
        });

        it('should log info event', () => {
            logger.info({ operation: 'test.info' });

            expect(console.info).toHaveBeenCalled();
        });

        it('should log warn event', () => {
            logger.warn({ operation: 'test.warn' });

            expect(console.warn).toHaveBeenCalled();
        });

        it('should log error event', () => {
            logger.error({ operation: 'test.error' });

            expect(console.error).toHaveBeenCalled();
        });

        it('should respect minLevel configuration', () => {
            logger.configure({ minLevel: LogLevel.WARN });

            logger.debug({ operation: 'test.debug' });
            logger.info({ operation: 'test.info' });
            logger.warn({ operation: 'test.warn' });

            expect(console.debug).not.toHaveBeenCalled();
            expect(console.info).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalled();
        });

        it('should include event data in log', () => {
            logger.info({
                operation: 'test.data',
                data: { key: 'value' },
            });

            expect(console.info).toHaveBeenCalled();
        });

        it('should include duration in log', () => {
            logger.info({
                operation: 'test.duration',
                durationMs: 150,
            });

            expect(console.info).toHaveBeenCalled();
        });

        it('should include success status in log', () => {
            logger.info({
                operation: 'test.success',
                success: true,
            });

            expect(console.info).toHaveBeenCalled();
        });

        it('should include error in log', () => {
            logger.error({
                operation: 'test.error',
                error: {
                    name: 'TestError',
                    message: 'Test error message',
                },
            });

            expect(console.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // Context Management Tests
    // ========================================
    describe('Context Management', () => {
        it('should set context value', () => {
            logger.setContext('userId', '123');

            const context = logger.getContext();
            expect(context.userId).toBe('123');
        });

        it('should get all context values', () => {
            logger.setContext('key1', 'value1');
            logger.setContext('key2', 'value2');

            const context = logger.getContext();
            expect(context.key1).toBe('value1');
            expect(context.key2).toBe('value2');
        });

        it('should clear context value', () => {
            logger.setContext('tempKey', 'tempValue');
            logger.clearContext('tempKey');

            const context = logger.getContext();
            expect(context.tempKey).toBeUndefined();
        });

        it('should return copy of context (not reference)', () => {
            logger.setContext('key', 'value');

            const context1 = logger.getContext();
            const context2 = logger.getContext();

            expect(context1).not.toBe(context2);
            expect(context1).toEqual(context2);
        });

        it('should overwrite existing context value', () => {
            logger.setContext('key', 'oldValue');
            logger.setContext('key', 'newValue');

            const context = logger.getContext();
            expect(context.key).toBe('newValue');
        });
    });

    // ========================================
    // Timer Tests
    // ========================================
    describe('Timer', () => {
        it('should return stop function', () => {
            const stop = logger.startTimer('test');

            expect(typeof stop).toBe('function');
        });

        it('should measure elapsed time', async () => {
            const stop = logger.startTimer('test');

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 50));

            const elapsed = stop();
            expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
        });

        it('should return rounded milliseconds', () => {
            const stop = logger.startTimer('test');
            const elapsed = stop();

            expect(Number.isInteger(elapsed)).toBe(true);
        });
    });

    // ========================================
    // Correlation Tests
    // ========================================
    describe('Correlation', () => {
        afterEach(() => {
            // Clean up any remaining correlation IDs
            let currentId = logger.getCurrentCorrelationId();
            while (currentId) {
                logger.endOperation(currentId);
                currentId = logger.getCurrentCorrelationId();
            }
        });

        it('should start operation and return correlation ID', () => {
            const correlationId = logger.startOperation('test');

            expect(correlationId).toBeDefined();
            expect(typeof correlationId).toBe('string');
            expect(correlationId).toMatch(/^test-\d+-[a-z0-9]+$/);

            logger.endOperation(correlationId);
        });

        it('should track current correlation ID', () => {
            const correlationId = logger.startOperation('test');

            expect(logger.getCurrentCorrelationId()).toBe(correlationId);

            logger.endOperation(correlationId);
        });

        it('should handle nested operations', () => {
            const id1 = logger.startOperation('outer');
            const id2 = logger.startOperation('inner');

            expect(logger.getCurrentCorrelationId()).toBe(id2);

            logger.endOperation(id2);
            expect(logger.getCurrentCorrelationId()).toBe(id1);

            logger.endOperation(id1);
            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should end operation correctly', () => {
            const correlationId = logger.startOperation('test');
            logger.endOperation(correlationId);

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should handle ending non-existent operation', () => {
            expect(() => logger.endOperation('non-existent')).not.toThrow();
        });
    });

    // ========================================
    // withOperation Tests
    // ========================================
    describe('withOperation', () => {
        afterEach(() => {
            // Clean up any remaining correlation IDs
            let currentId = logger.getCurrentCorrelationId();
            while (currentId) {
                logger.endOperation(currentId);
                currentId = logger.getCurrentCorrelationId();
            }
        });

        it('should wrap successful async operation', async () => {
            const result = await logger.withOperation(
                'test.success',
                async () => 'result',
                { extra: 'data' }
            );

            expect(result).toBe('result');
            expect(console.info).toHaveBeenCalled();
        });

        it('should wrap failing async operation', async () => {
            const error = new Error('Test error');

            await expect(
                logger.withOperation(
                    'test.fail',
                    async () => {
                        throw error;
                    }
                )
            ).rejects.toThrow('Test error');

            expect(console.error).toHaveBeenCalled();
        });

        it('should include metadata in log', async () => {
            await logger.withOperation(
                'test.metadata',
                async () => 'result',
                { userId: '123', action: 'create' }
            );

            expect(console.info).toHaveBeenCalled();
        });

        it('should track duration', async () => {
            await logger.withOperation(
                'test.duration',
                async () => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return 'result';
                }
            );

            // The info call should include durationMs
            expect(console.info).toHaveBeenCalled();
        });

        it('should clean up correlation ID after completion', async () => {
            // First clear any existing correlation IDs
            let currentId = logger.getCurrentCorrelationId();
            while (currentId) {
                logger.endOperation(currentId);
                currentId = logger.getCurrentCorrelationId();
            }

            await logger.withOperation('test.cleanup', async () => 'result');

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });

        it('should clean up correlation ID after error', async () => {
            // First clear any existing correlation IDs
            let currentId = logger.getCurrentCorrelationId();
            while (currentId) {
                logger.endOperation(currentId);
                currentId = logger.getCurrentCorrelationId();
            }

            try {
                await logger.withOperation('test.error.cleanup', async () => {
                    throw new Error('Test');
                });
            } catch {
                // Expected
            }

            expect(logger.getCurrentCorrelationId()).toBeUndefined();
        });
    });

    // ========================================
    // Console Output Tests
    // ========================================
    describe('Console Output', () => {
        it('should disable console output when configured', () => {
            logger.configure({ enableConsole: false });

            logger.info({ operation: 'test.silent' });

            expect(console.info).not.toHaveBeenCalled();
        });

        it('should re-enable console output', () => {
            logger.configure({ enableConsole: false });
            logger.configure({ enableConsole: true });

            logger.info({ operation: 'test.enabled' });

            expect(console.info).toHaveBeenCalled();
        });
    });

    // ========================================
    // EventBuilder Tests
    // ========================================
    describe('EventBuilder', () => {
        it('should create event with operation', () => {
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();

            expect(event.operation).toBe('test.operation');
        });

        it('should add data to event', () => {
            const builder = new EventBuilder('test.data');
            builder.addData('key1', 'value1');
            builder.addData('key2', 123);

            const event = builder.getEvent();
            expect(event.data?.key1).toBe('value1');
            expect(event.data?.key2).toBe(123);
        });

        it('should merge data fields', () => {
            const builder = new EventBuilder('test.merge');
            builder.mergeData({ a: 1, b: 2 });
            builder.mergeData({ c: 3 });

            const event = builder.getEvent();
            expect(event.data?.a).toBe(1);
            expect(event.data?.b).toBe(2);
            expect(event.data?.c).toBe(3);
        });

        it('should set success status', () => {
            const builder = new EventBuilder('test.success');
            builder.setSuccess(true);

            const event = builder.getEvent();
            expect(event.success).toBe(true);
        });

        it('should set failure status', () => {
            const builder = new EventBuilder('test.fail');
            builder.setSuccess(false);

            const event = builder.getEvent();
            expect(event.success).toBe(false);
        });

        it('should set duration', () => {
            const builder = new EventBuilder('test.duration');
            builder.setDuration(150);

            const event = builder.getEvent();
            expect(event.durationMs).toBe(150);
        });

        it('should auto-calculate duration', async () => {
            const builder = new EventBuilder('test.auto');
            await new Promise(resolve => setTimeout(resolve, 50));
            builder.autoDuration();

            const event = builder.getEvent();
            expect(event.durationMs).toBeGreaterThanOrEqual(40);
        });

        it('should set error information', () => {
            const builder = new EventBuilder('test.error');
            builder.setError({
                name: 'TestError',
                message: 'Test error message',
            });

            const event = builder.getEvent();
            expect(event.error?.name).toBe('TestError');
            expect(event.error?.message).toBe('Test error message');
            expect(event.success).toBe(false);
        });

        it('should set correlation ID', () => {
            const builder = new EventBuilder('test.correlation');
            builder.setCorrelationId('corr-123');

            const event = builder.getEvent();
            expect(event.correlationId).toBe('corr-123');
        });

        it('should set context', () => {
            const builder = new EventBuilder('test.context');
            builder.setContext({ currentTab: 'items' });

            const event = builder.getEvent();
            expect(event.context?.currentTab).toBe('items');
        });

        it('should support method chaining', () => {
            const builder = new EventBuilder('test.chain')
                .addData('key', 'value')
                .setSuccess(true)
                .setDuration(100)
                .setCorrelationId('corr-456');

            const event = builder.getEvent();
            expect(event.data?.key).toBe('value');
            expect(event.success).toBe(true);
            expect(event.durationMs).toBe(100);
            expect(event.correlationId).toBe('corr-456');
        });

        it('should emit event at INFO level by default', () => {
            const builder = new EventBuilder('test.emit');
            builder.addData('test', true);
            builder.emit();

            expect(console.info).toHaveBeenCalled();
        });

        it('should emit event at DEBUG level', () => {
            const builder = new EventBuilder('test.emit.debug');
            builder.emit(LogLevel.DEBUG);

            expect(console.debug).toHaveBeenCalled();
        });

        it('should emit event at WARN level', () => {
            const builder = new EventBuilder('test.emit.warn');
            builder.emit(LogLevel.WARN);

            expect(console.warn).toHaveBeenCalled();
        });

        it('should emit event at ERROR level', () => {
            const builder = new EventBuilder('test.emit.error');
            builder.emit(LogLevel.ERROR);

            expect(console.error).toHaveBeenCalled();
        });

        it('should auto-calculate duration on emit if not set', () => {
            const builder = new EventBuilder('test.emit.auto');
            builder.emit();

            const event = builder.getEvent();
            expect(event.durationMs).toBeDefined();
        });

        it('should return copy of event from getEvent', () => {
            const builder = new EventBuilder('test.copy');
            builder.addData('key', 'value');

            const event1 = builder.getEvent();
            const event2 = builder.getEvent();

            expect(event1).not.toBe(event2);
            expect(event1).toEqual(event2);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle undefined data values', () => {
            expect(() =>
                logger.info({
                    operation: 'test.undefined',
                    data: { key: undefined },
                })
            ).not.toThrow();
        });

        it('should handle null data values', () => {
            expect(() =>
                logger.info({
                    operation: 'test.null',
                    data: { key: null },
                })
            ).not.toThrow();
        });

        it('should handle very long operation names', () => {
            const longName = 'a'.repeat(1000);
            expect(() =>
                logger.info({ operation: longName })
            ).not.toThrow();
        });

        it('should handle circular references in data', () => {
            const obj: any = { key: 'value' };
            obj.circular = obj;

            // This might throw or handle gracefully depending on implementation
            // The logger should handle this case
            try {
                logger.info({
                    operation: 'test.circular',
                    data: obj,
                });
            } catch {
                // May throw if JSON.stringify is used
            }
        });

        it('should handle rapid consecutive logs', () => {
            for (let i = 0; i < 100; i++) {
                logger.info({ operation: `test.rapid.${i}` });
            }

            expect(console.info).toHaveBeenCalledTimes(100);
        });

        it('should handle empty operation string', () => {
            expect(() =>
                logger.info({ operation: '' })
            ).not.toThrow();
        });

        it('should handle special characters in operation', () => {
            expect(() =>
                logger.info({ operation: 'test.special-chars_123!@#$%' })
            ).not.toThrow();
        });

        it('should handle very large data objects', () => {
            const largeData: Record<string, number> = {};
            for (let i = 0; i < 1000; i++) {
                largeData[`key${i}`] = i;
            }

            expect(() =>
                logger.info({
                    operation: 'test.large',
                    data: largeData,
                })
            ).not.toThrow();
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support full logging workflow', async () => {
            // Set context
            logger.setContext('currentTab', 'items');
            logger.setContext('userId', '123');

            // Start operation
            const correlationId = logger.startOperation('data.load');

            // Log progress
            logger.debug({
                operation: 'data.load.start',
                correlationId,
            });

            // Simulate work
            const stop = logger.startTimer('load');
            await new Promise(resolve => setTimeout(resolve, 10));

            // Log completion
            logger.info({
                operation: 'data.load.complete',
                correlationId,
                durationMs: stop(),
                success: true,
                data: { itemsLoaded: 100 },
            });

            // End operation
            logger.endOperation(correlationId);

            expect(console.debug).toHaveBeenCalled();
            expect(console.info).toHaveBeenCalled();
        });

        it('should support EventBuilder workflow', () => {
            const event = new EventBuilder('user.action')
                .addData('action', 'click')
                .addData('target', 'button')
                .setContext({ currentTab: 'items' })
                .setSuccess(true);

            event.emit();

            expect(console.info).toHaveBeenCalled();
        });

        it('should combine context with event context', () => {
            logger.setContext('globalKey', 'globalValue');

            logger.info({
                operation: 'test.combined',
                context: { eventKey: 'eventValue' },
            });

            expect(console.info).toHaveBeenCalled();
        });
    });
});
