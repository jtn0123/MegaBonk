// ========================================
// Similar Items Module
// ========================================
// Provides "Items Like This" recommendations based on item properties
// ========================================

import { allData } from './data-service.ts';
import { escapeHtml, generateEntityImage } from './utils.ts';
import { logger } from './logger.ts';
import type { Item, Weapon, Tome, Character, Entity, EntityType } from '../types/index.ts';

// ========================================
// Types
// ========================================

interface SimilarItem {
    entity: Entity;
    type: EntityType;
    score: number;
    reasons: string[];
}

interface SimilarityConfig {
    maxResults: number;
    minScore: number;
}

// ========================================
// Constants
// ========================================

const DEFAULT_CONFIG: SimilarityConfig = {
    maxResults: 5,
    minScore: 0.2
};

// Stat keywords for matching
const STAT_KEYWORDS = [
    'damage', 'crit', 'attack speed', 'hp', 'health', 'armor', 'defence',
    'dodge', 'knockback', 'pierce', 'burn', 'freeze', 'poison', 'lifesteal',
    'area', 'range', 'projectile', 'explosion', 'chain', 'bounce'
];

// ========================================
// Similarity Calculation
// ========================================

/**
 * Calculate similarity score between two items
 */
function calculateItemSimilarity(item1: Item, item2: Item): { score: number; reasons: string[] } {
    if (item1.id === item2.id) return { score: 0, reasons: [] };

    let score = 0;
    const reasons: string[] = [];

    // Same tier - high relevance
    if (item1.tier === item2.tier) {
        score += 0.25;
        reasons.push(`Same tier (${item1.tier})`);
    }

    // Same rarity
    if (item1.rarity === item2.rarity) {
        score += 0.15;
        reasons.push(`Same rarity`);
    }

    // Similar stacking behavior
    if (item1.one_and_done === item2.one_and_done) {
        score += 0.1;
        if (item1.one_and_done) {
            reasons.push('Both one-and-done');
        }
    }

    if (item1.stacks_well === item2.stacks_well && item1.stacks_well) {
        score += 0.1;
        reasons.push('Both stack well');
    }

    // Shared synergies
    if (item1.synergies && item2.synergies) {
        const shared = item1.synergies.filter(s => item2.synergies?.includes(s));
        if (shared.length > 0) {
            score += Math.min(shared.length * 0.15, 0.3);
            reasons.push(`Shared synergies`);
        }
    }

    // Similar effect keywords
    const effect1 = (item1.base_effect || '').toLowerCase();
    const effect2 = (item2.base_effect || '').toLowerCase();

    const sharedKeywords = STAT_KEYWORDS.filter(
        keyword => effect1.includes(keyword) && effect2.includes(keyword)
    );

    if (sharedKeywords.length > 0) {
        score += Math.min(sharedKeywords.length * 0.1, 0.3);
        reasons.push(`Similar effects (${sharedKeywords[0]})`);
    }

    // Same scaling type
    if (item1.scaling_formula_type && item1.scaling_formula_type === item2.scaling_formula_type) {
        score += 0.1;
    }

    return { score, reasons };
}

/**
 * Calculate similarity score between two weapons
 */
function calculateWeaponSimilarity(weapon1: Weapon, weapon2: Weapon): { score: number; reasons: string[] } {
    if (weapon1.id === weapon2.id) return { score: 0, reasons: [] };

    let score = 0;
    const reasons: string[] = [];

    // Same tier
    if (weapon1.tier === weapon2.tier) {
        score += 0.3;
        reasons.push(`Same tier (${weapon1.tier})`);
    }

    // Similar playstyle
    if (weapon1.playstyle === weapon2.playstyle) {
        score += 0.25;
        reasons.push(`Same playstyle`);
    }

    // Similar attack pattern keywords
    const pattern1 = (weapon1.attack_pattern || '').toLowerCase();
    const pattern2 = (weapon2.attack_pattern || '').toLowerCase();

    const patternKeywords = ['melee', 'ranged', 'projectile', 'aoe', 'single target', 'multi-hit'];
    const sharedPatterns = patternKeywords.filter(
        k => pattern1.includes(k) && pattern2.includes(k)
    );

    if (sharedPatterns.length > 0) {
        score += 0.2;
        reasons.push(`Similar attack style`);
    }

    // Shared best_for tags
    if (weapon1.best_for && weapon2.best_for) {
        const shared = weapon1.best_for.filter(b => weapon2.best_for?.includes(b));
        if (shared.length > 0) {
            score += Math.min(shared.length * 0.15, 0.25);
            reasons.push(`Similar use cases`);
        }
    }

    return { score, reasons };
}

