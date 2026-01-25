// ========================================
// Resolution-Adaptive Strategy Profiles
// ========================================
// Detection parameters optimized for different screen resolutions
// Handles scaling of UI elements, icon sizes, and detection thresholds

/**
 * Resolution tier based on vertical pixels
 */
export type ResolutionTier = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Common resolution presets with their display names
 */
export interface ResolutionInfo {
    width: number;
    height: number;
    name: string;
    tier: ResolutionTier;
    aspectRatio: string;
}

/**
 * Detection strategy profile for a resolution tier
 */
export interface StrategyProfile {
    /** Resolution tier this profile is for */
    tier: ResolutionTier;
    /** Display name */
    name: string;

    // Grid Detection
    /** Expected icon size in pixels */
    iconSize: { min: number; max: number; typical: number };
    /** Expected icon spacing in pixels */
    spacing: { min: number; max: number; typical: number };
    /** Maximum number of hotbar rows to detect */
    maxHotbarRows: number;
    /** Icons per row (typical) */
    iconsPerRow: { min: number; max: number; typical: number };

    // Template Matching
    /** Template scale factors to try */
    templateScales: number[];
    /** Minimum confidence threshold */
    minConfidence: number;
    /** NMS IoU threshold */
    nmsThreshold: number;

    // Cell Extraction
    /** Cell margin as percentage of icon size */
    cellMarginPercent: number;
    /** Border margin for rarity detection */
    borderMarginPercent: number;

    // Count Detection
    /** Expected count text height in pixels */
    countTextHeight: { min: number; max: number };
    /** Count text position relative to cell */
    countTextPosition: 'bottom-right' | 'bottom-center' | 'top-right';

    // Performance
    /** Skip every N pixels during scanning for speed */
    scanStep: number;
    /** Maximum cells to process in parallel */
    batchSize: number;
}

/**
 * Common resolution presets
 */
export const RESOLUTION_PRESETS: ResolutionInfo[] = [
    { width: 1280, height: 720, name: '720p', tier: 'low', aspectRatio: '16:9' },
    { width: 1366, height: 768, name: '768p', tier: 'low', aspectRatio: '16:9' },
    { width: 1600, height: 900, name: '900p', tier: 'medium', aspectRatio: '16:9' },
    { width: 1920, height: 1080, name: '1080p', tier: 'medium', aspectRatio: '16:9' },
    { width: 2560, height: 1440, name: '1440p', tier: 'high', aspectRatio: '16:9' },
    { width: 3840, height: 2160, name: '4K', tier: 'ultra', aspectRatio: '16:9' },
    // Ultrawide
    { width: 2560, height: 1080, name: '1080p UW', tier: 'medium', aspectRatio: '21:9' },
    { width: 3440, height: 1440, name: '1440p UW', tier: 'high', aspectRatio: '21:9' },
    // Mobile/Tablet
    { width: 1920, height: 1200, name: 'WUXGA', tier: 'medium', aspectRatio: '16:10' },
    { width: 2560, height: 1600, name: 'WQXGA', tier: 'high', aspectRatio: '16:10' },
];

/**
 * Strategy profile for low resolution (720p, 768p)
 * Icons are smaller, need more sensitive detection
 */
export const LOW_RES_PROFILE: StrategyProfile = {
    tier: 'low',
    name: 'Low Resolution (720p)',
    iconSize: { min: 28, max: 48, typical: 36 },
    spacing: { min: 2, max: 8, typical: 4 },
    maxHotbarRows: 2,
    iconsPerRow: { min: 6, max: 12, typical: 10 },
    templateScales: [0.75, 0.85, 1.0],
    minConfidence: 0.4,
    nmsThreshold: 0.35,
    cellMarginPercent: 8,
    borderMarginPercent: 6,
    countTextHeight: { min: 8, max: 14 },
    countTextPosition: 'bottom-right',
    scanStep: 1,
    batchSize: 20,
};

/**
 * Strategy profile for medium resolution (900p, 1080p)
 * Standard detection parameters
 */
export const MEDIUM_RES_PROFILE: StrategyProfile = {
    tier: 'medium',
    name: 'Medium Resolution (1080p)',
    iconSize: { min: 36, max: 64, typical: 48 },
    spacing: { min: 3, max: 10, typical: 5 },
    maxHotbarRows: 2,
    iconsPerRow: { min: 6, max: 12, typical: 10 },
    templateScales: [0.9, 1.0, 1.1],
    minConfidence: 0.45,
    nmsThreshold: 0.4,
    cellMarginPercent: 6,
    borderMarginPercent: 5,
    countTextHeight: { min: 10, max: 18 },
    countTextPosition: 'bottom-right',
    scanStep: 2,
    batchSize: 30,
};

