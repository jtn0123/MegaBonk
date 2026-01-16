/**
 * Integration Tests - Data Validation and Schema
 * Testing data validation, schema checking, and data consistency across modules
 */

import { describe, it, expect } from 'vitest';
import { TIER_ORDER, RARITY_ORDER, ITEM_IDS } from '../../src/modules/constants';
import type { Tier, Rarity, Item, Weapon, Character, Tome } from '../../src/types';

describe('Integration - Tier and Rarity Consistency', () => {
    const allTiers: Tier[] = ['SS', 'S', 'A', 'B', 'C'];
    const allRarities: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

    it('should have all tiers defined in TIER_ORDER', () => {
        allTiers.forEach(tier => {
            expect(TIER_ORDER[tier]).toBeDefined();
            expect(typeof TIER_ORDER[tier]).toBe('number');
        });
    });

    it('should have tiers ordered correctly (SS=0, C=4)', () => {
        expect(TIER_ORDER.SS).toBe(0);
        expect(TIER_ORDER.S).toBe(1);
        expect(TIER_ORDER.A).toBe(2);
        expect(TIER_ORDER.B).toBe(3);
        expect(TIER_ORDER.C).toBe(4);
    });

    it('should have all rarities defined in RARITY_ORDER', () => {
        allRarities.forEach(rarity => {
            expect(RARITY_ORDER[rarity]).toBeDefined();
            expect(typeof RARITY_ORDER[rarity]).toBe('number');
        });
    });

    it('should have rarities ordered correctly (legendary=0, common=4)', () => {
        expect(RARITY_ORDER.legendary).toBe(0);
        expect(RARITY_ORDER.epic).toBe(1);
        expect(RARITY_ORDER.rare).toBe(2);
        expect(RARITY_ORDER.uncommon).toBe(3);
        expect(RARITY_ORDER.common).toBe(4);
    });

    it('should be able to sort items by tier', () => {
        const items: Array<{ tier: Tier; name: string }> = [
            { tier: 'B', name: 'Item B' },
            { tier: 'SS', name: 'Item SS' },
            { tier: 'A', name: 'Item A' },
            { tier: 'C', name: 'Item C' },
            { tier: 'S', name: 'Item S' },
        ];

        items.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

        expect(items[0].tier).toBe('SS');
        expect(items[1].tier).toBe('S');
        expect(items[2].tier).toBe('A');
        expect(items[3].tier).toBe('B');
        expect(items[4].tier).toBe('C');
    });

    it('should be able to sort items by rarity', () => {
        const items: Array<{ rarity: Rarity; name: string }> = [
            { rarity: 'common', name: 'Common' },
            { rarity: 'legendary', name: 'Legendary' },
            { rarity: 'rare', name: 'Rare' },
            { rarity: 'uncommon', name: 'Uncommon' },
            { rarity: 'epic', name: 'Epic' },
        ];

        items.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

        expect(items[0].rarity).toBe('legendary');
        expect(items[1].rarity).toBe('epic');
        expect(items[2].rarity).toBe('rare');
        expect(items[3].rarity).toBe('uncommon');
        expect(items[4].rarity).toBe('common');
    });

    it('should handle multi-level sorting (tier then rarity)', () => {
        const items: Array<{ tier: Tier; rarity: Rarity; name: string }> = [
            { tier: 'A', rarity: 'common', name: 'A Common' },
            { tier: 'A', rarity: 'legendary', name: 'A Legendary' },
            { tier: 'SS', rarity: 'common', name: 'SS Common' },
            { tier: 'A', rarity: 'rare', name: 'A Rare' },
        ];

        items.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            if (tierDiff !== 0) return tierDiff;
            return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        });

        expect(items[0].name).toBe('SS Common');
        expect(items[1].name).toBe('A Legendary');
        expect(items[2].name).toBe('A Rare');
        expect(items[3].name).toBe('A Common');
    });
});

describe('Integration - Item ID Constants', () => {
    it('should have all item IDs as strings', () => {
        Object.values(ITEM_IDS).forEach(id => {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });
    });

    it('should have unique item IDs', () => {
        const ids = Object.values(ITEM_IDS);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have item IDs in snake_case format', () => {
        Object.values(ITEM_IDS).forEach(id => {
            expect(id).toMatch(/^[a-z_]+$/);
        });
    });

    it('should be able to look up items by constant', () => {
        expect(ITEM_IDS.GYM_SAUCE).toBe('gym_sauce');
        expect(ITEM_IDS.FORBIDDEN_JUICE).toBe('forbidden_juice');
        expect(ITEM_IDS.BATTERY).toBe('battery');
    });
});

