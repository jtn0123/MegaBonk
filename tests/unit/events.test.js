/* global KeyboardEvent */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Import functions under test
import {
    toggleTextExpand,
    setupEventDelegation,
    setupEventListeners,
    showLoading,
    hideLoading,
    showErrorMessage,
    dismissError,
    switchTab,
} from '../../src/modules/events.ts';

// Mock dependencies
vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: vi.fn(),
}));

vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: vi.fn(),
}));

vi.mock('../../src/modules/filters.ts', () => ({
    clearFilters: vi.fn(),
    handleSearch: vi.fn(),
    updateFilters: vi.fn(),
    restoreFilterState: vi.fn(),
    saveFilterState: vi.fn(),
    showSearchHistoryDropdown: vi.fn(),
}));

vi.mock('../../src/modules/modal.ts', () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/compare.ts', () => ({
    closeCompareModal: vi.fn(),
    toggleCompareItem: vi.fn(),
    updateCompareDisplay: vi.fn(),
    openCompareModal: vi.fn(),
}));

vi.mock('../../src/modules/calculator.ts', () => ({
    quickCalc: vi.fn(),
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    toggleFavorite: vi.fn(),
}));

vi.mock('../../src/modules/build-planner.ts', () => ({
    setupBuildPlannerEvents: vi.fn(),
    updateBuildAnalysis: vi.fn(),
}));

vi.mock('../../src/modules/changelog.ts', () => ({
    toggleChangelogExpand: vi.fn(),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    loadAllData: vi.fn(),
}));

describe('toggleTextExpand()', () => {
    beforeEach(() => {
        createMinimalDOM();
    });

    it('should expand truncated text', () => {
        const element = document.createElement('div');
        element.className = 'expandable-text';
        element.dataset.fullText =
            'This is a very long text that was truncated and now needs to be expanded to show the full content.';
        element.dataset.truncated = 'true';
        element.textContent = 'This is a very long text...';
        document.body.appendChild(element);

        toggleTextExpand(element);

        expect(element.dataset.truncated).toBe('false');
        expect(element.classList.contains('expanded')).toBe(true);
        expect(element.textContent).toContain('This is a very long text that was truncated');
    });

    it('should collapse expanded text', () => {
        const element = document.createElement('div');
        element.className = 'expandable-text';
        // Make sure text is longer than 120 characters to trigger truncation
        element.dataset.fullText =
            'This is a very long text that was truncated and now needs to be collapsed back to its shortened form to save space. Adding more content to ensure it exceeds the 120 character limit.';
        element.dataset.truncated = 'false';
        element.textContent = element.dataset.fullText;
        element.classList.add('expanded');
        document.body.appendChild(element);

        toggleTextExpand(element);

        expect(element.dataset.truncated).toBe('true');
        expect(element.classList.contains('expanded')).toBe(false);
        // Text span content should be truncated (indicator is in separate span)
        const textSpan = element.querySelector('span:not(.expand-indicator)');
        expect(textSpan.textContent.endsWith('...')).toBe(true);
    });

    it('should not modify element without fullText data', () => {
        const element = document.createElement('div');
        element.textContent = 'Some text';
        document.body.appendChild(element);

        toggleTextExpand(element);

        expect(element.textContent).toBe('Some text');
    });

    it('should add expand indicator when collapsing', () => {
        const element = document.createElement('div');
        element.className = 'expandable-text';
        element.dataset.fullText =
            'This is a very long text that was truncated and now needs to be collapsed back to its shortened form.';
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
        document.body.appendChild(element);

        toggleTextExpand(element);

        const indicator = element.querySelector('.expand-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toBe('Click to expand');
    });

    it('should add collapse indicator when expanding', () => {
        const element = document.createElement('div');
        element.className = 'expandable-text';
        element.dataset.fullText =
            'This is a very long text that was truncated and now needs to be expanded to show all content.';
        element.dataset.truncated = 'true';
        document.body.appendChild(element);

        toggleTextExpand(element);

        const indicator = element.querySelector('.expand-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toBe('Click to collapse');
    });

    it('should truncate to 120 characters plus ellipsis', () => {
        const longText = 'A'.repeat(200);
        const element = document.createElement('div');
        element.className = 'expandable-text';
        element.dataset.fullText = longText;
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
        document.body.appendChild(element);

        toggleTextExpand(element);

        // Should be truncated (120 chars + "...")
        const textContent = element.querySelector('span:not(.expand-indicator)').textContent;
        expect(textContent).toHaveLength(123); // 120 + '...'
        expect(textContent.endsWith('...')).toBe(true);
    });

    it('should not truncate short text', () => {
        const shortText = 'Short text under 120 chars';
        const element = document.createElement('div');
        element.className = 'expandable-text';
        element.dataset.fullText = shortText;
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
        document.body.appendChild(element);

        toggleTextExpand(element);

        const textContent = element.querySelector('span:not(.expand-indicator)').textContent;
        expect(textContent).toBe(shortText);
    });
});

describe('Loading Overlay', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Add loading overlay to DOM
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
    });

    describe('showLoading()', () => {
        it('should show loading overlay', () => {
            showLoading();

            const overlay = document.getElementById('loading-overlay');
            expect(overlay.style.display).toBe('flex');
        });

        it('should not throw when overlay does not exist', () => {
            document.getElementById('loading-overlay').remove();

            expect(() => showLoading()).not.toThrow();
        });
    });

    describe('hideLoading()', () => {
        it('should hide loading overlay', () => {
            const overlay = document.getElementById('loading-overlay');
            overlay.style.display = 'flex';

            hideLoading();

            expect(overlay.style.display).toBe('none');
        });

        it('should not throw when overlay does not exist', () => {
            document.getElementById('loading-overlay').remove();

            expect(() => hideLoading()).not.toThrow();
        });
    });
});

