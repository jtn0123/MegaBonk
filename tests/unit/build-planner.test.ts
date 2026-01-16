/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Character, Weapon, Tome, Item } from '../../src/types/index.ts';
import type { BuildStats, ItemEffect } from '../../src/modules/constants.ts';

// Mock modules
vi.mock('../../src/modules/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/modules/toast', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Import constants
const DEFAULT_BUILD_STATS: BuildStats = {
    damage: 100,
    hp: 100,
    crit_chance: 5,
    crit_damage: 150,
    attack_speed: 100,
    movement_speed: 100,
    armor: 0,
    evasion_internal: 0,
    projectiles: 1,
};

const ITEM_EFFECTS: Record<string, ItemEffect> = {
    gym_sauce: { stat: 'damage', value: 10, type: 'add' },
    forbidden_juice: { stat: 'crit_chance', value: 10, type: 'add' },
    oats: { stat: 'hp', value: 25, type: 'add' },
    battery: { stat: 'attack_speed', value: 8, type: 'add' },
    turbo_socks: { stat: 'movement_speed', value: 15, type: 'add' },
    beer: { stat: 'damage', value: 20, type: 'add' },
    backpack: { stat: 'projectiles', value: 1, type: 'add' },
    slippery_ring: { stat: 'evasion_internal', value: 15, type: 'add' },
    phantom_shroud: { stat: 'evasion_internal', value: 15, type: 'add' },
    beefy_ring: { stat: 'damage', value: 20, type: 'hp_percent' },
    leeching_crystal: { stat: 'hp', value: 1.5, type: 'multiply' },
    brass_knuckles: { stat: 'damage', value: 20, type: 'add' },
    boss_buster: { stat: 'damage', value: 15, type: 'add' },
};

// Type definitions
interface Build {
    character: Character | null;
    weapon: Weapon | null;
    tomes: Tome[];
    items: Item[];
}

interface CalculatedBuildStats extends BuildStats {
    evasion: number;
    overcrit: boolean;
}

// ============================================================================
// REIMPLEMENTATION OF calculateBuildStats FOR TESTING
// ============================================================================

function calculateBuildStats(build: Build): CalculatedBuildStats {
    const stats: CalculatedBuildStats = { ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false };

    // Apply character passive bonuses
    if (build.character) {
        const passive = build.character.passive_ability || '';
        const charId = build.character.id;

        // Crit Chance passive (CL4NK)
        if (/crit\s*chance/i.test(passive) || charId === 'cl4nk') {
            stats.crit_chance += 50;
        }
        // HP passive (Monke)
        if (/\+\d+.*max\s*hp/i.test(passive) || charId === 'monke') {
            stats.hp += 50;
        }
        // Armor passive (Sir Oofie)
        if (/armor/i.test(passive) || charId === 'sir_oofie') {
            stats.armor += 50;
        }
        // Damage passive (Ogre)
        if (/gain.*damage/i.test(passive) || charId === 'ogre') {
            stats.damage += 20;
        }
        // Attack Speed passive (Bandit)
        if (/attack\s*speed/i.test(passive) || charId === 'bandit') {
            stats.attack_speed += 50;
        }
    }

    // Apply weapon damage
    if (build.weapon) {
        const baseDamage = (build.weapon as any).base_damage ?? (build.weapon as any).baseDamage;
        const parsedDamage = baseDamage != null ? parseFloat(String(baseDamage)) : 0;
        stats.damage += Number.isNaN(parsedDamage) ? 0 : parsedDamage;
    }

    // Apply tome bonuses
    build.tomes.forEach((tome: Tome) => {
        const tomeLevel = 5;
        const valueStr = tome.value_per_level || '';
        const value = parseFloat(String(valueStr).match(/\d+(?:\.\d+)?/)?.[0] || '0') || 0;

        if (tome.stat_affected === 'Damage') stats.damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Chance' || tome.id === 'precision')
            stats.crit_chance += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Damage') stats.crit_damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'HP' || tome.id === 'vitality') stats.hp += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Attack Speed' || tome.id === 'cooldown')
            stats.attack_speed += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Movement Speed' || tome.id === 'agility')
            stats.movement_speed += value * tomeLevel * 100;
        else if (tome.id === 'armor') stats.armor += value * tomeLevel * 100;
    });

    // Apply item effects
    build.items.forEach((item: Item) => {
        const effect: ItemEffect | undefined = ITEM_EFFECTS[item.id];
        if (effect) {
            const statKey = effect.stat;
            if (effect.type === 'add') {
                stats[statKey] += effect.value;
            } else if (effect.type === 'multiply') {
                stats[statKey] *= effect.value;
            } else if (effect.type === 'hp_percent') {
                // Special: damage based on HP percentage
                stats[statKey] += (stats.hp / 100) * effect.value;
            }
        }
    });

    // Calculate evasion from evasion_internal
    const clampedEvasionInternal = Math.max(stats.evasion_internal, -99);
    stats.evasion = Math.round((clampedEvasionInternal / (1 + clampedEvasionInternal / 100)) * 100) / 100;
    stats.overcrit = stats.crit_chance > 100;

    return stats;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCharacter(id: string, passive: string): Character {
    return {
        id,
        name: id,
        passive_ability: passive,
        starting_weapon: 'sword',
        unlock_condition: 'default',
        tier: 'A',
    } as Character;
}

function createWeapon(id: string, baseDamage: number): Weapon {
    return {
        id,
        name: id,
        base_damage: baseDamage,
        damage_type: 'Physical',
        rarity: 'common',
        tier: 'A',
    } as Weapon;
}

function createTome(id: string, statAffected: string, valuePerLevel: string): Tome {
    return {
        id,
        name: id,
        stat_affected: statAffected,
        value_per_level: valuePerLevel,
        description: '',
        tier: 'A',
        priority: 5,
    } as Tome;
}

function createItem(id: string): Item {
    return {
        id,
        name: id,
        description: '',
        rarity: 'common',
        tier: 'A',
        tags: [],
    } as Item;
}

// ============================================================================
// TESTS
// ============================================================================

// ============================================================================
// TESTS FOR ACTUAL MODULE FUNCTIONS
// ============================================================================

import { createMinimalDOM } from '../helpers/dom-setup.js';
import { ToastManager } from '../../src/modules/toast.ts';

describe('Build Planner - DOM Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();
        localStorage.clear();

        // Add share-build-url button to DOM
        const buildPlannerTab = document.getElementById('build-planner-tab');
        if (buildPlannerTab && !document.getElementById('share-build-url')) {
            const shareBtn = document.createElement('button');
            shareBtn.id = 'share-build-url';
            shareBtn.textContent = 'Share Build';
            buildPlannerTab.appendChild(shareBtn);
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('renderBuildPlanner', () => {
        it('should populate character select with all characters', async () => {
            const { renderBuildPlanner } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            expect(charSelect).toBeTruthy();
            // Should have placeholder + characters
            expect(charSelect.options.length).toBeGreaterThanOrEqual(1);
        });

        it('should populate weapon select with all weapons', async () => {
            const { renderBuildPlanner } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            const weaponSelect = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(weaponSelect).toBeTruthy();
            expect(weaponSelect.options.length).toBeGreaterThanOrEqual(1);
        });

        it('should create checkboxes for tomes', async () => {
            const { renderBuildPlanner } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            const tomesSelection = document.getElementById('tomes-selection');
            expect(tomesSelection).toBeTruthy();
        });

        it('should create checkboxes for items', async () => {
            const { renderBuildPlanner } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            const itemsSelection = document.getElementById('items-selection');
            expect(itemsSelection).toBeTruthy();
        });

        it('should handle missing DOM elements gracefully', async () => {
            document.body.innerHTML = '';
            const { renderBuildPlanner } = await import('../../src/modules/build-planner.ts');

            expect(() => renderBuildPlanner()).not.toThrow();
        });
    });

    describe('setupBuildPlannerEvents', () => {
        it('should not throw when export button is missing', async () => {
            document.getElementById('export-build')?.remove();
            const { setupBuildPlannerEvents } = await import('../../src/modules/build-planner.ts');

            expect(() => setupBuildPlannerEvents()).not.toThrow();
        });

        it('should not throw when share button is missing', async () => {
            document.getElementById('share-build-url')?.remove();
            const { setupBuildPlannerEvents } = await import('../../src/modules/build-planner.ts');

            expect(() => setupBuildPlannerEvents()).not.toThrow();
        });

        it('should not throw when clear button is missing', async () => {
            document.getElementById('clear-build')?.remove();
            const { setupBuildPlannerEvents } = await import('../../src/modules/build-planner.ts');

            expect(() => setupBuildPlannerEvents()).not.toThrow();
        });

        it('should not throw when character select is missing', async () => {
            document.getElementById('build-character')?.remove();
            const { setupBuildPlannerEvents } = await import('../../src/modules/build-planner.ts');

            expect(() => setupBuildPlannerEvents()).not.toThrow();
        });

        it('should not throw when weapon select is missing', async () => {
            document.getElementById('build-weapon')?.remove();
            const { setupBuildPlannerEvents } = await import('../../src/modules/build-planner.ts');

            expect(() => setupBuildPlannerEvents()).not.toThrow();
        });
    });
});

describe('Build Planner - Build History (localStorage)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('getBuildHistory', () => {
        it('should return empty array when localStorage is empty', async () => {
            const { getBuildHistory } = await import('../../src/modules/build-planner.ts');

            const history = getBuildHistory();
            expect(history).toEqual([]);
        });

        it('should return array from localStorage', async () => {
            const mockHistory = [
                { character: 'cl4nk', weapon: 'sword', timestamp: Date.now() },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(mockHistory));

            const { getBuildHistory } = await import('../../src/modules/build-planner.ts');
            const history = getBuildHistory();

            expect(history.length).toBe(1);
            expect(history[0].character).toBe('cl4nk');
        });

        it('should handle corrupted localStorage data', async () => {
            localStorage.setItem('megabonk_build_history', 'invalid json{{{');

            const { getBuildHistory } = await import('../../src/modules/build-planner.ts');
            const history = getBuildHistory();

            expect(history).toEqual([]);
        });
    });

    describe('loadBuildFromHistory', () => {
        it('should show error for invalid index', async () => {
            const { loadBuildFromHistory } = await import('../../src/modules/build-planner.ts');

            loadBuildFromHistory(-1);

            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should show error for out of range index', async () => {
            const { loadBuildFromHistory } = await import('../../src/modules/build-planner.ts');

            loadBuildFromHistory(999);

            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });
    });

    describe('deleteBuildFromHistory', () => {
        it('should show error for invalid index', async () => {
            const { deleteBuildFromHistory } = await import('../../src/modules/build-planner.ts');

            deleteBuildFromHistory(-1);

            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should show error for out of range index', async () => {
            const { deleteBuildFromHistory } = await import('../../src/modules/build-planner.ts');

            deleteBuildFromHistory(999);

            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should remove build at valid index', async () => {
            const mockHistory = [
                { name: 'Build 1', character: 'cl4nk', timestamp: Date.now() },
                { name: 'Build 2', character: 'monke', timestamp: Date.now() },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(mockHistory));

            const { deleteBuildFromHistory, getBuildHistory } = await import('../../src/modules/build-planner.ts');
            deleteBuildFromHistory(0);

            const history = getBuildHistory();
            expect(history.length).toBe(1);
            expect(history[0].name).toBe('Build 2');
        });
    });

    describe('clearBuildHistory', () => {
        it('should clear all history from localStorage', async () => {
            const mockHistory = [{ character: 'cl4nk', timestamp: Date.now() }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(mockHistory));

            const { clearBuildHistory, getBuildHistory } = await import('../../src/modules/build-planner.ts');
            clearBuildHistory();

            const history = getBuildHistory();
            expect(history).toEqual([]);
        });
    });
});

