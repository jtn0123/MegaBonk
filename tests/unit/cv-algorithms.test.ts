/**
 * CV Algorithm Tests (Consolidated)
 *
 * Tests core CV algorithms: template matching (NCC, SSD, SSIM), IoU calculation, and NMS.
 * These are pure mathematical functions that form the foundation of detection.
 */

import { describe, it, expect, test } from 'vitest';
import { calculateIoU, nonMaxSuppression } from '../../src/modules/cv/detection.ts';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';
import { cvTestKit } from '../helpers/cv-test-kit.ts';

// ========================================
// Test Helpers
// ========================================

function createDetection(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    confidence: number
): CVDetectionResult {
    return {
        type: 'item',
        entity: {
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name,
            rarity: 'common',
            tier: 'A',
            image: `images/items/${name.toLowerCase()}.png`,
            base_effect: 'Test effect',
        },
        confidence,
        position: { x, y, width, height },
        method: 'template_match',
    };
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
            arr[y * width + x] = (isBlack !== inverted) ? 0 : 255;
        }
    }
    return arr;
}

// Inline algorithm implementations for testing (pure functions)
function calculateNCC(template: Uint8Array, image: Uint8Array, width: number, height: number): number {
    const n = width * height;
    let sumT = 0, sumI = 0;
    for (let i = 0; i < n; i++) { sumT += template[i]; sumI += image[i]; }
    const meanT = sumT / n, meanI = sumI / n;

    let num = 0, denT = 0, denI = 0;
    for (let i = 0; i < n; i++) {
        const dT = template[i] - meanT, dI = image[i] - meanI;
        num += dT * dI; denT += dT * dT; denI += dI * dI;
    }
    const denom = Math.sqrt(denT * denI);
    return denom === 0 ? 0 : num / denom;
}

function calculateSSD(template: Uint8Array, image: Uint8Array, width: number, height: number): number {
    const n = width * height;
    let ssd = 0;
    for (let i = 0; i < n; i++) { const d = template[i] - image[i]; ssd += d * d; }
    return ssd;
}

function calculateSSIM(template: Uint8Array, image: Uint8Array, width: number, height: number): number {
    const n = width * height, k1 = 0.01, k2 = 0.03, L = 255;
    let sumT = 0, sumI = 0;
    for (let i = 0; i < n; i++) { sumT += template[i]; sumI += image[i]; }
    const muT = sumT / n, muI = sumI / n;

    let varT = 0, varI = 0, cov = 0;
    for (let i = 0; i < n; i++) {
        const dT = template[i] - muT, dI = image[i] - muI;
        varT += dT * dT; varI += dI * dI; cov += dT * dI;
    }
    varT /= n - 1; varI /= n - 1; cov /= n - 1;

    const c1 = (k1 * L) ** 2, c2 = (k2 * L) ** 2;
    const num = (2 * muT * muI + c1) * (2 * cov + c2);
    const den = (muT ** 2 + muI ** 2 + c1) * (varT + varI + c2);
    return den === 0 ? (muT === muI ? 1 : 0) : num / den;
}

// ========================================
// IoU Tests (Parameterized)
// ========================================

describe('IoU Calculation', () => {
    const iouCases = [
        { name: 'identical boxes', b1: { x: 0, y: 0, width: 100, height: 100 }, b2: { x: 0, y: 0, width: 100, height: 100 }, expected: 1.0 },
        { name: 'no overlap', b1: { x: 0, y: 0, width: 50, height: 50 }, b2: { x: 100, y: 100, width: 50, height: 50 }, expected: 0 },
        { name: '50% horizontal overlap', b1: { x: 0, y: 0, width: 100, height: 100 }, b2: { x: 50, y: 0, width: 100, height: 100 }, expected: 0.333 },
        { name: 'contained box', b1: { x: 0, y: 0, width: 100, height: 100 }, b2: { x: 25, y: 25, width: 50, height: 50 }, expected: 0.25 },
        { name: 'corner overlap', b1: { x: 0, y: 0, width: 100, height: 100 }, b2: { x: 90, y: 90, width: 100, height: 100 }, expected: 0.005 },
        { name: 'touching edge', b1: { x: 0, y: 0, width: 50, height: 50 }, b2: { x: 50, y: 0, width: 50, height: 50 }, expected: 0 },
        { name: 'zero-size box', b1: { x: 0, y: 0, width: 0, height: 0 }, b2: { x: 0, y: 0, width: 50, height: 50 }, expected: 0 },
    ];

    test.each(iouCases)('$name → IoU ≈ $expected', ({ b1, b2, expected }) => {
        const iou = calculateIoU(b1, b2);
        expect(iou).toBeCloseTo(expected, 2);
    });

    it('is symmetric', () => {
        const box1: ROI = { x: 10, y: 20, width: 60, height: 80 };
        const box2: ROI = { x: 40, y: 50, width: 70, height: 90 };
        expect(calculateIoU(box1, box2)).toBe(calculateIoU(box2, box1));
    });

    describe('realistic detection scenarios', () => {
        it('high overlap for sliding window shift (45px box, 10px shift)', () => {
            const box1: ROI = { x: 100, y: 100, width: 45, height: 45 };
            const box2: ROI = { x: 110, y: 100, width: 45, height: 45 };
            expect(calculateIoU(box1, box2)).toBeGreaterThan(0.6);
        });

        it('low overlap for edge detection', () => {
            const box1: ROI = { x: 100, y: 100, width: 45, height: 45 };
            const box2: ROI = { x: 130, y: 100, width: 45, height: 45 };
            expect(calculateIoU(box1, box2)).toBeCloseTo(0.2, 2);
        });
    });
});

