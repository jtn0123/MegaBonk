// ========================================
// Logger Requests Module Tests
// ========================================
// Tests for RequestTimer class and trackedFetch

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger-core
const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../../src/modules/logger-core.ts', () => ({
    Logger: {
        getInstance: vi.fn(() => mockLogger),
    },
    LogLevel: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RequestTimer', () => {
    let RequestTimer: typeof import('../../src/modules/logger-requests.ts').RequestTimer;
    let requestTimer: import('../../src/modules/logger-requests.ts').RequestTimer;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        // Reset the singleton by clearing module cache
        vi.resetModules();
        
        const module = await import('../../src/modules/logger-requests.ts');
        RequestTimer = module.RequestTimer;
        requestTimer = RequestTimer.getInstance();
        requestTimer.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getInstance', () => {
        it('should return a singleton instance', async () => {
            const instance1 = RequestTimer.getInstance();
            const instance2 = RequestTimer.getInstance();
            
            expect(instance1).toBe(instance2);
        });

        it('should create instance on first call', () => {
            const instance = RequestTimer.getInstance();
            expect(instance).toBeDefined();
            expect(instance).toBeInstanceOf(Object);
        });
    });

    describe('startRequest', () => {
        it('should start tracking a request', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(1);
            expect(pending[0].url).toBe('https://api.example.com/data');
            expect(pending[0].method).toBe('GET');
        });

        it('should use GET as default method', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending[0].method).toBe('GET');
        });

        it('should record start time', () => {
            const beforeStart = performance.now();
            requestTimer.startRequest('req-1', 'https://api.example.com/data');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending[0].startTime).toBeGreaterThanOrEqual(beforeStart);
        });

        it('should track multiple concurrent requests', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data1', 'GET');
            requestTimer.startRequest('req-2', 'https://api.example.com/data2', 'POST');
            requestTimer.startRequest('req-3', 'https://api.example.com/data3', 'PUT');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(3);
        });

        it('should overwrite existing request with same ID', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/original', 'GET');
            requestTimer.startRequest('req-1', 'https://api.example.com/updated', 'POST');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(1);
            expect(pending[0].url).toBe('https://api.example.com/updated');
        });
    });

    describe('endRequest', () => {
        it('should complete a tracked request', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(100);
            requestTimer.endRequest('req-1', 200, 1024, false);
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(0);
        });

        it('should calculate duration', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(150);
            requestTimer.endRequest('req-1', 200);
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].durationMs).toBe(150);
        });

        it('should record status code', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 404);
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].status).toBe(404);
        });

        it('should record response size', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 200, 2048);
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].size).toBe(2048);
        });

        it('should record cached status', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 200, 1024, true);
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].cached).toBe(true);
        });

        it('should do nothing for unknown request ID', () => {
            requestTimer.endRequest('unknown-id', 200);
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(0);
        });

        it('should log at DEBUG level for fast requests', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(500);
            requestTimer.endRequest('req-1', 200);
            
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should log at WARN level for slow requests (>1000ms)', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(1500);
            requestTimer.endRequest('req-1', 200);
            
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        });

        it('should include request details in log', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'POST');
            vi.advanceTimersByTime(100);
            requestTimer.endRequest('req-1', 201, 512, false);
            
            const logCall = mockLogger.debug.mock.calls[0][0];
            expect(logCall.operation).toBe('request.complete');
            expect(logCall.data.url).toBe('https://api.example.com/data');
            expect(logCall.data.method).toBe('POST');
            expect(logCall.data.status).toBe(201);
            expect(logCall.data.size).toBe(512);
        });

        it('should mark success true for 2xx status codes', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 200);
            
            const logCall = mockLogger.debug.mock.calls[0][0];
            expect(logCall.success).toBe(true);
        });

        it('should mark success true for 3xx status codes', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 304);
            
            const logCall = mockLogger.debug.mock.calls[0][0];
            expect(logCall.success).toBe(true);
        });

        it('should mark success false for 4xx status codes', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 404);
            
            const logCall = mockLogger.debug.mock.calls[0][0];
            expect(logCall.success).toBe(false);
        });

        it('should mark success false for 5xx status codes', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.endRequest('req-1', 500);
            
            const logCall = mockLogger.debug.mock.calls[0][0];
            expect(logCall.success).toBe(false);
        });
    });

    describe('failRequest', () => {
        it('should record a failed request', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(100);
            requestTimer.failRequest('req-1', 'Network error');
            
            const stats = requestTimer.getStats();
            expect(stats.failedRequests).toBe(1);
        });

        it('should set status to 0 for failed requests', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.failRequest('req-1', 'Connection refused');
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].status).toBe(0);
        });

        it('should record error message', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.failRequest('req-1', 'Timeout exceeded');
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].error).toBe('Timeout exceeded');
        });

        it('should calculate duration for failed requests', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            vi.advanceTimersByTime(250);
            requestTimer.failRequest('req-1', 'Error');
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests[0].durationMs).toBe(250);
        });

        it('should do nothing for unknown request ID', () => {
            requestTimer.failRequest('unknown-id', 'Error');
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(0);
        });

        it('should log at ERROR level', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.failRequest('req-1', 'Connection reset');
            
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should include error details in log', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'POST');
            requestTimer.failRequest('req-1', 'SSL handshake failed');
            
            const logCall = mockLogger.error.mock.calls[0][0];
            expect(logCall.operation).toBe('request.failed');
            expect(logCall.success).toBe(false);
            expect(logCall.error.name).toBe('RequestError');
            expect(logCall.error.message).toBe('SSL handshake failed');
            expect(logCall.data.url).toBe('https://api.example.com/data');
            expect(logCall.data.method).toBe('POST');
        });

        it('should remove request from pending', () => {
            requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
            requestTimer.failRequest('req-1', 'Error');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(0);
        });
    });

    describe('getStats', () => {
        it('should return empty stats initially', () => {
            const stats = requestTimer.getStats();
            
            expect(stats.totalRequests).toBe(0);
            expect(stats.successfulRequests).toBe(0);
            expect(stats.failedRequests).toBe(0);
            expect(stats.cachedRequests).toBe(0);
            expect(stats.averageDurationMs).toBe(0);
            expect(stats.slowestRequest).toBeUndefined();
            expect(stats.recentRequests).toEqual([]);
        });

        it('should count total requests', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 200);
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.endRequest('req-2', 200);
            requestTimer.startRequest('req-3', 'url3', 'GET');
            requestTimer.endRequest('req-3', 200);
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(3);
        });

        it('should count successful requests (2xx and 3xx)', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 200);
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.endRequest('req-2', 201);
            requestTimer.startRequest('req-3', 'url3', 'GET');
            requestTimer.endRequest('req-3', 304);
            requestTimer.startRequest('req-4', 'url4', 'GET');
            requestTimer.endRequest('req-4', 404);
            
            const stats = requestTimer.getStats();
            expect(stats.successfulRequests).toBe(3);
        });

        it('should count failed requests (4xx, 5xx, and network errors)', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 404);
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.endRequest('req-2', 500);
            requestTimer.startRequest('req-3', 'url3', 'GET');
            requestTimer.failRequest('req-3', 'Network error');
            
            const stats = requestTimer.getStats();
            expect(stats.failedRequests).toBe(3);
        });

        it('should count cached requests', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 200, 100, true);
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.endRequest('req-2', 200, 100, false);
            requestTimer.startRequest('req-3', 'url3', 'GET');
            requestTimer.endRequest('req-3', 200, 100, true);
            
            const stats = requestTimer.getStats();
            expect(stats.cachedRequests).toBe(2);
        });

        it('should calculate average duration', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            vi.advanceTimersByTime(100);
            requestTimer.endRequest('req-1', 200);
            
            requestTimer.startRequest('req-2', 'url2', 'GET');
            vi.advanceTimersByTime(200);
            requestTimer.endRequest('req-2', 200);
            
            requestTimer.startRequest('req-3', 'url3', 'GET');
            vi.advanceTimersByTime(300);
            requestTimer.endRequest('req-3', 200);
            
            const stats = requestTimer.getStats();
            expect(stats.averageDurationMs).toBe(200); // (100 + 200 + 300) / 3
        });

        it('should identify slowest request', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            vi.advanceTimersByTime(100);
            requestTimer.endRequest('req-1', 200);
            
            requestTimer.startRequest('req-2', 'url2', 'GET');
            vi.advanceTimersByTime(500);
            requestTimer.endRequest('req-2', 200);
            
            requestTimer.startRequest('req-3', 'url3', 'GET');
            vi.advanceTimersByTime(200);
            requestTimer.endRequest('req-3', 200);
            
            const stats = requestTimer.getStats();
            expect(stats.slowestRequest?.url).toBe('url2');
            expect(stats.slowestRequest?.durationMs).toBe(500);
        });

        it('should return recent requests (last 10)', () => {
            for (let i = 0; i < 15; i++) {
                requestTimer.startRequest(`req-${i}`, `url${i}`, 'GET');
                requestTimer.endRequest(`req-${i}`, 200);
            }
            
            const stats = requestTimer.getStats();
            expect(stats.recentRequests).toHaveLength(10);
            expect(stats.recentRequests[0].url).toBe('url5');
            expect(stats.recentRequests[9].url).toBe('url14');
        });
    });

    describe('clear', () => {
        it('should clear all request data', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 200);
            requestTimer.startRequest('req-2', 'url2', 'GET');
            
            requestTimer.clear();
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(0);
            expect(requestTimer.getPendingRequests()).toHaveLength(0);
        });

        it('should allow new requests after clear', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.endRequest('req-1', 200);
            
            requestTimer.clear();
            
            requestTimer.startRequest('req-2', 'url2', 'POST');
            requestTimer.endRequest('req-2', 201);
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(1);
            expect(stats.recentRequests[0].url).toBe('url2');
        });
    });

    describe('getPendingRequests', () => {
        it('should return empty array when no pending requests', () => {
            const pending = requestTimer.getPendingRequests();
            expect(pending).toEqual([]);
        });

        it('should return all pending requests', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.startRequest('req-2', 'url2', 'POST');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(2);
        });

        it('should not include completed requests', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.endRequest('req-1', 200);
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(1);
            expect(pending[0].url).toBe('url2');
        });

        it('should not include failed requests', () => {
            requestTimer.startRequest('req-1', 'url1', 'GET');
            requestTimer.startRequest('req-2', 'url2', 'GET');
            requestTimer.failRequest('req-1', 'Error');
            
            const pending = requestTimer.getPendingRequests();
            expect(pending).toHaveLength(1);
            expect(pending[0].url).toBe('url2');
        });
    });

    describe('max completed requests limit', () => {
        it('should maintain max 100 completed requests', () => {
            for (let i = 0; i < 150; i++) {
                requestTimer.startRequest(`req-${i}`, `url${i}`, 'GET');
                requestTimer.endRequest(`req-${i}`, 200);
            }
            
            const stats = requestTimer.getStats();
            expect(stats.totalRequests).toBe(100);
        });

        it('should keep most recent requests when limit exceeded', () => {
            for (let i = 0; i < 110; i++) {
                requestTimer.startRequest(`req-${i}`, `url${i}`, 'GET');
                requestTimer.endRequest(`req-${i}`, 200);
            }
            
            const stats = requestTimer.getStats();
            // Should have requests 10-109 (the last 100)
            expect(stats.recentRequests[0].url).toBe('url100');
            expect(stats.recentRequests[9].url).toBe('url109');
        });
    });
});

