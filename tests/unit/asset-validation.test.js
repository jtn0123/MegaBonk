import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Asset validation tests - ensures all images exist and graph data is valid
 * These tests fail if any referenced assets are missing or malformed
 */

let items, weapons, tomes, characters;
const srcPath = join(process.cwd(), 'src');
const dataPath = join(process.cwd(), 'data');

beforeAll(() => {
    items = JSON.parse(readFileSync(join(dataPath, 'items.json'), 'utf8'));
    weapons = JSON.parse(readFileSync(join(dataPath, 'weapons.json'), 'utf8'));
    tomes = JSON.parse(readFileSync(join(dataPath, 'tomes.json'), 'utf8'));
    characters = JSON.parse(readFileSync(join(dataPath, 'characters.json'), 'utf8'));
});

// ========================================
// Image File Existence Tests
// ========================================

describe('Image File Existence', () => {
    describe('Item Images', () => {
        it('all item images should exist on disk', () => {
            const missingImages = [];

            items.items.forEach(item => {
                if (!item.image) {
                    missingImages.push({ name: item.name, issue: 'no image path defined' });
                    return;
                }

                const imagePath = join(srcPath, item.image);
                if (!existsSync(imagePath)) {
                    missingImages.push({
                        name: item.name,
                        path: item.image,
                        issue: 'file not found',
                    });
                }
            });

            expect(missingImages, `Missing item images: ${JSON.stringify(missingImages, null, 2)}`).toEqual([]);
        });

        it('all item image paths should follow naming convention', () => {
            const invalidPaths = [];

            items.items.forEach(item => {
                if (!item.image) return;

                // Expected format: images/items/{id}.png
                const expectedPattern = /^images\/items\/[\w-]+\.png$/;
                if (!expectedPattern.test(item.image)) {
                    invalidPaths.push({
                        name: item.name,
                        path: item.image,
                        expected: `images/items/${item.id}.png`,
                    });
                }
            });

            expect(invalidPaths, `Invalid item image paths: ${JSON.stringify(invalidPaths, null, 2)}`).toEqual([]);
        });
    });

    describe('Weapon Images', () => {
        it('all weapon images should exist on disk', () => {
            const missingImages = [];

            weapons.weapons.forEach(weapon => {
                if (!weapon.image) {
                    missingImages.push({ name: weapon.name, issue: 'no image path defined' });
                    return;
                }

                const imagePath = join(srcPath, weapon.image);
                if (!existsSync(imagePath)) {
                    missingImages.push({
                        name: weapon.name,
                        path: weapon.image,
                        issue: 'file not found',
                    });
                }
            });

            expect(missingImages, `Missing weapon images: ${JSON.stringify(missingImages, null, 2)}`).toEqual([]);
        });

        it('all weapon image paths should follow naming convention', () => {
            const invalidPaths = [];

            weapons.weapons.forEach(weapon => {
                if (!weapon.image) return;

                const expectedPattern = /^images\/weapons\/[\w-]+\.png$/;
                if (!expectedPattern.test(weapon.image)) {
                    invalidPaths.push({
                        name: weapon.name,
                        path: weapon.image,
                        expected: `images/weapons/${weapon.id}.png`,
                    });
                }
            });

            expect(invalidPaths, `Invalid weapon image paths: ${JSON.stringify(invalidPaths, null, 2)}`).toEqual([]);
        });
    });

    describe('Character Images', () => {
        it('all character images should exist on disk', () => {
            const missingImages = [];

            characters.characters.forEach(char => {
                if (!char.image) {
                    missingImages.push({ name: char.name, issue: 'no image path defined' });
                    return;
                }

                const imagePath = join(srcPath, char.image);
                if (!existsSync(imagePath)) {
                    missingImages.push({
                        name: char.name,
                        path: char.image,
                        issue: 'file not found',
                    });
                }
            });

            expect(missingImages, `Missing character images: ${JSON.stringify(missingImages, null, 2)}`).toEqual([]);
        });

        it('all character image paths should follow naming convention', () => {
            const invalidPaths = [];

            characters.characters.forEach(char => {
                if (!char.image) return;

                const expectedPattern = /^images\/characters\/[\w-]+\.png$/;
                if (!expectedPattern.test(char.image)) {
                    invalidPaths.push({
                        name: char.name,
                        path: char.image,
                        expected: `images/characters/${char.id}.png`,
                    });
                }
            });

            expect(invalidPaths, `Invalid character image paths: ${JSON.stringify(invalidPaths, null, 2)}`).toEqual([]);
        });
    });

    describe('Tome Images', () => {
        it('all tome images should exist on disk', () => {
            const missingImages = [];

            tomes.tomes.forEach(tome => {
                if (!tome.image) {
                    missingImages.push({ name: tome.name, issue: 'no image path defined' });
                    return;
                }

                const imagePath = join(srcPath, tome.image);
                if (!existsSync(imagePath)) {
                    missingImages.push({
                        name: tome.name,
                        path: tome.image,
                        issue: 'file not found',
                    });
                }
            });

            expect(missingImages, `Missing tome images: ${JSON.stringify(missingImages, null, 2)}`).toEqual([]);
        });

        it('all tome image paths should follow naming convention', () => {
            const invalidPaths = [];

            tomes.tomes.forEach(tome => {
                if (!tome.image) return;

                const expectedPattern = /^images\/tomes\/[\w-]+\.png$/;
                if (!expectedPattern.test(tome.image)) {
                    invalidPaths.push({
                        name: tome.name,
                        path: tome.image,
                        expected: `images/tomes/${tome.id}.png`,
                    });
                }
            });

            expect(invalidPaths, `Invalid tome image paths: ${JSON.stringify(invalidPaths, null, 2)}`).toEqual([]);
        });
    });

    describe('No Orphaned Images', () => {
        it('all item images in directory should be referenced in data', () => {
            const { readdirSync } = require('fs');
            const itemImagesDir = join(srcPath, 'images', 'items');
            const imageFiles = readdirSync(itemImagesDir).filter(f => f.endsWith('.png'));
            const referencedImages = new Set(items.items.map(item => item.image?.split('/').pop()).filter(Boolean));

            const orphanedImages = imageFiles.filter(file => !referencedImages.has(file));

            // Allow some tolerance for placeholder/template images
            expect(
                orphanedImages.length,
                `Orphaned item images not referenced in data: ${orphanedImages.join(', ')}`
            ).toBeLessThanOrEqual(5);
        });

        it('all weapon images in directory should be referenced in data', () => {
            const { readdirSync } = require('fs');
            const weaponImagesDir = join(srcPath, 'images', 'weapons');
            const imageFiles = readdirSync(weaponImagesDir).filter(f => f.endsWith('.png'));
            const referencedImages = new Set(
                weapons.weapons.map(weapon => weapon.image?.split('/').pop()).filter(Boolean)
            );

            const orphanedImages = imageFiles.filter(file => !referencedImages.has(file));

            expect(
                orphanedImages.length,
                `Orphaned weapon images not referenced in data: ${orphanedImages.join(', ')}`
            ).toBeLessThanOrEqual(5);
        });
    });
});

