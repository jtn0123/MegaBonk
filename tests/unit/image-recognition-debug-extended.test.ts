// ========================================
// Image Recognition Debug Module - Extended Tests
// ========================================
// Focus: Debug overlay rendering, grid visualization, error state handling
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
    setDebugEnabled,
    isDebugEnabled,
    setDebugOptions,
    getDebugOptions,
    log,
    getLogs,
    getLogsByCategory,
    getLogsByLevel,
    clearLogs,
    exportLogs,
    recordDetection,
    recordCacheAccess,
    getStats,
    resetStats,
    validateDetectionResults,
    analyzeRegionColors,
    createDebugCanvas,
    drawDebugRegions,
    drawSlotGrid,
    drawDetectionBoxes,
    createDebugOverlay,
    downloadDebugImage,
    registerDebugCommands,
} from '../../src/modules/image-recognition-debug';
import type {
    DebugOverlayOptions,
    DebugRegion,
    SlotInfo,
    CVDetectionResult,
    ValidationTestCase,
    RegionOfInterest,
} from '../../src/types/computer-vision';
import {
    createMockImageData,
    createMockDetectionResults,
    createMockSlots,
} from '../fixtures/cv-test-fixtures';

// ========================================
// Mock Canvas and DOM APIs
// ========================================

class MockCanvasRenderingContext2D {
    canvas: MockHTMLCanvasElement;
    fillStyle: string = '#000000';
    strokeStyle: string = '#000000';
    lineWidth: number = 1;
    font: string = '12px monospace';
    globalAlpha: number = 1;

    private lineDash: number[] = [];
    private operations: string[] = [];

    constructor(canvas: MockHTMLCanvasElement) {
        this.canvas = canvas;
    }

    drawImage(
        _source: unknown,
        _dx: number,
        _dy: number,
        _dw?: number,
        _dh?: number
    ): void {
        this.operations.push('drawImage');
    }

    strokeRect(x: number, y: number, w: number, h: number): void {
        this.operations.push(`strokeRect(${x},${y},${w},${h})`);
    }

    fillRect(x: number, y: number, w: number, h: number): void {
        this.operations.push(`fillRect(${x},${y},${w},${h})`);
    }

    fillText(text: string, x: number, y: number): void {
        this.operations.push(`fillText("${text}",${x},${y})`);
    }

    setLineDash(dash: number[]): void {
        this.lineDash = dash;
        this.operations.push(`setLineDash([${dash.join(',')}])`);
    }

    getLineDash(): number[] {
        return this.lineDash;
    }

    measureText(text: string): { width: number } {
        return { width: text.length * 8 };
    }

    save(): void {
        this.operations.push('save');
    }

    restore(): void {
        this.operations.push('restore');
    }

    groupCollapsed(): void {}
    groupEnd(): void {}
    trace(): void {}

    getOperations(): string[] {
        return this.operations;
    }

    clearOperations(): void {
        this.operations = [];
    }
}

class MockHTMLCanvasElement {
    width: number = 1920;
    height: number = 1080;
    private ctx: MockCanvasRenderingContext2D | null = null;

    getContext(type: string, _options?: unknown): MockCanvasRenderingContext2D | null {
        if (type === '2d') {
            if (!this.ctx) {
                this.ctx = new MockCanvasRenderingContext2D(this);
            }
            return this.ctx;
        }
        return null;
    }

    toDataURL(type: string = 'image/png'): string {
        return `data:${type};base64,mockImageData`;
    }
}

class MockHTMLImageElement {
    width: number = 1920;
    height: number = 1080;
    src: string = '';
    onload: (() => void) | null = null;
    onerror: ((error: Error) => void) | null = null;

    constructor() {
        // Simulate async load
        setTimeout(() => {
            if (this.src && this.onload) {
                this.onload();
            }
        }, 0);
    }
}

class MockImageBitmap {
    width: number = 1920;
    height: number = 1080;
}

// ========================================
// Test Setup
// ========================================

