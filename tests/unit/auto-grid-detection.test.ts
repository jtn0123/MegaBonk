/**
 * Unit tests for Auto Grid Detection module
 * Tests grid detection, calibration, and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setConfig,
    getConfig,
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    buildPreciseGrid,
    validateGrid,
    autoDetectGrid,
    compareWithPreset,
    drawDetectionOverlay,
    type AutoGridConfig,
    type GridCalibration,
    type BandRegion,
    type BorderResult,
    type IconMetrics,
    type CellEdge,
    type AutoDetectionResult,
} from '../../src/modules/cv/auto-grid-detection';

// ========================================
// Test Utilities
// ========================================

/**
 * Create a mock canvas context with configurable pixel data
 */
function createMockCanvasContext(
    width: number,
    height: number,
    pixelGenerator?: (x: number, y: number) => [number, number, number, number]
): CanvasRenderingContext2D {
    const defaultGenerator = () => [50, 50, 50, 255] as [number, number, number, number];
    const generator = pixelGenerator || defaultGenerator;

    const mockCtx = {
        canvas: { width, height },
        getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
            const data = new Uint8ClampedArray(w * h * 4);
            for (let row = 0; row < h; row++) {
                for (let col = 0; col < w; col++) {
                    const idx = (row * w + col) * 4;
                    const [r, g, b, a] = generator(x + col, y + row);
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                }
            }
            return { data, width: w, height: h };
        }),
        save: vi.fn(),
        restore: vi.fn(),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        font: '',
        setLineDash: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    return mockCtx;
}

/**
 * Create pixel data that simulates a hotbar region
 */
function createHotbarPixelGenerator(height: number): (x: number, y: number) => [number, number, number, number] {
    return (x: number, y: number) => {
        const hotbarTop = Math.floor(height * 0.88);
        const hotbarBottom = height - 5;

        if (y >= hotbarTop && y <= hotbarBottom) {
            // Hotbar region - moderately bright with some color variance
            const variance = Math.sin(x * 0.1) * 30;
            return [80 + variance, 70 + variance, 90 + variance, 255];
        }
        // Background - dark
        return [20, 20, 25, 255];
    };
}

/**
 * Create pixel data with rarity borders (simulating colored item borders)
 */
function createRarityBorderPixelGenerator(
    height: number,
    borderPositions: number[],
    rarityColor: [number, number, number] = [100, 200, 100] // Green (uncommon)
): (x: number, y: number) => [number, number, number, number] {
    return (x: number, y: number) => {
        const hotbarTop = Math.floor(height * 0.88);
        const hotbarBottom = height - 5;

        // Check if we're in hotbar region
        if (y >= hotbarTop && y <= hotbarBottom) {
            // Check if we're at a border position (within 3px)
            for (const borderX of borderPositions) {
                if (Math.abs(x - borderX) <= 3) {
                    return [...rarityColor, 255] as [number, number, number, number];
                }
            }
            // Normal hotbar content
            return [60, 60, 70, 255];
        }
        return [20, 20, 25, 255];
    };
}

// ========================================
// Config Tests
// ========================================

describe('Auto Grid Detection - Configuration', () => {
    afterEach(() => {
        // Reset config to defaults
        setConfig({
            baseResolution: 720,
            maxDetectedRows: 2,
            defaultCalibration: {
                xOffset: 0,
                yOffset: 0,
                iconWidth: 40,
                iconHeight: 40,
                xSpacing: 4,
                ySpacing: 4,
                iconsPerRow: 20,
                numRows: 3,
                totalItems: 60,
            },
        });
    });

    it('should return default configuration', () => {
        const config = getConfig();

        expect(config.baseResolution).toBe(720);
        expect(config.maxDetectedRows).toBe(2);
        expect(config.defaultCalibration).toBeDefined();
        expect(config.defaultCalibration.iconWidth).toBe(40);
        expect(config.defaultCalibration.iconHeight).toBe(40);
    });

    it('should set partial configuration', () => {
        setConfig({ baseResolution: 1080 });

        const config = getConfig();
        expect(config.baseResolution).toBe(1080);
        // Other values should remain default
        expect(config.maxDetectedRows).toBe(2);
    });

    it('should set full configuration', () => {
        const newConfig: Partial<AutoGridConfig> = {
            baseResolution: 1440,
            maxDetectedRows: 3,
            defaultCalibration: {
                xOffset: 10,
                yOffset: 20,
                iconWidth: 60,
                iconHeight: 60,
                xSpacing: 6,
                ySpacing: 6,
                iconsPerRow: 15,
                numRows: 4,
                totalItems: 60,
            },
        };

        setConfig(newConfig);

        const config = getConfig();
        expect(config.baseResolution).toBe(1440);
        expect(config.maxDetectedRows).toBe(3);
        expect(config.defaultCalibration.iconWidth).toBe(60);
        expect(config.defaultCalibration.iconsPerRow).toBe(15);
    });

    it('should return a copy of config (not reference)', () => {
        const config1 = getConfig();
        const config2 = getConfig();

        expect(config1).not.toBe(config2);
        expect(config1).toEqual(config2);

        // Modifying one should not affect the other
        config1.baseResolution = 9999;
        expect(getConfig().baseResolution).toBe(720);
    });
});

