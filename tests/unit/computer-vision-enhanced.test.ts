// ========================================
// Computer Vision Enhanced Module Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ========================================
// ImageData Polyfill for JSDOM
// ========================================
if (typeof ImageData === 'undefined') {
    // @ts-expect-error - Polyfill for JSDOM environment
    global.ImageData = class ImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        colorSpace: PredefinedColorSpace;

        constructor(width: number, height: number);
        constructor(data: Uint8ClampedArray, width: number, height?: number);
        constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
            if (typeof dataOrWidth === 'number') {
                this.width = dataOrWidth;
                this.height = widthOrHeight;
                this.data = new Uint8ClampedArray(this.width * this.height * 4);
            } else {
                this.data = dataOrWidth;
                this.width = widthOrHeight;
                this.height = height ?? Math.floor(this.data.length / 4 / this.width);
            }
            this.colorSpace = 'srgb';
        }
    };
}

// ========================================
// Mocks
// ========================================

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock cv/state
const mockGameData = {
    items: {
        items: [
            { id: 'fire_sword', name: 'Fire Sword', rarity: 'legendary', image: 'images/items/fire_sword.png' },
            { id: 'ice_shield', name: 'Ice Shield', rarity: 'epic', image: 'images/items/ice_shield.png' },
            { id: 'basic_wand', name: 'Basic Wand', rarity: 'common', image: 'images/items/basic_wand.png' },
        ],
    },
    weapons: { weapons: [] },
    tomes: { tomes: [] },
    characters: { characters: [] },
    shrines: { shrines: [] },
    stats: null,
};

let storedGameData = { ...mockGameData };

vi.mock('../../src/modules/cv/state.ts', () => ({
    getAllData: vi.fn(() => storedGameData),
    setAllData: vi.fn((data) => {
        storedGameData = data;
    }),
}));

// Mock cv-strategy
vi.mock('../../src/modules/cv-strategy.ts', () => ({
    getActiveStrategy: vi.fn(() => ({
        name: 'optimized',
        colorFiltering: 'rarity-first',
        colorAnalysis: 'multi-region',
        matchingAlgorithm: 'ncc',
        useEmptyCellDetection: true,
        multiPassEnabled: true,
        useFeedbackLoop: false,
        useContextBoosting: false,
        useBorderValidation: false,
    })),
    getConfidenceThresholds: vi.fn(() => ({
        pass1: 0.85,
        pass2: 0.70,
        pass3: 0.55,
    })),
    rgbToHSV: vi.fn((r, g, b) => ({
        h: (r + g + b) / 3 / 255 * 360,
        s: 0.5,
        v: Math.max(r, g, b) / 255,
    })),
    extractColorProfile: vi.fn(() => ({
        dominant: 'red',
        histogram: { red: 0.5, green: 0.3, blue: 0.2 },
        average: { r: 200, g: 100, b: 50 },
    })),
    compareColorProfiles: vi.fn(() => 0.8),
    getSimilarityPenalty: vi.fn(() => 0),
}));

// Mock cv-metrics
vi.mock('../../src/modules/cv-metrics.ts', () => ({
    startMetricsTracking: vi.fn(() => ({
        startLoad: vi.fn(),
        endLoad: vi.fn(),
        startPreprocess: vi.fn(),
        endPreprocess: vi.fn(),
        startMatching: vi.fn(),
        endMatching: vi.fn(),
        startPostprocess: vi.fn(),
        endPostprocess: vi.fn(),
        recordDetections: vi.fn(),
        recordCellStats: vi.fn(),
        complete: vi.fn(() => ({
            totalTime: 100,
            averageConfidence: 0.85,
        })),
    })),
}));

// Mock computer-vision
vi.mock('../../src/modules/computer-vision.ts', () => ({
    detectGridPositions: vi.fn(() => [
        { x: 0, y: 0, width: 64, height: 64 },
        { x: 64, y: 0, width: 64, height: 64 },
        { x: 128, y: 0, width: 64, height: 64 },
    ]),
    aggregateDuplicates: vi.fn((detections) => detections),
}));

// Mock cv/color
vi.mock('../../src/modules/cv/color.ts', () => ({
    isEmptyCell: vi.fn(() => false),
    detectBorderRarity: vi.fn(() => 'legendary'),
}));

// ========================================
// Test Helpers
// ========================================

function createMockCanvas(width = 100, height = 100): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Create mock ImageData
    const mockImageData = new ImageData(width, height);
    // Fill with some pixel data
    for (let i = 0; i < mockImageData.data.length; i += 4) {
        mockImageData.data[i] = 200;     // R
        mockImageData.data[i + 1] = 100; // G
        mockImageData.data[i + 2] = 50;  // B
        mockImageData.data[i + 3] = 255; // A
    }

    const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => mockImageData),
        putImageData: vi.fn(),
        canvas,
    };

    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

    return canvas;
}

function createMockImage(width = 64, height = 64): HTMLImageElement {
    const img = new Image();
    Object.defineProperty(img, 'width', { value: width, writable: true });
    Object.defineProperty(img, 'height', { value: height, writable: true });
    return img;
}

// ========================================
// Tests
// ========================================

