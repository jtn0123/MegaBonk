import { LogLevel, logger, type LoggerListener } from '../logger.ts';
import type {
    PipelineStageName,
    ValidatorEventLevel,
    ValidatorLogEvent,
    ValidatorRunProgress,
    ValidatorRunStatus,
    ValidatorRuntimeEvent,
    ValidatorRuntimeStatus,
    ValidatorStageProgress,
    ValidatorStallDiagnosis,
    ValidatorStallInfo,
} from './validator-types.ts';

const HEARTBEAT_INTERVAL_MS = 1000;
const NO_PROGRESS_STALL_MS = 5000;
const MAX_LOG_EVENTS = 2000;
const DEFAULT_EVENT_ENDPOINT = '/__validator/events';

const STAGE_WARNING_THRESHOLDS_MS: Partial<Record<PipelineStageName, number>> = {
    template_readiness: 10000,
    image_load: 3000,
    grid_detection: 8000,
    occupancy_filtering: 8000,
    candidate_generation: 15000,
    grid_verification: 15000,
    verification_filtering: 10000,
    count_ocr: 15000,
    dedupe_finalization: 3000,
};

interface ActiveRunState {
    runId: string;
    imageName: string;
    status: ValidatorRunStatus;
    startedAtIso: string;
    startedAtMs: number;
    updatedAtIso: string;
    updatedAtMs: number;
    completedAtIso?: string;
    currentStage?: PipelineStageName;
    activeStages: PipelineStageName[];
    stageStartedAtMs: Partial<Record<PipelineStageName, number>>;
    stageProgress: Partial<Record<PipelineStageName, ValidatorStageProgress>>;
    warningsCount: number;
    eventCount: number;
    stalled: boolean;
    currentDiagnosis: ValidatorStallInfo | null;
    slowestStage: ValidatorRunProgress['slowestStage'];
    lastStallKey?: string;
    lastProgressEventAtMs: number;
    heartbeatTimer?: ReturnType<typeof setInterval>;
    watchdogTimer?: ReturnType<typeof setInterval>;
    logEvents: ValidatorLogEvent[];
    unsubscribeLogger?: () => void;
}

type ValidatorEventListener = (event: ValidatorRuntimeEvent) => void;

const listeners = new Set<ValidatorEventListener>();
const archivedRuns = new Map<string, { progressSummary: ValidatorRunProgress; logEvents: ValidatorLogEvent[] }>();
let activeRun: ActiveRunState | null = null;
let eventEndpoint: string | null = DEFAULT_EVENT_ENDPOINT;

function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function nowIso(): string {
    return new Date().toISOString();
}

function cloneStageProgress(
    stageProgress: Partial<Record<PipelineStageName, ValidatorStageProgress>>
): Partial<Record<PipelineStageName, ValidatorStageProgress>> {
    return Object.fromEntries(
        Object.entries(stageProgress).map(([stageName, progress]) => [
            stageName,
            progress
                ? {
                      ...progress,
                      metadata: { ...progress.metadata },
                  }
                : progress,
        ])
    ) as Partial<Record<PipelineStageName, ValidatorStageProgress>>;
}

function cloneProgressSummary(run: ActiveRunState): ValidatorRunProgress {
    return {
        runStatus: run.status,
        startedAt: run.startedAtIso,
        updatedAt: run.updatedAtIso,
        completedAt: run.completedAtIso,
        currentStage: run.currentStage,
        totalElapsedMs:
            run.status === 'completed' || run.status === 'failed'
                ? Math.max(0, Date.parse(run.completedAtIso || run.updatedAtIso) - Date.parse(run.startedAtIso))
                : Math.max(0, Math.round(nowMs() - run.startedAtMs)),
        stageElapsedMs:
            run.currentStage && run.stageStartedAtMs[run.currentStage]
                ? Math.max(0, Math.round(nowMs() - (run.stageStartedAtMs[run.currentStage] || nowMs())))
                : 0,
        activeWarningCount: run.warningsCount,
        eventCount: run.eventCount,
        stalled: run.stalled,
        currentDiagnosis: run.currentDiagnosis ? { ...run.currentDiagnosis } : null,
        slowestStage: run.slowestStage ? { ...run.slowestStage } : null,
        stageProgress: cloneStageProgress(run.stageProgress),
    };
}

