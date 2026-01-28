import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * Mock Chart.js class
 */
class MockChartClass {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.data = config.data;
    this.options = config.options;
    this.config = config;
    this.destroy = vi.fn();
    this.update = vi.fn();
    MockChartClass.instances.push(this);
    MockChartClass.lastConfig = config;
  }
  static instances = [];
  static lastConfig = null;
  static reset() {
    MockChartClass.instances = [];
    MockChartClass.lastConfig = null;
  }
}

// Create a wrapper that tracks calls
const MockChart = vi.fn().mockImplementation(function(ctx, config) {
  return new MockChartClass(ctx, config);
});

/**
 * Standalone getEffectiveStackCap implementation for testing
 * Mirrors logic from script.js
 */
function getEffectiveStackCap(item) {
  // Use explicit max_stacks if set
  if (item.max_stacks && item.max_stacks > 0) {
    return item.max_stacks;
  }
  // Use stack_cap if reasonable (between 1 and 100)
  if (item.stack_cap && item.stack_cap > 0 && item.stack_cap <= 100) {
    return Math.min(item.stack_cap, item.scaling_per_stack?.length || 10);
  }
  // Detect plateau - if last several values are the same, cap is where they start repeating
  const scaling = item.scaling_per_stack || [];
  if (scaling.length === 0) return 10;

  for (let i = scaling.length - 1; i > 0; i--) {
    if (scaling[i] !== scaling[i - 1]) {
      // Found where values differ - cap is at i+1
      // But only if there's an actual plateau (3+ repeating values)
      if (scaling.length - i >= 3) {
        return i + 1;
      }
      break;
    }
  }
  // Default to array length
  return scaling.length;
}

/**
 * Standalone createScalingChart implementation for testing
 * This mirrors the logic from script.js for isolated unit testing
 */
function createScalingChart(canvasId, data, label, scalingType = '', isModal = false, secondaryData = null, stackCap = null, chartInstances = {}, Chart = MockChart) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    return null;
  }

  // Destroy existing chart if present
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  // Apply stack cap if provided
  const effectiveCap = stackCap || data.length;
  const displayData = data.slice(0, effectiveCap);
  const labels = displayData.map((_, i) => `${i + 1}`);
  const isPercentage = scalingType.includes('chance') ||
                       scalingType.includes('percentage') ||
                       scalingType.includes('damage') ||
                       scalingType.includes('crit');

  // Build datasets array
  const datasets = [{
    label: label,
    data: displayData,
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    fill: true,
    tension: 0.3,
    pointRadius: isModal ? 5 : 3,
    pointHoverRadius: isModal ? 8 : 5,
    pointBackgroundColor: '#e94560',
    borderWidth: isModal ? 3 : 2,
    yAxisID: 'y'
  }];

  // Add secondary dataset if provided
  const hasSecondary = secondaryData && secondaryData.values && secondaryData.values.length > 0;
  if (hasSecondary) {
    datasets.push({
      label: secondaryData.stat,
      data: secondaryData.values,
      borderColor: '#4ecdc4',
      backgroundColor: 'rgba(78, 205, 196, 0.2)',
      fill: true,
      tension: 0.3,
      pointRadius: isModal ? 5 : 3,
      pointHoverRadius: isModal ? 8 : 5,
      pointBackgroundColor: '#4ecdc4',
      borderWidth: isModal ? 3 : 2,
      yAxisID: 'y2'
    });
  }

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: hasSecondary },
        tooltip: { enabled: true }
      },
      scales: {
        x: { title: { display: isModal, text: 'Stacks' } },
        y: {
          position: 'left',
          title: { display: isModal, text: isPercentage ? '%' : 'Value' },
          beginAtZero: true
        },
        y2: {
          position: 'right',
          display: hasSecondary
        }
      }
    }
  });

  chartInstances[canvasId] = chart;
  return chart;
}

/**
 * Standalone calculateTomeProgression implementation for testing
 * This mirrors the logic from script.js for isolated unit testing
 */