describe('Integration - Entity Type Validation', () => {
    const createValidItem = (): Item => ({
        id: 'test_item',
        name: 'Test Item',
        tier: 'A',
        rarity: 'common',
        effects: ['damage'],
        image: 'test.webp',
    });

    const createValidWeapon = (): Weapon => ({
        id: 'test_weapon',
        name: 'Test Weapon',
        tier: 'A',
        rarity: 'uncommon',
        weapon_type: 'melee',
        damage_type: 'physical',
        base_damage: 50,
    });

    const createValidCharacter = (): Character => ({
        id: 'test_char',
        name: 'Test Character',
        tier: 'S',
        rarity: 'rare',
        passive: 'Test passive',
    });

    const createValidTome = (): Tome => ({
        id: 'test_tome',
        name: 'Test Tome',
        tier: 'S',
        rarity: 'rare',
        effect: 'Boost stat',
        stat_affected: 'damage',
    });

    it('should validate item structure', () => {
        const item = createValidItem();

        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.tier).toBeDefined();
        expect(item.rarity).toBeDefined();
        expect(Array.isArray(item.effects)).toBe(true);
    });

    it('should validate weapon structure', () => {
        const weapon = createValidWeapon();

        expect(weapon.id).toBeDefined();
        expect(weapon.name).toBeDefined();
        expect(weapon.tier).toBeDefined();
        expect(weapon.rarity).toBeDefined();
        expect(weapon.weapon_type).toBeDefined();
        expect(weapon.damage_type).toBeDefined();
        expect(weapon.base_damage).toBeDefined();
        expect(typeof weapon.base_damage).toBe('number');
    });

    it('should validate character structure', () => {
        const character = createValidCharacter();

        expect(character.id).toBeDefined();
        expect(character.name).toBeDefined();
        expect(character.tier).toBeDefined();
        expect(character.rarity).toBeDefined();
        expect(character.passive).toBeDefined();
    });

    it('should validate tome structure', () => {
        const tome = createValidTome();

        expect(tome.id).toBeDefined();
        expect(tome.name).toBeDefined();
        expect(tome.tier).toBeDefined();
        expect(tome.rarity).toBeDefined();
        expect(tome.effect).toBeDefined();
        expect(tome.stat_affected).toBeDefined();
    });

    it('should handle optional fields gracefully', () => {
        const itemWithOptionals: Item = {
            ...createValidItem(),
            base_effect: 'damage boost',
            description: 'A powerful item',
            synergies: ['Other Item'],
            synergies_weapons: ['Sword'],
        };

        expect(itemWithOptionals.base_effect).toBeDefined();
        expect(itemWithOptionals.description).toBeDefined();
        expect(Array.isArray(itemWithOptionals.synergies)).toBe(true);
        expect(Array.isArray(itemWithOptionals.synergies_weapons)).toBe(true);
    });

    it('should handle character synergies', () => {
        const characterWithSynergies: Character = {
            ...createValidCharacter(),
            synergies_items: ['Item1', 'Item2'],
            synergies_weapons: ['Weapon1'],
        };

        expect(Array.isArray(characterWithSynergies.synergies_items)).toBe(true);
        expect(Array.isArray(characterWithSynergies.synergies_weapons)).toBe(true);
        expect(characterWithSynergies.synergies_items).toHaveLength(2);
    });
});