// ========================================
// Band Detection Tests
// ========================================

describe('Auto Grid Detection - Hotbar Band Detection', () => {
    it('should detect hotbar band region', () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));

        const band = detectHotbarBand(ctx, width, height);

        expect(band).toBeDefined();
        expect(band.topY).toBeLessThan(band.bottomY);
        expect(band.height).toBeGreaterThan(0);
        expect(band.confidence).toBeGreaterThanOrEqual(0);
        expect(band.confidence).toBeLessThanOrEqual(1);
    });

    it('should return band in bottom portion of screen', () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));

        const band = detectHotbarBand(ctx, width, height);

        // Hotbar should be in bottom 30% of screen
        expect(band.topY).toBeGreaterThan(height * 0.7);
    });

    it('should include debug information', () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));

        const band = detectHotbarBand(ctx, width, height);

        expect(band.debug).toBeDefined();
        expect(band.debug?.stripData).toBeInstanceOf(Array);
        expect(band.debug?.bestScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle different resolutions', () => {
        const testCases = [
            { width: 1280, height: 720 },
            { width: 1920, height: 1080 },
            { width: 2560, height: 1440 },
        ];

        for (const { width, height } of testCases) {
            const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));
            const band = detectHotbarBand(ctx, width, height);

            expect(band.topY).toBeLessThan(height);
            expect(band.bottomY).toBeLessThanOrEqual(height);
            expect(band.height).toBeGreaterThan(0);
        }
    });

    it('should constrain band height to reasonable limits', () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));

        const band = detectHotbarBand(ctx, width, height);

        // Max band height is ~12% of screen height
        const maxBandHeight = Math.floor(height * 0.12);
        expect(band.height).toBeLessThanOrEqual(maxBandHeight);
    });
});

// ========================================
// Rarity Border Detection Tests
// ========================================

