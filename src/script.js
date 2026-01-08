// ========================================
// MegaBonk Complete Guide - Main Script
// ========================================
// This file serves as the entry point and initializes all modules.
// The functionality is split across:
//   - modules/constants.js - Constants and configuration
//   - modules/utils.js - Utility functions
//   - modules/data-service.js - Data loading
//   - modules/filters.js - Filtering and sorting
//   - modules/charts.js - Chart.js integration
//   - modules/renderers.js - Render functions
//   - modules/modal.js - Modal dialogs
//   - modules/build-planner.js - Build planner
//   - modules/compare.js - Compare mode
//   - modules/calculator.js - Breakpoint calculator
//   - modules/events.js - Event handling
// ========================================

// Global state
let filteredData = [];

/**
 * Initialize the application
 */
function init() {
    // Setup event listeners
    setupEventListeners();

    // Load all game data
    loadAllData();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// ========================================
// Expose globals for backwards compatibility
// ========================================

window.filteredData = filteredData;