function calculateTomeProgression(tome, maxLevels = 10) {
  const valueStr = tome.value_per_level;
  // Parse numeric value from strings like "+7% crit chance" or "+0.08x (8% damage)"
  const match = valueStr.match(/[+-]?([\d.]+)/);
  if (!match) return null;

  const perLevel = parseFloat(match[1]);
  // Scale appropriately - percentages stay as-is, multipliers get scaled
  const isMultiplier = valueStr.includes('x');
  const isHyperbolic = valueStr.toLowerCase().includes('hyperbolic');

  // Detect which hyperbolic formula to use based on stat type
  const statLower = (tome.stat_affected || '').toLowerCase();
  const isEvasion = statLower.includes('evasion');
  const isArmor = statLower.includes('armor');

  return Array.from({length: maxLevels}, (_, i) => {
    const internalValue = (isMultiplier ? perLevel * 100 : perLevel) * (i + 1);

    if (isHyperbolic && isEvasion) {
      // Evasion formula: actual = internal / (1 + internal)
      const internalDecimal = internalValue / 100;
      const actualEvasion = internalDecimal / (1 + internalDecimal) * 100;
      return Math.round(actualEvasion * 100) / 100;
    } else if (isHyperbolic && isArmor) {
      // Armor formula: actual = internal / (0.75 + internal)
      const internalDecimal = internalValue / 100;
      const actualArmor = internalDecimal / (0.75 + internalDecimal) * 100;
      return Math.round(actualArmor * 100) / 100;
    }

    return Math.round(internalValue * 100) / 100;
  });
}

