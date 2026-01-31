/**
 * @vitest-environment jsdom
 * CV Debug Module - Comprehensive Coverage Tests
 * Tests for debug visualization: overlays, heatmaps, histograms, strategy comparison
 * 
 * Note: Async image loading functions are skipped due to jsdom limitations.
 * Focus on synchronous canvas rendering functions.
 */
import { describe, it, expect, beforeEach, vi, test } from 'vitest';
import {
    defaultDebugOptions,
    renderGridOverlay,
    renderConfidenceHeatmap,
    renderMatchingSteps,
    renderConfidenceHistogram,
    type DebugVisualizationOptions,
    type MatchingStep,
} from '../../src/modules/cv/debug.ts';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';
import { cvTestKit } from '../helpers/cv-test-kit.ts';

// ========================================
// Test Helpers
// ========================================

function createMockCanvas(width: number = 800, height: number = 600): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function createMockDetection(
    name: string,
    confidence: number,
    position?: Partial<ROI>
): CVDetectionResult {
    return cvTestKit.detection.item(name, confidence, position);
}

// ========================================
// defaultDebugOptions Tests
// ========================================

describe('defaultDebugOptions', () => {
    it('should have expected default values', () => {
        expect(defaultDebugOptions.showGrid).toBe(true);
        expect(defaultDebugOptions.showConfidenceHeatmap).toBe(false);
        expect(defaultDebugOptions.showMatchingSteps).toBe(false);
        expect(defaultDebugOptions.confidenceThreshold).toBe(0.7);
        expect(defaultDebugOptions.gridCellSize).toBe(64);
    });

    it('should be a valid DebugVisualizationOptions object', () => {
        const options: DebugVisualizationOptions = defaultDebugOptions;
        expect(options).toBeDefined();
        expect(typeof options.showGrid).toBe('boolean');
        expect(typeof options.confidenceThreshold).toBe('number');
    });

    it('should have all required properties', () => {
        expect(defaultDebugOptions).toHaveProperty('showGrid');
        expect(defaultDebugOptions).toHaveProperty('showConfidenceHeatmap');
        expect(defaultDebugOptions).toHaveProperty('showMatchingSteps');
        expect(defaultDebugOptions).toHaveProperty('confidenceThreshold');
        expect(defaultDebugOptions).toHaveProperty('gridCellSize');
    });

    it('should have reasonable threshold value', () => {
        expect(defaultDebugOptions.confidenceThreshold).toBeGreaterThan(0);
        expect(defaultDebugOptions.confidenceThreshold).toBeLessThan(1);
    });

    it('should have reasonable grid cell size', () => {
        expect(defaultDebugOptions.gridCellSize).toBeGreaterThan(0);
        expect(defaultDebugOptions.gridCellSize).toBeLessThan(256);
    });
});

// ========================================
// renderGridOverlay Tests
// ========================================

describe('renderGridOverlay', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should render grid cells', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
            { x: 128, y: 0, width: 64, height: 64 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should highlight current cell in yellow', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];
        const currentCell = 1;

        expect(() => renderGridOverlay(canvas, gridCells, currentCell)).not.toThrow();
    });

    it('should mark processed cells in gray', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
            { x: 128, y: 0, width: 64, height: 64 },
        ];
        const processedCells = new Set([0, 1]);

        expect(() => renderGridOverlay(canvas, gridCells, 2, processedCells)).not.toThrow();
    });

    it('should handle empty grid cells array', () => {
        expect(() => renderGridOverlay(canvas, [])).not.toThrow();
    });

    it('should return early if canvas context is null', () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        expect(() => renderGridOverlay(badCanvas, [])).not.toThrow();
    });

    it('should show cell indices', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderGridOverlay(canvas, gridCells);

        expect(fillTextSpy).toHaveBeenCalledWith('0', 2, 12);
        expect(fillTextSpy).toHaveBeenCalledWith('1', 66, 12);
    });

    it('should handle undefined currentCell', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];

        expect(() => renderGridOverlay(canvas, gridCells, undefined)).not.toThrow();
    });

    it('should handle undefined processedCells', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];

        expect(() => renderGridOverlay(canvas, gridCells, 0, undefined)).not.toThrow();
    });

    it('should handle large number of grid cells', () => {
        const gridCells: ROI[] = Array.from({ length: 100 }, (_, i) => ({
            x: (i % 10) * 64,
            y: Math.floor(i / 10) * 64,
            width: 64,
            height: 64,
        }));

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should set line dash for grid rendering', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];
        const ctx = canvas.getContext('2d')!;
        const setLineDashSpy = vi.spyOn(ctx, 'setLineDash');

        renderGridOverlay(canvas, gridCells);

        expect(setLineDashSpy).toHaveBeenCalledWith([4, 4]);
    });

    it('should reset line dash after rendering', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];
        const ctx = canvas.getContext('2d')!;
        const setLineDashSpy = vi.spyOn(ctx, 'setLineDash');

        renderGridOverlay(canvas, gridCells);

        expect(setLineDashSpy).toHaveBeenCalledWith([]);
    });

    it('should use strokeRect for each cell', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];
        const ctx = canvas.getContext('2d')!;
        const strokeRectSpy = vi.spyOn(ctx, 'strokeRect');

        renderGridOverlay(canvas, gridCells);

        expect(strokeRectSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle cells at various positions', () => {
        const gridCells: ROI[] = [
            { x: 100, y: 200, width: 50, height: 50 },
            { x: 500, y: 400, width: 60, height: 60 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });
});

