import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock Chart.js
vi.mock('../../src/modules/chart-loader.ts', () => ({
    Chart: vi.fn().mockImplementation(function (ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.data = config.data;
        this.options = config.options;
        this.destroy = vi.fn();
    }),
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock data service
vi.mock('../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockReturnValue([]),
}));

// Import after mocks
import {
    applyHyperbolicScaling,
    generateHyperbolicValues,
    getEffectiveStackCap,
    calculateTomeProgression,
} from '../../src/modules/charts.ts';

describe('Charts Math Functions - Edge Cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    // ========================================
    // applyHyperbolicScaling Edge Cases
    // ========================================
    describe('applyHyperbolicScaling() - Edge Cases', () => {
        it('should handle negative values', () => {
            const values = [-10, -20, -30];
            const result = applyHyperbolicScaling(values, 1.0);

            // Negative values will produce negative results
            expect(result[0]).toBeLessThan(0);
            expect(result[1]).toBeLessThan(0);
            expect(result[2]).toBeLessThan(0);
        });

        it('should handle very small positive values', () => {
            // Values small enough that after rounding, they become 0
            const values = [0.001, 0.01, 0.1];
            const result = applyHyperbolicScaling(values, 1.0);

            // Very small values get rounded to 0 due to 2 decimal rounding
            // 0.001 / 100 = 0.00001, 0.00001 / 1.00001 ≈ 0.00001, * 100 = 0.001%, rounds to 0
            expect(result[0]).toBeGreaterThanOrEqual(0);
            expect(result[0]).toBeLessThanOrEqual(result[1]);
            expect(result[1]).toBeLessThanOrEqual(result[2]);
        });

        it('should handle very large values', () => {
            const values = [1000, 10000, 100000];
            const result = applyHyperbolicScaling(values, 1.0);

            // Very large values should approach but not exceed 100%
            result.forEach(val => {
                expect(val).toBeLessThan(100);
                expect(val).toBeGreaterThan(0);
            });

            // Should be close to asymptote
            expect(result[2]).toBeCloseTo(99.9, 0);
        });

        it('should handle zero constant', () => {
            // With constant = 0, formula becomes internal / internal = 1
            // Actually: actual = internal / (0 + internal) = 1 for all non-zero
            const values = [10, 20, 30];
            const result = applyHyperbolicScaling(values, 0);

            // All non-zero values should give 100% (since internal/internal = 1)
            result.forEach(val => {
                expect(val).toBe(100);
            });
        });

        it('should handle very large constant', () => {
            const values = [50];
            const result = applyHyperbolicScaling(values, 100);

            // With very large constant, values should be very small
            // 0.5 / (100 + 0.5) = ~0.005
            expect(result[0]).toBeLessThan(1);
        });

        it('should handle single element array', () => {
            const result = applyHyperbolicScaling([50], 1.0);

            expect(result.length).toBe(1);
            expect(result[0]).toBeCloseTo(33.33, 1);
        });

        it('should maintain array order', () => {
            const values = [5, 15, 10, 25, 20];
            const result = applyHyperbolicScaling(values, 1.0);

            // Result should maintain same relative order
            expect(result[0]).toBeLessThan(result[1]); // 5 < 15
            expect(result[2]).toBeLessThan(result[1]); // 10 < 15
            expect(result[3]).toBeGreaterThan(result[2]); // 25 > 10
        });

        it('should round to 2 decimal places', () => {
            const values = [33.333333];
            const result = applyHyperbolicScaling(values, 1.0);

            // Check that result has at most 2 decimal places
            const decimalPart = result[0].toString().split('.')[1];
            expect(decimalPart ? decimalPart.length : 0).toBeLessThanOrEqual(2);
        });

        it('should handle array with duplicate values', () => {
            const values = [10, 10, 10, 10];
            const result = applyHyperbolicScaling(values, 1.0);

            // All results should be the same
            expect(result[0]).toBe(result[1]);
            expect(result[1]).toBe(result[2]);
            expect(result[2]).toBe(result[3]);
        });

        it('should handle mixed positive and negative values', () => {
            const values = [-20, 0, 20];
            const result = applyHyperbolicScaling(values, 1.0);

            expect(result[0]).toBeLessThan(0);
            expect(result[1]).toBe(0);
            expect(result[2]).toBeGreaterThan(0);
        });

        it('should handle decimal constant', () => {
            const values = [50];
            const result1 = applyHyperbolicScaling(values, 0.5);
            const result2 = applyHyperbolicScaling(values, 1.5);

            // Smaller constant = higher result
            expect(result1[0]).toBeGreaterThan(result2[0]);
        });
    });

    // ========================================
    // generateHyperbolicValues Edge Cases
    // ========================================
    describe('generateHyperbolicValues() - Edge Cases', () => {
        it('should handle zero perStack', () => {
            const result = generateHyperbolicValues(0, 5, 1.0);

            expect(result.length).toBe(5);
            result.forEach(val => {
                expect(val).toBe(0);
            });
        });

        it('should handle negative perStack', () => {
            const result = generateHyperbolicValues(-5, 5, 1.0);

            expect(result.length).toBe(5);
            result.forEach(val => {
                expect(val).toBeLessThan(0);
            });
        });

        it('should handle very small perStack', () => {
            const result = generateHyperbolicValues(0.1, 10, 1.0);

            expect(result.length).toBe(10);
            expect(result[0]).toBeGreaterThan(0);
            expect(result[0]).toBeLessThan(1);
        });

        it('should handle very large perStack', () => {
            const result = generateHyperbolicValues(100, 5, 1.0);

            expect(result.length).toBe(5);
            // Even with 100% per stack, values won't exceed 100%
            result.forEach(val => {
                expect(val).toBeLessThan(100);
            });
        });

        it('should handle maxStacks of 1', () => {
            const result = generateHyperbolicValues(10, 1, 1.0);

            expect(result.length).toBe(1);
            expect(result[0]).toBeCloseTo(9.09, 1);
        });

        it('should handle very large maxStacks', () => {
            const result = generateHyperbolicValues(1, 100, 1.0);

            expect(result.length).toBe(100);
            // Later values should show diminishing returns
            const increment1 = result[1] - result[0];
            const increment99 = result[99] - result[98];
            expect(increment99).toBeLessThan(increment1);
        });

        it('should produce strictly increasing values', () => {
            const result = generateHyperbolicValues(5, 20, 1.0);

            for (let i = 1; i < result.length; i++) {
                expect(result[i]).toBeGreaterThan(result[i - 1]);
            }
        });

        it('should handle decimal perStack', () => {
            const result = generateHyperbolicValues(2.5, 5, 1.0);

            expect(result.length).toBe(5);
            // 2.5, 5, 7.5, 10, 12.5 internal values
            expect(result[0]).toBeCloseTo(2.44, 1); // 2.5% -> ~2.44%
        });
    });

    // ========================================
    // getEffectiveStackCap Edge Cases
    // ========================================
    describe('getEffectiveStackCap() - Edge Cases', () => {
        it('should prioritize max_stacks over stack_cap', () => {
            const item = {
                id: 'test',
                name: 'Test',
                max_stacks: 3,
                stack_cap: 10,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            };

            expect(getEffectiveStackCap(item)).toBe(3);
        });

        it('should ignore zero max_stacks', () => {
            const item = {
                id: 'test',
                name: 'Test',
                max_stacks: 0,
                stack_cap: 5,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            };

            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should ignore negative max_stacks', () => {
            const item = {
                id: 'test',
                name: 'Test',
                max_stacks: -5,
                stack_cap: 7,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            };

            expect(getEffectiveStackCap(item)).toBe(7);
        });

        it('should ignore zero stack_cap', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 0,
                scaling_per_stack: [1, 2, 3, 4, 5],
            };

            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should ignore negative stack_cap', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: -10,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7],
            };

            expect(getEffectiveStackCap(item)).toBe(7);
        });

        it('should detect plateau at very beginning', () => {
            // All values same from start
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [100, 100, 100, 100, 100],
            };

            // Plateau detection requires 3+ repeating at end
            // but if all values are same, no "transition" detected
            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should detect plateau in middle', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [10, 20, 30, 30, 30, 30, 30],
            };

            expect(getEffectiveStackCap(item)).toBe(3);
        });

        it('should handle single element array', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [100],
            };

            expect(getEffectiveStackCap(item)).toBe(1);
        });

        it('should handle two element array with plateau', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [10, 10],
            };

            // Only 2 repeating values, not 3+
            expect(getEffectiveStackCap(item)).toBe(2);
        });

        it('should handle missing scaling_per_stack', () => {
            const item = {
                id: 'test',
                name: 'Test',
            };

            expect(getEffectiveStackCap(item)).toBe(10);
        });

        it('should handle undefined scaling_per_stack', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: undefined,
            };

            expect(getEffectiveStackCap(item)).toBe(10);
        });

        it('should handle decimal values in plateau detection', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [10.5, 20.5, 30.5, 30.5, 30.5, 30.5],
            };

            expect(getEffectiveStackCap(item)).toBe(3);
        });

        it('should not treat nearly-equal values as plateau', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [10, 20, 30.0001, 30.0002, 30.0003],
            };

            // Values are slightly different, so no plateau
            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should handle exact boundary at 100 for stack_cap', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 100,
                scaling_per_stack: Array.from({ length: 150 }, (_, i) => i + 1),
            };

            expect(getEffectiveStackCap(item)).toBe(100);
        });

        it('should handle stack_cap of 101 (exceeds limit)', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 101,
                scaling_per_stack: Array.from({ length: 150 }, (_, i) => i + 1),
            };

            // 101 > 100, so falls back to array length
            expect(getEffectiveStackCap(item)).toBe(150);
        });
    });

    // ========================================
    // calculateTomeProgression Edge Cases
    // ========================================
    describe('calculateTomeProgression() - Edge Cases', () => {
        it('should handle leading zeros in value', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Damage',
                value_per_level: '+007% damage',
            };

            const result = calculateTomeProgression(tome, 3);

            expect(result).not.toBeNull();
            expect(result![0]).toBe(7);
        });

        it('should handle negative percentage', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Defense',
                value_per_level: '-5% cooldown',
            };

            const result = calculateTomeProgression(tome, 3);

            expect(result).not.toBeNull();
            // Pattern matches "5" without the minus sign
            expect(result![0]).toBe(5);
        });

        it('should handle decimal value per level', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+0.5% damage',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            expect(result![0]).toBe(0.5);
            expect(result![4]).toBe(2.5);
        });

        it('should handle very small decimal multiplier', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Damage',
                value_per_level: '+0.01x damage',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            expect(result![0]).toBe(1); // 0.01 * 100 = 1
        });

        it('should handle evasion case insensitively', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'EVASION CHANCE',
                value_per_level: '+10% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Should apply evasion hyperbolic formula
            const increment1 = result![1] - result![0];
            const increment2 = result![2] - result![1];
            expect(increment2).toBeLessThan(increment1);
        });

        it('should handle armor case insensitively', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Physical Armor',
                value_per_level: '+10% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Armor uses 0.75 constant, so values are slightly higher than evasion
            expect(result![0]).toBeGreaterThan(0);
        });

        it('should handle hyperbolic keyword anywhere in string', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Evasion',
                value_per_level: '+10% (HYPERBOLIC scaling)',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Should detect hyperbolic keyword
            const increment1 = result![1] - result![0];
            const increment2 = result![2] - result![1];
            expect(increment2).toBeLessThan(increment1);
        });

        it('should handle maxLevels of 0', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+5% damage',
            };

            const result = calculateTomeProgression(tome, 0);

            expect(result).not.toBeNull();
            expect(result!.length).toBe(0);
        });

        it('should handle maxLevels of 1', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+5% damage',
            };

            const result = calculateTomeProgression(tome, 1);

            expect(result).not.toBeNull();
            expect(result!.length).toBe(1);
            expect(result![0]).toBe(5);
        });

        it('should handle very large maxLevels', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+1% damage',
            };

            const result = calculateTomeProgression(tome, 1000);

            expect(result).not.toBeNull();
            expect(result!.length).toBe(1000);
            expect(result![999]).toBe(1000);
        });

        it('should handle empty stat_affected', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: '',
                value_per_level: '+5% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Without evasion/armor in stat, should use linear scaling despite hyperbolic keyword
            // Actually, re-reading the code - isHyperbolic is detected but since stat isn't evasion/armor,
            // neither special formula applies, so it's linear
            expect(result![0]).toBe(5);
            expect(result![4]).toBe(25);
        });

        it('should handle undefined stat_affected', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                value_per_level: '+5% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            expect(result![0]).toBe(5);
        });

        it('should handle value string with multiple numbers', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Damage',
                value_per_level: '+0.08x (8% damage)',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Should pick up 0.08 (the first number)
            expect(result![0]).toBe(8); // 0.08 * 100
        });

        it('should handle value string starting with number', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '5% per level',
            };

            const result = calculateTomeProgression(tome, 3);

            expect(result).not.toBeNull();
            expect(result![0]).toBe(5);
        });

        it('should handle undefined tome', () => {
            const result = calculateTomeProgression(undefined as any, 5);

            expect(result).toBeNull();
        });

        it('should handle null value_per_level', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: null,
            };

            const result = calculateTomeProgression(tome as any, 5);

            expect(result).toBeNull();
        });

        it('should handle number value_per_level', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: 5,
            };

            const result = calculateTomeProgression(tome as any, 5);

            // Should return null because value_per_level is not a string
            expect(result).toBeNull();
        });

        it('should round values to 2 decimal places', () => {
            const tome = {
                id: 'tome',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+3.333% damage',
            };

            const result = calculateTomeProgression(tome, 3);

            expect(result).not.toBeNull();
            // Values should be rounded
            result!.forEach(val => {
                const decimalPart = val.toString().split('.')[1];
                expect(decimalPart ? decimalPart.length : 0).toBeLessThanOrEqual(2);
            });
        });
    });

    // ========================================
    // Integration Edge Cases
    // ========================================
    describe('Integration - Multiple Functions', () => {
        it('should handle item with both hyperbolic scaling and max_stacks', () => {
            // An item that uses hyperbolic scaling AND has a max_stacks cap
            const item = {
                id: 'test',
                name: 'Capped Hyperbolic Item',
                max_stacks: 5,
                scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                scaling_formula_type: 'hyperbolic',
                hyperbolic_constant: 1.0,
            };

            const cap = getEffectiveStackCap(item);
            expect(cap).toBe(5);

            // Apply hyperbolic scaling to capped values
            const scalingData = item.scaling_per_stack.slice(0, cap);
            const hyperbolicValues = applyHyperbolicScaling(scalingData, item.hyperbolic_constant);

            expect(hyperbolicValues.length).toBe(5);
            expect(hyperbolicValues[4]).toBeLessThan(50); // Hyperbolic reduces 50% to ~33%
        });

        it('should generate consistent results for equivalent configurations', () => {
            // generateHyperbolicValues(10, 5, 1.0) should equal
            // applyHyperbolicScaling([10, 20, 30, 40, 50], 1.0)
            const generated = generateHyperbolicValues(10, 5, 1.0);
            const applied = applyHyperbolicScaling([10, 20, 30, 40, 50], 1.0);

            expect(generated).toEqual(applied);
        });
    });
});
