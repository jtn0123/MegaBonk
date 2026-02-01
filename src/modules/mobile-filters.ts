// ========================================
// Mobile Filter Bottom Sheet Module
// ========================================
// Provides a mobile-friendly bottom sheet for filter options
// Similar UX to the more-menu drawer
// ========================================

import { getState, subscribe } from './store.ts';
import { safeGetElementById, safeQuerySelector } from './utils.ts';
import { logger } from './logger.ts';
import { saveFilterState } from './filter-state.ts';

// ========================================
// Types
// ========================================

interface FilterConfig {
    id: string;
    label: string;
    type: 'select' | 'checkbox';
    options?: { value: string; label: string }[];
}

type TabFilters = Record<string, FilterConfig[]>;

// ========================================
// Filter Configurations per Tab
// ========================================

const TAB_FILTERS: TabFilters = {
    items: [
        {
            id: 'favoritesOnly',
            label: '⭐ Favorites Only',
            type: 'checkbox',
        },
        {
            id: 'rarityFilter',
            label: 'Rarity',
            type: 'select',
            options: [
                { value: 'all', label: 'All Rarities' },
                { value: 'common', label: 'Common' },
                { value: 'uncommon', label: 'Uncommon' },
                { value: 'rare', label: 'Rare' },
                { value: 'epic', label: 'Epic' },
                { value: 'legendary', label: 'Legendary' },
            ],
        },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'stackingFilter',
            label: 'Stacking',
            type: 'select',
            options: [
                { value: 'all', label: 'All' },
                { value: 'stacks_well', label: 'Stacks Well' },
                { value: 'one_and_done', label: 'One-and-Done' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
                { value: 'rarity', label: 'Rarity' },
            ],
        },
    ],
    weapons: [
        {
            id: 'favoritesOnly',
            label: '⭐ Favorites Only',
            type: 'checkbox',
        },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    tomes: [
        {
            id: 'favoritesOnly',
            label: '⭐ Favorites Only',
            type: 'checkbox',
        },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    characters: [
        {
            id: 'favoritesOnly',
            label: '⭐ Favorites Only',
            type: 'checkbox',
        },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    shrines: [
        {
            id: 'favoritesOnly',
            label: '⭐ Favorites Only',
            type: 'checkbox',
        },
        {
            id: 'typeFilter',
            label: 'Type',
            type: 'select',
            options: [
                { value: 'all', label: 'All Types' },
                { value: 'stat_upgrade', label: 'Stat Upgrade' },
                { value: 'combat', label: 'Combat' },
                { value: 'utility', label: 'Utility' },
                { value: 'risk_reward', label: 'Risk/Reward' },
            ],
        },
    ],
    changelog: [
        {
            id: 'categoryFilter',
            label: 'Category',
            type: 'select',
            options: [
                { value: 'all', label: 'All Categories' },
                { value: 'balance', label: 'Balance Changes' },
                { value: 'new_content', label: 'New Content' },
                { value: 'bug_fixes', label: 'Bug Fixes' },
                { value: 'removed', label: 'Removed' },
                { value: 'other', label: 'Other' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'date_desc', label: 'Newest First' },
                { value: 'date_asc', label: 'Oldest First' },
            ],
        },
    ],
};

// ========================================
// State
// ========================================

let isSheetOpen = false;
let previouslyFocusedElement: HTMLElement | null = null;

// ========================================
// Filter Bottom Sheet Component
// ========================================

/**
 * Create the filter bottom sheet HTML
 */
function createFilterSheet(tabName: string): HTMLElement {
    const sheet = document.createElement('div');
    sheet.id = 'filter-bottom-sheet';
    sheet.className = 'filter-bottom-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Filter options');

    const filters = TAB_FILTERS[tabName] || [];

    sheet.innerHTML = `
        <div class="filter-sheet-backdrop" aria-hidden="true"></div>
        <div class="filter-sheet-drawer" role="document">
            <div class="filter-sheet-handle" aria-hidden="true"></div>
            <div class="filter-sheet-header">
                <span class="filter-sheet-title" id="filter-sheet-title">Filters</span>
                <div class="filter-sheet-actions">
                    <button class="filter-sheet-clear" type="button">Clear All</button>
                    <button class="filter-sheet-close" aria-label="Close filters" type="button">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            </div>
            <div class="filter-sheet-content" id="filter-sheet-content">
                ${renderFilterGroups(filters)}
            </div>
            <div class="filter-sheet-apply">
                <button type="button" id="filter-sheet-apply-btn">Apply Filters</button>
            </div>
        </div>
    `;

    return sheet;
}

/**
 * Render filter groups HTML
 */
function renderFilterGroups(filters: FilterConfig[]): string {
    return filters
        .map(filter => {
            if (filter.type === 'checkbox') {
                return `
                    <div class="filter-group">
                        <label class="filter-group-checkbox">
                            <input type="checkbox" id="sheet-${filter.id}" data-filter-id="${filter.id}" />
                            <span class="checkbox-label">${filter.label}</span>
                        </label>
                    </div>
                `;
            } else {
                return `
                    <div class="filter-group">
                        <label class="filter-group-label" for="sheet-${filter.id}">${filter.label}</label>
                        <select id="sheet-${filter.id}" data-filter-id="${filter.id}">
                            ${filter.options?.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                        </select>
                    </div>
                `;
            }
        })
        .join('');
}

/**
 * Sync filter values from main filters to bottom sheet
 */
function syncFiltersToSheet(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        const filterId = sheetInput.dataset.filterId;
        if (!filterId) return;

        const mainInput = safeGetElementById(filterId) as HTMLInputElement | HTMLSelectElement | null;

        if (mainInput) {
            if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
                sheetInput.checked = (mainInput as HTMLInputElement).checked;
            } else if (sheetInput instanceof HTMLSelectElement && mainInput instanceof HTMLSelectElement) {
                sheetInput.value = mainInput.value;
            }
        }
    });
}

