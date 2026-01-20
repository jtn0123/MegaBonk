/**
 * Tests for debug-ui.ts module
 * Tests debug panel UI interactions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before import
vi.mock('../../src/modules/image-recognition-debug', () => ({
    setDebugEnabled: vi.fn(),
    isDebugEnabled: vi.fn().mockReturnValue(false),
    setDebugOptions: vi.fn(),
    getDebugOptions: vi.fn().mockReturnValue({
        showRegionBounds: true,
        showSlotGrid: false,
        showConfidenceLabels: true,
        showDetectionBoxes: true,
        showVarianceHeatmap: false,
        showDominantColors: false,
    }),
    getLogs: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockReturnValue({
        totalDetections: 10,
        averageConfidence: 0.85,
        averageProcessingTime: 150,
        templateCacheHits: 5,
        templateCacheMisses: 2,
    }),
    clearLogs: vi.fn(),
    resetStats: vi.fn(),
    exportLogs: vi.fn().mockReturnValue('[]'),
    downloadDebugImage: vi.fn(),
}));

vi.mock('../../src/modules/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

import {
    initDebugPanel,
    cleanupDebugPanel,
    updateStats,
    updateLogViewer,
    setLastOverlayUrl,
} from '../../src/modules/debug-ui.ts';
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
} from '../../src/modules/image-recognition-debug';
import { logger } from '../../src/modules/logger';

describe('debug-ui - initDebugPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-stat-total"></div>
                    <div id="debug-stat-confidence"></div>
                    <div id="debug-stat-time"></div>
                    <div id="debug-stat-cache"></div>
                    <select id="debug-log-filter">
                        <option value="all">All</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                    </select>
                    <div id="debug-log-viewer"></div>
                    <button id="debug-export-logs"></button>
                    <button id="debug-clear-logs"></button>
                    <button id="debug-reset-stats"></button>
                    <button id="debug-download-overlay" disabled></button>
                    <input type="checkbox" id="debug-show-regions" />
                    <input type="checkbox" id="debug-show-slots" />
                    <input type="checkbox" id="debug-show-labels" />
                    <input type="checkbox" id="debug-show-detections" />
                    <input type="checkbox" id="debug-show-heatmap" />
                    <input type="checkbox" id="debug-show-colors" />
                </div>
            </div>
        `;
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should initialize with debug mode checkbox', () => {
        initDebugPanel();

        const checkbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
    });

    it('should read initial debug state from isDebugEnabled', () => {
        vi.mocked(isDebugEnabled).mockReturnValueOnce(true);

        initDebugPanel();

        const checkbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should add active class when debug mode is initially enabled', () => {
        vi.mocked(isDebugEnabled).mockReturnValueOnce(true);

        initDebugPanel();

        const panel = document.getElementById('debug-panel');
        expect(panel?.classList.contains('active')).toBe(true);
    });

    it('should toggle debug mode on checkbox change', () => {
        initDebugPanel();

        const checkbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(setDebugEnabled).toHaveBeenCalledWith(true);
    });

    it('should toggle panel active class on debug mode change', () => {
        initDebugPanel();

        const checkbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        const panel = document.getElementById('debug-panel');

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(panel?.classList.contains('active')).toBe(true);
    });

    it('should expand panel on expand button click', () => {
        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn');
        const panel = document.getElementById('debug-panel');
        const content = document.getElementById('debug-panel-content');

        expandBtn?.click();

        expect(panel?.classList.contains('expanded')).toBe(true);
        expect(content?.style.display).toBe('block');
    });

    it('should collapse panel on second expand button click', () => {
        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn');
        const content = document.getElementById('debug-panel-content');

        expandBtn?.click(); // Expand
        expandBtn?.click(); // Collapse

        expect(content?.style.display).toBe('none');
    });

    it('should update stats when panel expanded', () => {
        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn');
        expandBtn?.click();

        expect(getStats).toHaveBeenCalled();
    });

    it('should warn when required elements are missing', () => {
        document.body.innerHTML = '<div id="debug-panel"></div>';

        initDebugPanel();

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'debug_ui.init',
            })
        );
    });

    it('should start periodic stats update', () => {
        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn');
        expandBtn?.click(); // Expand to enable updates

        vi.advanceTimersByTime(1000);

        expect(getStats).toHaveBeenCalled();
    });
});

describe('debug-ui - updateStats', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="debug-stat-total"></div>
            <div id="debug-stat-confidence"></div>
            <div id="debug-stat-time"></div>
            <div id="debug-stat-cache"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should update total detections display', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 42,
            averageConfidence: 0.85,
            averageProcessingTime: 150,
            templateCacheHits: 5,
            templateCacheMisses: 2,
        });

        updateStats();

        const totalEl = document.getElementById('debug-stat-total');
        expect(totalEl?.textContent).toBe('42');
    });

    it('should update confidence display as percentage', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 10,
            averageConfidence: 0.857,
            averageProcessingTime: 150,
            templateCacheHits: 5,
            templateCacheMisses: 2,
        });

        updateStats();

        const confidenceEl = document.getElementById('debug-stat-confidence');
        expect(confidenceEl?.textContent).toBe('85.7%');
    });

    it('should show dash for zero confidence', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            templateCacheHits: 0,
            templateCacheMisses: 0,
        });

        updateStats();

        const confidenceEl = document.getElementById('debug-stat-confidence');
        expect(confidenceEl?.textContent).toBe('-');
    });

    it('should update processing time display', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 10,
            averageConfidence: 0.85,
            averageProcessingTime: 156.7,
            templateCacheHits: 5,
            templateCacheMisses: 2,
        });

        updateStats();

        const timeEl = document.getElementById('debug-stat-time');
        expect(timeEl?.textContent).toBe('157ms');
    });

    it('should show dash for zero processing time', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            templateCacheHits: 0,
            templateCacheMisses: 0,
        });

        updateStats();

        const timeEl = document.getElementById('debug-stat-time');
        expect(timeEl?.textContent).toBe('-');
    });

    it('should update cache display as hits/total', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 10,
            averageConfidence: 0.85,
            averageProcessingTime: 150,
            templateCacheHits: 5,
            templateCacheMisses: 2,
        });

        updateStats();

        const cacheEl = document.getElementById('debug-stat-cache');
        expect(cacheEl?.textContent).toBe('5/7');
    });

    it('should show 0/0 for no cache activity', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            templateCacheHits: 0,
            templateCacheMisses: 0,
        });

        updateStats();

        const cacheEl = document.getElementById('debug-stat-cache');
        expect(cacheEl?.textContent).toBe('0/0');
    });

    it('should handle missing DOM elements gracefully', () => {
        document.body.innerHTML = '';

        expect(() => updateStats()).not.toThrow();
    });
});

describe('debug-ui - updateLogViewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="debug-log-viewer"></div>
            <select id="debug-log-filter">
                <option value="all">All</option>
            </select>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display empty state when no logs', () => {
        vi.mocked(getLogs).mockReturnValue([]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer');
        expect(viewer?.innerHTML).toContain('No logs yet');
    });

    it('should display log entries', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Test message' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer');
        expect(viewer?.innerHTML).toContain('Test message');
        expect(viewer?.innerHTML).toContain('cv');
    });

    it('should limit to 50 most recent logs', () => {
        const manyLogs = Array.from({ length: 60 }, (_, i) => ({
            timestamp: Date.now() + i,
            level: 'info' as const,
            category: 'cv',
            message: `Log ${i}`,
        }));

        vi.mocked(getLogs).mockReturnValue(manyLogs);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer');
        const entries = viewer?.querySelectorAll('.debug-log-entry');
        expect(entries?.length).toBe(50);
    });

    it('should show most recent logs first (reversed)', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: 1000, level: 'info', category: 'cv', message: 'First' },
            { timestamp: 2000, level: 'info', category: 'cv', message: 'Second' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer');
        const entries = viewer?.querySelectorAll('.debug-log-entry');
        expect(entries?.[0]?.innerHTML).toContain('Second');
    });

    it('should handle missing log viewer element', () => {
        document.body.innerHTML = '';

        expect(() => updateLogViewer()).not.toThrow();
    });

    it('should escape HTML in log messages', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: '<script>alert("xss")</script>' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer');
        expect(viewer?.innerHTML).not.toContain('<script>');
    });
});

describe('debug-ui - setLastOverlayUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <button id="debug-download-overlay" disabled></button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should enable download button when URL set', () => {
        setLastOverlayUrl('data:image/png;base64,test');

        const btn = document.getElementById('debug-download-overlay') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });

    it('should disable download button when URL cleared', () => {
        setLastOverlayUrl('data:image/png;base64,test');
        setLastOverlayUrl(null);

        const btn = document.getElementById('debug-download-overlay') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
    });

    it('should handle missing button element', () => {
        document.body.innerHTML = '';

        expect(() => setLastOverlayUrl('test')).not.toThrow();
    });
});

describe('debug-ui - cleanupDebugPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should clear update interval', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;"></div>
            </div>
        `;

        initDebugPanel();
        cleanupDebugPanel();

        // Interval should be cleared - no more updates after cleanup
        vi.advanceTimersByTime(5000);
        // If interval was cleared, getStats won't be called after cleanup
        const callCountBeforeAdvance = vi.mocked(getStats).mock.calls.length;
        vi.advanceTimersByTime(1000);
        const callCountAfterAdvance = vi.mocked(getStats).mock.calls.length;

        // Calls should be the same since interval was cleared
        expect(callCountAfterAdvance).toBe(callCountBeforeAdvance);
    });

    it('should be safe to call multiple times', () => {
        expect(() => {
            cleanupDebugPanel();
            cleanupDebugPanel();
            cleanupDebugPanel();
        }).not.toThrow();
    });
});

describe('debug-ui - overlay options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <input type="checkbox" id="debug-show-regions" />
                    <input type="checkbox" id="debug-show-slots" />
                    <input type="checkbox" id="debug-show-labels" />
                    <input type="checkbox" id="debug-show-detections" />
                    <input type="checkbox" id="debug-show-heatmap" />
                    <input type="checkbox" id="debug-show-colors" />
                </div>
            </div>
        `;
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should initialize checkbox states from options', () => {
        vi.mocked(getDebugOptions).mockReturnValue({
            showRegionBounds: true,
            showSlotGrid: false,
            showConfidenceLabels: true,
            showDetectionBoxes: true,
            showVarianceHeatmap: false,
            showDominantColors: false,
        });

        initDebugPanel();

        const regionsCheckbox = document.getElementById('debug-show-regions') as HTMLInputElement;
        const slotsCheckbox = document.getElementById('debug-show-slots') as HTMLInputElement;

        expect(regionsCheckbox.checked).toBe(true);
        expect(slotsCheckbox.checked).toBe(false);
    });

    it('should update options on checkbox change', () => {
        initDebugPanel();

        const regionsCheckbox = document.getElementById('debug-show-regions') as HTMLInputElement;
        regionsCheckbox.checked = false;
        regionsCheckbox.dispatchEvent(new Event('change'));

        expect(setDebugOptions).toHaveBeenCalledWith({ showRegionBounds: false });
    });
});

describe('debug-ui - action buttons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock URL APIs
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        global.URL.revokeObjectURL = vi.fn();

        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-log-viewer"></div>
                    <button id="debug-export-logs"></button>
                    <button id="debug-clear-logs"></button>
                    <button id="debug-reset-stats"></button>
                    <button id="debug-download-overlay"></button>
                    <div id="debug-stat-total"></div>
                    <div id="debug-stat-confidence"></div>
                    <div id="debug-stat-time"></div>
                    <div id="debug-stat-cache"></div>
                </div>
            </div>
        `;
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should export logs on button click', () => {
        initDebugPanel();

        const exportBtn = document.getElementById('debug-export-logs');
        exportBtn?.click();

        expect(exportLogs).toHaveBeenCalled();
    });

    it('should clear logs on button click', () => {
        initDebugPanel();

        const clearBtn = document.getElementById('debug-clear-logs');
        clearBtn?.click();

        expect(clearLogs).toHaveBeenCalled();
    });

    it('should reset stats on button click', () => {
        initDebugPanel();

        const resetBtn = document.getElementById('debug-reset-stats');
        resetBtn?.click();

        expect(resetStats).toHaveBeenCalled();
    });

    it('should download overlay when URL is set', () => {
        initDebugPanel();
        setLastOverlayUrl('data:image/png;base64,test');

        const downloadBtn = document.getElementById('debug-download-overlay');
        downloadBtn?.click();

        expect(downloadDebugImage).toHaveBeenCalledWith(
            'data:image/png;base64,test',
            expect.stringContaining('debug-overlay-')
        );
    });

    it('should not download when no overlay URL', () => {
        initDebugPanel();
        setLastOverlayUrl(null);

        const downloadBtn = document.getElementById('debug-download-overlay');
        downloadBtn?.click();

        expect(downloadDebugImage).not.toHaveBeenCalled();
    });
});

describe('debug-ui - log filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <select id="debug-log-filter">
                        <option value="all">All</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                    </select>
                    <div id="debug-log-viewer"></div>
                </div>
            </div>
        `;
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should filter logs by level on dropdown change', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Info message' },
            { timestamp: Date.now(), level: 'warn', category: 'cv', message: 'Warn message' },
            { timestamp: Date.now(), level: 'error', category: 'cv', message: 'Error message' },
        ]);

        initDebugPanel();

        const filterSelect = document.getElementById('debug-log-filter') as HTMLSelectElement;
        filterSelect.value = 'error';
        filterSelect.dispatchEvent(new Event('change'));

        // After filter change, updateLogViewer should be called
        // The viewer should only show error logs
        const viewer = document.getElementById('debug-log-viewer');
        expect(viewer?.innerHTML).toContain('Error message');
    });
});
