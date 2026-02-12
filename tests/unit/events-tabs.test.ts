// ========================================
// Events Tabs Module Tests
// ========================================
// Tests for tab switching, loading, and persistence functionality

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';

// Mock dependencies before importing the module
const mockSaveFilterState = vi.fn();
const mockUpdateFilters = vi.fn();
const mockRestoreFilterState = vi.fn();

vi.mock('../../src/modules/filters.ts', () => ({
    saveFilterState: mockSaveFilterState,
    updateFilters: mockUpdateFilters,
    restoreFilterState: mockRestoreFilterState,
}));

const mockRenderTabContent = vi.fn();
vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: mockRenderTabContent,
}));

const mockGetState = vi.fn(() => 'items');
const mockSetState = vi.fn();
vi.mock('../../src/modules/store.ts', () => ({
    getState: (key: string) => mockGetState(key),
    setState: mockSetState,
}));

const mockRegisterFunction = vi.fn();
vi.mock('../../src/modules/registry.ts', () => ({
    registerFunction: mockRegisterFunction,
}));

const mockShowTabSkeleton = vi.fn();
vi.mock('../../src/modules/skeleton-loader.ts', () => ({
    showTabSkeleton: mockShowTabSkeleton,
}));

// Mock charts module (dynamically imported in cleanupPreviousTab)
vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: vi.fn(),
}));

const mockLoadTabModules = vi.fn().mockResolvedValue(undefined);
const mockPreloadCommonModules = vi.fn();
vi.mock('../../src/modules/tab-loader.ts', () => ({
    loadTabModules: mockLoadTabModules,
    preloadCommonModules: mockPreloadCommonModules,
}));

const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    setContext: vi.fn(),
};
vi.mock('../../src/modules/logger.ts', () => ({
    logger: mockLogger,
}));

// Store original implementations for spying
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};

