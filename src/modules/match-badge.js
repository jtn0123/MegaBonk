// ========================================
// Search Match Context Display
// ========================================

/**
 * Generate match context badge HTML for search results
 * Shows why a result matched (exact match in name, fuzzy match in description, etc.)
 * @param {Object} matchContext - Match context from fuzzy search
 * @returns {string} HTML string for match badge
 */
export function generateMatchBadge(matchContext) {
    if (!matchContext || matchContext.matchType === 'none') return '';

    const matchTypeLabels = {
        exact: '✓ Exact',
        starts_with: '▶ Starts with',
        contains: '⊃ Contains',
        fuzzy: '≈ Similar',
    };

    const fieldLabels = {
        name: 'Name',
        description: 'Description',
        effect: 'Effect',
        tags: 'Tags',
    };

    const label = matchTypeLabels[matchContext.matchType] || 'Match';
    const field = fieldLabels[matchContext.field] || matchContext.field;

    return `<span class="match-badge match-${matchContext.matchType}" title="Matched in ${field}: ${label}">
        ${label} in ${field}
    </span>`;
}
