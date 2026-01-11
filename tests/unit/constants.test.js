import { describe, it, expect } from 'vitest';
import {
    TIER_ORDER,
    RARITY_ORDER,
    ITEM_IDS,
    ITEM_EFFECTS,
    DEFAULT_BUILD_STATS,
    MAX_COMPARE_ITEMS,
    BUILD_ITEMS_LIMIT,
    VALID_TIERS,
    VALID_RARITIES,
} from '../../src/modules/constants.ts';

describe('Constants Module', () => {
    describe('TIER_ORDER', () => {
        it('should have correct tier rankings (lower is better)', () => {
            expect(TIER_ORDER.SS).toBe(0);
            expect(TIER_ORDER.S).toBe(1);
            expect(TIER_ORDER.A).toBe(2);
            expect(TIER_ORDER.B).toBe(3);
            expect(TIER_ORDER.C).toBe(4);
        });

        it('should have SS as highest tier (lowest number)', () => {
            expect(TIER_ORDER.SS).toBeLessThan(TIER_ORDER.S);
            expect(TIER_ORDER.S).toBeLessThan(TIER_ORDER.A);
            expect(TIER_ORDER.A).toBeLessThan(TIER_ORDER.B);
            expect(TIER_ORDER.B).toBeLessThan(TIER_ORDER.C);
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(TIER_ORDER)).toBe(true);
        });

        it('should not allow modification', () => {
            expect(() => {
                TIER_ORDER.SS = 99;
            }).toThrow();
        });
    });

    describe('RARITY_ORDER', () => {
        it('should have correct rarity rankings (lower is rarer)', () => {
            expect(RARITY_ORDER.legendary).toBe(0);
            expect(RARITY_ORDER.epic).toBe(1);
            expect(RARITY_ORDER.rare).toBe(2);
            expect(RARITY_ORDER.uncommon).toBe(3);
            expect(RARITY_ORDER.common).toBe(4);
        });

        it('should have legendary as rarest (lowest number)', () => {
            expect(RARITY_ORDER.legendary).toBeLessThan(RARITY_ORDER.epic);
            expect(RARITY_ORDER.epic).toBeLessThan(RARITY_ORDER.rare);
            expect(RARITY_ORDER.rare).toBeLessThan(RARITY_ORDER.uncommon);
            expect(RARITY_ORDER.uncommon).toBeLessThan(RARITY_ORDER.common);
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(RARITY_ORDER)).toBe(true);
        });
    });

    describe('ITEM_IDS', () => {
        it('should have all expected item IDs', () => {
            expect(ITEM_IDS.GYM_SAUCE).toBe('gym_sauce');
            expect(ITEM_IDS.FORBIDDEN_JUICE).toBe('forbidden_juice');
            expect(ITEM_IDS.OATS).toBe('oats');
            expect(ITEM_IDS.BATTERY).toBe('battery');
            expect(ITEM_IDS.TURBO_SOCKS).toBe('turbo_socks');
            expect(ITEM_IDS.BEER).toBe('beer');
            expect(ITEM_IDS.BACKPACK).toBe('backpack');
            expect(ITEM_IDS.SLIPPERY_RING).toBe('slippery_ring');
            expect(ITEM_IDS.PHANTOM_SHROUD).toBe('phantom_shroud');
            expect(ITEM_IDS.BEEFY_RING).toBe('beefy_ring');
            expect(ITEM_IDS.LEECHING_CRYSTAL).toBe('leeching_crystal');
            expect(ITEM_IDS.BRASS_KNUCKLES).toBe('brass_knuckles');
            expect(ITEM_IDS.BOSS_BUSTER).toBe('boss_buster');
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(ITEM_IDS)).toBe(true);
        });

        it('should have consistent ID format (snake_case)', () => {
            Object.values(ITEM_IDS).forEach(id => {
                expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
            });
        });
    });

    describe('ITEM_EFFECTS', () => {
        it('should have effects for all known ITEM_IDS', () => {
            expect(ITEM_EFFECTS[ITEM_IDS.GYM_SAUCE]).toBeDefined();
            expect(ITEM_EFFECTS[ITEM_IDS.FORBIDDEN_JUICE]).toBeDefined();
            expect(ITEM_EFFECTS[ITEM_IDS.OATS]).toBeDefined();
            expect(ITEM_EFFECTS[ITEM_IDS.BEEFY_RING]).toBeDefined();
            expect(ITEM_EFFECTS[ITEM_IDS.LEECHING_CRYSTAL]).toBeDefined();
        });

        it('should have correct effect types', () => {
            expect(ITEM_EFFECTS[ITEM_IDS.GYM_SAUCE].type).toBe('add');
            expect(ITEM_EFFECTS[ITEM_IDS.BEEFY_RING].type).toBe('hp_percent');
            expect(ITEM_EFFECTS[ITEM_IDS.LEECHING_CRYSTAL].type).toBe('multiply');
        });

        it('should have correct stat targets', () => {
            expect(ITEM_EFFECTS[ITEM_IDS.GYM_SAUCE].stat).toBe('damage');
            expect(ITEM_EFFECTS[ITEM_IDS.FORBIDDEN_JUICE].stat).toBe('crit_chance');
            expect(ITEM_EFFECTS[ITEM_IDS.OATS].stat).toBe('hp');
            expect(ITEM_EFFECTS[ITEM_IDS.BATTERY].stat).toBe('attack_speed');
            expect(ITEM_EFFECTS[ITEM_IDS.TURBO_SOCKS].stat).toBe('movement_speed');
        });

        it('should have numeric values for all effects', () => {
            Object.values(ITEM_EFFECTS).forEach(effect => {
                expect(typeof effect.value).toBe('number');
                expect(Number.isFinite(effect.value)).toBe(true);
            });
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(ITEM_EFFECTS)).toBe(true);
        });

        it('should have valid effect types', () => {
            const validTypes = ['add', 'multiply', 'hp_percent'];
            Object.values(ITEM_EFFECTS).forEach(effect => {
                expect(validTypes).toContain(effect.type);
            });
        });
    });

    describe('DEFAULT_BUILD_STATS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_BUILD_STATS.damage).toBe(100);
            expect(DEFAULT_BUILD_STATS.hp).toBe(100);
            expect(DEFAULT_BUILD_STATS.crit_chance).toBe(5);
            expect(DEFAULT_BUILD_STATS.crit_damage).toBe(150);
            expect(DEFAULT_BUILD_STATS.attack_speed).toBe(100);
            expect(DEFAULT_BUILD_STATS.movement_speed).toBe(100);
            expect(DEFAULT_BUILD_STATS.armor).toBe(0);
            expect(DEFAULT_BUILD_STATS.evasion_internal).toBe(0);
            expect(DEFAULT_BUILD_STATS.projectiles).toBe(1);
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(DEFAULT_BUILD_STATS)).toBe(true);
        });

        it('should have all numeric values', () => {
            Object.values(DEFAULT_BUILD_STATS).forEach(value => {
                expect(typeof value).toBe('number');
            });
        });

        it('should have all expected stat keys', () => {
            const expectedKeys = [
                'damage',
                'hp',
                'crit_chance',
                'crit_damage',
                'attack_speed',
                'movement_speed',
                'armor',
                'evasion_internal',
                'projectiles',
            ];
            expectedKeys.forEach(key => {
                expect(DEFAULT_BUILD_STATS).toHaveProperty(key);
            });
        });
    });

    describe('Magic number constants', () => {
        it('should have correct MAX_COMPARE_ITEMS value', () => {
            expect(MAX_COMPARE_ITEMS).toBe(3);
            expect(typeof MAX_COMPARE_ITEMS).toBe('number');
        });

        it('should have correct BUILD_ITEMS_LIMIT value', () => {
            expect(BUILD_ITEMS_LIMIT).toBe(40);
            expect(typeof BUILD_ITEMS_LIMIT).toBe('number');
        });
    });

    describe('VALID_TIERS', () => {
        it('should contain all valid tier values', () => {
            expect(VALID_TIERS).toContain('SS');
            expect(VALID_TIERS).toContain('S');
            expect(VALID_TIERS).toContain('A');
            expect(VALID_TIERS).toContain('B');
            expect(VALID_TIERS).toContain('C');
        });

        it('should have exactly 5 tiers', () => {
            expect(VALID_TIERS).toHaveLength(5);
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(VALID_TIERS)).toBe(true);
        });
    });

    describe('VALID_RARITIES', () => {
        it('should contain all valid rarity values', () => {
            expect(VALID_RARITIES).toContain('common');
            expect(VALID_RARITIES).toContain('uncommon');
            expect(VALID_RARITIES).toContain('rare');
            expect(VALID_RARITIES).toContain('epic');
            expect(VALID_RARITIES).toContain('legendary');
        });

        it('should have exactly 5 rarities', () => {
            expect(VALID_RARITIES).toHaveLength(5);
        });

        it('should be frozen/immutable', () => {
            expect(Object.isFrozen(VALID_RARITIES)).toBe(true);
        });
    });

    describe('Consistency checks', () => {
        it('should have TIER_ORDER keys match VALID_TIERS', () => {
            const tierOrderKeys = Object.keys(TIER_ORDER);
            expect(tierOrderKeys).toHaveLength(VALID_TIERS.length);
            VALID_TIERS.forEach(tier => {
                expect(TIER_ORDER).toHaveProperty(tier);
            });
        });

        it('should have RARITY_ORDER keys match VALID_RARITIES', () => {
            const rarityOrderKeys = Object.keys(RARITY_ORDER);
            expect(rarityOrderKeys).toHaveLength(VALID_RARITIES.length);
            VALID_RARITIES.forEach(rarity => {
                expect(RARITY_ORDER).toHaveProperty(rarity);
            });
        });
    });
});
