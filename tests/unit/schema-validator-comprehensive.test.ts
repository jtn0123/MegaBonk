/**
 * Tests for schema-validator.ts - Zod Schema Validation Module
 * Tests runtime validation of game data using Zod schemas
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    validateData,
    validateItems,
    validateWeapons,
    validateTomes,
    validateCharacters,
    validateShrines,
    validateStats,
    validateAllData as validateAllGameData,
    schemas,
    type ZodItemsData,
    type ZodWeaponsData,
    type ZodTomesData,
    type ZodCharactersData,
    type ZodShrinesData,
} from '../../src/modules/schema-validator.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe('Schema Validator Module', () => {
    describe('validateItems', () => {
        it('should validate valid items data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test Item',
                        rarity: 'rare',
                        tier: 'A',
                    },
                ],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should accept all valid rarity values', () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            rarities.forEach(rarity => {
                const data = {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: 'item1',
                            name: 'Test',
                            rarity,
                            tier: 'A',
                        },
                    ],
                };

                const result = validateItems(data);
                expect(result.success).toBe(true);
            });
        });

        it('should accept all valid tier values', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];

            tiers.forEach(tier => {
                const data = {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: 'item1',
                            name: 'Test',
                            rarity: 'rare',
                            tier,
                        },
                    ],
                };

                const result = validateItems(data);
                expect(result.success).toBe(true);
            });
        });

        it('should reject items with invalid rarity', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test',
                        rarity: 'invalid',
                        tier: 'A',
                    },
                ],
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid');
        });

        it('should reject items with invalid tier', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test',
                        rarity: 'rare',
                        tier: 'Z',
                    },
                ],
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject items missing required fields', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        name: 'Test', // Missing id
                        rarity: 'rare',
                        tier: 'A',
                    },
                ],
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('id');
        });

        it('should accept items with all optional fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test Item',
                        rarity: 'rare',
                        tier: 'A',
                        unlocked_by_default: true,
                        unlock_requirement: null,
                        unlock_cost_silver: 100,
                        base_effect: '+10% damage',
                        scaling_type: 'linear',
                        stacking_behavior: 'additive',
                        stacks_well: true,
                        stack_cap: null,
                        formula: '1 + 0.1 * stacks',
                        scaling_per_stack: [1, 2, 3],
                        detailed_description: 'Detailed description',
                        synergies: ['item2'],
                        anti_synergies: ['item3'],
                        notes: 'Some notes',
                        graph_type: 'linear',
                        one_and_done: false,
                        image: 'item1.png',
                    },
                ],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
        });

        it('should reject data missing version', () => {
            const invalidData = {
                last_updated: '2024-01-01',
                items: [],
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('version');
        });

        it('should reject data missing last_updated', () => {
            const invalidData = {
                version: '1.0.0',
                items: [],
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('last_updated');
        });

        it('should reject data with non-array items', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: 'not an array',
            };

            const result = validateItems(invalidData);

            expect(result.success).toBe(false);
        });

        it('should accept empty items array', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
        });

        it('should allow extra fields with passthrough', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                total_items: 77,
                extra_field: 'allowed',
                items: [],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
        });
    });

    describe('validateWeapons', () => {
        it('should validate valid weapons data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'wpn1',
                        name: 'Sword',
                        tier: 'A',
                    },
                ],
            };

            const result = validateWeapons(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should accept all valid tier values for weapons', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];

            tiers.forEach(tier => {
                const data = {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [
                        {
                            id: 'wpn1',
                            name: 'Weapon',
                            tier,
                        },
                    ],
                };

                const result = validateWeapons(data);
                expect(result.success).toBe(true);
            });
        });

        it('should accept weapons with all optional fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'wpn1',
                        name: 'Sword',
                        tier: 'A',
                        base_damage: 10,
                        base_projectile_count: 1,
                        attack_pattern: 'melee',
                        upgradeable_stats: ['damage', 'speed'],
                        unlock_requirement: null,
                        unlock_cost_silver: 50,
                        unlocked_by_default: true,
                        description: 'A sword',
                        best_for: ['melee builds'],
                        synergies_items: ['item1'],
                        synergies_tomes: ['tome1'],
                        synergies_characters: ['char1'],
                        playstyle: 'aggressive',
                        pros: ['high damage'],
                        cons: ['short range'],
                        image: 'sword.png',
                    },
                ],
            };

            const result = validateWeapons(validData);

            expect(result.success).toBe(true);
        });

        it('should reject weapons missing required fields', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'wpn1',
                        name: 'Sword',
                        // Missing tier
                    },
                ],
            };

            const result = validateWeapons(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('tier');
        });

        it('should reject weapons with invalid tier', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'wpn1',
                        name: 'Sword',
                        tier: 'Z',
                    },
                ],
            };

            const result = validateWeapons(invalidData);

            expect(result.success).toBe(false);
        });
    });

    describe('validateTomes', () => {
        it('should validate valid tomes data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    {
                        id: 'tome1',
                        name: 'Tome of Power',
                        tier: 'S',
                    },
                ],
            };

            const result = validateTomes(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should accept tomes with all optional fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    {
                        id: 'tome1',
                        name: 'Tome',
                        tier: 'S',
                        stat_affected: 'Damage',
                        value_per_level: '+5%',
                        unlocked_by_default: true,
                        unlock_requirement: null,
                        unlock_cost_silver: 75,
                        max_level: 10,
                        description: 'A tome',
                        priority: 1,
                        recommended_for: ['damage builds'],
                        synergies_items: ['item1'],
                        synergies_weapons: ['wpn1'],
                        synergies_characters: ['char1'],
                        notes: 'Good tome',
                        image: 'tome.png',
                    },
                ],
            };

            const result = validateTomes(validData);

            expect(result.success).toBe(true);
        });

        it('should reject tomes with invalid tier', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    {
                        id: 'tome1',
                        name: 'Tome',
                        tier: 'Invalid',
                    },
                ],
            };

            const result = validateTomes(invalidData);

            expect(result.success).toBe(false);
        });
    });

    describe('validateCharacters', () => {
        it('should validate valid characters data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    {
                        id: 'char1',
                        name: 'Hero',
                        tier: 'S',
                    },
                ],
            };

            const result = validateCharacters(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should accept characters with all optional fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    {
                        id: 'char1',
                        name: 'Hero',
                        tier: 'S',
                        starting_weapon: 'Sword',
                        passive_ability: 'Strong',
                        passive_description: 'Very strong',
                        unlock_requirement: null,
                        unlock_cost_silver: 100,
                        unlocked_by_default: true,
                        playstyle: 'aggressive',
                        best_for: ['beginners'],
                        strengths: ['high damage'],
                        weaknesses: ['low hp'],
                        synergies_items: ['item1'],
                        synergies_tomes: ['tome1'],
                        synergies_weapons: ['wpn1'],
                        build_tips: 'Focus on damage',
                        image: 'hero.png',
                    },
                ],
            };

            const result = validateCharacters(validData);

            expect(result.success).toBe(true);
        });

        it('should reject characters missing required id', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    {
                        name: 'Hero',
                        tier: 'S',
                    },
                ],
            };

            const result = validateCharacters(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('id');
        });
    });

    describe('validateShrines', () => {
        it('should validate valid shrines data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    {
                        id: 'shrine1',
                        name: 'Healing Shrine',
                    },
                ],
            };

            const result = validateShrines(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should accept shrines with all optional fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    {
                        id: 'shrine1',
                        name: 'Healing Shrine',
                        type: 'healing',
                        icon: '💚',
                        description: 'Heals you',
                        activation: 'Touch',
                        reward: 'HP',
                        reusable: true,
                        spawn_count: '1-3',
                        map_icon: 'green_cross',
                        best_for: ['tank builds'],
                        synergies_items: ['item1'],
                        strategy: 'Use when low HP',
                        notes: 'Very useful',
                        image: 'shrine.png',
                    },
                ],
            };

            const result = validateShrines(validData);

            expect(result.success).toBe(true);
        });

        it('should reject shrines missing required name', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    {
                        id: 'shrine1',
                    },
                ],
            };

            const result = validateShrines(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('name');
        });
    });

    describe('validateStats', () => {
        it('should validate valid stats data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
            };

            const result = validateStats(validData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should accept stats with mechanics', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                mechanics: {
                    damage: 'Base damage formula',
                    crit: 'Crit chance formula',
                },
            };

            const result = validateStats(validData);

            expect(result.success).toBe(true);
        });

        it('should accept stats with breakpoints', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                breakpoints: {
                    attack_speed: [1.0, 1.5, 2.0],
                },
            };

            const result = validateStats(validData);

            expect(result.success).toBe(true);
        });

        it('should accept empty stats object', () => {
            const validData = {};

            const result = validateStats(validData);

            expect(result.success).toBe(true);
        });
    });

    describe('validateAllData', () => {
        it('should validate all game data types', () => {
            const allData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [],
                },
                weapons: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [],
                },
                tomes: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    tomes: [],
                },
                characters: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    characters: [],
                },
                shrines: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    shrines: [],
                },
                stats: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                },
            };

            const results = validateAllGameData(allData);

            expect(results.allValid).toBe(true);
            expect(results.items?.success).toBe(true);
            expect(results.weapons?.success).toBe(true);
            expect(results.tomes?.success).toBe(true);
            expect(results.characters?.success).toBe(true);
            expect(results.shrines?.success).toBe(true);
            expect(results.stats?.success).toBe(true);
        });

        it('should handle partial data validation', () => {
            const partialData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [],
                },
            };

            const results = validateAllGameData(partialData);

            expect(results.items?.success).toBe(true);
            expect(results.weapons).toBeNull();
            expect(results.tomes).toBeNull();
        });

        it('should set allValid to false if any validation fails', () => {
            const mixedData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [],
                },
                weapons: {
                    // Missing version
                    last_updated: '2024-01-01',
                    weapons: [],
                },
            };

            const results = validateAllGameData(mixedData);

            expect(results.allValid).toBe(false);
            expect(results.items?.success).toBe(true);
            expect(results.weapons?.success).toBe(false);
        });

        it('should handle all data types being invalid', () => {
            const invalidData = {
                items: { invalid: 'data' },
                weapons: { invalid: 'data' },
                tomes: { invalid: 'data' },
                characters: { invalid: 'data' },
                shrines: { invalid: 'data' },
                stats: null,
            };

            const results = validateAllGameData(invalidData);

            expect(results.allValid).toBe(false);
            expect(results.items?.success).toBe(false);
            expect(results.weapons?.success).toBe(false);
            expect(results.tomes?.success).toBe(false);
            expect(results.characters?.success).toBe(false);
            expect(results.shrines?.success).toBe(false);
        });

        it('should handle empty data object', () => {
            const results = validateAllGameData({});

            expect(results.allValid).toBe(true);
            expect(results.items).toBeNull();
            expect(results.weapons).toBeNull();
        });
    });

    describe('validateData (generic function)', () => {
        it('should validate data with any schema', () => {
            const result = validateData(
                {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [],
                },
                schemas.ItemsData,
                'items'
            );

            expect(result.success).toBe(true);
        });

        it('should return validation errors for invalid data', () => {
            const result = validateData({ invalid: 'data' }, schemas.ItemsData, 'items');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid items data');
        });

        it('should log validation errors', () => {
            const { logger } = await import('../../src/modules/logger.ts');

            validateData({ invalid: 'data' }, schemas.ItemsData, 'items');

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'schema.validate',
                    data: expect.objectContaining({
                        dataType: 'items',
                    }),
                })
            );
        });

        it('should include zodError in result for Zod errors', () => {
            const result = validateData({ invalid: 'data' }, schemas.ItemsData, 'items');

            expect(result.success).toBe(false);
            expect(result.zodError).toBeDefined();
        });
    });

    describe('schemas export', () => {
        it('should export all schemas', () => {
            expect(schemas).toHaveProperty('Item');
            expect(schemas).toHaveProperty('Weapon');
            expect(schemas).toHaveProperty('Tome');
            expect(schemas).toHaveProperty('Character');
            expect(schemas).toHaveProperty('Shrine');
            expect(schemas).toHaveProperty('Stats');
            expect(schemas).toHaveProperty('ItemsData');
            expect(schemas).toHaveProperty('WeaponsData');
            expect(schemas).toHaveProperty('TomesData');
            expect(schemas).toHaveProperty('CharactersData');
            expect(schemas).toHaveProperty('ShrinesData');
        });

        it('should have working schemas', () => {
            const result = schemas.Item.safeParse({
                id: 'item1',
                name: 'Test',
                rarity: 'rare',
                tier: 'A',
            });

            expect(result.success).toBe(true);
        });

        it('should be readonly', () => {
            expect(() => {
                (schemas as any).NewSchema = {};
            }).toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should format Zod error messages clearly', () => {
            const result = validateItems({
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test',
                        rarity: 'invalid',
                        tier: 'Z',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid items data');
        });

        it('should handle non-Zod errors gracefully', () => {
            const throwingSchema = {
                parse: () => {
                    throw new Error('Custom error');
                },
            } as any;

            const result = validateData({}, throwingSchema, 'test');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Custom error');
        });

        it('should handle unknown errors', () => {
            const throwingSchema = {
                parse: () => {
                    throw 'String error';
                },
            } as any;

            const result = validateData({}, throwingSchema, 'test');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown error');
        });
    });

    describe('Data Type Coverage', () => {
        it('should validate multiple items', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Item 1',
                        rarity: 'rare',
                        tier: 'A',
                    },
                    {
                        id: 'item2',
                        name: 'Item 2',
                        rarity: 'epic',
                        tier: 'S',
                    },
                ],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
            expect((result.data as ZodItemsData).items).toHaveLength(2);
        });

        it('should validate complex nested structures', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Complex Item',
                        rarity: 'legendary',
                        tier: 'SS',
                        synergies: ['item2', 'item3', 'weapon1'],
                        anti_synergies: ['item4'],
                        scaling_per_stack: [1, 2, 3, 4, 5],
                    },
                ],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
        });

        it('should handle null values in optional nullable fields', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Item',
                        rarity: 'rare',
                        tier: 'A',
                        unlock_requirement: null,
                        stack_cap: null,
                    },
                ],
            };

            const result = validateItems(validData);

            expect(result.success).toBe(true);
        });
    });
});
