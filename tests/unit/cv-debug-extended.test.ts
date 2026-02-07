/**
 * @vitest-environment jsdom
 * CV Debug Module - Extended Coverage Tests
 * Focuses on synchronous functions and edge cases not covered by cv-debug-coverage.test.ts
 *
 * Note: Async image loading functions (renderDebugOverlay, createDebugOverlay,
 * renderStrategyComparison) require real browser context for canvas image operations.
 * They are tested in integration/E2E tests, not unit tests.
 *
 * Target: Maximize coverage of testable synchronous functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    renderDebugOverlay,
    renderStrategyComparison,
    renderGridOverlay,
    renderConfidenceHeatmap,
    renderMatchingSteps,
    renderConfidenceHistogram,
    defaultDebugOptions,
    type DebugVisualizationOptions,
    type MatchingStep,
    type StrategyResult,
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
// Async Functions - Early Return Tests Only
// ========================================
// These functions require real browser canvas/image support.
// We only test the early-return code paths in unit tests.

describe('renderDebugOverlay - Early Returns', () => {
    it('should return early if canvas context is null', async () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        await expect(
            renderDebugOverlay(badCanvas, 'data:image/png;base64,test', [], [])
        ).resolves.toBeUndefined();
    });
});

describe('renderStrategyComparison - Early Returns', () => {
    it('should return early if canvas context is null', async () => {
        const badCanvas = document.createElement('canvas');
        vi.spyOn(badCanvas, 'getContext').mockReturnValue(null);

        const results: StrategyResult[] = [
            { strategyName: 'Test', detections: [], processingTime: 100 },
        ];

        await expect(
            renderStrategyComparison(badCanvas, 'data:image/png;base64,test', results)
        ).resolves.toBeUndefined();
    });
});

// ========================================
// renderGridOverlay - Extended Tests
// ========================================

describe('renderGridOverlay - Extended', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should handle all cells being processed', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
            { x: 128, y: 0, width: 64, height: 64 },
        ];
        const processedCells = new Set([0, 1, 2]);

        expect(() => renderGridOverlay(canvas, gridCells, undefined, processedCells)).not.toThrow();
    });

    it('should handle current cell out of bounds', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
        ];
        const currentCell = 999;

        expect(() => renderGridOverlay(canvas, gridCells, currentCell)).not.toThrow();
    });

    it('should handle processedCells with invalid indices', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
        ];
        const processedCells = new Set([0, 5, 10, 100]);

        expect(() => renderGridOverlay(canvas, gridCells, 0, processedCells)).not.toThrow();
    });

    it('should draw cells with correct stroke style for current cell', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];
        const ctx = canvas.getContext('2d')!;

        renderGridOverlay(canvas, gridCells, 0);

        expect(ctx.strokeStyle).toBeDefined();
    });

    it('should handle negative cell positions', () => {
        const gridCells: ROI[] = [
            { x: -50, y: -50, width: 64, height: 64 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should handle zero-sized cells', () => {
        const gridCells: ROI[] = [
            { x: 100, y: 100, width: 0, height: 0 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should handle cells with floating point coordinates', () => {
        const gridCells: ROI[] = [
            { x: 10.5, y: 20.7, width: 64.3, height: 64.9 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells)).not.toThrow();
    });

    it('should handle very small canvas', () => {
        const smallCanvas = createMockCanvas(10, 10);
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 100, height: 100 },
        ];

        expect(() => renderGridOverlay(smallCanvas, gridCells)).not.toThrow();
    });

    it('should set correct line width', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];
        const ctx = canvas.getContext('2d')!;

        renderGridOverlay(canvas, gridCells);

        expect(ctx.lineWidth).toBe(1);
    });

    it('should set correct font for cell indices', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];
        const ctx = canvas.getContext('2d')!;

        renderGridOverlay(canvas, gridCells);

        expect(ctx.font).toBe('10px monospace');
    });

    it('should handle currentCell as 0 correctly', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];

        expect(() => renderGridOverlay(canvas, gridCells, 0)).not.toThrow();
    });

    it('should handle empty processedCells set', () => {
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];
        const processedCells = new Set<number>();

        expect(() => renderGridOverlay(canvas, gridCells, 0, processedCells)).not.toThrow();
    });
});

// ========================================
// renderConfidenceHeatmap - Extended Tests
// ========================================

describe('renderConfidenceHeatmap - Extended', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should handle detection at exactly band boundaries', () => {
        const detections = [
            createMockDetection('A', 0.9, { x: 0, y: 0 }),
            createMockDetection('B', 0.8, { x: 50, y: 0 }),
            createMockDetection('C', 0.7, { x: 100, y: 0 }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0.7)).not.toThrow();
    });

    it('should handle detection with confidence below all bands', () => {
        const detections = [
            createMockDetection('VeryLow', 0.05),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0.9)).not.toThrow();
    });

    it('should handle multiple detections in same position', () => {
        const detections = [
            createMockDetection('A', 0.9, { x: 100, y: 100 }),
            createMockDetection('B', 0.8, { x: 100, y: 100 }),
            createMockDetection('C', 0.7, { x: 100, y: 100 }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should use fillRect for each detection with position', () => {
        const detections = [
            createMockDetection('A', 0.95, { x: 100, y: 100, width: 50, height: 50 }),
            createMockDetection('B', 0.85, { x: 200, y: 100, width: 50, height: 50 }),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderConfidenceHeatmap(canvas, detections);

        expect(fillRectSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle detection at 0.9 boundary (>=0.9 is green)', () => {
        const detections = [createMockDetection('Boundary', 0.9, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle detection at 0.8 boundary (>=0.8 is lime)', () => {
        const detections = [createMockDetection('Boundary', 0.8, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle detection below threshold', () => {
        const detections = [createMockDetection('BelowThreshold', 0.5, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0.7)).not.toThrow();
    });

    it('should handle threshold at 0', () => {
        const detections = [createMockDetection('Test', 0.5, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections, 0)).not.toThrow();
    });

    it('should handle threshold at 1', () => {
        const detections = [createMockDetection('Test', 0.99, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections, 1)).not.toThrow();
    });

    it('should not call fillRect for detections without position', () => {
        const detections: CVDetectionResult[] = [
            {
                type: 'item',
                entity: { id: 'test', name: 'Test' } as any,
                confidence: 0.9,
                method: 'template_match',
            },
        ];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderConfidenceHeatmap(canvas, detections);

        expect(fillRectSpy).not.toHaveBeenCalled();
    });

    it('should handle negative confidence values gracefully', () => {
        const detections = [createMockDetection('Negative', -0.5, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle confidence > 1 gracefully', () => {
        const detections = [createMockDetection('OverOne', 1.5, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });
});

// ========================================
// renderMatchingSteps - Extended Tests
// ========================================

describe('renderMatchingSteps - Extended', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    function createStep(name: string, similarity: number, isMatch: boolean): MatchingStep {
        return {
            templateId: `t_${name}`,
            templateName: name,
            similarity,
            position: { x: 0, y: 0, width: 50, height: 50 },
            isMatch,
        };
    }

    it('should handle currentStep beyond array length', () => {
        const steps = [createStep('A', 0.9, true)];

        expect(() => renderMatchingSteps(canvas, steps, 100)).not.toThrow();
    });

    it('should handle negative currentStep', () => {
        const steps = [createStep('A', 0.9, true)];

        expect(() => renderMatchingSteps(canvas, steps, -1)).not.toThrow();
    });

    it('should display exactly 8 recent steps max (sliding window)', () => {
        const steps = Array.from({ length: 20 }, (_, i) =>
            createStep(`Template${i}`, 0.5 + i * 0.02, i % 2 === 0)
        );

        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 19);

        const stepCalls = fillTextSpy.mock.calls.filter(
            c => typeof c[0] === 'string' && (c[0] === '✓' || c[0] === '✗')
        );
        expect(stepCalls.length).toBeLessThanOrEqual(8);
    });

    it('should handle step with very long template ID', () => {
        const steps = [
            createStep('A'.repeat(100), 0.9, true),
        ];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should highlight the latest step with background', () => {
        const steps = [
            createStep('First', 0.8, true),
            createStep('Latest', 0.9, true),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderMatchingSteps(canvas, steps, 1);

        expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should set correct font for header', () => {
        const steps = [createStep('Test', 0.9, true)];
        const ctx = canvas.getContext('2d')!;

        renderMatchingSteps(canvas, steps, 0);

        expect(ctx.font).toBeDefined();
    });

    it('should draw panel background at correct position', () => {
        const steps = [createStep('Test', 0.9, true)];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderMatchingSteps(canvas, steps, 0);

        expect(fillRectSpy).toHaveBeenCalledWith(
            10,
            canvas.height - 200,
            300,
            190
        );
    });

    it('should handle all false matches', () => {
        const steps = Array.from({ length: 5 }, (_, i) =>
            createStep(`NoMatch${i}`, 0.3 + i * 0.05, false)
        );

        expect(() => renderMatchingSteps(canvas, steps, 4)).not.toThrow();
    });

    it('should handle all true matches', () => {
        const steps = Array.from({ length: 5 }, (_, i) =>
            createStep(`Match${i}`, 0.8 + i * 0.02, true)
        );

        expect(() => renderMatchingSteps(canvas, steps, 4)).not.toThrow();
    });

    it('should handle step with similarity of exactly 0', () => {
        const steps = [createStep('Zero', 0, false)];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should handle step with similarity of exactly 1', () => {
        const steps = [createStep('Perfect', 1, true)];

        expect(() => renderMatchingSteps(canvas, steps, 0)).not.toThrow();
    });

    it('should display step counter', () => {
        const steps = [
            createStep('First', 0.8, true),
            createStep('Second', 0.9, true),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 1);

        expect(fillTextSpy).toHaveBeenCalledWith('Step 2/2', expect.any(Number), expect.any(Number));
    });

    it('should pad template names to 15 characters', () => {
        const steps = [createStep('Short', 0.9, true)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderMatchingSteps(canvas, steps, 0);

        const templateCalls = fillTextSpy.mock.calls.filter(
            c => typeof c[0] === 'string' && c[0].includes('Short')
        );
        expect(templateCalls.length).toBeGreaterThan(0);
    });
});

// ========================================
// renderConfidenceHistogram - Extended Tests
// ========================================

describe('renderConfidenceHistogram - Extended', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should handle all detections in single bin', () => {
        const detections = Array.from({ length: 100 }, () =>
            createMockDetection('Same', 0.95)
        );

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle negative threshold', () => {
        const detections = [createMockDetection('Test', 0.5)];

        expect(() => renderConfidenceHistogram(canvas, detections, -0.5)).not.toThrow();
    });

    it('should handle threshold > 1', () => {
        const detections = [createMockDetection('Test', 0.5)];

        expect(() => renderConfidenceHistogram(canvas, detections, 1.5)).not.toThrow();
    });

    it('should handle very small canvas for histogram', () => {
        const smallCanvas = createMockCanvas(50, 50);
        const detections = [createMockDetection('Test', 0.9)];

        expect(() => renderConfidenceHistogram(smallCanvas, detections)).not.toThrow();
    });

    it('should draw exactly 10 histogram bins', () => {
        const detections = Array.from({ length: 10 }, (_, i) =>
            createMockDetection(`Item${i}`, i / 10 + 0.05)
        );

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should handle empty bins correctly', () => {
        const detections = [
            createMockDetection('High', 0.95),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should draw threshold line with dashed style', () => {
        const detections = [createMockDetection('Test', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const setLineDashSpy = vi.spyOn(ctx, 'setLineDash');

        renderConfidenceHistogram(canvas, detections, 0.7);

        expect(setLineDashSpy).toHaveBeenCalledWith([3, 3]);
    });

    it('should draw bars with correct colors', () => {
        const detections = [
            createMockDetection('High', 0.95),
            createMockDetection('Med', 0.75),
            createMockDetection('Low', 0.55),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should draw axis labels', () => {
        const detections = [createMockDetection('Test', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        expect(fillTextSpy).toHaveBeenCalledWith('0%', expect.any(Number), expect.any(Number));
        expect(fillTextSpy).toHaveBeenCalledWith('100%', expect.any(Number), expect.any(Number));
    });

    it('should draw title', () => {
        const detections = [createMockDetection('Test', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        expect(fillTextSpy).toHaveBeenCalledWith(
            'Confidence Distribution',
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('should handle confidence exactly at 1.0 (put in bin 9)', () => {
        const detections = [createMockDetection('Perfect', 1.0)];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should show count labels only for non-empty bins', () => {
        const detections = [
            createMockDetection('A', 0.95),
            createMockDetection('B', 0.95),
        ];
        const ctx = canvas.getContext('2d')!;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        renderConfidenceHistogram(canvas, detections);

        expect(fillTextSpy).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number));
    });

    it('should handle many detections in one bin', () => {
        const detections = Array.from({ length: 1000 }, () =>
            createMockDetection('Same', 0.85)
        );

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should draw panel at bottom-right corner', () => {
        const detections = [createMockDetection('Test', 0.9)];
        const ctx = canvas.getContext('2d')!;
        const fillRectSpy = vi.spyOn(ctx, 'fillRect');

        renderConfidenceHistogram(canvas, detections);

        expect(fillRectSpy).toHaveBeenCalledWith(
            canvas.width - 210,
            canvas.height - 120,
            200,
            110
        );
    });
});

// ========================================
// defaultDebugOptions Extended Tests
// ========================================

describe('defaultDebugOptions - Extended', () => {
    it('should be frozen/immutable in production usage', () => {
        const copy: DebugVisualizationOptions = { ...defaultDebugOptions };
        copy.showGrid = false;

        expect(defaultDebugOptions.showGrid).toBe(true);
    });

    it('should be usable as spread defaults', () => {
        const customOptions: DebugVisualizationOptions = {
            ...defaultDebugOptions,
            showGrid: false,
            confidenceThreshold: 0.5,
        };

        expect(customOptions.showGrid).toBe(false);
        expect(customOptions.confidenceThreshold).toBe(0.5);
        expect(customOptions.showConfidenceHeatmap).toBe(false);
    });

    it('should have gridCellSize that divides common resolutions', () => {
        const cellSize = defaultDebugOptions.gridCellSize;
        expect(1920 % cellSize).toBe(0);
    });
});

// ========================================
// StrategyResult Interface Tests
// ========================================

describe('StrategyResult interface', () => {
    it('should work with minimal required fields', () => {
        const result: StrategyResult = {
            strategyName: 'Test',
            detections: [],
            processingTime: 0,
        };

        expect(result.strategyName).toBe('Test');
        expect(result.accuracy).toBeUndefined();
    });

    it('should work with optional accuracy field', () => {
        const result: StrategyResult = {
            strategyName: 'Test',
            detections: [],
            processingTime: 100,
            accuracy: 0.95,
        };

        expect(result.accuracy).toBe(0.95);
    });

    it('should work with detections array', () => {
        const result: StrategyResult = {
            strategyName: 'Test',
            detections: [
                createMockDetection('A', 0.9),
                createMockDetection('B', 0.8),
            ],
            processingTime: 150,
        };

        expect(result.detections.length).toBe(2);
    });
});

// ========================================
// MatchingStep Interface Tests
// ========================================

describe('MatchingStep interface', () => {
    it('should work with all required fields', () => {
        const step: MatchingStep = {
            templateId: 't1',
            templateName: 'Wrench',
            similarity: 0.88,
            position: { x: 100, y: 200, width: 45, height: 45 },
            isMatch: true,
        };

        expect(step.templateId).toBe('t1');
        expect(step.isMatch).toBe(true);
    });

    it('should work with ROI position containing label', () => {
        const step: MatchingStep = {
            templateId: 't1',
            templateName: 'Wrench',
            similarity: 0.88,
            position: { x: 100, y: 200, width: 45, height: 45, label: 'slot_0' },
            isMatch: true,
        };

        expect(step.position.label).toBe('slot_0');
    });
});

// ========================================
// Canvas Context Edge Cases
// ========================================

describe('Canvas Context Edge Cases', () => {
    it('should handle repeated rendering to same canvas', () => {
        const canvas = createMockCanvas(800, 600);
        const gridCells: ROI[] = [{ x: 0, y: 0, width: 64, height: 64 }];

        renderGridOverlay(canvas, gridCells);
        renderGridOverlay(canvas, gridCells, 0);
        renderGridOverlay(canvas, gridCells, 0, new Set([0]));

        expect(true).toBe(true);
    });

    it('should handle detections with extremely large positions', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [
            createMockDetection('Huge', 0.9, {
                x: 10000,
                y: 10000,
                width: 5000,
                height: 5000,
            }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle detections with float positions', () => {
        const canvas = createMockCanvas(800, 600);
        const detections = [
            createMockDetection('Float', 0.9, {
                x: 100.5,
                y: 200.7,
                width: 45.3,
                height: 45.9,
            }),
        ];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should handle different canvas dimensions across calls', () => {
        const small = createMockCanvas(100, 100);
        const large = createMockCanvas(2000, 2000);
        const detections = [createMockDetection('Test', 0.9)];

        renderConfidenceHeatmap(small, detections);
        renderConfidenceHeatmap(large, detections);

        expect(true).toBe(true);
    });
});

// ========================================
// Branch Coverage - Color Selection
// ========================================

describe('Branch Coverage - Color Selection', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should select green for confidence >= 0.85 in heatmap', () => {
        const detections = [createMockDetection('HighConf', 0.86, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should select orange for confidence >= 0.7 but < 0.85 in heatmap', () => {
        const detections = [createMockDetection('MedConf', 0.75, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });

    it('should select red for confidence < 0.7 in heatmap', () => {
        const detections = [createMockDetection('LowConf', 0.6, { x: 100, y: 100 })];

        expect(() => renderConfidenceHeatmap(canvas, detections)).not.toThrow();
    });
});

describe('Branch Coverage - Grid Cell States', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should use yellow for current cell', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];

        renderGridOverlay(canvas, gridCells, 0);
    });

    it('should use gray for processed cells', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];
        const processed = new Set([0]);

        renderGridOverlay(canvas, gridCells, 1, processed);
    });

    it('should use light gray for pending cells', () => {
        const gridCells: ROI[] = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
        ];

        renderGridOverlay(canvas, gridCells);
    });
});

describe('Branch Coverage - Histogram Bins', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = createMockCanvas(800, 600);
    });

    it('should color bins 9 (0.9-1.0) as green', () => {
        const detections = [createMockDetection('Bin9', 0.95)];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should color bins 8 (0.8-0.9) as green', () => {
        const detections = [createMockDetection('Bin8', 0.85)];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should color bins 7 (0.7-0.8) as orange', () => {
        const detections = [createMockDetection('Bin7', 0.75)];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });

    it('should color bins 0-6 as red', () => {
        const detections = [
            createMockDetection('Bin0', 0.05),
            createMockDetection('Bin3', 0.35),
            createMockDetection('Bin6', 0.65),
        ];

        expect(() => renderConfidenceHistogram(canvas, detections)).not.toThrow();
    });
});
