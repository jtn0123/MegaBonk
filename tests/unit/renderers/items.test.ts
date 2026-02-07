/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/items.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../../helpers/dom-setup.ts';
import { FEATURES } from '../../../src/modules/constants.ts';

// Mock logger
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock charts
vi.mock('../../../src/modules/charts.ts', () => ({
    initializeItemCharts: vi.fn(),
    initializeTomeCharts: vi.fn(),
}));

// Mock compare module
vi.mock('../../../src/modules/compare.ts', () => ({
    getCompareItems: vi.fn().mockReturnValue([]),
}));

// Mock data-service for empty state detection
vi.mock('../../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockReturnValue([
        { id: '1', name: 'Suggested Item', tier: 'S' },
        { id: '2', name: 'Another Item', tier: 'A' },
    ]),
}));

// Mock store
vi.mock('../../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('items'),
    setState: vi.fn(),
}));

// Mock favorites
vi.mock('../../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn().mockReturnValue([]),
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import { renderItems } from '../../../src/modules/renderers/items.ts';
import { getCompareItems } from '../../../src/modules/compare.ts';

describe('renderers/items.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderItems()', () => {
        const mockItem = {
            id: 'test-item-1',
            name: 'Fire Sword',
            rarity: 'legendary',
            tier: 'S',
            base_effect: 'Deals fire damage',
            detailed_description: 'A powerful sword that burns enemies',
            one_and_done: false,
            stacks_well: true,
        };

        it('should render item cards in container', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelectorAll('.item-card').length).toBe(1);
        });

        it('should include item name', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Fire Sword');
        });

        it('should apply rarity class', async () => {
            await renderItems([mockItem] as any);

            const card = document.querySelector('.item-card');
            expect(card?.classList.contains('rarity-legendary')).toBe(true);
        });

        it('should set entity data attributes', async () => {
            await renderItems([mockItem] as any);

            const card = document.querySelector('.item-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('item');
            expect(card?.dataset.entityId).toBe('test-item-1');
        });

        it('should include base effect', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Deals fire damage');
        });

        it('should include detailed description', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('A powerful sword');
        });

        it('should show "Stacks Well" tag when stacks_well is true', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Stacks Well');
            expect(container?.querySelector('.tag-stacks-well')).not.toBeNull();
        });

        it('should show "One-and-Done" tag when one_and_done is true', async () => {
            const oneAndDoneItem = { ...mockItem, one_and_done: true, stacks_well: false };
            await renderItems([oneAndDoneItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('One-and-Done');
            expect(container?.querySelector('.tag-one-and-done')).not.toBeNull();
        });

        it('should show "Limited" tag when neither one_and_done nor stacks_well', async () => {
            const limitedItem = { ...mockItem, one_and_done: false, stacks_well: false };
            await renderItems([limitedItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Limited');
            expect(container?.querySelector('.tag-limited')).not.toBeNull();
        });

        it('should generate tier label', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('tier-label');
            expect(container?.innerHTML).toContain('S Tier');
        });

        it('should render graph container for scaling items', async () => {
            const scalingItem = {
                ...mockItem,
                scaling_per_stack: [1, 2, 3, 4, 5],
                graph_type: 'linear',
            };
            await renderItems([scalingItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.item-graph-container')).not.toBeNull();
            expect(container?.querySelector(`#chart-${scalingItem.id}`)).not.toBeNull();
        });

        it('should NOT render graph for one_and_done items with scaling data', async () => {
            const oneAndDoneScaling = {
                ...mockItem,
                scaling_per_stack: [1, 2, 3],
                one_and_done: true,
                graph_type: 'linear',
            };
            await renderItems([oneAndDoneScaling] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.item-graph-container')).toBeNull();
            expect(container?.querySelector('.item-graph-placeholder')).not.toBeNull();
            expect(container?.innerHTML).toContain('One-and-done');
        });

        it('should show placeholder for flat graph_type items', async () => {
            const flatItem = {
                ...mockItem,
                scaling_per_stack: [5, 5, 5],
                graph_type: 'flat',
            };
            await renderItems([flatItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.item-graph-placeholder')).not.toBeNull();
            expect(container?.innerHTML).toContain('Flat bonus');
        });

        it('should render empty state when no items', async () => {
            await renderItems([]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should include clickable-card class', async () => {
            await renderItems([mockItem] as any);

            const card = document.querySelector('.item-card');
            expect(card?.classList.contains('clickable-card')).toBe(true);
        });

        it('should render multiple items', async () => {
            const items = [
                mockItem,
                { ...mockItem, id: 'item-2', name: 'Ice Staff' },
                { ...mockItem, id: 'item-3', name: 'Lightning Bow' },
            ];
            await renderItems(items as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelectorAll('.item-card').length).toBe(3);
        });

        it('should escape HTML in item names', async () => {
            const xssItem = { ...mockItem, name: '<script>alert("xss")</script>' };
            await renderItems([xssItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in descriptions', async () => {
            const xssItem = { ...mockItem, base_effect: '<img onerror="alert(1)" src="x">' };
            await renderItems([xssItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should truncate long descriptions', async () => {
            const longDescItem = {
                ...mockItem,
                detailed_description: 'A'.repeat(200),
            };
            await renderItems([longDescItem] as any);

            const container = document.getElementById('itemsContainer');
            const descEl = container?.querySelector('.item-description');
            expect(descEl?.innerHTML).toContain('...');
            expect(descEl?.classList.contains('expandable-text')).toBe(true);
        });

        it('should add expand indicator for long descriptions', async () => {
            const longDescItem = {
                ...mockItem,
                detailed_description: 'This is a very long description that exceeds the maximum length allowed for truncation and should show an expand indicator at the end of the text',
            };
            await renderItems([longDescItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.expand-indicator')).not.toBeNull();
        });

        it('should store full text in data attribute for expandable descriptions', async () => {
            const longDescItem = {
                ...mockItem,
                detailed_description: 'This is a very long description that exceeds the maximum length allowed for truncation. It should have the full text stored in a data attribute.',
            };
            await renderItems([longDescItem] as any);

            const descEl = document.querySelector('.item-description.expandable-text') as HTMLElement;
            expect(descEl?.dataset.fullText).toBeTruthy();
            expect(descEl?.dataset.truncated).toBe('true');
        });

        it('should not add expandable class for short descriptions', async () => {
            const shortDescItem = {
                ...mockItem,
                detailed_description: 'Short text',
            };
            await renderItems([shortDescItem] as any);

            const descEl = document.querySelector('.item-description');
            expect(descEl?.classList.contains('expandable-text')).toBe(false);
        });

        it('should handle missing container gracefully', async () => {
            document.getElementById('itemsContainer')?.remove();
            await expect(renderItems([mockItem] as any)).resolves.not.toThrow();
        });

        it('should clear container before rendering', async () => {
            const container = document.getElementById('itemsContainer');
            if (container) {
                container.innerHTML = '<div class="old-content">Old content</div>';
            }

            await renderItems([mockItem] as any);

            expect(container?.querySelector('.old-content')).toBeNull();
            expect(container?.innerHTML).toContain('Fire Sword');
        });

        it('should handle items with missing optional fields', async () => {
            const minimalItem = {
                id: 'minimal',
                name: 'Minimal Item',
                rarity: 'common',
                tier: 'C',
                base_effect: '',
                detailed_description: '',
            };
            await expect(renderItems([minimalItem] as any)).resolves.not.toThrow();
        });

        it('should handle items with special characters in names', async () => {
            const specialItem = {
                ...mockItem,
                name: "Hero's Blade & Shield (v2.0)",
            };
            await renderItems([specialItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Hero');
            expect(container?.innerHTML).toContain('Blade');
        });

        // Compare feature tests - conditional on feature flag
        it.skipIf(!FEATURES.COMPARE_ITEMS)('should include compare checkbox when feature enabled', async () => {
            await renderItems([mockItem] as any);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelectorAll('.compare-checkbox').length).toBe(1);
        });

        it.skipIf(!FEATURES.COMPARE_ITEMS)('should check compare checkbox when item is in compare list', async () => {
            vi.mocked(getCompareItems).mockReturnValueOnce([mockItem.id]);
            await renderItems([mockItem] as any);

            const checkbox = document.querySelector('.compare-checkbox') as HTMLInputElement;
            expect(checkbox?.checked).toBe(true);
        });

        it('should handle undefined scaling_per_stack', async () => {
            const noScalingItem = {
                ...mockItem,
                scaling_per_stack: undefined,
            };
            await renderItems([noScalingItem] as any);

            const container = document.getElementById('itemsContainer');
            // Should render placeholder, not graph container
            expect(container?.querySelector('.item-graph-container')).toBeNull();
        });

        it('should handle null values gracefully', async () => {
            const nullItem = {
                id: 'null-item',
                name: 'Null Item',
                rarity: 'common',
                tier: 'C',
                base_effect: null,
                detailed_description: null,
                one_and_done: null,
                stacks_well: null,
            };
            await expect(renderItems([nullItem] as any)).resolves.not.toThrow();
        });

        it('should render all rarity types correctly', async () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const items = rarities.map((rarity, i) => ({
                ...mockItem,
                id: `item-${i}`,
                rarity,
            }));
            await renderItems(items as any);

            for (const rarity of rarities) {
                expect(document.querySelector(`.rarity-${rarity}`)).not.toBeNull();
            }
        });

        it('should render all tier types correctly', async () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];
            const items = tiers.map((tier, i) => ({
                ...mockItem,
                id: `item-${i}`,
                tier,
            }));
            await renderItems(items as any);

            const container = document.getElementById('itemsContainer');
            for (const tier of tiers) {
                expect(container?.innerHTML).toContain(`${tier} Tier`);
            }
        });
    });
});
