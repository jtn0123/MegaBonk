// ========================================
// MegaBonk Data Validation Module
// Uses Zod for schema validation and cross-reference checking
// ========================================

import {
    validateItems,
    validateWeapons,
    validateTomes,
    validateCharacters,
    validateShrines,
    validateStats,
} from './schema-validator.ts';
import { VALID_RARITIES, VALID_TIERS } from './constants.ts';
import type { ValidationResult, AllGameData, EntityType, Rarity, Tier } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Legacy validation result (basic structure checks)
 */
export interface LegacyValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Comprehensive validation result
 */
export interface ComprehensiveValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Zod validation wrapper result
 */
export interface ZodValidationResult {
    valid: boolean;
    errors: string[];
    data?: unknown;
}

// ========================================
// Zod Schema Validation (Runtime Type Safety)
// ========================================

/**
 * Validate data using Zod schemas
 */
export function validateWithZod(data: unknown, type: EntityType | 'stats'): ZodValidationResult {
    let result: ValidationResult<unknown>;

    switch (type) {
        case 'items':
            result = validateItems(data);
            break;
        case 'weapons':
            result = validateWeapons(data);
            break;
        case 'tomes':
            result = validateTomes(data);
            break;
        case 'characters':
            result = validateCharacters(data);
            break;
        case 'shrines':
            result = validateShrines(data);
            break;
        case 'stats':
            result = validateStats(data);
            break;
        default:
            return { valid: false, errors: [`Unknown data type: ${type}`] };
    }

    if (result.success) {
        return { valid: true, errors: [], data: result.data };
    } else {
        return { valid: false, errors: [result.error || 'Unknown validation error'] };
    }
}

// ========================================
// Legacy Validation (Basic Structure Checks)
// ========================================

/**
 * Entity with basic structure
 */
interface BasicEntity {
    id?: string;
    name?: string;
    rarity?: string;
    tier?: string;
    description?: string;
}

/**
 * Data structure with version info
 */
interface DataStructure {
    version?: string;
    last_updated?: string;
    [key: string]: unknown;
}

/**
 * Validate basic data structure (runtime validation without Zod)
 */
export function validateDataStructure(
    data: DataStructure | null | undefined,
    type: EntityType
): LegacyValidationResult {
    const errors: string[] = [];

    if (!data) {
        errors.push(`${type}: Data is null or undefined`);
        return { valid: false, errors };
    }

    // Check for version and last_updated
    if (!data.version) {
        errors.push(`${type}: Missing 'version' field`);
    }

    if (!data.last_updated) {
        errors.push(`${type}: Missing 'last_updated' field`);
    }

    // Check for data array
    const dataArray = data[type];
    if (!Array.isArray(dataArray)) {
        errors.push(`${type}: Data array is missing or not an array`);
        return { valid: false, errors };
    }

    // Validate each entity
    dataArray.forEach((entity: BasicEntity, index: number) => {
        // Required fields for all entities
        if (!entity.id) {
            errors.push(`${type}[${index}]: Missing 'id' field`);
        }
        if (!entity.name) {
            errors.push(`${type}[${index}]: Missing 'name' field`);
        }

        // Type-specific validations
        if (type === 'items') {
            if (!entity.rarity) {
                errors.push(`${type}[${index}] (${entity.name || entity.id}): Missing 'rarity' field`);
            }
            if (!entity.tier) {
                errors.push(`${type}[${index}] (${entity.name || entity.id}): Missing 'tier' field`);
            }
            if (!entity.description) {
                errors.push(`${type}[${index}] (${entity.name || entity.id}): Missing 'description' field`);
            }
        }

        if (type === 'weapons' || type === 'tomes' || type === 'characters') {
            if (!entity.tier) {
                errors.push(`${type}[${index}] (${entity.name || entity.id}): Missing 'tier' field`);
            }
        }
    });

    return { valid: errors.length === 0, errors };
}

/**
 * Validate cross-references between data types
 */
