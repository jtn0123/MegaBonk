// ========================================
// MegaBonk Computer Vision Module - Barrel File
// ========================================
// Re-exports all CV functionality for backwards compatibility

// Types
export type { CVDetectionResult, ROI, TemplateData, PresetCalibration, GridPreset, GridPresetsFile } from './types.ts';

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
    // Grid presets
    loadGridPresets,
    getPresetForResolution,
    findPresetByAspectRatio,
    getAllGridPresets,
    isGridPresetsLoaded,
    scaleCalibrationToResolution,
} from './state.ts';

// Training Data
export {
    loadTrainingData,
    getTrainingTemplates,
    getTrainingTemplatesForItem,
    isTrainingDataLoaded,
    getTrainingStats,
    clearTrainingData,
    getTrainingDataVersion,
    logTrainingDataVersion,
} from './training.ts';
export type {
    TrainingTemplate,
    TrainingIndex,
    TrainingSample,
    TrainingDataVersion,
    TrainingSourceStats,
} from './training.ts';

// Auto-Grid Detection
export {
    autoDetectGrid,
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    buildPreciseGrid,
    validateGrid,
    compareWithPreset,
    drawDetectionOverlay,
    setConfig as setAutoGridConfig,
    getConfig as getAutoGridConfig,
} from './auto-grid-detection.ts';
export type {
    AutoGridConfig,
    GridCalibration,
    BandRegion,
    CellEdge,
    BorderResult,
    IconMetrics,
    GridPosition,
    GridResult,
    CellValidation,
    ValidatedCell,
    ValidationResult,
    FailureReason,
    AutoDetectionResult,
    PresetComparison,
    ProgressCallback,
} from './auto-grid-detection.ts';

// Unified Template Manager
export {
    calculateQualityScore,
    calculateResolutionBonus,
    selectBestTemplates,
    calculateWeightedMatchScore,
    generateMultiScaleVariants,
    getTemplateAtSize,
    loadTemplate,
    loadTemplatesBatch,
    groupTemplatesByColor,
    prioritizeItems,
    cacheDetection,
    getCachedDetection,
    clearCache,
    cleanExpiredCache,
    getTemplate,
    getAllTemplates,
    getTemplatesByColorGroup,
    getAllColorGroups,
    isTemplatesFullyLoaded,
    isPriorityLoaded as isUnifiedPriorityLoaded,
    getTemplateCount,
    getScaledVariantCount,
    getCacheSize,
    getConfig as getUnifiedConfig,
    setTemplatesLoaded as setUnifiedTemplatesLoaded,
    setPriorityTemplatesLoaded as setUnifiedPriorityLoaded,
    resetState as resetUnifiedState,
} from './unified-template-manager.ts';
export type {
    TemplateSource,
    ScaledTemplate,
    TemplateData as UnifiedTemplateData,
    TrainingSample,
    WeightedTemplate,
    TemplateSelectionOptions,
} from './unified-template-manager.ts';

// Accuracy Tracking
export {
    loadBenchmarkHistory,
    getAccuracySummary,
    analyzeTrends,
    getWeakItems,
    getPerImageMetrics,
    getGradeForF1,
    getQualityDescription,
    formatPercent,
    isHistoryLoaded,
    getRunCount,
    getLastRun,
    clearHistory,
} from './accuracy-tracker.ts';
export type {
    ItemAccuracyMetrics,
    ImageAccuracyMetrics,
    BenchmarkRun,
    BenchmarkHistory,
    AccuracySummary,
    TrendAnalysis,
} from './accuracy-tracker.ts';
