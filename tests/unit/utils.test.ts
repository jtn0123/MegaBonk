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
} from '../../src/modules/utils.ts';

describe('utils - DOM helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-element">Test Content</div>
            <div class="test-class">Class Element</div>
            <input id="test-input" value="initial" />
        `;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('safeGetElementById', () => {
        it('should return element if found', () => {
            const el = safeGetElementById('test-element');
            expect(el).toBeTruthy();
            expect(el?.textContent).toBe('Test Content');
        });

        it('should return null if not found', () => {
            const el = safeGetElementById('nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback if provided and not found', () => {
            const fallback = document.createElement('div');
            const el = safeGetElementById('nonexistent', fallback);
            expect(el).toBe(fallback);
        });

        it('should handle empty string id', () => {
            const el = safeGetElementById('');
            expect(el).toBeNull();
        });

        it('should handle special characters in id', () => {
            document.body.innerHTML = '<div id="test:id">Content</div>';
            const el = safeGetElementById('test:id');
            expect(el).toBeTruthy();
        });
    });

    describe('safeQuerySelector', () => {
        it('should return element if found', () => {
            const el = safeQuerySelector('.test-class');
            expect(el).toBeTruthy();
            expect(el?.textContent).toBe('Class Element');
        });

        it('should return null if not found', () => {
            const el = safeQuerySelector('.nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback if provided', () => {
            const fallback = document.createElement('div');
            const el = safeQuerySelector('.nonexistent', document, fallback);
            expect(el).toBe(fallback);
        });

        it('should accept custom context', () => {
            const parent = document.createElement('div');
            parent.innerHTML = '<span class="child">Child</span>';
            document.body.appendChild(parent);

            const el = safeQuerySelector('.child', parent);
            expect(el?.textContent).toBe('Child');
        });

        it('should handle invalid selectors gracefully', () => {
            expect(() => safeQuerySelector('::invalid::')).toThrow();
        });
    });

    describe('safeQuerySelectorAll', () => {
        it('should return NodeList', () => {
            document.body.innerHTML = '<div class="item"></div><div class="item"></div>';
            const els = safeQuerySelectorAll('.item');
            expect(els.length).toBe(2);
        });

        it('should return empty NodeList if not found', () => {
            const els = safeQuerySelectorAll('.nonexistent');
            expect(els.length).toBe(0);
        });

        it('should accept custom context', () => {
            const parent = document.createElement('div');
            parent.innerHTML = '<span class="child"></span><span class="child"></span>';
            document.body.appendChild(parent);

            const els = safeQuerySelectorAll('.child', parent);
            expect(els.length).toBe(2);
        });
    });

    describe('safeSetValue', () => {
        it('should set input value', () => {
            safeSetValue('test-input', 'new value');
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('new value');
        });

        it('should convert number to string', () => {
            safeSetValue('test-input', 123);
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('123');
        });

        it('should handle nonexistent element', () => {
            expect(() => safeSetValue('nonexistent', 'value')).not.toThrow();
        });

        it('should handle empty string value', () => {
            safeSetValue('test-input', '');
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('');
        });
    });

    describe('safeSetHTML', () => {
        it('should set innerHTML', () => {
            safeSetHTML('test-element', '<span>New</span>');
            const el = document.getElementById('test-element');
            expect(el?.innerHTML).toBe('<span>New</span>');
        });

        it('should handle nonexistent element', () => {
            expect(() => safeSetHTML('nonexistent', 'content')).not.toThrow();
        });

        it('should handle empty string', () => {
            safeSetHTML('test-element', '');
            const el = document.getElementById('test-element');
            expect(el?.innerHTML).toBe('');
        });
    });
});

describe('utils - image generation', () => {
    describe('generateResponsiveImage', () => {
        it('should generate picture element with webp and fallback', () => {
            const html = generateResponsiveImage('images/item.png', 'Item Name');
            expect(html).toContain('<picture class="blur-up-container">');
            expect(html).toContain('images/item.webp');
            expect(html).toContain('images/item.png');
            expect(html).toContain('alt="Item Name"');
            expect(html).toContain('type="image/webp"');
        });

        it('should handle jpg images', () => {
            const html = generateResponsiveImage('images/item.jpg', 'Item');
            expect(html).toContain('images/item.webp');
            expect(html).toContain('images/item.jpg');
        });

        it('should use custom class name', () => {
            const html = generateResponsiveImage('image.png', 'Alt', 'custom-class');
            expect(html).toContain('class="custom-class blur-up-image"');
        });

        it('should return empty string for empty path', () => {
            const html = generateResponsiveImage('', 'Alt');
            expect(html).toBe('');
        });

        it('should escape alt text HTML', () => {
            const html = generateResponsiveImage('image.png', '<script>alert("xss")</script>');
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should add lazy loading', () => {
            const html = generateResponsiveImage('image.png', 'Alt');
            expect(html).toContain('loading="lazy"');
        });

        it('should add fallback data attribute', () => {
            const html = generateResponsiveImage('image.png', 'Alt');
            expect(html).toContain('data-fallback="true"');
        });
    });

    describe('setupImageFallbackHandler', () => {
        it('should add error event listener', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            setupImageFallbackHandler();
            expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function), true);
        });
    });

    describe('generateEntityImage', () => {
        it('should generate image for entity with image property', () => {
            const entity = { id: '1', name: 'Item', image: 'images/item.png' };
            const html = generateEntityImage(entity as any, 'Item Name');
            expect(html).toContain('images/item.png');
            expect(html).toContain('alt="Item Name"');
        });

        it('should return empty string for null entity', () => {
            const html = generateEntityImage(null, 'Alt');
            expect(html).toBe('');
        });

        it('should return empty string for undefined entity', () => {
            const html = generateEntityImage(undefined, 'Alt');
            expect(html).toBe('');
        });

        it('should return empty string for entity without image', () => {
            const entity = { id: '1', name: 'Item' };
            const html = generateEntityImage(entity as any, 'Alt');
            expect(html).toBe('');
        });

        it('should use custom class name', () => {
            const entity = { id: '1', name: 'Item', image: 'image.png' };
            const html = generateEntityImage(entity as any, 'Alt', 'custom');
            expect(html).toContain('class="custom blur-up-image"');
        });
    });

    describe('generateModalImage', () => {
        it('should generate modal image', () => {
            const entity = { image: 'images/item.png' };
            const html = generateModalImage(entity, 'Item', 'item');
            expect(html).toContain('images/item.png');
            expect(html).toContain('class="modal-item-image blur-up-image"');
        });

        it('should return empty for null entity', () => {
            const html = generateModalImage(null, 'Alt', 'item');
            expect(html).toBe('');
        });

        it('should return empty for entity without image', () => {
            const html = generateModalImage({}, 'Alt', 'item');
            expect(html).toBe('');
        });

        it('should use type in class name', () => {
            const entity = { image: 'image.png' };
            const html = generateModalImage(entity, 'Alt', 'weapon');
            expect(html).toContain('modal-weapon-image');
        });
    });
});

describe('utils - empty state', () => {
    describe('generateEmptyState', () => {
        it('should generate empty state HTML', () => {
            const html = generateEmptyState('🔍', 'items');
            expect(html).toContain('empty-state');
            expect(html).toContain('🔍');
            expect(html).toContain('No items Found');
            expect(html).toContain('Clear Filters');
        });

        it('should handle different entity types', () => {
            const html = generateEmptyState('⚔️', 'weapons');
            expect(html).toContain('No weapons Found');
        });

        it('should include action button', () => {
            const html = generateEmptyState('📖', 'tomes');
            expect(html).toContain('data-action="clear-filters"');
        });
    });
});

describe('utils - sorting', () => {
    describe('sortData', () => {
        it('should sort by name alphabetically', () => {
            const data = [
                { name: 'Zebra', tier: 'A' as const },
                { name: 'Apple', tier: 'B' as const },
                { name: 'Mango', tier: 'S' as const },
            ];
            const sorted = sortData(data as any, 'name');
            expect(sorted[0].name).toBe('Apple');
            expect(sorted[1].name).toBe('Mango');
            expect(sorted[2].name).toBe('Zebra');
        });

        it('should sort by tier', () => {
            const data = [
                { name: 'Item1', tier: 'C' as const },
                { name: 'Item2', tier: 'SS' as const },
                { name: 'Item3', tier: 'A' as const },
            ];
            const sorted = sortData(data as any, 'tier');
            expect(sorted[0].tier).toBe('SS');
            expect(sorted[1].tier).toBe('A');
            expect(sorted[2].tier).toBe('C');
        });

        it('should sort by rarity', () => {
            const data = [
                { name: 'Item1', rarity: 'common' as const },
                { name: 'Item2', rarity: 'legendary' as const },
                { name: 'Item3', rarity: 'rare' as const },
            ];
            const sorted = sortData(data as any, 'rarity');
            expect(sorted[0].rarity).toBe('legendary');
            expect(sorted[1].rarity).toBe('rare');
            expect(sorted[2].rarity).toBe('common');
        });

        it('should handle missing properties', () => {
            const data = [
                { name: 'Item1' },
                { name: 'Item2', tier: 'A' as const },
                { name: 'Item3' },
            ];
            expect(() => sortData(data as any, 'tier')).not.toThrow();
        });

        it('should handle empty array', () => {
            const data: any[] = [];
            const sorted = sortData(data, 'name');
            expect(sorted.length).toBe(0);
        });

        it('should return same array for invalid sortBy', () => {
            const data = [{ name: 'Item' }];
            const sorted = sortData(data as any, 'invalid' as any);
            expect(sorted).toBe(data);
        });

        it('should handle case-insensitive name sorting', () => {
            const data = [
                { name: 'zebra' },
                { name: 'Apple' },
                { name: 'MANGO' },
            ];
            const sorted = sortData(data as any, 'name');
            expect(sorted[0].name).toBe('Apple');
        });
    });
});

describe('utils - text', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const escaped = escapeHtml('<script>alert("xss")</script>');
            expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should escape quotes', () => {
            const escaped = escapeHtml('He said "hello"');
            expect(escaped).toContain('&quot;');
        });

        it('should return empty string for null', () => {
            const escaped = escapeHtml(null);
            expect(escaped).toBe('');
        });

        it('should return empty string for undefined', () => {
            const escaped = escapeHtml(undefined);
            expect(escaped).toBe('');
        });

        it('should handle empty string', () => {
            const escaped = escapeHtml('');
            expect(escaped).toBe('');
        });

        it('should escape ampersands', () => {
            const escaped = escapeHtml('Tom & Jerry');
            expect(escaped).toContain('&amp;');
        });

        it('should handle already escaped text', () => {
            const escaped = escapeHtml('&lt;div&gt;');
            // Double-escaping is correct for XSS prevention
            expect(escaped).toContain('&amp;lt;');
        });
    });

    describe('truncateText', () => {
        it('should not truncate short text', () => {
            const result = truncateText('Short text', 100);
            expect(result.html).toBe('Short text');
            expect(result.needsExpand).toBe(false);
            expect(result.fullText).toBe('Short text');
        });

        it('should truncate long text', () => {
            const longText = 'a'.repeat(200);
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

        it('should respect custom maxLength', () => {
            const result = truncateText('Hello World', 5);
            expect(result.html).toBe('Hello...');
            expect(result.needsExpand).toBe(true);
        });

        it('should handle text exactly at maxLength', () => {
            const text = 'a'.repeat(100);
            const result = truncateText(text, 100);
            expect(result.needsExpand).toBe(false);
        });
    });

    describe('generateExpandableText', () => {
        it('should generate non-expandable for short text', () => {
            const html = generateExpandableText('Short', 100);
            expect(html).toContain('item-description');
            expect(html).not.toContain('expandable-text');
            expect(html).not.toContain('Click to expand');
        });

        it('should generate expandable for long text', () => {
            const longText = 'a'.repeat(200);
            const html = generateExpandableText(longText, 100);
            expect(html).toContain('expandable-text');
            expect(html).toContain('Click to expand');
            expect(html).toContain('data-full-text');
            expect(html).toContain('data-truncated="true"');
        });

        it('should escape full text in data attribute', () => {
            const text = '<script>' + 'a'.repeat(200);
            const html = generateExpandableText(text, 100);
            expect(html).toContain('data-full-text');
            expect(html).not.toContain('<script>');
        });

        it('should include toggle action', () => {
            const longText = 'a'.repeat(200);
            const html = generateExpandableText(longText, 100);
            expect(html).toContain('data-action="toggle-text-expand"');
        });
    });
});
