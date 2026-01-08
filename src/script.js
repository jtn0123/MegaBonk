// ========================================
// MegaBonk Complete Guide - Main Script
// ========================================

// Global data storage
let allData = {
    items: null,
    weapons: null,
    tomes: null,
    characters: null,
    shrines: null,
    stats: null
};

let currentTab = 'items';
let filteredData = [];

// Build planner state
let currentBuild = {
    character: null,
    weapon: null,
    tomes: [],
    items: []
};

// Compare mode state
let compareItems = [];

// Chart instances storage (for cleanup)
let chartInstances = {};

// ========================================
// Chart.js Integration
// ========================================

/**
 * Create a scaling chart for an item or tome
 * @param {string} canvasId - The canvas element ID
 * @param {number[]} data - Array of scaling values
 * @param {string} label - Chart label (item/tome name)
 * @param {string} scalingType - Type of scaling for formatting
 * @param {boolean} isModal - If true, creates a larger chart for modals
 * @param {Object} secondaryData - Optional secondary scaling data {stat: string, values: number[]}
 */
function createScalingChart(canvasId, data, label, scalingType = '', isModal = false, secondaryData = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return null;
    }

    // Destroy existing chart if present
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const labels = data.map((_, i) => `${i + 1}`);
    const isPercentage = scalingType.includes('chance') ||
                         scalingType.includes('percentage') ||
                         scalingType.includes('damage') ||
                         scalingType.includes('crit');

    // Build datasets array
    const datasets = [{
        label: label,
        data: data,
        borderColor: '#e94560',
        backgroundColor: 'rgba(233, 69, 96, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: isModal ? 5 : 3,
        pointHoverRadius: isModal ? 8 : 5,
        pointBackgroundColor: '#e94560',
        borderWidth: isModal ? 3 : 2,
        yAxisID: 'y'
    }];

    // Add secondary dataset if provided
    const hasSecondary = secondaryData && secondaryData.values && secondaryData.values.length > 0;
    if (hasSecondary) {
        datasets.push({
            label: secondaryData.stat,
            data: secondaryData.values,
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: isModal ? 5 : 3,
            pointHoverRadius: isModal ? 8 : 5,
            pointBackgroundColor: '#4ecdc4',
            borderWidth: isModal ? 3 : 2,
            yAxisID: 'y2'
        });
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: hasSecondary, labels: { color: '#a0a0a0', font: { size: isModal ? 12 : 9 } } },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#e94560',
                    borderWidth: 1,
                    callbacks: {
                        label: (context) => {
                            const val = context.parsed.y;
                            const datasetLabel = context.dataset.label || '';
                            const suffix = datasetLabel.includes('%') || isPercentage ? '%' : '';
                            return `${datasetLabel}: ${val}${suffix}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: isModal,
                        text: 'Stacks',
                        color: '#a0a0a0',
                        font: { size: isModal ? 14 : 10 }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: '#a0a0a0',
                        font: { size: isModal ? 12 : 9 }
                    }
                },
                y: {
                    position: 'left',
                    title: {
                        display: isModal,
                        text: isPercentage ? '%' : 'Value',
                        color: '#e94560',
                        font: { size: isModal ? 14 : 10 }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: '#e94560',
                        font: { size: isModal ? 12 : 9 },
                        callback: (value) => `${value}${isPercentage ? '%' : ''}`
                    },
                    beginAtZero: true
                },
                y2: {
                    position: 'right',
                    display: hasSecondary,
                    title: {
                        display: isModal && hasSecondary,
                        text: secondaryData?.stat || 'Secondary',
                        color: '#4ecdc4',
                        font: { size: isModal ? 14 : 10 }
                    },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#4ecdc4',
                        font: { size: isModal ? 12 : 9 }
                    }
                }
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

/**
 * Calculate tome progression values for graphing
 * @param {Object} tome - The tome object
 * @param {number} maxLevels - Number of levels to calculate
 * @returns {number[]} Array of progression values
 */
function calculateTomeProgression(tome, maxLevels = 10) {
    const valueStr = tome.value_per_level;
    // Parse numeric value from strings like "+7% crit chance" or "+0.08x (8% damage)"
    const match = valueStr.match(/[+-]?([\d.]+)/);
    if (!match) return null;

    const perLevel = parseFloat(match[1]);
    // Scale appropriately - percentages stay as-is, multipliers get scaled
    const isMultiplier = valueStr.includes('x');
    const isHyperbolic = valueStr.toLowerCase().includes('hyperbolic');

    // Detect which hyperbolic formula to use based on stat type
    const statLower = (tome.stat_affected || '').toLowerCase();
    const isEvasion = statLower.includes('evasion');
    const isArmor = statLower.includes('armor');

    return Array.from({length: maxLevels}, (_, i) => {
        const internalValue = (isMultiplier ? perLevel * 100 : perLevel) * (i + 1);

        if (isHyperbolic && isEvasion) {
            // Evasion formula: actual = internal / (1 + internal)
            // Convert to percentage: internal is in %, so divide by 100 for formula
            const internalDecimal = internalValue / 100;
            const actualEvasion = internalDecimal / (1 + internalDecimal) * 100;
            return Math.round(actualEvasion * 100) / 100;
        } else if (isHyperbolic && isArmor) {
            // Armor formula: actual = internal / (0.75 + internal)
            // Convert to percentage: internal is in %, so divide by 100 for formula
            const internalDecimal = internalValue / 100;
            const actualArmor = internalDecimal / (0.75 + internalDecimal) * 100;
            return Math.round(actualArmor * 100) / 100;
        }

        return Math.round(internalValue * 100) / 100;
    });
}

/**
 * Initialize all item charts after rendering
 */
function initializeItemCharts() {
    const items = allData.items?.items || [];
    items.forEach(item => {
        // Only create charts for items that stack
        if (item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat') {
            const canvasId = `chart-${item.id}`;
            createScalingChart(canvasId, item.scaling_per_stack, item.name, item.scaling_type || '', false, item.secondary_scaling || null);
        }
    });
}

/**
 * Initialize all tome charts after rendering
 */
function initializeTomeCharts() {
    const tomes = allData.tomes?.tomes || [];
    tomes.forEach(tome => {
        const progression = calculateTomeProgression(tome);
        if (progression) {
            const canvasId = `tome-chart-${tome.id}`;
            createScalingChart(canvasId, progression, tome.name, tome.stat_affected || '');
        }
    });
}

/**
 * Destroy all chart instances (call before re-rendering)
 */
function destroyAllCharts() {
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
        }
    });
    chartInstances = {};
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
    setupEventListeners();
    switchTab('items'); // Start with items tab

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker registered for offline support'))
            .catch(err => console.log('❌ Service Worker registration failed:', err));
    }
});

// ========================================
// Data Loading
// ========================================

async function loadAllData() {
    try {
        // Load all JSON files
        const [itemsRes, weaponsRes, tomesRes, charsRes, shrinesRes, statsRes] = await Promise.all([
            fetch('../data/items.json'),
            fetch('../data/weapons.json'),
            fetch('../data/tomes.json'),
            fetch('../data/characters.json'),
            fetch('../data/shrines.json'),
            fetch('../data/stats.json')
        ]);

        allData.items = await itemsRes.json();
        allData.weapons = await weaponsRes.json();
        allData.tomes = await tomesRes.json();
        allData.characters = await charsRes.json();
        allData.shrines = await shrinesRes.json();
        allData.stats = await statsRes.json();

        // Update version info
        document.getElementById('version').textContent = `Version: ${allData.items.version}`;
        document.getElementById('last-updated').textContent = `Last Updated: ${allData.items.last_updated}`;

        console.log('All data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data files. Please check that all JSON files exist.');
    }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Modal close
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('closeCompare')?.addEventListener('click', () => {
        document.getElementById('compareModal').style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        const itemModal = document.getElementById('itemModal');
        const compareModal = document.getElementById('compareModal');
        if (e.target === itemModal) closeModal();
        if (e.target === compareModal) compareModal.style.display = 'none';
    });

    // Compare button
    document.getElementById('compare-btn')?.addEventListener('click', openCompareModal);

    // Build planner events (setup when tab is active)
    setupBuildPlannerEvents();
}

// ========================================
// Tab Switching
// ========================================

function switchTab(tabName) {
    // Destroy existing charts before switching tabs
    destroyAllCharts();

    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Update filters based on tab
    updateFilters(tabName);

    // Render content for the tab
    renderTabContent(tabName);
}

// ========================================
// Filters
// ========================================

function updateFilters(tabName) {
    const filtersContainer = document.getElementById('filters');
    filtersContainer.innerHTML = '';

    if (tabName === 'items') {
        filtersContainer.innerHTML = `
            <label>Rarity:</label>
            <select id="rarityFilter">
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
            </select>
            <label>Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label>Stacking:</label>
            <select id="stackingFilter">
                <option value="all">All</option>
                <option value="stacks_well">Stacks Well</option>
                <option value="one_and_done">One-and-Done</option>
            </select>
            <label>Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
                <option value="rarity">Rarity</option>
            </select>
        `;
    } else if (['weapons', 'tomes', 'characters'].includes(tabName)) {
        filtersContainer.innerHTML = `
            <label>Tier:</label>
            <select id="tierFilter">
                <option value="all">All Tiers</option>
                <option value="SS">SS Tier</option>
                <option value="S">S Tier</option>
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
            </select>
            <label>Sort:</label>
            <select id="sortBy">
                <option value="name">Name</option>
                <option value="tier">Tier</option>
            </select>
        `;
    } else if (tabName === 'shrines') {
        filtersContainer.innerHTML = `
            <label>Type:</label>
            <select id="typeFilter">
                <option value="all">All Types</option>
                <option value="stat_upgrade">Stat Upgrade</option>
                <option value="combat">Combat</option>
                <option value="utility">Utility</option>
                <option value="risk_reward">Risk/Reward</option>
            </select>
        `;
    }

    // Re-attach event listeners
    const filterSelects = filtersContainer.querySelectorAll('select');
    filterSelects.forEach(select => {
        select.addEventListener('change', () => renderTabContent(currentTab));
    });
}

function handleSearch() {
    renderTabContent(currentTab);
}

// ========================================
// Rendering
// ========================================

function renderTabContent(tabName) {
    if (tabName === 'build-planner') {
        renderBuildPlanner();
        return;
    }

    if (tabName === 'calculator') {
        populateCalculatorItems();
        document.getElementById('calc-button')?.addEventListener('click', calculateBreakpoint);
        return;
    }

    const data = getDataForTab(tabName);
    if (!data) return;

    const filtered = filterData(data, tabName);
    filteredData = filtered;

    updateStats(filtered, tabName);

    // Render based on type
    if (tabName === 'items') {
        renderItems(filtered);
    } else if (tabName === 'weapons') {
        renderWeapons(filtered);
    } else if (tabName === 'tomes') {
        renderTomes(filtered);
    } else if (tabName === 'characters') {
        renderCharacters(filtered);
    } else if (tabName === 'shrines') {
        renderShrines(filtered);
    }
}

function getDataForTab(tabName) {
    switch (tabName) {
        case 'items': return allData.items?.items || [];
        case 'weapons': return allData.weapons?.weapons || [];
        case 'tomes': return allData.tomes?.tomes || [];
        case 'characters': return allData.characters?.characters || [];
        case 'shrines': return allData.shrines?.shrines || [];
        default: return [];
    }
}

function filterData(data, tabName) {
    let filtered = [...data];
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    // Search filter
    filtered = filtered.filter(item => {
        const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
        return searchable.includes(searchTerm);
    });

    // Tier filter (for items, weapons, tomes, characters)
    const tierFilter = document.getElementById('tierFilter')?.value;
    if (tierFilter && tierFilter !== 'all') {
        filtered = filtered.filter(item => item.tier === tierFilter);
    }

    // Rarity filter (items only)
    if (tabName === 'items') {
        const rarityFilter = document.getElementById('rarityFilter')?.value;
        if (rarityFilter && rarityFilter !== 'all') {
            filtered = filtered.filter(item => item.rarity === rarityFilter);
        }

        const stackingFilter = document.getElementById('stackingFilter')?.value;
        if (stackingFilter === 'stacks_well') {
            filtered = filtered.filter(item => item.stacks_well === true);
        } else if (stackingFilter === 'one_and_done') {
            filtered = filtered.filter(item => item.one_and_done === true);
        }
    }

    // Type filter (shrines only)
    if (tabName === 'shrines') {
        const typeFilter = document.getElementById('typeFilter')?.value;
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(shrine => shrine.type === typeFilter);
        }
    }

    // Sorting
    const sortBy = document.getElementById('sortBy')?.value;
    if (sortBy === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'tier') {
        const tierOrder = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
        filtered.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99));
    } else if (sortBy === 'rarity') {
        const rarityOrder = { 'legendary': 0, 'epic': 1, 'rare': 2, 'uncommon': 3, 'common': 4 };
        filtered.sort((a, b) => (rarityOrder[a.rarity] || 99) - (rarityOrder[b.rarity] || 99));
    }

    return filtered;
}

function updateStats(filtered, tabName) {
    const statsPanel = document.getElementById('stats-summary');
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

// Render functions for each category will be added in next part due to length
// (renderItems, renderWeapons, renderTomes, renderCharacters, renderShrines, renderBuildPlanner)

window.switchTab = switchTab;
window.closeModal = closeModal;

// ========================================
// Render Functions
// ========================================

function renderItems(items) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No items found.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `item-card rarity-${item.rarity}`;

        const stackIcon = item.one_and_done ? '✓' : (item.stacks_well ? '∞' : '~');
        const stackText = item.one_and_done ? 'One-and-Done' : (item.stacks_well ? 'Stacks Well' : 'Limited');
        const imageHtml = item.image ? `<img src="${item.image}" alt="${item.name}" class="entity-image" onerror="this.style.display='none'">` : '';

        // Determine if this item should show a scaling graph
        const showGraph = item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat';
        const graphHtml = showGraph ? `
            <div class="item-graph-container">
                <canvas id="chart-${item.id}" class="scaling-chart"></canvas>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${item.name}</div>
                    <span class="tier-label">${item.tier} Tier</span>
                </div>
                <label class="compare-checkbox-label" title="Add to comparison">
                    <input type="checkbox" class="compare-checkbox" value="${item.id}" onchange="toggleCompareItem('${item.id}')">
                    <span>+</span>
                </label>
            </div>
            <div class="item-effect">${item.base_effect}</div>
            <div class="item-description">${item.detailed_description.substring(0, 120)}...</div>
            <div class="item-meta">
                <span class="meta-tag">${stackText}</span>
            </div>
            ${graphHtml}
            <button class="view-details-btn" onclick="openDetailModal('item', '${item.id}')">View Details</button>
        `;

        container.appendChild(card);
    });

    // Initialize charts after DOM is ready
    setTimeout(() => initializeItemCharts(), 50);
}

function renderWeapons(weapons) {
    const container = document.getElementById('weaponsContainer');
    container.innerHTML = '';

    weapons.forEach(weapon => {
        const card = document.createElement('div');
        card.className = 'item-card weapon-card';
        const imageHtml = weapon.image ? `<img src="${weapon.image}" alt="${weapon.name}" class="entity-image" onerror="this.style.display='none'">` : '';

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${weapon.name}</div>
                    <span class="tier-label">${weapon.tier} Tier</span>
                </div>
            </div>
            <div class="item-effect">${weapon.attack_pattern}</div>
            <div class="item-description">${weapon.description}</div>
            <div class="item-meta">
                ${weapon.upgradeable_stats.slice(0, 4).map(stat => `<span class="meta-tag">${stat}</span>`).join(' ')}
            </div>
            <button class="view-details-btn" onclick="openDetailModal('weapon', '${weapon.id}')">View Details</button>
        `;

        container.appendChild(card);
    });
}

