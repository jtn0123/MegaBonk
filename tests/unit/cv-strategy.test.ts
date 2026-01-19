/**
 * Tests for CV Strategy Configuration Module
 * Tests strategy management, color analysis, and feedback functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    STRATEGY_PRESETS,
    DEFAULT_STRATEGY,
    getActiveStrategy,
    setActiveStrategy,
    getConfidenceThresholds,
    rgbToHSV,
    getColorCategoryHSV,
    extractColorProfile,
    compareColorProfiles,
    recordCorrection,
    getSimilarityPenalty,
    clearFeedbackCorrections,
    getFeedbackCorrections,
    exportFeedbackCorrections,
    importFeedbackCorrections,
    type CVStrategy,
    type HSVColor,
    type ColorProfile,
} from '../../src/modules/cv-strategy.ts';

// ========================================
// Strategy Presets Tests
// ========================================

describe('CV Strategy Presets', () => {
    it('should have all required presets', () => {
        expect(STRATEGY_PRESETS).toHaveProperty('current');
        expect(STRATEGY_PRESETS).toHaveProperty('optimized');
        expect(STRATEGY_PRESETS).toHaveProperty('fast');
        expect(STRATEGY_PRESETS).toHaveProperty('accurate');
        expect(STRATEGY_PRESETS).toHaveProperty('balanced');
    });

    it('should have valid structure for each preset', () => {
        for (const [name, preset] of Object.entries(STRATEGY_PRESETS)) {
            expect(preset.colorFiltering).toMatch(/^(rarity-first|color-first|none)$/);
            expect(preset.colorAnalysis).toMatch(/^(single-dominant|multi-region|hsv-based)$/);
            expect(preset.confidenceThresholds).toMatch(/^(fixed|adaptive-rarity|adaptive-gap)$/);
            expect(preset.matchingAlgorithm).toMatch(/^(ncc|ssd|ssim)$/);
            expect(typeof preset.useContextBoosting).toBe('boolean');
            expect(typeof preset.useBorderValidation).toBe('boolean');
            expect(typeof preset.useFeedbackLoop).toBe('boolean');
            expect(typeof preset.useEmptyCellDetection).toBe('boolean');
            expect(typeof preset.multiPassEnabled).toBe('boolean');
        }
    });

    it('DEFAULT_STRATEGY should match current preset', () => {
        expect(DEFAULT_STRATEGY).toEqual(STRATEGY_PRESETS.current);
    });

    it('fast preset should have speed optimizations', () => {
        const fast = STRATEGY_PRESETS.fast;
        expect(fast.useContextBoosting).toBe(false);
        expect(fast.useBorderValidation).toBe(false);
        expect(fast.multiPassEnabled).toBe(false);
    });

    it('accurate preset should have accuracy optimizations', () => {
        const accurate = STRATEGY_PRESETS.accurate;
        expect(accurate.useContextBoosting).toBe(true);
        expect(accurate.useBorderValidation).toBe(true);
        expect(accurate.useFeedbackLoop).toBe(true);
        expect(accurate.multiPassEnabled).toBe(true);
    });
});

// ========================================
// Active Strategy Management Tests
// ========================================

describe('Active Strategy Management', () => {
    beforeEach(() => {
        setActiveStrategy('current');
    });

    it('should get default strategy initially', () => {
        const strategy = getActiveStrategy();
        expect(strategy).toEqual(STRATEGY_PRESETS.current);
    });

    it('should set strategy by name', () => {
        setActiveStrategy('fast');
        expect(getActiveStrategy()).toEqual(STRATEGY_PRESETS.fast);
    });

    it('should set strategy by object', () => {
        const customStrategy: CVStrategy = {
            ...STRATEGY_PRESETS.current,
            colorFiltering: 'none',
        };
        setActiveStrategy(customStrategy);
        expect(getActiveStrategy().colorFiltering).toBe('none');
    });

    it('should throw error for unknown preset name', () => {
        expect(() => setActiveStrategy('nonexistent')).toThrow('Unknown strategy preset');
    });

    it('should allow switching between presets', () => {
        setActiveStrategy('fast');
        expect(getActiveStrategy().multiPassEnabled).toBe(false);

        setActiveStrategy('accurate');
        expect(getActiveStrategy().multiPassEnabled).toBe(true);
    });

    it('should return a copy of the strategy (not reference)', () => {
        const strategy1 = getActiveStrategy();
        const strategy2 = getActiveStrategy();
        expect(strategy1).not.toBe(strategy2);
        expect(strategy1).toEqual(strategy2);
    });
});

// ========================================
// Confidence Thresholds Tests
// ========================================

describe('Confidence Thresholds', () => {
    it('should return thresholds for fixed strategy', () => {
        const strategy = STRATEGY_PRESETS.current;
        const thresholds = getConfidenceThresholds(strategy);

        expect(thresholds).toHaveProperty('pass1');
        expect(thresholds).toHaveProperty('pass2');
        expect(thresholds).toHaveProperty('pass3');
        expect(thresholds.pass1).toBeGreaterThan(thresholds.pass2);
        expect(thresholds.pass2).toBeGreaterThan(thresholds.pass3);
    });

    it('should return fixed thresholds without rarity', () => {
        const strategy = STRATEGY_PRESETS.current;
        const thresholds = getConfidenceThresholds(strategy);

        expect(thresholds.pass1).toBe(0.85);
        expect(thresholds.pass2).toBe(0.70);
        expect(thresholds.pass3).toBe(0.60);
    });

    it('should adjust thresholds for different rarities with adaptive-rarity', () => {
        const strategy: CVStrategy = { ...STRATEGY_PRESETS.optimized, confidenceThresholds: 'adaptive-rarity' };

        const legendaryThresholds = getConfidenceThresholds(strategy, 'legendary');
        const commonThresholds = getConfidenceThresholds(strategy, 'common');

        // Common items should have stricter (higher) thresholds - they look similar to each other
        // Legendary items can have lower thresholds - unique visuals make them easier to identify
        expect(commonThresholds.pass1).toBeGreaterThan(legendaryThresholds.pass1);
    });

    it('should handle undefined rarity with fallback', () => {
        const strategy = STRATEGY_PRESETS.current;
        const thresholds = getConfidenceThresholds(strategy, undefined);

        expect(thresholds).toBeDefined();
        expect(thresholds.pass1).toBeGreaterThan(0);
    });

    it('should return defaults for adaptive-gap strategy', () => {
        const strategy: CVStrategy = { ...STRATEGY_PRESETS.current, confidenceThresholds: 'adaptive-gap' };
        const thresholds = getConfidenceThresholds(strategy);

        expect(thresholds.pass1).toBe(0.85);
        expect(thresholds.pass2).toBe(0.70);
        expect(thresholds.pass3).toBe(0.60);
    });
});

// ========================================
// Color Conversion Tests
// ========================================

describe('RGB to HSV Conversion', () => {
    it('should convert pure red correctly', () => {
        const hsv = rgbToHSV(255, 0, 0);
        expect(hsv.h).toBeCloseTo(0, 0);
        expect(hsv.s).toBeCloseTo(100, 0);
        expect(hsv.v).toBeCloseTo(100, 0);
    });

    it('should convert pure green correctly', () => {
        const hsv = rgbToHSV(0, 255, 0);
        expect(hsv.h).toBeCloseTo(120, 0);
        expect(hsv.s).toBeCloseTo(100, 0);
        expect(hsv.v).toBeCloseTo(100, 0);
    });

    it('should convert pure blue correctly', () => {
        const hsv = rgbToHSV(0, 0, 255);
        expect(hsv.h).toBeCloseTo(240, 0);
        expect(hsv.s).toBeCloseTo(100, 0);
        expect(hsv.v).toBeCloseTo(100, 0);
    });

    it('should convert white correctly', () => {
        const hsv = rgbToHSV(255, 255, 255);
        expect(hsv.s).toBe(0);
        expect(hsv.v).toBeCloseTo(100, 0);
    });

    it('should convert black correctly', () => {
        const hsv = rgbToHSV(0, 0, 0);
        expect(hsv.v).toBe(0);
    });

    it('should convert gray correctly', () => {
        const hsv = rgbToHSV(128, 128, 128);
        expect(hsv.s).toBe(0);
        // 128/255 * 100 = 50.196...
        expect(hsv.v).toBeCloseTo(50, 0);
    });

    it('should convert purple correctly', () => {
        const hsv = rgbToHSV(128, 0, 128);
        expect(hsv.h).toBeCloseTo(300, 0);
        expect(hsv.s).toBeCloseTo(100, 0);
    });

    it('should convert orange correctly', () => {
        const hsv = rgbToHSV(255, 165, 0);
        expect(hsv.h).toBeGreaterThan(30);
        expect(hsv.h).toBeLessThan(50);
    });
});

// ========================================
// Color Category Tests
// ========================================

describe('Color Category Classification', () => {
    it('should classify red colors', () => {
        const redHSV: HSVColor = { h: 0, s: 100, v: 100 };
        expect(getColorCategoryHSV(redHSV)).toBe('red');
    });

    it('should classify orange colors', () => {
        const orangeHSV: HSVColor = { h: 45, s: 100, v: 100 };
        expect(getColorCategoryHSV(orangeHSV)).toBe('orange');
    });

    it('should classify yellow colors', () => {
        const yellowHSV: HSVColor = { h: 75, s: 100, v: 100 };
        expect(getColorCategoryHSV(yellowHSV)).toBe('yellow');
    });

    it('should classify green colors', () => {
        const greenHSV: HSVColor = { h: 120, s: 100, v: 100 };
        expect(getColorCategoryHSV(greenHSV)).toBe('green');
    });

    it('should classify blue colors', () => {
        const blueHSV: HSVColor = { h: 220, s: 100, v: 100 };
        expect(getColorCategoryHSV(blueHSV)).toBe('blue');
    });

    it('should classify purple colors', () => {
        const purpleHSV: HSVColor = { h: 280, s: 100, v: 100 };
        expect(getColorCategoryHSV(purpleHSV)).toBe('purple');
    });

    it('should classify low saturation as gray/white/black', () => {
        const grayHSV: HSVColor = { h: 0, s: 5, v: 50 };
        const category = getColorCategoryHSV(grayHSV);
        expect(['gray', 'white', 'black']).toContain(category);
    });

    it('should classify dark low saturation as black', () => {
        const blackHSV: HSVColor = { h: 0, s: 5, v: 10 };
        expect(getColorCategoryHSV(blackHSV)).toBe('black');
    });

    it('should classify bright low saturation as white', () => {
        const whiteHSV: HSVColor = { h: 0, s: 5, v: 90 };
        expect(getColorCategoryHSV(whiteHSV)).toBe('white');
    });

    it('should classify cyan colors', () => {
        const cyanHSV: HSVColor = { h: 170, s: 100, v: 100 };
        expect(getColorCategoryHSV(cyanHSV)).toBe('cyan');
    });

    it('should classify magenta colors', () => {
        const magentaHSV: HSVColor = { h: 310, s: 100, v: 100 };
        expect(getColorCategoryHSV(magentaHSV)).toBe('magenta');
    });
});

// ========================================
// Color Profile Tests
// ========================================

describe('Color Profile Extraction', () => {
    const createTestImageData = (r: number, g: number, b: number, width = 10, height = 10): ImageData => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
        return { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
    };

    it('should extract profile from solid red image', () => {
        const imageData = createTestImageData(255, 0, 0);
        const profile = extractColorProfile(imageData);

        expect(profile.dominant).toBeDefined();
        // Profile returns color category names, not RGB values
        expect(profile.dominant).toBe('red');
    });

    it('should extract profile from solid green image', () => {
        const imageData = createTestImageData(0, 255, 0);
        const profile = extractColorProfile(imageData);

        // The dominant color should be a green category
        expect(['green', 'lime']).toContain(profile.dominant);
    });

    it('should extract profile with all regions', () => {
        const imageData = createTestImageData(100, 150, 200);
        const profile = extractColorProfile(imageData);

        expect(profile).toHaveProperty('topLeft');
        expect(profile).toHaveProperty('topRight');
        expect(profile).toHaveProperty('bottomLeft');
        expect(profile).toHaveProperty('bottomRight');
        expect(profile).toHaveProperty('center');
        expect(profile).toHaveProperty('border');
        expect(profile).toHaveProperty('dominant');
    });

    it('should extract border color', () => {
        const imageData = createTestImageData(255, 0, 0);
        const profile = extractColorProfile(imageData);

        expect(profile.border).toBeDefined();
        expect(profile.border).toBe('red');
    });
});

// ========================================
// Color Profile Comparison Tests
// ========================================

describe('Color Profile Comparison', () => {
    const createProfile = (color: string): ColorProfile => ({
        topLeft: color,
        topRight: color,
        bottomLeft: color,
        bottomRight: color,
        center: color,
        border: color,
        dominant: color,
    });

    it('should return 1 for identical profiles', () => {
        const profile = createProfile('red');
        const similarity = compareColorProfiles(profile, profile);
        expect(similarity).toBeCloseTo(1, 1);
    });

    it('should return lower similarity for different colors', () => {
        const red = createProfile('red');
        const blue = createProfile('blue');
        const similarity = compareColorProfiles(red, blue);
        expect(similarity).toBe(0);
    });

    it('should return partial similarity for partially matching profiles', () => {
        const profile1: ColorProfile = {
            topLeft: 'red',
            topRight: 'red',
            bottomLeft: 'blue',
            bottomRight: 'blue',
            center: 'red',
            border: 'red',
            dominant: 'red',
        };
        const profile2: ColorProfile = {
            topLeft: 'red',
            topRight: 'red',
            bottomLeft: 'red',
            bottomRight: 'red',
            center: 'red',
            border: 'red',
            dominant: 'red',
        };
        const similarity = compareColorProfiles(profile1, profile2);
        // 5 out of 7 regions match
        expect(similarity).toBeCloseTo(5/7, 2);
    });
});

// ========================================
// Feedback Correction Tests
// ========================================

describe('Feedback Corrections', () => {
    beforeEach(() => {
        clearFeedbackCorrections();
    });

    afterEach(() => {
        clearFeedbackCorrections();
    });

    it('should start with no corrections', () => {
        const corrections = getFeedbackCorrections();
        expect(corrections).toEqual([]);
    });

    it('should record a correction', () => {
        const detectedItem = { id: 'item1', name: 'Item 1' } as any;
        const actualItem = { id: 'item2', name: 'Item 2' } as any;

        recordCorrection(detectedItem, actualItem, 0.75, 'hash123');
        const corrections = getFeedbackCorrections();

        expect(corrections.length).toBe(1);
        expect(corrections[0].detected).toBe('item1');
        expect(corrections[0].actual).toBe('item2');
        expect(corrections[0].confidence).toBe(0.75);
        expect(corrections[0].imageHash).toBe('hash123');
    });

    it('should return 0 penalty for uncorrected pairs', () => {
        const penalty = getSimilarityPenalty('item3', 'item4');
        expect(penalty).toBe(0);
    });

    it('should apply proportional penalty based on correction count', () => {
        const detectedItem = { id: 'item1', name: 'Item 1' } as any;
        const actualItem = { id: 'item2', name: 'Item 2' } as any;

        // Record 3 times - penalty starts after 2 corrections
        recordCorrection(detectedItem, actualItem, 0.75, 'hash1');
        recordCorrection(detectedItem, actualItem, 0.70, 'hash2');
        recordCorrection(detectedItem, actualItem, 0.72, 'hash3');

        // Penalty is stored with key: `${detectedItem.id}-${actualItem.id}` = 'item1-item2'
        // getSimilarityPenalty(detectedId, templateId) creates key: `${templateId}-${detectedId}`
        // So to match 'item1-item2', we need templateId='item1', detectedId='item2'
        // Proportional penalty: 3 corrections = -0.03 * 3 = -0.09
        const penalty = getSimilarityPenalty('item2', 'item1');
        expect(penalty).toBe(-0.09);
    });

    it('should clear all corrections', () => {
        const detectedItem = { id: 'a', name: 'A' } as any;
        const actualItem = { id: 'b', name: 'B' } as any;

        recordCorrection(detectedItem, actualItem, 0.8, 'hash1');
        clearFeedbackCorrections();

        expect(getFeedbackCorrections()).toEqual([]);
    });

    it('should export corrections as JSON', () => {
        const detectedItem = { id: 'item1', name: 'Item 1' } as any;
        const actualItem = { id: 'item2', name: 'Item 2' } as any;

        recordCorrection(detectedItem, actualItem, 0.75, 'hash123');
        const json = exportFeedbackCorrections();

        expect(json).toContain('item1');
        expect(json).toContain('item2');
        const parsed = JSON.parse(json);
        expect(Array.isArray(parsed)).toBe(true);
    });

    it('should import corrections from JSON', () => {
        const corrections = [
            { detected: 'a', actual: 'b', confidence: 0.8, timestamp: Date.now(), imageHash: 'hash1' }
        ];
        importFeedbackCorrections(JSON.stringify(corrections));

        const imported = getFeedbackCorrections();
        expect(imported.length).toBe(1);
        expect(imported[0].detected).toBe('a');
    });

    it('should throw on invalid JSON import', () => {
        expect(() => importFeedbackCorrections('invalid json')).toThrow();
    });

    it('should rebuild proportional penalties on import', () => {
        const corrections = [
            { detected: 'x', actual: 'y', confidence: 0.8, timestamp: Date.now(), imageHash: 'h1' },
            { detected: 'x', actual: 'y', confidence: 0.8, timestamp: Date.now(), imageHash: 'h2' },
            { detected: 'x', actual: 'y', confidence: 0.8, timestamp: Date.now(), imageHash: 'h3' },
        ];
        importFeedbackCorrections(JSON.stringify(corrections));

        // Penalty key is 'x-y', getSimilarityPenalty('y', 'x') creates key 'x-y'
        // Proportional penalty: 3 corrections = -0.03 * 3 = -0.09
        const penalty = getSimilarityPenalty('y', 'x');
        expect(penalty).toBe(-0.09);
    });
});
