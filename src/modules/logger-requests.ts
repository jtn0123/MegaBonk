// ========================================
// Logger Requests Module
// ========================================
// Request tracking and network logging
// ========================================

import { Logger, LogLevel } from './logger-core';

// ========================================
// Request Timing Tracker
// ========================================

/**
 * Request timing information
 */
export interface RequestTiming {
    url: string;
    method: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status?: number;
    size?: number;
    cached?: boolean;
    error?: string;
}

/**
 * Request timing statistics
 */
export interface RequestStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cachedRequests: number;
    averageDurationMs: number;
    slowestRequest?: RequestTiming;
    recentRequests: RequestTiming[];
}

/**
 * RequestTimer - Tracks fetch request timing and statistics
 */
export class RequestTimer {
    private static instance: RequestTimer;
    private requests: Map<string, RequestTiming> = new Map();
    private completedRequests: RequestTiming[] = [];
    private maxCompletedRequests = 100;

    private constructor() {}

    /**
     * Get singleton instance
     */
    public static getInstance(): RequestTimer {
        if (!RequestTimer.instance) {
            RequestTimer.instance = new RequestTimer();
        }
        return RequestTimer.instance;
    }

    /**
     * Start tracking a request
     * @param requestId - Unique request identifier
     * @param url - Request URL
     * @param method - HTTP method
     */
    public startRequest(requestId: string, url: string, method: string = 'GET'): void {
        this.requests.set(requestId, {
            url,
            method,
            startTime: performance.now(),
        });
    }

    /**
     * Complete a request
     * @param requestId - Unique request identifier
     * @param status - HTTP status code
     * @param size - Response size in bytes
     * @param cached - Whether response was cached
     */
    public endRequest(requestId: string, status: number, size?: number, cached?: boolean): void {
        const timing = this.requests.get(requestId);
        if (!timing) return;

        timing.endTime = performance.now();
        timing.durationMs = Math.round(timing.endTime - timing.startTime);
        timing.status = status;
        timing.size = size;
        timing.cached = cached;

        // Move to completed
        this.requests.delete(requestId);
        this.completedRequests.push(timing);

        // Maintain max size
        if (this.completedRequests.length > this.maxCompletedRequests) {
            this.completedRequests = this.completedRequests.slice(-this.maxCompletedRequests);
        }

        // Log the request
        const logLevel = timing.durationMs > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
        Logger.getInstance()[logLevel === LogLevel.WARN ? 'warn' : 'debug']({
            operation: 'request.complete',
            durationMs: timing.durationMs,
            success: status >= 200 && status < 400,
            data: {
                url: timing.url,
                method: timing.method,
                status,
                size,
                cached,
            },
        });
    }

    /**
     * Record a failed request
     * @param requestId - Unique request identifier
     * @param error - Error message
     */
    public failRequest(requestId: string, error: string): void {
        const timing = this.requests.get(requestId);
        if (!timing) return;

        timing.endTime = performance.now();
        timing.durationMs = Math.round(timing.endTime - timing.startTime);
        timing.error = error;
        timing.status = 0;

        // Move to completed
        this.requests.delete(requestId);
        this.completedRequests.push(timing);

        // Maintain max size
        if (this.completedRequests.length > this.maxCompletedRequests) {
            this.completedRequests = this.completedRequests.slice(-this.maxCompletedRequests);
        }

        // Log the error
        Logger.getInstance().error({
            operation: 'request.failed',
            durationMs: timing.durationMs,
            success: false,
            error: {
                name: 'RequestError',
                message: error,
            },
            data: {
                url: timing.url,
                method: timing.method,
            },
        });
    }

    /**
     * Get request statistics
     */
    public getStats(): RequestStats {
        const completed = this.completedRequests;
        const successful = completed.filter(r => r.status && r.status >= 200 && r.status < 400);
        const failed = completed.filter(r => r.status === 0 || (r.status && r.status >= 400));
        const cached = completed.filter(r => r.cached);

        const durations = completed.filter(r => r.durationMs).map(r => r.durationMs!);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        const slowest = completed.reduce(
            (max, r) => (!max || (r.durationMs && r.durationMs > (max.durationMs || 0)) ? r : max),
            undefined as RequestTiming | undefined
        );

        return {
            totalRequests: completed.length,
            successfulRequests: successful.length,
            failedRequests: failed.length,
            cachedRequests: cached.length,
            averageDurationMs: Math.round(avgDuration),
            slowestRequest: slowest,
            recentRequests: completed.slice(-10),
        };
    }

    /**
     * Clear all request data
     */
    public clear(): void {
        this.requests.clear();
        this.completedRequests = [];
    }

    /**
     * Get pending requests
     */
    public getPendingRequests(): RequestTiming[] {
        return Array.from(this.requests.values());
    }
}

/**
 * Create a tracked fetch wrapper
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise resolving to Response
 */
export async function trackedFetch(url: string, options?: RequestInit): Promise<Response> {
    const timer = RequestTimer.getInstance();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const method = options?.method || 'GET';

    timer.startRequest(requestId, url, method);

    try {
        const response = await fetch(url, options);
        const size = parseInt(response.headers.get('content-length') || '0', 10);
        const cached = response.headers.get('x-cache') === 'HIT';

        timer.endRequest(requestId, response.status, size, cached);

        return response;
    } catch (error) {
        timer.failRequest(requestId, (error as Error).message);
        throw error;
    }
}

// ========================================
// Exports
// ========================================

/**
 * Singleton request timer instance
 */
export const requestTimer = RequestTimer.getInstance();
