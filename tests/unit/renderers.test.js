import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock dependencies before importing module
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    isFavorite: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/modules/compare.ts', () => ({
    getCompareItems: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockImplementation(tabName => {
        const mockData = {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item',
                    rarity: 'common',
                    tier: 'A',
                    base_effect: 'Test effect',
                    detailed_description: 'Test description',
                    one_and_done: false,
                    stacks_well: true,
                },
            ],
            weapons: [
                {
                    id: 'weapon1',
                    name: 'Test Weapon',
                    tier: 'S',
                    attack_pattern: 'Melee',
                    description: 'Test weapon description',
                    upgradeable_stats: ['damage', 'speed'],
                },
            ],
            tomes: [
                {
                    id: 'tome1',
                    name: 'Test Tome',
                    tier: 'A',
                    priority: 1,
                    stat_affected: 'Attack',
                    value_per_level: '+5%',
                    description: 'Test tome description',
                },
            ],
            characters: [
                {
                    id: 'char1',
                    name: 'Test Character',
                    tier: 'S',
                    passive_ability: 'Test Passive',
                    passive_description: 'Test passive description',
                    starting_weapon: 'Sword',
                    playstyle: 'Aggressive',
                },
            ],
            shrines: [
                {
                    id: 'shrine1',
                    name: 'Test Shrine',
                    icon: '⛩️',
                    type: 'stat_upgrade',
                    description: 'Test shrine description',
                    reward: 'Test reward',
                    reusable: true,
                },
            ],
        };
        return mockData[tabName] || [];
    }),
}));

vi.mock('../../src/modules/filters.ts', () => ({
    filterData: vi.fn().mockImplementation(data => data),
}));

vi.mock('../../src/modules/calculator.ts', () => ({
    calculateBreakpoint: vi.fn(),
    populateCalculatorItems: vi.fn(),
}));

vi.mock('../../src/modules/changelog.ts', () => ({
    updateChangelogStats: vi.fn(),
    renderChangelog: vi.fn(),
}));

vi.mock('../../src/modules/build-planner.ts', () => ({
    renderBuildPlanner: vi.fn(),
}));

vi.mock('../../src/modules/charts.ts', () => ({
    initializeItemCharts: vi.fn(),
    initializeTomeCharts: vi.fn(),
}));

// Import after mocks
import {
    renderTabContent,
    updateStats,
    renderItems,
    renderWeapons,
    renderTomes,
    renderCharacters,
    renderShrines,
} from '../../src/modules/renderers.ts';
import { isFavorite } from '../../src/modules/favorites.ts';
import { getCompareItems } from '../../src/modules/compare.ts';
import { renderBuildPlanner } from '../../src/modules/build-planner.ts';
import { populateCalculatorItems } from '../../src/modules/calculator.ts';
import { updateChangelogStats, renderChangelog } from '../../src/modules/changelog.ts';

