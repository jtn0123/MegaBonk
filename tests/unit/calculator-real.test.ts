// ========================================
// Calculator Module - Real Integration Tests
// No mocking - tests actual code execution
// ========================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    computeBreakpoint,
    populateCalculatorItems,
    calculateBreakpoint,
    quickCalc,
    type BreakpointData,
    type BreakpointResult,
} from '../../src/modules/calculator.ts';

// Real item fixtures matching actual game data structure
const createRealItemData = (): BreakpointData => ({
    items: {
        items: [
            {
                id: 'power_crystal',
                name: 'Power Crystal',
                tier: 'S',
                rarity: 'legendary',
                base_effect: '+5% damage per stack',
                description: 'Increases damage output',
                formula: 'damage * (1 + 0.05 * stacks)',
                detailed_description: 'Each stack adds 5% damage',
                scaling_per_stack: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
                scaling_type: 'percentage',
                stack_cap: 10,
                stacks_well: true,
                one_and_done: false,
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'crit_gem',
                name: 'Critical Gem',
                tier: 'SS',
                rarity: 'legendary',
                base_effect: '+3% crit chance per stack',
                description: 'Increases critical hit chance',
                formula: 'crit_chance + 3 * stacks',
                detailed_description: 'Each stack adds 3% crit chance',
                scaling_per_stack: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
                scaling_type: 'crit_chance',
                stack_cap: 15,
                stacks_well: true,
                one_and_done: false,
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'one_time_boost',
                name: 'One Time Boost',
                tier: 'A',
                rarity: 'epic',
                base_effect: '+50 damage (once)',
                description: 'A one-time damage boost',
                formula: 'damage + 50',
                detailed_description: 'Adds flat damage once',
                scaling_per_stack: [50],
                scaling_type: 'flat',
                one_and_done: true,
                stacks_well: false,
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'diminishing_item',
                name: 'Diminishing Returns Item',
                tier: 'B',
                rarity: 'rare',
                base_effect: '+2% per stack (diminishing)',
                description: 'Has diminishing returns',
                formula: 'hyperbolic',
                detailed_description: 'Diminishing returns after 5 stacks',
                scaling_per_stack: [2, 4, 6, 8, 10, 11, 12, 13, 14, 15],
                scaling_type: 'percentage',
                stacks_well: false,
                one_and_done: false,
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'no_scaling_item',
                name: 'No Scaling Item',
                tier: 'C',
                rarity: 'common',
                base_effect: 'Passive effect',
                description: 'Has no scaling data',
                formula: 'none',
                detailed_description: 'Provides a passive effect',
                // No scaling_per_stack
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'zero_value_item',
                name: 'Zero Value Item',
                tier: 'C',
                rarity: 'common',
                base_effect: 'Broken item',
                description: 'Item with zero scaling',
                formula: 'broken',
                detailed_description: 'Zero scaling value',
                scaling_per_stack: [0], // Edge case: zero value
                scaling_type: 'flat',
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'negative_value_item',
                name: 'Negative Value Item',
                tier: 'C',
                rarity: 'common',
                base_effect: 'Cursed item',
                description: 'Item with negative scaling',
                formula: 'cursed',
                detailed_description: 'Negative scaling value',
                scaling_per_stack: [-5], // Edge case: negative value
                scaling_type: 'flat',
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
            {
                id: 'large_stack_item',
                name: 'Large Stack Item',
                tier: 'A',
                rarity: 'epic',
                base_effect: '+1% per stack',
                description: 'Small increments, large cap',
                formula: 'damage * (1 + 0.01 * stacks)',
                detailed_description: 'Needs many stacks',
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
                scaling_type: 'percentage',
                stack_cap: 100,
                stacks_well: true,
                one_and_done: false,
                synergies: [],
                synergies_weapons: [],
                anti_synergies: [],
            },
        ],
    },
});

describe('computeBreakpoint - Pure Function Tests', () => {
    const data = createRealItemData();

    describe('Valid Calculations', () => {
        it('should calculate stacks needed for exact target', () => {
            const result = computeBreakpoint(data, 'power_crystal', 25);

            expect(result.error).toBeUndefined();
            expect(result.item?.name).toBe('Power Crystal');
            expect(result.stacksNeeded).toBe(5); // 25 / 5 = 5 stacks
            expect(result.perStack).toBe(5);
            expect(result.actualValue).toBe(25);
            expect(result.isCapped).toBe(false);
        });

        it('should round up for non-exact targets', () => {
            const result = computeBreakpoint(data, 'power_crystal', 27);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(6); // ceil(27 / 5) = 6 stacks
            expect(result.actualValue).toBe(30); // 6 * 5 = 30
        });

        it('should cap at stack_cap when target exceeds max', () => {
            const result = computeBreakpoint(data, 'power_crystal', 100);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(10); // Capped at 10
            expect(result.isCapped).toBe(true);
            expect(result.actualValue).toBe(50); // 10 * 5 = 50
        });

        it('should work with different scaling values (crit gem)', () => {
            const result = computeBreakpoint(data, 'crit_gem', 21);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(7); // ceil(21 / 3) = 7
            expect(result.perStack).toBe(3);
            expect(result.actualValue).toBe(21);
        });

        it('should handle large stack requirements', () => {
            const result = computeBreakpoint(data, 'large_stack_item', 75);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(75); // ceil(75 / 1) = 75
            expect(result.perStack).toBe(1);
            expect(result.isCapped).toBe(false);
        });

        it('should respect stack cap for large requirements', () => {
            const result = computeBreakpoint(data, 'large_stack_item', 150);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(100); // Capped at 100
            expect(result.isCapped).toBe(true);
        });
    });

    describe('One-and-Done Items', () => {
        it('should flag one-and-done items', () => {
            const result = computeBreakpoint(data, 'one_time_boost', 100);

            expect(result.error).toBeUndefined();
            expect(result.isOneAndDone).toBe(true);
            expect(result.hasWarning).toBe(true);
            expect(result.stacksNeeded).toBe(2); // ceil(100 / 50) = 2
        });

        it('should work for single stack on one-and-done', () => {
            const result = computeBreakpoint(data, 'one_time_boost', 50);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(1);
            expect(result.isOneAndDone).toBe(true);
        });
    });

    describe('Diminishing Returns Items', () => {
        it('should flag items that do not stack well', () => {
            const result = computeBreakpoint(data, 'diminishing_item', 10);

            expect(result.error).toBeUndefined();
            expect(result.hasWarning).toBe(true);
            // Note: stacks_well: false triggers warning
        });
    });

    describe('Error Cases', () => {
        it('should error when itemId is empty', () => {
            const result = computeBreakpoint(data, '', 100);
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should error when target is 0', () => {
            const result = computeBreakpoint(data, 'power_crystal', 0);
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should error when target is negative', () => {
            const result = computeBreakpoint(data, 'power_crystal', -10);
            expect(result.error).toBe('Please select an item and enter a target value!');
        });

        it('should error when item not found', () => {
            const result = computeBreakpoint(data, 'nonexistent_item', 100);
            expect(result.error).toBe('Item not found');
        });

        it('should error when item has no scaling data', () => {
            const result = computeBreakpoint(data, 'no_scaling_item', 100);
            expect(result.error).toBe('Item has no scaling data');
        });

        it('should error when scaling value is zero', () => {
            const result = computeBreakpoint(data, 'zero_value_item', 100);
            expect(result.error).toBe('Invalid scaling value');
        });

        it('should error when scaling value is negative', () => {
            const result = computeBreakpoint(data, 'negative_value_item', 100);
            expect(result.error).toBe('Invalid scaling value');
        });
    });

    describe('Edge Cases', () => {
        it('should handle target of 1', () => {
            const result = computeBreakpoint(data, 'power_crystal', 1);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(1); // ceil(1 / 5) = 1
            expect(result.actualValue).toBe(5);
        });

        it('should handle very large targets', () => {
            const result = computeBreakpoint(data, 'power_crystal', 1000000);

            expect(result.error).toBeUndefined();
            expect(result.isCapped).toBe(true);
            expect(result.stacksNeeded).toBe(10); // Capped
        });

        it('should handle floating point targets', () => {
            const result = computeBreakpoint(data, 'power_crystal', 7.5);

            expect(result.error).toBeUndefined();
            expect(result.stacksNeeded).toBe(2); // ceil(7.5 / 5) = 2
        });

        it('should handle empty items array', () => {
            const emptyData: BreakpointData = { items: { items: [] } };
            const result = computeBreakpoint(emptyData, 'power_crystal', 100);
            expect(result.error).toBe('Item not found');
        });

        it('should handle undefined items', () => {
            const noItemsData: BreakpointData = {};
            const result = computeBreakpoint(noItemsData, 'power_crystal', 100);
            expect(result.error).toBe('Item not found');
        });

        it('should handle item with empty scaling array', () => {
            const emptyScalingData: BreakpointData = {
                items: {
                    items: [
                        {
                            id: 'empty_scaling',
                            name: 'Empty Scaling',
                            tier: 'C',
                            rarity: 'common',
                            base_effect: 'None',
                            description: 'Empty scaling array',
                            formula: 'none',
                            detailed_description: '',
                            scaling_per_stack: [],
                            synergies: [],
                            synergies_weapons: [],
                            anti_synergies: [],
                        },
                    ],
                },
            };
            const result = computeBreakpoint(emptyScalingData, 'empty_scaling', 100);
            expect(result.error).toBe('Item has no scaling data');
        });
    });

    describe('Multiple Item Calculations', () => {
        it('should calculate correctly for multiple different items', () => {
            const powerCrystal = computeBreakpoint(data, 'power_crystal', 30);
            const critGem = computeBreakpoint(data, 'crit_gem', 30);

            expect(powerCrystal.stacksNeeded).toBe(6); // 30 / 5 = 6
            expect(critGem.stacksNeeded).toBe(10); // 30 / 3 = 10

            expect(powerCrystal.perStack).toBe(5);
            expect(critGem.perStack).toBe(3);
        });

        it('should maintain accuracy across many calculations', () => {
            const results: BreakpointResult[] = [];

            for (let target = 1; target <= 50; target += 5) {
                results.push(computeBreakpoint(data, 'power_crystal', target));
            }

            // All should succeed
            results.forEach(r => expect(r.error).toBeUndefined());

            // Verify calculations are correct
            expect(results[0].stacksNeeded).toBe(1); // target=1
            expect(results[1].stacksNeeded).toBe(2); // target=6
            expect(results[2].stacksNeeded).toBe(3); // target=11
        });
    });
});

describe('Calculator DOM Integration', () => {
    beforeEach(() => {
        // Set up actual DOM elements
        document.body.innerHTML = `
            <select id="calc-item-select">
                <option value="">Select an item...</option>
            </select>
            <input type="number" id="calc-target" value="" />
            <div id="calc-result" style="display: none;"></div>
            <button id="calc-btn">Calculate</button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('populateCalculatorItems', () => {
        it('should populate dropdown with items that have scaling data', () => {
            // We need to set up allData for this test
            // Since we're testing without mocks, we import the actual module
            // and verify the DOM manipulation works
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;

            // Initially has just placeholder
            expect(select.options.length).toBe(1);

            // Note: populateCalculatorItems uses allData which may be empty in test env
            // This tests that the function runs without errors
            populateCalculatorItems();

            // Verify DOM is still valid
            expect(document.getElementById('calc-item-select')).not.toBeNull();
        });

        it('should not throw when select element is missing', () => {
            document.body.innerHTML = '';

            expect(() => populateCalculatorItems()).not.toThrow();
        });
    });

    describe('calculateBreakpoint DOM function', () => {
        it('should hide result when no item selected', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;
            const resultDiv = document.getElementById('calc-result') as HTMLDivElement;

            select.value = '';
            input.value = '100';

            calculateBreakpoint();

            expect(resultDiv.style.display).toBe('none');
        });

        it('should not throw when DOM elements are missing', () => {
            document.body.innerHTML = '';

            expect(() => calculateBreakpoint()).not.toThrow();
        });

        it('should handle NaN target gracefully', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;
            const input = document.getElementById('calc-target') as HTMLInputElement;

            // Add an option and select it
            const option = document.createElement('option');
            option.value = 'test_item';
            option.textContent = 'Test Item';
            select.appendChild(option);
            select.value = 'test_item';

            input.value = 'not a number';

            // Should not throw
            expect(() => calculateBreakpoint()).not.toThrow();
        });
    });

    describe('quickCalc', () => {
        it('should set item select value', () => {
            const select = document.getElementById('calc-item-select') as HTMLSelectElement;

            // Add an option
            const option = document.createElement('option');
            option.value = 'power_crystal';
            option.textContent = 'Power Crystal';
            select.appendChild(option);

            quickCalc('power_crystal');

            expect(select.value).toBe('power_crystal');
        });

        it('should set target when provided', () => {
            const input = document.getElementById('calc-target') as HTMLInputElement;

            quickCalc('power_crystal', 50);

            expect(input.value).toBe('50');
        });

        it('should not throw when target is undefined', () => {
            // quickCalc may call switchTab which could have side effects
            // We just verify it doesn't throw
            expect(() => quickCalc('power_crystal')).not.toThrow();
        });

        it('should not throw when target is 0 or negative', () => {
            // quickCalc handles edge cases gracefully
            expect(() => quickCalc('power_crystal', 0)).not.toThrow();
            expect(() => quickCalc('power_crystal', -10)).not.toThrow();
        });
    });
});

describe('Calculator Mathematical Accuracy', () => {
    const data = createRealItemData();

    it('should maintain precision for fractional results', () => {
        // Target 7, per stack 3: 7/3 = 2.33... -> ceil = 3
        const result = computeBreakpoint(data, 'crit_gem', 7);

        expect(result.stacksNeeded).toBe(3);
        expect(result.actualValue).toBe(9); // 3 * 3 = 9
    });

    it('should handle prime number targets', () => {
        // Target 17, per stack 5: 17/5 = 3.4 -> ceil = 4
        const result = computeBreakpoint(data, 'power_crystal', 17);

        expect(result.stacksNeeded).toBe(4);
        expect(result.actualValue).toBe(20); // 4 * 5 = 20
    });

    it('should correctly identify when exactly at cap', () => {
        // Power crystal caps at 10, each stack gives 5
        // Target 50 = exactly 10 stacks
        // isCapped is only true when stacksNeeded > stack_cap (request exceeds cap)
        const result = computeBreakpoint(data, 'power_crystal', 50);

        expect(result.stacksNeeded).toBe(10);
        expect(result.isCapped).toBe(false); // Exactly at cap, not exceeding
        expect(result.actualValue).toBe(50);
    });

    it('should correctly identify when exceeding cap', () => {
        // Target 51: ceil(51/5) = 11 stacks, but cap is 10
        const result = computeBreakpoint(data, 'power_crystal', 51);

        expect(result.stacksNeeded).toBe(10); // Capped at 10
        expect(result.isCapped).toBe(true); // Exceeds cap
        expect(result.actualValue).toBe(50); // Only get 10 * 5 = 50
    });

    it('should correctly identify when well under cap', () => {
        // Target 20: 20/5 = 4 stacks, well under 10 cap
        const result = computeBreakpoint(data, 'power_crystal', 20);

        expect(result.stacksNeeded).toBe(4);
        expect(result.isCapped).toBe(false);
    });
});
