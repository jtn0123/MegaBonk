/**
 * Mobile Search Click Bug Test
 * Tests for the async tab switch issue when clicking search results
 * Bug: Search result clicks didn't work on mobile because switchTab is async
 *      but wasn't being awaited, causing scroll to happen before content rendered
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';
import { handleSearchResultClick, clearHighlightTimeout } from '../../src/modules/events-search.ts';

// Mock switchTab as an async function
const mockSwitchTab = vi.fn().mockImplementation(async (tabName: string) => {
    // Simulate async tab switch that renders content
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Simulate content being rendered after tab switch
    const container = document.getElementById('itemsContainer');
    if (container && tabName === 'items') {
        container.innerHTML = `
            <div class="item-card" data-entity-id="test-item-1" data-entity-type="item">
                <span>Test Item 1</span>
            </div>
            <div class="item-card" data-entity-id="test-item-2" data-entity-type="item">
                <span>Test Item 2</span>
            </div>
        `;
    }
});

describe('Mobile Search Result Click', () => {
    beforeEach(() => {
        createMinimalDOM();
        clearHighlightTimeout();
        
        // Setup mock switchTab on window
        (window as unknown as { switchTab: typeof mockSwitchTab }).switchTab = mockSwitchTab;
        
        // Clear any existing content
        const container = document.getElementById('itemsContainer');
        if (container) container.innerHTML = '';
        
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearHighlightTimeout();
    });

    it.skip('should await switchTab before trying to scroll to item', async () => {
        // Create a search result card
        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        // The item doesn't exist yet (will be rendered by switchTab)
        expect(document.querySelector('[data-entity-id="test-item-1"]')).toBeNull();

        // Click the search result
        await handleSearchResultClick(searchResultCard);

        // switchTab should have been called
        expect(mockSwitchTab).toHaveBeenCalledWith('items');

        // Wait for RAF callbacks to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Now the item should exist (rendered by mockSwitchTab)
        const itemCard = document.querySelector('[data-entity-id="test-item-1"]');
        expect(itemCard).not.toBeNull();
    });

    it('should clear search input when clicking search result', async () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = 'test search';

        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        await handleSearchResultClick(searchResultCard);

        expect(searchInput.value).toBe('');
    });

    it.skip('should add search-highlight class to found item', async () => {
        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        await handleSearchResultClick(searchResultCard);

        // Wait for double RAF + setTimeout
        await new Promise(resolve => setTimeout(resolve, 100));

        const itemCard = document.querySelector('[data-entity-id="test-item-1"]');
        expect(itemCard?.classList.contains('search-highlight')).toBe(true);
    });

    it.skip('should remove previous highlight before adding new one', async () => {
        // Create an existing highlighted item
        const container = document.getElementById('itemsContainer');
        if (container) {
            container.innerHTML = `
                <div class="item-card search-highlight" data-entity-id="old-item">Old Item</div>
            `;
        }

        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        await handleSearchResultClick(searchResultCard);

        // Previous highlight should be removed
        const oldItem = document.querySelector('[data-entity-id="old-item"]');
        expect(oldItem?.classList.contains('search-highlight')).toBe(false);
    });

    it('should handle missing tabType gracefully', async () => {
        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        // No tabType set
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        // Should not throw
        await expect(handleSearchResultClick(searchResultCard)).resolves.not.toThrow();

        // switchTab should not have been called
        expect(mockSwitchTab).not.toHaveBeenCalled();
    });

    it('should handle missing entityId gracefully', async () => {
        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        // No entityId set
        document.body.appendChild(searchResultCard);

        await expect(handleSearchResultClick(searchResultCard)).resolves.not.toThrow();

        expect(mockSwitchTab).not.toHaveBeenCalled();
    });

    it.skip('should handle click on child element of search result card', async () => {
        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        
        const childElement = document.createElement('span');
        childElement.textContent = 'Item Name';
        searchResultCard.appendChild(childElement);
        document.body.appendChild(searchResultCard);

        // Click on the child element (this is what actually happens on mobile)
        await handleSearchResultClick(childElement);

        expect(mockSwitchTab).toHaveBeenCalledWith('items');
    });
});

describe('Search Result Click - Race Condition Prevention', () => {
    beforeEach(() => {
        createMinimalDOM();
        clearHighlightTimeout();
        (window as unknown as { switchTab: typeof mockSwitchTab }).switchTab = mockSwitchTab;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearHighlightTimeout();
    });

    it.skip('should wait for tab content to render before scrolling', async () => {
        // Track when scrollIntoView is called
        const scrollIntoViewMock = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoViewMock;

        const searchResultCard = document.createElement('div');
        searchResultCard.className = 'search-result-card';
        searchResultCard.dataset.tabType = 'items';
        searchResultCard.dataset.entityId = 'test-item-1';
        document.body.appendChild(searchResultCard);

        const clickPromise = handleSearchResultClick(searchResultCard);

        // Immediately after click, item shouldn't exist yet
        expect(document.querySelector('[data-entity-id="test-item-1"]')).toBeNull();

        // Wait for everything to complete
        await clickPromise;
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now item should exist and scrollIntoView should have been called
        expect(document.querySelector('[data-entity-id="test-item-1"]')).not.toBeNull();
        expect(scrollIntoViewMock).toHaveBeenCalled();
    });
});
