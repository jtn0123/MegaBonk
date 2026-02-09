// ========================================
// MegaBonk Breakpoint Calculator Module
// ========================================

import type { Item } from '../types/index.ts';
import { safeSetValue } from './utils.ts';
import { logger } from './logger.ts';
import { allData } from './data-service.ts';
import { callFunction } from './registry.ts';
import { ToastManager } from './toast.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Calculator result structure
 */
interface CalculatorResult {
    itemName: string;
    perStack: number;
    targetValue: number;
    stacksNeeded: number;
    formula: string;
    scalingType: string;
    stackCap?: number;
    oneAndDone?: boolean;
    stacksWell?: boolean;
    scalingPerStack: number[];
}

/**
 * Pure calculation result (for testing)
 */
export interface BreakpointResult {
    error?: string;
    item?: Item;
    target?: number;
    stacksNeeded?: number;
    perStack?: number;
    actualValue?: number;
    isCapped?: boolean;
    isOneAndDone?: boolean;
    hasWarning?: boolean;
}

/**
 * Data structure expected by computeBreakpoint
 */
export interface BreakpointData {
    items?: {
        items: Item[];
    };
}

// ========================================
// Pure Calculation Functions (Testable)
// ========================================

/**
 * Pure function to compute breakpoint calculation
 * This function has no side effects and can be easily unit tested
 * @param data - Data containing items array
 * @param itemId - Item ID to calculate for
 * @param target - Target value to reach
 * @returns Breakpoint calculation result
 */
export function computeBreakpoint(data: BreakpointData, itemId: string, target: number): BreakpointResult {
    if (!itemId || !target || target <= 0) {
        return { error: 'Please select an item and enter a target value!' };
    }

    const item = data.items?.items.find((i: Item) => i.id === itemId);
    if (!item) {
        return { error: 'Item not found' };
    }

    if (!item.scaling_per_stack || item.scaling_per_stack.length === 0) {
        return { error: 'Item has no scaling data' };
    }

    // Calculate stacks needed
    let stacksNeeded = 0;
    const firstValue = item.scaling_per_stack[0] ?? null;

    // Validate that first value is a valid positive number
    // Handle null, undefined, NaN, non-numeric values, and zero/negative
    if (firstValue === null || typeof firstValue !== 'number' || !Number.isFinite(firstValue) || firstValue <= 0) {
        return { error: 'Invalid scaling value' };
    }

    const perStack = firstValue;
    stacksNeeded = Math.ceil(target / perStack);

    // Cap checks
    const isCapped = item.stack_cap != null && item.stack_cap > 0 && stacksNeeded > item.stack_cap;
    if (isCapped) {
        stacksNeeded = item.stack_cap!;
    }

    // Calculate actual value achieved
    const actualValue = stacksNeeded * perStack;

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
        hasWarning: hasWarning,
    };
}

// ========================================
// Exported Functions
// ========================================

/**
 * Populate calculator items dropdown
 */
