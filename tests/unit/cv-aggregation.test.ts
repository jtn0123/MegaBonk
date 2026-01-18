/**
 * @vitest-environment jsdom
 * CV Aggregation Module - Comprehensive Tests
 * Tests for result aggregation, duplicate detection, and hybrid detection
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    aggregateDuplicates,
    combineDetections,
} from '../../src/modules/cv/aggregation.ts';

import type { CVDetectionResult } from '../../src/modules/cv/types.ts';

// ========================================
// Test Data Factories
// ========================================

const createDetectionResult = (
    id: string,
    name: string,
    confidence: number = 0.9,
    type: CVDetectionResult['type'] = 'item',
    method: CVDetectionResult['method'] = 'template_match'
): CVDetectionResult => ({
    type,
    entity: { id, name },
    confidence,
    position: { x: 0, y: 0, width: 64, height: 64 },
    method,
});

const createBaseDetectionResult = (
    id: string,
    name: string,
    confidence: number = 0.9,
    type: string = 'item',
    method?: string
) => ({
    type,
    entity: { id, name },
    confidence,
    position: { x: 0, y: 0, width: 64, height: 64 },
    method,
});

// ========================================
// Test Suite
// ========================================

describe('CV Aggregation Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // aggregateDuplicates Tests
    // ========================================
    describe('aggregateDuplicates', () => {
        it('should return empty array for empty input', () => {
            const result = aggregateDuplicates([]);

            expect(result).toEqual([]);
        });

        it('should return single item with count 1', () => {
            const detections = [createDetectionResult('sword', 'Sword')];

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('sword');
            expect(result[0].count).toBe(1);
        });

        it('should aggregate duplicate items with count', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.9),
                createDetectionResult('sword', 'Sword', 0.85),
                createDetectionResult('sword', 'Sword', 0.8),
            ];

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('sword');
            expect(result[0].count).toBe(3);
        });

        it('should use highest confidence from group', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.7),
                createDetectionResult('sword', 'Sword', 0.95),
                createDetectionResult('sword', 'Sword', 0.8),
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBe(0.95);
        });

        it('should keep first detection position', () => {
            const detections = [
                { ...createDetectionResult('sword', 'Sword'), position: { x: 10, y: 20, width: 64, height: 64 } },
                { ...createDetectionResult('sword', 'Sword'), position: { x: 100, y: 200, width: 64, height: 64 } },
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].position?.x).toBe(10);
            expect(result[0].position?.y).toBe(20);
        });

        it('should handle multiple different items', () => {
            const detections = [
                createDetectionResult('sword', 'Sword'),
                createDetectionResult('shield', 'Shield'),
                createDetectionResult('potion', 'Potion'),
            ];

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(3);
            expect(result.map(r => r.entity.id)).toContain('sword');
            expect(result.map(r => r.entity.id)).toContain('shield');
            expect(result.map(r => r.entity.id)).toContain('potion');
        });

        it('should aggregate mixed duplicates correctly', () => {
            const detections = [
                createDetectionResult('sword', 'Sword'),
                createDetectionResult('shield', 'Shield'),
                createDetectionResult('sword', 'Sword'),
                createDetectionResult('potion', 'Potion'),
                createDetectionResult('sword', 'Sword'),
            ];

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(3);

            const swordResult = result.find(r => r.entity.id === 'sword');
            expect(swordResult?.count).toBe(3);

            const shieldResult = result.find(r => r.entity.id === 'shield');
            expect(shieldResult?.count).toBe(1);
        });

        it('should sort results by entity name', () => {
            const detections = [
                createDetectionResult('zebra', 'Zebra'),
                createDetectionResult('apple', 'Apple'),
                createDetectionResult('mango', 'Mango'),
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].entity.name).toBe('Apple');
            expect(result[1].entity.name).toBe('Mango');
            expect(result[2].entity.name).toBe('Zebra');
        });

        it('should preserve type from first detection', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.9, 'item'),
                createDetectionResult('sword', 'Sword', 0.8, 'item'),
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].type).toBe('item');
        });

        it('should preserve method from first detection', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.9, 'item', 'template_match'),
                createDetectionResult('sword', 'Sword', 0.8, 'item', 'ocr'),
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].method).toBe('template_match');
        });

        it('should handle detections with existing count field', () => {
            const detections = [
                { ...createDetectionResult('sword', 'Sword'), count: 2 } as CVDetectionResult & { count: number },
                { ...createDetectionResult('sword', 'Sword'), count: 3 } as CVDetectionResult & { count: number },
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].count).toBe(5); // 2 + 3
        });

        it('should handle different entity types separately', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.9, 'item'),
                createDetectionResult('sword', 'Sword', 0.9, 'weapon'),
            ];

            const result = aggregateDuplicates(detections);

            // Same ID but different types - still grouped by ID
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(2);
        });
    });

    // ========================================
    // combineDetections Tests
    // ========================================
    describe('combineDetections', () => {
        it('should return empty array for empty inputs', () => {
            const result = combineDetections([], []);

            expect(result).toEqual([]);
        });

        it('should include OCR-only results', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.8)];
            const cvResults: CVDetectionResult[] = [];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('sword');
        });

        it('should include CV-only results', () => {
            const ocrResults: any[] = [];
            const cvResults = [createDetectionResult('shield', 'Shield', 0.85)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(1);
            expect(result[0].entity.id).toBe('shield');
        });

        it('should combine OCR and CV results', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.8)];
            const cvResults = [createDetectionResult('shield', 'Shield', 0.85)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(2);
            expect(result.map(r => r.entity.id)).toContain('sword');
            expect(result.map(r => r.entity.id)).toContain('shield');
        });

        it('should boost confidence when both methods detect same item', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.7, 'item', 'ocr')];
            const cvResults = [createDetectionResult('sword', 'Sword', 0.7, 'item', 'template_match')];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(1);
            expect(result[0].confidence).toBeGreaterThan(0.7);
        });

        it('should mark hybrid detection method', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.7, 'item', 'ocr')];
            const cvResults = [createDetectionResult('sword', 'Sword', 0.7, 'item', 'template_match')];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].method).toBe('hybrid');
        });

        it('should cap boosted confidence at 0.98', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.95, 'item')];
            const cvResults = [createDetectionResult('sword', 'Sword', 0.95, 'item')];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].confidence).toBeLessThanOrEqual(0.98);
        });

        it('should sort results by confidence (descending)', () => {
            const ocrResults = [
                createBaseDetectionResult('low', 'Low Item', 0.5),
                createBaseDetectionResult('high', 'High Item', 0.95),
            ];
            const cvResults = [createDetectionResult('mid', 'Mid Item', 0.7)];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].entity.id).toBe('high');
            expect(result[1].entity.id).toBe('mid');
            expect(result[2].entity.id).toBe('low');
        });

        it('should handle same entity with different types', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.8, 'item')];
            const cvResults = [createDetectionResult('sword', 'Sword', 0.8, 'weapon')];

            const result = combineDetections(ocrResults, cvResults);

            // Different types = different entries
            expect(result).toHaveLength(2);
        });

        it('should preserve position from first detection', () => {
            const ocrResults = [
                {
                    ...createBaseDetectionResult('sword', 'Sword', 0.8),
                    position: { x: 10, y: 20, width: 64, height: 64 },
                },
            ];
            const cvResults: CVDetectionResult[] = [];

            const result = combineDetections(ocrResults, cvResults);

            expect(result[0].position?.x).toBe(10);
            expect(result[0].position?.y).toBe(20);
        });

        it('should use template_match as default method', () => {
            const ocrResults = [createBaseDetectionResult('sword', 'Sword', 0.8)];
            // No method specified

            const result = combineDetections(ocrResults, []);

            expect(result[0].method).toBe('template_match');
        });

        it('should handle multiple duplicates from both sources', () => {
            const ocrResults = [
                createBaseDetectionResult('sword', 'Sword', 0.7, 'item'),
                createBaseDetectionResult('shield', 'Shield', 0.6, 'item'),
            ];
            const cvResults = [
                createDetectionResult('sword', 'Sword', 0.75, 'item'),
                createDetectionResult('potion', 'Potion', 0.8, 'item'),
            ];

            const result = combineDetections(ocrResults, cvResults);

            expect(result).toHaveLength(3);

            const swordResult = result.find(r => r.entity.id === 'sword');
            expect(swordResult?.method).toBe('hybrid');
            expect(swordResult?.confidence).toBeGreaterThan(0.75);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support typical workflow: combine then aggregate', () => {
            // Note: combineDetections deduplicates by entity_id + type, boosting confidence for matches
            // So multiple OCR detections of same item become one entry with boosted confidence
            const ocrResults = [
                createBaseDetectionResult('sword', 'Sword', 0.7, 'item'),
            ];
            const cvResults = [
                createDetectionResult('sword', 'Sword', 0.75, 'item'),
                createDetectionResult('shield', 'Shield', 0.8, 'item'),
            ];

            // First combine OCR and CV
            const combined = combineDetections(ocrResults, cvResults);

            // Then aggregate duplicates
            const aggregated = aggregateDuplicates(combined);

            expect(aggregated).toHaveLength(2);

            const swordResult = aggregated.find(r => r.entity.id === 'sword');
            expect(swordResult?.count).toBe(1); // Deduplicated in combineDetections
            expect(swordResult?.method).toBe('hybrid'); // Detected by both
        });

        it('should handle real-world detection scenario', () => {
            // combineDetections deduplicates, so we get one entry per unique entity+type
            const ocrResults = [
                createBaseDetectionResult('sword', 'Sword', 0.8, 'item', 'ocr'),
                createBaseDetectionResult('shield', 'Shield', 0.75, 'item', 'ocr'),
            ];
            const cvResults = [
                createDetectionResult('sword', 'Sword', 0.85, 'item'),
                createDetectionResult('shield', 'Shield', 0.78, 'item'),
                createDetectionResult('potion', 'Potion', 0.9, 'item'),
            ];

            const combined = combineDetections(ocrResults, cvResults);
            const aggregated = aggregateDuplicates(combined);

            expect(aggregated).toHaveLength(3);

            const swordResult = aggregated.find(r => r.entity.id === 'sword');
            expect(swordResult?.count).toBe(1); // Deduplicated
            expect(swordResult?.method).toBe('hybrid');

            const shieldResult = aggregated.find(r => r.entity.id === 'shield');
            expect(shieldResult?.count).toBe(1);
            expect(shieldResult?.method).toBe('hybrid');

            const potionResult = aggregated.find(r => r.entity.id === 'potion');
            expect(potionResult?.count).toBe(1);
        });

        it('should aggregate duplicates from CV-only detections', () => {
            // When we want to count multiple detections, use aggregateDuplicates directly
            const cvResults = [
                createDetectionResult('sword', 'Sword', 0.85, 'item'),
                createDetectionResult('sword', 'Sword', 0.82, 'item'),
                createDetectionResult('sword', 'Sword', 0.8, 'item'),
                createDetectionResult('shield', 'Shield', 0.9, 'item'),
            ];

            const aggregated = aggregateDuplicates(cvResults);

            expect(aggregated).toHaveLength(2);

            const swordResult = aggregated.find(r => r.entity.id === 'sword');
            expect(swordResult?.count).toBe(3);
            expect(swordResult?.confidence).toBe(0.85); // Highest confidence

            const shieldResult = aggregated.find(r => r.entity.id === 'shield');
            expect(shieldResult?.count).toBe(1);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle very low confidence values', () => {
            const detections = [
                createDetectionResult('sword', 'Sword', 0.01),
                createDetectionResult('sword', 'Sword', 0.02),
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBe(0.02);
        });

        it('should handle confidence at boundary (1.0)', () => {
            const detections = [createDetectionResult('sword', 'Sword', 1.0)];

            const result = aggregateDuplicates(detections);

            expect(result[0].confidence).toBe(1.0);
        });

        it('should handle large number of detections', () => {
            const detections = Array.from({ length: 100 }, (_, i) =>
                createDetectionResult(`item_${i % 10}`, `Item ${i % 10}`, 0.8)
            );

            const result = aggregateDuplicates(detections);

            expect(result).toHaveLength(10);
            result.forEach(r => {
                expect(r.count).toBe(10);
            });
        });

        it('should handle undefined position', () => {
            const detections = [
                { ...createDetectionResult('sword', 'Sword'), position: undefined },
            ];

            const result = aggregateDuplicates(detections);

            expect(result[0].position).toBeUndefined();
        });

        it('should handle empty entity name', () => {
            const detections = [createDetectionResult('sword', '', 0.9)];

            const result = aggregateDuplicates(detections);

            expect(result[0].entity.name).toBe('');
        });

        it('should handle special characters in entity name', () => {
            const detections = [createDetectionResult('special', "Sword's Edge + 1", 0.9)];

            const result = aggregateDuplicates(detections);

            expect(result[0].entity.name).toBe("Sword's Edge + 1");
        });
    });
});
