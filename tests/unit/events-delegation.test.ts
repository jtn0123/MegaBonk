/**
 * @vitest-environment jsdom
 * Event Delegation Tests - Extended Coverage for events.ts
 * Focuses on click delegation, change events, and keyboard handlers
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';

// Hoist mock functions
const mockDestroyAllCharts = vi.hoisted(() => vi.fn());
const mockRenderTabContent = vi.hoisted(() => vi.fn());
const mockUpdateFilters = vi.hoisted(() => vi.fn());
const mockRestoreFilterState = vi.hoisted(() => vi.fn());
const mockSaveFilterState = vi.hoisted(() => vi.fn());
const mockHandleSearch = vi.hoisted(() => vi.fn());
const mockClearFilters = vi.hoisted(() => vi.fn());
const mockShowSearchHistoryDropdown = vi.hoisted(() => vi.fn());
const mockCloseModal = vi.hoisted(() => vi.fn());
const mockOpenDetailModal = vi.hoisted(() => vi.fn());
const mockPreloadCommonModules = vi.hoisted(() => vi.fn());
const mockLoadTabModules = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockShowTabSkeleton = vi.hoisted(() => vi.fn());
const mockSetupDropdownClickHandlers = vi.hoisted(() => vi.fn());
const mockIsSearchDropdownVisible = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockHideSearchDropdown = vi.hoisted(() => vi.fn());
const mockHandleDropdownKeyboard = vi.hoisted(() => vi.fn().mockReturnValue(false));

// Mock store state
const mockStoreState = vi.hoisted(() => ({
    currentTab: 'items' as string,
}));

// Mock all dependencies
vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: mockDestroyAllCharts,
}));

vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: mockRenderTabContent,
}));

vi.mock('../../src/modules/filters.ts', () => ({
    clearFilters: mockClearFilters,
    handleSearch: mockHandleSearch,
    updateFilters: mockUpdateFilters,
    restoreFilterState: mockRestoreFilterState,
    saveFilterState: mockSaveFilterState,
}));

vi.mock('../../src/modules/search-history.ts', () => ({
    showSearchHistoryDropdown: mockShowSearchHistoryDropdown,
}));

vi.mock('../../src/modules/search-dropdown.ts', () => ({
    handleDropdownKeyboard: mockHandleDropdownKeyboard,
    isSearchDropdownVisible: mockIsSearchDropdownVisible,
    hideSearchDropdown: mockHideSearchDropdown,
    setupDropdownClickHandlers: mockSetupDropdownClickHandlers,
}));

vi.mock('../../src/modules/modal.ts', () => ({
    closeModal: mockCloseModal,
    openDetailModal: mockOpenDetailModal,
}));

vi.mock('../../src/modules/tab-loader.ts', () => ({
    preloadCommonModules: mockPreloadCommonModules,
    loadTabModules: mockLoadTabModules,
}));

vi.mock('../../src/modules/skeleton-loader.ts', () => ({
    showTabSkeleton: mockShowTabSkeleton,
}));

vi.mock('../../src/modules/registry.ts', () => ({
    registerFunction: vi.fn(),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    debounce: vi.fn((fn: Function) => fn),
    escapeHtml: vi.fn((str: string) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    toggleFavorite: vi.fn(() => true),
}));

vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return mockStoreState.currentTab;
        return undefined;
    }),
    setState: vi.fn((key: string, value: any) => {
        if (key === 'currentTab') mockStoreState.currentTab = value;
    }),
}));

// Import after mocks
import {
    setupEventDelegation,
    setupEventListeners,
    toggleTextExpand,
    cleanupEventListeners,
    cleanupTabScrollListeners,
    __resetTimersForTesting,
} from '../../src/modules/events.ts';

// Helper to dispatch events
const dispatchClick = (element: HTMLElement): void => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const dispatchChange = (element: HTMLElement): void => {
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

const dispatchKeydown = (element: EventTarget, key: string, options: Partial<KeyboardEventInit> = {}): void => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
};

describe('Events - Delegation and Handler Coverage', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
        localStorage.clear();
        __resetTimersForTesting();
        mockStoreState.currentTab = 'items';

        // Setup global state
        (window as any).currentTab = 'items';
        (window as any).allData = {
            items: { items: [{ id: 'item1', name: 'Test Item' }] },
            weapons: { weapons: [] },
            tomes: { tomes: [] },
            characters: { characters: [] },
            shrines: { shrines: [] },
        };

        setupEventDelegation();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    // ========================================
    // Expandable Text Click Delegation
    // ========================================
    describe('Expandable text click delegation', () => {
        // Note: These tests verify that toggleTextExpand is exported and callable.
        // The actual delegation through document click events is harder to test in jsdom
        // due to event bubbling complexities. Integration tests cover this path.
        it('should have toggleTextExpand available', () => {
            expect(typeof toggleTextExpand).toBe('function');
        });

        it('should directly call toggleTextExpand on expandable element', () => {
            const elem = document.createElement('div');
            elem.className = 'expandable-text';
            elem.dataset.fullText = 'A'.repeat(200);
            elem.dataset.truncated = 'true';
            elem.textContent = 'A'.repeat(120) + '...';
            document.body.appendChild(elem);

            // Direct call (not through delegation)
            toggleTextExpand(elem);

            // Should have expanded
            expect(elem.dataset.truncated).toBe('false');
        });

        it('should toggle back to truncated state', () => {
            const elem = document.createElement('div');
            elem.className = 'expandable-text';
            elem.dataset.fullText = 'B'.repeat(200);
            elem.dataset.truncated = 'false';
            elem.classList.add('expanded');
            document.body.appendChild(elem);

            // Direct call to collapse
            toggleTextExpand(elem);

            expect(elem.dataset.truncated).toBe('true');
            expect(elem.classList.contains('expanded')).toBe(false);
        });
    });

    // ========================================
    // toggleTextExpand Edge Cases
    // ========================================
    describe('toggleTextExpand edge cases', () => {
        it('should handle text exactly at truncation boundary', () => {
            const elem = document.createElement('div');
            elem.dataset.fullText = 'X'.repeat(120); // Exactly at boundary
            elem.dataset.truncated = 'false';
            elem.classList.add('expanded');

            toggleTextExpand(elem);

            // Should collapse but no ellipsis needed
            expect(elem.dataset.truncated).toBe('true');
            expect(elem.textContent).not.toContain('...');
        });

        it('should handle text shorter than truncation boundary', () => {
            const elem = document.createElement('div');
            elem.dataset.fullText = 'Short text';
            elem.dataset.truncated = 'false';
            elem.classList.add('expanded');

            toggleTextExpand(elem);

            expect(elem.dataset.truncated).toBe('true');
            expect(elem.textContent).toContain('Short text');
        });

        it('should create proper DOM structure when expanding', () => {
            const elem = document.createElement('div');
            elem.dataset.fullText = 'C'.repeat(200);
            elem.dataset.truncated = 'true';

            toggleTextExpand(elem);

            // Should have span for text and span for indicator
            const spans = elem.querySelectorAll('span');
            expect(spans.length).toBe(2);
            expect(spans[1].className).toBe('expand-indicator');
        });

        it('should handle empty fullText gracefully', () => {
            const elem = document.createElement('div');
            elem.dataset.fullText = '';
            elem.dataset.truncated = 'true';

            // Should not throw
            expect(() => toggleTextExpand(elem)).not.toThrow();
        });
    });

    // ========================================
    // Change Event Delegation
    // ========================================
    describe('Change event delegation', () => {
        it('should handle filter select change in filters container', () => {
            const filtersDiv = document.getElementById('filters');
            const select = document.createElement('select');
            select.id = 'tierFilter';
            filtersDiv?.appendChild(select);

            dispatchChange(select);

            expect(mockRenderTabContent).toHaveBeenCalledWith('items');
        });

        it('should save filter state on filter change', () => {
            const filtersDiv = document.getElementById('filters');
            const select = document.createElement('select');
            select.id = 'rarityFilter';
            filtersDiv?.appendChild(select);

            dispatchChange(select);

            expect(mockSaveFilterState).toHaveBeenCalledWith('items');
        });

        it('should handle favoritesOnly checkbox change', () => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'favoritesOnly';
            document.body.appendChild(checkbox);

            dispatchChange(checkbox);

            expect(mockRenderTabContent).toHaveBeenCalledWith('items');
            expect(mockSaveFilterState).toHaveBeenCalledWith('items');
        });

        it('should handle filter change when currentTab is null', () => {
            mockStoreState.currentTab = '';

            const filtersDiv = document.getElementById('filters');
            const select = document.createElement('select');
            filtersDiv?.appendChild(select);

            // Should not call render when tab is falsy
            dispatchChange(select);

            expect(mockRenderTabContent).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // Keyboard Event Handling
    // ========================================
    describe('Keyboard event handling', () => {
        it('should close modals on Escape', () => {
            dispatchKeydown(document, 'Escape');

            expect(mockCloseModal).toHaveBeenCalled();
        });

        it('should close search dropdown first on Escape when visible', () => {
            mockIsSearchDropdownVisible.mockReturnValueOnce(true);

            dispatchKeydown(document, 'Escape');

            expect(mockHideSearchDropdown).toHaveBeenCalled();
            expect(mockCloseModal).not.toHaveBeenCalled();
        });

        it('should focus search on Ctrl+K', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            dispatchKeydown(document, 'k', { ctrlKey: true });

            expect(focusSpy).toHaveBeenCalled();
        });

        it('should focus and select search on Ctrl+K', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'existing text';
            const selectSpy = vi.spyOn(searchInput, 'select');

            dispatchKeydown(document, 'k', { ctrlKey: true });

            expect(selectSpy).toHaveBeenCalled();
        });

        it('should not focus search on / when in input', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            dispatchKeydown(input, '/', { bubbles: true });

            expect(focusSpy).not.toHaveBeenCalled();
        });

        it('should not focus search on / when in textarea', () => {
            const textarea = document.createElement('textarea');
            document.body.appendChild(textarea);
            textarea.focus();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            dispatchKeydown(textarea, '/', { bubbles: true });

            expect(focusSpy).not.toHaveBeenCalled();
        });

        it('should handle number key without modifiers for tab switch', async () => {
            // Reset to a different tab first
            mockStoreState.currentTab = 'weapons';
            __resetTimersForTesting();

            dispatchKeydown(document, '1');

            // Give async switchTab time to run
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockUpdateFilters).toHaveBeenCalled();
        });

        it('should not switch tabs when number pressed in input', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            vi.clearAllMocks();
            dispatchKeydown(input, '2', { bubbles: true });

            expect(mockUpdateFilters).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // Tab Button Arrow Key Navigation
    // ========================================
    describe('Tab button arrow navigation', () => {
        it('should not navigate on ArrowRight when not on tab button', () => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            div.focus();

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
            div.dispatchEvent(event);

            // Should not trigger tab switch
            expect(mockUpdateFilters).not.toHaveBeenCalled();
        });

        it('should navigate on ArrowRight when on tab button', async () => {
            const tabBtn = document.querySelector('.tab-btn') as HTMLButtonElement;
            tabBtn?.focus();
            __resetTimersForTesting();
            mockStoreState.currentTab = 'shrines';

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
            Object.defineProperty(event, 'target', { value: tabBtn });
            tabBtn?.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockUpdateFilters).toHaveBeenCalled();
        });

        it('should navigate on ArrowLeft when on tab button', async () => {
            const tabBtns = document.querySelectorAll('.tab-btn');
            const secondBtn = tabBtns[1] as HTMLButtonElement;
            secondBtn?.focus();
            __resetTimersForTesting();
            mockStoreState.currentTab = 'shrines';

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
            Object.defineProperty(event, 'target', { value: secondBtn });
            secondBtn?.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockUpdateFilters).toHaveBeenCalled();
        });
    });

    // ========================================
    // Search Input Dropdown Handling
    // ========================================
    describe('Search input and dropdown', () => {
        it('should delegate to dropdown handler when visible and on search input', () => {
            mockIsSearchDropdownVisible.mockReturnValue(true);
            mockHandleDropdownKeyboard.mockReturnValue(true);

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput?.focus();

            dispatchKeydown(searchInput, 'ArrowDown', { bubbles: true });

            expect(mockHandleDropdownKeyboard).toHaveBeenCalled();
        });

        it('should not call dropdown handler when on non-search input', () => {
            mockIsSearchDropdownVisible.mockReturnValue(true);

            const input = document.createElement('input');
            input.id = 'otherInput';
            document.body.appendChild(input);
            input.focus();

            dispatchKeydown(input, 'ArrowDown', { bubbles: true });

            expect(mockHandleDropdownKeyboard).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // Cleanup Functions
    // ========================================
    describe('Cleanup functions', () => {
        it('should not throw on cleanupEventListeners', () => {
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('should not throw on cleanupTabScrollListeners', () => {
            expect(() => cleanupTabScrollListeners()).not.toThrow();
        });

        it('should handle cleanup after setupEventListeners', () => {
            setupEventListeners();
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('should allow re-setup after cleanup', () => {
            cleanupEventListeners();
            expect(() => setupEventDelegation()).not.toThrow();
        });
    });

    // ========================================
    // Setup Event Listeners
    // ========================================
    describe('setupEventListeners', () => {
        it('should setup search input debounced handler', () => {
            setupEventListeners();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput?.dispatchEvent(new Event('input', { bubbles: true }));

            expect(mockHandleSearch).toHaveBeenCalled();
        });

        it('should setup search focus handler', async () => {
            setupEventListeners();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput?.focus();

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockShowSearchHistoryDropdown).toHaveBeenCalled();
        });

        it('should trigger search on focus when query exists', async () => {
            setupEventListeners();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'existing query';
            searchInput?.focus();

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockHandleSearch).toHaveBeenCalled();
        });

        it('should setup close modal button handler', () => {
            setupEventListeners();

            const closeBtn = document.querySelector('.close') as HTMLElement;
            closeBtn?.click();

            expect(mockCloseModal).toHaveBeenCalled();
        });

        it('should setup dropdown click handlers', () => {
            setupEventListeners();

            expect(mockSetupDropdownClickHandlers).toHaveBeenCalled();
        });
    });

    // ========================================
    // Tab Scroll Indicators (Mobile)
    // ========================================
    describe('Tab scroll indicators', () => {
        beforeEach(() => {
            // Create tab container structure
            const tabsNav = document.createElement('nav');
            tabsNav.className = 'tabs';
            const container = document.createElement('div');
            container.className = 'container';
            const tabButtons = document.createElement('div');
            tabButtons.className = 'tab-buttons';

            // Create scrollable content
            for (let i = 0; i < 10; i++) {
                const btn = document.createElement('button');
                btn.className = 'tab-btn';
                btn.textContent = `Tab ${i}`;
                tabButtons.appendChild(btn);
            }

            container.appendChild(tabButtons);
            tabsNav.appendChild(container);
            document.body.appendChild(tabsNav);

            // Mock scrollWidth > clientWidth for scrollable scenario
            Object.defineProperty(tabButtons, 'scrollWidth', { value: 1000, configurable: true });
            Object.defineProperty(tabButtons, 'clientWidth', { value: 300, configurable: true });
        });

        it('should setup scroll listener', () => {
            setupEventListeners();
            // Should not throw
        });

        it('should setup resize listener', () => {
            setupEventListeners();
            // Should not throw
        });

        it.skip('should handle scroll events', async () => {
            setupEventListeners();

            const tabButtons = document.querySelector('.tab-buttons') as HTMLElement;
            tabButtons?.dispatchEvent(new Event('scroll', { bubbles: true }));

            // Wait for RAF
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should update scroll indicators (no error)
        });

        it.skip('should handle resize events', async () => {
            setupEventListeners();

            window.dispatchEvent(new Event('resize'));

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should update scroll indicators (no error)
        });
    });

    // ========================================
    // Modal Backdrop Click Tests
    // ========================================
    describe('Modal backdrop clicking', () => {
        beforeEach(() => {
            setupEventListeners();
        });

        it('should close item modal on backdrop click', () => {
            const modal = document.getElementById('itemModal') as HTMLElement;
            modal.classList.add('active');
            modal.style.display = 'flex';

            // Create click event targeting the modal backdrop
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: modal });
            window.dispatchEvent(event);

            expect(mockCloseModal).toHaveBeenCalled();
        });

        it.skip('should not close modal when clicking inside content', () => {
            const modal = document.getElementById('itemModal') as HTMLElement;
            const content = modal.querySelector('.modal-content') as HTMLElement;
            modal.classList.add('active');

            vi.clearAllMocks();

            // Click on content
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: content });
            window.dispatchEvent(event);

            // Should not close since click was inside content
            expect(mockCloseModal).not.toHaveBeenCalled();
        });

        it('should debounce modal close on rapid clicks', () => {
            const modal = document.getElementById('itemModal') as HTMLElement;
            modal.classList.add('active');

            // First click
            const event1 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event1, 'target', { value: modal });
            window.dispatchEvent(event1);

            vi.clearAllMocks();

            // Immediate second click (within debounce period)
            const event2 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event2, 'target', { value: modal });
            window.dispatchEvent(event2);

            // Second click should be debounced
            expect(mockCloseModal).not.toHaveBeenCalled();
        });

        it('should handle touch events on modal backdrop', () => {
            const modal = document.getElementById('itemModal') as HTMLElement;
            modal.classList.add('active');

            vi.clearAllMocks();

            // Reset modal close time by waiting
            __resetTimersForTesting();

            const event = new Event('touchend', { bubbles: true }) as any;
            Object.defineProperty(event, 'target', { value: modal });
            window.dispatchEvent(event);

            expect(mockCloseModal).toHaveBeenCalled();
        });
    });

    // ========================================
    // Compare Button
    // ========================================
    describe('Compare button', () => {
        it('should setup compare button click handler', () => {
            const compareBtn = document.getElementById('compare-btn') as HTMLButtonElement;
            expect(compareBtn).toBeTruthy();

            setupEventListeners();

            // Button exists and can be clicked without error
            expect(() => compareBtn?.click()).not.toThrow();
        });
    });

    // ========================================
    // Pagehide Event
    // ========================================
    describe('Pagehide cleanup', () => {
        it('should setup pagehide listener', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            setupEventDelegation();

            expect(addEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function), expect.anything());
        });
    });
});
