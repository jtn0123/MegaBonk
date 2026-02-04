// ========================================
// CV Margin Configuration Module - Unit Tests
// ========================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
    setMarginConfig,
    getMarginConfig,
    calculateCellMargin,
    calculateTemplateMargin,
    describeMargins,
    DEFAULT_MARGIN_CONFIG,
    OPTIMIZED_MARGIN_CONFIG,
    CONSERVATIVE_MARGIN_CONFIG,
    type MarginConfig,
} from '../../src/modules/cv/margin-config.ts';

describe('Margin Configuration', () => {
    beforeEach(() => {
        // Reset to default config before each test
        setMarginConfig(DEFAULT_MARGIN_CONFIG);
    });

    describe('setMarginConfig / getMarginConfig', () => {
        it('should get default config initially', () => {
            const config = getMarginConfig();
            expect(config).toEqual(DEFAULT_MARGIN_CONFIG);
        });

        it('should update config when set', () => {
            setMarginConfig(OPTIMIZED_MARGIN_CONFIG);
            expect(getMarginConfig()).toEqual(OPTIMIZED_MARGIN_CONFIG);
        });

        it('should allow custom config', () => {
            const customConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.25,
            };
            setMarginConfig(customConfig);
            expect(getMarginConfig().baseCellMargin).toBe(0.25);
        });
    });

    describe('Preset Configurations', () => {
        it('DEFAULT_MARGIN_CONFIG should have reasonable values', () => {
            expect(DEFAULT_MARGIN_CONFIG.baseCellMargin).toBeGreaterThan(0.1);
            expect(DEFAULT_MARGIN_CONFIG.baseCellMargin).toBeLessThan(0.3);
            expect(DEFAULT_MARGIN_CONFIG.baseTemplateMargin).toBeGreaterThan(0.05);
            expect(DEFAULT_MARGIN_CONFIG.baseTemplateMargin).toBeLessThan(0.25);
        });

        it('OPTIMIZED_MARGIN_CONFIG should be more aggressive', () => {
            expect(OPTIMIZED_MARGIN_CONFIG.baseCellMargin).toBeLessThan(DEFAULT_MARGIN_CONFIG.baseCellMargin);
            expect(OPTIMIZED_MARGIN_CONFIG.baseTemplateMargin).toBeLessThan(DEFAULT_MARGIN_CONFIG.baseTemplateMargin);
        });

        it('CONSERVATIVE_MARGIN_CONFIG should be more cautious', () => {
            expect(CONSERVATIVE_MARGIN_CONFIG.baseCellMargin).toBeGreaterThan(DEFAULT_MARGIN_CONFIG.baseCellMargin);
            expect(CONSERVATIVE_MARGIN_CONFIG.baseTemplateMargin).toBeGreaterThan(DEFAULT_MARGIN_CONFIG.baseTemplateMargin);
        });

        it('should have complete rarity adjustments', () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unknown'];
            for (const rarity of rarities) {
                expect(DEFAULT_MARGIN_CONFIG.rarityAdjustments).toHaveProperty(rarity);
                expect(typeof DEFAULT_MARGIN_CONFIG.rarityAdjustments[rarity as keyof typeof DEFAULT_MARGIN_CONFIG.rarityAdjustments]).toBe('number');
            }
        });

        it('should have resolution configs for all tiers', () => {
            expect(DEFAULT_MARGIN_CONFIG.resolutionConfigs.length).toBeGreaterThanOrEqual(4);
            
            // Check for 720p, 1080p, 1440p, 4K coverage
            const coverages = DEFAULT_MARGIN_CONFIG.resolutionConfigs;
            expect(coverages.some(c => c.minWidth === 0)).toBe(true); // Low res
            expect(coverages.some(c => c.maxWidth === 9999)).toBe(true); // Ultra res
        });
    });
});