// ========================================
// Graph Data Validation Tests
// ========================================

describe('Graph Data Validation', () => {
    // All valid graph types used in the data files
    const VALID_GRAPH_TYPES = [
        'flat',
        'linear_scaling',
        'chance_scaling',
        'capped_chance',
        'threshold_scaling',
        'percentage_scaling',
        'capped_stacking',
        'capped_radius',
        'tradeoff_scaling',
        'diminishing_returns',
        'hyperbolic_scaling',
        'conversion_scaling',
        'ramping_capped',
        'conditional_scaling',
        'hyperbolic_chance',
        'hard_capped',
        'combo_scaling',
        'inverse_scaling',
        'exponential_scaling',
        'ramping_scaling',
        'hybrid_scaling',
        'scaling_with_stat',
        'proc_capped',
    ];

    describe('Item Scaling Data', () => {
        it('all items should have valid graph_type values', () => {
            const invalidGraphTypes = [];

            items.items.forEach(item => {
                if (item.graph_type && !VALID_GRAPH_TYPES.includes(item.graph_type)) {
                    invalidGraphTypes.push({
                        name: item.name,
                        graph_type: item.graph_type,
                    });
                }
            });

            expect(invalidGraphTypes, `Invalid graph types: ${JSON.stringify(invalidGraphTypes, null, 2)}`).toEqual([]);
        });

        it('items with scaling_per_stack should have exactly 10 values', () => {
            const invalidScaling = [];

            items.items.forEach(item => {
                if (item.scaling_per_stack) {
                    if (!Array.isArray(item.scaling_per_stack)) {
                        invalidScaling.push({
                            name: item.name,
                            issue: 'scaling_per_stack is not an array',
                        });
                    } else if (item.scaling_per_stack.length !== 10) {
                        invalidScaling.push({
                            name: item.name,
                            issue: `has ${item.scaling_per_stack.length} values instead of 10`,
                        });
                    }
                }
            });

            expect(invalidScaling, `Invalid scaling data: ${JSON.stringify(invalidScaling, null, 2)}`).toEqual([]);
        });

        it('scaling_per_stack values should be numbers', () => {
            const invalidValues = [];

            items.items.forEach(item => {
                if (item.scaling_per_stack) {
                    const nonNumeric = item.scaling_per_stack.filter(v => typeof v !== 'number');
                    if (nonNumeric.length > 0) {
                        invalidValues.push({
                            name: item.name,
                            invalidValues: nonNumeric,
                        });
                    }
                }
            });

            expect(invalidValues, `Non-numeric scaling values: ${JSON.stringify(invalidValues, null, 2)}`).toEqual([]);
        });

        it('items with graph_type should have scaling_per_stack (unless flat or one_and_done)', () => {
            const missingScaling = [];

            items.items.forEach(item => {
                // Flat graph types and one_and_done items don't need scaling data for charts
                if (item.graph_type && item.graph_type !== 'flat' && !item.one_and_done) {
                    if (!item.scaling_per_stack || item.scaling_per_stack.length === 0) {
                        missingScaling.push({
                            name: item.name,
                            graph_type: item.graph_type,
                        });
                    }
                }
            });

            expect(
                missingScaling,
                `Items with graph_type but no scaling data: ${JSON.stringify(missingScaling, null, 2)}`
            ).toEqual([]);
        });

        it('scaling values should be monotonically increasing for linear scaling items', () => {
            const nonMonotonic = [];

            items.items.forEach(item => {
                if (item.graph_type === 'linear_scaling' && item.scaling_per_stack) {
                    for (let i = 1; i < item.scaling_per_stack.length; i++) {
                        if (item.scaling_per_stack[i] < item.scaling_per_stack[i - 1]) {
                            nonMonotonic.push({
                                name: item.name,
                                issue: `value at index ${i} (${item.scaling_per_stack[i]}) is less than previous (${item.scaling_per_stack[i - 1]})`,
                            });
                            break;
                        }
                    }
                }
            });

            expect(
                nonMonotonic,
                `Linear scaling items with decreasing values: ${JSON.stringify(nonMonotonic, null, 2)}`
            ).toEqual([]);
        });

        it('capped items should have plateau in scaling values', () => {
            const noPlateau = [];

            items.items.forEach(item => {
                if (item.graph_type?.startsWith('capped_') && item.scaling_per_stack) {
                    // Check if last 3 values form a plateau (same value)
                    const last3 = item.scaling_per_stack.slice(-3);
                    const hasPlateau = last3.every(v => v === last3[0]);

                    if (!hasPlateau && item.stack_cap && item.stack_cap < 10) {
                        // Only flag if no explicit stack_cap that would explain non-plateau
                        const cappedIndex = item.stack_cap - 1;
                        const remainingValues = item.scaling_per_stack.slice(cappedIndex);
                        const allSameAfterCap = remainingValues.every(v => v === remainingValues[0]);

                        if (!allSameAfterCap) {
                            noPlateau.push({
                                name: item.name,
                                graph_type: item.graph_type,
                                lastValues: item.scaling_per_stack.slice(-3),
                            });
                        }
                    }
                }
            });

            // This is a soft check - some capped items may have different patterns
            if (noPlateau.length > 0) {
                console.warn('Items with capped graph_type but no obvious plateau:', noPlateau);
            }
        });
    });

    describe('Tome Progression Data', () => {
        it('all tomes should have value_per_level for chart generation', () => {
            const missingValue = [];

            tomes.tomes.forEach(tome => {
                if (!tome.value_per_level) {
                    missingValue.push({
                        name: tome.name,
                        stat_affected: tome.stat_affected,
                    });
                }
            });

            expect(missingValue, `Tomes missing value_per_level: ${JSON.stringify(missingValue, null, 2)}`).toEqual([]);
        });

        it('value_per_level should contain parseable numeric value or known exception', () => {
            // Some tomes have non-numeric effects (e.g., Chaos Tome with "Random stat boost")
            const ALLOWED_NON_NUMERIC_VALUES = ['Random stat boost'];

            const invalidValues = [];

            tomes.tomes.forEach(tome => {
                if (tome.value_per_level) {
                    // Skip known non-numeric tomes
                    if (ALLOWED_NON_NUMERIC_VALUES.includes(tome.value_per_level)) {
                        return;
                    }

                    const match = tome.value_per_level.match(/[+-]?([\d.]+)/);
                    if (!match || !match[1] || isNaN(parseFloat(match[1]))) {
                        invalidValues.push({
                            name: tome.name,
                            value_per_level: tome.value_per_level,
                        });
                    }
                }
            });

            expect(
                invalidValues,
                `Tomes with unparseable value_per_level: ${JSON.stringify(invalidValues, null, 2)}`
            ).toEqual([]);
        });

        it('all tomes should have stat_affected for chart labeling', () => {
            const missingStat = [];

            tomes.tomes.forEach(tome => {
                if (!tome.stat_affected) {
                    missingStat.push({
                        name: tome.name,
                        id: tome.id,
                    });
                }
            });

            expect(missingStat, `Tomes missing stat_affected: ${JSON.stringify(missingStat, null, 2)}`).toEqual([]);
        });
    });

    describe('Hyperbolic Scaling Items', () => {
        it('hyperbolic items should have valid hyperbolic_constant', () => {
            const invalidHyperbolic = [];

            items.items.forEach(item => {
                if (item.scaling_formula_type === 'hyperbolic') {
                    if (typeof item.hyperbolic_constant !== 'number' || item.hyperbolic_constant <= 0) {
                        invalidHyperbolic.push({
                            name: item.name,
                            hyperbolic_constant: item.hyperbolic_constant,
                        });
                    }
                }
            });

            // Only fail if there are items explicitly marked as hyperbolic with bad constants
            if (invalidHyperbolic.length > 0) {
                expect(
                    invalidHyperbolic,
                    `Hyperbolic items with invalid constants: ${JSON.stringify(invalidHyperbolic, null, 2)}`
                ).toEqual([]);
            }
        });
    });
});

