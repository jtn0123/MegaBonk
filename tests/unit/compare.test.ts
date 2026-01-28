import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData, setupFetchMocks } from '../helpers/mock-data.js';
import { toggleCompareItem, getCompareItems, clearCompare, updateCompareButton } from '../../src/modules/compare.ts';
import { MAX_COMPARE_ITEMS } from '../../src/modules/constants.ts';

describe('Compare Module', () => {
    let compareBtn;
    let countSpan;

    beforeEach(() => {
        createMinimalDOM();

        // Get the compare button that was created by createMinimalDOM
        compareBtn = document.getElementById('compare-btn');
        countSpan = compareBtn.querySelector('.compare-count');

        // Reset compare state
        clearCompare();
        // Setup mock data for allData
        const mockData = createMockAllData();
        setupFetchMocks(mockData);
    });

    describe('toggleCompareItem()', () => {
        it('should add item to compare list when not present', () => {
            toggleCompareItem('gym_sauce');

            expect(getCompareItems()).toContain('gym_sauce');
        });

        it('should remove item from compare list when present', () => {
            toggleCompareItem('gym_sauce');
            toggleCompareItem('gym_sauce');

            expect(getCompareItems()).not.toContain('gym_sauce');
        });

        it('should handle adding multiple items', () => {
            toggleCompareItem('gym_sauce');
            toggleCompareItem('beefy_ring');
            toggleCompareItem('anvil');

            const items = getCompareItems();
            expect(items).toHaveLength(3);
            expect(items).toContain('gym_sauce');
            expect(items).toContain('beefy_ring');
            expect(items).toContain('anvil');
        });

        it('should not exceed maximum compare items', () => {
            // Add MAX_COMPARE_ITEMS items
            for (let i = 0; i < MAX_COMPARE_ITEMS; i++) {
                toggleCompareItem(`item_${i}`);
            }

            // Try to add one more
            toggleCompareItem('extra_item');

            expect(getCompareItems()).toHaveLength(MAX_COMPARE_ITEMS);
            expect(getCompareItems()).not.toContain('extra_item');
        });

        it('should allow adding after removing from full list', () => {
            // Fill up to max
            for (let i = 0; i < MAX_COMPARE_ITEMS; i++) {
                toggleCompareItem(`item_${i}`);
            }

            // Remove one
            toggleCompareItem('item_0');

            // Should be able to add a new one
            toggleCompareItem('new_item');

            expect(getCompareItems()).toHaveLength(MAX_COMPARE_ITEMS);
            expect(getCompareItems()).toContain('new_item');
        });
    });

    describe('getCompareItems()', () => {
        it('should return empty array when no items selected', () => {
            expect(getCompareItems()).toEqual([]);
        });

        it('should return a copy of the compare items array', () => {
            toggleCompareItem('gym_sauce');

            const items1 = getCompareItems();
            const items2 = getCompareItems();

            // Should be equal but not the same reference
            expect(items1).toEqual(items2);
            expect(items1).not.toBe(items2);
        });

        it('should not allow external mutation of compare items', () => {
            toggleCompareItem('gym_sauce');

            const items = getCompareItems();
            items.push('mutated_item');

            expect(getCompareItems()).not.toContain('mutated_item');
        });
    });

    describe('clearCompare()', () => {
        it('should clear all compare items', () => {
            toggleCompareItem('gym_sauce');
            toggleCompareItem('beefy_ring');

            clearCompare();

            expect(getCompareItems()).toEqual([]);
        });

        it('should handle clearing empty list', () => {
            expect(() => clearCompare()).not.toThrow();
            expect(getCompareItems()).toEqual([]);
        });
    });

    describe('updateCompareButton()', () => {
        it('should hide compare button when fewer than 2 items selected', () => {
            toggleCompareItem('gym_sauce');

            expect(compareBtn.style.display).toBe('none');
        });

        it('should show compare button when 2 or more items selected', () => {
            toggleCompareItem('gym_sauce');
            toggleCompareItem('beefy_ring');

            expect(compareBtn.style.display).toBe('block');
        });

        it('should update count display', () => {
            toggleCompareItem('gym_sauce');
            toggleCompareItem('beefy_ring');
            toggleCompareItem('anvil');

            expect(countSpan.textContent).toBe('3');
        });

        it('should update checkbox states', () => {
            // Create checkboxes
            const checkbox1 = document.createElement('input');
            checkbox1.type = 'checkbox';
            checkbox1.className = 'compare-checkbox';
            checkbox1.dataset.id = 'gym_sauce';
            document.body.appendChild(checkbox1);

            const checkbox2 = document.createElement('input');
            checkbox2.type = 'checkbox';
            checkbox2.className = 'compare-checkbox';
            checkbox2.dataset.id = 'beefy_ring';
            document.body.appendChild(checkbox2);

            toggleCompareItem('gym_sauce');
            updateCompareButton();

            expect(checkbox1.checked).toBe(true);
            expect(checkbox2.checked).toBe(false);
        });

        it('should handle missing compare button gracefully', () => {
            // No compare button in DOM
            expect(() => {
                toggleCompareItem('gym_sauce');
                updateCompareButton();
            }).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle empty string item ID', () => {
            toggleCompareItem('');

            expect(getCompareItems()).toContain('');
        });

        it('should handle special characters in item ID', () => {
            const specialId = 'item-with_special.chars!@#$';
            toggleCompareItem(specialId);

            expect(getCompareItems()).toContain(specialId);
        });

        it('should toggle same item multiple times correctly', () => {
            // Toggle on
            toggleCompareItem('gym_sauce');
            expect(getCompareItems()).toContain('gym_sauce');

            // Toggle off
            toggleCompareItem('gym_sauce');
            expect(getCompareItems()).not.toContain('gym_sauce');

            // Toggle on again
            toggleCompareItem('gym_sauce');
            expect(getCompareItems()).toContain('gym_sauce');
        });
    });
});
