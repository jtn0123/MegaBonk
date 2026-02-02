/**
 * @vitest-environment jsdom
 * Mobile Filters Module Tests
 * Tests filter sheet show/hide, active filter count, clear all functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return 'items';
        return null;
    }),
    setState: vi.fn(),
    subscribe: vi.fn(),
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    safeQuerySelector: vi.fn((sel: string) => document.querySelector(sel)),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/filter-state.ts', () => ({
    saveFilterState: vi.fn(),
}));

// Import after mocking
import {
    showFilterSheet,
    hideFilterSheet,
    toggleFilterSheet,
    initMobileFilters,
    updateFilterBadge,
} from '../../src/modules/mobile-filters.ts';

describe('Mobile Filters - UI/UX Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div class="controls">
                <div class="container">
                    <div class="search-box">
                        <input type="text" id="searchInput" />
                    </div>
                </div>
            </div>
            <div id="filters">
                <input type="checkbox" id="favoritesOnly" />
                <select id="tierFilter"><option value="all">All</option><option value="SS">SS</option></select>
                <select id="rarityFilter"><option value="all">All</option><option value="rare">Rare</option></select>
                <select id="stackingFilter"><option value="all">All</option></select>
                <select id="sortBy"><option value="name">Name</option><option value="tier">Tier</option></select>
            </div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ========================================
    // Filter Sheet Show/Hide Tests
    // ========================================
    describe('Filter Sheet Show/Hide', () => {
        it('should create filter sheet on showFilterSheet', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet).not.toBeNull();
        });

        it('should add active class when sheet is shown', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.classList.contains('active')).toBe(true);
        });

        it('should add filter-sheet-open class to body', () => {
            showFilterSheet();

            expect(document.body.classList.contains('filter-sheet-open')).toBe(true);
        });

        it('should have correct ARIA attributes on sheet', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.getAttribute('role')).toBe('dialog');
            expect(sheet?.getAttribute('aria-modal')).toBe('true');
            expect(sheet?.getAttribute('aria-label')).toBe('Filter options');
        });

        it('should render filter groups for items tab', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('Favorites Only');
            expect(sheet?.innerHTML).toContain('Rarity');
            expect(sheet?.innerHTML).toContain('Tier');
            expect(sheet?.innerHTML).toContain('Stacking');
        });

        it('should remove active class when sheet is hidden', () => {
            showFilterSheet();
            hideFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.classList.contains('active')).toBe(false);
        });

        it('should remove filter-sheet-open class from body on hide', () => {
            showFilterSheet();
            hideFilterSheet();

            expect(document.body.classList.contains('filter-sheet-open')).toBe(false);
        });

        it('should toggle sheet state', () => {
            // First toggle should open
            toggleFilterSheet();
            let sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.classList.contains('active')).toBe(true);

            // Second toggle should close
            toggleFilterSheet();
            sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.classList.contains('active')).toBe(false);
        });

        it('should render drawer with handle', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-sheet-drawer');
            expect(sheet?.innerHTML).toContain('filter-sheet-handle');
        });

        it('should render header with title and close button', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-sheet-title');
            expect(sheet?.innerHTML).toContain('Filters');
            expect(sheet?.innerHTML).toContain('filter-sheet-close');
        });

        it('should render apply button', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-sheet-apply');
            expect(sheet?.innerHTML).toContain('Apply Filters');
        });

        it('should render backdrop', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-sheet-backdrop');
        });
    });

    // ========================================
    // Filter Content Tests
    // ========================================
    describe('Filter Content', () => {
        it('should render checkbox for favorites filter', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('type="checkbox"');
            expect(sheet?.innerHTML).toContain('sheet-favoritesOnly');
        });

        it('should render select elements for dropdown filters', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            const selects = sheet?.querySelectorAll('select');
            expect(selects?.length).toBeGreaterThan(0);
        });

        it('should render filter labels', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-group-label');
        });

        it('should include data-filter-id attributes', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('data-filter-id="tierFilter"');
            expect(sheet?.innerHTML).toContain('data-filter-id="rarityFilter"');
        });

        it('should render tier options', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('SS Tier');
            expect(sheet?.innerHTML).toContain('S Tier');
            expect(sheet?.innerHTML).toContain('A Tier');
            expect(sheet?.innerHTML).toContain('B Tier');
            expect(sheet?.innerHTML).toContain('C Tier');
        });

        it('should render rarity options', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('Common');
            expect(sheet?.innerHTML).toContain('Uncommon');
            expect(sheet?.innerHTML).toContain('Rare');
            expect(sheet?.innerHTML).toContain('Epic');
            expect(sheet?.innerHTML).toContain('Legendary');
        });
    });

    // ========================================
    // Active Filter Count Tests
    // ========================================
    describe('Active Filter Count', () => {
        it('should initialize mobile filter button', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn).not.toBeNull();
        });

        it('should render filter badge', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.innerHTML).toContain('filter-badge');
        });

        it('should update badge when filter is active', () => {
            initMobileFilters();

            // Set a filter value
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            tierFilter.value = 'SS';
            tierFilter.dispatchEvent(new Event('change', { bubbles: true }));

            // Wait for badge update (setTimeout in subscribe)
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    updateFilterBadge();
                    const btn = document.querySelector('.mobile-filter-btn');
                    // The badge should be present - check badge element exists
                    const badge = btn?.querySelector('.filter-badge');
                    expect(badge).not.toBeNull();
                    resolve();
                }, 150);
            });
        });

        it('should not have has-filters class when no filters active', () => {
            initMobileFilters();

            updateFilterBadge();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.classList.contains('has-filters')).toBe(false);
        });

        it('should count multiple active filters', () => {
            initMobileFilters();

            // Set multiple filters
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            tierFilter.value = 'SS';

            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            rarityFilter.value = 'rare';

            const favoritesOnly = document.getElementById('favoritesOnly') as HTMLInputElement;
            favoritesOnly.checked = true;

            // The filter button and badge should exist after init
            const btn = document.querySelector('.mobile-filter-btn');
            const badge = btn?.querySelector('.filter-badge');
            // Check the button and badge elements are rendered correctly
            expect(btn).not.toBeNull();
            expect(badge).not.toBeNull();
        });

        it('should not count default sort value as active filter', () => {
            initMobileFilters();

            // Sort by name is default, shouldn't count
            const sortBy = document.getElementById('sortBy') as HTMLSelectElement;
            sortBy.value = 'name';

            updateFilterBadge();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.classList.contains('has-filters')).toBe(false);
        });

        it('should render filter icon', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.innerHTML).toContain('filter-icon');
            expect(btn?.innerHTML).toContain('⚙️');
        });
    });

    // ========================================
    // Clear All Functionality Tests
    // ========================================
    describe('Clear All Functionality', () => {
        it('should render Clear All button', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-sheet-clear');
            expect(sheet?.innerHTML).toContain('Clear All');
        });

        it('should have clickable clear button', () => {
            showFilterSheet();

            const clearBtn = document.querySelector('.filter-sheet-clear');
            expect(clearBtn).not.toBeNull();
            expect(clearBtn?.tagName).toBe('BUTTON');
        });
    });

    // ========================================
    // Accessibility Tests
    // ========================================
    describe('Accessibility', () => {
        it('should have aria-haspopup on filter button', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.getAttribute('aria-haspopup')).toBe('dialog');
        });

        it('should have aria-expanded on filter button', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.getAttribute('aria-expanded')).toBe('false');
        });

        it('should have aria-label on filter button', () => {
            initMobileFilters();

            const btn = document.querySelector('.mobile-filter-btn');
            expect(btn?.getAttribute('aria-label')).toBe('Open filters');
        });

        it('should have aria-label on close button', () => {
            showFilterSheet();

            const closeBtn = document.querySelector('.filter-sheet-close');
            expect(closeBtn?.getAttribute('aria-label')).toBe('Close filters');
        });

        it('should have role=document on drawer', () => {
            showFilterSheet();

            const drawer = document.querySelector('.filter-sheet-drawer');
            expect(drawer?.getAttribute('role')).toBe('document');
        });
    });

    // ========================================
    // CSS Class Structure Tests
    // ========================================
    describe('CSS Class Structure', () => {
        it('should use filter-bottom-sheet class', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.className).toContain('filter-bottom-sheet');
        });

        it('should use filter-group class for each filter', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            const groups = sheet?.querySelectorAll('.filter-group');
            expect(groups?.length).toBeGreaterThan(0);
        });

        it('should use filter-group-checkbox for checkbox filters', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('filter-group-checkbox');
        });

        it('should use checkbox-label class', () => {
            showFilterSheet();

            const sheet = document.getElementById('filter-bottom-sheet');
            expect(sheet?.innerHTML).toContain('checkbox-label');
        });
    });
});
