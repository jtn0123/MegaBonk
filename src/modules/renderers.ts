// ========================================
// MegaBonk Renderers Module
// ========================================

import {
    generateEntityImage,
    generateTierLabel,
    escapeHtml,
    safeGetElementById,
    truncateText,
    generateMetaTags,
    generateEmptyState,
} from './utils.ts';
import { isFavorite } from './favorites.ts';
import { getDataForTab } from './data-service.ts';
import { filterData, GlobalSearchResult } from './filters.ts';
// Tab-specific modules are lazy-loaded via dynamic imports for code splitting
// import { calculateBreakpoint, populateCalculatorItems } from './calculator.ts';
// import { getCompareItems } from './compare.ts';
// import { updateChangelogStats, renderChangelog } from './changelog.ts';
// import { renderBuildPlanner } from './build-planner.ts';
import { logger } from './logger.ts';
import { setState } from './store.ts';
import { registerFunction } from './registry.ts';
import type {
    Item as BaseItem,
    Weapon as BaseWeapon,
    Tome as BaseTome,
    Character as BaseCharacter,
    Shrine as BaseShrine,
    Entity,
    EntityType,
    ChangelogPatch,
} from '../types/index.ts';

// ========================================
// Extended Type Definitions for Actual Data
// ========================================

/**
 * Extended Item interface matching actual data structure
 */
export interface Item extends BaseItem {
    base_effect: string;
    detailed_description: string;
    one_and_done?: boolean;
    stacks_well?: boolean;
    scaling_per_stack?: number[];
    graph_type?: string;
}

/**
 * Extended Weapon interface matching actual data structure
 */
export interface Weapon extends BaseWeapon {
    attack_pattern: string;
    upgradeable_stats?: string[];
}

/**
 * Extended Tome interface matching actual data structure
 */
export interface Tome extends BaseTome {
    stat_affected: string;
    value_per_level: string;
    priority: number;
}

/**
 * Extended Character interface matching actual data structure
 */
export interface Character extends BaseCharacter {
    passive_ability: string;
    passive_description: string;
    starting_weapon: string;
    playstyle: string;
}

/**
 * Extended Shrine interface matching actual data structure
 */
export interface Shrine extends BaseShrine {
    icon: string;
    type: 'stat_upgrade' | 'combat' | 'utility' | 'risk_reward';
    reward: string;
    reusable: boolean;
}

// NOTE: Calculator button listener tracking moved to data attribute on element
// to properly handle DOM recreation scenarios

/**
 * Helper to initialize charts with requestAnimationFrame and error handling
 * Reduces code duplication across render functions
 * @param chartInitFn - The name of the chart init function to import and call
 * @param context - Context string for logging (e.g., 'item_tab_render')
 */
function initChartsAsync(chartInitFn: 'initializeItemCharts' | 'initializeTomeCharts', context: string): void {
    requestAnimationFrame(async () => {
        try {
            const charts = await import('./charts.ts');
            charts[chartInitFn]();
        } catch (err) {
            logger.warn({
                operation: 'chart.init',
                error: { name: 'ImportError', message: `Failed to initialize ${chartInitFn}`, module: 'renderers' },
                data: { context },
            });
        }
    });
}

/**
 * Render content for the current tab
 * Uses dynamic imports for tab-specific modules to enable code splitting
 * @param {string} tabName - Tab to render
 */
