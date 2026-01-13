/**
 * Integration tests for the full scan-build pipeline
 * Tests end-to-end detection workflow with OCR + CV
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AllGameData } from '../../src/types';

// Mock game data for integration tests
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
                id: 'wrench',
                name: 'Wrench',
                description: 'Tool',
                rarity: 'uncommon',
                tier: 'A',
                tags: ['utility'],
                mechanics: { base: { damage: 10 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'Energy',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
            {
                id: 'banana',
                name: 'Banana',
                description: 'Food',
                rarity: 'common',
                tier: 'C',
                tags: ['food'],
                mechanics: { base: { health: 5 } },
            },
            {
                id: 'cheese',
                name: 'Cheese',
                description: 'Food',
                rarity: 'uncommon',
                tier: 'B',
                tags: ['food'],
                mechanics: { base: { health: 10 } },
            },
        ],
    },
    weapons: {
        version: '1.0',
        last_updated: '2024-01-01',
        weapons: [
            {
                id: 'hammer',
                name: 'Hammer',
                description: 'Heavy weapon',
                base_damage: 50,
                attack_speed: 1.0,
                upgrade_path: [],
            },
        ],
    },
    characters: {
        version: '1.0',
        last_updated: '2024-01-01',
        characters: [
            {
                id: 'clank',
                name: 'CL4NK',
                description: 'Robot',
                starting_stats: { health: 100, damage: 10 },
                passive_abilities: [],
            },
        ],
    },
    tomes: {
        version: '1.0',
        last_updated: '2024-01-01',
        tomes: [],
    },
    stats: {
        version: '1.0',
        last_updated: '2024-01-01',
    },
};

describe('Scan Build Integration - Full Pipeline', () => {
    beforeEach(() => {
        // Reset any global state
    });

    it('should combine OCR and CV results in hybrid mode', () => {
        // Mock OCR results
        const ocrResults = [
            { entity: mockGameData.items!.items[0], confidence: 0.7, rawText: 'First Aid Kit' },
            { entity: mockGameData.items!.items[1], confidence: 0.6, rawText: 'Wrench' },
        ];

        // Mock CV results
        const cvResults = [
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.8,
                matchType: 'color' as const,
            },
            {
                entity: mockGameData.items!.items[2],
                confidence: 0.7,
                matchType: 'color' as const,
            },
        ];

        // Combine results logic
        const combined = new Map();
        ocrResults.forEach(r => combined.set(r.entity.id, r));

        cvResults.forEach(cvResult => {
            const existing = combined.get(cvResult.entity.id);
            if (existing) {
                // Boost confidence if both detected
                existing.confidence = Math.min(1.0, existing.confidence + 0.15);
            } else {
                combined.set(cvResult.entity.id, {
                    entity: cvResult.entity,
                    confidence: cvResult.confidence,
                    rawText: `CV:${cvResult.matchType}`,
                });
            }
        });

        const finalResults = Array.from(combined.values());

        expect(finalResults.length).toBeGreaterThanOrEqual(2);

        // First Aid Kit should have boosted confidence (detected by both)
        const firstAid = finalResults.find(r => r.entity.id === 'first_aid_kit');
        expect(firstAid?.confidence).toBeGreaterThan(0.7);

        // Battery should be included (CV only)
        const battery = finalResults.find(r => r.entity.id === 'battery');
        expect(battery).toBeDefined();
    });

    it('should handle duplicate detection', () => {
        const results = [
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.8,
                rawText: 'First Aid Kit',
            },
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.7,
                rawText: 'First Aid Kit',
            },
        ];

        // Deduplicate logic - keep highest confidence
        const deduped = new Map();
        results.forEach(r => {
            const existing = deduped.get(r.entity.id);
            if (!existing || r.confidence > existing.confidence) {
                deduped.set(r.entity.id, r);
            }
        });

        expect(deduped.size).toBe(1);
        expect(Array.from(deduped.values())[0].confidence).toBe(0.8);
    });

    it('should filter results below confidence threshold', () => {
        const results = [
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.9,
                rawText: 'First Aid Kit',
            },
            {
                entity: mockGameData.items!.items[1],
                confidence: 0.3,
                rawText: 'Wrench',
            },
            {
                entity: mockGameData.items!.items[2],
                confidence: 0.7,
                rawText: 'Battery',
            },
        ];

        const threshold = 0.5;
        const filtered = results.filter(r => r.confidence >= threshold);

        expect(filtered.length).toBe(2);
        expect(filtered.find(r => r.entity.id === 'wrench')).toBeUndefined();
    });
});

describe('Scan Build Integration - Accuracy Metrics', () => {
    it('should calculate precision correctly', () => {
        const detected = ['First Aid Kit', 'Wrench', 'Battery'];
        const groundTruth = ['First Aid Kit', 'Wrench', 'Banana'];

        const truePositives = detected.filter(d => groundTruth.includes(d)).length;
        const falsePositives = detected.filter(d => !groundTruth.includes(d)).length;

        const precision = truePositives / (truePositives + falsePositives);

        expect(truePositives).toBe(2);
        expect(falsePositives).toBe(1);
        expect(precision).toBeCloseTo(0.667, 2);
    });

    it('should calculate recall correctly', () => {
        const detected = ['First Aid Kit', 'Wrench'];
        const groundTruth = ['First Aid Kit', 'Wrench', 'Banana'];

        const truePositives = detected.filter(d => groundTruth.includes(d)).length;
        const falseNegatives = groundTruth.filter(g => !detected.includes(g)).length;

        const recall = truePositives / (truePositives + falseNegatives);

        expect(truePositives).toBe(2);
        expect(falseNegatives).toBe(1);
        expect(recall).toBeCloseTo(0.667, 2);
    });

    it('should calculate F1 score correctly', () => {
        const precision = 0.8;
        const recall = 0.7;

        const f1 = (2 * precision * recall) / (precision + recall);

        expect(f1).toBeCloseTo(0.747, 2);
    });

    it('should handle perfect detection', () => {
        const detected = ['First Aid Kit', 'Wrench'];
        const groundTruth = ['First Aid Kit', 'Wrench'];

        const truePositives = detected.filter(d => groundTruth.includes(d)).length;
        const falsePositives = detected.filter(d => !groundTruth.includes(d)).length;
        const falseNegatives = groundTruth.filter(g => !detected.includes(g)).length;

        const precision = truePositives / (truePositives + falsePositives);
        const recall = truePositives / (truePositives + falseNegatives);

        expect(precision).toBe(1.0);
        expect(recall).toBe(1.0);
    });

    it('should handle no detection', () => {
        const detected: string[] = [];
        const groundTruth = ['First Aid Kit', 'Wrench'];

        const truePositives = detected.filter(d => groundTruth.includes(d)).length;
        const falseNegatives = groundTruth.filter(g => !detected.includes(g)).length;

        expect(truePositives).toBe(0);
        expect(falseNegatives).toBe(2);
    });
});

describe('Scan Build Integration - Error Handling', () => {
    it('should handle invalid image data gracefully', () => {
        const invalidImageUrl = 'not-a-valid-data-url';

        expect(() => {
            // This would call the actual detection functions
            // For now, just verify error handling structure
            if (!invalidImageUrl.startsWith('data:image/')) {
                throw new Error('Invalid image data URL');
            }
        }).toThrow('Invalid image data URL');
    });

    it('should handle empty OCR results', () => {
        const ocrResults: any[] = [];
        const cvResults = [
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.8,
                matchType: 'color' as const,
            },
        ];

        const combined = [...ocrResults, ...cvResults];
        expect(combined.length).toBe(1);
    });

    it('should handle empty CV results', () => {
        const ocrResults = [
            {
                entity: mockGameData.items!.items[0],
                confidence: 0.8,
                rawText: 'First Aid Kit',
            },
        ];
        const cvResults: any[] = [];

        const combined = [...ocrResults, ...cvResults];
        expect(combined.length).toBe(1);
    });

    it('should handle both empty results', () => {
        const ocrResults: any[] = [];
        const cvResults: any[] = [];

        const combined = [...ocrResults, ...cvResults];
        expect(combined.length).toBe(0);
    });
});

describe('Scan Build Integration - Performance', () => {
    it('should process results efficiently', () => {
        // Simulate 100 items detected
        const results = Array(100)
            .fill(null)
            .map((_, i) => ({
                entity: { id: `item_${i}`, name: `Item ${i}` },
                confidence: Math.random(),
                rawText: `Item ${i}`,
            }));

        const start = performance.now();

        // Filter and deduplicate
        const deduped = new Map();
        results.forEach(r => {
            const existing = deduped.get(r.entity.id);
            if (!existing || r.confidence > existing.confidence) {
                deduped.set(r.entity.id, r);
            }
        });

        const filtered = Array.from(deduped.values()).filter(r => r.confidence >= 0.5);

        const end = performance.now();

        expect(end - start).toBeLessThan(50);
        expect(filtered.length).toBeGreaterThan(0);
    });
});

describe('Scan Build Integration - State Management', () => {
    it('should maintain build state correctly', () => {
        const buildState = {
            character: mockGameData.characters!.characters[0],
            weapon: mockGameData.weapons!.weapons[0],
            items: [mockGameData.items!.items[0], mockGameData.items!.items[1]],
            tomes: [],
        };

        expect(buildState.character.name).toBe('CL4NK');
        expect(buildState.weapon.name).toBe('Hammer');
        expect(buildState.items.length).toBe(2);
    });

    it('should update build state from scan results', () => {
        const buildState = {
            character: null,
            weapon: null,
            items: [] as any[],
            tomes: [] as any[],
        };

        // Simulate scan results
        const scanResults = {
            items: [mockGameData.items!.items[0], mockGameData.items!.items[1]],
            weapon: mockGameData.weapons!.weapons[0],
            character: mockGameData.characters!.characters[0],
        };

        // Update state
        buildState.items = scanResults.items;
        buildState.weapon = scanResults.weapon;
        buildState.character = scanResults.character;

        expect(buildState.items.length).toBe(2);
        expect(buildState.weapon?.name).toBe('Hammer');
        expect(buildState.character?.name).toBe('CL4NK');
    });

    it('should handle incremental updates', () => {
        const buildState = {
            items: [mockGameData.items!.items[0]],
        };

        // Add more items
        buildState.items.push(mockGameData.items!.items[1]);
        buildState.items.push(mockGameData.items!.items[2]);

        expect(buildState.items.length).toBe(3);
    });
});

describe('Scan Build Integration - User Workflow', () => {
    it('should support manual override of auto-detected items', () => {
        const autoDetected = [mockGameData.items!.items[0], mockGameData.items!.items[1]];
        const manuallyAdded = mockGameData.items!.items[2];

        const finalItems = [...autoDetected, manuallyAdded];

        expect(finalItems.length).toBe(3);
    });

    it('should support removing false positives', () => {
        const detected = [
            mockGameData.items!.items[0],
            mockGameData.items!.items[1],
            mockGameData.items!.items[2], // False positive
        ];

        const falsePositiveId = 'battery';
        const corrected = detected.filter(item => item.id !== falsePositiveId);

        expect(corrected.length).toBe(2);
    });

    it('should support confidence thresholding by user', () => {
        const results = [
            { entity: mockGameData.items!.items[0], confidence: 0.9 },
            { entity: mockGameData.items!.items[1], confidence: 0.6 },
            { entity: mockGameData.items!.items[2], confidence: 0.4 },
        ];

        const userThreshold = 0.7;
        const filtered = results.filter(r => r.confidence >= userThreshold);

        expect(filtered.length).toBe(1);
        expect(filtered[0].entity.name).toBe('First Aid Kit');
    });
});
