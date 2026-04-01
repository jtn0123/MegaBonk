/**
 * Mobile Filter Logic Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn(() => 'items'),
    setState: vi.fn(),
    resetStore: vi.fn(),
}));

vi.mock('../../src/modules/filter-state.ts', () => ({
    saveFilterState: vi.fn(),
}));

import {
    syncFiltersToSheet,
    applyFiltersFromSheet,
    clearSheetFilters,
    countActiveFilters,
    updateFilterBadge,
} from '../../src/modules/mobile-filter-logic.ts';
import { getState } from '../../src/modules/store.ts';
import { saveFilterState } from '../../src/modules/filter-state.ts';
import type { FilterConfig } from '../../src/modules/mobile-filter-sheet.ts';

describe('mobile-filter-logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('syncFiltersToSheet', () => {
        it('should sync checkbox values from main to sheet', () => {
            document.body.innerHTML = `
                <input type="checkbox" id="favorites" checked />
                <div id="filter-bottom-sheet">
                    <input type="checkbox" id="sheet-favorites" data-filter-id="favorites" />
                </div>
            `;
            syncFiltersToSheet();
            const sheetCheckbox = document.getElementById('sheet-favorites') as HTMLInputElement;
            expect(sheetCheckbox.checked).toBe(true);
        });

        it('should sync select values from main to sheet', () => {
            document.body.innerHTML = `
                <select id="sort"><option value="name">Name</option><option value="date" selected>Date</option></select>
                <div id="filter-bottom-sheet">
                    <select id="sheet-sort" data-filter-id="sort"><option value="name">Name</option><option value="date">Date</option></select>
                </div>
            `;
            syncFiltersToSheet();
            const sheetSelect = document.getElementById('sheet-sort') as HTMLSelectElement;
            expect(sheetSelect.value).toBe('date');
        });

        it('should do nothing without sheet', () => {
            expect(() => syncFiltersToSheet()).not.toThrow();
        });

        it('should skip inputs without matching main element', () => {
            document.body.innerHTML = `
                <div id="filter-bottom-sheet">
                    <input type="checkbox" id="sheet-missing" data-filter-id="nonexistent" />
                </div>
            `;
            expect(() => syncFiltersToSheet()).not.toThrow();
        });
    });

    describe('applyFiltersFromSheet', () => {
        it('should apply checkbox values from sheet to main', () => {
            document.body.innerHTML = `
                <input type="checkbox" id="favorites" />
                <div id="filter-bottom-sheet">
                    <input type="checkbox" id="sheet-favorites" data-filter-id="favorites" checked />
                </div>
            `;
            applyFiltersFromSheet();
            const mainCheckbox = document.getElementById('favorites') as HTMLInputElement;
            expect(mainCheckbox.checked).toBe(true);
        });

        it('should apply select values from sheet to main', () => {
            document.body.innerHTML = `
                <select id="sort"><option value="name">Name</option><option value="date">Date</option></select>
                <div id="filter-bottom-sheet">
                    <select id="sheet-sort" data-filter-id="sort"><option value="name">Name</option><option value="date" selected>Date</option></select>
                </div>
            `;
            applyFiltersFromSheet();
            const mainSelect = document.getElementById('sort') as HTMLSelectElement;
            expect(mainSelect.value).toBe('date');
        });

        it('should dispatch change events', () => {
            document.body.innerHTML = `
                <input type="checkbox" id="favorites" />
                <div id="filter-bottom-sheet">
                    <input type="checkbox" id="sheet-favorites" data-filter-id="favorites" checked />
                </div>
            `;
            const changeSpy = vi.fn();
            document.getElementById('favorites')!.addEventListener('change', changeSpy);
            applyFiltersFromSheet();
            expect(changeSpy).toHaveBeenCalled();
        });

        it('should save filter state', () => {
            document.body.innerHTML = '<div id="filter-bottom-sheet"></div>';
            vi.mocked(getState).mockReturnValue('items');
            applyFiltersFromSheet();
            expect(saveFilterState).toHaveBeenCalledWith('items');
        });

        it('should do nothing without sheet', () => {
            expect(() => applyFiltersFromSheet()).not.toThrow();
        });
    });

    describe('clearSheetFilters', () => {
        it('should uncheck all checkboxes', () => {
            document.body.innerHTML = `
                <div id="filter-bottom-sheet">
                    <input type="checkbox" data-filter-id="fav" checked />
                </div>
            `;
            clearSheetFilters();
            const cb = document.querySelector<HTMLInputElement>('[data-filter-id="fav"]')!;
            expect(cb.checked).toBe(false);
        });

        it('should reset selects to "all"', () => {
            document.body.innerHTML = `
                <div id="filter-bottom-sheet">
                    <select data-filter-id="sort">
                        <option value="all">All</option>
                        <option value="name" selected>Name</option>
                    </select>
                </div>
            `;
            clearSheetFilters();
            const sel = document.querySelector<HTMLSelectElement>('[data-filter-id="sort"]')!;
            expect(sel.value).toBe('all');
        });

        it('should do nothing without sheet', () => {
            expect(() => clearSheetFilters()).not.toThrow();
        });
    });

    describe('countActiveFilters', () => {
        it('should count checked checkboxes', () => {
            document.body.innerHTML = '<input type="checkbox" id="fav" checked />';
            vi.mocked(getState).mockReturnValue('items');
            const tabFilters: Record<string, FilterConfig[]> = {
                items: [{ id: 'fav', label: 'Favorites', type: 'checkbox' }],
            };
            expect(countActiveFilters(tabFilters)).toBe(1);
        });

        it('should count multiple active checkbox filters', () => {
            document.body.innerHTML = `
                <input type="checkbox" id="fav" checked />
                <input type="checkbox" id="owned" checked />
            `;
            vi.mocked(getState).mockReturnValue('items');
            const tabFilters: Record<string, FilterConfig[]> = {
                items: [
                    { id: 'fav', label: 'Favorites', type: 'checkbox' },
                    { id: 'owned', label: 'Owned Only', type: 'checkbox' },
                ],
            };
            expect(countActiveFilters(tabFilters)).toBe(2);
        });

        it('should not count unchecked checkboxes', () => {
            document.body.innerHTML = '<input type="checkbox" id="fav" />';
            vi.mocked(getState).mockReturnValue('items');
            const tabFilters: Record<string, FilterConfig[]> = {
                items: [{ id: 'fav', label: 'Favorites', type: 'checkbox' }],
            };
            expect(countActiveFilters(tabFilters)).toBe(0);
        });

        it('should not count default select values', () => {
            document.body.innerHTML =
                '<select id="sort"><option value="all" selected>All</option><option value="name">Name</option></select>';
            vi.mocked(getState).mockReturnValue('items');
            const tabFilters: Record<string, FilterConfig[]> = {
                items: [{ id: 'sort', label: 'Sort', type: 'select' }],
            };
            expect(countActiveFilters(tabFilters)).toBe(0);
        });

        it('should return 0 for unknown tab', () => {
            vi.mocked(getState).mockReturnValue('unknown');
            expect(countActiveFilters({})).toBe(0);
        });
    });

    describe('updateFilterBadge', () => {
        it('should update badge text and class', () => {
            document.body.innerHTML = `
                <button class="mobile-filter-btn">
                    <span class="filter-badge">0</span>
                </button>
                <input type="checkbox" id="fav" checked />
            `;
            vi.mocked(getState).mockReturnValue('items');
            const tabFilters: Record<string, FilterConfig[]> = {
                items: [{ id: 'fav', label: 'Favorites', type: 'checkbox' }],
            };
            updateFilterBadge(tabFilters);
            const badge = document.querySelector<HTMLElement>('.filter-badge')!;
            expect(badge.textContent).toBe('1');
            const btn = document.querySelector<HTMLElement>('.mobile-filter-btn')!;
            expect(btn.classList.contains('has-filters')).toBe(true);
        });

        it('should remove has-filters class when count is 0', () => {
            document.body.innerHTML = `
                <button class="mobile-filter-btn has-filters">
                    <span class="filter-badge">1</span>
                </button>
            `;
            vi.mocked(getState).mockReturnValue('items');
            updateFilterBadge({ items: [] });
            const btn = document.querySelector<HTMLElement>('.mobile-filter-btn')!;
            expect(btn.classList.contains('has-filters')).toBe(false);
        });

        it('should do nothing without filter button', () => {
            expect(() => updateFilterBadge({})).not.toThrow();
        });
    });
});
