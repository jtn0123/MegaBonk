// ========================================
// CV Aggregation Module - Unit Tests
// ========================================

import { describe, it, expect } from 'vitest';
import { aggregateDuplicates, combineDetections } from '../../src/modules/cv/aggregation.ts';
import type { CVDetectionResult } from '../../src/modules/cv/types.ts';

// Helper to create mock detection results
function createDetection(
    id: string,
    name: string,
    confidence: number,
    type: CVDetectionResult['type'] = 'item',
    method: CVDetectionResult['method'] = 'template_match',
    position?: { x: number; y: number; width: number; height: number }
): CVDetectionResult {
    return {
        type,
        entity: { id, name } as CVDetectionResult['entity'],
        confidence,
        method,
        position,
    };
}

describe('aggregateDuplicates', () => {
    describe('Basic Aggregation', () => {
        it('should return empty array for empty input', () => {
            const result = aggregateDuplicates([]);
            expect(result).toEqual([]);
        });

        it('should return single item with count 1', () => {
            const detections = [createDetection('sword', 'Sword', 0.9)];
            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('sword');
            expect(result[0].count).toBe(1);
        });

        it('should aggregate duplicate items with correct count', () => {
            const detections = [
                createDetection('wrench', 'Wrench', 0.8),
                createDetection('wrench', 'Wrench', 0.7),
                createDetection('wrench', 'Wrench', 0.9),
            ];
            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('wrench');
            expect(result[0].count).toBe(3);
        });

        it('should keep separate entries for different items', () => {
            const detections = [
                createDetection('sword', 'Sword', 0.8),
                createDetection('shield', 'Shield', 0.9),
                createDetection('potion', 'Potion', 0.7),
            ];
            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(3);
        });
    });

    describe('Confidence Handling', () => {
        it('should use highest confidence from group', () => {
            const detections = [
                createDetection('sword', 'Sword', 0.6),
                createDetection('sword', 'Sword', 0.9),
                createDetection('sword', 'Sword', 0.7),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBe(0.9);
        });

        it('should handle confidence values at boundaries', () => {
            const detections = [
                createDetection('item', 'Item', 0.0),
                createDetection('item', 'Item', 1.0),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBe(1.0);
        });

        it('should handle very small confidence differences', () => {
            const detections = [
                createDetection('item', 'Item', 0.8999999),
                createDetection('item', 'Item', 0.9000001),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBeCloseTo(0.9000001);
        });
    });

    describe('Position Handling', () => {
        it('should keep first detection position', () => {
            const position1 = { x: 10, y: 20, width: 50, height: 50 };
            const position2 = { x: 60, y: 20, width: 50, height: 50 };

            const detections = [
                createDetection('item', 'Item', 0.7, 'item', 'template_match', position1),
                createDetection('item', 'Item', 0.8, 'item', 'template_match', position2),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].position).toEqual(position1);
        });

        it('should handle missing positions', () => {
            const detections = [
                createDetection('item', 'Item', 0.7),
                createDetection('item', 'Item', 0.8),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].position).toBeUndefined();
        });
    });

    describe('Sorting', () => {
        it('should sort results by entity name alphabetically', () => {
            const detections = [
                createDetection('zebra', 'Zebra Item', 0.8),
                createDetection('apple', 'Apple Item', 0.8),
                createDetection('middle', 'Middle Item', 0.8),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].entity.name).toBe('Apple Item');
            expect(result[1].entity.name).toBe('Middle Item');
            expect(result[2].entity.name).toBe('Zebra Item');
        });

        it('should handle case sensitivity in sorting', () => {
            const detections = [
                createDetection('upper', 'UPPER', 0.8),
                createDetection('lower', 'lower', 0.8),
                createDetection('mixed', 'Mixed', 0.8),
            ];
            const result = aggregateDuplicates(detections);

            // localeCompare sorts uppercase before lowercase by default
            expect(result).toHaveLength(3);
        });
    });

    describe('Count Handling', () => {
        it('should handle detections with existing counts', () => {
            const detections = [
                { ...createDetection('item', 'Item', 0.8), count: 3 },
                { ...createDetection('item', 'Item', 0.9), count: 2 },
            ] as Array<CVDetectionResult & { count?: number }>;

            const result = aggregateDuplicates(detections);

            expect(result[0].count).toBe(5); // 3 + 2
        });

        it('should default count to 1 when not specified', () => {
            const detections = [
                createDetection('item', 'Item', 0.8),
                createDetection('item', 'Item', 0.9),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].count).toBe(2);
        });
    });

    describe('Type Preservation', () => {
        it('should preserve type from first detection', () => {
            const detections = [
                createDetection('item1', 'Item 1', 0.8, 'weapon'),
                createDetection('item1', 'Item 1', 0.9, 'item'),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].type).toBe('weapon');
        });

        it('should preserve method from first detection', () => {
            const detections = [
                createDetection('item1', 'Item 1', 0.8, 'item', 'icon_similarity'),
                createDetection('item1', 'Item 1', 0.9, 'item', 'template_match'),
            ];
            const result = aggregateDuplicates(detections);

            expect(result[0].method).toBe('icon_similarity');
        });
    });

    describe('Large Datasets', () => {
        it('should handle many duplicates efficiently', () => {
            const detections: CVDetectionResult[] = [];
            for (let i = 0; i < 100; i++) {
                detections.push(createDetection('item', 'Item', 0.5 + Math.random() * 0.5));
            }

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(100);
        });

        it('should handle many unique items', () => {
            const detections: CVDetectionResult[] = [];
            for (let i = 0; i < 50; i++) {
                detections.push(createDetection(`item_${i}`, `Item ${i}`, 0.8));
            }

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(50);
        });
    });
});

