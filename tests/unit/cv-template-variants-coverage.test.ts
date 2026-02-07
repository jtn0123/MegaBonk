/**
 * @vitest-environment jsdom
 * CV Template Variants Module - Comprehensive Coverage Tests
 * Tests for template variant generation, brightness/contrast adjustment, and variant selection
 */
import { describe, it, expect, test } from 'vitest';
import {
    generateVariants,
    getRecommendedVariant,
    scoreVariantMatch,
    selectBestVariants,
    getVariantStats,
    DEFAULT_VARIANT_CONFIG,
    MINIMAL_VARIANT_CONFIG,
    FULL_VARIANT_CONFIG,
    type TemplateVariant,
    type VariantConfig,
    type VariantType,
} from '../../src/modules/cv/template-variants.ts';

// ========================================
// Test Helpers
// ========================================

interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

function createTestImageData(
    width: number = 32,
    height: number = 32,
    fillColor: [number, number, number] = [128, 128, 128]
): SimpleImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = fillColor[0];     // R
        data[i + 1] = fillColor[1]; // G
        data[i + 2] = fillColor[2]; // B
        data[i + 3] = 255;          // A
    }
    return { data, width, height };
}

function createGradientImageData(width: number = 32, height: number = 32): SimpleImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const brightness = Math.floor((x / width) * 255);
            data[i] = brightness;
            data[i + 1] = brightness;
            data[i + 2] = brightness;
            data[i + 3] = 255;
        }
    }
    return { data, width, height };
}

// ========================================
// Configuration Constants Tests
// ========================================

describe('Configuration Constants', () => {
    describe('DEFAULT_VARIANT_CONFIG', () => {
        it('should have brightness variants enabled', () => {
            expect(DEFAULT_VARIANT_CONFIG.generateBrightness).toBe(true);
        });

        it('should have contrast variants enabled', () => {
            expect(DEFAULT_VARIANT_CONFIG.generateContrast).toBe(true);
        });

        it('should have color temperature variants disabled', () => {
            expect(DEFAULT_VARIANT_CONFIG.generateColorTemp).toBe(false);
        });

        it('should have correct brightness adjustments', () => {
            expect(DEFAULT_VARIANT_CONFIG.brightAdjust).toBe(30);
            expect(DEFAULT_VARIANT_CONFIG.darkAdjust).toBe(-25);
        });

        it('should have correct contrast factors', () => {
            expect(DEFAULT_VARIANT_CONFIG.highContrastFactor).toBe(1.3);
            expect(DEFAULT_VARIANT_CONFIG.lowContrastFactor).toBe(0.8);
        });

        it('should have correct color temperature shift', () => {
            expect(DEFAULT_VARIANT_CONFIG.colorTempShift).toBe(20);
        });
    });

    describe('MINIMAL_VARIANT_CONFIG', () => {
        it('should have only brightness variants enabled', () => {
            expect(MINIMAL_VARIANT_CONFIG.generateBrightness).toBe(true);
            expect(MINIMAL_VARIANT_CONFIG.generateContrast).toBe(false);
            expect(MINIMAL_VARIANT_CONFIG.generateColorTemp).toBe(false);
        });

        it('should have smaller brightness adjustments', () => {
            expect(MINIMAL_VARIANT_CONFIG.brightAdjust).toBe(25);
            expect(MINIMAL_VARIANT_CONFIG.darkAdjust).toBe(-20);
        });
    });

    describe('FULL_VARIANT_CONFIG', () => {
        it('should have all variant types enabled', () => {
            expect(FULL_VARIANT_CONFIG.generateBrightness).toBe(true);
            expect(FULL_VARIANT_CONFIG.generateContrast).toBe(true);
            expect(FULL_VARIANT_CONFIG.generateColorTemp).toBe(true);
        });

        it('should have larger adjustments', () => {
            expect(FULL_VARIANT_CONFIG.brightAdjust).toBe(35);
            expect(FULL_VARIANT_CONFIG.darkAdjust).toBe(-30);
            expect(FULL_VARIANT_CONFIG.highContrastFactor).toBe(1.4);
            expect(FULL_VARIANT_CONFIG.lowContrastFactor).toBe(0.75);
            expect(FULL_VARIANT_CONFIG.colorTempShift).toBe(25);
        });
    });
});

