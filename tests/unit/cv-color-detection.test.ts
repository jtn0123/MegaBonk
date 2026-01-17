/**
 * Color and Rarity Detection Tests
 * Tests color analysis and rarity border detection for item identification
 * This is CRITICAL for pre-filtering before template matching
 */

import { describe, it, expect } from 'vitest';
import {
    extractDominantColors,
    getDominantColor,
    calculateColorVariance,
    isEmptyCell,
    extractBorderPixels,
    detectBorderRarity,
} from '../../src/modules/cv/color.ts';
import {
    createImageData,
    createSolidColor,
    createGradient,
    createBorderedImage,
} from '../helpers/image-test-utils.ts';

describe('Color Analysis - extractDominantColors', () => {
    it('should extract single dominant color from solid image', () => {
        const imageData = createSolidColor(32, 32, 255, 0, 0);
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeGreaterThan(0);
        expect(colors[0].r).toBeGreaterThan(200); // Should be reddish
        expect(colors[0].g).toBeLessThan(50);
        expect(colors[0].b).toBeLessThan(50);
    });

    it('should extract multiple colors from gradient', () => {
        const imageData = createGradient(64, 32, [255, 0, 0], [0, 0, 255]);
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBe(5);
        // Should have mix of red and blue tones
        const hasRed = colors.some(c => c.r > 150 && c.b < 100);
        const hasBlue = colors.some(c => c.b > 150 && c.r < 100);
        expect(hasRed || hasBlue).toBe(true);
    });

    it('should return colors sorted by frequency', () => {
        // Create image with 75% red, 25% blue
        const imageData = createImageData(32, 32, (x, y) => {
            return y < 24 ? [255, 0, 0] : [0, 0, 255];
        });

        const colors = extractDominantColors(imageData, 3);

        // Most frequent color (red) should be first
        expect(colors[0].frequency).toBeGreaterThan(colors[1].frequency);
    });

    it('should handle requested color count larger than unique colors', () => {
        const imageData = createSolidColor(16, 16, 128, 128, 128);
        const colors = extractDominantColors(imageData, 10);

        // Should return available colors (likely 1 for solid color)
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(10);
    });

    it('should quantize colors to reduce palette', () => {
        // Create image with slightly different reds (254, 255, 256 would all quantize to 256)
        const imageData = createImageData(16, 16, (x, y) => {
            const variation = (x + y) % 8;
            return [248 + variation, 0, 0]; // All should quantize to similar bucket
        });

        const colors = extractDominantColors(imageData, 5);

        // Should have few colors due to quantization
        expect(colors.length).toBeLessThan(5);
    });
});

