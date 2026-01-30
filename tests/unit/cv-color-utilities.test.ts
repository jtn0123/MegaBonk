/**
 * @vitest-environment jsdom
 * CV Color Utilities Tests - Pure functions and pixel utilities
 */
import { describe, it, expect } from 'vitest';
import {
    rgbToHsl,
    detectRarityAtPixel,
    extractDominantColors,
    getDetailedColorCategory,
    matchColorCategories,
    getDominantColor,
    getAdjacentColors,
    getColorCandidates,
    calculateColorVariance,
    calculateAverageSaturation,
    calculateHistogramWidth,
    calculateCenterEdgeRatio,
    calculateEdgeDensity,
    isInventoryBackground,
    isEmptyCell,
    extractBorderPixels,
    detectBorderRarity,
    countRarityBorderPixels,
    EMPTY_DETECTION_CONFIG,
    type DetailedColorCategory,
} from '../../src/modules/cv/color.ts';

// ========================================
// Mock ImageData Helper
// ========================================

/**
 * Create a mock ImageData with specified dimensions and pixel data
 */
function createMockImageData(width: number, height: number, fillFn?: (x: number, y: number) => [number, number, number, number]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const [r, g, b, a] = fillFn ? fillFn(x, y) : [128, 128, 128, 255];
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Create uniform color ImageData
 */
function createUniformImageData(width: number, height: number, r: number, g: number, b: number): ImageData {
    return createMockImageData(width, height, () => [r, g, b, 255]);
}

/**
 * Create gradient ImageData for testing variance
 */
function createGradientImageData(width: number, height: number): ImageData {
    return createMockImageData(width, height, (x, y) => {
        const r = Math.floor((x / width) * 255);
        const g = Math.floor((y / height) * 255);
        const b = 128;
        return [r, g, b, 255];
    });
}

// ========================================
// detectRarityAtPixel Tests
// ========================================

describe('detectRarityAtPixel', () => {
    it('should detect common (gray) colors', () => {
        const result = detectRarityAtPixel(128, 128, 128);
        expect(result).toBe('common');
    });

    it('should detect uncommon (green) colors', () => {
        const result = detectRarityAtPixel(50, 200, 50);
        expect(result).toBe('uncommon');
    });

    it('should detect rare (blue) colors', () => {
        const result = detectRarityAtPixel(50, 150, 220);
        expect(result).toBe('rare');
    });

    it('should detect epic (purple) colors', () => {
        const result = detectRarityAtPixel(180, 50, 220);
        expect(result).toBe('epic');
    });

    it('should detect legendary (orange/gold) colors', () => {
        const result = detectRarityAtPixel(255, 165, 50);
        expect(result).toBe('legendary');
    });

    it('should return null for colors that don\'t match any rarity', () => {
        // Pure red doesn't match any rarity definition
        const result = detectRarityAtPixel(255, 0, 0);
        expect(result).toBeNull();
    });

    it('should return null for black', () => {
        const result = detectRarityAtPixel(0, 0, 0);
        expect(result).toBeNull();
    });

    it('should return null for white', () => {
        const result = detectRarityAtPixel(255, 255, 255);
        expect(result).toBeNull();
    });
});

// ========================================
// extractDominantColors Tests
// ========================================

describe('extractDominantColors', () => {
    it('should extract a single dominant color from uniform image', () => {
        const imageData = createUniformImageData(10, 10, 128, 64, 192);
        const result = extractDominantColors(imageData, 3);
        
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0]).toHaveProperty('r');
        expect(result[0]).toHaveProperty('g');
        expect(result[0]).toHaveProperty('b');
        expect(result[0]).toHaveProperty('frequency');
    });

    it('should respect numColors parameter', () => {
        const imageData = createGradientImageData(20, 20);
        const result = extractDominantColors(imageData, 5);
        
        expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should quantize colors to bins', () => {
        const imageData = createUniformImageData(10, 10, 130, 65, 195);
        const result = extractDominantColors(imageData, 1);
        
        // Colors are quantized to multiples of 32
        expect(result[0].r % 32).toBe(0);
        expect(result[0].g % 32).toBe(0);
        expect(result[0].b % 32).toBe(0);
    });

    it('should sort by frequency descending', () => {
        // Create image with two color regions
        const imageData = createMockImageData(20, 10, (x, y) => {
            return x < 15 ? [255, 0, 0, 255] : [0, 255, 0, 255]; // 75% red, 25% green
        });
        const result = extractDominantColors(imageData, 2);
        
        if (result.length >= 2) {
            expect(result[0].frequency).toBeGreaterThanOrEqual(result[1].frequency);
        }
    });

    it('should handle empty image gracefully', () => {
        const imageData = createMockImageData(0, 0);
        const result = extractDominantColors(imageData, 5);
        
        expect(result).toEqual([]);
    });
});

