/* ========================================
 * CV Validator - Active Learning Module
 * Prioritizes uncertain detections and tracks error patterns
 * ======================================== */

import { state } from './state.js';

// Storage key for persistent learning data
const STORAGE_KEY = 'cv-active-learning';

// Learning state
let learningData = {
    // Tracks confusion patterns: { "detectedAs|actualItem": count }
    confusionCounts: {},

    // Items with high correction rates
    errorProneItems: {},

    // Confidence calibration per item
    confidenceCalibration: {},

    // Session stats
    sessionStats: {
        corrections: 0,
        verifications: 0,
        startTime: null,
    },
};

// ========================================
// Initialization
// ========================================

export function initActiveLearning() {
    loadLearningData();
    learningData.sessionStats.startTime = Date.now();
}

function loadLearningData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            learningData = { ...learningData, ...data };
        }
    } catch (e) {
        console.warn('Could not load active learning data:', e);
    }
}

function saveLearningData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(learningData));
    } catch (e) {
        console.warn('Could not save active learning data:', e);
    }
}

// ========================================
// Recording Corrections
// ========================================

/**
 * Record a correction event for learning
 */
export function recordCorrection(detectedItem, actualItem, confidence) {
    // Normalize empty strings to null for consistent handling
    const detected = detectedItem?.trim() || null;
    const actual = actualItem?.trim() || null;

    // Skip if we have no meaningful data
    if (!detected && !actual) return;

    learningData.sessionStats.corrections++;

    // Track confusion pattern
    if (detected && actual && detected !== actual) {
        const key = `${detected}|${actual}`;
        learningData.confusionCounts[key] = (learningData.confusionCounts[key] || 0) + 1;

        // Track error-prone items
        learningData.errorProneItems[detected] = (learningData.errorProneItems[detected] || 0) + 1;
    }

    // Update confidence calibration
    if (actual) {
        if (!learningData.confidenceCalibration[actual]) {
            learningData.confidenceCalibration[actual] = {
                totalDetections: 0,
                correctDetections: 0,
                avgConfidenceWhenCorrect: 0,
                avgConfidenceWhenWrong: 0,
            };
        }

        const cal = learningData.confidenceCalibration[actual];
        cal.totalDetections++;

        if (detected === actual) {
            cal.correctDetections++;
            cal.avgConfidenceWhenCorrect =
                (cal.avgConfidenceWhenCorrect * (cal.correctDetections - 1) + confidence) / cal.correctDetections;
        } else {
            const wrongCount = cal.totalDetections - cal.correctDetections;
            cal.avgConfidenceWhenWrong =
                (cal.avgConfidenceWhenWrong * (wrongCount - 1) + confidence) / wrongCount;
        }
    }

    saveLearningData();
}

/**
 * Record a verification (item was detected correctly)
 */
export function recordVerification(itemName, confidence) {
    learningData.sessionStats.verifications++;

    if (!learningData.confidenceCalibration[itemName]) {
        learningData.confidenceCalibration[itemName] = {
            totalDetections: 0,
            correctDetections: 0,
            avgConfidenceWhenCorrect: 0,
            avgConfidenceWhenWrong: 0,
        };
    }

    const cal = learningData.confidenceCalibration[itemName];
    cal.totalDetections++;
    cal.correctDetections++;
    cal.avgConfidenceWhenCorrect =
        (cal.avgConfidenceWhenCorrect * (cal.correctDetections - 1) + confidence) / cal.correctDetections;

    saveLearningData();
}

// ========================================
// Prioritization
// ========================================

/**
 * Calculate uncertainty score for a detection
 * Higher score = more uncertain = should be reviewed first
 */
export function calculateUncertaintyScore(detection) {
    const { confidence, item } = detection;
    const itemName = item?.name;

    let score = 0;

    // Base uncertainty from confidence (middle range = most uncertain)
    // Detection with 0.5-0.7 confidence is more uncertain than 0.9 or 0.3
    const confidenceUncertainty = 1 - Math.abs(confidence - 0.6) * 2;
    score += confidenceUncertainty * 0.4;

    // Increase uncertainty for error-prone items
    if (itemName && learningData.errorProneItems[itemName]) {
        const errorCount = learningData.errorProneItems[itemName];
        score += Math.min(0.3, errorCount * 0.05);
    }

    // Check if this item has known confusions
    const confusionBonus = getConfusionScore(itemName);
    score += confusionBonus * 0.2;

    // Check confidence calibration
    if (itemName && learningData.confidenceCalibration[itemName]) {
        const cal = learningData.confidenceCalibration[itemName];
        const accuracy = cal.totalDetections > 0 ? cal.correctDetections / cal.totalDetections : 0.5;

        // If this item historically has low accuracy, increase uncertainty
        if (accuracy < 0.7) {
            score += (0.7 - accuracy) * 0.3;
        }

        // If current confidence is below the typical correct confidence, increase uncertainty
        if (cal.avgConfidenceWhenCorrect > 0 && confidence < cal.avgConfidenceWhenCorrect * 0.8) {
            score += 0.1;
        }
    }

    return Math.min(1, Math.max(0, score));
}

