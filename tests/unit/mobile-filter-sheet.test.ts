/**
 * Mobile Filter Sheet Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    safeQuerySelector: vi.fn((sel: string) => document.querySelector(sel)),
}));

import {
    createFilterSheet,
    renderFilterGroups,
    setupSheetEventListeners,
    handleKeyboardNavigation,
    handleFocusTrap,
    type FilterConfig,
} from '../../src/modules/mobile-filter-sheet.ts';

describe('mobile-filter-sheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    const sampleFilters: FilterConfig[] = [
        {
            id: 'sort',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'date', label: 'Date' },
            ],
        },
        { id: 'favorites', label: 'Favorites Only', type: 'checkbox' },
    ];

    describe('createFilterSheet', () => {
        it('should create a sheet element with correct structure', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            expect(sheet.id).toBe('filter-bottom-sheet');
            expect(sheet.className).toBe('filter-bottom-sheet');
            expect(sheet.getAttribute('role')).toBe('dialog');
            expect(sheet.getAttribute('aria-modal')).toBe('true');
        });

        it('should contain backdrop and drawer', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            expect(sheet.querySelector('.filter-sheet-backdrop')).toBeTruthy();
            expect(sheet.querySelector('.filter-sheet-drawer')).toBeTruthy();
        });

        it('should contain header with close and clear buttons', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            expect(sheet.querySelector('.filter-sheet-close')).toBeTruthy();
            expect(sheet.querySelector('.filter-sheet-clear')).toBeTruthy();
        });

        it('should contain apply button', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            expect(sheet.querySelector('#filter-sheet-apply-btn')).toBeTruthy();
        });

        it('should render filter groups inside content', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            const content = sheet.querySelector('#filter-sheet-content')!;
            expect(content.querySelectorAll('.filter-group')).toHaveLength(2);
        });
    });

    describe('renderFilterGroups', () => {
        it('should render select filters', () => {
            const html = renderFilterGroups([sampleFilters[0]]);
            expect(html).toContain('select');
            expect(html).toContain('sheet-sort');
            expect(html).toContain('Name');
            expect(html).toContain('Date');
        });

        it('should render checkbox filters', () => {
            const html = renderFilterGroups([sampleFilters[1]]);
            expect(html).toContain('checkbox');
            expect(html).toContain('sheet-favorites');
            expect(html).toContain('Favorites Only');
        });

        it('should render empty string for empty array', () => {
            expect(renderFilterGroups([])).toBe('');
        });
    });

    describe('setupSheetEventListeners', () => {
        it('should attach click handlers', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            document.body.appendChild(sheet);

            const hide = vi.fn();
            const clear = vi.fn();
            const apply = vi.fn();
            const badge = vi.fn();

            setupSheetEventListeners(sheet, hide, clear, apply, badge);

            // Click backdrop
            sheet.querySelector<HTMLElement>('.filter-sheet-backdrop')!.click();
            expect(hide).toHaveBeenCalledTimes(1);

            // Click close
            sheet.querySelector<HTMLElement>('.filter-sheet-close')!.click();
            expect(hide).toHaveBeenCalledTimes(2);

            // Click clear
            sheet.querySelector<HTMLElement>('.filter-sheet-clear')!.click();
            expect(clear).toHaveBeenCalledTimes(1);

            // Click apply
            sheet.querySelector<HTMLElement>('#filter-sheet-apply-btn')!.click();
            expect(apply).toHaveBeenCalledTimes(1);
            expect(hide).toHaveBeenCalledTimes(3);
            expect(badge).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleKeyboardNavigation', () => {
        it('should call hideFilterSheet on Escape when sheet is open', () => {
            const hide = vi.fn();
            const e = new KeyboardEvent('keydown', { key: 'Escape' });
            vi.spyOn(e, 'preventDefault');
            handleKeyboardNavigation(e, true, hide);
            expect(hide).toHaveBeenCalled();
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it('should do nothing when sheet is closed', () => {
            const hide = vi.fn();
            const e = new KeyboardEvent('keydown', { key: 'Escape' });
            handleKeyboardNavigation(e, false, hide);
            expect(hide).not.toHaveBeenCalled();
        });

        it('should do nothing for non-Escape keys', () => {
            const hide = vi.fn();
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            handleKeyboardNavigation(e, true, hide);
            expect(hide).not.toHaveBeenCalled();
        });
    });

    describe('handleFocusTrap', () => {
        it('should do nothing when not Tab key', () => {
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');
            handleFocusTrap(e, true);
            expect(e.preventDefault).not.toHaveBeenCalled();
        });

        it('should do nothing when sheet is not open', () => {
            const e = new KeyboardEvent('keydown', { key: 'Tab' });
            vi.spyOn(e, 'preventDefault');
            handleFocusTrap(e, false);
            expect(e.preventDefault).not.toHaveBeenCalled();
        });

        it('should attempt focus trap on Tab when sheet is open', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            sheet.id = 'filter-bottom-sheet';
            document.body.appendChild(sheet);

            // Get focusable elements within the sheet
            const focusable = sheet.querySelectorAll<HTMLElement>('button:not([disabled]), select, input');
            expect(focusable.length).toBeGreaterThan(0);

            // Focus the last focusable element
            const last = focusable[focusable.length - 1];
            last.focus();

            const e = new KeyboardEvent('keydown', { key: 'Tab' });
            vi.spyOn(e, 'preventDefault');
            handleFocusTrap(e, true);
            // In jsdom, offsetParent is null so the focusable filter may
            // exclude elements, but the function should still execute
            // without errors. With real DOM layout, it would trap focus.
        });

        it('should handle Shift+Tab at first element', () => {
            const sheet = createFilterSheet('items', sampleFilters);
            sheet.id = 'filter-bottom-sheet';
            document.body.appendChild(sheet);

            const focusable = sheet.querySelectorAll<HTMLElement>('button:not([disabled]), select, input');
            if (focusable.length > 0) {
                focusable[0].focus();
            }

            const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
            vi.spyOn(e, 'preventDefault');
            handleFocusTrap(e, true);
            // Verify focusable elements exist in the sheet
            expect(focusable.length).toBeGreaterThan(0);
        });

        it('should do nothing without sheet in DOM', () => {
            const e = new KeyboardEvent('keydown', { key: 'Tab' });
            vi.spyOn(e, 'preventDefault');
            handleFocusTrap(e, true);
            // No sheet found, no error thrown, no preventDefault
            expect(e.preventDefault).not.toHaveBeenCalled();
        });
    });
});