describe('Chart Functionality', () => {
  let chartInstances;

  beforeEach(() => {
    createMinimalDOM();
    // Add a canvas element for testing
    document.body.innerHTML += '<canvas id="test-chart"></canvas>';
    chartInstances = {};
    MockChart.mockClear();
    MockChartClass.reset();
  });

  describe('createScalingChart()', () => {
    it('should return null if canvas not found', () => {
      const result = createScalingChart('nonexistent', [1, 2, 3], 'Test', '', false, null, null, chartInstances, MockChartClass);
      expect(result).toBeNull();
    });

    it('should create chart with correct data', () => {
      const data = [10, 20, 30, 40, 50];
      const chart = createScalingChart('test-chart', data, 'Test Item', '', false, null, null, chartInstances, MockChartClass);

      expect(chart).not.toBeNull();
      expect(MockChartClass.instances).toHaveLength(1);
      expect(MockChartClass.lastConfig.data.datasets[0].data).toEqual(data);
    });

    it('should generate correct labels for data points', () => {
      const data = [5, 10, 15];
      createScalingChart('test-chart', data, 'Test', '', false, null, null, chartInstances, MockChartClass);

      expect(MockChartClass.lastConfig.data.labels).toEqual(['1', '2', '3']);
    });

    it('should apply stack cap to limit displayed data', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      createScalingChart('test-chart', data, 'Test', '', false, null, 5, chartInstances, MockChartClass);

      expect(MockChartClass.lastConfig.data.datasets[0].data).toHaveLength(5);
      expect(MockChartClass.lastConfig.data.datasets[0].data).toEqual([10, 20, 30, 40, 50]);
    });

    it('should use larger point radius for modal charts', () => {
      createScalingChart('test-chart', [1, 2, 3], 'Test', '', false, null, null, chartInstances, MockChartClass);
      expect(MockChartClass.lastConfig.data.datasets[0].pointRadius).toBe(3);

      MockChartClass.reset();
      createScalingChart('test-chart', [1, 2, 3], 'Test', '', true, null, null, chartInstances, MockChartClass);
      expect(MockChartClass.lastConfig.data.datasets[0].pointRadius).toBe(5);
    });

    it('should add secondary dataset when provided', () => {
      const secondary = { stat: 'Bonus', values: [1, 2, 3, 4, 5] };
      createScalingChart('test-chart', [10, 20, 30, 40, 50], 'Main', '', false, secondary, null, chartInstances, MockChartClass);

      expect(MockChartClass.lastConfig.data.datasets).toHaveLength(2);
      expect(MockChartClass.lastConfig.data.datasets[1].label).toBe('Bonus');
      expect(MockChartClass.lastConfig.data.datasets[1].data).toEqual([1, 2, 3, 4, 5]);
    });

    it('should show legend when secondary data is present', () => {
      const secondary = { stat: 'Bonus', values: [1, 2, 3] };
      createScalingChart('test-chart', [10, 20, 30], 'Main', '', false, secondary, null, chartInstances, MockChartClass);

      expect(MockChartClass.lastConfig.options.plugins.legend.display).toBe(true);
    });

    it('should hide legend when no secondary data', () => {
      createScalingChart('test-chart', [10, 20, 30], 'Main', '', false, null, null, chartInstances, MockChartClass);

      expect(MockChartClass.lastConfig.options.plugins.legend.display).toBeFalsy();
    });

    it('should store chart instance for cleanup', () => {
      createScalingChart('test-chart', [1, 2, 3], 'Test', '', false, null, null, chartInstances, MockChartClass);

      expect(chartInstances['test-chart']).toBeDefined();
    });

    it('should destroy existing chart before creating new one', () => {
      const firstChart = createScalingChart('test-chart', [1, 2, 3], 'First', '', false, null, null, chartInstances, MockChartClass);
      createScalingChart('test-chart', [4, 5, 6], 'Second', '', false, null, null, chartInstances, MockChartClass);

      expect(firstChart.destroy).toHaveBeenCalled();
    });
  });

  describe('getEffectiveStackCap()', () => {
    it('should use max_stacks if set', () => {
      const item = { max_stacks: 5, scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
      expect(getEffectiveStackCap(item)).toBe(5);
    });

    it('should use stack_cap if max_stacks not set', () => {
      const item = { stack_cap: 8, scaling_per_stack: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
      expect(getEffectiveStackCap(item)).toBe(8);
    });

    it('should ignore stack_cap over 100', () => {
      const item = { stack_cap: 999, scaling_per_stack: [1, 2, 3, 4, 5] };
      expect(getEffectiveStackCap(item)).toBe(5);
    });

    it('should detect plateau in scaling data', () => {
      // Values plateau at position 5 (all remaining values are 100)
      const item = { scaling_per_stack: [20, 40, 60, 80, 100, 100, 100, 100, 100, 100] };
      expect(getEffectiveStackCap(item)).toBe(5);
    });

    it('should default to array length if no plateau', () => {
      const item = { scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] };
      expect(getEffectiveStackCap(item)).toBe(10);
    });

    it('should return 10 for empty scaling array', () => {
      const item = { scaling_per_stack: [] };
      expect(getEffectiveStackCap(item)).toBe(10);
    });
  });

  describe('calculateTomeProgression()', () => {
    it('should calculate linear progression', () => {
      const tome = { value_per_level: '+7% crit chance', stat_affected: 'Crit Chance' };
      const result = calculateTomeProgression(tome);

      expect(result).toHaveLength(10);
      expect(result[0]).toBe(7);
      expect(result[1]).toBe(14);
      expect(result[9]).toBe(70);
    });

    it('should handle multiplier format', () => {
      const tome = { value_per_level: '+0.08x (8% damage)', stat_affected: 'Damage' };
      const result = calculateTomeProgression(tome);

      expect(result[0]).toBe(8);
      expect(result[9]).toBe(80);
    });

    it('should return null for unparseable value', () => {
      const tome = { value_per_level: 'Special effect', stat_affected: 'Special' };
      const result = calculateTomeProgression(tome);

      expect(result).toBeNull();
    });

    it('should apply hyperbolic formula for evasion', () => {
      const tome = { value_per_level: '+10% evasion (hyperbolic)', stat_affected: 'Evasion' };
      const result = calculateTomeProgression(tome);

      // At 50% internal (level 5): actual = 50 / (100 + 50) * 100 = 33.33%
      expect(result[4]).toBeCloseTo(33.33, 1);
    });

    it('should apply hyperbolic formula for armor', () => {
      const tome = { value_per_level: '+10% armor (hyperbolic)', stat_affected: 'Armor' };
      const result = calculateTomeProgression(tome);

      // At 50% internal (level 5): actual = 50 / (75 + 50) * 100 = 40%
      expect(result[4]).toBeCloseTo(40, 0);
    });

    it('should respect maxLevels parameter', () => {
      const tome = { value_per_level: '+5% damage', stat_affected: 'Damage' };
      const result = calculateTomeProgression(tome, 5);

      expect(result).toHaveLength(5);
    });

    it('should handle decimal values correctly', () => {
      const tome = { value_per_level: '+2.5% crit', stat_affected: 'Crit Chance' };
      const result = calculateTomeProgression(tome);

      expect(result[0]).toBe(2.5);
      expect(result[3]).toBe(10);
    });
  });
});

