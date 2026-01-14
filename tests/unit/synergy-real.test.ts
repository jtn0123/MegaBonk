/**
 * Real Integration Tests for Synergy Module
 * No mocking - tests actual synergy detection implementations
 */

import { describe, it, expect } from 'vitest';
import {
    detectSynergies,
    detectAntiSynergies,
    type BuildState,
    type Synergy,
    type AntiSynergy,
} from '../../src/modules/synergy.ts';

// ========================================
// Test Fixtures
// ========================================

const testCharacter = {
    id: 'fire_mage',
    name: 'Fire Mage',
    tier: 'SS' as const,
    rarity: 'legendary' as const,
    description: 'Fire master',
    passive_ability: 'Inferno',
    passive_description: 'Burns enemies',
    starting_weapon: 'Fire Staff',
    playstyle: 'Ranged',
    synergies_weapons: ['Fire Sword', 'Flame Staff'],
    synergies_items: ['fire_crystal', 'ember_shard'],
};

const testWeapon = {
    id: 'fire_sword',
    name: 'Fire Sword',
    tier: 'S' as const,
    rarity: 'legendary' as const,
    description: 'Burns on hit',
    base_damage: 50,
    attack_pattern: 'Sweeping',
    upgradeable_stats: ['damage'],
};

const testItem = {
    id: 'fire_crystal',
    name: 'Fire Crystal',
    tier: 'A' as const,
    rarity: 'epic' as const,
    description: 'Increases fire damage',
    base_effect: '+20% fire damage',
    detailed_description: 'Fire boost',
    one_and_done: false,
    stacks_well: true,
    synergies: ['Ember Shard', 'Flame Ring'],
    synergies_weapons: ['Fire Sword'],
    anti_synergies: ['Ice Crystal', 'Frost Ring'],
};

const testItem2 = {
    id: 'ember_shard',
    name: 'Ember Shard',
    tier: 'A' as const,
    rarity: 'epic' as const,
    description: 'Fire boost',
    base_effect: '+10% fire damage',
    detailed_description: 'Fire synergy',
    one_and_done: false,
    stacks_well: true,
    synergies: ['Fire Crystal'],
};

const testItem3 = {
    id: 'ice_crystal',
    name: 'Ice Crystal',
    tier: 'A' as const,
    rarity: 'epic' as const,
    description: 'Cold damage',
    base_effect: '+20% ice damage',
    detailed_description: 'Ice boost',
    one_and_done: false,
    stacks_well: true,
};

// ========================================
// detectSynergies Tests
// ========================================

describe('detectSynergies - Real Integration Tests', () => {
    it('should return empty array for empty build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        };

        const synergies = detectSynergies(build);
        expect(synergies).toEqual([]);
    });

    it('should detect character-weapon synergy', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            tomes: [],
            items: [],
        };

        const synergies = detectSynergies(build);
        expect(synergies.length).toBeGreaterThan(0);

        const charWeaponSynergy = synergies.find(s => s.type === 'character-weapon');
        expect(charWeaponSynergy).toBeDefined();
        expect(charWeaponSynergy?.message).toContain('Fire Mage');
        expect(charWeaponSynergy?.message).toContain('Fire Sword');
    });

    it('should detect item-weapon synergy', () => {
        const build: BuildState = {
            character: null,
            weapon: testWeapon as any,
            tomes: [],
            items: [testItem as any],
        };

        const synergies = detectSynergies(build);
        const itemWeaponSynergy = synergies.find(s => s.type === 'item-weapon');
        expect(itemWeaponSynergy).toBeDefined();
        expect(itemWeaponSynergy?.message).toContain('Fire Crystal');
        expect(itemWeaponSynergy?.message).toContain('Fire Sword');
    });

    it('should detect item-character synergy', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: null,
            tomes: [],
            items: [testItem as any],
        };

        const synergies = detectSynergies(build);
        const itemCharSynergy = synergies.find(s => s.type === 'item-character');
        expect(itemCharSynergy).toBeDefined();
        expect(itemCharSynergy?.message).toContain('Fire Crystal');
        expect(itemCharSynergy?.message).toContain('Fire Mage');
    });

    it('should detect item-item synergy', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any, testItem2 as any],
        };

        const synergies = detectSynergies(build);
        const itemItemSynergy = synergies.find(s => s.type === 'item-item');
        expect(itemItemSynergy).toBeDefined();
    });

    it('should detect multiple synergies', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            tomes: [],
            items: [testItem as any, testItem2 as any],
        };

        const synergies = detectSynergies(build);
        expect(synergies.length).toBeGreaterThanOrEqual(3);
    });

    it('should not detect synergies for non-synergistic items', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem3 as any],
        };

        const synergies = detectSynergies(build);
        expect(synergies).toEqual([]);
    });

    it('should return synergy objects with correct structure', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            tomes: [],
            items: [],
        };

        const synergies = detectSynergies(build);
        expect(synergies.length).toBeGreaterThan(0);

        synergies.forEach(synergy => {
            expect(synergy.type).toBeDefined();
            expect(synergy.message).toBeDefined();
            expect(synergy.source).toBeDefined();
            expect(synergy.target).toBeDefined();
        });
    });
});