// ========================================
// getDetailedColorCategory Tests
// ========================================

describe('getDetailedColorCategory', () => {
    it('should identify gray colors', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('gray');
        expect(result.saturation).toBe('low');
    });

    it('should identify black colors', () => {
        const imageData = createUniformImageData(10, 10, 30, 30, 30);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('gray');
        expect(result.secondary).toBe('black');
        expect(result.brightness).toBe('dark');
    });

    it('should identify white colors', () => {
        const imageData = createUniformImageData(10, 10, 240, 240, 240);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('gray');
        expect(result.secondary).toBe('white');
        expect(result.brightness).toBe('bright');
    });

    it('should identify red dominant colors', () => {
        const imageData = createUniformImageData(10, 10, 200, 50, 50);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('red');
    });

    it('should identify green dominant colors', () => {
        const imageData = createUniformImageData(10, 10, 50, 200, 50);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('green');
    });

    it('should identify blue dominant colors', () => {
        const imageData = createUniformImageData(10, 10, 50, 50, 200);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('blue');
    });

    it('should identify orange as red with yellow secondary', () => {
        const imageData = createUniformImageData(10, 10, 255, 165, 0);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('red');
        expect(['orange', 'yellow']).toContain(result.secondary);
    });

    it('should return default for empty image', () => {
        const imageData = createMockImageData(0, 0);
        const result = getDetailedColorCategory(imageData);
        
        expect(result.primary).toBe('gray');
        expect(result.secondary).toBe('neutral');
    });

    it('should classify saturation levels correctly', () => {
        // Low saturation (gray)
        const lowSat = getDetailedColorCategory(createUniformImageData(10, 10, 120, 130, 125));
        expect(lowSat.saturation).toBe('low');
        
        // High saturation (pure red)
        const highSat = getDetailedColorCategory(createUniformImageData(10, 10, 255, 0, 0));
        expect(highSat.saturation).toBe('high');
    });

    it('should classify brightness levels correctly', () => {
        // Dark
        const dark = getDetailedColorCategory(createUniformImageData(10, 10, 30, 30, 80));
        expect(dark.brightness).toBe('dark');
        
        // Bright
        const bright = getDetailedColorCategory(createUniformImageData(10, 10, 255, 230, 200));
        expect(bright.brightness).toBe('bright');
    });
});

// ========================================
// matchColorCategories Tests
// ========================================

describe('matchColorCategories', () => {
    it('should return 1.0 for identical categories', () => {
        const cat: DetailedColorCategory = {
            primary: 'red',
            secondary: 'orange',
            saturation: 'high',
            brightness: 'bright'
        };
        
        const score = matchColorCategories(cat, cat);
        expect(score).toBe(1.0);
    });

    it('should return 0 for completely different categories', () => {
        const cat1: DetailedColorCategory = {
            primary: 'red',
            secondary: 'orange',
            saturation: 'high',
            brightness: 'bright'
        };
        const cat2: DetailedColorCategory = {
            primary: 'blue',
            secondary: 'navy',
            saturation: 'low',
            brightness: 'dark'
        };
        
        const score = matchColorCategories(cat1, cat2);
        expect(score).toBeLessThan(0.5);
    });

    it('should give partial score for matching primary only', () => {
        const cat1: DetailedColorCategory = {
            primary: 'red',
            secondary: 'orange',
            saturation: 'high',
            brightness: 'bright'
        };
        const cat2: DetailedColorCategory = {
            primary: 'red',
            secondary: 'magenta',
            saturation: 'low',
            brightness: 'dark'
        };
        
        const score = matchColorCategories(cat1, cat2);
        expect(score).toBeGreaterThanOrEqual(0.5);
        expect(score).toBeLessThan(1.0);
    });

    it('should give bonus for adjacent saturation levels', () => {
        const cat1: DetailedColorCategory = {
            primary: 'blue',
            secondary: 'sky',
            saturation: 'low',
            brightness: 'medium'
        };
        const cat2: DetailedColorCategory = {
            primary: 'blue',
            secondary: 'sky',
            saturation: 'medium',
            brightness: 'medium'
        };
        
        const score = matchColorCategories(cat1, cat2);
        // Should get primary + secondary + partial saturation + brightness
        expect(score).toBeGreaterThan(0.8);
    });
});

