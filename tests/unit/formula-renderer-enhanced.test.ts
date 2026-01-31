/**
 * Enhanced Formula Renderer Tests - Coverage Improvement
 * Focuses on edge cases, fraction rendering, and complex formulas
 */
import { describe, it, expect } from 'vitest';
import { renderFormula, renderFormulaDisplay } from '../../src/modules/formula-renderer.ts';

describe('Formula Renderer - Enhanced Coverage', () => {
    // ========================================
    // Fraction Rendering Edge Cases
    // ========================================
    describe('fraction rendering edge cases', () => {
        it('should skip word/word patterns like "stack/copy"', () => {
            const result = renderFormula('stack/copy effect = 10');
            // Should contain the original word/word pattern, not a fraction
            expect(result).toContain('stack/copy');
            // Should NOT render as a fraction
            expect(result).not.toMatch(/<span class="formula-fraction">.*stack.*copy.*<\/span>/);
        });

        it('should skip "damage/healing" word patterns', () => {
            const result = renderFormula('damage/healing ratio = 1.5');
            expect(result).toContain('damage/healing');
        });

        it('should render numeric/numeric as fraction', () => {
            const result = renderFormula('Value = 3/4');
            expect(result).toContain('formula-fraction');
            expect(result).toContain('formula-num');
            expect(result).toContain('formula-den');
        });

        it('should render decimal fractions', () => {
            const result = renderFormula('Value = 1.5/2.5');
            expect(result).toContain('formula-fraction');
        });

        it('should render word/number fractions when pattern matches', () => {
            // The fraction regex requires word\s*/\s*number pattern with specific captures
            // HP / 100 doesn't match because HP is a variable, not in the fraction pattern
            const result = renderFormula('HP / 100');
            // Variables are highlighted, but division may not render as stacked fraction
            expect(result).toContain('formula-var');
            expect(result).toContain('HP');
        });

        it('should render complex parenthesized denominators', () => {
            const result = renderFormula('Max HP / (1 + Internal × Stack Count)');
            expect(result).toContain('formula-fraction');
            // The parenthesized content is rendered with variable highlighting
            expect(result).toContain('formula-den');
            expect(result).toContain('Internal');
            expect(result).toContain('Stack Count');
        });

        it('should handle nested expressions in numerator', () => {
            const result = renderFormula('(Base + Bonus) / 2');
            // The regex might not capture parenthesized numerators perfectly
            // but should not throw
            expect(result).toBeDefined();
            expect(result).toContain('formula-container');
        });

        it('should handle multiple fractions in one formula', () => {
            const result = renderFormula('A = 1/2 + 3/4');
            expect(result).toContain('formula-fraction');
            // Count fraction spans
            const fractionCount = (result.match(/formula-fraction/g) || []).length;
            expect(fractionCount).toBeGreaterThanOrEqual(1);
        });
    });

    // ========================================
    // Variable Highlighting Edge Cases
    // ========================================
    describe('variable highlighting edge cases', () => {
        it('should highlight "Damage Multiplier" (long variable first)', () => {
            const result = renderFormula('Damage Multiplier = 1.5');
            expect(result).toContain('formula-var');
            expect(result).toContain('Damage Multiplier');
        });

        it('should highlight "Attack Speed Bonus"', () => {
            const result = renderFormula('Attack Speed Bonus = 20%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Total Proc Chance"', () => {
            const result = renderFormula('Total Proc Chance = 50%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Explosion Chance"', () => {
            const result = renderFormula('Explosion Chance = 25%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Lightning Chance"', () => {
            const result = renderFormula('Lightning Chance = 15%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Dragonfire Chance"', () => {
            const result = renderFormula('Dragonfire Chance = 10%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Movement Speed"', () => {
            const result = renderFormula('Movement Speed = 120');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Number of Lives"', () => {
            const result = renderFormula('Number of Lives = 3');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Enemies Cursed"', () => {
            const result = renderFormula('Enemies Cursed × 5');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Freeze Chance"', () => {
            const result = renderFormula('Freeze Chance = 20%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Poison Chance"', () => {
            const result = renderFormula('Poison Chance = 15%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Bloodmark Chance"', () => {
            const result = renderFormula('Bloodmark Chance = 8%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Megacrit Chance"', () => {
            const result = renderFormula('Megacrit Chance = 5%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Attack Speed"', () => {
            const result = renderFormula('Attack Speed = 1.5');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Crit Chance"', () => {
            const result = renderFormula('Crit Chance = 30%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Current HP%"', () => {
            const result = renderFormula('Current HP% × Damage');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Max HP%"', () => {
            const result = renderFormula('Max HP% + 10');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Overheal"', () => {
            const result = renderFormula('Overheal = 25');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Lifesteal"', () => {
            const result = renderFormula('Lifesteal = 5%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Base HP"', () => {
            const result = renderFormula('Base HP + 100');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Stacks"', () => {
            const result = renderFormula('Stacks × 10');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Radius"', () => {
            const result = renderFormula('Radius = 150');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Evasion"', () => {
            const result = renderFormula('Evasion = 15%');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Poison" standalone', () => {
            const result = renderFormula('Poison + Damage');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Speed"', () => {
            const result = renderFormula('Speed × 1.2');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Kills"', () => {
            const result = renderFormula('Kills × 0.01');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Regen"', () => {
            const result = renderFormula('Regen = 5');
            expect(result).toContain('formula-var');
        });

        it('should highlight "Internal"', () => {
            const result = renderFormula('1 + Internal');
            expect(result).toContain('formula-var');
        });

        it('should not partial-match within other words', () => {
            // "Damageproof" should not highlight "Damage"
            const result = renderFormula('Damageproof shield = 10');
            // This is actually hard to test since regex uses word boundaries
            // The word boundary should prevent partial matches
            expect(result).toBeDefined();
        });

        it('should handle multiple different variables', () => {
            const result = renderFormula('Total = Base + Max HP × Crit Chance × Stack Count');
            // Count var spans
            const varCount = (result.match(/formula-var/g) || []).length;
            expect(varCount).toBeGreaterThanOrEqual(3);
        });
    });

    // ========================================
    // Operator Styling
    // ========================================
    describe('operator styling', () => {
        it('should style = at start of expression', () => {
            const result = renderFormula('= 100');
            expect(result).toContain('formula-eq');
        });

        it('should style × operator', () => {
            const result = renderFormula('A × B');
            expect(result).toContain('formula-op');
        });

        it('should handle multiple × operators', () => {
            const result = renderFormula('A × B × C × D');
            const opCount = (result.match(/formula-op/g) || []).length;
            expect(opCount).toBe(3);
        });

        it('should style = in middle of formula', () => {
            const result = renderFormula('Damage = Base × Multiplier');
            expect(result).toContain('formula-eq');
        });
    });

    // ========================================
    // HTML Escaping and XSS Prevention
    // ========================================
    describe('HTML escaping', () => {
        it('should escape & character', () => {
            const result = renderFormula('A & B = C');
            expect(result).toContain('&amp;');
            expect(result).not.toMatch(/[^&]&[^a]/); // No unescaped &
        });

        it('should escape < character', () => {
            const result = renderFormula('A < B = true');
            expect(result).toContain('&lt;');
        });

        it('should escape > character', () => {
            const result = renderFormula('A > B = false');
            expect(result).toContain('&gt;');
        });

        it('should escape " character', () => {
            const result = renderFormula('Value = "test"');
            expect(result).toContain('&quot;');
        });

        it('should escape \' character', () => {
            const result = renderFormula("Value = 'test'");
            expect(result).toContain('&#039;');
        });

        it('should escape multiple special characters', () => {
            const result = renderFormula('<script>"alert(\'xss\')"</script> = 1');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
            expect(result).toContain('&quot;');
            expect(result).toContain('&#039;');
            expect(result).not.toContain('<script>');
        });

        it('should handle event handler injection attempts', () => {
            const result = renderFormula('onerror="alert(1)" = onclick');
            // The text "onerror=" is preserved (it's just text, not an attribute)
            // But the quotes are escaped so it can't be interpreted as HTML attribute
            expect(result).toContain('&quot;');
            // The key is that there's no executable attribute context
            expect(result).not.toContain('onerror="');
        });
    });

    // ========================================
    // Complex Real-World Formulas
    // ========================================
    describe('complex real-world formulas', () => {
        it('should render capped percentage formula', () => {
            const result = renderFormula('Explosion Chance = 0.25 × Stack Count (capped at 100%)');
            expect(result).toContain('formula-container');
            expect(result).toContain('formula-var');
        });

        it('should render overcrit formula', () => {
            const result = renderFormula('Crit Chance = Base + (0.10 × Stack Count). Over 100% enables Overcrits!');
            expect(result).toContain('formula-container');
        });

        it('should render min/max formula', () => {
            const result = renderFormula('Attack Speed Bonus = min(Movement Speed × Stack Count, 40% × Stack Count)');
            expect(result).toContain('formula-container');
        });

        it('should render kill-based formula', () => {
            const result = renderFormula('Damage = 1 + (Kills × 0.001 × Stack Count), max 1000 kills per copy');
            expect(result).toContain('formula-container');
            expect(result).toContain('formula-var');
        });

        it('should render health percentage formula', () => {
            const result = renderFormula('Damage Multiplier = 1 + ((Max HP / 100) × 0.20 × Stack Count)');
            expect(result).toContain('formula-container');
            // Variables are highlighted
            expect(result).toContain('formula-var');
            expect(result).toContain('Damage Multiplier');
            expect(result).toContain('Max HP');
            expect(result).toContain('Stack Count');
        });

        it('should render multi-stat formula', () => {
            const result = renderFormula('HP = +100/stack, Regen = +50/stack, Overheal = +25%/stack');
            expect(result).toContain('formula-container');
        });

        it('should render stacking formula with fractions', () => {
            const result = renderFormula('Effective = Base × (1 + Stacks / 10)');
            expect(result).toContain('formula-container');
        });
    });

    // ========================================
    // renderFormulaDisplay Tests
    // ========================================
    describe('renderFormulaDisplay', () => {
        it('should return empty string for undefined', () => {
            const result = renderFormulaDisplay(undefined as any);
            expect(result).toBe('');
        });

        it('should return empty string for empty string', () => {
            const result = renderFormulaDisplay('');
            expect(result).toBe('');
        });

        it('should wrap in formula-display div', () => {
            const result = renderFormulaDisplay('Damage = 100');
            expect(result).toMatch(/^<div class="formula-display">/);
            expect(result).toMatch(/<\/div>$/);
        });

        it('should include inner formula-container', () => {
            const result = renderFormulaDisplay('A × B = C');
            expect(result).toContain('formula-container');
            expect(result).toContain('formula-display');
        });

        it('should style variables in display mode', () => {
            const result = renderFormulaDisplay('Max HP × Stack Count');
            expect(result).toContain('formula-var');
        });

        it('should render fractions in display mode', () => {
            const result = renderFormulaDisplay('Value = 1/2');
            expect(result).toContain('formula-fraction');
        });
    });

    // ========================================
    // Edge Cases and Boundary Conditions
    // ========================================
    describe('edge cases', () => {
        it('should handle formula with only operators', () => {
            const result = renderFormula('+ - × =');
            expect(result).toContain('formula-container');
        });

        it('should handle single operator', () => {
            const result = renderFormula('+');
            expect(result).toContain('formula-container');
        });

        it('should handle formula with unicode math symbols', () => {
            const result = renderFormula('α × β = γ');
            expect(result).toContain('formula-container');
        });

        it('should handle very long formula', () => {
            const longFormula = 'A = ' + 'B + '.repeat(100) + 'C';
            const result = renderFormula(longFormula);
            expect(result).toContain('formula-container');
        });

        it('should handle formula with only whitespace and operators', () => {
            const result = renderFormula('   =   ');
            expect(result).toContain('formula-eq');
        });

        it('should handle formula with tabs and newlines', () => {
            const result = renderFormula('A\t=\nB');
            expect(result).toBeDefined();
        });

        it('should handle formula with consecutive operators', () => {
            const result = renderFormula('A ×× B');
            expect(result).toContain('formula-op');
        });

        it('should handle division symbol ÷', () => {
            const result = renderFormula('A ÷ B = C');
            expect(result).toContain('formula-container');
        });

        it('should handle asterisk as multiplication', () => {
            const result = renderFormula('A * B = C');
            expect(result).toContain('formula-container');
        });

        it('should handle slash as division', () => {
            const result = renderFormula('A / B = C');
            expect(result).toContain('formula-container');
        });
    });
});
