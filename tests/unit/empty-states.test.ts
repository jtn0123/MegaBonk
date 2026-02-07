/**
 * @vitest-environment jsdom
 * Empty States Module Tests
 * Tests UI/UX validation for empty state rendering
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn((key: string) => {
        if (key === 'currentTab') return 'items';
        return null;
    }),
    setState: vi.fn(),
    resetStore: vi.fn(),
    subscribe: vi.fn(),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn((tabName: string) => {
        // Return mock data based on tab
        const mockData: Record<string, unknown[]> = {
            items: [
                { id: 'item1', name: 'Mega Sword', tier: 'SS', base_effect: 'Deals massive damage' },
                { id: 'item2', name: 'Shield', tier: 'S', base_effect: 'Blocks attacks' },
                { id: 'item3', name: 'Potion', tier: 'A', base_effect: 'Heals HP' },
                { id: 'item4', name: 'Ring', tier: 'B', base_effect: 'Increases luck' },
                { id: 'item5', name: 'Boots', tier: 'C', base_effect: 'Faster movement' },
            ],
            weapons: [
                { id: 'weapon1', name: 'Fire Blade', tier: 'SS', attack_pattern: 'Wide slash' },
                { id: 'weapon2', name: 'Ice Staff', tier: 'S', attack_pattern: 'Projectile' },
            ],
            tomes: [
                { id: 'tome1', name: 'Power Tome', tier: 'SS', stat_affected: 'Attack' },
            ],
            characters: [
                { id: 'char1', name: 'Hero', tier: 'S', passive_ability: 'Double jump' },
            ],
            shrines: [
                { id: 'shrine1', name: 'Power Shrine', icon: '⛩️', reward: '+10 Attack' },
            ],
        };
        return mockData[tabName] || [];
    }),
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn(() => []),
}));

// Import after mocking
import {
    detectEmptyStateType,
    generateEmptyStateWithSuggestions,
    generateCompareEmptyState,
    handleEmptyStateClick,
} from '../../src/modules/empty-states.ts';
import type { EmptyStateContext, EmptyStateType } from '../../src/modules/empty-states.ts';

describe('Empty States Module - UI/UX Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <input type="text" id="searchInput" value="" />
            <input type="checkbox" id="favoritesOnly" />
            <div id="filters">
                <select id="tierFilter"><option value="all">All</option><option value="SS">SS</option></select>
                <select id="rarityFilter"><option value="all">All</option><option value="rare">Rare</option></select>
                <select id="stackingFilter"><option value="all">All</option></select>
                <select id="typeFilter"><option value="all">All</option></select>
            </div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ========================================
    // detectEmptyStateType Tests
    // ========================================
    describe('detectEmptyStateType', () => {
        it('should detect favorites empty state when favorites checkbox is checked', () => {
            const favoritesCheckbox = document.getElementById('favoritesOnly') as HTMLInputElement;
            favoritesCheckbox.checked = true;

            const result = detectEmptyStateType('items');

            expect(result.type).toBe('favorites');
            expect(result.tabName).toBe('items');
        });

        it('should detect search empty state when search has a query', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test query';

            const result = detectEmptyStateType('items');

            expect(result.type).toBe('search');
            expect(result.searchQuery).toBe('test query');
        });

        it('should detect filters empty state when tier filter is active', () => {
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            tierFilter.value = 'SS';

            const result = detectEmptyStateType('weapons');

            expect(result.type).toBe('filters');
            expect(result.hasActiveFilters).toBe(true);
        });

        it('should detect filters empty state when rarity filter is active', () => {
            const rarityFilter = document.getElementById('rarityFilter') as HTMLSelectElement;
            rarityFilter.value = 'rare';

            const result = detectEmptyStateType('items');

            expect(result.type).toBe('filters');
            expect(result.hasActiveFilters).toBe(true);
        });

        it('should return generic state when no filters are active', () => {
            const result = detectEmptyStateType('items');

            expect(result.type).toBe('generic');
            expect(result.tabName).toBe('items');
        });

        it('should prioritize favorites over search', () => {
            const favoritesCheckbox = document.getElementById('favoritesOnly') as HTMLInputElement;
            favoritesCheckbox.checked = true;
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test';

            const result = detectEmptyStateType('items');

            expect(result.type).toBe('favorites');
        });

        it('should prioritize search over filters', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test';
            const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
            tierFilter.value = 'SS';

            const result = detectEmptyStateType('items');

            expect(result.type).toBe('search');
        });
    });

    // ========================================
    // generateEmptyStateWithSuggestions Tests
    // ========================================
    describe('generateEmptyStateWithSuggestions', () => {
        describe('Favorites Empty State', () => {
            it('should render favorites empty state with correct message', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('No favorites yet!');
                expect(html).toContain('❤️');
            });

            it('should render Browse Items button for favorites', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Browse Items');
                expect(html).toContain('data-action="browse"');
            });

            it('should render suggestion cards with valid data', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                // Check suggestions section exists
                expect(html).toContain('empty-state-suggestions');
                expect(html).toContain('Try these instead:');
                expect(html).toContain('suggestions-grid');
            });

            it('should render suggestion cards with proper attributes', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                // Should have entity data attributes
                expect(html).toContain('data-entity-type="item"');
                expect(html).toContain('data-entity-id=');
                expect(html).toContain('data-tab-type="items"');
            });

            it('should render tier badges for suggestions', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                // Should show tier badges
                expect(html).toContain('suggestion-tier');
                // Check for any tier class
                expect(html).toMatch(/tier-(SS|S|A|B|C)/);
            });
        });

        describe('Search Empty State', () => {
            it('should render search empty state with query', () => {
                const context: EmptyStateContext = {
                    type: 'search',
                    tabName: 'items',
                    searchQuery: 'nonexistent',
                };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('No results for');
                expect(html).toContain('nonexistent');
                expect(html).toContain('🔍');
            });

            it('should escape HTML in search query', () => {
                const context: EmptyStateContext = {
                    type: 'search',
                    tabName: 'items',
                    searchQuery: '<script>alert("xss")</script>',
                };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
            });

            it('should render Clear Search button', () => {
                const context: EmptyStateContext = {
                    type: 'search',
                    tabName: 'items',
                    searchQuery: 'test',
                };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Clear Search');
                expect(html).toContain('data-action="clear-search"');
            });
        });

        describe('Filters Empty State', () => {
            it('should render filters empty state with correct message', () => {
                const context: EmptyStateContext = {
                    type: 'filters',
                    tabName: 'items',
                    hasActiveFilters: true,
                };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('No items match these filters');
                expect(html).toContain('🎯');
            });

            it('should render Clear Filters button', () => {
                const context: EmptyStateContext = {
                    type: 'filters',
                    tabName: 'items',
                    hasActiveFilters: true,
                };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Clear Filters');
                expect(html).toContain('data-action="clear-filters"');
            });
        });

        describe('Compare Empty State', () => {
            it('should render compare empty state with correct message', () => {
                const context: EmptyStateContext = { type: 'compare', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Nothing to compare yet!');
                expect(html).toContain('🔄');
            });

            it('should render Add Items to Compare button', () => {
                const context: EmptyStateContext = { type: 'compare', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Add Items to Compare');
                expect(html).toContain('data-action="browse"');
            });
        });

        describe('Generic Empty State', () => {
            it('should render generic empty state', () => {
                const context: EmptyStateContext = { type: 'generic', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('No items found');
            });

            it('should render Clear Filters button for generic state', () => {
                const context: EmptyStateContext = { type: 'generic', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('Clear Filters');
                expect(html).toContain('data-action="clear-filters"');
            });
        });

        describe('Suggestion Card Rendering', () => {
            it('should render suggestion cards with role=button and tabindex', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('role="button"');
                expect(html).toContain('tabindex="0"');
            });

            it('should render fallback icon for shrines', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'shrines' };
                const html = generateEmptyStateWithSuggestions(context);

                // Should have either the icon from data or fallback
                expect(html).toMatch(/(suggestion-icon|⛩️)/);
            });

            it('should include suggestion-name class for item names', () => {
                const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
                const html = generateEmptyStateWithSuggestions(context);

                expect(html).toContain('suggestion-name');
            });
        });
    });

    // ========================================
    // generateCompareEmptyState Tests
    // ========================================
    describe('generateCompareEmptyState', () => {
        it('should generate compare empty state HTML', () => {
            const html = generateCompareEmptyState();

            expect(html).toContain('Nothing to compare yet!');
            expect(html).toContain('Add Items to Compare');
        });

        it('should include suggestions grid', () => {
            const html = generateCompareEmptyState();

            expect(html).toContain('suggestions-grid');
            expect(html).toContain('suggestion-card');
        });
    });

    // ========================================
    // handleEmptyStateClick Tests
    // ========================================
    describe('handleEmptyStateClick', () => {
        beforeEach(() => {
            // Set up window.renderTabContent mock
            (window as unknown as { renderTabContent: () => void }).renderTabContent = vi.fn();
        });

        describe('Action Button Clicks', () => {
            it('should handle browse action by clearing filters', () => {
                const button = document.createElement('button');
                button.className = 'empty-state-action';
                button.dataset.action = 'browse';

                const result = handleEmptyStateClick(button);

                expect(result).toBe(true);
            });

            it('should handle clear-search action', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.value = 'test query';

                const button = document.createElement('button');
                button.className = 'empty-state-action';
                button.dataset.action = 'clear-search';

                const result = handleEmptyStateClick(button);

                expect(result).toBe(true);
                expect(searchInput.value).toBe('');
            });

            it('should handle clear-filters action', () => {
                const tierFilter = document.getElementById('tierFilter') as HTMLSelectElement;
                tierFilter.value = 'SS';

                const button = document.createElement('button');
                button.className = 'empty-state-action';
                button.dataset.action = 'clear-filters';

                const result = handleEmptyStateClick(button);

                expect(result).toBe(true);
                expect(tierFilter.value).toBe('all');
            });
        });

        describe('Suggestion Card Clicks', () => {
            it('should handle click on suggestion card', async () => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                card.dataset.entityType = 'item';
                card.dataset.entityId = 'item1';

                // Mock the modal import
                vi.doMock('../../src/modules/modal.ts', () => ({
                    openDetailModal: vi.fn(),
                }));

                const result = handleEmptyStateClick(card);

                expect(result).toBe(true);
            });

            it('should handle click on child element of suggestion card', () => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                card.dataset.entityType = 'item';
                card.dataset.entityId = 'item1';

                const child = document.createElement('span');
                child.className = 'suggestion-name';
                child.textContent = 'Test Item';
                card.appendChild(child);
                document.body.appendChild(card);

                const result = handleEmptyStateClick(child);

                expect(result).toBe(true);
            });
        });

        describe('Non-Target Clicks', () => {
            it('should return false for non-empty-state elements', () => {
                const randomDiv = document.createElement('div');
                randomDiv.className = 'some-other-class';

                const result = handleEmptyStateClick(randomDiv);

                expect(result).toBe(false);
            });
        });
    });

    // ========================================
    // CSS Class Validation
    // ========================================
    describe('CSS Class Structure', () => {
        it('should include empty-state-enhanced class', () => {
            const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
            const html = generateEmptyStateWithSuggestions(context);

            expect(html).toContain('empty-state-enhanced');
        });

        it('should include empty-state-content wrapper', () => {
            const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
            const html = generateEmptyStateWithSuggestions(context);

            expect(html).toContain('empty-state-content');
        });

        it('should include empty-state-message for heading', () => {
            const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
            const html = generateEmptyStateWithSuggestions(context);

            expect(html).toContain('empty-state-message');
        });

        it('should include btn-primary for action button', () => {
            const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
            const html = generateEmptyStateWithSuggestions(context);

            expect(html).toContain('btn-primary');
        });

        it('should include suggestions-label for suggestion header', () => {
            const context: EmptyStateContext = { type: 'favorites', tabName: 'items' };
            const html = generateEmptyStateWithSuggestions(context);

            expect(html).toContain('suggestions-label');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle empty tabName', () => {
            // Cast to any to test edge case
            const context = { type: 'generic' as EmptyStateType, tabName: '' as 'items' };
            expect(() => generateEmptyStateWithSuggestions(context)).not.toThrow();
        });

        it('should handle whitespace-only search query', () => {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = '   ';

            const result = detectEmptyStateType('items');

            // Whitespace-only should be treated as no search
            expect(result.type).not.toBe('search');
        });

        it('should handle missing DOM elements gracefully', () => {
            document.body.innerHTML = ''; // Clear all elements

            // Should not throw
            expect(() => detectEmptyStateType('items')).not.toThrow();
        });
    });
});