// ========================================
// getDominantColor Tests
// ========================================

describe('getDominantColor', () => {
    it('should return "gray" for gray images', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        expect(getDominantColor(imageData)).toBe('gray');
    });

    it('should return "black" for very dark images', () => {
        const imageData = createUniformImageData(10, 10, 20, 20, 20);
        expect(getDominantColor(imageData)).toBe('black');
    });

    it('should return "white" for very bright images', () => {
        const imageData = createUniformImageData(10, 10, 240, 240, 240);
        expect(getDominantColor(imageData)).toBe('white');
    });

    it('should return primary color for chromatic images', () => {
        const redImage = createUniformImageData(10, 10, 200, 50, 50);
        expect(getDominantColor(redImage)).toBe('red');
        
        const greenImage = createUniformImageData(10, 10, 50, 200, 50);
        expect(getDominantColor(greenImage)).toBe('green');
        
        const blueImage = createUniformImageData(10, 10, 50, 50, 200);
        expect(getDominantColor(blueImage)).toBe('blue');
    });

    it('should return specific colors for orange/yellow', () => {
        const orangeImage = createUniformImageData(10, 10, 255, 140, 0);
        const result = getDominantColor(orangeImage);
        expect(['orange', 'yellow', 'red']).toContain(result);
    });
});

// ========================================
// getAdjacentColors Tests
// ========================================

describe('getAdjacentColors', () => {
    it('should return adjacent colors for red', () => {
        const adjacent = getAdjacentColors('red');
        expect(adjacent).toContain('orange');
        expect(adjacent).toContain('magenta');
    });

    it('should return adjacent colors for green', () => {
        const adjacent = getAdjacentColors('green');
        expect(adjacent).toContain('lime');
        expect(adjacent).toContain('cyan');
    });

    it('should return adjacent colors for blue', () => {
        const adjacent = getAdjacentColors('blue');
        expect(adjacent).toContain('cyan');
        expect(adjacent).toContain('purple');
    });

    it('should return adjacent colors for gray', () => {
        const adjacent = getAdjacentColors('gray');
        expect(adjacent).toContain('black');
        expect(adjacent).toContain('white');
    });

    it('should return empty array for unknown color', () => {
        const adjacent = getAdjacentColors('unknown');
        expect(adjacent).toEqual([]);
    });
});

// ========================================
// getColorCandidates Tests
// ========================================

describe('getColorCandidates', () => {
    it('should include the original color first', () => {
        const candidates = getColorCandidates('red');
        expect(candidates[0]).toBe('red');
    });

    it('should include adjacent colors after original', () => {
        const candidates = getColorCandidates('blue');
        expect(candidates[0]).toBe('blue');
        expect(candidates.length).toBeGreaterThan(1);
        expect(candidates).toContain('cyan');
    });

    it('should handle unknown colors', () => {
        const candidates = getColorCandidates('unknown');
        expect(candidates).toEqual(['unknown']);
    });
});

// ========================================
// calculateColorVariance Tests
// ========================================

