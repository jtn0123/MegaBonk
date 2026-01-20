// ========================================
// Debug UI Module
// ========================================
// Handles the debug panel UI interactions
// and integrates with the CV debug system
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

import type { DebugLogEntry } from '../types/computer-vision';

// ========================================
// State
// ========================================

let isExpanded = false;
let currentLogFilter: string = 'all';
let lastOverlayUrl: string | null = null;

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
    setInterval(() => {
        if (isExpanded) {
            updateStats();
            updateLogViewer();
        }
    }, 1000);
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
        <div class="debug-log-entry ${log.level}">
            <span class="debug-log-time">${time}</span>
            <span class="debug-log-category">${log.category}</span>
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
// Export
// ========================================

export { isDebugEnabled, setDebugEnabled };
