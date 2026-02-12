// ========================================
// MegaBonk Recommendation Engine
// ========================================
// Analyzes current build and provides intelligent item/weapon/tome recommendations
// ========================================

import type { Item, Weapon, Tome, Character, Shrine, Tier } from '../types/index.ts';

/**
 * Current build state
 */
export interface BuildState {
    character: Character | null;
    weapon: Weapon | null;
    items: Item[];
    tomes: Tome[];
    stats?: {
        hp?: number;
        damage?: number;
        speed?: number;
        critChance?: number;
    };
}

/**
 * Item choice for recommendation
 */
export interface ChoiceOption {
    type: 'item' | 'weapon' | 'tome' | 'shrine';
    entity: Item | Weapon | Tome | Shrine;
}

/**
 * Recommendation result with scoring and reasoning
 */
export interface Recommendation {
    choice: ChoiceOption;
    score: number;
    confidence: number; // 0-1
    reasoning: string[];
    warnings: string[];
    synergies: string[];
    antiSynergies: string[];
}

/**
 * Tier score mapping
 */
const TIER_SCORES: Record<Tier, number> = {
    SS: 100,
    S: 80,
    A: 60,
    B: 40,
    C: 20,
};

/**
 * Build archetype detection based on items
 */
interface BuildArchetype {
    type: 'damage' | 'tank' | 'crit' | 'proc' | 'speed' | 'mixed';
    strength: number; // 0-1
}

/**
 * Detect build archetype based on current items and tomes
 */
interface ArchetypeCounts {
    damage: number;
    tank: number;
    crit: number;
    proc: number;
    speed: number;
}

function matchesAny(text: string, ...keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
}

function categorizeItem(item: { name?: string; base_effect?: string; description?: string }): ArchetypeCounts {
    const itemName = item.name?.toLowerCase() || '';
    const effect = item.base_effect?.toLowerCase() || '';
    const desc = item.description?.toLowerCase() || '';
    const all = `${itemName} ${effect} ${desc}`;

    return {
        damage: matchesAny(all, 'damage') ? 1 : 0,
        tank: matchesAny(itemName, 'hp', 'health', 'beefy') || matchesAny(effect, 'hp') ? 1 : 0,
        crit: matchesAny(itemName, 'crit', 'juice', 'fork') || matchesAny(effect, 'crit') ? 1 : 0,
        proc: matchesAny(itemName, 'proc', 'chance', 'bonk', 'meatball') ? 1 : 0,
        speed: matchesAny(all, 'attack speed') || matchesAny(itemName, 'speed') ? 1 : 0,
    };
}

function categorizeTome(tome: { stat_affected?: string }): ArchetypeCounts {
    const stat = tome.stat_affected?.toLowerCase() || '';
    return {
        damage: stat.includes('damage') ? 2 : 0,
        tank: matchesAny(stat, 'health', 'hp') ? 2 : 0,
        crit: stat.includes('crit') ? 2 : 0,
        proc: 0,
        speed: matchesAny(stat, 'attack speed', 'cooldown') ? 2 : 0,
    };
}

function detectBuildArchetype(build: BuildState): BuildArchetype {
    const counts: ArchetypeCounts = { damage: 0, tank: 0, crit: 0, proc: 0, speed: 0 };

    for (const item of build.items) {
        const c = categorizeItem(item);
        counts.damage += c.damage;
        counts.tank += c.tank;
        counts.crit += c.crit;
        counts.proc += c.proc;
        counts.speed += c.speed;
    }

    for (const tome of build.tomes) {
        const c = categorizeTome(tome);
        counts.damage += c.damage;
        counts.tank += c.tank;
        counts.crit += c.crit;
        counts.speed += c.speed;
    }

    const total = counts.damage + counts.tank + counts.crit + counts.proc + counts.speed;

    if (total === 0) return { type: 'mixed', strength: 0 };

    const scores = [
        { type: 'damage' as const, count: counts.damage },
        { type: 'tank' as const, count: counts.tank },
        { type: 'crit' as const, count: counts.crit },
        { type: 'proc' as const, count: counts.proc },
        { type: 'speed' as const, count: counts.speed },
    ];

    scores.sort((a, b) => b.count - a.count);

    const dominant = scores[0]!;
    const strength = dominant.count / total;

    if (strength < 0.3) return { type: 'mixed', strength: 0.5 };
    return { type: dominant.type, strength };
}

/**
 * Calculate synergy score between choice and current build
 */