export function populateCalculatorItems(): void {
    const select = document.getElementById('calc-item-select') as HTMLSelectElement | null;
    if (!select || !allData.items?.items) {
        return; // Calculator not ready
    }

    // Clear existing options except the first (placeholder)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add items with scaling_per_stack data
    const scalingItems = allData.items.items.filter((item: Item) => {
        return item.scaling_per_stack && item.scaling_per_stack.length > 0;
    });

    scalingItems.forEach((item: Item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

/**
 * Calculate breakpoint for an item
 */
export function calculateBreakpoint(): void {
    const select = document.getElementById('calc-item-select') as HTMLSelectElement | null;
    const input = document.getElementById('calc-target') as HTMLInputElement | null;
    const resultDiv = document.getElementById('calc-result');

    if (!select || !input || !resultDiv) {
        return; // Calculator elements not ready
    }

    const itemId = select.value;
    const target = parseFloat(input.value);

    if (!itemId) {
        resultDiv.style.display = 'none';
        return;
    }

    if (isNaN(target) || target <= 0) {
        ToastManager.warning('Please enter a valid target value');
        return;
    }

    // Find item
    const item = allData.items?.items?.find((i: Item) => i.id === itemId);
    if (!item || !item.scaling_per_stack || item.scaling_per_stack.length === 0) {
        ToastManager.error('Item not found or has no scaling data');
        return;
    }

    // Calculate stacks needed
    let stacksNeeded = 0;
    const perStack = item.scaling_per_stack[0] ?? null; // Value per stack from first entry

    // Check for division by zero and validate perStack is a valid number
    // Handle null, undefined, NaN, non-numeric values, and zero/negative
    if (perStack === null || typeof perStack !== 'number' || !Number.isFinite(perStack) || perStack <= 0) {
        ToastManager.warning('Invalid scaling value for this item');
        return;
    }

    stacksNeeded = Math.ceil(target / perStack);

    // Bug fix: Track if original calculation exceeded cap BEFORE capping
    // Using === only checks if final value equals cap, not if we were limited
    const isCapped = item.stack_cap != null && item.stack_cap > 0 && stacksNeeded > item.stack_cap;

    // Cap checks
    if (isCapped) {
        stacksNeeded = item.stack_cap!;
    }
    const actualValue = stacksNeeded * perStack;

    // Display result
    const result: CalculatorResult = {
        itemName: item.name,
        perStack: perStack,
        targetValue: target,
        stacksNeeded: stacksNeeded,
        formula: item.formula || 'No formula available',
        scalingType: item.scaling_type || '',
        stackCap: item.stack_cap,
        oneAndDone: item.one_and_done,
        stacksWell: item.stacks_well,
        scalingPerStack: item.scaling_per_stack,
    };

    // Log calculator event
    logger.info({
        operation: 'calculator.compute',
        success: true,
        data: {
            itemId: item.id,
            itemName: item.name,
            targetValue: target,
            result: {
                stacksNeeded,
                perStack,
                actualValue,
                isCapped,
                isOneAndDone: item.one_and_done === true,
            },
        },
    });

    renderResults(result);
}

/**
 * Render calculation results
 * @param result - Calculation result
 */
function renderResults(result: CalculatorResult): void {
    const resultDiv = document.getElementById('calc-result');
    if (!resultDiv) return;

    const isPercentage = result.scalingType.includes('chance') || result.scalingType.includes('percentage');
    const unit = isPercentage ? '%' : '';

    // Bug fix: Trim scaling array to stack_cap to avoid showing bars beyond the cap
    // Bug fix: Ensure stack_cap is positive before using it with slice()
    // slice(0, negative) removes elements from the end, which is not intended
    const effectiveScaling =
        result.stackCap && result.stackCap > 0
            ? result.scalingPerStack.slice(0, result.stackCap)
            : result.scalingPerStack;

    // Calculate max for bar graph normalization
    const maxVal = effectiveScaling.length > 0 ? Math.max(...effectiveScaling) : 1;
    const safeMax = maxVal > 0 ? maxVal : 1;

    const barGraphHTML = effectiveScaling
        .map((val: number, idx: number) => {
            const height = (val / safeMax) * 100;
            // Bug fix: Highlight the target bar, or the last available bar if
            // stacksNeeded exceeds available data points (sparse scaling data)
            const isTarget =
                idx + 1 === result.stacksNeeded ||
                (result.stacksNeeded > effectiveScaling.length && idx === effectiveScaling.length - 1);
            return `<div class="bar-container">
                        <div class="bar ${isTarget ? 'highlight' : ''}" style="height: ${height}%"></div>
                        <div class="bar-label">${idx + 1}</div>
                    </div>`;
        })
        .join('');

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="calc-result-content">
            <h3>📊 Calculation Result</h3>
            <div class="result-main">
                <div class="result-item">
                    <div class="result-label">Item:</div>
                    <div class="result-value"><strong>${result.itemName}</strong></div>
                </div>
                <div class="result-item">
                    <div class="result-label">Target Value:</div>
                    <div class="result-value"><strong>${result.targetValue}${unit}</strong></div>
                </div>
                <div class="result-item highlight">
                    <div class="result-label">Stacks Needed:</div>
                    <div class="result-value large"><strong>${result.stacksNeeded}</strong></div>
                </div>
            </div>

            <div class="result-details">
                <p><strong>Formula:</strong> ${result.formula}</p>
                <p><strong>Per Stack:</strong> +${result.perStack}${unit}</p>
                ${result.stackCap ? `<p class="warning">⚠️ Note: This item caps at ${result.stackCap} stacks</p>` : ''}
                ${result.oneAndDone ? `<p class="warning">⚠️ Note: This is a one-and-done item - additional copies provide no benefit!</p>` : ''}
                ${result.stacksWell === false ? `<p class="warning">⚠️ Note: This item has diminishing returns or limited stacking</p>` : ''}
            </div>

            <div class="result-graph">
                <h4>Scaling Visualization (1-${effectiveScaling.length} stacks${result.stackCap ? `, capped at ${result.stackCap}` : ''})</h4>
                <div class="mini-bar-graph">
                    ${barGraphHTML}
                </div>
            </div>
        </div>
    `;
}

/**
 * Quick calculate from item card
 * @param itemId - Item ID
 * @param target - Target value (optional)
 */
export function quickCalc(itemId: string, target?: number): void {
    // Switch to calculator tab using registry (avoids circular dependency)
    callFunction('switchTab', 'calculator');

    // Set item
    safeSetValue('calc-item-select', itemId);

    // Set target if provided
    if (target !== undefined && target > 0) {
        safeSetValue('calc-target', target.toString());
        // Auto-calculate
        setTimeout(() => {
            calculateBreakpoint();
        }, 100);
    }
}
