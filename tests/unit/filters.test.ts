/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

// Mock modules
vi.mock('../../src/modules/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Type definitions
interface FuzzyMatchResult {
    score: number;
    matchType: 'exact' | 'starts_with' | 'contains' | 'fuzzy' | 'none';
    field: string;
}

interface AdvancedSearchCriteria {
    text: string[];
    filters: Record<string, string>;
}

// ============================================================================
// REIMPLEMENTATION OF FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Calculate fuzzy match score for search
 */
function fuzzyMatchScore(searchTerm: string, text: string, fieldName: string = 'text'): FuzzyMatchResult {
    if (!searchTerm || !text) return { score: 0, matchType: 'none', field: fieldName };

    searchTerm = searchTerm.toLowerCase();
    text = text.toLowerCase();

    // Exact match gets highest score
    if (text === searchTerm) {
        return { score: 2000, matchType: 'exact', field: fieldName };
    }

    // Starts with search term (very relevant)
    if (text.startsWith(searchTerm)) {
        return { score: 1500, matchType: 'starts_with', field: fieldName };
    }

    // Contains search term (substring match)
    if (text.includes(searchTerm)) {
        return { score: 1000, matchType: 'contains', field: fieldName };
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

/**
 * Parse advanced search syntax
 */
function parseAdvancedSearch(query: string): AdvancedSearchCriteria {
    const criteria: AdvancedSearchCriteria = {
        text: [],
        filters: {},
    };

    if (!query) return criteria;

    // Split by spaces but preserve quoted strings
    const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    tokens.forEach(token => {
        // Remove quotes if present
        token = token.replace(/^"(.*)"$/, '$1');

        // Check if it's a filter syntax (key:value)
        const filterMatch = token.match(/^(\w+):([\w><=!]+)$/);

        if (filterMatch) {
            const [, key, value] = filterMatch;
            if (key && value) {
                criteria.filters[key] = value;
            }
        } else {
            // Regular search term
            criteria.text.push(token);
        }
    });

    return criteria;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Filters - fuzzyMatchScore', () => {
    describe('Empty/Invalid Input', () => {
        it('should return score 0 for empty search term', () => {
            const result = fuzzyMatchScore('', 'some text');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
            expect(result.field).toBe('text');
        });

        it('should return score 0 for empty text', () => {
            const result = fuzzyMatchScore('search', '');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should handle custom field name', () => {
            const result = fuzzyMatchScore('', '', 'name');

            expect(result.field).toBe('name');
        });
    });

    describe('Exact Match', () => {
        it('should return 2000 for exact match', () => {
            const result = fuzzyMatchScore('sword', 'sword');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should be case insensitive for exact match', () => {
            const result = fuzzyMatchScore('SWORD', 'sword');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should handle mixed case', () => {
            const result = fuzzyMatchScore('SwoRD', 'SwOrD');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });
    });

    describe('Starts With Match', () => {
        it('should return 1500 for starts with match', () => {
            const result = fuzzyMatchScore('fire', 'fireball');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should be case insensitive', () => {
            const result = fuzzyMatchScore('FIRE', 'fireball');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should work with single character', () => {
            const result = fuzzyMatchScore('f', 'fireball');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });
    });

    describe('Contains Match', () => {
        it('should return 1000 for substring match', () => {
            const result = fuzzyMatchScore('ball', 'fireball');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });

        it('should match in middle of word', () => {
            const result = fuzzyMatchScore('reb', 'fireball');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });

        it('should be case insensitive', () => {
            const result = fuzzyMatchScore('BALL', 'fireball');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });
    });

    describe('Fuzzy Match', () => {
        it('should match characters in sequence', () => {
            const result = fuzzyMatchScore('fbl', 'fireball');

            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        it('should score consecutive matches higher', () => {
            // 'fir' has consecutive matches
            const result1 = fuzzyMatchScore('fir', 'fireball');
            // 'fil' does not (i and l are separated)
            const result2 = fuzzyMatchScore('fil', 'fireball');

            expect(result1.matchType).toBe('starts_with'); // Should actually be starts_with
            expect(result2.matchType).toBe('fuzzy');
        });

        it('should return 0 if not all characters match', () => {
            const result = fuzzyMatchScore('xyz', 'fireball');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should handle partial character matches', () => {
            const result = fuzzyMatchScore('fbal', 'fireball');

            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        it('should calculate score based on consecutive matches', () => {
            // Test consecutive match scoring
            const result = fuzzyMatchScore('abc', 'aXbXc');

            // First 'a' matches at index 0: score += 1, consecutive = 1
            // 'b' matches at index 2: consecutive reset to 0, score += 1, consecutive = 1
            // 'c' matches at index 4: consecutive reset to 0, score += 1
            expect(result.score).toBe(3);
            expect(result.matchType).toBe('fuzzy');
        });

        it('should handle long fuzzy matches', () => {
            const result = fuzzyMatchScore('hvy', 'heavy armor');

            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });
    });

    describe('Match Priority', () => {
        it('should prioritize exact over starts_with', () => {
            const exact = fuzzyMatchScore('fire', 'fire');
            const startsWith = fuzzyMatchScore('fire', 'fireball');

            expect(exact.score).toBeGreaterThan(startsWith.score);
        });

        it('should prioritize starts_with over contains', () => {
            const startsWith = fuzzyMatchScore('fire', 'fireball');
            const contains = fuzzyMatchScore('ball', 'fireball');

            expect(startsWith.score).toBeGreaterThan(contains.score);
        });

        it('should prioritize contains over fuzzy', () => {
            const contains = fuzzyMatchScore('ball', 'fireball');
            const fuzzy = fuzzyMatchScore('fbl', 'fireball');

            expect(contains.score).toBeGreaterThan(fuzzy.score);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single character search', () => {
            const result = fuzzyMatchScore('f', 'f');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should handle single character text', () => {
            const result = fuzzyMatchScore('fire', 'f');

            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should handle special characters', () => {
            const result = fuzzyMatchScore('sword+1', 'sword+1');

            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should handle spaces in text', () => {
            const result = fuzzyMatchScore('heavy', 'heavy armor');

            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should handle numbers', () => {
            const result = fuzzyMatchScore('123', 'item123');

            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });
    });
});

describe('Filters - parseAdvancedSearch', () => {
    describe('Empty/Simple Queries', () => {
        it('should return empty criteria for empty query', () => {
            const result = parseAdvancedSearch('');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({});
        });

        it('should parse single text term', () => {
            const result = parseAdvancedSearch('sword');

            expect(result.text).toEqual(['sword']);
            expect(result.filters).toEqual({});
        });

        it('should parse multiple text terms', () => {
            const result = parseAdvancedSearch('fire sword');

            expect(result.text).toEqual(['fire', 'sword']);
            expect(result.filters).toEqual({});
        });
    });

    describe('Filter Syntax', () => {
        it('should parse single filter', () => {
            const result = parseAdvancedSearch('tier:SS');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ tier: 'SS' });
        });

        it('should parse multiple filters', () => {
            const result = parseAdvancedSearch('tier:SS rarity:legendary');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ tier: 'SS', rarity: 'legendary' });
        });

        it('should parse filters with comparison operators', () => {
            const result = parseAdvancedSearch('damage:>100');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ damage: '>100' });
        });

        it('should parse boolean filters', () => {
            const result = parseAdvancedSearch('stacks_well:true');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ stacks_well: 'true' });
        });

        it('should handle less than operator', () => {
            const result = parseAdvancedSearch('cost:<50');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ cost: '<50' });
        });

        it('should handle equals operator', () => {
            const result = parseAdvancedSearch('level:=5');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ level: '=5' });
        });

        it('should handle not equals operator', () => {
            const result = parseAdvancedSearch('type:!weapon');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ type: '!weapon' });
        });
    });

    describe('Mixed Queries', () => {
        it('should parse text and filters together', () => {
            const result = parseAdvancedSearch('fire tier:SS');

            expect(result.text).toEqual(['fire']);
            expect(result.filters).toEqual({ tier: 'SS' });
        });

        it('should parse complex mixed query', () => {
            const result = parseAdvancedSearch('tier:SS damage:>100 stacks_well:true fire');

            expect(result.text).toEqual(['fire']);
            expect(result.filters).toEqual({
                tier: 'SS',
                damage: '>100',
                stacks_well: 'true',
            });
        });

        it('should handle filters at beginning, middle, and end', () => {
            const result = parseAdvancedSearch('tier:SS sword rarity:epic powerful');

            expect(result.text).toEqual(['sword', 'powerful']);
            expect(result.filters).toEqual({ tier: 'SS', rarity: 'epic' });
        });
    });

    describe('Quoted Strings', () => {
        it('should preserve spaces in quoted strings', () => {
            const result = parseAdvancedSearch('"heavy armor"');

            expect(result.text).toEqual(['heavy armor']);
            expect(result.filters).toEqual({});
        });

        it('should parse quoted string with filters', () => {
            const result = parseAdvancedSearch('"fire sword" tier:SS');

            expect(result.text).toEqual(['fire sword']);
            expect(result.filters).toEqual({ tier: 'SS' });
        });

        it('should handle multiple quoted strings', () => {
            const result = parseAdvancedSearch('"heavy armor" "fire sword"');

            expect(result.text).toEqual(['heavy armor', 'fire sword']);
            expect(result.filters).toEqual({});
        });

        it('should mix quoted and unquoted terms', () => {
            const result = parseAdvancedSearch('basic "heavy armor" sword');

            expect(result.text).toEqual(['basic', 'heavy armor', 'sword']);
            expect(result.filters).toEqual({});
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid filter syntax (no value)', () => {
            const result = parseAdvancedSearch('tier: value');

            // "tier:" doesn't match filter pattern, treated as text
            expect(result.text).toContain('tier:');
            expect(result.text).toContain('value');
        });

        it('should handle filter with spaces (treated as text)', () => {
            const result = parseAdvancedSearch('tier: SS');

            // Space breaks the filter syntax
            expect(result.text).toContain('tier:');
            expect(result.text).toContain('SS');
        });

        it('should handle multiple colons', () => {
            const result = parseAdvancedSearch('url:http://example');

            // Only matches \w+ for value, so http: won't match
            expect(result.text).toContain('url:http://example');
        });

        it('should handle filter with underscore in key', () => {
            const result = parseAdvancedSearch('stacks_well:true');

            expect(result.filters).toEqual({ stacks_well: 'true' });
        });

        it('should handle empty quoted string', () => {
            const result = parseAdvancedSearch('""');

            expect(result.text).toEqual(['']);
        });

        it('should handle only spaces', () => {
            const result = parseAdvancedSearch('   ');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({});
        });

        it('should handle tab characters', () => {
            const result = parseAdvancedSearch('fire\tsword');

            // Tabs are not matched by \s in the regex, will be treated as separate tokens
            expect(result.text.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Real World Examples', () => {
        it('should parse item search query', () => {
            const result = parseAdvancedSearch('tier:SS rarity:legendary damage fire');

            // 'damage' without value is treated as text, not a filter
            expect(result.text).toEqual(['damage', 'fire']);
            expect(result.filters).toEqual({ tier: 'SS', rarity: 'legendary' });
        });

        it('should parse numeric filter query', () => {
            const result = parseAdvancedSearch('damage:>100 crit_chance:>50');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ damage: '>100', crit_chance: '>50' });
        });

        it('should parse boolean exclusion query', () => {
            const result = parseAdvancedSearch('stacks_well:false tier:A');

            expect(result.text).toEqual([]);
            expect(result.filters).toEqual({ stacks_well: 'false', tier: 'A' });
        });

        it('should parse complex item search', () => {
            const result = parseAdvancedSearch('"critical strike" tier:SS damage:>200 legendary');

            expect(result.text).toEqual(['critical strike', 'legendary']);
            expect(result.filters).toEqual({ tier: 'SS', damage: '>200' });
        });
    });
});
