// ========================================
// Chart.js Tree-Shakeable Loader
// ========================================
// This module imports only the Chart.js components we actually use,
// enabling tree-shaking to reduce bundle size from ~200KB to ~50-60KB

import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

// Register only the components we need
Chart.register(
    LineController, // For line charts
    LineElement, // Line rendering
    PointElement, // Points on the line
    LinearScale, // Y-axis
    CategoryScale, // X-axis
    Title, // Axis titles
    Tooltip, // Tooltips
    Legend, // Legend for comparison charts
    Filler // For area fill (fill: true)
);

// Export the configured Chart instance
export { Chart };

/**
 * Lazy load Chart.js and return the Chart class
 * This function can be used for dynamic imports to defer loading
 * until charts are actually needed
 * @returns {Promise<typeof Chart>}
 */
export async function loadChart() {
    // Chart is already loaded since we're importing it at the top
    // But this function provides a consistent async API for dynamic loading
    return Chart;
}

// ========================================
// Exports:
// - Chart: Configured Chart.js instance with only needed components
// - loadChart(): Async function for dynamic loading patterns
// ========================================
