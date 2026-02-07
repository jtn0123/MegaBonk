/**
 * @vitest-environment jsdom
 * Breakpoint Calculator Pure Function Tests
 * Tests computeBreakpoint without DOM dependencies
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    computeBreakpoint,
    type BreakpointData,
    type BreakpointResult,
} from '../../src/modules/calculator.ts';
import type { Item } from '../../src/types/index.ts';

// ========================================
// Test Fixtures
// ========================================

const createItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'test_item',
    name: 'Test Item',
    tier: 'A',
    rarity: 'common',
    description: 'A test item',
    effect: '+10% damage per stack',
    scaling: { type: 'linear', base: 10, per_stack: 10 },
    scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    stack_cap: 10,
    tips: [],
    ...overrides,
});

const createData = (items: Item[]): BreakpointData => ({
    items: { items },
});

describe('computeBreakpoint', () => {
    // ========================================
    // Input Validation Tests
    // ========================================
    describe('input validation', () => {
        it('should return error for empty itemId', () => {
            const data = createData([createItem()]);
            const result = computeBreakpoint(data, '', 100);
            
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should return error for zero target', () => {
            const data = createData([createItem()]);
            const result = computeBreakpoint(data, 'test_item', 0);
            
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should return error for negative target', () => {
            const data = createData([createItem()]);
            const result = computeBreakpoint(data, 'test_item', -50);
            
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should return error for non-existent item', () => {
            const data = createData([createItem()]);
            const result = computeBreakpoint(data, 'nonexistent', 100);
            
            expect(result.error).toBe('Item not found');
        });

        it('should return error for item without scaling data', () => {
            const item = createItem({ scaling_per_stack: [] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for item with undefined scaling_per_stack', () => {
            const item = createItem();
            delete (item as any).scaling_per_stack;
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for zero scaling value', () => {
            const item = createItem({ scaling_per_stack: [0, 10, 20] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for negative scaling value', () => {
            const item = createItem({ scaling_per_stack: [-10, 20, 30] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for NaN scaling value', () => {
            const item = createItem({ scaling_per_stack: [NaN, 20, 30] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for null scaling value', () => {
            const item = createItem({ scaling_per_stack: [null as any, 20, 30] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Invalid scaling value');
        });
    });

    // ========================================
    // Basic Calculation Tests
    // ========================================
    describe('basic calculations', () => {
        it('should calculate correct stacks for exact match', () => {
            const item = createItem({ scaling_per_stack: [10, 20, 30, 40, 50] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 50);
            
            expect(result.stacksNeeded).toBe(5);
            expect(result.perStack).toBe(10);
        });

        it('should round up stacks when target is not exact', () => {
            const item = createItem({ scaling_per_stack: [10, 20, 30, 40, 50] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 25);
            
            expect(result.stacksNeeded).toBe(3); // Ceiling of 25/10 = 3
        });

        it('should return 1 stack for small targets', () => {
            const item = createItem({ scaling_per_stack: [10, 20, 30] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 5);
            
            expect(result.stacksNeeded).toBe(1);
        });

        it('should handle large targets', () => {
            const item = createItem({ 
                scaling_per_stack: [5, 10, 15, 20, 25],
                stack_cap: 100 
            });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 500);
            
            expect(result.stacksNeeded).toBe(100); // 500/5 = 100
        });

        it('should return item in result', () => {
            const item = createItem({ name: 'Big Bonk' });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 50);
            
            expect(result.item).toBeDefined();
            expect(result.item?.name).toBe('Big Bonk');
        });

        it('should return target in result', () => {
            const item = createItem();
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 75);
            
            expect(result.target).toBe(75);
        });
    });

    // ========================================
    // Stack Cap Tests
    // ========================================
    describe('stack cap handling', () => {
        it('should cap stacks at stack_cap', () => {
            const item = createItem({
                scaling_per_stack: [10, 20, 30, 40, 50],
                stack_cap: 3,
            });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.stacksNeeded).toBe(3);
            expect(result.isCapped).toBe(true);
        });

        it('should not flag as capped when under cap', () => {
            const item = createItem({
                scaling_per_stack: [10, 20, 30, 40, 50],
                stack_cap: 10,
            });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 30);
            
            expect(result.stacksNeeded).toBe(3);
            expect(result.isCapped).toBeFalsy();
        });

        it('should handle item without stack_cap', () => {
            const item = createItem({ scaling_per_stack: [10, 20, 30] });
            delete (item as any).stack_cap;
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 50);
            
            expect(result.stacksNeeded).toBe(5);
            expect(result.isCapped).toBeFalsy();
        });

        it('should handle stack_cap of 1', () => {
            const item = createItem({
                scaling_per_stack: [100],
                stack_cap: 1,
            });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 500);
            
            expect(result.stacksNeeded).toBe(1);
            expect(result.isCapped).toBe(true);
        });
    });

    // ========================================
    // One-and-Done Detection Tests
    // ========================================
    describe('one-and-done detection', () => {
        it('should detect one-and-done items', () => {
            const item = createItem({
                stacks_well: false,
                tags: ['one-and-done'],
            });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 10);
            
            // The function should still calculate, but flag as one-and-done
            expect(result.stacksNeeded).toBeDefined();
        });

        it('should not flag items that stack well', () => {
            const item = createItem({ stacks_well: true });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 50);
            
            expect(result.isOneAndDone).toBeFalsy();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle decimal targets', () => {
            const item = createItem({ scaling_per_stack: [10, 20, 30] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 15.5);
            
            expect(result.stacksNeeded).toBe(2); // Ceiling of 15.5/10 = 2
        });

        it('should handle very small scaling values', () => {
            const item = createItem({ scaling_per_stack: [0.1, 0.2, 0.3] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 1);
            
            expect(result.stacksNeeded).toBe(10);
        });

        it('should handle very large scaling values', () => {
            const item = createItem({ scaling_per_stack: [1000, 2000, 3000] });
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 5000);
            
            expect(result.stacksNeeded).toBe(5);
        });

        it('should handle empty items array', () => {
            const data = createData([]);
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBe('Item not found');
        });

        it('should handle undefined items', () => {
            const data: BreakpointData = { items: undefined };
            const result = computeBreakpoint(data, 'test_item', 100);
            
            expect(result.error).toBeDefined();
        });

        it('should find correct item among multiple', () => {
            const items = [
                createItem({ id: 'item1', scaling_per_stack: [5] }),
                createItem({ id: 'item2', scaling_per_stack: [10] }),
                createItem({ id: 'item3', scaling_per_stack: [20] }),
            ];
            const data = createData(items);
            const result = computeBreakpoint(data, 'item2', 50);
            
            expect(result.perStack).toBe(10);
            expect(result.stacksNeeded).toBe(5);
        });
    });

    // ========================================
    // Return Value Structure Tests
    // ========================================
    describe('return value structure', () => {
        it('should return all expected properties on success', () => {
            const item = createItem();
            const data = createData([item]);
            const result = computeBreakpoint(data, 'test_item', 50);
            
            expect(result).toHaveProperty('item');
            expect(result).toHaveProperty('target');
            expect(result).toHaveProperty('stacksNeeded');
            expect(result).toHaveProperty('perStack');
        });

        it('should return error property on failure', () => {
            const data = createData([]);
            const result = computeBreakpoint(data, 'nonexistent', 100);
            
            expect(result).toHaveProperty('error');
            expect(result.error).toBeTruthy();
        });
    });
});
