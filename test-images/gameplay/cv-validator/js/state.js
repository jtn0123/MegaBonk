/* global Blob */
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
    detectionsBySlot: new Map(), // slotIndex -> { detection, topMatches, position, cropDataURL }
    emptyCells: new Map(), // slotIndex -> { position, cropDataURL } - cells detected as empty
    gridPositionsCache: [],

    // Corrections
    corrections: new Map(), // slotIndex -> { original: {name, confidence}, corrected: string|null, is_unknown?: bool }

    // Correction panel state
    selectedCorrectionItem: null,
    currentCorrectionSlot: null,
    currentSlotIsEmpty: false, // true if correcting an empty slot
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
        totalItems: CONFIG.DEFAULT_CALIBRATION.totalItems,
    },

    // Modal state
    currentZoom: 1,

    // Debug/metrics state
    detectionResults: [], // Alias for lastDetections for debug panel
    currentImageInfo: null, // Image info for debug panel
    detectionRuns: 0,
    avgDetectionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    twoPhaseSuccessRate: 0,

    // Resolution scanning state
    imageResolutions: {}, // Cached resolution data: { "path": { width, height }, ... }
    resolutionScanComplete: false,
};

// Reset detection-related state (called when switching images)
export function resetDetectionState() {
    state.lastDetections = [];
    state.detectionsBySlot.clear();
    state.emptyCells.clear();
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
    // Path is relative to cv-validator folder (code prepends ../ for fetch)
    PRESETS_FILE_PATH: '../../data/grid-presets.json',
    _filePresetsLoaded: false,

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

    // Force reload presets from grid-presets.json file
    async reloadPresetsFromFile() {
        this._filePresetsLoaded = false; // Reset flag to force reload
        await this.loadFromFile();
        console.log('[PresetManager] Presets reloaded from file');
    },

    // Load presets from grid-presets.json file and merge with localStorage
    async loadFromFile() {
        if (this._filePresetsLoaded) return;

        try {
            // Fetch presets file relative to cv-validator folder (go up one level)
            const response = await fetch(`../${this.PRESETS_FILE_PATH}`);
            if (!response.ok) {
                console.warn(`grid-presets.json not found (${response.status}), using localStorage only`);
                this._filePresetsLoaded = true;
                return;
            }

            const fileData = await response.json();
            if (!fileData.presets || typeof fileData.presets !== 'object') {
                console.warn('Invalid grid-presets.json format');
                this._filePresetsLoaded = true;
                return;
            }

            // Merge file presets with localStorage (localStorage takes precedence for conflicts)
            const localData = this.load();
            let merged = false;

            for (const [key, preset] of Object.entries(fileData.presets)) {
                const localPreset = localData.presets[key];
                // Add new presets OR update if file version is newer
                if (
                    !localPreset ||
                    (preset.lastModified &&
                        (!localPreset.lastModified ||
                            new Date(preset.lastModified) > new Date(localPreset.lastModified)))
                ) {
                    localData.presets[key] = preset;
                    merged = true;
                    // Use debug level for verbose import logging
                    if (typeof console.debug === 'function') {
                        console.debug(
                            `[PresetManager] ${localPreset ? 'Updated' : 'Imported'} preset from file: ${key}`
                        );
                    }
                }
            }

            if (merged) {
                this.save(localData);
                // Use debug level for verbose import logging
                if (typeof console.debug === 'function') {
                    console.debug('[PresetManager] File presets merged into localStorage');
                }
            }

            this._filePresetsLoaded = true;
        } catch (e) {
            console.warn('Failed to load presets from file:', e);
            this._filePresetsLoaded = true;
        }
    },

    // Generate exportable JSON data for all presets
    getExportData() {
        const data = this.load();
        return {
            version: '1.0',
            description: 'Grid calibration presets for CV Validator. Edit manually or export from the validator UI.',
            exportedAt: new Date().toISOString(),
            presets: data.presets,
        };
    },

    // Trigger download of grid-presets.json with all current presets
    exportToFile() {
        const exportData = this.getExportData();
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'grid-presets.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
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
        // Validate input parameters
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            console.warn('[findByAspectRatio] Invalid dimensions:', width, height);
            return null;
        }
        if (width <= 0 || height <= 0) {
            console.warn('[findByAspectRatio] Dimensions must be positive:', width, height);
            return null;
        }

        const data = this.load();

        // Validate presets collection exists
        if (!data.presets || typeof data.presets !== 'object') {
            return null;
        }

        const presetEntries = Object.entries(data.presets);
        if (presetEntries.length === 0) {
            return null;
        }

        const targetRatio = width / height;
        const tolerance = 0.01;

        for (const [_key, preset] of presetEntries) {
            // Validate preset structure
            if (!preset?.resolution?.width || !preset?.resolution?.height) {
                console.warn('[findByAspectRatio] Preset missing resolution:', _key);
                continue;
            }

            // Guard against division by zero
            if (preset.resolution.height === 0) {
                console.warn('[findByAspectRatio] Preset has zero height:', _key);
                continue;
            }

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

    // Find nearest resolution by total pixel count
    findNearestResolution(width, height) {
        // Validate input parameters
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            console.warn('[findNearestResolution] Invalid dimensions:', width, height);
            return null;
        }
        if (width <= 0 || height <= 0) {
            console.warn('[findNearestResolution] Dimensions must be positive:', width, height);
            return null;
        }

        const data = this.load();

        // Validate presets collection exists
        if (!data.presets || typeof data.presets !== 'object') {
            return null;
        }

        const presetEntries = Object.entries(data.presets);
        if (presetEntries.length === 0) {
            return null;
        }

        const targetPixels = width * height;
        let nearest = null;
        let nearestDiff = Infinity;

        for (const [key, preset] of presetEntries) {
            // Validate preset structure
            if (!preset?.resolution?.width || !preset?.resolution?.height) {
                continue;
            }

            const presetPixels = preset.resolution.width * preset.resolution.height;
            const diff = Math.abs(targetPixels - presetPixels);

            if (diff < nearestDiff) {
                nearestDiff = diff;
                nearest = { key, preset, scaleFactor: height / preset.resolution.height };
            }
        }

        return nearest;
    },

    // Get only verified presets (source === 'verified')
    getVerifiedPresets() {
        const data = this.load();
        if (!data.presets || typeof data.presets !== 'object') {
            return [];
        }

        return Object.entries(data.presets)
            .filter(([_key, preset]) => preset.source === 'verified')
            .map(([key, preset]) => ({
                key,
                preset,
                pixels: preset.resolution.width * preset.resolution.height,
            }))
            .sort((a, b) => a.pixels - b.pixels); // Sort by pixel count ascending
    },

    // Calculate calibration by interpolating between two nearest verified presets
    calculateCalibrationByInterpolation(width, height) {
        // Validate input parameters
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            console.warn('[interpolate] Invalid dimensions:', width, height);
            return null;
        }
        if (width <= 0 || height <= 0) {
            console.warn('[interpolate] Dimensions must be positive:', width, height);
            return null;
        }

        const verifiedPresets = this.getVerifiedPresets();

        // Need at least 2 verified presets to interpolate
        if (verifiedPresets.length < 2) {
            console.warn('[interpolate] Need at least 2 verified presets for interpolation');
            return null;
        }

        const targetPixels = width * height;

        // Find the two nearest verified presets (one below, one above if possible)
        let lower = null;
        let upper = null;

        for (const p of verifiedPresets) {
            if (p.pixels <= targetPixels) {
                lower = p;
            } else if (!upper) {
                upper = p;
                break;
            }
        }

        // Edge cases: target is outside the range of verified presets
        if (!lower) {
            // Target is smaller than all verified presets - use two smallest
            lower = verifiedPresets[0];
            upper = verifiedPresets[1];
        } else if (!upper) {
            // Target is larger than all verified presets - use two largest
            lower = verifiedPresets[verifiedPresets.length - 2];
            upper = verifiedPresets[verifiedPresets.length - 1];
        }

        // Calculate interpolation factor (0 = lower, 1 = upper)
        const range = upper.pixels - lower.pixels;
        const t = range > 0 ? (targetPixels - lower.pixels) / range : 0.5;

        // Clamp t to [0, 1] for edge cases
        const tClamped = Math.max(0, Math.min(1, t));

        // Interpolate each calibration parameter
        const lowerCal = lower.preset.calibration;
        const upperCal = upper.preset.calibration;

        const lerp = (a, b, t) => Math.round(a + (b - a) * t);

        const interpolatedCalibration = {
            xOffset: lerp(lowerCal.xOffset, upperCal.xOffset, tClamped),
            yOffset: lerp(lowerCal.yOffset, upperCal.yOffset, tClamped),
            iconWidth: lerp(lowerCal.iconWidth, upperCal.iconWidth, tClamped),
            iconHeight: lerp(lowerCal.iconHeight, upperCal.iconHeight, tClamped),
            xSpacing: lerp(lowerCal.xSpacing, upperCal.xSpacing, tClamped),
            ySpacing: lerp(lowerCal.ySpacing, upperCal.ySpacing, tClamped),
            iconsPerRow: lerp(lowerCal.iconsPerRow, upperCal.iconsPerRow, tClamped),
            numRows: lerp(lowerCal.numRows, upperCal.numRows, tClamped),
        };

        return {
            calibration: interpolatedCalibration,
            lowerPreset: lower.preset,
            upperPreset: upper.preset,
            lowerKey: lower.key,
            upperKey: upper.key,
            interpolationFactor: tClamped,
            source: 'interpolated',
        };
    },

    // Get preset status string for display
    getStatusForResolution(width, height) {
        // 1. Check exact match
        const exact = this.getPresetForResolution(width, height);
        if (exact) {
            const sourceLabel = exact.source === 'verified' ? ' ✓' : '';
            return {
                type: 'exact',
                message: `Using preset: ${exact.name}${sourceLabel}`,
                preset: exact,
                isVerified: exact.source === 'verified',
            };
        }

        // 2. Check aspect ratio match with scaling (only if verified)
        const aspectMatch = this.findByAspectRatio(width, height);
        if (aspectMatch && aspectMatch.preset.source === 'verified') {
            return {
                type: 'scaled',
                message: `Using scaled verified preset: ${aspectMatch.preset.name} (${aspectMatch.scaleFactor.toFixed(2)}x)`,
                preset: aspectMatch.preset,
                scaleFactor: aspectMatch.scaleFactor,
                isVerified: true,
            };
        }

        // 3. Try interpolation between verified presets
        const interpolated = this.calculateCalibrationByInterpolation(width, height);
        if (interpolated) {
            return {
                type: 'interpolated',
                message: `Interpolated: ${interpolated.lowerKey} ↔ ${interpolated.upperKey} (${(interpolated.interpolationFactor * 100).toFixed(0)}%)`,
                calibration: interpolated.calibration,
                lowerPreset: interpolated.lowerPreset,
                upperPreset: interpolated.upperPreset,
                interpolationFactor: interpolated.interpolationFactor,
                isVerified: false,
            };
        }

        // 4. Find nearest resolution by pixel count (fallback for non-verified)
        const nearest = this.findNearestResolution(width, height);
        if (nearest) {
            return {
                type: 'nearest',
                message: `Using nearest preset: ${nearest.preset.name} (${nearest.scaleFactor.toFixed(2)}x scale)`,
                preset: nearest.preset,
                scaleFactor: nearest.scaleFactor,
                sourceKey: nearest.key,
                isVerified: nearest.preset.source === 'verified',
            };
        }

        // 5. Default fallback
        return {
            type: 'default',
            message: 'No preset - using defaults',
            preset: null,
            isVerified: false,
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
