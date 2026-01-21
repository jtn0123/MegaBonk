/* global setTimeout, clearTimeout */
/* ========================================
 * CV Validator - Utilities
 * Logging, filters, metrics calculation
 * ======================================== */

import { LOG_LEVELS, METRIC_THRESHOLDS } from './config.js';
import { state } from './state.js';

// Re-export LOG_LEVELS for convenience
export { LOG_LEVELS };

// ========================================
// Logging
// ========================================

let logContentEl = null;

export function initLogger(logElement) {
    logContentEl = logElement;
}

export function log(message, level = LOG_LEVELS.INFO) {
    if (!logContentEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContentEl.appendChild(entry);
    logContentEl.scrollTop = logContentEl.scrollHeight;
}

export function clearLog() {
    if (logContentEl) {
        logContentEl.innerHTML = '';
    }
}

// ========================================
// Slot Filter Parsing
// ========================================

export function parseSlotFilter(filterValue) {
    const val = filterValue.trim().toLowerCase();
    if (!val || val === 'all') return null; // Show all
    const indices = val
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));
    return indices.length > 0 ? new Set(indices) : null;
}

// ========================================
// Metrics Calculation
// ========================================

export function calculateMetrics(detections, groundTruthItems) {
    // Count detected items
    const detectedCounts = new Map();
    for (const d of detections) {
        const name = d.item?.name || d.name;
        if (name) {
            detectedCounts.set(name, (detectedCounts.get(name) || 0) + 1);
        }
    }

    // Count ground truth items
    const truthCounts = new Map();
    for (const name of groundTruthItems) {
        truthCounts.set(name, (truthCounts.get(name) || 0) + 1);
    }

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    // True positives and false positives
    for (const [name, count] of detectedCounts) {
        const truthCount = truthCounts.get(name) || 0;
        truePositives += Math.min(count, truthCount);
        if (count > truthCount) {
            falsePositives += count - truthCount;
        }
    }

    // False negatives
    for (const [name, count] of truthCounts) {
        const detectedCount = detectedCounts.get(name) || 0;
        if (detectedCount < count) {
            falseNegatives += count - detectedCount;
        }
    }

    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;

    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;

    const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

    return { precision, recall, f1, truePositives, falsePositives, falseNegatives };
}

// Get metric color class based on value
export function getMetricClass(value) {
    if (value >= METRIC_THRESHOLDS.GOOD) return 'success';
    if (value >= METRIC_THRESHOLDS.WARNING) return 'warning';
    return 'error';
}

// ========================================
// Effective Detections (with corrections applied)
// ========================================

export function getEffectiveDetections() {
    const effective = [];

    for (const [slotIndex, slotData] of state.detectionsBySlot) {
        const correction = state.corrections.get(slotIndex);
        if (correction) {
            if (correction.corrected) {
                effective.push({ name: correction.corrected, slotIndex });
            }
            // If corrected to null (empty), don't add to effective
        } else {
            effective.push({ name: slotData.detection.item.name, slotIndex });
        }
    }

    return effective;
}

// ========================================
// Item filtering helpers
// ========================================

export function filterItems(items, filter, searchQuery) {
    return items.filter(item => {
        if (filter !== 'all' && item.rarity !== filter) return false;
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });
}

// ========================================
// Count helpers
// ========================================

export function countItems(items) {
    const counts = new Map();
    for (const item of items) {
        const name = typeof item === 'string' ? item : item.name;
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
}

// ========================================
// Format helpers
// ========================================

export function formatPercent(value, decimals = 1) {
    return `${(value * 100).toFixed(decimals)}%`;
}

export function formatConfidence(confidence) {
    return formatPercent(confidence, 0);
}

// ========================================
// Image path helpers
// ========================================

export function getImagePath(imagePath) {
    return '../../src/' + imagePath;
}

// ========================================
// Toast notification
// ========================================

let toastEl = null;
let toastTimeout = null;

export function initToast(element) {
    toastEl = element;
}

export function showToast(message, duration = 1500) {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.classList.add('show');

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, duration);
}
