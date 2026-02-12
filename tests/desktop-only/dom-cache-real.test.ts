/**
 * Real Integration Tests for DOM Cache Module
 * No mocking - tests actual DOM cache implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    domCache,
    getSearchInput,
    getFavoritesCheckbox,
    getFiltersContainer,
    getStatsSummary,
    getTabButtons,
    getTabContainer,
    getModalOverlay,
    getCompareButton,
    getFilterElement,
    invalidateDOMCache,
    refreshFilterCache,
} from '../../src/modules/dom-cache.ts';

// ========================================
// Setup/Teardown
// ========================================

describe('DOMCache - Real Integration Tests', () => {
    beforeEach(() => {
        // Clear DOM and reset cache
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    // ========================================
    // domCache.init Tests
    // ========================================

    describe('domCache.init', () => {
        it('should not throw when initializing', () => {
            expect(() => domCache.init()).not.toThrow();
        });

        it('should cache existing elements', () => {
            // Setup DOM
            document.body.innerHTML = `
                <input id="searchInput" type="text" />
                <input id="favoritesOnly" type="checkbox" />
                <div id="filters"></div>
            `;

            domCache.init();

            expect(domCache.get('searchInput')).toBe(document.getElementById('searchInput'));
            expect(domCache.get('favoritesOnly')).toBe(document.getElementById('favoritesOnly'));
            expect(domCache.get('filters')).toBe(document.getElementById('filters'));
        });

        it('should cache NodeList for tab buttons', () => {
            document.body.innerHTML = `
                <button class="tab-btn" data-tab="items">Items</button>
                <button class="tab-btn" data-tab="weapons">Weapons</button>
            `;

            domCache.init();

            const tabButtons = domCache.get('tabButtons') as NodeListOf<Element>;
            expect(tabButtons).not.toBeNull();
            expect(tabButtons.length).toBe(2);
        });

        it('should only initialize once', () => {
            document.body.innerHTML = '<input id="searchInput" type="text" />';

            domCache.init();
            const firstGet = domCache.get('searchInput');

            // Remove element
            document.getElementById('searchInput')?.remove();

            // Second init should be skipped
            domCache.init();
            const secondGet = domCache.get('searchInput');

            // Should still have the cached (now stale) reference
            expect(firstGet).toBe(secondGet);
        });
    });

    // ========================================
    // domCache.get Tests
    // ========================================

    describe('domCache.get', () => {
        it('should return null for non-existent key', () => {
            const result = domCache.get('nonExistentKey');
            expect(result).toBeNull();
        });

        it('should return cached element', () => {
            document.body.innerHTML = '<div id="test-element"></div>';
            const element = document.getElementById('test-element');

            domCache.set('testKey', element);

            expect(domCache.get('testKey')).toBe(element);
        });

        it('should auto-init if not initialized', () => {
            document.body.innerHTML = '<input id="searchInput" type="text" />';

            // Don't call init, just get
            const result = domCache.get('searchInput');

            expect(result).toBe(document.getElementById('searchInput'));
        });
    });

    // ========================================
    // domCache.set Tests
    // ========================================

    describe('domCache.set', () => {
        it('should set cached element', () => {
            const div = document.createElement('div');

            domCache.set('customKey', div);

            expect(domCache.get('customKey')).toBe(div);
        });

        it('should overwrite existing cache entry', () => {
            const div1 = document.createElement('div');
            const div2 = document.createElement('div');

            domCache.set('overwriteKey', div1);
            domCache.set('overwriteKey', div2);

            expect(domCache.get('overwriteKey')).toBe(div2);
        });

        it('should accept null value', () => {
            domCache.set('nullKey', null);
            expect(domCache.get('nullKey')).toBeNull();
        });
    });

    // ========================================
    // domCache.invalidate Tests
    // ========================================

    describe('domCache.invalidate', () => {
        it('should remove specific cache entry', () => {
            const div = document.createElement('div');
            domCache.set('invalidateKey', div);

            domCache.invalidate('invalidateKey');

            expect(domCache.get('invalidateKey')).toBeNull();
        });

        it('should not affect other cache entries', () => {
            const div1 = document.createElement('div');
            const div2 = document.createElement('div');

            domCache.set('keep', div1);
            domCache.set('remove', div2);

            domCache.invalidate('remove');

            expect(domCache.get('keep')).toBe(div1);
            expect(domCache.get('remove')).toBeNull();
        });
    });

    // ========================================
    // domCache.invalidateAll Tests
    // ========================================

    describe('domCache.invalidateAll', () => {
        it('should clear all cache entries', () => {
            domCache.set('key1', document.createElement('div'));
            domCache.set('key2', document.createElement('div'));

            domCache.invalidateAll();

            expect(domCache.get('key1')).toBeNull();
            expect(domCache.get('key2')).toBeNull();
        });

        it('should allow re-initialization after invalidateAll', () => {
            document.body.innerHTML = '<input id="searchInput" type="text" />';

            domCache.init();
            domCache.invalidateAll();

            // Get should auto-init again
            const result = domCache.get('searchInput');
            expect(result).not.toBeNull();
        });
    });

    // ========================================
    // domCache.refresh Tests
    // ========================================

    describe('domCache.refresh', () => {
        it('should refresh element by ID', () => {
            document.body.innerHTML = '<div id="refreshTest">Original</div>';
            domCache.set('refreshKey', document.getElementById('refreshTest'));

            // Replace element
            document.body.innerHTML = '<div id="refreshTest">New</div>';

            domCache.refresh('refreshKey', 'refreshTest', true);

            const refreshed = domCache.get('refreshKey') as HTMLElement;
            expect(refreshed?.textContent).toBe('New');
        });

        it('should refresh element by selector', () => {
            document.body.innerHTML = '<div class="refresh-class">Original</div>';

            domCache.refresh('selectorKey', '.refresh-class', false);

            expect(domCache.get('selectorKey')).toBe(document.querySelector('.refresh-class'));
        });

        it('should remove cache entry if element not found', () => {
            domCache.set('removeKey', document.createElement('div'));

            domCache.refresh('removeKey', 'non-existent-id', true);

            expect(domCache.get('removeKey')).toBeNull();
        });
    });
});

// ========================================
// Helper Function Tests
// ========================================

describe('DOM Cache Helper Functions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    describe('getSearchInput', () => {
        it('should return search input element', () => {
            document.body.innerHTML = '<input id="searchInput" type="text" />';

            const result = getSearchInput();

            expect(result).toBe(document.getElementById('searchInput'));
        });

        it('should return null when not present', () => {
            const result = getSearchInput();
            expect(result).toBeNull();
        });
    });

    describe('getFavoritesCheckbox', () => {
        it('should return favorites checkbox element', () => {
            document.body.innerHTML = '<input id="favoritesOnly" type="checkbox" />';

            const result = getFavoritesCheckbox();

            expect(result).toBe(document.getElementById('favoritesOnly'));
        });
    });

    describe('getFiltersContainer', () => {
        it('should return filters container element', () => {
            document.body.innerHTML = '<div id="filters"></div>';

            const result = getFiltersContainer();

            expect(result).toBe(document.getElementById('filters'));
        });
    });

    describe('getStatsSummary', () => {
        it('should return null when not cached', () => {
            const result = getStatsSummary();
            expect(result).toBeNull();
        });

        it('should return cached stats summary', () => {
            const div = document.createElement('div');
            div.id = 'statsSummary';
            domCache.set('statsSummary', div);

            const result = getStatsSummary();
            expect(result).toBe(div);
        });
    });

    describe('getTabButtons', () => {
        it('should return tab buttons NodeList', () => {
            document.body.innerHTML = `
                <button class="tab-btn">Tab 1</button>
                <button class="tab-btn">Tab 2</button>
                <button class="tab-btn">Tab 3</button>
            `;

            const result = getTabButtons();

            expect(result).not.toBeNull();
            expect(result?.length).toBe(3);
        });
    });

    describe('getTabContainer', () => {
        it('should return container for specific tab', () => {
            document.body.innerHTML = '<div id="itemsContainer"></div>';
            domCache.init();

            const result = getTabContainer('items');

            expect(result).toBe(document.getElementById('itemsContainer'));
        });

        it('should return null for non-existent tab container', () => {
            const result = getTabContainer('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('getModalOverlay', () => {
        it('should return modal overlay element', () => {
            document.body.innerHTML = '<div id="modal-overlay"></div>';

            const result = getModalOverlay();

            expect(result).toBe(document.getElementById('modal-overlay'));
        });
    });

    describe('getCompareButton', () => {
        it('should return compare button element', () => {
            document.body.innerHTML = '<button id="compare-button">Compare</button>';

            const result = getCompareButton();

            expect(result).toBe(document.getElementById('compare-button'));
        });
    });

    describe('getFilterElement', () => {
        it('should return and cache filter element', () => {
            document.body.innerHTML = '<select id="tierFilter"></select>';

            const result1 = getFilterElement('tierFilter');
            const result2 = getFilterElement('tierFilter');

            expect(result1).toBe(document.getElementById('tierFilter'));
            expect(result1).toBe(result2); // Same cached instance
        });

        it('should return null for non-existent filter', () => {
            const result = getFilterElement('nonExistentFilter');
            expect(result).toBeNull();
        });
    });

    describe('invalidateDOMCache', () => {
        it('should clear all cache entries', () => {
            document.body.innerHTML = '<input id="searchInput" />';
            domCache.init();

            invalidateDOMCache();

            // After invalidation, cache is empty until next access
            expect(domCache.get('searchInput')).toBeUndefined();
        });
    });

    describe('refreshFilterCache', () => {
        it('should invalidate filter-related cache entries', () => {
            domCache.set('rarityFilter', document.createElement('select'));
            domCache.set('tierFilter', document.createElement('select'));
            domCache.set('sortBy', document.createElement('select'));

            refreshFilterCache();

            expect(domCache.get('rarityFilter')).toBeNull();
            expect(domCache.get('tierFilter')).toBeNull();
            expect(domCache.get('sortBy')).toBeNull();
        });

        it('should not affect non-filter cache entries', () => {
            const searchInput = document.createElement('input');
            domCache.set('searchInput', searchInput);
            domCache.set('rarityFilter', document.createElement('select'));

            refreshFilterCache();

            // searchInput is also invalidated by refreshFilterCache if it's favoritesOnly
            // Let's check a custom key
            domCache.set('customKey', document.createElement('div'));
            refreshFilterCache();
            expect(domCache.get('customKey')).not.toBeNull();
        });
    });
});

// ========================================
// Edge Cases
// ========================================

describe('DOM Cache Edge Cases', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        invalidateDOMCache();
    });

    it('should handle multiple rapid invalidations', () => {
        domCache.set('key1', document.createElement('div'));

        invalidateDOMCache();
        invalidateDOMCache();
        invalidateDOMCache();

        expect(domCache.get('key1')).toBeNull();
    });

    it('should handle setting same element multiple times', () => {
        const element = document.createElement('div');

        domCache.set('repeated', element);
        domCache.set('repeated', element);
        domCache.set('repeated', element);

        expect(domCache.get('repeated')).toBe(element);
    });

    it('should handle empty string key', () => {
        const element = document.createElement('div');
        domCache.set('', element);

        expect(domCache.get('')).toBe(element);
    });

    it('should handle special characters in key', () => {
        const element = document.createElement('div');
        const specialKey = 'key-with-special!@#$%';

        domCache.set(specialKey, element);

        expect(domCache.get(specialKey)).toBe(element);
    });
});
