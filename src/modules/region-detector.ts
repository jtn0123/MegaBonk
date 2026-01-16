// ========================================
// Region Detector Module
// ========================================
// Adaptive region detection for different screen resolutions
// Handles variable UI layouts and item counts
// ========================================

import type {
    ScreenRegions,
    RegionOfInterest,
    SlotInfo,
    BoundingBox,
    ResolutionPreset,
    CVConfig,
} from '../types/computer-vision';
import { DEFAULT_CV_CONFIG } from '../types/computer-vision';

// ========================================
// Resolution Configuration
// ========================================

interface ResolutionConfig {
    preset: ResolutionPreset;
    width: number;
    height: number;
    iconSize: number;
    spacing: number;
    marginX: number;
    marginY: number;
}

const RESOLUTION_CONFIGS: Record<ResolutionPreset, Omit<ResolutionConfig, 'preset'>> = {
    '720p': { width: 1280, height: 720, iconSize: 38, spacing: 4, marginX: 40, marginY: 20 },
    '1080p': { width: 1920, height: 1080, iconSize: 45, spacing: 5, marginX: 50, marginY: 25 },
    '1440p': { width: 2560, height: 1440, iconSize: 55, spacing: 6, marginX: 60, marginY: 30 },
    '4k': { width: 3840, height: 2160, iconSize: 70, spacing: 8, marginX: 80, marginY: 40 },
    steam_deck: { width: 1280, height: 800, iconSize: 40, spacing: 4, marginX: 45, marginY: 22 },
    custom: { width: 1920, height: 1080, iconSize: 45, spacing: 5, marginX: 50, marginY: 25 },
};

// ========================================
// Region Detection Configuration
// ========================================

/** Hotbar position as percentage from top of screen */
const HOTBAR_Y_PERCENT_MIN = 0.85;
const HOTBAR_Y_PERCENT_MAX = 0.95;

/** Top-left region bounds as percentage */
const TOP_LEFT_X_PERCENT = 0.15;
const TOP_LEFT_Y_PERCENT = 0.2;

/** Max slots for each region */
const MAX_ITEMS_SLOTS = 12;
const MAX_WEAPONS_SLOTS = 5;
const MAX_TOMES_SLOTS = 5;

// ========================================
// Module State
// ========================================

let config: CVConfig = { ...DEFAULT_CV_CONFIG };
let debugMode = false;

// ========================================
// Initialization
// ========================================

/**
 * Initialize the region detector with configuration
 */
export function initRegionDetector(cvConfig?: Partial<CVConfig>): void {
    if (cvConfig) {
        config = { ...DEFAULT_CV_CONFIG, ...cvConfig };
    }
    debugMode = config.debugMode;
    debugLog('init', 'Region detector initialized', { config });
}

/**
 * Set debug mode
 */
