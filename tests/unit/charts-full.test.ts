import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Track Chart calls for assertions using global
globalThis.__chartCalls = [];
globalThis.__mockChartDestroy = vi.fn();

// Mock chart-loader before importing charts
// The factory must be fully self-contained since vi.mock is hoisted
vi.mock('../../src/modules/chart-loader.ts', () => {
    // Create mock Chart class inside the factory
    const ChartMock = function (ctx, config) {
        // Store the call for test assertions using global
        globalThis.__chartCalls.push([ctx, config]);
        this.ctx = ctx;
        this.config = config;
        this.data = config.data;
        this.options = config.options;
        this.destroy = globalThis.__mockChartDestroy;
    };
    return {
        Chart: ChartMock,
    };
});

// Convenience references
const chartCalls = globalThis.__chartCalls;
const mockChartDestroy = globalThis.__mockChartDestroy;

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockImplementation(tabName => {
        if (tabName === 'items') {
            return [
                {
                    id: 'item1',
                    name: 'Test Item',
                    scaling_per_stack: [5, 10, 15, 20, 25],
                    one_and_done: false,
                    graph_type: 'linear',
                    scaling_type: 'damage',
                },
            ];
        }
        if (tabName === 'tomes') {
            return [
                {
                    id: 'tome1',
                    name: 'Test Tome',
                    stat_affected: 'Attack',
                    value_per_level: '+5% damage',
                },
            ];
        }
        return [];
    }),
}));

// Import after mocks
import {
    applyHyperbolicScaling,
    generateHyperbolicValues,
    getEffectiveStackCap,
    createScalingChart,
    createCompareChart,
    calculateTomeProgression,
    initializeItemCharts,
    initializeTomeCharts,
    destroyAllCharts,
    chartInstances,
} from '../../src/modules/charts.ts';
import { Chart } from '../../src/modules/chart-loader.ts';
import { logger } from '../../src/modules/logger.ts';
import { getDataForTab } from '../../src/modules/data-service.ts';

