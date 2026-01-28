import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    domCache,
    getSearchInput,
    getFavoritesCheckbox,
    getFiltersContainer,
    getItemCount,
    getTabButtons,
    getTabContainer,
    getModalOverlay,
    getCompareButton,
    getFilterElement,
    invalidateDOMCache,
    refreshFilterCache,
} from '../../src/modules/dom-cache.ts';

describe('DOM Cache Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Reset cache state between tests
        domCache.invalidateAll();
    });

    describe('domCache class', () => {
        describe('init()', () => {
            it('should initialize cache with common elements', () => {
                domCache.init();

                // Should be able to get cached elements
                const searchInput = domCache.get('searchInput');
                expect(searchInput).not.toBeNull();
            });

            it('should not reinitialize if already initialized', () => {
                domCache.init();
                const firstGet = domCache.get('searchInput');

                // Modify DOM
                const newInput = document.createElement('input');
                newInput.id = 'searchInput';
                document.getElementById('searchInput').replaceWith(newInput);

                domCache.init(); // Should not reinitialize
                const secondGet = domCache.get('searchInput');

                // Should still return original cached element (since init didn't re-run)
                expect(secondGet).toBe(firstGet);
            });
        });

        describe('get()', () => {
            it('should return cached element by key', () => {
                domCache.init();
                const element = domCache.get('searchInput');

                expect(element).toBe(document.getElementById('searchInput'));
            });

            it('should return null for uncached key', () => {
                domCache.init();
                const element = domCache.get('nonexistent');

                expect(element).toBeNull();
            });

            it('should auto-initialize if not initialized', () => {
                // Don't call init()
                const element = domCache.get('searchInput');

                expect(element).not.toBeNull();
            });
        });

        describe('set()', () => {
            it('should set custom cached element', () => {
                const customElement = document.createElement('div');
                customElement.id = 'custom';

                domCache.set('customKey', customElement);

                expect(domCache.get('customKey')).toBe(customElement);
            });

            it('should overwrite existing cached element', () => {
                domCache.init();
                const newElement = document.createElement('input');

                domCache.set('searchInput', newElement);

                expect(domCache.get('searchInput')).toBe(newElement);
            });
        });

        describe('invalidate()', () => {
            it('should remove specific cache entry', () => {
                domCache.init();
                const originalElement = domCache.get('searchInput');
                expect(originalElement).not.toBeNull();

                domCache.invalidate('searchInput');

                // After invalidate, get() should return null (not re-query since init already ran)
                expect(domCache.get('searchInput')).toBeNull();
            });

            it('should not affect other cache entries', () => {
                domCache.init();
                domCache.invalidate('searchInput');

                // Other entries should still be cached
                expect(domCache.get('filters')).not.toBeNull();
            });
        });

        describe('invalidateAll()', () => {
            it('should clear all cache entries', () => {
                domCache.init();

                domCache.invalidateAll();

                // Cache should re-initialize on next get
                const element = domCache.get('searchInput');
                expect(element).not.toBeNull(); // Re-initializes automatically
            });

            it('should reset initialized state', () => {
                domCache.init();

                // Modify DOM
                const newInput = document.createElement('input');
                newInput.id = 'searchInput-new';
                document.getElementById('searchInput').id = 'searchInput-new';

                domCache.invalidateAll();

                // Now get should pick up new element
                const element = domCache.get('searchInput');
                expect(element).toBeNull(); // Original searchInput doesn't exist anymore
            });
        });

        describe('refresh()', () => {
            it('should refresh specific element by ID', () => {
                domCache.init();

                // Create a new element
                const newElement = document.createElement('div');
                newElement.id = 'newElement';
                document.body.appendChild(newElement);

                domCache.refresh('newElementKey', 'newElement', true);

                expect(domCache.get('newElementKey')).toBe(newElement);
            });

            it('should refresh by CSS selector when isId is false', () => {
                domCache.init();

                domCache.refresh('firstTabBtn', '.tab-btn', false);

                const element = domCache.get('firstTabBtn');
                expect(element).not.toBeNull();
                expect(element.classList.contains('tab-btn')).toBe(true);
            });

            it('should delete cache entry if element not found', () => {
                domCache.set('tempKey', document.createElement('div'));
                expect(domCache.get('tempKey')).not.toBeNull();

                domCache.refresh('tempKey', 'nonexistent-id');

                expect(domCache.get('tempKey')).toBeNull();
            });
        });
    });

    describe('Helper functions', () => {
        beforeEach(() => {
            domCache.invalidateAll();
        });

        describe('getSearchInput()', () => {
            it('should return search input element', () => {
                const element = getSearchInput();
                expect(element).toBe(document.getElementById('searchInput'));
            });
        });

        describe('getFavoritesCheckbox()', () => {
            it('should return favorites checkbox element', () => {
                // Add favorites checkbox to DOM if not present
                const filtersContainer = document.getElementById('filters');
                filtersContainer.innerHTML = '<input type="checkbox" id="favoritesOnly" />';

                domCache.invalidateAll();
                const element = getFavoritesCheckbox();
                expect(element).toBe(document.getElementById('favoritesOnly'));
            });

            it('should return null when element not in DOM', () => {
                domCache.invalidateAll();
                const element = getFavoritesCheckbox();
                expect(element).toBeNull();
            });
        });

        describe('getFiltersContainer()', () => {
            it('should return filters container', () => {
                const element = getFiltersContainer();
                expect(element).toBe(document.getElementById('filters'));
            });
        });

        describe('getItemCount()', () => {
            it('should return item count element', () => {
                const element = getItemCount();
                expect(element).toBe(document.getElementById('item-count'));
            });
        });

        describe('getTabButtons()', () => {
            it('should return NodeList of tab buttons', () => {
                const elements = getTabButtons();
                expect(elements).not.toBeNull();
                expect(elements.length).toBeGreaterThan(0);
            });

            it('should return all tab buttons', () => {
                const elements = getTabButtons();
                const directQuery = document.querySelectorAll('.tab-btn');
                expect(elements.length).toBe(directQuery.length);
            });
        });

        describe('getTabContainer()', () => {
            it('should return container for items tab', () => {
                const element = getTabContainer('items');
                expect(element).toBe(document.getElementById('itemsContainer'));
            });

            it('should return container for weapons tab', () => {
                const element = getTabContainer('weapons');
                expect(element).toBe(document.getElementById('weaponsContainer'));
            });

            it('should return null for unknown tab', () => {
                const element = getTabContainer('unknown');
                expect(element).toBeNull();
            });
        });

        describe('getModalOverlay()', () => {
            it('should return null when overlay not in DOM', () => {
                const element = getModalOverlay();
                expect(element).toBeNull();
            });

            it('should return overlay when present', () => {
                const overlay = document.createElement('div');
                overlay.id = 'modal-overlay';
                document.body.appendChild(overlay);

                domCache.invalidateAll();
                const element = getModalOverlay();
                expect(element).toBe(overlay);
            });
        });

        describe('getCompareButton()', () => {
            it('should return null when button not in DOM', () => {
                const element = getCompareButton();
                expect(element).toBeNull();
            });

            it('should return button when present', () => {
                const button = document.createElement('button');
                button.id = 'compare-button';
                document.body.appendChild(button);

                domCache.invalidateAll();
                const element = getCompareButton();
                expect(element).toBe(button);
            });
        });

        describe('getFilterElement()', () => {
            it('should return and cache filter element', () => {
                // Add filter element
                const filtersContainer = document.getElementById('filters');
                filtersContainer.innerHTML = '<select id="tierFilter"></select>';

                const element1 = getFilterElement('tierFilter');
                const element2 = getFilterElement('tierFilter');

                expect(element1).toBe(document.getElementById('tierFilter'));
                expect(element1).toBe(element2); // Same cached reference
            });

            it('should return null for non-existent filter', () => {
                const element = getFilterElement('nonexistentFilter');
                expect(element).toBeNull();
            });
        });
    });

    describe('Cache management functions', () => {
        describe('invalidateDOMCache()', () => {
            it('should invalidate entire cache', () => {
                domCache.init();
                const original = domCache.get('searchInput');
                expect(original).not.toBeNull();

                invalidateDOMCache();

                // Cache should re-initialize on next access
                const refreshed = domCache.get('searchInput');
                expect(refreshed).not.toBeNull();
            });
        });

        describe('refreshFilterCache()', () => {
            it('should invalidate filter-related entries', () => {
                // Set up filter elements
                domCache.set('rarityFilter', document.createElement('select'));
                domCache.set('tierFilter', document.createElement('select'));
                domCache.set('stackingFilter', document.createElement('select'));
                domCache.set('sortBy', document.createElement('select'));
                domCache.set('favoritesOnly', document.createElement('input'));

                refreshFilterCache();

                // Filter entries should be removed
                expect(domCache.get('rarityFilter')).toBeNull();
                expect(domCache.get('tierFilter')).toBeNull();
                expect(domCache.get('stackingFilter')).toBeNull();
                expect(domCache.get('sortBy')).toBeNull();
                expect(domCache.get('favoritesOnly')).toBeNull();
            });

            it('should not affect non-filter cache entries', () => {
                domCache.init();
                const searchInput = domCache.get('searchInput');

                refreshFilterCache();

                expect(domCache.get('searchInput')).toBe(searchInput);
            });
        });
    });

    describe('Cache performance', () => {
        it('should cache elements for quick access', () => {
            domCache.init();

            // Multiple gets should return same reference
            const get1 = domCache.get('searchInput');
            const get2 = domCache.get('searchInput');
            const get3 = domCache.get('searchInput');

            expect(get1).toBe(get2);
            expect(get2).toBe(get3);
        });

        it('should avoid DOM queries after initialization', () => {
            domCache.init();

            // Spy on getElementById
            const spy = vi.spyOn(document, 'getElementById');

            // Multiple gets should not trigger DOM query
            domCache.get('searchInput');
            domCache.get('searchInput');
            domCache.get('searchInput');

            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
        });
    });
});
