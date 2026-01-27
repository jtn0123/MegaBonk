/* ========================================
 * CV Validator - Configuration
 * Constants, magic numbers, defaults
 * ======================================== */

export const CONFIG = {
    // Base resolution for calibration (720p)
    BASE_RESOLUTION: 720,

    // Default grid calibration values
    DEFAULT_CALIBRATION: {
        xOffset: 0,
        yOffset: 0,
        iconWidth: 40,
        iconHeight: 40,
        xSpacing: 4,
        ySpacing: 4,
        iconsPerRow: 20,
        numRows: 3,
        totalItems: 60, // 0 = no limit, use iconsPerRow * numRows
    },

    // Auto-detection settings
    // Maximum rows to detect in hotbar (MegaBonk typically has 1-2 rows)
    maxDetectedRows: 2,

    // Detection settings
    DEFAULT_THRESHOLD: 0.45,
    MIN_THRESHOLD: 0.3,
    MAX_THRESHOLD: 0.9,
    THRESHOLD_STEP: 0.01,

    // Grid position parameters
    ITEM_BAR_BOTTOM_PERCENT: 0.98,
    MIN_ROW_HEIGHT_PERCENT: 0.5,

    // Empty cell detection
    // Lower variance threshold (was 500) - only truly uniform cells are empty
    EMPTY_CELL_VARIANCE_THRESHOLD: 250,
    EMPTY_CELL_MEAN_THRESHOLD: 40,
    // Edge density: cells with < 3% edges are likely empty backgrounds
    EMPTY_CELL_EDGE_THRESHOLD: 0.03,
    // Inventory background color (dark brown-gray)
    INVENTORY_BG_COLOR: { r: 40, g: 35, b: 30, tolerance: 25 },
    // Inventory fill pattern: after N consecutive empties, assume row is done
    CONSECUTIVE_EMPTY_THRESHOLD: 3,
    // High confidence override: don't skip cells with strong matches
    HIGH_CONFIDENCE_OVERRIDE: 0.7,

    // Template matching
    TEMPLATE_MARGIN_PERCENT: 0.15,
    TOP_MATCHES_COUNT: 5,

    // UI constants
    SLOT_BADGE_SIZE: { w: 16, h: 12 },
    LABEL_HEIGHT: 16,
    MODAL_LABEL_HEIGHT: 18,

    // Search/filter limits
    CORRECTION_RESULTS_LIMIT: 50,

    // Slider ranges
    SLIDERS: {
        xOffset: { min: -200, max: 200, step: 1, default: 0 },
        yOffset: { min: -100, max: 100, step: 5, default: 0 },
        iconWidth: { min: 20, max: 80, step: 1, default: 40 },
        iconHeight: { min: 20, max: 80, step: 1, default: 40 },
        xSpacing: { min: 0, max: 20, step: 1, default: 4 },
        ySpacing: { min: 0, max: 40, step: 1, default: 4 },
        iconsPerRow: { min: 10, max: 30, step: 1, default: 20 },
        numRows: { min: 1, max: 5, step: 1, default: 3 },
    },

    // Paths (relative from cv-validator.html location)
    PATHS: {
        groundTruth: 'ground-truth.json',
        itemsData: '../../data/items.json',
        imagesBase: '../../src/',
    },

    // Detection method toggles (default both enabled)
    DETECTION_OPTIONS: {
        useEnhanced: true, // Multi-method vs NCC only
        useTrainingData: true, // Use training templates
    },
};

// Metric thresholds for color coding
export const METRIC_THRESHOLDS = {
    GOOD: 0.7,
    WARNING: 0.4,
};

// CSS class names
export const CSS_CLASSES = {
    CLICKABLE: 'clickable',
    ACTIVE: 'active',
    VISIBLE: 'visible',
    SHOW: 'show',
    HIDDEN: 'hidden',
    SELECTED: 'selected',
    COPIED: 'copied',
    CORRECTED: 'corrected',
    VERIFIED: 'verified',
    MATCH: 'match',
    FALSE_POSITIVE: 'false-positive',
    MISSING: 'missing',
};

// Log levels
export const LOG_LEVELS = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
};
