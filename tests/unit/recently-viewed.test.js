import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    loadRecentlyViewed,
    addToRecentlyViewed,
    getRecentlyViewed,
    getRecentlyViewedForTab,
    clearRecentlyViewed,
    initRecentlyViewed,
} from '../../src/modules/recently-viewed.ts';

describe('Recently Viewed Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
        clearRecentlyViewed();
    });

    describe('loadRecentlyViewed()', () => {
        it('should load empty state when localStorage is empty', () => {
            loadRecentlyViewed();
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should load existing data from localStorage', () => {
            const testData = [
                { type: 'items', id: 'gym_sauce', timestamp: Date.now() },
                { type: 'weapons', id: 'revolver', timestamp: Date.now() - 1000 },
            ];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            loadRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(2);
            expect(getRecentlyViewed()[0].id).toBe('gym_sauce');
        });

        it('should handle corrupted localStorage data gracefully', () => {
            localStorage.setItem('megabonk-recently-viewed', 'invalid json{');

            expect(() => loadRecentlyViewed()).not.toThrow();
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should clean up entries older than 7 days', () => {
            const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
            const recentTimestamp = Date.now() - (1 * 24 * 60 * 60 * 1000); // 1 day ago

            const testData = [
                { type: 'items', id: 'old_item', timestamp: oldTimestamp },
                { type: 'items', id: 'recent_item', timestamp: recentTimestamp },
            ];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            loadRecentlyViewed();

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);
            expect(recent[0].id).toBe('recent_item');
        });
    });

    describe('addToRecentlyViewed()', () => {
        it('should add item to recently viewed', () => {
            addToRecentlyViewed('items', 'gym_sauce');

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);
            expect(recent[0].type).toBe('items');
            expect(recent[0].id).toBe('gym_sauce');
        });

        it('should add item at the beginning (most recent first)', () => {
            addToRecentlyViewed('items', 'first_item');
            addToRecentlyViewed('items', 'second_item');

            const recent = getRecentlyViewed();
            expect(recent[0].id).toBe('second_item');
            expect(recent[1].id).toBe('first_item');
        });

        it('should move existing item to front when viewed again', () => {
            addToRecentlyViewed('items', 'item_a');
            addToRecentlyViewed('items', 'item_b');
            addToRecentlyViewed('items', 'item_a'); // View again

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(2);
            expect(recent[0].id).toBe('item_a');
            expect(recent[1].id).toBe('item_b');
        });

        it('should limit to 10 items', () => {
            for (let i = 0; i < 15; i++) {
                addToRecentlyViewed('items', `item_${i}`);
            }

            expect(getRecentlyViewed()).toHaveLength(10);
        });

        it('should ignore non-entity tabs', () => {
            addToRecentlyViewed('changelog', 'some_id');
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should persist to localStorage', () => {
            addToRecentlyViewed('items', 'gym_sauce');

            const stored = JSON.parse(localStorage.getItem('megabonk-recently-viewed'));
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('gym_sauce');
        });
    });

    describe('getRecentlyViewedForTab()', () => {
        it('should return only items for specified tab', () => {
            addToRecentlyViewed('items', 'item_1');
            addToRecentlyViewed('weapons', 'weapon_1');
            addToRecentlyViewed('items', 'item_2');

            const itemsOnly = getRecentlyViewedForTab('items');
            expect(itemsOnly).toHaveLength(2);
            expect(itemsOnly.every(r => r.type === 'items')).toBe(true);
        });

        it('should return empty array for tab with no history', () => {
            addToRecentlyViewed('items', 'item_1');

            const weapons = getRecentlyViewedForTab('weapons');
            expect(weapons).toHaveLength(0);
        });
    });

    describe('clearRecentlyViewed()', () => {
        it('should clear all recently viewed items', () => {
            addToRecentlyViewed('items', 'item_1');
            addToRecentlyViewed('weapons', 'weapon_1');

            clearRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should clear localStorage', () => {
            addToRecentlyViewed('items', 'item_1');

            clearRecentlyViewed();

            const stored = JSON.parse(localStorage.getItem('megabonk-recently-viewed'));
            expect(stored).toHaveLength(0);
        });
    });

    describe('initRecentlyViewed()', () => {
        it('should initialize without errors', () => {
            expect(() => initRecentlyViewed()).not.toThrow();
        });

        it('should load existing data on init', () => {
            const testData = [{ type: 'items', id: 'test', timestamp: Date.now() }];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            initRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(1);
        });
    });
});
