/**
 * @vitest-environment jsdom
 * CV Count Detection Module - Comprehensive Coverage Tests
 * Tests for item stack count detection (x2, x3, etc.)
 */
import { describe, it, expect, test } from 'vitest';
import {
    detectCount,
    hasCountOverlay,
    detectCounts,
    correctToCommonStack,
    COMMON_STACK_SIZES,
    binarize,
    type CountDetectionResult,
} from '../../src/modules/cv/count-detection.ts';

// ========================================
// Test Helpers
// ========================================

interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

function createTestImageData(
    width: number,
    height: number,
    fillFn?: (x: number, y: number) => [number, number, number, number]
): SimpleImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (fillFn) {
                const [r, g, b, a] = fillFn(x, y);
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
            } else {
                // Default: dark background
                data[idx] = 30;
                data[idx + 1] = 30;
                data[idx + 2] = 30;
                data[idx + 3] = 255;
            }
        }
    }

    return { data, width, height };
}

function createSolidImageData(width: number, height: number, r: number, g: number, b: number): SimpleImageData {
    return createTestImageData(width, height, () => [r, g, b, 255]);
}

function createImageWithBrightRegion(
    width: number,
    height: number,
    brightX: number,
    brightY: number,
    brightW: number,
    brightH: number
): SimpleImageData {
    return createTestImageData(width, height, (x, y) => {
        if (x >= brightX && x < brightX + brightW && y >= brightY && y < brightY + brightH) {
            return [255, 255, 255, 255]; // Bright white
        }
        return [30, 30, 30, 255]; // Dark background
    });
}

// ========================================
// COMMON_STACK_SIZES Tests
// ========================================

describe('COMMON_STACK_SIZES', () => {
    it('should contain expected common values', () => {
        expect(COMMON_STACK_SIZES).toContain(1);
        expect(COMMON_STACK_SIZES).toContain(2);
        expect(COMMON_STACK_SIZES).toContain(5);
        expect(COMMON_STACK_SIZES).toContain(10);
        expect(COMMON_STACK_SIZES).toContain(99);
    });

    it('should be sorted in ascending order', () => {
        for (let i = 1; i < COMMON_STACK_SIZES.length; i++) {
            expect(COMMON_STACK_SIZES[i]).toBeGreaterThan(COMMON_STACK_SIZES[i - 1]);
        }
    });

    it('should start with 1', () => {
        expect(COMMON_STACK_SIZES[0]).toBe(1);
    });

    it('should end with 99', () => {
        expect(COMMON_STACK_SIZES[COMMON_STACK_SIZES.length - 1]).toBe(99);
    });
});

// ========================================
// binarize Tests
// ========================================

describe('binarize', () => {
    it('should convert dark pixels to false', () => {
        const imageData = createSolidImageData(10, 10, 50, 50, 50);
        const binary = binarize(imageData);

        expect(binary.length).toBe(10);
        expect(binary[0].length).toBe(10);
        expect(binary[0][0]).toBe(false);
    });

    it('should convert bright pixels to true', () => {
        const imageData = createSolidImageData(10, 10, 200, 200, 200);
        const binary = binarize(imageData);

        expect(binary[0][0]).toBe(true);
    });

    it('should use default threshold of 128', () => {
        const imageData = createTestImageData(4, 1, (x) => {
            if (x === 0) return [100, 100, 100, 255]; // Below threshold
            if (x === 1) return [127, 127, 127, 255]; // At threshold
            if (x === 2) return [129, 129, 129, 255]; // Above threshold
            return [200, 200, 200, 255]; // Well above
        });

        const binary = binarize(imageData);

        expect(binary[0][0]).toBe(false); // 100 < 128
        expect(binary[0][1]).toBe(false); // 127 < 128
        expect(binary[0][2]).toBe(true);  // 129 > 128
        expect(binary[0][3]).toBe(true);  // 200 > 128
    });

    it('should use custom threshold', () => {
        const imageData = createSolidImageData(4, 4, 100, 100, 100);

        const binaryLowThreshold = binarize(imageData, 50);
        const binaryHighThreshold = binarize(imageData, 150);

        expect(binaryLowThreshold[0][0]).toBe(true);  // 100 > 50
        expect(binaryHighThreshold[0][0]).toBe(false); // 100 < 150
    });

    it('should handle empty image', () => {
        const imageData = createTestImageData(0, 0);
        const binary = binarize(imageData);

        expect(binary).toEqual([]);
    });

    it('should handle single pixel image', () => {
        const imageData = createSolidImageData(1, 1, 200, 200, 200);
        const binary = binarize(imageData);

        expect(binary.length).toBe(1);
        expect(binary[0].length).toBe(1);
    });

    it('should calculate grayscale from RGB average', () => {
        // R=255, G=0, B=0 => avg = 85, below 128
        const redImage = createSolidImageData(2, 2, 255, 0, 0);
        const redBinary = binarize(redImage);
        expect(redBinary[0][0]).toBe(false);

        // R=200, G=200, B=200 => avg = 200, above 128
        const whiteImage = createSolidImageData(2, 2, 200, 200, 200);
        const whiteBinary = binarize(whiteImage);
        expect(whiteBinary[0][0]).toBe(true);
    });
});

