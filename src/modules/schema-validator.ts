// ========================================
// Schema Validator Module
// ========================================
// Uses Zod for runtime type validation of JSON data
// TypeScript types are automatically inferred from Zod schemas
// ========================================

import { z, ZodError, ZodIssue } from 'zod';
import { logger } from './logger.ts';
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
 * Item schema - matches actual items.json structure
 */
const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    unlocked_by_default: z.boolean().optional(),
    unlock_requirement: z.string().optional(),
    unlock_cost_silver: z.number().optional(),
    base_effect: z.string().optional(),
    scaling_type: z.string().optional(),
    stacking_behavior: z.string().optional(),
    stacks_well: z.boolean().optional(),
    stack_cap: z.number().optional(),
    formula: z.string().optional(),
    scaling_per_stack: z.array(z.number()).optional(),
    detailed_description: z.string().optional(),
    synergies: z.array(z.string()).optional(),
    anti_synergies: z.array(z.string()).optional(),
    notes: z.string().optional(),
    graph_type: z.string().optional(),
    one_and_done: z.boolean().optional(),
    image: z.string().optional(),
});

/**
 * Weapon schema - matches actual weapons.json structure
 */
const WeaponSchema = z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    base_damage: z.number().optional(),
    base_projectile_count: z.number().optional(),
    attack_pattern: z.string().optional(),
    upgradeable_stats: z.array(z.string()).optional(),
    unlock_requirement: z.string().optional(),
    unlock_cost_silver: z.number().optional(),
    unlocked_by_default: z.boolean().optional(),
    description: z.string().optional(),
    best_for: z.array(z.string()).optional(),
    synergies_items: z.array(z.string()).optional(),
    synergies_tomes: z.array(z.string()).optional(),
    synergies_characters: z.array(z.string()).optional(),
    playstyle: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
    image: z.string().optional(),
});

/**
 * Tome schema - matches actual tomes.json structure
 */
const TomeSchema = z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    stat_affected: z.string().optional(),
    value_per_level: z.string().optional(),
    unlocked_by_default: z.boolean().optional(),
    unlock_requirement: z.string().optional(),
    unlock_cost_silver: z.number().optional(),
    max_level: z.number().optional(),
    value_cap: z.number().optional(),
    description: z.string().optional(),
    priority: z.number().optional(),
    recommended_for: z.array(z.string()).optional(),
    synergies_items: z.array(z.string()).optional(),
    synergies_weapons: z.array(z.string()).optional(),
    synergies_characters: z.array(z.string()).optional(),
    notes: z.string().optional(),
    image: z.string().optional(),
});

/**
 * Character schema - matches actual characters.json structure
 */
const CharacterSchema = z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['SS', 'S', 'A', 'B', 'C']),
    starting_weapon: z.string().optional(),
    passive_ability: z.string().optional(),
    passive_description: z.string().optional(),
    unlock_requirement: z.string().optional(),
    unlock_cost_silver: z.number().optional(),
    unlocked_by_default: z.boolean().optional(),
    playstyle: z.string().optional(),
    best_for: z.array(z.string()).optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    synergies_items: z.array(z.string()).optional(),
    synergies_tomes: z.array(z.string()).optional(),
    synergies_weapons: z.array(z.string()).optional(),
    build_tips: z.string().optional(),
    image: z.string().optional(),
});

/**
 * Shrine schema - matches actual shrines.json structure
 */
const ShrineSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    icon: z.string().optional(),
    description: z.string().optional(),
    activation: z.string().optional(),
    reward: z.string().optional(),
    reusable: z.boolean().optional(),
    spawn_count: z.string().optional(),
    map_icon: z.string().optional(),
    best_for: z.array(z.string()).optional(),
    synergies_items: z.array(z.string()).optional(),
    strategy: z.string().optional(),
    notes: z.string().optional(),
    image: z.string().optional(),
});

/**
 * Stats schema
 * Using z.unknown() for mechanics/breakpoints as they contain arbitrary nested data
 */
const StatsSchema = z.object({
    version: z.string().optional(),
    last_updated: z.string().optional(),
    mechanics: z.record(z.string(), z.unknown()).optional(),
    breakpoints: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Data collection schemas - using passthrough() to allow extra fields like total_items
 */
const ItemsDataSchema = z
    .object({
        version: z.string(),
        last_updated: z.string(),
        total_items: z.number().optional(),
        items: z.array(ItemSchema),
    })
    .passthrough();

const WeaponsDataSchema = z
    .object({
        version: z.string(),
        last_updated: z.string(),
        total_weapons: z.number().optional(),
        weapons: z.array(WeaponSchema),
    })
    .passthrough();

const TomesDataSchema = z
    .object({
        version: z.string(),
        last_updated: z.string(),
        total_tomes: z.number().optional(),
        tomes: z.array(TomeSchema),
    })
    .passthrough();

const CharactersDataSchema = z
    .object({
        version: z.string(),
        last_updated: z.string(),
        total_characters: z.number().optional(),
        characters: z.array(CharacterSchema),
    })
    .passthrough();

const ShrinesDataSchema = z
    .object({
        version: z.string(),
        last_updated: z.string(),
        total_shrines: z.number().optional(),
        shrines: z.array(ShrineSchema),
    })
    .passthrough();

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
export function validateData<T>(data: unknown, schema: z.ZodSchema<T>, dataType: string): ValidationResult<T> {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    } catch (error) {
        const err = error as Error;
        logger.error({
            operation: 'schema.validate',
            error: {
                name: err.name,
                message: err.message,
                module: 'schema-validator',
            },
            data: { dataType },
        });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validators: Array<[keyof typeof allData, (data: unknown) => ValidationResult<any>]> = [
        ['items', validateItems],
        ['weapons', validateWeapons],
        ['tomes', validateTomes],
        ['characters', validateCharacters],
        ['shrines', validateShrines],
        ['stats', validateStats],
    ];

    for (const [key, validate] of validators) {
        if (allData[key]) {
            const result = validate(allData[key]);
            (results as unknown as Record<string, unknown>)[key] = result;
            if (!result.success) results.allValid = false;
        }
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
