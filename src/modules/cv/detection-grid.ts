// ========================================
// CV Grid Detection and Verification
// ========================================
// This file re-exports from the grid/ subdirectory for backwards compatibility.
// New code should import directly from './grid/index.ts' or specific submodules.

export type { GridParameters, GridVerificationResult, ScaleDetectionResult, HotbarRegion } from './grid/index.ts';

export {
    // Hotbar Detection
    detectHotbarRegion,
    // Edge Detection
    detectIconEdges,
    filterByConsistentSpacing,
    // Grid Inference
    inferGridFromEdges,
    generateGridROIs,
    // Scale Detection
    getAdaptiveIconSizes,
    detectIconScale,
    detectGridPositions,
    // Grid Verification
    findMode,
    calculateAdaptiveTolerance,
    fitsGrid,
    clusterByY,
    verifyGridPattern,
} from './grid/index.ts';
