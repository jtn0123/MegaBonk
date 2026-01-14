// ========================================
// MegaBonk Constants Module
// ========================================

import type { Tier, Rarity } from '../types/index.ts';

/**
 * Item stat effect definition
 */
export interface ItemEffect {
    stat: string;
    value: number;
    type: 'add' | 'multiply' | 'hp_percent';
}

/**
 * Build stats definition
 */
export interface BuildStats {
    damage: number;
    hp: number;
    crit_chance: number;
    crit_damage: number;
    attack_speed: number;
    movement_speed: number;
    armor: number;
    evasion_internal: number;
    projectiles: number;
}

// Tier ordering for sorting (lower = better)
export const TIER_ORDER: Readonly<Record<Tier, number>> = Object.freeze({
    SS: 0,
    S: 1,
    A: 2,
    B: 3,
    C: 4,
});

// Rarity ordering for sorting (lower = rarer)
export const RARITY_ORDER: Readonly<Record<Rarity, number>> = Object.freeze({
    legendary: 0,
    epic: 1,
    rare: 2,
    uncommon: 3,
    common: 4,
});

// Item IDs used in build calculations
export const ITEM_IDS = Object.freeze({
    GYM_SAUCE: 'gym_sauce',
    FORBIDDEN_JUICE: 'forbidden_juice',
    OATS: 'oats',
    BATTERY: 'battery',
    TURBO_SOCKS: 'turbo_socks',
    BEER: 'beer',
    BACKPACK: 'backpack',
    SLIPPERY_RING: 'slippery_ring',
    PHANTOM_SHROUD: 'phantom_shroud',
    BEEFY_RING: 'beefy_ring',
    LEECHING_CRYSTAL: 'leeching_crystal',
    BRASS_KNUCKLES: 'brass_knuckles',
    BOSS_BUSTER: 'boss_buster',
} as const);

// Item stat effects for build calculator
// Maps item ID to stat modifications
export const ITEM_EFFECTS: Readonly<Record<string, ItemEffect>> = Object.freeze({
    [ITEM_IDS.GYM_SAUCE]: { stat: 'damage', value: 10, type: 'add' },
    [ITEM_IDS.FORBIDDEN_JUICE]: { stat: 'crit_chance', value: 10, type: 'add' },
    [ITEM_IDS.OATS]: { stat: 'hp', value: 25, type: 'add' },
    [ITEM_IDS.BATTERY]: { stat: 'attack_speed', value: 8, type: 'add' },
    [ITEM_IDS.TURBO_SOCKS]: { stat: 'movement_speed', value: 15, type: 'add' },
    [ITEM_IDS.BEER]: { stat: 'damage', value: 20, type: 'add' },
    [ITEM_IDS.BACKPACK]: { stat: 'projectiles', value: 1, type: 'add' },
    [ITEM_IDS.SLIPPERY_RING]: { stat: 'evasion_internal', value: 15, type: 'add' },
    [ITEM_IDS.PHANTOM_SHROUD]: { stat: 'evasion_internal', value: 15, type: 'add' },
    [ITEM_IDS.BEEFY_RING]: { stat: 'damage', value: 20, type: 'hp_percent' },
    [ITEM_IDS.LEECHING_CRYSTAL]: { stat: 'hp', value: 1.5, type: 'multiply' },
    [ITEM_IDS.BRASS_KNUCKLES]: { stat: 'damage', value: 20, type: 'add' },
    [ITEM_IDS.BOSS_BUSTER]: { stat: 'damage', value: 15, type: 'add' },
});

// Default stat values for build calculator
export const DEFAULT_BUILD_STATS: Readonly<BuildStats> = Object.freeze({
    damage: 100,
    hp: 100,
    crit_chance: 5,
    crit_damage: 150,
    attack_speed: 100,
    movement_speed: 100,
    armor: 0,
    evasion_internal: 0,
    projectiles: 1,
});

// Bug fix #14: Define magic numbers as constants
export const MAX_COMPARE_ITEMS = 3;
export const BUILD_ITEMS_LIMIT = 40;
export const VALID_TIERS: readonly Tier[] = Object.freeze(['SS', 'S', 'A', 'B', 'C']);
export const VALID_RARITIES: readonly Rarity[] = Object.freeze([
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
]);
