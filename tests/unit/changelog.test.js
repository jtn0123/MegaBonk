import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData, createMockItem, createMockWeapon, createMockCharacter, createMockTome, createMockShrine } from '../helpers/mock-data.js';

/**
 * Changelog module functions for unit testing
 * Mirrors the implementation in src/modules/changelog.js
 */

let allData = {};

/**
 * Find an entity in the loaded data by type and ID
 */
function findEntityInData(type, id) {
  const dataMap = {
    'item': { collection: allData.items, key: 'items' },
    'weapon': { collection: allData.weapons, key: 'weapons' },
    'tome': { collection: allData.tomes, key: 'tomes' },
    'character': { collection: allData.characters, key: 'characters' },
    'shrine': { collection: allData.shrines, key: 'shrines' }
  };

  const mapping = dataMap[type];
  if (!mapping || !mapping.collection) return null;
  return mapping.collection[mapping.key]?.find(e => e.id === id) || null;
}

/**
 * Parse changelog text and convert entity links to clickable HTML
 * Markup format: [[type:id|Display Text]]
 */
function parseChangelogLinks(text) {
  if (!text) return '';

  // Pattern: [[type:id|Display Text]]
  const linkPattern = /\[\[(\w+):(\w+)\|([^\]]+)\]\]/g;

  return text.replace(linkPattern, (match, type, id, label) => {
    // Validate entity type
    const validTypes = ['item', 'weapon', 'tome', 'character', 'shrine'];
    if (!validTypes.includes(type)) {
      return label; // Return plain text if invalid type
    }

    // Verify entity exists in loaded data
    const entity = findEntityInData(type, id);
    if (!entity) {
      return label; // Return plain text if entity not found
    }

    return `<a href="#" class="entity-link"
               data-entity-type="${type}"
               data-entity-id="${id}"
               title="View ${label}">${label}</a>`;
  });
}

/**
 * Format category name for display
 */
function formatCategoryName(category) {
  const names = {
    'balance': 'Balance Changes',
    'new_content': 'New Content',
    'bug_fixes': 'Bug Fixes',
    'removed': 'Removed',
    'other': 'Other Changes'
  };
  return names[category] || category;
}

/**
 * Format date string for display
 */
function formatChangelogDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;');
}

/**
 * Render sections for each category of changes
 */
function renderChangesSections(categories, rawNotes) {
  if (!categories) {
    // Fallback to raw notes if no categories
    if (rawNotes) {
      return `<div class="changelog-raw-notes">${escapeHtml(rawNotes)}</div>`;
    }
    return '';
  }

  const order = ['new_content', 'balance', 'bug_fixes', 'removed', 'other'];

  const sectionsHtml = order.map(cat => {
    const changes = categories[cat];
    if (!changes || changes.length === 0) return '';

    const items = changes.map(change => `
        <div class="changelog-item ${change.change_type || ''}">
            ${parseChangelogLinks(change.text)}
        </div>
    `).join('');

    return `
        <div class="changelog-section">
            <div class="changelog-section-title">${formatCategoryName(cat)}</div>
            ${items}
        </div>
    `;
  }).join('');

  // If no categorized content, show raw notes as fallback
  if (!sectionsHtml.trim() && rawNotes) {
    return `<div class="changelog-raw-notes">${escapeHtml(rawNotes)}</div>`;
  }

  return sectionsHtml;
}

