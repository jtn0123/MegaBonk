import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockAllData } from '../helpers/mock-data.js';

/**
 * Standalone calculateBreakpoint implementation for testing
 * This mirrors the logic from script.js for isolated unit testing
 */
function calculateBreakpoint(allData, itemId, target) {
  if (!itemId || !target || target <= 0) {
    return { error: 'Please select an item and enter a target value!' };
  }

  const item = allData.items?.items.find(i => i.id === itemId);
  if (!item) {
    return { error: 'Item not found' };
  }

  // Calculate stacks needed
  let stacksNeeded = 0;
  const perStack = item.scaling_per_stack[0]; // Value per stack from first entry

  if (perStack > 0) {
    stacksNeeded = Math.ceil(target / perStack);
  }

  // Cap checks
  const isCapped = item.stack_cap != null && stacksNeeded > item.stack_cap;
  if (isCapped) {
    stacksNeeded = item.stack_cap;
  }

  // Calculate actual value achieved
  const actualValue = Math.min(stacksNeeded * perStack, isCapped ? item.stack_cap * perStack : target);

  // Determine if there are warnings to show
  const isOneAndDone = item.one_and_done === true;
  const doesNotStackWell = item.stacks_well === false;
  const hasWarning = isOneAndDone || doesNotStackWell || isCapped;

  return {
    item: item,
    target: target,
    stacksNeeded: stacksNeeded,
    perStack: perStack,
    actualValue: actualValue,
    isCapped: isCapped,
    isOneAndDone: isOneAndDone,
    hasWarning: hasWarning
  };
}

