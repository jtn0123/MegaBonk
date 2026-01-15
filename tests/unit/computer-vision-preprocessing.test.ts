/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules
vi.mock('../../src/modules/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/modules/test-utils', () => ({
    isTestEnvironment: () => true,
}));

// Type definitions
type PredefinedColorSpace = 'srgb' | 'display-p3';

interface ROI {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
}

interface CVDetectionResult {
    itemName: string;
    confidence: number;
    position?: ROI;
    count?: number;
    method?: string;
}

// Add ImageData polyfill for jsdom
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
                    // constructor(width, height)
                    this.width = data;
                    this.height = width;
                    this.data = new Uint8ClampedArray(this.width * this.height * 4);
                }
                this.colorSpace = 'srgb';
            }
        };
    }
});

// Helper function to create ImageData with specific color
function createColorImageData(width: number, height: number, r: number, g: number, b: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255; // Alpha
    }

    return new ImageData(data, width, height);
}

// Helper to create gradient image
function createGradientImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const value = Math.floor((x / width) * 255);
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }
    }

    return new ImageData(data, width, height);
}

// Helper to create noisy image
function createNoisyImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 100 + 100; // Random value between 100-200
        data[i] = noise;
        data[i + 1] = noise;
        data[i + 2] = noise;
        data[i + 3] = 255;
    }

    return new ImageData(data, width, height);
}

// ============================================================================
// REIMPLEMENTATION OF FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Extract count number region from cell (bottom-right corner)
 */
function extractCountRegion(cell: ROI): ROI {
    const countSize = Math.min(25, Math.floor(cell.width * 0.25));

    return {
        x: cell.x + cell.width - countSize,
        y: cell.y + cell.height - countSize,
        width: countSize,
        height: countSize,
        label: `${cell.label}_count`,
    };
}

/**
 * Pre-process image for better recognition
 */
function preprocessImage(imageData: ImageData): ImageData {
    const processed = new ImageData(imageData.width, imageData.height);
    const pixels = imageData.data;
    const output = processed.data;

    for (let i = 0; i < pixels.length; i += 4) {
        // Convert to grayscale with enhanced contrast
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

        // Apply threshold to reduce noise
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;

        output[i] = value;
        output[i + 1] = value;
        output[i + 2] = value;
        output[i + 3] = pixels[i + 3]; // Keep alpha
    }

    return processed;
}

/**
 * Check if a cell is likely empty (mostly uniform background)
 */
function isEmptyCell(imageData: ImageData): boolean {
    const pixels = imageData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumSquareR = 0;
    let sumSquareG = 0;
    let sumSquareB = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        sumR += r;
        sumG += g;
        sumB += b;
        sumSquareR += r * r;
        sumSquareG += g * g;
        sumSquareB += b * b;
        count++;
    }

    // Calculate variance for each channel
    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    const varianceR = sumSquareR / count - meanR * meanR;
    const varianceG = sumSquareG / count - meanG * meanG;
    const varianceB = sumSquareB / count - meanB * meanB;

    const totalVariance = varianceR + varianceG + varianceB;

    // Low variance = uniform color = likely empty
    const EMPTY_THRESHOLD = 500;

    return totalVariance < EMPTY_THRESHOLD;
}

/**
 * Calculate IoU (Intersection over Union) for two bounding boxes
 */
function calculateIoU(box1: ROI, box2: ROI): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return union > 0 ? intersection / union : 0;
}

/**
 * Non-maximum suppression to remove overlapping detections
 */
function nonMaxSuppression(detections: CVDetectionResult[], iouThreshold: number = 0.3): CVDetectionResult[] {
    if (detections.length === 0) return [];

    // Sort by confidence (highest first)
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: CVDetectionResult[] = [];

    for (const detection of sorted) {
        if (!detection.position) {
            kept.push(detection);
            continue;
        }

        // Check if this detection overlaps with any already kept
        let shouldKeep = true;
        for (const keptDetection of kept) {
            if (!keptDetection.position) continue;

            const iou = calculateIoU(detection.position, keptDetection.position);
            if (iou > iouThreshold) {
                shouldKeep = false;
                break;
            }
        }

        if (shouldKeep) {
            kept.push(detection);
        }
    }

    return kept;
}

