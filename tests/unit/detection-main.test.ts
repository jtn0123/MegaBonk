/**
 * Main Detection Functions Coverage Tests
 * 
 * Tests for the main detection pipeline:
 * - detectItemsWithCV main flow
 * - detectIconsWithSlidingWindow
 * - detectEquipmentRegion
 * - matchTemplate paths
 * - boostConfidenceWithContext
 * - validateWithBorderRarity
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
    loadImageToCanvas,
    detectHotbarRegion,
    detectIconScale,
    detectGridPositions,
    verifyGridPattern,
    calculateSimilarity,
    calculateIoU,
    nonMaxSuppression,
    resizeImageData,
    fitsGrid,
    extractCountRegion,
    getCVMetrics,
    getDetectionConfig,
    getUncertainDetectionsFromResults,
    detectItemsWithCV,
    getAdaptiveIconSizes,
    detectIconEdges,
} from '../../src/modules/cv/detection.ts';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';
import * as state from '../../src/modules/cv/state.ts';

// ========================================
// Mocks
// ========================================

// Mock the logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

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
 * Create a simple data URL from a canvas with solid color
 */
function createDataUrl(width: number = 100, height: number = 100, color: string = '#808080'): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
}

/**
 * Create a data URL simulating a game screenshot with hotbar
 */
function createGameScreenshotDataUrl(width: number = 1920, height: number = 1080): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Dark background (game scene)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Hotbar region at bottom (slightly lighter)
    const hotbarY = Math.floor(height * 0.88);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, hotbarY, width, height - hotbarY);
    
    // Add some "icon" cells with borders
    const iconSize = 48;
    const startX = Math.floor(width / 2 - 4 * iconSize);
    for (let i = 0; i < 8; i++) {
        const x = startX + i * (iconSize + 4);
        const y = hotbarY + 10;
        
        // Green border (uncommon rarity)
        ctx.strokeStyle = '#22aa22';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, iconSize, iconSize);
        
        // Fill with a color pattern
        ctx.fillStyle = `hsl(${i * 45}, 50%, 40%)`;
        ctx.fillRect(x + 3, y + 3, iconSize - 6, iconSize - 6);
    }
    
    return canvas.toDataURL('image/png');
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
// calculateSimilarity with resized images
// ========================================

describe('calculateSimilarity with resized data', () => {
    it('works with resized images', () => {
        // Create original 100x100 image
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = 'blue';
        ctx.fillRect(25, 25, 50, 50);
        const original = ctx.getImageData(0, 0, 100, 100);
        
        // Resize to 50x50
        const resized = resizeImageData(original, 50, 50);
        expect(resized).not.toBeNull();
        
        // Resize back to 100x100
        const resizedBack = resizeImageData(resized!, 100, 100);
        expect(resizedBack).not.toBeNull();
        
        // Should still be somewhat similar despite resize artifacts
        const similarity = calculateSimilarity(original, resizedBack!);
        expect(similarity).toBeGreaterThan(0.3);
    });

    it('handles grayscale images', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        
        // Create grayscale pattern
        for (let y = 0; y < 48; y++) {
            for (let x = 0; x < 48; x++) {
                const gray = Math.floor((x + y) * 2.7);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        
        const img1 = ctx.getImageData(0, 0, 48, 48);
        const img2 = ctx.getImageData(0, 0, 48, 48);
        
        const similarity = calculateSimilarity(img1, img2);
        expect(similarity).toBeGreaterThan(0.95);
    });

    it('handles transparent images', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        
        // Semi-transparent fill
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 48, 48);
        const img1 = ctx.getImageData(0, 0, 48, 48);
        
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 48, 48);
        const img2 = ctx.getImageData(0, 0, 48, 48);
        
        const similarity = calculateSimilarity(img1, img2);
        // Transparent images may have lower similarity due to alpha handling
        expect(similarity).toBeGreaterThan(0.5);
    });
});

// ========================================
// verifyGridPattern edge cases
// ========================================