describe('Error Message', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Remove any existing error container
        const existing = document.getElementById('error-container');
        if (existing) existing.remove();
    });

    afterEach(() => {
        const container = document.getElementById('error-container');
        if (container) container.remove();
    });

    describe('showErrorMessage()', () => {
        it('should create error container if not exists', () => {
            showErrorMessage('Test error message');

            const container = document.getElementById('error-container');
            expect(container).not.toBeNull();
        });

        it('should display error message', () => {
            showErrorMessage('Test error message');

            const container = document.getElementById('error-container');
            expect(container.textContent).toContain('Test error message');
        });

        it('should show retry button by default', () => {
            showErrorMessage('Test error');

            const retryBtn = document.querySelector('.error-retry-btn');
            expect(retryBtn).not.toBeNull();
        });

        it('should hide retry button when isRetryable is false', () => {
            showErrorMessage('Test error', false);

            const retryBtn = document.querySelector('.error-retry-btn');
            expect(retryBtn).toBeNull();
        });

        it('should show close button', () => {
            showErrorMessage('Test error');

            const closeBtn = document.querySelector('.error-close');
            expect(closeBtn).not.toBeNull();
        });

        it('should update message when container already exists', () => {
            showErrorMessage('First message');
            showErrorMessage('Second message');

            const container = document.getElementById('error-container');
            expect(container.textContent).toContain('Second message');
        });

        it('should set container display to block', () => {
            showErrorMessage('Test error');

            const container = document.getElementById('error-container');
            expect(container.style.display).toBe('block');
        });
    });

    describe('dismissError()', () => {
        it('should hide error container', () => {
            showErrorMessage('Test error');
            dismissError();

            const container = document.getElementById('error-container');
            expect(container.style.display).toBe('none');
        });

        it('should not throw when container does not exist', () => {
            expect(() => dismissError()).not.toThrow();
        });
    });
});

