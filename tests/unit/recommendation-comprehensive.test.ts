/**
 * Recommendation Engine - Comprehensive Tests
 * Testing build archetype detection, synergy scoring, and recommendation logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
    type Recommendation,
} from '../../src/modules/recommendation';
import type { Item, Weapon, Tome, Character } from '../../src/types';

describe('Recommendation Engine - Build State Analysis', () => {
    it('should handle empty build state', () => {
        const emptyBuild: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'test1',
                    name: 'Test Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(emptyBuild, choices);

        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should handle build with only character', () => {
        const character: Character = {
            id: 'char1',
            name: 'Warrior',
            tier: 'S',
            rarity: 'rare',
            passive: 'Strong attack',
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
                    id: 'sword1',
                    name: 'Sword of Power',
                    tier: 'S',
                    rarity: 'rare',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });

    it('should handle build with character and weapon', () => {
        const character: Character = {
            id: 'char1',
            name: 'Archer',
            tier: 'S',
            rarity: 'rare',
            passive: 'Ranged attack',
            synergies_items: [],
            synergies_weapons: ['Bow'],
        };

        const weapon: Weapon = {
            id: 'bow1',
            name: 'Longbow',
            tier: 'A',
            rarity: 'uncommon',
            weapon_type: 'ranged',
            damage_type: 'physical',
            base_damage: 50,
        };

        const build: BuildState = {
            character,
            weapon,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Quiver',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should handle undefined optional fields gracefully', () => {
        const build: BuildState = {
            character: {
                id: 'char1',
                name: 'Test',
                tier: 'A',
                rarity: 'common',
                passive: 'Test',
            } as Character,
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
});

describe('Recommendation Engine - Tier Scoring', () => {
    it('should score SS-tier items highest', () => {
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
                    id: 'ss1',
                    name: 'SS Item',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'c1',
                    name: 'C Item',
                    tier: 'C',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].choice.entity.tier).toBe('SS');
        expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
    });

    it('should rank S-tier above A-tier', () => {
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
                    id: 'a1',
                    name: 'A Item',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 's1',
                    name: 'S Item',
                    tier: 'S',
                    rarity: 'rare',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].choice.entity.tier).toBe('S');
    });

    it('should rank B-tier above C-tier', () => {
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
                    id: 'c1',
                    name: 'C Item',
                    tier: 'C',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'b1',
                    name: 'B Item',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].choice.entity.tier).toBe('B');
    });
});

describe('Recommendation Engine - Synergy Detection', () => {
    it('should detect character-item synergies', () => {
        const character: Character = {
            id: 'char1',
            name: 'Fire Mage',
            tier: 'S',
            rarity: 'rare',
            passive: 'Fire damage',
            synergies_items: ['Fire Staff', 'Fireball'],
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
                    id: 'fire1',
                    name: 'Fire Staff',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: ['fire damage'],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'water1',
                    name: 'Water Staff',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: ['water damage'],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const fireStaff = recommendations.find(r => r.choice.entity.id === 'fire1');
        const waterStaff = recommendations.find(r => r.choice.entity.id === 'water1');

        expect(fireStaff!.synergies.length).toBeGreaterThan(0);
        expect(fireStaff!.score).toBeGreaterThan(waterStaff!.score);
    });

    it('should detect weapon-item synergies', () => {
        const weapon: Weapon = {
            id: 'bow1',
            name: 'Lightning Bow',
            tier: 'S',
            rarity: 'rare',
            weapon_type: 'ranged',
            damage_type: 'lightning',
            base_damage: 60,
        };

        const build: BuildState = {
            character: null,
            weapon,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Lightning Arrows',
                    tier: 'B',
                    rarity: 'common',
                    effects: ['lightning damage'],
                    synergies_weapons: ['Lightning Bow'],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Fire Arrows',
                    tier: 'B',
                    rarity: 'common',
                    effects: ['fire damage'],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const lightningArrows = recommendations.find(r => r.choice.entity.id === 'item1');
        const fireArrows = recommendations.find(r => r.choice.entity.id === 'item2');

        expect(lightningArrows!.synergies.length).toBeGreaterThan(0);
        expect(lightningArrows!.score).toBeGreaterThan(fireArrows!.score);
    });

    it('should handle partial name matches for synergies', () => {
        const character: Character = {
            id: 'char1',
            name: 'Crit Master',
            tier: 'S',
            rarity: 'rare',
            passive: 'Crit boost',
            synergies_items: ['Crit'],
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
                    name: 'Critical Strike Blade',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });
});

describe('Recommendation Engine - Build Archetype Detection', () => {
    it('should detect damage-focused build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Damage Booster',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['damage'],
                    base_effect: 'Increases damage',
                } as Item,
                {
                    id: 'item2',
                    name: 'Power Gauntlet',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['damage'],
                    description: 'Boost damage output',
                } as Item,
                {
                    id: 'item3',
                    name: 'Mega Damage',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'damage boost',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'dmg1',
                    name: 'More Damage',
                    tier: 'B',
                    rarity: 'common',
                    effects: ['damage'],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // Should recognize damage archetype and give appropriate recommendations
        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].reasoning.some(r => r.includes('tier'))).toBe(true);
    });

    it('should detect tank-focused build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'HP Booster',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['health'],
                } as Item,
                {
                    id: 'item2',
                    name: 'Beefy Shield',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
                {
                    id: 'item3',
                    name: 'Health Ring',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'hp boost',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'tank1',
                    name: 'Armor Plate',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should detect crit-focused build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Crit Juice',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['crit'],
                } as Item,
                {
                    id: 'item2',
                    name: 'Fork of Destiny',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
                {
                    id: 'item3',
                    name: 'Crit Master',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'critical chance',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'crit1',
                    name: 'Crit Blade',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should detect speed-focused build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Speed Boots',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['speed'],
                } as Item,
                {
                    id: 'item2',
                    name: 'Attack Speed Ring',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'attack speed boost',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'speed1',
                    name: 'Swift Blade',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should detect proc-focused build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Bonk Hammer',
                    tier: 'A',
                    rarity: 'common',
                    effects: ['proc'],
                } as Item,
                {
                    id: 'item2',
                    name: 'Meatball Launcher',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
                {
                    id: 'item3',
                    name: 'Proc Chance Amulet',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'chance on hit',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'proc1',
                    name: 'Proc Item',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should detect mixed build with no clear archetype', () => {
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
                    name: 'Speed Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                    base_effect: 'speed',
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'any1',
                    name: 'Generic Item',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });
});

describe('Recommendation Engine - Tome Analysis', () => {
    it('should factor tomes into archetype detection', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [
                {
                    id: 'tome1',
                    name: 'Damage Tome',
                    tier: 'S',
                    rarity: 'rare',
                    effect: 'Boost damage',
                    stat_affected: 'damage',
                } as Tome,
                {
                    id: 'tome2',
                    name: 'Power Tome',
                    tier: 'S',
                    rarity: 'rare',
                    effect: 'More damage',
                    stat_affected: 'damage',
                } as Tome,
            ],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Damage Amplifier',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                    base_effect: 'damage boost',
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });

    it('should handle tomes with various stat types', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [
                {
                    id: 'tome1',
                    name: 'Health Tome',
                    tier: 'A',
                    rarity: 'uncommon',
                    effect: 'Boost HP',
                    stat_affected: 'health',
                } as Tome,
                {
                    id: 'tome2',
                    name: 'Crit Tome',
                    tier: 'A',
                    rarity: 'uncommon',
                    effect: 'Boost crit',
                    stat_affected: 'crit',
                } as Tome,
                {
                    id: 'tome3',
                    name: 'Speed Tome',
                    tier: 'A',
                    rarity: 'uncommon',
                    effect: 'Boost attack speed',
                    stat_affected: 'attack speed',
                } as Tome,
            ],
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

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations).toHaveLength(1);
    });
});

describe('Recommendation Engine - Early Game Bonus', () => {
    it('should bonus SS-tier items in early game', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                {
                    id: 'item1',
                    name: 'Starter Item',
                    tier: 'C',
                    rarity: 'common',
                    effects: [],
                } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'ss1',
                    name: 'SS Early Game',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
            {
                type: 'item',
                entity: {
                    id: 'a1',
                    name: 'A Item',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const ssItem = recommendations.find(r => r.choice.entity.id === 'ss1');

        expect(ssItem!.reasoning.some(r => r.includes('Early game'))).toBe(true);
    });

    it('should not apply early game bonus with many items', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                { id: '1', name: 'Item 1', tier: 'A', rarity: 'common', effects: [] } as Item,
                { id: '2', name: 'Item 2', tier: 'A', rarity: 'common', effects: [] } as Item,
                { id: '3', name: 'Item 3', tier: 'A', rarity: 'common', effects: [] } as Item,
                { id: '4', name: 'Item 4', tier: 'A', rarity: 'common', effects: [] } as Item,
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: {
                    id: 'ss1',
                    name: 'SS Late Game',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(false);
    });
});

describe('Recommendation Engine - Format Output', () => {
    it('should format recommendation with emoji for rank 1', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Best Item',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
            score: 150,
            confidence: 0.9,
            reasoning: ['SS-tier item'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('🎯');
        expect(formatted).toContain('RECOMMENDED');
        expect(formatted).toContain('Best Item');
        expect(formatted).toContain('SS-tier');
    });

    it('should format recommendation for rank 2', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item2',
                    name: 'Second Item',
                    tier: 'S',
                    rarity: 'rare',
                    effects: [],
                } as Item,
            },
            score: 100,
            confidence: 0.7,
            reasoning: [],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 2);

        expect(formatted).toContain('🥈');
        expect(formatted).toContain('#2');
    });

    it('should format recommendation for rank 3', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item3',
                    name: 'Third Item',
                    tier: 'A',
                    rarity: 'uncommon',
                    effects: [],
                } as Item,
            },
            score: 75,
            confidence: 0.5,
            reasoning: [],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 3);

        expect(formatted).toContain('🥉');
        expect(formatted).toContain('#3');
    });

    it('should include reasoning in formatted output', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
            score: 80,
            confidence: 0.8,
            reasoning: ['Strong synergy', 'Good tier', 'Fits archetype'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('Why?');
        expect(formatted).toContain('Strong synergy');
        expect(formatted).toContain('Good tier');
        expect(formatted).toContain('Fits archetype');
    });

    it('should include synergies in formatted output', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
            score: 90,
            confidence: 0.85,
            reasoning: [],
            warnings: [],
            synergies: ['Works with Fire Mage', 'Boosts fire damage'],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('Synergies:');
        expect(formatted).toContain('Works with Fire Mage');
        expect(formatted).toContain('Boosts fire damage');
    });

    it('should include warnings in formatted output', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
            score: 60,
            confidence: 0.4,
            reasoning: [],
            warnings: ['Conflicts with current build', 'May reduce effectiveness'],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('Warnings:');
        expect(formatted).toContain('Conflicts with current build');
        expect(formatted).toContain('May reduce effectiveness');
    });

    it('should display score and confidence percentages', () => {
        const rec: Recommendation = {
            choice: {
                type: 'item',
                entity: {
                    id: 'item1',
                    name: 'Test Item',
                    tier: 'B',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
            score: 65.7,
            confidence: 0.723,
            reasoning: [],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(rec, 1);

        expect(formatted).toContain('Score: 66'); // Rounded
        expect(formatted).toContain('Confidence: 72%'); // Rounded percentage
    });
});

describe('Recommendation Engine - Edge Cases', () => {
    it('should handle empty choices array', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const recommendations = recommendBestChoice(build, []);

        expect(recommendations).toHaveLength(0);
    });

    it('should handle choices with missing optional fields', () => {
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
                    name: 'Minimal Item',
                    tier: 'A',
                    rarity: 'common',
                    effects: [],
                } as Item,
            },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should ensure scores are non-negative', () => {
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
                    name: 'Low Tier',
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
            synergies_items: ['Synergy1', 'Synergy2', 'Synergy3', 'Synergy4', 'Synergy5'],
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
                    name: 'Synergy1 Synergy2 Synergy3 Synergy4 Synergy5',
                    tier: 'SS',
                    rarity: 'legendary',
                    effects: [],
                } as Item,
            },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].confidence).toBeLessThanOrEqual(1.0);
    });
});
