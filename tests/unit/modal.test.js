import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockWeapon, createMockCharacter, createMockAllData } from '../helpers/mock-data.js';

/**
 * Modal management functions for unit testing
 */
let allData = {};
let compareItems = [];
const MAX_COMPARE_ITEMS = 3;

function setupModalDOM() {
  // createMinimalDOM() already includes itemModal and compareModal
  createMinimalDOM();
}

function openDetailModal(type, id) {
  const modal = document.getElementById('itemModal');
  const modalBody = document.getElementById('modalBody');

  if (!modal || !modalBody) return false;

  let data = null;
  switch (type) {
    case 'item':
      data = allData.items?.items?.find(i => i.id === id);
      break;
    case 'weapon':
      data = allData.weapons?.weapons?.find(w => w.id === id);
      break;
    case 'character':
      data = allData.characters?.characters?.find(c => c.id === id);
      break;
    case 'tome':
      data = allData.tomes?.tomes?.find(t => t.id === id);
      break;
  }

  if (!data) return false;

  modalBody.innerHTML = generateModalContent(type, data);
  modal.style.display = 'block';
  return true;
}

function generateModalContent(type, data) {
  let content = `<h2>${data.name}</h2>`;
  content += `<span class="badge">${data.tier || 'N/A'}</span>`;

  if (data.rarity) {
    content += `<span class="badge rarity">${data.rarity}</span>`;
  }

  if (data.description) {
    content += `<p class="description">${data.description}</p>`;
  }

  if (data.base_effect) {
    content += `<div class="effect"><strong>Effect:</strong> ${data.base_effect}</div>`;
  }

  if (type === 'weapon' || type === 'character') {
    content += '<div class="stats">';
    if (data.damage) content += `<div>Damage: ${data.damage}</div>`;
    if (data.hp) content += `<div>HP: ${data.hp}</div>`;
    if (data.crit_chance) content += `<div>Crit Chance: ${data.crit_chance}%</div>`;
    content += '</div>';
  }

  if (data.unlock_requirement) {
    content += `<div class="unlock"><strong>Unlock:</strong> ${data.unlock_requirement}</div>`;
  }

  return content;
}

function closeModal() {
  const itemModal = document.getElementById('itemModal');
  const compareModal = document.getElementById('compareModal');

  if (itemModal) itemModal.style.display = 'none';
  if (compareModal) compareModal.style.display = 'none';
}

function isModalOpen(modalId) {
  const modal = document.getElementById(modalId);
  return modal && modal.style.display === 'block';
}

function toggleCompareItem(itemId) {
  const index = compareItems.indexOf(itemId);

  if (index > -1) {
    // Remove item
    compareItems.splice(index, 1);
    return { action: 'removed', count: compareItems.length };
  }

  if (compareItems.length >= MAX_COMPARE_ITEMS) {
    return { action: 'max_reached', count: compareItems.length };
  }

  // Add item
  compareItems.push(itemId);
  return { action: 'added', count: compareItems.length };
}

function getCompareItems() {
  return [...compareItems];
}

function clearCompare() {
  compareItems = [];
  return compareItems.length;
}

function openCompareModal() {
  if (compareItems.length < 2) {
    return false;
  }

  const modal = document.getElementById('compareModal');
  const compareBody = document.getElementById('compareBody');

  if (!modal || !compareBody) return false;

  const items = compareItems.map(id =>
    allData.items?.items?.find(i => i.id === id)
  ).filter(Boolean);

  if (items.length < 2) return false;

  compareBody.innerHTML = generateCompareContent(items);
  modal.style.display = 'block';
  return true;
}

function generateCompareContent(items) {
  let content = '<div class="compare-grid">';

  items.forEach(item => {
    content += `
      <div class="compare-column">
        <h3>${item.name}</h3>
        <span class="badge">${item.tier || 'N/A'}</span>
        ${item.rarity ? `<span class="badge rarity">${item.rarity}</span>` : ''}
        ${item.base_effect ? `<p>${item.base_effect}</p>` : ''}
      </div>
    `;
  });

  content += '</div>';
  return content;
}