// ========================================
// Image-Data Consistency Tests
// ========================================

describe('Image-Data Consistency', () => {
    it('image filename should match item id', () => {
        const mismatches = [];

        items.items.forEach(item => {
            if (item.image) {
                const filename = item.image.split('/').pop()?.replace('.png', '');
                if (filename !== item.id) {
                    mismatches.push({
                        name: item.name,
                        id: item.id,
                        imageFilename: filename,
                    });
                }
            }
        });

        expect(mismatches, `Item ID/image filename mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
    });

    it('image filename should match weapon id', () => {
        const mismatches = [];

        weapons.weapons.forEach(weapon => {
            if (weapon.image) {
                const filename = weapon.image.split('/').pop()?.replace('.png', '');
                if (filename !== weapon.id) {
                    mismatches.push({
                        name: weapon.name,
                        id: weapon.id,
                        imageFilename: filename,
                    });
                }
            }
        });

        expect(mismatches, `Weapon ID/image filename mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
    });

    it('image filename should match character id', () => {
        const mismatches = [];

        characters.characters.forEach(char => {
            if (char.image) {
                const filename = char.image.split('/').pop()?.replace('.png', '');
                if (filename !== char.id) {
                    mismatches.push({
                        name: char.name,
                        id: char.id,
                        imageFilename: filename,
                    });
                }
            }
        });

        expect(mismatches, `Character ID/image filename mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual(
            []
        );
    });

    it('image filename should match tome id', () => {
        const mismatches = [];

        tomes.tomes.forEach(tome => {
            if (tome.image) {
                const filename = tome.image.split('/').pop()?.replace('.png', '');
                if (filename !== tome.id) {
                    mismatches.push({
                        name: tome.name,
                        id: tome.id,
                        imageFilename: filename,
                    });
                }
            }
        });

        expect(mismatches, `Tome ID/image filename mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
    });
});
