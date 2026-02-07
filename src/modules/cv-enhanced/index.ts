// ========================================
// Enhanced Computer Vision Module - Barrel Export
// ========================================
// Re-exports all enhanced CV functionality for backwards compatibility
// Extends base CV module with advanced strategies
// Implements Ideas 1-5: Rarity-first, multi-region, adaptive thresholds, HSV, feedback loop

// Types
export type {
    CVDetectionResult,
    ROI,
    CVStrategy,
    ColorProfile,
    HSVColor,
    EnhancedTemplateData,
    ValidCellData,
    CellMatchResult,
    ProgressCallback,
} from './types.ts';

// Similarity algorithms
export { calculateSimilarity, calculateNCC, calculateSSD, calculateSSIM } from './similarity.ts';

// Template management
export {
    loadEnhancedTemplates,
    resetEnhancedTemplates,
    getEnhancedTemplate,
    getTemplatesByRarity,
    getTemplatesByColor,
    areEnhancedTemplatesLoaded,
} from './templates.ts';

// Matching algorithms
export { filterValidCells, filterCandidates, matchCell, multiPassMatching, singlePassMatching } from './matching.ts';

// Detection (main entry point)
export { initEnhancedCV, detectItemsWithEnhancedCV } from './detection.ts';

// Utilities
export { resizeImageData, loadImage, createCanvasFromImage } from './utils.ts';

// Backwards compatibility alias
export { resetEnhancedTemplates as resetEnhancedCVState } from './templates.ts';

// Export for window (browser compatibility)
if (typeof window !== 'undefined') {
    // Dynamic import to avoid circular dependencies
    import('./detection.ts').then(({ initEnhancedCV, detectItemsWithEnhancedCV }) => {
        window.initEnhancedCV = initEnhancedCV;
        window.detectItemsWithEnhancedCV = detectItemsWithEnhancedCV;
    });
    import('./templates.ts').then(({ resetEnhancedTemplates }) => {
        window.resetEnhancedCVState = resetEnhancedTemplates;
    });
}
