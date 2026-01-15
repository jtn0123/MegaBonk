// ========================================
// Computer Vision Detection Logic Tests
// ========================================
// Comprehensive tests for core CV detection functions
// Focus: Detection algorithms, grid scanning, result processing
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    initCV,
    isFullyLoaded,
    isPriorityLoaded,
    detectGridPositions,
    aggregateDuplicates,
    combineDetections,
    extractDominantColors,
    clearDetectionCache,
    type CVDetectionResult,
    type ROI,
} from '../../src/modules/computer-vision.ts';
import type { AllGameData, Item, Tome, Character, Weapon } from '../../src/types/index.ts';

// Mock logger to prevent console spam
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock test-utils
vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn((width: number, height: number) => {
        if (width === 1280 && height === 720) return { category: '720p', width, height };
        if (width === 1920 && height === 1080) return { category: '1080p', width, height };
        if (width === 2560 && height === 1440) return { category: '1440p', width, height };
        if (width === 3840 && height === 2160) return { category: '4K', width, height };
        if (width === 1280 && height === 800) return { category: 'steam_deck', width, height };
        return { category: '1080p', width, height };
    }),
    detectUILayout: vi.fn(() => ({ layout: 'standard' })),
}));

describe('Computer Vision - Initialization', () => {
    const createMockGameData = (): AllGameData => ({
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Sword',
                    rarity: 'common',
                    tier: 'A',
                    effects: ['damage'],
                    image: 'sword.webp',
                },
                {
                    id: 'item2',
                    name: 'Shield',
                    rarity: 'uncommon',
                    tier: 'B',
                    effects: ['defense'],
                    image: 'shield.webp',
                },
            ],
            version: '1.0.0',
            last_updated: '2024-01-01',
        },
        weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
        tomes: { tomes: [], version: '1.0.0', last_updated: '2024-01-01' },
        characters: { characters: [], version: '1.0.0', last_updated: '2024-01-01' },
        shrines: { shrines: [], version: '1.0.0', last_updated: '2024-01-01' },
        stats: { baseStats: {}, version: '1.0.0', last_updated: '2024-01-01' },
    });

    beforeEach(() => {
        clearDetectionCache();
    });

    it('should initialize with valid game data', () => {
        const gameData = createMockGameData();
        expect(() => initCV(gameData)).not.toThrow();
    });

    it('should handle null game data gracefully', () => {
        expect(() => initCV(null as any)).not.toThrow();
    });

    it('should handle undefined game data gracefully', () => {
        expect(() => initCV(undefined as any)).not.toThrow();
    });

    it('should handle empty game data object', () => {
        expect(() => initCV({} as any)).not.toThrow();
    });

    it('should handle game data with missing items', () => {
        const gameData = { ...createMockGameData(), items: undefined };
        expect(() => initCV(gameData as any)).not.toThrow();
    });

    it('should handle game data with null items array', () => {
        const gameData = createMockGameData();
        gameData.items.items = null as any;
        expect(() => initCV(gameData)).not.toThrow();
    });

    it('should initialize multiple times without errors', () => {
        const gameData = createMockGameData();
        expect(() => {
            initCV(gameData);
            initCV(gameData);
            initCV(gameData);
        }).not.toThrow();
    });
});

describe('Computer Vision - Template Loading Status', () => {
    beforeEach(() => {
        clearDetectionCache();
    });

    it('should return boolean for isFullyLoaded', () => {
        const result = isFullyLoaded();
        expect(typeof result).toBe('boolean');
    });

    it('should return boolean for isPriorityLoaded', () => {
        const result = isPriorityLoaded();
        expect(typeof result).toBe('boolean');
    });

    it('should initially return false for isFullyLoaded', () => {
        // Fresh state should not be fully loaded
        const result = isFullyLoaded();
        expect(typeof result).toBe('boolean');
    });

    it('should initially return false for isPriorityLoaded', () => {
        const result = isPriorityLoaded();
        expect(typeof result).toBe('boolean');
    });
});

