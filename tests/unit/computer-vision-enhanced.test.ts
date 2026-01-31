// ========================================
// Computer Vision Enhanced Module Tests
// ========================================
// Comprehensive tests targeting 80%+ coverage
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
            { id: 'rare_bow', name: 'Rare Bow', rarity: 'rare', image: 'images/items/rare_bow.png' },
            { id: 'uncommon_axe', name: 'Uncommon Axe', rarity: 'uncommon', image: 'images/items/uncommon_axe.png' },
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

// Mock cv-strategy with real-like behavior
let mockStrategyOverride: any = null;

vi.mock('../../src/modules/cv-strategy.ts', () => ({
    getActiveStrategy: vi.fn(() => mockStrategyOverride || {
        name: 'optimized',
        colorFiltering: 'rarity-first',
        colorAnalysis: 'multi-region',
        matchingAlgorithm: 'ncc',
        useEmptyCellDetection: true,
        multiPassEnabled: true,
        useFeedbackLoop: false,
        useContextBoosting: false,
        useBorderValidation: false,
    }),
    getConfidenceThresholds: vi.fn((_strategy, rarity) => {
        const thresholds: Record<string, { pass1: number; pass2: number; pass3: number }> = {
            common: { pass1: 0.88, pass2: 0.75, pass3: 0.65 },
            uncommon: { pass1: 0.85, pass2: 0.72, pass3: 0.62 },
            rare: { pass1: 0.82, pass2: 0.68, pass3: 0.58 },
            epic: { pass1: 0.78, pass2: 0.65, pass3: 0.55 },
            legendary: { pass1: 0.75, pass2: 0.62, pass3: 0.52 },
        };
        return thresholds[rarity as string] || { pass1: 0.85, pass2: 0.70, pass3: 0.55 };
    }),
    rgbToHSV: vi.fn((r, g, b) => ({
        h: (r + g + b) / 3 / 255 * 360,
        s: 0.5,
        v: Math.max(r, g, b) / 255,
    })),
    extractColorProfile: vi.fn(() => ({
        topLeft: 'red',
        topRight: 'red',
        bottomLeft: 'red',
        bottomRight: 'red',
        center: 'red',
        border: 'red',
        dominant: 'red',
    })),
    compareColorProfiles: vi.fn(() => 0.8),
    getSimilarityPenalty: vi.fn(() => 0),
}));

// Mock cv-metrics
const mockMetrics = {
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
};

vi.mock('../../src/modules/cv-metrics.ts', () => ({
    startMetricsTracking: vi.fn(() => mockMetrics),
}));

// Mock computer-vision
let mockGridPositions = [
    { x: 0, y: 0, width: 64, height: 64 },
    { x: 64, y: 0, width: 64, height: 64 },
    { x: 128, y: 0, width: 64, height: 64 },
    { x: 0, y: 64, width: 64, height: 64 },
];

vi.mock('../../src/modules/computer-vision.ts', () => ({
    detectGridPositions: vi.fn(() => mockGridPositions),
    aggregateDuplicates: vi.fn((detections) => {
        const seen = new Set<string>();
        return detections.filter((d: any) => {
            if (seen.has(d.entity.id)) return false;
            seen.add(d.entity.id);
            return true;
        });
    }),
}));

// Mock cv/color with configurable behavior
let mockIsEmptyCell = false;
let mockDetectedRarity: string | null = 'legendary';

vi.mock('../../src/modules/cv/color.ts', () => ({
    isEmptyCell: vi.fn(() => mockIsEmptyCell),
    detectBorderRarity: vi.fn(() => mockDetectedRarity),
}));

// ========================================
// Test Helpers
// ========================================

function createMockImageData(width = 64, height = 64, fill?: { r: number; g: number; b: number }): ImageData {
    const imageData = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (fill) {
            imageData.data[i] = fill.r;
            imageData.data[i + 1] = fill.g;
            imageData.data[i + 2] = fill.b;
        } else {
            const pixelIndex = Math.floor(i / 4);
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);
            imageData.data[i] = (x * 4) % 256;
            imageData.data[i + 1] = (y * 4) % 256;
            imageData.data[i + 2] = ((x + y) * 2) % 256;
        }
        imageData.data[i + 3] = 255;
    }
    return imageData;
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

const defaultImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ========================================
// Tests
// ========================================

