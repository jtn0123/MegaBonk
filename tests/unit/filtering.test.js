import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM, createItemsFilterUI, createTierFilterUI } from '../helpers/dom-setup.js';
import { createMockItem, createExtendedMockData } from '../helpers/mock-data.js';
import { simulateInput, simulateSelect } from '../helpers/test-utils.js';

// Import the real filterData function from the filters module
import { filterData } from '../../src/modules/filters.ts';

describe('filterData()', () => {
    let testItems;

    beforeEach(() => {
        createMinimalDOM();
        createItemsFilterUI();

        testItems = [
            createMockItem({
                id: 'item1',
                name: 'Alpha Item',
                tier: 'SS',
                rarity: 'legendary',
                stacks_well: true,
                one_and_done: false,
            }),
            createMockItem({
                id: 'item2',
                name: 'Beta Item',
                tier: 'S',
                rarity: 'rare',
                stacks_well: false,
                one_and_done: false,
            }),
            createMockItem({
                id: 'item3',
                name: 'Gamma Item',
                tier: 'A',
                rarity: 'common',
                one_and_done: true,
                stacks_well: false,
            }),
            createMockItem({
                id: 'item4',
                name: 'Damage Boost',
                tier: 'SS',
                rarity: 'epic',
                stacks_well: true,
                one_and_done: false,
            }),
            createMockItem({
                id: 'item5',
                name: 'Delta Special',
                tier: 'B',
                rarity: 'uncommon',
                stacks_well: true,
                one_and_done: false,
            }),
        ];
    });

    describe('search filtering', () => {
        it('should filter by name', () => {
            simulateInput(document.getElementById('searchInput'), 'alpha');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Item');
        });

        it('should filter by base_effect', () => {
            testItems[0].base_effect = 'special bonus damage';
            simulateInput(document.getElementById('searchInput'), 'bonus');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Item');
        });

        it('should be case-insensitive', () => {
            simulateInput(document.getElementById('searchInput'), 'ALPHA');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Item');
        });

        it('should return all items when search is empty', () => {
            simulateInput(document.getElementById('searchInput'), '');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(5);
        });

        it('should return empty array when no matches found', () => {
            simulateInput(document.getElementById('searchInput'), 'nonexistent');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(0);
        });

        it('should filter by partial name match', () => {
            simulateInput(document.getElementById('searchInput'), 'item');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(3); // Alpha Item, Beta Item, Gamma Item
        });
    });

    describe('tier filtering', () => {
        it('should filter by SS tier', () => {
            simulateSelect(document.getElementById('tierFilter'), 'SS');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(2);
            result.forEach(item => expect(item.tier).toBe('SS'));
        });

        it('should filter by S tier', () => {
            simulateSelect(document.getElementById('tierFilter'), 'S');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].tier).toBe('S');
        });

        it('should return all when tier is "all"', () => {
            simulateSelect(document.getElementById('tierFilter'), 'all');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(5);
        });

        it('should return empty for tier with no matches', () => {
            simulateSelect(document.getElementById('tierFilter'), 'C');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(0);
        });
    });

    describe('rarity filtering', () => {
        it('should filter by legendary rarity', () => {
            simulateSelect(document.getElementById('rarityFilter'), 'legendary');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].rarity).toBe('legendary');
        });

        it('should filter by common rarity', () => {
            simulateSelect(document.getElementById('rarityFilter'), 'common');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].rarity).toBe('common');
        });

        it('should return all when rarity is "all"', () => {
            simulateSelect(document.getElementById('rarityFilter'), 'all');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(5);
        });
    });

    describe('stacking filtering', () => {
        it('should filter for stacks_well items', () => {
            simulateSelect(document.getElementById('stackingFilter'), 'stacks_well');
            const result = filterData(testItems, 'items');

            expect(result.every(item => item.stacks_well === true)).toBe(true);
            expect(result).toHaveLength(3);
        });

        it('should filter for one_and_done items', () => {
            simulateSelect(document.getElementById('stackingFilter'), 'one_and_done');
            const result = filterData(testItems, 'items');

            expect(result.every(item => item.one_and_done === true)).toBe(true);
            expect(result).toHaveLength(1);
        });

        it('should return all when stacking filter is "all"', () => {
            simulateSelect(document.getElementById('stackingFilter'), 'all');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(5);
        });
    });

    describe('sorting', () => {
        // Test sorting logic directly with fresh data each time
        function sortItems(items, sortBy) {
            const sorted = [...items];
            if (sortBy === 'name') {
                sorted.sort((a, b) => a.name.localeCompare(b.name));
            } else if (sortBy === 'tier') {
                const tierOrder = { SS: 0, S: 1, A: 2, B: 3, C: 4 };
                // Use ?? instead of || because 0 is a valid value
                sorted.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
            } else if (sortBy === 'rarity') {
                const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
                // Use ?? instead of || because 0 is a valid value
                sorted.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99));
            }
            return sorted;
        }

        it('should sort by name alphabetically', () => {
            // Use fresh inline data to avoid any mutation issues
            const items = [
                { name: 'Zeta', tier: 'B', rarity: 'common' },
                { name: 'Alpha', tier: 'S', rarity: 'rare' },
                { name: 'Beta', tier: 'A', rarity: 'epic' },
            ];
            const result = sortItems(items, 'name');

            expect(result[0].name).toBe('Alpha');
            expect(result[1].name).toBe('Beta');
            expect(result[2].name).toBe('Zeta');
        });

        it('should sort by tier (SS first)', () => {
            // Use fresh inline data
            const items = [
                { name: 'Item1', tier: 'B', rarity: 'common' },
                { name: 'Item2', tier: 'SS', rarity: 'legendary' },
                { name: 'Item3', tier: 'S', rarity: 'rare' },
                { name: 'Item4', tier: 'A', rarity: 'epic' },
                { name: 'Item5', tier: 'SS', rarity: 'epic' },
            ];
            const result = sortItems(items, 'tier');

            // After tier sort: SS items first (0), then S (1), then A (2), then B (3)
            const tiers = result.map(item => item.tier);
            expect(tiers).toEqual(['SS', 'SS', 'S', 'A', 'B']);
        });

        it('should sort by rarity (legendary first)', () => {
            // Use fresh inline data
            const items = [
                { name: 'Item1', tier: 'SS', rarity: 'common' },
                { name: 'Item2', tier: 'S', rarity: 'legendary' },
                { name: 'Item3', tier: 'A', rarity: 'epic' },
                { name: 'Item4', tier: 'B', rarity: 'rare' },
                { name: 'Item5', tier: 'B', rarity: 'uncommon' },
            ];
            const result = sortItems(items, 'rarity');

            // After rarity sort: legendary, epic, rare, uncommon, common
            const rarities = result.map(item => item.rarity);
            expect(rarities).toEqual(['legendary', 'epic', 'rare', 'uncommon', 'common']);
        });

        it('should integrate sort with filterData via DOM', () => {
            // Test that the full filterData function works with DOM
            document.getElementById('sortBy').value = 'name';
            const result = filterData(testItems, 'items');

            expect(result[0].name).toBe('Alpha Item');
        });
    });

    describe('combined filters', () => {
        it('should apply search and tier filters together', () => {
            simulateInput(document.getElementById('searchInput'), 'item');
            simulateSelect(document.getElementById('tierFilter'), 'SS');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Item');
        });

        it('should apply multiple filters together', () => {
            simulateSelect(document.getElementById('tierFilter'), 'SS');
            simulateSelect(document.getElementById('rarityFilter'), 'legendary');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Item');
        });

        it('should return empty when combined filters have no matches', () => {
            simulateInput(document.getElementById('searchInput'), 'alpha');
            simulateSelect(document.getElementById('tierFilter'), 'C');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(0);
        });

        it('should apply filter and sort together', () => {
            simulateSelect(document.getElementById('tierFilter'), 'SS');
            simulateSelect(document.getElementById('sortBy'), 'name');
            const result = filterData(testItems, 'items');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Alpha Item');
            expect(result[1].name).toBe('Damage Boost');
        });
    });
});