function renderTomes(tomes) {
    const container = document.getElementById('tomesContainer');
    container.innerHTML = '';

    tomes.forEach(tome => {
        const card = document.createElement('div');
        card.className = 'item-card tome-card';
        const imageHtml = tome.image ? `<img src="${tome.image}" alt="${tome.name}" class="entity-image" onerror="this.style.display='none'">` : '';

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
            <button class="view-details-btn" onclick="openDetailModal('tome', '${tome.id}')">View Details</button>
        `;

        container.appendChild(card);
    });

    // Initialize charts after DOM is ready
    setTimeout(() => initializeTomeCharts(), 50);
}

function renderCharacters(characters) {
    const container = document.getElementById('charactersContainer');
    container.innerHTML = '';

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'item-card character-card';
        const imageHtml = char.image ? `<img src="${char.image}" alt="${char.name}" class="entity-image" onerror="this.style.display='none'">` : '';

        card.innerHTML = `
            <div class="item-header">
                ${imageHtml}
                <div class="item-title">
                    <div class="item-name">${char.name}</div>
                    <span class="tier-label">${char.tier} Tier</span>
                </div>
            </div>
            <div class="item-effect">${char.passive_ability}</div>
            <div class="item-description">${char.passive_description}</div>
            <div class="item-meta">
                <span class="meta-tag">${char.starting_weapon}</span>
                <span class="meta-tag">${char.playstyle}</span>
            </div>
            <button class="view-details-btn" onclick="openDetailModal('character', '${char.id}')">View Details</button>
        `;

        container.appendChild(card);
    });
}

function renderShrines(shrines) {
    const container = document.getElementById('shrinesContainer');
    container.innerHTML = '';

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'shrine-card';

        card.innerHTML = `
            <div class="shrine-header">
                <span class="shrine-icon">${shrine.icon}</span>
                <div>
                    <div class="shrine-name">${shrine.name}</div>
                    <span class="shrine-type">${shrine.type.replace('_', ' ')}</span>
                </div>
            </div>
            <div class="shrine-description">${shrine.description}</div>
            <div class="shrine-reward"><strong>Reward:</strong> ${shrine.reward}</div>
            ${shrine.strategy ? `<div class="shrine-strategy"><strong>Strategy:</strong> ${shrine.strategy}</div>` : ''}
            ${shrine.notes ? `<div class="item-notes">${shrine.notes}</div>` : ''}
        `;

        container.appendChild(card);
    });
}

function renderBuildPlanner() {
    const charSelect = document.getElementById('build-character');
    charSelect.innerHTML = '<option value="">Select Character...</option>';
    if (allData.characters) {
        allData.characters.characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = `${char.name} (${char.tier} Tier)`;
            charSelect.appendChild(option);
        });
    }

    const weaponSelect = document.getElementById('build-weapon');
    weaponSelect.innerHTML = '<option value="">Select Weapon...</option>';
    if (allData.weapons) {
        allData.weapons.weapons.forEach(weapon => {
            const option = document.createElement('option');
            option.value = weapon.id;
            option.textContent = `${weapon.name} (${weapon.tier} Tier)`;
            weaponSelect.appendChild(option);
        });
    }

    const tomesSelection = document.getElementById('tomes-selection');
    tomesSelection.innerHTML = '';
    if (allData.tomes) {
        allData.tomes.tomes.forEach(tome => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${tome.id}" class="tome-checkbox"> ${tome.name}`;
            tomesSelection.appendChild(label);
        });
    }

    const itemsSelection = document.getElementById('items-selection');
    itemsSelection.innerHTML = '';
    if (allData.items) {
        allData.items.items.slice(0, 40).forEach(item => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.id}" class="item-checkbox"> ${item.name} (${item.tier})`;
            itemsSelection.appendChild(label);
        });
    }
}

