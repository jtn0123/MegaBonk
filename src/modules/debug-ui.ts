// ========================================
// Debug UI Module
// ========================================
// Handles the debug panel UI interactions
// and integrates with the CV debug system
// Enhanced with breadcrumb display and new debug controls
// ========================================

import {
    setDebugEnabled,
    isDebugEnabled,
    setDebugOptions,
    getDebugOptions,
    getLogs,
    getStats,
    clearLogs,
    resetStats,
    exportLogs,
    downloadDebugImage,
} from './image-recognition-debug';
import { logger, requestTimer } from './logger';
import { getBreadcrumbs, clearBreadcrumbs, exportBreadcrumbs, captureStateSnapshot } from './breadcrumbs';

import type { DebugLogEntry } from '../types/computer-vision';

// ========================================
// State
// ========================================

let isExpanded = false;
let currentLogFilter: string = 'all';
let lastOverlayUrl: string | null = null;
let updateIntervalId: number | null = null;
let currentConfidenceThreshold: number = 0.7;
let activeDebugTab: 'logs' | 'breadcrumbs' | 'requests' | 'state' = 'logs';

// ========================================
// Initialization
// ========================================

/**
 * Initialize the debug panel UI
 */
export function initDebugPanel(): void {
    const panel = document.getElementById('debug-panel');
    const expandBtn = document.getElementById('debug-expand-btn');
    const debugModeCheckbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
    const panelContent = document.getElementById('debug-panel-content');

    if (!panel || !expandBtn || !debugModeCheckbox || !panelContent) {
        logger.warn({
            operation: 'debug_ui.init',
            data: {
                reason: 'missing_elements',
                hasPanel: !!panel,
                hasExpandBtn: !!expandBtn,
                hasCheckbox: !!debugModeCheckbox,
                hasContent: !!panelContent,
            },
        });
        return;
    }

    // Initialize checkbox state from stored setting
    debugModeCheckbox.checked = isDebugEnabled();
    if (debugModeCheckbox.checked) {
        panel.classList.add('active');
    }

    // Debug mode toggle
    debugModeCheckbox.addEventListener('change', () => {
        setDebugEnabled(debugModeCheckbox.checked);
        panel.classList.toggle('active', debugModeCheckbox.checked);
    });

    // Expand/collapse toggle
    expandBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleExpanded(panel, panelContent);
    });

    // Initialize overlay options
    initOverlayOptions();

    // Initialize log filter
    initLogFilter();

    // Initialize action buttons
    initActionButtons();

    // Update stats periodically when panel is visible
    // Store interval ID for cleanup
    updateIntervalId = window.setInterval(() => {
        if (isExpanded) {
            updateStats();
            updateLogViewer();
        }
    }, 1000);
}

/**
 * Cleanup debug panel resources
 */
export function cleanupDebugPanel(): void {
    if (updateIntervalId !== null) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
    isExpanded = false;
    lastOverlayUrl = null;
}

/**
 * Toggle panel expanded state
 */
function toggleExpanded(panel: HTMLElement, content: HTMLElement): void {
    isExpanded = !isExpanded;
    panel.classList.toggle('expanded', isExpanded);
    content.style.display = isExpanded ? 'block' : 'none';

    if (isExpanded) {
        updateStats();
        updateLogViewer();
    }
}

// ========================================
// Overlay Options
// ========================================

/**
 * Initialize overlay option checkboxes
 */
function initOverlayOptions(): void {
    const options = getDebugOptions();

    const optionMap: Record<string, keyof typeof options> = {
        'debug-show-regions': 'showRegionBounds',
        'debug-show-slots': 'showSlotGrid',
        'debug-show-labels': 'showConfidenceLabels',
        'debug-show-detections': 'showDetectionBoxes',
        'debug-show-heatmap': 'showVarianceHeatmap',
        'debug-show-colors': 'showDominantColors',
    };

    Object.entries(optionMap).forEach(([elementId, optionKey]) => {
        const checkbox = document.getElementById(elementId) as HTMLInputElement;
        if (checkbox) {
            // Set initial state
            checkbox.checked = options[optionKey] as boolean;

            // Handle changes
            checkbox.addEventListener('change', () => {
                setDebugOptions({ [optionKey]: checkbox.checked });
            });
        }
    });
}

// ========================================
// Statistics Display
// ========================================

/**
 * Update the statistics display
 */
export function updateStats(): void {
    const stats = getStats();

    const totalEl = document.getElementById('debug-stat-total');
    const confidenceEl = document.getElementById('debug-stat-confidence');
    const timeEl = document.getElementById('debug-stat-time');
    const cacheEl = document.getElementById('debug-stat-cache');

    if (totalEl) {
        totalEl.textContent = String(stats.totalDetections);
    }

    if (confidenceEl) {
        confidenceEl.textContent = stats.averageConfidence > 0 ? `${(stats.averageConfidence * 100).toFixed(1)}%` : '-';
    }

    if (timeEl) {
        timeEl.textContent = stats.averageProcessingTime > 0 ? `${stats.averageProcessingTime.toFixed(0)}ms` : '-';
    }

    if (cacheEl) {
        const total = stats.templateCacheHits + stats.templateCacheMisses;
        cacheEl.textContent = total > 0 ? `${stats.templateCacheHits}/${total}` : '0/0';
    }
}