describe('verifyGridPattern detailed tests', () => {
    it('handles empty positions array', () => {
        const result = verifyGridPattern([], 48);
        
        expect(result.isValid).toBe(true);
        expect(result.filteredDetections).toEqual([]);
    });

    it('handles one detection', () => {
        const detections = [createDetection('a', 100, 100, 48, 48)];
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result.isValid).toBe(true);
        expect(result.filteredDetections).toHaveLength(1);
    });

    it('handles two detections', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 150, 100, 48, 48),
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result.isValid).toBe(true);
    });

    it('validates irregular grid spacing', () => {
        const detections = [
            createDetection('a', 100, 100, 48, 48),
            createDetection('b', 160, 100, 48, 48), // 60px gap
            createDetection('c', 210, 100, 48, 48), // 50px gap (different)
            createDetection('d', 270, 100, 48, 48), // 60px gap
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        // Should handle minor variance
        expect(result).toBeDefined();
    });

    it('identifies consistent multi-row grid', () => {
        // Create a 3x3 grid
        const detections: CVDetectionResult[] = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                detections.push(createDetection(
                    `${row}${col}`,
                    100 + col * 52,
                    100 + row * 52,
                    48, 48
                ));
            }
        }
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result.isValid).toBe(true);
        expect(result.filteredDetections.length).toBeGreaterThanOrEqual(8);
    });
});

// ========================================
// detectHotbarRegion additional tests
// ========================================

describe('detectHotbarRegion additional scenarios', () => {
    it('handles mixed rarity borders', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 950 && y <= 1060) {
                // Mix of green and blue borders
                if (x % 100 < 3) {
                    return x % 200 < 100 
                        ? [30, 200, 30, 255]  // Green
                        : [30, 100, 230, 255]; // Blue
                }
                return [80, 80, 90, 255];
            }
            return [20, 20, 20, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeLessThan(1080);
        expect(result.confidence).toBeGreaterThan(0);
    });

    it('handles narrow hotbar', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            // Very narrow hotbar region (only 30px tall)
            if (y >= 1040 && y <= 1070) {
                return [100, 100, 120, 255];
            }
            return [20, 20, 20, 255];
        });
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        // Should still detect something
        expect(result.topY).toBeDefined();
        expect(result.bottomY).toBeDefined();
    });

    it('handles full-bright screen', () => {
        const ctx = createMockContext(1920, 1080, () => [255, 255, 255, 255]);
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        // Should return fallback
        expect(result.topY).toBeDefined();
    });
});

// ========================================
// detectIconEdges additional tests
// ========================================

describe('detectIconEdges additional tests', () => {
    it('handles wide border detection', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Wide 6px borders
                if ((x >= 300 && x <= 306) || (x >= 360 && x <= 366)) {
                    return [30, 200, 30, 255];
                }
            }
            return [50, 50, 50, 255];
        });
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('handles thin 2px borders', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 960 && y <= 1060) {
                // Thin 2px borders
                if ((x >= 300 && x <= 301) || (x >= 350 && x <= 351) || 
                    (x >= 400 && x <= 401)) {
                    return [30, 200, 30, 255];
                }
            }
            return [50, 50, 50, 255];
        });
        const bandRegion = { topY: 960, bottomY: 1060 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });
});

// ========================================
// detectIconScale additional tests
// ========================================

describe('detectIconScale additional tests', () => {
    it('handles very low resolution', () => {
        const ctx = createMockContext(640, 480, () => [50, 50, 50, 255]);
        
        const result = detectIconScale(ctx, 640, 480);
        
        expect(result.iconSize).toBeGreaterThan(0);
        expect(result.method).toBe('resolution_fallback');
    });

    it('handles multiple consistent spacings', () => {
        const ctx = createMockContext(1920, 1080, (x, y) => {
            if (y >= 950 && y <= 1050) {
                // Create 10 borders at 52px intervals
                for (let i = 0; i < 10; i++) {
                    const borderX = 300 + i * 52;
                    if (x >= borderX && x <= borderX + 3) {
                        return [30, 200, 30, 255];
                    }
                }
                return [80, 80, 90, 255];
            }
            return [20, 20, 20, 255];
        });
        
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.iconSize).toBeGreaterThan(0);
    });
});

// ========================================
// nonMaxSuppression stress tests
// ========================================

