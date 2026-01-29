// ========================================
// MegaBonk Fuzzy Match Module
// ========================================
// Fuzzy search algorithm and advanced search parsing

// ========================================
// Type Definitions
// ========================================

/**
 * Fuzzy match result with context
 */
export interface FuzzyMatchResult {
    score: number;
    matchType: 'exact' | 'starts_with' | 'contains' | 'fuzzy' | 'none';
    field: string;
}

/**
 * Advanced search criteria
 */
export interface AdvancedSearchCriteria {
    text: string[];
    filters: Record<string, string>;
}

// ========================================
// Fuzzy Search Algorithm
// ========================================

// ========================================
// Score Constants
// ========================================

// Base scores for match types
const SCORE_EXACT = 2000;
const SCORE_STARTS_WITH = 1500;
const SCORE_CONTAINS = 1000;

// Bonus for name field matches (ensures "Big Bonk" appears before items with "bonk" in description)
const NAME_FIELD_BONUS = 1000;

/**
 * Calculate fuzzy match score between search term and text
 * Returns both score and match type for UX context
 * @param searchTerm - Search term
 * @param text - Text to search in
 * @param fieldName - Name of field being searched (for context)
 * @returns Match result with context
 */
export function fuzzyMatchScore(searchTerm: string, text: string, fieldName: string = 'text'): FuzzyMatchResult {
    // Handle null/undefined/empty inputs
    if (!searchTerm || !text || typeof searchTerm !== 'string' || typeof text !== 'string') {
        return { score: 0, matchType: 'none', field: fieldName };
    }

    // Trim and normalize whitespace
    searchTerm = searchTerm.trim().toLowerCase();
    text = text.trim().toLowerCase();

    // Return early if either is empty after trimming
    if (searchTerm.length === 0 || text.length === 0) {
        return { score: 0, matchType: 'none', field: fieldName };
    }

    // Apply bonus for name field matches
    const isNameField = fieldName === 'name';
    const fieldBonus = isNameField ? NAME_FIELD_BONUS : 0;

    // Exact match gets highest score
    if (text === searchTerm) {
        return { score: SCORE_EXACT + fieldBonus, matchType: 'exact', field: fieldName };
    }

    // Starts with search term (very relevant)
    if (text.startsWith(searchTerm)) {
        return { score: SCORE_STARTS_WITH + fieldBonus, matchType: 'starts_with', field: fieldName };
    }

    // Contains search term (substring match)
    if (text.includes(searchTerm)) {
        return { score: SCORE_CONTAINS + fieldBonus, matchType: 'contains', field: fieldName };
    }

    // Calculate fuzzy match score (character sequence)
    let score = 0;
    let searchIndex = 0;
    let consecutiveMatches = 0;

    for (let i = 0; i < text.length && searchIndex < searchTerm.length; i++) {
        if (text[i] === searchTerm[searchIndex]) {
            score += 1 + consecutiveMatches;
            consecutiveMatches++;
            searchIndex++;
        } else {
            consecutiveMatches = 0;
        }
    }

    // Return 0 if not all characters matched
    if (searchIndex !== searchTerm.length) {
        return { score: 0, matchType: 'none', field: fieldName };
    }

    return { score, matchType: 'fuzzy', field: fieldName };
}

// ========================================
// Advanced Search Syntax Parser
// ========================================

/**
 * Allowed filter keys for advanced search
 * Whitelist approach prevents prototype pollution attacks
 */
const ALLOWED_FILTER_KEYS = new Set([
    // Entity properties
    'tier',
    'rarity',
    'type',
    'name',
    'id',
    // Item properties
    'damage',
    'hp',
    'stacks_well',
    'one_and_done',
    'stat',
    'priority',
    'tags',
    'synergy',
    'effect',
    'scaling_type',
    'graph_type',
    'multiplier',
    'base_effect',
    'formula',
    // Character/Weapon properties
    'attack_speed',
    'movement_speed',
    'crit_chance',
    'crit_damage',
    'armor',
    'evasion',
    // Tome properties
    'stat_affected',
    'value_per_level',
]);

/**
 * Parse advanced search syntax
 * Examples: "tier:SS damage:>100 stacks_well:true fire"
 * @param query - Search query
 * @returns Parsed search criteria
 */
export function parseAdvancedSearch(query: string): AdvancedSearchCriteria {
    const criteria: AdvancedSearchCriteria = {
        text: [],
        filters: {},
    };

    // Handle null/undefined/non-string inputs
    if (!query || typeof query !== 'string') return criteria;

    // Trim and check for empty string
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return criteria;

    // Limit query length to prevent ReDoS attacks
    const safeQuery = trimmedQuery.slice(0, 1000);

    // Split by spaces but preserve quoted strings
    const tokens = safeQuery.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    // Limit token count to prevent DoS
    const maxTokens = 50;
    const limitedTokens = tokens.slice(0, maxTokens);

    limitedTokens.forEach(token => {
        if (!token || token.length === 0) return;

        // Remove quotes if present
        token = token.replace(/^["'](.*)["']$/, '$1');

        if (token.length === 0) return;

        // Check if it's a filter syntax (key:value)
        const filterMatch = token.match(/^(\w+):([\w><=!.+-]+)$/);

        if (filterMatch) {
            const [, key, value] = filterMatch;
            // Only allow whitelisted filter keys to prevent prototype pollution
            if (key && value && key.length <= 50 && value.length <= 100 && ALLOWED_FILTER_KEYS.has(key.toLowerCase())) {
                criteria.filters[key.toLowerCase()] = value;
            }
        } else {
            if (token.length <= 200) {
                criteria.text.push(token);
            }
        }
    });

    return criteria;
}

/**
 * Apply advanced filter criteria to an item
 * @param item - Item to check
 * @param filters - Filter criteria
 * @returns True if item matches all filters
 */
export function matchesAdvancedFilters(item: Record<string, unknown>, filters: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(filters)) {
        const itemValue = item[key];

        if (itemValue === undefined || itemValue === null) {
            return false;
        }

        if (value === undefined || value === null) {
            continue;
        }

        // Handle comparison operators
        if (value.startsWith('>=')) {
            const threshold = parseFloat(value.substring(2));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue < threshold) return false;
        } else if (value.startsWith('<=')) {
            const threshold = parseFloat(value.substring(2));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue > threshold) return false;
        } else if (value.startsWith('>')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue <= threshold) return false;
        } else if (value.startsWith('<')) {
            const threshold = parseFloat(value.substring(1));
            const numValue = parseFloat(String(itemValue));
            if (isNaN(threshold) || isNaN(numValue) || numValue >= threshold) return false;
        } else if (value.startsWith('!')) {
            if (String(itemValue).toLowerCase() === value.substring(1).toLowerCase()) return false;
        } else {
            // Exact match (case insensitive)
            if (String(itemValue).toLowerCase() !== value.toLowerCase()) return false;
        }
    }

    return true;
}