// ========================================
// detectAntiSynergies Tests
// ========================================

describe('detectAntiSynergies - Real Integration Tests', () => {
    it('should return empty array for empty build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        };

        const antiSynergies = detectAntiSynergies(build);
        expect(antiSynergies).toEqual([]);
    });

    it('should return empty array for items with no anti-synergies', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem2 as any],
        };

        const antiSynergies = detectAntiSynergies(build);
        expect(antiSynergies).toEqual([]);
    });

    it('should detect anti-synergy between conflicting items', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any, testItem3 as any],
        };

        const antiSynergies = detectAntiSynergies(build);
        expect(antiSynergies.length).toBeGreaterThan(0);

        const antiSynergy = antiSynergies[0];
        expect(antiSynergy.type).toBe('item-item');
        expect(antiSynergy.message).toContain('Fire Crystal');
        expect(antiSynergy.message).toContain('Ice Crystal');
    });

    it('should not detect anti-synergy with self', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any],
        };

        // Even though item has anti_synergies, it shouldn't conflict with itself
        const antiSynergies = detectAntiSynergies(build);
        const selfConflict = antiSynergies.find(
            a => a.source === testItem.name && a.target === testItem.name
        );
        expect(selfConflict).toBeUndefined();
    });

    it('should return anti-synergy objects with correct structure', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any, testItem3 as any],
        };

        const antiSynergies = detectAntiSynergies(build);
        expect(antiSynergies.length).toBeGreaterThan(0);

        antiSynergies.forEach(antiSynergy => {
            expect(antiSynergy.type).toBe('item-item');
            expect(antiSynergy.message).toBeDefined();
            expect(antiSynergy.source).toBeDefined();
            expect(antiSynergy.target).toBeDefined();
        });
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Synergy Edge Cases', () => {
    it('should handle character without synergies_weapons', () => {
        const charNoSynergies = {
            id: 'basic',
            name: 'Basic',
            tier: 'C' as const,
        };

        const build: BuildState = {
            character: charNoSynergies as any,
            weapon: testWeapon as any,
            tomes: [],
            items: [],
        };

        expect(() => detectSynergies(build)).not.toThrow();
    });

    it('should handle item without synergies_weapons', () => {
        const itemNoSynergies = {
            id: 'basic',
            name: 'Basic Item',
            tier: 'C' as const,
        };

        const build: BuildState = {
            character: null,
            weapon: testWeapon as any,
            tomes: [],
            items: [itemNoSynergies as any],
        };

        expect(() => detectSynergies(build)).not.toThrow();
    });

    it('should handle item without synergies array', () => {
        const itemNoArray = {
            id: 'noarray',
            name: 'No Array Item',
            tier: 'B' as const,
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any, itemNoArray as any],
        };

        expect(() => detectSynergies(build)).not.toThrow();
    });

    it('should handle empty synergies arrays', () => {
        const itemEmptySynergies = {
            id: 'empty',
            name: 'Empty Item',
            tier: 'C' as const,
            synergies: [],
            synergies_weapons: [],
        };

        const build: BuildState = {
            character: null,
            weapon: testWeapon as any,
            tomes: [],
            items: [itemEmptySynergies as any],
        };

        expect(() => detectSynergies(build)).not.toThrow();
    });

    it('should handle item with empty anti_synergies', () => {
        const itemEmptyAnti = {
            id: 'empty_anti',
            name: 'Empty Anti',
            tier: 'C' as const,
            anti_synergies: [],
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [itemEmptyAnti as any],
        };

        expect(() => detectAntiSynergies(build)).not.toThrow();
        expect(detectAntiSynergies(build)).toEqual([]);
    });

    it('should detect synergy by item ID', () => {
        // Test that synergies are detected by ID, not just name
        const itemWithIdSynergy = {
            id: 'synergy_tester',
            name: 'Synergy Tester',
            tier: 'A' as const,
            synergies: ['fire_crystal'], // Reference by ID
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [itemWithIdSynergy as any, testItem as any],
        };

        const synergies = detectSynergies(build);
        // Should find synergy between items
        const found = synergies.find(s =>
            s.type === 'item-item' &&
            s.source === 'Synergy Tester'
        );
        expect(found).toBeDefined();
    });
});

// ========================================
// Type Checking Tests
// ========================================

describe('Synergy Type Definitions', () => {
    it('should return correct synergy types', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            tomes: [],
            items: [testItem as any, testItem2 as any],
        };

        const synergies = detectSynergies(build);

        const types = synergies.map(s => s.type);
        expect(types).toContain('character-weapon');
        expect(types).toContain('item-weapon');
        expect(types).toContain('item-character');
        expect(types).toContain('item-item');
    });

    it('should only have item-item type for anti-synergies', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            tomes: [],
            items: [testItem as any, testItem3 as any],
        };

        const antiSynergies = detectAntiSynergies(build);

        antiSynergies.forEach(anti => {
            expect(anti.type).toBe('item-item');
        });
    });
});
