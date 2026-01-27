/**
 * Tests for new empty cell detection methods (#1, #2, #3, #7)
 * These methods improve detection of textured backgrounds like grey brick
 */
import { describe, it, expect } from 'vitest';
import {
    calculateAverageSaturation,
    calculateHistogramWidth,
    calculateCenterEdgeRatio,
    isEmptyCell,
    EMPTY_DETECTION_CONFIG,
} from '../../src/modules/cv/color';
import { cvTestKit } from '../helpers/cv-test-kit';

const { image } = cvTestKit;

describe('Empty Cell Detection - New Methods', () => {
    describe('#2: calculateAverageSaturation', () => {
        it('should return ~0 for pure grey image', () => {
            const greyImage = image.solid(40, 40, 128, 128, 128);
            const saturation = calculateAverageSaturation(greyImage);
            expect(saturation).toBeLessThan(0.01);
        });

        it('should return high value for saturated red image', () => {
            const redImage = image.solid(40, 40, 255, 0, 0);
            const saturation = calculateAverageSaturation(redImage);
            expect(saturation).toBeGreaterThan(0.9);
        });

        it('should return high value for saturated blue image', () => {
            const blueImage = image.solid(40, 40, 0, 0, 255);
            const saturation = calculateAverageSaturation(blueImage);
            expect(saturation).toBeGreaterThan(0.9);
        });

        it('should return ~0 for grey brick pattern (varied grey)', () => {
            // Simulates grey brick texture with variance but no color
            const brickImage = image.create(40, 40, (x, y) => {
                const noise = ((x * 7 + y * 13) % 40) - 20;
                const val = Math.max(0, Math.min(255, 100 + noise));
                return [val, val, val];
            });
            const saturation = calculateAverageSaturation(brickImage);
            expect(saturation).toBeLessThan(0.01);
        });

        it('should return medium value for desaturated colored image', () => {
            // Slightly tinted image
            const tintedImage = image.solid(40, 40, 150, 140, 130);
            const saturation = calculateAverageSaturation(tintedImage);
            expect(saturation).toBeGreaterThan(0.05);
            expect(saturation).toBeLessThan(0.3);
        });
    });

    describe('#3: calculateHistogramWidth', () => {
        it('should return 1 for uniform color image', () => {
            const uniformImage = image.solid(40, 40, 128, 128, 128);
            const histWidth = calculateHistogramWidth(uniformImage);
            expect(histWidth).toBe(1);
        });

        it('should return few bins for grey brick pattern', () => {
            const brickImage = image.create(40, 40, (x, y) => {
                const noise = ((x * 7 + y * 13) % 40) - 20;
                const val = Math.max(0, Math.min(255, 100 + noise));
                return [val, val, val];
            });
            const histWidth = calculateHistogramWidth(brickImage);
            // Grey brick should have few bins (all greys quantize similarly)
            expect(histWidth).toBeLessThan(8);
        });

        it('should return many bins for colorful image', () => {
            const colorfulImage = image.create(40, 40, (x, y) => {
                return [
                    Math.min(255, x * 6),
                    Math.min(255, y * 6),
                    Math.min(255, (x + y) * 3),
                ];
            });
            const histWidth = calculateHistogramWidth(colorfulImage);
            expect(histWidth).toBeGreaterThan(10);
        });
    });

    describe('#7: calculateCenterEdgeRatio', () => {
        it('should return ~0 for uniform image (both center and edge have zero variance)', () => {
            const uniformImage = image.solid(40, 40, 128, 128, 128);
            const ratio = calculateCenterEdgeRatio(uniformImage);
            // Uniform image has zero variance in both center and edge
            // Ratio = 0 / (0 + 1) = 0
            expect(ratio).toBeLessThan(0.1);
        });

        it('should return > 1 for image with icon in center', () => {
            // Image with colorful center and grey edges
            const iconImage = image.create(40, 40, (x, y) => {
                const cx = 20,
                    cy = 20,
                    radius = 10;
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < radius) {
                    // Colorful center with variance
                    return [
                        200 + ((x * 7) % 55),
                        100 + ((y * 11) % 55),
                        50 + (((x + y) * 3) % 55),
                    ];
                }
                // Uniform grey edges
                return [80, 80, 80];
            });
            const ratio = calculateCenterEdgeRatio(iconImage);
            // Center should have more variance than edges
            expect(ratio).toBeGreaterThan(1.0);
        });

        it('should return ~1 for uniform brick pattern', () => {
            // Brick pattern has similar variance throughout
            const brickImage = image.create(40, 40, (x, y) => {
                const noise = ((x * 7 + y * 13) % 40) - 20;
                const val = Math.max(0, Math.min(255, 100 + noise));
                return [val, val, val];
            });
            const ratio = calculateCenterEdgeRatio(brickImage);
            // Should be close to 1 since pattern is uniform across image
            expect(ratio).toBeGreaterThan(0.5);
            expect(ratio).toBeLessThan(2.0);
        });
    });

    describe('isEmptyCell integration', () => {
        it('should detect uniform grey as empty', () => {
            const greyImage = image.solid(40, 40, 128, 128, 128);
            expect(isEmptyCell(greyImage)).toBe(true);
        });

        it('should detect grey brick pattern as empty (via saturation check)', () => {
            // This is the key test case - grey brick should be detected as empty
            const brickImage = image.create(40, 40, (x, y) => {
                const noise = ((x * 7 + y * 13) % 40) - 20;
                const val = Math.max(0, Math.min(255, 100 + noise));
                return [val, val, val];
            });

            // With saturation method enabled, this should be detected as empty
            if (EMPTY_DETECTION_CONFIG.methods.useSaturation) {
                expect(isEmptyCell(brickImage)).toBe(true);
            }
        });

        it('should NOT detect colorful image as empty', () => {
            const colorfulImage = image.create(40, 40, (x, y) => {
                return [
                    Math.min(255, x * 6),
                    Math.min(255, y * 6),
                    Math.min(255, (x + y) * 3),
                ];
            });
            expect(isEmptyCell(colorfulImage)).toBe(false);
        });

        it('should NOT detect image with centered icon as empty', () => {
            // Image with colorful center and grey edges - simulates an item icon
            const iconImage = image.create(40, 40, (x, y) => {
                const cx = 20,
                    cy = 20,
                    radius = 10;
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < radius) {
                    // Colorful center
                    return [255, 100, 50];
                }
                // Grey edges
                return [80, 80, 80];
            });
            expect(isEmptyCell(iconImage)).toBe(false);
        });

        it('should detect very dark cells as empty', () => {
            const darkImage = image.solid(40, 40, 20, 20, 20);
            expect(isEmptyCell(darkImage)).toBe(true);
        });
    });

    describe('EMPTY_DETECTION_CONFIG', () => {
        it('should have expected default method toggles', () => {
            expect(EMPTY_DETECTION_CONFIG.methods.useVariance).toBe(true);
            expect(EMPTY_DETECTION_CONFIG.methods.useConfidenceThreshold).toBe(true);
            expect(EMPTY_DETECTION_CONFIG.methods.useSaturation).toBe(true);
            // Experimental methods off by default
            expect(EMPTY_DETECTION_CONFIG.methods.useHistogram).toBe(false);
            expect(EMPTY_DETECTION_CONFIG.methods.useCenterEdge).toBe(false);
        });

        it('should have reasonable threshold values', () => {
            expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeGreaterThan(0.4);
            expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeLessThan(0.6);
            expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeGreaterThan(0.1);
            expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeLessThan(0.2);
        });
    });
});
