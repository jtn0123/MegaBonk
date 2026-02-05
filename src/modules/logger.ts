// ========================================
// Wide Events Logger Module
// ========================================
// Main entry point - re-exports from split modules
// ========================================

// Core logging (info, warn, error, debug)
export {
    LogLevel,
    Logger,
    logger,
    // Types
    type LoggerConfig,
    type SamplingConfig,
    type WideEvent,
    type EventContext,
    type EventError,
    // Specific event types
    type DataLoadEvent,
    type FilterEvent,
    type BuildPlannerEvent,
    type CalculatorEvent,
    type ChartEvent,
    type ModalEvent,
    type TabSwitchEvent,
    type ErrorBoundaryEvent,
    type ModuleEvent,
    type AppLifecycleEvent,
    type ValidationEvent,
} from './logger-core';

// Metrics and event building
export { EventBuilder } from './logger-metrics';

// Request tracking
export { RequestTimer, requestTimer, trackedFetch, type RequestTiming, type RequestStats } from './logger-requests';
