/**
 * @vitest-environment jsdom
 * CV Regions Module - Comprehensive Tests
 * Tests for screen type detection and UI region detection
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    detectScreenType,
    detectUIRegions,
} from '../../src/modules/cv/regions.ts';

// Mock test-utils
vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn().mockReturnValue({ category: '1080p', width: 1920, height: 1080 }),
    detectUILayout: vi.fn().mockReturnValue('pc'),
}));

import { detectResolution, detectUILayout } from '../../src/modules/test-utils.ts';

// ========================================
// Test Helpers
// ========================================

function createMockContext(pixelData: Uint8ClampedArray, width: number, height: number) {
    return {
        getImageData: vi.fn().mockReturnValue({
            data: pixelData,
            width,
            height,
        }),
    } as unknown as CanvasRenderingContext2D;
}

function createPixelData(width: number, height: number, fillColor: { r: number; g: number; b: number; a: number }) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = fillColor.r;
        data[i + 1] = fillColor.g;
        data[i + 2] = fillColor.b;
        data[i + 3] = fillColor.a;
    }
    return data;
}

function createVariedPixelData(width: number, height: number) {
    // Create colorful data (high variance, high brightness)
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        data[i] = (pixelIndex * 7) % 256; // R - varied
        data[i + 1] = (pixelIndex * 13) % 256; // G - varied
        data[i + 2] = (pixelIndex * 17) % 256; // B - varied
        data[i + 3] = 255; // A - opaque
    }
    return data;
}

// ========================================
// Test Suite
// ========================================

describe('CV Regions Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (detectResolution as any).mockReturnValue({ category: '1080p', width: 1920, height: 1080 });
        (detectUILayout as any).mockReturnValue('pc');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // detectScreenType Tests
    // ========================================
    describe('detectScreenType', () => {
        it('should detect pause_menu for dark bottom region', () => {
            // Dark pixels (low brightness, low variance)
            const pixelData = createPixelData(1920, 216, { r: 20, g: 20, b: 20, a: 255 });
            const ctx = createMockContext(pixelData, 1920, 216);

            const result = detectScreenType(ctx, 1920, 1080);

            expect(result).toBe('pause_menu');
        });

        it('should detect gameplay for bright colorful bottom region', () => {
            // Bright, colorful pixels (high brightness, high variance)
            const pixelData = createVariedPixelData(1920, 216);
            // Ensure high brightness
            for (let i = 0; i < pixelData.length; i += 4) {
                pixelData[i] = Math.max(pixelData[i], 150);
                pixelData[i + 1] = Math.max(pixelData[i + 1], 50);
                pixelData[i + 2] = Math.max(pixelData[i + 2], 50);
            }
            const ctx = createMockContext(pixelData, 1920, 216);

            const result = detectScreenType(ctx, 1920, 1080);

            expect(result).toBe('gameplay');
        });

        it('should return pause_menu for fully transparent bottom', () => {
            // All transparent pixels
            const pixelData = createPixelData(1920, 216, { r: 0, g: 0, b: 0, a: 0 });
            const ctx = createMockContext(pixelData, 1920, 216);

            const result = detectScreenType(ctx, 1920, 1080);

            expect(result).toBe('pause_menu');
        });

        it('should return pause_menu for uniform gray bottom', () => {
            // Uniform gray (medium brightness, low variance)
            const pixelData = createPixelData(1920, 216, { r: 100, g: 100, b: 100, a: 255 });
            const ctx = createMockContext(pixelData, 1920, 216);

            const result = detectScreenType(ctx, 1920, 1080);

            expect(result).toBe('pause_menu');
        });

        it('should handle different resolutions', () => {
            const pixelData = createPixelData(1280, 144, { r: 20, g: 20, b: 20, a: 255 });
            const ctx = createMockContext(pixelData, 1280, 144);

            const result = detectScreenType(ctx, 1280, 720);

            expect(result).toBe('pause_menu');
        });

        it('should sample bottom 20% of screen', () => {
            const ctx = createMockContext(new Uint8ClampedArray(0), 1920, 216);

            detectScreenType(ctx, 1920, 1080);

            // Should call getImageData for bottom region
            expect(ctx.getImageData).toHaveBeenCalledWith(
                0,
                expect.any(Number), // y = 864 (80% of 1080)
                1920,
                expect.any(Number) // height = 216 (20% of 1080)
            );
        });

        it('should skip semi-transparent pixels', () => {
            // Mix of opaque and semi-transparent pixels
            const pixelData = new Uint8ClampedArray(1920 * 216 * 4);
            for (let i = 0; i < pixelData.length; i += 4) {
                pixelData[i] = 200;
                pixelData[i + 1] = 50;
                pixelData[i + 2] = 50;
                // Alternate between opaque and transparent
                pixelData[i + 3] = (i / 4) % 2 === 0 ? 255 : 50;
            }
            const ctx = createMockContext(pixelData, 1920, 216);

            // Should still be able to detect based on opaque pixels
            const result = detectScreenType(ctx, 1920, 1080);
            expect(['pause_menu', 'gameplay']).toContain(result);
        });
    });

    // ========================================
    // detectUIRegions Tests
    // ========================================
    describe('detectUIRegions', () => {
        describe('Without Context (Legacy API)', () => {
            it('should return pause menu regions by default', () => {
                const result = detectUIRegions(1920, 1080);

                expect(result.pauseMenu).toBeDefined();
                expect(result.inventory).toBeDefined();
                expect(result.stats).toBeDefined();
            });

            it('should calculate PC layout regions', () => {
                (detectUILayout as any).mockReturnValue('pc');

                const result = detectUIRegions(1920, 1080);

                // Check pause menu region
                expect(result.pauseMenu?.x).toBe(Math.floor(1920 * 0.15));
                expect(result.pauseMenu?.y).toBe(Math.floor(1080 * 0.1));
                expect(result.pauseMenu?.width).toBe(Math.floor(1920 * 0.7));
                expect(result.pauseMenu?.height).toBe(Math.floor(1080 * 0.8));
            });

            it('should calculate Steam Deck layout regions', () => {
                (detectUILayout as any).mockReturnValue('steam_deck');

                const result = detectUIRegions(1280, 800);

                // Steam Deck has different proportions
                expect(result.pauseMenu?.x).toBe(Math.floor(1280 * 0.15));
                expect(result.pauseMenu?.y).toBe(Math.floor(800 * 0.15));
            });

            it('should include region labels', () => {
                const result = detectUIRegions(1920, 1080);

                expect(result.pauseMenu?.label).toBe('pause_menu');
                expect(result.inventory?.label).toBe('inventory');
                expect(result.stats?.label).toBe('stats');
            });
        });

        describe('With Context (Full API)', () => {
            it('should detect pause menu when bottom is dark', () => {
                const pixelData = createPixelData(1920, 216, { r: 20, g: 20, b: 20, a: 255 });
                const ctx = createMockContext(pixelData, 1920, 216);

                const result = detectUIRegions(ctx, 1920, 1080);

                expect(result.pauseMenu).toBeDefined();
                expect(result.gameplay).toBeUndefined();
            });

            it('should detect gameplay when bottom is colorful', () => {
                const pixelData = createVariedPixelData(1920, 216);
                // Ensure high brightness and variance
                for (let i = 0; i < pixelData.length; i += 4) {
                    pixelData[i] = 200;
                    pixelData[i + 1] = 50 + (i % 150);
                    pixelData[i + 2] = 100 + (i % 100);
                }
                const ctx = createMockContext(pixelData, 1920, 216);

                const result = detectUIRegions(ctx, 1920, 1080);

                expect(result.gameplay).toBeDefined();
                expect(result.pauseMenu).toBeUndefined();
            });

            it('should return gameplay regions with stats and character', () => {
                const pixelData = createVariedPixelData(1920, 216);
                for (let i = 0; i < pixelData.length; i += 4) {
                    pixelData[i] = 200;
                    pixelData[i + 1] = 50 + (i % 150);
                    pixelData[i + 2] = 100 + (i % 100);
                }
                const ctx = createMockContext(pixelData, 1920, 216);

                const result = detectUIRegions(ctx, 1920, 1080);

                expect(result.stats).toBeDefined();
                expect(result.character).toBeDefined();
                expect(result.inventory).toBeUndefined(); // Not in gameplay
            });
        });

        describe('Region Calculations', () => {
            it('should calculate inventory region correctly for PC', () => {
                (detectUILayout as any).mockReturnValue('pc');

                const result = detectUIRegions(1920, 1080);

                expect(result.inventory?.x).toBe(Math.floor(1920 * 0.25));
                expect(result.inventory?.y).toBe(Math.floor(1080 * 0.4));
                expect(result.inventory?.width).toBe(Math.floor(1920 * 0.5));
                expect(result.inventory?.height).toBe(Math.floor(1080 * 0.5));
            });

            it('should calculate stats region correctly for PC', () => {
                (detectUILayout as any).mockReturnValue('pc');

                const result = detectUIRegions(1920, 1080);

                expect(result.stats?.x).toBe(Math.floor(1920 * 0.25));
                expect(result.stats?.y).toBe(Math.floor(1080 * 0.15));
                expect(result.stats?.width).toBe(Math.floor(1920 * 0.5));
                expect(result.stats?.height).toBe(Math.floor(1080 * 0.2));
            });

            it('should calculate Steam Deck inventory region', () => {
                (detectUILayout as any).mockReturnValue('steam_deck');

                const result = detectUIRegions(1280, 800);

                expect(result.inventory?.x).toBe(Math.floor(1280 * 0.2));
                expect(result.inventory?.y).toBe(Math.floor(800 * 0.4));
                expect(result.inventory?.width).toBe(Math.floor(1280 * 0.6));
            });

            it('should return integer coordinates', () => {
                const result = detectUIRegions(1919, 1079); // Odd numbers

                // All coordinates should be integers
                Object.values(result).forEach(region => {
                    if (region) {
                        expect(Number.isInteger(region.x)).toBe(true);
                        expect(Number.isInteger(region.y)).toBe(true);
                        expect(Number.isInteger(region.width)).toBe(true);
                        expect(Number.isInteger(region.height)).toBe(true);
                    }
                });
            });
        });

        describe('Different Resolutions', () => {
            it('should handle 1080p resolution', () => {
                (detectResolution as any).mockReturnValue({ category: '1080p' });

                const result = detectUIRegions(1920, 1080);

                expect(result).toBeDefined();
                expect(result.pauseMenu).toBeDefined();
            });

            it('should handle 720p resolution', () => {
                (detectResolution as any).mockReturnValue({ category: '720p' });

                const result = detectUIRegions(1280, 720);

                expect(result).toBeDefined();
                expect(result.pauseMenu).toBeDefined();
            });

            it('should handle 4K resolution', () => {
                (detectResolution as any).mockReturnValue({ category: '4k' });

                const result = detectUIRegions(3840, 2160);

                expect(result).toBeDefined();
                expect(result.pauseMenu?.width).toBe(Math.floor(3840 * 0.7));
            });

            it('should handle Steam Deck resolution', () => {
                (detectResolution as any).mockReturnValue({ category: 'steam_deck' });
                (detectUILayout as any).mockReturnValue('steam_deck');

                const result = detectUIRegions(1280, 800);

                expect(result).toBeDefined();
                expect(result.pauseMenu).toBeDefined();
            });
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle very small resolution', () => {
            const result = detectUIRegions(320, 240);

            expect(result).toBeDefined();
            Object.values(result).forEach(region => {
                if (region) {
                    expect(region.width).toBeGreaterThan(0);
                    expect(region.height).toBeGreaterThan(0);
                }
            });
        });

        it('should handle very large resolution', () => {
            const result = detectUIRegions(7680, 4320); // 8K

            expect(result).toBeDefined();
            expect(result.pauseMenu?.width).toBeGreaterThan(0);
        });

        it('should handle unknown UI layout', () => {
            (detectUILayout as any).mockReturnValue('unknown');

            const result = detectUIRegions(1920, 1080);

            // Should fall back to PC layout
            expect(result.pauseMenu).toBeDefined();
        });

        it('should handle square aspect ratio', () => {
            const result = detectUIRegions(1000, 1000);

            expect(result).toBeDefined();
            expect(result.pauseMenu).toBeDefined();
        });

        it('should handle portrait aspect ratio', () => {
            const result = detectUIRegions(720, 1280);

            expect(result).toBeDefined();
            expect(result.pauseMenu).toBeDefined();
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should provide consistent regions for same input', () => {
            const result1 = detectUIRegions(1920, 1080);
            const result2 = detectUIRegions(1920, 1080);

            expect(result1).toEqual(result2);
        });

        it('should provide different regions for different layouts', () => {
            (detectUILayout as any).mockReturnValue('pc');
            const pcResult = detectUIRegions(1920, 1080);

            (detectUILayout as any).mockReturnValue('steam_deck');
            const deckResult = detectUIRegions(1280, 800);

            // Proportions should be different
            expect(pcResult.inventory?.x).not.toBe(deckResult.inventory?.x);
        });

        it('should provide regions that dont overlap incorrectly', () => {
            const result = detectUIRegions(1920, 1080);

            if (result.stats && result.inventory) {
                // Stats should be above inventory
                expect(result.stats.y + result.stats.height).toBeLessThanOrEqual(result.inventory.y);
            }
        });
    });
});
