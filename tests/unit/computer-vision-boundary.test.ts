/**
 * Computer Vision - Boundary and Edge Case Tests
 * Testing extreme conditions, error handling, and boundary values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initCV,
    clearDetectionCache,
    detectGridPositions,
    aggregateDuplicates,
    combineDetections,
    extractDominantColors,
    type CVDetectionResult,
} from '../../src/modules/computer-vision';
import type { AllGameData, Item } from '../../src/types';

describe('Computer Vision - Extreme Resolution Handling', () => {
    beforeEach(() => {
        clearDetectionCache();
    });

    it('should handle very small resolution (320x240)', () => {
        const positions = detectGridPositions(320, 240);

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle very large resolution (7680x4320 - 8K)', () => {
        const positions = detectGridPositions(7680, 4320);

        expect(positions).toBeDefined();
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle ultra-wide resolution (5120x1440)', () => {
        const positions = detectGridPositions(5120, 1440);

        expect(positions).toBeDefined();
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(30);
    });

    it('should handle portrait orientation (1080x1920)', () => {
        const positions = detectGridPositions(1080, 1920);

        expect(positions).toBeDefined();
        // Should still generate positions even in portrait
    });

    it('should handle square resolution (1920x1920)', () => {
        const positions = detectGridPositions(1920, 1920);

        expect(positions).toBeDefined();
        expect(positions.length).toBeGreaterThan(0);
    });

    it('should handle 1-pixel resolution', () => {
        const positions = detectGridPositions(1, 1);

        expect(positions).toBeDefined();
        // Might be empty or have one position
    });

    it('should handle zero width', () => {
        const positions = detectGridPositions(0, 1080);

        expect(positions).toBeDefined();
        expect(positions.length).toBe(0);
    });

    it('should handle zero height', () => {
        const positions = detectGridPositions(1920, 0);

        expect(positions).toBeDefined();
    });

    it('should handle negative dimensions gracefully', () => {
        expect(() => detectGridPositions(-1920, -1080)).not.toThrow();
    });

    it('should handle extremely large grid size parameter', () => {
        const positions = detectGridPositions(1920, 1080, 999999);

        expect(positions).toBeDefined();
    });

    it('should handle zero grid size parameter', () => {
        const positions = detectGridPositions(1920, 1080, 0);

        expect(positions).toBeDefined();
    });

    it('should handle fractional dimensions', () => {
        const positions = detectGridPositions(1920.7, 1080.3);

        expect(positions).toBeDefined();
        expect(positions.length).toBeGreaterThan(0);
    });
});

describe('Computer Vision - Aggregate Duplicates Boundaries', () => {
    const createMockDetection = (id: string, name: string, confidence: number): CVDetectionResult => ({
        type: 'item',
        entity: {
            id,
            name,
            tier: 'A',
            rarity: 'common',
            effects: [],
        } as Item,
        confidence,
        method: 'template_match',
    });

    it('should handle 100+ duplicate detections', () => {
        const detections: CVDetectionResult[] = [];
        for (let i = 0; i < 150; i++) {
            detections.push(createMockDetection('item1', 'Sword', 0.8 + Math.random() * 0.2));
        }

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].count).toBe(150);
    });

    it('should handle detection with confidence of 0', () => {
        const detections = [createMockDetection('item1', 'Test', 0)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].confidence).toBe(0);
    });

    it('should handle detection with confidence of 1.0', () => {
        const detections = [createMockDetection('item1', 'Perfect', 1.0)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].confidence).toBe(1.0);
    });

    it('should handle confidence > 1.0 (edge case)', () => {
        const detections = [createMockDetection('item1', 'Over', 1.5)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].confidence).toBe(1.5);
    });

    it('should handle negative confidence (edge case)', () => {
        const detections = [createMockDetection('item1', 'Negative', -0.5)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].confidence).toBe(-0.5);
    });

    it('should handle very long entity names (500+ chars)', () => {
        const longName = 'A'.repeat(600);
        const detections = [createMockDetection('item1', longName, 0.9)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].entity.name).toBe(longName);
    });

    it('should handle entity names with special characters', () => {
        const specialName = "Test's Item <>&\"'/\\";
        const detections = [createMockDetection('item1', specialName, 0.9)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].entity.name).toBe(specialName);
    });

    it('should handle entity names with unicode characters', () => {
        const unicodeName = '剣の力 ⚔️ 🗡️';
        const detections = [createMockDetection('item1', unicodeName, 0.9)];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].entity.name).toBe(unicodeName);
    });

    it('should handle 1000+ unique items', () => {
        const detections: CVDetectionResult[] = [];
        for (let i = 0; i < 1200; i++) {
            detections.push(createMockDetection(`item${i}`, `Item ${i}`, 0.8));
        }

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated).toHaveLength(1200);
    });

    it('should preserve position with extreme coordinates', () => {
        const detection = {
            ...createMockDetection('item1', 'Test', 0.9),
            position: { x: 999999, y: 888888, width: 777777, height: 666666 },
        };

        const aggregated = aggregateDuplicates([detection]);

        expect(aggregated[0].position).toEqual({ x: 999999, y: 888888, width: 777777, height: 666666 });
    });

    it('should preserve position with negative coordinates', () => {
        const detection = {
            ...createMockDetection('item1', 'Test', 0.9),
            position: { x: -100, y: -200, width: 50, height: 50 },
        };

        const aggregated = aggregateDuplicates([detection]);

        expect(aggregated[0].position).toEqual({ x: -100, y: -200, width: 50, height: 50 });
    });

    it('should handle detections with missing optional fields', () => {
        const detection: CVDetectionResult = {
            type: 'item',
            entity: {
                id: 'item1',
                name: 'Minimal',
            } as Item,
            confidence: 0.8,
            method: 'template_match',
        };

        const aggregated = aggregateDuplicates([detection]);

        expect(aggregated).toHaveLength(1);
    });
});

describe('Computer Vision - Combine Detections Boundaries', () => {
    const createMockDetection = (id: string, name: string, confidence: number): CVDetectionResult => ({
        type: 'item',
        entity: {
            id,
            name,
            tier: 'A',
            rarity: 'common',
            effects: [],
        } as Item,
        confidence,
        method: 'template_match',
    });

    it('should handle 1000+ OCR results', () => {
        const ocrResults: any[] = [];
        for (let i = 0; i < 1200; i++) {
            ocrResults.push({
                type: 'item',
                entity: { id: `item${i}`, name: `Item ${i}` } as Item,
                confidence: 0.8,
                method: 'ocr',
            });
        }

        const combined = combineDetections(ocrResults, []);

        expect(combined).toHaveLength(1200);
    });

    it('should handle 1000+ CV results', () => {
        const cvResults: CVDetectionResult[] = [];
        for (let i = 0; i < 1200; i++) {
            cvResults.push(createMockDetection(`item${i}`, `Item ${i}`, 0.9));
        }

        const combined = combineDetections([], cvResults);

        expect(combined).toHaveLength(1200);
    });

    it('should handle both methods finding 500+ of the same items', () => {
        const ocrResults: any[] = [];
        const cvResults: CVDetectionResult[] = [];

        for (let i = 0; i < 600; i++) {
            ocrResults.push({
                type: 'item',
                entity: { id: `item${i}`, name: `Item ${i}` } as Item,
                confidence: 0.7,
                method: 'ocr',
            });

            cvResults.push(createMockDetection(`item${i}`, `Item ${i}`, 0.7));
        }

        const combined = combineDetections(ocrResults, cvResults);

        // All should be marked as hybrid
        expect(combined).toHaveLength(600);
        combined.forEach(detection => {
            expect(detection.method).toBe('hybrid');
            expect(detection.confidence).toBeGreaterThan(0.7);
        });
    });

    it('should handle confidence boosting near cap', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: { id: 'item1', name: 'Test' } as Item,
                confidence: 0.97,
                method: 'ocr',
            },
        ];

        const cvResults = [createMockDetection('item1', 'Test', 0.97)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].confidence).toBeLessThanOrEqual(0.98);
    });

    it('should handle mismatched entity IDs but same names', () => {
        const ocrResults = [
            {
                type: 'item',
                entity: { id: 'ocr-id', name: 'Same Name' } as Item,
                confidence: 0.8,
                method: 'ocr',
            },
        ];

        const cvResults = [createMockDetection('cv-id', 'Same Name', 0.8)];

        const combined = combineDetections(ocrResults, cvResults);

        // Should treat as different items due to different IDs
        expect(combined).toHaveLength(2);
    });
});

describe('Computer Vision - Dominant Colors Boundaries', () => {
    it('should handle 1x1 pixel image', () => {
        const data = new Uint8ClampedArray([255, 0, 0, 255]); // Single red pixel
        const imageData = { data, width: 1, height: 1, colorSpace: 'srgb' as PredefinedColorSpace };

        const colors = extractDominantColors(imageData, 5);

        expect(colors).toBeDefined();
        expect(colors.length).toBeGreaterThan(0);
    });

    it('should handle very large image (10000x10000)', () => {
        const width = 10000;
        const height = 10000;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with gradient
        for (let i = 0; i < data.length; i += 4) {
            data[i] = (i % 256);
            data[i + 1] = ((i * 2) % 256);
            data[i + 2] = ((i * 3) % 256);
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };

        expect(() => extractDominantColors(imageData, 5)).not.toThrow();
    });

    it('should handle all black pixels', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // All black (0, 0, 0, 255)
        for (let i = 0; i < data.length; i += 4) {
            data[i + 3] = 255; // Alpha only
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeGreaterThan(0);
        expect(colors[0].r).toBe(0);
        expect(colors[0].g).toBe(0);
        expect(colors[0].b).toBe(0);
    });

    it('should handle all white pixels', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // All white
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 5);

        expect(colors.length).toBeGreaterThan(0);
    });

    it('should handle request for zero colors', () => {
        const width = 10;
        const height = 10;
        const data = new Uint8ClampedArray(width * height * 4);

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 0);

        expect(colors).toHaveLength(0);
    });

    it('should handle request for 1000+ colors', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with varying colors
        for (let i = 0; i < data.length; i += 4) {
            data[i] = i % 256;
            data[i + 1] = (i * 2) % 256;
            data[i + 2] = (i * 3) % 256;
            data[i + 3] = 255;
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, 1500);

        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(1500);
    });

    it('should handle transparent pixels (alpha = 0)', () => {
        const width = 10;
        const height = 10;
        const data = new Uint8ClampedArray(width * height * 4);

        // All transparent
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0; // Fully transparent
        }

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };

        expect(() => extractDominantColors(imageData, 5)).not.toThrow();
    });

    it('should handle negative color request', () => {
        const width = 10;
        const height = 10;
        const data = new Uint8ClampedArray(width * height * 4);

        const imageData = { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
        const colors = extractDominantColors(imageData, -5);

        // Should handle gracefully, likely returning empty or limited results
        expect(Array.isArray(colors)).toBe(true);
    });
});

describe('Computer Vision - Initialization Edge Cases', () => {
    it('should handle gameData with empty arrays', () => {
        const emptyData: AllGameData = {
            items: { items: [], version: '1.0.0', last_updated: '2024-01-01' },
            weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
            tomes: { tomes: [], version: '1.0.0', last_updated: '2024-01-01' },
            characters: { characters: [], version: '1.0.0', last_updated: '2024-01-01' },
            shrines: { shrines: [], version: '1.0.0', last_updated: '2024-01-01' },
        };

        expect(() => initCV(emptyData)).not.toThrow();
    });

    it('should handle gameData with 1000+ items', () => {
        const items: any[] = [];
        for (let i = 0; i < 1500; i++) {
            items.push({
                id: `item${i}`,
                name: `Item ${i}`,
                tier: 'A',
                rarity: 'common',
                effects: [],
                image: `item${i}.webp`,
            });
        }

        const largeData: AllGameData = {
            items: { items, version: '1.0.0', last_updated: '2024-01-01' },
            weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
            tomes: { tomes: [], version: '1.0.0', last_updated: '2024-01-01' },
            characters: { characters: [], version: '1.0.0', last_updated: '2024-01-01' },
            shrines: { shrines: [], version: '1.0.0', last_updated: '2024-01-01' },
        };

        expect(() => initCV(largeData)).not.toThrow();
    });

    it('should handle gameData with missing version fields', () => {
        const partialData: any = {
            items: { items: [] },
            weapons: { weapons: [] },
        };

        expect(() => initCV(partialData)).not.toThrow();
    });

    it('should handle multiple rapid initializations', () => {
        const mockData: AllGameData = {
            items: { items: [], version: '1.0.0', last_updated: '2024-01-01' },
            weapons: { weapons: [], version: '1.0.0', last_updated: '2024-01-01' },
            tomes: { tomes: [], version: '1.0.0', last_updated: '2024-01-01' },
            characters: { characters: [], version: '1.0.0', last_updated: '2024-01-01' },
            shrines: { shrines: [], version: '1.0.0', last_updated: '2024-01-01' },
        };

        for (let i = 0; i < 100; i++) {
            initCV(mockData);
        }

        // Should not crash or cause issues
        expect(true).toBe(true);
    });

    it('should handle cache clearing multiple times', () => {
        for (let i = 0; i < 50; i++) {
            clearDetectionCache();
        }

        // Should not crash
        expect(true).toBe(true);
    });
});

describe('Computer Vision - Sorting and Ordering', () => {
    const createDetection = (id: string, name: string): CVDetectionResult => ({
        type: 'item',
        entity: { id, name, tier: 'A', rarity: 'common', effects: [] } as Item,
        confidence: 0.9,
        method: 'template_match',
    });

    it('should sort aggregated results alphabetically', () => {
        const detections = [
            createDetection('z', 'Zebra'),
            createDetection('a', 'Apple'),
            createDetection('m', 'Mango'),
            createDetection('b', 'Banana'),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].entity.name).toBe('Apple');
        expect(aggregated[1].entity.name).toBe('Banana');
        expect(aggregated[2].entity.name).toBe('Mango');
        expect(aggregated[3].entity.name).toBe('Zebra');
    });

    it('should sort case-insensitively', () => {
        const detections = [
            createDetection('1', 'zebra'),
            createDetection('2', 'Apple'),
            createDetection('3', 'BANANA'),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].entity.name).toBe('Apple');
        expect(aggregated[1].entity.name).toBe('BANANA');
        expect(aggregated[2].entity.name).toBe('zebra');
    });

    it('should handle names starting with numbers', () => {
        const detections = [
            createDetection('1', '999 Item'),
            createDetection('2', '1 Item'),
            createDetection('3', '50 Item'),
        ];

        const aggregated = aggregateDuplicates(detections);

        // Should sort lexicographically
        expect(aggregated.length).toBe(3);
    });

    it('should handle names with special characters in sorting', () => {
        const detections = [
            createDetection('1', '@Special'),
            createDetection('2', 'Normal'),
            createDetection('3', '#Hash'),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated.length).toBe(3);
    });
});
