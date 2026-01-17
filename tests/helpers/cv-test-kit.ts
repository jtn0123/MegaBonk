/**
 * CV Test Kit - Shared utilities for Computer Vision tests
 * Consolidates image creation, mock detections, and assertion helpers
 *
 * Usage:
 *   import { cvTestKit } from '../helpers/cv-test-kit';
 *   const image = cvTestKit.image.solid(100, 100, 255, 0, 0);
 *   const detection = cvTestKit.detection.item('Wrench', 0.88);
 */

import { vi } from 'vitest';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types';

// ========================================
// Image Creation Utilities
// ========================================

export const imageUtils = {
    /**
     * Create ImageData with custom pixel fill function
     */
    create(
        width: number,
        height: number,
        fillFn: (x: number, y: number) => [number, number, number]
    ): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const [r, g, b] = fillFn(x, y);
                const idx = (y * width + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        return imageData;
    },

    /**
     * Create solid color ImageData
     */
    solid(width: number, height: number, r: number, g: number, b: number): ImageData {
        return this.create(width, height, () => [r, g, b]);
    },

    /**
     * Create horizontal gradient
     */
    gradient(
        width: number,
        height: number,
        from: [number, number, number],
        to: [number, number, number]
    ): ImageData {
        return this.create(width, height, (x) => {
            const t = x / (width - 1);
            return [
                Math.floor(from[0] + (to[0] - from[0]) * t),
                Math.floor(from[1] + (to[1] - from[1]) * t),
                Math.floor(from[2] + (to[2] - from[2]) * t),
            ];
        });
    },

    /**
     * Create checkerboard pattern
     */
    checkerboard(width: number, height: number, cellSize: number = 10): ImageData {
        return this.create(width, height, (x, y) => {
            const isWhite = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
            const val = isWhite ? 200 : 50;
            return [val, val, val];
        });
    },

    /**
     * Create bordered image (simulates item slot with rarity border)
     */
    bordered(
        width: number,
        height: number,
        borderColor: [number, number, number],
        innerColor: [number, number, number],
        borderWidth: number = 3
    ): ImageData {
        return this.create(width, height, (x, y) => {
            const isBorder =
                x < borderWidth || x >= width - borderWidth ||
                y < borderWidth || y >= height - borderWidth;
            return isBorder ? borderColor : innerColor;
        });
    },

    /**
     * Add noise to existing ImageData (returns new ImageData)
     */
    addNoise(imageData: ImageData, strength: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d')!;
        const noisy = ctx.createImageData(imageData.width, imageData.height);

        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = (Math.random() - 0.5) * strength;
            noisy.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
            noisy.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
            noisy.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
            noisy.data[i + 3] = 255;
        }

        return noisy;
    },

    /**
     * Create mock canvas context with pre-filled pattern
     */
    mockContext(width: number, height: number): CanvasRenderingContext2D {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas.getContext('2d')!;
    },
};

// ========================================
// Detection Mock Utilities
// ========================================

export const detectionUtils = {
    /**
     * Create mock item detection result
     */
    item(name: string, confidence: number, position?: Partial<ROI>): CVDetectionResult {
        const id = name.toLowerCase().replace(/\s+/g, '_');
        return {
            type: 'item',
            entity: {
                id,
                name,
                rarity: 'common',
                tier: 'A',
                image: `images/items/${id}.png`,
                base_effect: 'Test effect',
            },
            confidence,
            position: {
                x: position?.x ?? 100,
                y: position?.y ?? 600,
                width: position?.width ?? 45,
                height: position?.height ?? 45,
            },
            method: 'template_match',
        };
    },

    /**
     * Create mock weapon detection
     */
    weapon(name: string, confidence: number, position?: Partial<ROI>): CVDetectionResult {
        const id = name.toLowerCase().replace(/\s+/g, '_');
        return {
            type: 'weapon',
            entity: {
                id,
                name,
                tier: 'A',
                image: `images/weapons/${id}.png`,
            },
            confidence,
            position: {
                x: position?.x ?? 50,
                y: position?.y ?? 25,
                width: position?.width ?? 50,
                height: position?.height ?? 50,
            },
            method: 'template_match',
        };
    },

    /**
     * Create mock character detection
     */
    character(name: string, confidence: number): CVDetectionResult {
        const id = name.toLowerCase().replace(/\s+/g, '_');
        return {
            type: 'character',
            entity: { id, name, tier: 'S', image: `images/characters/${id}.png` },
            confidence,
            position: { x: 915, y: 25, width: 90, height: 90 },
            method: 'template_match',
        };
    },

    /**
     * Create batch of item detections
     */
    items(names: string[], baseConfidence: number = 0.85): CVDetectionResult[] {
        return names.map((name, i) =>
            this.item(name, baseConfidence + Math.random() * 0.1, { x: 100 + i * 50 })
        );
    },
};