/**
 * Apply filter values from bottom sheet to main filters
 */
function applyFiltersFromSheet(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        const filterId = sheetInput.dataset.filterId;
        if (!filterId) return;

        const mainInput = safeGetElementById(filterId) as HTMLInputElement | HTMLSelectElement | null;

        if (mainInput) {
            if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
                (mainInput as HTMLInputElement).checked = sheetInput.checked;
            } else if (sheetInput instanceof HTMLSelectElement && mainInput instanceof HTMLSelectElement) {
                mainInput.value = sheetInput.value;
            }

            // Trigger change event on main input to update UI
            mainInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // Save filter state
    const currentTab = getState('currentTab');
    if (currentTab) {
        saveFilterState(currentTab);
    }
}

/**
 * Clear all filters in the bottom sheet
 */
function clearSheetFilters(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const sheetInputs = sheet.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-filter-id]');

    sheetInputs.forEach(sheetInput => {
        if (sheetInput instanceof HTMLInputElement && sheetInput.type === 'checkbox') {
            sheetInput.checked = false;
        } else if (sheetInput instanceof HTMLSelectElement) {
            sheetInput.value = 'all';
        }
    });
}

/**
 * Count active filters
 */
function countActiveFilters(): number {
    let count = 0;
    const currentTab = getState('currentTab');
    const filters = TAB_FILTERS[currentTab || ''] || [];

    filters.forEach(filter => {
        const input = safeGetElementById(filter.id) as HTMLInputElement | HTMLSelectElement | null;
        if (!input) return;

        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            if (input.checked) count++;
        } else if (input instanceof HTMLSelectElement) {
            if (input.value !== 'all' && input.value !== 'name' && input.value !== 'date_desc') {
                count++;
            }
        }
    });

    return count;
}

/**
 * Update filter button badge
 */
function updateFilterBadge(): void {
    const btn = safeQuerySelector('.mobile-filter-btn') as HTMLElement | null;
    if (!btn) return;

    const count = countActiveFilters();
    const badge = btn.querySelector('.filter-badge') as HTMLElement | null;

    if (badge) {
        badge.textContent = count.toString();
    }

    btn.classList.toggle('has-filters', count > 0);
}

// ========================================
// Show/Hide Logic
// ========================================

/**
 * Handle keyboard navigation within sheet
 */
function handleKeyboardNavigation(e: KeyboardEvent): void {
    if (!isSheetOpen) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        hideFilterSheet();
    }
}

/**
 * Handle focus trapping
 */
function handleFocusTrap(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !isSheetOpen) return;

    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    const focusableElements = Array.from(
        sheet.querySelectorAll<HTMLElement>(
            'button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'
        )
    ).filter(el => el.offsetParent !== null);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        }
    } else {
        if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
        }
    }
}

/**
 * Show the filter bottom sheet
 */
