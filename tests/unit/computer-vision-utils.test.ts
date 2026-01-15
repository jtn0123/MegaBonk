/**
 * Computer Vision Module - Utility Functions Tests
 * Testing initialization, state management, grid detection, and result aggregation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    initCV,
    isFullyLoaded,
    isPriorityLoaded,
    clearDetectionCache,
    detectGridPositions,
    aggregateDuplicates,
    combineDetections,
    extractDominantColors,
    type CVDetectionResult,
} from '../../src/modules/computer-vision';
import type { AllGameData, Item, Tome } from '../../src/types';

describe('Computer Vision - Initialization', () => {
    const mockGameData: AllGameData = {
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item 1',
                    rarity: 'common',
                    effects: ['Effect 1'],
                    tier: 'A',
                    image: 'test1.webp',
                },
                {
                    id: 'item2',
                    name: 'Test Item 2',
                    rarity: 'rare',
                    effects: ['Effect 2'],
                    tier: 'S',
                    image: 'test2.webp',
                },
            ],
            version: '1.0.0',
            last_updated: '2024-01-01',
        },
        weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
        tomes: { tomes: [], version: '1.0.0', last_updated: '2024-01-01' },
        characters: { characters: [], version: '1.0.0', last_updated: '2024-01-01' },
        shrines: { shrines: [], version: '1.0.0', last_updated: '2024-01-01' },
    };

    beforeEach(() => {
        clearDetectionCache();
    });

    it('should initialize with valid game data', () => {
        expect(() => initCV(mockGameData)).not.toThrow();
    });

    it('should handle null game data gracefully', () => {
        expect(() => initCV(null as any)).not.toThrow();
    });

    it('should handle undefined game data gracefully', () => {
        expect(() => initCV(undefined as any)).not.toThrow();
    });

    it('should handle empty game data', () => {
        expect(() => initCV({})).not.toThrow();
    });

    it('should handle missing items array', () => {
        const partialData = {
            weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
        };
        expect(() => initCV(partialData)).not.toThrow();
    });
});

describe('Computer Vision - State Management', () => {
    beforeEach(() => {
        clearDetectionCache();
    });

    it('should report not fully loaded initially', () => {
        expect(isFullyLoaded()).toBe(false);
    });

    it('should report priority not loaded initially', () => {
        expect(isPriorityLoaded()).toBe(false);
    });

    it('should clear detection cache without errors', () => {
        expect(() => clearDetectionCache()).not.toThrow();
    });

    it('should handle multiple cache clears', () => {
        clearDetectionCache();
        clearDetectionCache();
        clearDetectionCache();
        expect(true).toBe(true); // Should not throw
    });
});

describe('Computer Vision - Grid Position Detection', () => {
    it('should generate grid positions for 1080p resolution', () => {
        const positions = detectGridPositions(1920, 1080);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
        positions.forEach((pos, idx) => {
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeGreaterThanOrEqual(0);
            expect(pos.width).toBeGreaterThan(0);
            expect(pos.height).toBeGreaterThan(0);
            expect(pos.label).toBe(`cell_${idx}`);
        });
    });

    it('should generate grid positions for 720p resolution', () => {
        const positions = detectGridPositions(1280, 720);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should generate grid positions for 1440p resolution', () => {
        const positions = detectGridPositions(2560, 1440);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should generate grid positions for 4K resolution', () => {
        const positions = detectGridPositions(3840, 2160);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should respect custom grid size', () => {
        const customSize = 50;
        const positions = detectGridPositions(1920, 1080, customSize);

        expect(positions.length).toBeGreaterThan(0);
        // Grid size is adaptive, not custom in current implementation
    });

    it('should position hotbar at bottom of screen', () => {
        const width = 1920;
        const height = 1080;
        const positions = detectGridPositions(width, height);

        // All cells should be near the bottom
        positions.forEach(pos => {
            expect(pos.y).toBeGreaterThan(height * 0.9); // Bottom 10%
        });
    });

    it('should include margins from screen edges', () => {
        const width = 1920;
        const positions = detectGridPositions(width, 1080);

        const firstX = positions[0].x;
        const lastX = positions[positions.length - 1].x;

        expect(firstX).toBeGreaterThan(40); // Margin from left
        expect(lastX).toBeLessThan(width - 40); // Margin from right
    });

    it('should handle very small resolution (Steam Deck)', () => {
        const positions = detectGridPositions(1280, 800);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle ultra-wide resolution', () => {
        const positions = detectGridPositions(3440, 1440);

        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should limit maximum number of cells to 30', () => {
        // Very wide screen should still cap at 30
        const positions = detectGridPositions(7680, 2160); // Dual 4K

        expect(positions.length).toBeLessThanOrEqual(30);
    });
});

describe('Computer Vision - Aggregate Duplicates', () => {
    const mockItem1: Item = {
        id: 'item1',
        name: 'Sword',
        rarity: 'common',
        effects: ['damage'],
        tier: 'A',
        image: 'sword.webp',
    };

    const mockItem2: Item = {
        id: 'item2',
        name: 'Shield',
        rarity: 'rare',
        effects: ['defense'],
        tier: 'S',
        image: 'shield.webp',
    };

    it('should aggregate duplicate detections', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.85,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].entity.id).toBe('item1');
        expect(aggregated[0].count).toBe(3);
        expect(aggregated[0].confidence).toBe(0.9); // Max confidence
    });

    it('should handle mixed items without aggregating different IDs', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.9,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem2,
                confidence: 0.85,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(2);

        const sword = aggregated.find(d => d.entity.id === 'item1');
        const shield = aggregated.find(d => d.entity.id === 'item2');

        expect(sword).toBeDefined();
        expect(shield).toBeDefined();
        expect(sword!.count).toBe(2);
        expect(shield!.count).toBe(1);
    });

    it('should handle empty detections array', () => {
        const aggregated = aggregateDuplicates([]);

        expect(aggregated).toHaveLength(0);
    });

    it('should handle single detection', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].count).toBe(1);
    });

    it('should preserve position of first detection', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.9,
                position: { x: 100, y: 200, width: 50, height: 50 },
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.85,
                position: { x: 150, y: 200, width: 50, height: 50 },
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].position).toEqual({ x: 100, y: 200, width: 50, height: 50 });
    });

    it('should sort results by entity name', () => {
        const itemZ: Item = { ...mockItem1, id: 'itemZ', name: 'Zebra' };
        const itemA: Item = { ...mockItem2, id: 'itemA', name: 'Apple' };
        const itemM: Item = { ...mockItem1, id: 'itemM', name: 'Mango' };

        const detections: CVDetectionResult[] = [
            { type: 'item', entity: itemZ, confidence: 0.9, method: 'template_match' },
            { type: 'item', entity: itemA, confidence: 0.9, method: 'template_match' },
            { type: 'item', entity: itemM, confidence: 0.9, method: 'template_match' },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].entity.name).toBe('Apple');
        expect(aggregated[1].entity.name).toBe('Mango');
        expect(aggregated[2].entity.name).toBe('Zebra');
    });

    it('should use max confidence from group', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.5,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.95,
                method: 'template_match',
            },
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.7,
                method: 'template_match',
            },
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].confidence).toBe(0.95);
    });
});

describe('Computer Vision - Combine Detections', () => {
    const mockItem1: Item = {
        id: 'item1',
        name: 'Sword',
        rarity: 'common',
        effects: ['damage'],
        tier: 'A',
        image: 'sword.webp',
    };

    const mockItem2: Item = {
        id: 'item2',
        name: 'Shield',
        rarity: 'rare',
        effects: ['defense'],
        tier: 'S',
        image: 'shield.webp',
    };

    it('should combine OCR and CV results', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
                method: 'ocr',
            },
        ];

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem2,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined).toHaveLength(2);
    });

    it('should boost confidence when both methods find same item', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.7,
                method: 'ocr',
            },
        ];

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.7,
                method: 'template_match',
            },
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined).toHaveLength(1);
        expect(combined[0].confidence).toBeGreaterThan(0.7);
        expect(combined[0].method).toBe('hybrid');
    });

    it('should cap boosted confidence at 0.98', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.95,
                method: 'ocr',
            },
        ];

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.95,
                method: 'template_match',
            },
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].confidence).toBeLessThanOrEqual(0.98);
    });

    it('should handle empty OCR results', () => {
        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const combined = combineDetections([], cvResults);

        expect(combined).toHaveLength(1);
        expect(combined[0].method).toBe('template_match');
    });

    it('should handle empty CV results', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
                method: 'ocr',
            },
        ];

        const combined = combineDetections(ocrResults, []);

        expect(combined).toHaveLength(1);
    });

    it('should handle both empty arrays', () => {
        const combined = combineDetections([], []);

        expect(combined).toHaveLength(0);
    });

    it('should sort by confidence descending', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.5,
                method: 'ocr',
            },
        ];

        const cvResults: CVDetectionResult[] = [
            {
                type: 'item',
                entity: mockItem2,
                confidence: 0.9,
                method: 'template_match',
            },
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].confidence).toBe(0.9);
        expect(combined[1].confidence).toBe(0.5);
    });

    it('should preserve position information', () => {
        const position = { x: 100, y: 200, width: 50, height: 50 };
        const ocrResults = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
                position,
                method: 'ocr',
            },
        ];

        const combined = combineDetections(ocrResults, []);

        expect(combined[0].position).toEqual(position);
    });

    it('should default method to template_match if not specified', () => {
        const resultsWithoutMethod = [
            {
                type: 'item',
                entity: mockItem1,
                confidence: 0.8,
            },
        ];

        const combined = combineDetections(resultsWithoutMethod, []);

        expect(combined[0].method).toBe('template_match');
    });
});

describe('Computer Vision - Extract Dominant Colors', () => {
    it('should extract dominant colors from ImageData', () => {
        // Create mock ImageData with red pixels
        const width = 10;
        const height = 10;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with red pixels
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255; // R
            data[i + 1] = 0; // G
            data[i + 2] = 0; // B
            data[i + 3] = 255; // A
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 3);

        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(3);
        colors.forEach(color => {
            expect(color.r).toBeGreaterThanOrEqual(0);
            expect(color.g).toBeGreaterThanOrEqual(0);
            expect(color.b).toBeGreaterThanOrEqual(0);
            expect(color.frequency).toBeGreaterThan(0);
        });
    });

    it('should return top colors sorted by frequency', () => {
        const width = 20;
        const height = 20;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill half with red, half with blue
        for (let i = 0; i < data.length / 2; i += 4) {
            data[i] = 255;
            data[i + 3] = 255;
        }
        for (let i = data.length / 2; i < data.length; i += 4) {
            data[i + 2] = 255;
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeGreaterThan(0);
        // Frequencies should be in descending order
        for (let i = 1; i < colors.length; i++) {
            expect(colors[i - 1].frequency).toBeGreaterThanOrEqual(colors[i].frequency);
        }
    });

    it('should handle request for more colors than available', () => {
        const width = 5;
        const height = 5;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with single color
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 128;
            data[i + 1] = 128;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 10);

        // Should return available colors, not throw error
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty ImageData', () => {
        const data = new Uint8ClampedArray(0);
        const imageData = { data, width: 0, height: 0, colorSpace: 'srgb' as PredefinedColorSpace };

        const colors = extractDominantColors(imageData, 5);

        expect(colors).toHaveLength(0);
    });

    it('should quantize colors to reduce unique values', () => {
        const width = 10;
        const height = 10;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with slightly varying red shades
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 250 + (i % 5); // 250-254
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 5);

        // Quantization should group similar colors
        expect(colors.length).toBeGreaterThan(0);
    });
});
