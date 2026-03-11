import type { ScanPreflightReport } from '../scan-build-preflight.ts';
import type { CVDetectionResult } from './types.ts';

export type FailureKind =
    | 'grid'
    | 'empty_filter'
    | 'candidate_ranking'
    | 'verification'
    | 'count_ocr'
    | 'cache'
    | 'template_readiness'
    | 'worker'
    | 'unknown';

export type PipelineStageName =
    | 'preflight'
    | 'template_readiness'
    | 'cache_lookup'
    | 'image_load'
    | 'grid_detection'
    | 'occupancy_filtering'
    | 'candidate_generation'
    | 'grid_verification'
    | 'verification_filtering'
    | 'count_ocr'
    | 'dedupe_finalization';

export interface CandidateTrace {
    itemId: string;
    itemName: string;
    confidence: number;
    reason:
        | 'selected'
        | 'lower_ranked'
        | 'below_threshold'
        | 'filtered_by_grid'
        | 'filtered_by_rarity'
        | 'worker_top_match'
        | 'fallback_candidate';
}

export interface SlotTrace {
    slotId: string;
    label?: string;
    bounds: { x: number; y: number; width: number; height: number };
    status: 'pending' | 'empty' | 'matched' | 'filtered' | 'uncertain' | 'count_adjusted' | 'unmatched' | 'missed';
    emptyDecision?: {
        isEmpty: boolean;
        method: string;
        confidence?: number;
        reason?: string;
    };
    candidateCount: number;
    topCandidates: CandidateTrace[];
    rejectedCandidates: CandidateTrace[];
    finalDetection?: {
        itemId: string;
        itemName: string;
        confidence: number;
        method: string;
        stackCount?: number;
    };
    countEvidence?: {
        count: number;
        confidence: number;
        rawText?: string;
        method?: string;
    };
    groundTruth?: {
        status: 'match' | 'extra' | 'missing' | 'unknown';
        expectedItemName?: string;
    };
    notes: string[];
}

export interface PipelineStageTrace {
    name: PipelineStageName;
    startedAtMs: number;
    endedAtMs: number;
    durationMs: number;
    status: 'ok' | 'warning' | 'error';
    inputCount?: number;
    outputCount?: number;
    warnings: string[];
    metadata?: Record<string, unknown>;
}

export interface ValidatorRunTrace {
    metadata: {
        imageName: string;
        imageWidth?: number;
        imageHeight?: number;
        runtimeVersion: string;
        templateReadiness: 'cold' | 'priority' | 'full';
        templateCount: number;
        trainingDataLoaded: boolean;
        trainingDataVersion?: string | null;
        pipelineConfig: Record<string, unknown>;
        authoritativeMode: boolean;
        cacheKey?: string;
        cacheHit: boolean;
        detectionMode: 'main' | 'worker';
        requestedWorkerMode: boolean;
        requestedAt: string;
    };
    stages: PipelineStageTrace[];
    slots: SlotTrace[];
    warnings: string[];
    failureKind: FailureKind;
}

export interface ReviewAction {
    slotId: string;
    action: 'verified' | 'corrected' | 'empty' | 'flagged';
    itemId?: string;
    itemName?: string;
    notes?: string;
    createdAt: string;
}

export interface ValidatorRuntimeStatus {
    initialized: boolean;
    authoritativeMode: boolean;
    runtimeVersion: string;
    dataBasePath: string;
    trainingDataBasePath: string;
    templateReadiness: 'cold' | 'priority' | 'full';
    templateCount: number;
    itemCount: number;
    trainingDataLoaded: boolean;
    trainingDataVersion?: string | null;
    workerSupported: boolean;
    lastError?: string | null;
}

export interface ValidatorRunRequest {
    imageDataUrl: string;
    imageName: string;
    imagePath?: string;
    groundTruthItems?: string[];
    pipelineConfig?: {
        useWorkers?: boolean;
        disableCache?: boolean;
        requireFullTemplates?: boolean;
        threshold?: number;
        notes?: string;
    };
}

export interface ValidatorMetrics {
    f1: number;
    precision: number;
    recall: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    expectedCount: number;
    detectedCount: number;
    dominantFailureKind: FailureKind;
}

export interface ValidatorRunResult {
    runId: string;
    sourceImageDataUrl: string;
    imageName: string;
    imagePath?: string;
    createdAt: string;
    preflight: ScanPreflightReport;
    trace: ValidatorRunTrace;
    detections: CVDetectionResult[];
    reviewActions: ReviewAction[];
    metrics: ValidatorMetrics;
    reviewSummary: {
        safe: number;
        review: number;
        risky: number;
        unresolvedRisky: number;
        corrected: number;
        verified: number;
        emptied: number;
        flagged: number;
    };
    groundTruthItems: string[];
}

export interface ValidatorSessionBundle {
    version: 1;
    runId: string;
    sourceImageDataUrl: string;
    imageName: string;
    imagePath?: string;
    createdAt: string;
    runtime: ValidatorRuntimeStatus;
    pipelineConfig: Record<string, unknown>;
    preflight: ScanPreflightReport;
    trace: ValidatorRunTrace;
    detections: CVDetectionResult[];
    reviewActions: ReviewAction[];
    metrics: ValidatorMetrics;
    groundTruthItems: string[];
}