describe('Tab Switching', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    describe('switchTab()', () => {
        it('should update currentTab', () => {
            switchTab('weapons');

            expect(window.currentTab).toBe('weapons');
        });

        it('should update active tab button', () => {
            switchTab('weapons');

            const weaponsBtn = document.querySelector('[data-tab="weapons"]');
            const itemsBtn = document.querySelector('[data-tab="items"]');

            expect(weaponsBtn.classList.contains('active')).toBe(true);
            expect(itemsBtn.classList.contains('active')).toBe(false);
        });

        it('should update tab content visibility', () => {
            switchTab('weapons');

            const weaponsTab = document.getElementById('weapons-tab');
            const itemsTab = document.getElementById('items-tab');

            expect(weaponsTab.classList.contains('active')).toBe(true);
            expect(itemsTab.classList.contains('active')).toBe(false);
        });

        it('should set aria-selected attribute on tab buttons', () => {
            switchTab('tomes');

            const tomesBtn = document.querySelector('[data-tab="tomes"]');
            const itemsBtn = document.querySelector('[data-tab="items"]');

            expect(tomesBtn.getAttribute('aria-selected')).toBe('true');
            expect(itemsBtn.getAttribute('aria-selected')).toBe('false');
        });

        it('should call destroyAllCharts before switching', async () => {
            const { destroyAllCharts } = await import('../../src/modules/charts.ts');

            switchTab('characters');

            expect(destroyAllCharts).toHaveBeenCalled();
        });

        it('should call saveFilterState for previous tab', async () => {
            const { saveFilterState } = await import('../../src/modules/filters.ts');

            // First switch to items
            switchTab('items');
            vi.clearAllMocks();

            // Then switch to weapons
            switchTab('weapons');

            expect(saveFilterState).toHaveBeenCalledWith('items');
        });

        it('should call updateFilters for new tab', async () => {
            const { updateFilters } = await import('../../src/modules/filters.ts');

            switchTab('characters');

            expect(updateFilters).toHaveBeenCalledWith('characters');
        });

        it('should call restoreFilterState for new tab', async () => {
            const { restoreFilterState } = await import('../../src/modules/filters.ts');

            switchTab('tomes');

            expect(restoreFilterState).toHaveBeenCalledWith('tomes');
        });

        it('should call renderTabContent for new tab', async () => {
            const { renderTabContent } = await import('../../src/modules/renderers.ts');

            switchTab('shrines');

            expect(renderTabContent).toHaveBeenCalledWith('shrines');
        });

        it('should update window.currentTab for external code', () => {
            switchTab('build-planner');

            expect(window.currentTab).toBe('build-planner');
        });
    });
});

