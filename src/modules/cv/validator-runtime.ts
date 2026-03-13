import type { ItemsData } from '../../types/index.ts';
import { analyzeScanPreflight, type ScanPreflightReport } from '../scan-build-preflight.ts';
import {
    clearDetectionCache,
    detectItemsWithCV,
    getItemTemplates,
    initCV,
    isFullyLoaded,
    isTrainingDataLoaded,
    loadItemTemplates,
} from './index.ts';
import { getTemplateReadinessState } from './state.ts';
import { getTrainingDataVersion, loadTrainingData, setTrainingDataBasePath } from './training.ts';
import {
    beginValidatorTrace,
    clearValidatorTrace,
    getActiveValidatorTraceSnapshot,
    setValidatorFailureKind,
    endValidatorStage,
    startValidatorStage,
} from './validator-trace.ts';
import {
    beginValidatorRun,
    clearValidatorRunArtifacts,
    completeValidatorRun,
    configureValidatorEvents,
    emitValidatorRuntimeReady,
    failValidatorRun,
    getValidatorRunArtifacts,
    subscribeValidatorEvents,
} from './validator-events.ts';
import type {
    FailureKind,
    ValidatorLogEvent,
    ValidatorRunProgress,
    ReviewAction,
    ValidatorMetrics,
    ValidatorRunRequest,
    ValidatorRunResult,
    ValidatorRuntimeStatus,
    ValidatorSessionBundle,
    SlotTrace,
} from './validator-types.ts';

declare const __VALIDATOR_RUNTIME_VERSION__: string;

interface RuntimeOptions {
    dataBasePath?: string;
    trainingDataBasePath?: string;
    eventEndpoint?: string | null;
}

const DEFAULT_OPTIONS: Required<RuntimeOptions> = {
    dataBasePath: '/data',
    trainingDataBasePath: '/data/training-data/',
    eventEndpoint: '/__validator/events',
};

const runtimeState: {
    options: Required<RuntimeOptions>;
    status: ValidatorRuntimeStatus;
    itemsData: ItemsData | null;
    runs: Map<string, ValidatorRunResult>;
} = {
    options: DEFAULT_OPTIONS,
    status: {
        initialized: false,
        authoritativeMode: true,
        runtimeVersion: typeof __VALIDATOR_RUNTIME_VERSION__ === 'string' ? __VALIDATOR_RUNTIME_VERSION__ : 'dev',
        dataBasePath: DEFAULT_OPTIONS.dataBasePath,
        trainingDataBasePath: DEFAULT_OPTIONS.trainingDataBasePath,
        templateReadiness: 'cold',
        templateCount: 0,
        itemCount: 0,
        trainingDataLoaded: false,
        trainingDataVersion: null,
        workerSupported: typeof Worker !== 'undefined',
        lastError: null,
    },
    itemsData: null,
    runs: new Map(),
};

function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

