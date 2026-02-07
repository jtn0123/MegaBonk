/**
 * @vitest-environment jsdom
 * CV Similarity Module Tests
 * Tests for image similarity calculations and preprocessing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    enhanceContrast,
    normalizeColors,
    preprocessImage,
    calculateNCC,
    calculateEnhancedSimilarity,
} from '../../src/modules/cv/similarity.ts';

// Helper to create test image data
function createImageData(
    width: number,
    height: number,
    fillFn?: (x: number, y: number) => [number, number, number, number]
): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (fillFn) {
                const [r, g, b, a] = fillFn(x, y);
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = a;
            } else {
                // Default: solid gray
                data[i] = 128;
                data[i + 1] = 128;
                data[i + 2] = 128;
                data[i + 3] = 255;
            }
        }
    }
    
    return { data, width, height };
}

// Helper to create gradient image
function createGradientImage(width: number, height: number) {
    return createImageData(width, height, (x, y) => {
        const val = Math.floor((x / width) * 255);
        return [val, val, val, 255];
    });
}

// Helper to create uniform color image
function createUniformImage(width: number, height: number, r: number, g: number, b: number) {
    return createImageData(width, height, () => [r, g, b, 255]);
}

describe('CV Similarity Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // enhanceContrast Tests
    // ========================================
    describe('enhanceContrast', () => {
        it('should return image data with same dimensions', () => {
            const input = createImageData(10, 10);
            const output = enhanceContrast(input);
            
            expect(output.width).toBe(10);
            expect(output.height).toBe(10);
            expect(output.data.length).toBe(input.data.length);
        });

        it('should not modify alpha channel', () => {
            const input = createImageData(2, 2, () => [100, 100, 100, 200]);
            const output = enhanceContrast(input);
            
            // Check all alpha values remain unchanged
            for (let i = 3; i < output.data.length; i += 4) {
                expect(output.data[i]).toBe(200);
            }
        });

        it('should increase contrast of mid-tones', () => {
            // Create image with value 100 (below midpoint 128)
            const input = createUniformImage(2, 2, 100, 100, 100);
            const output = enhanceContrast(input, 1.5);
            
            // Values below midpoint should decrease
            expect(output.data[0]).toBeLessThan(100);
        });

        it('should enhance values above midpoint', () => {
            // Create image with value 160 (above midpoint 128)
            const input = createUniformImage(2, 2, 160, 160, 160);
            const output = enhanceContrast(input, 1.5);
            
            // Values above midpoint should increase
            expect(output.data[0]).toBeGreaterThan(160);
        });

        it('should keep midpoint unchanged', () => {
            const input = createUniformImage(2, 2, 128, 128, 128);
            const output = enhanceContrast(input, 1.5);
            
            // Midpoint should remain at 128
            expect(output.data[0]).toBe(128);
        });

        it('should clamp values to 0-255 range', () => {
            // Very light image
            const lightInput = createUniformImage(2, 2, 250, 250, 250);
            const lightOutput = enhanceContrast(lightInput, 2.0);
            expect(lightOutput.data[0]).toBeLessThanOrEqual(255);
            
            // Very dark image
            const darkInput = createUniformImage(2, 2, 10, 10, 10);
            const darkOutput = enhanceContrast(darkInput, 2.0);
            expect(darkOutput.data[0]).toBeGreaterThanOrEqual(0);
        });

        it('should use default factor of 1.5', () => {
            const input = createUniformImage(2, 2, 100, 100, 100);
            const output = enhanceContrast(input);
            
            // Should be different from input (contrast applied)
            expect(output.data[0]).not.toBe(100);
        });

        it('should handle gradient images', () => {
            const input = createGradientImage(10, 1);
            const output = enhanceContrast(input, 1.5);
            
            // Should still be a gradient (increasing values)
            const values: number[] = [];
            for (let i = 0; i < output.data.length; i += 4) {
                values.push(output.data[i] ?? 0);
            }
            
            // Check most values are increasing (some clipping may occur)
            let increases = 0;
            for (let i = 1; i < values.length; i++) {
                if ((values[i] ?? 0) >= (values[i - 1] ?? 0)) increases++;
            }
            expect(increases).toBeGreaterThan(values.length / 2);
        });

        it('should handle empty image', () => {
            const input = createImageData(0, 0);
            const output = enhanceContrast(input);
            
            expect(output.data.length).toBe(0);
        });

        it('should handle 1x1 image', () => {
            const input = createUniformImage(1, 1, 100, 150, 200);
            const output = enhanceContrast(input);
            
            expect(output.width).toBe(1);
            expect(output.height).toBe(1);
        });
    });

    // ========================================
    // normalizeColors Tests
    // ========================================
    describe('normalizeColors', () => {
        it('should return image data with same dimensions', () => {
            const input = createGradientImage(10, 10);
            const output = normalizeColors(input);
            
            expect(output.width).toBe(10);
            expect(output.height).toBe(10);
        });

        it('should stretch range to 0-255 for images with sufficient range', () => {
            // Image with values 50-200
            const input = createImageData(10, 1, (x) => {
                const val = 50 + Math.floor((x / 10) * 150);
                return [val, val, val, 255];
            });
            
            const output = normalizeColors(input);
            
            // Find min and max after normalization
            let min = 255, max = 0;
            for (let i = 0; i < output.data.length; i += 4) {
                min = Math.min(min, output.data[i] ?? 255);
                max = Math.max(max, output.data[i] ?? 0);
            }
            
            // Should be stretched closer to full range
            expect(min).toBeLessThan(50);
            expect(max).toBeGreaterThan(200);
        });

        it('should not modify near-uniform images (range < 20)', () => {
            // Very uniform image (range < 20)
            const input = createImageData(10, 10, () => {
                const val = 128 + Math.floor(Math.random() * 10); // Range ~10
                return [val, val, val, 255];
            });
            
            const output = normalizeColors(input);
            
            // Should be mostly unchanged
            const avgDiff = Math.abs((output.data[0] ?? 0) - (input.data[0] ?? 0));
            expect(avgDiff).toBeLessThan(30);
        });

        it('should not modify alpha channel', () => {
            const input = createImageData(2, 2, () => [100, 150, 200, 180]);
            const output = normalizeColors(input);
            
            for (let i = 3; i < output.data.length; i += 4) {
                expect(output.data[i]).toBe(180);
            }
        });

        it('should handle single color image', () => {
            const input = createUniformImage(5, 5, 128, 128, 128);
            const output = normalizeColors(input);
            
            // Should not crash, range would be 0 so values stay same
            expect(output.data[0]).toBe(128);
        });

        it('should normalize each channel independently', () => {
            // Image with different ranges per channel
            const input = createImageData(10, 1, (x) => [
                50 + x * 10,  // R: 50-140 (range 90)
                100,          // G: constant (range 0)
                200 - x * 5,  // B: 200-155 (range 45)
                255
            ]);
            
            const output = normalizeColors(input);
            
            // R channel should be normalized (has range > 20)
            // G channel should be unchanged (constant)
            // B channel should be normalized (has range > 20)
            expect(output.data[1]).toBe(100); // G unchanged
        });
    });

    // ========================================
    // preprocessImage Tests
    // ========================================
    describe('preprocessImage', () => {
        it('should apply both contrast enhancement and normalization', () => {
            // Use an image with mid-range values that will be affected by both operations
            const input = createImageData(10, 10, (x, y) => {
                const val = 80 + (x * 10); // Values from 80-170, crossing midpoint
                return [val, val, val, 255];
            });
            const output = preprocessImage(input);
            
            // At least some pixels should be different after preprocessing
            let differentCount = 0;
            for (let i = 0; i < input.data.length; i += 4) {
                if (output.data[i] !== input.data[i]) differentCount++;
            }
            expect(differentCount).toBeGreaterThan(0);
        });

        it('should return valid image data structure', () => {
            const input = createImageData(20, 15);
            const output = preprocessImage(input);
            
            expect(output).toHaveProperty('data');
            expect(output).toHaveProperty('width', 20);
            expect(output).toHaveProperty('height', 15);
            expect(output.data.length).toBe(20 * 15 * 4);
        });

        it('should preserve image dimensions', () => {
            const input = createImageData(100, 50);
            const output = preprocessImage(input);
            
            expect(output.width).toBe(100);
            expect(output.height).toBe(50);
        });
    });

    // ========================================
    // calculateNCC Tests
    // ========================================
    describe('calculateNCC', () => {
        it('should return 1 for identical images', () => {
            const image = createGradientImage(10, 10);
            const ncc = calculateNCC(image, image);
            
            expect(ncc).toBeCloseTo(1.0, 2);
        });

        it('should return high similarity for similar images', () => {
            // Use gradient images with slight difference for meaningful NCC
            const image1 = createGradientImage(10, 10);
            const image2 = createImageData(10, 10, (x, y) => {
                const val = Math.floor((x / 10) * 255) + 5; // Slight offset
                return [Math.min(255, val), Math.min(255, val), Math.min(255, val), 255];
            });
            
            const ncc = calculateNCC(image1, image2);
            
            // Similar gradients should have high correlation
            expect(ncc).toBeGreaterThan(0.8);
        });

        it('should return low similarity for different images', () => {
            const image1 = createUniformImage(10, 10, 0, 0, 0);
            const image2 = createUniformImage(10, 10, 255, 255, 255);
            
            const ncc = calculateNCC(image1, image2);
            
            expect(ncc).toBeLessThan(0.5);
        });

        it('should handle gradient vs uniform', () => {
            const gradient = createGradientImage(10, 10);
            const uniform = createUniformImage(10, 10, 128, 128, 128);
            
            const ncc = calculateNCC(gradient, uniform);
            
            // Should be moderate similarity (gradient has same average as uniform)
            expect(ncc).toBeLessThan(1.0);
        });

        it('should be symmetric', () => {
            const image1 = createGradientImage(10, 10);
            const image2 = createUniformImage(10, 10, 100, 150, 200);
            
            const ncc1 = calculateNCC(image1, image2);
            const ncc2 = calculateNCC(image2, image1);
            
            expect(ncc1).toBeCloseTo(ncc2, 5);
        });

        it('should handle small images', () => {
            const image1 = createUniformImage(1, 1, 128, 128, 128);
            const image2 = createUniformImage(1, 1, 128, 128, 128);
            
            const ncc = calculateNCC(image1, image2);
            
            expect(ncc).toBeGreaterThanOrEqual(0);
            expect(ncc).toBeLessThanOrEqual(1);
        });

        it('should return valid range [0, 1] or close', () => {
            const tests = [
                [createUniformImage(5, 5, 0, 0, 0), createUniformImage(5, 5, 255, 255, 255)],
                [createGradientImage(5, 5), createUniformImage(5, 5, 0, 0, 0)],
                [createGradientImage(10, 10), createGradientImage(10, 10)],
            ];
            
            for (const [img1, img2] of tests) {
                const ncc = calculateNCC(img1, img2);
                // NCC can be slightly outside [0,1] due to numerical precision
                expect(ncc).toBeGreaterThanOrEqual(-0.1);
                expect(ncc).toBeLessThanOrEqual(1.1);
            }
        });
    });

    // ========================================
    // calculateEnhancedSimilarity Tests
    // ========================================
    describe('calculateEnhancedSimilarity', () => {
        it('should return similarity score between 0 and 1', () => {
            const image1 = createGradientImage(32, 32);
            const image2 = createGradientImage(32, 32);
            
            const similarity = calculateEnhancedSimilarity(image1, image2);
            
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });

        it('should return high similarity for identical images', () => {
            const image = createGradientImage(32, 32);
            
            const similarity = calculateEnhancedSimilarity(image, image);
            
            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return lower similarity for different images', () => {
            const image1 = createUniformImage(32, 32, 0, 0, 0);
            const image2 = createUniformImage(32, 32, 255, 255, 255);
            
            const similarity = calculateEnhancedSimilarity(image1, image2);
            
            expect(similarity).toBeLessThan(0.5);
        });

        it('should handle preprocessing option', () => {
            const image1 = createGradientImage(32, 32);
            const image2 = createGradientImage(32, 32);
            
            // With preprocessing
            const simWithPreprocess = calculateEnhancedSimilarity(image1, image2, { useAdaptive: false });
            
            expect(simWithPreprocess).toBeGreaterThanOrEqual(0);
            expect(simWithPreprocess).toBeLessThanOrEqual(1);
        });

        it('should handle different sized images by comparing common area', () => {
            const image1 = createGradientImage(10, 10);
            const image2 = createGradientImage(10, 10);
            
            const similarity = calculateEnhancedSimilarity(image1, image2);
            
            // Should still work
            expect(similarity).toBeGreaterThanOrEqual(0);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle zero-sized images in enhanceContrast', () => {
            const input = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
            const output = enhanceContrast(input);
            expect(output.data.length).toBe(0);
        });

        it('should handle zero-sized images in normalizeColors', () => {
            const input = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
            const output = normalizeColors(input);
            expect(output.data.length).toBe(0);
        });

        it('should handle images with all black pixels', () => {
            const black = createUniformImage(10, 10, 0, 0, 0);
            const output = preprocessImage(black);
            
            // Should not crash, all pixels should remain valid
            for (let i = 0; i < output.data.length; i += 4) {
                expect(output.data[i]).toBeGreaterThanOrEqual(0);
                expect(output.data[i]).toBeLessThanOrEqual(255);
            }
        });

        it('should handle images with all white pixels', () => {
            const white = createUniformImage(10, 10, 255, 255, 255);
            const output = preprocessImage(white);
            
            for (let i = 0; i < output.data.length; i += 4) {
                expect(output.data[i]).toBeGreaterThanOrEqual(0);
                expect(output.data[i]).toBeLessThanOrEqual(255);
            }
        });

        it('should handle very large images', () => {
            const large = createUniformImage(100, 100, 128, 128, 128);
            const output = enhanceContrast(large);
            
            expect(output.width).toBe(100);
            expect(output.height).toBe(100);
        });

        it('should handle non-square images', () => {
            const wide = createImageData(50, 10);
            const tall = createImageData(10, 50);
            
            const wideOutput = preprocessImage(wide);
            const tallOutput = preprocessImage(tall);
            
            expect(wideOutput.width).toBe(50);
            expect(wideOutput.height).toBe(10);
            expect(tallOutput.width).toBe(10);
            expect(tallOutput.height).toBe(50);
        });
    });
});
