// ========================================
// MegaBonk Modal Entities Module
// Tome, Shrine, and other entity modals
// ========================================

import { escapeHtml } from './utils.ts';
import { renderFormulaDisplay } from './formula-renderer.ts';
import { getChartModule, getCurrentModalSessionId, incrementModalSessionId } from './modal-core.ts';
import type { Tome, Shrine } from '../types/index.ts';

/**
 * Render tome modal content
 * Bug fix: Escape all user-controlled values to prevent XSS
 * @param data - Tome data
 * @returns HTML content
 */
export async function renderTomeModal(data: Tome): Promise<string> {
    // Capture session ID for stale check after async operations
    const sessionId = incrementModalSessionId();

    // Use cached chart module to avoid repeated import overhead
    const chartModule = await getChartModule();
    if (!chartModule) {
        // Return basic content without charts (escaped)
        return `
            <div class="item-badges">
                <span class="badge tier-${escapeHtml(data.tier || '')}">${escapeHtml(data.tier || '')} Tier</span>
                <span class="badge" style="background: var(--bg-dark);">Priority: ${escapeHtml(String(data.priority || ''))}</span>
            </div>
            <p>${escapeHtml(data.description || '')}</p>
            <p class="error-message">Charts unavailable</p>
        `;
    }

    // Check if modal changed during import
    if (sessionId !== getCurrentModalSessionId()) {
        return ''; // Modal changed, return empty
    }

    const { calculateTomeProgression, createScalingChart } = chartModule;

    const progression = calculateTomeProgression(data);
    const graphHtml = progression
        ? `
        <div class="modal-graph-container">
            <canvas id="modal-tome-chart-${escapeHtml(data.id)}" class="scaling-chart"></canvas>
        </div>
    `
        : '';

    const content = `
        <div class="item-badges">
            <span class="badge tier-${escapeHtml(data.tier || '')}">${escapeHtml(data.tier || '')} Tier</span>
            <span class="badge" style="background: var(--bg-dark);">Priority: ${escapeHtml(String(data.priority || ''))}</span>
        </div>
        <div class="tome-effect" style="margin-top: 1rem;">
            <strong>Stat:</strong> ${escapeHtml(data.stat_affected || '')}
        </div>
        <p>${escapeHtml(data.description || '')}</p>
        ${graphHtml}
        <div class="item-formula"><strong>Per Level:</strong> ${renderFormulaDisplay(String(data.value_per_level))}</div>
        ${data.notes ? `<div class="item-notes">${escapeHtml(data.notes)}</div>` : ''}
        <div class="item-notes"><strong>Recommended for:</strong> ${Array.isArray(data.recommended_for) ? escapeHtml(data.recommended_for.join(', ')) : 'General use'}</div>
    `;

    // Initialize chart after modal is displayed using requestAnimationFrame with session check
    // Bug fix #11: Wait for modal animation (300ms) before chart init to ensure proper canvas sizing
    const MODAL_ANIMATION_DELAY = 350;
    if (progression) {
        setTimeout(() => {
            requestAnimationFrame(() => {
                // Verify modal hasn't changed before creating chart
                if (sessionId !== getCurrentModalSessionId()) return;
                const canvas = document.getElementById(`modal-tome-chart-${data.id}`);
                if (canvas) {
                    createScalingChart(
                        `modal-tome-chart-${data.id}`,
                        progression,
                        data.name,
                        data.stat_affected || '',
                        true
                    );
                }
            });
        }, MODAL_ANIMATION_DELAY);
    }

    return content;
}

/**
 * Render shrine modal content
 * Bug fix: Escape all user-controlled values to prevent XSS
 * @param data - Shrine data
 * @returns HTML content
 */
export function renderShrineModal(data: Shrine): string {
    return `
        <div class="shrine-modal-header">
            <span class="shrine-icon-modal">${escapeHtml(data.icon || '')}</span>
            <div class="item-badges">
                ${data.type ? `<span class="badge">${escapeHtml(data.type.replace('_', ' '))}</span>` : ''}
                ${data.reusable !== undefined ? (data.reusable ? '<span class="badge">Reusable</span>' : '<span class="badge">One-time</span>') : ''}
            </div>
        </div>
        <div class="shrine-description-full">
            <p>${escapeHtml(data.description || '')}</p>
        </div>
        ${
            data.reward
                ? `<div class="shrine-detail-section">
            <strong>Reward</strong>
            <p>${escapeHtml(data.reward)}</p>
        </div>`
                : ''
        }
        ${
            data.activation
                ? `
            <div class="shrine-detail-section">
                <strong>Activation</strong>
                <p>${escapeHtml(data.activation)}</p>
            </div>
        `
                : ''
        }
        ${
            data.spawn_count
                ? `
            <div class="shrine-detail-section">
                <strong>Spawn Rate</strong>
                <p>${escapeHtml(String(data.spawn_count))}</p>
            </div>
        `
                : ''
        }
        ${
            data.best_for?.length
                ? `
            <div class="shrine-detail-section">
                <strong>Best For</strong>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${escapeHtml(b)}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        ${
            data.synergies_items?.length
                ? `
            <div class="synergies-section">
                <h3>Item Synergies</h3>
                <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        ${
            data.strategy
                ? `
            <div class="shrine-strategy">
                <strong>Strategy</strong>
                <p>${escapeHtml(data.strategy)}</p>
            </div>
        `
                : ''
        }
        ${
            data.notes
                ? `
            <div class="item-notes" style="margin-top: 1rem;">
                <em>${escapeHtml(data.notes)}</em>
            </div>
        `
                : ''
        }
    `;
}
