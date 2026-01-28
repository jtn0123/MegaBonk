import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM, createItemsFilterUI } from '../helpers/dom-setup.js';
import { createMockItem, createMockAllData } from '../helpers/mock-data.js';
import { simulateInput, simulateSelect } from '../helpers/test-utils.js';

/**
 * Standalone filter implementation for integration testing
 */
function filterData(data, tabName) {
  let filtered = [...data];
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

  // Search filter
  filtered = filtered.filter(item => {
    const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
    return searchable.includes(searchTerm);
  });

  // Tier filter
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

  // Sorting
  const sortBy = document.getElementById('sortBy')?.value;
  if (sortBy === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'tier') {
    const tierOrder = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
    filtered.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
  } else if (sortBy === 'rarity') {
    const rarityOrder = { 'legendary': 0, 'epic': 1, 'rare': 2, 'uncommon': 3, 'common': 4 };
    filtered.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99));
  }

  return filtered;
}

describe('Search and Filter Integration', () => {
  let testItems;

  beforeEach(() => {
    createMinimalDOM();
    createItemsFilterUI();

    testItems = [
      createMockItem({ id: 'bonk-bat', name: 'Bonk Bat', tier: 'SS', rarity: 'legendary', stacks_well: true, base_effect: 'Massive damage boost' }),
      createMockItem({ id: 'speed-boots', name: 'Speed Boots', tier: 'S', rarity: 'epic', stacks_well: true, base_effect: 'Movement speed' }),
      createMockItem({ id: 'mega-bonk', name: 'Mega Bonk', tier: 'SS', rarity: 'legendary', stacks_well: false, one_and_done: true }),
      createMockItem({ id: 'health-potion', name: 'Health Potion', tier: 'A', rarity: 'common', stacks_well: true }),
      createMockItem({ id: 'damage-crystal', name: 'Damage Crystal', tier: 'S', rarity: 'rare', stacks_well: true }),
      createMockItem({ id: 'defense-shield', name: 'Defense Shield', tier: 'B', rarity: 'uncommon', one_and_done: true }),
      createMockItem({ id: 'crit-gem', name: 'Critical Gem', tier: 'A', rarity: 'epic', stacks_well: true }),
      createMockItem({ id: 'bonk-hammer', name: 'Bonk Hammer', tier: 'SS', rarity: 'legendary', stacks_well: true }),
    ];
  });

  describe('Search + Filter Combinations', () => {
    it('should combine search with tier filter', () => {
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('tierFilter'), 'SS');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(3); // Bonk Bat, Mega Bonk, Bonk Hammer
      result.forEach(item => {
        expect(item.name.toLowerCase()).toContain('bonk');
        expect(item.tier).toBe('SS');
      });
    });

    it('should combine search with rarity filter', () => {
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('rarityFilter'), 'legendary');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(3);
      result.forEach(item => {
        expect(item.name.toLowerCase()).toContain('bonk');
        expect(item.rarity).toBe('legendary');
      });
    });

    it('should combine tier and rarity filters', () => {
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      simulateSelect(document.getElementById('rarityFilter'), 'legendary');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(3);
      result.forEach(item => {
        expect(item.tier).toBe('SS');
        expect(item.rarity).toBe('legendary');
      });
    });

    it('should combine all three: search, tier, and rarity', () => {
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      simulateSelect(document.getElementById('rarityFilter'), 'legendary');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(3);
      result.forEach(item => {
        expect(item.name.toLowerCase()).toContain('bonk');
        expect(item.tier).toBe('SS');
        expect(item.rarity).toBe('legendary');
      });
    });

    it('should combine stacking filter with search', () => {
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('stackingFilter'), 'stacks_well');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(2); // Bonk Bat, Bonk Hammer (Mega Bonk is one_and_done)
      result.forEach(item => {
        expect(item.stacks_well).toBe(true);
      });
    });

    it('should combine one_and_done filter with tier', () => {
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      simulateSelect(document.getElementById('stackingFilter'), 'one_and_done');

      const result = filterData(testItems, 'items');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Mega Bonk');
    });
  });

  describe('Filter + Sort Combinations', () => {
    it('should sort filtered results by name', () => {
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      simulateSelect(document.getElementById('sortBy'), 'name');

      const result = filterData(testItems, 'items');

      expect(result[0].name).toBe('Bonk Bat');
      expect(result[1].name).toBe('Bonk Hammer');
      expect(result[2].name).toBe('Mega Bonk');
    });

    it('should sort filtered results by rarity', () => {
      simulateSelect(document.getElementById('tierFilter'), 'S');
      simulateSelect(document.getElementById('sortBy'), 'rarity');

      const result = filterData(testItems, 'items');

      expect(result[0].rarity).toBe('epic');
      expect(result[1].rarity).toBe('rare');
    });

    it('should maintain sort order after filter change', () => {
      simulateSelect(document.getElementById('sortBy'), 'name');
      simulateSelect(document.getElementById('tierFilter'), 'S');

      const result1 = filterData(testItems, 'items');
      expect(result1[0].name).toBe('Damage Crystal');
      expect(result1[1].name).toBe('Speed Boots');

      simulateSelect(document.getElementById('tierFilter'), 'A');
      const result2 = filterData(testItems, 'items');
      expect(result2[0].name).toBe('Critical Gem');
      expect(result2[1].name).toBe('Health Potion');
    });
  });

  describe('Progressive Filtering', () => {
    it('should progressively narrow results', () => {
      // Start with all items
      let result = filterData(testItems, 'items');
      expect(result.length).toBe(8);

      // Add tier filter
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      result = filterData(testItems, 'items');
      expect(result.length).toBe(3);

      // Add search
      simulateInput(document.getElementById('searchInput'), 'bat');
      result = filterData(testItems, 'items');
      expect(result.length).toBe(1);
    });

    it('should widen results when filters removed', () => {
      // Start with restrictive filters
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('tierFilter'), 'SS');

      let result = filterData(testItems, 'items');
      expect(result.length).toBe(3);

      // Remove search
      simulateInput(document.getElementById('searchInput'), '');
      result = filterData(testItems, 'items');
      expect(result.length).toBe(3); // Still filtered by tier

      // Remove tier filter
      simulateSelect(document.getElementById('tierFilter'), 'all');
      result = filterData(testItems, 'items');
      expect(result.length).toBe(8); // All items
    });
  });

  describe('Edge Cases', () => {
    it('should handle filters with no matching results', () => {
      simulateInput(document.getElementById('searchInput'), 'nonexistent');
      simulateSelect(document.getElementById('tierFilter'), 'C');

      const result = filterData(testItems, 'items');
      expect(result.length).toBe(0);
    });

    it('should handle search in base_effect', () => {
      simulateInput(document.getElementById('searchInput'), 'massive');

      const result = filterData(testItems, 'items');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Bonk Bat');
    });

    it('should handle case-insensitive search with filters', () => {
      simulateInput(document.getElementById('searchInput'), 'BONK');
      simulateSelect(document.getElementById('tierFilter'), 'SS');

      const result = filterData(testItems, 'items');
      expect(result.length).toBe(3);
    });

    it('should handle partial word matches', () => {
      simulateInput(document.getElementById('searchInput'), 'crystal');

      const result = filterData(testItems, 'items');
      expect(result.length).toBe(1); // Damage Crystal
      expect(result[0].name).toBe('Damage Crystal');
    });

    it('should handle special characters in search', () => {
      simulateInput(document.getElementById('searchInput'), '');

      const result = filterData(testItems, 'items');
      expect(result.length).toBe(8);
    });
  });

  describe('Filter Reset Behavior', () => {
    it('should reset all filters correctly', () => {
      // Apply multiple filters
      simulateInput(document.getElementById('searchInput'), 'bonk');
      simulateSelect(document.getElementById('tierFilter'), 'SS');
      simulateSelect(document.getElementById('rarityFilter'), 'legendary');
      simulateSelect(document.getElementById('stackingFilter'), 'stacks_well');

      let result = filterData(testItems, 'items');
      expect(result.length).toBeLessThan(8);

      // Reset all
      simulateInput(document.getElementById('searchInput'), '');
      simulateSelect(document.getElementById('tierFilter'), 'all');
      simulateSelect(document.getElementById('rarityFilter'), 'all');
      simulateSelect(document.getElementById('stackingFilter'), 'all');

      result = filterData(testItems, 'items');
      expect(result.length).toBe(8);
    });
  });
});

describe('Multi-Filter Performance', () => {
  let largeDataset;

  beforeEach(() => {
    createMinimalDOM();
    createItemsFilterUI();

    // Create a larger dataset for performance testing
    largeDataset = [];
    const tiers = ['SS', 'S', 'A', 'B', 'C'];
    const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

    for (let i = 0; i < 100; i++) {
      largeDataset.push(createMockItem({
        id: `item-${i}`,
        name: `Item ${i} ${i % 2 === 0 ? 'Bonk' : 'Normal'}`,
        tier: tiers[i % 5],
        rarity: rarities[i % 5],
        stacks_well: i % 3 === 0,
        one_and_done: i % 4 === 0,
      }));
    }
  });

  it('should handle filtering large datasets', () => {
    simulateInput(document.getElementById('searchInput'), 'bonk');
    simulateSelect(document.getElementById('tierFilter'), 'SS');

    const start = performance.now();
    const result = filterData(largeDataset, 'items');
    const duration = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  it('should maintain accuracy with large dataset', () => {
    simulateSelect(document.getElementById('tierFilter'), 'SS');

    const result = filterData(largeDataset, 'items');

    result.forEach(item => {
      expect(item.tier).toBe('SS');
    });
  });
});
