/**
 * Integration: Store state management → Favorites → localStorage sync
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getState, setState, subscribe, resetStore, batchUpdate } from '../../src/modules/store.ts';
import {
    loadFavorites,
    toggleFavorite,
    isFavorite,
    getFavorites,
    clearAllFavorites,
} from '../../src/modules/favorites.ts';

describe('Integration: Store ↔ Favorites ↔ localStorage', () => {
    beforeEach(() => {
        resetStore();
        localStorage.clear();
    });

    it('should initialize favorites from localStorage', () => {
        localStorage.setItem(
            'megabonk_favorites',
            JSON.stringify({
                items: ['sword', 'shield'],
                weapons: [],
                tomes: [],
                characters: [],
                shrines: [],
            })
        );
        const loaded = loadFavorites();
        expect(loaded).toBe(true);
        expect(isFavorite('items', 'sword')).toBe(true);
    });

    it('should toggle favorite and reflect in store', () => {
        loadFavorites();
        toggleFavorite('items', 'sword');
        expect(isFavorite('items', 'sword')).toBe(true);

        toggleFavorite('items', 'sword');
        expect(isFavorite('items', 'sword')).toBe(false);
    });

    it('should persist favorites to localStorage', () => {
        loadFavorites();
        toggleFavorite('items', 'potion');

        const stored = JSON.parse(localStorage.getItem('megabonk_favorites') || '{}');
        expect(stored.items).toContain('potion');
    });

    it('should clear all favorites from store and localStorage', () => {
        loadFavorites();
        toggleFavorite('items', 'sword');
        toggleFavorite('weapons', 'axe');

        clearAllFavorites();
        expect(getFavorites('items')).toHaveLength(0);
        expect(getFavorites('weapons')).toHaveLength(0);
    });

    it('should notify store subscribers on state change', async () => {
        const callback = vi.fn();
        const unsub = subscribe('currentTab', callback);

        setState('currentTab', 'weapons');
        // setState uses queueMicrotask for async notification
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(callback).toHaveBeenCalledWith('weapons');
        unsub();
    });

    it('should handle corrupted localStorage gracefully', () => {
        localStorage.setItem('megabonk_favorites', 'not-json');
        const loaded = loadFavorites();
        // Should not crash, may return false or handle gracefully
        expect(typeof loaded).toBe('boolean');
    });

    it('should batch update store state', () => {
        const callback = vi.fn();
        subscribe('currentTab', callback);

        batchUpdate({ currentTab: 'weapons' });
        expect(getState('currentTab')).toBe('weapons');
    });

    it('should get favorites per entity type', () => {
        loadFavorites();
        toggleFavorite('items', 'a');
        toggleFavorite('items', 'b');
        toggleFavorite('weapons', 'c');

        expect(getFavorites('items')).toHaveLength(2);
        expect(getFavorites('weapons')).toHaveLength(1);
        expect(getFavorites('tomes')).toHaveLength(0);
    });
});