describe('Renderers Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();

        // Add container elements needed for rendering
        const itemsContainer = document.createElement('div');
        itemsContainer.id = 'itemsContainer';
        document.body.appendChild(itemsContainer);

        const weaponsContainer = document.createElement('div');
        weaponsContainer.id = 'weaponsContainer';
        document.body.appendChild(weaponsContainer);

        const tomesContainer = document.createElement('div');
        tomesContainer.id = 'tomesContainer';
        document.body.appendChild(tomesContainer);

        const charactersContainer = document.createElement('div');
        charactersContainer.id = 'charactersContainer';
        document.body.appendChild(charactersContainer);

        const shrinesContainer = document.createElement('div');
        shrinesContainer.id = 'shrinesContainer';
        document.body.appendChild(shrinesContainer);
    });

    afterEach(() => {
        document.getElementById('itemsContainer')?.remove();
        document.getElementById('weaponsContainer')?.remove();
        document.getElementById('tomesContainer')?.remove();
        document.getElementById('charactersContainer')?.remove();
        document.getElementById('shrinesContainer')?.remove();
    });

    describe('renderTabContent()', () => {
        it('should call renderBuildPlanner for build-planner tab', () => {
            renderTabContent('build-planner');
            expect(renderBuildPlanner).toHaveBeenCalled();
        });

        it('should call populateCalculatorItems for calculator tab', () => {
            // Add calculator button
            const calcBtn = document.createElement('button');
            calcBtn.id = 'calc-button';
            document.body.appendChild(calcBtn);

            renderTabContent('calculator');
            expect(populateCalculatorItems).toHaveBeenCalled();

            calcBtn.remove();
        });

        it('should call changelog functions for changelog tab', () => {
            renderTabContent('changelog');
            expect(updateChangelogStats).toHaveBeenCalled();
            expect(renderChangelog).toHaveBeenCalled();
        });

        it('should render items for items tab', () => {
            renderTabContent('items');

            const container = document.getElementById('itemsContainer');
            expect(container.children.length).toBeGreaterThan(0);
        });

        it('should render weapons for weapons tab', () => {
            renderTabContent('weapons');

            const container = document.getElementById('weaponsContainer');
            expect(container.children.length).toBeGreaterThan(0);
        });

        it('should render tomes for tomes tab', () => {
            renderTabContent('tomes');

            const container = document.getElementById('tomesContainer');
            expect(container.children.length).toBeGreaterThan(0);
        });

        it('should render characters for characters tab', () => {
            renderTabContent('characters');

            const container = document.getElementById('charactersContainer');
            expect(container.children.length).toBeGreaterThan(0);
        });

        it('should render shrines for shrines tab', () => {
            renderTabContent('shrines');

            const container = document.getElementById('shrinesContainer');
            expect(container.children.length).toBeGreaterThan(0);
        });

        it('should update window.filteredData', () => {
            renderTabContent('items');
            expect(window.filteredData).toBeDefined();
            expect(Array.isArray(window.filteredData)).toBe(true);
        });
    });

    describe('updateStats()', () => {
        it('should update item count display', () => {
            const items = [
                { id: '1', name: 'Item 1', one_and_done: true, stacks_well: false },
                { id: '2', name: 'Item 2', one_and_done: false, stacks_well: true },
            ];

            updateStats(items, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount.textContent).toContain('2');
            expect(itemCount.textContent).toContain('items');
        });

        it('should show showing count', () => {
            const items = [{ id: '1', name: 'Item 1', one_and_done: false, stacks_well: false }];

            updateStats(items, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount.textContent).toContain('1');
        });

        it('should show filtered count when filtered', () => {
            updateStats([], 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount.textContent).toContain('0');
            expect(itemCount.textContent).toContain('items');
        });

        it('should use correct label for non-items', () => {
            updateStats([], 'weapons');

            const itemCount = document.getElementById('item-count');
            expect(itemCount.textContent).toContain('weapons');
        });

        it('should handle empty tabName gracefully', () => {
            updateStats([], '');

            const itemCount = document.getElementById('item-count');
            expect(itemCount.textContent).toContain('items'); // Default fallback
        });
    });

    describe('renderItems()', () => {
        const mockItems = [
            {
                id: 'item1',
                name: 'Test Item',
                rarity: 'common',
                tier: 'A',
                base_effect: 'Test effect',
                detailed_description: 'Short description',
                one_and_done: false,
                stacks_well: true,
            },
        ];

        it('should render item cards', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelectorAll('.item-card').length).toBe(1);
        });

        it('should include item name', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.innerHTML).toContain('Test Item');
        });

        it('should include rarity class', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            const card = container.querySelector('.item-card');
            expect(card.classList.contains('rarity-common')).toBe(true);
        });

        it('should set entity data attributes', () => {
            renderItems(mockItems);

            const card = document.querySelector('.item-card');
            expect(card.dataset.entityType).toBe('item');
            expect(card.dataset.entityId).toBe('item1');
        });

        it('should include stack text', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.innerHTML).toContain('Stacks Well');
        });

        it('should show One-and-Done for one_and_done items', () => {
            const oneAndDoneItem = [{ ...mockItems[0], one_and_done: true, stacks_well: false }];
            renderItems(oneAndDoneItem);

            const container = document.getElementById('itemsContainer');
            expect(container.innerHTML).toContain('One-and-Done');
        });

        it('should show Limited for non-stacking items', () => {
            const limitedItem = [{ ...mockItems[0], one_and_done: false, stacks_well: false }];
            renderItems(limitedItem);

            const container = document.getElementById('itemsContainer');
            expect(container.innerHTML).toContain('Limited');
        });

        it('should include favorite button', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelectorAll('.favorite-btn').length).toBe(1);
        });

        it('should include compare checkbox', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelectorAll('.compare-checkbox').length).toBe(1);
        });

        it('should include view details button', () => {
            renderItems(mockItems);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelectorAll('.view-details-btn').length).toBe(1);
        });

        it('should render empty state when no items', () => {
            renderItems([]);

            const container = document.getElementById('itemsContainer');
            expect(container.innerHTML).toContain('empty-state');
        });

        it('should show favorited state when item is favorited', () => {
            vi.mocked(isFavorite).mockReturnValue(true);
            renderItems(mockItems);

            const favBtn = document.querySelector('.favorite-btn');
            expect(favBtn.classList.contains('favorited')).toBe(true);
            expect(favBtn.textContent).toContain('⭐');
        });

        it('should check compare checkbox when item is in compare list', () => {
            vi.mocked(getCompareItems).mockReturnValue(['item1']);
            renderItems(mockItems);

            const checkbox = document.querySelector('.compare-checkbox');
            expect(checkbox.checked).toBe(true);
        });

        it('should include graph container for scaling items', () => {
            const scalingItem = [
                {
                    ...mockItems[0],
                    scaling_per_stack: [1, 2, 3],
                    one_and_done: false,
                    graph_type: 'linear',
                },
            ];
            renderItems(scalingItem);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelector('.item-graph-container')).not.toBeNull();
        });

        it('should not include graph for one_and_done items', () => {
            const oneAndDoneItem = [
                {
                    ...mockItems[0],
                    scaling_per_stack: [1, 2, 3],
                    one_and_done: true,
                    graph_type: 'linear',
                },
            ];
            renderItems(oneAndDoneItem);

            const container = document.getElementById('itemsContainer');
            expect(container.querySelector('.item-graph-container')).toBeNull();
        });

        it('should show placeholder for one_and_done items', () => {
            const oneAndDoneItem = [
                {
                    ...mockItems[0],
                    scaling_per_stack: [1, 2, 3],
                    one_and_done: true,
                    graph_type: 'linear',
                },
            ];
            renderItems(oneAndDoneItem);

            const container = document.getElementById('itemsContainer');
            const placeholder = container.querySelector('.item-graph-placeholder');
            expect(placeholder).not.toBeNull();
            expect(placeholder.textContent).toContain('One-and-done');
        });

        it('should show placeholder for flat graph_type items', () => {
            const flatItem = [
                {
                    ...mockItems[0],
                    scaling_per_stack: [1, 1, 1],
                    one_and_done: false,
                    graph_type: 'flat',
                },
            ];
            renderItems(flatItem);

            const container = document.getElementById('itemsContainer');
            const placeholder = container.querySelector('.item-graph-placeholder');
            expect(placeholder).not.toBeNull();
            expect(placeholder.textContent).toContain('Flat bonus');
        });
    });

    describe('renderWeapons()', () => {
        const mockWeapons = [
            {
                id: 'weapon1',
                name: 'Test Sword',
                tier: 'S',
                attack_pattern: 'Melee slash',
                description: 'A test weapon',
                upgradeable_stats: ['damage', 'speed'],
            },
        ];

        it('should render weapon cards', () => {
            renderWeapons(mockWeapons);

            const container = document.getElementById('weaponsContainer');
            expect(container.querySelectorAll('.weapon-card').length).toBe(1);
        });

        it('should include weapon name', () => {
            renderWeapons(mockWeapons);

            const container = document.getElementById('weaponsContainer');
            expect(container.innerHTML).toContain('Test Sword');
        });

        it('should include attack pattern', () => {
            renderWeapons(mockWeapons);

            const container = document.getElementById('weaponsContainer');
            expect(container.innerHTML).toContain('Melee slash');
        });

        it('should include upgradeable stats as meta tags', () => {
            renderWeapons(mockWeapons);

            const container = document.getElementById('weaponsContainer');
            const metaTags = container.querySelectorAll('.meta-tag');
            expect(metaTags.length).toBeGreaterThan(0);
        });

        it('should set entity data attributes', () => {
            renderWeapons(mockWeapons);

            const card = document.querySelector('.weapon-card');
            expect(card.dataset.entityType).toBe('weapon');
            expect(card.dataset.entityId).toBe('weapon1');
        });

        it('should render empty state when no weapons', () => {
            renderWeapons([]);

            const container = document.getElementById('weaponsContainer');
            expect(container.innerHTML).toContain('empty-state');
        });

        it('should include favorite button', () => {
            renderWeapons(mockWeapons);

            const container = document.getElementById('weaponsContainer');
            expect(container.querySelectorAll('.favorite-btn').length).toBe(1);
        });
    });

    describe('renderTomes()', () => {
        const mockTomes = [
            {
                id: 'tome1',
                name: 'Attack Tome',
                tier: 'A',
                priority: 1,
                stat_affected: 'Attack',
                value_per_level: '+5%',
                description: 'Increases attack damage',
            },
        ];

        it('should render tome cards', () => {
            renderTomes(mockTomes);

            const container = document.getElementById('tomesContainer');
            expect(container.querySelectorAll('.tome-card').length).toBe(1);
        });

        it('should include tome name', () => {
            renderTomes(mockTomes);

            const container = document.getElementById('tomesContainer');
            expect(container.innerHTML).toContain('Attack Tome');
        });

        it('should include stat affected and value', () => {
            renderTomes(mockTomes);

            const container = document.getElementById('tomesContainer');
            expect(container.innerHTML).toContain('Attack');
            expect(container.innerHTML).toContain('+5%');
        });

        it('should include priority', () => {
            renderTomes(mockTomes);

            const container = document.getElementById('tomesContainer');
            expect(container.innerHTML).toContain('Priority 1');
        });

        it('should include graph container', () => {
            renderTomes(mockTomes);

            const container = document.getElementById('tomesContainer');
            expect(container.querySelector('.tome-graph-container')).not.toBeNull();
        });

        it('should set entity data attributes', () => {
            renderTomes(mockTomes);

            const card = document.querySelector('.tome-card');
            expect(card.dataset.entityType).toBe('tome');
            expect(card.dataset.entityId).toBe('tome1');
        });

        it('should render empty state when no tomes', () => {
            renderTomes([]);

            const container = document.getElementById('tomesContainer');
            expect(container.innerHTML).toContain('empty-state');
        });

        it('should show placeholder for tomes without valid progression data', () => {
            const tomeWithoutProgression = [
                {
                    id: 'tome2',
                    name: 'Mystery Tome',
                    tier: 'B',
                    priority: 3,
                    stat_affected: 'Unknown',
                    value_per_level: null,
                    description: 'Unknown effect',
                },
            ];
            renderTomes(tomeWithoutProgression);

            const container = document.getElementById('tomesContainer');
            const placeholder = container.querySelector('.tome-graph-placeholder');
            expect(placeholder).not.toBeNull();
            expect(placeholder.textContent).toContain('No progression data');
        });

        it('should show placeholder for tomes with non-numeric value_per_level', () => {
            const tomeWithTextOnly = [
                {
                    id: 'tome3',
                    name: 'Text Tome',
                    tier: 'C',
                    priority: 5,
                    stat_affected: 'Special',
                    value_per_level: 'Variable effect',
                    description: 'Effect varies',
                },
            ];
            renderTomes(tomeWithTextOnly);

            const container = document.getElementById('tomesContainer');
            const placeholder = container.querySelector('.tome-graph-placeholder');
            expect(placeholder).not.toBeNull();
        });

        it('should show graph container for tomes with valid numeric value_per_level', () => {
            const tomeWithProgression = [
                {
                    id: 'tome4',
                    name: 'Numeric Tome',
                    tier: 'A',
                    priority: 2,
                    stat_affected: 'Damage',
                    value_per_level: '+10% damage',
                    description: 'Increases damage',
                },
            ];
            renderTomes(tomeWithProgression);

            const container = document.getElementById('tomesContainer');
            expect(container.querySelector('.tome-graph-container')).not.toBeNull();
            expect(container.querySelector('.tome-graph-placeholder')).toBeNull();
        });
    });

    describe('renderCharacters()', () => {
        const mockCharacters = [
            {
                id: 'char1',
                name: 'Hero',
                tier: 'S',
                passive_ability: 'Fury',
                passive_description: 'Increases damage when low HP',
                starting_weapon: 'Sword',
                playstyle: 'Aggressive',
            },
        ];

        it('should render character cards', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.querySelectorAll('.character-card').length).toBe(1);
        });

        it('should include character name', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('Hero');
        });

        it('should include passive ability', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('Fury');
        });

        it('should include passive description', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('Increases damage when low HP');
        });

        it('should include starting weapon meta tag', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('Sword');
        });

        it('should include playstyle meta tag', () => {
            renderCharacters(mockCharacters);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('Aggressive');
        });

        it('should set entity data attributes', () => {
            renderCharacters(mockCharacters);

            const card = document.querySelector('.character-card');
            expect(card.dataset.entityType).toBe('character');
            expect(card.dataset.entityId).toBe('char1');
        });

        it('should render empty state when no characters', () => {
            renderCharacters([]);

            const container = document.getElementById('charactersContainer');
            expect(container.innerHTML).toContain('empty-state');
        });
    });

    describe('renderShrines()', () => {
        const mockShrines = [
            {
                id: 'shrine1',
                name: 'Power Shrine',
                icon: '⚡',
                type: 'stat_upgrade',
                description: 'Increases power',
                reward: '+10 power',
                reusable: true,
            },
        ];

        it('should render shrine cards', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.querySelectorAll('.shrine-card').length).toBe(1);
        });

        it('should include shrine name', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('Power Shrine');
        });

        it('should include shrine icon', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('⚡');
        });

        it('should include shrine type', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('stat upgrade');
        });

        it('should include reward', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('+10 power');
        });

        it('should show Reusable tag when reusable', () => {
            renderShrines(mockShrines);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('Reusable');
        });

        it('should show One-time tag when not reusable', () => {
            const nonReusable = [{ ...mockShrines[0], reusable: false }];
            renderShrines(nonReusable);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('One-time');
        });

        it('should set entity data attributes', () => {
            renderShrines(mockShrines);

            const card = document.querySelector('.shrine-card');
            expect(card.dataset.entityType).toBe('shrine');
            expect(card.dataset.entityId).toBe('shrine1');
        });

        it('should render empty state when no shrines', () => {
            renderShrines([]);

            const container = document.getElementById('shrinesContainer');
            expect(container.innerHTML).toContain('empty-state');
        });
    });

    describe('Container handling', () => {
        it('should not throw when container is missing', () => {
            document.getElementById('itemsContainer')?.remove();

            expect(() => renderItems([{ id: '1', name: 'Test' }])).not.toThrow();
        });

        it('should clear container before rendering', () => {
            const container = document.getElementById('itemsContainer');
            container.innerHTML = '<div>Old content</div>';

            renderItems([
                {
                    id: 'item1',
                    name: 'New Item',
                    rarity: 'common',
                    tier: 'A',
                    base_effect: 'Effect',
                    detailed_description: 'Description',
                },
            ]);

            expect(container.innerHTML).not.toContain('Old content');
            expect(container.innerHTML).toContain('New Item');
        });
    });
});