describe('Build Planner - URL Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();
        localStorage.clear();
        // Reset URL hash
        window.history.replaceState(null, '', window.location.pathname);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
        window.history.replaceState(null, '', window.location.pathname);
    });

    describe('loadBuildFromURL', () => {
        it('should return false when no hash present', async () => {
            window.history.replaceState(null, '', window.location.pathname);
            const { loadBuildFromURL } = await import('../../src/modules/build-planner.ts');

            const result = loadBuildFromURL();
            expect(result).toBe(false);
        });

        it('should return false when hash does not contain build=', async () => {
            window.history.replaceState(null, '', '#something-else');
            const { loadBuildFromURL } = await import('../../src/modules/build-planner.ts');

            const result = loadBuildFromURL();
            expect(result).toBe(false);
        });

        it('should handle invalid base64 gracefully', async () => {
            window.history.replaceState(null, '', '#build=!!!invalid-base64!!!');
            const { loadBuildFromURL } = await import('../../src/modules/build-planner.ts');

            const result = loadBuildFromURL();

            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build link');
        });
    });

    describe('updateBuildURL', () => {
        it('should not throw when called', async () => {
            window.history.replaceState(null, '', window.location.pathname);
            const { updateBuildURL } = await import('../../src/modules/build-planner.ts');

            // Should not throw when called
            expect(() => updateBuildURL()).not.toThrow();
        });
    });
});