// ========================================
// generateVariants Tests
// ========================================

describe('generateVariants', () => {
    it('should always include original variant', () => {
        const original = createTestImageData();
        const variants = generateVariants(original);

        expect(variants.length).toBeGreaterThan(0);
        expect(variants[0].type).toBe('original');
        expect(variants[0].imageData).toBe(original);
    });

    it('should generate correct number of variants with default config', () => {
        const original = createTestImageData();
        const variants = generateVariants(original);

        // Default: original + bright + dark + high_contrast + low_contrast = 5
        expect(variants).toHaveLength(5);
    });

    it('should generate correct number of variants with minimal config', () => {
        const original = createTestImageData();
        const variants = generateVariants(original, MINIMAL_VARIANT_CONFIG);

        // Minimal: original + bright + dark = 3
        expect(variants).toHaveLength(3);
    });

    it('should generate correct number of variants with full config', () => {
        const original = createTestImageData();
        const variants = generateVariants(original, FULL_VARIANT_CONFIG);

        // Full: original + bright + dark + high_contrast + low_contrast + warm + cool = 7
        expect(variants).toHaveLength(7);
    });

    it('should include brightness variants when enabled', () => {
        const original = createTestImageData();
        const config: VariantConfig = { ...DEFAULT_VARIANT_CONFIG, generateBrightness: true };
        const variants = generateVariants(original, config);

        const types = variants.map(v => v.type);
        expect(types).toContain('bright');
        expect(types).toContain('dark');
    });

    it('should exclude brightness variants when disabled', () => {
        const original = createTestImageData();
        const config: VariantConfig = {
            ...DEFAULT_VARIANT_CONFIG,
            generateBrightness: false,
            generateContrast: false,
        };
        const variants = generateVariants(original, config);

        expect(variants).toHaveLength(1);
        expect(variants[0].type).toBe('original');
    });

    it('should include contrast variants when enabled', () => {
        const original = createTestImageData();
        const config: VariantConfig = { ...DEFAULT_VARIANT_CONFIG, generateContrast: true };
        const variants = generateVariants(original, config);

        const types = variants.map(v => v.type);
        expect(types).toContain('high_contrast');
        expect(types).toContain('low_contrast');
    });

    it('should include color temperature variants when enabled', () => {
        const original = createTestImageData();
        const config: VariantConfig = { ...DEFAULT_VARIANT_CONFIG, generateColorTemp: true };
        const variants = generateVariants(original, config);

        const types = variants.map(v => v.type);
        expect(types).toContain('warm');
        expect(types).toContain('cool');
    });

    it('should have correct descriptions for variants', () => {
        const original = createTestImageData();
        const variants = generateVariants(original);

        const originalVariant = variants.find(v => v.type === 'original');
        expect(originalVariant?.description).toBe('Original template');

        const brightVariant = variants.find(v => v.type === 'bright');
        expect(brightVariant?.description).toContain('Brightness +');

        const darkVariant = variants.find(v => v.type === 'dark');
        expect(darkVariant?.description).toContain('Brightness -');
    });

    it('should preserve image dimensions in variants', () => {
        const original = createTestImageData(64, 48);
        const variants = generateVariants(original);

        for (const variant of variants) {
            expect(variant.imageData.width).toBe(64);
            expect(variant.imageData.height).toBe(48);
        }
    });

    it('should create new data arrays for modified variants', () => {
        const original = createTestImageData();
        const variants = generateVariants(original);

        for (const variant of variants) {
            if (variant.type !== 'original') {
                expect(variant.imageData.data).not.toBe(original.data);
            }
        }
    });

    describe('Brightness Adjustment', () => {
        it('should increase pixel values for bright variant', () => {
            const original = createTestImageData(4, 4, [100, 100, 100]);
            const variants = generateVariants(original, MINIMAL_VARIANT_CONFIG);

            const bright = variants.find(v => v.type === 'bright');
            expect(bright).toBeDefined();

            // First pixel R value should be increased
            const brightData = bright!.imageData.data;
            expect(brightData[0]).toBeGreaterThan(100);
        });

        it('should decrease pixel values for dark variant', () => {
            const original = createTestImageData(4, 4, [100, 100, 100]);
            const variants = generateVariants(original, MINIMAL_VARIANT_CONFIG);

            const dark = variants.find(v => v.type === 'dark');
            expect(dark).toBeDefined();

            const darkData = dark!.imageData.data;
            expect(darkData[0]).toBeLessThan(100);
        });

        it('should clamp values to 0-255 range', () => {
            // Test with values that would overflow
            const brightOriginal = createTestImageData(4, 4, [250, 250, 250]);
            const brightVariants = generateVariants(brightOriginal, MINIMAL_VARIANT_CONFIG);
            const bright = brightVariants.find(v => v.type === 'bright');
            expect(bright!.imageData.data[0]).toBeLessThanOrEqual(255);

            // Test with values that would underflow
            const darkOriginal = createTestImageData(4, 4, [10, 10, 10]);
            const darkVariants = generateVariants(darkOriginal, MINIMAL_VARIANT_CONFIG);
            const dark = darkVariants.find(v => v.type === 'dark');
            expect(dark!.imageData.data[0]).toBeGreaterThanOrEqual(0);
        });

        it('should not modify alpha channel', () => {
            const original = createTestImageData(4, 4);
            const variants = generateVariants(original);

            for (const variant of variants) {
                // Check alpha values at every 4th position (index 3, 7, 11, ...)
                for (let i = 3; i < variant.imageData.data.length; i += 4) {
                    expect(variant.imageData.data[i]).toBe(255);
                }
            }
        });
    });

    describe('Contrast Adjustment', () => {
        it('should increase contrast for high_contrast variant', () => {
            const original = createGradientImageData(4, 4);
            const variants = generateVariants(original);

            const highContrast = variants.find(v => v.type === 'high_contrast');
            expect(highContrast).toBeDefined();

            // Dark pixels should get darker, bright pixels should get brighter
            const origData = original.data;
            const hcData = highContrast!.imageData.data;

            // Pixel near black (index 0) should be darker
            if (origData[0] < 128) {
                expect(hcData[0]).toBeLessThanOrEqual(origData[0]);
            }
        });

        it('should decrease contrast for low_contrast variant', () => {
            const original = createGradientImageData(4, 4);
            const variants = generateVariants(original);

            const lowContrast = variants.find(v => v.type === 'low_contrast');
            expect(lowContrast).toBeDefined();
        });
    });

    describe('Color Temperature Adjustment', () => {
        it('should increase red and decrease blue for warm variant', () => {
            const original = createTestImageData(4, 4, [128, 128, 128]);
            const variants = generateVariants(original, FULL_VARIANT_CONFIG);

            const warm = variants.find(v => v.type === 'warm');
            expect(warm).toBeDefined();

            const warmData = warm!.imageData.data;
            expect(warmData[0]).toBeGreaterThan(128); // R increased
            expect(warmData[2]).toBeLessThan(128);    // B decreased
        });

        it('should decrease red and increase blue for cool variant', () => {
            const original = createTestImageData(4, 4, [128, 128, 128]);
            const variants = generateVariants(original, FULL_VARIANT_CONFIG);

            const cool = variants.find(v => v.type === 'cool');
            expect(cool).toBeDefined();

            const coolData = cool!.imageData.data;
            expect(coolData[0]).toBeLessThan(128);    // R decreased
            expect(coolData[2]).toBeGreaterThan(128); // B increased
        });

        it('should not modify green channel significantly', () => {
            const original = createTestImageData(4, 4, [128, 128, 128]);
            const variants = generateVariants(original, FULL_VARIANT_CONFIG);

            const warm = variants.find(v => v.type === 'warm');
            const cool = variants.find(v => v.type === 'cool');

            // Green should remain approximately the same
            expect(warm!.imageData.data[1]).toBe(128);
            expect(cool!.imageData.data[1]).toBe(128);
        });
    });
});

