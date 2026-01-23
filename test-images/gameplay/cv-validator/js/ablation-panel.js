/* ========================================
 * CV Validator - Ablation Panel
 * UI controller for pipeline component toggles
 * ======================================== */

import {
    getPipelineConfig,
    setPipelineConfig,
    resetPipelineConfig,
    toggleComponent,
    getComponent,
    applyPreset,
    getPresetNames,
    recordAblationResult,
    getAblationResults,
    clearAblationResults,
    calculateComponentImpact,
    ABLATION_PRESETS,
    COMPONENT_DESCRIPTIONS,
} from './pipeline-config.js';

import { log } from './utils.js';

// Module state
let isAblationPanelVisible = false;
let onConfigChangeCallback = null;

/**
 * Initialize the ablation panel
 * @param {Function} onConfigChange - Callback when config changes (triggers re-detection)
 */
export function initAblationPanel(onConfigChange) {
    onConfigChangeCallback = onConfigChange;

    // Toggle panel visibility
    const toggleBtn = document.getElementById('toggle-ablation');
    const panel = document.getElementById('ablation-panel');

    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            isAblationPanelVisible = !isAblationPanelVisible;
            panel.classList.toggle('show', isAblationPanelVisible);
            toggleBtn.classList.toggle('active', isAblationPanelVisible);
            toggleBtn.innerHTML = isAblationPanelVisible ? 'Ablation Testing &#x25B2;' : 'Ablation Testing &#x25BC;';
        });
    }

    // Initialize component toggles
    initComponentToggles();

    // Initialize preset buttons
    initPresetButtons();

    // Initialize action buttons
    initActionButtons();

    // Load saved config and update UI
    syncUIFromConfig();

    // Update impact display if we have results
    updateImpactDisplay();

    log('Ablation panel initialized');
}

/**
 * Initialize component toggle checkboxes
 */
function initComponentToggles() {
    const toggleIds = [
        'useMultiScale',
        'useContrastEnhancement',
        'useColorNormalization',
        'useSharpening',
        'useHistogramEqualization',
        'useDynamicGrid',
        'useResolutionAwareParams',
        'useRarityFiltering',
        'useEmptyCellFilter',
        'metrics.ssim',
        'metrics.ncc',
        'metrics.histogram',
        'metrics.edge',
        'useAgreementBonus',
    ];

    for (const id of toggleIds) {
        const checkbox = document.getElementById(`toggle-${id}`);
        if (checkbox) {
            checkbox.addEventListener('change', e => {
                toggleComponent(id, e.target.checked);
                log(`Ablation: ${id} = ${e.target.checked}`);
                updateToggleVisuals();
            });
        }
    }
}

/**
 * Initialize preset buttons
 */
function initPresetButtons() {
    const presetBtns = document.querySelectorAll('.ablation-presets .preset-btn[data-preset]');

    for (const btn of presetBtns) {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            if (applyPreset(presetName)) {
                log(`Ablation: Applied preset "${presetName}"`);
                syncUIFromConfig();
                highlightActivePreset(presetName);
            }
        });
    }
}

/**
 * Initialize action buttons
 */
function initActionButtons() {
    // Reset to default
    const resetBtn = document.getElementById('reset-ablation-config');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetPipelineConfig();
            syncUIFromConfig();
            log('Ablation: Reset to default config');
        });
    }

    // Apply & Re-detect
    const applyBtn = document.getElementById('apply-ablation-config');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (onConfigChangeCallback) {
                log('Ablation: Applying config and re-detecting...');
                onConfigChangeCallback(getPipelineConfig());
            }
        });
    }

    // Run Batch Ablation (placeholder - will be wired up separately)
    const batchBtn = document.getElementById('run-ablation-batch');
    if (batchBtn) {
        // Enable when we have test images loaded
        // Will be enabled by main.js
    }

    // Clear Results
    const clearBtn = document.getElementById('clear-ablation-results');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearAblationResults();
            updateResultsDisplay([]);
            updateImpactDisplay();
            log('Ablation: Cleared results');
        });
    }
}

/**
 * Sync UI checkboxes from current config
 */
