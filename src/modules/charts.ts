// ========================================
// MegaBonk Charts Module
// ========================================

import { Chart } from './chart-loader.ts';
import type { Tome } from '../types/index.ts';
import { safeGetElementById } from './utils.ts';
import { getDataForTab } from './data-service.ts';
import { logger } from './logger.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Secondary scaling data for dual-axis charts
 */
interface SecondaryData {
    stat: string;
    values: number[];
}

/**
 * Chart rendering options (function parameters)
 */
interface ChartOptions {
    scalingFormulaType?: string;
    hyperbolicConstant?: number;
    maxStacks?: number;
}

/**
 * Chart.js configuration options type
 * Defines the structure for Chart.js chart options
 */
interface ChartJsOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins: {
        legend: { display: boolean };
        tooltip: { enabled: boolean };
        annotation?: {
            annotations: {
                capLine: {
                    type: 'line';
                    xMin: number;
                    xMax: number;
                    borderColor: string;
                    borderWidth: number;
                    borderDash: number[];
                    label: {
                        display: boolean;
                        content: string;
                        position: 'start' | 'center' | 'end';
                        backgroundColor: string;
                        color: string;
                    };
                };
            };
        };
    };
    scales: {
        x: {
            title: { display: boolean; text: string };
            grid: { color: string };
        };
        y: {
            position: 'left' | 'right';
            title: { display: boolean; text: string };
            beginAtZero: boolean;
            grid: { color: string };
        };
        y2: {
            position: 'left' | 'right';
            display: boolean;
            grid: { drawOnChartArea: boolean };
        };
    };
}

/**
 * Item with chart-specific properties (more lenient for modal usage)
 */
interface ChartableItem {
    id: string;
    name: string;
    tier?: string;
    rarity?: string;
    scaling_per_stack?: number[];
    scaling_type?: string;
    stack_cap?: number;
    one_and_done?: boolean;
    graph_type?: string;
    max_stacks?: number;
    scaling_formula_type?: string;
    hyperbolic_constant?: number;
    secondary_scaling?: SecondaryData | number[];
}

/**
 * Tome with chart-specific properties (more lenient for usage)
 */
export interface ChartableTome {
    id: string;
    name: string;
    tier?: string;
    stat_affected?: string;
    value_per_level?: string | number;
}

/**
 * Chart.js dataset configuration for line charts
 */
interface ChartDataset {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
    pointRadius: number;
    pointHoverRadius: number;
    pointBackgroundColor: string;
    borderWidth: number;
    yAxisID?: string;
}

// ========================================
// State
// ========================================

// Chart instances storage (for cleanup)
export let chartInstances: Record<string, Chart> = {};

// ========================================
// Exported Functions
// ========================================

/**
 * Apply hyperbolic scaling formula to values
 * Formula: actual = internal / (constant + internal)
 * Used for items like Cursed Grabbies, Key where displayed % uses diminishing returns
 * @param values - Array of "internal" percentage values (e.g., [5, 10, 15...])
 * @param constant - The hyperbolic constant (default 1.0 for standard formula)
 * @returns Array of actual percentage values after hyperbolic transformation
 */
export function applyHyperbolicScaling(values: number[], constant: number = 1.0): number[] {
    return values.map((v: number) => {
        const internal = v / 100;
        const denominator = constant + internal;
        // Guard against division by zero
        const actual = denominator !== 0 ? internal / denominator : 0;
        return Math.round(actual * 10000) / 100; // Round to 2 decimal places
    });
}

/**
 * Generate hyperbolic scaling values for a given per-stack increment
 * @param perStack - The displayed increment per stack (e.g., 5 for "5% per stack")
 * @param maxStacks - Maximum stacks to calculate (default 10)
 * @param constant - Hyperbolic constant (default 1.0)
 * @returns Array of actual values after hyperbolic transformation
 */
export function generateHyperbolicValues(perStack: number, maxStacks: number = 10, constant: number = 1.0): number[] {
    const internalValues = Array.from({ length: maxStacks }, (_, i) => perStack * (i + 1));
    return applyHyperbolicScaling(internalValues, constant);
}

/**
 * Determine the effective stack cap for an item
 * @param item - Item with scaling_per_stack and optional stack_cap/max_stacks
 * @returns The effective maximum stacks to display
 */
export function getEffectiveStackCap(item: ChartableItem): number {
    // Use explicit max_stacks if set
    if (item.max_stacks && item.max_stacks > 0) {
        return item.max_stacks;
    }
    // Use stack_cap if reasonable (between 1 and 100)
    if (item.stack_cap && item.stack_cap > 0 && item.stack_cap <= 100) {
        return Math.min(item.stack_cap, item.scaling_per_stack?.length || 10);
    }
    // Detect plateau - if last several values are the same, cap is where they start repeating
    const scaling = item.scaling_per_stack || [];
    if (scaling.length === 0) return 10;

    for (let i = scaling.length - 1; i > 0; i--) {
        if (scaling[i] !== scaling[i - 1]) {
            // Found where values differ - cap is at i+1
            // But only if there's an actual plateau (3+ repeating values)
            if (scaling.length - i >= 3) {
                return i + 1;
            }
            break;
        }
    }
    // Default to array length
    return scaling.length;
}

