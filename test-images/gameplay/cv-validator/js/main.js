/* global Blob, performance, indexedDB, setTimeout, clearTimeout */
/* ========================================
 * CV Validator - Main Entry Point
 * Initialization, event wiring, export functionality
 * ======================================== */

import { state, resetDetectionState, presetManager } from './state.js';
import {
    log,
    clearLog,
    initLogger,
    LOG_LEVELS,
    parseSlotFilter,
    calculateMetrics,
    getEffectiveDetections,
    initToast,
    formatPercent,
} from './utils.js';
import {
    loadGroundTruth,
    loadItemsData,
    loadAllTemplates,
    loadImage,
    populateImageSelect,
    getGroundTruthForImage,
    loadTrainingDataIfAvailable,
    getAvailableSources,
    getEnabledSources,
    enableSource,
    disableSource,
    setEnabledSources,
    enableAllSources,
    getSourceSampleCounts,
} from './data-loader.js';
import { runDetection, loadSharedLibrary, setDetectionOptions, getDetectionOptions } from './cv-detection.js';
import {
    displayMetrics,
    displayGroundTruth,
    displayDetections,
    updateCorrectionsCounter,
    drawOverlay,
    drawGridPreview,
    updateProgress,
} from './ui-renderer.js';
import { initCorrectionPanel, openCorrectionPanel, closeCorrectionPanel } from './correction-panel.js';
import {
    initGridCalibration,
    updateResolutionInfo,
    autoLoadPresetForResolution,
    getCalibrationForExport,
    wasPresetModified,
    getPresetName,
    syncUIToState,
} from './grid-calibration.js';
import {
    initImageModal,
    openImageModal,
    closeImageModal,
    zoomImage,
    resetZoom,
    fitToScreen,
    drawModalOverlay,
    isModalOpen,
} from './image-modal.js';
import { initItemReference, populateItemReference } from './item-reference.js';
import { initBatchLabeling, toggleBatchMode, isBatchMode, selectItemInBatch } from './batch-labeling.js';
import { initActiveLearning } from './active-learning.js';
import { initTemplateManager } from './template-manager.js';
import { initAlgorithmEnsemble } from './algorithm-ensemble.js';
import { autoDetectGrid, compareWithPreset, drawDetectionOverlay } from './auto-grid-detection.js';
import {
    initAblationPanel,
    updateLiveMetrics,
    recordDetectionResult,
    updateResultsDisplay,
    updateImpactDisplay,
    setBatchAblationEnabled,
    getCurrentPipelineConfig,
    runBatchAblation,
} from './ablation-panel.js';
import { getAblationResults } from './pipeline-config.js';
import { initDebugPanel, updateDebugPanel } from './debug-panel.js';
import {
    getPrioritySlots,
    calculateUncertaintyScore,
    getSuggestedCorrections,
    getSessionStats,
    getConfusionPairs,
    getErrorProneItems,
} from './active-learning.js';

// ========================================
// DOM Element References
// ========================================

const elements = {
    // Controls
    imageSelect: document.getElementById('image-select'),
    confidenceSlider: document.getElementById('confidence-threshold'),
    confidenceValue: document.getElementById('confidence-value'),
    slotFilterInput: document.getElementById('slot-filter'),
    runDetectionBtn: document.getElementById('run-detection'),
    runAllBtn: document.getElementById('run-all'),
    exportValidatedBtn: document.getElementById('export-validated'),
    saveTrainingBtn: document.getElementById('save-training'),

    // Detection option toggles
    toggleEnhanced: document.getElementById('toggle-enhanced'),
    toggleTraining: document.getElementById('toggle-training'),
    trainingSourcesBtn: document.getElementById('training-sources-btn'),
    trainingSourcesDropdown: document.getElementById('training-sources-dropdown'),
    sourcesList: document.getElementById('sources-list'),
    sourcesSelectAll: document.getElementById('sources-select-all'),
    sourcesSelectNone: document.getElementById('sources-select-none'),

    // Main Y offset (in controls)
    mainYOffsetSlider: document.getElementById('grid-y-offset'),
    mainYOffsetValue: document.getElementById('grid-y-value'),

    // Slot filter helper
    slotFilterHelperBtn: document.getElementById('slot-filter-helper-btn'),
    slotFilterHelper: document.getElementById('slot-filter-helper'),

    // File System Status
    fsStatusBar: document.getElementById('fs-status-bar'),
    fsIcon: document.getElementById('fs-icon'),
    fsPath: document.getElementById('fs-path'),
    fsPermission: document.getElementById('fs-permission'),
    fsSelectDirBtn: document.getElementById('fs-select-dir'),
    fsClearDirBtn: document.getElementById('fs-clear-dir'),
    fsMethod: document.getElementById('fs-method'),

    // Screenshot panel
    screenshotImg: document.getElementById('screenshot-img'),
    overlayCanvas: document.getElementById('overlay-canvas'),
    imageInfo: document.getElementById('image-info'),

    // Detection panel
    detectedItemsDiv: document.getElementById('detected-items'),
    detectionCount: document.getElementById('detection-count'),
    progressFill: document.getElementById('progress-fill'),
    progressContainer: document.getElementById('progress-container'),
    detectionStatus: document.getElementById('detection-status'),
    correctionsCounter: document.getElementById('corrections-counter'),

    // Corrections breakdown dropdown
    correctionsDropdown: document.getElementById('corrections-dropdown'),
    breakdownVerified: document.getElementById('breakdown-verified'),
    breakdownCorrected: document.getElementById('breakdown-corrected'),
    breakdownEmpty: document.getElementById('breakdown-empty'),
    breakdownUnknown: document.getElementById('breakdown-unknown'),
    validationProgressFill: document.getElementById('validation-progress-fill'),
    validationPercent: document.getElementById('validation-percent'),

    // Batch progress indicator
    batchProgress: document.getElementById('batch-progress'),
    batchCurrentImage: document.getElementById('batch-current-image'),
    batchProgressCount: document.getElementById('batch-progress-count'),
    batchProgressFill: document.getElementById('batch-progress-fill'),
    batchRunningF1: document.getElementById('batch-running-f1'),
    batchCancelBtn: document.getElementById('batch-cancel'),

    // Batch labeling panel
    toggleBatchBtn: document.getElementById('toggle-batch'),
    batchPanel: document.getElementById('batch-panel'),
    batchLabelProgress: document.getElementById('batch-label-progress'),
    batchProgressBar: document.getElementById('batch-progress-bar'),
    batchSlotInfo: document.getElementById('batch-slot-info'),
    batchCurrentCrop: document.getElementById('batch-current-crop'),
    batchCurrentName: document.getElementById('batch-current-name'),
    batchCurrentConf: document.getElementById('batch-current-conf'),
    batchLabelStatus: document.getElementById('batch-label-status'),
    batchAlternatives: document.getElementById('batch-alternatives'),
    batchPrevBtn: document.getElementById('batch-prev'),
    batchNextBtn: document.getElementById('batch-next'),
    batchAcceptBtn: document.getElementById('batch-accept'),
    batchEmptyBtn: document.getElementById('batch-empty'),
    batchSkipBtn: document.getElementById('batch-skip'),
    batchFinishBtn: document.getElementById('batch-finish'),

    // Ground truth panel
    truthItemsDiv: document.getElementById('truth-items'),
    truthCount: document.getElementById('truth-count'),

    // Metrics
    metricF1: document.getElementById('metric-f1'),
    metricPrecision: document.getElementById('metric-precision'),
    metricRecall: document.getElementById('metric-recall'),
    metricDetected: document.getElementById('metric-detected'),

    // Log panel
    logContent: document.getElementById('log-content'),

    // Calibration panel (number inputs)
    gridCalibrationPanel: document.getElementById('grid-calibration-panel'),
    toggleCalibrationBtn: document.getElementById('toggle-grid-calibration'),
    resetCalibrationBtn: document.getElementById('reset-calibration'),
    gridXOffsetInput: document.getElementById('grid-x-offset'),
    calYOffsetInput: document.getElementById('cal-y-offset'),
    iconWidthInput: document.getElementById('icon-width'),
    iconHeightInput: document.getElementById('icon-height'),
    xSpacingInput: document.getElementById('x-spacing'),
    ySpacingInput: document.getElementById('y-spacing'),
    iconsPerRowInput: document.getElementById('icons-per-row'),
    numRowsInput: document.getElementById('num-rows'),
    totalItemsInput: document.getElementById('total-items'),
    resolutionInfo: document.getElementById('resolution-info'),
    scaleInfo: document.getElementById('scale-info'),
    presetStatus: document.getElementById('preset-status'),
    presetBadge: document.getElementById('preset-badge'),
    presetModified: document.getElementById('preset-modified'),
    modifiedFields: document.getElementById('modified-fields'),
    savePresetBtn: document.getElementById('save-preset'),
    loadPresetBtn: document.getElementById('load-preset'),
    deletePresetBtn: document.getElementById('delete-preset'),
    exportAllPresetsBtn: document.getElementById('export-all-presets'),

    // Advanced settings
    toggleAdvancedBtn: document.getElementById('toggle-advanced'),
    advancedSettings: document.getElementById('advanced-settings'),
    emptyVarianceSlider: document.getElementById('empty-variance'),
    emptyVarianceValue: document.getElementById('empty-variance-value'),
    templateMarginSlider: document.getElementById('template-margin'),
    templateMarginValue: document.getElementById('template-margin-value'),
    topMatchesSlider: document.getElementById('top-matches'),
    topMatchesValue: document.getElementById('top-matches-value'),
    resetAdvancedBtn: document.getElementById('reset-advanced'),

    // Auto-detect grid
    autoDetectBtn: document.getElementById('auto-detect-btn'),
    autoDetectStatus: document.getElementById('auto-detect-status'),
    autoDetectProgress: document.getElementById('auto-detect-progress'),
    autoDetectProgressFill: document.getElementById('auto-detect-progress-fill'),
    autoDetectProgressText: document.getElementById('auto-detect-progress-text'),
    autoDetectResults: document.getElementById('auto-detect-results'),
    autoDetectConfidence: document.getElementById('auto-detect-confidence'),
    autoDetectConfidenceFill: document.getElementById('auto-detect-confidence-fill'),
    autoDetectStats: document.getElementById('auto-detect-stats'),
    autoCells: document.getElementById('auto-cells'),
    autoValid: document.getElementById('auto-valid'),
    autoEmpty: document.getElementById('auto-empty'),
    toggleComparisonBtn: document.getElementById('toggle-comparison'),
    comparisonView: document.getElementById('comparison-view'),
    comparisonTableBody: document.getElementById('comparison-table-body'),
    comparisonSummary: document.getElementById('comparison-summary'),
    applyAutoDetectBtn: document.getElementById('apply-auto-detect'),
    toggleOverlayBtn: document.getElementById('toggle-overlay'),

    // Correction panel
    correctionPanel: document.getElementById('correction-panel'),
    correctionSlotBadge: document.getElementById('correction-slot-badge'),
    correctionCurrentImg: document.getElementById('correction-current-img'),
    correctionCurrentName: document.getElementById('correction-current-name'),
    correctionCurrentConf: document.getElementById('correction-current-conf'),
    quickPicksDiv: document.getElementById('quick-picks'),
    correctionSearchInput: document.getElementById('correction-search-input'),
    correctionFilters: document.getElementById('correction-filters'),
    correctionResultsDiv: document.getElementById('correction-results'),
    resultsCount: document.getElementById('results-count'),
    applyCorrectionBtn: document.getElementById('apply-correction-btn'),
    markCorrectBtn: document.getElementById('mark-correct-btn'),
    markEmptyBtn: document.getElementById('mark-empty-btn'),
    cancelCorrectionBtn: document.getElementById('cancel-correction-btn'),
    manualItemInput: document.getElementById('manual-item-input'),
    addManualItemBtn: document.getElementById('add-manual-item'),

    // Image modal
    imageModal: document.getElementById('image-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalLoading: document.getElementById('modal-loading'),
    modalImg: document.getElementById('modal-img'),
    modalOverlay: document.getElementById('modal-overlay'),
    zoomLevelSpan: document.getElementById('zoom-level'),

    // Item reference sidebar
    itemReferenceList: document.getElementById('item-reference-list'),
    itemSearch: document.getElementById('item-search'),
    refCount: document.getElementById('ref-count'),
    filterButtons: document.querySelectorAll('.sidebar .filter-btn'),

    // Toast
    copyToast: document.getElementById('copy-toast'),

    // Training toast
    trainingToast: document.getElementById('training-toast'),
    toastIcon: document.getElementById('toast-icon'),
    toastTitle: document.getElementById('toast-title'),
    toastClose: document.getElementById('toast-close'),
    toastFilename: document.getElementById('toast-filename'),
    toastCommand: document.getElementById('toast-command'),
    copyCmdBtn: document.getElementById('copy-cmd-btn'),

    // Export preview modal
    exportPreviewModal: document.getElementById('export-preview-modal'),
    previewFilename: document.getElementById('preview-filename'),
    previewDestination: document.getElementById('preview-destination'),
    previewSlots: document.getElementById('preview-slots'),
    previewCorrections: document.getElementById('preview-corrections'),
    previewCorrectionsDetail: document.getElementById('preview-corrections-detail'),
    previewCrops: document.getElementById('preview-crops'),
    previewUnknown: document.getElementById('preview-unknown'),
    previewSize: document.getElementById('preview-size'),
    previewCancel: document.getElementById('preview-cancel'),
    previewConfirm: document.getElementById('preview-confirm'),
    previewClose: document.getElementById('preview-close'),

    // Batch results modal
    batchResultsModal: document.getElementById('batch-results-modal'),
    batchTableBody: document.getElementById('batch-table-body'),
    batchAvgF1: document.getElementById('batch-avg-f1'),
    batchAvgPrecision: document.getElementById('batch-avg-precision'),
    batchAvgRecall: document.getElementById('batch-avg-recall'),
    batchClose: document.getElementById('batch-close'),
    batchExportCsv: document.getElementById('batch-export-csv'),
    batchExportJson: document.getElementById('batch-export-json'),
};

// ========================================
// Helper Functions
// ========================================

/**
 * Normalize item name to snake_case item_id
 * "The Glove of Midas" -> "the_glove_of_midas"
 */
function normalizeToItemId(name) {
    if (!name) return null;
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}

/**
 * Generate timestamp string for filenames
 * Returns format: 2024-01-20T14-30-00
 */
function generateTimestamp() {
    const now = new Date();
    return now
        .toISOString()
        .replace(/:/g, '-')
        .replace(/\.\d{3}Z$/, '');
}

// ========================================
// IndexedDB for Directory Handle Storage
// ========================================

const DB_NAME = 'cv-validator-storage';
const DB_VERSION = 1;
const STORE_NAME = 'directory-handles';
const HANDLE_KEY = 'validated-exports-dir';

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function saveDirectoryHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(handle, HANDLE_KEY);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
    });
}