describe('calculateBreakpoint()', () => {
  let allData;

  beforeEach(() => {
    createMinimalDOM();

    allData = createMockAllData();

    // Add specific items for breakpoint testing
    allData.items.items = [
      createMockItem({
        id: 'big_bonk',
        name: 'Big Bonk',
        scaling_per_stack: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
        stack_cap: null,
        one_and_done: false,
        stacks_well: true,
        scaling_type: 'chance_based'
      }),
      createMockItem({
        id: 'spicy_meatball',
        name: 'Spicy Meatball',
        scaling_per_stack: [25, 50, 75, 100, 100, 100, 100, 100, 100, 100],
        stack_cap: 4,
        one_and_done: false,
        stacks_well: true,
        scaling_type: 'chance_based'
      }),
      createMockItem({
        id: 'anvil',
        name: 'Anvil',
        scaling_per_stack: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        stack_cap: 1,
        one_and_done: true,
        stacks_well: false,
        scaling_type: 'one_and_done'
      }),
      createMockItem({
        id: 'gym_sauce',
        name: 'Gym Sauce',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        stack_cap: null,
        one_and_done: false,
        stacks_well: true,
        scaling_type: 'damage_scaling'
      }),
      createMockItem({
        id: 'forbidden_juice',
        name: 'Forbidden Juice',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        stack_cap: null,
        one_and_done: false,
        stacks_well: true,
        scaling_type: 'crit_scaling'
      }),
    ];
  });

  describe('basic calculations', () => {
    it('should calculate stacks needed for linear scaling item', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 100);

      expect(result.stacksNeeded).toBe(10); // 100 / 10 = 10
      expect(result.perStack).toBe(10);
    });

    it('should calculate stacks for Big Bonk at 100% target', () => {
      const result = calculateBreakpoint(allData, 'big_bonk', 100);

      expect(result.stacksNeeded).toBe(50); // 100 / 2 = 50 stacks
      expect(result.perStack).toBe(2);
    });

    it('should calculate stacks for Forbidden Juice at 100% target', () => {
      const result = calculateBreakpoint(allData, 'forbidden_juice', 100);

      expect(result.stacksNeeded).toBe(10); // 100 / 10 = 10 stacks
    });

    it('should round up stacks needed', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 15);

      expect(result.stacksNeeded).toBe(2); // ceil(15 / 10) = 2
    });

    it('should handle target of 1', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 1);

      expect(result.stacksNeeded).toBe(1); // ceil(1 / 10) = 1
    });
  });

  describe('stack cap handling', () => {
    it('should respect stack cap for Spicy Meatball', () => {
      const result = calculateBreakpoint(allData, 'spicy_meatball', 200);

      expect(result.stacksNeeded).toBe(4); // Capped at 4
      expect(result.isCapped).toBe(true);
    });

    it('should not cap when target is within stack cap', () => {
      const result = calculateBreakpoint(allData, 'spicy_meatball', 75);

      expect(result.stacksNeeded).toBe(3); // 75 / 25 = 3
      expect(result.isCapped).toBe(false);
    });

    it('should cap Anvil at 1 stack', () => {
      const result = calculateBreakpoint(allData, 'anvil', 10);

      expect(result.stacksNeeded).toBe(1);
      expect(result.isCapped).toBe(true);
    });
  });

  describe('warning flags', () => {
    it('should set hasWarning for one-and-done items', () => {
      const result = calculateBreakpoint(allData, 'anvil', 5);

      expect(result.isOneAndDone).toBe(true);
      expect(result.hasWarning).toBe(true);
    });

    it('should set hasWarning for capped items', () => {
      const result = calculateBreakpoint(allData, 'spicy_meatball', 200);

      expect(result.isCapped).toBe(true);
      expect(result.hasWarning).toBe(true);
    });

    it('should not set hasWarning for normal stacking items', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 50);

      expect(result.hasWarning).toBe(false);
    });
  });

  describe('validation', () => {
    it('should return error when no item selected', () => {
      const result = calculateBreakpoint(allData, '', 100);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('select an item');
    });

    it('should return error when no target entered', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 0);

      expect(result.error).toBeDefined();
    });

    it('should return error for negative target', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', -10);

      expect(result.error).toBeDefined();
    });

    it('should return error for non-existent item', () => {
      const result = calculateBreakpoint(allData, 'nonexistent_item', 100);

      expect(result.error).toBe('Item not found');
    });
  });

  describe('result data', () => {
    it('should include item details in result', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 50);

      expect(result.item).toBeDefined();
      expect(result.item.name).toBe('Gym Sauce');
      expect(result.target).toBe(50);
    });

    it('should include perStack value in result', () => {
      const result = calculateBreakpoint(allData, 'big_bonk', 50);

      expect(result.perStack).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle very large target values', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 10000);

      expect(result.stacksNeeded).toBe(1000); // 10000 / 10 = 1000
    });

    it('should handle decimal targets', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 15.5);

      expect(result.stacksNeeded).toBe(2); // ceil(15.5 / 10) = 2
    });

    it('should handle exactly hitting a stack boundary', () => {
      const result = calculateBreakpoint(allData, 'gym_sauce', 50);

      expect(result.stacksNeeded).toBe(5); // 50 / 10 = 5 exactly
    });
  });
});

describe('Quick calculation shortcuts', () => {
  let allData;

  beforeEach(() => {
    allData = createMockAllData();
    allData.items.items = [
      createMockItem({
        id: 'big_bonk',
        name: 'Big Bonk',
        scaling_per_stack: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
        stack_cap: null,
        one_and_done: false,
        stacks_well: true
      }),
      createMockItem({
        id: 'spicy_meatball',
        name: 'Spicy Meatball',
        scaling_per_stack: [25, 50, 75, 100, 100, 100, 100, 100, 100, 100],
        stack_cap: 4,
        one_and_done: false,
        stacks_well: true
      }),
      createMockItem({
        id: 'forbidden_juice',
        name: 'Forbidden Juice',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        stack_cap: null,
        one_and_done: false,
        stacks_well: true
      }),
    ];
  });

  it('Big Bonk 100% proc rate requires 50 stacks', () => {
    const result = calculateBreakpoint(allData, 'big_bonk', 100);
    expect(result.stacksNeeded).toBe(50);
  });

  it('Spicy Meatball 100% explosions requires 4 stacks', () => {
    const result = calculateBreakpoint(allData, 'spicy_meatball', 100);
    expect(result.stacksNeeded).toBe(4);
  });

  it('Forbidden Juice 100% crit requires 10 stacks', () => {
    const result = calculateBreakpoint(allData, 'forbidden_juice', 100);
    expect(result.stacksNeeded).toBe(10);
  });
});
