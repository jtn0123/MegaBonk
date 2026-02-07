/**
 * Tests for search-history.ts module
 * Tests search history management and dropdown UI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    getSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    showSearchHistoryDropdown,
} from '../../src/modules/search-history.ts';

// ========================================
// getSearchHistory Tests
// ========================================
describe('search-history - getSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should return empty array when no history exists', () => {
        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should return stored history', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['wrench', 'medkit']));

        const result = getSearchHistory();
        expect(result).toEqual(['wrench', 'medkit']);
    });

    it('should handle invalid JSON gracefully', () => {
        localStorage.setItem('megabonk_search_history', 'invalid json');

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should handle localStorage errors gracefully', () => {
        const originalGetItem = localStorage.getItem;
        localStorage.getItem = vi.fn(() => {
            throw new Error('Storage unavailable');
        });

        const result = getSearchHistory();
        expect(result).toEqual([]);

        localStorage.getItem = originalGetItem;
    });

    it('should return array of correct type', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['test']));

        const result = getSearchHistory();
        expect(Array.isArray(result)).toBe(true);
    });

    it('should return exact items from storage', () => {
        const items = ['item1', 'item2', 'item3'];
        localStorage.setItem('megabonk_search_history', JSON.stringify(items));

        const result = getSearchHistory();
        expect(result).toEqual(items);
        expect(result.length).toBe(3);
    });

    it('should return empty array when stored value is not an array', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify({ invalid: 'object' }));

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should return empty array when stored value is a string', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify('just a string'));

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should return empty array when stored value is a number', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(12345));

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should return empty array when stored value is null', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(null));

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });

    it('should filter out non-string items from array', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['valid', 123, null, 'also valid', {}, undefined]));

        const result = getSearchHistory();
        expect(result).toEqual(['valid', 'also valid']);
    });

    it('should filter out empty strings from array', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['valid', '', 'also valid', '   ']));

        const result = getSearchHistory();
        // Empty strings are filtered, but '   ' passes typeof check (it's a non-empty string)
        // Looking at the source: typeof item === 'string' && item.length > 0
        // '   ' has length 3, so it would pass
        expect(result).toContain('valid');
        expect(result).toContain('also valid');
        expect(result).not.toContain('');
    });

    it('should handle mixed valid and invalid array items', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['search1', null, 'search2', 42, 'search3']));

        const result = getSearchHistory();
        expect(result).toEqual(['search1', 'search2', 'search3']);
    });
});

// ========================================
// addToSearchHistory Tests
// ========================================
describe('search-history - addToSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should add term to history', () => {
        addToSearchHistory('wrench');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('wrench');
    });

    it('should add term to front of history', () => {
        addToSearchHistory('wrench');
        addToSearchHistory('medkit');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('medkit');
        expect(stored[1]).toBe('wrench');
    });

    it('should remove duplicates', () => {
        addToSearchHistory('wrench');
        addToSearchHistory('medkit');
        addToSearchHistory('wrench');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toEqual(['wrench', 'medkit']);
    });

    it('should limit history to 10 items', () => {
        for (let i = 0; i < 15; i++) {
            addToSearchHistory(`item${i}`);
        }

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored.length).toBe(10);
    });

    it('should keep most recent items when over limit', () => {
        for (let i = 0; i < 15; i++) {
            addToSearchHistory(`item${i}`);
        }

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('item14'); // Most recent
    });

    it('should ignore empty strings', () => {
        addToSearchHistory('');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should ignore whitespace-only strings', () => {
        addToSearchHistory('   ');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should ignore terms shorter than 2 characters', () => {
        addToSearchHistory('a');

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should accept terms with 2 characters', () => {
        addToSearchHistory('ab');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('ab');
    });

    it('should accept terms with many characters', () => {
        addToSearchHistory('this is a long search term');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('this is a long search term');
    });

    it('should handle localStorage errors gracefully', () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => {
            throw new Error('Storage full');
        });

        expect(() => addToSearchHistory('test')).not.toThrow();

        localStorage.setItem = originalSetItem;
    });

    it('should preserve existing items when adding new one', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['existing']));

        addToSearchHistory('new');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored).toContain('existing');
        expect(stored).toContain('new');
    });

    it('should move duplicate to front instead of adding twice', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');
        addToSearchHistory('third');
        addToSearchHistory('first');

        const stored = JSON.parse(localStorage.getItem('megabonk_search_history')!);
        expect(stored[0]).toBe('first');
        expect(stored.filter((x: string) => x === 'first').length).toBe(1);
    });

    it('should handle null term gracefully', () => {
        addToSearchHistory(null as unknown as string);

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });

    it('should handle undefined term gracefully', () => {
        addToSearchHistory(undefined as unknown as string);

        const stored = localStorage.getItem('megabonk_search_history');
        expect(stored).toBeNull();
    });
});

// ========================================
// clearSearchHistory Tests
// ========================================
describe('search-history - clearSearchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should remove history from localStorage', () => {
        localStorage.setItem('megabonk_search_history', JSON.stringify(['wrench', 'medkit']));

        clearSearchHistory();

        expect(localStorage.getItem('megabonk_search_history')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
        const originalRemoveItem = localStorage.removeItem;
        localStorage.removeItem = vi.fn(() => {
            throw new Error('Storage unavailable');
        });

        expect(() => clearSearchHistory()).not.toThrow();

        localStorage.removeItem = originalRemoveItem;
    });

    it('should not throw when no history exists', () => {
        expect(() => clearSearchHistory()).not.toThrow();
    });

    it('should clear all items', () => {
        addToSearchHistory('item1');
        addToSearchHistory('item2');
        addToSearchHistory('item3');

        clearSearchHistory();

        const result = getSearchHistory();
        expect(result).toEqual([]);
    });
});

// ========================================
// showSearchHistoryDropdown Tests
// ========================================
describe('search-history - showSearchHistoryDropdown', () => {
    let searchInput: HTMLInputElement;
    let searchBox: HTMLDivElement;
    let onSelectMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Set up DOM
        searchBox = document.createElement('div');
        searchBox.className = 'search-box';
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchBox.appendChild(searchInput);
        document.body.appendChild(searchBox);

        onSelectMock = vi.fn();
    });

    afterEach(() => {
        // Clean up DOM
        document.body.innerHTML = '';
    });

    it('should not create dropdown when history is empty', () => {
        showSearchHistoryDropdown(searchInput, onSelectMock);

        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should create dropdown when history exists', () => {
        addToSearchHistory('test search');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).not.toBeNull();
    });

    it('should display history items in dropdown', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const items = document.querySelectorAll('.search-history-item');
        expect(items.length).toBe(2);
    });

    it('should display items in correct order (most recent first)', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const items = document.querySelectorAll('.search-history-item');
        expect(items[0].getAttribute('data-term')).toBe('second');
        expect(items[1].getAttribute('data-term')).toBe('first');
    });

    it('should have ARIA attributes for accessibility', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown?.getAttribute('role')).toBe('listbox');
        expect(dropdown?.getAttribute('aria-label')).toBe('Search history');
        expect(searchInput.getAttribute('aria-expanded')).toBe('true');
        expect(searchInput.getAttribute('aria-haspopup')).toBe('listbox');
    });

    it('should have clear button', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const clearBtn = document.querySelector('.clear-history-btn');
        expect(clearBtn).not.toBeNull();
    });

    it('should clear history and close dropdown when clear button is clicked', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const clearBtn = document.querySelector('.clear-history-btn') as HTMLButtonElement;
        clearBtn?.click();

        // History should be cleared
        expect(getSearchHistory()).toEqual([]);

        // Dropdown should be removed
        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should call onSelect and close dropdown when item is clicked', () => {
        addToSearchHistory('test search');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const item = document.querySelector('.search-history-item') as HTMLElement;
        item?.click();

        expect(onSelectMock).toHaveBeenCalledWith('test search');
        expect(searchInput.value).toBe('test search');

        // Dropdown should be removed
        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should remove existing dropdown before creating new one', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);
        showSearchHistoryDropdown(searchInput, onSelectMock);

        const dropdowns = document.querySelectorAll('.search-history-dropdown');
        expect(dropdowns.length).toBe(1);
    });

    it('should set parent position to relative', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        expect(searchBox.style.position).toBe('relative');
    });

    it('should close dropdown when clicking outside', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Click outside the dropdown
        document.body.click();

        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should close dropdown and focus input when Escape is pressed', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(escapeEvent);

        const dropdown = document.querySelector('.search-history-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should navigate down with ArrowDown key', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
        searchInput.dispatchEvent(arrowDownEvent);

        const items = document.querySelectorAll('.search-history-item');
        expect(items[0].classList.contains('active')).toBe(true);
        expect(items[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should navigate up with ArrowUp key', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Navigate down first
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

        // Then navigate up
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

        const items = document.querySelectorAll('.search-history-item');
        expect(items[0].classList.contains('active')).toBe(true);
    });

    it('should not navigate below last item', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Navigate down three times (more than items)
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

        const items = document.querySelectorAll('.search-history-item');
        // Last item should be active
        expect(items[1].classList.contains('active')).toBe(true);
    });

    it('should not navigate above first item', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Navigate down once
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

        // Then try to navigate up twice
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

        const items = document.querySelectorAll('.search-history-item');
        // First item should be active
        expect(items[0].classList.contains('active')).toBe(true);
    });

    it('should select item with Enter key when navigated', () => {
        addToSearchHistory('test search');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Navigate to first item
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

        // Press Enter
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(onSelectMock).toHaveBeenCalledWith('test search');
    });

    it('should not select with Enter when no item is active', () => {
        addToSearchHistory('test search');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Press Enter without navigating
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(onSelectMock).not.toHaveBeenCalled();
    });

    it('should escape HTML in history items display text', () => {
        addToSearchHistory('<script>alert("xss")</script>');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const item = document.querySelector('.search-history-item');
        // The innerHTML should contain escaped entities, not raw script tags
        expect(item?.innerHTML).toContain('&lt;');
        expect(item?.innerHTML).toContain('&gt;');
        // Should NOT contain raw unescaped script tags in innerHTML
        expect(item?.innerHTML).not.toContain('<script>');
    });

    it('should preserve term in data-term for selection callback', () => {
        const testTerm = 'test search term';
        addToSearchHistory(testTerm);

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const item = document.querySelector('.search-history-item') as HTMLElement;
        // data-term should be defined and usable
        expect(item?.getAttribute('data-term')).toBeDefined();

        // Click the item and verify the callback receives the term
        item?.click();
        expect(onSelectMock).toHaveBeenCalledWith(testTerm);
    });

    it('should render header with "Recent Searches" text', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const header = document.querySelector('.search-history-header span');
        expect(header?.textContent).toBe('Recent Searches');
    });

    it('should have role="option" on each history item', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const item = document.querySelector('.search-history-item');
        expect(item?.getAttribute('role')).toBe('option');
    });

    it('should have data-index attribute on items', () => {
        addToSearchHistory('first');
        addToSearchHistory('second');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const items = document.querySelectorAll('.search-history-item');
        expect(items[0].getAttribute('data-index')).toBe('0');
        expect(items[1].getAttribute('data-index')).toBe('1');
    });

    it('should not close dropdown when clicking inside', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        const dropdown = document.querySelector('.search-history-dropdown') as HTMLElement;
        const headerSpan = dropdown.querySelector('.search-history-header span') as HTMLElement;

        // Click on header (inside dropdown but not on item or clear button)
        headerSpan?.click();

        // Dropdown should still exist (click wasn't outside)
        const stillExists = document.querySelector('.search-history-dropdown');
        expect(stillExists).not.toBeNull();
    });

    it('should not close dropdown when clicking on search input', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);

        // Click on search input
        searchInput.click();

        // Dropdown should still exist
        const stillExists = document.querySelector('.search-history-dropdown');
        expect(stillExists).not.toBeNull();
    });

    it('should set aria-expanded to false when dropdown closes', () => {
        addToSearchHistory('test');

        showSearchHistoryDropdown(searchInput, onSelectMock);
        expect(searchInput.getAttribute('aria-expanded')).toBe('true');

        // Close by pressing Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(searchInput.getAttribute('aria-expanded')).toBe('false');
    });
});

// ========================================
// Integration Tests
// ========================================
describe('search-history - integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should work end-to-end: add, get, clear', () => {
        // Add items
        addToSearchHistory('test1');
        addToSearchHistory('test2');

        // Get items
        let history = getSearchHistory();
        expect(history).toEqual(['test2', 'test1']);

        // Clear
        clearSearchHistory();

        // Verify cleared
        history = getSearchHistory();
        expect(history).toEqual([]);
    });

    it('should persist across get calls', () => {
        addToSearchHistory('persistent');

        const first = getSearchHistory();
        const second = getSearchHistory();

        expect(first).toEqual(second);
    });

    it('should handle special characters in search terms', () => {
        addToSearchHistory('test@#$%');
        addToSearchHistory('日本語');
        addToSearchHistory('emoji 🎮');

        const history = getSearchHistory();
        expect(history).toContain('test@#$%');
        expect(history).toContain('日本語');
        expect(history).toContain('emoji 🎮');
    });

    it('should handle concurrent operations correctly', () => {
        addToSearchHistory('first');
        const history1 = getSearchHistory();
        addToSearchHistory('second');
        const history2 = getSearchHistory();

        expect(history1).toEqual(['first']);
        expect(history2).toEqual(['second', 'first']);
    });
});