function syncUIFromConfig() {
    const config = getPipelineConfig();

    // Update all checkboxes
    const toggleMap = {
        useMultiScale: config.useMultiScale,
        useContrastEnhancement: config.useContrastEnhancement,
        useColorNormalization: config.useColorNormalization,
        useSharpening: config.useSharpening,
        useHistogramEqualization: config.useHistogramEqualization,
        useDynamicGrid: config.useDynamicGrid,
        useResolutionAwareParams: config.useResolutionAwareParams,
        useRarityFiltering: config.useRarityFiltering,
        useEmptyCellFilter: config.useEmptyCellFilter,
        'metrics.ssim': config.metrics.ssim,
        'metrics.ncc': config.metrics.ncc,
        'metrics.histogram': config.metrics.histogram,
        'metrics.edge': config.metrics.edge,
        useAgreementBonus: config.useAgreementBonus,
    };

    for (const [id, value] of Object.entries(toggleMap)) {
        const checkbox = document.getElementById(`toggle-${id}`);
        if (checkbox) {
            checkbox.checked = value;
        }
    }

    updateToggleVisuals();
    highlightActivePreset(config.name);
}

/**
 * Update toggle visual states (disabled styling for off toggles)
 */
function updateToggleVisuals() {
    const toggles = document.querySelectorAll('.ablation-toggle');
    for (const toggle of toggles) {
        const checkbox = toggle.querySelector('input[type="checkbox"]');
        if (checkbox) {
            toggle.classList.toggle('disabled', !checkbox.checked);
        }
    }
}

/**
 * Highlight the active preset button
 */
function highlightActivePreset(presetName) {
    const presetBtns = document.querySelectorAll('.ablation-presets .preset-btn[data-preset]');
    for (const btn of presetBtns) {
        btn.classList.toggle('active', btn.dataset.preset === presetName);
    }
}

/**
 * Update live metrics display
 */
export function updateLiveMetrics(metrics) {
    const f1El = document.getElementById('ablation-f1');
    const precEl = document.getElementById('ablation-precision');
    const recallEl = document.getElementById('ablation-recall');
    const timeEl = document.getElementById('ablation-time');

    if (f1El) f1El.textContent = metrics.f1Score != null ? `${(metrics.f1Score * 100).toFixed(1)}%` : '--';
    if (precEl) precEl.textContent = metrics.precision != null ? `${(metrics.precision * 100).toFixed(1)}%` : '--';
    if (recallEl) recallEl.textContent = metrics.recall != null ? `${(metrics.recall * 100).toFixed(1)}%` : '--';
    if (timeEl) timeEl.textContent = metrics.time != null ? `${metrics.time.toFixed(0)}` : '--';
}

/**
 * Record result from a detection run
 */
export function recordDetectionResult(configName, metrics) {
    recordAblationResult(configName, {
        f1Score: metrics.f1Score,
        precision: metrics.precision,
        recall: metrics.recall,
        time: metrics.time,
    });
}

/**
 * Update results table display
 */
