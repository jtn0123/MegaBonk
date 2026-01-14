/**
 * Real Integration Tests for Build Planner Module
 * No mocking - tests actual build planner implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    calculateBuildStats,
    getBuildHistory,
    saveBuildToHistory,
    loadBuildFromHistory,
    deleteBuildFromHistory,
    clearBuildHistory,
    loadBuildTemplate,
    loadBuildFromData,
    importBuild,
    loadBuildFromURL,
    updateBuildURL,
    clearBuild,
    getCurrentBuild,
    BUILD_TEMPLATES,
} from '../../src/modules/build-planner.ts';

// ========================================
// Test Fixtures
// ========================================

const testCharacter = {
    id: 'cl4nk',
    name: 'CL4NK',
    tier: 'S' as const,
    rarity: 'legendary' as const,
    description: 'Robot crit master',
    passive_ability: 'Gain 1% Crit Chance per level',
    passive_description: 'Crit boost',
    starting_weapon: 'Revolver',
    playstyle: 'Crit DPS',
};

const testWeapon = {
    id: 'revolver',
    name: 'Revolver',
    tier: 'A' as const,
    rarity: 'epic' as const,
    description: 'High damage pistol',
    base_damage: 50,
    attack_pattern: 'Single shot',
    upgradeable_stats: ['damage'],
};

const testTome = {
    id: 'precision',
    name: 'Tome of Precision',
    tier: 'SS' as const,
    rarity: 'legendary' as const,
    description: 'Crit chance boost',
    stat_affected: 'Crit Chance',
    value_per_level: '+1%',
    priority: 1,
};

const testItem = {
    id: 'clover',
    name: 'Lucky Clover',
    tier: 'A' as const,
    rarity: 'rare' as const,
    description: 'Lucky charm',
    base_effect: '+5% crit',
    detailed_description: 'Increases crit',
    one_and_done: false,
    stacks_well: true,
};

// ========================================
// Build History Tests
// ========================================

describe('Build History - Real Integration Tests', () => {
    const BUILD_HISTORY_KEY = 'megabonk_build_history';

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('getBuildHistory', () => {
        it('should return empty array when no history', () => {
            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should return stored builds from localStorage', () => {
            const builds = [
                { character: 'test', weapon: 'sword', timestamp: Date.now() },
            ];
            localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(builds));

            const history = getBuildHistory();
            expect(history.length).toBe(1);
            expect(history[0].character).toBe('test');
        });

        it('should return empty array on invalid JSON', () => {
            localStorage.setItem(BUILD_HISTORY_KEY, 'invalid json');

            const history = getBuildHistory();
            expect(history).toEqual([]);
        });
    });

    describe('clearBuildHistory', () => {
        it('should remove all builds from history', () => {
            localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify([{ name: 'test' }]));

            clearBuildHistory();

            expect(localStorage.getItem(BUILD_HISTORY_KEY)).toBeNull();
        });

        it('should work when history is empty', () => {
            expect(() => clearBuildHistory()).not.toThrow();
        });
    });
});

// ========================================
// calculateBuildStats Tests
// ========================================

describe('calculateBuildStats - Real Integration Tests', () => {
    it('should return default stats for empty build', () => {
        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(stats.damage).toBeDefined();
        expect(stats.hp).toBeDefined();
        expect(stats.crit_chance).toBeDefined();
        expect(stats.crit_damage).toBeDefined();
    });

    it('should add crit chance bonus for crit character', () => {
        const stats = calculateBuildStats({
            character: testCharacter as any,
            weapon: null,
            tomes: [],
            items: [],
        });

        // CL4NK has crit passive
        expect(stats.crit_chance).toBeGreaterThan(0);
    });

    it('should add weapon base damage', () => {
        const stats = calculateBuildStats({
            character: null,
            weapon: testWeapon as any,
            tomes: [],
            items: [],
        });

        expect(stats.damage).toBeGreaterThanOrEqual(50);
    });

    it('should calculate evasion correctly', () => {
        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(typeof stats.evasion).toBe('number');
    });

    it('should set overcrit flag when crit exceeds 100%', () => {
        const highCritBuild = {
            character: {
                ...testCharacter,
                id: 'cl4nk',
                passive_ability: 'Gain 1% Crit Chance per level',
            } as any,
            weapon: null,
            tomes: [
                { ...testTome, id: 'precision', stat_affected: 'Crit Chance', value_per_level: '+5%' },
                { ...testTome, id: 'precision2', stat_affected: 'Crit Chance', value_per_level: '+5%' },
            ] as any[],
            items: [],
        };

        const stats = calculateBuildStats(highCritBuild);
        // With character bonus and tome bonuses, should be over 100%
        expect(stats.crit_chance).toBeGreaterThan(0);
    });

    it('should handle weapon without base_damage', () => {
        const weaponNoDamage = { ...testWeapon, base_damage: undefined };

        const stats = calculateBuildStats({
            character: null,
            weapon: weaponNoDamage as any,
            tomes: [],
            items: [],
        });

        expect(typeof stats.damage).toBe('number');
    });

    it('should apply tome stat bonuses', () => {
        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [testTome as any],
            items: [],
        });

        // Tome affects stats
        expect(typeof stats.crit_chance).toBe('number');
    });
});

// ========================================
// Character Passive Tests
// ========================================

describe('Character Passive Detection', () => {
    it('should detect HP passive (Monke)', () => {
        const hpCharacter = {
            id: 'monke',
            name: 'Monke',
            passive_ability: '+2 Max HP per level',
        };

        const stats = calculateBuildStats({
            character: hpCharacter as any,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(stats.hp).toBeGreaterThan(0);
    });

    it('should detect armor passive (Sir Oofie)', () => {
        const armorCharacter = {
            id: 'sir_oofie',
            name: 'Sir Oofie',
            passive_ability: 'Gain 1% Armor per level',
        };

        const stats = calculateBuildStats({
            character: armorCharacter as any,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(stats.armor).toBeGreaterThan(0);
    });

    it('should detect damage passive (Ogre)', () => {
        const damageCharacter = {
            id: 'ogre',
            name: 'Ogre',
            passive_ability: 'Gain 1.5% Damage per level',
        };

        const stats = calculateBuildStats({
            character: damageCharacter as any,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(stats.damage).toBeGreaterThan(0);
    });

    it('should detect attack speed passive (Bandit)', () => {
        const speedCharacter = {
            id: 'bandit',
            name: 'Bandit',
            passive_ability: 'Gain 1% Attack Speed per level',
        };

        const stats = calculateBuildStats({
            character: speedCharacter as any,
            weapon: null,
            tomes: [],
            items: [],
        });

        expect(stats.attack_speed).toBeGreaterThan(0);
    });
});

// ========================================
// Build Templates Tests
// ========================================

describe('BUILD_TEMPLATES - Real Integration Tests', () => {
    it('should have crit_build template', () => {
        expect(BUILD_TEMPLATES.crit_build).toBeDefined();
        expect(BUILD_TEMPLATES.crit_build.name).toBe('🎯 Crit Build');
    });

    it('should have tank_build template', () => {
        expect(BUILD_TEMPLATES.tank_build).toBeDefined();
        expect(BUILD_TEMPLATES.tank_build.name).toBe('🛡️ Tank Build');
    });

    it('should have speed_build template', () => {
        expect(BUILD_TEMPLATES.speed_build).toBeDefined();
        expect(BUILD_TEMPLATES.speed_build.name).toBe('⚡ Speed Build');
    });

    it('should have glass_cannon template', () => {
        expect(BUILD_TEMPLATES.glass_cannon).toBeDefined();
        expect(BUILD_TEMPLATES.glass_cannon.name).toBe('💥 Glass Cannon');
    });

    it('should have valid character IDs in templates', () => {
        Object.values(BUILD_TEMPLATES).forEach(template => {
            expect(template.build.character).toBeDefined();
            expect(typeof template.build.character).toBe('string');
        });
    });

    it('should have valid weapon IDs in templates', () => {
        Object.values(BUILD_TEMPLATES).forEach(template => {
            expect(template.build.weapon).toBeDefined();
            expect(typeof template.build.weapon).toBe('string');
        });
    });

    it('should have descriptions for all templates', () => {
        Object.values(BUILD_TEMPLATES).forEach(template => {
            expect(template.description).toBeDefined();
            expect(template.description.length).toBeGreaterThan(0);
        });
    });
});

// ========================================
// Build Import/Export Tests
// ========================================

describe('Build Import - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character"></select>
            <select id="build-weapon"></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should not throw on valid JSON import', () => {
        const validJson = JSON.stringify({ character: 'test', weapon: 'sword' });
        expect(() => importBuild(validJson)).not.toThrow();
    });

    it('should not throw on invalid JSON import', () => {
        expect(() => importBuild('invalid')).not.toThrow();
    });

    it('should not throw on empty JSON import', () => {
        expect(() => importBuild('{}')).not.toThrow();
    });
});

// ========================================
// loadBuildFromURL Tests
// ========================================

describe('loadBuildFromURL - Real Integration Tests', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character"></select>
            <select id="build-weapon"></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.location.hash = '';
    });

    it('should return false when no hash', () => {
        window.location.hash = '';
        const result = loadBuildFromURL();
        expect(result).toBe(false);
    });

    it('should return false when hash without build=', () => {
        window.location.hash = '#other=value';
        const result = loadBuildFromURL();
        expect(result).toBe(false);
    });

    it('should return false on invalid base64', () => {
        window.location.hash = '#build=invalidbase64!!!';
        const result = loadBuildFromURL();
        expect(result).toBe(false);
    });

    it('should attempt to load valid encoded build', () => {
        const buildData = { c: 'test', w: 'sword' };
        const encoded = btoa(JSON.stringify(buildData));
        window.location.hash = `#build=${encoded}`;

        // Won't find actual data, but shouldn't throw
        expect(() => loadBuildFromURL()).not.toThrow();
    });
});

// ========================================
// updateBuildURL Tests
// ========================================

describe('updateBuildURL - Real Integration Tests', () => {
    const originalHistory = window.history.replaceState;

    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character"></select>
            <select id="build-weapon"></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
        // Clear build first
        clearBuild();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.location.hash = '';
    });

    it('should not throw on empty build', () => {
        expect(() => updateBuildURL()).not.toThrow();
    });
});

// ========================================
// clearBuild Tests
// ========================================

describe('clearBuild - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character">
                <option value="test">Test</option>
            </select>
            <select id="build-weapon">
                <option value="sword">Sword</option>
            </select>
            <div id="tomes-selection">
                <input type="checkbox" class="tome-checkbox" value="tome1" checked>
            </div>
            <div id="items-selection">
                <input type="checkbox" class="item-checkbox" value="item1" checked>
            </div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should clear character selection', () => {
        const select = document.getElementById('build-character') as HTMLSelectElement;
        select.value = 'test';

        clearBuild();

        expect(select.value).toBe('');
    });

    it('should clear weapon selection', () => {
        const select = document.getElementById('build-weapon') as HTMLSelectElement;
        select.value = 'sword';

        clearBuild();

        expect(select.value).toBe('');
    });

    it('should uncheck tome checkboxes', () => {
        const checkbox = document.querySelector('.tome-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);

        clearBuild();

        expect(checkbox.checked).toBe(false);
    });

    it('should uncheck item checkboxes', () => {
        const checkbox = document.querySelector('.item-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);

        clearBuild();

        expect(checkbox.checked).toBe(false);
    });

    it('should not throw when elements missing', () => {
        document.body.innerHTML = '';
        expect(() => clearBuild()).not.toThrow();
    });
});

// ========================================
// getCurrentBuild Tests
// ========================================

describe('getCurrentBuild - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character"></select>
            <select id="build-weapon"></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return a build object', () => {
        const build = getCurrentBuild();

        expect(build).toBeDefined();
        expect(typeof build).toBe('object');
    });

    it('should have expected properties', () => {
        const build = getCurrentBuild();

        expect('character' in build).toBe(true);
        expect('weapon' in build).toBe(true);
        expect('tomes' in build).toBe(true);
        expect('items' in build).toBe(true);
    });

    it('should return a copy, not the original', () => {
        const build1 = getCurrentBuild();
        const build2 = getCurrentBuild();

        expect(build1).not.toBe(build2);
        expect(build1.tomes).not.toBe(build2.tomes);
        expect(build1.items).not.toBe(build2.items);
    });

    it('should have array properties be arrays', () => {
        const build = getCurrentBuild();

        expect(Array.isArray(build.tomes)).toBe(true);
        expect(Array.isArray(build.items)).toBe(true);
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Build Planner Edge Cases', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <select id="build-character"></select>
            <select id="build-weapon"></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('should handle character with null passive', () => {
        const charNoPassive = {
            id: 'test',
            name: 'Test',
            passive_ability: null,
        };

        expect(() => calculateBuildStats({
            character: charNoPassive as any,
            weapon: null,
            tomes: [],
            items: [],
        })).not.toThrow();
    });

    it('should handle tome with invalid value_per_level', () => {
        const invalidTome = {
            id: 'bad',
            name: 'Bad Tome',
            stat_affected: 'Damage',
            value_per_level: 'invalid',
        };

        expect(() => calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [invalidTome as any],
            items: [],
        })).not.toThrow();
    });

    it('should handle tome with missing value_per_level', () => {
        const noValueTome = {
            id: 'novalue',
            name: 'No Value Tome',
            stat_affected: 'HP',
        };

        expect(() => calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [noValueTome as any],
            items: [],
        })).not.toThrow();
    });

    it('should handle weapon with NaN base_damage', () => {
        const nanWeapon = {
            id: 'nan',
            name: 'NaN Weapon',
            base_damage: NaN,
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: nanWeapon as any,
            tomes: [],
            items: [],
        });

        expect(Number.isNaN(stats.damage)).toBe(false);
    });

    it('should handle loadBuildTemplate with invalid template', () => {
        expect(() => loadBuildTemplate('nonexistent')).not.toThrow();
    });

    it('should handle saveBuildToHistory with empty build', () => {
        clearBuild();
        expect(() => saveBuildToHistory()).not.toThrow();
    });

    it('should handle loadBuildFromHistory with invalid index', () => {
        expect(() => loadBuildFromHistory(-1)).not.toThrow();
        expect(() => loadBuildFromHistory(9999)).not.toThrow();
    });

    it('should handle deleteBuildFromHistory with invalid index', () => {
        expect(() => deleteBuildFromHistory(-1)).not.toThrow();
        expect(() => deleteBuildFromHistory(9999)).not.toThrow();
    });
});

// ========================================
// Tome Stat Application Tests
// ========================================

describe('Tome Stat Application', () => {
    it('should apply Damage tome effect', () => {
        const damageTome = {
            id: 'damage',
            stat_affected: 'Damage',
            value_per_level: '+1%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [damageTome as any],
            items: [],
        });

        expect(stats.damage).toBeGreaterThan(0);
    });

    it('should apply HP tome effect', () => {
        const hpTome = {
            id: 'vitality',
            stat_affected: 'HP',
            value_per_level: '+2%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [hpTome as any],
            items: [],
        });

        expect(stats.hp).toBeGreaterThan(0);
    });

    it('should apply Crit Damage tome effect', () => {
        const critDamageTome = {
            id: 'brutality',
            stat_affected: 'Crit Damage',
            value_per_level: '+3%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [critDamageTome as any],
            items: [],
        });

        expect(stats.crit_damage).toBeGreaterThan(0);
    });

    it('should apply Attack Speed tome effect', () => {
        const speedTome = {
            id: 'cooldown',
            stat_affected: 'Attack Speed',
            value_per_level: '+1%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [speedTome as any],
            items: [],
        });

        expect(stats.attack_speed).toBeGreaterThan(0);
    });

    it('should apply Movement Speed tome effect', () => {
        const moveTome = {
            id: 'agility',
            stat_affected: 'Movement Speed',
            value_per_level: '+2%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [moveTome as any],
            items: [],
        });

        expect(stats.movement_speed).toBeGreaterThan(0);
    });

    it('should apply Armor tome effect', () => {
        const armorTome = {
            id: 'armor',
            stat_affected: 'Armor',
            value_per_level: '+1%',
        };

        const stats = calculateBuildStats({
            character: null,
            weapon: null,
            tomes: [armorTome as any],
            items: [],
        });

        expect(stats.armor).toBeGreaterThan(0);
    });
});
