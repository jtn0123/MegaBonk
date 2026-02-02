/**
 * @vitest-environment jsdom
 * Search UX Module Tests
 * Tests UI/UX validation for search functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return 'items';
        return null;
    }),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Import after mocking
import {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    showSearchHistoryDropdown,
} from '../../src/modules/search-history.ts';

describe('Search UX Module - UI/UX Validation', () => {
    let mockLocalStorage: Record<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage = {};

        // Mock localStorage
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
            return mockLocalStorage[key] || null;
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            mockLocalStorage[key] = value;
        });
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
            delete mockLocalStorage[key];
        });

        document.body.innerHTML = `
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search items..." />
            </div>
            <div id="cardContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    // ========================================
    // Search History Storage Tests
    // ========================================
    describe('Search History Storage', () => {
        it('should return empty array when no history exists', () => {
            const history = getSearchHistory();

            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should add search term to history', () => {
            addToSearchHistory('test search');

            const history = getSearchHistory();
            expect(history).toContain('test search');
        });

        it('should not add duplicate searches', () => {
            addToSearchHistory('duplicate');
            addToSearchHistory('duplicate');

            const history = getSearchHistory();
            const duplicateCount = history.filter(h => h === 'duplicate').length;
            expect(duplicateCount).toBe(1);
        });

        it('should move recent search to front of history', () => {
            addToSearchHistory('first');
            addToSearchHistory('second');
            addToSearchHistory('first'); // Re-add first

            const history = getSearchHistory();
            expect(history[0]).toBe('first');
        });

        it('should limit history to configured maximum', () => {
            // Add more than the limit
            for (let i = 0; i < 20; i++) {
                addToSearchHistory(`search ${i}`);
            }

            const history = getSearchHistory();
            expect(history.length).toBeLessThanOrEqual(10);
        });

        it('should clear all history', () => {
            addToSearchHistory('test1');
            addToSearchHistory('test2');

            clearSearchHistory();

            const history = getSearchHistory();
            expect(history.length).toBe(0);
        });

        it('should not add empty search terms', () => {
            addToSearchHistory('');

            const history = getSearchHistory();
            expect(history.length).toBe(0);
        });

        it('should not add very short search terms', () => {
            addToSearchHistory('a'); // Single char should be rejected

            const history = getSearchHistory();
            expect(history.length).toBe(0);
        });
    });

    // ========================================
    // Search History Dropdown Tests
    // ========================================
    describe('Search History Dropdown', () => {
        it('should create dropdown when called with history', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test search');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown).not.toBeNull();
        });

        it('should not create dropdown when no history', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            showSearchHistoryDropdown(searchInput, vi.fn());

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown).toBeNull();
        });

        it('should render history items in dropdown', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('item one');
            addToSearchHistory('item two');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const items = document.querySelectorAll('.search-history-item');
            expect(items.length).toBe(2);
        });

        it('should set ARIA attributes on input', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            expect(searchInput.getAttribute('aria-expanded')).toBe('true');
            expect(searchInput.getAttribute('aria-haspopup')).toBe('listbox');
        });

        it('should set ARIA role on dropdown', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown?.getAttribute('role')).toBe('listbox');
        });

        it('should render clear button', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const clearBtn = document.querySelector('.clear-history-btn');
            expect(clearBtn).not.toBeNull();
        });

        it('should render items with data-term attribute', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test search');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item');
            expect(item?.getAttribute('data-term')).toBe('test search');
        });

        it('should render items with data-index attribute', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item');
            expect(item?.getAttribute('data-index')).toBe('0');
        });

        it('should render items with role=option', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item');
            expect(item?.getAttribute('role')).toBe('option');
        });

        it('should call onSelect when item is clicked', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const onSelect = vi.fn();
            addToSearchHistory('selected term');

            showSearchHistoryDropdown(searchInput, onSelect);

            const item = document.querySelector('.search-history-item') as HTMLElement;
            item.click();

            expect(onSelect).toHaveBeenCalledWith('selected term');
        });

        it('should set input value when item is clicked', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('clicked term');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item') as HTMLElement;
            item.click();

            expect(searchInput.value).toBe('clicked term');
        });

        it('should remove dropdown when item is clicked', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item') as HTMLElement;
            item.click();

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown).toBeNull();
        });

        it('should remove existing dropdown before creating new one', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());
            showSearchHistoryDropdown(searchInput, vi.fn());

            const dropdowns = document.querySelectorAll('.search-history-dropdown');
            expect(dropdowns.length).toBe(1);
        });
    });

    // ========================================
    // Search Input UX Tests
    // ========================================
    describe('Search Input UX', () => {
        it('should have search input element', () => {
            const searchInput = document.getElementById('searchInput');

            expect(searchInput).not.toBeNull();
            expect(searchInput?.tagName.toLowerCase()).toBe('input');
        });

        it('should have text input type', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            expect(searchInput.type).toBe('text');
        });

        it('should have search-box container', () => {
            const searchBox = document.querySelector('.search-box');

            expect(searchBox).not.toBeNull();
        });

        it('should support placeholder text', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;

            expect(searchInput.placeholder).toBeTruthy();
        });

        it('should support clearing input value', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test';

            searchInput.value = '';

            expect(searchInput.value).toBe('');
        });
    });

    // ========================================
    // Keyboard Navigation Tests
    // ========================================
    describe('Keyboard Navigation', () => {
        it('should close dropdown on Escape', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            // Dispatch Escape key
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown).toBeNull();
        });

        it('should support arrow down navigation', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test1');
            addToSearchHistory('test2');

            showSearchHistoryDropdown(searchInput, vi.fn());

            // Dispatch ArrowDown
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

            const activeItem = document.querySelector('.search-history-item.active');
            expect(activeItem).not.toBeNull();
        });
    });

    // ========================================
    // CSS Class Structure Tests
    // ========================================
    describe('CSS Class Structure', () => {
        it('should use search-history-dropdown class for container', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const dropdown = document.querySelector('.search-history-dropdown');
            expect(dropdown).not.toBeNull();
        });

        it('should use search-history-item class for items', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item');
            expect(item).not.toBeNull();
        });

        it('should use search-history-list class for list container', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const list = document.querySelector('.search-history-list');
            expect(list).not.toBeNull();
        });

        it('should use search-history-header class for header', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('test');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const header = document.querySelector('.search-history-header');
            expect(header).not.toBeNull();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle localStorage being full', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            // Should not throw
            expect(() => addToSearchHistory('test')).not.toThrow();
        });

        it('should handle corrupted localStorage data', () => {
            mockLocalStorage['megabonk_search_history'] = 'not valid json';

            const history = getSearchHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should handle non-array localStorage data', () => {
            mockLocalStorage['megabonk_search_history'] = '"string value"';

            const history = getSearchHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should filter out non-string items in history', () => {
            // Note: JSON.parse converts numbers to numbers, nulls to null, etc.
            // The function filters these out, leaving only valid strings
            mockLocalStorage['megabonk_search_history'] = JSON.stringify(['valid', 123, null, 'also valid']);

            const history = getSearchHistory();
            // Should filter out non-strings (123, null)
            expect(history.every(item => typeof item === 'string')).toBe(true);
        });

        it('should escape HTML in displayed terms', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            addToSearchHistory('<script>alert("xss")</script>');

            showSearchHistoryDropdown(searchInput, vi.fn());

            const item = document.querySelector('.search-history-item');
            expect(item?.innerHTML).not.toContain('<script>');
            expect(item?.innerHTML).toContain('&lt;');
        });
    });
});
