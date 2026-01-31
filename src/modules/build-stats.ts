// ========================================
// MegaBonk Build Stats Module
// Stat calculations, damage formulas, build scoring
// ========================================

import type { Tome, Item } from '../types/index.ts';
import {
    DEFAULT_BUILD_STATS,
    ITEM_EFFECTS,
    type BuildStats,
    type ItemEffect,
} from './constants.ts';
import type { Build } from './store.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Extended build stats with calculated properties
 */
export interface CalculatedBuildStats extends BuildStats {
    evasion: number;
    overcrit: boolean;
}

// ========================================
// Build Stats Memoization Cache
// ========================================
let lastBuildCacheKey = '';
let cachedBuildStats: CalculatedBuildStats | null = null;

/**
 * Invalidate the memoization cache
 * Should be called when underlying data changes (e.g., allData reload)
 */
export function invalidateBuildStatsCache(): void {
    lastBuildCacheKey = '';
    cachedBuildStats = null;
}

/**
 * Generate a cache key from build state
 * @param build - Build to generate key for
 * @returns Cache key string
 */
export function getBuildCacheKey(build: Build): string {
    return [
        build.character?.id || '',
        build.weapon?.id || '',
        build.tomes
            .map((t: Tome) => t.id)
            .sort()
            .join(','),
        build.items
            .map((i: Item) => i.id)
            .sort()
            .join(','),
    ].join('|');
}

/**
 * Apply character passive bonuses based on passive_ability text
 * Pattern matching is data-driven - no hardcoded character IDs
 * @param stats - Stats object to modify
 * @param passive - Character passive ability text
 */
function applyCharacterPassives(stats: CalculatedBuildStats, passive: string): void {
    const passiveLower = passive.toLowerCase();

    // Crit Chance passive (e.g., "Gain 1% Crit Chance per level")
    if (/crit(ical)?\s*chance/i.test(passiveLower)) {
        stats.crit_chance += 50;
    }
    // HP passive (e.g., "+2 Max HP per level", "Gain X HP per level")
    if (/max\s*hp|hp\s*per\s*level/i.test(passiveLower)) {
        stats.hp += 50;
    }
    // Armor passive (e.g., "Gain 1% Armor per level")
    if (/armor/i.test(passiveLower)) {
        stats.armor += 50;
    }
    // Damage passive (e.g., "Gain 1.5% Damage per level")
    // Match "gain X% damage" but not "critical damage"
    if (/gain.*\d+(\.\d+)?%?\s*damage/i.test(passiveLower) && !/crit(ical)?\s*damage/i.test(passiveLower)) {
        stats.damage += 20;
    }
    // Attack Speed passive (e.g., "Gain 1% Attack Speed per level")
    if (/attack\s*speed/i.test(passiveLower)) {
        stats.attack_speed += 50;
    }
    // Movement Speed passive
    if (/move(ment)?\s*speed/i.test(passiveLower)) {
        stats.movement_speed += 20;
    }
    // Crit Damage passive
    if (/crit(ical)?\s*damage/i.test(passiveLower)) {
        stats.crit_damage += 25;
    }
}

/**
 * Apply tome bonuses to stats
 * @param stats - Stats object to modify
 * @param tome - Tome to apply
 */
function applyTomeBonus(stats: CalculatedBuildStats, tome: Tome): void {
    const tomeLevel = 5;
    // Safely extract numeric value from value_per_level
    // Handles formats like:
    // - "+0.08x (8% damage)" - decimal multiplier, needs *100 to get percentage
    // - "+7% crit chance" - integer percentage, use as-is
    // - "+25 Max HP" - absolute value, use as-is
    const valueStr = tome.value_per_level || '';
    const match = String(valueStr).match(/[+-]?\d+(?:\.\d+)?/);
    const rawValue = match ? parseFloat(match[0]) : 0;
    // Bug fix: Use Number.isFinite to catch both NaN and Infinity values
    // Clamp to reasonable bounds to prevent overflow from malformed data
    const safeRawValue = Number.isFinite(rawValue) ? Math.max(-1000, Math.min(1000, rawValue)) : 0;

    // Bug fix: Handle different value formats correctly
    // Decimal values < 1 (like 0.08) represent percentages that need *100
    // Integer values >= 1 (like 7, 25) are already the correct value
    const value = safeRawValue < 1 && safeRawValue > 0 ? safeRawValue * 100 : safeRawValue;

    // Apply tome bonus: value per level * tome level
    if (tome.stat_affected === 'Damage') stats.damage += value * tomeLevel;
    else if (tome.stat_affected === 'Critical Chance' || tome.id === 'precision')
        stats.crit_chance += value * tomeLevel;
    else if (tome.stat_affected === 'Crit Damage') stats.crit_damage += value * tomeLevel;
    else if (tome.stat_affected === 'Max HP' || tome.id === 'vitality' || tome.id === 'hp')
        stats.hp += value * tomeLevel;
    else if (tome.stat_affected === 'Attack Speed' || tome.id === 'cooldown')
        stats.attack_speed += value * tomeLevel;
    else if (tome.stat_affected === 'Movement Speed' || tome.id === 'agility')
        stats.movement_speed += value * tomeLevel;
    else if (tome.stat_affected === 'Armor' || tome.id === 'armor') stats.armor += value * tomeLevel;
}

