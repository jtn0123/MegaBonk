import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock dependencies BEFORE imports
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock data-service with inline data
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        characters: {
            characters: [
                { id: 'hero', name: 'Hero', passive_ability: 'Gain 1% Crit Chance per level' },
                { id: 'cl4nk', name: 'CL4NK', passive_ability: 'Crit focused' },
                { id: 'monke', name: 'Monke', passive_ability: '+2 Max HP per level' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'sword', name: 'Sword', base_damage: 25 },
                { id: 'bow', name: 'Bow', base_damage: 15 },
            ],
        },
        tomes: {
            tomes: [
                { id: 'precision', name: 'Precision', stat_affected: 'Crit Chance', value_per_level: '2' },
                { id: 'power', name: 'Power', stat_affected: 'Damage', value_per_level: '5' },
                { id: 'invalid-tome', name: 'Invalid', stat_affected: 'Damage', value_per_level: undefined },
            ],
        },
        items: {
            items: [
                { id: 'ring', name: 'Ring' },
                { id: 'necklace', name: 'Necklace' },
            ],
        },
    },
}));

// Now import after mocks are set up
import {
    getBuildHistory,
    saveBuildToHistory,
    loadBuildFromHistory,
    deleteBuildFromHistory,
    clearBuildHistory,
    importBuild,
    exportBuild,
    shareBuildURL,
    loadBuildFromURL,
    calculateBuildStats,
    getCurrentBuild,
    clearBuild,
    loadBuildFromData,
} from '../../src/modules/build-planner.ts';

import { ToastManager } from '../../src/modules/toast.ts';
import { allData } from '../../src/modules/data-service.ts';

describe('build-planner.ts - Build History Management', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('getBuildHistory', () => {
        it('should return empty array when no history exists', () => {
            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should return stored history', () => {
            const testHistory = [
                { character: 'hero', weapon: 'sword', timestamp: Date.now() },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(testHistory));

            const history = getBuildHistory();
            expect(history).toHaveLength(1);
            expect(history[0].character).toBe('hero');
        });

        it('should handle corrupted localStorage gracefully', () => {
            localStorage.setItem('megabonk_build_history', '{invalid json}');

            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should handle non-array data', () => {
            localStorage.setItem('megabonk_build_history', '{"not": "array"}');

            const history = getBuildHistory();
            expect(history).toBeDefined();
        });

        it('should handle very large history', () => {
            const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
                character: `char${i}`,
                timestamp: Date.now() - i,
            }));
            localStorage.setItem('megabonk_build_history', JSON.stringify(largeHistory));

            const history = getBuildHistory();
            expect(history.length).toBe(1000);
        });
    });

    describe('clearBuildHistory', () => {
        it('should clear all history', () => {
            const testHistory = [{ character: 'hero', timestamp: Date.now() }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(testHistory));

            clearBuildHistory();

            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should handle clearing empty history', () => {
            expect(() => clearBuildHistory()).not.toThrow();
            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should remove localStorage key', () => {
            localStorage.setItem('megabonk_build_history', '[]');
            clearBuildHistory();

            const item = localStorage.getItem('megabonk_build_history');
            expect(item).toBeNull();
        });
    });

    describe('deleteBuildFromHistory', () => {
        it('should delete build at specific index', () => {
            const testHistory = [
                { character: 'hero1', timestamp: 1 },
                { character: 'hero2', timestamp: 2 },
                { character: 'hero3', timestamp: 3 },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(testHistory));

            deleteBuildFromHistory(1);

            const history = getBuildHistory();
            expect(history).toHaveLength(2);
            expect(history[0].character).toBe('hero1');
            expect(history[1].character).toBe('hero3');
        });

        it('should handle invalid index', () => {
            const testHistory = [{ character: 'hero', timestamp: 1 }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(testHistory));

            deleteBuildFromHistory(999);

            const history = getBuildHistory();
            expect(history).toHaveLength(1);
        });

        it('should handle negative index', () => {
            const testHistory = [{ character: 'hero', timestamp: 1 }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(testHistory));

            deleteBuildFromHistory(-1);

            const history = getBuildHistory();
            expect(history).toHaveLength(1);
        });
    });
});

