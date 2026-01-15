// ========================================
// Computer Vision Similarity & Matching Tests
// ========================================
// Tests for similarity calculations, IoU, and matching algorithms
// Focus: Mathematical algorithms, template matching, boundary conditions
// ========================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ROI } from '../../src/modules/computer-vision.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock test-utils
vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn(() => ({ category: '1080p', width: 1920, height: 1080 })),
    detectUILayout: vi.fn(() => ({ layout: 'standard' })),
}));

// Polyfill ImageData for jsdom
beforeEach(() => {
    if (typeof ImageData === 'undefined') {
        (global as any).ImageData = class ImageData {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            colorSpace: PredefinedColorSpace;

            constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
                if (data instanceof Uint8ClampedArray) {
                    this.data = data;
                    this.width = width;
                    this.height = height!;
                } else {
                    this.width = data;
                    this.height = width;
                    this.data = new Uint8ClampedArray(this.width * this.height * 4);
                }
                this.colorSpace = 'srgb';
            }
        };
    }
});

// Helper to create test ImageData
const createImageData = (width: number, height: number, fillValue: number = 128): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = fillValue; // R
        data[i + 1] = fillValue; // G
        data[i + 2] = fillValue; // B
        data[i + 3] = 255; // A
    }
    return new ImageData(data, width, height);
};

// Helper to create gradient ImageData
const createGradientImageData = (width: number, height: number): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const value = Math.floor((x / width) * 255);
            data[i] = value; // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
            data[i + 3] = 255; // A
        }
    }
    return new ImageData(data, width, height);
};

