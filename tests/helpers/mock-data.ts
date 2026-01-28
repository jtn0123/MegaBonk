import { vi, type Mock } from 'vitest';
import type {
    Item,
    Weapon,
    Character,
    Tome,
    Shrine,
    Stats,
    ItemsData,
    WeaponsData,
    TomesData,
    CharactersData,
    ShrinesData,
    AllGameData,
    Tier,
    Rarity,
} from '../../src/types/index.ts';

/**
 * Mock item with all required fields for testing
 */
interface MockItem extends Item {
    unlocked_by_default: boolean;
    stacking_behavior: string;
}

/**
 * Mock weapon with all required fields for testing
 */
interface MockWeapon extends Weapon {
    unlocked_by_default: boolean;
}

/**
 * Mock character with all required fields for testing
 */
interface MockCharacter extends Character {
    // All fields come from base Character interface
}

/**
 * Mock tome with all required fields for testing
 */
interface MockTome extends Tome {
    unlocked_by_default?: boolean;
}

/**
 * Mock shrine with all required fields for testing
 */
interface MockShrine extends Shrine {
    // All fields come from base Shrine interface
}

/**
 * Creates mock item data for testing
 */
export function createMockItem(overrides: Partial<MockItem> = {}): MockItem {
    return {
        id: 'test-item',
        name: 'Test Item',
        description: 'A test item for testing purposes. It provides damage bonuses.',
        rarity: 'rare' as Rarity,
        tier: 'A' as Tier,
        unlocked_by_default: true,
        base_effect: '+10% damage',
        scaling_type: 'linear',
        stacking_behavior: 'additive',
        stacks_well: true,
        stack_cap: undefined,
        formula: 'Damage = 10 * stacks',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        detailed_description: 'A test item for testing purposes. It provides damage bonuses.',
        synergies: ['TestWeapon'],
        anti_synergies: [],
        notes: 'Test notes for the item',
        graph_type: 'linear_scaling',
        one_and_done: false,
        ...overrides,
    };
}

/**
 * Creates mock weapon data for testing
 */
export function createMockWeapon(overrides: Partial<MockWeapon> = {}): MockWeapon {
    return {
        id: 'test_weapon',
        name: 'Test Weapon',
        description: 'A test weapon for testing.',
        tier: 'S' as Tier,
        base_damage: 10,
        attack_pattern: 'Single shot',
        upgradeable_stats: ['Damage', 'Size'],
        unlock_requirement: null,
        unlocked_by_default: true,
        best_for: ['Testing'],
        synergies_items: ['test_item'],
        synergies_tomes: ['damage'],
        synergies_characters: ['test_character'],
        playstyle: 'Test playstyle',
        pros: ['Pro 1', 'Pro 2'],
        cons: ['Con 1'],
        build_tips: 'Build tips for testing',
        ...overrides,
    };
}

/**
 * Creates mock character data for testing
 */
export function createMockCharacter(overrides: Partial<MockCharacter> = {}): MockCharacter {
    return {
        id: 'test_character',
        name: 'Test Character',
        tier: 'A' as Tier,
        starting_weapon: 'Test Weapon',
        passive_ability: 'Gain 1% Damage per level',
        passive_description: 'Increases damage with each level.',
        playstyle: 'Test playstyle',
        strengths: ['Strength 1', 'Strength 2'],
        weaknesses: ['Weakness 1'],
        synergies_weapons: ['Test Weapon'],
        synergies_items: ['test_item'],
        synergies_tomes: ['damage'],
        ...overrides,
    };
}

/**
 * Creates mock tome data for testing
 */
export function createMockTome(overrides: Partial<MockTome> = {}): MockTome {
    return {
        id: 'test_tome',
        name: 'Test Tome',
        description: 'A test tome for testing.',
        tier: 'A' as Tier,
        stat_affected: 'Damage',
        value_per_level: '+0.1x (10% damage)',
        max_level: 99,
        priority: 1,
        recommended_for: ['All builds'],
        notes: 'Test notes',
        ...overrides,
    };
}

/**
 * Creates mock shrine data for testing
 */
export function createMockShrine(overrides: Partial<MockShrine> = {}): MockShrine {
    return {
        id: 'test_shrine',
        name: 'Test Shrine',
        description: 'A test shrine for testing.',
        tier: 'A' as Tier,
        type: 'stat_upgrade',
        icon: '📊',
        reward: 'Test reward',
        strategy: 'Test strategy',
        notes: 'Test notes',
        ...overrides,
    };
}

/**
 * Mock allData structure type
 */
export interface MockAllData {
    items: ItemsData & { total_items?: number };
    weapons: WeaponsData;
    tomes: TomesData;
    characters: CharactersData;
    shrines: ShrinesData;
    stats: Stats & { version: string; stats: Record<string, unknown> };
}

/**
 * Creates full mock allData structure for testing
 */