/**
 * Get adaptive icon sizes based on resolution
 */
function getAdaptiveIconSizes(width: number, height: number): number[] {
    // Detect resolution category (matching test-utils.ts logic)
    let category: string;

    // Steam Deck: 1280x800
    if (width === 1280 && height === 800) {
        category = 'steam_deck';
    }
    // 720p: 1280x720 (with tolerance of ±50)
    else if (Math.abs(width - 1280) < 50 && Math.abs(height - 720) < 50) {
        category = '720p';
    }
    // 1080p: 1920x1080 (with tolerance of ±50)
    else if (Math.abs(width - 1920) < 50 && Math.abs(height - 1080) < 50) {
        category = '1080p';
    }
    // 1440p: 2560x1440 (with tolerance of ±50)
    else if (Math.abs(width - 2560) < 50 && Math.abs(height - 1440) < 50) {
        category = '1440p';
    }
    // 4K: 3840x2160 (with tolerance of ±50)
    else if (Math.abs(width - 3840) < 50 && Math.abs(height - 2160) < 50) {
        category = '4K';
    }
    // Custom/unknown resolution
    else {
        category = 'custom';
    }

    const baseSizes: Record<string, number[]> = {
        '720p': [32, 38, 44],
        '1080p': [40, 48, 56],
        '1440p': [48, 55, 64],
        '4K': [64, 72, 80],
        steam_deck: [36, 42, 48],
    };

    return baseSizes[category] || [40, 50, 60];
}

/**
 * Calculate adaptive threshold from similarity scores
 */
function calculateAdaptiveThreshold(similarities: number[]): number {
    if (similarities.length === 0) return 0.75; // Fallback

    // Sort similarities descending
    const sorted = [...similarities].sort((a, b) => b - a);

    // Find largest gap in similarities
    let maxGap = 0;
    let gapIndex = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i] - sorted[i + 1];
        if (gap > maxGap) {
            maxGap = gap;
            gapIndex = i;
        }
    }

    // Threshold is just below the gap (or use default if gap too small)
    if (maxGap > 0.05) {
        const threshold = sorted[gapIndex + 1] + 0.02; // Slightly above low side
        // Clamp between 0.60 and 0.90
        return Math.max(0.6, Math.min(0.9, threshold));
    }

    // Fallback: use 75th percentile
    const percentile75Index = Math.floor(sorted.length * 0.25);
    const threshold = sorted[percentile75Index];
    return Math.max(0.65, Math.min(0.85, threshold));
}

// ============================================================================
// TESTS
// ============================================================================

describe('Computer Vision - Extract Count Region', () => {
    it('should extract count region from bottom-right corner', () => {
        const cell: ROI = { x: 100, y: 100, width: 64, height: 64, label: 'cell_1' };
        const countRegion = extractCountRegion(cell);

        expect(countRegion.x).toBe(100 + 64 - 16); // width * 0.25 = 16
        expect(countRegion.y).toBe(100 + 64 - 16);
        expect(countRegion.width).toBe(16);
        expect(countRegion.height).toBe(16);
        expect(countRegion.label).toBe('cell_1_count');
    });

    it('should limit count size to 25 pixels max', () => {
        const largeCell: ROI = { x: 0, y: 0, width: 200, height: 200, label: 'large' };
        const countRegion = extractCountRegion(largeCell);

        // 200 * 0.25 = 50, but capped at 25
        expect(countRegion.width).toBe(25);
        expect(countRegion.height).toBe(25);
    });

    it('should handle small cells', () => {
        const smallCell: ROI = { x: 10, y: 10, width: 32, height: 32, label: 'small' };
        const countRegion = extractCountRegion(smallCell);

        // 32 * 0.25 = 8
        expect(countRegion.width).toBe(8);
        expect(countRegion.height).toBe(8);
        expect(countRegion.x).toBe(10 + 32 - 8);
        expect(countRegion.y).toBe(10 + 32 - 8);
    });

    it('should preserve label with _count suffix', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64, label: 'inventory_slot_5' };
        const countRegion = extractCountRegion(cell);

        expect(countRegion.label).toBe('inventory_slot_5_count');
    });

    it('should handle cells without label', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);

        expect(countRegion.label).toBe('undefined_count');
    });
});

