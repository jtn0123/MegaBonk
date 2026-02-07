// ========================================
// Grid Types - Shared Type Definitions
// Used by auto-grid-detection and sub-modules
// ========================================

/**
 * Configuration for auto-grid detection
 */
export interface AutoGridConfig {
    /** Base resolution for calibration (default: 720) */
    baseResolution: number;
    /** Maximum rows to detect in hotbar (default: 2) */
    maxDetectedRows: number;
    /** Default calibration values */
    defaultCalibration: GridCalibration;
}

/**
 * Grid calibration parameters (base resolution values)
 */
export interface GridCalibration {
    xOffset: number;
    yOffset: number;
    iconWidth: number;
    iconHeight: number;
    xSpacing: number;
    ySpacing: number;
    iconsPerRow: number;
    numRows: number;
    totalItems?: number;
}

/**
 * Strip analysis data for hotbar detection
 */
export interface StripData {
    y: number;
    avgBrightness: number;
    avgVariance: number;
    colorfulRatio: number;
    rarityRatio: number;
}

/**
 * Band region where hotbar is located
 */
export interface BandRegion {
    topY: number;
    bottomY: number;
    height: number;
    confidence: number;
    debug?: {
        stripData: StripData[];
        bestScore: number;
    };
}

/**
 * Detected cell edge
 */
export interface CellEdge {
    x: number;
    borderWidth: number;
    rarity: string;
    confidence: number;
    detections: number;
    verticalConsistency: number;
}

/**
 * Raw edge detection from a scan line
 */
export interface RawEdge {
    x: number;
    endX: number;
    y: number;
    width: number;
    rarity: string;
    type: 'left';
}

/**
 * Border detection result
 */
export interface BorderResult {
    edges: CellEdge[];
    allEdges: RawEdge[];
    colorCounts: Record<string, number>;
    dominantColors: string[];
}

/**
 * Icon metrics calculated from detected edges
 */
export interface IconMetrics {
    iconWidth: number;
    iconHeight: number;
    xSpacing: number;
    ySpacing: number;
    cellStride: number;
    borderWidth: number;
    confidence: number;
    detectedCells: number;
    firstCellX: number | null;
    centerOffset: number;
    isDefault?: boolean;
    debug?: {
        gaps: number[];
        gapMode: number;
    };
}

/**
 * Grid cell position
 */
export interface GridPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    row: number;
    col: number;
    slotIndex: number;
}

/**
 * Grid building result
 */
export interface GridResult {
    positions: GridPosition[];
    calibration: GridCalibration;
    debug: {
        startX: number;
        firstRowY: number;
        cellStride: number;
        scale: number;
    };
}

/**
 * Cell validation result
 */
export interface CellValidation {
    isEmpty: boolean;
    isSuspicious: boolean;
    meanBrightness: number;
    totalVariance: number;
    colorfulRatio: number;
}

/**
 * Validated cell with position
 */
export interface ValidatedCell extends GridPosition {
    validation: CellValidation;
}

/**
 * Grid validation result
 */
export interface ValidationResult {
    validCells: ValidatedCell[];
    emptyCells: ValidatedCell[];
    suspiciousCells: ValidatedCell[];
    totalCells: number;
    confidence: number;
    stats: {
        valid: number;
        empty: number;
        suspicious: number;
    };
    failureReasons?: string[];
}

/**
 * Failure reason codes for auto-detection
 */
export type FailureReason =
    | 'icons_too_small'
    | 'likely_empty_screen'
    | 'inconsistent_detection'
    | 'no_vertical_clusters'
    | 'exception_thrown';

/**
 * Complete auto-detection result
 */
export interface AutoDetectionResult {
    success: boolean;
    bandRegion?: BandRegion;
    borders?: BorderResult;
    metrics?: IconMetrics;
    grid?: GridResult;
    validation?: ValidationResult;
    calibration: GridCalibration | null;
    elapsed?: number;
    confidence?: number;
    reasons?: FailureReason[] | null;
    error?: string;
}

/**
 * Field comparison result
 */
export interface FieldComparison {
    auto: number;
    preset: number;
    diff: number;
    isClose: boolean;
}

/**
 * Preset comparison result
 */
export interface PresetComparison {
    fields: Record<string, FieldComparison>;
    matchScore: number;
    totalDiff: number;
    recommendation: string;
}

/**
 * Progress callback for tracking detection stages
 */
export type ProgressCallback = (percent: number, message: string) => void;
