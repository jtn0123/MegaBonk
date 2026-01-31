/**
 * @vitest-environment jsdom
 * Recently Viewed Module - Comprehensive Coverage Tests
 * Target: >60% coverage for recently-viewed.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Hoist mock data to avoid initialization issues
const mockAllData = vi.hoisted(() => ({
    items: {
        items: [
            { id: 'item1', name: 'Test Item 1', image: 'item1.png' },
            { id: 'item2', name: 'Test Item 2', image: 'item2.png' },
        ],
    },
    weapons: {
        weapons: [
            { id: 'weapon1', name: 'Test Weapon', image: 'weapon1.png' },
        ],
    },
    tomes: {
        tomes: [
            { id: 'tome1', name: 'Test Tome', image: 'tome1.png' },
        ],
    },
    characters: {
        characters: [
            { id: 'char1', name: 'Test Character', image: 'char1.png' },
        ],
    },
    shrines: {
        shrines: [
            { id: 'shrine1', name: 'Test Shrine' },
        ],
    },
}));

// Mock dependencies before importing
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/modal.ts', () => ({
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: mockAllData,
}));

vi.mock('../../src/modules/utils.ts', () => ({
    escapeHtml: vi.fn((str: string) => str),
    generateEntityImage: vi.fn((entity: any, name: string) => `<img src="${entity.image}" alt="${name}" />`),
}));

vi.mock('../../src/modules/constants.ts', () => ({
    MAX_RECENT_ITEMS: 10,
}));

import {
    loadRecentlyViewed,
    addToRecentlyViewed,
    getRecentlyViewed,
    getRecentlyViewedForTab,
    clearRecentlyViewed,
    getEntityForEntry,
    renderRecentlyViewedSection,
    onModalOpened,
    initRecentlyViewed,
} from '../../src/modules/recently-viewed.ts';

describe('Recently Viewed Module - Comprehensive Coverage', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        // Clean up recently viewed section
        const section = document.querySelector('.recently-viewed-section');
        if (section) section.remove();
    });

    // ========================================
    // loadRecentlyViewed Tests
    // ========================================
    describe('loadRecentlyViewed', () => {
        it('should load empty state when localStorage is empty', () => {
            loadRecentlyViewed();
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should load existing data from localStorage', () => {
            const testData = [
                { type: 'items', id: 'item1', timestamp: Date.now() },
                { type: 'weapons', id: 'weapon1', timestamp: Date.now() - 1000 },
            ];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            loadRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(2);
            expect(getRecentlyViewed()[0].id).toBe('item1');
        });

        it('should handle corrupted localStorage data', () => {
            localStorage.setItem('megabonk-recently-viewed', 'not valid json {{{');

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

        it('should save cleaned data back to localStorage', () => {
            const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
            const recentTimestamp = Date.now() - (1000);

            const testData = [
                { type: 'items', id: 'old_item', timestamp: oldTimestamp },
                { type: 'items', id: 'recent_item', timestamp: recentTimestamp },
            ];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            loadRecentlyViewed();

            const saved = JSON.parse(localStorage.getItem('megabonk-recently-viewed') || '[]');
            expect(saved).toHaveLength(1);
            expect(saved[0].id).toBe('recent_item');
        });
    });

    // ========================================
    // addToRecentlyViewed Tests
    // ========================================
    describe('addToRecentlyViewed', () => {
        it('should add item to recently viewed', () => {
            addToRecentlyViewed('items', 'item1');

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);
            expect(recent[0].type).toBe('items');
            expect(recent[0].id).toBe('item1');
            expect(recent[0].timestamp).toBeGreaterThan(0);
        });

        it('should add most recent item at the beginning', () => {
            addToRecentlyViewed('items', 'item1');
            addToRecentlyViewed('items', 'item2');

            const recent = getRecentlyViewed();
            expect(recent[0].id).toBe('item2');
            expect(recent[1].id).toBe('item1');
        });

        it('should move existing item to front when viewed again', () => {
            addToRecentlyViewed('items', 'item1');
            addToRecentlyViewed('items', 'item2');
            addToRecentlyViewed('items', 'item1'); // View item1 again

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(2);
            expect(recent[0].id).toBe('item1');
            expect(recent[1].id).toBe('item2');
        });

        it('should limit to MAX_RECENT_ITEMS (10)', () => {
            for (let i = 0; i < 15; i++) {
                addToRecentlyViewed('items', `item_${i}`);
            }

            expect(getRecentlyViewed()).toHaveLength(10);
        });

        it('should ignore non-entity tabs (changelog)', () => {
            addToRecentlyViewed('changelog' as any, 'some_id');
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should ignore non-entity tabs (build-planner)', () => {
            addToRecentlyViewed('build-planner' as any, 'some_id');
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should ignore non-entity tabs (calculator)', () => {
            addToRecentlyViewed('calculator' as any, 'some_id');
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should persist to localStorage', () => {
            addToRecentlyViewed('items', 'item1');

            const stored = JSON.parse(localStorage.getItem('megabonk-recently-viewed') || '[]');
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('item1');
        });

        it('should handle all valid entity types', () => {
            addToRecentlyViewed('items', 'item1');
            addToRecentlyViewed('weapons', 'weapon1');
            addToRecentlyViewed('tomes', 'tome1');
            addToRecentlyViewed('characters', 'char1');
            addToRecentlyViewed('shrines', 'shrine1');

            expect(getRecentlyViewed()).toHaveLength(5);
        });
    });

    // ========================================
    // getRecentlyViewed Tests
    // ========================================
    describe('getRecentlyViewed', () => {
        it('should return empty array when no items viewed', () => {
            expect(getRecentlyViewed()).toEqual([]);
        });

        it('should return a copy (not the original array)', () => {
            addToRecentlyViewed('items', 'item1');

            const recent1 = getRecentlyViewed();
            recent1.push({ type: 'items', id: 'fake', timestamp: 0 });

            const recent2 = getRecentlyViewed();
            expect(recent2).toHaveLength(1);
        });
    });

    // ========================================
    // getRecentlyViewedForTab Tests
    // ========================================
    describe('getRecentlyViewedForTab', () => {
        it('should return only items for specified tab', () => {
            addToRecentlyViewed('items', 'item1');
            addToRecentlyViewed('weapons', 'weapon1');
            addToRecentlyViewed('items', 'item2');
            addToRecentlyViewed('tomes', 'tome1');

            const itemsOnly = getRecentlyViewedForTab('items');
            expect(itemsOnly).toHaveLength(2);
            expect(itemsOnly.every(r => r.type === 'items')).toBe(true);
        });

        it('should return empty array for tab with no history', () => {
            addToRecentlyViewed('items', 'item1');

            const weapons = getRecentlyViewedForTab('weapons');
            expect(weapons).toHaveLength(0);
        });

        it('should work for all entity types', () => {
            addToRecentlyViewed('characters', 'char1');
            addToRecentlyViewed('shrines', 'shrine1');

            expect(getRecentlyViewedForTab('characters')).toHaveLength(1);
            expect(getRecentlyViewedForTab('shrines')).toHaveLength(1);
        });
    });

    // ========================================
    // clearRecentlyViewed Tests
    // ========================================
    describe('clearRecentlyViewed', () => {
        it('should clear all recently viewed items', () => {
            addToRecentlyViewed('items', 'item1');
            addToRecentlyViewed('weapons', 'weapon1');

            clearRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should clear localStorage', () => {
            addToRecentlyViewed('items', 'item1');

            clearRecentlyViewed();

            const stored = JSON.parse(localStorage.getItem('megabonk-recently-viewed') || '[]');
            expect(stored).toHaveLength(0);
        });
    });

    // ========================================
    // getEntityForEntry Tests
    // ========================================
    describe('getEntityForEntry', () => {
        it('should return item entity for items type', () => {
            const entry = { type: 'items' as const, id: 'item1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).not.toBeNull();
            expect(entity?.name).toBe('Test Item 1');
        });

        it('should return weapon entity for weapons type', () => {
            const entry = { type: 'weapons' as const, id: 'weapon1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).not.toBeNull();
            expect(entity?.name).toBe('Test Weapon');
        });

        it('should return tome entity for tomes type', () => {
            const entry = { type: 'tomes' as const, id: 'tome1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).not.toBeNull();
            expect(entity?.name).toBe('Test Tome');
        });

        it('should return character entity for characters type', () => {
            const entry = { type: 'characters' as const, id: 'char1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).not.toBeNull();
            expect(entity?.name).toBe('Test Character');
        });

        it('should return shrine entity for shrines type', () => {
            const entry = { type: 'shrines' as const, id: 'shrine1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).not.toBeNull();
            expect(entity?.name).toBe('Test Shrine');
        });

        it('should return null for non-existent entity', () => {
            const entry = { type: 'items' as const, id: 'nonexistent', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).toBeNull();
        });

        it('should return null for unknown type', () => {
            const entry = { type: 'unknown' as any, id: 'item1', timestamp: Date.now() };

            const entity = getEntityForEntry(entry);

            expect(entity).toBeNull();
        });
    });

    // ========================================
    // renderRecentlyViewedSection Tests
    // ========================================
    describe('renderRecentlyViewedSection', () => {
        beforeEach(() => {
            // Create a container for the recently viewed section
            const container = document.createElement('div');
            container.id = 'tab-content';
            container.innerHTML = '<div class="existing-content">Existing</div>';
            document.body.appendChild(container);
        });

        afterEach(() => {
            document.getElementById('tab-content')?.remove();
        });

        it('should not render section when no recent items', () => {
            renderRecentlyViewedSection('#tab-content');

            const section = document.querySelector('.recently-viewed-section');
            expect(section).toBeNull();
        });

        it('should render section with recent items', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const section = document.querySelector('.recently-viewed-section');
            expect(section).not.toBeNull();
        });

        it('should include header with title', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const header = document.querySelector('.recently-viewed-header');
            expect(header).not.toBeNull();
            expect(header?.textContent).toContain('Recently Viewed');
        });

        it('should include clear button', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const clearBtn = document.querySelector('.clear-recent-btn');
            expect(clearBtn).not.toBeNull();
        });

        it('should display recent item with name', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const recentName = document.querySelector('.recent-name');
            expect(recentName).not.toBeNull();
            expect(recentName?.textContent).toBe('Test Item 1');
        });

        it('should remove section when clear button is clicked', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const clearBtn = document.querySelector('.clear-recent-btn') as HTMLButtonElement;
            clearBtn?.click();

            const section = document.querySelector('.recently-viewed-section');
            expect(section).toBeNull();
            expect(getRecentlyViewed()).toHaveLength(0);
        });

        it('should remove existing section before rendering new one', () => {
            addToRecentlyViewed('items', 'item1');
            renderRecentlyViewedSection('#tab-content');

            addToRecentlyViewed('weapons', 'weapon1');
            renderRecentlyViewedSection('#tab-content');

            const sections = document.querySelectorAll('.recently-viewed-section');
            expect(sections.length).toBe(1);
        });

        it('should insert section at beginning of container', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const container = document.getElementById('tab-content');
            expect(container?.firstElementChild?.classList.contains('recently-viewed-section')).toBe(true);
        });

        it('should not render section if all entities are not found', () => {
            // Add an entry for an entity that doesn't exist in mock data
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify([
                { type: 'items', id: 'nonexistent', timestamp: Date.now() },
            ]));
            loadRecentlyViewed();

            renderRecentlyViewedSection('#tab-content');

            const section = document.querySelector('.recently-viewed-section');
            expect(section).toBeNull();
        });

        it('should handle click on recent item', async () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const recentItem = document.querySelector('.recent-item') as HTMLElement;
            expect(recentItem).not.toBeNull();
            
            recentItem?.click();

            // Wait for dynamic import
            await new Promise(resolve => setTimeout(resolve, 50));

            const { openDetailModal } = await import('../../src/modules/modal.ts');
            expect(openDetailModal).toHaveBeenCalledWith('items', 'item1');
        });

        it('should handle keypress Enter on recent item', async () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const recentItem = document.querySelector('.recent-item') as HTMLElement;
            
            const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
            recentItem?.dispatchEvent(enterEvent);

            await new Promise(resolve => setTimeout(resolve, 50));

            const { openDetailModal } = await import('../../src/modules/modal.ts');
            expect(openDetailModal).toHaveBeenCalledWith('items', 'item1');
        });

        it('should handle keypress Space on recent item', async () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const recentItem = document.querySelector('.recent-item') as HTMLElement;
            
            const spaceEvent = new KeyboardEvent('keypress', { key: ' ', bubbles: true });
            recentItem?.dispatchEvent(spaceEvent);

            await new Promise(resolve => setTimeout(resolve, 50));

            const { openDetailModal } = await import('../../src/modules/modal.ts');
            expect(openDetailModal).toHaveBeenCalledWith('items', 'item1');
        });

        it('should include accessibility attributes on recent items', () => {
            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#tab-content');

            const recentItem = document.querySelector('.recent-item') as HTMLElement;
            expect(recentItem?.getAttribute('role')).toBe('button');
            expect(recentItem?.getAttribute('tabindex')).toBe('0');
        });

        it('should handle empty container', () => {
            const emptyContainer = document.createElement('div');
            emptyContainer.id = 'empty-container';
            document.body.appendChild(emptyContainer);

            addToRecentlyViewed('items', 'item1');

            renderRecentlyViewedSection('#empty-container');

            const section = emptyContainer.querySelector('.recently-viewed-section');
            expect(section).not.toBeNull();

            emptyContainer.remove();
        });

        it('should use default fallback icon when entity has no image', async () => {
            // Mock generateEntityImage to return empty string
            const utils = await import('../../src/modules/utils.ts');
            (utils.generateEntityImage as any).mockReturnValueOnce('');

            addToRecentlyViewed('shrines', 'shrine1');

            renderRecentlyViewedSection('#tab-content');

            const icon = document.querySelector('.recent-icon');
            expect(icon).not.toBeNull();
            expect(icon?.textContent).toBe('📦');
        });
    });

    // ========================================
    // onModalOpened Tests
    // ========================================
    describe('onModalOpened', () => {
        it('should add item to recently viewed when modal is opened', () => {
            onModalOpened('items', 'item1');

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);
            expect(recent[0].type).toBe('items');
            expect(recent[0].id).toBe('item1');
        });

        it('should work for all entity types', () => {
            onModalOpened('items', 'item1');
            onModalOpened('weapons', 'weapon1');
            onModalOpened('tomes', 'tome1');
            onModalOpened('characters', 'char1');
            onModalOpened('shrines', 'shrine1');

            expect(getRecentlyViewed()).toHaveLength(5);
        });

        it('should move existing item to front when reopened', () => {
            onModalOpened('items', 'item1');
            onModalOpened('items', 'item2');
            onModalOpened('items', 'item1');

            const recent = getRecentlyViewed();
            expect(recent[0].id).toBe('item1');
        });
    });

    // ========================================
    // initRecentlyViewed Tests
    // ========================================
    describe('initRecentlyViewed', () => {
        it('should initialize without errors', () => {
            expect(() => initRecentlyViewed()).not.toThrow();
        });

        it('should load existing data on init', () => {
            const testData = [{ type: 'items', id: 'item1', timestamp: Date.now() }];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

            initRecentlyViewed();

            expect(getRecentlyViewed()).toHaveLength(1);
        });

        it('should log initialization info', async () => {
            initRecentlyViewed();

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.info).toHaveBeenCalledWith({
                operation: 'recently-viewed.init',
                data: expect.objectContaining({ count: expect.any(Number) }),
            });
        });

        it('should handle localStorage errors gracefully', () => {
            // Simulate localStorage throwing an error
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = vi.fn(() => {
                throw new Error('localStorage error');
            });

            expect(() => initRecentlyViewed()).not.toThrow();
            expect(getRecentlyViewed()).toHaveLength(0);

            localStorage.getItem = originalGetItem;
        });
    });

    // ========================================
    // localStorage Error Handling
    // ========================================
    describe('localStorage Error Handling', () => {
        it('should handle localStorage.setItem errors', () => {
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage full');
            });

            // Should not throw
            expect(() => addToRecentlyViewed('items', 'item1')).not.toThrow();

            localStorage.setItem = originalSetItem;
        });

        it('should log warning on save error', async () => {
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage full');
            });

            addToRecentlyViewed('items', 'item1');

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.warn).toHaveBeenCalledWith({
                operation: 'recently-viewed.save',
                error: expect.objectContaining({
                    name: 'StorageError',
                }),
            });

            localStorage.setItem = originalSetItem;
        });
    });
});
