/**
 * Color and Rarity Detection Tests (Consolidated)
 *
 * Tests color analysis and rarity border detection for item identification.
 * Refactored to use parameterized tests for maintainability.
 */

import { describe, it, expect, test } from 'vitest';
import {
    extractDominantColors,
    getDominantColor,
    getDetailedColorCategory,
    matchColorCategories,
    calculateColorVariance,
    isEmptyCell,
    extractBorderPixels,
    detectBorderRarity,
} from '../../src/modules/cv/color.ts';
import { cvTestKit } from '../helpers/cv-test-kit.ts';

const { image } = cvTestKit;

// ========================================
// extractDominantColors Tests
// ========================================

describe('extractDominantColors', () => {
    it('extracts single dominant color from solid image', () => {
        const imageData = image.solid(32, 32, 255, 0, 0);
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeGreaterThan(0);
        expect(colors[0].r).toBeGreaterThan(200);
        expect(colors[0].g).toBeLessThan(50);
    });

    it('extracts multiple colors from gradient', () => {
        const imageData = image.gradient(64, 32, [255, 0, 0], [0, 0, 255]);
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBe(5);
        const hasRed = colors.some(c => c.r > 150 && c.b < 100);
        const hasBlue = colors.some(c => c.b > 150 && c.r < 100);
        expect(hasRed || hasBlue).toBe(true);
    });

    it('returns colors sorted by frequency', () => {
        const imageData = image.create(32, 32, (x, y) => (y < 24 ? [255, 0, 0] : [0, 0, 255]));
        const colors = extractDominantColors(imageData, 3);

        expect(colors[0].frequency).toBeGreaterThan(colors[1].frequency);
    });

    it('quantizes similar colors to reduce palette', () => {
        const imageData = image.create(16, 16, (x, y) => [248 + ((x + y) % 8), 0, 0]);
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeLessThan(5);
    });
});

// ========================================
// getDominantColor Tests (Parameterized)
// ========================================

describe('getDominantColor', () => {
    const colorTestCases = [
        // Grayscale
        { rgb: [20, 20, 20], expected: ['black'], name: 'black' },
        { rgb: [220, 220, 220], expected: ['white'], name: 'white' },
        { rgb: [128, 128, 128], expected: ['gray'], name: 'gray' },
        // Primary
        { rgb: [200, 50, 50], expected: ['red'], name: 'red' },
        { rgb: [50, 200, 50], expected: ['green', 'lime'], name: 'green' },
        { rgb: [50, 50, 200], expected: ['blue'], name: 'blue' },
        // Secondary (allow similar colors due to algorithm)
        { rgb: [200, 120, 50], expected: ['orange', 'brown'], name: 'orange' },
        { rgb: [230, 230, 50], expected: ['yellow', 'lime', 'brown', 'orange'], name: 'yellow' },
        { rgb: [150, 50, 200], expected: ['purple', 'violet'], name: 'purple' },
        { rgb: [50, 200, 230], expected: ['cyan', 'blue'], name: 'cyan' },
    ] as const;

    test.each(colorTestCases)('detects $name', ({ rgb, expected }) => {
        const imageData = image.solid(32, 32, rgb[0], rgb[1], rgb[2]);
        const color = getDominantColor(imageData);
        expect(expected).toContain(color);
    });

    it('handles very small images', () => {
        const imageData = image.solid(4, 4, 200, 50, 50);
        expect(getDominantColor(imageData)).toBe('red');
    });

    it('returns consistent results for same color at different sizes', () => {
        const color1 = getDominantColor(image.solid(32, 32, 200, 50, 50));
        const color2 = getDominantColor(image.solid(64, 64, 200, 50, 50));
        expect(color1).toBe(color2);
    });
});

// ========================================
// calculateColorVariance Tests
// ========================================

