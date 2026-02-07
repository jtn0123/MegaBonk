/**
 * @vitest-environment jsdom
 * Compare Mode Pure Function Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    toggleCompareItem,
    __resetCompareState,
} from '../../src/modules/compare.ts';
import { getState, setState, resetStore } from '../../src/modules/store.ts';
import { MAX_COMPARE_ITEMS } from '../../src/modules/constants.ts';

// Mock toast to avoid side effects
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock data-service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                { id: 'item1', name: 'Item 1' },
                { id: 'item2', name: 'Item 2' },
                { id: 'item3', name: 'Item 3' },
                { id: 'item4', name: 'Item 4' },
            ],
        },
    },
}));

describe('Compare Mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
        __resetCompareState();
        
        // Setup DOM elements that compare functions look for
        document.body.innerHTML = `
            <button id="compare-btn" style="display: none;">
                <span class="compare-count">0</span>
            </button>
        `;
    });

    afterEach(() => {
        resetStore();
        __resetCompareState();
        document.body.innerHTML = '';
    });

    // ========================================
    // toggleCompareItem Tests
    // ========================================
    describe('toggleCompareItem', () => {
        it('should add item to compare list', () => {
            toggleCompareItem('item1');
            
            const items = getState('compareItems');
            expect(items).toContain('item1');
        });

        it('should remove item from compare list when already present', () => {
            setState('compareItems', ['item1', 'item2']);
            
            toggleCompareItem('item1');
            
            const items = getState('compareItems');
            expect(items).not.toContain('item1');
            expect(items).toContain('item2');
        });

        it('should add multiple items', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            
            const items = getState('compareItems');
            expect(items).toEqual(['item1', 'item2']);
        });

        it('should toggle same item on and off', () => {
            toggleCompareItem('item1');
            expect(getState('compareItems')).toContain('item1');
            
            toggleCompareItem('item1');
            expect(getState('compareItems')).not.toContain('item1');
            
            toggleCompareItem('item1');
            expect(getState('compareItems')).toContain('item1');
        });

        it('should not exceed MAX_COMPARE_ITEMS limit', async () => {
            const { ToastManager } = await import('../../src/modules/toast.ts');
            
            // Add items up to the limit
            for (let i = 1; i <= MAX_COMPARE_ITEMS; i++) {
                setState('compareItems', [...getState('compareItems'), `item${i}`]);
            }
            
            // Try to add one more
            toggleCompareItem('extra_item');
            
            const items = getState('compareItems');
            expect(items).not.toContain('extra_item');
            expect(items.length).toBe(MAX_COMPARE_ITEMS);
            expect(ToastManager.warning).toHaveBeenCalled();
        });

        it('should allow removing item when at max limit', () => {
            // Fill to max
            const items = [];
            for (let i = 1; i <= MAX_COMPARE_ITEMS; i++) {
                items.push(`item${i}`);
            }
            setState('compareItems', items);
            
            // Remove one
            toggleCompareItem('item1');
            
            expect(getState('compareItems').length).toBe(MAX_COMPARE_ITEMS - 1);
        });

        it('should preserve order when adding items', () => {
            toggleCompareItem('item3');
            toggleCompareItem('item1');
            toggleCompareItem('item2');
            
            const items = getState('compareItems');
            expect(items).toEqual(['item3', 'item1', 'item2']);
        });

        it('should handle empty initial state', () => {
            expect(getState('compareItems')).toEqual([]);
            
            toggleCompareItem('item1');
            
            expect(getState('compareItems')).toEqual(['item1']);
        });
    });

    // ========================================
    // State Integration Tests
    // ========================================
    describe('state integration', () => {
        it('should use centralized store', () => {
            setState('compareItems', ['existing']);
            
            toggleCompareItem('item1');
            
            const items = getState('compareItems');
            expect(items).toContain('existing');
            expect(items).toContain('item1');
        });

        it('should reflect store changes', () => {
            toggleCompareItem('item1');
            
            // Directly modify store
            setState('compareItems', ['item2', 'item3']);
            
            // Toggle should work with new state
            toggleCompareItem('item2');
            
            const items = getState('compareItems');
            expect(items).not.toContain('item2');
            expect(items).toContain('item3');
        });
    });

    // ========================================
    // __resetCompareState Tests
    // ========================================
    describe('__resetCompareState', () => {
        it('should reset internal state', () => {
            // This is mainly for test isolation
            expect(() => __resetCompareState()).not.toThrow();
        });

        it('should be callable multiple times', () => {
            __resetCompareState();
            __resetCompareState();
            __resetCompareState();
            
            // Should not throw
            expect(true).toBe(true);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle undefined compareItems gracefully', () => {
            // Force undefined state
            (setState as any)('compareItems', undefined);
            
            // Should not throw
            expect(() => toggleCompareItem('item1')).not.toThrow();
        });

        it('should handle empty string item id', () => {
            toggleCompareItem('');
            
            const items = getState('compareItems');
            expect(items).toContain('');
        });

        it('should handle special characters in item id', () => {
            toggleCompareItem('item-with-dashes');
            toggleCompareItem('item_with_underscores');
            toggleCompareItem('item.with.dots');
            
            const items = getState('compareItems');
            expect(items).toContain('item-with-dashes');
            expect(items).toContain('item_with_underscores');
            expect(items).toContain('item.with.dots');
        });

        it('should handle rapid toggling', () => {
            for (let i = 0; i < 10; i++) {
                toggleCompareItem('item1');
            }
            
            // Even number of toggles = not in list
            expect(getState('compareItems')).not.toContain('item1');
        });

        it('should handle duplicate toggle calls', () => {
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            toggleCompareItem('item1');
            
            // Odd number = in list
            const items = getState('compareItems');
            expect(items.filter(i => i === 'item1').length).toBe(1);
        });
    });
});
