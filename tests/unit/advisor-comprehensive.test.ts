// ========================================
// Advisor Module Comprehensive Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData, createMockItem, createMockWeapon, createMockCharacter, createMockTome, createMockShrine } from '../helpers/mock-data.js';

// Mock modules
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
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

// Mock recommendation module
vi.mock('../../src/modules/recommendation.ts', () => ({
    recommendBestChoice: vi.fn((build, choices) => {
        // Return mock recommendations sorted by tier
        return choices.map((choice: any, index: number) => ({
            choice,
            score: 100 - index * 20,
            confidence: 0.9 - index * 0.1,
            reasoning: [`Tier ${choice.entity.tier} item`],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        }));
    }),
}));

import { initAdvisor, applyScannedBuild, resetAdvisor } from '../../src/modules/advisor.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';
import { recommendBestChoice } from '../../src/modules/recommendation.ts';

describe('Advisor Module', () => {
    let mockGameData: any;

    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();

        // Add advisor-specific DOM elements
        document.body.innerHTML += `
            <select id="advisor-character">
                <option value="">Select Character...</option>
            </select>
            <select id="advisor-weapon">
                <option value="">Select Weapon...</option>
            </select>
            <div id="advisor-current-items"></div>
            <div id="advisor-current-tomes"></div>
            <button id="add-current-item">Add Item</button>
            <button id="add-current-tome">Add Tome</button>
            <select id="choice-1-type"><option value="">Select...</option><option value="item">Item</option><option value="weapon">Weapon</option><option value="tome">Tome</option><option value="shrine">Shrine</option></select>
            <select id="choice-1-entity"><option value="">Select...</option></select>
            <select id="choice-2-type"><option value="">Select...</option><option value="item">Item</option></select>
            <select id="choice-2-entity"><option value="">Select...</option></select>
            <select id="choice-3-type"><option value="">Select...</option><option value="item">Item</option></select>
            <select id="choice-3-entity"><option value="">Select...</option></select>
            <button id="get-recommendation">Get Recommendation</button>
            <div id="advisor-results" style="display: none;">
                <div id="advisor-results-content"></div>
            </div>
        `;

        // Setup mock game data
        mockGameData = createMockAllData();
        mockGameData.characters.characters = [
            createMockCharacter({ id: 'char-1', name: 'Character 1', tier: 'S' }),
            createMockCharacter({ id: 'char-2', name: 'Character 2', tier: 'A' }),
        ];
        mockGameData.weapons.weapons = [
            createMockWeapon({ id: 'weapon-1', name: 'Weapon 1', tier: 'S' }),
            createMockWeapon({ id: 'weapon-2', name: 'Weapon 2', tier: 'A' }),
        ];
        mockGameData.items.items = [
            createMockItem({ id: 'item-1', name: 'Item 1', tier: 'SS' }),
            createMockItem({ id: 'item-2', name: 'Item 2', tier: 'S' }),
            createMockItem({ id: 'item-3', name: 'Item 3', tier: 'A' }),
        ];
        mockGameData.tomes.tomes = [
            createMockTome({ id: 'tome-1', name: 'Tome 1', tier: 'S' }),
            createMockTome({ id: 'tome-2', name: 'Tome 2', tier: 'A' }),
        ];
        mockGameData.shrines.shrines = [
            createMockShrine({ id: 'shrine-1', name: 'Shrine 1', tier: 'A' }),
        ];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initAdvisor', () => {
        it('should populate character dropdown', () => {
            initAdvisor(mockGameData);

            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(charSelect.innerHTML).toContain('Character 1');
            expect(charSelect.innerHTML).toContain('Character 2');
        });

        it('should populate weapon dropdown', () => {
            initAdvisor(mockGameData);

            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            expect(weaponSelect.innerHTML).toContain('Weapon 1');
            expect(weaponSelect.innerHTML).toContain('Weapon 2');
        });

        it('should log initialization with counts', () => {
            initAdvisor(mockGameData);

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.init',
                data: expect.objectContaining({
                    charactersCount: 2,
                    weaponsCount: 2,
                    itemsCount: 3,
                }),
            }));
        });

        it('should handle missing characters gracefully', () => {
            mockGameData.characters = undefined;

            expect(() => initAdvisor(mockGameData)).not.toThrow();
        });

        it('should handle missing weapons gracefully', () => {
            mockGameData.weapons = undefined;

            expect(() => initAdvisor(mockGameData)).not.toThrow();
        });

        it('should setup event listeners', () => {
            initAdvisor(mockGameData);

            // Verify character select has listener by changing value
            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            charSelect.value = 'char-1';
            charSelect.dispatchEvent(new Event('change'));

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.character_selected',
            }));
        });
    });

    describe('applyScannedBuild', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should set character from scanned build', () => {
            const scannedBuild = {
                character: createMockCharacter({ id: 'char-1', name: 'Character 1' }),
                weapon: null,
                items: [],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(charSelect.value).toBe('char-1');
        });

        it('should set weapon from scanned build', () => {
            const scannedBuild = {
                character: null,
                weapon: createMockWeapon({ id: 'weapon-1', name: 'Weapon 1' }),
                items: [],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            expect(weaponSelect.value).toBe('weapon-1');
        });

        it('should set items from scanned build', () => {
            const scannedBuild = {
                character: null,
                weapon: null,
                items: [
                    createMockItem({ id: 'item-1', name: 'Item 1' }),
                    createMockItem({ id: 'item-2', name: 'Item 2' }),
                ],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            // Items should be displayed in the current items container
            const itemsContainer = document.getElementById('advisor-current-items');
            expect(itemsContainer?.innerHTML).toContain('Item 1');
            expect(itemsContainer?.innerHTML).toContain('Item 2');
        });

        it('should set tomes from scanned build', () => {
            const scannedBuild = {
                character: null,
                weapon: null,
                items: [],
                tomes: [
                    createMockTome({ id: 'tome-1', name: 'Tome 1' }),
                ],
            };

            applyScannedBuild(scannedBuild);

            // Tomes should be displayed in the current tomes container
            const tomesContainer = document.getElementById('advisor-current-tomes');
            expect(tomesContainer?.innerHTML).toContain('Tome 1');
        });

        it('should log scanned build application', () => {
            const scannedBuild = {
                character: createMockCharacter({ id: 'char-1', name: 'Character 1' }),
                weapon: createMockWeapon({ id: 'weapon-1', name: 'Weapon 1' }),
                items: [createMockItem({ id: 'item-1', name: 'Item 1' })],
                tomes: [createMockTome({ id: 'tome-1', name: 'Tome 1' })],
            };

            applyScannedBuild(scannedBuild);

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.scanned_build_applied',
                data: expect.objectContaining({
                    character: 'Character 1',
                    weapon: 'Weapon 1',
                    itemsCount: 1,
                    tomesCount: 1,
                }),
            }));
        });
    });

    describe('resetAdvisor', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should clear character selection', () => {
            // First set a character
            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            charSelect.value = 'char-1';

            resetAdvisor();

            expect(charSelect.value).toBe('');
        });

        it('should clear weapon selection', () => {
            // First set a weapon
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            weaponSelect.value = 'weapon-1';

            resetAdvisor();

            expect(weaponSelect.value).toBe('');
        });

        it('should clear choice type selections', () => {
            // Set choice types
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';

            resetAdvisor();

            expect(choice1Type.value).toBe('');
        });

        it('should hide results', () => {
            const resultsDiv = document.getElementById('advisor-results');
            resultsDiv!.style.display = 'block';

            resetAdvisor();

            expect(resultsDiv?.style.display).toBe('none');
        });
    });

    describe('Character Selection', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should update current build when character selected', () => {
            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            charSelect.value = 'char-1';
            charSelect.dispatchEvent(new Event('change'));

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.character_selected',
                data: expect.objectContaining({
                    character: 'Character 1',
                }),
            }));
        });

        it('should clear character when empty option selected', () => {
            const charSelect = document.getElementById('advisor-character') as HTMLSelectElement;

            // First select a character
            charSelect.value = 'char-1';
            charSelect.dispatchEvent(new Event('change'));

            // Then deselect
            charSelect.value = '';
            charSelect.dispatchEvent(new Event('change'));

            // Logger should only log the selection, not the deselection
            const selectCalls = vi.mocked(logger.info).mock.calls.filter(
                (call: any) => call[0]?.operation === 'advisor.character_selected'
            );
            expect(selectCalls.length).toBe(1);
        });
    });

    describe('Weapon Selection', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should update current build when weapon selected', () => {
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            weaponSelect.value = 'weapon-1';
            weaponSelect.dispatchEvent(new Event('change'));

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.weapon_selected',
                data: expect.objectContaining({
                    weapon: 'Weapon 1',
                }),
            }));
        });
    });

    describe('Choice Type Change', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should populate entity dropdown when item type selected', () => {
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            expect(choice1Entity.innerHTML).toContain('Item 1');
            expect(choice1Entity.innerHTML).toContain('Item 2');
        });

        it('should populate entity dropdown when weapon type selected', () => {
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'weapon';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            expect(choice1Entity.innerHTML).toContain('Weapon 1');
        });

        it('should populate entity dropdown when tome type selected', () => {
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'tome';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            expect(choice1Entity.innerHTML).toContain('Tome 1');
        });

        it('should populate entity dropdown when shrine type selected', () => {
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'shrine';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            expect(choice1Entity.innerHTML).toContain('Shrine 1');
        });

        it('should clear entity dropdown when empty type selected', () => {
            // First select a type
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));

            // Then clear
            choice1Type.value = '';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            // Should only have the placeholder option
            expect(choice1Entity.options.length).toBe(1);
        });
    });

    describe('Get Recommendation', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should show error when less than 2 choices selected', () => {
            const recommendBtn = document.getElementById('get-recommendation');
            recommendBtn?.click();

            expect(ToastManager.error).toHaveBeenCalledWith(
                expect.stringContaining('at least 2 choices')
            );
        });

        it('should call recommendBestChoice with choices', () => {
            // Setup choice 1
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));

            const choice1Entity = document.getElementById('choice-1-entity') as HTMLSelectElement;
            choice1Entity.value = 'item-1';

            // Setup choice 2
            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));

            const choice2Entity = document.getElementById('choice-2-entity') as HTMLSelectElement;
            choice2Entity.value = 'item-2';

            // Get recommendation
            const recommendBtn = document.getElementById('get-recommendation');
            recommendBtn?.click();

            expect(recommendBestChoice).toHaveBeenCalled();
        });

        it('should display recommendations', () => {
            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            // Get recommendation
            document.getElementById('get-recommendation')?.click();

            // Check results are displayed
            const resultsDiv = document.getElementById('advisor-results');
            expect(resultsDiv?.style.display).toBe('block');

            const resultsContent = document.getElementById('advisor-results-content');
            expect(resultsContent?.innerHTML).toContain('RECOMMENDED');
        });

        it('should log after recommendation generation', () => {
            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            document.getElementById('get-recommendation')?.click();

            // Should have logged at least the init and the recommendation
            expect(logger.info).toHaveBeenCalled();
        });

        it('should handle recommendation errors', () => {
            vi.mocked(recommendBestChoice).mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            document.getElementById('get-recommendation')?.click();

            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'advisor.recommendation_error',
            }));
            expect(ToastManager.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to generate')
            );
        });
    });

    describe('Add Item Modal', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should open item modal when add item clicked', () => {
            const addItemBtn = document.getElementById('add-current-item');
            addItemBtn?.click();

            // Modal should be added to body
            const modal = document.querySelector('.advisor-entity-modal');
            expect(modal).not.toBeNull();
        });

        it('should close modal when clicking outside', () => {
            const addItemBtn = document.getElementById('add-current-item');
            addItemBtn?.click();

            const modal = document.querySelector('.advisor-entity-modal') as HTMLElement;
            modal?.click(); // Click on modal backdrop

            // Modal should be removed
            expect(document.querySelector('.advisor-entity-modal')).toBeNull();
        });

        it('should add item when entity card clicked', () => {
            const addItemBtn = document.getElementById('add-current-item');
            addItemBtn?.click();

            // Click first entity card
            const entityCard = document.querySelector('.advisor-entity-card') as HTMLButtonElement;
            entityCard?.click();

            expect(ToastManager.success).toHaveBeenCalledWith(expect.stringContaining('Added'));
        });
    });

    describe('Add Tome Modal', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should open tome modal when add tome clicked', () => {
            const addTomeBtn = document.getElementById('add-current-tome');
            addTomeBtn?.click();

            const modal = document.querySelector('.advisor-entity-modal');
            expect(modal).not.toBeNull();
        });
    });

    describe('Entity Chips', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should remove item when chip remove button clicked', () => {
            // Add an item first
            const addItemBtn = document.getElementById('add-current-item');
            addItemBtn?.click();

            const entityCard = document.querySelector('.advisor-entity-card') as HTMLButtonElement;
            entityCard?.click();

            // Now remove it
            const removeBtn = document.querySelector('.chip-remove') as HTMLButtonElement;
            removeBtn?.click();

            // Item should be removed from display
            const itemsContainer = document.getElementById('advisor-current-items');
            expect(itemsContainer?.innerHTML).not.toContain('Item 1');
        });
    });

    describe('Recommendation Display', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should show "No recommendations" for empty results', () => {
            vi.mocked(recommendBestChoice).mockReturnValueOnce([]);

            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            document.getElementById('get-recommendation')?.click();

            const resultsContent = document.getElementById('advisor-results-content');
            expect(resultsContent?.innerHTML).toContain('No recommendations');
        });

        it('should display reasoning for recommendations', () => {
            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            document.getElementById('get-recommendation')?.click();

            const resultsContent = document.getElementById('advisor-results-content');
            expect(resultsContent?.innerHTML).toContain('Why?');
        });

        it('should scroll to results after displaying', () => {
            // Mock scrollIntoView on the results element
            const resultsDiv = document.getElementById('advisor-results');
            const scrollIntoViewMock = vi.fn();
            if (resultsDiv) {
                resultsDiv.scrollIntoView = scrollIntoViewMock;
            }

            // Setup choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            document.getElementById('get-recommendation')?.click();

            expect(scrollIntoViewMock).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: 'smooth' })
            );
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should handle missing DOM elements gracefully', () => {
            document.getElementById('advisor-character')?.remove();

            // Should not throw when trying to init
            expect(() => initAdvisor(mockGameData)).not.toThrow();
        });

        it('should handle empty game data gracefully', () => {
            const emptyGameData = {
                characters: { characters: [] },
                weapons: { weapons: [] },
                items: { items: [] },
                tomes: { tomes: [] },
                shrines: { shrines: [] },
            };

            expect(() => initAdvisor(emptyGameData)).not.toThrow();
        });

        it('should handle third choice being optional', () => {
            // Setup only 2 choices
            const choice1Type = document.getElementById('choice-1-type') as HTMLSelectElement;
            choice1Type.value = 'item';
            choice1Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-1-entity') as HTMLSelectElement).value = 'item-1';

            const choice2Type = document.getElementById('choice-2-type') as HTMLSelectElement;
            choice2Type.value = 'item';
            choice2Type.dispatchEvent(new Event('change'));
            (document.getElementById('choice-2-entity') as HTMLSelectElement).value = 'item-2';

            // Third choice left empty - should still work
            document.getElementById('get-recommendation')?.click();

            expect(recommendBestChoice).toHaveBeenCalled();
            expect(ToastManager.error).not.toHaveBeenCalledWith(
                expect.stringContaining('Please select at least 2')
            );
        });
    });
});
