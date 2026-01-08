import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockAllData } from '../helpers/mock-data.js';

/**
 * Compare module functions for unit testing
 * Mirrors the implementation in src/modules/compare.js
 */

let compareItems = [];
let allData = {};
const MAX_COMPARE_ITEMS = 3;

// Mock ToastManager
const ToastManager = {
  warning: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn()
};

// Mock safeGetElementById
function safeGetElementById(id, fallback = null) {
  return document.getElementById(id) || fallback;
}

// Mock safeQuerySelectorAll
function safeQuerySelectorAll(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Toggle item in comparison list
 */
function toggleCompareItem(itemId) {
  const index = compareItems.indexOf(itemId);
  if (index > -1) {
    compareItems.splice(index, 1);
  } else {
    if (compareItems.length >= MAX_COMPARE_ITEMS) {
      ToastManager.warning('You can only compare up to 3 items at once. Remove an item first.');
      return;
    }
    compareItems.push(itemId);
  }
  updateCompareButton();
}

/**
 * Update compare button visibility and state
 */
function updateCompareButton() {
  const compareBtn = safeGetElementById('compare-btn');
  if (!compareBtn) return;

  const countSpan = compareBtn.querySelector('.compare-count');
  if (countSpan) {
    countSpan.textContent = compareItems.length;
  }

  compareBtn.style.display = compareItems.length >= 2 ? 'block' : 'none';

  // Update checkboxes
  safeQuerySelectorAll('.compare-checkbox').forEach(cb => {
    const id = cb.dataset.id || cb.value;
    cb.checked = compareItems.includes(id);
  });
}

/**
 * Open the comparison modal
 */
function openCompareModal() {
  if (compareItems.length < 2) {
    ToastManager.warning('Select at least 2 items to compare!');
    return false;
  }

  const items = compareItems.map(id =>
    allData.items?.items.find(item => item.id === id)
  ).filter(Boolean);

  const compareBody = safeGetElementById('compareBody');
  const modal = safeGetElementById('compareModal');
  if (!compareBody || !modal) return false;

  // Filter items that have scaling data for the chart
  const chartableItems = items.filter(item =>
    item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat'
  );

  // Build HTML with optional chart section
  let html = '';
  if (chartableItems.length >= 2) {
    html += `
        <div class="compare-chart-section">
            <h3>Scaling Comparison</h3>
            <div class="compare-chart-container">
                <canvas id="compare-scaling-chart" class="scaling-chart"></canvas>
            </div>
        </div>
    `;
  }

  html += '<div class="compare-grid">';

  items.forEach(item => {
    html += `
        <div class="compare-column">
            <div class="compare-header">
                <h3>${item.name}</h3>
                <div class="item-badges">
                    <span class="badge rarity-${item.rarity}">${item.rarity}</span>
                    <span class="badge tier-${item.tier}">${item.tier} Tier</span>
                </div>
            </div>
        </div>
    `;
  });

  html += '</div>';
  compareBody.innerHTML = html;
  modal.style.display = 'block';
  modal.classList.add('active');

  return true;
}

/**
 * Close compare modal with animation
 */
function closeCompareModal() {
  const modal = safeGetElementById('compareModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

/**
 * Update compare display after item removal
 */
function updateCompareDisplay() {
  if (compareItems.length < 2) {
    closeCompareModal();
    return false;
  } else {
    openCompareModal();
    return true;
  }
}

/**
 * Clear all compare selections
 */
function clearCompare() {
  compareItems = [];
  updateCompareButton();
  closeCompareModal();
}

/**
 * Reset state for testing
 */
function resetCompareState() {
  compareItems = [];
  ToastManager.warning.mockClear();
  ToastManager.info.mockClear();
}

// Helper to create DOM with compare elements
function createCompareDOM() {
  createMinimalDOM();

  // Create compare button if it doesn't exist
  if (!document.getElementById('compare-btn')) {
    const btn = document.createElement('button');
    btn.id = 'compare-btn';
    btn.innerHTML = '<span class="compare-count">0</span>';
    btn.style.display = 'none';
    document.body.appendChild(btn);
  }

  // Create compare checkboxes
  const container = document.getElementById('itemsContainer') || document.body;
  for (let i = 1; i <= 5; i++) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'compare-checkbox';
    checkbox.dataset.id = `item_${i}`;
    checkbox.value = `item_${i}`;
    container.appendChild(checkbox);
  }
}

describe('Compare Module', () => {
  beforeEach(() => {
    createCompareDOM();
    resetCompareState();
    allData = createMockAllData();
  });

  describe('toggleCompareItem()', () => {
    it('should add item to empty list', () => {
      toggleCompareItem('item_1');

      expect(compareItems).toContain('item_1');
      expect(compareItems.length).toBe(1);
    });

    it('should remove item when already in list', () => {
      compareItems = ['item_1', 'item_2'];

      toggleCompareItem('item_1');

      expect(compareItems).not.toContain('item_1');
      expect(compareItems).toContain('item_2');
      expect(compareItems.length).toBe(1);
    });

    it('should enforce max 3 items limit', () => {
      compareItems = ['item_1', 'item_2', 'item_3'];

      toggleCompareItem('item_4');

      expect(compareItems.length).toBe(3);
      expect(compareItems).not.toContain('item_4');
    });

    it('should show warning toast when limit exceeded', () => {
      compareItems = ['item_1', 'item_2', 'item_3'];

      toggleCompareItem('item_4');

      expect(ToastManager.warning).toHaveBeenCalledWith(
        'You can only compare up to 3 items at once. Remove an item first.'
      );
    });

    it('should call updateCompareButton after toggle', () => {
      const compareBtn = document.getElementById('compare-btn');

      toggleCompareItem('item_1');
      toggleCompareItem('item_2');

      // Button should be visible after 2 items
      expect(compareBtn.style.display).toBe('block');
    });

    it('should allow adding after removal', () => {
      compareItems = ['item_1', 'item_2', 'item_3'];

      toggleCompareItem('item_2'); // Remove item_2
      toggleCompareItem('item_4'); // Should now allow adding

      expect(compareItems).toContain('item_4');
      expect(compareItems.length).toBe(3);
    });
  });

  describe('updateCompareButton()', () => {
    it('should show button when 2+ items selected', () => {
      compareItems = ['item_1', 'item_2'];

      updateCompareButton();

      const btn = document.getElementById('compare-btn');
      expect(btn.style.display).toBe('block');
    });

    it('should hide button when less than 2 items', () => {
      compareItems = ['item_1'];

      updateCompareButton();

      const btn = document.getElementById('compare-btn');
      expect(btn.style.display).toBe('none');
    });

    it('should hide button when 0 items selected', () => {
      compareItems = [];

      updateCompareButton();

      const btn = document.getElementById('compare-btn');
      expect(btn.style.display).toBe('none');
    });

    it('should update count span text', () => {
      compareItems = ['item_1', 'item_2', 'item_3'];

      updateCompareButton();

      const countSpan = document.querySelector('.compare-count');
      expect(countSpan.textContent).toBe('3');
    });

    it('should sync checkbox checked states', () => {
      compareItems = ['item_1', 'item_3'];

      updateCompareButton();

      const checkboxes = document.querySelectorAll('.compare-checkbox');
      const checkbox1 = Array.from(checkboxes).find(cb => cb.dataset.id === 'item_1');
      const checkbox2 = Array.from(checkboxes).find(cb => cb.dataset.id === 'item_2');
      const checkbox3 = Array.from(checkboxes).find(cb => cb.dataset.id === 'item_3');

      expect(checkbox1.checked).toBe(true);
      expect(checkbox2.checked).toBe(false);
      expect(checkbox3.checked).toBe(true);
    });

    it('should handle missing compare button gracefully', () => {
      document.getElementById('compare-btn')?.remove();

      // Should not throw
      expect(() => updateCompareButton()).not.toThrow();
    });
  });

  describe('openCompareModal()', () => {
    beforeEach(() => {
      // Set up items in allData
      const item1 = createMockItem({ id: 'item_1', name: 'Item One', tier: 'S', rarity: 'epic' });
      const item2 = createMockItem({ id: 'item_2', name: 'Item Two', tier: 'A', rarity: 'rare' });
      const item3 = createMockItem({ id: 'item_3', name: 'Item Three', tier: 'B', rarity: 'common' });
      allData.items = { items: [item1, item2, item3] };
    });

    it('should show warning when less than 2 items', () => {
      compareItems = ['item_1'];

      openCompareModal();

      expect(ToastManager.warning).toHaveBeenCalledWith('Select at least 2 items to compare!');
    });

    it('should return false when less than 2 items', () => {
      compareItems = ['item_1'];

      const result = openCompareModal();

      expect(result).toBe(false);
    });

    it('should render compare columns for each item', () => {
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const columns = document.querySelectorAll('.compare-column');
      expect(columns.length).toBe(2);
    });

    it('should display item name in columns', () => {
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const compareBody = document.getElementById('compareBody');
      expect(compareBody.innerHTML).toContain('Item One');
      expect(compareBody.innerHTML).toContain('Item Two');
    });

    it('should display item badges', () => {
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const compareBody = document.getElementById('compareBody');
      expect(compareBody.innerHTML).toContain('rarity-epic');
      expect(compareBody.innerHTML).toContain('tier-S');
      expect(compareBody.innerHTML).toContain('rarity-rare');
      expect(compareBody.innerHTML).toContain('tier-A');
    });

    it('should add active class for animation', () => {
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const modal = document.getElementById('compareModal');
      expect(modal.classList.contains('active')).toBe(true);
    });

    it('should set modal display to block', () => {
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const modal = document.getElementById('compareModal');
      expect(modal.style.display).toBe('block');
    });

    it('should handle non-existent items gracefully', () => {
      compareItems = ['item_1', 'non_existent_item'];

      openCompareModal();

      // Should only render the existing item
      const columns = document.querySelectorAll('.compare-column');
      expect(columns.length).toBe(1);
    });

    it('should return true on success', () => {
      compareItems = ['item_1', 'item_2'];

      const result = openCompareModal();

      expect(result).toBe(true);
    });

    it('should include chart section for chartable items', () => {
      // Create items with scaling data
      const chartableItem1 = createMockItem({
        id: 'item_1',
        name: 'Chartable One',
        scaling_per_stack: [1, 2, 3],
        one_and_done: false,
        graph_type: 'linear'
      });
      const chartableItem2 = createMockItem({
        id: 'item_2',
        name: 'Chartable Two',
        scaling_per_stack: [2, 4, 6],
        one_and_done: false,
        graph_type: 'linear'
      });
      allData.items = { items: [chartableItem1, chartableItem2] };
      compareItems = ['item_1', 'item_2'];

      openCompareModal();

      const compareBody = document.getElementById('compareBody');
      expect(compareBody.innerHTML).toContain('compare-chart-section');
      expect(compareBody.innerHTML).toContain('Scaling Comparison');
    });
  });

  describe('closeCompareModal()', () => {
    it('should remove active class', () => {
      const modal = document.getElementById('compareModal');
      modal.classList.add('active');
      modal.style.display = 'block';

      closeCompareModal();

      expect(modal.classList.contains('active')).toBe(false);
    });

    it('should set display none', () => {
      const modal = document.getElementById('compareModal');
      modal.style.display = 'block';

      closeCompareModal();

      expect(modal.style.display).toBe('none');
    });

    it('should handle missing modal gracefully', () => {
      document.getElementById('compareModal')?.remove();

      // Should not throw
      expect(() => closeCompareModal()).not.toThrow();
    });
  });

  describe('clearCompare()', () => {
    it('should empty compareItems array', () => {
      compareItems = ['item_1', 'item_2', 'item_3'];

      clearCompare();

      expect(compareItems.length).toBe(0);
    });

    it('should call updateCompareButton', () => {
      compareItems = ['item_1', 'item_2'];
      const btn = document.getElementById('compare-btn');
      btn.style.display = 'block';

      clearCompare();

      expect(btn.style.display).toBe('none');
    });

    it('should close compare modal', () => {
      const modal = document.getElementById('compareModal');
      modal.style.display = 'block';
      modal.classList.add('active');

      clearCompare();

      expect(modal.style.display).toBe('none');
      expect(modal.classList.contains('active')).toBe(false);
    });
  });

  describe('updateCompareDisplay()', () => {
    beforeEach(() => {
      const item1 = createMockItem({ id: 'item_1', name: 'Item One' });
      const item2 = createMockItem({ id: 'item_2', name: 'Item Two' });
      allData.items = { items: [item1, item2] };
    });

    it('should close modal when less than 2 items', () => {
      compareItems = ['item_1'];
      const modal = document.getElementById('compareModal');
      modal.style.display = 'block';

      updateCompareDisplay();

      expect(modal.style.display).toBe('none');
    });

    it('should return false when closing modal', () => {
      compareItems = ['item_1'];

      const result = updateCompareDisplay();

      expect(result).toBe(false);
    });

    it('should refresh modal when 2+ items', () => {
      compareItems = ['item_1', 'item_2'];

      updateCompareDisplay();

      const modal = document.getElementById('compareModal');
      expect(modal.style.display).toBe('block');
    });

    it('should return true when refreshing modal', () => {
      compareItems = ['item_1', 'item_2'];

      const result = updateCompareDisplay();

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate toggle attempts', () => {
      toggleCompareItem('item_1');
      toggleCompareItem('item_1');

      expect(compareItems.length).toBe(0);
    });

    it('should handle rapid toggles', () => {
      for (let i = 0; i < 10; i++) {
        toggleCompareItem('item_1');
      }

      // After 10 toggles, should be empty (even number of toggles)
      expect(compareItems.length).toBe(0);
    });

    it('should handle empty string item id', () => {
      toggleCompareItem('');

      expect(compareItems).toContain('');
      expect(compareItems.length).toBe(1);
    });
  });
});
