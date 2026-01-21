/* ========================================
 * CV Validator - UI Renderer
 * Badge creation, overlays, displays
 * ======================================== */

import { CONFIG, CSS_CLASSES } from './config.js';
import { state } from './state.js';
import { getEffectiveDetections, formatPercent, formatConfidence, countItems, getMetricClass } from './utils.js';
import { detectGridPositions } from './cv-detection.js';
import { getItemByName } from './data-loader.js';

// ========================================
// Item Badge Creation
// ========================================

export function createItemBadge(name, count, imagePath, status) {
    const badge = document.createElement('div');
    badge.className = `item-badge ${status}`;

    if (imagePath) {
        const img = document.createElement('img');
        img.src = CONFIG.PATHS.imagesBase + imagePath;
        img.alt = name;
        badge.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = name;
    badge.appendChild(span);

    if (count > 1) {
        const countSpan = document.createElement('span');
        countSpan.className = 'count';
        countSpan.textContent = `x${count}`;
        badge.appendChild(countSpan);
    }

    return badge;
}

export function createClickableItemBadge(slotIndex, name, confidence, imagePath, status, clickHandler) {
    const badge = document.createElement('div');
    badge.className = `item-badge ${status} ${CSS_CLASSES.CLICKABLE}`;
    badge.dataset.slotIndex = slotIndex;

    if (imagePath) {
        const img = document.createElement('img');
        img.src = CONFIG.PATHS.imagesBase + imagePath;
        img.alt = name;
        badge.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = `[${slotIndex}] ${name}`;
    badge.appendChild(span);

    const confSpan = document.createElement('span');
    confSpan.className = 'count';
    confSpan.textContent = formatConfidence(confidence);
    badge.appendChild(confSpan);

    badge.title = `Slot ${slotIndex}: ${name} (${formatPercent(confidence)})\nClick to correct`;

    if (clickHandler) {
        badge.addEventListener('click', () => clickHandler(slotIndex));
    }

    return badge;
}

export function createCorrectedBadge(slotIndex, originalName, correctedName, clickHandler) {
    const badge = document.createElement('div');
    badge.className = `item-badge ${CSS_CLASSES.CORRECTED} ${CSS_CLASSES.CLICKABLE}`;
    badge.dataset.slotIndex = slotIndex;

    if (correctedName) {
        const item = getItemByName(correctedName);
        if (item?.image) {
            const img = document.createElement('img');
            img.src = CONFIG.PATHS.imagesBase + item.image;
            img.alt = correctedName;
            badge.appendChild(img);
        }

        const nameContainer = document.createElement('span');
        const originalSpan = document.createElement('span');
        originalSpan.className = 'original-name';
        originalSpan.textContent = `[${slotIndex}] ${originalName}`;
        const correctedSpan = document.createElement('span');
        correctedSpan.className = 'corrected-name';
        correctedSpan.textContent = ` \u2192 ${correctedName}`;
        nameContainer.appendChild(originalSpan);
        nameContainer.appendChild(correctedSpan);
        badge.appendChild(nameContainer);
    } else {
        // Marked as empty
        const span = document.createElement('span');
        span.className = 'original-name';
        span.textContent = `[${slotIndex}] ${originalName} \u2192 (empty)`;
        badge.appendChild(span);
    }

    badge.title = `Slot ${slotIndex}: Corrected from "${originalName}" to "${correctedName || '(empty)'}"\nClick to edit`;

    if (clickHandler) {
        badge.addEventListener('click', () => clickHandler(slotIndex));
    }

    return badge;
}

export function createVerifiedBadge(slotIndex, name, confidence, imagePath, clickHandler) {
    const badge = document.createElement('div');
    badge.className = `item-badge ${CSS_CLASSES.VERIFIED} ${CSS_CLASSES.CLICKABLE}`;
    badge.dataset.slotIndex = slotIndex;

    if (imagePath) {
        const img = document.createElement('img');
        img.src = CONFIG.PATHS.imagesBase + imagePath;
        img.alt = name;
        badge.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = `[${slotIndex}] ${name}`;
    badge.appendChild(span);

    const checkSpan = document.createElement('span');
    checkSpan.className = 'verified-check';
    checkSpan.textContent = '\u2713';
    badge.appendChild(checkSpan);

    const confSpan = document.createElement('span');
    confSpan.className = 'count';
    confSpan.textContent = formatConfidence(confidence);
    badge.appendChild(confSpan);

    badge.title = `Slot ${slotIndex}: ${name} - Verified correct (${formatPercent(confidence)})\nClick to edit`;

    if (clickHandler) {
        badge.addEventListener('click', () => clickHandler(slotIndex));
    }

    return badge;
}

// ========================================
// Metrics Display
// ========================================

export function displayMetrics(metrics, elements) {
    const { f1Elem, precisionElem, recallElem, detectedElem } = elements;

    f1Elem.querySelector('.value').textContent = formatPercent(metrics.f1);
    precisionElem.querySelector('.value').textContent = formatPercent(metrics.precision);
    recallElem.querySelector('.value').textContent = formatPercent(metrics.recall);
    detectedElem.querySelector('.value').textContent =
        `${metrics.truePositives}/${metrics.truePositives + metrics.falseNegatives}`;

    // Color coding
    f1Elem.className = `metric-card ${getMetricClass(metrics.f1)}`;
    precisionElem.className = `metric-card ${getMetricClass(metrics.precision)}`;
    recallElem.className = `metric-card ${getMetricClass(metrics.recall)}`;
}

// ========================================
// Ground Truth Display
// ========================================

export function displayGroundTruth(imagePath, container, countElement) {
    const data = state.groundTruth[imagePath];
    if (!data || !data.items) {
        container.innerHTML = '<p class="status-message">No ground truth available</p>';
        countElement.textContent = '0';
        return;
    }

    // Count items
    const itemCounts = countItems(data.items);
    countElement.textContent = data.items.length;

    container.innerHTML = '';
    for (const [name, count] of itemCounts) {
        const item = getItemByName(name);
        const badge = createItemBadge(name, count, item?.image, 'truth');
        container.appendChild(badge);
    }
}

// ========================================
// Detections Display
// ========================================

export function displayDetections(detections, groundTruthItems, container, countElement, openCorrectionPanel) {
    container.innerHTML = '';

    if (detections.length === 0 && state.corrections.size === 0) {
        container.innerHTML = '<p class="status-message">No items detected</p>';
        countElement.textContent = '0';
        return;
    }

    // Build effective detections considering corrections
    const effectiveDetections = getEffectiveDetections();

    // Count effective detections
    const detectionCounts = new Map();
    for (const d of effectiveDetections) {
        if (d.name) {
            // Skip empty corrections
            detectionCounts.set(d.name, (detectionCounts.get(d.name) || 0) + 1);
        }
    }

    // Count ground truth
    const truthCounts = countItems(groundTruthItems);

    countElement.textContent = effectiveDetections.filter(d => d.name).length;

    // Display detections per slot (ordered)
    const sortedDetections = [...state.detectionsBySlot.entries()].sort((a, b) => a[0] - b[0]);

    for (const [slotIndex, slotData] of sortedDetections) {
        const correction = state.corrections.get(slotIndex);
        const originalName = slotData.detection.item.name;
        const originalConf = slotData.detection.confidence;
        const item = slotData.detection.item;

        if (correction) {
            if (correction.verified) {
                // Show verified badge (green)
                const badge = createVerifiedBadge(
                    slotIndex,
                    originalName,
                    originalConf,
                    item?.image,
                    openCorrectionPanel
                );
                container.appendChild(badge);
            } else {
                // Show corrected badge (cyan or empty)
                const badge = createCorrectedBadge(slotIndex, originalName, correction.corrected, openCorrectionPanel);
                container.appendChild(badge);
            }
        } else {
            // Show normal detection badge (clickable)
            const truthCount = truthCounts.get(originalName) || 0;
            const status = truthCount > 0 ? CSS_CLASSES.MATCH : CSS_CLASSES.FALSE_POSITIVE;
            const badge = createClickableItemBadge(
                slotIndex,
                originalName,
                originalConf,
                item?.image,
                status,
                openCorrectionPanel
            );
            container.appendChild(badge);
        }
    }

    // Show missing items (not clickable - they weren't detected)
    for (const [name, count] of truthCounts) {
        const effectiveCount = detectionCounts.get(name) || 0;
        if (effectiveCount < count) {
            const item = getItemByName(name);
            const badge = createItemBadge(name, count - effectiveCount, item?.image, CSS_CLASSES.MISSING);
            badge.title = 'Not detected';
            container.appendChild(badge);
        }
    }
}

// ========================================
// Corrections Counter
// ========================================

export function updateCorrectionsCounter(counterElement) {
    const count = state.corrections.size;
    counterElement.textContent = `${count} correction${count !== 1 ? 's' : ''}`;
    counterElement.classList.toggle(CSS_CLASSES.VISIBLE, count > 0);
}

// ========================================
// Grid Overlay Drawing
// ========================================

export function drawGridOverlay(ctx, positions, options = {}) {
    const { scale = 1, slotFilter = null, showDetections = true, showCorrections = true } = options;

    const slotBadgeW = CONFIG.SLOT_BADGE_SIZE.w * scale;
    const slotBadgeH = CONFIG.SLOT_BADGE_SIZE.h * scale;

    for (const pos of positions) {
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(pos.slotIndex)) continue;

        const x = pos.x * scale;
        const y = pos.y * scale;
        const w = pos.width * scale;
        const h = pos.height * scale;

        const slotData = state.detectionsBySlot.get(pos.slotIndex);
        const correction = state.corrections.get(pos.slotIndex);

        // Different styling based on state
        if (showCorrections && correction) {
            if (correction.verified) {
                // Verified slot - green border
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 2 * scale;
            } else {
                // Corrected slot - cyan border
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2 * scale;
            }
        } else if (showDetections && slotData) {
            // Detected slot - color by confidence
            const hue = Math.round(slotData.detection.confidence * 120);
            ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.lineWidth = 2 * scale;
        } else {
            // Empty slot - faint outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
        }
        ctx.strokeRect(x, y, w, h);

        // Draw slot number in top-left corner
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y, slotBadgeW, slotBadgeH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${9 * scale}px sans-serif`;
        ctx.fillText(pos.slotIndex.toString(), x + 2 * scale, y + 9 * scale);
    }
}

export function drawDetectionLabels(ctx, detections, options = {}) {
    const { scale = 1, slotFilter = null, labelHeight = CONFIG.LABEL_HEIGHT } = options;

    for (const d of detections) {
        const pos = d.position;
        const correction = state.corrections.get(pos.slotIndex);

        // Skip corrected items (drawn separately)
        if (correction) continue;
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(pos.slotIndex)) continue;

        const x = pos.x * scale;
        const y = pos.y * scale;
        const w = pos.width * scale;
        const h = labelHeight * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y - h, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = `${10 * scale}px sans-serif`;
        ctx.fillText(`${d.item.name.slice(0, 10)} ${formatConfidence(d.confidence)}`, x + 2 * scale, y - 4 * scale);
    }
}

export function drawCorrectionLabels(ctx, options = {}) {
    const { scale = 1, slotFilter = null, labelHeight = CONFIG.LABEL_HEIGHT } = options;

    for (const [slotIndex, correction] of state.corrections) {
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(slotIndex)) continue;

        const slotData = state.detectionsBySlot.get(slotIndex);
        if (!slotData) continue;

        const pos = slotData.position;
        const x = pos.x * scale;
        const y = pos.y * scale;
        const w = pos.width * scale;
        const h = labelHeight * scale;

        if (correction.verified) {
            // Verified - green label
            ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
            ctx.fillRect(x, y - h, w, h);
            ctx.fillStyle = '#000';
            ctx.font = `bold ${10 * scale}px sans-serif`;
            ctx.fillText(`\u2713 ${correction.corrected.slice(0, 8)}`, x + 2 * scale, y - 4 * scale);
        } else {
            // Corrected - cyan label
            ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
            ctx.fillRect(x, y - h, w, h);
            ctx.fillStyle = '#000';
            ctx.font = `bold ${10 * scale}px sans-serif`;
            const label = correction.corrected ? correction.corrected.slice(0, 10) : '(empty)';
            ctx.fillText(label, x + 2 * scale, y - 4 * scale);
        }
    }
}

// ========================================
// Grid Preview (before detection)
// ========================================

export function drawGridPreview(canvas, width, height, slotFilter = null) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    canvas.classList.add(CSS_CLASSES.CLICKABLE);
    ctx.clearRect(0, 0, width, height);

    const gridPositions = detectGridPositions(width, height);

    for (const pos of gridPositions) {
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(pos.slotIndex)) continue;

        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

        // Draw slot number
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(pos.x, pos.y, CONFIG.SLOT_BADGE_SIZE.w, CONFIG.SLOT_BADGE_SIZE.h);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.font = '9px sans-serif';
        ctx.fillText(pos.slotIndex.toString(), pos.x + 2, pos.y + 9);
    }

    return gridPositions;
}

// ========================================
// Main Overlay Drawing
// ========================================

export function drawOverlay(canvas, detections, width, height, slotFilter = null) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    canvas.classList.add(CSS_CLASSES.CLICKABLE);
    ctx.clearRect(0, 0, width, height);

    const gridPositions = detectGridPositions(width, height);

    // Draw grid overlay
    drawGridOverlay(ctx, gridPositions, { scale: 1, slotFilter });

    // Draw detection labels
    drawDetectionLabels(ctx, detections, { scale: 1, slotFilter });

    // Draw correction labels
    drawCorrectionLabels(ctx, { scale: 1, slotFilter });
}

// ========================================
// Progress Bar
// ========================================

export function updateProgress(progressFill, percent) {
    progressFill.style.width = `${percent}%`;
}
