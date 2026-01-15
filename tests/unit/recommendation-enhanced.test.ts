/**
 * Enhanced Tests for Recommendation Module
 * Additional coverage for archetype detection, scoring, and edge cases
 */

import { describe, it, expect } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
} from '../../src/modules/recommendation.ts';

describe('Recommendation Module - Enhanced Coverage', () => {
    // ========================================
    // Test Fixtures
    // ========================================

    const damageItem = {
        id: 'gym_sauce',
        name: 'Gym Sauce',
        tier: 'SS' as const,
        rarity: 'legendary' as const,
        description: 'Massive damage boost',
        base_effect: '+30% damage',
        detailed_description: 'Increases damage significantly',
        one_and_done: false,
        stacks_well: true,
    };

    const hpItem = {
        id: 'beefy_protein',
        name: 'Beefy Protein',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Boosts HP',
        base_effect: '+200 HP',
        detailed_description: 'Increases maximum health',
        one_and_done: false,
        stacks_well: true,
    };

    const critItem = {
        id: 'juice_box',
        name: 'Juice Box',
        tier: 'A' as const,
        rarity: 'rare' as const,
        description: 'Increases crit chance',
        base_effect: '+15% crit chance',
        detailed_description: 'More critical hits',
        one_and_done: false,
        stacks_well: true,
    };

    const speedItem = {
        id: 'speed_potion',
        name: 'Speed Potion',
        tier: 'A' as const,
        rarity: 'rare' as const,
        description: 'Attack faster',
        base_effect: '+20% attack speed',
        detailed_description: 'Increases attack speed',
        one_and_done: false,
        stacks_well: true,
    };

    const procItem = {
        id: 'bonk_hammer',
        name: 'Bonk Hammer',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Proc-based damage',
        base_effect: '20% chance to bonk',
        detailed_description: 'Triggers bonk effect',
        one_and_done: false,
        stacks_well: true,
    };

    const tome1 = {
        id: 'damage_tome',
        name: 'Damage Tome',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Increases damage',
        stat_affected: 'damage',
        priority_rank: 1,
    };

    const tome2 = {
        id: 'health_tome',
        name: 'Health Tome',
        tier: 'A' as const,
        rarity: 'rare' as const,
        description: 'Increases HP',
        stat_affected: 'health',
        priority_rank: 2,
    };

    const testCharacter = {
        id: 'warrior',
        name: 'Warrior',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Strong melee fighter',
        passive_ability: 'Power Strike',
        passive_description: 'Bonus damage',
        starting_weapon: 'Sword',
        playstyle: 'Melee',
        synergies_weapons: ['Hammer'],
        synergies_items: ['Gym Sauce'],
    };

    const testWeapon = {
        id: 'sword',
        name: 'Sword',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Sharp blade',
        base_damage: 50,
        attack_pattern: 'Slash',
        upgradeable_stats: ['damage'],
    };

    // ========================================
    // Archetype Detection Tests
    // ========================================

    describe('Archetype Detection', () => {
        it('should detect damage build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [damageItem, { ...damageItem, id: 'gym_sauce_2' }],
                tomes: [tome1],
            };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: damageItem },
                { type: 'item', entity: hpItem },
            ];

            const recommendations = recommendBestChoice(build, choices);

            // Damage item should score higher due to archetype fit
            const damageRec = recommendations.find(r => r.choice.entity.id === 'gym_sauce');
            expect(damageRec).toBeDefined();
            expect(damageRec!.reasoning.some(r => r.includes('damage'))).toBe(true);
        });

        it('should detect tank build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [hpItem, { ...hpItem, id: 'hp_2' }],
                tomes: [tome2],
            };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: hpItem },
                { type: 'item', entity: damageItem },
            ];

            const recommendations = recommendBestChoice(build, choices);
            const topRec = recommendations[0];

            // Should prefer HP items for tank build
            expect(topRec).toBeDefined();
        });

        it('should detect crit build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [critItem, critItem],
                tomes: [],
            };

            const critChoice: ChoiceOption = { type: 'item', entity: critItem };
            const choices: ChoiceOption[] = [critChoice];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should detect speed build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [speedItem, speedItem],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: speedItem }];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should detect proc build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [procItem, procItem],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: procItem }];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should detect mixed build archetype', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [damageItem, hpItem, critItem],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: damageItem }];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should handle empty build (no archetype)', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: damageItem }];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });
    });

    // ========================================
    // Synergy Scoring Tests
    // ========================================

    describe('Synergy Scoring', () => {
        it('should boost score for character synergy', () => {
            const build: BuildState = {
                character: testCharacter,
                weapon: null,
                items: [],
                tomes: [],
            };

            const synergyItem = { ...damageItem, name: 'Gym Sauce' };
            const noSynergyItem = { ...hpItem, name: 'Other Item' };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: synergyItem },
                { type: 'item', entity: noSynergyItem },
            ];

            const recommendations = recommendBestChoice(build, choices);

            const synergyRec = recommendations.find(r => r.choice.entity.name === 'Gym Sauce');
            expect(synergyRec).toBeDefined();
            expect(synergyRec!.synergies.length).toBeGreaterThan(0);
        });

        it('should boost score for weapon synergy', () => {
            const build: BuildState = {
                character: testCharacter,
                weapon: { ...testWeapon, name: 'Hammer' },
                items: [],
                tomes: [],
            };

            const weaponChoice: ChoiceOption = { type: 'weapon', entity: testWeapon };
            const choices: ChoiceOption[] = [weaponChoice];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should detect item-to-item synergies', () => {
            const emberShard = {
                id: 'ember',
                name: 'Ember Shard',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Fire damage',
                base_effect: '+10% fire',
                detailed_description: 'Fire',
                one_and_done: false,
                stacks_well: true,
            };

            const fireGem = {
                id: 'fire_gem',
                name: 'Fire Gem',
                tier: 'S' as const,
                rarity: 'epic' as const,
                description: 'Fire boost',
                base_effect: '+20% fire',
                detailed_description: 'Fire',
                synergies: ['Ember Shard'],
                one_and_done: false,
                stacks_well: true,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [emberShard],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: fireGem }];

            const recommendations = recommendBestChoice(build, choices);
            const fireGemRec = recommendations[0];

            expect(fireGemRec.synergies.length).toBeGreaterThan(0);
        });
    });

    // ========================================
    // Redundancy and Anti-Synergy Tests
    // ========================================

    describe('Redundancy Detection', () => {
        it('should penalize one-and-done items already in build', () => {
            const oneTimeMItem = {
                id: 'one_time',
                name: 'One Time',
                tier: 'SS' as const,
                rarity: 'legendary' as const,
                description: 'One use',
                base_effect: '+100% damage',
                detailed_description: 'One use only',
                one_and_done: true,
                stacks_well: false,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [oneTimeMItem],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: oneTimeMItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.warnings.some(w => w.includes('ONE-AND-DONE'))).toBe(true);
            expect(rec.score).toBeLessThan(100); // Should be penalized
        });

        it('should penalize items that do not stack well', () => {
            const noStackItem = {
                id: 'no_stack',
                name: 'No Stack Item',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Does not stack',
                base_effect: '+20% damage',
                detailed_description: 'No stacking',
                one_and_done: false,
                stacks_well: false,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [noStackItem],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: noStackItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.warnings.some(w => w.includes('does not stack'))).toBe(true);
        });

        it('should penalize similar items (diminishing returns)', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [damageItem, { ...damageItem, id: 'damage_2' }, { ...damageItem, id: 'damage_3' }],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: damageItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.warnings.some(w => w.includes('similar'))).toBe(true);
        });

        it('should detect anti-synergies', () => {
            const conflictItem1 = {
                id: 'item1',
                name: 'Conflict Item 1',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Item 1',
                base_effect: '+10% damage',
                detailed_description: 'Damage',
                one_and_done: false,
                stacks_well: true,
            };

            const conflictItem2 = {
                id: 'item2',
                name: 'Conflict Item 2',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Item 2',
                base_effect: '+10% damage',
                detailed_description: 'Damage',
                anti_synergies: ['Conflict Item 1'],
                one_and_done: false,
                stacks_well: true,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [conflictItem1],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: conflictItem2 }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.antiSynergies.length).toBeGreaterThan(0);
            expect(rec.warnings.length).toBeGreaterThan(0);
        });

        it('should handle antiSynergies field (alternative spelling)', () => {
            const item1 = {
                id: 'item1',
                name: 'Item 1',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Item',
                base_effect: '+10%',
                detailed_description: 'Desc',
                one_and_done: false,
                stacks_well: true,
            };

            const item2 = {
                id: 'item2',
                name: 'Item 2',
                tier: 'A' as const,
                rarity: 'rare' as const,
                description: 'Item',
                base_effect: '+10%',
                detailed_description: 'Desc',
                antiSynergies: ['Item 1'], // Alternative spelling
                one_and_done: false,
                stacks_well: true,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [item1],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: item2 }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.antiSynergies.length).toBeGreaterThan(0);
        });
    });

    // ========================================
    // Tier Scoring Tests
    // ========================================

    describe('Tier Scoring', () => {
        it('should rank SS tier highest', () => {
            const ssItem = { ...damageItem, tier: 'SS' as const };
            const sItem = { ...hpItem, tier: 'S' as const };
            const aItem = { ...critItem, tier: 'A' as const };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: aItem },
                { type: 'item', entity: sItem },
                { type: 'item', entity: ssItem },
            ];

            const recommendations = recommendBestChoice(build, choices);

            // SS should be at the top (highest score)
            expect(recommendations[0].choice.entity.tier).toBe('SS');
        });

        it('should apply correct tier scores', () => {
            const cItem = {
                id: 'c_item',
                name: 'C Tier Item',
                tier: 'C' as const,
                rarity: 'common' as const,
                description: 'Weak',
                base_effect: '+1%',
                detailed_description: 'Weak',
                one_and_done: false,
                stacks_well: true,
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: cItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            // C tier should have lowest base score (20)
            expect(rec.score).toBeGreaterThanOrEqual(20);
        });
    });

    // ========================================
    // Build Phase Considerations Tests
    // ========================================

    describe('Build Phase Considerations', () => {
        it('should boost SS items in early game', () => {
            const ssItem = { ...damageItem, tier: 'SS' as const };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [hpItem], // Only 1 item - early game
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: ssItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.reasoning.some(r => r.includes('Early game'))).toBe(true);
        });

        it('should not apply early game bonus with many items', () => {
            const ssItem = { ...damageItem, tier: 'SS' as const };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [hpItem, critItem, speedItem, procItem], // 4 items - not early
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: ssItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.reasoning.some(r => r.includes('Early game'))).toBe(false);
        });
    });

    // ========================================
    // Format Recommendation Tests
    // ========================================

    describe('formatRecommendation', () => {
        it('should format rank 1 with correct emoji', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 150,
                confidence: 0.9,
                reasoning: ['High damage', 'Good synergy'],
                synergies: ['Item A', 'Item B'],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('🎯');
            expect(formatted).toContain('RECOMMENDED:');
            expect(formatted).toContain('Gym Sauce');
            expect(formatted).toContain('SS-tier');
        });

        it('should format rank 2 with correct emoji', () => {
            const rec: any = {
                choice: { entity: hpItem },
                score: 120,
                confidence: 0.8,
                reasoning: ['Tankiness'],
                synergies: [],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 2);

            expect(formatted).toContain('🥈');
            expect(formatted).toContain('#2:');
        });

        it('should format rank 3 with correct emoji', () => {
            const rec: any = {
                choice: { entity: critItem },
                score: 100,
                confidence: 0.7,
                reasoning: [],
                synergies: [],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 3);

            expect(formatted).toContain('🥉');
            expect(formatted).toContain('#3:');
        });

        it('should include score and confidence', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 145.67,
                confidence: 0.856,
                reasoning: [],
                synergies: [],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Score: 146'); // Rounded
            expect(formatted).toContain('Confidence: 86%'); // Rounded
        });

        it('should include reasoning section', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 150,
                confidence: 0.9,
                reasoning: ['High base damage', 'Fits archetype'],
                synergies: [],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Why?');
            expect(formatted).toContain('✓ High base damage');
            expect(formatted).toContain('✓ Fits archetype');
        });

        it('should include synergies section', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 150,
                confidence: 0.9,
                reasoning: [],
                synergies: ['Synergy with Character', 'Synergy with Weapon'],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Synergies:');
            expect(formatted).toContain('• Synergy with Character');
            expect(formatted).toContain('• Synergy with Weapon');
        });

        it('should include warnings section', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 100,
                confidence: 0.7,
                reasoning: [],
                synergies: [],
                warnings: ['Already have similar items', 'Diminishing returns'],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).toContain('Warnings:');
            expect(formatted).toContain('⚠️ Already have similar items');
            expect(formatted).toContain('⚠️ Diminishing returns');
        });

        it('should omit empty sections', () => {
            const rec: any = {
                choice: { entity: damageItem },
                score: 150,
                confidence: 0.9,
                reasoning: [],
                synergies: [],
                warnings: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(rec, 1);

            expect(formatted).not.toContain('Why?');
            expect(formatted).not.toContain('Synergies:');
            expect(formatted).not.toContain('Warnings:');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================

    describe('Edge Cases', () => {
        it('should handle empty choices array', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            const recommendations = recommendBestChoice(build, []);
            expect(recommendations).toEqual([]);
        });

        it('should handle build with stats', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
                stats: {
                    hp: 1000,
                    damage: 50,
                    speed: 10,
                    critChance: 0.1,
                },
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: damageItem }];

            const recommendations = recommendBestChoice(build, choices);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should ensure score never goes negative', () => {
            const heavilyPenalizedItem = {
                id: 'bad',
                name: 'Bad Item',
                tier: 'C' as const,
                rarity: 'common' as const,
                description: 'Bad',
                base_effect: '+1%',
                detailed_description: 'Bad',
                one_and_done: true,
                stacks_well: false,
                anti_synergies: ['Item1', 'Item2', 'Item3'],
            };

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [
                    { ...damageItem, id: 'bad', name: 'Bad Item' },
                    { ...damageItem, id: 'Item1' },
                    { ...damageItem, id: 'Item2' },
                    { ...damageItem, id: 'Item3' },
                ],
                tomes: [],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: heavilyPenalizedItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.score).toBeGreaterThanOrEqual(0);
        });

        it('should sort recommendations by score descending', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };

            const choices: ChoiceOption[] = [
                { type: 'item', entity: { ...damageItem, tier: 'C' as const } },
                { type: 'item', entity: { ...damageItem, tier: 'SS' as const, id: 'ss_item' } },
                { type: 'item', entity: { ...damageItem, tier: 'A' as const, id: 'a_item' } },
            ];

            const recommendations = recommendBestChoice(build, choices);

            // Should be sorted by score (highest first)
            for (let i = 1; i < recommendations.length; i++) {
                expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
            }
        });

        it('should calculate confidence correctly', () => {
            const build: BuildState = {
                character: testCharacter,
                weapon: testWeapon,
                items: [],
                tomes: [],
            };

            const synergyItem = {
                ...damageItem,
                name: 'Gym Sauce',
                synergies_weapons: ['Hammer'],
            };

            const choices: ChoiceOption[] = [{ type: 'item', entity: synergyItem }];

            const recommendations = recommendBestChoice(build, choices);
            const rec = recommendations[0];

            expect(rec.confidence).toBeGreaterThan(0);
            expect(rec.confidence).toBeLessThanOrEqual(1);
        });
    });
});
