/**
 * Centralized Mock Entity Factories
 * Single source of truth for all mock game entities used in tests
 *
 * Usage:
 *   import { createMockItem, createMockWeapon, createMockGameData } from '../fixtures/mock-entities';
 */

import type { Item, Weapon, Tome, Character, Shrine, AllGameData } from '../../src/types';

// ========================================
// Item Factory
// ========================================

export interface MockItemOptions {
    id?: string;
    name?: string;
    description?: string;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    tier?: 'SS' | 'S' | 'A' | 'B' | 'C';
    tags?: string[];
    mechanics?: Record<string, any>;
    image?: string;
}

export function createMockItem(options: MockItemOptions | string = {}): Item {
    // Allow passing just an id string for convenience
    if (typeof options === 'string') {
        options = { id: options, name: options.charAt(0).toUpperCase() + options.slice(1).replace(/_/g, ' ') };
    }

    const id = options.id ?? 'test_item';
    const name = options.name ?? 'Test Item';

    return {
        id,
        name,
        description: options.description ?? `${name} description`,
        rarity: options.rarity ?? 'common',
        tier: options.tier ?? 'A',
        tags: options.tags ?? ['test'],
        mechanics: options.mechanics ?? { base: { damage: 10 } },
        image: options.image ?? `images/items/${id}.webp`,
    };
}

// ========================================
// Weapon Factory
// ========================================

export interface MockWeaponOptions {
    id?: string;
    name?: string;
    description?: string;
    tier?: 'SS' | 'S' | 'A' | 'B' | 'C';
    base_damage?: number;
    attack_speed?: number;
    upgrade_path?: any[];
    image?: string;
}

export function createMockWeapon(options: MockWeaponOptions | string = {}): Weapon {
    if (typeof options === 'string') {
        options = { id: options, name: options.charAt(0).toUpperCase() + options.slice(1).replace(/_/g, ' ') };
    }

    const id = options.id ?? 'test_weapon';
    const name = options.name ?? 'Test Weapon';

    return {
        id,
        name,
        description: options.description ?? `${name} description`,
        tier: options.tier ?? 'A',
        base_damage: options.base_damage ?? 50,
        attack_speed: options.attack_speed ?? 1.0,
        upgrade_path: options.upgrade_path ?? [],
        image: options.image ?? `images/weapons/${id}.webp`,
    };
}

// ========================================
// Tome Factory
// ========================================

export interface MockTomeOptions {
    id?: string;
    name?: string;
    description?: string;
    tier?: 'SS' | 'S' | 'A' | 'B' | 'C';
    stat_affected?: string;
    value_per_level?: string;
    max_level?: number;
    priority?: number;
    image?: string;
}

export function createMockTome(options: MockTomeOptions | string = {}): Tome {
    if (typeof options === 'string') {
        options = { id: options, name: options.charAt(0).toUpperCase() + options.slice(1).replace(/_/g, ' ') };
    }

    const id = options.id ?? 'test_tome';
    const name = options.name ?? 'Test Tome';

    return {
        id,
        name,
        description: options.description ?? `${name} description`,
        tier: options.tier ?? 'A',
        stat_affected: options.stat_affected ?? 'damage',
        value_per_level: options.value_per_level ?? '5%',
        max_level: options.max_level ?? 5,
        priority: options.priority ?? 1,
        image: options.image ?? `images/tomes/${id}.webp`,
    };
}

// ========================================
// Character Factory
// ========================================

export interface MockCharacterOptions {
    id?: string;
    name?: string;
    description?: string;
    tier?: 'SS' | 'S' | 'A' | 'B' | 'C';
    starting_stats?: Record<string, number>;
    passive_abilities?: any[];
    image?: string;
}

export function createMockCharacter(options: MockCharacterOptions | string = {}): Character {
    if (typeof options === 'string') {
        options = { id: options, name: options.charAt(0).toUpperCase() + options.slice(1).replace(/_/g, ' ') };
    }

    const id = options.id ?? 'test_character';
    const name = options.name ?? 'Test Character';

    return {
        id,
        name,
        description: options.description ?? `${name} description`,
        tier: options.tier ?? 'S',
        starting_stats: options.starting_stats ?? { health: 100, damage: 10 },
        passive_abilities: options.passive_abilities ?? [],
        image: options.image ?? `images/characters/${id}.webp`,
    };
}

// ========================================
// Shrine Factory
// ========================================

export interface MockShrineOptions {
    id?: string;
    name?: string;
    description?: string;
    effect?: string;
    cost?: number;
    image?: string;
}