describe('Computer Vision - Preprocess Image', () => {
    it('should convert image to binary (black and white)', () => {
        const img = createColorImageData(10, 10, 200, 200, 200);
        const processed = preprocessImage(img);

        // All pixels should be 255 (white) since 200 > 128
        for (let i = 0; i < processed.data.length; i += 4) {
            expect(processed.data[i]).toBe(255);
            expect(processed.data[i + 1]).toBe(255);
            expect(processed.data[i + 2]).toBe(255);
            expect(processed.data[i + 3]).toBe(255); // Alpha preserved
        }
    });

    it('should threshold dark pixels to black', () => {
        const img = createColorImageData(10, 10, 50, 50, 50);
        const processed = preprocessImage(img);

        // All pixels should be 0 (black) since 50 < 128
        for (let i = 0; i < processed.data.length; i += 4) {
            expect(processed.data[i]).toBe(0);
            expect(processed.data[i + 1]).toBe(0);
            expect(processed.data[i + 2]).toBe(0);
        }
    });

    it('should apply threshold at 128', () => {
        const data = new Uint8ClampedArray(4 * 4);
        // Set exactly 128 gray
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 128;
            data[i + 1] = 128;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }

        const img = new ImageData(data, 2, 2);
        const processed = preprocessImage(img);

        // 128 is NOT > 128, so should be 0
        expect(processed.data[0]).toBe(0);
    });

    it('should preserve alpha channel', () => {
        const data = new Uint8ClampedArray(4);
        data[0] = 200;
        data[1] = 200;
        data[2] = 200;
        data[3] = 128; // Semi-transparent

        const img = new ImageData(data, 1, 1);
        const processed = preprocessImage(img);

        expect(processed.data[3]).toBe(128);
    });

    it('should handle gradient images correctly', () => {
        const img = createGradientImageData(10, 10);
        const processed = preprocessImage(img);

        // Gradient goes 0-255, so roughly half should be black, half white
        let blackCount = 0;
        let whiteCount = 0;

        for (let i = 0; i < processed.data.length; i += 4) {
            if (processed.data[i] === 0) blackCount++;
            if (processed.data[i] === 255) whiteCount++;
        }

        // Should have both black and white pixels
        expect(blackCount).toBeGreaterThan(0);
        expect(whiteCount).toBeGreaterThan(0);
        expect(blackCount + whiteCount).toBe(100); // Total pixels
    });
});

describe('Computer Vision - Is Empty Cell', () => {
    it('should detect uniform color as empty', () => {
        const img = createColorImageData(50, 50, 128, 128, 128);
        const isEmpty = isEmptyCell(img);

        expect(isEmpty).toBe(true);
    });

    it('should detect high-variance image as not empty', () => {
        const img = createNoisyImageData(50, 50);
        const isEmpty = isEmptyCell(img);

        expect(isEmpty).toBe(false);
    });

    it('should detect gradient as not empty', () => {
        const img = createGradientImageData(50, 50);
        const isEmpty = isEmptyCell(img);

        expect(isEmpty).toBe(false);
    });

    it('should handle small uniform images', () => {
        const img = createColorImageData(5, 5, 0, 0, 0);
        const isEmpty = isEmptyCell(img);

        expect(isEmpty).toBe(true);
    });

    it('should handle nearly uniform images', () => {
        const data = new Uint8ClampedArray(50 * 50 * 4);
        // Fill with 128, add small amount of variation
        for (let i = 0; i < data.length; i += 4) {
            const variation = Math.random() * 10 - 5; // +/- 5
            data[i] = 128 + variation;
            data[i + 1] = 128 + variation;
            data[i + 2] = 128 + variation;
            data[i + 3] = 255;
        }

        const img = new ImageData(data, 50, 50);
        const isEmpty = isEmptyCell(img);

        // Small variation should still be considered empty
        expect(isEmpty).toBe(true);
    });

    it('should detect distinct features as not empty', () => {
        const data = new Uint8ClampedArray(50 * 50 * 4);
        // Half black, half white
        for (let i = 0; i < data.length / 2; i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        }
        for (let i = data.length / 2; i < data.length; i += 4) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }

        const img = new ImageData(data, 50, 50);
        const isEmpty = isEmptyCell(img);

        expect(isEmpty).toBe(false);
    });
});

