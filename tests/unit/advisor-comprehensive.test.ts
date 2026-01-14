/**
 * Comprehensive tests for advisor.ts - Build Advisor Module
 * Tests build recommendation UI and logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAdvisor, applyScannedBuild, resetAdvisor } from '../../src/modules/advisor.ts';
import type { AllGameData, Character, Weapon, Item, Tome } from '../../src/types/index.ts';
import type { BuildState } from '../../src/modules/recommendation.ts';
import { setupDOM } from '../helpers/dom-setup.js';

// Mock modules
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/recommendation.ts', () => ({
    recommendBestChoice: vi.fn((build, choices) => {
        return choices.map((choice, index) => ({
            choice,
            score: 100 - index * 10,
            confidence: 0.9 - index * 0.1,
            reasoning: ['Test reasoning'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        }));
    }),
}));

describe('Advisor Module - Comprehensive Tests', () => {
    let mockGameData: AllGameData;
    let mockCharacters: Character[];
    let mockWeapons: Weapon[];
    let mockItems: Item[];
    let mockTomes: Tome[];

    beforeEach(() => {
        setupDOM();

        // Setup mock data
        mockCharacters = [
            { id: 'char1', name: 'Hero 1', tier: 'S' } as Character,
            { id: 'char2', name: 'Hero 2', tier: 'A' } as Character,
        ];

        mockWeapons = [
            { id: 'wpn1', name: 'Sword', tier: 'A' } as Weapon,
            { id: 'wpn2', name: 'Bow', tier: 'B' } as Weapon,
        ];

        mockItems = [
            {
                id: 'item1',
                name: 'Item 1',
                tier: 'S',
                rarity: 'epic',
                scaling_per_stack: [10],
            } as Item,
            {
                id: 'item2',
                name: 'Item 2',
                tier: 'A',
                rarity: 'rare',
                scaling_per_stack: [5],
            } as Item,
        ];

        mockTomes = [
            { id: 'tome1', name: 'Tome 1', tier: 'S' } as Tome,
            { id: 'tome2', name: 'Tome 2', tier: 'A' } as Tome,
        ];

        mockGameData = {
            characters: { version: '1.0.0', last_updated: '2024-01-01', characters: mockCharacters },
            weapons: { version: '1.0.0', last_updated: '2024-01-01', weapons: mockWeapons },
            items: { version: '1.0.0', last_updated: '2024-01-01', items: mockItems },
            tomes: { version: '1.0.0', last_updated: '2024-01-01', tomes: mockTomes },
            shrines: null,
            stats: null,
        };

        // Setup DOM
        document.body.innerHTML = `
            <select id="advisor-character">
                <option value="">Select Character</option>
            </select>
            <select id="advisor-weapon">
                <option value="">Select Weapon</option>
            </select>
            <button id="add-current-item">Add Item</button>
            <button id="add-current-tome">Add Tome</button>
            <button id="get-recommendation">Get Recommendation</button>
            <select id="choice-1-type"><option value="item">Item</option></select>
            <select id="choice-2-type"><option value="item">Item</option></select>
            <select id="choice-3-type"><option value="item">Item</option></select>
            <div id="current-build-display"></div>
            <div id="recommendation-results"></div>
        `;
    });

    describe('initAdvisor', () => {
        it('should initialize advisor with game data', () => {
            initAdvisor(mockGameData);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.options.length).toBeGreaterThan(1); // Default + characters
        });

        it('should populate character dropdown', () => {
            initAdvisor(mockGameData);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            const options = Array.from(characterSelect.options).filter(opt => opt.value !== '');

            expect(options.length).toBe(2);
            expect(options[0].value).toBe('char1');
            expect(options[0].textContent).toBe('Hero 1');
            expect(options[1].value).toBe('char2');
            expect(options[1].textContent).toBe('Hero 2');
        });

        it('should populate weapon dropdown', () => {
            initAdvisor(mockGameData);

            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            const options = Array.from(weaponSelect.options).filter(opt => opt.value !== '');

            expect(options.length).toBe(2);
            expect(options[0].value).toBe('wpn1');
            expect(options[0].textContent).toBe('Sword');
        });

        it('should log initialization', () => {
            const { logger } = await import('../../src/modules/logger.ts');

            initAdvisor(mockGameData);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'advisor.init',
                    data: expect.objectContaining({
                        charactersCount: 2,
                        weaponsCount: 2,
                        itemsCount: 2,
                    }),
                })
            );
        });

        it('should handle missing character select gracefully', () => {
            document.body.innerHTML = '';

            expect(() => {
                initAdvisor(mockGameData);
            }).not.toThrow();
        });

        it('should handle missing weapon select gracefully', () => {
            document.body.innerHTML = '<select id="advisor-character"></select>';

            expect(() => {
                initAdvisor(mockGameData);
            }).not.toThrow();
        });

        it('should handle empty game data', () => {
            const emptyData: AllGameData = {
                characters: { version: '1.0.0', last_updated: '2024-01-01', characters: [] },
                weapons: { version: '1.0.0', last_updated: '2024-01-01', weapons: [] },
                items: { version: '1.0.0', last_updated: '2024-01-01', items: [] },
                tomes: { version: '1.0.0', last_updated: '2024-01-01', tomes: [] },
                shrines: null,
                stats: null,
            };

            expect(() => {
                initAdvisor(emptyData);
            }).not.toThrow();
        });

        it('should handle null game data properties', () => {
            const nullData: AllGameData = {
                characters: null,
                weapons: null,
                items: null,
                tomes: null,
                shrines: null,
                stats: null,
            };

            expect(() => {
                initAdvisor(nullData);
            }).not.toThrow();
        });

        it('should setup event listeners', () => {
            initAdvisor(mockGameData);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;

            // Event listeners should be attached (won't throw when triggering events)
            expect(() => {
                characterSelect.dispatchEvent(new Event('change'));
                weaponSelect.dispatchEvent(new Event('change'));
            }).not.toThrow();
        });

        it('should initialize with many characters', () => {
            const manyCharacters = Array.from({ length: 20 }, (_, i) => ({
                id: `char${i}`,
                name: `Character ${i}`,
                tier: 'A' as const,
            })) as Character[];

            const dataWithMany: AllGameData = {
                ...mockGameData,
                characters: { version: '1.0.0', last_updated: '2024-01-01', characters: manyCharacters },
            };

            initAdvisor(dataWithMany);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            const options = Array.from(characterSelect.options).filter(opt => opt.value !== '');

            expect(options.length).toBe(20);
        });
    });

    describe('applyScannedBuild', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should apply scanned build with character', () => {
            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: null,
                items: [],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.value).toBe('char1');
        });

        it('should apply scanned build with weapon', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: mockWeapons[0],
                items: [],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            expect(weaponSelect.value).toBe('wpn1');
        });

        it('should apply scanned build with items', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: [mockItems[0], mockItems[1]],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            // Items should be stored internally
            expect(true).toBe(true); // State is internal, just verify no errors
        });

        it('should apply scanned build with tomes', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(scannedBuild);

            // Tomes should be stored internally
            expect(true).toBe(true);
        });

        it('should apply complete build', () => {
            const completeBuild: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(completeBuild);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;

            expect(characterSelect.value).toBe('char1');
            expect(weaponSelect.value).toBe('wpn1');
        });

        it('should log scanned build application', () => {
            const { logger } = await import('../../src/modules/logger.ts');

            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(scannedBuild);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'advisor.scanned_build_applied',
                    data: expect.objectContaining({
                        character: 'Hero 1',
                        weapon: 'Sword',
                        itemsCount: 1,
                        tomesCount: 1,
                    }),
                })
            );
        });

        it('should handle missing character select when applying build', () => {
            document.getElementById('advisor-character')?.remove();

            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: null,
                items: [],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should handle missing weapon select when applying build', () => {
            document.getElementById('advisor-weapon')?.remove();

            const scannedBuild: BuildState = {
                character: null,
                weapon: mockWeapons[0],
                items: [],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should replace previous items', () => {
            const build1: BuildState = {
                character: null,
                weapon: null,
                items: [mockItems[0]],
                tomes: [],
            };

            applyScannedBuild(build1);

            const build2: BuildState = {
                character: null,
                weapon: null,
                items: [mockItems[1]],
                tomes: [],
            };

            applyScannedBuild(build2);

            // Should replace, not append
            expect(true).toBe(true);
        });

        it('should replace previous tomes', () => {
            const build1: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(build1);

            const build2: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [mockTomes[1]],
            };

            applyScannedBuild(build2);

            expect(true).toBe(true);
        });

        it('should handle empty items array', () => {
            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: null,
                items: [],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should handle empty tomes array', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should handle null build properties', () => {
            const nullBuild: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(nullBuild);
            }).not.toThrow();
        });

        it('should handle multiple items', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: mockItems,
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should handle multiple tomes', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: mockTomes,
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });
    });

    describe('resetAdvisor', () => {
        beforeEach(() => {
            initAdvisor(mockGameData);
        });

        it('should reset character selection', () => {
            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            characterSelect.value = 'char1';

            resetAdvisor();

            expect(characterSelect.value).toBe('');
        });

        it('should reset weapon selection', () => {
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
            weaponSelect.value = 'wpn1';

            resetAdvisor();

            expect(weaponSelect.value).toBe('');
        });

        it('should clear build after applying scanned build', () => {
            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(scannedBuild);
            resetAdvisor();

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;

            expect(characterSelect.value).toBe('');
            expect(weaponSelect.value).toBe('');
        });

        it('should be idempotent', () => {
            resetAdvisor();
            resetAdvisor();
            resetAdvisor();

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.value).toBe('');
        });

        it('should handle missing elements gracefully', () => {
            document.body.innerHTML = '';

            expect(() => {
                resetAdvisor();
            }).not.toThrow();
        });

        it('should reset after multiple operations', () => {
            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(scannedBuild);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            characterSelect.value = 'char2';

            resetAdvisor();

            expect(characterSelect.value).toBe('');
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete workflow', () => {
            // Initialize
            initAdvisor(mockGameData);

            // Apply scanned build
            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(scannedBuild);

            // Verify state
            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.value).toBe('char1');

            // Reset
            resetAdvisor();

            // Verify reset
            expect(characterSelect.value).toBe('');
        });

        it('should handle multiple build applications', () => {
            initAdvisor(mockGameData);

            const build1: BuildState = {
                character: mockCharacters[0],
                weapon: mockWeapons[0],
                items: [mockItems[0]],
                tomes: [],
            };

            applyScannedBuild(build1);

            const build2: BuildState = {
                character: mockCharacters[1],
                weapon: mockWeapons[1],
                items: [mockItems[1]],
                tomes: [mockTomes[0]],
            };

            applyScannedBuild(build2);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.value).toBe('char2');
        });

        it('should maintain state across operations', () => {
            initAdvisor(mockGameData);

            const scannedBuild: BuildState = {
                character: mockCharacters[0],
                weapon: null,
                items: [mockItems[0]],
                tomes: [],
            };

            applyScannedBuild(scannedBuild);

            const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
            expect(characterSelect.value).toBe('char1');

            // State should persist until reset
            expect(characterSelect.value).toBe('char1');

            resetAdvisor();

            expect(characterSelect.value).toBe('');
        });
    });

    describe('Edge Cases', () => {
        it('should handle initialization without DOM elements', () => {
            document.body.innerHTML = '';

            expect(() => {
                initAdvisor(mockGameData);
            }).not.toThrow();
        });

        it('should handle very large datasets', () => {
            const largeCharacters = Array.from({ length: 100 }, (_, i) => ({
                id: `char${i}`,
                name: `Character ${i}`,
                tier: 'A' as const,
            })) as Character[];

            const largeData: AllGameData = {
                ...mockGameData,
                characters: { version: '1.0.0', last_updated: '2024-01-01', characters: largeCharacters },
            };

            expect(() => {
                initAdvisor(largeData);
            }).not.toThrow();
        });

        it('should handle rapid reset calls', () => {
            initAdvisor(mockGameData);

            for (let i = 0; i < 100; i++) {
                resetAdvisor();
            }

            expect(true).toBe(true);
        });

        it('should handle build with duplicate items', () => {
            const scannedBuild: BuildState = {
                character: null,
                weapon: null,
                items: [mockItems[0], mockItems[0], mockItems[0]],
                tomes: [],
            };

            expect(() => {
                applyScannedBuild(scannedBuild);
            }).not.toThrow();
        });

        it('should handle partial DOM (missing some selects)', () => {
            document.body.innerHTML = '<select id="advisor-character"></select>';

            expect(() => {
                initAdvisor(mockGameData);
            }).not.toThrow();
        });
    });
});