export function createMockShrine(options: MockShrineOptions | string = {}): Shrine {
    if (typeof options === 'string') {
        options = { id: options, name: options.charAt(0).toUpperCase() + options.slice(1).replace(/_/g, ' ') };
    }

    const id = options.id ?? 'test_shrine';
    const name = options.name ?? 'Test Shrine';

    return {
        id,
        name,
        description: options.description ?? `${name} description`,
        effect: options.effect ?? 'Test effect',
        cost: options.cost ?? 100,
        image: options.image ?? `images/shrines/${id}.webp`,
    };
}

// ========================================
// Game Data Factory
// ========================================

export interface MockGameDataOptions {
    items?: Item[];
    weapons?: Weapon[];
    tomes?: Tome[];
    characters?: Character[];
    shrines?: Shrine[];
    version?: string;
}

export function createMockGameData(options: MockGameDataOptions = {}): AllGameData {
    const version = options.version ?? '1.0';
    const lastUpdated = '2024-01-01';

    return {
        items: {
            version,
            last_updated: lastUpdated,
            items: options.items ?? [
                createMockItem({ id: 'wrench', name: 'Wrench' }),
                createMockItem({ id: 'first_aid_kit', name: 'First Aid Kit', tier: 'B' }),
                createMockItem({ id: 'battery', name: 'Battery', tier: 'S', rarity: 'rare' }),
                createMockItem({ id: 'banana', name: 'Banana', tier: 'C' }),
            ],
        },
        weapons: {
            version,
            last_updated: lastUpdated,
            weapons: options.weapons ?? [
                createMockWeapon({ id: 'hammer', name: 'Hammer' }),
                createMockWeapon({ id: 'sword', name: 'Sword' }),
            ],
        },
        tomes: {
            version,
            last_updated: lastUpdated,
            tomes: options.tomes ?? [
                createMockTome({ id: 'tome_strength', name: 'Tome of Strength' }),
                createMockTome({ id: 'tome_agility', name: 'Tome of Agility' }),
            ],
        },
        characters: {
            version,
            last_updated: lastUpdated,
            characters: options.characters ?? [
                createMockCharacter({ id: 'clank', name: 'CL4NK' }),
                createMockCharacter({ id: 'bonk', name: 'Bonk' }),
            ],
        },
        shrines: {
            version,
            last_updated: lastUpdated,
            shrines: options.shrines ?? [
                createMockShrine({ id: 'shrine_power', name: 'Shrine of Power' }),
            ],
        },
        stats: {
            version,
            last_updated: lastUpdated,
        },
    };
}

// ========================================
// Pre-built Entity Sets (for common scenarios)
// ========================================

export const MOCK_ITEMS = {
    common: () => createMockItem({ id: 'common_item', name: 'Common Item', rarity: 'common', tier: 'C' }),
    rare: () => createMockItem({ id: 'rare_item', name: 'Rare Item', rarity: 'rare', tier: 'A' }),
    legendary: () => createMockItem({ id: 'legendary_item', name: 'Legendary Item', rarity: 'legendary', tier: 'SS' }),
    wrench: () => createMockItem({ id: 'wrench', name: 'Wrench' }),
    medkit: () => createMockItem({ id: 'medkit', name: 'Medkit', tags: ['health'] }),
    battery: () => createMockItem({ id: 'battery', name: 'Battery', rarity: 'rare', tier: 'S' }),
};

export const MOCK_WEAPONS = {
    hammer: () => createMockWeapon({ id: 'hammer', name: 'Hammer', base_damage: 100 }),
    sword: () => createMockWeapon({ id: 'sword', name: 'Sword', base_damage: 75, attack_speed: 1.5 }),
    dagger: () => createMockWeapon({ id: 'dagger', name: 'Dagger', base_damage: 30, attack_speed: 2.5 }),
};

export const MOCK_CHARACTERS = {
    clank: () => createMockCharacter({ id: 'clank', name: 'CL4NK', tier: 'S' }),
    bonk: () => createMockCharacter({ id: 'bonk', name: 'Bonk', tier: 'A' }),
    ninja: () => createMockCharacter({ id: 'ninja', name: 'Ninja', tier: 'S' }),
};

// ========================================
// Batch Creation Helpers
// ========================================

export function createMockItems(count: number, baseOptions: MockItemOptions = {}): Item[] {
    return Array.from({ length: count }, (_, i) =>
        createMockItem({
            ...baseOptions,
            id: baseOptions.id ? `${baseOptions.id}_${i}` : `item_${i}`,
            name: baseOptions.name ? `${baseOptions.name} ${i + 1}` : `Item ${i + 1}`,
        })
    );
}

export function createMockWeapons(count: number, baseOptions: MockWeaponOptions = {}): Weapon[] {
    return Array.from({ length: count }, (_, i) =>
        createMockWeapon({
            ...baseOptions,
            id: baseOptions.id ? `${baseOptions.id}_${i}` : `weapon_${i}`,
            name: baseOptions.name ? `${baseOptions.name} ${i + 1}` : `Weapon ${i + 1}`,
        })
    );
}
