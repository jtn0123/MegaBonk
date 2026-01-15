/**
 * Recommendation Engine - Additional Edge Cases and Boundary Tests
 * Testing extreme scenarios, null handling, and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
} from '../../src/modules/recommendation';
import type { Item, Weapon, Tome, Character } from '../../src/types';

describe('Recommendation Engine - Null and Undefined Handling', () => {
    it('should handle null character name', () => {
        const character: Character = {
            id: 'char1',
            name: null as any,
            tier: 'A',
            rarity: 'common',
            passive: 'Test',
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle undefined synergies arrays', () => {
        const character: Character = {
            id: 'char1',
            name: 'Test',
            tier: 'A',
            rarity: 'common',
            passive: 'Test',
            synergies_items: undefined,
            synergies_weapons: undefined,
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle null item name', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: null as any,
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'damage',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Test',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle undefined base_effect and description', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Test',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: undefined,
                    description: undefined,
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Test2',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle tome with null stat_affected', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [
                {
                    id: 'tome1',
                    name: 'Test Tome',
                    tier: 'A',
                    rarity: 'rare',
                    effect: 'Test',
                    stat_affected: null as any,
                } as Tome,
            ],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });
});

describe('Recommendation Engine - Extreme Build Sizes', () => {
    it('should handle build with maximum items (20+)', () => {
        const items: Item[] = [];
        for (let i = 0; i < 25; i++) {
            items.push({
                id: `item${i}`,
                name: `Item ${i}`,
                tier: 'A',
                rarity: 'common',
                effects: ['damage'],
                base_effect: 'damage boost',
            } as Item);
        }

        const build: BuildState = {
            character: null,
            weapon: null,
            items,
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'new',
                    name: 'New Item',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations).toHaveLength(1);
        // Should NOT give early game bonus with 25 items
        expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(false);
    });

    it('should handle build with maximum tomes (10+)', () => {
        const tomes: Tome[] = [];
        for (let i = 0; i < 12; i++) {
            tomes.push({
                id: `tome${i}`,
                name: `Tome ${i}`,
                tier: 'S',
                rarity: 'rare',
                effect: 'Boost',
                stat_affected: 'damage',
            } as Tome);
        }

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes,
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'damage',
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle very large number of choices (100+)', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [];
        for (let i = 0; i < 150; i++) {
            choices.push({
                type: 'item',
                entity: {
                    id: `item${i}`,
                    name: `Item ${i}`,
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            });
        }

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations).toHaveLength(150);
        // Should be sorted by score
        for (let i = 1; i < recommendations.length; i++) {
            expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
        }
    });
});

describe('Recommendation Engine - Synergy Edge Cases', () => {
    it('should handle circular synergies', () => {
        const character: Character = {
            id: 'char1',
            name: 'Character',
            tier: 'S',
            rarity: 'rare',
            passive: 'Test',
            synergies_items: ['Item A'],
            synergies_weapons: [],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'itemA',
                    name: 'Item A',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive synergy matching', () => {
        const character: Character = {
            id: 'char1',
            name: 'Fire Mage',
            tier: 'S',
            rarity: 'rare',
            passive: 'Fire',
            synergies_items: ['fire staff'],
            synergies_weapons: [],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'FIRE STAFF',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });

    it('should handle partial name matches in synergies', () => {
        const character: Character = {
            id: 'char1',
            name: 'Warrior',
            tier: 'S',
            rarity: 'rare',
            passive: 'Melee',
            synergies_items: ['Sword'],
            synergies_weapons: [],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Legendary Sword of Power',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Magic Staff',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const sword = recommendations.find(r => r.choice.entity.id === 'item1');
        const staff = recommendations.find(r => r.choice.entity.id === 'item2');

        expect(sword!.synergies.length).toBeGreaterThan(0);
        expect(sword!.score).toBeGreaterThan(staff!.score);
    });

    it('should handle empty string in synergies array', () => {
        const character: Character = {
            id: 'char1',
            name: 'Test',
            tier: 'A',
            rarity: 'common',
            passive: 'Test',
            synergies_items: ['', 'Valid Item'],
            synergies_weapons: [''],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Valid Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle very long synergy arrays (50+ items)', () => {
        const synergies: string[] = [];
        for (let i = 0; i < 60; i++) {
            synergies.push(`Item ${i}`);
        }

        const character: Character = {
            id: 'char1',
            name: 'Universal Synergy',
            tier: 'SS',
            rarity: 'legendary',
            passive: 'Synergizes with everything',
            synergies_items: synergies,
            synergies_weapons: [],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item30',
                    name: 'Item 30',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });
});

describe('Recommendation Engine - Archetype Detection Edge Cases', () => {
    it('should handle items with no identifiable archetype keywords', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Mystery Box',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['unknown'],
                    base_effect: 'random',
                    description: 'Does something',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Another Mystery',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle build with exactly equal archetype counts', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Damage Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'damage',
                } as Item,
                {
                    id: 'item2',
                    name: 'HP Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'hp',
                } as Item,
                {
                    id: 'item3',
                    name: 'Crit Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'crit',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item4',
                    name: 'Test',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should weight tomes more heavily than items in archetype detection', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Damage Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'damage',
                } as Item,
            ],
            tomes: [
                {
                    id: 'tome1',
                    name: 'HP Tome',
                    tier: 'S',
                    rarity: 'rare',
                    effect: 'HP boost',
                    stat_affected: 'health',
                } as Tome,
                {
                    id: 'tome2',
                    name: 'HP Tome 2',
                    tier: 'S',
                    rarity: 'rare',
                    effect: 'HP boost',
                    stat_affected: 'hp',
                } as Tome,
            ],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Tank Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'hp',
                } as Item,
            },
        ];

        // Should detect tank archetype due to tome weighting
        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });
});

describe('Recommendation Engine - Formatting Edge Cases', () => {
    const mockRecommendation = (score: number, confidence: number) => ({
        choice: {
            type: 'item' as const,
            entity: {
                id: 'test',
                name: 'Test Item',
                tier: 'A' as const,
                rarity: 'common' as const,
                effects: [],
            } as Item,
        },
        score,
        confidence,
        reasoning: [],
        warnings: [],
        synergies: [],
        antiSynergies: [],
    });

    it('should format with extremely high scores', () => {
        const rec = mockRecommendation(99999, 1.0);
        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('99999');
    });

    it('should format with zero score', () => {
        const rec = mockRecommendation(0, 0.5);
        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('Score: 0');
    });

    it('should format with negative score (edge case)', () => {
        const rec = mockRecommendation(-10, 0.3);
        const formatted = formatRecommendation(rec, 1);

        // Should round negative properly
        expect(formatted).toContain('Score: -10');
    });

    it('should handle very long entity names', () => {
        const longName = 'A'.repeat(200);
        const rec = {
            ...mockRecommendation(100, 0.8),
            choice: {
                type: 'item' as const,
                entity: {
                    id: 'test',
                    name: longName,
                    tier: 'A' as const,
                    rarity: 'common' as const,
                    effects: [],
                } as Item,
            },
        };

        const formatted = formatRecommendation(rec, 1);
        expect(formatted).toContain(longName);
    });

    it('should handle very long reasoning arrays (50+ items)', () => {
        const reasoning: string[] = [];
        for (let i = 0; i < 60; i++) {
            reasoning.push(`Reason ${i}`);
        }

        const rec = {
            ...mockRecommendation(100, 0.9),
            reasoning,
        };

        const formatted = formatRecommendation(rec, 1);
        expect(formatted).toContain('Reason 0');
        expect(formatted).toContain('Reason 59');
    });

    it('should format rank 100+', () => {
        const rec = mockRecommendation(50, 0.7);
        const formatted = formatRecommendation(rec, 150);

        expect(formatted).toContain('#150');
    });

    it('should handle special characters in messages', () => {
        const rec = {
            ...mockRecommendation(100, 0.8),
            reasoning: ['Test & test', "Quote's here", 'Emoji: 🔥'],
            synergies: ['Synergy < > &'],
            warnings: ['Warning "quoted"'],
        };

        expect(() => formatRecommendation(rec, 1)).not.toThrow();
    });
});

describe('Recommendation Engine - Score Boundaries', () => {
    it('should never produce negative scores after adjustments', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Worst Item Ever',
                    tier: 'C',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should cap confidence at 1.0', () => {
        const character: Character = {
            id: 'char1',
            name: 'Test',
            tier: 'SS',
            rarity: 'legendary',
            passive: 'Test',
            synergies_items: ['Test', 'Item', 'Many', 'Synergies', 'Here'],
            synergies_weapons: [],
        };

        const build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item Many Synergies Here',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle fractional tier scores correctly', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        // Mix of all tiers
        const choices: ChoiceOption[] = [
            { type: 'item', entity: { id: '1', name: 'SS', tier: 'SS', rarity: 'legendary', effects: [] } as Item },
            { type: 'item', entity: { id: '2', name: 'S', tier: 'S', rarity: 'rare', effects: [] } as Item },
            { type: 'item', entity: { id: '3', name: 'A', tier: 'A', rarity: 'uncommon', effects: [] } as Item },
            { type: 'item', entity: { id: '4', name: 'B', tier: 'B', rarity: 'common', effects: [] } as Item },
            { type: 'item', entity: { id: '5', name: 'C', tier: 'C', rarity: 'common', effects: [] } as Item },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // Should be sorted: SS > S > A > B > C
        expect(recommendations[0].choice.entity.tier).toBe('SS');
        expect(recommendations[1].choice.entity.tier).toBe('S');
        expect(recommendations[2].choice.entity.tier).toBe('A');
        expect(recommendations[3].choice.entity.tier).toBe('B');
        expect(recommendations[4].choice.entity.tier).toBe('C');
    });
});