describe('Computer Vision - IoU (Intersection over Union)', () => {
    // Since calculateIoU is not exported, we'll test the logic through integration
    // or create standalone tests for the algorithm

    const calculateIoU = (box1: ROI, box2: ROI): number => {
        const x1 = Math.max(box1.x, box2.x);
        const y1 = Math.max(box1.y, box2.y);
        const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
        const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

        const intersectionWidth = Math.max(0, x2 - x1);
        const intersectionHeight = Math.max(0, y2 - y1);
        const intersectionArea = intersectionWidth * intersectionHeight;

        const box1Area = box1.width * box1.height;
        const box2Area = box2.width * box2.height;
        const unionArea = box1Area + box2Area - intersectionArea;

        return unionArea > 0 ? intersectionArea / unionArea : 0;
    };

    it('should return 1.0 for identical boxes', () => {
        const box1: ROI = { x: 10, y: 10, width: 50, height: 50 };
        const box2: ROI = { x: 10, y: 10, width: 50, height: 50 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBe(1.0);
    });

    it('should return 0.0 for non-overlapping boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
        const box2: ROI = { x: 100, y: 100, width: 50, height: 50 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBe(0.0);
    });

    it('should calculate IoU for partially overlapping boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const box2: ROI = { x: 50, y: 50, width: 100, height: 100 };

        const iou = calculateIoU(box1, box2);

        // Intersection: 50x50 = 2500
        // Union: 10000 + 10000 - 2500 = 17500
        // IoU: 2500 / 17500 = 0.142857...
        expect(iou).toBeCloseTo(0.14286, 4);
    });

    it('should handle box2 completely inside box1', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const box2: ROI = { x: 25, y: 25, width: 50, height: 50 };

        const iou = calculateIoU(box1, box2);

        // Intersection: 50x50 = 2500
        // Union: 10000 + 2500 - 2500 = 10000
        // IoU: 2500 / 10000 = 0.25
        expect(iou).toBe(0.25);
    });

    it('should handle box1 completely inside box2', () => {
        const box1: ROI = { x: 25, y: 25, width: 50, height: 50 };
        const box2: ROI = { x: 0, y: 0, width: 100, height: 100 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBe(0.25);
    });

    it('should handle boxes touching at edges (no overlap)', () => {
        const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
        const box2: ROI = { x: 50, y: 0, width: 50, height: 50 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBe(0.0);
    });

    it('should handle boxes with 1-pixel overlap', () => {
        const box1: ROI = { x: 0, y: 0, width: 51, height: 51 };
        const box2: ROI = { x: 50, y: 50, width: 51, height: 51 };

        const iou = calculateIoU(box1, box2);

        // Intersection: 1x1 = 1
        // Union: 2601 + 2601 - 1 = 5201
        // IoU: 1 / 5201 ≈ 0.000192
        expect(iou).toBeGreaterThan(0);
        expect(iou).toBeLessThan(0.001);
    });

    it('should handle zero-area boxes', () => {
        const box1: ROI = { x: 10, y: 10, width: 0, height: 0 };
        const box2: ROI = { x: 10, y: 10, width: 50, height: 50 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBe(0.0);
    });

    it('should handle negative coordinates', () => {
        const box1: ROI = { x: -50, y: -50, width: 100, height: 100 };
        const box2: ROI = { x: 0, y: 0, width: 100, height: 100 };

        const iou = calculateIoU(box1, box2);

        // Intersection: 50x50 = 2500
        // Union: 10000 + 10000 - 2500 = 17500
        expect(iou).toBeCloseTo(0.14286, 4);
    });

    it('should handle very large boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 10000, height: 10000 };
        const box2: ROI = { x: 5000, y: 5000, width: 10000, height: 10000 };

        const iou = calculateIoU(box1, box2);
        expect(iou).toBeCloseTo(0.14286, 4);
    });
});

describe('Computer Vision - Image Similarity Calculation', () => {
    const calculateSimilarity = (imageData1: ImageData, imageData2: ImageData): number => {
        const pixels1 = imageData1.data;
        const pixels2 = imageData2.data;
        const step = 4;

        let sum1 = 0;
        let sum2 = 0;
        let sumProduct = 0;
        let sumSquare1 = 0;
        let sumSquare2 = 0;
        let count = 0;

        for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += step) {
            const gray1 = (pixels1[i] + pixels1[i + 1] + pixels1[i + 2]) / 3;
            const gray2 = (pixels2[i] + pixels2[i + 1] + pixels2[i + 2]) / 3;

            sum1 += gray1;
            sum2 += gray2;
            sumProduct += gray1 * gray2;
            sumSquare1 += gray1 * gray1;
            sumSquare2 += gray2 * gray2;
            count++;
        }

        const mean1 = sum1 / count;
        const mean2 = sum2 / count;

        const numerator = sumProduct / count - mean1 * mean2;
        const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

        if (denominator === 0) return 0;

        return (numerator / denominator + 1) / 2;
    };

    it('should return 1.0 for identical gradient images', () => {
        const img1 = createGradientImageData(50, 50);
        const img2 = createGradientImageData(50, 50);

        const similarity = calculateSimilarity(img1, img2);
        expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for uniform different images (zero variance)', () => {
        const img1 = createImageData(50, 50, 0); // Black (uniform)
        const img2 = createImageData(50, 50, 255); // White (uniform)

        const similarity = calculateSimilarity(img1, img2);
        // Uniform images have zero variance, returns 0
        expect(similarity).toBe(0);
    });

    it('should handle identical gradient images', () => {
        const img1 = createGradientImageData(50, 50);
        const img2 = createGradientImageData(50, 50);

        const similarity = calculateSimilarity(img1, img2);
        expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should handle different sized images with gradients', () => {
        const img1 = createGradientImageData(100, 100);
        const img2 = createGradientImageData(50, 50);

        const similarity = calculateSimilarity(img1, img2);
        // Gradient images have variance, should have good similarity
        expect(similarity).toBeGreaterThan(0.7);
        expect(similarity).toBeLessThan(1.0);
    });

    it('should handle 1x1 images', () => {
        const img1 = createImageData(1, 1, 100);
        const img2 = createImageData(1, 1, 100);

        const similarity = calculateSimilarity(img1, img2);
        expect(typeof similarity).toBe('number');
        expect(isNaN(similarity)).toBe(false);
    });

    it('should handle black images (zero denominator case)', () => {
        const img1 = createImageData(10, 10, 0);
        const img2 = createImageData(10, 10, 0);

        const similarity = calculateSimilarity(img1, img2);
        // When both images are uniform (zero variance), denominator is 0
        expect(similarity).toBe(0);
    });

    it('should return value between 0 and 1', () => {
        const img1 = createImageData(50, 50, 64);
        const img2 = createImageData(50, 50, 192);

        const similarity = calculateSimilarity(img1, img2);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle uniform images (zero variance case)', () => {
        // Both uniform images have zero variance, denominator is 0
        const img1 = createImageData(50, 50, 100);
        const img2 = createImageData(50, 50, 150);

        const similarity = calculateSimilarity(img1, img2);
        // Uniform images return 0 (zero variance, undefined correlation)
        expect(similarity).toBe(0);
    });

    it('should be commutative (similarity(A, B) = similarity(B, A))', () => {
        const img1 = createGradientImageData(50, 50);
        const img2 = createGradientImageData(40, 40);

        const sim1 = calculateSimilarity(img1, img2);
        const sim2 = calculateSimilarity(img2, img1);

        expect(sim1).toBeCloseTo(sim2, 5);
    });

    it('should handle images with variance', () => {
        const img1 = createGradientImageData(50, 50);
        const img2 = createGradientImageData(50, 50);

        const similarity = calculateSimilarity(img1, img2);
        // Identical gradients should have high similarity
        expect(similarity).toBeCloseTo(1.0, 5);
    });
});