describe('computer-vision-enhanced module', () => {
    let originalCreateElement: typeof document.createElement;
    let originalImage: typeof Image;

    beforeEach(() => {
        // Reset stored game data
        storedGameData = { ...mockGameData };

        // Mock document.createElement for canvas
        originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'canvas') {
                return createMockCanvas();
            }
            return originalCreateElement(tagName);
        });

        // Mock Image constructor
        originalImage = global.Image;
        global.Image = vi.fn().mockImplementation(() => {
            const img = createMockImage();
            // Simulate successful load
            setTimeout(() => {
                if (img.onload) img.onload(new Event('load'));
            }, 0);
            return img;
        }) as unknown as typeof Image;
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        global.Image = originalImage;
    });

    // ========================================
    // initEnhancedCV Tests
    // ========================================
    describe('initEnhancedCV', () => {
        it('should initialize with game data', async () => {
            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { setAllData } = await import('../../src/modules/cv/state.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            const gameData = {
                items: { items: [{ id: 'test', name: 'Test', rarity: 'common', image: 'test.png' }] },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            initEnhancedCV(gameData as any);

            expect(setAllData).toHaveBeenCalledWith(gameData);
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.init',
                })
            );
        });

        it('should handle empty items array', async () => {
            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');

            const gameData = {
                items: { items: [] },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            // Should not throw
            expect(() => initEnhancedCV(gameData as any)).not.toThrow();
        });

        it('should handle null items', async () => {
            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');

            const gameData = {
                items: null,
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            // Should not throw
            expect(() => initEnhancedCV(gameData as any)).not.toThrow();
        });
    });

    // ========================================
    // resetEnhancedCVState Tests
    // ========================================
    describe('resetEnhancedCVState', () => {
        it('should clear all state', async () => {
            const { resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.reset',
                })
            );
        });

        it('should allow re-initialization after reset', async () => {
            const { initEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            const gameData = {
                items: { items: [{ id: 'test', name: 'Test', rarity: 'common', image: 'test.png' }] },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            initEnhancedCV(gameData as any);
            resetEnhancedCVState();
            initEnhancedCV(gameData as any);

            // Should not throw
            expect(true).toBe(true);
        });
    });

    // ========================================
    // loadEnhancedTemplates Tests
    // ========================================
    describe('loadEnhancedTemplates', () => {
        it('should load templates from game data', async () => {
            // Reset module state first
            vi.resetModules();

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.load_templates',
                    data: expect.objectContaining({ phase: 'start' }),
                })
            );
        });

        it('should not reload if already loaded', async () => {
            vi.resetModules();

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            // First load
            await loadEnhancedTemplates();
            const infoCallCount = (logger.info as any).mock.calls.length;

            // Second load should not trigger additional logging
            await loadEnhancedTemplates();

            // Should have same number of info calls (not reloaded)
            expect((logger.info as any).mock.calls.length).toBe(infoCallCount);
        });

        it('should handle items without images', async () => {
            vi.resetModules();

            storedGameData = {
                items: {
                    items: [
                        { id: 'no_image', name: 'No Image Item', rarity: 'common', image: '' },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            // Should not throw
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle failed image loads', async () => {
            vi.resetModules();

            // Mock Image to fail
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onerror) img.onerror(new Event('error'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            // Should not throw, just log errors
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });
    });

    // ========================================
    // HSV Color Detection Tests
    // ========================================
    describe('HSV color detection', () => {
        it('should extract color profile from templates', async () => {
            const { extractColorProfile } = await import('../../src/modules/cv-strategy.ts');

            const mockImageData = new ImageData(10, 10);
            // Fill with red pixels
            for (let i = 0; i < mockImageData.data.length; i += 4) {
                mockImageData.data[i] = 255;     // R
                mockImageData.data[i + 1] = 0;   // G
                mockImageData.data[i + 2] = 0;   // B
                mockImageData.data[i + 3] = 255; // A
            }

            const profile = extractColorProfile(mockImageData);

            expect(profile).toEqual(expect.objectContaining({
                dominant: expect.any(String),
            }));
        });

        it('should convert RGB to HSV correctly', async () => {
            const { rgbToHSV } = await import('../../src/modules/cv-strategy.ts');

            const hsv = rgbToHSV(255, 0, 0);

            expect(hsv).toEqual(expect.objectContaining({
                h: expect.any(Number),
                s: expect.any(Number),
                v: expect.any(Number),
            }));
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty game data', async () => {
            vi.resetModules();

            storedGameData = {
                items: { items: [] },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            // Should not throw
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle undefined items array', async () => {
            vi.resetModules();

            storedGameData = {
                items: undefined as any,
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            // Should not throw
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle item with null image path', async () => {
            vi.resetModules();

            storedGameData = {
                items: {
                    items: [
                        { id: 'null_image', name: 'Null Image', rarity: 'common', image: null },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            // Should not throw
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should group templates by rarity', async () => {
            vi.resetModules();

            storedGameData = {
                items: {
                    items: [
                        { id: 'legendary1', name: 'Legendary 1', rarity: 'legendary', image: 'img1.png' },
                        { id: 'legendary2', name: 'Legendary 2', rarity: 'legendary', image: 'img2.png' },
                        { id: 'common1', name: 'Common 1', rarity: 'common', image: 'img3.png' },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();

            // Should have logged with rarity grouping info
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.load_templates',
                    data: expect.objectContaining({ phase: 'complete' }),
                })
            );
        });
    });
});
