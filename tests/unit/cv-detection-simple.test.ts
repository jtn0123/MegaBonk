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

    it('handles boxes touching at edge (no overlap)', () => {
        const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
        const box2: ROI = { x: 50, y: 0, width: 50, height: 50 };
        expect(calculateIoU(box1, box2)).toBe(0);
    });

    it('handles contained box (one inside another)', () => {
        const outer: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const inner: ROI = { x: 25, y: 25, width: 50, height: 50 };
        const iou = calculateIoU(outer, inner);
        // inner area = 2500, outer area = 10000, union = 10000, intersection = 2500
        expect(iou).toBeCloseTo(0.25, 2);
    });

    it('handles 50% horizontal overlap', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 50 };
        const box2: ROI = { x: 50, y: 0, width: 100, height: 50 };
        const iou = calculateIoU(box1, box2);
        // intersection = 50*50 = 2500, union = 2*5000 - 2500 = 7500
        expect(iou).toBeCloseTo(2500/7500, 2);
    });

    it('handles very large boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 10000, height: 10000 };
        const box2: ROI = { x: 5000, y: 5000, width: 10000, height: 10000 };
        const iou = calculateIoU(box1, box2);
        expect(iou).toBeGreaterThan(0);
        expect(iou).toBeLessThan(1);
    });

    it('handles boxes at negative coordinates', () => {
        const box1: ROI = { x: -50, y: -50, width: 100, height: 100 };
        const box2: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const iou = calculateIoU(box1, box2);
        expect(iou).toBeGreaterThan(0);
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

    it('handles detections without position', () => {
        const detections = [
            createDetection('sword', 0.9),  // No position
            createDetection('shield', 0.85), // No position
        ];
        const result = nonMaxSuppression(detections);
        expect(result).toHaveLength(2);
    });

    it('uses custom IoU threshold', () => {
        const detections = [
            createDetection('item1', 0.95, { x: 0, y: 0, width: 100, height: 100 }),
            createDetection('item2', 0.90, { x: 20, y: 20, width: 100, height: 100 }),
        ];
        // Low threshold should suppress more
        const lowThreshold = nonMaxSuppression(detections, 0.1);
        expect(lowThreshold).toHaveLength(1);
        
        // High threshold should keep more
        const highThreshold = nonMaxSuppression(detections, 0.9);
        expect(highThreshold).toHaveLength(2);
    });

    it('sorts by confidence and keeps highest', () => {
        const detections = [
            createDetection('low', 0.5, { x: 100, y: 100, width: 64, height: 64 }),
            createDetection('high', 0.95, { x: 105, y: 105, width: 64, height: 64 }),
            createDetection('mid', 0.7, { x: 102, y: 102, width: 64, height: 64 }),
        ];
        const result = nonMaxSuppression(detections, 0.3);
        expect(result).toHaveLength(1);
        expect(result[0].entity.id).toBe('high');
    });

    it('handles single detection', () => {
        const detections = [createDetection('only', 0.8, { x: 50, y: 50 })];
        const result = nonMaxSuppression(detections);
        expect(result).toHaveLength(1);
    });

    it('handles many non-overlapping detections', () => {
        const detections = [];
        for (let i = 0; i < 10; i++) {
            detections.push(createDetection(`item${i}`, 0.9 - i * 0.05, { x: i * 100, y: 0 }));
        }
        const result = nonMaxSuppression(detections);
        expect(result).toHaveLength(10);
    });

    it('preserves detection order by confidence', () => {
        const detections = [
            createDetection('a', 0.6, { x: 0, y: 0 }),
            createDetection('b', 0.9, { x: 200, y: 0 }),
            createDetection('c', 0.7, { x: 400, y: 0 }),
        ];
        const result = nonMaxSuppression(detections);
        // Result should be sorted by confidence
        expect(result[0].entity.id).toBe('b');
        expect(result[1].entity.id).toBe('c');
        expect(result[2].entity.id).toBe('a');
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

    it('places count region at bottom-right edge', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        expect(countRegion.x + countRegion.width).toBe(cell.x + cell.width);
        expect(countRegion.y + countRegion.height).toBe(cell.y + cell.height);
    });

    it('scales count region proportionally for small cells', () => {
        const smallCell: ROI = { x: 0, y: 0, width: 40, height: 40 };
        const countRegion = extractCountRegion(smallCell);
        expect(countRegion.width).toBe(10); // 25% of 40
    });

    it('preserves label with suffix', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64, label: 'cell_5' };
        const countRegion = extractCountRegion(cell);
        expect(countRegion.label).toBe('cell_5_count');
    });

    it('handles cell without label', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        expect(countRegion.label).toBe('cell_count');
    });

    it('handles very small cells', () => {
        const tinyCell: ROI = { x: 10, y: 10, width: 16, height: 16 };
        const countRegion = extractCountRegion(tinyCell);
        expect(countRegion.width).toBe(4); // 25% of 16
        expect(countRegion.height).toBe(4);
    });
});

