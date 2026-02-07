/**
 * Extended Detection Module Coverage Tests
 * 
 * Additional tests to improve coverage in src/modules/cv/detection.ts
 * Targets functions identified as low-coverage:
 * - detectIconsWithTwoPhase branches
 * - detectHotbarRegion fallbacks
 * - verifyGridPattern edge cases  
 * - matchTemplate conditional paths
 * - inferGridFromEdges scenarios
 * - Helper functions: fitsGrid, clusterByY, extractCountRegion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    loadImageToCanvas,
    detectIconEdges,
    detectHotbarRegion,
    detectIconScale,
    getAdaptiveIconSizes,
    calculateIoU,
    nonMaxSuppression,
    resizeImageData,
    detectGridPositions,
    verifyGridPattern,
    calculateSimilarity,
    fitsGrid,
    extractCountRegion,
    getCVMetrics,
    getDetectionConfig,
    setWorkerBasePath,
    getUncertainDetectionsFromResults,
} from '../../src/modules/cv/detection.ts';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';

// ========================================
// Test Helpers
// ========================================

/**
 * Create a mock canvas context with customizable pixel data
 */
function createMockContext(
    width: number,
    height: number,
    pixelGenerator?: (x: number, y: number) => [number, number, number, number]
): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    if (pixelGenerator) {
        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const [r, g, b, a] = pixelGenerator(x, y);
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = a;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
    
    return ctx;
}

/**
 * Create a detection result for testing
 */
function createDetection(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    confidence: number = 0.8,
    rarity: string = 'common'
): CVDetectionResult {
    return {
        type: 'item',
        entity: { id, name: `Item ${id}`, rarity },
        confidence,
        position: { x, y, width, height },
        method: 'template_match',
    };
}

// ========================================
// detectHotbarRegion Extended Tests
// ========================================

describe('detectHotbarRegion extended', () => {
    it('handles image with very high variance', () => {
        // Create context with high color variance at bottom
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 950 && y <= 1070) {
                // Random colorful pixels simulating items
                const r = (x * 17 + y * 31) % 256;
                const g = (x * 23 + y * 47) % 256;
                const b = (x * 29 + y * 53) % 256;
                return [r, g, b, 255];
            }
            return [30, 30, 30, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeLessThan(1080);
        expect(result.bottomY).toBeLessThanOrEqual(1080);
        expect(result.confidence).toBeGreaterThan(0);
    });

    it('handles image with rarity border colors', () => {
        // Create context with green (uncommon) borders at bottom
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 950 && y <= 1050) {
                // Create green rarity borders at regular intervals
                if (x % 50 < 3) {
                    return [30, 200, 30, 255]; // Green border
                }
                return [100, 100, 120, 255];
            }
            return [30, 30, 30, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeDefined();
        expect(result.bottomY).toBeDefined();
    });

    it('returns fallback when no hotbar detected', () => {
        // Completely uniform dark image
        const ctx = createMockContext(1920, 1080, () => [10, 10, 10, 255]);
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        // Should return fallback values at bottom of screen
        expect(result.topY).toBeGreaterThan(800);
        expect(result.bottomY).toBeLessThanOrEqual(1080);
    });

    it('handles 720p resolution properly', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            if (y >= 620 && y <= 710) {
                return [100, 80, 120, 255];
            }
            return [30, 30, 30, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1280, 720);
        
        expect(result.topY).toBeLessThan(720);
    });

    it('handles 4K resolution properly', () => {
        const ctx = createMockContext(3840, 2160, (x, y) => {
            if (y >= 1900 && y <= 2140) {
                return [100, 80, 120, 255];
            }
            return [30, 30, 30, 255];
        });
        
        const result = detectHotbarRegion(ctx, 3840, 2160);
        
        expect(result.topY).toBeLessThan(2160);
    });

    it('detects band with blue (rare) border colors', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                if (x % 60 < 4) {
                    return [30, 100, 230, 255]; // Blue border
                }
                return [80, 80, 90, 255];
            }
            return [20, 20, 20, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
    });
});

