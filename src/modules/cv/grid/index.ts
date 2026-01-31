// ========================================
// CV Grid Detection - Barrel File
// Re-exports all grid detection functionality
// ========================================

// Types
export type {
    GridParameters,
    GridVerificationResult,
    ScaleDetectionResult,
    HotbarRegion,
} from './grid-types.ts';

// Hotbar Detection
export { detectHotbarRegion } from './hotbar-detection.ts';

// Edge Detection
export { detectIconEdges, filterByConsistentSpacing } from './edge-detection.ts';

// Grid Inference
export { inferGridFromEdges, generateGridROIs } from './grid-inference.ts';

// Scale Detection
export { getAdaptiveIconSizes, detectIconScale, detectGridPositions } from './scale-detection.ts';

// Grid Verification
export {
    findMode,
    calculateAdaptiveTolerance,
    fitsGrid,
    clusterByY,
    verifyGridPattern,
} from './grid-verification.ts';