function setupBuildPlannerEvents() {
    document.getElementById('build-character')?.addEventListener('change', (e) => {
        const charId = e.target.value;
        currentBuild.character = allData.characters?.characters.find(c => c.id === charId);
        updateBuildAnalysis();
    });

    document.getElementById('build-weapon')?.addEventListener('change', (e) => {
        const weaponId = e.target.value;
        currentBuild.weapon = allData.weapons?.weapons.find(w => w.id === weaponId);
        updateBuildAnalysis();
    });

    document.getElementById('export-build')?.addEventListener('click', exportBuild);
    document.getElementById('clear-build')?.addEventListener('click', clearBuild);
}

function calculateBuildStats() {
    const stats = {
        damage: 100, hp: 100, crit_chance: 5, crit_damage: 150,
        attack_speed: 100, movement_speed: 100, armor: 0,
        evasion_internal: 0, projectiles: 1
    };

    if (currentBuild.character) {
        if (currentBuild.character.passive_ability.includes('Crit Chance')) stats.crit_chance += 50;
        if (currentBuild.character.passive_ability.includes('HP')) stats.hp += 50;
        if (currentBuild.character.passive_ability.includes('Damage')) stats.damage += 20;
    }

    if (currentBuild.weapon) {
        stats.damage += parseInt(currentBuild.weapon.base_damage) || 0;
    }

    currentBuild.tomes.forEach(tome => {
        const tomeLevel = 5;
        const value = parseFloat(tome.value_per_level.match(/[\d.]+/)?.[0] || 0);
        if (tome.stat_affected === 'Damage') stats.damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Chance' || tome.id === 'precision') stats.crit_chance += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Damage') stats.crit_damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'HP' || tome.id === 'vitality') stats.hp += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Attack Speed' || tome.id === 'cooldown') stats.attack_speed += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Movement Speed' || tome.id === 'agility') stats.movement_speed += value * tomeLevel * 100;
        else if (tome.id === 'armor') stats.armor += value * tomeLevel * 100;
    });

    currentBuild.items.forEach(item => {
        if (item.id === 'gym_sauce') stats.damage += 10;
        else if (item.id === 'forbidden_juice') stats.crit_chance += 10;
        else if (item.id === 'oats') stats.hp += 25;
        else if (item.id === 'battery') stats.attack_speed += 8;
        else if (item.id === 'turbo_socks') stats.movement_speed += 15;
        else if (item.id === 'beer') stats.damage += 20;
        else if (item.id === 'backpack') stats.projectiles += 1;
        else if (item.id === 'slippery_ring' || item.id === 'phantom_shroud') stats.evasion_internal += 15;
        else if (item.id === 'beefy_ring') stats.damage += (stats.hp / 100) * 20;
        else if (item.id === 'leeching_crystal') stats.hp *= 1.5;
        else if (item.id === 'brass_knuckles') stats.damage += 20;
        else if (item.id === 'boss_buster') stats.damage += 15;
    });

    stats.evasion = Math.round((stats.evasion_internal / (1 + stats.evasion_internal / 100)) * 100) / 100;
    stats.overcrit = stats.crit_chance > 100;
    return stats;
}

