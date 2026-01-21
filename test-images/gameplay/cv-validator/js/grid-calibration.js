/* ========================================
 * CV Validator - Grid Calibration
 * Calibration controls with factory function + preset UI
 * ======================================== */

import { CONFIG } from './config.js';
import { state, resetCalibration, presetManager } from './state.js';
import { log, LOG_LEVELS, showToast } from './utils.js';

// DOM element references
let elements = {};
let onCalibrationChange = null;

// ========================================
// Factory Function for Calibration Sliders
// ========================================

function createCalibrationHandler(slider, valueEl, stateProp, suffix = 'px') {
    slider.addEventListener('input', e => {
        const value = parseInt(e.target.value);
        state.calibration[stateProp] = value;
        valueEl.textContent = suffix ? `${value}${suffix}` : value.toString();
        if (onCalibrationChange) onCalibrationChange();
    });
}

// ========================================
// Initialization
// ========================================

export function initGridCalibration(domElements, callbacks) {
    elements = domElements;
    onCalibrationChange = callbacks.onCalibrationChange;

    // Toggle calibration panel
    elements.toggleBtn.addEventListener('click', () => {
        const isHidden = elements.panel.style.display === 'none';
        elements.panel.style.display = isHidden ? 'block' : 'none';
        elements.toggleBtn.textContent = isHidden ? 'Grid Calibration \u25B2' : 'Grid Calibration \u25BC';
    });

    // Setup calibration sliders using factory function
    createCalibrationHandler(elements.xOffsetSlider, elements.xOffsetValue, 'xOffset', 'px');
    createCalibrationHandler(elements.iconWidthSlider, elements.iconWidthValue, 'iconWidth', 'px');
    createCalibrationHandler(elements.iconHeightSlider, elements.iconHeightValue, 'iconHeight', 'px');
    createCalibrationHandler(elements.xSpacingSlider, elements.xSpacingValue, 'xSpacing', 'px');
    createCalibrationHandler(elements.ySpacingSlider, elements.ySpacingValue, 'ySpacing', 'px');
    createCalibrationHandler(elements.iconsPerRowSlider, elements.iconsPerRowValue, 'iconsPerRow', '');
    createCalibrationHandler(elements.numRowsSlider, elements.numRowsValue, 'numRows', '');

    // Handle the main Y offset slider in controls bar (no separate slider in calibration panel)
    if (elements.mainYOffsetSlider) {
        elements.mainYOffsetSlider.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            state.calibration.yOffset = value;
            elements.mainYOffsetValue.textContent = `${value}px`;
            if (onCalibrationChange) onCalibrationChange();
        });
    }

    // Reset to defaults
    elements.resetBtn.addEventListener('click', () => {
        resetToDefaults();
        log('Reset calibration to defaults', LOG_LEVELS.INFO);
    });

    // Preset controls
    if (elements.savePresetBtn) {
        elements.savePresetBtn.addEventListener('click', saveCurrentPreset);
    }
    if (elements.loadPresetBtn) {
        elements.loadPresetBtn.addEventListener('click', loadPresetForCurrentImage);
    }
    if (elements.deletePresetBtn) {
        elements.deletePresetBtn.addEventListener('click', deleteCurrentPreset);
    }
}

// ========================================
// Reset to Defaults
// ========================================

function resetToDefaults() {
    resetCalibration();
    syncUIToState();
    if (onCalibrationChange) onCalibrationChange();
}

// ========================================
// Sync UI to State
// ========================================

export function syncUIToState() {
    const cal = state.calibration;

    elements.xOffsetSlider.value = cal.xOffset;
    elements.xOffsetValue.textContent = `${cal.xOffset}px`;

    // Y offset is only in main controls bar
    if (elements.mainYOffsetSlider) {
        elements.mainYOffsetSlider.value = cal.yOffset;
        elements.mainYOffsetValue.textContent = `${cal.yOffset}px`;
    }

    elements.iconWidthSlider.value = cal.iconWidth;
    elements.iconWidthValue.textContent = `${cal.iconWidth}px`;

    elements.iconHeightSlider.value = cal.iconHeight;
    elements.iconHeightValue.textContent = `${cal.iconHeight}px`;

    elements.xSpacingSlider.value = cal.xSpacing;
    elements.xSpacingValue.textContent = `${cal.xSpacing}px`;

    elements.ySpacingSlider.value = cal.ySpacing;
    elements.ySpacingValue.textContent = `${cal.ySpacing}px`;

    elements.iconsPerRowSlider.value = cal.iconsPerRow;
    elements.iconsPerRowValue.textContent = cal.iconsPerRow.toString();

    elements.numRowsSlider.value = cal.numRows;
    elements.numRowsValue.textContent = cal.numRows.toString();
}

// ========================================
// Resolution Info Display
// ========================================

