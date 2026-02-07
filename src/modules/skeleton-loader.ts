// ========================================
// MegaBonk Skeleton Loader Module
// ========================================
// Provides skeleton loading states for improved perceived performance
// Skeletons match the actual card layouts for seamless transitions

import { safeGetElementById } from './utils.ts';

// ========================================
// Constants
// ========================================

const DEFAULT_SKELETON_COUNT = 6;

// ========================================
// Skeleton Templates
// ========================================

/**
 * Generate a skeleton card for items/weapons/tomes (with optional graph)
 * Matches the .item-card layout from cards.css
 */
function generateItemSkeletonCard(includeGraph: boolean = false): string {
    const graphHtml = includeGraph
        ? `<div class="skeleton-graph">
               <div class="skeleton-element" style="height: 150px; margin-top: 1rem; border-radius: 6px;"></div>
           </div>`
        : '';

    return `
        <div class="skeleton-card skeleton-card--item">
            <!-- Header: image + title area -->
            <div class="skeleton-header">
                <div class="skeleton-element skeleton-image"></div>
                <div class="skeleton-title">
                    <div class="skeleton-element skeleton-name"></div>
                    <div class="skeleton-badges">
                        <div class="skeleton-element skeleton-badge"></div>
                        <div class="skeleton-element skeleton-badge skeleton-badge--small"></div>
                    </div>
                </div>
            </div>
            
            <!-- Effect text (main content) -->
            <div class="skeleton-element skeleton-text skeleton-effect"></div>
            <div class="skeleton-element skeleton-text skeleton-effect short"></div>
            
            <!-- Description -->
            <div class="skeleton-element skeleton-text skeleton-description"></div>
            
            <!-- Meta tags -->
            <div class="skeleton-meta">
                <div class="skeleton-element skeleton-tag"></div>
                <div class="skeleton-element skeleton-tag"></div>
                <div class="skeleton-element skeleton-tag skeleton-tag--small"></div>
            </div>
            
            ${graphHtml}
            
            <!-- View details button -->
            <div class="skeleton-element skeleton-button"></div>
        </div>
    `;
}

/**
 * Generate a skeleton card for characters
 * Characters have a different layout with stats display
 */
function generateCharacterSkeletonCard(): string {
    return `
        <div class="skeleton-card skeleton-card--character">
            <!-- Header with larger image -->
            <div class="skeleton-header">
                <div class="skeleton-element skeleton-image skeleton-image--large"></div>
                <div class="skeleton-title">
                    <div class="skeleton-element skeleton-name"></div>
                    <div class="skeleton-element skeleton-subtitle"></div>
                </div>
            </div>
            
            <!-- Stats grid -->
            <div class="skeleton-stats">
                <div class="skeleton-stat-row">
                    <div class="skeleton-element skeleton-stat-label"></div>
                    <div class="skeleton-element skeleton-stat-value"></div>
                </div>
                <div class="skeleton-stat-row">
                    <div class="skeleton-element skeleton-stat-label"></div>
                    <div class="skeleton-element skeleton-stat-value"></div>
                </div>
                <div class="skeleton-stat-row">
                    <div class="skeleton-element skeleton-stat-label"></div>
                    <div class="skeleton-element skeleton-stat-value"></div>
                </div>
            </div>
            
            <!-- Description -->
            <div class="skeleton-element skeleton-text"></div>
            
            <!-- Button -->
            <div class="skeleton-element skeleton-button"></div>
        </div>
    `;
}

/**
 * Generate a skeleton card for shrines
 * Shrines have a simpler layout
 */
function generateShrineSkeletonCard(): string {
    return `
        <div class="skeleton-card skeleton-card--shrine">
            <!-- Header -->
            <div class="skeleton-header skeleton-header--centered">
                <div class="skeleton-element skeleton-image skeleton-image--shrine"></div>
                <div class="skeleton-element skeleton-name skeleton-name--centered"></div>
            </div>
            
            <!-- Effect description -->
            <div class="skeleton-element skeleton-text"></div>
            <div class="skeleton-element skeleton-text short"></div>
            
            <!-- Button -->
            <div class="skeleton-element skeleton-button"></div>
        </div>
    `;
}

/**
 * Generate a skeleton card for weapons
 * Weapons show upgrade paths and different stats
 */
function generateWeaponSkeletonCard(): string {
    return `
        <div class="skeleton-card skeleton-card--weapon">
            <!-- Header -->
            <div class="skeleton-header">
                <div class="skeleton-element skeleton-image"></div>
                <div class="skeleton-title">
                    <div class="skeleton-element skeleton-name"></div>
                    <div class="skeleton-badges">
                        <div class="skeleton-element skeleton-badge"></div>
                    </div>
                </div>
            </div>
            
            <!-- Weapon stats -->
            <div class="skeleton-weapon-stats">
                <div class="skeleton-element skeleton-stat-bar"></div>
                <div class="skeleton-element skeleton-stat-bar skeleton-stat-bar--short"></div>
            </div>
            
            <!-- Description -->
            <div class="skeleton-element skeleton-text"></div>
            <div class="skeleton-element skeleton-text short"></div>
            
            <!-- Meta tags -->
            <div class="skeleton-meta">
                <div class="skeleton-element skeleton-tag"></div>
                <div class="skeleton-element skeleton-tag"></div>
            </div>
            
            <!-- Button -->
            <div class="skeleton-element skeleton-button"></div>
        </div>
    `;
}