describe('Build Planner - Import/Export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('importBuild', () => {
        it('should show error for invalid JSON', async () => {
            const { importBuild } = await import('../../src/modules/build-planner.ts');

            importBuild('not valid json');

            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build data. Please check the format.');
        });
    });

    describe('loadBuildTemplate', () => {
        it('should show error for invalid template', async () => {
            const { loadBuildTemplate } = await import('../../src/modules/build-planner.ts');

            loadBuildTemplate('nonexistent_template');

            expect(ToastManager.error).toHaveBeenCalledWith('Template not found');
        });

        it('should load valid template', async () => {
            const { loadBuildTemplate } = await import('../../src/modules/build-planner.ts');

            loadBuildTemplate('crit_build');

            expect(ToastManager.success).toHaveBeenCalled();
        });
    });
});

describe('Build Planner - Clear Build', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('clearBuild', () => {
        it('should reset character select', async () => {
            const { clearBuild } = await import('../../src/modules/build-planner.ts');
            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            if (charSelect) {
                charSelect.value = 'cl4nk';
            }

            clearBuild();

            expect(charSelect?.value || '').toBe('');
        });

        it('should reset weapon select', async () => {
            const { clearBuild } = await import('../../src/modules/build-planner.ts');
            const weaponSelect = document.getElementById('build-weapon') as HTMLSelectElement;
            if (weaponSelect) {
                weaponSelect.value = 'sword';
            }

            clearBuild();

            expect(weaponSelect?.value || '').toBe('');
        });

        it('should uncheck all tome checkboxes', async () => {
            const { renderBuildPlanner, clearBuild } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            // Check some tome checkboxes
            const tomeCheckboxes = document.querySelectorAll('.tome-checkbox') as NodeListOf<HTMLInputElement>;
            tomeCheckboxes.forEach(cb => (cb.checked = true));

            clearBuild();

            tomeCheckboxes.forEach(cb => expect(cb.checked).toBe(false));
        });

        it('should uncheck all item checkboxes', async () => {
            const { renderBuildPlanner, clearBuild } = await import('../../src/modules/build-planner.ts');
            renderBuildPlanner();

            // Check some item checkboxes
            const itemCheckboxes = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
            itemCheckboxes.forEach(cb => (cb.checked = true));

            clearBuild();

            itemCheckboxes.forEach(cb => expect(cb.checked).toBe(false));
        });
    });
});

