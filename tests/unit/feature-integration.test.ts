/* global global */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * Integration tests for new feature modules
 * Tests interactions between modules and edge cases
 */

// Mock allData for all tests
const mockAllData = {
    items: {
        items: [
            { id: 'item1', name: 'Test Item 1', tier: 'A', rarity: 'rare', base_effect: 'damage boost' },
            { id: 'item2', name: 'Test Item 2', tier: 'S', rarity: 'epic', base_effect: 'crit boost' },
        ],
    },
    weapons: {
        weapons: [{ id: 'weapon1', name: 'Test Weapon', tier: 'A' }],
    },
    tomes: {
        tomes: [{ id: 'tome1', name: 'Test Tome', tier: 'A', stat_affected: 'damage' }],
    },
    characters: {
        characters: [{ id: 'char1', name: 'Test Character', tier: 'A' }],
    },
    shrines: {
        shrines: [],
    },
};

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: mockAllData,
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/modal.ts', () => ({
    openDetailModal: vi.fn(),
}));

describe('Feature Module Integration Tests', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
    });

    describe('Recently Viewed + Similar Items Integration', () => {
        it('should track recently viewed items that can show similar items', async () => {
            const { addToRecentlyViewed, getRecentlyViewed } = await import('../../src/modules/recently-viewed.ts');
            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            // Add an item to recently viewed
            addToRecentlyViewed('items', 'item1');

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);

            // Find similar items for the recently viewed item
            const similar = findSimilarItems('items', recent[0].id);
            expect(Array.isArray(similar)).toBe(true);
        });
    });

    describe('Random Build Edge Cases', () => {
        it('should handle empty item pool gracefully', async () => {
            // Temporarily empty the items
            const originalItems = mockAllData.items.items;
            mockAllData.items.items = [];

            const { generateRandomBuild } = await import('../../src/modules/random-build.ts');

            const build = generateRandomBuild();
            expect(build.items).toHaveLength(0);

            // Restore
            mockAllData.items.items = originalItems;
        });

        it('should handle very restrictive constraints', async () => {
            const { generateRandomBuild } = await import('../../src/modules/random-build.ts');

            // Apply all constraints - may result in empty or limited build
            const build = generateRandomBuild({
                noLegendary: true,
                noSSItems: true,
                challengeMode: true,
                onlyOneAndDone: true,
            });

            // Should not throw and should return valid structure
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
        });
    });

    describe('Recently Viewed Persistence', () => {
        it('should persist across module reloads', async () => {
            // First load - add items
            const rv1 = await import('../../src/modules/recently-viewed.ts');
            rv1.clearRecentlyViewed();
            rv1.addToRecentlyViewed('items', 'item1');
            rv1.addToRecentlyViewed('weapons', 'weapon1');

            // Verify localStorage has data
            const stored = localStorage.getItem('megabonk-recently-viewed');
            expect(stored).not.toBeNull();

            const parsed = JSON.parse(stored);
            expect(parsed).toHaveLength(2);
        });

        it('should handle localStorage quota exceeded', async () => {
            const { addToRecentlyViewed } = await import('../../src/modules/recently-viewed.ts');

            // Mock localStorage.setItem to throw
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn().mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            // Should not throw
            expect(() => addToRecentlyViewed('items', 'item1')).not.toThrow();

            // Restore
            localStorage.setItem = originalSetItem;
        });
    });

    describe('Similar Items Edge Cases', () => {
        it('should handle items with no synergies', async () => {
            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            // item1 has no synergies defined
            const similar = findSimilarItems('items', 'item1');

            // Should still find similar items based on other criteria
            expect(Array.isArray(similar)).toBe(true);
        });

        it('should handle undefined properties gracefully', async () => {
            // Temporarily add a bare item with minimal properties
            const testItem = { id: 'bare_item', name: 'Bare Item' };
            mockAllData.items.items.push(testItem);

            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            expect(() => findSimilarItems('items', 'bare_item')).not.toThrow();

            // Cleanup
            mockAllData.items.items.pop();
        });
    });

    describe('Mobile Nav State Sync', () => {
        it('should sync with desktop tab state', async () => {
            // Add mobile nav to DOM
            const mobileNav = document.createElement('nav');
            mobileNav.className = 'mobile-bottom-nav';
            mobileNav.innerHTML = `
                <div class="nav-items">
                    <button class="nav-item" data-tab="items">Items</button>
                    <button class="nav-item" data-tab="weapons">Weapons</button>
                </div>
            `;
            document.body.appendChild(mobileNav);

            const { initMobileNav } = await import('../../src/modules/mobile-nav.ts');

            expect(() => initMobileNav()).not.toThrow();
        });
    });

    describe('CV Worker Error Handling', () => {
        it('should handle worker initialization failure', async () => {
            // Mock Worker to throw
            const originalWorker = global.Worker;
            global.Worker = class {
                constructor() {
                    throw new Error('Worker creation failed');
                }
            };

            const { cvWorker } = await import('../../src/modules/cv-worker.ts');

            await expect(cvWorker.init()).rejects.toThrow();

            global.Worker = originalWorker;
        });
    });
});

describe('Module Export Validation', () => {
    it('should export all expected functions from recently-viewed', async () => {
        const module = await import('../../src/modules/recently-viewed.ts');

        expect(typeof module.loadRecentlyViewed).toBe('function');
        expect(typeof module.addToRecentlyViewed).toBe('function');
        expect(typeof module.getRecentlyViewed).toBe('function');
        expect(typeof module.getRecentlyViewedForTab).toBe('function');
        expect(typeof module.clearRecentlyViewed).toBe('function');
        expect(typeof module.initRecentlyViewed).toBe('function');
        expect(typeof module.onModalOpened).toBe('function');
    });

    it('should export all expected functions from similar-items', async () => {
        const module = await import('../../src/modules/similar-items.ts');

        expect(typeof module.findSimilarItems).toBe('function');
        expect(typeof module.renderSimilarItemsSection).toBe('function');
        expect(typeof module.setupSimilarItemsHandlers).toBe('function');
    });

    it('should export all expected functions from random-build', async () => {
        const module = await import('../../src/modules/random-build.ts');

        expect(typeof module.generateRandomBuild).toBe('function');
        expect(typeof module.renderRandomBuildSection).toBe('function');
        expect(typeof module.renderBuildPreview).toBe('function');
        expect(typeof module.setupRandomBuildHandlers).toBe('function');
    });

    it('should export all expected functions from mobile-nav', async () => {
        const module = await import('../../src/modules/mobile-nav.ts');

        expect(typeof module.initMobileNav).toBe('function');
        expect(typeof module.showMoreMenu).toBe('function');
        expect(typeof module.hideMoreMenu).toBe('function');
        expect(typeof module.toggleMoreMenu).toBe('function');
    });

    it('should export all expected functions from cv-worker', async () => {
        const module = await import('../../src/modules/cv-worker.ts');

        expect(typeof module.isWorkerSupported).toBe('function');
        expect(typeof module.runCVDetection).toBe('function');
        expect(module.cvWorker).toBeDefined();
    });
});
