/**
 * Non-Maximum Suppression (NMS) Tests
 * Tests IoU calculation and duplicate detection removal
 * Critical for preventing duplicate/overlapping detections
 */

import { describe, it, expect } from 'vitest';
import { calculateIoU, nonMaxSuppression } from '../../src/modules/cv/detection.ts';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';

// Helper: Create mock detection result
function createDetection(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    confidence: number
): CVDetectionResult {
    return {
        type: 'item',
        entity: {
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name,
            rarity: 'common',
            tier: 'A',
            image: `images/items/${name.toLowerCase()}.png`,
            base_effect: 'Test effect',
        },
        confidence,
        position: { x, y, width, height },
        method: 'template_match',
    };
}

describe('IoU (Intersection over Union) Calculation', () => {
    describe('Basic Overlap Scenarios', () => {
        it('should return 1.0 for identical boxes', () => {
            const box1: ROI = { x: 100, y: 100, width: 50, height: 50 };
            const box2: ROI = { x: 100, y: 100, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            expect(iou).toBe(1.0);
        });

        it('should return 0.0 for non-overlapping boxes', () => {
            const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
            const box2: ROI = { x: 100, y: 100, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            expect(iou).toBe(0.0);
        });

        it('should return ~0.25 for 50% overlap in one dimension', () => {
            const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
            const box2: ROI = { x: 50, y: 0, width: 100, height: 100 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 50x100 = 5000
            // Union: 10000 + 10000 - 5000 = 15000
            // IoU: 5000/15000 = 0.333...
            expect(iou).toBeCloseTo(0.333, 2);
        });

        it('should return 0.25 for centered box at half size', () => {
            const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
            const box2: ROI = { x: 25, y: 25, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 50x50 = 2500
            // Union: 10000 + 2500 - 2500 = 10000
            // IoU: 2500/10000 = 0.25
            expect(iou).toBe(0.25);
        });
    });

    describe('Partial Overlap Scenarios', () => {
        it('should calculate correct IoU for small corner overlap', () => {
            const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
            const box2: ROI = { x: 90, y: 90, width: 100, height: 100 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 10x10 = 100
            // Union: 10000 + 10000 - 100 = 19900
            // IoU: 100/19900 ≈ 0.005
            expect(iou).toBeCloseTo(0.005, 3);
        });

        it('should calculate correct IoU for vertical strip overlap', () => {
            const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
            const box2: ROI = { x: 80, y: 0, width: 40, height: 100 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 20x100 = 2000
            // Union: 10000 + 4000 - 2000 = 12000
            // IoU: 2000/12000 ≈ 0.167
            expect(iou).toBeCloseTo(0.167, 2);
        });

        it('should calculate correct IoU for horizontal strip overlap', () => {
            const box1: ROI = { x: 0, y: 0, width: 100, height: 100 };
            const box2: ROI = { x: 0, y: 80, width: 100, height: 40 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 100x20 = 2000
            // Union: 10000 + 4000 - 2000 = 12000
            // IoU: 2000/12000 ≈ 0.167
            expect(iou).toBeCloseTo(0.167, 2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle boxes touching at edge (zero overlap)', () => {
            const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
            const box2: ROI = { x: 50, y: 0, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            expect(iou).toBe(0.0);
        });

        it('should handle boxes touching at corner (zero overlap)', () => {
            const box1: ROI = { x: 0, y: 0, width: 50, height: 50 };
            const box2: ROI = { x: 50, y: 50, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            expect(iou).toBe(0.0);
        });

        it('should handle zero-size boxes', () => {
            const box1: ROI = { x: 0, y: 0, width: 0, height: 0 };
            const box2: ROI = { x: 0, y: 0, width: 50, height: 50 };

            const iou = calculateIoU(box1, box2);

            expect(iou).toBe(0.0);
        });

        it('should handle very large boxes', () => {
            const box1: ROI = { x: 0, y: 0, width: 10000, height: 10000 };
            const box2: ROI = { x: 5000, y: 5000, width: 10000, height: 10000 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 5000x5000 = 25M
            // Union: 100M + 100M - 25M = 175M
            // IoU: 25M/175M ≈ 0.143
            expect(iou).toBeCloseTo(0.143, 2);
        });

        it('should be symmetric (IoU(A,B) == IoU(B,A))', () => {
            const box1: ROI = { x: 10, y: 20, width: 60, height: 80 };
            const box2: ROI = { x: 40, y: 50, width: 70, height: 90 };

            const iou1 = calculateIoU(box1, box2);
            const iou2 = calculateIoU(box2, box1);

            expect(iou1).toBe(iou2);
        });
    });

    describe('Realistic Item Detection Scenarios', () => {
        it('should detect high overlap for sliding window shift (45px box, 10px shift)', () => {
            const box1: ROI = { x: 100, y: 100, width: 45, height: 45 };
            const box2: ROI = { x: 110, y: 100, width: 45, height: 45 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 35x45 = 1575
            // Union: 2025 + 2025 - 1575 = 2475
            // IoU: 1575/2475 ≈ 0.636
            expect(iou).toBeGreaterThan(0.6);
        });

        it('should detect medium overlap for diagonal shift', () => {
            const box1: ROI = { x: 100, y: 100, width: 45, height: 45 };
            const box2: ROI = { x: 115, y: 115, width: 45, height: 45 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 30x30 = 900
            // Union: 2025 + 2025 - 900 = 3150
            // IoU: 900/3150 ≈ 0.286
            expect(iou).toBeGreaterThan(0.25);
            expect(iou).toBeLessThan(0.35);
        });

        it('should detect low overlap for edge detection', () => {
            const box1: ROI = { x: 100, y: 100, width: 45, height: 45 };
            const box2: ROI = { x: 130, y: 100, width: 45, height: 45 };

            const iou = calculateIoU(box1, box2);

            // Intersection: 15x45 = 675
            // Union: 2025 + 2025 - 675 = 3375
            // IoU: 675/3375 = 0.2
            expect(iou).toBeCloseTo(0.2, 2);
        });
    });
});

describe('Non-Maximum Suppression (NMS)', () => {
    describe('Basic Duplicate Removal', () => {
        it('should keep only highest confidence when boxes fully overlap', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 100, 100, 45, 45, 0.85),
                createDetection('Wrench', 100, 100, 45, 45, 0.90),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.95);
        });

        it('should keep all boxes when no overlap', () => {
            const detections = [
                createDetection('Wrench', 0, 0, 45, 45, 0.95),
                createDetection('Medkit', 100, 0, 45, 45, 0.90),
                createDetection('Battery', 0, 100, 45, 45, 0.92),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(3);
        });

        it('should remove detections with high IoU overlap', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 110, 100, 45, 45, 0.80), // High overlap
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.95);
        });

        it('should keep detections with low IoU overlap', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Medkit', 130, 100, 45, 45, 0.90), // Low overlap (IoU ~0.2)
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(2);
        });
    });

    describe('Confidence-Based Prioritization', () => {
        it('should prioritize higher confidence detections', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.80),
                createDetection('Wrench', 105, 105, 45, 45, 0.95),
                createDetection('Wrench', 110, 100, 45, 45, 0.85),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.95);
            expect(filtered[0].position?.x).toBe(105);
        });

        it('should keep lower confidence if spatially separated', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 200, 100, 45, 45, 0.70), // Far away
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(2);
        });

        it('should process in descending confidence order', () => {
            const detections = [
                createDetection('Item A', 100, 100, 45, 45, 0.70),
                createDetection('Item B', 105, 105, 45, 45, 0.80),
                createDetection('Item C', 110, 100, 45, 45, 0.90),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            // Highest confidence (0.90) should be kept
            expect(filtered).toHaveLength(1);
            expect(filtered[0].entity.name).toBe('Item C');
        });
    });

    describe('IoU Threshold Variation', () => {
        it('should be more aggressive with lower threshold (0.1)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 130, 100, 45, 45, 0.90), // IoU ~0.2
            ];

            const filtered = nonMaxSuppression(detections, 0.1);

            // With threshold 0.1, IoU of 0.2 exceeds threshold -> suppress
            expect(filtered).toHaveLength(1);
        });

        it('should be less aggressive with higher threshold (0.5)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 115, 115, 45, 45, 0.90), // IoU ~0.28
            ];

            const filtered = nonMaxSuppression(detections, 0.5);

            // With threshold 0.5, IoU of 0.28 is below threshold -> keep both
            expect(filtered).toHaveLength(2);
        });

        it('should use default threshold 0.3 when not specified', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 110, 100, 45, 45, 0.90), // IoU ~0.64
            ];

            const filtered = nonMaxSuppression(detections);

            expect(filtered).toHaveLength(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty detection list', () => {
            const filtered = nonMaxSuppression([], 0.3);

            expect(filtered).toHaveLength(0);
        });

        it('should handle single detection', () => {
            const detections = [createDetection('Wrench', 100, 100, 45, 45, 0.95)];

            const filtered = nonMaxSuppression(detections, 0.3);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].entity.name).toBe('Wrench');
        });

        it('should handle detections without position', () => {
            const detection: CVDetectionResult = {
                type: 'item',
                entity: {
                    id: 'wrench',
                    name: 'Wrench',
                    rarity: 'common',
                    tier: 'A',
                    image: 'images/items/wrench.png',
                    base_effect: 'Test',
                },
                confidence: 0.95,
                position: undefined,
                method: 'template_match',
            };

            const filtered = nonMaxSuppression([detection], 0.3);

            expect(filtered).toHaveLength(1);
        });

        it('should handle mixed (with and without position)', () => {
            const withPos = createDetection('Wrench', 100, 100, 45, 45, 0.95);
            const withoutPos: CVDetectionResult = {
                ...withPos,
                position: undefined,
            };

            const filtered = nonMaxSuppression([withPos, withoutPos], 0.3);

            expect(filtered).toHaveLength(2);
        });

        it('should preserve original array (immutability)', () => {
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.80),
                createDetection('Wrench', 105, 105, 45, 45, 0.95),
            ];

            const original = [...detections];
            nonMaxSuppression(detections, 0.3);

            expect(detections).toEqual(original);
        });
    });

    describe('Complex Multi-Item Scenarios', () => {
        it('should handle multiple item clusters', () => {
            const detections = [
                // Cluster 1: Wrench detections at (100, 100)
                createDetection('Wrench', 100, 100, 45, 45, 0.95),
                createDetection('Wrench', 105, 105, 45, 45, 0.85),
                createDetection('Wrench', 110, 100, 45, 45, 0.80),

                // Cluster 2: Medkit detections at (300, 100)
                createDetection('Medkit', 300, 100, 45, 45, 0.92),
                createDetection('Medkit', 305, 105, 45, 45, 0.88),

                // Cluster 3: Battery detections at (100, 300)
                createDetection('Battery', 100, 300, 45, 45, 0.90),
                createDetection('Battery', 108, 308, 45, 45, 0.87),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            // Should keep best from each cluster
            expect(filtered).toHaveLength(3);

            const names = filtered.map(d => d.entity.name).sort();
            expect(names).toEqual(['Battery', 'Medkit', 'Wrench']);

            // Check that highest confidence was kept for each
            const wrench = filtered.find(d => d.entity.name === 'Wrench');
            expect(wrench?.confidence).toBe(0.95);

            const medkit = filtered.find(d => d.entity.name === 'Medkit');
            expect(medkit?.confidence).toBe(0.92);

            const battery = filtered.find(d => d.entity.name === 'Battery');
            expect(battery?.confidence).toBe(0.90);
        });

        it('should handle sliding window duplicates (10px stride)', () => {
            // Simulate sliding window with 10px stride detecting same item
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.90),
                createDetection('Wrench', 110, 100, 45, 45, 0.92), // +10px
                createDetection('Wrench', 120, 100, 45, 45, 0.88), // +20px
                createDetection('Wrench', 130, 100, 45, 45, 0.85), // +30px
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            // All have high IoU with neighbors, should keep only best
            expect(filtered).toHaveLength(1);
            expect(filtered[0].confidence).toBe(0.92);
            expect(filtered[0].position?.x).toBe(110);
        });

        it('should handle grid of non-overlapping items', () => {
            // 3x3 grid of items with 60px spacing (no overlap for 45px items)
            const detections = [
                createDetection('Item 0', 0, 0, 45, 45, 0.90),
                createDetection('Item 1', 60, 0, 45, 45, 0.91),
                createDetection('Item 2', 120, 0, 45, 45, 0.92),
                createDetection('Item 3', 0, 60, 45, 45, 0.85),
                createDetection('Item 4', 60, 60, 45, 45, 0.86),
                createDetection('Item 5', 120, 60, 45, 45, 0.87),
                createDetection('Item 6', 0, 120, 45, 45, 0.88),
                createDetection('Item 7', 60, 120, 45, 45, 0.89),
                createDetection('Item 8', 120, 120, 45, 45, 0.90),
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            // No overlap, all should be kept
            expect(filtered).toHaveLength(9);
        });

        it('should handle different item types at same location', () => {
            // Multiple items detected at similar location (ambiguous match)
            const detections = [
                createDetection('Wrench', 100, 100, 45, 45, 0.85),
                createDetection('Scrap', 105, 105, 45, 45, 0.82), // Different item, similar position
                createDetection('Gear', 110, 100, 45, 45, 0.80), // Different item, similar position
            ];

            const filtered = nonMaxSuppression(detections, 0.3);

            // NMS doesn't check item type, only IoU - should suppress based on overlap
            expect(filtered.length).toBeGreaterThan(0);
            expect(filtered.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Performance - Large Detection Sets', () => {
        it('should handle 100 detections efficiently', () => {
            const detections: CVDetectionResult[] = [];

            // Create 100 random detections
            for (let i = 0; i < 100; i++) {
                const x = Math.floor(Math.random() * 1000);
                const y = Math.floor(Math.random() * 600);
                const conf = 0.7 + Math.random() * 0.25;

                detections.push(createDetection(`Item ${i}`, x, y, 45, 45, conf));
            }

            const start = performance.now();
            const filtered = nonMaxSuppression(detections, 0.3);
            const elapsed = performance.now() - start;

            expect(filtered.length).toBeGreaterThan(0);
            expect(filtered.length).toBeLessThanOrEqual(100);
            expect(elapsed).toBeLessThan(50); // Should complete in < 50ms
        });

        it('should handle 1000 detections in reasonable time', () => {
            const detections: CVDetectionResult[] = [];

            // Create 1000 detections in a grid
            for (let i = 0; i < 1000; i++) {
                const x = (i % 50) * 20;
                const y = Math.floor(i / 50) * 20;
                const conf = 0.7 + Math.random() * 0.25;

                detections.push(createDetection(`Item ${i}`, x, y, 45, 45, conf));
            }

            const start = performance.now();
            const filtered = nonMaxSuppression(detections, 0.3);
            const elapsed = performance.now() - start;

            expect(filtered.length).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(500); // Should complete in < 500ms
        });
    });

    describe('Integration with Sliding Window Detection', () => {
        it('should simulate realistic sliding window + NMS pipeline', () => {
            // Simulate detecting 3 actual items with sliding window (12px stride)
            // Each item detected multiple times at slightly different positions

            const detections: CVDetectionResult[] = [];

            // Item 1: Wrench at (100, 100) - detected 5 times
            for (let i = 0; i < 5; i++) {
                detections.push(
                    createDetection('Wrench', 100 + i * 12, 100, 45, 45, 0.85 + Math.random() * 0.1)
                );
            }

            // Item 2: Medkit at (300, 100) - detected 4 times
            for (let i = 0; i < 4; i++) {
                detections.push(
                    createDetection('Medkit', 300 + i * 12, 100, 45, 45, 0.80 + Math.random() * 0.1)
                );
            }

            // Item 3: Battery at (500, 100) - detected 6 times
            for (let i = 0; i < 6; i++) {
                detections.push(
                    createDetection('Battery', 500 + i * 12, 100, 45, 45, 0.78 + Math.random() * 0.15)
                );
            }

            // Total: 15 raw detections
            expect(detections).toHaveLength(15);

            const filtered = nonMaxSuppression(detections, 0.3);

            // After NMS: should collapse to 3 detections (one per actual item)
            expect(filtered).toHaveLength(3);

            const names = filtered.map(d => d.entity.name).sort();
            expect(names).toEqual(['Battery', 'Medkit', 'Wrench']);
        });
    });
});
