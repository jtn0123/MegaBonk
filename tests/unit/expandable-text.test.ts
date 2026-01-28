import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * Expandable text helper functions for testing
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;');
}

function toggleTextExpand(element) {
  if (!element.dataset.fullText) return;

  const isTruncated = element.dataset.truncated === 'true';
  const fullText = element.dataset.fullText;

  if (isTruncated) {
    // Expand
    element.innerHTML = fullText + '<span class="expand-indicator">Click to collapse</span>';
    element.dataset.truncated = 'false';
    element.classList.add('expanded');
  } else {
    // Collapse
    const truncated = fullText.length > 120 ? fullText.substring(0, 120) + '...' : fullText;
    element.innerHTML = truncated + '<span class="expand-indicator">Click to expand</span>';
    element.dataset.truncated = 'true';
    element.classList.remove('expanded');
  }
}

describe('Expandable Text', () => {
  beforeEach(() => {
    createMinimalDOM();
  });

  describe('escapeHtml()', () => {
    it('should escape HTML special characters', () => {
      const result = escapeHtml('<script>alert("xss")</script>');

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape quotes for data attributes', () => {
      const result = escapeHtml('Text with "quotes"');

      expect(result).toContain('&quot;');
      expect(result).not.toContain('"quotes"');
    });

    it('should handle empty text', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should preserve normal text', () => {
      const result = escapeHtml('Normal text without special chars');

      expect(result).toBe('Normal text without special chars');
    });
  });

  describe('toggleTextExpand()', () => {
    it('should expand truncated text on click', () => {
      const fullText = 'This is a very long description that exceeds the 120 character limit and should be truncated initially but expand when clicked by the user.';

      document.body.innerHTML = `
        <div class="expandable-text"
             data-full-text="${escapeHtml(fullText)}"
             data-truncated="true">
          ${fullText.substring(0, 120)}...
          <span class="expand-indicator">Click to expand</span>
        </div>
      `;

      const element = document.querySelector('.expandable-text');
      toggleTextExpand(element);

      expect(element.dataset.truncated).toBe('false');
      expect(element.innerHTML).toContain(fullText);
      expect(element.classList.contains('expanded')).toBe(true);
      expect(element.innerHTML).toContain('Click to collapse');
    });

    it('should collapse expanded text on second click', () => {
      const fullText = 'This is a very long description that exceeds 120 chars and needs to be truncated when collapsed again by the user clicking.';

      document.body.innerHTML = `
        <div class="expandable-text expanded"
             data-full-text="${escapeHtml(fullText)}"
             data-truncated="false">
          ${fullText}
          <span class="expand-indicator">Click to collapse</span>
        </div>
      `;

      const element = document.querySelector('.expandable-text');
      toggleTextExpand(element);

      expect(element.dataset.truncated).toBe('true');
      expect(element.innerHTML).toContain('...');
      expect(element.classList.contains('expanded')).toBe(false);
      expect(element.innerHTML).toContain('Click to expand');
    });

    it('should not modify element without fullText data', () => {
      document.body.innerHTML = `
        <div class="expandable-text" data-truncated="true">
          Some text without fullText attribute
        </div>
      `;

      const element = document.querySelector('.expandable-text');
      const originalHTML = element.innerHTML;
      toggleTextExpand(element);

      expect(element.innerHTML).toBe(originalHTML);
    });

    it('should handle short text that does not need truncation', () => {
      const shortText = 'Short description.';

      document.body.innerHTML = `
        <div class="expandable-text"
             data-full-text="${escapeHtml(shortText)}"
             data-truncated="false">
          ${shortText}
        </div>
      `;

      const element = document.querySelector('.expandable-text');
      toggleTextExpand(element);

      // When collapsing short text, it should not add "..."
      expect(element.innerHTML).toContain(shortText);
      expect(element.innerHTML).not.toContain('...');
    });

    it('should toggle expanded class correctly', () => {
      const fullText = 'A'.repeat(150); // Text longer than 120 chars

      document.body.innerHTML = `
        <div class="expandable-text"
             data-full-text="${escapeHtml(fullText)}"
             data-truncated="true">
          ${fullText.substring(0, 120)}...
        </div>
      `;

      const element = document.querySelector('.expandable-text');

      // Initially not expanded
      expect(element.classList.contains('expanded')).toBe(false);

      // Expand
      toggleTextExpand(element);
      expect(element.classList.contains('expanded')).toBe(true);

      // Collapse
      toggleTextExpand(element);
      expect(element.classList.contains('expanded')).toBe(false);
    });
  });

  describe('Expandable Text Integration', () => {
    it('should create expandable description for long text', () => {
      const longDescription = 'This is a detailed description of an item that explains all of its effects and mechanics in great detail, which requires more than 120 characters.';

      // Simulate renderItems behavior
      const isLong = longDescription.length > 120;
      const html = `
        <div class="item-description ${isLong ? 'expandable-text' : ''}"
             ${isLong ? `data-full-text="${escapeHtml(longDescription)}" data-truncated="true"` : ''}>
          ${isLong ? longDescription.substring(0, 120) + '...' : longDescription}
          ${isLong ? '<span class="expand-indicator">Click to expand</span>' : ''}
        </div>
      `;

      expect(html).toContain('expandable-text');
      expect(html).toContain('data-full-text');
      expect(html).toContain('Click to expand');
    });

    it('should not create expandable description for short text', () => {
      const shortDescription = 'Short item description.';

      const isLong = shortDescription.length > 120;
      const html = `
        <div class="item-description ${isLong ? 'expandable-text' : ''}">
          ${shortDescription}
        </div>
      `;

      expect(html).not.toContain('expandable-text');
      expect(html).not.toContain('data-full-text');
      expect(html).not.toContain('Click to expand');
    });
  });
});