function makeRunId(imageName: string): string {
    return `${Date.now()}-${imageName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
}

function getRuntimeVersion(): string {
    return typeof __VALIDATOR_RUNTIME_VERSION__ === 'string' ? __VALIDATOR_RUNTIME_VERSION__ : 'dev';
}

function resolveBaseUrl(path: string): URL {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    return new URL(normalizedPath, window.location.href);
}

function getAppBaseUrl(dataBasePath: string): URL {
    return new URL('../', resolveBaseUrl(dataBasePath));
}

function isFullyQualifiedAssetUrl(path: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:');
}

function normalizeItemImagePath(imagePath: string, dataBasePath: string): string {
    if (!imagePath || imagePath.startsWith('/')) {
        return imagePath;
    }
    if (isFullyQualifiedAssetUrl(imagePath)) {
        return imagePath;
    }

    return new URL(imagePath.replace(/^\.?\//, ''), getAppBaseUrl(dataBasePath)).toString();
}

function normalizeItemsData(itemsData: ItemsData, dataBasePath: string): ItemsData {
    return {
        ...itemsData,
        items: (itemsData.items || []).map(item => ({
            ...item,
            image: item.image ? normalizeItemImagePath(item.image, dataBasePath) : item.image,
        })),
    };
}

function updateStatus(patch: Partial<ValidatorRuntimeStatus>): ValidatorRuntimeStatus {
    runtimeState.status = {
        ...runtimeState.status,
        ...patch,
        runtimeVersion: getRuntimeVersion(),
        workerSupported: typeof Worker !== 'undefined',
    };
    return runtimeState.status;
}

function hydrateTraceSlots(
    trace: ValidatorRunResult['trace'],
    detections: ValidatorRunResult['detections']
): ValidatorRunResult['trace'] {
    if (trace.slots.length > 0) {
        return trace;
    }

    const slots: SlotTrace[] = detections
        .filter(detection => detection.position)
        .map(detection => ({
            slotId: `${detection.position!.x}:${detection.position!.y}:${detection.position!.width}:${detection.position!.height}`,
            label: undefined,
            bounds: {
                x: detection.position!.x,
                y: detection.position!.y,
                width: detection.position!.width,
                height: detection.position!.height,
            },
            status: 'matched',
            candidateCount: 1,
            topCandidates: [
                {
                    itemId: detection.entity.id,
                    itemName: detection.entity.name,
                    confidence: detection.confidence,
                    reason: 'selected',
                },
            ],
            rejectedCandidates: [],
            finalDetection: {
                itemId: detection.entity.id,
                itemName: detection.entity.name,
                confidence: detection.confidence,
                method: detection.method,
            },
            notes: trace.metadata.cacheHit ? ['trace_rehydrated_from_cache'] : [],
        }));

    return {
        ...trace,
        slots,
    };
}

function applyTraceThreshold(trace: ValidatorRunResult['trace'], threshold: number): ValidatorRunResult['trace'] {
    if (!threshold || threshold <= 0) {
        return trace;
    }

    return {
        ...trace,
        slots: trace.slots.map(slot => {
            if (!slot.finalDetection || slot.finalDetection.confidence >= threshold) {
                return slot;
            }

            return {
                ...slot,
                status: 'filtered',
                finalDetection: undefined,
                notes: Array.from(new Set([...slot.notes, `filtered_by_threshold_${threshold}`])),
            };
        }),
    };
}

function getEffectiveItemNames(
    trace: ValidatorRunResult['trace'],
    detections: ValidatorRunResult['detections'],
    reviewActions: ReviewAction[]
): string[] {
    const actionBySlot = new Map(reviewActions.map(action => [action.slotId, action] as const));
    const effectiveNames: string[] = [];
    const seenSlots = new Set<string>();

    for (const slot of trace.slots) {
        const slotId = slot.slotId;
        const action = actionBySlot.get(slotId);
        seenSlots.add(slotId);

        if (action?.action === 'empty') {
            continue;
        }
        if (action?.action === 'corrected' && action.itemName) {
            effectiveNames.push(action.itemName);
            continue;
        }
        if (slot.finalDetection?.itemName) {
            effectiveNames.push(slot.finalDetection.itemName);
        }
    }

    for (const action of reviewActions) {
        if (seenSlots.has(action.slotId)) continue;
        if (action.action === 'corrected' && action.itemName) {
            effectiveNames.push(action.itemName);
        }
    }

    if (effectiveNames.length === 0 && detections.length > 0) {
        return detections.map(detection => detection.entity.name);
    }

    return effectiveNames;
}

function countByName(names: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const name of names) {
        const key = normalizeName(name);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

function classifyFailureKind(
    preflight: ScanPreflightReport,
    trace: ValidatorRunResult['trace'],
    metrics: Omit<ValidatorMetrics, 'dominantFailureKind'>
): FailureKind {
    if (trace.metadata.cacheHit && metrics.f1 < 0.8) return 'cache';
    if (trace.metadata.templateReadiness !== 'full' && metrics.recall < 0.8) return 'template_readiness';
    if (
        trace.metadata.detectionMode === 'worker' &&
        trace.warnings.some(warning => warning.toLowerCase().includes('worker'))
    ) {
        return 'worker';
    }
    if ((preflight.gridConfidence || 0) < 0.2 || preflight.status === 'high_risk') return 'grid';

    const emptySlots = trace.slots.filter(slot => slot.status === 'empty' || slot.status === 'missed').length;
    const matchedSlots = trace.slots.filter(
        slot => slot.status === 'matched' || slot.status === 'count_adjusted'
    ).length;
    if (emptySlots > matchedSlots && metrics.recall < 0.65) return 'empty_filter';
    if (trace.slots.some(slot => slot.countEvidence && slot.countEvidence.count > 1) && metrics.f1 < 0.8)
        return 'count_ocr';
    if (metrics.precision < metrics.recall) return 'verification';
    if (metrics.recall < 0.85) return 'candidate_ranking';
    return 'unknown';
}

function calculateReviewSummary(trace: ValidatorRunResult['trace'], reviewActions: ReviewAction[]) {
    let safe = 0;
    let review = 0;
    let risky = 0;

    for (const slot of trace.slots) {
        const top = slot.topCandidates[0];
        const second = slot.topCandidates[1];
        const gap = top && second ? top.confidence - second.confidence : top ? top.confidence : 0;

        if (
            slot.status === 'filtered' ||
            slot.status === 'missed' ||
            (slot.finalDetection && slot.finalDetection.confidence < 0.55)
        ) {
            risky++;
        } else if (slot.finalDetection && slot.finalDetection.confidence >= 0.8 && gap >= 0.08) {
            safe++;
        } else {
            review++;
        }
    }

    const corrected = reviewActions.filter(action => action.action === 'corrected').length;
    const verified = reviewActions.filter(action => action.action === 'verified').length;
    const emptied = reviewActions.filter(action => action.action === 'empty').length;
    const flagged = reviewActions.filter(action => action.action === 'flagged').length;
    const reviewedSlotIds = new Set(reviewActions.map(action => action.slotId));
    const unresolvedRisky = trace.slots.filter(slot => {
        const isRisky =
            slot.status === 'filtered' ||
            slot.status === 'missed' ||
            (slot.finalDetection ? slot.finalDetection.confidence < 0.55 : true);
        return isRisky && !reviewedSlotIds.has(slot.slotId);
    }).length;

    return { safe, review, risky, unresolvedRisky, corrected, verified, emptied, flagged };
}

function calculateMetrics(
    detections: ValidatorRunResult['detections'],
    groundTruthItems: string[],
    reviewActions: ReviewAction[],
    preflight: ScanPreflightReport,
    trace: ValidatorRunResult['trace']
): ValidatorMetrics {
    const effectiveDetections = getEffectiveItemNames(trace, detections, reviewActions);
    const truthCounts = countByName(groundTruthItems);
    const detectedCounts = countByName(effectiveDetections);

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    const allKeys = new Set([...truthCounts.keys(), ...detectedCounts.keys()]);
    for (const key of allKeys) {
        const truth = truthCounts.get(key) || 0;
        const detected = detectedCounts.get(key) || 0;
        truePositives += Math.min(truth, detected);
        falsePositives += Math.max(0, detected - truth);
        falseNegatives += Math.max(0, truth - detected);
    }

    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const metricsWithoutFailureKind = {
        f1,
        precision,
        recall,
        truePositives,
        falsePositives,
        falseNegatives,
        expectedCount: groundTruthItems.length,
        detectedCount: effectiveDetections.length,
    };

    const dominantFailureKind = classifyFailureKind(preflight, trace, metricsWithoutFailureKind);
    setValidatorFailureKind(dominantFailureKind);

    return {
        ...metricsWithoutFailureKind,
        dominantFailureKind,
    };
}

function buildRuntimeStatusSnapshot(): ValidatorRuntimeStatus {
    return {
        ...runtimeState.status,
        runtimeVersion: getRuntimeVersion(),
        templateReadiness: getTemplateReadinessState(),
        templateCount: getItemTemplates().size,
        trainingDataLoaded: isTrainingDataLoaded(),
        trainingDataVersion: getTrainingDataVersion()?.version || null,
        workerSupported: typeof Worker !== 'undefined',
    };
}

function createEmptyMetrics(expectedCount: number): ValidatorMetrics {
    return {
        f1: 0,
        precision: 0,
        recall: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: expectedCount,
        expectedCount,
        detectedCount: 0,
        dominantFailureKind: 'unknown',
    };
}

function createEmptyProgressSummary(createdAt: string): ValidatorRunProgress {
    return {
        runStatus: 'running',
        startedAt: createdAt,
        updatedAt: createdAt,
        currentStage: undefined,
        totalElapsedMs: 0,
        stageElapsedMs: 0,
        activeWarningCount: 0,
        eventCount: 0,
        stalled: false,
        currentDiagnosis: null,
        slowestStage: null,
        stageProgress: {},
    };
}

function createFallbackPreflight(errorMessage: string): ScanPreflightReport {
    return {
        status: 'high_risk',
        imageWidth: 0,
        imageHeight: 0,
        gridConfidence: 0,
        warnings: [errorMessage],
        recommendations: ['Retry the run after resolving the runtime error.'],
        screenType: 'pause_menu',
        sharpnessScore: 0,
        aspectRatio: 0,
    };
}

function createRunRecord(
    runId: string,
    request: ValidatorRunRequest,
    preflight: ScanPreflightReport,
    trace: ValidatorRunResult['trace'],
    detections: ValidatorRunResult['detections'],
    metrics: ValidatorMetrics,
    status: ValidatorRunResult['status'],
    reviewActions: ReviewAction[] = []
): ValidatorRunResult {
    const artifacts = getValidatorRunArtifacts(runId);

    return {
        runId,
        status,
        sourceImageDataUrl: request.imageDataUrl,
        imageName: request.imageName,
        imagePath: request.imagePath,
        createdAt: trace.metadata.requestedAt,
        preflight,
        trace,
        detections,
        reviewActions,
        metrics,
        reviewSummary: calculateReviewSummary(trace, reviewActions),
        groundTruthItems: [...(request.groundTruthItems || [])],
        progressSummary: artifacts?.progressSummary || createEmptyProgressSummary(trace.metadata.requestedAt),
        logEvents: artifacts?.logEvents || ([] as ValidatorLogEvent[]),
    };
}

function ensureInitialized(): void {
    if (!runtimeState.status.initialized || !runtimeState.itemsData) {
        throw new Error('Validator runtime is not initialized');
    }
}

export async function initValidatorRuntime(options: RuntimeOptions = {}): Promise<ValidatorRuntimeStatus> {
    const mergedOptions: Required<RuntimeOptions> = {
        ...DEFAULT_OPTIONS,
        ...options,
        eventEndpoint: options.eventEndpoint === undefined ? DEFAULT_OPTIONS.eventEndpoint : options.eventEndpoint,
        trainingDataBasePath:
            options.trainingDataBasePath || options.dataBasePath
                ? `${options.trainingDataBasePath || `${options.dataBasePath}/training-data`}`.replace(/\/?$/, '/')
                : DEFAULT_OPTIONS.trainingDataBasePath,
    };

    runtimeState.options = mergedOptions;
    configureValidatorEvents({
        eventEndpoint: mergedOptions.eventEndpoint,
    });
    updateStatus({
        initialized: false,
        lastError: null,
        dataBasePath: mergedOptions.dataBasePath,
        trainingDataBasePath: mergedOptions.trainingDataBasePath,
    });

    try {
        const itemsData = normalizeItemsData(
            await fetchJson<ItemsData>(`${mergedOptions.dataBasePath}/items.json`),
            mergedOptions.dataBasePath
        );
        runtimeState.itemsData = itemsData;

        initCV({
            items: itemsData,
        });

        setTrainingDataBasePath(mergedOptions.trainingDataBasePath);
        try {
            await loadTrainingData();
        } catch {
            // Training data is additive. Runtime stays authoritative without it.
        }

        await loadItemTemplates();

        if (getItemTemplates().size === 0 || !isFullyLoaded()) {
            throw new Error('Template load did not complete successfully');
        }

        updateStatus({
            initialized: true,
            itemCount: itemsData.items.length,
            templateCount: getItemTemplates().size,
            templateReadiness: getTemplateReadinessState(),
            trainingDataLoaded: isTrainingDataLoaded(),
            trainingDataVersion: getTrainingDataVersion()?.version || null,
            lastError: null,
        });

        const snapshot = buildRuntimeStatusSnapshot();
        emitValidatorRuntimeReady(snapshot);
        return snapshot;
    } catch (error) {
        updateStatus({
            initialized: false,
            lastError: (error as Error).message,
            templateReadiness: getTemplateReadinessState(),
            templateCount: getItemTemplates().size,
            trainingDataLoaded: isTrainingDataLoaded(),
            trainingDataVersion: getTrainingDataVersion()?.version || null,
        });
        emitValidatorRuntimeReady(buildRuntimeStatusSnapshot());
        throw error;
    }
}

export function getRuntimeStatus(): ValidatorRuntimeStatus {
    return buildRuntimeStatusSnapshot();
}

export async function runPreflight(imageDataUrl: string): Promise<ScanPreflightReport> {
    ensureInitialized();
    return analyzeScanPreflight(imageDataUrl);
}

export async function runDetectionWithTrace(request: ValidatorRunRequest): Promise<ValidatorRunResult> {
    ensureInitialized();

    const pipelineConfig = {
        useWorkers: false,
        disableCache: false,
        requireFullTemplates: true,
        threshold: 0,
        ...request.pipelineConfig,
    };

    const runId = makeRunId(request.imageName);
    const requestedAt = new Date().toISOString();
    let preflight: ScanPreflightReport = createFallbackPreflight('Preflight did not complete successfully');

    beginValidatorRun(runId, request.imageName);
    beginValidatorTrace({
        imageName: request.imageName,
        runtimeVersion: getRuntimeVersion(),
        templateReadiness: getTemplateReadinessState(),
        templateCount: getItemTemplates().size,
        trainingDataLoaded: isTrainingDataLoaded(),
        trainingDataVersion: getTrainingDataVersion()?.version || null,
        pipelineConfig,
        authoritativeMode: true,
        cacheHit: false,
        detectionMode: pipelineConfig.useWorkers ? 'worker' : 'main',
        requestedWorkerMode: Boolean(pipelineConfig.useWorkers),
        requestedAt,
    });

    const initialTrace = getActiveValidatorTraceSnapshot() || {
        metadata: {
            imageName: request.imageName,
            runtimeVersion: getRuntimeVersion(),
            templateReadiness: getTemplateReadinessState(),
            templateCount: getItemTemplates().size,
            trainingDataLoaded: isTrainingDataLoaded(),
            trainingDataVersion: getTrainingDataVersion()?.version || null,
            pipelineConfig,
            authoritativeMode: true,
            cacheHit: false,
            detectionMode: pipelineConfig.useWorkers ? 'worker' : 'main',
            requestedWorkerMode: Boolean(pipelineConfig.useWorkers),
            requestedAt,
        },
        stages: [],
        slots: [],
        warnings: [],
        failureKind: 'unknown' as FailureKind,
    };

    runtimeState.runs.set(
        runId,
        createRunRecord(
            runId,
            request,
            preflight,
            initialTrace,
            [],
            createEmptyMetrics((request.groundTruthItems || []).length),
            'running'
        )
    );

    try {
        if (pipelineConfig.disableCache) {
            clearDetectionCache();
        }

        if (pipelineConfig.requireFullTemplates) {
            await loadItemTemplates();
            if (!isFullyLoaded()) {
                throw new Error('Validator runtime requires the full template set before running detection');
            }
        }

        startValidatorStage('preflight', {
            metadata: {
                imageName: request.imageName,
            },
        });
        const preflightStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        preflight = await runPreflight(request.imageDataUrl);
        const preflightEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        endValidatorStage('preflight', {
            status: preflight.status === 'high_risk' ? 'warning' : 'ok',
            metadata: {
                status: preflight.status,
                warnings: preflight.warnings,
                recommendations: preflight.recommendations,
                imageWidth: preflight.imageWidth,
                imageHeight: preflight.imageHeight,
                gridConfidence: preflight.gridConfidence,
                screenType: preflight.screenType,
                durationMs: preflightEnd - preflightStart,
            },
        });

        runtimeState.runs.set(
            runId,
            createRunRecord(
                runId,
                request,
                preflight,
                getActiveValidatorTraceSnapshot() || initialTrace,
                [],
                createEmptyMetrics((request.groundTruthItems || []).length),
                'running'
            )
        );

        const rawDetections = await detectItemsWithCV(
            request.imageDataUrl,
            undefined,
            Boolean(pipelineConfig.useWorkers)
        );
        const detections =
            pipelineConfig.threshold && pipelineConfig.threshold > 0
                ? rawDetections.filter(detection => detection.confidence >= pipelineConfig.threshold)
                : rawDetections;
        const trace = getActiveValidatorTraceSnapshot();
        if (!trace) {
            throw new Error('Detection finished without an active validator trace');
        }
        const hydratedTrace = applyTraceThreshold(hydrateTraceSlots(trace, detections), pipelineConfig.threshold);
        const finalizedTrace = {
            ...hydratedTrace,
        };

        const metrics = calculateMetrics(detections, request.groundTruthItems || [], [], preflight, finalizedTrace);
        finalizedTrace.failureKind = metrics.dominantFailureKind;

        completeValidatorRun(`Run completed for ${request.imageName}`);

        const run = createRunRecord(runId, request, preflight, finalizedTrace, detections, metrics, 'completed');
        runtimeState.runs.set(runId, run);
        return run;
    } catch (error) {
        const validatorError = error as Error;
        const partialTrace = getActiveValidatorTraceSnapshot() || initialTrace;
        failValidatorRun(validatorError);

        const partialRun = createRunRecord(
            runId,
            request,
            preflight,
            partialTrace,
            [],
            createEmptyMetrics((request.groundTruthItems || []).length),
            'failed'
        );
        runtimeState.runs.set(runId, partialRun);
        throw validatorError;
    } finally {
        clearValidatorTrace();
    }
}

export function applyReviewActions(runId: string, actions: ReviewAction[]): ValidatorRunResult {
    const existingRun = runtimeState.runs.get(runId);
    if (!existingRun) {
        throw new Error(`Unknown validator run: ${runId}`);
    }

    const mergedActions = new Map(existingRun.reviewActions.map(action => [action.slotId, action] as const));
    for (const action of actions) {
        mergedActions.set(action.slotId, action);
    }

    const nextReviewActions = Array.from(mergedActions.values()).sort((a, b) => a.slotId.localeCompare(b.slotId));
    const metrics = calculateMetrics(
        existingRun.detections,
        existingRun.groundTruthItems,
        nextReviewActions,
        existingRun.preflight,
        existingRun.trace
    );

    const updatedRun: ValidatorRunResult = {
        ...existingRun,
        reviewActions: nextReviewActions,
        metrics,
        trace: {
            ...existingRun.trace,
            failureKind: metrics.dominantFailureKind,
        },
        reviewSummary: calculateReviewSummary(existingRun.trace, nextReviewActions),
    };

    runtimeState.runs.set(runId, updatedRun);
    return updatedRun;
}

export function exportSessionBundle(runId: string): ValidatorSessionBundle {
    const run = runtimeState.runs.get(runId);
    if (!run) {
        throw new Error(`Unknown validator run: ${runId}`);
    }

    const artifacts = getValidatorRunArtifacts(runId);
    const activeTrace = getActiveValidatorTraceSnapshot();
    const trace = run.status === 'running' || run.status === 'stalled' ? activeTrace || run.trace : run.trace;

    return {
        version: 2,
        runId: run.runId,
        status: artifacts?.progressSummary?.runStatus || run.status,
        sourceImageDataUrl: run.sourceImageDataUrl,
        imageName: run.imageName,
        imagePath: run.imagePath,
        createdAt: run.createdAt,
        runtime: buildRuntimeStatusSnapshot(),
        pipelineConfig: { ...run.trace.metadata.pipelineConfig },
        preflight: run.preflight,
        trace,
        detections: run.detections,
        reviewActions: run.reviewActions,
        metrics: run.metrics,
        groundTruthItems: run.groundTruthItems,
        progressSummary: artifacts?.progressSummary || run.progressSummary,
        logEvents: artifacts?.logEvents || run.logEvents,
    };
}

export function importSessionBundle(bundle: ValidatorSessionBundle): ValidatorRunResult {
    if (!bundle || (bundle.version !== 1 && bundle.version !== 2)) {
        throw new Error('Unsupported validator session bundle');
    }

    const run: ValidatorRunResult = {
        runId: bundle.runId,
        status: bundle.status || 'replay',
        sourceImageDataUrl: bundle.sourceImageDataUrl,
        imageName: bundle.imageName,
        imagePath: bundle.imagePath,
        createdAt: bundle.createdAt,
        preflight: bundle.preflight,
        trace: bundle.trace,
        detections: bundle.detections,
        reviewActions: bundle.reviewActions,
        metrics: bundle.metrics,
        reviewSummary: calculateReviewSummary(bundle.trace, bundle.reviewActions),
        groundTruthItems: bundle.groundTruthItems,
        progressSummary: bundle.progressSummary || createEmptyProgressSummary(bundle.createdAt),
        logEvents: bundle.logEvents || [],
    };

    runtimeState.runs.set(run.runId, run);
    return run;
}

export { subscribeValidatorEvents };

export function discardValidatorRun(runId: string): void {
    runtimeState.runs.delete(runId);
    clearValidatorRunArtifacts(runId);
}