// ========================================
// ROI / Bounding Box Utilities
// ========================================

export const roiUtils = {
    /**
     * Create ROI (Region of Interest)
     */
    create(x: number, y: number, width: number, height: number): ROI {
        return { x, y, width, height };
    },

    /**
     * Create slot ROI at hotbar position
     */
    slot(index: number, slotSize: number = 45, baseY: number = 600): ROI {
        return {
            x: 100 + index * (slotSize + 5),
            y: baseY,
            width: slotSize,
            height: slotSize,
        };
    },

    /**
     * Create overlapping boxes for NMS testing
     */
    overlapping(count: number, overlapPercent: number = 0.5): ROI[] {
        const size = 50;
        const offset = size * (1 - overlapPercent);
        return Array.from({ length: count }, (_, i) => ({
            x: i * offset,
            y: 0,
            width: size,
            height: size,
        }));
    },
};

// ========================================
// Assertion Helpers
// ========================================

export const assertions = {
    /**
     * Assert detection accuracy against expected items
     */
    assertAccuracy(
        detected: CVDetectionResult[],
        expected: string[],
        minAccuracy: number = 0.7
    ): { accuracy: number; precision: number; recall: number; f1: number } {
        const detectedNames = detected.map(d => d.entity.name.toLowerCase());
        const expectedNames = expected.map(e => e.toLowerCase());

        const truePositives = detectedNames.filter(d => expectedNames.includes(d)).length;
        const falsePositives = detectedNames.filter(d => !expectedNames.includes(d)).length;
        const falseNegatives = expectedNames.filter(e => !detectedNames.includes(e)).length;

        const precision = truePositives / (truePositives + falsePositives) || 0;
        const recall = truePositives / (truePositives + falseNegatives) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;
        const accuracy = truePositives / Math.max(expectedNames.length, detectedNames.length);

        if (accuracy < minAccuracy) {
            throw new Error(
                `Accuracy ${(accuracy * 100).toFixed(1)}% below threshold ${(minAccuracy * 100).toFixed(1)}%\n` +
                `Expected: ${expectedNames.join(', ')}\n` +
                `Detected: ${detectedNames.join(', ')}`
            );
        }

        return { accuracy, precision, recall, f1 };
    },

    /**
     * Assert IoU within tolerance
     */
    assertIoU(actual: number, expected: number, tolerance: number = 0.01): void {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(`IoU ${actual.toFixed(4)} not within ${tolerance} of expected ${expected.toFixed(4)}`);
        }
    },

    /**
     * Assert color is within RGB tolerance
     */
    assertColorClose(
        actual: { r: number; g: number; b: number },
        expected: { r: number; g: number; b: number },
        tolerance: number = 10
    ): void {
        const diff = Math.abs(actual.r - expected.r) +
                     Math.abs(actual.g - expected.g) +
                     Math.abs(actual.b - expected.b);
        if (diff > tolerance * 3) {
            throw new Error(
                `Color rgb(${actual.r},${actual.g},${actual.b}) not close to ` +
                `rgb(${expected.r},${expected.g},${expected.b})`
            );
        }
    },
};

// ========================================
// Mock Module Factories
// ========================================

export const mocks = {
    /**
     * Create CV module mock
     */
    cvModule: () => ({
        detectItemsWithCV: vi.fn().mockResolvedValue([]),
        initCV: vi.fn().mockResolvedValue(undefined),
        loadItemTemplates: vi.fn().mockResolvedValue(undefined),
        combineDetections: vi.fn((a: any) => a),
        aggregateDuplicates: vi.fn((a: any) => a.map((x: any) => ({ ...x, count: 1 }))),
        createDebugOverlay: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
    }),

    /**
     * Create OCR module mock
     */
    ocrModule: () => ({
        autoDetectFromImage: vi.fn().mockResolvedValue({ items: [], confidence: 0 }),
        initOCR: vi.fn().mockResolvedValue(undefined),
        extractText: vi.fn().mockResolvedValue(''),
    }),

    /**
     * Create canvas mock with getImageData
     */
    canvas: (width: number = 1920, height: number = 1080) => {
        const imageData = new Uint8ClampedArray(width * height * 4);
        const context = {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({ data: imageData, width, height })),
            putImageData: vi.fn(),
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            scale: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
        };

        return {
            width,
            height,
            getContext: vi.fn(() => context),
            toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
            context,
        };
    },
};