// ========================================
// getRecommendedVariant Tests
// ========================================

describe('getRecommendedVariant', () => {
    test.each([
        ['hell', 'warm'],
        ['lava', 'warm'],
        ['fire', 'warm'],
        ['snow', 'cool'],
        ['ice', 'cool'],
        ['frost', 'cool'],
        ['dark', 'bright'],
        ['crypt', 'bright'],
        ['night', 'bright'],
        ['bright', 'dark'],
        ['desert', 'dark'],
    ] as [string, VariantType][])('should recommend %s variant for %s scene', (scene, expected) => {
        expect(getRecommendedVariant(scene)).toBe(expected);
    });

    it('should return original for unknown scene types', () => {
        expect(getRecommendedVariant('unknown')).toBe('original');
        expect(getRecommendedVariant('random')).toBe('original');
        expect(getRecommendedVariant('')).toBe('original');
    });

    it('should be case-insensitive', () => {
        expect(getRecommendedVariant('HELL')).toBe('warm');
        expect(getRecommendedVariant('Hell')).toBe('warm');
        expect(getRecommendedVariant('hElL')).toBe('warm');
    });

    it('should handle scene names with different cases', () => {
        expect(getRecommendedVariant('SNOW')).toBe('cool');
        expect(getRecommendedVariant('Snow')).toBe('cool');
        expect(getRecommendedVariant('DARK')).toBe('bright');
        expect(getRecommendedVariant('Dark')).toBe('bright');
    });
});

