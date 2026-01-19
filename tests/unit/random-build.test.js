import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock the data service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                { id: 'item_common', name: 'Common Item', tier: 'C', rarity: 'common', one_and_done: false },
                { id: 'item_rare', name: 'Rare Item', tier: 'A', rarity: 'rare', one_and_done: false },
                { id: 'item_legendary', name: 'Legendary Item', tier: 'SS', rarity: 'legendary', one_and_done: false },
                { id: 'item_one_done', name: 'One And Done', tier: 'B', rarity: 'uncommon', one_and_done: true },
                { id: 'item_b_tier', name: 'B Tier Item', tier: 'B', rarity: 'common', one_and_done: false },
                { id: 'item_c_tier', name: 'C Tier Item', tier: 'C', rarity: 'common', one_and_done: false },
                { id: 'item_stacks', name: 'Stacking Item', tier: 'A', rarity: 'epic', one_and_done: false },
            ],
        },
        weapons: {
            weapons: [
                { id: 'weapon_a', name: 'A Tier Weapon', tier: 'A' },
                { id: 'weapon_b', name: 'B Tier Weapon', tier: 'B' },
                { id: 'weapon_ss', name: 'SS Tier Weapon', tier: 'SS' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'tome_1', name: 'Tome 1', tier: 'S', priority: 1 },
                { id: 'tome_2', name: 'Tome 2', tier: 'A', priority: 2 },
                { id: 'tome_3', name: 'Tome 3', tier: 'B', priority: 3 },
                { id: 'tome_4', name: 'Tome 4', tier: 'C', priority: 4 },
            ],
        },
        characters: {
            characters: [
                { id: 'char_a', name: 'A Tier Character', tier: 'A' },
                { id: 'char_b', name: 'B Tier Character', tier: 'B' },
                { id: 'char_ss', name: 'SS Tier Character', tier: 'SS' },
            ],
        },
    },
}));

import {
    generateRandomBuild,
    renderRandomBuildSection,
    renderBuildPreview,
} from '../../src/modules/random-build.ts';

describe('Random Build Generator Module', () => {
    beforeEach(() => {
        createMinimalDOM();
    });

    describe('generateRandomBuild()', () => {
        it('should generate a build with character, weapon, tomes, and items', () => {
            const build = generateRandomBuild();

            expect(build.character).not.toBeNull();
            expect(build.weapon).not.toBeNull();
            expect(build.tomes.length).toBeGreaterThan(0);
            expect(build.items.length).toBeGreaterThan(0);
        });

        it('should generate 3 tomes by default', () => {
            const build = generateRandomBuild();
            expect(build.tomes).toHaveLength(3);
        });

        it('should generate 6 items by default', () => {
            const build = generateRandomBuild();
            expect(build.items).toHaveLength(6);
        });

        it('should store constraints in the build', () => {
            const constraints = { noLegendary: true };
            const build = generateRandomBuild(constraints);

            expect(build.constraints).toEqual(constraints);
        });

        describe('constraints', () => {
            it('should exclude legendary items when noLegendary is true', () => {
                // Run multiple times to ensure constraint is respected
                for (let i = 0; i < 10; i++) {
                    const build = generateRandomBuild({ noLegendary: true });
                    const hasLegendary = build.items.some(item => item.rarity === 'legendary');
                    expect(hasLegendary).toBe(false);
                }
            });

            it('should exclude SS tier items when noSSItems is true', () => {
                for (let i = 0; i < 10; i++) {
                    const build = generateRandomBuild({ noSSItems: true });
                    const hasSS = build.items.some(item => item.tier === 'SS');
                    expect(hasSS).toBe(false);
                }
            });

            it('should only include one-and-done items when onlyOneAndDone is true', () => {
                const build = generateRandomBuild({ onlyOneAndDone: true });

                // Should have at least some items (the one_and_done item)
                // All items should be one_and_done
                build.items.forEach(item => {
                    expect(item.one_and_done).toBe(true);
                });
            });

            it('should only include B/C tier in challenge mode', () => {
                for (let i = 0; i < 10; i++) {
                    const build = generateRandomBuild({ challengeMode: true });

                    build.items.forEach(item => {
                        expect(['B', 'C']).toContain(item.tier);
                    });
                }
            });

            it('should filter weapons in challenge mode', () => {
                for (let i = 0; i < 10; i++) {
                    const build = generateRandomBuild({ challengeMode: true });

                    if (build.weapon) {
                        expect(['B', 'C']).toContain(build.weapon.tier);
                    }
                }
            });

            it('should filter characters in challenge mode', () => {
                for (let i = 0; i < 10; i++) {
                    const build = generateRandomBuild({ challengeMode: true });

                    if (build.character) {
                        expect(['B', 'C']).toContain(build.character.tier);
                    }
                }
            });
        });

        describe('randomness', () => {
            it('should generate different builds on subsequent calls', () => {
                const builds = [];
                for (let i = 0; i < 5; i++) {
                    builds.push(generateRandomBuild());
                }

                // At least some builds should be different
                const uniqueCharacters = new Set(builds.map(b => b.character?.id));
                const uniqueWeapons = new Set(builds.map(b => b.weapon?.id));

                // With randomness, we should get at least some variation
                // (not a guarantee but highly likely with 5 builds)
                expect(uniqueCharacters.size + uniqueWeapons.size).toBeGreaterThan(2);
            });
        });
    });

    describe('renderRandomBuildSection()', () => {
        it('should render the random build generator UI', () => {
            const html = renderRandomBuildSection();

            expect(html).toContain('random-build-section');
            expect(html).toContain('Random Build Generator');
            expect(html).toContain('generate-random-build');
        });

        it('should include constraint toggles', () => {
            const html = renderRandomBuildSection();

            expect(html).toContain('No Legendary');
            expect(html).toContain('No SS Tier');
            expect(html).toContain('One-and-Done Only');
            expect(html).toContain('Challenge Mode');
        });

        it('should include the generate button', () => {
            const html = renderRandomBuildSection();

            expect(html).toContain('Generate Random Build');
            expect(html).toContain('dice-icon');
        });

        it('should include result container (hidden by default)', () => {
            const html = renderRandomBuildSection();

            expect(html).toContain('random-build-result');
            expect(html).toContain('style="display: none;"');
        });
    });

    describe('renderBuildPreview()', () => {
        it('should render character slot', () => {
            const build = generateRandomBuild();
            const html = renderBuildPreview(build);

            expect(html).toContain('Character');
            expect(html).toContain(build.character.name);
        });

        it('should render weapon slot', () => {
            const build = generateRandomBuild();
            const html = renderBuildPreview(build);

            expect(html).toContain('Weapon');
            expect(html).toContain(build.weapon.name);
        });

        it('should render tome slots', () => {
            const build = generateRandomBuild();
            const html = renderBuildPreview(build);

            build.tomes.forEach((tome, index) => {
                expect(html).toContain(`Tome ${index + 1}`);
                expect(html).toContain(tome.name);
            });
        });

        it('should render item slots', () => {
            const build = generateRandomBuild();
            const html = renderBuildPreview(build);

            build.items.forEach((item, index) => {
                expect(html).toContain(`Item ${index + 1}`);
                expect(html).toContain(item.name);
            });
        });

        it('should use slot-image class for images', () => {
            const build = generateRandomBuild();
            const html = renderBuildPreview(build);

            expect(html).toContain('slot-image');
        });
    });
});
