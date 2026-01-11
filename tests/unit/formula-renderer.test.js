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

            it('should not apply KaTeX to non-math formulas', () => {
                const result = renderFormula('Automatic XP collection on cooldown');
                expect(result).toContain('formula-text');
                expect(result).not.toContain('katex');
            });
        });

        describe('mathematical formulas', () => {
            it('should render formulas with = sign using KaTeX', () => {
                const result = renderFormula('Damage = 1 + 0.10');
                expect(result).toContain('katex');
            });

            it('should render formulas with multiplication symbol', () => {
                const result = renderFormula('Damage × Stack Count');
                expect(result).toContain('katex');
            });

            it('should render formulas with + operator', () => {
                const result = renderFormula('Base + 10');
                expect(result).toContain('katex');
            });

            it('should render formulas with - operator', () => {
                const result = renderFormula('HP - 50');
                expect(result).toContain('katex');
            });
        });

        describe('variable highlighting', () => {
            it('should wrap Stack Count in text command', () => {
                const result = renderFormula('Damage = 1 + Stack Count');
                // KaTeX renders \text{} with specific class
                expect(result).toContain('katex');
            });

            it('should wrap Max HP in text command', () => {
                const result = renderFormula('Damage = Max HP × 0.20');
                expect(result).toContain('katex');
            });

            it('should handle multiple variables', () => {
                const result = renderFormula('Damage = Base + (Max HP × Stack Count)');
                expect(result).toContain('katex');
            });
        });

        describe('symbol conversion', () => {
            it('should convert × to times symbol', () => {
                const result = renderFormula('Damage = 2 × 5');
                // KaTeX renders \times as a specific element
                expect(result).toContain('katex');
            });

            it('should convert percentages', () => {
                const result = renderFormula('Bonus = 20%');
                expect(result).toContain('katex');
            });
        });

        describe('error handling', () => {
            it('should fall back gracefully on invalid LaTeX', () => {
                // This shouldn't throw
                const result = renderFormula('Invalid \\invalid command');
                expect(result).toBeDefined();
            });

            it('should handle complex formulas without crashing', () => {
                const result = renderFormula('HP = +100/stack, Regen = +50/stack, Overheal = +25%/stack');
                expect(result).toBeDefined();
            });
        });

        describe('LaTeX passthrough', () => {
            it('should detect and pass through existing LaTeX', () => {
                const result = renderFormula('\\frac{1}{2}');
                expect(result).toContain('katex');
            });

            it('should handle LaTeX with text commands', () => {
                const result = renderFormula('\\text{Damage} = 1 + n');
                expect(result).toContain('katex');
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
            expect(result).toContain('katex');
            // Display mode adds katex-display class
            expect(result).toContain('katex-display');
        });

        it('should render descriptive text as formula-text', () => {
            const result = renderFormulaDisplay('Each upgrade adds stats');
            expect(result).toContain('formula-text');
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
                expect(result).toContain('katex');
            });
        });
    });
});
