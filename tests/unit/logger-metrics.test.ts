// ========================================
// Logger Metrics Module Tests
// ========================================
// Tests for EventBuilder class

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger-core before importing the module under test
vi.mock('../../src/modules/logger-core.ts', () => {
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    return {
        Logger: {
            getInstance: vi.fn(() => mockLogger),
        },
        LogLevel: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
        },
    };
});

describe('EventBuilder', () => {
    let EventBuilder: typeof import('../../src/modules/logger-metrics.ts').EventBuilder;
    let Logger: typeof import('../../src/modules/logger-core.ts').Logger;
    let LogLevel: typeof import('../../src/modules/logger-core.ts').LogLevel;
    let mockLogger: {
        debug: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
        warn: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        // Re-import to get fresh instances
        const metricsModule = await import('../../src/modules/logger-metrics.ts');
        const coreModule = await import('../../src/modules/logger-core.ts');
        
        EventBuilder = metricsModule.EventBuilder;
        Logger = coreModule.Logger;
        LogLevel = coreModule.LogLevel;
        mockLogger = Logger.getInstance() as unknown as typeof mockLogger;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should create an event with the specified operation', () => {
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();
            
            expect(event.operation).toBe('test.operation');
        });

        it('should set timestamp on construction', () => {
            const now = Date.now();
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();
            
            expect(event.timestamp).toBe(now);
        });

        it('should initialize with empty data object', () => {
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();
            
            expect(event.data).toEqual({});
        });
    });

    describe('addData', () => {
        it('should add a single data field', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key1', 'value1');
            
            const event = builder.getEvent();
            expect(event.data).toEqual({ key1: 'value1' });
        });

        it('should add multiple data fields via chaining', () => {
            const builder = new EventBuilder('test.operation');
            builder
                .addData('key1', 'value1')
                .addData('key2', 42)
                .addData('key3', { nested: true });
            
            const event = builder.getEvent();
            expect(event.data).toEqual({
                key1: 'value1',
                key2: 42,
                key3: { nested: true },
            });
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.addData('key', 'value');
            
            expect(result).toBe(builder);
        });

        it('should overwrite existing keys', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key', 'original').addData('key', 'updated');
            
            const event = builder.getEvent();
            expect(event.data?.key).toBe('updated');
        });

        it('should handle null and undefined values', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('nullKey', null).addData('undefinedKey', undefined);
            
            const event = builder.getEvent();
            expect(event.data?.nullKey).toBeNull();
            expect(event.data?.undefinedKey).toBeUndefined();
        });

        it('should handle array values', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('items', ['a', 'b', 'c']);
            
            const event = builder.getEvent();
            expect(event.data?.items).toEqual(['a', 'b', 'c']);
        });
    });

    describe('mergeData', () => {
        it('should merge multiple data fields at once', () => {
            const builder = new EventBuilder('test.operation');
            builder.mergeData({
                field1: 'value1',
                field2: 'value2',
                field3: 123,
            });
            
            const event = builder.getEvent();
            expect(event.data).toEqual({
                field1: 'value1',
                field2: 'value2',
                field3: 123,
            });
        });

        it('should merge with existing data', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('existing', 'original');
            builder.mergeData({ new: 'data' });
            
            const event = builder.getEvent();
            expect(event.data).toEqual({
                existing: 'original',
                new: 'data',
            });
        });

        it('should overwrite existing keys on merge', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key', 'original');
            builder.mergeData({ key: 'merged' });
            
            const event = builder.getEvent();
            expect(event.data?.key).toBe('merged');
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.mergeData({ a: 1 });
            
            expect(result).toBe(builder);
        });

        it('should handle empty object', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('existing', 'value');
            builder.mergeData({});
            
            const event = builder.getEvent();
            expect(event.data).toEqual({ existing: 'value' });
        });
    });

    describe('setSuccess', () => {
        it('should set success to true', () => {
            const builder = new EventBuilder('test.operation');
            builder.setSuccess(true);
            
            const event = builder.getEvent();
            expect(event.success).toBe(true);
        });

        it('should set success to false', () => {
            const builder = new EventBuilder('test.operation');
            builder.setSuccess(false);
            
            const event = builder.getEvent();
            expect(event.success).toBe(false);
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.setSuccess(true);
            
            expect(result).toBe(builder);
        });

        it('should allow changing success value', () => {
            const builder = new EventBuilder('test.operation');
            builder.setSuccess(true).setSuccess(false);
            
            const event = builder.getEvent();
            expect(event.success).toBe(false);
        });
    });

    describe('setDuration', () => {
        it('should set duration in milliseconds', () => {
            const builder = new EventBuilder('test.operation');
            builder.setDuration(150);
            
            const event = builder.getEvent();
            expect(event.durationMs).toBe(150);
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.setDuration(100);
            
            expect(result).toBe(builder);
        });

        it('should allow setting zero duration', () => {
            const builder = new EventBuilder('test.operation');
            builder.setDuration(0);
            
            const event = builder.getEvent();
            expect(event.durationMs).toBe(0);
        });

        it('should allow updating duration', () => {
            const builder = new EventBuilder('test.operation');
            builder.setDuration(100).setDuration(200);
            
            const event = builder.getEvent();
            expect(event.durationMs).toBe(200);
        });
    });

    describe('autoDuration', () => {
        it('should calculate duration from construction time', () => {
            const builder = new EventBuilder('test.operation');
            
            // Advance time by 100ms
            vi.advanceTimersByTime(100);
            builder.autoDuration();
            
            const event = builder.getEvent();
            expect(event.durationMs).toBe(100);
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.autoDuration();
            
            expect(result).toBe(builder);
        });

        it('should round duration to nearest integer', () => {
            const builder = new EventBuilder('test.operation');
            
            // Mock performance.now to return a fractional value
            const originalPerformanceNow = performance.now;
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 0 : 150.7;
            });
            
            const builder2 = new EventBuilder('test.operation');
            builder2.autoDuration();
            
            const event = builder2.getEvent();
            expect(Number.isInteger(event.durationMs)).toBe(true);
            
            performance.now = originalPerformanceNow;
        });
    });

    describe('setError', () => {
        it('should set error information', () => {
            const builder = new EventBuilder('test.operation');
            const error = {
                name: 'TestError',
                message: 'Something went wrong',
            };
            builder.setError(error);
            
            const event = builder.getEvent();
            expect(event.error).toEqual(error);
        });

        it('should automatically set success to false', () => {
            const builder = new EventBuilder('test.operation');
            builder.setSuccess(true); // Set true first
            builder.setError({
                name: 'TestError',
                message: 'Error occurred',
            });
            
            const event = builder.getEvent();
            expect(event.success).toBe(false);
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.setError({
                name: 'Error',
                message: 'test',
            });
            
            expect(result).toBe(builder);
        });

        it('should handle error with all optional fields', () => {
            const builder = new EventBuilder('test.operation');
            const error = {
                name: 'CompleteError',
                message: 'Full error details',
                stack: 'Error stack trace',
                module: 'test-module',
                cause: { originalError: 'cause' },
                retriable: true,
            };
            builder.setError(error);
            
            const event = builder.getEvent();
            expect(event.error).toEqual(error);
        });
    });

    describe('setCorrelationId', () => {
        it('should set correlation ID', () => {
            const builder = new EventBuilder('test.operation');
            builder.setCorrelationId('corr-123-abc');
            
            const event = builder.getEvent();
            expect(event.correlationId).toBe('corr-123-abc');
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.setCorrelationId('id-123');
            
            expect(result).toBe(builder);
        });
    });

    describe('setContext', () => {
        it('should set event context', () => {
            const builder = new EventBuilder('test.operation');
            const context = {
                currentTab: 'items',
                userAgent: 'test-agent',
            };
            builder.setContext(context);
            
            const event = builder.getEvent();
            expect(event.context).toEqual(context);
        });

        it('should return this for method chaining', () => {
            const builder = new EventBuilder('test.operation');
            const result = builder.setContext({ currentTab: 'test' });
            
            expect(result).toBe(builder);
        });

        it('should handle context with all optional fields', () => {
            const builder = new EventBuilder('test.operation');
            const context = {
                currentTab: 'weapons',
                sessionId: 'session-123',
                userAgent: 'Mozilla/5.0',
                viewportSize: { width: 1920, height: 1080 },
                online: true,
                customField: 'custom value',
            };
            builder.setContext(context);
            
            const event = builder.getEvent();
            expect(event.context).toEqual(context);
        });
    });

    describe('getEvent', () => {
        it('should return a copy of the event', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key', 'value');
            
            const event1 = builder.getEvent();
            const event2 = builder.getEvent();
            
            expect(event1).toEqual(event2);
            expect(event1).not.toBe(event2); // Different objects
        });

        it('should return a copy of the data', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key', 'value');
            
            const event = builder.getEvent();
            event.data!.key = 'modified';
            
            const event2 = builder.getEvent();
            expect(event2.data?.key).toBe('value'); // Original unchanged
        });

        it('should include all accumulated fields', () => {
            const builder = new EventBuilder('test.operation');
            builder
                .addData('dataKey', 'dataValue')
                .setSuccess(true)
                .setDuration(100)
                .setCorrelationId('corr-id')
                .setContext({ currentTab: 'items' });
            
            const event = builder.getEvent();
            
            expect(event.operation).toBe('test.operation');
            expect(event.data).toEqual({ dataKey: 'dataValue' });
            expect(event.success).toBe(true);
            expect(event.durationMs).toBe(100);
            expect(event.correlationId).toBe('corr-id');
            expect(event.context).toEqual({ currentTab: 'items' });
            expect(event.timestamp).toBeDefined();
        });
    });

    describe('emit', () => {
        it('should emit at INFO level by default', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit();
            
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should emit at DEBUG level when specified', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit(LogLevel.DEBUG);
            
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should emit at INFO level when specified', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit(LogLevel.INFO);
            
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        it('should emit at WARN level when specified', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit(LogLevel.WARN);
            
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should emit at ERROR level when specified', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit(LogLevel.ERROR);
            
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should include accumulated data in emitted event', () => {
            const builder = new EventBuilder('test.operation');
            builder.addData('key1', 'value1').addData('key2', 42);
            builder.emit();
            
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.data).toEqual({
                key1: 'value1',
                key2: 42,
            });
        });

        it('should auto-calculate duration if not set', () => {
            const builder = new EventBuilder('test.operation');
            vi.advanceTimersByTime(50);
            builder.emit();
            
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.durationMs).toBe(50);
        });

        it('should not auto-calculate duration if already set', () => {
            const builder = new EventBuilder('test.operation');
            builder.setDuration(999);
            vi.advanceTimersByTime(50);
            builder.emit();
            
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.durationMs).toBe(999);
        });

        it('should include operation in emitted event', () => {
            const builder = new EventBuilder('my.custom.operation');
            builder.emit();
            
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.operation).toBe('my.custom.operation');
        });

        it('should include success status in emitted event', () => {
            const builder = new EventBuilder('test.operation');
            builder.setSuccess(true);
            builder.emit();
            
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.success).toBe(true);
        });

        it('should include error in emitted event', () => {
            const builder = new EventBuilder('test.operation');
            const error = { name: 'TestError', message: 'test error' };
            builder.setError(error);
            builder.emit(LogLevel.ERROR);
            
            const emittedEvent = mockLogger.error.mock.calls[0][0];
            expect(emittedEvent.error).toEqual(error);
            expect(emittedEvent.success).toBe(false);
        });
    });

    describe('method chaining', () => {
        it('should support full fluent API', () => {
            const builder = new EventBuilder('data.load');
            
            builder
                .addData('filesLoaded', ['items', 'weapons'])
                .mergeData({ cached: true, source: 'api' })
                .setSuccess(true)
                .setDuration(150)
                .setCorrelationId('load-123')
                .setContext({ currentTab: 'items' });
            
            const event = builder.getEvent();
            
            expect(event.operation).toBe('data.load');
            expect(event.data).toEqual({
                filesLoaded: ['items', 'weapons'],
                cached: true,
                source: 'api',
            });
            expect(event.success).toBe(true);
            expect(event.durationMs).toBe(150);
            expect(event.correlationId).toBe('load-123');
            expect(event.context).toEqual({ currentTab: 'items' });
        });

        it('should emit after chained operations', () => {
            const builder = new EventBuilder('build.update');
            
            builder
                .addData('characterId', 'char-1')
                .addData('weaponId', 'weapon-1')
                .setSuccess(true)
                .emit();
            
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            const emittedEvent = mockLogger.info.mock.calls[0][0];
            expect(emittedEvent.data?.characterId).toBe('char-1');
        });
    });

    describe('edge cases', () => {
        it('should handle empty operation name', () => {
            const builder = new EventBuilder('');
            const event = builder.getEvent();
            
            expect(event.operation).toBe('');
        });

        it('should handle very long operation names', () => {
            const longName = 'a'.repeat(1000);
            const builder = new EventBuilder(longName);
            const event = builder.getEvent();
            
            expect(event.operation).toBe(longName);
        });

        it('should handle special characters in data keys', () => {
            const builder = new EventBuilder('test');
            builder.addData('key-with-dash', 'value');
            builder.addData('key.with.dots', 'value');
            builder.addData('key_with_underscore', 'value');
            
            const event = builder.getEvent();
            expect(event.data?.['key-with-dash']).toBe('value');
            expect(event.data?.['key.with.dots']).toBe('value');
            expect(event.data?.['key_with_underscore']).toBe('value');
        });

        it('should handle circular reference in data gracefully', () => {
            const builder = new EventBuilder('test');
            const circular: Record<string, unknown> = { name: 'test' };
            circular.self = circular;
            
            // Should not throw
            expect(() => builder.addData('circular', circular)).not.toThrow();
        });

        it('should handle multiple emits', () => {
            const builder = new EventBuilder('test.operation');
            builder.emit();
            builder.emit();
            builder.emit();
            
            expect(mockLogger.info).toHaveBeenCalledTimes(3);
        });
    });
});
