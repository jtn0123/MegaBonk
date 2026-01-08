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
// Loading & Error UI
// ========================================

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showErrorMessage(message, isRetryable = true) {
    let errorContainer = document.getElementById('error-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.className = 'error-container';
        document.body.prepend(errorContainer);
    }

    errorContainer.innerHTML = `
        <div class="error-message">
            <span class="error-icon">⚠️</span>
            <div class="error-content">
                <strong>Error Loading Data</strong>
                <p>${message}</p>
            </div>
            ${isRetryable ? '<button class="btn-primary" onclick="retryLoad()">Retry</button>' : ''}
            <button class="error-close" onclick="dismissError()">&times;</button>
        </div>
    `;
    errorContainer.style.display = 'block';
}

function dismissError() {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) errorContainer.style.display = 'none';
}

function retryLoad() {
    dismissError();
    loadAllData();
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('#filters select').forEach(select => {
        select.value = 'all';
    });

    renderTabContent(currentTab);
}

// Expose to global scope for onclick handlers
window.retryLoad = retryLoad;
window.dismissError = dismissError;
window.clearFilters = clearFilters;

// ========================================
// Expandable Text Helpers
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
 * Toggle text expansion on click
 * @param {HTMLElement} element - The expandable text element
 */
function toggleTextExpand(element) {
    if (!element.dataset.fullText) return;

    const isTruncated = element.dataset.truncated === 'true';
    const fullText = element.dataset.fullText;

    if (isTruncated) {
        // Expand
        element.innerHTML = fullText + '<span class="expand-indicator">Click to collapse</span>';
        element.dataset.truncated = 'false';
        element.classList.add('expanded');
    } else {
        // Collapse
        const truncated = fullText.length > 120 ? fullText.substring(0, 120) + '...' : fullText;
        element.innerHTML = truncated + '<span class="expand-indicator">Click to expand</span>';
        element.dataset.truncated = 'true';
        element.classList.remove('expanded');
    }
}

// Expose to global scope
window.toggleTextExpand = toggleTextExpand;

// ========================================
// Chart.js Integration
// ========================================

/**
 * Determine the effective stack cap for an item
 * Uses max_stacks or stack_cap field if set, otherwise infers from scaling data
 * @param {Object} item - Item with scaling_per_stack and optional stack_cap/max_stacks
 * @returns {number} The effective maximum stacks to display
 */
function getEffectiveStackCap(item) {
    // Use explicit max_stacks if set
    if (item.max_stacks && item.max_stacks > 0) {
        return item.max_stacks;
    }
    // Use stack_cap if reasonable (between 1 and 100)
    if (item.stack_cap && item.stack_cap > 0 && item.stack_cap <= 100) {
        return Math.min(item.stack_cap, item.scaling_per_stack?.length || 10);
    }
    // Detect plateau - if last several values are the same, cap is where they start repeating
    const scaling = item.scaling_per_stack || [];
    if (scaling.length === 0) return 10;

    for (let i = scaling.length - 1; i > 0; i--) {
        if (scaling[i] !== scaling[i - 1]) {
            // Found where values differ - cap is at i+1
            // But only if there's an actual plateau (3+ repeating values)
            if (scaling.length - i >= 3) {
                return i + 1;
            }
            break;
        }
    }
    // Default to array length
    return scaling.length;
}

/**
 * Create a scaling chart for an item or tome
 * @param {string} canvasId - The canvas element ID
 * @param {number[]} data - Array of scaling values
 * @param {string} label - Chart label (item/tome name)
 * @param {string} scalingType - Type of scaling for formatting
 * @param {boolean} isModal - If true, creates a larger chart for modals
 * @param {Object} secondaryData - Optional secondary scaling data {stat: string, values: number[]}
 * @param {number} stackCap - Optional stack cap to limit displayed data
 */