function mapLogLevel(level: LogLevel): ValidatorEventLevel {
    if (level === LogLevel.ERROR) return 'error';
    if (level === LogLevel.WARN) return 'warn';
    if (level === LogLevel.INFO) return 'info';
    return 'debug';
}

function recordLogEvent(run: ActiveRunState, logEvent: ValidatorLogEvent): void {
    run.logEvents.push(logEvent);

    if (run.logEvents.length <= MAX_LOG_EVENTS) {
        return;
    }

    for (let index = 0; index < run.logEvents.length && run.logEvents.length > MAX_LOG_EVENTS; ) {
        const candidate = run.logEvents[index];
        if (!candidate || candidate.level === 'warn' || candidate.level === 'error') {
            index += 1;
            continue;
        }
        run.logEvents.splice(index, 1);
    }

    while (run.logEvents.length > MAX_LOG_EVENTS) {
        run.logEvents.shift();
    }
}

function eventShouldCreateRuntimeLog(event: ValidatorRuntimeEvent): boolean {
    return event.type !== 'stage_progress' && event.type !== 'logger_event';
}

function createRuntimeLogEvent(event: ValidatorRuntimeEvent): ValidatorLogEvent {
    return {
        id: `${event.runId}:${event.timestamp}:${event.type}:${Math.random().toString(36).slice(2, 8)}`,
        timestamp: event.timestamp,
        runId: event.runId,
        level: event.level,
        source: 'runtime',
        message: event.message,
        stage: event.stage,
        metadata: { ...(event.metadata || {}) },
    };
}

function sendToEndpoint(event: ValidatorRuntimeEvent): void {
    if (!eventEndpoint || typeof fetch !== 'function') {
        return;
    }

    void fetch(eventEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
        keepalive: true,
    }).catch(() => {
        // Forwarding is best-effort in beta mode.
    });
}

function emit(event: ValidatorRuntimeEvent): void {
    if (activeRun && event.runId === activeRun.runId) {
        activeRun.eventCount += 1;
        activeRun.updatedAtIso = event.timestamp;
        activeRun.updatedAtMs = nowMs();
        if (event.type === 'stage_progress') {
            activeRun.lastProgressEventAtMs = activeRun.updatedAtMs;
        }
        if (event.type === 'stage_warning') {
            activeRun.warningsCount += 1;
        }
        if (eventShouldCreateRuntimeLog(event)) {
            recordLogEvent(activeRun, createRuntimeLogEvent(event));
        }
    }

    for (const listener of listeners) {
        listener(event);
    }
    sendToEndpoint(event);
}

function diagnosisFromStage(
    stage: PipelineStageName | undefined,
    metadata: Record<string, unknown> = {}
): ValidatorStallDiagnosis {
    if (!stage) return 'unknown';
    if (stage === 'template_readiness') return 'template_readiness';
    if (stage === 'image_load') return 'image_load';
    if (stage === 'cache_lookup') return 'cache';
    if (stage === 'count_ocr') return 'count_ocr';
    if (stage === 'grid_verification' || stage === 'verification_filtering') return 'verification';
    if (stage === 'grid_detection' || stage === 'occupancy_filtering') return 'grid_search';
    if (stage === 'candidate_generation') {
        const workerBatchesPending = Number(metadata.workerBatchesPending || 0);
        if (workerBatchesPending > 0 || metadata.usedWorkers === true || metadata.mode === 'worker_grid') {
            return 'worker_batch_wait';
        }
        return 'grid_search';
    }
    return 'unknown';
}

