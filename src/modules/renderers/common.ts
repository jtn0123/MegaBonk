// ========================================
// Common Renderer Utilities
// ========================================

import { safeGetElementById } from '../utils.ts';
import { getDataForTab } from '../data-service.ts';
import { logger } from '../logger.ts';
import type { Entity } from '../../types/index.ts';

/**
 * Helper to initialize charts with requestAnimationFrame and error handling
 * Reduces code duplication across render functions
 * @param chartInitFn - The name of the chart init function to import and call
 * @param context - Context string for logging (e.g., 'item_tab_render')
 */
export function initChartsAsync(chartInitFn: 'initializeItemCharts' | 'initializeTomeCharts', context: string): void {
    requestAnimationFrame(async () => {
        try {
            const charts = await import('../charts.ts');
            charts[chartInitFn]();
        } catch (err) {
            logger.warn({
                operation: 'chart.init',
                error: { name: 'ImportError', message: `Failed to initialize ${chartInitFn}`, module: 'renderers' },
                data: { context },
            });
        }
    });
}

/** Tabs that don't have countable data entities */
const NON_DATA_TABS = ['calculator', 'advisor', 'about', 'build-planner'];

/**
 * Update item count badge
 * @param {Entity[]} filtered - Filtered data
 * @param {string} tabName - Current tab
 */
export function updateStats(filtered: Entity[], tabName: string): void {
    const itemCount = safeGetElementById('item-count');
    if (!itemCount) return;

    // Hide count badge for non-data tabs (Calculator, Advisor, About, Build Planner)
    if (NON_DATA_TABS.includes(tabName)) {
        itemCount.style.display = 'none';
        return;
    }

    // Show the badge for data tabs
    itemCount.style.display = '';

    const totalCount = getDataForTab(tabName).length;
    const showingCount = filtered.length;

    // Get singular/plural label based on tab
    const categoryName = tabName && tabName.length > 0 ? tabName : 'items';
    const label = showingCount === 1 ? categoryName.slice(0, -1) : categoryName;

    // Show "X items" or "X/Y items" if filtered
    if (showingCount === totalCount) {
        itemCount.textContent = `${showingCount} ${label}`;
    } else {
        itemCount.textContent = `${showingCount}/${totalCount} ${label}`;
    }
}