/**
 * Strategy profile for high resolution (1440p)
 * Larger icons, can use faster scanning
 */
export const HIGH_RES_PROFILE: StrategyProfile = {
    tier: 'high',
    name: 'High Resolution (1440p)',
    iconSize: { min: 48, max: 80, typical: 64 },
    spacing: { min: 4, max: 12, typical: 7 },
    maxHotbarRows: 2,
    iconsPerRow: { min: 6, max: 12, typical: 10 },
    templateScales: [1.0, 1.15, 1.3],
    minConfidence: 0.45,
    nmsThreshold: 0.4,
    cellMarginPercent: 5,
    borderMarginPercent: 4,
    countTextHeight: { min: 14, max: 24 },
    countTextPosition: 'bottom-right',
    scanStep: 2,
    batchSize: 40,
};

/**
 * Strategy profile for ultra resolution (4K)
 * Very large icons, aggressive performance optimization
 */
export const ULTRA_RES_PROFILE: StrategyProfile = {
    tier: 'ultra',
    name: 'Ultra Resolution (4K)',
    iconSize: { min: 72, max: 128, typical: 96 },
    spacing: { min: 6, max: 16, typical: 10 },
    maxHotbarRows: 2,
    iconsPerRow: { min: 6, max: 12, typical: 10 },
    templateScales: [1.2, 1.5, 1.8],
    minConfidence: 0.45,
    nmsThreshold: 0.4,
    cellMarginPercent: 4,
    borderMarginPercent: 3,
    countTextHeight: { min: 20, max: 36 },
    countTextPosition: 'bottom-right',
    scanStep: 4,
    batchSize: 50,
};

/**
 * All profiles indexed by tier
 */
export const STRATEGY_PROFILES: Record<ResolutionTier, StrategyProfile> = {
    low: LOW_RES_PROFILE,
    medium: MEDIUM_RES_PROFILE,
    high: HIGH_RES_PROFILE,
    ultra: ULTRA_RES_PROFILE,
};

/**
 * Get resolution tier from image dimensions
 */
export function getResolutionTier(_width: number, height: number): ResolutionTier {
    if (height <= 800) return 'low';
    if (height <= 1200) return 'medium';
    if (height <= 1800) return 'high';
    return 'ultra';
}

/**
 * Get strategy profile for image dimensions
 */
export function getProfileForResolution(width: number, height: number): StrategyProfile {
    const tier = getResolutionTier(width, height);
    return STRATEGY_PROFILES[tier];
}

/**
 * Get the closest resolution preset for given dimensions
 */
export function getClosestPreset(width: number, height: number): ResolutionInfo | null {
    let closest: ResolutionInfo | null = null;
    let minDiff = Infinity;

    for (const preset of RESOLUTION_PRESETS) {
        const diff = Math.abs(preset.width - width) + Math.abs(preset.height - height);
        if (diff < minDiff) {
            minDiff = diff;
            closest = preset;
        }
    }

    return closest;
}

/**
 * Calculate scale factor from base resolution (720p)
 */
export function getScaleFromBase(height: number, baseHeight: number = 720): number {
    return height / baseHeight;
}

/**
 * Scale a value from base resolution to target resolution
 */
export function scaleValue(value: number, height: number, baseHeight: number = 720): number {
    return Math.round(value * getScaleFromBase(height, baseHeight));
}

/**
 * Get expected icon size for a resolution
 */
export function getExpectedIconSize(height: number): { min: number; max: number; typical: number } {
    const profile = getProfileForResolution(0, height);
    return profile.iconSize;
}

/**
 * Get expected cell stride (icon + spacing) for a resolution
 */
export function getExpectedCellStride(height: number): number {
    const profile = getProfileForResolution(0, height);
    return profile.iconSize.typical + profile.spacing.typical;
}

/**
 * Interpolate profile values for intermediate resolutions
 * Creates a smooth transition between resolution tiers
 */
