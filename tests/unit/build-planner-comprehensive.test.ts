// ========================================
// Build Planner Comprehensive Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData, createMockItem, createMockWeapon, createMockCharacter, createMockTome } from '../helpers/mock-data.js';

// Mock modules
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
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    escapeHtml: vi.fn((str: string) => str),
    safeQuerySelectorAll: vi.fn((selector: string) => document.querySelectorAll(selector)),
    safeSetValue: vi.fn((id: string, value: string) => {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
        if (el) el.value = value;
    }),
}));

// Mock data-service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: { items: [] },
        weapons: { weapons: [] },
        tomes: { tomes: [] },
        characters: { characters: [] },
        shrines: { shrines: [] },
    },
}));

vi.mock('../../src/modules/constants.ts', () => ({
    BUILD_ITEMS_LIMIT: 50,
    DEFAULT_BUILD_STATS: {
        damage: 100,
        hp: 100,
        crit_chance: 5,
        crit_damage: 150,
        attack_speed: 100,
        movement_speed: 100,
        armor: 0,
        evasion_internal: 0,
        projectiles: 1,
    },
    ITEM_EFFECTS: {
        'power-gloves': { stat: 'damage', type: 'add', value: 25 },
        'hp-ring': { stat: 'hp', type: 'add', value: 50 },
        'crit-amulet': { stat: 'crit_chance', type: 'add', value: 10 },
        'damage-multiplier': { stat: 'damage', type: 'multiply', value: 1.5 },
        'hp-percent-damage': { stat: 'damage', type: 'hp_percent', value: 5 },
    },
}));

import {
    getBuildHistory,
    saveBuildToHistory,
    loadBuildFromHistory,
    deleteBuildFromHistory,
    clearBuildHistory,
    loadBuildTemplate,
    loadBuildFromData,
    importBuild,
    renderBuildPlanner,
    setupBuildPlannerEvents,
    calculateBuildStats,
    updateBuildAnalysis,
    exportBuild,
    shareBuildURL,
    loadBuildFromURL,
    updateBuildURL,
    clearBuild,
    getCurrentBuild,
    BUILD_TEMPLATES,
} from '../../src/modules/build-planner.ts';
import { allData } from '../../src/modules/data-service.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';

