// ========================================
// Weapon Renderer
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
    generateMetaTags,
    generateEmptyState,
} from '../utils.ts';
import { isFavorite } from '../favorites.ts';
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
        container.innerHTML = generateEmptyState('⚔️', 'Weapons');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    weapons.forEach(weapon => {
        const card = document.createElement('div');
        card.className = 'item-card weapon-card';
        card.dataset.entityType = 'weapon';
        card.dataset.entityId = weapon.id;

        const imageHtml = generateEntityImage(weapon, weapon.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('weapons', weapon.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(weapon.name)}</div>
                    ${generateTierLabel(weapon.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="weapons" data-id="${weapon.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(weapon.attack_pattern)}</div>
            <div class="item-description">${escapeHtml(weapon.description)}</div>
            <div class="item-meta">
                ${generateMetaTags(Array.isArray(weapon.upgradeable_stats) ? weapon.upgradeable_stats : weapon.upgradeable_stats ? [weapon.upgradeable_stats] : null, 4)}
            </div>
            <button class="view-details-btn" data-type="weapons" data-id="${weapon.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);
}