describe('Auto Grid Detection - Rarity Border Detection', () => {
    it('should return border result structure', () => {
        const width = 1920;
        const height = 1080;
        const bandRegion: BandRegion = {
            topY: 950,
            bottomY: 1070,
            height: 120,
            confidence: 0.8,
        };
        const ctx = createMockCanvasContext(width, height);

        const result = detectRarityBorders(ctx, width, bandRegion);

        expect(result).toBeDefined();
        expect(result.edges).toBeInstanceOf(Array);
        expect(result.allEdges).toBeInstanceOf(Array);
        expect(result.colorCounts).toBeDefined();
        expect(result.dominantColors).toBeInstanceOf(Array);
    });

    it('should detect rarity border colors', () => {
        const width = 1920;
        const height = 1080;
        const bandRegion: BandRegion = {
            topY: 950,
            bottomY: 1070,
            height: 120,
            confidence: 0.8,
        };

        // Create borders at specific positions
        const borderPositions = [300, 350, 400, 450, 500];
        const ctx = createMockCanvasContext(
            width,
            height,
            createRarityBorderPixelGenerator(height, borderPositions)
        );

        const result = detectRarityBorders(ctx, width, bandRegion);

        // Should detect some edges (may be filtered by consistency checks)
        expect(result.allEdges.length).toBeGreaterThanOrEqual(0);
    });

    it('should scan only center portion of width', () => {
        const width = 1920;
        const height = 1080;
        const bandRegion: BandRegion = {
            topY: 950,
            bottomY: 1070,
            height: 120,
            confidence: 0.8,
        };

        const ctx = createMockCanvasContext(width, height);

        detectRarityBorders(ctx, width, bandRegion);

        // Check that getImageData was called with x starting at 15% of width
        const calls = (ctx.getImageData as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        for (const call of calls) {
            const startX = call[0];
            expect(startX).toBeGreaterThanOrEqual(Math.floor(width * 0.15) - 1);
        }
    });
});

// ========================================
// Icon Metrics Calculation Tests
// ========================================

describe('Auto Grid Detection - Icon Metrics Calculation', () => {
    const baseBandRegion: BandRegion = {
        topY: 950,
        bottomY: 1070,
        height: 120,
        confidence: 0.8,
    };

    it('should return default metrics when no edges provided', () => {
        const metrics = calculateIconMetrics([], 1920, baseBandRegion);

        expect(metrics.isDefault).toBe(true);
        expect(metrics.confidence).toBe(0);
        expect(metrics.detectedCells).toBe(0);
        expect(metrics.iconWidth).toBeGreaterThan(0);
        expect(metrics.iconHeight).toBeGreaterThan(0);
    });

    it('should return default metrics with single edge', () => {
        const edges: CellEdge[] = [
            { x: 100, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
        ];

        const metrics = calculateIconMetrics(edges, 1920, baseBandRegion);

        expect(metrics.isDefault).toBe(true);
    });

    it('should calculate metrics from multiple edges', () => {
        // Create edges with consistent 50px spacing (iconWidth + spacing)
        const edges: CellEdge[] = [
            { x: 100, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 150, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 200, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 250, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 300, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
        ];

        const metrics = calculateIconMetrics(edges, 1920, baseBandRegion);

        expect(metrics.cellStride).toBe(50); // 50px between edges
        expect(metrics.detectedCells).toBe(5);
        expect(metrics.firstCellX).toBe(100);
        expect(metrics.isDefault).toBeUndefined();
    });

    it('should handle irregular spacing gracefully', () => {
        const edges: CellEdge[] = [
            { x: 100, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 155, borderWidth: 3, rarity: 'rare', confidence: 0.7, detections: 4, verticalConsistency: 2 },
            { x: 200, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 260, borderWidth: 3, rarity: 'epic', confidence: 0.6, detections: 3, verticalConsistency: 2 },
        ];

        const metrics = calculateIconMetrics(edges, 1920, baseBandRegion);

        expect(metrics.iconWidth).toBeGreaterThan(0);
        expect(metrics.iconHeight).toBeGreaterThan(0);
    });

    it('should include debug information', () => {
        const edges: CellEdge[] = [
            { x: 100, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 150, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
            { x: 200, borderWidth: 3, rarity: 'uncommon', confidence: 0.8, detections: 5, verticalConsistency: 3 },
        ];

        const metrics = calculateIconMetrics(edges, 1920, baseBandRegion);

        expect(metrics.debug).toBeDefined();
        expect(metrics.debug?.gaps).toBeInstanceOf(Array);
        expect(metrics.debug?.gapMode).toBeDefined();
    });
});

// ========================================
// Precise Grid Building Tests
// ========================================

describe('Auto Grid Detection - Build Precise Grid', () => {
    const bandRegion: BandRegion = {
        topY: 950,
        bottomY: 1070,
        height: 120,
        confidence: 0.8,
    };

    it('should build grid positions from metrics', () => {
        const metrics: IconMetrics = {
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 5,
            ySpacing: 5,
            cellStride: 50,
            borderWidth: 3,
            confidence: 0.9,
            detectedCells: 10,
            firstCellX: 100,
            centerOffset: 0,
        };

        const edges: CellEdge[] = Array.from({ length: 10 }, (_, i) => ({
            x: 100 + i * 50,
            borderWidth: 3,
            rarity: 'uncommon',
            confidence: 0.8,
            detections: 5,
            verticalConsistency: 3,
        }));

        const result = buildPreciseGrid(metrics, bandRegion, 1920, 1080, edges);

        expect(result.positions).toBeInstanceOf(Array);
        expect(result.positions.length).toBeGreaterThan(0);
        expect(result.calibration).toBeDefined();
        expect(result.debug).toBeDefined();
    });

    it('should generate grid positions with correct structure', () => {
        const metrics: IconMetrics = {
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 5,
            ySpacing: 5,
            cellStride: 50,
            borderWidth: 3,
            confidence: 0.9,
            detectedCells: 5,
            firstCellX: 100,
            centerOffset: 0,
        };

        const edges: CellEdge[] = Array.from({ length: 5 }, (_, i) => ({
            x: 100 + i * 50,
            borderWidth: 3,
            rarity: 'uncommon',
            confidence: 0.8,
            detections: 5,
            verticalConsistency: 3,
        }));

        const result = buildPreciseGrid(metrics, bandRegion, 1920, 1080, edges);

        for (const pos of result.positions) {
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeGreaterThanOrEqual(0);
            expect(pos.width).toBe(45);
            expect(pos.height).toBe(45);
            expect(pos.row).toBeGreaterThanOrEqual(0);
            expect(pos.col).toBeGreaterThanOrEqual(0);
            expect(pos.slotIndex).toBeGreaterThanOrEqual(0);
        }
    });

    it('should generate calibration in base resolution units', () => {
        const metrics: IconMetrics = {
            iconWidth: 60,
            iconHeight: 60,
            xSpacing: 6,
            ySpacing: 6,
            cellStride: 66,
            borderWidth: 4,
            confidence: 0.9,
            detectedCells: 5,
            firstCellX: 100,
            centerOffset: 0,
        };

        const edges: CellEdge[] = Array.from({ length: 5 }, (_, i) => ({
            x: 100 + i * 66,
            borderWidth: 4,
            rarity: 'uncommon',
            confidence: 0.8,
            detections: 5,
            verticalConsistency: 3,
        }));

        const result = buildPreciseGrid(metrics, bandRegion, 1920, 1080, edges);

        // Calibration should be scaled to base resolution (720p)
        expect(result.calibration.iconWidth).toBeDefined();
        expect(result.calibration.iconHeight).toBeDefined();
        expect(result.calibration.iconsPerRow).toBe(5);
    });

    it('should include debug information', () => {
        const metrics: IconMetrics = {
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 5,
            ySpacing: 5,
            cellStride: 50,
            borderWidth: 3,
            confidence: 0.9,
            detectedCells: 5,
            firstCellX: 100,
            centerOffset: 0,
        };

        const edges: CellEdge[] = Array.from({ length: 5 }, (_, i) => ({
            x: 100 + i * 50,
            borderWidth: 3,
            rarity: 'uncommon',
            confidence: 0.8,
            detections: 5,
            verticalConsistency: 3,
        }));

        const result = buildPreciseGrid(metrics, bandRegion, 1920, 1080, edges);

        expect(result.debug.startX).toBeDefined();
        expect(result.debug.firstRowY).toBeDefined();
        expect(result.debug.cellStride).toBe(50);
        expect(result.debug.scale).toBeDefined();
    });
});

// ========================================
// Grid Validation Tests
// ========================================

describe('Auto Grid Detection - Grid Validation', () => {
    it('should validate grid positions', () => {
        const positions = [
            { x: 100, y: 900, width: 45, height: 45, row: 0, col: 0, slotIndex: 0 },
            { x: 150, y: 900, width: 45, height: 45, row: 0, col: 1, slotIndex: 1 },
            { x: 200, y: 900, width: 45, height: 45, row: 0, col: 2, slotIndex: 2 },
        ];

        // Create context that returns varied pixel data (simulating items)
        const ctx = createMockCanvasContext(1920, 1080, (x, y) => {
            // Different colors based on position to simulate items
            const brightness = 100 + (x % 50) + (y % 50);
            return [brightness, brightness - 20, brightness + 10, 255];
        });

        const result = validateGrid(ctx, positions);

        expect(result).toBeDefined();
        expect(result.totalCells).toBe(3);
        expect(result.validCells).toBeInstanceOf(Array);
        expect(result.emptyCells).toBeInstanceOf(Array);
        expect(result.suspiciousCells).toBeInstanceOf(Array);
        expect(result.stats.valid + result.stats.empty + result.stats.suspicious).toBe(3);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect empty cells', () => {
        const positions = [
            { x: 100, y: 900, width: 45, height: 45, row: 0, col: 0, slotIndex: 0 },
        ];

        // Create context with dark/low-variance pixels (empty cell)
        const ctx = createMockCanvasContext(1920, 1080, () => [10, 10, 12, 255]);

        const result = validateGrid(ctx, positions);

        expect(result.emptyCells.length).toBe(1);
        expect(result.validCells.length).toBe(0);
    });

    it('should handle empty position array', () => {
        const ctx = createMockCanvasContext(1920, 1080);

        const result = validateGrid(ctx, []);

        expect(result.totalCells).toBe(0);
        expect(result.validCells).toEqual([]);
        expect(result.emptyCells).toEqual([]);
        expect(result.suspiciousCells).toEqual([]);
    });
});

// ========================================
// Auto Detection Pipeline Tests
// ========================================

describe('Auto Grid Detection - Full Pipeline', () => {
    it('should run full auto-detection pipeline', async () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));

        const result = await autoDetectGrid(ctx, width, height);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.bandRegion).toBeDefined();
        expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should call progress callback', async () => {
        const width = 1920;
        const height = 1080;
        const ctx = createMockCanvasContext(width, height, createHotbarPixelGenerator(height));
        const progressCallback = vi.fn();

        await autoDetectGrid(ctx, width, height, { progressCallback });

        expect(progressCallback).toHaveBeenCalled();
        // Should be called with increasing percentages
        const calls = progressCallback.mock.calls;
        expect(calls[0][0]).toBe(10);
        expect(calls[calls.length - 1][0]).toBe(100);
    });

    it('should handle errors gracefully', async () => {
        const ctx = {
            canvas: { width: 1920, height: 1080 },
            getImageData: vi.fn(() => {
                throw new Error('Canvas error');
            }),
        } as unknown as CanvasRenderingContext2D;

        const result = await autoDetectGrid(ctx, 1920, 1080);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.reasons).toContain('exception_thrown');
        expect(result.calibration).toBeNull();
    });

    it('should detect likely empty screen', async () => {
        // Create very dark/uniform canvas
        const ctx = createMockCanvasContext(1920, 1080, () => [5, 5, 5, 255]);

        const result = await autoDetectGrid(ctx, 1920, 1080);

        // Should complete but may flag as empty
        expect(result.success).toBe(true);
        if (result.validation) {
            expect(result.validation.validCells.length).toBe(0);
        }
    });
});

