// ========================================
// CV Core Detection Logic - Entry Point
// ========================================
// This file re-exports everything from the split detection modules:
//   - detection-matching.ts    - Template matching, similarity scoring
//   - detection-processing.ts  - Result processing, caching, validation
//   - detection-pipeline.ts    - Main detection flow, orchestration

// ========================================
// Matching Exports (similarity, template matching)
// ========================================
export {
    calculateSimilarity,
    matchTemplate,
    matchTemplateMulti,
    findBestTemplateMatch,
    shouldUseTemplate,
} from './detection-matching.ts';

// ========================================
// Processing Exports (caching, validation, boosting)
// ========================================
export {
    loadImageToCanvas,
    getCachedResults,
    cacheResults,
    boostConfidenceWithContext,
    validateWithBorderRarity,
    filterByConfidence,
    aggregateDetections,
} from './detection-processing.ts';

// ========================================
// Pipeline Exports (main detection, orchestration)
// ========================================
export {
    // Main Detection
    detectItemsWithCV,
    runEnsembleDetection,
    
    // Count Detection
    detectItemCounts,
    
    // Metrics & Config
    getCVMetrics,
    getDetectionConfig,
    getUncertainDetectionsFromResults,
    
    // Testing
    __resetDetectionStateForTesting,
} from './detection-pipeline.ts';

// ========================================
// Utility Re-exports (for backwards compatibility)
// ========================================
export { calculateIoU, nonMaxSuppression, resizeImageData, extractCountRegion } from './detection-utils.ts';