describe('trackedFetch', () => {
    let trackedFetch: typeof import('../../src/modules/logger-requests.ts').trackedFetch;
    let requestTimer: import('../../src/modules/logger-requests.ts').RequestTimer;
    let localMockFetch: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.resetModules();
        
        // Create a fresh mock for each test
        localMockFetch = vi.fn();
        vi.stubGlobal('fetch', localMockFetch);
        
        const module = await import('../../src/modules/logger-requests.ts');
        trackedFetch = module.trackedFetch;
        requestTimer = module.requestTimer;
        requestTimer.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const createMockResponse = (status: number, headers: Record<string, string> = {}) => ({
        status,
        headers: {
            get: (name: string) => headers[name] ?? null,
        },
    });

    it('should call fetch with provided URL', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200, { 'content-length': '100' }));
        
        await trackedFetch('https://api.example.com/data');
        
        expect(localMockFetch).toHaveBeenCalledWith('https://api.example.com/data', undefined);
    });

    it('should pass options to fetch', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200));
        
        const options: RequestInit = {
            method: 'POST',
            body: JSON.stringify({ test: true }),
            headers: { 'Content-Type': 'application/json' },
        };
        
        await trackedFetch('https://api.example.com/data', options);
        
        expect(localMockFetch).toHaveBeenCalledWith('https://api.example.com/data', options);
    });

    it('should return the response', async () => {
        const mockResponse = createMockResponse(200);
        localMockFetch.mockResolvedValue(mockResponse);
        
        const response = await trackedFetch('https://api.example.com/data');
        
        expect(response).toBe(mockResponse);
    });

    it('should track successful request', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200, { 
            'content-length': '512',
            'x-cache': 'MISS',
        }));
        
        await trackedFetch('https://api.example.com/data');
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.successfulRequests).toBe(1);
    });

    it('should record response size from content-length', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200, { 'content-length': '2048' }));
        
        await trackedFetch('https://api.example.com/data');
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].size).toBe(2048);
    });

    it('should detect cached responses from x-cache header', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200, { 'x-cache': 'HIT' }));
        
        await trackedFetch('https://api.example.com/data');
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].cached).toBe(true);
    });

    it('should use GET as default method', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200));
        
        await trackedFetch('https://api.example.com/data');
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].method).toBe('GET');
    });

    it('should use provided method from options', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200));
        
        await trackedFetch('https://api.example.com/data', { method: 'POST' });
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].method).toBe('POST');
    });

    it('should track failed request and rethrow error', async () => {
        const error = new Error('Network failure');
        localMockFetch.mockRejectedValue(error);
        
        await expect(trackedFetch('https://api.example.com/data')).rejects.toThrow('Network failure');
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.failedRequests).toBe(1);
        expect(stats.recentRequests[0].error).toBe('Network failure');
    });

    it('should handle fetch throwing non-Error objects', async () => {
        const errorObj = { code: 'ECONNREFUSED' };
        localMockFetch.mockRejectedValue(errorObj);
        
        await expect(trackedFetch('https://api.example.com/data')).rejects.toEqual(errorObj);
        
        const stats = requestTimer.getStats();
        expect(stats.failedRequests).toBe(1);
    });

    it('should generate unique request IDs', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200));
        
        // Make multiple requests
        await trackedFetch('https://api.example.com/data1');
        await trackedFetch('https://api.example.com/data2');
        await trackedFetch('https://api.example.com/data3');
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(3);
    });

    it('should handle missing content-length header', async () => {
        localMockFetch.mockResolvedValue(createMockResponse(200));
        
        await trackedFetch('https://api.example.com/data');
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].size).toBe(0);
    });
});