async function loadDirectoryHandle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(HANDLE_KEY);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
        tx.oncomplete = () => db.close();
    });
}

// ========================================
// File System Access API
// ========================================

let cachedDirectoryHandle = null;

// Batch testing state
let batchResults = [];
let batchCancelled = false;
let trainingToastTimeout = null;

/**
 * Check if File System Access API is supported
 */
function isFileSystemAccessSupported() {
    return 'showDirectoryPicker' in window;
}

// ========================================
// File System Status UI
// ========================================

async function updateFileSystemStatus() {
    const supported = isFileSystemAccessSupported();

    if (!supported) {
        elements.fsPath.textContent = 'File System API not supported';
        elements.fsPath.classList.remove('has-dir');
        elements.fsPermission.textContent = '';
        elements.fsPermission.className = 'fs-permission';
        elements.fsMethod.textContent = 'Save method: Download fallback';
        elements.fsMethod.classList.remove('direct');
        elements.fsSelectDirBtn.style.display = 'none';
        elements.fsClearDirBtn.style.display = 'none';
        return;
    }

    if (cachedDirectoryHandle) {
        try {
            const permission = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
            elements.fsPath.textContent = cachedDirectoryHandle.name + '/';
            elements.fsPath.classList.add('has-dir');

            if (permission === 'granted') {
                elements.fsPermission.textContent = '\u2713';
                elements.fsPermission.className = 'fs-permission granted';
                elements.fsMethod.textContent = 'Save method: Direct write';
                elements.fsMethod.classList.add('direct');
            } else {
                elements.fsPermission.textContent = '\u26A0';
                elements.fsPermission.className = 'fs-permission stale';
                elements.fsMethod.textContent = 'Save method: Permission needed';
                elements.fsMethod.classList.remove('direct');
            }

            elements.fsSelectDirBtn.textContent = 'Change';
            elements.fsClearDirBtn.style.display = 'inline-block';
        } catch (error) {
            console.warn('[updateFileSystemStatus] Failed:', error.message);
            resetFileSystemStatus();
        }
    } else {
        resetFileSystemStatus();
    }
}

function resetFileSystemStatus() {
    elements.fsPath.textContent = 'No directory selected';
    elements.fsPath.classList.remove('has-dir');
    elements.fsPermission.textContent = '';
    elements.fsPermission.className = 'fs-permission';
    elements.fsMethod.textContent = 'Save method: Download fallback';
    elements.fsMethod.classList.remove('direct');
    elements.fsSelectDirBtn.textContent = 'Select Directory';
    elements.fsClearDirBtn.style.display = 'none';
}

async function clearDirectoryHandle() {
    cachedDirectoryHandle = null;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(HANDLE_KEY);
        tx.oncomplete = () => db.close();
    } catch (error) {
        console.warn('[clearDirectoryHandle] Failed to clear from IndexedDB:', error.message);
    }
    updateFileSystemStatus();
    log('Directory cleared', LOG_LEVELS.INFO);
}

/**
 * Get or prompt for the validated-exports directory
 */
