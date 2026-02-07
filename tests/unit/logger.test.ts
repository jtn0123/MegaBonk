/* global setTimeout, Response */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock logger to test real implementation (setup.js mocks it globally)
vi.unmock('../../src/modules/logger.ts');

import { logger, Logger, LogLevel, EventBuilder } from '../../src/modules/logger.ts';

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

    describe('EventBuilder', () => {
        let consoleSpy;

        beforeEach(() => {
            logger.configure({ minLevel: LogLevel.DEBUG, enableConsole: true });
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

        it('should create event with operation and timestamp', () => {
            const builder = new EventBuilder('test.operation');
            const event = builder.getEvent();

            expect(event.operation).toBe('test.operation');
            expect(event.timestamp).toBeDefined();
            expect(typeof event.timestamp).toBe('number');
        });

        it('should accumulate data via addData()', () => {
            const builder = new EventBuilder('test.data');
            builder.addData('key1', 'value1');
            builder.addData('key2', 42);

            const event = builder.getEvent();
            expect(event.data.key1).toBe('value1');
            expect(event.data.key2).toBe(42);
        });

        it('should merge data via mergeData()', () => {
            const builder = new EventBuilder('test.merge');
            builder.addData('existing', 'value');
            builder.mergeData({ new1: 'a', new2: 'b' });

            const event = builder.getEvent();
            expect(event.data.existing).toBe('value');
            expect(event.data.new1).toBe('a');
            expect(event.data.new2).toBe('b');
        });

        it('should set success status', () => {
            const builder = new EventBuilder('test.success');
            builder.setSuccess(true);

            const event = builder.getEvent();
            expect(event.success).toBe(true);
        });

        it('should set duration manually', () => {
            const builder = new EventBuilder('test.duration');
            builder.setDuration(150);

            const event = builder.getEvent();
            expect(event.durationMs).toBe(150);
        });

        it('should auto-calculate duration', async () => {
            const builder = new EventBuilder('test.auto-duration');
            await new Promise(resolve => setTimeout(resolve, 50));
            builder.autoDuration();

            const event = builder.getEvent();
            expect(event.durationMs).toBeGreaterThanOrEqual(40);
            expect(event.durationMs).toBeLessThan(200);
        });

        it('should set error and mark success=false', () => {
            const builder = new EventBuilder('test.error');
            builder.setError({
                name: 'TestError',
                message: 'Something failed',
                retriable: true,
            });

            const event = builder.getEvent();
            expect(event.error.name).toBe('TestError');
            expect(event.error.message).toBe('Something failed');
            expect(event.error.retriable).toBe(true);
            expect(event.success).toBe(false);
        });

        it('should set correlation ID', () => {
            const builder = new EventBuilder('test.correlation');
            builder.setCorrelationId('corr-123');

            const event = builder.getEvent();
            expect(event.correlationId).toBe('corr-123');
        });

        it('should emit at correct log level', () => {
            const builder = new EventBuilder('test.emit');
            builder.addData('test', 'value');
            builder.emit(LogLevel.WARN);

            expect(consoleSpy.warn).toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
        });

        it('should emit at INFO level by default', () => {
            const builder = new EventBuilder('test.default-emit');
            builder.emit();

            expect(consoleSpy.info).toHaveBeenCalled();
        });

        it('should support fluent chaining', () => {
            const builder = new EventBuilder('test.chain')
                .addData('key', 'value')
                .setSuccess(true)
                .setDuration(100)
                .setCorrelationId('chain-123');

            const event = builder.getEvent();
            expect(event.data.key).toBe('value');
            expect(event.success).toBe(true);
            expect(event.durationMs).toBe(100);
            expect(event.correlationId).toBe('chain-123');
        });

        it('should auto-calculate duration on emit if not set', () => {
            const builder = new EventBuilder('test.auto-emit');
            builder.emit();

            const callArgs = consoleSpy.info.mock.calls[0];
            const eventArg = callArgs[callArgs.length - 1];
            expect(eventArg.durationMs).toBeDefined();
            expect(typeof eventArg.durationMs).toBe('number');
        });
    });

    describe('SamplingConfig', () => {
        it('should have default sampling config', () => {
            const config = logger.getConfig();

            expect(config.sampling).toBeDefined();
            expect(config.sampling.errorSampleRate).toBe(1.0);
            expect(config.sampling.slowRequestThresholdMs).toBe(1000);
            expect(config.sampling.slowRequestSampleRate).toBe(1.0);
            expect(config.sampling.defaultSampleRate).toBe(0.05);
        });

        it('should allow configuring sampling', () => {
            const originalConfig = logger.getConfig();

            logger.configure({
                sampling: {
                    errorSampleRate: 0.5,
                    slowRequestThresholdMs: 500,
                    slowRequestSampleRate: 0.8,
                    defaultSampleRate: 0.1,
                },
            });

            const config = logger.getConfig();
            expect(config.sampling.errorSampleRate).toBe(0.5);
            expect(config.sampling.slowRequestThresholdMs).toBe(500);

            // Reset
            logger.configure({ sampling: originalConfig.sampling });
        });
    });

    describe('Remote logging', () => {
        let fetchSpy;

        beforeEach(() => {
            fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
            logger.configure({
                enableRemote: true,
                remoteEndpoint: 'https://test.example.com/logs',
                enableConsole: false,
            });
        });

        afterEach(() => {
            vi.restoreAllMocks();
            logger.configure({
                enableRemote: false,
                remoteEndpoint: undefined,
                enableConsole: true,
            });
        });

        it('should not send to remote when disabled', () => {
            logger.configure({ enableRemote: false });
            logger.info({ operation: 'test.no-remote' });

            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('should not send to remote without endpoint', () => {
            logger.configure({ enableRemote: true, remoteEndpoint: undefined });
            logger.info({ operation: 'test.no-endpoint' });

            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('should use keepalive option in fetch', async () => {
            // Force high sample rate for this test
            logger.configure({
                sampling: {
                    errorSampleRate: 1.0,
                    slowRequestThresholdMs: 1000,
                    slowRequestSampleRate: 1.0,
                    defaultSampleRate: 1.0, // Always sample for test
                },
            });

            // Log an error (always sampled)
            logger.error({
                operation: 'test.keepalive',
                error: { name: 'TestError', message: 'test' },
            });

            // Trigger flush by logging 50 events
            for (let i = 0; i < 50; i++) {
                logger.error({
                    operation: 'test.flush',
                    error: { name: 'TestError', message: 'test' },
                });
            }

            // Check fetch was called with keepalive
            expect(fetchSpy).toHaveBeenCalled();
            const fetchCall = fetchSpy.mock.calls[0];
            expect(fetchCall[1].keepalive).toBe(true);
        });
    });
});

import { RequestTimer, trackedFetch } from '../../src/modules/logger.ts';

describe('RequestTimer', () => {
    let timer;

    beforeEach(() => {
        timer = RequestTimer.getInstance();
        timer.clear();
    });

    afterEach(() => {
        timer.clear();
    });

    describe('singleton', () => {
        it('should return the same instance', () => {
            const instance1 = RequestTimer.getInstance();
            const instance2 = RequestTimer.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('startRequest', () => {
        it('should start tracking a request', () => {
            timer.startRequest('req-1', 'https://example.com/api', 'GET');
            
            const pending = timer.getPendingRequests();
            expect(pending).toHaveLength(1);
            expect(pending[0].url).toBe('https://example.com/api');
            expect(pending[0].method).toBe('GET');
        });

        it('should use GET as default method', () => {
            timer.startRequest('req-2', 'https://example.com/api');
            
            const pending = timer.getPendingRequests();
            expect(pending[0].method).toBe('GET');
        });

        it('should record start time', () => {
            const before = performance.now();
            timer.startRequest('req-3', 'https://example.com/api');
            const after = performance.now();
            
            const pending = timer.getPendingRequests();
            expect(pending[0].startTime).toBeGreaterThanOrEqual(before);
            expect(pending[0].startTime).toBeLessThanOrEqual(after);
        });
    });

    describe('endRequest', () => {
        it('should complete a request', () => {
            timer.startRequest('req-4', 'https://example.com/api');
            timer.endRequest('req-4', 200, 1024, false);
            
            const pending = timer.getPendingRequests();
            expect(pending).toHaveLength(0);
            
            const stats = timer.getStats();
            expect(stats.totalRequests).toBe(1);
            expect(stats.successfulRequests).toBe(1);
        });

        it('should record duration', async () => {
            timer.startRequest('req-5', 'https://example.com/api');
            await new Promise(resolve => setTimeout(resolve, 50));
            timer.endRequest('req-5', 200);
            
            const stats = timer.getStats();
            expect(stats.recentRequests[0].durationMs).toBeGreaterThanOrEqual(40);
        });

        it('should record status code', () => {
            timer.startRequest('req-6', 'https://example.com/api');
            timer.endRequest('req-6', 404);
            
            const stats = timer.getStats();
            expect(stats.recentRequests[0].status).toBe(404);
        });

        it('should record response size', () => {
            timer.startRequest('req-7', 'https://example.com/api');
            timer.endRequest('req-7', 200, 2048);
            
            const stats = timer.getStats();
            expect(stats.recentRequests[0].size).toBe(2048);
        });

        it('should record cached status', () => {
            timer.startRequest('req-8', 'https://example.com/api');
            timer.endRequest('req-8', 200, 1024, true);
            
            const stats = timer.getStats();
            expect(stats.recentRequests[0].cached).toBe(true);
            expect(stats.cachedRequests).toBe(1);
        });

        it('should ignore non-existent request', () => {
            expect(() => timer.endRequest('non-existent', 200)).not.toThrow();
        });
    });

    describe('failRequest', () => {
        it('should record failed request', () => {
            timer.startRequest('req-9', 'https://example.com/api');
            timer.failRequest('req-9', 'Network error');
            
            const stats = timer.getStats();
            expect(stats.failedRequests).toBe(1);
            expect(stats.recentRequests[0].error).toBe('Network error');
            expect(stats.recentRequests[0].status).toBe(0);
        });

        it('should ignore non-existent request', () => {
            expect(() => timer.failRequest('non-existent', 'error')).not.toThrow();
        });
    });

    describe('getStats', () => {
        it('should return correct totals', () => {
            timer.startRequest('req-10', '/api/1');
            timer.endRequest('req-10', 200);
            timer.startRequest('req-11', '/api/2');
            timer.endRequest('req-11', 200);
            timer.startRequest('req-12', '/api/3');
            timer.failRequest('req-12', 'error');
            
            const stats = timer.getStats();
            expect(stats.totalRequests).toBe(3);
            expect(stats.successfulRequests).toBe(2);
            expect(stats.failedRequests).toBe(1);
        });

        it('should calculate average duration', () => {
            timer.startRequest('req-13', '/api/1');
            timer.endRequest('req-13', 200);
            timer.startRequest('req-14', '/api/2');
            timer.endRequest('req-14', 200);
            
            const stats = timer.getStats();
            expect(typeof stats.averageDurationMs).toBe('number');
        });

        it('should track slowest request', async () => {
            timer.startRequest('fast', '/api/fast');
            timer.endRequest('fast', 200);
            
            timer.startRequest('slow', '/api/slow');
            await new Promise(resolve => setTimeout(resolve, 50));
            timer.endRequest('slow', 200);
            
            const stats = timer.getStats();
            expect(stats.slowestRequest?.url).toBe('/api/slow');
        });

        it('should return recent requests', () => {
            for (let i = 0; i < 15; i++) {
                timer.startRequest(`req-${i}`, `/api/${i}`);
                timer.endRequest(`req-${i}`, 200);
            }
            
            const stats = timer.getStats();
            expect(stats.recentRequests.length).toBe(10);
        });

        it('should count 4xx as failed', () => {
            timer.startRequest('req-400', '/api/400');
            timer.endRequest('req-400', 400);
            
            const stats = timer.getStats();
            expect(stats.failedRequests).toBe(1);
        });
    });

    describe('clear', () => {
        it('should clear all data', () => {
            timer.startRequest('req-clear', '/api/clear');
            timer.endRequest('req-clear', 200);
            
            timer.clear();
            
            const stats = timer.getStats();
            expect(stats.totalRequests).toBe(0);
            expect(timer.getPendingRequests()).toHaveLength(0);
        });
    });

    describe('getPendingRequests', () => {
        it('should return pending requests', () => {
            timer.startRequest('pending-1', '/api/1');
            timer.startRequest('pending-2', '/api/2');
            
            const pending = timer.getPendingRequests();
            expect(pending).toHaveLength(2);
        });
    });

    describe('max completed requests limit', () => {
        it('should maintain max size of completed requests', () => {
            for (let i = 0; i < 120; i++) {
                timer.startRequest(`req-${i}`, `/api/${i}`);
                timer.endRequest(`req-${i}`, 200);
            }
            
            const stats = timer.getStats();
            expect(stats.totalRequests).toBeLessThanOrEqual(100);
        });
    });
});

describe('trackedFetch', () => {
    let fetchSpy;
    let timer;

    beforeEach(() => {
        timer = RequestTimer.getInstance();
        timer.clear();
        
        fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
            return Promise.resolve(new Response('test', {
                status: 200,
                headers: { 'content-length': '4' },
            }));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        timer.clear();
    });

    it('should make fetch request', async () => {
        await trackedFetch('https://example.com/api');
        
        expect(fetchSpy).toHaveBeenCalledWith('https://example.com/api', undefined);
    });

    it('should pass options to fetch', async () => {
        const options = { method: 'POST', body: 'data' };
        await trackedFetch('https://example.com/api', options);
        
        expect(fetchSpy).toHaveBeenCalledWith('https://example.com/api', options);
    });

    it('should track successful request', async () => {
        await trackedFetch('https://example.com/api');
        
        const stats = timer.getStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.successfulRequests).toBe(1);
    });

    it('should track request URL and method', async () => {
        await trackedFetch('https://example.com/api', { method: 'POST' });
        
        const stats = timer.getStats();
        expect(stats.recentRequests[0].url).toBe('https://example.com/api');
        expect(stats.recentRequests[0].method).toBe('POST');
    });

    it('should track failed request', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('Network failure'));
        
        await expect(trackedFetch('https://example.com/api')).rejects.toThrow('Network failure');
        
        const stats = timer.getStats();
        expect(stats.failedRequests).toBe(1);
    });

    it('should return response from fetch', async () => {
        const response = await trackedFetch('https://example.com/api');
        
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
    });

    it('should detect cached responses', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('cached', {
            status: 200,
            headers: { 'x-cache': 'HIT', 'content-length': '6' },
        }));
        
        await trackedFetch('https://example.com/api');
        
        const stats = timer.getStats();
        expect(stats.cachedRequests).toBe(1);
    });

    it('should parse content-length header', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('test data', {
            status: 200,
            headers: { 'content-length': '9' },
        }));
        
        await trackedFetch('https://example.com/api');
        
        const stats = timer.getStats();
        expect(stats.recentRequests[0].size).toBe(9);
    });

    it('should use GET as default method', async () => {
        await trackedFetch('https://example.com/api');
        
        const stats = timer.getStats();
        expect(stats.recentRequests[0].method).toBe('GET');
    });
});