/**
 * Calculate similarity score between two tomes
 */
function calculateTomeSimilarity(tome1: Tome, tome2: Tome): { score: number; reasons: string[] } {
    if (tome1.id === tome2.id) return { score: 0, reasons: [] };

    let score = 0;
    const reasons: string[] = [];

    // Same tier
    if (tome1.tier === tome2.tier) {
        score += 0.25;
        reasons.push(`Same tier (${tome1.tier})`);
    }

    // Similar priority
    const priorityDiff = Math.abs((tome1.priority || 0) - (tome2.priority || 0));
    if (priorityDiff <= 1) {
        score += 0.2;
        reasons.push(`Similar priority`);
    }

    // Same stat affected
    if (tome1.stat_affected && tome1.stat_affected === tome2.stat_affected) {
        score += 0.35;
        reasons.push(`Same stat (${tome1.stat_affected})`);
    }

    // Similar stat category
    const statCategories: Record<string, string[]> = {
        'offensive': ['damage', 'crit', 'attack speed'],
        'defensive': ['hp', 'armor', 'dodge'],
        'utility': ['movement', 'cooldown', 'experience']
    };

    for (const [category, stats] of Object.entries(statCategories)) {
        const stat1Lower = (tome1.stat_affected || '').toLowerCase();
        const stat2Lower = (tome2.stat_affected || '').toLowerCase();
        const inCategory1 = stats.some(s => stat1Lower.includes(s));
        const inCategory2 = stats.some(s => stat2Lower.includes(s));
        if (inCategory1 && inCategory2 && tome1.stat_affected !== tome2.stat_affected) {
            score += 0.15;
            reasons.push(`Both ${category}`);
            break;
        }
    }

    return { score, reasons };
}

/**
 * Calculate similarity score between two characters
 */
function calculateCharacterSimilarity(char1: Character, char2: Character): { score: number; reasons: string[] } {
    if (char1.id === char2.id) return { score: 0, reasons: [] };

    let score = 0;
    const reasons: string[] = [];

    // Same tier
    if (char1.tier === char2.tier) {
        score += 0.25;
        reasons.push(`Same tier (${char1.tier})`);
    }

    // Same playstyle
    if (char1.playstyle === char2.playstyle) {
        score += 0.35;
        reasons.push(`Same playstyle`);
    }

    // Shared synergy items
    if (char1.synergies_items && char2.synergies_items) {
        const shared = char1.synergies_items.filter(s => char2.synergies_items?.includes(s));
        if (shared.length > 0) {
            score += Math.min(shared.length * 0.1, 0.2);
            reasons.push(`Similar item synergies`);
        }
    }

    // Similar passive keywords
    const passive1 = (char1.passive_description || '').toLowerCase();
    const passive2 = (char2.passive_description || '').toLowerCase();

    const passiveKeywords = ['damage', 'crit', 'hp', 'speed', 'armor', 'lifesteal'];
    const sharedPassive = passiveKeywords.filter(
        k => passive1.includes(k) && passive2.includes(k)
    );

    if (sharedPassive.length > 0) {
        score += 0.15;
        reasons.push(`Similar passive`);
    }

    return { score, reasons };
}

// ========================================
// Main API
// ========================================

/**
 * Find similar items for a given item
 */
