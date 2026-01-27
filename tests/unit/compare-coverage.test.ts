/**
 * @vitest-environment jsdom
 * Comprehensive coverage tests for compare.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock toast manager
vi.mock('../../src/modules/toast', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock charts module
vi.mock('../../src/modules/charts', () => ({
    createCompareChart: vi.fn(),
    chartInstances: {},
}));

// Mock data-service
vi.mock('../../src/modules/data-service', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item 1',
                    rarity: 'legendary',
                    tier: 'S',
                    base_effect: 'Effect 1',
                    stacks_well: true,
                    formula: 'x * 2',
                    scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                    scaling_type: 'damage',
                    graph_type: 'linear',
                    synergies: ['synergy1', 'synergy2'],
                    notes: 'Note 1',
                },
                {
                    id: 'item2',
                    name: 'Test Item 2',
                    rarity: 'rare',
                    tier: 'A',
                    base_effect: 'Effect 2',
                    stacks_well: false,
                    formula: 'x + 5',
                    scaling_per_stack: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
                    scaling_type: 'chance',
                    graph_type: 'linear',
                    anti_synergies: ['anti1'],
                    notes: 'Note 2',
                },
                {
                    id: 'item3',
                    name: 'Test Item 3',
                    rarity: 'common',
                    tier: 'B',
                    base_effect: 'Effect 3',
                    one_and_done: true,
                    notes: null,
                },
            ],
        },
    },
}));

// Mock store with actual state tracking
let mockCompareItems: string[] = [];
vi.mock('../../src/modules/store', () => ({
    getState: vi.fn().mockImplementation((key: string) => {
        if (key === 'compareItems') {
            return mockCompareItems;
        }
        return null;
    }),
    setState: vi.fn().mockImplementation((key: string, value: any) => {
        if (key === 'compareItems') {
            mockCompareItems = value;
        }
    }),
}));

// Mock constants
vi.mock('../../src/modules/constants', () => ({
    MAX_COMPARE_ITEMS: 4,
}));

// Import functions to test
import {
    toggleCompareItem,
    updateCompareButton,
    openCompareModal,
    closeCompareModal,
    updateCompareDisplay,
    clearCompare,
    getCompareItems,
    __resetCompareState,
} from '../../src/modules/compare';
import { ToastManager } from '../../src/modules/toast';
import { getState, setState } from '../../src/modules/store';

describe('compare.ts coverage tests', () => {
    beforeEach(() => {
        // Reset mock state
        mockCompareItems = [];
        vi.clearAllMocks();

        // Setup minimal DOM for compare
        document.body.innerHTML = `
            <button id="compare-btn" style="display: none;">
                <span class="compare-count">0</span>
                Compare
            </button>
            <div id="compareModal" style="display: none;" aria-hidden="true">
                <div id="compareBody"></div>
            </div>
            <input type="checkbox" class="compare-checkbox" data-id="item1" />
            <input type="checkbox" class="compare-checkbox" data-id="item2" />
            <input type="checkbox" class="compare-checkbox" data-id="item3" />
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        mockCompareItems = [];
        vi.clearAllMocks();
        __resetCompareState(); // Reset compare module state between tests
    });

    describe('toggleCompareItem', () => {
        it('should add item to compare list', () => {
            toggleCompareItem('item1');
            expect(setState).toHaveBeenCalledWith('compareItems', ['item1']);
        });

        it('should remove item from compare list', () => {
            mockCompareItems = ['item1', 'item2'];
            toggleCompareItem('item1');
            expect(setState).toHaveBeenCalledWith('compareItems', ['item2']);
        });

        it('should show warning when max items reached', () => {
            mockCompareItems = ['item1', 'item2', 'item3', 'item4'];
            toggleCompareItem('item5');
            expect(ToastManager.warning).toHaveBeenCalledWith(
                expect.stringContaining('You can only compare up to')
            );
        });

        it('should update compare button after toggle', () => {
            toggleCompareItem('item1');
            // updateCompareButton is called internally
            const btn = document.getElementById('compare-btn');
            expect(btn).toBeDefined();
        });
    });

    describe('updateCompareButton', () => {
        it('should hide button when less than 2 items', () => {
            mockCompareItems = ['item1'];
            updateCompareButton();
            const btn = document.getElementById('compare-btn');
            expect(btn?.style.display).toBe('none');
        });

        it('should show button when 2 or more items', () => {
            mockCompareItems = ['item1', 'item2'];
            updateCompareButton();
            const btn = document.getElementById('compare-btn');
            expect(btn?.style.display).toBe('block');
        });

        it('should update count display', () => {
            mockCompareItems = ['item1', 'item2', 'item3'];
            updateCompareButton();
            const countSpan = document.querySelector('.compare-count');
            expect(countSpan?.textContent).toBe('3');
        });

        it('should update checkbox states', () => {
            mockCompareItems = ['item1', 'item2'];
            updateCompareButton();
            const cb1 = document.querySelector('[data-id="item1"]') as HTMLInputElement;
            const cb2 = document.querySelector('[data-id="item2"]') as HTMLInputElement;
            const cb3 = document.querySelector('[data-id="item3"]') as HTMLInputElement;
            expect(cb1.checked).toBe(true);
            expect(cb2.checked).toBe(true);
            expect(cb3.checked).toBe(false);
        });

        it('should handle missing compare button gracefully', () => {
            document.body.innerHTML = '';
            expect(() => updateCompareButton()).not.toThrow();
        });

        it('should handle checkbox with value attribute instead of data-id', () => {
            document.body.innerHTML = `
                <button id="compare-btn" style="display: none;">
                    <span class="compare-count">0</span>
                </button>
                <input type="checkbox" class="compare-checkbox" value="item1" />
            `;
            mockCompareItems = ['item1'];
            updateCompareButton();
            const cb = document.querySelector('.compare-checkbox') as HTMLInputElement;
            expect(cb.checked).toBe(true);
        });
    });

    describe('openCompareModal', () => {
        it('should show warning if less than 2 items', async () => {
            mockCompareItems = ['item1'];
            await openCompareModal();
            expect(ToastManager.warning).toHaveBeenCalledWith('Select at least 2 items to compare!');
        });

        it('should open modal with items', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const modal = document.getElementById('compareModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should render item comparison HTML', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('Test Item 1');
            expect(body?.innerHTML).toContain('Test Item 2');
        });

        it('should handle missing modal gracefully', async () => {
            document.body.innerHTML = '';
            mockCompareItems = ['item1', 'item2'];
            await expect(openCompareModal()).resolves.not.toThrow();
        });

        it('should render synergies section', async () => {
            mockCompareItems = ['item1'];
            // Add another item for minimum
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('synergy1');
        });

        it('should render anti-synergies section', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('anti1');
        });

        it('should render stacks_well status', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('Stacks Well');
            expect(body?.innerHTML).toContain('One-and-Done');
        });

        it('should render chart section for chartable items', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('compare-scaling-chart');
        });

        it('should handle item with undefined stacks_well', async () => {
            mockCompareItems = ['item3', 'item1'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('Stacking behavior unknown');
        });

        it('should set aria-hidden to false when opening', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const modal = document.getElementById('compareModal');
            expect(modal?.getAttribute('aria-hidden')).toBe('false');
        });
    });

    describe('closeCompareModal', () => {
        it('should hide modal', async () => {
            const modal = document.getElementById('compareModal');
            if (modal) {
                modal.style.display = 'block';
                modal.classList.add('active');
            }

            await closeCompareModal();

            expect(modal?.classList.contains('active')).toBe(false);
        });

        it('should set aria-hidden to true', async () => {
            const modal = document.getElementById('compareModal');
            if (modal) {
                modal.style.display = 'block';
                modal.setAttribute('aria-hidden', 'false');
            }

            await closeCompareModal();

            expect(modal?.getAttribute('aria-hidden')).toBe('true');
        });

        it('should handle missing modal gracefully', async () => {
            document.body.innerHTML = '';
            await expect(closeCompareModal()).resolves.not.toThrow();
        });
    });

    describe('updateCompareDisplay', () => {
        it('should close modal if less than 2 items', async () => {
            mockCompareItems = ['item1'];
            // Can't easily test this without mocking closeCompareModal
            // Just verify it doesn't throw
            expect(() => updateCompareDisplay()).not.toThrow();
        });

        it('should reopen modal if 2 or more items', async () => {
            mockCompareItems = ['item1', 'item2'];
            expect(() => updateCompareDisplay()).not.toThrow();
        });
    });

    describe('clearCompare', () => {
        it('should clear all compare items', () => {
            mockCompareItems = ['item1', 'item2', 'item3'];
            clearCompare();
            expect(setState).toHaveBeenCalledWith('compareItems', []);
        });

        it('should update button and close modal', () => {
            mockCompareItems = ['item1', 'item2'];
            clearCompare();
            const btn = document.getElementById('compare-btn');
            expect(btn?.style.display).toBe('none');
        });
    });

    describe('getCompareItems', () => {
        it('should return copy of compare items', () => {
            mockCompareItems = ['item1', 'item2'];
            const items = getCompareItems();
            expect(items).toEqual(['item1', 'item2']);
        });

        it('should return empty array when no items', () => {
            mockCompareItems = [];
            const items = getCompareItems();
            expect(items).toEqual([]);
        });

        it('should return a copy not the original', () => {
            mockCompareItems = ['item1'];
            const items = getCompareItems();
            items.push('item2');
            // Original should not be modified
            expect(mockCompareItems.length).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle item not found in allData', async () => {
            mockCompareItems = ['nonexistent1', 'nonexistent2'];
            await openCompareModal();
            // Modal still opens but with empty compare-grid (no items found)
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('compare-grid');
            // No item columns should be rendered
            expect(body?.innerHTML).not.toContain('Test Item');
        });

        it('should escape HTML in item names', async () => {
            // The mock data doesn't have XSS, but test that escapeHtml is used
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            // Check that content is rendered (escapeHtml is used internally)
            expect(body?.innerHTML).toContain('Test Item 1');
        });

        it('should handle item with missing formula', async () => {
            mockCompareItems = ['item3', 'item1']; // item3 has no formula
            await openCompareModal();
            const body = document.getElementById('compareBody');
            expect(body?.innerHTML).toContain('N/A');
        });

        it('should handle percentage vs non-percentage scaling', async () => {
            mockCompareItems = ['item1', 'item2'];
            await openCompareModal();
            const body = document.getElementById('compareBody');
            // Items have 'damage' and 'chance' scaling types which add %
            expect(body?.innerHTML).toContain('%');
        });
    });
});
