// ========================================
// Character Renderer
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
} from '../utils.ts';
import { detectEmptyStateType, generateEmptyStateWithSuggestions } from '../empty-states.ts';
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
        const context = detectEmptyStateType('characters');
        container.innerHTML = generateEmptyStateWithSuggestions(context);
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'item-card character-card clickable-card';
        card.tabIndex = 0;
        card.dataset.entityType = 'character';
        card.dataset.entityId = char.id;

        const imageHtml = generateEntityImage(char, char.name);
        // DISABLED: Favorites feature UI hidden (module kept for data persistence)
        // const isFav = typeof isFavorite === 'function' ? isFavorite('characters', char.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(char.name)}</div>
                    ${generateTierLabel(char.tier)}
                </div>
                <!-- DISABLED: Favorite button hidden
                <button class="favorite-btn" data-tab="characters" data-id="${char.id}" title="Add to favorites" aria-label="Add to favorites">
                    ☆
                </button>
                -->
            </div>
            <div class="item-effect">${escapeHtml(char.passive_ability)}</div>
            <div class="item-description">${escapeHtml(char.passive_description)}</div>
            <div class="item-meta">
                <span class="meta-tag">${escapeHtml(char.starting_weapon)}</span>
                <span class="meta-tag">${escapeHtml(char.playstyle)}</span>
            </div>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);
}