describe('calculateCellMargin', () => {
    beforeEach(() => {
        setMarginConfig(DEFAULT_MARGIN_CONFIG);
    });

    describe('Basic Calculation', () => {
        it('should return pixel value based on cell width', () => {
            const margin = calculateCellMargin(48);
            expect(margin).toBeGreaterThan(0);
            expect(margin).toBeLessThan(48);
        });

        it('should scale with cell width', () => {
            const margin48 = calculateCellMargin(48);
            const margin96 = calculateCellMargin(96);

            // Larger cell = proportionally larger margin
            expect(margin96).toBeGreaterThan(margin48);
        });

        it('should use base margin for no rarity', () => {
            const margin = calculateCellMargin(100);
            // ~18% of 100 = ~18
            expect(margin).toBeCloseTo(18, 0);
        });
    });

    describe('Rarity Adjustments', () => {
        it('should reduce margin for common items', () => {
            const commonMargin = calculateCellMargin(48, 'common');
            const rareMargin = calculateCellMargin(48, 'rare');

            expect(commonMargin).toBeLessThan(rareMargin);
        });

        it('should increase margin for legendary items', () => {
            const legendaryMargin = calculateCellMargin(48, 'legendary');
            const rareMargin = calculateCellMargin(48, 'rare');

            expect(legendaryMargin).toBeGreaterThan(rareMargin);
        });

        it('should use base for rare items (no adjustment)', () => {
            const rareMargin = calculateCellMargin(100, 'rare');
            // Rare adjustment is 0, so should be base margin
            // ~18% of 100 = ~18
            expect(rareMargin).toBeCloseTo(18, 0);
        });

        it('should handle case insensitivity', () => {
            const lower = calculateCellMargin(48, 'legendary');
            const upper = calculateCellMargin(48, 'LEGENDARY');
            const mixed = calculateCellMargin(48, 'Legendary');

            expect(lower).toBe(upper);
            expect(lower).toBe(mixed);
        });

        it('should use unknown for unrecognized rarity', () => {
            const mythicalMargin = calculateCellMargin(48, 'mythical');
            const unknownMargin = calculateCellMargin(48, 'unknown');

            expect(mythicalMargin).toBe(unknownMargin);
        });
    });

    describe('Resolution Adjustments', () => {
        it('should increase margin for low resolution (720p)', () => {
            const lowRes = calculateCellMargin(48, 'rare', 1280);
            const medRes = calculateCellMargin(48, 'rare', 1920);

            expect(lowRes).toBeGreaterThan(medRes);
        });

        it('should use baseline for medium resolution (1080p)', () => {
            // Medium res range is 1280-1920, use 1600 as a typical 1080p width
            const medRes = calculateCellMargin(48, 'rare', 1600);
            const baseMargin = Math.round(48 * 0.18); // Base margin

            expect(medRes).toBeCloseTo(baseMargin, 0);
        });

        it('should decrease margin for high resolution (1440p)', () => {
            // High res range is 1920-2560
            const highRes = calculateCellMargin(48, 'rare', 2400);
            // Medium res range is 1280-1920
            const medRes = calculateCellMargin(48, 'rare', 1600);

            expect(highRes).toBeLessThan(medRes);
        });

        it('should decrease margin more for ultra resolution (4K)', () => {
            // Use larger cell size to make differences visible after rounding
            // Ultra res range is >= 2560, multiplier 0.9
            const ultraRes = calculateCellMargin(100, 'rare', 3840);
            // High res range is 1920-2560, multiplier 0.95
            const highRes = calculateCellMargin(100, 'rare', 2400);

            // Ultra should have smaller margin (0.9 multiplier vs 0.95)
            expect(ultraRes).toBeLessThanOrEqual(highRes);
        });
    });

    describe('Clamping', () => {
        it('should not go below 5% of cell width', () => {
            // Use very aggressive config
            setMarginConfig({
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.01, // Very small
                rarityAdjustments: {
                    common: -0.1,
                    uncommon: 0,
                    rare: 0,
                    epic: 0,
                    legendary: 0,
                    unknown: 0,
                },
            });

            const margin = calculateCellMargin(100, 'common');
            expect(margin).toBeGreaterThanOrEqual(5); // 5% of 100
        });

        it('should not exceed 40% of cell width', () => {
            // Use very conservative config
            setMarginConfig({
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.5, // Very large
                rarityAdjustments: {
                    common: 0,
                    uncommon: 0,
                    rare: 0,
                    epic: 0,
                    legendary: 0.2,
                    unknown: 0,
                },
            });

            const margin = calculateCellMargin(100, 'legendary');
            expect(margin).toBeLessThanOrEqual(40); // 40% of 100
        });
    });

    describe('Combined Adjustments', () => {
        it('should apply rarity and resolution together', () => {
            // Common on 4K should be very small margin
            const commonUltra = calculateCellMargin(48, 'common', 3840);
            // Legendary on 720p should be large margin
            const legendary720 = calculateCellMargin(48, 'legendary', 1280);

            expect(legendary720).toBeGreaterThan(commonUltra);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero cell width', () => {
            const margin = calculateCellMargin(0);
            expect(margin).toBe(0);
        });

        it('should handle very small cell width', () => {
            const margin = calculateCellMargin(10);
            expect(margin).toBeGreaterThanOrEqual(1);
            expect(margin).toBeLessThanOrEqual(4);
        });

        it('should handle very large cell width', () => {
            const margin = calculateCellMargin(200);
            expect(margin).toBeGreaterThan(0);
            expect(margin).toBeLessThan(200);
        });
    });
});