// ========================================
// NMS Tests
// ========================================

describe('Non-Maximum Suppression', () => {
    describe('basic duplicate removal', () => {
        it('keeps only highest confidence when boxes fully overlap', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 100, 100, 45, 45, 0.85),
                createDetection('Wrench', 100, 100, 45, 45, 0.90),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.95);
        });

        it('keeps all boxes when no overlap', () => {
            const detections = [
                createDetection('Wrench', 0, 0, 45, 45, 0.95),
                createDetection('Medkit', 100, 0, 45, 45, 0.90),
                createDetection('Battery', 0, 100, 45, 45, 0.92),
            ];

            expect(nonMaxSuppression(detections, 0.3)).toHaveLength(3);
        });

        it('removes detections with high IoU overlap', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 110, 100, 45, 45, 0.80),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.95);
        });
    });

    describe('threshold variation', () => {
        it('more aggressive with lower threshold (0.1)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 130, 100, 45, 45, 0.90), // IoU ~0.2
            ];
            expect(nonMaxSuppression(detections, 0.1)).toHaveLength(1);
        });

        it('less aggressive with higher threshold (0.5)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 115, 115, 45, 45, 0.90), // IoU ~0.28
            ];
            expect(nonMaxSuppression(detections, 0.5)).toHaveLength(2);
        });
    });

    describe('edge cases', () => {
        it('handles empty list', () => expect(nonMaxSuppression([], 0.3)).toHaveLength(0));
        it('handles single detection', () => {
            const d = [createDetection('Wrench', 100, 100, 45, 45, 0.95)];
            expect(nonMaxSuppression(d, 0.3)).toHaveLength(1);
        });

        it('handles detection without position', () => {
            const detection: CVDetectionResult = {
                type: 'item',
                entity: { id: 'wrench', name: 'Wrench', rarity: 'common', tier: 'A', image: 'x.png', base_effect: 'T' },
                confidence: 0.95,
                position: undefined,
                method: 'template_match',
            };
            expect(nonMaxSuppression([detection], 0.3)).toHaveLength(1);
        });

        it('preserves original array (immutability)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.80),
                createDetection('Wrench', 105, 105, 45, 45, 0.95),
            ];
            const original = [...detections];
            nonMaxSuppression(detections, 0.3);
            expect(detections).toEqual(original);
        });
    });

    describe('multi-item scenarios', () => {
        it('handles multiple item clusters', () => {
            const detections = [
                // Cluster 1
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 105, 105, 45, 45, 0.85),
                // Cluster 2
                createDetection('Medkit', 300, 100, 45, 45, 0.92),
                createDetection('Medkit', 305, 105, 45, 45, 0.88),
                // Cluster 3
                createDetection('Battery', 100, 300, 45, 45, 0.90),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);
            expect(filtered).toHaveLength(3);

            const names = filtered.map(d => d.entity.name).sort();
            expect(names).toEqual(['Battery', 'Medkit', 'Wrench']);
        });

        it('handles sliding window duplicates', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.90),
                createDetection('Wrench', 110, 100, 45, 45, 0.92),
                createDetection('Wrench', 120, 100, 45, 45, 0.88),
                createDetection('Wrench', 130, 100, 45, 45, 0.85),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.92);
        });

        it('handles grid of non-overlapping items', () => {
            const detections = Array.from({ length: 9 }, (_, i) =>
                createDetection(`Item ${i}`, (i % 3) * 60, Math.floor(i / 3) * 60, 45, 45, 0.85 + i * 0.01)
            );
            expect(nonMaxSuppression(detections, 0.3)).toHaveLength(9);
        });
    });

    describe('performance', () => {
        it('handles 100 detections efficiently', () => {
            const detections = Array.from({ length: 100 }, (_, i) =>
                createDetection(`Item ${i}`, Math.random() * 1000, Math.random() * 600, 45, 45, 0.7 + Math.random() * 0.25)
            );

            const start = performance.now();
            nonMaxSuppression(detections, 0.3);
            expect(performance.now() - start).toBeLessThan(50);
        });
    });
});

