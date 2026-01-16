// ========================================
// Region Detector Unit Tests
// ========================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    initRegionDetector,
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
    validateRegions,
    isPointInRegion,
    calculateRegionOverlap,
    __testing,
} from '../../src/modules/region-detector';
import {
    RESOLUTION_TEST_CASES,
    REGION_BOUNDS_TEST_CASES,
    SLOT_VARIANCE_TEST_CASES,
    createMockScreenRegions,
    createMockSlots,
    createMockImageData,
    createMockSlotImageData,
} from '../fixtures/cv-test-fixtures';

describe('Region Detector', () => {
    beforeEach(() => {
        initRegionDetector({ debugMode: false });
    });

    // ========================================
    // Resolution Detection Tests
    // ========================================

    describe('detectResolutionPreset', () => {
        RESOLUTION_TEST_CASES.forEach((testCase) => {
            it(`should detect ${testCase.name} (${testCase.width}x${testCase.height})`, () => {
                const preset = detectResolutionPreset(testCase.width, testCase.height);
                expect(preset).toBe(testCase.expectedPreset);
            });
        });

        it('should handle unusual aspect ratios', () => {
            // 4:3 aspect ratio
            const preset = detectResolutionPreset(1600, 1200);
            expect(preset).toBeDefined();
        });

        it('should handle very small resolutions', () => {
            const preset = detectResolutionPreset(640, 480);
            expect(preset).toBeDefined();
        });

        it('should handle very large resolutions', () => {
            const preset = detectResolutionPreset(7680, 4320); // 8K
            expect(preset).toBe('4k'); // Should match closest
        });
    });

    describe('getResolutionConfig', () => {
        it('should return scaled icon size for 1080p', () => {
            const config = getResolutionConfig(1920, 1080);
            expect(config.iconSize).toBeGreaterThanOrEqual(42);
            expect(config.iconSize).toBeLessThanOrEqual(50);
        });

        it('should scale properly for different resolutions', () => {
            const config720 = getResolutionConfig(1280, 720);
            const config1080 = getResolutionConfig(1920, 1080);
            const config4k = getResolutionConfig(3840, 2160);

            expect(config720.iconSize).toBeLessThan(config1080.iconSize);
            expect(config1080.iconSize).toBeLessThan(config4k.iconSize);
        });

        it('should include all required properties', () => {
            const config = getResolutionConfig(1920, 1080);

            expect(config).toHaveProperty('preset');
            expect(config).toHaveProperty('width');
            expect(config).toHaveProperty('height');
            expect(config).toHaveProperty('iconSize');
            expect(config).toHaveProperty('spacing');
            expect(config).toHaveProperty('marginX');
            expect(config).toHaveProperty('marginY');
        });
    });

    // ========================================
    // Screen Region Detection Tests
    // ========================================

    describe('detectScreenRegions', () => {
        REGION_BOUNDS_TEST_CASES.forEach((testCase) => {
            it(`should position hotbar correctly for ${testCase.name}`, () => {
                const regions = detectScreenRegions(testCase.width, testCase.height);

                expect(regions.itemsHotbar.baseY).toBeGreaterThanOrEqual(testCase.expectedHotbarY.min);
                expect(regions.itemsHotbar.baseY).toBeLessThanOrEqual(testCase.expectedHotbarY.max);
            });

            it(`should position weapons region in top-left for ${testCase.name}`, () => {
                const regions = detectScreenRegions(testCase.width, testCase.height);

                expect(regions.weaponsRegion.x).toBeGreaterThanOrEqual(testCase.expectedWeaponsX.min);
                expect(regions.weaponsRegion.x).toBeLessThanOrEqual(testCase.expectedWeaponsX.max);
                expect(regions.weaponsRegion.y).toBeGreaterThanOrEqual(testCase.expectedWeaponsY.min);
                expect(regions.weaponsRegion.y).toBeLessThanOrEqual(testCase.expectedWeaponsY.max);
            });
        });

        it('should center hotbar horizontally', () => {
            const regions = detectScreenRegions(1920, 1080);
            expect(regions.itemsHotbar.centerX).toBe(960);
        });

        it('should position tomes below weapons', () => {
            const regions = detectScreenRegions(1920, 1080);
            expect(regions.tomesRegion.y).toBeGreaterThan(regions.weaponsRegion.y);
        });

        it('should include resolution info', () => {
            const regions = detectScreenRegions(1920, 1080);

            expect(regions.resolution.width).toBe(1920);
            expect(regions.resolution.height).toBe(1080);
            expect(regions.resolution.scale).toBe(1);
            expect(regions.resolution.preset).toBeDefined();
        });

        it('should handle edge case of very wide screens', () => {
            const regions = detectScreenRegions(3440, 1440);

            expect(regions.itemsHotbar.centerX).toBe(1720);
            expect(regions.itemsHotbar.baseY).toBeGreaterThan(1200);
        });
    });

    // ========================================
    // Slot Generation Tests
    // ========================================

    describe('generateHotbarSlots', () => {
        it('should generate correct number of slots', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            expect(slots.length).toBe(regions.itemsHotbar.maxSlots);
        });

        it('should center slots horizontally', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            const firstSlot = slots[0];
            const lastSlot = slots[slots.length - 1];
            const slotsCenter = (firstSlot.x + lastSlot.x + lastSlot.width) / 2;

            // Center should be approximately at screen center
            expect(Math.abs(slotsCenter - 960)).toBeLessThan(50);
        });

        it('should have correct slot dimensions', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            slots.forEach((slot) => {
                expect(slot.width).toBe(regions.itemsHotbar.slotSize);
                expect(slot.height).toBe(regions.itemsHotbar.slotSize);
            });
        });

        it('should have sequential indices', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            slots.forEach((slot, i) => {
                expect(slot.index).toBe(i);
            });
        });

        it('should not overlap slots', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateHotbarSlots(regions);

            for (let i = 0; i < slots.length - 1; i++) {
                const currentEnd = slots[i].x + slots[i].width;
                const nextStart = slots[i + 1].x;
                expect(nextStart).toBeGreaterThanOrEqual(currentEnd);
            }
        });
    });

    describe('generateWeaponSlots', () => {
        it('should generate slots in top-left region', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateWeaponSlots(regions);

            slots.forEach((slot) => {
                expect(slot.x).toBeLessThan(regions.resolution.width * 0.3);
                expect(slot.y).toBeLessThan(regions.resolution.height * 0.2);
            });
        });

        it('should generate correct grid layout', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const slots = generateWeaponSlots(regions);

            expect(slots.length).toBe(regions.weaponsRegion.rows * regions.weaponsRegion.cols);
        });
    });

    describe('generateTomeSlots', () => {
        it('should generate slots below weapons', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const weaponSlots = generateWeaponSlots(regions);
            const tomeSlots = generateTomeSlots(regions);

            const maxWeaponY = Math.max(...weaponSlots.map((s) => s.y + s.height));
            const minTomeY = Math.min(...tomeSlots.map((s) => s.y));

            expect(minTomeY).toBeGreaterThan(maxWeaponY);
        });
    });

    // ========================================
    // Variance & Occupancy Detection Tests
    // ========================================

    describe('calculateRegionVariance', () => {
        it('should return low variance for uniform color', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const variance = calculateRegionVariance(imageData, 10, 10, 30, 30);

            expect(variance).toBeLessThan(1);
        });

        it('should return high variance for random pattern', () => {
            const imageData = createMockImageData(100, 100, 'random');
            const variance = calculateRegionVariance(imageData, 10, 10, 30, 30);

            expect(variance).toBeGreaterThan(100);
        });

        it('should return moderate variance for gradient', () => {
            const imageData = createMockImageData(100, 100, 'gradient');
            const variance = calculateRegionVariance(imageData, 10, 10, 30, 30);

            expect(variance).toBeGreaterThan(0);
            expect(variance).toBeLessThan(5000);
        });

        it('should handle region at image boundary', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const variance = calculateRegionVariance(imageData, 90, 90, 30, 30);

            // Should not throw, should clamp to image bounds
            expect(variance).toBeDefined();
        });

        it('should handle zero-size region', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const variance = calculateRegionVariance(imageData, 10, 10, 0, 0);

            expect(variance).toBe(0);
        });
    });

    describe('detectOccupiedSlots', () => {
        it('should mark high-variance slots as occupied', () => {
            const imageData = createMockSlotImageData(200, 100, 50, 10, 45, 45, true);
            const slots = createMockSlots(3);
            slots[1].x = 50;
            slots[1].y = 10;

            const detected = detectOccupiedSlots(imageData, slots, 30);

            expect(detected[1].occupied).toBe(true);
        });

        it('should mark low-variance slots as empty', () => {
            const imageData = createMockSlotImageData(200, 100, 50, 10, 45, 45, false);
            const slots = createMockSlots(3);
            slots[1].x = 50;
            slots[1].y = 10;

            const detected = detectOccupiedSlots(imageData, slots, 30);

            expect(detected[1].occupied).toBe(false);
        });

        it('should preserve slot metadata', () => {
            const imageData = createMockImageData(200, 100, 'uniform');
            const slots = createMockSlots(3);

            const detected = detectOccupiedSlots(imageData, slots);

            detected.forEach((slot, i) => {
                expect(slot.index).toBe(slots[i].index);
                expect(slot.width).toBe(slots[i].width);
                expect(slot.height).toBe(slots[i].height);
            });
        });

        it('should add variance property to detected slots', () => {
            const imageData = createMockImageData(200, 100, 'uniform');
            const slots = createMockSlots(3);

            const detected = detectOccupiedSlots(imageData, slots);

            detected.forEach((slot) => {
                expect(slot.variance).toBeDefined();
                expect(typeof slot.variance).toBe('number');
            });
        });
    });

    describe('countOccupiedSlots', () => {
        it('should count correctly', () => {
            const slots = createMockSlots(5, [true, false, true, true, false]);
            expect(countOccupiedSlots(slots)).toBe(3);
        });

        it('should return 0 for all empty', () => {
            const slots = createMockSlots(5, [false, false, false, false, false]);
            expect(countOccupiedSlots(slots)).toBe(0);
        });

        it('should return full count for all occupied', () => {
            const slots = createMockSlots(5, [true, true, true, true, true]);
            expect(countOccupiedSlots(slots)).toBe(5);
        });
    });

    // ========================================
    // Region of Interest Tests
    // ========================================

    describe('getRegionsOfInterest', () => {
        it('should return all region types', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            const types = rois.map((r) => r.type);
            expect(types).toContain('items_hotbar');
            expect(types).toContain('weapons_region');
            expect(types).toContain('tomes_region');
            expect(types).toContain('character_portrait');
        });

        it('should include slots for grid regions', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            const itemsRegion = rois.find((r) => r.type === 'items_hotbar');
            const weaponsRegion = rois.find((r) => r.type === 'weapons_region');
            const tomesRegion = rois.find((r) => r.type === 'tomes_region');

            expect(itemsRegion?.slots).toBeDefined();
            expect(itemsRegion?.slots?.length).toBeGreaterThan(0);
            expect(weaponsRegion?.slots).toBeDefined();
            expect(tomesRegion?.slots).toBeDefined();
        });

        it('should have confidence values', () => {
            const regions = createMockScreenRegions(1920, 1080);
            const rois = getRegionsOfInterest(regions);

            rois.forEach((roi) => {
                expect(roi.confidence).toBeGreaterThan(0);
                expect(roi.confidence).toBeLessThanOrEqual(1);
            });
        });
    });

    // ========================================
    // Validation Tests
    // ========================================

    describe('validateRegions', () => {
        it('should pass for valid 1080p regions', () => {
            const regions = detectScreenRegions(1920, 1080);
            const result = validateRegions(regions);

            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should pass for valid 720p regions', () => {
            const regions = detectScreenRegions(1280, 720);
            const result = validateRegions(regions);

            expect(result.valid).toBe(true);
        });

        it('should pass for valid 4K regions', () => {
            const regions = detectScreenRegions(3840, 2160);
            const result = validateRegions(regions);

            expect(result.valid).toBe(true);
        });

        it('should detect invalid hotbar position', () => {
            const regions = createMockScreenRegions(1920, 1080);
            regions.itemsHotbar.baseY = 100; // Way too high

            const result = validateRegions(regions);

            expect(result.valid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should detect invalid slot sizes', () => {
            const regions = createMockScreenRegions(1920, 1080);
            regions.itemsHotbar.slotSize = 10; // Too small

            const result = validateRegions(regions);

            expect(result.valid).toBe(false);
        });
    });

    // ========================================
    // Geometry Helper Tests
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
    });

    describe('calculateRegionOverlap', () => {
        it('should return 1 for identical regions', () => {
            const region = { x: 0, y: 0, width: 100, height: 100 };
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

        it('should handle contained region', () => {
            const outer = { x: 0, y: 0, width: 100, height: 100 };
            const inner = { x: 25, y: 25, width: 50, height: 50 };

            expect(calculateRegionOverlap(outer, inner)).toBe(1);
        });
    });

    // ========================================
    // Configuration Tests
    // ========================================

    describe('configuration', () => {
        it('should expose internal constants for testing', () => {
            expect(__testing.HOTBAR_Y_PERCENT_MIN).toBeDefined();
            expect(__testing.HOTBAR_Y_PERCENT_MAX).toBeDefined();
            expect(__testing.MAX_ITEMS_SLOTS).toBeDefined();
            expect(__testing.MAX_WEAPONS_SLOTS).toBeDefined();
            expect(__testing.MAX_TOMES_SLOTS).toBeDefined();
        });

        it('should have reasonable default slot counts', () => {
            expect(__testing.MAX_ITEMS_SLOTS).toBeGreaterThanOrEqual(10);
            expect(__testing.MAX_ITEMS_SLOTS).toBeLessThanOrEqual(15);
            expect(__testing.MAX_WEAPONS_SLOTS).toBeGreaterThanOrEqual(4);
            expect(__testing.MAX_TOMES_SLOTS).toBeGreaterThanOrEqual(4);
        });
    });
});