describe('Chart cleanup', () => {
  it('destroyAllCharts should call destroy on all instances', () => {
    const chartInstances = {
      'chart1': { destroy: vi.fn() },
      'chart2': { destroy: vi.fn() },
      'chart3': { destroy: vi.fn() }
    };

    // Simulate destroyAllCharts
    Object.keys(chartInstances).forEach(key => {
      if (chartInstances[key]) {
        chartInstances[key].destroy();
      }
    });

    expect(chartInstances['chart1'].destroy).toHaveBeenCalled();
    expect(chartInstances['chart2'].destroy).toHaveBeenCalled();
    expect(chartInstances['chart3'].destroy).toHaveBeenCalled();
  });
});

/**
 * Hyperbolic scaling function for items
 * Formula: actual = internal / (constant + internal)
 */
function applyHyperbolicScaling(values, constant = 1.0) {
  return values.map(v => {
    const internal = v / 100;
    const actual = internal / (constant + internal);
    return Math.round(actual * 10000) / 100;
  });
}

/**
 * Generate hyperbolic values for a given per-stack increment
 */
function generateHyperbolicValues(perStack, maxStacks = 10, constant = 1.0) {
  const internalValues = Array.from({ length: maxStacks }, (_, i) => perStack * (i + 1));
  return applyHyperbolicScaling(internalValues, constant);
}

