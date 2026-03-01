// ========================================
// Mobile Filter Logic Module
// State synchronization, filter counting, and badge updates
// ========================================

import { getState } from './store.ts';
import { safeGetElementById, safeQuerySelector } from './utils.ts';
import { saveFilterState } from './filter-state.ts';
import type { FilterConfig } from './mobile-filter-sheet.ts';

type FilterInputElement = HTMLInputElement | HTMLSelectElement;

/**
 * Sync filter values from main filters to bottom sheet
 */
export function syncFiltersToSheet(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<FilterInputElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        const filterId = sheetInput.dataset.filterId;
        if (!filterId) return;

        const mainInput = safeGetElementById(filterId) as FilterInputElement | null;

        if (mainInput) {
            if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
                sheetInput.checked = (mainInput as HTMLInputElement).checked;
            } else if (sheetInput instanceof HTMLSelectElement && mainInput instanceof HTMLSelectElement) {
                sheetInput.value = mainInput.value;
            }
        }
    });
}

/**
 * Apply filter values from bottom sheet to main filters
 */
export function applyFiltersFromSheet(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<FilterInputElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        const filterId = sheetInput.dataset.filterId;
        if (!filterId) return;

        const mainInput = safeGetElementById(filterId) as FilterInputElement | null;

        if (mainInput) {
            if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
                (mainInput as HTMLInputElement).checked = sheetInput.checked;
            } else if (sheetInput instanceof HTMLSelectElement && mainInput instanceof HTMLSelectElement) {
                mainInput.value = sheetInput.value;
            }

            mainInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    const currentTab = getState('currentTab');
    if (currentTab) {
        saveFilterState(currentTab);
    }
}

/**
 * Clear all filters in the bottom sheet
 */
export function clearSheetFilters(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<FilterInputElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
            sheetInput.checked = false;
        } else if (sheetInput instanceof HTMLSelectElement) {
            sheetInput.value = 'all';
        }
    });
}

/**
 * Count active filters
 */
export function countActiveFilters(tabFilters: Record<string, FilterConfig[]>): number {
    let count = 0;
    const currentTab = getState('currentTab');
    const filters = tabFilters[currentTab || ''] || [];

    filters.forEach(filter => {
        const input = safeGetElementById(filter.id) as FilterInputElement | null;
        if (!input) return;

        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            if (input.checked) count++;
        } else if (input instanceof HTMLSelectElement) {
            if (input.value !== 'all' && input.value !== 'name' && input.value !== 'date_desc') {
                count++;
            }
        }
    });

    return count;
}

/**
 * Update filter button badge
 */
export function updateFilterBadge(tabFilters: Record<string, FilterConfig[]>): void {
    const btn = safeQuerySelector('.mobile-filter-btn') as HTMLElement | null;
    if (!btn) return;

    const count = countActiveFilters(tabFilters);
    const badge = btn.querySelector<HTMLElement>('.filter-badge');

    if (badge) {
        badge.textContent = count.toString();
    }

    btn.classList.toggle('has-filters', count > 0);
}
