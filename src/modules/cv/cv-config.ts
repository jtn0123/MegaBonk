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
 * Complete CV configuration
 */
export interface CVConfig {
    detection: DetectionConfig;
    cache: CacheConfig;
    performance: PerformanceConfig;
    imageValidation: ImageValidationConfig;
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
        minAspectRatio: 1.0,
        maxAspectRatio: 2.5,
        uniformImageVarianceThreshold: 100,
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
 * Update CV configuration with partial values
 * Deep merges provided values with current configuration
 */
export function updateCVConfig(
    updates: Partial<{
        detection: Partial<DetectionConfig>;
        cache: Partial<CacheConfig>;
        performance: Partial<PerformanceConfig>;
        imageValidation: Partial<ImageValidationConfig>;
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
