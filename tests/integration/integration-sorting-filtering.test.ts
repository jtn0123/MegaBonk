/**
 * Integration Tests - Sorting and Filtering
 * Testing how sorting, filtering, and search work together across modules
 */

import { describe, it, expect } from 'vitest';
import { TIER_ORDER, RARITY_ORDER } from '../../src/modules/constants';
import type { Item, Weapon, Character, Tier, Rarity } from '../../src/types';

describe('Integration - Multi-Level Sorting', () => {
    const createItem = (name: string, tier: Tier, rarity: Rarity): Item => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        tier,
        rarity,
        effects: [],
    });

    it('should sort by tier ascending (SS first)', () => {
        const items = [
            createItem('Item C', 'C', 'common'),
            createItem('Item SS', 'SS', 'legendary'),
            createItem('Item A', 'A', 'uncommon'),
            createItem('Item B', 'B', 'common'),
            createItem('Item S', 'S', 'rare'),
        ];

        items.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

        expect(items.map(i => i.tier)).toEqual(['SS', 'S', 'A', 'B', 'C']);
    });

    it('should sort by tier descending (C first)', () => {
        const items = [
            createItem('Item C', 'C', 'common'),
            createItem('Item SS', 'SS', 'legendary'),
            createItem('Item A', 'A', 'uncommon'),
        ];

        items.sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier]);

        expect(items.map(i => i.tier)).toEqual(['C', 'A', 'SS']);
    });

    it('should sort by rarity ascending (legendary first)', () => {
        const items = [
            createItem('Common', 'A', 'common'),
            createItem('Legendary', 'A', 'legendary'),
            createItem('Rare', 'A', 'rare'),
            createItem('Epic', 'A', 'epic'),
            createItem('Uncommon', 'A', 'uncommon'),
        ];

        items.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

        expect(items.map(i => i.rarity)).toEqual(['legendary', 'epic', 'rare', 'uncommon', 'common']);
    });

    it('should sort by tier then rarity', () => {
        const items = [
            createItem('A Common', 'A', 'common'),
            createItem('A Legendary', 'A', 'legendary'),
            createItem('SS Common', 'SS', 'common'),
            createItem('SS Legendary', 'SS', 'legendary'),
            createItem('A Rare', 'A', 'rare'),
        ];

        items.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            if (tierDiff !== 0) return tierDiff;
            return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        });

        expect(items.map(i => i.name)).toEqual([
            'SS Legendary',
            'SS Common',
            'A Legendary',
            'A Rare',
            'A Common',
        ]);
    });

    it('should sort by tier then name alphabetically', () => {
        const items = [
            createItem('Zebra', 'A', 'common'),
            createItem('Apple', 'A', 'common'),
            createItem('Mango', 'SS', 'legendary'),
            createItem('Banana', 'SS', 'legendary'),
        ];

        items.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            if (tierDiff !== 0) return tierDiff;
            return a.name.localeCompare(b.name);
        });

        expect(items.map(i => i.name)).toEqual(['Banana', 'Mango', 'Apple', 'Zebra']);
    });

    it('should sort by multiple criteria with weights', () => {
        const items = [
            createItem('Item 1', 'B', 'rare'),
            createItem('Item 2', 'A', 'common'),
            createItem('Item 3', 'A', 'legendary'),
            createItem('Item 4', 'SS', 'common'),
        ];

        // Custom score: lower is better
        items.sort((a, b) => {
            const scoreA = TIER_ORDER[a.tier] * 100 + RARITY_ORDER[a.rarity];
            const scoreB = TIER_ORDER[b.tier] * 100 + RARITY_ORDER[b.rarity];
            return scoreA - scoreB;
        });

        expect(items[0].name).toBe('Item 4'); // SS common (0*100 + 4 = 4)
        expect(items[1].name).toBe('Item 3'); // A legendary (2*100 + 0 = 200)
        expect(items[2].name).toBe('Item 2'); // A common (2*100 + 4 = 204)
        expect(items[3].name).toBe('Item 1'); // B rare (3*100 + 2 = 302)
    });
});