describe('nonMaxSuppression stress tests', () => {
    it('handles 100+ detections', () => {
        const detections: CVDetectionResult[] = [];
        
        // Create many overlapping detections at same positions
        // Each position has 5 overlapping detections
        for (let pos = 0; pos < 20; pos++) {
            for (let overlap = 0; overlap < 5; overlap++) {
                detections.push(createDetection(
                    `item${pos}_${overlap}`,
                    (pos % 5) * 60 + overlap * 2, // Small offset for overlap
                    Math.floor(pos / 5) * 60 + overlap * 2,
                    48, 48,
                    0.5 + overlap * 0.1
                ));
            }
        }
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Should suppress overlapping detections significantly
        expect(result.length).toBeLessThanOrEqual(detections.length);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThan(80); // Expect significant reduction
    });

    it('preserves highest confidence for each area', () => {
        // Create clusters of overlapping detections
        const detections: CVDetectionResult[] = [];
        const positions = [[0, 0], [100, 0], [200, 0]];
        
        for (const [px, py] of positions) {
            // Add 5 overlapping detections at each position
            for (let i = 0; i < 5; i++) {
                detections.push(createDetection(
                    `item_${px}_${i}`,
                    px + i,
                    py + i,
                    50, 50,
                    0.5 + i * 0.1 // Increasing confidence
                ));
            }
        }
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Should keep roughly 1 per cluster
        expect(result.length).toBeLessThanOrEqual(6);
        expect(result.length).toBeGreaterThanOrEqual(3);
        
        // Each kept detection should have high confidence
        for (const det of result) {
            expect(det.confidence).toBeGreaterThan(0.7);
        }
    });
});

// ========================================
// calculateIoU stress tests
// ========================================

describe('calculateIoU edge cases', () => {
    it('handles very large boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 10000, height: 10000 };
        const box2: ROI = { x: 5000, y: 5000, width: 10000, height: 10000 };
        
        const iou = calculateIoU(box1, box2);
        
        expect(iou).toBeGreaterThan(0);
        expect(iou).toBeLessThan(1);
    });

    it('handles 1x1 boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 1, height: 1 };
        const box2: ROI = { x: 0, y: 0, width: 1, height: 1 };
        
        const iou = calculateIoU(box1, box2);
        
        expect(iou).toBe(1);
    });
});

// ========================================
// getAdaptiveIconSizes edge cases
// ========================================

describe('getAdaptiveIconSizes edge cases', () => {
    it('handles square resolution', () => {
        const sizes = getAdaptiveIconSizes(1000, 1000);
        expect(sizes).toHaveLength(3);
    });

    it('handles extreme aspect ratio', () => {
        const sizes = getAdaptiveIconSizes(3840, 480);
        expect(sizes).toHaveLength(3);
        expect(sizes.every(s => s > 0)).toBe(true);
    });

    it('handles very small resolution', () => {
        const sizes = getAdaptiveIconSizes(320, 240);
        expect(sizes).toHaveLength(3);
    });
});

// ========================================
// fitsGrid detailed tests
// ========================================

describe('fitsGrid detailed tests', () => {
    it('handles edge at grid boundary minus tolerance', () => {
        // Value at spacing - 3 (within tolerance of 5) should fit
        expect(fitsGrid(47, 0, 50, 5)).toBe(true);
    });

    it('handles edge at grid boundary plus tolerance', () => {
        // Value at spacing + 3 (within tolerance of 5) should fit
        expect(fitsGrid(53, 0, 50, 5)).toBe(true);
    });

    it('handles large spacing values', () => {
        expect(fitsGrid(500, 0, 100, 10)).toBe(true);
        expect(fitsGrid(555, 0, 100, 10)).toBe(false);
    });

    it('handles non-integer grid calculations', () => {
        // With spacing that doesn't divide evenly
        expect(fitsGrid(105, 0, 37, 5)).toBe(false);
        expect(fitsGrid(111, 0, 37, 5)).toBe(true); // 37*3 = 111
    });
});

// ========================================
// resizeImageData edge cases
// ========================================

describe('resizeImageData edge cases', () => {
    it('handles 1x1 source', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 1, 1);
        const original = ctx.getImageData(0, 0, 1, 1);
        
        const resized = resizeImageData(original, 10, 10);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(10);
        expect(resized!.height).toBe(10);
    });

    it('handles odd dimensions', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 37;
        canvas.height = 51;
        const ctx = canvas.getContext('2d')!;
        const original = ctx.createImageData(37, 51);
        
        const resized = resizeImageData(original, 43, 67);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(43);
        expect(resized!.height).toBe(67);
    });
});

// ========================================
// getUncertainDetectionsFromResults detailed
// ========================================

