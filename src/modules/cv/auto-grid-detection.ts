// ========================================
// CV Auto-Grid Detection
// Dynamic edge detection + multi-pass refinement
// Self-calibrating grid detection for any resolution
// Ported from cv-validator/js/auto-grid-detection.js
// ========================================

// Re-export all types from grid-types for backwards compatibility
export type {
    AutoGridConfig,
    GridCalibration,
    StripData,
    BandRegion,
    CellEdge,
    RawEdge,
    BorderResult,
    IconMetrics,
    GridPosition,
    GridResult,
    CellValidation,
    ValidatedCell,
    ValidationResult,
    FailureReason,
    AutoDetectionResult,
    FieldComparison,
    PresetComparison,
    ProgressCallback,
} from './grid-types.ts';

// Import types for internal use
import type {
    AutoGridConfig,
    GridCalibration,
    BandRegion,
    CellEdge,
    IconMetrics,
    GridResult,
    FailureReason,
    AutoDetectionResult,
    ProgressCallback,
} from './grid-types.ts';

// Import from sub-modules
import {
    detectHotbarBand as _detectHotbarBand,
    detectRarityBorders as _detectRarityBorders,
    calculateIconMetrics as _calculateIconMetrics,
    buildPreciseGrid as _buildPreciseGrid,
    findMode as _findMode,
    getDefaultMetrics as _getDefaultMetrics,
} from './grid-analysis.ts';

import {
    validateGrid as _validateGrid,
    calculateOverallConfidence as _calculateOverallConfidence,
    compareWithPreset as _compareWithPreset,
} from './grid-validation.ts';

import { drawDetectionOverlay as _drawDetectionOverlay } from './grid-utils.ts';

// ========================================
// Default Configuration
// ========================================

const DEFAULT_CONFIG: AutoGridConfig = {
    baseResolution: 720,
    maxDetectedRows: 2,
    defaultCalibration: {
        xOffset: 0,
        yOffset: 0,
        iconWidth: 40,
        iconHeight: 40,
        xSpacing: 4,
        ySpacing: 4,
        iconsPerRow: 20,
        numRows: 3,
        totalItems: 60,
    },
};

// Module-level config that can be overridden
let config: AutoGridConfig = { ...DEFAULT_CONFIG };

/**
 * Set custom configuration
 */
export function setConfig(customConfig: Partial<AutoGridConfig>): void {
    config = { ...config, ...customConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): AutoGridConfig {
    return { ...config };
}

// ========================================
// Re-exported Functions (with config wrappers where needed)
// ========================================

/**
 * Detect the hotbar band region at the bottom of the screen
 */
export const detectHotbarBand = _detectHotbarBand;

/**
 * Detect item cell edges by finding rarity border colors
 */
export const detectRarityBorders = _detectRarityBorders;

/**
 * Calculate icon dimensions from detected cell edges
 * Uses module-level config by default
 */
export function calculateIconMetrics(
    cellEdges: CellEdge[],
    width: number,
    bandRegion: BandRegion
): IconMetrics {
    return _calculateIconMetrics(cellEdges, width, bandRegion, config);
}

/**
 * Build the final grid positions from detected metrics
 * Uses module-level config by default
 */
export function buildPreciseGrid(
    metrics: IconMetrics,
    bandRegion: BandRegion,
    width: number,
    height: number,
    cellEdges: CellEdge[]
): GridResult {
    return _buildPreciseGrid(metrics, bandRegion, width, height, cellEdges, config);
}

/**
 * Get default metrics based on resolution
 * Uses module-level config by default
 */
export function getDefaultMetrics(width: number, bandRegion: BandRegion): IconMetrics {
    return _getDefaultMetrics(width, bandRegion, config);
}

/**
 * Find the mode (most common value) with tolerance
 */
export const findMode = _findMode;

/**
 * Validate detected grid positions by checking cell contents
 */
export const validateGrid = _validateGrid;

/**
 * Calculate overall confidence score
 */
export const calculateOverallConfidence = _calculateOverallConfidence;

/**
 * Compare auto-detected calibration with a saved preset
 */
export const compareWithPreset = _compareWithPreset;

/**
 * Draw detection overlay on canvas for debugging
 */
export const drawDetectionOverlay = _drawDetectionOverlay;

// ========================================
// Main Auto-Detection Function
// ========================================

/**
 * Run full auto-detection pipeline
 */
export async function autoDetectGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: { progressCallback?: ProgressCallback } = {}
): Promise<AutoDetectionResult> {
    const startTime = Date.now();
    const { progressCallback } = options;

    try {
        // Pass 1: Detect hotbar band
        if (progressCallback) progressCallback(10, 'Detecting hotbar region...');
        const bandRegion = detectHotbarBand(ctx, width, height);

        // Pass 2: Detect rarity borders
        if (progressCallback) progressCallback(30, 'Finding item borders...');
        const borderResult = detectRarityBorders(ctx, width, bandRegion);

        // Pass 3: Calculate icon metrics
        if (progressCallback) progressCallback(50, 'Calculating icon sizes...');
        const metrics = calculateIconMetrics(borderResult.edges, width, bandRegion);

        // Pass 4: Build grid
        if (progressCallback) progressCallback(70, 'Building grid...');
        const gridResult = buildPreciseGrid(metrics, bandRegion, width, height, borderResult.edges);

        // Pass 5: Validate
        if (progressCallback) progressCallback(90, 'Validating cells...');
        const validation = validateGrid(ctx, gridResult.positions);

        // Pass 6: Empty screen detection
        // Icons smaller than 22px absolute are likely false positives from UI elements
        const minAbsoluteIconSize = 22;
        const iconsTooSmall = metrics.iconWidth < minAbsoluteIconSize || metrics.iconHeight < minAbsoluteIconSize;

        const isLikelyEmpty = bandRegion.confidence < 0.4 && borderResult.edges.length < 3 && metrics.isDefault;

        const hasInconsistentDetection =
            borderResult.edges.length >= 2 && metrics.confidence < 0.3 && validation.validCells.length < 3;

        // Collect failure reasons for UI display
        const failureReasons: FailureReason[] = [];
        if (iconsTooSmall) {
            failureReasons.push('icons_too_small');
        }
        if (isLikelyEmpty) {
            failureReasons.push('likely_empty_screen');
        }
        if (hasInconsistentDetection) {
            failureReasons.push('inconsistent_detection');
        }
        if (borderResult.edges.length === 0) {
            failureReasons.push('no_vertical_clusters');
        }

        if (isLikelyEmpty || hasInconsistentDetection || iconsTooSmall) {
            validation.validCells = [];
            validation.confidence = 0;
            validation.failureReasons = failureReasons;
        }

        const elapsed = Date.now() - startTime;

        if (progressCallback) progressCallback(100, 'Done!');

        return {
            success: true,
            bandRegion,
            borders: borderResult,
            metrics,
            grid: gridResult,
            validation,
            calibration: gridResult.calibration,
            elapsed,
            confidence: calculateOverallConfidence(bandRegion, metrics, validation),
            reasons: failureReasons.length > 0 ? failureReasons : null,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            reasons: ['exception_thrown'],
            calibration: null,
        };
    }
}

// ========================================
// Default Export
// ========================================

export default {
    autoDetectGrid,
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    buildPreciseGrid,
    validateGrid,
    compareWithPreset,
    drawDetectionOverlay,
    setConfig,
    getConfig,
};
