/**
 * Tests for synergy.ts module
 * Tests synergy and anti-synergy detection
 */
import { describe, it, expect } from 'vitest';

import {
    detectSynergies,
    detectAntiSynergies,
    type BuildState,
    type Synergy,
    type AntiSynergy,
} from '../../src/modules/synergy.ts';

// Mock data for testing
const createCharacter = (overrides = {}) => ({
    id: 'test-char',
    name: 'Test Character',
    tier: 'A',
    synergies_weapons: [],
    synergies_items: [],
    ...overrides,
});

const createWeapon = (overrides = {}) => ({
    id: 'test-weapon',
    name: 'Test Weapon',
    tier: 'A',
    ...overrides,
});

const createItem = (overrides = {}) => ({
    id: 'test-item',
    name: 'Test Item',
    tier: 'A',
    rarity: 'common',
    synergies: [],
    synergies_weapons: [],
    anti_synergies: [],
    ...overrides,
});

const createBuild = (overrides: Partial<BuildState> = {}): BuildState => ({
    character: null,
    weapon: null,
    tomes: [],
    items: [],
    ...overrides,
});

describe('detectSynergies', () => {
    describe('empty build', () => {
        it('should return empty array for empty build', () => {
            const build = createBuild();
            const synergies = detectSynergies(build);
            expect(synergies).toEqual([]);
        });

        it('should return empty array for build with only character', () => {
            const build = createBuild({
                character: createCharacter() as any,
            });
            const synergies = detectSynergies(build);
            expect(synergies).toEqual([]);
        });

        it('should return empty array for build with only weapon', () => {
            const build = createBuild({
                weapon: createWeapon() as any,
            });
            const synergies = detectSynergies(build);
            expect(synergies).toEqual([]);
        });
    });

    describe('character-weapon synergies', () => {
        it('should detect character-weapon synergy', () => {
            const build = createBuild({
                character: createCharacter({
                    name: 'Knight',
                    synergies_weapons: ['Sword'],
                }) as any,
                weapon: createWeapon({ name: 'Sword' }) as any,
            });

            const synergies = detectSynergies(build);

            expect(synergies).toHaveLength(1);
            expect(synergies[0].type).toBe('character-weapon');
            expect(synergies[0].message).toContain('Knight');
            expect(synergies[0].message).toContain('Sword');
            expect(synergies[0].source).toBe('Knight');
            expect(synergies[0].target).toBe('Sword');
        });

        it('should not detect synergy when weapon not in list', () => {
            const build = createBuild({
                character: createCharacter({
                    synergies_weapons: ['Sword'],
                }) as any,
                weapon: createWeapon({ name: 'Axe' }) as any,
            });

            const synergies = detectSynergies(build);
            expect(synergies).toHaveLength(0);
        });

        it('should handle character without synergies_weapons', () => {
            const character = createCharacter();
            delete (character as any).synergies_weapons;

            const build = createBuild({
                character: character as any,
                weapon: createWeapon() as any,
            });

            const synergies = detectSynergies(build);
            expect(synergies).toHaveLength(0);
        });
    });

    describe('item-weapon synergies', () => {
        it('should detect item-weapon synergy', () => {
            const build = createBuild({
                weapon: createWeapon({ name: 'Bow' }) as any,
                items: [
                    createItem({
                        name: 'Quiver',
                        synergies_weapons: ['Bow'],
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);

            expect(synergies).toHaveLength(1);
            expect(synergies[0].type).toBe('item-weapon');
            expect(synergies[0].message).toContain('Quiver');
            expect(synergies[0].message).toContain('Bow');
        });

        it('should detect multiple item-weapon synergies', () => {
            const build = createBuild({
                weapon: createWeapon({ name: 'Staff' }) as any,
                items: [
                    createItem({
                        name: 'Mana Crystal',
                        synergies_weapons: ['Staff'],
                    }) as any,
                    createItem({
                        name: 'Spell Book',
                        synergies_weapons: ['Staff'],
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);
            const itemWeaponSynergies = synergies.filter((s) => s.type === 'item-weapon');
            expect(itemWeaponSynergies).toHaveLength(2);
        });

        it('should not detect synergy when no weapon', () => {
            const build = createBuild({
                items: [
                    createItem({
                        synergies_weapons: ['Sword'],
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);
            expect(synergies).toHaveLength(0);
        });
    });

    describe('item-character synergies', () => {
        it('should detect item-character synergy by item id', () => {
            const build = createBuild({
                character: createCharacter({
                    name: 'Mage',
                    synergies_items: ['magic-staff'],
                }) as any,
                items: [
                    createItem({
                        id: 'magic-staff',
                        name: 'Magic Staff',
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);

            expect(synergies).toHaveLength(1);
            expect(synergies[0].type).toBe('item-character');
            expect(synergies[0].source).toBe('Magic Staff');
            expect(synergies[0].target).toBe('Mage');
        });

        it('should not detect synergy when no character', () => {
            const build = createBuild({
                items: [createItem() as any],
            });

            const synergies = detectSynergies(build);
            expect(synergies).toHaveLength(0);
        });
    });

    describe('item-item synergies', () => {
        it('should detect item-item synergy by name', () => {
            const build = createBuild({
                items: [
                    createItem({
                        name: 'Fire Gem',
                        synergies: ['Ice Gem'],
                    }) as any,
                    createItem({
                        name: 'Ice Gem',
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);

            expect(synergies).toHaveLength(1);
            expect(synergies[0].type).toBe('item-item');
            expect(synergies[0].source).toBe('Fire Gem');
            expect(synergies[0].target).toBe('Ice Gem');
        });

        it('should detect item-item synergy by id', () => {
            const build = createBuild({
                items: [
                    createItem({
                        name: 'Item A',
                        synergies: ['item-b'],
                    }) as any,
                    createItem({
                        id: 'item-b',
                        name: 'Item B',
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);
            expect(synergies).toHaveLength(1);
            expect(synergies[0].type).toBe('item-item');
        });

        it('should not duplicate item-item synergies', () => {
            const build = createBuild({
                items: [
                    createItem({
                        id: 'item-a',
                        name: 'Item A',
                        synergies: ['Item B'],
                    }) as any,
                    createItem({
                        id: 'item-b',
                        name: 'Item B',
                        synergies: ['Item A'],
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);
            // Should only detect one synergy (from first item to second)
            expect(synergies).toHaveLength(1);
        });
    });

    describe('combined synergies', () => {
        it('should detect all synergy types in one build', () => {
            const build = createBuild({
                character: createCharacter({
                    name: 'Hero',
                    synergies_weapons: ['Legendary Sword'],
                    synergies_items: ['power-ring'],
                }) as any,
                weapon: createWeapon({ name: 'Legendary Sword' }) as any,
                items: [
                    createItem({
                        id: 'power-ring',
                        name: 'Power Ring',
                        synergies_weapons: ['Legendary Sword'],
                        synergies: ['Magic Amulet'],
                    }) as any,
                    createItem({
                        name: 'Magic Amulet',
                    }) as any,
                ],
            });

            const synergies = detectSynergies(build);

            // 1 character-weapon + 1 item-weapon + 1 item-character + 1 item-item = 4
            expect(synergies).toHaveLength(4);

            const types = synergies.map((s) => s.type);
            expect(types).toContain('character-weapon');
            expect(types).toContain('item-weapon');
            expect(types).toContain('item-character');
            expect(types).toContain('item-item');
        });
    });
});

describe('detectAntiSynergies', () => {
    describe('empty build', () => {
        it('should return empty array for empty build', () => {
            const build = createBuild();
            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toEqual([]);
        });

        it('should return empty array for build without items', () => {
            const build = createBuild({
                character: createCharacter() as any,
                weapon: createWeapon() as any,
            });
            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toEqual([]);
        });
    });

    describe('item anti-synergies', () => {
        it('should detect anti-synergy by item name', () => {
            const build = createBuild({
                items: [
                    createItem({
                        id: 'fire-shield',
                        name: 'Fire Shield',
                        anti_synergies: ['Ice Shield'],
                    }) as any,
                    createItem({
                        id: 'ice-shield',
                        name: 'Ice Shield',
                    }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);

            expect(antiSynergies).toHaveLength(1);
            expect(antiSynergies[0].type).toBe('item-item');
            expect(antiSynergies[0].message).toContain('conflicts');
            expect(antiSynergies[0].source).toBe('Fire Shield');
            expect(antiSynergies[0].target).toBe('Ice Shield');
        });

        it('should detect anti-synergy by item id', () => {
            const build = createBuild({
                items: [
                    createItem({
                        name: 'Item A',
                        anti_synergies: ['item-b'],
                    }) as any,
                    createItem({
                        id: 'item-b',
                        name: 'Item B',
                    }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(1);
        });

        it('should not flag item against itself', () => {
            const build = createBuild({
                items: [
                    createItem({
                        id: 'self-conflict',
                        name: 'Self',
                        anti_synergies: ['self-conflict'],
                    }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(0);
        });

        it('should detect multiple anti-synergies', () => {
            const build = createBuild({
                items: [
                    createItem({
                        id: 'exclusive',
                        name: 'Exclusive Item',
                        anti_synergies: ['Conflict A', 'Conflict B'],
                    }) as any,
                    createItem({ id: 'conflict-a', name: 'Conflict A' }) as any,
                    createItem({ id: 'conflict-b', name: 'Conflict B' }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(2);
        });

        it('should detect bidirectional anti-synergies', () => {
            const build = createBuild({
                items: [
                    createItem({
                        id: 'item-a',
                        name: 'Item A',
                        anti_synergies: ['Item B'],
                    }) as any,
                    createItem({
                        id: 'item-b',
                        name: 'Item B',
                        anti_synergies: ['Item A'],
                    }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            // Both items conflict with each other, so 2 anti-synergies
            expect(antiSynergies).toHaveLength(2);
        });

        it('should handle items without anti_synergies property', () => {
            const item = createItem({ name: 'Simple Item' });
            delete (item as any).anti_synergies;

            const build = createBuild({
                items: [item as any, createItem({ name: 'Other Item' }) as any],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(0);
        });

        it('should handle empty anti_synergies array', () => {
            const build = createBuild({
                items: [
                    createItem({
                        name: 'Item A',
                        anti_synergies: [],
                    }) as any,
                    createItem({ name: 'Item B' }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(0);
        });
    });

    describe('edge cases', () => {
        it('should handle build with single item', () => {
            const build = createBuild({
                items: [
                    createItem({
                        anti_synergies: ['Something'],
                    }) as any,
                ],
            });

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies).toHaveLength(0);
        });
    });
});
