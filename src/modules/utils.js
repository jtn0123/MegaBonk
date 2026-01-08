// ========================================
// MegaBonk Utilities Module
// ========================================

// ========================================
// Null-Safe DOM Helpers
// ========================================

/**
 * Safely get element by ID with optional fallback
 * @param {string} id - Element ID
 * @param {*} fallback - Fallback value if element not found
 * @returns {HTMLElement|null} Element or fallback
 */
function safeGetElementById(id, fallback = null) {
    return document.getElementById(id) || fallback;
}

/**
 * Safely query selector with optional fallback
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (defaults to document)
 * @param {*} fallback - Fallback value if element not found
 * @returns {HTMLElement|null} Element or fallback
 */
function safeQuerySelector(selector, context = document, fallback = null) {
    return context.querySelector(selector) || fallback;
}

/**
 * Safely query selector all
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (defaults to document)
 * @returns {NodeList} NodeList (empty if none found)
 */
function safeQuerySelectorAll(selector, context = document) {
    return context.querySelectorAll(selector);
}

/**
 * Safely set element value
 * @param {string} id - Element ID
 * @param {*} value - Value to set
 */
function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

/**
 * Safely set element innerHTML
 * @param {string} id - Element ID
 * @param {string} html - HTML content
 */
function safeSetHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ========================================
// Entity Image Generation
// ========================================

/**
 * Generate image HTML for an entity (item, weapon, character, tome)
 * @param {Object} entity - Entity object with optional image property
 * @param {string} altText - Alt text for the image
 * @param {string} className - CSS class name (default: 'entity-image')
 * @returns {string} HTML string for the image or empty string
 */
function generateEntityImage(entity, altText, className = 'entity-image') {
    if (!entity || !entity.image) return '';
    return `<img src="${entity.image}" alt="${altText}" class="${className}" onerror="this.style.display='none'">`;
}

/**
 * Generate modal image HTML
 * @param {Object} entity - Entity object
 * @param {string} altText - Alt text
 * @param {string} type - Entity type for class naming
 * @returns {string} HTML string
 */
function generateModalImage(entity, altText, type) {
    if (!entity || !entity.image) return '';
    return `<img src="${entity.image}" alt="${altText}" class="modal-${type}-image" onerror="this.style.display='none'">`;
}

// ========================================
// Empty State Generation
// ========================================

/**
 * Generate empty state HTML for when no results are found
 * @param {string} icon - Emoji icon to display
 * @param {string} entityType - Type of entity (Items, Weapons, etc.)
 * @returns {string} HTML string for empty state
 */
function generateEmptyState(icon, entityType) {
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>No ${entityType} Found</h3>
            <p>Try adjusting your search or filter criteria.</p>
            <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
        </div>
    `;
}

// ========================================
// Sorting Utilities
// ========================================

/**
 * Sort data array by specified field
 * @param {Array} data - Array to sort
 * @param {string} sortBy - Field to sort by ('name', 'tier', 'rarity')
 * @returns {Array} Sorted array (mutates original)
 */
function sortData(data, sortBy) {
    if (sortBy === 'name') {
        return data.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'tier') {
        return data.sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
    } else if (sortBy === 'rarity') {
        return data.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99));
    }
    return data;
}

// ========================================
// Text Utilities
// ========================================

/**
 * Escape HTML special characters for use in data attributes
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;');
}

/**
 * Truncate text with optional expand functionality data
 * @param {string} text - Text to potentially truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {Object} {html, needsExpand, fullText}
 */
function truncateText(text, maxLength = 120) {
    if (!text || text.length <= maxLength) {
        return { html: text || '', needsExpand: false, fullText: text || '' };
    }
    return {
        html: text.substring(0, maxLength) + '...',
        needsExpand: true,
        fullText: text
    };
}

/**
 * Generate expandable text HTML
 * @param {string} text - Full text content
 * @param {number} maxLength - Max length before truncating
 * @returns {string} HTML string with expand functionality
 */
function generateExpandableText(text, maxLength = 120) {
    const { html, needsExpand, fullText } = truncateText(text, maxLength);

    if (!needsExpand) {
        return `<div class="item-description">${html}</div>`;
    }

    return `
        <div class="item-description expandable-text"
             data-full-text="${escapeHtml(fullText)}"
             data-truncated="true"
             onclick="toggleTextExpand(this)">
            ${html}
            <span class="expand-indicator">Click to expand</span>
        </div>
    `;
}

// ========================================
// Badge/Tag Generation
// ========================================

/**
 * Generate tier label HTML
 * @param {string} tier - Tier value (SS, S, A, B, C)
 * @returns {string} HTML string
 */
function generateTierLabel(tier) {
    return `<span class="tier-label">${tier} Tier</span>`;
}

/**
 * Generate badge HTML
 * @param {string} text - Badge text
 * @param {string} className - Additional CSS class
 * @returns {string} HTML string
 */
function generateBadge(text, className = '') {
    return `<span class="badge ${className}">${text}</span>`;
}

/**
 * Generate meta tags from array
 * @param {Array} tags - Array of tag strings
 * @param {number} limit - Max number of tags to show
 * @returns {string} HTML string
 */
function generateMetaTags(tags, limit = 0) {
    if (!tags || !tags.length) return '';
    const displayTags = limit > 0 ? tags.slice(0, limit) : tags;
    return displayTags.map(tag => `<span class="meta-tag">${tag}</span>`).join(' ');
}

// ========================================
// Data Lookup Utilities
// ========================================

/**
 * Find entity by ID in a data collection
 * @param {Object} dataCollection - Collection with entities array (e.g., allData.items)
 * @param {string} key - Key for the array (e.g., 'items')
 * @param {string} id - Entity ID to find
 * @returns {Object|undefined} Found entity or undefined
 */
function findEntityById(dataCollection, key, id) {
    return dataCollection?.[key]?.find(e => e.id === id);
}

// ========================================
// Expose to global scope
// ========================================

window.safeGetElementById = safeGetElementById;
window.safeQuerySelector = safeQuerySelector;
window.safeQuerySelectorAll = safeQuerySelectorAll;
window.safeSetValue = safeSetValue;
window.safeSetHTML = safeSetHTML;
window.generateEntityImage = generateEntityImage;
window.generateModalImage = generateModalImage;
window.generateEmptyState = generateEmptyState;
window.sortData = sortData;
window.escapeHtml = escapeHtml;
window.truncateText = truncateText;
window.generateExpandableText = generateExpandableText;
window.generateTierLabel = generateTierLabel;
window.generateBadge = generateBadge;
window.generateMetaTags = generateMetaTags;
window.findEntityById = findEntityById;
