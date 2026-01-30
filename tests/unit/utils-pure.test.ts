/**
 * @vitest-environment jsdom
 * Utils Module Pure Function Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    safeGetElementById,
    safeQuerySelector,
    safeQuerySelectorAll,
    safeSetValue,
    safeSetHTML,
    escapeHtml,
    truncateText,
    generateTierLabel,
    generateBadge,
    generateMetaTags,
    generateEmptyState,
    sortData,
} from '../../src/modules/utils.ts';
import type { Entity, Tier, Rarity } from '../../src/types/index.ts';

describe('Utils Module', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ========================================
    // safeGetElementById Tests
    // ========================================
    describe('safeGetElementById', () => {
        it('should return element when it exists', () => {
            document.body.innerHTML = '<div id="test-element">Content</div>';
            
            const el = safeGetElementById('test-element');
            
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Content');
        });

        it('should return null when element does not exist', () => {
            const el = safeGetElementById('nonexistent');
            expect(el).toBeNull();
        });

        it('should return fallback when element does not exist', () => {
            const fallback = document.createElement('span');
            const el = safeGetElementById('nonexistent', fallback);
            expect(el).toBe(fallback);
        });

        it('should return element over fallback when exists', () => {
            document.body.innerHTML = '<div id="exists">Real</div>';
            const fallback = document.createElement('span');
            
            const el = safeGetElementById('exists', fallback);
            
            expect(el?.textContent).toBe('Real');
        });
    });

    // ========================================
    // safeQuerySelector Tests
    // ========================================
    describe('safeQuerySelector', () => {
        it('should return element when found', () => {
            document.body.innerHTML = '<div class="target">Found</div>';
            
            const el = safeQuerySelector('.target');
            
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Found');
        });

        it('should return null when not found', () => {
            const el = safeQuerySelector('.nonexistent');
            expect(el).toBeNull();
        });

        it('should search within context element', () => {
            document.body.innerHTML = `
                <div id="container"><span class="inner">Inside</span></div>
                <span class="inner">Outside</span>
            `;
            const container = document.getElementById('container')!;
            
            const el = safeQuerySelector('.inner', container);
            
            expect(el?.textContent).toBe('Inside');
        });

        it('should return fallback when not found', () => {
            const fallback = document.createElement('div');
            const el = safeQuerySelector('.missing', document, fallback);
            expect(el).toBe(fallback);
        });
    });

    // ========================================
    // safeQuerySelectorAll Tests
    // ========================================
    describe('safeQuerySelectorAll', () => {
        it('should return all matching elements', () => {
            document.body.innerHTML = `
                <div class="item">1</div>
                <div class="item">2</div>
                <div class="item">3</div>
            `;
            
            const els = safeQuerySelectorAll('.item');
            
            expect(els.length).toBe(3);
        });

        it('should return empty NodeList when none found', () => {
            const els = safeQuerySelectorAll('.nonexistent');
            expect(els.length).toBe(0);
        });

        it('should search within context', () => {
            document.body.innerHTML = `
                <div id="parent">
                    <span class="child">A</span>
                    <span class="child">B</span>
                </div>
                <span class="child">C</span>
            `;
            const parent = document.getElementById('parent')!;
            
            const els = safeQuerySelectorAll('.child', parent);
            
            expect(els.length).toBe(2);
        });
    });

    // ========================================
    // safeSetValue Tests
    // ========================================
    describe('safeSetValue', () => {
        it('should set value on input element', () => {
            document.body.innerHTML = '<input id="test-input" type="text">';
            
            safeSetValue('test-input', 'new value');
            
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('new value');
        });

        it('should handle numeric values', () => {
            document.body.innerHTML = '<input id="num-input" type="text">';
            
            safeSetValue('num-input', 42);
            
            const input = document.getElementById('num-input') as HTMLInputElement;
            expect(input.value).toBe('42');
        });

        it('should not throw when element does not exist', () => {
            expect(() => safeSetValue('nonexistent', 'value')).not.toThrow();
        });
    });

    // ========================================
    // safeSetHTML Tests
    // ========================================
    describe('safeSetHTML', () => {
        it('should set innerHTML on element', () => {
            document.body.innerHTML = '<div id="target"></div>';
            
            safeSetHTML('target', '<span>New Content</span>');
            
            const el = document.getElementById('target');
            expect(el?.innerHTML).toBe('<span>New Content</span>');
        });

        it('should not throw when element does not exist', () => {
            expect(() => safeSetHTML('nonexistent', '<p>Test</p>')).not.toThrow();
        });
    });

    // ========================================
    // escapeHtml Tests
    // ========================================
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const result = escapeHtml('<script>alert("xss")</script>');
            
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
        });

        it('should escape quotes', () => {
            const result = escapeHtml('test "quoted" text');
            expect(result).toContain('&quot;');
        });

        it('should handle null', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('should handle undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should preserve normal text', () => {
            const result = escapeHtml('Normal text here');
            expect(result).toBe('Normal text here');
        });

        it('should escape ampersand', () => {
            const result = escapeHtml('Tom & Jerry');
            expect(result).toContain('&amp;');
        });
    });

    // ========================================
    // truncateText Tests
    // ========================================
    describe('truncateText', () => {
        it('should not truncate short text', () => {
            const result = truncateText('Short text', 50);
            
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

        it('should use default maxLength of 120', () => {
            const text = 'A'.repeat(150);
            const result = truncateText(text);
            
            expect(result.html.length).toBe(123); // 120 + '...'
        });

        it('should handle null', () => {
            const result = truncateText(null);
            expect(result.html).toBe('');
            expect(result.needsExpand).toBe(false);
        });

        it('should handle undefined', () => {
            const result = truncateText(undefined);
            expect(result.html).toBe('');
        });

        it('should handle exact length text', () => {
            const text = 'A'.repeat(120);
            const result = truncateText(text, 120);
            
            expect(result.needsExpand).toBe(false);
            expect(result.html).toBe(text);
        });

        it('should preserve fullText in result', () => {
            const text = 'A'.repeat(200);
            const result = truncateText(text, 50);
            
            expect(result.fullText).toBe(text);
        });
    });

    // ========================================
    // generateTierLabel Tests
    // ========================================
    describe('generateTierLabel', () => {
        it('should generate SS tier label', () => {
            const html = generateTierLabel('SS');
            expect(html).toContain('SS Tier');
            expect(html).toContain('tier-label');
        });

        it('should generate S tier label', () => {
            const html = generateTierLabel('S');
            expect(html).toContain('S Tier');
        });

        it('should generate A tier label', () => {
            const html = generateTierLabel('A');
            expect(html).toContain('A Tier');
        });

        it('should generate B tier label', () => {
            const html = generateTierLabel('B');
            expect(html).toContain('B Tier');
        });

        it('should generate C tier label', () => {
            const html = generateTierLabel('C');
            expect(html).toContain('C Tier');
        });
    });

    // ========================================
    // generateBadge Tests
    // ========================================
    describe('generateBadge', () => {
        it('should generate badge with text', () => {
            const html = generateBadge('NEW');
            expect(html).toContain('NEW');
            expect(html).toContain('badge');
        });

        it('should include custom class', () => {
            const html = generateBadge('SALE', 'badge-red');
            expect(html).toContain('badge-red');
        });

        it('should handle empty class', () => {
            const html = generateBadge('Text', '');
            expect(html).toContain('<span class="badge ">');
        });
    });

    // ========================================
    // generateMetaTags Tests
    // ========================================
    describe('generateMetaTags', () => {
        it('should generate tags from array', () => {
            const html = generateMetaTags(['tag1', 'tag2', 'tag3']);
            
            expect(html).toContain('tag1');
            expect(html).toContain('tag2');
            expect(html).toContain('tag3');
            expect(html).toContain('meta-tag');
        });

        it('should respect limit', () => {
            const html = generateMetaTags(['alpha', 'beta', 'gamma', 'delta', 'epsilon'], 2);
            
            expect(html).toContain('alpha');
            expect(html).toContain('beta');
            expect(html).not.toContain('gamma');
        });

        it('should handle null', () => {
            expect(generateMetaTags(null)).toBe('');
        });

        it('should handle undefined', () => {
            expect(generateMetaTags(undefined)).toBe('');
        });

        it('should handle empty array', () => {
            expect(generateMetaTags([])).toBe('');
        });

        it('should show all tags when limit is 0', () => {
            const html = generateMetaTags(['a', 'b', 'c'], 0);
            expect(html).toContain('a');
            expect(html).toContain('b');
            expect(html).toContain('c');
        });
    });

    // ========================================
    // generateEmptyState Tests
    // ========================================
    describe('generateEmptyState', () => {
        it('should generate empty state HTML', () => {
            const html = generateEmptyState('🔍', 'Items');
            
            expect(html).toContain('empty-state');
            expect(html).toContain('🔍');
            expect(html).toContain('No Items Found');
        });

        it('should include clear filters button', () => {
            const html = generateEmptyState('📦', 'Weapons');
            expect(html).toContain('Clear Filters');
            expect(html).toContain('data-action="clear-filters"');
        });
    });

    // ========================================
    // sortData Tests
    // ========================================
    describe('sortData', () => {
        const createEntity = (name: string, tier: Tier, rarity: Rarity): Entity => ({
            id: name.toLowerCase(),
            name,
            tier,
            rarity,
            description: '',
        });

        it('should sort by name alphabetically', () => {
            const data = [
                createEntity('Zebra', 'A', 'common'),
                createEntity('Apple', 'A', 'common'),
                createEntity('Mango', 'A', 'common'),
            ];

            const sorted = sortData(data, 'name');

            expect(sorted[0].name).toBe('Apple');
            expect(sorted[1].name).toBe('Mango');
            expect(sorted[2].name).toBe('Zebra');
        });

        it('should sort by tier (SS first)', () => {
            const data = [
                createEntity('Item1', 'C', 'common'),
                createEntity('Item2', 'SS', 'common'),
                createEntity('Item3', 'A', 'common'),
            ];

            const sorted = sortData(data, 'tier');

            expect(sorted[0].tier).toBe('SS');
            expect(sorted[1].tier).toBe('A');
            expect(sorted[2].tier).toBe('C');
        });

        it('should sort by rarity (legendary first)', () => {
            const data = [
                createEntity('Item1', 'A', 'common'),
                createEntity('Item2', 'A', 'legendary'),
                createEntity('Item3', 'A', 'rare'),
            ];

            const sorted = sortData(data, 'rarity');

            expect(sorted[0].rarity).toBe('legendary');
            expect(sorted[1].rarity).toBe('rare');
            expect(sorted[2].rarity).toBe('common');
        });

        it('should handle empty array', () => {
            const sorted = sortData([], 'name');
            expect(sorted).toEqual([]);
        });

        it('should handle single item', () => {
            const data = [createEntity('Solo', 'A', 'rare')];
            const sorted = sortData(data, 'name');
            expect(sorted.length).toBe(1);
        });
    });
});