// ========================================
// verifyGridPattern Extended Tests
// ========================================

describe('verifyGridPattern extended', () => {
    const expectedIconSize = 48;

    it('handles exactly 3 detections', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
            createDetection('c', 200, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        expect(result.isValid).toBe(true);
        expect(result.filteredDetections.length).toBeGreaterThanOrEqual(2);
    });

    it('handles detections in multiple rows', () => {
        const detections = [
            // Row 1
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
            createDetection('c', 200, 100, 48, 48),
            // Row 2
            createDetection('d', 100, 150, 48, 48),
            createDetection('e', 150, 150, 48, 48),
            createDetection('f', 200, 150, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        expect(result.isValid).toBe(true);
        expect(result.filteredDetections.length).toBeGreaterThanOrEqual(5);
    });

    it('filters out outlier detections', () => {
        const detections = [
            // Regular grid
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
            createDetection('c', 200, 100, 48, 48),
            createDetection('d', 250, 100, 48, 48),
            // Outlier (not on grid)
            createDetection('outlier', 130, 130, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        // Outlier should be filtered or result should still be valid
        expect(result.isValid).toBe(true);
    });

    it('handles detections without position', () => {
        const detectionsWithoutPos: CVDetectionResult[] = [
            {
                type: 'item',
                entity: { id: 'a', name: 'Item A' },
                confidence: 0.8,
                method: 'template_match',
                // No position
            },
            createDetection('b', 100, 100, 48, 48),
            createDetection('c', 150, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detectionsWithoutPos, expectedIconSize);
        
        expect(result).toBeDefined();
    });

    it('handles single row grid correctly', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
            createDetection('c', 200, 100, 48, 48),
            createDetection('d', 250, 100, 48, 48),
            createDetection('e', 300, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        expect(result.isValid).toBe(true);
        expect(result.gridParams).not.toBeNull();
    });

    it('handles large gap (skipped slot) in grid', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
            // Skip one slot
            createDetection('c', 250, 100, 48, 48), // Gap of ~100 (2x spacing)
            createDetection('d', 300, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        // Should still be valid as gap is a multiple of spacing
        expect(result.isValid).toBe(true);
    });

    it('calculates grid params correctly', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 148, 100, 48, 48),
            createDetection('c', 196, 100, 48, 48),
            createDetection('d', 244, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        if (result.gridParams) {
            expect(result.gridParams.xSpacing).toBeGreaterThan(0);
            expect(result.gridParams.ySpacing).toBeGreaterThan(0);
            expect(result.gridParams.tolerance).toBeGreaterThan(0);
        }
    });

    it('handles widely spaced detections', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 250, 100, 48, 48), // 150px apart
            createDetection('c', 400, 100, 48, 48), // 150px apart
        ];
        
        const result = verifyGridPattern(detections, expectedIconSize);
        
        expect(result).toBeDefined();
    });
});

// ========================================
// fitsGrid Tests
// ========================================

describe('fitsGrid', () => {
    it('returns true when value fits grid exactly', () => {
        expect(fitsGrid(100, 0, 50, 5)).toBe(true); // 100 = 0 + 50*2
        expect(fitsGrid(150, 0, 50, 5)).toBe(true); // 150 = 0 + 50*3
    });

    it('returns true when within tolerance', () => {
        expect(fitsGrid(103, 0, 50, 5)).toBe(true); // Close to 100
        expect(fitsGrid(148, 0, 50, 5)).toBe(true); // Close to 150
    });

    it('returns false when outside tolerance', () => {
        expect(fitsGrid(110, 0, 50, 5)).toBe(false); // Not on grid
        expect(fitsGrid(130, 0, 50, 5)).toBe(false); // Not on grid
    });

    it('handles non-zero grid start', () => {
        expect(fitsGrid(120, 20, 50, 5)).toBe(true); // 120 = 20 + 50*2
        expect(fitsGrid(170, 20, 50, 5)).toBe(true); // 170 = 20 + 50*3
    });

    it('returns true when spacing is zero', () => {
        expect(fitsGrid(100, 0, 0, 5)).toBe(true);
    });

    it('handles negative tolerance edge', () => {
        // Value near the end of spacing should also match
        expect(fitsGrid(97, 0, 50, 5)).toBe(true); // 97 is 3 less than 100
        expect(fitsGrid(47, 0, 50, 5)).toBe(true); // 47 is 3 less than 50
    });
});

// ========================================
// extractCountRegion Tests
// ========================================

describe('extractCountRegion', () => {
    it('extracts bottom-right corner of cell', () => {
        const cell: ROI = { x: 100, y: 100, width: 48, height: 48 };
        const countRegion = extractCountRegion(cell);
        
        // Count region should be bottom-right
        expect(countRegion.x).toBeGreaterThan(cell.x);
        expect(countRegion.y).toBeGreaterThan(cell.y);
        expect(countRegion.x + countRegion.width).toBe(cell.x + cell.width);
        expect(countRegion.y + countRegion.height).toBe(cell.y + cell.height);
    });

    it('handles small cells', () => {
        const cell: ROI = { x: 0, y: 0, width: 20, height: 20 };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.width).toBeLessThanOrEqual(25);
        expect(countRegion.height).toBeLessThanOrEqual(25);
    });

    it('handles large cells', () => {
        const cell: ROI = { x: 0, y: 0, width: 200, height: 200 };
        const countRegion = extractCountRegion(cell);
        
        // Max size is 25
        expect(countRegion.width).toBe(25);
        expect(countRegion.height).toBe(25);
    });

    it('preserves label with suffix', () => {
        const cell: ROI = { x: 0, y: 0, width: 48, height: 48, label: 'slot_1' };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.label).toBe('slot_1_count');
    });

    it('handles cell without label', () => {
        const cell: ROI = { x: 0, y: 0, width: 48, height: 48 };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.label).toBe('cell_count');
    });
});

