/**
 * Extended tests for debug-ui.ts module
 * Focuses on:
 * 1. Debug panel rendering edge cases
 * 2. Performance metrics display variations
 * 3. Log output formatting details
 * Target: 80%+ coverage
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
    requestTimer: {
        getStats: vi.fn().mockReturnValue({
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cachedRequests: 0,
            averageDurationMs: 0,
            slowestRequest: undefined,
            recentRequests: [],
        }),
    },
}));

vi.mock('../../src/modules/breadcrumbs', () => ({
    getBreadcrumbs: vi.fn().mockReturnValue([]),
    clearBreadcrumbs: vi.fn(),
    exportBreadcrumbs: vi.fn().mockReturnValue('[]'),
    captureStateSnapshot: vi.fn().mockReturnValue({ test: 'state' }),
}));

import {
    initDebugPanel,
    cleanupDebugPanel,
    updateStats,
    updateLogViewer,
    setLastOverlayUrl,
    initConfidenceSlider,
    getConfidenceThreshold,
    setConfidenceThreshold,
    updateBreadcrumbViewer,
    initBreadcrumbControls,
    updateRequestViewer,
    updateStateViewer,
    initStateControls,
    initDebugTabs,
    switchDebugTab,
    isDebugEnabled,
    setDebugEnabled,
} from '../../src/modules/debug-ui';

import {
    setDebugEnabled as mockSetDebugEnabled,
    isDebugEnabled as mockIsDebugEnabled,
    setDebugOptions,
    getDebugOptions,
    getLogs,
    getStats,
    clearLogs,
    resetStats,
    exportLogs,
    downloadDebugImage,
} from '../../src/modules/image-recognition-debug';

import { logger, requestTimer } from '../../src/modules/logger';
import { getBreadcrumbs, clearBreadcrumbs, exportBreadcrumbs, captureStateSnapshot } from '../../src/modules/breadcrumbs';

// ============================================
// Debug Panel Rendering Tests
// ============================================

describe('debug-ui extended - panel rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock URL APIs
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should warn when only panel is present but other elements missing', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
            </div>
        `;

        initDebugPanel();

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'debug_ui.init',
                data: expect.objectContaining({
                    hasPanel: true,
                    hasExpandBtn: true,
                    hasCheckbox: false,
                    hasContent: false,
                }),
            })
        );
    });

    it('should warn when only checkbox and panel are present', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <input type="checkbox" id="scan-debug-mode" />
            </div>
        `;

        initDebugPanel();

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'debug_ui.init',
                data: expect.objectContaining({
                    hasPanel: true,
                    hasExpandBtn: false,
                    hasCheckbox: true,
                    hasContent: false,
                }),
            })
        );
    });

    it('should not warn when all elements are present', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        initDebugPanel();

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should toggle expanded class correctly on multiple clicks', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;"></div>
            </div>
        `;

        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn')!;
        const panel = document.getElementById('debug-panel')!;
        const content = document.getElementById('debug-panel-content')!;

        // First click - expand
        expandBtn.click();
        expect(panel.classList.contains('expanded')).toBe(true);
        expect(content.style.display).toBe('block');

        // Second click - collapse
        expandBtn.click();
        expect(panel.classList.contains('expanded')).toBe(false);
        expect(content.style.display).toBe('none');

        // Third click - expand again
        expandBtn.click();
        expect(panel.classList.contains('expanded')).toBe(true);
        expect(content.style.display).toBe('block');
    });

    it('should stop event propagation on expand button click', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;"></div>
            </div>
        `;

        initDebugPanel();

        const panel = document.getElementById('debug-panel')!;
        const expandBtn = document.getElementById('debug-expand-btn')!;

        let panelClicked = false;
        panel.addEventListener('click', () => {
            panelClicked = true;
        });

        expandBtn.click();

        // Propagation should be stopped - panel click listener shouldn't fire from button
        expect(panelClicked).toBe(false);
    });

    it('should toggle active class on panel when debug checkbox changes', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        initDebugPanel();

        const checkbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        const panel = document.getElementById('debug-panel')!;

        // Enable debug
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
        expect(panel.classList.contains('active')).toBe(true);

        // Disable debug
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
        expect(panel.classList.contains('active')).toBe(false);
    });

    it('should update stats and logs on panel expansion', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-stat-total"></div>
                    <div id="debug-log-viewer"></div>
                </div>
            </div>
        `;

        vi.mocked(getStats).mockReturnValue({
            totalDetections: 42,
            averageConfidence: 0.9,
            averageProcessingTime: 100,
            templateCacheHits: 10,
            templateCacheMisses: 5,
        });

        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn')!;
        expandBtn.click();

        expect(getStats).toHaveBeenCalled();
        expect(getLogs).toHaveBeenCalled();
    });

    it('should periodically update stats when expanded', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-stat-total"></div>
                    <div id="debug-log-viewer"></div>
                </div>
            </div>
        `;

        initDebugPanel();

        const expandBtn = document.getElementById('debug-expand-btn')!;
        expandBtn.click();

        const initialCalls = vi.mocked(getStats).mock.calls.length;

        vi.advanceTimersByTime(1000);
        expect(vi.mocked(getStats).mock.calls.length).toBeGreaterThan(initialCalls);

        vi.advanceTimersByTime(1000);
        expect(vi.mocked(getStats).mock.calls.length).toBeGreaterThan(initialCalls + 1);
    });

    it('should not update stats when collapsed', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-stat-total"></div>
                </div>
            </div>
        `;

        initDebugPanel();

        // Don't click expand - panel stays collapsed
        vi.mocked(getStats).mockClear();

        vi.advanceTimersByTime(5000);

        // Should not have called getStats because panel is not expanded
        expect(vi.mocked(getStats).mock.calls.length).toBe(0);
    });
});

// ============================================
// Performance Metrics Display Tests
// ============================================

describe('debug-ui extended - performance metrics', () => {
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

    it('should display exact integer for total detections', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 12345,
            averageConfidence: 0.5,
            averageProcessingTime: 50,
            templateCacheHits: 1,
            templateCacheMisses: 1,
        });

        updateStats();

        expect(document.getElementById('debug-stat-total')?.textContent).toBe('12345');
    });

    it('should display 0 for zero detections', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            templateCacheHits: 0,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-total')?.textContent).toBe('0');
    });

    it('should display confidence with one decimal place', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.956,
            averageProcessingTime: 100,
            templateCacheHits: 1,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-confidence')?.textContent).toBe('95.6%');
    });

    it('should round confidence correctly', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.9999,
            averageProcessingTime: 100,
            templateCacheHits: 1,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-confidence')?.textContent).toBe('100.0%');
    });

    it('should display processing time rounded to integer', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.5,
            averageProcessingTime: 123.456,
            templateCacheHits: 1,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-time')?.textContent).toBe('123ms');
    });

    it('should round processing time up correctly', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.5,
            averageProcessingTime: 99.9,
            templateCacheHits: 1,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-time')?.textContent).toBe('100ms');
    });

    it('should display cache ratio correctly for all hits', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.5,
            averageProcessingTime: 50,
            templateCacheHits: 100,
            templateCacheMisses: 0,
        });

        updateStats();

        expect(document.getElementById('debug-stat-cache')?.textContent).toBe('100/100');
    });

    it('should display cache ratio correctly for all misses', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 1,
            averageConfidence: 0.5,
            averageProcessingTime: 50,
            templateCacheHits: 0,
            templateCacheMisses: 50,
        });

        updateStats();

        expect(document.getElementById('debug-stat-cache')?.textContent).toBe('0/50');
    });

    it('should handle very large numbers', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 999999,
            averageConfidence: 0.123,
            averageProcessingTime: 9999,
            templateCacheHits: 10000,
            templateCacheMisses: 5000,
        });

        updateStats();

        expect(document.getElementById('debug-stat-total')?.textContent).toBe('999999');
        expect(document.getElementById('debug-stat-confidence')?.textContent).toBe('12.3%');
        expect(document.getElementById('debug-stat-time')?.textContent).toBe('9999ms');
        expect(document.getElementById('debug-stat-cache')?.textContent).toBe('10000/15000');
    });

    it('should handle partial missing DOM elements', () => {
        document.body.innerHTML = `
            <div id="debug-stat-total"></div>
        `;

        vi.mocked(getStats).mockReturnValue({
            totalDetections: 42,
            averageConfidence: 0.5,
            averageProcessingTime: 100,
            templateCacheHits: 5,
            templateCacheMisses: 5,
        });

        expect(() => updateStats()).not.toThrow();
        expect(document.getElementById('debug-stat-total')?.textContent).toBe('42');
    });

    it('should handle only confidence element present', () => {
        document.body.innerHTML = `
            <div id="debug-stat-confidence"></div>
        `;

        vi.mocked(getStats).mockReturnValue({
            totalDetections: 10,
            averageConfidence: 0.75,
            averageProcessingTime: 100,
            templateCacheHits: 5,
            templateCacheMisses: 5,
        });

        expect(() => updateStats()).not.toThrow();
        expect(document.getElementById('debug-stat-confidence')?.textContent).toBe('75.0%');
    });
});

// ============================================
// Log Output Formatting Tests
// ============================================

describe('debug-ui extended - log formatting', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="debug-log-viewer"></div>
            <select id="debug-log-filter">
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
            </select>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should format log time in 24-hour format', () => {
        const timestamp = new Date('2024-01-15T14:30:45').getTime();
        vi.mocked(getLogs).mockReturnValue([
            { timestamp, level: 'info', category: 'test', message: 'Test' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('14:30:45');
    });

    it('should include log level class for info', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Info message' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.querySelector('.debug-log-entry.info')).not.toBeNull();
    });

    it('should include log level class for warn', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'warn', category: 'cv', message: 'Warning message' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.querySelector('.debug-log-entry.warn')).not.toBeNull();
    });

    it('should include log level class for error', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'error', category: 'cv', message: 'Error message' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.querySelector('.debug-log-entry.error')).not.toBeNull();
    });

    it('should escape angle brackets in messages', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'test', message: '<div>test</div>' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('&lt;div&gt;');
        expect(viewer.innerHTML).not.toContain('<div>test</div>');
    });

    it('should escape ampersands in messages', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'test', message: 'a & b' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('&amp;');
    });

    it('should escape quotes in messages', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'test', message: 'say "hello"' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        // The message should be safely escaped
        expect(viewer.textContent).toContain('say "hello"');
    });

    it('should display category in log entry', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'computer-vision', message: 'Test' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.querySelector('.debug-log-category')?.textContent).toBe('computer-vision');
    });

    it('should handle empty category', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: '', message: 'No category' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.querySelector('.debug-log-category')?.textContent).toBe('');
    });

    it('should handle very long messages', () => {
        const longMessage = 'A'.repeat(1000);
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'test', message: longMessage },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.textContent).toContain(longMessage);
    });

    it('should filter logs by info level', () => {
        document.body.innerHTML = `
            <div id="debug-log-viewer"></div>
            <select id="debug-log-filter">
                <option value="all">All</option>
                <option value="info">Info</option>
            </select>
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Info log' },
            { timestamp: Date.now(), level: 'warn', category: 'cv', message: 'Warn log' },
            { timestamp: Date.now(), level: 'error', category: 'cv', message: 'Error log' },
        ]);

        initDebugPanel();

        const filter = document.getElementById('debug-log-filter') as HTMLSelectElement;
        filter.value = 'info';
        filter.dispatchEvent(new Event('change'));

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('Info log');
        expect(viewer.innerHTML).not.toContain('Warn log');
        expect(viewer.innerHTML).not.toContain('Error log');

        cleanupDebugPanel();
    });

    it('should show all logs when filter is all', () => {
        document.body.innerHTML = `
            <div id="debug-log-viewer"></div>
            <select id="debug-log-filter">
                <option value="all">All</option>
            </select>
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Info log' },
            { timestamp: Date.now(), level: 'warn', category: 'cv', message: 'Warn log' },
            { timestamp: Date.now(), level: 'error', category: 'cv', message: 'Error log' },
        ]);

        initDebugPanel();

        const filter = document.getElementById('debug-log-filter') as HTMLSelectElement;
        filter.value = 'all';
        filter.dispatchEvent(new Event('change'));

        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('Info log');
        expect(viewer.innerHTML).toContain('Warn log');
        expect(viewer.innerHTML).toContain('Error log');

        cleanupDebugPanel();
    });

    it('should preserve order with newest first', () => {
        const now = Date.now();
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: now - 2000, level: 'info', category: 'cv', message: 'Oldest' },
            { timestamp: now - 1000, level: 'info', category: 'cv', message: 'Middle' },
            { timestamp: now, level: 'info', category: 'cv', message: 'Newest' },
        ]);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        const entries = viewer.querySelectorAll('.debug-log-entry');

        expect(entries[0].textContent).toContain('Newest');
        expect(entries[1].textContent).toContain('Middle');
        expect(entries[2].textContent).toContain('Oldest');
    });

    it('should handle exactly 50 logs without truncation', () => {
        const logs = Array.from({ length: 50 }, (_, i) => ({
            timestamp: Date.now() + i,
            level: 'info' as const,
            category: 'cv',
            message: `Log ${i}`,
        }));

        vi.mocked(getLogs).mockReturnValue(logs);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        const entries = viewer.querySelectorAll('.debug-log-entry');
        expect(entries.length).toBe(50);
    });

    it('should truncate to 50 logs when more are available', () => {
        const logs = Array.from({ length: 100 }, (_, i) => ({
            timestamp: Date.now() + i,
            level: 'info' as const,
            category: 'cv',
            message: `Log ${i}`,
        }));

        vi.mocked(getLogs).mockReturnValue(logs);

        updateLogViewer();

        const viewer = document.getElementById('debug-log-viewer')!;
        const entries = viewer.querySelectorAll('.debug-log-entry');
        expect(entries.length).toBe(50);

        // Should contain the newest logs (50-99)
        expect(viewer.innerHTML).toContain('Log 99');
        expect(viewer.innerHTML).toContain('Log 50');
        expect(viewer.innerHTML).not.toContain('Log 49');
    });
});

// ============================================
// Overlay Options Tests
// ============================================

describe('debug-ui extended - overlay options', () => {
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

    it('should handle all options being true', () => {
        vi.mocked(getDebugOptions).mockReturnValue({
            showRegionBounds: true,
            showSlotGrid: true,
            showConfidenceLabels: true,
            showDetectionBoxes: true,
            showVarianceHeatmap: true,
            showDominantColors: true,
        });

        initDebugPanel();

        expect((document.getElementById('debug-show-regions') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('debug-show-slots') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('debug-show-labels') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('debug-show-detections') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('debug-show-heatmap') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('debug-show-colors') as HTMLInputElement).checked).toBe(true);
    });

    it('should handle all options being false', () => {
        vi.mocked(getDebugOptions).mockReturnValue({
            showRegionBounds: false,
            showSlotGrid: false,
            showConfidenceLabels: false,
            showDetectionBoxes: false,
            showVarianceHeatmap: false,
            showDominantColors: false,
        });

        initDebugPanel();

        expect((document.getElementById('debug-show-regions') as HTMLInputElement).checked).toBe(false);
        expect((document.getElementById('debug-show-slots') as HTMLInputElement).checked).toBe(false);
    });

    it('should call setDebugOptions for each checkbox change', () => {
        initDebugPanel();

        const heatmapCheckbox = document.getElementById('debug-show-heatmap') as HTMLInputElement;
        heatmapCheckbox.checked = true;
        heatmapCheckbox.dispatchEvent(new Event('change'));

        expect(setDebugOptions).toHaveBeenCalledWith({ showVarianceHeatmap: true });
    });

    it('should handle missing checkbox elements gracefully', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        expect(() => initDebugPanel()).not.toThrow();
    });
});

// ============================================
// Action Button Tests
// ============================================

describe('debug-ui extended - action buttons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        global.URL.revokeObjectURL = vi.fn();

        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content" style="display: none;">
                    <div id="debug-log-viewer"></div>
                    <div id="debug-stat-total"></div>
                    <div id="debug-stat-confidence"></div>
                    <div id="debug-stat-time"></div>
                    <div id="debug-stat-cache"></div>
                    <button id="debug-export-logs"></button>
                    <button id="debug-clear-logs"></button>
                    <button id="debug-reset-stats"></button>
                    <button id="debug-download-overlay"></button>
                </div>
            </div>
        `;
    });

    afterEach(() => {
        cleanupDebugPanel();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should create and trigger download link for export', () => {
        vi.mocked(exportLogs).mockReturnValue('{"logs": []}');

        initDebugPanel();

        let createdLink: HTMLAnchorElement | null = null;
        const originalAppendChild = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
            if (node instanceof HTMLAnchorElement) {
                createdLink = node;
            }
            return originalAppendChild(node);
        });

        const exportBtn = document.getElementById('debug-export-logs')!;
        exportBtn.click();

        expect(exportLogs).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should update log viewer after clearing logs', () => {
        vi.mocked(getLogs).mockReturnValue([
            { timestamp: Date.now(), level: 'info', category: 'cv', message: 'Test' },
        ]);

        initDebugPanel();

        // First, check that logs are shown
        updateLogViewer();
        const viewer = document.getElementById('debug-log-viewer')!;
        expect(viewer.innerHTML).toContain('Test');

        // Clear logs - mock will now return empty
        vi.mocked(getLogs).mockReturnValue([]);
        const clearBtn = document.getElementById('debug-clear-logs')!;
        clearBtn.click();

        expect(clearLogs).toHaveBeenCalled();
        expect(viewer.innerHTML).toContain('No logs yet');
    });

    it('should update stats after resetting', () => {
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 100,
            averageConfidence: 0.9,
            averageProcessingTime: 200,
            templateCacheHits: 50,
            templateCacheMisses: 10,
        });

        initDebugPanel();
        updateStats();

        expect(document.getElementById('debug-stat-total')?.textContent).toBe('100');

        // Reset - mock will return zeros
        vi.mocked(getStats).mockReturnValue({
            totalDetections: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            templateCacheHits: 0,
            templateCacheMisses: 0,
        });

        const resetBtn = document.getElementById('debug-reset-stats')!;
        resetBtn.click();

        expect(resetStats).toHaveBeenCalled();
        expect(document.getElementById('debug-stat-total')?.textContent).toBe('0');
    });

    it('should handle download overlay with data URL', () => {
        initDebugPanel();
        setLastOverlayUrl('data:image/png;base64,iVBORw0KGgoAAAANS');

        const downloadBtn = document.getElementById('debug-download-overlay')!;
        downloadBtn.click();

        expect(downloadDebugImage).toHaveBeenCalledWith(
            'data:image/png;base64,iVBORw0KGgoAAAANS',
            expect.stringContaining('debug-overlay-')
        );
    });
});

// ============================================
// Request Viewer Extended Tests
// ============================================

describe('debug-ui extended - request viewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="debug-request-viewer"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show warning class for 4xx status codes', () => {
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 1,
            successfulRequests: 0,
            failedRequests: 1,
            cachedRequests: 0,
            averageDurationMs: 50,
            slowestRequest: undefined,
            recentRequests: [
                { url: '/api/not-found', method: 'GET', startTime: 0, durationMs: 50, status: 404 },
            ],
        });

        updateRequestViewer();

        const viewer = document.getElementById('debug-request-viewer')!;
        expect(viewer.innerHTML).toContain('warning');
    });

    it('should show success class for 2xx status codes', () => {
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 1,
            successfulRequests: 1,
            failedRequests: 0,
            cachedRequests: 0,
            averageDurationMs: 50,
            slowestRequest: undefined,
            recentRequests: [
                { url: '/api/success', method: 'GET', startTime: 0, durationMs: 50, status: 200 },
            ],
        });

        updateRequestViewer();

        const viewer = document.getElementById('debug-request-viewer')!;
        expect(viewer.innerHTML).toContain('success');
    });

    it('should handle null duration in requests', () => {
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 1,
            successfulRequests: 1,
            failedRequests: 0,
            cachedRequests: 0,
            averageDurationMs: 0,
            slowestRequest: undefined,
            recentRequests: [
                { url: '/api/test', method: 'GET', startTime: 0, durationMs: undefined as unknown as number, status: 200 },
            ],
        });

        updateRequestViewer();

        const viewer = document.getElementById('debug-request-viewer')!;
        expect(viewer.innerHTML).toContain('0ms');
    });

    it('should truncate long URLs in display', () => {
        const longUrl = 'https://example.com/api/very-long-path-that-exceeds-fifty-characters-limit/more-stuff';
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 1,
            successfulRequests: 1,
            failedRequests: 0,
            cachedRequests: 0,
            averageDurationMs: 50,
            slowestRequest: {
                url: longUrl,
                method: 'GET',
                startTime: 0,
                durationMs: 5000,
                status: 200,
            },
            recentRequests: [
                { url: longUrl, method: 'GET', startTime: 0, durationMs: 50, status: 200 },
            ],
        });

        updateRequestViewer();

        const viewer = document.getElementById('debug-request-viewer')!;
        // URL should be truncated to last 50 chars in recent requests
        expect(viewer.innerHTML).toContain('more-stuff');
    });

    it('should display multiple recent requests', () => {
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 3,
            successfulRequests: 3,
            failedRequests: 0,
            cachedRequests: 1,
            averageDurationMs: 100,
            slowestRequest: undefined,
            recentRequests: [
                { url: '/api/one', method: 'GET', startTime: 0, durationMs: 50, status: 200 },
                { url: '/api/two', method: 'POST', startTime: 0, durationMs: 100, status: 201 },
                { url: '/api/three', method: 'PUT', startTime: 0, durationMs: 150, status: 204 },
            ],
        });

        updateRequestViewer();

        const viewer = document.getElementById('debug-request-viewer')!;
        expect(viewer.innerHTML).toContain('/api/one');
        expect(viewer.innerHTML).toContain('/api/two');
        expect(viewer.innerHTML).toContain('/api/three');
        expect(viewer.innerHTML).toContain('GET');
        expect(viewer.innerHTML).toContain('POST');
        expect(viewer.innerHTML).toContain('PUT');
    });
});

// ============================================
// Breadcrumb Viewer Extended Tests
// ============================================

describe('debug-ui extended - breadcrumb viewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        global.URL.revokeObjectURL = vi.fn();

        document.body.innerHTML = `
            <div id="debug-breadcrumb-viewer"></div>
            <button id="debug-clear-breadcrumbs"></button>
            <button id="debug-export-breadcrumbs"></button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display info class for non-error breadcrumbs', () => {
        vi.mocked(getBreadcrumbs).mockReturnValue([
            { timestamp: Date.now(), type: 'navigation', message: 'User navigated' },
        ]);

        updateBreadcrumbViewer();

        const viewer = document.getElementById('debug-breadcrumb-viewer')!;
        expect(viewer.querySelector('.debug-log-entry.info')).not.toBeNull();
    });

    it('should format breadcrumb time correctly', () => {
        const timestamp = new Date('2024-01-15T09:15:30').getTime();
        vi.mocked(getBreadcrumbs).mockReturnValue([
            { timestamp, type: 'action', message: 'Click' },
        ]);

        updateBreadcrumbViewer();

        const viewer = document.getElementById('debug-breadcrumb-viewer')!;
        expect(viewer.innerHTML).toContain('09:15:30');
    });

    it('should escape HTML in breadcrumb messages', () => {
        vi.mocked(getBreadcrumbs).mockReturnValue([
            { timestamp: Date.now(), type: 'action', message: '<img src=x onerror=alert(1)>' },
        ]);

        updateBreadcrumbViewer();

        const viewer = document.getElementById('debug-breadcrumb-viewer')!;
        expect(viewer.innerHTML).not.toContain('<img');
        expect(viewer.innerHTML).toContain('&lt;img');
    });

    it('should show breadcrumbs in reverse chronological order', () => {
        const now = Date.now();
        vi.mocked(getBreadcrumbs).mockReturnValue([
            { timestamp: now - 2000, type: 'action', message: 'First action' },
            { timestamp: now - 1000, type: 'action', message: 'Second action' },
            { timestamp: now, type: 'action', message: 'Third action' },
        ]);

        updateBreadcrumbViewer();

        const viewer = document.getElementById('debug-breadcrumb-viewer')!;
        const entries = viewer.querySelectorAll('.debug-log-entry');

        expect(entries[0].textContent).toContain('Third action');
        expect(entries[1].textContent).toContain('Second action');
        expect(entries[2].textContent).toContain('First action');
    });

    it('should limit to 30 breadcrumbs', () => {
        const breadcrumbs = Array.from({ length: 50 }, (_, i) => ({
            timestamp: Date.now() + i,
            type: 'action',
            message: `Breadcrumb ${i}`,
        }));

        vi.mocked(getBreadcrumbs).mockReturnValue(breadcrumbs);

        updateBreadcrumbViewer();

        const viewer = document.getElementById('debug-breadcrumb-viewer')!;
        const entries = viewer.querySelectorAll('.debug-log-entry');
        expect(entries.length).toBe(30);

        // Should contain the newest ones (20-49)
        expect(viewer.innerHTML).toContain('Breadcrumb 49');
        expect(viewer.innerHTML).toContain('Breadcrumb 20');
        expect(viewer.innerHTML).not.toContain('Breadcrumb 19');
    });
});

// ============================================
// State Viewer Extended Tests
// ============================================

describe('debug-ui extended - state viewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        global.URL.revokeObjectURL = vi.fn();

        document.body.innerHTML = `
            <div id="debug-state-viewer"></div>
            <button id="debug-refresh-state"></button>
            <button id="debug-export-state"></button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display complex nested state', () => {
        vi.mocked(captureStateSnapshot).mockReturnValue({
            level1: {
                level2: {
                    level3: 'deep value',
                    array: [1, 2, 3],
                },
            },
            boolean: true,
            number: 42,
        });

        updateStateViewer();

        const viewer = document.getElementById('debug-state-viewer')!;
        expect(viewer.innerHTML).toContain('level1');
        expect(viewer.innerHTML).toContain('level2');
        expect(viewer.innerHTML).toContain('level3');
        expect(viewer.innerHTML).toContain('deep value');
    });

    it('should handle null values in state', () => {
        vi.mocked(captureStateSnapshot).mockReturnValue({
            nullValue: null,
            undefinedValue: undefined,
        });

        updateStateViewer();

        const viewer = document.getElementById('debug-state-viewer')!;
        expect(viewer.innerHTML).toContain('null');
    });

    it('should handle empty state', () => {
        vi.mocked(captureStateSnapshot).mockReturnValue({});

        updateStateViewer();

        const viewer = document.getElementById('debug-state-viewer')!;
        expect(viewer.innerHTML).toContain('{}');
    });

    it('should update on refresh button click', () => {
        initStateControls();

        vi.mocked(captureStateSnapshot).mockClear();

        const refreshBtn = document.getElementById('debug-refresh-state')!;
        refreshBtn.click();

        expect(captureStateSnapshot).toHaveBeenCalledTimes(1);
    });
});

// ============================================
// Tab Switching Extended Tests
// ============================================

describe('debug-ui extended - tab switching', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <button data-debug-tab="logs" class="active">Logs</button>
            <button data-debug-tab="breadcrumbs">Breadcrumbs</button>
            <button data-debug-tab="requests">Requests</button>
            <button data-debug-tab="state">State</button>
            <div data-debug-content="logs" style="display: block;"></div>
            <div data-debug-content="breadcrumbs" style="display: none;"></div>
            <div data-debug-content="requests" style="display: none;"></div>
            <div data-debug-content="state" style="display: none;"></div>
            <div id="debug-log-viewer"></div>
            <div id="debug-breadcrumb-viewer"></div>
            <div id="debug-request-viewer"></div>
            <div id="debug-state-viewer"></div>
        `;

        vi.mocked(getLogs).mockReturnValue([]);
        vi.mocked(getBreadcrumbs).mockReturnValue([]);
        vi.spyOn(requestTimer, 'getStats').mockReturnValue({
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cachedRequests: 0,
            averageDurationMs: 0,
            slowestRequest: undefined,
            recentRequests: [],
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should remove active class from all other tabs', () => {
        switchDebugTab('breadcrumbs');

        const logsTab = document.querySelector('[data-debug-tab="logs"]')!;
        const breadcrumbsTab = document.querySelector('[data-debug-tab="breadcrumbs"]')!;
        const requestsTab = document.querySelector('[data-debug-tab="requests"]')!;
        const stateTab = document.querySelector('[data-debug-tab="state"]')!;

        expect(logsTab.classList.contains('active')).toBe(false);
        expect(breadcrumbsTab.classList.contains('active')).toBe(true);
        expect(requestsTab.classList.contains('active')).toBe(false);
        expect(stateTab.classList.contains('active')).toBe(false);
    });

    it('should hide all other content when switching', () => {
        switchDebugTab('state');

        const logsContent = document.querySelector('[data-debug-content="logs"]') as HTMLElement;
        const breadcrumbsContent = document.querySelector('[data-debug-content="breadcrumbs"]') as HTMLElement;
        const requestsContent = document.querySelector('[data-debug-content="requests"]') as HTMLElement;
        const stateContent = document.querySelector('[data-debug-content="state"]') as HTMLElement;

        expect(logsContent.style.display).toBe('none');
        expect(breadcrumbsContent.style.display).toBe('none');
        expect(requestsContent.style.display).toBe('none');
        expect(stateContent.style.display).toBe('block');
    });

    it('should handle rapid tab switching', () => {
        switchDebugTab('logs');
        switchDebugTab('breadcrumbs');
        switchDebugTab('requests');
        switchDebugTab('state');
        switchDebugTab('logs');

        const logsContent = document.querySelector('[data-debug-content="logs"]') as HTMLElement;
        expect(logsContent.style.display).toBe('block');

        const logsTab = document.querySelector('[data-debug-tab="logs"]')!;
        expect(logsTab.classList.contains('active')).toBe(true);
    });
});

// ============================================
// Confidence Slider Extended Tests
// ============================================

describe('debug-ui extended - confidence slider', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <input type="range" id="debug-confidence-slider" min="0" max="100" value="70" />
            <span id="debug-confidence-value">70%</span>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should log threshold changes', () => {
        initConfidenceSlider();

        const slider = document.getElementById('debug-confidence-slider') as HTMLInputElement;
        slider.value = '90';
        slider.dispatchEvent(new Event('input'));

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'debug_ui.threshold_changed',
                data: expect.objectContaining({
                    threshold: 0.9,
                }),
            })
        );
    });

    it('should handle slider at 0%', () => {
        initConfidenceSlider();

        const slider = document.getElementById('debug-confidence-slider') as HTMLInputElement;
        const display = document.getElementById('debug-confidence-value')!;

        slider.value = '0';
        slider.dispatchEvent(new Event('input'));

        expect(display.textContent).toBe('0%');
        expect(getConfidenceThreshold()).toBe(0);
    });

    it('should handle slider at 100%', () => {
        initConfidenceSlider();

        const slider = document.getElementById('debug-confidence-slider') as HTMLInputElement;
        const display = document.getElementById('debug-confidence-value')!;

        slider.value = '100';
        slider.dispatchEvent(new Event('input'));

        expect(display.textContent).toBe('100%');
        expect(getConfidenceThreshold()).toBe(1);
    });

    it('should set threshold without DOM elements present', () => {
        document.body.innerHTML = '';

        setConfidenceThreshold(0.5);

        expect(getConfidenceThreshold()).toBe(0.5);
    });
});

// ============================================
// Re-export Tests
// ============================================

describe('debug-ui extended - re-exports', () => {
    it('should re-export isDebugEnabled', () => {
        expect(typeof isDebugEnabled).toBe('function');
    });

    it('should re-export setDebugEnabled', () => {
        expect(typeof setDebugEnabled).toBe('function');
    });
});

// ============================================
// Cleanup Tests
// ============================================

describe('debug-ui extended - cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should handle cleanup when no panel was initialized', () => {
        expect(() => cleanupDebugPanel()).not.toThrow();
    });

    it('should handle cleanup after partial initialization', () => {
        document.body.innerHTML = '<div id="debug-panel"></div>';

        initDebugPanel();
        expect(() => cleanupDebugPanel()).not.toThrow();
    });

    it('should stop interval after cleanup even if called multiple times', () => {
        document.body.innerHTML = `
            <div id="debug-panel">
                <button id="debug-expand-btn"></button>
                <input type="checkbox" id="scan-debug-mode" />
                <div id="debug-panel-content"></div>
            </div>
        `;

        initDebugPanel();

        // Expand to start interval
        document.getElementById('debug-expand-btn')!.click();

        cleanupDebugPanel();
        cleanupDebugPanel();
        cleanupDebugPanel();

        // Should not throw
        vi.advanceTimersByTime(10000);
    });
});
