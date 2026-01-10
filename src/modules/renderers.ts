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
} from './utils.js';
import { isFavorite } from './favorites.js';
import { getDataForTab } from './data-service.js';
import { filterData } from './filters.js';
import { calculateBreakpoint, populateCalculatorItems } from './calculator.js';
import { getCompareItems } from './compare.js';
import { updateChangelogStats, renderChangelog } from './changelog.js';
import { renderBuildPlanner } from './build-planner.js';
import type {
    Item as BaseItem,
    Weapon as BaseWeapon,
    Tome as BaseTome,
    Character as BaseCharacter,
    Shrine as BaseShrine,
    Entity,
    ChangelogPatch,
} from '../types/index.js';

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
    type: string;
    reward: string;
    reusable: boolean;
}

// Track whether calculator button listener has been initialized
let calculatorButtonInitialized = false;

/**
 * Render content for the current tab
 * @param {string} tabName - Tab to render
 */
export function renderTabContent(tabName: string): void {
    if (tabName === 'build-planner') {
        renderBuildPlanner();
        return;
    }

    if (tabName === 'calculator') {
        populateCalculatorItems();
        // Only add listener once to avoid unnecessary re-attachment
        if (!calculatorButtonInitialized) {
            const calcBtn = safeGetElementById('calc-button');
            if (calcBtn) {
                calcBtn.addEventListener('click', calculateBreakpoint);
                calculatorButtonInitialized = true;
            }
        }
        return;
    }

    if (tabName === 'changelog') {
        const data = getDataForTab(tabName) as ChangelogPatch[];
        // filterData works with any array having name/description fields
        const filtered = filterData(data as unknown as Entity[], tabName) as unknown as ChangelogPatch[];
        window.filteredData = filtered as unknown as Entity[];
        updateChangelogStats(filtered);
        renderChangelog(filtered);
        return;
    }

    const data = getDataForTab(tabName) as Entity[];
    if (!data) return;

    const filtered = filterData(data, tabName);
    window.filteredData = filtered;

    updateStats(filtered, tabName);

    // Render based on type
    switch (tabName) {
        case 'items':
            renderItems(filtered as Item[]);
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
 * Update stats panel
 * @param {Array} filtered - Filtered data
 * @param {string} tabName - Current tab
 */
export function updateStats(filtered: any[], tabName: string): void {
    const statsPanel = safeGetElementById('stats-summary');
    if (!statsPanel) return;

    const totalCount = getDataForTab(tabName).length;
    const showingCount = filtered.length;

    if (tabName === 'items') {
        const items = filtered as Item[];
        const oneAndDone = items.filter(i => i.one_and_done).length;
        const stackWell = items.filter(i => i.stacks_well).length;

        statsPanel.innerHTML = `
            <h2>📊 Quick Stats</h2>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Total Items:</span><span class="stat-value">${totalCount}</span></div>
                <div class="stat-item"><span class="stat-label">Showing:</span><span class="stat-value">${showingCount}</span></div>
                <div class="stat-item"><span class="stat-label">One-and-Done:</span><span class="stat-value">${oneAndDone}</span></div>
                <div class="stat-item"><span class="stat-label">Stack Well:</span><span class="stat-value">${stackWell}</span></div>
            </div>
        `;
    } else {
        // Bug fix: Handle empty tabName to prevent errors
        const categoryName =
            tabName && tabName.length > 0 ? tabName.charAt(0).toUpperCase() + tabName.slice(1) : 'Items';
        statsPanel.innerHTML = `
            <h2>📊 Quick Stats</h2>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Total ${categoryName}:</span><span class="stat-value">${totalCount}</span></div>
                <div class="stat-item"><span class="stat-label">Showing:</span><span class="stat-value">${showingCount}</span></div>
            </div>
        `;
    }
}

/**
 * Render items grid
 * @param {Array} items - Items to render
 */
export function renderItems(items: Item[]): void {
    const container = safeGetElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = generateEmptyState('🔍', 'Items');
        return;
    }

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
            : '';

        // Handle expandable description
        const { html: descHtml, needsExpand, fullText } = truncateText(item.detailed_description, 120);

        const isFav = typeof isFavorite === 'function' ? isFavorite('items', item.id) : false;
        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${item.name}</div>
                    ${generateTierLabel(item.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="items" data-id="${item.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
                <label class="compare-checkbox-label" title="Add to comparison">
                    <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${getCompareItems().includes(item.id) ? 'checked' : ''}>
                    <span>+</span>
                </label>
            </div>
            <div class="item-effect">${item.base_effect}</div>
            <div class="item-description ${needsExpand ? 'expandable-text' : ''}"
                 ${needsExpand ? `data-full-text="${escapeHtml(fullText)}" data-truncated="true"` : ''}>
                ${descHtml}
                ${needsExpand ? '<span class="expand-indicator">Click to expand</span>' : ''}
            </div>
            <div class="item-meta">
                <span class="meta-tag">${stackText}</span>
            </div>
            ${graphHtml}
            <button class="view-details-btn" data-type="item" data-id="${item.id}">View Details</button>
        `;

        container.appendChild(card);
    });

    // Bug fix #9: Use requestAnimationFrame for more reliable chart initialization
    // This ensures DOM is painted before chart initialization
    requestAnimationFrame(async () => {
        try {
            // Dynamically import chart functions to enable code splitting
            const { initializeItemCharts } = await import('./charts.js');
            initializeItemCharts();
        } catch (err) {
            console.warn('Failed to initialize item charts:', err);
        }
    });
}

/**
 * Render weapons grid
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
                    <div class="item-name">${weapon.name}</div>
                    ${generateTierLabel(weapon.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="weapons" data-id="${weapon.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${weapon.attack_pattern}</div>
            <div class="item-description">${weapon.description}</div>
            <div class="item-meta">
                ${generateMetaTags(weapon.upgradeable_stats, 4)}
            </div>
            <button class="view-details-btn" data-type="weapon" data-id="${weapon.id}">View Details</button>
        `;

        container.appendChild(card);
    });
}

/**
 * Render tomes grid
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

    tomes.forEach(tome => {
        const card = document.createElement('div');
        card.className = 'item-card tome-card';
        card.dataset.entityType = 'tome';
        card.dataset.entityId = tome.id;

        const imageHtml = generateEntityImage(tome, tome.name);
        const isFav = typeof isFavorite === 'function' ? isFavorite('tomes', tome.id) : false;

        // Placeholder for progression - will be calculated dynamically
        const graphHtml = `
            <div class="tome-graph-container">
                <canvas id="tome-chart-${tome.id}" class="scaling-chart"></canvas>
            </div>
        `;

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${tome.name}</div>
                    <span class="tier-label">${tome.tier} Tier · Priority ${tome.priority}</span>
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="tomes" data-id="${tome.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${tome.stat_affected}: ${tome.value_per_level}</div>
            <div class="item-description">${tome.description}</div>
            ${graphHtml}
            <button class="view-details-btn" data-type="tome" data-id="${tome.id}">View Details</button>
        `;

        container.appendChild(card);
    });

    // Bug fix: Use requestAnimationFrame instead of setTimeout for more reliable chart initialization
    requestAnimationFrame(async () => {
        try {
            // Dynamically import chart functions to enable code splitting
            const { initializeTomeCharts } = await import('./charts.js');
            initializeTomeCharts();
        } catch (err) {
            console.warn('Failed to initialize tome charts:', err);
        }
    });
}

/**
 * Render characters grid
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
                    <div class="item-name">${char.name}</div>
                    ${generateTierLabel(char.tier)}
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="characters" data-id="${char.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${char.passive_ability}</div>
            <div class="item-description">${char.passive_description}</div>
            <div class="item-meta">
                <span class="meta-tag">${char.starting_weapon}</span>
                <span class="meta-tag">${char.playstyle}</span>
            </div>
            <button class="view-details-btn" data-type="character" data-id="${char.id}">View Details</button>
        `;

        container.appendChild(card);
    });
}

/**
 * Render shrines grid
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

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'item-card shrine-card';
        card.dataset.entityType = 'shrine';
        card.dataset.entityId = shrine.id;

        const isFav = typeof isFavorite === 'function' ? isFavorite('shrines', shrine.id) : false;

        card.innerHTML = `
            <div class="item-header">
                <span class="shrine-icon-large">${shrine.icon}</span>
                <div class="item-title">
                    <div class="item-name">${shrine.name}</div>
                    <span class="tier-label">${shrine.type.replace('_', ' ')}</span>
                </div>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-tab="shrines" data-id="${shrine.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="item-effect">${shrine.description}</div>
            <div class="item-description">${shrine.reward}</div>
            <div class="item-meta">
                ${shrine.reusable ? '<span class="meta-tag">Reusable</span>' : '<span class="meta-tag">One-time</span>'}
            </div>
            <button class="view-details-btn" data-type="shrine" data-id="${shrine.id}">View Details</button>
        `;

        container.appendChild(card);
    });
}

// ========================================
// Expose to global scope
// ========================================
