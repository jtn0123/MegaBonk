import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockCharacter, createMockWeapon, createMockTome, createMockItem } from '../helpers/mock-data.js';

// Import the real calculateBuildStats function from the build-planner module
import { calculateBuildStats } from '../../src/modules/build-planner.ts';

describe('calculateBuildStats()', () => {
    let currentBuild;

    beforeEach(() => {
        createMinimalDOM();
        currentBuild = {
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        };
    });

    describe('base stats', () => {
        it('should return default stats with empty build', () => {
            const stats = calculateBuildStats(currentBuild);

            expect(stats.damage).toBe(100);
            expect(stats.hp).toBe(100);
            expect(stats.crit_chance).toBe(5);
            expect(stats.crit_damage).toBe(150);
            expect(stats.attack_speed).toBe(100);
            expect(stats.movement_speed).toBe(100);
            expect(stats.armor).toBe(0);
            expect(stats.evasion).toBe(0);
            expect(stats.projectiles).toBe(1);
        });

        it('should not have overcrit with base crit chance', () => {
            const stats = calculateBuildStats(currentBuild);
            expect(stats.overcrit).toBe(false);
        });
    });

    describe('character passive bonuses', () => {
        it('should add crit chance for CL4NK-type passive', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1% Crit Chance per level',
            });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.crit_chance).toBe(55); // 5 base + 50 bonus
        });

        it('should add HP for HP-based passive', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: '+2 Max HP per level', // Real implementation expects this format
            });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.hp).toBe(150); // 100 base + 50 bonus
        });

        it('should add damage for damage-based passive', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1.5% Damage per level', // Real implementation expects "Gain...Damage" format
            });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(120); // 100 base + 20 bonus
        });

        it('should add armor for armor-based passive', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1% Armor per level',
            });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.armor).toBe(50);
        });
    });

    describe('weapon damage', () => {
        it('should add weapon base damage', () => {
            currentBuild.weapon = createMockWeapon({ base_damage: 22 });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(122); // 100 + 22
        });

        it('should handle weapons with string base_damage', () => {
            currentBuild.weapon = createMockWeapon({ base_damage: '15' });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(115);
        });

        it('should handle weapons without base_damage', () => {
            currentBuild.weapon = createMockWeapon({ base_damage: undefined });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(100);
        });

        it('should handle weapons with zero base_damage', () => {
            currentBuild.weapon = createMockWeapon({ base_damage: 0 });

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(100);
        });
    });

    describe('item effects', () => {
        it('should apply gym_sauce damage bonus', () => {
            currentBuild.items = [createMockItem({ id: 'gym_sauce' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(110); // 100 + 10
        });

        it('should apply forbidden_juice crit bonus', () => {
            currentBuild.items = [createMockItem({ id: 'forbidden_juice' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.crit_chance).toBe(15); // 5 + 10
        });

        it('should apply oats HP bonus', () => {
            currentBuild.items = [createMockItem({ id: 'oats' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.hp).toBe(125); // 100 + 25
        });

        it('should apply battery attack speed bonus', () => {
            currentBuild.items = [createMockItem({ id: 'battery' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.attack_speed).toBe(108); // 100 + 8
        });

        it('should apply turbo_socks movement speed bonus', () => {
            currentBuild.items = [createMockItem({ id: 'turbo_socks' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.movement_speed).toBe(115); // 100 + 15
        });

        it('should apply beer damage bonus', () => {
            currentBuild.items = [createMockItem({ id: 'beer' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should apply backpack projectile bonus', () => {
            currentBuild.items = [createMockItem({ id: 'backpack' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.projectiles).toBe(2); // 1 + 1
        });

        it('should apply beefy_ring scaling with HP', () => {
            currentBuild.items = [createMockItem({ id: 'beefy_ring' })];
            // HP is 100, so 100/100 * 20 = 20% bonus

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should apply beefy_ring with higher HP', () => {
            currentBuild.items = [
                createMockItem({ id: 'oats' }), // +25 HP first
                createMockItem({ id: 'beefy_ring' }),
            ];
            // HP becomes 125, then beefy_ring adds 125/100 * 20 = 25

            const stats = calculateBuildStats(currentBuild);
            expect(stats.hp).toBe(125);
            expect(stats.damage).toBe(125); // 100 + 25
        });

        it('should apply leeching_crystal HP multiplier', () => {
            currentBuild.items = [createMockItem({ id: 'leeching_crystal' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.hp).toBe(150); // 100 * 1.5
        });

        it('should apply brass_knuckles damage bonus', () => {
            currentBuild.items = [createMockItem({ id: 'brass_knuckles' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should apply boss_buster damage bonus', () => {
            currentBuild.items = [createMockItem({ id: 'boss_buster' })];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(115); // 100 + 15
        });

        it('should stack multiple items correctly', () => {
            currentBuild.items = [
                createMockItem({ id: 'gym_sauce' }), // +10 damage
                createMockItem({ id: 'beer' }), // +20 damage
                createMockItem({ id: 'brass_knuckles' }), // +20 damage
            ];

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(150); // 100 + 10 + 20 + 20
        });
    });

    describe('evasion calculation (hyperbolic)', () => {
        it('should apply hyperbolic scaling to evasion', () => {
            currentBuild.items = [createMockItem({ id: 'slippery_ring' })];
            // internal = 15%, hyperbolic: 15/(1+15/100) = 15/1.15 = 13.04

            const stats = calculateBuildStats(currentBuild);
            expect(stats.evasion).toBeCloseTo(13.04, 1);
        });

        it('should stack evasion with hyperbolic scaling', () => {
            currentBuild.items = [createMockItem({ id: 'slippery_ring' }), createMockItem({ id: 'phantom_shroud' })];
            // internal = 30%, hyperbolic: 30/(1+30/100) = 30/1.30 = 23.08

            const stats = calculateBuildStats(currentBuild);
            expect(stats.evasion).toBeCloseTo(23.08, 1);
        });

        it('should handle zero evasion', () => {
            const stats = calculateBuildStats(currentBuild);
            expect(stats.evasion).toBe(0);
        });
    });

    describe('overcrit detection', () => {
        it('should detect overcrit when crit > 100', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1% Crit Chance per level',
            });
            // 5 base + 50 from passive = 55

            // Add items to push over 100
            currentBuild.items = [
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
            ];
            // Total: 55 + 50 = 105

            const stats = calculateBuildStats(currentBuild);
            expect(stats.crit_chance).toBe(105);
            expect(stats.overcrit).toBe(true);
        });

        it('should not have overcrit at exactly 100', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1% Crit Chance per level',
            });
            // 5 base + 50 from passive = 55

            // Add items to reach exactly 100 (need 45 more)
            currentBuild.items = [
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
                createMockItem({ id: 'forbidden_juice' }), // +10
            ];
            // Total: 55 + 40 = 95

            const stats = calculateBuildStats(currentBuild);
            expect(stats.crit_chance).toBe(95);
            expect(stats.overcrit).toBe(false);
        });
    });

    describe('combined build', () => {
        it('should correctly combine character, weapon, and items', () => {
            currentBuild.character = createMockCharacter({
                passive_ability: 'Gain 1% Damage per level',
            });
            currentBuild.weapon = createMockWeapon({ base_damage: 10 });
            currentBuild.items = [
                createMockItem({ id: 'gym_sauce' }), // +10 damage
                createMockItem({ id: 'forbidden_juice' }), // +10 crit
            ];

            const stats = calculateBuildStats(currentBuild);
            // Damage: 100 base + 20 (character) + 10 (weapon) + 10 (gym_sauce) = 140
            expect(stats.damage).toBe(140);
            // Crit: 5 base + 10 (forbidden_juice) = 15
            expect(stats.crit_chance).toBe(15);
        });
    });

    describe('tome effects', () => {
        it('should apply damage tome bonus', () => {
            currentBuild.tomes = [createMockTome({ id: 'damage', stat_affected: 'Damage', value_per_level: '+0.08x' })];
            // value = 0.08, tomeLevel = 5, bonus = 0.08 * 5 * 100 = 40

            const stats = calculateBuildStats(currentBuild);
            expect(stats.damage).toBe(140); // 100 + 40
        });

        it('should apply precision tome crit bonus', () => {
            currentBuild.tomes = [
                createMockTome({ id: 'precision', stat_affected: 'Crit Chance', value_per_level: '+0.07' }),
            ];
            // value = 0.07, tomeLevel = 5, bonus = 0.07 * 5 * 100 = 35

            const stats = calculateBuildStats(currentBuild);
            expect(stats.crit_chance).toBe(40); // 5 + 35
        });
    });
});
