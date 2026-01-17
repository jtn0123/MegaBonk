/**
 * Region Detection Tests
 * Tests adaptive layout detection for inventory slots across resolutions
 * Critical for finding items before template matching
 */

import { describe, it, expect } from 'vitest';
import { detectUIRegions, detectScreenType } from '../../src/modules/cv/regions.ts';

// Helper: Create mock canvas context
function createMockContext(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number, number]): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Fill canvas with test pattern
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = fillFn(x, y);
            const idx = (y * width + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return ctx;
}

describe('Screen Type Detection', () => {
    it('should detect pause menu (dark bottom)', () => {
        // Dark uniform bottom (no colorful hotbar)
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [30, 30, 30, 255] : [100, 100, 100, 255]; // Bottom 20% dark
        });

        const screenType = detectScreenType(ctx, 1280, 720);

        expect(screenType).toBe('pause_menu');
    });

    it('should detect gameplay (colorful hotbar at bottom)', () => {
        // Colorful bottom with hotbar icons
        const ctx = createMockContext(1280, 720, (x, y) => {
            if (y > 576) {
                // Bottom 20% has colorful icons
                return [(x * 7) % 256, (x * 11) % 256, (x * 13) % 256, 255];
            }
            return [100, 100, 100, 255];
        });

        const screenType = detectScreenType(ctx, 1280, 720);

        expect(screenType).toBe('gameplay');
    });

    it('should detect gameplay with high variance', () => {
        // High color variance in bottom region (hotbar)
        const ctx = createMockContext(1280, 720, (x, y) => {
            if (y > 576) {
                // Alternating bright colors
                return (x % 2 === 0) ? [255, 100, 50, 255] : [50, 200, 255, 255];
            }
            return [80, 80, 80, 255];
        });

        const screenType = detectScreenType(ctx, 1280, 720);

        expect(screenType).toBe('gameplay');
    });

    it('should detect pause menu with low brightness', () => {
        // Dark throughout (typical pause menu)
        const ctx = createMockContext(1280, 720, () => [40, 40, 40, 255]);

        const screenType = detectScreenType(ctx, 1280, 720);

        expect(screenType).toBe('pause_menu');
    });

    it('should handle fully transparent bottom', () => {
        // Transparent bottom (no hotbar visible)
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [0, 0, 0, 0] : [100, 100, 100, 255];
        });

        const screenType = detectScreenType(ctx, 1280, 720);

        expect(screenType).toBe('pause_menu');
    });
});

describe('UI Region Detection - Basic Resolution Support', () => {
    it('should detect regions for 720p (1280x720)', () => {
        const regions = detectUIRegions(1280, 720);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
        expect(regions.stats).toBeDefined();
    });

    it('should detect regions for 1080p (1920x1080)', () => {
        const regions = detectUIRegions(1920, 1080);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
        expect(regions.stats).toBeDefined();
    });

    it('should detect regions for 800p (1280x800)', () => {
        const regions = detectUIRegions(1280, 800);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
    });

    it('should detect regions for Steam Deck (1280x800)', () => {
        const regions = detectUIRegions(1280, 800);

        // Steam Deck layout should be more compact
        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();

        // Check that regions are reasonable size
        expect(regions.inventory!.width).toBeGreaterThan(400);
        expect(regions.inventory!.height).toBeGreaterThan(200);
    });
});

describe('UI Region Detection - Screen Type Differentiation', () => {
    it('should return pause menu regions when screen type is pause', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [30, 30, 30, 255] : [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
        expect(regions.stats).toBeDefined();
        expect(regions.gameplay).toBeUndefined();
    });

    it('should return gameplay regions when screen type is gameplay', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            if (y > 576) {
                return [(x * 7) % 256, (x * 11) % 256, (x * 13) % 256, 255];
            }
            return [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);

        expect(regions.gameplay).toBeDefined();
        expect(regions.stats).toBeDefined();
        expect(regions.character).toBeDefined();
        expect(regions.pauseMenu).toBeUndefined();
        expect(regions.inventory).toBeUndefined();
    });

    it('should support legacy call without context (defaults to pause menu)', () => {
        const regions = detectUIRegions(1280, 720);

        // Without context, should default to pause menu
        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
    });
});