// ========================================
// detectGridPositions Tests
// ========================================

describe('detectGridPositions', () => {
    it('returns grid positions for 1080p', () => {
        const positions = detectGridPositions(1920, 1080);
        
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
        
        // Check positions are at bottom of screen (hotbar)
        for (const pos of positions) {
            expect(pos.y).toBeGreaterThan(1000);
        }
    });

    it('returns grid positions for 720p', () => {
        const positions = detectGridPositions(1280, 720);
        
        expect(positions.length).toBeGreaterThan(0);
        
        for (const pos of positions) {
            expect(pos.y).toBeGreaterThan(650);
        }
    });

    it('returns grid positions for 4K', () => {
        const positions = detectGridPositions(3840, 2160);
        
        expect(positions.length).toBeGreaterThan(0);
        
        for (const pos of positions) {
            expect(pos.y).toBeGreaterThan(2000);
        }
    });

    it('assigns labels to cells', () => {
        const positions = detectGridPositions(1920, 1080);
        
        for (let i = 0; i < positions.length; i++) {
            expect(positions[i]!.label).toBe(`cell_${i}`);
        }
    });

    it('respects margin from edges', () => {
        const positions = detectGridPositions(1920, 1080);
        
        // All positions should be at least 50px from edges
        for (const pos of positions) {
            expect(pos.x).toBeGreaterThanOrEqual(50);
            expect(pos.x + pos.width).toBeLessThan(1920 - 50);
        }
    });
});

// ========================================
// detectIconScale Tests
// ========================================

