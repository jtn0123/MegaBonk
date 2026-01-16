// ========================================
// Computer Vision Type Definitions
// ========================================
// Types for image recognition, region detection, and debugging
// ========================================

import type { Item, Weapon, Tome, Character } from './index';

/**
 * Screen resolution presets for adaptive detection
 */
export type ResolutionPreset = '720p' | '1080p' | '1440p' | '4k' | 'steam_deck' | 'custom';

/**
 * Detection method used to identify an entity
 */
export type DetectionMethod = 'template_match' | 'icon_similarity' | 'ocr' | 'hybrid' | 'color_analysis';

/**
 * Entity type for detection results
 */
export type DetectableEntityType = 'item' | 'weapon' | 'tome' | 'character';

/**
 * Region types in game UI
 */
export type RegionType =
    | 'items_hotbar'
    | 'weapons_region'
    | 'tomes_region'
    | 'character_portrait'
    | 'stats_panel'
    | 'inventory'
    | 'unknown';

/**
 * Position and dimensions of a detected region
 */
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * A detected region of interest on screen
 */
export interface RegionOfInterest extends BoundingBox {
    type: RegionType;
    label?: string;
    confidence: number;
    slots?: SlotInfo[];
}

/**
 * Information about a single slot in a region
 */
export interface SlotInfo {
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    occupied: boolean;
    variance?: number;
    dominantColor?: string;
}

/**
 * Screen regions configuration for different UI states
 */
export interface ScreenRegions {
    /** Bottom hotbar where items appear */
    itemsHotbar: {
        baseY: number;
        centerX: number;
        slotSize: number;
        maxSlots: number;
        detectedSlots: number;
        margin: number;
        spacing: number;
    };

    /** Top-left weapons display (up to 4-5 weapons) */
    weaponsRegion: {
        x: number;
        y: number;
        rows: number;
        cols: number;
        slotSize: number;
        spacing: number;
    };

    /** Top-left tomes display below weapons (up to 4-5 tomes) */
    tomesRegion: {
        x: number;
        y: number;
        rows: number;
        cols: number;
        slotSize: number;
        spacing: number;
    };

    /** Character portrait location */
    characterPortrait: BoundingBox;

    /** Resolution info */
    resolution: {
        width: number;
        height: number;
        scale: number;
        preset: ResolutionPreset;
    };
}

/**
 * Result of detecting a single entity
 */
export interface CVDetectionResult {
    type: DetectableEntityType;
    entity: Item | Weapon | Tome | Character;
    confidence: number;
    position?: BoundingBox;
    method: DetectionMethod;
    rawScore?: number;
    matchedTemplate?: string;
    slotIndex?: number;
}

/**
 * Aggregated detection with quantity
 */
export interface AggregatedDetection extends CVDetectionResult {
    count: number;
    positions: BoundingBox[];
}

/**
 * Full detection result from analyzing an image
 */
export interface DetectionResults {
    items: CVDetectionResult[];
    weapons: CVDetectionResult[];
    tomes: CVDetectionResult[];
    character?: CVDetectionResult;
    regions: RegionOfInterest[];
    timestamp: number;
    processingTime: number;
    imageSize: { width: number; height: number };
    confidence: number;
}

/**
 * Template for icon matching
 */
export interface IconTemplate {
    id: string;
    name: string;
    type: DetectableEntityType;
    imageData?: ImageData;
    dataUrl?: string;
    width: number;
    height: number;
    dominantColors?: string[];
    loaded: boolean;
    lastUsed: number;
}

/**
 * Cache entry for detection results
 */
export interface DetectionCacheEntry {
    results: DetectionResults;
    imageHash: string;
    timestamp: number;
    ttl: number;
}

/**
 * Debug overlay region for visualization
 */
export interface DebugRegion extends BoundingBox {
    label: string;
    color: string;
    confidence?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillOpacity?: number;
}

/**
 * Debug visualization options
 */
export interface DebugOverlayOptions {
    showRegionBounds: boolean;
    showSlotGrid: boolean;
    showConfidenceLabels: boolean;
    showDetectionBoxes: boolean;
    showVarianceHeatmap: boolean;
    showDominantColors: boolean;
    regionColors: {
        items: string;
        weapons: string;
        tomes: string;
        character: string;
        unknown: string;
    };
    fontSize: number;
    lineWidth: number;
}

/**
 * Debug log entry
 */
export interface DebugLogEntry {
    timestamp: number;
    category: string;
    message: string;
    data?: unknown;
    level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Debug statistics for performance monitoring
 */
export interface DebugStats {
    totalDetections: number;
    successfulMatches: number;
    falsePositives: number;
    averageConfidence: number;
    averageProcessingTime: number;
    regionDetectionAccuracy: number;
    templateCacheHits: number;
    templateCacheMisses: number;
}

/**
 * Validation test case
 */
export interface ValidationTestCase {
    name: string;
    resolution: ResolutionPreset;
    width: number;
    height: number;
    expectedItems: string[];
    expectedWeapons: string[];
    expectedTomes: string[];
    expectedCharacter?: string;
    screenshotPath?: string;
    annotatedRegions?: RegionOfInterest[];
}

/**
 * Validation result
 */
export interface ValidationResult {
    testCase: ValidationTestCase;
    passed: boolean;
    matched: {
        items: string[];
        weapons: string[];
        tomes: string[];
        character?: string;
    };
    missed: {
        items: string[];
        weapons: string[];
        tomes: string[];
        character?: string;
    };
    falsePositives: {
        items: string[];
        weapons: string[];
        tomes: string[];
    };
    accuracy: {
        items: number;
        weapons: number;
        tomes: number;
        overall: number;
    };
    regionAccuracy: number;
    processingTime: number;
}

/**
 * Color analysis result
 */
export interface ColorAnalysis {
    dominantColors: Array<{
        color: string;
        percentage: number;
        rgb: { r: number; g: number; b: number };
    }>;
    averageColor: string;
    brightness: number;
    contrast: number;
    saturation: number;
}

/**
 * Image preprocessing options
 */
export interface PreprocessingOptions {
    grayscale: boolean;
    threshold?: number;
    blur?: number;
    sharpen?: boolean;
    contrast?: number;
    brightness?: number;
    resize?: { width: number; height: number };
}

/**
 * Callback for detection progress
 */
export type DetectionProgressCallback = (
    stage: 'loading' | 'preprocessing' | 'region_detection' | 'template_matching' | 'postprocessing' | 'complete',
    progress: number,
    message?: string
) => void;

/**
 * Configuration for the CV module
 */
export interface CVConfig {
    /** Minimum confidence threshold for detections (0-1) */
    minConfidence: number;
    /** Maximum templates to keep in memory */
    maxCachedTemplates: number;
    /** Cache TTL in milliseconds */
    cacheTTL: number;
    /** Enable debug mode */
    debugMode: boolean;
    /** Variance threshold for empty slot detection */
    emptySlotVarianceThreshold: number;
    /** Non-max suppression overlap threshold */
    nmsOverlapThreshold: number;
    /** Enable hybrid detection (template + OCR) */
    hybridDetection: boolean;
}

/**
 * Default CV configuration
 */
export const DEFAULT_CV_CONFIG: CVConfig = {
    minConfidence: 0.7,
    maxCachedTemplates: 200,
    cacheTTL: 15 * 60 * 1000, // 15 minutes
    debugMode: false,
    emptySlotVarianceThreshold: 30,
    nmsOverlapThreshold: 0.5,
    hybridDetection: true,
};
