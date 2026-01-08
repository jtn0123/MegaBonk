import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { setupFetchMocks, createMockAllData } from '../helpers/mock-data.js';

/**
 * Standalone implementations for integration testing
 */
let currentTab = 'items';
let allData = {};

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  currentTab = tabName;
  return currentTab;
}

function getDataForTab(tabName) {
  switch (tabName) {
    case 'items': return allData.items?.items || [];
    case 'weapons': return allData.weapons?.weapons || [];
    case 'tomes': return allData.tomes?.tomes || [];
    case 'characters': return allData.characters?.characters || [];
    case 'shrines': return allData.shrines?.shrines || [];
    default: return [];
  }
}

function setupTabDOM() {
  createMinimalDOM();

  // Add tab buttons
  const tabNav = document.createElement('nav');
  tabNav.className = 'tabs';
  tabNav.innerHTML = `
    <div class="tab-buttons">
      <button class="tab-btn active" data-tab="items">Items</button>
      <button class="tab-btn" data-tab="weapons">Weapons</button>
      <button class="tab-btn" data-tab="tomes">Tomes</button>
      <button class="tab-btn" data-tab="characters">Characters</button>
      <button class="tab-btn" data-tab="shrines">Shrines</button>
      <button class="tab-btn" data-tab="build-planner">Build Planner</button>
      <button class="tab-btn" data-tab="calculator">Calculator</button>
    </div>
  `;
  document.body.appendChild(tabNav);

  // Add tab content containers
  const tabContent = document.createElement('div');
  tabContent.id = 'tab-content';
  tabContent.innerHTML = `
    <div id="items-tab" class="tab-content active">
      <div id="itemsContainer" class="items-grid"></div>
    </div>
    <div id="weapons-tab" class="tab-content">
      <div id="weaponsContainer" class="items-grid"></div>
    </div>
    <div id="tomes-tab" class="tab-content">
      <div id="tomesContainer" class="items-grid"></div>
    </div>
    <div id="characters-tab" class="tab-content">
      <div id="charactersContainer" class="items-grid"></div>
    </div>
    <div id="shrines-tab" class="tab-content">
      <div id="shrinesContainer" class="shrines-grid"></div>
    </div>
    <div id="build-planner-tab" class="tab-content">
      <div id="buildPlannerContainer"></div>
    </div>
    <div id="calculator-tab" class="tab-content">
      <div id="calculatorContainer"></div>
    </div>
  `;
  document.body.appendChild(tabContent);
}

describe('Tab Switching Integration', () => {
  beforeEach(() => {
    setupTabDOM();
    currentTab = 'items';
    allData = createMockAllData();
  });

  describe('switchTab()', () => {
    it('should switch from items to weapons tab', () => {
      expect(currentTab).toBe('items');

      switchTab('weapons');

      expect(currentTab).toBe('weapons');
      expect(document.querySelector('.tab-btn[data-tab="weapons"]').classList.contains('active')).toBe(true);
      expect(document.querySelector('.tab-btn[data-tab="items"]').classList.contains('active')).toBe(false);
      expect(document.getElementById('weapons-tab').classList.contains('active')).toBe(true);
      expect(document.getElementById('items-tab').classList.contains('active')).toBe(false);
    });

    it('should switch through all tabs sequentially', () => {
      const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator'];

      tabs.forEach(tab => {
        switchTab(tab);
        expect(currentTab).toBe(tab);
        expect(document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.contains('active')).toBe(true);
        expect(document.getElementById(`${tab}-tab`).classList.contains('active')).toBe(true);
      });
    });

    it('should only have one active tab button at a time', () => {
      switchTab('tomes');

      const activeButtons = document.querySelectorAll('.tab-btn.active');
      expect(activeButtons.length).toBe(1);
      expect(activeButtons[0].dataset.tab).toBe('tomes');
    });

    it('should only have one active tab content at a time', () => {
      switchTab('characters');

      const activeContents = document.querySelectorAll('.tab-content.active');
      expect(activeContents.length).toBe(1);
      expect(activeContents[0].id).toBe('characters-tab');
    });

    it('should handle switching to same tab', () => {
      switchTab('items');
      switchTab('items');

      expect(currentTab).toBe('items');
      expect(document.querySelectorAll('.tab-btn.active').length).toBe(1);
    });
  });

  describe('getDataForTab()', () => {
    it('should return items data for items tab', () => {
      const data = getDataForTab('items');
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('name');
    });

    it('should return weapons data for weapons tab', () => {
      const data = getDataForTab('weapons');
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should return tomes data for tomes tab', () => {
      const data = getDataForTab('tomes');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return characters data for characters tab', () => {
      const data = getDataForTab('characters');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return shrines data for shrines tab', () => {
      const data = getDataForTab('shrines');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return empty array for unknown tab', () => {
      const data = getDataForTab('unknown');
      expect(data).toEqual([]);
    });

    it('should return empty array for build-planner (no direct data)', () => {
      const data = getDataForTab('build-planner');
      expect(data).toEqual([]);
    });
  });

  describe('Tab and Data Integration', () => {
    it('should get correct data after tab switch', () => {
      switchTab('weapons');
      const data = getDataForTab(currentTab);

      expect(currentTab).toBe('weapons');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should maintain data integrity across tab switches', () => {
      const itemsData = getDataForTab('items');
      switchTab('weapons');
      switchTab('tomes');
      switchTab('items');
      const itemsDataAfter = getDataForTab('items');

      expect(itemsData).toEqual(itemsDataAfter);
    });
  });
});

describe('Tab State Management', () => {
  beforeEach(() => {
    setupTabDOM();
    currentTab = 'items';
  });

  it('should start with items tab active', () => {
    expect(currentTab).toBe('items');
    expect(document.getElementById('items-tab').classList.contains('active')).toBe(true);
  });

  it('should preserve tab state during rapid switching', () => {
    ['weapons', 'tomes', 'characters', 'weapons', 'items', 'calculator'].forEach(tab => {
      switchTab(tab);
    });

    expect(currentTab).toBe('calculator');
    expect(document.querySelectorAll('.tab-btn.active').length).toBe(1);
    expect(document.querySelectorAll('.tab-content.active').length).toBe(1);
  });
});
