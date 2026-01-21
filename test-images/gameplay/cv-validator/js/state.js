/* ========================================
 * CV Validator - State Management
 * Centralized state object + preset manager
 * ======================================== */

import { CONFIG } from './config.js';

// Centralized application state
export const state = {
    // Data
    groundTruth: {},
    itemsData: null,
    itemLookup: new Map(), // name (lowercase) -> item data
    itemIdLookup: new Map(), // id -> item data
    templateCache: new Map(), // item id -> ImageData

    // Current image
    currentImage: null,
    currentImagePath: null,

    // Detection results
    lastDetections: [],
    detectionsBySlot: new Map(), // slotIndex -> { detection, topMatches, position }
    gridPositionsCache: [],

    // Corrections
    corrections: new Map(), // slotIndex -> { original: {name, confidence}, corrected: string|null }

    // Correction panel state
    selectedCorrectionItem: null,
    currentCorrectionSlot: null,
    correctionFilter: 'all',
    correctionSearchQuery: '',

    // Item reference panel state
    currentFilter: 'all',
    searchQuery: '',

    // Grid calibration (base values at 720p)
    calibration: {
        xOffset: CONFIG.DEFAULT_CALIBRATION.xOffset,
        yOffset: CONFIG.DEFAULT_CALIBRATION.yOffset,
        iconWidth: CONFIG.DEFAULT_CALIBRATION.iconWidth,
        iconHeight: CONFIG.DEFAULT_CALIBRATION.iconHeight,
        xSpacing: CONFIG.DEFAULT_CALIBRATION.xSpacing,
        ySpacing: CONFIG.DEFAULT_CALIBRATION.ySpacing,
        iconsPerRow: CONFIG.DEFAULT_CALIBRATION.iconsPerRow,
        numRows: CONFIG.DEFAULT_CALIBRATION.numRows,
    },

    // Modal state
    currentZoom: 1,
};

// Reset detection-related state (called when switching images)
export function resetDetectionState() {
    state.lastDetections = [];
    state.detectionsBySlot.clear();
    state.gridPositionsCache = [];
    state.corrections.clear();
    state.selectedCorrectionItem = null;
    state.currentCorrectionSlot = null;
}

// Reset calibration to defaults
export function resetCalibration() {
    state.calibration = { ...CONFIG.DEFAULT_CALIBRATION };
}

// ========================================
// Preset Manager for per-resolution calibration
// ========================================

export const presetManager = {
    STORAGE_KEY: 'cv-validator-presets',

    // Load all presets from localStorage
    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : { presets: {}, defaultPreset: null };
        } catch (e) {
            console.warn('Failed to load presets from localStorage:', e);
            return { presets: {}, defaultPreset: null };
        }
    },

    // Save all presets to localStorage
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save presets to localStorage:', e);
        }
    },

    // Get preset for a specific resolution
    getPresetForResolution(width, height) {
        const data = this.load();
        const key = `${width}x${height}`;
        return data.presets[key] || null;
    },

    // Save preset for a specific resolution
    savePreset(width, height, calibration) {
        const data = this.load();
        const key = `${width}x${height}`;
        data.presets[key] = {
            name: `${height}p`,
            resolution: { width, height },
            calibration: { ...calibration },
            lastModified: new Date().toISOString(),
        };
        this.save(data);
        return key;
    },

    // Delete preset for a specific resolution
    deletePreset(width, height) {
        const data = this.load();
        const key = `${width}x${height}`;
        if (data.presets[key]) {
            delete data.presets[key];
            this.save(data);
            return true;
        }
        return false;
    },

    // Get all presets
    getAllPresets() {
        const data = this.load();
        return data.presets;
    },

    // Find best matching preset by aspect ratio (fallback)
    findByAspectRatio(width, height) {
        const data = this.load();
        const targetRatio = width / height;
        const tolerance = 0.01;

        for (const [_key, preset] of Object.entries(data.presets)) {
            const presetRatio = preset.resolution.width / preset.resolution.height;
            if (Math.abs(presetRatio - targetRatio) < tolerance) {
                // Calculate scale factor
                const scaleFactor = height / preset.resolution.height;
                return { preset, scaleFactor };
            }
        }
        return null;
    },

    // Apply preset to state
    applyPreset(preset) {
        if (preset && preset.calibration) {
            state.calibration = { ...preset.calibration };
            return true;
        }
        return false;
    },

    // Get preset status string for display
    getStatusForResolution(width, height) {
        const exact = this.getPresetForResolution(width, height);
        if (exact) {
            return {
                type: 'exact',
                message: `Using preset: ${exact.name}`,
                preset: exact,
            };
        }

        const aspectMatch = this.findByAspectRatio(width, height);
        if (aspectMatch) {
            return {
                type: 'scaled',
                message: `Using scaled preset: ${aspectMatch.preset.name} (${aspectMatch.scaleFactor.toFixed(2)}x)`,
                preset: aspectMatch.preset,
                scaleFactor: aspectMatch.scaleFactor,
            };
        }

        return {
            type: 'default',
            message: 'No preset - using defaults',
            preset: null,
        };
    },
};

// Export state getters for convenience
export function getCalibration() {
    return state.calibration;
}

export function getDetectionsBySlot() {
    return state.detectionsBySlot;
}

export function getCorrections() {
    return state.corrections;
}

export function getCurrentImage() {
    return state.currentImage;
}
