/**
 * @vitest-environment jsdom
 * Comprehensive coverage tests for renderers.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock favorites
vi.mock('../../src/modules/favorites', () => ({
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Mock compare
vi.mock('../../src/modules/compare', () => ({
    getCompareItems: vi.fn().mockReturnValue([]),
}));

// Mock data-service
vi.mock('../../src/modules/data-service', () => ({
    getDataForTab: vi.fn().mockImplementation((tabName: string) => {
        const mockData: Record<string, any[]> = {
            items: [
                { id: 'item1', name: 'Fire Sword', rarity: 'legendary', tier: 'S', base_effect: 'Deals fire damage' },
            ],
            weapons: [
                { id: 'weapon1', name: 'Katana', tier: 'A', attack_pattern: 'Melee' },
            ],
            tomes: [
                { id: 'tome1', name: 'Precision', tier: 'A', stat_affected: 'Crit', value_per_level: '+1%' },
            ],
            characters: [
                { id: 'char1', name: 'CL4NK', tier: 'S', passive_ability: 'Crit bonus' },
            ],
            shrines: [
                { id: 'shrine1', name: 'Statue', icon: '⛩️', reward: '+5% damage' },
            ],
        };
        return mockData[tabName] || [];
    }),
}));

// Mock filters
vi.mock('../../src/modules/filters', () => ({
    filterData: vi.fn().mockImplementation((data: any[]) => data),
    GlobalSearchResult: {},
}));

// Mock calculator
vi.mock('../../src/modules/calculator', () => ({
    calculateBreakpoint: vi.fn(),
    populateCalculatorItems: vi.fn(),
}));

// Mock changelog
vi.mock('../../src/modules/changelog', () => ({
    updateChangelogStats: vi.fn(),
    renderChangelog: vi.fn(),
}));

// Mock build-planner
vi.mock('../../src/modules/build-planner', () => ({
    renderBuildPlanner: vi.fn(),
}));

// Mock charts
vi.mock('../../src/modules/charts', () => ({
    initializeItemCharts: vi.fn(),
    initializeTomeCharts: vi.fn(),
}));

// Mock store
vi.mock('../../src/modules/store', () => ({
    setState: vi.fn(),
}));

// Mock registry
vi.mock('../../src/modules/registry', () => ({
    registerFunction: vi.fn(),
}));

// Import functions to test
import {
    renderTabContent,
    updateStats,
    renderItems,
    renderWeapons,
    renderTomes,
    renderCharacters,
    renderShrines,
    renderGlobalSearchResults,
} from '../../src/modules/renderers';

describe('renderers.ts coverage tests', () => {
    beforeEach(() => {
        // Setup minimal DOM
        document.body.innerHTML = `
            <div id="itemsContainer"></div>
            <div id="weaponsContainer"></div>
            <div id="tomesContainer"></div>
            <div id="charactersContainer"></div>
            <div id="shrinesContainer"></div>
            <div id="item-count"></div>
            <button id="calc-button"></button>
            <div id="filters">
                <select id="tierFilter"><option value="all">All</option></select>
                <select id="rarityFilter"><option value="all">All</option></select>
            </div>
        `;

        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    describe('renderTabContent', () => {
        it('should render build-planner tab', async () => {
            const { renderBuildPlanner } = await import('../../src/modules/build-planner');
            await renderTabContent('build-planner');
            expect(renderBuildPlanner).toHaveBeenCalled();
        });

        it('should render calculator tab', async () => {
            const { populateCalculatorItems } = await import('../../src/modules/calculator');
            await renderTabContent('calculator');
            expect(populateCalculatorItems).toHaveBeenCalled();
        });

        it('should attach listener to calc button only once', async () => {
            await renderTabContent('calculator');
            const calcBtn = document.getElementById('calc-button');
            expect(calcBtn?.dataset.listenerAttached).toBe('true');

            // Render again - should not attach duplicate listener
            await renderTabContent('calculator');
            expect(calcBtn?.dataset.listenerAttached).toBe('true');
        });

        it('should render items tab', async () => {
            await renderTabContent('items');
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Fire Sword');
        });

        it('should render weapons tab', async () => {
            await renderTabContent('weapons');
            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('Katana');
        });

        it('should render tomes tab', async () => {
            await renderTabContent('tomes');
            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Precision');
        });

        it('should render characters tab', async () => {
            await renderTabContent('characters');
            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('CL4NK');
        });

        it('should render shrines tab', async () => {
            await renderTabContent('shrines');
            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Statue');
        });

        it('should handle missing data gracefully', async () => {
            const { getDataForTab } = await import('../../src/modules/data-service');
            (getDataForTab as any).mockReturnValueOnce(null);
            await expect(renderTabContent('items')).resolves.not.toThrow();
        });
    });

    describe('updateStats', () => {
        it('should update item count display', () => {
            const items = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
            updateStats(items as any, 'items');
            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('2');
        });

        it('should show filtered count', async () => {
            const { getDataForTab } = await import('../../src/modules/data-service');
            (getDataForTab as any).mockReturnValueOnce([{}, {}, {}]); // 3 total items
            const filtered = [{ id: '1', name: 'Item 1' }]; // 1 filtered item
            updateStats(filtered as any, 'items');
            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('1/3');
        });

        it('should handle singular item', async () => {
            const { getDataForTab } = await import('../../src/modules/data-service');
            (getDataForTab as any).mockReturnValueOnce([{}]);
            const filtered = [{ id: '1', name: 'Item 1' }];
            updateStats(filtered as any, 'items');
            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('item');
        });

        it('should handle missing item count element', () => {
            document.body.innerHTML = '';
            expect(() => updateStats([], 'items')).not.toThrow();
        });
    });

    describe('renderGlobalSearchResults', () => {
        const mockResults = [
            { type: 'items' as const, item: { id: '1', name: 'Fire Sword', tier: 'S', base_effect: 'Fire damage' }, score: 100 },
            { type: 'weapons' as const, item: { id: '2', name: 'Katana', tier: 'A', attack_pattern: 'Melee' }, score: 90 },
            { type: 'tomes' as const, item: { id: '3', name: 'Precision', tier: 'A', stat_affected: 'Crit', value_per_level: '+1%' }, score: 80 },
            { type: 'characters' as const, item: { id: '4', name: 'CL4NK', tier: 'S', passive_ability: 'Crit bonus' }, score: 70 },
            { type: 'shrines' as const, item: { id: '5', name: 'Statue', icon: '⛩️', reward: '+5% damage' }, score: 60 },
        ];

        it('should render search results', () => {
            renderGlobalSearchResults(mockResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('search-result-card');
        });

        it('should show empty state when no results', () => {
            renderGlobalSearchResults([]);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('No Results Found');
        });

        it('should update item count to show results mode', () => {
            renderGlobalSearchResults(mockResults as any);
            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('results across all categories');
        });

        it('should group results by type', () => {
            renderGlobalSearchResults(mockResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('global-search-section');
        });

        it('should render section headers', () => {
            renderGlobalSearchResults(mockResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('section-title');
        });

        it('should handle missing container gracefully', () => {
            document.body.innerHTML = '';
            expect(() => renderGlobalSearchResults(mockResults as any)).not.toThrow();
        });

        it('should render item descriptions', () => {
            renderGlobalSearchResults(mockResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Fire damage');
        });

        it('should render shrine icons', () => {
            const shrineResults = [
                { type: 'shrines' as const, item: { id: '5', name: 'Statue', icon: '⛩️', reward: '+5% damage' }, score: 60 },
            ];
            renderGlobalSearchResults(shrineResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('⛩️');
        });

        it('should render tier labels', () => {
            const itemResults = [
                { type: 'items' as const, item: { id: '1', name: 'Fire Sword', tier: 'S', base_effect: 'Fire' }, score: 100 },
            ];
            renderGlobalSearchResults(itemResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('tier');
        });

        it('should truncate long descriptions', () => {
            const longDescResults = [
                {
                    type: 'items' as const,
                    item: {
                        id: '1',
                        name: 'Long Description Item',
                        tier: 'S',
                        base_effect: 'This is a very long description that should be truncated because it exceeds the maximum allowed length for search results display'
                    },
                    score: 100
                },
            ];
            renderGlobalSearchResults(longDescResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('...');
        });

        it('should handle items without tier', () => {
            const noTierResults = [
                { type: 'shrines' as const, item: { id: '1', name: 'Test Shrine', icon: '⛩️', reward: 'Test' }, score: 100 },
            ];
            renderGlobalSearchResults(noTierResults as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Test Shrine');
        });

        it('should set data attributes on result cards', () => {
            renderGlobalSearchResults(mockResults as any);
            const card = document.querySelector('.search-result-card');
            expect(card?.getAttribute('data-entity-id')).toBeTruthy();
            expect(card?.getAttribute('data-tab-type')).toBeTruthy();
        });
    });

    describe('Render Functions', () => {
        it('renderItems should render item cards', async () => {
            const items = [{ id: '1', name: 'Test Item', rarity: 'rare', tier: 'A' }];
            await renderItems(items as any);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('Test Item');
        });

        it('renderWeapons should render weapon cards', () => {
            const weapons = [{ id: '1', name: 'Test Weapon', tier: 'S' }];
            renderWeapons(weapons as any);
            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('Test Weapon');
        });

        it('renderTomes should render tome cards', () => {
            const tomes = [{ id: '1', name: 'Test Tome', tier: 'A', priority: 1 }];
            renderTomes(tomes as any);
            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Test Tome');
        });

        it('renderCharacters should render character cards', () => {
            const characters = [{ id: '1', name: 'Test Character', tier: 'S' }];
            renderCharacters(characters as any);
            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('Test Character');
        });

        it('renderShrines should render shrine cards', () => {
            const shrines = [{ id: '1', name: 'Test Shrine', type: 'stat_upgrade', icon: '⛩️' }];
            renderShrines(shrines as any);
            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Test Shrine');
        });

        it('should show empty state when no items', () => {
            renderItems([]);
            const container = document.getElementById('itemsContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });
    });
});
