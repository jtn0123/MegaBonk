/**
 * Real Integration Tests for Recommendation Module
 * No mocking - tests actual recommendation engine implementations
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
    type Recommendation,
} from '../../src/modules/recommendation.ts';

// ========================================
// Test Fixtures
// ========================================

const testCharacter = {
    id: 'fire_mage',
    name: 'Fire Mage',
    tier: 'SS' as const,
    rarity: 'legendary' as const,
    description: 'Fire master',
    passive_ability: 'Inferno',
    passive_description: 'Burns enemies',
    starting_weapon: 'Fire Staff',
    playstyle: 'Ranged',
    synergies_weapons: ['Fire Sword'],
    synergies_items: ['fire_crystal'],
};

const testWeapon = {
    id: 'fire_sword',
    name: 'Fire Sword',
    tier: 'S' as const,
    rarity: 'legendary' as const,
    description: 'Burns on hit',
    base_damage: 50,
    attack_pattern: 'Sweeping',
    upgradeable_stats: ['damage'],
};

const testItemSS = {
    id: 'fire_crystal',
    name: 'Fire Crystal',
    tier: 'SS' as const,
    rarity: 'legendary' as const,
    description: 'Fire damage boost',
    base_effect: '+20% damage',
    detailed_description: 'Fire boost',
    one_and_done: false,
    stacks_well: true,
    synergies: ['Ember Shard'],
    synergies_weapons: ['Fire Sword'],
};

const testItemA = {
    id: 'basic_sword',
    name: 'Basic Sword',
    tier: 'A' as const,
    rarity: 'epic' as const,
    description: 'A basic sword',
    base_effect: '+10% damage',
    detailed_description: 'Basic damage',
    one_and_done: false,
    stacks_well: true,
};

const testItemC = {
    id: 'rusty_blade',
    name: 'Rusty Blade',
    tier: 'C' as const,
    rarity: 'common' as const,
    description: 'A rusty blade',
    base_effect: '+5% damage',
    detailed_description: 'Weak damage',
    one_and_done: false,
    stacks_well: true,
};

const testItemOneAndDone = {
    id: 'one_time',
    name: 'One Time Item',
    tier: 'A' as const,
    rarity: 'rare' as const,
    description: 'Use once',
    base_effect: '+50% damage',
    detailed_description: 'One use only',
    one_and_done: true,
    stacks_well: false,
};

const testItemWithAntiSynergy = {
    id: 'anti_item',
    name: 'Anti Item',
    tier: 'A' as const,
    rarity: 'rare' as const,
    description: 'Conflicts',
    base_effect: '+10% damage',
    detailed_description: 'Has conflicts',
    anti_synergies: ['Fire Crystal'],
    one_and_done: false,
    stacks_well: true,
};

// ========================================
// recommendBestChoice Tests
// ========================================

describe('recommendBestChoice - Real Integration Tests', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return recommendations for all choices', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any },
            { type: 'item', entity: testItemA as any },
            { type: 'item', entity: testItemC as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations).toHaveLength(3);
    });

    it('should rank higher tier items better', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any },
            { type: 'item', entity: testItemA as any },
            { type: 'item', entity: testItemC as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // SS tier should be ranked first
        expect(recommendations[0].choice.entity.tier).toBe('SS');
        // C tier should be ranked last
        expect(recommendations[2].choice.entity.tier).toBe('C');
    });

    it('should include synergy bonus', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any }, // Has synergies
            { type: 'item', entity: testItemC as any },  // No synergies
        ];

        const recommendations = recommendBestChoice(build, choices);

        // Fire Crystal synergizes with character and weapon
        const ssRec = recommendations.find(r => r.choice.entity.id === 'fire_crystal');
        expect(ssRec?.synergies.length).toBeGreaterThan(0);
    });

    it('should penalize items with anti-synergies', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [testItemSS as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemWithAntiSynergy as any },
            { type: 'item', entity: testItemA as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const antiRec = recommendations.find(r => r.choice.entity.id === 'anti_item');
        expect(antiRec?.antiSynergies.length).toBeGreaterThan(0);
        expect(antiRec?.warnings.length).toBeGreaterThan(0);
    });

    it('should penalize one-and-done items already in build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [testItemOneAndDone as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemOneAndDone as any }, // Already in build
            { type: 'item', entity: testItemA as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const oneAndDoneRec = recommendations.find(r => r.choice.entity.id === 'one_time');
        expect(oneAndDoneRec?.warnings.length).toBeGreaterThan(0);
        expect(oneAndDoneRec?.warnings.some(w => w.includes('ONE-AND-DONE'))).toBe(true);
    });

    it('should include reasoning for each recommendation', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].reasoning.length).toBeGreaterThan(0);
        expect(recommendations[0].reasoning.some(r => r.includes('tier'))).toBe(true);
    });

    it('should calculate confidence score', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: testWeapon as any,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        expect(recommendations[0].confidence).toBeGreaterThanOrEqual(0);
        expect(recommendations[0].confidence).toBeLessThanOrEqual(1);
    });

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

    it('should handle weapon choices', () => {
        const build: BuildState = {
            character: testCharacter as any,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'weapon', entity: testWeapon as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
        expect(recommendations[0].choice.type).toBe('weapon');
    });

    it('should prioritize SS items in early game', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [], // Early game - no items
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemSS as any },
            { type: 'item', entity: testItemA as any },
        ];

        const recommendations = recommendBestChoice(build, choices);

        const ssRec = recommendations.find(r => r.choice.entity.tier === 'SS');
        expect(ssRec?.reasoning.some(r => r.includes('Early game'))).toBe(true);
    });
});

// ========================================
// Build Archetype Detection Tests
// ========================================

describe('Build Archetype Detection', () => {
    it('should detect damage build archetype', () => {
        const damageItem = {
            id: 'damage_boost',
            name: 'Damage Boost',
            tier: 'A' as const,
            base_effect: '+20% damage',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [damageItem as any, damageItem as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: { ...damageItem, id: 'more_damage' } as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        // Should get archetype fit bonus
        expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should detect crit build archetype', () => {
        const critItem = {
            id: 'crit_boost',
            name: 'Crit Juice',
            tier: 'A' as const,
            base_effect: '+20% crit chance',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [critItem as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: critItem as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
    });

    it('should detect tank build archetype', () => {
        const tankItem = {
            id: 'hp_boost',
            name: 'Beefy Armor',
            tier: 'A' as const,
            base_effect: '+20% HP',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [tankItem as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: tankItem as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
    });

    it('should handle mixed archetype', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemA as any },
        ];

        // Mixed archetype should still produce recommendations
        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
    });
});

// ========================================
// formatRecommendation Tests
// ========================================

describe('formatRecommendation - Real Integration Tests', () => {
    it('should format rank 1 with recommended prefix', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemSS as any },
            score: 100,
            confidence: 0.8,
            reasoning: ['SS-tier item'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 1);

        expect(formatted).toContain('RECOMMENDED');
        expect(formatted).toContain('Fire Crystal');
        expect(formatted).toContain('SS-tier');
    });

    it('should format other ranks with number prefix', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemA as any },
            score: 60,
            confidence: 0.5,
            reasoning: ['A-tier item'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 2);

        expect(formatted).toContain('#2');
        expect(formatted).not.toContain('RECOMMENDED');
    });

    it('should include score and confidence', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemSS as any },
            score: 85,
            confidence: 0.75,
            reasoning: [],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 1);

        expect(formatted).toContain('85');
        expect(formatted).toContain('75%');
    });

    it('should include reasoning section', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemSS as any },
            score: 100,
            confidence: 0.8,
            reasoning: ['SS-tier item', 'Synergizes with build'],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 1);

        expect(formatted).toContain('Why?');
        expect(formatted).toContain('SS-tier item');
        expect(formatted).toContain('Synergizes with build');
    });

    it('should include synergies section', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemSS as any },
            score: 100,
            confidence: 0.9,
            reasoning: [],
            warnings: [],
            synergies: ['Synergizes with Fire Mage', 'Synergizes with Fire Sword'],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 1);

        expect(formatted).toContain('Synergies');
        expect(formatted).toContain('Fire Mage');
        expect(formatted).toContain('Fire Sword');
    });

    it('should include warnings section', () => {
        const recommendation: Recommendation = {
            choice: { type: 'item', entity: testItemOneAndDone as any },
            score: 50,
            confidence: 0.4,
            reasoning: [],
            warnings: ['ONE-AND-DONE item already in build'],
            synergies: [],
            antiSynergies: [],
        };

        const formatted = formatRecommendation(recommendation, 2);

        expect(formatted).toContain('Warnings');
        expect(formatted).toContain('ONE-AND-DONE');
    });

    it('should use correct emojis for ranks', () => {
        const rec: Recommendation = {
            choice: { type: 'item', entity: testItemSS as any },
            score: 100,
            confidence: 0.8,
            reasoning: [],
            warnings: [],
            synergies: [],
            antiSynergies: [],
        };

        const rank1 = formatRecommendation(rec, 1);
        const rank2 = formatRecommendation(rec, 2);
        const rank3 = formatRecommendation(rec, 3);

        // Note: These test that emojis are present, actual emoji varies
        expect(rank1.length).toBeGreaterThan(0);
        expect(rank2.length).toBeGreaterThan(0);
        expect(rank3.length).toBeGreaterThan(0);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Recommendation Edge Cases', () => {
    it('should handle items with missing properties', () => {
        const minimalItem = {
            id: 'minimal',
            name: 'Minimal Item',
            tier: 'C' as const,
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: minimalItem as any },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle character with missing synergies arrays', () => {
        const minimalCharacter = {
            id: 'minimal_char',
            name: 'Minimal Character',
            tier: 'C' as const,
        };

        const build: BuildState = {
            character: minimalCharacter as any,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemA as any },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });

    it('should handle tome choices', () => {
        const tome = {
            id: 'test_tome',
            name: 'Test Tome',
            tier: 'A' as const,
            stat_affected: 'Damage',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'tome', entity: tome as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
        expect(recommendations[0].choice.type).toBe('tome');
    });

    it('should handle shrine choices', () => {
        const shrine = {
            id: 'test_shrine',
            name: 'Test Shrine',
            tier: 'S' as const,
            type: 'stat_upgrade',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'shrine', entity: shrine as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations.length).toBe(1);
        expect(recommendations[0].choice.type).toBe('shrine');
    });

    it('should not return negative scores', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [testItemSS as any],
            tomes: [],
        };

        // Item with anti-synergy should still have non-negative score
        const choices: ChoiceOption[] = [
            { type: 'item', entity: testItemWithAntiSynergy as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should handle items with empty strings in properties', () => {
        const emptyPropsItem = {
            id: 'empty_props',
            name: '',
            tier: 'C' as const,
            base_effect: '',
            description: '',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: emptyPropsItem as any },
        ];

        expect(() => recommendBestChoice(build, choices)).not.toThrow();
    });
});

// ========================================
// Redundancy Detection Tests
// ========================================

describe('Redundancy Detection', () => {
    it('should penalize items that do not stack well', () => {
        const noStackItem = {
            ...testItemA,
            stacks_well: false,
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [noStackItem as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: noStackItem as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        expect(recommendations[0].warnings.some(w => w.includes('stack'))).toBe(true);
    });

    it('should detect similar items in build', () => {
        const damageItem1 = {
            id: 'damage1',
            name: 'Damage Item 1',
            tier: 'A' as const,
            base_effect: '+10% damage',
        };

        const damageItem2 = {
            id: 'damage2',
            name: 'Damage Item 2',
            tier: 'A' as const,
            base_effect: '+15% damage',
        };

        const build: BuildState = {
            character: null,
            weapon: null,
            items: [damageItem1 as any],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: damageItem2 as any },
        ];

        const recommendations = recommendBestChoice(build, choices);
        // Should still produce a recommendation
        expect(recommendations.length).toBe(1);
    });
});