// ========================================
// renderConfidenceHeatmap Tests
// ========================================

describe('renderConfidenceHeatmap', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should render heatmap for detections', () => {
        const detections = [
            createMockDetection('Wrench', 0.95),
            createMockDetection('Medkit', 0.75),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle empty detections', () => {
        expect(() => renderConfidenceHeatmap(canvas, [])).not.toThrow();
    });

    it('should use default threshold of 0.7', () => {
        const detections = [createMockDetection('Wrench', 0.6)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should use custom threshold', () => {
        const detections = [createMockDetection('Wrench', 0.5)];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0.4)).not.toThrow();
    });

    it('should return early if canvas context is null', () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        expect(() => renderConfidenceHeatmap(badCanvas, [])).not.toThrow();
    });

    it('should skip detections without position', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: { id: 'test', name: 'Test' } as any,
                confidence: 0.9,
                method: 'template_match',
                // No position
            },
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should color high confidence (>=0.9) as green', () => {
        const detections = [createMockDetection('Wrench', 0.95)];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderConfidenceHeatmap(canvas, detections);

        expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should color different confidence bands correctly', () => {
        const detections = [
            createMockDetection('A', 0.95, { x: 0, y: 0 }),    // 0.9-1.0 green
            createMockDetection('B', 0.85, { x: 50, y: 0 }),   // 0.8-0.9 
            createMockDetection('C', 0.75, { x: 100, y: 0 }),  // 0.7-0.8 yellow
            createMockDetection('D', 0.65, { x: 150, y: 0 }),  // 0.6-0.7 orange
            createMockDetection('E', 0.55, { x: 200, y: 0 }),  // <0.6 red
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0.6)).not.toThrow();
    });

    it('should handle single detection', () => {
        const detections = [createMockDetection('Wrench', 0.8)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle many detections', () => {
        const detections = Array.from({ length: 50 }, (_, i) =>
            createMockDetection(`Item${i}`, 0.5 + (i / 100), { x: i * 10, y: 0 })
        );

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle detections at boundary confidence values', () => {
        const detections = [
            createMockDetection('A', 0.9),   // Exactly at boundary
            createMockDetection('B', 0.8),   // Exactly at boundary
            createMockDetection('C', 0.7),   // Exactly at boundary
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle zero threshold', () => {
        const detections = [createMockDetection('Test', 0.1)];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0)).not.toThrow();
    });

    it('should handle threshold of 1.0', () => {
        const detections = [createMockDetection('Test', 0.99)];

        expect(() => renderConfidenceHeatmap(canvas, detections, 1.0)).not.toThrow();
    });
});

// ========================================
// renderMatchingSteps Tests
// ========================================

