// ========================================
// Character Renderer
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
    generateEmptyState,
} from '../utils.ts';
import { isFavorite } from '../favorites.ts';
import type { Character } from './types.ts';

/**
 * Render characters grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} characters - Characters to render
 */
export function renderCharacters(characters: Character[]): void {
    const container = safeGetElementById('charactersContainer');
    if (!container) return;

    if (characters.length === 0) {
        container.innerHTML = generateEmptyState('👤', 'Characters');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'item-card character-card';
        card.dataset.entityType = 'character';
        card.dataset.entityId = char.id;

        const imageHtml = generateEntityImage(char, char.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('characters', char.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(char.name)}</div>
                    ${generateTierLabel(char.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="characters" data-id="${char.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(char.passive_ability)}</div>
            <div class="item-description">${escapeHtml(char.passive_description)}</div>
            <div class="item-meta">
                <span class="meta-tag">${escapeHtml(char.starting_weapon)}</span>
                <span class="meta-tag">${escapeHtml(char.playstyle)}</span>
            </div>
            <button class="view-details-btn" data-type="characters" data-id="${char.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);
}
