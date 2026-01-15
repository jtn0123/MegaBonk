/**
 * Real Integration Tests for Match Badge Module
 * No mocking - tests actual match badge generation
 */

import { describe, it, expect } from 'vitest';
import { generateMatchBadge } from '../../src/modules/match-badge.ts';

// ========================================
// Type Definitions (matching module)
// ========================================

type MatchType = 'exact' | 'starts_with' | 'contains' | 'fuzzy' | 'none';
type SearchField = 'name' | 'description' | 'effect' | 'tags';

interface MatchContext {
    matchType: MatchType;
    field: SearchField;
    score?: number;
}

// ========================================
// generateMatchBadge Tests
// ========================================

describe('generateMatchBadge - Real Integration Tests', () => {
    // ========================================
    // Null/Undefined Input Tests
    // ========================================

    describe('null/undefined handling', () => {
        it('should return empty string for null', () => {
            const result = generateMatchBadge(null);
            expect(result).toBe('');
        });

        it('should return empty string for undefined', () => {
            const result = generateMatchBadge(undefined);
            expect(result).toBe('');
        });

        it('should return empty string for none match type', () => {
            const context: MatchContext = {
                matchType: 'none',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toBe('');
        });
    });

    // ========================================
    // Exact Match Tests
    // ========================================

    describe('exact match', () => {
        it('should generate badge for exact match in name', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('match-badge');
            expect(result).toContain('match-exact');
            expect(result).toContain('Exact');
            expect(result).toContain('Name');
        });

        it('should generate badge for exact match in description', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'description',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('match-exact');
            expect(result).toContain('Description');
        });

        it('should generate badge for exact match in effect', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'effect',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('Effect');
        });

        it('should generate badge for exact match in tags', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'tags',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('Tags');
        });
    });

    // ========================================
    // Starts With Match Tests
    // ========================================

    describe('starts_with match', () => {
        it('should generate badge for starts_with match', () => {
            const context: MatchContext = {
                matchType: 'starts_with',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('match-starts_with');
            expect(result).toContain('Starts with');
        });

        it('should include correct symbol', () => {
            const context: MatchContext = {
                matchType: 'starts_with',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('▶');
        });
    });

    // ========================================
    // Contains Match Tests
    // ========================================

    describe('contains match', () => {
        it('should generate badge for contains match', () => {
            const context: MatchContext = {
                matchType: 'contains',
                field: 'description',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('match-contains');
            expect(result).toContain('Contains');
        });

        it('should include correct symbol', () => {
            const context: MatchContext = {
                matchType: 'contains',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('⊃');
        });
    });

    // ========================================
    // Fuzzy Match Tests
    // ========================================

    describe('fuzzy match', () => {
        it('should generate badge for fuzzy match', () => {
            const context: MatchContext = {
                matchType: 'fuzzy',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('match-fuzzy');
            expect(result).toContain('Similar');
        });

        it('should include correct symbol', () => {
            const context: MatchContext = {
                matchType: 'fuzzy',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('≈');
        });

        it('should handle fuzzy match with score', () => {
            const context: MatchContext = {
                matchType: 'fuzzy',
                field: 'name',
                score: 0.85,
            };

            const result = generateMatchBadge(context);

            // Score is included in context but may not be displayed
            expect(result).toContain('match-fuzzy');
        });
    });

    // ========================================
    // HTML Structure Tests
    // ========================================

    describe('HTML structure', () => {
        it('should wrap in span element', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('<span');
            expect(result).toContain('</span>');
        });

        it('should have class attribute', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('class="match-badge');
        });

        it('should have title attribute for tooltip', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('title="');
            expect(result).toContain('Matched in');
        });

        it('should include field in title', () => {
            const context: MatchContext = {
                matchType: 'contains',
                field: 'description',
            };

            const result = generateMatchBadge(context);

            expect(result).toContain('Matched in Description');
        });
    });

    // ========================================
    // All Field Types Tests
    // ========================================

    describe('all field types', () => {
        const fields: SearchField[] = ['name', 'description', 'effect', 'tags'];
        const matchTypes: MatchType[] = ['exact', 'starts_with', 'contains', 'fuzzy'];

        fields.forEach(field => {
            matchTypes.forEach(matchType => {
                it(`should handle ${matchType} match in ${field}`, () => {
                    const context: MatchContext = {
                        matchType,
                        field,
                    };

                    const result = generateMatchBadge(context);

                    expect(result).toContain('match-badge');
                    expect(result).toContain(`match-${matchType}`);
                });
            });
        });
    });

    // ========================================
    // Label Mapping Tests
    // ========================================

    describe('label mapping', () => {
        it('should use checkmark symbol for exact', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('✓');
        });

        it('should use arrow symbol for starts_with', () => {
            const context: MatchContext = {
                matchType: 'starts_with',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('▶');
        });

        it('should use superset symbol for contains', () => {
            const context: MatchContext = {
                matchType: 'contains',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('⊃');
        });

        it('should use approximately equal symbol for fuzzy', () => {
            const context: MatchContext = {
                matchType: 'fuzzy',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('≈');
        });
    });

    // ========================================
    // Field Label Tests
    // ========================================

    describe('field labels', () => {
        it('should capitalize name field', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'name',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('Name');
        });

        it('should capitalize description field', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'description',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('Description');
        });

        it('should capitalize effect field', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'effect',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('Effect');
        });

        it('should capitalize tags field', () => {
            const context: MatchContext = {
                matchType: 'exact',
                field: 'tags',
            };

            const result = generateMatchBadge(context);
            expect(result).toContain('Tags');
        });
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Match Badge Edge Cases', () => {
    it('should handle unknown match type gracefully', () => {
        const context = {
            matchType: 'unknown' as MatchType,
            field: 'name' as SearchField,
        };

        const result = generateMatchBadge(context);

        // Should still generate a badge with fallback "Match"
        expect(result).toContain('match-badge');
    });

    it('should handle unknown field gracefully', () => {
        const context = {
            matchType: 'exact' as MatchType,
            field: 'unknown' as SearchField,
        };

        const result = generateMatchBadge(context);

        // Should use the field name as-is
        expect(result).toContain('unknown');
    });

    it('should produce consistent output for same input', () => {
        const context: MatchContext = {
            matchType: 'exact',
            field: 'name',
        };

        const result1 = generateMatchBadge(context);
        const result2 = generateMatchBadge(context);

        expect(result1).toBe(result2);
    });
});

// ========================================
// DOM Integration Tests
// ========================================

describe('Match Badge DOM Integration', () => {
    it('should produce valid HTML that can be inserted into DOM', () => {
        const context: MatchContext = {
            matchType: 'exact',
            field: 'name',
        };

        const html = generateMatchBadge(context);

        // Create a container and insert the HTML
        const container = document.createElement('div');
        container.innerHTML = html;

        // Should have a span child
        const span = container.querySelector('span');
        expect(span).not.toBeNull();
        expect(span?.classList.contains('match-badge')).toBe(true);
    });

    it('should have accessible title attribute', () => {
        const context: MatchContext = {
            matchType: 'fuzzy',
            field: 'description',
        };

        const html = generateMatchBadge(context);
        const container = document.createElement('div');
        container.innerHTML = html;

        const span = container.querySelector('span');
        expect(span?.getAttribute('title')).toContain('Matched in Description');
    });
});