// ========================================
// Test Data: Colors for parameterized tests
// ========================================

export const COLOR_TEST_DATA = {
    // Grayscale
    grayscale: [
        { rgb: [20, 20, 20] as [number, number, number], expected: 'black' },
        { rgb: [220, 220, 220] as [number, number, number], expected: 'white' },
        { rgb: [128, 128, 128] as [number, number, number], expected: 'gray' },
    ],
    // Primary colors
    primary: [
        { rgb: [200, 50, 50] as [number, number, number], expected: 'red' },
        { rgb: [50, 200, 50] as [number, number, number], expected: 'green' },
        { rgb: [50, 50, 200] as [number, number, number], expected: 'blue' },
    ],
    // Secondary colors
    secondary: [
        { rgb: [200, 120, 50] as [number, number, number], expected: 'orange' },
        { rgb: [200, 200, 50] as [number, number, number], expected: 'yellow' },
        { rgb: [150, 50, 200] as [number, number, number], expected: 'purple' },
        { rgb: [50, 150, 200] as [number, number, number], expected: 'cyan' },
    ],
    // Rarity border colors
    rarity: [
        { rgb: [128, 128, 128] as [number, number, number], expected: 'common', rarity: 'common' },
        { rgb: [30, 200, 30] as [number, number, number], expected: 'green', rarity: 'uncommon' },
        { rgb: [30, 100, 220] as [number, number, number], expected: 'blue', rarity: 'rare' },
        { rgb: [160, 50, 200] as [number, number, number], expected: 'purple', rarity: 'epic' },
        { rgb: [220, 180, 50] as [number, number, number], expected: 'yellow', rarity: 'legendary' },
    ],
};

// ========================================
// Test Data: Resolutions for parameterized tests
// ========================================

export const RESOLUTION_TEST_DATA = [
    { name: '720p', width: 1280, height: 720, preset: '720p', iconSize: { min: 35, max: 42 } },
    { name: '1080p', width: 1920, height: 1080, preset: '1080p', iconSize: { min: 42, max: 50 } },
    { name: '1440p', width: 2560, height: 1440, preset: '1440p', iconSize: { min: 52, max: 60 } },
    { name: '4K', width: 3840, height: 2160, preset: '4k', iconSize: { min: 65, max: 75 } },
    { name: 'Steam Deck', width: 1280, height: 800, preset: 'steam_deck', iconSize: { min: 38, max: 45 } },
];

// ========================================
// Test Data: IoU test cases
// ========================================

export const IOU_TEST_DATA = [
    { name: 'identical boxes', box1: { x: 0, y: 0, width: 100, height: 100 }, box2: { x: 0, y: 0, width: 100, height: 100 }, expected: 1.0 },
    { name: 'no overlap', box1: { x: 0, y: 0, width: 50, height: 50 }, box2: { x: 100, y: 100, width: 50, height: 50 }, expected: 0 },
    { name: '50% horizontal overlap', box1: { x: 0, y: 0, width: 100, height: 100 }, box2: { x: 50, y: 0, width: 100, height: 100 }, expected: 0.333 },
    { name: 'contained box', box1: { x: 0, y: 0, width: 100, height: 100 }, box2: { x: 25, y: 25, width: 50, height: 50 }, expected: 0.25 },
    { name: 'corner overlap', box1: { x: 0, y: 0, width: 100, height: 100 }, box2: { x: 90, y: 90, width: 100, height: 100 }, expected: 0.005 },
];

// ========================================
// Unified Export
// ========================================

export const cvTestKit = {
    image: imageUtils,
    detection: detectionUtils,
    roi: roiUtils,
    assert: assertions,
    mocks,
    data: {
        colors: COLOR_TEST_DATA,
        resolutions: RESOLUTION_TEST_DATA,
        iou: IOU_TEST_DATA,
    },
};

export default cvTestKit;
