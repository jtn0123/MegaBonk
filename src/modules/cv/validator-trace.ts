import type {
    CandidateTrace,
    FailureKind,
    PipelineStageName,
    PipelineStageTrace,
    SlotTrace,
    ValidatorRunTrace,
} from './validator-types.ts';
import {
    addValidatorEventStageWarning,
    completeValidatorEventStage,
    startValidatorEventStage,
    updateValidatorEventStageProgress,
} from './validator-events.ts';

interface MutableTrace extends ValidatorRunTrace {
    stageIndex: Map<PipelineStageName, number>;
    slotIndex: Map<string, number>;
}

let activeTrace: MutableTrace | null = null;

function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function cloneStage(stage: PipelineStageTrace): PipelineStageTrace {
    return {
        ...stage,
        warnings: [...stage.warnings],
        metadata: stage.metadata ? { ...stage.metadata } : undefined,
    };
}

function cloneSlot(slot: SlotTrace): SlotTrace {
    return {
        ...slot,
        bounds: { ...slot.bounds },
        emptyDecision: slot.emptyDecision ? { ...slot.emptyDecision } : undefined,
        topCandidates: slot.topCandidates.map(candidate => ({ ...candidate })),
        rejectedCandidates: slot.rejectedCandidates.map(candidate => ({ ...candidate })),
        finalDetection: slot.finalDetection ? { ...slot.finalDetection } : undefined,
        countEvidence: slot.countEvidence ? { ...slot.countEvidence } : undefined,
        groundTruth: slot.groundTruth ? { ...slot.groundTruth } : undefined,
        notes: [...slot.notes],
    };
}

function getTrace(): MutableTrace | null {
    return activeTrace;
}

function ensureStage(name: PipelineStageName): PipelineStageTrace | null {
    const trace = getTrace();
    if (!trace) return null;

    const existingIndex = trace.stageIndex.get(name);
    if (existingIndex !== undefined) {
        const existingStage = trace.stages[existingIndex];
        return existingStage || null;
    }

    const created: PipelineStageTrace = {
        name,
        startedAtMs: now(),
        endedAtMs: now(),
        durationMs: 0,
        status: 'ok',
        warnings: [],
    };
    trace.stageIndex.set(name, trace.stages.length);
    trace.stages.push(created);
    return created;
}

function ensureSlot(slotId: string, bounds?: SlotTrace['bounds'], label?: string): SlotTrace | null {
    const trace = getTrace();
    if (!trace) return null;

    const existingIndex = trace.slotIndex.get(slotId);
    if (existingIndex !== undefined) {
        const existingSlot = trace.slots[existingIndex];
        if (existingSlot && label && !existingSlot.label) {
            existingSlot.label = label;
        }
        if (existingSlot && bounds) {
            existingSlot.bounds = { ...bounds };
        }
        return existingSlot || null;
    }

    if (!bounds) return null;

    const created: SlotTrace = {
        slotId,
        label,
        bounds: { ...bounds },
        status: 'pending',
        candidateCount: 0,
        topCandidates: [],
        rejectedCandidates: [],
        notes: [],
    };
    trace.slotIndex.set(slotId, trace.slots.length);
    trace.slots.push(created);
    return created;
}

export function beginValidatorTrace(metadata: ValidatorRunTrace['metadata']): void {
    activeTrace = {
        metadata: { ...metadata },
        stages: [],
        slots: [],
        warnings: [],
        failureKind: 'unknown',
        stageIndex: new Map(),
        slotIndex: new Map(),
    };
}

export function clearValidatorTrace(): void {
    activeTrace = null;
}

export function updateValidatorTraceMetadata(patch: Partial<ValidatorRunTrace['metadata']>): void {
    const trace = getTrace();
    if (!trace) return;
    trace.metadata = { ...trace.metadata, ...patch };
}

export function startValidatorStage(name: PipelineStageName, patch: Partial<PipelineStageTrace> = {}): void {
    const stage = ensureStage(name);
    if (!stage) return;
    stage.startedAtMs = now();
    stage.endedAtMs = stage.startedAtMs;
    stage.durationMs = 0;
    Object.assign(stage, patch);
    startValidatorEventStage(name, {
        ...(patch.metadata || {}),
        inputCount: patch.inputCount,
        outputCount: patch.outputCount,
        status: patch.status || 'ok',
    });
}

