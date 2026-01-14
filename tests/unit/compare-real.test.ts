/**
 * Real Integration Tests for Compare Module
 * No mocking - tests actual compare mode implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    toggleCompareItem,
    updateCompareButton,
    clearCompare,
    getCompareItems,
    closeCompareModal,
} from '../../src/modules/compare.ts';

// ========================================
// DOM Setup Helper
// ========================================

const createCompareDOM = () => {
    document.body.innerHTML = `
        <button id="compare-btn" style="display: none;">
            Compare (<span class="compare-count">0</span>)
        </button>
        <div class="compare-checkbox-container">
            <input type="checkbox" class="compare-checkbox" data-id="item1" value="item1">
            <input type="checkbox" class="compare-checkbox" data-id="item2" value="item2">
            <input type="checkbox" class="compare-checkbox" data-id="item3" value="item3">
            <input type="checkbox" class="compare-checkbox" data-id="item4" value="item4">
            <input type="checkbox" class="compare-checkbox" data-id="item5" value="item5">
        </div>
        <div id="compareModal" class="modal" style="display: none;">
            <div id="compareBody"></div>
        </div>
    `;
};

// ========================================
// toggleCompareItem Tests
// ========================================

describe('toggleCompareItem - Real Integration Tests', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should add item to compare list', () => {
        toggleCompareItem('item1');

        const items = getCompareItems();
        expect(items).toContain('item1');
    });

    it('should remove item from compare list on second toggle', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item1');

        const items = getCompareItems();
        expect(items).not.toContain('item1');
    });

    it('should add multiple items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');

        const items = getCompareItems();
        expect(items).toHaveLength(3);
    });

    it('should not add more than MAX_COMPARE_ITEMS', () => {
        // Add max items (4 from constants)
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');
        toggleCompareItem('item4');

        const beforeCount = getCompareItems().length;

        // Try to add 5th item
        toggleCompareItem('item5');

        const afterCount = getCompareItems().length;
        expect(afterCount).toBe(beforeCount);
    });

    it('should update checkboxes when toggling', () => {
        const checkbox = document.querySelector('[data-id="item1"]') as HTMLInputElement;

        toggleCompareItem('item1');

        expect(checkbox.checked).toBe(true);
    });

    it('should uncheck checkbox when removing', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item1');

        const checkbox = document.querySelector('[data-id="item1"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
    });
});

// ========================================
// updateCompareButton Tests
// ========================================

describe('updateCompareButton - Real Integration Tests', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should hide button when less than 2 items', () => {
        toggleCompareItem('item1');
        updateCompareButton();

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('none');
    });

    it('should show button when 2 or more items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('block');
    });

    it('should update count span', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');

        const countSpan = document.querySelector('.compare-count');
        expect(countSpan?.textContent).toBe('3');
    });

    it('should update checkboxes to match state', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        const cb1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
        const cb2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;
        const cb3 = document.querySelector('[data-id="item3"]') as HTMLInputElement;

        expect(cb1.checked).toBe(true);
        expect(cb2.checked).toBe(true);
        expect(cb3.checked).toBe(false);
    });

    it('should not throw when button missing', () => {
        document.body.innerHTML = '';

        expect(() => updateCompareButton()).not.toThrow();
    });

    it('should not throw when count span missing', () => {
        document.body.innerHTML = '<button id="compare-btn"></button>';

        expect(() => updateCompareButton()).not.toThrow();
    });
});

// ========================================
// clearCompare Tests
// ========================================

describe('clearCompare - Real Integration Tests', () => {
    beforeEach(() => {
        createCompareDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should clear all compare items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');

        clearCompare();

        expect(getCompareItems()).toHaveLength(0);
    });

    it('should hide compare button', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        clearCompare();

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('none');
    });

    it('should update count to 0', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        clearCompare();

        const countSpan = document.querySelector('.compare-count');
        expect(countSpan?.textContent).toBe('0');
    });

    it('should uncheck all checkboxes', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        clearCompare();

        const checkboxes = document.querySelectorAll('.compare-checkbox');
        checkboxes.forEach(cb => {
            expect((cb as HTMLInputElement).checked).toBe(false);
        });
    });

    it('should not throw when called multiple times', () => {
        clearCompare();
        clearCompare();
        clearCompare();

        expect(getCompareItems()).toHaveLength(0);
    });
});

// ========================================
// getCompareItems Tests
// ========================================

describe('getCompareItems - Real Integration Tests', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return empty array when no items', () => {
        const items = getCompareItems();
        expect(items).toEqual([]);
    });

    it('should return all added items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        const items = getCompareItems();
        expect(items).toEqual(['item1', 'item2']);
    });

    it('should return a copy, not the original', () => {
        toggleCompareItem('item1');

        const items1 = getCompareItems();
        const items2 = getCompareItems();

        expect(items1).not.toBe(items2);
    });

    it('should maintain insertion order', () => {
        toggleCompareItem('item3');
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        const items = getCompareItems();
        expect(items[0]).toBe('item3');
        expect(items[1]).toBe('item1');
        expect(items[2]).toBe('item2');
    });
});

// ========================================
// closeCompareModal Tests
// ========================================

describe('closeCompareModal - Real Integration Tests', () => {
    beforeEach(() => {
        createCompareDOM();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should remove active class', async () => {
        const modal = document.getElementById('compareModal');
        modal!.classList.add('active');

        await closeCompareModal();

        expect(modal?.classList.contains('active')).toBe(false);
    });

    it('should set aria-hidden to true', async () => {
        const modal = document.getElementById('compareModal');
        modal!.setAttribute('aria-hidden', 'false');

        await closeCompareModal();

        expect(modal?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should hide modal after delay', async () => {
        const modal = document.getElementById('compareModal');
        modal!.style.display = 'block';

        await closeCompareModal();
        vi.advanceTimersByTime(300);

        expect(modal?.style.display).toBe('none');
    });

    it('should not throw when modal missing', async () => {
        document.body.innerHTML = '';

        await expect(closeCompareModal()).resolves.not.toThrow();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Compare Edge Cases', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle toggling same item multiple times', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item1');
        toggleCompareItem('item1');
        toggleCompareItem('item1');

        const items = getCompareItems();
        // Even toggles = removed, odd toggles = present
        expect(items).toEqual([]);
    });

    it('should handle empty string item ID', () => {
        toggleCompareItem('');

        const items = getCompareItems();
        expect(items).toContain('');
    });

    it('should handle special characters in item ID', () => {
        const specialId = 'item-with-special!@#$%';
        toggleCompareItem(specialId);

        expect(getCompareItems()).toContain(specialId);
    });

    it('should handle checkbox without data-id using value', () => {
        document.body.innerHTML = `
            <button id="compare-btn" style="display: none;">
                Compare (<span class="compare-count">0</span>)
            </button>
            <input type="checkbox" class="compare-checkbox" value="value-item">
        `;

        toggleCompareItem('value-item');

        const checkbox = document.querySelector('.compare-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should work without any DOM', () => {
        document.body.innerHTML = '';

        expect(() => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            updateCompareButton();
        }).not.toThrow();

        expect(getCompareItems()).toHaveLength(2);
    });
});

// ========================================
// Compare Button State Tests
// ========================================

describe('Compare Button States', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show button at exactly 2 items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('block');
    });

    it('should hide button when going from 2 to 1', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item2'); // Remove item2

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('none');
    });

    it('should show button with 3+ items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('block');
    });

    it('should show button with max items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');
        toggleCompareItem('item3');
        toggleCompareItem('item4');

        const btn = document.getElementById('compare-btn');
        expect(btn?.style.display).toBe('block');
    });
});

// ========================================
// Checkbox Synchronization Tests
// ========================================

describe('Checkbox Synchronization', () => {
    beforeEach(() => {
        createCompareDOM();
        clearCompare();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should check only selected items', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item3');

        const cb1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
        const cb2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;
        const cb3 = document.querySelector('[data-id="item3"]') as HTMLInputElement;

        expect(cb1.checked).toBe(true);
        expect(cb2.checked).toBe(false);
        expect(cb3.checked).toBe(true);
    });

    it('should update checkboxes after clear', () => {
        toggleCompareItem('item1');
        toggleCompareItem('item2');

        clearCompare();

        const cb1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
        const cb2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;

        expect(cb1.checked).toBe(false);
        expect(cb2.checked).toBe(false);
    });
});