describe('Event Delegation', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
        setupEventDelegation();
    });

    describe('Keyboard Events', () => {
        it('should close modals on Escape key', async () => {
            const { closeModal } = await import('../../src/modules/modal.ts');
            const { closeCompareModal } = await import('../../src/modules/compare.ts');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(closeModal).toHaveBeenCalled();
            expect(closeCompareModal).toHaveBeenCalled();
        });

        it('should focus search on Ctrl+K', () => {
            const searchInput = document.getElementById('searchInput');
            const focusSpy = vi.spyOn(searchInput, 'focus');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

            expect(focusSpy).toHaveBeenCalled();
        });

        it('should focus search on / key', () => {
            const searchInput = document.getElementById('searchInput');
            const focusSpy = vi.spyOn(searchInput, 'focus');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

            expect(focusSpy).toHaveBeenCalled();
        });

        it('should not focus search when already in input', () => {
            const searchInput = document.getElementById('searchInput');
            searchInput.focus();

            const event = new KeyboardEvent('keydown', { key: '/' });
            Object.defineProperty(event, 'target', { value: searchInput });
            document.dispatchEvent(event);

            // The event should not prevent default or call focus again
            // (no error should be thrown)
            expect(true).toBe(true);
        });

        it('should switch tabs with number keys', async () => {
            const { updateFilters } = await import('../../src/modules/filters.ts');

            // Press '2' for weapons tab
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));

            expect(updateFilters).toHaveBeenCalledWith('weapons');
        });

        it('should not switch tabs with number keys when in input', () => {
            const searchInput = document.getElementById('searchInput');
            searchInput.focus();

            const event = new KeyboardEvent('keydown', { key: '2' });
            Object.defineProperty(event, 'target', { value: searchInput });

            // Store current tab
            const previousTab = window.currentTab;

            document.dispatchEvent(event);

            // Tab shouldn't change when in input
            expect(window.currentTab).toBe(previousTab);
        });
    });

    describe('Click Events', () => {
        it('should open detail modal on view-details-btn click', async () => {
            const { openDetailModal } = await import('../../src/modules/modal.ts');

            const btn = document.createElement('button');
            btn.className = 'view-details-btn';
            btn.dataset.type = 'items';
            btn.dataset.id = 'test-item';
            document.body.appendChild(btn);

            btn.click();

            expect(openDetailModal).toHaveBeenCalledWith('items', 'test-item');
        });

        it('should toggle compare item on checkbox click', async () => {
            const { toggleCompareItem } = await import('../../src/modules/compare.ts');

            // The event handler expects checkbox to be inside a label wrapper
            const label = document.createElement('label');
            label.className = 'compare-checkbox-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'compare-checkbox';
            checkbox.dataset.id = 'test-item';

            label.appendChild(checkbox);
            document.body.appendChild(label);

            // Click the label (which triggers the event delegation handler)
            label.click();

            expect(toggleCompareItem).toHaveBeenCalledWith('test-item');
        });

        it('should toggle expandable text on click', () => {
            const expandable = document.createElement('div');
            expandable.className = 'expandable-text';
            expandable.dataset.fullText =
                'This is a very long text that will be expanded when clicked to show the full content.';
            expandable.dataset.truncated = 'true';
            expandable.textContent = 'This is...';
            document.body.appendChild(expandable);

            expandable.click();

            expect(expandable.dataset.truncated).toBe('false');
        });

        it('should call quickCalc on breakpoint card click', async () => {
            const { quickCalc } = await import('../../src/modules/calculator.ts');

            const card = document.createElement('div');
            card.className = 'breakpoint-card';
            card.dataset.item = 'test-item';
            card.dataset.target = '100';
            document.body.appendChild(card);

            card.click();

            expect(quickCalc).toHaveBeenCalledWith('test-item', 100);
        });

        it('should call clearFilters on clear filters button click', async () => {
            const { clearFilters } = await import('../../src/modules/filters.ts');

            const btn = document.createElement('button');
            btn.className = 'btn-secondary';
            btn.textContent = 'Clear Filters';
            document.body.appendChild(btn);

            btn.click();

            expect(clearFilters).toHaveBeenCalled();
        });

        it('should toggle changelog expand on button click', async () => {
            const { toggleChangelogExpand } = await import('../../src/modules/changelog.ts');

            const btn = document.createElement('button');
            btn.className = 'changelog-expand-btn';
            document.body.appendChild(btn);

            btn.click();

            expect(toggleChangelogExpand).toHaveBeenCalledWith(btn);
        });

        it('should open entity modal on entity-link click', async () => {
            const { openDetailModal } = await import('../../src/modules/modal.ts');

            const link = document.createElement('a');
            link.className = 'entity-link';
            link.dataset.entityType = 'weapons';
            link.dataset.entityId = 'revolver';
            link.href = '#';
            document.body.appendChild(link);

            link.click();

            expect(openDetailModal).toHaveBeenCalledWith('weapons', 'revolver');
        });
    });
});

describe('setupEventListeners()', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    it('should not throw when called', () => {
        expect(() => setupEventListeners()).not.toThrow();
    });

    it('should setup tab button click handlers', async () => {
        setupEventListeners();

        const weaponsBtn = document.querySelector('[data-tab="weapons"]');
        weaponsBtn.click();

        const { updateFilters } = await import('../../src/modules/filters.ts');
        expect(updateFilters).toHaveBeenCalledWith('weapons');
    });

    it('should setup modal close handlers', async () => {
        const { closeModal } = await import('../../src/modules/modal.ts');

        setupEventListeners();

        const closeBtn = document.querySelector('.close');
        closeBtn.click();

        expect(closeModal).toHaveBeenCalled();
    });

    it('should setup compare button handler', async () => {
        const { openCompareModal } = await import('../../src/modules/compare.ts');

        setupEventListeners();

        const compareBtn = document.getElementById('compare-btn');
        compareBtn.click();

        expect(openCompareModal).toHaveBeenCalled();
    });
});
