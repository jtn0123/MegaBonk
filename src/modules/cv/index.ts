// ========================================
// MegaBonk Computer Vision Module - Barrel File
// ========================================
// Re-exports all CV functionality for backwards compatibility

// Types
export type { CVDetectionResult, ROI, TemplateData } from './types.ts';

// Core - Initialization and Cleanup
export { cleanupCV, initCV, isFullyLoaded, isPriorityLoaded, startCacheCleanup, stopCacheCleanup } from './core.ts';

// Templates
export { loadItemTemplates, clearDetectionCache } from './templates.ts';

// Detection
export {
    detectItemsWithCV,
    detectGridPositions,
    detectItemCounts,
    loadImageToCanvas,
    calculateSimilarity,
    calculateIoU,
    nonMaxSuppression,
    getAdaptiveIconSizes,
    extractCountRegion,
} from './detection.ts';

// Aggregation
export { aggregateDuplicates, combineDetections } from './aggregation.ts';

// Color
export {
    extractDominantColors,
    getDominantColor,
    calculateColorVariance,
    isEmptyCell,
    extractBorderPixels,
    detectBorderRarity,
} from './color.ts';

// Regions
export { detectUIRegions, detectScreenType } from './regions.ts';

// Debug
export { renderDebugOverlay, createDebugOverlay } from './debug.ts';

// State (for advanced usage)
export {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    isTemplatesLoaded,
    isPriorityTemplatesLoaded,
    CACHE_TTL,
    MAX_CACHE_SIZE,
} from './state.ts';
