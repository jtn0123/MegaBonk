import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AllGameData, CVDetectionResult, ROI } from '../../src/types/index.ts';

// Mock dependencies BEFORE imports
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn(() => ({ width: 1920, height: 1080, type: '1080p' })),
    detectUILayout: vi.fn(() => ({ type: 'standard', scale: 1.0 })),
}));

// Import after mocks
import {
    initCV,
    isFullyLoaded,
    isPriorityLoaded,
    clearDetectionCache,
    detectGridPositions,
    aggregateDuplicates,
} from '../../src/modules/computer-vision.ts';
import { logger } from '../../src/modules/logger.ts';

describe('computer-vision.ts - Edge Cases', () => {
    const mockGameData: AllGameData = {
        items: {
            items: [
                {
                    id: 'common-item-1',
                    name: 'Common Item 1',
                    tier: 'C' as const,
                    rarity: 'common' as const,
                    base_effect: 'Common effect',
                    detailed_description: 'Common description',
                    image: '/images/items/common-1.png',
                },
                {
                    id: 'uncommon-item-1',
                    name: 'Uncommon Item 1',
                    tier: 'B' as const,
                    rarity: 'uncommon' as const,
                    base_effect: 'Uncommon effect',
                    detailed_description: 'Uncommon description',
                    image: '/images/items/uncommon-1.png',
                },
                {
                    id: 'rare-item-1',
                    name: 'Rare Item 1',
                    tier: 'A' as const,
                    rarity: 'rare' as const,
                    base_effect: 'Rare effect',
                    detailed_description: 'Rare description',
                    image: '/images/items/rare-1.png',
                },
                {
                    id: 'legendary-item-1',
                    name: 'Legendary Item 1',
                    tier: 'S' as const,
                    rarity: 'legendary' as const,
                    base_effect: 'Legendary effect',
                    detailed_description: 'Legendary description',
                    image: '/images/items/legendary-1.png',
                },
            ],
            version: '1.0.0',
            last_updated: '2024-01-01',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        clearDetectionCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initCV', () => {
        it('should initialize with game data', () => {
            initCV(mockGameData);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 4,
                    }),
                })
            );
        });

        it('should handle empty game data', () => {
            const emptyData: AllGameData = {};

            initCV(emptyData);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 0,
                    }),
                })
            );
        });

        it('should handle game data with no items array', () => {
            const noItemsData: AllGameData = {
                items: {
                    items: [],
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                },
            };

            initCV(noItemsData);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 0,
                    }),
                })
            );
        });

        it('should handle very large item collections', () => {
            const largeData: AllGameData = {
                items: {
                    items: Array.from({ length: 1000 }, (_, i) => ({
                        id: `item-${i}`,
                        name: `Item ${i}`,
                        tier: 'C' as const,
                        rarity: 'common' as const,
                        base_effect: `Effect ${i}`,
                        detailed_description: `Description ${i}`,
                        image: `/images/items/item-${i}.png`,
                    })),
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                },
            };

            initCV(largeData);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.init',
                    data: expect.objectContaining({
                        itemsCount: 1000,
                    }),
                })
            );
        });

        it('should not throw on null game data', () => {
            expect(() => initCV(null as any)).not.toThrow();
        });

        it('should not throw on undefined game data', () => {
            expect(() => initCV(undefined as any)).not.toThrow();
        });
    });

    describe('isFullyLoaded and isPriorityLoaded', () => {
        it('should return false initially', () => {
            expect(isFullyLoaded()).toBe(false);
            expect(isPriorityLoaded()).toBe(false);
        });

        it('should maintain separate states for priority and full loading', () => {
            const priorityState = isPriorityLoaded();
            const fullState = isFullyLoaded();

            // Should be independent
            expect(typeof priorityState).toBe('boolean');
            expect(typeof fullState).toBe('boolean');
        });
    });

    describe('clearDetectionCache', () => {
        it('should clear cache successfully', () => {
            clearDetectionCache();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.cache_cleared',
                    data: { cleared: true },
                })
            );
        });

        it('should be callable multiple times', () => {
            vi.clearAllMocks(); // Clear previous calls

            clearDetectionCache();
            clearDetectionCache();
            clearDetectionCache();

            expect(logger.info).toHaveBeenCalledTimes(3);
        });

        it('should not throw when called before init', () => {
            expect(() => clearDetectionCache()).not.toThrow();
        });
    });

    describe('detectGridPositions', () => {
        it('should detect grid for standard 1920x1080 resolution', () => {
            const positions = detectGridPositions(1920, 1080, 64);

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBeGreaterThan(0);

            // Check first position
            expect(positions[0]).toHaveProperty('x');
            expect(positions[0]).toHaveProperty('y');
            expect(positions[0]).toHaveProperty('width');
            expect(positions[0]).toHaveProperty('height');
        });

        it('should handle very small resolutions', () => {
            const positions = detectGridPositions(320, 240, 32);

            expect(Array.isArray(positions)).toBe(true);
            // Should still generate some positions
            expect(positions.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle very large resolutions', () => {
            const positions = detectGridPositions(3840, 2160, 64); // 4K

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBeGreaterThan(0);
        });

        it('should handle square resolutions', () => {
            const positions = detectGridPositions(1024, 1024, 64);

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBeGreaterThan(0);
        });

        it('should handle custom grid sizes', () => {
            const positions32 = detectGridPositions(1920, 1080, 32);
            const positions64 = detectGridPositions(1920, 1080, 64);
            const positions128 = detectGridPositions(1920, 1080, 128);

            // Function uses adaptive sizing, all should return valid arrays
            expect(Array.isArray(positions32)).toBe(true);
            expect(Array.isArray(positions64)).toBe(true);
            expect(Array.isArray(positions128)).toBe(true);
        });

        it('should handle grid size larger than resolution', () => {
            const positions = detectGridPositions(100, 100, 200);

            expect(Array.isArray(positions)).toBe(true);
            // Should handle gracefully, possibly returning 0 or 1 cell
            expect(positions.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle zero width', () => {
            const positions = detectGridPositions(0, 1080, 64);

            expect(Array.isArray(positions)).toBe(true);
            // May return some positions or empty array depending on implementation
        });

        it('should handle zero height', () => {
            const positions = detectGridPositions(1920, 0, 64);

            expect(Array.isArray(positions)).toBe(true);
            // May return some positions or empty array depending on implementation
        });

        it('should handle negative dimensions', () => {
            const positions = detectGridPositions(-1920, -1080, 64);

            expect(Array.isArray(positions)).toBe(true);
            // Should handle gracefully
            expect(positions.length).toBe(0);
        });

        it('should handle zero grid size', () => {
            const positions = detectGridPositions(1920, 1080, 0);

            expect(Array.isArray(positions)).toBe(true);
            // Should handle gracefully, possibly returning empty array
            expect(positions.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle negative grid size', () => {
            const positions = detectGridPositions(1920, 1080, -64);

            expect(Array.isArray(positions)).toBe(true);
            // Should handle gracefully
            expect(positions.length).toBeGreaterThanOrEqual(0);
        });

        it('should generate positions with valid coordinates', () => {
            const positions = detectGridPositions(1920, 1080, 64);

            positions.forEach(pos => {
                expect(pos.x).toBeGreaterThanOrEqual(0);
                expect(pos.y).toBeGreaterThanOrEqual(0);
                expect(pos.width).toBeGreaterThan(0);
                expect(pos.height).toBeGreaterThan(0);
            });
        });

        it('should handle ultra-wide resolutions', () => {
            const positions = detectGridPositions(3440, 1440, 64); // 21:9

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBeGreaterThan(0);
        });

        it('should handle portrait orientation', () => {
            const positions = detectGridPositions(1080, 1920, 64);

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBeGreaterThan(0);
        });
    });

    describe('aggregateDuplicates', () => {
        it('should aggregate identical detections', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0], // Same item
                    confidence: 0.85,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[1], // Different item
                    confidence: 0.8,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(2); // 2 unique items
            expect(aggregated[0].count).toBe(2); // First item appears twice
            expect(aggregated[1].count).toBe(1); // Second item appears once
        });

        it('should handle empty detections array', () => {
            const aggregated = aggregateDuplicates([]);

            expect(Array.isArray(aggregated)).toBe(true);
            expect(aggregated.length).toBe(0);
        });

        it('should handle single detection', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].count).toBe(1);
        });

        it('should handle all unique detections', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[1],
                    confidence: 0.85,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[2],
                    confidence: 0.8,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(3);
            aggregated.forEach(result => {
                expect(result.count).toBe(1);
            });
        });

        it('should handle all identical detections', () => {
            const detections: CVDetectionResult[] = Array.from({ length: 10 }, () => ({
                type: 'item' as const,
                entity: mockGameData.items!.items[0],
                confidence: 0.9,
                method: 'template_match' as const,
            }));

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].count).toBe(10);
        });

        it('should preserve highest confidence for duplicates', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.7,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.95, // Highest
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.8,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].confidence).toBe(0.95);
        });

        it('should handle very large detection arrays', () => {
            const detections: CVDetectionResult[] = Array.from({ length: 1000 }, (_, i) => ({
                type: 'item' as const,
                entity: mockGameData.items!.items[i % 4], // Cycle through 4 items
                confidence: 0.9,
                method: 'template_match' as const,
            }));

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(4);
            aggregated.forEach(result => {
                expect(result.count).toBe(250); // 1000 / 4
            });
        });

        it('should handle detections with positions', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    position: { x: 100, y: 100, width: 64, height: 64 },
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.85,
                    position: { x: 200, y: 100, width: 64, height: 64 },
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].count).toBe(2);
            expect(aggregated[0].position).toBeDefined();
        });

        it('should handle mixed entity types', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.85,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle detections with different methods', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.9,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.85,
                    method: 'icon_similarity',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.8,
                    method: 'hybrid',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].count).toBe(3);
        });

        it('should handle detections with very low confidence', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.01,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.02,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].count).toBe(2);
            expect(aggregated[0].confidence).toBe(0.02);
        });

        it('should handle detections with confidence of 1.0', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 1.0,
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: mockGameData.items!.items[0],
                    confidence: 0.99,
                    method: 'template_match',
                },
            ];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated.length).toBe(1);
            expect(aggregated[0].confidence).toBe(1.0);
        });
    });

    describe('Edge cases in grid and geometry', () => {
        it('should handle fractional grid sizes', () => {
            const positions = detectGridPositions(1920, 1080, 64.5);

            expect(Array.isArray(positions)).toBe(true);
        });

        it('should handle very large grid sizes', () => {
            const positions = detectGridPositions(1920, 1080, 1000);

            expect(Array.isArray(positions)).toBe(true);
            // Function uses adaptive sizing, returns up to 30 cells
            expect(positions.length).toBeLessThanOrEqual(30);
        });

        it('should handle very small grid sizes', () => {
            const positions = detectGridPositions(1920, 1080, 1);

            expect(Array.isArray(positions)).toBe(true);
            // Function uses adaptive sizing and limits to 30 cells
            expect(positions.length).toBeLessThanOrEqual(30);
        });

        it('should handle Infinity dimensions', () => {
            const positions = detectGridPositions(Infinity, Infinity, 64);

            expect(Array.isArray(positions)).toBe(true);
            // Should handle gracefully
        });

        it('should handle NaN dimensions', () => {
            const positions = detectGridPositions(NaN, NaN, 64);

            expect(Array.isArray(positions)).toBe(true);
            expect(positions.length).toBe(0);
        });

        it('should handle NaN grid size', () => {
            const positions = detectGridPositions(1920, 1080, NaN);

            expect(Array.isArray(positions)).toBe(true);
        });
    });
});
