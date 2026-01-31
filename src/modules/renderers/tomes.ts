// ========================================
// Tome Renderer
// ========================================

import {
    generateEntityImage,
    escapeHtml,
    safeGetElementById,
    generateEmptyState,
} from '../utils.ts';
import { isFavorite } from '../favorites.ts';
import { initChartsAsync } from './common.ts';
import type { Tome } from './types.ts';

/**
 * Render tomes grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} tomes - Tomes to render
 */
export function renderTomes(tomes: Tome[]): void {
    const container = safeGetElementById('tomesContainer');
    if (!container) return;

    if (tomes.length === 0) {
        container.innerHTML = generateEmptyState('📚', 'Tomes');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    tomes.forEach(tome => {
        const card = document.createElement('div');
        card.className = 'item-card tome-card';
        card.dataset.entityType = 'tome';
        card.dataset.entityId = tome.id;

        const imageHtml = generateEntityImage(tome, tome.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('tomes', tome.id) : false;

        // Check if tome has valid progression data (numeric value in value_per_level)
        const valueStr = typeof tome.value_per_level === 'number' ? String(tome.value_per_level) : tome.value_per_level;
        const hasProgression = valueStr && /[+-]?[\d.]+/.test(valueStr);
        const graphHtml = hasProgression
            ? `
            <div class="tome-graph-container">
                <canvas id="tome-chart-${tome.id}" class="scaling-chart"></canvas>
            </div>
        `
            : `
            <div class="tome-graph-placeholder">
                <span>No progression data available</span>
            </div>
        `;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(tome.name)}</div>
                    <span class="tier-label">${tome.tier} Tier · Priority ${tome.priority}</span>
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="tomes" data-id="${tome.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(tome.stat_affected)}: ${escapeHtml(String(tome.value_per_level))}</div>
            <div class="item-description">${escapeHtml(tome.description)}</div>
            ${graphHtml}
            <button class="view-details-btn" data-type="tomes" data-id="${tome.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);

    // Initialize charts after DOM is painted
    initChartsAsync('initializeTomeCharts', 'tome_tab_render');
}