describe('Modal Management', () => {
  beforeEach(() => {
    setupModalDOM();
    allData = createMockAllData();
    // Add test-item-2 for compare modal tests
    allData.items.items.push(createMockItem({ id: 'test-item-2', name: 'Test Item 2' }));
    compareItems = [];
  });

  describe('openDetailModal()', () => {
    it('should open modal for item', () => {
      const result = openDetailModal('item', 'test-item');

      expect(result).toBe(true);
      expect(isModalOpen('itemModal')).toBe(true);
    });

    it('should open modal for weapon', () => {
      const result = openDetailModal('weapon', 'test-weapon');

      expect(result).toBe(true);
      expect(isModalOpen('itemModal')).toBe(true);
    });

    it('should open modal for character', () => {
      const result = openDetailModal('character', 'test-character');

      expect(result).toBe(true);
      expect(isModalOpen('itemModal')).toBe(true);
    });

    it('should open modal for tome', () => {
      const result = openDetailModal('tome', 'test-tome');

      expect(result).toBe(true);
      expect(isModalOpen('itemModal')).toBe(true);
    });

    it('should return false for invalid ID', () => {
      const result = openDetailModal('item', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false for invalid type', () => {
      const result = openDetailModal('invalid', 'test-item');

      expect(result).toBe(false);
    });

    it('should populate modal body with content', () => {
      openDetailModal('item', 'test-item');

      const modalBody = document.getElementById('modalBody');
      expect(modalBody.innerHTML).toContain('Test Item');
    });
  });

  describe('generateModalContent()', () => {
    it('should include item name', () => {
      const item = createMockItem({ name: 'Power Ring' });
      const content = generateModalContent('item', item);

      expect(content).toContain('Power Ring');
    });

    it('should include tier badge', () => {
      const item = createMockItem({ tier: 'SS' });
      const content = generateModalContent('item', item);

      expect(content).toContain('SS');
      expect(content).toContain('badge');
    });

    it('should include rarity when present', () => {
      const item = createMockItem({ rarity: 'legendary' });
      const content = generateModalContent('item', item);

      expect(content).toContain('legendary');
    });

    it('should include description', () => {
      const item = createMockItem({ description: 'A powerful artifact' });
      const content = generateModalContent('item', item);

      expect(content).toContain('A powerful artifact');
    });

    it('should include base effect', () => {
      const item = createMockItem({ base_effect: '+10% damage' });
      const content = generateModalContent('item', item);

      expect(content).toContain('+10% damage');
      expect(content).toContain('Effect:');
    });

    it('should include stats for weapons', () => {
      const weapon = createMockWeapon({ damage: 50, crit_chance: 10 });
      const content = generateModalContent('weapon', weapon);

      expect(content).toContain('Damage: 50');
      expect(content).toContain('Crit Chance: 10%');
    });

    it('should include stats for characters', () => {
      const character = createMockCharacter({ hp: 100, damage: 15 });
      const content = generateModalContent('character', character);

      expect(content).toContain('HP: 100');
      expect(content).toContain('Damage: 15');
    });

    it('should include unlock requirement', () => {
      const item = createMockItem({ unlock_requirement: 'Complete level 10' });
      const content = generateModalContent('item', item);

      expect(content).toContain('Complete level 10');
      expect(content).toContain('Unlock:');
    });
  });

  describe('closeModal()', () => {
    it('should close item modal', () => {
      openDetailModal('item', 'test-item');
      expect(isModalOpen('itemModal')).toBe(true);

      closeModal();
      expect(isModalOpen('itemModal')).toBe(false);
    });

    it('should close compare modal', () => {
      // Setup and open compare modal
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      openCompareModal();
      expect(isModalOpen('compareModal')).toBe(true);

      closeModal();
      expect(isModalOpen('compareModal')).toBe(false);
    });

    it('should close both modals if both open', () => {
      openDetailModal('item', 'test-item');

      closeModal();

      expect(isModalOpen('itemModal')).toBe(false);
      expect(isModalOpen('compareModal')).toBe(false);
    });
  });
});

describe('Compare Functionality', () => {
  beforeEach(() => {
    setupModalDOM();
    allData = createMockAllData();
    // Add additional items for comparison
    allData.items.items.push(
      createMockItem({ id: 'test-item-2', name: 'Test Item 2' }),
      createMockItem({ id: 'test-item-3', name: 'Test Item 3' }),
      createMockItem({ id: 'test-item-4', name: 'Test Item 4' })
    );
    compareItems = [];
  });

  describe('toggleCompareItem()', () => {
    it('should add item to compare list', () => {
      const result = toggleCompareItem('test-item');

      expect(result.action).toBe('added');
      expect(result.count).toBe(1);
      expect(getCompareItems()).toContain('test-item');
    });

    it('should remove item from compare list', () => {
      toggleCompareItem('test-item');
      const result = toggleCompareItem('test-item');

      expect(result.action).toBe('removed');
      expect(result.count).toBe(0);
      expect(getCompareItems()).not.toContain('test-item');
    });

    it('should not exceed max items', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      toggleCompareItem('test-item-3');
      const result = toggleCompareItem('test-item-4');

      expect(result.action).toBe('max_reached');
      expect(result.count).toBe(3);
      expect(getCompareItems()).not.toContain('test-item-4');
    });

    it('should allow adding after removing', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      toggleCompareItem('test-item-3');

      // Remove one
      toggleCompareItem('test-item-2');

      // Should now be able to add another
      const result = toggleCompareItem('test-item-4');
      expect(result.action).toBe('added');
      expect(result.count).toBe(3);
    });
  });

  describe('getCompareItems()', () => {
    it('should return empty array initially', () => {
      expect(getCompareItems()).toEqual([]);
    });

    it('should return copy of compare items', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');

      const items = getCompareItems();
      items.push('fake-item');

      // Original should be unchanged
      expect(getCompareItems()).toEqual(['test-item', 'test-item-2']);
    });
  });

  describe('clearCompare()', () => {
    it('should clear all compare items', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      toggleCompareItem('test-item-3');

      const result = clearCompare();

      expect(result).toBe(0);
      expect(getCompareItems()).toEqual([]);
    });

    it('should return 0 when already empty', () => {
      const result = clearCompare();
      expect(result).toBe(0);
    });
  });

  describe('openCompareModal()', () => {
    it('should not open with less than 2 items', () => {
      toggleCompareItem('test-item');

      const result = openCompareModal();

      expect(result).toBe(false);
      expect(isModalOpen('compareModal')).toBe(false);
    });

    it('should open with 2 items', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');

      const result = openCompareModal();

      expect(result).toBe(true);
      expect(isModalOpen('compareModal')).toBe(true);
    });

    it('should open with 3 items', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      toggleCompareItem('test-item-3');

      const result = openCompareModal();

      expect(result).toBe(true);
    });

    it('should populate compare body', () => {
      toggleCompareItem('test-item');
      toggleCompareItem('test-item-2');
      openCompareModal();

      const compareBody = document.getElementById('compareBody');
      expect(compareBody.innerHTML).toContain('compare-column');
    });
  });

  describe('generateCompareContent()', () => {
    it('should create columns for each item', () => {
      const items = [
        createMockItem({ name: 'Item A' }),
        createMockItem({ name: 'Item B' }),
      ];

      const content = generateCompareContent(items);

      expect(content).toContain('Item A');
      expect(content).toContain('Item B');
      expect((content.match(/compare-column/g) || []).length).toBe(2);
    });

    it('should include tier for each item', () => {
      const items = [
        createMockItem({ name: 'Item A', tier: 'SS' }),
        createMockItem({ name: 'Item B', tier: 'S' }),
      ];

      const content = generateCompareContent(items);

      expect(content).toContain('SS');
      expect(content).toContain('S');
    });

    it('should include rarity when present', () => {
      const items = [
        createMockItem({ name: 'Item A', rarity: 'legendary' }),
        createMockItem({ name: 'Item B', rarity: 'epic' }),
      ];

      const content = generateCompareContent(items);

      expect(content).toContain('legendary');
      expect(content).toContain('epic');
    });

    it('should include base effect', () => {
      const items = [
        createMockItem({ name: 'Item A', base_effect: 'Effect A' }),
        createMockItem({ name: 'Item B', base_effect: 'Effect B' }),
      ];

      const content = generateCompareContent(items);

      expect(content).toContain('Effect A');
      expect(content).toContain('Effect B');
    });
  });
});

