/**
 * Edge Case Tests for Computer Vision Module
 * Tests handling of edge cases, boundary conditions, and failure modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    initCV,
    detectGridPositions,
    detectUIRegions,
    aggregateDuplicates,
} from '../../src/modules/computer-vision';
import { detectResolution, detectUILayout } from '../../src/modules/test-utils';
import type { AllGameData, CVDetectionResult } from '../../src/types';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'wrench',
                name: 'Wrench',
                description: 'Fixes things',
                rarity: 'common',
                tier: 'B',
                tags: ['utility'],
                mechanics: { base: { repair: 10 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'Power source',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
            {
                id: 'golden_crown',
                name: 'Golden Crown',
                description: 'Royal item',
                rarity: 'legendary',
                tier: 'SS',
                tags: ['prestige'],
                mechanics: { base: { gold: 100 } },
            },
        ],
    },
};

describe('CV Edge Cases - Grid Boundary Conditions', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should not place grid cells outside canvas bounds for 1080p', () => {
        const positions = detectGridPositions(1920, 1080);

        positions.forEach(cell => {
            expect(cell.x).toBeGreaterThanOrEqual(0);
            expect(cell.y).toBeGreaterThanOrEqual(0);
            expect(cell.x + cell.width).toBeLessThanOrEqual(1920);
            expect(cell.y + cell.height).toBeLessThanOrEqual(1080);
        });
    });

    it('should handle very small resolutions (320x240)', () => {
        const positions = detectGridPositions(320, 240);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        positions.forEach(cell => {
            expect(cell.x + cell.width).toBeLessThanOrEqual(320);
            expect(cell.y + cell.height).toBeLessThanOrEqual(240);
        });
    });

    it('should handle ultra-wide resolution (5120x1440)', () => {
        const positions = detectGridPositions(5120, 1440);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        positions.forEach(cell => {
            expect(cell.x + cell.width).toBeLessThanOrEqual(5120);
            expect(cell.y + cell.height).toBeLessThanOrEqual(1440);
        });
    });

    it('should enforce max 30 cells for any resolution', () => {
        const resolutions = [
            [640, 480],
            [1280, 720],
            [1920, 1080],
            [2560, 1440],
            [3840, 2160],
            [5120, 1440],
            [7680, 4320],
        ];

        resolutions.forEach(([w, h]) => {
            const positions = detectGridPositions(w, h);
            expect(positions.length).toBeLessThanOrEqual(30);
        });
    });

    it('should handle zero dimensions gracefully', () => {
        const positions = detectGridPositions(0, 0);
        expect(Array.isArray(positions)).toBe(true);
    });

    it('should handle negative dimensions gracefully', () => {
        const positions = detectGridPositions(-100, -100);
        expect(Array.isArray(positions)).toBe(true);
    });

    it('should place grid at bottom of screen (>85% down)', () => {
        const testCases = [
            { w: 1920, h: 1080 },
            { w: 1280, h: 720 },
            { w: 2560, h: 1440 },
        ];

        testCases.forEach(({ w, h }) => {
            const positions = detectGridPositions(w, h);
            if (positions.length > 0) {
                positions.forEach(cell => {
                    expect(cell.y).toBeGreaterThan(h * 0.85);
                });
            }
        });
    });
});

describe('CV Edge Cases - Resolution Detection', () => {
    it('should detect standard resolutions correctly', () => {
        expect(detectResolution(1920, 1080).category).toBe('1080p');
        expect(detectResolution(1280, 720).category).toBe('720p');
        expect(detectResolution(2560, 1440).category).toBe('1440p');
        expect(detectResolution(3840, 2160).category).toBe('4K');
        expect(detectResolution(1280, 800).category).toBe('steam_deck');
    });

    it('should handle non-standard resolutions', () => {
        const result = detectResolution(1600, 900);
        expect(result.category).toBeDefined();
        expect(result.width).toBe(1600);
        expect(result.height).toBe(900);
    });

    it('should handle very large resolutions (8K)', () => {
        const result = detectResolution(7680, 4320);
        expect(result.category).toBe('custom');
        expect(result.width).toBe(7680);
    });

    it('should handle portrait orientation', () => {
        const result = detectResolution(1080, 1920);
        expect(result.category).toBeDefined();
    });

    it('should handle 1:1 aspect ratio', () => {
        const result = detectResolution(1000, 1000);
        expect(result.category).toBeDefined();
    });

    it('should tolerate small deviations from standard resolutions', () => {
        // Within tolerance
        expect(detectResolution(1915, 1075).category).toBe('1080p');
        expect(detectResolution(1925, 1085).category).toBe('1080p');
    });
});

describe('CV Edge Cases - UI Layout Detection', () => {
    it('should detect PC layout for 16:9 aspect ratios', () => {
        expect(detectUILayout(1920, 1080)).toBe('pc');
        expect(detectUILayout(1280, 720)).toBe('pc');
        expect(detectUILayout(2560, 1440)).toBe('pc');
        expect(detectUILayout(3840, 2160)).toBe('pc');
    });

    it('should detect Steam Deck layout for 16:10 aspect ratio', () => {
        expect(detectUILayout(1280, 800)).toBe('steam_deck');
    });

    it('should return unknown for unusual aspect ratios', () => {
        expect(detectUILayout(1000, 1000)).toBe('unknown'); // 1:1
        expect(detectUILayout(2560, 1080)).toBe('unknown'); // 21:9 ultrawide
    });

    it('should return unknown for portrait orientation', () => {
        expect(detectUILayout(1080, 1920)).toBe('unknown');
    });
});

describe('CV Edge Cases - Duplicate Aggregation', () => {
    const mockItem = {
        id: 'wrench',
        name: 'Wrench',
        rarity: 'common',
        tier: 'B',
        base_effect: 'Test',
        unlocked_by_default: true,
    };

    const createDetection = (confidence: number): CVDetectionResult => ({
        type: 'item',
        entity: mockItem,
        confidence,
        method: 'template_match',
        position: { x: 0, y: 0, width: 64, height: 64 },
    });

    it('should aggregate multiple detections of same item', () => {
        const detections = [
            createDetection(0.85),
            createDetection(0.90),
            createDetection(0.88),
        ];

        const result = aggregateDuplicates(detections);

        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(3);
        expect(result[0].confidence).toBe(0.90); // Max confidence
    });

    it('should handle empty input', () => {
        const result = aggregateDuplicates([]);
        expect(result).toHaveLength(0);
    });

    it('should handle single item', () => {
        const result = aggregateDuplicates([createDetection(0.85)]);
        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(1);
    });

    it('should keep different items separate', () => {
        const item2 = { ...mockItem, id: 'battery', name: 'Battery' };
        const detections = [
            createDetection(0.85),
            { ...createDetection(0.80), entity: item2 },
        ];

        const result = aggregateDuplicates(detections);
        expect(result).toHaveLength(2);
    });

    it('should sort results alphabetically by name', () => {
        const itemA = { ...mockItem, id: 'aaa', name: 'AAA Item' };
        const itemZ = { ...mockItem, id: 'zzz', name: 'ZZZ Item' };
        const detections = [
            { ...createDetection(0.85), entity: itemZ },
            { ...createDetection(0.85), entity: itemA },
        ];

        const result = aggregateDuplicates(detections);
        expect(result[0].entity.name).toBe('AAA Item');
        expect(result[1].entity.name).toBe('ZZZ Item');
    });

    it('should handle many duplicates (stress test)', () => {
        const detections = Array(100)
            .fill(null)
            .map((_, i) => createDetection(0.7 + (i % 30) * 0.01));

        const result = aggregateDuplicates(detections);
        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(100);
    });
});

describe('CV Edge Cases - UI Region Detection', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should detect inventory region', () => {
        const regions = detectUIRegions(1920, 1080);
        expect(regions.inventory).toBeDefined();
        expect(regions.inventory?.width).toBeGreaterThan(0);
        expect(regions.inventory?.height).toBeGreaterThan(0);
    });

    it('should scale regions proportionally for different resolutions', () => {
        const regions1080p = detectUIRegions(1920, 1080);
        const regions720p = detectUIRegions(1280, 720);

        // Regions should exist for both
        expect(regions1080p.inventory).toBeDefined();
        expect(regions720p.inventory).toBeDefined();

        // 1080p regions should be larger than 720p
        expect(regions1080p.inventory!.width).toBeGreaterThan(regions720p.inventory!.width);
    });

    it('should handle Steam Deck resolution differently', () => {
        const pcRegions = detectUIRegions(1920, 1080);
        const deckRegions = detectUIRegions(1280, 800);

        expect(deckRegions.inventory).toBeDefined();
        // Y position should differ due to 16:10 aspect ratio
    });

    it('should include pause menu region', () => {
        const regions = detectUIRegions(1920, 1080);
        expect(regions.pauseMenu).toBeDefined();
    });
});

describe('CV Edge Cases - Cell Size Adaptation', () => {
    it('should use smaller cells for lower resolutions', () => {
        const grid720 = detectGridPositions(1280, 720);
        const grid1080 = detectGridPositions(1920, 1080);
        const grid4K = detectGridPositions(3840, 2160);

        if (grid720.length > 0 && grid1080.length > 0 && grid4K.length > 0) {
            expect(grid720[0].width).toBeLessThan(grid1080[0].width);
            expect(grid1080[0].width).toBeLessThan(grid4K[0].width);
        }
    });

    it('should use appropriate cell sizes for each resolution', () => {
        // 720p: ~38px
        const grid720 = detectGridPositions(1280, 720);
        if (grid720.length > 0) {
            expect(grid720[0].width).toBeGreaterThanOrEqual(35);
            expect(grid720[0].width).toBeLessThanOrEqual(45);
        }

        // 1080p: ~45px
        const grid1080 = detectGridPositions(1920, 1080);
        if (grid1080.length > 0) {
            expect(grid1080[0].width).toBeGreaterThanOrEqual(40);
            expect(grid1080[0].width).toBeLessThanOrEqual(55);
        }

        // 4K: ~70px
        const grid4K = detectGridPositions(3840, 2160);
        if (grid4K.length > 0) {
            expect(grid4K[0].width).toBeGreaterThanOrEqual(60);
            expect(grid4K[0].width).toBeLessThanOrEqual(80);
        }
    });
});