// ========================================
// Log Viewer
// ========================================

/**
 * Initialize log filter dropdown
 */
function initLogFilter(): void {
    const filterSelect = document.getElementById('debug-log-filter') as HTMLSelectElement;
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            currentLogFilter = filterSelect.value;
            updateLogViewer();
        });
    }
}

/**
 * Update the log viewer with current logs
 */
export function updateLogViewer(): void {
    const viewer = document.getElementById('debug-log-viewer');
    if (!viewer) return;

    let logs = getLogs();

    // Apply filter
    if (currentLogFilter !== 'all') {
        logs = logs.filter(log => log.level === currentLogFilter);
    }

    // Get most recent 50 logs
    const recentLogs = logs.slice(-50).reverse();

    if (recentLogs.length === 0) {
        viewer.innerHTML = '<p class="debug-log-empty">No logs yet. Run a detection to see logs.</p>';
        return;
    }

    viewer.innerHTML = recentLogs.map(log => formatLogEntry(log)).join('');
}

/**
 * Format a single log entry for display
 */
function formatLogEntry(log: DebugLogEntry): string {
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    return `
        <div class="debug-log-entry ${escapeHtml(log.level)}">
            <span class="debug-log-time">${time}</span>
            <span class="debug-log-category">${escapeHtml(log.category)}</span>
            <span class="debug-log-message">${escapeHtml(log.message)}</span>
        </div>
    `;
}

/**
 * Escape HTML in log messages
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Action Buttons
// ========================================

/**
 * Initialize action buttons
 */
function initActionButtons(): void {
    // Export logs
    const exportBtn = document.getElementById('debug-export-logs');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const logsJson = exportLogs();
            const blob = new Blob([logsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `megabonk-debug-logs-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Clear logs
    const clearBtn = document.getElementById('debug-clear-logs');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearLogs();
            updateLogViewer();
        });
    }

    // Reset stats
    const resetBtn = document.getElementById('debug-reset-stats');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetStats();
            updateStats();
        });
    }

    // Download overlay
    const downloadBtn = document.getElementById('debug-download-overlay') as HTMLButtonElement;
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (lastOverlayUrl) {
                downloadDebugImage(lastOverlayUrl, `debug-overlay-${Date.now()}.png`);
            }
        });
    }
}

/**
 * Set the last overlay URL for download
 */
export function setLastOverlayUrl(url: string | null): void {
    lastOverlayUrl = url;
    const downloadBtn = document.getElementById('debug-download-overlay') as HTMLButtonElement;
    if (downloadBtn) {
        downloadBtn.disabled = !url;
    }
}

// ========================================
// Enhanced Debug Controls
// ========================================

/**
 * Initialize confidence threshold slider
 */
export function initConfidenceSlider(): void {
    const slider = document.getElementById('debug-confidence-slider') as HTMLInputElement;
    const valueDisplay = document.getElementById('debug-confidence-value');

    if (slider && valueDisplay) {
        slider.value = String(currentConfidenceThreshold * 100);
        valueDisplay.textContent = `${Math.round(currentConfidenceThreshold * 100)}%`;

        slider.addEventListener('input', () => {
            currentConfidenceThreshold = parseInt(slider.value, 10) / 100;
            valueDisplay.textContent = `${slider.value}%`;

            // Note: confidenceThreshold is managed locally, not in debug options

            logger.debug({
                operation: 'debug_ui.threshold_changed',
                data: { threshold: currentConfidenceThreshold },
            });
        });
    }
}

/**
 * Get current confidence threshold
 */
export function getConfidenceThreshold(): number {
    return currentConfidenceThreshold;
}

/**
 * Set confidence threshold programmatically
 */
export function setConfidenceThreshold(threshold: number): void {
    currentConfidenceThreshold = Math.max(0, Math.min(1, threshold));

    const slider = document.getElementById('debug-confidence-slider') as HTMLInputElement;
    const valueDisplay = document.getElementById('debug-confidence-value');

    if (slider) {
        slider.value = String(Math.round(currentConfidenceThreshold * 100));
    }
    if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(currentConfidenceThreshold * 100)}%`;
    }
}

// ========================================
// Breadcrumb Display
// ========================================

/**
 * Update breadcrumb viewer
 */
export function updateBreadcrumbViewer(): void {
    const viewer = document.getElementById('debug-breadcrumb-viewer');
    if (!viewer) return;

    const breadcrumbs = getBreadcrumbs();
    const recent = breadcrumbs.slice(-30).reverse();

    if (recent.length === 0) {
        viewer.innerHTML =
            '<p class="debug-log-empty">No breadcrumbs yet. Interact with the app to see breadcrumbs.</p>';
        return;
    }

    viewer.innerHTML = recent
        .map(crumb => {
            const time = new Date(crumb.timestamp).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            const typeClass = crumb.type === 'error' ? 'error' : 'info';

            return `
                <div class="debug-log-entry ${typeClass}">
                    <span class="debug-log-time">${time}</span>
                    <span class="debug-log-category">${escapeHtml(crumb.type)}</span>
                    <span class="debug-log-message">${escapeHtml(crumb.message)}</span>
                </div>
            `;
        })
        .join('');
}

/**
 * Initialize breadcrumb controls
 */
export function initBreadcrumbControls(): void {
    const clearBtn = document.getElementById('debug-clear-breadcrumbs');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearBreadcrumbs();
            updateBreadcrumbViewer();
        });
    }

    const exportBtn = document.getElementById('debug-export-breadcrumbs');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const json = exportBreadcrumbs();
            downloadJson(json, `megabonk-breadcrumbs-${Date.now()}.json`);
        });
    }
}

