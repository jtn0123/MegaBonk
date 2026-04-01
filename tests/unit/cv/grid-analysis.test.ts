/**
 * @vitest-environment jsdom
 * Unit tests for cv/grid-analysis.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the color dependency before importing
vi.mock('../../../src/modules/cv/color.ts', () => ({
    detectRarityAtPixel: (_r: number, _g: number, _b: number): string | null => null,
}));

import {
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    findMode,
    getDefaultMetrics,
    buildPreciseGrid,
} from '../../../src/modules/cv/grid-analysis';
import type { AutoGridConfig, BandRegion, CellEdge } from '../../../src/modules/cv/grid-types';

// ========================================
// Helpers
// ========================================

function createMockCanvas(
    width: number,
    height: number,
    pixelFn?: (x: number, y: number) => [number, number, number, number]
) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    if (pixelFn) {
        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const [r, g, b, a] = pixelFn(x, y);
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = a;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    return { canvas, ctx };
}

const DEFAULT_CONFIG: AutoGridConfig = {
    baseResolution: 720,
    maxDetectedRows: 2,
    defaultCalibration: {
        xOffset: 0,
        yOffset: 100,
        iconWidth: 38,
        iconHeight: 38,
        xSpacing: 4,
        ySpacing: 4,
        iconsPerRow: 10,
        numRows: 1,
    },
};

// ========================================
// Tests
// ========================================

describe('grid-analysis', () => {
    describe('findMode', () => {
        it('should find the most common value', () => {
            expect(findMode([10, 10, 20, 10, 30])).toBe(10);
        });

        it('should handle tolerance-based bucketing', () => {
            // 40→40, 41→42, 42→42 with tolerance 2 → bucket 42 wins (count=2) vs 40 (count=1) and 50 (count=2)
            // With 50,50 → bucket 50 (count=2), so 50 or 42 wins; use clearer example
            expect(findMode([40, 40, 40, 50, 50], 2)).toBe(40);
        });

        it('should return bucketed value for single-element array', () => {
            // 77 rounded to nearest multiple of 2 = 78
            expect(findMode([77])).toBe(78);
        });

        it('should handle empty array', () => {
            expect(findMode([])).toBe(0);
        });

        it('should handle all equal values', () => {
            expect(findMode([50, 50, 50, 50])).toBe(50);
        });
    });

    describe('getDefaultMetrics', () => {
        it('should return scaled metrics based on resolution', () => {
            const band: BandRegion = {
                topY: 600,
                bottomY: 720,
                height: 120,
                confidence: 0.8,
            };

            const metrics = getDefaultMetrics(1280, band, DEFAULT_CONFIG);

            expect(metrics.iconWidth).toBeGreaterThan(0);
            expect(metrics.iconHeight).toBeGreaterThan(0);
            expect(metrics.xSpacing).toBeGreaterThan(0);
            expect(metrics.confidence).toBe(0);
            expect(metrics.isDefault).toBe(true);
            expect(metrics.detectedCells).toBe(0);
        });

        it('should scale linearly with resolution', () => {
            const band720: BandRegion = { topY: 600, bottomY: 720, height: 120, confidence: 0.8 };
            const band1080: BandRegion = { topY: 900, bottomY: 1080, height: 180, confidence: 0.8 };

            const metrics720 = getDefaultMetrics(1280, band720, DEFAULT_CONFIG);
            const metrics1080 = getDefaultMetrics(1920, band1080, DEFAULT_CONFIG);

            // 1080/720 = 1.5x scale
            expect(metrics1080.iconWidth).toBe(Math.round(metrics720.iconWidth * 1.5));
        });
    });

    describe('detectHotbarBand', () => {
        it('should detect band in bottom portion of screen', () => {
            // Create a canvas with a bright band near the bottom
            const { ctx } = createMockCanvas(1280, 720, (x, y) => {
                if (y > 630 && y < 700) {
                    // Bright, colorful strip (hotbar area)
                    return [100 + (x % 100), 150, 80, 255];
                }
                // Dark background
                return [20, 20, 20, 255];
            });

            const band = detectHotbarBand(ctx, 1280, 720);

            expect(band.topY).toBeGreaterThan(0);
            expect(band.bottomY).toBeGreaterThan(band.topY);
            expect(band.height).toBe(band.bottomY - band.topY);
            expect(band.confidence).toBeGreaterThanOrEqual(0);
        });

        it('should return fallback when no band detected', () => {
            // Completely uniform dark image
            const { ctx } = createMockCanvas(1280, 720, () => [10, 10, 10, 255]);

            const band = detectHotbarBand(ctx, 1280, 720);

            // Should still return a valid band region
            expect(band.topY).toBeGreaterThan(0);
            expect(band.bottomY).toBeGreaterThan(band.topY);
            expect(band.height).toBeGreaterThan(0);
        });

        it('should constrain band height', () => {
            const { ctx } = createMockCanvas(1280, 720, () => [100, 100, 100, 255]);

            const band = detectHotbarBand(ctx, 1280, 720);

            const maxBandHeight = Math.floor(720 * 0.12);
            expect(band.height).toBeLessThanOrEqual(maxBandHeight);
        });
    });

    describe('detectRarityBorders', () => {
        it('should return empty edges for uniform image', () => {
            const { ctx } = createMockCanvas(1280, 720, () => [50, 50, 50, 255]);

            const bandRegion: BandRegion = {
                topY: 640,
                bottomY: 710,
                height: 70,
                confidence: 0.8,
            };

            const result = detectRarityBorders(ctx, 1280, bandRegion);

            expect(result.edges).toBeInstanceOf(Array);
            expect(result.allEdges).toBeInstanceOf(Array);
            expect(result.colorCounts).toBeDefined();
            expect(result.dominantColors).toBeInstanceOf(Array);
        });

        it('should scan within band region only', () => {
            const { ctx } = createMockCanvas(1280, 720, () => [50, 50, 50, 255]);

            const bandRegion: BandRegion = {
                topY: 640,
                bottomY: 710,
                height: 70,
                confidence: 0.8,
            };

            const result = detectRarityBorders(ctx, 1280, bandRegion);

            // All raw edges should be within the band region
            for (const edge of result.allEdges) {
                expect(edge.y).toBeGreaterThanOrEqual(bandRegion.topY);
                expect(edge.y).toBeLessThanOrEqual(bandRegion.bottomY);
            }
        });
    });

    describe('calculateIconMetrics', () => {
        it('should return default metrics when fewer than 2 edges', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            const edges: CellEdge[] = [
                { x: 100, borderWidth: 3, rarity: 'common', confidence: 0.9, detections: 5, verticalConsistency: 3 },
            ];

            const metrics = calculateIconMetrics(edges, 1280, bandRegion, DEFAULT_CONFIG);

            expect(metrics.isDefault).toBe(true);
        });

        it('should calculate metrics from consistent edges', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            // Edges spaced 44px apart (icon + spacing)
            const edges: CellEdge[] = [];
            for (let i = 0; i < 10; i++) {
                edges.push({
                    x: 200 + i * 44,
                    borderWidth: 3,
                    rarity: 'common',
                    confidence: 0.9,
                    detections: 5,
                    verticalConsistency: 3,
                });
            }

            const metrics = calculateIconMetrics(edges, 1280, bandRegion, DEFAULT_CONFIG);

            expect(metrics.isDefault).toBeUndefined();
            expect(metrics.cellStride).toBe(44);
            expect(metrics.iconWidth).toBeLessThan(44);
            expect(metrics.iconWidth).toBeGreaterThan(30);
            expect(metrics.detectedCells).toBe(10);
            expect(metrics.firstCellX).toBe(200);
        });

        it('should handle edges with varying gaps', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            const edges: CellEdge[] = [
                { x: 100, borderWidth: 3, rarity: 'rare', confidence: 0.8, detections: 4, verticalConsistency: 3 },
                { x: 148, borderWidth: 3, rarity: 'rare', confidence: 0.8, detections: 4, verticalConsistency: 3 },
                { x: 196, borderWidth: 3, rarity: 'rare', confidence: 0.8, detections: 4, verticalConsistency: 3 },
            ];

            const metrics = calculateIconMetrics(edges, 1280, bandRegion, DEFAULT_CONFIG);

            expect(metrics.cellStride).toBe(48);
            expect(metrics.confidence).toBe(1); // All gaps are consistent
        });
    });

    describe('buildPreciseGrid', () => {
        it('should build grid positions from metrics', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            const edges: CellEdge[] = [];
            for (let i = 0; i < 10; i++) {
                edges.push({
                    x: 200 + i * 44,
                    borderWidth: 3,
                    rarity: 'common',
                    confidence: 0.9,
                    detections: 5,
                    verticalConsistency: 3,
                });
            }

            const metrics = calculateIconMetrics(edges, 1280, bandRegion, DEFAULT_CONFIG);
            const grid = buildPreciseGrid(metrics, bandRegion, 1280, 720, edges, DEFAULT_CONFIG);

            expect(grid.positions.length).toBeGreaterThan(0);
            expect(grid.calibration).toBeDefined();
            expect(grid.calibration.iconsPerRow).toBe(10);
            expect(grid.debug).toBeDefined();
        });

        it('should center grid when no cell edges provided', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            const metrics = getDefaultMetrics(1280, bandRegion, DEFAULT_CONFIG);
            const grid = buildPreciseGrid(metrics, bandRegion, 1280, 720, [], DEFAULT_CONFIG);

            expect(grid.positions.length).toBeGreaterThan(0);

            // Verify positions have valid coordinates
            for (const pos of grid.positions) {
                expect(pos.x).toBeGreaterThanOrEqual(0);
                expect(pos.y).toBeGreaterThanOrEqual(0);
                expect(pos.width).toBeGreaterThan(0);
                expect(pos.height).toBeGreaterThan(0);
            }
        });

        it('should not place rows too high up', () => {
            const bandRegion: BandRegion = { topY: 640, bottomY: 710, height: 70, confidence: 0.8 };
            const metrics = getDefaultMetrics(1280, bandRegion, DEFAULT_CONFIG);
            const grid = buildPreciseGrid(metrics, bandRegion, 1280, 720, [], DEFAULT_CONFIG);

            for (const pos of grid.positions) {
                expect(pos.y).toBeGreaterThanOrEqual(720 * 0.7);
            }
        });
    });
});