describe('Charts Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();

        // Clear chart instances
        Object.keys(chartInstances).forEach(key => delete chartInstances[key]);

        // Clear chartCalls array
        chartCalls.length = 0;
    });

    afterEach(() => {
        // Clean up any created canvases
        document.querySelectorAll('canvas').forEach(c => c.remove());
    });

    describe('applyHyperbolicScaling()', () => {
        it('should apply hyperbolic formula to values', () => {
            const values = [10, 20, 30];
            const result = applyHyperbolicScaling(values, 1.0);

            // Formula: actual = internal / (constant + internal)
            // For 10: 0.1 / (1 + 0.1) = 0.0909... ≈ 9.09%
            expect(result[0]).toBeCloseTo(9.09, 1);
        });

        it('should use default constant of 1.0', () => {
            const values = [50];
            const result = applyHyperbolicScaling(values);

            // 0.5 / (1 + 0.5) = 0.333... ≈ 33.33%
            expect(result[0]).toBeCloseTo(33.33, 1);
        });

        it('should handle different constants', () => {
            const values = [50];
            const result = applyHyperbolicScaling(values, 0.75);

            // 0.5 / (0.75 + 0.5) = 0.4 = 40%
            expect(result[0]).toBeCloseTo(40, 1);
        });

        it('should return array of same length', () => {
            const values = [5, 10, 15, 20, 25];
            const result = applyHyperbolicScaling(values, 1.0);

            expect(result.length).toBe(5);
        });

        it('should handle zero values', () => {
            const values = [0];
            const result = applyHyperbolicScaling(values, 1.0);

            expect(result[0]).toBe(0);
        });

        it('should show diminishing returns', () => {
            const values = [10, 20, 30, 40, 50];
            const result = applyHyperbolicScaling(values, 1.0);

            // Increments should decrease
            const increment1 = result[1] - result[0];
            const increment2 = result[2] - result[1];
            const increment3 = result[3] - result[2];

            expect(increment2).toBeLessThan(increment1);
            expect(increment3).toBeLessThan(increment2);
        });
    });

    describe('generateHyperbolicValues()', () => {
        it('should generate array of values', () => {
            const result = generateHyperbolicValues(5, 10, 1.0);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(10);
        });

        it('should use perStack increment', () => {
            const result = generateHyperbolicValues(10, 5, 1.0);

            // Values should be based on 10, 20, 30, 40, 50 internal
            expect(result.length).toBe(5);
            expect(result[0]).toBeGreaterThan(0);
        });

        it('should use default maxStacks of 10', () => {
            const result = generateHyperbolicValues(5);

            expect(result.length).toBe(10);
        });

        it('should use default constant of 1.0', () => {
            const result1 = generateHyperbolicValues(5, 5);
            const result2 = generateHyperbolicValues(5, 5, 1.0);

            expect(result1).toEqual(result2);
        });
    });

    describe('getEffectiveStackCap()', () => {
        it('should use max_stacks if set', () => {
            const item = {
                id: 'test',
                name: 'Test',
                max_stacks: 5,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            };

            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should use stack_cap if max_stacks not set', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 7,
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            };

            expect(getEffectiveStackCap(item)).toBe(7);
        });

        it('should return scaling_per_stack length as fallback', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [1, 2, 3, 4, 5],
            };

            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should return 10 for empty scaling array', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [],
            };

            expect(getEffectiveStackCap(item)).toBe(10);
        });

        it('should detect plateau when values repeat', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [1, 2, 3, 4, 5, 5, 5, 5, 5, 5],
            };

            // Should detect plateau at index 5 (6 repeating values of 5)
            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should not detect plateau for less than 3 repeating values', () => {
            const item = {
                id: 'test',
                name: 'Test',
                scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 8],
            };

            // Only 2 repeating 8s, not a plateau
            expect(getEffectiveStackCap(item)).toBe(9);
        });

        it('should limit stack_cap to 100', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 150,
                scaling_per_stack: [1, 2, 3, 4, 5],
            };

            // stack_cap > 100 is ignored, falls back to scaling length
            expect(getEffectiveStackCap(item)).toBe(5);
        });

        it('should limit stack_cap to scaling_per_stack length', () => {
            const item = {
                id: 'test',
                name: 'Test',
                stack_cap: 50,
                scaling_per_stack: [1, 2, 3],
            };

            expect(getEffectiveStackCap(item)).toBe(3);
        });
    });

    describe('createScalingChart()', () => {
        beforeEach(() => {
            // Add canvas element
            const canvas = document.createElement('canvas');
            canvas.id = 'test-chart';
            document.body.appendChild(canvas);
        });

        it('should return null if canvas not found', () => {
            const result = createScalingChart('nonexistent', [1, 2, 3], 'Test');

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalled();
        });

        it('should create chart with canvas', () => {
            const result = createScalingChart('test-chart', [1, 2, 3], 'Test');

            expect(chartCalls.length).toBeGreaterThan(0);
            expect(result).not.toBeNull();
        });

        it('should store chart instance', () => {
            createScalingChart('test-chart', [1, 2, 3], 'Test');

            expect(chartInstances['test-chart']).toBeDefined();
        });

        it('should destroy existing chart before creating new one', () => {
            // Create first chart
            createScalingChart('test-chart', [1, 2, 3], 'Test');

            // Create second chart (should destroy first)
            createScalingChart('test-chart', [4, 5, 6], 'Test 2');

            expect(mockChartDestroy).toHaveBeenCalled();
        });

        it('should apply hyperbolic scaling when specified', () => {
            const data = [10, 20, 30];
            createScalingChart('test-chart', data, 'Test', '', false, undefined, undefined, {
                scalingFormulaType: 'hyperbolic',
                hyperbolicConstant: 1.0,
            });

            // Chart should be created with transformed data
            expect(chartCalls.length).toBeGreaterThan(0);
        });

        it('should apply stack cap to data', () => {
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            createScalingChart('test-chart', data, 'Test', '', false, undefined, 5);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.labels.length).toBe(5);
        });

        it('should add secondary dataset when provided', () => {
            const data = [1, 2, 3];
            const secondaryData = { stat: 'Speed', values: [10, 20, 30] };

            createScalingChart('test-chart', data, 'Test', '', false, secondaryData);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.datasets.length).toBe(2);
        });

        it('should handle array secondary data', () => {
            const data = [1, 2, 3];
            const secondaryData = [10, 20, 30];

            createScalingChart('test-chart', data, 'Test', '', false, secondaryData);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.datasets.length).toBe(2);
        });

        it('should use larger points for modal charts', () => {
            createScalingChart('test-chart', [1, 2, 3], 'Test', '', true);

            const chartCall = chartCalls[0];
            const dataset = chartCall[1].data.datasets[0];
            expect(dataset.pointRadius).toBe(5);
            expect(dataset.borderWidth).toBe(3);
        });

        it('should use smaller points for non-modal charts', () => {
            createScalingChart('test-chart', [1, 2, 3], 'Test', '', false);

            const chartCall = chartCalls[0];
            const dataset = chartCall[1].data.datasets[0];
            expect(dataset.pointRadius).toBe(3);
            expect(dataset.borderWidth).toBe(2);
        });
    });

    describe('createCompareChart()', () => {
        beforeEach(() => {
            const canvas = document.createElement('canvas');
            canvas.id = 'compare-chart';
            document.body.appendChild(canvas);
        });

        it('should return null if canvas not found', () => {
            const result = createCompareChart('nonexistent', []);

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalled();
        });

        it('should create chart with items', () => {
            const items = [
                { id: '1', name: 'Item 1', scaling_per_stack: [1, 2, 3] },
                { id: '2', name: 'Item 2', scaling_per_stack: [2, 4, 6] },
            ];

            const result = createCompareChart('compare-chart', items);

            expect(chartCalls.length).toBeGreaterThan(0);
            expect(result).not.toBeNull();
        });

        it('should create dataset for each item', () => {
            const items = [
                { id: '1', name: 'Item 1', scaling_per_stack: [1, 2, 3] },
                { id: '2', name: 'Item 2', scaling_per_stack: [2, 4, 6] },
                { id: '3', name: 'Item 3', scaling_per_stack: [3, 6, 9] },
            ];

            createCompareChart('compare-chart', items);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.datasets.length).toBe(3);
        });

        it('should use different colors for each item', () => {
            const items = [
                { id: '1', name: 'Item 1', scaling_per_stack: [1, 2, 3] },
                { id: '2', name: 'Item 2', scaling_per_stack: [2, 4, 6] },
            ];

            createCompareChart('compare-chart', items);

            const chartCall = chartCalls[0];
            const colors = chartCall[1].data.datasets.map(d => d.borderColor);
            expect(colors[0]).not.toBe(colors[1]);
        });

        it('should apply hyperbolic scaling when item specifies it', () => {
            const items = [
                {
                    id: '1',
                    name: 'Item 1',
                    scaling_per_stack: [10, 20, 30],
                    scaling_formula_type: 'hyperbolic',
                    hyperbolic_constant: 1.0,
                },
            ];

            createCompareChart('compare-chart', items);

            // Chart should be created (transformation happens internally)
            expect(chartCalls.length).toBeGreaterThan(0);
        });

        it('should handle empty items array', () => {
            createCompareChart('compare-chart', []);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.datasets.length).toBe(0);
        });

        it('should limit data to 10 stacks', () => {
            const items = [
                {
                    id: '1',
                    name: 'Item 1',
                    scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                },
            ];

            createCompareChart('compare-chart', items);

            const chartCall = chartCalls[0];
            expect(chartCall[1].data.datasets[0].data.length).toBeLessThanOrEqual(10);
        });

        it('should destroy existing chart before creating new one', () => {
            const items = [{ id: '1', name: 'Item 1', scaling_per_stack: [1, 2, 3] }];

            createCompareChart('compare-chart', items);
            createCompareChart('compare-chart', items);

            expect(mockChartDestroy).toHaveBeenCalled();
        });
    });

    describe('calculateTomeProgression()', () => {
        it('should calculate progression from percentage string', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+5% damage',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            expect(result.length).toBe(5);
            expect(result[0]).toBe(5);
            expect(result[4]).toBe(25);
        });

        it('should calculate progression from multiplier string', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Damage',
                value_per_level: '+0.1x damage',
            };

            const result = calculateTomeProgression(tome, 3);

            expect(result).not.toBeNull();
            // 0.1 * 100 = 10 per level
            expect(result[0]).toBe(10);
            expect(result[2]).toBe(30);
        });

        it('should return null for null tome', () => {
            const result = calculateTomeProgression(null, 5);

            expect(result).toBeNull();
        });

        it('should return null for missing value_per_level', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Attack',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).toBeNull();
        });

        it('should return null for non-string value_per_level', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: 5,
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).toBeNull();
        });

        it('should return null for unparseable value_per_level', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: 'increases damage',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).toBeNull();
        });

        it('should use default maxLevels of 10', () => {
            const tome = {
                id: 'tome1',
                name: 'Test Tome',
                stat_affected: 'Attack',
                value_per_level: '+5%',
            };

            const result = calculateTomeProgression(tome);

            expect(result.length).toBe(10);
        });

        it('should apply evasion hyperbolic formula', () => {
            const tome = {
                id: 'tome1',
                name: 'Evasion Tome',
                stat_affected: 'Evasion',
                value_per_level: '+10% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Values should show diminishing returns
            const increment1 = result[1] - result[0];
            const increment2 = result[2] - result[1];
            expect(increment2).toBeLessThan(increment1);
        });

        it('should apply armor hyperbolic formula', () => {
            const tome = {
                id: 'tome1',
                name: 'Armor Tome',
                stat_affected: 'Armor',
                value_per_level: '+10% hyperbolic',
            };

            const result = calculateTomeProgression(tome, 5);

            expect(result).not.toBeNull();
            // Armor uses different constant (0.75)
            expect(result[0]).toBeGreaterThan(0);
        });
    });

    describe('initializeItemCharts()', () => {
        beforeEach(() => {
            // Create canvas for test item
            const canvas = document.createElement('canvas');
            canvas.id = 'chart-item1';
            document.body.appendChild(canvas);
        });

        it('should create charts for items with scaling data', () => {
            initializeItemCharts();

            // Should have called Chart for the test item
            expect(chartCalls.length).toBeGreaterThan(0);
        });

        it('should skip one_and_done items', () => {
            // Clear previous mocks and chartCalls
            vi.clearAllMocks();
            chartCalls.length = 0;

            // Override mock to return one_and_done item
            vi.mocked(getDataForTab).mockReturnValueOnce([
                {
                    id: 'item1',
                    name: 'One and Done',
                    scaling_per_stack: [5, 10],
                    one_and_done: true,
                },
            ]);

            initializeItemCharts();

            expect(chartCalls.length).toBe(0);
        });

        it('should skip items with flat graph_type', () => {
            vi.clearAllMocks();
            chartCalls.length = 0;

            vi.mocked(getDataForTab).mockReturnValueOnce([
                {
                    id: 'item1',
                    name: 'Flat Item',
                    scaling_per_stack: [5, 5, 5],
                    one_and_done: false,
                    graph_type: 'flat',
                },
            ]);

            initializeItemCharts();

            expect(chartCalls.length).toBe(0);
        });
    });

    describe('initializeTomeCharts()', () => {
        beforeEach(() => {
            const canvas = document.createElement('canvas');
            canvas.id = 'tome-chart-tome1';
            document.body.appendChild(canvas);
        });

        it('should create charts for tomes', () => {
            initializeTomeCharts();

            expect(chartCalls.length).toBeGreaterThan(0);
        });

        it('should skip tomes without valid progression', () => {
            vi.clearAllMocks();
            chartCalls.length = 0;

            vi.mocked(getDataForTab).mockReturnValueOnce([
                {
                    id: 'tome1',
                    name: 'Invalid Tome',
                    stat_affected: 'Attack',
                    value_per_level: 'invalid',
                },
            ]);

            initializeTomeCharts();

            expect(chartCalls.length).toBe(0);
        });
    });

    describe('destroyAllCharts()', () => {
        beforeEach(() => {
            // Create some test canvases
            const canvas1 = document.createElement('canvas');
            canvas1.id = 'chart-1';
            document.body.appendChild(canvas1);

            const canvas2 = document.createElement('canvas');
            canvas2.id = 'chart-2';
            document.body.appendChild(canvas2);

            // Create charts
            createScalingChart('chart-1', [1, 2, 3], 'Chart 1');
            createScalingChart('chart-2', [4, 5, 6], 'Chart 2');
        });

        it('should destroy all chart instances', () => {
            // Charts should exist
            expect(Object.keys(chartInstances).length).toBe(2);

            vi.clearAllMocks();
            destroyAllCharts();

            expect(mockChartDestroy).toHaveBeenCalled();
        });

        it('should clear chartInstances object', () => {
            destroyAllCharts();

            expect(Object.keys(chartInstances).length).toBe(0);
        });
    });
});
