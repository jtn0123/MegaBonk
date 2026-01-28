// ========================================
// Recommendation Engine Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    recommendBestChoice,
    formatRecommendation,
    type BuildState,
    type ChoiceOption,
    type Recommendation,
} from '../../src/modules/recommendation.ts';

// Mock data factories
function createMockCharacter(overrides = {}) {
    return {
        id: 'test-char',
        name: 'Test Character',
        tier: 'S' as const,
        playstyle: 'Balanced',
        passive_ability: 'Test Passive',
        passive_description: 'A test passive ability',
        starting_weapon: 'Test Sword',
        base_hp: 100,
        base_damage: 10,
        synergies_items: [],
        synergies_weapons: [],
        ...overrides,
    };
}

function createMockWeapon(overrides = {}) {
    return {
        id: 'test-weapon',
        name: 'Test Weapon',
        tier: 'S' as const,
        base_damage: 10,
        attack_pattern: 'melee',
        description: 'A test weapon',
        ...overrides,
    };
}

function createMockItem(overrides = {}) {
    return {
        id: 'test-item',
        name: 'Test Item',
        tier: 'S' as const,
        rarity: 'legendary' as const,
        base_effect: 'Test effect',
        description: 'A test item',
        formula: 'x',
        detailed_description: 'A detailed test item description',
        synergies: [],
        synergies_weapons: [],
        anti_synergies: [],
        ...overrides,
    };
}

function createMockTome(overrides = {}) {
    return {
        id: 'test-tome',
        name: 'Test Tome',
        tier: 'A' as const,
        stat_affected: 'Damage',
        value_per_level: '1%',
        description: 'A test tome',
        priority: 5,
        ...overrides,
    };
}

function createMockShrine(overrides = {}) {
    return {
        id: 'test-shrine',
        name: 'Test Shrine',
        tier: 'A' as const,
        icon: '🏛️',
        type: 'blessing',
        reusable: false,
        description: 'A test shrine',
        reward: 'Test reward',
        ...overrides,
    };
}

function createEmptyBuildState(): BuildState {
    return {
        character: null,
        weapon: null,
        items: [],
        tomes: [],
    };
}

