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
    if (currentBuild.weapon) {
        currentBuild.items.forEach((item: Item) => {
            if (item.synergies_weapons?.includes(currentBuild.weapon!.name)) {
                synergies.push({
                    type: 'item-weapon',
                    message: `${item.name} works great with ${currentBuild.weapon!.name}`,
                    source: item.name,
                    target: currentBuild.weapon!.name,
                });
            }
        });
    }

    // Item-Character synergies
    if (currentBuild.character) {
        currentBuild.items.forEach((item: Item) => {
            if (currentBuild.character!.synergies_items?.includes(item.id)) {
                synergies.push({
                    type: 'item-character',
                    message: `${item.name} synergizes with ${currentBuild.character!.name}`,
                    source: item.name,
                    target: currentBuild.character!.name,
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
            currentBuild.items.forEach((otherItem: Item) => {
                if (item.id !== otherItem.id) {
                    if (item.anti_synergies!.includes(otherItem.name) || item.anti_synergies!.includes(otherItem.id)) {
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
