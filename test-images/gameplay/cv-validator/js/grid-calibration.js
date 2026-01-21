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
// Factory Function for Calibration Inputs
// ========================================

function createCalibrationHandler(input, stateProp) {
    // Handle both 'input' (for immediate feedback) and 'change' (for typing)
    const handleChange = e => {
        const value = parseInt(e.target.value) || 0;
        state.calibration[stateProp] = value;
        if (onCalibrationChange) onCalibrationChange();
        updateModificationWarning();
    };
    input.addEventListener('input', handleChange);
    input.addEventListener('change', handleChange);
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

    // Setup calibration inputs using factory function
    createCalibrationHandler(elements.xOffsetInput, 'xOffset');
    createCalibrationHandler(elements.iconWidthInput, 'iconWidth');
    createCalibrationHandler(elements.iconHeightInput, 'iconHeight');
    createCalibrationHandler(elements.xSpacingInput, 'xSpacing');
    createCalibrationHandler(elements.ySpacingInput, 'ySpacing');
    createCalibrationHandler(elements.iconsPerRowInput, 'iconsPerRow');
    createCalibrationHandler(elements.numRowsInput, 'numRows');
    createCalibrationHandler(elements.totalItemsInput, 'totalItems');

    // Handle the main Y offset slider in controls bar
    if (elements.mainYOffsetSlider) {
        elements.mainYOffsetSlider.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            state.calibration.yOffset = value;
            elements.mainYOffsetValue.textContent = `${value}px`;
            // Sync to calibration panel input if it exists
            if (elements.calYOffsetInput) {
                elements.calYOffsetInput.value = value;
            }
            if (onCalibrationChange) onCalibrationChange();
            updateModificationWarning();
        });
    }

    // Handle Y offset in calibration panel (syncs with main slider)
    if (elements.calYOffsetInput) {
        const handleYChange = e => {
            const value = parseInt(e.target.value) || 0;
            state.calibration.yOffset = value;
            // Sync to main slider
            if (elements.mainYOffsetSlider) {
                elements.mainYOffsetSlider.value = value;
                elements.mainYOffsetValue.textContent = `${value}px`;
            }
            if (onCalibrationChange) onCalibrationChange();
            updateModificationWarning();
        };
        elements.calYOffsetInput.addEventListener('input', handleYChange);
        elements.calYOffsetInput.addEventListener('change', handleYChange);
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

    // Sync number inputs
    if (elements.xOffsetInput) elements.xOffsetInput.value = cal.xOffset;
    if (elements.iconWidthInput) elements.iconWidthInput.value = cal.iconWidth;
    if (elements.iconHeightInput) elements.iconHeightInput.value = cal.iconHeight;
    if (elements.xSpacingInput) elements.xSpacingInput.value = cal.xSpacing;
    if (elements.ySpacingInput) elements.ySpacingInput.value = cal.ySpacing;
    if (elements.iconsPerRowInput) elements.iconsPerRowInput.value = cal.iconsPerRow;
    if (elements.numRowsInput) elements.numRowsInput.value = cal.numRows;
    if (elements.totalItemsInput) elements.totalItemsInput.value = cal.totalItems || 60;

    // Y offset - sync both main slider and calibration panel input
    if (elements.mainYOffsetSlider) {
        elements.mainYOffsetSlider.value = cal.yOffset;
        elements.mainYOffsetValue.textContent = `${cal.yOffset}px`;
    }
    if (elements.calYOffsetInput) {
        elements.calYOffsetInput.value = cal.yOffset;
    }
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
        updatePresetStatus(status.message, 'exact');
        log(`Auto-loaded preset for ${width}x${height}`, LOG_LEVELS.SUCCESS);
        return true;
    } else if (status.type === 'scaled') {
        // Found aspect ratio match - we could scale, but for now just notify
        updatePresetStatus(status.message, 'scaled');
        log(`Found scaled preset match: ${status.message}`, LOG_LEVELS.INFO);
        return false;
    } else {
        updatePresetStatus(status.message, 'default');
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
    updatePresetStatus(`Preset saved: ${height}p`, 'exact');
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
        updatePresetStatus(`Using preset: ${preset.name}`, 'exact');
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
        updatePresetStatus('No preset - using defaults', 'default');
        log(`Deleted preset for ${width}x${height}`, LOG_LEVELS.WARNING);
    } else {
        showToast('No preset to delete');
    }
}

function updatePresetStatus(message, type = 'default') {
    if (elements.presetStatus) {
        elements.presetStatus.textContent = message;
    }

    // Update badge
    if (elements.presetBadge) {
        elements.presetBadge.className = 'preset-badge';
        if (type === 'exact') {
            elements.presetBadge.textContent = 'Exact match';
            elements.presetBadge.classList.add('exact');
        } else if (type === 'scaled') {
            elements.presetBadge.textContent = 'Scaled';
            elements.presetBadge.classList.add('scaled');
        } else {
            elements.presetBadge.textContent = 'Default';
            elements.presetBadge.classList.add('default');
        }
    }

    // Check for modifications
    updateModificationWarning();
}

function updateModificationWarning() {
    if (!elements.presetModified || !state.currentImage) return;

    const modified = wasPresetModified();
    const modifiedFieldsList = getModifiedFields();

    if (modified && modifiedFieldsList.length > 0) {
        elements.presetModified.style.display = 'inline';
        elements.modifiedFields.textContent = modifiedFieldsList.join(', ');
    } else {
        elements.presetModified.style.display = 'none';
    }
}

function getModifiedFields() {
    if (!state.currentImage) return [];

    const { width, height } = state.currentImage;
    const preset = presetManager.getPresetForResolution(width, height);

    if (!preset) return [];

    const cal = state.calibration;
    const presetCal = preset.calibration;
    const modified = [];

    if (cal.xOffset !== presetCal.xOffset) modified.push('X Offset');
    if (cal.yOffset !== presetCal.yOffset) modified.push('Y Offset');
    if (cal.iconWidth !== presetCal.iconWidth) modified.push('Icon Width');
    if (cal.iconHeight !== presetCal.iconHeight) modified.push('Icon Height');
    if (cal.xSpacing !== presetCal.xSpacing) modified.push('X Spacing');
    if (cal.ySpacing !== presetCal.ySpacing) modified.push('Y Spacing');
    if (cal.iconsPerRow !== presetCal.iconsPerRow) modified.push('Icons/Row');
    if (cal.numRows !== presetCal.numRows) modified.push('Rows');

    return modified;
}

// ========================================
// Get Current Calibration for Export
// ========================================

export function getCalibrationForExport() {
    const cal = state.calibration;
    const image = state.currentImage;

    // Calculate effective total items
    const maxSlots = cal.iconsPerRow * cal.numRows;
    const effectiveTotalItems = cal.totalItems > 0 ? Math.min(cal.totalItems, maxSlots) : maxSlots;

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
        total_items: effectiveTotalItems,
        // Computed values for this image's resolution
        computed: image
            ? {
                  scale: image.height / CONFIG.BASE_RESOLUTION,
                  scaled_icon_width: Math.round(cal.iconWidth * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_icon_height: Math.round(cal.iconHeight * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_x_spacing: Math.round(cal.xSpacing * (image.height / CONFIG.BASE_RESOLUTION)),
                  scaled_y_spacing: Math.round(cal.ySpacing * (image.height / CONFIG.BASE_RESOLUTION)),
                  total_slots: effectiveTotalItems,
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