describe('Changelog Module', () => {
  beforeEach(() => {
    createMinimalDOM();
    allData = createMockAllData();
  });

  describe('findEntityInData()', () => {
    it('should find item by type and id', () => {
      const item = createMockItem({ id: 'test_item', name: 'Test Item' });
      allData.items = { items: [item] };

      const result = findEntityInData('item', 'test_item');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Test Item');
    });

    it('should find weapon by type and id', () => {
      const weapon = createMockWeapon({ id: 'test_weapon', name: 'Test Weapon' });
      allData.weapons = { weapons: [weapon] };

      const result = findEntityInData('weapon', 'test_weapon');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Test Weapon');
    });

    it('should find tome by type and id', () => {
      const tome = createMockTome({ id: 'test_tome', name: 'Test Tome' });
      allData.tomes = { tomes: [tome] };

      const result = findEntityInData('tome', 'test_tome');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Test Tome');
    });

    it('should find character by type and id', () => {
      const character = createMockCharacter({ id: 'test_char', name: 'Test Character' });
      allData.characters = { characters: [character] };

      const result = findEntityInData('character', 'test_char');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Test Character');
    });

    it('should find shrine by type and id', () => {
      const shrine = createMockShrine({ id: 'test_shrine', name: 'Test Shrine' });
      allData.shrines = { shrines: [shrine] };

      const result = findEntityInData('shrine', 'test_shrine');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Test Shrine');
    });

    it('should return null for invalid type', () => {
      const result = findEntityInData('invalid_type', 'some_id');
      expect(result).toBeNull();
    });

    it('should return null for non-existent id', () => {
      const item = createMockItem({ id: 'existing_item' });
      allData.items = { items: [item] };

      const result = findEntityInData('item', 'non_existent_id');
      expect(result).toBeNull();
    });

    it('should return null when collection is undefined', () => {
      allData.items = undefined;

      const result = findEntityInData('item', 'some_id');
      expect(result).toBeNull();
    });

    it('should return null when collection key is missing', () => {
      allData.items = {}; // No 'items' key

      const result = findEntityInData('item', 'some_id');
      expect(result).toBeNull();
    });
  });

  describe('parseChangelogLinks()', () => {
    beforeEach(() => {
      // Set up test data with known entities
      const testItem = createMockItem({ id: 'bonk_stick', name: 'Bonk Stick' });
      const testWeapon = createMockWeapon({ id: 'mega_sword', name: 'Mega Sword' });
      allData.items = { items: [testItem] };
      allData.weapons = { weapons: [testWeapon] };
    });

    it('should convert [[item:id|label]] to anchor tag', () => {
      const text = 'Updated [[item:bonk_stick|Bonk Stick]] damage.';
      const result = parseChangelogLinks(text);

      expect(result).toContain('<a href="#"');
      expect(result).toContain('class="entity-link"');
    });

    it('should preserve label text in link', () => {
      const text = 'Updated [[item:bonk_stick|Bonk Stick]] damage.';
      const result = parseChangelogLinks(text);

      expect(result).toContain('>Bonk Stick</a>');
    });

    it('should add correct data attributes', () => {
      const text = 'Updated [[item:bonk_stick|Bonk Stick]] damage.';
      const result = parseChangelogLinks(text);

      expect(result).toContain('data-entity-type="item"');
      expect(result).toContain('data-entity-id="bonk_stick"');
    });

    it('should add title attribute', () => {
      const text = 'Updated [[item:bonk_stick|Bonk Stick]] damage.';
      const result = parseChangelogLinks(text);

      expect(result).toContain('title="View Bonk Stick"');
    });

    it('should return plain label for invalid entity type', () => {
      const text = 'Updated [[monster:goblin|Goblin]] stats.';
      const result = parseChangelogLinks(text);

      expect(result).toBe('Updated Goblin stats.');
      expect(result).not.toContain('<a');
    });

    it('should return plain label for non-existent entity', () => {
      const text = 'Updated [[item:non_existent|Missing Item]] damage.';
      const result = parseChangelogLinks(text);

      expect(result).toBe('Updated Missing Item damage.');
      expect(result).not.toContain('<a');
    });

    it('should handle multiple links in same text', () => {
      const text = 'Buffed [[item:bonk_stick|Bonk Stick]] and [[weapon:mega_sword|Mega Sword]].';
      const result = parseChangelogLinks(text);

      // Should have two anchor tags
      const linkCount = (result.match(/<a href="#"/g) || []).length;
      expect(linkCount).toBe(2);
    });

    it('should return empty string for null/undefined input', () => {
      expect(parseChangelogLinks(null)).toBe('');
      expect(parseChangelogLinks(undefined)).toBe('');
    });

    it('should not modify text without link markup', () => {
      const text = 'This is plain text with no links.';
      const result = parseChangelogLinks(text);

      expect(result).toBe(text);
    });

    it('should handle text with only partial markup', () => {
      const text = 'This has [[incomplete markup.';
      const result = parseChangelogLinks(text);

      expect(result).toBe(text);
    });
  });

  describe('formatCategoryName()', () => {
    it('should format balance as "Balance Changes"', () => {
      expect(formatCategoryName('balance')).toBe('Balance Changes');
    });

    it('should format new_content as "New Content"', () => {
      expect(formatCategoryName('new_content')).toBe('New Content');
    });

    it('should format bug_fixes as "Bug Fixes"', () => {
      expect(formatCategoryName('bug_fixes')).toBe('Bug Fixes');
    });

    it('should format removed as "Removed"', () => {
      expect(formatCategoryName('removed')).toBe('Removed');
    });

    it('should format other as "Other Changes"', () => {
      expect(formatCategoryName('other')).toBe('Other Changes');
    });

    it('should return original string for unknown category', () => {
      expect(formatCategoryName('custom_category')).toBe('custom_category');
    });

    it('should handle empty string', () => {
      expect(formatCategoryName('')).toBe('');
    });
  });

  describe('formatChangelogDate()', () => {
    it('should format ISO date to human readable', () => {
      const result = formatChangelogDate('2024-12-25');

      expect(result).toContain('Dec');
      expect(result).toContain('25');
      expect(result).toContain('2024');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatChangelogDate(null)).toBe('');
      expect(formatChangelogDate(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(formatChangelogDate('')).toBe('');
    });

    it('should handle different valid date formats', () => {
      // ISO format
      const result1 = formatChangelogDate('2024-01-15');
      expect(result1).toContain('Jan');
      expect(result1).toContain('15');

      // Different month
      const result2 = formatChangelogDate('2024-06-30');
      expect(result2).toContain('Jun');
      expect(result2).toContain('30');
    });
  });

  describe('renderChangesSections()', () => {
    beforeEach(() => {
      const testItem = createMockItem({ id: 'bonk_stick', name: 'Bonk Stick' });
      allData.items = { items: [testItem] };
    });

    it('should render sections in correct order', () => {
      const categories = {
        other: [{ text: 'Other change' }],
        new_content: [{ text: 'New content' }],
        balance: [{ text: 'Balance change' }]
      };

      const result = renderChangesSections(categories, null);

      // Check order: new_content should come before balance, which comes before other
      const newContentPos = result.indexOf('New Content');
      const balancePos = result.indexOf('Balance Changes');
      const otherPos = result.indexOf('Other Changes');

      expect(newContentPos).toBeLessThan(balancePos);
      expect(balancePos).toBeLessThan(otherPos);
    });

    it('should skip empty categories', () => {
      const categories = {
        new_content: [{ text: 'New content' }],
        balance: [], // Empty
        bug_fixes: null // Null
      };

      const result = renderChangesSections(categories, null);

      expect(result).toContain('New Content');
      expect(result).not.toContain('Balance Changes');
      expect(result).not.toContain('Bug Fixes');
    });

    it('should include change_type class on items', () => {
      const categories = {
        balance: [
          { text: 'Buffed something', change_type: 'buff' },
          { text: 'Nerfed something', change_type: 'nerf' }
        ]
      };

      const result = renderChangesSections(categories, null);

      expect(result).toContain('class="changelog-item buff"');
      expect(result).toContain('class="changelog-item nerf"');
    });

    it('should fall back to raw notes when no categories', () => {
      const rawNotes = 'These are raw patch notes.';
      const result = renderChangesSections(null, rawNotes);

      expect(result).toContain('changelog-raw-notes');
      expect(result).toContain('These are raw patch notes.');
    });

    it('should escape HTML in raw notes', () => {
      const rawNotes = '<script>alert("xss")</script>';
      const result = renderChangesSections(null, rawNotes);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should parse entity links within changes', () => {
      const categories = {
        balance: [{ text: 'Buffed [[item:bonk_stick|Bonk Stick]]' }]
      };

      const result = renderChangesSections(categories, null);

      expect(result).toContain('entity-link');
      expect(result).toContain('Bonk Stick');
    });

    it('should return empty string when no categories and no raw notes', () => {
      const result = renderChangesSections(null, null);
      expect(result).toBe('');
    });

    it('should fall back to raw notes when categories are empty', () => {
      const categories = {
        new_content: [],
        balance: []
      };
      const rawNotes = 'Fallback notes';

      const result = renderChangesSections(categories, rawNotes);

      expect(result).toContain('changelog-raw-notes');
      expect(result).toContain('Fallback notes');
    });

    it('should handle changes without change_type', () => {
      const categories = {
        balance: [{ text: 'Some change' }] // No change_type
      };

      const result = renderChangesSections(categories, null);

      // Should have class but empty change_type
      expect(result).toContain('class="changelog-item "');
      expect(result).toContain('Some change');
    });
  });
});
