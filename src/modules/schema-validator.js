// ========================================
// Schema Validator Module
// ========================================
// Uses Zod for runtime type validation of JSON data
// ========================================

import { z } from 'zod';

/**
 * Common schemas
 */
const ScalingSchema = z
    .object({
        formula: z.string(),
        min: z.number().optional(),
        max: z.number().optional(),
        cap: z.number().optional(),
    })
    .optional();

/**
 * Item schema
 */
const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    image: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    cooldown: z.number().optional(),
    damage: z.union([z.number(), z.string()]).optional(),
    healing: z.union([z.number(), z.string()]).optional(),
    scaling: ScalingSchema,
    synergies: z.array(z.string()).optional(),
    antiSynergies: z.array(z.string()).optional(),
});

/**
 * Weapon schema
 */
const WeaponSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    image: z.string().optional(),
    baseDamage: z.number(),
    attackSpeed: z.number(),
    range: z.number().optional(),
    upgrades: z
        .array(
            z.object({
                level: z.number(),
                bonus: z.string(),
                cost: z.number().optional(),
            })
        )
        .optional(),
    scaling: ScalingSchema,
    tags: z.array(z.string()).optional(),
});

/**
 * Tome schema
 */
const TomeSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    image: z.string().optional(),
    effect: z.string(),
    priority: z.number().optional(),
    stackable: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
});

/**
 * Character schema
 */
const CharacterSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    image: z.string().optional(),
    baseStats: z.object({
        health: z.number(),
        damage: z.number(),
        speed: z.number(),
        luck: z.number().optional(),
    }),
    passive: z.string(),
    startingWeapon: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

/**
 * Shrine schema
 */
const ShrineSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    image: z.string().optional(),
    effect: z.string(),
    cost: z.union([z.number(), z.string()]).optional(),
    tags: z.array(z.string()).optional(),
});

/**
 * Stats schema
 */
const StatsSchema = z.object({
    version: z.string().optional(),
    last_updated: z.string().optional(),
    mechanics: z.record(z.any()).optional(),
    breakpoints: z.record(z.any()).optional(),
});

/**
 * Data collection schemas
 */
const ItemsDataSchema = z.object({
    version: z.string(),
    last_updated: z.string(),
    items: z.array(ItemSchema),
});

const WeaponsDataSchema = z.object({
    version: z.string(),
    last_updated: z.string(),
    weapons: z.array(WeaponSchema),
});

const TomesDataSchema = z.object({
    version: z.string(),
    last_updated: z.string(),
    tomes: z.array(TomeSchema),
});

const CharactersDataSchema = z.object({
    version: z.string(),
    last_updated: z.string(),
    characters: z.array(CharacterSchema),
});

const ShrinesDataSchema = z.object({
    version: z.string(),
    last_updated: z.string(),
    shrines: z.array(ShrineSchema),
});

/**
 * Validate data against a schema
 * @param {*} data - Data to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} dataType - Type of data for error messages
 * @returns {Object} Validation result { success: boolean, data?: any, error?: string }
 */
export function validateData(data, schema, dataType) {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    } catch (error) {
        console.error(`[SchemaValidator] Validation failed for ${dataType}:`, error);

        // Format Zod errors for better readability
        const errorMessages =
            error.errors
                ?.map(err => {
                    const path = err.path.join('.');
                    return `${path}: ${err.message}`;
                })
                .join(', ') || error.message;

        return {
            success: false,
            error: `Invalid ${dataType} data: ${errorMessages}`,
            zodError: error,
        };
    }
}

/**
 * Validate items data
 * @param {*} data - Items data to validate
 * @returns {Object} Validation result
 */
export function validateItems(data) {
    return validateData(data, ItemsDataSchema, 'items');
}

/**
 * Validate weapons data
 * @param {*} data - Weapons data to validate
 * @returns {Object} Validation result
 */
export function validateWeapons(data) {
    return validateData(data, WeaponsDataSchema, 'weapons');
}

/**
 * Validate tomes data
 * @param {*} data - Tomes data to validate
 * @returns {Object} Validation result
 */
export function validateTomes(data) {
    return validateData(data, TomesDataSchema, 'tomes');
}

/**
 * Validate characters data
 * @param {*} data - Characters data to validate
 * @returns {Object} Validation result
 */
export function validateCharacters(data) {
    return validateData(data, CharactersDataSchema, 'characters');
}

/**
 * Validate shrines data
 * @param {*} data - Shrines data to validate
 * @returns {Object} Validation result
 */
export function validateShrines(data) {
    return validateData(data, ShrinesDataSchema, 'shrines');
}

/**
 * Validate stats data
 * @param {*} data - Stats data to validate
 * @returns {Object} Validation result
 */
export function validateStats(data) {
    return validateData(data, StatsSchema, 'stats');
}

/**
 * Validate all game data
 * @param {Object} allData - All game data
 * @returns {Object} Validation results for all data types
 */
export function validateAllData(allData) {
    const results = {
        items: null,
        weapons: null,
        tomes: null,
        characters: null,
        shrines: null,
        stats: null,
        allValid: true,
    };

    if (allData.items) {
        results.items = validateItems(allData.items);
        if (!results.items.success) results.allValid = false;
    }

    if (allData.weapons) {
        results.weapons = validateWeapons(allData.weapons);
        if (!results.weapons.success) results.allValid = false;
    }

    if (allData.tomes) {
        results.tomes = validateTomes(allData.tomes);
        if (!results.tomes.success) results.allValid = false;
    }

    if (allData.characters) {
        results.characters = validateCharacters(allData.characters);
        if (!results.characters.success) results.allValid = false;
    }

    if (allData.shrines) {
        results.shrines = validateShrines(allData.shrines);
        if (!results.shrines.success) results.allValid = false;
    }

    if (allData.stats) {
        results.stats = validateStats(allData.stats);
        if (!results.stats.success) results.allValid = false;
    }

    return results;
}

/**
 * Export schemas for direct use if needed
 */
export const schemas = {
    Item: ItemSchema,
    Weapon: WeaponSchema,
    Tome: TomeSchema,
    Character: CharacterSchema,
    Shrine: ShrineSchema,
    Stats: StatsSchema,
    ItemsData: ItemsDataSchema,
    WeaponsData: WeaponsDataSchema,
    TomesData: TomesDataSchema,
    CharactersData: CharactersDataSchema,
    ShrinesData: ShrinesDataSchema,
};
