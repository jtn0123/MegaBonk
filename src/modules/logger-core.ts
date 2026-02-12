// ========================================
// Logger Core Module
// ========================================
// Core logging functions: info, warn, error, debug
// Type definitions and Logger class
// ========================================

// Vite import.meta.env type (subset of fields we use)
interface ViteImportMeta {
    env?: {
        PROD?: boolean;
        DEV?: boolean;
        MODE?: string;
    };
}

// ========================================
// Log Levels
// ========================================

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

// ========================================
// Type Definitions
// ========================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
    includeStackTrace: boolean;
    maxContextSize: number;
    sampling: SamplingConfig;
}

/**
 * Tail sampling configuration (loggingsucks.com pattern)
 * Keep 100% of errors/slow requests, sample the rest
 */
export interface SamplingConfig {
    /** Always send errors (default: 1.0 = 100%) */
    errorSampleRate: number;
    /** Threshold in ms for "slow" requests */
    slowRequestThresholdMs: number;
    /** Always send slow requests (default: 1.0 = 100%) */
    slowRequestSampleRate: number;
    /** Sample rate for normal successful requests (default: 0.05 = 5%) */
    defaultSampleRate: number;
}

/**
 * Base wide event structure
 */
export interface WideEvent {
    operation: string;
    timestamp: number;
    sessionId?: string;
    correlationId?: string;
    durationMs?: number;
    success?: boolean;
    context?: EventContext;
    error?: EventError;
    data?: Record<string, unknown>;
}

/**
 * Event context - enriches events with app state
 */
export interface EventContext {
    currentTab?: string;
    sessionId?: string;
    userAgent?: string;
    viewportSize?: { width: number; height: number };
    online?: boolean;
    [key: string]: unknown;
}

/**
 * Error information for error events
 */
export interface EventError {
    name: string;
    message: string;
    stack?: string;
    module?: string;
    cause?: unknown;
    /** Whether this error can be retried (loggingsucks.com pattern) */
    retriable?: boolean;
}

// ========================================
// Specific Wide Event Types
// ========================================

/**
 * Data loading event
 */
export interface DataLoadEvent extends WideEvent {
    operation: 'data.load';
    data: {
        filesLoaded: string[];
        fileTimings: Record<string, number>;
        totalSizeBytes?: number;
        validationResults: {
            valid: boolean;
            errorCount: number;
            warningCount: number;
        };
        fromCache?: boolean;
    };
}

/**
 * Filter/search event
 */
export interface FilterEvent extends WideEvent {
    operation: 'filter.apply';
    data: {
        tabName: string;
        searchQuery: string;
        filters: {
            tier?: string;
            rarity?: string;
            stacking?: string;
            favoritesOnly?: boolean;
        };
        totalItems: number;
        matchedItems: number;
        matchType?: 'exact' | 'fuzzy' | 'advanced';
    };
}

/**
 * Build planner event
 */
export interface BuildPlannerEvent extends WideEvent {
    operation: 'build.update' | 'build.save' | 'build.load' | 'build.share' | 'build.clear';
    data: {
        action: string;
        characterId?: string;
        weaponId?: string;
        tomeIds?: string[];
        itemIds?: string[];
        tomesCount: number;
        itemsCount: number;
        source?: 'url' | 'history' | 'template' | 'manual';
    };
}

/**
 * Calculator event
 */
export interface CalculatorEvent extends WideEvent {
    operation: 'calculator.compute';
    data: {
        itemId: string;
        itemName: string;
        targetValue: number;
        result: {
            stacksNeeded: number;
            perStack: number;
            actualValue: number;
            isCapped: boolean;
            isOneAndDone: boolean;
        };
    };
}

/**
 * Chart event
 */
export interface ChartEvent extends WideEvent {
    operation: 'chart.init' | 'chart.destroy' | 'chart.error';
    data: {
        chartId: string;
        chartType: 'scaling' | 'compare' | 'tome';
        dataPoints?: number;
        itemName?: string;
        reason?: string;
    };
}

/**
 * Modal event
 */
export interface ModalEvent extends WideEvent {
    operation: 'modal.open' | 'modal.close';
    data: {
        modalType: 'item' | 'weapon' | 'tome' | 'character' | 'shrine' | 'compare' | 'history';
        entityId?: string;
        entityName?: string;
        hasChart?: boolean;
    };
}

/**
 * Tab switch event
 */
export interface TabSwitchEvent extends WideEvent {
    operation: 'tab.switch';
    data: {
        fromTab: string;
        toTab: string;
        itemCount: number;
    };
}

/**
 * Error boundary event
 */