function diagnosisMessage(
    diagnosis: ValidatorStallDiagnosis,
    stage: PipelineStageName | undefined,
    metadata: Record<string, unknown> = {}
): string {
    switch (diagnosis) {
        case 'template_readiness':
            return `loading templates (${metadata.templatesLoaded || 0}/${metadata.templatesTotal || '?'})`;
        case 'image_load':
            return 'loading screenshot into the canvas pipeline';
        case 'worker_batch_wait':
            return `waiting on worker batches (${metadata.workerBatchesPending || 0} pending)`;
        case 'grid_search':
            return `grid search still expanding in ${stage || 'pipeline stage'}`;
        case 'verification':
            return `verification backlog in ${stage || 'verification stage'}`;
        case 'count_ocr':
            return `OCR backlog (${metadata.ocrSlotsDone || 0}/${metadata.ocrSlotsTotal || '?'})`;
        case 'cache':
            return `cache lookup is still resolving for ${String(metadata.cacheKey || 'current image')}`;
        default:
            return `run appears stalled in ${stage || 'unknown stage'}`;
    }
}

function updateCurrentStage(run: ActiveRunState): void {
    run.currentStage = run.activeStages[run.activeStages.length - 1];
}

function clearTimers(run: ActiveRunState): void {
    if (run.heartbeatTimer) {
        clearInterval(run.heartbeatTimer);
        run.heartbeatTimer = undefined;
    }
    if (run.watchdogTimer) {
        clearInterval(run.watchdogTimer);
        run.watchdogTimer = undefined;
    }
}

function maybeEmitStall(run: ActiveRunState, reason: 'no_progress' | 'threshold'): void {
    const stage = run.currentStage;
    if (!stage) return;

    const progress = run.stageProgress[stage];
    const metadata = progress?.metadata || {};
    const diagnosis = diagnosisFromStage(stage, metadata);
    const stageStartedAtMs = run.stageStartedAtMs[stage] || run.startedAtMs;
    const thresholdMs =
        reason === 'no_progress' ? NO_PROGRESS_STALL_MS : STAGE_WARNING_THRESHOLDS_MS[stage] || NO_PROGRESS_STALL_MS;
    const stalledForMs =
        reason === 'no_progress'
            ? Math.max(0, Math.round(nowMs() - run.lastProgressEventAtMs))
            : Math.max(0, Math.round(nowMs() - stageStartedAtMs));
    const stallKey = `${stage}:${diagnosis}:${reason}`;
    if (run.lastStallKey === stallKey) {
        return;
    }

    run.lastStallKey = stallKey;
    run.stalled = true;
    run.status = 'stalled';
    run.currentDiagnosis = {
        diagnosis,
        message: diagnosisMessage(diagnosis, stage, metadata),
        stage,
        detectedAt: nowIso(),
        stalledForMs,
        thresholdMs,
    };

    emit({
        timestamp: nowIso(),
        runId: run.runId,
        type: 'run_stalled',
        level: 'warn',
        stage,
        message: run.currentDiagnosis.message,
        metadata: {
            diagnosis,
            stalledForMs,
            thresholdMs,
            reason,
            ...metadata,
        },
    });
}

function resetStallState(run: ActiveRunState): void {
    if (!run.stalled && !run.currentDiagnosis) {
        return;
    }
    run.stalled = false;
    run.status = 'running';
    run.currentDiagnosis = null;
    run.lastStallKey = undefined;
}

function heartbeat(run: ActiveRunState): void {
    if (!run.currentStage) return;
    const stage = run.currentStage;
    const progress = run.stageProgress[stage];
    if (!progress) return;

    const elapsedMs = Math.max(0, Math.round(nowMs() - (run.stageStartedAtMs[stage] || nowMs())));
    progress.updatedAt = nowIso();
    progress.elapsedMs = elapsedMs;

    emit({
        timestamp: progress.updatedAt,
        runId: run.runId,
        type: 'stage_progress',
        level: 'info',
        stage,
        message: `${stage} heartbeat`,
        metadata: {
            ...progress.metadata,
            elapsedMs,
            warningCount: progress.warningCount,
        },
    });
}

