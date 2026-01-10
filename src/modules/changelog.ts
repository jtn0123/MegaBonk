// ========================================
// MegaBonk Changelog Module
// ========================================

import { allData } from './data-service.ts';
import { safeGetElementById, escapeHtml, isValidExternalUrl, generateEmptyState } from './utils.ts';
import type { ChangelogPatch, Entity } from '../types/index.js';

// ========================================
// Type Definitions
// ========================================

/**
 * Entity type for changelog links (singular form)
 */
type ChangelogEntityType = 'item' | 'weapon' | 'tome' | 'character' | 'shrine';

/**
 * Change entry with optional change_type
 */
interface ChangeEntry {
    text: string;
    change_type?: 'buff' | 'nerf' | 'fix' | string;
}

/**
 * Categories object from patch
 */
interface ChangeCategories {
    balance?: ChangeEntry[];
    new_content?: ChangeEntry[];
    bug_fixes?: ChangeEntry[];
    removed?: ChangeEntry[];
    other?: ChangeEntry[];
    [key: string]: ChangeEntry[] | undefined;
}

/**
 * Extended patch with categories
 */
interface ExtendedPatch extends ChangelogPatch {
    categories?: ChangeCategories;
    raw_notes?: string;
    steam_url?: string;
    summary?: string;
}

// ========================================
// Entity Link Parsing
// ========================================

/**
 * Find an entity in the loaded data by type and ID
 * @param type - Entity type (item, weapon, tome, character, shrine)
 * @param id - Entity ID
 * @returns Found entity or null
 */
export function findEntityInData(type: ChangelogEntityType, id: string): Entity | null {
    switch (type) {
        case 'item':
            return (allData.items?.items?.find(e => e.id === id) as Entity | undefined) || null;
        case 'weapon':
            return (allData.weapons?.weapons?.find(e => e.id === id) as Entity | undefined) || null;
        case 'tome':
            return (allData.tomes?.tomes?.find(e => e.id === id) as Entity | undefined) || null;
        case 'character':
            return (allData.characters?.characters?.find(e => e.id === id) as Entity | undefined) || null;
        case 'shrine':
            return (allData.shrines?.shrines?.find(e => e.id === id) as Entity | undefined) || null;
        default:
            return null;
    }
}

/**
 * Parse changelog text and convert entity links to clickable HTML
 * Markup format: [[type:id|Display Text]]
 * @param text - Text with [[type:id|label]] markup
 * @returns HTML with clickable entity links
 */
export function parseChangelogLinks(text: string): string {
    if (!text) return '';

    // Pattern: [[type:id|Display Text]]
    const linkPattern = /\[\[(\w+):(\w+)\|([^\]]+)\]\]/g;

    return text.replace(linkPattern, (_match: string, type: string, id: string, label: string): string => {
        // Validate entity type
        const validTypes: ChangelogEntityType[] = ['item', 'weapon', 'tome', 'character', 'shrine'];
        if (!validTypes.includes(type as ChangelogEntityType)) {
            return label; // Return plain text if invalid type
        }

        // Verify entity exists in loaded data
        const entity = findEntityInData(type as ChangelogEntityType, id);
        if (!entity) {
            return escapeHtml(label); // Return escaped plain text if entity not found
        }

        // Bug fix: Escape all user-provided content to prevent XSS
        const safeType = escapeHtml(type);
        const safeId = escapeHtml(id);
        const safeLabel = escapeHtml(label);
        return `<a href="#" class="entity-link"
                   data-entity-type="${safeType}"
                   data-entity-id="${safeId}"
                   title="View ${safeLabel}">${safeLabel}</a>`;
    });
}

// ========================================
// Rendering Helpers
// ========================================

/**
 * Format category name for display
 * @param category - Category key
 * @returns Formatted display name
 */
export function formatCategoryName(category: string): string {
    const names: Record<string, string> = {
        balance: 'Balance Changes',
        new_content: 'New Content',
        bug_fixes: 'Bug Fixes',
        removed: 'Removed',
        other: 'Other Changes',
    };
    return names[category] || category;
}

/**
 * Format date string for display
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns Formatted date
 */
export function formatChangelogDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // Bug fix #6: Validate date is valid before formatting
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Render sections for each category of changes
 * @param categories - Categories object from patch
 * @param rawNotes - Fallback raw notes if categories are empty
 * @returns HTML string for all sections
 */
export function renderChangesSections(categories: ChangeCategories | undefined, rawNotes: string | undefined): string {
    if (!categories) {
        // Fallback to raw notes if no categories
        if (rawNotes) {
            return `<div class="changelog-raw-notes">${escapeHtml(rawNotes)}</div>`;
        }
        return '';
    }

    const order = ['new_content', 'balance', 'bug_fixes', 'removed', 'other'];

    const sectionsHtml = order
        .map(cat => {
            const changes = categories[cat];
            if (!changes || changes.length === 0) return '';

            const items = changes
                .map(
                    change => `
            <div class="changelog-item ${change.change_type || ''}">
                ${parseChangelogLinks(change.text)}
            </div>
        `
                )
                .join('');

            return `
            <div class="changelog-section">
                <div class="changelog-section-title">${formatCategoryName(cat)}</div>
                ${items}
            </div>
        `;
        })
        .join('');

    // If no categorized content, show raw notes as fallback
    if (!sectionsHtml.trim() && rawNotes) {
        return `<div class="changelog-raw-notes">${escapeHtml(rawNotes)}</div>`;
    }

    return sectionsHtml;
}