export interface ErrorBoundaryEvent extends WideEvent {
    operation: 'error.boundary' | 'error.unhandled' | 'error.promise';
    error: EventError;
    data?: {
        retries?: number;
        maxRetries?: number;
        recoveryAttempted?: boolean;
        recoverySucceeded?: boolean;
        userAction?: string;
    };
}

/**
 * Module lifecycle event
 */
export interface ModuleEvent extends WideEvent {
    operation: 'module.init' | 'module.init.failed' | 'module.degraded';
    data: {
        moduleName: string;
        required?: boolean;
        gracefulDegradation?: boolean;
    };
}

/**
 * Application lifecycle event
 */
export interface AppLifecycleEvent extends WideEvent {
    operation: 'app.init' | 'app.ready' | 'app.offline' | 'app.online' | 'app.update';
    data: {
        phase?: string;
        modulesLoaded?: string[];
        modulesFailed?: string[];
        initDurationMs?: number;
    };
}

/**
 * Validation event
 */
export interface ValidationEvent extends WideEvent {
    operation: 'data.validate';
    data: {
        valid: boolean;
        errorCount: number;
        warningCount: number;
        errors?: string[];
        warnings?: string[];
    };
}

// ========================================
// Logger Class
// ========================================

/**
 * Centralized logger implementing wide events pattern
 */
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private sessionId: string;
    private globalContext: Record<string, unknown> = {};
    private correlationStack: string[] = [];

    private constructor() {
        this.sessionId = this.generateSessionId();
        this.config = {
            minLevel: this.isProduction() ? LogLevel.INFO : LogLevel.DEBUG,
            enableConsole: true,
            enableRemote: false,
            includeStackTrace: !this.isProduction(),
            maxContextSize: 10000,
            sampling: {
                errorSampleRate: 1.0, // Keep 100% of errors
                slowRequestThresholdMs: 1000, // 1 second threshold
                slowRequestSampleRate: 1.0, // Keep 100% of slow requests
                defaultSampleRate: 0.05, // Sample 5% of normal requests
            },
        };
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Configure logger settings
     */
    public configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    public getConfig(): LoggerConfig {
        return { ...this.config };
    }

    /**
     * Log debug event
     */
    public debug(event: Omit<WideEvent, 'timestamp' | 'sessionId'>): void {
        this.log(LogLevel.DEBUG, event);
    }

    /**
     * Log info event
     */
    public info(event: Omit<WideEvent, 'timestamp' | 'sessionId'>): void {
        this.log(LogLevel.INFO, event);
    }

    /**
     * Log warning event
     */
    public warn(event: Omit<WideEvent, 'timestamp' | 'sessionId'>): void {
        this.log(LogLevel.WARN, event);
    }

    /**
     * Log error event
     */
    public error(event: Omit<WideEvent, 'timestamp' | 'sessionId'>): void {
        this.log(LogLevel.ERROR, event);
    }

    /**
     * Set global context value (enriches all events)
     */
    public setContext(key: string, value: unknown): void {
        this.globalContext[key] = value;
    }

    /**
     * Clear global context value
     */
    public clearContext(key: string): void {
        delete this.globalContext[key];
    }

    /**
     * Get current global context
     */
    public getContext(): Record<string, unknown> {
        return { ...this.globalContext };
    }

    /**
     * Get session ID
     */
    public getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Start a timer for measuring operation duration
     * Returns a stop function that returns elapsed milliseconds
     */
    public startTimer(_name: string): () => number {
        const start = performance.now();
        return () => Math.round(performance.now() - start);
    }

    /**
     * Start a correlation context for tracing related operations
     */
    public startOperation(name: string): string {
        const correlationId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.correlationStack.push(correlationId);
        return correlationId;
    }

    /**
     * End a correlation context
     */
    public endOperation(correlationId: string): void {
        const index = this.correlationStack.indexOf(correlationId);
        if (index > -1) {
            this.correlationStack.splice(index, 1);
        }
    }

    /**
     * Get current correlation ID (most recent)
     */
    public getCurrentCorrelationId(): string | undefined {
        return this.correlationStack[this.correlationStack.length - 1];
    }

    /**
     * Wrap an async operation with logging
     */
    public async withOperation<T>(
        operation: string,
        fn: () => Promise<T>,
        metadata?: Record<string, unknown>
    ): Promise<T> {
        const correlationId = this.startOperation(operation);
        const stopTimer = this.startTimer(operation);

        try {
            const result = await fn();
            this.info({
                operation,
                correlationId,
                durationMs: stopTimer(),
                success: true,
                data: metadata,
            });
            return result;
        } catch (error) {
            const err = error as Error;
            this.error({
                operation,
                correlationId,
                durationMs: stopTimer(),
                success: false,
                error: {
                    name: err.name,
                    message: err.message,
                    stack: this.config.includeStackTrace ? err.stack : undefined,
                },
                data: metadata,
            });
            throw error;
        } finally {
            this.endOperation(correlationId);
        }
    }

    // ========================================
    // Private Methods
    // ========================================

    /**
     * Core logging method
     */
    private log(level: LogLevel, event: Omit<WideEvent, 'timestamp' | 'sessionId'>): void {
        // Check log level
        if (level < this.config.minLevel) {
            return;
        }

        // Build full event
        const fullEvent: WideEvent = {
            ...event,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: event.correlationId || this.getCurrentCorrelationId(),
            context: this.buildContext(event.context),
        };

        // Output to console
        if (this.config.enableConsole) {
            this.outputToConsole(level, fullEvent);
        }

        // Send to remote endpoint (if configured)
        if (this.config.enableRemote && this.config.remoteEndpoint) {
            this.sendToRemote(fullEvent);
        }
    }

    /**
     * Build context with global context merged
     */
    private buildContext(eventContext?: EventContext): EventContext {
        const context: EventContext = {
            ...this.globalContext,
            ...eventContext,
            sessionId: this.sessionId,
            online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        };

        // Add viewport size if in browser
        if (typeof window !== 'undefined') {
            context.viewportSize = {
                width: window.innerWidth,
                height: window.innerHeight,
            };
        }

        return context;
    }

    /**
     * Output to console with appropriate formatting
     */
    private outputToConsole(level: LogLevel, event: WideEvent): void {
        const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const levelColors = ['#6b7280', '#3b82f6', '#f59e0b', '#ef4444'];
        const levelMethods = [console.debug, console.info, console.warn, console.error];

        const levelName = levelNames[level] ?? 'INFO';
        const color = levelColors[level] ?? '#3b82f6';
        const method = levelMethods[level] ?? console.info;

        if (this.isProduction()) {
            // Production: minimal JSON output
            method(JSON.stringify(event));
        } else {
            // Development: formatted output
            const duration = event.durationMs ? ` (${event.durationMs}ms)` : '';
            let success = '';
            if (event.success !== undefined) {
                success = event.success ? ' OK' : ' FAIL';
            }

            method(
                `%c[${levelName}]%c ${event.operation}${duration}${success}`,
                `color: ${color}; font-weight: bold;`,
                'color: inherit;',
                event
            );
        }
    }

    /**
     * Determine if event should be sampled for remote logging
     * Implements tail sampling from loggingsucks.com:
     * - Keep 100% of errors
     * - Keep 100% of slow requests
     * - Random sample the rest
     */
    private shouldSample(event: WideEvent): boolean {
        const { sampling } = this.config;

        // Always keep errors
        if (event.error || event.success === false) {
            return Math.random() < sampling.errorSampleRate;
        }

        // Always keep slow requests
        if (event.durationMs && event.durationMs > sampling.slowRequestThresholdMs) {
            return Math.random() < sampling.slowRequestSampleRate;
        }

        // Random sample normal requests
        return Math.random() < sampling.defaultSampleRate;
    }

    /**
     * Send event to remote endpoint (batched with tail sampling)
     */
    private remoteBuffer: WideEvent[] = [];
    private remoteFlushTimeout: ReturnType<typeof setTimeout> | null = null;

    private sendToRemote(event: WideEvent): void {
        // Apply tail sampling
        if (!this.shouldSample(event)) {
            return;
        }

        this.remoteBuffer.push(event);

        // Flush if buffer is full
        if (this.remoteBuffer.length >= 50) {
            this.flushRemoteBuffer();
            return;
        }

        // Schedule flush if not already scheduled
        if (!this.remoteFlushTimeout) {
            this.remoteFlushTimeout = setTimeout(() => this.flushRemoteBuffer(), 5000);
        }
    }

    private flushRemoteBuffer(): void {
        if (this.remoteBuffer.length === 0) return;

        const batch = this.remoteBuffer.splice(0, this.remoteBuffer.length);
        this.remoteFlushTimeout = null;

        if (this.config.remoteEndpoint) {
            fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
                keepalive: true,
            }).catch(() => {
                // Re-add to buffer on failure (with limit)
                if (this.remoteBuffer.length < 100) {
                    this.remoteBuffer.unshift(...batch);
                }
            });
        }
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    /**
     * Check if running in production
     */
    private isProduction(): boolean {
        // Vite sets import.meta.env.PROD
        try {
            return (import.meta as ViteImportMeta).env?.PROD === true;
        } catch {
            return false;
        }
    }
}

// ========================================
// Exports
// ========================================

/**
 * Singleton logger instance
 */
export const logger = Logger.getInstance();