// ========================================
// Template Matching Algorithms
// ========================================

describe('Template Matching Algorithms', () => {
    describe('NCC (Normalized Cross-Correlation)', () => {
        it('returns 1.0 for identical images', () => {
            const img = new Uint8Array([100, 150, 200, 100, 150, 200, 100, 150, 200]);
            expect(calculateNCC(img, img, 3, 3)).toBeCloseTo(1.0, 2);
        });

        it('is invariant to brightness scaling', () => {
            const template = new Uint8Array([10, 20, 30]);
            const image = new Uint8Array([50, 100, 150]); // 5x brighter
            expect(calculateNCC(template, image, 3, 1)).toBeGreaterThan(0.99);
        });

        it('handles all zeros gracefully', () => {
            const zeros = new Uint8Array([0, 0, 0]);
            const ncc = calculateNCC(zeros, zeros, 3, 1);
            expect(isNaN(ncc) || ncc === 0).toBe(true);
        });

        it('is symmetric', () => {
            const a = new Uint8Array([10, 20, 30, 40]);
            const b = new Uint8Array([15, 25, 35, 45]);
            expect(calculateNCC(a, b, 2, 2)).toBeCloseTo(calculateNCC(b, a, 2, 2), 5);
        });
    });

    describe('SSD (Sum of Squared Differences)', () => {
        it('returns 0 for identical images', () => {
            const img = new Uint8Array([100, 150, 200]);
            expect(calculateSSD(img, img, 3, 1)).toBe(0);
        });

        it('increases with pixel differences', () => {
            const template = new Uint8Array([100, 100, 100]);
            const img1 = new Uint8Array([101, 101, 101]);
            const img2 = new Uint8Array([110, 110, 110]);

            expect(calculateSSD(template, img1, 3, 1)).toBe(3);  // 1^2 * 3
            expect(calculateSSD(template, img2, 3, 1)).toBe(300); // 10^2 * 3
        });

        it('handles maximum difference', () => {
            const black = new Uint8Array([0, 0, 0]);
            const white = new Uint8Array([255, 255, 255]);
            expect(calculateSSD(black, white, 3, 1)).toBe(3 * 255 * 255);
        });
    });

    describe('SSIM (Structural Similarity)', () => {
        it('returns 1.0 for identical images', () => {
            const img = createTestImage(10, 10, 128);
            expect(calculateSSIM(img, img, 10, 10)).toBeCloseTo(1.0, 2);
        });

        it('returns lower score for different images', () => {
            const img1 = createTestImage(10, 10, 100);
            const img2 = createTestImage(10, 10, 200);
            const ssim = calculateSSIM(img1, img2, 10, 10);
            expect(ssim).toBeLessThan(1.0);
            expect(ssim).toBeGreaterThan(0);
        });

        it('is sensitive to structural changes', () => {
            const checker = createCheckerboard(8, 8);
            const inverted = createCheckerboard(8, 8, true);
            const uniform = createTestImage(8, 8, 128);

            const ssimInv = calculateSSIM(checker, inverted, 8, 8);
            const ssimUni = calculateSSIM(checker, uniform, 8, 8);

            expect(Math.abs(ssimInv - ssimUni)).toBeGreaterThan(0.1);
        });
    });

    describe('performance', () => {
        it('processes small templates quickly', () => {
            const template = createTestImage(32, 32, 128);
            const image = createTestImage(32, 32, 130);

            const start = performance.now();
            for (let i = 0; i < 100; i++) calculateNCC(template, image, 32, 32);
            expect(performance.now() - start).toBeLessThan(10);
        });

        it('handles non-square templates', () => {
            const template = createTestImage(64, 32, 128);
            const image = createTestImage(64, 32, 130);

            expect(typeof calculateNCC(template, image, 64, 32)).toBe('number');
            expect(typeof calculateSSD(template, image, 64, 32)).toBe('number');
        });
    });
});
