// ========================================
// Mobile Filter Sheet DOM/UI Module
// Bottom sheet creation, rendering, and event listeners
// ========================================

import { safeGetElementById } from '../utils.ts';

// ========================================
// Types
// ========================================

interface FilterConfig {
    id: string;
    label: string;
    type: 'select' | 'checkbox';
    options?: { value: string; label: string }[];
}

export type { FilterConfig };

/**
 * Create the filter bottom sheet HTML
 */
export function createFilterSheet(_tabName: string, filters: FilterConfig[]): HTMLElement {
    const sheet = document.createElement('div');
    sheet.id = 'filter-bottom-sheet';
    sheet.className = 'filter-bottom-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Filter options');

    sheet.innerHTML = `
        <div class="filter-sheet-backdrop" aria-hidden="true"></div>
        <div class="filter-sheet-drawer" role="document">
            <div class="filter-sheet-handle" aria-hidden="true"></div>
            <div class="filter-sheet-header">
                <span class="filter-sheet-title" id="filter-sheet-title">Filters</span>
                <div class="filter-sheet-actions">
                    <button class="filter-sheet-clear" type="button">Clear All</button>
                    <button class="filter-sheet-close" aria-label="Close filters" type="button">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            </div>
            <div class="filter-sheet-content" id="filter-sheet-content">
                ${renderFilterGroups(filters)}
            </div>
            <div class="filter-sheet-apply">
                <button type="button" id="filter-sheet-apply-btn">Apply Filters</button>
            </div>
        </div>
    `;

    return sheet;
}

/**
 * Render filter groups HTML
 */
export function renderFilterGroups(filters: FilterConfig[]): string {
    return filters
        .map(filter => {
            if (filter.type === 'checkbox') {
                return `
                    <div class="filter-group">
                        <label class="filter-group-checkbox">
                            <input type="checkbox" id="sheet-${filter.id}" data-filter-id="${filter.id}" />
                            <span class="checkbox-label">${filter.label}</span>
                        </label>
                    </div>
                `;
            } else {
                return `
                    <div class="filter-group">
                        <label class="filter-group-label" for="sheet-${filter.id}">${filter.label}</label>
                        <select id="sheet-${filter.id}" data-filter-id="${filter.id}">
                            ${filter.options?.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                        </select>
                    </div>
                `;
            }
        })
        .join('');
}

/**
 * Setup event listeners for the sheet
 */
export function setupSheetEventListeners(
    sheet: HTMLElement,
    hideFilterSheet: () => void,
    clearSheetFilters: () => void,
    applyFiltersFromSheet: () => void,
    updateFilterBadge: () => void
): void {
    const backdrop = sheet.querySelector('.filter-sheet-backdrop');
    backdrop?.addEventListener('click', hideFilterSheet);

    const closeBtn = sheet.querySelector('.filter-sheet-close');
    closeBtn?.addEventListener('click', hideFilterSheet);

    const clearBtn = sheet.querySelector('.filter-sheet-clear');
    clearBtn?.addEventListener('click', () => {
        clearSheetFilters();
    });

    const applyBtn = sheet.querySelector('#filter-sheet-apply-btn');
    applyBtn?.addEventListener('click', () => {
        applyFiltersFromSheet();
        hideFilterSheet();
        updateFilterBadge();
    });
}

/**
 * Handle keyboard navigation within sheet
 */
export function handleKeyboardNavigation(e: KeyboardEvent, isSheetOpen: boolean, hideFilterSheet: () => void): void {
    if (!isSheetOpen) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        hideFilterSheet();
    }
}

/**
 * Handle focus trapping
 */
export function handleFocusTrap(e: KeyboardEvent, isSheetOpen: boolean): void {
    if (e.key !== 'Tab' || !isSheetOpen) return;

    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const focusableElements = Array.from(
        sheet.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        }
    } else if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
    }
}
