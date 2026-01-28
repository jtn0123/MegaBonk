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
  // createMinimalDOM() already includes tab buttons and content
  createMinimalDOM();
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

describe('Search Query Preservation', () => {
  let searchQuery = '';

  function setSearchQuery(query) {
    searchQuery = query;
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = query;
    }
  }

  function getSearchQuery() {
    const input = document.getElementById('searchInput');
    return input ? input.value : '';
  }

  beforeEach(() => {
    setupTabDOM();
    searchQuery = '';
    currentTab = 'items';
  });

  it('should preserve search query when switching tabs', () => {
    setSearchQuery('fire');
    switchTab('weapons');

    expect(getSearchQuery()).toBe('fire');
  });

  it('should preserve search query across multiple tab switches', () => {
    setSearchQuery('critical');
    switchTab('weapons');
    switchTab('tomes');
    switchTab('characters');

    expect(getSearchQuery()).toBe('critical');
  });

  it('should allow clearing search query on any tab', () => {
    setSearchQuery('damage');
    switchTab('weapons');
    setSearchQuery('');

    expect(getSearchQuery()).toBe('');
  });

  it('should maintain search input element across tab switches', () => {
    switchTab('weapons');
    expect(document.getElementById('searchInput')).not.toBeNull();

    switchTab('tomes');
    expect(document.getElementById('searchInput')).not.toBeNull();

    switchTab('calculator');
    expect(document.getElementById('searchInput')).not.toBeNull();
  });
});

describe('Filter Dropdown Updates', () => {
  const tabFilters = {
    items: ['tier', 'rarity', 'type'],
    weapons: ['tier', 'type'],
    tomes: ['tier', 'priority'],
    characters: ['difficulty', 'playstyle'],
    shrines: ['effect_type']
  };

  function getApplicableFilters(tabName) {
    return tabFilters[tabName] || [];
  }

  beforeEach(() => {
    setupTabDOM();
    currentTab = 'items';
  });

  it('should have different filters for items tab', () => {
    const filters = getApplicableFilters('items');
    expect(filters).toContain('tier');
    expect(filters).toContain('rarity');
    expect(filters).toContain('type');
  });

  it('should have different filters for weapons tab', () => {
    const filters = getApplicableFilters('weapons');
    expect(filters).toContain('tier');
    expect(filters).toContain('type');
    expect(filters).not.toContain('rarity');
  });

  it('should have different filters for tomes tab', () => {
    const filters = getApplicableFilters('tomes');
    expect(filters).toContain('tier');
    expect(filters).toContain('priority');
  });

  it('should have different filters for characters tab', () => {
    const filters = getApplicableFilters('characters');
    expect(filters).toContain('difficulty');
    expect(filters).toContain('playstyle');
    expect(filters).not.toContain('tier');
  });

  it('should have different filters for shrines tab', () => {
    const filters = getApplicableFilters('shrines');
    expect(filters).toContain('effect_type');
  });

  it('should return empty filters for tabs without data', () => {
    const buildFilters = getApplicableFilters('build-planner');
    const calcFilters = getApplicableFilters('calculator');

    expect(buildFilters).toEqual([]);
    expect(calcFilters).toEqual([]);
  });
});

describe('Chart Cleanup', () => {
  let chartInstances = {};

  function createMockChart(canvasId) {
    const chart = {
      destroy: vi.fn(),
      update: vi.fn()
    };
    chartInstances[canvasId] = chart;
    return chart;
  }

  function destroyChartIfExists(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  function destroyAllCharts() {
    Object.keys(chartInstances).forEach(canvasId => {
      if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
      }
    });
    chartInstances = {};
  }

  function cleanupChartsOnTabSwitch(fromTab, toTab) {
    // Clean up charts when leaving items or tomes tabs
    if (fromTab === 'items' || fromTab === 'tomes') {
      destroyAllCharts();
    }
  }

  beforeEach(() => {
    setupTabDOM();
    chartInstances = {};
    currentTab = 'items';
  });

  it('should destroy charts when leaving items tab', () => {
    const chart1 = createMockChart('item-chart-1');
    const chart2 = createMockChart('item-chart-2');

    cleanupChartsOnTabSwitch('items', 'weapons');

    expect(chart1.destroy).toHaveBeenCalled();
    expect(chart2.destroy).toHaveBeenCalled();
  });

  it('should destroy charts when leaving tomes tab', () => {
    const chart = createMockChart('tome-progression-chart');

    cleanupChartsOnTabSwitch('tomes', 'characters');

    expect(chart.destroy).toHaveBeenCalled();
  });

  it('should not destroy charts when leaving non-chart tabs', () => {
    const chart = createMockChart('some-chart');

    cleanupChartsOnTabSwitch('characters', 'weapons');

    // Charts should remain since we're not leaving items/tomes
    expect(chart.destroy).not.toHaveBeenCalled();
  });

  it('should clear chart instances after cleanup', () => {
    createMockChart('chart-1');
    createMockChart('chart-2');

    destroyAllCharts();

    expect(Object.keys(chartInstances)).toHaveLength(0);
  });

  it('should handle cleanup with no existing charts', () => {
    // Should not throw when no charts exist
    expect(() => cleanupChartsOnTabSwitch('items', 'weapons')).not.toThrow();
  });

  it('should destroy specific chart by canvas ID', () => {
    const chart1 = createMockChart('chart-a');
    const chart2 = createMockChart('chart-b');

    destroyChartIfExists('chart-a');

    expect(chart1.destroy).toHaveBeenCalled();
    expect(chart2.destroy).not.toHaveBeenCalled();
    expect(chartInstances['chart-a']).toBeUndefined();
    expect(chartInstances['chart-b']).toBeDefined();
  });
});
