// ========================================
// CV Color Analysis
// Re-exports from split modules for backward compatibility
// ========================================

// Color utilities: conversions, constants, calculation helpers
export {
    rgbToHsl,
    type RarityColorDef,
    RARITY_BORDER_COLORS,
    getAdjacentColors,
    getColorCandidates,
    EMPTY_CELL_MEAN_THRESHOLD,
    EMPTY_DETECTION_CONFIG,
    calculateColorVariance,
    calculateAverageSaturation,
    calculateHistogramWidth,
    calculateCenterEdgeRatio,
    calculateEdgeDensity,
} from './color-utils.js';

// Color extraction: dominant colors, detailed categories, border pixels
export {
    extractDominantColors,
    type DetailedColorCategory,
    getDetailedColorCategory,
    getDominantColor,
    extractBorderPixels,
} from './color-extraction.js';

// Color matching: rarity detection, similarity, empty cell detection
export {
    matchesRarityColor,
    detectRarityAtPixel,
    matchColorCategories,
    isInventoryBackground,
    isEmptyCell,
    detectBorderRarity,
    countRarityBorderPixels,
} from './color-matching.js';
