// ========================================
// Cell Extraction Margin Configuration
// ========================================
// Configurable margins for cell content extraction
// Based on ablation testing showing current 20% margin may be suboptimal

/**
 * Margin configuration for different rarities
 * Legendary items have thicker gold borders, need larger margins
 */
export interface RarityMargins {
    /** Common items - gray border, thinnest */
    common: number;
    /** Uncommon items - green border */
    uncommon: number;
    /** Rare items - blue border */
    rare: number;
    /** Epic items - purple border */
    epic: number;
    /** Legendary items - gold/orange border, thickest */
    legendary: number;
    /** Default when rarity unknown */
    unknown: number;
}

/**
 * Resolution-specific margin adjustments
 */
export interface ResolutionConfig {
    /** Minimum resolution (e.g., 720p) */
    minWidth: number;
    /** Maximum resolution */
    maxWidth: number;
    /** Margin multiplier for this resolution range */
    marginMultiplier: number;
}

/**
 * Complete margin configuration
 */
export interface MarginConfig {
    /** Base margin as fraction of cell width (0-0.5) */
    baseCellMargin: number;
    /** Base margin for templates (0-0.5) */
    baseTemplateMargin: number;
    /** Per-rarity margin adjustments (added to base) */
    rarityAdjustments: RarityMargins;
    /** Resolution-specific adjustments */
    resolutionConfigs: ResolutionConfig[];
}

/**
 * Default margin configuration
 * Based on testing with various game screenshots
 */
export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
    // Current baseline: 20% cell margin, 15% template margin
    baseCellMargin: 0.18, // Slightly reduced from 0.20
    baseTemplateMargin: 0.15,

    // Per-rarity adjustments - legendary borders are noticeably thicker
    rarityAdjustments: {
        common: -0.02, // Thin gray borders, reduce margin
        uncommon: -0.01, // Green borders, slightly thinner
        rare: 0.0, // Blue borders, baseline
        epic: 0.01, // Purple borders, slightly thicker
        legendary: 0.03, // Gold borders, significantly thicker
        unknown: 0.0, // Use baseline for unknown
    },

    // Resolution adjustments - smaller screens have proportionally thicker borders
    resolutionConfigs: [
        { minWidth: 0, maxWidth: 1280, marginMultiplier: 1.1 }, // 720p/800p
        { minWidth: 1280, maxWidth: 1920, marginMultiplier: 1.0 }, // 1080p (baseline)
        { minWidth: 1920, maxWidth: 2560, marginMultiplier: 0.95 }, // 1440p
        { minWidth: 2560, maxWidth: 9999, marginMultiplier: 0.9 }, // 4K
    ],
};

/**
 * Optimized margin configuration (more aggressive tuning)
 */
export const OPTIMIZED_MARGIN_CONFIG: MarginConfig = {
    baseCellMargin: 0.16, // More aggressive center extraction
    baseTemplateMargin: 0.12, // More aggressive template center

    rarityAdjustments: {
        common: -0.03,
        uncommon: -0.02,
        rare: 0.0,
        epic: 0.02,
        legendary: 0.04,
        unknown: 0.0,
    },

    resolutionConfigs: [
        { minWidth: 0, maxWidth: 1280, marginMultiplier: 1.15 },
        { minWidth: 1280, maxWidth: 1920, marginMultiplier: 1.0 },
        { minWidth: 1920, maxWidth: 2560, marginMultiplier: 0.92 },
        { minWidth: 2560, maxWidth: 9999, marginMultiplier: 0.85 },
    ],
};

/**
 * Conservative margin configuration (safer, less prone to cutting content)
 */
export const CONSERVATIVE_MARGIN_CONFIG: MarginConfig = {
    baseCellMargin: 0.22,
    baseTemplateMargin: 0.18,

    rarityAdjustments: {
        common: -0.01,
        uncommon: 0.0,
        rare: 0.01,
        epic: 0.02,
        legendary: 0.04,
        unknown: 0.01,
    },

    resolutionConfigs: [
        { minWidth: 0, maxWidth: 1280, marginMultiplier: 1.05 },
        { minWidth: 1280, maxWidth: 1920, marginMultiplier: 1.0 },
        { minWidth: 1920, maxWidth: 2560, marginMultiplier: 0.98 },
        { minWidth: 2560, maxWidth: 9999, marginMultiplier: 0.95 },
    ],
};

// Active configuration
let activeConfig: MarginConfig = DEFAULT_MARGIN_CONFIG;

/**
 * Set the active margin configuration
 */
export function setMarginConfig(config: MarginConfig): void {
    activeConfig = config;
}

/**
 * Get the current margin configuration
 */
export function getMarginConfig(): MarginConfig {
    return activeConfig;
}

/**
 * Calculate cell margin for a specific context
 */
export function calculateCellMargin(cellWidth: number, rarity?: string, imageWidth?: number): number {
    const config = activeConfig;

    // Base margin
    let margin = config.baseCellMargin;

    // Rarity adjustment
    if (rarity) {
        const rarityKey = rarity.toLowerCase() as keyof RarityMargins;
        margin += config.rarityAdjustments[rarityKey] ?? config.rarityAdjustments.unknown;
    }

    // Resolution adjustment
    if (imageWidth) {
        const resConfig = config.resolutionConfigs.find(rc => imageWidth >= rc.minWidth && imageWidth < rc.maxWidth);
        if (resConfig) {
            margin *= resConfig.marginMultiplier;
        }
    }

    // Clamp to safe range (5% - 40%)
    margin = Math.max(0.05, Math.min(0.4, margin));

    return Math.round(cellWidth * margin);
}

/**
 * Calculate template margin for a specific context
 */
export function calculateTemplateMargin(templateSize: number, rarity?: string): number {
    const config = activeConfig;

    // Base margin
    let margin = config.baseTemplateMargin;

    // Rarity adjustment (same as cell)
    if (rarity) {
        const rarityKey = rarity.toLowerCase() as keyof RarityMargins;
        margin += config.rarityAdjustments[rarityKey] ?? config.rarityAdjustments.unknown;
    }

    // Clamp to safe range
    margin = Math.max(0.05, Math.min(0.35, margin));

    return Math.round(templateSize * margin);
}

/**
 * Get margin description for debugging
 */
export function describeMargins(cellWidth: number, rarity?: string, imageWidth?: number): string {
    const cellMargin = calculateCellMargin(cellWidth, rarity, imageWidth);
    const cellMarginPct = ((cellMargin / cellWidth) * 100).toFixed(1);

    return `Cell margin: ${cellMargin}px (${cellMarginPct}%), Rarity: ${rarity || 'unknown'}`;
}
