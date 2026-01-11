/**
 * Formula Renderer Module
 * Renders mathematical formulas using KaTeX for proper math notation
 */

import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Check if a formula string contains LaTeX syntax
 */
function isLatexFormula(formula: string): boolean {
    // Check for common LaTeX indicators
    return /\\[a-zA-Z]+|\\{|\\}|\^|_\{/.test(formula);
}

/**
 * Convert plain text formula to LaTeX notation
 * Handles common patterns found in item formulas
 */
function convertToLatex(formula: string): string {
    let latex = formula;

    // Replace multiplication symbol with LaTeX times
    latex = latex.replace(/×/g, '\\times');

    // Replace division with proper fraction or division symbol
    latex = latex.replace(/÷/g, '\\div');

    // Wrap variable names in \text{} for proper rendering
    // Common variables: Stack Count, Max HP, Base, etc.
    const variables = [
        'Stack Count',
        'Stacks',
        'Max HP',
        'Base HP',
        'Base',
        'Kills',
        'Movement Speed',
        'Damage',
        'Crit Chance',
        'Attack Speed',
        'Radius',
        'HP',
        'Regen',
        'Overheal',
        'Lifesteal',
        'Damage Multiplier',
        'Total Proc Chance',
        'Explosion Chance',
        'Lightning Chance',
        'Freeze Chance',
        'Dragonfire Chance',
        'Attack Speed Bonus',
        'Number of Lives',
        'Enemies Cursed',
    ];

    // Sort by length (longest first) to avoid partial replacements
    variables.sort((a, b) => b.length - a.length);

    for (const variable of variables) {
        // Only wrap if not already in a LaTeX command
        const regex = new RegExp(`(?<!\\\\text\\{)\\b${variable}\\b(?!\\})`, 'g');
        latex = latex.replace(regex, `\\text{${variable}}`);
    }

    // Handle "n" as stack count variable (standalone n)
    latex = latex.replace(/\bn\b(?![a-zA-Z])/g, 'n');

    // Convert fractions like "X / Y" to proper stacked fractions
    // Only for simple cases like "100 / 5"
    latex = latex.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');

    // Handle percentages
    latex = latex.replace(/(\d+)%/g, '$1\\%');

    // Handle min/max functions
    latex = latex.replace(/\bmin\(/g, '\\min(');
    latex = latex.replace(/\bmax\(/g, '\\max(');

    return latex;
}

/**
 * Render a formula string to HTML using KaTeX
 * Falls back to plain text if rendering fails
 */
export function renderFormula(formula: string): string {
    if (!formula) {
        return '';
    }

    // Check if this is a descriptive text rather than a math formula
    // Descriptive formulas don't have = or mathematical operators
    const isMathFormula = /[=×÷+\-*/]/.test(formula) || isLatexFormula(formula);

    if (!isMathFormula) {
        // Return as styled text, not math
        return `<span class="formula-text">${formula}</span>`;
    }

    try {
        // Convert to LaTeX if needed
        const latex = isLatexFormula(formula) ? formula : convertToLatex(formula);

        // Render with KaTeX
        return katex.renderToString(latex, {
            throwOnError: false,
            displayMode: false,
            output: 'html',
            trust: false,
            strict: false,
        });
    } catch (error) {
        // Fall back to plain text on error
        console.warn('KaTeX rendering failed for formula:', formula, error);
        return `<span class="formula-text">${formula}</span>`;
    }
}

/**
 * Render a formula for display mode (centered, larger)
 */
export function renderFormulaDisplay(formula: string): string {
    if (!formula) {
        return '';
    }

    const isMathFormula = /[=×÷+\-*/]/.test(formula) || isLatexFormula(formula);

    if (!isMathFormula) {
        return `<span class="formula-text">${formula}</span>`;
    }

    try {
        const latex = isLatexFormula(formula) ? formula : convertToLatex(formula);

        return katex.renderToString(latex, {
            throwOnError: false,
            displayMode: true,
            output: 'html',
            trust: false,
            strict: false,
        });
    } catch (error) {
        console.warn('KaTeX rendering failed for formula:', formula, error);
        return `<span class="formula-text">${formula}</span>`;
    }
}