export function endValidatorStage(name: PipelineStageName, patch: Partial<PipelineStageTrace> = {}): void {
    const stage = ensureStage(name);
    if (!stage) return;
    stage.endedAtMs = now();
    stage.durationMs = Math.max(0, stage.endedAtMs - stage.startedAtMs);
    stage.status = patch.status || stage.status || 'ok';
    if (patch.warnings) {
        stage.warnings = [...stage.warnings, ...patch.warnings];
    }
    if (patch.metadata) {
        stage.metadata = {
            ...(stage.metadata || {}),
            ...patch.metadata,
        };
    }
    Object.assign(stage, {
        inputCount: patch.inputCount ?? stage.inputCount,
        outputCount: patch.outputCount ?? stage.outputCount,
    });
    completeValidatorEventStage(name, {
        ...(stage.metadata || {}),
        inputCount: stage.inputCount,
        outputCount: stage.outputCount,
        status: stage.status,
        warnings: [...stage.warnings],
    });
}

export function addValidatorStageWarning(name: PipelineStageName, warning: string): void {
    const stage = ensureStage(name);
    const trace = getTrace();
    if (!stage || !trace) return;
    stage.status = 'warning';
    stage.warnings.push(warning);
    trace.warnings.push(warning);
    addValidatorEventStageWarning(name, warning, {
        ...(stage.metadata || {}),
        warnings: [...stage.warnings],
    });
}

export function updateValidatorStageProgress(
    name: PipelineStageName,
    patch: Partial<PipelineStageTrace> = {},
    message?: string
): void {
    const stage = ensureStage(name);
    const trace = getTrace();
    if (!stage) return;
    if (patch.warnings) {
        stage.warnings = [...stage.warnings, ...patch.warnings];
        if (trace) {
            trace.warnings.push(...patch.warnings);
        }
    }
    if (patch.metadata) {
        stage.metadata = {
            ...(stage.metadata || {}),
            ...patch.metadata,
        };
    }
    stage.inputCount = patch.inputCount ?? stage.inputCount;
    stage.outputCount = patch.outputCount ?? stage.outputCount;
    stage.status = patch.status || stage.status;

    updateValidatorEventStageProgress(
        name,
        {
            ...(stage.metadata || {}),
            inputCount: stage.inputCount,
            outputCount: stage.outputCount,
            status: stage.status,
            warnings: [...stage.warnings],
        },
        message
    );
}

export function upsertSlotTrace(
    slotId: string,
    patch: Partial<SlotTrace> & { bounds?: SlotTrace['bounds']; label?: string }
): void {
    const slot = ensureSlot(slotId, patch.bounds, patch.label);
    if (!slot) return;

    if (patch.status) slot.status = patch.status;
    if (patch.emptyDecision) slot.emptyDecision = { ...patch.emptyDecision };
    if (patch.candidateCount !== undefined) slot.candidateCount = patch.candidateCount;
    if (patch.finalDetection) slot.finalDetection = { ...patch.finalDetection };
    if (patch.countEvidence) slot.countEvidence = { ...patch.countEvidence };
    if (patch.groundTruth) slot.groundTruth = { ...patch.groundTruth };
    if (patch.notes) {
        slot.notes = Array.from(new Set([...slot.notes, ...patch.notes]));
    }
}

export function addSlotCandidate(
    slotId: string,
    candidate: CandidateTrace,
    rejected: boolean = false,
    bounds?: SlotTrace['bounds'],
    label?: string
): void {
    const slot = ensureSlot(slotId, bounds, label);
    if (!slot) return;
    if (rejected) {
        slot.rejectedCandidates.push({ ...candidate });
    } else {
        slot.topCandidates.push({ ...candidate });
    }
}

export function setValidatorFailureKind(kind: FailureKind): void {
    const trace = getTrace();
    if (!trace) return;
    trace.failureKind = kind;
}

export function getActiveValidatorTraceSnapshot(): ValidatorRunTrace | null {
    const trace = getTrace();
    if (!trace) return null;
    return {
        metadata: { ...trace.metadata },
        stages: trace.stages.map(cloneStage),
        slots: trace.slots.map(cloneSlot),
        warnings: [...trace.warnings],
        failureKind: trace.failureKind,
    };
}