describe('Computer Vision - ROI Operations', () => {
    it('should create ROI with required properties', () => {
        const roi: ROI = {
            x: 10,
            y: 20,
            width: 50,
            height: 60,
        };

        expect(roi.x).toBe(10);
        expect(roi.y).toBe(20);
        expect(roi.width).toBe(50);
        expect(roi.height).toBe(60);
    });

    it('should create ROI with optional label', () => {
        const roi: ROI = {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            label: 'test_region',
        };

        expect(roi.label).toBe('test_region');
    });

    it('should handle ROI with zero dimensions', () => {
        const roi: ROI = {
            x: 10,
            y: 10,
            width: 0,
            height: 0,
        };

        expect(roi.width).toBe(0);
        expect(roi.height).toBe(0);
    });

    it('should handle ROI with negative coordinates', () => {
        const roi: ROI = {
            x: -50,
            y: -100,
            width: 200,
            height: 300,
        };

        expect(roi.x).toBe(-50);
        expect(roi.y).toBe(-100);
    });

    it('should calculate ROI area correctly', () => {
        const roi: ROI = {
            x: 0,
            y: 0,
            width: 50,
            height: 40,
        };

        const area = roi.width * roi.height;
        expect(area).toBe(2000);
    });

    it('should calculate ROI center point', () => {
        const roi: ROI = {
            x: 100,
            y: 200,
            width: 50,
            height: 60,
        };

        const centerX = roi.x + roi.width / 2;
        const centerY = roi.y + roi.height / 2;

        expect(centerX).toBe(125);
        expect(centerY).toBe(230);
    });

    it('should handle very large ROI dimensions', () => {
        const roi: ROI = {
            x: 0,
            y: 0,
            width: 100000,
            height: 100000,
        };

        const area = roi.width * roi.height;
        expect(area).toBe(10000000000);
    });
});

