/**
 * Unit Tests for CV Algorithm Correctness
 * Tests template matching algorithms (NCC, SSD, SSIM) directly
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('CV Template Matching Algorithms', () => {
    describe('Normalized Cross-Correlation (NCC)', () => {
        it('should return 1.0 for identical images', () => {
            // Create identical 3x3 grayscale images
            const template = new Uint8Array([100, 150, 200, 100, 150, 200, 100, 150, 200]);
            const image = new Uint8Array([100, 150, 200, 100, 150, 200, 100, 150, 200]);

            const ncc = calculateNCC(template, image, 3, 3);

            expect(ncc).toBeCloseTo(1.0, 2);
        });

        it('should return 0.0 for completely different images', () => {
            const template = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]);
            const image = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);

            const ncc = calculateNCC(template, image, 3, 3);

            // NCC of constant images vs opposite constant should be undefined/0
            expect(Math.abs(ncc)).toBeLessThan(0.1);
        });

        it('should be invariant to brightness scaling', () => {
            // Template: [10, 20, 30]
            // Image: [50, 100, 150] (5x brighter, same pattern)
            const template = new Uint8Array([10, 20, 30]);
            const image = new Uint8Array([50, 100, 150]);

            const ncc = calculateNCC(template, image, 3, 1);

            // NCC should be ~1.0 because pattern is the same
            expect(ncc).toBeGreaterThan(0.99);
        });

        it('should handle edge case: all zeros', () => {
            const template = new Uint8Array([0, 0, 0]);
            const image = new Uint8Array([0, 0, 0]);

            const ncc = calculateNCC(template, image, 3, 1);

            // Should not crash, return 0 or handle gracefully
            expect(isNaN(ncc) || ncc === 0).toBe(true);
        });

        it('should be symmetric', () => {
            const template = new Uint8Array([10, 20, 30, 40]);
            const image = new Uint8Array([15, 25, 35, 45]);

            const ncc1 = calculateNCC(template, image, 2, 2);
            const ncc2 = calculateNCC(image, template, 2, 2);

            expect(ncc1).toBeCloseTo(ncc2, 5);
        });
    });

    describe('Sum of Squared Differences (SSD)', () => {
        it('should return 0 for identical images', () => {
            const template = new Uint8Array([100, 150, 200]);
            const image = new Uint8Array([100, 150, 200]);

            const ssd = calculateSSD(template, image, 3, 1);

            expect(ssd).toBe(0);
        });

        it('should increase with pixel differences', () => {
            const template = new Uint8Array([100, 100, 100]);
            const image1 = new Uint8Array([101, 101, 101]); // diff = 1 per pixel
            const image2 = new Uint8Array([110, 110, 110]); // diff = 10 per pixel

            const ssd1 = calculateSSD(template, image1, 3, 1);
            const ssd2 = calculateSSD(template, image2, 3, 1);

            expect(ssd2).toBeGreaterThan(ssd1);
            expect(ssd1).toBe(3); // 1^2 + 1^2 + 1^2
            expect(ssd2).toBe(300); // 10^2 + 10^2 + 10^2
        });

        it('should handle maximum difference', () => {
            const template = new Uint8Array([0, 0, 0]);
            const image = new Uint8Array([255, 255, 255]);

            const ssd = calculateSSD(template, image, 3, 1);

            expect(ssd).toBe(3 * 255 * 255);
        });

        it('should be symmetric', () => {
            const template = new Uint8Array([50, 100, 150]);
            const image = new Uint8Array([60, 110, 160]);

            const ssd1 = calculateSSD(template, image, 3, 1);
            const ssd2 = calculateSSD(image, template, 3, 1);

            expect(ssd1).toBe(ssd2);
        });
    });

    describe('Structural Similarity Index (SSIM)', () => {
        it('should return 1.0 for identical images', () => {
            const template = createTestImage(10, 10, 128);
            const image = createTestImage(10, 10, 128);

            const ssim = calculateSSIM(template, image, 10, 10);

            expect(ssim).toBeCloseTo(1.0, 2);
        });

        it('should return lower score for different images', () => {
            const template = createTestImage(10, 10, 100);
            const image = createTestImage(10, 10, 200);

            const ssim = calculateSSIM(template, image, 10, 10);

            expect(ssim).toBeLessThan(1.0);
            expect(ssim).toBeGreaterThan(0);
        });

        it('should be sensitive to structural changes', () => {
            // Create checkerboard pattern
            const template = createCheckerboard(8, 8);
            // Create inverted checkerboard
            const imageInverted = createCheckerboard(8, 8, true);
            // Create uniform image
            const imageUniform = createTestImage(8, 8, 128);

            const ssimInverted = calculateSSIM(template, imageInverted, 8, 8);
            const ssimUniform = calculateSSIM(template, imageUniform, 8, 8);

            // Both should have different SSIM scores
            expect(Math.abs(ssimInverted - ssimUniform)).toBeGreaterThan(0.1);
            // Original vs uniform should be low (different structure)
            expect(Math.abs(ssimUniform)).toBeLessThan(1.0);
        });

        it('should handle edge case: all zeros', () => {
            const template = new Uint8Array(100).fill(0);
            const image = new Uint8Array(100).fill(0);

            const ssim = calculateSSIM(template, image, 10, 10);

            // Should not crash
            expect(isNaN(ssim) || ssim === 1.0).toBe(true);
        });
    });

    describe('Algorithm Performance Characteristics', () => {
        it('should process small templates quickly (< 10ms)', () => {
            const template = createTestImage(32, 32, 128);
            const image = createTestImage(32, 32, 130);

            const start = performance.now();
            for (let i = 0; i < 100; i++) {
                calculateNCC(template, image, 32, 32);
            }
            const elapsed = performance.now() - start;

            // 100 iterations should take < 10ms
            expect(elapsed).toBeLessThan(10);
        });

        it('should handle large templates without crashing', () => {
            const template = createTestImage(256, 256, 128);
            const image = createTestImage(256, 256, 130);

            expect(() => {
                calculateNCC(template, image, 256, 256);
            }).not.toThrow();
        });

        it('should handle non-square templates', () => {
            const template = createTestImage(64, 32, 128); // Wide rectangle
            const image = createTestImage(64, 32, 130);

            const ncc = calculateNCC(template, image, 64, 32);
            const ssd = calculateSSD(template, image, 64, 32);

            expect(typeof ncc).toBe('number');
            expect(typeof ssd).toBe('number');
        });
    });
});

// Helper functions

function calculateNCC(template: Uint8Array, image: Uint8Array, width: number, height: number): number {
    const n = width * height;
    let sumTemplate = 0;
    let sumImage = 0;

    for (let i = 0; i < n; i++) {
        sumTemplate += template[i];
        sumImage += image[i];
    }

    const meanTemplate = sumTemplate / n;
    const meanImage = sumImage / n;

    let numerator = 0;
    let denomTemplate = 0;
    let denomImage = 0;

    for (let i = 0; i < n; i++) {
        const diffTemplate = template[i] - meanTemplate;
        const diffImage = image[i] - meanImage;

        numerator += diffTemplate * diffImage;
        denomTemplate += diffTemplate * diffTemplate;
        denomImage += diffImage * diffImage;
    }

    const denom = Math.sqrt(denomTemplate * denomImage);

    if (denom === 0) {
        return 0;
    }

    return numerator / denom;
}

function calculateSSD(template: Uint8Array, image: Uint8Array, width: number, height: number): number {
    const n = width * height;
    let ssd = 0;

    for (let i = 0; i < n; i++) {
        const diff = template[i] - image[i];
        ssd += diff * diff;
    }

    return ssd;
}

function calculateSSIM(
    template: Uint8Array,
    image: Uint8Array,
    width: number,
    height: number,
    k1: number = 0.01,
    k2: number = 0.03,
    L: number = 255
): number {
    const n = width * height;

    // Calculate means
    let sumTemplate = 0;
    let sumImage = 0;
    for (let i = 0; i < n; i++) {
        sumTemplate += template[i];
        sumImage += image[i];
    }
    const muTemplate = sumTemplate / n;
    const muImage = sumImage / n;

    // Calculate variances and covariance
    let varTemplate = 0;
    let varImage = 0;
    let covar = 0;

    for (let i = 0; i < n; i++) {
        const diffTemplate = template[i] - muTemplate;
        const diffImage = image[i] - muImage;

        varTemplate += diffTemplate * diffTemplate;
        varImage += diffImage * diffImage;
        covar += diffTemplate * diffImage;
    }

    varTemplate /= n - 1;
    varImage /= n - 1;
    covar /= n - 1;

    const c1 = (k1 * L) ** 2;
    const c2 = (k2 * L) ** 2;

    const numerator = (2 * muTemplate * muImage + c1) * (2 * covar + c2);
    const denominator = (muTemplate * muTemplate + muImage * muImage + c1) * (varTemplate + varImage + c2);

    if (denominator === 0) {
        return muTemplate === muImage ? 1.0 : 0.0;
    }

    return numerator / denominator;
}

function createTestImage(width: number, height: number, value: number): Uint8Array {
    const arr = new Uint8Array(width * height);
    arr.fill(value);
    return arr;
}

function createCheckerboard(width: number, height: number, inverted: boolean = false): Uint8Array {
    const arr = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const isBlack = (x + y) % 2 === 0;
            const value = (isBlack !== inverted) ? 0 : 255;
            arr[y * width + x] = value;
        }
    }
    return arr;
}
