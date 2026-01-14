import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockAllData } from '../helpers/mock-data.js';

// ✅ REFACTORED: Import functions directly from utils module instead of duplicating
import {
  safeGetElementById,
  safeQuerySelector,
  safeQuerySelectorAll,
  escapeHtml,
  truncateText,
  generateExpandableText,
  generateResponsiveImage,
  generateEntityImage,
  generateEmptyState,
  sortData,
  findEntityById,
  generateTierLabel,
  generateBadge,
  generateMetaTags,
  debounce,
  isValidExternalUrl
} from '../../src/modules/utils.ts';

// ✅ All standalone function implementations removed - using direct imports instead

describe('Utils Module', () => {
  beforeEach(() => {
    createMinimalDOM();
  });

  describe('safeGetElementById()', () => {
    it('should return element when exists', () => {
      const div = document.createElement('div');
      div.id = 'test-element';
      document.body.appendChild(div);

      const result = safeGetElementById('test-element');
      expect(result).toBe(div);
    });

    it('should return null when element not found', () => {
      const result = safeGetElementById('non-existent-element');
      expect(result).toBeNull();
    });

    it('should return fallback when element not found', () => {
      const fallback = { type: 'fallback' };
      const result = safeGetElementById('non-existent-element', fallback);
      expect(result).toBe(fallback);
    });

    it('should return element even when fallback provided', () => {
      const div = document.createElement('div');
      div.id = 'existing-element';
      document.body.appendChild(div);

      const fallback = { type: 'fallback' };
      const result = safeGetElementById('existing-element', fallback);
      expect(result).toBe(div);
    });
  });

  describe('safeQuerySelector()', () => {
    it('should return element when exists', () => {
      const div = document.createElement('div');
      div.className = 'test-class';
      document.body.appendChild(div);

      const result = safeQuerySelector('.test-class');
      expect(result).toBe(div);
    });

    it('should return fallback when not found', () => {
      const fallback = { type: 'fallback' };
      const result = safeQuerySelector('.non-existent-class', document, fallback);
      expect(result).toBe(fallback);
    });

    it('should search within context element', () => {
      const container = document.createElement('div');
      container.id = 'container';
      const child = document.createElement('span');
      child.className = 'child-class';
      container.appendChild(child);
      document.body.appendChild(container);

      const result = safeQuerySelector('.child-class', container);
      expect(result).toBe(child);
    });

    it('should return null when not found and no fallback', () => {
      const result = safeQuerySelector('.non-existent-class');
      expect(result).toBeNull();
    });
  });

  describe('safeQuerySelectorAll()', () => {
    it('should return NodeList-like object', () => {
      document.body.innerHTML = `
        <div class="item">1</div>
        <div class="item">2</div>
        <div class="item">3</div>
      `;

      const result = safeQuerySelectorAll('.item');
      // Check it has NodeList-like properties
      expect(result.length).toBe(3);
      expect(typeof result.forEach).toBe('function');
    });

    it('should return empty collection when none found', () => {
      const result = safeQuerySelectorAll('.non-existent-class');
      expect(result.length).toBe(0);
    });

    it('should search within context element', () => {
      const container = document.createElement('div');
      container.innerHTML = '<span class="inner">1</span><span class="inner">2</span>';
      document.body.appendChild(container);

      const result = safeQuerySelectorAll('.inner', container);
      expect(result.length).toBe(2);
    });
  });

  describe('escapeHtml()', () => {
    it('should escape < and > characters', () => {
      const result = escapeHtml('<div>test</div>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).not.toContain('<div>');
    });

    it('should escape & character', () => {
      const result = escapeHtml('a & b');
      expect(result).toContain('&amp;');
    });

    it('should escape double quotes', () => {
      const result = escapeHtml('text with "quotes"');
      expect(result).toContain('&quot;');
    });

    it('should return empty string for null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle plain text without special characters', () => {
      const result = escapeHtml('plain text');
      expect(result).toBe('plain text');
    });
  });

  describe('truncateText()', () => {
    it('should not truncate short text', () => {
      const result = truncateText('Short text', 120);

      expect(result.html).toBe('Short text');
      expect(result.needsExpand).toBe(false);
      expect(result.fullText).toBe('Short text');
    });

    it('should truncate long text with ellipsis', () => {
      const longText = 'A'.repeat(150);
      const result = truncateText(longText, 120);

      expect(result.html.length).toBe(123); // 120 + '...'
      expect(result.html.endsWith('...')).toBe(true);
    });

    it('should return needsExpand flag', () => {
      const longText = 'A'.repeat(150);
      const result = truncateText(longText, 120);

      expect(result.needsExpand).toBe(true);
    });

    it('should preserve fullText', () => {
      const longText = 'A'.repeat(150);
      const result = truncateText(longText, 120);

      expect(result.fullText).toBe(longText);
    });

    it('should handle empty/null input', () => {
      expect(truncateText(null).html).toBe('');
      expect(truncateText(undefined).html).toBe('');
      expect(truncateText('').html).toBe('');
    });

    it('should use default maxLength of 120', () => {
      const text = 'A'.repeat(121);
      const result = truncateText(text);

      expect(result.needsExpand).toBe(true);
    });

    it('should not truncate text at exactly maxLength', () => {
      const text = 'A'.repeat(120);
      const result = truncateText(text, 120);

      expect(result.needsExpand).toBe(false);
      expect(result.html).toBe(text);
    });
  });

  describe('generateExpandableText()', () => {
    it('should return simple div for short text', () => {
      const result = generateExpandableText('Short text');

      expect(result).toContain('<div class="item-description">');
      expect(result).not.toContain('expandable-text');
      expect(result).not.toContain('data-full-text');
    });

    it('should return expandable div for long text', () => {
      const longText = 'A'.repeat(150);
      const result = generateExpandableText(longText, 120);

      expect(result).toContain('expandable-text');
    });

    it('should include data-full-text attribute', () => {
      const longText = 'A'.repeat(150);
      const result = generateExpandableText(longText, 120);

      expect(result).toContain('data-full-text=');
    });

    it('should include expand indicator', () => {
      const longText = 'A'.repeat(150);
      const result = generateExpandableText(longText, 120);

      expect(result).toContain('expand-indicator');
      expect(result).toContain('Click to expand');
    });

    it('should include onclick handler reference', () => {
      const longText = 'A'.repeat(150);
      const result = generateExpandableText(longText, 120);

      expect(result).toContain('onclick="toggleTextExpand(this)"');
    });

    it('should escape HTML in full text data attribute', () => {
      const textWithQuotes = 'A'.repeat(100) + ' "quoted" text ' + 'A'.repeat(50);
      const result = generateExpandableText(textWithQuotes, 120);

      expect(result).toContain('&quot;');
    });
  });

  describe('findEntityById()', () => {
    it('should find entity in collection', () => {
      const item = createMockItem({ id: 'test_item', name: 'Test Item' });
      const collection = { items: [item] };

      const result = findEntityById(collection, 'items', 'test_item');
      expect(result).toBe(item);
    });

    it('should return undefined when not found', () => {
      const item = createMockItem({ id: 'existing_item' });
      const collection = { items: [item] };

      const result = findEntityById(collection, 'items', 'non_existent');
      expect(result).toBeUndefined();
    });

    it('should handle null/undefined collection', () => {
      expect(findEntityById(null, 'items', 'test')).toBeUndefined();
      expect(findEntityById(undefined, 'items', 'test')).toBeUndefined();
    });

    it('should handle missing key in collection', () => {
      const collection = {};
      const result = findEntityById(collection, 'items', 'test');
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const collection = { items: [] };
      const result = findEntityById(collection, 'items', 'test');
      expect(result).toBeUndefined();
    });
  });

  describe('generateEmptyState()', () => {
    it('should include icon', () => {
      const result = generateEmptyState('🔍', 'Items');
      expect(result).toContain('🔍');
    });

    it('should include entity type in heading', () => {
      const result = generateEmptyState('🔍', 'Weapons');
      expect(result).toContain('No Weapons Found');
    });

    it('should include clear filters button', () => {
      const result = generateEmptyState('🔍', 'Items');
      expect(result).toContain('clearFilters()');
      expect(result).toContain('Clear Filters');
    });

    it('should have correct CSS classes', () => {
      const result = generateEmptyState('🔍', 'Items');
      expect(result).toContain('empty-state');
      expect(result).toContain('empty-icon');
      expect(result).toContain('btn-secondary');
    });

    it('should include helpful message', () => {
      const result = generateEmptyState('🔍', 'Items');
      expect(result).toContain('Try adjusting your search or filter criteria');
    });
  });

  describe('sortData()', () => {
    const testItems = [
      { name: 'Zebra', tier: 'B', rarity: 'rare' },
      { name: 'Apple', tier: 'SS', rarity: 'legendary' },
      { name: 'Mango', tier: 'A', rarity: 'common' }
    ];

    it('should sort by name alphabetically', () => {
      const result = sortData(testItems, 'name');

      expect(result[0].name).toBe('Apple');
      expect(result[1].name).toBe('Mango');
      expect(result[2].name).toBe('Zebra');
    });

    it('should sort by tier (SS first)', () => {
      const result = sortData(testItems, 'tier');

      expect(result[0].tier).toBe('SS');
      expect(result[1].tier).toBe('A');
      expect(result[2].tier).toBe('B');
    });

    it('should sort by rarity (legendary first)', () => {
      const result = sortData(testItems, 'rarity');

      expect(result[0].rarity).toBe('legendary');
      expect(result[1].rarity).toBe('rare');
      expect(result[2].rarity).toBe('common');
    });

    it('should handle unknown tier/rarity values', () => {
      const itemsWithUnknown = [
        { name: 'A', tier: 'S', rarity: 'epic' },
        { name: 'B', tier: 'UNKNOWN', rarity: 'unknown' }
      ];

      const resultTier = sortData(itemsWithUnknown, 'tier');
      expect(resultTier[0].tier).toBe('S'); // Known tier comes first
      expect(resultTier[1].tier).toBe('UNKNOWN');

      const resultRarity = sortData(itemsWithUnknown, 'rarity');
      expect(resultRarity[0].rarity).toBe('epic'); // Known rarity comes first
    });

    it('should not modify original array', () => {
      const original = [...testItems];
      sortData(testItems, 'name');

      expect(testItems[0].name).toBe(original[0].name);
    });

    it('should return same order for unknown sort type', () => {
      const result = sortData(testItems, 'unknown');
      expect(result.length).toBe(3);
    });

    it('should handle empty array', () => {
      const result = sortData([], 'name');
      expect(result).toEqual([]);
    });
  });

  describe('generateTierLabel()', () => {
    it('should generate correct tier label HTML', () => {
      const result = generateTierLabel('SS');
      expect(result).toBe('<span class="tier-label">SS Tier</span>');
    });

    it('should handle all tier values', () => {
      expect(generateTierLabel('S')).toContain('S Tier');
      expect(generateTierLabel('A')).toContain('A Tier');
      expect(generateTierLabel('B')).toContain('B Tier');
      expect(generateTierLabel('C')).toContain('C Tier');
    });
  });

  describe('generateBadge()', () => {
    it('should generate badge with text', () => {
      const result = generateBadge('Legendary');
      expect(result).toContain('Legendary');
      expect(result).toContain('class="badge "');
    });

    it('should include additional class', () => {
      const result = generateBadge('Epic', 'rarity-epic');
      expect(result).toContain('class="badge rarity-epic"');
    });
  });

  describe('generateMetaTags()', () => {
    it('should generate tags from array', () => {
      const tags = ['crit', 'damage', 'speed'];
      const result = generateMetaTags(tags);

      expect(result).toContain('meta-tag');
      expect(result).toContain('crit');
      expect(result).toContain('damage');
      expect(result).toContain('speed');
    });

    it('should limit tags when specified', () => {
      const tags = ['crit', 'damage', 'speed', 'armor'];
      const result = generateMetaTags(tags, 2);

      expect(result).toContain('crit');
      expect(result).toContain('damage');
      expect(result).not.toContain('speed');
      expect(result).not.toContain('armor');
    });

    it('should return empty string for null/undefined', () => {
      expect(generateMetaTags(null)).toBe('');
      expect(generateMetaTags(undefined)).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(generateMetaTags([])).toBe('');
    });

    it('should show all tags when limit is 0', () => {
      const tags = ['a', 'b', 'c', 'd'];
      const result = generateMetaTags(tags, 0);

      expect(result).toContain('a');
      expect(result).toContain('b');
      expect(result).toContain('c');
      expect(result).toContain('d');
    });
  });
});
