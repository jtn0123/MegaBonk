// ========================================
// CV Detection - Main Entry Point (Barrel Export)
// ========================================
// This file re-exports everything from the split modules for backwards compatibility.
// All detection functionality has been refactored into:
//   - detection-config.ts   - Configuration, thresholds, worker paths
//   - detection-utils.ts    - Utility functions (IoU, NMS, resizing, etc)
//   - detection-grid.ts     - Grid detection, verification, hotbar/edge detection
//   - detection-core.ts     - Main detection logic, template matching, caching

// ========================================
// Configuration Exports
// ========================================
export {
    setWorkerBasePath,
    getDynamicMinConfidence,
    IMAGE_LOAD_TIMEOUT_MS,
} from './detection-config.ts';

// ========================================
// Utility Exports
// ========================================
export {
    calculateIoU,
    nonMaxSuppression,
    resizeImageData,
    extractCountRegion,
} from './detection-utils.ts';

// ========================================
// Grid Detection Exports
// ========================================
export {
    // Hotbar/Edge Detection
    detectHotbarRegion,
    detectIconEdges,
    
    // Grid Inference
    inferGridFromEdges,
    generateGridROIs,
    
    // Adaptive Sizing
    getAdaptiveIconSizes,
    detectIconScale,
    detectGridPositions,
    
    // Grid Verification
    findMode,
    calculateAdaptiveTolerance,
    fitsGrid,
    clusterByY,
    verifyGridPattern,
    
    // Types
    type GridParameters,
    type GridVerificationResult,
    type ScaleDetectionResult,
} from './detection-grid.ts';

// ========================================
// Core Detection Exports
// ========================================
export {
    // Image Loading
    loadImageToCanvas,
    
    // Similarity
    calculateSimilarity,
    
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
} from './detection-core.ts';
