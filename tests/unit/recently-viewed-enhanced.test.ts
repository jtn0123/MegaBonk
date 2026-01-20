/**
 * Enhanced tests for recently-viewed.ts module
 * Tests for getEntityForEntry and renderRecentlyViewedSection
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                { id: 'wrench', name: 'Wrench', tier: 'A' },
                { id: 'medkit', name: 'Medkit', tier: 'B' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'hammer', name: 'Hammer', tier: 'S' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'fire_tome', name: 'Fire Tome', tier: 'A' },
            ],
        },
        characters: {
            characters: [
                { id: 'clank', name: 'CL4NK', tier: 'S' },
            ],
        },
        shrines: {
            shrines: [
                { id: 'power_shrine', name: 'Power Shrine' },
            ],
        },
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    escapeHtml: (str: string) => str,
    generateEntityImage: vi.fn().mockReturnValue('<img src="test.png" />'),
}));

vi.mock('../../src/modules/modal.ts', () => ({
    openDetailModal: vi.fn(),
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
import { logger } from '../../src/modules/logger.ts';
import { openDetailModal } from '../../src/modules/modal.ts';

describe('recently-viewed - getEntityForEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
    });

    it('should return item entity for items type', () => {
        const entry = { type: 'items' as const, id: 'wrench', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).not.toBeNull();
        expect(entity?.name).toBe('Wrench');
    });

    it('should return weapon entity for weapons type', () => {
        const entry = { type: 'weapons' as const, id: 'hammer', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).not.toBeNull();
        expect(entity?.name).toBe('Hammer');
    });

    it('should return tome entity for tomes type', () => {
        const entry = { type: 'tomes' as const, id: 'fire_tome', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).not.toBeNull();
        expect(entity?.name).toBe('Fire Tome');
    });

    it('should return character entity for characters type', () => {
        const entry = { type: 'characters' as const, id: 'clank', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).not.toBeNull();
        expect(entity?.name).toBe('CL4NK');
    });

    it('should return shrine entity for shrines type', () => {
        const entry = { type: 'shrines' as const, id: 'power_shrine', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).not.toBeNull();
        expect(entity?.name).toBe('Power Shrine');
    });

    it('should return null for unknown entity id', () => {
        const entry = { type: 'items' as const, id: 'nonexistent', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).toBeNull();
    });

    it('should return null for unknown type', () => {
        const entry = { type: 'unknown' as any, id: 'test', timestamp: Date.now() };
        const entity = getEntityForEntry(entry);

        expect(entity).toBeNull();
    });
});

describe('recently-viewed - renderRecentlyViewedSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
        document.body.innerHTML = '<div id="tab-content"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should not render when no recent items', () => {
        renderRecentlyViewedSection();

        const section = document.querySelector('.recently-viewed-section');
        expect(section).toBeNull();
    });

    it('should render section when recent items exist', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const section = document.querySelector('.recently-viewed-section');
        expect(section).not.toBeNull();
    });

    it('should include header with title', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const header = document.querySelector('.recently-viewed-header h3');
        expect(header?.textContent).toContain('Recently Viewed');
    });

    it('should include clear button', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const clearBtn = document.querySelector('.clear-recent-btn');
        expect(clearBtn).not.toBeNull();
    });

    it('should clear items when clear button clicked', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const clearBtn = document.querySelector('.clear-recent-btn') as HTMLButtonElement;
        clearBtn?.click();

        const section = document.querySelector('.recently-viewed-section');
        expect(section).toBeNull();
        expect(getRecentlyViewed()).toHaveLength(0);
    });

    it('should render recent items', () => {
        addToRecentlyViewed('items', 'wrench');
        addToRecentlyViewed('weapons', 'hammer');
        renderRecentlyViewedSection();

        const items = document.querySelectorAll('.recent-item');
        expect(items.length).toBe(2);
    });

    it('should include data attributes on recent items', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item') as HTMLElement;
        expect(item?.dataset.type).toBe('items');
        expect(item?.dataset.id).toBe('wrench');
    });

    it('should open modal on item click', async () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item') as HTMLElement;
        item?.click();

        // Wait for dynamic import
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(openDetailModal).toHaveBeenCalledWith('items', 'wrench');
    });

    it('should open modal on Enter key press', async () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item') as HTMLElement;
        item?.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(openDetailModal).toHaveBeenCalledWith('items', 'wrench');
    });

    it('should open modal on Space key press', async () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item') as HTMLElement;
        item?.dispatchEvent(new KeyboardEvent('keypress', { key: ' ' }));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(openDetailModal).toHaveBeenCalledWith('items', 'wrench');
    });

    it('should not open modal on other key press', async () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item') as HTMLElement;
        item?.dispatchEvent(new KeyboardEvent('keypress', { key: 'a' }));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(openDetailModal).not.toHaveBeenCalled();
    });

    it('should remove existing section before re-rendering', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();
        renderRecentlyViewedSection();

        const sections = document.querySelectorAll('.recently-viewed-section');
        expect(sections.length).toBe(1);
    });

    it('should use custom container selector', () => {
        document.body.innerHTML = '<div id="custom-container"></div>';
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection('#custom-container');

        const container = document.getElementById('custom-container');
        const section = container?.querySelector('.recently-viewed-section');
        expect(section).not.toBeNull();
    });

    it('should handle missing container gracefully', () => {
        document.body.innerHTML = '';
        addToRecentlyViewed('items', 'wrench');

        expect(() => renderRecentlyViewedSection('#nonexistent')).not.toThrow();
    });

    it('should filter out entries with no entity data', () => {
        // Add entry that won't have matching entity
        addToRecentlyViewed('items', 'nonexistent');
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const items = document.querySelectorAll('.recent-item');
        expect(items.length).toBe(1); // Only wrench should show
    });

    it('should display entity name in recent item', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const nameEl = document.querySelector('.recent-name');
        expect(nameEl?.textContent).toBe('Wrench');
    });

    it('should include role and tabindex for accessibility', () => {
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const item = document.querySelector('.recent-item');
        expect(item?.getAttribute('role')).toBe('button');
        expect(item?.getAttribute('tabindex')).toBe('0');
    });

    it('should insert section before first child', () => {
        document.body.innerHTML = '<div id="tab-content"><div id="existing">Existing</div></div>';
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const container = document.getElementById('tab-content');
        expect(container?.firstElementChild?.classList.contains('recently-viewed-section')).toBe(true);
    });

    it('should append section if container is empty', () => {
        document.body.innerHTML = '<div id="tab-content"></div>';
        addToRecentlyViewed('items', 'wrench');
        renderRecentlyViewedSection();

        const container = document.getElementById('tab-content');
        expect(container?.querySelector('.recently-viewed-section')).not.toBeNull();
    });
});

describe('recently-viewed - onModalOpened', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
    });

    it('should add item to recently viewed when modal opened', () => {
        onModalOpened('items', 'wrench');

        const recent = getRecentlyViewed();
        expect(recent).toHaveLength(1);
        expect(recent[0].id).toBe('wrench');
    });

    it('should respect type restrictions', () => {
        onModalOpened('changelog' as any, 'v1.0');

        const recent = getRecentlyViewed();
        expect(recent).toHaveLength(0);
    });
});

describe('recently-viewed - initRecentlyViewed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
    });

    it('should load existing data and log init', () => {
        const testData = [{ type: 'items', id: 'wrench', timestamp: Date.now() }];
        localStorage.setItem('megabonk-recently-viewed', JSON.stringify(testData));

        initRecentlyViewed();

        expect(logger.info).toHaveBeenCalledWith({
            operation: 'recently-viewed.init',
            data: { count: 1 },
        });
    });

    it('should log zero count when no data', () => {
        initRecentlyViewed();

        expect(logger.info).toHaveBeenCalledWith({
            operation: 'recently-viewed.init',
            data: { count: 0 },
        });
    });
});

describe('recently-viewed - localStorage error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRecentlyViewed();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should handle localStorage.setItem error gracefully', () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => {
            throw new Error('Storage full');
        });

        expect(() => addToRecentlyViewed('items', 'wrench')).not.toThrow();

        expect(logger.warn).toHaveBeenCalledWith({
            operation: 'recently-viewed.save',
            error: { name: 'StorageError', message: 'Failed to save recently viewed', module: 'recently-viewed' },
        });

        localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage.getItem error gracefully', () => {
        // First add an item to localStorage
        localStorage.setItem('megabonk-recently-viewed', JSON.stringify([{ type: 'items', id: 'test', timestamp: Date.now() }]));

        const originalGetItem = localStorage.getItem;
        localStorage.getItem = vi.fn(() => {
            throw new Error('Storage unavailable');
        });

        expect(() => loadRecentlyViewed()).not.toThrow();

        expect(logger.warn).toHaveBeenCalledWith({
            operation: 'recently-viewed.load',
            error: { name: 'StorageError', message: 'Failed to load recently viewed', module: 'recently-viewed' },
        });

        localStorage.getItem = originalGetItem;
    });
});

describe('recently-viewed - edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearRecentlyViewed();
    });

    it('should handle all five entity types', () => {
        addToRecentlyViewed('items', 'wrench');
        addToRecentlyViewed('weapons', 'hammer');
        addToRecentlyViewed('tomes', 'fire_tome');
        addToRecentlyViewed('characters', 'clank');
        addToRecentlyViewed('shrines', 'power_shrine');

        const recent = getRecentlyViewed();
        expect(recent).toHaveLength(5);
    });

    it('should maintain order across page loads', () => {
        addToRecentlyViewed('items', 'wrench');
        addToRecentlyViewed('weapons', 'hammer');

        // Simulate page reload
        loadRecentlyViewed();

        const recent = getRecentlyViewed();
        expect(recent[0].id).toBe('hammer'); // Most recent
        expect(recent[1].id).toBe('wrench');
    });

    it('should return copy of array from getRecentlyViewed', () => {
        addToRecentlyViewed('items', 'wrench');

        const recent1 = getRecentlyViewed();
        const recent2 = getRecentlyViewed();

        expect(recent1).not.toBe(recent2);
        expect(recent1).toEqual(recent2);
    });

    it('should filter by tab correctly for all types', () => {
        addToRecentlyViewed('items', 'wrench');
        addToRecentlyViewed('weapons', 'hammer');
        addToRecentlyViewed('items', 'medkit');

        expect(getRecentlyViewedForTab('items')).toHaveLength(2);
        expect(getRecentlyViewedForTab('weapons')).toHaveLength(1);
        expect(getRecentlyViewedForTab('tomes')).toHaveLength(0);
    });
});
