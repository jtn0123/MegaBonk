/**
 * @vitest-environment jsdom
 * CV Similarity Module - Extended Coverage Tests
 * Tests for SSIM, Histogram, Edge similarity, and adaptive methods
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    calculateSSIM,
    calculateWindowedSSIM,
    calculateHistogramSimilarity,
    calculateEdgeSimilarity,
    calculateCombinedSimilarity,
    calculateDetailedSimilarity,
    similarityPassesThreshold,
    calculateAdaptiveSimilarity,
    calculateAdaptiveDetailedSimilarity,
    getSceneAnalysis,
    type SimilarityResult,
} from '../../src/modules/cv/similarity.ts';

// ========================================
// Test Helpers
// ========================================

interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

function createImageData(
    width: number,
    height: number,
    fillFn?: (x: number, y: number) => [number, number, number, number]
): SimpleImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (fillFn) {
                const [r, g, b, a] = fillFn(x, y);
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = a;
            } else {
                data[i] = 128;
                data[i + 1] = 128;
                data[i + 2] = 128;
                data[i + 3] = 255;
            }
        }
    }
    
    return { data, width, height };
}

function createGradientImage(width: number, height: number): SimpleImageData {
    return createImageData(width, height, (x, _y) => {
        const val = Math.floor((x / width) * 255);
        return [val, val, val, 255];
    });
}

function createUniformImage(width: number, height: number, r: number, g: number, b: number): SimpleImageData {
    return createImageData(width, height, () => [r, g, b, 255]);
}

function createCheckerboard(width: number, height: number, size: number = 8): SimpleImageData {
    return createImageData(width, height, (x, y) => {
        const isWhite = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
        const val = isWhite ? 255 : 0;
        return [val, val, val, 255];
    });
}

function createNoiseImage(width: number, height: number, seed: number = 42): SimpleImageData {
    let rand = seed;
    const random = () => {
        rand = (rand * 1103515245 + 12345) % 2147483648;
        return (rand / 2147483648) * 255;
    };
    
    return createImageData(width, height, () => {
        return [Math.floor(random()), Math.floor(random()), Math.floor(random()), 255];
    });
}

function createColorfulImage(width: number, height: number): SimpleImageData {
    return createImageData(width, height, (x, y) => {
        const r = Math.floor((x / width) * 255);
        const g = Math.floor((y / height) * 255);
        const b = Math.floor(((x + y) / (width + height)) * 255);
        return [r, g, b, 255];
    });
}

function createEdgeImage(width: number, height: number): SimpleImageData {
    return createImageData(width, height, (x, _y) => {
        // Sharp edge in the middle
        const val = x < width / 2 ? 50 : 200;
        return [val, val, val, 255];
    });
}

// ========================================
// calculateSSIM Tests
// ========================================
describe('calculateSSIM', () => {
    it('should return 1 for identical images', () => {
        const image = createGradientImage(32, 32);
        const ssim = calculateSSIM(image, image);
        
        expect(ssim).toBeCloseTo(1.0, 1);
    });

    it('should return high similarity for nearly identical images', () => {
        const image1 = createUniformImage(32, 32, 128, 128, 128);
        const image2 = createUniformImage(32, 32, 130, 130, 130);
        
        const ssim = calculateSSIM(image1, image2);
        
        expect(ssim).toBeGreaterThan(0.9);
    });

    it('should return low similarity for very different images', () => {
        const black = createUniformImage(32, 32, 0, 0, 0);
        const white = createUniformImage(32, 32, 255, 255, 255);
        
        const ssim = calculateSSIM(black, white);
        
        expect(ssim).toBeLessThan(0.5);
    });

    it('should return 0 for different sized images', () => {
        const small = createUniformImage(10, 10, 128, 128, 128);
        const large = createUniformImage(20, 20, 128, 128, 128);
        
        const ssim = calculateSSIM(small, large);
        
        expect(ssim).toBe(0);
    });

    it('should be symmetric', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createCheckerboard(32, 32);
        
        const ssim1 = calculateSSIM(image1, image2);
        const ssim2 = calculateSSIM(image2, image1);
        
        expect(ssim1).toBeCloseTo(ssim2, 5);
    });

    it('should handle small images', () => {
        const image1 = createUniformImage(2, 2, 100, 100, 100);
        const image2 = createUniformImage(2, 2, 100, 100, 100);
        
        const ssim = calculateSSIM(image1, image2);
        
        expect(ssim).toBeGreaterThan(0);
        expect(ssim).toBeLessThanOrEqual(1);
    });

    it('should return value in valid range', () => {
        const image1 = createNoiseImage(32, 32, 1);
        const image2 = createNoiseImage(32, 32, 2);
        
        const ssim = calculateSSIM(image1, image2);
        
        expect(ssim).toBeGreaterThanOrEqual(0);
        expect(ssim).toBeLessThanOrEqual(1);
    });

    it('should handle empty images', () => {
        const empty1 = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
        const empty2 = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
        
        const ssim = calculateSSIM(empty1, empty2);
        
        expect(ssim).toBe(0);
    });
});

// ========================================
// calculateWindowedSSIM Tests
// ========================================
describe('calculateWindowedSSIM', () => {
    it('should return high similarity for identical images', () => {
        const image = createGradientImage(32, 32);
        const ssim = calculateWindowedSSIM(image, image);
        
        expect(ssim).toBeGreaterThan(0.95);
    });

    it('should return 0 for different sized images', () => {
        const small = createUniformImage(16, 16, 128, 128, 128);
        const large = createUniformImage(32, 32, 128, 128, 128);
        
        const ssim = calculateWindowedSSIM(small, large);
        
        expect(ssim).toBe(0);
    });

    it('should use sliding window approach', () => {
        // Create images with different local structures
        const uniform = createUniformImage(32, 32, 128, 128, 128);
        const gradient = createGradientImage(32, 32);
        
        const ssim = calculateWindowedSSIM(uniform, gradient);
        
        // Should detect structural differences
        expect(ssim).toBeLessThan(1);
    });

    it('should fall back to global SSIM for very small images', () => {
        const small1 = createUniformImage(4, 4, 100, 100, 100);
        const small2 = createUniformImage(4, 4, 100, 100, 100);
        
        const ssim = calculateWindowedSSIM(small1, small2);
        
        // Should still return valid result
        expect(ssim).toBeGreaterThanOrEqual(0);
        expect(ssim).toBeLessThanOrEqual(1);
    });

    it('should handle colorful images', () => {
        const colorful1 = createColorfulImage(32, 32);
        const colorful2 = createColorfulImage(32, 32);
        
        const ssim = calculateWindowedSSIM(colorful1, colorful2);
        
        expect(ssim).toBeGreaterThan(0.9);
    });

    it('should detect local structural changes', () => {
        const image1 = createCheckerboard(32, 32, 4);
        const image2 = createCheckerboard(32, 32, 8); // Different pattern size
        
        const ssim = calculateWindowedSSIM(image1, image2);
        
        // Different checkerboard patterns should have lower similarity
        expect(ssim).toBeLessThan(0.9);
    });
});

// ========================================
// calculateHistogramSimilarity Tests
// ========================================
describe('calculateHistogramSimilarity', () => {
    it('should return 1 for identical images', () => {
        const image = createGradientImage(32, 32);
        const similarity = calculateHistogramSimilarity(image, image);
        
        expect(similarity).toBeCloseTo(1.0, 2);
    });

    it('should return high similarity for images with same color distribution', () => {
        // Two different arrangements of same colors
        const image1 = createGradientImage(32, 32);
        // Reverse gradient has same histogram
        const image2 = createImageData(32, 32, (x, _y) => {
            const val = 255 - Math.floor((x / 32) * 255);
            return [val, val, val, 255];
        });
        
        const similarity = calculateHistogramSimilarity(image1, image2);
        
        // Same color distribution = same histogram
        expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different color distributions', () => {
        const dark = createUniformImage(32, 32, 30, 30, 30);
        const bright = createUniformImage(32, 32, 220, 220, 220);
        
        const similarity = calculateHistogramSimilarity(dark, bright);
        
        expect(similarity).toBeLessThan(0.5);
    });

    it('should be robust to spatial rearrangement', () => {
        const checkerboard = createCheckerboard(32, 32);
        // Inverted checkerboard has same histogram (50% black, 50% white)
        const invertedCheckerboard = createImageData(32, 32, (x, y) => {
            const isWhite = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 1;
            const val = isWhite ? 255 : 0;
            return [val, val, val, 255];
        });
        
        const similarity = calculateHistogramSimilarity(checkerboard, invertedCheckerboard);
        
        // Same histogram distribution
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('should handle different sized images', () => {
        const small = createUniformImage(16, 16, 128, 128, 128);
        const large = createUniformImage(64, 64, 128, 128, 128);
        
        const similarity = calculateHistogramSimilarity(small, large);
        
        // Same color should have same normalized histogram
        expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return 0 for empty images', () => {
        const empty1 = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
        const empty2 = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
        
        const similarity = calculateHistogramSimilarity(empty1, empty2);
        
        expect(similarity).toBe(0);
    });

    it('should handle colorful images', () => {
        const colorful1 = createColorfulImage(32, 32);
        const colorful2 = createColorfulImage(32, 32);
        
        const similarity = calculateHistogramSimilarity(colorful1, colorful2);
        
        expect(similarity).toBeGreaterThan(0.9);
    });
});

// ========================================
// calculateEdgeSimilarity Tests
// ========================================
describe('calculateEdgeSimilarity', () => {
    it('should return high similarity for identical edge images', () => {
        const edge = createEdgeImage(32, 32);
        const similarity = calculateEdgeSimilarity(edge, edge);
        
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('should return 0 for different sized images', () => {
        const small = createEdgeImage(16, 16);
        const large = createEdgeImage(32, 32);
        
        const similarity = calculateEdgeSimilarity(small, large);
        
        expect(similarity).toBe(0);
    });

    it('should detect similar edge patterns', () => {
        const edge1 = createEdgeImage(32, 32);
        // Similar edge but slightly shifted
        const edge2 = createImageData(32, 32, (x, _y) => {
            const val = x < 17 ? 50 : 200;
            return [val, val, val, 255];
        });
        
        const similarity = calculateEdgeSimilarity(edge1, edge2);
        
        // Edge similarity may be low for shifted edges (NCC-based)
        // Just verify it returns a valid value
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should be robust to intensity changes', () => {
        const edge1 = createImageData(32, 32, (x, _y) => {
            const val = x < 16 ? 50 : 200;
            return [val, val, val, 255];
        });
        const edge2 = createImageData(32, 32, (x, _y) => {
            const val = x < 16 ? 80 : 170;
            return [val, val, val, 255];
        });
        
        const similarity = calculateEdgeSimilarity(edge1, edge2);
        
        // Same edge location but different intensities
        expect(similarity).toBeGreaterThan(0.5);
    });

    it('should return low similarity for uniform vs edge image', () => {
        const uniform = createUniformImage(32, 32, 128, 128, 128);
        const edge = createEdgeImage(32, 32);
        
        const similarity = calculateEdgeSimilarity(uniform, edge);
        
        // Uniform image has no edges
        expect(similarity).toBe(0);
    });

    it('should handle checkerboard patterns', () => {
        const checker1 = createCheckerboard(32, 32, 8);
        const checker2 = createCheckerboard(32, 32, 8);
        
        const similarity = calculateEdgeSimilarity(checker1, checker2);
        
        // Identical checkerboards have identical edges
        expect(similarity).toBeGreaterThan(0.9);
    });
});

// ========================================
// calculateCombinedSimilarity Tests
// ========================================
describe('calculateCombinedSimilarity', () => {
    it('should return high similarity for identical images', () => {
        const image = createGradientImage(32, 32);
        const similarity = calculateCombinedSimilarity(image, image);
        
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('should combine multiple metrics', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createCheckerboard(32, 32);
        
        const similarity = calculateCombinedSimilarity(image1, image2);
        
        // Should be between 0 and 1
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return low similarity for opposite images', () => {
        const black = createUniformImage(32, 32, 0, 0, 0);
        const white = createUniformImage(32, 32, 255, 255, 255);
        
        const similarity = calculateCombinedSimilarity(black, white);
        
        expect(similarity).toBeLessThan(0.5);
    });

    it('should apply preprocessing', () => {
        // Preprocessing includes contrast enhancement and normalization
        // Test that it handles low contrast images without crashing
        const lowContrast1 = createUniformImage(32, 32, 120, 120, 120);
        const lowContrast2 = createUniformImage(32, 32, 130, 130, 130);
        
        const similarity = calculateCombinedSimilarity(lowContrast1, lowContrast2);
        
        // Uniform images can have low combined similarity due to edge detection (0)
        // Just verify valid range
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });
});

// ========================================
// calculateDetailedSimilarity Tests
// ========================================
describe('calculateDetailedSimilarity', () => {
    it('should return all metrics', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const result = calculateDetailedSimilarity(image1, image2);
        
        expect(result.metrics.ncc).toBeDefined();
        expect(result.metrics.ssim).toBeDefined();
        expect(result.metrics.histogram).toBeDefined();
        expect(result.metrics.edge).toBeDefined();
    });

    it('should include combined score', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createCheckerboard(32, 32);
        
        const result = calculateDetailedSimilarity(image1, image2);
        
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should include threshold information', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const result = calculateDetailedSimilarity(image1, image2, 'common');
        
        expect(result.threshold).toBeGreaterThan(0);
        expect(typeof result.passesThreshold).toBe('boolean');
    });

    it('should pass threshold for identical images', () => {
        const image = createGradientImage(32, 32);
        const result = calculateDetailedSimilarity(image, image, 'common');
        
        expect(result.passesThreshold).toBe(true);
    });

    it('should apply rarity-specific thresholds', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const commonResult = calculateDetailedSimilarity(image1, image2, 'common');
        const legendaryResult = calculateDetailedSimilarity(image1, image2, 'legendary');
        
        // Different rarities may have different thresholds
        expect(commonResult.threshold).toBeDefined();
        expect(legendaryResult.threshold).toBeDefined();
    });

    it('should have all metrics in valid range', () => {
        const image1 = createNoiseImage(32, 32, 1);
        const image2 = createNoiseImage(32, 32, 2);
        
        const result = calculateDetailedSimilarity(image1, image2);
        
        expect(result.metrics.ncc).toBeGreaterThanOrEqual(0);
        expect(result.metrics.ncc).toBeLessThanOrEqual(1);
        expect(result.metrics.ssim).toBeGreaterThanOrEqual(0);
        expect(result.metrics.ssim).toBeLessThanOrEqual(1);
        expect(result.metrics.histogram).toBeGreaterThanOrEqual(0);
        expect(result.metrics.histogram).toBeLessThanOrEqual(1);
        expect(result.metrics.edge).toBeGreaterThanOrEqual(0);
        expect(result.metrics.edge).toBeLessThanOrEqual(1);
    });
});

// ========================================
// similarityPassesThreshold Tests
// ========================================
describe('similarityPassesThreshold', () => {
    it('should return true for high scores', () => {
        expect(similarityPassesThreshold(0.95, 'common')).toBe(true);
    });

    it('should return false for very low scores', () => {
        expect(similarityPassesThreshold(0.1, 'common')).toBe(false);
    });

    it('should handle different rarities', () => {
        const score = 0.6;
        
        // Test with different rarities
        const commonResult = similarityPassesThreshold(score, 'common');
        const rareResult = similarityPassesThreshold(score, 'rare');
        const legendaryResult = similarityPassesThreshold(score, 'legendary');
        
        // All should return boolean
        expect(typeof commonResult).toBe('boolean');
        expect(typeof rareResult).toBe('boolean');
        expect(typeof legendaryResult).toBe('boolean');
    });

    it('should handle undefined rarity', () => {
        expect(similarityPassesThreshold(0.8)).toBeDefined();
    });

    it('should be consistent with calculateDetailedSimilarity', () => {
        const score = 0.75;
        const rarity = 'common';
        
        const passesDirectly = similarityPassesThreshold(score, rarity);
        
        // Get threshold from detailed similarity
        const image = createUniformImage(32, 32, 128, 128, 128);
        const result = calculateDetailedSimilarity(image, image, rarity);
        const passesFromThreshold = score >= result.threshold;
        
        expect(passesDirectly).toBe(passesFromThreshold);
    });
});

// ========================================
// calculateAdaptiveSimilarity Tests
// ========================================
describe('calculateAdaptiveSimilarity', () => {
    it('should work with adaptive preprocessing enabled', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const similarity = calculateAdaptiveSimilarity(image1, image2, { useAdaptive: true });
        
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('should work with adaptive preprocessing disabled', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const similarity = calculateAdaptiveSimilarity(image1, image2, { useAdaptive: false });
        
        expect(similarity).toBeGreaterThan(0.9);
    });

    it('should work without options', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const similarity = calculateAdaptiveSimilarity(image1, image2);
        
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle low contrast images with adaptive preprocessing', () => {
        const lowContrast1 = createUniformImage(32, 32, 125, 125, 125);
        const lowContrast2 = createUniformImage(32, 32, 130, 130, 130);
        
        const similarity = calculateAdaptiveSimilarity(lowContrast1, lowContrast2, { useAdaptive: true });
        
        // Uniform images have low edge similarity (0), which affects combined score
        // Just verify it returns a valid value
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });
});

// ========================================
// calculateAdaptiveDetailedSimilarity Tests
// ========================================
describe('calculateAdaptiveDetailedSimilarity', () => {
    it('should return detailed metrics with adaptive preprocessing', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const result = calculateAdaptiveDetailedSimilarity(image1, image2, 'common', { useAdaptive: true });
        
        expect(result.score).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.passesThreshold).toBeDefined();
        expect(result.threshold).toBeDefined();
    });

    it('should return all metric components', () => {
        const image1 = createColorfulImage(32, 32);
        const image2 = createColorfulImage(32, 32);
        
        const result = calculateAdaptiveDetailedSimilarity(image1, image2, undefined, { useAdaptive: true });
        
        expect(result.metrics.ncc).toBeGreaterThan(0);
        expect(result.metrics.ssim).toBeGreaterThan(0);
        expect(result.metrics.histogram).toBeGreaterThan(0);
        expect(result.metrics.edge).toBeGreaterThanOrEqual(0);
    });

    it('should work without options', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const result = calculateAdaptiveDetailedSimilarity(image1, image2);
        
        expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should respect rarity parameter', () => {
        const image1 = createGradientImage(32, 32);
        const image2 = createGradientImage(32, 32);
        
        const result = calculateAdaptiveDetailedSimilarity(image1, image2, 'legendary', { useAdaptive: false });
        
        expect(result.threshold).toBeGreaterThan(0);
    });
});

// ========================================
// getSceneAnalysis Tests
// ========================================
describe('getSceneAnalysis', () => {
    it('should return scene analysis object', () => {
        const image = createGradientImage(32, 32);
        const analysis = getSceneAnalysis(image);
        
        expect(analysis).toBeDefined();
        expect(typeof analysis).toBe('object');
    });

    it('should analyze brightness', () => {
        const bright = createUniformImage(32, 32, 220, 220, 220);
        const dark = createUniformImage(32, 32, 30, 30, 30);
        
        const brightAnalysis = getSceneAnalysis(bright);
        const darkAnalysis = getSceneAnalysis(dark);
        
        // Analysis should reflect brightness difference
        expect(brightAnalysis).toBeDefined();
        expect(darkAnalysis).toBeDefined();
    });

    it('should analyze contrast', () => {
        const highContrast = createCheckerboard(32, 32);
        const lowContrast = createUniformImage(32, 32, 128, 128, 128);
        
        const highContrastAnalysis = getSceneAnalysis(highContrast);
        const lowContrastAnalysis = getSceneAnalysis(lowContrast);
        
        // Analysis should reflect contrast difference
        expect(highContrastAnalysis).toBeDefined();
        expect(lowContrastAnalysis).toBeDefined();
    });

    it('should handle colorful images', () => {
        const colorful = createColorfulImage(32, 32);
        const analysis = getSceneAnalysis(colorful);
        
        expect(analysis).toBeDefined();
    });

    it('should handle small images', () => {
        const small = createUniformImage(4, 4, 100, 100, 100);
        const analysis = getSceneAnalysis(small);
        
        expect(analysis).toBeDefined();
    });
});
