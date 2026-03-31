/**
 * Integration: Data loading → filtering → rendering pipeline
 * Tests that data flows correctly through multiple modules
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { globalSearch } from '../../src/modules/global-search.ts';
import { groupBy, filterMap, partition, uniqueBy, countBy } from '../../src/modules/collection-utils.ts';
import type { AllGameData, Item, Weapon } from '../../src/types/index.ts';

const mockItems: Item[] = [
    {
        id: 'sword',
        name: 'Iron Sword',
        description: 'A basic sword',
        tier: 'B',
        rarity: 'common',
        tags: ['melee', 'damage'],
    },
    {
        id: 'shield',
        name: 'Wooden Shield',
        description: 'A basic shield',
        tier: 'C',
        rarity: 'common',
        tags: ['defense'],
    },
    {
        id: 'potion',
        name: 'Health Potion',
        description: 'Restores health',
        tier: 'A',
        rarity: 'uncommon',
        tags: ['healing'],
    },
    {
        id: 'crown',
        name: 'Golden Crown',
        description: 'A legendary crown',
        tier: 'SS',
        rarity: 'legendary',
        tags: ['special'],
    },
    { id: 'ring', name: 'Silver Ring', description: 'Boosts stats', tier: 'S', rarity: 'rare', tags: ['utility'] },
];

const mockWeapons: Weapon[] = [
    { id: 'axe', name: 'Battle Axe', description: 'Heavy hitting', tier: 'A', image: '' },
    { id: 'bow', name: 'Long Bow', description: 'Ranged weapon', tier: 'S', image: '' },
];

const mockData: AllGameData = {
    items: { items: mockItems },
    weapons: { weapons: mockWeapons },
    tomes: { tomes: [] },
    characters: { characters: [] },
    shrines: { shrines: [] },
};

describe('Integration: Data → Filtering → Search Pipeline', () => {
    it('should search across multiple entity types', () => {
        const results = globalSearch('sword', mockData);
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.item.name === 'Iron Sword')).toBe(true);
    });

    it('should return empty for no match', () => {
        expect(globalSearch('zzzznonexistent', mockData)).toHaveLength(0);
    });

    it('should find weapons too', () => {
        const results = globalSearch('axe', mockData);
        expect(results.some(r => r.item.name === 'Battle Axe')).toBe(true);
    });

    it('should group search results by type using collection utils', () => {
        const results = globalSearch('a', mockData); // broad search
        const grouped = groupBy(results, r => r.type);
        expect(grouped instanceof Map).toBe(true);
    });

    it('should filter and transform items through pipeline', () => {
        // Simulate: load items → filter by rarity → extract names
        const rareOrAbove = mockItems.filter(i => ['rare', 'epic', 'legendary'].includes(i.rarity));
        const names = filterMap(rareOrAbove, item => item.name);
        expect(names).toContain('Golden Crown');
        expect(names).toContain('Silver Ring');
        expect(names).not.toContain('Iron Sword');
    });

    it('should partition items into tier groups', () => {
        const [highTier, lowTier] = partition(mockItems, item => ['SS', 'S', 'A'].includes(item.tier));
        expect(highTier.length).toBe(3); // potion(A), crown(SS), ring(S)
        expect(lowTier.length).toBe(2); // sword(B), shield(C)
    });

    it('should count items by rarity', () => {
        const counts = countBy(mockItems, i => i.rarity);
        expect(counts.get('common')).toBe(2);
        expect(counts.get('legendary')).toBe(1);
    });

    it('should deduplicate by id', () => {
        const duped = [...mockItems, ...mockItems];
        const unique = uniqueBy(duped, i => i.id);
        expect(unique).toHaveLength(5);
    });
});
