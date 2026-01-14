import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeBreakpoint, populateCalculatorItems } from '../../src/modules/calculator.ts';
import type { BreakpointData, BreakpointResult } from '../../src/modules/calculator.ts';

// Mock modules
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'test_item',
                    name: 'Test Item',
                    scaling_per_stack: [10, 20, 30],
                },
            ],
        },
    },
}));

describe('calculator - computeBreakpoint', () => {
    const createItem = (id: string, scaling: number[], options: any = {}) => ({
        id,
        name: options.name || `Item ${id}`,
        scaling_per_stack: scaling,
        stack_cap: options.stack_cap,
        one_and_done: options.one_and_done,
        stacks_well: options.stacks_well,
        ...options,
    });

    const createData = (...items: any[]): BreakpointData => ({
        items: { items },
    });

    describe('input validation', () => {
        const data = createData(createItem('item1', [10]));

        it('should return error for missing itemId', () => {
            const result = computeBreakpoint(data, '', 100);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('select an item');
        });

        it('should return error for missing target', () => {
            const result = computeBreakpoint(data, 'item1', 0);
            expect(result.error).toBeDefined();
        });

        it('should return error for negative target', () => {
            const result = computeBreakpoint(data, 'item1', -10);
            expect(result.error).toBeDefined();
        });

        it('should return error for non-existent item', () => {
            const result = computeBreakpoint(data, 'nonexistent', 100);
            expect(result.error).toBe('Item not found');
        });

        it('should return error for item without scaling data', () => {
            const data2 = createData(createItem('item2', []));
            const result = computeBreakpoint(data2, 'item2', 100);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for item with null scaling', () => {
            const data2 = createData({ id: 'item3', name: 'Item 3', scaling_per_stack: null });
            const result = computeBreakpoint(data2, 'item3', 100);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for item with undefined scaling', () => {
            const data2 = createData({ id: 'item4', name: 'Item 4' });
            const result = computeBreakpoint(data2, 'item4', 100);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for invalid scaling value (zero)', () => {
            const data2 = createData(createItem('item5', [0]));
            const result = computeBreakpoint(data2, 'item5', 100);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for invalid scaling value (negative)', () => {
            const data2 = createData(createItem('item6', [-5]));
            const result = computeBreakpoint(data2, 'item6', 100);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for invalid scaling value (NaN)', () => {
            const data2 = createData(createItem('item7', [NaN]));
            const result = computeBreakpoint(data2, 'item7', 100);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for invalid scaling value (Infinity)', () => {
            const data2 = createData(createItem('item8', [Infinity]));
            const result = computeBreakpoint(data2, 'item8', 100);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error for invalid scaling value (string)', () => {
            const data2 = createData(createItem('item9', ['10' as any]));
            const result = computeBreakpoint(data2, 'item9', 100);
            expect(result.error).toBe('Invalid scaling value');
        });
    });

    describe('basic calculations', () => {
        it('should calculate exact stacks needed', () => {
            const data = createData(createItem('item1', [10]));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(10);
            expect(result.perStack).toBe(10);
            expect(result.actualValue).toBe(100);
        });

        it('should round up for fractional stacks', () => {
            const data = createData(createItem('item1', [3]));
            const result = computeBreakpoint(data, 'item1', 10);

            expect(result.stacksNeeded).toBe(4); // ceil(10/3)
            expect(result.actualValue).toBe(12);
        });

        it('should handle large targets', () => {
            const data = createData(createItem('item1', [1]));
            const result = computeBreakpoint(data, 'item1', 10000);

            expect(result.stacksNeeded).toBe(10000);
            expect(result.actualValue).toBe(10000);
        });

        it('should handle decimal targets', () => {
            const data = createData(createItem('item1', [2.5]));
            const result = computeBreakpoint(data, 'item1', 10.5);

            expect(result.stacksNeeded).toBe(5); // ceil(10.5 / 2.5) = ceil(4.2) = 5
            expect(result.actualValue).toBe(12.5);
        });

        it('should handle very small per-stack values', () => {
            const data = createData(createItem('item1', [0.01]));
            const result = computeBreakpoint(data, 'item1', 1);

            expect(result.stacksNeeded).toBe(100);
            expect(result.actualValue).toBe(1);
        });

        it('should handle very large per-stack values', () => {
            const data = createData(createItem('item1', [1000]));
            const result = computeBreakpoint(data, 'item1', 5000);

            expect(result.stacksNeeded).toBe(5);
            expect(result.actualValue).toBe(5000);
        });
    });

    describe('stack cap handling', () => {
        it('should respect stack_cap', () => {
            const data = createData(createItem('item1', [10], { stack_cap: 5 }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(5);
            expect(result.actualValue).toBe(50);
            expect(result.isCapped).toBe(true);
            expect(result.hasWarning).toBe(true);
        });

        it('should not cap when within limit', () => {
            const data = createData(createItem('item1', [10], { stack_cap: 20 }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(10);
            expect(result.isCapped).toBe(false);
        });

        it('should handle stack_cap of 1', () => {
            const data = createData(createItem('item1', [50], { stack_cap: 1 }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(1);
            expect(result.actualValue).toBe(50);
            expect(result.isCapped).toBe(true);
        });

        it('should handle null stack_cap (unlimited)', () => {
            const data = createData(createItem('item1', [1], { stack_cap: null }));
            const result = computeBreakpoint(data, 'item1', 1000);

            expect(result.stacksNeeded).toBe(1000);
            expect(result.isCapped).toBe(false);
        });

        it('should handle undefined stack_cap (unlimited)', () => {
            const data = createData(createItem('item1', [1]));
            const result = computeBreakpoint(data, 'item1', 1000);

            expect(result.stacksNeeded).toBe(1000);
            expect(result.isCapped).toBe(false);
        });

        it('should handle stack_cap = 0', () => {
            const data = createData(createItem('item1', [10], { stack_cap: 0 }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(0);
            expect(result.actualValue).toBe(0);
            expect(result.isCapped).toBe(true);
        });
    });

    describe('warning flags', () => {
        it('should set isOneAndDone for one_and_done items', () => {
            const data = createData(createItem('item1', [100], { one_and_done: true }));
            const result = computeBreakpoint(data, 'item1', 50);

            expect(result.isOneAndDone).toBe(true);
            expect(result.hasWarning).toBe(true);
        });

        it('should not set isOneAndDone when false', () => {
            const data = createData(createItem('item1', [10], { one_and_done: false }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.isOneAndDone).toBe(false);
        });

        it('should handle stacks_well = false', () => {
            const data = createData(createItem('item1', [10], { stacks_well: false }));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.hasWarning).toBe(true);
        });

        it('should combine multiple warnings', () => {
            const data = createData(
                createItem('item1', [10], {
                    one_and_done: true,
                    stacks_well: false,
                    stack_cap: 5,
                })
            );
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.isOneAndDone).toBe(true);
            expect(result.isCapped).toBe(true);
            expect(result.hasWarning).toBe(true);
        });

        it('should not show warning for well-behaved item', () => {
            const data = createData(
                createItem('item1', [10], {
                    one_and_done: false,
                    stacks_well: true,
                })
            );
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.hasWarning).toBe(false);
        });
    });

    describe('return values', () => {
        it('should return all expected fields on success', () => {
            const data = createData(createItem('item1', [10]));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result).toHaveProperty('item');
            expect(result).toHaveProperty('target');
            expect(result).toHaveProperty('stacksNeeded');
            expect(result).toHaveProperty('perStack');
            expect(result).toHaveProperty('actualValue');
            expect(result).toHaveProperty('isCapped');
            expect(result).toHaveProperty('isOneAndDone');
            expect(result).toHaveProperty('hasWarning');
            expect(result.error).toBeUndefined();
        });

        it('should return item reference', () => {
            const item = createItem('item1', [10]);
            const data = createData(item);
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.item).toBe(item);
        });

        it('should return target value', () => {
            const data = createData(createItem('item1', [10]));
            const result = computeBreakpoint(data, 'item1', 250);

            expect(result.target).toBe(250);
        });
    });

    describe('edge cases', () => {
        it('should handle target of 1', () => {
            const data = createData(createItem('item1', [10]));
            const result = computeBreakpoint(data, 'item1', 1);

            expect(result.stacksNeeded).toBe(1);
            expect(result.actualValue).toBe(10);
        });

        it('should handle matching exact stack value', () => {
            const data = createData(createItem('item1', [25]));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(4);
            expect(result.actualValue).toBe(100);
        });

        it('should handle decimal per-stack values', () => {
            const data = createData(createItem('item1', [0.5]));
            const result = computeBreakpoint(data, 'item1', 10);

            expect(result.stacksNeeded).toBe(20);
            expect(result.actualValue).toBe(10);
        });

        it('should handle multiple scaling values (uses first)', () => {
            const data = createData(createItem('item1', [10, 20, 30, 40]));
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.perStack).toBe(10);
            expect(result.stacksNeeded).toBe(10);
        });

        it('should handle items with extra properties', () => {
            const data = createData({
                ...createItem('item1', [10]),
                description: 'Test description',
                tier: 'S',
                rarity: 'legendary',
            });
            const result = computeBreakpoint(data, 'item1', 100);

            expect(result.stacksNeeded).toBe(10);
        });
    });
});

describe('calculator - populateCalculatorItems', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <select id="calc-item-select">
                <option value="">Select an item...</option>
            </select>
        `;
    });

    it('should populate select with items', () => {
        populateCalculatorItems();

        const select = document.getElementById('calc-item-select') as HTMLSelectElement;
        expect(select.options.length).toBeGreaterThan(1);
    });

    it('should preserve placeholder option', () => {
        populateCalculatorItems();

        const select = document.getElementById('calc-item-select') as HTMLSelectElement;
        expect(select.options[0].value).toBe('');
    });

    it('should handle missing select element', () => {
        document.body.innerHTML = '';
        expect(() => populateCalculatorItems()).not.toThrow();
    });
});