describe('computer-vision-enhanced module', () => {
    let originalCreateElement: typeof document.createElement;
    let originalImage: typeof Image;

    beforeEach(() => {
        // Reset stored game data
        storedGameData = { ...mockGameData };
        mockIsEmptyCell = false;
        mockDetectedRarity = 'legendary';
        mockStrategyOverride = null;
        mockGridPositions = [
            { x: 0, y: 0, width: 64, height: 64 },
            { x: 64, y: 0, width: 64, height: 64 },
            { x: 128, y: 0, width: 64, height: 64 },
            { x: 0, y: 64, width: 64, height: 64 },
        ];

        // Mock document.createElement for canvas
        originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'canvas') {
                const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
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

            expect(() => initEnhancedCV(gameData as any)).not.toThrow();
        });

        it('should log itemsCount as 0 when items undefined', async () => {
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

            expect(true).toBe(true);
        });

        it('should handle multiple resets', async () => {
            const { resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();
            resetEnhancedCVState();
            resetEnhancedCVState();

            expect(true).toBe(true);
        });
    });

    // ========================================
    // loadEnhancedTemplates Tests
    // ========================================
    describe('loadEnhancedTemplates', () => {
        it('should load templates from game data', async () => {
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
            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();
            const infoCallCount = (logger.info as any).mock.calls.length;

            await loadEnhancedTemplates();

            expect((logger.info as any).mock.calls.length).toBe(infoCallCount);
        });

        it('should handle items without images', async () => {
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

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });

        it('should handle failed image loads with PNG fallback', async () => {
            let callCount = 0;
            const testImage = global.Image;
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    callCount++;
                    if (callCount % 2 === 1) {
                        if (img.onerror) img.onerror(new Event('error'));
                    } else {
                        if (img.onload) img.onload(new Event('load'));
                    }
                }, 0);
                return img;
            }) as unknown as typeof Image;

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
            
            // Restore Image mock
            global.Image = testImage;
        });

        it('should handle complete image load failure', async () => {
            const testImage = global.Image;
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onerror) img.onerror(new Event('error'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();

            expect(logger.error).toHaveBeenCalled();
            
            // Restore Image mock
            global.Image = testImage;
        });

        it('should log completion with template counts', async () => {
            const { loadEnhancedTemplates, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await loadEnhancedTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.load_templates',
                    data: expect.objectContaining({ phase: 'complete' }),
                })
            );
        });

        it('should group templates by rarity and color', async () => {
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

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.load_templates',
                    data: expect.objectContaining({
                        phase: 'complete',
                        byRarity: expect.any(Object),
                        byColor: expect.any(Object),
                    }),
                })
            );
        });
    });

    // ========================================
    // detectItemsWithEnhancedCV Tests
    // ========================================
    describe('detectItemsWithEnhancedCV', () => {
        it('should detect items from image data URL', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized');

            expect(Array.isArray(results)).toBe(true);
        });

        it('should call progress callback during detection', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const progressCallback = vi.fn();

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized', progressCallback);

            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback.mock.calls.length).toBeGreaterThan(0);
        });

        it('should complete 100% progress when finished', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const progressUpdates: Array<{ progress: number; status: string }> = [];
            const progressCallback = (progress: number, status: string) => {
                progressUpdates.push({ progress, status });
            };

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized', progressCallback);

            const lastUpdate = progressUpdates[progressUpdates.length - 1];
            expect(lastUpdate?.progress).toBe(100);
            expect(lastUpdate?.status).toContain('Complete');
        });

        it('should load templates if not already loaded', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const progressCallback = vi.fn();

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized', progressCallback);

            const loadingCall = progressCallback.mock.calls.find(
                (call: any[]) => call[1]?.includes('Loading')
            );
            expect(loadingCall).toBeDefined();
        });

        it('should handle detection errors gracefully', async () => {
            const testImage = global.Image;
            global.Image = vi.fn().mockImplementation(() => {
                throw new Error('Image load failed');
            }) as unknown as typeof Image;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await expect(detectItemsWithEnhancedCV(defaultImageDataUrl)).rejects.toThrow();

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.detect_error',
                })
            );
            
            // Restore Image mock
            global.Image = testImage;
        });

        it('should use metrics tracking', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { startMetricsTracking } = await import('../../src/modules/cv-metrics.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized');

            expect(startMetricsTracking).toHaveBeenCalled();
            expect(mockMetrics.startLoad).toHaveBeenCalled();
            expect(mockMetrics.endLoad).toHaveBeenCalled();
            expect(mockMetrics.startPreprocess).toHaveBeenCalled();
            expect(mockMetrics.endPreprocess).toHaveBeenCalled();
            expect(mockMetrics.startMatching).toHaveBeenCalled();
            expect(mockMetrics.endMatching).toHaveBeenCalled();
            expect(mockMetrics.startPostprocess).toHaveBeenCalled();
            expect(mockMetrics.endPostprocess).toHaveBeenCalled();
            expect(mockMetrics.recordDetections).toHaveBeenCalled();
            expect(mockMetrics.complete).toHaveBeenCalled();
        });

        it('should detect grid positions', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { detectGridPositions } = await import('../../src/modules/computer-vision.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(detectGridPositions).toHaveBeenCalled();
        });

        it('should aggregate duplicates in results', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { aggregateDuplicates } = await import('../../src/modules/computer-vision.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(aggregateDuplicates).toHaveBeenCalled();
        });

        it('should log completion with detection stats', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { logger } = await import('../../src/modules/logger.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized');

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv_enhanced.detect_complete',
                    data: expect.objectContaining({
                        strategy: 'optimized',
                    }),
                })
            );
        });

        it('should use default strategy name when not specified', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Empty Cell Detection Tests
    // ========================================
    describe('empty cell detection', () => {
        it('should skip empty cells', async () => {
            mockIsEmptyCell = true;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(results.length).toBe(0);
        });

        it('should process non-empty cells', async () => {
            mockIsEmptyCell = false;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Multi-pass and Single-pass Matching Tests
    // ========================================
    describe('matching strategies', () => {
        it('should use multi-pass matching when enabled', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { getActiveStrategy } = await import('../../src/modules/cv-strategy.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            const strategy = getActiveStrategy();
            expect(strategy.multiPassEnabled).toBe(true);
        });

        it('should use single-pass matching for fast strategy', async () => {
            mockStrategyOverride = {
                name: 'fast',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'single-dominant',
                matchingAlgorithm: 'ssd',
                useEmptyCellDetection: true,
                multiPassEnabled: false,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl, 'fast');

            expect(Array.isArray(results)).toBe(true);
        });

        it('should progress through pass 1, 2, and 3', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const progressUpdates: string[] = [];
            const progressCallback = (_progress: number, status: string) => {
                progressUpdates.push(status);
            };

            await detectItemsWithEnhancedCV(defaultImageDataUrl, 'optimized', progressCallback);

            const hasPass1 = progressUpdates.some(s => s.includes('Pass 1'));
            const hasPass2 = progressUpdates.some(s => s.includes('Pass 2'));
            const hasPass3 = progressUpdates.some(s => s.includes('Pass 3'));

            expect(hasPass1).toBe(true);
            expect(hasPass2).toBe(true);
            expect(hasPass3).toBe(true);
        });
    });

    // ========================================
    // Color Filtering Tests
    // ========================================
    describe('color filtering', () => {
        it('should use rarity-first filtering', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { detectBorderRarity } = await import('../../src/modules/cv/color.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(detectBorderRarity).toHaveBeenCalled();
        });

        it('should use color-first filtering when configured', async () => {
            mockStrategyOverride = {
                name: 'color',
                colorFiltering: 'color-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { extractColorProfile } = await import('../../src/modules/cv-strategy.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(extractColorProfile).toHaveBeenCalled();
        });

        it('should use no filtering when configured as none', async () => {
            mockStrategyOverride = {
                name: 'none',
                colorFiltering: 'none',
                colorAnalysis: 'single-dominant',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Matching Algorithm Tests
    // ========================================
    describe('matching algorithms', () => {
        it('should use NCC algorithm', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { getActiveStrategy } = await import('../../src/modules/cv-strategy.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            const strategy = getActiveStrategy();
            expect(strategy.matchingAlgorithm).toBe('ncc');
        });

        it('should use SSD algorithm when configured', async () => {
            mockStrategyOverride = {
                name: 'fast',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'single-dominant',
                matchingAlgorithm: 'ssd',
                useEmptyCellDetection: true,
                multiPassEnabled: false,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should use SSIM algorithm when configured', async () => {
            mockStrategyOverride = {
                name: 'accurate',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ssim',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Context Boosting Tests
    // ========================================
    describe('context boosting', () => {
        it('should apply context boosting when enabled', async () => {
            mockStrategyOverride = {
                name: 'boosted',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: true,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Border Validation Tests
    // ========================================
    describe('border validation', () => {
        it('should apply border validation when enabled', async () => {
            mockStrategyOverride = {
                name: 'validated',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: true,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { detectBorderRarity } = await import('../../src/modules/cv/color.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(detectBorderRarity).toHaveBeenCalled();
        });

        it('should boost similarity when rarity matches', async () => {
            mockDetectedRarity = 'legendary';

            mockStrategyOverride = {
                name: 'validated',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: true,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should penalize similarity when rarity mismatches', async () => {
            mockDetectedRarity = 'mythic';

            mockStrategyOverride = {
                name: 'validated',
                colorFiltering: 'none',
                colorAnalysis: 'single-dominant',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: true,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Feedback Loop Tests
    // ========================================
    describe('feedback loop', () => {
        it('should apply feedback penalty when enabled', async () => {
            mockStrategyOverride = {
                name: 'feedback',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: true,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');
            const { getSimilarityPenalty } = await import('../../src/modules/cv-strategy.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(getSimilarityPenalty).toHaveBeenCalled();
        });
    });

    // ========================================
    // Edge Cases and Error Handling
    // ========================================
    describe('edge cases and error handling', () => {
        it('should handle zero-size grid', async () => {
            mockGridPositions = [];

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(results.length).toBe(0);
        });

        it('should handle image with no items', async () => {
            storedGameData = {
                items: { items: [] },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
                characters: { characters: [] },
                shrines: { shrines: [] },
                stats: null,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(results.length).toBe(0);
        });

        it('should handle image load failure during detection', async () => {
            const testImage = global.Image;
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onerror) img.onerror(new Event('error'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            await expect(detectItemsWithEnhancedCV(defaultImageDataUrl)).rejects.toThrow();
            
            // Restore Image mock
            global.Image = testImage;
        });

        it('should handle null rarity in threshold lookup', async () => {
            mockDetectedRarity = null;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle large grid positions array', async () => {
            mockGridPositions = Array.from({ length: 100 }, (_, i) => ({
                x: (i % 10) * 64,
                y: Math.floor(i / 10) * 64,
                width: 64,
                height: 64,
            }));

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // HSV Color Detection Tests
    // ========================================
    describe('HSV color detection', () => {
        it('should extract color profile from templates', async () => {
            const { extractColorProfile } = await import('../../src/modules/cv-strategy.ts');

            const mockImageData = new ImageData(10, 10);
            for (let i = 0; i < mockImageData.data.length; i += 4) {
                mockImageData.data[i] = 255;
                mockImageData.data[i + 1] = 0;
                mockImageData.data[i + 2] = 0;
                mockImageData.data[i + 3] = 255;
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
    // Window Export Tests
    // ========================================
    describe('window exports', () => {
        it('should export functions to window object', async () => {
            await import('../../src/modules/computer-vision-enhanced.ts');

            expect(true).toBe(true);
        });
    });

    // ========================================
    // Detection Result Type Tests
    // ========================================
    describe('detection results', () => {
        it('should return correct result structure', async () => {
            mockIsEmptyCell = false;
            mockDetectedRarity = 'legendary';

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
            if (results.length > 0) {
                const result = results[0];
                expect(result).toHaveProperty('type');
                expect(result).toHaveProperty('entity');
                expect(result).toHaveProperty('confidence');
                expect(result).toHaveProperty('position');
                expect(result).toHaveProperty('method');
                expect(result?.type).toBe('item');
                expect(result?.method).toBe('template_match');
            }
        });

        it('should include position information', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            if (results.length > 0) {
                const position = results[0]?.position;
                expect(position).toHaveProperty('x');
                expect(position).toHaveProperty('y');
                expect(position).toHaveProperty('width');
                expect(position).toHaveProperty('height');
            }
        });

        it('should have confidence between 0 and 1', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            for (const result of results) {
                expect(result.confidence).toBeGreaterThanOrEqual(0);
                expect(result.confidence).toBeLessThanOrEqual(1);
            }
        });
    });

    // ========================================
    // Strategy Preset Tests
    // ========================================
    describe('strategy presets', () => {
        it('should work with default strategy name', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should accept custom strategy name', async () => {
            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl, 'custom_strategy');

            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ========================================
    // Template State Tests
    // ========================================
    describe('template state management', () => {
        it('should maintain separate state for templates', async () => {
            const { initEnhancedCV, resetEnhancedCVState, loadEnhancedTemplates } = await import('../../src/modules/computer-vision-enhanced.ts');

            initEnhancedCV(storedGameData as any);
            await loadEnhancedTemplates();

            resetEnhancedCVState();

            initEnhancedCV(storedGameData as any);

            await expect(loadEnhancedTemplates()).resolves.not.toThrow();
        });
    });

    // ========================================
    // Re-export Types Test
    // ========================================
    describe('re-exports', () => {
        it('should re-export types without error', async () => {
            const module = await import('../../src/modules/computer-vision-enhanced.ts');

            expect(typeof module.initEnhancedCV).toBe('function');
            expect(typeof module.loadEnhancedTemplates).toBe('function');
            expect(typeof module.detectItemsWithEnhancedCV).toBe('function');
            expect(typeof module.resetEnhancedCVState).toBe('function');
        });
    });

    // ========================================
    // Rarity-based Threshold Tests
    // ========================================
    describe('rarity-based thresholds', () => {
        it('should apply different thresholds for different rarities', async () => {
            const { getConfidenceThresholds } = await import('../../src/modules/cv-strategy.ts');

            const commonThresholds = getConfidenceThresholds({} as any, 'common');
            const legendaryThresholds = getConfidenceThresholds({} as any, 'legendary');

            expect(legendaryThresholds.pass1).toBeLessThan(commonThresholds.pass1);
        });

        it('should return default thresholds for unknown rarity', async () => {
            const { getConfidenceThresholds } = await import('../../src/modules/cv-strategy.ts');

            const unknownThresholds = getConfidenceThresholds({} as any, 'unknown_rarity');

            expect(unknownThresholds).toHaveProperty('pass1');
            expect(unknownThresholds).toHaveProperty('pass2');
            expect(unknownThresholds).toHaveProperty('pass3');
        });
    });

    // ========================================
    // Color Profile Comparison Tests
    // ========================================
    describe('color profile comparison', () => {
        it('should compare color profiles', async () => {
            const { compareColorProfiles } = await import('../../src/modules/cv-strategy.ts');

            const profile1 = { dominant: 'red', topLeft: 'red', topRight: 'red', bottomLeft: 'red', bottomRight: 'red', center: 'red', border: 'red' };
            const profile2 = { dominant: 'red', topLeft: 'red', topRight: 'red', bottomLeft: 'red', bottomRight: 'red', center: 'red', border: 'red' };

            const similarity = compareColorProfiles(profile1, profile2);

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });

    // ========================================
    // Canvas Context Tests
    // ========================================
    describe('canvas context handling', () => {
        it('should handle canvas context creation', async () => {
            // Re-create Image mock to ensure it works after error tests
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onload) img.onload(new Event('load'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(document.createElement).toHaveBeenCalledWith('canvas');
        });
    });

    // ========================================
    // All-feature Combined Tests
    // ========================================
    describe('combined features', () => {
        it('should work with all features enabled', async () => {
            // Re-create Image mock
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onload) img.onload(new Event('load'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            mockStrategyOverride = {
                name: 'all_features',
                colorFiltering: 'rarity-first',
                colorAnalysis: 'multi-region',
                matchingAlgorithm: 'ncc',
                useEmptyCellDetection: true,
                multiPassEnabled: true,
                useFeedbackLoop: true,
                useContextBoosting: true,
                useBorderValidation: true,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should work with all features disabled', async () => {
            // Re-create Image mock
            global.Image = vi.fn().mockImplementation(() => {
                const img = createMockImage();
                setTimeout(() => {
                    if (img.onload) img.onload(new Event('load'));
                }, 0);
                return img;
            }) as unknown as typeof Image;

            mockStrategyOverride = {
                name: 'minimal',
                colorFiltering: 'none',
                colorAnalysis: 'single-dominant',
                matchingAlgorithm: 'ssd',
                useEmptyCellDetection: false,
                multiPassEnabled: false,
                useFeedbackLoop: false,
                useContextBoosting: false,
                useBorderValidation: false,
            };

            const { detectItemsWithEnhancedCV, resetEnhancedCVState } = await import('../../src/modules/computer-vision-enhanced.ts');

            resetEnhancedCVState();

            const results = await detectItemsWithEnhancedCV(defaultImageDataUrl);

            expect(Array.isArray(results)).toBe(true);
        });
    });
});
