/**
 * Search Dropdown Module Tests
 * Tests for the floating search dropdown component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';
import {
    showSearchDropdown,
    hideSearchDropdown,
    handleDropdownKeyboard,
    highlightMatches,
    getSelectedResult,
    isSearchDropdownVisible,
    getFocusedIndex,
    navigateToResult,
} from '../../src/modules/search-dropdown.ts';
import type { GlobalSearchResult } from '../../src/modules/global-search.ts';

describe('Search Dropdown Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Reset any state between tests
        hideSearchDropdown();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('showSearchDropdown', () => {
        it('should show dropdown with results grouped by type', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: {
                        id: 'test-item-1',
                        name: 'Test Item',
                        description: 'A test item',
                        tier: 'S',
                        rarity: 'rare',
                    },
                    score: 100,
                },
                {
                    type: 'weapons',
                    item: {
                        id: 'test-weapon-1',
                        name: 'Test Weapon',
                        description: 'A test weapon',
                        tier: 'A',
                    },
                    score: 90,
                },
            ];

            showSearchDropdown(results, 'test');

            const dropdown = document.getElementById('searchResultsDropdown');
            expect(dropdown).not.toBeNull();
            expect(dropdown?.hidden).toBe(false);
            expect(isSearchDropdownVisible()).toBe(true);

            // Check for grouped sections
            const sections = dropdown?.querySelectorAll('.search-dropdown-section');
            expect(sections?.length).toBeGreaterThanOrEqual(1);

            // Check for result items
            const items = dropdown?.querySelectorAll('.search-dropdown-item');
            expect(items?.length).toBe(2);
        });

        it('should show empty state when no results', () => {
            showSearchDropdown([], 'nonexistent');

            const dropdown = document.getElementById('searchResultsDropdown');
            expect(dropdown).not.toBeNull();
            expect(dropdown?.hidden).toBe(false);

            const emptyState = dropdown?.querySelector('.search-dropdown-empty');
            expect(emptyState).not.toBeNull();
            expect(emptyState?.textContent).toContain('No results found');
        });

        it('should update ARIA attributes on search input', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: {
                        id: 'test-1',
                        name: 'Test',
                        description: 'Test desc',
                        tier: 'A',
                        rarity: 'common',
                    },
                    score: 50,
                },
            ];

            showSearchDropdown(results, 'test');

            const searchInput = document.getElementById('searchInput');
            expect(searchInput?.getAttribute('aria-expanded')).toBe('true');
        });

        it('should limit results per type to prevent overflow', () => {
            // Create 10 items (more than the limit of 5 per type)
            const results: GlobalSearchResult[] = Array.from({ length: 10 }, (_, i) => ({
                type: 'items' as const,
                item: {
                    id: `item-${i}`,
                    name: `Item ${i}`,
                    description: 'Test',
                    tier: 'A' as const,
                    rarity: 'common' as const,
                },
                score: 100 - i,
            }));

            showSearchDropdown(results, 'item');

            const dropdown = document.getElementById('searchResultsDropdown');
            const items = dropdown?.querySelectorAll('.search-dropdown-item');
            // Should be limited to MAX_RESULTS_PER_TYPE_DROPDOWN (5)
            expect(items?.length).toBe(5);
        });
    });

    describe('hideSearchDropdown', () => {
        it('should hide dropdown and reset state', () => {
            // First show some results
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: {
                        id: 'test-1',
                        name: 'Test',
                        description: 'Test',
                        tier: 'A',
                        rarity: 'common',
                    },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');
            expect(isSearchDropdownVisible()).toBe(true);

            hideSearchDropdown();

            const dropdown = document.getElementById('searchResultsDropdown');
            expect(dropdown?.hidden).toBe(true);
            expect(isSearchDropdownVisible()).toBe(false);
            expect(getFocusedIndex()).toBe(-1);
        });

        it('should update ARIA attributes on search input', () => {
            showSearchDropdown([], 'test');
            hideSearchDropdown();

            const searchInput = document.getElementById('searchInput');
            expect(searchInput?.getAttribute('aria-expanded')).toBe('false');
        });
    });

    describe('handleDropdownKeyboard', () => {
        const mockResults: GlobalSearchResult[] = [
            {
                type: 'items',
                item: { id: 'item-1', name: 'Item 1', description: 'Test', tier: 'A', rarity: 'common' },
                score: 100,
            },
            {
                type: 'items',
                item: { id: 'item-2', name: 'Item 2', description: 'Test', tier: 'B', rarity: 'uncommon' },
                score: 90,
            },
            {
                type: 'weapons',
                item: { id: 'weapon-1', name: 'Weapon 1', description: 'Test', tier: 'S' },
                score: 80,
            },
        ];

        beforeEach(() => {
            showSearchDropdown(mockResults, 'test');
        });

        it('should navigate down with ArrowDown', () => {
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            const handled = handleDropdownKeyboard(event);

            expect(handled).toBe(true);
            expect(getFocusedIndex()).toBe(0);
        });

        it('should navigate up with ArrowUp', () => {
            // First go down twice
            handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            expect(getFocusedIndex()).toBe(1);

            // Then go up
            const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            const handled = handleDropdownKeyboard(event);

            expect(handled).toBe(true);
            expect(getFocusedIndex()).toBe(0);
        });

        it('should not go below -1 with ArrowUp', () => {
            const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            handleDropdownKeyboard(event);

            expect(getFocusedIndex()).toBe(-1);
        });

        it('should not exceed results length with ArrowDown', () => {
            // Navigate past the end
            for (let i = 0; i < 10; i++) {
                handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            }

            // Should be at last index (2)
            expect(getFocusedIndex()).toBe(2);
        });

        it('should hide dropdown on Escape', () => {
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            const handled = handleDropdownKeyboard(event);

            expect(handled).toBe(true);
            expect(isSearchDropdownVisible()).toBe(false);
        });

        it('should return false when dropdown is not visible', () => {
            hideSearchDropdown();

            const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            const handled = handleDropdownKeyboard(event);

            expect(handled).toBe(false);
        });

        it('should return false for unhandled keys', () => {
            const event = new KeyboardEvent('keydown', { key: 'Tab' });
            const handled = handleDropdownKeyboard(event);

            expect(handled).toBe(false);
        });
    });

    describe('getSelectedResult', () => {
        it('should return null when no item is focused', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            expect(getSelectedResult()).toBeNull();
        });

        it('should return focused result after keyboard navigation', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test 1', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 100,
                },
                {
                    type: 'items',
                    item: { id: 'test-2', name: 'Test 2', description: 'Test', tier: 'B', rarity: 'rare' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            // Navigate to first item
            handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

            const selected = getSelectedResult();
            expect(selected).not.toBeNull();
            expect(selected?.item.id).toBe('test-1');
        });
    });

    describe('highlightMatches', () => {
        it('should highlight matching text', () => {
            const result = highlightMatches('Test Item Name', 'item');
            expect(result).toContain('<mark class="match-highlight">Item</mark>');
        });

        it('should be case-insensitive', () => {
            const result = highlightMatches('Test ITEM Name', 'item');
            expect(result).toContain('<mark class="match-highlight">ITEM</mark>');
        });

        it('should escape HTML in input text', () => {
            const result = highlightMatches('<script>alert("xss")</script>', 'script');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;');
        });

        it('should handle empty inputs', () => {
            expect(highlightMatches('', 'test')).toBe('');
            expect(highlightMatches('test', '')).toBe('test');
        });

        it('should escape regex special characters in query', () => {
            const result = highlightMatches('Test (item) name', '(item)');
            expect(result).toContain('mark class="match-highlight"');
        });
    });

    describe('navigateToResult', () => {
        it('should hide dropdown and clear search input', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            // Set search input value
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test';

            // Mock switchTab
            window.switchTab = vi.fn();

            navigateToResult(results[0]);

            expect(isSearchDropdownVisible()).toBe(false);
            expect(searchInput.value).toBe('');
            expect(window.switchTab).toHaveBeenCalledWith('items');
        });
    });

    describe('keyboard focus visual feedback', () => {
        it('should add keyboard-focused class to focused item', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test 1', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 100,
                },
                {
                    type: 'items',
                    item: { id: 'test-2', name: 'Test 2', description: 'Test', tier: 'B', rarity: 'rare' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            // Navigate to first item
            handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

            const dropdown = document.getElementById('searchResultsDropdown');
            const focusedItem = dropdown?.querySelector('.keyboard-focused');
            expect(focusedItem).not.toBeNull();
            expect(focusedItem?.getAttribute('data-index')).toBe('0');
        });

        it('should update aria-selected on focused item', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            // Navigate to first item
            handleDropdownKeyboard(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

            const dropdown = document.getElementById('searchResultsDropdown');
            const focusedItem = dropdown?.querySelector('[aria-selected="true"]');
            expect(focusedItem).not.toBeNull();
        });
    });

    describe('dropdown content', () => {
        it('should show keyboard hints in footer', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test', description: 'Test', tier: 'A', rarity: 'common' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            const dropdown = document.getElementById('searchResultsDropdown');
            const footer = dropdown?.querySelector('.search-dropdown-footer');
            expect(footer).not.toBeNull();
            expect(footer?.textContent).toContain('Navigate');
            expect(footer?.textContent).toContain('Select');
            expect(footer?.textContent).toContain('Close');
        });

        it('should include tier labels when item has tier', () => {
            const results: GlobalSearchResult[] = [
                {
                    type: 'items',
                    item: { id: 'test-1', name: 'Test', description: 'Test', tier: 'SS', rarity: 'legendary' },
                    score: 50,
                },
            ];
            showSearchDropdown(results, 'test');

            const dropdown = document.getElementById('searchResultsDropdown');
            const tierLabel = dropdown?.querySelector('.tier-label');
            expect(tierLabel).not.toBeNull();
            expect(tierLabel?.textContent).toBe('SS');
        });
    });
});
