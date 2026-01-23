/**
 * Debug Visualization Panel
 * Shows confidence histograms, detection config, rarity breakdown, and metrics
 */

import { state } from './state.js';
import {
    getSessionStats,
    getConfusionPairs,
    getErrorProneItems,
    calculateUncertaintyScore,
} from './active-learning.js';
import { getSessionTemplateCount } from './cv-detection.js';

// Panel state
let isDebugPanelOpen = false;
let onSlotClickCallback = null;

/**
 * Initialize debug panel
 * @param {Object} options - Configuration options
 * @param {Function} options.onSlotClick - Callback when a slot is clicked (opens correction panel)
 */
export function initDebugPanel(options = {}) {
    const toggleBtn = document.getElementById('toggle-debug');
    const panel = document.getElementById('debug-panel');
    const exportBtn = document.getElementById('export-debug-data');

    if (options.onSlotClick) {
        onSlotClickCallback = options.onSlotClick;
    }

    if (!toggleBtn || !panel) {
        console.warn('Debug panel elements not found');
        return;
    }

    // Toggle panel visibility
    toggleBtn.addEventListener('click', () => {
        isDebugPanelOpen = !isDebugPanelOpen;
        panel.style.display = isDebugPanelOpen ? 'block' : 'none';
        toggleBtn.textContent = isDebugPanelOpen ? 'Debug Panel ▲' : 'Debug Panel ▼';

        if (isDebugPanelOpen) {
            updateDebugPanel();
        }
    });

    // Export debug data
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDebugData);
    }
}

/**
 * Update debug panel with current detection results
 */
export function updateDebugPanel() {
    if (!isDebugPanelOpen) return;

    const results = state.detectionResults || [];
    const groundTruth = state.groundTruth || {};
    const imageInfo = state.currentImageInfo || {};

    // Update confidence histogram
    updateConfidenceHistogram(results);

    // Update detection config
    updateDetectionConfig(imageInfo);

    // Update per-rarity breakdown
    updateRarityBreakdown(results, groundTruth);

    // Update uncertain detections
    updateUncertainDetections(results);

    // Update session metrics
    updateSessionMetrics();

    // Update active learning stats
    updateActiveLearningStats();

    // Update recommendations
    updateRecommendations(results, groundTruth);
}

/**
 * Update confidence histogram visualization
 */
function updateConfidenceHistogram(results) {
    const buckets = {
        '0.3-0.4': 0,
        '0.4-0.5': 0,
        '0.5-0.6': 0,
        '0.6-0.7': 0,
        '0.7-0.8': 0,
        '0.8-0.9': 0,
        '0.9-1.0': 0,
    };

    const confidences = results.map(r => r.confidence || 0);

    // Fill buckets
    for (const conf of confidences) {
        if (conf < 0.4) buckets['0.3-0.4']++;
        else if (conf < 0.5) buckets['0.4-0.5']++;
        else if (conf < 0.6) buckets['0.5-0.6']++;
        else if (conf < 0.7) buckets['0.6-0.7']++;
        else if (conf < 0.8) buckets['0.7-0.8']++;
        else if (conf < 0.9) buckets['0.8-0.9']++;
        else buckets['0.9-1.0']++;
    }

    // Find max for scaling
    const maxCount = Math.max(1, ...Object.values(buckets));

    // Update bars
    const bars = document.querySelectorAll('.histogram-bar');
    bars.forEach(bar => {
        const range = bar.dataset.range;
        const count = buckets[range] || 0;
        const fill = bar.querySelector('.bar-fill');
        if (fill) {
            fill.style.height = `${(count / maxCount) * 100}%`;
            fill.title = `${count} detections`;
        }
    });

    // Update stats
    const mean = confidences.length > 0
        ? (confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3)
        : '--';
    const sorted = [...confidences].sort((a, b) => a - b);
    const median = confidences.length > 0
        ? sorted[Math.floor(sorted.length / 2)].toFixed(3)
        : '--';
    const uncertain = confidences.filter(c => c >= 0.5 && c <= 0.7).length;

    document.getElementById('conf-mean').textContent = mean;
    document.getElementById('conf-median').textContent = median;
    document.getElementById('conf-uncertain').textContent = uncertain;
}