export function validateCrossReferences(allData: AllGameData | null | undefined): LegacyValidationResult {
    const errors: string[] = [];

    if (!allData) {
        errors.push('Cross-reference validation: allData is null or undefined');
        return { valid: false, errors };
    }

    // Build ID sets for quick lookup
    const itemIds = new Set((allData.items?.items || []).map(i => i.id));
    const weaponIds = new Set((allData.weapons?.weapons || []).map(w => w.id));
    const tomeIds = new Set((allData.tomes?.tomes || []).map(t => t.id));
    const characterIds = new Set((allData.characters?.characters || []).map(c => c.id));

    // Validate synergies in items (if they reference other items/weapons/tomes)
    const items = allData.items?.items || [];
    items.forEach((item, index) => {
        if (item.synergies) {
            if (Array.isArray(item.synergies)) {
                item.synergies.forEach((synergy, sIndex) => {
                    if (typeof synergy === 'object' && synergy !== null && 'with' in synergy) {
                        const synergyWith = (synergy as { with?: string | string[] }).with;
                        // Check if synergy references valid entities
                        const refs = Array.isArray(synergyWith) ? synergyWith : synergyWith ? [synergyWith] : [];
                        refs.forEach(ref => {
                            if (
                                !itemIds.has(ref) &&
                                !weaponIds.has(ref) &&
                                !tomeIds.has(ref) &&
                                !characterIds.has(ref)
                            ) {
                                errors.push(
                                    `items[${index}] (${item.name}): synergy[${sIndex}] references unknown entity '${ref}'`
                                );
                            }
                        });
                    }
                });
            }
        }
    });

    // Validate character passives that might reference items
    const characters = allData.characters?.characters || [];
    characters.forEach((character, index) => {
        if ('passive_item_ref' in character) {
            const passiveItemRef = (character as { passive_item_ref?: string }).passive_item_ref;
            if (passiveItemRef && !itemIds.has(passiveItemRef)) {
                errors.push(
                    `characters[${index}] (${character.name}): passive_item_ref '${passiveItemRef}' not found in items`
                );
            }
        }
    });

    // Validate weapon upgrade paths
    const weapons = allData.weapons?.weapons || [];
    weapons.forEach((weapon, index) => {
        if ('upgrades_from' in weapon) {
            const upgradesFrom = (weapon as { upgrades_from?: string }).upgrades_from;
            if (upgradesFrom && !weaponIds.has(upgradesFrom)) {
                errors.push(`weapons[${index}] (${weapon.name}): upgrades_from '${upgradesFrom}' not found in weapons`);
            }
        }
        if ('upgrades_to' in weapon) {
            const upgradesTo = (weapon as { upgrades_to?: string | string[] }).upgrades_to;
            const upgradeTo = Array.isArray(upgradesTo) ? upgradesTo : upgradesTo ? [upgradesTo] : [];
            upgradeTo.forEach(target => {
                if (!weaponIds.has(target)) {
                    errors.push(`weapons[${index}] (${weapon.name}): upgrades_to '${target}' not found in weapons`);
                }
            });
        }
    });

    return { valid: errors.length === 0, errors };
}

/**
 * Validate rarity values
 */
export function validateRarity(entity: BasicEntity, type: string, index: number): string[] {
    const errors: string[] = [];

    if (entity.rarity && !VALID_RARITIES.includes(entity.rarity.toLowerCase() as Rarity)) {
        errors.push(
            `${type}[${index}] (${entity.name}): Invalid rarity '${entity.rarity}'. Must be one of: ${VALID_RARITIES.join(', ')}`
        );
    }

    return errors;
}

/**
 * Validate tier values
 */
export function validateTier(entity: BasicEntity, type: string, index: number): string[] {
    const errors: string[] = [];

    if (entity.tier && !VALID_TIERS.includes(entity.tier as Tier)) {
        errors.push(
            `${type}[${index}] (${entity.name}): Invalid tier '${entity.tier}'. Must be one of: ${VALID_TIERS.join(', ')}`
        );
    }

    return errors;
}

/**
 * Comprehensive validation of all game data
 */
export function validateAllData(allData: AllGameData | null | undefined): ComprehensiveValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!allData) {
        return { valid: false, errors: ['No data provided for validation'], warnings: [] };
    }

    // Validate structure for each data type
    const dataTypes: EntityType[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    dataTypes.forEach(type => {
        if (allData[type]) {
            const result = validateDataStructure(allData[type] as unknown as DataStructure, type);
            errors.push(...result.errors);
        } else {
            warnings.push(`${type}: Data not loaded`);
        }
    });

    // Validate rarity and tier values
    if (allData.items?.items) {
        allData.items.items.forEach((item, index) => {
            errors.push(...validateRarity(item, 'items', index));
            errors.push(...validateTier(item, 'items', index));
        });
    }

    (['weapons', 'tomes', 'characters'] as const).forEach(type => {
        const dataForType = allData[type] as { [key: string]: BasicEntity[] } | undefined;
        const entities = dataForType?.[type] || [];
        entities.forEach((entity: BasicEntity, index: number) => {
            errors.push(...validateTier(entity, type, index));
        });
    });

    // Validate cross-references
    const crossRefResult = validateCrossReferences(allData);
    errors.push(...crossRefResult.errors);

    // Additional warnings for missing recommended fields
    if (allData.items?.items) {
        allData.items.items.forEach((item, index) => {
            if (!item.image) {
                warnings.push(`items[${index}] (${item.name}): Missing recommended 'image' field`);
            }
            if (!item.tags || item.tags.length === 0) {
                warnings.push(`items[${index}] (${item.name}): Missing recommended 'tags' field`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Log validation results to console
 */
export function logValidationResults(result: ComprehensiveValidationResult): void {
    if (result.valid) {
        console.log('[Data Validation] ✓ All data is valid');
    } else {
        console.error('[Data Validation] ✗ Validation failed');
        result.errors.forEach(error => console.error(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
        console.warn('[Data Validation] ⚠ Warnings:');
        result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
}

// ========================================
// Note: All functions exported as ES modules
// ========================================
