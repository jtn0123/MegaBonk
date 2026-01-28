/**
 * Calculator Module - Comprehensive DOM Tests
 * Tests for calculateBreakpoint DOM rendering and quickCalc
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock dependencies
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

// Mock registry to prevent actual cross-module calls during tests
vi.mock('../../src/modules/registry.ts', () => ({
    callFunction: vi.fn(),
    registerFunction: vi.fn(),
    getFunction: vi.fn(),
    isRegistered: vi.fn(),
    unregisterFunction: vi.fn(),
    clearRegistry: vi.fn(),
    getRegisteredFunctions: vi.fn(() => []),
}));

// Use vi.hoisted to create mock functions that can be used in vi.mock factory
const { mockToastWarning, mockToastError, mockToastSuccess, mockToastInfo } = vi.hoisted(() => ({
    mockToastWarning: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastInfo: vi.fn(),
}));

// Mock ToastManager module
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        warning: mockToastWarning,
        error: mockToastError,
        success: mockToastSuccess,
        info: mockToastInfo,
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeSetValue: vi.fn((id: string, value: string) => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
        if (el) el.value = value;
    }),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'test-item',
                    name: 'Test Item',
                    scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                    scaling_type: 'damage',
                    formula: 'damage * stacks * 10',
                },
                {
                    id: 'percentage-item',
                    name: 'Percentage Item',
                    scaling_per_stack: [5, 10, 15, 20, 25],
                    scaling_type: 'percentage chance',
                    formula: 'chance + 5%',
                },
                {
                    id: 'capped-item',
                    name: 'Capped Item',
                    scaling_per_stack: [8, 16, 24],
                    scaling_type: 'flat',
                    formula: '8 per stack',
                    stack_cap: 5,
                },
                {
                    id: 'one-and-done',
                    name: 'One And Done Item',
                    scaling_per_stack: [100],
                    scaling_type: 'flat',
                    formula: 'fixed 100',
                    one_and_done: true,
                },
                {
                    id: 'poor-stacking',
                    name: 'Poor Stacking Item',
                    scaling_per_stack: [10, 15, 18, 20],
                    scaling_type: 'diminishing',
                    formula: 'complex',
                    stacks_well: false,
                },
                {
                    id: 'zero-scaling',
                    name: 'Zero Scaling Item',
                    scaling_per_stack: [0],
                    scaling_type: 'none',
                    formula: 'broken',
                },
                {
                    id: 'no-scaling-array',
                    name: 'No Scaling Array',
                    description: 'Has no scaling data',
                },
            ],
        },
    },
}));

// Declare switchTab globally
(window as any).switchTab = vi.fn();

import {
    calculateBreakpoint,
    populateCalculatorItems,
    quickCalc,
} from '../../src/modules/calculator.ts';

describe('Calculator Module - DOM Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();

        // Add calculator-specific DOM elements
        document.body.innerHTML += `
            <select id="calc-item-select">
                <option value="">Select an item...</option>
            </select>
            <input type="number" id="calc-target" value="">
            <div id="calc-result" style="display: none;"></div>
        `;

        (window as any).switchTab = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // populateCalculatorItems Tests
    // ========================================
    describe('populateCalculatorItems', () => {
        it('should populate select with items that have scaling_per_stack', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            // Should have placeholder + items with scaling
            expect(select.options.length).toBeGreaterThan(1);
        });

        it('should preserve placeholder option', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            expect(select.options[0].value).toBe('');
            // Placeholder might be set by the actual module
            expect(select.options[0].textContent).toContain('item');
        });

        it('should not add items without scaling_per_stack', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const options = Array.from(select.options);
            const hasNoScaling = options.some(opt => opt.value === 'no-scaling-array');
            expect(hasNoScaling).toBe(false);
        });

        it('should clear existing options before repopulating', () => {
            // First population
            populateCalculatorItems();
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const firstCount = select.options.length;

            // Second population
            populateCalculatorItems();
            const secondCount = select.options.length;

            expect(secondCount).toBe(firstCount);
        });

        it('should handle missing select element gracefully', () => {
            document.getElementById('calc-item-select')?.remove();

            expect(() => populateCalculatorItems()).not.toThrow();
        });

        it('should set item name as option text', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const options = Array.from(select.options);
            const testOption = options.find(opt => opt.value === 'test-item');
            expect(testOption?.textContent).toBe('Test Item');
        });

        it('should set item id as option value', () => {
            populateCalculatorItems();

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const options = Array.from(select.options);
            const hasTestItem = options.some(opt => opt.value === 'test-item');
            expect(hasTestItem).toBe(true);
        });
    });

    // ========================================
    // calculateBreakpoint DOM Tests
    // ========================================
    describe('calculateBreakpoint - DOM Integration', () => {
        beforeEach(() => {
            populateCalculatorItems();
        });

        it('should hide result when no item selected', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const result = document.getElementById('calc-result');

            select.value = '';
            calculateBreakpoint();

            expect(result?.style.display).toBe('none');
        });

        it('should show warning for invalid target', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = '0';

            calculateBreakpoint();

            expect(mockToastWarning).toHaveBeenCalledWith(
                'Please enter a valid target value'
            );
        });

        it('should show warning for negative target', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = '-10';

            calculateBreakpoint();

            expect(mockToastWarning).toHaveBeenCalledWith(
                'Please enter a valid target value'
            );
        });

        it('should show warning for NaN target', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = 'not-a-number';

            calculateBreakpoint();

            expect(mockToastWarning).toHaveBeenCalledWith(
                'Please enter a valid target value'
            );
        });

        it('should show error for item with zero scaling', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            // Add zero-scaling item to select
            const option = document.createElement('option');
            option.value = 'zero-scaling';
            option.textContent = 'Zero Scaling Item';
            select.appendChild(option);

            select.value = 'zero-scaling';
            input.value = '100';

            calculateBreakpoint();

            expect(mockToastWarning).toHaveBeenCalledWith(
                'Invalid scaling value for this item'
            );
        });

        it('should display result div on successful calculation', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.style.display).toBe('block');
        });

        it('should display item name in result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('Test Item');
        });

        it('should display target value in result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('50');
        });

        it('should display stacks needed in result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            // 50 / 10 per stack = 5 stacks
            expect(result?.innerHTML).toContain('5');
        });

        it('should display percentage unit for percentage scaling', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'percentage-item';
            input.value = '25';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('%');
        });

        it('should display stack cap warning when capped', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'capped-item';
            input.value = '100'; // Would need more than cap

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('caps at');
            expect(result?.innerHTML).toContain('5');
        });

        it('should display one-and-done warning', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'one-and-done';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('one-and-done');
            expect(result?.innerHTML).toContain('no benefit');
        });

        it('should display stacks_well warning', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'poor-stacking';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('diminishing returns');
        });

        it('should display bar graph visualization', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('bar-container');
            expect(result?.innerHTML).toContain('bar-label');
        });

        it('should highlight target stack in bar graph', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('highlight');
        });

        it('should display formula in result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('Formula');
            expect(result?.innerHTML).toContain('damage * stacks * 10');
        });

        it('should display per stack value in result', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(result?.innerHTML).toContain('Per Stack');
            expect(result?.innerHTML).toContain('+10');
        });

        it('should log calculation event', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'calculator.compute',
                    success: true,
                })
            );
        });

        it('should handle missing DOM elements gracefully', () => {
            document.body.innerHTML = '';

            expect(() => calculateBreakpoint()).not.toThrow();
        });

        it('should handle missing result div gracefully', () => {
            document.getElementById('calc-result')?.remove();
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = '50';

            expect(() => calculateBreakpoint()).not.toThrow();
        });
    });

    // ========================================
    // quickCalc Tests
    // ========================================
    describe('quickCalc', () => {
        beforeEach(() => {
            populateCalculatorItems();
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should set item in calculator select', () => {
            quickCalc('test-item');

            // safeSetValue mock should have been called to set the item
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            expect(select.value).toBe('test-item');
        });

        it('should set target value when provided', () => {
            quickCalc('test-item', 100);

            const input = document.getElementById('calc-target') as HTMLInputElement;
            expect(input.value).toBe('100');
        });

        it('should not set target value when not provided', () => {
            const input = document.getElementById('calc-target') as HTMLInputElement;
            input.value = '';

            quickCalc('test-item');

            // Target should remain empty
            expect(input.value).toBe('');
        });

        it('should not set target value when zero', () => {
            const input = document.getElementById('calc-target') as HTMLInputElement;
            input.value = '';

            quickCalc('test-item', 0);

            // Target should remain empty since 0 is not positive
            expect(input.value).toBe('');
        });

        it('should not set target value when negative', () => {
            const input = document.getElementById('calc-target') as HTMLInputElement;
            input.value = '';

            quickCalc('test-item', -10);

            // Target should remain empty since -10 is not positive
            expect(input.value).toBe('');
        });

        it('should auto-calculate after delay when target provided', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            select.value = 'test-item';
            input.value = '100';

            quickCalc('test-item', 100);

            // Advance timer past the 100ms delay
            vi.advanceTimersByTime(150);

            // Result should now be displayed
            const result = document.getElementById('calc-result');
            expect(result?.style.display).toBe('block');
        });

        it('should handle missing switchTab function gracefully', () => {
            // switchTab is accessed via typeof check in the module
            // This test verifies no error is thrown
            expect(() => quickCalc('test-item')).not.toThrow();
        });
    });

    // ========================================
    // renderResults Tests (via calculateBreakpoint)
    // ========================================
    describe('renderResults - Bar Graph', () => {
        beforeEach(() => {
            populateCalculatorItems();
        });

        it('should create bar for each scaling value', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            // Test item has 10 scaling values
            const bars = result?.querySelectorAll('.bar-container');
            expect(bars?.length).toBe(10);
        });

        it('should scale bar heights relative to max value', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            // Last bar should have 100% height (max value)
            const bars = result?.querySelectorAll('.bar');
            const lastBar = bars?.[bars.length - 1] as HTMLElement;
            expect(lastBar?.style.height).toBe('100%');
        });

        it('should label bars with stack numbers', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            const labels = result?.querySelectorAll('.bar-label');
            expect(labels?.[0]?.textContent).toBe('1');
            expect(labels?.[4]?.textContent).toBe('5');
        });

        it('should handle empty scaling array gracefully', () => {
            // Add item with empty scaling to select
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            const option = document.createElement('option');
            option.value = 'empty-scaling';
            option.textContent = 'Empty';
            select.appendChild(option);

            select.value = 'empty-scaling';
            input.value = '50';

            // Should show error toast since item doesn't exist in mock data
            calculateBreakpoint();

            expect(mockToastError).toHaveBeenCalled();
        });
    });

    // ========================================
    // Edge Case Tests
    // ========================================
    describe('Edge Cases', () => {
        beforeEach(() => {
            populateCalculatorItems();
        });

        it('should handle target exactly at stack cap', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            // Add capped-item to select (has cap of 5)
            select.value = 'capped-item';
            // Target of 40: 8 per stack * 5 (cap) = 40
            input.value = '40';

            calculateBreakpoint();

            // Should show result with cap warning
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('caps at');
            expect(result?.innerHTML).toContain('5');
        });

        it('should handle decimal/non-integer target values', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '15.5'; // Non-integer target

            calculateBreakpoint();

            // Should round up to 2 stacks (10 + 10 = 20 >= 15.5)
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('2'); // 2 stacks needed
        });

        it('should handle very large target values', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '10000'; // Very large target

            calculateBreakpoint();

            // Should calculate correctly: 10000 / 10 = 1000 stacks
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('1000');
        });

        it('should handle single-value scaling array', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            // one-and-done item has scaling_per_stack: [100]
            select.value = 'one-and-done';
            input.value = '50';

            calculateBreakpoint();

            // Should still calculate and render
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('one-and-done');
        });

        it('should normalize bar heights when values vary significantly', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            // test-item has scaling [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
            select.value = 'test-item';
            input.value = '50';

            calculateBreakpoint();

            // Check that bars are rendered with varying heights
            const bars = result?.querySelectorAll('.bar');
            expect(bars?.length).toBe(10);

            // Last bar should be 100% (max value)
            const lastBar = bars?.[9] as HTMLElement;
            expect(lastBar?.style.height).toBe('100%');

            // First bar should be 10% (10/100 = 10%)
            const firstBar = bars?.[0] as HTMLElement;
            expect(firstBar?.style.height).toBe('10%');
        });

        it('should handle target value of 1', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '1';

            calculateBreakpoint();

            // Should need 1 stack (10 >= 1)
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('1');
        });

        it('should handle exact multiple of perStack', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const result = document.getElementById('calc-result');

            select.value = 'test-item';
            input.value = '30'; // Exact multiple: 3 * 10 = 30

            calculateBreakpoint();

            // Should need exactly 3 stacks
            expect(result?.style.display).toBe('block');
            expect(result?.innerHTML).toContain('3');
        });
    });
});

// ========================================
// computeBreakpoint Pure Function Tests
// ========================================
import { computeBreakpoint, type BreakpointData } from '../../src/modules/calculator.ts';

describe('computeBreakpoint - Pure Function', () => {
    const mockData: BreakpointData = {
        items: {
            items: [
                {
                    id: 'test-item',
                    name: 'Test Item',
                    scaling_per_stack: [10, 20, 30, 40, 50],
                    scaling_type: 'damage',
                    formula: 'damage * 10',
                } as any,
                {
                    id: 'capped-item',
                    name: 'Capped Item',
                    scaling_per_stack: [8, 16, 24],
                    scaling_type: 'flat',
                    formula: '8 per stack',
                    stack_cap: 5,
                } as any,
                {
                    id: 'zero-scaling',
                    name: 'Zero Scaling',
                    scaling_per_stack: [0],
                    scaling_type: 'none',
                } as any,
                {
                    id: 'one-and-done',
                    name: 'One And Done',
                    scaling_per_stack: [100],
                    one_and_done: true,
                } as any,
                {
                    id: 'bad-stacker',
                    name: 'Bad Stacker',
                    scaling_per_stack: [10, 15, 18],
                    stacks_well: false,
                } as any,
            ],
        },
    };

    it('should return error when no item ID provided', () => {
        const result = computeBreakpoint(mockData, '', 100);
        expect(result.error).toBeDefined();
    });

    it('should return error when no target provided', () => {
        const result = computeBreakpoint(mockData, 'test-item', 0);
        expect(result.error).toBeDefined();
    });

    it('should return error when target is negative', () => {
        const result = computeBreakpoint(mockData, 'test-item', -10);
        expect(result.error).toBeDefined();
    });

    it('should return error when item not found', () => {
        const result = computeBreakpoint(mockData, 'nonexistent', 100);
        expect(result.error).toBe('Item not found');
    });

    it('should return error for item with zero scaling', () => {
        const result = computeBreakpoint(mockData, 'zero-scaling', 100);
        expect(result.error).toBe('Invalid scaling value');
    });

    it('should calculate correct stacks needed', () => {
        const result = computeBreakpoint(mockData, 'test-item', 50);
        expect(result.stacksNeeded).toBe(5); // 50 / 10 = 5
    });

    it('should round up stacks needed', () => {
        const result = computeBreakpoint(mockData, 'test-item', 55);
        expect(result.stacksNeeded).toBe(6); // ceil(55 / 10) = 6
    });

    it('should cap stacks at stack_cap', () => {
        const result = computeBreakpoint(mockData, 'capped-item', 100);
        expect(result.stacksNeeded).toBe(5); // Capped at 5
        expect(result.isCapped).toBe(true);
    });

    it('should not be capped when target exactly matches cap value', () => {
        const result = computeBreakpoint(mockData, 'capped-item', 40);
        // 40 / 8 = 5 stacks, which equals the cap but isn't exceeding it
        expect(result.stacksNeeded).toBe(5);
        // isCapped is only true when stacksNeeded > stack_cap (exceeded cap)
        expect(result.isCapped).toBe(false);
    });

    it('should flag one-and-done items', () => {
        const result = computeBreakpoint(mockData, 'one-and-done', 50);
        expect(result.isOneAndDone).toBe(true);
        expect(result.hasWarning).toBe(true);
    });

    it('should flag items that do not stack well', () => {
        const result = computeBreakpoint(mockData, 'bad-stacker', 50);
        expect(result.hasWarning).toBe(true);
    });

    it('should calculate correct actualValue', () => {
        const result = computeBreakpoint(mockData, 'test-item', 55);
        expect(result.actualValue).toBe(60); // 6 stacks * 10 = 60
    });

    it('should handle empty data gracefully', () => {
        const emptyData: BreakpointData = { items: { items: [] } };
        const result = computeBreakpoint(emptyData, 'test-item', 100);
        expect(result.error).toBe('Item not found');
    });

    it('should handle undefined items gracefully', () => {
        const undefinedData: BreakpointData = {};
        const result = computeBreakpoint(undefinedData, 'test-item', 100);
        expect(result.error).toBe('Item not found');
    });
});
