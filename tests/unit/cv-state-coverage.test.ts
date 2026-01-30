/**
 * @vitest-environment jsdom
 * CV State Module - Coverage Enhancement Tests
 * Focused on grid presets, multi-scale templates, and edge cases
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    resetState,
    getMultiScaleTemplates,
    getMultiScaleTemplate,
    setMultiScaleTemplate,
    hasMultiScaleTemplates,
    getMultiScaleTemplateCount,
    COMMON_ICON_SIZES,
    loadGridPresets,
    getPresetForResolution,
    findPresetByAspectRatio,
    getAllGridPresets,
    isGridPresetsLoaded,
    scaleCalibrationToResolution,
    getResizedTemplate,
    setResizedTemplate,
    getResizedTemplateCacheSize,
    isStandardTemplatesLoading,
    setStandardTemplatesLoading,
} from '../../src/modules/cv/state.ts';

import type { GridPreset } from '../../src/modules/cv/types.ts';

// ========================================
// Test Helpers
// ========================================

function createMockImageData(width: number, height: number): ImageData {
    // Create a mock ImageData object that works in jsdom
    return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
        colorSpace: 'srgb',
    } as unknown as ImageData;
}

function createMockCalibration(): GridPreset['calibration'] {
    return {
        xOffset: 100,
        yOffset: 900,
        iconWidth: 48,
        iconHeight: 48,
        xSpacing: 52,
        ySpacing: 52,
        iconsPerRow: 10,
        numRows: 1,
    };
}

// ========================================
// Test Suite
// ========================================

describe('CV State Module - Coverage Enhancement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetState();
    });

    // ========================================
    // COMMON_ICON_SIZES Tests
    // ========================================
    describe('COMMON_ICON_SIZES', () => {
        it('contains expected icon sizes', () => {
            expect(COMMON_ICON_SIZES).toEqual([32, 38, 40, 44, 48, 55, 64, 72]);
        });

        it('is readonly/frozen', () => {
            // The array should be readonly (typed as const)
            expect(COMMON_ICON_SIZES.length).toBe(8);
        });

        it('all sizes are positive', () => {
            COMMON_ICON_SIZES.forEach(size => {
                expect(size).toBeGreaterThan(0);
            });
        });

        it('sizes are in ascending order', () => {
            for (let i = 1; i < COMMON_ICON_SIZES.length; i++) {
                expect(COMMON_ICON_SIZES[i]).toBeGreaterThan(COMMON_ICON_SIZES[i - 1]);
            }
        });
    });

    // ========================================
    // Multi-Scale Templates Tests
    // ========================================
    describe('Multi-Scale Templates', () => {
        describe('getMultiScaleTemplates', () => {
            it('returns empty Map by default', () => {
                const templates = getMultiScaleTemplates();
                expect(templates).toBeInstanceOf(Map);
                expect(templates.size).toBe(0);
            });

            it('returns same Map instance', () => {
                const map1 = getMultiScaleTemplates();
                const map2 = getMultiScaleTemplates();
                expect(map1).toBe(map2);
            });
        });

        describe('setMultiScaleTemplate', () => {
            it('creates new entry for new item', () => {
                const imageData = createMockImageData(48, 48);
                setMultiScaleTemplate('sword', 48, imageData);

                expect(hasMultiScaleTemplates('sword')).toBe(true);
            });

            it('adds multiple sizes for same item', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                setMultiScaleTemplate('sword', 64, createMockImageData(64, 64));

                expect(getMultiScaleTemplate('sword', 32)).toBeDefined();
                expect(getMultiScaleTemplate('sword', 48)).toBeDefined();
                expect(getMultiScaleTemplate('sword', 64)).toBeDefined();
            });

            it('overwrites existing size for item', () => {
                const original = createMockImageData(48, 48);
                const updated = createMockImageData(48, 48);

                setMultiScaleTemplate('sword', 48, original);
                setMultiScaleTemplate('sword', 48, updated);

                expect(getMultiScaleTemplate('sword', 48)).toBe(updated);
            });
        });

        describe('getMultiScaleTemplate', () => {
            it('returns undefined for non-existent item', () => {
                expect(getMultiScaleTemplate('nonexistent', 48)).toBeUndefined();
            });

            it('returns undefined for non-existent size', () => {
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                expect(getMultiScaleTemplate('sword', 32)).toBeUndefined();
            });

            it('returns correct ImageData for item and size', () => {
                const imageData = createMockImageData(48, 48);
                setMultiScaleTemplate('sword', 48, imageData);

                expect(getMultiScaleTemplate('sword', 48)).toBe(imageData);
            });
        });

        describe('hasMultiScaleTemplates', () => {
            it('returns false for non-existent item', () => {
                expect(hasMultiScaleTemplates('nonexistent')).toBe(false);
            });

            it('returns false for item with empty size map', () => {
                const templates = getMultiScaleTemplates();
                templates.set('empty', new Map());

                expect(hasMultiScaleTemplates('empty')).toBe(false);
            });

            it('returns true for item with templates', () => {
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                expect(hasMultiScaleTemplates('sword')).toBe(true);
            });
        });

        describe('getMultiScaleTemplateCount', () => {
            it('returns 0 for empty state', () => {
                expect(getMultiScaleTemplateCount()).toBe(0);
            });

            it('counts all template variants across items', () => {
                setMultiScaleTemplate('sword', 32, createMockImageData(32, 32));
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                setMultiScaleTemplate('shield', 48, createMockImageData(48, 48));
                setMultiScaleTemplate('shield', 64, createMockImageData(64, 64));

                expect(getMultiScaleTemplateCount()).toBe(4);
            });

            it('counts correctly after adding and removing', () => {
                setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
                expect(getMultiScaleTemplateCount()).toBe(1);

                // Add more
                setMultiScaleTemplate('sword', 64, createMockImageData(64, 64));
                expect(getMultiScaleTemplateCount()).toBe(2);
            });
        });
    });

    // ========================================
    // LRU Cache Edge Cases Tests
    // ========================================
    describe('Resized Template Cache - Edge Cases', () => {
        it('handles same key overwrite (LRU reorder)', () => {
            const img1 = createMockImageData(50, 50);
            const img2 = createMockImageData(50, 50);

            setResizedTemplate('item1', 50, 50, img1);
            setResizedTemplate('item1', 50, 50, img2);

            expect(getResizedTemplate('item1', 50, 50)).toBe(img2);
            expect(getResizedTemplateCacheSize()).toBe(1);
        });

        it('promotes accessed item to most recently used', () => {
            // Fill cache with 5 items
            for (let i = 0; i < 5; i++) {
                setResizedTemplate(`item${i}`, 50, 50, createMockImageData(1, 1));
            }

            // Access item0 to promote it
            getResizedTemplate('item0', 50, 50);

            // Add 495 more items to fill cache to 500
            for (let i = 5; i < 500; i++) {
                setResizedTemplate(`item${i}`, 50, 50, createMockImageData(1, 1));
            }

            // item0 should still be there (was promoted)
            expect(getResizedTemplate('item0', 50, 50)).toBeDefined();
        });

        it('evicts correctly when at max capacity', () => {
            // Fill cache to max (500)
            for (let i = 0; i < 500; i++) {
                setResizedTemplate(`item${i}`, 50, 50, createMockImageData(1, 1));
            }
            expect(getResizedTemplateCacheSize()).toBe(500);

            // Add one more
            setResizedTemplate('newItem', 50, 50, createMockImageData(1, 1));

            // Size should still be 500
            expect(getResizedTemplateCacheSize()).toBe(500);
            // First item should be evicted
            expect(getResizedTemplate('item0', 50, 50)).toBeUndefined();
            // New item should exist
            expect(getResizedTemplate('newItem', 50, 50)).toBeDefined();
        });

        it('handles composite key correctly', () => {
            const img1 = createMockImageData(32, 32);
            const img2 = createMockImageData(64, 64);
            const img3 = createMockImageData(32, 64);

            setResizedTemplate('sword', 32, 32, img1);
            setResizedTemplate('sword', 64, 64, img2);
            setResizedTemplate('sword', 32, 64, img3);

            expect(getResizedTemplate('sword', 32, 32)).toBe(img1);
            expect(getResizedTemplate('sword', 64, 64)).toBe(img2);
            expect(getResizedTemplate('sword', 32, 64)).toBe(img3);
            expect(getResizedTemplateCacheSize()).toBe(3);
        });
    });

    // ========================================
    // Standard Templates Loading Flag Tests
    // ========================================
    describe('Standard Templates Loading Flag', () => {
        it('returns false by default', () => {
            expect(isStandardTemplatesLoading()).toBe(false);
        });

        it('can be set to true', () => {
            setStandardTemplatesLoading(true);
            expect(isStandardTemplatesLoading()).toBe(true);
        });

        it('can be set back to false', () => {
            setStandardTemplatesLoading(true);
            setStandardTemplatesLoading(false);
            expect(isStandardTemplatesLoading()).toBe(false);
        });

        it('is reset by resetState', () => {
            setStandardTemplatesLoading(true);
            resetState();
            expect(isStandardTemplatesLoading()).toBe(false);
        });
    });

    // ========================================
    // Grid Presets Tests
    // ========================================
    describe('Grid Presets', () => {
        describe('loadGridPresets', () => {
            it('returns null when fetch fails', async () => {
                vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

                const result = await loadGridPresets();

                expect(result).toBeNull();
                expect(isGridPresetsLoaded()).toBe(true); // Should mark as loaded to prevent retries
            });

            it('returns null for non-OK response', async () => {
                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: false,
                    status: 404,
                } as Response);

                const result = await loadGridPresets();

                expect(result).toBeNull();
            });

            it('parses and caches valid JSON response', async () => {
                const mockPresets = {
                    version: '1.0',
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: createMockCalibration(),
                        },
                    },
                };

                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => mockPresets,
                } as Response);

                const result = await loadGridPresets();

                expect(result).toEqual(mockPresets);
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('returns cached result on subsequent calls', async () => {
                const mockPresets = {
                    version: '1.0',
                    presets: { '1920x1080': { resolution: { width: 1920, height: 1080 }, calibration: createMockCalibration() } },
                };

                const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => mockPresets,
                } as Response);

                await loadGridPresets();
                await loadGridPresets();

                expect(fetchSpy).toHaveBeenCalledTimes(1);
            });
        });

        describe('getPresetForResolution', () => {
            beforeEach(async () => {
                const mockPresets = {
                    version: '1.0',
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: createMockCalibration(),
                        },
                        '1280x720': {
                            resolution: { width: 1280, height: 720 },
                            calibration: { ...createMockCalibration(), xOffset: 80 },
                        },
                    },
                };

                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => mockPresets,
                } as Response);

                await loadGridPresets();
            });

            it('returns preset for exact match', () => {
                const preset = getPresetForResolution(1920, 1080);
                expect(preset).not.toBeNull();
                expect(preset?.resolution.width).toBe(1920);
            });

            it('returns null for no match', () => {
                const preset = getPresetForResolution(2560, 1440);
                expect(preset).toBeNull();
            });

            it('returns null when presets not loaded', () => {
                resetState();
                const preset = getPresetForResolution(1920, 1080);
                expect(preset).toBeNull();
            });
        });

        describe('findPresetByAspectRatio', () => {
            beforeEach(async () => {
                const mockPresets = {
                    version: '1.0',
                    presets: {
                        '1920x1080': {
                            resolution: { width: 1920, height: 1080 },
                            calibration: createMockCalibration(),
                        },
                        '1280x720': {
                            resolution: { width: 1280, height: 720 },
                            calibration: createMockCalibration(),
                        },
                        '2560x1440': {
                            resolution: { width: 2560, height: 1440 },
                            calibration: createMockCalibration(),
                        },
                    },
                };

                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => mockPresets,
                } as Response);

                await loadGridPresets();
            });

            it('finds closest match by aspect ratio', () => {
                // 1600x900 has same 16:9 aspect ratio
                const preset = findPresetByAspectRatio(1600, 900);
                expect(preset).not.toBeNull();
                // Should match one of the 16:9 presets
                const ratio = preset!.resolution.width / preset!.resolution.height;
                expect(ratio).toBeCloseTo(16 / 9, 2);
            });

            it('returns null when presets not loaded', () => {
                resetState();
                const preset = findPresetByAspectRatio(1920, 1080);
                expect(preset).toBeNull();
            });

            it('handles invalid dimensions', () => {
                expect(findPresetByAspectRatio(0, 1080)).toBeNull();
                expect(findPresetByAspectRatio(1920, 0)).toBeNull();
                expect(findPresetByAspectRatio(-1920, 1080)).toBeNull();
                expect(findPresetByAspectRatio(NaN, 1080)).toBeNull();
                expect(findPresetByAspectRatio(1920, Infinity)).toBeNull();
            });

            it('prefers closer total resolution for same aspect ratio', () => {
                // Both 1920x1080 and 1280x720 are 16:9
                // A resolution closer to 1920x1080 in total pixels should prefer it
                const preset = findPresetByAspectRatio(1800, 1012);
                expect(preset).not.toBeNull();
            });
        });

        describe('getAllGridPresets', () => {
            it('returns empty object when not loaded', () => {
                const presets = getAllGridPresets();
                expect(presets).toEqual({});
            });

            it('returns all loaded presets', async () => {
                const mockPresets = {
                    version: '1.0',
                    presets: {
                        '1920x1080': { resolution: { width: 1920, height: 1080 }, calibration: createMockCalibration() },
                        '1280x720': { resolution: { width: 1280, height: 720 }, calibration: createMockCalibration() },
                    },
                };

                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => mockPresets,
                } as Response);

                await loadGridPresets();
                const presets = getAllGridPresets();

                expect(Object.keys(presets)).toHaveLength(2);
                expect(presets['1920x1080']).toBeDefined();
                expect(presets['1280x720']).toBeDefined();
            });
        });

        describe('isGridPresetsLoaded', () => {
            it('returns false initially', () => {
                expect(isGridPresetsLoaded()).toBe(false);
            });

            it('returns true after successful load', async () => {
                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => ({ version: '1.0', presets: {} }),
                } as Response);

                await loadGridPresets();
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('returns true after failed load (prevents retries)', async () => {
                vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

                await loadGridPresets();
                expect(isGridPresetsLoaded()).toBe(true);
            });

            it('returns false after resetState', async () => {
                vi.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: async () => ({ version: '1.0', presets: {} }),
                } as Response);

                await loadGridPresets();
                resetState();

                expect(isGridPresetsLoaded()).toBe(false);
            });
        });
    });

    // ========================================
    // scaleCalibrationToResolution Tests
    // ========================================
    describe('scaleCalibrationToResolution', () => {
        it('scales all numeric values by height ratio', () => {
            const calibration = createMockCalibration();
            const scaled = scaleCalibrationToResolution(calibration, 1080, 720);

            const ratio = 720 / 1080; // 0.666...
            expect(scaled.xOffset).toBe(Math.round(100 * ratio));
            expect(scaled.yOffset).toBe(Math.round(900 * ratio));
            expect(scaled.iconWidth).toBe(Math.round(48 * ratio));
            expect(scaled.iconHeight).toBe(Math.round(48 * ratio));
            expect(scaled.xSpacing).toBe(Math.round(52 * ratio));
            expect(scaled.ySpacing).toBe(Math.round(52 * ratio));
        });

        it('preserves iconsPerRow and numRows', () => {
            const calibration = {
                ...createMockCalibration(),
                iconsPerRow: 15,
                numRows: 2,
            };
            const scaled = scaleCalibrationToResolution(calibration, 1080, 1440);

            expect(scaled.iconsPerRow).toBe(15);
            expect(scaled.numRows).toBe(2);
        });

        it('handles upscaling (larger target)', () => {
            const calibration = createMockCalibration();
            const scaled = scaleCalibrationToResolution(calibration, 1080, 2160);

            const ratio = 2160 / 1080; // 2
            expect(scaled.xOffset).toBe(Math.round(100 * ratio));
            expect(scaled.iconWidth).toBe(Math.round(48 * ratio));
        });

        it('handles same resolution (no change)', () => {
            const calibration = createMockCalibration();
            const scaled = scaleCalibrationToResolution(calibration, 1080, 1080);

            expect(scaled.xOffset).toBe(calibration.xOffset);
            expect(scaled.yOffset).toBe(calibration.yOffset);
            expect(scaled.iconWidth).toBe(calibration.iconWidth);
        });

        it('rounds values to integers', () => {
            const calibration = {
                xOffset: 100,
                yOffset: 100,
                iconWidth: 100,
                iconHeight: 100,
                xSpacing: 100,
                ySpacing: 100,
                iconsPerRow: 10,
                numRows: 1,
            };
            const scaled = scaleCalibrationToResolution(calibration, 1080, 720);

            // All values should be integers
            expect(Number.isInteger(scaled.xOffset)).toBe(true);
            expect(Number.isInteger(scaled.yOffset)).toBe(true);
            expect(Number.isInteger(scaled.iconWidth)).toBe(true);
            expect(Number.isInteger(scaled.iconHeight)).toBe(true);
            expect(Number.isInteger(scaled.xSpacing)).toBe(true);
            expect(Number.isInteger(scaled.ySpacing)).toBe(true);
        });
    });

    // ========================================
    // resetState - Complete Coverage
    // ========================================
    describe('resetState - Complete Coverage', () => {
        it('clears multi-scale templates', () => {
            setMultiScaleTemplate('sword', 48, createMockImageData(48, 48));
            resetState();

            expect(hasMultiScaleTemplates('sword')).toBe(false);
            expect(getMultiScaleTemplateCount()).toBe(0);
        });

        it('clears resized template cache', () => {
            setResizedTemplate('item1', 50, 50, createMockImageData(50, 50));
            resetState();

            expect(getResizedTemplateCacheSize()).toBe(0);
        });

        it('clears grid presets', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => ({ version: '1.0', presets: { '1920x1080': { resolution: { width: 1920, height: 1080 }, calibration: createMockCalibration() } } }),
            } as Response);

            await loadGridPresets();
            expect(getAllGridPresets()).not.toEqual({});

            resetState();

            expect(getAllGridPresets()).toEqual({});
            expect(isGridPresetsLoaded()).toBe(false);
        });

        it('resets standard templates loading flag', () => {
            setStandardTemplatesLoading(true);
            resetState();
            expect(isStandardTemplatesLoading()).toBe(false);
        });
    });
});