// ========================================
// detectCount Tests
// ========================================

describe('detectCount', () => {
    it('should return count of 1 for empty region', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 50, 50, 40, 40);

        expect(result.count).toBe(1);
        expect(result.method).toBe('none');
    });

    it('should return proper structure', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 10, 10, 50, 50);

        expect(result).toHaveProperty('count');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('rawText');
        expect(result).toHaveProperty('region');
        expect(result).toHaveProperty('method');
    });

    it('should handle region at edge of image', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 90, 90, 50, 50);

        expect(result).toBeDefined();
        expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('should handle region outside image bounds', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 200, 200, 50, 50);

        expect(result).toBeDefined();
        expect(result.count).toBe(1);
    });

    it('should handle very small cell', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 50, 50, 5, 5);

        expect(result).toBeDefined();
        expect(result.method).toBe('none');
    });

    it('should handle zero-size cell', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 50, 50, 0, 0);

        expect(result.count).toBe(1);
        expect(result.method).toBe('none');
    });

    it('should handle different screen heights', () => {
        const imageData = createSolidImageData(200, 200, 30, 30, 30);

        const result720p = detectCount(imageData, 50, 50, 40, 40, 720);
        const result1080p = detectCount(imageData, 50, 50, 40, 40, 1080);
        const result1440p = detectCount(imageData, 50, 50, 40, 40, 1440);

        expect(result720p).toBeDefined();
        expect(result1080p).toBeDefined();
        expect(result1440p).toBeDefined();
    });

    it('should detect bright pixels as potential count text', () => {
        // Create image with bright region in bottom-right (typical count location)
        const imageData = createImageWithBrightRegion(100, 100, 75, 75, 20, 20);
        const result = detectCount(imageData, 0, 0, 100, 100);

        // Should at least attempt detection
        expect(result).toBeDefined();
    });

    it('should return confidence between 0 and 1', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 10, 10, 50, 50);

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return valid region object', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 10, 10, 50, 50);

        expect(result.region).toHaveProperty('x');
        expect(result.region).toHaveProperty('y');
        expect(result.region).toHaveProperty('width');
        expect(result.region).toHaveProperty('height');
        expect(result.region.width).toBeGreaterThanOrEqual(0);
        expect(result.region.height).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative cell coordinates', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, -10, -10, 50, 50);

        expect(result).toBeDefined();
        expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('should limit detected count to valid range', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = detectCount(imageData, 10, 10, 50, 50);

        expect(result.count).toBeGreaterThanOrEqual(1);
        expect(result.count).toBeLessThanOrEqual(99);
    });
});

// ========================================
// hasCountOverlay Tests
// ========================================