export async function renderTabContent(tabName: string): Promise<void> {
    if (tabName === 'build-planner') {
        const { renderBuildPlanner } = await import('./build-planner.ts');
        renderBuildPlanner();
        return;
    }

    if (tabName === 'calculator') {
        const { populateCalculatorItems, calculateBreakpoint } = await import('./calculator.ts');
        populateCalculatorItems();
        // Use data attribute to track listener on the actual element
        // This handles DOM recreation scenarios (HMR, re-renders) correctly
        const calcBtn = safeGetElementById('calc-button');
        if (calcBtn && !calcBtn.dataset.listenerAttached) {
            calcBtn.addEventListener('click', calculateBreakpoint);
            calcBtn.dataset.listenerAttached = 'true';
        }
        return;
    }

    if (tabName === 'changelog') {
        const { updateChangelogStats, renderChangelog } = await import('./changelog.ts');
        const data = getDataForTab(tabName) as ChangelogPatch[];
        // filterData works with any array having name/description fields
        const filtered = filterData(data as unknown as Entity[], tabName) as unknown as ChangelogPatch[];
        setState('filteredData', filtered as unknown as Entity[]);
        updateChangelogStats(filtered);
        renderChangelog(filtered);
        return;
    }

    const data = getDataForTab(tabName) as Entity[];
    if (!data) return;

    const filtered = filterData(data, tabName);
    setState('filteredData', filtered);

    updateStats(filtered, tabName);

    // Render based on type
    switch (tabName) {
        case 'items':
            await renderItems(filtered as Item[]);
            break;
        case 'weapons':
            renderWeapons(filtered as Weapon[]);
            break;
        case 'tomes':
            renderTomes(filtered as Tome[]);
            break;
        case 'characters':
            renderCharacters(filtered as Character[]);
            break;
        case 'shrines':
            renderShrines(filtered as Shrine[]);
            break;
    }
}

/**
 * Update item count badge
 * @param {Entity[]} filtered - Filtered data
 * @param {string} tabName - Current tab
 */
export function updateStats(filtered: Entity[], tabName: string): void {
    const itemCount = safeGetElementById('item-count');
    if (!itemCount) return;

    const totalCount = getDataForTab(tabName).length;
    const showingCount = filtered.length;

    // Get singular/plural label based on tab
    const categoryName = tabName && tabName.length > 0 ? tabName : 'items';
    const label = showingCount === 1 ? categoryName.slice(0, -1) : categoryName;

    // Show "X items" or "X/Y items" if filtered
    if (showingCount === totalCount) {
        itemCount.textContent = `${showingCount} ${label}`;
    } else {
        itemCount.textContent = `${showingCount}/${totalCount} ${label}`;
    }
}

/**
 * Render items grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} items - Items to render
 */