// ========================================
// scoreVariantMatch Tests
// ========================================

describe('scoreVariantMatch', () => {
    function createVariant(type: VariantType): TemplateVariant {
        return {
            type,
            imageData: createTestImageData(),
            description: `${type} variant`,
        };
    }

    it('should return base score of 1.0 for original with neutral conditions', () => {
        const variant = createVariant('original');
        const score = scoreVariantMatch(variant, 128, 50);
        expect(score).toBe(1.0);
    });

    describe('Brightness-based scoring', () => {
        it('should boost bright variant for dark cells', () => {
            const brightVariant = createVariant('bright');
            const darkVariant = createVariant('dark');

            const brightScore = scoreVariantMatch(brightVariant, 60, 50); // Dark cell
            const darkScore = scoreVariantMatch(darkVariant, 60, 50);

            expect(brightScore).toBeGreaterThan(darkScore);
        });

        it('should boost dark variant for bright cells', () => {
            const brightVariant = createVariant('bright');
            const darkVariant = createVariant('dark');

            const brightScore = scoreVariantMatch(brightVariant, 200, 50); // Bright cell
            const darkScore = scoreVariantMatch(darkVariant, 200, 50);

            expect(darkScore).toBeGreaterThan(brightScore);
        });

        it('should not adjust for medium brightness', () => {
            const brightVariant = createVariant('bright');
            const darkVariant = createVariant('dark');

            // Medium brightness (80-180) should not trigger adjustments
            const brightScore = scoreVariantMatch(brightVariant, 120, 50);
            const darkScore = scoreVariantMatch(darkVariant, 120, 50);

            // Both should be base score (1.0)
            expect(brightScore).toBe(1.0);
            expect(darkScore).toBe(1.0);
        });
    });

    describe('Contrast-based scoring', () => {
        it('should boost high_contrast for low contrast cells', () => {
            const highContrast = createVariant('high_contrast');
            const lowContrast = createVariant('low_contrast');

            const highScore = scoreVariantMatch(highContrast, 128, 20); // Low contrast cell
            const lowScore = scoreVariantMatch(lowContrast, 128, 20);

            expect(highScore).toBeGreaterThan(lowScore);
        });

        it('should boost low_contrast for high contrast cells', () => {
            const highContrast = createVariant('high_contrast');
            const lowContrast = createVariant('low_contrast');

            const highScore = scoreVariantMatch(highContrast, 128, 80); // High contrast cell
            const lowScore = scoreVariantMatch(lowContrast, 128, 80);

            expect(lowScore).toBeGreaterThan(highScore);
        });
    });

    describe('Score clamping', () => {
        it('should clamp scores to minimum 0.5', () => {
            const variant = createVariant('dark');
            // Very dark cell with dark variant should get penalties
            const score = scoreVariantMatch(variant, 50, 80);
            expect(score).toBeGreaterThanOrEqual(0.5);
        });

        it('should clamp scores to maximum 1.5', () => {
            const variant = createVariant('bright');
            // Very favorable conditions
            const score = scoreVariantMatch(variant, 50, 20);
            expect(score).toBeLessThanOrEqual(1.5);
        });
    });

    describe('Combined adjustments', () => {
        it('should combine brightness and contrast adjustments', () => {
            const variant = createVariant('bright');
            // Dark cell + low contrast = should favor bright
            const score = scoreVariantMatch(variant, 60, 20);
            expect(score).toBeGreaterThan(1.0);
        });
    });
});

