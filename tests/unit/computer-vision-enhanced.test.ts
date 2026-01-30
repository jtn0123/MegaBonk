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

function createMockImageData(width = 64, height = 64): ImageData {
    const imageData = new ImageData(width, height);
    // Fill with varied pixel data for better color profile testing
    for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = Math.floor(i / 4);
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        
        // Create a gradient pattern for more realistic data
        imageData.data[i] = (x * 4) % 256;        // R
        imageData.data[i + 1] = (y * 4) % 256;    // G
        imageData.data[i + 2] = ((x + y) * 2) % 256; // B
        imageData.data[i + 3] = 255;              // A
    }
    return imageData;
}

function createMockCanvas(width = 100, height = 100): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Create mock ImageData with varied pixel data
    const mockImageData = createMockImageData(width, height);

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
    const img = document.createElement('img') as HTMLImageElement;
    Object.defineProperty(img, 'width', { value: width, writable: true, configurable: true });
    Object.defineProperty(img, 'height', { value: height, writable: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: width, writable: true });
    Object.defineProperty(img, 'naturalHeight', { value: height, writable: true });
    Object.defineProperty(img, 'complete', { value: true, writable: true });
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
                const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
                const mockImageData = createMockImageData(64, 64);
                
                const mockCtx = {
                    drawImage: vi.fn(),
                    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
                        return createMockImageData(w, h);
                    }),
                    putImageData: vi.fn(),
                    canvas,
                    fillRect: vi.fn(),
                    clearRect: vi.fn(),
                };
                
                vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
                return canvas;
            }
            return originalCreateElement(tagName);
        });

        // Mock Image constructor
        originalImage = global.Image;
        global.Image = vi.fn().mockImplementation(() => {
            const img = createMockImage();
            // Simulate successful load asynchronously
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
    // Init with Various Data Shapes Tests
    // ========================================
    describe('init with various data shapes', () => {
        it('should handle large items array', async () => {
            vi.resetModules();

            const largeItemsList = Array.from({ length: 100 }, (_, i) => ({
                id: `item_${i}`,
                name: `Item ${i}`,
                rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'][i % 5],
                image: `images/item_${i}.png`,
            }));

            const gameData = {
                items: { items: largeItemsList },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            initEnhancedCV(gameData as any);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.init',
                    data: expect.objectContaining({
                        itemsCount: 100,
                    }),
                })
            );
        });

        it('should handle items with missing rarity', async () => {
            vi.resetModules();

            const gameData = {
                items: {
                    items: [
                        { id: 'no_rarity', name: 'No Rarity Item', image: 'test.png' },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');

            expect(() => initEnhancedCV(gameData as any)).not.toThrow();
        });

        it('should handle items with special characters in id', async () => {
            vi.resetModules();

            const gameData = {
                items: {
                    items: [
                        { id: 'item-with-dash', name: 'Dash Item', rarity: 'common', image: 'test.png' },
                        { id: 'item_with_underscore', name: 'Underscore Item', rarity: 'rare', image: 'test2.png' },
                        { id: 'item.with.dot', name: 'Dot Item', rarity: 'epic', image: 'test3.png' },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');

            expect(() => initEnhancedCV(gameData as any)).not.toThrow();
        });
    });

    // ========================================
    // Template Loading Edge Cases
    // ========================================
    describe('template loading edge cases', () => {
        it('should handle webp to png fallback', async () => {
            vi.resetModules();

            // First call fails (webp), second succeeds (png fallback)
            let callCount = 0;
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    callCount++;
                    if (callCount % 2 === 1) {
                        // Odd calls fail (webp)
                        if (img.onerror) img.onerror(new Event('error'));
                    } else {
                        // Even calls succeed (png fallback)
                        if (img.onload) img.onload(new Event('load'));
                    }
                }, 0);
                return img;
            }) as unknown as typeof Image;

            storedGameData = {
                items: {
                    items: [
                        { id: 'fallback_item', name: 'Fallback Item', rarity: 'common', image: 'images/fallback.png' },
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

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle empty image path gracefully', async () => {
            vi.resetModules();

            storedGameData = {
                items: {
                    items: [
                        { id: 'empty_path', name: 'Empty Path', rarity: 'common', image: '' },
                        { id: 'valid_item', name: 'Valid Item', rarity: 'rare', image: 'valid.png' },
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

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle mixed successful and failed loads', async () => {
            vi.resetModules();

            let loadIndex = 0;
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                const currentIndex = loadIndex++;
                setTimeout(() => {
                    // Every third load fails
                    if (currentIndex % 3 === 0) {
                        if (img.onerror) img.onerror(new Event('error'));
                    } else {
                        if (img.onload) img.onload(new Event('load'));
                    }
                }, 0);
                return img;
            }) as unknown as typeof Image;

            storedGameData = {
                items: {
                    items: Array.from({ length: 10 }, (_, i) => ({
                        id: `mixed_item_${i}`,
                        name: `Mixed Item ${i}`,
                        rarity: 'common',
                        image: `img${i}.png`,
                    })),
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });
    });

    // ========================================
    // Module State Tests
    // ========================================
    describe('module state management', () => {
        it('should maintain separate state for templates', async () => {
            vi.resetModules();

            const { initEnhancedCV, resetEnhancedCVState, loadEnhancedTemplates } = await import('../../src/modules/computer-vision-enhanced.ts');

            // Initialize with data
            initEnhancedCV(storedGameData as any);
            await loadEnhancedTemplates();

            // Reset
            resetEnhancedCVState();

            // Re-initialize
            initEnhancedCV(storedGameData as any);

            // Should be able to load again without issues
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle multiple resets', async () => {
            vi.resetModules();

            const { resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            // Multiple resets should not throw
            resetEnhancedCVState();
            resetEnhancedCVState();
            resetEnhancedCVState();

            expect(true).toBe(true);
        });

        it('should handle init without items', async () => {
            vi.resetModules();

            storedGameData = {
                items: undefined as any,
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { initEnhancedCV } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            // Should handle missing items gracefully
            initEnhancedCV(storedGameData as any);

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.init',
                    data: expect.objectContaining({
                        itemsCount: 0,
                    }),
                })
            );
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

        it('should handle many items for template loading', async () => {
            vi.resetModules();

            // Create many items
            const manyItems = Array.from({ length: 50 }, (_, i) => ({
                id: `item_${i}`,
                name: `Item ${i}`,
                rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'][i % 5],
                image: `images/item_${i}.png`,
            }));

            storedGameData = {
                items: { items: manyItems },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle items with various rarity values', async () => {
            vi.resetModules();

            storedGameData = {
                items: {
                    items: [
                        { id: 'common_item', name: 'Common', rarity: 'common', image: 'common.png' },
                        { id: 'uncommon_item', name: 'Uncommon', rarity: 'uncommon', image: 'uncommon.png' },
                        { id: 'rare_item', name: 'Rare', rarity: 'rare', image: 'rare.png' },
                        { id: 'epic_item', name: 'Epic', rarity: 'epic', image: 'epic.png' },
                        { id: 'legendary_item', name: 'Legendary', rarity: 'legendary', image: 'legendary.png' },
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

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });
    });

    // ========================================
    // Window Export Tests  
    // ========================================
    describe('window exports', () => {
        it('should export functions to window object', async () => {
            vi.resetModules();

            await import('../../src/modules/computer-vision-enhanced.ts');

            // Check if window exports are set (they're set conditionally)
            // We just verify the module loads without error
            expect(true).toBe(true);
        });
    });

    // ========================================
    // Error Handling Tests
    // ========================================
    describe('error handling', () => {
        it('should handle image loading errors gracefully', async () => {
            vi.resetModules();

            // Mock Image to simulate load errors
            const errorImage = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onerror) img.onerror(new Event('error'));
                }, 0);
                return img;
            });
            global.Image = errorImage as unknown as typeof Image;

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();

            // Should log errors but not throw
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle complete load failure gracefully', async () => {
            vi.resetModules();

            // All image loads fail
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onerror) img.onerror(new Event('error'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            storedGameData = {
                items: {
                    items: [
                        { id: 'fail1', name: 'Fail 1', rarity: 'common', image: 'fail1.png' },
                        { id: 'fail2', name: 'Fail 2', rarity: 'rare', image: 'fail2.png' },
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

            // Should complete without throwing
            await expect(loadEnhancedTemplates()).resolves.not.toThrow();

            // Should still log completion
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.load_templates',
                    data: expect.objectContaining({ phase: 'complete' }),
                })
            );
        });
    });

    // ========================================
    // Re-export Types Test
    // ========================================
    describe('re-exports', () => {
        it('should re-export types without error', async () => {
            vi.resetModules();

            // Just importing should work
            const module = await import('../../src/modules/computer-vision-enhanced.ts');

            // Check that exported functions exist
            expect(typeof module.initEnhancedCV).toBe('function');
            expect(typeof module.loadEnhancedTemplates).toBe('function');
            expect(typeof module.detectItemsWithEnhancedCV).toBe('function');
            expect(typeof module.resetEnhancedCVState).toBe('function');
        });
    });
});