describe('UI Region Validation - Pause Menu Layout', () => {
    it('should have non-overlapping regions', () => {
        const regions = detectUIRegions(1280, 720);

        const inventory = regions.inventory!;
        const stats = regions.stats!;

        // Stats should be above inventory (no vertical overlap)
        expect(stats.y + stats.height).toBeLessThanOrEqual(inventory.y + 10); // Allow small gap/overlap
    });

    it('should have inventory region in center', () => {
        const regions = detectUIRegions(1280, 720);
        const inventory = regions.inventory!;

        // Inventory should be centered horizontally
        const centerX = inventory.x + inventory.width / 2;
        const screenCenterX = 1280 / 2;

        expect(Math.abs(centerX - screenCenterX)).toBeLessThan(100);
    });

    it('should have reasonable inventory size', () => {
        const regions = detectUIRegions(1920, 1080);
        const inventory = regions.inventory!;

        // Inventory should take reasonable portion of screen
        expect(inventory.width).toBeGreaterThan(400);
        expect(inventory.height).toBeGreaterThan(300);
        expect(inventory.width).toBeLessThan(1500);
        expect(inventory.height).toBeLessThan(800);
    });

    it('should scale regions proportionally with resolution', () => {
        const regions720 = detectUIRegions(1280, 720);
        const regions1080 = detectUIRegions(1920, 1080);

        const inv720 = regions720.inventory!;
        const inv1080 = regions1080.inventory!;

        // 1080p inventory should be larger than 720p
        expect(inv1080.width).toBeGreaterThan(inv720.width);
        expect(inv1080.height).toBeGreaterThan(inv720.height);

        // But proportions should be similar
        const ratio720 = inv720.width / inv720.height;
        const ratio1080 = inv1080.width / inv1080.height;

        expect(Math.abs(ratio720 - ratio1080)).toBeLessThan(0.3);
    });

    it('should have stats region above inventory', () => {
        const regions = detectUIRegions(1280, 720);
        const stats = regions.stats!;
        const inventory = regions.inventory!;

        expect(stats.y).toBeLessThan(inventory.y);
        expect(stats.y + stats.height).toBeLessThanOrEqual(inventory.y + 20);
    });
});

describe('UI Region Validation - Gameplay Layout', () => {
    it('should have fullscreen gameplay region', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);
        const gameplay = regions.gameplay!;

        expect(gameplay.x).toBe(0);
        expect(gameplay.y).toBe(0);
        expect(gameplay.width).toBe(1280);
        expect(gameplay.height).toBe(720);
    });

    it('should have stats in top-left corner', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);
        const stats = regions.stats!;

        // Stats should be in top-left
        expect(stats.x).toBeLessThan(100);
        expect(stats.y).toBeLessThan(100);
    });

    it('should have character region on left side', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);
        const character = regions.character!;

        // Character should be on left side
        expect(character.x).toBeLessThan(200);
        expect(character.y).toBeGreaterThan(100); // Below stats
    });

    it('should have character below stats', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const regions = detectUIRegions(ctx, 1280, 720);
        const stats = regions.stats!;
        const character = regions.character!;

        expect(character.y).toBeGreaterThan(stats.y + stats.height);
    });
});

describe('UI Region Validation - Edge Cases', () => {
    it('should handle very small resolutions gracefully', () => {
        const regions = detectUIRegions(800, 600);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();

        // Regions should still be reasonable
        expect(regions.inventory!.width).toBeGreaterThan(0);
        expect(regions.inventory!.height).toBeGreaterThan(0);
    });

    it('should handle very large resolutions (4K)', () => {
        const regions = detectUIRegions(3840, 2160);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();

        // Regions should scale up
        expect(regions.inventory!.width).toBeGreaterThan(1000);
        expect(regions.inventory!.height).toBeGreaterThan(600);
    });

    it('should handle ultra-wide resolutions', () => {
        const regions = detectUIRegions(2560, 1080);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();

        // Inventory should still be centered
        const inventory = regions.inventory!;
        const centerX = inventory.x + inventory.width / 2;
        const screenCenterX = 2560 / 2;

        expect(Math.abs(centerX - screenCenterX)).toBeLessThan(200);
    });

    it('should handle vertical/portrait resolutions', () => {
        const regions = detectUIRegions(720, 1280);

        expect(regions.pauseMenu).toBeDefined();

        // Should still provide regions even for unusual aspect ratios
        expect(regions.inventory).toBeDefined();
    });

    it('should provide labeled regions', () => {
        const regions = detectUIRegions(1280, 720);

        expect(regions.inventory!.label).toBe('inventory');
        expect(regions.stats!.label).toBe('stats');
        expect(regions.pauseMenu!.label).toBe('pause_menu');
    });
});

