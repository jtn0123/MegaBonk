// ========================================
// MegaBonk Compare Mode Module
// ========================================

import type { Item } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { allData } from './data-service.ts';
import { safeGetElementById, safeQuerySelector, safeQuerySelectorAll, escapeHtml } from './utils.ts';
import { MAX_COMPARE_ITEMS } from './constants.ts';
import { getState, setState } from './store.ts';

// ========================================
// State
// ========================================

// Compare mode state - uses centralized store
// No local copy - always read from store for proper test isolation

// ========================================
// Exported Functions
// ========================================

/**
 * Toggle item in comparison list
 * @param itemId - Item ID to toggle
 */
export function toggleCompareItem(itemId: string): void {
    const compareItems = getState('compareItems');
    const index = compareItems.indexOf(itemId);
    if (index > -1) {
        const newItems = [...compareItems];
        newItems.splice(index, 1);
        setState('compareItems', newItems);
    } else {
        if (compareItems.length >= MAX_COMPARE_ITEMS) {
            ToastManager.warning(
                `You can only compare up to ${MAX_COMPARE_ITEMS} items at once. Remove an item first.`
            );
            return;
        }
        setState('compareItems', [...compareItems, itemId]);
    }
    updateCompareButton();
}

/**
 * Update compare button visibility and state
 */
export function updateCompareButton(): void {
    const compareBtn = safeGetElementById('compare-btn');
    if (!compareBtn) return;

    const compareItems = getState('compareItems');
    const countSpan = safeQuerySelector('.compare-count', compareBtn);
    if (countSpan) {
        countSpan.textContent = compareItems.length.toString();
    }

    compareBtn.style.display = compareItems.length >= 2 ? 'block' : 'none';

    // Update checkboxes
    safeQuerySelectorAll('.compare-checkbox').forEach((cb: Element) => {
        const checkbox = cb as HTMLInputElement;
        const id = checkbox.dataset.id || checkbox.value;
        checkbox.checked = compareItems.includes(id);
    });
}

/**
 * Open the comparison modal
 */