describe('requestTimer singleton export', () => {
    it('should export requestTimer as singleton instance', async () => {
        vi.resetModules();
        const module = await import('../../src/modules/logger-requests.ts');
        
        expect(module.requestTimer).toBeDefined();
        expect(module.requestTimer).toBe(module.RequestTimer.getInstance());
    });
});

describe('RequestTiming interface', () => {
    let requestTimer: import('../../src/modules/logger-requests.ts').RequestTimer;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.resetModules();
        
        const module = await import('../../src/modules/logger-requests.ts');
        requestTimer = module.RequestTimer.getInstance();
        requestTimer.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should include all required fields in completed request', () => {
        requestTimer.startRequest('req-1', 'https://api.example.com/test', 'POST');
        vi.advanceTimersByTime(100);
        requestTimer.endRequest('req-1', 201, 1024, true);
        
        const stats = requestTimer.getStats();
        const timing = stats.recentRequests[0];
        
        expect(timing).toHaveProperty('url', 'https://api.example.com/test');
        expect(timing).toHaveProperty('method', 'POST');
        expect(timing).toHaveProperty('startTime');
        expect(timing).toHaveProperty('endTime');
        expect(timing).toHaveProperty('durationMs', 100);
        expect(timing).toHaveProperty('status', 201);
        expect(timing).toHaveProperty('size', 1024);
        expect(timing).toHaveProperty('cached', true);
    });

    it('should include error field for failed requests', () => {
        requestTimer.startRequest('req-1', 'https://api.example.com/test', 'GET');
        requestTimer.failRequest('req-1', 'Connection timed out');
        
        const stats = requestTimer.getStats();
        const timing = stats.recentRequests[0];
        
        expect(timing).toHaveProperty('error', 'Connection timed out');
        expect(timing).toHaveProperty('status', 0);
    });
});

