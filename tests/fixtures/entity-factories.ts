// ========================================
// Type-Safe Test Fixture Factories
// ========================================
// Factory functions for creating test entities with proper typing
// ========================================

import type { Item, Tome, Character, Weapon, Shrine, Rarity, Tier } from '../../src/types/index.ts';

// ========================================
// Type Definitions
// ========================================

/** Deep partial type for nested objects */
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ========================================
// Default Values
// ========================================

const DEFAULT_ITEM: Item = {
    id: 'test_item',
    name: 'Test Item',
    rarity: 'common',
    tier: 'B',
    unlocked_by_default: true,
    base_effect: '+10% test effect',
    scaling_type: 'additive_damage',
    stacking_behavior: 'additive',
    stacks_well: true,
    stack_cap: null,
    formula: 'Test formula',
    scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    detailed_description: 'A test item for unit testing.',
    synergies: [],
    anti_synergies: [],
    notes: 'Test notes',
    graph_type: 'linear_scaling',
    one_and_done: false,
};

const DEFAULT_WEAPON: Weapon = {
    id: 'test_weapon',
    name: 'Test Weapon',
    tier: 'B',
    base_damage: 10,
    attack_speed: 1.0,
    range: 'medium',
    attack_pattern: 'single_target',
    description: 'A test weapon for unit testing.',
    notes: 'Test notes',
    tags: ['test'],
    synergies: [],
};

const DEFAULT_TOME: Tome = {
    id: 'test_tome',
    name: 'Test Tome',
    tier: 'B',
    effect: '+10% test stat',
    priority: 5,
    description: 'A test tome for unit testing.',
    notes: 'Test notes',
    tags: ['test'],
    synergies: [],
};

const DEFAULT_CHARACTER: Character = {
    id: 'test_character',
    name: 'Test Character',
    tier: 'B',
    passive: 'Test passive ability',
    passive_ability: '+10% test bonus',
    description: 'A test character for unit testing.',
    notes: 'Test notes',
    tags: ['test'],
    synergies: [],
};

const DEFAULT_SHRINE: Shrine = {
    id: 'test_shrine',
    name: 'Test Shrine',
    type: 'stat_upgrade',
    reward: '+10 test stat',
    description: 'A test shrine for unit testing.',
    notes: 'Test notes',
    tags: ['test'],
    synergies: [],
};

// ========================================
// Factory Functions
// ========================================

/**
 * Create a test item with optional overrides
 * @param overrides - Partial item properties to override
 * @returns A complete Item object
 */
export function createItem(overrides: DeepPartial<Item> = {}): Item {
    return {
        ...DEFAULT_ITEM,
        ...overrides,
        // Ensure arrays are properly merged
        synergies: overrides.synergies ?? DEFAULT_ITEM.synergies,
        anti_synergies: overrides.anti_synergies ?? DEFAULT_ITEM.anti_synergies,
        scaling_per_stack: overrides.scaling_per_stack ?? DEFAULT_ITEM.scaling_per_stack,
    } as Item;
}

/**
 * Create a test weapon with optional overrides
 * @param overrides - Partial weapon properties to override
 * @returns A complete Weapon object
 */
export function createWeapon(overrides: DeepPartial<Weapon> = {}): Weapon {
    return {
        ...DEFAULT_WEAPON,
        ...overrides,
        synergies: overrides.synergies ?? DEFAULT_WEAPON.synergies,
        tags: overrides.tags ?? DEFAULT_WEAPON.tags,
    } as Weapon;
}

/**
 * Create a test tome with optional overrides
 * @param overrides - Partial tome properties to override
 * @returns A complete Tome object
 */
export function createTome(overrides: DeepPartial<Tome> = {}): Tome {
    return {
        ...DEFAULT_TOME,
        ...overrides,
        synergies: overrides.synergies ?? DEFAULT_TOME.synergies,
        tags: overrides.tags ?? DEFAULT_TOME.tags,
    } as Tome;
}

/**
 * Create a test character with optional overrides
 * @param overrides - Partial character properties to override
 * @returns A complete Character object
 */
export function createCharacter(overrides: DeepPartial<Character> = {}): Character {
    return {
        ...DEFAULT_CHARACTER,
        ...overrides,
        synergies: overrides.synergies ?? DEFAULT_CHARACTER.synergies,
        tags: overrides.tags ?? DEFAULT_CHARACTER.tags,
    } as Character;
}

/**
 * Create a test shrine with optional overrides
 * @param overrides - Partial shrine properties to override
 * @returns A complete Shrine object
 */