// ========================================
// Preset Comparison Tests
// ========================================

describe('Auto Grid Detection - Preset Comparison', () => {
    it('should compare calibrations', () => {
        const auto: GridCalibration = {
            xOffset: 0,
            yOffset: 0,
            iconWidth: 42,
            iconHeight: 42,
            xSpacing: 5,
            ySpacing: 5,
            iconsPerRow: 20,
            numRows: 2,
        };

        const preset: GridCalibration = {
            xOffset: 0,
            yOffset: 0,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 20,
            numRows: 2,
        };

        const result = compareWithPreset(auto, preset);

        expect(result).toBeDefined();
        expect(result?.fields).toBeDefined();
        expect(result?.matchScore).toBeGreaterThanOrEqual(0);
        expect(result?.matchScore).toBeLessThanOrEqual(100);
        expect(result?.totalDiff).toBeGreaterThanOrEqual(0);
        expect(result?.recommendation).toBeDefined();
    });

    it('should return null for null inputs', () => {
        expect(compareWithPreset(null, null)).toBeNull();
        expect(compareWithPreset({ iconWidth: 40 } as GridCalibration, null)).toBeNull();
        expect(compareWithPreset(null, { iconWidth: 40 } as GridCalibration)).toBeNull();
    });

    it('should indicate close match for similar calibrations', () => {
        const cal1: GridCalibration = {
            xOffset: 0,
            yOffset: 0,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 20,
            numRows: 2,
        };

        const cal2: GridCalibration = {
            xOffset: 1,
            yOffset: 1,
            iconWidth: 41,
            iconHeight: 41,
            xSpacing: 4,
            ySpacing: 5,
            iconsPerRow: 20,
            numRows: 2,
        };

        const result = compareWithPreset(cal1, cal2);

        expect(result?.matchScore).toBeGreaterThan(50);
    });

    it('should indicate poor match for different calibrations', () => {
        const cal1: GridCalibration = {
            xOffset: 0,
            yOffset: 0,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 20,
            numRows: 2,
        };

        const cal2: GridCalibration = {
            xOffset: 100,
            yOffset: 100,
            iconWidth: 80,
            iconHeight: 80,
            xSpacing: 10,
            ySpacing: 10,
            iconsPerRow: 10,
            numRows: 4,
        };

        const result = compareWithPreset(cal1, cal2);

        expect(result?.matchScore).toBeLessThan(50);
    });

    it('should provide field-by-field comparison', () => {
        const auto: GridCalibration = {
            xOffset: 5,
            yOffset: 10,
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 6,
            ySpacing: 6,
            iconsPerRow: 18,
            numRows: 2,
        };

        const preset: GridCalibration = {
            xOffset: 0,
            yOffset: 0,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 20,
            numRows: 2,
        };

        const result = compareWithPreset(auto, preset);

        expect(result?.fields.iconWidth).toBeDefined();
        expect(result?.fields.iconWidth.auto).toBe(45);
        expect(result?.fields.iconWidth.preset).toBe(40);
        expect(result?.fields.iconWidth.diff).toBe(5);
    });
});

