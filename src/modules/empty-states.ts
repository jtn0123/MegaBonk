// ========================================
// MegaBonk Empty States Module
// Option E: Hybrid approach with message, action button, and suggestions
// ========================================

import { escapeHtml, safeGetElementById } from './utils.ts';
import { getState } from './store.ts';
import { getDataForTab } from './data-service.ts';
import { getFavorites } from './favorites.ts';
import { normalizeEntityType, type Entity, type EntityType } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

export type EmptyStateType = 'favorites' | 'search' | 'filters' | 'compare' | 'generic';

export interface EmptyStateContext {
    type: EmptyStateType;
    tabName: EntityType;
    searchQuery?: string;
    hasActiveFilters?: boolean;
}

interface SuggestedItem {
    id: string;
    name: string;
    tier?: string;
    description?: string;
    image?: string;
    icon?: string;
    rarity?: string;
}

// ========================================
// Empty State Configuration
// ========================================

const EMPTY_STATE_CONFIG: Record<
    EmptyStateType,
    {
        getMessage: (ctx: EmptyStateContext) => string;
        buttonText: string;
        buttonAction: string;
    }
> = {
    favorites: {
        getMessage: () => 'No favorites yet! ❤️',
        buttonText: 'Browse Items',
        buttonAction: 'browse',
    },
    compare: {
        getMessage: () => 'Nothing to compare yet! 🔄',
        buttonText: 'Add Items to Compare',
        buttonAction: 'browse',
    },
    search: {
        getMessage: ctx => `No results for "${escapeHtml(ctx.searchQuery || '')}" 🔍`,
        buttonText: 'Clear Search',
        buttonAction: 'clear-search',
    },
    filters: {
        getMessage: () => 'No items match these filters 🎯',
        buttonText: 'Clear Filters',
        buttonAction: 'clear-filters',
    },
    generic: {
        getMessage: () => 'No items found',
        buttonText: 'Clear Filters',
        buttonAction: 'clear-filters',
    },
};

// ========================================
// Suggestion Generators
// ========================================

/**
 * Get popular/highly-rated items for suggestions (for favorites empty state)
 */
function getPopularItems(tabName: EntityType, limit: number = 4): SuggestedItem[] {
    const data = getDataForTab(tabName) as Entity[];
    if (!data || data.length === 0) return [];

    // Sort by tier (SS > S > A > B > C) and take top items
    const tierOrder: Record<string, number> = { SS: 0, S: 1, A: 2, B: 3, C: 4 };
    const sorted = [...data].sort((a, b) => {
        const tierA = tierOrder[a.tier || 'C'] ?? 5;
        const tierB = tierOrder[b.tier || 'C'] ?? 5;
        return tierA - tierB;
    });

    return sorted.slice(0, limit).map(item => mapEntityToSuggested(item, tabName));
}

/**
 * Get items good for comparing (different tiers for variety)
 */
function getCompareableItems(tabName: EntityType, limit: number = 4): SuggestedItem[] {
    const data = getDataForTab(tabName) as Entity[];
    if (!data || data.length === 0) return [];

    // Get one item from each tier for comparison variety
    const byTier: Record<string, Entity[]> = {};
    data.forEach(item => {
        const tier = item.tier || 'C';
        if (!byTier[tier]) byTier[tier] = [];
        byTier[tier].push(item);
    });

    const suggestions: SuggestedItem[] = [];
    const tiers = ['SS', 'S', 'A', 'B'];

    for (const tier of tiers) {
        if (suggestions.length >= limit) break;
        const tierItems = byTier[tier];
        if (tierItems && tierItems.length > 0) {
            // Pick a random item from this tier
            const randomIdx = Math.floor(Math.random() * tierItems.length);
            const item = tierItems[randomIdx];
            if (item) {
                suggestions.push(mapEntityToSuggested(item, tabName));
            }
        }
    }

    return suggestions;
}

/**
 * Get random popular items as alternatives (for search empty state)
 */
function getAlternativeItems(tabName: EntityType, limit: number = 4): SuggestedItem[] {
    const data = getDataForTab(tabName) as Entity[];
    if (!data || data.length === 0) return [];

    // Filter to only good items (S or SS tier) for suggestions
    const goodItems = data.filter(item => item.tier === 'SS' || item.tier === 'S' || item.tier === 'A');
    const itemPool = goodItems.length >= limit ? goodItems : data;

    // Shuffle and take random items
    const shuffled = [...itemPool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit).map(item => mapEntityToSuggested(item, tabName));
}

