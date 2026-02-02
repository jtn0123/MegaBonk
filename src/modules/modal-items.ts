// ========================================
// MegaBonk Modal Items Module
// Item modal rendering
// ========================================

import { safeGetElementById, generateModalImage, escapeHtml } from './utils.ts';
import { logger } from './logger.ts';
import { renderFormulaDisplay } from './formula-renderer.ts';
import { getChartModule, getCurrentModalSessionId, incrementModalSessionId, tabHandlers } from './modal-core.ts';
import type { ChartOptions } from './modal-core.ts';
import type { Item } from '../types/index.ts';

/**
 * Render item modal content
 * @param data - Item data
 * @returns HTML content
 */
export function renderItemModal(data: Item): string {
    const showGraph = data.scaling_per_stack && !data.one_and_done && data.graph_type !== 'flat';
    const hasScalingTracks = data.scaling_tracks && Object.keys(data.scaling_tracks).length > 0;

    // Generate scaling tracks tabs if item has multiple tracks
    let graphHtml = '';
    if (hasScalingTracks) {
        const trackKeys = Object.keys(data.scaling_tracks!);
        const tabsHtml = trackKeys
            .map(
                (key, idx) =>
                    `<button class="scaling-tab ${idx === 0 ? 'active' : ''}" data-track="${key}" data-item-id="${data.id}" role="tab" aria-selected="${idx === 0 ? 'true' : 'false'}" aria-controls="modal-chart-${data.id}">${data.scaling_tracks![key]?.stat || key}</button>`
            )
            .join('');

        graphHtml = `
            <div class="scaling-tracks-container">
                <div class="scaling-tabs" role="tablist" aria-label="Scaling tracks">${tabsHtml}</div>
                <div class="modal-graph-container" role="tabpanel">
                    <canvas id="modal-chart-${data.id}" class="scaling-chart" aria-label="Scaling chart for ${escapeHtml(data.name)}"></canvas>
                </div>
            </div>
        `;
    } else if (showGraph) {
        graphHtml = `
            <div class="modal-graph-container">
                <canvas id="modal-chart-${data.id}" class="scaling-chart" aria-label="Scaling chart for ${escapeHtml(data.name)}"></canvas>
            </div>
        `;
    }

    // Hidden mechanics section (prominent)
    const hiddenMechanicsHtml = data.hidden_mechanics?.length
        ? `
        <div class="hidden-mechanics">
            <h4><span class="hidden-mechanics-icon">⚡</span> Hidden Mechanics</h4>
            <ul>
                ${data.hidden_mechanics.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
            </ul>
        </div>
    `
        : '';

    // Hyperbolic scaling indicator
    const hyperbolicWarning =
        data.scaling_formula_type === 'hyperbolic'
            ? `
        <div class="hyperbolic-warning">
            <span class="warning-icon">⚠</span>
            <span>Hyperbolic Scaling: Displayed values have diminishing returns</span>
        </div>
    `
            : '';

    const imageHtml = generateModalImage(data, data.name, 'item');

    const content = `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge rarity-${escapeHtml(data.rarity || '')}">${escapeHtml(data.rarity || '')}</span>
            <span class="badge tier-${escapeHtml(data.tier || '')}">${escapeHtml(data.tier || '')} Tier</span>
        </div>
        ${
            data.one_and_done
                ? `
            <div class="one-and-done-warning">
                <span class="warning-icon">!</span>
                <span>One-and-Done: Additional copies provide no benefit</span>
            </div>
        `
                : ''
        }
        ${hyperbolicWarning}
        ${
            data.max_stacks || (data.stack_cap && data.stack_cap <= 100)
                ? `
            <div class="stack-info">
                <strong>Stack Limit:</strong> ${data.max_stacks || data.stack_cap} stacks
            </div>
        `
                : ''
        }
        <div class="item-effect" style="margin-top: 1rem;">${escapeHtml(data.base_effect || '')}</div>
        <p>${escapeHtml(data.detailed_description || '')}</p>
        ${hiddenMechanicsHtml}
        ${graphHtml}
        ${data.formula ? `<div class="item-formula"><strong>Formula:</strong> ${renderFormulaDisplay(data.formula)}</div>` : ''}
        ${data.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${data.synergies.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div></div>` : ''}
        ${data.anti_synergies?.length ? `<div class="anti-synergies-section"><h3>Anti-Synergies</h3><div class="antisynergy-list">${data.anti_synergies.map(s => `<span class="antisynergy-tag">${escapeHtml(s)}</span>`).join('')}</div></div>` : ''}
    `;

    // Bug fix #10: Use requestAnimationFrame for more reliable chart initialization
    // Initialize chart after modal is displayed and DOM is ready
    // Bug fix: Use session ID to cancel stale initialization attempts when modal changes
    // Bug fix #11: Wait for modal animation to complete before chart init (fixes mobile blank charts)
    const sessionId = incrementModalSessionId();
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 50; // Prevent infinite loop - ~830ms max wait
    const MODAL_ANIMATION_DELAY = 350; // CSS modal animation is 300ms, add buffer
    const initChart = async (): Promise<void> => {
        // Check if this initialization is still valid (modal wasn't reopened with different content)
        if (sessionId !== getCurrentModalSessionId()) {
            return; // Stale initialization, abort
        }

        // Check if modal is still active before continuing
        const modal = safeGetElementById('itemModal');
        if (!modal || !modal.classList.contains('active')) {
            return; // Modal closed, stop trying
        }

        const canvas = document.getElementById(`modal-chart-${data.id}`) as HTMLCanvasElement | null;
        if (!canvas) {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Canvas not ready yet, try again
                requestAnimationFrame(initChart);
            }
            // If max attempts reached, silently give up (modal may have closed)
            return;
        }

        // Use cached chart module to avoid repeated import overhead
        const chartModule = await getChartModule();
        if (!chartModule) {
            return; // Can't render charts without the module
        }

        // Re-check session ID after async operation to prevent stale chart creation
        if (sessionId !== getCurrentModalSessionId()) {
            return; // Modal changed during import, abort
        }

        const { getEffectiveStackCap, createScalingChart } = chartModule;

        if (hasScalingTracks && data.scaling_tracks) {
            // Initialize with first track
            const trackKeys = Object.keys(data.scaling_tracks);
            if (trackKeys.length === 0) return; // Guard against empty scaling_tracks
            const firstTrackKey = trackKeys[0];
            const firstTrack = firstTrackKey ? data.scaling_tracks[firstTrackKey] : undefined;
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions: ChartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || 0,
            };
            if (firstTrack) {
                createScalingChart(
                    `modal-chart-${data.id}`,
                    firstTrack.values,
                    firstTrack.stat,
                    data.scaling_type || '',
                    true,
                    undefined,
                    effectiveCap,
                    chartOptions
                );
            }

            // Add tab click handlers
            setupScalingTabHandlers(data);
        } else if (showGraph) {
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions: ChartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || 0,
            };
            createScalingChart(
                `modal-chart-${data.id}`,
                data.scaling_per_stack!,
                data.name,
                data.scaling_type || '',
                true,
                data.secondary_scaling || undefined,
                effectiveCap,
                chartOptions
            );
        }
    };
    // Wait for modal animation to complete before initializing chart
    // This ensures the canvas has its final dimensions for Chart.js to measure
    setTimeout(() => requestAnimationFrame(initChart), MODAL_ANIMATION_DELAY);

    return content;
}

/**
 * Setup tab click handlers for scaling tracks using event delegation
 * Bug fix #7: Use event delegation instead of adding listeners to each tab
 * @param data - Item data with scaling_tracks
 */
function setupScalingTabHandlers(data: Item): void {
    // Use event delegation on the container to avoid memory leaks
    const container = document.querySelector('.scaling-tabs') as HTMLElement | null;
    if (!container) return;

    // Store handler reference for potential cleanup
    const handleTabClick = async (e: Event): Promise<void> => {
        const target = e.target as HTMLElement;
        const tab = target.closest(`.scaling-tab[data-item-id="${data.id}"]`) as HTMLButtonElement | null;
        if (!tab) return;

        // Update active state and ARIA
        const tabs = container.querySelectorAll(`.scaling-tab[data-item-id="${data.id}"]`);
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Use cached chart module to avoid repeated import overhead
        const chartModule = await getChartModule();
        if (!chartModule) {
            return; // Can't render charts without the module
        }
        const { getEffectiveStackCap, createScalingChart } = chartModule;

        // Get track data and redraw chart
        const trackKey = tab.dataset.track;
        if (!trackKey) {
            logger.warn({
                operation: 'chart.init',
                data: { context: 'tab_switch', reason: 'missing_data_track_attribute' },
            });
            return;
        }
        const track = data.scaling_tracks?.[trackKey];
        if (!track) return;

        const effectiveCap = getEffectiveStackCap(data);
        const chartOptions: ChartOptions = {
            scalingFormulaType: data.scaling_formula_type || 'linear',
            hyperbolicConstant: data.hyperbolic_constant || 1.0,
            maxStacks: data.max_stacks || 0,
        };
        createScalingChart(
            `modal-chart-${data.id}`,
            track.values,
            track.stat,
            data.scaling_type || '',
            true,
            undefined,
            effectiveCap,
            chartOptions
        );
    };

    // Remove any existing handler before adding new one
    const existingHandler = tabHandlers.get(container);
    if (existingHandler) {
        container.removeEventListener('click', existingHandler);
    }
    tabHandlers.set(container, handleTabClick);
    container.addEventListener('click', handleTabClick);
}