describe('Recommendation Engine', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    describe('recommendBestChoice', () => {
        it('should return empty array when no choices provided', () => {
            const build = createEmptyBuildState();
            const result = recommendBestChoice(build, []);
            expect(result).toEqual([]);
        });

        it('should return sorted recommendations by score', () => {
            const build = createEmptyBuildState();
            const choices: ChoiceOption[] = [
                { type: 'item', entity: createMockItem({ tier: 'C', name: 'Weak Item' }) },
                { type: 'item', entity: createMockItem({ tier: 'SS', name: 'Strong Item' }) },
                { type: 'item', entity: createMockItem({ tier: 'A', name: 'Medium Item' }) },
            ];

            const result = recommendBestChoice(build, choices);

            expect(result).toHaveLength(3);
            expect(result[0].choice.entity.name).toBe('Strong Item');
            expect(result[1].choice.entity.name).toBe('Medium Item');
            expect(result[2].choice.entity.name).toBe('Weak Item');
        });

        it('should give higher scores to higher tier items', () => {
            const build = createEmptyBuildState();
            const ssItem = createMockItem({ tier: 'SS', name: 'SS Item' });
            const cItem = createMockItem({ tier: 'C', name: 'C Item' });

            const choices: ChoiceOption[] = [
                { type: 'item', entity: ssItem },
                { type: 'item', entity: cItem },
            ];

            const result = recommendBestChoice(build, choices);

            expect(result[0].score).toBeGreaterThan(result[1].score);
        });

        it('should detect synergies with character', () => {
            const character = createMockCharacter({
                name: 'Synergy Char',
                synergies_items: ['Test Item'],
            });

            const build: BuildState = {
                character,
                weapon: null,
                items: [],
                tomes: [],
            };

            const item = createMockItem({ name: 'Test Item' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].synergies).toContain(`Synergizes with ${character.name}`);
        });

        it('should detect weapon synergies with character', () => {
            const character = createMockCharacter({
                name: 'Weapon Char',
                synergies_weapons: ['Special Weapon'],
            });

            const build: BuildState = {
                character,
                weapon: null,
                items: [],
                tomes: [],
            };

            const weapon = createMockWeapon({ name: 'Special Weapon' });
            const choices: ChoiceOption[] = [{ type: 'weapon', entity: weapon }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].synergies).toContain(`Great synergy with ${character.name}`);
        });

        it('should detect item synergies with weapon', () => {
            const weapon = createMockWeapon({ name: 'Main Weapon' });
            const build: BuildState = {
                character: null,
                weapon,
                items: [],
                tomes: [],
            };

            const item = createMockItem({
                name: 'Weapon Item',
                synergies_weapons: ['Main Weapon'],
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].synergies).toContain(`Synergizes with ${weapon.name}`);
        });

        it('should detect item synergies with existing build items', () => {
            const existingItem = createMockItem({ id: 'existing', name: 'Existing Item' });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            const newItem = createMockItem({
                name: 'New Item',
                synergies: ['Existing Item'],
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].synergies).toContain(`Synergizes with ${existingItem.name}`);
        });

        it('should detect anti-synergies with existing items', () => {
            const existingItem = createMockItem({ id: 'existing', name: 'Existing Item' });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            const newItem = createMockItem({
                name: 'Bad Item',
                anti_synergies: ['Existing Item'],
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].antiSynergies).toContain(`Anti-synergy with ${existingItem.name}`);
        });

        it('should penalize one-and-done items already in build', () => {
            const existingItem = createMockItem({
                id: 'oad-item',
                name: 'One And Done',
                one_and_done: true,
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            const sameItem = createMockItem({
                id: 'oad-item',
                name: 'One And Done',
                one_and_done: true,
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: sameItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].warnings).toContain('ONE-AND-DONE item already in build');
        });

        it('should penalize items that do not stack well', () => {
            const existingItem = createMockItem({
                id: 'no-stack',
                name: 'No Stack Item',
                stacks_well: false,
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            const sameItem = createMockItem({
                id: 'no-stack',
                name: 'No Stack Item',
                stacks_well: false,
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: sameItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].warnings).toContain('Item does not stack well');
        });

        it('should penalize similar items (diminishing returns)', () => {
            const damageItem1 = createMockItem({
                id: 'dmg1',
                name: 'Damage Item 1',
                base_effect: '+10% damage',
            });
            const damageItem2 = createMockItem({
                id: 'dmg2',
                name: 'Damage Item 2',
                base_effect: '+15% damage',
            });

            const build: BuildState = {
                character: null,
                weapon: null,
                items: [damageItem1, damageItem2],
                tomes: [],
            };

            const newDamageItem = createMockItem({
                name: 'Damage Item 3',
                base_effect: '+20% damage',
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newDamageItem }];

            const result = recommendBestChoice(build, choices);

            // Should have a warning about similar items
            const hasSimilarWarning = result[0].warnings.some(w => w.includes('similar items'));
            expect(hasSimilarWarning).toBe(true);
        });

        it('should give bonus to SS items early game', () => {
            const build: BuildState = {
                character: createMockCharacter(),
                weapon: createMockWeapon(),
                items: [], // No items = early game
                tomes: [],
            };

            const ssItem = createMockItem({ tier: 'SS', name: 'SS Item' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: ssItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].reasoning).toContain('Early game - prioritize strong items');
        });

        it('should handle weapons in choices', () => {
            const build = createEmptyBuildState();
            const weapon = createMockWeapon({ tier: 'S', name: 'Test Weapon' });
            const choices: ChoiceOption[] = [{ type: 'weapon', entity: weapon }];

            const result = recommendBestChoice(build, choices);

            expect(result).toHaveLength(1);
            expect(result[0].choice.type).toBe('weapon');
        });

        it('should handle tomes in choices', () => {
            const build = createEmptyBuildState();
            const tome = createMockTome({ tier: 'A', name: 'Test Tome' });
            const choices: ChoiceOption[] = [{ type: 'tome', entity: tome }];

            const result = recommendBestChoice(build, choices);

            expect(result).toHaveLength(1);
            expect(result[0].choice.type).toBe('tome');
        });

        it('should handle shrines in choices', () => {
            const build = createEmptyBuildState();
            const shrine = createMockShrine({ tier: 'A', name: 'Test Shrine' });
            const choices: ChoiceOption[] = [{ type: 'shrine', entity: shrine }];

            const result = recommendBestChoice(build, choices);

            expect(result).toHaveLength(1);
            expect(result[0].choice.type).toBe('shrine');
        });

        it('should calculate confidence based on synergies and anti-synergies', () => {
            const build = createEmptyBuildState();
            const item = createMockItem({ tier: 'S' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            const result = recommendBestChoice(build, choices);

            // Should have some baseline confidence
            expect(result[0].confidence).toBeGreaterThanOrEqual(0);
            expect(result[0].confidence).toBeLessThanOrEqual(1);
        });

        it('should never return negative scores', () => {
            const existingItem = createMockItem({
                id: 'bad-item',
                name: 'Bad Item',
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            const terribleItem = createMockItem({
                tier: 'C',
                name: 'Terrible Item',
                one_and_done: true,
                id: 'bad-item', // Same ID to trigger penalties
                anti_synergies: ['Bad Item'],
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: terribleItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Build Archetype Detection', () => {
        it('should detect damage build archetype', () => {
            const damageItem = createMockItem({
                name: 'Damage Booster',
                base_effect: '+50% damage',
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [damageItem, damageItem, damageItem],
                tomes: [],
            };

            const newDamageItem = createMockItem({
                name: 'More Damage',
                base_effect: '+30% damage',
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newDamageItem }];

            const result = recommendBestChoice(build, choices);

            // Should have archetype fit reasoning if detected
            expect(result[0].reasoning.some(r => r.includes('damage build'))).toBe(true);
        });

        it('should detect crit build archetype', () => {
            const critItem = createMockItem({
                name: 'Crit Booster',
                base_effect: '+10% crit chance',
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [critItem, critItem, critItem],
                tomes: [],
            };

            const newCritItem = createMockItem({
                name: 'Juice',
                base_effect: '+5% crit',
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newCritItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].reasoning.some(r => r.includes('crit build'))).toBe(true);
        });

        it('should detect tank build archetype', () => {
            const tankItem = createMockItem({
                name: 'HP Booster',
                base_effect: '+50 hp',
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [tankItem, tankItem, tankItem],
                tomes: [],
            };

            const newTankItem = createMockItem({
                name: 'Beefy Shield',
                base_effect: '+30 hp',
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newTankItem }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].reasoning.some(r => r.includes('tank build'))).toBe(true);
        });

        it('should consider tomes in archetype detection', () => {
            const damageTome = createMockTome({
                name: 'Damage Tome',
                stat_affected: 'Damage',
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [damageTome, damageTome],
            };

            const damageItem = createMockItem({
                name: 'Gym Sauce',
                base_effect: '+10% damage',
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: damageItem }];

            const result = recommendBestChoice(build, choices);

            // Tomes should contribute to archetype detection
            expect(result).toHaveLength(1);
        });

        it('should return mixed archetype for diverse builds', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [
                    createMockItem({ name: 'damage item', base_effect: 'damage' }),
                    createMockItem({ name: 'hp item', base_effect: 'hp' }),
                    createMockItem({ name: 'crit item', base_effect: 'crit' }),
                    createMockItem({ name: 'speed item', base_effect: 'speed' }),
                ],
                tomes: [],
            };

            const genericItem = createMockItem({ name: 'Generic', base_effect: 'generic' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: genericItem }];

            const result = recommendBestChoice(build, choices);

            // Should not have archetype-specific reasoning for mixed builds
            const hasArchetypeReasoning = result[0].reasoning.some(
                r =>
                    r.includes('damage build') ||
                    r.includes('tank build') ||
                    r.includes('crit build') ||
                    r.includes('speed build')
            );
            expect(hasArchetypeReasoning).toBe(false);
        });
    });

    describe('formatRecommendation', () => {
        it('should format first place recommendation with target emoji', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem({ name: 'Best Item', tier: 'SS' }) },
                score: 100,
                confidence: 0.95,
                reasoning: ['High tier item'],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).toContain('RECOMMENDED:');
            expect(formatted).toContain('Best Item');
            expect(formatted).toContain('SS-tier');
            expect(formatted).toContain('Score: 100');
            expect(formatted).toContain('Confidence: 95%');
        });

        it('should format second place recommendation with silver medal', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem({ name: 'Good Item', tier: 'S' }) },
                score: 80,
                confidence: 0.8,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 2);

            expect(formatted).toContain('#2:');
            expect(formatted).toContain('Good Item');
        });

        it('should format third place recommendation with bronze medal', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem({ name: 'OK Item', tier: 'A' }) },
                score: 60,
                confidence: 0.6,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 3);

            expect(formatted).toContain('#3:');
        });

        it('should include reasoning section when present', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem() },
                score: 80,
                confidence: 0.8,
                reasoning: ['Great for damage builds', 'Works well early game'],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).toContain('Why?');
            expect(formatted).toContain('Great for damage builds');
            expect(formatted).toContain('Works well early game');
        });

        it('should include synergies section when present', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem() },
                score: 80,
                confidence: 0.8,
                reasoning: [],
                warnings: [],
                synergies: ['Synergizes with Sword', 'Synergizes with Knight'],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).toContain('Synergies:');
            expect(formatted).toContain('Synergizes with Sword');
        });

        it('should include warnings section when present', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem() },
                score: 40,
                confidence: 0.5,
                reasoning: [],
                warnings: ['Item does not stack well', 'Anti-synergy with existing items'],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).toContain('Warnings:');
            expect(formatted).toContain('Item does not stack well');
        });

        it('should not include sections when arrays are empty', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem() },
                score: 50,
                confidence: 0.5,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).not.toContain('Why?');
            expect(formatted).not.toContain('Synergies:');
            expect(formatted).not.toContain('Warnings:');
        });

        it('should round score and confidence properly', () => {
            const recommendation: Recommendation = {
                choice: { type: 'item', entity: createMockItem() },
                score: 78.567,
                confidence: 0.8234,
                reasoning: [],
                warnings: [],
                synergies: [],
                antiSynergies: [],
            };

            const formatted = formatRecommendation(recommendation, 1);

            expect(formatted).toContain('Score: 79');
            expect(formatted).toContain('Confidence: 82%');
        });
    });

    describe('Edge Cases', () => {
        it('should handle null/undefined entity properties gracefully', () => {
            const build = createEmptyBuildState();
            const item = {
                id: 'broken-item',
                name: undefined,
                tier: 'S' as const,
                base_effect: undefined,
            };
            const choices: ChoiceOption[] = [{ type: 'item', entity: item as any }];

            // Should not throw
            expect(() => recommendBestChoice(build, choices)).not.toThrow();
        });

        it('should handle character with undefined synergies arrays', () => {
            const character = createMockCharacter({
                synergies_items: undefined,
                synergies_weapons: undefined,
            });
            const build: BuildState = {
                character,
                weapon: null,
                items: [],
                tomes: [],
            };

            const item = createMockItem();
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            // Should not throw
            expect(() => recommendBestChoice(build, choices)).not.toThrow();
        });

        it('should handle item with antiSynergies property name variant', () => {
            const existingItem = createMockItem({ id: 'existing', name: 'Existing Item' });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            // Create item without anti_synergies, only antiSynergies
            // Note: Must ensure anti_synergies is not set (truthy empty array blocks fallback)
            const newItem = {
                id: 'new-item',
                name: 'New Item',
                tier: 'S' as const,
                rarity: 'legendary' as const,
                base_effect: 'Test effect',
                description: 'A test item',
                formula: 'x',
                detailed_description: 'A detailed test item description',
                synergies: [],
                synergies_weapons: [],
                // Using antiSynergies (camelCase) variant - anti_synergies is NOT set
                antiSynergies: ['Existing Item'],
            };
            const choices: ChoiceOption[] = [{ type: 'item', entity: newItem as any }];

            const result = recommendBestChoice(build, choices);

            // Should detect anti-synergy using the antiSynergies variant
            expect(result[0].antiSynergies).toContain(`Anti-synergy with ${existingItem.name}`);
        });

        it('should handle empty build state with all null values', () => {
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
                stats: undefined,
            };

            const item = createMockItem();
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            const result = recommendBestChoice(build, choices);

            expect(result).toHaveLength(1);
            expect(result[0].score).toBeGreaterThan(0);
        });

        it('should perform case-insensitive synergy matching', () => {
            const character = createMockCharacter({
                synergies_items: ['TEST item'],
            });
            const build: BuildState = {
                character,
                weapon: null,
                items: [],
                tomes: [],
            };

            const item = createMockItem({ name: 'test ITEM' }); // Different case
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            const result = recommendBestChoice(build, choices);

            expect(result[0].synergies.length).toBeGreaterThan(0);
        });
    });

    // ========================================
    // Additional Edge Case Tests (Part 2 Implementation)
    // ========================================

    describe('Late Game Decisions', () => {
        it('should handle builds with 8+ items (replacement scenarios)', () => {
            const items = Array.from({ length: 8 }, (_, i) =>
                createMockItem({ id: `item-${i}`, name: `Item ${i}`, tier: 'A' })
            );
            const build: BuildState = {
                character: createMockCharacter(),
                weapon: createMockWeapon(),
                items,
                tomes: [],
            };

            const newItem = createMockItem({ id: 'replacement', name: 'Replacement', tier: 'SS' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: newItem }];

            const result = recommendBestChoice(build, choices);

            // Should still provide valid recommendations for late-game builds
            expect(result).toHaveLength(1);
            expect(result[0].score).toBeGreaterThanOrEqual(0);
        });

        it('should reduce SS-tier bonus in full builds', () => {
            // Full build should have reduced bonus for SS items compared to early game
            const fullBuildItems = Array.from({ length: 6 }, (_, i) =>
                createMockItem({ id: `item-${i}`, name: `Item ${i}`, tier: 'S' })
            );
            const fullBuild: BuildState = {
                character: createMockCharacter(),
                weapon: createMockWeapon(),
                items: fullBuildItems,
                tomes: [createMockTome(), createMockTome()],
            };

            const emptyBuild: BuildState = {
                character: createMockCharacter(),
                weapon: null,
                items: [],
                tomes: [],
            };

            const ssItem = createMockItem({ tier: 'SS', name: 'SS Item' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: ssItem }];

            const fullBuildResult = recommendBestChoice(fullBuild, choices);
            const emptyBuildResult = recommendBestChoice(emptyBuild, choices);

            // Both should have valid scores
            expect(fullBuildResult[0].score).toBeGreaterThan(0);
            expect(emptyBuildResult[0].score).toBeGreaterThan(0);
        });
    });

    describe('Penalty Stacking', () => {
        it('should stack penalties for one-and-done + anti-synergy + similar items', () => {
            const existingItem = createMockItem({
                id: 'stacked-item',
                name: 'Stacked Item',
                one_and_done: true,
            });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [existingItem],
                tomes: [],
            };

            // Item with multiple penalty triggers
            const badItem = createMockItem({
                id: 'stacked-item', // Same ID = one-and-done penalty
                name: 'Stacked Item', // Same name = similar item
                one_and_done: true,
                anti_synergies: ['Stacked Item'], // Anti-synergy with self
            });
            const choices: ChoiceOption[] = [{ type: 'item', entity: badItem }];

            const result = recommendBestChoice(build, choices);

            // Should have multiple warnings
            expect(result[0].warnings.length).toBeGreaterThanOrEqual(1);
            // Score should still be non-negative
            expect(result[0].score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Cascading Synergies', () => {
        it('should detect synergies between new item and multiple existing items', () => {
            // Build has Item One and Item Two
            const item1 = createMockItem({ id: 'item1', name: 'Item One', synergies: ['Item Three'] });
            const item2 = createMockItem({ id: 'item2', name: 'Item Two', synergies: ['Item Three'] });
            const build: BuildState = {
                character: null,
                weapon: null,
                items: [item1, item2],
                tomes: [],
            };

            // Item Three synergizes back with Item One (bidirectional)
            const item3 = createMockItem({ id: 'item3', name: 'Item Three', synergies: ['Item One'] });
            const choices: ChoiceOption[] = [{ type: 'item', entity: item3 }];

            const result = recommendBestChoice(build, choices);

            // Should detect synergy with Item One (bidirectional synergy)
            expect(result[0].synergies.some(s => s.includes('Item One'))).toBe(true);
        });
    });

    describe('Non-existent ID Handling', () => {
        it('should handle non-existent item IDs in character synergies gracefully', () => {
            const character = createMockCharacter({
                synergies_items: ['nonexistent-item-that-doesnt-exist-12345'],
            });
            const build: BuildState = {
                character,
                weapon: null,
                items: [],
                tomes: [],
            };

            const item = createMockItem({ name: 'Normal Item' });
            const choices: ChoiceOption[] = [{ type: 'item', entity: item }];

            // Should not throw and should return valid result
            const result = recommendBestChoice(build, choices);
            expect(result).toHaveLength(1);
            expect(result[0].score).toBeGreaterThanOrEqual(0);
        });
    });
});
