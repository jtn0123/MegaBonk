// ========================================
// MegaBonk Synergy Detection Module
// ========================================
// Pure functions for detecting synergies and anti-synergies
// between characters, weapons, and items in a build.
// ========================================

import type { Character, Weapon, Item } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Current build state for synergy detection
 */
export interface BuildState {
    character: Character | null;
    weapon: Weapon | null;
    tomes: unknown[];
    items: Item[];
}

/**
 * Synergy detection result
 */
export interface Synergy {
    type: 'character-weapon' | 'item-weapon' | 'item-character' | 'item-item';
    message: string;
    source: string;
    target: string;
}

/**
 * Anti-synergy detection result
 */
export interface AntiSynergy {
    type: 'item-item';
    message: string;
    source: string;
    target: string;
}

// ========================================
// Synergy Detection Functions
// ========================================

/**
 * Detect all synergies in a build
 * @param currentBuild - Current build state
 * @returns Array of detected synergies
 */
export function detectSynergies(currentBuild: BuildState): Synergy[] {
    const synergies: Synergy[] = [];

    // Character-Weapon synergies
    if (currentBuild.character && currentBuild.weapon) {
        if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push({
                type: 'character-weapon',
                message: `${currentBuild.character.name} synergizes with ${currentBuild.weapon.name}!`,
                source: currentBuild.character.name,
                target: currentBuild.weapon.name,
            });
        }
    }

    // Item-Weapon synergies
    // Note: Items may use 'synergies' or 'synergies_weapons' field
    // Use strict matching by ID or exact name to prevent false positives
    if (currentBuild.weapon) {
        const weapon = currentBuild.weapon;
        currentBuild.items.forEach((item: Item) => {
            // Check both synergies and synergies_weapons fields
            const itemSynergies = item.synergies || [];
            const itemSynergiesWeapons = item.synergies_weapons || [];
            const allSynergies = [...itemSynergies, ...itemSynergiesWeapons];
            // Strict matching: exact ID or exact name (case-insensitive)
            const hasWeaponSynergy = allSynergies.some(
                (syn: string) => syn === weapon.id || syn.toLowerCase() === weapon.name.toLowerCase()
            );
            if (hasWeaponSynergy) {
                synergies.push({
                    type: 'item-weapon',
                    message: `${item.name} works great with ${weapon.name}`,
                    source: item.name,
                    target: weapon.name,
                });
            }
        });
    }

    // Item-Character synergies
    // Note: character.synergies_items should contain item IDs (snake_case)
    // Use strict matching to prevent false positives
    if (currentBuild.character) {
        const character = currentBuild.character;
        currentBuild.items.forEach((item: Item) => {
            const charSynergies = character.synergies_items || [];
            // Strict matching: exact ID or exact name (case-insensitive)
            const hasCharSynergy = charSynergies.some(
                (syn: string) => syn === item.id || syn.toLowerCase() === item.name.toLowerCase()
            );
            if (hasCharSynergy) {
                synergies.push({
                    type: 'item-character',
                    message: `${item.name} synergizes with ${character.name}`,
                    source: item.name,
                    target: character.name,
                });
            }
        });
    }

    // Item-Item synergies
    currentBuild.items.forEach((item: Item, index: number) => {
        currentBuild.items.slice(index + 1).forEach((otherItem: Item) => {
            if (item.synergies?.includes(otherItem.name) || item.synergies?.includes(otherItem.id)) {
                synergies.push({
                    type: 'item-item',
                    message: `${item.name} synergizes with ${otherItem.name}`,
                    source: item.name,
                    target: otherItem.name,
                });
            }
        });
    });

    return synergies;
}

/**
 * Detect anti-synergies between items in a build
 * @param currentBuild - Current build state
 * @returns Array of detected anti-synergies
 */
export function detectAntiSynergies(currentBuild: BuildState): AntiSynergy[] {
    const antiSynergies: AntiSynergy[] = [];

    currentBuild.items.forEach((item: Item, index: number) => {
        if (item.anti_synergies && item.anti_synergies.length > 0) {
            const antiSynergyList = item.anti_synergies;
            currentBuild.items.forEach((otherItem: Item, otherIndex: number) => {
                if (index === otherIndex) return;
                if (antiSynergyList.includes(otherItem.name) || antiSynergyList.includes(otherItem.id)) {
                    antiSynergies.push({
                        type: 'item-item',
                        message: `${item.name} conflicts with ${otherItem.name}`,
                        source: item.name,
                        target: otherItem.name,
                    });
                }
            });
        }
    });

    return antiSynergies;
}
