// ========================================
// MegaBonk Modal Weapons Module
// Weapon modal rendering
// ========================================

import { generateModalImage, escapeHtml } from './utils.ts';
import type { Weapon } from '../types/index.ts';

/**
 * Render weapon modal content
 * Bug fix: Escape all user-controlled values to prevent XSS
 * @param data - Weapon data
 * @returns HTML content
 */
export function renderWeaponModal(data: Weapon): string {
    const imageHtml = generateModalImage(data, data.name, 'weapon');

    // Build upgradeable stats as tags (escaped)
    const upgradeableStatsHtml =
        Array.isArray(data.upgradeable_stats) && data.upgradeable_stats.length
            ? `<div class="tag-list">${data.upgradeable_stats.map(s => `<span class="meta-tag">${escapeHtml(s)}</span>`).join('')}</div>`
            : '<span class="text-muted">None</span>';

    // Build synergies section if any exist (all values escaped)
    const hasSynergies =
        data.synergies_items?.length || data.synergies_tomes?.length || data.synergies_characters?.length;
    const synergiesHtml = hasSynergies
        ? `
        <div class="synergies-section">
            <h3>Synergies</h3>
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
            ${
                data.synergies_characters?.length
                    ? `
                <div class="synergy-group">
                    <h4>Characters</h4>
                    <div class="synergy-list">${data.synergies_characters.map(s => `<span class="synergy-tag">${escapeHtml(s)}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
        </div>
    `
        : '';

    // Build pros/cons section if any exist (all values escaped)
    const hasProsOrCons = data.pros?.length || data.cons?.length;
    const prosConsHtml = hasProsOrCons
        ? `
        <div class="strengths-weaknesses">
            <div class="strengths">
                <h4>Pros</h4>
                <ul>${data.pros?.map(p => `<li>${escapeHtml(p)}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
            <div class="weaknesses">
                <h4>Cons</h4>
                <ul>${data.cons?.map(c => `<li>${escapeHtml(c)}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
        </div>
    `
        : '';

    return `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge tier-${escapeHtml(data.tier || '')}">${escapeHtml(data.tier || '')} Tier</span>
            ${data.playstyle ? `<span class="badge">${escapeHtml(data.playstyle)}</span>` : ''}
        </div>
        <div class="weapon-stats-section">
            <div><strong>Base Damage:</strong> ${escapeHtml(String(data.base_damage || ''))}${data.base_projectile_count ? ` × ${escapeHtml(String(data.base_projectile_count))} projectiles` : ''}</div>
            <div><strong>Attack Pattern:</strong> ${escapeHtml(data.attack_pattern || '')}</div>
        </div>
        <p class="weapon-description">${escapeHtml(data.description || '')}</p>
        ${
            data.best_for?.length
                ? `
            <div class="weapon-section">
                <h3>Best For</h3>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${escapeHtml(b)}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        <div class="weapon-section">
            <h3>Upgradeable Stats</h3>
            ${upgradeableStatsHtml}
        </div>
        ${prosConsHtml}
        ${synergiesHtml}
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
        ${
            data.unlock_requirement
                ? `
            <div class="unlock-requirement">
                <strong>Unlock:</strong> ${escapeHtml(data.unlock_requirement)}
            </div>
        `
                : ''
        }
    `;
}