function startTimers(run: ActiveRunState): void {
    clearTimers(run);
    run.heartbeatTimer = setInterval(() => heartbeat(run), HEARTBEAT_INTERVAL_MS);
    run.watchdogTimer = setInterval(() => {
        if (!run.currentStage) return;

        const stage = run.currentStage;
        const thresholdMs = STAGE_WARNING_THRESHOLDS_MS[stage];
        if (nowMs() - run.lastProgressEventAtMs >= NO_PROGRESS_STALL_MS) {
            maybeEmitStall(run, 'no_progress');
            return;
        }
        if (thresholdMs && nowMs() - (run.stageStartedAtMs[stage] || run.startedAtMs) >= thresholdMs) {
            maybeEmitStall(run, 'threshold');
        }
    }, HEARTBEAT_INTERVAL_MS);
}

function archiveRun(run: ActiveRunState): void {
    archivedRuns.set(run.runId, {
        progressSummary: cloneProgressSummary(run),
        logEvents: run.logEvents.map(logEvent => ({
            ...logEvent,
            metadata: { ...(logEvent.metadata || {}) },
        })),
    });
}

function subscribeToLogger(run: ActiveRunState): void {
    const listener: LoggerListener = (level, event) => {
        const timestamp = new Date(event.timestamp).toISOString();
        const logEvent: ValidatorLogEvent = {
            id: `${run.runId}:${timestamp}:${event.operation}:${Math.random().toString(36).slice(2, 8)}`,
            timestamp,
            runId: run.runId,
            level: mapLogLevel(level),
            source: event.operation.startsWith('cv.') ? 'cv' : 'runtime',
            message: event.error?.message || event.operation,
            operation: event.operation,
            stage: typeof event.data?.stage === 'string' ? (event.data.stage as PipelineStageName) : run.currentStage,
            metadata: {
                success: event.success,
                durationMs: event.durationMs,
                ...(event.data || {}),
            },
        };
        recordLogEvent(run, logEvent);
        emit({
            timestamp,
            runId: run.runId,
            type: 'logger_event',
            level: logEvent.level,
            stage: logEvent.stage,
            message: logEvent.message,
            metadata: {
                source: logEvent.source,
                operation: event.operation,
                ...(event.data || {}),
            },
        });
    };

    if (typeof logger.subscribe === 'function') {
        run.unsubscribeLogger = logger.subscribe(listener);
    }
}

export function configureValidatorEvents(options: { eventEndpoint?: string | null } = {}): void {
    eventEndpoint =
        options.eventEndpoint === undefined
            ? eventEndpoint
            : options.eventEndpoint === null
              ? null
              : options.eventEndpoint;
}