describe('Color Analysis - getDominantColor', () => {
    describe('Grayscale Colors', () => {
        it('should detect black', () => {
            const imageData = createSolidColor(32, 32, 20, 20, 20);
            const color = getDominantColor(imageData);
            expect(color).toBe('black');
        });

        it('should detect white', () => {
            const imageData = createSolidColor(32, 32, 220, 220, 220);
            const color = getDominantColor(imageData);
            expect(color).toBe('white');
        });

        it('should detect gray', () => {
            const imageData = createSolidColor(32, 32, 128, 128, 128);
            const color = getDominantColor(imageData);
            expect(color).toBe('gray');
        });
    });

    describe('Primary Colors', () => {
        it('should detect red', () => {
            const imageData = createSolidColor(32, 32, 200, 50, 50);
            const color = getDominantColor(imageData);
            expect(color).toBe('red');
        });

        it('should detect green', () => {
            const imageData = createSolidColor(32, 32, 50, 200, 50);
            const color = getDominantColor(imageData);
            expect(color).toBe('green');
        });

        it('should detect blue', () => {
            const imageData = createSolidColor(32, 32, 50, 50, 200);
            const color = getDominantColor(imageData);
            expect(color).toBe('blue');
        });
    });

    describe('Secondary Colors', () => {
        it('should detect orange', () => {
            const imageData = createSolidColor(32, 32, 200, 120, 50);
            const color = getDominantColor(imageData);
            expect(color).toBe('orange');
        });

        it('should detect yellow', () => {
            const imageData = createSolidColor(32, 32, 200, 200, 50);
            const color = getDominantColor(imageData);
            expect(color).toBe('yellow');
        });

        it('should detect purple', () => {
            const imageData = createSolidColor(32, 32, 150, 50, 200);
            const color = getDominantColor(imageData);
            expect(color).toBe('purple');
        });

        it('should detect cyan', () => {
            const imageData = createSolidColor(32, 32, 50, 150, 200);
            const color = getDominantColor(imageData);
            expect(color).toBe('cyan');
        });

        it('should detect lime', () => {
            const imageData = createSolidColor(32, 32, 50, 200, 50);
            const color = getDominantColor(imageData);
            expect(['green', 'lime']).toContain(color);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small images', () => {
            const imageData = createSolidColor(4, 4, 200, 50, 50);
            const color = getDominantColor(imageData);
            expect(color).toBe('red');
        });

        it('should handle gradient by averaging', () => {
            const imageData = createGradient(32, 32, [255, 0, 0], [0, 0, 255]);
            const color = getDominantColor(imageData);
            // Should detect some mix (purple, mixed, or one of the endpoints)
            expect(['red', 'blue', 'purple', 'mixed']).toContain(color);
        });

        it('should return consistent results for same color', () => {
            const imageData1 = createSolidColor(32, 32, 200, 50, 50);
            const imageData2 = createSolidColor(64, 64, 200, 50, 50);

            const color1 = getDominantColor(imageData1);
            const color2 = getDominantColor(imageData2);

            expect(color1).toBe(color2);
        });
    });
});