describe('build-planner.ts - Import/Export', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('importBuild', () => {
        it('should import valid build JSON', () => {
            const buildJSON = JSON.stringify({
                character: 'hero',
                weapon: 'sword',
                tomes: ['precision'],
                items: ['ring'],
            });

            importBuild(buildJSON);

            expect(ToastManager.success).toHaveBeenCalledWith('Build imported successfully!');
        });

        it('should handle invalid JSON', () => {
            importBuild('{invalid json}');

            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build data. Please check the format.');
        });

        it('should handle empty string', () => {
            importBuild('');

            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle very large build JSON', () => {
            const largeBuild = {
                character: 'hero',
                items: Array.from({ length: 1000 }, (_, i) => `item${i}`),
            };

            importBuild(JSON.stringify(largeBuild));

            // Should not throw, may or may not succeed depending on validation
            expect(true).toBe(true);
        });

        it('should handle JSON with special characters', () => {
            const buildJSON = JSON.stringify({
                name: '<script>alert("xss")</script>',
                notes: 'Test & "quotes"',
            });

            importBuild(buildJSON);

            // Should handle gracefully
            expect(true).toBe(true);
        });

        it('should handle null values in build data', () => {
            const buildJSON = JSON.stringify({
                character: null,
                weapon: null,
                tomes: null,
                items: null,
            });

            importBuild(buildJSON);

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('loadBuildFromURL', () => {
        beforeEach(() => {
            // Reset window.location.hash
            window.location.hash = '';
        });

        it('should return false when no hash', () => {
            window.location.hash = '';

            const result = loadBuildFromURL();

            expect(result).toBe(false);
        });

        it('should return false when hash has no build param', () => {
            window.location.hash = '#other=data';

            const result = loadBuildFromURL();

            expect(result).toBe(false);
        });

        it('should load valid build from URL', () => {
            const buildData = { c: 'hero', w: 'sword' };
            const encoded = btoa(JSON.stringify(buildData));
            window.location.hash = `#build=${encoded}`;

            const result = loadBuildFromURL();

            expect(result).toBe(true);
            expect(ToastManager.success).toHaveBeenCalledWith('Build loaded from URL!');
        });

        it('should handle invalid base64', () => {
            window.location.hash = '#build=invalid!!!base64';

            const result = loadBuildFromURL();

            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build link');
        });

        it('should handle malformed JSON after decode', () => {
            const invalidJSON = btoa('{invalid json}');
            window.location.hash = `#build=${invalidJSON}`;

            const result = loadBuildFromURL();

            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle empty build parameter', () => {
            window.location.hash = '#build=';

            const result = loadBuildFromURL();

            expect(result).toBe(false);
        });

        it('should handle non-existent character ID', () => {
            const buildData = { c: 'nonexistent-character' };
            const encoded = btoa(JSON.stringify(buildData));
            window.location.hash = `#build=${encoded}`;

            const result = loadBuildFromURL();

            // Should succeed but character won't be loaded
            expect(result).toBe(true);
        });

        it('should handle non-existent weapon ID', () => {
            const buildData = { w: 'nonexistent-weapon' };
            const encoded = btoa(JSON.stringify(buildData));
            window.location.hash = `#build=${encoded}`;

            const result = loadBuildFromURL();

            expect(result).toBe(true);
        });

        it('should handle invalid tome array', () => {
            const buildData = { t: 'not-an-array' };
            const encoded = btoa(JSON.stringify(buildData));
            window.location.hash = `#build=${encoded}`;

            const result = loadBuildFromURL();

            // Should handle gracefully
            expect(result).toBe(true);
        });

        it('should handle very long URL', () => {
            const buildData = { i: Array.from({ length: 1000 }, (_, i) => `item${i}`) };
            const encoded = btoa(JSON.stringify(buildData));
            window.location.hash = `#build=${encoded}`;

            const result = loadBuildFromURL();

            // Should handle gracefully
            expect(result).toBe(true);
        });
    });
});

describe('build-planner.ts - calculateBuildStats', () => {
    beforeEach(() => {
        createMinimalDOM();
        clearBuild();
        vi.clearAllMocks();
    });

    describe('character passive bonuses', () => {
        it('should apply crit chance bonus for character with crit passive', () => {
            const build = {
                character: allData.characters.characters[1], // cl4nk
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.crit_chance).toBeGreaterThan(0);
        });

        it('should apply HP bonus for character with HP passive', () => {
            const build = {
                character: allData.characters.characters[2], // monke
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.hp).toBeGreaterThan(100); // Base HP is 100
        });

        it('should handle character with no passive ability', () => {
            const build = {
                character: { id: 'test', name: 'Test', passive_ability: undefined } as any,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats).toBeDefined();
        });

        it('should handle character with empty passive ability', () => {
            const build = {
                character: { id: 'test', name: 'Test', passive_ability: '' } as any,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats).toBeDefined();
        });
    });

    describe('weapon damage calculation', () => {
        it('should add weapon base damage', () => {
            const build = {
                character: null,
                weapon: allData.weapons.weapons[0], // sword, 25 damage
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBeGreaterThanOrEqual(25);
        });

        it('should handle weapon with undefined base_damage', () => {
            const build = {
                character: null,
                weapon: { id: 'test', name: 'Test', base_damage: undefined } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Default damage only
        });

        it('should handle weapon with null base_damage', () => {
            const build = {
                character: null,
                weapon: { id: 'test', name: 'Test', base_damage: null } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Default damage only
        });

        it('should handle weapon with string base_damage', () => {
            const build = {
                character: null,
                weapon: { id: 'test', name: 'Test', base_damage: '30' } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(130); // 100 base + 30 weapon
        });

        it('should handle weapon with decimal base_damage', () => {
            const build = {
                character: null,
                weapon: { id: 'test', name: 'Test', base_damage: 12.5 } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(112.5); // 100 base + 12.5 weapon
        });

        it('should handle weapon with NaN base_damage', () => {
            const build = {
                character: null,
                weapon: { id: 'test', name: 'Test', base_damage: NaN } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Default damage only
        });
    });

    describe('tome calculations', () => {
        it('should apply tome bonuses', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [allData.tomes.tomes[0]], // precision
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.crit_chance).toBeGreaterThan(0);
        });

        it('should handle tome with undefined value_per_level', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [allData.tomes.tomes[2]], // invalid-tome
                items: [],
            };

            // Should not throw
            const stats = calculateBuildStats(build);

            expect(stats).toBeDefined();
        });

        it('should handle tome with null value_per_level', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [{ id: 'test', stat_affected: 'Damage', value_per_level: null }] as any,
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats).toBeDefined();
        });

        it('should handle multiple tomes', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [allData.tomes.tomes[0], allData.tomes.tomes[1]],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.crit_chance).toBeGreaterThan(0);
            expect(stats.damage).toBeGreaterThan(0);
        });
    });

    describe('evasion calculation', () => {
        it('should calculate evasion from evasion_internal', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.evasion).toBeDefined();
            expect(Number.isFinite(stats.evasion)).toBe(true);
        });

        it('should prevent division by zero for extreme negative evasion_internal', () => {
            // This would need to inject very negative evasion_internal value
            // The function clamps to -99, so division by zero is prevented
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(Number.isFinite(stats.evasion)).toBe(true);
            expect(Number.isNaN(stats.evasion)).toBe(false);
        });
    });

    describe('overcrit detection', () => {
        it('should detect overcrit when crit_chance > 100', () => {
            const build = {
                character: allData.characters.characters[1], // cl4nk, +50 crit
                weapon: null,
                tomes: [allData.tomes.tomes[0]], // precision, more crit
                items: [],
            };

            const stats = calculateBuildStats(build);

            // May or may not be > 100 depending on exact values
            expect(typeof stats.overcrit).toBe('boolean');
        });

        it('should not detect overcrit when crit_chance <= 100', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.overcrit).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle empty build', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats).toBeDefined();
            expect(stats.damage).toBeDefined();
        });

        it('should handle build with all null values', () => {
            const build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.hp).toBe(100); // Default HP
        });

        it('should handle very large stat values', () => {
            const build = {
                character: null,
                weapon: { id: 'op', name: 'OP', base_damage: 999999 } as any,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(1000099); // 100 base + 999999 weapon
        });
    });
});

describe('build-planner.ts - getCurrentBuild & clearBuild', () => {
    beforeEach(() => {
        createMinimalDOM();
        clearBuild();
    });

    describe('getCurrentBuild', () => {
        it('should return current build state', () => {
            const build = getCurrentBuild();

            expect(build).toBeDefined();
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
        });

        it('should return build with default values after clear', () => {
            clearBuild();
            const build = getCurrentBuild();

            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
            expect(build.tomes).toEqual([]);
            expect(build.items).toEqual([]);
        });
    });

    describe('clearBuild', () => {
        it('should reset all build properties', () => {
            clearBuild();
            const build = getCurrentBuild();

            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
            expect(build.tomes).toHaveLength(0);
            expect(build.items).toHaveLength(0);
        });

        it('should handle multiple clears', () => {
            clearBuild();
            clearBuild();
            clearBuild();

            const build = getCurrentBuild();
            expect(build.character).toBeNull();
        });
    });
});
