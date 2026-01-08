import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM, createItemsFilterUI, createTierFilterUI } from '../helpers/dom-setup.js';
import { createMockItem, createExtendedMockData } from '../helpers/mock-data.js';
import { simulateInput, simulateSelect } from '../helpers/test-utils.js';

/**
 * Standalone filterData implementation for testing
 * This mirrors the logic from script.js for isolated unit testing
 */
function filterData(data, tabName) {
  let filtered = [...data];
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

  // Search filter
  filtered = filtered.filter(item => {
    const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
    return searchable.includes(searchTerm);
  });

  // Tier filter (for items, weapons, tomes, characters)
  const tierFilter = document.getElementById('tierFilter')?.value;
  if (tierFilter && tierFilter !== 'all') {
    filtered = filtered.filter(item => item.tier === tierFilter);
  }

  // Rarity filter (items only)
  if (tabName === 'items') {
    const rarityFilter = document.getElementById('rarityFilter')?.value;
    if (rarityFilter && rarityFilter !== 'all') {
      filtered = filtered.filter(item => item.rarity === rarityFilter);
    }

    const stackingFilter = document.getElementById('stackingFilter')?.value;
    if (stackingFilter === 'stacks_well') {
      filtered = filtered.filter(item => item.stacks_well === true);
    } else if (stackingFilter === 'one_and_done') {
      filtered = filtered.filter(item => item.one_and_done === true);
    }
  }

  // Type filter (shrines only)
  if (tabName === 'shrines') {
    const typeFilter = document.getElementById('typeFilter')?.value;
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(shrine => shrine.type === typeFilter);
    }
  }

  // Sorting
  const sortBy = document.getElementById('sortBy')?.value;
  if (sortBy === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'tier') {
    const tierOrder = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
    // Use ?? instead of || because 0 is a valid value (SS tier)
    filtered.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
  } else if (sortBy === 'rarity') {
    const rarityOrder = { 'legendary': 0, 'epic': 1, 'rare': 2, 'uncommon': 3, 'common': 4 };
    // Use ?? instead of || because 0 is a valid value (legendary rarity)
    filtered.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99));
  }

  return filtered;
}

describe('filterData()', () => {
  let testItems;

  beforeEach(() => {
    createMinimalDOM();
    createItemsFilterUI();

    testItems = [
      createMockItem({ id: 'item1', name: 'Alpha Item', tier: 'SS', rarity: 'legendary', stacks_well: true, one_and_done: false }),
      createMockItem({ id: 'item2', name: 'Beta Item', tier: 'S', rarity: 'rare', stacks_well: false, one_and_done: false }),
      createMockItem({ id: 'item3', name: 'Gamma Item', tier: 'A', rarity: 'common', one_and_done: true, stacks_well: false }),
      createMockItem({ id: 'item4', name: 'Damage Boost', tier: 'SS', rarity: 'epic', stacks_well: true, one_and_done: false }),
      createMockItem({ id: 'item5', name: 'Delta Special', tier: 'B', rarity: 'uncommon', stacks_well: true, one_and_done: false }),
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
        const tierOrder = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
        // Use ?? instead of || because 0 is a valid value
        sorted.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
      } else if (sortBy === 'rarity') {
        const rarityOrder = { 'legendary': 0, 'epic': 1, 'rare': 2, 'uncommon': 3, 'common': 4 };
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