describe('Integration - Filtering and Sorting Combined', () => {
    const createItem = (name: string, tier: Tier, rarity: Rarity, effects: string[]): Item => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        tier,
        rarity,
        effects,
    });

    it('should filter by tier then sort by rarity', () => {
        const items = [
            createItem('S Common', 'S', 'common', ['damage']),
            createItem('A Rare', 'A', 'rare', ['damage']),
            createItem('S Legendary', 'S', 'legendary', ['hp']),
            createItem('A Common', 'A', 'common', ['damage']),
            createItem('S Rare', 'S', 'rare', ['crit']),
        ];

        // Filter for S tier
        const filtered = items.filter(item => item.tier === 'S');

        // Sort by rarity
        filtered.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

        expect(filtered).toHaveLength(3);
        expect(filtered.map(i => i.name)).toEqual(['S Legendary', 'S Rare', 'S Common']);
    });

    it('should filter by effects then sort by tier', () => {
        const items = [
            createItem('Item 1', 'C', 'common', ['damage']),
            createItem('Item 2', 'SS', 'legendary', ['hp']),
            createItem('Item 3', 'A', 'rare', ['damage']),
            createItem('Item 4', 'S', 'epic', ['damage']),
            createItem('Item 5', 'B', 'uncommon', ['crit']),
        ];

        // Filter for damage items
        const filtered = items.filter(item => item.effects.includes('damage'));

        // Sort by tier
        filtered.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

        expect(filtered).toHaveLength(3);
        expect(filtered.map(i => i.tier)).toEqual(['S', 'A', 'C']);
    });

    it('should apply multiple filters and sort', () => {
        const items = [
            createItem('Item 1', 'SS', 'legendary', ['damage']),
            createItem('Item 2', 'S', 'rare', ['damage', 'crit']),
            createItem('Item 3', 'A', 'rare', ['hp']),
            createItem('Item 4', 'S', 'legendary', ['damage']),
            createItem('Item 5', 'SS', 'rare', ['damage']),
        ];

        // Filter for S or SS tier AND damage effect
        const filtered = items.filter(
            item => (item.tier === 'S' || item.tier === 'SS') && item.effects.includes('damage')
        );

        // Sort by tier then rarity
        filtered.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            if (tierDiff !== 0) return tierDiff;
            return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        });

        expect(filtered).toHaveLength(4);
        expect(filtered[0].name).toBe('Item 1'); // SS legendary
        expect(filtered[1].name).toBe('Item 5'); // SS rare
    });
});

describe('Integration - Search and Filter Combined', () => {
    const createItem = (name: string, tier: Tier, rarity: Rarity, description?: string): Item => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        tier,
        rarity,
        effects: [],
        description,
    });

    it('should search by name then filter by tier', () => {
        const items = [
            createItem('Fire Sword', 'SS', 'legendary'),
            createItem('Fire Shield', 'A', 'rare'),
            createItem('Ice Sword', 'S', 'epic'),
            createItem('Fire Staff', 'S', 'rare'),
            createItem('Water Sword', 'B', 'common'),
        ];

        // Search for "Fire"
        const searched = items.filter(item => item.name.toLowerCase().includes('fire'));

        // Filter for S or SS tier
        const filtered = searched.filter(item => item.tier === 'S' || item.tier === 'SS');

        expect(filtered).toHaveLength(2);
        expect(filtered.map(i => i.name)).toEqual(['Fire Sword', 'Fire Staff']);
    });

    it('should search across multiple fields', () => {
        const items = [
            createItem('Sword', 'A', 'rare', 'A powerful weapon'),
            createItem('Shield', 'A', 'rare', 'Provides defense'),
            createItem('Staff', 'A', 'rare', 'Magic weapon for casters'),
            createItem('Bow', 'A', 'rare', 'Ranged weapon'),
        ];

        // Search for "weapon" in name or description
        const searched = items.filter(
            item =>
                item.name.toLowerCase().includes('weapon') ||
                item.description?.toLowerCase().includes('weapon')
        );

        expect(searched).toHaveLength(3);
        expect(searched.map(i => i.name)).toEqual(['Sword', 'Staff', 'Bow']);
    });

    it('should support case-insensitive search', () => {
        const items = [
            createItem('FIRE SWORD', 'A', 'rare'),
            createItem('fire shield', 'A', 'rare'),
            createItem('Fire Staff', 'A', 'rare'),
            createItem('ICE BLADE', 'A', 'rare'),
        ];

        const searchTerm = 'fire';
        const searched = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

        expect(searched).toHaveLength(3);
    });

    it('should support partial word matching', () => {
        const items = [
            createItem('Fireball', 'A', 'rare'),
            createItem('Fireproof Armor', 'A', 'rare'),
            createItem('Ice Spell', 'A', 'rare'),
            createItem('Wildfire Cloak', 'A', 'rare'),
        ];

        const searched = items.filter(item => item.name.toLowerCase().includes('fire'));

        expect(searched).toHaveLength(3);
        expect(searched.map(i => i.name)).toEqual(['Fireball', 'Fireproof Armor', 'Wildfire Cloak']);
    });
});

