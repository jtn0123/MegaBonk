/**
 * @vitest-environment jsdom
 * Build UI Module Tests
 * Tests rendering functions, selection state, clipboard operations, event setup
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Build } from '../../src/modules/store.ts';
import type { Character, Weapon, Tome, Item } from '../../src/types/index.ts';
import type { CalculatedBuildStats } from '../../src/modules/build-stats.ts';

// ========================================
// Mock Dependencies - vi.mock is hoisted
// ========================================

// Mock toast manager
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock data-service - using arrays that can be mutated in tests
const mockCharacters: Character[] = [];
const mockWeapons: Weapon[] = [];
const mockTomes: Tome[] = [];
const mockItems: Item[] = [];

vi.mock('../../src/modules/data-service.ts', () => ({
    get allData() {
        return {
            characters: { characters: mockCharacters },
            weapons: { weapons: mockWeapons },
            tomes: { tomes: mockTomes },
            items: { items: mockItems },
        };
    },
}));

// Mock build-stats module
vi.mock('../../src/modules/build-stats.ts', () => ({
    calculateBuildStats: vi.fn().mockReturnValue({
        damage: 100,
        hp: 100,
        crit_chance: 5,
        crit_damage: 150,
        attack_speed: 100,
        movement_speed: 100,
        armor: 0,
        evasion: 0,
        projectiles: 1,
        overcrit: false,
    }),
}));

// Mock build-validation module
vi.mock('../../src/modules/build-validation.ts', () => ({
    detectSynergies: vi.fn().mockReturnValue({
        found: false,
        messages: [],
    }),
}));

// Import after mocks are set up
import {
    renderCharacterSelect,
    renderWeaponSelect,
    renderTomesSelection,
    renderItemsSelection,
    renderBuildPlanner,
    renderStatsDisplay,
    renderSynergiesDisplay,
    renderStatsPlaceholder,
    updateBuildDisplay,
    setCharacterSelection,
    setWeaponSelection,
    setTomeCheckboxes,
    setItemCheckboxes,
    clearAllSelections,
    getSelectedTomeIds,
    getSelectedItemIds,
    copyToClipboard,
    setupBuildPlannerEvents,
    setupSelectionListeners,
} from '../../src/modules/build-ui.ts';
import { calculateBuildStats } from '../../src/modules/build-stats.ts';
import { detectSynergies } from '../../src/modules/build-validation.ts';
import { ToastManager } from '../../src/modules/toast.ts';

// ========================================
// Test Fixtures
// ========================================

const createCharacter = (overrides: Partial<Character> = {}): Character => ({
    id: 'test_char',
    name: 'Test Character',
    tier: 'A',
    ...overrides,
});

const createWeapon = (overrides: Partial<Weapon> = {}): Weapon => ({
    id: 'test_weapon',
    name: 'Test Weapon',
    description: 'A test weapon',
    tier: 'A',
    ...overrides,
});

const createTome = (overrides: Partial<Tome> = {}): Tome => ({
    id: 'test_tome',
    name: 'Test Tome',
    description: 'A test tome',
    tier: 'A',
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

const createStats = (overrides: Partial<CalculatedBuildStats> = {}): CalculatedBuildStats => ({
    damage: 100,
    hp: 100,
    crit_chance: 5,
    crit_damage: 150,
    attack_speed: 100,
    movement_speed: 100,
    armor: 0,
    evasion: 0,
    evasion_internal: 0,
    projectiles: 1,
    overcrit: false,
    ...overrides,
});

// ========================================
// DOM Setup Helpers
// ========================================

function setupDOM() {
    document.body.innerHTML = `
        <select id="build-character"></select>
        <select id="build-weapon"></select>
        <div id="tomes-selection"></div>
        <div id="items-selection"></div>
        <div id="build-stats"></div>
        <div id="build-synergies"></div>
        <button id="export-build"></button>
        <button id="share-build-url"></button>
        <button id="clear-build"></button>
    `;
}

function clearDOM() {
    document.body.innerHTML = '';
}

// Helper to reset mock arrays
function resetMockData() {
    mockCharacters.length = 0;
    mockWeapons.length = 0;
    mockTomes.length = 0;
    mockItems.length = 0;
}

describe('Build UI Module', () => {
    beforeEach(() => {
        setupDOM();
        vi.clearAllMocks();
        resetMockData();
    });

    afterEach(() => {
        clearDOM();
    });

    // ========================================
    // renderCharacterSelect Tests
    // ========================================
    describe('renderCharacterSelect', () => {
        it('should render default option when no characters', () => {
            renderCharacterSelect();
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.options).toHaveLength(1);
            expect(select.options[0].value).toBe('');
            expect(select.options[0].textContent).toBe('Select Character...');
        });

        it('should render character options', () => {
            mockCharacters.push(
                createCharacter({ id: 'char_1', name: 'Knight', tier: 'S' }),
                createCharacter({ id: 'char_2', name: 'Mage', tier: 'A' })
            );
            renderCharacterSelect();
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.options).toHaveLength(3); // Default + 2 characters
            expect(select.options[1].value).toBe('char_1');
            expect(select.options[1].textContent).toBe('Knight (S Tier)');
            expect(select.options[2].value).toBe('char_2');
            expect(select.options[2].textContent).toBe('Mage (A Tier)');
        });

        it('should handle missing select element', () => {
            document.getElementById('build-character')?.remove();
            expect(() => renderCharacterSelect()).not.toThrow();
        });

        it('should handle empty characters data', () => {
            // Characters array is empty by default from resetMockData()
            expect(() => renderCharacterSelect()).not.toThrow();
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.options).toHaveLength(1);
        });
    });

    // ========================================
    // renderWeaponSelect Tests
    // ========================================
    describe('renderWeaponSelect', () => {
        it('should render default option when no weapons', () => {
            renderWeaponSelect();
            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(select.options).toHaveLength(1);
            expect(select.options[0].value).toBe('');
            expect(select.options[0].textContent).toBe('Select Weapon...');
        });

        it('should render weapon options', () => {
            mockWeapons.push(
                createWeapon({ id: 'weapon_1', name: 'Sword', tier: 'S' }),
                createWeapon({ id: 'weapon_2', name: 'Axe', tier: 'A' })
            );
            renderWeaponSelect();
            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(select.options).toHaveLength(3);
            expect(select.options[1].value).toBe('weapon_1');
            expect(select.options[1].textContent).toBe('Sword (S Tier)');
        });

        it('should handle missing select element', () => {
            document.getElementById('build-weapon')?.remove();
            expect(() => renderWeaponSelect()).not.toThrow();
        });
    });

    // ========================================
    // renderTomesSelection Tests
    // ========================================
    describe('renderTomesSelection', () => {
        it('should render empty when no tomes', () => {
            renderTomesSelection();
            const container = document.getElementById('tomes-selection');
            expect(container?.innerHTML).toBe('');
        });

        it('should render tome checkboxes', () => {
            mockTomes.push(
                createTome({ id: 'tome_1', name: 'Power Tome' }),
                createTome({ id: 'tome_2', name: 'Speed Tome' })
            );
            renderTomesSelection();
            const checkboxes = document.querySelectorAll('.tome-checkbox');
            expect(checkboxes).toHaveLength(2);
            expect((checkboxes[0] as HTMLInputElement).value).toBe('tome_1');
        });

        it('should escape HTML in tome names', () => {
            mockTomes.push(createTome({ id: 'xss', name: '<script>alert("xss")</script>' }));
            renderTomesSelection();
            const container = document.getElementById('tomes-selection');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should handle missing container', () => {
            document.getElementById('tomes-selection')?.remove();
            expect(() => renderTomesSelection()).not.toThrow();
        });
    });

    // ========================================
    // renderItemsSelection Tests
    // ========================================
    describe('renderItemsSelection', () => {
        it('should render empty when no items', () => {
            renderItemsSelection();
            const container = document.getElementById('items-selection');
            expect(container?.innerHTML).toBe('');
        });

        it('should render item checkboxes', () => {
            mockItems.push(
                createItem({ id: 'item_1', name: 'Health Potion', tier: 'A' }),
                createItem({ id: 'item_2', name: 'Mana Potion', tier: 'B' })
            );
            renderItemsSelection();
            const checkboxes = document.querySelectorAll('.item-checkbox');
            expect(checkboxes).toHaveLength(2);
        });

        it('should display item tier', () => {
            mockItems.push(createItem({ id: 'item_1', name: 'Epic Item', tier: 'S' }));
            renderItemsSelection();
            const container = document.getElementById('items-selection');
            expect(container?.textContent).toContain('(S)');
        });

        it('should limit items to BUILD_ITEMS_LIMIT', () => {
            // Create 50 items (limit is 40)
            for (let i = 0; i < 50; i++) {
                mockItems.push(createItem({ id: `item_${i}`, name: `Item ${i}` }));
            }
            renderItemsSelection();
            const checkboxes = document.querySelectorAll('.item-checkbox');
            expect(checkboxes.length).toBeLessThanOrEqual(40);
        });

        it('should escape HTML in item names', () => {
            mockItems.push(createItem({ id: 'xss', name: '<img src=x onerror=alert(1)>' }));
            renderItemsSelection();
            const container = document.getElementById('items-selection');
            expect(container?.innerHTML).not.toContain('<img');
        });
    });

    // ========================================
    // renderBuildPlanner Tests
    // ========================================
    describe('renderBuildPlanner', () => {
        it('should call all render functions', () => {
            mockCharacters.push(createCharacter());
            mockWeapons.push(createWeapon());
            mockTomes.push(createTome());
            mockItems.push(createItem());

            renderBuildPlanner();

            // Check that all elements were populated
            const charSelect = document.getElementById('build-character') as HTMLSelectElement;
            const weaponSelect = document.getElementById('build-weapon') as HTMLSelectElement;
            const tomesContainer = document.getElementById('tomes-selection');
            const itemsContainer = document.getElementById('items-selection');

            expect(charSelect.options.length).toBeGreaterThan(1);
            expect(weaponSelect.options.length).toBeGreaterThan(1);
            expect(tomesContainer?.innerHTML).not.toBe('');
            expect(itemsContainer?.innerHTML).not.toBe('');
        });
    });

    // ========================================
    // renderStatsDisplay Tests
    // ========================================
    describe('renderStatsDisplay', () => {
        it('should render all stat cards', () => {
            const stats = createStats();
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.querySelectorAll('.stat-card')).toHaveLength(9);
        });

        it('should display damage stat', () => {
            const stats = createStats({ damage: 150 });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('150');
            expect(container?.textContent).toContain('Total Damage');
        });

        it('should display HP stat', () => {
            const stats = createStats({ hp: 200 });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('200');
            expect(container?.textContent).toContain('Max HP');
        });

        it('should display crit chance', () => {
            const stats = createStats({ crit_chance: 25.5 });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('25.5%');
            expect(container?.textContent).toContain('Crit Chance');
        });

        it('should show overcrit indicator', () => {
            const stats = createStats({ crit_chance: 120, overcrit: true });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('OVERCRIT');
            expect(container?.querySelector('.stat-overcrit')).not.toBeNull();
        });

        it('should not show overcrit for normal crit', () => {
            const stats = createStats({ crit_chance: 50, overcrit: false });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).not.toContain('OVERCRIT');
        });

        it('should display projectiles', () => {
            const stats = createStats({ projectiles: 3 });
            renderStatsDisplay(stats);
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('3');
            expect(container?.textContent).toContain('Projectiles');
        });

        it('should handle missing container', () => {
            document.getElementById('build-stats')?.remove();
            const stats = createStats();
            expect(() => renderStatsDisplay(stats)).not.toThrow();
        });
    });

    // ========================================
    // renderSynergiesDisplay Tests
    // ========================================
    describe('renderSynergiesDisplay', () => {
        it('should show placeholder when no synergies', () => {
            renderSynergiesDisplay([]);
            const container = document.getElementById('build-synergies');
            expect(container?.textContent).toContain('Select character');
        });

        it('should render synergy messages', () => {
            renderSynergiesDisplay([
                '✓ Knight synergizes with Sword!',
                '✓ Shield works great with Sword',
            ]);
            const container = document.getElementById('build-synergies');
            expect(container?.textContent).toContain('Synergies Found');
            expect(container?.querySelectorAll('li')).toHaveLength(2);
        });

        it('should handle single synergy', () => {
            renderSynergiesDisplay(['✓ One synergy']);
            const container = document.getElementById('build-synergies');
            expect(container?.querySelectorAll('li')).toHaveLength(1);
        });

        it('should handle missing container', () => {
            document.getElementById('build-synergies')?.remove();
            expect(() => renderSynergiesDisplay(['test'])).not.toThrow();
        });
    });

    // ========================================
    // renderStatsPlaceholder Tests
    // ========================================
    describe('renderStatsPlaceholder', () => {
        it('should render placeholder message', () => {
            renderStatsPlaceholder();
            const container = document.getElementById('build-stats');
            expect(container?.textContent).toContain('Select character and weapon');
            expect(container?.querySelector('.stats-placeholder')).not.toBeNull();
        });

        it('should handle missing container', () => {
            document.getElementById('build-stats')?.remove();
            expect(() => renderStatsPlaceholder()).not.toThrow();
        });
    });

    // ========================================
    // updateBuildDisplay Tests
    // ========================================
    describe('updateBuildDisplay', () => {
        it('should render placeholder when no character or weapon', () => {
            const build = createBuild();
            updateBuildDisplay(build);
            const container = document.getElementById('build-stats');
            expect(container?.querySelector('.stats-placeholder')).not.toBeNull();
        });

        it('should render stats when character and weapon are set', () => {
            const build = createBuild({
                character: createCharacter(),
                weapon: createWeapon(),
            });
            updateBuildDisplay(build);
            expect(calculateBuildStats).toHaveBeenCalledWith(build);
            const container = document.getElementById('build-stats');
            expect(container?.querySelectorAll('.stat-card').length).toBeGreaterThan(0);
        });

        it('should call detectSynergies', () => {
            const build = createBuild();
            updateBuildDisplay(build);
            expect(detectSynergies).toHaveBeenCalledWith(build);
        });

        it('should call onBuildUpdate callback', () => {
            const callback = vi.fn();
            const build = createBuild();
            updateBuildDisplay(build, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should not crash without callback', () => {
            const build = createBuild();
            expect(() => updateBuildDisplay(build)).not.toThrow();
        });
    });

    // ========================================
    // setCharacterSelection Tests
    // ========================================
    describe('setCharacterSelection', () => {
        it('should set character select value', () => {
            mockCharacters.push(createCharacter({ id: 'char_1', name: 'Knight' }));
            renderCharacterSelect();
            setCharacterSelection('char_1');
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.value).toBe('char_1');
        });

        it('should handle non-existent character ID', () => {
            renderCharacterSelect();
            expect(() => setCharacterSelection('nonexistent')).not.toThrow();
        });
    });

    // ========================================
    // setWeaponSelection Tests
    // ========================================
    describe('setWeaponSelection', () => {
        it('should set weapon select value', () => {
            mockWeapons.push(createWeapon({ id: 'weapon_1', name: 'Sword' }));
            renderWeaponSelect();
            setWeaponSelection('weapon_1');
            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(select.value).toBe('weapon_1');
        });
    });

    // ========================================
    // setTomeCheckboxes Tests
    // ========================================
    describe('setTomeCheckboxes', () => {
        beforeEach(() => {
            mockTomes.push(
                createTome({ id: 'tome_1', name: 'Tome 1' }),
                createTome({ id: 'tome_2', name: 'Tome 2' }),
                createTome({ id: 'tome_3', name: 'Tome 3' })
            );
            renderTomesSelection();
        });

        it('should check specified tomes', () => {
            setTomeCheckboxes(['tome_1', 'tome_3']);
            const checkboxes = document.querySelectorAll('.tome-checkbox') as NodeListOf<HTMLInputElement>;
            expect(checkboxes[0].checked).toBe(true);
            expect(checkboxes[1].checked).toBe(false);
            expect(checkboxes[2].checked).toBe(true);
        });

        it('should handle empty array', () => {
            setTomeCheckboxes([]);
            const checkboxes = document.querySelectorAll('.tome-checkbox:checked');
            expect(checkboxes).toHaveLength(0);
        });

        it('should handle non-existent tome IDs', () => {
            expect(() => setTomeCheckboxes(['nonexistent'])).not.toThrow();
        });
    });

    // ========================================
    // setItemCheckboxes Tests
    // ========================================
    describe('setItemCheckboxes', () => {
        beforeEach(() => {
            mockItems.push(
                createItem({ id: 'item_1', name: 'Item 1' }),
                createItem({ id: 'item_2', name: 'Item 2' })
            );
            renderItemsSelection();
        });

        it('should check specified items', () => {
            setItemCheckboxes(['item_2']);
            const checkboxes = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
            expect(checkboxes[0].checked).toBe(false);
            expect(checkboxes[1].checked).toBe(true);
        });

        it('should handle empty array', () => {
            setItemCheckboxes([]);
            const checkboxes = document.querySelectorAll('.item-checkbox:checked');
            expect(checkboxes).toHaveLength(0);
        });
    });

    // ========================================
    // clearAllSelections Tests
    // ========================================
    describe('clearAllSelections', () => {
        beforeEach(() => {
            mockCharacters.push(createCharacter({ id: 'char_1' }));
            mockWeapons.push(createWeapon({ id: 'weapon_1' }));
            mockTomes.push(createTome({ id: 'tome_1' }));
            mockItems.push(createItem({ id: 'item_1' }));
            renderBuildPlanner();
        });

        it('should clear character selection', () => {
            setCharacterSelection('char_1');
            clearAllSelections();
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.value).toBe('');
        });

        it('should clear weapon selection', () => {
            setWeaponSelection('weapon_1');
            clearAllSelections();
            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(select.value).toBe('');
        });

        it('should uncheck all tomes', () => {
            setTomeCheckboxes(['tome_1']);
            clearAllSelections();
            const checkboxes = document.querySelectorAll('.tome-checkbox:checked');
            expect(checkboxes).toHaveLength(0);
        });

        it('should uncheck all items', () => {
            setItemCheckboxes(['item_1']);
            clearAllSelections();
            const checkboxes = document.querySelectorAll('.item-checkbox:checked');
            expect(checkboxes).toHaveLength(0);
        });
    });

    // ========================================
    // getSelectedTomeIds Tests
    // ========================================
    describe('getSelectedTomeIds', () => {
        beforeEach(() => {
            mockTomes.push(
                createTome({ id: 'tome_1' }),
                createTome({ id: 'tome_2' }),
                createTome({ id: 'tome_3' })
            );
            renderTomesSelection();
        });

        it('should return empty array when none selected', () => {
            expect(getSelectedTomeIds()).toEqual([]);
        });

        it('should return selected tome IDs', () => {
            setTomeCheckboxes(['tome_1', 'tome_3']);
            const selected = getSelectedTomeIds();
            expect(selected).toContain('tome_1');
            expect(selected).toContain('tome_3');
            expect(selected).not.toContain('tome_2');
        });

        it('should return all tomes when all selected', () => {
            setTomeCheckboxes(['tome_1', 'tome_2', 'tome_3']);
            expect(getSelectedTomeIds()).toHaveLength(3);
        });
    });

    // ========================================
    // getSelectedItemIds Tests
    // ========================================
    describe('getSelectedItemIds', () => {
        beforeEach(() => {
            mockItems.push(
                createItem({ id: 'item_1' }),
                createItem({ id: 'item_2' })
            );
            renderItemsSelection();
        });

        it('should return empty array when none selected', () => {
            expect(getSelectedItemIds()).toEqual([]);
        });

        it('should return selected item IDs', () => {
            setItemCheckboxes(['item_1']);
            const selected = getSelectedItemIds();
            expect(selected).toContain('item_1');
            expect(selected).not.toContain('item_2');
        });
    });

    // ========================================
    // copyToClipboard Tests
    // ========================================
    describe('copyToClipboard', () => {
        const originalClipboard = navigator.clipboard;

        beforeEach(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: vi.fn().mockResolvedValue(undefined),
                },
                writable: true,
            });
        });

        afterEach(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                writable: true,
            });
        });

        it('should copy text to clipboard', async () => {
            const result = await copyToClipboard('test text', 'Copied!');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
            expect(result).toBe(true);
        });

        it('should show success toast on success', async () => {
            await copyToClipboard('test', 'Success message');
            expect(ToastManager.success).toHaveBeenCalledWith('Success message');
        });

        it('should return false and show error on failure', async () => {
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Permission denied'));
            const result = await copyToClipboard('test', 'Copied!');
            expect(result).toBe(false);
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should include error message in toast', async () => {
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Custom error'));
            await copyToClipboard('test', 'Copied!');
            expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Custom error'));
        });
    });

    // ========================================
    // setupBuildPlannerEvents Tests
    // ========================================
    describe('setupBuildPlannerEvents', () => {
        it('should attach character change listener', () => {
            const onCharacterChange = vi.fn();
            setupBuildPlannerEvents(onCharacterChange, vi.fn(), vi.fn(), vi.fn(), vi.fn());

            mockCharacters.push(createCharacter({ id: 'char_1' }));
            renderCharacterSelect();

            const select = document.getElementById('build-character') as HTMLSelectElement;
            select.value = 'char_1';
            select.dispatchEvent(new Event('change'));

            expect(onCharacterChange).toHaveBeenCalledWith('char_1');
        });

        it('should attach weapon change listener', () => {
            const onWeaponChange = vi.fn();
            setupBuildPlannerEvents(vi.fn(), onWeaponChange, vi.fn(), vi.fn(), vi.fn());

            mockWeapons.push(createWeapon({ id: 'weapon_1' }));
            renderWeaponSelect();

            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            select.value = 'weapon_1';
            select.dispatchEvent(new Event('change'));

            expect(onWeaponChange).toHaveBeenCalledWith('weapon_1');
        });

        it('should attach export button listener', () => {
            const onExport = vi.fn();
            setupBuildPlannerEvents(vi.fn(), vi.fn(), onExport, vi.fn(), vi.fn());

            const btn = document.getElementById('export-build');
            btn?.click();

            expect(onExport).toHaveBeenCalled();
        });

        it('should attach share button listener', () => {
            const onShare = vi.fn();
            setupBuildPlannerEvents(vi.fn(), vi.fn(), vi.fn(), onShare, vi.fn());

            const btn = document.getElementById('share-build-url');
            btn?.click();

            expect(onShare).toHaveBeenCalled();
        });

        it('should attach clear button listener', () => {
            const onClear = vi.fn();
            setupBuildPlannerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), onClear);

            const btn = document.getElementById('clear-build');
            btn?.click();

            expect(onClear).toHaveBeenCalled();
        });

        it('should handle missing elements gracefully', () => {
            document.body.innerHTML = '';
            expect(() =>
                setupBuildPlannerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn())
            ).not.toThrow();
        });
    });

    // ========================================
    // setupSelectionListeners Tests
    // ========================================
    describe('setupSelectionListeners', () => {
        it('should attach tomes container change listener', () => {
            const onSelectionChange = vi.fn();
            setupSelectionListeners(onSelectionChange);

            mockTomes.push(createTome({ id: 'tome_1' }));
            renderTomesSelection();

            const container = document.getElementById('tomes-selection');
            container?.dispatchEvent(new Event('change'));

            expect(onSelectionChange).toHaveBeenCalled();
        });

        it('should attach items container change listener', () => {
            const onSelectionChange = vi.fn();
            setupSelectionListeners(onSelectionChange);

            mockItems.push(createItem({ id: 'item_1' }));
            renderItemsSelection();

            const container = document.getElementById('items-selection');
            container?.dispatchEvent(new Event('change'));

            expect(onSelectionChange).toHaveBeenCalled();
        });

        it('should handle missing containers gracefully', () => {
            document.getElementById('tomes-selection')?.remove();
            document.getElementById('items-selection')?.remove();
            expect(() => setupSelectionListeners(vi.fn())).not.toThrow();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle special characters in character names', () => {
            mockCharacters.push(createCharacter({ id: 'special', name: "Knight's Honor & Glory" }));
            renderCharacterSelect();
            const select = document.getElementById('build-character') as HTMLSelectElement;
            expect(select.options[1].textContent).toContain("Knight's Honor & Glory");
        });

        it('should handle unicode in names', () => {
            mockWeapons.push(createWeapon({ id: 'unicode', name: '剣 (Sword)' }));
            renderWeaponSelect();
            const select = document.getElementById('build-weapon') as HTMLSelectElement;
            expect(select.options[1].textContent).toContain('剣');
        });

        it('should handle empty strings in data', () => {
            mockTomes.push(createTome({ id: '', name: '' }));
            expect(() => renderTomesSelection()).not.toThrow();
        });

        it('should handle very long item lists', () => {
            for (let i = 0; i < 100; i++) {
                mockItems.push(createItem({ id: `item_${i}`, name: `Item ${i}` }));
            }
            expect(() => renderItemsSelection()).not.toThrow();
        });
    });
});