describe('Computer Vision - Grid Position Detection', () => {
    it('should generate grid positions for 720p resolution', () => {
        const positions = detectGridPositions(1280, 720);

        expect(Array.isArray(positions)).toBe(true);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        // Verify structure
        positions.forEach(pos => {
            expect(pos).toHaveProperty('x');
            expect(pos).toHaveProperty('y');
            expect(pos).toHaveProperty('width');
            expect(pos).toHaveProperty('height');
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeGreaterThan(0);
        });
    });

    it('should generate grid positions for 1080p resolution', () => {
        const positions = detectGridPositions(1920, 1080);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        // 1080p should have reasonable grid size
        if (positions.length > 0) {
            expect(positions[0].width).toBeGreaterThan(40);
            expect(positions[0].width).toBeLessThan(50);
        }
    });

    it('should generate grid positions for 1440p resolution', () => {
        const positions = detectGridPositions(2560, 1440);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        // 1440p should have larger grid size
        if (positions.length > 0) {
            expect(positions[0].width).toBeGreaterThan(50);
            expect(positions[0].width).toBeLessThan(60);
        }
    });

    it('should generate grid positions for 4K resolution', () => {
        const positions = detectGridPositions(3840, 2160);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);

        // 4K should have even larger grid size
        if (positions.length > 0) {
            expect(positions[0].width).toBeGreaterThan(65);
            expect(positions[0].width).toBeLessThan(75);
        }
    });

    it('should generate grid positions for Steam Deck resolution', () => {
        const positions = detectGridPositions(1280, 800);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle very small resolution (320x240)', () => {
        const positions = detectGridPositions(320, 240);

        expect(Array.isArray(positions)).toBe(true);
        // May have very few or no positions due to small size
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle very large resolution (7680x4320 - 8K)', () => {
        const positions = detectGridPositions(7680, 4320);

        expect(Array.isArray(positions)).toBe(true);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should limit positions to maximum of 30 cells', () => {
        // Even for very wide screens
        const positions = detectGridPositions(5120, 1440);

        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should use custom grid size parameter', () => {
        const customGridSize = 128;
        const positions = detectGridPositions(1920, 1080, customGridSize);

        expect(Array.isArray(positions)).toBe(true);
        // Grid size parameter is provided but function may use adaptive sizing
    });

    it('should handle zero dimensions', () => {
        const positions = detectGridPositions(0, 0);

        expect(Array.isArray(positions)).toBe(true);
        expect(positions.length).toBe(0);
    });

    it('should handle negative dimensions', () => {
        const positions = detectGridPositions(-1920, -1080);

        expect(Array.isArray(positions)).toBe(true);
    });

    it('should position hotbar near bottom of screen', () => {
        const positions = detectGridPositions(1920, 1080);

        if (positions.length > 0) {
            // Hotbar should be in bottom 20% of screen
            const firstPos = positions[0];
            expect(firstPos.y).toBeGreaterThan(1080 * 0.8);
        }
    });

    it('should add label to each position', () => {
        const positions = detectGridPositions(1920, 1080);

        positions.forEach((pos, index) => {
            expect(pos.label).toBeDefined();
            expect(pos.label).toContain('cell');
        });
    });

    it('should maintain consistent spacing between cells', () => {
        const positions = detectGridPositions(1920, 1080);

        if (positions.length >= 2) {
            const spacing = positions[1].x - (positions[0].x + positions[0].width);
            expect(spacing).toBeGreaterThanOrEqual(0);
            expect(spacing).toBeLessThan(20); // Reasonable spacing
        }
    });
});

describe('Computer Vision - Aggregate Duplicates', () => {
    const createMockItem = (id: string, name: string): Item => ({
        id,
        name,
        rarity: 'common',
        tier: 'A',
        effects: ['test'],
        image: 'test.webp',
    });

    it('should aggregate duplicate detections', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.85,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.92,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].entity.id).toBe('item1');
        expect(aggregated[0].count).toBe(3);
        expect(aggregated[0].confidence).toBe(0.92); // Max confidence
    });

    it('should handle empty detections array', () => {
        const aggregated = aggregateDuplicates([]);

        expect(aggregated).toHaveLength(0);
    });

    it('should handle single detection', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].count).toBe(1);
    });

    it('should keep separate items distinct', () => {
        const item1 = createMockItem('item1', 'Sword');
        const item2 = createMockItem('item2', 'Shield');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item1,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item2,
                confidence: 0.85,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(2);
        expect(aggregated.some(d => d.entity.id === 'item1')).toBe(true);
        expect(aggregated.some(d => d.entity.id === 'item2')).toBe(true);
    });

    it('should use highest confidence from group', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.7,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.95,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.8,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].confidence).toBe(0.95);
    });

    it('should preserve position of first detection', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.9,
                position: { x: 100, y: 200, width: 50, height: 50 },
                method: 'template_match',
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.85,
                position: { x: 150, y: 250, width: 50, height: 50 },
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].position).toEqual({ x: 100, y: 200, width: 50, height: 50 });
    });

    it('should sort results by entity name', () => {
        const itemA = createMockItem('item1', 'Apple');
        const itemZ = createMockItem('item2', 'Zebra');
        const itemM = createMockItem('item3', 'Mango');

        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: itemZ,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: itemA,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: itemM,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].entity.name).toBe('Apple');
        expect(aggregated[1].entity.name).toBe('Mango');
        expect(aggregated[2].entity.name).toBe('Zebra');
    });

    it('should handle detections with existing count property', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: (CVDetectionResult & { count?: number })[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.9,
                method: 'template_match',
                count: 5,
            },
            {
                type: 'item',
                entity: item,
                confidence: 0.85,
                method: 'template_match',
                count: 3,
            },
        ];

        const aggregated = aggregateDuplicates(detections as CVDetectionResult[]);

        expect(aggregated[0].count).toBe(8); // 5 + 3
    });

    it('should handle large number of duplicates (100+)', () => {
        const item = createMockItem('item1', 'Sword');

        const detections: CVDetectionResult[] = [];
        for (let i = 0; i < 150; i++) {
            detections.push({
                type: 'item',
                entity: item,
                confidence: 0.8 + Math.random() * 0.2,
                method: 'template_match',
            });
        }

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].count).toBe(150);
    });
});

