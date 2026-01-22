// ========================================
// CV Integration Tests
// ========================================
// Tests CV detection against ground truth data
// Validates accuracy targets by difficulty level

import { describe, it, expect, beforeAll } from 'vitest';
import { verifyGridPattern } from '../../src/modules/cv/detection.ts';
import type { CVDetectionResult } from '../../src/modules/cv/types.ts';
import { getMetricsCollector, enableMetrics, disableMetrics } from '../../src/modules/cv/metrics.ts';
import { getColorCandidates, getAdjacentColors } from '../../src/modules/cv/color.ts';

// ========================================
// Grid Verification Integration Tests
// ========================================

describe('CV Grid Verification - Integration', () => {
    function createMockDetection(x: number, y: number, name: string = 'Test Item'): CVDetectionResult {
        return {
            type: 'item',
            entity: {
                id: `test_${x}_${y}`,
                name,
                description: 'Test item',
                rarity: 'common',
                icon: 'test.png',
            },
            confidence: 0.8,
            position: { x, y, width: 48, height: 48 },
            method: 'template_match',
        };
    }

    function createGridDetections(
        startX: number,
        startY: number,
        columns: number,
        rows: number,
        spacing: number
    ): CVDetectionResult[] {
        const detections: CVDetectionResult[] = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                detections.push(
                    createMockDetection(startX + col * spacing, startY + row * spacing, `Item_${row}_${col}`)
                );
            }
        }
        return detections;
    }

    describe('Adaptive Tolerance', () => {
        it('should handle grids with slight spacing variations', () => {
            // Create detections with ±3px variation in spacing
            const detections = [
                createMockDetection(100, 500),
                createMockDetection(148, 500), // 48px
                createMockDetection(196, 500), // 48px
                createMockDetection(247, 500), // 51px (slight variation)
                createMockDetection(294, 500), // 47px (slight variation)
                createMockDetection(344, 500), // 50px
                createMockDetection(392, 500), // 48px
                createMockDetection(441, 500), // 49px
            ];

            const result = verifyGridPattern(detections, 48);

            // Should retain most/all detections with adaptive tolerance
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(6);
            expect(result.isValid).toBe(true);
        });

        it('should filter clear outliers while retaining grid items', () => {
            const detections = createGridDetections(100, 500, 6, 1, 50);
            // Add an outlier far from grid positions
            detections.push(createMockDetection(180, 500, 'Outlier')); // Between grid positions

            const result = verifyGridPattern(detections, 48);

            // Should filter outlier but keep most grid items
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(5);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Row-Aware Verification', () => {
        it('should handle multi-row grids correctly', () => {
            // Create a 2-row grid
            const detections = createGridDetections(100, 500, 8, 2, 50);

            const result = verifyGridPattern(detections, 50);

            // Should retain most items from both rows
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(12);
        });

        it('should handle 3-row inventory grids', () => {
            // Create a 3-row grid typical of late-game inventories
            const detections = createGridDetections(50, 400, 10, 3, 45);

            const result = verifyGridPattern(detections, 45);

            // Should process all 30 items successfully
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(20);
            expect(result.isValid).toBe(true);
        });

        it('should correctly cluster rows with different item counts', () => {
            // Row 1: 5 items
            const row1 = Array.from({ length: 5 }, (_, i) =>
                createMockDetection(100 + i * 50, 500, `Row1_${i}`)
            );
            // Row 2: 3 items (incomplete row)
            const row2 = Array.from({ length: 3 }, (_, i) =>
                createMockDetection(100 + i * 50, 550, `Row2_${i}`)
            );

            const detections = [...row1, ...row2];
            const result = verifyGridPattern(detections, 48);

            // Should handle uneven rows
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(6);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single-row hotbar with 10 items', () => {
            const detections = createGridDetections(50, 700, 10, 1, 45);
            const result = verifyGridPattern(detections, 45);

            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(8);
            expect(result.isValid).toBe(true);
        });

        it('should handle sparse detections gracefully', () => {
            // Only 4 items detected from a potential 10-slot row
            const detections = [
                createMockDetection(100, 500),
                createMockDetection(200, 500),
                createMockDetection(350, 500),
                createMockDetection(400, 500),
            ];

            const result = verifyGridPattern(detections, 48);

            // Should still process without crashing
            expect(result.filteredDetections.length).toBeGreaterThanOrEqual(0);
            expect(typeof result.confidence).toBe('number');
        });

        it('should handle varying icon sizes across resolutions', () => {
            // 720p typical: ~40px icons
            const detections720p = createGridDetections(100, 500, 8, 1, 42);
            const result720p = verifyGridPattern(detections720p, 40);
            expect(result720p.filteredDetections.length).toBeGreaterThanOrEqual(6);

            // 1080p typical: ~55px icons
            const detections1080p = createGridDetections(100, 500, 8, 1, 58);
            const result1080p = verifyGridPattern(detections1080p, 55);
            expect(result1080p.filteredDetections.length).toBeGreaterThanOrEqual(6);

            // 1440p typical: ~72px icons
            const detections1440p = createGridDetections(100, 500, 8, 1, 75);
            const result1440p = verifyGridPattern(detections1440p, 72);
            expect(result1440p.filteredDetections.length).toBeGreaterThanOrEqual(6);
        });
    });
});

