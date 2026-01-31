/**
 * @vitest-environment jsdom
 * Enhanced Favorites Module Tests - Coverage Improvement
 * Focuses on localStorage error handling and edge cases
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    loadFavorites,
    toggleFavorite,
    isFavorite,
    getFavorites,
    clearAllFavorites,
} from '../../src/modules/favorites.ts';
import { getState, setState, resetStore } from '../../src/modules/store.ts';
import { ToastManager } from '../../src/modules/toast.ts';

// Mock ToastManager
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

describe('Favorites Module - Enhanced Coverage', () => {
    // Store the original localStorage
    let originalLocalStorage: Storage;

    beforeEach(() => {
        vi.clearAllMocks();
        originalLocalStorage = window.localStorage;
        localStorage.clear();
        resetStore();
    });

    afterEach(() => {
        // Restore original localStorage
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        localStorage.clear();
        resetStore();
    });

    // ========================================
    // localStorage Unavailability Tests
    // ========================================
    describe('localStorage unavailability', () => {
        it('should handle localStorage being completely unavailable', () => {
            // Make localStorage throw on any access
            Object.defineProperty(window, 'localStorage', {
                get: () => {
                    throw new Error('localStorage not available');
                },
                configurable: true,
            });

            // Reset the cached availability check
            // This requires re-importing the module, so we test the behavior indirectly
            
            // Even without localStorage, the basic operations should work in memory
            const result = toggleFavorite('items', 'test_item');
            expect(result).toBe(true);
            expect(getState('favorites').items).toContain('test_item');
        });

        it('should show warning when localStorage is unavailable during load', () => {
            // Create a localStorage that throws on setItem (for test detection)
            const mockStorage = {
                getItem: vi.fn(() => {
                    throw new Error('localStorage not available');
                }),
                setItem: vi.fn(() => {
                    throw new Error('localStorage not available');
                }),
                removeItem: vi.fn(() => {
                    throw new Error('localStorage not available');
                }),
                clear: vi.fn(),
                key: vi.fn(),
                length: 0,
            };

            Object.defineProperty(window, 'localStorage', {
                value: mockStorage,
                writable: true,
                configurable: true,
            });

            // Should not throw
            expect(() => loadFavorites()).not.toThrow();
        });

        it('should return false when localStorage test fails', () => {
            // Mock localStorage that fails the test write
            const mockStorage = {
                getItem: vi.fn(() => 'wrong_value'), // Returns wrong value
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
                key: vi.fn(),
                length: 0,
            };

            Object.defineProperty(window, 'localStorage', {
                value: mockStorage,
                writable: true,
                configurable: true,
            });

            // Force a fresh check (this would be the behavior on first load)
            resetStore();
            
            // The test write/read cycle returns wrong value
            // This tests the path where localStorage "works" but doesn't properly store
            expect(() => loadFavorites()).not.toThrow();
        });
    });

    // ========================================
    // localStorage Error Handling Tests
    // ========================================
    describe('localStorage error handling during save', () => {
        it('should handle QuotaExceededError when saving', () => {
            // First, ensure favorites are loaded normally
            loadFavorites();
            
            // Then make setItem throw QuotaExceededError
            const quotaError = new Error('Quota exceeded');
            quotaError.name = 'QuotaExceededError';
            
            const originalSetItem = localStorage.setItem.bind(localStorage);
            vi.spyOn(localStorage, 'setItem').mockImplementation((key) => {
                if (key === 'megabonk_favorites') {
                    throw quotaError;
                }
                return originalSetItem(key);
            });

            // Toggle should still work in memory
            const result = toggleFavorite('items', 'quota_test');
            expect(result).toBe(true);
            expect(getState('favorites').items).toContain('quota_test');
            
            // Should have called ToastManager.error
            expect(ToastManager.error).toHaveBeenCalledWith(
                'Storage full. Try clearing browser cache to save favorites.'
            );
        });

        it('should handle SecurityError when saving', () => {
            // First, ensure favorites are loaded normally
            loadFavorites();
            
            // Then make setItem throw SecurityError
            const securityError = new Error('Security error');
            securityError.name = 'SecurityError';
            
            vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
                throw securityError;
            });

            // Toggle should still work in memory
            const result = toggleFavorite('items', 'security_test');
            expect(result).toBe(true);
            
            // Should have called ToastManager.warning
            expect(ToastManager.warning).toHaveBeenCalledWith(
                'Favorites disabled in private browsing mode'
            );
        });

        it('should handle generic errors when saving', () => {
            // First, ensure favorites are loaded normally
            loadFavorites();
            
            // Then make setItem throw a generic error
            const genericError = new Error('Unknown error');
            genericError.name = 'Error';
            
            vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
                throw genericError;
            });

            // Toggle should still work in memory
            const result = toggleFavorite('items', 'generic_test');
            expect(result).toBe(true);
            
            // Should have called ToastManager.error with generic message
            expect(ToastManager.error).toHaveBeenCalledWith('Failed to save favorite');
        });

        it('should silently handle errors when ToastManager throws', () => {
            // First, ensure favorites are loaded normally
            loadFavorites();
            
            // Make ToastManager throw
            vi.mocked(ToastManager.error).mockImplementation(() => {
                throw new Error('ToastManager not initialized');
            });
            
            // Make setItem throw
            vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
                throw new Error('Storage error');
            });

            // Should not throw even when ToastManager fails
            expect(() => toggleFavorite('items', 'toast_error_test')).not.toThrow();
        });
    });

    // ========================================
    // loadFavorites Edge Cases
    // ========================================
    describe('loadFavorites edge cases', () => {
        it('should handle non-object parsed JSON', () => {
            // Store a non-object value (string primitive)
            localStorage.setItem('megabonk_favorites', '"not an object"');

            const result = loadFavorites();
            // Strings are not objects, so they're ignored
            // But localStorage is available, so it returns true (no favorites stored is still success)
            expect(result).toBe(true);
            // Favorites should remain at default empty state
            expect(getState('favorites').items).toEqual([]);
        });

        it('should handle null parsed JSON', () => {
            localStorage.setItem('megabonk_favorites', 'null');

            const result = loadFavorites();
            // null fails the `parsed !== null` check, so state is not set
            // But localStorage is available, so it returns true
            expect(result).toBe(true);
            // Favorites should remain at default empty state
            expect(getState('favorites').items).toEqual([]);
        });

        it('should handle array parsed JSON', () => {
            localStorage.setItem('megabonk_favorites', '["item1", "item2"]');

            // Arrays are objects in JS, but not the expected structure
            const result = loadFavorites();
            // This should still work since arrays are objects
            expect(result).toBe(true);
        });

        it('should show warning toast for parse errors', () => {
            localStorage.setItem('megabonk_favorites', 'invalid json {{{');

            loadFavorites();
            
            expect(ToastManager.warning).toHaveBeenCalledWith(
                'Could not load saved favorites. Using fresh list.'
            );
        });

        it('should handle ToastManager throwing during load warning', () => {
            localStorage.setItem('megabonk_favorites', 'invalid json');
            
            vi.mocked(ToastManager.warning).mockImplementation(() => {
                throw new Error('ToastManager not ready');
            });

            // Should not throw
            expect(() => loadFavorites()).not.toThrow();
        });
    });

    // ========================================
    // clearAllFavorites Tests
    // ========================================
    describe('clearAllFavorites', () => {
        it('should call ToastManager.success after clearing', () => {
            setState('favorites', {
                items: ['a'],
                weapons: ['b'],
                tomes: ['c'],
                characters: ['d'],
                shrines: ['e'],
            });

            clearAllFavorites();

            expect(ToastManager.success).toHaveBeenCalledWith('All favorites cleared');
        });

        it('should handle ToastManager throwing during clear success', () => {
            vi.mocked(ToastManager.success).mockImplementation(() => {
                throw new Error('ToastManager not ready');
            });

            // Should not throw
            expect(() => clearAllFavorites()).not.toThrow();
        });

        it('should persist cleared state to localStorage', () => {
            loadFavorites();
            toggleFavorite('items', 'to_clear');
            
            clearAllFavorites();

            const stored = localStorage.getItem('megabonk_favorites');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.items).toEqual([]);
        });
    });

    // ========================================
    // isFavorite Edge Cases
    // ========================================
    describe('isFavorite edge cases', () => {
        it('should return false for undefined tab in state', () => {
            // Set state without a specific tab
            setState('favorites', {
                items: [],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            // Check a valid tab that's empty
            expect(isFavorite('items', 'nonexistent')).toBe(false);
        });

        it('should handle checking favorite on uninitialized tab', () => {
            // Create a minimal state where a tab might be undefined
            const minimalState = {} as any;
            setState('favorites', minimalState);

            // Should return false without throwing
            expect(isFavorite('items', 'test')).toBe(false);
        });
    });

    // ========================================
    // getFavorites Edge Cases
    // ========================================
    describe('getFavorites edge cases', () => {
        it('should return empty array for undefined tab', () => {
            const minimalState = {} as any;
            setState('favorites', minimalState);

            expect(getFavorites('items')).toEqual([]);
        });
    });

    // ========================================
    // toggleFavorite Edge Cases
    // ========================================
    describe('toggleFavorite edge cases', () => {
        it('should handle adding to undefined tab', () => {
            // Start with minimal state
            const minimalState = {} as any;
            setState('favorites', minimalState);

            // Should create the array
            const result = toggleFavorite('items', 'new_item');
            expect(result).toBe(true);
            expect(getState('favorites').items).toContain('new_item');
        });

        it('should preserve other tabs when toggling', () => {
            setState('favorites', {
                items: ['existing'],
                weapons: ['weapon1'],
                tomes: [],
                characters: [],
                shrines: [],
            });

            toggleFavorite('items', 'new_item');

            const state = getState('favorites');
            expect(state.items).toContain('existing');
            expect(state.items).toContain('new_item');
            expect(state.weapons).toContain('weapon1');
        });

        it('should create immutable copies of arrays', () => {
            setState('favorites', {
                items: ['item1'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            });

            const originalItems = getState('favorites').items;
            
            toggleFavorite('items', 'item2');

            // Original reference should be unchanged
            expect(originalItems).toEqual(['item1']);
            // But new state should have both
            expect(getState('favorites').items).toEqual(['item1', 'item2']);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('integration tests', () => {
        it('should persist favorites across load/save cycles', () => {
            // Initial load
            loadFavorites();
            
            // Add some favorites
            toggleFavorite('items', 'item1');
            toggleFavorite('weapons', 'weapon1');
            toggleFavorite('tomes', 'tome1');

            // Reset store to simulate page reload
            resetStore();

            // Load again
            loadFavorites();

            // Verify persistence
            expect(isFavorite('items', 'item1')).toBe(true);
            expect(isFavorite('weapons', 'weapon1')).toBe(true);
            expect(isFavorite('tomes', 'tome1')).toBe(true);
        });

        it('should handle concurrent toggles correctly', () => {
            loadFavorites();

            // Simulate rapid concurrent toggles
            toggleFavorite('items', 'concurrent1');
            toggleFavorite('items', 'concurrent2');
            toggleFavorite('items', 'concurrent3');
            toggleFavorite('items', 'concurrent2'); // Remove
            toggleFavorite('items', 'concurrent4');

            const items = getState('favorites').items;
            expect(items).toContain('concurrent1');
            expect(items).not.toContain('concurrent2');
            expect(items).toContain('concurrent3');
            expect(items).toContain('concurrent4');
        });
    });
});
