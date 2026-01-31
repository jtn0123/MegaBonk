// ========================================
// MegaBonk Computer Vision Module
// ========================================
// This file re-exports from the cv/ directory for backwards compatibility.
// All CV functionality has been split into smaller, focused modules.
// ========================================

// Re-export everything from the cv module
export * from './cv/index.ts';

// ========================================
// Global Assignments (for browser compatibility)
// ========================================
import {
    initCV,
    // Detection functions
    detectItemsWithCV,
    detectGridPositions,
    detectItemCounts,
    loadImageToCanvas,
    calculateSimilarity,
    calculateIoU,
    nonMaxSuppression,
    getAdaptiveIconSizes,
    extractCountRegion,
    detectHotbarRegion,
    detectIconEdges,
    detectIconScale,
    resizeImageData,
    fitsGrid,
    verifyGridPattern,
    runEnsembleDetection,
    getCVMetrics,
    getDetectionConfig,
    // Color functions
    extractDominantColors,
    getDominantColor,
    calculateColorVariance,
    isEmptyCell,
    detectBorderRarity,
    // Region functions
    detectUIRegions,
    detectScreenType,
    // Templates
    clearDetectionCache,
} from './cv/index.ts';

if (typeof window !== 'undefined') {
    // Core
    window.initCV = initCV;
    
    // Detection - use type assertions for functions with concrete parameter types
    // The Window interface uses `unknown` for flexibility, but actual functions use specific types
    window.detectItemsWithCV = detectItemsWithCV;
    window.detectGridPositions = detectGridPositions;
    window.detectItemCounts = detectItemCounts as typeof window.detectItemCounts;
    window.loadImageToCanvas = loadImageToCanvas;
    window.calculateSimilarity = calculateSimilarity;
    window.calculateIoU = calculateIoU as typeof window.calculateIoU;
    window.nonMaxSuppression = nonMaxSuppression as typeof window.nonMaxSuppression;
    window.getAdaptiveIconSizes = getAdaptiveIconSizes;
    window.extractCountRegion = extractCountRegion as typeof window.extractCountRegion;
    window.detectHotbarRegion = detectHotbarRegion;
    window.detectIconEdges = detectIconEdges as typeof window.detectIconEdges;
    window.detectIconScale = detectIconScale;
    window.resizeImageData = resizeImageData;
    window.fitsGrid = fitsGrid;
    window.verifyGridPattern = verifyGridPattern as typeof window.verifyGridPattern;
    window.runEnsembleDetection = runEnsembleDetection as typeof window.runEnsembleDetection;
    window.getCVMetrics = getCVMetrics;
    window.getDetectionConfig = getDetectionConfig;
    
    // Color - extractDominantColors returns objects, Window interface expects strings for simplicity
    window.extractDominantColors = extractDominantColors as unknown as typeof window.extractDominantColors;
    window.getDominantColor = getDominantColor;
    window.calculateColorVariance = calculateColorVariance;
    window.isEmptyCell = isEmptyCell;
    window.detectBorderRarity = detectBorderRarity;
    
    // Regions
    window.detectUIRegions = detectUIRegions;
    window.detectScreenType = detectScreenType;
    
    // Templates
    window.clearDetectionCache = clearDetectionCache;
}