describe('RequestStats interface', () => {
    let requestTimer: import('../../src/modules/logger-requests.ts').RequestTimer;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.resetModules();
        
        const module = await import('../../src/modules/logger-requests.ts');
        requestTimer = module.RequestTimer.getInstance();
        requestTimer.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return stats with all required fields', () => {
        const stats = requestTimer.getStats();
        
        expect(stats).toHaveProperty('totalRequests');
        expect(stats).toHaveProperty('successfulRequests');
        expect(stats).toHaveProperty('failedRequests');
        expect(stats).toHaveProperty('cachedRequests');
        expect(stats).toHaveProperty('averageDurationMs');
        expect(stats).toHaveProperty('recentRequests');
    });

    it('should round average duration to nearest integer', () => {
        requestTimer.startRequest('req-1', 'url1', 'GET');
        vi.advanceTimersByTime(33);
        requestTimer.endRequest('req-1', 200);
        
        requestTimer.startRequest('req-2', 'url2', 'GET');
        vi.advanceTimersByTime(34);
        requestTimer.endRequest('req-2', 200);
        
        const stats = requestTimer.getStats();
        // Average is 33.5, should be rounded
        expect(Number.isInteger(stats.averageDurationMs)).toBe(true);
    });
});

describe('edge cases', () => {
    let requestTimer: import('../../src/modules/logger-requests.ts').RequestTimer;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.resetModules();
        
        const module = await import('../../src/modules/logger-requests.ts');
        requestTimer = module.RequestTimer.getInstance();
        requestTimer.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should handle empty URL', () => {
        requestTimer.startRequest('req-1', '', 'GET');
        requestTimer.endRequest('req-1', 200);
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.recentRequests[0].url).toBe('');
    });

    it('should handle very long URLs', () => {
        const longUrl = 'https://api.example.com/' + 'a'.repeat(10000);
        requestTimer.startRequest('req-1', longUrl, 'GET');
        requestTimer.endRequest('req-1', 200);
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].url).toBe(longUrl);
    });

    it('should handle special characters in URL', () => {
        const specialUrl = 'https://api.example.com/data?query=test&filter=a%20b';
        requestTimer.startRequest('req-1', specialUrl, 'GET');
        requestTimer.endRequest('req-1', 200);
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].url).toBe(specialUrl);
    });

    it('should handle all HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
        
        methods.forEach((method, i) => {
            requestTimer.startRequest(`req-${i}`, `url${i}`, method);
            requestTimer.endRequest(`req-${i}`, 200);
        });
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(7);
    });

    it('should handle zero-byte responses', () => {
        requestTimer.startRequest('req-1', 'url1', 'GET');
        requestTimer.endRequest('req-1', 204, 0);
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].size).toBe(0);
    });

    it('should handle very large response sizes', () => {
        requestTimer.startRequest('req-1', 'url1', 'GET');
        requestTimer.endRequest('req-1', 200, 1073741824); // 1GB
        
        const stats = requestTimer.getStats();
        expect(stats.recentRequests[0].size).toBe(1073741824);
    });

    it('should handle concurrent requests to same URL', () => {
        requestTimer.startRequest('req-1', 'https://api.example.com/data', 'GET');
        requestTimer.startRequest('req-2', 'https://api.example.com/data', 'GET');
        
        vi.advanceTimersByTime(100);
        requestTimer.endRequest('req-1', 200);
        
        vi.advanceTimersByTime(100);
        requestTimer.endRequest('req-2', 200);
        
        const stats = requestTimer.getStats();
        expect(stats.totalRequests).toBe(2);
        expect(stats.recentRequests[0].durationMs).toBe(100);
        expect(stats.recentRequests[1].durationMs).toBe(200);
    });
});