describe('Integration - Pagination with Sorting', () => {
    const createItem = (index: number): Item => ({
        id: `item_${index}`,
        name: `Item ${index}`,
        tier: (['SS', 'S', 'A', 'B', 'C'] as Tier[])[index % 5],
        rarity: 'common',
        effects: [],
    });

    it('should paginate sorted results', () => {
        const items: Item[] = [];
        for (let i = 0; i < 50; i++) {
            items.push(createItem(i));
        }

        // Sort by tier
        items.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

        // Page 1 (first 10)
        const page1 = items.slice(0, 10);
        expect(page1).toHaveLength(10);
        expect(page1.every(item => item.tier === 'SS' || item.tier === 'S')).toBe(true);

        // Page 2 (next 10)
        const page2 = items.slice(10, 20);
        expect(page2).toHaveLength(10);

        // Page 5 (last 10)
        const page5 = items.slice(40, 50);
        expect(page5).toHaveLength(10);
    });

    it('should handle last page with fewer items', () => {
        const items: Item[] = [];
        for (let i = 0; i < 47; i++) {
            items.push(createItem(i));
        }

        const pageSize = 10;
        const lastPageStart = Math.floor(items.length / pageSize) * pageSize;
        const lastPage = items.slice(lastPageStart);

        expect(lastPage).toHaveLength(7);
    });

    it('should maintain sort order across pages', () => {
        const items: Item[] = [];
        for (let i = 0; i < 30; i++) {
            items.push(createItem(i));
        }

        items.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

        const page1 = items.slice(0, 10);
        const page2 = items.slice(10, 20);
        const page3 = items.slice(20, 30);

        // Last item of page 1 should be <= first item of page 2
        const lastOfPage1 = page1[page1.length - 1];
        const firstOfPage2 = page2[0];
        expect(TIER_ORDER[lastOfPage1.tier]).toBeLessThanOrEqual(TIER_ORDER[firstOfPage2.tier]);

        // Last item of page 2 should be <= first item of page 3
        const lastOfPage2 = page2[page2.length - 1];
        const firstOfPage3 = page3[0];
        expect(TIER_ORDER[lastOfPage2.tier]).toBeLessThanOrEqual(TIER_ORDER[firstOfPage3.tier]);
    });
});

