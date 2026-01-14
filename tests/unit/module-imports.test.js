import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData } from '../helpers/mock-data.js';

// Import all modules to ensure they're loaded and coverage is tracked
import { ToastManager } from '../../src/modules/toast.ts';
import { filterData, handleSearch, parseAdvancedSearch } from '../../src/modules/filters.ts';
import {
  safeGetElementById,
  escapeHtml,
  truncateText,
  generateTierLabel,
  generateBadge,
  sortData,
  debounce,
  isValidExternalUrl,
  generateResponsiveImage,
  generateEntityImage,
  generateExpandableText,
  findEntityById
} from '../../src/modules/utils.ts';
import { loadFavorites, isFavorite, toggleFavorite, getFavorites } from '../../src/modules/favorites.ts';
import { domCache, getSearchInput, invalidateDOMCache } from '../../src/modules/dom-cache.ts';
import { themeManager } from '../../src/modules/theme-manager.ts';
import { generateMatchBadge } from '../../src/modules/match-badge.ts';
import { TIER_ORDER, RARITY_ORDER, VALID_TIERS, VALID_RARITIES } from '../../src/modules/constants.ts';
import { Chart } from '../../src/modules/chart-loader.ts';
import { safeModuleInit, registerErrorBoundary } from '../../src/modules/error-boundary.ts';
import { allData } from '../../src/modules/data-service.ts';
import { renderTabContent } from '../../src/modules/renderers.ts';
import { populateCalculatorItems, calculateBreakpoint } from '../../src/modules/calculator.ts';
import { findEntityInData, renderChangelog } from '../../src/modules/changelog.ts';
import { closeModal } from '../../src/modules/modal.ts';
import { setupKeyboardShortcuts } from '../../src/modules/keyboard-shortcuts.ts';
import { setupEventDelegation, setupEventListeners } from '../../src/modules/events.ts';
import {
  currentBuild,
  populateBuildSlots,
  calculateBuildStats,
  addTomeToBuild,
  addItemToBuild
} from '../../src/modules/build-planner.ts';
import { createScalingChart } from '../../src/modules/charts.ts';
import { openCompareModal, toggleCompareMode, addToCompare } from '../../src/modules/compare.ts';

/**
 * This test file ensures all modules are imported and their code is executed,
 * which helps with coverage tracking. It also tests basic module functionality.
 */
describe('Module Imports and Basic Functionality', () => {
  beforeEach(() => {
    createMinimalDOM();

    // Set up global allData
    global.allData = createMockAllData();
  });

  describe('Toast Module', () => {
    it('should initialize ToastManager', () => {
      expect(ToastManager).toBeDefined();
      expect(ToastManager.init).toBeInstanceOf(Function);
      expect(ToastManager.show).toBeInstanceOf(Function);
    });
  });

  describe('Utils Module', () => {
    it('should have utility functions', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(generateTierLabel('SS')).toContain('SS');
      expect(isValidExternalUrl('https://example.com')).toBe(true);
      expect(isValidExternalUrl(null)).toBe(false);
    });

    it('should truncate text', () => {
      const result = truncateText('This is a very long text that should be truncated', 20);
      expect(result.needsExpand).toBe(true);
      expect(result.html.length).toBeLessThan(50);
    });

    it('should debounce functions', () => {
      const fn = debounce(() => {}, 100);
      expect(fn).toBeInstanceOf(Function);
    });
  });

  describe('Constants Module', () => {
    it('should export tier order', () => {
      expect(TIER_ORDER).toBeDefined();
      expect(typeof TIER_ORDER).toBe('object');
      expect(TIER_ORDER.SS).toBeDefined();
    });

    it('should export rarity order', () => {
      expect(RARITY_ORDER).toBeDefined();
      expect(typeof RARITY_ORDER).toBe('object');
      expect(RARITY_ORDER.legendary).toBeDefined();
    });

    it('should export valid tiers', () => {
      expect(VALID_TIERS).toBeDefined();
      expect(Array.isArray(VALID_TIERS)).toBe(true);
    });

    it('should export valid rarities', () => {
      expect(VALID_RARITIES).toBeDefined();
      expect(Array.isArray(VALID_RARITIES)).toBe(true);
    });
  });

  describe('Favorites Module', () => {
    it('should have favorites functions', () => {
      expect(loadFavorites).toBeInstanceOf(Function);
      expect(isFavorite).toBeInstanceOf(Function);
      expect(toggleFavorite).toBeInstanceOf(Function);
      expect(getFavorites).toBeInstanceOf(Function);
    });

    it('should check if item is favorite', () => {
      const result = isFavorite('items', 'test-id');
      expect(typeof result).toBe('boolean');
    });

    it('should get favorites for tab', () => {
      const favorites = getFavorites('items');
      expect(Array.isArray(favorites)).toBe(true);
    });
  });

  describe('DOM Cache Module', () => {
    it('should have dom cache object', () => {
      expect(domCache).toBeDefined();
      expect(domCache.init).toBeInstanceOf(Function);
    });

    it('should have cache getter functions', () => {
      expect(getSearchInput).toBeInstanceOf(Function);
      expect(invalidateDOMCache).toBeInstanceOf(Function);
    });
  });

  describe('Theme Manager Module', () => {
    it('should have theme manager', () => {
      expect(themeManager).toBeDefined();
      expect(themeManager.init).toBeInstanceOf(Function);
    });
  });

  describe('Match Badge Module', () => {
    it('should generate match badges', () => {
      const badge = generateMatchBadge({ matchType: 'exact', field: 'name' });
      expect(typeof badge).toBe('string');
    });

    it('should return empty string for no match', () => {
      const badge = generateMatchBadge(null);
      expect(badge).toBe('');
    });
  });

  describe('Filters Module', () => {
    it('should have filter functions', () => {
      expect(filterData).toBeInstanceOf(Function);
      expect(handleSearch).toBeInstanceOf(Function);
      expect(parseAdvancedSearch).toBeInstanceOf(Function);
    });

    it('should parse advanced search', () => {
      const criteria = parseAdvancedSearch('test');
      expect(criteria).toBeDefined();
      expect(criteria.text).toBeDefined();
    });
  });
});