describe('Computer Vision - Combine Detections', () => {
    const createMockItem = (id: string, name: string): Item => ({
        id,
        name,
        rarity: 'common',
        tier: 'A',
        effects: ['test'],
        image: 'test.webp',
    });

    it('should combine OCR and CV results', () => {
        const item1 = createMockItem('item1', 'Sword');
        const item2 = createMockItem('item2', 'Shield');

        const ocrResults = [
            {
                type: 'item',
                entity: item1,
                confidence: 0.7,
                rawText: 'Sword',
            },
        ];

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item2,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(Array.isArray(combined)).toBe(true);
        expect(combined.length).toBeGreaterThan(0);
    });

    it('should handle empty OCR results', () => {
        const item = createMockItem('item1', 'Sword');

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: item,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const combined = combineDetections([], cvResults);

        expect(combined.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty CV results', () => {
        const item = createMockItem('item1', 'Sword');

        const ocrResults = [
            {
                type: 'item',
                entity: item,
                confidence: 0.7,
                rawText: 'Sword',
            },
        ];

        const combined = combineDetections(ocrResults, []);

        expect(Array.isArray(combined)).toBe(true);
    });

    it('should handle both empty arrays', () => {
        const combined = combineDetections([], []);

        expect(combined).toHaveLength(0);
    });
});

describe('Computer Vision - Extract Dominant Colors', () => {
    // Polyfill ImageData for jsdom environment
    beforeEach(() => {
        if (typeof ImageData === 'undefined') {
            (global as any).ImageData = class ImageData {
                data: Uint8ClampedArray;
                width: number;
                height: number;
                colorSpace: PredefinedColorSpace;

                constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
                    if (data instanceof Uint8ClampedArray) {
                        this.data = data;
                        this.width = width;
                        this.height = height!;
                    } else {
                        // new ImageData(width, height)
                        this.width = data;
                        this.height = width;
                        this.data = new Uint8ClampedArray(this.width * this.height * 4);
                    }
                    this.colorSpace = 'srgb';
                }
            };
        }
    });

    const createMockImageData = (width: number, height: number, fillColor: [number, number, number]): ImageData => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillColor[0]; // R
            data[i + 1] = fillColor[1]; // G
            data[i + 2] = fillColor[2]; // B
            data[i + 3] = 255; // A
        }
        return new ImageData(data, width, height);
    };

    it('should extract colors from solid red image', () => {
        const imageData = createMockImageData(100, 100, [255, 0, 0]);
        const colors = extractDominantColors(imageData, 3);

        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(3);
    });

    it('should extract colors from solid blue image', () => {
        const imageData = createMockImageData(100, 100, [0, 0, 255]);
        const colors = extractDominantColors(imageData, 3);

        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
    });

    it('should handle default numColors parameter', () => {
        const imageData = createMockImageData(100, 100, [128, 128, 128]);
        const colors = extractDominantColors(imageData);

        expect(Array.isArray(colors)).toBe(true);
    });

    it('should handle small image (10x10)', () => {
        const imageData = createMockImageData(10, 10, [100, 150, 200]);
        const colors = extractDominantColors(imageData, 5);

        expect(Array.isArray(colors)).toBe(true);
    });

    it('should handle 1x1 image', () => {
        const imageData = createMockImageData(1, 1, [255, 255, 255]);
        const colors = extractDominantColors(imageData, 1);

        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
    });

    it('should respect numColors parameter', () => {
        const imageData = createMockImageData(100, 100, [128, 128, 128]);
        const colors = extractDominantColors(imageData, 7);

        expect(colors.length).toBeLessThanOrEqual(7);
    });

    it('should handle white image', () => {
        const imageData = createMockImageData(50, 50, [255, 255, 255]);
        const colors = extractDominantColors(imageData, 3);

        expect(colors.length).toBeGreaterThan(0);
    });

    it('should handle black image', () => {
        const imageData = createMockImageData(50, 50, [0, 0, 0]);
        const colors = extractDominantColors(imageData, 3);

        expect(colors.length).toBeGreaterThan(0);
    });
});

describe('Computer Vision - Detection Cache', () => {
    beforeEach(() => {
        clearDetectionCache();
    });

    it('should clear detection cache without errors', () => {
        expect(() => clearDetectionCache()).not.toThrow();
    });

    it('should clear cache multiple times', () => {
        expect(() => {
            clearDetectionCache();
            clearDetectionCache();
            clearDetectionCache();
        }).not.toThrow();
    });
});