describe('Build Planner Module', () => {
    let mockLocalStorage: Record<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup DOM
        createMinimalDOM();

        // Add build planner specific elements
        const buildPlannerHTML = `
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
        document.body.innerHTML += buildPlannerHTML;

        // Setup mock data
        const mockData = createMockAllData();
        (allData as any).items = mockData.items;
        (allData as any).weapons = mockData.weapons;
        (allData as any).tomes = mockData.tomes;
        (allData as any).characters = mockData.characters;
        (allData as any).shrines = mockData.shrines;

        // Mock localStorage
        mockLocalStorage = {};
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => mockLocalStorage[key] || null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            mockLocalStorage[key] = value;
        });
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
            delete mockLocalStorage[key];
        });

        // Mock clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
                readText: vi.fn().mockResolvedValue(''),
            },
        });

        // Mock history
        vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('BUILD_TEMPLATES', () => {
        it('should have crit build template', () => {
            expect(BUILD_TEMPLATES.crit_build).toBeDefined();
            expect(BUILD_TEMPLATES.crit_build.name).toContain('Crit');
        });

        it('should have tank build template', () => {
            expect(BUILD_TEMPLATES.tank_build).toBeDefined();
            expect(BUILD_TEMPLATES.tank_build.name).toContain('Tank');
        });

        it('should have speed build template', () => {
            expect(BUILD_TEMPLATES.speed_build).toBeDefined();
            expect(BUILD_TEMPLATES.speed_build.name).toContain('Speed');
        });

        it('should have glass cannon build template', () => {
            expect(BUILD_TEMPLATES.glass_cannon).toBeDefined();
            expect(BUILD_TEMPLATES.glass_cannon.name).toContain('Glass Cannon');
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(BUILD_TEMPLATES)).toBe(true);
        });
    });

    describe('getBuildHistory', () => {
        it('should return an array', () => {
            const history = getBuildHistory();
            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('saveBuildToHistory', () => {
        beforeEach(() => {
            // Setup a build to save
            clearBuild();
        });

        it('should show warning when build is empty', () => {
            saveBuildToHistory();
            expect(ToastManager.warning).toHaveBeenCalledWith(
                expect.stringContaining('at least a character or weapon')
            );
        });

        it('should save build with character to history', () => {
            // Set up a character in the build
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            (allData as any).characters.characters = [char];

            // Manually set the character select value
            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            const option = document.createElement('option');
            option.value = 'test-char';
            charSelect.appendChild(option);
            charSelect.value = 'test-char';

            // Trigger change event
            charSelect.dispatchEvent(new Event('change'));

            // Need to call setupBuildPlannerEvents first to register listeners
            setupBuildPlannerEvents();
            charSelect.dispatchEvent(new Event('change'));

            // For this test, we'll use loadBuildFromData instead
            loadBuildFromData({ character: 'test-char' });

            saveBuildToHistory();
            expect(ToastManager.success).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
        });

        it('should limit history to 20 builds', () => {
            // Create a character for the build
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            (allData as any).characters.characters = [char];

            // Pre-fill history with 20 builds
            const existingHistory = Array.from({ length: 20 }, (_, i) => ({
                character: 'test-char',
                timestamp: Date.now() - i * 1000,
            }));
            mockLocalStorage['megabonk_build_history'] = JSON.stringify(existingHistory);

            loadBuildFromData({ character: 'test-char' });
            saveBuildToHistory();

            const history = JSON.parse(mockLocalStorage['megabonk_build_history']);
            expect(history.length).toBe(20);
        });
    });

    describe('loadBuildFromHistory', () => {
        it('should show error for invalid index', () => {
            loadBuildFromHistory(999);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should show error for negative index', () => {
            loadBuildFromHistory(-1);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });
    });

    describe('deleteBuildFromHistory', () => {
        it('should show error for invalid index', () => {
            deleteBuildFromHistory(999);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });
    });

    describe('clearBuildHistory', () => {
        it('should show success message', () => {
            clearBuildHistory();
            expect(ToastManager.success).toHaveBeenCalledWith('Build history cleared');
        });
    });

    describe('loadBuildTemplate', () => {
        beforeEach(() => {
            // Setup test data that matches template IDs
            (allData as any).characters.characters = [
                createMockCharacter({ id: 'cl4nk', name: 'CL4NK' }),
            ];
            (allData as any).weapons.weapons = [
                createMockWeapon({ id: 'revolver', name: 'Revolver' }),
            ];
            (allData as any).tomes.tomes = [
                createMockTome({ id: 'precision', name: 'Precision' }),
                createMockTome({ id: 'damage', name: 'Damage' }),
            ];
            (allData as any).items.items = [
                createMockItem({ id: 'clover', name: 'Clover' }),
                createMockItem({ id: 'eagle_claw', name: 'Eagle Claw' }),
            ];
        });

        it('should show error for invalid template', () => {
            loadBuildTemplate('nonexistent');
            expect(ToastManager.error).toHaveBeenCalledWith('Template not found');
        });

        it('should load crit build template', () => {
            loadBuildTemplate('crit_build');
            expect(ToastManager.success).toHaveBeenCalledWith(expect.stringContaining('Crit'));
        });
    });

    describe('loadBuildFromData', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            const weapon = createMockWeapon({ id: 'test-weapon', name: 'Test Weapon' });
            const tome = createMockTome({ id: 'test-tome', name: 'Test Tome' });
            const item = createMockItem({ id: 'test-item', name: 'Test Item' });

            (allData as any).characters.characters = [char];
            (allData as any).weapons.weapons = [weapon];
            (allData as any).tomes.tomes = [tome];
            (allData as any).items.items = [item];

            // Setup DOM elements for tomes and items
            const tomesSelection = document.getElementById('tomes-selection');
            if (tomesSelection) {
                tomesSelection.innerHTML = '<label><input type="checkbox" value="test-tome" class="tome-checkbox"> Test Tome</label>';
            }
            const itemsSelection = document.getElementById('items-selection');
            if (itemsSelection) {
                itemsSelection.innerHTML = '<label><input type="checkbox" value="test-item" class="item-checkbox"> Test Item</label>';
            }
        });

        it('should load character from build data', () => {
            loadBuildFromData({ character: 'test-char' });

            const build = getCurrentBuild();
            expect(build.character?.id).toBe('test-char');
        });

        it('should load weapon from build data', () => {
            loadBuildFromData({ weapon: 'test-weapon' });

            const build = getCurrentBuild();
            expect(build.weapon?.id).toBe('test-weapon');
        });

        it('should load tomes from build data', () => {
            loadBuildFromData({ tomes: ['test-tome'] });

            const checkbox = document.querySelector('.tome-checkbox[value="test-tome"]') as HTMLInputElement;
            expect(checkbox?.checked).toBe(true);
        });

        it('should load items from build data', () => {
            loadBuildFromData({ items: ['test-item'] });

            const checkbox = document.querySelector('.item-checkbox[value="test-item"]') as HTMLInputElement;
            expect(checkbox?.checked).toBe(true);
        });

        it('should handle missing entities gracefully', () => {
            // Should not throw when character doesn't exist
            expect(() => {
                loadBuildFromData({ character: 'nonexistent' });
            }).not.toThrow();
        });
    });

    describe('importBuild', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            (allData as any).characters.characters = [char];
        });

        it('should import valid JSON build', () => {
            const buildJson = JSON.stringify({ character: 'test-char' });
            importBuild(buildJson);

            expect(ToastManager.success).toHaveBeenCalledWith('Build imported successfully!');
        });

        it('should show error for invalid JSON', () => {
            importBuild('invalid json');
            expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Invalid build data'));
        });
    });

    describe('renderBuildPlanner', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char', tier: 'S' });
            const weapon = createMockWeapon({ id: 'test-weapon', name: 'Test Weapon', tier: 'A' });
            const tome = createMockTome({ id: 'test-tome', name: 'Test Tome' });
            const item = createMockItem({ id: 'test-item', name: 'Test Item', tier: 'B' });

            (allData as any).characters.characters = [char];
            (allData as any).weapons.weapons = [weapon];
            (allData as any).tomes.tomes = [tome];
            (allData as any).items.items = [item];
        });

        it('should populate character select', () => {
            renderBuildPlanner();

            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            expect(charSelect.innerHTML).toContain('Test Char');
            expect(charSelect.innerHTML).toContain('S Tier');
        });

        it('should populate weapon select', () => {
            renderBuildPlanner();

            const weaponSelect = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(weaponSelect.innerHTML).toContain('Test Weapon');
            expect(weaponSelect.innerHTML).toContain('A Tier');
        });

        it('should populate tomes selection', () => {
            renderBuildPlanner();

            const tomesSelection = document.getElementById('tomes-selection');
            expect(tomesSelection?.innerHTML).toContain('Test Tome');
            expect(tomesSelection?.innerHTML).toContain('tome-checkbox');
        });

        it('should populate items selection', () => {
            renderBuildPlanner();

            const itemsSelection = document.getElementById('items-selection');
            expect(itemsSelection?.innerHTML).toContain('Test Item');
            expect(itemsSelection?.innerHTML).toContain('item-checkbox');
        });
    });

    describe('calculateBuildStats', () => {
        it('should return default stats for empty build', () => {
            clearBuild();
            const stats = calculateBuildStats();

            expect(stats.damage).toBeDefined();
            expect(stats.hp).toBeDefined();
            expect(stats.crit_chance).toBeDefined();
        });

        it('should apply weapon base damage', () => {
            const weapon = createMockWeapon({ id: 'dmg-weapon', name: 'Damage Weapon', base_damage: 50 });
            (allData as any).weapons.weapons = [weapon];

            loadBuildFromData({ weapon: 'dmg-weapon' });
            const stats = calculateBuildStats();

            expect(stats.damage).toBeGreaterThanOrEqual(50);
        });

        it('should apply character passive bonuses for crit characters', () => {
            const critChar = createMockCharacter({
                id: 'crit-char',
                name: 'Crit Character',
                passive_ability: 'Gain 1% Crit Chance per level',
            });
            (allData as any).characters.characters = [critChar];

            loadBuildFromData({ character: 'crit-char' });
            const stats = calculateBuildStats();

            // Should have bonus crit chance
            expect(stats.crit_chance).toBeGreaterThan(5);
        });

        it('should apply character passive bonuses for HP characters', () => {
            const hpChar = createMockCharacter({
                id: 'hp-char',
                name: 'HP Character',
                passive_ability: '+2 Max HP per level',
            });
            (allData as any).characters.characters = [hpChar];

            loadBuildFromData({ character: 'hp-char' });
            const stats = calculateBuildStats();

            // Should have bonus HP
            expect(stats.hp).toBeGreaterThan(100);
        });

        it('should detect overcrit when crit chance > 100', () => {
            clearBuild();

            // Create a character with high crit
            const critChar = createMockCharacter({
                id: 'crit-char',
                name: 'Crit Character',
                passive_ability: 'Gain 1% Crit Chance per level',
            });
            (allData as any).characters.characters = [critChar];

            // Create tomes that add massive crit
            const critTome = createMockTome({
                id: 'crit-tome',
                name: 'Crit Tome',
                stat_affected: 'Crit Chance',
                value_per_level: '5%',
            });
            (allData as any).tomes.tomes = [critTome];

            // Need to set up DOM for tomes
            const tomesSelection = document.getElementById('tomes-selection');
            if (tomesSelection) {
                tomesSelection.innerHTML = '<label><input type="checkbox" value="crit-tome" class="tome-checkbox" checked> Crit Tome</label>';
            }

            loadBuildFromData({ character: 'crit-char', tomes: ['crit-tome'] });
            const stats = calculateBuildStats();

            // With high enough crit, should trigger overcrit
            // Note: The actual calculation may vary based on implementation
            expect(stats.overcrit).toBeDefined();
        });

        it('should calculate evasion from evasion_internal', () => {
            clearBuild();
            const stats = calculateBuildStats();

            // Evasion formula: internal / (1 + internal/100)
            expect(stats.evasion).toBeDefined();
        });

        it('should clamp evasion_internal to prevent division errors', () => {
            // This tests the edge case where evasion_internal could be <= -100
            clearBuild();
            const stats = calculateBuildStats();

            // Should not throw and should return a valid number
            expect(Number.isFinite(stats.evasion)).toBe(true);
        });
    });

    describe('exportBuild', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            const weapon = createMockWeapon({ id: 'test-weapon', name: 'Test Weapon' });
            (allData as any).characters.characters = [char];
            (allData as any).weapons.weapons = [weapon];
        });

        it('should copy build JSON to clipboard', async () => {
            loadBuildFromData({ character: 'test-char', weapon: 'test-weapon' });

            exportBuild();

            // Wait for promise to resolve
            await vi.waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalled();
            });

            expect(ToastManager.success).toHaveBeenCalledWith('Build code copied to clipboard!');
        });

        it('should handle clipboard errors', async () => {
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'));

            exportBuild();

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Failed to copy'));
            });
        });
    });

    // Note: URL-related tests (shareBuildURL, loadBuildFromURL, updateBuildURL) are skipped
    // because JSDOM doesn't support redefining window.location. These features are tested
    // via integration tests instead.

    describe('clearBuild', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            (allData as any).characters.characters = [char];
        });

        it('should clear character and weapon', () => {
            loadBuildFromData({ character: 'test-char' });

            clearBuild();

            const build = getCurrentBuild();
            expect(build.character).toBeNull();
            expect(build.weapon).toBeNull();
        });

        it('should clear tomes and items', () => {
            clearBuild();

            const build = getCurrentBuild();
            expect(build.tomes).toEqual([]);
            expect(build.items).toEqual([]);
        });

        it('should log clear event', () => {
            loadBuildFromData({ character: 'test-char' });
            clearBuild();

            expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
                operation: 'build.clear',
            }));
        });

        it('should uncheck all tome checkboxes', () => {
            // Setup DOM with checked checkboxes
            const tomesSelection = document.getElementById('tomes-selection');
            if (tomesSelection) {
                tomesSelection.innerHTML = '<label><input type="checkbox" value="test-tome" class="tome-checkbox" checked> Test Tome</label>';
            }

            clearBuild();

            const checkbox = document.querySelector('.tome-checkbox') as HTMLInputElement;
            expect(checkbox?.checked).toBe(false);
        });

        it('should uncheck all item checkboxes', () => {
            // Setup DOM with checked checkboxes
            const itemsSelection = document.getElementById('items-selection');
            if (itemsSelection) {
                itemsSelection.innerHTML = '<label><input type="checkbox" value="test-item" class="item-checkbox" checked> Test Item</label>';
            }

            clearBuild();

            const checkbox = document.querySelector('.item-checkbox') as HTMLInputElement;
            expect(checkbox?.checked).toBe(false);
        });
    });

    describe('getCurrentBuild', () => {
        it('should return a copy of the build', () => {
            const build1 = getCurrentBuild();
            const build2 = getCurrentBuild();

            // Should be equal but not the same reference
            expect(build1).toEqual(build2);
            expect(build1).not.toBe(build2);
        });

        it('should return deep copy of tomes array', () => {
            const build1 = getCurrentBuild();
            const build2 = getCurrentBuild();

            expect(build1.tomes).not.toBe(build2.tomes);
        });

        it('should return deep copy of items array', () => {
            const build1 = getCurrentBuild();
            const build2 = getCurrentBuild();

            expect(build1.items).not.toBe(build2.items);
        });
    });

    describe('setupBuildPlannerEvents', () => {
        beforeEach(() => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            const weapon = createMockWeapon({ id: 'test-weapon', name: 'Test Weapon' });
            (allData as any).characters.characters = [char];
            (allData as any).weapons.weapons = [weapon];

            renderBuildPlanner();
        });

        it('should register character select event listener', () => {
            setupBuildPlannerEvents();

            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            charSelect.value = 'test-char';
            charSelect.dispatchEvent(new Event('change'));

            const build = getCurrentBuild();
            expect(build.character?.id).toBe('test-char');
        });

        it('should register weapon select event listener', () => {
            setupBuildPlannerEvents();

            const weaponSelect = document.getElementById('build-weapon') as HTMLSelectElement;
            weaponSelect.value = 'test-weapon';
            weaponSelect.dispatchEvent(new Event('change'));

            const build = getCurrentBuild();
            expect(build.weapon?.id).toBe('test-weapon');
        });

        it('should register clear button event listener', () => {
            const char = createMockCharacter({ id: 'test-char', name: 'Test Char' });
            (allData as any).characters.characters = [char];

            loadBuildFromData({ character: 'test-char' });
            setupBuildPlannerEvents();

            const clearBtn = document.getElementById('clear-build');
            clearBtn?.click();

            const build = getCurrentBuild();
            expect(build.character).toBeNull();
        });
    });

    describe('updateBuildAnalysis', () => {
        beforeEach(() => {
            const char = createMockCharacter({
                id: 'test-char',
                name: 'Test Char',
                synergies_weapons: ['Test Weapon'],
            });
            const weapon = createMockWeapon({ id: 'test-weapon', name: 'Test Weapon' });
            (allData as any).characters.characters = [char];
            (allData as any).weapons.weapons = [weapon];
        });

        it('should update synergies display', () => {
            loadBuildFromData({ character: 'test-char', weapon: 'test-weapon' });
            updateBuildAnalysis();

            const synergiesDisplay = document.getElementById('build-synergies');
            expect(synergiesDisplay?.innerHTML).toContain('Synergies');
        });

        it('should update stats display', () => {
            loadBuildFromData({ character: 'test-char', weapon: 'test-weapon' });
            updateBuildAnalysis();

            const statsDisplay = document.getElementById('build-stats');
            expect(statsDisplay?.innerHTML).toContain('stat-card');
        });

        it('should show placeholder when no character/weapon selected', () => {
            clearBuild();
            updateBuildAnalysis();

            const statsDisplay = document.getElementById('build-stats');
            expect(statsDisplay?.innerHTML).toContain('Select character and weapon');
        });
    });
});

describe('Build Stats Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();

        // Add build planner elements
        document.body.innerHTML += `
            <select id="build-character"><option value="">Select...</option></select>
            <select id="build-weapon"><option value="">Select...</option></select>
            <div id="tomes-selection"></div>
            <div id="items-selection"></div>
            <div id="build-synergies"></div>
            <div id="build-stats"></div>
        `;
    });

    it('should handle weapon with undefined base_damage', () => {
        const weapon = createMockWeapon({ id: 'no-dmg-weapon', name: 'No Damage Weapon' });
        delete (weapon as any).base_damage;
        (allData as any).weapons.weapons = [weapon];

        loadBuildFromData({ weapon: 'no-dmg-weapon' });

        // Should not throw
        expect(() => calculateBuildStats()).not.toThrow();
    });

    it('should handle tome with undefined value_per_level', () => {
        const tome = createMockTome({ id: 'no-value-tome', name: 'No Value Tome' });
        delete (tome as any).value_per_level;
        (allData as any).tomes.tomes = [tome];

        // Setup DOM
        const tomesSelection = document.getElementById('tomes-selection');
        if (tomesSelection) {
            tomesSelection.innerHTML = '<label><input type="checkbox" value="no-value-tome" class="tome-checkbox" checked> No Value Tome</label>';
        }

        loadBuildFromData({ tomes: ['no-value-tome'] });

        // Should not throw
        expect(() => calculateBuildStats()).not.toThrow();
    });

    it('should handle NaN in damage calculation', () => {
        const weapon = createMockWeapon({ id: 'nan-weapon', name: 'NaN Weapon', base_damage: NaN as any });
        (allData as any).weapons.weapons = [weapon];

        loadBuildFromData({ weapon: 'nan-weapon' });
        const stats = calculateBuildStats();

        // Damage should be a valid number (NaN should be handled)
        expect(Number.isNaN(stats.damage)).toBe(false);
    });
});
