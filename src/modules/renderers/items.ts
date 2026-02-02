// ========================================
// Item Renderer
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
    truncateText,
} from '../utils.ts';
import { initChartsAsync } from './common.ts';
import { detectEmptyStateType, generateEmptyStateWithSuggestions } from '../empty-states.ts';
import { FEATURES } from '../constants.ts';
import type { Item } from './types.ts';

/**
 * Render items grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} items - Items to render
 */
export async function renderItems(items: Item[]): Promise<void> {
    const container = safeGetElementById('itemsContainer');
    if (!container) return;

    if (items.length === 0) {
        const context = detectEmptyStateType('items');
        container.innerHTML = generateEmptyStateWithSuggestions(context);
        return;
    }

    // Cache compare items lookup once instead of per-item
    // Dynamic import for code splitting - module is preloaded by tab-loader
    // Only load compare module if feature is enabled
    let compareItems: string[] = [];
    if (FEATURES.COMPARE_ITEMS) {
        const { getCompareItems } = await import('../compare.ts');
        compareItems = getCompareItems();
    }

    // Use DocumentFragment to batch all DOM operations - prevents multiple reflows
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `item-card rarity-${item.rarity} clickable-card`;
        card.dataset.entityType = 'item';
        card.dataset.entityId = item.id;

        // Reserved for future use: const stackIcon = item.one_and_done ? '✓' : item.stacks_well ? '∞' : '~';
        const stackText = item.one_and_done ? 'One-and-Done' : item.stacks_well ? 'Stacks Well' : 'Limited';
        const imageHtml = generateEntityImage(item, item.name);

        // Determine if this item should show a scaling graph
        const showGraph = item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat';
        const graphHtml = showGraph
            ? `
            <div class="item-graph-container">
                <canvas id="chart-${item.id}" class="scaling-chart"></canvas>
            </div>
        `
            : `
            <div class="item-graph-placeholder">
                <span>${item.one_and_done ? 'One-and-done: no scaling benefit from stacks' : 'Flat bonus: does not scale'}</span>
            </div>
        `;

        // Handle expandable description
        const { html: descHtml, needsExpand, fullText } = truncateText(item.detailed_description, 120);

        // DISABLED: Favorites feature UI hidden (module kept for data persistence)
        // const isFav = typeof isFavorite === 'function' ? isFavorite('items', item.id) : false;
        
        // Compare checkbox - only render if feature is enabled
        const compareCheckboxHtml = FEATURES.COMPARE_ITEMS
            ? `<label class="compare-checkbox-label" title="Add to comparison">
                    <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${compareItems.includes(item.id) ? 'checked' : ''}>
                    <span>+</span>
                </label>`
            : '';
        
        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    ${generateTierLabel(item.tier)}
                </div>
                ${compareCheckboxHtml}
            </div>
            <div class="item-effect">${escapeHtml(item.base_effect)}</div>
            <div class="item-description ${needsExpand ? 'expandable-text' : ''}"
                 ${needsExpand ? `data-full-text="${escapeHtml(fullText)}" data-truncated="true"` : ''}>
                ${descHtml}
                ${needsExpand ? '<span class="expand-indicator">Click to expand</span>' : ''}
            </div>
            <div class="item-meta">
                <span class="meta-tag">${stackText}</span>
            </div>
            ${graphHtml}
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - clear and append atomically to avoid flash
    container.innerHTML = '';
    container.appendChild(fragment);

    // Initialize charts after DOM is painted
    initChartsAsync('initializeItemCharts', 'item_tab_render');
}