/**
 * Get skeleton generator for a specific tab
 */
function getSkeletonGenerator(tabName: string): () => string {
    switch (tabName) {
        case 'items':
            return () => generateItemSkeletonCard(true);
        case 'weapons':
            return generateWeaponSkeletonCard;
        case 'tomes':
            return () => generateItemSkeletonCard(true);
        case 'characters':
            return generateCharacterSkeletonCard;
        case 'shrines':
            return generateShrineSkeletonCard;
        default:
            return () => generateItemSkeletonCard(false);
    }
}

// ========================================
// Skeleton Management
// ========================================

/**
 * Show skeleton loading state in a container
 * @param containerId - ID of the container element
 * @param count - Number of skeleton cards to show
 * @param includeGraphs - Whether skeletons should include graph placeholders (deprecated, use tabName)
 */
export function showSkeletonLoading(
    containerId: string,
    count: number = DEFAULT_SKELETON_COUNT,
    includeGraphs: boolean = false
): void {
    const container = safeGetElementById(containerId);
    if (!container) return;

    // Store original content (if needed for restoration)
    container.dataset.hadContent = container.innerHTML.length > 0 ? 'true' : 'false';

    // Use the includeGraphs parameter for backwards compatibility
    const generateCard = () => generateItemSkeletonCard(includeGraphs);

    // Generate skeleton cards
    const skeletons = Array(count)
        .fill(null)
        .map(() => generateCard())
        .join('');

    container.innerHTML = `<div class="skeleton-container">${skeletons}</div>`;
    container.setAttribute('aria-busy', 'true');
    container.setAttribute('aria-label', 'Loading content');
}

/**
 * Show skeleton loading state with tab-specific cards
 * @param containerId - ID of the container element
 * @param tabName - Name of the tab to generate appropriate skeletons
 * @param count - Number of skeleton cards to show
 */
export function showTabSkeletonLoading(
    containerId: string,
    tabName: string,
    count: number = DEFAULT_SKELETON_COUNT
): void {
    const container = safeGetElementById(containerId);
    if (!container) return;

    container.dataset.hadContent = container.innerHTML.length > 0 ? 'true' : 'false';

    const generateCard = getSkeletonGenerator(tabName);

    const skeletons = Array(count)
        .fill(null)
        .map(() => generateCard())
        .join('');

    container.innerHTML = `<div class="skeleton-container">${skeletons}</div>`;
    container.setAttribute('aria-busy', 'true');
    container.setAttribute('aria-label', 'Loading content');
}

/**
 * Hide skeleton loading state
 * @param containerId - ID of the container element
 */
export function hideSkeletonLoading(containerId: string): void {
    const container = safeGetElementById(containerId);
    if (!container) return;

    // Find and remove skeleton container if present
    const skeletonContainer = container.querySelector('.skeleton-container');
    if (skeletonContainer) {
        skeletonContainer.remove();
    }

    container.removeAttribute('aria-busy');
    container.removeAttribute('aria-label');
}

/**
 * Check if a container is showing skeleton loading
 * @param containerId - ID of the container element
 * @returns True if skeleton is showing
 */
export function isShowingSkeleton(containerId: string): boolean {
    const container = safeGetElementById(containerId);
    if (!container) return false;

    return container.querySelector('.skeleton-container') !== null;
}

/**
 * Show skeleton loading for the current tab
 * Uses tab-specific skeleton layouts
 * @param tabName - Name of the tab
 */
export function showTabSkeleton(tabName: string): void {
    const containerMap: Record<string, { id: string; count: number }> = {
        items: { id: 'itemsContainer', count: 8 },
        weapons: { id: 'weaponsContainer', count: 6 },
        tomes: { id: 'tomesContainer', count: 6 },
        characters: { id: 'charactersContainer', count: 6 },
        shrines: { id: 'shrinesContainer', count: 4 },
    };

    const config = containerMap[tabName];
    if (config) {
        showTabSkeletonLoading(config.id, tabName, config.count);
    }
}

/**
 * Hide skeleton loading for the current tab
 * @param tabName - Name of the tab
 */
export function hideTabSkeleton(tabName: string): void {
    const containerMap: Record<string, string> = {
        items: 'itemsContainer',
        weapons: 'weaponsContainer',
        tomes: 'tomesContainer',
        characters: 'charactersContainer',
        shrines: 'shrinesContainer',
    };

    const containerId = containerMap[tabName];
    if (containerId) {
        hideSkeletonLoading(containerId);
    }
}

// ========================================
// Global Scope Exports (backwards compatibility)
// ========================================

if (typeof window !== 'undefined') {
    Object.assign(window, {
        showSkeletonLoading,
        showTabSkeletonLoading,
        hideSkeletonLoading,
        showTabSkeleton,
        hideTabSkeleton,
    });
}
