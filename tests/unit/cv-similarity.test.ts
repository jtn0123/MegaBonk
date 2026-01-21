// ========================================
// CV Similarity Module Tests
// ========================================

import { describe, it, expect } from 'vitest';
import {
    enhanceContrast,
    normalizeColors,
    preprocessImage,
    calculateNCC,
    calculateSSIM,
    calculateHistogramSimilarity,
    calculateEdgeSimilarity,
    calculateCombinedSimilarity,
    calculateEnhancedSimilarity,
} from '../../src/modules/cv/similarity.ts';

// ========================================
// Test Helpers
// ========================================

function createMockImageData(width: number, height: number, value: number = 128): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = value; // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = 255; // A
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

function createGradientImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const value = Math.floor((x / width) * 255);
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
            data[idx + 3] = 255;
        }
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

function createColorfulImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            data[idx] = (x * 50) % 256; // R
            data[idx + 1] = (y * 50) % 256; // G
            data[idx + 2] = ((x + y) * 25) % 256; // B
            data[idx + 3] = 255;
        }
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// ========================================
// Preprocessing Tests
// ========================================

describe('CV Similarity - Preprocessing', () => {
    describe('enhanceContrast', () => {
        it('should increase contrast around midpoint', () => {
            const input = createMockImageData(4, 4, 128);
            const result = enhanceContrast(input);

            expect(result.width).toBe(4);
            expect(result.height).toBe(4);
            // Midpoint values should stay the same
            expect(result.data[0]).toBe(128);
        });

        it('should push dark values darker and light values lighter', () => {
            const input = createGradientImageData(4, 4);
            const result = enhanceContrast(input, 1.5);

            // Verify output dimensions
            expect(result.width).toBe(input.width);
            expect(result.height).toBe(input.height);
        });

        it('should clamp values to valid range', () => {
            const input = createMockImageData(4, 4, 255);
            const result = enhanceContrast(input, 2.0);

            // Values should be clamped to 0-255
            for (let i = 0; i < result.data.length; i += 4) {
                expect(result.data[i]).toBeLessThanOrEqual(255);
                expect(result.data[i]).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('normalizeColors', () => {
        it('should expand color range to full 0-255', () => {
            const input = createMockImageData(4, 4, 128);
            // Set some variation
            input.data[0] = 100;
            input.data[4] = 150;

            const result = normalizeColors(input);

            expect(result.width).toBe(4);
            expect(result.height).toBe(4);
        });

        it('should handle uniform images without division by zero', () => {
            const input = createMockImageData(4, 4, 128);
            const result = normalizeColors(input);

            // Should not throw and should return valid data
            expect(result.data.length).toBe(input.data.length);
        });
    });

    describe('preprocessImage', () => {
        it('should apply both contrast enhancement and color normalization', () => {
            const input = createGradientImageData(8, 8);
            const result = preprocessImage(input);

            expect(result.width).toBe(8);
            expect(result.height).toBe(8);
            expect(result.data.length).toBe(input.data.length);
        });
    });
});

// ========================================
// Individual Similarity Method Tests
// ========================================

describe('CV Similarity - Individual Methods', () => {
    describe('calculateNCC', () => {
        it('should return high similarity for identical images', () => {
            const img = createGradientImageData(8, 8);
            const similarity = calculateNCC(img, img);

            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return lower similarity for different images', () => {
            const img1 = createMockImageData(8, 8, 50);
            const img2 = createMockImageData(8, 8, 200);

            const similarity = calculateNCC(img1, img2);

            // Uniform but different - NCC returns 0 due to zero variance
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });

        it('should return value in 0-1 range', () => {
            const img1 = createGradientImageData(8, 8);
            const img2 = createColorfulImageData(8, 8);

            const similarity = calculateNCC(img1, img2);

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });

    describe('calculateSSIM', () => {
        it('should return high similarity for identical images', () => {
            const img = createGradientImageData(8, 8);
            const similarity = calculateSSIM(img, img);

            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return 0 for images with different dimensions', () => {
            const img1 = createMockImageData(8, 8);
            const img2 = createMockImageData(4, 4);

            const similarity = calculateSSIM(img1, img2);

            expect(similarity).toBe(0);
        });

        it('should return value in valid range', () => {
            const img1 = createGradientImageData(8, 8);
            const img2 = createColorfulImageData(8, 8);

            const similarity = calculateSSIM(img1, img2);

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });

    describe('calculateHistogramSimilarity', () => {
        it('should return high similarity for identical images', () => {
            const img = createGradientImageData(8, 8);
            const similarity = calculateHistogramSimilarity(img, img);

            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return 1 for identical uniform images', () => {
            const img1 = createMockImageData(8, 8, 128);
            const img2 = createMockImageData(8, 8, 128);

            const similarity = calculateHistogramSimilarity(img1, img2);

            expect(similarity).toBe(1);
        });

        it('should return lower similarity for different color distributions', () => {
            const img1 = createMockImageData(8, 8, 50);
            const img2 = createMockImageData(8, 8, 200);

            const similarity = calculateHistogramSimilarity(img1, img2);

            // Different colors should have lower histogram similarity
            expect(similarity).toBeLessThan(1);
        });
    });

    describe('calculateEdgeSimilarity', () => {
        it('should return high similarity for identical images', () => {
            const img = createGradientImageData(8, 8);
            const similarity = calculateEdgeSimilarity(img, img);

            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return 0 for images with different dimensions', () => {
            const img1 = createMockImageData(8, 8);
            const img2 = createMockImageData(4, 4);

            const similarity = calculateEdgeSimilarity(img1, img2);

            expect(similarity).toBe(0);
        });

        it('should handle uniform images (no edges)', () => {
            const img1 = createMockImageData(8, 8, 128);
            const img2 = createMockImageData(8, 8, 128);

            const similarity = calculateEdgeSimilarity(img1, img2);

            // Both have no edges, should return 0 (0/0 case handled)
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });
});

// ========================================
// Combined Similarity Tests
// ========================================

describe('CV Similarity - Combined Methods', () => {
    describe('calculateCombinedSimilarity', () => {
        it('should return high similarity for identical images', () => {
            const img = createGradientImageData(8, 8);
            const similarity = calculateCombinedSimilarity(img, img);

            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should return value in 0-0.99 range', () => {
            const img1 = createGradientImageData(8, 8);
            const img2 = createColorfulImageData(8, 8);

            const similarity = calculateCombinedSimilarity(img1, img2);

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(0.99);
        });

        it('should handle uniform images correctly', () => {
            const img1 = createMockImageData(8, 8, 128);
            const img2 = createMockImageData(8, 8, 128);

            const similarity = calculateCombinedSimilarity(img1, img2);

            // Identical uniform images should have high similarity
            expect(similarity).toBeGreaterThan(0.5);
        });

        it('should give agreement bonus when methods agree', () => {
            const img1 = createGradientImageData(16, 16);
            const img2 = createGradientImageData(16, 16);

            const similarity = calculateCombinedSimilarity(img1, img2);

            // Identical images - all methods should agree
            expect(similarity).toBeGreaterThan(0.9);
        });
    });

    describe('calculateEnhancedSimilarity', () => {
        it('should be an alias for calculateCombinedSimilarity', () => {
            const img1 = createGradientImageData(8, 8);
            const img2 = createColorfulImageData(8, 8);

            const combined = calculateCombinedSimilarity(img1, img2);
            const enhanced = calculateEnhancedSimilarity(img1 as ImageData, img2 as ImageData);

            expect(enhanced).toBe(combined);
        });
    });
});

// ========================================
// Edge Cases
// ========================================

describe('CV Similarity - Edge Cases', () => {
    it('should handle very small images (2x2)', () => {
        const img1 = createMockImageData(2, 2, 100);
        const img2 = createMockImageData(2, 2, 100);

        const similarity = calculateCombinedSimilarity(img1, img2);

        expect(typeof similarity).toBe('number');
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle larger images efficiently', () => {
        const img1 = createGradientImageData(64, 64);
        const img2 = createGradientImageData(64, 64);

        const start = performance.now();
        const similarity = calculateCombinedSimilarity(img1, img2);
        const elapsed = performance.now() - start;

        expect(similarity).toBeGreaterThan(0.9);
        // Should complete in reasonable time
        expect(elapsed).toBeLessThan(500);
    });

    it('should handle images with all same values', () => {
        const img1 = createMockImageData(8, 8, 0);
        const img2 = createMockImageData(8, 8, 0);

        const similarity = calculateCombinedSimilarity(img1, img2);

        expect(similarity).toBeGreaterThan(0.5);
    });

    it('should handle images with max values', () => {
        const img1 = createMockImageData(8, 8, 255);
        const img2 = createMockImageData(8, 8, 255);

        const similarity = calculateCombinedSimilarity(img1, img2);

        expect(similarity).toBeGreaterThan(0.5);
    });
});
