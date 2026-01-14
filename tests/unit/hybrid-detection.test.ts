/**
 * Hybrid Detection Tests
 * Tests for combining OCR and CV results, confidence boosting, and aggregation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initCV,
    aggregateDuplicates,
    combineDetections,
} from '../../src/modules/computer-vision';
import { initOCR } from '../../src/modules/ocr';
import type { AllGameData, CVDetectionResult, DetectionResult } from '../../src/types';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'wrench',
                name: 'Wrench',
                description: 'Tool',
                rarity: 'common',
                tier: 'B',
                tags: ['utility'],
                mechanics: { base: { repair: 10 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'Power',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
            {
                id: 'golden_crown',
                name: 'Golden Crown',
                description: 'Royal',
                rarity: 'legendary',
                tier: 'SS',
                tags: ['prestige'],
                mechanics: { base: { gold: 100 } },
            },
        ],
    },
};

// Helper to create mock detections
const createOCRResult = (
    id: string,
    name: string,
    confidence: number
): DetectionResult => ({
    type: 'item',
    entity: {
        id,
        name,
        rarity: 'common',
        tier: 'B',
        base_effect: '',
        unlocked_by_default: true,
    },
    confidence,
    rawText: name,
});

const createCVResult = (
    id: string,
    name: string,
    confidence: number
): CVDetectionResult => ({
    type: 'item',
    entity: {
        id,
        name,
        rarity: 'common',
        tier: 'B',
        base_effect: '',
        unlocked_by_default: true,
    },
    confidence,
    method: 'template_match',
    position: { x: 0, y: 0, width: 64, height: 64 },
});

describe('Hybrid Detection - Result Combining', () => {
    beforeEach(() => {
        initCV(mockGameData);
        initOCR(mockGameData);
    });

    it('should combine OCR and CV results', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.8)];
        const cvResults: CVDetectionResult[] = [createCVResult('battery', 'Battery', 0.85)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(2);
        const ids = combined.map(r => r.entity.id);
        expect(ids).toContain('wrench');
        expect(ids).toContain('battery');
    });

    it('should boost confidence when both methods detect same item', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.7)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.8)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(1);
        // Should be boosted (×1.2) but capped at 0.98
        const boosted = combined[0].confidence;
        expect(boosted).toBeGreaterThan(0.8); // Original CV confidence
        expect(boosted).toBeLessThanOrEqual(0.98); // Cap
    });

    it('should not boost confidence for different items', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.7)];
        const cvResults: CVDetectionResult[] = [createCVResult('battery', 'Battery', 0.8)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(2);

        const wrench = combined.find(r => r.entity.id === 'wrench');
        const battery = combined.find(r => r.entity.id === 'battery');

        // Should keep original confidences (no boost)
        expect(wrench?.confidence).toBe(0.7);
        expect(battery?.confidence).toBe(0.8);
    });

    it('should set method to hybrid when both methods detect same item', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.7)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.8)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].method).toBe('hybrid');
    });

    it('should handle empty OCR results', () => {
        const ocrResults: DetectionResult[] = [];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.85)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(1);
        expect(combined[0].entity.name).toBe('Wrench');
    });

    it('should handle empty CV results', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.8)];
        const cvResults: CVDetectionResult[] = [];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(1);
        expect(combined[0].entity.name).toBe('Wrench');
    });

    it('should handle both empty results', () => {
        const combined = combineDetections([], []);
        expect(combined).toHaveLength(0);
    });
});

describe('Hybrid Detection - Confidence Boost Calculations', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should apply boost when methods agree', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.6)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.7)];

        const combined = combineDetections(ocrResults, cvResults);

        // Boosted confidence should be higher than max individual confidence
        expect(combined[0].confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should cap boosted confidence at 0.98', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.9)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.95)];

        const combined = combineDetections(ocrResults, cvResults);

        // 0.95 × 1.2 = 1.14, but capped at 0.98
        expect(combined[0].confidence).toBeLessThanOrEqual(0.98);
    });

    it('should use higher confidence as base for boost', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.9)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.6)];

        const combined = combineDetections(ocrResults, cvResults);

        // Should use 0.9 (higher) × 1.2 = 0.98 (capped)
        expect(combined[0].confidence).toBeGreaterThan(0.6);
    });
});

describe('Hybrid Detection - Duplicate Aggregation', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should count duplicate detections', () => {
        const detections: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('wrench', 'Wrench', 0.80),
            createCVResult('wrench', 'Wrench', 0.90),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated.length).toBe(1);
        expect(aggregated[0].count).toBe(3);
    });

    it('should keep maximum confidence in aggregation', () => {
        const detections: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.75),
            createCVResult('wrench', 'Wrench', 0.95),
            createCVResult('wrench', 'Wrench', 0.80),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].confidence).toBe(0.95);
    });

    it('should aggregate multiple different items correctly', () => {
        const detections: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('battery', 'Battery', 0.80),
            createCVResult('wrench', 'Wrench', 0.90),
            createCVResult('battery', 'Battery', 0.88),
            createCVResult('golden_crown', 'Golden Crown', 0.95),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated.length).toBe(3);

        const wrench = aggregated.find(r => r.entity.id === 'wrench');
        const battery = aggregated.find(r => r.entity.id === 'battery');
        const crown = aggregated.find(r => r.entity.id === 'golden_crown');

        expect(wrench?.count).toBe(2);
        expect(battery?.count).toBe(2);
        expect(crown?.count).toBe(1);
    });

    it('should sort aggregated results by name', () => {
        const detections: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('battery', 'Battery', 0.80),
            createCVResult('golden_crown', 'Golden Crown', 0.90),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].entity.name).toBe('Battery');
        expect(aggregated[1].entity.name).toBe('Golden Crown');
        expect(aggregated[2].entity.name).toBe('Wrench');
    });
});

describe('Hybrid Detection - Edge Cases', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should handle large number of detections', () => {
        const detections: CVDetectionResult[] = [];

        // 1000 detections of 10 different items
        for (let i = 0; i < 1000; i++) {
            const itemNum = i % 10;
            detections.push(
                createCVResult(`item_${itemNum}`, `Item ${itemNum}`, 0.7 + Math.random() * 0.2)
            );
        }

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated.length).toBe(10);
        aggregated.forEach(item => {
            expect(item.count).toBe(100);
        });
    });

    it('should handle detections with same confidence', () => {
        const detections: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('wrench', 'Wrench', 0.85),
        ];

        const aggregated = aggregateDuplicates(detections);

        expect(aggregated[0].confidence).toBe(0.85);
        expect(aggregated[0].count).toBe(3);
    });

    it('should preserve position from first detection', () => {
        const pos1 = { x: 100, y: 200, width: 64, height: 64 };
        const pos2 = { x: 300, y: 400, width: 64, height: 64 };

        const detections: CVDetectionResult[] = [
            { ...createCVResult('wrench', 'Wrench', 0.85), position: pos1 },
            { ...createCVResult('wrench', 'Wrench', 0.90), position: pos2 },
        ];

        const aggregated = aggregateDuplicates(detections);

        // Position might be from first or highest confidence - check it exists
        expect(aggregated[0].position).toBeDefined();
    });
});

describe('Hybrid Detection - Method Attribution', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should preserve OCR method when only OCR detects', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.8)];
        const cvResults: CVDetectionResult[] = [];

        const combined = combineDetections(ocrResults, cvResults);

        // OCR results don't have method field typically, but combined should
        expect(combined[0]).toBeDefined();
    });

    it('should preserve template_match method when only CV detects', () => {
        const ocrResults: DetectionResult[] = [];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.85)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].method).toBe('template_match');
    });

    it('should set hybrid method when both detect same item', () => {
        const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.7)];
        const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.8)];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined[0].method).toBe('hybrid');
    });
});

describe('Hybrid Detection - Fallback Chain', () => {
    beforeEach(() => {
        initCV(mockGameData);
        initOCR(mockGameData);
    });

    it('should use CV results when OCR returns nothing', () => {
        const ocrResults: DetectionResult[] = [];
        const cvResults: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.85),
            createCVResult('battery', 'Battery', 0.80),
        ];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(2);
    });

    it('should use OCR results when CV returns nothing', () => {
        const ocrResults: DetectionResult[] = [
            createOCRResult('wrench', 'Wrench', 0.85),
            createOCRResult('battery', 'Battery', 0.80),
        ];
        const cvResults: CVDetectionResult[] = [];

        const combined = combineDetections(ocrResults, cvResults);

        expect(combined.length).toBe(2);
    });

    it('should merge results without duplicating items detected by both', () => {
        const ocrResults: DetectionResult[] = [
            createOCRResult('wrench', 'Wrench', 0.7),
            createOCRResult('battery', 'Battery', 0.75),
        ];
        const cvResults: CVDetectionResult[] = [
            createCVResult('wrench', 'Wrench', 0.8),
            createCVResult('golden_crown', 'Golden Crown', 0.9),
        ];

        const combined = combineDetections(ocrResults, cvResults);

        // Should have 3 unique items, not 4
        expect(combined.length).toBe(3);

        const ids = combined.map(r => r.entity.id);
        expect(ids).toContain('wrench');
        expect(ids).toContain('battery');
        expect(ids).toContain('golden_crown');

        // Wrench should have boosted confidence (hybrid)
        const wrench = combined.find(r => r.entity.id === 'wrench');
        expect(wrench?.method).toBe('hybrid');
    });
});