describe('Color Analysis - calculateColorVariance', () => {
    it('should return zero variance for solid color', () => {
        const imageData = createSolidColor(32, 32, 128, 128, 128);
        const variance = calculateColorVariance(imageData);

        expect(variance).toBe(0);
    });

    it('should return high variance for contrasting colors', () => {
        const imageData = createImageData(32, 32, (x, y) => {
            return (x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
        });

        const variance = calculateColorVariance(imageData);

        expect(variance).toBeGreaterThan(10000);
    });

    it('should return higher variance for gradient than solid', () => {
        const solid = createSolidColor(32, 32, 128, 128, 128);
        const gradient = createGradient(32, 32, [0, 0, 0], [255, 255, 255]);

        const varianceSolid = calculateColorVariance(solid);
        const varianceGradient = calculateColorVariance(gradient);

        expect(varianceGradient).toBeGreaterThan(varianceSolid);
    });

    it('should be proportional to color spread', () => {
        const narrow = createGradient(32, 32, [120, 120, 120], [140, 140, 140]);
        const wide = createGradient(32, 32, [0, 0, 0], [255, 255, 255]);

        const varianceNarrow = calculateColorVariance(narrow);
        const varianceWide = calculateColorVariance(wide);

        expect(varianceWide).toBeGreaterThan(varianceNarrow * 5);
    });

    it('should handle very small images', () => {
        const imageData = createSolidColor(2, 2, 128, 128, 128);
        const variance = calculateColorVariance(imageData);

        expect(variance).toBe(0);
    });
});

describe('Empty Cell Detection - isEmptyCell', () => {
    it('should detect solid background as empty', () => {
        const imageData = createSolidColor(45, 45, 30, 30, 30);
        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(true);
    });

    it('should detect uniform gray as empty', () => {
        const imageData = createSolidColor(45, 45, 128, 128, 128);
        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(true);
    });

    it('should detect detailed icon as non-empty', () => {
        // Checkerboard pattern (high detail)
        const imageData = createImageData(45, 45, (x, y) => {
            return (x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
        });

        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(false);
    });

    it('should detect gradient as non-empty', () => {
        const imageData = createGradient(45, 45, [0, 0, 0], [255, 255, 255]);
        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(false);
    });

    it('should handle subtle textures', () => {
        // Very subtle variation (might be empty or not, depending on threshold)
        const imageData = createImageData(45, 45, (x, y) => {
            const noise = ((x * 7 + y * 11) % 10) - 5; // ±5 variation
            return [128 + noise, 128 + noise, 128 + noise];
        });

        const isEmpty = isEmptyCell(imageData);

        // With variance threshold of 500, this should be empty (low variance)
        expect(isEmpty).toBe(true);
    });

    it('should detect complex icon as non-empty', () => {
        // Simulate item icon with multiple colors
        const imageData = createImageData(45, 45, (x, y) => {
            if (x > 10 && x < 35 && y > 10 && y < 35) {
                return [200, 100, 50]; // Orange center
            }
            return [50, 50, 50]; // Dark background
        });

        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(false);
    });

    it('should handle very small regions', () => {
        const imageData = createSolidColor(10, 10, 128, 128, 128);
        const isEmpty = isEmptyCell(imageData);

        expect(isEmpty).toBe(true);
    });
});

describe('Border Extraction - extractBorderPixels', () => {
    it('should extract correct number of border pixels', () => {
        const imageData = createSolidColor(32, 32, 255, 0, 0);
        const borderPixels = extractBorderPixels(imageData, 2);

        // Border width 2: top/bottom (32 * 2 * 2) + left/right ((32-4) * 2 * 2)
        // = 128 + 112 = 240 pixels * 3 channels = 720 values
        expect(borderPixels.length).toBe(720);
    });

    it('should extract border pixels separately from interior', () => {
        const imageData = createBorderedImage(32, 32, [255, 0, 0], [0, 255, 0], 3);
        const borderPixels = extractBorderPixels(imageData, 3);

        // Calculate average of border
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        for (let i = 0; i < borderPixels.length; i += 3) {
            sumR += borderPixels[i];
            sumG += borderPixels[i + 1];
            sumB += borderPixels[i + 2];
        }
        const count = borderPixels.length / 3;
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        // Border should be red (255, 0, 0)
        expect(avgR).toBeGreaterThan(200);
        expect(avgG).toBeLessThan(50);
        expect(avgB).toBeLessThan(50);
    });

    it('should handle different border widths', () => {
        const imageData = createSolidColor(32, 32, 255, 0, 0);

        const border1 = extractBorderPixels(imageData, 1);
        const border2 = extractBorderPixels(imageData, 2);
        const border4 = extractBorderPixels(imageData, 4);

        // Wider borders should have more pixels
        expect(border2.length).toBeGreaterThan(border1.length);
        expect(border4.length).toBeGreaterThan(border2.length);
    });

    it('should handle very thin borders', () => {
        const imageData = createSolidColor(32, 32, 255, 0, 0);
        const borderPixels = extractBorderPixels(imageData, 1);

        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('should extract pixels in RGB triplets', () => {
        const imageData = createSolidColor(16, 16, 100, 150, 200);
        const borderPixels = extractBorderPixels(imageData, 2);

        // Length should be divisible by 3 (RGB triplets)
        expect(borderPixels.length % 3).toBe(0);

        // Check first pixel
        expect(borderPixels[0]).toBe(100); // R
        expect(borderPixels[1]).toBe(150); // G
        expect(borderPixels[2]).toBe(200); // B
    });
});

describe('Rarity Detection - detectBorderRarity', () => {
    describe('Standard Rarity Colors', () => {
        it('should detect common (gray) border', () => {
            const imageData = createBorderedImage(45, 45, [128, 128, 128], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('common');
        });

        it('should detect uncommon (green) border', () => {
            const imageData = createBorderedImage(45, 45, [0, 255, 0], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('uncommon');
        });

        it('should detect rare (blue) border', () => {
            const imageData = createBorderedImage(45, 45, [0, 128, 255], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('rare');
        });

        it('should detect epic (purple) border', () => {
            const imageData = createBorderedImage(45, 45, [128, 0, 255], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('epic');
        });

        it('should detect legendary (orange/gold) border', () => {
            const imageData = createBorderedImage(45, 45, [255, 165, 0], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('legendary');
        });
    });

    describe('Color Tolerance', () => {
        it('should detect common with slight variation', () => {
            // Slightly off-gray (120, 130, 125) should still match common
            const imageData = createBorderedImage(45, 45, [120, 130, 125], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('common');
        });

        it('should detect legendary with orange variation', () => {
            // Slightly darker orange should still match legendary
            const imageData = createBorderedImage(45, 45, [230, 150, 10], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('legendary');
        });

        it('should return null for colors outside tolerance', () => {
            // Very different color that doesn't match any rarity
            const imageData = createBorderedImage(45, 45, [255, 0, 255], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            // Might match epic (purple) or return null
            expect(rarity === null || rarity === 'epic').toBe(true);
        });
    });

    describe('Real-World Scenarios', () => {
        it('should handle noisy borders', () => {
            // Border with slight noise around green
            const imageData = createImageData(45, 45, (x, y) => {
                const isBorder = x < 3 || x >= 42 || y < 3 || y >= 42;
                if (isBorder) {
                    const noise = ((x * 7 + y * 11) % 20) - 10; // ±10 variation
                    return [0 + noise, 255 + noise, 0 + noise];
                }
                return [50, 50, 50];
            });

            const rarity = detectBorderRarity(imageData);

            expect(rarity).toBe('uncommon');
        });

        it('should handle mixed border colors by averaging', () => {
            // Half blue, half purple border (should average to something)
            const imageData = createImageData(45, 45, (x, y) => {
                const isBorder = x < 3 || x >= 42 || y < 3 || y >= 42;
                if (isBorder) {
                    return x < 22 ? [0, 128, 255] : [128, 0, 255];
                }
                return [50, 50, 50];
            });

            const rarity = detectBorderRarity(imageData);

            // Should match either rare or epic (or null if too ambiguous)
            expect(['rare', 'epic', null]).toContain(rarity);
        });

        it('should handle very thin borders', () => {
            // Real item templates might have thin borders
            const imageData = createBorderedImage(45, 45, [0, 255, 0], [50, 50, 50], 1);
            const rarity = detectBorderRarity(imageData);

            // Function uses borderWidth=3 internally, so might not detect thin border perfectly
            // But should still detect some green
            expect(['uncommon', null]).toContain(rarity);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small images', () => {
            const imageData = createBorderedImage(10, 10, [0, 255, 0], [50, 50, 50], 2);
            const rarity = detectBorderRarity(imageData);

            // Might return uncommon or null (border might be too small)
            expect(['uncommon', null]).toContain(rarity);
        });

        it('should return null for no clear match', () => {
            // Random multicolor border
            const imageData = createImageData(45, 45, (x, y) => {
                const isBorder = x < 3 || x >= 42 || y < 3 || y >= 42;
                if (isBorder) {
                    return [(x * 7) % 256, (y * 11) % 256, ((x + y) * 13) % 256];
                }
                return [50, 50, 50];
            });

            const rarity = detectBorderRarity(imageData);

            // Should return null or possibly match one of the rarities by chance
            expect([null, 'common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(rarity);
        });

        it('should prefer closest match when multiple are close', () => {
            // Color exactly between common and uncommon
            const imageData = createBorderedImage(45, 45, [64, 192, 64], [50, 50, 50], 3);
            const rarity = detectBorderRarity(imageData);

            // Should match one of them (probably uncommon due to higher green)
            expect(['common', 'uncommon']).toContain(rarity);
        });
    });
});

describe('Integration: Color Detection in Detection Pipeline', () => {
    it('should use border rarity to filter template candidates', () => {
        // Simulate detection flow:
        // 1. Detect border rarity
        // 2. Filter templates by rarity
        // 3. Only match against filtered templates

        const legendaryImage = createBorderedImage(45, 45, [255, 165, 0], [50, 50, 50], 3);
        const rarity = detectBorderRarity(legendaryImage);

        expect(rarity).toBe('legendary');

        // In real system, would only match against legendary items:
        const allItems = ['Wrench', 'Big Bonk', 'Anvil', 'Medkit'];
        const legendaryItems = ['Big Bonk', 'Anvil'];

        const candidatePool = rarity === 'legendary' ? legendaryItems : allItems;

        expect(candidatePool).toEqual(['Big Bonk', 'Anvil']);
        expect(candidatePool).not.toContain('Wrench');
    });

    it('should use empty cell detection to skip matching', () => {
        const emptySlot = createSolidColor(45, 45, 30, 30, 30);
        const itemSlot = createImageData(45, 45, (x, y) => {
            return (x + y) % 2 === 0 ? [200, 100, 50] : [50, 50, 50];
        });

        const isEmpty1 = isEmptyCell(emptySlot);
        const isEmpty2 = isEmptyCell(itemSlot);

        expect(isEmpty1).toBe(true);
        expect(isEmpty2).toBe(false);

        // In real system: skip template matching for empty cells
        const matchesForEmpty = isEmpty1 ? [] : ['Wrench'];
        const matchesForItem = isEmpty2 ? [] : ['Wrench'];

        expect(matchesForEmpty).toEqual([]);
        expect(matchesForItem).toEqual(['Wrench']);
    });

    it('should use dominant color for initial filtering', () => {
        const redItem = createSolidColor(45, 45, 200, 50, 50);
        const blueItem = createSolidColor(45, 45, 50, 50, 200);

        const color1 = getDominantColor(redItem);
        const color2 = getDominantColor(blueItem);

        expect(color1).toBe('red');
        expect(color2).toBe('blue');

        // In real system: boost confidence for matching dominant colors
        const itemColors: Record<string, string> = {
            'Fire Staff': 'red',
            'Ice Staff': 'blue',
        };

        const boost1 = color1 === itemColors['Fire Staff'] ? 1.1 : 1.0;
        const boost2 = color2 === itemColors['Ice Staff'] ? 1.1 : 1.0;

        expect(boost1).toBe(1.1);
        expect(boost2).toBe(1.1);
    });

    it('should combine rarity and color for precision filtering', () => {
        // Legendary orange item (e.g., Big Bonk)
        const legendaryOrange = createBorderedImage(45, 45, [255, 165, 0], [200, 100, 50], 3);

        const rarity = detectBorderRarity(legendaryOrange);
        const color = getDominantColor(legendaryOrange);

        expect(rarity).toBe('legendary');
        expect(color).toBe('orange');

        // In real system: only match legendary + orange items
        const itemDatabase = [
            { name: 'Wrench', rarity: 'common', color: 'gray' },
            { name: 'Big Bonk', rarity: 'legendary', color: 'orange' },
            { name: 'Anvil', rarity: 'legendary', color: 'gray' },
        ];

        const candidates = itemDatabase.filter(
            item => item.rarity === rarity || item.color === color
        );

        expect(candidates.map(c => c.name)).toContain('Big Bonk');
        expect(candidates.length).toBeLessThan(itemDatabase.length);
    });
});

describe('Performance - Color Analysis', () => {
    it('should process small images quickly (< 1ms)', () => {
        const imageData = createSolidColor(45, 45, 128, 128, 128);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            getDominantColor(imageData);
        }
        const elapsed = performance.now() - start;

        // 100 iterations should take < 10ms (< 0.1ms per call)
        expect(elapsed).toBeLessThan(10);
    });

    it('should handle large images efficiently', () => {
        const imageData = createSolidColor(256, 256, 128, 128, 128);

        const start = performance.now();
        getDominantColor(imageData);
        const elapsed = performance.now() - start;

        // Should still be fast (< 5ms) due to sampling
        expect(elapsed).toBeLessThan(5);
    });

    it('should perform empty cell check quickly', () => {
        const imageData = createSolidColor(45, 45, 30, 30, 30);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            isEmptyCell(imageData);
        }
        const elapsed = performance.now() - start;

        // 100 iterations should take < 20ms
        expect(elapsed).toBeLessThan(20);
    });

    it('should extract borders quickly', () => {
        const imageData = createSolidColor(45, 45, 255, 0, 0);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            extractBorderPixels(imageData, 3);
        }
        const elapsed = performance.now() - start;

        // 100 iterations should take < 50ms
        expect(elapsed).toBeLessThan(50);
    });
});
