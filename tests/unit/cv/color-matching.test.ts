/**
 * @vitest-environment jsdom
 * Unit tests for cv/color-matching.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    matchesRarityColor,
    detectRarityAtPixel,
    matchColorCategories,
    isInventoryBackground,
    isEmptyCell,
    detectBorderRarity,
    countRarityBorderPixels,
} from '../../../src/modules/cv/color-matching';
import type { DetailedColorCategory } from '../../../src/modules/cv/color-extraction';
import { polyfillImageData, createImageData } from './test-helpers';

beforeAll(() => { polyfillImageData(); });

// ========================================
// Tests
// ========================================

describe('color-matching', () => {
    describe('matchesRarityColor', () => {
        it('should match green pixels as uncommon', () => {
            // Bright green: RGB(0, 200, 0)
            expect(matchesRarityColor(0, 200, 0, 'uncommon')).toBe(true);
        });

        it('should match blue pixels as rare', () => {
            // Blue: RGB(50, 100, 220)
            expect(matchesRarityColor(50, 100, 220, 'rare')).toBe(true);
        });

        it('should match orange pixels as legendary', () => {
            // Orange/gold: RGB(255, 165, 0)
            expect(matchesRarityColor(255, 165, 0, 'legendary')).toBe(true);
        });

        it('should reject non-matching colors', () => {
            // Pure red should not match uncommon (green)
            expect(matchesRarityColor(255, 0, 0, 'uncommon')).toBe(false);
        });

        it('should return false for unknown rarity', () => {
            expect(matchesRarityColor(128, 128, 128, 'mythical')).toBe(false);
        });

        it('should match gray as common', () => {
            expect(matchesRarityColor(150, 150, 150, 'common')).toBe(true);
        });

        it('should match purple as epic', () => {
            expect(matchesRarityColor(170, 50, 220, 'epic')).toBe(true);
        });
    });

    describe('detectRarityAtPixel', () => {
        it('should detect uncommon from green pixel', () => {
            expect(detectRarityAtPixel(0, 200, 0)).toBe('uncommon');
        });

        it('should return null for non-rarity color', () => {
            // Pure white isn't a rarity
            expect(detectRarityAtPixel(255, 255, 255)).toBeNull();
        });

        it('should return null for pure black', () => {
            expect(detectRarityAtPixel(0, 0, 0)).toBeNull();
        });
    });

    describe('matchColorCategories', () => {
        it('should return 1.0 for identical categories', () => {
            const cat: DetailedColorCategory = {
                primary: 'red',
                secondary: 'bright_red',
                saturation: 'high',
                brightness: 'bright',
            };
            expect(matchColorCategories(cat, cat)).toBe(1.0);
        });

        it('should return 0 for completely different categories', () => {
            const cat1: DetailedColorCategory = {
                primary: 'red',
                secondary: 'bright_red',
                saturation: 'high',
                brightness: 'bright',
            };
            const cat2: DetailedColorCategory = {
                primary: 'blue',
                secondary: 'navy',
                saturation: 'low',
                brightness: 'dark',
            };
            expect(matchColorCategories(cat1, cat2)).toBe(0);
        });

        it('should give partial score for matching primary only', () => {
            const cat1: DetailedColorCategory = {
                primary: 'green',
                secondary: 'lime',
                saturation: 'high',
                brightness: 'bright',
            };
            const cat2: DetailedColorCategory = {
                primary: 'green',
                secondary: 'forest',
                saturation: 'low',
                brightness: 'dark',
            };
            const score = matchColorCategories(cat1, cat2);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1);
        });

        it('should give bonus for adjacent saturation levels', () => {
            const cat1: DetailedColorCategory = {
                primary: 'blue',
                secondary: 'navy',
                saturation: 'low',
                brightness: 'dark',
            };
            const cat2: DetailedColorCategory = {
                primary: 'blue',
                secondary: 'navy',
                saturation: 'medium',
                brightness: 'dark',
            };
            const score = matchColorCategories(cat1, cat2);
            expect(score).toBeGreaterThan(0.5); // primary + secondary + adjacent saturation + brightness
        });
    });

    describe('isInventoryBackground', () => {
        it('should detect dark low-saturation background', () => {
            const imageData = createImageData(20, 20, () => [30, 30, 30, 255]);
            expect(isInventoryBackground(imageData)).toBe(true);
        });

        it('should reject colorful image', () => {
            const imageData = createImageData(20, 20, () => [255, 0, 0, 255]);
            expect(isInventoryBackground(imageData)).toBe(false);
        });

        it('should reject bright image', () => {
            const imageData = createImageData(20, 20, () => [200, 200, 200, 255]);
            expect(isInventoryBackground(imageData)).toBe(false);
        });
    });

    describe('isEmptyCell', () => {
        it('should detect very dark cell as empty', () => {
            const imageData = createImageData(20, 20, () => [10, 10, 10, 255]);
            expect(isEmptyCell(imageData)).toBe(true);
        });

        it('should detect uniform gray cell as empty', () => {
            const imageData = createImageData(20, 20, () => [80, 80, 80, 255]);
            expect(isEmptyCell(imageData)).toBe(true);
        });

        it('should not detect colorful varied image as empty', () => {
            const imageData = createImageData(40, 40, (x, y) => [
                (x * 20) % 256,
                (y * 20) % 256,
                ((x + y) * 15) % 256,
                255,
            ]);
            expect(isEmptyCell(imageData)).toBe(false);
        });

        it('should handle zero-pixel image', () => {
            const data = new Uint8ClampedArray(0);
            const imageData = new ImageData(data, 0, 0);
            expect(isEmptyCell(imageData)).toBe(true);
        });
    });

    describe('detectBorderRarity', () => {
        it('should classify uniform gray border as common or null', () => {
            const imageData = createImageData(20, 20, () => [200, 200, 200, 255]);
            const rarity = detectBorderRarity(imageData);
            expect([null, 'common']).toContain(rarity);
        });

        it('should detect green border as uncommon', () => {
            const imageData = createImageData(20, 20, (x, y) => {
                // Green border, dark center
                if (x < 3 || x >= 17 || y < 3 || y >= 17) {
                    return [0, 200, 0, 255]; // Green border
                }
                return [50, 50, 50, 255]; // Dark center
            });
            const rarity = detectBorderRarity(imageData);
            expect(rarity).toBe('uncommon');
        });
    });

    describe('countRarityBorderPixels', () => {
        it('should count pixels correctly', () => {
            const imageData = createImageData(10, 1, () => [128, 128, 128, 255]);
            const result = countRarityBorderPixels(imageData);

            expect(result.total).toBe(10);
            expect(result.colorfulCount).toBeGreaterThanOrEqual(0);
            expect(result.rarityCounts).toBeDefined();
        });

        it('should detect colorful pixels', () => {
            // High saturation pixel
            const imageData = createImageData(10, 1, () => [255, 0, 0, 255]);
            const result = countRarityBorderPixels(imageData);

            expect(result.colorfulCount).toBeGreaterThan(0);
        });
    });
});
