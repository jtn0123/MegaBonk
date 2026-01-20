/**
 * Comprehensive tests for logger.ts module
 * Tests Logger singleton, EventBuilder, and logging functionality
 * Uses dynamic imports to avoid mock interference from other tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock the logger module since other tests mock it
vi.unmock('../../src/modules/logger.ts');

describe('Logger', () => {
    let logger: any;
    let Logger: any;
    let EventBuilder: any;
    let LogLevel: any;
    let consoleSpy: {
        debug: ReturnType<typeof vi.spyOn>;
        info: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(async () => {
        vi.resetModules();

        // Dynamic import to get fresh module
        const loggerModule = await import('../../src/modules/logger.ts');
        logger = loggerModule.logger;
        Logger = loggerModule.Logger;
        EventBuilder = loggerModule.EventBuilder;
        LogLevel = loggerModule.LogLevel;

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

    describe('singleton', () => {
        it('should return the same instance', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should export logger singleton', () => {
            expect(logger).toBeDefined();
            expect(logger).toBe(Logger.getInstance());
        });
    });

    describe('configuration', () => {
        it('should return default config', () => {
            const config = logger.getConfig();
            expect(config).toHaveProperty('minLevel');
            expect(config).toHaveProperty('enableConsole');
            expect(config).toHaveProperty('enableRemote');
            expect(config).toHaveProperty('sampling');
        });

        it('should allow partial configuration updates', () => {
            const originalConfig = logger.getConfig();
            logger.configure({ enableRemote: true });

            const newConfig = logger.getConfig();
            expect(newConfig.enableRemote).toBe(true);

            // Restore
            logger.configure({ enableRemote: originalConfig.enableRemote });
        });

        it('should have default sampling config', () => {
            const config = logger.getConfig();
            expect(config.sampling.errorSampleRate).toBe(1.0);
            expect(config.sampling.slowRequestSampleRate).toBe(1.0);
            expect(config.sampling.defaultSampleRate).toBe(0.05);
        });
    });

    describe('logging methods', () => {
        it('should log debug events', () => {
            logger.configure({ minLevel: LogLevel.DEBUG });
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

        it('should respect minimum log level', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            logger.info({ operation: 'test.info' });
            expect(consoleSpy.info).not.toHaveBeenCalled();

            // Restore
            logger.configure({ minLevel: LogLevel.DEBUG });
        });

        it('should include timestamp in events', () => {
            const before = Date.now();
            logger.info({ operation: 'test.timestamp' });
            const after = Date.now();

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.timestamp).toBeGreaterThanOrEqual(before);
            expect(event.timestamp).toBeLessThanOrEqual(after);
        });

        it('should include session ID in events', () => {
            logger.info({ operation: 'test.session' });

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.sessionId).toBeDefined();
            expect(typeof event.sessionId).toBe('string');
        });
    });

    describe('context management', () => {
        afterEach(() => {
            logger.clearContext('testKey');
        });

        it('should set global context', () => {
            logger.setContext('testKey', 'testValue');
            const context = logger.getContext();
            expect(context.testKey).toBe('testValue');
        });

        it('should clear global context', () => {
            logger.setContext('testKey', 'testValue');
            logger.clearContext('testKey');
            const context = logger.getContext();
            expect(context.testKey).toBeUndefined();
        });

        it('should return copy of context', () => {
            const context1 = logger.getContext();
            const context2 = logger.getContext();
            expect(context1).not.toBe(context2);
        });

        it('should include global context in events', () => {
            logger.setContext('globalKey', 'globalValue');
            logger.info({ operation: 'test.context' });

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.context?.globalKey).toBe('globalValue');

            logger.clearContext('globalKey');
        });
    });

    describe('session ID', () => {
        it('should return session ID', () => {
            const sessionId = logger.getSessionId();
            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');
        });

        it('should have consistent session ID', () => {
            const id1 = logger.getSessionId();
            const id2 = logger.getSessionId();
            expect(id1).toBe(id2);
        });
    });

    describe('timer', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should start timer and return stop function', () => {
            const stop = logger.startTimer('test');
            expect(typeof stop).toBe('function');
        });

        it('should measure elapsed time', () => {
            const stop = logger.startTimer('test');
            vi.advanceTimersByTime(100);
            const elapsed = stop();
            expect(elapsed).toBeGreaterThanOrEqual(100);
        });
    });

    describe('correlation operations', () => {
        it('should start operation and return correlation ID', () => {
            const correlationId = logger.startOperation('test-op');
            expect(correlationId).toBeDefined();
            expect(correlationId).toContain('test-op');
            logger.endOperation(correlationId);
        });

        it('should end operation', () => {
            const correlationId = logger.startOperation('test-op');
            logger.endOperation(correlationId);
            expect(logger.getCurrentCorrelationId()).not.toBe(correlationId);
        });

        it('should get current correlation ID', () => {
            const correlationId = logger.startOperation('test-op');
            expect(logger.getCurrentCorrelationId()).toBe(correlationId);
            logger.endOperation(correlationId);
        });

        it('should handle nested operations', () => {
            const id1 = logger.startOperation('op1');
            const id2 = logger.startOperation('op2');

            expect(logger.getCurrentCorrelationId()).toBe(id2);

            logger.endOperation(id2);
            expect(logger.getCurrentCorrelationId()).toBe(id1);

            logger.endOperation(id1);
        });

        it('should handle ending non-existent operation', () => {
            expect(() => logger.endOperation('non-existent')).not.toThrow();
        });
    });

    describe('withOperation', () => {
        it('should wrap async operation and log success', async () => {
            const result = await logger.withOperation('test.async', async () => {
                return 'success';
            });

            expect(result).toBe('success');
            expect(consoleSpy.info).toHaveBeenCalled();

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.operation).toBe('test.async');
            expect(event.success).toBe(true);
        });

        it('should wrap async operation and log failure', async () => {
            await expect(
                logger.withOperation('test.async.fail', async () => {
                    throw new Error('Test error');
                })
            ).rejects.toThrow('Test error');

            expect(consoleSpy.error).toHaveBeenCalled();

            const call = consoleSpy.error.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.operation).toBe('test.async.fail');
            expect(event.success).toBe(false);
            expect(event.error?.message).toBe('Test error');
        });

        it('should include metadata in logged event', async () => {
            await logger.withOperation(
                'test.metadata',
                async () => 'result',
                { customField: 'customValue' }
            );

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.data?.customField).toBe('customValue');
        });

        it('should include duration in logged event', async () => {
            await logger.withOperation('test.duration', async () => 'result');

            const call = consoleSpy.info.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.durationMs).toBeDefined();
            expect(typeof event.durationMs).toBe('number');
        });
    });
});

describe('EventBuilder', () => {
    let EventBuilder: any;
    let LogLevel: any;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        vi.resetModules();

        const loggerModule = await import('../../src/modules/logger.ts');
        EventBuilder = loggerModule.EventBuilder;
        LogLevel = loggerModule.LogLevel;

        consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('construction', () => {
        it('should create event with operation name', () => {
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();
            expect(event.operation).toBe('test.operation');
        });

        it('should set timestamp on creation', () => {
            const before = Date.now();
            const builder = new EventBuilder('test');
            const event = builder.getEvent();
            expect(event.timestamp).toBeGreaterThanOrEqual(before);
        });
    });

    describe('addData', () => {
        it('should add single data field', () => {
            const builder = new EventBuilder('test');
            builder.addData('key', 'value');
            const event = builder.getEvent();
            expect(event.data?.key).toBe('value');
        });

        it('should return this for chaining', () => {
            const builder = new EventBuilder('test');
            const result = builder.addData('key', 'value');
            expect(result).toBe(builder);
        });

        it('should support multiple addData calls', () => {
            const builder = new EventBuilder('test');
            builder.addData('key1', 'value1').addData('key2', 'value2');
            const event = builder.getEvent();
            expect(event.data?.key1).toBe('value1');
            expect(event.data?.key2).toBe('value2');
        });
    });

    describe('mergeData', () => {
        it('should merge multiple fields at once', () => {
            const builder = new EventBuilder('test');
            builder.mergeData({ a: 1, b: 2, c: 3 });
            const event = builder.getEvent();
            expect(event.data?.a).toBe(1);
            expect(event.data?.b).toBe(2);
            expect(event.data?.c).toBe(3);
        });

        it('should return this for chaining', () => {
            const builder = new EventBuilder('test');
            const result = builder.mergeData({ a: 1 });
            expect(result).toBe(builder);
        });
    });

    describe('setSuccess', () => {
        it('should set success status', () => {
            const builder = new EventBuilder('test');
            builder.setSuccess(true);
            const event = builder.getEvent();
            expect(event.success).toBe(true);
        });

        it('should set failure status', () => {
            const builder = new EventBuilder('test');
            builder.setSuccess(false);
            const event = builder.getEvent();
            expect(event.success).toBe(false);
        });
    });

    describe('setDuration', () => {
        it('should set duration', () => {
            const builder = new EventBuilder('test');
            builder.setDuration(500);
            const event = builder.getEvent();
            expect(event.durationMs).toBe(500);
        });
    });

    describe('autoDuration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should calculate duration from construction', async () => {
            vi.resetModules();
            const loggerModule = await import('../../src/modules/logger.ts');
            const EB = loggerModule.EventBuilder;

            const builder = new EB('test');
            vi.advanceTimersByTime(100);
            builder.autoDuration();
            const event = builder.getEvent();
            expect(event.durationMs).toBeGreaterThanOrEqual(100);
        });
    });

    describe('setError', () => {
        it('should set error and mark as failed', () => {
            const builder = new EventBuilder('test');
            builder.setError({ name: 'TestError', message: 'Test message' });
            const event = builder.getEvent();
            expect(event.error?.name).toBe('TestError');
            expect(event.error?.message).toBe('Test message');
            expect(event.success).toBe(false);
        });
    });

    describe('setCorrelationId', () => {
        it('should set correlation ID', () => {
            const builder = new EventBuilder('test');
            builder.setCorrelationId('corr-123');
            const event = builder.getEvent();
            expect(event.correlationId).toBe('corr-123');
        });
    });

    describe('setContext', () => {
        it('should set context', () => {
            const builder = new EventBuilder('test');
            builder.setContext({ currentTab: 'items' });
            const event = builder.getEvent();
            expect(event.context?.currentTab).toBe('items');
        });
    });

    describe('emit', () => {
        it('should emit at INFO level by default', () => {
            const builder = new EventBuilder('test.emit');
            builder.emit();
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should emit at specified level', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const builder = new EventBuilder('test.emit.warn');
            builder.emit(LogLevel.WARN);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('should merge accumulated data', () => {
            const builder = new EventBuilder('test.emit.data');
            builder.addData('field1', 'value1');
            builder.addData('field2', 'value2');
            builder.emit();

            const call = consoleSpy.mock.calls[0];
            const event = call[call.length - 1];
            expect(event.data?.field1).toBe('value1');
            expect(event.data?.field2).toBe('value2');
        });
    });

    describe('getEvent', () => {
        it('should return copy of event state', () => {
            const builder = new EventBuilder('test');
            builder.addData('key', 'value');

            const event1 = builder.getEvent();
            const event2 = builder.getEvent();

            expect(event1).not.toBe(event2);
            expect(event1).toEqual(event2);
        });
    });

    describe('chaining', () => {
        it('should support full method chaining', () => {
            const builder = new EventBuilder('test.chaining')
                .addData('step', 1)
                .mergeData({ extra: 'data' })
                .setSuccess(true)
                .setDuration(100)
                .setCorrelationId('chain-123')
                .setContext({ currentTab: 'test' });

            const event = builder.getEvent();
            expect(event.operation).toBe('test.chaining');
            expect(event.data?.step).toBe(1);
            expect(event.data?.extra).toBe('data');
            expect(event.success).toBe(true);
            expect(event.durationMs).toBe(100);
            expect(event.correlationId).toBe('chain-123');
            expect(event.context?.currentTab).toBe('test');
        });
    });
});

describe('LogLevel', () => {
    let LogLevel: any;

    beforeEach(async () => {
        vi.resetModules();
        const loggerModule = await import('../../src/modules/logger.ts');
        LogLevel = loggerModule.LogLevel;
    });

    it('should have DEBUG as lowest level', () => {
        expect(LogLevel.DEBUG).toBe(0);
    });

    it('should have INFO as second level', () => {
        expect(LogLevel.INFO).toBe(1);
    });

    it('should have WARN as third level', () => {
        expect(LogLevel.WARN).toBe(2);
    });

    it('should have ERROR as highest level', () => {
        expect(LogLevel.ERROR).toBe(3);
    });

    it('should maintain ascending order', () => {
        expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
        expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
        expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
    });
});