export function createShrine(overrides: DeepPartial<Shrine> = {}): Shrine {
    return {
        ...DEFAULT_SHRINE,
        ...overrides,
        synergies: overrides.synergies ?? DEFAULT_SHRINE.synergies,
        tags: overrides.tags ?? DEFAULT_SHRINE.tags,
    } as Shrine;
}

// ========================================
// Preset Factories - Items
// ========================================

/**
 * Create a legendary item
 */
export function createLegendaryItem(overrides: DeepPartial<Item> = {}): Item {
    return createItem({
        rarity: 'legendary',
        tier: 'SS',
        ...overrides,
    });
}

/**
 * Create an item that stacks well
 */
export function createStackingItem(overrides: DeepPartial<Item> = {}): Item {
    return createItem({
        stacks_well: true,
        one_and_done: false,
        stack_cap: null,
        stacking_behavior: 'additive',
        ...overrides,
    });
}

/**
 * Create a one-and-done item
 */
export function createOneAndDoneItem(overrides: DeepPartial<Item> = {}): Item {
    return createItem({
        stacks_well: false,
        one_and_done: true,
        stack_cap: 1,
        stacking_behavior: 'no_benefit',
        scaling_per_stack: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        graph_type: 'flat',
        ...overrides,
    });
}

/**
 * Create item for each rarity level
 */