/**
 * Create a scaling chart for an item or tome
 * @param canvasId - The canvas element ID
 * @param data - Array of scaling values
 * @param label - Chart label (item/tome name)
 * @param scalingType - Type of scaling for formatting
 * @param isModal - If true, creates a larger chart for modals
 * @param secondaryData - Optional secondary scaling data
 * @param stackCap - Optional stack cap to limit displayed data
 * @param options - Additional options for chart rendering
 */
export function createScalingChart(
    canvasId: string,
    data: number[],
    label: string,
    scalingType: string = '',
    isModal: boolean = false,
    secondaryData?: SecondaryData | number[],
    stackCap?: number,
    options: ChartOptions = {}
): Chart | null {
    const canvas = safeGetElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
        logger.warn({
            operation: 'chart.init',
            data: { chartId: canvasId, reason: 'canvas_not_found', chartType: 'scaling' },
        });
        return null;
    }

    // Destroy existing chart if present
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Apply hyperbolic transformation if specified
    let processedData = data;
    if (options.scalingFormulaType === 'hyperbolic') {
        processedData = applyHyperbolicScaling(data, options.hyperbolicConstant || 1.0);
    }

    // Apply stack cap if provided
    const effectiveCap = stackCap || processedData.length;
    const displayData = processedData.slice(0, effectiveCap);
    const labels = displayData.map((_, i) => `${i + 1}`);
    const isPercentage =
        scalingType.includes('chance') ||
        scalingType.includes('percentage') ||
        scalingType.includes('damage') ||
        scalingType.includes('crit');

    // Build datasets array
    const datasets: ChartDataset[] = [
        {
            label: label,
            data: displayData,
            borderColor: '#e94560',
            backgroundColor: 'rgba(233, 69, 96, 0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: isModal ? 5 : 3,
            pointHoverRadius: isModal ? 8 : 5,
            pointBackgroundColor: '#e94560',
            borderWidth: isModal ? 3 : 2,
            yAxisID: 'y',
        },
    ];

    // Add secondary dataset if provided
    let hasSecondary = false;
    let secondaryValues: number[] = [];
    let secondaryLabel = 'Secondary';

    if (secondaryData) {
        if (Array.isArray(secondaryData)) {
            // secondaryData is number[]
            secondaryValues = secondaryData;
            hasSecondary = secondaryValues.length > 0;
        } else {
            // secondaryData is SecondaryData
            secondaryValues = secondaryData.values || [];
            secondaryLabel = secondaryData.stat;
            hasSecondary = secondaryValues.length > 0;
        }
    }

    if (hasSecondary) {
        datasets.push({
            label: secondaryLabel,
            data: secondaryValues.slice(0, effectiveCap),
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: isModal ? 5 : 3,
            pointHoverRadius: isModal ? 8 : 5,
            pointBackgroundColor: '#4ecdc4',
            borderWidth: isModal ? 3 : 2,
            yAxisID: 'y2',
        });
    }

    const ctx = canvas.getContext('2d')!;

    // Build chart options
    const chartOptions: ChartJsOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: hasSecondary },
            tooltip: { enabled: true },
        },
        scales: {
            x: {
                title: { display: isModal, text: 'Stacks' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
            },
            y: {
                position: 'left',
                title: { display: isModal, text: isPercentage ? '%' : 'Value' },
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
            },
            y2: {
                position: 'right',
                display: hasSecondary,
                grid: { drawOnChartArea: false },
            },
        },
    };

    // Add cap indicator annotation if max_stacks is specified and less than data length
    if (options.maxStacks && options.maxStacks < data.length) {
        chartOptions.plugins.annotation = {
            annotations: {
                capLine: {
                    type: 'line',
                    xMin: options.maxStacks - 0.5,
                    xMax: options.maxStacks - 0.5,
                    borderColor: '#f39c12',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: isModal,
                        content: 'MAX',
                        position: 'start',
                        backgroundColor: '#f39c12',
                        color: '#000',
                    },
                },
            },
        };
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: chartOptions,
    });

    chartInstances[canvasId] = chart;
    return chart;
}

/**
 * Create comparison chart for multiple items
 * @param canvasId - Canvas element ID
 * @param items - Array of items to compare
 */
