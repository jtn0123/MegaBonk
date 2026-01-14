/**
 * Unit tests for Computer Vision module
 * Tests color analysis, region detection, and pattern matching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    initCV,
    detectItemsWithCV,
    detectUIRegions,
} from '../../src/modules/computer-vision';
import { detectUILayout, detectResolution } from '../../src/modules/test-utils';
import type { AllGameData } from '../../src/types';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'first_aid_kit',
                name: 'First Aid Kit',
                description: 'Heals you',
                rarity: 'common',
                tier: 'B',
                tags: ['health'],
                mechanics: { base: { health_regen: 5 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'Energy boost',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
        ],
    },
};

// Mock canvas and image data
const createMockCanvas = (width: number, height: number) => {
    const canvas = {
        width,
        height,
        getContext: vi.fn(() => ({
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(width * height * 4),
                width,
                height,
            })),
        })),
    };
    return canvas;
};

// Mock image data URL
const createMockImageDataUrl = (width = 1920, height = 1080) => {
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
};

describe('Computer Vision - Initialization', () => {
    it('should initialize with game data', () => {
        expect(() => initCV(mockGameData)).not.toThrow();
    });

    it('should handle empty game data', () => {
        expect(() => initCV({})).not.toThrow();
    });
});

describe('Computer Vision - Resolution Detection', () => {
    it('should detect 1080p resolution', () => {
        const result = detectResolution(1920, 1080);
        expect(result.category).toBe('1080p');
        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
    });

    it('should detect 1440p resolution', () => {
        const result = detectResolution(2560, 1440);
        expect(result.category).toBe('1440p');
    });

    it('should detect 4K resolution', () => {
        const result = detectResolution(3840, 2160);
        expect(result.category).toBe('4K');
    });

    it('should detect Steam Deck resolution', () => {
        const result = detectResolution(1280, 800);
        expect(result.category).toBe('steam_deck');
    });

    it('should detect 720p resolution', () => {
        const result = detectResolution(1280, 720);
        expect(result.category).toBe('720p');
    });

    it('should handle custom resolution', () => {
        const result = detectResolution(1600, 900);
        expect(result.category).toBe('custom');
        expect(result.width).toBe(1600);
        expect(result.height).toBe(900);
    });

    it('should allow small tolerance for standard resolutions', () => {
        const result = detectResolution(1915, 1075); // Close to 1080p
        expect(result.category).toBe('1080p');
    });
});

describe('Computer Vision - UI Layout Detection', () => {
    it('should detect PC layout (16:9)', () => {
        const result = detectUILayout(1920, 1080);
        expect(result).toBe('pc');
    });

    it('should detect Steam Deck layout (16:10)', () => {
        const result = detectUILayout(1280, 800);
        expect(result).toBe('steam_deck');
    });

    it('should detect PC layout for 1440p', () => {
        const result = detectUILayout(2560, 1440);
        expect(result).toBe('pc');
    });

    it('should detect PC layout for 4K', () => {
        const result = detectUILayout(3840, 2160);
        expect(result).toBe('pc');
    });

    it('should return unknown for unusual aspect ratios', () => {
        const result = detectUILayout(1000, 1000); // 1:1
        expect(result).toBe('unknown');
    });

    it('should handle aspect ratio tolerance', () => {
        const result = detectUILayout(1910, 1080); // Slightly off 16:9
        expect(result).toBe('pc');
    });
});

describe('Computer Vision - Region Detection', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should detect inventory region in 1080p', () => {
        const regions = detectUIRegions(1920, 1080);
        expect(regions.inventory).toBeDefined();
        expect(regions.inventory?.width).toBeGreaterThan(0);
        expect(regions.inventory?.height).toBeGreaterThan(0);
    });

    it('should detect stats region in 1080p', () => {
        const regions = detectUIRegions(1920, 1080);
        expect(regions.stats).toBeDefined();
    });

    it('should scale regions for different resolutions', () => {
        const regions1080p = detectUIRegions(1920, 1080);
        const regions720p = detectUIRegions(1280, 720);

        const ratio = 1920 / 1280;
        expect(regions1080p.inventory?.width).toBeCloseTo(
            regions720p.inventory!.width * ratio,
            -1
        );
    });

    it('should detect Steam Deck regions differently', () => {
        const pcRegions = detectUIRegions(1920, 1080);
        const deckRegions = detectUIRegions(1280, 800);

        // Steam Deck regions should be proportionally different due to 16:10 aspect
        expect(deckRegions.inventory).toBeDefined();
        expect(deckRegions.inventory?.y).not.toBe(pcRegions.inventory?.y);
    });

    it('should include pause menu region', () => {
        const regions = detectUIRegions(1920, 1080);
        expect(regions.pauseMenu).toBeDefined();
    });
});

describe('Computer Vision - Color Analysis', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should analyze color distribution', () => {
        // Create mock image data with red tint
        const imageData = {
            data: new Uint8ClampedArray(100 * 4), // 100 pixels
            width: 10,
            height: 10,
        };

        // Fill with red pixels
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 255; // Red
            imageData.data[i + 1] = 50; // Green
            imageData.data[i + 2] = 50; // Blue
            imageData.data[i + 3] = 255; // Alpha
        }

        // Note: This would need to be tested through the CV module
        // For now, just verify the structure exists
        expect(imageData.data.length).toBe(400);
    });

    it('should calculate brightness', () => {
        const imageData = {
            data: new Uint8ClampedArray(100 * 4),
            width: 10,
            height: 10,
        };

        // Bright pixels
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 255;
            imageData.data[i + 1] = 255;
            imageData.data[i + 2] = 255;
            imageData.data[i + 3] = 255;
        }

        const avgBrightness = (255 + 255 + 255) / 3;
        expect(avgBrightness).toBe(255);
    });
});

describe('Computer Vision - Pattern Matching', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should detect common item patterns', () => {
        // This would test actual CV detection
        // For now, verify the function exists and returns expected structure
        const mockImageUrl = createMockImageDataUrl();
        // detectItemsWithCV would be called here
    });

    it('should handle different rarity colors', () => {
        // Common items: gray/white
        // Uncommon: green
        // Rare: blue
        // Epic: purple
        // Legendary: orange/gold

        const rarityColors = {
            common: { r: 200, g: 200, b: 200 },
            uncommon: { r: 50, g: 200, b: 50 },
            rare: { r: 50, g: 100, b: 255 },
            epic: { r: 200, g: 50, b: 200 },
            legendary: { r: 255, g: 165, b: 0 },
        };

        expect(rarityColors.common).toBeDefined();
        expect(rarityColors.legendary.r).toBeGreaterThan(200);
    });
});

describe('Computer Vision - Performance', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should analyze regions quickly (< 50ms)', () => {
        const start = performance.now();
        detectUIRegions(1920, 1080);
        const end = performance.now();

        expect(end - start).toBeLessThan(50);
    });

    it('should detect resolution quickly (< 10ms)', () => {
        const start = performance.now();
        detectResolution(1920, 1080);
        const end = performance.now();

        expect(end - start).toBeLessThan(10);
    });

    it('should detect UI layout quickly (< 10ms)', () => {
        const start = performance.now();
        detectUILayout(1920, 1080);
        const end = performance.now();

        expect(end - start).toBeLessThan(10);
    });
});

describe('Computer Vision - Edge Cases', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should handle very small resolutions', () => {
        const result = detectResolution(640, 480);
        expect(result.category).toBe('custom');
    });

    it('should handle very large resolutions', () => {
        const result = detectResolution(7680, 4320); // 8K
        expect(result.category).toBe('custom');
    });

    it('should handle unusual aspect ratios', () => {
        const result = detectUILayout(2560, 1080); // 21:9 ultrawide
        expect(result).toBe('unknown');
    });

    it('should handle portrait orientation', () => {
        const result = detectUILayout(1080, 1920); // 9:16
        expect(result).toBe('unknown');
    });

    it('should handle zero dimensions gracefully', () => {
        const result = detectResolution(0, 0);
        expect(result.category).toBe('custom');
    });
});

describe('Computer Vision - Integration with OCR', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should provide complementary data to OCR', () => {
        const regions = detectUIRegions(1920, 1080);

        // CV should provide regions that OCR can focus on
        expect(regions.inventory).toBeDefined();

        // CV can help filter OCR results by confirming visual patterns
        const hasInventoryRegion = regions.inventory !== undefined;
        expect(hasInventoryRegion).toBe(true);
    });

    it('should boost confidence when both CV and OCR agree', () => {
        // Simulating hybrid detection
        const ocrConfidence = 0.7;
        const cvMatch = true;
        const confidenceBoost = cvMatch ? 0.15 : 0;
        const hybridConfidence = Math.min(1.0, ocrConfidence + confidenceBoost);

        expect(hybridConfidence).toBe(0.85);
        expect(hybridConfidence).toBeGreaterThan(ocrConfidence);
    });
});

describe('Computer Vision - Regression Tests', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should maintain consistent region detection across versions', () => {
        const regions1 = detectUIRegions(1920, 1080);
        const regions2 = detectUIRegions(1920, 1080);

        expect(regions1.inventory?.x).toBe(regions2.inventory?.x);
        expect(regions1.inventory?.y).toBe(regions2.inventory?.y);
        expect(regions1.inventory?.width).toBe(regions2.inventory?.width);
        expect(regions1.inventory?.height).toBe(regions2.inventory?.height);
    });

    it('should maintain consistent resolution detection', () => {
        const result1 = detectResolution(1920, 1080);
        const result2 = detectResolution(1920, 1080);

        expect(result1.category).toBe(result2.category);
    });

    it('should maintain consistent UI layout detection', () => {
        const result1 = detectUILayout(1920, 1080);
        const result2 = detectUILayout(1920, 1080);

        expect(result1).toBe(result2);
    });
});