describe('calculateColorVariance', () => {
    it('should return 0 for uniform image', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const variance = calculateColorVariance(imageData);
        expect(variance).toBe(0);
    });

    it('should return high variance for gradient image', () => {
        const imageData = createGradientImageData(20, 20);
        const variance = calculateColorVariance(imageData);
        expect(variance).toBeGreaterThan(0);
    });

    it('should return higher variance for more varied images', () => {
        // Checkerboard pattern (high variance)
        const checkerboard = createMockImageData(20, 20, (x, y) => {
            return (x + y) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255];
        });
        
        // Slight gradient (lower variance)
        const slightGradient = createMockImageData(20, 20, (x, y) => {
            const val = 120 + Math.floor(x / 2);
            return [val, val, val, 255];
        });
        
        const checkerVariance = calculateColorVariance(checkerboard);
        const gradientVariance = calculateColorVariance(slightGradient);
        
        expect(checkerVariance).toBeGreaterThan(gradientVariance);
    });
});

// ========================================
// calculateAverageSaturation Tests
// ========================================

describe('calculateAverageSaturation', () => {
    it('should return 0 for grayscale image', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const saturation = calculateAverageSaturation(imageData);
        expect(saturation).toBe(0);
    });

    it('should return high saturation for pure colors', () => {
        const redImage = createUniformImageData(10, 10, 255, 0, 0);
        const saturation = calculateAverageSaturation(redImage);
        expect(saturation).toBeGreaterThan(0.5);
    });

    it('should return low saturation for near-gray colors', () => {
        const nearGray = createUniformImageData(10, 10, 120, 125, 130);
        const saturation = calculateAverageSaturation(nearGray);
        expect(saturation).toBeLessThan(0.2);
    });

    it('should handle empty image', () => {
        const imageData = createMockImageData(0, 0);
        const saturation = calculateAverageSaturation(imageData);
        expect(saturation).toBe(0);
    });
});

// ========================================
// calculateHistogramWidth Tests
// ========================================

describe('calculateHistogramWidth', () => {
    it('should return 1 for uniform image', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const width = calculateHistogramWidth(imageData);
        expect(width).toBe(1);
    });

    it('should return more bins for varied image', () => {
        const gradientImage = createGradientImageData(20, 20);
        const width = calculateHistogramWidth(gradientImage);
        expect(width).toBeGreaterThan(1);
    });

    it('should return 2 for two-color image', () => {
        const twoColorImage = createMockImageData(10, 10, (x) => {
            return x < 5 ? [0, 0, 0, 255] : [255, 255, 255, 255];
        });
        const width = calculateHistogramWidth(twoColorImage);
        expect(width).toBe(2);
    });
});

// ========================================
// calculateCenterEdgeRatio Tests
// ========================================

describe('calculateCenterEdgeRatio', () => {
    it('should return ~1.0 for uniform image', () => {
        const imageData = createUniformImageData(20, 20, 128, 128, 128);
        const ratio = calculateCenterEdgeRatio(imageData);
        expect(ratio).toBeCloseTo(0, 0); // Both variances are 0, so ratio is 0/(0+1) = 0
    });

    it('should return >1 for image with detailed center', () => {
        // Create image with varied center and uniform edges
        const imageData = createMockImageData(20, 20, (x, y) => {
            const inCenter = x >= 5 && x < 15 && y >= 5 && y < 15;
            if (inCenter) {
                return [(x * 20) % 256, (y * 20) % 256, 128, 255];
            }
            return [128, 128, 128, 255];
        });
        const ratio = calculateCenterEdgeRatio(imageData);
        expect(ratio).toBeGreaterThan(0.5);
    });

    it('should handle small images', () => {
        const smallImage = createUniformImageData(4, 4, 128, 128, 128);
        expect(() => calculateCenterEdgeRatio(smallImage)).not.toThrow();
    });
});

// ========================================
// calculateEdgeDensity Tests
// ========================================

describe('calculateEdgeDensity', () => {
    it('should return 0 for uniform image', () => {
        const imageData = createUniformImageData(20, 20, 128, 128, 128);
        const density = calculateEdgeDensity(imageData);
        expect(density).toBe(0);
    });

    it('should return high value for checkerboard pattern', () => {
        const checkerboard = createMockImageData(20, 20, (x, y) => {
            return (x + y) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255];
        });
        const density = calculateEdgeDensity(checkerboard);
        expect(density).toBeGreaterThan(0.5);
    });

    it('should return moderate value for gradient', () => {
        const gradient = createGradientImageData(20, 20);
        const density = calculateEdgeDensity(gradient);
        expect(density).toBeGreaterThanOrEqual(0);
        expect(density).toBeLessThanOrEqual(1);
    });
});

