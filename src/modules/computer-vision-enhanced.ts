// ========================================
// Enhanced Computer Vision Module
// ========================================
// Extends base CV module with advanced strategies
// Implements Ideas 1-5: Rarity-first, multi-region, adaptive thresholds, HSV, feedback loop
//
// NOTE: This file has been refactored into smaller modules under cv-enhanced/
// This file now serves as a backwards-compatible re-export of all functionality.
// ========================================

// Re-export everything from the modular structure
export {
    // Types
    type CVDetectionResult,
    type ROI,
    type CVStrategy,
    type ColorProfile,
    type HSVColor,
    type EnhancedTemplateData,
    type ValidCellData,
    type CellMatchResult,
    type ProgressCallback,

    // Similarity algorithms
    calculateSimilarity,
    calculateNCC,
    calculateSSD,
    calculateSSIM,

    // Template management
    loadEnhancedTemplates,
    resetEnhancedTemplates,
    getEnhancedTemplate,
    getTemplatesByRarity,
    getTemplatesByColor,
    areEnhancedTemplatesLoaded,

    // Matching algorithms
    filterValidCells,
    filterCandidates,
    matchCell,
    multiPassMatching,
    singlePassMatching,

    // Detection (main entry points)
    initEnhancedCV,
    detectItemsWithEnhancedCV,

    // Utilities
    resizeImageData,
    loadImage,
    createCanvasFromImage,

    // Backwards compatibility alias
    resetEnhancedCVState,
} from './cv-enhanced/index.ts';

// Export for window (browser compatibility)
if (typeof window !== 'undefined') {
    import('./cv-enhanced/detection.ts').then(({ initEnhancedCV, detectItemsWithEnhancedCV }) => {
        window.initEnhancedCV = initEnhancedCV;
        window.detectItemsWithEnhancedCV = detectItemsWithEnhancedCV;
    });
    import('./cv-enhanced/templates.ts').then(({ resetEnhancedTemplates }) => {
        window.resetEnhancedCVState = resetEnhancedTemplates;
    });
}
