// ========================================
// Recently Viewed Module
// ========================================
// Tracks and displays recently viewed items/entities
// ========================================

import { allData } from './data-service.ts';
import { logger } from './logger.ts';
import { escapeHtml, generateEntityImage } from './utils.ts';
import { MAX_RECENT_ITEMS } from './constants.ts';
import type { EntityType, Entity } from '../types/index.ts';
import type { Item, Weapon, Tome, Character, Shrine } from '../types/index.ts';

// ========================================
// Types
// ========================================

interface RecentlyViewedEntry {
    type: EntityType;
    id: string;
    timestamp: number;
}

// ========================================
// Constants
// ========================================

const STORAGE_KEY = 'megabonk-recently-viewed';
// MAX_RECENT_ITEMS imported from constants.ts
const TABS_WITH_RECENT: EntityType[] = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

// ========================================
// State
// ========================================

let recentlyViewed: RecentlyViewedEntry[] = [];

// ========================================
// Storage Operations
// ========================================

/**
 * Load recently viewed items from localStorage
 */
export function loadRecentlyViewed(): void {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            recentlyViewed = JSON.parse(stored);
            // Clean up old entries (older than 7 days)
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            recentlyViewed = recentlyViewed.filter(entry => entry.timestamp > weekAgo);
            saveRecentlyViewed();
        }
    } catch (error) {
        logger.warn({
            operation: 'recently-viewed.load',
            error: { name: 'StorageError', message: 'Failed to load recently viewed', module: 'recently-viewed' },
        });
        recentlyViewed = [];
    }
}

/**
 * Save recently viewed items to localStorage
 */
function saveRecentlyViewed(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentlyViewed));
    } catch (error) {
        logger.warn({
            operation: 'recently-viewed.save',
            error: { name: 'StorageError', message: 'Failed to save recently viewed', module: 'recently-viewed' },
        });
    }
}

// ========================================
// Core Functions
// ========================================

/**
 * Add an item to recently viewed
 */
export function addToRecentlyViewed(type: EntityType, id: string): void {
    if (!TABS_WITH_RECENT.includes(type)) return;

    // Remove existing entry for this item if present
    recentlyViewed = recentlyViewed.filter(entry => !(entry.type === type && entry.id === id));

    // Add new entry at the beginning
    recentlyViewed.unshift({
        type,
        id,
        timestamp: Date.now(),
    });

    // Keep only MAX_RECENT_ITEMS
    if (recentlyViewed.length > MAX_RECENT_ITEMS) {
        recentlyViewed = recentlyViewed.slice(0, MAX_RECENT_ITEMS);
    }

    saveRecentlyViewed();
}

/**
 * Get recently viewed items
 */
export function getRecentlyViewed(): RecentlyViewedEntry[] {
    return [...recentlyViewed];
}

/**
 * Get recently viewed items for a specific tab
 */
export function getRecentlyViewedForTab(type: EntityType): RecentlyViewedEntry[] {
    return recentlyViewed.filter(entry => entry.type === type);
}

/**
 * Clear all recently viewed items
 */
export function clearRecentlyViewed(): void {
    recentlyViewed = [];
    saveRecentlyViewed();
}

/**
 * Get entity data for a recently viewed entry
 * Returns null if entity not found or data not loaded
 */
export function getEntityForEntry(entry: RecentlyViewedEntry): Entity | null {
    const { type, id } = entry;

    // Helper to safely find and return entity
    const findEntity = <T extends Entity>(
        collection: T[] | undefined,
        predicate: (item: T) => boolean
    ): Entity | null => {
        if (!collection) return null;
        const found = collection.find(predicate);
        return found ?? null;
    };

    switch (type) {
        case 'items':
            return findEntity(allData.items?.items as Item[] | undefined, (i: Item) => i.id === id);
        case 'weapons':
            return findEntity(allData.weapons?.weapons as Weapon[] | undefined, (w: Weapon) => w.id === id);
        case 'tomes':
            return findEntity(allData.tomes?.tomes as Tome[] | undefined, (t: Tome) => t.id === id);
        case 'characters':
            return findEntity(allData.characters?.characters as Character[] | undefined, (c: Character) => c.id === id);
        case 'shrines':
            return findEntity(allData.shrines?.shrines as Shrine[] | undefined, (s: Shrine) => s.id === id);
        default:
            return null;
    }
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render the recently viewed section
 */
export function renderRecentlyViewedSection(containerSelector: string = '#tab-content'): void {
    // Remove existing section if present
    const existingSection = document.querySelector('.recently-viewed-section');
    if (existingSection) {
        existingSection.remove();
    }

    // Get all recent items (not tab-specific)
    const recent = getRecentlyViewed();
    if (recent.length === 0) return;

    // Get entity data for each entry
    const recentWithData = recent
        .map(entry => ({
            entry,
            entity: getEntityForEntry(entry),
        }))
        .filter(item => item.entity !== null);

    if (recentWithData.length === 0) return;

    // Create section HTML
    const section = document.createElement('div');
    section.className = 'recently-viewed-section';
    section.innerHTML = `
        <div class="recently-viewed-header">
            <h3>🕐 Recently Viewed</h3>
            <button class="clear-recent-btn" aria-label="Clear recently viewed">Clear</button>
        </div>
        <div class="recently-viewed-items">
            ${recentWithData
                .map(({ entry, entity }) => {
                    const name = entity?.name || 'Unknown';
                    const imageHtml = entity ? generateEntityImage(entity, name, 'recent-image') : '';
                    return `
                    <div class="recent-item" data-type="${entry.type}" data-id="${entry.id}" role="button" tabindex="0">
                        ${imageHtml || '<span class="recent-icon">📦</span>'}
                        <span class="recent-name">${escapeHtml(name)}</span>
                    </div>
                `;
                })
                .join('')}
        </div>
    `;

    // Add event listeners
    const clearBtn = section.querySelector('.clear-recent-btn');
    clearBtn?.addEventListener('click', () => {
        clearRecentlyViewed();
        section.remove();
    });

    // Add click handlers for items
    const items = section.querySelectorAll('.recent-item');
    items.forEach(item => {
        const handleClick = () => {
            const type = (item as HTMLElement).dataset.type as EntityType;
            const id = (item as HTMLElement).dataset.id;
            if (type && id) {
                // Trigger modal open
                import('./modal.ts')
                    .then(({ openDetailModal }) => {
                        openDetailModal(type, id);
                    })
                    .catch(err => {
                        logger.warn({
                            operation: 'recently-viewed.open_modal',
                            error: { name: 'ImportError', message: (err as Error).message, module: 'recently-viewed' },
                        });
                    });
            }
        };

        item.addEventListener('click', handleClick);
        item.addEventListener('keypress', e => {
            if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
                handleClick();
            }
        });
    });

    // Insert at the beginning of tab content
    const container = document.querySelector(containerSelector);
    if (container) {
        const firstChild = container.firstElementChild;
        if (firstChild) {
            container.insertBefore(section, firstChild);
        } else {
            container.appendChild(section);
        }
    }
}

// ========================================
// Integration Hook
// ========================================

/**
 * Hook to be called when a modal is opened
 * This integrates with the existing modal system
 */
export function onModalOpened(type: EntityType, id: string): void {
    addToRecentlyViewed(type, id);
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the recently viewed module
 */
export function initRecentlyViewed(): void {
    loadRecentlyViewed();

    logger.info({
        operation: 'recently-viewed.init',
        data: { count: recentlyViewed.length },
    });
}