export async function renderItems(items: Item[]): Promise<void> {
    const container = safeGetElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = generateEmptyState('🔍', 'Items');
        return;
    }

    // Use DocumentFragment to batch all DOM operations - prevents multiple reflows
    const fragment = document.createDocumentFragment();
    // Cache compare items lookup once instead of per-item
    // Dynamic import for code splitting - module is preloaded by tab-loader
    const { getCompareItems } = await import('./compare.ts');
    const compareItems = getCompareItems();

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `item-card rarity-${item.rarity}`;
        card.dataset.entityType = 'item';
        card.dataset.entityId = item.id;

        // Reserved for future use: const stackIcon = item.one_and_done ? '✓' : item.stacks_well ? '∞' : '~';
        const stackText = item.one_and_done ? 'One-and-Done' : item.stacks_well ? 'Stacks Well' : 'Limited';
        const imageHtml = generateEntityImage(item, item.name);

        // Determine if this item should show a scaling graph
        const showGraph = item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat';
        const graphHtml = showGraph
            ? `
            <div class="item-graph-container">
                <canvas id="chart-${item.id}" class="scaling-chart"></canvas>
            </div>
        `
            : `
            <div class="item-graph-placeholder">
                <span>${item.one_and_done ? 'One-and-done: no scaling benefit from stacks' : 'Flat bonus: does not scale'}</span>
            </div>
        `;

        // Handle expandable description
        const { html: descHtml, needsExpand, fullText } = truncateText(item.detailed_description, 120);

        const isFav = typeof isFavorite === 'function' ? isFavorite('items', item.id) : false;
        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    ${generateTierLabel(item.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="items" data-id="${item.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
                <label class="compare-checkbox-label" title="Add to comparison">
                    <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${compareItems.includes(item.id) ? 'checked' : ''}>
                    <span>+</span>
                </label>
            </div>
            <div class="item-effect">${escapeHtml(item.base_effect)}</div>
            <div class="item-description ${needsExpand ? 'expandable-text' : ''}"
                 ${needsExpand ? `data-full-text="${escapeHtml(fullText)}" data-truncated="true"` : ''}>
                ${descHtml}
                ${needsExpand ? '<span class="expand-indicator">Click to expand</span>' : ''}
            </div>
            <div class="item-meta">
                <span class="meta-tag">${stackText}</span>
            </div>
            ${graphHtml}
            <button class="view-details-btn" data-type="items" data-id="${item.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);

    // Initialize charts after DOM is painted
    initChartsAsync('initializeItemCharts', 'item_tab_render');
}

/**
 * Render weapons grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} weapons - Weapons to render
 */
export function renderWeapons(weapons: Weapon[]): void {
    const container = safeGetElementById('weaponsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (weapons.length === 0) {
        container.innerHTML = generateEmptyState('⚔️', 'Weapons');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    weapons.forEach(weapon => {
        const card = document.createElement('div');
        card.className = 'item-card weapon-card';
        card.dataset.entityType = 'weapon';
        card.dataset.entityId = weapon.id;

        const imageHtml = generateEntityImage(weapon, weapon.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('weapons', weapon.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(weapon.name)}</div>
                    ${generateTierLabel(weapon.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="weapons" data-id="${weapon.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(weapon.attack_pattern)}</div>
            <div class="item-description">${escapeHtml(weapon.description)}</div>
            <div class="item-meta">
                ${generateMetaTags(Array.isArray(weapon.upgradeable_stats) ? weapon.upgradeable_stats : weapon.upgradeable_stats ? [weapon.upgradeable_stats] : null, 4)}
            </div>
            <button class="view-details-btn" data-type="weapons" data-id="${weapon.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);
}

/**
 * Render tomes grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} tomes - Tomes to render
 */
export function renderTomes(tomes: Tome[]): void {
    const container = safeGetElementById('tomesContainer');
    if (!container) return;

    container.innerHTML = '';

    if (tomes.length === 0) {
        container.innerHTML = generateEmptyState('📚', 'Tomes');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    tomes.forEach(tome => {
        const card = document.createElement('div');
        card.className = 'item-card tome-card';
        card.dataset.entityType = 'tome';
        card.dataset.entityId = tome.id;

        const imageHtml = generateEntityImage(tome, tome.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('tomes', tome.id) : false;

        // Check if tome has valid progression data (numeric value in value_per_level)
        const valueStr = typeof tome.value_per_level === 'number' ? String(tome.value_per_level) : tome.value_per_level;
        const hasProgression = valueStr && /[+-]?[\d.]+/.test(valueStr);
        const graphHtml = hasProgression
            ? `
            <div class="tome-graph-container">
                <canvas id="tome-chart-${tome.id}" class="scaling-chart"></canvas>
            </div>
        `
            : `
            <div class="tome-graph-placeholder">
                <span>No progression data available</span>
            </div>
        `;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(tome.name)}</div>
                    <span class="tier-label">${tome.tier} Tier · Priority ${tome.priority}</span>
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="tomes" data-id="${tome.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(tome.stat_affected)}: ${escapeHtml(String(tome.value_per_level))}</div>
            <div class="item-description">${escapeHtml(tome.description)}</div>
            ${graphHtml}
            <button class="view-details-btn" data-type="tomes" data-id="${tome.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);

    // Initialize charts after DOM is painted
    initChartsAsync('initializeTomeCharts', 'tome_tab_render');
}

/**
 * Render characters grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} characters - Characters to render
 */
export function renderCharacters(characters: Character[]): void {
    const container = safeGetElementById('charactersContainer');
    if (!container) return;

    container.innerHTML = '';

    if (characters.length === 0) {
        container.innerHTML = generateEmptyState('👤', 'Characters');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'item-card character-card';
        card.dataset.entityType = 'character';
        card.dataset.entityId = char.id;

        const imageHtml = generateEntityImage(char, char.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('characters', char.id) : false;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${escapeHtml(char.name)}</div>
                    ${generateTierLabel(char.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="characters" data-id="${char.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(char.passive_ability)}</div>
            <div class="item-description">${escapeHtml(char.passive_description)}</div>
            <div class="item-meta">
                <span class="meta-tag">${escapeHtml(char.starting_weapon)}</span>
                <span class="meta-tag">${escapeHtml(char.playstyle)}</span>
            </div>
            <button class="view-details-btn" data-type="characters" data-id="${char.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);
}

/**
 * Render shrines grid
 * Uses DocumentFragment for batch DOM updates to prevent layout thrashing
 * @param {Array} shrines - Shrines to render
 */
export function renderShrines(shrines: Shrine[]): void {
    const container = safeGetElementById('shrinesContainer');
    if (!container) return;

    container.innerHTML = '';

    if (shrines.length === 0) {
        container.innerHTML = generateEmptyState('⛩️', 'Shrines');
        return;
    }

    // Use DocumentFragment to batch all DOM operations
    const fragment = document.createDocumentFragment();

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'item-card shrine-card';
        card.dataset.entityType = 'shrine';
        card.dataset.entityId = shrine.id;

        const isFav = typeof isFavorite === 'function' ? isFavorite('shrines', shrine.id) : false;

        card.innerHTML = `
            <div class="item-header">
                <span class="shrine-icon-large">${shrine.icon || ''}</span>
                <div class="item-title">
                    <div class="item-name">${escapeHtml(shrine.name)}</div>
                    ${shrine.type ? `<span class="tier-label">${escapeHtml(shrine.type.replace('_', ' '))}</span>` : ''}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="shrines" data-id="${shrine.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${escapeHtml(shrine.description)}</div>
            <div class="item-description">${shrine.reward ? escapeHtml(shrine.reward) : ''}</div>
            <div class="item-meta">
                ${shrine.reusable !== undefined ? (shrine.reusable ? '<span class="meta-tag">Reusable</span>' : '<span class="meta-tag">One-time</span>') : ''}
            </div>
            <button class="view-details-btn" data-type="shrines" data-id="${shrine.id}">View Details</button>
        `;

        fragment.appendChild(card);
    });

    // Single DOM operation - append all cards at once
    container.appendChild(fragment);
}

// ========================================
// Global Search Results Rendering
// ========================================

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
 * @param {GlobalSearchResult[]} results - Search results sorted by score
 */
export function renderGlobalSearchResults(results: GlobalSearchResult[]): void {
    const container = safeGetElementById('itemsContainer');
    if (!container) return;

    // Update stats to show global search mode
    const itemCount = safeGetElementById('item-count');
    if (itemCount) {
        itemCount.textContent = `${results.length} results across all categories`;
    }

    // Clear container
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🔍</span>
                <h3>No Results Found</h3>
                <p>Try a different search term</p>
            </div>
        `;
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

    // Render each group
    const typeOrder: EntityType[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

    for (const type of typeOrder) {
        const typeResults = grouped.get(type);
        if (!typeResults || typeResults.length === 0) continue;

        const { label, icon } = TYPE_LABELS[type];

        // Create section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'global-search-section-header';
        sectionHeader.innerHTML = `
            <span class="section-icon">${icon}</span>
            <span class="section-title">${label}</span>
            <span class="section-count">(${typeResults.length})</span>
        `;
        container.appendChild(sectionHeader);

        // Create section container for results
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'global-search-section';
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
    const name = item.name || 'Unknown';
    const tier = 'tier' in item ? (item as any).tier : '';
    const description = getItemDescription(item, type);

    // Generate image or icon
    let imageHtml = '';
    if (type === 'shrines' && 'icon' in item) {
        imageHtml = `<span class="search-result-icon">${(item as any).icon}</span>`;
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
function getItemDescription(item: any, type: EntityType): string {
    switch (type) {
        case 'items':
            return item.base_effect || item.description || '';
        case 'weapons':
            return item.attack_pattern || item.description || '';
        case 'tomes':
            return `${item.stat_affected || ''}: ${item.value_per_level || ''}`.trim() || item.description || '';
        case 'characters':
            return item.passive_ability || item.description || '';
        case 'shrines':
            return item.reward || item.description || '';
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

// ========================================
// Registry & Global Assignments
// ========================================
// Register renderTabContent for type-safe cross-module access
registerFunction('renderTabContent', renderTabContent);
// Keep window assignment for backwards compatibility during migration
if (typeof window !== 'undefined') {
    // Type assertions: functions use specific types but window uses generic types for flexibility
    window.renderTabContent = renderTabContent as typeof window.renderTabContent;
    window.renderGlobalSearchResults = renderGlobalSearchResults as typeof window.renderGlobalSearchResults;
}