describe('Computer Vision - Non-Maximum Suppression', () => {
    it('should keep non-overlapping detections', () => {
        const detections: CVDetectionResult[] = [
            {
                itemName: 'Item A',
                confidence: 0.9,
                position: { x: 0, y: 0, width: 50, height: 50 },
            },
            {
                itemName: 'Item B',
                confidence: 0.8,
                position: { x: 100, y: 100, width: 50, height: 50 },
            },
        ];

        const result = nonMaxSuppression(detections, 0.3);

        expect(result).toHaveLength(2);
        expect(result[0].itemName).toBe('Item A');
        expect(result[1].itemName).toBe('Item B');
    });

    it('should suppress overlapping detections with lower confidence', () => {
        const detections: CVDetectionResult[] = [
            {
                itemName: 'Item A',
                confidence: 0.9,
                position: { x: 0, y: 0, width: 50, height: 50 },
            },
            {
                itemName: 'Item B',
                confidence: 0.7,
                position: { x: 10, y: 10, width: 50, height: 50 }, // Overlaps with A
            },
        ];

        const result = nonMaxSuppression(detections, 0.3);

        expect(result).toHaveLength(1);
        expect(result[0].itemName).toBe('Item A');
        expect(result[0].confidence).toBe(0.9);
    });

    it('should keep detections with IoU below threshold', () => {
        const detections: CVDetectionResult[] = [
            {
                itemName: 'Item A',
                confidence: 0.9,
                position: { x: 0, y: 0, width: 50, height: 50 },
            },
            {
                itemName: 'Item B',
                confidence: 0.8,
                position: { x: 40, y: 40, width: 50, height: 50 }, // Small overlap
            },
        ];

        const result = nonMaxSuppression(detections, 0.5); // High threshold

        // IoU for these boxes is small, should keep both
        expect(result).toHaveLength(2);
    });

    it('should handle detections without positions', () => {
        const detections: CVDetectionResult[] = [
            { itemName: 'Item A', confidence: 0.9 },
            { itemName: 'Item B', confidence: 0.8 },
        ];

        const result = nonMaxSuppression(detections, 0.3);

        expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
        const result = nonMaxSuppression([], 0.3);

        expect(result).toHaveLength(0);
    });

    it('should sort by confidence before suppression', () => {
        const detections: CVDetectionResult[] = [
            {
                itemName: 'Item A',
                confidence: 0.7,
                position: { x: 0, y: 0, width: 50, height: 50 },
            },
            {
                itemName: 'Item B',
                confidence: 0.9,
                position: { x: 10, y: 10, width: 50, height: 50 }, // Overlaps, higher confidence
            },
        ];

        const result = nonMaxSuppression(detections, 0.3);

        // Should keep Item B (higher confidence)
        expect(result).toHaveLength(1);
        expect(result[0].itemName).toBe('Item B');
    });

    it('should handle multiple overlapping detections', () => {
        const detections: CVDetectionResult[] = [
            {
                itemName: 'Item A',
                confidence: 0.9,
                position: { x: 0, y: 0, width: 50, height: 50 },
            },
            {
                itemName: 'Item B',
                confidence: 0.85,
                position: { x: 5, y: 5, width: 50, height: 50 },
            },
            {
                itemName: 'Item C',
                confidence: 0.8,
                position: { x: 10, y: 10, width: 50, height: 50 },
            },
        ];

        const result = nonMaxSuppression(detections, 0.3);

        // Should keep only the highest confidence
        expect(result).toHaveLength(1);
        expect(result[0].itemName).toBe('Item A');
    });
});

