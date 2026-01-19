/**
 * @vitest-environment jsdom
 * Additional coverage tests for events.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/modules/charts', () => ({
    destroyAllCharts: vi.fn(),
}));

vi.mock('../../src/modules/renderers', () => ({
    renderTabContent: vi.fn(),
}));

vi.mock('../../src/modules/filters', () => ({
    clearFilters: vi.fn(),
    handleSearch: vi.fn(),
    updateFilters: vi.fn(),
    restoreFilterState: vi.fn(),
    saveFilterState: vi.fn(),
    showSearchHistoryDropdown: vi.fn(),
}));

vi.mock('../../src/modules/modal', () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/compare', () => ({
    closeCompareModal: vi.fn(),
    toggleCompareItem: vi.fn(),
    updateCompareDisplay: vi.fn(),
    openCompareModal: vi.fn(),
}));

vi.mock('../../src/modules/calculator', () => ({
    quickCalc: vi.fn(),
}));

vi.mock('../../src/modules/favorites', () => ({
    toggleFavorite: vi.fn(() => true),
}));

vi.mock('../../src/modules/build-planner', () => ({
    setupBuildPlannerEvents: vi.fn(),
    updateBuildAnalysis: vi.fn(),
}));

vi.mock('../../src/modules/changelog', () => ({
    toggleChangelogExpand: vi.fn(),
}));

vi.mock('../../src/modules/data-service', () => ({
    loadAllData: vi.fn(),
}));

vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

vi.mock('../../src/modules/toast', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

// Create a hoisted mutable store state for testing
const mockStoreState = vi.hoisted(() => ({
    currentTab: 'items' as string,
}));

vi.mock('../../src/modules/store', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return mockStoreState.currentTab;
        return undefined;
    }),
    setState: vi.fn((key: string, value: any) => {
        if (key === 'currentTab') mockStoreState.currentTab = value;
    }),
}));

// Import functions after mocks
import {
    getSavedTab,
    switchTab,
    showLoading,
    hideLoading,
    showErrorMessage,
    dismissError,
    toggleTextExpand,
    cleanupEventListeners,
    setupEventDelegation,
    __resetTimersForTesting,
} from '../../src/modules/events';

describe('events.ts additional coverage tests', () => {
    beforeEach(() => {
        // Setup minimal DOM
        document.body.innerHTML = `
            <div id="loading-overlay" style="display: none;"></div>
            <div id="error-container" style="display: none;"></div>
            <input id="searchInput" type="text" />
            <button class="tab-btn" data-tab="items">Items</button>
            <button class="tab-btn" data-tab="weapons">Weapons</button>
            <div id="items-tab" class="tab-content"></div>
            <div id="weapons-tab" class="tab-content"></div>
            <div id="filters"></div>
            <div id="itemModal" class="modal"><div class="modal-content"></div></div>
            <div id="compareModal" class="modal"><div class="modal-content"></div></div>
        `;

        localStorage.clear();
        vi.clearAllMocks();

        // Reset internal timers to avoid debounce issues between tests
        __resetTimersForTesting();

        // Reset mock store state to a non-items tab so switchTab tests work
        mockStoreState.currentTab = 'shrines';

        // Setup global state
        (window as any).currentTab = 'shrines';
        (window as any).allData = {
            items: { items: [{ id: 'item1', name: 'Test' }] },
            weapons: { weapons: [] },
            tomes: { tomes: [] },
            characters: { characters: [] },
            shrines: { shrines: [] },
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('getSavedTab', () => {
        it('should return saved tab from localStorage if valid', () => {
            localStorage.setItem('megabonk-current-tab', 'weapons');
            const tab = getSavedTab();
            expect(tab).toBe('weapons');
        });

        it('should return items as default if no saved tab', () => {
            const tab = getSavedTab();
            expect(tab).toBe('items');
        });

        it('should return items if saved tab is invalid', () => {
            localStorage.setItem('megabonk-current-tab', 'invalid-tab');
            const tab = getSavedTab();
            expect(tab).toBe('items');
        });

        it('should accept all valid tab names', () => {
            const validTabs = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator'];
            for (const tab of validTabs) {
                localStorage.setItem('megabonk-current-tab', tab);
                expect(getSavedTab()).toBe(tab);
            }
        });
    });

    describe('showLoading and hideLoading', () => {
        it('should show loading overlay', () => {
            showLoading();
            const overlay = document.getElementById('loading-overlay');
            expect(overlay?.style.display).toBe('flex');
        });

        it('should hide loading overlay', () => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'flex';
            hideLoading();
            expect(overlay?.style.display).toBe('none');
        });

        it('should handle missing overlay gracefully', () => {
            document.body.innerHTML = '';
            expect(() => showLoading()).not.toThrow();
            expect(() => hideLoading()).not.toThrow();
        });
    });

    describe('showErrorMessage and dismissError', () => {
        it('should create error container if not exists', () => {
            document.getElementById('error-container')?.remove();
            showErrorMessage('Test error');
            const container = document.getElementById('error-container');
            expect(container).toBeTruthy();
        });

        it('should display error message', () => {
            showErrorMessage('Test error message');
            const container = document.getElementById('error-container');
            expect(container?.style.display).toBe('block');
            expect(container?.innerHTML).toContain('Test error message');
        });

        it('should show retry button when retryable', () => {
            showErrorMessage('Test error', true);
            const container = document.getElementById('error-container');
            expect(container?.innerHTML).toContain('error-retry-btn');
        });

        it('should not show retry button when not retryable', () => {
            showErrorMessage('Test error', false);
            const container = document.getElementById('error-container');
            expect(container?.innerHTML).not.toContain('error-retry-btn');
        });

        it('should update existing container message', () => {
            showErrorMessage('First error');
            showErrorMessage('Second error');
            const container = document.getElementById('error-container');
            expect(container?.innerHTML).toContain('Second error');
        });

        it('should dismiss error', () => {
            showErrorMessage('Test error');
            dismissError();
            const container = document.getElementById('error-container');
            expect(container?.style.display).toBe('none');
        });

        it('should handle dismiss when no error container', () => {
            document.body.innerHTML = '';
            expect(() => dismissError()).not.toThrow();
        });
    });

    describe('toggleTextExpand', () => {
        it('should expand truncated text', () => {
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.dataset.fullText = 'This is a very long text that should be expanded when clicked';
            element.dataset.truncated = 'true';
            element.textContent = 'This is a very long text...';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBe('false');
            expect(element.classList.contains('expanded')).toBe(true);
        });

        it('should collapse expanded text', () => {
            const longText = 'A'.repeat(150); // Long enough to need truncation
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.dataset.fullText = longText;
            element.dataset.truncated = 'false';
            element.textContent = longText;
            element.classList.add('expanded');
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBe('true');
            expect(element.classList.contains('expanded')).toBe(false);
        });

        it('should not toggle if no fullText data', () => {
            const element = document.createElement('div');
            element.className = 'expandable-text';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBeUndefined();
        });
    });

    describe('cleanupEventListeners', () => {
        it('should not throw when called', () => {
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('should handle multiple calls gracefully', () => {
            cleanupEventListeners();
            expect(() => cleanupEventListeners()).not.toThrow();
        });
    });

    describe('Keyboard Events', () => {
        beforeEach(() => {
            setupEventDelegation();
        });

        it('should close modals on Escape key', async () => {
            const { closeModal } = await import('../../src/modules/modal');
            const { closeCompareModal } = await import('../../src/modules/compare');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            // Wait for dynamic import promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(closeModal).toHaveBeenCalled();
            expect(closeCompareModal).toHaveBeenCalled();
        });

        it('should focus search on Ctrl+K', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

            expect(focusSpy).toHaveBeenCalled();
        });

        it('should focus search on / key', async () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

            expect(focusSpy).toHaveBeenCalled();
        });

        it('should not focus search when in input field', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
            input.dispatchEvent(event);

            expect(focusSpy).not.toHaveBeenCalled();
        });

        it('should not focus search when in textarea', () => {
            const textarea = document.createElement('textarea');
            document.body.appendChild(textarea);
            textarea.focus();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
            textarea.dispatchEvent(event);

            expect(focusSpy).not.toHaveBeenCalled();
        });
    });

    describe('switchTab with allData', () => {
        it('should log tab switch event', async () => {
            const { logger } = await import('../../src/modules/logger');

            await switchTab('items');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    data: expect.objectContaining({
                        toTab: 'items',
                    }),
                })
            );
        });

        it('should handle missing allData gracefully', async () => {
            (window as any).allData = undefined;
            await expect(switchTab('items')).resolves.not.toThrow();
        });

        it('should persist tab selection to localStorage', async () => {
            await switchTab('weapons');
            expect(localStorage.getItem('megabonk-current-tab')).toBe('weapons');
        });
    });
});