function calculateSynergyScore(
    choice: ChoiceOption,
    build: BuildState
): { score: number; synergies: string[]; antiSynergies: string[] } {
    let score = 0;
    const synergies: string[] = [];
    const antiSynergies: string[] = [];

    const entity = choice.entity;
    const entityName = entity.name;

    // Check synergies with character (use optional chaining for defensive access)
    if (build.character) {
        const charSynergies = build.character?.synergies_items ?? [];
        const charWeaponSynergies = build.character?.synergies_weapons ?? [];

        // Bug fix: Require minimum 3-char match length to prevent false positives
        // (e.g., "or" matching "sword", "a" matching everything)
        // Also filter out empty strings which would match everything
        if (
            choice.type === 'item' &&
            charSynergies.some(
                s =>
                    s.length >= 3 &&
                    (s.toLowerCase().includes(entityName.toLowerCase()) ||
                        entityName.toLowerCase().includes(s.toLowerCase()))
            )
        ) {
            score += 20;
            synergies.push(`Synergizes with ${build.character.name}`);
        }

        if (
            choice.type === 'weapon' &&
            charWeaponSynergies.some(
                s =>
                    s.length >= 3 &&
                    (s.toLowerCase().includes(entityName.toLowerCase()) ||
                        entityName.toLowerCase().includes(s.toLowerCase()))
            )
        ) {
            score += 20;
            synergies.push(`Great synergy with ${build.character.name}`);
        }
    }

    // Check synergies with weapon
    // Note: Items may use 'synergies' or 'synergies_weapons' field
    if (build.weapon && choice.type === 'item') {
        const item = entity as Item;
        const itemSynergies = item?.synergies ?? [];
        const itemSynergiesWeapons = item?.synergies_weapons ?? [];
        const allWeaponSynergies = [...itemSynergies, ...itemSynergiesWeapons];
        const weapon = build.weapon;

        // Bug fix: Require minimum 3-char match length and filter empty strings
        // to prevent false positives from short/empty synergy entries
        if (
            allWeaponSynergies.some(
                s =>
                    s.length >= 3 &&
                    (s.toLowerCase() === weapon.name.toLowerCase() ||
                        s.toLowerCase().includes(weapon.name.toLowerCase()) ||
                        weapon.name.toLowerCase().includes(s.toLowerCase()))
            )
        ) {
            score += 15;
            synergies.push(`Synergizes with ${weapon.name}`);
        }
    }

    // Check synergies with existing items
    for (const buildItem of build.items) {
        const itemEntity = entity as Item;
        const itemSynergies = itemEntity?.synergies ?? [];

        // Bug fix: Require minimum 3-char match length and filter empty strings
        if (
            itemSynergies.some(
                s =>
                    s.length >= 3 &&
                    (s.toLowerCase().includes(buildItem.name.toLowerCase()) ||
                        buildItem.name.toLowerCase().includes(s.toLowerCase()))
            )
        ) {
            score += 10;
            synergies.push(`Synergizes with ${buildItem.name}`);
        }

        // Check for anti-synergies
        // Bug fix: Same minimum length check for anti-synergies
        const antiSyns = itemEntity?.anti_synergies ?? itemEntity?.antiSynergies ?? [];
        if (
            antiSyns.some(
                s =>
                    s.length >= 3 &&
                    (s.toLowerCase().includes(buildItem.name.toLowerCase()) ||
                        buildItem.name.toLowerCase().includes(s.toLowerCase()))
            )
        ) {
            score -= 30;
            antiSynergies.push(`Anti-synergy with ${buildItem.name}`);
        }
    }

    return { score, synergies, antiSynergies };
}

/**
 * Check for redundancy (already have similar items)
 */
const EFFECT_KEYWORDS = ['damage', 'crit', 'hp'];

function countSimilarEffects(itemEffect: string, buildItems: Array<{ base_effect?: string }>): number {
    let count = 0;
    for (const buildItem of buildItems) {
        const buildEffect = buildItem.base_effect?.toLowerCase() || '';
        for (const keyword of EFFECT_KEYWORDS) {
            if (itemEffect.includes(keyword) && buildEffect.includes(keyword)) {
                count++;
                break;
            }
        }
    }
    return count;
}

function calculateRedundancyPenalty(choice: ChoiceOption, build: BuildState): { penalty: number; reason?: string } {
    if (choice.type !== 'item') return { penalty: 0 };

    const item = choice.entity as Item;
    const hasAlready = build.items.some(i => i.id === item.id);

    if (item.one_and_done && hasAlready) {
        return { penalty: 100, reason: 'ONE-AND-DONE item already in build' };
    }

    if (item.stacks_well === false && hasAlready) {
        return { penalty: 50, reason: 'Item does not stack well' };
    }

    const itemEffect = item.base_effect?.toLowerCase() || '';
    const similarCount = countSimilarEffects(itemEffect, build.items);
    const penalty = Math.min(similarCount * 10, 40);

    if (penalty > 0) {
        return { penalty, reason: `Already have ${similarCount} similar items` };
    }

    return { penalty: 0 };
}

/**
 * Calculate archetype fit bonus
 */
