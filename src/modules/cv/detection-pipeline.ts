// ========================================
// Detection Pipeline - Backwards Compatibility Barrel
// ========================================
// This file maintains backwards compatibility by re-exporting all functions
// from the refactored detection-pipeline/ directory.
//
// The original 1167-line monolithic file has been split into focused modules:
//   - detection-pipeline/types.ts              - Local types and interfaces
//   - detection-pipeline/two-phase.ts          - Two-phase grid detection
//   - detection-pipeline/sliding-window.ts     - Sliding window detection
//   - detection-pipeline/worker-detection.ts   - Web Worker parallel detection
//   - detection-pipeline/ensemble-detection.ts - Ensemble multi-strategy detection
//   - detection-pipeline/ocr-count.ts          - OCR-based item count detection
//   - detection-pipeline/metrics-exports.ts    - Metrics and config exports
//   - detection-pipeline/orchestrator.ts       - Main detection orchestration
//   - detection-pipeline/index.ts              - Internal barrel file

// Re-export everything from the new modular structure
export {
    // Types
    type WorkerMatchResult,
    type TwoPhaseOptions,
    type SlidingWindowOptions,
    type TwoPhaseResult,
    type ProgressCallback,
    
    // Two-Phase Detection
    detectIconsWithTwoPhase,
    
    // Sliding Window Detection
    detectIconsWithSlidingWindow,
    detectEquipmentRegion,
    
    // Worker Detection
    detectItemsWithWorkers,
    
    // Ensemble Detection
    runEnsembleDetection,
    
    // OCR Count Detection
    detectItemCounts,
    
    // Metrics & Config Exports
    getCVMetrics,
    getDetectionConfig,
    getUncertainDetectionsFromResults,
    
    // Main Orchestration
    detectItemsWithCV,
    __resetDetectionStateForTesting,
} from './detection-pipeline/index.ts';
