/**
 * Comprehensive tests for utils.ts module
 * Tests DOM helpers, sorting, text utilities, and more
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    safeGetElementById,
    safeQuerySelector,
    safeQuerySelectorAll,
    safeSetValue,
    safeSetHTML,
    generateResponsiveImage,
    setupImageFallbackHandler,
    generateEntityImage,
    generateModalImage,
    generateEmptyState,
    sortData,
    escapeHtml,
    truncateText,
    generateExpandableText,
    generateTierLabel,
    generateBadge,
    generateMetaTags,
    findEntityById,
    isValidExternalUrl,
    debounce,
} from '../../src/modules/utils.ts';

describe('utils - DOM Helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-element">Test Content</div>
            <input id="test-input" value="initial" />
            <div class="test-class">Class 1</div>
            <div class="test-class">Class 2</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('safeGetElementById', () => {
        it('should return element when it exists', () => {
            const el = safeGetElementById('test-element');
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Test Content');
        });

        it('should return null when element does not exist', () => {
            const el = safeGetElementById('nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback when element does not exist', () => {
            const fallback = document.createElement('div');
            const el = safeGetElementById('nonexistent', fallback);
            expect(el).toBe(fallback);
        });
    });

    describe('safeQuerySelector', () => {
        it('should return element when it exists', () => {
            const el = safeQuerySelector('.test-class');
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Class 1');
        });

        it('should return null when element does not exist', () => {
            const el = safeQuerySelector('.nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback when element does not exist', () => {
            const fallback = document.createElement('div');
            const el = safeQuerySelector('.nonexistent', document, fallback);
            expect(el).toBe(fallback);
        });

        it('should search within context', () => {
            document.body.innerHTML = `
                <div id="container"><span class="inner">Inner</span></div>
                <span class="inner">Outer</span>
            `;
            const container = document.getElementById('container')!;
            const el = safeQuerySelector('.inner', container);
            expect(el?.textContent).toBe('Inner');
        });
    });

    describe('safeQuerySelectorAll', () => {
        it('should return all matching elements', () => {
            const els = safeQuerySelectorAll('.test-class');
            expect(els.length).toBe(2);
        });

        it('should return empty NodeList when no matches', () => {
            const els = safeQuerySelectorAll('.nonexistent');
            expect(els.length).toBe(0);
        });

        it('should search within context', () => {
            document.body.innerHTML = `
                <div id="container"><span class="inner">1</span><span class="inner">2</span></div>
                <span class="inner">3</span>
            `;
            const container = document.getElementById('container')!;
            const els = safeQuerySelectorAll('.inner', container);
            expect(els.length).toBe(2);
        });
    });

    describe('safeSetValue', () => {
        it('should set value on input element', () => {
            safeSetValue('test-input', 'new value');
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('new value');
        });

        it('should handle number values', () => {
            safeSetValue('test-input', 42);
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('42');
        });

        it('should not throw for nonexistent element', () => {
            expect(() => safeSetValue('nonexistent', 'value')).not.toThrow();
        });
    });

    describe('safeSetHTML', () => {
        it('should set innerHTML on element', () => {
            safeSetHTML('test-element', '<strong>Bold</strong>');
            const el = document.getElementById('test-element');
            expect(el?.innerHTML).toBe('<strong>Bold</strong>');
        });

        it('should not throw for nonexistent element', () => {
            expect(() => safeSetHTML('nonexistent', '<p>Content</p>')).not.toThrow();
        });
    });
});

describe('utils - Image Generation', () => {
    describe('generateResponsiveImage', () => {
        it('should generate picture element with webp source', () => {
            const html = generateResponsiveImage('images/item.png', 'Test Item');
            expect(html).toContain('<picture>');
            expect(html).toContain('images/item.webp');
            expect(html).toContain('type="image/webp"');
        });

        it('should include original image as fallback', () => {
            const html = generateResponsiveImage('images/item.png', 'Test Item');
            expect(html).toContain('src="images/item.png"');
        });

        it('should escape alt text', () => {
            const html = generateResponsiveImage('img.png', 'Item "with" <quotes>');
            expect(html).toContain('alt="Item &quot;with&quot;');
        });

        it('should use custom class name', () => {
            const html = generateResponsiveImage('img.png', 'Test', 'custom-class');
            expect(html).toContain('class="custom-class"');
        });

        it('should return empty string for empty path', () => {
            const html = generateResponsiveImage('', 'Test');
            expect(html).toBe('');
        });

        it('should handle jpg files', () => {
            const html = generateResponsiveImage('images/item.jpg', 'Test');
            expect(html).toContain('images/item.webp');
        });

        it('should handle jpeg files', () => {
            const html = generateResponsiveImage('images/item.jpeg', 'Test');
            expect(html).toContain('images/item.webp');
        });

        it('should include lazy loading attribute', () => {
            const html = generateResponsiveImage('img.png', 'Test');
            expect(html).toContain('loading="lazy"');
        });

        it('should include data-fallback attribute', () => {
            const html = generateResponsiveImage('img.png', 'Test');
            expect(html).toContain('data-fallback="true"');
        });
    });

    describe('setupImageFallbackHandler', () => {
        it('should add event listener for image errors', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            setupImageFallbackHandler();
            expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function), true);
            addEventListenerSpy.mockRestore();
        });

        it('should add error event listener in capture phase', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            setupImageFallbackHandler();

            // Verify it's called with capture: true (third argument)
            expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function), true);
            addEventListenerSpy.mockRestore();
        });
    });

    describe('generateEntityImage', () => {
        it('should generate image for entity with image', () => {
            const entity = { id: 'test', name: 'Test', image: 'img.png' } as any;
            const html = generateEntityImage(entity, 'Test Entity');
            expect(html).toContain('<picture>');
            expect(html).toContain('img.png');
        });

        it('should return empty string for null entity', () => {
            const html = generateEntityImage(null, 'Test');
            expect(html).toBe('');
        });

        it('should return empty string for entity without image', () => {
            const entity = { id: 'test', name: 'Test' } as any;
            const html = generateEntityImage(entity, 'Test');
            expect(html).toBe('');
        });

        it('should use custom class name', () => {
            const entity = { id: 'test', name: 'Test', image: 'img.png' } as any;
            const html = generateEntityImage(entity, 'Test', 'custom-class');
            expect(html).toContain('class="custom-class"');
        });
    });

    describe('generateModalImage', () => {
        it('should generate image with modal-type class', () => {
            const entity = { image: 'img.png' };
            const html = generateModalImage(entity, 'Test', 'item');
            expect(html).toContain('class="modal-item-image"');
        });

        it('should return empty string for null entity', () => {
            const html = generateModalImage(null, 'Test', 'item');
            expect(html).toBe('');
        });

        it('should return empty string for entity without image', () => {
            const entity = {};
            const html = generateModalImage(entity, 'Test', 'item');
            expect(html).toBe('');
        });
    });
});

describe('utils - Empty State', () => {
    describe('generateEmptyState', () => {
        it('should generate empty state HTML', () => {
            const html = generateEmptyState('🔍', 'Items');
            expect(html).toContain('empty-state');
            expect(html).toContain('🔍');
            expect(html).toContain('No Items Found');
        });

        it('should include clear filters button', () => {
            const html = generateEmptyState('📦', 'Weapons');
            expect(html).toContain('data-action="clear-filters"');
            expect(html).toContain('Clear Filters');
        });
    });
});

describe('utils - Sorting', () => {
    describe('sortData', () => {
        const testData = [
            { id: '1', name: 'Zebra', tier: 'B', rarity: 'common' },
            { id: '2', name: 'Alpha', tier: 'S', rarity: 'legendary' },
            { id: '3', name: 'Middle', tier: 'A', rarity: 'rare' },
        ] as any[];

        it('should sort by name alphabetically', () => {
            const sorted = sortData([...testData], 'name');
            expect(sorted[0].name).toBe('Alpha');
            expect(sorted[1].name).toBe('Middle');
            expect(sorted[2].name).toBe('Zebra');
        });

        it('should sort by tier (SS > S > A > B > C)', () => {
            const sorted = sortData([...testData], 'tier');
            expect(sorted[0].tier).toBe('S');
            expect(sorted[1].tier).toBe('A');
            expect(sorted[2].tier).toBe('B');
        });

        it('should sort by rarity (legendary > epic > rare > uncommon > common)', () => {
            const sorted = sortData([...testData], 'rarity');
            expect(sorted[0].rarity).toBe('legendary');
            expect(sorted[1].rarity).toBe('rare');
            expect(sorted[2].rarity).toBe('common');
        });

        it('should handle items without name property', () => {
            const data = [{ id: '1' }, { id: '2', name: 'Test' }] as any[];
            const sorted = sortData(data, 'name');
            expect(sorted[0].id).toBe('1'); // Empty string sorts first
            expect(sorted[1].name).toBe('Test');
        });

        it('should handle items without tier property', () => {
            const data = [{ id: '1' }, { id: '2', tier: 'S' }] as any[];
            const sorted = sortData(data, 'tier');
            expect(sorted[0].tier).toBe('S');
            expect(sorted[1].id).toBe('1'); // Unknown tier sorts last
        });

        it('should handle items without rarity property', () => {
            const data = [{ id: '1' }, { id: '2', rarity: 'legendary' }] as any[];
            const sorted = sortData(data, 'rarity');
            expect(sorted[0].rarity).toBe('legendary');
            expect(sorted[1].id).toBe('1'); // Unknown rarity sorts last
        });

        it('should return original array for unknown sort type', () => {
            const data = [...testData];
            const sorted = sortData(data, 'unknown' as any);
            expect(sorted).toBe(data);
        });
    });
});

describe('utils - Text Utilities', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const result = escapeHtml('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
        });

        it('should escape quotes', () => {
            const result = escapeHtml('Item "with" quotes');
            expect(result).toContain('&quot;');
        });

        it('should return empty string for null', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });
    });

    describe('truncateText', () => {
        it('should not truncate short text', () => {
            const result = truncateText('Short text', 100);
            expect(result.html).toBe('Short text');
            expect(result.needsExpand).toBe(false);
        });

        it('should truncate long text', () => {
            const longText = 'A'.repeat(200);
            const result = truncateText(longText, 100);
            expect(result.html.length).toBe(103); // 100 + '...'
            expect(result.needsExpand).toBe(true);
            expect(result.fullText).toBe(longText);
        });

        it('should handle null text', () => {
            const result = truncateText(null);
            expect(result.html).toBe('');
            expect(result.needsExpand).toBe(false);
        });

        it('should handle undefined text', () => {
            const result = truncateText(undefined);
            expect(result.html).toBe('');
            expect(result.needsExpand).toBe(false);
        });

        it('should use default maxLength of 120', () => {
            const text = 'A'.repeat(121);
            const result = truncateText(text);
            expect(result.needsExpand).toBe(true);
        });

        it('should not truncate text at exact maxLength', () => {
            const text = 'A'.repeat(120);
            const result = truncateText(text);
            expect(result.needsExpand).toBe(false);
        });
    });

    describe('generateExpandableText', () => {
        it('should generate non-expandable div for short text', () => {
            const html = generateExpandableText('Short text', 100);
            expect(html).toContain('item-description');
            expect(html).not.toContain('expandable-text');
            expect(html).not.toContain('expand-indicator');
        });

        it('should generate expandable div for long text', () => {
            const longText = 'A'.repeat(200);
            const html = generateExpandableText(longText, 100);
            expect(html).toContain('expandable-text');
            expect(html).toContain('data-truncated="true"');
            expect(html).toContain('expand-indicator');
            expect(html).toContain('Click to expand');
        });

        it('should include full text in data attribute', () => {
            const longText = 'A'.repeat(200);
            const html = generateExpandableText(longText, 100);
            expect(html).toContain('data-full-text');
        });

        it('should include action attribute', () => {
            const longText = 'A'.repeat(200);
            const html = generateExpandableText(longText, 100);
            expect(html).toContain('data-action="toggle-text-expand"');
        });
    });
});

describe('utils - Badge Generation', () => {
    describe('generateTierLabel', () => {
        it('should generate tier label HTML', () => {
            const html = generateTierLabel('S');
            expect(html).toBe('<span class="tier-label">S Tier</span>');
        });

        it('should work with all tier values', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'] as const;
            tiers.forEach(tier => {
                const html = generateTierLabel(tier);
                expect(html).toContain(`${tier} Tier`);
            });
        });
    });

    describe('generateBadge', () => {
        it('should generate badge HTML', () => {
            const html = generateBadge('New');
            expect(html).toBe('<span class="badge ">New</span>');
        });

        it('should include custom class', () => {
            const html = generateBadge('Featured', 'badge-featured');
            expect(html).toBe('<span class="badge badge-featured">Featured</span>');
        });
    });

    describe('generateMetaTags', () => {
        it('should generate meta tags from array', () => {
            const html = generateMetaTags(['tag1', 'tag2']);
            expect(html).toContain('<span class="meta-tag">tag1</span>');
            expect(html).toContain('<span class="meta-tag">tag2</span>');
        });

        it('should return empty string for null', () => {
            const html = generateMetaTags(null);
            expect(html).toBe('');
        });

        it('should return empty string for empty array', () => {
            const html = generateMetaTags([]);
            expect(html).toBe('');
        });

        it('should limit tags when limit is specified', () => {
            const html = generateMetaTags(['a', 'b', 'c', 'd'], 2);
            expect(html).toContain('meta-tag">a</span>');
            expect(html).toContain('meta-tag">b</span>');
            expect(html).not.toContain('meta-tag">c</span>');
        });

        it('should show all tags when limit is 0', () => {
            const html = generateMetaTags(['a', 'b', 'c'], 0);
            expect(html).toContain('meta-tag">c</span>');
        });
    });
});

describe('utils - Data Lookup', () => {
    describe('findEntityById', () => {
        const mockData = {
            items: [
                { id: 'item1', name: 'Item 1' },
                { id: 'item2', name: 'Item 2' },
            ],
            weapons: [
                { id: 'weapon1', name: 'Weapon 1' },
            ],
        };

        it('should find entity by ID', () => {
            const entity = findEntityById(mockData, 'items', 'item1');
            expect(entity?.name).toBe('Item 1');
        });

        it('should return undefined for nonexistent ID', () => {
            const entity = findEntityById(mockData, 'items', 'nonexistent');
            expect(entity).toBeUndefined();
        });

        it('should return undefined for nonexistent key', () => {
            const entity = findEntityById(mockData, 'tomes' as any, 'tome1');
            expect(entity).toBeUndefined();
        });

        it('should handle null data collection', () => {
            const entity = findEntityById(null, 'items', 'item1');
            expect(entity).toBeUndefined();
        });

        it('should handle undefined data collection', () => {
            const entity = findEntityById(undefined, 'items', 'item1');
            expect(entity).toBeUndefined();
        });
    });
});

describe('utils - URL Validation', () => {
    describe('isValidExternalUrl', () => {
        it('should return true for valid https URL', () => {
            expect(isValidExternalUrl('https://example.com')).toBe(true);
        });

        it('should return true for valid http URL', () => {
            expect(isValidExternalUrl('http://example.com')).toBe(true);
        });

        it('should return false for javascript URL', () => {
            expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
        });

        it('should return false for data URL', () => {
            expect(isValidExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
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

        it('should return false for invalid URL', () => {
            expect(isValidExternalUrl('not a url')).toBe(false);
        });

        it('should return false for file URL', () => {
            expect(isValidExternalUrl('file:///etc/passwd')).toBe(false);
        });

        it('should return false for ftp URL', () => {
            expect(isValidExternalUrl('ftp://example.com')).toBe(false);
        });
    });
});

describe('utils - Performance Utilities', () => {
    describe('debounce', () => {
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

        it('should reset delay on subsequent calls', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            vi.advanceTimersByTime(50);
            debounced();
            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to function', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1', 'arg2');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should preserve this context', () => {
            const obj = {
                value: 42,
                fn: vi.fn(function(this: { value: number }) {
                    return this.value;
                }),
            };
            const debounced = debounce(obj.fn, 100);

            debounced.call(obj);
            vi.advanceTimersByTime(100);

            expect(obj.fn).toHaveBeenCalled();
        });

        it('should only execute last call in rapid succession', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced(1);
            debounced(2);
            debounced(3);

            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(3);
        });
    });
});