describe('Integration: Region Detection with Slot Grid', () => {
    it('should detect inventory region for slot detection', () => {
        const regions = detectUIRegions(1280, 720);
        const inventory = regions.inventory!;

        // Mock slot grid generation (5 rows × 10 columns = 50 slots)
        const slotWidth = 45;
        const slotHeight = 45;
        const slotsPerRow = 10;
        const numRows = 5;

        const gridWidth = slotsPerRow * slotWidth;
        const gridHeight = numRows * slotHeight;

        // Grid should fit within inventory region
        expect(gridWidth).toBeLessThanOrEqual(inventory.width);
        expect(gridHeight).toBeLessThanOrEqual(inventory.height);
    });

    it('should provide reasonable slot spacing', () => {
        const regions = detectUIRegions(1920, 1080);
        const inventory = regions.inventory!;

        // Mock slot calculation
        const slotWidth = 50;
        const slotHeight = 50;
        const spacing = 5;
        const slotsPerRow = 10;

        const totalWidthNeeded = slotsPerRow * slotWidth + (slotsPerRow - 1) * spacing;

        // Should have room for slots with spacing
        expect(totalWidthNeeded).toBeLessThanOrEqual(inventory.width);
    });

    it('should detect stats region for level/HP reading', () => {
        const regions = detectUIRegions(1280, 720);
        const stats = regions.stats!;

        // Stats region should be reasonable size for OCR
        expect(stats.width).toBeGreaterThan(200);
        expect(stats.height).toBeGreaterThan(50);
    });

    it('should support both pause menu and gameplay detection flows', () => {
        const pauseCtx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [30, 30, 30, 255] : [100, 100, 100, 255];
        });

        const gameplayCtx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const pauseRegions = detectUIRegions(pauseCtx, 1280, 720);
        const gameplayRegions = detectUIRegions(gameplayCtx, 1280, 720);

        // Different regions should be detected
        expect(pauseRegions.inventory).toBeDefined();
        expect(gameplayRegions.inventory).toBeUndefined();

        expect(pauseRegions.gameplay).toBeUndefined();
        expect(gameplayRegions.gameplay).toBeDefined();
    });
});

describe('Performance - Region Detection', () => {
    it('should detect regions quickly (< 1ms)', () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
            detectUIRegions(1280, 720);
        }

        const elapsed = performance.now() - start;

        // 1000 iterations should take < 10ms (< 0.01ms per call)
        expect(elapsed).toBeLessThan(10);
    });

    it('should detect screen type quickly (< 5ms)', () => {
        const ctx = createMockContext(1280, 720, (x, y) => {
            return y > 576 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const start = performance.now();

        for (let i = 0; i < 100; i++) {
            detectScreenType(ctx, 1280, 720);
        }

        const elapsed = performance.now() - start;

        // 100 iterations should take < 50ms (< 0.5ms per call)
        expect(elapsed).toBeLessThan(50);
    });

    it('should handle large resolutions without slowdown', () => {
        const ctx = createMockContext(3840, 2160, (x, y) => {
            return y > 1728 ? [200, 100, 50, 255] : [100, 100, 100, 255];
        });

        const start = performance.now();

        detectScreenType(ctx, 3840, 2160);
        detectUIRegions(ctx, 3840, 2160);

        const elapsed = performance.now() - start;

        // Should complete in < 10ms even for 4K
        expect(elapsed).toBeLessThan(10);
    });
});
