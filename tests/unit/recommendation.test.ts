/**
 * Tests for recommendation.ts - Recommendation Engine
 * Tests the recommendation system for build optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
    type Recommendation,
} from '../../src/modules/recommendation.ts';
import type { Item, Weapon, Tome, Character } from '../../src/types/index.ts';

describe('Recommendation Engine', () => {
    let emptyBuild: BuildState;
    let sampleCharacter: Character;
    let sampleWeapon: Weapon;
    let sampleItems: Item[];
    let sampleTomes: Tome[];

    beforeEach(() => {
        // Setup test data
        sampleCharacter = {
            id: 'char1',
            name: 'TestHero',
            tier: 'S',
            description: 'A test character',
            passive: 'Test passive',
            synergies_items: ['MegaBonk', 'Juice'],
            synergies_weapons: ['Sword', 'Hammer'],
            strengths: ['damage'],
            weaknesses: ['defense'],
        } as Character;

        sampleWeapon = {
            id: 'wpn1',
            name: 'Sword',
            tier: 'A',
            description: 'A sword',
            base_damage: 10,
            scaling: '1 + 0.1 * level',
        } as Weapon;

        sampleItems = [
            {
                id: 'item1',
                name: 'MegaBonk',
                tier: 'SS',
                rarity: 'legendary',
                description: 'Massive damage',
                base_effect: '+50% damage',
                synergies: ['Juice'],
                anti_synergies: [],
                antiSynergies: [],
                one_and_done: true,
                stacks_well: false,
            } as Item,
            {
                id: 'item2',
                name: 'Juice',
                tier: 'S',
                rarity: 'epic',
                description: 'Critical hit bonus',
                base_effect: '+10% crit chance',
                synergies: ['MegaBonk', 'Fork'],
                anti_synergies: [],
                antiSynergies: [],
                synergies_weapons: ['Sword'],
            } as Item,
            {
                id: 'item3',
                name: 'Beefy Boi',
                tier: 'A',
                rarity: 'rare',
                description: 'Health boost',
                base_effect: '+100 HP',
                synergies: [],
                anti_synergies: ['Juice'],
                antiSynergies: ['Juice'],
            } as Item,
            {
                id: 'item4',
                name: 'Speed Shoes',
                tier: 'B',
                rarity: 'uncommon',
                description: 'Movement speed',
                base_effect: '+15% attack speed',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item,
            {
                id: 'item5',
                name: 'Fork',
                tier: 'A',
                rarity: 'rare',
                description: 'Crit damage',
                base_effect: '+50% crit damage',
                synergies: ['Juice'],
                anti_synergies: [],
                antiSynergies: [],
            } as Item,
            {
                id: 'item6',
                name: 'Gym Membership',
                tier: 'S',
                rarity: 'epic',
                description: 'Massive damage boost',
                base_effect: '+30% damage',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item,
            {
                id: 'item7',
                name: 'Proc Master',
                tier: 'A',
                rarity: 'rare',
                description: 'Chance to proc',
                base_effect: '10% chance to double hit',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item,
        ];

        sampleTomes = [
            {
                id: 'tome1',
                name: 'Tome of Damage',
                tier: 'S',
                rarity: 'epic',
                description: 'Damage boost',
                stat_affected: 'Damage',
                effect_value: '+20% damage',
                priority: 1,
            } as Tome,
            {
                id: 'tome2',
                name: 'Tome of Health',
                tier: 'A',
                rarity: 'rare',
                description: 'Health boost',
                stat_affected: 'Health (HP)',
                effect_value: '+50 HP',
                priority: 2,
            } as Tome,
            {
                id: 'tome3',
                name: 'Tome of Crit',
                tier: 'S',
                rarity: 'epic',
                description: 'Crit boost',
                stat_affected: 'Crit Chance',
                effect_value: '+15% crit',
                priority: 1,
            } as Tome,
            {
                id: 'tome4',
                name: 'Tome of Speed',
                tier: 'B',
                rarity: 'uncommon',
                description: 'Speed boost',
                stat_affected: 'Attack Speed',
                effect_value: '+10% speed',
                priority: 3,
            } as Tome,
        ];

        emptyBuild = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };
    });

    describe('Build Archetype Detection', () => {
        it('should detect empty build as mixed archetype', () => {
            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }];
            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(1);
            // Empty build has no archetype, so no archetype bonus
            expect(recommendations[0].score).toBeGreaterThan(0);
        });

        it('should detect damage-focused build', () => {
            const damageBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0], sampleItems[5]], // MegaBonk + Gym Membership
                tomes: [sampleTomes[0]], // Tome of Damage
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[5] }]; // Another damage item

            const recommendations = recommendBestChoice(damageBuild, choices);

            expect(recommendations).toHaveLength(1);
            // Should include archetype fit bonus
            expect(recommendations[0].reasoning.some(r => r.includes('damage'))).toBe(true);
        });

        it('should detect tank-focused build', () => {
            const tankBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[2]], // Beefy Boi
                tomes: [sampleTomes[1]], // Tome of Health
            };

            const tankItem: Item = {
                id: 'item8',
                name: 'More HP',
                tier: 'A',
                rarity: 'rare',
                description: 'Health boost',
                base_effect: '+200 HP',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: tankItem }];

            const recommendations = recommendBestChoice(tankBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].reasoning.some(r => r.toLowerCase().includes('tank'))).toBe(true);
        });

        it('should detect crit-focused build', () => {
            const critBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[1], sampleItems[4]], // Juice + Fork
                tomes: [sampleTomes[2]], // Tome of Crit
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }];

            const recommendations = recommendBestChoice(critBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].reasoning.some(r => r.toLowerCase().includes('crit'))).toBe(true);
        });

        it('should detect speed-focused build', () => {
            const speedBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[3]], // Speed Shoes
                tomes: [sampleTomes[3]], // Tome of Speed
            };

            const speedItem: Item = {
                id: 'item9',
                name: 'Turbo Boost',
                tier: 'A',
                rarity: 'rare',
                description: 'Speed boost',
                base_effect: '+20% attack speed',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: speedItem }];

            const recommendations = recommendBestChoice(speedBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].reasoning.some(r => r.toLowerCase().includes('speed'))).toBe(true);
        });

        it('should detect proc-focused build', () => {
            const procBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[6]], // Proc Master
            };

            const procItem: Item = {
                id: 'item10',
                name: 'Bonk Chance',
                tier: 'A',
                rarity: 'rare',
                description: 'Proc chance',
                base_effect: '15% proc chance',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: procItem }];

            const recommendations = recommendBestChoice(procBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].reasoning.some(r => r.toLowerCase().includes('proc'))).toBe(true);
        });

        it('should detect mixed build when no clear archetype', () => {
            const mixedBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0], sampleItems[2], sampleItems[3]], // Damage, tank, speed
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }];

            const recommendations = recommendBestChoice(mixedBuild, choices);

            expect(recommendations).toHaveLength(1);
            // Mixed build should not give archetype bonus
            expect(recommendations[0].reasoning.some(r => r.includes('archetype'))).toBe(false);
        });
    });

    describe('Tier Scoring', () => {
        it('should score SS-tier items highest', () => {
            const choices: ChoiceOption[] = [
                { type: 'item', entity: sampleItems[0] }, // SS-tier
                { type: 'item', entity: sampleItems[1] }, // S-tier
                { type: 'item', entity: sampleItems[2] }, // A-tier
            ];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations[0].choice.entity.tier).toBe('SS');
            expect(recommendations[1].choice.entity.tier).toBe('S');
            expect(recommendations[2].choice.entity.tier).toBe('A');
        });

        it('should include tier in reasoning', () => {
            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }]; // SS-tier

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations[0].reasoning[0]).toContain('SS-tier');
            expect(recommendations[0].reasoning[0]).toContain('100');
        });
    });

    describe('Synergy Detection', () => {
        it('should detect character-item synergies', () => {
            const buildWithChar: BuildState = {
                ...emptyBuild,
                character: sampleCharacter, // Synergizes with MegaBonk
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }]; // MegaBonk

            const recommendations = recommendBestChoice(buildWithChar, choices);

            expect(recommendations[0].synergies.length).toBeGreaterThan(0);
            expect(recommendations[0].synergies[0]).toContain('TestHero');
            expect(recommendations[0].score).toBeGreaterThan(100); // Base SS (100) + synergy bonus (20)
        });

        it('should detect character-weapon synergies', () => {
            const buildWithChar: BuildState = {
                ...emptyBuild,
                character: sampleCharacter, // Synergizes with Sword
            };

            const choices: ChoiceOption[] = [{ type: 'weapon', entity: sampleWeapon }]; // Sword

            const recommendations = recommendBestChoice(buildWithChar, choices);

            expect(recommendations[0].synergies.length).toBeGreaterThan(0);
            expect(recommendations[0].synergies[0]).toContain('TestHero');
        });

        it('should detect item-weapon synergies', () => {
            const buildWithWeapon: BuildState = {
                ...emptyBuild,
                weapon: sampleWeapon, // Sword
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice synergizes with Sword

            const recommendations = recommendBestChoice(buildWithWeapon, choices);

            expect(recommendations[0].synergies.length).toBeGreaterThan(0);
            expect(recommendations[0].synergies.some(s => s.includes('Sword'))).toBe(true);
        });

        it('should detect item-item synergies', () => {
            const buildWithItem: BuildState = {
                ...emptyBuild,
                items: [sampleItems[1]], // Juice
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }]; // MegaBonk synergizes with Juice

            const recommendations = recommendBestChoice(buildWithItem, choices);

            expect(recommendations[0].synergies.length).toBeGreaterThan(0);
            expect(recommendations[0].synergies.some(s => s.includes('Juice'))).toBe(true);
        });

        it('should accumulate multiple synergies', () => {
            const buildWithMultiple: BuildState = {
                ...emptyBuild,
                character: sampleCharacter, // Synergizes with Juice
                items: [sampleItems[0]], // MegaBonk synergizes with Juice
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice

            const recommendations = recommendBestChoice(buildWithMultiple, choices);

            expect(recommendations[0].synergies.length).toBeGreaterThanOrEqual(2);
        });

        it('should detect anti-synergies', () => {
            const buildWithBeefy: BuildState = {
                ...emptyBuild,
                items: [sampleItems[2]], // Beefy Boi
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice anti-synergizes with Beefy

            const recommendations = recommendBestChoice(buildWithBeefy, choices);

            expect(recommendations[0].antiSynergies.length).toBeGreaterThan(0);
            expect(recommendations[0].warnings.length).toBeGreaterThan(0);
            expect(recommendations[0].warnings.some(w => w.includes('Beefy Boi'))).toBe(true);
        });

        it('should penalize score for anti-synergies', () => {
            const buildWithBeefy: BuildState = {
                ...emptyBuild,
                items: [sampleItems[2]], // Beefy Boi
            };

            const choicesWithAntiSyn: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice (anti-syn)
            const choicesWithoutAntiSyn: ChoiceOption[] = [{ type: 'item', entity: sampleItems[3] }]; // Speed Shoes (no anti-syn)

            const recsWithAntiSyn = recommendBestChoice(buildWithBeefy, choicesWithAntiSyn);
            const recsWithoutAntiSyn = recommendBestChoice(buildWithBeefy, choicesWithoutAntiSyn);

            // Anti-synergy should lower score
            expect(recsWithAntiSyn[0].score).toBeLessThan(recsWithoutAntiSyn[0].score + 20);
        });
    });

    describe('Redundancy Detection', () => {
        it('should detect one-and-done items already in build', () => {
            const buildWithMegaBonk: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0]], // MegaBonk (one-and-done)
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }]; // MegaBonk again

            const recommendations = recommendBestChoice(buildWithMegaBonk, choices);

            expect(recommendations[0].warnings.some(w => w.includes('ONE-AND-DONE'))).toBe(true);
            expect(recommendations[0].score).toBe(0); // Should be heavily penalized
        });

        it('should detect items that dont stack well', () => {
            const buildWithMegaBonk: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0]], // MegaBonk (stacks_well: false)
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }];

            const recommendations = recommendBestChoice(buildWithMegaBonk, choices);

            expect(recommendations[0].warnings.some(w => w.includes('does not stack'))).toBe(true);
        });

        it('should penalize similar items with diminishing returns', () => {
            const buildWithDamage: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0], sampleItems[5]], // Two damage items
            };

            const anotherDamageItem: Item = {
                id: 'item11',
                name: 'Yet More Damage',
                tier: 'A',
                rarity: 'rare',
                description: 'Even more damage',
                base_effect: '+25% damage',
                synergies: [],
                anti_synergies: [],
                antiSynergies: [],
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: anotherDamageItem }];

            const recommendations = recommendBestChoice(buildWithDamage, choices);

            expect(recommendations[0].warnings.some(w => w.includes('similar items'))).toBe(true);
            expect(recommendations[0].score).toBeLessThan(60); // Should have diminishing returns penalty
        });

        it('should not penalize non-item choices for redundancy', () => {
            const choices: ChoiceOption[] = [{ type: 'weapon', entity: sampleWeapon }];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations[0].warnings.length).toBe(0);
        });
    });

    describe('Build Phase Considerations', () => {
        it('should boost SS-tier items in early game', () => {
            const earlyBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[3]], // Only 1 item
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }]; // SS-tier MegaBonk

            const recommendations = recommendBestChoice(earlyBuild, choices);

            expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(true);
            expect(recommendations[0].score).toBeGreaterThan(100); // Base 100 + early game bonus
        });

        it('should not give early game bonus to non-SS items', () => {
            const earlyBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[3]], // Only 1 item
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[2] }]; // A-tier item

            const recommendations = recommendBestChoice(earlyBuild, choices);

            expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(false);
        });

        it('should not give early game bonus in mid/late game', () => {
            const lateBuild: BuildState = {
                ...emptyBuild,
                items: [sampleItems[0], sampleItems[1], sampleItems[2], sampleItems[3]], // 4 items
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }];

            const recommendations = recommendBestChoice(lateBuild, choices);

            expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(false);
        });
    });

    describe('Confidence Scoring', () => {
        it('should have higher confidence with synergies', () => {
            const buildWithSynergies: BuildState = {
                ...emptyBuild,
                character: sampleCharacter,
                items: [sampleItems[0]],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice (has synergies)

            const recommendations = recommendBestChoice(buildWithSynergies, choices);

            expect(recommendations[0].confidence).toBeGreaterThan(0.5);
        });

        it('should have lower confidence with anti-synergies', () => {
            const buildWithAntiSyn: BuildState = {
                ...emptyBuild,
                items: [sampleItems[2]], // Beefy Boi
            };

            const choicesWithAntiSyn: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice (anti-syn)
            const choicesWithoutAntiSyn: ChoiceOption[] = [{ type: 'item', entity: sampleItems[3] }];

            const recsWithAntiSyn = recommendBestChoice(buildWithAntiSyn, choicesWithAntiSyn);
            const recsWithoutAntiSyn = recommendBestChoice(buildWithAntiSyn, choicesWithoutAntiSyn);

            expect(recsWithAntiSyn[0].confidence).toBeLessThan(recsWithoutAntiSyn[0].confidence);
        });

        it('should cap confidence at 1.0', () => {
            const buildWithManySynergies: BuildState = {
                ...emptyBuild,
                character: sampleCharacter,
                items: [sampleItems[0], sampleItems[4]],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }]; // Juice (many synergies)

            const recommendations = recommendBestChoice(buildWithManySynergies, choices);

            expect(recommendations[0].confidence).toBeLessThanOrEqual(1.0);
        });
    });

    describe('Sorting and Ranking', () => {
        it('should sort recommendations by score descending', () => {
            const choices: ChoiceOption[] = [
                { type: 'item', entity: sampleItems[3] }, // B-tier (40)
                { type: 'item', entity: sampleItems[0] }, // SS-tier (100)
                { type: 'item', entity: sampleItems[2] }, // A-tier (60)
            ];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations[0].choice.entity.tier).toBe('SS');
            expect(recommendations[1].choice.entity.tier).toBe('A');
            expect(recommendations[2].choice.entity.tier).toBe('B');
        });

        it('should handle tie-breaking with synergies', () => {
            const buildWithChar: BuildState = {
                ...emptyBuild,
                character: sampleCharacter, // Synergizes with MegaBonk
            };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: sampleItems[0] }, // SS-tier with synergy
                {
                    type: 'item',
                    entity: {
                        ...sampleItems[0],
                        id: 'item12',
                        name: 'Other SS Item',
                        synergies: [],
                        synergies_items: [],
                    } as Item,
                }, // SS-tier without synergy
            ];

            const recommendations = recommendBestChoice(buildWithChar, choices);

            // Item with synergy should rank higher
            expect(recommendations[0].choice.entity.name).toBe('MegaBonk');
        });
    });

    describe('Multiple Choices Handling', () => {
        it('should handle empty choices array', () => {
            const recommendations = recommendBestChoice(emptyBuild, []);

            expect(recommendations).toHaveLength(0);
        });

        it('should handle single choice', () => {
            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(1);
        });

        it('should handle many choices', () => {
            const choices: ChoiceOption[] = sampleItems.map(item => ({ type: 'item' as const, entity: item }));

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(sampleItems.length);
        });
    });

    describe('Edge Cases', () => {
        it('should handle items with missing properties', () => {
            const incompleteItem: Item = {
                id: 'incomplete',
                name: 'Incomplete Item',
                tier: 'C',
                rarity: 'common',
                // Missing description, base_effect, synergies, etc.
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: incompleteItem }];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].score).toBeGreaterThanOrEqual(0);
        });

        it('should handle build with null character', () => {
            const buildWithNullChar: BuildState = {
                ...emptyBuild,
                character: null,
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[0] }];

            const recommendations = recommendBestChoice(buildWithNullChar, choices);

            expect(recommendations).toHaveLength(1);
        });

        it('should handle build with null weapon', () => {
            const buildWithNullWeapon: BuildState = {
                ...emptyBuild,
                weapon: null,
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: sampleItems[1] }];

            const recommendations = recommendBestChoice(buildWithNullWeapon, choices);

            expect(recommendations).toHaveLength(1);
        });

        it('should ensure score never goes negative', () => {
            const buildWithMultipleAntiSyn: BuildState = {
                ...emptyBuild,
                items: [sampleItems[2]], // Beefy Boi anti-synergizes with Juice
            };

            // Force an item with huge penalties
            const badItem: Item = {
                ...sampleItems[1],
                tier: 'C', // Low tier (20 points)
                one_and_done: false,
                anti_synergies: [],
                antiSynergies: [],
            } as Item;

            // Add it to build first, then try to add again with "one and done"
            const buildWithBad: BuildState = {
                ...emptyBuild,
                items: [badItem],
            };

            const badChoice: Item = {
                ...badItem,
                one_and_done: true, // 100 point penalty
            } as Item;

            const choices: ChoiceOption[] = [{ type: 'item', entity: badChoice }];

            const recommendations = recommendBestChoice(buildWithBad, choices);

            expect(recommendations[0].score).toBeGreaterThanOrEqual(0);
        });

        it('should handle tome choices', () => {
            const choices: ChoiceOption[] = [{ type: 'tome', entity: sampleTomes[0] }];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].choice.type).toBe('tome');
        });

        it('should handle mixed choice types', () => {
            const choices: ChoiceOption[] = [
                { type: 'item', entity: sampleItems[0] },
                { type: 'weapon', entity: sampleWeapon },
                { type: 'tome', entity: sampleTomes[0] },
            ];

            const recommendations = recommendBestChoice(emptyBuild, choices);

            expect(recommendations).toHaveLength(3);
        });
    });

    describe('Format Recommendation', () => {
        it('should format rank 1 recommendation with trophy emoji', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[0] },
                score: 100,
                confidence: 0.85,
                reasoning: ['SS-tier item', 'Great synergies'],
                warnings: [],
                synergies: ['Synergizes with TestHero'],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('🎯');
            expect(formatted).toContain('RECOMMENDED:');
            expect(formatted).toContain('MegaBonk');
            expect(formatted).toContain('SS-tier');
            expect(formatted).toContain('Score: 100');
            expect(formatted).toContain('Confidence: 85%');
        });

        it('should format rank 2 recommendation with silver medal', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[1] },
                score: 80,
                confidence: 0.7,
                reasoning: ['S-tier item'],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 2);

            expect(formatted).toContain('🥈');
            expect(formatted).toContain('#2:');
            expect(formatted).toContain('Juice');
        });

        it('should format rank 3 recommendation with bronze medal', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[2] },
                score: 60,
                confidence: 0.6,
                reasoning: ['A-tier item'],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 3);

            expect(formatted).toContain('🥉');
            expect(formatted).toContain('#3:');
        });

        it('should include reasoning section', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[0] },
                score: 100,
                confidence: 0.85,
                reasoning: ['SS-tier item', 'Great for early game', 'Fits damage build'],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Why?');
            expect(formatted).toContain('✓ SS-tier item');
            expect(formatted).toContain('✓ Great for early game');
            expect(formatted).toContain('✓ Fits damage build');
        });

        it('should include synergies section', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[0] },
                score: 100,
                confidence: 0.85,
                reasoning: [],
                warnings: [],
                synergies: ['Synergizes with TestHero', 'Synergizes with Juice'],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Synergies:');
            expect(formatted).toContain('• Synergizes with TestHero');
            expect(formatted).toContain('• Synergizes with Juice');
        });

        it('should include warnings section', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[1] },
                score: 50,
                confidence: 0.4,
                reasoning: [],
                warnings: ['Anti-synergy with Beefy Boi', 'Already have 2 similar items'],
                synergies: [],
                antiSynergies: ['Beefy Boi'],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Warnings:');
            expect(formatted).toContain('⚠️ Anti-synergy with Beefy Boi');
            expect(formatted).toContain('⚠️ Already have 2 similar items');
        });

        it('should omit empty sections', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[0] },
                score: 100,
                confidence: 0.85,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).not.toContain('Why?');
            expect(formatted).not.toContain('Synergies:');
            expect(formatted).not.toContain('Warnings:');
        });

        it('should round score and confidence percentages', () => {
            const rec: Recommendation = {
                choice: { type: 'item', entity: sampleItems[0] },
                score: 87.6,
                confidence: 0.731,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Score: 88');
            expect(formatted).toContain('Confidence: 73%');
        });
    });
});
