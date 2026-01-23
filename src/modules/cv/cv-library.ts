// ========================================
// CV Library Entry Point
// ========================================
// Standalone CV library for use outside the main app (e.g., CV Validator)
// Exports only what's needed without main app dependencies

// ----------------------------------------
// Similarity Functions (from similarity.ts)
// ----------------------------------------
export {
    calculateNCC,
    calculateSSIM,
    calculateHistogramSimilarity,
    calculateEdgeSimilarity,
    calculateCombinedSimilarity,
    calculateEnhancedSimilarity,
    calculateDetailedSimilarity,
    calculateAdaptiveSimilarity,
    calculateAdaptiveDetailedSimilarity,
    similarityPassesThreshold,
    preprocessImage,
    enhanceContrast,
    normalizeColors,
} from './similarity.ts';
export type { SimilarityResult } from './similarity.ts';

// ----------------------------------------
// Color Functions (from color.ts)
// ----------------------------------------
export {
    isEmptyCell,
    calculateColorVariance,
    getDominantColor,
    extractDominantColors,
    extractBorderPixels,
    detectBorderRarity,
} from './color.ts';

// ----------------------------------------
// Training Data Functions (from training.ts)
// ----------------------------------------
export {
    loadTrainingData,
    getTrainingTemplatesForItem,
    isTrainingDataLoaded,
    getTrainingStats,
    getTrainingIndex,
    getTrainingTemplates,
    clearTrainingData,
    setTrainingDataBasePath,
    // Source management
    getAvailableSources,
    getEnabledSources,
    enableSource,
    disableSource,
    setEnabledSources,
    enableAllSources,
    isSourceEnabled,
} from './training.ts';

// Export types for consumers
export type { TrainingSample, TrainingItemData, TrainingIndex, TrainingTemplate } from './training.ts';

// ----------------------------------------
// Detection Helpers (from detection.ts)
// ----------------------------------------
export { resizeImageData } from './detection.ts';

// ----------------------------------------
// SimpleImageData Interface
// ----------------------------------------
// Re-export for consumers who need to work with the interface
export interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}
