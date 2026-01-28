import { describe, it, expect } from 'vitest';
import { renderFormula, renderFormulaDisplay } from '../../src/modules/formula-renderer.ts';

describe('Formula Renderer Module', () => {
    describe('renderFormula()', () => {
        describe('null/empty handling', () => {
            it('should return empty string for null', () => {
                const result = renderFormula(null);
                expect(result).toBe('');
            });

            it('should return empty string for undefined', () => {
                const result = renderFormula(undefined);
                expect(result).toBe('');
            });

            it('should return empty string for empty string', () => {
                const result = renderFormula('');
                expect(result).toBe('');
            });
        });

        describe('descriptive text formulas', () => {
            it('should render descriptive text without math operators as formula-text', () => {
                const result = renderFormula('Each weapon upgrade adds extra stats');
                expect(result).toContain('formula-text');
                expect(result).toContain('Each weapon upgrade adds extra stats');
            });

            it('should not apply math styling to non-math formulas', () => {
                const result = renderFormula('Automatic XP collection on cooldown');
                expect(result).toContain('formula-text');
                expect(result).not.toContain('formula-container');
            });
        });

        describe('mathematical formulas', () => {
            it('should render formulas with = sign using CSS styling', () => {
                const result = renderFormula('Damage = 1 + 0.10');
                expect(result).toContain('formula-container');
            });

            it('should render formulas with multiplication symbol', () => {
                const result = renderFormula('Damage × Stack Count');
                expect(result).toContain('formula-container');
                expect(result).toContain('formula-op');
            });

            it('should render formulas with + operator', () => {
                const result = renderFormula('Base + 10');
                expect(result).toContain('formula-container');
            });

            it('should render formulas with - operator', () => {
                const result = renderFormula('HP - 50');
                expect(result).toContain('formula-container');
            });
        });

        describe('variable highlighting', () => {
            it('should wrap Stack Count in formula-var class', () => {
                const result = renderFormula('Damage = 1 + Stack Count');
                expect(result).toContain('formula-var');
                expect(result).toContain('Stack Count');
            });

            it('should wrap Max HP in formula-var class', () => {
                const result = renderFormula('Damage = Max HP × 0.20');
                expect(result).toContain('formula-var');
                expect(result).toContain('Max HP');
            });

            it('should handle multiple variables', () => {
                const result = renderFormula('Damage = Base + (Max HP × Stack Count)');
                expect(result).toContain('formula-var');
                // Should contain both variables highlighted
                expect(result.match(/formula-var/g)?.length).toBeGreaterThanOrEqual(2);
            });
        });

        describe('symbol conversion', () => {
            it('should style × with formula-op class', () => {
                const result = renderFormula('Damage = 2 × 5');
                expect(result).toContain('formula-op');
                expect(result).toContain('×');
            });

            it('should style = with formula-eq class', () => {
                const result = renderFormula('Bonus = 20');
                expect(result).toContain('formula-eq');
            });
        });

        describe('error handling', () => {
            it('should handle invalid input gracefully', () => {
                // This shouldn't throw
                const result = renderFormula('Invalid \\invalid command');
                expect(result).toBeDefined();
            });

            it('should handle complex formulas without crashing', () => {
                const result = renderFormula('HP = +100/stack, Regen = +50/stack, Overheal = +25%/stack');
                expect(result).toBeDefined();
            });

            it('should return formula-text for formulas without math operators', () => {
                const result = renderFormula('Just some text without operators');
                expect(result).toContain('formula-text');
            });
        });

        describe('fraction rendering', () => {
            it('should render simple numeric fractions', () => {
                const result = renderFormula('Value = 1/2');
                expect(result).toContain('formula-fraction');
            });

            it('should render fractions with parenthesized denominators', () => {
                const result = renderFormula('HP / (1 + Internal)');
                expect(result).toContain('formula-fraction');
            });
        });
    });

    describe('renderFormulaDisplay()', () => {
        it('should return empty string for null', () => {
            const result = renderFormulaDisplay(null);
            expect(result).toBe('');
        });

        it('should render math formulas in display mode', () => {
            const result = renderFormulaDisplay('Damage = 1 + 0.10');
            expect(result).toContain('formula-display');
            expect(result).toContain('formula-container');
        });

        it('should render descriptive text as formula-text', () => {
            const result = renderFormulaDisplay('Each upgrade adds stats');
            expect(result).toContain('formula-text');
        });

        it('should wrap content in formula-display div', () => {
            const result = renderFormulaDisplay('Damage = 1 + 2');
            expect(result).toMatch(/^<div class="formula-display">/);
            expect(result).toMatch(/<\/div>$/);
        });
    });

    describe('real formula examples', () => {
        const realFormulas = [
            'Damage Multiplier = 1 + ((Max HP / 100) × 0.20 × Stack Count)',
            'Total Proc Chance = 0.02 × Stack Count (capped at 100%)',
            'Explosion Chance = 0.25 × Stack Count (capped at 100%)',
            'Crit Chance = Base + (0.10 × Stack Count). Over 100% enables Overcrits!',
            'Max HP = Base HP + (25 × Stack Count)',
            'Attack Speed Bonus = min(Movement Speed × Stack Count, 40% × Stack Count)',
            'Damage = 1 + (Kills × 0.001 × Stack Count), max 1000 kills per copy',
        ];

        realFormulas.forEach(formula => {
            it(`should render: "${formula.substring(0, 40)}..."`, () => {
                const result = renderFormula(formula);
                expect(result).toBeDefined();
                expect(result).toContain('formula-container');
            });
        });
    });

    describe('XSS prevention', () => {
        it('should escape HTML in formula input', () => {
            const result = renderFormula('<script>alert("xss")</script> = 1 + 2');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should escape HTML in descriptive text', () => {
            const result = renderFormula('<img onerror="alert(1)" src=x>');
            expect(result).not.toContain('<img');
            expect(result).toContain('&lt;img');
        });
    });
});
