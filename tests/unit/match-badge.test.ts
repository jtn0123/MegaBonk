import { describe, it, expect } from 'vitest';
import { generateMatchBadge } from '../../src/modules/match-badge.ts';

describe('Match Badge Module', () => {
    describe('generateMatchBadge()', () => {
        describe('null/undefined handling', () => {
            it('should return empty string for null context', () => {
                const result = generateMatchBadge(null);
                expect(result).toBe('');
            });

            it('should return empty string for undefined context', () => {
                const result = generateMatchBadge(undefined);
                expect(result).toBe('');
            });

            it('should return empty string for none match type', () => {
                const result = generateMatchBadge({
                    matchType: 'none',
                    field: 'name',
                });
                expect(result).toBe('');
            });
        });

        describe('match type labels', () => {
            it('should display exact match label', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'name',
                });

                expect(result).toContain('✓ Exact');
                expect(result).toContain('match-exact');
            });

            it('should display starts_with match label', () => {
                const result = generateMatchBadge({
                    matchType: 'starts_with',
                    field: 'name',
                });

                expect(result).toContain('▶ Starts with');
                expect(result).toContain('match-starts_with');
            });

            it('should display contains match label', () => {
                const result = generateMatchBadge({
                    matchType: 'contains',
                    field: 'name',
                });

                expect(result).toContain('⊃ Contains');
                expect(result).toContain('match-contains');
            });

            it('should display fuzzy match label', () => {
                const result = generateMatchBadge({
                    matchType: 'fuzzy',
                    field: 'name',
                });

                expect(result).toContain('≈ Similar');
                expect(result).toContain('match-fuzzy');
            });
        });

        describe('field labels', () => {
            it('should display Name field label', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'name',
                });

                expect(result).toContain('in Name');
                expect(result).toContain('Matched in Name');
            });

            it('should display Description field label', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'description',
                });

                expect(result).toContain('in Description');
                expect(result).toContain('Matched in Description');
            });

            it('should display Effect field label', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'effect',
                });

                expect(result).toContain('in Effect');
                expect(result).toContain('Matched in Effect');
            });

            it('should display Tags field label', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'tags',
                });

                expect(result).toContain('in Tags');
                expect(result).toContain('Matched in Tags');
            });
        });

        describe('HTML structure', () => {
            it('should return span element', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'name',
                });

                expect(result).toContain('<span');
                expect(result).toContain('</span>');
            });

            it('should include match-badge class', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'name',
                });

                expect(result).toContain('class="match-badge');
            });

            it('should include match type class', () => {
                const result = generateMatchBadge({
                    matchType: 'fuzzy',
                    field: 'description',
                });

                expect(result).toContain('match-fuzzy');
            });

            it('should include title attribute with tooltip info', () => {
                const result = generateMatchBadge({
                    matchType: 'contains',
                    field: 'effect',
                });

                expect(result).toContain('title="Matched in Effect: ⊃ Contains"');
            });
        });

        describe('combined match types and fields', () => {
            it('should combine exact match with description field', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'description',
                });

                expect(result).toContain('✓ Exact');
                expect(result).toContain('in Description');
                expect(result).toContain('match-exact');
            });

            it('should combine fuzzy match with tags field', () => {
                const result = generateMatchBadge({
                    matchType: 'fuzzy',
                    field: 'tags',
                });

                expect(result).toContain('≈ Similar');
                expect(result).toContain('in Tags');
                expect(result).toContain('match-fuzzy');
            });

            it('should combine starts_with match with effect field', () => {
                const result = generateMatchBadge({
                    matchType: 'starts_with',
                    field: 'effect',
                });

                expect(result).toContain('▶ Starts with');
                expect(result).toContain('in Effect');
                expect(result).toContain('match-starts_with');
            });

            it('should combine contains match with name field', () => {
                const result = generateMatchBadge({
                    matchType: 'contains',
                    field: 'name',
                });

                expect(result).toContain('⊃ Contains');
                expect(result).toContain('in Name');
                expect(result).toContain('match-contains');
            });
        });

        describe('score property', () => {
            it('should handle context with score', () => {
                const result = generateMatchBadge({
                    matchType: 'fuzzy',
                    field: 'name',
                    score: 85,
                });

                // Score is not displayed in badge, but should not cause error
                expect(result).toContain('≈ Similar');
                expect(result).toContain('in Name');
            });

            it('should handle context without score', () => {
                const result = generateMatchBadge({
                    matchType: 'exact',
                    field: 'name',
                });

                expect(result).toContain('✓ Exact');
            });
        });

        describe('edge cases', () => {
            it('should handle all match types in sequence', () => {
                const matchTypes = ['exact', 'starts_with', 'contains', 'fuzzy'];

                matchTypes.forEach(matchType => {
                    const result = generateMatchBadge({
                        matchType,
                        field: 'name',
                    });

                    expect(result).not.toBe('');
                    expect(result).toContain(`match-${matchType}`);
                });
            });

            it('should handle all fields in sequence', () => {
                const fields = ['name', 'description', 'effect', 'tags'];

                fields.forEach(field => {
                    const result = generateMatchBadge({
                        matchType: 'exact',
                        field,
                    });

                    expect(result).not.toBe('');
                    expect(result).toContain('in ');
                });
            });
        });
    });
});