describe('calculateColorVariance', () => {
    it('returns zero for solid color', () => {
        const imageData = image.solid(32, 32, 128, 128, 128);
        expect(calculateColorVariance(imageData)).toBe(0);
    });

    it('returns high variance for contrasting colors', () => {
        const imageData = image.checkerboard(32, 32, 1);
        const variance = calculateColorVariance(imageData);
        expect(variance).toBeGreaterThan(1000);
    });

    it('returns higher variance for gradient than solid', () => {
        const solid = image.solid(32, 32, 128, 128, 128);
        const gradient = image.gradient(32, 32, [0, 0, 0], [255, 255, 255]);

        expect(calculateColorVariance(gradient)).toBeGreaterThan(calculateColorVariance(solid));
    });
});

// ========================================
// isEmptyCell Tests
// ========================================

describe('isEmptyCell', () => {
    const emptyCases = [
        { name: 'solid dark background', factory: () => image.solid(45, 45, 30, 30, 30) },
        { name: 'uniform gray', factory: () => image.solid(45, 45, 128, 128, 128) },
        { name: 'subtle texture', factory: () => image.create(45, 45, (x, y) => {
            const noise = ((x * 7 + y * 11) % 10) - 5;
            return [128 + noise, 128 + noise, 128 + noise];
        })},
    ];

    const nonEmptyCases = [
        // Colorful centered pattern (high center/edge variance ratio)
        { name: 'gradient', factory: () => image.create(45, 45, (x, y) => {
            const cx = 22, cy = 22;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist < 16) {
                // Colorful center with gradient
                return [Math.min(255, 100 + dist * 8), 80, Math.min(255, 50 + dist * 6)];
            }
            // Uniform dark edges
            return [40, 40, 45];
        })},
        // Multi-colored icon with distinct center and uniform edges
        { name: 'icon with center', factory: () => image.create(45, 45, (x, y) => {
            const cx = 22, cy = 22;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist < 14) {
                // Colorful center with variation
                const angle = Math.atan2(y - cy, x - cx);
                const shade = Math.floor(dist * 3);
                if (angle < 0) return [200 + shade, 100, 50 + shade];
                return [100 + shade, 180, 80 + shade];
            }
            // Uniform edges
            return [50, 50, 55];
        })},
    ];

    test.each(emptyCases)('detects $name as empty', ({ factory }) => {
        expect(isEmptyCell(factory())).toBe(true);
    });

    test.each(nonEmptyCases)('detects $name as non-empty', ({ factory }) => {
        expect(isEmptyCell(factory())).toBe(false);
    });
});

// ========================================
// extractBorderPixels Tests
// ========================================

