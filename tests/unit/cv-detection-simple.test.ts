/**
 * @vitest-environment jsdom
 * CV Detection Module - Simple Coverage Tests
 */
import { describe, it, expect, vi } from 'vitest';

// Mock test-utils BEFORE importing detection module
vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn().mockReturnValue({ category: '1080p', scale: 1.5 }),
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    calculateIoU,
    nonMaxSuppression,
    getAdaptiveIconSizes,
    extractCountRegion,
    detectGridPositions,
    fitsGrid,
    verifyGridPattern,
    setWorkerBasePath,
    calculateSimilarity,
    resizeImageData,
    getCVMetrics,
    getDetectionConfig,
} from '../../src/modules/cv/detection.ts';

import type { CVDetectionResult, ROI } from '../../src/types';

// Helper to create detection
const createDetection = (id: string, confidence: number, position?: Partial<ROI>): CVDetectionResult => ({
    type: 'item',
    entity: { id, name: id, rarity: 'common', tier: 'B', base_effect: '', unlocked_by_default: true },
    confidence,
    method: 'template_match',
    position: position ? { x: position.x ?? 0, y: position.y ?? 0, width: position.width ?? 64, height: position.height ?? 64 } : undefined,
});

describe('calculateIoU', () => {
    it('returns 1 for identical boxes', () => {
        const box: ROI = { x: 100, y: 100, width: 50, height: 50 };
        expect(calculateIoU(box, box)).toBe(1);
    });

    it('returns 0 for non-overlapping boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
        const box2: ROI = { x: 100, y: 100, width: 50, height: 50 };
        expect(calculateIoU(box1, box2)).toBe(0);
    });

    it('calculates correct IoU for partial overlap', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const box2: ROI = { x: 50, y: 50, width: 100, height: 100 };
        const iou = calculateIoU(box1, box2);
        expect(iou).toBeCloseTo(0.143, 2);
    });

    it('handles zero-area boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 0, height: 0 };
        const box2: ROI = { x: 0, y: 0, width: 50, height: 50 };
        expect(calculateIoU(box1, box2)).toBe(0);
    });
});

describe('nonMaxSuppression', () => {
    it('returns empty array for empty input', () => {
        expect(nonMaxSuppression([])).toEqual([]);
    });

    it('keeps non-overlapping detections', () => {
        const detections = [
            createDetection('sword', 0.9, { x: 0, y: 0 }),
            createDetection('shield', 0.85, { x: 200, y: 200 }),
        ];
        const result = nonMaxSuppression(detections);
        expect(result).toHaveLength(2);
    });

    it('removes lower confidence overlapping detection', () => {
        const detections = [
            createDetection('sword', 0.9, { x: 100, y: 100, width: 64, height: 64 }),
            createDetection('wrench', 0.8, { x: 110, y: 110, width: 64, height: 64 }),
        ];
        const result = nonMaxSuppression(detections, 0.3);
        expect(result).toHaveLength(1);
        expect(result[0].entity.id).toBe('sword');
    });
});

describe('getAdaptiveIconSizes', () => {
    // Note: With mocked detectResolution always returning '1080p',
    // these tests verify behavior with that mock
    
    it('returns 3 sizes', () => {
        const sizes = getAdaptiveIconSizes(1280, 720);
        expect(sizes).toHaveLength(3);
    });

    it('returns positive sizes', () => {
        const sizes = getAdaptiveIconSizes(1920, 1080);
        expect(sizes.every(s => s > 0)).toBe(true);
    });

    it('returns sizes in ascending order', () => {
        const sizes = getAdaptiveIconSizes(2560, 1440);
        expect(sizes[0]).toBeLessThan(sizes[1]);
        expect(sizes[1]).toBeLessThan(sizes[2]);
    });

    it('returns reasonable icon sizes (30-80px range)', () => {
        const sizes = getAdaptiveIconSizes(3840, 2160);
        expect(sizes.every(s => s >= 30 && s <= 80)).toBe(true);
    });
});