describe('Integration - Complex Entity Sorting', () => {
    it('should sort weapons by damage then tier', () => {
        const weapons: Weapon[] = [
            {
                id: 'w1',
                name: 'Weak Sword',
                tier: 'C',
                rarity: 'common',
                weapon_type: 'melee',
                damage_type: 'physical',
                base_damage: 30,
            },
            {
                id: 'w2',
                name: 'Strong Axe',
                tier: 'SS',
                rarity: 'legendary',
                weapon_type: 'melee',
                damage_type: 'physical',
                base_damage: 80,
            },
            {
                id: 'w3',
                name: 'Medium Sword',
                tier: 'A',
                rarity: 'uncommon',
                weapon_type: 'melee',
                damage_type: 'physical',
                base_damage: 50,
            },
            {
                id: 'w4',
                name: 'Strong Dagger',
                tier: 'B',
                rarity: 'common',
                weapon_type: 'melee',
                damage_type: 'physical',
                base_damage: 80,
            },
        ];

        // Sort by damage descending, then tier ascending
        weapons.sort((a, b) => {
            const damageDiff = b.base_damage - a.base_damage;
            if (damageDiff !== 0) return damageDiff;
            return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
        });

        expect(weapons[0].name).toBe('Strong Axe'); // 80 damage, SS tier
        expect(weapons[1].name).toBe('Strong Dagger'); // 80 damage, B tier
        expect(weapons[2].name).toBe('Medium Sword'); // 50 damage
        expect(weapons[3].name).toBe('Weak Sword'); // 30 damage
    });

    it('should sort characters by tier then name', () => {
        const characters: Character[] = [
            {
                id: 'c1',
                name: 'Zebra Warrior',
                tier: 'S',
                rarity: 'rare',
                passive: 'Strong',
            },
            {
                id: 'c2',
                name: 'Alpha Mage',
                tier: 'SS',
                rarity: 'legendary',
                passive: 'Magic',
            },
            {
                id: 'c3',
                name: 'Beta Rogue',
                tier: 'S',
                rarity: 'rare',
                passive: 'Stealth',
            },
            {
                id: 'c4',
                name: 'Gamma Tank',
                tier: 'A',
                rarity: 'uncommon',
                passive: 'Defense',
            },
        ];

        characters.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            if (tierDiff !== 0) return tierDiff;
            return a.name.localeCompare(b.name);
        });

        expect(characters.map(c => c.name)).toEqual([
            'Alpha Mage',
            'Beta Rogue',
            'Zebra Warrior',
            'Gamma Tank',
        ]);
    });
});

describe('Integration - Dynamic Filtering', () => {
    const createItem = (name: string, tier: Tier, rarity: Rarity, effects: string[]): Item => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        tier,
        rarity,
        effects,
    });

    it('should support dynamic filter combinations', () => {
        const items = [
            createItem('Item 1', 'SS', 'legendary', ['damage', 'crit']),
            createItem('Item 2', 'S', 'rare', ['damage']),
            createItem('Item 3', 'A', 'rare', ['hp', 'armor']),
            createItem('Item 4', 'SS', 'epic', ['damage']),
            createItem('Item 5', 'B', 'common', ['speed']),
        ];

        // Dynamic filters
        const filters = {
            tiers: ['SS', 'S'] as Tier[],
            rarities: ['legendary', 'epic'] as Rarity[],
            effects: ['damage'],
        };

        const filtered = items.filter(
            item =>
                filters.tiers.includes(item.tier) &&
                filters.rarities.includes(item.rarity) &&
                item.effects.some(effect => filters.effects.includes(effect))
        );

        expect(filtered).toHaveLength(2);
        expect(filtered.map(i => i.name)).toEqual(['Item 1', 'Item 4']);
    });

    it('should support OR filtering for effects', () => {
        const items = [
            createItem('Item 1', 'A', 'common', ['damage']),
            createItem('Item 2', 'A', 'common', ['hp']),
            createItem('Item 3', 'A', 'common', ['crit']),
            createItem('Item 4', 'A', 'common', ['damage', 'crit']),
            createItem('Item 5', 'A', 'common', ['speed']),
        ];

        const wantedEffects = ['damage', 'crit'];

        // Filter items that have ANY of the wanted effects
        const filtered = items.filter(item =>
            item.effects.some(effect => wantedEffects.includes(effect))
        );

        expect(filtered).toHaveLength(3);
        expect(filtered.map(i => i.name)).toEqual(['Item 1', 'Item 3', 'Item 4']);
    });

    it('should support AND filtering for effects', () => {
        const items = [
            createItem('Item 1', 'A', 'common', ['damage']),
            createItem('Item 2', 'A', 'common', ['damage', 'crit']),
            createItem('Item 3', 'A', 'common', ['damage', 'crit', 'hp']),
            createItem('Item 4', 'A', 'common', ['crit']),
        ];

        const requiredEffects = ['damage', 'crit'];

        // Filter items that have ALL required effects
        const filtered = items.filter(item =>
            requiredEffects.every(effect => item.effects.includes(effect))
        );

        expect(filtered).toHaveLength(2);
        expect(filtered.map(i => i.name)).toEqual(['Item 2', 'Item 3']);
    });
});
