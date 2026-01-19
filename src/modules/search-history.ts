// ========================================
// MegaBonk Search History Module
// ========================================
// Manages search history persistence and UI

import { escapeHtml } from './utils.ts';

// ========================================
// Constants
// ========================================

const SEARCH_HISTORY_KEY = 'megabonk_search_history';
const MAX_SEARCH_HISTORY = 10;

// ========================================
// Search History Management
// ========================================

/**
 * Get search history from localStorage
 * @returns Search history array
 */
export function getSearchHistory(): string[] {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.debug('[search-history] localStorage unavailable:', (error as Error).message);
        return [];
    }
}

/**
 * Add search term to history
 * @param term - Search term to add
 */
export function addToSearchHistory(term: string): void {
    if (!term || term.trim().length < 2) return;

    try {
        let history = getSearchHistory();

        // Remove duplicates and add to front
        history = history.filter(item => item !== term);
        history.unshift(term);

        // Keep only MAX_SEARCH_HISTORY items
        history = history.slice(0, MAX_SEARCH_HISTORY);

        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.debug('[search-history] localStorage unavailable:', (error as Error).message);
    }
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
        console.debug('[search-history] localStorage unavailable:', (error as Error).message);
    }
}

/**
 * Show search history dropdown
 * @param searchInput - Search input element
 * @param onSelect - Callback when item is selected
 */
export function showSearchHistoryDropdown(
    searchInput: HTMLInputElement,
    onSelect: (term: string) => void
): void {
    const history = getSearchHistory();
    if (history.length === 0) return;

    // Remove existing dropdown if any
    const existingDropdown = document.querySelector('.search-history-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    // Create dropdown with ARIA attributes for accessibility
    const dropdown = document.createElement('div');
    dropdown.className = 'search-history-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Search history');
    searchInput.setAttribute('aria-expanded', 'true');
    searchInput.setAttribute('aria-haspopup', 'listbox');
    dropdown.innerHTML = `
        <div class="search-history-header">
            <span>Recent Searches</span>
            <button class="clear-history-btn" aria-label="Clear search history">Clear</button>
        </div>
        <ul class="search-history-list" role="group">
            ${history
                .map(
                    (term, index) => `
                <li class="search-history-item" role="option" tabindex="0" data-term="${escapeHtml(term)}" data-index="${index}" aria-selected="false">
                    ${escapeHtml(term)}
                </li>
            `
                )
                .join('')}
        </ul>
    `;

    // Position dropdown
    const searchBox = searchInput.parentElement;
    if (searchBox) {
        searchBox.style.position = 'relative';
        searchBox.appendChild(dropdown);
    }

    // AbortController for cleanup
    const abortController = new AbortController();

    // Helper to close dropdown
    const closeDropdown = (): void => {
        abortController.abort();
        searchInput.setAttribute('aria-expanded', 'false');
        if (dropdown.parentElement) {
            dropdown.remove();
        }
    };

    // Clear button handler
    const clearBtn = dropdown.querySelector('.clear-history-btn') as HTMLButtonElement | null;
    clearBtn?.addEventListener('click', e => {
        e.stopPropagation();
        clearSearchHistory();
        closeDropdown();
    }, { signal: abortController.signal });

    const historyItems = dropdown.querySelectorAll('.search-history-item');
    let currentIndex = -1;

    // Update active item state
    const updateActiveItem = (): void => {
        historyItems.forEach((item, i) => {
            const isActive = i === currentIndex;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (isActive) {
                (item as HTMLElement).focus();
            }
        });
    };

    // Select current item
    const selectCurrentItem = (): void => {
        if (currentIndex >= 0 && currentIndex < historyItems.length) {
            const item = historyItems[currentIndex] as HTMLElement;
            const term = item.getAttribute('data-term');
            if (term && searchInput) {
                searchInput.value = term;
                onSelect(term);
                closeDropdown();
            }
        }
    };

    // Click handlers for items
    historyItems.forEach(item => {
        item.addEventListener(
            'click',
            () => {
                const term = item.getAttribute('data-term');
                if (term && searchInput) {
                    searchInput.value = term;
                    onSelect(term);
                    closeDropdown();
                }
            },
            { signal: abortController.signal }
        );
    });

    // Keyboard navigation
    searchInput.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, historyItems.length - 1);
                updateActiveItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                updateActiveItem();
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                selectCurrentItem();
            }
        },
        { signal: abortController.signal }
    );

    // Close on click outside
    document.addEventListener(
        'click',
        (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && e.target !== searchInput) {
                closeDropdown();
            }
        },
        { signal: abortController.signal }
    );

    // Close on Escape
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeDropdown();
                searchInput?.focus();
            }
        },
        { signal: abortController.signal }
    );
}