function updateBuildAnalysis() {
    const selectedTomes = Array.from(document.querySelectorAll('.tome-checkbox:checked')).map(cb => cb.value);
    currentBuild.tomes = selectedTomes.map(id => allData.tomes?.tomes.find(t => t.id === id)).filter(Boolean);

    const selectedItems = Array.from(document.querySelectorAll('.item-checkbox:checked')).map(cb => cb.value);
    currentBuild.items = selectedItems.map(id => allData.items?.items.find(i => i.id === id)).filter(Boolean);

    const synergiesDisplay = document.getElementById('build-synergies');
    const statsDisplay = document.getElementById('build-stats');
    if (!synergiesDisplay || !statsDisplay) return;

    // Calculate and display stats
    if (currentBuild.character && currentBuild.weapon) {
        const stats = calculateBuildStats();
        statsDisplay.innerHTML = `
            <div class="stat-card"><div class="stat-icon">⚔️</div><div class="stat-info"><div class="stat-label">Total Damage</div><div class="stat-value">${stats.damage.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">❤️</div><div class="stat-info"><div class="stat-label">Max HP</div><div class="stat-value">${stats.hp.toFixed(0)}</div></div></div>
            <div class="stat-card ${stats.overcrit ? 'stat-overcrit' : ''}"><div class="stat-icon">💥</div><div class="stat-info"><div class="stat-label">Crit Chance${stats.overcrit ? ' (OVERCRIT!)' : ''}</div><div class="stat-value">${stats.crit_chance.toFixed(1)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-info"><div class="stat-label">Crit Damage</div><div class="stat-value">${stats.crit_damage.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-info"><div class="stat-label">Attack Speed</div><div class="stat-value">${stats.attack_speed.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">👟</div><div class="stat-info"><div class="stat-label">Movement Speed</div><div class="stat-value">${stats.movement_speed.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🛡️</div><div class="stat-info"><div class="stat-label">Armor</div><div class="stat-value">${stats.armor.toFixed(0)}</div></div></div>
            <div class="stat-card"><div class="stat-icon">💨</div><div class="stat-info"><div class="stat-label">Evasion</div><div class="stat-value">${stats.evasion.toFixed(1)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-info"><div class="stat-label">Projectiles</div><div class="stat-value">${stats.projectiles}</div></div></div>
        `;
    } else {
        statsDisplay.innerHTML = '<p class="stats-placeholder">Select character and weapon to see calculated stats...</p>';
    }

    // Synergy detection
    let synergies = [];
    if (currentBuild.character && currentBuild.weapon) {
        if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${currentBuild.character.name} synergizes with ${currentBuild.weapon.name}!`);
        }
    }

    currentBuild.items.forEach(item => {
        if (currentBuild.weapon && item.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${item.name} works great with ${currentBuild.weapon.name}`);
        }
    });

    synergiesDisplay.innerHTML = synergies.length > 0
        ? `<h4>🔗 Synergies Found:</h4><ul>${synergies.map(s => `<li>${s}</li>`).join('')}</ul>`
        : '<p>Select character, weapon, and items to see synergies...</p>';
}