describe('Computer Vision - Inventory Region Detection', () => {
    const detectInventoryRegion = (width: number, height: number): ROI => {
        const inventoryHeight = Math.floor(height * 0.15);
        const inventoryY = height - inventoryHeight;

        return {
            x: 0,
            y: inventoryY,
            width: width,
            height: inventoryHeight,
            label: 'inventory',
        };
    };

    it('should detect inventory region for 1080p', () => {
        const roi = detectInventoryRegion(1920, 1080);

        expect(roi.x).toBe(0);
        expect(roi.width).toBe(1920);
        expect(roi.height).toBe(Math.floor(1080 * 0.15));
        expect(roi.y).toBe(1080 - roi.height);
        expect(roi.label).toBe('inventory');
    });

    it('should detect inventory region for 720p', () => {
        const roi = detectInventoryRegion(1280, 720);

        expect(roi.x).toBe(0);
        expect(roi.width).toBe(1280);
        expect(roi.height).toBe(Math.floor(720 * 0.15));
        expect(roi.y).toBeGreaterThan(600);
    });

    it('should detect inventory region for 4K', () => {
        const roi = detectInventoryRegion(3840, 2160);

        expect(roi.width).toBe(3840);
        expect(roi.height).toBe(Math.floor(2160 * 0.15));
    });

    it('should place inventory in bottom 15% of screen', () => {
        const width = 1920;
        const height = 1080;
        const roi = detectInventoryRegion(width, height);

        const bottomPercentage = (height - roi.y) / height;
        expect(bottomPercentage).toBeCloseTo(0.15, 2);
    });

    it('should handle small screen resolutions', () => {
        const roi = detectInventoryRegion(800, 600);

        expect(roi.width).toBe(800);
        expect(roi.height).toBe(Math.floor(600 * 0.15));
    });

    it('should handle very large screen resolutions (8K)', () => {
        const roi = detectInventoryRegion(7680, 4320);

        expect(roi.width).toBe(7680);
        expect(roi.height).toBe(Math.floor(4320 * 0.15));
    });

    it('should span full width of screen', () => {
        const roi = detectInventoryRegion(2560, 1440);

        expect(roi.x).toBe(0);
        expect(roi.width).toBe(2560);
    });
});

describe('Computer Vision - Color Variance Calculation', () => {
    const calculateColorVariance = (imageData: ImageData): number => {
        const pixels = imageData.data;
        let sumR = 0,
            sumG = 0,
            sumB = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            sumR += pixels[i];
            sumG += pixels[i + 1];
            sumB += pixels[i + 2];
            count++;
        }

        const meanR = sumR / count;
        const meanG = sumG / count;
        const meanB = sumB / count;

        let varianceR = 0,
            varianceG = 0,
            varianceB = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            varianceR += Math.pow(pixels[i] - meanR, 2);
            varianceG += Math.pow(pixels[i + 1] - meanG, 2);
            varianceB += Math.pow(pixels[i + 2] - meanB, 2);
        }

        return (varianceR + varianceG + varianceB) / (count * 3);
    };

    it('should return zero variance for uniform color', () => {
        const img = createImageData(50, 50, 128);
        const variance = calculateColorVariance(img);

        expect(variance).toBe(0);
    });

    it('should return non-zero variance for gradient', () => {
        const img = createGradientImageData(50, 50);
        const variance = calculateColorVariance(img);

        expect(variance).toBeGreaterThan(0);
    });

    it('should return higher variance for black and white image', () => {
        const img = createImageData(50, 50, 0);
        // Create checkerboard pattern
        const pixels = img.data;
        for (let i = 0; i < pixels.length; i += 8) {
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
        }

        const variance = calculateColorVariance(img);
        expect(variance).toBeGreaterThan(1000);
    });

    it('should handle 1x1 image', () => {
        const img = createImageData(1, 1, 128);
        const variance = calculateColorVariance(img);

        expect(variance).toBe(0);
    });

    it('should handle all black image', () => {
        const img = createImageData(50, 50, 0);
        const variance = calculateColorVariance(img);

        expect(variance).toBe(0);
    });

    it('should handle all white image', () => {
        const img = createImageData(50, 50, 255);
        const variance = calculateColorVariance(img);

        expect(variance).toBe(0);
    });
});