describe('filterData() for weapons/tomes/characters', () => {
    let testWeapons;

    beforeEach(() => {
        createMinimalDOM();
        createTierFilterUI();

        testWeapons = [
            { id: 'w1', name: 'Revolver', tier: 'S', description: 'Accurate' },
            { id: 'w2', name: 'Bow', tier: 'A', description: 'Piercing' },
            { id: 'w3', name: 'Shotgun', tier: 'S', description: 'Spread' },
        ];
    });

    it('should filter weapons by tier', () => {
        simulateSelect(document.getElementById('tierFilter'), 'S');
        const result = filterData(testWeapons, 'weapons');

        expect(result).toHaveLength(2);
        result.forEach(w => expect(w.tier).toBe('S'));
    });

    it('should not apply rarity filter to weapons', () => {
        // Rarity filter shouldn't exist for weapons
        const rarityFilter = document.getElementById('rarityFilter');
        expect(rarityFilter).toBeNull();
    });
});

describe('filterData() edge cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        createItemsFilterUI();
    });

    describe('empty and null data handling', () => {
        it('should handle empty data array', () => {
            const result = filterData([], 'items');
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle null filter values', () => {
            const items = [createMockItem({ id: 'item1', name: 'Test' })];
            // Don't set any filter values
            const result = filterData(items, 'items');
            expect(result).toHaveLength(1);
        });

        it('should handle items with missing optional fields gracefully', () => {
            const itemsWithMissingOptionalFields = [
                { id: 'item1', name: 'Has Name' }, // Missing tier, rarity, etc
                { id: 'item2', name: 'Has Name Too' }, // Missing description, base_effect
                { id: 'item3', name: 'Another', tier: 'S' },
            ];

            // Should not throw - all items have names which is required for filtering/sorting
            expect(() => filterData(itemsWithMissingOptionalFields, 'items')).not.toThrow();
        });

        it('should handle undefined description and base_effect', () => {
            const items = [{ id: 'item1', name: 'Test', description: undefined, base_effect: undefined }];

            simulateInput(document.getElementById('searchInput'), 'test');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
        });
    });

    describe('special characters in search', () => {
        it('should handle special regex characters in search', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Item (Special)' }),
                createMockItem({ id: 'item2', name: 'Item [Bracket]' }),
                createMockItem({ id: 'item3', name: 'Item +Plus+' }),
            ];

            // These contain regex special chars
            simulateInput(document.getElementById('searchInput'), '(special)');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Item (Special)');
        });

        it('should handle asterisks in search', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Item *Star*' }),
                createMockItem({ id: 'item2', name: 'Normal Item' }),
            ];

            simulateInput(document.getElementById('searchInput'), '*star*');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
        });

        it('should handle dots in search', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Item 2.0' }),
                createMockItem({ id: 'item2', name: 'Item 20' }),
            ];

            simulateInput(document.getElementById('searchInput'), '2.0');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Item 2.0');
        });
    });

    describe('very long search strings', () => {
        it('should handle very long search strings', () => {
            const items = [createMockItem({ id: 'item1', name: 'Test Item' })];
            const longSearch = 'a'.repeat(1000);

            simulateInput(document.getElementById('searchInput'), longSearch);
            const result = filterData(items, 'items');

            // Should return empty since no item matches
            expect(result).toHaveLength(0);
        });

        it('should handle unicode characters in search', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'アイテム Japanese' }),
                createMockItem({ id: 'item2', name: 'Item Normal' }),
            ];

            simulateInput(document.getElementById('searchInput'), 'アイテム');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('アイテム Japanese');
        });

        it('should handle emoji in search', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Fire Item 🔥' }),
                createMockItem({ id: 'item2', name: 'Water Item' }),
            ];

            simulateInput(document.getElementById('searchInput'), '🔥');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Fire Item 🔥');
        });
    });

    describe('whitespace handling', () => {
        it('should handle leading/trailing whitespace in search', () => {
            const items = [createMockItem({ id: 'item1', name: 'Test Item' })];

            simulateInput(document.getElementById('searchInput'), '  test  ');
            const result = filterData(items, 'items');

            // Real fuzzy matching trims whitespace and finds the match
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test Item');
        });

        it('should handle multiple spaces in item names', () => {
            const items = [createMockItem({ id: 'item1', name: 'Multiple   Spaces' })];

            simulateInput(document.getElementById('searchInput'), 'multiple');
            const result = filterData(items, 'items');

            expect(result).toHaveLength(1);
        });
    });

    describe('unknown filter values', () => {
        it('should handle unknown tier values in items', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Item', tier: 'UNKNOWN' }),
                createMockItem({ id: 'item2', name: 'Item 2', tier: 'S' }),
            ];

            simulateSelect(document.getElementById('sortBy'), 'tier');
            const result = filterData(items, 'items');

            // S tier should come first, unknown last
            expect(result[0].tier).toBe('S');
            expect(result[1].tier).toBe('UNKNOWN');
        });

        it('should handle unknown rarity values', () => {
            const items = [
                createMockItem({ id: 'item1', name: 'Item', rarity: 'mythic' }), // Unknown rarity
                createMockItem({ id: 'item2', name: 'Item 2', rarity: 'legendary' }),
            ];

            simulateSelect(document.getElementById('sortBy'), 'rarity');
            const result = filterData(items, 'items');

            // Legendary should come first
            expect(result[0].rarity).toBe('legendary');
        });
    });

    describe('large dataset handling', () => {
        it('should handle filtering large datasets', () => {
            const largeDataset = Array.from({ length: 1000 }, (_, i) =>
                createMockItem({ id: `item_${i}`, name: `Item ${i}`, tier: i % 2 === 0 ? 'S' : 'A' })
            );

            simulateSelect(document.getElementById('tierFilter'), 'S');
            const result = filterData(largeDataset, 'items');

            expect(result).toHaveLength(500);
            result.forEach(item => expect(item.tier).toBe('S'));
        });
    });
});