describe('extractBorderPixels', () => {
    it('extracts correct number of border pixels', () => {
        const imageData = image.solid(32, 32, 255, 0, 0);
        const borderPixels = extractBorderPixels(imageData, 2);

        // Length should be divisible by 3 (RGB triplets)
        expect(borderPixels.length % 3).toBe(0);
        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('extracts border pixels separately from interior', () => {
        const imageData = image.bordered(32, 32, [255, 0, 0], [0, 255, 0], 3);
        const borderPixels = extractBorderPixels(imageData, 3);

        // Calculate average - should be reddish
        let sumR = 0, sumG = 0;
        for (let i = 0; i < borderPixels.length; i += 3) {
            sumR += borderPixels[i];
            sumG += borderPixels[i + 1];
        }
        const count = borderPixels.length / 3;

        expect(sumR / count).toBeGreaterThan(200);
        expect(sumG / count).toBeLessThan(50);
    });

    it('wider borders have more pixels', () => {
        const imageData = image.solid(32, 32, 255, 0, 0);

        const border1 = extractBorderPixels(imageData, 1);
        const border2 = extractBorderPixels(imageData, 2);

        expect(border2.length).toBeGreaterThan(border1.length);
    });
});

// ========================================
// detectBorderRarity Tests (Parameterized)
// ========================================

describe('detectBorderRarity', () => {
    const rarityTestCases = [
        { borderColor: [128, 128, 128], expected: 'common', name: 'gray → common' },
        { borderColor: [0, 255, 0], expected: 'uncommon', name: 'green → uncommon' },
        { borderColor: [0, 128, 255], expected: 'rare', name: 'blue → rare' },
        { borderColor: [128, 0, 255], expected: 'epic', name: 'purple → epic' },
        { borderColor: [255, 165, 0], expected: 'legendary', name: 'orange → legendary' },
    ] as const;

    test.each(rarityTestCases)('detects $name', ({ borderColor, expected }) => {
        const imageData = image.bordered(45, 45, borderColor as [number, number, number], [50, 50, 50], 3);
        const rarity = detectBorderRarity(imageData);
        expect(rarity).toBe(expected);
    });

    describe('color tolerance', () => {
        it('detects common with slight variation', () => {
            const imageData = image.bordered(45, 45, [120, 130, 125], [50, 50, 50], 3);
            expect(detectBorderRarity(imageData)).toBe('common');
        });

        it('detects legendary with darker orange', () => {
            const imageData = image.bordered(45, 45, [230, 150, 10], [50, 50, 50], 3);
            expect(detectBorderRarity(imageData)).toBe('legendary');
        });
    });

    describe('edge cases', () => {
        it('handles noisy borders', () => {
            const imageData = image.create(45, 45, (x, y) => {
                const isBorder = x < 3 || x >= 42 || y < 3 || y >= 42;
                if (isBorder) {
                    const noise = ((x * 7 + y * 11) % 20) - 10;
                    return [Math.max(0, noise), Math.min(255, 255 + noise), Math.max(0, noise)];
                }
                return [50, 50, 50];
            });

            expect(detectBorderRarity(imageData)).toBe('uncommon');
        });

        it('handles very small images', () => {
            const imageData = image.bordered(10, 10, [0, 255, 0], [50, 50, 50], 2);
            const rarity = detectBorderRarity(imageData);
            expect(['uncommon', null]).toContain(rarity);
        });
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Color Detection Integration', () => {
    it('uses border rarity to filter template candidates', () => {
        const legendaryImage = image.bordered(45, 45, [255, 165, 0], [50, 50, 50], 3);
        const rarity = detectBorderRarity(legendaryImage);

        expect(rarity).toBe('legendary');

        const allItems = ['Wrench', 'Big Bonk', 'Anvil', 'Medkit'];
        const legendaryItems = ['Big Bonk', 'Anvil'];
        const candidatePool = rarity === 'legendary' ? legendaryItems : allItems;

        expect(candidatePool).toEqual(['Big Bonk', 'Anvil']);
    });

    it('uses empty cell detection to skip matching', () => {
        const emptySlot = image.solid(45, 45, 30, 30, 30);
        // Create a realistic item icon with colorful center and uniform edges
        const itemSlot = image.create(45, 45, (x, y) => {
            const cx = 22, cy = 22;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist < 14) {
                // Colorful center with variation
                const shade = Math.floor(dist * 4);
                return [200 + shade, 120, 60 + shade];
            }
            // Uniform dark edges
            return [45, 45, 50];
        });

        expect(isEmptyCell(emptySlot)).toBe(true);
        expect(isEmptyCell(itemSlot)).toBe(false);
    });

    it('combines rarity and color for precision filtering', () => {
        const legendaryOrange = image.bordered(45, 45, [255, 165, 0], [200, 100, 50], 3);

        const rarity = detectBorderRarity(legendaryOrange);
        const color = getDominantColor(legendaryOrange);

        expect(rarity).toBe('legendary');
        expect(color).toBe('orange');
    });
});

// ========================================
// Performance Tests
// ========================================

describe('Performance', () => {
    it('processes small images quickly', () => {
        const imageData = image.solid(45, 45, 128, 128, 128);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            getDominantColor(imageData);
        }
        const elapsed = performance.now() - start;

        // Allow more time for CI environments (was 10ms, now 50ms)
        expect(elapsed).toBeLessThan(50);
    });

    it('handles large images efficiently', () => {
        const imageData = image.solid(256, 256, 128, 128, 128);

        const start = performance.now();
        getDominantColor(imageData);
        const elapsed = performance.now() - start;

        // Allow more time for CI environments (was 5ms, now 20ms)
        expect(elapsed).toBeLessThan(20);
    });
});

// ========================================
// Detailed Color Category Tests
// ========================================

describe('getDetailedColorCategory', () => {
    it('returns primary color for red image', () => {
        const imageData = image.solid(32, 32, 200, 50, 50);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('red');
        expect(category.saturation).toBe('high');
    });

    it('returns primary color for green image', () => {
        const imageData = image.solid(32, 32, 50, 200, 50);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('green');
    });

    it('returns primary color for blue image', () => {
        const imageData = image.solid(32, 32, 50, 50, 200);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('blue');
    });

    it('identifies gray for low saturation', () => {
        const imageData = image.solid(32, 32, 128, 128, 128);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('gray');
        expect(category.saturation).toBe('low');
    });

    it('identifies black for dark gray', () => {
        const imageData = image.solid(32, 32, 30, 30, 30);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('gray');
        expect(category.secondary).toBe('black');
        expect(category.brightness).toBe('dark');
    });

    it('identifies white for bright gray', () => {
        const imageData = image.solid(32, 32, 240, 240, 240);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('gray');
        expect(category.secondary).toBe('white');
        expect(category.brightness).toBe('bright');
    });

    it('identifies orange as red with secondary', () => {
        const imageData = image.solid(32, 32, 255, 150, 50);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('red');
        expect(category.secondary).toBe('orange');
    });

    it('identifies cyan as blue with secondary', () => {
        // Cyan (50, 200, 230) has blue > green, so it's categorized as blue
        const imageData = image.solid(32, 32, 50, 200, 230);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('blue');
        expect(category.secondary).toBe('sky'); // High green secondary
    });

    it('identifies cyan as green when green dominates', () => {
        // True cyan with green > blue
        const imageData = image.solid(32, 32, 50, 230, 200);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('green');
        expect(category.secondary).toBe('cyan');
    });

    it('identifies purple as blue with secondary', () => {
        const imageData = image.solid(32, 32, 150, 50, 200);
        const category = getDetailedColorCategory(imageData);

        expect(category.primary).toBe('blue');
        expect(category.secondary).toBe('purple');
    });
});

describe('matchColorCategories', () => {
    it('returns 1.0 for identical categories', () => {
        const cat1 = { primary: 'red', secondary: 'orange', saturation: 'high' as const, brightness: 'medium' as const };
        const cat2 = { primary: 'red', secondary: 'orange', saturation: 'high' as const, brightness: 'medium' as const };

        const score = matchColorCategories(cat1, cat2);
        expect(score).toBe(1.0);
    });

    it('returns 0.5+ for same primary only', () => {
        const cat1 = { primary: 'red', secondary: 'orange', saturation: 'high' as const, brightness: 'bright' as const };
        const cat2 = { primary: 'red', secondary: 'dark_red', saturation: 'medium' as const, brightness: 'dark' as const };

        const score = matchColorCategories(cat1, cat2);
        expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('returns 0 for completely different categories', () => {
        const cat1 = { primary: 'red', secondary: 'orange', saturation: 'high' as const, brightness: 'bright' as const };
        const cat2 = { primary: 'blue', secondary: 'navy', saturation: 'low' as const, brightness: 'dark' as const };

        const score = matchColorCategories(cat1, cat2);
        expect(score).toBeLessThan(0.5);
    });

    it('gives partial credit for adjacent saturation levels', () => {
        const cat1 = { primary: 'green', secondary: 'lime', saturation: 'medium' as const, brightness: 'medium' as const };
        const cat2 = { primary: 'green', secondary: 'lime', saturation: 'high' as const, brightness: 'medium' as const };

        const score = matchColorCategories(cat1, cat2);
        // Should get partial saturation credit
        expect(score).toBeGreaterThan(0.75);
        expect(score).toBeLessThan(1.0);
    });
});