describe('Image Recognition Debug Module - Extended Tests', () => {
    let mockDocument: {
        createElement: Mock;
        body: { appendChild: Mock; removeChild: Mock };
    };
    let mockWindow: Record<string, unknown>;
    let originalDocument: typeof globalThis.document;
    let originalWindow: typeof globalThis.window;
    let originalImage: typeof globalThis.Image;

    beforeEach(() => {
        // Clear logs and reset stats
        clearLogs();
        resetStats();
        setDebugEnabled(false);

        // Reset debug options to defaults
        setDebugOptions({
            showRegionBounds: true,
            showSlotGrid: true,
            showConfidenceLabels: true,
            showDetectionBoxes: true,
            showVarianceHeatmap: false,
            showDominantColors: false,
            regionColors: {
                items: '#00ff88',
                weapons: '#ff6b6b',
                tomes: '#4ecdc4',
                character: '#f7dc6f',
                unknown: '#95a5a6',
            },
            fontSize: 12,
            lineWidth: 2,
        });

        // Store originals
        originalDocument = globalThis.document;
        originalWindow = globalThis.window;
        originalImage = globalThis.Image;

        // Create mock document
        mockDocument = {
            createElement: vi.fn((type: string) => {
                if (type === 'canvas') {
                    return new MockHTMLCanvasElement();
                }
                if (type === 'a') {
                    return {
                        href: '',
                        download: '',
                        click: vi.fn(),
                    };
                }
                return {};
            }),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn(),
            },
        };

        // Create mock window
        mockWindow = {
            localStorage: {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
            },
        };

        // Assign mocks
        (globalThis as unknown as { document: typeof mockDocument }).document = mockDocument;
        (globalThis as unknown as { window: typeof mockWindow }).window = mockWindow as unknown as Window & typeof globalThis;
        (globalThis as unknown as { Image: typeof MockHTMLImageElement }).Image = MockHTMLImageElement as unknown as typeof Image;
    });

    afterEach(() => {
        // Restore originals
        if (originalDocument !== undefined) {
            (globalThis as unknown as { document: typeof originalDocument }).document = originalDocument;
        }
        if (originalWindow !== undefined) {
            (globalThis as unknown as { window: typeof originalWindow }).window = originalWindow;
        }
        if (originalImage !== undefined) {
            (globalThis as unknown as { Image: typeof originalImage }).Image = originalImage;
        }
        vi.restoreAllMocks();
    });

    // ========================================
    // Debug Canvas Creation Tests
    // ========================================

    describe('createDebugCanvas', () => {
        it('should create canvas with default dimensions from source image', () => {
            const mockImage = new MockHTMLImageElement();
            mockImage.width = 1920;
            mockImage.height = 1080;

            const canvas = createDebugCanvas(mockImage as unknown as HTMLImageElement);

            expect(canvas.width).toBe(1920);
            expect(canvas.height).toBe(1080);
        });

        it('should create canvas with custom dimensions when provided', () => {
            const mockImage = new MockHTMLImageElement();
            mockImage.width = 1920;
            mockImage.height = 1080;

            const canvas = createDebugCanvas(mockImage as unknown as HTMLImageElement, 800, 600);

            expect(canvas.width).toBe(800);
            expect(canvas.height).toBe(600);
        });

        it('should work with HTMLCanvasElement as source', () => {
            const sourceCanvas = new MockHTMLCanvasElement();
            sourceCanvas.width = 1280;
            sourceCanvas.height = 720;

            const canvas = createDebugCanvas(sourceCanvas as unknown as HTMLCanvasElement);

            expect(canvas.width).toBe(1280);
            expect(canvas.height).toBe(720);
        });

        it('should work with ImageBitmap as source', () => {
            const mockBitmap = new MockImageBitmap();
            mockBitmap.width = 2560;
            mockBitmap.height = 1440;

            const canvas = createDebugCanvas(mockBitmap as unknown as ImageBitmap);

            expect(canvas.width).toBe(2560);
            expect(canvas.height).toBe(1440);
        });

        it('should draw source image onto canvas', () => {
            const mockImage = new MockHTMLImageElement();
            const canvas = createDebugCanvas(mockImage as unknown as HTMLImageElement);

            const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;
            expect(ctx.getOperations()).toContain('drawImage');
        });
    });

    // ========================================
    // Draw Debug Regions Tests
    // ========================================

    describe('drawDebugRegions', () => {
        let canvas: MockHTMLCanvasElement;
        let ctx: MockCanvasRenderingContext2D;

        beforeEach(() => {
            canvas = new MockHTMLCanvasElement();
            ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;
            ctx.clearOperations();
        });

        it('should draw region boxes with correct color', () => {
            const regions: DebugRegion[] = [
                {
                    x: 100,
                    y: 200,
                    width: 300,
                    height: 100,
                    label: 'Test Region',
                    color: '#ff0000',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            expect(ctx.strokeStyle).toBe('#ff0000');
            expect(ctx.getOperations()).toContain('strokeRect(100,200,300,100)');
        });

        it('should handle dashed stroke style', () => {
            const regions: DebugRegion[] = [
                {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    label: 'Dashed',
                    color: '#0000ff',
                    strokeStyle: 'dashed',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            expect(ctx.getOperations()).toContain('setLineDash([8,4])');
        });

        it('should handle dotted stroke style', () => {
            const regions: DebugRegion[] = [
                {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    label: 'Dotted',
                    color: '#00ff00',
                    strokeStyle: 'dotted',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            expect(ctx.getOperations()).toContain('setLineDash([2,2])');
        });

        it('should handle solid stroke style (default)', () => {
            const regions: DebugRegion[] = [
                {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    label: 'Solid',
                    color: '#00ff00',
                    strokeStyle: 'solid',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            expect(ctx.getOperations()).toContain('setLineDash([])');
        });

        it('should draw fill with opacity when specified', () => {
            const regions: DebugRegion[] = [
                {
                    x: 50,
                    y: 50,
                    width: 200,
                    height: 150,
                    label: 'Filled',
                    color: '#ff00ff',
                    fillOpacity: 0.3,
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            expect(ctx.getOperations()).toContain('fillRect(50,50,200,150)');
        });

        it('should draw labels when showConfidenceLabels is true', () => {
            const regions: DebugRegion[] = [
                {
                    x: 100,
                    y: 100,
                    width: 100,
                    height: 100,
                    label: 'Labeled Region',
                    color: '#ffffff',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions, { showConfidenceLabels: true });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('fillText') && op.includes('Labeled Region'))).toBe(true);
        });

        it('should include confidence percentage in label', () => {
            const regions: DebugRegion[] = [
                {
                    x: 100,
                    y: 100,
                    width: 100,
                    height: 100,
                    label: 'Items',
                    color: '#00ff88',
                    confidence: 0.95,
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions, { showConfidenceLabels: true });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('95.0%'))).toBe(true);
        });

        it('should skip labels when showConfidenceLabels is false', () => {
            const regions: DebugRegion[] = [
                {
                    x: 100,
                    y: 100,
                    width: 100,
                    height: 100,
                    label: 'Should Not Show',
                    color: '#ffffff',
                },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions, { showConfidenceLabels: false });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('Should Not Show'))).toBe(false);
        });

        it('should draw multiple regions', () => {
            const regions: DebugRegion[] = [
                { x: 0, y: 0, width: 100, height: 100, label: 'A', color: '#ff0000' },
                { x: 200, y: 0, width: 100, height: 100, label: 'B', color: '#00ff00' },
                { x: 400, y: 0, width: 100, height: 100, label: 'C', color: '#0000ff' },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions);

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(3);
        });

        it('should apply custom lineWidth from options', () => {
            const regions: DebugRegion[] = [
                { x: 0, y: 0, width: 100, height: 100, label: 'Test', color: '#ffffff' },
            ];

            drawDebugRegions(canvas as unknown as HTMLCanvasElement, regions, { lineWidth: 5 });

            expect(ctx.lineWidth).toBe(5);
        });

        it('should handle empty regions array', () => {
            drawDebugRegions(canvas as unknown as HTMLCanvasElement, []);

            // Should not throw, operations should be minimal
            expect(ctx.getOperations().filter(op => op.startsWith('strokeRect')).length).toBe(0);
        });

        it('should handle null canvas context gracefully', () => {
            const badCanvas = {
                getContext: () => null,
            } as unknown as HTMLCanvasElement;

            // Should not throw
            expect(() => {
                drawDebugRegions(badCanvas, [
                    { x: 0, y: 0, width: 100, height: 100, label: 'Test', color: '#fff' },
                ]);
            }).not.toThrow();
        });
    });

    // ========================================
    // Draw Slot Grid Tests
    // ========================================

    describe('drawSlotGrid', () => {
        let canvas: MockHTMLCanvasElement;
        let ctx: MockCanvasRenderingContext2D;

        beforeEach(() => {
            canvas = new MockHTMLCanvasElement();
            ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;
            ctx.clearOperations();
        });

        it('should draw slot borders with correct occupied style', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true },
                { index: 1, x: 150, y: 900, width: 45, height: 45, occupied: false },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff');

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(2);
        });

        it('should use different colors for occupied vs empty slots', () => {
            const occupiedSlot: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true },
            ];
            const emptySlot: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: false },
            ];

            // Draw occupied
            drawSlotGrid(canvas as unknown as HTMLCanvasElement, occupiedSlot, '#ffffff');
            expect(ctx.strokeStyle).toBe('#00ff88');

            ctx.clearOperations();

            // Draw empty
            drawSlotGrid(canvas as unknown as HTMLCanvasElement, emptySlot, '#ffffff');
            expect(ctx.strokeStyle).toBe('#666666');
        });

        it('should draw slot indices when showConfidenceLabels is enabled', () => {
            const slots: SlotInfo[] = [
                { index: 5, x: 100, y: 900, width: 45, height: 45, occupied: true },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff', { showConfidenceLabels: true });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('fillText') && op.includes('5'))).toBe(true);
        });

        it('should show variance heatmap when enabled', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true, variance: 150 },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff', { showVarianceHeatmap: true });

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('fillRect')).length).toBeGreaterThan(0);
        });

        it('should skip rendering when showSlotGrid is false', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff', { showSlotGrid: false });

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(0);
        });

        it('should handle empty slots array', () => {
            drawSlotGrid(canvas as unknown as HTMLCanvasElement, [], '#ffffff');

            expect(ctx.getOperations().filter(op => op.startsWith('strokeRect')).length).toBe(0);
        });

        it('should use dashed line for empty slots', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: false },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff');

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('setLineDash([4,4])'))).toBe(true);
        });

        it('should use solid line for occupied slots', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff');

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('setLineDash([])'))).toBe(true);
        });

        it('should reset line dash at the end', () => {
            const slots: SlotInfo[] = [
                { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: false },
                { index: 1, x: 150, y: 900, width: 45, height: 45, occupied: true },
            ];

            drawSlotGrid(canvas as unknown as HTMLCanvasElement, slots, '#ffffff');

            const ops = ctx.getOperations();
            // Last setLineDash should be empty (reset)
            const lastDashOp = ops.filter(op => op.startsWith('setLineDash')).pop();
            expect(lastDashOp).toBe('setLineDash([])');
        });

        it('should handle null canvas context gracefully', () => {
            const badCanvas = {
                getContext: () => null,
            } as unknown as HTMLCanvasElement;

            expect(() => {
                drawSlotGrid(badCanvas, [
                    { index: 0, x: 100, y: 900, width: 45, height: 45, occupied: true },
                ], '#ffffff');
            }).not.toThrow();
        });
    });

    // ========================================
    // Draw Detection Boxes Tests
    // ========================================

    describe('drawDetectionBoxes', () => {
        let canvas: MockHTMLCanvasElement;
        let ctx: MockCanvasRenderingContext2D;

        beforeEach(() => {
            canvas = new MockHTMLCanvasElement();
            ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;
            ctx.clearOperations();
        });

        it('should draw boxes for detections with positions', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'big_bonk', name: 'Big Bonk' },
                    confidence: 0.95,
                    position: { x: 100, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88');

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('strokeRect(100,900,45,45)'))).toBe(true);
        });

        it('should skip detections without positions', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'big_bonk', name: 'Big Bonk' },
                    confidence: 0.95,
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88');

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(0);
        });

        it('should draw entity name and confidence label', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'ice_cube', name: 'Ice Cube' },
                    confidence: 0.87,
                    position: { x: 200, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88', { showConfidenceLabels: true });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('Ice Cube') && op.includes('87%'))).toBe(true);
        });

        it('should skip labels when showConfidenceLabels is false', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'medkit', name: 'Medkit' },
                    confidence: 0.92,
                    position: { x: 300, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88', { showConfidenceLabels: false });

            const ops = ctx.getOperations();
            expect(ops.some(op => op.includes('Medkit'))).toBe(false);
        });

        it('should use the provided color', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'weapon',
                    entity: { id: 'hammer', name: 'Hammer' },
                    confidence: 0.88,
                    position: { x: 50, y: 25, width: 50, height: 50 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#ff6b6b');

            expect(ctx.strokeStyle).toBe('#ff6b6b');
        });

        it('should skip rendering when showDetectionBoxes is false', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'clover', name: 'Clover' },
                    confidence: 0.91,
                    position: { x: 400, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88', { showDetectionBoxes: false });

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(0);
        });

        it('should draw multiple detections', () => {
            const detections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'a', name: 'Item A' },
                    confidence: 0.9,
                    position: { x: 100, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
                {
                    type: 'item',
                    entity: { id: 'b', name: 'Item B' },
                    confidence: 0.85,
                    position: { x: 150, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
                {
                    type: 'item',
                    entity: { id: 'c', name: 'Item C' },
                    confidence: 0.88,
                    position: { x: 200, y: 900, width: 45, height: 45 },
                    method: 'template_match',
                } as CVDetectionResult,
            ];

            drawDetectionBoxes(canvas as unknown as HTMLCanvasElement, detections, '#00ff88');

            const ops = ctx.getOperations();
            expect(ops.filter(op => op.startsWith('strokeRect')).length).toBe(3);
        });

        it('should handle null canvas context gracefully', () => {
            const badCanvas = {
                getContext: () => null,
            } as unknown as HTMLCanvasElement;

            expect(() => {
                drawDetectionBoxes(badCanvas, [
                    {
                        type: 'item',
                        entity: { id: 'test', name: 'Test' },
                        confidence: 0.9,
                        position: { x: 0, y: 0, width: 50, height: 50 },
                        method: 'template_match',
                    } as CVDetectionResult,
                ], '#00ff88');
            }).not.toThrow();
        });
    });

    // ========================================
    // Create Debug Overlay Tests
    // ========================================

    describe('createDebugOverlay', () => {
        it('should return a promise that resolves to a data URL', async () => {
            const results = createMockDetectionResults(['Big Bonk'], ['Hammer'], ['HP Tome'], 'Megachad');
            results.regions = [
                {
                    type: 'items_hotbar',
                    x: 0,
                    y: 900,
                    width: 1920,
                    height: 180,
                    confidence: 0.95,
                    slots: createMockSlots(6, [true, true, true, false, false, false]),
                },
            ] as RegionOfInterest[];

            const dataUrl = await createDebugOverlay('data:image/png;base64,test', results as any);

            expect(dataUrl).toMatch(/^data:image\/png;base64/);
        });

        it('should reject when image fails to load', async () => {
            // Create a mock that triggers onerror - we need to override the global Image
            const originalImageMock = (globalThis as unknown as { Image: unknown }).Image;
            
            // Create failing Image mock
            (globalThis as unknown as { Image: unknown }).Image = class FailingImage {
                width = 1920;
                height = 1080;
                src = '';
                onload: (() => void) | null = null;
                onerror: ((error: Error) => void) | null = null;

                constructor() {
                    // Trigger error after assignment
                    setTimeout(() => {
                        if (this.onerror) {
                            this.onerror(new Error('Load failed'));
                        }
                    }, 0);
                }
            };

            const results = createMockDetectionResults([], [], [], undefined);

            await expect(createDebugOverlay('invalid-url', results as any)).rejects.toThrow(
                'Failed to load image for debug overlay'
            );

            // Restore
            (globalThis as unknown as { Image: unknown }).Image = originalImageMock;
        });

        it('should respect showRegionBounds option', async () => {
            const results = createMockDetectionResults([], [], [], undefined);
            results.regions = [
                { type: 'items_hotbar', x: 0, y: 900, width: 100, height: 50, confidence: 0.9 },
            ] as RegionOfInterest[];

            // With showRegionBounds: false
            const dataUrl = await createDebugOverlay('data:image/png;base64,test', results as any, {
                showRegionBounds: false,
            });

            expect(dataUrl).toBeDefined();
        });

        it('should draw slot grids when regions have slots', async () => {
            const results = createMockDetectionResults(['Big Bonk'], [], [], undefined);
            results.regions = [
                {
                    type: 'items_hotbar',
                    x: 0,
                    y: 900,
                    width: 1920,
                    height: 180,
                    confidence: 0.95,
                    slots: createMockSlots(3, [true, false, true]),
                },
            ] as RegionOfInterest[];

            const dataUrl = await createDebugOverlay('data:image/png;base64,test', results as any);

            expect(dataUrl).toBeDefined();
        });

        it('should draw detection boxes for all entity types', async () => {
            const results = createMockDetectionResults(
                ['Big Bonk', 'Ice Cube'],
                ['Hammer', 'Sword'],
                ['HP Tome', 'Damage Tome'],
                'Megachad'
            );
            results.regions = [];

            const dataUrl = await createDebugOverlay('data:image/png;base64,test', results as any);

            expect(dataUrl).toBeDefined();
        });

        it('should handle empty detection results', async () => {
            const results = createMockDetectionResults([], [], [], undefined);
            results.regions = [];

            const dataUrl = await createDebugOverlay('data:image/png;base64,test', results as any);

            expect(dataUrl).toMatch(/^data:image\/png;base64/);
        });
    });

    // ========================================
    // Download Debug Image Tests
    // ========================================

    describe('downloadDebugImage', () => {
        it('should create download link and trigger click', () => {
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            mockDocument.createElement.mockReturnValue(mockLink);

            downloadDebugImage('data:image/png;base64,test', 'debug-overlay.png');

            expect(mockDocument.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.href).toBe('data:image/png;base64,test');
            expect(mockLink.download).toBe('debug-overlay.png');
            expect(mockLink.click).toHaveBeenCalled();
        });

        it('should use default filename when not provided', () => {
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            mockDocument.createElement.mockReturnValue(mockLink);

            downloadDebugImage('data:image/png;base64,test');

            expect(mockLink.download).toBe('debug-overlay.png');
        });

        it('should append and remove link from body', () => {
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            mockDocument.createElement.mockReturnValue(mockLink);

            downloadDebugImage('data:image/png;base64,test');

            expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockLink);
            expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockLink);
        });

        it('should log export event', () => {
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            mockDocument.createElement.mockReturnValue(mockLink);

            downloadDebugImage('data:image/png;base64,test', 'custom-name.png');

            const logs = getLogsByCategory('export');
            expect(logs.some(l => l.message.includes('custom-name.png'))).toBe(true);
        });
    });

    // ========================================
    // Register Debug Commands Tests
    // ========================================

    describe('registerDebugCommands', () => {
        it('should register cvDebug on window', () => {
            registerDebugCommands();

            expect((mockWindow as Record<string, unknown>).cvDebug).toBeDefined();
        });

        it('should provide enable/disable functions', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => void>;
            expect(typeof cvDebug.enable).toBe('function');
            expect(typeof cvDebug.disable).toBe('function');
        });

        it('should provide getLogs function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => unknown>;
            log('test', 'Test message');

            const logs = cvDebug.getLogs() as unknown[];
            expect(Array.isArray(logs)).toBe(true);
        });

        it('should provide getStats function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => unknown>;
            const stats = cvDebug.getStats() as { totalDetections: number };

            expect(stats).toBeDefined();
            expect(typeof stats.totalDetections).toBe('number');
        });

        it('should provide clearLogs function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => void>;
            log('test', 'Message to clear');
            cvDebug.clearLogs();

            const logs = getLogs();
            expect(logs.length).toBe(1); // Only the "Logs cleared" message
        });

        it('should provide resetStats function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => void>;
            recordCacheAccess(true);
            cvDebug.resetStats();

            const stats = getStats();
            expect(stats.templateCacheHits).toBe(0);
        });

        it('should provide exportLogs function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => string>;
            log('test', 'Export test');

            const exported = cvDebug.exportLogs();
            expect(typeof exported).toBe('string');
            expect(() => JSON.parse(exported)).not.toThrow();
        });

        it('should provide setOptions function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, (opts: Partial<DebugOverlayOptions>) => void>;
            cvDebug.setOptions({ showSlotGrid: false });

            const options = getDebugOptions();
            expect(options.showSlotGrid).toBe(false);
        });

        it('should provide getOptions function', () => {
            registerDebugCommands();

            const cvDebug = (mockWindow as Record<string, unknown>).cvDebug as Record<string, () => DebugOverlayOptions>;
            const options = cvDebug.getOptions();

            expect(options.showRegionBounds).toBe(true);
        });

        it('should log registration message', () => {
            registerDebugCommands();

            const logs = getLogsByCategory('system');
            expect(logs.some(l => l.message.includes('Debug commands registered'))).toBe(true);
        });
    });

    // ========================================
    // Error State Handling Tests
    // ========================================

    describe('error state handling', () => {
        it('should handle invalid validation test case gracefully', () => {
            const testCase: ValidationTestCase = {
                name: 'Edge case test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: [],
                expectedWeapons: [],
                expectedTomes: [],
                expectedCharacter: undefined,
            };

            const results = createMockDetectionResults([], [], [], undefined);

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.passed).toBe(true);
            expect(validation.accuracy.overall).toBe(1);
        });

        it('should handle region accuracy with empty annotated regions', () => {
            const testCase: ValidationTestCase = {
                name: 'No annotated regions',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['Big Bonk'],
                expectedWeapons: [],
                expectedTomes: [],
                annotatedRegions: [],
            };

            const results = createMockDetectionResults(['Big Bonk'], [], [], undefined);
            results.regions = [];

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.regionAccuracy).toBe(1);
        });

        it('should calculate region accuracy with annotated regions', () => {
            const testCase: ValidationTestCase = {
                name: 'With annotated regions',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['Big Bonk'],
                expectedWeapons: [],
                expectedTomes: [],
                annotatedRegions: [
                    { type: 'items_hotbar', x: 100, y: 900, width: 500, height: 100, confidence: 1 },
                ],
            };

            const results = createMockDetectionResults(['Big Bonk'], [], [], undefined);
            results.regions = [
                { type: 'items_hotbar', x: 110, y: 910, width: 500, height: 100, confidence: 0.95 },
            ] as RegionOfInterest[];

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.regionAccuracy).toBe(1); // Match within 50px tolerance
        });

        it('should handle mismatched region positions', () => {
            const testCase: ValidationTestCase = {
                name: 'Mismatched regions',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: [],
                expectedWeapons: [],
                expectedTomes: [],
                annotatedRegions: [
                    { type: 'items_hotbar', x: 100, y: 900, width: 500, height: 100, confidence: 1 },
                ],
            };

            const results = createMockDetectionResults([], [], [], undefined);
            results.regions = [
                { type: 'items_hotbar', x: 500, y: 500, width: 500, height: 100, confidence: 0.95 },
            ] as RegionOfInterest[];

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.regionAccuracy).toBe(0);
        });

        it('should handle negative region coordinates gracefully in color analysis', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const region = { x: -10, y: -10, width: 50, height: 50 };

            const analysis = analyzeRegionColors(imageData, region);

            expect(analysis).toBeDefined();
            expect(analysis.dominantColors.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle very large region extending beyond image', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const region = { x: 50, y: 50, width: 1000, height: 1000 };

            const analysis = analyzeRegionColors(imageData, region);

            expect(analysis).toBeDefined();
            expect(analysis.brightness).toBeGreaterThan(0);
        });

        it('should handle log overflow gracefully', () => {
            // Add 600 logs to exceed the 500 limit
            for (let i = 0; i < 600; i++) {
                log('overflow', `Message ${i}`);
            }

            const logs = getLogs();
            expect(logs.length).toBe(500);

            // First messages should be removed (shifted out)
            const overflowLogs = logs.filter(l => l.category === 'overflow');
            expect(overflowLogs[0].message).toBe('Message 100');
        });

        it('should handle log with undefined data', () => {
            log('test', 'No data');

            const logs = getLogs();
            const testLog = logs.find(l => l.message === 'No data');

            expect(testLog).toBeDefined();
            expect(testLog!.data).toBeUndefined();
        });

        it('should handle recording detection with no items', () => {
            const results = createMockDetectionResults([], [], [], undefined);

            recordDetection(results as any);

            const stats = getStats();
            expect(stats.totalDetections).toBe(1);
            expect(stats.successfulMatches).toBe(0);
            expect(stats.averageConfidence).toBe(0); // No confidences to average
        });

        it('should handle character match validation correctly', () => {
            const testCase: ValidationTestCase = {
                name: 'Character match',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: [],
                expectedWeapons: [],
                expectedTomes: [],
                expectedCharacter: 'Megachad',
            };

            // Test with correct character
            const correctResults = createMockDetectionResults([], [], [], 'Megachad');
            const correctValidation = validateDetectionResults(correctResults as any, testCase);
            expect(correctValidation.matched.character).toBe('Megachad');
            expect(correctValidation.missed.character).toBeUndefined();

            // Test with wrong character
            const wrongResults = createMockDetectionResults([], [], [], 'WrongCharacter');
            const wrongValidation = validateDetectionResults(wrongResults as any, testCase);
            expect(wrongValidation.missed.character).toBe('Megachad');
        });

        it('should handle processing time in stats correctly over multiple detections', () => {
            const results1 = createMockDetectionResults(['A'], [], [], undefined);
            results1.processingTime = 100;

            const results2 = createMockDetectionResults(['B'], [], [], undefined);
            results2.processingTime = 200;

            const results3 = createMockDetectionResults(['C'], [], [], undefined);
            results3.processingTime = 300;

            recordDetection(results1 as any);
            recordDetection(results2 as any);
            recordDetection(results3 as any);

            const stats = getStats();
            expect(stats.averageProcessingTime).toBe(200); // (100 + 200 + 300) / 3
        });

        it('should handle processing time history overflow', () => {
            // Record more than 100 detections to test history trimming
            for (let i = 0; i < 120; i++) {
                const results = createMockDetectionResults(['Item'], [], [], undefined);
                results.processingTime = i * 10;
                recordDetection(results as any);
            }

            const stats = getStats();
            // Average should only consider last 100 entries
            expect(stats.averageProcessingTime).toBeGreaterThan(0);
        });
    });

    // ========================================
    // Console Output Tests (Debug Enabled)
    // ========================================

    describe('console output when debug enabled', () => {
        let consoleSpy: {
            groupCollapsed: ReturnType<typeof vi.spyOn>;
            groupEnd: ReturnType<typeof vi.spyOn>;
            log: ReturnType<typeof vi.spyOn>;
            table: ReturnType<typeof vi.spyOn>;
            trace: ReturnType<typeof vi.spyOn>;
        };

        beforeEach(() => {
            consoleSpy = {
                groupCollapsed: vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
                groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
                log: vi.spyOn(console, 'log').mockImplementation(() => {}),
                table: vi.spyOn(console, 'table').mockImplementation(() => {}),
                trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
            };
            setDebugEnabled(true);
        });

        afterEach(() => {
            setDebugEnabled(false);
            vi.restoreAllMocks();
        });

        it('should output to console when debug is enabled', () => {
            log('test', 'Debug message', { value: 42 });

            expect(consoleSpy.groupCollapsed).toHaveBeenCalled();
            expect(consoleSpy.trace).toHaveBeenCalled();
            expect(consoleSpy.groupEnd).toHaveBeenCalled();
        });

        it('should use console.table for object data', () => {
            log('test', 'Object data', { key: 'value', num: 123 });

            expect(consoleSpy.table).toHaveBeenCalled();
        });

        it('should use console.log for primitive data', () => {
            log('test', 'String data', 'just a string');

            expect(consoleSpy.log).toHaveBeenCalledWith('just a string');
        });

        it('should not use console.table for null data', () => {
            log('test', 'Null data', null);

            expect(consoleSpy.log).toHaveBeenCalledWith(null);
        });

        it('should format different log levels with different styles', () => {
            // Clear any previous calls by resetting the mock
            consoleSpy.groupCollapsed.mockClear();

            log('test', 'Debug', undefined, 'debug');
            log('test', 'Info', undefined, 'info');
            log('test', 'Warn', undefined, 'warn');
            log('test', 'Error', undefined, 'error');

            expect(consoleSpy.groupCollapsed).toHaveBeenCalledTimes(4);
        });
    });

    // ========================================
    // Edge Cases for Stats Calculation
    // ========================================

    describe('stats calculation edge cases', () => {
        it('should handle confidence history overflow', () => {
            // Record more than 100 detections
            for (let i = 0; i < 120; i++) {
                const results = createMockDetectionResults(['Item'], [], [], undefined);
                // Force specific confidence by manipulating the mock
                (results.items[0] as { confidence: number }).confidence = 0.9;
                recordDetection(results as any);
            }

            const stats = getStats();
            // Should have a valid average (only last 100 entries counted)
            expect(stats.averageConfidence).toBeGreaterThan(0);
            expect(stats.averageConfidence).toBeLessThanOrEqual(1);
        });

        it('should calculate correct cache hit ratio', () => {
            recordCacheAccess(true);
            recordCacheAccess(true);
            recordCacheAccess(true);
            recordCacheAccess(false);

            const stats = getStats();
            expect(stats.templateCacheHits).toBe(3);
            expect(stats.templateCacheMisses).toBe(1);

            const hitRatio = stats.templateCacheHits / (stats.templateCacheHits + stats.templateCacheMisses);
            expect(hitRatio).toBe(0.75);
        });
    });
});
