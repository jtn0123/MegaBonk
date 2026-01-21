/* ========================================
 * CV Validator - Correction Panel
 * Correction UI logic
 * ======================================== */

import { CONFIG, CSS_CLASSES } from './config.js';
import { state } from './state.js';
import { log, LOG_LEVELS, filterItems } from './utils.js';
import { getAllItems } from './data-loader.js';

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
    elements.emptyBtn.addEventListener('click', markAsEmpty);
    elements.cancelBtn.addEventListener('click', closeCorrectionPanel);
}

// ========================================
// Open/Close Panel
// ========================================

export function openCorrectionPanel(slotIndex) {
    const slotData = state.detectionsBySlot.get(slotIndex);
    if (!slotData) return;

    state.currentCorrectionSlot = slotIndex;
    state.selectedCorrectionItem = null;
    elements.applyBtn.disabled = true;

    // Update panel header
    elements.slotBadge.textContent = `Slot ${slotIndex}`;

    // Show current detection
    const detection = slotData.detection;
    elements.currentName.textContent = detection.item.name;
    elements.currentConf.textContent = `Confidence: ${(detection.confidence * 100).toFixed(1)}%`;
    if (detection.item.image) {
        elements.currentImg.src = CONFIG.PATHS.imagesBase + detection.item.image;
        elements.currentImg.style.display = 'block';
    } else {
        elements.currentImg.style.display = 'none';
    }

    // Populate quick picks (top alternatives excluding the best match)
    populateQuickPicks(slotData.topMatches);

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

    log(`Opened correction panel for slot ${slotIndex}`, LOG_LEVELS.INFO);
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
// Apply/Cancel Corrections
// ========================================

function applyCorrection() {
    if (state.currentCorrectionSlot === null || state.selectedCorrectionItem === null) return;

    const slotData = state.detectionsBySlot.get(state.currentCorrectionSlot);
    if (!slotData) return;

    const originalName = slotData.detection.item.name;

    // Store correction
    state.corrections.set(state.currentCorrectionSlot, {
        original: {
            name: originalName,
            confidence: slotData.detection.confidence,
        },
        corrected: state.selectedCorrectionItem,
    });

    log(
        `Corrected slot ${state.currentCorrectionSlot}: "${originalName}" \u2192 "${state.selectedCorrectionItem}"`,
        LOG_LEVELS.SUCCESS
    );

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

// Export for external use
export { populateCorrectionResults };
