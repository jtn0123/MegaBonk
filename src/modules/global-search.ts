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

/**
 * Search across all data types (items, weapons, tomes, characters, shrines)
 * Returns results sorted by match score
 * Optimized with early termination and result limits
 * @param query - Search query
 * @param allData - All game data
 * @returns Sorted array of search results
 */
export function globalSearch(query: string, allData: AllGameData): GlobalSearchResult[] {
    if (!query || !query.trim()) {
        return [];
    }

    const results: GlobalSearchResult[] = [];
    const searchTerm = query.trim().toLowerCase();

    // Prioritize fields by importance
    const searchFields = [
        'name',
        'base_effect',
        'attack_pattern',
        'passive_ability',
        'reward',
        'description',
        'effect',
        'passive',
    ];

    // Score thresholds for early termination within field search
    // These are boosted to account for name field bonus (+1000) in fuzzy-match.ts
    const EXACT_MATCH_SCORE = 3000; // 2000 base + 1000 name bonus
    const STARTS_WITH_SCORE = 2500; // 1500 base + 1000 name bonus
    // MAX_GLOBAL_SEARCH_RESULTS and MAX_SEARCH_RESULTS_PER_TYPE imported from constants.ts

    // Define data sources with their types
    const dataSources: Array<{ type: EntityType; data: Entity[] | undefined }> = [
        { type: 'items', data: allData.items?.items },
        { type: 'weapons', data: allData.weapons?.weapons },
        { type: 'tomes', data: allData.tomes?.tomes },
        { type: 'characters', data: allData.characters?.characters },
        { type: 'shrines', data: allData.shrines?.shrines },
    ];

    // Search each data type - don't break early to ensure all types are searched
    for (const { type, data } of dataSources) {
        if (!data) continue;

        let resultsForType = 0;

        for (const item of data) {
            // Limit results per type to ensure variety across all data types
            if (resultsForType >= MAX_SEARCH_RESULTS_PER_TYPE) {
                break;
            }

            let bestScore = 0;

            // Check fields in priority order
            for (const field of searchFields) {
                const value = (item as unknown as Record<string, unknown>)[field];
                if (typeof value === 'string' && value) {
                    const match = fuzzyMatchScore(searchTerm, value, field);
                    if (match.score > bestScore) {
                        bestScore = match.score;
                        // Early termination for high-quality matches within item
                        if (bestScore >= STARTS_WITH_SCORE && field === 'name') {
                            break;
                        }
                        if (bestScore >= EXACT_MATCH_SCORE) {
                            break;
                        }
                    }
                }
            }

            // Check tags if no strong match yet
            if (bestScore < STARTS_WITH_SCORE) {
                const tags = item.tags;
                if (Array.isArray(tags)) {
                    const tagsString = tags.join(' ');
                    const match = fuzzyMatchScore(searchTerm, tagsString, 'tags');
                    if (match.score > bestScore) {
                        bestScore = match.score;
                    }
                }
            }

            if (bestScore > 0) {
                results.push({
                    type,
                    item: item as Item | Weapon | Tome | Character | Shrine,
                    score: bestScore,
                });
                resultsForType++;
            }
        }
    }

    // Sort by score (highest first) and limit total results
    return results.sort((a, b) => b.score - a.score).slice(0, MAX_GLOBAL_SEARCH_RESULTS);
}
