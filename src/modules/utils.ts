// ========================================
// MegaBonk Utilities Module
// ========================================

import { TIER_ORDER, RARITY_ORDER } from './constants.ts';
import type { Entity, SortBy, Tier, Rarity, EntityType } from '../types/index.ts';

// ========================================
// Null-Safe DOM Helpers
// ========================================

/**
 * Safely get element by ID with optional fallback
 */
export function safeGetElementById<T = HTMLElement>(id: string, fallback: T | null = null): HTMLElement | T | null {
    return document.getElementById(id) || fallback;
}

/**
 * Safely query selector with optional fallback
 */
export function safeQuerySelector<T = Element>(
    selector: string,
    context: ParentNode = document,
    fallback: T | null = null
): Element | T | null {
    return context.querySelector(selector) || fallback;
}

/**
 * Safely query selector all
 */
export function safeQuerySelectorAll(selector: string, context: ParentNode = document): NodeListOf<Element> {
    return context.querySelectorAll(selector);
}

/**
 * Safely set element value
 */
export function safeSetValue(id: string, value: string | number): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = String(value);
}

/**
 * Safely set element innerHTML
 * @deprecated Used only in tests — not called from production code
 */
export function safeSetHTML(id: string, html: string): void {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ========================================
// Entity Image Generation
// ========================================

/**
 * Generate responsive image HTML with WebP support, fallbacks, and blur-up loading
 * Uses <picture> element for optimal format delivery
 * Implements blur-up pattern for improved perceived performance:
 * - Image starts blurred via CSS filter
 * - When image loads, blur fades out smoothly
 * - Uses loading="lazy" for below-the-fold images
 */
export function generateResponsiveImage(
    imagePath: string,
    altText: string,
    className: string = 'entity-image'
): string {
    if (!imagePath) return '';

    // Convert .png/.jpg to .webp path
    const webpPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const escapedAlt = escapeHtml(altText);

    // Blur-up image container with CSS blur transition
    // - blur-up-image class adds initial blur + transition
    // - data-loaded attribute is added by JS when image loads
    // - data-fallback for error handling
    return `<picture class="blur-up-container">
        <source srcset="${webpPath}" type="image/webp">
        <img src="${imagePath}" alt="${escapedAlt}" class="${className} blur-up-image" data-fallback="true" data-blur-up="true" loading="lazy">
    </picture>`;
}

// Bug fix: Track if image handlers are already attached to prevent memory leaks
let imageFallbackHandlerAttached = false;
let imageLoadHandlerAttached = false;

/**
 * Setup global image error handler for CSP compliance
 * Should be called once on page load to handle images with data-fallback attribute
 * Bug fix: Prevents duplicate attachment if called multiple times
 */
export function setupImageFallbackHandler(): void {
    // Guard against duplicate attachment
    if (imageFallbackHandlerAttached) {
        return;
    }
    imageFallbackHandlerAttached = true;

    document.addEventListener(
        'error',
        (e: Event) => {
            const target = e.target;
            // Type guard to ensure target is an image element
            if (target instanceof HTMLImageElement && target.dataset.fallback === 'true') {
                target.style.display = 'none';
            }
        },
        true
    ); // Use capture phase to catch errors on images
}

/**
 * Setup global image load handler for blur-up effect
 * When images with data-blur-up load, removes blur by adding loaded class
 * Should be called once on page load
 */
/**
 * Process blur-up images that have finished loading.
 * Call this after any DOM update that may add new images (tab switches, filter results, modal opens).
 */
export function processBlurUpImages(): void {
    document.querySelectorAll('img[data-blur-up="true"]').forEach(img => {
        if (img instanceof HTMLImageElement && img.complete && img.naturalHeight > 0) {
            img.classList.add('blur-up-loaded');
        }
    });
}

export function setupBlurUpHandler(): void {
    // Guard against duplicate attachment
    if (imageLoadHandlerAttached) {
        return;
    }
    imageLoadHandlerAttached = true;

    // Initial pass for cached images
    processBlurUpImages();

    // Listen for new image loads (use capture to catch all)
    document.addEventListener(
        'load',
        (e: Event) => {
            const target = e.target;
            if (target instanceof HTMLImageElement && target.dataset.blurUp === 'true') {
                // Small delay to ensure image is painted before removing blur
                requestAnimationFrame(() => {
                    target.classList.add('blur-up-loaded');
                });
            }
        },
        true
    ); // Use capture phase to catch load events on images
}

/**
 * Generate image HTML for an entity (item, weapon, character, tome)
 */
export function generateEntityImage(
    entity: Entity | null | undefined,
    altText: string,
    className: string = 'entity-image'
): string {
    if (!entity || !entity.image) return '';
    return generateResponsiveImage(entity.image, altText, className);
}

/**
 * Generate modal image HTML
 * Accepts any object with an optional image property for flexibility with modal-specific types
 */
export function generateModalImage(
    entity: { image?: string } | null | undefined,
    altText: string,
    type: string
): string {
    if (!entity || !entity.image) return '';
    return generateResponsiveImage(entity.image, altText, `modal-${type}-image`);
}

// ========================================
// Empty State Generation
// ========================================

/**
 * Generate empty state HTML for when no results are found
 */
export function generateEmptyState(icon: string, entityType: string): string {
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>No ${entityType} Found</h3>
            <p>Try adjusting your search or filter criteria.</p>
            <button class="btn-secondary" data-action="clear-filters">Clear Filters</button>
        </div>
    `;
}

// ========================================
// Sorting Utilities
// ========================================

/**
 * Type guard to check if object has a name property
 */
function hasName(obj: unknown): obj is { name: string } {
    return typeof obj === 'object' && obj !== null && 'name' in obj;
}

/**
 * Type guard to check if object has a tier property
 */
function hasTier(obj: unknown): obj is { tier: Tier } {
    return typeof obj === 'object' && obj !== null && 'tier' in obj;
}

/**
 * Type guard to check if object has a rarity property
 */
function hasRarity(obj: unknown): obj is { rarity: Rarity } {
    return typeof obj === 'object' && obj !== null && 'rarity' in obj;
}

/**
 * Sort data array by specified field
 * @param data - Array to sort
 * @param sortBy - Field to sort by ('name', 'tier', 'rarity')
 * @returns New sorted array (does not mutate the original)
 */
export function sortData<T extends Entity[]>(data: T, sortBy: SortBy): T {
    // Return a shallow copy to avoid mutating the input array
    if (sortBy === 'name') {
        return [...data].sort((a, b) => {
            const aName = hasName(a) ? a.name : '';
            const bName = hasName(b) ? b.name : '';
            return aName.localeCompare(bName);
        }) as T;
    } else if (sortBy === 'tier') {
        return [...data].sort((a, b) => {
            const aTier = hasTier(a) ? a.tier : undefined;
            const bTier = hasTier(b) ? b.tier : undefined;
            return (TIER_ORDER[aTier as Tier] ?? 99) - (TIER_ORDER[bTier as Tier] ?? 99);
        }) as T;
    } else if (sortBy === 'rarity') {
        return [...data].sort((a, b) => {
            const aRarity = hasRarity(a) ? a.rarity : undefined;
            const bRarity = hasRarity(b) ? b.rarity : undefined;
            return (RARITY_ORDER[aRarity as Rarity] ?? 99) - (RARITY_ORDER[bRarity as Rarity] ?? 99);
        }) as T;
    }
    return [...data] as T;
}

// ========================================
// Text Utilities
// ========================================

/**
 * Escape HTML special characters for use in data attributes
 */
export function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;');
}

/**
 * Truncate text result
 */
export interface TruncateResult {
    html: string;
    needsExpand: boolean;
    fullText: string;
}

/**
 * Truncate text with optional expand functionality data
 */
export function truncateText(text: string | null | undefined, maxLength: number = 120): TruncateResult {
    if (!text || text.length <= maxLength) {
        return { html: text || '', needsExpand: false, fullText: text || '' };
    }
    return {
        html: text.substring(0, maxLength) + '...',
        needsExpand: true,
        fullText: text,
    };
}

/**
 * Generate expandable text HTML
 */
/**
 * Generate expandable text HTML
 * @deprecated Used only in tests — not called from production code
 */
export function generateExpandableText(text: string, maxLength: number = 120): string {
    const { html, needsExpand, fullText } = truncateText(text, maxLength);

    if (!needsExpand) {
        return `<div class="item-description">${escapeHtml(html)}</div>`;
    }

    return `
        <div class="item-description expandable-text"
             data-full-text="${escapeHtml(fullText)}"
             data-truncated="true"
             data-action="toggle-text-expand">
            ${escapeHtml(html)}
            <span class="expand-indicator">Click to expand</span>
        </div>
    `;
}

// ========================================
// Badge/Tag Generation
// ========================================

/**
 * Generate tier label HTML
 */
export function generateTierLabel(tier: Tier): string {
    return `<span class="tier-label">${tier} Tier</span>`;
}

/**
 * Generate badge HTML
 * @deprecated Used only in tests — not called from production code
 */
export function generateBadge(text: string, className: string = ''): string {
    return `<span class="badge ${className}">${text}</span>`;
}

/**
 * Generate meta tags from array
 * Bug fix: Escape tag content to prevent XSS
 */
export function generateMetaTags(tags: string[] | null | undefined, limit: number = 0): string {
    if (!tags || !tags.length) return '';
    const displayTags = limit > 0 ? tags.slice(0, limit) : tags;
    return displayTags.map(tag => `<span class="meta-tag">${escapeHtml(tag)}</span>`).join(' ');
}

// ========================================
// Data Lookup Utilities
// ========================================

/**
 * Find entity by ID in a data collection
 * @deprecated Used only in tests — not called from production code
 */
export function findEntityById<T = Entity>(
    dataCollection: Record<string, T[] | undefined> | undefined | null,
    key: EntityType,
    id: string
): T | undefined {
    return dataCollection?.[key]?.find((e: T) => {
        if (typeof e === 'object' && e !== null && 'id' in e) {
            return (e as { id: string }).id === id;
        }
        return false;
    });
}

// ========================================
// URL Validation
// ========================================

/**
 * Validate that a URL is safe for external linking
 * Only allows http:// and https:// protocols
 */
export function isValidExternalUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

// ========================================
// Performance Utilities
// ========================================

/**
 * Interface for debounced functions with cancel capability
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
    (...args: Parameters<T>): void;
    /** Cancel any pending invocation */
    cancel: () => void;
}

/**
 * Create a debounced version of a function
 * Delays execution until after wait milliseconds have elapsed since the last call
 * Returns a function with a .cancel() method to cancel pending invocations
 */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): DebouncedFunction<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const debouncedFn = function (this: unknown, ...args: Parameters<T>): void {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    } as DebouncedFunction<T>;

    debouncedFn.cancel = (): void => {
        clearTimeout(timeoutId);
        timeoutId = undefined;
    };

    return debouncedFn;
}
