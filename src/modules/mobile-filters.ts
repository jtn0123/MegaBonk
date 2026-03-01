// ========================================
// Mobile Filter Bottom Sheet Module
// Thin entry point - orchestrates sheet UI and filter logic
// ========================================

import { getState, subscribe } from './store.ts';
import { safeGetElementById, safeQuerySelector } from './utils.ts';
import { logger } from './logger.ts';

// Import from sub-modules
import {
    createFilterSheet,
    renderFilterGroups,
    setupSheetEventListeners,
    handleKeyboardNavigation,
    handleFocusTrap,
    type FilterConfig,
} from './mobile-filter-sheet.ts';
import {
    syncFiltersToSheet,
    applyFiltersFromSheet,
    clearSheetFilters,

    updateFilterBadge as _updateFilterBadge,
} from './mobile-filter-logic.ts';

// ========================================
// Filter Configurations per Tab
// ========================================

type TabFilters = Record<string, FilterConfig[]>;

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
// Show/Hide Logic
// ========================================

/**
 * Show the filter bottom sheet
 */
export function showFilterSheet(): void {
    previouslyFocusedElement = document.activeElement as HTMLElement;

    const currentTab = getState('currentTab') || 'items';
    let sheet = safeGetElementById('filter-bottom-sheet');

    if (!TAB_FILTERS[currentTab]) {
        logger.debug({
            operation: 'mobile-filters.show',
            data: { tab: currentTab, reason: 'no_filters_for_tab' },
        });
        return;
    }

    if (sheet) {
        const content = sheet.querySelector('#filter-sheet-content');
        if (content) {
            const filters = TAB_FILTERS[currentTab] || [];
            content.innerHTML = renderFilterGroups(filters);
        }
    } else {
        const filters = TAB_FILTERS[currentTab] || [];
        sheet = createFilterSheet(currentTab, filters);
        document.body.appendChild(sheet);
        setupSheetEventListeners(sheet, hideFilterSheet, clearSheetFilters, applyFiltersFromSheet, updateFilterBadge);
    }

    syncFiltersToSheet();

    isSheetOpen = true;
    sheet.classList.add('active');
    document.body.classList.add('filter-sheet-open');

    document.addEventListener('keydown', _handleKeyboardNavigation);
    document.addEventListener('keydown', _handleFocusTrap);

    requestAnimationFrame(() => {
        const firstInput = sheet?.querySelector<HTMLElement>('select, input');
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

    document.removeEventListener('keydown', _handleKeyboardNavigation);
    document.removeEventListener('keydown', _handleFocusTrap);

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

// Wrapper functions for keyboard handlers that pass current state
function _handleKeyboardNavigation(e: KeyboardEvent): void {
    handleKeyboardNavigation(e, isSheetOpen, hideFilterSheet);
}

function _handleFocusTrap(e: KeyboardEvent): void {
    handleFocusTrap(e, isSheetOpen);
}

/**
 * Update filter badge (bound to TAB_FILTERS)
 */
export function updateFilterBadge(): void {
    _updateFilterBadge(TAB_FILTERS);
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

    if (safeQuerySelector('.mobile-filter-btn')) return;

    const btn = createMobileFilterButton();

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
    injectMobileFilterButton();

    subscribe('currentTab', () => {
        setTimeout(() => {
            updateFilterBadge();
        }, 100);
    });

    const filtersContainer = safeGetElementById('filters');
    if (filtersContainer) {
        filtersContainer.addEventListener('change', () => {
            updateFilterBadge();
        });
    }

    updateFilterBadge();

    logger.info({
        operation: 'mobile-filters.init',
        data: { status: 'initialized' },
    });
}

// Export for external use
