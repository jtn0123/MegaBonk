// ========================================
// MegaBonk Modal Characters Module
// Character modal rendering
// ========================================

import { generateModalImage, escapeHtml } from './utils.ts';
import type { Character } from '../types/index.ts';

/**
 * Render character modal content
 * Bug fix: Escape all user-controlled values to prevent XSS
 * @param data - Character data
 * @returns HTML content
 */
export function renderCharacterModal(data: Character): string {
    const imageHtml = generateModalImage(data, data.name, 'character');

    return `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge tier-${escapeHtml(data.tier || '')}">${escapeHtml(data.tier || '')} Tier</span>
            <span class="badge">${escapeHtml(data.playstyle || '')}</span>
        </div>
        <div class="character-passive">
            <strong>${escapeHtml(data.passive_ability || '')}</strong>
            <p>${escapeHtml(data.passive_description || '')}</p>
        </div>
        <div class="character-meta">
            <div><strong>Starting Weapon:</strong> ${escapeHtml(data.starting_weapon || '')}</div>
            <div><strong>Base HP:</strong> ${escapeHtml(String(data.base_hp || ''))} | <strong>Base Damage:</strong> ${escapeHtml(String(data.base_damage || ''))}</div>
            ${data.unlock_requirement ? `<div><strong>Unlock:</strong> ${escapeHtml(data.unlock_requirement)}</div>` : ''}
        </div>
        ${
            data.best_for?.length
                ? `
            <div class="character-section">
                <h3>Best For</h3>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${escapeHtml(b)}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        <div class="strengths-weaknesses">
            <div class="strengths">
                <h4>Strengths</h4>
                <ul>${data.strengths?.map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
            <div class="weaknesses">
                <h4>Weaknesses</h4>
                <ul>${data.weaknesses?.map(w => `<li>${escapeHtml(w)}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
        </div>
        <div class="synergies-section">
            <h3>Synergies</h3>
            ${
                data.synergies_weapons?.length
                    ? `
                <div class="synergy-group">
                    <h4>Weapons</h4>
                    <div class="synergy-list">${data.synergies_weapons.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
            ${
                data.synergies_items?.length
                    ? `
                <div class="synergy-group">
                    <h4>Items</h4>
                    <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
            ${
                data.synergies_tomes?.length
                    ? `
                <div class="synergy-group">
                    <h4>Tomes</h4>
                    <div class="synergy-list">${data.synergies_tomes.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
        </div>
        ${
            data.build_tips
                ? `
            <div class="build-tips">
                <h3>Build Tips</h3>
                <p>${escapeHtml(data.build_tips)}</p>
            </div>
        `
                : ''
        }
    `;
}
