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
    
    // Detection
    window.detectItemsWithCV = detectItemsWithCV;
    window.detectGridPositions = detectGridPositions;
    window.detectItemCounts = detectItemCounts;
    window.loadImageToCanvas = loadImageToCanvas;
    window.calculateSimilarity = calculateSimilarity;
    window.calculateIoU = calculateIoU;
    window.nonMaxSuppression = nonMaxSuppression;
    window.getAdaptiveIconSizes = getAdaptiveIconSizes;
    window.extractCountRegion = extractCountRegion;
    window.detectHotbarRegion = detectHotbarRegion;
    window.detectIconEdges = detectIconEdges;
    window.detectIconScale = detectIconScale;
    window.resizeImageData = resizeImageData;
    window.fitsGrid = fitsGrid;
    window.verifyGridPattern = verifyGridPattern;
    window.runEnsembleDetection = runEnsembleDetection;
    window.getCVMetrics = getCVMetrics;
    window.getDetectionConfig = getDetectionConfig;
    
    // Color
    window.extractDominantColors = extractDominantColors;
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