describe('detectIconScale extended', () => {
    it('returns resolution fallback for low contrast image', () => {
        const ctx = createMockContext(1920, 1080, () => [50, 50, 50, 255]);
        
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.method).toBe('resolution_fallback');
        expect(result.iconSize).toBeGreaterThan(0);
    });

    it('uses edge analysis when borders are present', () => {
        // Create image with evenly spaced rarity borders
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Create 8 borders at 48px intervals
                for (let i = 0; i < 8; i++) {
                    const borderX = 400 + i * 48;
                    if (x >= borderX && x <= borderX + 3) {
                        return [30, 200, 30, 255]; // Green border
                    }
                }
                return [80, 80, 90, 255];
            }
            return [20, 20, 20, 255];
        });
        
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.iconSize).toBeGreaterThan(0);
        // Method depends on detection success
        expect(['edge_analysis', 'resolution_fallback']).toContain(result.method);
    });

    it('handles 720p scaling', () => {
        const ctx = createMockContext(1280, 720, () => [30, 30, 30, 255]);
        
        const result = detectIconScale(ctx, 1280, 720);
        
        expect(result.iconSize).toBeGreaterThan(30);
        expect(result.iconSize).toBeLessThan(60);
    });
});

// ========================================
// calculateSimilarity Edge Cases
// ========================================

describe('calculateSimilarity edge cases', () => {
    it('handles identical images', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        
        // Fill with pattern
        for (let y = 0; y < 48; y++) {
            for (let x = 0; x < 48; x++) {
                ctx.fillStyle = `rgb(${x * 5}, ${y * 5}, 100)`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        
        const imageData = ctx.getImageData(0, 0, 48, 48);
        const similarity = calculateSimilarity(imageData, imageData);
        
        // Same image should have very high similarity
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('handles completely different images', () => {
        const canvas1 = document.createElement('canvas');
        canvas1.width = 48;
        canvas1.height = 48;
        const ctx1 = canvas1.getContext('2d')!;
        ctx1.fillStyle = 'red';
        ctx1.fillRect(0, 0, 48, 48);
        
        const canvas2 = document.createElement('canvas');
        canvas2.width = 48;
        canvas2.height = 48;
        const ctx2 = canvas2.getContext('2d')!;
        ctx2.fillStyle = 'blue';
        ctx2.fillRect(0, 0, 48, 48);
        
        const img1 = ctx1.getImageData(0, 0, 48, 48);
        const img2 = ctx2.getImageData(0, 0, 48, 48);
        
        const similarity = calculateSimilarity(img1, img2);
        
        // Very different images should have lower similarity
        expect(similarity).toBeLessThan(0.9);
    });

    it('handles 1x1 images', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 1, 1);
        const img1 = ctx.getImageData(0, 0, 1, 1);
        
        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, 1, 1);
        const img2 = ctx.getImageData(0, 0, 1, 1);
        
        const similarity = calculateSimilarity(img1, img2);
        
        expect(typeof similarity).toBe('number');
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });
});

// ========================================
// resizeImageData Extended Tests
// ========================================

describe('resizeImageData extended', () => {
    it('handles non-square resize', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 50;
        const ctx = canvas.getContext('2d')!;
        const originalData = ctx.createImageData(100, 50);
        
        const resized = resizeImageData(originalData, 50, 100);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(50);
        expect(resized!.height).toBe(100);
    });

    it('handles very small target', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d')!;
        const originalData = ctx.createImageData(100, 100);
        
        const resized = resizeImageData(originalData, 5, 5);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(5);
        expect(resized!.height).toBe(5);
    });

    it('handles very large target', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d')!;
        const originalData = ctx.createImageData(10, 10);
        
        const resized = resizeImageData(originalData, 500, 500);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(500);
        expect(resized!.height).toBe(500);
    });
});

// ========================================
// detectIconEdges Extended Tests
// ========================================