export function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    debugLog('config', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

// ========================================
// Resolution Detection
// ========================================

/**
 * Detect resolution preset from image dimensions
 */
export function detectResolutionPreset(width: number, height: number): ResolutionPreset {
    // Check exact matches first
    for (const [preset, cfg] of Object.entries(RESOLUTION_CONFIGS)) {
        if (cfg.width === width && cfg.height === height) {
            return preset as ResolutionPreset;
        }
    }

    // Find closest match by aspect ratio and size
    const aspectRatio = width / height;
    let closestPreset: ResolutionPreset = '1080p';
    let closestDiff = Infinity;

    for (const [preset, cfg] of Object.entries(RESOLUTION_CONFIGS)) {
        const presetAspect = cfg.width / cfg.height;
        const aspectDiff = Math.abs(aspectRatio - presetAspect);
        const sizeDiff = Math.abs(width - cfg.width) + Math.abs(height - cfg.height);
        const totalDiff = aspectDiff * 1000 + sizeDiff;

        if (totalDiff < closestDiff) {
            closestDiff = totalDiff;
            closestPreset = preset as ResolutionPreset;
        }
    }

    debugLog('resolution', `Detected resolution preset: ${closestPreset}`, { width, height, aspectRatio });
    return closestPreset;
}

/**
 * Get resolution configuration for given dimensions
 */
export function getResolutionConfig(width: number, height: number): ResolutionConfig {
    const preset = detectResolutionPreset(width, height);
    const baseConfig = RESOLUTION_CONFIGS[preset];

    // Scale configuration if dimensions don't match exactly
    const scale = Math.min(width / baseConfig.width, height / baseConfig.height);

    return {
        preset,
        width,
        height,
        iconSize: Math.round(baseConfig.iconSize * scale),
        spacing: Math.round(baseConfig.spacing * scale),
        marginX: Math.round(baseConfig.marginX * scale),
        marginY: Math.round(baseConfig.marginY * scale),
    };
}

// ========================================
// Screen Region Detection
// ========================================

/**
 * Detect all screen regions for a given image size
 */
export function detectScreenRegions(width: number, height: number): ScreenRegions {
    const resConfig = getResolutionConfig(width, height);
    const scale = height / 1080; // Normalize to 1080p baseline

    debugLog('regions', 'Calculating screen regions', { width, height, scale });

    // Items hotbar at bottom of screen
    const itemsHotbar = {
        baseY: Math.round(height * 0.88), // 88% down from top
        centerX: Math.round(width / 2),
        slotSize: resConfig.iconSize,
        maxSlots: MAX_ITEMS_SLOTS,
        detectedSlots: 0, // Will be set during detection
        margin: resConfig.marginX,
        spacing: resConfig.spacing,
    };

    // Weapons region - top left
    const weaponsRegion = {
        x: resConfig.marginX,
        y: resConfig.marginY,
        rows: 1,
        cols: MAX_WEAPONS_SLOTS,
        slotSize: Math.round(resConfig.iconSize * 1.1), // Slightly larger
        spacing: resConfig.spacing,
    };

    // Tomes region - below weapons
    const tomesRegion = {
        x: resConfig.marginX,
        y: weaponsRegion.y + weaponsRegion.slotSize + resConfig.spacing * 2 + 20,
        rows: 1,
        cols: MAX_TOMES_SLOTS,
        slotSize: Math.round(resConfig.iconSize * 1.1),
        spacing: resConfig.spacing,
    };

    // Character portrait - usually top right or center top
    const characterPortrait: BoundingBox = {
        x: Math.round(width / 2 - resConfig.iconSize),
        y: resConfig.marginY,
        width: Math.round(resConfig.iconSize * 2),
        height: Math.round(resConfig.iconSize * 2),
    };

    const regions: ScreenRegions = {
        itemsHotbar,
        weaponsRegion,
        tomesRegion,
        characterPortrait,
        resolution: {
            width,
            height,
            scale,
            preset: resConfig.preset,
        },
    };

    debugLog('regions', 'Screen regions calculated', regions);
    return regions;
}

// ========================================
// Slot Detection
// ========================================

/**
 * Generate slot positions for the items hotbar
 */
export function generateHotbarSlots(regions: ScreenRegions): SlotInfo[] {
    const { itemsHotbar } = regions;
    const slots: SlotInfo[] = [];

    // Calculate total width of all slots
    const totalSlotWidth = itemsHotbar.maxSlots * itemsHotbar.slotSize;
    const totalSpacing = (itemsHotbar.maxSlots - 1) * itemsHotbar.spacing;
    const totalWidth = totalSlotWidth + totalSpacing;

    // Start position (centered)
    const startX = itemsHotbar.centerX - totalWidth / 2;

    for (let i = 0; i < itemsHotbar.maxSlots; i++) {
        const x = startX + i * (itemsHotbar.slotSize + itemsHotbar.spacing);
        slots.push({
            index: i,
            x: Math.round(x),
            y: itemsHotbar.baseY,
            width: itemsHotbar.slotSize,
            height: itemsHotbar.slotSize,
            occupied: false, // Will be determined during detection
        });
    }

    debugLog('slots', `Generated ${slots.length} hotbar slots`, { startX, totalWidth });
    return slots;
}

/**
 * Generate slot positions for weapons region
 */
export function generateWeaponSlots(regions: ScreenRegions): SlotInfo[] {
    const { weaponsRegion } = regions;
    const slots: SlotInfo[] = [];

    for (let row = 0; row < weaponsRegion.rows; row++) {
        for (let col = 0; col < weaponsRegion.cols; col++) {
            const index = row * weaponsRegion.cols + col;
            slots.push({
                index,
                x: weaponsRegion.x + col * (weaponsRegion.slotSize + weaponsRegion.spacing),
                y: weaponsRegion.y + row * (weaponsRegion.slotSize + weaponsRegion.spacing),
                width: weaponsRegion.slotSize,
                height: weaponsRegion.slotSize,
                occupied: false,
            });
        }
    }

    debugLog('slots', `Generated ${slots.length} weapon slots`);
    return slots;
}

/**
 * Generate slot positions for tomes region
 */
export function generateTomeSlots(regions: ScreenRegions): SlotInfo[] {
    const { tomesRegion } = regions;
    const slots: SlotInfo[] = [];

    for (let row = 0; row < tomesRegion.rows; row++) {
        for (let col = 0; col < tomesRegion.cols; col++) {
            const index = row * tomesRegion.cols + col;
            slots.push({
                index,
                x: tomesRegion.x + col * (tomesRegion.slotSize + tomesRegion.spacing),
                y: tomesRegion.y + row * (tomesRegion.slotSize + tomesRegion.spacing),
                width: tomesRegion.slotSize,
                height: tomesRegion.slotSize,
                occupied: false,
            });
        }
    }

    debugLog('slots', `Generated ${slots.length} tome slots`);
    return slots;
}

// ========================================
// Slot Occupancy Detection
// ========================================

/**
 * Calculate pixel variance in a region to detect if slot is occupied
 */
export function calculateRegionVariance(
    imageData: ImageData,
    x: number,
    y: number,
    width: number,
    height: number
): number {
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // Clamp bounds to image
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(imageData.width, Math.floor(x + width));
    const endY = Math.min(imageData.height, Math.floor(y + height));

    for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
            const idx = (py * imageData.width + px) * 4;
            // Convert to grayscale
            const gray =
                ((imageData.data[idx] ?? 0) + (imageData.data[idx + 1] ?? 0) + (imageData.data[idx + 2] ?? 0)) / 3;
            sum += gray;
            sumSq += gray * gray;
            count++;
        }
    }

    if (count === 0) return 0;

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance;
}

