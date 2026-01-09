// ========================================
// MegaBonk Data Validation Module
// Uses Zod for schema validation and cross-reference checking
// ========================================

// Note: This file uses require() instead of import because the project is CommonJS
// In a browser environment, Zod would be loaded via CDN or bundler

// ========================================
// Validation Schemas (for build-time/node validation)
// ========================================

/**
 * Validate basic data structure (runtime validation without Zod)
 * @param {Object} data - Data object to validate
 * @param {string} type - Data type (items, weapons, tomes, characters, shrines)
 * @returns {{valid: boolean, errors: Array<string>}} Validation result
 */
export function validateDataStructure(data, type) {
    const errors = [];

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
    dataArray.forEach((entity, index) => {
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
 * @param {Object} allData - All loaded data
 * @returns {{valid: boolean, errors: Array<string>}} Validation result
 */
export function validateCrossReferences(allData) {
    const errors = [];

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
                    if (synergy.with) {
                        // Check if synergy references valid entities
                        const refs = Array.isArray(synergy.with) ? synergy.with : [synergy.with];
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
        if (character.passive_item_ref) {
            if (!itemIds.has(character.passive_item_ref)) {
                errors.push(
                    `characters[${index}] (${character.name}): passive_item_ref '${character.passive_item_ref}' not found in items`
                );
            }
        }
    });

    // Validate weapon upgrade paths
    const weapons = allData.weapons?.weapons || [];
    weapons.forEach((weapon, index) => {
        if (weapon.upgrades_from) {
            if (!weaponIds.has(weapon.upgrades_from)) {
                errors.push(
                    `weapons[${index}] (${weapon.name}): upgrades_from '${weapon.upgrades_from}' not found in weapons`
                );
            }
        }
        if (weapon.upgrades_to) {
            const upgradeTo = Array.isArray(weapon.upgrades_to) ? weapon.upgrades_to : [weapon.upgrades_to];
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
 * @param {Object} entity - Entity to validate
 * @param {string} type - Entity type
 * @param {number} index - Index in array
 * @returns {Array<string>} Validation errors
 */
export function validateRarity(entity, type, index) {
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const errors = [];

    if (entity.rarity && !validRarities.includes(entity.rarity.toLowerCase())) {
        errors.push(
            `${type}[${index}] (${entity.name}): Invalid rarity '${entity.rarity}'. Must be one of: ${validRarities.join(', ')}`
        );
    }

    return errors;
}

/**
 * Validate tier values
 * @param {Object} entity - Entity to validate
 * @param {string} type - Entity type
 * @param {number} index - Index in array
 * @returns {Array<string>} Validation errors
 */
export function validateTier(entity, type, index) {
    const validTiers = ['SS', 'S', 'A', 'B', 'C'];
    const errors = [];

    if (entity.tier && !validTiers.includes(entity.tier)) {
        errors.push(
            `${type}[${index}] (${entity.name}): Invalid tier '${entity.tier}'. Must be one of: ${validTiers.join(', ')}`
        );
    }

    return errors;
}

/**
 * Comprehensive validation of all game data
 * @param {Object} allData - All loaded data
 * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}} Validation result
 */
export function validateAllData(allData) {
    const errors = [];
    const warnings = [];

    if (!allData) {
        return { valid: false, errors: ['No data provided for validation'], warnings: [] };
    }

    // Validate structure for each data type
    const dataTypes = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    dataTypes.forEach(type => {
        if (allData[type]) {
            const result = validateDataStructure(allData[type], type);
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

    ['weapons', 'tomes', 'characters'].forEach(type => {
        const entities = allData[type]?.[type] || [];
        entities.forEach((entity, index) => {
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
 * @param {Object} result - Validation result from validateAllData
 */
export function logValidationResults(result) {
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