export function findSimilarItems(
    type: EntityType,
    id: string,
    config: Partial<SimilarityConfig> = {}
): SimilarItem[] {
    const { maxResults, minScore } = { ...DEFAULT_CONFIG, ...config };

    let sourceEntity: Entity | undefined;
    let candidates: { entity: Entity; type: EntityType }[] = [];

    switch (type) {
        case 'items': {
            sourceEntity = allData.items?.items.find(i => i.id === id);
            candidates = (allData.items?.items || []).map(i => ({ entity: i as Entity, type: 'items' as EntityType }));
            break;
        }
        case 'weapons': {
            sourceEntity = allData.weapons?.weapons.find(w => w.id === id);
            candidates = (allData.weapons?.weapons || []).map(w => ({ entity: w as Entity, type: 'weapons' as EntityType }));
            break;
        }
        case 'tomes': {
            sourceEntity = allData.tomes?.tomes.find(t => t.id === id);
            candidates = (allData.tomes?.tomes || []).map(t => ({ entity: t as Entity, type: 'tomes' as EntityType }));
            break;
        }
        case 'characters': {
            sourceEntity = allData.characters?.characters.find(c => c.id === id);
            candidates = (allData.characters?.characters || []).map(c => ({ entity: c as Entity, type: 'characters' as EntityType }));
            break;
        }
        default:
            return [];
    }

    if (!sourceEntity) {
        logger.warn({
            operation: 'similar-items.find',
            data: { type, id, reason: 'source_not_found' }
        });
        return [];
    }

    // Calculate similarity for all candidates
    const results: SimilarItem[] = [];

    for (const candidate of candidates) {
        let similarity: { score: number; reasons: string[] };

        switch (type) {
            case 'items':
                similarity = calculateItemSimilarity(sourceEntity as Item, candidate.entity as Item);
                break;
            case 'weapons':
                similarity = calculateWeaponSimilarity(sourceEntity as Weapon, candidate.entity as Weapon);
                break;
            case 'tomes':
                similarity = calculateTomeSimilarity(sourceEntity as Tome, candidate.entity as Tome);
                break;
            case 'characters':
                similarity = calculateCharacterSimilarity(sourceEntity as Character, candidate.entity as Character);
                break;
            default:
                continue;
        }

        if (similarity.score >= minScore) {
            results.push({
                entity: candidate.entity,
                type: candidate.type,
                score: similarity.score,
                reasons: similarity.reasons
            });
        }
    }

    // Sort by score descending and limit results
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
}

/**
 * Render similar items section HTML
 */
export function renderSimilarItemsSection(type: EntityType, id: string): string {
    const similarItems = findSimilarItems(type, id);

    if (similarItems.length === 0) {
        return '';
    }

    const itemsHtml = similarItems.map(item => {
        const imageHtml = generateEntityImage(item.entity, item.entity.name || 'Unknown', 'similar-item-image');
        const reason = item.reasons[0] || 'Similar';

        return `
            <div class="similar-item-card" data-type="${item.type}" data-id="${item.entity.id}">
                ${imageHtml || '<span class="similar-item-icon">📦</span>'}
                <div class="similar-item-name">${escapeHtml(item.entity.name || 'Unknown')}</div>
                <div class="similar-item-reason">${escapeHtml(reason)}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="similar-items-section">
            <h3>💡 Items Like This</h3>
            <div class="similar-items-grid">
                ${itemsHtml}
            </div>
        </div>
    `;
}

/**
 * Setup click handlers for similar items
 * Call this after inserting the similar items HTML
 */
export function setupSimilarItemsHandlers(container: HTMLElement): void {
    const cards = container.querySelectorAll('.similar-item-card');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const type = (card as HTMLElement).dataset.type as EntityType;
            const id = (card as HTMLElement).dataset.id;

            if (type && id) {
                // Open modal for this item
                import('./modal.ts').then(({ openDetailModal }) => {
                    openDetailModal(type, id);
                });
            }
        });
    });
}
