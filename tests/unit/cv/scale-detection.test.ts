/**
 * @vitest-environment jsdom
 * Unit tests for cv/grid/scale-detection.ts
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../../../src/modules/cv/grid/hotbar-detection.ts', () => ({
    detectHotbarRegion: vi.fn(() => ({
        startY: 640,
        endY: 700,
        confidence: 0.9,
    })),
}));

vi.mock('../../../src/modules/cv/grid/edge-detection.ts', () => ({
    detectIconEdges: vi.fn(() => [100, 148, 196, 244, 292, 340]),
}));

vi.mock('../../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn((w: number, h: number) => {
        if (h <= 720) return { category: '720p', width: 1280, height: 720 };
        if (h <= 1080) return { category: '1080p', width: 1920, height: 1080 };
        if (h <= 1440) return { category: '1440p', width: 2560, height: 1440 };
        return { category: '4K', width: 3840, height: 2160 };
    }),
}));

import {
    getAdaptiveIconSizes,
    detectIconScale,
    detectGridPositions,
} from '../../../src/modules/cv/grid/scale-detection';
import { detectHotbarRegion } from '../../../src/modules/cv/grid/hotbar-detection';
import { detectIconEdges } from '../../../src/modules/cv/grid/edge-detection';

describe('scale-detection', () => {
    describe('getAdaptiveIconSizes', () => {
        it('should return 720p sizes for 1280x720', () => {
            const sizes = getAdaptiveIconSizes(1280, 720);
            expect(sizes).toEqual([32, 38, 44]);
        });

        it('should return 1080p sizes for 1920x1080', () => {
            const sizes = getAdaptiveIconSizes(1920, 1080);
            expect(sizes).toEqual([40, 48, 56]);
        });

        it('should return 1440p sizes for 2560x1440', () => {
            const sizes = getAdaptiveIconSizes(2560, 1440);
            expect(sizes).toEqual([48, 55, 64]);
        });

        it('should return 4K sizes for 3840x2160', () => {
            const sizes = getAdaptiveIconSizes(3840, 2160);
            expect(sizes).toEqual([64, 72, 80]);
        });

        it('should always return 3 sizes', () => {
            const sizes = getAdaptiveIconSizes(1920, 1080);
            expect(sizes).toHaveLength(3);
        });

        it('should return sizes in ascending order', () => {
            const sizes = getAdaptiveIconSizes(1920, 1080);
            for (let i = 1; i < sizes.length; i++) {
                expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!);
            }
        });
    });

    describe('detectIconScale', () => {
        it('should use edge analysis when hotbar confidence is high', () => {
            // Default mocks: hotbar confidence 0.9, edges returned
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = detectIconScale(ctx, 1920, 1080);

            expect(result.iconSize).toBeGreaterThan(0);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.method).toBe('edge_analysis');
        });

        it('should fall back to resolution when hotbar confidence is low', () => {
            vi.mocked(detectHotbarRegion).mockReturnValueOnce({
                startY: 640,
                endY: 700,
                confidence: 0.1,
            } as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = detectIconScale(ctx, 1920, 1080);

            expect(result.method).toBe('resolution_fallback');
            expect(result.confidence).toBeLessThanOrEqual(0.5);
        });

        it('should fall back when not enough edges detected', () => {
            vi.mocked(detectIconEdges).mockReturnValueOnce([100] as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = detectIconScale(ctx, 1920, 1080);

            expect(result.method).toBe('resolution_fallback');
        });

        it('should compute mode spacing from edges', () => {
            // Edges at consistent 48px spacing
            vi.mocked(detectIconEdges).mockReturnValueOnce([100, 148, 196, 244, 292] as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = detectIconScale(ctx, 1920, 1080);

            expect(result.iconSize).toBe(48);
            expect(result.confidence).toBeGreaterThan(0.5);
        });
    });

    describe('detectGridPositions', () => {
        it('should return grid positions for 1080p', () => {
            const positions = detectGridPositions(1920, 1080);
            expect(positions.length).toBeGreaterThan(0);
            expect(positions.length).toBeLessThanOrEqual(30);
        });

        it('should place positions at bottom of screen', () => {
            const positions = detectGridPositions(1920, 1080);
            for (const pos of positions) {
                expect(pos.y).toBeGreaterThan(1080 * 0.8);
                expect(pos.x).toBeGreaterThanOrEqual(0);
                expect(pos.width).toBeGreaterThan(0);
                expect(pos.height).toBeGreaterThan(0);
            }
        });

        it('should generate labels for each position', () => {
            const positions = detectGridPositions(1920, 1080);
            for (let i = 0; i < positions.length; i++) {
                expect(positions[i]!.label).toBe(`cell_${i}`);
            }
        });

        it('should limit to 30 positions', () => {
            // Very wide image that could fit many cells
            const positions = detectGridPositions(7680, 2160);
            expect(positions.length).toBeLessThanOrEqual(30);
        });

        it('should use resolution-appropriate icon sizes', () => {
            const pos720 = detectGridPositions(1280, 720);
            const pos1080 = detectGridPositions(1920, 1080);

            // 1080p icons should be larger than 720p
            expect(pos1080[0]!.width).toBeGreaterThan(pos720[0]!.width);
        });
    });
});