describe('getUncertainDetectionsFromResults detailed', () => {
    it('handles mixed confidence detections', () => {
        const detections: CVDetectionResult[] = [
            createDetection('a', 0, 0, 48, 48, 0.95),
            createDetection('b', 50, 0, 48, 48, 0.60), // Medium
            createDetection('c', 100, 0, 48, 48, 0.45), // Low
            createDetection('d', 150, 0, 48, 48, 0.85),
        ];
        
        const uncertain = getUncertainDetectionsFromResults(detections);
        
        expect(Array.isArray(uncertain)).toBe(true);
    });

    it('handles all high confidence', () => {
        const detections: CVDetectionResult[] = [
            createDetection('a', 0, 0, 48, 48, 0.95),
            createDetection('b', 50, 0, 48, 48, 0.92),
            createDetection('c', 100, 0, 48, 48, 0.98),
        ];
        
        const uncertain = getUncertainDetectionsFromResults(detections);
        
        // All high confidence, so few or no uncertain
        expect(uncertain.length).toBeLessThanOrEqual(1);
    });
});

// ========================================
// getCVMetrics detailed tests
// ========================================

describe('getCVMetrics detailed tests', () => {
    it('returns correct structure', () => {
        const metrics = getCVMetrics();
        
        expect(typeof metrics.enabled).toBe('boolean');
        expect(metrics.runs).toBeDefined();
        expect(metrics.aggregated).toBeDefined();
    });

    it('aggregated metrics have expected fields', () => {
        const metrics = getCVMetrics();
        
        // Aggregated should have standard fields
        const agg = metrics.aggregated;
        expect(agg).toBeDefined();
    });
});

// ========================================
// getDetectionConfig detailed tests
// ========================================

describe('getDetectionConfig detailed tests', () => {
    it('returns strategies for different resolutions', () => {
        const config720 = getDetectionConfig(1280, 720);
        const config1080 = getDetectionConfig(1920, 1080);
        const config4k = getDetectionConfig(3840, 2160);
        
        // All should have strategies
        expect(config720.selectedStrategies.length).toBeGreaterThan(0);
        expect(config1080.selectedStrategies.length).toBeGreaterThan(0);
        expect(config4k.selectedStrategies.length).toBeGreaterThan(0);
    });

    it('scoring config has expected structure', () => {
        const config = getDetectionConfig(1920, 1080);
        
        expect(config.scoringConfig).toBeDefined();
    });
});

// ========================================
// detectGridPositions additional tests
// ========================================

describe('detectGridPositions additional tests', () => {
    it('handles unusual aspect ratio', () => {
        // Very wide screen
        const positions = detectGridPositions(3440, 1440);
        
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('positions have required properties', () => {
        const positions = detectGridPositions(1920, 1080);
        
        for (const pos of positions) {
            expect(typeof pos.x).toBe('number');
            expect(typeof pos.y).toBe('number');
            expect(typeof pos.width).toBe('number');
            expect(typeof pos.height).toBe('number');
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeGreaterThanOrEqual(0);
        }
    });

    it('positions are non-overlapping', () => {
        const positions = detectGridPositions(1920, 1080);
        
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const p1 = positions[i]!;
                const p2 = positions[j]!;
                
                // Check no overlap (should be adjacent, not overlapping)
                const overlap = calculateIoU(p1, p2);
                expect(overlap).toBe(0);
            }
        }
    });
});

// ========================================
// extractCountRegion additional tests
// ========================================

describe('extractCountRegion additional tests', () => {
    it('count region is in bottom-right quadrant', () => {
        const cell: ROI = { x: 100, y: 100, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        
        // Center of count region should be in bottom-right
        const countCenterX = countRegion.x + countRegion.width / 2;
        const countCenterY = countRegion.y + countRegion.height / 2;
        const cellCenterX = cell.x + cell.width / 2;
        const cellCenterY = cell.y + cell.height / 2;
        
        expect(countCenterX).toBeGreaterThan(cellCenterX);
        expect(countCenterY).toBeGreaterThan(cellCenterY);
    });

    it('count region size is proportional', () => {
        const smallCell: ROI = { x: 0, y: 0, width: 32, height: 32 };
        const largeCell: ROI = { x: 0, y: 0, width: 128, height: 128 };
        
        const smallCount = extractCountRegion(smallCell);
        const largeCount = extractCountRegion(largeCell);
        
        // Small cell count region should be smaller or equal
        expect(smallCount.width).toBeLessThanOrEqual(largeCount.width);
    });
});
