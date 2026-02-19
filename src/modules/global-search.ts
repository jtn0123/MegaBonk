// ========================================
// MegaBonk Global Search Module
// ========================================
// Cross-tab search functionality

import type { Entity, EntityType, Item, Weapon, Tome, Character, Shrine, AllGameData } from '../types/index.ts';
import { fuzzyMatchScore } from './fuzzy-match.ts';
import { MAX_GLOBAL_SEARCH_RESULTS, MAX_SEARCH_RESULTS_PER_TYPE } from './constants.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Global search result with type and score
 */
export interface GlobalSearchResult {
    type: EntityType;
    item: Item | Weapon | Tome | Character | Shrine;
    score: number;
}

// ========================================
// Global Search
// ========================================

// Score thresholds for early termination within field search
// These are boosted to account for name field bonus (+1000) in fuzzy-match.ts
const EXACT_MATCH_SCORE = 3000; // 2000 base + 1000 name bonus
const STARTS_WITH_SCORE = 2500; // 1500 base + 1000 name bonus

const SEARCH_FIELDS = [
    'name',
    'base_effect',
    'attack_pattern',
    'passive_ability',
    'reward',
    'description',
    'effect',
    'passive',
] as const;

/**
 * Score a single entity against a search term by checking fields and tags
 */
function scoreEntity(searchTerm: string, item: Entity): number {
    let bestScore = 0;

    for (const field of SEARCH_FIELDS) {
        const value = (item as unknown as Record<string, unknown>)[field];
        if (typeof value !== 'string' || !value) continue;

        const match = fuzzyMatchScore(searchTerm, value, field);
        if (match.score <= bestScore) continue;

        bestScore = match.score;
        if (bestScore >= EXACT_MATCH_SCORE) break;
        if (bestScore >= STARTS_WITH_SCORE && field === 'name') break;
    }

    if (bestScore < STARTS_WITH_SCORE && Array.isArray(item.tags)) {
        const tagScore = fuzzyMatchScore(searchTerm, item.tags.join(' '), 'tags').score;
        if (tagScore > bestScore) bestScore = tagScore;
    }

    return bestScore;
}

/**
 * Search across all data types (items, weapons, tomes, characters, shrines)
 * Returns results sorted by match score
 * Optimized with early termination and result limits
 */
export function globalSearch(query: string, allData: AllGameData): GlobalSearchResult[] {
    if (!query?.trim()) return [];

    const results: GlobalSearchResult[] = [];
    const searchTerm = query.trim().toLowerCase();

    const dataSources: Array<{ type: EntityType; data: Entity[] | undefined }> = [
        { type: 'items', data: allData.items?.items },
        { type: 'weapons', data: allData.weapons?.weapons },
        { type: 'tomes', data: allData.tomes?.tomes },
        { type: 'characters', data: allData.characters?.characters },
        { type: 'shrines', data: allData.shrines?.shrines },
    ];

    for (const { type, data } of dataSources) {
        if (!data) continue;

        let resultsForType = 0;

        for (const item of data) {
            if (resultsForType >= MAX_SEARCH_RESULTS_PER_TYPE) break;

            const bestScore = scoreEntity(searchTerm, item);
            if (bestScore <= 0) continue;

            results.push({
                type,
                item: item as Item | Weapon | Tome | Character | Shrine,
                score: bestScore,
            });
            resultsForType++;
        }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, MAX_GLOBAL_SEARCH_RESULTS);
}
