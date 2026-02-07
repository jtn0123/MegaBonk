// ========================================
// Detection Pipeline - Barrel File
// ========================================
// Re-exports all detection pipeline functionality for backwards compatibility.
// The pipeline has been split into focused modules:
//   - types.ts              - Local types and interfaces
//   - two-phase.ts          - Two-phase grid detection (fast path)
//   - sliding-window.ts     - Sliding window detection (fallback)
//   - worker-detection.ts   - Web Worker-based parallel detection
//   - ensemble-detection.ts - Ensemble multi-strategy detection
//   - ocr-count.ts          - OCR-based item count detection
//   - metrics-exports.ts    - Metrics and config exports
//   - orchestrator.ts       - Main detection orchestration

// ========================================
// Types
// ========================================
export type {
    WorkerMatchResult,
    TwoPhaseOptions,
    SlidingWindowOptions,
    TwoPhaseResult,
    ProgressCallback,
} from './types.ts';

// ========================================
// Two-Phase Detection
// ========================================
export { detectIconsWithTwoPhase } from './two-phase.ts';

// ========================================
// Sliding Window Detection
// ========================================
export { detectIconsWithSlidingWindow, detectEquipmentRegion } from './sliding-window.ts';

// ========================================
// Worker Detection
// ========================================
export { detectItemsWithWorkers } from './worker-detection.ts';

// ========================================
// Ensemble Detection
// ========================================
export { runEnsembleDetection } from './ensemble-detection.ts';

// ========================================
// OCR Count Detection
// ========================================
export { detectItemCounts } from './ocr-count.ts';

// ========================================
// Metrics & Config Exports
// ========================================
export { getCVMetrics, getDetectionConfig, getUncertainDetectionsFromResults } from './metrics-exports.ts';

// ========================================
// Main Orchestration
// ========================================
export { detectItemsWithCV, __resetDetectionStateForTesting } from './orchestrator.ts';