export async function openCompareModal(): Promise<void> {
    const compareItems = getState('compareItems');
    if (compareItems.length < 2) {
        ToastManager.warning('Select at least 2 items to compare!');
        return;
    }

    const items = compareItems
        .map((id: string) => allData.items?.items.find((item: Item) => item.id === id))
        .filter((item): item is Item => item !== undefined);

    const compareBody = safeGetElementById('compareBody');
    const modal = safeGetElementById('compareModal');
    if (!compareBody || !modal) return;

    // Filter items that have scaling data for the chart
    const chartableItems = items.filter(
        (item: Item) => item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat'
    );

    // Build HTML with optional chart section
    let html = '';
    if (chartableItems.length >= 2) {
        html += `
            <div class="compare-chart-section">
                <h3>Scaling Comparison</h3>
                <div class="compare-chart-container">
                    <canvas id="compare-scaling-chart" class="scaling-chart"></canvas>
                </div>
            </div>
        `;
    }

    html += '<div class="compare-grid">';

    items.forEach((item: Item) => {
        const isPercentage =
            item.scaling_type && (item.scaling_type.includes('chance') || item.scaling_type.includes('damage'));
        const unit = isPercentage ? '%' : '';

        html += `
            <div class="compare-column">
                <div class="compare-header">
                    <h3>${escapeHtml(item.name)}</h3>
                    <div class="item-badges">
                        <span class="badge rarity-${item.rarity}">${item.rarity}</span>
                        <span class="badge tier-${item.tier}">${item.tier} Tier</span>
                    </div>
                </div>

                <div class="compare-section">
                    <h4>Base Effect</h4>
                    <p>${escapeHtml(item.base_effect || 'N/A')}</p>
                </div>

                <div class="compare-section">
                    <h4>Stacking</h4>
                    ${
                        item.stacks_well === undefined
                            ? '<p class="neutral">Stacking behavior unknown</p>'
                            : `<p class="${item.stacks_well ? 'positive' : 'negative'}">
                            ${item.stacks_well ? '✓ Stacks Well' : '✗ One-and-Done'}
                        </p>`
                    }
                </div>

                <div class="compare-section">
                    <h4>Formula</h4>
                    <code class="formula-code">${escapeHtml(item.formula || 'N/A')}</code>
                </div>

                <div class="compare-section">
                    <h4>Scaling (1-10 stacks)</h4>
                    <div class="scaling-values">
                        ${
                            item.scaling_per_stack
                                ? item.scaling_per_stack
                                      .map(
                                          (val: number, idx: number) =>
                                              `<span class="scale-value">${idx + 1}: <strong>${val}${unit}</strong></span>`
                                      )
                                      .join('')
                                : 'N/A'
                        }
                    </div>
                </div>

                ${
                    item.synergies?.length
                        ? `
                    <div class="compare-section">
                        <h4>Synergies</h4>
                        <div class="synergy-tags">
                            ${item.synergies
                                .slice(0, 5)
                                .map((s: string) => `<span class="synergy-tag">${escapeHtml(s)}</span>`)
                                .join('')}
                        </div>
                    </div>
                `
                        : ''
                }

                ${
                    item.anti_synergies?.length
                        ? `
                    <div class="compare-section">
                        <h4>Anti-Synergies</h4>
                        <div class="antisynergy-tags">
                            ${item.anti_synergies.map((s: string) => `<span class="antisynergy-tag">${escapeHtml(s)}</span>`).join('')}
                        </div>
                    </div>
                `
                        : ''
                }

                <div class="compare-section">
                    <h4>Notes</h4>
                    <p class="notes">${escapeHtml(item.notes || 'N/A')}</p>
                </div>

                <button class="remove-compare-btn" data-remove-id="${item.id}">
                    Remove from Comparison
                </button>
            </div>
        `;
    });

    html += '</div>';
    compareBody.innerHTML = html;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false'); // Announce modal to screen readers
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });

    // Initialize compare chart after DOM is ready
    if (chartableItems.length >= 2) {
        // Dynamically import chart function only when needed
        const { createCompareChart } = await import('./charts.ts');

        // Use requestAnimationFrame for more reliable DOM readiness
        requestAnimationFrame(() => {
            // Check if modal is still active and canvas exists before creating chart
            const modal = safeGetElementById('compareModal');
            const canvas = document.getElementById('compare-scaling-chart');
            if (modal && modal.classList.contains('active') && canvas) {
                createCompareChart('compare-scaling-chart', chartableItems);
            }
        });
    }
}

/**
 * Close compare modal with animation
 */
export async function closeCompareModal(): Promise<void> {
    // Destroy compare chart before closing to prevent memory leak
    // Dynamically import to access chartInstances
    try {
        const { chartInstances } = await import('./charts.ts');
        const instances = chartInstances as Record<string, any>;
        if (instances && instances['compare-scaling-chart']) {
            instances['compare-scaling-chart'].destroy();
            delete instances['compare-scaling-chart'];
        }
    } catch {
        // Chart module not loaded yet, nothing to clean up
    }

    const modal = safeGetElementById('compareModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true'); // Hide from screen readers
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

/**
 * Update compare display after item removal
 */
export function updateCompareDisplay(): void {
    const compareItems = getState('compareItems');
    if (compareItems.length < 2) {
        closeCompareModal();
    } else {
        openCompareModal();
    }
}

/**
 * Clear all compare selections
 */
export function clearCompare(): void {
    setState('compareItems', []);
    updateCompareButton();
    closeCompareModal();
}

// ========================================
// Exported API
// ========================================

/**
 * Get compare items (returns a copy to prevent state corruption)
 * @returns Compare items array
 */
export function getCompareItems(): string[] {
    return [...getState('compareItems')];
}
