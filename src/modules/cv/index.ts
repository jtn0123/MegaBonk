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
    TrainingSample as UnifiedTrainingSample,
    WeightedTemplate,
    TemplateSelectionOptions,
} from './unified-template-manager.ts';

// Active Learning
export {
    initActiveLearning,
    findUncertainDetections,
    shouldPromptForLearning,
    startActiveLearningSession,
    getActiveLearningSession,
    getCurrentUncertainDetection,
    submitVerification,
    skipCurrentDetection,
    endActiveLearningSession,
    renderActiveLearningPrompt,
    renderCompletionMessage,
    renderUncertainBadge,
    handleVerificationAction,
} from './active-learning.ts';
export type { UncertainDetection, VerificationResponse, ActiveLearningSession } from './active-learning.ts';

// Metrics Summary
export {
    calculateMetricsSummary,
    getSystemAccuracy,
    renderMetricsSummary,
    renderSystemAccuracyBadge,
    renderCompactMetrics,
    logMetricsSummary,
} from './metrics-summary.ts';
export type { DetectionForMetrics, MetricsSummary, SystemAccuracy } from './metrics-summary.ts';

// Training Feedback Export
export {
    startFeedbackSession,
    getCurrentSession,
    clearFeedbackSession,
    extractCropFromImage,
    addCorrection,
    removeCorrection,
    exportFeedback,
    downloadFeedback,
    getCorrectionCount,
    getCorrections,
    isDetectionCorrected,
} from './training-feedback.ts';
export type { DetectionForFeedback, FeedbackCorrection, FeedbackExport, FeedbackSession } from './training-feedback.ts';

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

// CV Detection Metrics
export { getMetricsCollector, enableMetrics, disableMetrics, isMetricsEnabled } from './metrics.ts';
export type { CVDetectionMetrics, CVAggregatedMetrics } from './metrics.ts';

// Adaptive Preprocessing
export {
    analyzeScene,
    getPreprocessConfig,
    applyAdaptivePreprocessing,
    describeScene,
} from './adaptive-preprocessing.ts';
export type { SceneAnalysis, PreprocessConfig } from './adaptive-preprocessing.ts';

// Margin Configuration
export {
    DEFAULT_MARGIN_CONFIG,
    OPTIMIZED_MARGIN_CONFIG,
    CONSERVATIVE_MARGIN_CONFIG,
    setMarginConfig,
    getMarginConfig,
    calculateCellMargin,
    calculateTemplateMargin,
    describeMargins,
} from './margin-config.ts';
export type { MarginConfig, RarityMargins, ResolutionConfig } from './margin-config.ts';

// Template Variants
export {
    generateVariants,
    selectBestVariants,
    getRecommendedVariant,
    scoreVariantMatch,
    getVariantStats,
    DEFAULT_VARIANT_CONFIG,
    MINIMAL_VARIANT_CONFIG,
    FULL_VARIANT_CONFIG,
} from './template-variants.ts';
export type { TemplateVariant, VariantType, VariantConfig } from './template-variants.ts';

// Template Ranking
export {
    recordMatchResult,
    getTemplateRanking,
    getRankingsForItem,
    getTopTemplates,
    shouldSkipTemplate,
    getSkipListEntry,
    getSkipList,
    addToSkipList,
    removeFromSkipList,
    clearSkipList,
    getConfusionMatrix,
    getRecommendedThreshold,
    exportPerformanceData,
    importPerformanceData,
    getRankingStats,
    clearPerformanceData,
    setRankingConfig,
    getRankingConfig,
    DEFAULT_RANKING_CONFIG,
} from './template-ranking.ts';
export type {
    TemplatePerformance,
    TemplateRanking,
    SkipListEntry,
    RankingConfig,
} from './template-ranking.ts';

// Scoring Configuration
export {
    DEFAULT_SCORING_CONFIG,
    PRECISION_SCORING_CONFIG,
    RECALL_SCORING_CONFIG,
    FAST_SCORING_CONFIG,
    setScoringConfig,
    getScoringConfig,
    getThresholdForRarity,
    calculateWeightedScore,
    passesThreshold,
    getConfidenceGrade,
    describeScoringConfig,
    mergeWithDefaults,
} from './scoring-config.ts';
export type {
    MetricWeights,
    AgreementConfig,
    RarityThresholds,
    ScoringConfig,
} from './scoring-config.ts';

// Weighted Voting
export {
    combineVotes,
    majorityVote,
    thresholdVote,
    ensembleVote,
    setVotingConfig,
    getVotingConfig,
    describeVotingResult,
    DEFAULT_VOTING_CONFIG,
    STRICT_VOTING_CONFIG,
    LENIENT_VOTING_CONFIG,
} from './voting.ts';
export type {
    TemplateVote,
    VotingResult,
    VoteAggregate,
    VotingConfig,
} from './voting.ts';

// Similarity (advanced functions)
export {
    calculateDetailedSimilarity,
    calculateAdaptiveDetailedSimilarity,
    similarityPassesThreshold,
} from './similarity.ts';
export type { SimilarityResult } from './similarity.ts';

// Resolution Profiles
export {
    getResolutionTier,
    getProfileForResolution,
    getClosestPreset,
    getScaleFromBase,
    scaleValue,
    getExpectedIconSize,
    getExpectedCellStride,
    interpolateProfile,
    getTemplateScales,
    describeResolution,
    validateIconSize,
    getHotbarScanRegion,
    getCountTextRegion,
    RESOLUTION_PRESETS,
    STRATEGY_PROFILES,
    LOW_RES_PROFILE,
    MEDIUM_RES_PROFILE,
    HIGH_RES_PROFILE,
    ULTRA_RES_PROFILE,
} from './resolution-profiles.ts';
export type {
    ResolutionTier,
    ResolutionInfo,
    StrategyProfile,
} from './resolution-profiles.ts';

// Count Detection
export {
    detectCount,
    detectCounts,
    hasCountOverlay,
    correctToCommonStack,
    COMMON_STACK_SIZES,
} from './count-detection.ts';
export type { CountDetectionResult } from './count-detection.ts';