export function createMockAllData(): MockAllData {
    return {
        items: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            total_items: 4,
            items: [
                createMockItem({ id: 'test-item', name: 'Test Item', tier: 'A', rarity: 'rare' }),
                createMockItem({ id: 'gym_sauce', name: 'Gym Sauce', tier: 'S', rarity: 'epic' }),
                createMockItem({
                    id: 'beefy_ring',
                    name: 'Beefy Ring',
                    tier: 'S',
                    stacks_well: true,
                    rarity: 'legendary',
                }),
                createMockItem({
                    id: 'anvil',
                    name: 'Anvil',
                    tier: 'SS',
                    one_and_done: true,
                    stacks_well: false,
                    rarity: 'rare',
                }),
            ],
        },
        weapons: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            weapons: [
                createMockWeapon({ id: 'test-weapon', name: 'Test Weapon', base_damage: 10 }),
                createMockWeapon({ id: 'revolver', name: 'Revolver', base_damage: 5 }),
                createMockWeapon({ id: 'bow', name: 'Bow', base_damage: 9 }),
            ],
        },
        tomes: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            tomes: [
                createMockTome({
                    id: 'test-tome',
                    name: 'Test Tome',
                    stat_affected: 'Damage',
                    value_per_level: '+0.1x',
                }),
                createMockTome({
                    id: 'damage',
                    name: 'Damage Tome',
                    stat_affected: 'Damage',
                    value_per_level: '+0.08x',
                }),
                createMockTome({
                    id: 'precision',
                    name: 'Precision Tome',
                    stat_affected: 'Crit Chance',
                    value_per_level: '+7%',
                }),
            ],
        },
        characters: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            characters: [
                createMockCharacter({ id: 'test-character', name: 'Test Character', passive_ability: 'Test passive' }),
                createMockCharacter({
                    id: 'cl4nk',
                    name: 'CL4NK',
                    passive_ability: 'Gain 1% Crit Chance per level',
                    synergies_weapons: ['Revolver'],
                }),
                createMockCharacter({ id: 'sir_oofie', name: 'Sir Oofie', passive_ability: 'Gain 1% Armor per level' }),
            ],
        },
        shrines: {
            version: '1.0.0',
            last_updated: '2024-01-01',
            shrines: [
                createMockShrine({ id: 'test-shrine', name: 'Test Shrine' }),
                createMockShrine({ id: 'charge_shrine', name: 'Charge Shrine' }),
            ],
        },
        stats: {
            version: '1.0.0',
            stats: {},
        },
    };
}

/**
 * Mock Response type for fetch mocks
 */
interface MockResponse {
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
}

/**
 * Creates mock fetch responses for data loading tests
 */
export function setupFetchMocks(mockData: MockAllData = createMockAllData()): void {
    const responses: Record<string, unknown> = {
        '../data/items.json': mockData.items,
        '../data/weapons.json': mockData.weapons,
        '../data/tomes.json': mockData.tomes,
        '../data/characters.json': mockData.characters,
        '../data/shrines.json': mockData.shrines,
        '../data/stats.json': mockData.stats,
    };

    globalThis.fetch = vi.fn((url: string | URL | Request): Promise<MockResponse> => {
        const urlString = typeof url === 'string' ? url : url.toString();
        const data = responses[urlString];
        if (data) {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve(data),
            });
        }
        return Promise.reject(new Error(`Unknown URL: ${urlString}`));
    }) as Mock;
}

/**
 * Creates a larger dataset for more comprehensive testing
 */
export function createExtendedMockData(): MockAllData {
    const mockData = createMockAllData();

    // Add more items for comprehensive filter testing
    mockData.items.items = [
        createMockItem({ id: 'gym_sauce', name: 'Gym Sauce', tier: 'S', rarity: 'epic', stacks_well: true }),
        createMockItem({ id: 'beefy_ring', name: 'Beefy Ring', tier: 'S', rarity: 'legendary', stacks_well: true }),
        createMockItem({
            id: 'anvil',
            name: 'Anvil',
            tier: 'SS',
            rarity: 'rare',
            one_and_done: true,
            stacks_well: false,
        }),
        createMockItem({
            id: 'forbidden_juice',
            name: 'Forbidden Juice',
            tier: 'A',
            rarity: 'epic',
            stacks_well: true,
        }),
        createMockItem({ id: 'oats', name: 'Oats', tier: 'B', rarity: 'common', stacks_well: true }),
        createMockItem({ id: 'battery', name: 'Battery', tier: 'A', rarity: 'uncommon', stacks_well: true }),
        createMockItem({ id: 'turbo_socks', name: 'Turbo Socks', tier: 'B', rarity: 'rare', stacks_well: true }),
        createMockItem({ id: 'beer', name: 'Beer', tier: 'A', rarity: 'common', stacks_well: true }),
        createMockItem({
            id: 'backpack',
            name: 'Backpack',
            tier: 'SS',
            rarity: 'legendary',
            one_and_done: true,
            stacks_well: false,
        }),
        createMockItem({
            id: 'big_bonk',
            name: 'Big Bonk',
            tier: 'S',
            rarity: 'epic',
            stacks_well: true,
            scaling_per_stack: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
            scaling_type: 'linear',
        }),
        createMockItem({
            id: 'spicy_meatball',
            name: 'Spicy Meatball',
            tier: 'A',
            rarity: 'rare',
            stacks_well: true,
            stack_cap: 4,
            scaling_per_stack: [25, 50, 75, 100, 100, 100, 100, 100, 100, 100],
            scaling_type: 'diminishing',
        }),
    ];

    mockData.items.total_items = mockData.items.items.length;

    return mockData;
}