describe('extractCountRegion', () => {
    it('extracts bottom-right corner of cell', () => {
        const cell: ROI = { x: 100, y: 200, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        expect(countRegion.x).toBeGreaterThan(cell.x);
        expect(countRegion.y).toBeGreaterThan(cell.y);
    });

    it('limits count region size to 25px max', () => {
        const largeCell: ROI = { x: 0, y: 0, width: 200, height: 200 };
        const countRegion = extractCountRegion(largeCell);
        expect(countRegion.width).toBeLessThanOrEqual(25);
    });
});

describe('detectGridPositions', () => {
    it('generates grid positions for 1080p', () => {
        const positions = detectGridPositions(1920, 1080);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });
});

describe('fitsGrid', () => {
    it('returns true when value is on grid', () => {
        expect(fitsGrid(100, 0, 50, 5)).toBe(true);
    });

    it('returns true when within tolerance', () => {
        expect(fitsGrid(53, 0, 50, 5)).toBe(true);
    });

    it('returns false when outside tolerance', () => {
        expect(fitsGrid(56, 0, 50, 5)).toBe(false);
    });

    it('returns true for zero spacing', () => {
        expect(fitsGrid(100, 0, 0, 5)).toBe(true);
    });

    it('handles grid with offset start', () => {
        expect(fitsGrid(30, 10, 20, 3)).toBe(true);
        expect(fitsGrid(50, 10, 20, 3)).toBe(true);
    });

    it('handles negative spacing', () => {
        expect(fitsGrid(100, 0, -10, 5)).toBe(true);
    });
});

describe('verifyGridPattern', () => {
    it('trusts small sets (less than 3 detections)', () => {
        const detections = [
            createDetection('sword', 0.9, { x: 100, y: 600 }),
            createDetection('shield', 0.85, { x: 150, y: 600 }),
        ];
        const result = verifyGridPattern(detections, 50);
        expect(result.isValid).toBe(true);
        expect(result.confidence).toBe(0.5);
    });

    it('verifies consistent grid spacing', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 148, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 196, y: 600, width: 48, height: 48 }),
            createDetection('item4', 0.82, { x: 244, y: 600, width: 48, height: 48 }),
        ];
        const result = verifyGridPattern(detections, 48);
        expect(result.isValid).toBe(true);
    });

    it('handles empty detections', () => {
        const result = verifyGridPattern([], 48);
        expect(result.isValid).toBe(true);
    });

    it('handles single detection', () => {
        const detections = [createDetection('item1', 0.9, { x: 100, y: 600 })];
        const result = verifyGridPattern(detections, 48);
        expect(result.isValid).toBe(true);
    });
});

describe('setWorkerBasePath', () => {
    it('accepts valid path', () => {
        expect(() => setWorkerBasePath('/megabonk')).not.toThrow();
    });

    it('accepts empty path', () => {
        expect(() => setWorkerBasePath('')).not.toThrow();
    });

    it('handles path with trailing slash', () => {
        expect(() => setWorkerBasePath('/path/')).not.toThrow();
    });
});

describe('calculateSimilarity', () => {
    // Helper to create mock ImageData
    const createMockImageData = (width: number, height: number, fillValue: number = 128): ImageData => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillValue;
            data[i + 1] = fillValue;
            data[i + 2] = fillValue;
            data[i + 3] = 255;
        }
        return { width, height, data, colorSpace: 'srgb' } as ImageData;
    };

    it('returns non-negative similarity', () => {
        const img = createMockImageData(32, 32, 128);
        const similarity = calculateSimilarity(img, img);
        expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('returns value between 0 and 1', () => {
        const img1 = createMockImageData(32, 32, 50);
        const img2 = createMockImageData(32, 32, 200);
        const similarity = calculateSimilarity(img1, img2);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('handles small images', () => {
        const img = createMockImageData(8, 8, 100);
        const similarity = calculateSimilarity(img, img);
        expect(similarity).toBeGreaterThanOrEqual(0);
    });
});

describe('resizeImageData', () => {
    it('resizes ImageData to target dimensions', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        const imageData = ctx.getImageData(0, 0, 100, 100);

        const resized = resizeImageData(imageData, 50, 50);
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(50);
        expect(resized!.height).toBe(50);
    });

    it('handles upscaling', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, 32, 32);

        const resized = resizeImageData(imageData, 64, 64);
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(64);
    });

    it('handles 1x1 target', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, 64, 64);

        const resized = resizeImageData(imageData, 1, 1);
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(1);
    });
});

describe('getCVMetrics', () => {
    it('returns metrics object', () => {
        const metrics = getCVMetrics();
        expect(metrics).toHaveProperty('runs');
        expect(metrics).toHaveProperty('aggregated');
    });

    it('has runs as array', () => {
        const metrics = getCVMetrics();
        expect(Array.isArray(metrics.runs)).toBe(true);
    });
});

describe('getDetectionConfig', () => {
    it('returns config object', () => {
        const config = getDetectionConfig();
        expect(config).toHaveProperty('dynamicThreshold');
    });

    it('has numeric threshold', () => {
        const config = getDetectionConfig();
        expect(typeof config.dynamicThreshold).toBe('number');
    });
});