export function createItemsByRarity(): Record<Rarity, Item> {
    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    return rarities.reduce((acc, rarity) => {
        acc[rarity] = createItem({
            id: `${rarity}_item`,
            name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Item`,
            rarity,
        });
        return acc;
    }, {} as Record<Rarity, Item>);
}

/**
 * Create item for each tier level
 */
export function createItemsByTier(): Record<Tier, Item> {
    const tiers: Tier[] = ['SS', 'S', 'A', 'B', 'C'];
    return tiers.reduce((acc, tier) => {
        acc[tier] = createItem({
            id: `tier_${tier.toLowerCase()}_item`,
            name: `Tier ${tier} Item`,
            tier,
        });
        return acc;
    }, {} as Record<Tier, Item>);
}

// ========================================
// Preset Factories - Weapons
// ========================================

/**
 * Create a high-tier weapon
 */
export function createHighTierWeapon(overrides: DeepPartial<Weapon> = {}): Weapon {
    return createWeapon({
        tier: 'S',
        base_damage: 25,
        attack_speed: 1.5,
        ...overrides,
    });
}

/**
 * Create a slow but powerful weapon
 */
export function createHeavyWeapon(overrides: DeepPartial<Weapon> = {}): Weapon {
    return createWeapon({
        base_damage: 50,
        attack_speed: 0.5,
        range: 'short',
        attack_pattern: 'single_target',
        ...overrides,
    });
}

/**
 * Create a fast attack weapon
 */
export function createFastWeapon(overrides: DeepPartial<Weapon> = {}): Weapon {
    return createWeapon({
        base_damage: 5,
        attack_speed: 3.0,
        range: 'medium',
        attack_pattern: 'multi_target',
        ...overrides,
    });
}

// ========================================
// Preset Factories - Tomes
// ========================================

/**
 * Create a high-priority tome
 */
export function createHighPriorityTome(overrides: DeepPartial<Tome> = {}): Tome {
    return createTome({
        tier: 'S',
        priority: 1,
        ...overrides,
    });
}

/**
 * Create a low-priority tome
 */
export function createLowPriorityTome(overrides: DeepPartial<Tome> = {}): Tome {
    return createTome({
        tier: 'C',
        priority: 10,
        ...overrides,
    });
}

// ========================================
// Preset Factories - Characters
// ========================================

/**
 * Create a high-tier character
 */
export function createHighTierCharacter(overrides: DeepPartial<Character> = {}): Character {
    return createCharacter({
        tier: 'S',
        passive: 'Powerful passive ability',
        passive_ability: '+25% damage bonus',
        ...overrides,
    });
}

// ========================================
// Batch Factory Functions
// ========================================

/**
 * Create multiple items with unique IDs
 * @param count - Number of items to create
 * @param baseOverrides - Base overrides applied to all items
 * @returns Array of items
 */
export function createItems(count: number, baseOverrides: DeepPartial<Item> = {}): Item[] {
    return Array.from({ length: count }, (_, i) =>
        createItem({
            id: `test_item_${i + 1}`,
            name: `Test Item ${i + 1}`,
            ...baseOverrides,
        })
    );
}

/**
 * Create multiple weapons with unique IDs
 * @param count - Number of weapons to create
 * @param baseOverrides - Base overrides applied to all weapons
 * @returns Array of weapons
 */
export function createWeapons(count: number, baseOverrides: DeepPartial<Weapon> = {}): Weapon[] {
    return Array.from({ length: count }, (_, i) =>
        createWeapon({
            id: `test_weapon_${i + 1}`,
            name: `Test Weapon ${i + 1}`,
            ...baseOverrides,
        })
    );
}

/**
 * Create multiple tomes with unique IDs
 * @param count - Number of tomes to create
 * @param baseOverrides - Base overrides applied to all tomes
 * @returns Array of tomes
 */
export function createTomes(count: number, baseOverrides: DeepPartial<Tome> = {}): Tome[] {
    return Array.from({ length: count }, (_, i) =>
        createTome({
            id: `test_tome_${i + 1}`,
            name: `Test Tome ${i + 1}`,
            ...baseOverrides,
        })
    );
}

/**
 * Create multiple characters with unique IDs
 * @param count - Number of characters to create
 * @param baseOverrides - Base overrides applied to all characters
 * @returns Array of characters
 */
export function createCharacters(count: number, baseOverrides: DeepPartial<Character> = {}): Character[] {
    return Array.from({ length: count }, (_, i) =>
        createCharacter({
            id: `test_character_${i + 1}`,
            name: `Test Character ${i + 1}`,
            ...baseOverrides,
        })
    );
}

/**
 * Create multiple shrines with unique IDs
 * @param count - Number of shrines to create
 * @param baseOverrides - Base overrides applied to all shrines
 * @returns Array of shrines
 */
export function createShrines(count: number, baseOverrides: DeepPartial<Shrine> = {}): Shrine[] {
    return Array.from({ length: count }, (_, i) =>
        createShrine({
            id: `test_shrine_${i + 1}`,
            name: `Test Shrine ${i + 1}`,
            ...baseOverrides,
        })
    );
}

// ========================================
// Common Test Data Sets
// ========================================

/**
 * Create a complete game data fixture for testing
 */
export function createMockGameData() {
    return {
        items: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_items: 5,
            items: [
                createItem({ id: 'gym_sauce', name: 'Gym Sauce', rarity: 'common', tier: 'S' }),
                createLegendaryItem({ id: 'big_bonk', name: 'Big Bonk' }),
                createOneAndDoneItem({ id: 'anvil', name: 'Anvil', rarity: 'legendary', tier: 'SS' }),
                createStackingItem({ id: 'oats', name: 'Oats', rarity: 'common', tier: 'A' }),
                createItem({ id: 'beer', name: 'Beer', rarity: 'rare', tier: 'A' }),
            ],
        },
        weapons: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_weapons: 3,
            weapons: [
                createWeapon({ id: 'hammer', name: 'Hammer' }),
                createHighTierWeapon({ id: 'sword', name: 'Sword' }),
                createHeavyWeapon({ id: 'club', name: 'Club' }),
            ],
        },
        tomes: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_tomes: 3,
            tomes: [
                createTome({ id: 'hp_tome', name: 'HP Tome', effect: '+50 Max HP' }),
                createHighPriorityTome({ id: 'damage_tome', name: 'Damage Tome', effect: '+15% Damage' }),
                createTome({ id: 'speed_tome', name: 'Speed Tome', effect: '+10% Speed' }),
            ],
        },
        characters: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_characters: 2,
            characters: [
                createCharacter({ id: 'megachad', name: 'Megachad' }),
                createHighTierCharacter({ id: 'ninja', name: 'Ninja' }),
            ],
        },
        shrines: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_shrines: 2,
            shrines: [
                createShrine({ id: 'damage_shrine', name: 'Damage Shrine', type: 'stat_upgrade' }),
                createShrine({ id: 'risk_shrine', name: 'Risk Shrine', type: 'risk_reward' }),
            ],
        },
    };
}

/**
 * Create minimal game data for quick tests
 */
export function createMinimalGameData() {
    return {
        items: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_items: 1,
            items: [createItem()],
        },
        weapons: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_weapons: 1,
            weapons: [createWeapon()],
        },
        tomes: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_tomes: 1,
            tomes: [createTome()],
        },
        characters: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_characters: 1,
            characters: [createCharacter()],
        },
        shrines: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_shrines: 1,
            shrines: [createShrine()],
        },
    };
}
