// ========================================
// MegaBonk Constants Module
// ========================================

// Tier ordering for sorting (lower = better)
const TIER_ORDER = {
    'SS': 0,
    'S': 1,
    'A': 2,
    'B': 3,
    'C': 4
};

// Rarity ordering for sorting (lower = rarer)
const RARITY_ORDER = {
    'legendary': 0,
    'epic': 1,
    'rare': 2,
    'uncommon': 3,
    'common': 4
};

// Item IDs used in build calculations
const ITEM_IDS = {
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
    BOSS_BUSTER: 'boss_buster'
};

// Item stat effects for build calculator
// Maps item ID to stat modifications
const ITEM_EFFECTS = {
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
    [ITEM_IDS.BOSS_BUSTER]: { stat: 'damage', value: 15, type: 'add' }
};

// Default stat values for build calculator
const DEFAULT_BUILD_STATS = {
    damage: 100,
    hp: 100,
    crit_chance: 5,
    crit_damage: 150,
    attack_speed: 100,
    movement_speed: 100,
    armor: 0,
    evasion_internal: 0,
    projectiles: 1
};

// Bug fix #14: Define magic numbers as constants
const MAX_COMPARE_ITEMS = 3;
const BUILD_ITEMS_LIMIT = 40;
const VALID_TIERS = ['SS', 'S', 'A', 'B', 'C'];
const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Expose to global scope for use in other scripts
// Bug fix #15: Freeze objects to prevent external mutation
window.TIER_ORDER = Object.freeze(TIER_ORDER);
window.RARITY_ORDER = Object.freeze(RARITY_ORDER);
window.ITEM_IDS = Object.freeze(ITEM_IDS);
window.ITEM_EFFECTS = Object.freeze(ITEM_EFFECTS);
window.DEFAULT_BUILD_STATS = Object.freeze(DEFAULT_BUILD_STATS);
window.MAX_COMPARE_ITEMS = MAX_COMPARE_ITEMS;
window.BUILD_ITEMS_LIMIT = BUILD_ITEMS_LIMIT;
window.VALID_TIERS = Object.freeze(VALID_TIERS);
window.VALID_RARITIES = Object.freeze(VALID_RARITIES);
