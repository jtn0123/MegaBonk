/* ========================================
 * CV Validator - Batch Labeling Mode
 * Rapid labeling UI for new screenshots
 * ======================================== */

import { state } from './state.js';
import { log, LOG_LEVELS, showToast } from './utils.js';

// DOM elements
let elements = {};
let callbacks = {};

// Batch state
let batchMode = false;
let currentBatchSlot = 0;
let batchSlots = [];
let batchStats = {
    total: 0,
    labeled: 0,
    skipped: 0,
    startTime: null,
};

// ========================================
// Initialization
// ========================================

export function initBatchLabeling(domElements, cbs) {
    elements = domElements;
    callbacks = cbs;

    // Toggle batch mode
    if (elements.toggleBatchBtn) {
        elements.toggleBatchBtn.addEventListener('click', toggleBatchMode);
    }

    // Navigation controls
    if (elements.batchPrevBtn) {
        elements.batchPrevBtn.addEventListener('click', () => navigateBatch(-1));
    }
    if (elements.batchNextBtn) {
        elements.batchNextBtn.addEventListener('click', () => navigateBatch(1));
    }
    if (elements.batchSkipBtn) {
        elements.batchSkipBtn.addEventListener('click', skipCurrentSlot);
    }

    // Quick actions
    if (elements.batchAcceptBtn) {
        elements.batchAcceptBtn.addEventListener('click', acceptCurrentDetection);
    }
    if (elements.batchEmptyBtn) {
        elements.batchEmptyBtn.addEventListener('click', markCurrentEmpty);
    }

    // Finish button
    if (elements.batchFinishBtn) {
        elements.batchFinishBtn.addEventListener('click', finishBatchLabeling);
    }

    // Keyboard shortcuts when in batch mode
    document.addEventListener('keydown', handleBatchKeyboard);
}

// ========================================
// Batch Mode Toggle
// ========================================

export function toggleBatchMode() {
    if (batchMode) {
        exitBatchMode();
    } else {
        enterBatchMode();
    }
}

function enterBatchMode() {
    if (!state.currentImage || state.detectionsBySlot.size === 0) {
        showToast('Run detection first');
        return;
    }

    batchMode = true;
    batchStats = {
        total: state.detectionsBySlot.size + state.emptyCells.size,
        labeled: state.corrections.size,
        skipped: 0,
        startTime: Date.now(),
    };

    // Build slot list from detections and empty cells
    batchSlots = [];

    // Add detected slots sorted by index
    const sortedDetections = [...state.detectionsBySlot.entries()].sort((a, b) => a[0] - b[0]);
    for (const [slotIndex, slotData] of sortedDetections) {
        batchSlots.push({
            index: slotIndex,
            type: 'detection',
            data: slotData,
            labeled: state.corrections.has(slotIndex),
        });
    }

    // Add empty cells
    const sortedEmpty = [...state.emptyCells.entries()].sort((a, b) => a[0] - b[0]);
    for (const [slotIndex, emptyData] of sortedEmpty) {
        batchSlots.push({
            index: slotIndex,
            type: 'empty',
            data: emptyData,
            labeled: state.corrections.has(slotIndex),
        });
    }

    // Start from first unlabeled slot
    currentBatchSlot = batchSlots.findIndex(s => !s.labeled);
    if (currentBatchSlot === -1) currentBatchSlot = 0;

    // Show batch UI
    if (elements.batchPanel) {
        elements.batchPanel.classList.add('active');
    }
    if (elements.toggleBatchBtn) {
        elements.toggleBatchBtn.textContent = 'Exit Batch Mode';
        elements.toggleBatchBtn.classList.add('active');
    }

    updateBatchUI();
    log(`Batch labeling: ${batchStats.total} slots, ${batchStats.labeled} already labeled`, LOG_LEVELS.INFO);
}

function exitBatchMode() {
    batchMode = false;

    if (elements.batchPanel) {
        elements.batchPanel.classList.remove('active');
    }
    if (elements.toggleBatchBtn) {
        elements.toggleBatchBtn.textContent = 'Bulk Label';
        elements.toggleBatchBtn.classList.remove('active');
    }

    // Show summary
    const duration = ((Date.now() - batchStats.startTime) / 1000).toFixed(1);
    const newLabels = state.corrections.size - batchStats.labeled;
    log(`Batch complete: ${newLabels} new labels in ${duration}s`, LOG_LEVELS.SUCCESS);
}