function createScalingChart(canvasId, data, label, scalingType = '', isModal = false, secondaryData = null, stackCap = null) {
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

    // Apply stack cap if provided
    const effectiveCap = stackCap || data.length;
    const displayData = data.slice(0, effectiveCap);
    const labels = displayData.map((_, i) => `${i + 1}`);
    const isPercentage = scalingType.includes('chance') ||
                         scalingType.includes('percentage') ||
                         scalingType.includes('damage') ||
                         scalingType.includes('crit');

    // Build datasets array
    const datasets = [{
        label: label,
        data: displayData,
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
        const secondaryDisplayData = secondaryData.values.slice(0, effectiveCap);
        datasets.push({
            label: secondaryData.stat,
            data: secondaryDisplayData,
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
 * Create a comparison chart overlaying multiple items' scaling curves
 * @param {string} canvasId - The canvas element ID
 * @param {Object[]} items - Array of item objects to compare
 */
function createCompareChart(canvasId, items) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    // Destroy existing chart if present
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Color palette for multiple lines
    const colors = [
        { border: '#e94560', bg: 'rgba(233, 69, 96, 0.15)' },
        { border: '#4ecdc4', bg: 'rgba(78, 205, 196, 0.15)' },
        { border: '#f0a800', bg: 'rgba(240, 168, 0, 0.15)' },
        { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
        { border: '#00ff88', bg: 'rgba(0, 255, 136, 0.15)' }
    ];

    // Find max stack count across all items
    const maxStacks = Math.max(...items.map(item => getEffectiveStackCap(item)));

    // Generate labels based on max stacks
    const labels = Array.from({ length: maxStacks }, (_, i) => `${i + 1}`);

    // Build datasets for each item
    const datasets = items.map((item, index) => {
        const color = colors[index % colors.length];
        const effectiveCap = getEffectiveStackCap(item);

        // Build data array, using null for values beyond the item's cap
        const data = [];
        for (let i = 0; i < maxStacks; i++) {
            if (i < item.scaling_per_stack.length && i < effectiveCap) {
                data.push(item.scaling_per_stack[i]);
            } else {
                data.push(null);
            }
        }

        return {
            label: item.name,
            data: data,
            borderColor: color.border,
            backgroundColor: color.bg,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color.border,
            borderWidth: 2,
            spanGaps: false
        };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#a0a0a0', font: { size: 12 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1a1a2e',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#e94560',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Stacks', color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#a0a0a0' }
                },
                y: {
                    title: { display: true, text: 'Value', color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#a0a0a0' },
                    beginAtZero: true
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
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
            const effectiveCap = getEffectiveStackCap(item);
            createScalingChart(canvasId, item.scaling_per_stack, item.name, item.scaling_type || '', false, item.secondary_scaling || null, effectiveCap);
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
    showLoading();
    try {
        // Load all JSON files
        const responses = await Promise.all([
            fetch('../data/items.json'),
            fetch('../data/weapons.json'),
            fetch('../data/tomes.json'),
            fetch('../data/characters.json'),
            fetch('../data/shrines.json'),
            fetch('../data/stats.json')
        ]);

        // Check all responses are OK
        const fileNames = ['items.json', 'weapons.json', 'tomes.json', 'characters.json', 'shrines.json', 'stats.json'];
        for (let i = 0; i < responses.length; i++) {
            if (!responses[i].ok) {
                throw new Error(`Failed to load ${fileNames[i]}: HTTP ${responses[i].status}`);
            }
        }

        const [itemsRes, weaponsRes, tomesRes, charsRes, shrinesRes, statsRes] = responses;

        allData.items = await itemsRes.json();
        allData.weapons = await weaponsRes.json();
        allData.tomes = await tomesRes.json();
        allData.characters = await charsRes.json();
        allData.shrines = await shrinesRes.json();
        allData.stats = await statsRes.json();

        // Update version info
        const versionEl = document.getElementById('version');
        const lastUpdatedEl = document.getElementById('last-updated');
        if (versionEl) versionEl.textContent = `Version: ${allData.items.version}`;
        if (lastUpdatedEl) lastUpdatedEl.textContent = `Last Updated: ${allData.items.last_updated}`;

        console.log('All data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        showErrorMessage(error.message || 'Failed to load data files. Please check your connection and try again.');
    } finally {
        hideLoading();
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
        filtered.sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
    } else if (sortBy === 'rarity') {
        filtered.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99));
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
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No Items Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
                <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
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
            <div class="item-description ${item.detailed_description.length > 120 ? 'expandable-text' : ''}"
                 ${item.detailed_description.length > 120 ? `data-full-text="${escapeHtml(item.detailed_description)}" data-truncated="true" onclick="toggleTextExpand(this)"` : ''}>
                ${item.detailed_description.length > 120 ? item.detailed_description.substring(0, 120) + '...' : item.detailed_description}
                ${item.detailed_description.length > 120 ? '<span class="expand-indicator">Click to expand</span>' : ''}
            </div>
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

    if (weapons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚔️</div>
                <h3>No Weapons Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
                <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

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

    if (tomes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>No Tomes Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
                <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

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

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👤</div>
                <h3>No Characters Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
                <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

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

    if (shrines.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⛩️</div>
                <h3>No Shrines Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
                <button class="btn-secondary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

    shrines.forEach(shrine => {
        const card = document.createElement('div');
        card.className = 'item-card shrine-card';

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
            <button class="view-details-btn" onclick="openDetailModal('shrine', '${shrine.id}')">View Details</button>
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
    // Use DEFAULT_BUILD_STATS from constants if available, otherwise use inline defaults
    const stats = typeof DEFAULT_BUILD_STATS !== 'undefined'
        ? { ...DEFAULT_BUILD_STATS }
        : { damage: 100, hp: 100, crit_chance: 5, crit_damage: 150,
            attack_speed: 100, movement_speed: 100, armor: 0,
            evasion_internal: 0, projectiles: 1 };

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

    // Apply item effects using ITEM_EFFECTS constant if available
    currentBuild.items.forEach(item => {
        const effect = typeof ITEM_EFFECTS !== 'undefined' ? ITEM_EFFECTS[item.id] : null;
        if (effect) {
            if (effect.type === 'add') {
                stats[effect.stat] += effect.value;
            } else if (effect.type === 'multiply') {
                stats[effect.stat] *= effect.value;
            } else if (effect.type === 'hp_percent') {
                // Special: damage based on HP percentage
                stats[effect.stat] += (stats.hp / 100) * effect.value;
            }
        }
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
        case 'shrine':
            data = allData.shrines?.shrines.find(s => s.id === id);
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

        // Item image
        const imageHtml = data.image ? `<img src="${data.image}" alt="${data.name}" class="modal-item-image" onerror="this.style.display='none'">` : '';

        content += `
            ${imageHtml}
            <div class="item-badges">
                <span class="badge rarity-${data.rarity}">${data.rarity}</span>
                <span class="badge tier-${data.tier}">${data.tier} Tier</span>
            </div>
            ${data.one_and_done ? `
                <div class="one-and-done-warning">
                    <span class="warning-icon">!</span>
                    <span>One-and-Done: Additional copies provide no benefit</span>
                </div>
            ` : ''}
            ${(data.max_stacks || (data.stack_cap && data.stack_cap <= 100)) ? `
                <div class="stack-info">
                    <strong>Stack Limit:</strong> ${data.max_stacks || data.stack_cap} stacks
                </div>
            ` : ''}
            <div class="item-effect" style="margin-top: 1rem;">${data.base_effect}</div>
            <p>${data.detailed_description}</p>
            <div class="item-formula"><strong>Formula:</strong> ${data.formula}</div>
            ${graphHtml}
            ${data.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${data.synergies.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>` : ''}
            ${data.anti_synergies?.length ? `<div class="anti-synergies-section"><h3>Anti-Synergies</h3><div class="antisynergy-list">${data.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}</div></div>` : ''}
        `;

        // Initialize chart after modal is displayed
        if (showGraph) {
            setTimeout(() => {
                const effectiveCap = getEffectiveStackCap(data);
                createScalingChart(`modal-chart-${data.id}`, data.scaling_per_stack, data.name, data.scaling_type || '', true, data.secondary_scaling || null, effectiveCap);
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
    } else if (type === 'character') {
        // Character image
        const imageHtml = data.image ? `<img src="${data.image}" alt="${data.name}" class="modal-character-image" onerror="this.style.display='none'">` : '';

        content += `
            ${imageHtml}
            <div class="item-badges">
                <span class="badge tier-${data.tier}">${data.tier} Tier</span>
                <span class="badge">${data.playstyle}</span>
            </div>
            <div class="character-passive">
                <strong>${data.passive_ability}</strong>
                <p>${data.passive_description}</p>
            </div>
            <div class="character-meta">
                <div><strong>Starting Weapon:</strong> ${data.starting_weapon}</div>
                <div><strong>Base HP:</strong> ${data.base_hp} | <strong>Base Damage:</strong> ${data.base_damage}</div>
                ${data.unlock_requirement ? `<div><strong>Unlock:</strong> ${data.unlock_requirement}</div>` : ''}
            </div>
            ${data.best_for?.length ? `
                <div class="character-section">
                    <h3>Best For</h3>
                    <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
                </div>
            ` : ''}
            <div class="strengths-weaknesses">
                <div class="strengths">
                    <h4>Strengths</h4>
                    <ul>${data.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>None listed</li>'}</ul>
                </div>
                <div class="weaknesses">
                    <h4>Weaknesses</h4>
                    <ul>${data.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>None listed</li>'}</ul>
                </div>
            </div>
            <div class="synergies-section">
                <h3>Synergies</h3>
                ${data.synergies_weapons?.length ? `
                    <div class="synergy-group">
                        <h4>Weapons</h4>
                        <div class="synergy-list">${data.synergies_weapons.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                    </div>
                ` : ''}
                ${data.synergies_items?.length ? `
                    <div class="synergy-group">
                        <h4>Items</h4>
                        <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                    </div>
                ` : ''}
                ${data.synergies_tomes?.length ? `
                    <div class="synergy-group">
                        <h4>Tomes</h4>
                        <div class="synergy-list">${data.synergies_tomes.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                    </div>
                ` : ''}
            </div>
            ${data.build_tips ? `
                <div class="build-tips">
                    <h3>Build Tips</h3>
                    <p>${data.build_tips}</p>
                </div>
            ` : ''}
        `;
    } else if (type === 'shrine') {
        content += `
            <div class="shrine-modal-header">
                <span class="shrine-icon-modal">${data.icon}</span>
                <div class="item-badges">
                    <span class="badge">${data.type.replace('_', ' ')}</span>
                    ${data.reusable ? '<span class="badge">Reusable</span>' : '<span class="badge">One-time</span>'}
                </div>
            </div>
            <div class="shrine-description-full">
                <p>${data.description}</p>
            </div>
            <div class="shrine-detail-section">
                <strong>Reward</strong>
                <p>${data.reward}</p>
            </div>
            ${data.activation ? `
                <div class="shrine-detail-section">
                    <strong>Activation</strong>
                    <p>${data.activation}</p>
                </div>
            ` : ''}
            ${data.spawn_count ? `
                <div class="shrine-detail-section">
                    <strong>Spawn Rate</strong>
                    <p>${data.spawn_count}</p>
                </div>
            ` : ''}
            ${data.best_for?.length ? `
                <div class="shrine-detail-section">
                    <strong>Best For</strong>
                    <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
                </div>
            ` : ''}
            ${data.synergies_items?.length ? `
                <div class="synergies-section">
                    <h3>Item Synergies</h3>
                    <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            ` : ''}
            ${data.strategy ? `
                <div class="shrine-strategy">
                    <strong>Strategy</strong>
                    <p>${data.strategy}</p>
                </div>
            ` : ''}
            ${data.notes ? `
                <div class="item-notes" style="margin-top: 1rem;">
                    <em>${data.notes}</em>
                </div>
            ` : ''}
        `;
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

    // Filter items that have scaling data for the chart
    const chartableItems = items.filter(item =>
        item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat'
    );

    // Build HTML with optional chart section
    let html = '';
    if (chartableItems.length >= 2) {
        html += `
            <div class="compare-chart-section">
                <h3>Scaling Comparison</h3>
                <div class="compare-chart-container">
                    <canvas id="compare-scaling-chart" class="scaling-chart"></canvas>
                </div>
            </div>
        `;
    }

    html += '<div class="compare-grid">';

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

    // Initialize compare chart after DOM is ready
    if (chartableItems.length >= 2) {
        setTimeout(() => {
            createCompareChart('compare-scaling-chart', chartableItems);
        }, 100);
    }
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
