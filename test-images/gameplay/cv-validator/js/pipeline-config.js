/* ========================================
 * CV Validator - Pipeline Configuration
 * Toggleable components for ablation testing
 * Mirrors offline-cv-runner.ts PipelineConfig
 * ======================================== */

// Storage key for persistence
const STORAGE_KEY = 'cv-pipeline-config';

/**
 * Pipeline configuration with toggleable components for ablation testing.
 * Each toggle allows testing impact of individual pipeline stages.
 */
export const DEFAULT_PIPELINE_CONFIG = {
    name: 'default',

    // Template matching options
    useMultiScale: true, // Use multiple template scales vs single size

    // Preprocessing options
    useContrastEnhancement: true, // Apply contrast enhancement
    useColorNormalization: true, // Apply color normalization
    useSharpening: false, // Apply image sharpening (slower)
    useHistogramEqualization: false, // Apply adaptive histogram equalization (slower)

    // Grid detection options
    useDynamicGrid: true, // Use dynamic grid detection vs static fallback
    useResolutionAwareParams: true, // Use resolution-specific grid parameters

    // Filtering options
    useRarityFiltering: true, // Filter templates by detected rarity
    useEmptyCellFilter: true, // Skip empty cells

    // Similarity metrics (at least one must be true)
    metrics: {
        ssim: true, // Structural similarity
        ncc: true, // Normalized cross-correlation
        histogram: true, // Color histogram comparison
        edge: false, // Edge-based similarity (slower)
    },

    // Score combination
    useAgreementBonus: true, // Add bonus when metrics agree
};

// Current active configuration
let currentConfig = { ...DEFAULT_PIPELINE_CONFIG };

// Ablation test results storage
let ablationResults = [];

/**
 * Get current pipeline configuration
 */
export function getPipelineConfig() {
    return { ...currentConfig };
}

/**
 * Set pipeline configuration
 */
export function setPipelineConfig(config) {
    currentConfig = { ...currentConfig, ...config };
    // Handle nested metrics object
    if (config.metrics) {
        currentConfig.metrics = { ...currentConfig.metrics, ...config.metrics };
    }
    saveConfig();
}

/**
 * Reset to default configuration
 */
export function resetPipelineConfig() {
    currentConfig = { ...DEFAULT_PIPELINE_CONFIG };
    saveConfig();
}

/**
 * Toggle a single component
 */
export function toggleComponent(componentName, value) {
    if (componentName.startsWith('metrics.')) {
        const metricName = componentName.replace('metrics.', '');
        currentConfig.metrics[metricName] = value;
    } else {
        currentConfig[componentName] = value;
    }
    saveConfig();
}

/**
 * Get component value
 */
export function getComponent(componentName) {
    if (componentName.startsWith('metrics.')) {
        const metricName = componentName.replace('metrics.', '');
        return currentConfig.metrics[metricName];
    }
    return currentConfig[componentName];
}

/**
 * Save configuration to localStorage
 */
function saveConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
    } catch (e) {
        console.warn('Could not save pipeline config:', e);
    }
}

/**
 * Load configuration from localStorage
 */
export function loadConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            currentConfig = { ...DEFAULT_PIPELINE_CONFIG, ...parsed };
            if (parsed.metrics) {
                currentConfig.metrics = { ...DEFAULT_PIPELINE_CONFIG.metrics, ...parsed.metrics };
            }
        }
    } catch (e) {
        console.warn('Could not load pipeline config:', e);
    }
}

// ========================================
// Preset Configurations for Quick Testing
// ========================================

export const ABLATION_PRESETS = {
    'baseline-all-on': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'baseline-all-on',
    },

    minimal: {
        name: 'minimal',
        useMultiScale: false,
        useContrastEnhancement: false,
        useColorNormalization: false,
        useSharpening: false,
        useHistogramEqualization: false,
        useDynamicGrid: false,
        useResolutionAwareParams: false,
        useRarityFiltering: false,
        useEmptyCellFilter: false,
        metrics: { ssim: true, ncc: false, histogram: false, edge: false },
        useAgreementBonus: false,
    },

    'no-multi-scale': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'no-multi-scale',
        useMultiScale: false,
    },

    'no-preprocessing': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'no-preprocessing',
        useContrastEnhancement: false,
        useColorNormalization: false,
    },

    'no-dynamic-grid': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'no-dynamic-grid',
        useDynamicGrid: false,
    },

    'no-rarity-filter': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'no-rarity-filter',
        useRarityFiltering: false,
    },

    'ssim-only': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ssim-only',
        metrics: { ssim: true, ncc: false, histogram: false, edge: false },
    },

    'ncc-only': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ncc-only',
        metrics: { ssim: false, ncc: true, histogram: false, edge: false },
    },

    'full-preprocessing': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'full-preprocessing',
        useSharpening: true,
        useHistogramEqualization: true,
    },

    'all-metrics': {
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'all-metrics',
        metrics: { ssim: true, ncc: true, histogram: true, edge: true },
    },
};

/**
 * Apply a preset configuration
 */