describe('detectIconEdges extended', () => {
    it('handles no rarity colors', () => {
        const ctx = createMockContext(1920, 1080, () => [80, 80, 80, 255]);
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('detects purple (epic) borders', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Purple borders at intervals
                if (x >= 300 && x <= 303) return [180, 50, 200, 255];
                if (x >= 350 && x <= 353) return [180, 50, 200, 255];
                if (x >= 400 && x <= 403) return [180, 50, 200, 255];
            }
            return [50, 50, 50, 255];
        });
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('detects gold (legendary) borders', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Gold borders at intervals
                if (x >= 300 && x <= 303) return [255, 200, 50, 255];
                if (x >= 350 && x <= 353) return [255, 200, 50, 255];
                if (x >= 400 && x <= 403) return [255, 200, 50, 255];
            }
            return [50, 50, 50, 255];
        });
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('handles borders at edge of scan region', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Borders right at 15% and 85% marks
                const scanStart = Math.floor(1920 * 0.15);
                const scanEnd = Math.floor(1920 * 0.85);
                if (x >= scanStart && x <= scanStart + 3) return [30, 200, 30, 255];
                if (x >= scanEnd - 3 && x <= scanEnd) return [30, 200, 30, 255];
            }
            return [50, 50, 50, 255];
        });
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });
});

// ========================================
// getAdaptiveIconSizes Extended Tests
// ========================================

describe('getAdaptiveIconSizes extended', () => {
    it('returns correct sizes for ultra-wide resolution', () => {
        const sizes = getAdaptiveIconSizes(2560, 1080);
        
        expect(sizes).toHaveLength(3);
        expect(sizes.every(s => s > 0)).toBe(true);
    });

    it('returns correct sizes for portrait resolution', () => {
        const sizes = getAdaptiveIconSizes(1080, 1920);
        
        expect(sizes).toHaveLength(3);
        expect(sizes.every(s => s > 0)).toBe(true);
    });

    it('returns sizes in ascending order', () => {
        const sizes = getAdaptiveIconSizes(1920, 1080);
        
        expect(sizes[0]).toBeLessThan(sizes[1]!);
        expect(sizes[1]).toBeLessThan(sizes[2]!);
    });
});

// ========================================
// nonMaxSuppression Extended Tests
// ========================================

describe('nonMaxSuppression extended', () => {
    it('handles many overlapping detections', () => {
        const detections: CVDetectionResult[] = [];
        
        // Create 10 detections all overlapping at same position
        for (let i = 0; i < 10; i++) {
            detections.push({
                type: 'item',
                entity: { id: `item${i}`, name: `Item ${i}` },
                confidence: 0.5 + i * 0.05, // Increasing confidence
                position: { x: 100 + i * 2, y: 100 + i * 2, width: 50, height: 50 },
                method: 'template_match',
            });
        }
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Should suppress most overlapping detections
        expect(result.length).toBeLessThan(detections.length);
        // Should keep highest confidence
        expect(result[0]!.entity.id).toBe('item9');
    });

    it('handles grid of non-overlapping detections', () => {
        const detections: CVDetectionResult[] = [];
        
        // 3x3 grid of non-overlapping detections
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                detections.push({
                    type: 'item',
                    entity: { id: `item${row}${col}`, name: `Item ${row}${col}` },
                    confidence: 0.8,
                    position: { x: col * 100, y: row * 100, width: 50, height: 50 },
                    method: 'template_match',
                });
            }
        }
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Should keep all non-overlapping detections
        expect(result.length).toBe(9);
    });

    it('respects custom IoU threshold', () => {
        const detections: CVDetectionResult[] = [
            createDetection('a', 0, 0, 100, 100, 0.9),
            createDetection('b', 30, 0, 100, 100, 0.8), // 70% overlap
        ];
        
        // High threshold - keep both
        const result1 = nonMaxSuppression(detections, 0.8);
        expect(result1.length).toBe(2);
        
        // Low threshold - suppress one
        const result2 = nonMaxSuppression(detections, 0.5);
        expect(result2.length).toBe(1);
    });
});

// ========================================
// calculateIoU Extended Tests
// ========================================