/**
 * Apply item effects to stats using ITEM_EFFECTS constant
 * @param stats - Stats object to modify
 * @param item - Item to apply
 */
function applyItemEffect(stats: CalculatedBuildStats, item: Item): void {
    const effect: ItemEffect | undefined = ITEM_EFFECTS[item.id];
    if (effect) {
        const statKey = effect.stat;
        if (effect.type === 'add') {
            stats[statKey] += effect.value;
        } else if (effect.type === 'multiply') {
            stats[statKey] *= effect.value;
        } else if (effect.type === 'hp_percent') {
            // Special: damage based on HP percentage
            stats[statKey] += (stats.hp / 100) * effect.value;
        }
    }
}

/**
 * Calculate build statistics with memoization
 * Results are cached until the build changes to avoid recalculation
 * @param build - Build to calculate stats for
 * @param useCache - Whether to use memoization cache (default true)
 * @returns Calculated stats
 */
export function calculateBuildStats(build: Build, useCache: boolean = true): CalculatedBuildStats {
    // Check memoization cache
    if (useCache) {
        const cacheKey = getBuildCacheKey(build);
        if (cacheKey === lastBuildCacheKey && cachedBuildStats) {
            return cachedBuildStats;
        }
        lastBuildCacheKey = cacheKey;
    }

    const stats: CalculatedBuildStats = { ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false };

    // Apply character passive bonuses
    if (build.character) {
        const passive = build.character.passive_ability || '';
        applyCharacterPassives(stats, passive);
    }

    // Use parseFloat instead of parseInt for decimal damage values
    if (build.weapon) {
        const baseDamage = build.weapon.base_damage ?? build.weapon.baseDamage;
        // Handle undefined/null: parseFloat(String(undefined)) returns NaN, and NaN || 0 still gives NaN
        // Bug fix: Use Number.isFinite instead of Number.isNaN to also catch Infinity values
        const parsedDamage = baseDamage != null ? parseFloat(String(baseDamage)) : 0;
        stats.damage += Number.isFinite(parsedDamage) ? parsedDamage : 0;
    }

    // Apply tome bonuses
    build.tomes.forEach((tome: Tome) => applyTomeBonus(stats, tome));

    // Apply item effects
    build.items.forEach((item: Item) => applyItemEffect(stats, item));

    // Calculate evasion
    // Prevent division by zero in evasion formula if evasion_internal is <= -100
    // Formula: evasion = internal / (1 + internal/100)
    // Clamp evasion_internal to prevent negative or zero denominator
    const clampedEvasionInternal = Math.max(stats.evasion_internal, -99);
    stats.evasion = Math.round((clampedEvasionInternal / (1 + clampedEvasionInternal / 100)) * 100) / 100;
    stats.overcrit = stats.crit_chance > 100;

    // Cache the result for memoization
    if (useCache) {
        cachedBuildStats = stats;
    }

    return stats;
}

/**
 * Calculate DPS (damage per second) for a build
 * @param stats - Calculated build stats
 * @returns Estimated DPS value
 */
export function calculateDPS(stats: CalculatedBuildStats): number {
    const baseDamage = stats.damage;
    const critMultiplier = 1 + (stats.crit_chance / 100) * (stats.crit_damage / 100 - 1);
    const attackSpeedMultiplier = 1 + stats.attack_speed / 100;
    
    return baseDamage * critMultiplier * attackSpeedMultiplier * stats.projectiles;
}

/**
 * Calculate effective HP considering armor and evasion
 * @param stats - Calculated build stats
 * @returns Effective HP value
 */
export function calculateEffectiveHP(stats: CalculatedBuildStats): number {
    const armorReduction = stats.armor / (stats.armor + 100); // Diminishing returns formula
    const evasionMultiplier = 1 / (1 - stats.evasion / 100);
    
    return stats.hp * (1 / (1 - armorReduction)) * evasionMultiplier;
}

/**
 * Score a build for comparison (higher is better)
 * @param stats - Calculated build stats
 * @returns Numeric score for the build
 */
export function scoreBuild(stats: CalculatedBuildStats): number {
    const dps = calculateDPS(stats);
    const ehp = calculateEffectiveHP(stats);
    const mobilityBonus = stats.movement_speed * 2;
    
    // Weighted score combining offense and defense
    return dps * 0.6 + ehp * 0.3 + mobilityBonus * 0.1;
}
