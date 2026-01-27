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
    if (currentBuild.weapon) {
        const weapon = currentBuild.weapon;
        currentBuild.items.forEach((item: Item) => {
            // Check both synergies and synergies_weapons fields
            const itemSynergies = item.synergies || [];
            const itemSynergiesWeapons = item.synergies_weapons || [];
            const allSynergies = [...itemSynergies, ...itemSynergiesWeapons];
            const hasWeaponSynergy = allSynergies.some(
                (syn: string) =>
                    syn.toLowerCase() === weapon.name.toLowerCase() ||
                    syn.toLowerCase().includes(weapon.name.toLowerCase()) ||
                    weapon.name.toLowerCase().includes(syn.toLowerCase())
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
    // Note: character.synergies_items may contain item names OR IDs
    if (currentBuild.character) {
        const character = currentBuild.character;
        currentBuild.items.forEach((item: Item) => {
            const charSynergies = character.synergies_items || [];
            // Check by ID, exact name match, and partial match for flexibility
            const hasCharSynergy = charSynergies.some(
                (syn: string) =>
                    syn === item.id ||
                    syn === item.name ||
                    syn.toLowerCase().includes(item.name.toLowerCase()) ||
                    item.name.toLowerCase().includes(syn.toLowerCase())
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

    currentBuild.items.forEach((item: Item) => {
        if (item.anti_synergies && item.anti_synergies.length > 0) {
            const antiSynergyList = item.anti_synergies;
            currentBuild.items.forEach((otherItem: Item) => {
                if (item.id !== otherItem.id) {
                    if (antiSynergyList.includes(otherItem.name) || antiSynergyList.includes(otherItem.id)) {
                        antiSynergies.push({
                            type: 'item-item',
                            message: `${item.name} conflicts with ${otherItem.name}`,
                            source: item.name,
                            target: otherItem.name,
                        });
                    }
                }
            });
        }
    });

    return antiSynergies;
}