// ========================================
// Navigation
// ========================================

function navigateBatch(direction) {
    if (!batchMode || batchSlots.length === 0) return;

    currentBatchSlot = (currentBatchSlot + direction + batchSlots.length) % batchSlots.length;
    updateBatchUI();
}

function jumpToSlot(index) {
    const slotIdx = batchSlots.findIndex(s => s.index === index);
    if (slotIdx !== -1) {
        currentBatchSlot = slotIdx;
        updateBatchUI();
    }
}

function skipCurrentSlot() {
    batchStats.skipped++;
    navigateBatch(1);
}

function moveToNextUnlabeled() {
    const start = currentBatchSlot;
    for (let i = 1; i <= batchSlots.length; i++) {
        const idx = (start + i) % batchSlots.length;
        if (!batchSlots[idx].labeled) {
            currentBatchSlot = idx;
            updateBatchUI();
            return true;
        }
    }
    // All labeled
    return false;
}

// ========================================
// Actions
// ========================================

function acceptCurrentDetection() {
    if (!batchMode) return;

    const slot = batchSlots[currentBatchSlot];
    if (!slot) return;

    if (slot.type === 'detection') {
        const detection = slot.data.detection;
        // Mark as verified (accepting the auto-detection)
        state.corrections.set(slot.index, {
            original: { name: detection.item.name, confidence: detection.confidence },
            corrected: detection.item.name,
            verified: true,
        });
        slot.labeled = true;
    } else if (slot.type === 'empty') {
        // For empty slots, "accepting" confirms it's empty
        state.corrections.set(slot.index, {
            original: { name: null, confidence: 0 },
            corrected: null,
            verified: true,
        });
        slot.labeled = true;
        showToast('Empty slot confirmed');
    }

    updateBatchUI();
    if (callbacks.onCorrectionApplied) {
        callbacks.onCorrectionApplied();
    }

    // Move to next
    if (!moveToNextUnlabeled()) {
        showToast('All slots labeled!');
    }
}

function markCurrentEmpty() {
    if (!batchMode) return;

    const slot = batchSlots[currentBatchSlot];
    if (!slot) return;

    state.corrections.set(slot.index, {
        original: slot.type === 'detection'
            ? { name: slot.data.detection.item.name, confidence: slot.data.detection.confidence }
            : { name: null, confidence: 0 },
        corrected: null,
    });
    slot.labeled = true;

    updateBatchUI();
    if (callbacks.onCorrectionApplied) {
        callbacks.onCorrectionApplied();
    }

    if (!moveToNextUnlabeled()) {
        showToast('All slots labeled!');
    }
}

function applyBatchCorrection(itemName) {
    if (!batchMode) return;

    const slot = batchSlots[currentBatchSlot];
    if (!slot) return;

    state.corrections.set(slot.index, {
        original: slot.type === 'detection'
            ? { name: slot.data.detection.item.name, confidence: slot.data.detection.confidence }
            : { name: null, confidence: 0 },
        corrected: itemName,
        fromEmpty: slot.type === 'empty',
    });
    slot.labeled = true;

    updateBatchUI();
    if (callbacks.onCorrectionApplied) {
        callbacks.onCorrectionApplied();
    }

    if (!moveToNextUnlabeled()) {
        showToast('All slots labeled!');
    }
}

function finishBatchLabeling() {
    exitBatchMode();
}

// ========================================
// UI Updates
// ========================================