export function subscribeValidatorEvents(listener: ValidatorEventListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function emitValidatorRuntimeReady(status: ValidatorRuntimeStatus): void {
    emit({
        timestamp: nowIso(),
        runId: 'runtime',
        type: 'runtime_ready',
        level: status.initialized ? 'info' : 'error',
        message: status.initialized ? 'Validator runtime ready' : 'Validator runtime failed to initialize',
        metadata: {
            initialized: status.initialized,
            templateReadiness: status.templateReadiness,
            templateCount: status.templateCount,
            itemCount: status.itemCount,
            trainingDataLoaded: status.trainingDataLoaded,
            workerSupported: status.workerSupported,
            lastError: status.lastError || null,
        },
    });
}

export function beginValidatorRun(runId: string, imageName: string): void {
    if (activeRun) {
        activeRun.unsubscribeLogger?.();
        clearTimers(activeRun);
        archiveRun(activeRun);
    }

    const startedAtIso = nowIso();
    activeRun = {
        runId,
        imageName,
        status: 'running',
        startedAtIso,
        startedAtMs: nowMs(),
        updatedAtIso: startedAtIso,
        updatedAtMs: nowMs(),
        currentStage: undefined,
        activeStages: [],
        stageStartedAtMs: {},
        stageProgress: {},
        warningsCount: 0,
        eventCount: 0,
        stalled: false,
        currentDiagnosis: null,
        slowestStage: null,
        lastProgressEventAtMs: nowMs(),
        logEvents: [],
    };

    subscribeToLogger(activeRun);
    startTimers(activeRun);
    emit({
        timestamp: startedAtIso,
        runId,
        type: 'run_started',
        level: 'info',
        message: `Run started for ${imageName}`,
        metadata: {
            imageName,
        },
    });
}

export function startValidatorEventStage(
    stage: PipelineStageName,
    metadata: Record<string, unknown> = {},
    message?: string
): void {
    if (!activeRun) return;

    resetStallState(activeRun);
    const timestamp = nowIso();
    activeRun.stageStartedAtMs[stage] = nowMs();
    if (!activeRun.activeStages.includes(stage)) {
        activeRun.activeStages.push(stage);
    }
    activeRun.stageProgress[stage] = {
        stage,
        startedAt: timestamp,
        updatedAt: timestamp,
        elapsedMs: 0,
        warningCount: activeRun.stageProgress[stage]?.warningCount || 0,
        metadata: { ...metadata },
    };
    activeRun.lastProgressEventAtMs = nowMs();
    updateCurrentStage(activeRun);

    emit({
        timestamp,
        runId: activeRun.runId,
        type: 'stage_started',
        level: 'info',
        stage,
        message: message || `Started ${stage}`,
        metadata: { ...metadata },
    });
}

export function updateValidatorEventStageProgress(
    stage: PipelineStageName,
    metadata: Record<string, unknown> = {},
    message?: string
): void {
    if (!activeRun) return;

    const stageProgress = activeRun.stageProgress[stage];
    if (!stageProgress) {
        startValidatorEventStage(stage, metadata, message);
        return;
    }

    resetStallState(activeRun);
    stageProgress.metadata = {
        ...stageProgress.metadata,
        ...metadata,
    };
    stageProgress.updatedAt = nowIso();
    stageProgress.elapsedMs = Math.max(0, Math.round(nowMs() - (activeRun.stageStartedAtMs[stage] || nowMs())));
    activeRun.lastProgressEventAtMs = nowMs();
    updateCurrentStage(activeRun);

    emit({
        timestamp: stageProgress.updatedAt,
        runId: activeRun.runId,
        type: 'stage_progress',
        level: 'info',
        stage,
        message: message || `${stage} progress`,
        metadata: {
            ...stageProgress.metadata,
            elapsedMs: stageProgress.elapsedMs,
            warningCount: stageProgress.warningCount,
        },
    });
}

export function addValidatorEventStageWarning(
    stage: PipelineStageName,
    warning: string,
    metadata: Record<string, unknown> = {}
): void {
    if (!activeRun) return;
    const stageProgress = activeRun.stageProgress[stage];
    if (!stageProgress) {
        startValidatorEventStage(stage, metadata);
    }

    const progress = activeRun.stageProgress[stage];
    if (!progress) return;
    progress.warningCount += 1;
    progress.metadata = {
        ...progress.metadata,
        ...metadata,
    };
    progress.updatedAt = nowIso();
    progress.elapsedMs = Math.max(0, Math.round(nowMs() - (activeRun.stageStartedAtMs[stage] || nowMs())));

    emit({
        timestamp: progress.updatedAt,
        runId: activeRun.runId,
        type: 'stage_warning',
        level: 'warn',
        stage,
        message: warning,
        metadata: {
            ...progress.metadata,
            warningCount: progress.warningCount,
        },
    });
}

export function completeValidatorEventStage(
    stage: PipelineStageName,
    metadata: Record<string, unknown> = {},
    message?: string
): void {
    if (!activeRun) return;

    const progress = activeRun.stageProgress[stage];
    const elapsedMs = Math.max(0, Math.round(nowMs() - (activeRun.stageStartedAtMs[stage] || nowMs())));
    const updatedAt = nowIso();
    if (progress) {
        progress.updatedAt = updatedAt;
        progress.elapsedMs = elapsedMs;
        progress.metadata = {
            ...progress.metadata,
            ...metadata,
        };
    }

    activeRun.activeStages = activeRun.activeStages.filter(activeStage => activeStage !== stage);
    updateCurrentStage(activeRun);
    activeRun.lastProgressEventAtMs = nowMs();

    if (!activeRun.slowestStage || elapsedMs > activeRun.slowestStage.durationMs) {
        activeRun.slowestStage = {
            name: stage,
            durationMs: elapsedMs,
        };
    }

    emit({
        timestamp: updatedAt,
        runId: activeRun.runId,
        type: 'stage_completed',
        level: 'info',
        stage,
        message: message || `Completed ${stage}`,
        metadata: {
            ...(progress?.metadata || {}),
            ...metadata,
            elapsedMs,
        },
    });
}

export function completeValidatorRun(message: string = 'Run completed'): void {
    if (!activeRun) return;

    activeRun.status = 'completed';
    activeRun.completedAtIso = nowIso();
    activeRun.updatedAtIso = activeRun.completedAtIso;
    clearTimers(activeRun);
    activeRun.unsubscribeLogger?.();

    emit({
        timestamp: activeRun.completedAtIso,
        runId: activeRun.runId,
        type: 'run_completed',
        level: 'info',
        message,
        metadata: {
            imageName: activeRun.imageName,
            warnings: activeRun.warningsCount,
            slowestStage: activeRun.slowestStage?.name || null,
        },
    });

    archiveRun(activeRun);
    activeRun = null;
}

export function failValidatorRun(error: Error): void {
    if (!activeRun) return;

    activeRun.status = 'failed';
    activeRun.completedAtIso = nowIso();
    activeRun.updatedAtIso = activeRun.completedAtIso;
    clearTimers(activeRun);
    activeRun.unsubscribeLogger?.();

    emit({
        timestamp: activeRun.completedAtIso,
        runId: activeRun.runId,
        type: 'run_failed',
        level: 'error',
        stage: activeRun.currentStage,
        message: error.message,
        metadata: {
            imageName: activeRun.imageName,
            stage: activeRun.currentStage,
        },
    });

    archiveRun(activeRun);
    activeRun = null;
}

export function getValidatorRunArtifacts(
    runId: string
): { progressSummary: ValidatorRunProgress; logEvents: ValidatorLogEvent[] } | null {
    if (activeRun && activeRun.runId === runId) {
        return {
            progressSummary: cloneProgressSummary(activeRun),
            logEvents: activeRun.logEvents.map(logEvent => ({
                ...logEvent,
                metadata: { ...(logEvent.metadata || {}) },
            })),
        };
    }
    const archived = archivedRuns.get(runId);
    if (!archived) {
        return null;
    }
    return {
        progressSummary: {
            ...archived.progressSummary,
            stageProgress: cloneStageProgress(archived.progressSummary.stageProgress),
            currentDiagnosis: archived.progressSummary.currentDiagnosis
                ? { ...archived.progressSummary.currentDiagnosis }
                : null,
            slowestStage: archived.progressSummary.slowestStage ? { ...archived.progressSummary.slowestStage } : null,
        },
        logEvents: archived.logEvents.map(logEvent => ({
            ...logEvent,
            metadata: { ...(logEvent.metadata || {}) },
        })),
    };
}

export function clearValidatorRunArtifacts(runId: string): void {
    archivedRuns.delete(runId);
    if (activeRun?.runId === runId) {
        activeRun.unsubscribeLogger?.();
        clearTimers(activeRun);
        activeRun = null;
    }
}
