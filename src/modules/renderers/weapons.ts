// ========================================
// Weapon Renderer
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
    generateMetaTags,
} from '../utils.ts';
import { detectEmptyStateType, generateEmptyStateWithSuggestions } from '../empty-states.ts';
import type { Weapon } from './types.ts';

/**
 * Render weapons grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} weapons - Weapons to render
 */
export function renderWeapons(weapons: Weapon[]): void {
    const container = safeGetElementById('weaponsContainer');
    if (!container) return;

    if (weapons.length === 0) {
        const context = detectEmptyStateType('weapons');
        container.innerHTML = generateEmptyStateWithSuggestions(context);
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    weapons.forEach(weapon => {
        const card = document.createElement('div');
        card.className = 'item-card weapon-card clickable-card';
        card.tabIndex = 0;
        card.dataset.entityType = 'weapon';
        card.dataset.entityId = weapon.id;

        const imageHtml = generateEntityImage(weapon, weapon.name);
        // DISABLED: Favorites feature UI hidden (module kept for data persistence)
        // const isFav = typeof isFavorite === 'function' ? isFavorite('weapons', weapon.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(weapon.name)}</div>
                    ${generateTierLabel(weapon.tier)}
                </div>
                <!-- DISABLED: Favorite button hidden
                <button class="favorite-btn" data-tab="weapons" data-id="${weapon.id}" title="Add to favorites" aria-label="Add to favorites">
                    ☆
                </button>
                -->
            </div>
            <div class="item-effect">${escapeHtml(weapon.attack_pattern)}</div>
            <div class="item-description">${escapeHtml(weapon.description)}</div>
            <div class="item-meta">
                ${generateMetaTags(Array.isArray(weapon.upgradeable_stats) ? weapon.upgradeable_stats : weapon.upgradeable_stats ? [weapon.upgradeable_stats] : null, 4)}
            </div>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);
}
