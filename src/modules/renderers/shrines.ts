// ========================================
// Shrine Renderer
// ========================================

import {
    escapeHtml,
    safeGetElementById,
} from '../utils.ts';
import { detectEmptyStateType, generateEmptyStateWithSuggestions } from '../empty-states.ts';
import type { Shrine } from './types.ts';

/**
 * Render shrines grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} shrines - Shrines to render
 */
export function renderShrines(shrines: Shrine[]): void {
    const container = safeGetElementById('shrinesContainer');
    if (!container) return;

    if (shrines.length === 0) {
        const context = detectEmptyStateType('shrines');
        container.innerHTML = generateEmptyStateWithSuggestions(context);
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'item-card shrine-card clickable-card';
        card.dataset.entityType = 'shrine';
        card.dataset.entityId = shrine.id;

        // DISABLED: Favorites feature UI hidden (module kept for data persistence)
        // const isFav = typeof isFavorite === 'function' ? isFavorite('shrines', shrine.id) : false;

        card.innerHTML = `
            <div class="item-header">
                <span class="shrine-icon-large">${escapeHtml(shrine.icon || '')}</span>
                <div class="item-title">
                    <div class="item-name">${escapeHtml(shrine.name)}</div>
                    ${shrine.type ? `<span class="tier-label">${escapeHtml(shrine.type.replace('_', ' '))}</span>` : ''}
                </div>
                <!-- DISABLED: Favorite button hidden
                <button class="favorite-btn" data-tab="shrines" data-id="${escapeHtml(shrine.id)}" title="Add to favorites" aria-label="Add to favorites">
                    ☆
                </button>
                -->
            </div>
            <div class="item-effect">${escapeHtml(shrine.description)}</div>
            <div class="item-description">${shrine.reward ? escapeHtml(shrine.reward) : ''}</div>
            <div class="item-meta">
                ${shrine.reusable !== undefined ? (shrine.reusable ? '<span class="meta-tag">Reusable</span>' : '<span class="meta-tag">One-time</span>') : ''}
            </div>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);
}
