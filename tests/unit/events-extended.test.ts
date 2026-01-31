/**
 * @vitest-environment jsdom
 * Events Module - Extended Coverage Tests
 * Target: >60% coverage for events.ts
 * Focuses on functions and paths not covered by existing tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock all dependencies
vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: vi.fn(),
}));

vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/filters.ts', () => ({
    clearFilters: vi.fn(),
    handleSearch: vi.fn(),
    updateFilters: vi.fn(),
    restoreFilterState: vi.fn(),
    saveFilterState: vi.fn(),
}));

vi.mock('../../src/modules/search-history.ts', () => ({
    showSearchHistoryDropdown: vi.fn(),
}));

vi.mock('../../src/modules/search-dropdown.ts', () => ({
    handleDropdownKeyboard: vi.fn(() => false),
    isSearchDropdownVisible: vi.fn(() => false),
    hideSearchDropdown: vi.fn(),
    setupDropdownClickHandlers: vi.fn(),
}));

vi.mock('../../src/modules/modal.ts', () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    toggleFavorite: vi.fn(() => true),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    loadAllData: vi.fn(),
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

vi.mock('../../src/modules/registry.ts', () => ({
    registerFunction: vi.fn(),
}));

vi.mock('../../src/modules/skeleton-loader.ts', () => ({
    showTabSkeleton: vi.fn(),
}));

vi.mock('../../src/modules/tab-loader.ts', () => ({
    loadTabModules: vi.fn().mockResolvedValue(undefined),
    preloadCommonModules: vi.fn(),
}));

// Create a hoisted mutable store state for testing
const mockStoreState = vi.hoisted(() => ({
    currentTab: 'items' as string,
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

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    debounce: vi.fn((fn: Function, delay: number) => fn),
    escapeHtml: vi.fn((str: string) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
}));

import {
    setupEventDelegation,
    setupEventListeners,
    cleanupEventListeners,
    cleanupTabScrollListeners,
    toggleTextExpand,
    showLoading,
    hideLoading,
    showErrorMessage,
    dismissError,
    switchTab,
    getCurrentTab,
    getSavedTab,
    scheduleModulePreload,
    __resetTimersForTesting,
} from '../../src/modules/events.ts';

describe('Events Module - Extended Coverage', () => {
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
            weapons: { weapons: [{ id: 'weapon1', name: 'Test Weapon' }] },
            tomes: { tomes: [{ id: 'tome1', name: 'Test Tome' }] },
            characters: { characters: [{ id: 'char1', name: 'Test Character' }] },
            shrines: { shrines: [{ id: 'shrine1', name: 'Test Shrine' }] },
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        cleanupEventListeners();
    });

    // ========================================
    // toggleTextExpand Tests
    // ========================================
    describe('toggleTextExpand', () => {
        it('should expand truncated text', () => {
            const element = document.createElement('span');
            element.className = 'expandable-text';
            element.dataset.fullText = 'This is a very long text that was truncated and should be expanded when clicked by the user to reveal the full content';
            element.dataset.truncated = 'true';
            element.textContent = 'This is a very long text...';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBe('false');
            expect(element.classList.contains('expanded')).toBe(true);
            expect(element.textContent).toContain('This is a very long text that was truncated');

            element.remove();
        });

        it('should collapse expanded text', () => {
            const longText = 'A'.repeat(150); // More than 120 chars
            const element = document.createElement('span');
            element.className = 'expandable-text expanded';
            element.dataset.fullText = longText;
            element.dataset.truncated = 'false';
            element.textContent = longText;
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBe('true');
            expect(element.classList.contains('expanded')).toBe(false);
            expect(element.textContent).toContain('...');

            element.remove();
        });

        it('should not modify element without fullText data', () => {
            const element = document.createElement('span');
            element.className = 'expandable-text';
            element.dataset.truncated = 'true';
            element.textContent = 'Original text';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.textContent).toBe('Original text');

            element.remove();
        });

        it('should handle short text (under 120 chars) on collapse', () => {
            const shortText = 'Short text here';
            const element = document.createElement('span');
            element.className = 'expandable-text expanded';
            element.dataset.fullText = shortText;
            element.dataset.truncated = 'false';
            element.textContent = shortText;
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.dataset.truncated).toBe('true');
            // Short text should not have ellipsis
            expect(element.querySelector('span')?.textContent).toBe(shortText);

            element.remove();
        });

        it('should add expand indicator on collapse', () => {
            const longText = 'B'.repeat(150);
            const element = document.createElement('span');
            element.className = 'expandable-text expanded';
            element.dataset.fullText = longText;
            element.dataset.truncated = 'false';
            document.body.appendChild(element);

            toggleTextExpand(element);

            const indicator = element.querySelector('.expand-indicator');
            expect(indicator).not.toBeNull();
            expect(indicator?.textContent).toBe('Click to expand');

            element.remove();
        });

        it('should add collapse indicator on expand', () => {
            const element = document.createElement('span');
            element.className = 'expandable-text';
            element.dataset.fullText = 'Full text content here';
            element.dataset.truncated = 'true';
            document.body.appendChild(element);

            toggleTextExpand(element);

            const indicator = element.querySelector('.expand-indicator');
            expect(indicator).not.toBeNull();
            expect(indicator?.textContent).toBe('Click to collapse');

            element.remove();
        });
    });

    // ========================================
    // Loading Functions Tests
    // ========================================
    describe('Loading Functions', () => {
        beforeEach(() => {
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
        });

        afterEach(() => {
            document.getElementById('loading-overlay')?.remove();
        });

        it('showLoading should display the overlay', () => {
            showLoading();

            const overlay = document.getElementById('loading-overlay');
            expect(overlay?.style.display).toBe('flex');
        });

        it('hideLoading should hide the overlay', () => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'flex';

            hideLoading();

            expect(overlay?.style.display).toBe('none');
        });

        it('showLoading should handle missing overlay', () => {
            document.getElementById('loading-overlay')?.remove();

            expect(() => showLoading()).not.toThrow();
        });

        it('hideLoading should handle missing overlay', () => {
            document.getElementById('loading-overlay')?.remove();

            expect(() => hideLoading()).not.toThrow();
        });
    });

    // ========================================
    // Error Message Functions Tests
    // ========================================
    describe('Error Message Functions', () => {
        afterEach(() => {
            document.getElementById('error-container')?.remove();
        });

        it('showErrorMessage should create container if not exists', () => {
            showErrorMessage('Test error');

            const container = document.getElementById('error-container');
            expect(container).not.toBeNull();
            expect(container?.style.display).toBe('block');
        });

        it('showErrorMessage should include error icon', () => {
            showErrorMessage('Test error');

            const icon = document.querySelector('.error-icon');
            expect(icon).not.toBeNull();
            expect(icon?.textContent).toBe('⚠️');
        });

        it('showErrorMessage should display error message', () => {
            showErrorMessage('Custom error message');

            const content = document.querySelector('.error-content p');
            expect(content?.textContent).toBe('Custom error message');
        });

        it('showErrorMessage should show retry button when retryable', () => {
            showErrorMessage('Retryable error', true);

            const retryBtn = document.querySelector('.error-retry-btn');
            expect(retryBtn).not.toBeNull();
        });

        it('showErrorMessage should hide retry button when not retryable', () => {
            showErrorMessage('Non-retryable error', false);

            const retryBtn = document.querySelector('.error-retry-btn');
            expect(retryBtn).toBeNull();
        });

        it('showErrorMessage should escape HTML in message', async () => {
            const { escapeHtml } = await import('../../src/modules/utils.ts');
            vi.mocked(escapeHtml).mockClear();

            showErrorMessage('<script>alert("xss")</script>');

            // Verify escapeHtml was called with the dangerous input
            expect(escapeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
        });

        it('showErrorMessage retry button should dismiss and reload', async () => {
            showErrorMessage('Test error', true);

            const retryBtn = document.querySelector('.error-retry-btn') as HTMLButtonElement;
            retryBtn?.click();

            const container = document.getElementById('error-container');
            expect(container?.style.display).toBe('none');

            const { loadAllData } = await import('../../src/modules/data-service.ts');
            expect(loadAllData).toHaveBeenCalled();
        });

        it('showErrorMessage close button should dismiss error', () => {
            showErrorMessage('Test error');

            const closeBtn = document.querySelector('.error-close') as HTMLButtonElement;
            closeBtn?.click();

            const container = document.getElementById('error-container');
            expect(container?.style.display).toBe('none');
        });

        it('showErrorMessage should update existing container', () => {
            showErrorMessage('First error');
            showErrorMessage('Second error');

            const containers = document.querySelectorAll('#error-container');
            expect(containers.length).toBe(1);

            const content = document.querySelector('.error-content p');
            expect(content?.textContent).toBe('Second error');
        });

        it('dismissError should hide error container', () => {
            showErrorMessage('Test error');

            dismissError();

            const container = document.getElementById('error-container');
            expect(container?.style.display).toBe('none');
        });

        it('dismissError should handle missing container', () => {
            expect(() => dismissError()).not.toThrow();
        });
    });

    // ========================================
    // Tab Switching Tests
    // ========================================
    describe('Tab Switching', () => {
        beforeEach(() => {
            mockStoreState.currentTab = 'items';
        });

        it('switchTab should update tab buttons active state', async () => {
            await switchTab('weapons');

            const itemsBtn = document.querySelector('[data-tab="items"]');
            const weaponsBtn = document.querySelector('[data-tab="weapons"]');

            expect(itemsBtn?.classList.contains('active')).toBe(false);
            expect(weaponsBtn?.classList.contains('active')).toBe(true);
        });

        it('switchTab should update aria-selected attributes', async () => {
            await switchTab('tomes');

            const tomesBtn = document.querySelector('[data-tab="tomes"]');
            expect(tomesBtn?.getAttribute('aria-selected')).toBe('true');
        });

        it('switchTab should update tab content visibility', async () => {
            await switchTab('characters');

            const itemsTab = document.getElementById('items-tab');
            const charactersTab = document.getElementById('characters-tab');

            expect(itemsTab?.classList.contains('active')).toBe(false);
            expect(charactersTab?.classList.contains('active')).toBe(true);
        });

        it('switchTab should save to localStorage', async () => {
            await switchTab('shrines');

            expect(localStorage.getItem('megabonk-current-tab')).toBe('shrines');
        });

        it('switchTab should call updateFilters', async () => {
            const { updateFilters } = await import('../../src/modules/filters.ts');

            await switchTab('build-planner');

            expect(updateFilters).toHaveBeenCalledWith('build-planner');
        });

        it('switchTab should call restoreFilterState', async () => {
            const { restoreFilterState } = await import('../../src/modules/filters.ts');

            await switchTab('calculator');

            expect(restoreFilterState).toHaveBeenCalledWith('calculator');
        });

        it('switchTab should call showTabSkeleton', async () => {
            const { showTabSkeleton } = await import('../../src/modules/skeleton-loader.ts');

            await switchTab('advisor');

            expect(showTabSkeleton).toHaveBeenCalledWith('advisor');
        });

        it('switchTab should call loadTabModules', async () => {
            const { loadTabModules } = await import('../../src/modules/tab-loader.ts');

            await switchTab('changelog');

            expect(loadTabModules).toHaveBeenCalledWith('changelog');
        });

        it('switchTab should call renderTabContent', async () => {
            const { renderTabContent } = await import('../../src/modules/renderers.ts');

            await switchTab('items');

            expect(renderTabContent).toHaveBeenCalledWith('items');
        });

        it('switchTab should log tab switch', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('weapons');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    data: expect.objectContaining({
                        toTab: 'weapons',
                    }),
                })
            );
        });

        it('switchTab should set logger context', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('tomes');

            expect(logger.setContext).toHaveBeenCalledWith('currentTab', 'tomes');
        });

        it('switchTab should reject invalid tab names', async () => {
            const { logger } = await import('../../src/modules/logger.ts');

            await switchTab('invalid-tab' as any);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'tab.switch',
                    error: expect.objectContaining({
                        name: 'InvalidTabError',
                    }),
                })
            );
        });

        it('switchTab should debounce rapid switches', async () => {
            const { updateFilters } = await import('../../src/modules/filters.ts');

            await switchTab('weapons');
            await switchTab('tomes'); // Should be debounced

            // Only first switch should proceed
            expect(updateFilters).toHaveBeenCalledTimes(1);
        });

        it('switchTab should handle loadTabModules failure gracefully', async () => {
            const { loadTabModules } = await import('../../src/modules/tab-loader.ts');
            (loadTabModules as any).mockRejectedValueOnce(new Error('Module load failed'));

            // Should not throw
            await expect(switchTab('weapons')).resolves.not.toThrow();
        });

        it('switchTab should save previous tab filter state', async () => {
            const { saveFilterState } = await import('../../src/modules/filters.ts');
            mockStoreState.currentTab = 'items';

            await switchTab('weapons');

            expect(saveFilterState).toHaveBeenCalledWith('items');
        });
    });

    // ========================================
    // getCurrentTab Tests
    // ========================================
    describe('getCurrentTab', () => {
        it('should return current tab from store', () => {
            mockStoreState.currentTab = 'weapons';

            expect(getCurrentTab()).toBe('weapons');
        });
    });

    // ========================================
    // getSavedTab Tests
    // ========================================
    describe('getSavedTab', () => {
        it('should return saved tab from localStorage', () => {
            localStorage.setItem('megabonk-current-tab', 'tomes');

            expect(getSavedTab()).toBe('tomes');
        });

        it('should return default tab when localStorage is empty', () => {
            localStorage.removeItem('megabonk-current-tab');

            expect(getSavedTab()).toBe('items');
        });

        it('should return default tab for invalid saved value', () => {
            localStorage.setItem('megabonk-current-tab', 'invalid-tab-name');

            expect(getSavedTab()).toBe('items');
        });

        it('should accept all valid tab names', () => {
            const validTabs = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator', 'advisor', 'changelog'];

            validTabs.forEach(tab => {
                localStorage.setItem('megabonk-current-tab', tab);
                expect(getSavedTab()).toBe(tab);
            });
        });
    });

    // ========================================
    // scheduleModulePreload Tests
    // ========================================
    describe('scheduleModulePreload', () => {
        it('should call preloadCommonModules', async () => {
            // Get mock reference and clear it BEFORE setting up requestIdleCallback
            const { preloadCommonModules } = await import('../../src/modules/tab-loader.ts');
            vi.mocked(preloadCommonModules).mockClear();

            // Set up requestIdleCallback to call the callback synchronously
            // Must set on globalThis since the code checks `typeof requestIdleCallback`
            const originalRequestIdleCallback = (globalThis as any).requestIdleCallback;
            (globalThis as any).requestIdleCallback = (cb: Function) => {
                cb();
                return 1;
            };

            scheduleModulePreload();

            expect(preloadCommonModules).toHaveBeenCalled();

            // Restore original
            if (originalRequestIdleCallback) {
                (globalThis as any).requestIdleCallback = originalRequestIdleCallback;
            } else {
                delete (globalThis as any).requestIdleCallback;
            }
        });

        it('should use setTimeout fallback when requestIdleCallback unavailable', async () => {
            const originalRequestIdleCallback = (window as any).requestIdleCallback;
            delete (window as any).requestIdleCallback;

            vi.useFakeTimers();

            scheduleModulePreload();

            vi.advanceTimersByTime(2000);

            const { preloadCommonModules } = await import('../../src/modules/tab-loader.ts');
            expect(preloadCommonModules).toHaveBeenCalled();

            vi.useRealTimers();
            (window as any).requestIdleCallback = originalRequestIdleCallback;
        });
    });

    // ========================================
    // Cleanup Functions Tests
    // ========================================
    describe('Cleanup Functions', () => {
        it('cleanupEventListeners should not throw', () => {
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('cleanupEventListeners can be called multiple times', () => {
            expect(() => {
                cleanupEventListeners();
                cleanupEventListeners();
            }).not.toThrow();
        });

        it('cleanupTabScrollListeners should not throw', () => {
            expect(() => cleanupTabScrollListeners()).not.toThrow();
        });

        it('cleanupTabScrollListeners can be called multiple times', () => {
            expect(() => {
                cleanupTabScrollListeners();
                cleanupTabScrollListeners();
            }).not.toThrow();
        });
    });

    // ========================================
    // setupEventDelegation Tests
    // ========================================
    describe('setupEventDelegation', () => {
        it('should not throw when setting up', () => {
            expect(() => setupEventDelegation()).not.toThrow();
        });

        it('should handle keydown events', () => {
            setupEventDelegation();

            // Should not throw
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }).not.toThrow();
        });

        it('should handle click events', () => {
            setupEventDelegation();

            expect(() => {
                document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }).not.toThrow();
        });

        it('should handle change events', () => {
            setupEventDelegation();

            expect(() => {
                document.dispatchEvent(new Event('change', { bubbles: true }));
            }).not.toThrow();
        });
    });

    // ========================================
    // setupEventListeners Tests
    // ========================================
    describe('setupEventListeners', () => {
        it('should not throw when setting up', () => {
            expect(() => setupEventListeners()).not.toThrow();
        });

        it('should setup tab button click handlers', () => {
            setupEventListeners();

            const tabBtn = document.querySelector('[data-tab="weapons"]') as HTMLElement;
            
            // Click should trigger switchTab (via the event listener)
            expect(() => tabBtn.click()).not.toThrow();
        });

        it('should setup search input handlers', () => {
            setupEventListeners();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            
            expect(() => {
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('focus', { bubbles: true }));
            }).not.toThrow();
        });

        it('should setup modal close button handlers', () => {
            setupEventListeners();

            const closeBtn = document.querySelector('.close') as HTMLElement;
            
            expect(() => closeBtn?.click()).not.toThrow();
        });
    });

    // ========================================
    // __resetTimersForTesting Tests
    // ========================================
    describe('__resetTimersForTesting', () => {
        it('should reset internal timers', () => {
            expect(() => __resetTimersForTesting()).not.toThrow();
        });

        it('should allow rapid tab switches after reset', async () => {
            await switchTab('weapons');
            __resetTimersForTesting();
            await switchTab('tomes');

            // Both should work
            expect(mockStoreState.currentTab).toBe('tomes');
        });
    });
});