export function createCompareChart(canvasId: string, items: ChartableItem[]): Chart | null {
    const canvas = safeGetElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
        logger.warn({
            operation: 'chart.init',
            data: { chartId: canvasId, reason: 'canvas_not_found', chartType: 'compare' },
        });
        return null;
    }

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const colors = ['#e94560', '#4ecdc4', '#f9ca24'];
    // Handle empty array - Math.max() with no args returns -Infinity
    const lengths = items.map((item: ChartableItem) => item.scaling_per_stack?.length || 0);
    const maxLength = lengths.length > 0 ? Math.max(...lengths) : 10;
    const labels = Array.from({ length: Math.min(maxLength, 10) }, (_, i) => `${i + 1}`);

    const datasets = items.map((item: ChartableItem, index: number) => {
        let chartData = item.scaling_per_stack?.slice(0, 10) || [];
        // Apply hyperbolic transformation if item uses hyperbolic scaling
        if (item.scaling_formula_type === 'hyperbolic') {
            chartData = applyHyperbolicScaling(chartData, item.hyperbolic_constant || 1.0);
        }
        return {
            label: item.name,
            data: chartData,
            borderColor: colors[index % colors.length],
            backgroundColor: `${colors[index % colors.length]}33`,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            borderWidth: 2,
        };
    });

    const ctx = canvas.getContext('2d')!;
    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { enabled: true, mode: 'index', intersect: false },
            },
            scales: {
                x: {
                    title: { display: true, text: 'Stacks' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                },
                y: {
                    title: { display: true, text: 'Value' },
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                },
            },
        },
    });

    chartInstances[canvasId] = chart;
    return chart;
}

/**
 * Calculate tome progression values
 * @param tome - Tome data
 * @param maxLevels - Maximum levels to calculate
 * @returns Array of progression values or null
 */
export function calculateTomeProgression(tome: Tome | ChartableTome, maxLevels: number = 10): number[] | null {
    // Check for null/undefined before calling .match()
    const valueStr = tome?.value_per_level;
    if (!valueStr || typeof valueStr !== 'string') return null;
    // Parse numeric value from strings like "+7% crit chance" or "+0.08x (8% damage)"
    const match = valueStr.match(/[+-]?([\d.]+)/);
    if (!match || !match[1]) return null;

    const perLevel = parseFloat(match[1]);
    // Scale appropriately - percentages stay as-is, multipliers get scaled
    const isMultiplier = valueStr.includes('x');
    const isHyperbolic = valueStr.toLowerCase().includes('hyperbolic');

    // Detect which hyperbolic formula to use based on stat type
    const statLower = (tome.stat_affected || '').toLowerCase();
    const isEvasion = statLower.includes('evasion');
    const isArmor = statLower.includes('armor');

    return Array.from({ length: maxLevels }, (_, i) => {
        const internalValue = (isMultiplier ? perLevel * 100 : perLevel) * (i + 1);

        if (isHyperbolic && isEvasion) {
            // Evasion formula: actual = internal / (1 + internal)
            const internalDecimal = internalValue / 100;
            const actualEvasion = (internalDecimal / (1 + internalDecimal)) * 100;
            return Math.round(actualEvasion * 100) / 100;
        } else if (isHyperbolic && isArmor) {
            // Armor formula: actual = internal / (0.75 + internal)
            const internalDecimal = internalValue / 100;
            const actualArmor = (internalDecimal / (0.75 + internalDecimal)) * 100;
            return Math.round(actualArmor * 100) / 100;
        }

        return Math.round(internalValue * 100) / 100;
    });
}

/**
 * Initialize charts for items in the current view
 */
export function initializeItemCharts(): void {
    const items = getDataForTab('items') as ChartableItem[];
    items.forEach((item: ChartableItem) => {
        if (item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat') {
            const effectiveCap = getEffectiveStackCap(item);
            const chartOptions: ChartOptions = {
                scalingFormulaType: item.scaling_formula_type || 'linear',
                hyperbolicConstant: item.hyperbolic_constant || 1.0,
                maxStacks: item.max_stacks || undefined,
            };
            createScalingChart(
                `chart-${item.id}`,
                item.scaling_per_stack,
                item.name,
                item.scaling_type || '',
                false,
                item.secondary_scaling,
                effectiveCap,
                chartOptions
            );
        }
    });
}

/**
 * Initialize charts for tomes in the current view
 */
export function initializeTomeCharts(): void {
    const tomes = getDataForTab('tomes') as Tome[];
    tomes.forEach((tome: Tome) => {
        const progression = calculateTomeProgression(tome);
        if (progression) {
            createScalingChart(`tome-chart-${tome.id}`, progression, tome.name, tome.stat_affected ?? '', false);
        }
    });
}

/**
 * Destroy all chart instances
 */
export function destroyAllCharts(): void {
    Object.keys(chartInstances).forEach((canvasId: string) => {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
    });
    chartInstances = {};
}