/**
 * Update detection configuration display
 */
function updateDetectionConfig(imageInfo) {
    const width = imageInfo.width || 0;
    const height = imageInfo.height || 0;

    // Resolution tier
    let tier = 'unknown';
    if (height <= 800) tier = 'low (720p)';
    else if (height <= 1200) tier = 'medium (1080p)';
    else if (height <= 1800) tier = 'high (1440p)';
    else tier = 'ultra (4K)';

    // Dynamic threshold (simplified calculation)
    const baseThreshold = 0.50;
    const tierAdjustment = { low: -0.05, medium: 0, high: 0.02, ultra: 0.03 };
    const tierKey = tier.split(' ')[0];
    const threshold = (baseThreshold + (tierAdjustment[tierKey] || 0)).toFixed(3);

    // Strategies
    const strategies = tierKey === 'low' ? 'default, high-recall' : 'default, high-precision';

    // Scoring weights
    const weights = 'SSIM=0.35, NCC=0.25, Hist=0.25, Edge=0.15';

    document.getElementById('debug-tier').textContent = tier;
    document.getElementById('debug-threshold').textContent = threshold;
    document.getElementById('debug-strategies').textContent = strategies;
    document.getElementById('debug-weights').textContent = weights;
}

/**
 * Update per-rarity accuracy breakdown
 */
function updateRarityBreakdown(results, groundTruth) {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const stats = {};

    // Initialize stats
    for (const r of rarities) {
        stats[r] = { detected: 0, correct: 0, total: 0 };
    }

    // Count ground truth by rarity
    const gtItems = groundTruth.items || [];
    for (const item of gtItems) {
        const rarity = item.rarity?.toLowerCase() || 'common';
        if (stats[rarity]) {
            stats[rarity].total++;
        }
    }

    // Count detections by rarity
    for (const result of results) {
        const rarity = result.entity?.rarity?.toLowerCase() || 'common';
        if (stats[rarity]) {
            stats[rarity].detected++;
            // Check if correct (simplified)
            const isCorrect = gtItems.some(gt =>
                gt.itemId === result.entity?.id || gt.name === result.entity?.name
            );
            if (isCorrect) {
                stats[rarity].correct++;
            }
        }
    }

    // Update display
    for (const rarity of rarities) {
        const el = document.getElementById(`rarity-${rarity}`);
        if (el) {
            const s = stats[rarity];
            if (s.total === 0) {
                el.textContent = '0 items';
            } else {
                const accuracy = s.total > 0 ? ((s.correct / s.total) * 100).toFixed(0) : 0;
                el.textContent = `${s.correct}/${s.total} (${accuracy}%)`;
            }
        }
    }
}

/**
 * Update uncertain detections list
 */