// ========================================
// selectBestVariants Tests
// ========================================

describe('selectBestVariants', () => {
    function createVariants(): TemplateVariant[] {
        const types: VariantType[] = [
            'original', 'bright', 'dark', 'high_contrast',
            'low_contrast', 'warm', 'cool',
        ];
        return types.map(type => ({
            type,
            imageData: createTestImageData(),
            description: `${type} variant`,
        }));
    }

    it('should return all variants if count is less than maxVariants', () => {
        const variants = createVariants().slice(0, 2);
        const selected = selectBestVariants(variants, undefined, 5);
        expect(selected).toHaveLength(2);
    });

    it('should always include original variant', () => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, undefined, 3);

        expect(selected.some(v => v.type === 'original')).toBe(true);
    });

    it('should respect maxVariants limit', () => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, undefined, 3);

        expect(selected.length).toBeLessThanOrEqual(3);
    });

    it('should include recommended variant for scene type', () => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, 'hell', 3);

        // Hell scene should recommend warm variant
        expect(selected.some(v => v.type === 'warm')).toBe(true);
    });

    it('should include contrast variants when filling remaining slots', () => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, undefined, 4);

        const types = selected.map(v => v.type);
        const hasContrast = types.includes('high_contrast') || types.includes('low_contrast');
        expect(hasContrast).toBe(true);
    });

    it('should handle empty variants array', () => {
        const selected = selectBestVariants([], undefined, 3);
        expect(selected).toHaveLength(0);
    });

    it('should handle single variant', () => {
        const variants = [createVariants()[0]]; // Just original
        const selected = selectBestVariants(variants, undefined, 3);

        expect(selected).toHaveLength(1);
        expect(selected[0].type).toBe('original');
    });

    it('should not duplicate variants', () => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, undefined, 5);

        const types = selected.map(v => v.type);
        const uniqueTypes = new Set(types);
        expect(types.length).toBe(uniqueTypes.size);
    });

    test.each([
        ['hell', 'warm'],
        ['snow', 'cool'],
        ['dark', 'bright'],
        ['desert', 'dark'],
    ] as [string, VariantType][])('should prioritize %s variant for %s scene', (scene, expectedType) => {
        const variants = createVariants();
        const selected = selectBestVariants(variants, scene, 3);

        expect(selected.some(v => v.type === expectedType)).toBe(true);
    });

    it('should not add recommended if same as original', () => {
        const variants = [
            { type: 'original' as VariantType, imageData: createTestImageData(), description: 'Original' },
            { type: 'bright' as VariantType, imageData: createTestImageData(), description: 'Bright' },
        ];

        // Unknown scene recommends 'original', should not duplicate
        const selected = selectBestVariants(variants, 'unknown', 3);
        const originalCount = selected.filter(v => v.type === 'original').length;
        expect(originalCount).toBe(1);
    });
});

