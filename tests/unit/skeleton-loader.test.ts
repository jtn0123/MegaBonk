/**
 * Tests for skeleton-loader.ts module
 * Tests skeleton loading states for perceived performance
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
}));

import {
    showSkeletonLoading,
    hideSkeletonLoading,
    isShowingSkeleton,
    showTabSkeleton,
    hideTabSkeleton,
} from '../../src/modules/skeleton-loader.ts';

describe('skeleton-loader - showSkeletonLoading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
            <div id="weaponsContainer"></div>
            <div id="tomesContainer"></div>
            <div id="charactersContainer"></div>
            <div id="shrinesContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create skeleton container in target element', () => {
        showSkeletonLoading('itemsContainer');

        const container = document.getElementById('itemsContainer');
        const skeleton = container?.querySelector('.skeleton-container');
        expect(skeleton).not.toBeNull();
    });

    it('should create default 6 skeleton cards', () => {
        showSkeletonLoading('itemsContainer');

        const cards = document.querySelectorAll('.skeleton-card');
        expect(cards.length).toBe(6);
    });

    it('should create specified number of skeleton cards', () => {
        showSkeletonLoading('itemsContainer', 10);

        const cards = document.querySelectorAll('.skeleton-card');
        expect(cards.length).toBe(10);
    });

    it('should include graph placeholder when requested', () => {
        showSkeletonLoading('itemsContainer', 3, true);

        const container = document.getElementById('itemsContainer');
        // Graph placeholder uses skeleton-graph class
        const graphPlaceholders = container?.querySelectorAll('.skeleton-graph');
        expect(graphPlaceholders?.length).toBe(3);
    });

    it('should not include graph placeholder by default', () => {
        showSkeletonLoading('itemsContainer', 3, false);

        const container = document.getElementById('itemsContainer');
        const graphPlaceholders = container?.querySelectorAll('.skeleton-graph');
        expect(graphPlaceholders?.length).toBe(0);
    });

    it('should set aria-busy attribute', () => {
        showSkeletonLoading('itemsContainer');

        const container = document.getElementById('itemsContainer');
        expect(container?.getAttribute('aria-busy')).toBe('true');
    });

    it('should set aria-label attribute', () => {
        showSkeletonLoading('itemsContainer');

        const container = document.getElementById('itemsContainer');
        expect(container?.getAttribute('aria-label')).toBe('Loading content');
    });

    it('should store had content flag', () => {
        const container = document.getElementById('itemsContainer')!;
        container.innerHTML = '<div>Existing content</div>';

        showSkeletonLoading('itemsContainer');

        expect(container.dataset.hadContent).toBe('true');
    });

    it('should handle missing container gracefully', () => {
        expect(() => showSkeletonLoading('nonexistent')).not.toThrow();
    });

    it('should replace existing content', () => {
        const container = document.getElementById('itemsContainer')!;
        container.innerHTML = '<div class="original">Original content</div>';

        showSkeletonLoading('itemsContainer');

        expect(container.querySelector('.original')).toBeNull();
        expect(container.querySelector('.skeleton-container')).not.toBeNull();
    });
});

describe('skeleton-loader - hideSkeletonLoading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should remove skeleton container', () => {
        showSkeletonLoading('itemsContainer');
        hideSkeletonLoading('itemsContainer');

        const skeleton = document.querySelector('.skeleton-container');
        expect(skeleton).toBeNull();
    });

    it('should remove aria-busy attribute', () => {
        showSkeletonLoading('itemsContainer');
        hideSkeletonLoading('itemsContainer');

        const container = document.getElementById('itemsContainer');
        expect(container?.hasAttribute('aria-busy')).toBe(false);
    });

    it('should remove aria-label attribute', () => {
        showSkeletonLoading('itemsContainer');
        hideSkeletonLoading('itemsContainer');

        const container = document.getElementById('itemsContainer');
        expect(container?.hasAttribute('aria-label')).toBe(false);
    });

    it('should handle missing container gracefully', () => {
        expect(() => hideSkeletonLoading('nonexistent')).not.toThrow();
    });

    it('should handle container without skeleton', () => {
        expect(() => hideSkeletonLoading('itemsContainer')).not.toThrow();
    });
});

describe('skeleton-loader - isShowingSkeleton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return true when skeleton is showing', () => {
        showSkeletonLoading('itemsContainer');

        expect(isShowingSkeleton('itemsContainer')).toBe(true);
    });

    it('should return false when skeleton is not showing', () => {
        expect(isShowingSkeleton('itemsContainer')).toBe(false);
    });

    it('should return false after hiding skeleton', () => {
        showSkeletonLoading('itemsContainer');
        hideSkeletonLoading('itemsContainer');

        expect(isShowingSkeleton('itemsContainer')).toBe(false);
    });

    it('should return false for missing container', () => {
        expect(isShowingSkeleton('nonexistent')).toBe(false);
    });
});

describe('skeleton-loader - showTabSkeleton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
            <div id="weaponsContainer"></div>
            <div id="tomesContainer"></div>
            <div id="charactersContainer"></div>
            <div id="shrinesContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show skeleton for items tab with 8 cards and graphs', () => {
        showTabSkeleton('items');

        const container = document.getElementById('itemsContainer');
        const cards = container?.querySelectorAll('.skeleton-card');
        expect(cards?.length).toBe(8);

        // Items tab should have graphs (using skeleton-graph class)
        const graphPlaceholders = container?.querySelectorAll('.skeleton-graph');
        expect(graphPlaceholders?.length).toBe(8);
    });

    it('should show skeleton for weapons tab with 6 cards without graphs', () => {
        showTabSkeleton('weapons');

        const container = document.getElementById('weaponsContainer');
        const cards = container?.querySelectorAll('.skeleton-card');
        expect(cards?.length).toBe(6);

        // Weapons tab should not have graphs
        const graphPlaceholders = container?.querySelectorAll('.skeleton-graph');
        expect(graphPlaceholders?.length).toBe(0);
    });

    it('should show skeleton for tomes tab with 6 cards and graphs', () => {
        showTabSkeleton('tomes');

        const container = document.getElementById('tomesContainer');
        const cards = container?.querySelectorAll('.skeleton-card');
        expect(cards?.length).toBe(6);

        // Tomes tab should have graphs (using skeleton-graph class)
        const graphPlaceholders = container?.querySelectorAll('.skeleton-graph');
        expect(graphPlaceholders?.length).toBe(6);
    });

    it('should show skeleton for characters tab with 6 cards without graphs', () => {
        showTabSkeleton('characters');

        const container = document.getElementById('charactersContainer');
        const cards = container?.querySelectorAll('.skeleton-card');
        expect(cards?.length).toBe(6);
    });

    it('should show skeleton for shrines tab with 4 cards without graphs', () => {
        showTabSkeleton('shrines');

        const container = document.getElementById('shrinesContainer');
        const cards = container?.querySelectorAll('.skeleton-card');
        expect(cards?.length).toBe(4);
    });

    it('should handle unknown tab name', () => {
        expect(() => showTabSkeleton('unknown')).not.toThrow();
    });
});

describe('skeleton-loader - hideTabSkeleton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
            <div id="weaponsContainer"></div>
            <div id="tomesContainer"></div>
            <div id="charactersContainer"></div>
            <div id="shrinesContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should hide skeleton for items tab', () => {
        showTabSkeleton('items');
        hideTabSkeleton('items');

        expect(isShowingSkeleton('itemsContainer')).toBe(false);
    });

    it('should hide skeleton for weapons tab', () => {
        showTabSkeleton('weapons');
        hideTabSkeleton('weapons');

        expect(isShowingSkeleton('weaponsContainer')).toBe(false);
    });

    it('should hide skeleton for tomes tab', () => {
        showTabSkeleton('tomes');
        hideTabSkeleton('tomes');

        expect(isShowingSkeleton('tomesContainer')).toBe(false);
    });

    it('should hide skeleton for characters tab', () => {
        showTabSkeleton('characters');
        hideTabSkeleton('characters');

        expect(isShowingSkeleton('charactersContainer')).toBe(false);
    });

    it('should hide skeleton for shrines tab', () => {
        showTabSkeleton('shrines');
        hideTabSkeleton('shrines');

        expect(isShowingSkeleton('shrinesContainer')).toBe(false);
    });

    it('should handle unknown tab name', () => {
        expect(() => hideTabSkeleton('unknown')).not.toThrow();
    });
});

describe('skeleton-loader - skeleton card structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should have skeleton header', () => {
        showSkeletonLoading('itemsContainer', 1);

        const header = document.querySelector('.skeleton-header');
        expect(header).not.toBeNull();
    });

    it('should have skeleton image placeholder', () => {
        showSkeletonLoading('itemsContainer', 1);

        const image = document.querySelector('.skeleton-image');
        expect(image).not.toBeNull();
    });

    it('should have skeleton title section', () => {
        showSkeletonLoading('itemsContainer', 1);

        const title = document.querySelector('.skeleton-title');
        expect(title).not.toBeNull();
    });

    it('should have skeleton name placeholder', () => {
        showSkeletonLoading('itemsContainer', 1);

        const name = document.querySelector('.skeleton-name');
        expect(name).not.toBeNull();
    });

    it('should have skeleton tier placeholder', () => {
        showSkeletonLoading('itemsContainer', 1);

        // Tier is now rendered as skeleton-badge
        const tier = document.querySelector('.skeleton-badge');
        expect(tier).not.toBeNull();
    });

    it('should have skeleton text placeholders', () => {
        showSkeletonLoading('itemsContainer', 1);

        const texts = document.querySelectorAll('.skeleton-text');
        expect(texts.length).toBeGreaterThan(0);
    });

    it('should have skeleton meta section with tags', () => {
        showSkeletonLoading('itemsContainer', 1);

        const meta = document.querySelector('.skeleton-meta');
        const tags = document.querySelectorAll('.skeleton-tag');
        expect(meta).not.toBeNull();
        expect(tags.length).toBe(3);
    });

    it('should have skeleton button placeholder', () => {
        showSkeletonLoading('itemsContainer', 1);

        const button = document.querySelector('.skeleton-button');
        expect(button).not.toBeNull();
    });

    it('should have short text variant', () => {
        showSkeletonLoading('itemsContainer', 1);

        const shortText = document.querySelector('.skeleton-text.short');
        expect(shortText).not.toBeNull();
    });
});

// Note: Global exports are tested implicitly through module imports
// The actual window attachment happens at module load time in browser environment
