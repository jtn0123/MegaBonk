// ========================================
// MegaBonk DOM Cache Module
// Caches frequently accessed DOM elements to avoid repeated queries
// ========================================

/**
 * DOM element cache with automatic invalidation
 */
class DOMCache {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    /**
     * Initialize cache with commonly accessed elements
     */
    init() {
        if (this.initialized) return;

        // Common elements
        this.cache.set('searchInput', document.getElementById('searchInput'));
        this.cache.set('favoritesOnly', document.getElementById('favoritesOnly'));
        this.cache.set('filters', document.getElementById('filters'));
        this.cache.set('statsSum mary', document.getElementById('stats-summary'));
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
        console.log('[DOM Cache] Initialized with', this.cache.size, 'cached elements');
    }

    /**
     * Get cached element by key
     * @param {string} key - Cache key
     * @returns {HTMLElement|NodeList|null}
     */
    get(key) {
        if (!this.initialized) this.init();
        return this.cache.get(key) || null;
    }

    /**
     * Set or update cached element
     * @param {string} key - Cache key
     * @param {HTMLElement|NodeList} element - Element to cache
     */
    set(key, element) {
        this.cache.set(key, element);
    }

    /**
     * Invalidate specific cache entry
     * @param {string} key - Cache key to invalidate
     */
    invalidate(key) {
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        this.cache.clear();
        this.initialized = false;
    }

    /**
     * Refresh specific cached element
     * @param {string} key - Cache key
     * @param {string} selector - CSS selector or element ID
     * @param {boolean} isId - Whether selector is an ID (default: true)
     */
    refresh(key, selector, isId = true) {
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
 * @returns {HTMLInputElement|null}
 */
export function getSearchInput() {
    return domCache.get('searchInput');
}

/**
 * Get favorites checkbox element (cached)
 * @returns {HTMLInputElement|null}
 */
export function getFavoritesCheckbox() {
    return domCache.get('favoritesOnly');
}

/**
 * Get filters container (cached)
 * @returns {HTMLElement|null}
 */
export function getFiltersContainer() {
    return domCache.get('filters');
}

/**
 * Get stats summary panel (cached)
 * @returns {HTMLElement|null}
 */
export function getStatsSummary() {
    return domCache.get('statsSummary');
}

/**
 * Get all tab buttons (cached NodeList)
 * @returns {NodeList|null}
 */
export function getTabButtons() {
    return domCache.get('tabButtons');
}

/**
 * Get container for specific tab
 * @param {string} tabName - Tab name (items, weapons, tomes, etc.)
 * @returns {HTMLElement|null}
 */
export function getTabContainer(tabName) {
    const key = `${tabName}Container`;
    return domCache.get(key);
}

/**
 * Get modal overlay (cached)
 * @returns {HTMLElement|null}
 */
export function getModalOverlay() {
    return domCache.get('modalOverlay');
}

/**
 * Get compare button (cached)
 * @returns {HTMLButtonElement|null}
 */
export function getCompareButton() {
    return domCache.get('compareButton');
}

/**
 * Get filter element by ID (with caching)
 * @param {string} filterId - Filter element ID
 * @returns {HTMLElement|null}
 */
export function getFilterElement(filterId) {
    const cached = domCache.get(`filter_${filterId}`);
    if (cached) return cached;

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
export function invalidateDOMCache() {
    domCache.invalidateAll();
    console.log('[DOM Cache] Cache invalidated');
}

/**
 * Refresh cache after filter updates
 * Filters are recreated when switching tabs
 */
export function refreshFilterCache() {
    // Invalidate filter-related cache entries
    domCache.invalidate('rarityFilter');
    domCache.invalidate('tierFilter');
    domCache.invalidate('stackingFilter');
    domCache.invalidate('sortBy');
    domCache.invalidate('favoritesOnly');

    console.log('[DOM Cache] Filter cache refreshed');
}
