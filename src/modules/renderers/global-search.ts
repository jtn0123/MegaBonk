// ========================================
// Global Search Results Rendering
// ========================================

import { generateEntityImage, generateTierLabel, escapeHtml, safeGetElementById } from '../utils.ts';
import { generateEmptyStateWithSuggestions, type EmptyStateContext } from '../empty-states.ts';
import { getState } from '../store.ts';
import type { GlobalSearchResult } from '../filters.ts';
import type {
    Item as BaseItem,
    Weapon as BaseWeapon,
    Tome as BaseTome,
    Character as BaseCharacter,
    Shrine as BaseShrine,
    Entity,
    EntityType,
} from '../../types/index.ts';
import type { Shrine } from './types.ts';

/**
 * Type label mapping for display
 */
const TYPE_LABELS: Record<EntityType, { label: string; icon: string }> = {
    items: { label: 'Items', icon: '📦' },
    weapons: { label: 'Weapons', icon: '⚔️' },
    tomes: { label: 'Tomes', icon: '📚' },
    characters: { label: 'Characters', icon: '👤' },
    shrines: { label: 'Shrines', icon: '⛩️' },
};

/**
 * Maximum results to show per category in global search
 */
const MAX_RESULTS_PER_TYPE = 10;

/**
 * Render global search results grouped by type
 * Prioritizes the current tab's results at the top
 * @param {GlobalSearchResult[]} results - Search results sorted by score
 * @param {string} currentTab - Current active tab for prioritization
 * @param {string} searchQuery - The search query for display
 */
export function renderGlobalSearchResults(
    results: GlobalSearchResult[],
    currentTab?: string,
    searchQuery?: string
): void {
    // Get the main content container - use the currently active tab panel's container
    const activeTabPanel = document.querySelector('.tab-content.active');
    const container =
        (activeTabPanel?.querySelector('.items-grid, .items-container') as HTMLElement | null) ||
        safeGetElementById('itemsContainer');
    if (!container) return;

    // Update stats to show global search mode
    const itemCount = safeGetElementById('item-count');
    if (itemCount) {
        itemCount.textContent = `${results.length} results across all categories`;
    }

    // Clear container
    container.innerHTML = '';

    if (results.length === 0) {
        // Use enhanced empty state with suggestions
        const currentTab = getState('currentTab') as EntityType;
        const validTab = ['items', 'weapons', 'tomes', 'characters', 'shrines'].includes(currentTab)
            ? currentTab
            : 'items';
        const context: EmptyStateContext = {
            type: 'search',
            tabName: validTab,
            searchQuery: searchQuery || '',
        };
        container.innerHTML = generateEmptyStateWithSuggestions(context);
        return;
    }

    // Group results by type
    const grouped = new Map<EntityType, GlobalSearchResult[]>();
    for (const result of results) {
        const existing = grouped.get(result.type) || [];
        if (existing.length < MAX_RESULTS_PER_TYPE) {
            existing.push(result);
            grouped.set(result.type, existing);
        }
    }

    // Determine type order - prioritize current tab if it's a searchable entity type
    const baseTypeOrder: EntityType[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    let typeOrder: EntityType[];

    if (currentTab && baseTypeOrder.includes(currentTab as EntityType)) {
        // Put current tab first, then others in original order
        const currentTabType = currentTab as EntityType;
        typeOrder = [currentTabType, ...baseTypeOrder.filter(t => t !== currentTabType)];
    } else {
        typeOrder = baseTypeOrder;
    }

    // Render each group
    for (const type of typeOrder) {
        const typeResults = grouped.get(type);
        if (!typeResults || typeResults.length === 0) continue;

        const { label, icon } = TYPE_LABELS[type];
        const isCurrentTab = type === currentTab;

        // Create section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = `global-search-section-header${isCurrentTab ? ' current-tab-section' : ''}`;
        sectionHeader.innerHTML = `
            <span class="section-icon">${icon}</span>
            <span class="section-title">${label}${isCurrentTab ? ' (Current Tab)' : ''}</span>
            <span class="section-count">(${typeResults.length})</span>
        `;
        container.appendChild(sectionHeader);

        // Create section container for results
        const sectionContainer = document.createElement('div');
        sectionContainer.className = `global-search-section${isCurrentTab ? ' current-tab-results' : ''}`;
        sectionContainer.dataset.type = type;

        // Render each result
        for (const result of typeResults) {
            const card = createSearchResultCard(result);
            sectionContainer.appendChild(card);
        }

        container.appendChild(sectionContainer);
    }
}

/**
 * Create a compact search result card
 * @param {GlobalSearchResult} result - Search result
 * @returns {HTMLElement} Card element
 */
function createSearchResultCard(result: GlobalSearchResult): HTMLElement {
    const { type, item } = result;
    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.dataset.entityType = type.slice(0, -1); // Remove trailing 's' (items -> item)
    card.dataset.entityId = item.id;
    card.dataset.tabType = type;

    // Get item details based on type
    // All entity types have 'tier' property
    const name = item.name || 'Unknown';
    const tier = item.tier || '';
    const description = getItemDescription(item, type);

    // Generate image or icon
    let imageHtml = '';
    if (type === 'shrines' && 'icon' in item) {
        imageHtml = `<span class="search-result-icon">${(item as Shrine).icon}</span>`;
    } else {
        imageHtml = generateEntityImage(item as Entity, name);
    }

    card.innerHTML = `
        <div class="search-result-content">
            ${imageHtml}
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(name)}</div>
                ${tier ? generateTierLabel(tier) : ''}
                <div class="search-result-description">${escapeHtml(truncateSearchDescription(description, 80))}</div>
            </div>
        </div>
        <div class="search-result-action">
            <span class="go-to-icon">→</span>
        </div>
    `;

    return card;
}

/**
 * Get appropriate description text for an item based on its type
 */
function getItemDescription(
    item: BaseItem | BaseWeapon | BaseTome | BaseCharacter | BaseShrine,
    type: EntityType
): string {
    switch (type) {
        case 'items':
            return (item as BaseItem).base_effect || item.description || '';
        case 'weapons':
            return (item as BaseWeapon).attack_pattern || item.description || '';
        case 'tomes': {
            const tome = item as BaseTome;
            return `${tome.stat_affected || ''}: ${tome.value_per_level || ''}`.trim() || item.description || '';
        }
        case 'characters':
            return (item as BaseCharacter).passive_ability || (item as BaseCharacter).description || '';
        case 'shrines':
            return (item as BaseShrine).reward || item.description || '';
        default:
            return item.description || '';
    }
}

/**
 * Truncate description for search results
 */
function truncateSearchDescription(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
