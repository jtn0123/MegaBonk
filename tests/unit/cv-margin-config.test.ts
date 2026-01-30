/**
 * CV Margin Config Module Tests
 * 
 * Tests the cell extraction margin configuration system
 */

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

describe('CV Margin Config Module', () => {
    beforeEach(() => {
        // Reset to default config before each test
        setMarginConfig(DEFAULT_MARGIN_CONFIG);
    });

    describe('Configuration Presets', () => {
        it('DEFAULT_MARGIN_CONFIG should have valid values', () => {
            expect(DEFAULT_MARGIN_CONFIG.baseCellMargin).toBe(0.18);
            expect(DEFAULT_MARGIN_CONFIG.baseTemplateMargin).toBe(0.15);
            expect(DEFAULT_MARGIN_CONFIG.rarityAdjustments.common).toBe(-0.02);
            expect(DEFAULT_MARGIN_CONFIG.rarityAdjustments.legendary).toBe(0.03);
        });

        it('OPTIMIZED_MARGIN_CONFIG should have more aggressive values', () => {
            expect(OPTIMIZED_MARGIN_CONFIG.baseCellMargin).toBeLessThan(DEFAULT_MARGIN_CONFIG.baseCellMargin);
            expect(OPTIMIZED_MARGIN_CONFIG.baseTemplateMargin).toBeLessThan(DEFAULT_MARGIN_CONFIG.baseTemplateMargin);
        });

        it('CONSERVATIVE_MARGIN_CONFIG should have safer values', () => {
            expect(CONSERVATIVE_MARGIN_CONFIG.baseCellMargin).toBeGreaterThan(DEFAULT_MARGIN_CONFIG.baseCellMargin);
            expect(CONSERVATIVE_MARGIN_CONFIG.baseTemplateMargin).toBeGreaterThan(DEFAULT_MARGIN_CONFIG.baseTemplateMargin);
        });

        it('All configs should have rarity adjustments', () => {
            const configs = [DEFAULT_MARGIN_CONFIG, OPTIMIZED_MARGIN_CONFIG, CONSERVATIVE_MARGIN_CONFIG];
            for (const config of configs) {
                expect(config.rarityAdjustments).toHaveProperty('common');
                expect(config.rarityAdjustments).toHaveProperty('uncommon');
                expect(config.rarityAdjustments).toHaveProperty('rare');
                expect(config.rarityAdjustments).toHaveProperty('epic');
                expect(config.rarityAdjustments).toHaveProperty('legendary');
                expect(config.rarityAdjustments).toHaveProperty('unknown');
            }
        });

        it('All configs should have resolution configs', () => {
            const configs = [DEFAULT_MARGIN_CONFIG, OPTIMIZED_MARGIN_CONFIG, CONSERVATIVE_MARGIN_CONFIG];
            for (const config of configs) {
                expect(config.resolutionConfigs.length).toBeGreaterThanOrEqual(3);
                // Should cover from 0 to high resolutions
                expect(config.resolutionConfigs[0].minWidth).toBe(0);
            }
        });
    });

    describe('setMarginConfig / getMarginConfig', () => {
        it('should return default config initially', () => {
            const config = getMarginConfig();
            expect(config).toEqual(DEFAULT_MARGIN_CONFIG);
        });

        it('should set custom config', () => {
            setMarginConfig(OPTIMIZED_MARGIN_CONFIG);
            const config = getMarginConfig();
            expect(config).toEqual(OPTIMIZED_MARGIN_CONFIG);
        });

        it('should allow setting custom partial config', () => {
            const customConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.25,
            };
            setMarginConfig(customConfig);
            expect(getMarginConfig().baseCellMargin).toBe(0.25);
        });
    });

    describe('calculateCellMargin', () => {
        it('should calculate base margin without rarity or resolution', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth);
            // Base margin is 0.18, so 100 * 0.18 = 18
            expect(margin).toBe(18);
        });

        it('should apply common rarity reduction', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'common');
            // Base 0.18 + common -0.02 = 0.16, so 100 * 0.16 = 16
            expect(margin).toBe(16);
        });

        it('should apply legendary rarity increase', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'legendary');
            // Base 0.18 + legendary 0.03 = 0.21, so 100 * 0.21 = 21
            expect(margin).toBe(21);
        });

        it('should handle case-insensitive rarity', () => {
            const cellWidth = 100;
            const marginLower = calculateCellMargin(cellWidth, 'legendary');
            const marginUpper = calculateCellMargin(cellWidth, 'LEGENDARY');
            expect(marginLower).toBe(marginUpper);
        });

        it('should use unknown adjustment for unrecognized rarity', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'mythic'); // Not in our list
            // Base 0.18 + unknown 0.0 = 0.18
            expect(margin).toBe(18);
        });

        it('should apply 720p resolution multiplier', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, undefined, 1280);
            // Lower resolution should have higher multiplier
            const baseMargin = calculateCellMargin(cellWidth, undefined, 1920);
            expect(margin).toBeGreaterThanOrEqual(baseMargin);
        });

        it('should apply 1080p resolution multiplier (baseline)', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, undefined, 1920);
            // Baseline resolution should use multiplier of 1.0
            expect(margin).toBeGreaterThanOrEqual(15);
            expect(margin).toBeLessThanOrEqual(25);
        });

        it('should apply 4K resolution multiplier', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, undefined, 3840);
            // Base 0.18 * 0.9 = 0.162, so 100 * 0.162 = 16 (rounded)
            expect(margin).toBe(16);
        });

        it('should combine rarity and resolution adjustments', () => {
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'legendary', 3840);
            // Base 0.18 + legendary 0.03 = 0.21, * 0.9 = 0.189, so 100 * 0.189 = 19
            expect(margin).toBe(19);
        });

        it('should clamp margin to minimum 5%', () => {
            // Create a config with very negative adjustments
            const extremeConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.01,
                rarityAdjustments: { ...DEFAULT_MARGIN_CONFIG.rarityAdjustments, common: -0.05 },
            };
            setMarginConfig(extremeConfig);
            
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth, 'common');
            // Should be clamped to 0.05 minimum
            expect(margin).toBeGreaterThanOrEqual(5);
        });

        it('should clamp margin to maximum 40%', () => {
            // Create a config with very high margins
            const extremeConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseCellMargin: 0.5,
            };
            setMarginConfig(extremeConfig);
            
            const cellWidth = 100;
            const margin = calculateCellMargin(cellWidth);
            // Should be clamped to 0.40 maximum
            expect(margin).toBeLessThanOrEqual(40);
        });

        it('should round to nearest pixel', () => {
            const cellWidth = 57; // Will produce non-integer margin
            const margin = calculateCellMargin(cellWidth);
            expect(Number.isInteger(margin)).toBe(true);
        });
    });

    describe('calculateTemplateMargin', () => {
        it('should calculate base template margin', () => {
            const templateSize = 100;
            const margin = calculateTemplateMargin(templateSize);
            // Base template margin is 0.15
            expect(margin).toBe(15);
        });

        it('should apply rarity adjustments', () => {
            const templateSize = 100;
            const commonMargin = calculateTemplateMargin(templateSize, 'common');
            const legendaryMargin = calculateTemplateMargin(templateSize, 'legendary');
            
            expect(commonMargin).toBeLessThan(legendaryMargin);
        });

        it('should clamp to minimum 5%', () => {
            const extremeConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseTemplateMargin: 0.01,
            };
            setMarginConfig(extremeConfig);
            
            const margin = calculateTemplateMargin(100);
            expect(margin).toBeGreaterThanOrEqual(5);
        });

        it('should clamp to maximum 35%', () => {
            const extremeConfig: MarginConfig = {
                ...DEFAULT_MARGIN_CONFIG,
                baseTemplateMargin: 0.5,
            };
            setMarginConfig(extremeConfig);
            
            const margin = calculateTemplateMargin(100);
            expect(margin).toBeLessThanOrEqual(35);
        });

        it('should round to nearest pixel', () => {
            const margin = calculateTemplateMargin(63);
            expect(Number.isInteger(margin)).toBe(true);
        });
    });

    describe('describeMargins', () => {
        it('should return description string', () => {
            const description = describeMargins(100, 'rare', 1920);
            expect(typeof description).toBe('string');
            expect(description).toContain('Cell margin');
            expect(description).toContain('px');
            expect(description).toContain('%');
        });

        it('should include rarity in description', () => {
            const description = describeMargins(100, 'legendary');
            expect(description).toContain('legendary');
        });

        it('should use unknown for missing rarity', () => {
            const description = describeMargins(100);
            expect(description).toContain('unknown');
        });

        it('should show correct margin values', () => {
            const description = describeMargins(100, 'rare', 1920);
            // Should contain pixel and percentage values
            expect(description).toMatch(/\d+px/);
            expect(description).toMatch(/\d+\.\d%/);
        });
    });

    describe('Resolution Configs', () => {
        it('should cover all common resolutions', () => {
            const resolutions = [720, 1080, 1440, 2160]; // 720p, 1080p, 1440p, 4K
            const widths = [1280, 1920, 2560, 3840];
            
            for (let i = 0; i < widths.length; i++) {
                const margin = calculateCellMargin(100, undefined, widths[i]);
                expect(margin).toBeGreaterThan(0);
            }
        });

        it('should handle very low resolutions', () => {
            const margin = calculateCellMargin(100, undefined, 640);
            expect(margin).toBeGreaterThan(0);
        });

        it('should handle very high resolutions', () => {
            const margin = calculateCellMargin(100, undefined, 7680); // 8K
            expect(margin).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero cell width', () => {
            const margin = calculateCellMargin(0);
            expect(margin).toBe(0);
        });

        it('should handle very small cell width', () => {
            const margin = calculateCellMargin(10);
            expect(margin).toBeGreaterThanOrEqual(0);
            expect(margin).toBeLessThanOrEqual(10);
        });

        it('should handle large cell width', () => {
            const margin = calculateCellMargin(1000);
            expect(margin).toBeGreaterThan(0);
        });

        it('should handle empty string rarity', () => {
            const margin = calculateCellMargin(100, '');
            expect(margin).toBeGreaterThan(0);
        });
    });
});