export function showFilterSheet(): void {
    previouslyFocusedElement = document.activeElement as HTMLElement;

    const currentTab = getState('currentTab') || 'items';
    let sheet = safeGetElementById('filter-bottom-sheet');

    // Check if filters exist for this tab
    if (!TAB_FILTERS[currentTab]) {
        logger.debug({
            operation: 'mobile-filters.show',
            data: { tab: currentTab, reason: 'no_filters_for_tab' },
        });
        return;
    }

    if (!sheet) {
        sheet = createFilterSheet(currentTab);
        document.body.appendChild(sheet);
        setupSheetEventListeners(sheet);
    } else {
        // Update content if tab changed
        const content = sheet.querySelector('#filter-sheet-content');
        if (content) {
            const filters = TAB_FILTERS[currentTab] || [];
            content.innerHTML = renderFilterGroups(filters);
        }
    }

    // Sync current filter values
    syncFiltersToSheet();

    isSheetOpen = true;
    sheet.classList.add('active');
    document.body.classList.add('filter-sheet-open');

    // Add keyboard listeners
    document.addEventListener('keydown', handleKeyboardNavigation);
    document.addEventListener('keydown', handleFocusTrap);

    // Focus first input after animation
    requestAnimationFrame(() => {
        const firstInput = sheet!.querySelector('select, input') as HTMLElement;
        firstInput?.focus();
    });

    logger.debug({
        operation: 'mobile-filters.sheet',
        data: { action: 'open', tab: currentTab },
    });
}

/**
 * Hide the filter bottom sheet
 */
export function hideFilterSheet(): void {
    const sheet = safeGetElementById('filter-bottom-sheet');
    if (!sheet) return;

    isSheetOpen = false;
    sheet.classList.remove('active');
    document.body.classList.remove('filter-sheet-open');

    // Remove keyboard listeners
    document.removeEventListener('keydown', handleKeyboardNavigation);
    document.removeEventListener('keydown', handleFocusTrap);

    // Restore focus
    if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
        previouslyFocusedElement = null;
    }

    logger.debug({
        operation: 'mobile-filters.sheet',
        data: { action: 'close' },
    });
}

/**
 * Toggle the filter bottom sheet
 */
export function toggleFilterSheet(): void {
    if (isSheetOpen) {
        hideFilterSheet();
    } else {
        showFilterSheet();
    }
}

/**
 * Setup event listeners for the sheet
 */
function setupSheetEventListeners(sheet: HTMLElement): void {
    // Backdrop click to close
    const backdrop = sheet.querySelector('.filter-sheet-backdrop');
    backdrop?.addEventListener('click', hideFilterSheet);

    // Close button
    const closeBtn = sheet.querySelector('.filter-sheet-close');
    closeBtn?.addEventListener('click', hideFilterSheet);

    // Clear button
    const clearBtn = sheet.querySelector('.filter-sheet-clear');
    clearBtn?.addEventListener('click', () => {
        clearSheetFilters();
    });

    // Apply button
    const applyBtn = sheet.querySelector('#filter-sheet-apply-btn');
    applyBtn?.addEventListener('click', () => {
        applyFiltersFromSheet();
        hideFilterSheet();
        updateFilterBadge();
    });
}

/**
 * Create the mobile filter button
 */
function createMobileFilterButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'mobile-filter-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open filters');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');

    btn.innerHTML = `
        <span class="filter-icon" aria-hidden="true">⚙️</span>
        <span>Filters</span>
        <span class="filter-badge" aria-hidden="true">0</span>
    `;

    btn.addEventListener('click', () => {
        toggleFilterSheet();
        btn.setAttribute('aria-expanded', isSheetOpen ? 'true' : 'false');
    });

    return btn;
}

/**
 * Inject the mobile filter button into the controls
 */
function injectMobileFilterButton(): void {
    const controls = safeQuerySelector('.controls .container');
    if (!controls) return;

    // Check if button already exists
    if (safeQuerySelector('.mobile-filter-btn')) return;

    const btn = createMobileFilterButton();

    // Insert after search box
    const searchBox = controls.querySelector('.search-box');
    if (searchBox) {
        searchBox.after(btn);
    } else {
        controls.appendChild(btn);
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize mobile filters
 */
export function initMobileFilters(): void {
    // Inject the mobile filter button
    injectMobileFilterButton();

    // Subscribe to tab changes to update badge
    subscribe('currentTab', () => {
        // Small delay to let filters update
        setTimeout(() => {
            updateFilterBadge();
        }, 100);
    });

    // Also listen for filter changes on main filters
    const filtersContainer = safeGetElementById('filters');
    if (filtersContainer) {
        filtersContainer.addEventListener('change', () => {
            updateFilterBadge();
        });
    }

    // Initial badge update
    updateFilterBadge();

    logger.info({
        operation: 'mobile-filters.init',
        data: { status: 'initialized' },
    });
}

// Export for external use
export { updateFilterBadge };