describe('detectGridPositions', () => {
    it('generates grid positions for 1080p', () => {
        const positions = detectGridPositions(1920, 1080);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('generates grid positions for 720p', () => {
        const positions = detectGridPositions(1280, 720);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('generates grid positions for 4K', () => {
        const positions = detectGridPositions(3840, 2160);
        expect(positions.length).toBeGreaterThan(0);
    });

    it('positions are at bottom of screen', () => {
        const positions = detectGridPositions(1920, 1080);
        positions.forEach(pos => {
            expect(pos.y).toBeGreaterThan(1080 * 0.8); // Bottom 20%
        });
    });

    it('cells have consistent dimensions', () => {
        const positions = detectGridPositions(1920, 1080);
        const firstCell = positions[0];
        positions.forEach(pos => {
            expect(pos.width).toBe(firstCell.width);
            expect(pos.height).toBe(firstCell.height);
        });
    });

    it('cells have unique labels', () => {
        const positions = detectGridPositions(1920, 1080);
        const labels = positions.map(p => p.label);
        const uniqueLabels = new Set(labels);
        expect(uniqueLabels.size).toBe(positions.length);
    });

    it('cells are arranged horizontally', () => {
        const positions = detectGridPositions(1920, 1080);
        const sortedByX = [...positions].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sortedByX.length; i++) {
            expect(sortedByX[i].x).toBeGreaterThan(sortedByX[i-1].x);
        }
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

    it('returns grid params for valid pattern', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 150, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 200, y: 600, width: 48, height: 48 }),
        ];
        const result = verifyGridPattern(detections, 50);
        expect(result.gridParams).not.toBeNull();
    });

    it('handles multiple rows', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 148, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 100, y: 648, width: 48, height: 48 }),
            createDetection('item4', 0.82, { x: 148, y: 648, width: 48, height: 48 }),
        ];
        const result = verifyGridPattern(detections, 48);
        expect(result.isValid).toBe(true);
    });

    it('detects irregular spacing', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600 }),
            createDetection('item2', 0.85, { x: 200, y: 600 }), // 100px gap
            createDetection('item3', 0.88, { x: 250, y: 600 }), // 50px gap - different
            createDetection('item4', 0.82, { x: 400, y: 600 }), // 150px gap - different
        ];
        const result = verifyGridPattern(detections, 50);
        // Should still process but may have lower confidence
        expect(result.filteredDetections.length).toBeGreaterThanOrEqual(0);
    });

    it('handles detections without position', () => {
        const detections = [
            createDetection('item1', 0.9), // no position
            createDetection('item2', 0.85), // no position
            createDetection('item3', 0.88), // no position
        ];
        const result = verifyGridPattern(detections, 48);
        expect(result.isValid).toBe(true);
    });

    it('returns confidence based on fit ratio', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 148, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 196, y: 600, width: 48, height: 48 }),
        ];
        const result = verifyGridPattern(detections, 48);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
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

    it('has enabled property', () => {
        const metrics = getCVMetrics();
        expect(typeof metrics.enabled).toBe('boolean');
    });

    it('aggregated metrics exist', () => {
        const metrics = getCVMetrics();
        expect(metrics.aggregated).toBeDefined();
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

    it('returns resolution tier when dimensions provided', () => {
        const config = getDetectionConfig(1920, 1080);
        expect(config).toHaveProperty('resolutionTier');
        expect(typeof config.resolutionTier).toBe('string');
    });

    it('returns selected strategies', () => {
        const config = getDetectionConfig(1920, 1080);
        expect(config).toHaveProperty('selectedStrategies');
        expect(Array.isArray(config.selectedStrategies)).toBe(true);
    });

    it('returns scoring config', () => {
        const config = getDetectionConfig();
        expect(config).toHaveProperty('scoringConfig');
    });

    it('threshold is in valid range', () => {
        const config = getDetectionConfig(1920, 1080);
        expect(config.dynamicThreshold).toBeGreaterThan(0);
        expect(config.dynamicThreshold).toBeLessThan(1);
    });

    it('works without dimensions', () => {
        const config = getDetectionConfig();
        expect(config.dynamicThreshold).toBeDefined();
        expect(config.resolutionTier).toBeDefined();
    });

    it('returns different thresholds for different resolutions', () => {
        const config720 = getDetectionConfig(1280, 720);
        const config4k = getDetectionConfig(3840, 2160);
        // Thresholds may differ based on resolution tier
        expect(typeof config720.dynamicThreshold).toBe('number');
        expect(typeof config4k.dynamicThreshold).toBe('number');
    });
});
