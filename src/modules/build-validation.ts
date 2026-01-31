// ========================================
// MegaBonk Build Validation Module
// Build validation, synergy checking
// ========================================

import type { Character, Weapon, Item, Tome } from '../types/index.ts';
import type { Build } from './store.ts';
import { escapeHtml } from './utils.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Build data for serialization (with IDs only)
 */
export interface BuildData {
    character?: string;
    weapon?: string;
    tomes?: string[];
    items?: string[];
    name?: string;
    notes?: string;
    timestamp?: number;
}

/**
 * URL-encoded build data (abbreviated keys)
 */
export interface URLBuildData {
    c?: string;
    w?: string;
    t?: string[];
    i?: string[];
}

/**
 * Synergy result
 */
export interface SynergyResult {
    found: boolean;
    messages: string[];
}

// ========================================
// Build Entry Validation
// ========================================

/**
 * Validate a build history entry has required structure
 * @param entry - Entry to validate
 * @returns True if entry is valid
 */
export function isValidBuildEntry(entry: unknown): entry is BuildData {
    if (typeof entry !== 'object' || entry === null) return false;
    const obj = entry as Record<string, unknown>;
    // At minimum, must have some identifying property (character, weapon, or timestamp)
    // and arrays must be arrays (if present)
    if (obj.tomes !== undefined && !Array.isArray(obj.tomes)) return false;
    if (obj.items !== undefined && !Array.isArray(obj.items)) return false;
    return true;
}

/**
 * Validate base64 string format
 * @param encoded - String to validate
 * @returns True if valid base64
 */
export function isValidBase64(encoded: string): boolean {
    // Base64 should only contain alphanumeric, +, /, and = characters
    return /^[A-Za-z0-9+/=]+$/.test(encoded);
}

/**
 * Validate URL-encoded build data structure
 * @param decoded - Decoded object to validate
 * @returns True if valid build data structure
 */
export function isValidURLBuildData(decoded: unknown): decoded is URLBuildData {
    if (typeof decoded !== 'object' || decoded === null) return false;
    
    const obj = decoded as Record<string, unknown>;
    
    // Optional string fields
    if (obj.c !== undefined && typeof obj.c !== 'string') return false;
    if (obj.w !== undefined && typeof obj.w !== 'string') return false;
    
    // Optional string array fields
    if (obj.t !== undefined && (!Array.isArray(obj.t) || !obj.t.every(item => typeof item === 'string'))) return false;
    if (obj.i !== undefined && (!Array.isArray(obj.i) || !obj.i.every(item => typeof item === 'string'))) return false;
    
    return true;
}

// ========================================
// Synergy Detection
// ========================================

/**
 * Check character-weapon synergy
 * @param character - Character to check
 * @param weapon - Weapon to check
 * @returns True if synergy exists
 */
export function hasCharacterWeaponSynergy(character: Character, weapon: Weapon): boolean {
    return character.synergies_weapons?.includes(weapon.name) ?? false;
}

/**
 * Check item-weapon synergy
 * @param item - Item to check
 * @param weapon - Weapon to check
 * @returns True if synergy exists
 */
export function hasItemWeaponSynergy(item: Item, weapon: Weapon): boolean {
    const itemSynergies = item.synergies || [];
    const weaponName = weapon.name.toLowerCase();
    
    // Bug fix: Filter out empty strings to prevent false positives
    // ("sword".includes("") is always true, causing false matches)
    return itemSynergies.some(
        (syn: string) =>
            syn.length > 0 &&
            weaponName.length > 0 &&
            (syn.toLowerCase().includes(weaponName) ||
                weaponName.includes(syn.toLowerCase()))
    );
}

/**
 * Detect all synergies in a build
 * @param build - Build to analyze
 * @returns Synergy result with messages
 */
export function detectSynergies(build: Build): SynergyResult {
    const messages: string[] = [];
    
    // Check character-weapon synergy
    if (build.character && build.weapon) {
        if (hasCharacterWeaponSynergy(build.character, build.weapon)) {
            messages.push(
                `✓ ${escapeHtml(build.character.name)} synergizes with ${escapeHtml(build.weapon.name)}!`
            );
        }
    }
    
    // Check item synergies with weapon
    if (build.weapon) {
        build.items.forEach((item: Item) => {
            if (hasItemWeaponSynergy(item, build.weapon!)) {
                messages.push(`✓ ${escapeHtml(item.name)} works great with ${escapeHtml(build.weapon!.name)}`);
            }
        });
    }
    
    return {
        found: messages.length > 0,
        messages,
    };
}

/**
 * Check for potential anti-synergies or conflicts
 * @param build - Build to analyze
 * @returns Array of warning messages
 */
export function detectAntiSynergies(build: Build): string[] {
    const warnings: string[] = [];
    
    // Example: warn about conflicting item effects
    const itemIds = build.items.map(i => i.id);
    
    // Check for duplicate effect types that don't stack well
    const hasMultipleCritItems = itemIds.filter(id => 
        ['clover', 'eagle_claw', 'lucky_coin'].includes(id)
    ).length > 2;
    
    if (hasMultipleCritItems) {
        warnings.push('⚠️ Multiple crit items may have diminishing returns');
    }
    
    return warnings;
}

// ========================================
// Build Completeness Validation
// ========================================

/**
 * Check if build has minimum required components
 * @param build - Build to validate
 * @returns True if build is valid
 */
export function isValidBuild(build: Build): boolean {
    return build.character !== null || build.weapon !== null;
}

/**
 * Get build completeness percentage
 * @param build - Build to analyze
 * @returns Percentage (0-100) of build completeness
 */
export function getBuildCompleteness(build: Build): number {
    let score = 0;
    const maxScore = 4;
    
    if (build.character) score += 1;
    if (build.weapon) score += 1;
    if (build.tomes.length > 0) score += 1;
    if (build.items.length > 0) score += 1;
    
    return Math.round((score / maxScore) * 100);
}

/**
 * Validate build data from external source (import/URL)
 * @param data - Raw data to validate
 * @returns Validated BuildData or null if invalid
 */
export function validateBuildData(data: unknown): BuildData | null {
    if (!isValidBuildEntry(data)) return null;
    
    const buildData = data as BuildData;
    
    // Sanitize string fields
    if (buildData.character && typeof buildData.character !== 'string') return null;
    if (buildData.weapon && typeof buildData.weapon !== 'string') return null;
    if (buildData.name && typeof buildData.name !== 'string') return null;
    if (buildData.notes && typeof buildData.notes !== 'string') return null;
    
    // Validate timestamp if present
    if (buildData.timestamp !== undefined) {
        if (typeof buildData.timestamp !== 'number' || !Number.isFinite(buildData.timestamp)) {
            return null;
        }
    }
    
    return buildData;
}
