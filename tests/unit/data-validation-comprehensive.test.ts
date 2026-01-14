/**
 * Tests for data-validation.ts - Data Validation Module
 * Tests validation of game data, cross-references, and schema validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    validateDataStructure,
    validateCrossReferences,
    validateRarity,
    validateTier,
    validateAllData,
    validateWithZod,
    logValidationResults,
    type LegacyValidationResult,
    type ComprehensiveValidationResult,
} from '../../src/modules/data-validation.ts';
import type { AllGameData, EntityType, Item, Weapon, Tome, Character, Shrine } from '../../src/types/index.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock schema-validator
vi.mock('../../src/modules/schema-validator.ts', () => ({
    validateItems: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid items data' };
        }
        return { success: true, data };
    }),
    validateWeapons: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid weapons data' };
        }
        return { success: true, data };
    }),
    validateTomes: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid tomes data' };
        }
        return { success: true, data };
    }),
    validateCharacters: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid characters data' };
        }
        return { success: true, data };
    }),
    validateShrines: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid shrines data' };
        }
        return { success: true, data };
    }),
    validateStats: vi.fn((data: unknown) => {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid stats data' };
        }
        return { success: true, data };
    }),
}));

describe('Data Validation Module', () => {
    describe('validateWithZod', () => {
        it('should validate items successfully', () => {
            const data = { items: [] };
            const result = validateWithZod(data, 'items');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.data).toBeDefined();
        });

        it('should validate weapons successfully', () => {
            const data = { weapons: [] };
            const result = validateWithZod(data, 'weapons');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate tomes successfully', () => {
            const data = { tomes: [] };
            const result = validateWithZod(data, 'tomes');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate characters successfully', () => {
            const data = { characters: [] };
            const result = validateWithZod(data, 'characters');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate shrines successfully', () => {
            const data = { shrines: [] };
            const result = validateWithZod(data, 'shrines');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate stats successfully', () => {
            const data = { stats: {} };
            const result = validateWithZod(data, 'stats');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid items data', () => {
            const result = validateWithZod(null, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject unknown data type', () => {
            const result = validateWithZod({}, 'unknown' as EntityType);

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Unknown data type');
        });

        it('should handle validation errors', () => {
            const result = validateWithZod('invalid', 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('validateDataStructure', () => {
        it('should validate valid data structure', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'item1',
                        name: 'Test Item',
                        rarity: 'rare',
                        tier: 'A',
                        detailed_description: 'Test',
                    },
                ],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null data', () => {
            const result = validateDataStructure(null, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('null or undefined');
        });

        it('should reject undefined data', () => {
            const result = validateDataStructure(undefined, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('null or undefined');
        });

        it('should detect missing version field', () => {
            const data = {
                last_updated: '2024-01-01',
                items: [],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'version'"))).toBe(true);
        });

        it('should detect missing last_updated field', () => {
            const data = {
                version: '1.0.0',
                items: [],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'last_updated'"))).toBe(true);
        });

        it('should detect missing data array', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('missing or not an array'))).toBe(true);
        });

        it('should detect non-array data field', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: 'not an array',
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not an array'))).toBe(true);
        });

        it('should detect missing id field in entity', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ name: 'Test', rarity: 'rare', tier: 'A' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'id'"))).toBe(true);
        });

        it('should detect missing name field in entity', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ id: 'item1', rarity: 'rare', tier: 'A' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'name'"))).toBe(true);
        });

        it('should detect missing rarity field for items', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ id: 'item1', name: 'Test', tier: 'A', detailed_description: 'Test' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'rarity'"))).toBe(true);
        });

        it('should detect missing tier field for items', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ id: 'item1', name: 'Test', rarity: 'rare', detailed_description: 'Test' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier'"))).toBe(true);
        });

        it('should detect missing detailed_description for items', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ id: 'item1', name: 'Test', rarity: 'rare', tier: 'A' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'detailed_description'"))).toBe(true);
        });

        it('should detect missing tier for weapons', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [{ id: 'wpn1', name: 'Sword' }],
            };

            const result = validateDataStructure(data, 'weapons');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier'"))).toBe(true);
        });

        it('should detect missing tier for tomes', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [{ id: 'tome1', name: 'Tome' }],
            };

            const result = validateDataStructure(data, 'tomes');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier'"))).toBe(true);
        });

        it('should detect missing tier for characters', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [{ id: 'char1', name: 'Hero' }],
            };

            const result = validateDataStructure(data, 'characters');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier'"))).toBe(true);
        });

        it('should include entity name/id in error messages', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ id: 'item1', name: 'TestItem', rarity: 'rare' }],
            };

            const result = validateDataStructure(data, 'items');

            expect(result.errors.some(e => e.includes('TestItem') || e.includes('item1'))).toBe(true);
        });
    });

    describe('validateCrossReferences', () => {
        let mockAllData: AllGameData;

        beforeEach(() => {
            mockAllData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: 'item1',
                            name: 'Item1',
                            tier: 'A',
                            rarity: 'rare',
                        } as Item,
                    ],
                },
                weapons: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [
                        {
                            id: 'wpn1',
                            name: 'Weapon1',
                            tier: 'A',
                        } as Weapon,
                    ],
                },
                tomes: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    tomes: [
                        {
                            id: 'tome1',
                            name: 'Tome1',
                            tier: 'A',
                        } as Tome,
                    ],
                },
                characters: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    characters: [
                        {
                            id: 'char1',
                            name: 'Character1',
                            tier: 'A',
                        } as Character,
                    ],
                },
                shrines: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    shrines: [] as Shrine[],
                },
                stats: null,
            };
        });

        it('should validate valid cross-references', () => {
            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null allData', () => {
            const result = validateCrossReferences(null);

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('null or undefined');
        });

        it('should reject undefined allData', () => {
            const result = validateCrossReferences(undefined);

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('null or undefined');
        });

        it('should detect invalid synergy reference in items', () => {
            mockAllData.items!.items = [
                {
                    id: 'item1',
                    name: 'Item1',
                    tier: 'A',
                    rarity: 'rare',
                    synergies: [{ with: 'nonexistent-item' }],
                } as Item,
            ];

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('nonexistent-item'))).toBe(true);
        });

        it('should handle synergies with array of references', () => {
            mockAllData.items!.items = [
                {
                    id: 'item1',
                    name: 'Item1',
                    tier: 'A',
                    rarity: 'rare',
                    synergies: [{ with: ['item1', 'nonexistent'] }],
                } as Item,
            ];

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
        });

        it('should validate character passive_item_ref', () => {
            (mockAllData.characters!.characters[0] as Character & { passive_item_ref?: string }).passive_item_ref =
                'item1';

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid character passive_item_ref', () => {
            (mockAllData.characters!.characters[0] as Character & { passive_item_ref?: string }).passive_item_ref =
                'nonexistent-item';

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('passive_item_ref'))).toBe(true);
        });

        it('should validate weapon upgrades_from', () => {
            mockAllData.weapons!.weapons.push({
                id: 'wpn2',
                name: 'Weapon2',
                tier: 'A',
                upgrades_from: 'wpn1',
            } as Weapon & { upgrades_from?: string });

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid weapon upgrades_from', () => {
            mockAllData.weapons!.weapons.push({
                id: 'wpn2',
                name: 'Weapon2',
                tier: 'A',
                upgrades_from: 'nonexistent-weapon',
            } as Weapon & { upgrades_from?: string });

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('upgrades_from'))).toBe(true);
        });

        it('should validate weapon upgrades_to as string', () => {
            (mockAllData.weapons!.weapons[0] as Weapon & { upgrades_to?: string }).upgrades_to = 'wpn1';

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
        });

        it('should validate weapon upgrades_to as array', () => {
            mockAllData.weapons!.weapons.push({
                id: 'wpn2',
                name: 'Weapon2',
                tier: 'A',
            } as Weapon);

            (mockAllData.weapons!.weapons[0] as Weapon & { upgrades_to?: string[] }).upgrades_to = ['wpn2'];

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid weapon upgrades_to', () => {
            (mockAllData.weapons!.weapons[0] as Weapon & { upgrades_to?: string }).upgrades_to =
                'nonexistent-weapon';

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('upgrades_to'))).toBe(true);
        });

        it('should handle missing items array', () => {
            delete mockAllData.items;

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true); // No errors, just empty ID sets
        });

        it('should handle empty data arrays gracefully', () => {
            mockAllData.items!.items = [];
            mockAllData.weapons!.weapons = [];
            mockAllData.tomes!.tomes = [];
            mockAllData.characters!.characters = [];

            const result = validateCrossReferences(mockAllData);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('validateRarity', () => {
        it('should accept valid rarities (lowercase)', () => {
            const entity = { id: 'test', name: 'Test', rarity: 'common' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors).toHaveLength(0);
        });

        it('should accept all valid rarities', () => {
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            validRarities.forEach(rarity => {
                const entity = { id: 'test', name: 'Test', rarity };
                const errors = validateRarity(entity, 'items', 0);

                expect(errors).toHaveLength(0);
            });
        });

        it('should reject invalid rarity', () => {
            const entity = { id: 'test', name: 'Test', rarity: 'invalid' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Invalid rarity');
        });

        it('should handle missing rarity gracefully', () => {
            const entity = { id: 'test', name: 'Test' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors).toHaveLength(0);
        });

        it('should include entity name in error message', () => {
            const entity = { id: 'test', name: 'TestItem', rarity: 'invalid' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors[0]).toContain('TestItem');
        });

        it('should list valid rarities in error message', () => {
            const entity = { id: 'test', name: 'Test', rarity: 'invalid' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors[0]).toContain('common');
            expect(errors[0]).toContain('uncommon');
            expect(errors[0]).toContain('rare');
            expect(errors[0]).toContain('epic');
            expect(errors[0]).toContain('legendary');
        });
    });

    describe('validateTier', () => {
        it('should accept valid tiers', () => {
            const validTiers = ['SS', 'S', 'A', 'B', 'C'];

            validTiers.forEach(tier => {
                const entity = { id: 'test', name: 'Test', tier };
                const errors = validateTier(entity, 'items', 0);

                expect(errors).toHaveLength(0);
            });
        });

        it('should reject invalid tier', () => {
            const entity = { id: 'test', name: 'Test', tier: 'Z' };
            const errors = validateTier(entity, 'items', 0);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Invalid tier');
        });

        it('should handle missing tier gracefully', () => {
            const entity = { id: 'test', name: 'Test' };
            const errors = validateTier(entity, 'items', 0);

            expect(errors).toHaveLength(0);
        });

        it('should include entity name in error message', () => {
            const entity = { id: 'test', name: 'TestItem', tier: 'Z' };
            const errors = validateTier(entity, 'items', 0);

            expect(errors[0]).toContain('TestItem');
        });

        it('should list valid tiers in error message', () => {
            const entity = { id: 'test', name: 'Test', tier: 'Z' };
            const errors = validateTier(entity, 'items', 0);

            expect(errors[0]).toContain('SS');
            expect(errors[0]).toContain('S');
            expect(errors[0]).toContain('A');
            expect(errors[0]).toContain('B');
            expect(errors[0]).toContain('C');
        });
    });

    describe('validateAllData', () => {
        let mockAllData: AllGameData;

        beforeEach(() => {
            mockAllData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        {
                            id: 'item1',
                            name: 'Item1',
                            rarity: 'rare',
                            tier: 'A',
                            detailed_description: 'Test',
                            image: 'item1.png',
                            tags: ['damage'],
                        } as Item,
                    ],
                },
                weapons: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    weapons: [{ id: 'wpn1', name: 'Weapon1', tier: 'A' } as Weapon],
                },
                tomes: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    tomes: [
                        { id: 'tome1', name: 'Tome1', tier: 'A', image: 'tome1.png', tags: ['buff'] } as Tome,
                    ],
                },
                characters: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    characters: [{ id: 'char1', name: 'Character1', tier: 'A' } as Character],
                },
                shrines: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    shrines: [] as Shrine[],
                },
                stats: null,
            };
        });

        it('should validate complete valid data', () => {
            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null data', () => {
            const result = validateAllData(null);

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('No data provided');
        });

        it('should warn about missing data types', () => {
            delete mockAllData.items;

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('items: Data not loaded'))).toBe(true);
        });

        it('should accumulate errors from structure validation', () => {
            mockAllData.items!.items[0] = { id: 'item1', name: 'Item1', tier: 'A' } as Item; // Missing rarity

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('rarity'))).toBe(true);
        });

        it('should validate rarities for all items', () => {
            mockAllData.items!.items[0].rarity = 'invalid' as any;

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid rarity'))).toBe(true);
        });

        it('should validate tiers for all items', () => {
            mockAllData.items!.items[0].tier = 'Z' as any;

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
        });

        it('should validate tiers for weapons', () => {
            mockAllData.weapons!.weapons[0].tier = 'Z' as any;

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
        });

        it('should validate tiers for tomes', () => {
            mockAllData.tomes!.tomes[0].tier = 'Z' as any;

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
        });

        it('should validate tiers for characters', () => {
            mockAllData.characters!.characters[0].tier = 'Z' as any;

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
        });

        it('should warn about missing image field', () => {
            delete mockAllData.items!.items[0].image;

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('Missing recommended') && w.includes('image'))).toBe(true);
        });

        it('should warn about missing tags field', () => {
            delete mockAllData.items!.items[0].tags;

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('Missing recommended') && w.includes('tags'))).toBe(true);
        });

        it('should warn about empty tags array', () => {
            mockAllData.items!.items[0].tags = [];

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('Missing recommended') && w.includes('tags'))).toBe(true);
        });

        it('should warn about missing tome image', () => {
            delete mockAllData.tomes!.tomes[0].image;

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('tomes') && w.includes('image'))).toBe(true);
        });

        it('should warn about missing tome tags', () => {
            delete mockAllData.tomes!.tomes[0].tags;

            const result = validateAllData(mockAllData);

            expect(result.warnings.some(w => w.includes('tomes') && w.includes('tags'))).toBe(true);
        });

        it('should accumulate cross-reference errors', () => {
            (mockAllData.characters!.characters[0] as Character & { passive_item_ref?: string }).passive_item_ref =
                'nonexistent';

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('passive_item_ref'))).toBe(true);
        });

        it('should return both errors and warnings', () => {
            mockAllData.items!.items[0].tier = 'Z' as any; // Error
            delete mockAllData.items!.items[0].image; // Warning

            const result = validateAllData(mockAllData);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('logValidationResults', () => {
        it('should log successful validation', () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings: [],
            };

            logValidationResults(result);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'data.validate',
                    success: true,
                    data: expect.objectContaining({
                        valid: true,
                        errorCount: 0,
                        warningCount: 0,
                    }),
                })
            );
        });

        it('should log validation with warnings', () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings: ['Warning 1', 'Warning 2'],
            };

            logValidationResults(result);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'data.validate',
                    data: expect.objectContaining({
                        warningCount: 2,
                    }),
                })
            );
        });

        it('should log failed validation', () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const result: ComprehensiveValidationResult = {
                valid: false,
                errors: ['Error 1', 'Error 2'],
                warnings: [],
            };

            logValidationResults(result);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'data.validate',
                    success: false,
                    data: expect.objectContaining({
                        valid: false,
                        errorCount: 2,
                    }),
                })
            );
        });

        it('should limit errors to first 10', () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const errors = Array.from({ length: 20 }, (_, i) => `Error ${i + 1}`);
            const result: ComprehensiveValidationResult = {
                valid: false,
                errors,
                warnings: [],
            };

            logValidationResults(result);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        errors: expect.arrayContaining([
                            'Error 1',
                            'Error 2',
                            'Error 3',
                            'Error 4',
                            'Error 5',
                            'Error 6',
                            'Error 7',
                            'Error 8',
                            'Error 9',
                            'Error 10',
                        ]),
                    }),
                })
            );

            const call = (logger.error as any).mock.calls[0][0];
            expect(call.data.errors).toHaveLength(10);
        });

        it('should limit warnings to first 10', () => {
            const { logger } = await import('../../src/modules/logger.ts');
            const warnings = Array.from({ length: 20 }, (_, i) => `Warning ${i + 1}`);
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings,
            };

            logValidationResults(result);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        warningCount: 20,
                    }),
                })
            );

            const call = (logger.warn as any).mock.calls[0][0];
            expect(call.data.warnings).toHaveLength(10);
        });
    });
});