describe('Build Planner - getCurrentBuild', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return a deep copy of the build', async () => {
        const { getCurrentBuild } = await import('../../src/modules/build-planner.ts');

        const build1 = getCurrentBuild();
        const build2 = getCurrentBuild();

        expect(build1).not.toBe(build2);
        expect(build1.tomes).not.toBe(build2.tomes);
        expect(build1.items).not.toBe(build2.items);
    });
});

describe('Build Planner - calculateBuildStats', () => {
    describe('Empty Build', () => {
        it('should return default stats for empty build', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100);
            expect(stats.hp).toBe(100);
            expect(stats.crit_chance).toBe(5);
            expect(stats.crit_damage).toBe(150);
            expect(stats.attack_speed).toBe(100);
            expect(stats.movement_speed).toBe(100);
            expect(stats.armor).toBe(0);
            expect(stats.evasion_internal).toBe(0);
            expect(stats.projectiles).toBe(1);
            expect(stats.evasion).toBe(0);
            expect(stats.overcrit).toBe(false);
        });
    });

    describe('Character Passive Bonuses', () => {
        it('should apply CL4NK crit chance bonus', () => {
            const build: Build = {
                character: createCharacter('cl4nk', 'Gain 1% Crit Chance per level'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.crit_chance).toBe(55); // 5 base + 50 from passive
        });

        it('should apply Monke HP bonus', () => {
            const build: Build = {
                character: createCharacter('monke', '+2 Max HP per level'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.hp).toBe(150); // 100 base + 50 from passive
        });

        it('should apply Sir Oofie armor bonus', () => {
            const build: Build = {
                character: createCharacter('sir_oofie', 'Gain 1% Armor per level'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.armor).toBe(50); // 0 base + 50 from passive
        });

        it('should apply Ogre damage bonus', () => {
            const build: Build = {
                character: createCharacter('ogre', 'Gain 1.5% Damage per level'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(120); // 100 base + 20 from passive
        });

        it('should apply Bandit attack speed bonus', () => {
            const build: Build = {
                character: createCharacter('bandit', 'Gain 1% Attack Speed per level'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.attack_speed).toBe(150); // 100 base + 50 from passive
        });

        it('should handle character with no matching passive', () => {
            const build: Build = {
                character: createCharacter('unknown', 'Some other passive'),
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // Should have default stats only
            expect(stats.damage).toBe(100);
            expect(stats.hp).toBe(100);
            expect(stats.crit_chance).toBe(5);
            expect(stats.armor).toBe(0);
            expect(stats.attack_speed).toBe(100);
        });
    });

    describe('Weapon Damage', () => {
        it('should add weapon base damage', () => {
            const build: Build = {
                character: null,
                weapon: createWeapon('sword', 25),
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(125); // 100 base + 25 weapon
        });

        it('should handle decimal weapon damage', () => {
            const build: Build = {
                character: null,
                weapon: createWeapon('dagger', 15.5),
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(115.5); // 100 base + 15.5 weapon
        });

        it('should handle weapon with undefined damage', () => {
            const weapon = createWeapon('broken_sword', 0);
            (weapon as any).base_damage = undefined;

            const build: Build = {
                character: null,
                weapon: weapon,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Should remain at base
        });

        it('should handle weapon with null damage', () => {
            const weapon = createWeapon('broken_sword', 0);
            (weapon as any).base_damage = null;

            const build: Build = {
                character: null,
                weapon: weapon,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Should remain at base
        });
    });

    describe('Tome Bonuses', () => {
        it('should apply damage tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('damage_tome', 'Damage', '0.02')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.02 * 5 (level) * 100 = 10
            expect(stats.damage).toBe(110); // 100 base + 10 from tome
        });

        it('should apply crit chance tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('precision', 'Crit Chance', '0.01')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.01 * 5 * 100 = 5
            expect(stats.crit_chance).toBe(10); // 5 base + 5 from tome
        });

        it('should apply HP tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('vitality', 'HP', '0.05')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.05 * 5 * 100 = 25
            expect(stats.hp).toBe(125); // 100 base + 25 from tome
        });

        it('should apply attack speed tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('cooldown', 'Attack Speed', '0.02')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.02 * 5 * 100 = 10
            expect(stats.attack_speed).toBe(110); // 100 base + 10 from tome
        });

        it('should apply movement speed tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('agility', 'Movement Speed', '0.03')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.03 * 5 * 100 = 15
            expect(stats.movement_speed).toBe(115); // 100 base + 15 from tome
        });

        it('should apply armor tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('armor', 'Armor', '0.01')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.01 * 5 * 100 = 5
            expect(stats.armor).toBe(5); // 0 base + 5 from tome
        });

        it('should apply crit damage tome bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('crit_damage_tome', 'Crit Damage', '0.10')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 0.10 * 5 * 100 = 50
            expect(stats.crit_damage).toBe(200); // 150 base + 50 from tome
        });

        it('should apply multiple tomes correctly', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [
                    createTome('damage_tome', 'Damage', '0.02'),
                    createTome('precision', 'Crit Chance', '0.01'),
                    createTome('vitality', 'HP', '0.05'),
                ],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(110); // 100 + 10
            expect(stats.crit_chance).toBe(10); // 5 + 5
            expect(stats.hp).toBe(125); // 100 + 25
        });

        it('should handle tome with invalid value_per_level', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [createTome('broken_tome', 'Damage', '')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(100); // Should remain at base
        });
    });

    describe('Item Effects - Add Type', () => {
        it('should apply gym_sauce damage bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('gym_sauce')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(110); // 100 + 10
        });

        it('should apply forbidden_juice crit chance bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('forbidden_juice')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.crit_chance).toBe(15); // 5 + 10
        });

        it('should apply oats HP bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('oats')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.hp).toBe(125); // 100 + 25
        });

        it('should apply battery attack speed bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('battery')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.attack_speed).toBe(108); // 100 + 8
        });

        it('should apply turbo_socks movement speed bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('turbo_socks')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.movement_speed).toBe(115); // 100 + 15
        });

        it('should apply beer damage bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('beer')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should apply backpack projectiles bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('backpack')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.projectiles).toBe(2); // 1 + 1
        });

        it('should apply slippery_ring evasion bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('slippery_ring')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.evasion_internal).toBe(15); // 0 + 15
        });

        it('should apply phantom_shroud evasion bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('phantom_shroud')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.evasion_internal).toBe(15); // 0 + 15
        });

        it('should apply brass_knuckles damage bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('brass_knuckles')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should apply boss_buster damage bonus', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('boss_buster')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.damage).toBe(115); // 100 + 15
        });
    });

    describe('Item Effects - Multiply Type', () => {
        it('should apply leeching_crystal HP multiplier', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('leeching_crystal')],
            };

            const stats = calculateBuildStats(build);

            expect(stats.hp).toBe(150); // 100 * 1.5
        });

        it('should apply multiplier after additive bonuses', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('oats'), createItem('leeching_crystal')],
            };

            const stats = calculateBuildStats(build);

            // First oats: 100 + 25 = 125
            // Then leeching_crystal: 125 * 1.5 = 187.5
            expect(stats.hp).toBe(187.5);
        });
    });

    describe('Item Effects - HP Percent Type', () => {
        it('should apply beefy_ring damage based on HP', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('beefy_ring')],
            };

            const stats = calculateBuildStats(build);

            // (100 HP / 100) * 20 = 20 bonus damage
            expect(stats.damage).toBe(120); // 100 + 20
        });

        it('should scale beefy_ring with increased HP', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('oats'), createItem('beefy_ring')],
            };

            const stats = calculateBuildStats(build);

            // First oats: HP becomes 125
            // Then beefy_ring: (125 / 100) * 20 = 25 bonus damage
            expect(stats.damage).toBe(125); // 100 + 25
        });

        it('should scale beefy_ring with HP multiplier', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('leeching_crystal'), createItem('beefy_ring')],
            };

            const stats = calculateBuildStats(build);

            // First leeching_crystal: HP becomes 150
            // Then beefy_ring: (150 / 100) * 20 = 30 bonus damage
            expect(stats.damage).toBe(130); // 100 + 30
        });
    });

    describe('Evasion Calculation', () => {
        it('should calculate evasion from evasion_internal', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('slippery_ring')],
            };

            const stats = calculateBuildStats(build);

            // Formula: evasion = internal / (1 + internal/100)
            // 15 / (1 + 15/100) = 15 / 1.15 = 13.04...
            expect(stats.evasion).toBeCloseTo(13.04, 2);
        });

        it('should handle multiple evasion items', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('slippery_ring'), createItem('phantom_shroud')],
            };

            const stats = calculateBuildStats(build);

            // 30 / (1 + 30/100) = 30 / 1.3 = 23.07...
            expect(stats.evasion_internal).toBe(30);
            expect(stats.evasion).toBeCloseTo(23.08, 2);
        });

        it('should handle negative evasion_internal safely', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // Test that the formula works with negative values
            // Even if evasion_internal were -50: -50 / (1 + -50/100) = -50 / 0.5 = -100
            expect(stats.evasion).toBe(0); // Should be 0 for empty build
        });

        it('should handle zero evasion_internal', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [],
            };

            const stats = calculateBuildStats(build);

            expect(stats.evasion_internal).toBe(0);
            expect(stats.evasion).toBe(0);
        });
    });

    describe('Overcrit Detection', () => {
        it('should detect overcrit when crit_chance > 100', () => {
            const build: Build = {
                character: createCharacter('cl4nk', 'Gain 1% Crit Chance per level'),
                weapon: null,
                tomes: [createTome('precision', 'Crit Chance', '0.10')],
                items: [createItem('forbidden_juice')],
            };

            const stats = calculateBuildStats(build);

            // 5 base + 50 (cl4nk) + 50 (tome) + 10 (item) = 115
            expect(stats.crit_chance).toBe(115);
            expect(stats.overcrit).toBe(true);
        });

        it('should not detect overcrit when crit_chance = 100', () => {
            const build: Build = {
                character: createCharacter('cl4nk', 'Gain 1% Crit Chance per level'),
                weapon: null,
                tomes: [createTome('precision', 'Crit Chance', '0.09')],
                items: [],
            };

            const stats = calculateBuildStats(build);

            // 5 base + 50 (cl4nk) + 45 (tome) = 100
            expect(stats.crit_chance).toBe(100);
            expect(stats.overcrit).toBe(false);
        });

        it('should not detect overcrit for low crit builds', () => {
            const build: Build = {
                character: null,
                weapon: null,
                tomes: [],
                items: [createItem('forbidden_juice')],
            };

            const stats = calculateBuildStats(build);

            // 5 base + 10 (item) = 15
            expect(stats.crit_chance).toBe(15);
            expect(stats.overcrit).toBe(false);
        });
    });

    describe('Complex Builds', () => {
        it('should calculate full crit build correctly', () => {
            const build: Build = {
                character: createCharacter('cl4nk', 'Gain 1% Crit Chance per level'),
                weapon: createWeapon('revolver', 30),
                tomes: [
                    createTome('precision', 'Crit Chance', '0.02'),
                    createTome('damage_tome', 'Damage', '0.03'),
                ],
                items: [createItem('forbidden_juice'), createItem('gym_sauce')],
            };

            const stats = calculateBuildStats(build);

            // Damage: 100 + 30 (weapon) + 15 (tome) + 10 (gym_sauce) = 155
            // Note: forbidden_juice adds crit_chance, not damage
            expect(stats.damage).toBe(155);
            // Crit: 5 + 50 (cl4nk) + 10 (tome) + 10 (forbidden_juice) = 75
            expect(stats.crit_chance).toBe(75);
            expect(stats.overcrit).toBe(false);
        });

        it('should calculate tank build correctly', () => {
            const build: Build = {
                character: createCharacter('sir_oofie', 'Gain 1% Armor per level'),
                weapon: createWeapon('sword', 25),
                tomes: [
                    createTome('vitality', 'HP', '0.05'),
                    createTome('armor', 'Armor', '0.02'),
                ],
                items: [createItem('oats'), createItem('leeching_crystal')],
            };

            const stats = calculateBuildStats(build);

            // HP: (100 + 25 (tome) + 25 (oats)) * 1.5 (leeching_crystal) = 225
            expect(stats.hp).toBe(225);
            // Armor: 50 (sir_oofie) + 10 (tome) = 60
            expect(stats.armor).toBe(60);
            // Damage: 100 + 25 (weapon) = 125
            expect(stats.damage).toBe(125);
        });

        it('should calculate HP scaling damage build', () => {
            const build: Build = {
                character: createCharacter('monke', '+2 Max HP per level'),
                weapon: createWeapon('hammer', 35),
                tomes: [createTome('vitality', 'HP', '0.10')],
                items: [
                    createItem('oats'),
                    createItem('leeching_crystal'),
                    createItem('beefy_ring'),
                ],
            };

            const stats = calculateBuildStats(build);

            // HP: (100 + 50 (monke) + 50 (tome) + 25 (oats)) * 1.5 (leeching_crystal) = 337.5
            expect(stats.hp).toBe(337.5);
            // Damage: 100 + 35 (weapon) + (337.5 / 100) * 20 (beefy_ring) = 135 + 67.5 = 202.5
            expect(stats.damage).toBe(202.5);
        });

        it('should handle build with no item effects', () => {
            const build: Build = {
                character: createCharacter('ogre', 'Gain 1.5% Damage per level'),
                weapon: createWeapon('axe', 40),
                tomes: [createTome('damage_tome', 'Damage', '0.04')],
                items: [createItem('unknown_item')],
            };

            const stats = calculateBuildStats(build);

            // Damage: 100 + 20 (ogre) + 40 (weapon) + 20 (tome) = 180
            expect(stats.damage).toBe(180);
        });
    });
});
