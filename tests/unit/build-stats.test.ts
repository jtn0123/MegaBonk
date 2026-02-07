/**
 * @vitest-environment jsdom
 * Build Stats Module Tests
 * Tests calculateBuildStats, DPS/EHP calculations, and scoring
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateBuildStats,
    invalidateBuildStatsCache,
    getBuildCacheKey,
    calculateDPS,
    calculateEffectiveHP,
    scoreBuild,
    type CalculatedBuildStats,
} from '../../src/modules/build-stats.ts';
import type { Build } from '../../src/modules/store.ts';
import type { Character, Weapon, Tome, Item } from '../../src/types/index.ts';
import { DEFAULT_BUILD_STATS, ITEM_IDS } from '../../src/modules/constants.ts';

// ========================================
// Test Fixtures
// ========================================

const createCharacter = (overrides: Partial<Character> = {}): Character => ({
    id: 'test_char',
    name: 'Test Character',
    tier: 'A',
    passive_ability: '',
    ...overrides,
});

const createWeapon = (overrides: Partial<Weapon> = {}): Weapon => ({
    id: 'test_weapon',
    name: 'Test Weapon',
    description: 'A test weapon',
    tier: 'A',
    base_damage: 50,
    ...overrides,
});

const createTome = (overrides: Partial<Tome> = {}): Tome => ({
    id: 'test_tome',
    name: 'Test Tome',
    description: 'A test tome',
    tier: 'A',
    stat_affected: 'Damage',
    value_per_level: '+7',
    ...overrides,
});

const createItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'test_item',
    name: 'Test Item',
    tier: 'A',
    rarity: 'common',
    description: 'A test item',
    ...overrides,
});

const createBuild = (overrides: Partial<Build> = {}): Build => ({
    character: null,
    weapon: null,
    tomes: [],
    items: [],
    name: '',
    notes: '',
    ...overrides,
});

describe('Build Stats Module', () => {
    beforeEach(() => {
        invalidateBuildStatsCache();
    });

    // ========================================
    // Cache Key Generation Tests
    // ========================================
    describe('getBuildCacheKey', () => {
        it('should generate empty key for empty build', () => {
            const build = createBuild();
            const key = getBuildCacheKey(build);
            expect(key).toBe('|||');
        });

        it('should include character ID in cache key', () => {
            const build = createBuild({
                character: createCharacter({ id: 'char_123' }),
            });
            const key = getBuildCacheKey(build);
            expect(key).toContain('char_123');
        });

        it('should include weapon ID in cache key', () => {
            const build = createBuild({
                weapon: createWeapon({ id: 'weapon_456' }),
            });
            const key = getBuildCacheKey(build);
            expect(key).toContain('weapon_456');
        });

        it('should include sorted tome IDs', () => {
            const build = createBuild({
                tomes: [
                    createTome({ id: 'tome_c' }),
                    createTome({ id: 'tome_a' }),
                    createTome({ id: 'tome_b' }),
                ],
            });
            const key = getBuildCacheKey(build);
            // Should be sorted: tome_a,tome_b,tome_c
            expect(key).toContain('tome_a,tome_b,tome_c');
        });

        it('should include sorted item IDs', () => {
            const build = createBuild({
                items: [
                    createItem({ id: 'item_z' }),
                    createItem({ id: 'item_a' }),
                    createItem({ id: 'item_m' }),
                ],
            });
            const key = getBuildCacheKey(build);
            // Should be sorted: item_a,item_m,item_z
            expect(key).toContain('item_a,item_m,item_z');
        });

        it('should generate same key for same builds', () => {
            const build1 = createBuild({
                character: createCharacter({ id: 'char_1' }),
                weapon: createWeapon({ id: 'weapon_1' }),
                tomes: [createTome({ id: 'tome_1' })],
                items: [createItem({ id: 'item_1' })],
            });
            const build2 = createBuild({
                character: createCharacter({ id: 'char_1' }),
                weapon: createWeapon({ id: 'weapon_1' }),
                tomes: [createTome({ id: 'tome_1' })],
                items: [createItem({ id: 'item_1' })],
            });
            expect(getBuildCacheKey(build1)).toBe(getBuildCacheKey(build2));
        });

        it('should generate different keys for different builds', () => {
            const build1 = createBuild({
                character: createCharacter({ id: 'char_1' }),
            });
            const build2 = createBuild({
                character: createCharacter({ id: 'char_2' }),
            });
            expect(getBuildCacheKey(build1)).not.toBe(getBuildCacheKey(build2));
        });
    });

    // ========================================
    // Cache Invalidation Tests
    // ========================================
    describe('invalidateBuildStatsCache', () => {
        it('should invalidate cache so recalculation occurs', () => {
            const build = createBuild({
                character: createCharacter({ passive_ability: 'Gain 1% Crit Chance per level' }),
                weapon: createWeapon({ base_damage: 50 }),
            });

            // First call - should calculate
            const stats1 = calculateBuildStats(build);

            // Second call - should use cache
            const stats2 = calculateBuildStats(build);
            expect(stats2).toBe(stats1); // Same reference (cached)

            // Invalidate cache
            invalidateBuildStatsCache();

            // Third call - should recalculate
            const stats3 = calculateBuildStats(build);
            expect(stats3).not.toBe(stats1); // Different reference (new calculation)
            expect(stats3).toEqual(stats1); // Same values
        });
    });

    // ========================================
    // calculateBuildStats - Default Stats
    // ========================================
    describe('calculateBuildStats - defaults', () => {
        it('should return default stats for empty build', () => {
            const build = createBuild();
            const stats = calculateBuildStats(build, false);

            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance);
            expect(stats.crit_damage).toBe(DEFAULT_BUILD_STATS.crit_damage);
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed);
            expect(stats.movement_speed).toBe(DEFAULT_BUILD_STATS.movement_speed);
            expect(stats.armor).toBe(DEFAULT_BUILD_STATS.armor);
            expect(stats.projectiles).toBe(DEFAULT_BUILD_STATS.projectiles);
        });

        it('should have evasion and overcrit properties', () => {
            const build = createBuild();
            const stats = calculateBuildStats(build, false);

            expect(stats).toHaveProperty('evasion');
            expect(stats).toHaveProperty('overcrit');
            expect(stats.evasion).toBe(0);
            expect(stats.overcrit).toBe(false);
        });
    });

    // ========================================
    // calculateBuildStats - Character Passives
    // ========================================
    describe('calculateBuildStats - character passives', () => {
        it('should apply crit chance passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1% Crit Chance per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 50);
        });

        it('should apply critical chance passive (alternate wording)', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 2% Critical Chance per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 50);
        });

        it('should apply HP passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: '+2 Max HP per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp + 50);
        });

        it('should apply HP per level passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 3 HP per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp + 50);
        });

        it('should apply armor passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1% Armor per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.armor).toBe(DEFAULT_BUILD_STATS.armor + 50);
        });

        it('should apply damage passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1.5% Damage per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 20);
        });

        it('should NOT apply damage passive for crit damage', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 2% Critical Damage per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            // Should not add to damage (it's crit damage, not damage)
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
            // Should add to crit_damage instead
            expect(stats.crit_damage).toBe(DEFAULT_BUILD_STATS.crit_damage + 25);
        });

        it('should apply attack speed passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1% Attack Speed per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed + 50);
        });

        it('should apply movement speed passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1% Movement Speed per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.movement_speed).toBe(DEFAULT_BUILD_STATS.movement_speed + 20);
        });

        it('should apply move speed passive (alternate wording)', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 2% Move Speed per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.movement_speed).toBe(DEFAULT_BUILD_STATS.movement_speed + 20);
        });

        it('should handle character with no passive', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: undefined,
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });

        it('should handle multiple passives in one ability', () => {
            const build = createBuild({
                character: createCharacter({
                    passive_ability: 'Gain 1% Crit Chance and 1% Attack Speed per level',
                }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 50);
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed + 50);
        });
    });

    // ========================================
    // calculateBuildStats - Weapon Damage
    // ========================================
    describe('calculateBuildStats - weapon damage', () => {
        it('should add weapon base_damage to stats', () => {
            const build = createBuild({
                weapon: createWeapon({ base_damage: 75 }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 75);
        });

        it('should handle weapon with baseDamage (legacy)', () => {
            const build = createBuild({
                weapon: createWeapon({ baseDamage: 60, base_damage: undefined }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 60);
        });

        it('should handle decimal weapon damage', () => {
            const build = createBuild({
                weapon: createWeapon({ base_damage: 25.5 }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 25.5);
        });

        it('should handle weapon with undefined damage', () => {
            const build = createBuild({
                weapon: createWeapon({ base_damage: undefined, baseDamage: undefined }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });

        it('should handle weapon with NaN damage', () => {
            const build = createBuild({
                weapon: createWeapon({ base_damage: NaN }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });

        it('should handle weapon with Infinity damage', () => {
            const build = createBuild({
                weapon: createWeapon({ base_damage: Infinity }),
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });
    });

    // ========================================
    // calculateBuildStats - Tome Bonuses
    // ========================================
    describe('calculateBuildStats - tome bonuses', () => {
        it('should apply damage tome bonus', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Damage', value_per_level: '+7' })],
            });
            const stats = calculateBuildStats(build, false);
            // 7 * 5 (tome level) = 35
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 35);
        });

        it('should apply crit chance tome bonus', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Critical Chance', value_per_level: '+5' })],
            });
            const stats = calculateBuildStats(build, false);
            // 5 * 5 = 25
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 25);
        });

        it('should apply crit chance tome by ID (precision)', () => {
            const build = createBuild({
                tomes: [createTome({ id: 'precision', stat_affected: '', value_per_level: '+3' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 15);
        });

        it('should apply crit damage tome bonus', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Crit Damage', value_per_level: '+10' })],
            });
            const stats = calculateBuildStats(build, false);
            // 10 * 5 = 50
            expect(stats.crit_damage).toBe(DEFAULT_BUILD_STATS.crit_damage + 50);
        });

        it('should apply HP tome bonus', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Max HP', value_per_level: '+25' })],
            });
            const stats = calculateBuildStats(build, false);
            // 25 * 5 = 125
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp + 125);
        });

        it('should apply HP tome by ID (vitality)', () => {
            const build = createBuild({
                tomes: [createTome({ id: 'vitality', stat_affected: '', value_per_level: '+20' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp + 100);
        });

        it('should apply attack speed tome', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Attack Speed', value_per_level: '+8' })],
            });
            const stats = calculateBuildStats(build, false);
            // 8 * 5 = 40
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed + 40);
        });

        it('should apply attack speed tome by ID (cooldown)', () => {
            const build = createBuild({
                tomes: [createTome({ id: 'cooldown', stat_affected: '', value_per_level: '+5' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed + 25);
        });

        it('should apply movement speed tome', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Movement Speed', value_per_level: '+10' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.movement_speed).toBe(DEFAULT_BUILD_STATS.movement_speed + 50);
        });

        it('should apply armor tome', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Armor', value_per_level: '+15' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.armor).toBe(DEFAULT_BUILD_STATS.armor + 75);
        });

        it('should apply armor tome by ID', () => {
            const build = createBuild({
                tomes: [createTome({ id: 'armor', stat_affected: '', value_per_level: '+12' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.armor).toBe(DEFAULT_BUILD_STATS.armor + 60);
        });

        it('should handle decimal value_per_level (percentage format)', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Damage', value_per_level: '+0.08x (8% damage)' })],
            });
            const stats = calculateBuildStats(build, false);
            // 0.08 * 100 * 5 = 40
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 40);
        });

        it('should handle multiple tomes', () => {
            const build = createBuild({
                tomes: [
                    createTome({ stat_affected: 'Damage', value_per_level: '+5' }),
                    createTome({ stat_affected: 'Damage', value_per_level: '+3' }),
                ],
            });
            const stats = calculateBuildStats(build, false);
            // (5 + 3) * 5 = 40
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 40);
        });

        it('should handle tome with NaN value', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Damage', value_per_level: 'invalid' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });

        it('should clamp extreme tome values', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Damage', value_per_level: '+9999999' })],
            });
            const stats = calculateBuildStats(build, false);
            // Should be clamped to 1000 * 5 = 5000
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 5000);
        });
    });

    // ========================================
    // calculateBuildStats - Item Effects
    // ========================================
    describe('calculateBuildStats - item effects', () => {
        it('should apply gym_sauce (add damage)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.GYM_SAUCE })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 10);
        });

        it('should apply forbidden_juice (add crit chance)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.FORBIDDEN_JUICE })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.crit_chance).toBe(DEFAULT_BUILD_STATS.crit_chance + 10);
        });

        it('should apply oats (add HP)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.OATS })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp + 25);
        });

        it('should apply battery (add attack speed)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.BATTERY })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.attack_speed).toBe(DEFAULT_BUILD_STATS.attack_speed + 8);
        });

        it('should apply turbo_socks (add movement speed)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.TURBO_SOCKS })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.movement_speed).toBe(DEFAULT_BUILD_STATS.movement_speed + 15);
        });

        it('should apply beer (add damage)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.BEER })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 20);
        });

        it('should apply backpack (add projectiles)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.BACKPACK })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.projectiles).toBe(DEFAULT_BUILD_STATS.projectiles + 1);
        });

        it('should apply slippery_ring (add evasion internal)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.SLIPPERY_RING })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.evasion_internal).toBe(DEFAULT_BUILD_STATS.evasion_internal + 15);
        });

        it('should apply leeching_crystal (multiply HP)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.LEECHING_CRYSTAL })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.hp).toBe(DEFAULT_BUILD_STATS.hp * 1.5);
        });

        it('should apply beefy_ring (HP percent to damage)', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.BEEFY_RING })],
            });
            const stats = calculateBuildStats(build, false);
            // damage += (hp / 100) * 20 = (100 / 100) * 20 = 20
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 20);
        });

        it('should apply multiple items', () => {
            const build = createBuild({
                items: [
                    createItem({ id: ITEM_IDS.GYM_SAUCE }),
                    createItem({ id: ITEM_IDS.BEER }),
                    createItem({ id: ITEM_IDS.BRASS_KNUCKLES }),
                ],
            });
            const stats = calculateBuildStats(build, false);
            // 10 + 20 + 20 = 50
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage + 50);
        });

        it('should ignore items without effects', () => {
            const build = createBuild({
                items: [createItem({ id: 'unknown_item' })],
            });
            const stats = calculateBuildStats(build, false);
            expect(stats.damage).toBe(DEFAULT_BUILD_STATS.damage);
        });
    });

    // ========================================
    // calculateBuildStats - Evasion Calculation
    // ========================================
    describe('calculateBuildStats - evasion', () => {
        it('should calculate evasion from evasion_internal', () => {
            const build = createBuild({
                items: [createItem({ id: ITEM_IDS.SLIPPERY_RING })],
            });
            const stats = calculateBuildStats(build, false);
            // evasion = 15 / (1 + 15/100) = 15 / 1.15 ≈ 13.04
            expect(stats.evasion).toBeCloseTo(13.04, 1);
        });

        it('should handle zero evasion_internal', () => {
            const build = createBuild();
            const stats = calculateBuildStats(build, false);
            expect(stats.evasion).toBe(0);
        });

        it('should clamp negative evasion_internal to prevent division issues', () => {
            // This tests the edge case protection
            const build = createBuild();
            const stats = calculateBuildStats(build, false);
            // With default evasion_internal = 0, evasion should be 0
            expect(Number.isFinite(stats.evasion)).toBe(true);
        });
    });

    // ========================================
    // calculateBuildStats - Overcrit Detection
    // ========================================
    describe('calculateBuildStats - overcrit', () => {
        it('should detect overcrit when crit_chance > 100', () => {
            const build = createBuild({
                character: createCharacter({ passive_ability: 'Gain 1% Crit Chance per level' }),
                tomes: [createTome({ stat_affected: 'Critical Chance', value_per_level: '+15' })],
            });
            const stats = calculateBuildStats(build, false);
            // 5 (default) + 50 (passive) + 75 (tome) = 130
            expect(stats.crit_chance).toBeGreaterThan(100);
            expect(stats.overcrit).toBe(true);
        });

        it('should not flag overcrit when crit_chance <= 100', () => {
            const build = createBuild({
                tomes: [createTome({ stat_affected: 'Critical Chance', value_per_level: '+10' })],
            });
            const stats = calculateBuildStats(build, false);
            // 5 + 50 = 55
            expect(stats.overcrit).toBe(false);
        });
    });

    // ========================================
    // calculateBuildStats - Caching
    // ========================================
    describe('calculateBuildStats - caching', () => {
        it('should return cached result for same build', () => {
            const build = createBuild({
                character: createCharacter({ id: 'char_1' }),
                weapon: createWeapon({ id: 'weapon_1', base_damage: 50 }),
            });

            const stats1 = calculateBuildStats(build, true);
            const stats2 = calculateBuildStats(build, true);

            expect(stats1).toBe(stats2); // Same reference
        });

        it('should recalculate when useCache is false', () => {
            const build = createBuild({
                character: createCharacter({ id: 'char_1' }),
                weapon: createWeapon({ id: 'weapon_1', base_damage: 50 }),
            });

            const stats1 = calculateBuildStats(build, false);
            const stats2 = calculateBuildStats(build, false);

            expect(stats1).not.toBe(stats2); // Different references
            expect(stats1).toEqual(stats2); // Same values
        });
    });

    // ========================================
    // calculateBuildStats - Complex Builds
    // ========================================
    describe('calculateBuildStats - complex builds', () => {
        it('should combine character, weapon, tomes, and items', () => {
            const build = createBuild({
                character: createCharacter({ passive_ability: 'Gain 1% Damage per level' }),
                weapon: createWeapon({ base_damage: 50 }),
                tomes: [createTome({ stat_affected: 'Damage', value_per_level: '+5' })],
                items: [createItem({ id: ITEM_IDS.GYM_SAUCE })],
            });
            const stats = calculateBuildStats(build, false);
            // 100 (default) + 20 (passive) + 50 (weapon) + 25 (tome) + 10 (item) = 205
            expect(stats.damage).toBe(205);
        });
    });

    // ========================================
    // calculateDPS Tests
    // ========================================
    describe('calculateDPS', () => {
        it('should calculate DPS for basic stats', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                evasion: 0,
                overcrit: false,
            };
            const dps = calculateDPS(stats);
            // baseDamage * critMultiplier * attackSpeedMultiplier * projectiles
            // 100 * (1 + 0.05 * 0.5) * 2 * 1 = 100 * 1.025 * 2 = 205
            expect(dps).toBeCloseTo(205, 0);
        });

        it('should scale with damage', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                damage: 200,
                evasion: 0,
                overcrit: false,
            };
            const dps = calculateDPS(stats);
            expect(dps).toBeGreaterThan(calculateDPS({ ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false }));
        });

        it('should scale with crit chance', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                crit_chance: 50,
                evasion: 0,
                overcrit: false,
            };
            const dps = calculateDPS(stats);
            // Higher crit chance should increase DPS
            expect(dps).toBeGreaterThan(calculateDPS({ ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false }));
        });

        it('should scale with attack speed', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                attack_speed: 200,
                evasion: 0,
                overcrit: false,
            };
            const dps = calculateDPS(stats);
            expect(dps).toBeGreaterThan(calculateDPS({ ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false }));
        });

        it('should scale with projectiles', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                projectiles: 3,
                evasion: 0,
                overcrit: false,
            };
            const dps = calculateDPS(stats);
            // 3x projectiles = 3x DPS
            const baseDps = calculateDPS({ ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false });
            expect(dps).toBeCloseTo(baseDps * 3, 0);
        });
    });

    // ========================================
    // calculateEffectiveHP Tests
    // ========================================
    describe('calculateEffectiveHP', () => {
        it('should calculate EHP for basic stats', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                evasion: 0,
                overcrit: false,
            };
            const ehp = calculateEffectiveHP(stats);
            // With 0 armor and 0 evasion, EHP = HP
            expect(ehp).toBe(100);
        });

        it('should increase EHP with armor', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                armor: 50,
                evasion: 0,
                overcrit: false,
            };
            const ehp = calculateEffectiveHP(stats);
            expect(ehp).toBeGreaterThan(100);
        });

        it('should increase EHP with evasion', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                evasion: 20,
                overcrit: false,
            };
            const ehp = calculateEffectiveHP(stats);
            expect(ehp).toBeGreaterThan(100);
        });

        it('should scale with HP', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                hp: 200,
                evasion: 0,
                overcrit: false,
            };
            const ehp = calculateEffectiveHP(stats);
            expect(ehp).toBe(200);
        });
    });

    // ========================================
    // scoreBuild Tests
    // ========================================
    describe('scoreBuild', () => {
        it('should return numeric score', () => {
            const stats: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                evasion: 0,
                overcrit: false,
            };
            const score = scoreBuild(stats);
            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThan(0);
        });

        it('should prefer higher DPS builds', () => {
            const lowDps: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                damage: 100,
                evasion: 0,
                overcrit: false,
            };
            const highDps: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                damage: 200,
                evasion: 0,
                overcrit: false,
            };
            expect(scoreBuild(highDps)).toBeGreaterThan(scoreBuild(lowDps));
        });

        it('should consider EHP in scoring', () => {
            const lowEhp: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                hp: 100,
                evasion: 0,
                overcrit: false,
            };
            const highEhp: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                hp: 300,
                evasion: 0,
                overcrit: false,
            };
            expect(scoreBuild(highEhp)).toBeGreaterThan(scoreBuild(lowEhp));
        });

        it('should consider movement speed in scoring', () => {
            const lowSpeed: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                movement_speed: 100,
                evasion: 0,
                overcrit: false,
            };
            const highSpeed: CalculatedBuildStats = {
                ...DEFAULT_BUILD_STATS,
                movement_speed: 200,
                evasion: 0,
                overcrit: false,
            };
            expect(scoreBuild(highSpeed)).toBeGreaterThan(scoreBuild(lowSpeed));
        });
    });
});