export function applyPreset(presetName) {
    const preset = ABLATION_PRESETS[presetName];
    if (preset) {
        currentConfig = { ...preset };
        saveConfig();
        return true;
    }
    return false;
}

/**
 * Get list of available presets
 */
export function getPresetNames() {
    return Object.keys(ABLATION_PRESETS);
}

// ========================================
// Ablation Results Tracking
// ========================================

/**
 * Record ablation test result
 */
export function recordAblationResult(configName, metrics) {
    ablationResults.push({
        config: configName,
        timestamp: Date.now(),
        ...metrics,
    });

    // Keep last 100 results
    if (ablationResults.length > 100) {
        ablationResults = ablationResults.slice(-100);
    }

    saveAblationResults();
}

/**
 * Get ablation results
 */
export function getAblationResults() {
    return [...ablationResults];
}

/**
 * Clear ablation results
 */
export function clearAblationResults() {
    ablationResults = [];
    saveAblationResults();
}

/**
 * Save ablation results to localStorage
 */
function saveAblationResults() {
    try {
        localStorage.setItem(STORAGE_KEY + '-results', JSON.stringify(ablationResults));
    } catch (e) {
        console.warn('Could not save ablation results:', e);
    }
}

/**
 * Load ablation results from localStorage
 */
export function loadAblationResults() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY + '-results');
        if (stored) {
            ablationResults = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Could not load ablation results:', e);
    }
}

/**
 * Calculate component impact from ablation results
 * Returns which components help vs hurt when disabled
 */
export function calculateComponentImpact() {
    if (ablationResults.length < 2) {
        return null;
    }

    // Find baseline result
    const baseline = ablationResults.find(r => r.config === 'baseline-all-on');
    if (!baseline) {
        return null;
    }

    const baselineF1 = baseline.f1Score || 0;
    const impacts = [];

    // Compare each "no-X" config to baseline
    for (const result of ablationResults) {
        if (result.config.startsWith('no-')) {
            const component = result.config.replace('no-', '');
            const delta = (result.f1Score || 0) - baselineF1;
            impacts.push({
                component,
                delta,
                f1: result.f1Score || 0,
                helps: delta < -0.005, // Component helps if disabling it hurts
                hurts: delta > 0.005, // Component hurts if disabling it helps
            });
        }
    }

    // Sort by impact (most helpful first)
    impacts.sort((a, b) => a.delta - b.delta);

    return {
        baselineF1,
        impacts,
    };
}

// ========================================
// Component Descriptions (for UI)
// ========================================

export const COMPONENT_DESCRIPTIONS = {
    useMultiScale: {
        label: 'Multi-Scale Templates',
        description: 'Match at multiple sizes (48px, 64px) for resolution robustness',
        category: 'template',
    },
    useContrastEnhancement: {
        label: 'Contrast Enhancement',
        description: 'Boost image contrast before matching',
        category: 'preprocessing',
    },
    useColorNormalization: {
        label: 'Color Normalization',
        description: 'Normalize color range to full 0-255',
        category: 'preprocessing',
    },
    useSharpening: {
        label: 'Sharpening',
        description: 'Apply unsharp mask for edge enhancement (slower)',
        category: 'preprocessing',
    },
    useHistogramEqualization: {
        label: 'Histogram Equalization',
        description: 'Adaptive histogram equalization for varying lighting (slower)',
        category: 'preprocessing',
    },
    useDynamicGrid: {
        label: 'Dynamic Grid Detection',
        description: 'Detect grid from rarity borders vs static positions',
        category: 'grid',
    },
    useResolutionAwareParams: {
        label: 'Resolution-Aware Params',
        description: 'Use resolution-specific icon sizes and spacing',
        category: 'grid',
    },
    useRarityFiltering: {
        label: 'Rarity Filtering',
        description: 'Filter templates by detected border rarity color',
        category: 'filtering',
    },
    useEmptyCellFilter: {
        label: 'Empty Cell Filter',
        description: 'Skip cells with low variance (likely empty)',
        category: 'filtering',
    },
    'metrics.ssim': {
        label: 'SSIM Metric',
        description: 'Structural Similarity Index',
        category: 'metrics',
    },
    'metrics.ncc': {
        label: 'NCC Metric',
        description: 'Normalized Cross-Correlation',
        category: 'metrics',
    },
    'metrics.histogram': {
        label: 'Histogram Metric',
        description: 'Color histogram comparison',
        category: 'metrics',
    },
    'metrics.edge': {
        label: 'Edge Metric',
        description: 'Edge-based similarity (slower)',
        category: 'metrics',
    },
    useAgreementBonus: {
        label: 'Agreement Bonus',
        description: 'Boost score when multiple metrics agree',
        category: 'scoring',
    },
};

/**
 * Get all components grouped by category
 */
export function getComponentsByCategory() {
    const categories = {
        template: [],
        preprocessing: [],
        grid: [],
        filtering: [],
        metrics: [],
        scoring: [],
    };

    for (const [key, info] of Object.entries(COMPONENT_DESCRIPTIONS)) {
        categories[info.category].push({
            key,
            ...info,
            enabled: getComponent(key),
        });
    }

    return categories;
}

// Initialize on load
loadConfig();
loadAblationResults();
