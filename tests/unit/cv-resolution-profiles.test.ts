/**
 * CV Resolution Profiles Module Tests
 * 
 * Tests the resolution-adaptive strategy profiles for detection
 */

import { describe, it, expect } from 'vitest';

import {
    getResolutionTier,
    getProfileForResolution,
    getClosestPreset,
    getScaleFromBase,
    scaleValue,
    getExpectedIconSize,
    getExpectedCellStride,
    interpolateProfile,
    getTemplateScales,
    describeResolution,
    validateIconSize,
    getHotbarScanRegion,
    getCountTextRegion,
    RESOLUTION_PRESETS,
    LOW_RES_PROFILE,
    MEDIUM_RES_PROFILE,
    HIGH_RES_PROFILE,
    ULTRA_RES_PROFILE,
    STRATEGY_PROFILES,
    type ResolutionTier,
} from '../../src/modules/cv/resolution-profiles.ts';

describe('CV Resolution Profiles Module', () => {
    describe('Profile Constants', () => {
        it('RESOLUTION_PRESETS should contain common resolutions', () => {
            expect(RESOLUTION_PRESETS.length).toBeGreaterThanOrEqual(6);
            
            const names = RESOLUTION_PRESETS.map(p => p.name);
            expect(names).toContain('720p');
            expect(names).toContain('1080p');
            expect(names).toContain('1440p');
            expect(names).toContain('4K');
        });

        it('Each preset should have required properties', () => {
            for (const preset of RESOLUTION_PRESETS) {
                expect(preset.width).toBeGreaterThan(0);
                expect(preset.height).toBeGreaterThan(0);
                expect(preset.name).toBeTruthy();
                expect(['low', 'medium', 'high', 'ultra']).toContain(preset.tier);
                expect(preset.aspectRatio).toMatch(/\d+:\d+/);
            }
        });

        it('STRATEGY_PROFILES should have all tiers', () => {
            expect(STRATEGY_PROFILES.low).toBeDefined();
            expect(STRATEGY_PROFILES.medium).toBeDefined();
            expect(STRATEGY_PROFILES.high).toBeDefined();
            expect(STRATEGY_PROFILES.ultra).toBeDefined();
        });

        it('Profile icon sizes should scale with resolution tier', () => {
            expect(LOW_RES_PROFILE.iconSize.typical).toBeLessThan(MEDIUM_RES_PROFILE.iconSize.typical);
            expect(MEDIUM_RES_PROFILE.iconSize.typical).toBeLessThan(HIGH_RES_PROFILE.iconSize.typical);
            expect(HIGH_RES_PROFILE.iconSize.typical).toBeLessThan(ULTRA_RES_PROFILE.iconSize.typical);
        });

        it('Profile scan steps should increase with resolution', () => {
            expect(LOW_RES_PROFILE.scanStep).toBeLessThanOrEqual(MEDIUM_RES_PROFILE.scanStep);
            expect(MEDIUM_RES_PROFILE.scanStep).toBeLessThanOrEqual(HIGH_RES_PROFILE.scanStep);
            expect(HIGH_RES_PROFILE.scanStep).toBeLessThanOrEqual(ULTRA_RES_PROFILE.scanStep);
        });
    });

    describe('getResolutionTier', () => {
        it('should return low for 720p', () => {
            expect(getResolutionTier(1280, 720)).toBe('low');
        });

        it('should return low for 768p', () => {
            expect(getResolutionTier(1366, 768)).toBe('low');
        });

        it('should return medium for 1080p', () => {
            expect(getResolutionTier(1920, 1080)).toBe('medium');
        });

        it('should return high for 1440p', () => {
            expect(getResolutionTier(2560, 1440)).toBe('high');
        });

        it('should return ultra for 4K', () => {
            expect(getResolutionTier(3840, 2160)).toBe('ultra');
        });

        it('should handle boundary values', () => {
            expect(getResolutionTier(1280, 800)).toBe('low');
            expect(getResolutionTier(1920, 1200)).toBe('medium');
            expect(getResolutionTier(2560, 1800)).toBe('high');
        });
    });

    describe('getProfileForResolution', () => {
        it('should return correct profile for 720p', () => {
            const profile = getProfileForResolution(1280, 720);
            expect(profile.tier).toBe('low');
        });

        it('should return correct profile for 1080p', () => {
            const profile = getProfileForResolution(1920, 1080);
            expect(profile.tier).toBe('medium');
        });

        it('should return correct profile for 4K', () => {
            const profile = getProfileForResolution(3840, 2160);
            expect(profile.tier).toBe('ultra');
        });

        it('returned profile should have all required fields', () => {
            const profile = getProfileForResolution(1920, 1080);
            expect(profile.tier).toBeDefined();
            expect(profile.name).toBeDefined();
            expect(profile.iconSize).toBeDefined();
            expect(profile.spacing).toBeDefined();
            expect(profile.templateScales).toBeDefined();
            expect(profile.minConfidence).toBeDefined();
        });
    });

    describe('getClosestPreset', () => {
        it('should find exact match for 1080p', () => {
            const preset = getClosestPreset(1920, 1080);
            expect(preset?.name).toBe('1080p');
        });

        it('should find closest preset for non-standard resolution', () => {
            const preset = getClosestPreset(1900, 1070);
            expect(preset).not.toBeNull();
            expect(preset!.name).toBe('1080p');
        });

        it('should return a preset for any resolution', () => {
            const preset = getClosestPreset(1234, 567);
            expect(preset).not.toBeNull();
        });

        it('should find ultrawide resolutions', () => {
            const preset = getClosestPreset(3440, 1440);
            expect(preset?.aspectRatio).toBe('21:9');
        });
    });

    describe('getScaleFromBase', () => {
        it('should return 1 for 720p base', () => {
            expect(getScaleFromBase(720)).toBe(1);
        });

        it('should return 1.5 for 1080p', () => {
            expect(getScaleFromBase(1080)).toBe(1.5);
        });

        it('should return 2 for 1440p', () => {
            expect(getScaleFromBase(1440)).toBe(2);
        });

        it('should return 3 for 4K', () => {
            expect(getScaleFromBase(2160)).toBe(3);
        });

        it('should accept custom base height', () => {
            expect(getScaleFromBase(2160, 1080)).toBe(2);
        });
    });

    describe('scaleValue', () => {
        it('should scale value from 720p to 1080p', () => {
            const scaled = scaleValue(10, 1080, 720);
            expect(scaled).toBe(15); // 10 * 1.5
        });

        it('should scale value from 720p to 4K', () => {
            const scaled = scaleValue(10, 2160, 720);
            expect(scaled).toBe(30); // 10 * 3
        });

        it('should round to nearest integer', () => {
            const scaled = scaleValue(7, 1080, 720);
            expect(Number.isInteger(scaled)).toBe(true);
        });
    });

    describe('getExpectedIconSize', () => {
        it('should return icon size range for 720p', () => {
            const size = getExpectedIconSize(720);
            expect(size.min).toBeLessThan(size.max);
            expect(size.typical).toBeGreaterThanOrEqual(size.min);
            expect(size.typical).toBeLessThanOrEqual(size.max);
        });

        it('should return larger icons for higher resolutions', () => {
            const size720 = getExpectedIconSize(720);
            const size1080 = getExpectedIconSize(1080);
            const size2160 = getExpectedIconSize(2160);
            
            expect(size720.typical).toBeLessThan(size1080.typical);
            expect(size1080.typical).toBeLessThan(size2160.typical);
        });
    });

    describe('getExpectedCellStride', () => {
        it('should return positive stride', () => {
            const stride = getExpectedCellStride(1080);
            expect(stride).toBeGreaterThan(0);
        });

        it('should be larger than icon size', () => {
            const stride = getExpectedCellStride(1080);
            const iconSize = getExpectedIconSize(1080);
            expect(stride).toBeGreaterThan(iconSize.typical);
        });
    });

    describe('interpolateProfile', () => {
        it('should return base profile for resolutions within tier', () => {
            const profile = interpolateProfile(1920, 1080);
            expect(profile.tier).toBe('medium');
        });

        it('should interpolate at tier boundaries', () => {
            const profile750 = interpolateProfile(1333, 750);
            const profile850 = interpolateProfile(1511, 850);
            
            // At 750, should be closer to low
            // At 850, should be transitioning to medium
            expect(profile750.iconSize.typical).toBeLessThanOrEqual(profile850.iconSize.typical);
        });

        it('should blend icon sizes at boundary', () => {
            const lowProfile = STRATEGY_PROFILES.low;
            const medProfile = STRATEGY_PROFILES.medium;
            const interpolated = interpolateProfile(1422, 800);
            
            // Should be between low and medium
            expect(interpolated.iconSize.typical).toBeGreaterThanOrEqual(lowProfile.iconSize.typical);
            expect(interpolated.iconSize.typical).toBeLessThanOrEqual(medProfile.iconSize.typical);
        });
    });

    describe('getTemplateScales', () => {
        it('should return array of scales', () => {
            const scales = getTemplateScales(1080);
            expect(Array.isArray(scales)).toBe(true);
            expect(scales.length).toBeGreaterThan(0);
        });

        it('should return scales around 1.0 for medium resolution', () => {
            const scales = getTemplateScales(1080);
            expect(scales.some(s => s >= 0.9 && s <= 1.1)).toBe(true);
        });

        it('should return larger scales for 4K', () => {
            const scales1080 = getTemplateScales(1080);
            const scales4K = getTemplateScales(2160);
            
            const max1080 = Math.max(...scales1080);
            const max4K = Math.max(...scales4K);
            
            expect(max4K).toBeGreaterThan(max1080);
        });
    });

    describe('describeResolution', () => {
        it('should return description string', () => {
            const desc = describeResolution(1920, 1080);
            expect(typeof desc).toBe('string');
            expect(desc.length).toBeGreaterThan(0);
        });

        it('should include resolution dimensions', () => {
            const desc = describeResolution(1920, 1080);
            expect(desc).toContain('1920');
            expect(desc).toContain('1080');
        });

        it('should include preset name', () => {
            const desc = describeResolution(1920, 1080);
            expect(desc).toContain('1080p');
        });

        it('should include tier', () => {
            const desc = describeResolution(1920, 1080);
            expect(desc).toContain('medium');
        });
    });

    describe('validateIconSize', () => {
        it('should accept icon size within expected range', () => {
            const profile = getProfileForResolution(1920, 1080);
            const valid = validateIconSize(profile.iconSize.typical, 1080);
            expect(valid).toBe(true);
        });

        it('should accept icon size at min boundary', () => {
            const profile = getProfileForResolution(1920, 1080);
            const valid = validateIconSize(profile.iconSize.min, 1080);
            expect(valid).toBe(true);
        });

        it('should accept icon size at max boundary', () => {
            const profile = getProfileForResolution(1920, 1080);
            const valid = validateIconSize(profile.iconSize.max, 1080);
            expect(valid).toBe(true);
        });

        it('should reject very small icon size', () => {
            const valid = validateIconSize(5, 1080);
            expect(valid).toBe(false);
        });

        it('should reject very large icon size', () => {
            const valid = validateIconSize(500, 1080);
            expect(valid).toBe(false);
        });
    });

    describe('getHotbarScanRegion', () => {
        it('should return region in bottom portion of screen', () => {
            const region = getHotbarScanRegion(1920, 1080);
            expect(region.yStart).toBeGreaterThan(1080 * 0.5);
            expect(region.yEnd).toBeLessThanOrEqual(1080);
        });

        it('should exclude screen edges', () => {
            const region = getHotbarScanRegion(1920, 1080);
            expect(region.xStart).toBeGreaterThan(0);
            expect(region.xEnd).toBeLessThan(1920);
        });

        it('should return valid region coordinates', () => {
            const region = getHotbarScanRegion(1920, 1080);
            expect(region.xStart).toBeLessThan(region.xEnd);
            expect(region.yStart).toBeLessThan(region.yEnd);
        });

        it('should scale with resolution', () => {
            const region720 = getHotbarScanRegion(1280, 720);
            const region4K = getHotbarScanRegion(3840, 2160);
            
            expect(region4K.xEnd - region4K.xStart).toBeGreaterThan(region720.xEnd - region720.xStart);
        });
    });

    describe('getCountTextRegion', () => {
        it('should return region in bottom-right of cell by default', () => {
            const region = getCountTextRegion(100, 100, 50, 50, 1080);
            
            // Should be in bottom-right corner
            expect(region.x).toBeGreaterThan(100);
            expect(region.y).toBeGreaterThan(100);
        });

        it('should return valid region dimensions', () => {
            const region = getCountTextRegion(0, 0, 100, 100, 1080);
            
            expect(region.width).toBeGreaterThan(0);
            expect(region.height).toBeGreaterThan(0);
        });

        it('should scale text height with resolution', () => {
            const region720 = getCountTextRegion(0, 0, 50, 50, 720);
            const region4K = getCountTextRegion(0, 0, 100, 100, 2160);
            
            expect(region4K.height).toBeGreaterThan(region720.height);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very low resolution', () => {
            const tier = getResolutionTier(640, 480);
            expect(tier).toBe('low');
            
            const profile = getProfileForResolution(640, 480);
            expect(profile).toBeDefined();
        });

        it('should handle very high resolution', () => {
            const tier = getResolutionTier(7680, 4320); // 8K
            expect(tier).toBe('ultra');
            
            const profile = getProfileForResolution(7680, 4320);
            expect(profile).toBeDefined();
        });

        it('should handle square aspect ratio', () => {
            const profile = getProfileForResolution(1080, 1080);
            expect(profile).toBeDefined();
        });

        it('should handle portrait orientation', () => {
            const profile = getProfileForResolution(1080, 1920);
            expect(profile).toBeDefined();
        });
    });
});
