// ========================================
// Utility Functions Edge Case Tests
// ========================================
// Additional edge case tests for utility functions across modules
// Focus: Error handling, boundary conditions, default parameters
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Import utility functions from various modules
import {
    safeGetElementById,
    safeQuerySelector,
    safeQuerySelectorAll,
    safeSetValue,
    safeSetHTML,
    escapeHtml,
    truncateText,
    sortData,
    findEntityById,
    debounce,
} from '../../src/modules/utils.ts';

import {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
} from '../../src/modules/filters.ts';

import type { Entity, Item } from '../../src/types/index.ts';

describe('Utility Functions - Additional Edge Cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    describe('safeGetElementById - Edge Cases', () => {
        it('should handle empty string ID', () => {
            const result = safeGetElementById('');
            expect(result).toBeNull();
        });

        it('should handle ID with special characters', () => {
            const elem = document.createElement('div');
            elem.id = 'test-id-123_special';
            document.body.appendChild(elem);

            const result = safeGetElementById('test-id-123_special');
            expect(result).toBe(elem);
        });

        it('should return fallback for whitespace-only ID', () => {
            const fallback = document.createElement('div');
            const result = safeGetElementById('   ', fallback);
            expect(result).toBe(fallback);
        });

        it('should handle numeric string ID', () => {
            const elem = document.createElement('div');
            elem.id = '12345';
            document.body.appendChild(elem);

            const result = safeGetElementById('12345');
            expect(result).toBe(elem);
        });
    });

    describe('escapeHtml - Comprehensive Edge Cases', () => {
        it('should handle multiple consecutive special characters', () => {
            const result = escapeHtml('<<>>&&""');
            expect(result).toBe('&lt;&lt;&gt;&gt;&amp;&amp;&quot;&quot;');
        });

        it('should handle mixed content with all special characters', () => {
            const input = 'Test <script>alert("XSS & injection")</script>';
            const result = escapeHtml(input);
            expect(result).toBe('Test &lt;script&gt;alert(&quot;XSS &amp; injection&quot;)&lt;/script&gt;');
        });

        it('should handle very long strings efficiently', () => {
            const longString = '<'.repeat(1000) + '>' + '&'.repeat(1000) + '"'.repeat(1000);
            const result = escapeHtml(longString);
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
        });

        it('should handle unicode characters mixed with HTML', () => {
            const input = '<div>Hello 世界 & "test"</div>';
            const result = escapeHtml(input);
            expect(result).toBe('&lt;div&gt;Hello 世界 &amp; &quot;test&quot;&lt;/div&gt;');
        });

        it('should handle only whitespace', () => {
            const result = escapeHtml('   \n\t  ');
            expect(result).toBe('   \n\t  ');
        });

        it('should handle single character inputs', () => {
            expect(escapeHtml('<')).toBe('&lt;');
            expect(escapeHtml('>')).toBe('&gt;');
            expect(escapeHtml('&')).toBe('&amp;');
            expect(escapeHtml('"')).toBe('&quot;');
        });
    });

    describe('truncateText - Boundary Conditions', () => {
        it('should handle text exactly at maxLength boundary', () => {
            const text = 'a'.repeat(120);
            const result = truncateText(text, 120);
            expect(result.needsExpand).toBe(false);
            expect(result.html).toBe(text);
        });

        it('should handle text one character over maxLength', () => {
            const text = 'a'.repeat(121);
            const result = truncateText(text, 120);
            expect(result.needsExpand).toBe(true);
            expect(result.html).toBe('a'.repeat(120) + '...');
        });

        it('should handle maxLength of 1', () => {
            const result = truncateText('test', 1);
            expect(result.needsExpand).toBe(true);
            expect(result.html).toBe('t...');
        });

        it('should handle maxLength of 0', () => {
            const result = truncateText('test', 0);
            expect(result.needsExpand).toBe(true);
            expect(result.html).toBe('...');
        });

        it('should handle negative maxLength', () => {
            const result = truncateText('test', -5);
            // Negative maxLength means text.length > maxLength, so needsExpand = true
            expect(result.needsExpand).toBe(true);
            expect(result.html).toBe('...');
        });

        it('should handle very large maxLength', () => {
            const text = 'short text';
            const result = truncateText(text, 10000);
            expect(result.needsExpand).toBe(false);
            expect(result.html).toBe(text);
        });

        it('should preserve unicode characters in truncation', () => {
            const text = '世界'.repeat(100); // Chinese characters
            const result = truncateText(text, 50);
            expect(result.needsExpand).toBe(true);
            expect(result.fullText).toBe(text);
        });

        it('should handle text with newlines and tabs', () => {
            const text = 'Line 1\nLine 2\tTabbed\n'.repeat(10);
            const result = truncateText(text, 50);
            expect(result.fullText).toBe(text);
        });
    });

    describe('sortData - Edge Cases', () => {
        const createItem = (name: string, tier: string, rarity: string): Item => ({
            id: name.toLowerCase().replace(/\s/g, '-'),
            name,
            tier: tier as any,
            rarity: rarity as any,
            effects: [],
            image: 'test.webp',
        });

        it('should handle empty array', () => {
            const empty: Entity[] = [];
            const result = sortData(empty, 'name');
            expect(result).toEqual([]);
        });

        it('should handle single item array', () => {
            const single = [createItem('Only Item', 'A', 'common')];
            const result = sortData(single, 'tier');
            expect(result).toEqual(single);
        });

        it('should handle items with identical sort keys', () => {
            const items = [
                createItem('Item 1', 'A', 'common'),
                createItem('Item 2', 'A', 'common'),
                createItem('Item 3', 'A', 'common'),
            ];
            const result = sortData(items, 'tier');
            expect(result).toHaveLength(3);
            // Order should be stable
            expect(result[0].name).toBe('Item 1');
            expect(result[1].name).toBe('Item 2');
            expect(result[2].name).toBe('Item 3');
        });

        it('should handle items with undefined/missing properties', () => {
            const items = [
                { id: '1', name: 'Item 1', tier: 'A' } as any,
                { id: '2', name: 'Item 2' } as any, // Missing tier
                { id: '3', name: 'Item 3', tier: 'B' } as any,
            ];
            const result = sortData(items as Entity[], 'tier');
            expect(result).toHaveLength(3);
        });

        it('should handle items with null names', () => {
            const items = [
                { id: '1', name: null, tier: 'A' } as any,
                { id: '2', name: 'Valid Name', tier: 'B' } as any,
            ];
            const result = sortData(items as Entity[], 'name');
            expect(result).toHaveLength(2);
        });

        it('should sort names case-insensitively', () => {
            const items = [
                createItem('zebra', 'A', 'common'),
                createItem('Apple', 'A', 'common'),
                createItem('BANANA', 'A', 'common'),
            ];
            const result = sortData(items, 'name');
            expect(result[0].name).toBe('Apple');
            expect(result[1].name).toBe('BANANA');
            expect(result[2].name).toBe('zebra');
        });
    });

    describe('findEntityById - Edge Cases', () => {
        it('should handle collection with duplicate IDs', () => {
            const dataCollection = {
                items: [
                    { id: 'item1', name: 'First' },
                    { id: 'item1', name: 'Duplicate' },
                    { id: 'item2', name: 'Second' },
                ],
            };
            // Should return first match
            const result = findEntityById(dataCollection as any, 'items', 'item1');
            expect(result?.name).toBe('First');
        });

        it('should handle ID as number (coercion)', () => {
            const dataCollection = {
                items: [
                    { id: '123', name: 'Item' },
                ],
            };
            const result = findEntityById(dataCollection as any, 'items', '123');
            expect(result?.name).toBe('Item');
        });

        it('should handle empty string ID', () => {
            const dataCollection = {
                items: [
                    { id: 'item1', name: 'Item' },
                ],
            };
            const result = findEntityById(dataCollection as any, 'items', '');
            expect(result).toBeUndefined();
        });

        it('should handle collection with null/undefined IDs', () => {
            const dataCollection = {
                items: [
                    { id: null, name: 'Null ID' },
                    { id: undefined, name: 'Undefined ID' },
                    { id: 'valid', name: 'Valid' },
                ],
            };
            const result = findEntityById(dataCollection as any, 'items', 'valid');
            expect(result?.name).toBe('Valid');
        });

        it('should handle very large collections efficiently', () => {
            const items = Array.from({ length: 10000 }, (_, i) => ({
                id: `item${i}`,
                name: `Item ${i}`,
            }));
            const dataCollection = { items };
            const result = findEntityById(dataCollection as any, 'items', 'item9999');
            expect(result?.name).toBe('Item 9999');
        });
    });

    describe('Search History - localStorage Edge Cases', () => {
        it('should handle localStorage quota exceeded', () => {
            // Mock localStorage to throw quota exceeded error
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new DOMException('QuotaExceededError');
            });

            // Should not throw
            expect(() => addToSearchHistory('test query')).not.toThrow();

            setItemSpy.mockRestore();
        });

        it('should handle corrupted localStorage data', () => {
            // Set invalid JSON
            localStorage.setItem('megabonk_search_history', '{invalid json}');

            // Should return empty array instead of throwing
            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should handle localStorage returning non-array data', () => {
            localStorage.setItem('megabonk_search_history', JSON.stringify({ not: 'an array' }));

            // getSearchHistory returns whatever is in localStorage, may not be array
            const history = getSearchHistory();
            // Just verify it doesn't throw
            expect(history).toBeDefined();
        });

        it('should handle very long search terms', () => {
            const longTerm = 'a'.repeat(10000);
            addToSearchHistory(longTerm);

            const history = getSearchHistory();
            expect(history).toContain(longTerm);
        });

        it('should handle special characters in search terms', () => {
            const specialTerm = '<script>alert("XSS")</script>';
            addToSearchHistory(specialTerm);

            const history = getSearchHistory();
            expect(history).toContain(specialTerm);
        });

        it('should handle unicode search terms', () => {
            const unicodeTerm = '世界 🎮 测试';
            addToSearchHistory(unicodeTerm);

            const history = getSearchHistory();
            expect(history).toContain(unicodeTerm);
        });

        it('should not add whitespace-only terms', () => {
            addToSearchHistory('   \n\t  ');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should not add single character terms', () => {
            addToSearchHistory('a');

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should handle clearing history multiple times', () => {
            addToSearchHistory('test 1');
            addToSearchHistory('test 2');

            clearSearchHistory();
            clearSearchHistory(); // Should not throw

            const history = getSearchHistory();
            expect(history).toEqual([]);
        });

        it('should maintain history order correctly', () => {
            addToSearchHistory('first');
            addToSearchHistory('second');
            addToSearchHistory('third');

            const history = getSearchHistory();
            expect(history[0]).toBe('third');
            expect(history[1]).toBe('second');
            expect(history[2]).toBe('first');
        });

        it('should remove duplicate and re-add to front', () => {
            addToSearchHistory('term1');
            addToSearchHistory('term2');
            addToSearchHistory('term3');
            addToSearchHistory('term1'); // Re-add term1

            const history = getSearchHistory();
            expect(history[0]).toBe('term1');
            // Count occurrences of term1 - should only appear once
            const occurrences = history.filter(t => t === 'term1').length;
            expect(occurrences).toBe(1);
        });

        it('should respect MAX_SEARCH_HISTORY limit', () => {
            // Add 15 terms (limit is 10)
            for (let i = 0; i < 15; i++) {
                addToSearchHistory(`term ${i}`);
            }

            const history = getSearchHistory();
            expect(history.length).toBeLessThanOrEqual(10);
            expect(history[0]).toBe('term 14'); // Most recent
        });
    });

    describe('debounce - Timing Edge Cases', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should handle immediate multiple calls', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced();
            debounced();
            debounced();
            debounced();

            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should handle calls with different arguments', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1');
            debounced('arg2');
            debounced('arg3');

            vi.advanceTimersByTime(100);

            // Should only call with last argument
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('arg3');
        });

        it('should handle zero delay', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 0);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(0);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should handle negative delay (treat as 0)', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, -100);

            debounced();
            vi.advanceTimersByTime(0);

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should handle very large delays', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 1000000);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(999999);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('safeSetValue - Edge Cases', () => {
        it('should handle very large numbers', () => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);

            safeSetValue('test-input', Number.MAX_SAFE_INTEGER);
            expect(input.value).toBe(String(Number.MAX_SAFE_INTEGER));
        });

        it('should handle negative numbers', () => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);

            safeSetValue('test-input', -12345);
            expect(input.value).toBe('-12345');
        });

        it('should handle decimal numbers', () => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);

            safeSetValue('test-input', 3.14159);
            expect(input.value).toBe('3.14159');
        });

        it('should handle NaN', () => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);

            safeSetValue('test-input', NaN);
            expect(input.value).toBe('NaN');
        });

        it('should handle Infinity', () => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);

            safeSetValue('test-input', Infinity);
            expect(input.value).toBe('Infinity');
        });
    });

    describe('safeSetHTML - XSS Protection Edge Cases', () => {
        it('should set HTML without executing scripts', () => {
            const div = document.createElement('div');
            div.id = 'test-div';
            document.body.appendChild(div);

            const htmlWithScript = '<div>Test</div><script>alert("XSS")</script>';
            safeSetHTML('test-div', htmlWithScript);

            // Script should be in HTML but not executed (jsdom doesn't execute scripts)
            expect(div.innerHTML).toContain('Test');
        });

        it('should handle empty HTML', () => {
            const div = document.createElement('div');
            div.id = 'test-div';
            div.innerHTML = 'initial content';
            document.body.appendChild(div);

            safeSetHTML('test-div', '');
            expect(div.innerHTML).toBe('');
        });

        it('should handle very large HTML strings', () => {
            const div = document.createElement('div');
            div.id = 'test-div';
            document.body.appendChild(div);

            const largeHTML = '<div>' + 'content '.repeat(10000) + '</div>';
            safeSetHTML('test-div', largeHTML);

            expect(div.innerHTML).toContain('content');
        });

        it('should handle malformed HTML', () => {
            const div = document.createElement('div');
            div.id = 'test-div';
            document.body.appendChild(div);

            const malformed = '<div><span>Unclosed tags';
            safeSetHTML('test-div', malformed);

            // Browser should auto-close tags
            expect(div.innerHTML).toBeDefined();
        });
    });
});
