// ========================================
// MegaBonk DOM Cache Module
// Caches frequently accessed DOM elements to avoid repeated queries
// ========================================

/**
 * Type for cached DOM elements
 */
type CachedElement = HTMLElement | Element | NodeListOf<Element> | null;

/**
 * DOM element cache with automatic invalidation
 */
class DOMCache {
    private cache: Map<string, CachedElement>;
    private initialized: boolean;

    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    /**
     * Initialize cache with commonly accessed elements
     */
    init(): void {
        if (this.initialized) return;

        // Common elements
        this.cache.set('searchInput', document.getElementById('searchInput'));
        this.cache.set('favoritesOnly', document.getElementById('favoritesOnly'));
        this.cache.set('filters', document.getElementById('filters'));
        this.cache.set('itemCount', document.getElementById('item-count'));
        this.cache.set('mainContent', document.getElementById('main-content'));
        this.cache.set('modalOverlay', document.getElementById('modal-overlay'));
        this.cache.set('compareButton', document.getElementById('compare-button'));
        this.cache.set('compareCount', document.querySelector('.compare-count'));

        // Tab buttons (cache as NodeList)
        this.cache.set('tabButtons', document.querySelectorAll('.tab-btn'));

        // Tab content containers
        this.cache.set('itemsContainer', document.getElementById('itemsContainer'));
        this.cache.set('weaponsContainer', document.getElementById('weaponsContainer'));
        this.cache.set('tomesContainer', document.getElementById('tomesContainer'));
        this.cache.set('charactersContainer', document.getElementById('charactersContainer'));
        this.cache.set('shrinesContainer', document.getElementById('shrinesContainer'));

        this.initialized = true;
    }

    /**
     * Get cached element by key
     * @param key - Cache key
     * @returns Cached element or null
     */
    get(key: string): CachedElement {
        if (!this.initialized) this.init();
        return this.cache.get(key) || null;
    }

    /**
     * Set or update cached element
     * @param key - Cache key
     * @param element - Element to cache
     */
    set(key: string, element: CachedElement): void {
        this.cache.set(key, element);
    }

    /**
     * Invalidate specific cache entry
     * @param key - Cache key to invalidate
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll(): void {
        this.cache.clear();
        this.initialized = false;
    }

    /**
     * Refresh specific cached element
     * @param key - Cache key
     * @param selector - CSS selector or element ID
     * @param isId - Whether selector is an ID (default: true)
     */
    refresh(key: string, selector: string, isId: boolean = true): void {
        const element = isId ? document.getElementById(selector) : document.querySelector(selector);
        if (element) {
            this.cache.set(key, element);
        } else {
            this.cache.delete(key);
        }
    }
}

// Create global DOM cache instance
export const domCache = new DOMCache();

// ========================================
// Convenience Helper Functions
// ========================================

/**
 * Get search input element (cached)
 * @returns HTMLInputElement or null
 */
export function getSearchInput(): HTMLElement | null {
    return domCache.get('searchInput') as HTMLElement | null;
}

/**
 * Get favorites checkbox element (cached)
 * @returns HTMLInputElement or null
 */
export function getFavoritesCheckbox(): HTMLElement | null {
    return domCache.get('favoritesOnly') as HTMLElement | null;
}

/**
 * Get filters container (cached)
 * @returns HTMLElement or null
 */
export function getFiltersContainer(): HTMLElement | null {
    return domCache.get('filters') as HTMLElement | null;
}

/**
 * Get stats summary panel (cached)
 * @returns HTMLElement or null
 */
export function getStatsSummary(): HTMLElement | null {
    return domCache.get('statsSummary') as HTMLElement | null;
}

/**
 * Get all tab buttons (cached NodeList)
 * @returns NodeListOf<Element> or null
 */
export function getTabButtons(): NodeListOf<Element> | null {
    return domCache.get('tabButtons') as NodeListOf<Element> | null;
}

/**
 * Get container for specific tab
 * @param tabName - Tab name (items, weapons, tomes, etc.)
 * @returns HTMLElement or null
 */
export function getTabContainer(tabName: string): HTMLElement | null {
    const key = `${tabName}Container`;
    return domCache.get(key) as HTMLElement | null;
}

/**
 * Get modal overlay (cached)
 * @returns HTMLElement or null
 */
export function getModalOverlay(): HTMLElement | null {
    return domCache.get('modalOverlay') as HTMLElement | null;
}

/**
 * Get compare button (cached)
 * @returns HTMLButtonElement or null
 */
export function getCompareButton(): HTMLElement | null {
    return domCache.get('compareButton') as HTMLElement | null;
}

/**
 * Get filter element by ID (with caching)
 * @param filterId - Filter element ID
 * @returns HTMLElement or null
 */
export function getFilterElement(filterId: string): HTMLElement | null {
    const cached = domCache.get(`filter_${filterId}`);
    if (cached) return cached as HTMLElement | null;

    const element = document.getElementById(filterId);
    if (element) {
        domCache.set(`filter_${filterId}`, element);
    }
    return element;
}

/**
 * Invalidate cache when DOM structure changes
 * Call this after dynamically adding/removing elements
 */
export function invalidateDOMCache(): void {
    domCache.invalidateAll();
}

/**
 * Refresh cache after filter updates
 * Filters are recreated when switching tabs
 */
export function refreshFilterCache(): void {
    // Invalidate filter-related cache entries
    domCache.invalidate('rarityFilter');
    domCache.invalidate('tierFilter');
    domCache.invalidate('stackingFilter');
    domCache.invalidate('sortBy');
    domCache.invalidate('favoritesOnly');
}