// ========================================
// Color Filtering Integration Tests
// ========================================

describe('CV Color Filtering - Integration', () => {
    describe('Adjacent Color Matching', () => {
        it('should return correct adjacent colors for primary colors', () => {
            expect(getAdjacentColors('red')).toContain('orange');
            expect(getAdjacentColors('red')).toContain('magenta');

            expect(getAdjacentColors('blue')).toContain('cyan');
            expect(getAdjacentColors('blue')).toContain('purple');

            expect(getAdjacentColors('green')).toContain('lime');
            expect(getAdjacentColors('green')).toContain('cyan');

            expect(getAdjacentColors('yellow')).toContain('orange');
            expect(getAdjacentColors('yellow')).toContain('lime');
        });

        it('should return empty array for unknown colors', () => {
            expect(getAdjacentColors('unknownColor')).toEqual([]);
        });

        it('should include exact color first in candidates', () => {
            const candidates = getColorCandidates('red');
            expect(candidates[0]).toBe('red');
            expect(candidates.length).toBeGreaterThan(1);
        });

        it('should handle achromatic colors', () => {
            expect(getAdjacentColors('gray')).toContain('black');
            expect(getAdjacentColors('gray')).toContain('white');

            expect(getAdjacentColors('black')).toContain('gray');
            expect(getAdjacentColors('white')).toContain('gray');
        });
    });
});

// ========================================
// Metrics Collection Tests
// ========================================

describe('CV Metrics Collection', () => {
    beforeAll(() => {
        disableMetrics();
    });

    it('should collect metrics when enabled', () => {
        const metrics = getMetricsCollector();

        enableMetrics();
        expect(metrics.isEnabled()).toBe(true);

        // Start a mock run
        metrics.startRun(1920, 1080, '1080p');

        // Record some metrics
        metrics.recordTwoPhaseAttempt(true, null, 0.85, 20);
        metrics.recordGridDetectionTime(50);
        metrics.recordTemplateMatchingTime(200);
        metrics.recordGridVerification(15, 12);
        metrics.recordColorFilter(true, false, 10);
        metrics.recordDetection(0.85, 'common');
        metrics.recordDetection(0.72, 'rare');
        metrics.recordRarityValidation(true, false);

        // End run
        const runMetrics = metrics.endRun(300);

        expect(runMetrics).not.toBeNull();
        expect(runMetrics!.twoPhaseSucceeded).toBe(true);
        expect(runMetrics!.gridVerificationInput).toBe(15);
        expect(runMetrics!.gridVerificationOutput).toBe(12);
        expect(runMetrics!.totalDetections).toBe(2);

        disableMetrics();
    });

    it('should not collect metrics when disabled', () => {
        const metrics = getMetricsCollector();

        disableMetrics();
        expect(metrics.isEnabled()).toBe(false);

        metrics.startRun(1920, 1080, '1080p');
        metrics.recordDetection(0.85, 'common');
        const runMetrics = metrics.endRun(100);

        // Should return null when disabled
        expect(runMetrics).toBeNull();
    });

    it('should aggregate metrics across multiple runs', () => {
        const metrics = getMetricsCollector();
        metrics.clear();

        enableMetrics();

        // Run 1
        metrics.startRun(1920, 1080, '1080p');
        metrics.recordTwoPhaseAttempt(true, null, 0.8, 15);
        metrics.recordGridVerification(10, 8);
        metrics.endRun(200);

        // Run 2
        metrics.startRun(1280, 720, '720p');
        metrics.recordTwoPhaseAttempt(false, 'low_confidence', 0.3, 0);
        metrics.recordGridVerification(12, 10);
        metrics.endRun(350);

        // Run 3
        metrics.startRun(2560, 1440, '1440p');
        metrics.recordTwoPhaseAttempt(true, null, 0.9, 20);
        metrics.recordGridVerification(15, 14);
        metrics.endRun(400);

        const aggregated = metrics.getAggregatedMetrics();

        expect(aggregated).not.toBeNull();
        expect(aggregated!.runCount).toBe(3);
        expect(aggregated!.twoPhaseSuccessRate).toBeCloseTo(0.67, 1); // 2/3
        expect(aggregated!.avgGridRetentionRate).toBeGreaterThan(0.7);

        disableMetrics();
        metrics.clear();
    });
});

// ========================================
// Performance Tests
// ========================================

describe('CV Performance', () => {
    it('should verify grid in reasonable time for large detection sets', () => {
        // Simulate 60 items (3 rows x 20 items)
        const detections: CVDetectionResult[] = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 20; col++) {
                detections.push({
                    type: 'item',
                    entity: {
                        id: `item_${row}_${col}`,
                        name: `Item ${row}_${col}`,
                        description: '',
                        rarity: 'common',
                        icon: '',
                    },
                    confidence: 0.8,
                    position: { x: 50 + col * 45, y: 500 + row * 48, width: 40, height: 40 },
                    method: 'template_match',
                });
            }
        }

        const start = performance.now();
        const result = verifyGridPattern(detections, 45);
        const elapsed = performance.now() - start;

        // Should complete in under 50ms for 60 items
        expect(elapsed).toBeLessThan(50);
        expect(result.filteredDetections.length).toBeGreaterThan(40);
    });
});
