/* ========================================
 * CV Validator - Correction Panel
 * Correction UI logic
 * ======================================== */

import { CONFIG, CSS_CLASSES } from './config.js';
import { state } from './state.js';
import { log, LOG_LEVELS, filterItems, showToast } from './utils.js';
import { getAllItems } from './data-loader.js';
import { addSessionTemplate, dataURLToImageData, getSessionTemplateCount } from './cv-detection.js';

// DOM element references (set during init)
let elements = {};
let onCorrectionApplied = null;

// ========================================
// Initialization
// ========================================

export function initCorrectionPanel(domElements, callbacks) {
    elements = domElements;
    onCorrectionApplied = callbacks.onCorrectionApplied;

    // Search input
    elements.searchInput.addEventListener('input', e => {
        state.correctionSearchQuery = e.target.value;
        populateCorrectionResults();
    });

    // Filter buttons
    elements.filters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove(CSS_CLASSES.ACTIVE));
            btn.classList.add(CSS_CLASSES.ACTIVE);
            state.correctionFilter = btn.dataset.rarity;
            populateCorrectionResults();
        });
    });

    // Action buttons
    elements.applyBtn.addEventListener('click', applyCorrection);
    elements.correctBtn.addEventListener('click', markAsCorrect);
    elements.emptyBtn.addEventListener('click', markAsEmpty);
    elements.cancelBtn.addEventListener('click', closeCorrectionPanel);

    // Unknown item input
    if (elements.addManualItemBtn) {
        elements.addManualItemBtn.addEventListener('click', addUnknownItem);
    }
    if (elements.manualItemInput) {
        elements.manualItemInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                addUnknownItem();
            }
        });
    }
}

// ========================================
// Open/Close Panel
// ========================================

export function openCorrectionPanel(slotIndex, isEmptySlot = false) {
    // Try to get detection data or empty cell data
    const slotData = state.detectionsBySlot.get(slotIndex);
    const emptyData = state.emptyCells.get(slotIndex);

    if (!slotData && !emptyData) return;

    state.currentCorrectionSlot = slotIndex;
    state.currentSlotIsEmpty = isEmptySlot || (!slotData && !!emptyData);
    state.selectedCorrectionItem = null;
    elements.applyBtn.disabled = true;

    // Update panel header
    elements.slotBadge.textContent = `Slot ${slotIndex}`;

    if (state.currentSlotIsEmpty) {
        // Empty slot mode
        elements.currentName.textContent = '(empty)';
        elements.currentConf.textContent = 'Detected as empty';

        // Show crop preview if available
        if (emptyData?.cropDataURL) {
            elements.currentImg.src = emptyData.cropDataURL;
            elements.currentImg.style.display = 'block';
        } else {
            elements.currentImg.style.display = 'none';
        }

        // Hide quick picks for empty slots (no top matches)
        elements.quickPicks.innerHTML =
            '<span style="color: var(--text-secondary); font-size: 12px;">Select item from list below</span>';

        // Hide the "mark empty" button since it's already empty
        if (elements.emptyBtn) elements.emptyBtn.style.display = 'none';
    } else {
        // Normal detection mode
        const detection = slotData.detection;
        elements.currentName.textContent = detection.item.name;
        elements.currentConf.textContent = `Confidence: ${(detection.confidence * 100).toFixed(1)}%`;

        // Show crop preview if available, otherwise template
        if (slotData.cropDataURL) {
            elements.currentImg.src = slotData.cropDataURL;
            elements.currentImg.style.display = 'block';
        } else if (detection.item.image) {
            elements.currentImg.src = CONFIG.PATHS.imagesBase + detection.item.image;
            elements.currentImg.style.display = 'block';
        } else {
            elements.currentImg.style.display = 'none';
        }

        // Populate quick picks (top alternatives excluding the best match)
        populateQuickPicks(slotData.topMatches);

        // Show the "mark empty" button
        if (elements.emptyBtn) elements.emptyBtn.style.display = '';
    }

    // Clear and reset search
    elements.searchInput.value = '';
    state.correctionSearchQuery = '';
    state.correctionFilter = 'all';

    // Reset filter buttons
    elements.filters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle(CSS_CLASSES.ACTIVE, btn.dataset.rarity === 'all');
    });

    populateCorrectionResults();

    // Show panel
    elements.panel.classList.add(CSS_CLASSES.ACTIVE);

    // Highlight selected badge
    document.querySelectorAll('.item-badge.selected').forEach(b => b.classList.remove(CSS_CLASSES.SELECTED));
    const badge = document.querySelector(`.item-badge[data-slot-index="${slotIndex}"]`);
    if (badge) badge.classList.add(CSS_CLASSES.SELECTED);

    log(`Opened correction panel for slot ${slotIndex}${state.currentSlotIsEmpty ? ' (empty)' : ''}`, LOG_LEVELS.INFO);
}

