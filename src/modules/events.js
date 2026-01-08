// ========================================
// MegaBonk Events Module
// Event delegation to replace inline handlers
// ========================================

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

/**
 * Setup all event delegation handlers
 */
function setupEventDelegation() {
    // Main click delegation
    document.addEventListener('click', (e) => {
        const target = e.target;

        // View Details button
        if (target.classList.contains('view-details-btn')) {
            const type = target.dataset.type;
            const id = target.dataset.id;
            if (type && id) {
                openDetailModal(type, id);
            }
            return;
        }

        // Compare checkbox
        if (target.classList.contains('compare-checkbox')) {
            const id = target.dataset.id || target.value;
            if (id) {
                toggleCompareItem(id);
            }
            return;
        }

        // Expandable text
        if (target.classList.contains('expandable-text') || target.closest('.expandable-text')) {
            const expandable = target.classList.contains('expandable-text') ? target : target.closest('.expandable-text');
            if (expandable) {
                toggleTextExpand(expandable);
            }
            return;
        }

        // Remove from comparison button
        if (target.classList.contains('remove-compare-btn') || target.closest('.remove-compare-btn')) {
            const btn = target.classList.contains('remove-compare-btn') ? target : target.closest('.remove-compare-btn');
            const id = btn?.dataset.removeId;
            if (id) {
                toggleCompareItem(id);
                updateCompareDisplay();
            }
            return;
        }

        // Clear filters button (in empty state)
        if (target.classList.contains('btn-secondary') && target.textContent.includes('Clear Filters')) {
            clearFilters();
            return;
        }

        // Changelog expand button
        if (target.classList.contains('changelog-expand-btn')) {
            toggleChangelogExpand(target);
            return;
        }

        // Entity link in changelog (deep linking)
        if (target.classList.contains('entity-link')) {
            e.preventDefault();
            const type = target.dataset.entityType;
            const id = target.dataset.entityId;
            if (type && id) {
                openDetailModal(type, id);
            }
            return;
        }

        // Breakpoint card click (calculator quick calc)
        if (target.closest('.breakpoint-card')) {
            const card = target.closest('.breakpoint-card');
            const itemId = card?.dataset.item;
            const targetVal = card?.dataset.target;
            if (itemId && targetVal) {
                quickCalc(itemId, parseInt(targetVal, 10));
            }
            return;
        }
    });

    // Change event delegation for checkboxes in build planner
    document.addEventListener('change', (e) => {
        const target = e.target;

        // Tome checkbox in build planner
        if (target.classList.contains('tome-checkbox')) {
            updateBuildAnalysis();
            return;
        }

        // Item checkbox in build planner
        if (target.classList.contains('item-checkbox')) {
            updateBuildAnalysis();
            return;
        }

        // Filter select changes
        if (target.closest('#filters') && target.tagName === 'SELECT') {
            renderTabContent(currentTab);
            return;
        }
    });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    // Search input
    const searchInput = safeGetElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal);
    });

    // Close compare modal button
    const closeCompare = safeGetElementById('closeCompare');
    if (closeCompare) {
        closeCompare.addEventListener('click', () => {
            const modal = safeGetElementById('compareModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        const itemModal = safeGetElementById('itemModal');
        const compareModal = safeGetElementById('compareModal');
        if (e.target === itemModal) closeModal();
        if (e.target === compareModal) compareModal.style.display = 'none';
    });

    // Compare button
    const compareBtn = safeGetElementById('compare-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', openCompareModal);
    }

    // Build planner events
    setupBuildPlannerEvents();

    // Setup event delegation for dynamic elements
    setupEventDelegation();
}

// ========================================
// Loading & Error UI Functions
// ========================================

/**
 * Show loading overlay
 */
function showLoading() {
    const overlay = safeGetElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = safeGetElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

/**
 * Show error message banner
 * @param {string} message - Error message to display
 * @param {boolean} isRetryable - Whether to show retry button
 */
function showErrorMessage(message, isRetryable = true) {
    let errorContainer = safeGetElementById('error-container');
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
            ${isRetryable ? '<button class="btn-primary error-retry-btn">Retry</button>' : ''}
            <button class="error-close">&times;</button>
        </div>
    `;
    errorContainer.style.display = 'block';

    // Add event listeners to error buttons
    const retryBtn = errorContainer.querySelector('.error-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            dismissError();
            loadAllData();
        });
    }

    const closeBtn = errorContainer.querySelector('.error-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', dismissError);
    }
}

/**
 * Dismiss error message
 */
function dismissError() {
    const errorContainer = safeGetElementById('error-container');
    if (errorContainer) errorContainer.style.display = 'none';
}

// ========================================
// Tab Switching
// ========================================

// Current tab state
let currentTab = 'items';

/**
 * Switch to a different tab
 * @param {string} tabName - Tab name to switch to
 */
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
    const tabContent = safeGetElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Update filters based on tab
    updateFilters(tabName);

    // Render content for the tab
    renderTabContent(tabName);
}

// ========================================
// Expose to global scope
// ========================================

window.currentTab = currentTab;
window.toggleTextExpand = toggleTextExpand;
window.setupEventDelegation = setupEventDelegation;
window.setupEventListeners = setupEventListeners;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showErrorMessage = showErrorMessage;
window.dismissError = dismissError;
window.switchTab = switchTab;
