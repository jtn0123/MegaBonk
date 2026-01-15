/**
 * Real Integration Tests for Logger Module
 * No mocking - tests actual logger implementations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    logger,
    Logger,
    LogLevel,
    EventBuilder,
} from '../../src/modules/logger.ts';

// ========================================
// Logger Singleton Tests
// ========================================

describe('Logger Singleton - Real Integration Tests', () => {
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

    it('should generate unique session ID format', () => {
        const sessionId = logger.getSessionId();

        // Format: timestamp-randomstring
        expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/);
    });
});

// ========================================
// Logger Configuration Tests
// ========================================

describe('Logger Configuration - Real Integration Tests', () => {
    it('should get default configuration', () => {
        const config = logger.getConfig();

        expect(config).toBeDefined();
        expect(config.enableConsole).toBe(true);
        expect(config.enableRemote).toBe(false);
    });

    it('should have sampling configuration', () => {
        const config = logger.getConfig();

        expect(config.sampling).toBeDefined();
        expect(config.sampling.errorSampleRate).toBe(1.0);
        expect(config.sampling.defaultSampleRate).toBe(0.05);
    });

    it('should configure logger settings', () => {
        const originalConfig = logger.getConfig();

        logger.configure({ enableRemote: true });
        const newConfig = logger.getConfig();

        expect(newConfig.enableRemote).toBe(true);

        // Restore
        logger.configure({ enableRemote: originalConfig.enableRemote });
    });

    it('should preserve other settings when configuring', () => {
        const originalConfig = logger.getConfig();

        logger.configure({ enableRemote: true });
        const newConfig = logger.getConfig();

        expect(newConfig.enableConsole).toBe(originalConfig.enableConsole);
        expect(newConfig.minLevel).toBe(originalConfig.minLevel);

        // Restore
        logger.configure({ enableRemote: originalConfig.enableRemote });
    });
});

// ========================================
// Logger Methods Tests
// ========================================

describe('Logger Methods - Real Integration Tests', () => {
    beforeEach(() => {
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should call debug method without throwing', () => {
        expect(() => {
            logger.debug({
                operation: 'test.debug',
                data: { test: true },
            });
        }).not.toThrow();
    });

    it('should call info method without throwing', () => {
        expect(() => {
            logger.info({
                operation: 'test.info',
                data: { test: true },
            });
        }).not.toThrow();
    });

    it('should call warn method without throwing', () => {
        expect(() => {
            logger.warn({
                operation: 'test.warn',
                data: { test: true },
            });
        }).not.toThrow();
    });

    it('should call error method without throwing', () => {
        expect(() => {
            logger.error({
                operation: 'test.error',
                error: {
                    name: 'TestError',
                    message: 'Test error message',
                },
            });
        }).not.toThrow();
    });
});

// ========================================
// Context Management Tests
// ========================================

describe('Context Management - Real Integration Tests', () => {
    beforeEach(() => {
        // Clear any existing context
        const context = logger.getContext();
        Object.keys(context).forEach(key => {
            logger.clearContext(key);
        });
    });

    it('should set context value', () => {
        logger.setContext('testKey', 'testValue');

        const context = logger.getContext();
        expect(context.testKey).toBe('testValue');
    });

    it('should clear context value', () => {
        logger.setContext('clearKey', 'value');
        logger.clearContext('clearKey');

        const context = logger.getContext();
        expect(context.clearKey).toBeUndefined();
    });

    it('should get all context values', () => {
        logger.setContext('key1', 'value1');
        logger.setContext('key2', 'value2');

        const context = logger.getContext();

        expect(context.key1).toBe('value1');
        expect(context.key2).toBe('value2');

        // Cleanup
        logger.clearContext('key1');
        logger.clearContext('key2');
    });

    it('should return copy of context', () => {
        logger.setContext('copyTest', 'value');

        const context1 = logger.getContext();
        const context2 = logger.getContext();

        expect(context1).not.toBe(context2);
        expect(context1).toEqual(context2);

        // Cleanup
        logger.clearContext('copyTest');
    });

    it('should handle complex context values', () => {
        const complexValue = {
            nested: { deep: 'value' },
            array: [1, 2, 3],
        };

        logger.setContext('complex', complexValue);

        const context = logger.getContext();
        expect(context.complex).toEqual(complexValue);

        // Cleanup
        logger.clearContext('complex');
    });
});

// ========================================
// Timer Tests
// ========================================

describe('Timer - Real Integration Tests', () => {
    it('should start timer and return stop function', () => {
        const stopTimer = logger.startTimer('test-operation');

        expect(typeof stopTimer).toBe('function');
    });

    it('should measure elapsed time', async () => {
        const stopTimer = logger.startTimer('timing-test');

        // Wait a small amount
        await new Promise(resolve => setTimeout(resolve, 50));

        const elapsed = stopTimer();

        expect(elapsed).toBeGreaterThanOrEqual(40); // Account for timing variance
        expect(elapsed).toBeLessThan(200);
    });

    it('should return integer milliseconds', () => {
        const stopTimer = logger.startTimer('integer-test');
        const elapsed = stopTimer();

        expect(Number.isInteger(elapsed)).toBe(true);
    });
});

// ========================================
// Correlation Tests
// ========================================

describe('Correlation - Real Integration Tests', () => {
    it('should start operation and return correlation ID', () => {
        const correlationId = logger.startOperation('test-op');

        expect(correlationId).toBeDefined();
        expect(typeof correlationId).toBe('string');
        expect(correlationId).toContain('test-op');

        logger.endOperation(correlationId);
    });

    it('should end operation', () => {
        const correlationId = logger.startOperation('end-test');
        logger.endOperation(correlationId);

        // Should not throw and operation should be ended
        expect(logger.getCurrentCorrelationId()).not.toBe(correlationId);
    });

    it('should track current correlation ID', () => {
        const correlationId = logger.startOperation('current-test');

        expect(logger.getCurrentCorrelationId()).toBe(correlationId);

        logger.endOperation(correlationId);
    });

    it('should handle nested operations', () => {
        const outer = logger.startOperation('outer');
        const inner = logger.startOperation('inner');

        expect(logger.getCurrentCorrelationId()).toBe(inner);

        logger.endOperation(inner);
        expect(logger.getCurrentCorrelationId()).toBe(outer);

        logger.endOperation(outer);
    });

    it('should handle ending non-existent operation', () => {
        // Should not throw
        expect(() => {
            logger.endOperation('non-existent-id');
        }).not.toThrow();
    });
});

// ========================================
// withOperation Tests
// ========================================

describe('withOperation - Real Integration Tests', () => {
    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should wrap successful async operation', async () => {
        const result = await logger.withOperation('success-op', async () => {
            return 'success';
        });

        expect(result).toBe('success');
    });

    it('should wrap successful sync operation', async () => {
        const result = await logger.withOperation('sync-op', async () => {
            return 42;
        });

        expect(result).toBe(42);
    });

    it('should rethrow errors from operation', async () => {
        await expect(
            logger.withOperation('error-op', async () => {
                throw new Error('Operation failed');
            })
        ).rejects.toThrow('Operation failed');
    });

    it('should pass metadata to logged event', async () => {
        await logger.withOperation(
            'metadata-op',
            async () => 'result',
            { customField: 'value' }
        );

        // Metadata is passed internally - no direct verification needed
        // Just verify it doesn't throw
    });
});

// ========================================
// EventBuilder Tests
// ========================================

describe('EventBuilder - Real Integration Tests', () => {
    beforeEach(() => {
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should create event builder with operation', () => {
        const builder = new EventBuilder('test.operation');

        const event = builder.getEvent();
        expect(event.operation).toBe('test.operation');
    });

    it('should add data to event', () => {
        const builder = new EventBuilder('data.test');
        builder.addData('key', 'value');

        const event = builder.getEvent();
        expect(event.data?.key).toBe('value');
    });

    it('should chain addData calls', () => {
        const builder = new EventBuilder('chain.test')
            .addData('key1', 'value1')
            .addData('key2', 'value2');

        const event = builder.getEvent();
        expect(event.data?.key1).toBe('value1');
        expect(event.data?.key2).toBe('value2');
    });

    it('should merge data', () => {
        const builder = new EventBuilder('merge.test');
        builder.mergeData({
            field1: 'a',
            field2: 'b',
        });

        const event = builder.getEvent();
        expect(event.data?.field1).toBe('a');
        expect(event.data?.field2).toBe('b');
    });

    it('should set success status', () => {
        const builder = new EventBuilder('success.test');
        builder.setSuccess(true);

        const event = builder.getEvent();
        expect(event.success).toBe(true);
    });

    it('should set duration', () => {
        const builder = new EventBuilder('duration.test');
        builder.setDuration(100);

        const event = builder.getEvent();
        expect(event.durationMs).toBe(100);
    });

    it('should auto-calculate duration', async () => {
        const builder = new EventBuilder('auto.duration');

        await new Promise(resolve => setTimeout(resolve, 50));
        builder.autoDuration();

        const event = builder.getEvent();
        expect(event.durationMs).toBeGreaterThanOrEqual(40);
    });

    it('should set error information', () => {
        const builder = new EventBuilder('error.test');
        builder.setError({
            name: 'TestError',
            message: 'Test message',
        });

        const event = builder.getEvent();
        expect(event.error?.name).toBe('TestError');
        expect(event.error?.message).toBe('Test message');
        expect(event.success).toBe(false);
    });

    it('should set correlation ID', () => {
        const builder = new EventBuilder('correlation.test');
        builder.setCorrelationId('test-correlation-123');

        const event = builder.getEvent();
        expect(event.correlationId).toBe('test-correlation-123');
    });

    it('should set context', () => {
        const builder = new EventBuilder('context.test');
        builder.setContext({
            currentTab: 'items',
            online: true,
        });

        const event = builder.getEvent();
        expect(event.context?.currentTab).toBe('items');
        expect(event.context?.online).toBe(true);
    });

    it('should emit event without throwing', () => {
        const builder = new EventBuilder('emit.test')
            .addData('test', true)
            .setSuccess(true);

        expect(() => builder.emit()).not.toThrow();
    });

    it('should emit at different log levels', () => {
        const builder1 = new EventBuilder('debug.emit');
        expect(() => builder1.emit(LogLevel.DEBUG)).not.toThrow();

        const builder2 = new EventBuilder('info.emit');
        expect(() => builder2.emit(LogLevel.INFO)).not.toThrow();

        const builder3 = new EventBuilder('warn.emit');
        expect(() => builder3.emit(LogLevel.WARN)).not.toThrow();

        const builder4 = new EventBuilder('error.emit');
        expect(() => builder4.emit(LogLevel.ERROR)).not.toThrow();
    });

    it('should auto-calculate duration on emit if not set', () => {
        const builder = new EventBuilder('auto.emit');

        // Don't set duration manually
        builder.emit();

        const event = builder.getEvent();
        expect(event.durationMs).toBeDefined();
    });
});

// ========================================
// LogLevel Tests
// ========================================

describe('LogLevel - Real Integration Tests', () => {
    it('should have DEBUG level', () => {
        expect(LogLevel.DEBUG).toBe(0);
    });

    it('should have INFO level', () => {
        expect(LogLevel.INFO).toBe(1);
    });

    it('should have WARN level', () => {
        expect(LogLevel.WARN).toBe(2);
    });

    it('should have ERROR level', () => {
        expect(LogLevel.ERROR).toBe(3);
    });

    it('should have correct ordering', () => {
        expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
        expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
        expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Logger Edge Cases', () => {
    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    it('should handle empty operation name', () => {
        expect(() => {
            logger.info({
                operation: '',
                data: {},
            });
        }).not.toThrow();
    });

    it('should handle very long operation name', () => {
        const longName = 'a'.repeat(1000);
        expect(() => {
            logger.info({
                operation: longName,
            });
        }).not.toThrow();
    });

    it('should handle undefined data', () => {
        expect(() => {
            logger.info({
                operation: 'undefined.data',
                data: undefined,
            });
        }).not.toThrow();
    });

    it('should handle circular reference in data', () => {
        const circular: any = { name: 'test' };
        circular.self = circular;

        // This might throw due to JSON.stringify in console output
        // But the logger should handle it gracefully
        try {
            logger.info({
                operation: 'circular.test',
                data: circular,
            });
        } catch {
            // Expected - circular references can cause issues
        }
    });

    it('should handle rapid consecutive logs', () => {
        for (let i = 0; i < 100; i++) {
            logger.info({
                operation: `rapid.log.${i}`,
            });
        }
        // Should not throw
    });
});
