import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * XSS Prevention Tests
 * These tests verify that user input and dynamic content are properly escaped
 * to prevent cross-site scripting attacks.
 */

/**
 * escapeHtml implementation for testing
 * Mirrors the implementation in src/modules/utils.js
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;');
}

/**
 * Simulates rendering item content (mirrors rendering logic)
 */
function renderItemContent(item) {
  return `
    <div class="item-card">
      <h3 class="item-name">${escapeHtml(item.name)}</h3>
      <p class="item-description">${escapeHtml(item.description)}</p>
      <p class="item-notes">${escapeHtml(item.notes)}</p>
    </div>
  `;
}

/**
 * Parse changelog links (mirrors changelog.js logic)
 */
function parseChangelogLinks(text, findEntity = () => null) {
  if (!text) return '';

  const linkPattern = /\[\[(\w+):(\w+)\|([^\]]+)\]\]/g;

  return text.replace(linkPattern, (match, type, id, label) => {
    const validTypes = ['item', 'weapon', 'tome', 'character', 'shrine'];
    if (!validTypes.includes(type)) {
      return escapeHtml(label);
    }

    const entity = findEntity(type, id);
    if (!entity) {
      return escapeHtml(label);
    }

    return `<a href="#" class="entity-link"
               data-entity-type="${escapeHtml(type)}"
               data-entity-id="${escapeHtml(id)}"
               title="View ${escapeHtml(label)}">${escapeHtml(label)}</a>`;
  });
}

