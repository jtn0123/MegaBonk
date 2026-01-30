/**
 * @vitest-environment jsdom
 * CV Color Analysis Module Tests
 */
import { describe, it, expect } from 'vitest';
import {
    rgbToHsl,
    matchesRarityColor,
    RARITY_BORDER_COLORS,
} from '../../src/modules/cv/color.ts';

describe('CV Color Module', () => {
    // ========================================
    // rgbToHsl Tests
    // ========================================
    describe('rgbToHsl', () => {
        it('should convert pure red correctly', () => {
            const result = rgbToHsl(255, 0, 0);
            expect(result.h).toBeCloseTo(0, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should convert pure green correctly', () => {
            const result = rgbToHsl(0, 255, 0);
            expect(result.h).toBeCloseTo(120, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should convert pure blue correctly', () => {
            const result = rgbToHsl(0, 0, 255);
            expect(result.h).toBeCloseTo(240, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should convert white correctly', () => {
            const result = rgbToHsl(255, 255, 255);
            expect(result.s).toBe(0);
            expect(result.l).toBeCloseTo(100, 0);
        });

        it('should convert black correctly', () => {
            const result = rgbToHsl(0, 0, 0);
            expect(result.s).toBe(0);
            expect(result.l).toBe(0);
        });

        it('should convert gray correctly', () => {
            const result = rgbToHsl(128, 128, 128);
            expect(result.s).toBe(0);
            expect(result.l).toBeCloseTo(50, 0); // Allow more tolerance for 128/255 ≈ 50.2%
        });

        it('should convert yellow correctly', () => {
            const result = rgbToHsl(255, 255, 0);
            expect(result.h).toBeCloseTo(60, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should convert cyan correctly', () => {
            const result = rgbToHsl(0, 255, 255);
            expect(result.h).toBeCloseTo(180, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should convert magenta correctly', () => {
            const result = rgbToHsl(255, 0, 255);
            expect(result.h).toBeCloseTo(300, 0);
            expect(result.s).toBeCloseTo(100, 0);
            expect(result.l).toBeCloseTo(50, 0);
        });

        it('should handle orange (255, 165, 0)', () => {
            const result = rgbToHsl(255, 165, 0);
            // Orange hue should be around 39 degrees
            expect(result.h).toBeGreaterThan(30);
            expect(result.h).toBeLessThan(50);
            expect(result.s).toBeCloseTo(100, 0);
        });

        it('should handle purple (128, 0, 255)', () => {
            const result = rgbToHsl(128, 0, 255);
            // Purple hue should be around 270 degrees
            expect(result.h).toBeGreaterThan(260);
            expect(result.h).toBeLessThan(290);
        });

        it('should return h, s, l properties', () => {
            const result = rgbToHsl(100, 150, 200);
            expect(result).toHaveProperty('h');
            expect(result).toHaveProperty('s');
            expect(result).toHaveProperty('l');
        });

        it('should return values in correct ranges', () => {
            // Test various colors
            const colors = [
                [0, 0, 0],
                [255, 255, 255],
                [128, 64, 192],
                [50, 100, 150],
                [200, 100, 50],
            ];

            colors.forEach(([r, g, b]) => {
                const result = rgbToHsl(r, g, b);
                expect(result.h).toBeGreaterThanOrEqual(0);
                expect(result.h).toBeLessThanOrEqual(360);
                expect(result.s).toBeGreaterThanOrEqual(0);
                expect(result.s).toBeLessThanOrEqual(100);
                expect(result.l).toBeGreaterThanOrEqual(0);
                expect(result.l).toBeLessThanOrEqual(100);
            });
        });
    });

    // ========================================
    // RARITY_BORDER_COLORS Tests
    // ========================================
    describe('RARITY_BORDER_COLORS', () => {
        it('should define all five rarities', () => {
            expect(RARITY_BORDER_COLORS).toHaveProperty('common');
            expect(RARITY_BORDER_COLORS).toHaveProperty('uncommon');
            expect(RARITY_BORDER_COLORS).toHaveProperty('rare');
            expect(RARITY_BORDER_COLORS).toHaveProperty('epic');
            expect(RARITY_BORDER_COLORS).toHaveProperty('legendary');
        });

        it('should have name property for each rarity', () => {
            Object.entries(RARITY_BORDER_COLORS).forEach(([key, def]) => {
                expect(def.name).toBe(key);
            });
        });

        it('should have HSL ranges for each rarity', () => {
            Object.values(RARITY_BORDER_COLORS).forEach(def => {
                expect(def.h).toHaveLength(2);
                expect(def.s).toHaveLength(2);
                expect(def.l).toHaveLength(2);
            });
        });

        it('should have RGB ranges for each rarity', () => {
            Object.values(RARITY_BORDER_COLORS).forEach(def => {
                expect(def.rgb.r).toHaveLength(2);
                expect(def.rgb.g).toHaveLength(2);
                expect(def.rgb.b).toHaveLength(2);
            });
        });

        it('common should have low saturation range', () => {
            const common = RARITY_BORDER_COLORS.common;
            expect(common.s[1]).toBeLessThanOrEqual(30);
        });

        it('uncommon should be in green hue range', () => {
            const uncommon = RARITY_BORDER_COLORS.uncommon;
            // Green is around 120 degrees
            expect(uncommon.h[0]).toBeLessThan(160);
            expect(uncommon.h[1]).toBeGreaterThan(80);
        });

        it('rare should be in blue hue range', () => {
            const rare = RARITY_BORDER_COLORS.rare;
            // Blue is around 240 degrees
            expect(rare.h[0]).toBeGreaterThan(180);
            expect(rare.h[1]).toBeLessThan(260);
        });

        it('epic should be in purple hue range', () => {
            const epic = RARITY_BORDER_COLORS.epic;
            // Purple is around 280-300 degrees
            expect(epic.h[0]).toBeGreaterThan(250);
            expect(epic.h[1]).toBeLessThan(330);
        });

        it('legendary should be in orange/gold hue range', () => {
            const legendary = RARITY_BORDER_COLORS.legendary;
            // Orange/gold is around 30-45 degrees
            expect(legendary.h[0]).toBeGreaterThan(0);
            expect(legendary.h[1]).toBeLessThan(70);
        });
    });

    // ========================================
    // matchesRarityColor Tests
    // ========================================
    describe('matchesRarityColor', () => {
        it('should return false for unknown rarity', () => {
            expect(matchesRarityColor(128, 128, 128, 'mythic')).toBe(false);
            expect(matchesRarityColor(128, 128, 128, '')).toBe(false);
            expect(matchesRarityColor(128, 128, 128, 'invalid')).toBe(false);
        });

        it('should match gray colors as common', () => {
            // Gray colors should match common
            const grayColors = [
                [128, 128, 128],
                [150, 150, 150],
                [100, 105, 100],
            ];

            grayColors.forEach(([r, g, b]) => {
                expect(matchesRarityColor(r, g, b, 'common')).toBe(true);
            });
        });

        it('should match green colors as uncommon', () => {
            // Green colors
            const greenColors = [
                [0, 200, 0],
                [50, 180, 50],
                [100, 220, 100],
            ];

            greenColors.forEach(([r, g, b]) => {
                expect(matchesRarityColor(r, g, b, 'uncommon')).toBe(true);
            });
        });

        it('should match blue colors as rare', () => {
            // Blue colors
            const blueColors = [
                [0, 128, 255],
                [50, 150, 220],
            ];

            blueColors.forEach(([r, g, b]) => {
                expect(matchesRarityColor(r, g, b, 'rare')).toBe(true);
            });
        });

        it('should match purple colors as epic', () => {
            // Purple colors
            const purpleColors = [
                [128, 0, 255],
                [180, 50, 220],
            ];

            purpleColors.forEach(([r, g, b]) => {
                expect(matchesRarityColor(r, g, b, 'epic')).toBe(true);
            });
        });

        it('should match orange/gold colors as legendary', () => {
            // Orange/gold colors
            const legendaryColors = [
                [255, 165, 0],
                [255, 180, 50],
                [230, 150, 30],
            ];

            legendaryColors.forEach(([r, g, b]) => {
                expect(matchesRarityColor(r, g, b, 'legendary')).toBe(true);
            });
        });

        it('should not match wrong rarity for obvious colors', () => {
            // Pure red should not match green (uncommon)
            expect(matchesRarityColor(255, 0, 0, 'uncommon')).toBe(false);
            
            // Pure blue should not match orange (legendary)
            expect(matchesRarityColor(0, 0, 255, 'legendary')).toBe(false);
            
            // Pure green should not match blue (rare)
            expect(matchesRarityColor(0, 255, 0, 'rare')).toBe(false);
        });

        it('should handle edge case RGB values', () => {
            // Black
            expect(matchesRarityColor(0, 0, 0, 'common')).toBe(false);
            
            // White
            expect(matchesRarityColor(255, 255, 255, 'common')).toBe(false);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle RGB values at boundaries', () => {
            // Minimum values
            expect(() => rgbToHsl(0, 0, 0)).not.toThrow();
            
            // Maximum values
            expect(() => rgbToHsl(255, 255, 255)).not.toThrow();
        });

        it('should handle decimal RGB values', () => {
            // Not typical but shouldn't crash
            const result = rgbToHsl(127.5, 63.25, 191.75);
            expect(result).toHaveProperty('h');
            expect(result).toHaveProperty('s');
            expect(result).toHaveProperty('l');
        });

        it('should handle very similar RGB values (near-gray)', () => {
            const result = rgbToHsl(127, 128, 129);
            // Should have very low saturation
            expect(result.s).toBeLessThan(5);
        });
    });
});