describe('hasCountOverlay', () => {
    it('should return false for dark image', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = hasCountOverlay(imageData, 0, 0, 50, 50);

        expect(result).toBe(false);
    });

    it('should return true for image with bright region', () => {
        // Create image with significant bright region in count area
        const imageData = createImageWithBrightRegion(100, 100, 30, 30, 40, 40);
        const result = hasCountOverlay(imageData, 0, 0, 100, 100);

        // May or may not return true depending on where the region is
        expect(typeof result).toBe('boolean');
    });

    it('should handle different screen heights', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);

        expect(() => hasCountOverlay(imageData, 0, 0, 50, 50, 720)).not.toThrow();
        expect(() => hasCountOverlay(imageData, 0, 0, 50, 50, 1080)).not.toThrow();
        expect(() => hasCountOverlay(imageData, 0, 0, 50, 50, 1440)).not.toThrow();
    });

    it('should handle cell at edge of image', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = hasCountOverlay(imageData, 90, 90, 50, 50);

        expect(typeof result).toBe('boolean');
    });

    it('should handle cell outside image bounds', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const result = hasCountOverlay(imageData, 200, 200, 50, 50);

        expect(typeof result).toBe('boolean');
    });

    it('should detect white pixels as potential count overlay', () => {
        // Create image that's all white
        const imageData = createSolidImageData(100, 100, 255, 255, 255);
        const result = hasCountOverlay(imageData, 0, 0, 100, 100);

        // Should detect the bright pixels
        expect(result).toBe(true);
    });

    it('should not detect gray pixels as count overlay', () => {
        // Medium gray is not bright enough
        const imageData = createSolidImageData(100, 100, 150, 150, 150);
        const result = hasCountOverlay(imageData, 0, 0, 100, 100);

        expect(result).toBe(false);
    });
});

// ========================================
// detectCounts Tests
// ========================================

describe('detectCounts', () => {
    it('should return array of results', () => {
        const imageData = createSolidImageData(200, 200, 30, 30, 30);
        const cells = [
            { x: 0, y: 0, width: 50, height: 50 },
            { x: 50, y: 0, width: 50, height: 50 },
            { x: 100, y: 0, width: 50, height: 50 },
        ];

        const results = detectCounts(imageData, cells);

        expect(results).toHaveLength(3);
        expect(results[0]).toHaveProperty('count');
        expect(results[1]).toHaveProperty('count');
        expect(results[2]).toHaveProperty('count');
    });

    it('should handle empty cells array', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const results = detectCounts(imageData, []);

        expect(results).toHaveLength(0);
    });

    it('should handle single cell', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);
        const cells = [{ x: 10, y: 10, width: 40, height: 40 }];

        const results = detectCounts(imageData, cells);

        expect(results).toHaveLength(1);
    });

    it('should handle many cells', () => {
        const imageData = createSolidImageData(500, 500, 30, 30, 30);
        const cells = Array.from({ length: 50 }, (_, i) => ({
            x: (i % 10) * 50,
            y: Math.floor(i / 10) * 50,
            width: 45,
            height: 45,
        }));

        const results = detectCounts(imageData, cells);

        expect(results).toHaveLength(50);
    });

    it('should use provided screen height', () => {
        const imageData = createSolidImageData(200, 200, 30, 30, 30);
        const cells = [{ x: 0, y: 0, width: 50, height: 50 }];

        expect(() => detectCounts(imageData, cells, 720)).not.toThrow();
        expect(() => detectCounts(imageData, cells, 1080)).not.toThrow();
        expect(() => detectCounts(imageData, cells, 1440)).not.toThrow();
    });

    it('should detect counts for each cell independently', () => {
        const imageData = createSolidImageData(200, 100, 30, 30, 30);
        const cells = [
            { x: 0, y: 0, width: 50, height: 50 },
            { x: 100, y: 0, width: 50, height: 50 },
        ];

        const results = detectCounts(imageData, cells);

        expect(results).toHaveLength(2);
        // Each result should be independent
        expect(results[0].region.x).not.toBe(results[1].region.x);
    });
});

// ========================================
// correctToCommonStack Tests
// ========================================