export function closeCorrectionPanel() {
    elements.panel.classList.remove(CSS_CLASSES.ACTIVE);
    state.currentCorrectionSlot = null;
    state.selectedCorrectionItem = null;

    // Remove highlight
    document.querySelectorAll('.item-badge.selected').forEach(b => b.classList.remove(CSS_CLASSES.SELECTED));
}

// ========================================
// Quick Picks
// ========================================

function populateQuickPicks(topMatches) {
    elements.quickPicks.innerHTML = '';

    // Skip the first (best) match, show alternatives
    const alternatives = topMatches.slice(1, 5);

    for (const match of alternatives) {
        const btn = document.createElement('button');
        btn.className = 'quick-pick-btn';

        if (match.item.image) {
            const img = document.createElement('img');
            img.src = CONFIG.PATHS.imagesBase + match.item.image;
            img.alt = match.item.name;
            btn.appendChild(img);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = match.item.name;
        btn.appendChild(nameSpan);

        const confSpan = document.createElement('span');
        confSpan.className = 'conf';
        confSpan.textContent = `${(match.confidence * 100).toFixed(0)}%`;
        btn.appendChild(confSpan);

        btn.addEventListener('click', () => selectQuickPick(match.item.name));

        elements.quickPicks.appendChild(btn);
    }

    // Also add "Keep original" option
    const keepBtn = document.createElement('button');
    keepBtn.className = 'quick-pick-btn';
    keepBtn.innerHTML = '<span>\u2713 Keep Original</span>';
    keepBtn.addEventListener('click', () => {
        // Remove any existing correction for this slot
        if (state.currentCorrectionSlot !== null && state.corrections.has(state.currentCorrectionSlot)) {
            state.corrections.delete(state.currentCorrectionSlot);
            if (onCorrectionApplied) onCorrectionApplied();
            log(`Removed correction for slot ${state.currentCorrectionSlot}`, LOG_LEVELS.INFO);
        }
        closeCorrectionPanel();
    });
    elements.quickPicks.appendChild(keepBtn);
}

function selectQuickPick(itemName) {
    state.selectedCorrectionItem = itemName;
    elements.applyBtn.disabled = false;
    applyCorrection();
}

// ========================================
// Search Results
// ========================================

function populateCorrectionResults() {
    elements.results.innerHTML = '';

    const allItems = getAllItems();
    if (!allItems.length) {
        elements.resultsCount.textContent = '';
        return;
    }

    const sortedItems = [...allItems].sort((a, b) => a.name.localeCompare(b.name));

    // Filter matching items
    const matchingItems = filterItems(sortedItems, state.correctionFilter, state.correctionSearchQuery);

    const totalCount = matchingItems.length;
    const displayLimit = CONFIG.CORRECTION_RESULTS_LIMIT;
    let displayedCount = 0;

    for (const item of matchingItems) {
        if (displayedCount >= displayLimit) break;

        const div = document.createElement('div');
        div.className = 'correction-item';
        div.dataset.itemName = item.name;

        if (item.image) {
            const img = document.createElement('img');
            img.src = CONFIG.PATHS.imagesBase + item.image;
            img.alt = item.name;
            img.onerror = () => {
                img.style.display = 'none';
            };
            div.appendChild(img);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = item.name;
        div.appendChild(nameSpan);

        div.addEventListener('click', () => selectCorrectionItem(item.name));

        elements.results.appendChild(div);
        displayedCount++;
    }

    // Show truncation indicator if results are limited
    if (totalCount > displayLimit) {
        elements.resultsCount.textContent = `Showing ${displayLimit} of ${totalCount} results`;
    } else if (totalCount > 0) {
        elements.resultsCount.textContent = `${totalCount} result${totalCount !== 1 ? 's' : ''}`;
    } else {
        elements.resultsCount.textContent = 'No matching items';
    }
}

function selectCorrectionItem(itemName) {
    state.selectedCorrectionItem = itemName;
    elements.applyBtn.disabled = false;

    // Update visual selection
    elements.results.querySelectorAll('.correction-item').forEach(div => {
        div.style.borderColor = div.dataset.itemName === itemName ? 'var(--accent)' : 'transparent';
    });

    log(`Selected: ${itemName}`, LOG_LEVELS.INFO);
}

// ========================================
// Session Template Helper
// ========================================

/**
 * Add the current crop as a session template for real-time learning
 * @param {string} itemId - The item ID to associate with this template
 * @param {string} validationType - 'corrected', 'verified', or 'corrected_from_empty'
 * @param {number} originalConfidence - The original detection confidence
 */
async function addCropAsSessionTemplate(itemId, validationType, originalConfidence = 0) {
    // Get the crop data URL from either detection or empty cell
    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    const emptyData = state.emptyCells.get(state.currentCorrectionSlot);
    const cropDataURL = slotData?.cropDataURL || emptyData?.cropDataURL;

    if (!cropDataURL || !itemId) {
        return;
    }

    // Convert the crop data URL to ImageData
    const imageData = await dataURLToImageData(cropDataURL);
    if (!imageData) {
        log('Failed to convert crop to ImageData', LOG_LEVELS.WARNING);
        return;
    }

    // Get resolution info
    const resolution = state.currentImage
        ? `${state.currentImage.width}x${state.currentImage.height}`
        : 'unknown';

    // Add as session template
    const success = addSessionTemplate(itemId, imageData, {
        resolution,
        validationType,
        sourceImage: state.currentImagePath || 'session',
        originalConfidence,
    });

    if (success) {
        const count = getSessionTemplateCount();
        log(`Session template added for "${itemId}" (${count} total)`, LOG_LEVELS.SUCCESS);
        showToast(`Template added for "${itemId}" (${count} total)`, 2000);
    }
}

// ========================================
// Apply/Cancel Corrections
// ========================================

function applyCorrection() {
    if (state.currentCorrectionSlot === null || state.selectedCorrectionItem === null) return;

    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    const emptyData = state.emptyCells.get(state.currentCorrectionSlot);

    if (!slotData && !emptyData) return;

    // Convert item name to item ID for templates
    const itemId = state.selectedCorrectionItem
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

    if (state.currentSlotIsEmpty) {
        // Correcting an empty slot to have an item
        state.corrections.set(state.currentCorrectionSlot, {
            original: {
                name: null,
                confidence: 0,
            },
            corrected: state.selectedCorrectionItem,
            fromEmpty: true,
        });
        log(
            `Corrected empty slot ${state.currentCorrectionSlot} \u2192 "${state.selectedCorrectionItem}"`,
            LOG_LEVELS.SUCCESS
        );

        // Add as session template (corrected from empty)
        addCropAsSessionTemplate(itemId, 'corrected_from_empty', 0);
    } else {
        const originalName = slotData.detection.item.name;
        const originalConfidence = slotData.detection.confidence;

        // If correcting to same item, treat as verified
        if (state.selectedCorrectionItem === originalName) {
            state.corrections.set(state.currentCorrectionSlot, {
                original: {
                    name: originalName,
                    confidence: originalConfidence,
                },
                corrected: originalName,
                verified: true,
            });
            log(`Verified slot ${state.currentCorrectionSlot} as correct: "${originalName}"`, LOG_LEVELS.SUCCESS);

            // Add as session template (verified)
            addCropAsSessionTemplate(itemId, 'verified', originalConfidence);
        } else {
            // Store correction
            state.corrections.set(state.currentCorrectionSlot, {
                original: {
                    name: originalName,
                    confidence: originalConfidence,
                },
                corrected: state.selectedCorrectionItem,
            });
            log(
                `Corrected slot ${state.currentCorrectionSlot}: "${originalName}" \u2192 "${state.selectedCorrectionItem}"`,
                LOG_LEVELS.SUCCESS
            );

            // Add as session template (corrected)
            addCropAsSessionTemplate(itemId, 'corrected', originalConfidence);
        }
    }

    if (onCorrectionApplied) onCorrectionApplied();
    closeCorrectionPanel();
}

function markAsCorrect() {
    if (state.currentCorrectionSlot === null) return;

    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    if (!slotData) return;

    const originalName = slotData.detection.item.name;
    const originalConfidence = slotData.detection.confidence;

    // Convert item name to item ID for templates
    const itemId = originalName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

    // Store as verified correct (special marker)
    state.corrections.set(state.currentCorrectionSlot, {
        original: {
            name: originalName,
            confidence: originalConfidence,
        },
        corrected: originalName, // Same as original means verified
        verified: true,
    });

    log(`Verified slot ${state.currentCorrectionSlot} as correct: "${originalName}"`, LOG_LEVELS.SUCCESS);

    // Add as session template (verified)
    addCropAsSessionTemplate(itemId, 'verified', originalConfidence);

    if (onCorrectionApplied) onCorrectionApplied();
    closeCorrectionPanel();
}

function markAsEmpty() {
    if (state.currentCorrectionSlot === null) return;

    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    if (!slotData) return;

    const originalName = slotData.detection.item.name;

    // Store correction as empty (null)
    state.corrections.set(state.currentCorrectionSlot, {
        original: {
            name: originalName,
            confidence: slotData.detection.confidence,
        },
        corrected: null,
    });

    log(`Marked slot ${state.currentCorrectionSlot} as empty (was: "${originalName}")`, LOG_LEVELS.WARNING);

    if (onCorrectionApplied) onCorrectionApplied();
    closeCorrectionPanel();
}

function addUnknownItem() {
    if (state.currentCorrectionSlot === null) return;

    const itemName = elements.manualItemInput?.value?.trim();
    if (!itemName) {
        log('Please enter an item name', LOG_LEVELS.WARNING);
        return;
    }

    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    const emptyData = state.emptyCells.get(state.currentCorrectionSlot);

    if (!slotData && !emptyData) return;

    // Store correction with unknown flag
    if (state.currentSlotIsEmpty) {
        state.corrections.set(state.currentCorrectionSlot, {
            original: {
                name: null,
                confidence: 0,
            },
            corrected: itemName,
            fromEmpty: true,
            is_unknown: true,
        });
    } else {
        const originalName = slotData.detection.item.name;
        state.corrections.set(state.currentCorrectionSlot, {
            original: {
                name: originalName,
                confidence: slotData.detection.confidence,
            },
            corrected: itemName,
            is_unknown: true,
        });
    }

    log(`Added unknown item "${itemName}" to slot ${state.currentCorrectionSlot}`, LOG_LEVELS.WARNING);

    // Clear the input
    if (elements.manualItemInput) {
        elements.manualItemInput.value = '';
    }

    if (onCorrectionApplied) onCorrectionApplied();
    closeCorrectionPanel();
}

// Export for external use
export { populateCorrectionResults };
