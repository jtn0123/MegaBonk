import { describe, it, expect } from 'vitest';
import {
    validateItems,
    validateWeapons,
    validateTomes,
    validateCharacters,
    validateShrines,
    validateStats,
    validateAllData,
    schemas,
} from '../../src/modules/schema-validator.ts';

describe('Schema Validator Module', () => {
    describe('validateItems()', () => {
        it('should accept valid items data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'test_item',
                        name: 'Test Item',
                        rarity: 'common',
                        tier: 'A',
                    },
                ],
            };
            const result = validateItems(validData);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should reject items with invalid rarity', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'test_item',
                        name: 'Test Item',
                        rarity: 'mythic', // Invalid rarity
                        tier: 'A',
                    },
                ],
            };
            const result = validateItems(invalidData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('rarity');
        });

        it('should reject items with invalid tier', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'test_item',
                        name: 'Test Item',
                        rarity: 'rare',
                        tier: 'X', // Invalid tier
                    },
                ],
            };
            const result = validateItems(invalidData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('tier');
        });

        it('should accept items with optional fields missing', () => {
            const minimalData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'minimal_item',
                        name: 'Minimal Item',
                        rarity: 'common',
                        tier: 'C',
                        // No base_effect, scaling_per_stack, etc.
                    },
                ],
            };
            const result = validateItems(minimalData);
            expect(result.success).toBe(true);
        });

        it('should accept items with null unlock_requirement', () => {
            const dataWithNull = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'locked_item',
                        name: 'Locked Item',
                        rarity: 'legendary',
                        tier: 'SS',
                        unlock_requirement: null,
                    },
                ],
            };
            const result = validateItems(dataWithNull);
            expect(result.success).toBe(true);
        });

        it('should accept all valid rarities', () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            for (const rarity of rarities) {
                const data = {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: `${rarity}_item`,
                            name: `${rarity} Item`,
                            rarity,
                            tier: 'A',
                        },
                    ],
                };
                const result = validateItems(data);
                expect(result.success).toBe(true);
            }
        });

        it('should accept all valid tiers', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];
            for (const tier of tiers) {
                const data = {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: `tier_${tier}_item`,
                            name: `Tier ${tier} Item`,
                            rarity: 'common',
                            tier,
                        },
                    ],
                };
                const result = validateItems(data);
                expect(result.success).toBe(true);
            }
        });

        it('should reject data missing required version field', () => {
            const missingVersion = {
                last_updated: '2024-01-01',
                items: [],
            };
            const result = validateItems(missingVersion);
            expect(result.success).toBe(false);
        });

        it('should accept items with scaling_per_stack array', () => {
            const dataWithScaling = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'scaling_item',
                        name: 'Scaling Item',
                        rarity: 'rare',
                        tier: 'A',
                        scaling_per_stack: [10, 20, 30, 40, 50],
                    },
                ],
            };
            const result = validateItems(dataWithScaling);
            expect(result.success).toBe(true);
        });
    });

    describe('validateWeapons()', () => {
        it('should accept valid weapons data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'test_weapon',
                        name: 'Test Weapon',
                        tier: 'S',
                    },
                ],
            };
            const result = validateWeapons(validData);
            expect(result.success).toBe(true);
        });

        it('should reject weapons with invalid tier', () => {
            const invalidData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'test_weapon',
                        name: 'Test Weapon',
                        tier: 'Z', // Invalid
                    },
                ],
            };
            const result = validateWeapons(invalidData);
            expect(result.success).toBe(false);
        });

        it('should accept weapons with synergies arrays', () => {
            const dataWithSynergies = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'synergy_weapon',
                        name: 'Synergy Weapon',
                        tier: 'A',
                        synergies_items: ['item1', 'item2'],
                        synergies_tomes: ['damage', 'precision'],
                        synergies_characters: ['fox', 'chad'],
                    },
                ],
            };
            const result = validateWeapons(dataWithSynergies);
            expect(result.success).toBe(true);
        });
    });

    describe('validateTomes()', () => {
        it('should accept valid tomes data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    {
                        id: 'damage',
                        name: 'Damage Tome',
                        tier: 'SS',
                    },
                ],
            };
            const result = validateTomes(validData);
            expect(result.success).toBe(true);
        });

        it('should accept tomes with priority field', () => {
            const dataWithPriority = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    {
                        id: 'priority_tome',
                        name: 'Priority Tome',
                        tier: 'S',
                        priority: 1,
                    },
                ],
            };
            const result = validateTomes(dataWithPriority);
            expect(result.success).toBe(true);
        });
    });

    describe('validateCharacters()', () => {
        it('should accept valid characters data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    {
                        id: 'test_char',
                        name: 'Test Character',
                        tier: 'A',
                    },
                ],
            };
            const result = validateCharacters(validData);
            expect(result.success).toBe(true);
        });

        it('should accept characters with all optional fields', () => {
            const fullData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    {
                        id: 'full_char',
                        name: 'Full Character',
                        tier: 'SS',
                        starting_weapon: 'Test Weapon',
                        passive_ability: 'Test Passive',
                        passive_description: 'Description',
                        playstyle: 'Aggressive',
                        strengths: ['Strong', 'Fast'],
                        weaknesses: ['Fragile'],
                        synergies_items: ['item1'],
                        synergies_tomes: ['damage'],
                        synergies_weapons: ['weapon1'],
                    },
                ],
            };
            const result = validateCharacters(fullData);
            expect(result.success).toBe(true);
        });
    });

    describe('validateShrines()', () => {
        it('should accept valid shrines data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    {
                        id: 'test_shrine',
                        name: 'Test Shrine',
                    },
                ],
            };
            const result = validateShrines(validData);
            expect(result.success).toBe(true);
        });

        it('should accept shrines with reusable boolean', () => {
            const dataWithReusable = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    {
                        id: 'reusable_shrine',
                        name: 'Reusable Shrine',
                        reusable: true,
                    },
                ],
            };
            const result = validateShrines(dataWithReusable);
            expect(result.success).toBe(true);
        });
    });

    describe('validateStats()', () => {
        it('should accept valid stats data', () => {
            const validData = {
                version: '1.0.0',
                last_updated: '2024-01-01',
            };
            const result = validateStats(validData);
            expect(result.success).toBe(true);
        });

        it('should accept stats with mechanics object', () => {
            const dataWithMechanics = {
                version: '1.0.0',
                mechanics: {
                    damage: { formula: 'base * multiplier' },
                },
            };
            const result = validateStats(dataWithMechanics);
            expect(result.success).toBe(true);
        });
    });

    describe('validateAllData()', () => {
        it('should return allValid true when all validations pass', () => {
            const allData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [{ id: 'item', name: 'Item', rarity: 'common', tier: 'C' }],
                },
                weapons: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [{ id: 'weapon', name: 'Weapon', tier: 'A' }],
                },
            };
            const result = validateAllData(allData);
            expect(result.allValid).toBe(true);
            expect(result.items?.success).toBe(true);
            expect(result.weapons?.success).toBe(true);
        });

        it('should return allValid false if any validation fails', () => {
            const mixedData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [{ id: 'item', name: 'Item', rarity: 'invalid', tier: 'A' }],
                },
                weapons: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [{ id: 'weapon', name: 'Weapon', tier: 'A' }],
                },
            };
            const result = validateAllData(mixedData);
            expect(result.allValid).toBe(false);
            expect(result.items?.success).toBe(false);
            expect(result.weapons?.success).toBe(true);
        });

        it('should handle empty allData object', () => {
            const result = validateAllData({});
            expect(result.allValid).toBe(true);
            expect(result.items).toBeNull();
            expect(result.weapons).toBeNull();
        });

        it('should validate only provided data types', () => {
            const partialData = {
                tomes: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    tomes: [{ id: 'tome', name: 'Tome', tier: 'S' }],
                },
            };
            const result = validateAllData(partialData);
            expect(result.allValid).toBe(true);
            expect(result.tomes?.success).toBe(true);
            expect(result.items).toBeNull();
        });
    });

    describe('schemas export', () => {
        it('should export all schemas', () => {
            expect(schemas.Item).toBeDefined();
            expect(schemas.Weapon).toBeDefined();
            expect(schemas.Tome).toBeDefined();
            expect(schemas.Character).toBeDefined();
            expect(schemas.Shrine).toBeDefined();
            expect(schemas.Stats).toBeDefined();
            expect(schemas.ItemsData).toBeDefined();
            expect(schemas.WeaponsData).toBeDefined();
            expect(schemas.TomesData).toBeDefined();
            expect(schemas.CharactersData).toBeDefined();
            expect(schemas.ShrinesData).toBeDefined();
        });

        it('should allow direct schema validation', () => {
            const validItem = {
                id: 'direct_item',
                name: 'Direct Item',
                rarity: 'epic',
                tier: 'S',
            };
            const result = schemas.Item.safeParse(validItem);
            expect(result.success).toBe(true);
        });

        it('should reject invalid data with direct schema', () => {
            const invalidItem = {
                id: 'invalid',
                name: 'Invalid',
                rarity: 'super_rare', // Invalid
                tier: 'S',
            };
            const result = schemas.Item.safeParse(invalidItem);
            expect(result.success).toBe(false);
        });
    });
});
