// ========================================
// MegaBonk Search Dropdown Module
// ========================================
// Floating search dropdown for cross-tab search results

import type { EntityType, Item, Weapon, Tome, Character, Shrine } from '../types/index.ts';
import type { GlobalSearchResult } from './global-search.ts';
import { escapeHtml, safeGetElementById } from './utils.ts';
import { logger } from './logger.ts';

// ========================================
// Constants
// ========================================

const DROPDOWN_ID = 'searchResultsDropdown';
const MAX_RESULTS_PER_TYPE_DROPDOWN = 5;

/**
 * Type label mapping for display
 */
const TYPE_LABELS: Record<EntityType, { label: string; icon: string }> = {
    items: { label: 'Items', icon: '📦' },
    weapons: { label: 'Weapons', icon: '⚔️' },
    tomes: { label: 'Tomes', icon: '📚' },
    characters: { label: 'Characters', icon: '👤' },
    shrines: { label: 'Shrines', icon: '⛩️' },
};

// ========================================
// State
// ========================================

let focusedIndex = -1;
let currentResults: GlobalSearchResult[] = [];
let isDropdownVisible = false;

// ========================================
// Public API
// ========================================

/**
 * Check if the dropdown is currently visible
 */
export function isSearchDropdownVisible(): boolean {
    return isDropdownVisible;
}

/**
 * Get the currently focused result (for Enter key navigation)
 */
export function getSelectedResult(): GlobalSearchResult | null {
    if (focusedIndex >= 0 && focusedIndex < currentResults.length) {
        return currentResults[focusedIndex];
    }
    return null;
}

/**
 * Get the focused index (for testing)
 */
export function getFocusedIndex(): number {
    return focusedIndex;
}

/**
 * Show the search dropdown with grouped results
 * @param results - Search results from globalSearch
 * @param query - The search query for highlighting
 */
export function showSearchDropdown(results: GlobalSearchResult[], query: string): void {
    const dropdown = safeGetElementById(DROPDOWN_ID);
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;

    if (!dropdown) {
        logger.warn({
            operation: 'search-dropdown.show',
            error: { name: 'ElementNotFound', message: 'Dropdown container not found' },
        });
        return;
    }

    // Store results for keyboard navigation
    currentResults = results;
    focusedIndex = -1;
    isDropdownVisible = true;

    // Update ARIA attributes
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
        searchInput.setAttribute('aria-controls', DROPDOWN_ID);
    }

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div class="search-dropdown-empty">
                <span class="empty-icon">🔍</span>
                <p>No results found for "${escapeHtml(query)}"</p>
            </div>
        `;
        dropdown.hidden = false;
        return;
    }

    // Group results by type
    const grouped = groupResultsByType(results);

    // Build HTML
    const html = buildDropdownHTML(grouped, query);
    dropdown.innerHTML = html;
    dropdown.hidden = false;

    logger.debug({
        operation: 'search-dropdown.show',
        data: { resultCount: results.length, groupCount: grouped.size },
    });
}

/**
 * Hide the search dropdown
 */
export function hideSearchDropdown(): void {
    const dropdown = safeGetElementById(DROPDOWN_ID);
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;

    if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
    }

    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'false');
    }

    // Reset state
    focusedIndex = -1;
    currentResults = [];
    isDropdownVisible = false;
}

/**
 * Handle keyboard navigation in the dropdown
 * @param event - Keyboard event
 * @returns true if the event was handled
 */
export function handleDropdownKeyboard(event: KeyboardEvent): boolean {
    if (!isDropdownVisible || currentResults.length === 0) {
        return false;
    }

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            focusedIndex = Math.min(focusedIndex + 1, currentResults.length - 1);
            updateFocusedItem();
            return true;

        case 'ArrowUp':
            event.preventDefault();
            focusedIndex = Math.max(focusedIndex - 1, -1);
            updateFocusedItem();
            return true;

        case 'Enter':
            if (focusedIndex >= 0) {
                event.preventDefault();
                selectFocusedItem();
                return true;
            }
            return false;

        case 'Escape':
            event.preventDefault();
            hideSearchDropdown();
            return true;

        default:
            return false;
    }
}

/**
 * Highlight matching text in a string
 * @param text - Text to highlight
 * @param query - Search query
 * @returns HTML with highlighted matches
 */
export function highlightMatches(text: string, query: string): string {
    if (!text || !query) return escapeHtml(text || '');

    const escapedText = escapeHtml(text);
    const escapedQuery = escapeHtml(query);

    // Case-insensitive match
    const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
    return escapedText.replace(regex, '<mark class="match-highlight">$1</mark>');
}

/**
 * Navigate to a search result
 * @param result - The search result to navigate to
 */
export function navigateToResult(result: GlobalSearchResult): void {
    hideSearchDropdown();

    // Clear the search input
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.value = '';
    }

    // Switch to the appropriate tab
    if (typeof window.switchTab === 'function') {
        window.switchTab(result.type);
    }

    // After tab switch, scroll to and highlight the item
    requestAnimationFrame(() => {
        const entityId = result.item.id;
        const itemCard = document.querySelector(`[data-entity-id="${entityId}"]`) as HTMLElement | null;
        if (itemCard) {
            itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            itemCard.classList.add('search-highlight');
            setTimeout(() => {
                itemCard.classList.remove('search-highlight');
            }, 2000);
        }
    });
}

// ========================================
// Internal Functions
// ========================================

/**
 * Group results by entity type
 */
function groupResultsByType(results: GlobalSearchResult[]): Map<EntityType, GlobalSearchResult[]> {
    const grouped = new Map<EntityType, GlobalSearchResult[]>();

    for (const result of results) {
        const existing = grouped.get(result.type) || [];
        if (existing.length < MAX_RESULTS_PER_TYPE_DROPDOWN) {
            existing.push(result);
            grouped.set(result.type, existing);
        }
    }

    return grouped;
}

/**
 * Build the dropdown HTML
 */
function buildDropdownHTML(grouped: Map<EntityType, GlobalSearchResult[]>, query: string): string {
    const typeOrder: EntityType[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    let html = '';
    let globalIndex = 0;

    for (const type of typeOrder) {
        const typeResults = grouped.get(type);
        if (!typeResults || typeResults.length === 0) continue;

        const { label, icon } = TYPE_LABELS[type];

        html += `
            <div class="search-dropdown-section" data-type="${type}">
                <div class="search-dropdown-header">
                    <span class="section-icon">${icon}</span>
                    <span class="section-label">${label}</span>
                    <span class="section-count">(${typeResults.length})</span>
                </div>
                <div class="search-dropdown-items">
        `;

        for (const result of typeResults) {
            html += buildResultItemHTML(result, query, globalIndex);
            globalIndex++;
        }

        html += `
                </div>
            </div>
        `;
    }

    // Add keyboard hint footer
    html += `
        <div class="search-dropdown-footer">
            <span class="keyboard-hint">↑↓ Navigate</span>
            <span class="keyboard-hint">Enter Select</span>
            <span class="keyboard-hint">Esc Close</span>
        </div>
    `;

    return html;
}

/**
 * Build HTML for a single result item
 */
function buildResultItemHTML(result: GlobalSearchResult, query: string, index: number): string {
    const { item, type } = result;
    const description = getItemDescription(item, type);
    const truncatedDesc = truncateText(description, 60);
    const tierClass = item.tier ? `tier-${item.tier.toLowerCase()}` : '';
    const imageHtml = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="" class="dropdown-item-image" loading="lazy">`
        : `<span class="dropdown-item-icon">${TYPE_LABELS[type].icon}</span>`;

    return `
        <div class="search-dropdown-item"
             data-index="${index}"
             data-type="${type}"
             data-id="${escapeHtml(item.id)}"
             role="option"
             tabindex="-1"
             aria-selected="false">
            <div class="dropdown-item-visual">
                ${imageHtml}
            </div>
            <div class="dropdown-item-info">
                <span class="dropdown-item-name">${highlightMatches(item.name, query)}</span>
                ${item.tier ? `<span class="tier-label ${tierClass}">${item.tier}</span>` : ''}
            </div>
            <div class="dropdown-item-desc">${escapeHtml(truncatedDesc)}</div>
            <span class="dropdown-item-arrow">→</span>
        </div>
    `;
}