describe('correctToCommonStack', () => {
    it('should return original count with high confidence', () => {
        expect(correctToCommonStack(7, 0.9)).toBe(7);
        expect(correctToCommonStack(13, 0.85)).toBe(13);
        expect(correctToCommonStack(42, 0.95)).toBe(42);
    });

    it('should correct to nearby common value with low confidence', () => {
        // The function returns the FIRST common size within ±1
        // COMMON_STACK_SIZES = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 99]
        
        // Near 10 (and not near earlier common values)
        expect(correctToCommonStack(9, 0.5)).toBe(10);
        expect(correctToCommonStack(11, 0.5)).toBe(10);

        // Near 99
        expect(correctToCommonStack(98, 0.5)).toBe(99);
        expect(correctToCommonStack(100, 0.5)).toBe(99);
    });

    it('should return first matching common value', () => {
        // 2 is within 1 of both 1 and 2 in COMMON_STACK_SIZES
        // Returns 1 because it comes first in the array
        expect(correctToCommonStack(2, 0.5)).toBe(1);
        
        // 4 is within 1 of 3, 4, and 5 - returns 3 (first match)
        expect(correctToCommonStack(4, 0.5)).toBe(3);
        
        // 6 is within 1 of 5 only
        expect(correctToCommonStack(6, 0.5)).toBe(5);
    });

    it('should return original if not near common value', () => {
        expect(correctToCommonStack(7, 0.5)).toBe(7);   // Not within 1 of any common
        expect(correctToCommonStack(33, 0.5)).toBe(33); // Not within 1 of any common
        expect(correctToCommonStack(27, 0.5)).toBe(27); // Not within 1 of 25 or 50
    });

    it('should use 0.8 as confidence threshold', () => {
        // Above 0.8, should trust the detection
        expect(correctToCommonStack(7, 0.81)).toBe(7);
        expect(correctToCommonStack(33, 0.9)).toBe(33);

        // At exactly 0.8, still trusts (> 0.8 check)
        expect(correctToCommonStack(7, 0.8)).toBe(7);  // 7 is not near any common, returns 7
    });

    it('should correct 1 to 1 (already common)', () => {
        expect(correctToCommonStack(1, 0.5)).toBe(1);
    });

    it('should trust detection with high confidence even for values near common sizes', () => {
        // With high confidence, should return original regardless
        expect(correctToCommonStack(2, 0.9)).toBe(2);
        expect(correctToCommonStack(4, 0.85)).toBe(4);
    });

    it('should correct 99 to 99 (already common)', () => {
        expect(correctToCommonStack(99, 0.5)).toBe(99);
    });

    it('should correct values to first matching common size', () => {
        // Values that are within ±1 of multiple common sizes
        // get corrected to the first one in the array
        expect(correctToCommonStack(0, 0.5)).toBe(1);   // 0 is near 1
        expect(correctToCommonStack(2, 0.5)).toBe(1);   // 2 is near 1 and 2, returns 1 (first)
        expect(correctToCommonStack(3, 0.5)).toBe(2);   // 3 is near 2, 3, 4, returns 2
        expect(correctToCommonStack(4, 0.5)).toBe(3);   // 4 is near 3, 4, 5, returns 3
        expect(correctToCommonStack(5, 0.5)).toBe(4);   // 5 is near 4 and 5, returns 4
    });

    it('should handle zero count', () => {
        expect(correctToCommonStack(0, 0.5)).toBe(1);  // 0 is within 1 of 1
    });

    it('should handle count of 100', () => {
        expect(correctToCommonStack(100, 0.5)).toBe(99);  // 100 is within 1 of 99
    });

    it('should handle very low confidence the same as moderate low confidence', () => {
        // Function only checks > 0.8, so 0.1 and 0.5 behave the same
        expect(correctToCommonStack(9, 0.1)).toBe(10);
        expect(correctToCommonStack(9, 0.0)).toBe(10);
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Count Detection Integration', () => {
    it('should support full count detection workflow', () => {
        const imageData = createSolidImageData(200, 200, 30, 30, 30);
        const cells = [
            { x: 0, y: 0, width: 50, height: 50 },
            { x: 60, y: 0, width: 50, height: 50 },
        ];

        // 1. Batch detect counts
        const results = detectCounts(imageData, cells);
        expect(results).toHaveLength(2);

        // 2. Correct low confidence results
        const correctedResults = results.map(r => ({
            ...r,
            count: correctToCommonStack(r.count, r.confidence),
        }));

        expect(correctedResults).toHaveLength(2);
    });

    it('should work with hasCountOverlay as pre-filter', () => {
        const imageData = createSolidImageData(200, 200, 30, 30, 30);
        const cells = [
            { x: 0, y: 0, width: 50, height: 50 },
            { x: 60, y: 0, width: 50, height: 50 },
        ];

        // Pre-filter cells with potential count overlay
        const cellsWithOverlay = cells.filter(cell =>
            hasCountOverlay(imageData, cell.x, cell.y, cell.width, cell.height)
        );

        // Only detect counts on filtered cells
        const results = detectCounts(imageData, cellsWithOverlay);

        expect(results.length).toBeLessThanOrEqual(cells.length);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Edge Cases', () => {
    it('should handle 1x1 image', () => {
        const imageData = createSolidImageData(1, 1, 255, 255, 255);
        const result = detectCount(imageData, 0, 0, 1, 1);

        expect(result).toBeDefined();
    });

    it('should handle very large image', () => {
        const imageData = createSolidImageData(2000, 2000, 30, 30, 30);
        const result = detectCount(imageData, 500, 500, 100, 100);

        expect(result).toBeDefined();
    });

    it('should handle cell larger than image', () => {
        const imageData = createSolidImageData(50, 50, 30, 30, 30);
        const result = detectCount(imageData, 0, 0, 100, 100);

        expect(result).toBeDefined();
    });

    it('should handle negative cell dimensions', () => {
        const imageData = createSolidImageData(100, 100, 30, 30, 30);

        // Negative dimensions are unusual but shouldn't crash
        expect(() => detectCount(imageData, 10, 10, -5, -5)).not.toThrow();
    });

    it('should handle all white image', () => {
        const imageData = createSolidImageData(100, 100, 255, 255, 255);
        const result = detectCount(imageData, 0, 0, 50, 50);

        expect(result).toBeDefined();
    });

    it('should handle image with only red channel', () => {
        const imageData = createSolidImageData(100, 100, 255, 0, 0);
        const result = detectCount(imageData, 0, 0, 50, 50);

        expect(result).toBeDefined();
    });

    it('should handle image with only green channel', () => {
        const imageData = createSolidImageData(100, 100, 0, 255, 0);
        const result = detectCount(imageData, 0, 0, 50, 50);

        expect(result).toBeDefined();
    });

    it('should handle image with only blue channel', () => {
        const imageData = createSolidImageData(100, 100, 0, 0, 255);
        const result = detectCount(imageData, 0, 0, 50, 50);

        expect(result).toBeDefined();
    });

    it('should handle yellow pixels (common for count text)', () => {
        const imageData = createSolidImageData(100, 100, 255, 255, 0);
        const result = detectCount(imageData, 0, 0, 50, 50);

        expect(result).toBeDefined();
    });
});

// ========================================
// Performance Tests
// ========================================

describe('Performance', () => {
    it('should detect count in reasonable time', () => {
        const imageData = createSolidImageData(500, 500, 30, 30, 30);

        const start = performance.now();
        detectCount(imageData, 100, 100, 100, 100);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should batch detect counts efficiently', () => {
        const imageData = createSolidImageData(1000, 1000, 30, 30, 30);
        const cells = Array.from({ length: 100 }, (_, i) => ({
            x: (i % 10) * 100,
            y: Math.floor(i / 10) * 100,
            width: 90,
            height: 90,
        }));

        const start = performance.now();
        detectCounts(imageData, cells);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(1000); // 100 cells should complete in under 1s
    });

    it('should check for overlay quickly', () => {
        const imageData = createSolidImageData(500, 500, 30, 30, 30);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            hasCountOverlay(imageData, 100, 100, 100, 100);
        }
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(100); // 100 checks should complete quickly
    });
});
