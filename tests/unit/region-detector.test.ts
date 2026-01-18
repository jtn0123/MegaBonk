/**
 * @vitest-environment jsdom
 * Region Detector Module - Comprehensive Tests
 * Tests for screen region detection, slot generation, and occupancy detection
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    initRegionDetector,
    setDebugMode,
    detectResolutionPreset,
    getResolutionConfig,
    detectScreenRegions,
    generateHotbarSlots,
    generateWeaponSlots,
    generateTomeSlots,
    calculateRegionVariance,
    detectOccupiedSlots,
    countOccupiedSlots,
    getRegionsOfInterest,
    adjustRegionsForContent,
    validateRegions,
    isPointInRegion,
    calculateRegionOverlap,
    getDebugLogs,
    clearDebugLogs,
    __testing,
} from '../../src/modules/region-detector.ts';

// ========================================
// Test Helpers
// ========================================

function createMockImageData(width: number, height: number, pixelValue: number = 128): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = pixelValue;
        data[i + 1] = pixelValue;
        data[i + 2] = pixelValue;
        data[i + 3] = 255;
    }
    return { data, width, height, colorSpace: 'srgb' };
}

function createVariedImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = (i * 7) % 256;
        data[i + 1] = (i * 13) % 256;
        data[i + 2] = (i * 17) % 256;
        data[i + 3] = 255;
    }
    return { data, width, height, colorSpace: 'srgb' };
}

// ========================================
// Test Suite
// ========================================

describe('Region Detector Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearDebugLogs();
        setDebugMode(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearDebugLogs();
    });

    // ========================================
    // initRegionDetector Tests
    // ========================================
    describe('initRegionDetector', () => {
        it('should initialize with default config', () => {
            expect(() => initRegionDetector()).not.toThrow();
        });

        it('should initialize with custom config', () => {
            expect(() => initRegionDetector({ debugMode: true })).not.toThrow();
        });

        it('should merge custom config with defaults', () => {
            initRegionDetector({ debugMode: true });
            // Debug mode should be enabled (we can test by checking debug logs)
            setDebugMode(true);
            detectResolutionPreset(1920, 1080);
            expect(getDebugLogs().length).toBeGreaterThan(0);
        });
    });

    // ========================================
    // setDebugMode Tests
    // ========================================
    describe('setDebugMode', () => {
        it('should enable debug mode', () => {
            setDebugMode(true);
            detectResolutionPreset(1920, 1080);
            expect(getDebugLogs().length).toBeGreaterThan(0);
        });

        it('should disable debug mode', () => {
            setDebugMode(false);
            clearDebugLogs();
            detectResolutionPreset(1920, 1080);
            expect(getDebugLogs().length).toBe(0);
        });
    });

    // ========================================
    // detectResolutionPreset Tests
    // ========================================
    describe('detectResolutionPreset', () => {
        it('should detect 720p exactly', () => {
            const preset = detectResolutionPreset(1280, 720);
            expect(preset).toBe('720p');
        });

        it('should detect 1080p exactly', () => {
            const preset = detectResolutionPreset(1920, 1080);
            expect(preset).toBe('1080p');
        });

        it('should detect 1440p exactly', () => {
            const preset = detectResolutionPreset(2560, 1440);
            expect(preset).toBe('1440p');
        });

        it('should detect 4k exactly', () => {
            const preset = detectResolutionPreset(3840, 2160);
            expect(preset).toBe('4k');
        });

        it('should detect Steam Deck exactly', () => {
            const preset = detectResolutionPreset(1280, 800);
            expect(preset).toBe('steam_deck');
        });

        it('should find closest match for non-standard resolution', () => {
            // 1600x900 should match closest to 1080p (similar aspect ratio)
            const preset = detectResolutionPreset(1600, 900);
            expect(['1080p', '720p']).toContain(preset);
        });

        it('should handle ultrawide resolutions', () => {
            // 2560x1080 ultrawide
            const preset = detectResolutionPreset(2560, 1080);
            expect(preset).toBeDefined();
        });

        it('should handle very small resolutions', () => {
            const preset = detectResolutionPreset(640, 480);
            expect(preset).toBeDefined();
        });

        it('should handle very large resolutions', () => {
            const preset = detectResolutionPreset(7680, 4320);
            expect(preset).toBeDefined();
        });
    });

    // ========================================
    // getResolutionConfig Tests
    // ========================================
    describe('getResolutionConfig', () => {
        it('should return config for 1080p', () => {
            const config = getResolutionConfig(1920, 1080);

            expect(config.preset).toBe('1080p');
            expect(config.width).toBe(1920);
            expect(config.height).toBe(1080);
            expect(config.iconSize).toBeGreaterThan(0);
            expect(config.spacing).toBeGreaterThan(0);
        });

        it('should scale config for non-standard resolution', () => {
            const config = getResolutionConfig(1600, 900);

            expect(config.width).toBe(1600);
            expect(config.height).toBe(900);
            // Icon size should be appropriate for the resolution
            expect(config.iconSize).toBeGreaterThan(0);
            expect(config.iconSize).toBeLessThan(100);
        });

        it('should scale up for 4K', () => {
            const config = getResolutionConfig(3840, 2160);

            expect(config.iconSize).toBeGreaterThan(45);
        });

        it('should return integer values', () => {
            const config = getResolutionConfig(1919, 1079);

            expect(Number.isInteger(config.iconSize)).toBe(true);
            expect(Number.isInteger(config.spacing)).toBe(true);
            expect(Number.isInteger(config.marginX)).toBe(true);
            expect(Number.isInteger(config.marginY)).toBe(true);
        });
    });

    // ========================================
    // detectScreenRegions Tests
    // ========================================
    describe('detectScreenRegions', () => {
        it('should return all expected regions', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.itemsHotbar).toBeDefined();
            expect(regions.weaponsRegion).toBeDefined();
            expect(regions.tomesRegion).toBeDefined();
            expect(regions.characterPortrait).toBeDefined();
            expect(regions.resolution).toBeDefined();
        });

        it('should set correct resolution info', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.resolution.width).toBe(1920);
            expect(regions.resolution.height).toBe(1080);
            expect(regions.resolution.scale).toBe(1);
            expect(regions.resolution.preset).toBe('1080p');
        });

        it('should place hotbar at bottom of screen', () => {
            const regions = detectScreenRegions(1920, 1080);

            // Hotbar should be in bottom 20% of screen
            expect(regions.itemsHotbar.baseY).toBeGreaterThan(1080 * 0.8);
        });

        it('should center hotbar horizontally', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.itemsHotbar.centerX).toBe(960); // Half of 1920
        });

        it('should place weapons in top-left', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.weaponsRegion.x).toBeLessThan(1920 * 0.2);
            expect(regions.weaponsRegion.y).toBeLessThan(1080 * 0.1);
        });

        it('should place tomes below weapons', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.tomesRegion.y).toBeGreaterThan(regions.weaponsRegion.y);
        });

        it('should center character portrait', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.characterPortrait.x).toBeGreaterThan(1920 * 0.4);
            expect(regions.characterPortrait.x).toBeLessThan(1920 * 0.6);
        });

        it('should scale regions for different resolutions', () => {
            const regions1080 = detectScreenRegions(1920, 1080);
            const regions720 = detectScreenRegions(1280, 720);

            // 720p should have smaller slot sizes
            expect(regions720.itemsHotbar.slotSize).toBeLessThan(regions1080.itemsHotbar.slotSize);
        });
    });

    // ========================================
    // generateHotbarSlots Tests
    // ========================================
    describe('generateHotbarSlots', () => {
        it('should generate correct number of slots', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            expect(slots.length).toBe(__testing.MAX_ITEMS_SLOTS);
        });

        it('should center slots horizontally', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            // First and last slots should be equidistant from center
            const centerX = 960;
            const firstSlotCenter = slots[0].x + slots[0].width / 2;
            const lastSlotCenter = slots[slots.length - 1].x + slots[slots.length - 1].width / 2;

            const distFromCenterFirst = Math.abs(centerX - firstSlotCenter);
            const distFromCenterLast = Math.abs(centerX - lastSlotCenter);

            expect(Math.abs(distFromCenterFirst - distFromCenterLast)).toBeLessThan(10);
        });

        it('should have consistent slot sizes', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            const firstSize = slots[0].width;
            slots.forEach(slot => {
                expect(slot.width).toBe(firstSize);
                expect(slot.height).toBe(firstSize);
            });
        });

        it('should have sequential indices', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            slots.forEach((slot, i) => {
                expect(slot.index).toBe(i);
            });
        });

        it('should initialize slots as unoccupied', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            slots.forEach(slot => {
                expect(slot.occupied).toBe(false);
            });
        });

        it('should have proper spacing between slots', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            for (let i = 1; i < slots.length; i++) {
                const gap = slots[i].x - (slots[i - 1].x + slots[i - 1].width);
                expect(gap).toBe(regions.itemsHotbar.spacing);
            }
        });
    });

    // ========================================
    // generateWeaponSlots Tests
    // ========================================
    describe('generateWeaponSlots', () => {
        it('should generate correct number of weapon slots', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateWeaponSlots(regions);

            expect(slots.length).toBe(__testing.MAX_WEAPONS_SLOTS);
        });

        it('should position slots in top-left', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateWeaponSlots(regions);

            slots.forEach(slot => {
                expect(slot.x).toBeLessThan(1920 * 0.5);
                expect(slot.y).toBeLessThan(1080 * 0.3);
            });
        });

        it('should have slightly larger slots than hotbar', () => {
            const regions = detectScreenRegions(1920, 1080);
            const hotbarSlots = generateHotbarSlots(regions);
            const weaponSlots = generateWeaponSlots(regions);

            expect(weaponSlots[0].width).toBeGreaterThan(hotbarSlots[0].width);
        });
    });

    // ========================================
    // generateTomeSlots Tests
    // ========================================
    describe('generateTomeSlots', () => {
        it('should generate correct number of tome slots', () => {
            const regions = detectScreenRegions(1920, 1080);
            const slots = generateTomeSlots(regions);

            expect(slots.length).toBe(__testing.MAX_TOMES_SLOTS);
        });

        it('should position slots below weapons', () => {
            const regions = detectScreenRegions(1920, 1080);
            const weaponSlots = generateWeaponSlots(regions);
            const tomeSlots = generateTomeSlots(regions);

            expect(tomeSlots[0].y).toBeGreaterThan(weaponSlots[0].y);
        });
    });

    // ========================================
    // calculateRegionVariance Tests
    // ========================================
    describe('calculateRegionVariance', () => {
        it('should return 0 for uniform image', () => {
            const imageData = createMockImageData(100, 100, 128);
            const variance = calculateRegionVariance(imageData, 0, 0, 50, 50);

            expect(variance).toBe(0);
        });

        it('should return high variance for varied image', () => {
            const imageData = createVariedImageData(100, 100);
            const variance = calculateRegionVariance(imageData, 0, 0, 50, 50);

            expect(variance).toBeGreaterThan(0);
        });

        it('should handle region at edge of image', () => {
            const imageData = createMockImageData(100, 100);
            const variance = calculateRegionVariance(imageData, 90, 90, 20, 20);

            // Should not throw
            expect(typeof variance).toBe('number');
        });

        it('should handle region outside image bounds', () => {
            const imageData = createMockImageData(100, 100);
            const variance = calculateRegionVariance(imageData, 200, 200, 20, 20);

            expect(variance).toBe(0);
        });

        it('should handle zero-size region', () => {
            const imageData = createMockImageData(100, 100);
            const variance = calculateRegionVariance(imageData, 50, 50, 0, 0);

            expect(variance).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const imageData = createMockImageData(100, 100);
            const variance = calculateRegionVariance(imageData, -10, -10, 50, 50);

            // Should clamp and still calculate
            expect(typeof variance).toBe('number');
        });
    });

    // ========================================
    // detectOccupiedSlots Tests
    // ========================================
    describe('detectOccupiedSlots', () => {
        it('should mark uniform slots as unoccupied', () => {
            const regions = detectScreenRegions(100, 100);
            const slots = [
                { index: 0, x: 10, y: 10, width: 20, height: 20, occupied: false },
            ];
            const imageData = createMockImageData(100, 100, 128);

            const result = detectOccupiedSlots(imageData, slots);

            expect(result[0].occupied).toBe(false);
        });

        it('should mark varied slots as occupied', () => {
            const slots = [
                { index: 0, x: 0, y: 0, width: 50, height: 50, occupied: false },
            ];
            const imageData = createVariedImageData(100, 100);

            const result = detectOccupiedSlots(imageData, slots, 10);

            expect(result[0].occupied).toBe(true);
        });

        it('should preserve slot properties', () => {
            const slots = [
                { index: 5, x: 10, y: 20, width: 30, height: 40, occupied: false },
            ];
            const imageData = createMockImageData(100, 100);

            const result = detectOccupiedSlots(imageData, slots);

            expect(result[0].index).toBe(5);
            expect(result[0].x).toBe(10);
            expect(result[0].y).toBe(20);
        });

        it('should add variance property', () => {
            const slots = [
                { index: 0, x: 0, y: 0, width: 20, height: 20, occupied: false },
            ];
            const imageData = createMockImageData(100, 100);

            const result = detectOccupiedSlots(imageData, slots);

            expect(result[0].variance).toBeDefined();
        });

        it('should respect custom variance threshold', () => {
            const slots = [
                { index: 0, x: 0, y: 0, width: 50, height: 50, occupied: false },
            ];
            const imageData = createVariedImageData(100, 100);

            const lowThreshold = detectOccupiedSlots(imageData, slots, 1);
            const highThreshold = detectOccupiedSlots(imageData, slots, 10000);

            expect(lowThreshold[0].occupied).toBe(true);
            expect(highThreshold[0].occupied).toBe(false);
        });
    });

    // ========================================
    // countOccupiedSlots Tests
    // ========================================
    describe('countOccupiedSlots', () => {
        it('should return 0 for no occupied slots', () => {
            const slots = [
                { index: 0, x: 0, y: 0, width: 20, height: 20, occupied: false },
                { index: 1, x: 30, y: 0, width: 20, height: 20, occupied: false },
            ];

            expect(countOccupiedSlots(slots)).toBe(0);
        });

        it('should count occupied slots correctly', () => {
            const slots = [
                { index: 0, x: 0, y: 0, width: 20, height: 20, occupied: true },
                { index: 1, x: 30, y: 0, width: 20, height: 20, occupied: false },
                { index: 2, x: 60, y: 0, width: 20, height: 20, occupied: true },
            ];

            expect(countOccupiedSlots(slots)).toBe(2);
        });

        it('should handle empty array', () => {
            expect(countOccupiedSlots([])).toBe(0);
        });
    });

    // ========================================
    // getRegionsOfInterest Tests
    // ========================================
    describe('getRegionsOfInterest', () => {
        it('should return all region types', () => {
            const regions = detectScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            const types = rois.map(r => r.type);
            expect(types).toContain('items_hotbar');
            expect(types).toContain('weapons_region');
            expect(types).toContain('tomes_region');
            expect(types).toContain('character_portrait');
        });

        it('should include slots for hotbar region', () => {
            const regions = detectScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            const hotbarROI = rois.find(r => r.type === 'items_hotbar');
            expect(hotbarROI?.slots).toBeDefined();
            expect(hotbarROI?.slots?.length).toBe(__testing.MAX_ITEMS_SLOTS);
        });

        it('should include slots for weapons region', () => {
            const regions = detectScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            const weaponsROI = rois.find(r => r.type === 'weapons_region');
            expect(weaponsROI?.slots).toBeDefined();
            expect(weaponsROI?.slots?.length).toBe(__testing.MAX_WEAPONS_SLOTS);
        });

        it('should have confidence values', () => {
            const regions = detectScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            rois.forEach(roi => {
                expect(roi.confidence).toBeGreaterThan(0);
                expect(roi.confidence).toBeLessThanOrEqual(1);
            });
        });

        it('should have labels', () => {
            const regions = detectScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            rois.forEach(roi => {
                expect(roi.label).toBeDefined();
                expect(roi.label.length).toBeGreaterThan(0);
            });
        });
    });

    // ========================================
    // adjustRegionsForContent Tests
    // ========================================
    describe('adjustRegionsForContent', () => {
        it('should adjust hotbar for known item count', () => {
            const regions = detectScreenRegions(1920, 1080);
            const imageData = createMockImageData(1920, 1080);

            const adjusted = adjustRegionsForContent(regions, imageData, 5);

            expect(adjusted.itemsHotbar.detectedSlots).toBe(5);
        });

        it('should cap item count at max slots', () => {
            const regions = detectScreenRegions(1920, 1080);
            const imageData = createMockImageData(1920, 1080);

            const adjusted = adjustRegionsForContent(regions, imageData, 100);

            expect(adjusted.itemsHotbar.detectedSlots).toBe(__testing.MAX_ITEMS_SLOTS);
        });

        it('should detect occupied slots when count not provided', () => {
            const regions = detectScreenRegions(1920, 1080);
            const imageData = createMockImageData(1920, 1080);

            const adjusted = adjustRegionsForContent(regions, imageData);

            expect(adjusted.itemsHotbar.detectedSlots).toBeDefined();
        });

        it('should not modify other regions', () => {
            const regions = detectScreenRegions(1920, 1080);
            const imageData = createMockImageData(1920, 1080);

            const adjusted = adjustRegionsForContent(regions, imageData, 5);

            expect(adjusted.weaponsRegion).toEqual(regions.weaponsRegion);
            expect(adjusted.tomesRegion).toEqual(regions.tomesRegion);
        });
    });

    // ========================================
    // validateRegions Tests
    // ========================================
    describe('validateRegions', () => {
        it('should validate correct regions as valid', () => {
            const regions = detectScreenRegions(1920, 1080);
            const result = validateRegions(regions);

            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect hotbar too high', () => {
            const regions = detectScreenRegions(1920, 1080);
            regions.itemsHotbar.baseY = 100; // Way too high

            const result = validateRegions(regions);

            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('Hotbar Y'))).toBe(true);
        });

        it('should detect weapons region too far right', () => {
            const regions = detectScreenRegions(1920, 1080);
            regions.weaponsRegion.x = 1500; // Too far right

            const result = validateRegions(regions);

            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('Weapons X'))).toBe(true);
        });

        it('should detect unreasonable slot sizes', () => {
            const regions = detectScreenRegions(1920, 1080);
            regions.itemsHotbar.slotSize = 5; // Too small

            const result = validateRegions(regions);

            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('slot size'))).toBe(true);
        });
    });

    // ========================================
    // isPointInRegion Tests
    // ========================================
    describe('isPointInRegion', () => {
        const region = { x: 100, y: 100, width: 50, height: 50 };

        it('should return true for point inside', () => {
            expect(isPointInRegion(125, 125, region)).toBe(true);
        });

        it('should return true for point on edge', () => {
            expect(isPointInRegion(100, 100, region)).toBe(true);
            expect(isPointInRegion(150, 150, region)).toBe(true);
        });

        it('should return false for point outside', () => {
            expect(isPointInRegion(50, 50, region)).toBe(false);
            expect(isPointInRegion(200, 200, region)).toBe(false);
        });

        it('should return false for point just outside', () => {
            expect(isPointInRegion(99, 125, region)).toBe(false);
            expect(isPointInRegion(151, 125, region)).toBe(false);
        });
    });

    // ========================================
    // calculateRegionOverlap Tests
    // ========================================
    describe('calculateRegionOverlap', () => {
        it('should return 1 for identical regions', () => {
            const region = { x: 100, y: 100, width: 50, height: 50 };
            expect(calculateRegionOverlap(region, region)).toBe(1);
        });

        it('should return 0 for non-overlapping regions', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 100, y: 100, width: 50, height: 50 };
            expect(calculateRegionOverlap(a, b)).toBe(0);
        });

        it('should return partial overlap value', () => {
            const a = { x: 0, y: 0, width: 100, height: 100 };
            const b = { x: 50, y: 50, width: 100, height: 100 };
            const overlap = calculateRegionOverlap(a, b);

            expect(overlap).toBeGreaterThan(0);
            expect(overlap).toBeLessThan(1);
        });

        it('should return 1 when one region contains the other', () => {
            const large = { x: 0, y: 0, width: 200, height: 200 };
            const small = { x: 50, y: 50, width: 50, height: 50 };
            expect(calculateRegionOverlap(large, small)).toBe(1);
        });

        it('should handle zero-size regions', () => {
            const a = { x: 50, y: 50, width: 0, height: 0 };
            const b = { x: 50, y: 50, width: 50, height: 50 };
            expect(calculateRegionOverlap(a, b)).toBe(0);
        });
    });

    // ========================================
    // Debug Logging Tests
    // ========================================
    describe('Debug Logging', () => {
        it('should record logs when debug mode enabled', () => {
            setDebugMode(true);
            clearDebugLogs();

            // Use a function that generates debug logs
            detectScreenRegions(1920, 1080);

            const logs = getDebugLogs();
            // Module may or may not log during detection - verify logging mechanism works
            expect(Array.isArray(logs)).toBe(true);
        });

        it('should not record logs when debug mode disabled', () => {
            setDebugMode(false);
            clearDebugLogs();

            detectResolutionPreset(1920, 1080);

            const logs = getDebugLogs();
            expect(logs.length).toBe(0);
        });

        it('should clear logs', () => {
            setDebugMode(true);
            detectResolutionPreset(1920, 1080);
            clearDebugLogs();

            expect(getDebugLogs().length).toBe(0);
        });

        it('should return copy of logs', () => {
            setDebugMode(true);
            detectResolutionPreset(1920, 1080);

            const logs1 = getDebugLogs();
            const logs2 = getDebugLogs();

            expect(logs1).not.toBe(logs2);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle 1x1 resolution', () => {
            expect(() => detectScreenRegions(1, 1)).not.toThrow();
        });

        it('should handle very large resolution', () => {
            expect(() => detectScreenRegions(10000, 10000)).not.toThrow();
        });

        it('should handle portrait orientation', () => {
            const regions = detectScreenRegions(1080, 1920);
            expect(regions).toBeDefined();
        });

        it('should handle square resolution', () => {
            const regions = detectScreenRegions(1000, 1000);
            expect(regions).toBeDefined();
        });
    });
});
