// ========================================
// CV Centralized Configuration (2.11)
// ========================================
// Single source of truth for all CV module configuration
// Makes it easy to tune parameters without hunting through files

import { logger } from '../logger.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Detection configuration
 */
export interface DetectionConfig {
    /** Minimum confidence threshold for accepting a match */
    minConfidence: number;
    /** High confidence threshold (no further verification needed) */
    highConfidenceThreshold: number;
    /** Maximum number of detections per image */
    maxDetections: number;
    /** Enable debug overlays */
    debugMode: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Time-to-live for detection cache entries (ms) */
    detectionCacheTTL: number;
    /** Maximum entries in detection cache */
    maxDetectionCacheEntries: number;
    /** Maximum entries in resized template cache */
    maxResizedCacheEntries: number;
    /** Maximum items in multi-scale template cache */
    maxMultiScaleItems: number;
    /** Periodic cleanup interval (ms) */
    cleanupInterval: number;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
    /** Use web workers for parallel processing */
    useWorkers: boolean;
    /** Maximum concurrent template comparisons */
    maxConcurrentComparisons: number;
    /** Pixel sampling rate (1 = all pixels, 4 = every 4th pixel) */
    pixelSamplingRate: number;
    /** Enable early exit on high confidence match */
    enableEarlyExit: boolean;
    /** Early exit confidence threshold */
    earlyExitThreshold: number;
}

/**
 * Image validation configuration
 */
export interface ImageValidationConfig {
    /** Minimum image width (pixels) */
    minWidth: number;
    /** Minimum image height (pixels) */
    minHeight: number;
    /** Maximum image width (pixels) */
    maxWidth: number;
    /** Maximum image height (pixels) */
    maxHeight: number;
    /** Minimum aspect ratio */
    minAspectRatio: number;
    /** Maximum aspect ratio */
    maxAspectRatio: number;
    /** Variance threshold for uniform image detection */
    uniformImageVarianceThreshold: number;
}

/**
 * Grid layout configuration
 * Controls spatial ratios for hotbar detection, region definitions, and grid building
 */
export interface GridConfig {
    /** Where hotbar starts vertically (ratio of screen height) */
    hotbarYRatio: number;
    /** Where to start scanning for hotbar band (ratio of screen height) */
    scanStartYRatio: number;
    /** Horizontal sample start for hotbar detection (ratio of screen width) */
    sampleStartXRatio: number;
    /** Horizontal sample width for hotbar detection (ratio of screen width) */
    sampleWidthRatio: number;
    /** Y position threshold for hotbar detection bonus (ratio of screen height) */
    hotbarThresholdY: number;
    /** Y position threshold for inventory detection bonus (ratio of screen height) */
    inventoryThresholdY: number;
    /** Center detection region X (ratio of screen width) */
    centerRegionX: number;
    /** Center detection region Y (ratio of screen height) */
    centerRegionY: number;
    /** Center detection region width (ratio of screen width) */
    centerRegionW: number;
    /** Center detection region height (ratio of screen height) */
    centerRegionH: number;
    /** Top detection region X (ratio of screen width) */
    topRegionX: number;
    /** Top detection region Y (ratio of screen height) */
    topRegionY: number;
    /** Top detection region width (ratio of screen width) */
    topRegionW: number;
    /** Top detection region height (ratio of screen height) */
    topRegionH: number;
    /** Maximum hotbar band height as ratio of screen height */
    maxBandHeightRatio: number;
    /** Minimum hotbar band height as ratio of screen height */
    minBandHeightRatio: number;
    /** Fallback hotbar start position if no band found (ratio of screen height) */
    fallbackHotbarStart: number;
    /** Don't place grid rows above this Y ratio */
    maxRowYRatio: number;
    /** Minimum absolute icon size in pixels (below = false positive) */
    minAbsoluteIconSize: number;
    /** Minimum hotbar band confidence to consider screen non-empty */
    minBandConfidence: number;
    /** Minimum rarity border edges required */
    minEdgesRequired: number;
    /** Minimum metrics confidence for valid detection */
    minMetricsConfidence: number;
    /** Minimum valid cells for consistent detection */
    minValidCells: number;
}

/**
 * Color analysis configuration
 * Controls thresholds for color matching, empty cell detection, and rarity classification
 */
export interface ColorConfig {
    /** Minimum colorfulness ratio to consider (for hotbar band scoring) */
    colorfulThreshold: number;
    /** Minimum rarity signal ratio (for hotbar band scoring) */
    rarityThreshold: number;
    /** Variance below this = likely empty cell */
    emptyVarianceThreshold: number;
    /** Variance below this with low colorful ratio = suspicious cell */
    suspiciousVarianceThreshold: number;
    /** Mean brightness below this = empty cell */
    emptyBrightnessThreshold: number;
    /** Colorful ratio below this (with low variance) = suspicious cell */
    suspiciousColorfulRatio: number;
    /** Max brightness for inventory background pixels */
    inventoryBgBrightnessMax: number;
    /** Max saturation spread for inventory background pixels */
    inventoryBgSaturationMax: number;
    /** Ratio of dark low-sat pixels to classify as inventory background */
    inventoryBgRatio: number;
    /** Minimum ratio of border pixels matching a rarity to accept */
    minVoteRatio: number;
}

