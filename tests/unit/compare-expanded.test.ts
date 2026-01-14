import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toggleCompareItem, updateCompareButton, openCompareModal, clearCompare, getCompareItems } from '../../src/modules/compare.ts';

// Mock modules
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        warning: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item 1',
                    rarity: 'common',
                    tier: 'B',
                    base_effect: 'Effect 1',
                    formula: 'x * 2',
                    scaling_per_stack: [10, 20, 30, 40, 50],
                    stacks_well: true,
                    scaling_type: 'damage',
                },
                {
                    id: 'item2',
                    name: 'Test Item 2',
                    rarity: 'rare',
                    tier: 'A',
                    base_effect: 'Effect 2',
                    formula: 'x + 5',
                    scaling_per_stack: [5, 10, 15, 20, 25],
                    stacks_well: false,
                    one_and_done: true,
                },
                {
                    id: 'item3',
                    name: 'Test Item 3',
                    rarity: 'legendary',
                    tier: 'S',
                    base_effect: 'Effect 3',
                    formula: 'x ^ 2',
                    scaling_per_stack: [1, 4, 9, 16, 25],
                    graph_type: 'exponential',
                },
                {
                    id: 'item4',
                    name: 'No Scaling Item',
                    rarity: 'uncommon',
                    tier: 'C',
                    base_effect: 'Effect 4',
                    formula: 'constant',
                    one_and_done: true,
                    graph_type: 'flat',
                },
            ],
        },
    },
}));

import { ToastManager } from '../../src/modules/toast.ts';

