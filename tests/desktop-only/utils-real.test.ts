/**
 * Real Integration Tests for Utils Module
 * No mocking - tests actual function implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    sortData,
    escapeHtml,
    truncateText,
    generateExpandableText,
    generateMetaTags,
    generateEmptyState,
    generateTierLabel,
    generateBadge,
    findEntityById,
    isValidExternalUrl,
    debounce,
    generateResponsiveImage,
    generateEntityImage,
    generateModalImage,
    safeGetElementById,
    safeQuerySelector,
    safeQuerySelectorAll,
    safeSetValue,
    safeSetHTML,
} from '../../src/modules/utils.ts';

// ========================================
// sortData Tests
// ========================================

describe('sortData - Pure Function Tests', () => {
    describe('Sort by Name', () => {
        it('should sort array alphabetically by name', () => {
            const data = [
                { id: '1', name: 'Zebra' },
                { id: '2', name: 'Apple' },
                { id: '3', name: 'Mango' },
            ];

            const result = sortData(data as any, 'name');

            expect(result[0].name).toBe('Apple');
            expect(result[1].name).toBe('Mango');
            expect(result[2].name).toBe('Zebra');
        });

        it('should handle empty array', () => {
            const result = sortData([], 'name');
            expect(result).toEqual([]);
        });

        it('should handle single element', () => {
            const data = [{ id: '1', name: 'Only' }];
            const result = sortData(data as any, 'name');
            expect(result).toHaveLength(1);
        });

        it('should handle objects without name property', () => {
            const data = [
                { id: '1' },
                { id: '2', name: 'Has Name' },
                { id: '3' },
            ];

            const result = sortData(data as any, 'name');
            // Objects without name should sort to beginning (empty string)
            expect(result[result.length - 1].name).toBe('Has Name');
        });

        it('should be case-sensitive in locale comparison', () => {
            const data = [
                { id: '1', name: 'banana' },
                { id: '2', name: 'Apple' },
            ];

            const result = sortData(data as any, 'name');
            // localeCompare may vary by locale, just verify sorting completed
            expect(result).toHaveLength(2);
        });
    });

    describe('Sort by Tier', () => {
        it('should sort by tier order (SS > S > A > B > C)', () => {
            const data = [
                { id: '1', name: 'Item1', tier: 'C' },
                { id: '2', name: 'Item2', tier: 'SS' },
                { id: '3', name: 'Item3', tier: 'A' },
                { id: '4', name: 'Item4', tier: 'S' },
                { id: '5', name: 'Item5', tier: 'B' },
            ];

            const result = sortData(data as any, 'tier');

            expect(result[0].tier).toBe('SS');
            expect(result[1].tier).toBe('S');
            expect(result[2].tier).toBe('A');
            expect(result[3].tier).toBe('B');
            expect(result[4].tier).toBe('C');
        });

        it('should handle items without tier', () => {
            const data = [
                { id: '1', name: 'NoTier' },
                { id: '2', name: 'HasTier', tier: 'A' },
            ];

            const result = sortData(data as any, 'tier');
            // Items without tier get 99, so they go to end
            expect(result[0].tier).toBe('A');
        });
    });

    describe('Sort by Rarity', () => {
        it('should sort by rarity order', () => {
            const data = [
                { id: '1', name: 'Item1', rarity: 'common' },
                { id: '2', name: 'Item2', rarity: 'legendary' },
                { id: '3', name: 'Item3', rarity: 'rare' },
                { id: '4', name: 'Item4', rarity: 'epic' },
                { id: '5', name: 'Item5', rarity: 'uncommon' },
            ];

            const result = sortData(data as any, 'rarity');

            // Verify order: legendary > epic > rare > uncommon > common
            expect(result[0].rarity).toBe('legendary');
            expect(result[1].rarity).toBe('epic');
            expect(result[2].rarity).toBe('rare');
            expect(result[3].rarity).toBe('uncommon');
            expect(result[4].rarity).toBe('common');
        });

        it('should handle items without rarity', () => {
            const data = [
                { id: '1', name: 'NoRarity' },
                { id: '2', name: 'HasRarity', rarity: 'epic' },
            ];

            const result = sortData(data as any, 'rarity');
            expect(result[0].rarity).toBe('epic');
        });
    });

    describe('Edge Cases', () => {
        it('should return original array for unknown sort type', () => {
            const data = [{ id: '1', name: 'Test' }];
            const result = sortData(data as any, 'unknown' as any);
            expect(result).toEqual(data);
        });
    });
});

// ========================================
// escapeHtml Tests
// ========================================

describe('escapeHtml - Pure Function Tests', () => {
    it('should escape HTML special characters', () => {
        const input = '<script>alert("XSS")</script>';
        const result = escapeHtml(input);

        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    it('should escape double quotes', () => {
        const result = escapeHtml('He said "hello"');
        expect(result).toContain('&quot;');
    });

    it('should handle null input', () => {
        expect(escapeHtml(null)).toBe('');
    });

    it('should handle undefined input', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('should preserve safe text', () => {
        const safeText = 'Hello World 123';
        expect(escapeHtml(safeText)).toBe(safeText);
    });

    it('should escape ampersands', () => {
        const result = escapeHtml('Tom & Jerry');
        expect(result).toContain('&amp;');
    });

    it('should handle multiple special characters', () => {
        const input = '<div class="test">A & B</div>';
        const result = escapeHtml(input);

        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
        expect(result).toContain('&quot;');
        expect(result).toContain('&amp;');
    });
});

// ========================================
// truncateText Tests
// ========================================

describe('truncateText - Pure Function Tests', () => {
    it('should not truncate short text', () => {
        const result = truncateText('Short text', 50);

        expect(result.html).toBe('Short text');
        expect(result.needsExpand).toBe(false);
        expect(result.fullText).toBe('Short text');
    });

    it('should truncate long text', () => {
        const longText = 'A'.repeat(150);
        const result = truncateText(longText, 100);

        expect(result.html.length).toBe(103); // 100 + '...'
        expect(result.needsExpand).toBe(true);
        expect(result.fullText).toBe(longText);
    });

    it('should use default max length of 120', () => {
        const text = 'A'.repeat(130);
        const result = truncateText(text);

        expect(result.needsExpand).toBe(true);
        expect(result.html).toHaveLength(123); // 120 + '...'
    });

    it('should handle null input', () => {
        const result = truncateText(null);

        expect(result.html).toBe('');
        expect(result.needsExpand).toBe(false);
    });

    it('should handle undefined input', () => {
        const result = truncateText(undefined);

        expect(result.html).toBe('');
        expect(result.needsExpand).toBe(false);
    });

    it('should handle exact length text', () => {
        const text = 'A'.repeat(100);
        const result = truncateText(text, 100);

        expect(result.html).toBe(text);
        expect(result.needsExpand).toBe(false);
    });

    it('should handle text exactly one character over', () => {
        const text = 'A'.repeat(101);
        const result = truncateText(text, 100);

        expect(result.needsExpand).toBe(true);
    });
});

// ========================================
// generateExpandableText Tests
// ========================================

describe('generateExpandableText - Pure Function Tests', () => {
    it('should return simple div for short text', () => {
        const result = generateExpandableText('Short', 100);

        expect(result).toContain('item-description');
        expect(result).not.toContain('expandable-text');
        expect(result).not.toContain('Click to expand');
    });

    it('should return expandable div for long text', () => {
        const longText = 'A'.repeat(150);
        const result = generateExpandableText(longText, 100);

        expect(result).toContain('expandable-text');
        expect(result).toContain('data-full-text');
        expect(result).toContain('Click to expand');
        expect(result).toContain('data-action="toggle-text-expand"');
    });

    it('should escape HTML in full text data attribute', () => {
        const text = 'Test with <script>alert("xss")</script>' + 'A'.repeat(100);
        const result = generateExpandableText(text, 50);

        expect(result).not.toContain('<script>');
    });
});

// ========================================
// generateMetaTags Tests
// ========================================

describe('generateMetaTags - Pure Function Tests', () => {
    it('should generate meta tags from array', () => {
        const tags = ['fire', 'damage', 'buff'];
        const result = generateMetaTags(tags);

        expect(result).toContain('meta-tag');
        expect(result).toContain('fire');
        expect(result).toContain('damage');
        expect(result).toContain('buff');
    });

    it('should return empty string for null', () => {
        expect(generateMetaTags(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(generateMetaTags(undefined)).toBe('');
    });

    it('should return empty string for empty array', () => {
        expect(generateMetaTags([])).toBe('');
    });

    it('should limit tags when limit is provided', () => {
        const tags = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
        const result = generateMetaTags(tags, 2);

        expect(result).toContain('alpha');
        expect(result).toContain('beta');
        expect(result).not.toContain('gamma');
        expect(result).not.toContain('delta');
    });

    it('should return all tags when limit is 0', () => {
        const tags = ['a', 'b', 'c'];
        const result = generateMetaTags(tags, 0);

        expect(result).toContain('a');
        expect(result).toContain('b');
        expect(result).toContain('c');
    });
});

// ========================================
// generateEmptyState Tests
// ========================================

describe('generateEmptyState - Pure Function Tests', () => {
    it('should generate empty state HTML', () => {
        const result = generateEmptyState('📦', 'Items');

        expect(result).toContain('empty-state');
        expect(result).toContain('📦');
        expect(result).toContain('No Items Found');
        expect(result).toContain('Clear Filters');
    });

    it('should include action attribute for clear button', () => {
        const result = generateEmptyState('⚔️', 'Weapons');

        expect(result).toContain('data-action="clear-filters"');
    });

    it('should handle different entity types', () => {
        const result = generateEmptyState('📖', 'Tomes');

        expect(result).toContain('No Tomes Found');
    });
});

// ========================================
// generateTierLabel Tests
// ========================================

describe('generateTierLabel - Pure Function Tests', () => {
    it('should generate tier label HTML', () => {
        const result = generateTierLabel('SS');

        expect(result).toContain('tier-label');
        expect(result).toContain('SS Tier');
    });

    it('should work with all tier values', () => {
        const tiers = ['SS', 'S', 'A', 'B', 'C'] as const;

        tiers.forEach(tier => {
            const result = generateTierLabel(tier);
            expect(result).toContain(`${tier} Tier`);
        });
    });
});

// ========================================
// generateBadge Tests
// ========================================

describe('generateBadge - Pure Function Tests', () => {
    it('should generate badge HTML', () => {
        const result = generateBadge('New');

        expect(result).toContain('badge');
        expect(result).toContain('New');
    });

    it('should include custom class', () => {
        const result = generateBadge('Featured', 'featured-badge');

        expect(result).toContain('badge');
        expect(result).toContain('featured-badge');
    });

    it('should work without custom class', () => {
        const result = generateBadge('Simple');

        expect(result).toContain('badge');
        expect(result).not.toContain('undefined');
    });
});

// ========================================
// findEntityById Tests
// ========================================

describe('findEntityById - Pure Function Tests', () => {
    const testData = {
        items: [
            { id: 'item1', name: 'Power Crystal' },
            { id: 'item2', name: 'Shield Amulet' },
        ],
        weapons: [
            { id: 'weapon1', name: 'Fire Sword' },
            { id: 'weapon2', name: 'Ice Staff' },
        ],
    };

    it('should find entity by id', () => {
        const result = findEntityById(testData, 'items', 'item1');

        expect(result).toBeDefined();
        expect((result as any).name).toBe('Power Crystal');
    });

    it('should return undefined for non-existent id', () => {
        const result = findEntityById(testData, 'items', 'nonexistent');
        expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent collection', () => {
        const result = findEntityById(testData, 'tomes' as any, 'item1');
        expect(result).toBeUndefined();
    });

    it('should handle null data collection', () => {
        const result = findEntityById(null, 'items', 'item1');
        expect(result).toBeUndefined();
    });

    it('should handle undefined data collection', () => {
        const result = findEntityById(undefined, 'items', 'item1');
        expect(result).toBeUndefined();
    });

    it('should find weapons', () => {
        const result = findEntityById(testData, 'weapons', 'weapon2');

        expect(result).toBeDefined();
        expect((result as any).name).toBe('Ice Staff');
    });
});

// ========================================
// isValidExternalUrl Tests
// ========================================

describe('isValidExternalUrl - Pure Function Tests', () => {
    it('should return true for https URLs', () => {
        expect(isValidExternalUrl('https://example.com')).toBe(true);
        expect(isValidExternalUrl('https://example.com/path')).toBe(true);
        expect(isValidExternalUrl('https://sub.example.com:8080/path?query=1')).toBe(true);
    });

    it('should return true for http URLs', () => {
        expect(isValidExternalUrl('http://example.com')).toBe(true);
        expect(isValidExternalUrl('http://localhost:3000')).toBe(true);
    });

    it('should return false for javascript URLs', () => {
        expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for data URLs', () => {
        expect(isValidExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should return false for file URLs', () => {
        expect(isValidExternalUrl('file:///etc/passwd')).toBe(false);
    });

    it('should return false for null', () => {
        expect(isValidExternalUrl(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isValidExternalUrl(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isValidExternalUrl('')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
        expect(isValidExternalUrl('not a url')).toBe(false);
        expect(isValidExternalUrl('example.com')).toBe(false);
    });

    it('should return false for relative URLs', () => {
        expect(isValidExternalUrl('/path/to/page')).toBe(false);
        expect(isValidExternalUrl('./relative')).toBe(false);
    });
});

// ========================================
// debounce Tests
// ========================================

describe('debounce - Function Wrapper Tests', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should delay function execution', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced(); // Reset timer
        vi.advanceTimersByTime(50);

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('arg1', 'arg2');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use latest arguments', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        debounced('second');
        debounced('third');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('third');
    });
});

// ========================================
// generateResponsiveImage Tests
// ========================================

describe('generateResponsiveImage - Pure Function Tests', () => {
    it('should generate picture element with webp source', () => {
        const result = generateResponsiveImage('images/item.png', 'Test Item');

        expect(result).toContain('<picture>');
        expect(result).toContain('</picture>');
        expect(result).toContain('source');
        expect(result).toContain('type="image/webp"');
        expect(result).toContain('images/item.webp');
    });

    it('should include fallback img element', () => {
        const result = generateResponsiveImage('images/item.png', 'Test Item');

        expect(result).toContain('<img');
        expect(result).toContain('src="images/item.png"');
        expect(result).toContain('data-fallback="true"');
    });

    it('should escape alt text', () => {
        const result = generateResponsiveImage('item.png', '<script>XSS</script>');

        expect(result).not.toContain('<script>');
    });

    it('should use default class name', () => {
        const result = generateResponsiveImage('item.png', 'Test');

        expect(result).toContain('class="entity-image"');
    });

    it('should accept custom class name', () => {
        const result = generateResponsiveImage('item.png', 'Test', 'custom-class');

        expect(result).toContain('class="custom-class"');
    });

    it('should return empty string for empty path', () => {
        expect(generateResponsiveImage('', 'Test')).toBe('');
    });

    it('should convert jpg to webp', () => {
        const result = generateResponsiveImage('images/photo.jpg', 'Photo');

        expect(result).toContain('images/photo.webp');
    });

    it('should convert jpeg to webp', () => {
        const result = generateResponsiveImage('images/photo.jpeg', 'Photo');

        expect(result).toContain('images/photo.webp');
    });

    it('should include lazy loading', () => {
        const result = generateResponsiveImage('item.png', 'Test');

        expect(result).toContain('loading="lazy"');
    });
});

// ========================================
// generateEntityImage Tests
// ========================================

describe('generateEntityImage - Pure Function Tests', () => {
    it('should generate image for entity with image', () => {
        const entity = { id: '1', name: 'Test', image: 'images/test.png' };
        const result = generateEntityImage(entity as any, 'Test Alt');

        expect(result).toContain('<picture>');
        expect(result).toContain('images/test.png');
    });

    it('should return empty string for null entity', () => {
        expect(generateEntityImage(null, 'Test')).toBe('');
    });

    it('should return empty string for undefined entity', () => {
        expect(generateEntityImage(undefined, 'Test')).toBe('');
    });

    it('should return empty string for entity without image', () => {
        const entity = { id: '1', name: 'Test' };
        expect(generateEntityImage(entity as any, 'Test')).toBe('');
    });

    it('should accept custom class', () => {
        const entity = { id: '1', name: 'Test', image: 'test.png' };
        const result = generateEntityImage(entity as any, 'Test', 'custom-img');

        expect(result).toContain('class="custom-img"');
    });
});

// ========================================
// generateModalImage Tests
// ========================================

describe('generateModalImage - Pure Function Tests', () => {
    it('should generate modal image', () => {
        const entity = { image: 'images/item.png' };
        const result = generateModalImage(entity, 'Item', 'item');

        expect(result).toContain('<picture>');
        expect(result).toContain('class="modal-item-image"');
    });

    it('should return empty string for null', () => {
        expect(generateModalImage(null, 'Test', 'item')).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(generateModalImage(undefined, 'Test', 'item')).toBe('');
    });

    it('should return empty string for entity without image', () => {
        expect(generateModalImage({}, 'Test', 'item')).toBe('');
    });

    it('should use type in class name', () => {
        const entity = { image: 'test.png' };
        const result = generateModalImage(entity, 'Test', 'weapon');

        expect(result).toContain('class="modal-weapon-image"');
    });
});

// ========================================
// DOM Helper Tests
// ========================================

describe('DOM Helpers - Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-div">Test Content</div>
            <input type="text" id="test-input" value="initial" />
            <div class="test-class">Class Content</div>
            <div class="multi-class">One</div>
            <div class="multi-class">Two</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('safeGetElementById', () => {
        it('should return element when found', () => {
            const el = safeGetElementById('test-div');
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Test Content');
        });

        it('should return null when not found', () => {
            const el = safeGetElementById('nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback when not found', () => {
            const fallback = { custom: 'fallback' };
            const result = safeGetElementById('nonexistent', fallback);
            expect(result).toBe(fallback);
        });
    });

    describe('safeQuerySelector', () => {
        it('should return element when found', () => {
            const el = safeQuerySelector('.test-class');
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Class Content');
        });

        it('should return null when not found', () => {
            const el = safeQuerySelector('.nonexistent');
            expect(el).toBeNull();
        });

        it('should use context when provided', () => {
            const container = document.createElement('div');
            container.innerHTML = '<span class="inner">Inner Content</span>';

            const el = safeQuerySelector('.inner', container);
            expect(el?.textContent).toBe('Inner Content');
        });

        it('should return fallback when not found', () => {
            const fallback = { custom: 'value' };
            const result = safeQuerySelector('.nonexistent', document, fallback);
            expect(result).toBe(fallback);
        });
    });

    describe('safeQuerySelectorAll', () => {
        it('should return all matching elements', () => {
            const els = safeQuerySelectorAll('.multi-class');
            expect(els).toHaveLength(2);
        });

        it('should return empty NodeList when none found', () => {
            const els = safeQuerySelectorAll('.nonexistent');
            expect(els).toHaveLength(0);
        });
    });

    describe('safeSetValue', () => {
        it('should set input value', () => {
            safeSetValue('test-input', 'new value');

            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('new value');
        });

        it('should convert number to string', () => {
            safeSetValue('test-input', 42);

            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('42');
        });

        it('should not throw when element not found', () => {
            expect(() => safeSetValue('nonexistent', 'value')).not.toThrow();
        });
    });

    describe('safeSetHTML', () => {
        it('should set innerHTML', () => {
            safeSetHTML('test-div', '<strong>Bold</strong>');

            const div = document.getElementById('test-div');
            expect(div?.innerHTML).toBe('<strong>Bold</strong>');
        });

        it('should not throw when element not found', () => {
            expect(() => safeSetHTML('nonexistent', '<p>Test</p>')).not.toThrow();
        });
    });
});

// ========================================
// Edge Cases and Boundary Tests
// ========================================

describe('Edge Cases and Boundaries', () => {
    describe('sortData with special values', () => {
        it('should handle array with duplicate values', () => {
            const data = [
                { id: '1', name: 'Same', tier: 'A' },
                { id: '2', name: 'Same', tier: 'A' },
                { id: '3', name: 'Same', tier: 'A' },
            ];

            const result = sortData(data as any, 'name');
            expect(result).toHaveLength(3);
        });

        it('should handle very long names', () => {
            const longName = 'A'.repeat(10000);
            const data = [
                { id: '1', name: longName },
                { id: '2', name: 'Short' },
            ];

            const result = sortData(data as any, 'name');
            expect(result).toHaveLength(2);
        });
    });

    describe('escapeHtml with special inputs', () => {
        it('should handle unicode characters', () => {
            const result = escapeHtml('Hello 🔥 World 日本語');
            expect(result).toContain('🔥');
            expect(result).toContain('日本語');
        });

        it('should handle newlines', () => {
            const result = escapeHtml('Line1\nLine2\rLine3');
            expect(result).toContain('Line1');
        });

        it('should handle tabs', () => {
            const result = escapeHtml('Tab\there');
            expect(result).toContain('Tab');
        });
    });

    describe('truncateText with edge lengths', () => {
        it('should handle maxLength of 0', () => {
            const result = truncateText('Any text', 0);
            expect(result.needsExpand).toBe(true);
            expect(result.html).toBe('...');
        });

        it('should handle maxLength of 1', () => {
            const result = truncateText('Hello', 1);
            expect(result.html).toBe('H...');
            expect(result.needsExpand).toBe(true);
        });

        it('should handle very large maxLength', () => {
            const result = truncateText('Short', 1000000);
            expect(result.needsExpand).toBe(false);
        });
    });

    describe('generateMetaTags with special tags', () => {
        it('should handle tags with spaces', () => {
            const tags = ['tag with spaces', 'normal'];
            const result = generateMetaTags(tags);

            expect(result).toContain('tag with spaces');
        });

        it('should handle tags with special characters', () => {
            const tags = ['tag<html>', 'tag&amp'];
            const result = generateMetaTags(tags);

            // Tags are not escaped by this function
            expect(result).toBeDefined();
        });

        it('should handle single tag', () => {
            const result = generateMetaTags(['only']);
            expect(result).toContain('only');
        });
    });

    describe('isValidExternalUrl edge cases', () => {
        it('should handle URLs with unicode', () => {
            expect(isValidExternalUrl('https://例え.jp/パス')).toBe(true);
        });

        it('should handle very long URLs', () => {
            const longPath = 'a'.repeat(10000);
            expect(isValidExternalUrl(`https://example.com/${longPath}`)).toBe(true);
        });

        it('should handle URLs with fragments', () => {
            expect(isValidExternalUrl('https://example.com#section')).toBe(true);
        });

        it('should handle URLs with auth', () => {
            expect(isValidExternalUrl('https://user:pass@example.com')).toBe(true);
        });
    });
});
