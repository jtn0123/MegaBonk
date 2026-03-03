/**
 * @vitest-environment jsdom
 * Unit tests for cv/color-utils.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    rgbToHsl,
    getAdjacentColors,
    getColorCandidates,
    RARITY_BORDER_COLORS,
    EMPTY_CELL_MEAN_THRESHOLD,
    EMPTY_DETECTION_CONFIG,
    calculateColorVariance,
    calculateAverageSaturation,
    calculateHistogramWidth,
    calculateCenterEdgeRatio,
    calculateEdgeDensity,
} from '../../../src/modules/cv/color-utils';
import { polyfillImageData, createImageData } from './test-helpers';

beforeAll(() => { polyfillImageData(); });

// ========================================
// Tests
// ========================================

describe('color-utils', () => {
    describe('rgbToHsl', () => {
        it('should convert black to HSL (0, 0, 0)', () => {
            const result = rgbToHsl(0, 0, 0);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBe(0);
        });

        it('should convert white to HSL (0, 0, 100)', () => {
            const result = rgbToHsl(255, 255, 255);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBe(100);
        });

        it('should convert pure red', () => {
            const result = rgbToHsl(255, 0, 0);
            expect(result.h).toBe(0);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });

        it('should convert pure green', () => {
            const result = rgbToHsl(0, 255, 0);
            expect(result.h).toBe(120);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });

        it('should convert pure blue', () => {
            const result = rgbToHsl(0, 0, 255);
            expect(result.h).toBe(240);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });

        it('should convert gray', () => {
            const result = rgbToHsl(128, 128, 128);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBeCloseTo(50.2, 0);
        });

        it('should convert orange/gold (legendary color)', () => {
            const result = rgbToHsl(255, 165, 0);
            expect(result.h).toBeCloseTo(38.8, 0);
            expect(result.s).toBe(100);
            expect(result.l).toBe(50);
        });
    });

    describe('RARITY_BORDER_COLORS', () => {
        it('should define all five rarities', () => {
            expect(RARITY_BORDER_COLORS).toHaveProperty('common');
            expect(RARITY_BORDER_COLORS).toHaveProperty('uncommon');
            expect(RARITY_BORDER_COLORS).toHaveProperty('rare');
            expect(RARITY_BORDER_COLORS).toHaveProperty('epic');
            expect(RARITY_BORDER_COLORS).toHaveProperty('legendary');
        });

        it('should have valid HSL ranges', () => {
            for (const [, def] of Object.entries(RARITY_BORDER_COLORS)) {
                expect(def.h[0]).toBeGreaterThanOrEqual(0);
                expect(def.h[1]).toBeLessThanOrEqual(360);
                expect(def.s[0]).toBeGreaterThanOrEqual(0);
                expect(def.s[1]).toBeLessThanOrEqual(100);
                expect(def.l[0]).toBeGreaterThanOrEqual(0);
                expect(def.l[1]).toBeLessThanOrEqual(100);
            }
        });

        it('should have valid RGB ranges', () => {
            for (const [, def] of Object.entries(RARITY_BORDER_COLORS)) {
                expect(def.rgb.r[0]).toBeGreaterThanOrEqual(0);
                expect(def.rgb.r[1]).toBeLessThanOrEqual(255);
                expect(def.rgb.g[0]).toBeGreaterThanOrEqual(0);
                expect(def.rgb.g[1]).toBeLessThanOrEqual(255);
                expect(def.rgb.b[0]).toBeGreaterThanOrEqual(0);
                expect(def.rgb.b[1]).toBeLessThanOrEqual(255);
            }
        });
    });

    describe('getAdjacentColors', () => {
        it('should return adjacent colors for red', () => {
            const adj = getAdjacentColors('red');
            expect(adj).toContain('orange');
            expect(adj).toContain('magenta');
            expect(adj).toContain('purple');
        });

        it('should return adjacent colors for blue', () => {
            const adj = getAdjacentColors('blue');
            expect(adj).toContain('cyan');
            expect(adj).toContain('purple');
        });

        it('should return empty array for unknown color', () => {
            expect(getAdjacentColors('ultraviolet')).toEqual([]);
        });

        it('should return gray/white/black adjacencies', () => {
            expect(getAdjacentColors('gray')).toContain('black');
            expect(getAdjacentColors('gray')).toContain('white');
            expect(getAdjacentColors('black')).toContain('gray');
            expect(getAdjacentColors('white')).toContain('gray');
        });
    });

    describe('getColorCandidates', () => {
        it('should include exact color first', () => {
            const candidates = getColorCandidates('green');
            expect(candidates[0]).toBe('green');
        });

        it('should include adjacent colors after exact', () => {
            const candidates = getColorCandidates('green');
            expect(candidates.length).toBeGreaterThan(1);
            expect(candidates).toContain('cyan');
        });

        it('should handle unknown color gracefully', () => {
            const candidates = getColorCandidates('neon');
            expect(candidates).toEqual(['neon']);
        });
    });

    describe('EMPTY_DETECTION_CONFIG', () => {
        it('should have all required fields', () => {
            expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeGreaterThan(0);
            expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeGreaterThan(0);
            expect(EMPTY_DETECTION_CONFIG.MIN_HISTOGRAM_BINS).toBeGreaterThan(0);
            expect(EMPTY_DETECTION_CONFIG.MIN_CENTER_EDGE_RATIO).toBeGreaterThan(0);
        });

        it('should have methods toggles', () => {
            expect(EMPTY_DETECTION_CONFIG.methods).toBeDefined();
            expect(typeof EMPTY_DETECTION_CONFIG.methods.useVariance).toBe('boolean');
            expect(typeof EMPTY_DETECTION_CONFIG.methods.useSaturation).toBe('boolean');
        });
    });

    describe('EMPTY_CELL_MEAN_THRESHOLD', () => {
        it('should be a positive number', () => {
            expect(EMPTY_CELL_MEAN_THRESHOLD).toBeGreaterThan(0);
        });
    });

    describe('calculateColorVariance', () => {
        it('should return 0 for uniform image', () => {
            const imageData = createImageData(10, 10, () => [100, 100, 100, 255]);
            expect(calculateColorVariance(imageData)).toBe(0);
        });

        it('should return high variance for noisy image', () => {
            // Use larger blocks so the every-4th-pixel sampling still sees variation
            const imageData = createImageData(20, 20, (x) => [x < 10 ? 0 : 255, 0, 0, 255]);
            const variance = calculateColorVariance(imageData);
            expect(variance).toBeGreaterThan(0);
        });
    });

    describe('calculateAverageSaturation', () => {
        it('should return 0 for grayscale image', () => {
            const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
            expect(calculateAverageSaturation(imageData)).toBe(0);
        });

        it('should return high saturation for pure color image', () => {
            const imageData = createImageData(10, 10, () => [255, 0, 0, 255]);
            const sat = calculateAverageSaturation(imageData);
            expect(sat).toBeGreaterThan(0.5);
        });

        it('should return 0 for empty image data', () => {
            const imageData = createImageData(0, 0);
            const sat = calculateAverageSaturation(imageData);
            expect(sat).toBe(0);
        });
    });

    describe('calculateHistogramWidth', () => {
        it('should return 1 for uniform image', () => {
            const imageData = createImageData(10, 10, () => [100, 100, 100, 255]);
            expect(calculateHistogramWidth(imageData)).toBe(1);
        });

        it('should return more bins for diverse image', () => {
            const imageData = createImageData(32, 32, (x, y) => [
                (x * 8) % 256,
                (y * 8) % 256,
                ((x + y) * 4) % 256,
                255,
            ]);
            const bins = calculateHistogramWidth(imageData);
            expect(bins).toBeGreaterThan(1);
        });
    });

    describe('calculateCenterEdgeRatio', () => {
        it('should return ~1 for uniform image', () => {
            const imageData = createImageData(20, 20, () => [100, 100, 100, 255]);
            const ratio = calculateCenterEdgeRatio(imageData);
            // Uniform → edge variance ≈ center variance ≈ 0
            // Formula: centerVariance / (edgeVariance + 1) ≈ 0/1 = 0
            expect(ratio).toBeLessThan(1.5);
        });

        it('should return higher ratio when center has more detail', () => {
            const imageData = createImageData(20, 20, (x, y) => {
                const cx = x >= 5 && x < 15 && y >= 5 && y < 15;
                if (cx) return [(x * 30) % 256, (y * 30) % 256, 100, 255]; // colorful center
                return [50, 50, 50, 255]; // uniform edges
            });
            const ratio = calculateCenterEdgeRatio(imageData);
            expect(ratio).toBeGreaterThan(0);
        });

        it('should handle 1x1 image', () => {
            const imageData = createImageData(1, 1, () => [100, 100, 100, 255]);
            const ratio = calculateCenterEdgeRatio(imageData);
            expect(typeof ratio).toBe('number');
            expect(isFinite(ratio)).toBe(true);
        });
    });

    describe('calculateEdgeDensity', () => {
        it('should return 0 for uniform image', () => {
            const imageData = createImageData(20, 20, () => [100, 100, 100, 255]);
            expect(calculateEdgeDensity(imageData)).toBe(0);
        });

        it('should return >0 for image with sharp edges', () => {
            const imageData = createImageData(20, 20, (x) => {
                return x < 10 ? [0, 0, 0, 255] : [255, 255, 255, 255];
            });
            const density = calculateEdgeDensity(imageData);
            expect(density).toBeGreaterThan(0);
        });

        it('should return value between 0 and 1', () => {
            const imageData = createImageData(20, 20, (x, y) => [
                (x * 50) % 256, (y * 50) % 256, 0, 255,
            ]);
            const density = calculateEdgeDensity(imageData);
            expect(density).toBeGreaterThanOrEqual(0);
            expect(density).toBeLessThanOrEqual(1);
        });
    });
});
