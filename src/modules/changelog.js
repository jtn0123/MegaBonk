// ========================================
// MegaBonk Changelog Module
// ========================================

// ========================================
// Entity Link Parsing
// ========================================

/**
 * Find an entity in the loaded data by type and ID
 * @param {string} type - Entity type (item, weapon, tome, character, shrine)
 * @param {string} id - Entity ID
 * @returns {Object|null} Found entity or null
 */
function findEntityInData(type, id) {
    const dataMap = {
        'item': { collection: allData.items, key: 'items' },
        'weapon': { collection: allData.weapons, key: 'weapons' },
        'tome': { collection: allData.tomes, key: 'tomes' },
        'character': { collection: allData.characters, key: 'characters' },
        'shrine': { collection: allData.shrines, key: 'shrines' }
    };

    const mapping = dataMap[type];
    if (!mapping || !mapping.collection) return null;
    return mapping.collection[mapping.key]?.find(e => e.id === id) || null;
}

/**
 * Parse changelog text and convert entity links to clickable HTML
 * Markup format: [[type:id|Display Text]]
 * @param {string} text - Text with [[type:id|label]] markup
 * @returns {string} HTML with clickable entity links
 */
function parseChangelogLinks(text) {
    if (!text) return '';

    // Pattern: [[type:id|Display Text]]
    const linkPattern = /\[\[(\w+):(\w+)\|([^\]]+)\]\]/g;

    return text.replace(linkPattern, (match, type, id, label) => {
        // Validate entity type
        const validTypes = ['item', 'weapon', 'tome', 'character', 'shrine'];
        if (!validTypes.includes(type)) {
            return label; // Return plain text if invalid type
        }

        // Verify entity exists in loaded data
        const entity = findEntityInData(type, id);
        if (!entity) {
            return label; // Return plain text if entity not found
        }

        return `<a href="#" class="entity-link"
                   data-entity-type="${type}"
                   data-entity-id="${id}"
                   title="View ${label}">${label}</a>`;
    });
}

// ========================================
// Rendering Helpers
// ========================================

/**
 * Format category name for display
 * @param {string} category - Category key
 * @returns {string} Formatted display name
 */
function formatCategoryName(category) {
    const names = {
        'balance': 'Balance Changes',
        'new_content': 'New Content',
        'bug_fixes': 'Bug Fixes',
        'removed': 'Removed',
        'other': 'Other Changes'
    };
    return names[category] || category;
}

/**
 * Format date string for display
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
function formatChangelogDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Render sections for each category of changes
 * @param {Object} categories - Categories object from patch
 * @returns {string} HTML string for all sections
 */
function renderChangesSections(categories) {
    if (!categories) return '';

    const order = ['new_content', 'balance', 'bug_fixes', 'removed', 'other'];

    return order.map(cat => {
        const changes = categories[cat];
        if (!changes || changes.length === 0) return '';

        const items = changes.map(change => `
            <div class="changelog-item ${change.change_type || ''}">
                ${parseChangelogLinks(change.text)}
            </div>
        `).join('');

        return `
            <div class="changelog-section">
                <div class="changelog-section-title">${formatCategoryName(cat)}</div>
                ${items}
            </div>
        `;
    }).join('');
}

// ========================================
// Main Renderer
// ========================================

/**
 * Render changelog entries
 * @param {Array} patches - Array of patch objects
 */
function renderChangelog(patches) {
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
            .map(([cat, changes]) => ({ cat, count: changes.length }));

        const categoryPills = categoryCounts.map(({ cat, count }) =>
            `<span class="category-pill ${cat}">${formatCategoryName(cat).split(' ')[0]} (${count})</span>`
        ).join('');

        entry.innerHTML = `
            <div class="changelog-header">
                <span class="changelog-version">v${escapeHtml(patch.version)}</span>
                <h3 class="changelog-title">${escapeHtml(patch.title)}</h3>
                <span class="changelog-date">${formatChangelogDate(patch.date)}</span>
                ${patch.steam_url ? `
                    <a href="${patch.steam_url}" target="_blank" rel="noopener" class="changelog-steam-link">
                        🔗 Steam
                    </a>
                ` : ''}
            </div>
            <p class="changelog-summary">${escapeHtml(patch.summary)}</p>
            <div class="changelog-categories">${categoryPills}</div>
            <div class="changelog-changes" id="changes-${patch.id}">
                ${renderChangesSections(patch.categories)}
            </div>
            <button class="changelog-expand-btn" data-target="changes-${patch.id}" onclick="toggleChangelogExpand(this)">
                Show Details
            </button>
        `;

        container.appendChild(entry);
    });
}

// ========================================
// Interactions
// ========================================

/**
 * Toggle changelog expand/collapse
 * @param {HTMLElement} button - The expand button clicked
 */
function toggleChangelogExpand(button) {
    const targetId = button.dataset.target;
    const target = safeGetElementById(targetId);

    if (!target) return;

    const isExpanded = target.classList.contains('expanded');

    if (isExpanded) {
        target.classList.remove('expanded');
        button.textContent = 'Show Details';
    } else {
        target.classList.add('expanded');
        button.textContent = 'Hide Details';
    }
}

/**
 * Update changelog stats panel
 * @param {Array} patches - Filtered patches array
 */
function updateChangelogStats(patches) {
    const statsPanel = safeGetElementById('stats-summary');
    if (!statsPanel) return;

    const totalPatches = allData.changelog?.patches?.length || 0;
    const showingPatches = patches.length;

    // Count total changes across categories
    let totalChanges = 0;
    let buffs = 0;
    let nerfs = 0;
    let fixes = 0;

    patches.forEach(patch => {
        Object.values(patch.categories || {}).forEach(changes => {
            if (!changes) return;
            changes.forEach(change => {
                totalChanges++;
                if (change.change_type === 'buff') buffs++;
                if (change.change_type === 'nerf') nerfs++;
                if (change.change_type === 'fix') fixes++;
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
// Expose to global scope
// ========================================

window.findEntityInData = findEntityInData;
window.parseChangelogLinks = parseChangelogLinks;
window.formatCategoryName = formatCategoryName;
window.formatChangelogDate = formatChangelogDate;
window.renderChangelog = renderChangelog;
window.toggleChangelogExpand = toggleChangelogExpand;
window.updateChangelogStats = updateChangelogStats;