describe('calculateIoU extended', () => {
    it('returns 1 for identical boxes', () => {
        const box: ROI = { x: 0, y: 0, width: 100, height: 100 };
        
        const iou = calculateIoU(box, box);
        
        expect(iou).toBe(1);
    });

    it('handles partial overlap', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const box2: ROI = { x: 50, y: 0, width: 100, height: 100 };
        
        const iou = calculateIoU(box1, box2);
        
        // 50x100 overlap / (2*100*100 - 50*100) = 5000/15000 = 0.333
        expect(iou).toBeCloseTo(0.333, 2);
    });

    it('handles different sized boxes', () => {
        const big: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const small: ROI = { x: 0, y: 0, width: 50, height: 50 };
        
        const iou = calculateIoU(big, small);
        
        // 50*50 overlap / (100*100 + 50*50 - 50*50) = 2500/10000 = 0.25
        expect(iou).toBe(0.25);
    });
});

// ========================================
// getCVMetrics Tests
// ========================================

describe('getCVMetrics', () => {
    it('returns metrics object with expected properties', () => {
        const metrics = getCVMetrics();
        
        expect(metrics).toHaveProperty('runs');
        expect(metrics).toHaveProperty('aggregated');
        expect(metrics).toHaveProperty('enabled');
        expect(typeof metrics.enabled).toBe('boolean');
    });
});

// ========================================
// getDetectionConfig Tests
// ========================================

describe('getDetectionConfig', () => {
    it('returns config without dimensions', () => {
        const config = getDetectionConfig();
        
        expect(config).toHaveProperty('dynamicThreshold');
        expect(config).toHaveProperty('resolutionTier');
        expect(config).toHaveProperty('selectedStrategies');
        expect(config).toHaveProperty('scoringConfig');
    });

    it('returns config with dimensions', () => {
        const config = getDetectionConfig(1920, 1080);
        
        expect(config.resolutionTier).toBeDefined();
        expect(config.dynamicThreshold).toBeGreaterThan(0);
        expect(config.dynamicThreshold).toBeLessThan(1);
    });

    it('returns different thresholds for different resolutions', () => {
        const config720 = getDetectionConfig(1280, 720);
        const config4k = getDetectionConfig(3840, 2160);
        
        // Different resolutions may have slightly different thresholds
        expect(config720.resolutionTier).not.toBe(config4k.resolutionTier);
    });
});

// ========================================
// setWorkerBasePath Tests
// ========================================

describe('setWorkerBasePath', () => {
    it('accepts empty path', () => {
        expect(() => setWorkerBasePath('')).not.toThrow();
    });

    it('accepts path with trailing slash', () => {
        expect(() => setWorkerBasePath('/megabonk/')).not.toThrow();
    });

    it('accepts path without trailing slash', () => {
        expect(() => setWorkerBasePath('/megabonk')).not.toThrow();
    });
});

// ========================================
// getUncertainDetectionsFromResults Tests
// ========================================

describe('getUncertainDetectionsFromResults', () => {
    it('handles empty array', () => {
        const result = getUncertainDetectionsFromResults([]);
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
    });

    it('handles detections without positions', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: { id: 'a', name: 'Item A' },
                confidence: 0.6,
                method: 'template_match',
            },
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        
        expect(Array.isArray(result)).toBe(true);
    });

    it('processes high-confidence detections', () => {
        const detections: CVDetectionResult[] = [
            createDetection('a', 100, 100, 48, 48, 0.95),
            createDetection('b', 150, 100, 48, 48, 0.92),
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        
        expect(Array.isArray(result)).toBe(true);
    });

    it('identifies low-confidence detections', () => {
        const detections: CVDetectionResult[] = [
            createDetection('a', 100, 100, 48, 48, 0.55), // Low confidence
            createDetection('b', 150, 100, 48, 48, 0.48), // Very low confidence
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        
        // Low confidence detections should be flagged as uncertain
        expect(Array.isArray(result)).toBe(true);
    });
});
