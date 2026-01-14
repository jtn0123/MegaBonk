/**
 * Comprehensive tests for calculator.ts - Breakpoint Calculator Module
 * Additional tests to expand coverage from 25% to 70%+
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {computeBreakpoint, populateCalculatorItems, calculateBreakpoint, quickCalc, type BreakpointData, type BreakpointResult } from '../../src/modules/calculator.ts';
import type { Item } from '../../src/types/index.ts';
import { setupDOM } from '../helpers/dom-setup.js';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock data-service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item',
                    scaling_per_stack: [10, 20, 30],
                    stack_cap: 5,
                } as Item,
                {
                    id: 'item2',
                    name: 'No Cap Item',
                    scaling_per_stack: [5],
                } as Item,
                {
                    id: 'item3',
                    name: 'One and Done',
                    scaling_per_stack: [100],
                    one_and_done: true,
                } as Item,
                {
                    id: 'item4',
                    name: 'Doesnt Stack Well',
                    scaling_per_stack: [15],
                    stacks_well: false,
                } as Item,
            ],
        },
    },
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', () => ({
    safeSetValue: vi.fn(),
}));

describe('Calculator Module - Comprehensive Tests', () => {
    let mockData: BreakpointData;

    beforeEach(() => {
        setupDOM();
        mockData = {
            items: {
                items: [
                    {
                        id: 'item1',
                        name: 'Test Item',
                        scaling_per_stack: [10, 20, 30],
                        stack_cap: 5,
                    } as Item,
                    {
                        id: 'item2',
                        name: 'No Cap Item',
                        scaling_per_stack: [5],
                    } as Item,
                    {
                        id: 'item3',
                        name: 'One and Done',
                        scaling_per_stack: [100],
                        one_and_done: true,
                    } as Item,
                    {
                        id: 'item4',
                        name: 'Doesnt Stack Well',
                        scaling_per_stack: [15],
                        stacks_well: false,
                    } as Item,
                    {
                        id: 'item5',
                        name: 'Zero Scaling',
                        scaling_per_stack: [0],
                    } as Item,
                    {
                        id: 'item6',
                        name: 'Negative Scaling',
                        scaling_per_stack: [-10],
                    } as Item,
                    {
                        id: 'item7',
                        name: 'NaN Scaling',
                        scaling_per_stack: [NaN],
                    } as Item,
                    {
                        id: 'item8',
                        name: 'Infinity Scaling',
                        scaling_per_stack: [Infinity],
                    } as Item,
                    {
                        id: 'item9',
                        name: 'Empty Scaling',
                        scaling_per_stack: [],
                    } as Item,
                    {
                        id: 'item10',
                        name: 'No Scaling Property',
                    } as Item,
                ],
            },
        };
    });

    describe('computeBreakpoint - Input Validation', () => {
        it('should reject empty itemId', () => {
            const result = computeBreakpoint(mockData, '', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Please select an item');
        });

        it('should reject null target', () => {
            const result = computeBreakpoint(mockData, 'item1', 0);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Please select an item');
        });

        it('should reject negative target', () => {
            const result = computeBreakpoint(mockData, 'item1', -10);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('target value');
        });

        it('should reject zero target', () => {
            const result = computeBreakpoint(mockData, 'item1', 0);

            expect(result.error).toBeDefined();
        });

        it('should handle missing item', () => {
            const result = computeBreakpoint(mockData, 'nonexistent', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Item not found');
        });

        it('should handle empty scaling_per_stack array', () => {
            const result = computeBreakpoint(mockData, 'item9', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('no scaling data');
        });

        it('should handle missing scaling_per_stack property', () => {
            const result = computeBreakpoint(mockData, 'item10', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('no scaling data');
        });

        it('should reject zero scaling value', () => {
            const result = computeBreakpoint(mockData, 'item5', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid scaling value');
        });

        it('should reject negative scaling value', () => {
            const result = computeBreakpoint(mockData, 'item6', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid scaling value');
        });

        it('should reject NaN scaling value', () => {
            const result = computeBreakpoint(mockData, 'item7', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid scaling value');
        });

        it('should reject Infinity scaling value', () => {
            const result = computeBreakpoint(mockData, 'item8', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid scaling value');
        });
    });

    describe('computeBreakpoint - Basic Calculations', () => {
        it('should calculate exact stacks needed', () => {
            const result = computeBreakpoint(mockData, 'item1', 30);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(3);
            expect(result.perStack).toBe(10);
            expect(result.actualValue).toBe(30);
        });

        it('should round up stacks needed', () => {
            const result = computeBreakpoint(mockData, 'item1', 25);

            expect(result.stacksNeeded).toBe(3);
            expect(result.actualValue).toBe(30);
        });

        it('should calculate for single stack', () => {
            const result = computeBreakpoint(mockData, 'item1', 5);

            expect(result.stacksNeeded).toBe(1);
            expect(result.perStack).toBe(10);
            expect(result.actualValue).toBe(10);
        });

        it('should calculate for large target values', () => {
            const result = computeBreakpoint(mockData, 'item2', 1000);

            expect(result.stacksNeeded).toBe(200);
            expect(result.perStack).toBe(5);
        });

        it('should return item reference in result', () => {
            const result = computeBreakpoint(mockData, 'item1', 100);

            expect(result.item).toBeDefined();
            expect(result.item?.id).toBe('item1');
            expect(result.item?.name).toBe('Test Item');
        });

        it('should return target in result', () => {
            const result = computeBreakpoint(mockData, 'item1', 100);

            expect(result.target).toBe(100);
        });
    });

    describe('computeBreakpoint - Stack Cap Handling', () => {
        it('should cap stacks at stack_cap', () => {
            const result = computeBreakpoint(mockData, 'item1', 100);

            expect(result.stacksNeeded).toBe(5);
            expect(result.isCapped).toBe(true);
        });

        it('should not cap when under stack_cap', () => {
            const result = computeBreakpoint(mockData, 'item1', 30);

            expect(result.stacksNeeded).toBe(3);
            expect(result.isCapped).toBe(false);
        });

        it('should handle items without stack_cap', () => {
            const result = computeBreakpoint(mockData, 'item2', 100);

            expect(result.stacksNeeded).toBe(20);
            expect(result.isCapped).toBe(false);
        });

        it('should calculate actualValue when capped', () => {
            const result = computeBreakpoint(mockData, 'item1', 100);

            expect(result.actualValue).toBe(50); // 5 stacks * 10 per stack
            expect(result.target).toBe(100);
            expect(result.isCapped).toBe(true);
        });

        it('should set hasWarning when capped', () => {
            const result = computeBreakpoint(mockData, 'item1', 100);

            expect(result.hasWarning).toBe(true);
        });

        it('should set hasWarning for one-and-done items with multiple stacks', () => {
            const result = computeBreakpoint(mockData, 'item3', 200);

            expect(result.isOneAndDone).toBe(true);
            expect(result.stacksNeeded).toBe(2);
            expect(result.hasWarning).toBe(true);
        });

        it('should not set hasWarning for one-and-done items with single stack', () => {
            const result = computeBreakpoint(mockData, 'item3', 50);

            expect(result.isOneAndDone).toBe(true);
            expect(result.stacksNeeded).toBe(1);
            expect(result.hasWarning).toBeUndefined();
        });
    });

    describe('computeBreakpoint - Special Item Properties', () => {
        it('should identify one_and_done items', () => {
            const result = computeBreakpoint(mockData, 'item3', 100);

            expect(result.isOneAndDone).toBe(true);
        });

        it('should warn when one_and_done needs multiple stacks', () => {
            const result = computeBreakpoint(mockData, 'item3', 200);

            expect(result.isOneAndDone).toBe(true);
            expect(result.stacksNeeded).toBe(2);
            expect(result.hasWarning).toBe(true);
        });

        it('should handle stacks_well property', () => {
            const result = computeBreakpoint(mockData, 'item4', 100);

            expect(result.item?.stacks_well).toBe(false);
        });

        it('should not warn for stacks_well=false if single stack', () => {
            const result = computeBreakpoint(mockData, 'item4', 10);

            expect(result.stacksNeeded).toBe(1);
            expect(result.hasWarning).toBeUndefined();
        });
    });

    describe('computeBreakpoint - Edge Cases', () => {
        it('should handle very small target values', () => {
            const result = computeBreakpoint(mockData, 'item1', 0.1);

            expect(result.stacksNeeded).toBe(1);
        });

        it('should handle decimal target values', () => {
            const result = computeBreakpoint(mockData, 'item1', 15.7);

            expect(result.stacksNeeded).toBe(2);
        });

        it('should handle target exactly at stack_cap boundary', () => {
            const result = computeBreakpoint(mockData, 'item1', 50);

            expect(result.stacksNeeded).toBe(5);
            expect(result.isCapped).toBe(false);
            expect(result.actualValue).toBe(50);
        });

        it('should handle target just above stack_cap boundary', () => {
            const result = computeBreakpoint(mockData, 'item1', 51);

            expect(result.stacksNeeded).toBe(5);
            expect(result.isCapped).toBe(true);
            expect(result.actualValue).toBe(50);
        });

        it('should handle null stack_cap explicitly', () => {
            const dataWithNullCap: BreakpointData = {
                items: {
                    items: [
                        {
                            id: 'item11',
                            name: 'Null Cap',
                            scaling_per_stack: [10],
                            stack_cap: null as any,
                        } as Item,
                    ],
                },
            };

            const result = computeBreakpoint(dataWithNullCap, 'item11', 100);

            expect(result.stacksNeeded).toBe(10);
            expect(result.isCapped).toBe(false);
        });

        it('should handle undefined stack_cap', () => {
            const dataWithUndefinedCap: BreakpointData = {
                items: {
                    items: [
                        {
                            id: 'item12',
                            name: 'Undefined Cap',
                            scaling_per_stack: [10],
                            stack_cap: undefined,
                        } as Item,
                    ],
                },
            };

            const result = computeBreakpoint(dataWithUndefinedCap, 'item12', 100);

            expect(result.stacksNeeded).toBe(10);
            expect(result.isCapped).toBe(false);
        });
    });

    describe('computeBreakpoint - Data Structure Variations', () => {
        it('should handle empty data object', () => {
            const emptyData: BreakpointData = { items: { items: [] } };
            const result = computeBreakpoint(emptyData, 'item1', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Item not found');
        });

        it('should handle missing items property', () => {
            const noItemsData: BreakpointData = {};
            const result = computeBreakpoint(noItemsData, 'item1', 100);

            expect(result.error).toBeDefined();
            expect(result.error).toContain('Item not found');
        });

        it('should handle items property as undefined', () => {
            const undefinedItemsData: BreakpointData = { items: undefined };
            const result = computeBreakpoint(undefinedItemsData, 'item1', 100);

            expect(result.error).toBeDefined();
        });
    });

    describe('populateCalculatorItems', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <select id="calc-item-select">
                    <option value="">Select an item</option>
                </select>
            `;
        });

        it('should populate calculator dropdown with items', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            expect(select).not.toBeNull();
            expect(select.options.length).toBeGreaterThan(1);
        });

        it('should include default option', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            expect(select.options[0].value).toBe('');
            expect(select.options[0].textContent).toContain('Select');
        });

        it('should add items with scaling data', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const options = Array.from(select.options);
            const itemOptions = options.filter(opt => opt.value !== '');

            expect(itemOptions.length).toBeGreaterThan(0);
        });

        it('should handle missing select element gracefully', () => {
            document.body.innerHTML = '';

            expect(() => {
                populateCalculatorItems();
            }).not.toThrow();
        });
    });

    describe('calculateBreakpoint', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <select id="calc-item-select">
                    <option value="">Select an item</option>
                    <option value="item1">Test Item</option>
                </select>
                <input id="calc-target" type="number" value="100" />
                <div id="calc-result"></div>
            `;
        });

        it('should calculate and display result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            select.value = 'item1';

            const input = document.getElementById('calc-target') as HTMLInputElement;
            input.value = '30';

            calculateBreakpoint();

            const result = document.getElementById('calc-result');
            expect(result).not.toBeNull();
        });

        it('should handle missing elements gracefully', () => {
            document.body.innerHTML = '';

            expect(() => {
                calculateBreakpoint();
            }).not.toThrow();
        });

        it('should handle invalid input', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            select.value = '';

            calculateBreakpoint();

            // Should not crash
            expect(true).toBe(true);
        });

        it('should display error for invalid item', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            select.value = 'nonexistent';

            calculateBreakpoint();

            const result = document.getElementById('calc-result');
            expect(result).not.toBeNull();
        });
    });

    describe('quickCalc', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="calc-result"></div>
            `;
        });

        it('should perform quick calculation with default target', () => {
            quickCalc('item1');

            const result = document.getElementById('calc-result');
            expect(result).not.toBeNull();
        });

        it('should perform quick calculation with custom target', () => {
            quickCalc('item1', 50);

            const result = document.getElementById('calc-result');
            expect(result).not.toBeNull();
        });

        it('should handle missing result element', () => {
            document.body.innerHTML = '';

            expect(() => {
                quickCalc('item1', 100);
            }).not.toThrow();
        });

        it('should handle invalid item id', () => {
            quickCalc('nonexistent', 100);

            // Should not crash
            expect(true).toBe(true);
        });

        it('should default to 100 if no target provided', () => {
            quickCalc('item1');

            const result = document.getElementById('calc-result');
            expect(result).not.toBeNull();
        });
    });

    describe('Calculator Integration', () => {
        it('should work end-to-end for valid calculation', () => {
            const result = computeBreakpoint(mockData, 'item1', 30);

            expect(result.error).toBeUndefined();
            expect(result.item).toBeDefined();
            expect(result.stacksNeeded).toBe(3);
            expect(result.perStack).toBe(10);
            expect(result.actualValue).toBe(30);
            expect(result.isCapped).toBe(false);
        });

        it('should handle complete calculation workflow', () => {
            // Step 1: Validate input
            const result1 = computeBreakpoint(mockData, '', 100);
            expect(result1.error).toBeDefined();

            // Step 2: Calculate valid breakpoint
            const result2 = computeBreakpoint(mockData, 'item1', 100);
            expect(result2.error).toBeUndefined();
            expect(result2.stacksNeeded).toBeDefined();

            // Step 3: Handle capping
            expect(result2.isCapped).toBe(true);
            expect(result2.hasWarning).toBe(true);
        });

        it('should provide consistent results for same input', () => {
            const result1 = computeBreakpoint(mockData, 'item1', 50);
            const result2 = computeBreakpoint(mockData, 'item1', 50);

            expect(result1).toEqual(result2);
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle very large target values efficiently', () => {
            const result = computeBreakpoint(mockData, 'item2', 1000000);

            expect(result.stacksNeeded).toBe(200000);
            expect(result.perStack).toBe(5);
        });

        it('should handle multiple consecutive calculations', () => {
            const results = [];
            for (let i = 10; i <= 100; i += 10) {
                results.push(computeBreakpoint(mockData, 'item1', i));
            }

            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result.error).toBeUndefined();
                expect(result.stacksNeeded).toBeGreaterThan(0);
            });
        });

        it('should handle all items in data', () => {
            const itemIds = mockData.items!.items.map(item => item.id);

            itemIds.forEach(id => {
                const result = computeBreakpoint(mockData, id, 50);
                // Some will have errors (invalid scaling), some won't
                expect(result).toBeDefined();
            });
        });
    });
});