describe('XSS Prevention', () => {
  beforeEach(() => {
    createMinimalDOM();
  });

  describe('escapeHtml()', () => {
    it('should escape script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&lt;/script&gt;');
    });

    it('should escape inline event handlers by escaping the tag', () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const result = escapeHtml(malicious);

      // The < and > are escaped, making the tag non-executable
      expect(result).toContain('&lt;img');
      expect(result).toContain('&gt;');
      // Event handler text is present but not executable because tag is escaped
      expect(result).not.toContain('<img');
    });

    it('should escape onclick handlers by escaping the tag', () => {
      const malicious = '<div onclick="alert(1)">click me</div>';
      const result = escapeHtml(malicious);

      // The div tag is escaped
      expect(result).toContain('&lt;div');
      expect(result).toContain('&lt;/div&gt;');
      // Not a real div element
      expect(result).not.toContain('<div');
    });

    it('should escape javascript: URLs by escaping the tag', () => {
      const malicious = '<a href="javascript:alert(1)">link</a>';
      const result = escapeHtml(malicious);

      // The anchor tag is escaped
      expect(result).toContain('&lt;a');
      // Not a real anchor element
      expect(result).not.toContain('<a href=');
    });

    it('should escape data: URLs by escaping the tag', () => {
      const malicious = '<a href="data:text/html,<script>alert(1)</script>">link</a>';
      const result = escapeHtml(malicious);

      // The anchor tag is escaped
      expect(result).toContain('&lt;a');
      // Not a real anchor element
      expect(result).not.toContain('<a href=');
    });

    it('should handle nested escaping attempts', () => {
      const malicious = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const result = escapeHtml(malicious);

      // Should double-escape the ampersands
      expect(result).toContain('&amp;lt;');
    });

    it('should escape all HTML entities', () => {
      const malicious = '<>&"\'';
      const result = escapeHtml(malicious);

      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should handle SVG-based XSS', () => {
      const malicious = '<svg onload="alert(1)">';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('<svg');
      expect(result).toContain('&lt;svg');
    });

    it('should handle iframe injection', () => {
      const malicious = '<iframe src="https://evil.com"></iframe>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('<iframe');
      expect(result).toContain('&lt;iframe');
    });

    it('should handle style-based XSS', () => {
      const malicious = '<style>body{background:url("javascript:alert(1)")}</style>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('<style>');
      expect(result).toContain('&lt;style&gt;');
    });
  });

  describe('renderItemContent()', () => {
    it('should escape item names with HTML', () => {
      const item = {
        name: '<script>alert("xss")</script>',
        description: 'Normal description',
        notes: 'Normal notes'
      };

      const result = renderItemContent(item);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape descriptions with HTML', () => {
      const item = {
        name: 'Normal Item',
        description: '<img src=x onerror=alert(1)>',
        notes: 'Normal notes'
      };

      const result = renderItemContent(item);

      // The img tag is escaped, making the event handler non-executable
      expect(result).toContain('&lt;img');
      expect(result).toContain('&gt;');
      // Not a real img element
      expect(result).not.toContain('<img');
    });

    it('should escape notes with HTML', () => {
      const item = {
        name: 'Normal Item',
        description: 'Normal description',
        notes: '<a href="javascript:alert(1)">click</a>'
      };

      const result = renderItemContent(item);

      // The anchor tag is escaped, making the javascript: URL non-executable
      expect(result).toContain('&lt;a');
      expect(result).toContain('&lt;/a&gt;');
      // Not a real anchor element
      expect(result).not.toContain('<a href=');
    });

    it('should handle all fields containing XSS attempts', () => {
      const item = {
        name: '<script>alert(1)</script>',
        description: '<img onerror=alert(2)>',
        notes: '<svg onload=alert(3)>'
      };

      const result = renderItemContent(item);

      // All HTML tags are escaped, making them non-executable
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('<svg');
      // Escaped versions are present
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&lt;img');
      expect(result).toContain('&lt;svg');
    });
  });

  describe('parseChangelogLinks()', () => {
    it('should not execute scripts in link labels', () => {
      const text = 'Check out [[item:sword|<script>alert(1)</script>]]';

      const result = parseChangelogLinks(text, () => ({ id: 'sword', name: 'Sword' }));

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape entity IDs', () => {
      const text = 'Check out [[item:<script>|Evil Item]]';

      const result = parseChangelogLinks(text);

      // Should not match due to invalid type
      expect(result).not.toContain('data-entity-id="<script>"');
    });

    it('should escape entity types', () => {
      const text = 'Check out [[<script>:sword|Evil]]';

      const result = parseChangelogLinks(text);

      // Should not match due to invalid type
      expect(result).not.toContain('data-entity-type="<script>"');
    });

    it('should handle XSS in title attribute', () => {
      const text = '[[item:sword|" onclick="alert(1)" data-x="]]';

      const result = parseChangelogLinks(text, () => ({ id: 'sword', name: 'Sword' }));

      // The label should be escaped in the title
      expect(result).toContain('&quot;');
      expect(result).not.toContain('onclick="alert(1)"');
    });
  });

  describe('DOM-based XSS prevention', () => {
    it('should not allow innerHTML injection via textContent', () => {
      const div = document.createElement('div');
      div.textContent = '<script>alert(1)</script>';

      // When set via textContent, script tags are treated as text
      expect(div.innerHTML).not.toContain('<script>');
      expect(div.innerHTML).toContain('&lt;script&gt;');
    });

    it('should prevent XSS when using createElement approach', () => {
      const malicious = '<img src=x onerror=alert(1)>';

      const div = document.createElement('div');
      div.textContent = malicious;
      const escaped = div.innerHTML;

      const container = document.createElement('div');
      container.innerHTML = escaped;

      // Should not contain actual img element
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('URL parameter XSS prevention', () => {
    it('should escape search parameters in URLs', () => {
      const userInput = '"><script>alert(1)</script><"';
      const escaped = encodeURIComponent(userInput);

      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('%3Cscript%3E');
    });

    it('should escape hash parameters', () => {
      const userInput = '#"><script>alert(1)</script>';
      const escaped = encodeURIComponent(userInput);

      expect(escaped).not.toContain('<script>');
    });
  });

  describe('JSON data XSS prevention', () => {
    it('should safely parse JSON without executing code', () => {
      const jsonString = '{"name": "<script>alert(1)</script>"}';
      const parsed = JSON.parse(jsonString);

      // JSON.parse doesn't execute scripts, just parses the string
      expect(parsed.name).toBe('<script>alert(1)</script>');

      // But when displaying, should be escaped
      const escaped = escapeHtml(parsed.name);
      expect(escaped).not.toContain('<script>');
    });
  });

  describe('Edge cases and bypass attempts', () => {
    it('should handle null byte injection', () => {
      const malicious = '<scr\0ipt>alert(1)</script>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('<scr');
    });

    it('should handle case variation', () => {
      const malicious = '<ScRiPt>alert(1)</sCrIpT>';
      const result = escapeHtml(malicious);

      expect(result).toContain('&lt;ScRiPt&gt;');
    });

    it('should handle encoded entities', () => {
      const malicious = '&#60;script&#62;alert(1)&#60;/script&#62;';
      const result = escapeHtml(malicious);

      // Should escape the & in the HTML entities
      expect(result).toContain('&amp;');
    });

    it('should handle Unicode escapes', () => {
      const malicious = '\u003cscript\u003ealert(1)\u003c/script\u003e';
      const result = escapeHtml(malicious);

      // Unicode escapes should be converted and escaped
      expect(result).not.toContain('<script>');
    });

    it('should handle base64 encoded payloads', () => {
      const payload = btoa('<script>alert(1)</script>');
      // When decoded and displayed, should still be escaped
      const decoded = atob(payload);
      const result = escapeHtml(decoded);

      expect(result).not.toContain('<script>');
    });

    it('should handle URL encoding bypass attempts', () => {
      const malicious = '%3Cscript%3Ealert(1)%3C/script%3E';
      const decoded = decodeURIComponent(malicious);
      const result = escapeHtml(decoded);

      expect(result).not.toContain('<script>');
    });
  });
});