export function updateResolutionInfo(width, height) {
    if (!elements.resolutionInfo || !elements.scaleInfo) return;

    const scale = height / CONFIG.BASE_RESOLUTION;
    elements.resolutionInfo.textContent = `Resolution: ${width}x${height}`;
    elements.scaleInfo.textContent = `Scale: ${scale.toFixed(2)}x`;
}

// ========================================
// Preset Management
// ========================================

export function autoLoadPresetForResolution(width, height) {
    const status = presetManager.getStatusForResolution(width, height);

    if (status.type === 'exact') {
        // Apply exact preset
        presetManager.applyPreset(status.preset);
        syncUIToState();
        updatePresetStatus(status.message);
        log(`Auto-loaded preset for ${width}x${height}`, LOG_LEVELS.SUCCESS);
        return true;
    } else if (status.type === 'scaled') {
        // Found aspect ratio match - we could scale, but for now just notify
        updatePresetStatus(status.message);
        log(`Found scaled preset match: ${status.message}`, LOG_LEVELS.INFO);
        return false;
    } else {
        updatePresetStatus(status.message);
        return false;
    }
}

function saveCurrentPreset() {
    if (!state.currentImage) {
        showToast('No image loaded');
        return;
    }

    const { width, height } = state.currentImage;
    const key = presetManager.savePreset(width, height, state.calibration);
    showToast(`Saved preset for ${key}`);
    updatePresetStatus(`Preset saved: ${height}p`);
    log(`Saved calibration preset for ${key}`, LOG_LEVELS.SUCCESS);
}

function loadPresetForCurrentImage() {
    if (!state.currentImage) {
        showToast('No image loaded');
        return;
    }

    const { width, height } = state.currentImage;
    const preset = presetManager.getPresetForResolution(width, height);

    if (preset) {
        presetManager.applyPreset(preset);
        syncUIToState();
        if (onCalibrationChange) onCalibrationChange();
        showToast(`Loaded preset: ${preset.name}`);
        updatePresetStatus(`Using preset: ${preset.name}`);
        log(`Loaded preset for ${width}x${height}`, LOG_LEVELS.SUCCESS);
    } else {
        showToast('No preset found for this resolution');
    }
}

function deleteCurrentPreset() {
    if (!state.currentImage) {
        showToast('No image loaded');
        return;
    }

    const { width, height } = state.currentImage;
    const deleted = presetManager.deletePreset(width, height);

    if (deleted) {
        showToast(`Deleted preset for ${width}x${height}`);
        updatePresetStatus('No preset - using defaults');
        log(`Deleted preset for ${width}x${height}`, LOG_LEVELS.WARNING);
    } else {
        showToast('No preset to delete');
    }
}

function updatePresetStatus(message) {
    if (elements.presetStatus) {
        elements.presetStatus.textContent = message;
    }
}

// ========================================
// Get Current Calibration for Export
// ========================================

export function getCalibrationForExport() {
    const cal = state.calibration;
    const image = state.currentImage;

    return {
        base_resolution: CONFIG.BASE_RESOLUTION,
        x_offset: cal.xOffset,
        y_offset: cal.yOffset,
        icon_width: cal.iconWidth,
        icon_height: cal.iconHeight,
        x_spacing: cal.xSpacing,
        y_spacing: cal.ySpacing,
        icons_per_row: cal.iconsPerRow,
        num_rows: cal.numRows,
        // Computed values for this image's resolution
        computed: image
            ? {
                  scale: image.height / CONFIG.BASE_RESOLUTION,
                  scaled_icon_width: Math.round(cal.iconWidth * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_icon_height: Math.round(cal.iconHeight * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_x_spacing: Math.round(cal.xSpacing * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_y_spacing: Math.round(cal.ySpacing * (image.height / CONFIG.BASE_RESOLUTION)),
                  total_slots: cal.iconsPerRow * cal.numRows,
              }
            : null,
    };
}

// ========================================
// Check if preset was modified
// ========================================

export function wasPresetModified() {
    if (!state.currentImage) return false;

    const { width, height } = state.currentImage;
    const preset = presetManager.getPresetForResolution(width, height);

    if (!preset) return false;

    const cal = state.calibration;
    const presetCal = preset.calibration;

    return (
        cal.xOffset !== presetCal.xOffset ||
        cal.yOffset !== presetCal.yOffset ||
        cal.iconWidth !== presetCal.iconWidth ||
        cal.iconHeight !== presetCal.iconHeight ||
        cal.xSpacing !== presetCal.xSpacing ||
        cal.ySpacing !== presetCal.ySpacing ||
        cal.iconsPerRow !== presetCal.iconsPerRow ||
        cal.numRows !== presetCal.numRows
    );
}

export function getPresetName() {
    if (!state.currentImage) return null;

    const { width, height } = state.currentImage;
    const preset = presetManager.getPresetForResolution(width, height);

    return preset?.name || null;
}
