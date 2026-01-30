/**
 * @vitest-environment jsdom
 * CV Templates Module - Comprehensive Tests
 * Tests for template loading, prioritization, and cache management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    prioritizeItems,
    loadTemplatesBatch,
    groupTemplatesByColor,
    loadItemTemplates,
    clearDetectionCache,
} from '../../src/modules/cv/templates.ts';

import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    isTemplatesLoaded,
    isPriorityTemplatesLoaded,
    isStandardTemplatesLoading,
    setAllData,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    setStandardTemplatesLoading,
    resetState,
} from '../../src/modules/cv/state.ts';

import { logger } from '../../src/modules/logger.ts';

// Mock getDominantColor from color module
vi.mock('../../src/modules/cv/color.ts', () => ({
    getDominantColor: vi.fn().mockReturnValue('gray'),
}));

import { getDominantColor } from '../../src/modules/cv/color.ts';

// ========================================
// Test Data Factories
// ========================================

const createMockItem = (id: string, rarity: string = 'common', image?: string) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    rarity,
    tier: 'B',
    image,
});

const createMockItems = () => [
    createMockItem('sword', 'common', 'images/sword.png'),
    createMockItem('shield', 'uncommon', 'images/shield.png'),
    createMockItem('rare_gem', 'rare', 'images/gem.png'),
    createMockItem('epic_staff', 'epic', 'images/staff.png'),
    createMockItem('legendary_crown', 'legendary', 'images/crown.png'),
];

// ========================================
// Test Suite
// ========================================

describe('CV Templates Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        resetState();
    });

    // ========================================
    // prioritizeItems Tests
    // ========================================
    describe('prioritizeItems', () => {
        it('should prioritize common items', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.some(item => item.rarity === 'common')).toBe(true);
            expect(standard.some(item => item.rarity === 'common')).toBe(false);
        });

        it('should prioritize uncommon items', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.some(item => item.rarity === 'uncommon')).toBe(true);
            expect(standard.some(item => item.rarity === 'uncommon')).toBe(false);
        });

        it('should put rare items in standard', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(standard.some(item => item.rarity === 'rare')).toBe(true);
            expect(priority.some(item => item.rarity === 'rare')).toBe(false);
        });

        it('should put epic items in standard', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(standard.some(item => item.rarity === 'epic')).toBe(true);
        });

        it('should put legendary items in standard', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(standard.some(item => item.rarity === 'legendary')).toBe(true);
        });

        it('should correctly split all items', () => {
            const items = createMockItems();
            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.length + standard.length).toBe(items.length);
        });

        it('should handle empty array', () => {
            const { priority, standard } = prioritizeItems([]);

            expect(priority).toEqual([]);
            expect(standard).toEqual([]);
        });

        it('should handle all common items', () => {
            const items = [
                createMockItem('item1', 'common'),
                createMockItem('item2', 'common'),
                createMockItem('item3', 'common'),
            ];
            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.length).toBe(3);
            expect(standard.length).toBe(0);
        });

        it('should handle all legendary items', () => {
            const items = [
                createMockItem('item1', 'legendary'),
                createMockItem('item2', 'legendary'),
            ];
            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.length).toBe(0);
            expect(standard.length).toBe(2);
        });

        it('should preserve item properties', () => {
            const items = [createMockItem('sword', 'common', 'images/sword.png')];
            const { priority } = prioritizeItems(items as any);

            expect(priority[0].id).toBe('sword');
            expect(priority[0].name).toBe('Sword');
            expect(priority[0].image).toBe('images/sword.png');
        });
    });

    // ========================================
    // loadTemplatesBatch Tests
    // ========================================
    describe('loadTemplatesBatch', () => {
        let mockCtx: any;
        let mockCanvas: any;
        let originalImage: typeof Image;

        beforeEach(() => {
            originalImage = global.Image;

            // Mock canvas context
            mockCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(64 * 64 * 4),
                    width: 64,
                    height: 64,
                }),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            };

            mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue(mockCtx),
            };

            // Mock document.createElement
            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return { ...mockCanvas } as any;
                }
                // Return a real element for non-canvas
                const elem = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
                return elem;
            });
        });

        afterEach(() => {
            global.Image = originalImage;
        });

        it('should skip items without images', async () => {
            const items = [createMockItem('no_image', 'common')]; // No image property

            const result = await loadTemplatesBatch(items as any);

            expect(result.loaded).toBe(0);
            expect(result.failed).toBe(0);
            expect(getItemTemplates().size).toBe(0);
        });

        it('should handle empty items array', async () => {
            const result = await loadTemplatesBatch([]);

            expect(result.loaded).toBe(0);
            expect(result.failed).toBe(0);
        });

        it('should load WebP image successfully', async () => {
            // Mock Image to simulate successful WebP load
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('sword', 'common', 'images/sword.png')];

            vi.useRealTimers();
            const result = await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(result.loaded).toBe(1);
            expect(result.failed).toBe(0);
            expect(getItemTemplates().has('sword')).toBe(true);
        });

        it('should fallback to PNG when WebP fails', async () => {
            let loadAttempt = 0;
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                src = '';

                constructor() {
                    loadAttempt++;
                    setTimeout(() => {
                        // First attempt (WebP) fails, second (PNG) succeeds
                        if (loadAttempt === 1) {
                            if (this.onerror) this.onerror();
                        } else {
                            if (this.onload) this.onload();
                        }
                    }, 0);
                }
            } as any;

            const items = [createMockItem('shield', 'common', 'images/shield.png')];

            vi.useRealTimers();
            const result = await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(result.loaded).toBe(1);
            expect(result.failed).toBe(0);
            expect(loadAttempt).toBe(2); // WebP attempt + PNG fallback
        });

        it('should handle both WebP and PNG failure', async () => {
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('broken', 'common', 'images/broken.png')];

            vi.useRealTimers();
            const result = await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(result.loaded).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.failedIds).toContain('broken');
        });

        it('should log warning when batch has failures', async () => {
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }
            } as any;

            const items = [
                createMockItem('broken1', 'common', 'images/broken1.png'),
                createMockItem('broken2', 'common', 'images/broken2.png'),
            ];

            vi.useRealTimers();
            await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.load_template_batch',
                })
            );
        });

        it('should handle canvas context failure', async () => {
            // Override mock to return null context
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

            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('nocontext', 'common', 'images/nocontext.png')];

            vi.useRealTimers();
            const result = await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(result.failed).toBe(1);
            expect(result.failedIds).toContain('nocontext');
        });

        it('should convert .png to .webp for initial load attempt', async () => {
            let capturedSrc = '';
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                private _src = '';

                get src() { return this._src; }
                set src(value: string) {
                    this._src = value;
                    capturedSrc = value;
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('test', 'common', 'images/test.png')];

            vi.useRealTimers();
            await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(capturedSrc).toBe('images/test.webp');
        });

        it('should handle non-png images without conversion', async () => {
            let capturedSrc = '';
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                private _src = '';

                get src() { return this._src; }
                set src(value: string) {
                    this._src = value;
                    capturedSrc = value;
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('test', 'common', 'images/test.jpg')];

            vi.useRealTimers();
            await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            // Non-png should still have .webp appended (due to replace not matching)
            expect(capturedSrc).toBe('images/test.jpg');
        });

        it('should store template data correctly', async () => {
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 128;
                height = 128;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [createMockItem('stored', 'common', 'images/stored.png')];

            vi.useRealTimers();
            await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            const template = getItemTemplates().get('stored');
            expect(template).toBeDefined();
            expect(template?.width).toBe(128);
            expect(template?.height).toBe(128);
        });

        it('should load multiple items in parallel', async () => {
            let loadCount = 0;
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 64;
                src = '';

                constructor() {
                    loadCount++;
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            const items = [
                createMockItem('item1', 'common', 'images/item1.png'),
                createMockItem('item2', 'common', 'images/item2.png'),
                createMockItem('item3', 'common', 'images/item3.png'),
            ];

            vi.useRealTimers();
            const result = await loadTemplatesBatch(items as any);
            vi.useFakeTimers();

            expect(result.loaded).toBe(3);
            expect(loadCount).toBe(3);
        });
    });

    // ========================================
    // groupTemplatesByColor Tests
    // ========================================
    describe('groupTemplatesByColor', () => {
        beforeEach(() => {
            // Set up mock template in itemTemplates
            const templates = getItemTemplates();
            templates.set('sword', {
                image: {} as HTMLImageElement,
                canvas: {} as HTMLCanvasElement,
                ctx: {
                    getImageData: vi.fn().mockReturnValue({
                        data: new Uint8ClampedArray(64 * 64 * 4),
                        width: 64,
                        height: 64,
                    }),
                } as any,
                width: 64,
                height: 64,
            });
        });

        it('should group items by dominant color', () => {
            const items = [createMockItem('sword', 'common', 'images/sword.png')];
            (getDominantColor as any).mockReturnValue('gray');

            groupTemplatesByColor(items as any);

            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor.has('gray')).toBe(true);
            expect(templatesByColor.get('gray')).toHaveLength(1);
        });

        it('should skip items without templates', () => {
            const items = [createMockItem('no_template', 'common', 'images/no.png')];

            groupTemplatesByColor(items as any);

            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor.size).toBe(0);
        });

        it('should group multiple items with same color', () => {
            // Add more templates
            const templates = getItemTemplates();
            templates.set('shield', {
                ctx: { getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 }) },
                width: 64,
                height: 64,
            } as any);

            (getDominantColor as any).mockReturnValue('blue');

            const items = [
                createMockItem('sword', 'common', 'images/sword.png'),
                createMockItem('shield', 'common', 'images/shield.png'),
            ];

            groupTemplatesByColor(items as any);

            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor.get('blue')).toHaveLength(2);
        });

        it('should create separate groups for different colors', () => {
            const templates = getItemTemplates();
            templates.set('shield', {
                ctx: { getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 }) },
                width: 64,
                height: 64,
            } as any);

            let callCount = 0;
            (getDominantColor as any).mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 'red' : 'blue';
            });

            const items = [
                createMockItem('sword', 'common', 'images/sword.png'),
                createMockItem('shield', 'common', 'images/shield.png'),
            ];

            groupTemplatesByColor(items as any);

            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor.has('red')).toBe(true);
            expect(templatesByColor.has('blue')).toBe(true);
        });

        it('should handle empty items array', () => {
            groupTemplatesByColor([]);

            const templatesByColor = getTemplatesByColor();
            expect(templatesByColor.size).toBe(0);
        });
    });

    // ========================================
    // loadItemTemplates Tests
    // ========================================
    describe('loadItemTemplates', () => {
        beforeEach(() => {
            // Set up minimal game data
            setAllData({
                items: {
                    items: [],
                    version: '1.0',
                    last_updated: '2024-01-01',
                },
            } as any);
        });

        it('should return early if templates already loaded', async () => {
            setTemplatesLoaded(true);
            vi.clearAllMocks();

            await loadItemTemplates();

            expect(logger.info).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.load_templates',
                })
            );
        });

        it('should log start of loading', async () => {
            setAllData({
                items: {
                    items: [createMockItem('sword', 'common')],
                },
            } as any);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.load_templates',
                    data: expect.objectContaining({
                        phase: 'start',
                    }),
                })
            );
        });

        it('should clear old templates before loading new ones', async () => {
            // Add some existing templates
            const templates = getItemTemplates();
            templates.set('old_item', {} as any);
            const templatesByColor = getTemplatesByColor();
            templatesByColor.set('old_color', []);
            setPriorityTemplatesLoaded(true);

            setAllData({
                items: {
                    items: [createMockItem('new_item', 'common')],
                },
            } as any);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phase: 'clearing_old_templates',
                    }),
                })
            );
        });

        it('should handle empty items list', async () => {
            setAllData({ items: { items: [] } } as any);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phase: 'start',
                        totalItems: 0,
                    }),
                })
            );
        });

        it('should set priorityTemplatesLoaded after priority items loaded', async () => {
            setAllData({
                items: {
                    items: [
                        createMockItem('common_item', 'common'),
                        createMockItem('rare_item', 'rare'),
                    ],
                },
            } as any);

            await loadItemTemplates();

            expect(isPriorityTemplatesLoaded()).toBe(true);
        });

        it('should log priority complete phase', async () => {
            setAllData({
                items: {
                    items: [createMockItem('common_item', 'common')],
                },
            } as any);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phase: 'priority_complete',
                    }),
                })
            );
        });

        it('should handle missing items data gracefully', async () => {
            setAllData({} as any);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        totalItems: 0,
                    }),
                })
            );
        });

        it('should load standard items in background via setTimeout', async () => {
            setAllData({
                items: {
                    items: [
                        createMockItem('common_item', 'common'),
                        createMockItem('rare_item', 'rare'),
                    ],
                },
            } as any);

            await loadItemTemplates();

            // Run the setTimeout callback
            await vi.runAllTimersAsync();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phase: 'complete',
                    }),
                })
            );
        });

        it('should set templatesLoaded after standard items complete', async () => {
            setAllData({
                items: {
                    items: [createMockItem('rare_item', 'rare')],
                },
            } as any);

            await loadItemTemplates();
            await vi.runAllTimersAsync();

            expect(isTemplatesLoaded()).toBe(true);
        });

        it('should skip standard loading if already loading', async () => {
            // Import and set the loading flag
            const { setStandardTemplatesLoading, isStandardTemplatesLoading } = await import('../../src/modules/cv/state.ts');

            setAllData({
                items: {
                    items: [
                        createMockItem('common_item', 'common'),
                        createMockItem('rare_item', 'rare'),
                    ],
                },
            } as any);

            // Pre-set the loading flag
            setStandardTemplatesLoading(true);

            await loadItemTemplates();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phase: 'skipped_standard',
                        reason: 'already_loading',
                    }),
                })
            );

            // Reset for cleanup
            setStandardTemplatesLoading(false);
        });

        it('should handle errors in background loading gracefully', async () => {
            // Create a scenario that will error in the setTimeout callback
            setAllData({
                items: {
                    items: [
                        createMockItem('common_item', 'common'),
                        createMockItem('rare_item', 'rare', 'images/rare.png'),
                    ],
                },
            } as any);

            // Mock loadTemplatesBatch to throw for standard items
            // by having the Image always fail
            const originalImage = global.Image;
            global.Image = class MockImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                src = '';

                constructor() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }
            } as any;

            vi.useRealTimers();
            await loadItemTemplates();

            // Wait for setTimeout callbacks to run
            await new Promise(resolve => setTimeout(resolve, 100));

            global.Image = originalImage;
            vi.useFakeTimers();

            // Even with errors, templates should be marked as loaded
            // to prevent infinite retries
            expect(isTemplatesLoaded()).toBe(true);
        });
    });

    // ========================================
    // clearDetectionCache Tests
    // ========================================
    describe('clearDetectionCache', () => {
        it('should clear all cache entries', () => {
            const cache = getDetectionCache();
            cache.set('hash1', { results: [], timestamp: Date.now() });
            cache.set('hash2', { results: [], timestamp: Date.now() });
            cache.set('hash3', { results: [], timestamp: Date.now() });

            clearDetectionCache();

            expect(getDetectionCache().size).toBe(0);
        });

        it('should log cache cleared', () => {
            clearDetectionCache();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'cv.cache_cleared',
                    data: expect.objectContaining({
                        cleared: true,
                    }),
                })
            );
        });

        it('should be safe to call on empty cache', () => {
            expect(() => clearDetectionCache()).not.toThrow();
            expect(getDetectionCache().size).toBe(0);
        });

        it('should be safe to call multiple times', () => {
            const cache = getDetectionCache();
            cache.set('hash', { results: [], timestamp: Date.now() });

            clearDetectionCache();
            clearDetectionCache();
            clearDetectionCache();

            expect(getDetectionCache().size).toBe(0);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support typical template loading workflow', async () => {
            // Set up game data
            setAllData({
                items: {
                    items: [
                        createMockItem('common1', 'common'),
                        createMockItem('common2', 'common'),
                        createMockItem('rare1', 'rare'),
                    ],
                },
            } as any);

            // Prioritize items
            const items = getAllData().items?.items || [];
            const { priority, standard } = prioritizeItems(items);

            expect(priority.length).toBe(2);
            expect(standard.length).toBe(1);
        });

        it('should handle reload scenario', async () => {
            // Initial load
            setAllData({ items: { items: [createMockItem('old', 'common')] } } as any);
            const templates = getItemTemplates();
            templates.set('old', {} as any);
            setTemplatesLoaded(true);

            // Reset for reload
            templates.clear();
            setTemplatesLoaded(false);
            setPriorityTemplatesLoaded(false);

            // New load
            setAllData({ items: { items: [createMockItem('new', 'common')] } } as any);

            expect(isTemplatesLoaded()).toBe(false);
            expect(isPriorityTemplatesLoaded()).toBe(false);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle items with undefined rarity', () => {
            const items = [{ id: 'no_rarity', name: 'No Rarity' }];
            const { priority, standard } = prioritizeItems(items as any);

            // Undefined rarity should go to standard
            expect(priority.length).toBe(0);
            expect(standard.length).toBe(1);
        });

        it('should handle very large item lists', () => {
            const items = Array.from({ length: 1000 }, (_, i) =>
                createMockItem(`item_${i}`, i % 2 === 0 ? 'common' : 'rare')
            );

            const { priority, standard } = prioritizeItems(items as any);

            expect(priority.length).toBe(500);
            expect(standard.length).toBe(500);
        });

        it('should preserve item order within priority groups', () => {
            const items = [
                createMockItem('first', 'common'),
                createMockItem('second', 'common'),
                createMockItem('third', 'common'),
            ];

            const { priority } = prioritizeItems(items as any);

            expect(priority[0].id).toBe('first');
            expect(priority[1].id).toBe('second');
            expect(priority[2].id).toBe('third');
        });

        it('should handle mixed case rarity strings', () => {
            // Note: The actual implementation may be case-sensitive
            const items = [
                { id: 'item1', name: 'Item1', rarity: 'COMMON' },
                { id: 'item2', name: 'Item2', rarity: 'Common' },
            ];

            const { priority, standard } = prioritizeItems(items as any);

            // Both should go to standard since they don't match lowercase 'common'
            expect(standard.length).toBe(2);
        });
    });
});
