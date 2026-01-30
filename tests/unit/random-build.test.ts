/**
 * @vitest-environment jsdom
 * Random Build Generator Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateRandomBuild } from '../../src/modules/random-build.ts';
import type { Item, Weapon, Character, Tome, Rarity, Tier } from '../../src/types/index.ts';

// Mock data-service with test data
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        characters: {
            characters: [
                { id: 'warrior', name: 'Warrior', tier: 'A', rarity: 'common' },
                { id: 'mage', name: 'Mage', tier: 'S', rarity: 'rare' },
                { id: 'rogue', name: 'Rogue', tier: 'B', rarity: 'uncommon' },
                { id: 'paladin', name: 'Paladin', tier: 'SS', rarity: 'legendary' },
                { id: 'peasant', name: 'Peasant', tier: 'C', rarity: 'common' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'sword', name: 'Sword', tier: 'A', rarity: 'common' },
                { id: 'staff', name: 'Staff', tier: 'S', rarity: 'rare' },
                { id: 'dagger', name: 'Dagger', tier: 'B', rarity: 'uncommon' },
                { id: 'legendary_blade', name: 'Legendary Blade', tier: 'SS', rarity: 'legendary' },
                { id: 'stick', name: 'Stick', tier: 'C', rarity: 'common' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'tome1', name: 'Tome 1', priority: 1 },
                { id: 'tome2', name: 'Tome 2', priority: 2 },
                { id: 'tome3', name: 'Tome 3', priority: 3 },
                { id: 'tome4', name: 'Tome 4', priority: 4 },
                { id: 'tome5', name: 'Tome 5', priority: 5 },
            ],
        },
        items: {
            items: [
                { id: 'item1', name: 'Common Item', tier: 'C', rarity: 'common', one_and_done: false },
                { id: 'item2', name: 'Uncommon Item', tier: 'B', rarity: 'uncommon', one_and_done: false },
                { id: 'item3', name: 'Rare Item', tier: 'A', rarity: 'rare', one_and_done: false },
                { id: 'item4', name: 'Epic Item', tier: 'S', rarity: 'epic', one_and_done: false },
                { id: 'item5', name: 'Legendary Item', tier: 'SS', rarity: 'legendary', one_and_done: false },
                { id: 'oad1', name: 'One And Done 1', tier: 'A', rarity: 'common', one_and_done: true },
                { id: 'oad2', name: 'One And Done 2', tier: 'B', rarity: 'uncommon', one_and_done: true },
                { id: 'item6', name: 'Extra Item', tier: 'A', rarity: 'rare', one_and_done: false },
                { id: 'item7', name: 'Another Item', tier: 'B', rarity: 'common', one_and_done: false },
                { id: 'item8', name: 'Yet Another', tier: 'C', rarity: 'common', one_and_done: false },
            ],
        },
    },
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', () => ({
    escapeHtml: (s: string) => s,
    generateEntityImage: () => 'test.png',
}));

describe('Random Build Generator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // Basic Generation Tests
    // ========================================
    describe('generateRandomBuild', () => {
        it('should return a build object with all required properties', () => {
            const build = generateRandomBuild();
            
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
            expect(build).toHaveProperty('constraints');
        });

        it('should select a character', () => {
            const build = generateRandomBuild();
            
            expect(build.character).not.toBeNull();
            expect(build.character).toHaveProperty('id');
            expect(build.character).toHaveProperty('name');
        });

        it('should select a weapon', () => {
            const build = generateRandomBuild();
            
            expect(build.weapon).not.toBeNull();
            expect(build.weapon).toHaveProperty('id');
            expect(build.weapon).toHaveProperty('name');
        });

        it('should select tomes', () => {
            const build = generateRandomBuild();
            
            expect(Array.isArray(build.tomes)).toBe(true);
            expect(build.tomes.length).toBeGreaterThan(0);
        });

        it('should select items', () => {
            const build = generateRandomBuild();
            
            expect(Array.isArray(build.items)).toBe(true);
            expect(build.items.length).toBeGreaterThan(0);
        });

        it('should select 3 tomes by default', () => {
            const build = generateRandomBuild();
            expect(build.tomes.length).toBe(3);
        });

        it('should select 6 items by default', () => {
            const build = generateRandomBuild();
            expect(build.items.length).toBe(6);
        });

        it('should store constraints in result', () => {
            const constraints = { noLegendary: true, noSSItems: true };
            const build = generateRandomBuild(constraints);
            
            expect(build.constraints).toEqual(constraints);
        });
    });

    // ========================================
    // Rarity Constraint Tests
    // ========================================
    describe('rarity constraints', () => {
        it('should respect noLegendary constraint', () => {
            const build = generateRandomBuild({ noLegendary: true });
            
            // Items should not include legendary
            build.items.forEach(item => {
                expect(item.rarity).not.toBe('legendary');
            });
        });

        it('should respect maxRarity constraint', () => {
            const build = generateRandomBuild({ maxRarity: 'uncommon' });
            
            const validRarities = ['common', 'uncommon'];
            build.items.forEach(item => {
                expect(validRarities).toContain(item.rarity);
            });
        });
    });

    // ========================================
    // Tier Constraint Tests
    // ========================================
    describe('tier constraints', () => {
        it('should respect noSSItems constraint', () => {
            const build = generateRandomBuild({ noSSItems: true });
            
            build.items.forEach(item => {
                expect(item.tier).not.toBe('SS');
            });
        });

        it('should respect maxTier constraint', () => {
            const build = generateRandomBuild({ maxTier: 'B' });
            
            const validTiers = ['C', 'B'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('should respect challengeMode (B tier or lower)', () => {
            const build = generateRandomBuild({ challengeMode: true });
            
            const validTiers = ['C', 'B'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });
    });

    // ========================================
    // One-and-Done Constraint Tests
    // ========================================
    describe('one-and-done constraint', () => {
        it('should only select one-and-done items when constrained', () => {
            const build = generateRandomBuild({ onlyOneAndDone: true });
            
            build.items.forEach(item => {
                expect(item.one_and_done).toBe(true);
            });
        });

        it('should select fewer items if not enough one-and-done available', () => {
            const build = generateRandomBuild({ onlyOneAndDone: true });
            
            // Only 2 one-and-done items in mock data
            expect(build.items.length).toBeLessThanOrEqual(2);
        });
    });

    // ========================================
    // Random Tome Count Tests
    // ========================================
    describe('random tome count', () => {
        it('should vary tome count when randomTomeCount is true', () => {
            const counts = new Set<number>();
            
            // Generate multiple builds to see variation
            for (let i = 0; i < 50; i++) {
                const build = generateRandomBuild({ randomTomeCount: true });
                counts.add(build.tomes.length);
            }
            
            // Should have at least some variation (2-5 range)
            expect(counts.size).toBeGreaterThan(1);
        });

        it('should generate between 2-5 tomes when random', () => {
            for (let i = 0; i < 20; i++) {
                const build = generateRandomBuild({ randomTomeCount: true });
                expect(build.tomes.length).toBeGreaterThanOrEqual(2);
                expect(build.tomes.length).toBeLessThanOrEqual(5);
            }
        });
    });

    // ========================================
    // Combined Constraints Tests
    // ========================================
    describe('combined constraints', () => {
        it('should apply multiple constraints together', () => {
            const build = generateRandomBuild({
                noLegendary: true,
                noSSItems: true,
                maxTier: 'A',
            });
            
            build.items.forEach(item => {
                expect(item.rarity).not.toBe('legendary');
                expect(item.tier).not.toBe('SS');
                expect(['C', 'B', 'A']).toContain(item.tier);
            });
        });

        it('should handle strict constraints that limit options', () => {
            const build = generateRandomBuild({
                maxRarity: 'common',
                maxTier: 'C',
            });
            
            build.items.forEach(item => {
                expect(item.rarity).toBe('common');
                expect(item.tier).toBe('C');
            });
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty constraints object', () => {
            const build = generateRandomBuild({});
            
            expect(build.character).not.toBeNull();
            expect(build.weapon).not.toBeNull();
        });

        it('should return unique items (no duplicates)', () => {
            const build = generateRandomBuild();
            
            const itemIds = build.items.map(i => i.id);
            const uniqueIds = new Set(itemIds);
            expect(uniqueIds.size).toBe(itemIds.length);
        });

        it('should return unique tomes (no duplicates)', () => {
            const build = generateRandomBuild();
            
            const tomeIds = build.tomes.map(t => t.id);
            const uniqueIds = new Set(tomeIds);
            expect(uniqueIds.size).toBe(tomeIds.length);
        });

        it('should produce different builds on multiple calls', () => {
            const builds: string[] = [];
            
            for (let i = 0; i < 10; i++) {
                const build = generateRandomBuild();
                const signature = `${build.character?.id}-${build.weapon?.id}`;
                builds.push(signature);
            }
            
            // At least some builds should be different
            const unique = new Set(builds);
            expect(unique.size).toBeGreaterThan(1);
        });
    });

    // ========================================
    // Deterministic Tests (seeded randomness would be better, but checking structure)
    // ========================================
    describe('build structure', () => {
        it('should always return valid structure even with restrictive constraints', () => {
            const build = generateRandomBuild({
                challengeMode: true,
                noLegendary: true,
                noSSItems: true,
                maxRarity: 'uncommon',
            });
            
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
            expect(Array.isArray(build.tomes)).toBe(true);
            expect(Array.isArray(build.items)).toBe(true);
        });
    });
});
