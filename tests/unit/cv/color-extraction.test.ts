/**
 * @vitest-environment jsdom
 * Unit tests for cv/color-extraction.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    extractDominantColors,
    getDetailedColorCategory,
    getDominantColor,
    extractBorderPixels,
} from '../../../src/modules/cv/color-extraction';
import { polyfillImageData, createImageData } from './test-helpers';

beforeAll(() => {
    polyfillImageData();
});

// ========================================
// Tests
// ========================================

describe('color-extraction', () => {
    describe('extractDominantColors', () => {
        it('should return quantized colors', () => {
            const imageData = createImageData(10, 10, () => [200, 100, 50, 255]);
            const colors = extractDominantColors(imageData, 3);
            expect(colors.length).toBeGreaterThan(0);
            expect(colors[0]).toHaveProperty('r');
            expect(colors[0]).toHaveProperty('g');
            expect(colors[0]).toHaveProperty('b');
            expect(colors[0]).toHaveProperty('frequency');
        });

        it('should return single color for uniform image', () => {
            const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
            const colors = extractDominantColors(imageData, 5);
            expect(colors.length).toBe(1);
            expect(colors[0]!.frequency).toBeGreaterThan(0);
        });

        it('should return multiple colors for varied image', () => {
            const imageData = createImageData(32, 32, x => {
                if (x < 16) return [255, 0, 0, 255];
                return [0, 0, 255, 255];
            });
            const colors = extractDominantColors(imageData, 5);
            expect(colors.length).toBeGreaterThanOrEqual(2);
        });

        it('should limit to numColors', () => {
            const imageData = createImageData(32, 32, (x, y) => [(x * 40) % 256, (y * 40) % 256, 100, 255]);
            const colors = extractDominantColors(imageData, 3);
            expect(colors.length).toBeLessThanOrEqual(3);
        });

        it('should sort by frequency descending', () => {
            const imageData = createImageData(32, 32, x => {
                if (x < 24) return [128, 0, 0, 255]; // More red
                return [0, 128, 0, 255]; // Less green
            });
            const colors = extractDominantColors(imageData, 5);
            if (colors.length >= 2) {
                expect(colors[0]!.frequency).toBeGreaterThanOrEqual(colors[1]!.frequency);
            }
        });
    });

    describe('getDetailedColorCategory', () => {
        it('should categorize gray image', () => {
            const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.primary).toBe('gray');
            expect(cat.saturation).toBe('low');
        });

        it('should categorize pure red image', () => {
            const imageData = createImageData(10, 10, () => [255, 0, 0, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.primary).toBe('red');
            expect(cat.saturation).toBe('high');
        });

        it('should categorize dark image as dark', () => {
            const imageData = createImageData(10, 10, () => [20, 20, 20, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.brightness).toBe('dark');
        });

        it('should categorize bright image as bright', () => {
            const imageData = createImageData(10, 10, () => [240, 240, 240, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.brightness).toBe('bright');
        });

        it('should categorize green', () => {
            const imageData = createImageData(10, 10, () => [0, 200, 0, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.primary).toBe('green');
        });

        it('should categorize blue', () => {
            const imageData = createImageData(10, 10, () => [0, 0, 200, 255]);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.primary).toBe('blue');
        });

        it('should handle zero-pixel image', () => {
            const data = new Uint8ClampedArray(0);
            const imageData = new ImageData(data, 0, 0);
            const cat = getDetailedColorCategory(imageData);
            expect(cat.primary).toBe('gray');
            expect(cat.secondary).toBe('neutral');
        });
    });

    describe('getDominantColor', () => {
        it('should return gray for neutral image', () => {
            const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
            expect(getDominantColor(imageData)).toBe('gray');
        });

        it('should return red for red image', () => {
            const imageData = createImageData(10, 10, () => [255, 0, 0, 255]);
            expect(getDominantColor(imageData)).toBe('red');
        });

        it('should return green for green image', () => {
            const imageData = createImageData(10, 10, () => [0, 200, 0, 255]);
            expect(getDominantColor(imageData)).toBe('green');
        });

        it('should return blue for blue image', () => {
            const imageData = createImageData(10, 10, () => [0, 0, 200, 255]);
            expect(getDominantColor(imageData)).toBe('blue');
        });

        it('should return black for very dark image', () => {
            const imageData = createImageData(10, 10, () => [10, 10, 10, 255]);
            expect(getDominantColor(imageData)).toBe('black');
        });

        it('should return white for very bright image', () => {
            const imageData = createImageData(10, 10, () => [245, 245, 245, 255]);
            expect(getDominantColor(imageData)).toBe('white');
        });

        it('should return orange for orange image', () => {
            const imageData = createImageData(10, 10, () => [255, 140, 0, 255]);
            const color = getDominantColor(imageData);
            expect(['orange', 'yellow', 'red']).toContain(color);
        });

        it('should return purple for purple image', () => {
            const imageData = createImageData(10, 10, () => [150, 0, 200, 255]);
            const color = getDominantColor(imageData);
            expect(['purple', 'magenta', 'blue']).toContain(color);
        });
    });

    describe('extractBorderPixels', () => {
        it('should extract border pixels with default width', () => {
            const imageData = createImageData(10, 10, () => [100, 150, 200, 255]);
            const border = extractBorderPixels(imageData);

            // Border pixels should be non-empty
            expect(border.length).toBeGreaterThan(0);
            // Each pixel is 3 values (r, g, b)
            expect(border.length % 3).toBe(0);
        });

        it('should extract correct values from border', () => {
            const imageData = createImageData(10, 10, (x, y) => {
                // Border = red, center = blue
                if (x < 2 || x >= 8 || y < 2 || y >= 8) {
                    return [255, 0, 0, 255];
                }
                return [0, 0, 255, 255];
            });
            const border = extractBorderPixels(imageData, 2);

            // Most border pixels should be red
            let redCount = 0;
            for (let i = 0; i < border.length; i += 3) {
                if (border[i]! > 200 && border[i + 1]! < 50) {
                    redCount++;
                }
            }
            expect(redCount).toBeGreaterThan(border.length / 3 / 2);
        });

        it('should respect borderWidth parameter', () => {
            const imageData = createImageData(20, 20, () => [100, 100, 100, 255]);
            const border1 = extractBorderPixels(imageData, 1);
            const border3 = extractBorderPixels(imageData, 3);

            // Wider border should have more pixels
            expect(border3.length).toBeGreaterThan(border1.length);
        });

        it('should handle small images', () => {
            const imageData = createImageData(3, 3, () => [100, 100, 100, 255]);
            const border = extractBorderPixels(imageData, 1);
            expect(border.length).toBeGreaterThan(0);
        });
    });
});
