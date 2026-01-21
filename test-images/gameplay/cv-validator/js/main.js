/* global Blob, performance */
/* ========================================
 * CV Validator - Main Entry Point
 * Initialization, event wiring, export functionality
 * ======================================== */

import { state, resetDetectionState } from './state.js';
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
} from './data-loader.js';
import { runDetection } from './cv-detection.js';
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

    // Main Y offset (in controls)
    mainYOffsetSlider: document.getElementById('grid-y-offset'),
    mainYOffsetValue: document.getElementById('grid-y-value'),

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

    // Calibration panel
    gridCalibrationPanel: document.getElementById('grid-calibration-panel'),
    toggleCalibrationBtn: document.getElementById('toggle-grid-calibration'),
    resetCalibrationBtn: document.getElementById('reset-calibration'),
    gridXOffsetSlider: document.getElementById('grid-x-offset'),
    gridXValue: document.getElementById('grid-x-value'),
    iconWidthSlider: document.getElementById('icon-width'),
    iconWidthValue: document.getElementById('icon-width-value'),
    iconHeightSlider: document.getElementById('icon-height'),
    iconHeightValue: document.getElementById('icon-height-value'),
    xSpacingSlider: document.getElementById('x-spacing'),
    xSpacingValue: document.getElementById('x-spacing-value'),
    ySpacingSlider: document.getElementById('y-spacing'),
    ySpacingValue: document.getElementById('y-spacing-value'),
    iconsPerRowSlider: document.getElementById('icons-per-row'),
    iconsPerRowValue: document.getElementById('icons-per-row-value'),
    numRowsSlider: document.getElementById('num-rows'),
    numRowsValue: document.getElementById('num-rows-value'),
    resolutionInfo: document.getElementById('resolution-info'),
    scaleInfo: document.getElementById('scale-info'),
    presetStatus: document.getElementById('preset-status'),
    savePresetBtn: document.getElementById('save-preset'),
    loadPresetBtn: document.getElementById('load-preset'),
    deletePresetBtn: document.getElementById('delete-preset'),

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
};

// ========================================
// Helper Functions
// ========================================

function getSlotFilter() {
    return parseSlotFilter(elements.slotFilterInput.value);
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

    // Update corrections counter
    updateCorrectionsCounter(elements.correctionsCounter);
}

// ========================================
// Export Functionality
// ========================================

function generateValidatedData() {
    if (!state.currentImagePath || state.detectionsBySlot.size === 0) return null;

    const slots = {};

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
                position: { x: position.x, y: position.y, w: position.width, h: position.height },
            };
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
            corrections_made: state.corrections.size,
            items_marked_empty: [...state.corrections.values()].filter(c => c.corrected === null).length,
            ground_truth_count: truthItems.length,
            validated_items_count: validatedItems.length,
            true_positives: truePositives,
        },
        slots: slots,
        ground_truth: truthItems,
    };
}

function exportValidatedData() {
    const data = generateValidatedData();
    if (!data) {
        log('No detection data to export', LOG_LEVELS.ERROR);
        return;
    }

    // Generate filename from image path
    const imageName = state.currentImagePath.replace(/\//g, '_').replace(/\.[^.]+$/, '');
    const filename = `validated_${imageName}.json`;

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

        // Display ground truth
        displayGroundTruth(imagePath, elements.truthItemsDiv, elements.truthCount);

        // Clear previous detections and corrections
        resetDetectionState();
        elements.detectedItemsDiv.innerHTML = '<p class="status-message">Click "Run Detection" to analyze</p>';
        elements.detectionCount.textContent = '0';
        updateCorrectionsCounter(elements.correctionsCounter);
        closeCorrectionPanel();
        elements.exportValidatedBtn.disabled = true;

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

        // Draw overlay
        drawOverlay(
            elements.overlayCanvas,
            detections,
            state.currentImage.width,
            state.currentImage.height,
            getSlotFilter()
        );

        elements.detectionStatus.textContent = `Found ${detections.length} items in ${elapsed.toFixed(0)}ms`;

        // Enable export button
        elements.exportValidatedBtn.disabled = state.detectionsBySlot.size === 0;

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

    const results = [];
    let totalF1 = 0;
    let testCount = 0;

    for (const [imagePath, data] of Object.entries(state.groundTruth)) {
        if (imagePath.startsWith('_')) continue;
        if (!data.items || data.items.length === 0) continue;

        try {
            const imageData = await loadImage(imagePath);
            const detections = await runDetection(imageData, imageData.width, imageData.height, threshold);
            const metrics = calculateMetrics(detections, data.items);

            results.push({
                image: imagePath,
                f1: metrics.f1,
                precision: metrics.precision,
                recall: metrics.recall,
                detected: detections.length,
                expected: data.items.length,
            });

            totalF1 += metrics.f1;
            testCount++;

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

    const avgF1 = testCount > 0 ? totalF1 / testCount : 0;
    log(
        `\nAverage F1 Score: ${formatPercent(avgF1)} across ${testCount} tests`,
        avgF1 >= 0.5 ? LOG_LEVELS.SUCCESS : LOG_LEVELS.WARNING
    );

    // Sort by F1 score to show worst performers
    results.sort((a, b) => a.f1 - b.f1);
    log('\nWorst performers:');
    for (const r of results.slice(0, 5)) {
        log(`  ${r.image}: F1=${formatPercent(r.f1)}`);
    }
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

    // Load data
    await loadGroundTruth();
    await loadItemsData();

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
            xOffsetSlider: elements.gridXOffsetSlider,
            xOffsetValue: elements.gridXValue,
            mainYOffsetSlider: elements.mainYOffsetSlider,
            mainYOffsetValue: elements.mainYOffsetValue,
            iconWidthSlider: elements.iconWidthSlider,
            iconWidthValue: elements.iconWidthValue,
            iconHeightSlider: elements.iconHeightSlider,
            iconHeightValue: elements.iconHeightValue,
            xSpacingSlider: elements.xSpacingSlider,
            xSpacingValue: elements.xSpacingValue,
            ySpacingSlider: elements.ySpacingSlider,
            ySpacingValue: elements.ySpacingValue,
            iconsPerRowSlider: elements.iconsPerRowSlider,
            iconsPerRowValue: elements.iconsPerRowValue,
            numRowsSlider: elements.numRowsSlider,
            numRowsValue: elements.numRowsValue,
            resolutionInfo: elements.resolutionInfo,
            scaleInfo: elements.scaleInfo,
            presetStatus: elements.presetStatus,
            savePresetBtn: elements.savePresetBtn,
            loadPresetBtn: elements.loadPresetBtn,
            deletePresetBtn: elements.deletePresetBtn,
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

    // Setup event handlers
    elements.imageSelect.addEventListener('change', handleImageSelect);
    elements.runDetectionBtn.addEventListener('click', handleRunDetection);
    elements.runAllBtn.addEventListener('click', handleRunAllTests);
    elements.exportValidatedBtn.addEventListener('click', exportValidatedData);

    elements.confidenceSlider.addEventListener('input', e => {
        elements.confidenceValue.textContent = e.target.value;
    });

    elements.slotFilterInput.addEventListener('input', updateGridDisplay);

    // Setup overlay click handler
    setupOverlayClickHandler();

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