/**
 * Get items that partially match filters (relaxed criteria)
 */
function getPartialMatchItems(tabName: EntityType, limit: number = 4): SuggestedItem[] {
    // For now, just return popular items as "partial matches"
    // In a more advanced implementation, this could look at the active filter values
    // and find items that match some but not all criteria
    return getPopularItems(tabName, limit);
}

/**
 * Map an Entity to SuggestedItem format
 */
function mapEntityToSuggested(entity: Entity, tabName: EntityType): SuggestedItem {
    const item: SuggestedItem = {
        id: entity.id,
        name: entity.name || 'Unknown',
        tier: entity.tier,
        description: getShortDescription(entity, tabName),
    };

    // Handle image/icon based on entity type
    if (tabName === 'shrines' && 'icon' in entity) {
        item.icon = (entity as { icon?: string }).icon;
    } else if ('image' in entity) {
        item.image = (entity as { image?: string }).image;
    }

    if ('rarity' in entity) {
        item.rarity = (entity as { rarity?: string }).rarity;
    }

    return item;
}

/**
 * Get a short description for an entity
 */
function getShortDescription(entity: Entity, tabName: EntityType): string {
    let desc = '';

    switch (tabName) {
        case 'items':
            desc = (entity as { base_effect?: string }).base_effect || entity.description || '';
            break;
        case 'weapons':
            desc = (entity as { attack_pattern?: string }).attack_pattern || entity.description || '';
            break;
        case 'tomes':
            desc = (entity as { stat_affected?: string }).stat_affected || entity.description || '';
            break;
        case 'characters':
            desc = (entity as { passive_ability?: string }).passive_ability || entity.description || '';
            break;
        case 'shrines':
            desc = (entity as { reward?: string }).reward || entity.description || '';
            break;
        default:
            desc = entity.description || '';
    }

    // Truncate to 60 chars
    if (desc.length > 60) {
        return desc.substring(0, 57) + '...';
    }
    return desc;
}

// ========================================
// Empty State Detection
// ========================================

/**
 * Detect what type of empty state we should show
 */
export function detectEmptyStateType(tabName: EntityType): EmptyStateContext {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    const searchQuery = searchInput?.value?.trim() || '';

    const favoritesCheckbox = safeGetElementById('favoritesOnly') as HTMLInputElement | null;
    const favoritesOnly = favoritesCheckbox?.checked || false;

    // Check if any filters are active
    const tierFilter = safeGetElementById('tierFilter') as HTMLSelectElement | null;
    const rarityFilter = safeGetElementById('rarityFilter') as HTMLSelectElement | null;
    const stackingFilter = safeGetElementById('stackingFilter') as HTMLSelectElement | null;
    const typeFilter = safeGetElementById('typeFilter') as HTMLSelectElement | null;

    const hasActiveFilters =
        (tierFilter?.value && tierFilter.value !== 'all') ||
        (rarityFilter?.value && rarityFilter.value !== 'all') ||
        (stackingFilter?.value && stackingFilter.value !== 'all') ||
        (typeFilter?.value && typeFilter.value !== 'all');

    // Priority: favorites > search > filters > generic
    if (favoritesOnly) {
        const favorites = getFavorites(tabName);
        if (favorites.length === 0) {
            return { type: 'favorites', tabName };
        }
    }

    if (searchQuery.length > 0) {
        return { type: 'search', tabName, searchQuery };
    }

    if (hasActiveFilters) {
        return { type: 'filters', tabName, hasActiveFilters: true };
    }

    return { type: 'generic', tabName };
}

// ========================================
// HTML Generation
// ========================================

/**
 * Generate a suggestion card HTML
 */