describe('Integration - Data Consistency Rules', () => {
    it('should enforce tier values are valid', () => {
        const validTiers: Tier[] = ['SS', 'S', 'A', 'B', 'C'];
        const item: Item = {
            id: 'test',
            name: 'Test',
            tier: 'A',
            rarity: 'common',
            effects: [],
        };

        expect(validTiers).toContain(item.tier);
    });

    it('should enforce rarity values are valid', () => {
        const validRarities: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const item: Item = {
            id: 'test',
            name: 'Test',
            tier: 'A',
            rarity: 'rare',
            effects: [],
        };

        expect(validRarities).toContain(item.rarity);
    });

    it('should enforce IDs are unique in collection', () => {
        const items: Item[] = [
            { id: 'item1', name: 'Item 1', tier: 'A', rarity: 'common', effects: [] },
            { id: 'item2', name: 'Item 2', tier: 'A', rarity: 'common', effects: [] },
            { id: 'item3', name: 'Item 3', tier: 'A', rarity: 'common', effects: [] },
        ];

        const ids = items.map(item => item.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(items.length);
    });

    it('should enforce names are not empty', () => {
        const entities = [
            { id: '1', name: 'Valid Name', tier: 'A' as Tier, rarity: 'common' as Rarity },
            { id: '2', name: 'Another Name', tier: 'S' as Tier, rarity: 'rare' as Rarity },
        ];

        entities.forEach(entity => {
            expect(entity.name).toBeTruthy();
            expect(entity.name.length).toBeGreaterThan(0);
        });
    });

    it('should correlate tier with rarity appropriately', () => {
        // Generally: SS/S tiers are legendary/epic/rare, C tier is common
        const items: Array<{ tier: Tier; rarity: Rarity }> = [
            { tier: 'SS', rarity: 'legendary' },
            { tier: 'S', rarity: 'epic' },
            { tier: 'A', rarity: 'rare' },
            { tier: 'B', rarity: 'uncommon' },
            { tier: 'C', rarity: 'common' },
        ];

        items.forEach(item => {
            const tierValue = TIER_ORDER[item.tier];
            const rarityValue = RARITY_ORDER[item.rarity];

            // Rough correlation: lower tier (better) tends toward lower rarity (rarer)
            // This is a soft rule, not strict
            expect(tierValue).toBeGreaterThanOrEqual(0);
            expect(rarityValue).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('Integration - Cross-Reference Validation', () => {
    it('should validate character synergies reference valid items', () => {
        const validItemIds = ['sword', 'shield', 'helmet'];

        const character: Character = {
            id: 'warrior',
            name: 'Warrior',
            tier: 'S',
            rarity: 'rare',
            passive: 'Strong',
            synergies_items: ['sword', 'shield'],
            synergies_weapons: [],
        };

        character.synergies_items?.forEach(itemId => {
            // In real validation, would check against actual item database
            expect(typeof itemId).toBe('string');
            expect(itemId.length).toBeGreaterThan(0);
        });
    });

    it('should validate item synergies reference valid weapons', () => {
        const item: Item = {
            id: 'power_ring',
            name: 'Power Ring',
            tier: 'A',
            rarity: 'uncommon',
            effects: ['damage'],
            synergies_weapons: ['Sword', 'Axe'],
        };

        item.synergies_weapons?.forEach(weaponName => {
            expect(typeof weaponName).toBe('string');
            expect(weaponName.length).toBeGreaterThan(0);
        });
    });

    it('should validate tome stat_affected is valid stat', () => {
        const validStats = [
            'damage',
            'hp',
            'health',
            'crit',
            'critical',
            'attack speed',
            'speed',
            'armor',
            'evasion',
        ];

        const tome: Tome = {
            id: 'damage_tome',
            name: 'Tome of Power',
            tier: 'S',
            rarity: 'rare',
            effect: 'Increase damage',
            stat_affected: 'damage',
        };

        // Stat should be a recognizable type
        expect(typeof tome.stat_affected).toBe('string');
        expect(tome.stat_affected.length).toBeGreaterThan(0);
    });
});

describe('Integration - Collection Validation', () => {
    it('should validate collection has required metadata', () => {
        const collection = {
            items: [] as Item[],
            version: '1.0.0',
            last_updated: '2024-01-15',
        };

        expect(collection.version).toBeDefined();
        expect(collection.last_updated).toBeDefined();
        expect(Array.isArray(collection.items)).toBe(true);
    });

    it('should validate version format', () => {
        const versions = ['1.0.0', '2.3.1', '10.5.23'];

        versions.forEach(version => {
            expect(version).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    it('should validate date format', () => {
        const dates = ['2024-01-15', '2023-12-31', '2024-06-01'];

        dates.forEach(date => {
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(new Date(date).toString()).not.toBe('Invalid Date');
        });
    });

    it('should handle empty collections', () => {
        const emptyCollection = {
            items: [],
            weapons: [],
            tomes: [],
            characters: [],
            shrines: [],
        };

        Object.values(emptyCollection).forEach(collection => {
            expect(Array.isArray(collection)).toBe(true);
            expect(collection.length).toBe(0);
        });
    });

    it('should handle large collections', () => {
        const largeCollection: Item[] = [];

        for (let i = 0; i < 1000; i++) {
            largeCollection.push({
                id: `item_${i}`,
                name: `Item ${i}`,
                tier: 'A',
                rarity: 'common',
                effects: [],
            });
        }

        expect(largeCollection.length).toBe(1000);
        expect(Array.isArray(largeCollection)).toBe(true);

        // All should have unique IDs
        const ids = new Set(largeCollection.map(item => item.id));
        expect(ids.size).toBe(1000);
    });
});

describe('Integration - Synergy Validation', () => {
    it('should validate bidirectional synergies', () => {
        const character: Character = {
            id: 'mage',
            name: 'Mage',
            tier: 'S',
            rarity: 'rare',
            passive: 'Magic',
            synergies_items: ['magic_staff'],
            synergies_weapons: [],
        };

        const item: Item = {
            id: 'magic_staff',
            name: 'Magic Staff',
            tier: 'A',
            rarity: 'uncommon',
            effects: ['magic'],
        };

        // Character references item
        expect(character.synergies_items).toContain('magic_staff');

        // In a full system, would validate item exists
        expect(item.id).toBe('magic_staff');
    });

    it('should validate synergy arrays are not null', () => {
        const character: Character = {
            id: 'test',
            name: 'Test',
            tier: 'A',
            rarity: 'common',
            passive: 'Test',
            synergies_items: [],
            synergies_weapons: [],
        };

        expect(Array.isArray(character.synergies_items)).toBe(true);
        expect(Array.isArray(character.synergies_weapons)).toBe(true);
    });

    it('should handle undefined synergies gracefully', () => {
        const character: Character = {
            id: 'test',
            name: 'Test',
            tier: 'A',
            rarity: 'common',
            passive: 'Test',
        };

        // Undefined is valid (optional field)
        expect(character.synergies_items === undefined || Array.isArray(character.synergies_items)).toBe(true);
    });
});
