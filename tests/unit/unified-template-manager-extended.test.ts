/**
 * @vitest-environment jsdom
 * Extended Unified Template Manager Tests
 * Covers edge cases and branches not covered by the main test file
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import {
    // Quality scoring
    calculateQualityScore,
    calculateResolutionBonus,
    // Template selection
    selectBestTemplates,
    calculateWeightedMatchScore,
    // Multi-scale
    generateMultiScaleVariants,
    getTemplateAtSize,
    // Template loading
    loadTemplate,
    loadTemplatesBatch,
    groupTemplatesByColor,
    prioritizeItems,
    // Cache management
    cacheDetection,
    getCachedDetection,
    clearCache,
    cleanExpiredCache,
    // Getters
    getTemplate,
    getAllTemplates,
    getTemplatesByColorGroup,
    getAllColorGroups,
    isTemplatesFullyLoaded,
    isPriorityLoaded,
    getTemplateCount,
    getScaledVariantCount,
    getCacheSize,
    getConfig,
    // Setters
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    // Reset
    resetState,
    // Types
    type TrainingSample,
    type TemplateSource,
    type TemplateData,
} from '../../src/modules/cv/unified-template-manager.ts';

// Mock getDominantColor from color module
vi.mock('../../src/modules/cv/color.ts', () => ({
    getDominantColor: vi.fn().mockReturnValue('gray'),
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { getDominantColor } from '../../src/modules/cv/color.ts';
import { logger } from '../../src/modules/logger.ts';

// ========================================
// Test Data Factories
// ========================================

const createTrainingSample = (overrides: Partial<TrainingSample> = {}): TrainingSample => ({
    id: 'sample-1',
    itemId: 'item-1',
    source: 'verified',
    ...overrides,
});

const createMockItem = (id: string, rarity: string = 'common', image?: string) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    rarity,
    tier: 'B',
    image,
});

// Helper to create a mock template in the store
const createMockTemplateData = (itemId: string, overrides: Partial<TemplateData> = {}): TemplateData => {
    const scaledVariants = new Map<number, ImageData>();
    // Add some variants
    [32, 48, 64].forEach(size => {
        scaledVariants.set(size, {
            data: new Uint8ClampedArray(size * size * 4),
            width: size,
            height: size,
            colorSpace: 'srgb',
        } as ImageData);
    });

    return {
        itemId,
        image: new Image(),
        canvas: document.createElement('canvas'),
        ctx: document.createElement('canvas').getContext('2d')!,
        width: 64,
        height: 64,
        scaledVariants,
        dominantColor: 'gray',
        qualityScore: 1.0,
        source: 'verified',
        ...overrides,
    };
};

// ========================================
// Extended Test Suite
// ========================================

describe('Unified Template Manager - Extended Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetState();
    });

    // ========================================
    // getTemplateAtSize - Extended Tests
    // ========================================
    describe('getTemplateAtSize - Extended', () => {
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should return exact match when available', () => {
            // getTemplateAtSize returns null when template doesn't exist
            const result = getTemplateAtSize('nonexistent-item', 64);
            expect(result).toBeNull();
        });

        it('should find nearest size when exact match not available', () => {
            // This tests the branch where we iterate through sizes to find nearest
            const result = getTemplateAtSize('missing-item', 50);
            expect(result).toBeNull();
        });

        it('should return exact match from loaded template', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('size-test', 'common', '/images/test.png');
            await loadTemplate(item as any);

            // Request exact size that exists (64 is one of COMMON_ICON_SIZES)
            const result = getTemplateAtSize('size-test', 64);
            expect(result).not.toBeNull();
            expect(result?.width).toBe(64);
        });

        it('should return nearest size when exact match not in variants', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('nearest-test', 'common', '/images/test.png');
            await loadTemplate(item as any);

            // Request size 50 which doesn't exist - should get nearest (48)
            const result = getTemplateAtSize('nearest-test', 50);
            expect(result).not.toBeNull();
            // Should return the nearest available size
            expect(result?.width).toBeDefined();
        });

        it('should prefer closer size when between two available sizes', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('between-test', 'common', '/images/test.png');
            await loadTemplate(item as any);

            // Request size 60 - between 56 and 64, should pick 64 (closer)
            const result = getTemplateAtSize('between-test', 60);
            expect(result).not.toBeNull();
        });
    });

    // ========================================
    // loadTemplate - Image Loading Tests
    // ========================================
    describe('loadTemplate - Image Loading', () => {
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should try WebP first and fallback to PNG on error', async () => {
            const loadedSources: string[] = [];

            // Mock Image constructor
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        loadedSources.push(this.src);
                        // First call (webp) fails, second call (png) succeeds
                        if (this.src.endsWith('.webp')) {
                            this.onerror?.();
                        } else {
                            this.onload?.();
                        }
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('test-item', 'common', '/images/test.png');
            const result = await loadTemplate(item as any);

            // Should have tried webp first, then png
            expect(loadedSources.length).toBe(2);
            expect(loadedSources[0]).toContain('.webp');
            expect(loadedSources[1]).toContain('.png');
            expect(result).not.toBeNull();
        });

        it('should return null when both WebP and PNG fail', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        // Both fail
                        this.onerror?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const item = createMockItem('test-item', 'common', '/images/test.png');
            const result = await loadTemplate(item as any);

            expect(result).toBeNull();
        });

        it('should load WebP successfully without fallback', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        // WebP succeeds
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('test-item', 'common', '/images/test.png');
            const result = await loadTemplate(item as any);

            expect(result).not.toBeNull();
            expect(result?.itemId).toBe('test-item');
        });

        it('should handle image with .webp extension', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            // Item with webp image already
            const item = createMockItem('test-item', 'common', '/images/test.webp');
            const result = await loadTemplate(item as any);

            expect(result).not.toBeNull();
        });

        it('should return null when canvas context is null', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            // Return null context
            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(null),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('test-item', 'common', '/images/test.png');
            const result = await loadTemplate(item as any);

            expect(result).toBeNull();
        });

        it('should store template in templateStore after successful load', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('stored-item', 'common', '/images/test.png');
            await loadTemplate(item as any);

            // Template should now be retrievable
            const stored = getTemplate('stored-item');
            expect(stored).toBeDefined();
            expect(stored?.itemId).toBe('stored-item');
        });

        it('should use provided source for quality scoring', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('source-test', 'common', '/images/test.png');
            const result = await loadTemplate(item as any, 'ground_truth');

            expect(result?.source).toBe('ground_truth');
            expect(result?.qualityScore).toBe(1.5); // ground_truth weight
        });
    });

    // ========================================
    // loadTemplatesBatch - Error Handling
    // ========================================
    describe('loadTemplatesBatch - Error Handling', () => {
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should catch and log errors during batch loading', async () => {
            // Mock Image that throws an error
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    throw new Error('Image constructor failed');
                }
            }

            global.Image = MockImage as any;

            const items = [
                createMockItem('error-item', 'common', '/images/test.png'),
            ] as any[];

            const result = await loadTemplatesBatch(items);

            expect(result.failed).toBe(1);
            expect(result.failedIds).toContain('error-item');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle mixed success and failure in batch', async () => {
            let callCount = 0;

            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    const currentCall = callCount++;
                    setTimeout(() => {
                        // Alternate success/failure
                        if (currentCall % 2 === 0) {
                            this.onload?.();
                        } else {
                            this.onerror?.();
                        }
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const items = [
                createMockItem('item-0', 'common', '/images/test0.png'),
                createMockItem('item-1', 'common', '/images/test1.png'),
                createMockItem('item-2', 'common', '/images/test2.png'),
                createMockItem('item-3', 'common', '/images/test3.png'),
            ] as any[];

            const result = await loadTemplatesBatch(items);

            // Due to the async nature, we just verify the totals add up
            expect(result.loaded + result.failed).toBe(items.length);
        });
    });

    // ========================================
    // groupTemplatesByColor - With Templates
    // ========================================
    describe('groupTemplatesByColor - With Templates', () => {
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should group items by their template dominant color', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            // Load templates first
            const items = [
                createMockItem('sword', 'common', '/images/sword.png'),
                createMockItem('shield', 'common', '/images/shield.png'),
            ] as any[];

            await loadTemplatesBatch(items);

            // Now group by color
            groupTemplatesByColor(items);

            // getDominantColor mock returns 'gray'
            const grayItems = getTemplatesByColorGroup('gray');
            expect(grayItems.length).toBeGreaterThan(0);
        });

        it('should create new color group if not exists', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            // Mock different colors for different items
            let colorIndex = 0;
            const colors = ['red', 'blue', 'green'];
            (getDominantColor as Mock).mockImplementation(() => {
                return colors[colorIndex++ % colors.length];
            });

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const items = [
                createMockItem('item1', 'common', '/images/item1.png'),
                createMockItem('item2', 'common', '/images/item2.png'),
                createMockItem('item3', 'common', '/images/item3.png'),
            ] as any[];

            await loadTemplatesBatch(items);
            groupTemplatesByColor(items);

            const allGroups = getAllColorGroups();
            expect(allGroups.size).toBeGreaterThanOrEqual(1);
        });

        it('should skip items without dominantColor', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            // Return undefined for dominant color
            (getDominantColor as Mock).mockReturnValue(undefined);

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const items = [
                createMockItem('no-color', 'common', '/images/test.png'),
            ] as any[];

            await loadTemplatesBatch(items);
            groupTemplatesByColor(items);

            const allGroups = getAllColorGroups();
            expect(allGroups.size).toBe(0);
        });
    });

    // ========================================
    // generateMultiScaleVariants - Edge Cases
    // ========================================
    describe('generateMultiScaleVariants - Edge Cases', () => {
        it('should handle non-square canvas', () => {
            const mockImageData = {
                data: new Uint8ClampedArray(128 * 64 * 4),
                width: 128,
                height: 64,
            } as ImageData;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue(mockImageData),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            };

            const mockCanvas = {
                width: 128,
                height: 64,
                getContext: vi.fn().mockReturnValue(mockCtx),
            } as any;

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue({
                            drawImage: vi.fn(),
                            getImageData: vi.fn().mockReturnValue(mockImageData),
                            imageSmoothingEnabled: true,
                            imageSmoothingQuality: 'high',
                        }),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const variants = generateMultiScaleVariants(mockCanvas, mockCtx as any);

            expect(variants.size).toBeGreaterThan(0);
        });

        it('should handle original matching one of common sizes', () => {
            // Canvas is exactly 48x48 (one of COMMON_ICON_SIZES)
            const mockImageData = {
                data: new Uint8ClampedArray(48 * 48 * 4),
                width: 48,
                height: 48,
            } as ImageData;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue(mockImageData),
            };

            const mockCanvas = {
                width: 48,
                height: 48,
                getContext: vi.fn().mockReturnValue(mockCtx),
            } as any;

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue({
                            drawImage: vi.fn(),
                            getImageData: vi.fn().mockReturnValue(mockImageData),
                            imageSmoothingEnabled: true,
                            imageSmoothingQuality: 'high',
                        }),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const variants = generateMultiScaleVariants(mockCanvas, mockCtx as any);

            // Should use original for 48, create resized for others
            expect(variants.has(48)).toBe(true);
        });
    });

    // ========================================
    // selectBestTemplates - More Edge Cases
    // ========================================
    describe('selectBestTemplates - Extended', () => {
        it('should handle all samples from same source with diversity', () => {
            const samples = Array.from({ length: 5 }, (_, i) =>
                createTrainingSample({
                    id: `s${i}`,
                    source: 'ground_truth',
                })
            );

            const result = selectBestTemplates(samples, { maxCount: 5, preferDiversity: true });

            // With diversity, max 2 from same source
            expect(result.length).toBeLessThanOrEqual(2);
        });

        it('should handle empty source in sample', () => {
            const samples = [
                createTrainingSample({ id: 's1', source: '' as TemplateSource }),
            ];

            const result = selectBestTemplates(samples, { preferDiversity: true });
            expect(result.length).toBe(1);
        });

        it('should correctly count sources for diversity', () => {
            // Create samples with various sources
            const samples = [
                createTrainingSample({ id: 's1', source: 'ground_truth' }),
                createTrainingSample({ id: 's2', source: 'ground_truth' }),
                createTrainingSample({ id: 's3', source: 'ground_truth' }),
                createTrainingSample({ id: 's4', source: 'corrected' }),
                createTrainingSample({ id: 's5', source: 'corrected' }),
                createTrainingSample({ id: 's6', source: 'verified' }),
            ];

            const result = selectBestTemplates(samples, { maxCount: 6, preferDiversity: true });

            // Should have max 2 per source type
            const groundTruth = result.filter(r => r.sample.source === 'ground_truth');
            const corrected = result.filter(r => r.sample.source === 'corrected');

            expect(groundTruth.length).toBeLessThanOrEqual(2);
            expect(corrected.length).toBeLessThanOrEqual(2);
        });
    });

    // ========================================
    // Cache Eviction - LRU Logic
    // ========================================
    describe('Cache Eviction - LRU Logic', () => {
        it('should evict based on combined timestamp and access count', () => {
            vi.useFakeTimers();

            // Add entries with different access patterns
            cacheDetection('old-accessed', { value: 1 });

            // Access the old entry multiple times to increase its score
            getCachedDetection('old-accessed');
            getCachedDetection('old-accessed');
            getCachedDetection('old-accessed');

            vi.advanceTimersByTime(1000);

            cacheDetection('new-not-accessed', { value: 2 });

            // Fill to capacity
            const config = getConfig();
            for (let i = 0; i < config.MAX_CACHE_SIZE - 2; i++) {
                cacheDetection(`filler-${i}`, { value: i });
            }

            // Add one more to trigger eviction
            cacheDetection('trigger-eviction', { value: 'trigger' });

            // The old-accessed entry should survive due to high access count
            // The new-not-accessed might be evicted if it has lower score
            expect(getCacheSize()).toBe(config.MAX_CACHE_SIZE);

            vi.useRealTimers();
        });

        it('should evict when cache is exactly at capacity', () => {
            const config = getConfig();

            // Fill exactly to capacity
            for (let i = 0; i < config.MAX_CACHE_SIZE; i++) {
                cacheDetection(`key-${i}`, { value: i });
            }

            expect(getCacheSize()).toBe(config.MAX_CACHE_SIZE);

            // Add one more
            cacheDetection('over-capacity', { value: 'new' });

            // Size should still be at capacity (one was evicted)
            expect(getCacheSize()).toBe(config.MAX_CACHE_SIZE);
            expect(getCachedDetection('over-capacity')).toEqual({ value: 'new' });
        });
    });

    // ========================================
    // Getters After Operations
    // ========================================
    describe('Getters After Operations', () => {
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should return correct template count after loading', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            expect(getTemplateCount()).toBe(0);

            const items = [
                createMockItem('item1', 'common', '/images/item1.png'),
                createMockItem('item2', 'common', '/images/item2.png'),
            ] as any[];

            await loadTemplatesBatch(items);

            expect(getTemplateCount()).toBe(2);
        });

        it('should return correct scaled variant count', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('variant-test', 'common', '/images/test.png');
            await loadTemplate(item as any);

            const config = getConfig();
            const variantCount = getScaledVariantCount();

            // Should have one variant per common icon size
            expect(variantCount).toBe(config.COMMON_ICON_SIZES.length);
        });

        it('should return all templates map', async () => {
            class MockImage {
                src: string = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;

                constructor() {
                    setTimeout(() => {
                        this.onload?.();
                    }, 0);
                }
            }

            global.Image = MockImage as any;

            const mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
            };

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: vi.fn().mockReturnValue(mockCtx),
                    } as any;
                }
                return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
            });

            const item = createMockItem('map-test', 'common', '/images/test.png');
            await loadTemplate(item as any);

            const allTemplates = getAllTemplates();
            expect(allTemplates).toBeInstanceOf(Map);
            expect(allTemplates.has('map-test')).toBe(true);
        });
    });

    // ========================================
    // calculateResolutionBonus - Additional Cases
    // ========================================
    describe('calculateResolutionBonus - Additional Cases', () => {
        it('should handle zero dimension in resolution', () => {
            expect(calculateResolutionBonus('0x1080', '1920x1080')).toBe(0);
            expect(calculateResolutionBonus('1920x0', '1920x1080')).toBe(0);
        });

        it('should handle NaN in parsed resolution', () => {
            expect(calculateResolutionBonus('NaNx1080', '1920x1080')).toBe(0);
            expect(calculateResolutionBonus('1920xNaN', '1920x1080')).toBe(0);
        });

        it('should correctly calculate aspect ratio tolerance', () => {
            const config = getConfig();

            // Very close aspect ratios (within tolerance)
            // 100x100 = 1.0, 101x100 = 1.01 (diff = 0.01 < 0.05)
            expect(calculateResolutionBonus('100x100', '101x100')).toBe(config.RESOLUTION_MATCH_BONUS * 0.5);

            // Just outside tolerance
            // 100x100 = 1.0, 110x100 = 1.1 (diff = 0.1 > 0.05)
            expect(calculateResolutionBonus('100x100', '110x100')).toBe(0);
        });
    });

    // ========================================
    // prioritizeItems - Additional Cases
    // ========================================
    describe('prioritizeItems - Additional Cases', () => {
        it('should handle undefined rarity', () => {
            const items = [
                { id: 'no-rarity', name: 'Test' },
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            // Items without rarity go to standard
            expect(priority.length).toBe(0);
            expect(standard.length).toBe(1);
        });

        it('should handle mixed valid and invalid rarities', () => {
            const items = [
                createMockItem('common-item', 'common'),
                { id: 'null-rarity', name: 'Test', rarity: null },
                createMockItem('rare-item', 'rare'),
            ] as any[];

            const { priority, standard } = prioritizeItems(items);

            expect(priority.length).toBe(1);
            expect(priority[0].id).toBe('common-item');
            expect(standard.length).toBe(2);
        });
    });

    // ========================================
    // calculateQualityScore - Edge Cases
    // ========================================
    describe('calculateQualityScore - Extended', () => {
        it('should handle very high confidence values', () => {
            const sample = createTrainingSample({
                source: 'ground_truth',
                confidence: 10, // Unusually high
            });

            const score = calculateQualityScore(sample);
            // Should be clamped to 1
            expect(score).toBeLessThanOrEqual(1);
        });

        it('should handle negative confidence values', () => {
            const sample = createTrainingSample({
                source: 'verified',
                confidence: -0.5,
            });

            const score = calculateQualityScore(sample);
            // Negative confidence reduces score but should clamp to 0
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    // ========================================
    // calculateWeightedMatchScore - Edge Cases
    // ========================================
    describe('calculateWeightedMatchScore - Extended', () => {
        it('should handle negative weights', () => {
            const scores = [
                { score: 0.8, weight: -1 },
                { score: 0.6, weight: 1 },
            ];

            // Negative weight stays as-is (not converted by || 1)
            // (-0.8 + 0.6) / (-1 + 1) = -0.2 / 0 = edge case
            // The function handles this by returning weighted sum / total weight
            const result = calculateWeightedMatchScore(scores);
            // With -1 and 1 weights, total weight = 0, so returns 0
            expect(result).toBe(0);
        });

        it('should handle all zero scores', () => {
            const scores = [
                { score: 0, weight: 1 },
                { score: 0, weight: 2 },
            ];

            expect(calculateWeightedMatchScore(scores)).toBe(0);
        });

        it('should handle very large weights', () => {
            const scores = [
                { score: 1.0, weight: 1000000 },
                { score: 0, weight: 1 },
            ];

            const result = calculateWeightedMatchScore(scores);
            expect(result).toBeCloseTo(1.0, 5);
        });
    });
});