export function updateResultsDisplay(results) {
    const container = document.getElementById('ablation-results');
    const tbody = document.getElementById('ablation-results-body');

    if (!container || !tbody) return;

    if (results.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Find baseline for delta calculation
    const baseline = results.find(r => r.config === 'baseline-all-on');
    const baselineF1 = baseline?.f1Score || results[0]?.f1Score || 0;

    // Sort by F1 descending
    const sorted = [...results].sort((a, b) => (b.f1Score || 0) - (a.f1Score || 0));
    const bestF1 = sorted[0]?.f1Score || 0;
    const worstF1 = sorted[sorted.length - 1]?.f1Score || 0;

    // Build table rows
    tbody.innerHTML = sorted
        .map(result => {
            const f1 = result.f1Score || 0;
            const delta = f1 - baselineF1;
            const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`;
            const isBest = f1 === bestF1;
            const isWorst = f1 === worstF1 && sorted.length > 1;

            return `
            <tr>
                <td class="config-name">${result.config}</td>
                <td class="metric ${isBest ? 'best' : ''} ${isWorst ? 'worst' : ''}">${(f1 * 100).toFixed(1)}%</td>
                <td class="metric">${((result.precision || 0) * 100).toFixed(1)}%</td>
                <td class="metric">${((result.recall || 0) * 100).toFixed(1)}%</td>
                <td class="metric">${(result.time || 0).toFixed(0)}ms</td>
                <td class="metric ${delta > 0 ? 'best' : ''} ${delta < 0 ? 'worst' : ''}">${result.config === 'baseline-all-on' ? '-' : deltaStr}</td>
            </tr>
        `;
        })
        .join('');
}

/**
 * Update component impact display
 */
export function updateImpactDisplay() {
    const container = document.getElementById('ablation-impact');
    const list = document.getElementById('impact-list');

    if (!container || !list) return;

    const impact = calculateComponentImpact();

    if (!impact || impact.impacts.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    list.innerHTML = impact.impacts
        .map(item => {
            let icon, deltaClass;
            if (item.helps) {
                icon = '🟢';
                deltaClass = 'negative'; // Negative delta means component helps (disabling hurts)
            } else if (item.hurts) {
                icon = '🔴';
                deltaClass = 'positive';
            } else {
                icon = '⚪';
                deltaClass = 'neutral';
            }

            const deltaStr =
                item.delta >= 0 ? `+${(item.delta * 100).toFixed(1)}%` : `${(item.delta * 100).toFixed(1)}%`;
            const verdict = item.helps ? 'helps' : item.hurts ? 'hurts' : 'neutral';

            return `
            <div class="impact-item">
                <span class="impact-icon">${icon}</span>
                <span class="impact-name">${item.component}</span>
                <span class="impact-delta ${deltaClass}">${deltaStr}</span>
                <span class="toggle-hint">(${verdict})</span>
            </div>
        `;
        })
        .join('');
}

/**
 * Enable/disable batch ablation button
 */
export function setBatchAblationEnabled(enabled) {
    const btn = document.getElementById('run-ablation-batch');
    if (btn) {
        btn.disabled = !enabled;
    }
}

/**
 * Get current pipeline config for external use
 */
export function getCurrentPipelineConfig() {
    return getPipelineConfig();
}

/**
 * Run batch ablation tests
 * @param {Function} runDetectionFn - Function to run detection with a config
 * @param {Array} testImages - Array of test image names
 */
export async function runBatchAblation(runDetectionFn, testImages) {
    if (!testImages || testImages.length === 0) {
        log('Ablation: No test images available for batch testing');
        return;
    }

    const presets = [
        'baseline-all-on',
        'minimal',
        'no-multi-scale',
        'no-preprocessing',
        'no-dynamic-grid',
        'no-rarity-filter',
    ];

    log(`Ablation: Starting batch test with ${presets.length} configs on ${testImages.length} images`);

    const results = [];

    for (const presetName of presets) {
        const preset = ABLATION_PRESETS[presetName];
        if (!preset) continue;

        log(`Ablation: Testing config "${presetName}"...`);

        // Set the config
        setPipelineConfig(preset);

        // Run detection on all images and collect metrics
        let totalF1 = 0,
            totalPrecision = 0,
            totalRecall = 0,
            totalTime = 0;
        let count = 0;

        for (const imageName of testImages) {
            try {
                const metrics = await runDetectionFn(imageName, preset);
                if (metrics) {
                    totalF1 += metrics.f1Score || 0;
                    totalPrecision += metrics.precision || 0;
                    totalRecall += metrics.recall || 0;
                    totalTime += metrics.time || 0;
                    count++;
                }
            } catch (err) {
                log(`Ablation: Error testing ${imageName}: ${err.message}`, 'error');
            }
        }

        if (count > 0) {
            const avgResult = {
                config: presetName,
                f1Score: totalF1 / count,
                precision: totalPrecision / count,
                recall: totalRecall / count,
                time: totalTime / count,
            };
            results.push(avgResult);
            recordAblationResult(presetName, avgResult);
        }
    }

    // Update display
    updateResultsDisplay(getAblationResults());
    updateImpactDisplay();

    log(`Ablation: Batch test complete. ${results.length} configs tested.`);

    return results;
}