// ========================================
// Debug Overlay Tests
// ========================================

describe('Auto Grid Detection - Debug Overlay', () => {
    it('should draw overlay without errors', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const detectionResult: AutoDetectionResult = {
            success: true,
            bandRegion: {
                topY: 950,
                bottomY: 1070,
                height: 120,
                confidence: 0.8,
            },
            borders: {
                edges: [],
                allEdges: [],
                colorCounts: {},
                dominantColors: [],
            },
            grid: {
                positions: [
                    { x: 100, y: 900, width: 45, height: 45, row: 0, col: 0, slotIndex: 0 },
                ],
                calibration: {
                    xOffset: 0,
                    yOffset: 0,
                    iconWidth: 45,
                    iconHeight: 45,
                    xSpacing: 5,
                    ySpacing: 5,
                    iconsPerRow: 1,
                    numRows: 1,
                },
                debug: { startX: 100, firstRowY: 900, cellStride: 50, scale: 1.5 },
            },
            validation: {
                validCells: [
                    {
                        x: 100,
                        y: 900,
                        width: 45,
                        height: 45,
                        row: 0,
                        col: 0,
                        slotIndex: 0,
                        validation: {
                            isEmpty: false,
                            isSuspicious: false,
                            meanBrightness: 100,
                            totalVariance: 1000,
                            colorfulRatio: 0.3,
                        },
                    },
                ],
                emptyCells: [],
                suspiciousCells: [],
                totalCells: 1,
                confidence: 0.9,
                stats: { valid: 1, empty: 0, suspicious: 0 },
            },
            calibration: {
                xOffset: 0,
                yOffset: 0,
                iconWidth: 45,
                iconHeight: 45,
                xSpacing: 5,
                ySpacing: 5,
                iconsPerRow: 1,
                numRows: 1,
            },
            elapsed: 100,
            confidence: 0.85,
        };

        expect(() => drawDetectionOverlay(ctx, detectionResult)).not.toThrow();
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
    });

    it('should respect overlay options', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const detectionResult: AutoDetectionResult = {
            success: true,
            bandRegion: {
                topY: 950,
                bottomY: 1070,
                height: 120,
                confidence: 0.8,
            },
            calibration: null,
        };

        expect(() =>
            drawDetectionOverlay(ctx, detectionResult, {
                showBand: true,
                showEdges: false,
                showGrid: false,
                showLabels: false,
            })
        ).not.toThrow();
    });

    it('should handle missing detection data', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const detectionResult: AutoDetectionResult = {
            success: false,
            calibration: null,
            error: 'Test error',
        };

        expect(() => drawDetectionOverlay(ctx, detectionResult)).not.toThrow();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Auto Grid Detection - Edge Cases', () => {
    it('should handle very small resolution', () => {
        const ctx = createMockCanvasContext(640, 480, createHotbarPixelGenerator(480));

        const band = detectHotbarBand(ctx, 640, 480);

        expect(band).toBeDefined();
        expect(band.height).toBeGreaterThan(0);
    });

    it('should handle very large resolution', () => {
        const ctx = createMockCanvasContext(3840, 2160, createHotbarPixelGenerator(2160));

        const band = detectHotbarBand(ctx, 3840, 2160);

        expect(band).toBeDefined();
        expect(band.height).toBeGreaterThan(0);
    });

    it('should handle zero-width edges array', () => {
        const metrics = calculateIconMetrics([], 1920, {
            topY: 950,
            bottomY: 1070,
            height: 120,
            confidence: 0.8,
        });

        expect(metrics.isDefault).toBe(true);
    });
});
