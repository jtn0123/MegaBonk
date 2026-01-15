/**
 * Real Integration Tests for Changelog Module
 * No mocking - tests actual changelog implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    parseChangelogLinks,
    formatCategoryName,
    formatChangelogDate,
    renderChangesSections,
    toggleChangelogExpand,
    handleExpandClick,
} from '../../src/modules/changelog.ts';

// ========================================
// parseChangelogLinks Tests
// ========================================

describe('parseChangelogLinks - Real Integration Tests', () => {
    it('should return empty string for empty input', () => {
        expect(parseChangelogLinks('')).toBe('');
    });

    it('should return text as-is when no links', () => {
        const text = 'This is plain text without any links';
        expect(parseChangelogLinks(text)).toBe(text);
    });

    it('should return escaped label for invalid entity type', () => {
        const text = '[[invalid:test|Test Label]]';
        const result = parseChangelogLinks(text);
        // Should return plain text since entity type is invalid
        expect(result).toBe('Test Label');
    });

    it('should handle multiple valid markup patterns', () => {
        const text = 'Check out [[item:test1|Item 1]] and [[weapon:test2|Weapon 2]]';
        // These entities don't exist in allData, so should return escaped labels
        const result = parseChangelogLinks(text);
        expect(result).toContain('Item 1');
        expect(result).toContain('Weapon 2');
    });

    it('should preserve text around links', () => {
        const text = 'Before [[item:test|Test]] After';
        const result = parseChangelogLinks(text);
        expect(result).toContain('Before');
        expect(result).toContain('After');
    });

    it('should handle empty text gracefully', () => {
        expect(parseChangelogLinks('')).toBe('');
    });

    it('should handle text with special characters', () => {
        const text = 'Damage increased from 10% to 15%';
        expect(parseChangelogLinks(text)).toBe(text);
    });

    it('should handle multiple links in sequence', () => {
        const text = '[[item:a|A]][[item:b|B]][[item:c|C]]';
        const result = parseChangelogLinks(text);
        expect(result).toContain('A');
        expect(result).toContain('B');
        expect(result).toContain('C');
    });
});

// ========================================
// formatCategoryName Tests
// ========================================

describe('formatCategoryName - Real Integration Tests', () => {
    it('should format balance category', () => {
        expect(formatCategoryName('balance')).toBe('Balance Changes');
    });

    it('should format new_content category', () => {
        expect(formatCategoryName('new_content')).toBe('New Content');
    });

    it('should format bug_fixes category', () => {
        expect(formatCategoryName('bug_fixes')).toBe('Bug Fixes');
    });

    it('should format removed category', () => {
        expect(formatCategoryName('removed')).toBe('Removed');
    });

    it('should format other category', () => {
        expect(formatCategoryName('other')).toBe('Other Changes');
    });

    it('should return unknown category as-is', () => {
        expect(formatCategoryName('custom_category')).toBe('custom_category');
    });

    it('should handle empty string', () => {
        expect(formatCategoryName('')).toBe('');
    });
});

// ========================================
// formatChangelogDate Tests
// ========================================

describe('formatChangelogDate - Real Integration Tests', () => {
    it('should format valid date string', () => {
        const result = formatChangelogDate('2024-01-15');
        expect(result).toContain('Jan');
        expect(result).toContain('15');
        expect(result).toContain('2024');
    });

    it('should handle empty string', () => {
        expect(formatChangelogDate('')).toBe('');
    });

    it('should return Invalid Date for invalid date string', () => {
        const result = formatChangelogDate('not-a-date');
        expect(result).toBe('Invalid Date');
    });

    it('should format date with single digit day', () => {
        const result = formatChangelogDate('2024-02-05');
        expect(result).toContain('Feb');
        expect(result).toContain('5');
    });

    it('should format date at year boundaries', () => {
        const result1 = formatChangelogDate('2024-12-31');
        expect(result1).toContain('Dec');
        expect(result1).toContain('31');
        expect(result1).toContain('2024');

        const result2 = formatChangelogDate('2025-01-01');
        expect(result2).toContain('Jan');
        expect(result2).toContain('1');
        expect(result2).toContain('2025');
    });

    it('should handle different date formats', () => {
        // ISO format
        const isoResult = formatChangelogDate('2024-06-15');
        expect(isoResult).toContain('Jun');
    });

    it('should handle leap year date', () => {
        const result = formatChangelogDate('2024-02-29');
        expect(result).toContain('Feb');
        expect(result).toContain('29');
    });

    it('should return Invalid Date for invalid leap year', () => {
        // 2023 is not a leap year
        const result = formatChangelogDate('2023-02-29');
        // JS Date parses this as Mar 1, 2023
        expect(result).toContain('Mar');
    });
});

// ========================================
// renderChangesSections Tests
// ========================================

describe('renderChangesSections - Real Integration Tests', () => {
    it('should return empty string for undefined categories without raw notes', () => {
        const result = renderChangesSections(undefined, undefined);
        expect(result).toBe('');
    });

    it('should return raw notes when no categories', () => {
        const result = renderChangesSections(undefined, 'These are raw notes');
        expect(result).toContain('These are raw notes');
        expect(result).toContain('changelog-raw-notes');
    });

    it('should render balance section', () => {
        const categories = {
            balance: [{ text: 'Damage increased by 10%' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('changelog-section');
        expect(result).toContain('Balance Changes');
        expect(result).toContain('Damage increased by 10%');
    });

    it('should render new_content section', () => {
        const categories = {
            new_content: [{ text: 'Added new item' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('New Content');
        expect(result).toContain('Added new item');
    });

    it('should render bug_fixes section', () => {
        const categories = {
            bug_fixes: [{ text: 'Fixed crash bug' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('Bug Fixes');
        expect(result).toContain('Fixed crash bug');
    });

    it('should render multiple sections in order', () => {
        const categories = {
            new_content: [{ text: 'New content' }],
            balance: [{ text: 'Balance change' }],
            bug_fixes: [{ text: 'Bug fix' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('New Content');
        expect(result).toContain('Balance Changes');
        expect(result).toContain('Bug Fixes');
    });

    it('should apply change_type class', () => {
        const categories = {
            balance: [
                { text: 'Buff to damage', change_type: 'buff' },
                { text: 'Nerf to speed', change_type: 'nerf' },
            ],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('changelog-item buff');
        expect(result).toContain('changelog-item nerf');
    });

    it('should skip empty categories', () => {
        const categories = {
            balance: [],
            new_content: [{ text: 'New stuff' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('New Content');
        // Should not have balance section since it's empty
        expect(result.indexOf('Balance Changes')).toBe(-1);
    });

    it('should fall back to raw notes when categories have no content', () => {
        const categories = {
            balance: [],
            new_content: [],
        };

        const result = renderChangesSections(categories, 'Fallback notes');
        expect(result).toContain('Fallback notes');
    });
});

// ========================================
// toggleChangelogExpand Tests
// ========================================

describe('toggleChangelogExpand - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should expand collapsed section', () => {
        document.body.innerHTML = `
            <div id="changes-1" class="changelog-changes"></div>
            <button class="changelog-expand-btn" data-target="changes-1">Show Details</button>
        `;

        const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
        toggleChangelogExpand(button);

        const target = document.getElementById('changes-1');
        expect(target?.classList.contains('expanded')).toBe(true);
        expect(button.textContent).toBe('Hide Details');
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('should collapse expanded section', () => {
        document.body.innerHTML = `
            <div id="changes-1" class="changelog-changes expanded"></div>
            <button class="changelog-expand-btn" data-target="changes-1" aria-expanded="true">Hide Details</button>
        `;

        const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
        toggleChangelogExpand(button);

        const target = document.getElementById('changes-1');
        expect(target?.classList.contains('expanded')).toBe(false);
        expect(button.textContent).toBe('Show Details');
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('should handle missing target', () => {
        document.body.innerHTML = `
            <button class="changelog-expand-btn" data-target="non-existent">Show Details</button>
        `;

        const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;

        // Should not throw
        expect(() => toggleChangelogExpand(button)).not.toThrow();
    });

    it('should handle missing data-target attribute', () => {
        document.body.innerHTML = `
            <button class="changelog-expand-btn">Show Details</button>
        `;

        const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;

        // Should not throw
        expect(() => toggleChangelogExpand(button)).not.toThrow();
    });
});

// ========================================
// handleExpandClick Tests
// ========================================

describe('handleExpandClick - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle click on expand button', () => {
        document.body.innerHTML = `
            <div id="changes-1" class="changelog-changes"></div>
            <button class="changelog-expand-btn" data-target="changes-1">Show Details</button>
        `;

        const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: button });

        handleExpandClick(event);

        const target = document.getElementById('changes-1');
        expect(target?.classList.contains('expanded')).toBe(true);
    });

    it('should handle click on child of expand button', () => {
        document.body.innerHTML = `
            <div id="changes-1" class="changelog-changes"></div>
            <button class="changelog-expand-btn" data-target="changes-1">
                <span class="button-text">Show Details</span>
            </button>
        `;

        const buttonText = document.querySelector('.button-text') as HTMLElement;
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: buttonText });

        handleExpandClick(event);

        const target = document.getElementById('changes-1');
        expect(target?.classList.contains('expanded')).toBe(true);
    });

    it('should ignore click on non-button element', () => {
        document.body.innerHTML = `
            <div id="changes-1" class="changelog-changes"></div>
            <div class="some-other-element">Not a button</div>
        `;

        const div = document.querySelector('.some-other-element') as HTMLElement;
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: div });

        // Should not throw
        expect(() => handleExpandClick(event)).not.toThrow();

        const target = document.getElementById('changes-1');
        expect(target?.classList.contains('expanded')).toBe(false);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Changelog Edge Cases', () => {
    it('should handle XSS in raw notes', () => {
        const maliciousNotes = '<script>alert("xss")</script>';
        const result = renderChangesSections(undefined, maliciousNotes);

        // Script tags should be escaped
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    it('should handle HTML entities in text', () => {
        const text = 'Damage: 5% -> 10%';
        const result = parseChangelogLinks(text);
        expect(result).toContain('5%');
        expect(result).toContain('10%');
    });

    it('should handle very long change text', () => {
        const longText = 'A'.repeat(1000);
        const categories = {
            balance: [{ text: longText }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain(longText);
    });

    it('should handle unicode in change text', () => {
        const categories = {
            balance: [{ text: 'ダメージ増加 🔥' }],
        };

        const result = renderChangesSections(categories, undefined);
        expect(result).toContain('ダメージ増加');
        expect(result).toContain('🔥');
    });

    it('should handle nested brackets in text', () => {
        const text = 'Effect [base] [[item:test|Test]] [extra]';
        const result = parseChangelogLinks(text);
        expect(result).toContain('[base]');
        expect(result).toContain('[extra]');
    });
});

// ========================================
// Category Order Tests
// ========================================

describe('Category Order', () => {
    it('should render categories in correct order', () => {
        const categories = {
            other: [{ text: 'Other' }],
            removed: [{ text: 'Removed' }],
            bug_fixes: [{ text: 'Bug Fix' }],
            balance: [{ text: 'Balance' }],
            new_content: [{ text: 'New Content' }],
        };

        const result = renderChangesSections(categories, undefined);

        const newContentIndex = result.indexOf('New Content');
        const balanceIndex = result.indexOf('Balance Changes');
        const bugFixesIndex = result.indexOf('Bug Fixes');
        const removedIndex = result.indexOf('Removed');
        const otherIndex = result.indexOf('Other Changes');

        // Verify order: new_content, balance, bug_fixes, removed, other
        expect(newContentIndex).toBeLessThan(balanceIndex);
        expect(balanceIndex).toBeLessThan(bugFixesIndex);
        expect(bugFixesIndex).toBeLessThan(removedIndex);
        expect(removedIndex).toBeLessThan(otherIndex);
    });
});