export function interpolateProfile(width: number, height: number): StrategyProfile {
    const tier = getResolutionTier(width, height);
    const baseProfile = STRATEGY_PROFILES[tier];

    // For resolutions at tier boundaries, interpolate
    let nextTier: ResolutionTier | null = null;
    let blendFactor = 0;

    if (tier === 'low' && height > 700) {
        nextTier = 'medium';
        blendFactor = (height - 700) / 100; // Blend from 700 to 800
    } else if (tier === 'medium' && height > 1100) {
        nextTier = 'high';
        blendFactor = (height - 1100) / 100;
    } else if (tier === 'high' && height > 1700) {
        nextTier = 'ultra';
        blendFactor = (height - 1700) / 100;
    }

    if (!nextTier || blendFactor <= 0) {
        return baseProfile;
    }

    blendFactor = Math.min(1, blendFactor);
    const nextProfile = STRATEGY_PROFILES[nextTier];

    // Interpolate numeric values
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * blendFactor);

    return {
        ...baseProfile,
        tier: blendFactor > 0.5 ? nextTier : tier,
        iconSize: {
            min: lerp(baseProfile.iconSize.min, nextProfile.iconSize.min),
            max: lerp(baseProfile.iconSize.max, nextProfile.iconSize.max),
            typical: lerp(baseProfile.iconSize.typical, nextProfile.iconSize.typical),
        },
        spacing: {
            min: lerp(baseProfile.spacing.min, nextProfile.spacing.min),
            max: lerp(baseProfile.spacing.max, nextProfile.spacing.max),
            typical: lerp(baseProfile.spacing.typical, nextProfile.spacing.typical),
        },
        countTextHeight: {
            min: lerp(baseProfile.countTextHeight.min, nextProfile.countTextHeight.min),
            max: lerp(baseProfile.countTextHeight.max, nextProfile.countTextHeight.max),
        },
        cellMarginPercent:
            baseProfile.cellMarginPercent +
            (nextProfile.cellMarginPercent - baseProfile.cellMarginPercent) * blendFactor,
        borderMarginPercent:
            baseProfile.borderMarginPercent +
            (nextProfile.borderMarginPercent - baseProfile.borderMarginPercent) * blendFactor,
        minConfidence:
            baseProfile.minConfidence + (nextProfile.minConfidence - baseProfile.minConfidence) * blendFactor,
        scanStep: blendFactor > 0.5 ? nextProfile.scanStep : baseProfile.scanStep,
    };
}

/**
 * Get template scales optimized for this resolution
 */
export function getTemplateScales(height: number): number[] {
    const profile = getProfileForResolution(0, height);
    return profile.templateScales;
}

/**
 * Describe the resolution and profile for debugging
 */
export function describeResolution(width: number, height: number): string {
    const preset = getClosestPreset(width, height);
    const profile = getProfileForResolution(width, height);
    const scale = getScaleFromBase(height);

    return `Resolution: ${width}x${height} (${preset?.name ?? 'custom'})
Tier: ${profile.tier}
Scale from 720p: ${scale.toFixed(2)}x
Expected icon size: ${profile.iconSize.typical}px (${profile.iconSize.min}-${profile.iconSize.max})
Expected spacing: ${profile.spacing.typical}px
Count text height: ${profile.countTextHeight.min}-${profile.countTextHeight.max}px
Template scales: ${profile.templateScales.join(', ')}`;
}

/**
 * Validate that detected icon size is reasonable for resolution
 */
export function validateIconSize(detectedSize: number, height: number): boolean {
    const profile = getProfileForResolution(0, height);
    return detectedSize >= profile.iconSize.min * 0.8 && detectedSize <= profile.iconSize.max * 1.2;
}

/**
 * Get recommended scan region for hotbar detection
 */
export function getHotbarScanRegion(
    width: number,
    height: number
): {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
} {
    const profile = getProfileForResolution(width, height);
    const maxRowsHeight = profile.maxHotbarRows * (profile.iconSize.max + profile.spacing.max);

    // Hotbar is typically in bottom 15-25% of screen
    const bottomMargin = Math.round(height * 0.02); // 2% from bottom
    const topOfRegion = height - maxRowsHeight - bottomMargin;

    // Center 70% of width (avoid UI elements at edges)
    const sideMargin = Math.round(width * 0.15);

    return {
        xStart: sideMargin,
        xEnd: width - sideMargin,
        yStart: Math.max(Math.round(height * 0.7), topOfRegion),
        yEnd: height - bottomMargin,
    };
}

/**
 * Get recommended scan region for count text detection
 */
export function getCountTextRegion(
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    height: number
): { x: number; y: number; width: number; height: number } {
    const profile = getProfileForResolution(0, height);
    const textHeight = profile.countTextHeight.max;
    const textWidth = Math.round(cellWidth * 0.4); // Text is typically 40% of cell width

    switch (profile.countTextPosition) {
        case 'bottom-center':
            return {
                x: cellX + Math.round((cellWidth - textWidth) / 2),
                y: cellY + cellHeight - textHeight,
                width: textWidth,
                height: textHeight,
            };
        case 'top-right':
            return {
                x: cellX + cellWidth - textWidth,
                y: cellY,
                width: textWidth,
                height: textHeight,
            };
        case 'bottom-right':
        default:
            return {
                x: cellX + cellWidth - textWidth,
                y: cellY + cellHeight - textHeight,
                width: textWidth,
                height: textHeight,
            };
    }
}
