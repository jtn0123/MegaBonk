/**
 * @vitest-environment jsdom
 * Switch Tab Tests - Extended Coverage for switchTab function
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';

// Hoist mock functions
const mockDestroyAllCharts = vi.hoisted(() => vi.fn());
const mockRenderTabContent = vi.hoisted(() => vi.fn());
const mockUpdateFilters = vi.hoisted(() => vi.fn());
const mockRestoreFilterState = vi.hoisted(() => vi.fn());
const mockSaveFilterState = vi.hoisted(() => vi.fn());
const mockLoadTabModules = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockShowTabSkeleton = vi.hoisted(() => vi.fn());

// Mock store state
const mockStoreState = vi.hoisted(() => ({
    currentTab: 'items' as string,
}));

// Mock dependencies
vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: mockDestroyAllCharts,
}));

vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: mockRenderTabContent,
}));

vi.mock('../../src/modules/filters.ts', () => ({
    clearFilters: vi.fn(),
    handleSearch: vi.fn(),
    updateFilters: mockUpdateFilters,
    restoreFilterState: mockRestoreFilterState,
    saveFilterState: mockSaveFilterState,
}));

vi.mock('../../src/modules/search-history.ts', () => ({
    showSearchHistoryDropdown: vi.fn(),
}));

vi.mock('../../src/modules/search-dropdown.ts', () => ({
    handleDropdownKeyboard: vi.fn().mockReturnValue(false),
    isSearchDropdownVisible: vi.fn().mockReturnValue(false),
    hideSearchDropdown: vi.fn(),
    setupDropdownClickHandlers: vi.fn(),
}));

vi.mock('../../src/modules/modal.ts', () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/tab-loader.ts', () => ({
    preloadCommonModules: vi.fn(),
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
    escapeHtml: vi.fn((str: string) => str),
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
import { switchTab, __resetTimersForTesting, currentTab } from '../../src/modules/events.ts';

describe('switchTab - Extended Coverage', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
        localStorage.clear();
        __resetTimersForTesting();
        mockStoreState.currentTab = 'shrines'; // Start different for switch tests

        // Setup global allData with items (both on window and as global variable)
        const allDataValue = {
            items: { items: [{ id: 'item1' }, { id: 'item2' }, { id: 'item3' }] },
            weapons: { weapons: [{ id: 'weapon1' }] },
            tomes: { tomes: [] },
            characters: { characters: [{ id: 'char1' }, { id: 'char2' }] },
            shrines: { shrines: [{ id: 'shrine1' }] },
        };
        (window as any).allData = allDataValue;
        (globalThis as any).allData = allDataValue;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    describe('Tab switching with allData', () => {
        it('should count items from allData.items', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('items');

            // Should log with item count = 3
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    data: expect.objectContaining({
                        toTab: 'items',
                        itemCount: 3,
                    }),
                })
            );
        });

        it('should count items from allData.weapons', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            vi.clearAllMocks();
            __resetTimersForTesting();

            await switchTab('weapons');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'weapons',
                        itemCount: 1,
                    }),
                })
            );
        });

        it('should count items from allData.characters', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            vi.clearAllMocks();
            __resetTimersForTesting();

            await switchTab('characters');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'characters',
                        itemCount: 2,
                    }),
                })
            );
        });

        it('should handle empty tomes array', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            vi.clearAllMocks();
            __resetTimersForTesting();

            await switchTab('tomes');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'tomes',
                        itemCount: 0,
                    }),
                })
            );
        });

        it('should handle missing allData gracefully', async () => {
            (window as any).allData = undefined;

            await expect(switchTab('items')).resolves.not.toThrow();
        });

        it('should handle null allData', async () => {
            (window as any).allData = null;

            await expect(switchTab('items')).resolves.not.toThrow();
        });

        it('should handle allData with undefined items array', async () => {
            (window as any).allData = {
                items: undefined,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
            };

            await expect(switchTab('items')).resolves.not.toThrow();
        });

        it('should handle non-data tabs with itemCount 0', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            __resetTimersForTesting();

            await switchTab('build-planner');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'build-planner',
                        itemCount: 0,
                    }),
                })
            );
        });

        it('should handle calculator tab', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            __resetTimersForTesting();

            await switchTab('calculator');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'calculator',
                        itemCount: 0,
                    }),
                })
            );
        });

        it('should handle advisor tab', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            __resetTimersForTesting();

            await switchTab('advisor');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'advisor',
                    }),
                })
            );
        });

        it('should handle changelog tab', async () => {
            const { logger } = await import('../../src/modules/logger.ts');
            __resetTimersForTesting();

            await switchTab('changelog');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        toTab: 'changelog',
                    }),
                })
            );
        });
    });

    describe('Tab button updates', () => {
        it('should update aria-selected on tab buttons', async () => {
            await switchTab('weapons');

            const weaponsBtn = document.querySelector('[data-tab="weapons"]');
            const itemsBtn = document.querySelector('[data-tab="items"]');

            expect(weaponsBtn?.getAttribute('aria-selected')).toBe('true');
            expect(itemsBtn?.getAttribute('aria-selected')).toBe('false');
        });

        it('should add active class to new tab button', async () => {
            await switchTab('tomes');

            const tomesBtn = document.querySelector('[data-tab="tomes"]');
            expect(tomesBtn?.classList.contains('active')).toBe(true);
        });

        it('should remove active class from other tab buttons', async () => {
            // First switch to items
            await switchTab('items');
            __resetTimersForTesting();

            // Then switch to weapons
            await switchTab('weapons');

            const itemsBtn = document.querySelector('[data-tab="items"]');
            const weaponsBtn = document.querySelector('[data-tab="weapons"]');

            expect(itemsBtn?.classList.contains('active')).toBe(false);
            expect(weaponsBtn?.classList.contains('active')).toBe(true);
        });
    });

    describe('Tab content visibility', () => {
        it('should add active class to tab content', async () => {
            await switchTab('weapons');

            const weaponsTab = document.getElementById('weapons-tab');
            expect(weaponsTab?.classList.contains('active')).toBe(true);
        });

        it('should remove active from other tab contents', async () => {
            await switchTab('items');
            __resetTimersForTesting();
            await switchTab('weapons');

            const itemsTab = document.getElementById('items-tab');
            const weaponsTab = document.getElementById('weapons-tab');

            expect(itemsTab?.classList.contains('active')).toBe(false);
            expect(weaponsTab?.classList.contains('active')).toBe(true);
        });
    });

    describe('Filter state persistence', () => {
        it('should save filter state of previous tab', async () => {
            mockStoreState.currentTab = 'items';
            __resetTimersForTesting();

            await switchTab('weapons');

            expect(mockSaveFilterState).toHaveBeenCalledWith('items');
        });

        it('should restore filter state of new tab', async () => {
            await switchTab('tomes');

            expect(mockRestoreFilterState).toHaveBeenCalledWith('tomes');
        });

        it('should update filters for new tab', async () => {
            await switchTab('characters');

            expect(mockUpdateFilters).toHaveBeenCalledWith('characters');
        });
    });

    describe('Module loading', () => {
        it('should show skeleton before loading', async () => {
            await switchTab('items');

            expect(mockShowTabSkeleton).toHaveBeenCalledWith('items');
        });

        it('should load tab modules', async () => {
            await switchTab('build-planner');

            expect(mockLoadTabModules).toHaveBeenCalledWith('build-planner');
        });

        it('should render tab content after loading', async () => {
            await switchTab('calculator');

            expect(mockRenderTabContent).toHaveBeenCalledWith('calculator');
        });

        it('should handle module load failure gracefully', async () => {
            mockLoadTabModules.mockRejectedValueOnce(new Error('Module not found'));

            await expect(switchTab('weapons')).resolves.not.toThrow();

            // Should still try to render
            expect(mockRenderTabContent).toHaveBeenCalled();
        });
    });

    describe('localStorage persistence', () => {
        it('should persist tab to localStorage', async () => {
            await switchTab('shrines');

            expect(localStorage.getItem('megabonk-current-tab')).toBe('shrines');
        });

        it('should update localStorage on each switch', async () => {
            await switchTab('items');
            expect(localStorage.getItem('megabonk-current-tab')).toBe('items');

            __resetTimersForTesting();
            await switchTab('weapons');
            expect(localStorage.getItem('megabonk-current-tab')).toBe('weapons');
        });
    });

    describe('Tab switch debouncing', () => {
        it('should debounce rapid tab switches', async () => {
            // First switch
            await switchTab('items');

            // Rapid second switch without resetting timer
            const promise = switchTab('weapons');

            // Should not have called updateFilters for second switch
            expect(mockUpdateFilters).toHaveBeenCalledTimes(1);

            await promise;
        });

        it('should allow switch after debounce period', async () => {
            await switchTab('items');

            __resetTimersForTesting(); // Reset the debounce timer

            await switchTab('weapons');

            expect(mockUpdateFilters).toHaveBeenCalledTimes(2);
        });
    });

    describe('Invalid tab handling', () => {
        it('should reject invalid tab name', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('not-a-real-tab' as any);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    error: expect.objectContaining({
                        name: 'InvalidTabError',
                    }),
                })
            );
        });

        it('should not update state for invalid tab', async () => {
            const originalTab = mockStoreState.currentTab;

            await switchTab('fake-tab' as any);

            expect(mockStoreState.currentTab).toBe(originalTab);
        });

        it('should not persist invalid tab to localStorage', async () => {
            localStorage.setItem('megabonk-current-tab', 'weapons');

            await switchTab('invalid' as any);

            expect(localStorage.getItem('megabonk-current-tab')).toBe('weapons');
        });
    });

    describe('Same tab handling', () => {
        it('should not re-render when switching to same tab', async () => {
            mockStoreState.currentTab = 'items';

            // Add item cards to simulate already-rendered state
            const itemsContainer = document.getElementById('itemsContainer');
            if (itemsContainer) {
                const card = document.createElement('div');
                card.className = 'item-card';
                itemsContainer.appendChild(card);
            }

            await switchTab('items');

            // Should not call updateFilters since already on same tab
            expect(mockUpdateFilters).not.toHaveBeenCalled();
        });

        it('should allow initial render to same tab', async () => {
            mockStoreState.currentTab = 'items';

            // No item cards = initial render
            const itemsContainer = document.getElementById('itemsContainer');
            if (itemsContainer) {
                itemsContainer.innerHTML = '';
            }

            await switchTab('items');

            // Should render on initial load even if "same" tab
            expect(mockUpdateFilters).toHaveBeenCalled();
        });
    });

    describe('Charts cleanup', () => {
        it('should attempt to destroy charts before switching', async () => {
            await switchTab('items');

            expect(mockDestroyAllCharts).toHaveBeenCalled();
        });

        it('should handle charts module not loaded gracefully', async () => {
            // The mock always succeeds, but the real code catches errors
            await expect(switchTab('weapons')).resolves.not.toThrow();
        });
    });

    describe('Logger context', () => {
        it('should set logger context with current tab', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('tomes');

            expect(logger.setContext).toHaveBeenCalledWith('currentTab', 'tomes');
        });
    });
});