// ========================================
// getVariantStats Tests
// ========================================

describe('getVariantStats', () => {
    it('should return correct count', () => {
        const variants: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'bright', imageData: createTestImageData(), description: '' },
            { type: 'dark', imageData: createTestImageData(), description: '' },
        ];

        const stats = getVariantStats(variants);
        expect(stats.count).toBe(3);
    });

    it('should return all variant types', () => {
        const variants: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'warm', imageData: createTestImageData(), description: '' },
        ];

        const stats = getVariantStats(variants);
        expect(stats.types).toEqual(['original', 'warm']);
    });

    it('should detect brightness variants', () => {
        const withBrightness: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'bright', imageData: createTestImageData(), description: '' },
        ];

        const withoutBrightness: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'warm', imageData: createTestImageData(), description: '' },
        ];

        expect(getVariantStats(withBrightness).hasBrightness).toBe(true);
        expect(getVariantStats(withoutBrightness).hasBrightness).toBe(false);
    });

    it('should detect dark as brightness variant', () => {
        const variants: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'dark', imageData: createTestImageData(), description: '' },
        ];

        expect(getVariantStats(variants).hasBrightness).toBe(true);
    });

    it('should detect contrast variants', () => {
        const withContrast: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'high_contrast', imageData: createTestImageData(), description: '' },
        ];

        const withLowContrast: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'low_contrast', imageData: createTestImageData(), description: '' },
        ];

        expect(getVariantStats(withContrast).hasContrast).toBe(true);
        expect(getVariantStats(withLowContrast).hasContrast).toBe(true);
    });

    it('should detect color temperature variants', () => {
        const withWarm: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'warm', imageData: createTestImageData(), description: '' },
        ];

        const withCool: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'cool', imageData: createTestImageData(), description: '' },
        ];

        expect(getVariantStats(withWarm).hasColorTemp).toBe(true);
        expect(getVariantStats(withCool).hasColorTemp).toBe(true);
    });

    it('should handle empty variants array', () => {
        const stats = getVariantStats([]);

        expect(stats.count).toBe(0);
        expect(stats.types).toEqual([]);
        expect(stats.hasBrightness).toBe(false);
        expect(stats.hasContrast).toBe(false);
        expect(stats.hasColorTemp).toBe(false);
    });

    it('should handle full variant set', () => {
        const variants: TemplateVariant[] = [
            { type: 'original', imageData: createTestImageData(), description: '' },
            { type: 'bright', imageData: createTestImageData(), description: '' },
            { type: 'dark', imageData: createTestImageData(), description: '' },
            { type: 'high_contrast', imageData: createTestImageData(), description: '' },
            { type: 'low_contrast', imageData: createTestImageData(), description: '' },
            { type: 'warm', imageData: createTestImageData(), description: '' },
            { type: 'cool', imageData: createTestImageData(), description: '' },
        ];

        const stats = getVariantStats(variants);

        expect(stats.count).toBe(7);
        expect(stats.hasBrightness).toBe(true);
        expect(stats.hasContrast).toBe(true);
        expect(stats.hasColorTemp).toBe(true);
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Template Variants Integration', () => {
    it('should support full variant workflow', () => {
        // 1. Generate variants
        const original = createTestImageData(32, 32, [100, 100, 100]);
        const variants = generateVariants(original, DEFAULT_VARIANT_CONFIG);

        // 2. Check stats
        const stats = getVariantStats(variants);
        expect(stats.hasBrightness).toBe(true);
        expect(stats.hasContrast).toBe(true);

        // 3. Select best for scene
        const selected = selectBestVariants(variants, 'hell', 3);
        expect(selected.length).toBe(3);

        // 4. Score variants
        for (const variant of selected) {
            const score = scoreVariantMatch(variant, 100, 50);
            expect(score).toBeGreaterThanOrEqual(0.5);
            expect(score).toBeLessThanOrEqual(1.5);
        }
    });

    it('should work with different image sizes', () => {
        const sizes = [
            [16, 16],
            [32, 32],
            [64, 64],
            [128, 128],
        ];

        for (const [width, height] of sizes) {
            const original = createTestImageData(width, height);
            const variants = generateVariants(original);

            expect(variants.length).toBeGreaterThan(0);
            for (const variant of variants) {
                expect(variant.imageData.width).toBe(width);
                expect(variant.imageData.height).toBe(height);
            }
        }
    });

    it('should preserve data integrity through variant generation', () => {
        const original = createGradientImageData(32, 32);
        const variants = generateVariants(original);

        // Original should be unchanged
        const originalVariant = variants.find(v => v.type === 'original');
        expect(originalVariant?.imageData).toBe(original);
        expect(originalVariant?.imageData.data).toBe(original.data);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Edge Cases', () => {
    it('should handle single pixel image', () => {
        const original = createTestImageData(1, 1, [128, 128, 128]);
        const variants = generateVariants(original);

        expect(variants.length).toBeGreaterThan(0);
        for (const variant of variants) {
            expect(variant.imageData.width).toBe(1);
            expect(variant.imageData.height).toBe(1);
        }
    });

    it('should handle all black image', () => {
        const original = createTestImageData(32, 32, [0, 0, 0]);
        const variants = generateVariants(original);

        // Dark variant should clamp to 0
        const dark = variants.find(v => v.type === 'dark');
        expect(dark?.imageData.data[0]).toBe(0);

        // Bright variant should increase
        const bright = variants.find(v => v.type === 'bright');
        expect(bright?.imageData.data[0]).toBeGreaterThan(0);
    });

    it('should handle all white image', () => {
        const original = createTestImageData(32, 32, [255, 255, 255]);
        const variants = generateVariants(original);

        // Bright variant should clamp to 255
        const bright = variants.find(v => v.type === 'bright');
        expect(bright?.imageData.data[0]).toBe(255);

        // Dark variant should decrease
        const dark = variants.find(v => v.type === 'dark');
        expect(dark?.imageData.data[0]).toBeLessThan(255);
    });

    it('should handle extreme brightness values for scoring', () => {
        const variant: TemplateVariant = {
            type: 'bright',
            imageData: createTestImageData(),
            description: 'Bright',
        };

        // Extreme brightness values
        const score1 = scoreVariantMatch(variant, 0, 50);
        const score2 = scoreVariantMatch(variant, 255, 50);

        expect(score1).toBeGreaterThanOrEqual(0.5);
        expect(score2).toBeLessThanOrEqual(1.5);
    });

    it('should handle extreme contrast values for scoring', () => {
        const variant: TemplateVariant = {
            type: 'high_contrast',
            imageData: createTestImageData(),
            description: 'High Contrast',
        };

        // Extreme contrast values
        const score1 = scoreVariantMatch(variant, 128, 0);
        const score2 = scoreVariantMatch(variant, 128, 100);

        expect(score1).toBeGreaterThanOrEqual(0.5);
        expect(score2).toBeLessThanOrEqual(1.5);
    });

    it('should handle custom config with all options disabled', () => {
        const original = createTestImageData();
        const config: VariantConfig = {
            generateBrightness: false,
            generateContrast: false,
            generateColorTemp: false,
            brightAdjust: 0,
            darkAdjust: 0,
            highContrastFactor: 1,
            lowContrastFactor: 1,
            colorTempShift: 0,
        };

        const variants = generateVariants(original, config);

        // Should only have original
        expect(variants).toHaveLength(1);
        expect(variants[0].type).toBe('original');
    });

    it('should handle non-square images', () => {
        const original = createTestImageData(100, 50);
        const variants = generateVariants(original);

        for (const variant of variants) {
            expect(variant.imageData.width).toBe(100);
            expect(variant.imageData.height).toBe(50);
        }
    });
});
