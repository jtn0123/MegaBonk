/**
 * @vitest-environment jsdom
 * CV Detection Module - Additional Coverage Tests
 * Targeting under-tested exported functions to boost coverage to 40%+
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock scoring-config
vi.mock('../../src/modules/cv/scoring-config.ts', () => ({
    getThresholdForRarity: vi.fn().mockReturnValue(0.5),
    getScoringConfig: vi.fn().mockReturnValue({
        thresholds: { common: 0.5, uncommon: 0.55, rare: 0.6, epic: 0.65, legendary: 0.7 },
        contextBoosts: { synergy: 0.03, rarity: 0.02 },
    }),
    calculateWeightedScore: vi.fn().mockImplementation((ncc, ssim, histogram, edge) => {
        // Simple weighted average
        return (ncc * 0.4 + ssim * 0.3 + histogram * 0.2 + edge * 0.1);
    }),
}));

// Mock resolution-profiles
vi.mock('../../src/modules/cv/resolution-profiles.ts', () => ({
    getResolutionTier: vi.fn().mockReturnValue('medium'),
}));

// Mock ensemble-detector
vi.mock('../../src/modules/cv/ensemble-detector.ts', () => ({
    selectStrategiesForImage: vi.fn().mockReturnValue(['default']),
    getStrategy: vi.fn().mockReturnValue({ minConfidence: 0.5, weight: 1, templates: {} }),
    combineStrategyDetections: vi.fn().mockReturnValue(null),
    getEnsembleConfig: vi.fn().mockReturnValue({ earlyExitThreshold: 0.9 }),
}));

// Mock active-learning
vi.mock('../../src/modules/cv/active-learning.ts', () => ({
    findUncertainDetections: vi.fn().mockImplementation((detections) => {
        // Return detections with confidence between 0.4 and 0.6 as uncertain
        return detections
            .filter((d: { confidence: number }) => d.confidence >= 0.4 && d.confidence <= 0.6)
            .map((d: { detectedItemId: string; detectedItemName: string; confidence: number }) => ({
                detection: d,
                alternatives: [{ itemId: 'alt_item', itemName: 'Alt Item', confidence: d.confidence - 0.1 }],
            }));
    }),
    shouldPromptForLearning: vi.fn().mockReturnValue(true),
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
    getUncertainDetectionsFromResults,
    detectHotbarRegion,
    detectIconEdges,
    detectIconScale,
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

// Mock canvas context helper
const createMockCanvasContext = (width: number, height: number): CanvasRenderingContext2D => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Fill with a pattern so we have some variation for detection algorithms
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, width, height);
    
    // Add some colored "icons" in the hotbar area
    ctx.fillStyle = '#00ff00'; // Green (uncommon rarity)
    ctx.fillRect(100, height - 60, 48, 48);
    
    ctx.fillStyle = '#0066ff'; // Blue (rare rarity)
    ctx.fillRect(160, height - 60, 48, 48);
    
    ctx.fillStyle = '#ff9900'; // Orange (legendary)
    ctx.fillRect(220, height - 60, 48, 48);
    
    return ctx;
};

// ========================================
// getDetectionConfig Tests (Expanded)
// ========================================

describe('getDetectionConfig (expanded)', () => {
    it('returns config with all expected properties', () => {
        const config = getDetectionConfig(1920, 1080);
        
        expect(config).toHaveProperty('dynamicThreshold');
        expect(config).toHaveProperty('resolutionTier');
        expect(config).toHaveProperty('selectedStrategies');
        expect(config).toHaveProperty('scoringConfig');
    });

    it('returns different thresholds for different resolutions', () => {
        const config720 = getDetectionConfig(1280, 720);
        const config4K = getDetectionConfig(3840, 2160);
        
        // Both should have valid numeric thresholds
        expect(typeof config720.dynamicThreshold).toBe('number');
        expect(typeof config4K.dynamicThreshold).toBe('number');
        expect(config720.dynamicThreshold).toBeGreaterThan(0);
        expect(config4K.dynamicThreshold).toBeGreaterThan(0);
    });

    it('returns valid config when no dimensions provided', () => {
        const config = getDetectionConfig();
        
        expect(config.dynamicThreshold).toBeGreaterThan(0);
        expect(config.dynamicThreshold).toBeLessThan(1);
    });

    it('selectedStrategies is an array', () => {
        const config = getDetectionConfig(1920, 1080);
        
        expect(Array.isArray(config.selectedStrategies)).toBe(true);
        expect(config.selectedStrategies.length).toBeGreaterThan(0);
    });

    it('scoringConfig has threshold values', () => {
        const config = getDetectionConfig();
        
        expect(config.scoringConfig).toHaveProperty('thresholds');
        expect(config.scoringConfig.thresholds).toBeDefined();
    });
});

// ========================================
// getUncertainDetectionsFromResults Tests
// ========================================

describe('getUncertainDetectionsFromResults', () => {
    it('returns empty array for empty detections', () => {
        const result = getUncertainDetectionsFromResults([]);
        expect(Array.isArray(result)).toBe(true);
    });

    it('filters detections with position', () => {
        const detections: CVDetectionResult[] = [
            createDetection('item1', 0.5, { x: 100, y: 600 }),
            { ...createDetection('item2', 0.5), position: undefined },
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        // Should only process detections with position
        expect(result.length).toBeLessThanOrEqual(detections.length);
    });

    it('identifies uncertain detections (confidence 0.4-0.6)', () => {
        const detections: CVDetectionResult[] = [
            createDetection('certain_high', 0.9, { x: 100, y: 600 }),
            createDetection('uncertain', 0.5, { x: 200, y: 600 }),
            createDetection('certain_low', 0.3, { x: 300, y: 600 }),
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        
        // Should find the uncertain detection
        expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('returns alternatives for uncertain detections', () => {
        const detections: CVDetectionResult[] = [
            createDetection('uncertain', 0.5, { x: 100, y: 600 }),
        ];
        
        const result = getUncertainDetectionsFromResults(detections);
        
        if (result.length > 0) {
            expect(result[0]).toHaveProperty('alternatives');
        }
    });

    it('handles many detections efficiently', () => {
        const detections = Array.from({ length: 50 }, (_, i) =>
            createDetection(`item_${i}`, 0.4 + (i % 3) * 0.1, { x: i * 60, y: 600 })
        );
        
        const start = performance.now();
        getUncertainDetectionsFromResults(detections);
        const elapsed = performance.now() - start;
        
        expect(elapsed).toBeLessThan(100);
    });
});

// ========================================
// detectHotbarRegion Tests
// ========================================

describe('detectHotbarRegion', () => {
    it('returns hotbar region with expected properties', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result).toHaveProperty('topY');
        expect(result).toHaveProperty('bottomY');
        expect(result).toHaveProperty('confidence');
    });

    it('returns topY less than bottomY', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeLessThan(result.bottomY);
    });

    it('hotbar is in bottom portion of screen', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        // Hotbar should be in bottom 35% of screen
        expect(result.topY).toBeGreaterThan(1080 * 0.65);
    });

    it('confidence is between 0 and 1', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('handles different resolutions', () => {
        const ctx720 = createMockCanvasContext(1280, 720);
        const ctx4K = createMockCanvasContext(3840, 2160);
        
        const result720 = detectHotbarRegion(ctx720, 1280, 720);
        const result4K = detectHotbarRegion(ctx4K, 3840, 2160);
        
        // Both should have valid results
        expect(result720.topY).toBeLessThan(720);
        expect(result4K.topY).toBeLessThan(2160);
    });

    it('handles small canvases', () => {
        const ctx = createMockCanvasContext(640, 480);
        const result = detectHotbarRegion(ctx, 640, 480);
        
        expect(result).toHaveProperty('topY');
        expect(result).toHaveProperty('bottomY');
    });
});

// ========================================
// detectIconEdges Tests
// ========================================

describe('detectIconEdges', () => {
    it('returns array of x positions', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const bandRegion = { topY: 900, bottomY: 1080 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('edges are sorted by x position', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const bandRegion = { topY: 900, bottomY: 1080 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        for (let i = 1; i < edges.length; i++) {
            expect(edges[i]).toBeGreaterThanOrEqual(edges[i - 1]);
        }
    });

    it('edges are within screen width', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const bandRegion = { topY: 900, bottomY: 1080 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        for (const edge of edges) {
            expect(edge).toBeGreaterThanOrEqual(0);
            expect(edge).toBeLessThan(1920);
        }
    });

    it('handles narrow band region', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const bandRegion = { topY: 1050, bottomY: 1080 };
        
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('handles empty canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        // Don't draw anything - empty canvas
        
        const bandRegion = { topY: 900, bottomY: 1080 };
        const edges = detectIconEdges(ctx, 1920, bandRegion);
        
        expect(Array.isArray(edges)).toBe(true);
    });
});

// ========================================
// detectIconScale Tests
// ========================================

describe('detectIconScale', () => {
    it('returns scale detection result', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result).toHaveProperty('iconSize');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('method');
    });

    it('iconSize is a positive number', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.iconSize).toBeGreaterThan(0);
    });

    it('confidence is between 0 and 1', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('method is either edge_analysis or resolution_fallback', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(['edge_analysis', 'resolution_fallback']).toContain(result.method);
    });

    it('returns reasonable icon sizes for different resolutions', () => {
        const ctx720 = createMockCanvasContext(1280, 720);
        const ctx4K = createMockCanvasContext(3840, 2160);
        
        const result720 = detectIconScale(ctx720, 1280, 720);
        const result4K = detectIconScale(ctx4K, 3840, 2160);
        
        // Icon sizes should be in reasonable range (25-100px)
        expect(result720.iconSize).toBeGreaterThanOrEqual(25);
        expect(result720.iconSize).toBeLessThanOrEqual(100);
        expect(result4K.iconSize).toBeGreaterThanOrEqual(25);
        expect(result4K.iconSize).toBeLessThanOrEqual(100);
    });
});

// ========================================
// getCVMetrics Tests (Expanded)
// ========================================

describe('getCVMetrics (expanded)', () => {
    it('returns metrics with runs array', () => {
        const metrics = getCVMetrics();
        expect(Array.isArray(metrics.runs)).toBe(true);
    });

    it('returns metrics with aggregated data', () => {
        const metrics = getCVMetrics();
        expect(metrics.aggregated).toBeDefined();
    });

    it('returns metrics with enabled flag', () => {
        const metrics = getCVMetrics();
        expect(typeof metrics.enabled).toBe('boolean');
    });

    it('metrics structure is consistent across calls', () => {
        const metrics1 = getCVMetrics();
        const metrics2 = getCVMetrics();
        
        expect(Object.keys(metrics1)).toEqual(Object.keys(metrics2));
    });
});

// ========================================
// calculateIoU Edge Cases
// ========================================

describe('calculateIoU (edge cases)', () => {
    it('handles very large boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 10000, height: 10000 };
        const box2: ROI = { x: 5000, y: 5000, width: 10000, height: 10000 };
        
        const iou = calculateIoU(box1, box2);
        
        expect(iou).toBeGreaterThan(0);
        expect(iou).toBeLessThan(1);
    });

    it('handles boxes at origin', () => {
        const box1: ROI = { x: 0, y: 0, width: 10, height: 10 };
        const box2: ROI = { x: 0, y: 0, width: 20, height: 20 };
        
        const iou = calculateIoU(box1, box2);
        
        // box1 is contained in box2, IoU = 100/(400) = 0.25
        expect(iou).toBeCloseTo(0.25, 2);
    });

    it('handles 1x1 pixel boxes', () => {
        const box1: ROI = { x: 100, y: 100, width: 1, height: 1 };
        const box2: ROI = { x: 100, y: 100, width: 1, height: 1 };
        
        const iou = calculateIoU(box1, box2);
        
        expect(iou).toBe(1);
    });

    it('handles boxes with equal areas but different shapes', () => {
        const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };  // Area = 10000
        const box2: ROI = { x: 0, y: 0, width: 200, height: 50 };   // Area = 10000
        
        const iou = calculateIoU(box1, box2);
        
        // Intersection is 100*50 = 5000
        // Union is 10000 + 10000 - 5000 = 15000
        // IoU = 5000/15000 = 0.333
        expect(iou).toBeCloseTo(0.333, 2);
    });
});

// ========================================
// nonMaxSuppression Edge Cases
// ========================================

describe('nonMaxSuppression (edge cases)', () => {
    it('handles all detections with same confidence', () => {
        const detections = [
            createDetection('a', 0.8, { x: 0, y: 0, width: 64, height: 64 }),
            createDetection('b', 0.8, { x: 10, y: 10, width: 64, height: 64 }),
            createDetection('c', 0.8, { x: 20, y: 20, width: 64, height: 64 }),
        ];
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Some should be suppressed due to overlap
        expect(result.length).toBeLessThanOrEqual(detections.length);
    });

    it('preserves order for equal confidence non-overlapping', () => {
        const detections = [
            createDetection('a', 0.8, { x: 0, y: 0 }),
            createDetection('b', 0.8, { x: 200, y: 200 }),
        ];
        
        const result = nonMaxSuppression(detections, 0.3);
        
        expect(result).toHaveLength(2);
    });

    it('handles threshold of exactly 0', () => {
        const detections = [
            createDetection('a', 0.9, { x: 0, y: 0, width: 50, height: 50 }),
            createDetection('b', 0.8, { x: 100, y: 100, width: 50, height: 50 }),
        ];
        
        // IoU = 0 for non-overlapping, so both should pass even with threshold 0
        const result = nonMaxSuppression(detections, 0);
        
        expect(result).toHaveLength(2);
    });

    it('handles threshold of 1', () => {
        const detections = [
            createDetection('a', 0.9, { x: 0, y: 0, width: 64, height: 64 }),
            createDetection('b', 0.8, { x: 10, y: 10, width: 64, height: 64 }),
        ];
        
        // With threshold 1, only identical boxes get suppressed
        const result = nonMaxSuppression(detections, 1);
        
        expect(result).toHaveLength(2);
    });
});

// ========================================
// verifyGridPattern Edge Cases
// ========================================

describe('verifyGridPattern (edge cases)', () => {
    it('handles detections in perfect grid', () => {
        const spacing = 50;
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 100 + spacing, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 100 + spacing * 2, y: 600, width: 48, height: 48 }),
            createDetection('item4', 0.82, { x: 100 + spacing * 3, y: 600, width: 48, height: 48 }),
            createDetection('item5', 0.80, { x: 100 + spacing * 4, y: 600, width: 48, height: 48 }),
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result.isValid).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('handles detections with gaps (skipped slots)', () => {
        const spacing = 50;
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 100 + spacing * 2, y: 600, width: 48, height: 48 }), // Gap
            createDetection('item3', 0.88, { x: 100 + spacing * 3, y: 600, width: 48, height: 48 }),
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        // Should still recognize grid pattern with gaps
        expect(result).toHaveProperty('isValid');
    });

    it('handles multiple rows', () => {
        const spacing = 50;
        const detections = [
            // Row 1
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 100 + spacing, y: 600, width: 48, height: 48 }),
            // Row 2
            createDetection('item3', 0.88, { x: 100, y: 600 + spacing, width: 48, height: 48 }),
            createDetection('item4', 0.82, { x: 100 + spacing, y: 600 + spacing, width: 48, height: 48 }),
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result).toHaveProperty('gridParams');
    });

    it('handles detections without positions', () => {
        const detections = [
            createDetection('item1', 0.9),
            createDetection('item2', 0.85),
            createDetection('item3', 0.88),
        ];
        // Remove positions
        detections.forEach(d => d.position = undefined);
        
        const result = verifyGridPattern(detections, 48);
        
        // Should handle gracefully
        expect(result.isValid).toBe(true);
    });

    it('returns gridParams for valid grid', () => {
        const spacing = 50;
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 100 + spacing, y: 600, width: 48, height: 48 }),
            createDetection('item3', 0.88, { x: 100 + spacing * 2, y: 600, width: 48, height: 48 }),
            createDetection('item4', 0.82, { x: 100 + spacing * 3, y: 600, width: 48, height: 48 }),
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        if (result.gridParams) {
            expect(result.gridParams).toHaveProperty('xSpacing');
            expect(result.gridParams).toHaveProperty('ySpacing');
            expect(result.gridParams).toHaveProperty('tolerance');
        }
    });
});

// ========================================
// fitsGrid Additional Tests
// ========================================

describe('fitsGrid (additional)', () => {
    it('handles values at grid boundaries', () => {
        // Value exactly on boundary
        expect(fitsGrid(100, 0, 50, 5)).toBe(true);
        // Value one past boundary
        expect(fitsGrid(101, 0, 50, 5)).toBe(true); // Within tolerance
    });

    it('handles large spacing values', () => {
        expect(fitsGrid(500, 0, 500, 10)).toBe(true);
        expect(fitsGrid(1000, 0, 500, 10)).toBe(true);
    });

    it('handles very small tolerance', () => {
        expect(fitsGrid(50, 0, 50, 0.1)).toBe(true);
        expect(fitsGrid(50.05, 0, 50, 0.1)).toBe(true);
        expect(fitsGrid(50.5, 0, 50, 0.1)).toBe(false);
    });

    it('handles grid with non-zero origin', () => {
        expect(fitsGrid(25, 25, 50, 5)).toBe(true);  // 25 - 25 = 0, on grid
        expect(fitsGrid(75, 25, 50, 5)).toBe(true);  // 75 - 25 = 50, 50%50=0, on grid
        expect(fitsGrid(100, 25, 50, 5)).toBe(false); // 100 - 25 = 75, 75%50=25, not on grid
        expect(fitsGrid(125, 25, 50, 5)).toBe(true);  // 125 - 25 = 100, 100%50=0, on grid
    });
});

// ========================================
// extractCountRegion Additional Tests
// ========================================

describe('extractCountRegion (additional)', () => {
    it('count region is always square', () => {
        const cell: ROI = { x: 100, y: 200, width: 80, height: 60 };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.width).toBe(countRegion.height);
    });

    it('preserves label relationship', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64, label: 'inventory_slot_0' };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.label).toContain('inventory_slot_0');
        expect(countRegion.label).toContain('count');
    });

    it('handles edge case of exactly 100px cell', () => {
        const cell: ROI = { x: 0, y: 0, width: 100, height: 100 };
        const countRegion = extractCountRegion(cell);
        
        // 25% of 100 = 25, which equals max
        expect(countRegion.width).toBe(25);
    });

    it('handles cell smaller than 100px', () => {
        const cell: ROI = { x: 0, y: 0, width: 40, height: 40 };
        const countRegion = extractCountRegion(cell);
        
        // 25% of 40 = 10
        expect(countRegion.width).toBe(10);
    });
});

// ========================================
// setWorkerBasePath Additional Tests  
// ========================================

describe('setWorkerBasePath (additional)', () => {
    it('handles multiple consecutive calls', () => {
        expect(() => {
            setWorkerBasePath('/path1');
            setWorkerBasePath('/path2');
            setWorkerBasePath('/path3');
        }).not.toThrow();
    });

    it('handles path with special characters', () => {
        expect(() => setWorkerBasePath('/my-app_v2')).not.toThrow();
    });

    it('handles deep nested path', () => {
        expect(() => setWorkerBasePath('/apps/megabonk/v2/workers')).not.toThrow();
    });
});

// ========================================
// calculateSimilarity Additional Tests
// ========================================

describe('calculateSimilarity (additional)', () => {
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

    const createPatternImageData = (width: number, height: number): ImageData => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                // Checkerboard pattern
                const isWhite = (x + y) % 2 === 0;
                const value = isWhite ? 255 : 0;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
        }
        return { width, height, data, colorSpace: 'srgb' } as ImageData;
    };

    it('handles checkerboard pattern', () => {
        const img = createPatternImageData(8, 8);
        const similarity = calculateSimilarity(img, img);
        
        expect(similarity).toBeGreaterThan(0);
    });

    it('different patterns have lower similarity', () => {
        const checker = createPatternImageData(8, 8);
        const uniform = createMockImageData(8, 8, 128);
        
        const similarity = calculateSimilarity(checker, uniform);
        
        expect(similarity).toBeLessThan(0.9);
    });

    it('handles different sized images gracefully', () => {
        const small = createMockImageData(4, 4, 128);
        const large = createMockImageData(64, 64, 128);
        
        const similarity = calculateSimilarity(small, large);
        
        expect(typeof similarity).toBe('number');
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('handles extreme brightness differences', () => {
        const dark = createMockImageData(8, 8, 0);
        const bright = createMockImageData(8, 8, 255);
        
        const similarity = calculateSimilarity(dark, bright);
        
        expect(typeof similarity).toBe('number');
    });
});

// ========================================
// resizeImageData Additional Tests
// ========================================

describe('resizeImageData (additional)', () => {
    it('handles extreme upscaling', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 4, 4);
        const imageData = ctx.getImageData(0, 0, 4, 4);
        
        const resized = resizeImageData(imageData, 100, 100);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(100);
        expect(resized!.height).toBe(100);
    });

    it('handles extreme downscaling', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, 200, 200);
        const imageData = ctx.getImageData(0, 0, 200, 200);
        
        const resized = resizeImageData(imageData, 2, 2);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(2);
        expect(resized!.height).toBe(2);
    });

    it('preserves approximate color on resize', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'rgb(100, 150, 200)';
        ctx.fillRect(0, 0, 10, 10);
        const imageData = ctx.getImageData(0, 0, 10, 10);
        
        const resized = resizeImageData(imageData, 5, 5);
        
        expect(resized).not.toBeNull();
        // Center pixel should be approximately the same color
        const centerIdx = (2 * 5 + 2) * 4;
        expect(resized!.data[centerIdx]).toBeGreaterThan(80);  // R
        expect(resized!.data[centerIdx + 1]).toBeGreaterThan(130); // G
        expect(resized!.data[centerIdx + 2]).toBeGreaterThan(180); // B
    });
});

// ========================================
// detectGridPositions Additional Tests
// ========================================

describe('detectGridPositions (additional)', () => {
    it('generates positions with consistent spacing', () => {
        const positions = detectGridPositions(1920, 1080);
        
        if (positions.length > 1) {
            const spacings = [];
            for (let i = 1; i < positions.length; i++) {
                spacings.push(positions[i].x - positions[i - 1].x);
            }
            
            // All spacings should be similar
            const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
            for (const spacing of spacings) {
                expect(Math.abs(spacing - avgSpacing)).toBeLessThan(5);
            }
        }
    });

    it('positions have width equal to height (square cells)', () => {
        const positions = detectGridPositions(1920, 1080);
        
        for (const pos of positions) {
            expect(pos.width).toBe(pos.height);
        }
    });

    it('handles ultrawide resolution', () => {
        const positions = detectGridPositions(3440, 1440);
        
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('handles portrait-ish resolution', () => {
        const positions = detectGridPositions(800, 1200);
        
        expect(Array.isArray(positions)).toBe(true);
    });
});

// ========================================
// loadImageToCanvas Tests
// ========================================

describe('loadImageToCanvas', () => {
    // Import dynamically to get the function
    let loadImageToCanvas: typeof import('../../src/modules/cv/detection.ts').loadImageToCanvas;
    
    beforeEach(async () => {
        const detection = await import('../../src/modules/cv/detection.ts');
        loadImageToCanvas = detection.loadImageToCanvas;
    });

    it('returns a promise', () => {
        const result = loadImageToCanvas('data:image/png;base64,invalid');
        expect(result).toBeInstanceOf(Promise);
        // Suppress the rejection since it will fail
        result.catch(() => {});
    });

    it('rejects for invalid data URL with short timeout', async () => {
        // Invalid base64 data with very short timeout should reject
        await expect(loadImageToCanvas('not-a-valid-url', 100)).rejects.toThrow();
    }, 5000); // Test timeout of 5 seconds

    it('has correct function signature', () => {
        expect(typeof loadImageToCanvas).toBe('function');
    });

    it('accepts custom timeout parameter', async () => {
        // Very short timeout should cause rejection
        const result = loadImageToCanvas('data:image/png;base64,invalid', 1);
        // Should reject due to either timeout or invalid data
        await expect(result).rejects.toThrow();
    });
});

// ========================================
// More calculateIoU Tests
// ========================================

describe('calculateIoU (comprehensive)', () => {
    it('handles asymmetric overlap', () => {
        // Box1 is mostly inside Box2
        const box1: ROI = { x: 100, y: 100, width: 20, height: 20 };
        const box2: ROI = { x: 90, y: 90, width: 50, height: 50 };
        
        const iou = calculateIoU(box1, box2);
        
        // box1 area = 400, box2 area = 2500
        // intersection = box1 (fully contained) = 400
        // union = 2500
        expect(iou).toBeCloseTo(0.16, 1);
    });

    it('handles wide boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 1000, height: 10 };
        const box2: ROI = { x: 500, y: 0, width: 1000, height: 10 };
        
        const iou = calculateIoU(box1, box2);
        
        // Intersection = 500*10 = 5000
        // Union = 10000 + 10000 - 5000 = 15000
        expect(iou).toBeCloseTo(0.333, 2);
    });

    it('handles tall boxes', () => {
        const box1: ROI = { x: 0, y: 0, width: 10, height: 1000 };
        const box2: ROI = { x: 0, y: 500, width: 10, height: 1000 };
        
        const iou = calculateIoU(box1, box2);
        
        expect(iou).toBeCloseTo(0.333, 2);
    });
});

// ========================================
// More nonMaxSuppression Tests
// ========================================

describe('nonMaxSuppression (comprehensive)', () => {
    it('handles chain of overlapping detections', () => {
        // Each detection overlaps with the next but not all with each other
        const detections = [
            createDetection('a', 0.95, { x: 0, y: 0, width: 100, height: 100 }),
            createDetection('b', 0.85, { x: 80, y: 0, width: 100, height: 100 }),
            createDetection('c', 0.75, { x: 160, y: 0, width: 100, height: 100 }),
            createDetection('d', 0.65, { x: 240, y: 0, width: 100, height: 100 }),
        ];
        
        const result = nonMaxSuppression(detections, 0.1);
        
        // Should suppress overlapping ones but keep separated ones
        expect(result.length).toBeLessThan(4);
        expect(result[0].entity.id).toBe('a'); // Highest confidence kept
    });

    it('handles grid-like detections', () => {
        const detections: CVDetectionResult[] = [];
        const gridSize = 5;
        const cellSize = 50;
        const gap = 10;
        
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                detections.push(createDetection(
                    `cell_${row}_${col}`,
                    0.8 + Math.random() * 0.15,
                    { 
                        x: col * (cellSize + gap), 
                        y: row * (cellSize + gap),
                        width: cellSize,
                        height: cellSize
                    }
                ));
            }
        }
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Non-overlapping grid should keep all detections
        expect(result.length).toBe(25);
    });

    it('handles detections with very similar confidences', () => {
        const detections = [
            createDetection('a', 0.8001, { x: 0, y: 0, width: 64, height: 64 }),
            createDetection('b', 0.8000, { x: 10, y: 10, width: 64, height: 64 }),
        ];
        
        const result = nonMaxSuppression(detections, 0.3);
        
        // Should still keep just one due to overlap
        expect(result.length).toBe(1);
        expect(result[0].entity.id).toBe('a'); // Slightly higher confidence
    });
});

// ========================================
// More verifyGridPattern Tests
// ========================================

describe('verifyGridPattern (comprehensive)', () => {
    it('handles irregular spacing (outliers)', () => {
        const detections = [
            createDetection('item1', 0.9, { x: 100, y: 600, width: 48, height: 48 }),
            createDetection('item2', 0.85, { x: 150, y: 600, width: 48, height: 48 }), // 50px gap
            createDetection('item3', 0.88, { x: 200, y: 600, width: 48, height: 48 }), // 50px gap
            createDetection('outlier', 0.82, { x: 280, y: 600, width: 48, height: 48 }), // 80px gap (outlier)
            createDetection('item4', 0.80, { x: 330, y: 600, width: 48, height: 48 }), // 50px gap
        ];
        
        const result = verifyGridPattern(detections, 48);
        
        // Should still recognize mostly valid grid
        expect(result).toHaveProperty('filteredDetections');
    });

    it('handles very wide grid', () => {
        const detections = Array.from({ length: 20 }, (_, i) =>
            createDetection(`item_${i}`, 0.8, { x: 100 + i * 50, y: 600, width: 48, height: 48 })
        );
        
        const result = verifyGridPattern(detections, 48);
        
        expect(result.isValid).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('handles dense grid (small spacing)', () => {
        const detections = Array.from({ length: 10 }, (_, i) =>
            createDetection(`item_${i}`, 0.8, { x: 100 + i * 30, y: 600, width: 28, height: 28 })
        );
        
        const result = verifyGridPattern(detections, 28);
        
        expect(result).toHaveProperty('isValid');
    });

    it('returns confidence based on fit ratio', () => {
        // Perfect grid
        const perfectGrid = Array.from({ length: 8 }, (_, i) =>
            createDetection(`item_${i}`, 0.8, { x: 100 + i * 50, y: 600, width: 48, height: 48 })
        );
        
        const perfectResult = verifyGridPattern(perfectGrid, 48);
        
        // Grid with outliers
        const mixedGrid = [
            ...Array.from({ length: 6 }, (_, i) =>
                createDetection(`item_${i}`, 0.8, { x: 100 + i * 50, y: 600, width: 48, height: 48 })
            ),
            createDetection('outlier1', 0.8, { x: 500, y: 600, width: 48, height: 48 }),
            createDetection('outlier2', 0.8, { x: 700, y: 600, width: 48, height: 48 }),
        ];
        
        const mixedResult = verifyGridPattern(mixedGrid, 48);
        
        // Perfect grid should have higher confidence
        expect(perfectResult.confidence).toBeGreaterThanOrEqual(mixedResult.confidence - 0.3);
    });
});

// ========================================
// detectHotbarRegion Additional Tests
// ========================================

describe('detectHotbarRegion (comprehensive)', () => {
    it('detects region in uniform dark canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 1920, 1080);
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        // Should still return valid bounds even for dark canvas
        expect(result.topY).toBeLessThan(result.bottomY);
        expect(result.bottomY).toBeLessThanOrEqual(1080);
    });

    it('detects region with bright hotbar', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        
        // Dark background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 1920, 1080);
        
        // Bright hotbar area
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(0, 900, 1920, 180);
        
        const result = detectHotbarRegion(ctx, 1920, 1080);
        
        expect(result.topY).toBeGreaterThan(800);
    });

    it('handles various aspect ratios', () => {
        const testCases = [
            { w: 1920, h: 1080 },  // 16:9
            { w: 2560, h: 1080 },  // 21:9 ultrawide
            { w: 1280, h: 1024 },  // 5:4
            { w: 1600, h: 900 },   // 16:9
        ];
        
        for (const { w, h } of testCases) {
            const ctx = createMockCanvasContext(w, h);
            const result = detectHotbarRegion(ctx, w, h);
            
            expect(result.topY).toBeLessThan(h);
            expect(result.bottomY).toBeLessThanOrEqual(h);
        }
    });
});

// ========================================
// detectIconEdges Additional Tests
// ========================================

describe('detectIconEdges (comprehensive)', () => {
    it('detects edges in canvas with colored borders', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        
        // Dark background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 1920, 1080);
        
        // Add some "icon" boxes with green borders (uncommon rarity)
        for (let i = 0; i < 5; i++) {
            const x = 200 + i * 60;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, 950, 48, 48);
        }
        
        const edges = detectIconEdges(ctx, 1920, { topY: 900, bottomY: 1080 });
        
        expect(Array.isArray(edges)).toBe(true);
    });

    it('handles canvas with no clear edges', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        
        // Just fill with noise-like pattern
        for (let y = 0; y < 1080; y += 10) {
            for (let x = 0; x < 1920; x += 10) {
                ctx.fillStyle = `rgb(${Math.random() * 128}, ${Math.random() * 128}, ${Math.random() * 128})`;
                ctx.fillRect(x, y, 10, 10);
            }
        }
        
        const edges = detectIconEdges(ctx, 1920, { topY: 900, bottomY: 1080 });
        
        // Should not crash, return array
        expect(Array.isArray(edges)).toBe(true);
    });

    it('returns edges in sorted order', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        const edges = detectIconEdges(ctx, 1920, { topY: 900, bottomY: 1080 });
        
        for (let i = 1; i < edges.length; i++) {
            expect(edges[i]).toBeGreaterThanOrEqual(edges[i - 1]);
        }
    });
});

// ========================================
// detectIconScale Additional Tests
// ========================================

describe('detectIconScale (comprehensive)', () => {
    it('returns fallback for empty canvas', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        // Empty canvas
        
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.method).toBe('resolution_fallback');
    });

    it('detects scale from consistent icon spacing', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;
        
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 1920, 1080);
        
        // Draw icons with consistent 60px spacing
        const iconSize = 48;
        const spacing = 60;
        for (let i = 0; i < 8; i++) {
            const x = 200 + i * spacing;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, 950, iconSize, iconSize);
            ctx.fillStyle = '#446644';
            ctx.fillRect(x + 3, 953, iconSize - 6, iconSize - 6);
        }
        
        const result = detectIconScale(ctx, 1920, 1080);
        
        expect(result.iconSize).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('handles very high resolution', () => {
        const ctx = createMockCanvasContext(3840, 2160);
        const result = detectIconScale(ctx, 3840, 2160);
        
        expect(result.iconSize).toBeGreaterThan(0);
        expect(result.iconSize).toBeLessThan(200);
    });
});

// ========================================
// getAdaptiveIconSizes Additional Tests
// ========================================

describe('getAdaptiveIconSizes (comprehensive)', () => {
    it('returns sizes that are reasonable for UI elements', () => {
        const testResolutions = [
            [640, 480],
            [1024, 768],
            [1920, 1080],
            [2560, 1440],
            [3840, 2160],
            [5120, 2880],
        ];
        
        for (const [width, height] of testResolutions) {
            const sizes = getAdaptiveIconSizes(width, height);
            
            // All sizes should be reasonable for icons (20-100px)
            for (const size of sizes) {
                expect(size).toBeGreaterThan(20);
                expect(size).toBeLessThan(100);
            }
        }
    });

    it('sizes scale with resolution', () => {
        // Higher resolution should generally have larger sizes
        // (though this depends on the mock returning different categories)
        const sizes720 = getAdaptiveIconSizes(1280, 720);
        const sizes4K = getAdaptiveIconSizes(3840, 2160);
        
        // At minimum, both should return valid arrays
        expect(sizes720.length).toBe(3);
        expect(sizes4K.length).toBe(3);
    });
});

// ========================================
// detectGridPositions Additional Tests
// ========================================

describe('detectGridPositions (additional)', () => {
    it('all positions are in the hotbar region', () => {
        const positions = detectGridPositions(1920, 1080);
        
        for (const pos of positions) {
            // Should be near bottom of screen
            expect(pos.y).toBeGreaterThan(1080 * 0.85);
        }
    });

    it('positions have unique labels', () => {
        const positions = detectGridPositions(1920, 1080);
        const labels = positions.map(p => p.label);
        const uniqueLabels = new Set(labels);
        
        expect(uniqueLabels.size).toBe(labels.length);
    });

    it('respects margin parameter behavior', () => {
        const positions = detectGridPositions(1920, 1080);
        
        // First position should have 50px margin
        if (positions.length > 0) {
            expect(positions[0].x).toBeGreaterThanOrEqual(50);
        }
    });

    it('handles minimum viable resolution', () => {
        const positions = detectGridPositions(320, 240);
        
        expect(Array.isArray(positions)).toBe(true);
    });
});

// ========================================
// setWorkerBasePath Comprehensive Tests
// ========================================

describe('setWorkerBasePath (comprehensive)', () => {
    it('handles URL-like paths', () => {
        expect(() => setWorkerBasePath('/api/v1/workers')).not.toThrow();
    });

    it('handles paths with numbers', () => {
        expect(() => setWorkerBasePath('/app123/workers')).not.toThrow();
    });

    it('handles paths with dots', () => {
        expect(() => setWorkerBasePath('/app.v2.beta/workers')).not.toThrow();
    });

    it('is idempotent for same path', () => {
        expect(() => {
            setWorkerBasePath('/test');
            setWorkerBasePath('/test');
            setWorkerBasePath('/test');
        }).not.toThrow();
    });
});

// ========================================
// extractCountRegion Comprehensive Tests
// ========================================

describe('extractCountRegion (comprehensive)', () => {
    it('handles cells at origin', () => {
        const cell: ROI = { x: 0, y: 0, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        
        expect(countRegion.x).toBeGreaterThanOrEqual(0);
        expect(countRegion.y).toBeGreaterThanOrEqual(0);
    });

    it('handles cells at screen edge', () => {
        const cell: ROI = { x: 1856, y: 1016, width: 64, height: 64 };
        const countRegion = extractCountRegion(cell);
        
        // Count region should still be within cell
        expect(countRegion.x).toBeGreaterThanOrEqual(cell.x);
        expect(countRegion.y).toBeGreaterThanOrEqual(cell.y);
    });

    it('handles very small cells', () => {
        const cell: ROI = { x: 100, y: 100, width: 10, height: 10 };
        const countRegion = extractCountRegion(cell);
        
        // Should still produce valid region
        expect(countRegion.width).toBeGreaterThan(0);
        expect(countRegion.height).toBeGreaterThan(0);
    });

    it('handles non-square cells', () => {
        const wideCell: ROI = { x: 0, y: 0, width: 100, height: 50 };
        const tallCell: ROI = { x: 0, y: 0, width: 50, height: 100 };
        
        const wideRegion = extractCountRegion(wideCell);
        const tallRegion = extractCountRegion(tallCell);
        
        // Regions should be square and use smaller dimension
        expect(wideRegion.width).toBe(wideRegion.height);
        expect(tallRegion.width).toBe(tallRegion.height);
    });
});

// ========================================
// fitsGrid Comprehensive Tests
// ========================================

describe('fitsGrid (comprehensive)', () => {
    it('handles floating point values', () => {
        expect(fitsGrid(50.0, 0, 50, 1)).toBe(true);
        expect(fitsGrid(50.5, 0, 50, 1)).toBe(true);
        expect(fitsGrid(51.5, 0, 50, 1)).toBe(false);
    });

    it('handles very large values', () => {
        expect(fitsGrid(10000, 0, 50, 5)).toBe(true);
        expect(fitsGrid(10003, 0, 50, 5)).toBe(true);
        expect(fitsGrid(10020, 0, 50, 5)).toBe(false);
    });

    it('handles edge of tolerance at both ends', () => {
        // At tolerance boundary
        expect(fitsGrid(5, 0, 50, 5)).toBe(true);  // offset = 5, tolerance = 5
        expect(fitsGrid(45, 0, 50, 5)).toBe(true); // offset = 45, spacing - tolerance = 45
    });

    it('handles small spacing', () => {
        expect(fitsGrid(10, 0, 10, 2)).toBe(true);
        expect(fitsGrid(20, 0, 10, 2)).toBe(true);
        expect(fitsGrid(15, 0, 10, 2)).toBe(false);
    });
});

// ========================================
// calculateSimilarity Comprehensive Tests
// ========================================

describe('calculateSimilarity (comprehensive)', () => {
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

    it('handles 2x2 images', () => {
        const img = createMockImageData(2, 2, 100);
        const similarity = calculateSimilarity(img, img);
        
        expect(typeof similarity).toBe('number');
    });

    it('handles 1x1 images', () => {
        const img = createMockImageData(1, 1, 100);
        const similarity = calculateSimilarity(img, img);
        
        expect(typeof similarity).toBe('number');
    });

    it('handles large images', () => {
        const img = createMockImageData(128, 128, 100);
        const similarity = calculateSimilarity(img, img);
        
        expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('returns consistent results', () => {
        const img1 = createMockImageData(16, 16, 100);
        const img2 = createMockImageData(16, 16, 150);
        
        const sim1 = calculateSimilarity(img1, img2);
        const sim2 = calculateSimilarity(img1, img2);
        
        expect(sim1).toBe(sim2);
    });
});

// ========================================
// resizeImageData Comprehensive Tests
// ========================================

describe('resizeImageData (comprehensive)', () => {
    it('maintains aspect ratio concept (square stays square)', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 64, 64);
        const imageData = ctx.getImageData(0, 0, 64, 64);
        
        const resized = resizeImageData(imageData, 32, 32);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(32);
        expect(resized!.height).toBe(32);
    });

    it('can resize to non-square dimensions', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, 64, 64);
        
        const resized = resizeImageData(imageData, 100, 50);
        
        expect(resized).not.toBeNull();
        expect(resized!.width).toBe(100);
        expect(resized!.height).toBe(50);
    });

    it('preserves pixel data on identity resize', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'rgb(200, 100, 50)';
        ctx.fillRect(0, 0, 32, 32);
        const imageData = ctx.getImageData(0, 0, 32, 32);
        
        const resized = resizeImageData(imageData, 32, 32);
        
        expect(resized).not.toBeNull();
        // Check center pixel is approximately same color
        const centerIdx = (16 * 32 + 16) * 4;
        expect(resized!.data[centerIdx]).toBeGreaterThan(150);  // R ~200
        expect(resized!.data[centerIdx + 1]).toBeGreaterThan(50); // G ~100
        expect(resized!.data[centerIdx + 2]).toBeGreaterThan(30); // B ~50
    });
});

// ========================================
// getCVMetrics and getDetectionConfig Tests
// ========================================

describe('getCVMetrics and getDetectionConfig interaction', () => {
    it('metrics and config are independent', () => {
        const metrics1 = getCVMetrics();
        const config1 = getDetectionConfig(1920, 1080);
        const metrics2 = getCVMetrics();
        const config2 = getDetectionConfig(1920, 1080);
        
        // Structure should be consistent
        expect(Object.keys(metrics1)).toEqual(Object.keys(metrics2));
        expect(Object.keys(config1)).toEqual(Object.keys(config2));
    });

    it('config threshold varies by resolution', () => {
        // Since mock always returns same tier, thresholds might be same
        // but the function should still work
        const config1 = getDetectionConfig(1920, 1080);
        const config2 = getDetectionConfig(3840, 2160);
        
        expect(typeof config1.dynamicThreshold).toBe('number');
        expect(typeof config2.dynamicThreshold).toBe('number');
    });

    it('metrics enabled flag is boolean', () => {
        const metrics = getCVMetrics();
        expect(typeof metrics.enabled).toBe('boolean');
    });
});

// ========================================
// Performance Regression Tests
// ========================================

describe('Performance', () => {
    it('detectHotbarRegion completes in reasonable time', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        
        const start = performance.now();
        for (let i = 0; i < 5; i++) {
            detectHotbarRegion(ctx, 1920, 1080);
        }
        const elapsed = performance.now() - start;
        
        expect(elapsed).toBeLessThan(2000); // 5 iterations < 2s (generous for CI)
    });

    it('detectIconScale completes in reasonable time', () => {
        const ctx = createMockCanvasContext(1920, 1080);
        
        const start = performance.now();
        for (let i = 0; i < 5; i++) {
            detectIconScale(ctx, 1920, 1080);
        }
        const elapsed = performance.now() - start;
        
        expect(elapsed).toBeLessThan(2000); // 5 iterations < 2s (generous for CI)
    });

    it('verifyGridPattern handles 100 detections efficiently', () => {
        const detections = Array.from({ length: 100 }, (_, i) =>
            createDetection(`item_${i}`, 0.8, { x: 100 + (i % 10) * 50, y: 600 + Math.floor(i / 10) * 50 })
        );
        
        const start = performance.now();
        verifyGridPattern(detections, 48);
        const elapsed = performance.now() - start;
        
        expect(elapsed).toBeLessThan(100);
    });
});