async function getValidatedExportsDirectory() {
    // Try to use cached handle first
    if (cachedDirectoryHandle) {
        try {
            // Verify we still have permission
            const permission = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                return cachedDirectoryHandle;
            }
            // Try to request permission again
            const newPermission = await cachedDirectoryHandle.requestPermission({ mode: 'readwrite' });
            if (newPermission === 'granted') {
                return cachedDirectoryHandle;
            }
        } catch (error) {
            // Handle is stale, clear it
            console.warn('[getValidatedExportsDirectory] Cached handle stale:', error.message);
            cachedDirectoryHandle = null;
        }
    }

    // Try to load from IndexedDB
    try {
        const storedHandle = await loadDirectoryHandle();
        if (storedHandle) {
            const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                cachedDirectoryHandle = storedHandle;
                return storedHandle;
            }
            // Try to request permission
            const newPermission = await storedHandle.requestPermission({ mode: 'readwrite' });
            if (newPermission === 'granted') {
                cachedDirectoryHandle = storedHandle;
                return storedHandle;
            }
        }
    } catch (error) {
        console.warn('[getValidatedExportsDirectory] Failed to load from IndexedDB:', error.message);
    }

    // Prompt user to select directory
    try {
        const handle = await window.showDirectoryPicker({
            id: 'validated-exports',
            mode: 'readwrite',
            startIn: 'documents',
        });
        cachedDirectoryHandle = handle;
        await saveDirectoryHandle(handle);
        log('Directory selected and saved for future use', LOG_LEVELS.SUCCESS);
        updateFileSystemStatus();
        return handle;
    } catch (err) {
        if (err.name === 'AbortError') {
            log('Directory selection cancelled', LOG_LEVELS.WARNING);
        } else {
            log(`Failed to select directory: ${err.message}`, LOG_LEVELS.ERROR);
        }
        return null;
    }
}

/**
 * Save data directly to the validated-exports directory
 * Returns true if successful, false if fallback needed
 */
async function saveToTrainingDirectory(data, filename) {
    if (!isFileSystemAccessSupported()) {
        log('File System Access API not supported - using download fallback', LOG_LEVELS.WARNING);
        return false;
    }

    try {
        const dirHandle = await getValidatedExportsDirectory();
        if (!dirHandle) {
            return false;
        }

        // Create JSON file in the directory
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();

        log(`✓ Saved to: ${filename}`, LOG_LEVELS.SUCCESS);

        // Also save a copy of the source image for reference
        await saveSourceImageCopy(dirHandle, filename);

        return true;
    } catch (err) {
        log(`Failed to save to directory: ${err.message}`, LOG_LEVELS.ERROR);
        return false;
    }
}

/**
 * Save a copy of the source screenshot image alongside the JSON export
 * This preserves the original image in case the source file is renamed/moved
 */
async function saveSourceImageCopy(dirHandle, jsonFilename) {
    if (!state.currentImage || !state.currentImage.canvas) {
        log('No source image to save', LOG_LEVELS.WARNING);
        return;
    }

    try {
        // Generate image filename (same as JSON but with .png extension)
        const imageFilename = jsonFilename.replace('.json', '.png');

        // Use the already-loaded canvas which has the image drawn on it
        const blob = await new Promise(resolve => state.currentImage.canvas.toBlob(resolve, 'image/png'));

        // Save to directory
        const imageHandle = await dirHandle.getFileHandle(imageFilename, { create: true });
        const writable = await imageHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        log(`✓ Source image saved: ${imageFilename}`, LOG_LEVELS.SUCCESS);
    } catch (err) {
        log(`Warning: Could not save source image copy: ${err.message}`, LOG_LEVELS.WARNING);
        // Don't fail the whole save if image copy fails
    }
}

function getSlotFilter() {
    return parseSlotFilter(elements.slotFilterInput.value);
}

// ========================================
// Enhanced Training Toast
// ========================================

function showTrainingToast(filename, isDirect) {
    // Clear any existing timeout
    if (trainingToastTimeout) {
        clearTimeout(trainingToastTimeout);
    }

    // Update toast content
    elements.toastFilename.textContent = filename;
    elements.toastTitle.textContent = isDirect ? 'Saved successfully' : 'Downloaded - move to validated-exports/';
    elements.toastIcon.textContent = isDirect ? '\u2713' : '\u26A0';

    // Toggle fallback styling
    if (isDirect) {
        elements.trainingToast.classList.remove('fallback');
    } else {
        elements.trainingToast.classList.add('fallback');
    }

    // Show toast
    elements.trainingToast.classList.add('show');

    // Auto-dismiss after 10 seconds
    trainingToastTimeout = setTimeout(() => {
        elements.trainingToast.classList.remove('show');
    }, 10000);
}

function hideTrainingToast() {
    if (trainingToastTimeout) {
        clearTimeout(trainingToastTimeout);
    }
    elements.trainingToast.classList.remove('show');
}

async function copyCommand() {
    const command = elements.toastCommand.textContent;
    try {
        await navigator.clipboard.writeText(command);
        elements.copyCmdBtn.classList.add('copied');
        elements.copyCmdBtn.textContent = '\u2713';
        setTimeout(() => {
            elements.copyCmdBtn.classList.remove('copied');
            elements.copyCmdBtn.textContent = '\uD83D\uDCCB';
        }, 2000);
    } catch {
        log('Failed to copy command', LOG_LEVELS.WARNING);
    }
}

// ========================================
// Export Preview Modal
// ========================================

function showExportPreview() {
    const data = generateValidatedData();
    if (!data) {
        log('No detection data to preview', LOG_LEVELS.ERROR);
        return;
    }

    const filename = generateExportFilename();

    // Update preview content
    elements.previewFilename.textContent = filename;
    elements.previewDestination.textContent = cachedDirectoryHandle
        ? cachedDirectoryHandle.name + '/'
        : 'Downloads folder (fallback)';

    elements.previewSlots.textContent = data.summary.total_slots_detected;
    elements.previewCorrections.textContent = data.summary.corrections_made;

    // Breakdown detail
    const correctedCount = [...state.corrections.values()].filter(c => c.corrected && !c.verified).length;
    const emptyCount = [...state.corrections.values()].filter(c => c.corrected === null).length;
    const verifiedCount = [...state.corrections.values()].filter(c => c.verified).length;
    elements.previewCorrectionsDetail.textContent = `${verifiedCount} verified, ${correctedCount} corrected, ${emptyCount} empty`;

    elements.previewCrops.textContent = data.summary.training_crops_count;
    elements.previewUnknown.textContent = data.summary.unknown_items;

    // Estimate size
    const jsonStr = JSON.stringify(data, null, 2);
    const sizeKB = Math.round(jsonStr.length / 1024);
    elements.previewSize.textContent = `~${sizeKB} KB`;

    // Show modal
    elements.exportPreviewModal.classList.add('show');
}

function hideExportPreview() {
    elements.exportPreviewModal.classList.remove('show');
}

// ========================================
// Batch Test Results Modal
// ========================================

function showBatchResultsModal() {
    if (batchResults.length === 0) return;

    // Clear table body
    elements.batchTableBody.innerHTML = '';

    // Calculate averages
    let totalF1 = 0,
        totalPrecision = 0,
        totalRecall = 0;
    for (const r of batchResults) {
        totalF1 += r.f1;
        totalPrecision += r.precision;
        totalRecall += r.recall;
    }

    const avgF1 = totalF1 / batchResults.length;
    const avgPrecision = totalPrecision / batchResults.length;
    const avgRecall = totalRecall / batchResults.length;

    elements.batchAvgF1.textContent = formatPercent(avgF1);
    elements.batchAvgPrecision.textContent = formatPercent(avgPrecision);
    elements.batchAvgRecall.textContent = formatPercent(avgRecall);

    // Sort by F1 ascending (worst first)
    const sortedResults = [...batchResults].sort((a, b) => a.f1 - b.f1);

    // Populate table
    for (const r of sortedResults) {
        const row = document.createElement('tr');

        // Determine status class
        let statusClass = 'bad';
        if (r.f1 >= 0.8) statusClass = 'good';
        else if (r.f1 >= 0.5) statusClass = 'warning';
        row.className = statusClass;

        row.innerHTML = `
            <td><span class="status-dot ${statusClass}"></span>${r.image}</td>
            <td>${formatPercent(r.f1)}</td>
            <td>${formatPercent(r.precision)}</td>
            <td>${formatPercent(r.recall)}</td>
            <td>${r.detected}/${r.expected}</td>
        `;

        elements.batchTableBody.appendChild(row);
    }

    // Show modal
    elements.batchResultsModal.classList.add('show');
}

function hideBatchResultsModal() {
    elements.batchResultsModal.classList.remove('show');
}

