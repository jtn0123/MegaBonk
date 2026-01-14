import { describe, it, expect } from 'vitest';
import { detectSynergies, detectAntiSynergies, type BuildState } from '../../src/modules/synergy.ts';

describe('synergy module', () => {
    describe('detectSynergies', () => {
        it('should detect character-weapon synergy', () => {
            const build: BuildState = {
                character: {
                    id: 'hero',
                    name: 'Hero',
                    synergies_weapons: ['Sword'],
                } as any,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(1);
            expect(synergies[0].type).toBe('character-weapon');
            expect(synergies[0].source).toBe('Hero');
            expect(synergies[0].target).toBe('Sword');
        });

        it('should not detect character-weapon synergy when not in list', () => {
            const build: BuildState = {
                character: {
                    id: 'hero',
                    name: 'Hero',
                    synergies_weapons: ['Axe'],
                } as any,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(0);
        });

        it('should detect item-weapon synergy', () => {
            const build: BuildState = {
                character: null,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies_weapons: ['Sword'],
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(1);
            expect(synergies[0].type).toBe('item-weapon');
            expect(synergies[0].source).toBe('Item 1');
            expect(synergies[0].target).toBe('Sword');
        });

        it('should detect multiple item-weapon synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies_weapons: ['Sword'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                        synergies_weapons: ['Sword'],
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(2);
            expect(synergies.every(s => s.type === 'item-weapon')).toBe(true);
        });

        it('should detect item-character synergy', () => {
            const build: BuildState = {
                character: {
                    id: 'hero',
                    name: 'Hero',
                    synergies_items: ['item1'],
                } as any,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(1);
            expect(synergies[0].type).toBe('item-character');
            expect(synergies[0].source).toBe('Item 1');
            expect(synergies[0].target).toBe('Hero');
        });

        it('should detect item-item synergy by name', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(1);
            expect(synergies[0].type).toBe('item-item');
            expect(synergies[0].source).toBe('Item 1');
            expect(synergies[0].target).toBe('Item 2');
        });

        it('should detect item-item synergy by id', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies: ['item2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(1);
            expect(synergies[0].type).toBe('item-item');
        });

        it('should detect all synergy types together', () => {
            const build: BuildState = {
                character: {
                    id: 'hero',
                    name: 'Hero',
                    synergies_weapons: ['Sword'],
                    synergies_items: ['item1'],
                } as any,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies_weapons: ['Sword'],
                        synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(4);
            expect(synergies.find(s => s.type === 'character-weapon')).toBeDefined();
            expect(synergies.find(s => s.type === 'item-weapon')).toBeDefined();
            expect(synergies.find(s => s.type === 'item-character')).toBeDefined();
            expect(synergies.find(s => s.type === 'item-item')).toBeDefined();
        });

        it('should return empty array for empty build', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(0);
        });

        it('should handle missing synergies_weapons property', () => {
            const build: BuildState = {
                character: {
                    id: 'hero',
                    name: 'Hero',
                } as any,
                weapon: {
                    id: 'sword',
                    name: 'Sword',
                } as any,
                tomes: [],
                items: [],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(0);
        });

        it('should handle items without synergies property', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(0);
        });

        it('should not create duplicate item-item synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                        synergies: ['Item 1'],
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            // Should only detect one synergy (from item1 to item2)
            // not the reverse (item2 to item1) since we check only forward
            expect(synergies.length).toBe(1);
        });

        it('should handle three items with chain synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                        synergies: ['Item 3'],
                    } as any,
                    {
                        id: 'item3',
                        name: 'Item 3',
                    } as any,
                ],
            };

            const synergies = detectSynergies(build);
            expect(synergies.length).toBe(2);
        });
    });

    describe('detectAntiSynergies', () => {
        it('should detect item-item anti-synergy by name', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(1);
            expect(antiSynergies[0].type).toBe('item-item');
            expect(antiSynergies[0].source).toBe('Item 1');
            expect(antiSynergies[0].target).toBe('Item 2');
            expect(antiSynergies[0].message).toContain('conflicts');
        });

        it('should detect anti-synergy by id', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: ['item2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(1);
        });

        it('should detect mutual anti-synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: ['Item 2'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                        anti_synergies: ['Item 1'],
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            // Both items have anti-synergy with each other
            expect(antiSynergies.length).toBe(2);
        });

        it('should return empty array for build without anti-synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(0);
        });

        it('should handle empty anti_synergies array', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: [],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(0);
        });

        it('should not detect anti-synergy with self', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: ['Item 1'],
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(0);
        });

        it('should handle multiple items with multiple anti-synergies', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        anti_synergies: ['Item 2', 'Item 3'],
                    } as any,
                    {
                        id: 'item2',
                        name: 'Item 2',
                    } as any,
                    {
                        id: 'item3',
                        name: 'Item 3',
                    } as any,
                ],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(2);
        });

        it('should return empty array for empty build', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const antiSynergies = detectAntiSynergies(build);
            expect(antiSynergies.length).toBe(0);
        });
    });
});