describe('Computer Vision - Adaptive Icon Sizes', () => {
    it('should return 720p sizes for 1280x720', () => {
        const sizes = getAdaptiveIconSizes(1280, 720);

        expect(sizes).toEqual([32, 38, 44]);
    });

    it('should return 1080p sizes for 1920x1080', () => {
        const sizes = getAdaptiveIconSizes(1920, 1080);

        expect(sizes).toEqual([40, 48, 56]);
    });

    it('should return 1440p sizes for 2560x1440', () => {
        const sizes = getAdaptiveIconSizes(2560, 1440);

        expect(sizes).toEqual([48, 55, 64]);
    });

    it('should return 4K sizes for 3840x2160', () => {
        const sizes = getAdaptiveIconSizes(3840, 2160);

        expect(sizes).toEqual([64, 72, 80]);
    });

    it('should return Steam Deck sizes for 1280x800', () => {
        const sizes = getAdaptiveIconSizes(1280, 800);

        expect(sizes).toEqual([36, 42, 48]);
    });

    it('should return default sizes for unknown resolution', () => {
        const sizes = getAdaptiveIconSizes(1600, 900);

        expect(sizes).toEqual([40, 50, 60]);
    });
});

describe('Computer Vision - Adaptive Threshold', () => {
    it('should return default 0.75 for empty array', () => {
        const threshold = calculateAdaptiveThreshold([]);

        expect(threshold).toBe(0.75);
    });

    it('should lower threshold for large gap (>0.05)', () => {
        const similarities = [0.9, 0.7, 0.6]; // Max gap = 0.2 between 0.9 and 0.7
        const threshold = calculateAdaptiveThreshold(similarities);

        // Threshold should be slightly above the lower value (0.7 + 0.02 = 0.72)
        expect(threshold).toBeCloseTo(0.72, 2);
    });

    it('should use percentile threshold for small gaps', () => {
        const similarities = [0.82, 0.80, 0.78]; // Max gap = 0.02 (< 0.05)
        const threshold = calculateAdaptiveThreshold(similarities);

        // Should use 75th percentile (index 0) = 0.82, clamped to [0.65, 0.85]
        expect(threshold).toBeCloseTo(0.82, 2);
    });

    it('should handle single similarity with percentile fallback', () => {
        const threshold = calculateAdaptiveThreshold([0.85]);

        // No gap possible (length 1), uses 75th percentile: index 0 = 0.85, clamped to 0.85
        expect(threshold).toBe(0.85);
    });

    it('should clamp threshold between 0.6 and 0.9 for gap method', () => {
        const similarities = [0.95, 0.5, 0.4]; // Gap = 0.45, threshold would be 0.5 + 0.02 = 0.52
        const threshold = calculateAdaptiveThreshold(similarities);

        // Should be clamped to minimum 0.6
        expect(threshold).toBe(0.6);
    });

    it('should clamp threshold between 0.65 and 0.85 for percentile method', () => {
        const similarities = [0.95, 0.93, 0.91]; // Small gaps, uses percentile
        const threshold = calculateAdaptiveThreshold(similarities);

        // 75th percentile = 0.95, should be clamped to 0.85
        expect(threshold).toBe(0.85);
    });

    it('should handle medium gap correctly', () => {
        const similarities = [0.85, 0.77, 0.7]; // Max gap = 0.08 between 0.85 and 0.77
        const threshold = calculateAdaptiveThreshold(similarities);

        // Gap > 0.05, so uses gap method: 0.77 + 0.02 = 0.79
        expect(threshold).toBeCloseTo(0.79, 2);
    });
});
