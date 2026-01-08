// ========================================
// MegaBonk Charts Module
// ========================================

// Chart instances storage (for cleanup)
let chartInstances = {};

/**
 * Determine the effective stack cap for an item
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
    const canvas = safeGetElementById(canvasId);
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
        datasets.push({
            label: secondaryData.stat,
            data: secondaryData.values.slice(0, effectiveCap),
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
                legend: { display: hasSecondary },
                tooltip: { enabled: true }
            },
            scales: {
                x: {
                    title: { display: isModal, text: 'Stacks' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    position: 'left',
                    title: { display: isModal, text: isPercentage ? '%' : 'Value' },
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y2: {
                    position: 'right',
                    display: hasSecondary,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

/**
 * Create comparison chart for multiple items
 * @param {string} canvasId - Canvas element ID
 * @param {Array} items - Array of items to compare
 */
function createCompareChart(canvasId, items) {
    const canvas = safeGetElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const colors = ['#e94560', '#4ecdc4', '#f9ca24'];
    const maxLength = Math.max(...items.map(item => item.scaling_per_stack?.length || 0));
    const labels = Array.from({ length: Math.min(maxLength, 10) }, (_, i) => `${i + 1}`);

    const datasets = items.map((item, index) => ({
        label: item.name,
        data: item.scaling_per_stack?.slice(0, 10) || [],
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}33`,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { enabled: true, mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Stacks' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    title: { display: true, text: 'Value' },
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

/**
 * Calculate tome progression values
 * @param {Object} tome - Tome data
 * @param {number} maxLevels - Maximum levels to calculate
 * @returns {number[]|null} Array of progression values or null
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

    return Array.from({ length: maxLevels }, (_, i) => {
        const internalValue = (isMultiplier ? perLevel * 100 : perLevel) * (i + 1);

        if (isHyperbolic && isEvasion) {
            // Evasion formula: actual = internal / (1 + internal)
            const internalDecimal = internalValue / 100;
            const actualEvasion = internalDecimal / (1 + internalDecimal) * 100;
            return Math.round(actualEvasion * 100) / 100;
        } else if (isHyperbolic && isArmor) {
            // Armor formula: actual = internal / (0.75 + internal)
            const internalDecimal = internalValue / 100;
            const actualArmor = internalDecimal / (0.75 + internalDecimal) * 100;
            return Math.round(actualArmor * 100) / 100;
        }

        return Math.round(internalValue * 100) / 100;
    });
}

/**
 * Initialize charts for items in the current view
 */
function initializeItemCharts() {
    const items = getDataForTab('items');
    items.forEach(item => {
        if (item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat') {
            const effectiveCap = getEffectiveStackCap(item);
            createScalingChart(`chart-${item.id}`, item.scaling_per_stack, item.name, item.scaling_type || '', false, item.secondary_scaling || null, effectiveCap);
        }
    });
}

/**
 * Initialize charts for tomes in the current view
 */
function initializeTomeCharts() {
    const tomes = getDataForTab('tomes');
    tomes.forEach(tome => {
        const progression = calculateTomeProgression(tome);
        if (progression) {
            createScalingChart(`tome-chart-${tome.id}`, progression, tome.name, tome.stat_affected || '', false);
        }
    });
}

/**
 * Destroy all chart instances
 */
function destroyAllCharts() {
    Object.keys(chartInstances).forEach(canvasId => {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
    });
    chartInstances = {};
}

// ========================================
// Expose to global scope
// ========================================

window.chartInstances = chartInstances;
window.getEffectiveStackCap = getEffectiveStackCap;
window.createScalingChart = createScalingChart;
window.createCompareChart = createCompareChart;
window.calculateTomeProgression = calculateTomeProgression;
window.initializeItemCharts = initializeItemCharts;
window.initializeTomeCharts = initializeTomeCharts;
window.destroyAllCharts = destroyAllCharts;