// ========================================
// Request Timing Display
// ========================================

/**
 * Update request timing viewer
 */
export function updateRequestViewer(): void {
    const viewer = document.getElementById('debug-request-viewer');
    if (!viewer) return;

    const stats = requestTimer.getStats();

    if (stats.totalRequests === 0) {
        viewer.innerHTML = '<p class="debug-log-empty">No requests tracked yet.</p>';
        return;
    }

    let html = `
        <div class="debug-stats-row">
            <span>Total Requests:</span>
            <span>${stats.totalRequests}</span>
        </div>
        <div class="debug-stats-row">
            <span>Successful:</span>
            <span class="success">${stats.successfulRequests}</span>
        </div>
        <div class="debug-stats-row">
            <span>Failed:</span>
            <span class="error">${stats.failedRequests}</span>
        </div>
        <div class="debug-stats-row">
            <span>Cached:</span>
            <span>${stats.cachedRequests}</span>
        </div>
        <div class="debug-stats-row">
            <span>Avg Duration:</span>
            <span>${stats.averageDurationMs}ms</span>
        </div>
    `;

    if (stats.slowestRequest) {
        html += `
            <div class="debug-stats-row warning">
                <span>Slowest:</span>
                <span>${stats.slowestRequest.durationMs}ms (${stats.slowestRequest.url.slice(-30)})</span>
            </div>
        `;
    }

    html += '<hr><h4>Recent Requests</h4>';

    stats.recentRequests.reverse().forEach(req => {
        const statusClass = (req.status ?? 0) === 0 ? 'error' : (req.status ?? 0) >= 400 ? 'warning' : 'success';
        html += `
            <div class="debug-log-entry ${statusClass}">
                <span class="debug-log-time">${req.durationMs || 0}ms</span>
                <span class="debug-log-category">${req.method} ${req.status}</span>
                <span class="debug-log-message">${escapeHtml(req.url.slice(-50))}</span>
            </div>
        `;
    });

    viewer.innerHTML = html;
}

// ========================================
// State Snapshot Display
// ========================================

/**
 * Update state snapshot viewer
 */
export function updateStateViewer(): void {
    const viewer = document.getElementById('debug-state-viewer');
    if (!viewer) return;

    const snapshot = captureStateSnapshot();

    const html = `
        <pre class="debug-state-json">${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
    `;

    viewer.innerHTML = html;
}

/**
 * Initialize state controls
 */
export function initStateControls(): void {
    const refreshBtn = document.getElementById('debug-refresh-state');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            updateStateViewer();
        });
    }

    const exportBtn = document.getElementById('debug-export-state');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const snapshot = captureStateSnapshot();
            downloadJson(JSON.stringify(snapshot, null, 2), `megabonk-state-${Date.now()}.json`);
        });
    }
}

// ========================================
// Debug Tab Switching
// ========================================

/**
 * Initialize debug tab switching
 */
export function initDebugTabs(): void {
    const tabButtons = document.querySelectorAll('[data-debug-tab]');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = (btn as HTMLElement).dataset.debugTab as typeof activeDebugTab;
            switchDebugTab(tab);
        });
    });
}

/**
 * Switch active debug tab
 */
export function switchDebugTab(tab: typeof activeDebugTab): void {
    activeDebugTab = tab;

    // Update tab buttons
    document.querySelectorAll('[data-debug-tab]').forEach(btn => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.debugTab === tab);
    });

    // Update tab content
    document.querySelectorAll('[data-debug-content]').forEach(content => {
        const contentTab = (content as HTMLElement).dataset.debugContent;
        (content as HTMLElement).style.display = contentTab === tab ? 'block' : 'none';
    });

    // Update content
    switch (tab) {
        case 'logs':
            updateLogViewer();
            break;
        case 'breadcrumbs':
            updateBreadcrumbViewer();
            break;
        case 'requests':
            updateRequestViewer();
            break;
        case 'state':
            updateStateViewer();
            break;
    }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Download JSON string as file
 */
function downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ========================================
// Export
// ========================================

export { isDebugEnabled, setDebugEnabled };