function updateUncertainDetections(results) {
    const container = document.getElementById('uncertain-list');
    const badge = document.getElementById('uncertain-count');

    if (!container) return;

    // Find uncertain detections (confidence 0.5-0.7) and sort by uncertainty score
    const uncertain = results
        .filter(r => r.confidence >= 0.5 && r.confidence <= 0.7)
        .map(r => ({
            ...r,
            uncertaintyScore: calculateUncertaintyScore({
                confidence: r.confidence,
                item: r.entity,
            }),
        }))
        .sort((a, b) => b.uncertaintyScore - a.uncertaintyScore);

    if (badge) {
        badge.textContent = uncertain.length;
        badge.className = uncertain.length > 0 ? 'uncertain-badge warning' : 'uncertain-badge';
    }

    if (uncertain.length === 0) {
        container.innerHTML = '<p class="no-uncertain">No uncertain detections</p>';
        return;
    }

    // Build list with clickable items
    container.innerHTML = '';
    uncertain.slice(0, 5).forEach(u => {
        const item = document.createElement('div');
        item.className = 'uncertain-item clickable';
        item.innerHTML = `
            <span class="item-name">${u.entity?.name || 'Unknown'}</span>
            <span class="item-conf">${(u.confidence * 100).toFixed(1)}%</span>
            <span class="item-slot">Slot ${u.slotIndex ?? '?'}</span>
            <span class="uncertainty-score" title="Uncertainty score">${(u.uncertaintyScore * 100).toFixed(0)}%</span>
        `;

        // Click handler to open correction panel
        if (onSlotClickCallback && u.slotIndex !== undefined) {
            item.addEventListener('click', () => {
                onSlotClickCallback(u.slotIndex);
            });
        }

        container.appendChild(item);
    });

    if (uncertain.length > 5) {
        const more = document.createElement('p');
        more.className = 'more-uncertain';
        more.textContent = `+${uncertain.length - 5} more`;
        container.appendChild(more);
    }
}

/**
 * Update active learning statistics
 */
function updateActiveLearningStats() {
    // Session stats
    const sessionStats = getSessionStats();
    const sessionCorrections = document.getElementById('session-corrections');
    const sessionVerifications = document.getElementById('session-verifications');
    const labelsPerMin = document.getElementById('labels-per-minute');

    if (sessionCorrections) sessionCorrections.textContent = sessionStats.corrections;
    if (sessionVerifications) sessionVerifications.textContent = sessionStats.verifications;
    if (labelsPerMin) labelsPerMin.textContent = sessionStats.labelsPerMinute;

    // Confusion pairs
    const confusionList = document.getElementById('confusion-list');
    if (confusionList) {
        const pairs = getConfusionPairs(5);
        if (pairs.length === 0) {
            confusionList.innerHTML = '<p class="no-data">No confusion data yet</p>';
        } else {
            confusionList.innerHTML = pairs.map(p => `
                <div class="confusion-item">
                    <span class="detected">${p.detected}</span>
                    <span class="arrow">→</span>
                    <span class="actual">${p.actual}</span>
                    <span class="count">(${p.count}x)</span>
                </div>
            `).join('');
        }
    }

    // Error-prone items
    const errorProneList = document.getElementById('error-prone-list');
    if (errorProneList) {
        const items = getErrorProneItems(5);
        if (items.length === 0) {
            errorProneList.innerHTML = '<p class="no-data">No error-prone items detected</p>';
        } else {
            errorProneList.innerHTML = items.map(i => `
                <div class="error-prone-item">
                    <span class="item-name">${i.item}</span>
                    <span class="error-count">${i.errorCount} errors</span>
                </div>
            `).join('');
        }
    }
}

/**
 * Update session metrics
 */
function updateSessionMetrics() {
    // These would normally come from the CV metrics system
    // For now, use state
    const runs = state.detectionRuns || 0;
    const avgTime = state.avgDetectionTime || 0;
    const cacheHits = state.cacheHits || 0;
    const cacheMisses = state.cacheMisses || 0;
    const twoPhaseSuccess = state.twoPhaseSuccessRate || 0;

    document.getElementById('metrics-runs').textContent = runs;
    document.getElementById('metrics-time').textContent = avgTime > 0 ? `${avgTime.toFixed(0)}ms` : '--';

    const cacheRate = (cacheHits + cacheMisses) > 0
        ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(0) + '%'
        : '--';
    document.getElementById('metrics-cache').textContent = cacheRate;
    document.getElementById('metrics-twophase').textContent = twoPhaseSuccess > 0
        ? `${(twoPhaseSuccess * 100).toFixed(0)}%`
        : '--';
}

/**
 * Update recommendations based on detection results
 */
