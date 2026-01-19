// ========================================
// MegaBonk Skeleton Loader Module
// ========================================
// Provides skeleton loading states for improved perceived performance

import { safeGetElementById } from './utils.ts';

// ========================================
// Constants
// ========================================

const DEFAULT_SKELETON_COUNT = 6;

// ========================================
// Skeleton Templates
// ========================================

/**
 * Generate a skeleton card HTML
 * @param includeGraph - Whether to include a graph skeleton
 * @returns Skeleton card HTML string
 */
function generateSkeletonCard(includeGraph: boolean = false): string {
    const graphHtml = includeGraph
        ? `<div class="skeleton-element" style="height: 120px; margin-top: 0.5rem;"></div>`
        : '';

    return `
        <div class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton-element skeleton-image"></div>
                <div class="skeleton-title">
                    <div class="skeleton-element skeleton-name"></div>
                    <div class="skeleton-element skeleton-tier"></div>
                </div>
            </div>
            <div class="skeleton-element skeleton-text"></div>
            <div class="skeleton-element skeleton-text short"></div>
            <div class="skeleton-meta">
                <div class="skeleton-element skeleton-tag"></div>
                <div class="skeleton-element skeleton-tag"></div>
            </div>
            ${graphHtml}
            <div class="skeleton-element skeleton-button"></div>
        </div>
    `;
}

// ========================================
// Skeleton Management
// ========================================

/**
 * Show skeleton loading state in a container
 * @param containerId - ID of the container element
 * @param count - Number of skeleton cards to show
 * @param includeGraphs - Whether skeletons should include graph placeholders
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

    // Generate skeleton cards
    const skeletons = Array(count)
        .fill(null)
        .map(() => generateSkeletonCard(includeGraphs))
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
 * @param tabName - Name of the tab
 */
export function showTabSkeleton(tabName: string): void {
    const containerMap: Record<string, { id: string; count: number; graphs: boolean }> = {
        items: { id: 'itemsContainer', count: 8, graphs: true },
        weapons: { id: 'weaponsContainer', count: 6, graphs: false },
        tomes: { id: 'tomesContainer', count: 6, graphs: true },
        characters: { id: 'charactersContainer', count: 6, graphs: false },
        shrines: { id: 'shrinesContainer', count: 4, graphs: false },
    };

    const config = containerMap[tabName];
    if (config) {
        showSkeletonLoading(config.id, config.count, config.graphs);
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
        hideSkeletonLoading,
        showTabSkeleton,
        hideTabSkeleton,
    });
}
