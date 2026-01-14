/**
 * Comprehensive tests for compare.ts - Compare Mode Module
 * Tests for item comparison functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    toggleCompareItem,
    updateCompareButton,
    clearCompare,
    getCompareItems,
    updateCompareDisplay,
} from '../../src/modules/compare.ts';
import { setupDOM } from '../helpers/dom-setup.js';

// Mock toast
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        warning: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock data-service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                { id: 'item1', name: 'Item 1', tier: 'A', rarity: 'rare', scaling_per_stack: [10] },
                { id: 'item2', name: 'Item 2', tier: 'S', rarity: 'epic', scaling_per_stack: [20] },
                { id: 'item3', name: 'Item 3', tier: 'B', rarity: 'uncommon', scaling_per_stack: [5] },
                { id: 'item4', name: 'Item 4', tier: 'SS', rarity: 'legendary', scaling_per_stack: [50] },
            ],
        },
    },
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', async () => {
    const actual = await vi.importActual('../../src/modules/utils.ts');
    return {
        ...actual,
        safeGetElementById: (id: string) => document.getElementById(id),
        safeQuerySelector: (selector: string, parent?: Element) =>
            parent ? parent.querySelector(selector) : document.querySelector(selector),
        safeQuerySelectorAll: (selector: string, parent?: Element) =>
            parent ? parent.querySelectorAll(selector) : document.querySelectorAll(selector),
        escapeHtml: (text: string) => text.replace(/[&<>"']/g, (m: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] || m)),
    };
});

// Mock constants
vi.mock('../../src/modules/constants.ts', () => ({
    MAX_COMPARE_ITEMS: 4,
}));

describe('Compare Module - Comprehensive Tests', () => {
    beforeEach(() => {
        setupDOM();
        clearCompare();

        document.body.innerHTML = `
            <button id="compare-btn" style="display: none;">
                Compare <span class="compare-count">0</span>
            </button>
            <input type="checkbox" class="compare-checkbox" data-id="item1" />
            <input type="checkbox" class="compare-checkbox" data-id="item2" />
            <input type="checkbox" class="compare-checkbox" data-id="item3" />
            <input type="checkbox" class="compare-checkbox" data-id="item4" />
            <div id="compareBody"></div>
            <div id="compareModal"></div>
        `;
    });

    describe('toggleCompareItem', () => {
        it('should add item to compare list', () => {
            toggleCompareItem('item1');

            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items.length).toBe(1);
        });

        it('should remove item from compare list when already present', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item1');

            const items = getCompareItems();
            expect(items).not.toContain('item1');
            expect(items.length).toBe(0);
        });

        it('should toggle multiple items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');

            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items).toContain('item2');
            expect(items).toContain('item3');
            expect(items.length).toBe(3);
        });

        it('should maintain order of added items', () => {
            toggleCompareItem('item3');
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            const items = getCompareItems();
            expect(items[0]).toBe('item3');
            expect(items[1]).toBe('item1');
            expect(items[2]).toBe('item2');
        });

        it('should not exceed MAX_COMPARE_ITEMS limit', () => {
            const { ToastManager } = await import('../../src/modules/toast.ts');

            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            toggleCompareItem('item4');
            toggleCompareItem('item5'); // Should be rejected

            const items = getCompareItems();
            expect(items.length).toBe(4);
            expect(ToastManager.warning).toHaveBeenCalledWith(expect.stringContaining('4 items'));
        });

        it('should allow adding after removing an item', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            toggleCompareItem('item4');

            toggleCompareItem('item1'); // Remove
            toggleCompareItem('item1'); // Add back

            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items.length).toBe(4);
        });

        it('should update compare button after toggle', () => {
            const compareBtn = document.getElementById('compare-btn');

            toggleCompareItem('item1');
            expect(compareBtn?.style.display).toBe('none'); // Only 1 item

            toggleCompareItem('item2');
            expect(compareBtn?.style.display).toBe('block'); // 2+ items
        });
    });

    describe('updateCompareButton', () => {
        it('should show button when 2+ items selected', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('block');
        });

        it('should hide button when less than 2 items', () => {
            toggleCompareItem('item1');

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should update count display', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');

            const countSpan = document.querySelector('.compare-count');
            expect(countSpan?.textContent).toBe('3');
        });

        it('should update checkboxes to reflect selected items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item3');

            const checkbox1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
            const checkbox2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;
            const checkbox3 = document.querySelector('[data-id="item3"]') as HTMLInputElement;

            expect(checkbox1.checked).toBe(true);
            expect(checkbox2.checked).toBe(false);
            expect(checkbox3.checked).toBe(true);
        });

        it('should handle missing compare button gracefully', () => {
            document.body.innerHTML = '';

            expect(() => {
                updateCompareButton();
            }).not.toThrow();
        });

        it('should handle missing count span gracefully', () => {
            document.body.innerHTML = '<button id="compare-btn"></button>';

            expect(() => {
                updateCompareButton();
            }).not.toThrow();
        });

        it('should update all checkboxes', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            const checkboxes = document.querySelectorAll('.compare-checkbox') as NodeListOf<HTMLInputElement>;
            const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);

            expect(checkedBoxes.length).toBe(2);
        });

        it('should handle checkboxes with value attribute instead of data-id', () => {
            document.body.innerHTML += '<input type="checkbox" class="compare-checkbox" value="item5" />';

            toggleCompareItem('item5');

            const checkbox = document.querySelector('[value="item5"]') as HTMLInputElement;
            expect(checkbox.checked).toBe(true);
        });
    });

    describe('clearCompare', () => {
        it('should clear all selected items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');

            clearCompare();

            const items = getCompareItems();
            expect(items.length).toBe(0);
        });

        it('should update button after clearing', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            clearCompare();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should uncheck all checkboxes after clearing', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            clearCompare();

            const checkboxes = document.querySelectorAll('.compare-checkbox') as NodeListOf<HTMLInputElement>;
            const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);

            expect(checkedBoxes.length).toBe(0);
        });

        it('should be idempotent', () => {
            toggleCompareItem('item1');

            clearCompare();
            clearCompare();
            clearCompare();

            expect(getCompareItems().length).toBe(0);
        });

        it('should work on empty list', () => {
            expect(() => {
                clearCompare();
            }).not.toThrow();

            expect(getCompareItems().length).toBe(0);
        });
    });

    describe('getCompareItems', () => {
        it('should return empty array initially', () => {
            const items = getCompareItems();

            expect(items).toEqual([]);
            expect(items.length).toBe(0);
        });

        it('should return array of item IDs', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            const items = getCompareItems();

            expect(items).toEqual(['item1', 'item2']);
        });

        it('should return a copy of the array', () => {
            toggleCompareItem('item1');

            const items1 = getCompareItems();
            const items2 = getCompareItems();

            expect(items1).not.toBe(items2);
            expect(items1).toEqual(items2);
        });

        it('should not allow external modification of internal state', () => {
            toggleCompareItem('item1');

            const items = getCompareItems();
            items.push('item2');

            const actualItems = getCompareItems();
            expect(actualItems).toEqual(['item1']);
        });

        it('should reflect current state after operations', () => {
            toggleCompareItem('item1');
            expect(getCompareItems()).toEqual(['item1']);

            toggleCompareItem('item2');
            expect(getCompareItems()).toEqual(['item1', 'item2']);

            toggleCompareItem('item1');
            expect(getCompareItems()).toEqual(['item2']);

            clearCompare();
            expect(getCompareItems()).toEqual([]);
        });
    });

    describe('updateCompareDisplay', () => {
        it('should call updateCompareButton', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            updateCompareDisplay();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('block');
        });

        it('should not throw with missing elements', () => {
            document.body.innerHTML = '';

            expect(() => {
                updateCompareDisplay();
            }).not.toThrow();
        });
    });

    describe('Compare Mode Integration', () => {
        it('should handle complete workflow', () => {
            // Add items
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            // Verify state
            expect(getCompareItems()).toEqual(['item1', 'item2']);

            // Button should be visible
            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('block');

            // Remove one item
            toggleCompareItem('item1');
            expect(getCompareItems()).toEqual(['item2']);

            // Button should be hidden
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should maintain consistency between state and UI', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');

            const items = getCompareItems();
            const countSpan = document.querySelector('.compare-count');
            const checkedBoxes = Array.from(document.querySelectorAll('.compare-checkbox')).filter(
                (cb: Element) => (cb as HTMLInputElement).checked
            );

            expect(items.length).toBe(3);
            expect(countSpan?.textContent).toBe('3');
            expect(checkedBoxes.length).toBe(3);
        });

        it('should handle rapid toggles correctly', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            toggleCompareItem('item1');

            const items = getCompareItems();
            expect(items.length).toBe(1);
            expect(items).toContain('item1');
        });

        it('should enforce max limit consistently', () => {
            const { ToastManager } = await import('../../src/modules/toast.ts');

            // Fill to max
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            toggleCompareItem('item4');

            // Try to add more
            toggleCompareItem('extra1');
            toggleCompareItem('extra2');

            expect(getCompareItems().length).toBe(4);
            expect(ToastManager.warning).toHaveBeenCalledTimes(2);
        });

        it('should clear and reset to initial state', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');

            clearCompare();

            expect(getCompareItems()).toEqual([]);

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');

            const countSpan = document.querySelector('.compare-count');
            expect(countSpan?.textContent).toBe('0');
        });
    });

    describe('Edge Cases', () => {
        it('should handle same item ID toggled multiple times', () => {
            for (let i = 0; i < 10; i++) {
                toggleCompareItem('item1');
            }

            const items = getCompareItems();
            expect(items.length).toBe(0); // Even number of toggles
        });

        it('should handle empty string item ID', () => {
            toggleCompareItem('');

            const items = getCompareItems();
            expect(items).toContain('');
        });

        it('should handle null-like values gracefully', () => {
            toggleCompareItem(null as any);
            toggleCompareItem(undefined as any);

            // Should not crash
            expect(true).toBe(true);
        });

        it('should handle very long item IDs', () => {
            const longId = 'a'.repeat(1000);

            toggleCompareItem(longId);

            const items = getCompareItems();
            expect(items).toContain(longId);
        });

        it('should maintain state across multiple updateCompareButton calls', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            updateCompareButton();
            updateCompareButton();
            updateCompareButton();

            expect(getCompareItems()).toEqual(['item1', 'item2']);
        });
    });
});