describe('Modal Edge Cases', () => {
  beforeEach(() => {
    setupModalDOM();
    allData = createMockAllData();
    compareItems = [];
  });

  it('should handle missing modal elements gracefully', () => {
    document.getElementById('itemModal').remove();

    const result = openDetailModal('item', 'test-item');
    expect(result).toBe(false);
  });

  it('should handle missing modal body gracefully', () => {
    document.getElementById('modalBody').remove();

    const result = openDetailModal('item', 'test-item');
    expect(result).toBe(false);
  });

  it('should handle empty allData', () => {
    allData = {};

    const result = openDetailModal('item', 'test-item');
    expect(result).toBe(false);
  });

  it('should handle reopening modal with different item', () => {
    openDetailModal('item', 'test-item');
    const firstContent = document.getElementById('modalBody').innerHTML;

    // Add another item and reopen
    allData.items.items.push(createMockItem({ id: 'second-item', name: 'Second Item' }));
    openDetailModal('item', 'second-item');
    const secondContent = document.getElementById('modalBody').innerHTML;

    expect(firstContent).not.toEqual(secondContent);
    expect(secondContent).toContain('Second Item');
  });

  it('should handle rapid open/close cycles', () => {
    for (let i = 0; i < 10; i++) {
      openDetailModal('item', 'test-item');
      closeModal();
    }

    expect(isModalOpen('itemModal')).toBe(false);
  });
});