function exportBatchResultsCsv() {
    if (batchResults.length === 0) return;

    let csv = 'Image,F1,Precision,Recall,Detected,Expected\n';
    for (const r of batchResults) {
        csv += `${r.image},${r.f1.toFixed(4)},${r.precision.toFixed(4)},${r.recall.toFixed(4)},${r.detected},${r.expected}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${generateTimestamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log('Exported batch results as CSV', LOG_LEVELS.SUCCESS);
}

function exportBatchResultsJson() {
    if (batchResults.length === 0) return;

    const data = {
        timestamp: new Date().toISOString(),
        results: batchResults,
        summary: {
            total_tests: batchResults.length,
            avg_f1: batchResults.reduce((s, r) => s + r.f1, 0) / batchResults.length,
            avg_precision: batchResults.reduce((s, r) => s + r.precision, 0) / batchResults.length,
            avg_recall: batchResults.reduce((s, r) => s + r.recall, 0) / batchResults.length,
        },
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${generateTimestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log('Exported batch results as JSON', LOG_LEVELS.SUCCESS);
}

// Table sorting for batch results
let currentSortColumn = 'f1';
let currentSortDir = 'asc';

function sortBatchTable(column) {
    if (currentSortColumn === column) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDir = 'asc';
    }

    // Update header styling
    document.querySelectorAll('.batch-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.sort === column) {
            th.classList.add(currentSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    });

    // Sort results
    batchResults.sort((a, b) => {
        let va = a[column];
        let vb = b[column];

        if (column === 'detected') {
            va = a.detected / a.expected;
            vb = b.detected / b.expected;
        }

        if (currentSortDir === 'asc') {
            return va < vb ? -1 : va > vb ? 1 : 0;
        } else {
            return va > vb ? -1 : va < vb ? 1 : 0;
        }
    });

    // Re-render table
    showBatchResultsModal();
}

// ========================================
// Corrections Breakdown
// ========================================

function updateCorrectionsBreakdown() {
    let verified = 0,
        corrected = 0,
        empty = 0,
        unknown = 0;

    for (const correction of state.corrections.values()) {
        if (correction.verified) {
            verified++;
        } else if (correction.corrected === null) {
            empty++;
        } else if (correction.is_unknown) {
            unknown++;
            corrected++;
        } else {
            corrected++;
        }
    }

    elements.breakdownVerified.textContent = verified;
    elements.breakdownCorrected.textContent = corrected;
    elements.breakdownEmpty.textContent = empty;
    elements.breakdownUnknown.textContent = unknown;

    // Calculate validation progress
    const totalSlots = state.detectionsBySlot.size + state.emptyCells.size;
    const validatedSlots = state.corrections.size;
    const percent = totalSlots > 0 ? Math.round((validatedSlots / totalSlots) * 100) : 0;

    elements.validationProgressFill.style.width = `${percent}%`;
    elements.validationPercent.textContent = `${percent}% validated`;
}

function toggleCorrectionsDropdown() {
    elements.correctionsDropdown.classList.toggle('show');
}

// ========================================
// Slot Filter Helper
// ========================================

function toggleSlotFilterHelper() {
    elements.slotFilterHelper.classList.toggle('show');
}

function applySlotFilterPreset(filter) {
    if (filter === 'all') {
        elements.slotFilterInput.value = '';
    } else if (filter.includes('-')) {
        // Range format like "0-19"
        const [start, end] = filter.split('-').map(Number);
        const indices = [];
        for (let i = start; i <= end; i++) {
            indices.push(i);
        }
        elements.slotFilterInput.value = indices.join(',');
    } else {
        elements.slotFilterInput.value = filter;
    }

    elements.slotFilterHelper.classList.remove('show');
    updateGridDisplay();
}

// ========================================
// Advanced Settings
// ========================================

function toggleAdvancedSettings() {
    const isHidden = elements.advancedSettings.style.display === 'none';
    elements.advancedSettings.style.display = isHidden ? 'block' : 'none';
    elements.toggleAdvancedBtn.textContent = isHidden ? 'Advanced Settings \u25B2' : 'Advanced Settings \u25BC';
}

function initAdvancedSettings() {
    // Empty variance
    elements.emptyVarianceSlider.addEventListener('input', e => {
        const value = parseInt(e.target.value);
        elements.emptyVarianceValue.textContent = value;
        // Note: This would need to be connected to CONFIG in cv-detection.js
        // For now, we store it in a local override
    });

    // Template margin
    elements.templateMarginSlider.addEventListener('input', e => {
        const value = parseInt(e.target.value);
        elements.templateMarginValue.textContent = `${value}%`;
    });

    // Top matches
    elements.topMatchesSlider.addEventListener('input', e => {
        const value = parseInt(e.target.value);
        elements.topMatchesValue.textContent = value;
    });

    // Reset advanced
    elements.resetAdvancedBtn.addEventListener('click', () => {
        elements.emptyVarianceSlider.value = 300;
        elements.emptyVarianceValue.textContent = '300';
        elements.templateMarginSlider.value = 15;
        elements.templateMarginValue.textContent = '15%';
        elements.topMatchesSlider.value = 5;
        elements.topMatchesValue.textContent = '5';
        log('Reset advanced settings to defaults', LOG_LEVELS.INFO);
    });
}

// ========================================
// Auto-Detect Grid
// ========================================

// Store last auto-detection result for overlay toggle
let lastAutoDetectResult = null;
let showAutoDetectOverlay = false;

/**
 * Convert failure reason codes to human-readable messages
 */
function formatFailureReason(reasonCode) {
    const reasonMessages = {
        no_vertical_clusters: 'Could not find vertical grid lines',
        icons_too_small: 'Detected icons are too small (< 22px)',
        likely_empty_screen: 'Image appears to have no item hotbar',
        inconsistent_detection: 'Detection results are inconsistent',
        exception_thrown: 'An error occurred during detection',
        insufficient_contrast: 'Image has insufficient contrast',
        no_rarity_borders: 'No rarity border colors detected',
    };
    return reasonMessages[reasonCode] || reasonCode;
}

/**
 * Format multiple failure reasons for display
 */
function formatFailureReasons(reasons) {
    if (!reasons || reasons.length === 0) return null;
    return reasons.map(formatFailureReason);
}

function initAutoDetect() {
    if (!elements.autoDetectBtn) return;

    // Auto-detect button click
    elements.autoDetectBtn.addEventListener('click', handleAutoDetect);

    // Apply auto-detected calibration
    if (elements.applyAutoDetectBtn) {
        elements.applyAutoDetectBtn.addEventListener('click', applyAutoDetectedCalibration);
    }

    // Toggle comparison view
    if (elements.toggleComparisonBtn) {
        elements.toggleComparisonBtn.addEventListener('click', () => {
            const isHidden = elements.comparisonView.style.display === 'none';
            elements.comparisonView.style.display = isHidden ? 'block' : 'none';
            elements.toggleComparisonBtn.textContent = isHidden
                ? 'Compare with Preset \u25B2'
                : 'Compare with Preset \u25BC';
        });
    }

    // Toggle overlay
    if (elements.toggleOverlayBtn) {
        elements.toggleOverlayBtn.addEventListener('click', toggleAutoDetectOverlay);
    }
}

async function handleAutoDetect() {
    if (!state.currentImage) {
        log('No image loaded', LOG_LEVELS.WARNING);
        return;
    }

    elements.autoDetectBtn.disabled = true;
    elements.autoDetectProgress.style.display = 'flex';
    elements.autoDetectResults.style.display = 'none';

    try {
        const result = await autoDetectGrid(
            state.currentImage.ctx,
            state.currentImage.width,
            state.currentImage.height,
            {
                progressCallback: (percent, message) => {
                    elements.autoDetectProgressFill.style.width = `${percent}%`;
                    elements.autoDetectProgressText.textContent = message || `${Math.round(percent)}%`;
                },
            }
        );

        if (result.success) {
            // Only cache successful results
            lastAutoDetectResult = result;
            displayAutoDetectResults(result);

            // Show warnings if there were issues even on success
            if (result.reasons && result.reasons.length > 0) {
                const formattedReasons = formatFailureReasons(result.reasons);
                log(`Detection warnings: ${formattedReasons.join(', ')}`, LOG_LEVELS.WARNING);
            }
        } else {
            // Clear stale cache on failure
            lastAutoDetectResult = null;

            // Display failure reasons in status area
            let statusMessage = `Failed: ${result.error}`;
            if (result.reasons && result.reasons.length > 0) {
                const formattedReasons = formatFailureReasons(result.reasons);
                statusMessage = `Failed: ${formattedReasons[0]}`;
                // Log all reasons
                log(`Auto-detection failed:`, LOG_LEVELS.ERROR);
                formattedReasons.forEach(reason => log(`  - ${reason}`, LOG_LEVELS.ERROR));
            } else {
                log(`Auto-detection failed: ${result.error}`, LOG_LEVELS.ERROR);
            }

            elements.autoDetectStatus.textContent = statusMessage;
            // Add tooltip with all reasons if there are multiple
            if (result.reasons && result.reasons.length > 1) {
                elements.autoDetectStatus.title = formatFailureReasons(result.reasons).join('\n');
            } else {
                elements.autoDetectStatus.title = '';
            }
        }
    } catch (error) {
        log(`Auto-detection error: ${error.message}`, LOG_LEVELS.ERROR);
        elements.autoDetectStatus.textContent = 'Error';
    } finally {
        elements.autoDetectBtn.disabled = false;
        elements.autoDetectProgress.style.display = 'none';
    }
}

function displayAutoDetectResults(result) {
    elements.autoDetectResults.style.display = 'block';

    // Confidence
    const confidencePercent = Math.round(result.confidence * 100);
    elements.autoDetectConfidence.textContent = `${confidencePercent}%`;
    elements.autoDetectConfidenceFill.style.width = `${confidencePercent}%`;

    // Color-code confidence
    if (confidencePercent >= 70) {
        elements.autoDetectConfidence.style.color = 'var(--success)';
    } else if (confidencePercent >= 40) {
        elements.autoDetectConfidence.style.color = 'var(--warning)';
    } else {
        elements.autoDetectConfidence.style.color = 'var(--error)';
    }

    // Stats
    elements.autoCells.textContent = result.validation.totalCells;
    elements.autoValid.textContent = result.validation.stats.valid;
    elements.autoEmpty.textContent = result.validation.stats.empty;

    // Build comparison table
    buildComparisonTable(result);

    // Status message
    const cal = result.calibration;
    elements.autoDetectStatus.textContent = `Detected ${cal.iconsPerRow}x${cal.numRows} grid, ${cal.iconWidth}x${cal.iconHeight}px icons`;

    log(
        `Auto-detection complete: ${result.validation.stats.valid} valid cells, confidence ${confidencePercent}%`,
        LOG_LEVELS.SUCCESS
    );
}

function buildComparisonTable(result) {
    if (!elements.comparisonTableBody) return;

    // Get current preset/calibration
    const currentCal = state.calibration;
    const autoCal = result.calibration;

    const comparison = compareWithPreset(autoCal, currentCal);

    if (!comparison) {
        elements.comparisonTableBody.innerHTML = '<tr><td colspan="4">No preset to compare</td></tr>';
        return;
    }

    const fields = [
        { key: 'iconWidth', label: 'Icon Width' },
        { key: 'iconHeight', label: 'Icon Height' },
        { key: 'xSpacing', label: 'X Spacing' },
        { key: 'ySpacing', label: 'Y Spacing' },
        { key: 'xOffset', label: 'X Offset' },
        { key: 'yOffset', label: 'Y Offset' },
        { key: 'iconsPerRow', label: 'Icons/Row' },
        { key: 'numRows', label: 'Rows' },
    ];

    let html = '';
    for (const field of fields) {
        const comp = comparison[field.key];
        if (!comp) continue;

        let diffClass = 'match';
        if (comp.diff > 0) {
            diffClass = comp.isClose ? 'diff' : 'big-diff';
        }

        const diffStr = comp.diff === 0 ? '-' : comp.diff > 0 ? `+${comp.diff}` : comp.diff;

        html += `<tr>
            <td>${field.label}</td>
            <td>${comp.auto}</td>
            <td>${comp.preset}</td>
            <td class="${diffClass}">${diffStr}</td>
        </tr>`;
    }

    elements.comparisonTableBody.innerHTML = html;

    // Summary
    elements.comparisonSummary.textContent = `Match score: ${comparison.matchScore.toFixed(0)}% - ${comparison.recommendation}`;
}

function applyAutoDetectedCalibration() {
    // Validate that we have a successful result with calibration data
    if (!lastAutoDetectResult) {
        log('No auto-detected calibration to apply', LOG_LEVELS.WARNING);
        return;
    }

    if (!lastAutoDetectResult.success) {
        log('Cannot apply failed auto-detection result', LOG_LEVELS.ERROR);
        return;
    }

    if (!lastAutoDetectResult.calibration) {
        log('Auto-detection result missing calibration data', LOG_LEVELS.ERROR);
        return;
    }

    const cal = lastAutoDetectResult.calibration;

    // Apply to state
    state.calibration.iconWidth = cal.iconWidth;
    state.calibration.iconHeight = cal.iconHeight;
    state.calibration.xSpacing = cal.xSpacing;
    state.calibration.ySpacing = cal.ySpacing;
    state.calibration.xOffset = cal.xOffset;
    state.calibration.yOffset = cal.yOffset;
    state.calibration.iconsPerRow = cal.iconsPerRow;
    state.calibration.numRows = cal.numRows;
    state.calibration.totalItems = cal.totalItems || cal.iconsPerRow * cal.numRows;

    // Sync UI to state
    syncUIToState();

    // Refresh grid display
    updateGridDisplay();

    log('Applied auto-detected calibration', LOG_LEVELS.SUCCESS);
}

function toggleAutoDetectOverlay() {
    showAutoDetectOverlay = !showAutoDetectOverlay;
    elements.toggleOverlayBtn.classList.toggle('active', showAutoDetectOverlay);

    if (showAutoDetectOverlay && lastAutoDetectResult) {
        // Draw overlay on the main canvas
        const ctx = elements.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
        drawDetectionOverlay(ctx, lastAutoDetectResult, {
            showBand: true,
            showEdges: true,
            showGrid: true,
            showLabels: true,
        });
    } else {
        // Redraw normal grid
        updateGridDisplay();
    }
}

// ========================================
// Training Sources Dropdown
// ========================================

function populateSourcesDropdown() {
    const sources = getAvailableSources();
    const enabledSet = new Set(getEnabledSources());
    const counts = getSourceSampleCounts();

    if (sources.length === 0) {
        elements.sourcesList.innerHTML = '<p class="sources-loading">No training data loaded</p>';
        return;
    }

    elements.sourcesList.innerHTML = '';

    for (const source of sources) {
        const count = counts.get(source) || 0;
        const isEnabled = enabledSet.has(source);

        // Create a friendlier display name
        const displayName = source.replace(/\.jpg$|\.png$/i, '').replace(/^pc-\d+p\//, '');

        const item = document.createElement('div');
        item.className = 'source-item';
        item.innerHTML = `
            <input type="checkbox" id="source-${source}" data-source="${source}" ${isEnabled ? 'checked' : ''}>
            <label for="source-${source}">${displayName}</label>
            <span class="source-count">${count}</span>
        `;

        // Handle checkbox change
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', e => {
            if (e.target.checked) {
                enableSource(source);
            } else {
                disableSource(source);
            }
            log(`Training source "${displayName}": ${e.target.checked ? 'ON' : 'OFF'}`, LOG_LEVELS.INFO);

            // Auto re-run if we have results
            if (state.currentImage && state.detectionsBySlot.size > 0) {
                handleRunDetection();
            }
        });

        elements.sourcesList.appendChild(item);
    }
}

function toggleSourcesDropdown() {
    const isShown = elements.trainingSourcesDropdown.classList.toggle('show');
    if (isShown) {
        populateSourcesDropdown();
    }
}

function selectAllSources() {
    enableAllSources();
    populateSourcesDropdown();
    log('All training sources enabled', LOG_LEVELS.INFO);
    if (state.currentImage && state.detectionsBySlot.size > 0) {
        handleRunDetection();
    }
}

function selectNoSources() {
    setEnabledSources([]);
    populateSourcesDropdown();
    log('All training sources disabled', LOG_LEVELS.INFO);
    if (state.currentImage && state.detectionsBySlot.size > 0) {
        handleRunDetection();
    }
}

function updateGridDisplay() {
    if (state.currentImage && state.detectionsBySlot.size > 0) {
        drawOverlay(
            elements.overlayCanvas,
            state.lastDetections,
            state.currentImage.width,
            state.currentImage.height,
            getSlotFilter()
        );
    } else if (state.currentImage) {
        drawGridPreview(elements.overlayCanvas, state.currentImage.width, state.currentImage.height, getSlotFilter());
    }
    if (isModalOpen()) {
        drawModalOverlay();
    }
}

function recalculateAndDisplay() {
    if (!state.currentImagePath) return;

    const truthData = getGroundTruthForImage(state.currentImagePath);
    const truthItems = truthData?.items || [];

    // Recalculate using effective detections
    const effectiveDetections = getEffectiveDetections();

    // Convert to format expected by calculateMetrics
    const metricsDetections = effectiveDetections.filter(d => d.name).map(d => ({ item: { name: d.name } }));

    const metrics = calculateMetrics(metricsDetections, truthItems);
    displayMetrics(metrics, {
        f1Elem: elements.metricF1,
        precisionElem: elements.metricPrecision,
        recallElem: elements.metricRecall,
        detectedElem: elements.metricDetected,
    });

    // Redraw overlay with correction highlights
    updateGridDisplay();

    // Refresh detection list
    displayDetections(
        state.lastDetections,
        truthItems,
        elements.detectedItemsDiv,
        elements.detectionCount,
        openCorrectionPanel
    );

    // Update corrections counter and breakdown
    updateCorrectionsCounter(elements.correctionsCounter);
    updateCorrectionsBreakdown();
}

// ========================================
// Export Functionality
// ========================================

function generateValidatedData() {
    if (!state.currentImagePath || (state.detectionsBySlot.size === 0 && state.emptyCells.size === 0)) return null;

    const slots = {};
    const trainingCrops = {};

    // Process all detected slots
    for (const [slotIndex, slotData] of state.detectionsBySlot) {
        const correction = state.corrections.get(slotIndex);
        const original = slotData.detection;
        const position = slotData.position;

        if (correction) {
            // This slot was corrected
            slots[slotIndex] = {
                item: correction.corrected, // null if marked empty
                original_detection: original.item.name,
                original_confidence: Math.round(original.confidence * 1000) / 1000,
                was_corrected: true,
                is_unknown: correction.is_unknown || false,
                verified: correction.verified || false,
                position: { x: position.x, y: position.y, w: position.width, h: position.height },
            };

            // Add to training crops if verified or corrected with an item
            if (correction.corrected && slotData.cropDataURL) {
                trainingCrops[slotIndex] = {
                    item_name: correction.corrected,
                    item_id: normalizeToItemId(correction.corrected),
                    crop_base64: slotData.cropDataURL,
                    crop_dimensions: { w: position.width, h: position.height },
                    source_image: state.currentImagePath,
                    source_resolution: state.currentImage
                        ? `${state.currentImage.width}x${state.currentImage.height}`
                        : null,
                    validation_type: correction.verified ? 'verified' : 'corrected',
                    confidence_original: Math.round(original.confidence * 1000) / 1000,
                    is_unknown: correction.is_unknown || false,
                };
            }
        } else {
            // This slot was accepted as-is (not corrected = validated as correct)
            slots[slotIndex] = {
                item: original.item.name,
                original_detection: original.item.name,
                original_confidence: Math.round(original.confidence * 1000) / 1000,
                was_corrected: false,
                position: { x: position.x, y: position.y, w: position.width, h: position.height },
            };
        }

        // Add top alternatives for analysis
        if (slotData.topMatches) {
            slots[slotIndex].alternatives = slotData.topMatches.slice(1, 4).map(m => ({
                item: m.item.name,
                confidence: Math.round(m.confidence * 1000) / 1000,
            }));
        }
    }

    // Process empty cells that were corrected to have items
    for (const [slotIndex, emptyData] of state.emptyCells) {
        const correction = state.corrections.get(slotIndex);
        if (correction && correction.fromEmpty && correction.corrected) {
            const position = emptyData.position;
            slots[slotIndex] = {
                item: correction.corrected,
                original_detection: null,
                original_confidence: 0,
                was_corrected: true,
                from_empty: true,
                is_unknown: correction.is_unknown || false,
                position: { x: position.x, y: position.y, w: position.width, h: position.height },
            };

            // Add to training crops
            if (emptyData.cropDataURL) {
                trainingCrops[slotIndex] = {
                    item_name: correction.corrected,
                    item_id: normalizeToItemId(correction.corrected),
                    crop_base64: emptyData.cropDataURL,
                    crop_dimensions: { w: position.width, h: position.height },
                    source_image: state.currentImagePath,
                    source_resolution: state.currentImage
                        ? `${state.currentImage.width}x${state.currentImage.height}`
                        : null,
                    validation_type: 'corrected_from_empty',
                    confidence_original: 0,
                    is_unknown: correction.is_unknown || false,
                };
            }
        }
    }

    // Calculate validated metrics
    const truthData = getGroundTruthForImage(state.currentImagePath);
    const truthItems = truthData?.items || [];
    const validatedItems = Object.values(slots)
        .filter(s => s.item !== null)
        .map(s => s.item);

    // Count matches
    const truthCounts = new Map();
    for (const name of truthItems) {
        truthCounts.set(name, (truthCounts.get(name) || 0) + 1);
    }
    const validatedCounts = new Map();
    for (const name of validatedItems) {
        validatedCounts.set(name, (validatedCounts.get(name) || 0) + 1);
    }

    let truePositives = 0;
    for (const [name, count] of validatedCounts) {
        const truthCount = truthCounts.get(name) || 0;
        truePositives += Math.min(count, truthCount);
    }

    // Get calibration info with preset details
    const calibrationExport = getCalibrationForExport();
    const presetName = getPresetName();
    const presetModified = wasPresetModified();

    return {
        image: state.currentImagePath,
        validated_at: new Date().toISOString(),
        image_dimensions: state.currentImage
            ? { width: state.currentImage.width, height: state.currentImage.height }
            : null,
        detection_threshold: parseFloat(elements.confidenceSlider.value),
        grid_calibration: {
            ...calibrationExport,
            preset_used: presetName,
            preset_modified: presetModified,
        },
        summary: {
            total_slots_detected: state.detectionsBySlot.size,
            total_empty_cells: state.emptyCells.size,
            corrections_made: state.corrections.size,
            items_marked_empty: [...state.corrections.values()].filter(c => c.corrected === null).length,
            items_from_empty: [...state.corrections.values()].filter(c => c.fromEmpty).length,
            unknown_items: [...state.corrections.values()].filter(c => c.is_unknown).length,
            ground_truth_count: truthItems.length,
            validated_items_count: validatedItems.length,
            true_positives: truePositives,
            training_crops_count: Object.keys(trainingCrops).length,
        },
        slots: slots,
        ground_truth: truthItems,
        training_crops: trainingCrops,
    };
}

/**
 * Generate filename with timestamp
 * Format: validated_level-1_2024-01-20T14-30-00.json
 */
function generateExportFilename() {
    const imageName = state.currentImagePath.replace(/\//g, '_').replace(/\.[^.]+$/, '');
    const timestamp = generateTimestamp();
    return `validated_${imageName}_${timestamp}.json`;
}

function exportValidatedData() {
    const data = generateValidatedData();
    if (!data) {
        log('No detection data to export', LOG_LEVELS.ERROR);
        return;
    }

    // Generate filename with timestamp
    const filename = generateExportFilename();

    // Create and download file
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log(`Exported: ${filename}`, LOG_LEVELS.SUCCESS);
    log(
        `  - ${data.summary.total_slots_detected} slots, ${data.summary.corrections_made} corrections`,
        LOG_LEVELS.INFO
    );
}

/**
 * Save training data directly to validated-exports directory
 * Uses File System Access API if available, falls back to download
 */
async function saveTrainingData() {
    // Show export preview modal
    showExportPreview();
}

/**
 * Actually perform the save after preview confirmation
 */
async function doSaveTrainingData() {
    const data = generateValidatedData();
    if (!data) {
        log('No detection data to save', LOG_LEVELS.ERROR);
        return;
    }

    const filename = generateExportFilename();

    // Try direct save first
    const saved = await saveToTrainingDirectory(data, filename);

    if (saved) {
        log(`Training data saved!`, LOG_LEVELS.SUCCESS);
        log(`  - ${data.summary.training_crops_count} training crops`, LOG_LEVELS.INFO);
        log(`  - Run: npm run import:training`, LOG_LEVELS.INFO);
        showTrainingToast(filename, true);
    } else {
        // Fallback to download
        log('Using download fallback...', LOG_LEVELS.WARNING);
        exportValidatedData();
        log('Move the file to validated-exports/ and run: npm run import:training', LOG_LEVELS.INFO);
        showTrainingToast(filename, false);
    }

    // Hide preview modal
    hideExportPreview();
}

// ========================================
// Event Handlers
// ========================================

async function handleImageSelect(e) {
    const imagePath = e.target.value;
    if (!imagePath) return;

    state.currentImagePath = imagePath;
    clearLog();
    log(`Selected: ${imagePath}`);

    // Clear old grid overlay immediately to prevent stale display
    const ctx = elements.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);

    // Display image
    elements.screenshotImg.src = imagePath;
    elements.imageInfo.textContent = `Loading ${imagePath}...`;

    // Load image data
    try {
        state.currentImage = await loadImage(imagePath);
        elements.imageInfo.textContent = `${state.currentImage.width}x${state.currentImage.height}`;
        elements.runDetectionBtn.disabled = false;

        // Update resolution info
        updateResolutionInfo(state.currentImage.width, state.currentImage.height);

        // Auto-load preset for this resolution
        autoLoadPresetForResolution(state.currentImage.width, state.currentImage.height);

        // Enable auto-detect button
        if (elements.autoDetectBtn) {
            elements.autoDetectBtn.disabled = false;
        }
        // Hide previous auto-detect results
        if (elements.autoDetectResults) {
            elements.autoDetectResults.style.display = 'none';
        }

        // Display ground truth
        displayGroundTruth(imagePath, elements.truthItemsDiv, elements.truthCount);

        // Clear previous detections and corrections
        resetDetectionState();
        elements.detectedItemsDiv.innerHTML = '<p class="status-message">Click "Run Detection" to analyze</p>';
        elements.detectionCount.textContent = '0';
        updateCorrectionsCounter(elements.correctionsCounter);
        closeCorrectionPanel();
        elements.exportValidatedBtn.disabled = true;
        elements.saveTrainingBtn.disabled = true;
        elements.toggleBatchBtn.disabled = true;

        // Show grid preview so user can calibrate Y offset before detection
        drawGridPreview(elements.overlayCanvas, state.currentImage.width, state.currentImage.height, getSlotFilter());
    } catch (error) {
        log(`Error loading image: ${error.message}`, LOG_LEVELS.ERROR);
        elements.imageInfo.textContent = 'Failed to load';
    }
}

async function handleRunDetection() {
    if (!state.currentImage || !state.currentImagePath) return;

    const threshold = parseFloat(elements.confidenceSlider.value);

    elements.runDetectionBtn.disabled = true;
    elements.progressContainer.style.display = 'block';
    elements.detectionStatus.textContent = 'Running detection...';
    clearLog();
    log(`Starting detection with threshold ${threshold}`);

    try {
        const startTime = performance.now();
        const detections = await runDetection(
            state.currentImage,
            state.currentImage.width,
            state.currentImage.height,
            threshold,
            percent => updateProgress(elements.progressFill, percent)
        );
        const elapsed = performance.now() - startTime;

        log(`Detection complete: ${detections.length} items found in ${elapsed.toFixed(0)}ms`, LOG_LEVELS.SUCCESS);

        // Store detections
        state.lastDetections = detections;

        const truthData = getGroundTruthForImage(state.currentImagePath);
        const truthItems = truthData?.items || [];

        // Display results
        displayDetections(
            detections,
            truthItems,
            elements.detectedItemsDiv,
            elements.detectionCount,
            openCorrectionPanel
        );

        // Calculate and display metrics
        const metrics = calculateMetrics(detections, truthItems);
        displayMetrics(metrics, {
            f1Elem: elements.metricF1,
            precisionElem: elements.metricPrecision,
            recallElem: elements.metricRecall,
            detectedElem: elements.metricDetected,
        });

        // Update ablation panel live metrics
        updateLiveMetrics({
            f1Score: metrics.f1,
            precision: metrics.precision,
            recall: metrics.recall,
            time: elapsed,
        });

        // Update debug panel state and refresh
        state.detectionResults = detections.map(d => ({
            confidence: d.confidence,
            entity: d.item,
            slotIndex: d.slotIndex,
        }));
        state.currentImageInfo = {
            width: state.currentImage.width,
            height: state.currentImage.height,
            path: state.currentImagePath,
        };
        state.groundTruth = { items: truthItems };
        state.detectionRuns = (state.detectionRuns || 0) + 1;
        state.avgDetectionTime = state.avgDetectionTime
            ? (state.avgDetectionTime * (state.detectionRuns - 1) + elapsed) / state.detectionRuns
            : elapsed;
        updateDebugPanel();

        // Draw overlay
        drawOverlay(
            elements.overlayCanvas,
            detections,
            state.currentImage.width,
            state.currentImage.height,
            getSlotFilter()
        );

        elements.detectionStatus.textContent = `Found ${detections.length} items in ${elapsed.toFixed(0)}ms`;

        // Enable export and batch buttons
        elements.exportValidatedBtn.disabled = state.detectionsBySlot.size === 0;
        elements.saveTrainingBtn.disabled = state.detectionsBySlot.size === 0;
        elements.toggleBatchBtn.disabled = state.detectionsBySlot.size === 0;

        // Log detailed results
        log(`True Positives: ${metrics.truePositives}`);
        log(`False Positives: ${metrics.falsePositives}`);
        log(`False Negatives: ${metrics.falseNegatives}`);
        log(`F1 Score: ${formatPercent(metrics.f1)}`);
    } catch (error) {
        log(`Detection failed: ${error.message}`, LOG_LEVELS.ERROR);
        elements.detectionStatus.textContent = 'Detection failed';
    } finally {
        elements.runDetectionBtn.disabled = false;
        elements.progressContainer.style.display = 'none';
    }
}

async function handleRunAllTests() {
    const threshold = parseFloat(elements.confidenceSlider.value);
    clearLog();
    log('Running detection on all test images...');

    // Reset batch state
    batchResults = [];
    batchCancelled = false;
    let totalF1 = 0;
    let testCount = 0;

    // Get list of images to test
    const imagesToTest = [];
    for (const [imagePath, data] of Object.entries(state.groundTruth)) {
        if (imagePath.startsWith('_')) continue;
        if (!data.items || data.items.length === 0) continue;
        imagesToTest.push({ path: imagePath, data });
    }

    // Show batch progress indicator
    elements.batchProgress.style.display = 'block';
    elements.runAllBtn.disabled = true;

    for (let i = 0; i < imagesToTest.length; i++) {
        if (batchCancelled) {
            log('Batch testing cancelled', LOG_LEVELS.WARNING);
            break;
        }

        const { path: imagePath, data } = imagesToTest[i];

        // Update progress UI
        elements.batchCurrentImage.textContent = imagePath;
        elements.batchProgressCount.textContent = `${i + 1}/${imagesToTest.length}`;
        elements.batchProgressFill.style.width = `${((i + 1) / imagesToTest.length) * 100}%`;

        try {
            const imageData = await loadImage(imagePath);
            const detections = await runDetection(imageData, imageData.width, imageData.height, threshold);
            const metrics = calculateMetrics(detections, data.items);

            batchResults.push({
                image: imagePath,
                f1: metrics.f1,
                precision: metrics.precision,
                recall: metrics.recall,
                detected: detections.length,
                expected: data.items.length,
            });

            totalF1 += metrics.f1;
            testCount++;

            // Update running average
            const runningAvgF1 = totalF1 / testCount;
            elements.batchRunningF1.textContent = formatPercent(runningAvgF1);

            const status =
                metrics.f1 >= 0.5 ? LOG_LEVELS.SUCCESS : metrics.f1 >= 0.2 ? LOG_LEVELS.WARNING : LOG_LEVELS.ERROR;
            log(
                `${imagePath}: F1=${formatPercent(metrics.f1)}, ${detections.length}/${data.items.length} items`,
                status
            );
        } catch (error) {
            log(`${imagePath}: Error - ${error.message}`, LOG_LEVELS.ERROR);
        }
    }

    // Hide batch progress
    elements.batchProgress.style.display = 'none';
    elements.runAllBtn.disabled = false;

    if (!batchCancelled) {
        const avgF1 = testCount > 0 ? totalF1 / testCount : 0;
        log(
            `\nAverage F1 Score: ${formatPercent(avgF1)} across ${testCount} tests`,
            avgF1 >= 0.5 ? LOG_LEVELS.SUCCESS : LOG_LEVELS.WARNING
        );

        // Sort by F1 score to show worst performers
        batchResults.sort((a, b) => a.f1 - b.f1);
        log('\nWorst performers:');
        for (const r of batchResults.slice(0, 5)) {
            log(`  ${r.image}: F1=${formatPercent(r.f1)}`);
        }

        // Show batch results modal
        showBatchResultsModal();
    }
}

function cancelBatchTest() {
    batchCancelled = true;
}

// ========================================
// Overlay Click Handler
// ========================================

function setupOverlayClickHandler() {
    elements.overlayCanvas.addEventListener('click', e => {
        if (!state.currentImage) return;

        const rect = elements.overlayCanvas.getBoundingClientRect();
        const scaleX = elements.overlayCanvas.width / rect.width;
        const scaleY = elements.overlayCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Check if a detected slot was clicked
        if (state.detectionsBySlot.size > 0) {
            for (const [slotIndex, slotData] of state.detectionsBySlot) {
                const pos = slotData.position;
                if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) {
                    openCorrectionPanel(slotIndex);
                    return;
                }
            }
        }

        // No slot clicked - open modal for full view
        openImageModal(elements.screenshotImg.src);
    });
}

// ========================================
// Initialize Application
// ========================================

async function init() {
    // Initialize logger and toast
    initLogger(elements.logContent);
    initToast(elements.copyToast);

    log('Initializing CV Validator...');

    // Load presets from file first (merges with localStorage)
    await presetManager.loadFromFile();

    // Load data
    await loadGroundTruth();
    await loadItemsData();

    // Load shared CV library for enhanced detection
    await loadSharedLibrary();

    // Load training data if available (uses shared library)
    await loadTrainingDataIfAvailable();

    // Initialize item reference early (needed for populateItemReference)
    initItemReference({
        list: elements.itemReferenceList,
        searchInput: elements.itemSearch,
        count: elements.refCount,
        filterButtons: elements.filterButtons,
    });

    if (state.itemsData) {
        await loadAllTemplates();
        populateImageSelect(elements.imageSelect);
        populateItemReference();
    }

    // Initialize modules
    initCorrectionPanel(
        {
            panel: elements.correctionPanel,
            slotBadge: elements.correctionSlotBadge,
            currentImg: elements.correctionCurrentImg,
            currentName: elements.correctionCurrentName,
            currentConf: elements.correctionCurrentConf,
            quickPicks: elements.quickPicksDiv,
            searchInput: elements.correctionSearchInput,
            filters: elements.correctionFilters,
            results: elements.correctionResultsDiv,
            resultsCount: elements.resultsCount,
            applyBtn: elements.applyCorrectionBtn,
            correctBtn: elements.markCorrectBtn,
            emptyBtn: elements.markEmptyBtn,
            cancelBtn: elements.cancelCorrectionBtn,
            manualItemInput: elements.manualItemInput,
            addManualItemBtn: elements.addManualItemBtn,
        },
        {
            onCorrectionApplied: recalculateAndDisplay,
        }
    );

    initGridCalibration(
        {
            panel: elements.gridCalibrationPanel,
            toggleBtn: elements.toggleCalibrationBtn,
            resetBtn: elements.resetCalibrationBtn,
            // Number inputs in calibration panel
            xOffsetInput: elements.gridXOffsetInput,
            calYOffsetInput: elements.calYOffsetInput,
            iconWidthInput: elements.iconWidthInput,
            iconHeightInput: elements.iconHeightInput,
            xSpacingInput: elements.xSpacingInput,
            ySpacingInput: elements.ySpacingInput,
            iconsPerRowInput: elements.iconsPerRowInput,
            numRowsInput: elements.numRowsInput,
            totalItemsInput: elements.totalItemsInput,
            // Main Y offset slider in controls bar
            mainYOffsetSlider: elements.mainYOffsetSlider,
            mainYOffsetValue: elements.mainYOffsetValue,
            // Info displays
            resolutionInfo: elements.resolutionInfo,
            scaleInfo: elements.scaleInfo,
            presetStatus: elements.presetStatus,
            presetBadge: elements.presetBadge,
            presetModified: elements.presetModified,
            modifiedFields: elements.modifiedFields,
            savePresetBtn: elements.savePresetBtn,
            loadPresetBtn: elements.loadPresetBtn,
            deletePresetBtn: elements.deletePresetBtn,
            exportAllPresetsBtn: elements.exportAllPresetsBtn,
        },
        {
            onCalibrationChange: updateGridDisplay,
        }
    );

    initImageModal(
        {
            modal: elements.imageModal,
            title: elements.modalTitle,
            content: elements.modalContent,
            loading: elements.modalLoading,
            img: elements.modalImg,
            overlay: elements.modalOverlay,
            zoomLevel: elements.zoomLevelSpan,
        },
        {
            onSlotClick: openCorrectionPanel,
            getSlotFilter: getSlotFilter,
        }
    );

    initBatchLabeling(
        {
            toggleBatchBtn: elements.toggleBatchBtn,
            batchPanel: elements.batchPanel,
            batchProgress: elements.batchLabelProgress,
            batchProgressBar: elements.batchProgressBar,
            batchSlotInfo: elements.batchSlotInfo,
            batchCurrentCrop: elements.batchCurrentCrop,
            batchCurrentName: elements.batchCurrentName,
            batchCurrentConf: elements.batchCurrentConf,
            batchLabelStatus: elements.batchLabelStatus,
            batchAlternatives: elements.batchAlternatives,
            batchPrevBtn: elements.batchPrevBtn,
            batchNextBtn: elements.batchNextBtn,
            batchAcceptBtn: elements.batchAcceptBtn,
            batchEmptyBtn: elements.batchEmptyBtn,
            batchSkipBtn: elements.batchSkipBtn,
            batchFinishBtn: elements.batchFinishBtn,
        },
        {
            onCorrectionApplied: recalculateAndDisplay,
            highlightSlot: slotIndex => {
                // Scroll to slot in detection list and highlight in overlay
                const slotItem = elements.detectedItemsDiv.querySelector(`[data-slot="${slotIndex}"]`);
                if (slotItem) {
                    slotItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            },
        }
    );

    // Initialize learning and performance tracking modules
    initActiveLearning();
    initTemplateManager();
    initAlgorithmEnsemble();

    // Initialize ablation testing panel
    initAblationPanel(pipelineConfig => {
        // Callback when config changes - re-run detection
        if (state.currentImage) {
            log(`Ablation config changed: ${pipelineConfig.name}`);
            handleRunDetection();
        }
    });

    // Initialize debug visualization panel
    initDebugPanel({
        onSlotClick: openCorrectionPanel,
    });

    // Enable batch ablation button when we have test images
    if (state.groundTruth && Object.keys(state.groundTruth).length > 0) {
        setBatchAblationEnabled(true);
    }

    // Setup event handlers
    elements.imageSelect.addEventListener('change', handleImageSelect);
    elements.runDetectionBtn.addEventListener('click', handleRunDetection);
    elements.runAllBtn.addEventListener('click', handleRunAllTests);
    elements.exportValidatedBtn.addEventListener('click', exportValidatedData);
    elements.saveTrainingBtn.addEventListener('click', saveTrainingData);

    elements.confidenceSlider.addEventListener('input', e => {
        elements.confidenceValue.textContent = e.target.value;
    });

    elements.slotFilterInput.addEventListener('input', updateGridDisplay);

    // Detection option toggles
    elements.toggleEnhanced.addEventListener('click', () => {
        elements.toggleEnhanced.classList.toggle('active');
        const enabled = elements.toggleEnhanced.classList.contains('active');
        setDetectionOptions({ useEnhanced: enabled });
        log(`Enhanced detection: ${enabled ? 'ON' : 'OFF'}`, LOG_LEVELS.INFO);
        // Auto re-run if we have results
        if (state.currentImage && state.detectionsBySlot.size > 0) {
            handleRunDetection();
        }
    });

    elements.toggleTraining.addEventListener('click', () => {
        elements.toggleTraining.classList.toggle('active');
        const enabled = elements.toggleTraining.classList.contains('active');
        setDetectionOptions({ useTrainingData: enabled });
        log(`Training data: ${enabled ? 'ON' : 'OFF'}`, LOG_LEVELS.INFO);
        // Auto re-run if we have results
        if (state.currentImage && state.detectionsBySlot.size > 0) {
            handleRunDetection();
        }
    });

    // Batch labeling toggle
    elements.toggleBatchBtn.addEventListener('click', toggleBatchMode);

    // Training sources dropdown
    elements.trainingSourcesBtn.addEventListener('click', toggleSourcesDropdown);
    elements.sourcesSelectAll.addEventListener('click', selectAllSources);
    elements.sourcesSelectNone.addEventListener('click', selectNoSources);

    // Close sources dropdown when clicking outside
    document.addEventListener('click', e => {
        if (!elements.trainingSourcesDropdown.contains(e.target) && e.target !== elements.trainingSourcesBtn) {
            elements.trainingSourcesDropdown.classList.remove('show');
        }
    });

    // Setup overlay click handler
    setupOverlayClickHandler();

    // File System Status handlers
    elements.fsSelectDirBtn.addEventListener('click', async () => {
        await getValidatedExportsDirectory();
    });
    elements.fsClearDirBtn.addEventListener('click', clearDirectoryHandle);

    // Slot filter helper
    elements.slotFilterHelperBtn.addEventListener('click', toggleSlotFilterHelper);
    elements.slotFilterHelper.querySelectorAll('.helper-presets button').forEach(btn => {
        btn.addEventListener('click', () => {
            applySlotFilterPreset(btn.dataset.filter);
        });
    });

    // Close slot filter helper when clicking outside
    document.addEventListener('click', e => {
        if (!elements.slotFilterHelper.contains(e.target) && e.target !== elements.slotFilterHelperBtn) {
            elements.slotFilterHelper.classList.remove('show');
        }
    });

    // Corrections breakdown dropdown toggle
    elements.correctionsCounter.addEventListener('click', toggleCorrectionsDropdown);

    // Close corrections dropdown when clicking outside
    document.addEventListener('click', e => {
        if (!elements.correctionsDropdown.contains(e.target) && !elements.correctionsCounter.contains(e.target)) {
            elements.correctionsDropdown.classList.remove('show');
        }
    });

    // Batch cancel button
    elements.batchCancelBtn.addEventListener('click', cancelBatchTest);

    // Training toast handlers
    elements.toastClose.addEventListener('click', hideTrainingToast);
    elements.copyCmdBtn.addEventListener('click', copyCommand);

    // Export preview modal handlers
    elements.previewCancel.addEventListener('click', hideExportPreview);
    elements.previewClose.addEventListener('click', hideExportPreview);
    elements.previewConfirm.addEventListener('click', doSaveTrainingData);

    // Batch results modal handlers
    elements.batchClose.addEventListener('click', hideBatchResultsModal);
    elements.batchExportCsv.addEventListener('click', exportBatchResultsCsv);
    elements.batchExportJson.addEventListener('click', exportBatchResultsJson);

    // Batch table header click for sorting
    document.querySelectorAll('.batch-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortBatchTable(th.dataset.sort));
    });

    // Close batch modal on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (elements.batchResultsModal.classList.contains('show')) {
                hideBatchResultsModal();
            }
            if (elements.exportPreviewModal.classList.contains('show')) {
                hideExportPreview();
            }
        }
    });

    // Auto-detect grid handlers
    initAutoDetect();

    // Advanced settings toggle
    elements.toggleAdvancedBtn.addEventListener('click', toggleAdvancedSettings);

    // Initialize advanced settings handlers
    initAdvancedSettings();

    // Initialize file system status
    // Try to load cached directory handle
    try {
        const storedHandle = await loadDirectoryHandle();
        if (storedHandle) {
            cachedDirectoryHandle = storedHandle;
        }
    } catch (error) {
        console.warn('[init] Failed to load cached directory handle:', error.message);
    }
    updateFileSystemStatus();

    // Expose zoom controls to window for HTML onclick handlers
    window.openImageModal = () => openImageModal(elements.screenshotImg.src);
    window.closeImageModal = closeImageModal;
    window.zoomImage = zoomImage;
    window.resetZoom = resetZoom;
    window.fitToScreen = fitToScreen;

    log('Ready! Click on detected items to correct them.', LOG_LEVELS.SUCCESS);
}

// Start the application
init();
