/**
 * Comprehensive Tests for Data Validation Module
 * Tests schema validation, cross-references, and data integrity
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

// ========================================
// Test Fixtures
// ========================================

const createValidItem = (overrides = {}) => ({
    id: 'test-item-1',
    name: 'Test Item',
    rarity: 'common',
    tier: 'B',
    base_effect: 'Test effect',
    detailed_description: 'Test description',
    formula: 'Damage = 10',
    ...overrides,
});

const createValidWeapon = (overrides = {}) => ({
    id: 'test-weapon-1',
    name: 'Test Weapon',
    tier: 'A',
    base_damage: 10,
    attack_pattern: 'melee',
    upgradeable_stats: ['damage', 'speed'],
    description: 'A test weapon',
    ...overrides,
});

const createValidCharacter = (overrides = {}) => ({
    id: 'test-char-1',
    name: 'Test Character',
    tier: 'S',
    passive_name: 'Test Passive',
    passive_effect: 'Does something cool',
    starting_weapon: 'test-weapon-1',
    playstyle: 'aggressive',
    ...overrides,
});

const createValidTome = (overrides = {}) => ({
    id: 'test-tome-1',
    name: 'Test Tome',
    tier: 'A',
    stat_affected: 'damage',
    value_per_level: '5%', // Must be string per schema
    description: 'Increases damage',
    priority: 1,
    ...overrides,
});

const createValidShrine = (overrides = {}) => ({
    id: 'test-shrine-1',
    name: 'Test Shrine',
    effect: 'Grants power',
    strategy: 'Always take it',
    ...overrides,
});

const createValidAllData = () => ({
    items: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        items: [createValidItem()],
    },
    weapons: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        weapons: [createValidWeapon()],
    },
    characters: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        characters: [createValidCharacter()],
    },
    tomes: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        tomes: [createValidTome()],
    },
    shrines: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        shrines: [createValidShrine()],
    },
    stats: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        breakpoints: {},
        formulas: {},
    },
});

// ========================================
// Zod Validation Tests
// ========================================

describe('validateWithZod', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    describe('items validation', () => {
        it('should validate valid items data', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [createValidItem()],
            };
            const result = validateWithZod(data, 'items');
            expect(result.valid).toBe(true);
        });

        it('should fail on missing required fields', () => {
            const data = { items: [{ id: 'test' }] };
            const result = validateWithZod(data, 'items');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('weapons validation', () => {
        it('should validate valid weapons data', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [createValidWeapon()],
            };
            const result = validateWithZod(data, 'weapons');
            expect(result.valid).toBe(true);
        });
    });

    describe('characters validation', () => {
        it('should validate valid characters data', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [createValidCharacter()],
            };
            const result = validateWithZod(data, 'characters');
            expect(result.valid).toBe(true);
        });
    });

    describe('tomes validation', () => {
        it('should validate valid tomes data', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [createValidTome()],
            };
            const result = validateWithZod(data, 'tomes');
            expect(result.valid).toBe(true);
        });
    });

    describe('shrines validation', () => {
        it('should validate valid shrines data', () => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [createValidShrine()],
            };
            const result = validateWithZod(data, 'shrines');
            expect(result.valid).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle null input', () => {
            const result = validateWithZod(null, 'items');
            expect(result.valid).toBe(false);
        });

        it('should handle undefined input', () => {
            const result = validateWithZod(undefined, 'items');
            expect(result.valid).toBe(false);
        });

        it('should handle unknown type', () => {
            const result = validateWithZod({}, 'unknown' as any);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Unknown data type');
        });
    });
});

// ========================================
// Data Structure Validation Tests
// ========================================

describe('validateDataStructure', () => {
    it('should validate valid items structure', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [createValidItem(), createValidItem({ id: 'item-2' })],
        };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(true);
    });

    it('should detect missing id fields', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ name: 'No ID Item', rarity: 'common', tier: 'B', detailed_description: 'test' }],
        };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('should fail on missing version', () => {
        const data = {
            last_updated: '2024-01-01',
            items: [createValidItem()],
        };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });

    it('should fail on missing array', () => {
        const data = { version: '1.0.0' };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(false);
    });

    it('should fail on null data', () => {
        const result = validateDataStructure(null, 'items');
        expect(result.valid).toBe(false);
    });

    it('should detect missing name fields', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ id: 'no-name', rarity: 'common', tier: 'B', detailed_description: 'test' }],
        };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should detect missing detailed_description for items', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ id: 'test', name: 'Test', rarity: 'common', tier: 'B' }],
        };
        const result = validateDataStructure(data, 'items');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('detailed_description'))).toBe(true);
    });
});

// ========================================
// Cross-Reference Validation Tests
// ========================================

describe('validateCrossReferences', () => {
    it('should validate correct cross-references', () => {
        const allData = createValidAllData();
        const result = validateCrossReferences(allData);
        expect(result.valid).toBe(true);
    });

    it('should detect invalid passive_item_ref in character', () => {
        const allData = createValidAllData();
        // Add a passive_item_ref that references a non-existent item
        (allData.characters.characters[0] as any).passive_item_ref = 'nonexistent-item';
        const result = validateCrossReferences(allData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('passive_item_ref'))).toBe(true);
    });

    it('should detect invalid synergy reference with structured synergy', () => {
        const allData = createValidAllData();
        // Synergies need to be structured objects with 'with' property
        allData.items.items[0].synergies = [{ with: 'nonexistent-item', description: 'test' }] as any;
        const result = validateCrossReferences(allData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('synergy'))).toBe(true);
    });

    it('should validate valid synergy reference', () => {
        const allData = createValidAllData();
        // Add a second item and reference it
        allData.items.items.push(createValidItem({ id: 'item-2', name: 'Item 2' }));
        allData.items.items[0].synergies = [{ with: 'item-2', description: 'synergy' }] as any;
        const result = validateCrossReferences(allData);
        expect(result.valid).toBe(true);
    });

    it('should handle null allData', () => {
        const result = validateCrossReferences(null);
        expect(result.valid).toBe(false);
    });

    it('should handle undefined allData', () => {
        const result = validateCrossReferences(undefined);
        expect(result.valid).toBe(false);
    });

    it('should handle missing entity collections gracefully', () => {
        const partialData = {
            items: { items: [createValidItem()] },
        };
        const result = validateCrossReferences(partialData as any);
        // Should not crash, may have empty errors
        expect(result).toBeDefined();
        expect(result.valid).toBe(true); // No invalid cross-refs when collections are missing
    });

    it('should detect invalid weapon upgrade references', () => {
        const allData = createValidAllData();
        (allData.weapons.weapons[0] as any).upgrades_from = 'nonexistent-weapon';
        const result = validateCrossReferences(allData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('upgrades_from'))).toBe(true);
    });
});

// ========================================
// Rarity Validation Tests
// ========================================

describe('validateRarity', () => {
    it('should accept valid rarities', () => {
        const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        for (const rarity of validRarities) {
            const entity = createValidItem({ rarity });
            const errors = validateRarity(entity, 'items', 0);
            expect(errors).toEqual([]);
        }
    });

    it('should reject invalid rarity', () => {
        const entity = createValidItem({ rarity: 'mythic' });
        const errors = validateRarity(entity, 'items', 0);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('mythic');
    });

    it('should not error on missing rarity (only validates if present)', () => {
        // validateRarity only checks if rarity is valid when present
        // Missing rarity doesn't trigger an error in validateRarity
        const entity = { id: 'test', name: 'Test', tier: 'B' };
        const errors = validateRarity(entity as any, 'items', 0);
        // No errors because rarity check only runs if entity.rarity is truthy
        expect(errors).toEqual([]);
    });

    it('should include entity name in error message', () => {
        const entity = createValidItem({ rarity: 'invalid', name: 'Special Item' });
        const errors = validateRarity(entity, 'items', 5);
        expect(errors.some(e => e.includes('Special Item'))).toBe(true);
    });

    it('should handle case-insensitive rarity matching', () => {
        const entity = createValidItem({ rarity: 'COMMON' });
        const errors = validateRarity(entity, 'items', 0);
        // The validation lowercases the rarity before checking
        expect(errors).toEqual([]);
    });
});

// ========================================
// Tier Validation Tests
// ========================================

describe('validateTier', () => {
    it('should accept valid tiers', () => {
        const validTiers = ['SS', 'S', 'A', 'B', 'C'];
        for (const tier of validTiers) {
            const entity = createValidItem({ tier });
            const errors = validateTier(entity, 'items', 0);
            expect(errors).toEqual([]);
        }
    });

    it('should reject invalid tier', () => {
        const entity = createValidItem({ tier: 'D' });
        const errors = validateTier(entity, 'items', 0);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('D');
    });

    it('should not error on missing tier (only validates if present)', () => {
        const entity = { id: 'test', name: 'Test', rarity: 'common' };
        const errors = validateTier(entity as any, 'items', 0);
        expect(errors).toEqual([]);
    });

    it('should reject lowercase tier (case-sensitive)', () => {
        const entity = createValidItem({ tier: 'a' });
        const errors = validateTier(entity, 'items', 0);
        // Tiers are case-sensitive, lowercase 'a' should fail
        expect(errors.length).toBeGreaterThan(0);
    });
});

// ========================================
// Full Data Validation Tests
// ========================================

describe('validateAllData', () => {
    it('should validate complete valid data', () => {
        const allData = createValidAllData();
        const result = validateAllData(allData);
        expect(result).toBeDefined();
        expect(result.errors).toBeDefined();
        expect(result.warnings).toBeDefined();
    });

    it('should detect invalid rarity', () => {
        const allData = createValidAllData();
        allData.items.items[0].rarity = 'invalid-rarity';

        const result = validateAllData(allData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid-rarity'))).toBe(true);
    });

    it('should include warnings array', () => {
        const allData = createValidAllData();
        const result = validateAllData(allData);
        expect(result.warnings).toBeDefined();
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle null data', () => {
        const result = validateAllData(null);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined data', () => {
        const result = validateAllData(undefined);
        expect(result.valid).toBe(false);
    });

    it('should add warnings for missing recommended fields', () => {
        const allData = createValidAllData();
        // Remove image and tags to trigger warnings
        delete (allData.items.items[0] as any).image;
        delete (allData.items.items[0] as any).tags;

        const result = validateAllData(allData);
        // Should have warnings about missing image and tags
        expect(result.warnings.some(w => w.includes('image'))).toBe(true);
        expect(result.warnings.some(w => w.includes('tags'))).toBe(true);
    });

    it('should detect invalid tier in weapons', () => {
        const allData = createValidAllData();
        allData.weapons.weapons[0].tier = 'INVALID';

        const result = validateAllData(allData);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('INVALID'))).toBe(true);
    });
});

// ========================================
// Logging Tests
// ========================================

describe('logValidationResults', () => {
    it('should not throw for valid result', () => {
        const result: ComprehensiveValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
        };

        // logValidationResults uses logger, not console
        // Just verify it doesn't throw
        expect(() => logValidationResults(result)).not.toThrow();
    });

    it('should not throw for invalid result', () => {
        const result: ComprehensiveValidationResult = {
            valid: false,
            errors: ['Error 1', 'Error 2'],
            warnings: [],
        };

        expect(() => logValidationResults(result)).not.toThrow();
    });

    it('should handle result with warnings', () => {
        const result: ComprehensiveValidationResult = {
            valid: true,
            errors: [],
            warnings: ['Warning 1'],
        };

        expect(() => logValidationResults(result)).not.toThrow();
    });

    it('should handle result with many errors and warnings', () => {
        const result: ComprehensiveValidationResult = {
            valid: false,
            errors: Array(20).fill('Error'),
            warnings: Array(20).fill('Warning'),
        };

        // Should truncate to first 10 errors/warnings
        expect(() => logValidationResults(result)).not.toThrow();
    });
});

// ========================================
// Edge Cases and Error Handling
// ========================================

describe('Validation Edge Cases', () => {
    it('should handle deeply nested data', () => {
        const allData = createValidAllData();
        (allData.items.items[0] as any).scaling_tracks = {
            track1: {
                stat: 'damage',
                values: [1, 2, 3],
            },
        };

        const result = validateAllData(allData);
        expect(result).toBeDefined();
    });

    it('should handle self-referencing synergies', () => {
        const item = createValidItem();
        // Self-reference with structured synergy
        (item as any).synergies = [{ with: item.id, description: 'self' }];

        const allData = createValidAllData();
        allData.items.items = [item];

        const result = validateCrossReferences(allData);
        // Self-reference is valid (item exists)
        expect(result.valid).toBe(true);
    });

    it('should handle large datasets', () => {
        const allData = createValidAllData();
        for (let i = 0; i < 50; i++) {
            allData.items.items.push(createValidItem({ id: `item-${i}`, name: `Item ${i}` }));
        }

        const result = validateAllData(allData);
        expect(result).toBeDefined();
    });

    it('should handle special characters in IDs', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [createValidItem({ id: 'item_with_underscore' })],
        };
        const result = validateWithZod(data, 'items');
        expect(result).toBeDefined();
    });

    it('should handle various name formats', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [createValidItem({ name: 'Test Item (Rare)' })],
        };
        const result = validateWithZod(data, 'items');
        expect(result).toBeDefined();
    });

    it('should validate stats data type', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            breakpoints: {},
            formulas: {},
        };
        const result = validateWithZod(data, 'stats');
        expect(result).toBeDefined();
    });
});
