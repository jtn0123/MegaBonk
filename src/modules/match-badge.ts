// ========================================
// Search Match Context Display
// ========================================

/**
 * Match type indicators
 */
type MatchType = 'exact' | 'starts_with' | 'contains' | 'fuzzy' | 'none';

/**
 * Search field indicators
 */
type SearchField = 'name' | 'description' | 'effect' | 'tags';

/**
 * Match context from fuzzy search
 */
interface MatchContext {
    matchType: MatchType;
    field: SearchField;
    score?: number;
}

/**
 * Generate match context badge HTML for search results
 * Shows why a result matched (exact match in name, fuzzy match in description, etc.)
 * @param matchContext - Match context from fuzzy search
 * @returns HTML string for match badge
 */
export function generateMatchBadge(matchContext: MatchContext | null | undefined): string {
    if (!matchContext || matchContext.matchType === 'none') return '';

    const matchTypeLabels: Record<MatchType, string> = {
        exact: '✓ Exact',
        starts_with: '▶ Starts with',
        contains: '⊃ Contains',
        fuzzy: '≈ Similar',
        none: '',
    };

    const fieldLabels: Record<SearchField, string> = {
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
