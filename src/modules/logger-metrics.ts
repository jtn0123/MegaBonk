// ========================================
// Logger Metrics Module
// ========================================
// Event building, timing, and stats collection
// ========================================

import { Logger, LogLevel, WideEvent, EventContext, EventError } from './logger-core';

// ========================================
// Event Builder Class
// ========================================

/**
 * EventBuilder - Accumulates data throughout request lifecycle
 * Implements the "build events throughout lifecycle" pattern from loggingsucks.com
 *
 * Usage:
 * ```typescript
 * const event = new EventBuilder('data.load');
 * event.addData('filesLoaded', ['items', 'weapons']);
 * // ... later in the flow ...
 * event.addData('validationResults', { valid: true });
 * event.setDuration(stopTimer());
 * event.setSuccess(true);
 * event.emit();
 * ```
 */
export class EventBuilder {
    private event: Partial<WideEvent>;
    private data: Record<string, unknown> = {};
    private startTime: number;

    constructor(operation: string) {
        this.startTime = performance.now();
        this.event = {
            operation,
            timestamp: Date.now(),
        };
    }

    /**
     * Add data to the event
     */
    addData(key: string, value: unknown): this {
        this.data[key] = value;
        return this;
    }

    /**
     * Merge multiple data fields at once
     */
    mergeData(data: Record<string, unknown>): this {
        Object.assign(this.data, data);
        return this;
    }

    /**
     * Set the operation success status
     */
    setSuccess(success: boolean): this {
        this.event.success = success;
        return this;
    }

    /**
     * Set the operation duration in milliseconds
     */
    setDuration(durationMs: number): this {
        this.event.durationMs = durationMs;
        return this;
    }

    /**
     * Auto-calculate duration from construction time
     */
    autoDuration(): this {
        this.event.durationMs = Math.round(performance.now() - this.startTime);
        return this;
    }

    /**
     * Set error information
     */
    setError(error: EventError): this {
        this.event.error = error;
        this.event.success = false;
        return this;
    }

    /**
     * Set correlation ID for tracing
     */
    setCorrelationId(correlationId: string): this {
        this.event.correlationId = correlationId;
        return this;
    }

    /**
     * Set additional context
     */
    setContext(context: EventContext): this {
        this.event.context = context;
        return this;
    }

    /**
     * Emit the event at the specified log level
     */
    emit(level: LogLevel = LogLevel.INFO): void {
        // Merge accumulated data
        this.event.data = this.data;

        // Auto-calculate duration if not set
        if (this.event.durationMs === undefined) {
            this.autoDuration();
        }

        // Emit via logger singleton
        const loggerInstance = Logger.getInstance();
        switch (level) {
            case LogLevel.DEBUG:
                loggerInstance.debug(this.event as WideEvent);
                break;
            case LogLevel.INFO:
                loggerInstance.info(this.event as WideEvent);
                break;
            case LogLevel.WARN:
                loggerInstance.warn(this.event as WideEvent);
                break;
            case LogLevel.ERROR:
                loggerInstance.error(this.event as WideEvent);
                break;
        }
    }

    /**
     * Get the current event state (for debugging)
     */
    getEvent(): Partial<WideEvent> {
        return { ...this.event, data: { ...this.data } };
    }
}