describe('combineDetections', () => {
    describe('Basic Combining', () => {
        it('should return empty array for empty inputs', () => {
            const result = combineDetections([], []);
            expect(result).toEqual([]);
        });

        it('should return OCR results when no CV results', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.8, method: 'ocr' },
            ];
            const result = combineDetections(ocrResults, []);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('sword');
        });

        it('should return CV results when no OCR results', () => {
            const cvResults = [createDetection('shield', 'Shield', 0.9)];
            const result = combineDetections([], cvResults);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('shield');
        });
    });

    describe('Confidence Boosting', () => {
        it('should boost confidence when both methods agree', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7, method: 'ocr' },
            ];
            const cvResults = [createDetection('sword', 'Sword', 0.8)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(1);
            // First one added gets boosted when second is found
            expect(result[0].confidence).toBeGreaterThan(0.7);
            expect(result[0].method).toBe('hybrid');
        });

        it('should cap boosted confidence at 0.98', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.95, method: 'ocr' },
            ];
            const cvResults = [createDetection('sword', 'Sword', 0.95)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].confidence).toBeLessThanOrEqual(0.98);
        });
    });

    describe('Deduplication', () => {
        it('should not duplicate items found by both methods', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7, method: 'ocr' },
            ];
            const cvResults = [createDetection('sword', 'Sword', 0.8)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(1);
        });

        it('should keep different items from both sources', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7 },
            ];
            const cvResults = [createDetection('shield', 'Shield', 0.8)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(2);
        });

        it('should differentiate by type as well as id', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7 },
            ];
            const cvResults = [
                createDetection('sword', 'Sword', 0.8, 'weapon'),
            ];

            const result = combineDetections(ocrResults, cvResults);

            // Different types = different entries
            expect(result).toHaveLength(2);
        });
    });

    describe('Sorting', () => {
        it('should sort results by confidence descending', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'low', name: 'Low' }, confidence: 0.5 },
                { type: 'item', entity: { id: 'high', name: 'High' }, confidence: 0.9 },
            ];
            const cvResults = [createDetection('medium', 'Medium', 0.7)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].entity.id).toBe('high');
            expect(result[1].entity.id).toBe('medium');
            expect(result[2].entity.id).toBe('low');
        });
    });

    describe('Method Assignment', () => {
        it('should default method to template_match when not specified', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7 },
            ];

            const result = combineDetections(ocrResults, []);

            expect(result[0].method).toBe('template_match');
        });

        it('should preserve specified method', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7, method: 'icon_similarity' },
            ];

            const result = combineDetections(ocrResults, []);

            expect(result[0].method).toBe('icon_similarity');
        });
    });

    describe('Position Handling', () => {
        it('should preserve position data', () => {
            const position = { x: 10, y: 20, width: 50, height: 50 };
            const cvResults = [createDetection('sword', 'Sword', 0.8, 'item', 'template_match', position)];

            const result = combineDetections([], cvResults);

            expect(result[0].position).toEqual(position);
        });

        it('should handle undefined positions', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'sword', name: 'Sword' }, confidence: 0.7 },
            ];

            const result = combineDetections(ocrResults, []);

            expect(result[0].position).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle identical confidence values', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'a', name: 'A' }, confidence: 0.8 },
                { type: 'item', entity: { id: 'b', name: 'B' }, confidence: 0.8 },
            ];

            const result = combineDetections(ocrResults, []);

            expect(result).toHaveLength(2);
        });

        it('should handle zero confidence', () => {
            const ocrResults = [
                { type: 'item', entity: { id: 'zero', name: 'Zero' }, confidence: 0 },
            ];

            const result = combineDetections(ocrResults, []);

            expect(result).toHaveLength(1);
            expect(result[0].confidence).toBe(0);
        });
    });
});
