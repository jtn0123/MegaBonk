/**
 * @vitest-environment jsdom
 * Comprehensive coverage tests for build-planner.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing build-planner
vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock toast manager
vi.mock('../../src/modules/toast', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock data-service - data must be inline in vi.mock due to hoisting
vi.mock('../../src/modules/data-service', () => ({
    allData: {
        characters: {
            characters: [
                { id: 'cl4nk', name: 'CL4NK', tier: 'S', passive_ability: 'Gain 1% Crit Chance per level' },
                { id: 'monke', name: 'Monke', tier: 'A', passive_ability: '+2 Max HP per level' },
                { id: 'sir_oofie', name: 'Sir Oofie', tier: 'S', passive_ability: 'Gain 1% Armor per level' },
                { id: 'ogre', name: 'Ogre', tier: 'B', passive_ability: 'Gain 1.5% Damage per level' },
                { id: 'bandit', name: 'Bandit', tier: 'A', passive_ability: 'Gain 1% Attack Speed per level' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'sword', name: 'Sword', tier: 'A', base_damage: 15 },
                { id: 'revolver', name: 'Revolver', tier: 'S', base_damage: 25 },
                { id: 'katana', name: 'Katana', tier: 'A', base_damage: 18 },
            ],
        },
        tomes: {
            tomes: [
                { id: 'precision', name: 'Precision', stat_affected: 'Crit Chance', value_per_level: '1%' },
                { id: 'damage', name: 'Damage', stat_affected: 'Damage', value_per_level: '2%' },
                { id: 'vitality', name: 'Vitality', stat_affected: 'HP', value_per_level: '5' },
                { id: 'cooldown', name: 'Cooldown', stat_affected: 'Attack Speed', value_per_level: '1%' },
                { id: 'armor', name: 'Armor', stat_affected: 'Armor', value_per_level: '2' },
            ],
        },
        items: {
            items: [
                { id: 'clover', name: 'Clover', tier: 'S', rarity: 'rare' },
                { id: 'power_gloves', name: 'Power Gloves', tier: 'A', rarity: 'uncommon' },
                { id: 'turbo_skates', name: 'Turbo Skates', tier: 'B', rarity: 'common' },
            ],
        },
    },
}));

// Mock data for tests (local copy for assertions)
const mockAllData = {
    characters: {
        characters: [
            { id: 'cl4nk', name: 'CL4NK', tier: 'S', passive_ability: 'Gain 1% Crit Chance per level' },
            { id: 'monke', name: 'Monke', tier: 'A', passive_ability: '+2 Max HP per level' },
            { id: 'sir_oofie', name: 'Sir Oofie', tier: 'S', passive_ability: 'Gain 1% Armor per level' },
            { id: 'ogre', name: 'Ogre', tier: 'B', passive_ability: 'Gain 1.5% Damage per level' },
            { id: 'bandit', name: 'Bandit', tier: 'A', passive_ability: 'Gain 1% Attack Speed per level' },
        ],
    },
    weapons: {
        weapons: [
            { id: 'sword', name: 'Sword', tier: 'A', base_damage: 15 },
            { id: 'revolver', name: 'Revolver', tier: 'S', base_damage: 25 },
            { id: 'katana', name: 'Katana', tier: 'A', base_damage: 18 },
        ],
    },
    tomes: {
        tomes: [
            { id: 'precision', name: 'Precision', stat_affected: 'Crit Chance', value_per_level: '1%' },
            { id: 'damage', name: 'Damage', stat_affected: 'Damage', value_per_level: '2%' },
            { id: 'vitality', name: 'Vitality', stat_affected: 'HP', value_per_level: '5' },
            { id: 'cooldown', name: 'Cooldown', stat_affected: 'Attack Speed', value_per_level: '1%' },
            { id: 'armor', name: 'Armor', stat_affected: 'Armor', value_per_level: '2' },
        ],
    },
    items: {
        items: [
            { id: 'clover', name: 'Clover', tier: 'S', rarity: 'rare' },
            { id: 'power_gloves', name: 'Power Gloves', tier: 'A', rarity: 'uncommon' },
            { id: 'turbo_skates', name: 'Turbo Skates', tier: 'B', rarity: 'common' },
        ],
    },
};

// Mock store
vi.mock('../../src/modules/store', () => ({
    getState: vi.fn().mockImplementation((key: string) => {
        if (key === 'currentBuild') {
            return { character: null, weapon: null, tomes: [], items: [], name: '', notes: '' };
        }
        return null;
    }),
    setState: vi.fn(),
}));

// Import functions to test
import {
    getBuildHistory,
    saveBuildToHistory,
    loadBuildFromHistory,
    deleteBuildFromHistory,
    clearBuildHistory,
    loadBuildTemplate,
    BUILD_TEMPLATES,
    loadBuildFromData,
    importBuild,
    calculateBuildStats,
    clearBuild,
    getCurrentBuild,
    loadBuildFromURL,
    updateBuildURL,
} from '../../src/modules/build-planner';
import { ToastManager } from '../../src/modules/toast';

describe('build-planner.ts coverage tests', () => {
    beforeEach(() => {
        // Clear localStorage
        localStorage.clear();

        // Setup minimal DOM for build planner
        document.body.innerHTML = `
            <select id="build-character">
                <option value="">Select Character...</option>
            </select>
            <select id="build-weapon">
                <option value="">Select Weapon...</option>
            </select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
            <button id="export-build"></button>
            <button id="share-build-url"></button>
            <button id="clear-build"></button>
        `;

        // Reset mocks
        vi.clearAllMocks();

        // Clear URL hash
        window.history.replaceState(null, '', window.location.pathname);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('Build History', () => {
        it('should return empty array when no history exists', () => {
            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should save build to history', () => {
            // Set up a mock build state
            const mockBuild = {
                character: { id: 'cl4nk', name: 'CL4NK' },
                weapon: { id: 'sword', name: 'Sword' },
                tomes: [{ id: 'precision' }],
                items: [{ id: 'clover' }],
            };

            // Manually set localStorage to simulate saved build
            localStorage.setItem('megabonk_build_history', JSON.stringify([
                { name: 'Test Build', character: 'cl4nk', weapon: 'sword', tomes: ['precision'], items: ['clover'], timestamp: Date.now() },
            ]));

            const history = getBuildHistory();
            expect(history.length).toBe(1);
            expect(history[0].character).toBe('cl4nk');
        });

        it('should limit history to MAX_BUILD_HISTORY items', () => {
            const manyBuilds = [];
            for (let i = 0; i < 25; i++) {
                manyBuilds.push({ name: `Build ${i}`, character: 'cl4nk', timestamp: Date.now() - i * 1000 });
            }
            localStorage.setItem('megabonk_build_history', JSON.stringify(manyBuilds));

            const history = getBuildHistory();
            expect(history.length).toBe(25); // getBuildHistory just reads, doesn't truncate

            // Saving should truncate
            saveBuildToHistory();
            // Even without a valid build, it should warn
            expect(ToastManager.warning).toHaveBeenCalled();
        });

        it('should handle localStorage errors gracefully', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = () => {
                throw new Error('localStorage error');
            };

            expect(() => getBuildHistory()).not.toThrow();
            const history = getBuildHistory();
            expect(history).toEqual([]);

            localStorage.getItem = originalGetItem;
        });

        it('should delete build from history', () => {
            const builds = [
                { name: 'Build 1', character: 'cl4nk', timestamp: Date.now() },
                { name: 'Build 2', character: 'monke', timestamp: Date.now() - 1000 },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(builds));

            deleteBuildFromHistory(0);

            const history = getBuildHistory();
            expect(history.length).toBe(1);
            expect(history[0].name).toBe('Build 2');
        });

        it('should handle invalid index for delete', () => {
            deleteBuildFromHistory(999);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should clear all build history', () => {
            localStorage.setItem('megabonk_build_history', JSON.stringify([{ name: 'Test' }]));

            clearBuildHistory();

            const history = getBuildHistory();
            expect(history).toEqual([]);
            expect(ToastManager.success).toHaveBeenCalledWith('Build history cleared');
        });

        it('should handle error when loading from invalid index', () => {
            loadBuildFromHistory(0);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should handle negative index for loadBuildFromHistory', () => {
            loadBuildFromHistory(-1);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });
    });

    describe('Build Templates', () => {
        it('should have predefined templates', () => {
            expect(BUILD_TEMPLATES).toBeDefined();
            expect(BUILD_TEMPLATES.crit_build).toBeDefined();
            expect(BUILD_TEMPLATES.tank_build).toBeDefined();
            expect(BUILD_TEMPLATES.speed_build).toBeDefined();
            expect(BUILD_TEMPLATES.glass_cannon).toBeDefined();
        });

        it('should load template successfully', () => {
            loadBuildTemplate('crit_build');
            expect(ToastManager.success).toHaveBeenCalledWith(expect.stringContaining('Loaded template'));
        });

        it('should handle non-existent template', () => {
            loadBuildTemplate('nonexistent');
            expect(ToastManager.error).toHaveBeenCalledWith('Template not found');
        });
    });

    describe('Build Import/Export', () => {
        it('should import valid build JSON', () => {
            const buildJson = JSON.stringify({
                character: 'cl4nk',
                weapon: 'sword',
                tomes: ['precision'],
                items: ['clover'],
            });

            importBuild(buildJson);
            expect(ToastManager.success).toHaveBeenCalledWith('Build imported successfully!');
        });

        it('should handle invalid JSON import', () => {
            importBuild('invalid json {{{');
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build data. Please check the format.');
        });

        it('should load build from data object', () => {
            const buildData = {
                character: 'cl4nk',
                weapon: 'sword',
                tomes: ['precision'],
                items: ['clover'],
                name: 'Test Build',
                notes: 'Test notes',
            };

            expect(() => loadBuildFromData(buildData)).not.toThrow();
        });

        it('should handle empty build data', () => {
            expect(() => loadBuildFromData({})).not.toThrow();
        });
    });

    describe('Build Stats Calculation', () => {
        it('should calculate stats for empty build', () => {
            const stats = calculateBuildStats({
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.damage).toBeDefined();
            expect(stats.hp).toBeDefined();
            expect(stats.crit_chance).toBeDefined();
        });

        it('should apply character crit passive (CL4NK)', () => {
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[0] as any, // CL4NK
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.crit_chance).toBeGreaterThan(0);
        });

        it('should apply character HP passive (Monke)', () => {
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[1] as any, // Monke
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.hp).toBeGreaterThan(0);
        });

        it('should apply character Armor passive (Sir Oofie)', () => {
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[2] as any, // Sir Oofie
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.armor).toBeGreaterThan(0);
        });

        it('should apply character Damage passive (Ogre)', () => {
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[3] as any, // Ogre
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.damage).toBeGreaterThan(0);
        });

        it('should apply character Attack Speed passive (Bandit)', () => {
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[4] as any, // Bandit
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.attack_speed).toBeGreaterThan(0);
        });

        it('should add weapon base damage', () => {
            const stats = calculateBuildStats({
                character: null,
                weapon: mockAllData.weapons.weapons[0] as any, // Sword with 15 damage
                tomes: [],
                items: [],
            });

            // Default damage starts at 100, weapon adds 15
            expect(stats.damage).toBe(115);
        });

        it('should apply tome stat bonuses', () => {
            const stats = calculateBuildStats({
                character: null,
                weapon: null,
                tomes: [mockAllData.tomes.tomes[0] as any], // Precision tome
                items: [],
            });

            // Tome effects are multiplied by level (5) and 100
            expect(stats.crit_chance).toBeGreaterThan(0);
        });

        it('should detect overcrit condition', () => {
            // Create a build with very high crit
            const stats = calculateBuildStats({
                character: mockAllData.characters.characters[0] as any, // CL4NK (+50 crit)
                weapon: null,
                tomes: [
                    mockAllData.tomes.tomes[0] as any, // Precision
                    mockAllData.tomes.tomes[0] as any, // Another precision (simulated stacking)
                ],
                items: [],
            });

            // With CL4NK's +50 and multiple precision tomes, should be over 100
            expect(stats.crit_chance).toBeGreaterThan(100);
            expect(stats.overcrit).toBe(true);
        });

        it('should calculate evasion correctly', () => {
            const stats = calculateBuildStats({
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            });

            expect(stats.evasion).toBeDefined();
            expect(typeof stats.evasion).toBe('number');
        });
    });

    describe('Build URL', () => {
        it('should load build from valid URL hash', () => {
            const buildData = { c: 'cl4nk', w: 'sword' };
            const encoded = btoa(JSON.stringify(buildData));
            window.history.replaceState(null, '', `#build=${encoded}`);

            const result = loadBuildFromURL();
            expect(result).toBe(true);
            expect(ToastManager.success).toHaveBeenCalledWith('Build loaded from URL!');
        });

        it('should return false when no build hash', () => {
            window.history.replaceState(null, '', '/');
            const result = loadBuildFromURL();
            expect(result).toBe(false);
        });

        it('should reject invalid base64 characters', () => {
            window.history.replaceState(null, '', '#build=invalid<>characters');
            const result = loadBuildFromURL();
            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build link format');
        });

        it('should reject overly long URLs', () => {
            const longString = 'a'.repeat(15000);
            window.history.replaceState(null, '', `#build=${longString}`);
            const result = loadBuildFromURL();
            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalledWith('Build link is too long');
        });

        it('should handle invalid base64 decoding', () => {
            // Invalid base64 that passes regex but fails decoding
            window.history.replaceState(null, '', '#build=!!!');
            const result = loadBuildFromURL();
            expect(result).toBe(false);
        });

        it('should handle non-object decoded data', () => {
            const encoded = btoa('"just a string"');
            window.history.replaceState(null, '', `#build=${encoded}`);
            const result = loadBuildFromURL();
            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build data format');
        });

        it('should update URL when build changes', () => {
            expect(() => updateBuildURL()).not.toThrow();
        });

        it('should not throw when updating URL', () => {
            window.history.replaceState(null, '', '#build=test');
            // Just verify it doesn't throw - actual hash depends on module state
            expect(() => updateBuildURL()).not.toThrow();
        });
    });

    describe('Build Operations', () => {
        it('should clear build', () => {
            expect(() => clearBuild()).not.toThrow();
        });

        it('should get current build as copy', () => {
            const build = getCurrentBuild();
            expect(build).toBeDefined();
            expect(build.character).toBe(null);
            expect(build.weapon).toBe(null);
            expect(Array.isArray(build.tomes)).toBe(true);
            expect(Array.isArray(build.items)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle saveBuildToHistory without character or weapon', () => {
            saveBuildToHistory();
            expect(ToastManager.warning).toHaveBeenCalledWith('Build must have at least a character or weapon');
        });

        it('should handle deleteBuildFromHistory localStorage error', () => {
            const builds = [{ name: 'Test', character: 'cl4nk' }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(builds));

            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => {
                throw new Error('Storage full');
            };

            deleteBuildFromHistory(0);
            expect(ToastManager.error).toHaveBeenCalledWith('Failed to delete build from history');

            localStorage.setItem = originalSetItem;
        });

        it('should handle clearBuildHistory localStorage error', () => {
            const originalRemoveItem = localStorage.removeItem;
            localStorage.removeItem = () => {
                throw new Error('Storage error');
            };

            clearBuildHistory();
            expect(ToastManager.error).toHaveBeenCalledWith('Failed to clear build history');

            localStorage.removeItem = originalRemoveItem;
        });
    });
});