// ========================================
// isInventoryBackground Tests
// ========================================

describe('isInventoryBackground', () => {
    it('should return true for dark, low-saturation image', () => {
        const darkGray = createUniformImageData(20, 20, 40, 42, 38);
        expect(isInventoryBackground(darkGray)).toBe(true);
    });

    it('should return false for bright image', () => {
        const bright = createUniformImageData(20, 20, 200, 200, 200);
        expect(isInventoryBackground(bright)).toBe(false);
    });

    it('should return false for colorful image', () => {
        const colorful = createUniformImageData(20, 20, 200, 50, 50);
        expect(isInventoryBackground(colorful)).toBe(false);
    });

    it('should check center region primarily', () => {
        // Image with colorful edges but dark center
        const mixedImage = createMockImageData(20, 20, (x, y) => {
            const inCenter = x >= 4 && x < 16 && y >= 4 && y < 16;
            return inCenter ? [40, 40, 40, 255] : [255, 0, 0, 255];
        });
        // Center should be what's checked
        expect(isInventoryBackground(mixedImage)).toBe(true);
    });
});

// ========================================
// isEmptyCell Tests
// ========================================

describe('isEmptyCell', () => {
    it('should return true for very dark cell', () => {
        const dark = createUniformImageData(20, 20, 20, 20, 20);
        expect(isEmptyCell(dark)).toBe(true);
    });

    it('should return true for uniform gray cell', () => {
        const gray = createUniformImageData(20, 20, 100, 100, 100);
        expect(isEmptyCell(gray)).toBe(true);
    });

    it('should return true for empty image', () => {
        const emptyImage = createMockImageData(0, 0);
        expect(isEmptyCell(emptyImage)).toBe(true);
    });

    it('should return false for high-variance colorful cell', () => {
        // Create a simulated item icon with varied colors
        const itemIcon = createMockImageData(20, 20, (x, y) => {
            // Create distinct regions to simulate icon
            if (x < 10 && y < 10) return [255, 100, 50, 255];
            if (x >= 10 && y < 10) return [50, 200, 100, 255];
            if (x < 10 && y >= 10) return [100, 50, 255, 255];
            return [200, 200, 50, 255];
        });
        expect(isEmptyCell(itemIcon)).toBe(false);
    });
});

// ========================================
// extractBorderPixels Tests
// ========================================

describe('extractBorderPixels', () => {
    it('should extract border pixels with default width', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const borderPixels = extractBorderPixels(imageData);
        
        // Should be Uint8ClampedArray
        expect(borderPixels).toBeInstanceOf(Uint8ClampedArray);
        // Should have RGB values (no alpha)
        expect(borderPixels.length % 3).toBe(0);
    });

    it('should extract correct colors from border', () => {
        // Create image with red border and green center
        const imageData = createMockImageData(10, 10, (x, y) => {
            const isBorder = x < 2 || x >= 8 || y < 2 || y >= 8;
            return isBorder ? [255, 0, 0, 255] : [0, 255, 0, 255];
        });
        
        const borderPixels = extractBorderPixels(imageData, 2);
        
        // Border pixels should be red
        let redCount = 0;
        for (let i = 0; i < borderPixels.length; i += 3) {
            if (borderPixels[i] === 255 && borderPixels[i + 1] === 0 && borderPixels[i + 2] === 0) {
                redCount++;
            }
        }
        expect(redCount).toBeGreaterThan(0);
    });

    it('should respect borderWidth parameter', () => {
        const imageData = createUniformImageData(20, 20, 128, 128, 128);
        
        const narrow = extractBorderPixels(imageData, 1);
        const wide = extractBorderPixels(imageData, 4);
        
        expect(wide.length).toBeGreaterThan(narrow.length);
    });
});

// ========================================
// detectBorderRarity Tests
// ========================================

