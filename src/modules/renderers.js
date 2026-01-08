// ========================================
// MegaBonk Renderers Module
// ========================================

/**
 * Render content for the current tab
 * @param {string} tabName - Tab to render
 */
function renderTabContent(tabName) {
    if (tabName === 'build-planner') {
        renderBuildPlanner();
        return;
    }

    if (tabName === 'calculator') {
        populateCalculatorItems();
        const calcBtn = safeGetElementById('calc-button');
        if (calcBtn) {
            calcBtn.removeEventListener('click', calculateBreakpoint);
            calcBtn.addEventListener('click', calculateBreakpoint);
        }
        return;
    }

    const data = getDataForTab(tabName);
    if (!data) return;

    const filtered = filterData(data, tabName);
    window.filteredData = filtered;

    updateStats(filtered, tabName);

    // Render based on type
    switch (tabName) {
        case 'items': renderItems(filtered); break;
        case 'weapons': renderWeapons(filtered); break;
        case 'tomes': renderTomes(filtered); break;
        case 'characters': renderCharacters(filtered); break;
        case 'shrines': renderShrines(filtered); break;
    }
}

/**
 * Update stats panel
 * @param {Array} filtered - Filtered data
 * @param {string} tabName - Current tab
 */
function updateStats(filtered, tabName) {
    const statsPanel = safeGetElementById('stats-summary');
    if (!statsPanel) return;

    const totalCount = getDataForTab(tabName).length;
    const showingCount = filtered.length;

    if (tabName === 'items') {
        const oneAndDone = filtered.filter(i => i.one_and_done).length;
        const stackWell = filtered.filter(i => i.stacks_well).length;

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
        const categoryName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
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
function renderItems(items) {
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

        const stackIcon = item.one_and_done ? '✓' : (item.stacks_well ? '∞' : '~');
        const stackText = item.one_and_done ? 'One-and-Done' : (item.stacks_well ? 'Stacks Well' : 'Limited');
        const imageHtml = generateEntityImage(item, item.name);

        // Determine if this item should show a scaling graph
        const showGraph = item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat';
        const graphHtml = showGraph ? `
            <div class="item-graph-container">
                <canvas id="chart-${item.id}" class="scaling-chart"></canvas>
            </div>
        ` : '';

        // Handle expandable description
        const { html: descHtml, needsExpand, fullText } = truncateText(item.detailed_description, 120);

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${item.name}</div>
                    ${generateTierLabel(item.tier)}
                </div>
                <label class="compare-checkbox-label" title="Add to comparison">
                    <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${compareItems.includes(item.id) ? 'checked' : ''}>
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

    // Initialize charts after DOM is ready
    setTimeout(() => initializeItemCharts(), 50);
}

/**
 * Render weapons grid
 * @param {Array} weapons - Weapons to render
 */
function renderWeapons(weapons) {
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

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${weapon.name}</div>
                    ${generateTierLabel(weapon.tier)}
                </div>
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
function renderTomes(tomes) {
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

        // Check if we can calculate progression for this tome
        const progression = calculateTomeProgression(tome);
        const graphHtml = progression ? `
            <div class="tome-graph-container">
                <canvas id="tome-chart-${tome.id}" class="scaling-chart"></canvas>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${tome.name}</div>
                    <span class="tier-label">${tome.tier} Tier · Priority ${tome.priority}</span>
                </div>
            </div>
            <div class="item-effect">${tome.stat_affected}: ${tome.value_per_level}</div>
            <div class="item-description">${tome.description}</div>
            ${graphHtml}
            <button class="view-details-btn" data-type="tome" data-id="${tome.id}">View Details</button>
        `;

        container.appendChild(card);
    });

    // Initialize charts after DOM is ready
    setTimeout(() => initializeTomeCharts(), 50);
}

/**
 * Render characters grid
 * @param {Array} characters - Characters to render
 */
function renderCharacters(characters) {
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

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${char.name}</div>
                    ${generateTierLabel(char.tier)}
                </div>
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
function renderShrines(shrines) {
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

        card.innerHTML = `
            <div class="item-header">
                <span class="shrine-icon-large">${shrine.icon}</span>
                <div class="item-title">
                    <div class="item-name">${shrine.name}</div>
                    <span class="tier-label">${shrine.type.replace('_', ' ')}</span>
                </div>
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

window.renderTabContent = renderTabContent;
window.updateStats = updateStats;
window.renderItems = renderItems;
window.renderWeapons = renderWeapons;
window.renderTomes = renderTomes;
window.renderCharacters = renderCharacters;
window.renderShrines = renderShrines;