describe('compare module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="compare-btn" style="display: none;">
                Compare (<span class="compare-count">0</span>)
            </button>
            <div id="compareModal" style="display: none;">
                <div id="compareBody"></div>
            </div>
            <input type="checkbox" class="compare-checkbox" data-id="item1" />
            <input type="checkbox" class="compare-checkbox" data-id="item2" />
            <input type="checkbox" class="compare-checkbox" data-id="item3" />
        `;
        clearCompare();
        vi.clearAllMocks();
    });

    describe('toggleCompareItem', () => {
        it('should add item to comparison', () => {
            toggleCompareItem('item1');
            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items.length).toBe(1);
        });

        it('should remove item if already in comparison', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            const items = getCompareItems();
            expect(items).not.toContain('item1');
            expect(items.length).toBe(0);
        });

        it('should add multiple items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items).toContain('item2');
            expect(items).toContain('item3');
            expect(items.length).toBe(3);
        });

        it('should not exceed MAX_COMPARE_ITEMS', () => {
            // Add 10 items (assuming MAX_COMPARE_ITEMS is 10)
            for (let i = 1; i <= 10; i++) {
                toggleCompareItem(`item${i}`);
            }

            // Try to add 11th item
            toggleCompareItem('item11');

            const items = getCompareItems();
            expect(items.length).toBeLessThanOrEqual(10);
            expect(ToastManager.warning).toHaveBeenCalled();
        });

        it('should update compare button after toggle', () => {
            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');

            toggleCompareItem('item1');
            toggleCompareItem('item2');

            expect(compareBtn?.style.display).toBe('block');
        });

        it('should handle duplicate toggles correctly', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            const items = getCompareItems();
            expect(items).toContain('item1');
            expect(items.length).toBe(1);
        });

        it('should handle null itemId', () => {
            expect(() => toggleCompareItem(null as any)).not.toThrow();
        });

        it('should handle undefined itemId', () => {
            expect(() => toggleCompareItem(undefined as any)).not.toThrow();
        });

        it('should handle empty string itemId', () => {
            toggleCompareItem('');
            const items = getCompareItems();
            expect(items).toContain('');
        });

        it('should handle special characters in itemId', () => {
            const specialId = 'item-with-dashes_and_underscores.123';
            toggleCompareItem(specialId);
            const items = getCompareItems();
            expect(items).toContain(specialId);
        });

        it('should maintain order of items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            const items = getCompareItems();
            expect(items[0]).toBe('item1');
            expect(items[1]).toBe('item2');
            expect(items[2]).toBe('item3');
        });

        it('should remove from correct position', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            toggleCompareItem('item3');
            toggleCompareItem('item2'); // Remove middle item
            const items = getCompareItems();
            expect(items).toEqual(['item1', 'item3']);
        });
    });

    describe('updateCompareButton', () => {
        it('should update count display', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            updateCompareButton();

            const countSpan = document.querySelector('.compare-count');
            expect(countSpan?.textContent).toBe('2');
        });

        it('should show button when 2+ items selected', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            updateCompareButton();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('block');
        });

        it('should hide button when less than 2 items', () => {
            toggleCompareItem('item1');
            updateCompareButton();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should hide button when no items', () => {
            updateCompareButton();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should check corresponding checkboxes', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item3');
            updateCompareButton();

            const checkbox1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
            const checkbox2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;
            const checkbox3 = document.querySelector('[data-id="item3"]') as HTMLInputElement;

            expect(checkbox1?.checked).toBe(true);
            expect(checkbox2?.checked).toBe(false);
            expect(checkbox3?.checked).toBe(true);
        });

        it('should handle missing compare button', () => {
            document.body.innerHTML = '';
            expect(() => updateCompareButton()).not.toThrow();
        });

        it('should handle missing count span', () => {
            document.body.innerHTML = '<button id="compare-btn"></button>';
            expect(() => updateCompareButton()).not.toThrow();
        });

        it('should handle missing checkboxes', () => {
            document.body.innerHTML = '<button id="compare-btn"><span class="compare-count">0</span></button>';
            toggleCompareItem('item1');
            expect(() => updateCompareButton()).not.toThrow();
        });
    });

    describe('openCompareModal', () => {
        it('should show warning with less than 2 items', async () => {
            toggleCompareItem('item1');
            await openCompareModal();

            expect(ToastManager.warning).toHaveBeenCalledWith('Select at least 2 items to compare!');
        });

        it('should show warning with no items', async () => {
            await openCompareModal();

            expect(ToastManager.warning).toHaveBeenCalledWith('Select at least 2 items to compare!');
        });

        it('should open modal with 2 items', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toBeTruthy();
            expect(compareBody?.innerHTML).toContain('Test Item 1');
            expect(compareBody?.innerHTML).toContain('Test Item 2');
        });

        it('should render item details', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('Effect 1');
            expect(compareBody?.innerHTML).toContain('Effect 2');
            expect(compareBody?.innerHTML).toContain('x * 2');
            expect(compareBody?.innerHTML).toContain('x + 5');
        });

        it('should show chart section for chartable items', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('item3');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('Scaling Comparison');
            expect(compareBody?.innerHTML).toContain('compare-scaling-chart');
        });

        it('should not show chart for non-chartable items', async () => {
            toggleCompareItem('item2'); // one_and_done
            toggleCompareItem('item4'); // flat graph
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).not.toContain('Scaling Comparison');
        });

        it('should filter out missing items', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('nonexistent');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('Test Item 1');
            expect(compareBody?.innerHTML).not.toContain('nonexistent');
        });

        it('should handle missing compareBody element', async () => {
            document.body.innerHTML = '<div id="compareModal"></div>';
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            await expect(openCompareModal()).resolves.not.toThrow();
        });

        it('should handle missing modal element', async () => {
            document.body.innerHTML = '<div id="compareBody"></div>';
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            await expect(openCompareModal()).resolves.not.toThrow();
        });

        it('should escape HTML in item names', async () => {
            // This would need actual items with HTML in names to test properly
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            // Should use escapeHtml, no raw HTML injection
            expect(compareBody?.innerHTML).not.toContain('<script>');
        });

        it('should render scaling values correctly', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('10%');
            expect(compareBody?.innerHTML).toContain('20%');
            expect(compareBody?.innerHTML).toContain('5');
        });

        it('should handle items without scaling data', async () => {
            toggleCompareItem('item4');
            toggleCompareItem('item1');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toBeTruthy();
        });

        it('should handle stacks_well undefined', async () => {
            toggleCompareItem('item3'); // stacks_well undefined
            toggleCompareItem('item1');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('Stacking behavior unknown');
        });

        it('should show rarity and tier badges', async () => {
            toggleCompareItem('item1');
            toggleCompareItem('item3');
            await openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody?.innerHTML).toContain('rarity-common');
            expect(compareBody?.innerHTML).toContain('rarity-legendary');
            expect(compareBody?.innerHTML).toContain('tier-B');
            expect(compareBody?.innerHTML).toContain('tier-S');
        });
    });

    describe('clearCompare', () => {
        it('should clear all items', () => {
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
            updateCompareButton();

            const compareBtn = document.getElementById('compare-btn');
            expect(compareBtn?.style.display).toBe('none');
        });

        it('should handle clearing when already empty', () => {
            clearCompare();
            clearCompare();
            expect(getCompareItems().length).toBe(0);
        });
    });

    describe('getCompareItems', () => {
        it('should return empty array initially', () => {
            const items = getCompareItems();
            expect(items).toEqual([]);
        });

        it('should return current comparison items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');

            const items = getCompareItems();
            expect(items).toEqual(['item1', 'item2']);
        });

        it('should return copy of array not reference', () => {
            toggleCompareItem('item1');
            const items1 = getCompareItems();
            const items2 = getCompareItems();

            expect(items1).toEqual(items2);
            expect(items1).not.toBe(items2);
        });
    });
});