function calculateArchetypeFit(choice: ChoiceOption, archetype: BuildArchetype): { bonus: number; reason?: string } {
    if (archetype.type === 'mixed' || archetype.strength < 0.3) {
        return { bonus: 0 };
    }

    const entity = choice.entity;
    const name = entity.name?.toLowerCase() || '';
    const effect = (entity as Item).base_effect?.toLowerCase() || '';

    let fits = false;
    let fitReason = '';

    switch (archetype.type) {
        case 'damage':
            if (name.includes('damage') || effect.includes('damage') || name.includes('gym')) {
                fits = true;
                fitReason = 'Fits damage build archetype';
            }
            break;
        case 'tank':
            if (name.includes('hp') || name.includes('health') || effect.includes('hp') || name.includes('beefy')) {
                fits = true;
                fitReason = 'Fits tank build archetype';
            }
            break;
        case 'crit':
            if (name.includes('crit') || effect.includes('crit') || name.includes('juice') || name.includes('fork')) {
                fits = true;
                fitReason = 'Fits crit build archetype';
            }
            break;
        case 'proc':
            if (
                name.includes('proc') ||
                name.includes('chance') ||
                effect.includes('chance') ||
                name.includes('bonk')
            ) {
                fits = true;
                fitReason = 'Fits proc-based build archetype';
            }
            break;
        case 'speed':
            if (name.includes('speed') || name.includes('attack speed') || effect.includes('attack speed')) {
                fits = true;
                fitReason = 'Fits speed build archetype';
            }
            break;
    }

    if (fits) {
        const bonus = 15 * archetype.strength;
        return { bonus, reason: fitReason };
    }

    return { bonus: 0 };
}

/**
 * Main recommendation engine
 */
export function recommendBestChoice(currentBuild: BuildState, choices: ChoiceOption[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Detect build archetype
    const archetype = detectBuildArchetype(currentBuild);

    for (const choice of choices) {
        const entity = choice.entity;
        let score = 0;
        const reasoning: string[] = [];
        const warnings: string[] = [];

        // 1. Base tier score (40% weight)
        const tierScore = TIER_SCORES[entity.tier];
        score += tierScore;
        reasoning.push(`${entity.tier}-tier item (${tierScore} base score)`);

        // 2. Synergy analysis (30% weight)
        const { score: synergyScore, synergies, antiSynergies } = calculateSynergyScore(choice, currentBuild);
        score += synergyScore;

        if (synergies.length > 0) {
            reasoning.push(`${synergies.length} synergies detected`);
        }
        if (antiSynergies.length > 0) {
            warnings.push(...antiSynergies);
        }

        // 3. Redundancy check (20% weight)
        const { penalty: redundancyPenalty, reason: redundancyReason } = calculateRedundancyPenalty(
            choice,
            currentBuild
        );
        score -= redundancyPenalty;
        if (redundancyReason) {
            warnings.push(redundancyReason);
        }

        // 4. Archetype fit (10% weight)
        const { bonus: archetypeBonus, reason: archetypeReason } = calculateArchetypeFit(choice, archetype);
        score += archetypeBonus;
        if (archetypeReason) {
            reasoning.push(archetypeReason);
        }

        // 5. Build phase considerations
        const itemCount = currentBuild.items.length;
        if (itemCount < 3 && entity.tier === 'SS') {
            score += 10;
            reasoning.push('Early game - prioritize strong items');
        }

        // Calculate confidence (0-1)
        const confidence = Math.min(synergies.length * 0.2 + (antiSynergies.length === 0 ? 0.3 : 0) + 0.5, 1.0);

        recommendations.push({
            choice,
            score: Math.max(0, score),
            confidence,
            reasoning,
            warnings,
            synergies,
            antiSynergies,
        });
    }

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
}

/**
 * Format recommendation as human-readable text
 */
export function formatRecommendation(rec: Recommendation, rank: number): string {
    const entity = rec.choice.entity;
    const emoji = rank === 1 ? '🎯' : rank === 2 ? '🥈' : '🥉';

    let text = `${emoji} ${rank === 1 ? 'RECOMMENDED: ' : `#${rank}: `}${entity.name} (${entity.tier}-tier)\n`;
    text += `Score: ${Math.round(rec.score)} | Confidence: ${Math.round(rec.confidence * 100)}%\n\n`;

    if (rec.reasoning.length > 0) {
        text += 'Why?\n';
        rec.reasoning.forEach(r => {
            text += `✓ ${r}\n`;
        });
        text += '\n';
    }

    if (rec.synergies.length > 0) {
        text += 'Synergies:\n';
        rec.synergies.forEach(s => {
            text += `  • ${s}\n`;
        });
        text += '\n';
    }

    if (rec.warnings.length > 0) {
        text += 'Warnings:\n';
        rec.warnings.forEach(w => {
            text += `  ⚠️ ${w}\n`;
        });
        text += '\n';
    }

    return text;
}
