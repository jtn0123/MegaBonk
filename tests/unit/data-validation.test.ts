/**
 * @vitest-environment jsdom
 * Data Validation Module - Comprehensive Tests
 * Tests for data validation, cross-reference checking, and Zod schema integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    validateWithZod,
    validateDataStructure,
    validateCrossReferences,
    validateRarity,
    validateTier,
    validateAllData,
    logValidationResults,
    type LegacyValidationResult,
    type ComprehensiveValidationResult,
    type ZodValidationResult,
} from '../../src/modules/data-validation.ts';

import { logger } from '../../src/modules/logger.ts';

// ========================================
// Test Data Factories
// ========================================

const createValidItemsData = () => ({
    version: '1.0',
    last_updated: '2024-01-01',
    items: [
        {
            id: 'sword',
            name: 'Sword',
            rarity: 'common',
            tier: 'B',
            detailed_description: 'A basic sword',
            image: 'sword.png',
            tags: ['weapon', 'melee'],
        },
        {
            id: 'shield',
            name: 'Shield',
            rarity: 'rare',
            tier: 'A',
            detailed_description: 'A sturdy shield',
            image: 'shield.png',
            tags: ['defense'],
        },
    ],
});

const createValidWeaponsData = () => ({
    version: '1.0',
    last_updated: '2024-01-01',
    weapons: [
        {
            id: 'katana',
            name: 'Katana',
            tier: 'S',
            description: 'A sharp blade',
        },
        {
            id: 'bow',
            name: 'Bow',
            tier: 'A',
            description: 'A ranged weapon',
            upgrades_from: 'katana',
        },
    ],
});

const createValidTomesData = () => ({
    version: '1.0',
    last_updated: '2024-01-01',
    tomes: [
        {
            id: 'fire_tome',
            name: 'Fire Tome',
            tier: 'SS',
            description: 'Burns enemies',
        },
    ],
});

const createValidCharactersData = () => ({
    version: '1.0',
    last_updated: '2024-01-01',
    characters: [
        {
            id: 'hero',
            name: 'Hero',
            tier: 'S',
            passive_ability: 'Courage',
        },
    ],
});

const createValidShrinesData = () => ({
    version: '1.0',
    last_updated: '2024-01-01',
    shrines: [
        {
            id: 'power_shrine',
            name: 'Power Shrine',
            type: 'stat_upgrade',
            description: 'Increases power',
        },
    ],
});

const createValidAllData = () => ({
    items: createValidItemsData(),
    weapons: createValidWeaponsData(),
    tomes: createValidTomesData(),
    characters: createValidCharactersData(),
    shrines: createValidShrinesData(),
});

// ========================================
// Test Suite
// ========================================

describe('Data Validation Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // validateWithZod Tests
    // ========================================
    describe('validateWithZod', () => {
        it('should validate valid items data', () => {
            const data = createValidItemsData();
            const result = validateWithZod(data, 'items');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.data).toBeDefined();
        });

        it('should validate valid weapons data', () => {
            const data = createValidWeaponsData();
            const result = validateWithZod(data, 'weapons');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should validate valid tomes data', () => {
            const data = createValidTomesData();
            const result = validateWithZod(data, 'tomes');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should validate valid characters data', () => {
            const data = createValidCharactersData();
            const result = validateWithZod(data, 'characters');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should validate valid shrines data', () => {
            const data = createValidShrinesData();
            const result = validateWithZod(data, 'shrines');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should validate valid stats data', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                mechanics: {},
                breakpoints: {},
            };
            const result = validateWithZod(data, 'stats');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return error for unknown data type', () => {
            const data = { version: '1.0' };
            const result = validateWithZod(data, 'unknown' as any);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Unknown data type: unknown');
        });

        it('should return error for invalid items data (missing required fields)', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ id: 'test' }], // Missing name, rarity, tier
            };
            const result = validateWithZod(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should return error for invalid rarity value', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [
                    {
                        id: 'test',
                        name: 'Test',
                        rarity: 'invalid_rarity', // Invalid
                        tier: 'A',
                    },
                ],
            };
            const result = validateWithZod(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Invalid');
        });

        it('should return error for invalid tier value', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                weapons: [
                    {
                        id: 'test',
                        name: 'Test',
                        tier: 'Z', // Invalid tier
                    },
                ],
            };
            const result = validateWithZod(data, 'weapons');

            expect(result.valid).toBe(false);
        });
    });

    // ========================================
    // validateDataStructure Tests
    // ========================================
    describe('validateDataStructure', () => {
        it('should validate valid items structure', () => {
            const data = createValidItemsData();
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return error for null data', () => {
            const result = validateDataStructure(null, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('items: Data is null or undefined');
        });

        it('should return error for undefined data', () => {
            const result = validateDataStructure(undefined, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('items: Data is null or undefined');
        });

        it('should return error for missing version field', () => {
            const data = {
                last_updated: '2024-01-01',
                items: [],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("items: Missing 'version' field");
        });

        it('should return error for missing last_updated field', () => {
            const data = {
                version: '1.0',
                items: [],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("items: Missing 'last_updated' field");
        });

        it('should return error for missing data array', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                // No items array
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('items: Data array is missing or not an array');
        });

        it('should return error for data array that is not an array', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: 'not an array',
            };
            const result = validateDataStructure(data as any, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('items: Data array is missing or not an array');
        });

        it('should return error for entity missing id', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ name: 'Test' }],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("items[0]: Missing 'id' field");
        });

        it('should return error for entity missing name', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ id: 'test' }],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("items[0]: Missing 'name' field");
        });

        it('should return error for items missing rarity', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ id: 'test', name: 'Test', tier: 'A', detailed_description: 'Test' }],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'rarity' field"))).toBe(true);
        });

        it('should return error for items missing tier', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ id: 'test', name: 'Test', rarity: 'common', detailed_description: 'Test' }],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier' field"))).toBe(true);
        });

        it('should return error for items missing detailed_description', () => {
            const data = {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [{ id: 'test', name: 'Test', rarity: 'common', tier: 'A' }],
            };
            const result = validateDataStructure(data, 'items');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'detailed_description' field"))).toBe(true);
        });

        it('should return error for weapons/tomes/characters missing tier', () => {
            const weaponData = {
                version: '1.0',
                last_updated: '2024-01-01',
                weapons: [{ id: 'test', name: 'Test' }],
            };
            const result = validateDataStructure(weaponData, 'weapons');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("Missing 'tier' field"))).toBe(true);
        });

        it('should validate weapons structure correctly', () => {
            const data = createValidWeaponsData();
            const result = validateDataStructure(data, 'weapons');

            expect(result.valid).toBe(true);
        });

        it('should validate shrines structure correctly (no tier required)', () => {
            const data = createValidShrinesData();
            const result = validateDataStructure(data, 'shrines');

            expect(result.valid).toBe(true);
        });
    });

    // ========================================
    // validateCrossReferences Tests
    // ========================================
    describe('validateCrossReferences', () => {
        it('should validate valid cross-references', () => {
            const allData = createValidAllData();
            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return error for null allData', () => {
            const result = validateCrossReferences(null);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Cross-reference validation: allData is null or undefined');
        });

        it('should return error for undefined allData', () => {
            const result = validateCrossReferences(undefined);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Cross-reference validation: allData is null or undefined');
        });

        it('should detect invalid synergy references', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: 'nonexistent_item' }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("references unknown entity 'nonexistent_item'"))).toBe(true);
        });

        it('should accept valid synergy references to existing items', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: 'shield' }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should accept synergy references to weapons', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: 'katana' }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should accept synergy references to tomes', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: 'fire_tome' }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should accept synergy references to characters', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: 'hero' }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid passive_item_ref in characters', () => {
            const allData = createValidAllData();
            (allData.characters.characters[0] as any).passive_item_ref = 'nonexistent_item';

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("passive_item_ref 'nonexistent_item' not found"))).toBe(true);
        });

        it('should accept valid passive_item_ref in characters', () => {
            const allData = createValidAllData();
            (allData.characters.characters[0] as any).passive_item_ref = 'sword';

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid upgrades_from in weapons', () => {
            const allData = createValidAllData();
            (allData.weapons.weapons[0] as any).upgrades_from = 'nonexistent_weapon';

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("upgrades_from 'nonexistent_weapon' not found"))).toBe(true);
        });

        it('should accept valid upgrades_from in weapons', () => {
            const allData = createValidAllData();
            (allData.weapons.weapons[0] as any).upgrades_from = 'bow';

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid upgrades_to in weapons (single)', () => {
            const allData = createValidAllData();
            (allData.weapons.weapons[0] as any).upgrades_to = 'nonexistent_weapon';

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("upgrades_to 'nonexistent_weapon' not found"))).toBe(true);
        });

        it('should detect invalid upgrades_to in weapons (array)', () => {
            const allData = createValidAllData();
            (allData.weapons.weapons[0] as any).upgrades_to = ['bow', 'nonexistent_weapon'];

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("upgrades_to 'nonexistent_weapon' not found"))).toBe(true);
        });

        it('should handle synergies with array of references', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [{ with: ['shield', 'nonexistent'] }] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes("references unknown entity 'nonexistent'"))).toBe(true);
        });

        it('should handle missing items/weapons/tomes/characters gracefully', () => {
            const allData = {
                items: { items: [] },
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
            };

            const result = validateCrossReferences(allData as any);

            expect(result.valid).toBe(true);
        });
    });

    // ========================================
    // validateRarity Tests
    // ========================================
    describe('validateRarity', () => {
        it('should accept valid rarities', () => {
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            validRarities.forEach(rarity => {
                const entity = { rarity };
                const errors = validateRarity(entity, 'items', 0);
                expect(errors).toEqual([]);
            });
        });

        it('should accept uppercase rarities (case insensitive)', () => {
            const entity = { rarity: 'COMMON' };
            const errors = validateRarity(entity, 'items', 0);
            expect(errors).toEqual([]);
        });

        it('should return error for invalid rarity', () => {
            const entity = { name: 'Test', rarity: 'mythical' };
            const errors = validateRarity(entity, 'items', 0);

            expect(errors.length).toBe(1);
            expect(errors[0]).toContain("Invalid rarity 'mythical'");
            expect(errors[0]).toContain('Must be one of:');
        });

        it('should return empty array when rarity is undefined', () => {
            const entity = { name: 'Test' };
            const errors = validateRarity(entity, 'items', 0);
            expect(errors).toEqual([]);
        });

        it('should include entity name in error message', () => {
            const entity = { name: 'Magic Sword', rarity: 'invalid' };
            const errors = validateRarity(entity, 'items', 5);

            expect(errors[0]).toContain('items[5] (Magic Sword)');
        });
    });

    // ========================================
    // validateTier Tests
    // ========================================
    describe('validateTier', () => {
        it('should accept valid tiers', () => {
            const validTiers = ['SS', 'S', 'A', 'B', 'C'];

            validTiers.forEach(tier => {
                const entity = { tier };
                const errors = validateTier(entity, 'weapons', 0);
                expect(errors).toEqual([]);
            });
        });

        it('should return error for invalid tier', () => {
            const entity = { name: 'Test', tier: 'Z' };
            const errors = validateTier(entity, 'weapons', 0);

            expect(errors.length).toBe(1);
            expect(errors[0]).toContain("Invalid tier 'Z'");
            expect(errors[0]).toContain('Must be one of:');
        });

        it('should return error for lowercase tier (case sensitive)', () => {
            const entity = { name: 'Test', tier: 's' };
            const errors = validateTier(entity, 'weapons', 0);

            expect(errors.length).toBe(1);
            expect(errors[0]).toContain("Invalid tier 's'");
        });

        it('should return empty array when tier is undefined', () => {
            const entity = { name: 'Test' };
            const errors = validateTier(entity, 'weapons', 0);
            expect(errors).toEqual([]);
        });

        it('should include entity name and index in error message', () => {
            const entity = { name: 'Fire Sword', tier: 'INVALID' };
            const errors = validateTier(entity, 'weapons', 3);

            expect(errors[0]).toContain('weapons[3] (Fire Sword)');
        });
    });

    // ========================================
    // validateAllData Tests
    // ========================================
    describe('validateAllData', () => {
        it('should validate complete valid data set', () => {
            const allData = createValidAllData();
            const result = validateAllData(allData);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return error for null data', () => {
            const result = validateAllData(null);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('No data provided for validation');
            expect(result.warnings).toEqual([]);
        });

        it('should return error for undefined data', () => {
            const result = validateAllData(undefined);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('No data provided for validation');
        });

        it('should add warnings for missing data types', () => {
            const allData = {
                items: createValidItemsData(),
                // weapons, tomes, characters, shrines are missing
            };
            const result = validateAllData(allData as any);

            expect(result.warnings.some(w => w.includes('weapons: Data not loaded'))).toBe(true);
            expect(result.warnings.some(w => w.includes('tomes: Data not loaded'))).toBe(true);
        });

        it('should collect errors from multiple validation stages', () => {
            const allData = {
                items: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'test', name: 'Test', rarity: 'invalid_rarity', tier: 'INVALID' },
                    ],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should add warnings for missing image field in items', () => {
            const allData = {
                items: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'test', name: 'Test', rarity: 'common', tier: 'A', detailed_description: 'Test' },
                    ],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.warnings.some(w => w.includes("Missing recommended 'image' field"))).toBe(true);
        });

        it('should add warnings for missing tags field in items', () => {
            const allData = {
                items: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'test', name: 'Test', rarity: 'common', tier: 'A', detailed_description: 'Test', image: 'test.png' },
                    ],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.warnings.some(w => w.includes("Missing recommended 'tags' field"))).toBe(true);
        });

        it('should add warnings for missing image field in tomes', () => {
            const allData = {
                tomes: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    tomes: [
                        { id: 'test', name: 'Test', tier: 'A' },
                    ],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.warnings.some(w => w.includes("tomes[0] (Test): Missing recommended 'image' field"))).toBe(true);
        });

        it('should validate rarity for items', () => {
            const allData = {
                items: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'test', name: 'Test', rarity: 'mythical', tier: 'A', detailed_description: 'Test' },
                    ],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid rarity'))).toBe(true);
        });

        it('should validate tier for weapons, tomes, and characters', () => {
            const allData = {
                weapons: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    weapons: [{ id: 'test', name: 'Test', tier: 'Z' }],
                },
            };
            const result = validateAllData(allData as any);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
        });

        it('should run cross-reference validation', () => {
            const allData = createValidAllData();
            (allData.weapons.weapons[0] as any).upgrades_to = 'nonexistent';

            const result = validateAllData(allData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('upgrades_to'))).toBe(true);
        });
    });

    // ========================================
    // logValidationResults Tests
    // ========================================
    describe('logValidationResults', () => {
        it('should log success for valid results', () => {
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
                })
            );
        });

        it('should log error for invalid results', () => {
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
                        errorCount: 2,
                    }),
                })
            );
        });

        it('should log warnings when present', () => {
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

        it('should limit errors to first 10 in log output', () => {
            const errors = Array.from({ length: 15 }, (_, i) => `Error ${i + 1}`);
            const result: ComprehensiveValidationResult = {
                valid: false,
                errors,
                warnings: [],
            };

            logValidationResults(result);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        errors: expect.arrayContaining(['Error 1', 'Error 10']),
                    }),
                })
            );

            // Verify only 10 errors in logged data
            const logCall = (logger.error as any).mock.calls[0][0];
            expect(logCall.data.errors.length).toBe(10);
        });

        it('should limit warnings to first 10 in log output', () => {
            const warnings = Array.from({ length: 15 }, (_, i) => `Warning ${i + 1}`);
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings,
            };

            logValidationResults(result);

            const logCall = (logger.warn as any).mock.calls[0][0];
            expect(logCall.data.warnings.length).toBe(10);
        });

        it('should not log warnings when there are none', () => {
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings: [],
            };

            logValidationResults(result);

            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should include warning count in success log', () => {
            const result: ComprehensiveValidationResult = {
                valid: true,
                errors: [],
                warnings: ['Warning 1'],
            };

            logValidationResults(result);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        warningCount: 1,
                    }),
                })
            );
        });
    });

    // ========================================
    // Edge Cases and Integration Tests
    // ========================================
    describe('Edge Cases', () => {
        it('should handle empty data arrays gracefully', () => {
            const allData = {
                items: { version: '1.0', last_updated: '2024-01-01', items: [] },
                weapons: { version: '1.0', last_updated: '2024-01-01', weapons: [] },
                tomes: { version: '1.0', last_updated: '2024-01-01', tomes: [] },
                characters: { version: '1.0', last_updated: '2024-01-01', characters: [] },
                shrines: { version: '1.0', last_updated: '2024-01-01', shrines: [] },
            };

            const result = validateAllData(allData);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should handle deeply nested synergy structures', () => {
            const allData = createValidAllData();
            allData.items.items[0].synergies = [
                { with: 'shield' },
                { with: ['katana', 'fire_tome'] },
            ] as any;

            const result = validateCrossReferences(allData);

            expect(result.valid).toBe(true);
        });

        it('should handle items with empty tags array', () => {
            const allData = {
                items: {
                    version: '1.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'test', name: 'Test', rarity: 'common', tier: 'A', detailed_description: 'Test', image: 'test.png', tags: [] },
                    ],
                },
            };

            const result = validateAllData(allData as any);

            expect(result.warnings.some(w => w.includes("Missing recommended 'tags' field"))).toBe(true);
        });

        it('should validate all entity types for tier when required', () => {
            const allData = {
                weapons: { version: '1.0', last_updated: '2024-01-01', weapons: [{ id: 'w', name: 'W', tier: 'X' }] },
                tomes: { version: '1.0', last_updated: '2024-01-01', tomes: [{ id: 't', name: 'T', tier: 'Y' }] },
                characters: { version: '1.0', last_updated: '2024-01-01', characters: [{ id: 'c', name: 'C', tier: 'Z' }] },
            };

            const result = validateAllData(allData as any);

            expect(result.valid).toBe(false);
            // Should have tier errors for all three
            expect(result.errors.filter(e => e.includes('Invalid tier')).length).toBe(3);
        });
    });
});