/**
 * Preprocessing configuration
 * Controls adaptive preprocessing thresholds for scene analysis and image enhancement
 */
export interface PreprocessingConfig {
    /** Brightness below this = dark scene */
    darkBrightnessThreshold: number;
    /** Brightness above this = bright scene */
    brightBrightnessThreshold: number;
    /** Contrast (std dev) below this = low contrast */
    lowContrastThreshold: number;
    /** Contrast (std dev) above this = high contrast */
    highContrastThreshold: number;
    /** Default contrast enhancement factor */
    defaultContrastFactor: number;
    /** Contrast factor for dark scenes */
    darkContrastFactor: number;
    /** Contrast factor for bright scenes */
    brightContrastFactor: number;
    /** Brightness adjustment for dark scenes */
    darkBrightnessAdjust: number;
    /** Brightness adjustment for bright scenes */
    brightBrightnessAdjust: number;
    /** Contrast multiplier for low-contrast scenes */
    lowContrastMultiplier: number;
    /** Contrast multiplier for high-contrast scenes */
    highContrastMultiplier: number;
    /** Sharpening factor for low-noise images */
    lowNoiseSharpeningFactor: number;
    /** Sharpening factor for medium-noise images */
    mediumNoiseSharpeningFactor: number;
    /** Contrast factor when heavy effects detected */
    heavyEffectsContrastFactor: number;
    /** Max contrast factor for hell biome */
    hellContrastMax: number;
    /** Brightness adjustment for snow biome */
    snowBrightnessAdjust: number;
    /** Contrast factor for snow biome */
    snowContrastFactor: number;
    /** Brightness adjustment for dark environments */
    darkEnvBrightnessAdjust: number;
    /** Contrast factor for dark environments */
    darkEnvContrastFactor: number;
    /** Brightness threshold for effect pixel detection */
    effectBrightnessThreshold: number;
    /** Saturation threshold for effect pixel detection */
    effectSaturationThreshold: number;
    /** Ratio of effect pixels to classify as heavy effects */
    effectRatioThreshold: number;
    /** Noise variance below this = low noise */
    lowNoiseThreshold: number;
    /** Noise variance above this = high noise */
    highNoiseThreshold: number;
}

/**
 * Complete CV configuration
 */
export interface CVConfig {
    detection: DetectionConfig;
    cache: CacheConfig;
    performance: PerformanceConfig;
    imageValidation: ImageValidationConfig;
    grid: GridConfig;
    color: ColorConfig;
    preprocessing: PreprocessingConfig;
}

// ========================================
// Default Configuration
// ========================================

const DEFAULT_CONFIG: CVConfig = {
    detection: {
        minConfidence: 0.5,
        highConfidenceThreshold: 0.8,
        maxDetections: 50,
        debugMode: false,
    },
    cache: {
        detectionCacheTTL: 1000 * 60 * 15, // 15 minutes
        maxDetectionCacheEntries: 50,
        maxResizedCacheEntries: 500,
        maxMultiScaleItems: 100,
        cleanupInterval: 1000 * 60 * 10, // 10 minutes
    },
    performance: {
        useWorkers: false,
        maxConcurrentComparisons: 10,
        pixelSamplingRate: 4,
        enableEarlyExit: true,
        earlyExitThreshold: 0.9,
    },
    imageValidation: {
        minWidth: 320,
        minHeight: 240,
        maxWidth: 4096,
        maxHeight: 2160,
        minAspectRatio: 1,
        maxAspectRatio: 2.5,
        uniformImageVarianceThreshold: 100,
    },
    grid: {
        hotbarYRatio: 0.8,
        scanStartYRatio: 0.7,
        sampleStartXRatio: 0.15,
        sampleWidthRatio: 0.7,
        hotbarThresholdY: 0.88,
        inventoryThresholdY: 0.82,
        centerRegionX: 0.15,
        centerRegionY: 0.15,
        centerRegionW: 0.7,
        centerRegionH: 0.7,
        topRegionX: 0.2,
        topRegionY: 0.15,
        topRegionW: 0.6,
        topRegionH: 0.2,
        maxBandHeightRatio: 0.12,
        minBandHeightRatio: 0.06,
        fallbackHotbarStart: 0.88,
        maxRowYRatio: 0.7,
        minAbsoluteIconSize: 22,
        minBandConfidence: 0.4,
        minEdgesRequired: 3,
        minMetricsConfidence: 0.3,
        minValidCells: 3,
    },
    color: {
        colorfulThreshold: 0.03,
        rarityThreshold: 0.01,
        emptyVarianceThreshold: 400,
        suspiciousVarianceThreshold: 600,
        emptyBrightnessThreshold: 30,
        suspiciousColorfulRatio: 0.1,
        inventoryBgBrightnessMax: 80,
        inventoryBgSaturationMax: 40,
        inventoryBgRatio: 0.6,
        minVoteRatio: 0.1,
    },
    preprocessing: {
        darkBrightnessThreshold: 70,
        brightBrightnessThreshold: 180,
        lowContrastThreshold: 30,
        highContrastThreshold: 70,
        defaultContrastFactor: 1.5,
        darkContrastFactor: 1.3,
        brightContrastFactor: 1.4,
        darkBrightnessAdjust: 20,
        brightBrightnessAdjust: -10,
        lowContrastMultiplier: 1.2,
        highContrastMultiplier: 0.85,
        lowNoiseSharpeningFactor: 0.4,
        mediumNoiseSharpeningFactor: 0.2,
        heavyEffectsContrastFactor: 1.2,
        hellContrastMax: 1.4,
        snowBrightnessAdjust: -15,
        snowContrastFactor: 1.6,
        darkEnvBrightnessAdjust: 25,
        darkEnvContrastFactor: 1.3,
        effectBrightnessThreshold: 200,
        effectSaturationThreshold: 60,
        effectRatioThreshold: 0.05,
        lowNoiseThreshold: 50,
        highNoiseThreshold: 200,
    },
};

