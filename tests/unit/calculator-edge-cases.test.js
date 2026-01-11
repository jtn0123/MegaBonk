import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockAllData } from '../helpers/mock-data.js';

// Import the calculator module
import { calculateBreakpoint, computeBreakpoint } from '../../src/modules/calculator.ts';

describe('Calculator Array Edge Cases', () => {
    let mockAllData;

    beforeEach(() => {
        createMinimalDOM();

        // Create calculator UI elements
        const calcSelect = document.createElement('select');
        calcSelect.id = 'calc-item-select';
        document.body.appendChild(calcSelect);

        const calcInput = document.createElement('input');
        calcInput.id = 'calc-target-input';
        calcInput.type = 'number';
        document.body.appendChild(calcInput);

        const calcResult = document.createElement('div');
        calcResult.id = 'calc-result';
        document.body.appendChild(calcResult);

        // Set up mock data
        mockAllData = createMockAllData();
    });

    describe('scaling_per_stack validation', () => {
        it('should return error for empty scaling_per_stack array', () => {
            const itemWithEmptyScaling = createMockItem({
                id: 'empty_scaling_item',
                name: 'Empty Scaling Item',
                scaling_per_stack: [],
            });

            mockAllData.items.items = [itemWithEmptyScaling];

            const result = computeBreakpoint(mockAllData, 'empty_scaling_item', 50);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for null scaling_per_stack', () => {
            const itemWithNullScaling = createMockItem({
                id: 'null_scaling_item',
                name: 'Null Scaling Item',
                scaling_per_stack: null,
            });

            mockAllData.items.items = [itemWithNullScaling];

            const result = computeBreakpoint(mockAllData, 'null_scaling_item', 50);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error for undefined scaling_per_stack', () => {
            const itemWithoutScaling = createMockItem({
                id: 'no_scaling_item',
                name: 'No Scaling Item',
            });
            delete itemWithoutScaling.scaling_per_stack;

            mockAllData.items.items = [itemWithoutScaling];

            const result = computeBreakpoint(mockAllData, 'no_scaling_item', 50);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should return error when first value is undefined', () => {
            const itemWithUndefinedFirst = createMockItem({
                id: 'undefined_first_item',
                name: 'Undefined First Item',
                scaling_per_stack: [undefined, 10, 20],
            });

            mockAllData.items.items = [itemWithUndefinedFirst];

            const result = computeBreakpoint(mockAllData, 'undefined_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is null', () => {
            const itemWithNullFirst = createMockItem({
                id: 'null_first_item',
                name: 'Null First Item',
                scaling_per_stack: [null, 10, 20],
            });

            mockAllData.items.items = [itemWithNullFirst];

            const result = computeBreakpoint(mockAllData, 'null_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is zero', () => {
            const itemWithZeroFirst = createMockItem({
                id: 'zero_first_item',
                name: 'Zero First Item',
                scaling_per_stack: [0, 10, 20],
            });

            mockAllData.items.items = [itemWithZeroFirst];

            const result = computeBreakpoint(mockAllData, 'zero_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is negative', () => {
            const itemWithNegativeFirst = createMockItem({
                id: 'negative_first_item',
                name: 'Negative First Item',
                scaling_per_stack: [-5, 10, 20],
            });

            mockAllData.items.items = [itemWithNegativeFirst];

            const result = computeBreakpoint(mockAllData, 'negative_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is NaN', () => {
            const itemWithNaNFirst = createMockItem({
                id: 'nan_first_item',
                name: 'NaN First Item',
                scaling_per_stack: [NaN, 10, 20],
            });

            mockAllData.items.items = [itemWithNaNFirst];

            const result = computeBreakpoint(mockAllData, 'nan_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is Infinity', () => {
            const itemWithInfinityFirst = createMockItem({
                id: 'infinity_first_item',
                name: 'Infinity First Item',
                scaling_per_stack: [Infinity, 10, 20],
            });

            mockAllData.items.items = [itemWithInfinityFirst];

            const result = computeBreakpoint(mockAllData, 'infinity_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should return error when first value is a string', () => {
            const itemWithStringFirst = createMockItem({
                id: 'string_first_item',
                name: 'String First Item',
                scaling_per_stack: ['10', 20, 30],
            });

            mockAllData.items.items = [itemWithStringFirst];

            const result = computeBreakpoint(mockAllData, 'string_first_item', 50);
            expect(result.error).toBe('Invalid scaling value');
        });
    });

    describe('valid scaling calculations', () => {
        it('should calculate correctly with valid positive first value', () => {
            const validItem = createMockItem({
                id: 'valid_item',
                name: 'Valid Item',
                scaling_per_stack: [10, 20, 30, 40, 50],
            });

            mockAllData.items.items = [validItem];

            const result = computeBreakpoint(mockAllData, 'valid_item', 50);
            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(5); // 50 / 10 = 5
        });

        it('should handle decimal first values', () => {
            const decimalItem = createMockItem({
                id: 'decimal_item',
                name: 'Decimal Item',
                scaling_per_stack: [2.5, 5, 7.5, 10],
            });

            mockAllData.items.items = [decimalItem];

            const result = computeBreakpoint(mockAllData, 'decimal_item', 10);
            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(4); // ceil(10 / 2.5) = 4
        });

        it('should cap stacks when stack_cap is reached', () => {
            const cappedItem = createMockItem({
                id: 'capped_item',
                name: 'Capped Item',
                scaling_per_stack: [10, 20, 30],
                stack_cap: 5,
            });

            mockAllData.items.items = [cappedItem];

            const result = computeBreakpoint(mockAllData, 'capped_item', 100);
            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(5); // Capped at 5, even though 100/10=10
            expect(result.isCapped).toBe(true);
        });
    });

    describe('item lookup', () => {
        it('should return error for non-existent item', () => {
            mockAllData.items.items = [];

            const result = computeBreakpoint(mockAllData, 'nonexistent_item', 50);
            expect(result.error).toBe('Item not found');
        });

        it('should find item by id correctly', () => {
            const testItem = createMockItem({
                id: 'test_lookup_item',
                name: 'Test Lookup Item',
                scaling_per_stack: [10, 20, 30],
            });

            mockAllData.items.items = [testItem];

            const result = computeBreakpoint(mockAllData, 'test_lookup_item', 30);
            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(3);
        });
    });
});