/**
 * Get confusion score for an item (how often it's confused with others)
 */
function getConfusionScore(itemName) {
    if (!itemName) return 0;

    let confusionCount = 0;
    for (const key of Object.keys(learningData.confusionCounts)) {
        if (key.startsWith(`${itemName}|`)) {
            confusionCount += learningData.confusionCounts[key];
        }
    }

    return Math.min(1, confusionCount / 10);
}

/**
 * Sort detections by uncertainty (most uncertain first)
 */
export function sortByUncertainty(detections) {
    return [...detections].sort((a, b) => {
        const scoreA = calculateUncertaintyScore(a);
        const scoreB = calculateUncertaintyScore(b);
        return scoreB - scoreA;
    });
}

/**
 * Get slots that most need review (in batch mode)
 */
export function getPrioritySlots(count = 10) {
    const slots = [];

    // Add detection slots
    for (const [slotIndex, slotData] of state.detectionsBySlot) {
        if (state.corrections.has(slotIndex)) continue;

        const detection = slotData.detection;
        const uncertainty = calculateUncertaintyScore(detection);

        slots.push({
            index: slotIndex,
            type: 'detection',
            uncertainty,
            confidence: detection.confidence,
            itemName: detection.item?.name,
        });
    }

    // Sort by uncertainty
    slots.sort((a, b) => b.uncertainty - a.uncertainty);

    return slots.slice(0, count);
}

// ========================================
// Suggestions
// ========================================

/**
 * Get suggested corrections for a detection based on confusion patterns
 */
export function getSuggestedCorrections(detectedItem, topMatches) {
    const suggestions = [];

    // Check confusion history
    for (const [key, count] of Object.entries(learningData.confusionCounts)) {
        const [detected, actual] = key.split('|');
        if (detected === detectedItem && count >= 2) {
            suggestions.push({
                item: actual,
                reason: `Often confused (${count} times)`,
                priority: count,
            });
        }
    }

    // Add top alternatives from detection
    if (topMatches) {
        for (let i = 1; i < Math.min(4, topMatches.length); i++) {
            const match = topMatches[i];
            if (!suggestions.find(s => s.item === match.item.name)) {
                suggestions.push({
                    item: match.item.name,
                    reason: `Alternative (${Math.round(match.confidence * 100)}%)`,
                    priority: match.confidence * 10,
                });
            }
        }
    }

    // Sort by priority
    return suggestions.sort((a, b) => b.priority - a.priority);
}

// ========================================
// Analysis & Reports
// ========================================

/**
 * Get commonly confused item pairs
 */
export function getConfusionPairs(limit = 10) {
    const pairs = Object.entries(learningData.confusionCounts)
        .map(([key, count]) => {
            const [detected, actual] = key.split('|');
            return { detected, actual, count };
        })
        .sort((a, b) => b.count - a.count);

    return pairs.slice(0, limit);
}

/**
 * Get most error-prone items
 */
export function getErrorProneItems(limit = 10) {
    return Object.entries(learningData.errorProneItems)
        .map(([item, count]) => ({ item, errorCount: count }))
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, limit);
}

/**
 * Get items that need more training data
 * Based on low confidence calibration accuracy
 */
export function getItemsNeedingTraining(limit = 10) {
    const items = [];

    for (const [itemName, cal] of Object.entries(learningData.confidenceCalibration)) {
        if (cal.totalDetections < 3) continue;

        const accuracy = cal.correctDetections / cal.totalDetections;
        if (accuracy < 0.8) {
            items.push({
                item: itemName,
                accuracy: Math.round(accuracy * 100),
                detections: cal.totalDetections,
                reason: accuracy < 0.5 ? 'Very low accuracy' : 'Below target accuracy',
            });
        }
    }

    return items.sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
}

/**
 * Get session statistics
 */
export function getSessionStats() {
    const duration = Date.now() - learningData.sessionStats.startTime;
    const total = learningData.sessionStats.corrections + learningData.sessionStats.verifications;

    return {
        corrections: learningData.sessionStats.corrections,
        verifications: learningData.sessionStats.verifications,
        total,
        durationMs: duration,
        labelsPerMinute: total > 0 ? ((total / duration) * 60000).toFixed(1) : 0,
    };
}

/**
 * Reset learning data (for testing)
 */
export function resetLearningData() {
    learningData = {
        confusionCounts: {},
        errorProneItems: {},
        confidenceCalibration: {},
        sessionStats: {
            corrections: 0,
            verifications: 0,
            startTime: Date.now(),
        },
    };
    saveLearningData();
}

/**
 * Export learning data for analysis
 */
export function exportLearningData() {
    return {
        ...learningData,
        exportedAt: new Date().toISOString(),
    };
}
