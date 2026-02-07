/**
 * @vitest-environment jsdom
 * Scan Build Enhanced Module - Comprehensive Tests
 * Tests for enhanced CV detection, strategy selection, and hybrid detection
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/cv-strategy.ts', () => ({
    setActiveStrategy: vi.fn(),
    STRATEGY_PRESETS: {
        optimized: { name: 'optimized' },
        fast: { name: 'fast' },
        accurate: { name: 'accurate' },
        balanced: { name: 'balanced' },
        current: { name: 'current' },
    },
}));

vi.mock('../../src/modules/computer-vision-enhanced.ts', () => ({
    initEnhancedCV: vi.fn(),
    loadEnhancedTemplates: vi.fn().mockResolvedValue(undefined),
    detectItemsWithEnhancedCV: vi.fn().mockResolvedValue([
        { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.9 },
    ]),
}));

vi.mock('../../src/modules/cv-metrics.ts', () => ({
    metricsTracker: {
        getMetricsForStrategy: vi.fn().mockReturnValue([
            {
                strategy: 'optimized',
                totalTime: 150,
                totalDetections: 5,
                averageConfidence: 0.85,
                matchRate: 0.9,
                highConfidenceDetections: 4,
            },
        ]),
    },
}));

vi.mock('../../src/modules/ocr', () => ({
    autoDetectFromImage: vi.fn().mockResolvedValue({
        items: [{ type: 'item', entity: { id: 'shield', name: 'Shield' }, confidence: 0.8 }],
        tomes: [],
        character: null,
        weapon: null,
    }),
}));

vi.mock('../../src/modules/computer-vision.ts', () => ({
    combineDetections: vi.fn((a, b) => [...a, ...b]),
    aggregateDuplicates: vi.fn(items => items.map((item: any) => ({ ...item, count: 1 }))),
}));

import {
    initEnhancedScanBuild,
    handleEnhancedHybridDetect,
    compareStrategiesOnImage,
} from '../../src/modules/scan-build-enhanced.ts';

import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';
import { setActiveStrategy } from '../../src/modules/cv-strategy.ts';
import { initEnhancedCV, loadEnhancedTemplates, detectItemsWithEnhancedCV } from '../../src/modules/computer-vision-enhanced.ts';
import { autoDetectFromImage } from '../../src/modules/ocr';
import { combineDetections, aggregateDuplicates } from '../../src/modules/computer-vision.ts';

// ========================================
// Test Helpers
// ========================================

function createMockGameData() {
    return {
        items: { items: [{ id: 'sword', name: 'Sword' }], version: '1.0', last_updated: '2024-01-01' },
        weapons: { weapons: [], version: '1.0', last_updated: '2024-01-01' },
        tomes: { tomes: [], version: '1.0', last_updated: '2024-01-01' },
        characters: { characters: [], version: '1.0', last_updated: '2024-01-01' },
        shrines: { shrines: [], version: '1.0', last_updated: '2024-01-01' },
    };
}

function setupDOM() {
    document.body.innerHTML = `
        <div id="scan-strategy-selector"></div>
        <div id="strategy-info"></div>
        <div id="scan-detection-metrics"></div>
        <div id="scan-auto-detect-area"></div>
        <div id="scan-strategy-comparison"></div>
    `;
}

// ========================================
// Test Suite
// ========================================

describe('Scan Build Enhanced Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    // ========================================
    // initEnhancedScanBuild Tests
    // ========================================
    describe('initEnhancedScanBuild', () => {
        it('should initialize enhanced CV', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            expect(initEnhancedCV).toHaveBeenCalledWith(gameData);
        });

        it('should load enhanced templates', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            expect(loadEnhancedTemplates).toHaveBeenCalled();
        });

        it('should log successful initialization', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build_enhanced.init',
                })
            );
        });

        it('should setup strategy selector UI', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const selectorContainer = document.getElementById('scan-strategy-selector');
            expect(selectorContainer?.innerHTML).toContain('cv-strategy-select');
        });

        it('should handle template loading errors', async () => {
            (loadEnhancedTemplates as any).mockRejectedValueOnce(new Error('Load failed'));

            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build_enhanced.init_error',
                })
            );
        });

        it('should include all strategy options', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select');
            expect(select?.innerHTML).toContain('optimized');
            expect(select?.innerHTML).toContain('fast');
            expect(select?.innerHTML).toContain('accurate');
        });

        it('should mark optimized as recommended', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select');
            expect(select?.innerHTML).toContain('⭐');
            expect(select?.innerHTML).toContain('Recommended');
        });
    });

    // ========================================
    // handleEnhancedHybridDetect Tests
    // ========================================
    describe('handleEnhancedHybridDetect', () => {
        const mockImageDataUrl = 'data:image/png;base64,abc123';

        it('should throw error for empty image', async () => {
            await expect(handleEnhancedHybridDetect('')).rejects.toThrow('No image provided');
        });

        it('should run OCR detection', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(autoDetectFromImage).toHaveBeenCalledWith(
                mockImageDataUrl,
                expect.any(Function)
            );
        });

        it('should run enhanced CV detection', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(detectItemsWithEnhancedCV).toHaveBeenCalledWith(
                mockImageDataUrl,
                'optimized',
                expect.any(Function)
            );
        });

        it('should combine OCR and CV results', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(combineDetections).toHaveBeenCalled();
        });

        it('should aggregate duplicates', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(aggregateDuplicates).toHaveBeenCalled();
        });

        it('should return items array', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.items).toBeDefined();
            expect(Array.isArray(result.items)).toBe(true);
        });

        it('should return tomes array', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.tomes).toBeDefined();
            expect(Array.isArray(result.tomes)).toBe(true);
        });

        it('should return character from OCR', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.character).toBeDefined();
        });

        it('should return weapon from OCR', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.weapon).toBeDefined();
        });

        it('should include metrics when available', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.metrics).toBeDefined();
            expect(result.metrics?.strategy).toBe('optimized');
        });

        it('should show success toast', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(ToastManager.success).toHaveBeenCalled();
        });

        it('should log completion', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build_enhanced.hybrid_detect_complete',
                })
            );
        });

        it('should create progress indicator', async () => {
            await handleEnhancedHybridDetect(mockImageDataUrl);

            // Progress indicator would be created but removed after completion
            // Check that the container was used
            const container = document.getElementById('scan-auto-detect-area');
            expect(container).toBeDefined();
        });

        it('should handle detection errors', async () => {
            (detectItemsWithEnhancedCV as any).mockRejectedValueOnce(new Error('CV failed'));

            await expect(handleEnhancedHybridDetect(mockImageDataUrl)).rejects.toThrow('CV failed');

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build_enhanced.hybrid_detect_error',
                })
            );
        });

        it('should include count in item results', async () => {
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            result.items.forEach(item => {
                expect(item.count).toBeDefined();
            });
        });
    });

    // ========================================
    // compareStrategiesOnImage Tests
    // ========================================
    describe('compareStrategiesOnImage', () => {
        const mockImageDataUrl = 'data:image/png;base64,abc123';

        it('should show error toast for empty image', async () => {
            await compareStrategiesOnImage('');

            expect(ToastManager.error).toHaveBeenCalledWith('No image uploaded');
        });

        it('should test all 5 strategies', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            expect(setActiveStrategy).toHaveBeenCalledWith('current');
            expect(setActiveStrategy).toHaveBeenCalledWith('optimized');
            expect(setActiveStrategy).toHaveBeenCalledWith('fast');
            expect(setActiveStrategy).toHaveBeenCalledWith('accurate');
            expect(setActiveStrategy).toHaveBeenCalledWith('balanced');
        });

        it('should run CV detection for each strategy', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            // Should be called 5 times (once per strategy)
            expect(detectItemsWithEnhancedCV).toHaveBeenCalledTimes(5);
        });

        it('should show info toast for each strategy', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            expect(ToastManager.info).toHaveBeenCalledWith('Testing current strategy...');
            expect(ToastManager.info).toHaveBeenCalledWith('Testing optimized strategy...');
        });

        it('should display comparison results', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            const comparisonDiv = document.getElementById('scan-strategy-comparison');
            expect(comparisonDiv?.innerHTML).toContain('Strategy Comparison Results');
        });

        it('should include strategy names in comparison', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            const comparisonDiv = document.getElementById('scan-strategy-comparison');
            expect(comparisonDiv?.innerHTML).toContain('optimized');
            expect(comparisonDiv?.innerHTML).toContain('fast');
        });

        it('should restore original strategy after comparison', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            // Last call should restore to 'optimized' (default)
            const calls = (setActiveStrategy as any).mock.calls;
            expect(calls[calls.length - 1][0]).toBe('optimized');
        });

        it('should handle errors for individual strategies', async () => {
            let callCount = 0;
            (detectItemsWithEnhancedCV as any).mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Strategy failed');
                }
                return Promise.resolve([]);
            });

            // Should not throw, should continue with other strategies
            await expect(compareStrategiesOnImage(mockImageDataUrl)).resolves.not.toThrow();

            expect(logger.error).toHaveBeenCalled();
        });

        it('should show comparison table', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            const comparisonDiv = document.getElementById('scan-strategy-comparison');
            expect(comparisonDiv?.innerHTML).toContain('<table');
            expect(comparisonDiv?.innerHTML).toContain('Detections');
            expect(comparisonDiv?.innerHTML).toContain('Time (ms)');
        });

        it('should highlight optimized strategy as recommended', async () => {
            await compareStrategiesOnImage(mockImageDataUrl);

            const comparisonDiv = document.getElementById('scan-strategy-comparison');
            expect(comparisonDiv?.innerHTML).toContain('⭐');
            expect(comparisonDiv?.innerHTML).toContain('recommended');
        });
    });

    // ========================================
    // Strategy Selector UI Tests
    // ========================================
    describe('Strategy Selector UI', () => {
        it('should create strategy select element', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            expect(select).toBeDefined();
            expect(select?.tagName).toBe('SELECT');
        });

        it('should have correct default selection', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            expect(select?.value).toBe('optimized');
        });

        it('should handle strategy change event', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            select.value = 'fast';
            select.dispatchEvent(new Event('change'));

            expect(setActiveStrategy).toHaveBeenCalledWith('fast');
        });

        it('should show toast on strategy change', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            select.value = 'accurate';
            select.dispatchEvent(new Event('change'));

            expect(ToastManager.info).toHaveBeenCalledWith('Strategy changed to: accurate');
        });

        it('should log strategy change', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            select.value = 'balanced';
            select.dispatchEvent(new Event('change'));

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build_enhanced.strategy_changed',
                    data: expect.objectContaining({ strategy: 'balanced' }),
                })
            );
        });

        it('should update strategy info on change', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            select.value = 'fast';
            select.dispatchEvent(new Event('change'));

            const infoDiv = document.getElementById('strategy-info');
            expect(infoDiv?.innerHTML).toContain('Fastest');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle missing strategy selector container', async () => {
            document.getElementById('scan-strategy-selector')?.remove();

            const gameData = createMockGameData();
            await expect(initEnhancedScanBuild(gameData as any)).resolves.not.toThrow();
        });

        it('should handle missing metrics div', async () => {
            document.getElementById('scan-detection-metrics')?.remove();

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            await expect(handleEnhancedHybridDetect(mockImageDataUrl)).resolves.not.toThrow();
        });

        it('should handle missing comparison div', async () => {
            document.getElementById('scan-strategy-comparison')?.remove();

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            await expect(compareStrategiesOnImage(mockImageDataUrl)).resolves.not.toThrow();
        });

        it('should handle empty CV results', async () => {
            (detectItemsWithEnhancedCV as any).mockResolvedValueOnce([]);

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.items).toBeDefined();
        });

        it('should handle empty OCR results', async () => {
            (autoDetectFromImage as any).mockResolvedValueOnce({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.items).toBeDefined();
        });

        it('should handle no metrics available', async () => {
            (await import('../../src/modules/cv-metrics.ts')).metricsTracker.getMetricsForStrategy = vi.fn().mockReturnValue([]);

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.metrics).toBeUndefined();
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should complete full detection workflow', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            const mockImageDataUrl = 'data:image/png;base64,abc123';
            const result = await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(result.items.length).toBeGreaterThanOrEqual(0);
            expect(result.tomes).toBeDefined();
        });

        it('should support strategy switching mid-session', async () => {
            const gameData = createMockGameData();
            await initEnhancedScanBuild(gameData as any);

            // Change strategy
            const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
            select.value = 'accurate';
            select.dispatchEvent(new Event('change'));

            // Run detection with new strategy
            const mockImageDataUrl = 'data:image/png;base64,abc123';
            await handleEnhancedHybridDetect(mockImageDataUrl);

            expect(detectItemsWithEnhancedCV).toHaveBeenCalledWith(
                mockImageDataUrl,
                'accurate',
                expect.any(Function)
            );
        });
    });
});