function generateSuggestionCard(item: SuggestedItem, tabName: EntityType): string {
    const entityType = tabName.replace(/s$/, ''); // items -> item

    let imageHtml = '';
    if (item.icon) {
        imageHtml = `<span class="suggestion-icon">${escapeHtml(item.icon)}</span>`;
    } else if (item.image) {
        imageHtml = `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="suggestion-image" loading="lazy" />`;
    } else {
        // Fallback emoji based on tab
        const fallbackIcons: Record<EntityType, string> = {
            items: '📦',
            weapons: '⚔️',
            tomes: '📚',
            characters: '👤',
            shrines: '⛩️',
        };
        imageHtml = `<span class="suggestion-icon">${fallbackIcons[tabName]}</span>`;
    }

    return `
        <div class="suggestion-card" 
             data-entity-type="${entityType}" 
             data-entity-id="${escapeHtml(item.id)}"
             data-tab-type="${tabName}"
             role="button"
             tabindex="0">
            <div class="suggestion-visual">
                ${imageHtml}
            </div>
            <div class="suggestion-info">
                <span class="suggestion-name">${escapeHtml(item.name)}</span>
                ${item.tier ? `<span class="suggestion-tier tier-${item.tier}">${item.tier}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Generate the full empty state HTML with suggestions
 */
export function generateEmptyStateWithSuggestions(context: EmptyStateContext): string {
    const config = EMPTY_STATE_CONFIG[context.type];
    const message = config.getMessage(context);
    const { buttonText, buttonAction } = config;

    // Get appropriate suggestions based on empty state type
    let suggestions: SuggestedItem[] = [];
    switch (context.type) {
        case 'favorites':
            suggestions = getPopularItems(context.tabName, 4);
            break;
        case 'compare':
            suggestions = getCompareableItems(context.tabName, 4);
            break;
        case 'search':
            suggestions = getAlternativeItems(context.tabName, 4);
            break;
        case 'filters':
            suggestions = getPartialMatchItems(context.tabName, 4);
            break;
        default:
            suggestions = getPopularItems(context.tabName, 4);
    }

    const suggestionsHtml =
        suggestions.length > 0
            ? `
            <div class="empty-state-suggestions">
                <span class="suggestions-label">Try these instead:</span>
                <div class="suggestions-grid">
                    ${suggestions.map(item => generateSuggestionCard(item, context.tabName)).join('')}
                </div>
            </div>
        `
            : '';

    return `
        <div class="empty-state empty-state-enhanced">
            <div class="empty-state-content">
                <h3 class="empty-state-message">${message}</h3>
                <button class="empty-state-action btn-primary" data-action="${buttonAction}">
                    ${escapeHtml(buttonText)}
                </button>
            </div>
            ${suggestionsHtml}
        </div>
    `;
}

/**
 * Generate empty state for compare mode
 */
export function generateCompareEmptyState(): string {
    // For compare mode, we suggest items from the items tab
    const context: EmptyStateContext = { type: 'compare', tabName: 'items' };
    return generateEmptyStateWithSuggestions(context);
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle clicks on empty state elements
 * This should be called from event delegation in events-core.ts
 */
export function handleEmptyStateClick(target: Element): boolean {
    // Handle action button clicks
    if (target.classList.contains('empty-state-action')) {
        const action = (target as HTMLElement).dataset.action;

        switch (action) {
            case 'browse':
            case 'clear-filters':
                // Clear filters and show all items
                clearFiltersAndSearch();
                return true;
            case 'clear-search':
                clearSearch();
                return true;
        }
    }

    // Handle suggestion card clicks
    if (target.classList.contains('suggestion-card') || target.closest('.suggestion-card')) {
        const card = target.classList.contains('suggestion-card')
            ? (target as HTMLElement)
            : (target.closest('.suggestion-card') as HTMLElement);

        if (card) {
            const entityType = card.dataset.entityType;
            const entityId = card.dataset.entityId;

            if (entityType && entityId) {
                const type = normalizeEntityType(entityType);
                if (type) {
                    import('./modal.ts').then(({ openDetailModal }) => {
                        openDetailModal(type, entityId);
                    });
                }
                return true;
            }
        }
    }

    return false;
}

/**
 * Clear search input
 */
function clearSearch(): void {
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.value = '';
        // Trigger re-render
        const currentTab = getState('currentTab');
        if (window.renderTabContent && currentTab) {
            window.renderTabContent(currentTab);
        }
    }
}

/**
 * Clear all filters and search
 */
function clearFiltersAndSearch(): void {
    // Clear search
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    // Clear favorites only checkbox
    const favoritesCheckbox = safeGetElementById('favoritesOnly') as HTMLInputElement | null;
    if (favoritesCheckbox) favoritesCheckbox.checked = false;

    // Clear all select filters
    const selects = document.querySelectorAll('#filters select');
    selects.forEach(select => {
        (select as HTMLSelectElement).value = 'all';
    });

    // Trigger re-render
    const currentTab = getState('currentTab');
    if (window.renderTabContent && currentTab) {
        window.renderTabContent(currentTab);
    }
}

// ========================================
// Window Type Declarations
// ========================================

declare global {
    interface Window {
        renderTabContent?: (tabName: string) => void;
    }
}