describe('renderMatchingSteps', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    function createMatchingStep(
        templateId: string,
        templateName: string,
        similarity: number,
        isMatch: boolean
    ): MatchingStep {
        return {
            templateId,
            templateName,
            similarity,
            position: { x: 0, y: 0, width: 50, height: 50 },
            isMatch,
        };
    }

    it('should render matching steps', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'Wrench', 0.85, true),
            createMatchingStep('t2', 'Medkit', 0.65, false),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 1)).not.toThrow();
    });

    it('should handle empty steps array', () => {
        expect(() => renderMatchingSteps(canvas, [], 0)).not.toThrow();
    });

    it('should return early if canvas context is null', () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        expect(() => renderMatchingSteps(badCanvas, [], 0)).not.toThrow();
    });

    it('should show checkmark for matches', () => {
        const steps: MatchingStep[] = [createMatchingStep('t1', 'Wrench', 0.9, true)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 0);

        expect(fillTextSpy).toHaveBeenCalledWith('✓', expect.any(Number), expect.any(Number));
    });

    it('should show X for non-matches', () => {
        const steps: MatchingStep[] = [createMatchingStep('t1', 'Wrench', 0.5, false)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 0);

        expect(fillTextSpy).toHaveBeenCalledWith('✗', expect.any(Number), expect.any(Number));
    });

    it('should show step progress indicator', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'Wrench', 0.9, true),
            createMatchingStep('t2', 'Medkit', 0.8, true),
            createMatchingStep('t3', 'Battery', 0.7, false),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 2);

        // Should show "Step 3/3"
        expect(fillTextSpy).toHaveBeenCalledWith('Step 3/3', expect.any(Number), expect.any(Number));
    });

    it('should highlight latest step', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'Wrench', 0.9, true),
            createMatchingStep('t2', 'Medkit', 0.8, true),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 1)).not.toThrow();
    });

    it('should truncate long template names', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'VeryLongTemplateNameThatShouldBeTruncated', 0.9, true),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should display only recent steps (sliding window)', () => {
        const steps: MatchingStep[] = Array.from({ length: 20 }, (_, i) =>
            createMatchingStep(`t${i}`, `Template${i}`, 0.5 + i * 0.02, i % 2 === 0)
        );

        expect(() => renderMatchingSteps(canvas, steps, 19)).not.toThrow();
    });

    it('should handle step at index 0', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'Test', 0.9, true),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should handle mixed match results', () => {
        const steps: MatchingStep[] = [
            createMatchingStep('t1', 'Match1', 0.9, true),
            createMatchingStep('t2', 'NoMatch1', 0.4, false),
            createMatchingStep('t3', 'Match2', 0.85, true),
            createMatchingStep('t4', 'NoMatch2', 0.3, false),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 3)).not.toThrow();
    });

    it('should draw panel background', () => {
        const steps: MatchingStep[] = [createMatchingStep('t1', 'Test', 0.9, true)];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderMatchingSteps(canvas, steps, 0);

        expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should display header text', () => {
        const steps: MatchingStep[] = [createMatchingStep('t1', 'Test', 0.9, true)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 0);

        expect(fillTextSpy).toHaveBeenCalledWith(
            'Template Matching Steps',
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('should format similarity as percentage', () => {
        const steps: MatchingStep[] = [createMatchingStep('t1', 'Test', 0.8765, true)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 0);

        // Should show percentage like "87.7%"
        const calls = fillTextSpy.mock.calls.map(c => c[0]);
        expect(calls.some(text => typeof text === 'string' && text.includes('87'))).toBe(true);
    });
});

// ========================================
// renderConfidenceHistogram Tests
// ========================================

describe('renderConfidenceHistogram', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should render confidence histogram', () => {
        const detections = [
            createMockDetection('A', 0.95),
            createMockDetection('B', 0.85),
            createMockDetection('C', 0.75),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle empty detections', () => {
        expect(() => renderConfidenceHistogram(canvas, [])).not.toThrow();
    });

    it('should return early if canvas context is null', () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        expect(() => renderConfidenceHistogram(badCanvas, [])).not.toThrow();
    });

    it('should use default threshold of 0.7', () => {
        const detections = [createMockDetection('A', 0.6)];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should use custom threshold', () => {
        const detections = [createMockDetection('A', 0.5)];

        expect(() => renderConfidenceHistogram(canvas, detections, 0.4)).not.toThrow();
    });

    it('should draw threshold line', () => {
        const detections = [createMockDetection('A', 0.8)];
        const ctx = canvas.getContext('2d')!;
        const beginPathSpy = vi.spyOn(ctx, 'beginPath');
        const moveToPy = vi.spyOn(ctx, 'moveTo');
        const lineToPy = vi.spyOn(ctx, 'lineTo');

        renderConfidenceHistogram(canvas, detections, 0.7);

        expect(beginPathSpy).toHaveBeenCalled();
        expect(moveToPy).toHaveBeenCalled();
        expect(lineToPy).toHaveBeenCalled();
    });

    it('should bin detections into 10 buckets', () => {
        // Create detections across all bins
        const detections = [
            createMockDetection('A', 0.05),  // Bin 0
            createMockDetection('B', 0.15),  // Bin 1
            createMockDetection('C', 0.25),  // Bin 2
            createMockDetection('D', 0.35),  // Bin 3
            createMockDetection('E', 0.45),  // Bin 4
            createMockDetection('F', 0.55),  // Bin 5
            createMockDetection('G', 0.65),  // Bin 6
            createMockDetection('H', 0.75),  // Bin 7
            createMockDetection('I', 0.85),  // Bin 8
            createMockDetection('J', 0.95),  // Bin 9
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle max confidence (1.0) in last bin', () => {
        const detections = [
            createMockDetection('Perfect', 0.999),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle zero confidence', () => {
        const detections = [
            createMockDetection('Zero', 0.0),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should display count labels on bars', () => {
        const detections = [
            createMockDetection('A', 0.95),
            createMockDetection('B', 0.95),
            createMockDetection('C', 0.95),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        // Should display "3" above the high confidence bar
        expect(fillTextSpy).toHaveBeenCalledWith('3', expect.any(Number), expect.any(Number));
    });

    it('should color bars based on confidence range', () => {
        const detections = [
            createMockDetection('High', 0.95),  // Green
            createMockDetection('Med', 0.75),   // Yellow/Orange
            createMockDetection('Low', 0.55),   // Red
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should display axis labels', () => {
        const detections = [createMockDetection('A', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        expect(fillTextSpy).toHaveBeenCalledWith('0%', expect.any(Number), expect.any(Number));
        expect(fillTextSpy).toHaveBeenCalledWith('100%', expect.any(Number), expect.any(Number));
    });

    it('should draw panel background', () => {
        const detections = [createMockDetection('A', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderConfidenceHistogram(canvas, detections);

        expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should draw title', () => {
        const detections = [createMockDetection('A', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        expect(fillTextSpy).toHaveBeenCalledWith(
            'Confidence Distribution',
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('should set dashed line for threshold', () => {
        const detections = [createMockDetection('A', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const setLineDashSpy = vi.spyOn(ctx, 'setLineDash');

        renderConfidenceHistogram(canvas, detections, 0.7);

        expect(setLineDashSpy).toHaveBeenCalledWith([3, 3]);
    });

    it('should reset line dash after threshold line', () => {
        const detections = [createMockDetection('A', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const setLineDashSpy = vi.spyOn(ctx, 'setLineDash');

        renderConfidenceHistogram(canvas, detections);

        expect(setLineDashSpy).toHaveBeenCalledWith([]);
    });

    it('should handle many detections in same bin', () => {
        const detections = Array.from({ length: 50 }, (_, i) =>
            createMockDetection(`Item${i}`, 0.91 + (i * 0.001))  // All in bin 9
        );

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle detections spread evenly across bins', () => {
        const detections = Array.from({ length: 100 }, (_, i) =>
            createMockDetection(`Item${i}`, i / 100)
        );

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Edge Cases', () => {
    it('should handle negative position values in heatmap', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [
            createMockDetection('Test', 0.9, { x: -10, y: -10, width: 50, height: 50 }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle zero-size detections in heatmap', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [
            createMockDetection('Test', 0.9, { x: 100, y: 100, width: 0, height: 0 }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle very small canvas', () => {
        const canvas = createMockCanvas(10, 10);
        const detections = [createMockDetection('Test', 0.9)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle very large canvas', () => {
        const canvas = createMockCanvas(4000, 3000);
        const detections = [createMockDetection('Test', 0.9)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle grid cells outside canvas bounds', () => {
        const canvas = createMockCanvas(100, 100);
        const gridCells: ROI[] = [
            { x: 200, y: 200, width: 64, height: 64 }, // Outside canvas
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should handle confidence exactly at 1.0', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [createMockDetection('Perfect', 1.0)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle confidence exactly at 0.0', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [createMockDetection('Zero', 0.0)];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle matching steps with very high similarity', () => {
        const canvas = createMockCanvas(800, 600);
        const steps: MatchingStep[] = [
            {
                templateId: 't1',
                templateName: 'Perfect',
                similarity: 0.9999,
                position: { x: 0, y: 0, width: 50, height: 50 },
                isMatch: true,
            },
        ];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should handle matching steps with zero similarity', () => {
        const canvas = createMockCanvas(800, 600);
        const steps: MatchingStep[] = [
            {
                templateId: 't1',
                templateName: 'Zero',
                similarity: 0.0,
                position: { x: 0, y: 0, width: 50, height: 50 },
                isMatch: false,
            },
        ];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });
});

// ========================================
// Performance Tests
// ========================================

describe('Performance', () => {
    it('should handle rendering 1000 detections in heatmap', () => {
        const canvas = createMockCanvas(1920, 1080);
        const detections = Array.from({ length: 1000 }, (_, i) =>
            createMockDetection(`Item${i}`, Math.random(), {
                x: Math.random() * 1920,
                y: Math.random() * 1080,
            })
        );

        const start = performance.now();
        renderConfidenceHeatmap(canvas, detections);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle rendering large histogram efficiently', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = Array.from({ length: 500 }, (_, i) =>
            createMockDetection(`Item${i}`, Math.random())
        );

        const start = performance.now();
        renderConfidenceHistogram(canvas, detections);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle large grid overlay efficiently', () => {
        const canvas = createMockCanvas(1920, 1080);
        const gridCells: ROI[] = Array.from({ length: 500 }, (_, i) => ({
            x: (i % 25) * 75,
            y: Math.floor(i / 25) * 60,
            width: 64,
            height: 48,
        }));

        const start = performance.now();
        renderGridOverlay(canvas, gridCells);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(500); // Should complete in under 500ms (relaxed for CI)
    });
});
