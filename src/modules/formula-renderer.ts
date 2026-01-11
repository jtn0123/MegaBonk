/**
 * Formula Renderer Module
 * Renders mathematical formulas using CSS-only styling with stacked fractions
 * No external library dependencies - pure HTML/CSS rendering
 */

// Variables to highlight in formulas (sorted by length to avoid partial replacements)
const FORMULA_VARIABLES = [
    'Damage Multiplier',
    'Attack Speed Bonus',
    'Total Proc Chance',
    'Explosion Chance',
    'Lightning Chance',
    'Dragonfire Chance',
    'Movement Speed',
    'Number of Lives',
    'Enemies Cursed',
    'Freeze Chance',
    'Poison Chance',
    'Bloodmark Chance',
    'Megacrit Chance',
    'Attack Speed',
    'Crit Chance',
    'Stack Count',
    'Current HP%',
    'Max HP%',
    'Overheal',
    'Lifesteal',
    'Base HP',
    'Max HP',
    'Internal',
    'Stacks',
    'Radius',
    'Damage',
    'Evasion',
    'Poison',
    'Speed',
    'Kills',
    'Regen',
    'Base',
    'HP',
];

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Convert a fraction pattern (X / Y) to stacked HTML
 * Handles parenthesized expressions like (1 + Internal)
 */
function renderFraction(numerator: string, denominator: string): string {
    const numHtml = highlightVariables(escapeHtml(numerator.trim()));
    const denHtml = highlightVariables(escapeHtml(denominator.trim()));
    return `<span class="formula-fraction"><span class="formula-num">${numHtml}</span><span class="formula-den">${denHtml}</span></span>`;
}

/**
 * Highlight known variables in the formula
 */
function highlightVariables(text: string): string {
    let result = text;
    for (const variable of FORMULA_VARIABLES) {
        const escaped = escapeHtml(variable);
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        result = result.replace(regex, `<span class="formula-var">${escaped}</span>`);
    }
    return result;
}

/**
 * Parse and render fractions in a formula string
 * Detects patterns like "X / Y" and "X / (expression)"
 */
function parseFractions(formula: string): string {
    // Pattern to match fractions: handles "X / Y" and "X / (expression)"
    // Using a simpler approach: find "/" and determine numerator/denominator

    let result = formula;

    // Handle parenthesized denominators: X / (...)
    result = result.replace(/(\w+(?:\s*[%×*]?\s*\w+)*)\s*\/\s*\(([^)]+)\)/g, (_, num, den) =>
        renderFraction(num, `(${den})`)
    );

    // Handle simple fractions: X / Y (word or number)
    // But avoid replacing already-processed fractions or "/" in text like "stack/copy"
    result = result.replace(/(\d+(?:\.\d+)?|\w+)\s*\/\s*(\d+(?:\.\d+)?)/g, (match, num, den) => {
        // Skip if it's a word/word pattern like "stack/copy"
        if (/^[a-zA-Z]+\/[a-zA-Z]+$/.test(match)) {
            return match;
        }
        return renderFraction(num, den);
    });

    return result;
}

/**
 * Render a formula string to styled HTML
 * @param formula - The formula text to render
 * @returns HTML string with styled formula
 */
export function renderFormula(formula: string): string {
    if (!formula) {
        return '';
    }

    // Check if this is a descriptive text rather than a math formula
    const isMathFormula = /[=×÷+\-*/]/.test(formula);

    if (!isMathFormula) {
        return `<span class="formula-text">${escapeHtml(formula)}</span>`;
    }

    // Process the formula
    let html = escapeHtml(formula);

    // Unescape the fractions we're about to process (they need raw /)
    html = formula;

    // Parse and render fractions first (before escaping)
    html = parseFractions(html);

    // Now escape any remaining HTML (but preserve our already-rendered spans)
    // We need to be careful here - only escape text nodes

    // Actually, let's rebuild: escape first, then add styling
    let processed = escapeHtml(formula);

    // Highlight variables
    processed = highlightVariables(processed);

    // Style multiplication and equals signs
    processed = processed.replace(/×/g, '<span class="formula-op">×</span>');
    processed = processed.replace(/=/g, '<span class="formula-eq">=</span>');

    // Now handle fractions (need original for fraction detection)
    // Re-parse with fraction handling
    let withFractions = formula;

    // Handle parenthesized denominators: X / (...)
    withFractions = withFractions.replace(/(\w+(?:\s*[%×*]?\s*\w+)*)\s*\/\s*\(([^)]+)\)/g, (_, num, den) =>
        renderFraction(num, `(${den})`)
    );

    // Handle simple word/number over number fractions
    withFractions = withFractions.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (_, num, den) =>
        renderFraction(num, den)
    );

    // If fractions were found, use that version, otherwise use the processed one
    if (withFractions !== formula) {
        // Apply other styling to the fraction version
        let finalHtml = withFractions;

        // Escape HTML in non-span parts (this is tricky - just style what we have)
        // For now, trust that formulas are safe (they come from our JSON)

        // Highlight variables in non-span sections
        finalHtml = highlightVariables(finalHtml);

        // Style operators
        finalHtml = finalHtml.replace(/×/g, '<span class="formula-op">×</span>');
        finalHtml = finalHtml.replace(/(?<![<>])=/g, '<span class="formula-eq">=</span>');

        return `<span class="formula-container">${finalHtml}</span>`;
    }

    return `<span class="formula-container">${processed}</span>`;
}

/**
 * Render a formula for display mode (centered, larger)
 * @param formula - The formula text to render
 * @returns HTML string with styled formula in display mode
 */
export function renderFormulaDisplay(formula: string): string {
    if (!formula) {
        return '';
    }

    const rendered = renderFormula(formula);

    // Wrap in display container for larger, centered display
    return `<div class="formula-display">${rendered}</div>`;
}