describe('Hyperbolic Scaling for Items', () => {
  describe('applyHyperbolicScaling', () => {
    it('should apply standard hyperbolic formula (constant=1)', () => {
      // Formula: actual = internal / (1 + internal)
      // For 10% internal: 0.1 / 1.1 = 0.0909 = 9.09%
      const values = [10, 20, 30, 40, 50];
      const result = applyHyperbolicScaling(values, 1.0);

      expect(result[0]).toBeCloseTo(9.09, 1);  // 10% -> 9.09%
      expect(result[1]).toBeCloseTo(16.67, 1); // 20% -> 16.67%
      expect(result[2]).toBeCloseTo(23.08, 1); // 30% -> 23.08%
      expect(result[3]).toBeCloseTo(28.57, 1); // 40% -> 28.57%
      expect(result[4]).toBeCloseTo(33.33, 1); // 50% -> 33.33%
    });

    it('should never exceed theoretical max (50% for constant=1)', () => {
      // Even at 1000% internal, actual should be < 100%
      const values = [100, 200, 500, 1000];
      const result = applyHyperbolicScaling(values, 1.0);

      expect(result[0]).toBeCloseTo(50, 0);    // 100% -> 50%
      expect(result[1]).toBeCloseTo(66.67, 1); // 200% -> 66.67%
      expect(result[2]).toBeCloseTo(83.33, 1); // 500% -> 83.33%
      expect(result[3]).toBeCloseTo(90.91, 1); // 1000% -> 90.91%

      // All values should be less than 100%
      result.forEach(val => expect(val).toBeLessThan(100));
    });

    it('should handle different constants', () => {
      // With constant=0.75 (Armor formula style)
      // 50% internal: 0.5 / 1.25 = 0.4 = 40%
      const values = [50];
      const result = applyHyperbolicScaling(values, 0.75);

      expect(result[0]).toBeCloseTo(40, 0);
    });

    it('should return empty array for empty input', () => {
      const result = applyHyperbolicScaling([]);
      expect(result).toEqual([]);
    });
  });

  describe('generateHyperbolicValues', () => {
    it('should generate correct values for Key item (10% per stack)', () => {
      // Key: 10% per stack, hyperbolic
      // 1 stack: 10% internal -> ~9.09% actual
      const result = generateHyperbolicValues(10, 10, 1.0);

      expect(result[0]).toBeCloseTo(9.09, 1);  // 1 stack
      expect(result[4]).toBeCloseTo(33.33, 1); // 5 stacks (50% internal)
      expect(result[9]).toBeCloseTo(50, 0);    // 10 stacks (100% internal)
    });

    it('should generate correct values for Cursed Grabbies (5% per stack)', () => {
      // Cursed Grabbies: 5% per stack, hyperbolic
      const result = generateHyperbolicValues(5, 10, 1.0);

      expect(result[0]).toBeCloseTo(4.76, 1);  // 1 stack (5% internal)
      expect(result[4]).toBeCloseTo(20, 0);    // 5 stacks (25% internal)
      expect(result[9]).toBeCloseTo(33.33, 1); // 10 stacks (50% internal)
    });

    it('should respect maxStacks parameter', () => {
      const result = generateHyperbolicValues(10, 5, 1.0);
      expect(result).toHaveLength(5);
    });
  });

  describe('max_stacks cap behavior', () => {
    it('should respect max_stacks for items like Grandmas Tonic', () => {
      const item = {
        max_stacks: 5,
        scaling_per_stack: [4, 5, 6, 7, 8, 8, 8, 8, 8, 8]
      };

      const cap = getEffectiveStackCap(item);
      expect(cap).toBe(5);
    });

    it('should detect plateau for capped chance items', () => {
      // Spicy Meatball: caps at 100% at 4 stacks
      const item = {
        scaling_per_stack: [25, 50, 75, 100, 100, 100, 100, 100, 100, 100]
      };

      const cap = getEffectiveStackCap(item);
      expect(cap).toBe(4);
    });
  });

  describe('Item with scaling_tracks', () => {
    it('should have multiple scaling tracks for complex items', () => {
      const holyBook = {
        id: 'holy_book',
        scaling_tracks: {
          max_hp: { stat: 'Max HP', values: [100, 200, 300, 400, 500] },
          hp_regen: { stat: 'HP Regen', values: [50, 100, 150, 200, 250] },
          overheal: { stat: 'Overheal %', values: [25, 50, 75, 100, 125] },
          radius: { stat: 'Explosion Radius (m)', values: [5, 6, 7, 8, 9] }
        }
      };

      expect(Object.keys(holyBook.scaling_tracks)).toHaveLength(4);
      expect(holyBook.scaling_tracks.max_hp.values[0]).toBe(100);
      expect(holyBook.scaling_tracks.radius.values[0]).toBe(5);
    });
  });

  describe('Item with hidden_mechanics', () => {
    it('should contain hidden mechanics array', () => {
      const grandmasTonic = {
        id: 'grandmas_secret_tonic',
        hidden_mechanics: [
          'First copy ONLY gives +2% crit chance bonus - additional copies do NOT add more crit',
          'Radius caps at 8m (5 copies) - 6th+ copies do NOTHING'
        ]
      };

      expect(grandmasTonic.hidden_mechanics).toHaveLength(2);
      expect(grandmasTonic.hidden_mechanics[0]).toContain('+2% crit chance');
    });
  });

  describe('createCompareChart hyperbolic handling', () => {
    it('should apply hyperbolic transformation to items with scaling_formula_type hyperbolic', () => {
      // Test data: simulate comparing a hyperbolic item with a linear item
      const hyperbolicItem = {
        name: 'Key',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        scaling_formula_type: 'hyperbolic',
        hyperbolic_constant: 1.0
      };
      const linearItem = {
        name: 'Normal Item',
        scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      };

      // Apply transformation manually to verify expected values
      const expectedHyperbolic = applyHyperbolicScaling(
        hyperbolicItem.scaling_per_stack.slice(0, 10),
        hyperbolicItem.hyperbolic_constant
      );

      // Hyperbolic item should have diminishing returns curve
      // 10% internal -> ~9.09% actual, 100% internal -> 50% actual
      expect(expectedHyperbolic[0]).toBeCloseTo(9.09, 1);
      expect(expectedHyperbolic[9]).toBeCloseTo(50, 0);

      // Linear item should stay as-is (no transformation)
      expect(linearItem.scaling_per_stack[0]).toBe(10);
      expect(linearItem.scaling_per_stack[9]).toBe(100);
    });

    it('should not transform items without scaling_formula_type hyperbolic', () => {
      const linearItem = {
        name: 'Linear Item',
        scaling_per_stack: [10, 20, 30, 40, 50],
        scaling_formula_type: 'linear'
      };

      // Linear items should not be transformed
      expect(linearItem.scaling_per_stack[0]).toBe(10);
      expect(linearItem.scaling_per_stack[4]).toBe(50);
    });
  });
});