function updateRecommendations(results, groundTruth) {
    const container = document.getElementById('recommendations-list');
    const templateCountEl = document.getElementById('session-template-count');

    // Update session template count
    if (templateCountEl) {
        templateCountEl.textContent = getSessionTemplateCount();
    }

    if (!container) return;

    const recommendations = [];

    // Get error-prone items
    const errorProne = getErrorProneItems(3);
    if (errorProne.length > 0) {
        const itemNames = errorProne.map(i => i.item).join(', ');
        recommendations.push({
            type: 'warning',
            icon: '⚠️',
            text: `<strong>${errorProne.length} items</strong> need more training data: ${itemNames}`,
            action: null,
        });
    }

    // Check for low-confidence detections
    const lowConf = results.filter(r => r.confidence >= 0.5 && r.confidence < 0.65);
    if (lowConf.length > 0) {
        recommendations.push({
            type: 'info',
            icon: '💡',
            text: `<strong>${lowConf.length} detections</strong> have borderline confidence (50-65%). Consider verifying these.`,
            action: null,
        });
    }

    // Check rarity-specific accuracy issues
    const rarityStats = calculateRarityAccuracy(results, groundTruth);
    const lowAccuracyRarities = Object.entries(rarityStats)
        .filter(([_, stats]) => stats.total >= 2 && stats.accuracy < 0.7)
        .map(([rarity]) => rarity);

    if (lowAccuracyRarities.length > 0) {
        recommendations.push({
            type: 'info',
            icon: '🎯',
            text: `Consider adjusting thresholds for <strong>${lowAccuracyRarities.join(', ')}</strong> items (accuracy below 70%)`,
            action: null,
        });
    }

    // Session templates feedback
    const sessionCount = getSessionTemplateCount();
    if (sessionCount > 0) {
        recommendations.push({
            type: 'success',
            icon: '✓',
            text: `<strong>${sessionCount} templates</strong> added this session. These improve detection accuracy immediately.`,
            action: null,
        });
    }

    // Render recommendations
    if (recommendations.length === 0) {
        container.innerHTML = '<p class="no-data">No recommendations - detection looks good!</p>';
    } else {
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item ${rec.type}">
                <span class="rec-icon">${rec.icon}</span>
                <span class="rec-text">${rec.text}</span>
                ${rec.action ? `<span class="rec-action">${rec.action}</span>` : ''}
            </div>
        `).join('');
    }
}

/**
 * Calculate per-rarity accuracy
 */
function calculateRarityAccuracy(results, groundTruth) {
    const stats = {};
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    for (const r of rarities) {
        stats[r] = { total: 0, correct: 0, accuracy: 0 };
    }

    const gtItems = groundTruth?.items || [];

    // Count ground truth by rarity
    for (const item of gtItems) {
        const rarity = item.rarity?.toLowerCase() || 'common';
        if (stats[rarity]) {
            stats[rarity].total++;
        }
    }

    // Count correct detections by rarity
    for (const result of results) {
        const rarity = result.entity?.rarity?.toLowerCase() || 'common';
        if (stats[rarity]) {
            const isCorrect = gtItems.some(gt =>
                gt.itemId === result.entity?.id || gt.name === result.entity?.name
            );
            if (isCorrect) {
                stats[rarity].correct++;
            }
        }
    }

    // Calculate accuracy
    for (const rarity of rarities) {
        if (stats[rarity].total > 0) {
            stats[rarity].accuracy = stats[rarity].correct / stats[rarity].total;
        }
    }

    return stats;
}

/**
 * Export debug data as JSON
 */
function exportDebugData() {
    const data = {
        timestamp: new Date().toISOString(),
        image: state.currentImageInfo,
        results: state.detectionResults,
        groundTruth: state.groundTruth,
        config: {
            threshold: document.getElementById('debug-threshold')?.textContent,
            tier: document.getElementById('debug-tier')?.textContent,
            strategies: document.getElementById('debug-strategies')?.textContent,
        },
        metrics: {
            runs: state.detectionRuns,
            avgTime: state.avgDetectionTime,
            cacheHits: state.cacheHits,
        },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Export for use in main.js
export default {
    initDebugPanel,
    updateDebugPanel,
};
