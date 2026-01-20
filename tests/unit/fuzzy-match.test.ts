// ========================================
// Fuzzy Match Module Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing the module
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    fuzzyMatchScore,
    parseAdvancedSearch,
    matchesAdvancedFilters,
    type FuzzyMatchResult,
    type AdvancedSearchCriteria,
} from '../../src/modules/fuzzy-match.ts';

describe('fuzzy-match module', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    // ========================================
    // fuzzyMatchScore Tests
    // ========================================
    describe('fuzzyMatchScore', () => {
        describe('exact matches', () => {
            it('should return highest score (2000) for exact match', () => {
                const result = fuzzyMatchScore('sword', 'sword', 'name');
                expect(result.score).toBe(2000);
                expect(result.matchType).toBe('exact');
                expect(result.field).toBe('name');
            });

            it('should be case insensitive for exact matches', () => {
                const result = fuzzyMatchScore('SWORD', 'sword', 'name');
                expect(result.score).toBe(2000);
                expect(result.matchType).toBe('exact');
            });

            it('should handle mixed case exact matches', () => {
                const result = fuzzyMatchScore('SwoRd', 'sWoRD', 'name');
                expect(result.score).toBe(2000);
                expect(result.matchType).toBe('exact');
            });
        });

        describe('starts_with matches', () => {
            it('should return 1500 for starts_with match', () => {
                const result = fuzzyMatchScore('fire', 'fire sword', 'name');
                expect(result.score).toBe(1500);
                expect(result.matchType).toBe('starts_with');
            });

            it('should be case insensitive for starts_with', () => {
                const result = fuzzyMatchScore('FIRE', 'fire sword', 'name');
                expect(result.score).toBe(1500);
                expect(result.matchType).toBe('starts_with');
            });
        });

        describe('contains matches', () => {
            it('should return 1000 for contains match', () => {
                const result = fuzzyMatchScore('sword', 'fire sword of doom', 'name');
                expect(result.score).toBe(1000);
                expect(result.matchType).toBe('contains');
            });

            it('should be case insensitive for contains', () => {
                const result = fuzzyMatchScore('SWORD', 'fire sword of doom', 'name');
                expect(result.score).toBe(1000);
                expect(result.matchType).toBe('contains');
            });

            it('should match at end of string', () => {
                const result = fuzzyMatchScore('doom', 'fire sword of doom', 'name');
                expect(result.score).toBe(1000);
                expect(result.matchType).toBe('contains');
            });
        });

        describe('fuzzy matches', () => {
            it('should return fuzzy score for character sequence match', () => {
                const result = fuzzyMatchScore('fsd', 'fire sword of doom', 'name');
                expect(result.score).toBeGreaterThan(0);
                expect(result.matchType).toBe('fuzzy');
            });

            it('should give higher score for consecutive character matches', () => {
                // 'fir' has consecutive matches in 'fire'
                const result1 = fuzzyMatchScore('fir', 'fire sword', 'name');
                // 'fsr' has non-consecutive matches
                const result2 = fuzzyMatchScore('fsr', 'fire sword', 'name');

                expect(result1.score).toBeGreaterThan(result2.score);
            });

            it('should return fuzzy match for partial character sequence', () => {
                const result = fuzzyMatchScore('fsod', 'fire sword of doom', 'name');
                expect(result.score).toBeGreaterThan(0);
                expect(result.matchType).toBe('fuzzy');
            });
        });

        describe('no match', () => {
            it('should return 0 for no match', () => {
                const result = fuzzyMatchScore('xyz', 'fire sword', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should return 0 when not all characters match', () => {
                const result = fuzzyMatchScore('firez', 'fire', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });
        });

        describe('edge cases', () => {
            it('should handle null search term', () => {
                const result = fuzzyMatchScore(null as unknown as string, 'fire sword', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle undefined search term', () => {
                const result = fuzzyMatchScore(undefined as unknown as string, 'fire sword', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle null text', () => {
                const result = fuzzyMatchScore('fire', null as unknown as string, 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle undefined text', () => {
                const result = fuzzyMatchScore('fire', undefined as unknown as string, 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle empty search term', () => {
                const result = fuzzyMatchScore('', 'fire sword', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle empty text', () => {
                const result = fuzzyMatchScore('fire', '', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle whitespace-only search term', () => {
                const result = fuzzyMatchScore('   ', 'fire sword', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle whitespace-only text', () => {
                const result = fuzzyMatchScore('fire', '   ', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should handle non-string inputs', () => {
                const result = fuzzyMatchScore(123 as unknown as string, 'fire', 'name');
                expect(result.score).toBe(0);
                expect(result.matchType).toBe('none');
            });

            it('should use default field name', () => {
                const result = fuzzyMatchScore('fire', 'fire');
                expect(result.field).toBe('text');
            });

            it('should handle special characters in search', () => {
                const result = fuzzyMatchScore('fire+ice', 'fire+ice effect', 'name');
                expect(result.score).toBe(1500);
                expect(result.matchType).toBe('starts_with');
            });

            it('should handle unicode characters', () => {
                const result = fuzzyMatchScore('épée', 'épée de feu', 'name');
                expect(result.score).toBe(1500);
                expect(result.matchType).toBe('starts_with');
            });

            it('should handle very long inputs', () => {
                const longText = 'a'.repeat(10000);
                const result = fuzzyMatchScore('a', longText, 'name');
                expect(result.score).toBe(1500); // starts_with
            });

            it('should trim whitespace from inputs', () => {
                const result = fuzzyMatchScore('  fire  ', '  fire  ', 'name');
                expect(result.score).toBe(2000);
                expect(result.matchType).toBe('exact');
            });
        });
    });

    // ========================================
    // parseAdvancedSearch Tests
    // ========================================
    describe('parseAdvancedSearch', () => {
        describe('basic parsing', () => {
            it('should parse simple text search', () => {
                const result = parseAdvancedSearch('fire sword');
                expect(result.text).toEqual(['fire', 'sword']);
                expect(result.filters).toEqual({});
            });

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

            it('should parse mixed text and filters', () => {
                const result = parseAdvancedSearch('fire tier:SS sword rarity:legendary');
                expect(result.text).toEqual(['fire', 'sword']);
                expect(result.filters).toEqual({ tier: 'SS', rarity: 'legendary' });
            });
        });

        describe('comparison operators', () => {
            it('should parse greater than filter', () => {
                const result = parseAdvancedSearch('damage:>100');
                expect(result.filters).toEqual({ damage: '>100' });
            });

            it('should parse greater than or equal filter', () => {
                const result = parseAdvancedSearch('damage:>=50');
                expect(result.filters).toEqual({ damage: '>=50' });
            });

            it('should parse less than filter', () => {
                const result = parseAdvancedSearch('damage:<200');
                expect(result.filters).toEqual({ damage: '<200' });
            });

            it('should parse less than or equal filter', () => {
                const result = parseAdvancedSearch('damage:<=150');
                expect(result.filters).toEqual({ damage: '<=150' });
            });

            it('should parse negation filter', () => {
                const result = parseAdvancedSearch('rarity:!common');
                expect(result.filters).toEqual({ rarity: '!common' });
            });

            it('should parse decimal values', () => {
                const result = parseAdvancedSearch('multiplier:>1.5');
                expect(result.filters).toEqual({ multiplier: '>1.5' });
            });

            it('should parse negative values', () => {
                const result = parseAdvancedSearch('damage:>-10');
                expect(result.filters).toEqual({ damage: '>-10' });
            });
        });

        describe('quoted strings', () => {
            it('should parse double-quoted strings', () => {
                const result = parseAdvancedSearch('"fire sword"');
                expect(result.text).toEqual(['fire sword']);
            });

            it('should handle single quotes (not treated as string delimiters)', () => {
                // Note: Only double quotes group words together
                // Single quotes are treated as regular characters
                const result = parseAdvancedSearch("'fire sword'");
                // Single-quoted strings are split by space and quotes are stripped from each token
                expect(result.text).toEqual(["'fire", "sword'"]);
            });

            it('should handle mixed quoted and unquoted', () => {
                const result = parseAdvancedSearch('"fire sword" tier:SS');
                expect(result.text).toEqual(['fire sword']);
                expect(result.filters).toEqual({ tier: 'SS' });
            });
        });

        describe('edge cases', () => {
            it('should handle null input', () => {
                const result = parseAdvancedSearch(null as unknown as string);
                expect(result.text).toEqual([]);
                expect(result.filters).toEqual({});
            });

            it('should handle undefined input', () => {
                const result = parseAdvancedSearch(undefined as unknown as string);
                expect(result.text).toEqual([]);
                expect(result.filters).toEqual({});
            });

            it('should handle empty string', () => {
                const result = parseAdvancedSearch('');
                expect(result.text).toEqual([]);
                expect(result.filters).toEqual({});
            });

            it('should handle whitespace-only string', () => {
                const result = parseAdvancedSearch('   ');
                expect(result.text).toEqual([]);
                expect(result.filters).toEqual({});
            });

            it('should limit query length for security', () => {
                const longQuery = 'a'.repeat(2000);
                const result = parseAdvancedSearch(longQuery);
                // Should not throw and should handle gracefully
                expect(result).toBeDefined();
            });

            it('should limit token count for security', () => {
                const manyTokens = Array(100).fill('word').join(' ');
                const result = parseAdvancedSearch(manyTokens);
                // Should limit to 50 tokens
                expect(result.text.length).toBeLessThanOrEqual(50);
            });

            it('should limit key length for security', () => {
                const longKey = 'a'.repeat(100) + ':value';
                const result = parseAdvancedSearch(longKey);
                // Should not include filter with key > 50 chars
                expect(Object.keys(result.filters).length).toBe(0);
            });

            it('should limit value length for security', () => {
                const longValue = 'key:' + 'a'.repeat(200);
                const result = parseAdvancedSearch(longValue);
                // Should not include filter with value > 100 chars
                expect(Object.keys(result.filters).length).toBe(0);
            });

            it('should handle empty quoted string', () => {
                const result = parseAdvancedSearch('""');
                expect(result.text).toEqual([]);
            });

            it('should handle filter with no value', () => {
                const result = parseAdvancedSearch('tier:');
                // Should not parse as filter (invalid format)
                expect(result.filters).toEqual({});
            });

            it('should handle invalid filter syntax', () => {
                const result = parseAdvancedSearch(':value');
                // Should not parse as filter
                expect(result.filters).toEqual({});
            });

            it('should handle non-string input types', () => {
                const result = parseAdvancedSearch(123 as unknown as string);
                expect(result.text).toEqual([]);
                expect(result.filters).toEqual({});
            });
        });
    });

    // ========================================
    // matchesAdvancedFilters Tests
    // ========================================
    describe('matchesAdvancedFilters', () => {
        describe('exact matching', () => {
            it('should match exact string value', () => {
                const item = { tier: 'SS', name: 'Fire Sword' };
                const filters = { tier: 'SS' };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should be case insensitive', () => {
                const item = { tier: 'SS', name: 'Fire Sword' };
                const filters = { tier: 'ss' };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should not match different value', () => {
                const item = { tier: 'A', name: 'Fire Sword' };
                const filters = { tier: 'SS' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should match multiple filters', () => {
                const item = { tier: 'SS', rarity: 'legendary', name: 'Fire Sword' };
                const filters = { tier: 'SS', rarity: 'legendary' };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should fail if any filter does not match', () => {
                const item = { tier: 'SS', rarity: 'rare', name: 'Fire Sword' };
                const filters = { tier: 'SS', rarity: 'legendary' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });
        });

        describe('comparison operators', () => {
            describe('greater than (>)', () => {
                it('should match when value is greater', () => {
                    const item = { damage: 150, name: 'Fire Sword' };
                    const filters = { damage: '>100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should not match when value is equal', () => {
                    const item = { damage: 100, name: 'Fire Sword' };
                    const filters = { damage: '>100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });

                it('should not match when value is less', () => {
                    const item = { damage: 50, name: 'Fire Sword' };
                    const filters = { damage: '>100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });
            });

            describe('greater than or equal (>=)', () => {
                it('should match when value is greater', () => {
                    const item = { damage: 150, name: 'Fire Sword' };
                    const filters = { damage: '>=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should match when value is equal', () => {
                    const item = { damage: 100, name: 'Fire Sword' };
                    const filters = { damage: '>=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should not match when value is less', () => {
                    const item = { damage: 50, name: 'Fire Sword' };
                    const filters = { damage: '>=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });
            });

            describe('less than (<)', () => {
                it('should match when value is less', () => {
                    const item = { damage: 50, name: 'Fire Sword' };
                    const filters = { damage: '<100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should not match when value is equal', () => {
                    const item = { damage: 100, name: 'Fire Sword' };
                    const filters = { damage: '<100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });

                it('should not match when value is greater', () => {
                    const item = { damage: 150, name: 'Fire Sword' };
                    const filters = { damage: '<100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });
            });

            describe('less than or equal (<=)', () => {
                it('should match when value is less', () => {
                    const item = { damage: 50, name: 'Fire Sword' };
                    const filters = { damage: '<=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should match when value is equal', () => {
                    const item = { damage: 100, name: 'Fire Sword' };
                    const filters = { damage: '<=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should not match when value is greater', () => {
                    const item = { damage: 150, name: 'Fire Sword' };
                    const filters = { damage: '<=100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });
            });

            describe('not equal (!)', () => {
                it('should match when value is different', () => {
                    const item = { rarity: 'rare', name: 'Fire Sword' };
                    const filters = { rarity: '!common' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });

                it('should not match when value is same', () => {
                    const item = { rarity: 'common', name: 'Fire Sword' };
                    const filters = { rarity: '!common' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });

                it('should be case insensitive', () => {
                    const item = { rarity: 'COMMON', name: 'Fire Sword' };
                    const filters = { rarity: '!common' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(false);
                });
            });

            describe('decimal values', () => {
                it('should handle decimal comparisons', () => {
                    const item = { multiplier: 1.75, name: 'Fire Sword' };
                    const filters = { multiplier: '>1.5' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });
            });

            describe('string numeric values', () => {
                it('should convert string values to numbers for comparison', () => {
                    const item = { damage: '150', name: 'Fire Sword' };
                    const filters = { damage: '>100' };
                    expect(matchesAdvancedFilters(item, filters)).toBe(true);
                });
            });
        });

        describe('edge cases', () => {
            it('should return false for missing item property', () => {
                const item = { name: 'Fire Sword' };
                const filters = { tier: 'SS' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should return false for null item property', () => {
                const item = { tier: null, name: 'Fire Sword' };
                const filters = { tier: 'SS' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should return false for undefined item property', () => {
                const item = { tier: undefined, name: 'Fire Sword' };
                const filters = { tier: 'SS' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should skip null filter values', () => {
                const item = { tier: 'SS', name: 'Fire Sword' };
                const filters = { tier: null as unknown as string };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should skip undefined filter values', () => {
                const item = { tier: 'SS', name: 'Fire Sword' };
                const filters = { tier: undefined as unknown as string };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should return true for empty filters', () => {
                const item = { tier: 'SS', name: 'Fire Sword' };
                const filters = {};
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should return false for invalid numeric comparison', () => {
                const item = { damage: 'not-a-number', name: 'Fire Sword' };
                const filters = { damage: '>100' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should return false for invalid threshold value', () => {
                const item = { damage: 150, name: 'Fire Sword' };
                const filters = { damage: '>invalid' };
                expect(matchesAdvancedFilters(item, filters)).toBe(false);
            });

            it('should handle boolean item values', () => {
                const item = { stacks_well: true, name: 'Fire Sword' };
                const filters = { stacks_well: 'true' };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });

            it('should handle numeric item values with exact match', () => {
                const item = { tier: 1, name: 'Fire Sword' };
                const filters = { tier: '1' };
                expect(matchesAdvancedFilters(item, filters)).toBe(true);
            });
        });
    });
});