describe('Events Tabs Module', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        // Reset DOM
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
            <div id="weaponsContainer"></div>
            <div id="tomesContainer"></div>
            <button class="tab-btn" data-tab="items" aria-selected="false"></button>
            <button class="tab-btn" data-tab="weapons" aria-selected="false"></button>
            <button class="tab-btn" data-tab="tomes" aria-selected="false"></button>
            <div class="tab-content" id="items-tab"></div>
            <div class="tab-content" id="weapons-tab"></div>
            <div class="tab-content" id="tomes-tab"></div>
        `;

        // Mock localStorage using stubGlobal for proper jsdom override
        vi.stubGlobal('localStorage', mockLocalStorage);
        mockLocalStorage.getItem.mockReturnValue(null);

        // Reset mock implementations
        mockGetState.mockReturnValue('items');
        mockRenderTabContent.mockResolvedValue(undefined);

        // Re-import module to reset internal state
        vi.resetModules();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('VALID_TABS', () => {
        it('should export list of valid tab names', async () => {
            const { VALID_TABS } = await import('../../src/modules/events-tabs.ts');
            
            expect(VALID_TABS).toContain('items');
            expect(VALID_TABS).toContain('weapons');
            expect(VALID_TABS).toContain('tomes');
            expect(VALID_TABS).toContain('characters');
            expect(VALID_TABS).toContain('shrines');
            expect(VALID_TABS).toContain('build-planner');
            expect(VALID_TABS).toContain('calculator');
            expect(VALID_TABS).toContain('advisor');
            expect(VALID_TABS).toContain('changelog');
            expect(VALID_TABS).toContain('about');
        });

        it('should have exactly 10 valid tabs', async () => {
            const { VALID_TABS } = await import('../../src/modules/events-tabs.ts');
            
            expect(VALID_TABS.length).toBe(10);
        });
    });

    describe('getCurrentTab', () => {
        it('should return current tab from store', async () => {
            mockGetState.mockReturnValue('weapons');
            const { getCurrentTab } = await import('../../src/modules/events-tabs.ts');
            
            const result = getCurrentTab();
            
            expect(mockGetState).toHaveBeenCalledWith('currentTab');
            expect(result).toBe('weapons');
        });
    });

    describe('getSavedTab', () => {
        it('should return saved tab from localStorage if valid', async () => {
            mockLocalStorage.getItem.mockReturnValue('weapons');
            const { getSavedTab } = await import('../../src/modules/events-tabs.ts');
            
            const result = getSavedTab();
            
            expect(result).toBe('weapons');
        });

        it('should return "items" if no saved tab', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            const { getSavedTab } = await import('../../src/modules/events-tabs.ts');
            
            const result = getSavedTab();
            
            expect(result).toBe('items');
        });

        it('should return "items" if saved tab is invalid', async () => {
            mockLocalStorage.getItem.mockReturnValue('invalid-tab');
            const { getSavedTab } = await import('../../src/modules/events-tabs.ts');
            
            const result = getSavedTab();
            
            expect(result).toBe('items');
        });

        it('should accept all valid tab names', async () => {
            const { getSavedTab, VALID_TABS } = await import('../../src/modules/events-tabs.ts');
            
            for (const tab of VALID_TABS) {
                mockLocalStorage.getItem.mockReturnValue(tab);
                const result = getSavedTab();
                expect(result).toBe(tab);
            }
        });
    });

    describe('switchTab', () => {
        it('should switch to a valid tab', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockSetState).toHaveBeenCalledWith('currentTab', 'weapons');
        });

        it('should save tab to localStorage', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('tomes');
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('megabonk-current-tab', 'tomes');
        });

        it('should update filter state before switching', async () => {
            mockGetState.mockReturnValue('items');
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockSaveFilterState).toHaveBeenCalledWith('items');
        });

        it('should update filters for new tab', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockUpdateFilters).toHaveBeenCalledWith('weapons');
            expect(mockRestoreFilterState).toHaveBeenCalledWith('weapons');
        });

        it('should show skeleton loader', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockShowTabSkeleton).toHaveBeenCalledWith('weapons');
        });

        it('should load tab modules', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockLoadTabModules).toHaveBeenCalledWith('weapons');
        });

        it('should render tab content', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockRenderTabContent).toHaveBeenCalledWith('weapons');
        });

        it('should log tab switch', async () => {
            mockGetState.mockReturnValue('items');
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('weapons');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    data: expect.objectContaining({
                        fromTab: 'items',
                        toTab: 'weapons',
                    }),
                })
            );
        });

        it('should set logger context', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            __resetTimersForTesting();
            
            await switchTab('tomes');
            
            expect(mockLogger.setContext).toHaveBeenCalledWith('currentTab', 'tomes');
        });

        describe('Validation', () => {
            it('should reject invalid tab names', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                await switchTab('invalid-tab' as never);
                
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'tab.switch',
                        error: expect.objectContaining({
                            message: expect.stringContaining('Invalid tab name'),
                        }),
                    })
                );
                expect(mockSetState).not.toHaveBeenCalled();
            });

            it('should reject empty tab name', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                await switchTab('' as never);
                
                expect(mockSetState).not.toHaveBeenCalled();
            });
        });

        describe('Debouncing', () => {
            it('should debounce rapid tab switches', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                // First switch should work
                await switchTab('weapons');
                
                // Immediate second switch should be debounced
                await switchTab('tomes');
                
                // Only first switch should have been processed
                expect(mockSetState).toHaveBeenCalledTimes(1);
                expect(mockSetState).toHaveBeenCalledWith('currentTab', 'weapons');
            });

            it('should allow switch after debounce period', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                await switchTab('weapons');
                
                // Advance time past debounce period (100ms)
                vi.advanceTimersByTime(150);
                
                await switchTab('tomes');
                
                expect(mockSetState).toHaveBeenCalledTimes(2);
            });
        });

        describe('Concurrent Switch Prevention', () => {
            it('should prevent concurrent tab switches', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                // Make loadTabModules take time
                mockLoadTabModules.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));
                
                // Start first switch (don't await yet)
                const firstSwitch = switchTab('weapons');
                
                // Advance past debounce and try second switch
                await vi.advanceTimersByTimeAsync(150);
                await switchTab('tomes');
                
                // Complete first switch
                await vi.advanceTimersByTimeAsync(500);
                await firstSwitch;
                
                // Only first switch should have been processed
                expect(mockSetState).toHaveBeenCalledWith('currentTab', 'weapons');
            });

            it('should log skipped concurrent switch', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                mockLoadTabModules.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));
                
                const firstSwitch = switchTab('weapons');
                
                await vi.advanceTimersByTimeAsync(150);
                await switchTab('tomes');
                
                expect(mockLogger.info).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'tab.switch.skipped',
                        data: expect.objectContaining({
                            reason: 'switch_in_progress',
                            requestedTab: 'tomes',
                        }),
                    })
                );
                
                await vi.advanceTimersByTimeAsync(500);
                await firstSwitch;
            });
        });

        describe('Same Tab Prevention', () => {
            it('should skip switch if already on the same tab', async () => {
                mockGetState.mockReturnValue('weapons');
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();

                // Add item cards to indicate content is rendered
                document.querySelector('#weaponsContainer')!.innerHTML = '<div class="item-card"></div>';
                
                await switchTab('weapons');
                
                // Should not render again since already on same tab with content
                expect(mockRenderTabContent).not.toHaveBeenCalled();
            });

            it('should allow switch to same tab on initial render', async () => {
                mockGetState.mockReturnValue('items');
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                // No item cards = initial render
                const switchPromise = switchTab('items');
                await vi.runAllTimersAsync();
                await switchPromise;
                
                // Should render since it's initial render
                expect(mockRenderTabContent).toHaveBeenCalledWith('items');
            });
        });

        describe('UI Updates', () => {
            it('should update active state on tab buttons', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                const switchPromise = switchTab('weapons');
                await vi.runAllTimersAsync();
                await switchPromise;
                
                const weaponsBtn = document.querySelector('[data-tab="weapons"]');
                const itemsBtn = document.querySelector('[data-tab="items"]');
                
                expect(weaponsBtn?.classList.contains('active')).toBe(true);
                expect(weaponsBtn?.getAttribute('aria-selected')).toBe('true');
                expect(itemsBtn?.classList.contains('active')).toBe(false);
                expect(itemsBtn?.getAttribute('aria-selected')).toBe('false');
            });

            it('should update active state on tab content', async () => {
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                const switchPromise = switchTab('weapons');
                await vi.runAllTimersAsync();
                await switchPromise;
                
                const weaponsTab = document.getElementById('weapons-tab');
                const itemsTab = document.getElementById('items-tab');
                
                expect(weaponsTab?.classList.contains('active')).toBe(true);
                expect(itemsTab?.classList.contains('active')).toBe(false);
            });
        });

        describe('Error Handling', () => {
            it('should handle module load failure gracefully', async () => {
                mockLoadTabModules.mockRejectedValue(new Error('Module load failed'));
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                // Should not throw
                await expect(switchTab('weapons')).resolves.toBeUndefined();
                
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'tab.module_load_failed',
                    })
                );
            });

            it('should still render content after module load failure', async () => {
                mockLoadTabModules.mockRejectedValue(new Error('Module load failed'));
                const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
                __resetTimersForTesting();
                
                await switchTab('weapons');
                
                expect(mockRenderTabContent).toHaveBeenCalledWith('weapons');
            });
        });
    });

    describe('scheduleModulePreload', () => {
        it('should schedule preload with requestIdleCallback when available', async () => {
            const mockRequestIdleCallback = vi.fn((cb) => { cb(); return 1; });
            vi.stubGlobal('requestIdleCallback', mockRequestIdleCallback);
            
            const { scheduleModulePreload } = await import('../../src/modules/events-tabs.ts');
            
            scheduleModulePreload();
            
            expect(mockRequestIdleCallback).toHaveBeenCalled();
            expect(mockPreloadCommonModules).toHaveBeenCalled();
            
            vi.unstubAllGlobals();
        });

        it('should use setTimeout fallback when requestIdleCallback unavailable', async () => {
            vi.stubGlobal('requestIdleCallback', undefined);
            
            const { scheduleModulePreload } = await import('../../src/modules/events-tabs.ts');
            
            scheduleModulePreload();
            
            expect(mockPreloadCommonModules).not.toHaveBeenCalled();
            
            vi.advanceTimersByTime(2000);
            
            expect(mockPreloadCommonModules).toHaveBeenCalled();
            
            vi.unstubAllGlobals();
        });
    });

    describe('__resetTimersForTesting', () => {
        it('should reset internal timers', async () => {
            const { switchTab, __resetTimersForTesting } = await import('../../src/modules/events-tabs.ts');
            
            // First switch
            await switchTab('weapons');
            
            // Reset timers
            __resetTimersForTesting();
            
            // Should be able to switch immediately (debounce reset)
            await switchTab('tomes');
            
            expect(mockSetState).toHaveBeenCalledWith('currentTab', 'tomes');
        });
    });

    describe('Registry and Global Assignment', () => {
        it('should register switchTab function', async () => {
            await import('../../src/modules/events-tabs.ts');
            
            expect(mockRegisterFunction).toHaveBeenCalledWith('switchTab', expect.any(Function));
        });

        it('should assign switchTab to window for backwards compatibility', async () => {
            await import('../../src/modules/events-tabs.ts');
            
            expect(window.switchTab).toBeDefined();
            expect(typeof window.switchTab).toBe('function');
        });
    });

    describe('currentTab Export', () => {
        it('should provide current tab via getCurrentTab', async () => {
            const { getCurrentTab } = await import('../../src/modules/events-tabs.ts');
            
            expect(getCurrentTab()).toBeDefined();
        });
    });
});