function exportBuild() {
    const buildCode = JSON.stringify({
        character: currentBuild.character?.id,
        weapon: currentBuild.weapon?.id,
        tomes: currentBuild.tomes.map(t => t.id),
        items: currentBuild.items.map(i => i.id)
    });

    navigator.clipboard.writeText(buildCode).then(() => {
        alert('Build code copied to clipboard!');
    });
}

function clearBuild() {
    currentBuild = { character: null, weapon: null, tomes: [], items: [] };
    document.getElementById('build-character').value = '';
    document.getElementById('build-weapon').value = '';
    document.querySelectorAll('.tome-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
    updateBuildAnalysis();
}

function openDetailModal(type, id) {
    let data;
    switch (type) {
        case 'item':
            data = allData.items?.items.find(i => i.id === id);
            break;
        case 'weapon':
            data = allData.weapons?.weapons.find(w => w.id === id);
            break;
        case 'tome':
            data = allData.tomes?.tomes.find(t => t.id === id);
            break;
        case 'character':
            data = allData.characters?.characters.find(c => c.id === id);
            break;
    }

    if (!data) return;

    const modal = document.getElementById('itemModal');
    const modalBody = document.getElementById('modalBody');

    let content = `<h2>${data.name}</h2>`;

    if (type === 'item') {
        // Check if this item has scaling data for a graph
        const showGraph = data.scaling_per_stack && !data.one_and_done && data.graph_type !== 'flat';
        const graphHtml = showGraph ? `
            <div class="modal-graph-container">
                <canvas id="modal-chart-${data.id}" class="scaling-chart"></canvas>
            </div>
        ` : '';

        content += `
            <div class="item-badges">
                <span class="badge rarity-${data.rarity}">${data.rarity}</span>
                <span class="badge tier-${data.tier}">${data.tier} Tier</span>
            </div>
            <div class="item-effect" style="margin-top: 1rem;">${data.base_effect}</div>
            <p>${data.detailed_description}</p>
            <div class="item-formula"><strong>Formula:</strong> ${data.formula}</div>
            ${graphHtml}
            ${data.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${data.synergies.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>` : ''}
        `;

        // Initialize chart after modal is displayed
        if (showGraph) {
            setTimeout(() => {
                createScalingChart(`modal-chart-${data.id}`, data.scaling_per_stack, data.name, data.scaling_type || '', true, data.secondary_scaling || null);
            }, 100);
        }
    } else if (type === 'weapon') {
        content += `
            <p><strong>Attack Pattern:</strong> ${data.attack_pattern}</p>
            <p>${data.description}</p>
            <p><strong>Upgradeable Stats:</strong> ${data.upgradeable_stats.join(', ')}</p>
            <p><strong>Build Tips:</strong> ${data.build_tips}</p>
        `;
    } else if (type === 'tome') {
        // Check if we can calculate progression for this tome
        const progression = calculateTomeProgression(data);
        const graphHtml = progression ? `
            <div class="modal-graph-container">
                <canvas id="modal-tome-chart-${data.id}" class="scaling-chart"></canvas>
            </div>
        ` : '';

        content += `
            <div class="item-badges">
                <span class="badge tier-${data.tier}">${data.tier} Tier</span>
                <span class="badge" style="background: var(--bg-dark);">Priority: ${data.priority}</span>
            </div>
            <div class="tome-effect" style="margin-top: 1rem;">
                <strong>Stat:</strong> ${data.stat_affected}<br>
                <strong>Per Level:</strong> ${data.value_per_level}
            </div>
            <p>${data.description}</p>
            ${graphHtml}
            ${data.notes ? `<div class="item-formula">${data.notes}</div>` : ''}
            <div class="item-notes"><strong>Recommended for:</strong> ${data.recommended_for.join(', ')}</div>
        `;

        // Initialize chart after modal is displayed
        if (progression) {
            setTimeout(() => {
                createScalingChart(`modal-tome-chart-${data.id}`, progression, data.name, data.stat_affected || '', true);
            }, 100);
        }
    }

    modalBody.innerHTML = content;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
}

// ========================================
// Compare Mode
// ========================================

function toggleCompareItem(itemId) {
    const index = compareItems.indexOf(itemId);
    if (index > -1) {
        compareItems.splice(index, 1);
    } else {
        if (compareItems.length >= 3) {
            alert('You can only compare up to 3 items at once. Remove an item first.');
            return;
        }
        compareItems.push(itemId);
    }
    updateCompareButton();
}

function updateCompareButton() {
    const compareBtn = document.getElementById('compare-btn');
    const countSpan = compareBtn.querySelector('.compare-count');

    countSpan.textContent = compareItems.length;

    if (compareItems.length >= 2) {
        compareBtn.style.display = 'block';
    } else {
        compareBtn.style.display = 'none';
    }

    // Update checkboxes
    document.querySelectorAll('.compare-checkbox').forEach(cb => {
        cb.checked = compareItems.includes(cb.value);
    });
}

function openCompareModal() {
    if (compareItems.length < 2) {
        alert('Select at least 2 items to compare!');
        return;
    }

    const items = compareItems.map(id =>
        allData.items?.items.find(item => item.id === id)
    ).filter(Boolean);

    const compareBody = document.getElementById('compareBody');
    const modal = document.getElementById('compareModal');

    let html = '<div class="compare-grid">';

    items.forEach(item => {
        html += `
            <div class="compare-column">
                <div class="compare-header">
                    <h3>${item.name}</h3>
                    <div class="item-badges">
                        <span class="badge rarity-${item.rarity}">${item.rarity}</span>
                        <span class="badge tier-${item.tier}">${item.tier} Tier</span>
                    </div>
                </div>

                <div class="compare-section">
                    <h4>Base Effect</h4>
                    <p>${item.base_effect}</p>
                </div>

                <div class="compare-section">
                    <h4>Stacking</h4>
                    <p class="${item.stacks_well ? 'positive' : 'negative'}">
                        ${item.stacks_well ? '✓ Stacks Well' : '✗ One-and-Done'}
                    </p>
                </div>

                <div class="compare-section">
                    <h4>Formula</h4>
                    <code class="formula-code">${item.formula}</code>
                </div>

                <div class="compare-section">
                    <h4>Scaling (1-10 stacks)</h4>
                    <div class="scaling-values">
                        ${item.scaling_per_stack.map((val, idx) =>
                            `<span class="scale-value">${idx + 1}: <strong>${val}${item.scaling_type.includes('chance') || item.scaling_type.includes('damage') ? '%' : ''}</strong></span>`
                        ).join('')}
                    </div>
                </div>

                ${item.synergies?.length ? `
                    <div class="compare-section">
                        <h4>Synergies</h4>
                        <div class="synergy-tags">
                            ${item.synergies.slice(0, 5).map(s => `<span class="synergy-tag">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${item.anti_synergies?.length ? `
                    <div class="compare-section">
                        <h4>Anti-Synergies</h4>
                        <div class="antisynergy-tags">
                            ${item.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="compare-section">
                    <h4>Notes</h4>
                    <p class="notes">${item.notes}</p>
                </div>

                <button class="remove-compare-btn" onclick="toggleCompareItem('${item.id}'); updateCompareDisplay();">
                    Remove from Comparison
                </button>
            </div>
        `;
    });

    html += '</div>';
    compareBody.innerHTML = html;
    modal.style.display = 'block';
}

function updateCompareDisplay() {
    if (compareItems.length < 2) {
        document.getElementById('compareModal').style.display = 'none';
    } else {
        openCompareModal();
    }
}

function clearCompare() {
    compareItems = [];
    updateCompareButton();
    document.getElementById('compareModal').style.display = 'none';
}

// ========================================
// Breakpoint Calculator
// ========================================

function populateCalculatorItems() {
    const select = document.getElementById('calc-item-select');
    if (!select || !allData.items) return;

    select.innerHTML = '<option value="">Choose an item...</option>';

    allData.items.items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} - ${item.base_effect}`;
        select.appendChild(option);
    });
}

function calculateBreakpoint() {
    const itemId = document.getElementById('calc-item-select').value;
    const target = parseFloat(document.getElementById('calc-target').value);
    const resultDiv = document.getElementById('calc-result');

    if (!itemId || !target) {
        alert('Please select an item and enter a target value!');
        return;
    }

    const item = allData.items?.items.find(i => i.id === itemId);
    if (!item) return;

    // Calculate stacks needed
    let stacksNeeded = 0;
    const perStack = item.scaling_per_stack[0]; // Value per stack from first entry

    if (perStack > 0) {
        stacksNeeded = Math.ceil(target / perStack);
    }

    // Cap checks
    if (item.stack_cap && stacksNeeded > item.stack_cap) {
        stacksNeeded = item.stack_cap;
    }

    // Display result
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="calc-result-content">
            <h3>📊 Calculation Result</h3>
            <div class="result-main">
                <div class="result-item">
                    <div class="result-label">Item:</div>
                    <div class="result-value"><strong>${item.name}</strong></div>
                </div>
                <div class="result-item">
                    <div class="result-label">Target Value:</div>
                    <div class="result-value"><strong>${target}${item.scaling_type.includes('chance') || item.scaling_type.includes('percentage') ? '%' : ''}</strong></div>
                </div>
                <div class="result-item highlight">
                    <div class="result-label">Stacks Needed:</div>
                    <div class="result-value large"><strong>${stacksNeeded}</strong></div>
                </div>
            </div>

            <div class="result-details">
                <p><strong>Formula:</strong> ${item.formula}</p>
                <p><strong>Per Stack:</strong> +${perStack}${item.scaling_type.includes('chance') || item.scaling_type.includes('percentage') ? '%' : ''}</p>
                ${item.stack_cap ? `<p class="warning">⚠️ Note: This item caps at ${item.stack_cap} stacks</p>` : ''}
                ${item.one_and_done ? `<p class="warning">⚠️ Note: This is a one-and-done item - additional copies provide no benefit!</p>` : ''}
                ${!item.stacks_well ? `<p class="warning">⚠️ Note: This item has diminishing returns or limited stacking</p>` : ''}
            </div>

            <div class="result-graph">
                <h4>Scaling Visualization (1-10 stacks)</h4>
                <div class="mini-bar-graph">
                    ${item.scaling_per_stack.map((val, idx) => {
                        const height = (val / Math.max(...item.scaling_per_stack)) * 100;
                        const isTarget = (idx + 1) === stacksNeeded;
                        return `<div class="bar-container">
                            <div class="bar ${isTarget ? 'target-bar' : ''}" style="height: ${height}%"></div>
                            <span class="bar-label">${idx + 1}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function quickCalc(itemId, target) {
    document.getElementById('calc-item-select').value = itemId;
    document.getElementById('calc-target').value = target;
    calculateBreakpoint();

    // Switch to calculator tab
    switchTab('calculator');
}

window.openDetailModal = openDetailModal;
window.toggleCompareItem = toggleCompareItem;
window.quickCalc = quickCalc;