function updateBatchUI() {
    if (!batchMode || !elements.batchPanel) return;

    const slot = batchSlots[currentBatchSlot];
    if (!slot) return;

    // Update progress
    const labeledCount = batchSlots.filter(s => s.labeled).length;
    const progress = batchSlots.length > 0 ? Math.round((labeledCount / batchSlots.length) * 100) : 0;

    if (elements.batchLabelProgress) {
        elements.batchLabelProgress.textContent = `${labeledCount}/${batchSlots.length} (${progress}%)`;
    }
    if (elements.batchProgressBar) {
        elements.batchProgressBar.style.width = `${progress}%`;
    }

    // Update slot info (show batch position, not grid slot index)
    if (elements.batchSlotInfo) {
        elements.batchSlotInfo.textContent = `Item ${currentBatchSlot + 1} of ${batchSlots.length} (grid slot ${slot.index})`;
    }

    // Update current slot display
    if (elements.batchCurrentCrop) {
        if (slot.data.cropDataURL) {
            elements.batchCurrentCrop.src = slot.data.cropDataURL;
            elements.batchCurrentCrop.style.display = 'block';
        } else {
            elements.batchCurrentCrop.style.display = 'none';
        }
    }

    if (elements.batchCurrentName) {
        if (slot.type === 'detection') {
            const detection = slot.data.detection;
            elements.batchCurrentName.textContent = detection.item.name;
            if (elements.batchCurrentConf) {
                elements.batchCurrentConf.textContent = `${Math.round(detection.confidence * 100)}%`;
            }
        } else {
            elements.batchCurrentName.textContent = '(Empty cell)';
            if (elements.batchCurrentConf) {
                elements.batchCurrentConf.textContent = '--';
            }
        }
    }

    // Update labeled status
    if (elements.batchLabelStatus) {
        if (slot.labeled) {
            const correction = state.corrections.get(slot.index);
            if (correction) {
                if (correction.corrected === null) {
                    elements.batchLabelStatus.textContent = 'Marked empty';
                    elements.batchLabelStatus.className = 'batch-label-status empty';
                } else if (correction.verified) {
                    elements.batchLabelStatus.textContent = `Verified: ${correction.corrected}`;
                    elements.batchLabelStatus.className = 'batch-label-status verified';
                } else {
                    elements.batchLabelStatus.textContent = `Corrected: ${correction.corrected}`;
                    elements.batchLabelStatus.className = 'batch-label-status corrected';
                }
            }
        } else {
            elements.batchLabelStatus.textContent = 'Not labeled';
            elements.batchLabelStatus.className = 'batch-label-status unlabeled';
        }
    }

    // Show alternatives for quick selection
    if (elements.batchAlternatives && slot.type === 'detection' && slot.data.topMatches) {
        const alternatives = slot.data.topMatches.slice(0, 6);
        elements.batchAlternatives.innerHTML = '';

        for (const match of alternatives) {
            const btn = document.createElement('button');
            btn.className = 'batch-alt-btn';
            btn.textContent = `${match.item.name} (${Math.round(match.confidence * 100)}%)`;
            btn.addEventListener('click', () => applyBatchCorrection(match.item.name));
            elements.batchAlternatives.appendChild(btn);
        }
    }

    // Update navigation buttons
    if (elements.batchPrevBtn) {
        elements.batchPrevBtn.disabled = batchSlots.length <= 1;
    }
    if (elements.batchNextBtn) {
        elements.batchNextBtn.disabled = batchSlots.length <= 1;
    }

    // Highlight in main view
    if (callbacks.highlightSlot) {
        callbacks.highlightSlot(slot.index);
    }
}

// ========================================
// Keyboard Navigation
// ========================================

function handleBatchKeyboard(e) {
    if (!batchMode) return;

    // Don't interfere with input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            navigateBatch(-1);
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
            navigateBatch(1);
            e.preventDefault();
            break;
        case 'Enter':
        case ' ':
            acceptCurrentDetection();
            e.preventDefault();
            break;
        case 'e':
            markCurrentEmpty();
            e.preventDefault();
            break;
        case 's':
            skipCurrentSlot();
            e.preventDefault();
            break;
        case 'Escape':
            exitBatchMode();
            e.preventDefault();
            break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
            // Quick select alternative by number
            const altIndex = parseInt(e.key) - 1;
            const slot = batchSlots[currentBatchSlot];
            if (slot && slot.type === 'detection' && slot.data.topMatches && slot.data.topMatches[altIndex]) {
                applyBatchCorrection(slot.data.topMatches[altIndex].item.name);
            }
            e.preventDefault();
            break;
    }
}

// ========================================
// Exports
// ========================================

export function isBatchMode() {
    return batchMode;
}

export function getBatchStats() {
    return { ...batchStats, labeled: batchSlots.filter(s => s.labeled).length };
}

export function selectItemInBatch(itemName) {
    if (batchMode) {
        applyBatchCorrection(itemName);
    }
}
