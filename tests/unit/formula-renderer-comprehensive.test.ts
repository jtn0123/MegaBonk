/**
 * Comprehensive tests for formula-renderer.ts - Formula Rendering Module
 * Tests KaTeX-based mathematical formula rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderFormula, renderFormulaDisplay } from '../../src/modules/formula-renderer.ts';

// Mock katex
vi.mock('katex', () => ({
    default: {
        renderToString: vi.fn((latex: string, options: any) => {
            // Simple mock that returns a span with the latex
            const mode = options.displayMode ? 'display' : 'inline';
            return `<span class="katex katex-${mode}">${latex}</span>`;
        }),
    },
}));

// Mock katex CSS import
vi.mock('katex/dist/katex.min.css', () => ({}));

describe('Formula Renderer Module', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.clearAllMocks();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    describe('renderFormula', () => {
        describe('Empty and Null Cases', () => {
            it('should return empty string for empty formula', () => {
                expect(renderFormula('')).toBe('');
            });

            it('should return empty string for null formula', () => {
                expect(renderFormula(null as any)).toBe('');
            });

            it('should return empty string for undefined formula', () => {
                expect(renderFormula(undefined as any)).toBe('');
            });
        });

        describe('Plain Text (Non-Math) Formulas', () => {
            it('should render plain text without math operators as styled text', () => {
                const result = renderFormula('Increases damage');

                expect(result).toContain('formula-text');
                expect(result).toContain('Increases damage');
                expect(result).not.toContain('katex');
            });

            it('should render descriptive text as styled text', () => {
                const result = renderFormula('Grants immunity to fire');

                expect(result).toContain('formula-text');
                expect(result).not.toContain('katex');
            });

            it('should identify text with no operators as non-math', () => {
                const result = renderFormula('Passive ability');

                expect(result).toContain('formula-text');
            });
        });

        describe('Math Formulas with Operators', () => {
            it('should render formula with equals sign', () => {
                const result = renderFormula('Damage = 10 + 5');

                expect(result).toContain('katex');
                expect(result).toContain('inline');
            });

            it('should render formula with multiplication', () => {
                const result = renderFormula('10 × 5');

                expect(result).toContain('katex');
                expect(result).toContain('\\times');
            });

            it('should render formula with division', () => {
                const result = renderFormula('100 ÷ 5');

                expect(result).toContain('katex');
                expect(result).toContain('\\div');
            });

            it('should render formula with addition', () => {
                const result = renderFormula('10 + 20');

                expect(result).toContain('katex');
            });

            it('should render formula with subtraction', () => {
                const result = renderFormula('50 - 10');

                expect(result).toContain('katex');
            });

            it('should render formula with asterisk multiplication', () => {
                const result = renderFormula('5 * 3');

                expect(result).toContain('katex');
            });

            it('should render formula with slash division', () => {
                const result = renderFormula('100 / 5');

                expect(result).toContain('katex');
                expect(result).toContain('\\frac{100}{5}');
            });
        });

        describe('LaTeX Formulas', () => {
            it('should detect LaTeX with backslash commands', () => {
                const result = renderFormula('\\frac{1}{2}');

                expect(result).toContain('katex');
                expect(result).toContain('\\frac{1}{2}');
            });

            it('should detect LaTeX with curly braces', () => {
                const result = renderFormula('x^{2}');

                expect(result).toContain('katex');
            });

            it('should detect LaTeX with subscripts', () => {
                const result = renderFormula('x_{n}');

                expect(result).toContain('katex');
            });

            it('should render complex LaTeX formula', () => {
                const result = renderFormula('\\sqrt{x^2 + y^2}');

                expect(result).toContain('katex');
            });

            it('should pass through LaTeX commands unchanged', () => {
                const result = renderFormula('\\sum_{i=1}^{n} i');

                expect(result).toContain('katex');
                expect(result).toContain('\\sum_{i=1}^{n} i');
            });
        });

        describe('Variable Conversion', () => {
            it('should convert Stack Count to LaTeX text', () => {
                const result = renderFormula('10 + Stack Count');

                expect(result).toContain('katex');
                expect(result).toContain('\\text{Stack Count}');
            });

            it('should convert Max HP to LaTeX text', () => {
                const result = renderFormula('Max HP × 0.1');

                expect(result).toContain('\\text{Max HP}');
            });

            it('should convert Base Damage to LaTeX text', () => {
                const result = renderFormula('Damage + 50');

                expect(result).toContain('\\text{Damage}');
            });

            it('should convert multiple variables', () => {
                const result = renderFormula('Max HP + Base HP');

                expect(result).toContain('\\text{Max HP}');
                expect(result).toContain('\\text{Base HP}');
            });

            it('should handle standalone n as variable', () => {
                const result = renderFormula('10 + n');

                expect(result).toContain('katex');
            });

            it('should not convert n within words', () => {
                const result = renderFormula('count + 5');

                expect(result).toContain('katex');
            });

            it('should convert all supported variables', () => {
                const variables = [
                    'Stack Count',
                    'Stacks',
                    'Max HP',
                    'Base HP',
                    'Kills',
                    'Movement Speed',
                    'Damage',
                    'Crit Chance',
                    'Attack Speed',
                ];

                variables.forEach(variable => {
                    const result = renderFormula(`${variable} + 10`);
                    expect(result).toContain('\\text{' + variable + '}');
                });
            });
        });

        describe('Fraction Conversion', () => {
            it('should convert simple fraction to LaTeX', () => {
                const result = renderFormula('100 / 5');

                expect(result).toContain('\\frac{100}{5}');
            });

            it('should convert fraction with spaces', () => {
                const result = renderFormula('50 / 10');

                expect(result).toContain('\\frac{50}{10}');
            });

            it('should handle multiple fractions', () => {
                const result = renderFormula('100 / 5 + 50 / 2');

                expect(result).toContain('\\frac{100}{5}');
                expect(result).toContain('\\frac{50}{2}');
            });
        });

        describe('Percentage Handling', () => {
            it('should escape percentage sign', () => {
                const result = renderFormula('50% + 10');

                expect(result).toContain('katex');
                expect(result).toContain('50\\%');
            });

            it('should handle multiple percentages', () => {
                const result = renderFormula('25% + 15%');

                expect(result).toContain('25\\%');
                expect(result).toContain('15\\%');
            });

            it('should handle percentage in complex formula', () => {
                const result = renderFormula('Damage × 50% + 10');

                expect(result).toContain('50\\%');
            });
        });

        describe('Min/Max Functions', () => {
            it('should convert min function to LaTeX', () => {
                const result = renderFormula('min(10, 20)');

                expect(result).toContain('\\min(');
            });

            it('should convert max function to LaTeX', () => {
                const result = renderFormula('max(10, 20)');

                expect(result).toContain('\\max(');
            });

            it('should handle nested min/max', () => {
                const result = renderFormula('min(max(5, 10), 15)');

                expect(result).toContain('\\min(');
                expect(result).toContain('\\max(');
            });
        });

        describe('Complex Formulas', () => {
            it('should handle formula with multiple operators', () => {
                const result = renderFormula('10 + 20 × 5 - 3');

                expect(result).toContain('katex');
                expect(result).toContain('\\times');
            });

            it('should handle formula with variables and operators', () => {
                const result = renderFormula('Max HP × 0.1 + Base HP');

                expect(result).toContain('\\text{Max HP}');
                expect(result).toContain('\\text{Base HP}');
            });

            it('should handle formula with all features', () => {
                const result = renderFormula('min(Max HP × 50%, 100) + Stack Count / 5');

                expect(result).toContain('\\min(');
                expect(result).toContain('\\text{Max HP}');
                expect(result).toContain('50\\%');
                expect(result).toContain('\\text{Stack Count}');
                expect(result).toContain('\\frac');
            });
        });

        describe('Error Handling', () => {
            it('should fallback to plain text on rendering error', () => {
                const katex = await import('katex');
                vi.mocked(katex.default.renderToString).mockImplementationOnce(() => {
                    throw new Error('Rendering failed');
                });

                const result = renderFormula('10 + 5');

                expect(result).toContain('formula-text');
                expect(result).toContain('10 + 5');
                expect(consoleWarnSpy).toHaveBeenCalled();
            });

            it('should log warning on error', () => {
                const katex = await import('katex');
                vi.mocked(katex.default.renderToString).mockImplementationOnce(() => {
                    throw new Error('Test error');
                });

                renderFormula('test');

                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('KaTeX rendering failed'),
                    'test',
                    expect.any(Error)
                );
            });

            it('should handle very long formulas', () => {
                const longFormula = 'x + ' + Array(100).fill('y').join(' + ');
                const result = renderFormula(longFormula);

                expect(result).toContain('katex');
            });

            it('should handle special characters in text', () => {
                const result = renderFormula('Damage <script>alert(1)</script>');

                expect(result).toBeDefined();
            });
        });

        describe('Edge Cases', () => {
            it('should handle formula with only equals sign', () => {
                const result = renderFormula('=');

                expect(result).toContain('katex');
            });

            it('should handle formula with only operator', () => {
                const result = renderFormula('+');

                expect(result).toContain('katex');
            });

            it('should handle whitespace-only formula', () => {
                const result = renderFormula('   ');

                expect(result).toBe('');
            });

            it('should handle formula with newlines', () => {
                const result = renderFormula('10 +\n20');

                expect(result).toContain('katex');
            });

            it('should handle unicode math symbols', () => {
                const result = renderFormula('10 × 5 ÷ 2');

                expect(result).toContain('\\times');
                expect(result).toContain('\\div');
            });
        });
    });

    describe('renderFormulaDisplay', () => {
        describe('Display Mode Rendering', () => {
            it('should render in display mode', () => {
                const result = renderFormulaDisplay('10 + 5');

                expect(result).toContain('katex');
                expect(result).toContain('display');
            });

            it('should return empty for empty formula', () => {
                expect(renderFormulaDisplay('')).toBe('');
            });

            it('should return empty for null formula', () => {
                expect(renderFormulaDisplay(null as any)).toBe('');
            });

            it('should render plain text as styled text', () => {
                const result = renderFormulaDisplay('No math here');

                expect(result).toContain('formula-text');
                expect(result).not.toContain('katex');
            });

            it('should render math formula in display mode', () => {
                const result = renderFormulaDisplay('x^2 + y^2 = z^2');

                expect(result).toContain('katex');
                expect(result).toContain('display');
            });

            it('should handle LaTeX formulas in display mode', () => {
                const result = renderFormulaDisplay('\\frac{a}{b}');

                expect(result).toContain('katex');
                expect(result).toContain('display');
            });

            it('should convert variables in display mode', () => {
                const result = renderFormulaDisplay('Max HP × 100');

                expect(result).toContain('\\text{Max HP}');
                expect(result).toContain('display');
            });

            it('should handle errors in display mode', () => {
                const katex = await import('katex');
                vi.mocked(katex.default.renderToString).mockImplementationOnce(() => {
                    throw new Error('Display error');
                });

                const result = renderFormulaDisplay('10 + 5');

                expect(result).toContain('formula-text');
                expect(consoleWarnSpy).toHaveBeenCalled();
            });
        });

        describe('Display Mode vs Inline Mode', () => {
            it('should use displayMode: true', () => {
                const katex = await import('katex');

                renderFormulaDisplay('x = 10');

                expect(katex.default.renderToString).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ displayMode: true })
                );
            });

            it('should use displayMode: false for renderFormula', () => {
                const katex = await import('katex');

                renderFormula('x = 10');

                expect(katex.default.renderToString).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ displayMode: false })
                );
            });

            it('should have same conversion logic as inline', () => {
                const inlineResult = renderFormula('Stack Count + 10');
                const displayResult = renderFormulaDisplay('Stack Count + 10');

                // Both should convert Stack Count
                expect(inlineResult).toContain('\\text{Stack Count}');
                expect(displayResult).toContain('\\text{Stack Count}');
            });

            it('should handle percentages same as inline', () => {
                const displayResult = renderFormulaDisplay('50% + 25%');

                expect(displayResult).toContain('50\\%');
                expect(displayResult).toContain('25\\%');
            });

            it('should handle fractions same as inline', () => {
                const displayResult = renderFormulaDisplay('100 / 5');

                expect(displayResult).toContain('\\frac{100}{5}');
            });
        });

        describe('Display Mode Error Handling', () => {
            it('should fallback on error', () => {
                const katex = await import('katex');
                vi.mocked(katex.default.renderToString).mockImplementationOnce(() => {
                    throw new Error('Render error');
                });

                const result = renderFormulaDisplay('error test');

                expect(result).toContain('formula-text');
            });

            it('should log warning on display mode error', () => {
                const katex = await import('katex');
                vi.mocked(katex.default.renderToString).mockImplementationOnce(() => {
                    throw new Error('Display error');
                });

                renderFormulaDisplay('test');

                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('KaTeX rendering failed'),
                    'test',
                    expect.any(Error)
                );
            });
        });
    });

    describe('KaTeX Options', () => {
        it('should use correct KaTeX options for inline mode', () => {
            const katex = await import('katex');

            renderFormula('x = 5');

            expect(katex.default.renderToString).toHaveBeenCalledWith(expect.any(String), {
                throwOnError: false,
                displayMode: false,
                output: 'html',
                trust: false,
                strict: false,
            });
        });

        it('should use correct KaTeX options for display mode', () => {
            const katex = await import('katex');

            renderFormulaDisplay('x = 5');

            expect(katex.default.renderToString).toHaveBeenCalledWith(expect.any(String), {
                throwOnError: false,
                displayMode: true,
                output: 'html',
                trust: false,
                strict: false,
            });
        });

        it('should not throw on error (throwOnError: false)', () => {
            expect(() => {
                renderFormula('\\invalid{command}');
            }).not.toThrow();
        });

        it('should output HTML format', () => {
            const katex = await import('katex');

            renderFormula('x = 5');

            const call = vi.mocked(katex.default.renderToString).mock.calls[0];
            expect(call[1].output).toBe('html');
        });

        it('should not trust user input (trust: false)', () => {
            const katex = await import('katex');

            renderFormula('x = 5');

            const call = vi.mocked(katex.default.renderToString).mock.calls[0];
            expect(call[1].trust).toBe(false);
        });

        it('should use non-strict mode (strict: false)', () => {
            const katex = await import('katex');

            renderFormula('x = 5');

            const call = vi.mocked(katex.default.renderToString).mock.calls[0];
            expect(call[1].strict).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        it('should handle game-like formulas', () => {
            const formulas = [
                '10 + Stack Count × 2',
                'Max HP × 0.15 + 50',
                'min(Damage × 200%, 500)',
                'Base HP / 5 + Regen',
                'Crit Chance + 25%',
            ];

            formulas.forEach(formula => {
                const result = renderFormula(formula);
                expect(result).toContain('katex');
            });
        });

        it('should process realistic item formulas', () => {
            const itemFormulas = [
                '+10% Damage per Stack',
                'Damage = 100 + Stack Count × 50',
                'Heals for Max HP × 5%',
                'Explosion Chance = min(Stacks / 10, 100%)',
            ];

            itemFormulas.forEach(formula => {
                const result = renderFormula(formula);
                expect(result).toBeDefined();
            });
        });

        it('should handle both inline and display rendering consistently', () => {
            const formula = 'Stack Count × 10 + 50%';

            const inline = renderFormula(formula);
            const display = renderFormulaDisplay(formula);

            expect(inline).toContain('\\text{Stack Count}');
            expect(display).toContain('\\text{Stack Count}');
            expect(inline).toContain('50\\%');
            expect(display).toContain('50\\%');
        });

        it('should handle sequential formula rendering', () => {
            const formulas = ['x = 5', 'y = 10', 'z = x + y'];

            formulas.forEach(formula => {
                const result = renderFormula(formula);
                expect(result).toContain('katex');
            });
        });
    });
});