/**
 * Detect which slots are occupied based on pixel variance
 */
export function detectOccupiedSlots(
    imageData: ImageData,
    slots: SlotInfo[],
    varianceThreshold: number = config.emptySlotVarianceThreshold
): SlotInfo[] {
    return slots.map(slot => {
        const variance = calculateRegionVariance(imageData, slot.x, slot.y, slot.width, slot.height);

        const occupied = variance > varianceThreshold;

        debugLog('variance', `Slot ${slot.index}: variance=${variance.toFixed(2)}, occupied=${occupied}`);

        return {
            ...slot,
            variance,
            occupied,
        };
    });
}

/**
 * Count occupied slots in a region
 */
export function countOccupiedSlots(slots: SlotInfo[]): number {
    return slots.filter(slot => slot.occupied).length;
}

// ========================================
// Region of Interest Conversion
// ========================================

/**
 * Convert screen regions to regions of interest for detection
 */
export function getRegionsOfInterest(regions: ScreenRegions): RegionOfInterest[] {
    const rois: RegionOfInterest[] = [];

    // Items hotbar
    const hotbarSlots = generateHotbarSlots(regions);
    const totalHotbarWidth =
        hotbarSlots.length > 0
            ? (hotbarSlots[hotbarSlots.length - 1]?.x ?? 0) + (hotbarSlots[0]?.width ?? 0) - (hotbarSlots[0]?.x ?? 0)
            : 0;

    rois.push({
        type: 'items_hotbar',
        label: 'Items Hotbar',
        x: hotbarSlots[0]?.x ?? 0,
        y: regions.itemsHotbar.baseY,
        width: totalHotbarWidth,
        height: regions.itemsHotbar.slotSize,
        confidence: 0.9,
        slots: hotbarSlots,
    });

    // Weapons region
    const weaponSlots = generateWeaponSlots(regions);
    rois.push({
        type: 'weapons_region',
        label: 'Weapons',
        x: regions.weaponsRegion.x,
        y: regions.weaponsRegion.y,
        width:
            regions.weaponsRegion.cols * regions.weaponsRegion.slotSize +
            (regions.weaponsRegion.cols - 1) * regions.weaponsRegion.spacing,
        height:
            regions.weaponsRegion.rows * regions.weaponsRegion.slotSize +
            (regions.weaponsRegion.rows - 1) * regions.weaponsRegion.spacing,
        confidence: 0.9,
        slots: weaponSlots,
    });

    // Tomes region
    const tomeSlots = generateTomeSlots(regions);
    rois.push({
        type: 'tomes_region',
        label: 'Tomes',
        x: regions.tomesRegion.x,
        y: regions.tomesRegion.y,
        width:
            regions.tomesRegion.cols * regions.tomesRegion.slotSize +
            (regions.tomesRegion.cols - 1) * regions.tomesRegion.spacing,
        height:
            regions.tomesRegion.rows * regions.tomesRegion.slotSize +
            (regions.tomesRegion.rows - 1) * regions.tomesRegion.spacing,
        confidence: 0.9,
        slots: tomeSlots,
    });

    // Character portrait
    rois.push({
        type: 'character_portrait',
        label: 'Character',
        ...regions.characterPortrait,
        confidence: 0.85,
    });

    return rois;
}

// ========================================
// Adaptive Region Adjustment
// ========================================

/**
 * Adjust regions based on detected content
 * This handles cases where UI changes based on item count
 */
