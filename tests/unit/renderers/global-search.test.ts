/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/global-search.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../../helpers/dom-setup.ts';

// Mock logger
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock data-service for empty state detection
vi.mock('../../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockReturnValue([
        { id: '1', name: 'Suggested Item', tier: 'S', base_effect: 'Test effect' },
        { id: '2', name: 'Another Item', tier: 'A', base_effect: 'Another effect' },
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
import { renderGlobalSearchResults } from '../../../src/modules/renderers/global-search.ts';
import type { GlobalSearchResult } from '../../../src/modules/filters.ts';

describe('renderers/global-search.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Make sure itemsContainer exists and is in an active tab
        const itemsTab = document.getElementById('items-tab');
        if (itemsTab) {
            itemsTab.classList.add('active');
        }
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderGlobalSearchResults()', () => {
        const createMockResult = (type: string, overrides = {}): GlobalSearchResult => ({
            type: type as any,
            item: {
                id: `${type}-1`,
                name: `Test ${type}`,
                tier: 'S',
                description: `A ${type} description`,
                ...overrides,
            },
            score: 100,
        });

        const mockItemResult = createMockResult('items', {
            base_effect: 'Deals fire damage',
            rarity: 'legendary',
        });

        const mockWeaponResult = createMockResult('weapons', {
            attack_pattern: 'Melee slash',
        });

        const mockTomeResult = createMockResult('tomes', {
            stat_affected: 'Crit Chance',
            value_per_level: '+1%',
        });

        const mockCharacterResult = createMockResult('characters', {
            passive_ability: 'Critical Mastery',
        });

        const mockShrineResult = createMockResult('shrines', {
            icon: '⛩️',
            reward: '+10% damage',
        });

        it('should render search results in container', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelectorAll('.search-result-card').length).toBe(1);
        });

        it('should update item-count to show results mode', () => {
            const results = [mockItemResult, mockWeaponResult, mockTomeResult];
            renderGlobalSearchResults(results);

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('3 results across all categories');
        });

        it('should render empty state when no results', () => {
            renderGlobalSearchResults([], undefined, 'test query');

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should group results by type', () => {
            const results = [mockItemResult, mockWeaponResult, mockTomeResult];
            renderGlobalSearchResults(results);

            const container = document.getElementById('itemsContainer');
            const sections = container?.querySelectorAll('.global-search-section');
            expect(sections?.length).toBe(3);
        });

        it('should render section headers with icons', () => {
            const results = [mockItemResult, mockWeaponResult];
            renderGlobalSearchResults(results);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('section-icon');
            expect(container?.innerHTML).toContain('📦'); // Items icon
            expect(container?.innerHTML).toContain('⚔️'); // Weapons icon
        });

        it('should render section headers with labels', () => {
            const results = [
                mockItemResult,
                mockWeaponResult,
                mockTomeResult,
                mockCharacterResult,
                mockShrineResult,
            ];
            renderGlobalSearchResults(results);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Items');
            expect(container?.innerHTML).toContain('Weapons');
            expect(container?.innerHTML).toContain('Tomes');
            expect(container?.innerHTML).toContain('Characters');
            expect(container?.innerHTML).toContain('Shrines');
        });

        it('should prioritize current tab results', () => {
            const results = [mockWeaponResult, mockItemResult, mockTomeResult];
            renderGlobalSearchResults(results, 'weapons');

            const container = document.getElementById('itemsContainer');
            const sections = container?.querySelectorAll('.global-search-section');
            // First section should be weapons (current tab)
            expect(sections?.[0]?.getAttribute('data-type')).toBe('weapons');
        });

        it('should mark current tab section', () => {
            const results = [mockItemResult, mockWeaponResult];
            renderGlobalSearchResults(results, 'items');

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.current-tab-section')).not.toBeNull();
            expect(container?.querySelector('.current-tab-results')).not.toBeNull();
        });

        it('should show (Current Tab) label for current tab section', () => {
            const results = [mockItemResult, mockWeaponResult];
            renderGlobalSearchResults(results, 'items');

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('(Current Tab)');
        });

        it('should render result counts in section headers', () => {
            const results = [
                mockItemResult,
                { ...mockItemResult, item: { ...mockItemResult.item, id: 'item-2' } },
            ];
            renderGlobalSearchResults(results);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('(2)');
        });

        it('should set entity data attributes on result cards', () => {
            renderGlobalSearchResults([mockItemResult]);

            const card = document.querySelector('.search-result-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('item'); // Singular form
            expect(card?.dataset.entityId).toBe('items-1');
            expect(card?.dataset.tabType).toBe('items');
        });

        it('should render shrine icons instead of images', () => {
            renderGlobalSearchResults([mockShrineResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.search-result-icon')).not.toBeNull();
            expect(container?.innerHTML).toContain('⛩️');
        });

        it('should render entity images for non-shrines', () => {
            const itemWithImage = {
                ...mockItemResult,
                item: { ...mockItemResult.item, image: '/assets/items/test.png' },
            };
            renderGlobalSearchResults([itemWithImage]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('picture')).not.toBeNull();
        });

        it('should render tier labels', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('tier-label');
        });

        it('should render descriptions', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('search-result-description');
        });

        it('should use base_effect for items', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Deals fire damage');
        });

        it('should use attack_pattern for weapons', () => {
            renderGlobalSearchResults([mockWeaponResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Melee slash');
        });

        it('should use stat_affected and value_per_level for tomes', () => {
            renderGlobalSearchResults([mockTomeResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Crit Chance');
            expect(container?.innerHTML).toContain('+1%');
        });

        it('should use passive_ability for characters', () => {
            renderGlobalSearchResults([mockCharacterResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Critical Mastery');
        });

        it('should use reward for shrines', () => {
            renderGlobalSearchResults([mockShrineResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('+10% damage');
        });

        it('should truncate long descriptions', () => {
            const longDescResult = {
                ...mockItemResult,
                item: {
                    ...mockItemResult.item,
                    base_effect: 'A'.repeat(100),
                },
            };
            renderGlobalSearchResults([longDescResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('...');
        });

        it('should escape HTML in names', () => {
            const xssResult = {
                ...mockItemResult,
                item: {
                    ...mockItemResult.item,
                    name: '<script>alert("xss")</script>',
                },
            };
            renderGlobalSearchResults([xssResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).not.toContain('<script>');
        });

        it('should escape HTML in descriptions', () => {
            const xssResult = {
                ...mockItemResult,
                item: {
                    ...mockItemResult.item,
                    base_effect: '<img onerror="alert(1)" src="x">',
                },
            };
            renderGlobalSearchResults([xssResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should limit results per type to MAX_RESULTS_PER_TYPE', () => {
            // Create 15 item results
            const manyResults = Array.from({ length: 15 }, (_, i) => ({
                ...mockItemResult,
                item: { ...mockItemResult.item, id: `item-${i}` },
                score: 100 - i,
            }));
            renderGlobalSearchResults(manyResults);

            const container = document.getElementById('itemsContainer');
            const cards = container?.querySelectorAll('.search-result-card');
            // Should be limited to 10 (MAX_RESULTS_PER_TYPE)
            expect(cards?.length).toBeLessThanOrEqual(10);
        });

        it('should handle missing container gracefully', () => {
            document.getElementById('itemsContainer')?.remove();
            // Also remove the active tab content
            document.querySelector('.tab-content.active')?.remove();
            
            expect(() => renderGlobalSearchResults([mockItemResult])).not.toThrow();
        });

        it('should handle items without tier', () => {
            const noTierResult = {
                ...mockShrineResult,
                item: { ...mockShrineResult.item, tier: undefined },
            };
            expect(() => renderGlobalSearchResults([noTierResult])).not.toThrow();
        });

        it('should handle items without name', () => {
            const noNameResult = {
                ...mockItemResult,
                item: { ...mockItemResult.item, name: undefined },
            };
            expect(() => renderGlobalSearchResults([noNameResult])).not.toThrow();

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Unknown');
        });

        it('should render go-to-icon for navigation', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.go-to-icon')).not.toBeNull();
            expect(container?.innerHTML).toContain('→');
        });

        it('should use active tab panel container if available', () => {
            const activeTab = document.querySelector('.tab-content.active');
            const grid = activeTab?.querySelector('.items-grid');
            
            renderGlobalSearchResults([mockItemResult]);

            // Results should be in the active tab's grid
            expect(grid?.querySelectorAll('.search-result-card').length).toBe(1);
        });

        it('should handle all entity types', () => {
            const allTypes = [
                mockItemResult,
                mockWeaponResult,
                mockTomeResult,
                mockCharacterResult,
                mockShrineResult,
            ];
            renderGlobalSearchResults(allTypes);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelectorAll('.search-result-card').length).toBe(5);
        });

        it('should preserve type order except for current tab', () => {
            const results = [
                mockShrineResult,
                mockCharacterResult,
                mockTomeResult,
                mockWeaponResult,
                mockItemResult,
            ];
            renderGlobalSearchResults(results, 'tomes');

            const container = document.getElementById('itemsContainer');
            const sections = container?.querySelectorAll('.global-search-section');
            
            // Tomes should be first (current tab)
            expect(sections?.[0]?.getAttribute('data-type')).toBe('tomes');
        });

        it('should handle non-entity tab as currentTab', () => {
            const results = [mockItemResult, mockWeaponResult];
            // calculator is not an entity type
            renderGlobalSearchResults(results, 'calculator');

            const container = document.getElementById('itemsContainer');
            const sections = container?.querySelectorAll('.global-search-section');
            
            // Should use default order (items first)
            expect(sections?.[0]?.getAttribute('data-type')).toBe('items');
        });

        it('should fallback to description when specific field is missing', () => {
            const fallbackResult = {
                ...mockItemResult,
                item: {
                    id: 'test',
                    name: 'Test Item',
                    tier: 'S',
                    description: 'Fallback description',
                    // No base_effect
                },
            };
            renderGlobalSearchResults([fallbackResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Fallback description');
        });

        it('should handle empty description gracefully', () => {
            const emptyDescResult = {
                ...mockItemResult,
                item: {
                    id: 'test',
                    name: 'Test Item',
                    tier: 'S',
                    // No description fields
                },
            };
            expect(() => renderGlobalSearchResults([emptyDescResult])).not.toThrow();
        });

        it('should render search-result-content wrapper', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.search-result-content')).not.toBeNull();
        });

        it('should render search-result-info wrapper', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.search-result-info')).not.toBeNull();
        });

        it('should render search-result-action wrapper', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            expect(container?.querySelector('.search-result-action')).not.toBeNull();
        });

        it('should render search-result-name', () => {
            renderGlobalSearchResults([mockItemResult]);

            const container = document.getElementById('itemsContainer');
            const name = container?.querySelector('.search-result-name');
            expect(name).not.toBeNull();
            expect(name?.textContent).toContain('Test items');
        });
    });
});