// ========================================
// Main Renderer
// ========================================

/**
 * Render changelog entries
 * @param patches - Array of patch objects
 */
export function renderChangelog(patches: ExtendedPatch[]): void {
    const container = safeGetElementById('changelogContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!patches || patches.length === 0) {
        container.innerHTML = generateEmptyState('📋', 'Changelog Entries');
        return;
    }

    patches.forEach(patch => {
        const entry = document.createElement('article');
        entry.className = 'changelog-entry';
        entry.dataset.patchId = patch.id;

        // Count changes per category
        const categoryCounts = Object.entries(patch.categories || {})
            .filter(([_, changes]) => changes && changes.length > 0)
            .map(([cat, changes]) => ({ cat, count: changes!.length }));

        const categoryPills = categoryCounts
            .map(
                ({ cat, count }) =>
                    `<span class="category-pill ${cat}">${formatCategoryName(cat).split(' ')[0]} (${count})</span>`
            )
            .join('');

        entry.innerHTML = `
            <div class="changelog-header">
                <span class="changelog-version">v${escapeHtml(patch.version)}</span>
                <h3 class="changelog-title">${escapeHtml(patch.title)}</h3>
                <span class="changelog-date">${formatChangelogDate(patch.date)}</span>
                ${
                    patch.steam_url && isValidExternalUrl(patch.steam_url)
                        ? `
                    <a href="${escapeHtml(patch.steam_url)}" target="_blank" rel="noopener" class="changelog-steam-link">
                        🔗 Steam
                    </a>
                `
                        : ''
                }
            </div>
            <p class="changelog-summary">${escapeHtml(patch.summary || '')}</p>
            <div class="changelog-categories">${categoryPills}</div>
            <div class="changelog-changes" id="changes-${patch.id}">
                ${renderChangesSections(patch.categories, patch.raw_notes)}
            </div>
            <button class="changelog-expand-btn" data-target="changes-${patch.id}"
                    aria-expanded="false" aria-controls="changes-${patch.id}">
                Show Details
            </button>
        `;

        container.appendChild(entry);
    });

    // Event delegation for expand buttons
    container.removeEventListener('click', handleExpandClick); // Remove any existing listener
    container.addEventListener('click', handleExpandClick);
}

/**
 * Handle expand button clicks via event delegation
 * @param e - Click event
 */
export function handleExpandClick(e: Event): void {
    const button = (e.target as HTMLElement).closest('.changelog-expand-btn') as HTMLButtonElement | null;
    if (button) {
        toggleChangelogExpand(button);
    }
}

// ========================================
// Interactions
// ========================================

/**
 * Toggle changelog expand/collapse
 * @param button - The expand button clicked
 */
export function toggleChangelogExpand(button: HTMLButtonElement): void {
    const targetId = button.dataset.target;
    if (!targetId) return;

    const target = safeGetElementById(targetId);
    if (!target) return;

    const isExpanded = target.classList.contains('expanded');

    if (isExpanded) {
        target.classList.remove('expanded');
        button.textContent = 'Show Details';
        // Bug fix: Update aria-expanded for screen readers
        button.setAttribute('aria-expanded', 'false');
    } else {
        target.classList.add('expanded');
        button.textContent = 'Hide Details';
        button.setAttribute('aria-expanded', 'true');
    }
}

/**
 * Update changelog stats panel
 * @param patches - Filtered patches array
 */
export function updateChangelogStats(patches: ExtendedPatch[]): void {
    const statsPanel = safeGetElementById('stats-summary');
    if (!statsPanel) return;

    const totalPatches = allData.changelog?.patches?.length || 0;
    const showingPatches = patches.length;

    // Count total changes across categories
    let totalChanges = 0;
    let buffs = 0;
    let nerfs = 0;
    let _fixes = 0; // Counted but not displayed (reserved for future use)

    patches.forEach(patch => {
        Object.values(patch.categories || {}).forEach(changes => {
            if (!changes) return;
            changes.forEach(change => {
                totalChanges++;
                if (change.change_type === 'buff') buffs++;
                if (change.change_type === 'nerf') nerfs++;
                if (change.change_type === 'fix') _fixes++;
            });
        });
    });

    statsPanel.innerHTML = `
        <h2>📊 Changelog Stats</h2>
        <div class="stats-grid">
            <div class="stat-item"><span class="stat-label">Total Patches:</span><span class="stat-value">${totalPatches}</span></div>
            <div class="stat-item"><span class="stat-label">Showing:</span><span class="stat-value">${showingPatches}</span></div>
            <div class="stat-item"><span class="stat-label">Total Changes:</span><span class="stat-value">${totalChanges}</span></div>
            <div class="stat-item"><span class="stat-label">Buffs / Nerfs:</span><span class="stat-value">${buffs} / ${nerfs}</span></div>
        </div>
    `;
}

// ========================================
// Exported functions:
// - findEntityInData(type, id)
// - parseChangelogLinks(text)
// - formatCategoryName(category)
// - formatChangelogDate(dateStr)
// - renderChangesSections(categories, rawNotes)
// - renderChangelog(patches)
// - handleExpandClick(e)
// - toggleChangelogExpand(button)
// - updateChangelogStats(patches)
// ========================================