describe('calculateTemplateMargin', () => {
    beforeEach(() => {
        setMarginConfig(DEFAULT_MARGIN_CONFIG);
    });

    describe('Basic Calculation', () => {
        it('should return pixel value based on template size', () => {
            const margin = calculateTemplateMargin(64);
            expect(margin).toBeGreaterThan(0);
            expect(margin).toBeLessThan(64);
        });

        it('should scale with template size', () => {
            const margin32 = calculateTemplateMargin(32);
            const margin64 = calculateTemplateMargin(64);

            expect(margin64).toBeGreaterThan(margin32);
        });
    });

    describe('Rarity Adjustments', () => {
        it('should reduce margin for common items', () => {
            const commonMargin = calculateTemplateMargin(64, 'common');
            const rareMargin = calculateTemplateMargin(64, 'rare');

            expect(commonMargin).toBeLessThan(rareMargin);
        });

        it('should increase margin for legendary items', () => {
            const legendaryMargin = calculateTemplateMargin(64, 'legendary');
            const rareMargin = calculateTemplateMargin(64, 'rare');

            expect(legendaryMargin).toBeGreaterThan(rareMargin);
        });
    });

    describe('Clamping', () => {
        it('should not go below 5% of template size', () => {
            setMarginConfig({
                ...DEFAULT_MARGIN_CONFIG,
                baseTemplateMargin: 0.01,
            });

            const margin = calculateTemplateMargin(100);
            expect(margin).toBeGreaterThanOrEqual(5);
        });

        it('should not exceed 35% of template size', () => {
            setMarginConfig({
                ...DEFAULT_MARGIN_CONFIG,
                baseTemplateMargin: 0.5,
            });

            const margin = calculateTemplateMargin(100);
            expect(margin).toBeLessThanOrEqual(35);
        });
    });

    describe('No Resolution Adjustment', () => {
        it('should not use resolution (template margin is fixed)', () => {
            // calculateTemplateMargin doesn't take resolution
            const margin1 = calculateTemplateMargin(64, 'rare');
            const margin2 = calculateTemplateMargin(64, 'rare');

            expect(margin1).toBe(margin2);
        });
    });
});

describe('describeMargins', () => {
    beforeEach(() => {
        setMarginConfig(DEFAULT_MARGIN_CONFIG);
    });

    describe('Output Format', () => {
        it('should include cell margin in pixels', () => {
            const description = describeMargins(48);
            expect(description).toMatch(/Cell margin: \d+px/);
        });

        it('should include percentage', () => {
            const description = describeMargins(100);
            expect(description).toMatch(/\d+\.\d+%/);
        });

        it('should include rarity', () => {
            const description = describeMargins(48, 'legendary');
            expect(description).toContain('Rarity: legendary');
        });

        it('should show unknown for no rarity', () => {
            const description = describeMargins(48);
            expect(description).toContain('Rarity: unknown');
        });
    });

    describe('Accuracy', () => {
        it('should report correct margin value', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'rare');
            const description = describeMargins(cellWidth, 'rare');

            expect(description).toContain(`${margin}px`);
        });

        it('should report correct percentage', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'rare');
            const pct = ((margin / cellWidth) * 100).toFixed(1);
            const description = describeMargins(cellWidth, 'rare');

            expect(description).toContain(`${pct}%`);
        });
    });

    describe('With Resolution', () => {
        it('should accept resolution parameter', () => {
            const description = describeMargins(48, 'rare', 1920);
            expect(description).toMatch(/Cell margin: \d+px/);
        });

        it('should reflect resolution adjustment in margin', () => {
            const desc720 = describeMargins(48, 'rare', 1280);
            const desc4k = describeMargins(48, 'rare', 3840);

            // Extract pixel values and compare
            const margin720 = parseInt(desc720.match(/Cell margin: (\d+)px/)?.[1] || '0');
            const margin4k = parseInt(desc4k.match(/Cell margin: (\d+)px/)?.[1] || '0');

            expect(margin720).toBeGreaterThan(margin4k);
        });
    });
});