export function adjustRegionsForContent(
    regions: ScreenRegions,
    imageData: ImageData,
    detectedItemCount?: number
): ScreenRegions {
    // If we know the item count, adjust hotbar width
    if (detectedItemCount !== undefined && detectedItemCount > 0) {
        const adjustedRegions = { ...regions };
        adjustedRegions.itemsHotbar = {
            ...regions.itemsHotbar,
            detectedSlots: Math.min(detectedItemCount, MAX_ITEMS_SLOTS),
        };

        debugLog('adjust', `Adjusted hotbar for ${detectedItemCount} items`);
        return adjustedRegions;
    }

    // Otherwise, detect occupied slots to determine actual count
    const hotbarSlots = generateHotbarSlots(regions);
    const occupiedSlots = detectOccupiedSlots(imageData, hotbarSlots);
    const occupiedCount = countOccupiedSlots(occupiedSlots);

    const adjustedRegions = { ...regions };
    adjustedRegions.itemsHotbar = {
        ...regions.itemsHotbar,
        detectedSlots: occupiedCount,
    };

    debugLog('adjust', `Detected ${occupiedCount} occupied hotbar slots`);
    return adjustedRegions;
}

// ========================================
// Validation Helpers
// ========================================

/**
 * Validate that detected regions are within expected bounds
 */
export function validateRegions(regions: ScreenRegions): {
    valid: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    const { width, height } = regions.resolution;

    // Check hotbar is in bottom portion
    if (regions.itemsHotbar.baseY < height * HOTBAR_Y_PERCENT_MIN) {
        issues.push(
            `Hotbar Y (${regions.itemsHotbar.baseY}) is above expected minimum (${height * HOTBAR_Y_PERCENT_MIN})`
        );
    }
    if (regions.itemsHotbar.baseY > height * HOTBAR_Y_PERCENT_MAX) {
        issues.push(
            `Hotbar Y (${regions.itemsHotbar.baseY}) is below expected maximum (${height * HOTBAR_Y_PERCENT_MAX})`
        );
    }

    // Check weapons/tomes are in top-left
    if (regions.weaponsRegion.x > width * TOP_LEFT_X_PERCENT) {
        issues.push(`Weapons X (${regions.weaponsRegion.x}) is beyond expected left boundary`);
    }
    if (regions.weaponsRegion.y > height * TOP_LEFT_Y_PERCENT) {
        issues.push(`Weapons Y (${regions.weaponsRegion.y}) is below expected top boundary`);
    }

    // Check slot sizes are reasonable
    if (regions.itemsHotbar.slotSize < 20 || regions.itemsHotbar.slotSize > 100) {
        issues.push(`Hotbar slot size (${regions.itemsHotbar.slotSize}) is outside reasonable range`);
    }

    debugLog('validate', `Region validation: ${issues.length === 0 ? 'passed' : 'failed'}`, { issues });

    return {
        valid: issues.length === 0,
        issues,
    };
}

/**
 * Check if a point is within a region
 */
export function isPointInRegion(x: number, y: number, region: BoundingBox): boolean {
    return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
}

/**
 * Calculate overlap between two regions
 */
export function calculateRegionOverlap(a: BoundingBox, b: BoundingBox): number {
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlapArea = xOverlap * yOverlap;
    const aArea = a.width * a.height;
    const bArea = b.width * b.height;
    const minArea = Math.min(aArea, bArea);

    return minArea > 0 ? overlapArea / minArea : 0;
}

// ========================================
// Debug Logging
// ========================================

const debugLogs: Array<{ timestamp: number; category: string; message: string; data?: unknown }> = [];

function debugLog(category: string, message: string, data?: unknown): void {
    if (!debugMode) return;

    const entry = {
        timestamp: Date.now(),
        category,
        message,
        data,
    };
    debugLogs.push(entry);

    // Keep only last 1000 entries
    if (debugLogs.length > 1000) {
        debugLogs.shift();
    }

    console.groupCollapsed(`[RegionDetector:${category}] ${message}`);
    if (data) {
        console.table(data);
    }
    console.groupEnd();
}

/**
 * Get debug logs
 */
export function getDebugLogs(): typeof debugLogs {
    return [...debugLogs];
}

/**
 * Clear debug logs
 */
export function clearDebugLogs(): void {
    debugLogs.length = 0;
}

// ========================================
// Exports for Testing
// ========================================

export const __testing = {
    RESOLUTION_CONFIGS,
    HOTBAR_Y_PERCENT_MIN,
    HOTBAR_Y_PERCENT_MAX,
    TOP_LEFT_X_PERCENT,
    TOP_LEFT_Y_PERCENT,
    MAX_ITEMS_SLOTS,
    MAX_WEAPONS_SLOTS,
    MAX_TOMES_SLOTS,
};
