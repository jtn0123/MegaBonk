// ========================================
// Shrine Renderer
// ========================================

import {
    escapeHtml,
    safeGetElementById,
    generateEmptyState,
} from '../utils.ts';
import { isFavorite } from '../favorites.ts';
import type { Shrine } from './types.ts';

/**
 * Render shrines grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} shrines - Shrines to render
 */
export function renderShrines(shrines: Shrine[]): void {
    const container = safeGetElementById('shrinesContainer');
    if (!container) return;

    container.innerHTML = '';

    if (shrines.length === 0) {
        container.innerHTML = generateEmptyState('⛩️', 'Shrines');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'item-card shrine-card';
        card.dataset.entityType = 'shrine';
        card.dataset.entityId = shrine.id;

        const isFav = typeof isFavorite === 'function' ? isFavorite('shrines', shrine.id) : false;

        card.innerHTML = `
            <div class="item-header">
                <span class="shrine-icon-large">${escapeHtml(shrine.icon || '')}</span>
                <div class="item-title">
                    <div class="item-name">${escapeHtml(shrine.name)}</div>
                    ${shrine.type ? `<span class="tier-label">${escapeHtml(shrine.type.replace('_', ' '))}</span>` : ''}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="shrines" data-id="${escapeHtml(shrine.id)}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(shrine.description)}</div>
            <div class="item-description">${shrine.reward ? escapeHtml(shrine.reward) : ''}</div>
            <div class="item-meta">
                ${shrine.reusable !== undefined ? (shrine.reusable ? '<span class="meta-tag">Reusable</span>' : '<span class="meta-tag">One-time</span>') : ''}
            </div>
            <button class="view-details-btn" data-type="shrines" data-id="${escapeHtml(shrine.id)}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);
}