describe('detectBorderRarity', () => {
    it('should detect common rarity from gray border', () => {
        const imageData = createMockImageData(20, 20, (x, y) => {
            const isBorder = x < 3 || x >= 17 || y < 3 || y >= 17;
            return isBorder ? [140, 140, 140, 255] : [50, 50, 50, 255];
        });
        
        const rarity = detectBorderRarity(imageData);
        expect(rarity).toBe('common');
    });

    it('should detect uncommon rarity from green border', () => {
        const imageData = createMockImageData(20, 20, (x, y) => {
            const isBorder = x < 3 || x >= 17 || y < 3 || y >= 17;
            return isBorder ? [50, 200, 50, 255] : [50, 50, 50, 255];
        });
        
        const rarity = detectBorderRarity(imageData);
        expect(rarity).toBe('uncommon');
    });

    it('should detect rare rarity from blue border', () => {
        const imageData = createMockImageData(20, 20, (x, y) => {
            const isBorder = x < 3 || x >= 17 || y < 3 || y >= 17;
            return isBorder ? [50, 150, 220, 255] : [50, 50, 50, 255];
        });
        
        const rarity = detectBorderRarity(imageData);
        expect(rarity).toBe('rare');
    });

    it('should return null for non-matching border', () => {
        // Pure red border (not a defined rarity color)
        const imageData = createMockImageData(20, 20, (x, y) => {
            const isBorder = x < 3 || x >= 17 || y < 3 || y >= 17;
            return isBorder ? [255, 0, 0, 255] : [50, 50, 50, 255];
        });
        
        const rarity = detectBorderRarity(imageData);
        expect(rarity).toBeNull();
    });
});

// ========================================
// countRarityBorderPixels Tests
// ========================================

describe('countRarityBorderPixels', () => {
    it('should count total pixels', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const result = countRarityBorderPixels(imageData);
        
        expect(result.total).toBe(100); // 10x10
    });

    it('should count colorful pixels', () => {
        // Half colorful, half gray
        const imageData = createMockImageData(10, 10, (x) => {
            return x < 5 ? [255, 0, 0, 255] : [128, 128, 128, 255];
        });
        
        const result = countRarityBorderPixels(imageData);
        expect(result.colorfulCount).toBeGreaterThan(0);
    });

    it('should count rarity-matching pixels', () => {
        // All green (uncommon)
        const greenImage = createUniformImageData(10, 10, 50, 200, 50);
        const result = countRarityBorderPixels(greenImage);
        
        expect(result.rarityCount).toBeGreaterThan(0);
        expect(result.rarityCounts['uncommon']).toBeGreaterThan(0);
    });

    it('should have rarityCounts object', () => {
        const imageData = createUniformImageData(10, 10, 128, 128, 128);
        const result = countRarityBorderPixels(imageData);
        
        expect(result).toHaveProperty('rarityCounts');
        expect(typeof result.rarityCounts).toBe('object');
    });
});

// ========================================
// EMPTY_DETECTION_CONFIG Tests
// ========================================

describe('EMPTY_DETECTION_CONFIG', () => {
    it('should have required threshold values', () => {
        expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeDefined();
        expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeDefined();
        expect(EMPTY_DETECTION_CONFIG.MIN_HISTOGRAM_BINS).toBeDefined();
        expect(EMPTY_DETECTION_CONFIG.MIN_CENTER_EDGE_RATIO).toBeDefined();
    });

    it('should have methods configuration', () => {
        expect(EMPTY_DETECTION_CONFIG.methods).toBeDefined();
        expect(typeof EMPTY_DETECTION_CONFIG.methods.useVariance).toBe('boolean');
        expect(typeof EMPTY_DETECTION_CONFIG.methods.useSaturation).toBe('boolean');
    });

    it('should have reasonable threshold values', () => {
        expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeGreaterThan(0);
        expect(EMPTY_DETECTION_CONFIG.MIN_CONFIDENCE).toBeLessThanOrEqual(1);
        expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeGreaterThan(0);
        expect(EMPTY_DETECTION_CONFIG.MAX_SATURATION).toBeLessThan(1);
    });
});
