// ========================================
// MegaBonk Global Search Module
// ========================================
// Cross-tab search functionality

import type {
    Entity,
    EntityType,
    Item,
    Weapon,
    Tome,
    Character,
    Shrine,
    AllGameData,
} from '../types/index.ts';
import { fuzzyMatchScore } from './fuzzy-match.ts';

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

    // Score thresholds for early termination
    const EXACT_MATCH_SCORE = 2000;
    const STARTS_WITH_SCORE = 1500;
    const MAX_TOTAL_RESULTS = 100;

    // Define data sources with their types
    const dataSources: Array<{ type: EntityType; data: Entity[] | undefined }> = [
        { type: 'items', data: allData.items?.items },
        { type: 'weapons', data: allData.weapons?.weapons },
        { type: 'tomes', data: allData.tomes?.tomes },
        { type: 'characters', data: allData.characters?.characters },
        { type: 'shrines', data: allData.shrines?.shrines },
    ];

    // Search each data type
    for (const { type, data } of dataSources) {
        if (!data) continue;

        for (const item of data) {
            let bestScore = 0;

            // Check fields in priority order
            for (const field of searchFields) {
                const value = (item as unknown as Record<string, unknown>)[field];
                if (typeof value === 'string' && value) {
                    const match = fuzzyMatchScore(searchTerm, value, field);
                    if (match.score > bestScore) {
                        bestScore = match.score;
                        // Early termination for high-quality matches
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
            }
        }

        // Early termination if enough results
        if (results.length >= MAX_TOTAL_RESULTS) {
            break;
        }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
}