// ========================================
// Runtime Configuration State
// ========================================

let currentConfig: CVConfig = structuredClone(DEFAULT_CONFIG);

// ========================================
// Configuration API
// ========================================

/**
 * Get the current CV configuration
 */
export function getCVConfig(): Readonly<CVConfig> {
    return currentConfig;
}

/**
 * Get detection configuration
 */
export function getDetectionConfig(): Readonly<DetectionConfig> {
    return currentConfig.detection;
}

/**
 * Get cache configuration
 */
export function getCacheConfig(): Readonly<CacheConfig> {
    return currentConfig.cache;
}

/**
 * Get performance configuration
 */
export function getPerformanceConfig(): Readonly<PerformanceConfig> {
    return currentConfig.performance;
}

/**
 * Get image validation configuration
 */
export function getImageValidationConfig(): Readonly<ImageValidationConfig> {
    return currentConfig.imageValidation;
}

/**
 * Get grid layout configuration
 */
export function getGridConfig(): Readonly<GridConfig> {
    return currentConfig.grid;
}

/**
 * Get color analysis configuration
 */
export function getColorConfig(): Readonly<ColorConfig> {
    return currentConfig.color;
}

/**
 * Get preprocessing configuration
 */
export function getPreprocessingConfig(): Readonly<PreprocessingConfig> {
    return currentConfig.preprocessing;
}

/**
 * Update CV configuration with partial values
 * Deep merges provided values with current configuration
 */
export function updateCVConfig(
    updates: Partial<{
        detection: Partial<DetectionConfig>;
        cache: Partial<CacheConfig>;
        performance: Partial<PerformanceConfig>;
        imageValidation: Partial<ImageValidationConfig>;
        grid: Partial<GridConfig>;
        color: Partial<ColorConfig>;
        preprocessing: Partial<PreprocessingConfig>;
    }>
): void {
    if (updates.detection) {
        currentConfig.detection = { ...currentConfig.detection, ...updates.detection };
    }
    if (updates.cache) {
        currentConfig.cache = { ...currentConfig.cache, ...updates.cache };
    }
    if (updates.performance) {
        currentConfig.performance = { ...currentConfig.performance, ...updates.performance };
    }
    if (updates.imageValidation) {
        currentConfig.imageValidation = { ...currentConfig.imageValidation, ...updates.imageValidation };
    }
    if (updates.grid) {
        currentConfig.grid = { ...currentConfig.grid, ...updates.grid };
    }
    if (updates.color) {
        currentConfig.color = { ...currentConfig.color, ...updates.color };
    }
    if (updates.preprocessing) {
        currentConfig.preprocessing = { ...currentConfig.preprocessing, ...updates.preprocessing };
    }

    logger.info({
        operation: 'cv.config.updated',
        data: { updates },
    });
}

/**
 * Reset configuration to defaults
 */
export function resetCVConfig(): void {
    currentConfig = structuredClone(DEFAULT_CONFIG);
    logger.info({
        operation: 'cv.config.reset',
    });
}

/**
 * Enable debug mode
 */
export function enableDebugMode(): void {
    currentConfig.detection.debugMode = true;
    logger.info({
        operation: 'cv.config.debug_enabled',
    });
}

/**
 * Disable debug mode
 */
export function disableDebugMode(): void {
    currentConfig.detection.debugMode = false;
    logger.info({
        operation: 'cv.config.debug_disabled',
    });
}

/**
 * Check if debug mode is enabled
 */
export function isDebugModeEnabled(): boolean {
    return currentConfig.detection.debugMode;
}
