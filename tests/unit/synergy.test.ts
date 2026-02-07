/**
 * @vitest-environment jsdom
 * Synergy Detection Module Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    detectSynergies,
    detectAntiSynergies,
    type BuildState,
    type Synergy,
    type AntiSynergy,
} from '../../src/modules/synergy.ts';
import type { Character, Weapon, Item } from '../../src/types/index.ts';

// ========================================
// Test Fixtures
// ========================================

const createCharacter = (overrides: Partial<Character> = {}): Character => ({
    id: 'test_char',
    name: 'Test Character',
    tier: 'A',
    rarity: 'common',
    description: 'A test character',
    passive: 'Test passive',
    strengths: [],
    weaknesses: [],
    tips: [],
    synergies_weapons: [],
    synergies_items: [],
    ...overrides,
});

const createWeapon = (overrides: Partial<Weapon> = {}): Weapon => ({
    id: 'test_weapon',
    name: 'Test Weapon',
    tier: 'A',
    rarity: 'common',
    description: 'A test weapon',
    base_damage: 10,
    damage_per_upgrade: 2,
    max_upgrades: 5,
    tips: [],
    ...overrides,
});

const createItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'test_item',
    name: 'Test Item',
    tier: 'A',
    rarity: 'common',
    description: 'A test item',
    effect: 'Test effect',
    scaling: { type: 'linear', base: 1, per_stack: 1 },
    stack_cap: 10,
    tips: [],
    synergies: [],
    anti_synergies: [],
    ...overrides,
});

const createEmptyBuild = (): BuildState => ({
    character: null,
    weapon: null,
    tomes: [],
    items: [],
});

describe('Synergy Detection Module', () => {
    // ========================================
    // detectSynergies Tests
    // ========================================
    describe('detectSynergies', () => {
        // ----------------------------------------
        // Empty Build Tests
        // ----------------------------------------
        describe('empty build', () => {
            it('should return empty array for completely empty build', () => {
                const build = createEmptyBuild();
                const synergies = detectSynergies(build);
                expect(synergies).toEqual([]);
            });

            it('should return empty array for build with only character', () => {
                const build = createEmptyBuild();
                build.character = createCharacter();
                const synergies = detectSynergies(build);
                expect(synergies).toEqual([]);
            });

            it('should return empty array for build with only weapon', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon();
                const synergies = detectSynergies(build);
                expect(synergies).toEqual([]);
            });

            it('should return empty array for build with only items', () => {
                const build = createEmptyBuild();
                build.items = [createItem()];
                const synergies = detectSynergies(build);
                expect(synergies).toEqual([]);
            });
        });

        // ----------------------------------------
        // Character-Weapon Synergy Tests
        // ----------------------------------------
        describe('character-weapon synergies', () => {
            it('should detect character-weapon synergy', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    name: 'Berserker',
                    synergies_weapons: ['Axe'],
                });
                build.weapon = createWeapon({ name: 'Axe' });

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
                expect(synergies[0]).toMatchObject({
                    type: 'character-weapon',
                    source: 'Berserker',
                    target: 'Axe',
                });
            });

            it('should not detect synergy when character has no weapon synergies', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({ synergies_weapons: [] });
                build.weapon = createWeapon({ name: 'Sword' });

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(0);
            });

            it('should not detect synergy when weapon is not in character synergies', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({ synergies_weapons: ['Axe'] });
                build.weapon = createWeapon({ name: 'Sword' });

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(0);
            });

            it('should include descriptive message', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    name: 'Warrior',
                    synergies_weapons: ['Hammer'],
                });
                build.weapon = createWeapon({ name: 'Hammer' });

                const synergies = detectSynergies(build);

                expect(synergies[0]?.message).toContain('Warrior');
                expect(synergies[0]?.message).toContain('Hammer');
                expect(synergies[0]?.message).toContain('synergizes');
            });
        });

        // ----------------------------------------
        // Item-Weapon Synergy Tests
        // ----------------------------------------
        describe('item-weapon synergies', () => {
            it('should detect item-weapon synergy via synergies field', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon({ id: 'sword', name: 'Sword' });
                build.items = [
                    createItem({
                        name: 'Sharpening Stone',
                        synergies: ['Sword'],
                    }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
                expect(synergies[0]).toMatchObject({
                    type: 'item-weapon',
                    source: 'Sharpening Stone',
                    target: 'Sword',
                });
            });

            it('should detect item-weapon synergy via synergies_weapons field', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon({ id: 'bow', name: 'Bow' });
                build.items = [
                    createItem({
                        name: 'Quiver',
                        synergies_weapons: ['Bow'],
                    } as any),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
                expect(synergies[0]?.type).toBe('item-weapon');
            });

            it('should detect synergy by weapon ID', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon({ id: 'battle_axe', name: 'Battle Axe' });
                build.items = [
                    createItem({
                        name: 'Axe Oil',
                        synergies: ['battle_axe'],
                    }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
            });

            it('should detect synergy case-insensitively by name', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon({ id: 'sword', name: 'Sword' });
                build.items = [
                    createItem({
                        name: 'Item',
                        synergies: ['sword'], // lowercase
                    }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
            });

            it('should detect multiple item-weapon synergies', () => {
                const build = createEmptyBuild();
                build.weapon = createWeapon({ name: 'Staff' });
                build.items = [
                    createItem({ name: 'Crystal', synergies: ['Staff'] }),
                    createItem({ name: 'Rune', synergies: ['Staff'] }),
                    createItem({ name: 'Orb', synergies: ['Staff'] }),
                ];

                const synergies = detectSynergies(build);

                const itemWeaponSynergies = synergies.filter(s => s.type === 'item-weapon');
                expect(itemWeaponSynergies).toHaveLength(3);
            });
        });

        // ----------------------------------------
        // Item-Character Synergy Tests
        // ----------------------------------------
        describe('item-character synergies', () => {
            it('should detect item-character synergy', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    name: 'Mage',
                    synergies_items: ['magic_staff'],
                });
                build.items = [createItem({ id: 'magic_staff', name: 'Magic Staff' })];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
                expect(synergies[0]).toMatchObject({
                    type: 'item-character',
                    source: 'Magic Staff',
                    target: 'Mage',
                });
            });

            it('should detect synergy by item name', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    name: 'Healer',
                    synergies_items: ['Healing Potion'],
                });
                build.items = [createItem({ id: 'healing_potion', name: 'Healing Potion' })];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
            });

            it('should not detect synergy for non-matching items', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    synergies_items: ['specific_item'],
                });
                build.items = [createItem({ id: 'other_item', name: 'Other Item' })];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(0);
            });
        });

        // ----------------------------------------
        // Item-Item Synergy Tests
        // ----------------------------------------
        describe('item-item synergies', () => {
            it('should detect item-item synergy by name', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'item_a', name: 'Item A', synergies: ['Item B'] }),
                    createItem({ id: 'item_b', name: 'Item B' }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
                expect(synergies[0]).toMatchObject({
                    type: 'item-item',
                    source: 'Item A',
                    target: 'Item B',
                });
            });

            it('should detect item-item synergy by ID', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'sword_a', name: 'Sword A', synergies: ['sword_b'] }),
                    createItem({ id: 'sword_b', name: 'Sword B' }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(1);
            });

            it('should not duplicate item-item synergies', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'a', name: 'A', synergies: ['B'] }),
                    createItem({ id: 'b', name: 'B', synergies: ['A'] }),
                ];

                const synergies = detectSynergies(build);

                // Should only detect once (A->B), not twice
                const itemItemSynergies = synergies.filter(s => s.type === 'item-item');
                expect(itemItemSynergies).toHaveLength(1);
            });

            it('should detect multiple item-item synergies', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'a', name: 'A', synergies: ['B', 'C'] }),
                    createItem({ id: 'b', name: 'B' }),
                    createItem({ id: 'c', name: 'C' }),
                ];

                const synergies = detectSynergies(build);

                expect(synergies).toHaveLength(2);
            });
        });

        // ----------------------------------------
        // Combined Synergies Tests
        // ----------------------------------------
        describe('combined synergies', () => {
            it('should detect all types of synergies in a complex build', () => {
                const build = createEmptyBuild();
                build.character = createCharacter({
                    name: 'Berserker',
                    synergies_weapons: ['Axe'],
                    synergies_items: ['rage_gem'],
                });
                build.weapon = createWeapon({ id: 'axe', name: 'Axe' });
                build.items = [
                    createItem({ id: 'rage_gem', name: 'Rage Gem', synergies: ['Axe', 'Blood Stone'] }),
                    createItem({ id: 'blood_stone', name: 'Blood Stone' }),
                ];

                const synergies = detectSynergies(build);

                const types = synergies.map(s => s.type);
                expect(types).toContain('character-weapon');
                expect(types).toContain('item-weapon');
                expect(types).toContain('item-character');
                expect(types).toContain('item-item');
            });
        });
    });

    // ========================================
    // detectAntiSynergies Tests
    // ========================================
    describe('detectAntiSynergies', () => {
        describe('empty/no anti-synergies', () => {
            it('should return empty array for empty build', () => {
                const build = createEmptyBuild();
                const antiSynergies = detectAntiSynergies(build);
                expect(antiSynergies).toEqual([]);
            });

            it('should return empty array when items have no anti-synergies', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ anti_synergies: [] }),
                    createItem({ anti_synergies: [] }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toEqual([]);
            });

            it('should return empty array for single item', () => {
                const build = createEmptyBuild();
                build.items = [createItem({ anti_synergies: ['Other Item'] })];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toEqual([]);
            });
        });

        describe('anti-synergy detection', () => {
            it('should detect anti-synergy by name', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'fire', name: 'Fire Crystal', anti_synergies: ['Ice Crystal'] }),
                    createItem({ id: 'ice', name: 'Ice Crystal' }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toHaveLength(1);
                expect(antiSynergies[0]).toMatchObject({
                    type: 'item-item',
                    source: 'Fire Crystal',
                    target: 'Ice Crystal',
                });
            });

            it('should detect anti-synergy by ID', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'light_orb', name: 'Light Orb', anti_synergies: ['dark_orb'] }),
                    createItem({ id: 'dark_orb', name: 'Dark Orb' }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toHaveLength(1);
            });

            it('should include conflict message', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'item_a', name: 'A', anti_synergies: ['B'] }),
                    createItem({ id: 'item_b', name: 'B' }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toHaveLength(1);
                expect(antiSynergies[0]?.message).toContain('conflicts');
            });

            it('should detect mutual anti-synergies as separate entries', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'a', name: 'A', anti_synergies: ['B'] }),
                    createItem({ id: 'b', name: 'B', anti_synergies: ['A'] }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                // Both A->B and B->A should be detected
                expect(antiSynergies).toHaveLength(2);
            });

            it('should detect multiple anti-synergies for one item', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ id: 'a', name: 'A', anti_synergies: ['B', 'C'] }),
                    createItem({ id: 'b', name: 'B' }),
                    createItem({ id: 'c', name: 'C' }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toHaveLength(2);
            });

            it('should not detect self as anti-synergy', () => {
                const build = createEmptyBuild();
                // Item that has itself in anti_synergies (edge case)
                build.items = [
                    createItem({ id: 'self', name: 'Self', anti_synergies: ['Self'] }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toHaveLength(0);
            });
        });

        describe('edge cases', () => {
            it('should handle undefined anti_synergies', () => {
                const build = createEmptyBuild();
                const itemWithoutAntiSynergies = createItem();
                delete (itemWithoutAntiSynergies as any).anti_synergies;
                build.items = [itemWithoutAntiSynergies, createItem({ name: 'Other' })];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toEqual([]);
            });

            it('should handle empty anti_synergies array', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ anti_synergies: [] }),
                    createItem({ name: 'Other' }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toEqual([]);
            });

            it('should handle anti-synergy to non-existent item', () => {
                const build = createEmptyBuild();
                build.items = [
                    createItem({ anti_synergies: ['Non Existent Item'] }),
                ];

                const antiSynergies = detectAntiSynergies(build);

                expect(antiSynergies).toEqual([]);
            });
        });
    });

    // ========================================
    // Type Tests
    // ========================================
    describe('return types', () => {
        it('detectSynergies should return array of Synergy objects', () => {
            const build = createEmptyBuild();
            build.character = createCharacter({
                synergies_weapons: ['Sword'],
            });
            build.weapon = createWeapon({ name: 'Sword' });

            const synergies = detectSynergies(build);

            synergies.forEach(synergy => {
                expect(synergy).toHaveProperty('type');
                expect(synergy).toHaveProperty('message');
                expect(synergy).toHaveProperty('source');
                expect(synergy).toHaveProperty('target');
            });
        });

        it('detectAntiSynergies should return array of AntiSynergy objects', () => {
            const build = createEmptyBuild();
            build.items = [
                createItem({ name: 'A', anti_synergies: ['B'] }),
                createItem({ name: 'B' }),
            ];

            const antiSynergies = detectAntiSynergies(build);

            antiSynergies.forEach(antiSynergy => {
                expect(antiSynergy).toHaveProperty('type', 'item-item');
                expect(antiSynergy).toHaveProperty('message');
                expect(antiSynergy).toHaveProperty('source');
                expect(antiSynergy).toHaveProperty('target');
            });
        });
    });
});
