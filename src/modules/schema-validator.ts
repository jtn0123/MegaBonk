// ========================================
// Schema Validator Module
// ========================================
// Uses Zod for runtime type validation of JSON data
// TypeScript types are automatically inferred from Zod schemas
// ========================================

import { z, ZodError, ZodIssue } from 'zod';
import type { ValidationResult } from '../types/index.ts';

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
    mechanics: z.record(z.string(), z.any()).optional(),
    breakpoints: z.record(z.string(), z.any()).optional(),
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

// ========================================
// TypeScript Types Inferred from Zod Schemas
// ========================================
// These types are automatically generated from the Zod schemas above
// This means we only define the structure once!

export type Scaling = z.infer<typeof ScalingSchema>;
export type ZodItem = z.infer<typeof ItemSchema>;
export type ZodWeapon = z.infer<typeof WeaponSchema>;
export type ZodTome = z.infer<typeof TomeSchema>;
export type ZodCharacter = z.infer<typeof CharacterSchema>;
export type ZodShrine = z.infer<typeof ShrineSchema>;
export type ZodStats = z.infer<typeof StatsSchema>;
export type ZodItemsData = z.infer<typeof ItemsDataSchema>;
export type ZodWeaponsData = z.infer<typeof WeaponsDataSchema>;
export type ZodTomesData = z.infer<typeof TomesDataSchema>;
export type ZodCharactersData = z.infer<typeof CharactersDataSchema>;
export type ZodShrinesData = z.infer<typeof ShrinesDataSchema>;

// ========================================
// Validation Functions
// ========================================

/**
 * Validate data against a schema
 */
export function validateData<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
    dataType: string
): ValidationResult<T> {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    } catch (error) {
        console.error(`[SchemaValidator] Validation failed for ${dataType}:`, error);

        // Format Zod errors for better readability
        let errorMessages: string;
        if (error instanceof z.ZodError) {
            const zodError = error as ZodError;
            errorMessages = zodError.issues.map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`).join(', ');
        } else if (error instanceof Error) {
            errorMessages = error.message;
        } else {
            errorMessages = 'Unknown error';
        }

        return {
            success: false,
            error: `Invalid ${dataType} data: ${errorMessages}`,
            zodError: error instanceof z.ZodError ? error : undefined,
        };
    }
}

/**
 * Validate items data
 */
export function validateItems(data: unknown): ValidationResult<ZodItemsData> {
    return validateData(data, ItemsDataSchema, 'items');
}

/**
 * Validate weapons data
 */
export function validateWeapons(data: unknown): ValidationResult<ZodWeaponsData> {
    return validateData(data, WeaponsDataSchema, 'weapons');
}

/**
 * Validate tomes data
 */
export function validateTomes(data: unknown): ValidationResult<ZodTomesData> {
    return validateData(data, TomesDataSchema, 'tomes');
}

/**
 * Validate characters data
 */
export function validateCharacters(data: unknown): ValidationResult<ZodCharactersData> {
    return validateData(data, CharactersDataSchema, 'characters');
}

/**
 * Validate shrines data
 */
export function validateShrines(data: unknown): ValidationResult<ZodShrinesData> {
    return validateData(data, ShrinesDataSchema, 'shrines');
}

/**
 * Validate stats data
 */
export function validateStats(data: unknown): ValidationResult<ZodStats> {
    return validateData(data, StatsSchema, 'stats');
}

/**
 * Validation results for all data types
 */
export interface AllDataValidationResults {
    items: ValidationResult<ZodItemsData> | null;
    weapons: ValidationResult<ZodWeaponsData> | null;
    tomes: ValidationResult<ZodTomesData> | null;
    characters: ValidationResult<ZodCharactersData> | null;
    shrines: ValidationResult<ZodShrinesData> | null;
    stats: ValidationResult<ZodStats> | null;
    allValid: boolean;
}

/**
 * Validate all game data
 */
export function validateAllData(allData: {
    items?: unknown;
    weapons?: unknown;
    tomes?: unknown;
    characters?: unknown;
    shrines?: unknown;
    stats?: unknown;
}): AllDataValidationResults {
    const results: AllDataValidationResults = {
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
} as const;