/**
 * Get description text based on entity type
 */
function getItemDescription(item: Item | Weapon | Tome | Character | Shrine, type: EntityType): string {
    switch (type) {
        case 'items':
            return (item as Item).base_effect || item.description || '';
        case 'weapons':
            return (item as Weapon).attack_pattern || item.description || '';
        case 'tomes': {
            const tome = item as Tome;
            return `${tome.stat_affected || ''}: ${tome.value_per_level || ''}`.trim() || item.description || '';
        }
        case 'characters':
            return (item as Character).passive_ability || (item as Character).description || '';
        case 'shrines':
            return (item as Shrine).reward || item.description || '';
        default:
            return item.description || '';
    }
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update the visually focused item in the dropdown
 */
function updateFocusedItem(): void {
    const dropdown = safeGetElementById(DROPDOWN_ID);
    if (!dropdown) return;

    const items = dropdown.querySelectorAll('.search-dropdown-item');
    items.forEach((item, index) => {
        const isFocused = index === focusedIndex;
        item.classList.toggle('keyboard-focused', isFocused);
        item.setAttribute('aria-selected', isFocused ? 'true' : 'false');

        if (isFocused) {
            (item as HTMLElement).scrollIntoView({ block: 'nearest' });
        }
    });
}

/**
 * Select the currently focused item
 */
function selectFocusedItem(): void {
    const result = getSelectedResult();
    if (result) {
        navigateToResult(result);
    }
}

// ========================================
// Click Handler Setup
// ========================================

/**
 * Setup click handlers for dropdown items
 * Called once after the dropdown is created in the DOM
 */
export function setupDropdownClickHandlers(): void {
    const dropdown = safeGetElementById(DROPDOWN_ID);
    if (!dropdown) return;

    dropdown.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.search-dropdown-item') as HTMLElement | null;

        if (item) {
            const indexStr = item.dataset.index;
            if (indexStr !== undefined) {
                const index = parseInt(indexStr, 10);
                if (!isNaN(index) && index >= 0 && index < currentResults.length) {
                    navigateToResult(currentResults[index]);
                }
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const searchInput = safeGetElementById('searchInput');
        const dropdownEl = safeGetElementById(DROPDOWN_ID);

        if (
            isDropdownVisible &&
            target !== searchInput &&
            !dropdownEl?.contains(target) &&
            !target.closest('.search-box')
        ) {
            hideSearchDropdown();
        }
    });
}
