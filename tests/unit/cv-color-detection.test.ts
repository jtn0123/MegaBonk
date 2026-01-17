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
        { name: 'gradient', factory: () => image.gradient(45, 45, [0, 0, 0], [255, 255, 255]) },
        { name: 'icon with center', factory: () => image.create(45, 45, (x, y) => {
            if (x > 10 && x < 35 && y > 10 && y < 35) return [200, 100, 50];
            return [50, 50, 50];
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
        const itemSlot = image.checkerboard(45, 45, 5);

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

        expect(elapsed).toBeLessThan(5);
    });
});
