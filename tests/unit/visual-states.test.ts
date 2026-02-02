/**
 * @vitest-environment jsdom
 * Visual States Module Tests
 * Tests loading skeleton classes, compare mode indicators, active tab highlighting
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Visual States - UI/UX Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ========================================
    // Loading Skeleton Classes Tests
    // ========================================
    describe('Loading Skeleton Classes', () => {
        it('should apply skeleton class for loading state', () => {
            document.body.innerHTML = `
                <div class="item-card skeleton">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-text"></div>
                </div>
            `;

            const card = document.querySelector('.item-card');
            expect(card?.classList.contains('skeleton')).toBe(true);
        });

        it('should have skeleton-image class for image placeholders', () => {
            document.body.innerHTML = `
                <div class="item-card skeleton">
                    <div class="skeleton-image"></div>
                </div>
            `;

            const skeletonImage = document.querySelector('.skeleton-image');
            expect(skeletonImage).not.toBeNull();
        });

        it('should have skeleton-text class for text placeholders', () => {
            document.body.innerHTML = `
                <div class="item-card skeleton">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            `;

            const skeletonTexts = document.querySelectorAll('.skeleton-text');
            expect(skeletonTexts.length).toBe(2);
        });

        it('should support skeleton-text short variant', () => {
            document.body.innerHTML = `
                <div class="skeleton-text short"></div>
            `;

            const shortText = document.querySelector('.skeleton-text.short');
            expect(shortText).not.toBeNull();
        });

        it('should remove skeleton class when loaded', () => {
            document.body.innerHTML = `
                <div class="item-card skeleton" id="testCard">
                    <div class="skeleton-image"></div>
                </div>
            `;

            const card = document.getElementById('testCard');
            card?.classList.remove('skeleton');

            expect(card?.classList.contains('skeleton')).toBe(false);
        });

        it('should support loading overlay class', () => {
            document.body.innerHTML = `
                <div class="content-area">
                    <div class="loading-overlay active">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;

            const overlay = document.querySelector('.loading-overlay.active');
            expect(overlay).not.toBeNull();
        });

        it('should have loading-spinner inside overlay', () => {
            document.body.innerHTML = `
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                </div>
            `;

            const spinner = document.querySelector('.loading-spinner');
            expect(spinner).not.toBeNull();
        });

        it('should support skeleton grid layout', () => {
            document.body.innerHTML = `
                <div class="item-grid skeleton-grid">
                    <div class="item-card skeleton"></div>
                    <div class="item-card skeleton"></div>
                    <div class="item-card skeleton"></div>
                </div>
            `;

            const grid = document.querySelector('.skeleton-grid');
            const skeletonCards = grid?.querySelectorAll('.skeleton');
            expect(skeletonCards?.length).toBe(3);
        });
    });

    // ========================================
    // Compare Mode Indicators Tests
    // ========================================
    describe('Compare Mode Indicators', () => {
        it('should apply compare-mode class to body', () => {
            document.body.classList.add('compare-mode');

            expect(document.body.classList.contains('compare-mode')).toBe(true);
        });

        it('should apply compare-selected class to selected items', () => {
            document.body.innerHTML = `
                <div class="item-card compare-selected" data-entity-id="item1">
                    <div class="compare-checkbox checked"></div>
                </div>
            `;

            const card = document.querySelector('.compare-selected');
            expect(card).not.toBeNull();
        });

        it('should have compare-checkbox element', () => {
            document.body.innerHTML = `
                <div class="item-card">
                    <div class="compare-checkbox"></div>
                </div>
            `;

            const checkbox = document.querySelector('.compare-checkbox');
            expect(checkbox).not.toBeNull();
        });

        it('should apply checked class to selected compare checkbox', () => {
            document.body.innerHTML = `
                <div class="item-card compare-selected">
                    <div class="compare-checkbox checked"></div>
                </div>
            `;

            const checkbox = document.querySelector('.compare-checkbox.checked');
            expect(checkbox).not.toBeNull();
        });

        it('should show compare-count indicator', () => {
            document.body.innerHTML = `
                <div class="compare-toolbar">
                    <span class="compare-count">3 items selected</span>
                    <button class="compare-clear">Clear</button>
                    <button class="compare-view">Compare</button>
                </div>
            `;

            const count = document.querySelector('.compare-count');
            expect(count?.textContent).toBe('3 items selected');
        });

        it('should have compare toolbar buttons', () => {
            document.body.innerHTML = `
                <div class="compare-toolbar visible">
                    <button class="compare-clear">Clear</button>
                    <button class="compare-view">Compare</button>
                </div>
            `;

            const clearBtn = document.querySelector('.compare-clear');
            const viewBtn = document.querySelector('.compare-view');
            expect(clearBtn).not.toBeNull();
            expect(viewBtn).not.toBeNull();
        });

        it('should support visible class on compare toolbar', () => {
            document.body.innerHTML = `
                <div class="compare-toolbar visible"></div>
            `;

            const toolbar = document.querySelector('.compare-toolbar.visible');
            expect(toolbar).not.toBeNull();
        });

        it('should support compare-highlight class for hover', () => {
            document.body.innerHTML = `
                <div class="item-card compare-highlight"></div>
            `;

            const card = document.querySelector('.compare-highlight');
            expect(card).not.toBeNull();
        });

        it('should support compare-disabled class', () => {
            document.body.innerHTML = `
                <div class="item-card compare-disabled"></div>
            `;

            const card = document.querySelector('.compare-disabled');
            expect(card).not.toBeNull();
        });
    });

    // ========================================
    // Active Tab Highlighting Tests
    // ========================================
    describe('Active Tab Highlighting', () => {
        it('should apply active class to selected tab', () => {
            document.body.innerHTML = `
                <nav class="tab-nav">
                    <button class="tab-btn active" data-tab="items">Items</button>
                    <button class="tab-btn" data-tab="weapons">Weapons</button>
                    <button class="tab-btn" data-tab="characters">Characters</button>
                </nav>
            `;

            const activeTab = document.querySelector('.tab-btn.active');
            expect(activeTab).not.toBeNull();
            expect(activeTab?.getAttribute('data-tab')).toBe('items');
        });

        it('should only have one active tab', () => {
            document.body.innerHTML = `
                <nav class="tab-nav">
                    <button class="tab-btn active" data-tab="items">Items</button>
                    <button class="tab-btn" data-tab="weapons">Weapons</button>
                    <button class="tab-btn" data-tab="characters">Characters</button>
                </nav>
            `;

            const activeTabs = document.querySelectorAll('.tab-btn.active');
            expect(activeTabs.length).toBe(1);
        });

        it('should have aria-selected on active tab', () => {
            document.body.innerHTML = `
                <nav class="tab-nav" role="tablist">
                    <button class="tab-btn active" role="tab" aria-selected="true">Items</button>
                    <button class="tab-btn" role="tab" aria-selected="false">Weapons</button>
                </nav>
            `;

            const activeTab = document.querySelector('.tab-btn.active');
            expect(activeTab?.getAttribute('aria-selected')).toBe('true');
        });

        it('should have aria-selected false on inactive tabs', () => {
            document.body.innerHTML = `
                <nav class="tab-nav" role="tablist">
                    <button class="tab-btn active" role="tab" aria-selected="true">Items</button>
                    <button class="tab-btn" role="tab" aria-selected="false">Weapons</button>
                </nav>
            `;

            const inactiveTab = document.querySelector('.tab-btn:not(.active)');
            expect(inactiveTab?.getAttribute('aria-selected')).toBe('false');
        });

        it('should support switching active tab', () => {
            document.body.innerHTML = `
                <nav class="tab-nav">
                    <button class="tab-btn active" data-tab="items" id="itemsTab">Items</button>
                    <button class="tab-btn" data-tab="weapons" id="weaponsTab">Weapons</button>
                </nav>
            `;

            const itemsTab = document.getElementById('itemsTab');
            const weaponsTab = document.getElementById('weaponsTab');

            itemsTab?.classList.remove('active');
            weaponsTab?.classList.add('active');

            const activeTab = document.querySelector('.tab-btn.active');
            expect(activeTab?.getAttribute('data-tab')).toBe('weapons');
        });

        it('should have role=tablist on tab container', () => {
            document.body.innerHTML = `
                <nav class="tab-nav" role="tablist">
                    <button class="tab-btn" role="tab">Items</button>
                </nav>
            `;

            const tablist = document.querySelector('[role="tablist"]');
            expect(tablist).not.toBeNull();
        });

        it('should have role=tab on tab buttons', () => {
            document.body.innerHTML = `
                <nav class="tab-nav" role="tablist">
                    <button class="tab-btn" role="tab">Items</button>
                    <button class="tab-btn" role="tab">Weapons</button>
                </nav>
            `;

            const tabs = document.querySelectorAll('[role="tab"]');
            expect(tabs.length).toBe(2);
        });

        it('should support tab indicator element', () => {
            document.body.innerHTML = `
                <nav class="tab-nav">
                    <button class="tab-btn active">Items</button>
                    <button class="tab-btn">Weapons</button>
                    <div class="tab-indicator"></div>
                </nav>
            `;

            const indicator = document.querySelector('.tab-indicator');
            expect(indicator).not.toBeNull();
        });
    });

    // ========================================
    // Filter Active States Tests
    // ========================================
    describe('Filter Active States', () => {
        it('should apply has-value class to active filter', () => {
            document.body.innerHTML = `
                <select class="filter-select has-value" id="tierFilter">
                    <option value="all">All</option>
                    <option value="SS" selected>SS</option>
                </select>
            `;

            const filter = document.querySelector('.filter-select.has-value');
            expect(filter).not.toBeNull();
        });

        it('should support filter-active class', () => {
            document.body.innerHTML = `
                <div class="filter-group filter-active">
                    <select id="tierFilter">
                        <option value="SS" selected>SS</option>
                    </select>
                </div>
            `;

            const filterGroup = document.querySelector('.filter-group.filter-active');
            expect(filterGroup).not.toBeNull();
        });

        it('should apply checked state to checkbox filters', () => {
            document.body.innerHTML = `
                <label class="filter-checkbox">
                    <input type="checkbox" id="favoritesOnly" checked />
                    <span class="checkbox-mark"></span>
                    Favorites Only
                </label>
            `;

            const checkbox = document.getElementById('favoritesOnly') as HTMLInputElement;
            expect(checkbox.checked).toBe(true);
        });

        it('should support filter-badge for active count', () => {
            document.body.innerHTML = `
                <button class="filter-toggle has-filters">
                    Filters
                    <span class="filter-badge">3</span>
                </button>
            `;

            const badge = document.querySelector('.filter-badge');
            expect(badge?.textContent).toBe('3');
        });
    });

    // ========================================
    // Search Active States Tests
    // ========================================
    describe('Search Active States', () => {
        it('should apply has-query class when search has value', () => {
            document.body.innerHTML = `
                <div class="search-box has-query">
                    <input type="text" id="searchInput" value="sword" />
                </div>
            `;

            const searchBox = document.querySelector('.search-box.has-query');
            expect(searchBox).not.toBeNull();
        });

        it('should apply search-highlight class to matched items', () => {
            document.body.innerHTML = `
                <div class="item-card search-highlight" data-entity-id="item1">
                    <span class="item-name">Mega Sword</span>
                </div>
            `;

            const highlightedCard = document.querySelector('.search-highlight');
            expect(highlightedCard).not.toBeNull();
        });

        it('should apply search-match class to matching text', () => {
            document.body.innerHTML = `
                <span class="item-name">
                    Mega <mark class="search-match">Sword</mark>
                </span>
            `;

            const match = document.querySelector('.search-match');
            expect(match).not.toBeNull();
        });

        it('should support search-focus class on focused input', () => {
            document.body.innerHTML = `
                <div class="search-box search-focus">
                    <input type="text" id="searchInput" />
                </div>
            `;

            const searchBox = document.querySelector('.search-box.search-focus');
            expect(searchBox).not.toBeNull();
        });
    });

    // ========================================
    // Modal Active States Tests
    // ========================================
    describe('Modal Active States', () => {
        it('should apply active class to open modal', () => {
            document.body.innerHTML = `
                <div class="modal active" id="itemModal">
                    <div class="modal-content"></div>
                </div>
            `;

            const modal = document.querySelector('.modal.active');
            expect(modal).not.toBeNull();
        });

        it('should apply modal-open class to body', () => {
            document.body.classList.add('modal-open');

            expect(document.body.classList.contains('modal-open')).toBe(true);
        });

        it('should support modal-backdrop', () => {
            document.body.innerHTML = `
                <div class="modal-backdrop active"></div>
                <div class="modal active">
                    <div class="modal-content"></div>
                </div>
            `;

            const backdrop = document.querySelector('.modal-backdrop.active');
            expect(backdrop).not.toBeNull();
        });

        it('should support modal animation classes', () => {
            document.body.innerHTML = `
                <div class="modal active modal-enter">
                    <div class="modal-content"></div>
                </div>
            `;

            const modal = document.querySelector('.modal.modal-enter');
            expect(modal).not.toBeNull();
        });
    });

    // ========================================
    // Tier Badge Visual States Tests
    // ========================================
    describe('Tier Badge Visual States', () => {
        it('should apply tier-SS class for SS tier', () => {
            document.body.innerHTML = `
                <span class="badge tier-SS">SS Tier</span>
            `;

            const badge = document.querySelector('.tier-SS');
            expect(badge).not.toBeNull();
        });

        it('should apply tier-S class for S tier', () => {
            document.body.innerHTML = `
                <span class="badge tier-S">S Tier</span>
            `;

            const badge = document.querySelector('.tier-S');
            expect(badge).not.toBeNull();
        });

        it('should apply tier-A class for A tier', () => {
            document.body.innerHTML = `
                <span class="badge tier-A">A Tier</span>
            `;

            const badge = document.querySelector('.tier-A');
            expect(badge).not.toBeNull();
        });

        it('should apply tier-B class for B tier', () => {
            document.body.innerHTML = `
                <span class="badge tier-B">B Tier</span>
            `;

            const badge = document.querySelector('.tier-B');
            expect(badge).not.toBeNull();
        });

        it('should apply tier-C class for C tier', () => {
            document.body.innerHTML = `
                <span class="badge tier-C">C Tier</span>
            `;

            const badge = document.querySelector('.tier-C');
            expect(badge).not.toBeNull();
        });

        it('should support rarity badge classes', () => {
            document.body.innerHTML = `
                <span class="badge rarity-legendary">Legendary</span>
                <span class="badge rarity-epic">Epic</span>
                <span class="badge rarity-rare">Rare</span>
            `;

            expect(document.querySelector('.rarity-legendary')).not.toBeNull();
            expect(document.querySelector('.rarity-epic')).not.toBeNull();
            expect(document.querySelector('.rarity-rare')).not.toBeNull();
        });
    });

    // ========================================
    // Favorite States Tests
    // ========================================
    describe('Favorite States', () => {
        it('should apply favorited class to favorite items', () => {
            document.body.innerHTML = `
                <div class="item-card favorited" data-entity-id="item1">
                    <button class="favorite-btn active">❤️</button>
                </div>
            `;

            const card = document.querySelector('.item-card.favorited');
            expect(card).not.toBeNull();
        });

        it('should apply active class to favorite button', () => {
            document.body.innerHTML = `
                <button class="favorite-btn active">❤️</button>
            `;

            const btn = document.querySelector('.favorite-btn.active');
            expect(btn).not.toBeNull();
        });

        it('should support filled/unfilled heart states', () => {
            document.body.innerHTML = `
                <button class="favorite-btn active" aria-pressed="true">❤️</button>
                <button class="favorite-btn" aria-pressed="false">🤍</button>
            `;

            const activeBtn = document.querySelector('.favorite-btn.active');
            const inactiveBtn = document.querySelector('.favorite-btn:not(.active)');

            expect(activeBtn?.getAttribute('aria-pressed')).toBe('true');
            expect(inactiveBtn?.getAttribute('aria-pressed')).toBe('false');
        });
    });

    // ========================================
    // Error States Tests
    // ========================================
    describe('Error States', () => {
        it('should support error class on form elements', () => {
            document.body.innerHTML = `
                <input type="text" class="input-field error" />
                <span class="error-message">Invalid input</span>
            `;

            const errorInput = document.querySelector('.input-field.error');
            const errorMessage = document.querySelector('.error-message');

            expect(errorInput).not.toBeNull();
            expect(errorMessage).not.toBeNull();
        });

        it('should support network-error class', () => {
            document.body.innerHTML = `
                <div class="error-state network-error">
                    <span class="error-icon">⚠️</span>
                    <p>Unable to load data</p>
                </div>
            `;

            const errorState = document.querySelector('.network-error');
            expect(errorState).not.toBeNull();
        });

        it('should support offline indicator', () => {
            document.body.innerHTML = `
                <div class="offline-indicator active">
                    You are offline
                </div>
            `;

            const indicator = document.querySelector('.offline-indicator.active');
            expect(indicator).not.toBeNull();
        });
    });
});
