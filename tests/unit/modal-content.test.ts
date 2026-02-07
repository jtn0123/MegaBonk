/**
 * @vitest-environment jsdom
 * Modal Content Module Tests
 * Tests UI/UX validation for modal rendering sections
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    generateModalImage: vi.fn(
        (data: { name: string }, name: string, type: string) =>
            `<img class="modal-image" alt="${name}" data-type="${type}" />`
    ),
    escapeHtml: vi.fn((str: string) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }),
    isValidExternalUrl: vi.fn(() => true),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/formula-renderer.ts', () => ({
    renderFormulaDisplay: vi.fn((formula: string) => `<span class="formula">${formula}</span>`),
}));

vi.mock('../../src/modules/modal-core.ts', () => ({
    getChartModule: vi.fn().mockResolvedValue({
        getEffectiveStackCap: vi.fn(() => 100),
        createScalingChart: vi.fn(),
        calculateTomeProgression: vi.fn(() => [1, 2, 3, 4, 5]),
    }),
    getCurrentModalSessionId: vi.fn(() => 1),
    incrementModalSessionId: vi.fn(() => 1),
    tabHandlers: new WeakMap(),
}));

// Import after mocking
import { renderItemModal } from '../../src/modules/modal-items.ts';
import { renderWeaponModal } from '../../src/modules/modal-weapons.ts';
import { renderCharacterModal } from '../../src/modules/modal-characters.ts';
import { renderTomeModal, renderShrineModal } from '../../src/modules/modal-entities.ts';

describe('Modal Content - UI/UX Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ========================================
    // Item Modal Tests
    // ========================================
    describe('Item Modal (renderItemModal)', () => {
        const mockItem = {
            id: 'test-item-1',
            name: 'Mega Sword',
            tier: 'SS',
            rarity: 'legendary',
            base_effect: 'Deals 50% more damage',
            detailed_description: 'A powerful sword that scales with stacks',
            scaling_per_stack: 5,
            one_and_done: false,
            graph_type: 'linear',
            synergies: ['Attack Speed', 'Critical Hit'],
            anti_synergies: ['Defense Build'],
            formula: 'base * (1 + 0.05 * stacks)',
            hidden_mechanics: ['Secret bonus at 10 stacks'],
        };

        it('should render tier badge with correct class', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('badge tier-SS');
            expect(html).toContain('SS Tier');
        });

        it('should render rarity badge', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('badge rarity-legendary');
            expect(html).toContain('legendary');
        });

        it('should render scaling graph container when item has scaling', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('modal-graph-container');
            expect(html).toContain('scaling-chart');
            expect(html).toContain(`modal-chart-${mockItem.id}`);
        });

        it('should NOT render graph for one-and-done items', () => {
            const oneAndDoneItem = { ...mockItem, one_and_done: true };
            const html = renderItemModal(oneAndDoneItem);

            expect(html).not.toContain('modal-graph-container');
            expect(html).toContain('one-and-done-warning');
        });

        it('should render synergies section when synergies exist', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('synergies-section');
            expect(html).toContain('synergy-list');
            expect(html).toContain('synergy-tag');
            expect(html).toContain('Attack Speed');
            expect(html).toContain('Critical Hit');
        });

        it('should render anti-synergies section when they exist', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('anti-synergies-section');
            expect(html).toContain('antisynergy-list');
            expect(html).toContain('antisynergy-tag');
            expect(html).toContain('Defense Build');
        });

        it('should render formula display', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('item-formula');
            expect(html).toContain('Formula:');
        });

        it('should render hidden mechanics section', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('hidden-mechanics');
            expect(html).toContain('Hidden Mechanics');
            expect(html).toContain('Secret bonus at 10 stacks');
        });

        it('should render base effect', () => {
            const html = renderItemModal(mockItem);

            expect(html).toContain('item-effect');
            expect(html).toContain('Deals 50% more damage');
        });

        it('should render scaling tracks tabs when present', () => {
            const itemWithTracks = {
                ...mockItem,
                scaling_tracks: {
                    damage: { stat: 'Damage', values: [1, 2, 3] },
                    speed: { stat: 'Speed', values: [0.5, 1, 1.5] },
                },
            };
            const html = renderItemModal(itemWithTracks);

            expect(html).toContain('scaling-tracks-container');
            expect(html).toContain('scaling-tabs');
            expect(html).toContain('scaling-tab');
            expect(html).toContain('data-track="damage"');
            expect(html).toContain('data-track="speed"');
        });

        it('should render hyperbolic warning for hyperbolic scaling', () => {
            const hyperbolicItem = {
                ...mockItem,
                scaling_formula_type: 'hyperbolic',
            };
            const html = renderItemModal(hyperbolicItem);

            expect(html).toContain('hyperbolic-warning');
            expect(html).toContain('Hyperbolic Scaling');
            expect(html).toContain('diminishing returns');
        });

        it('should render stack limit info when present', () => {
            const stackLimitItem = { ...mockItem, max_stacks: 50 };
            const html = renderItemModal(stackLimitItem);

            expect(html).toContain('stack-info');
            expect(html).toContain('Stack Limit:');
            expect(html).toContain('50 stacks');
        });
    });

    // ========================================
    // Weapon Modal Tests
    // ========================================
    describe('Weapon Modal (renderWeaponModal)', () => {
        const mockWeapon = {
            id: 'test-weapon-1',
            name: 'Fire Blade',
            tier: 'S',
            playstyle: 'Aggressive',
            base_damage: 100,
            base_projectile_count: 3,
            attack_pattern: 'Wide slash',
            description: 'A blazing sword of destruction',
            best_for: ['Boss Fights', 'AoE Damage'],
            upgradeable_stats: ['Attack Speed', 'Damage', 'Range'],
            pros: ['High damage', 'Good range'],
            cons: ['Slow attack speed', 'High energy cost'],
            build_tips: 'Pair with attack speed items',
            unlock_requirement: 'Beat Stage 10',
            synergies_items: ['Flame Ring'],
            synergies_tomes: ['Power Tome'],
            synergies_characters: ['Fire Mage'],
        };

        it('should render tier badge with correct class', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('badge tier-S');
            expect(html).toContain('S Tier');
        });

        it('should render playstyle badge', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('Aggressive');
        });

        it('should render pros list', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('class="strengths"');
            expect(html).toContain('<h4>Pros</h4>');
            expect(html).toContain('High damage');
            expect(html).toContain('Good range');
        });

        it('should render cons list', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('class="weaknesses"');
            expect(html).toContain('<h4>Cons</h4>');
            expect(html).toContain('Slow attack speed');
            expect(html).toContain('High energy cost');
        });

        it('should render upgradeable stats section', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('Upgradeable Stats');
            expect(html).toContain('tag-list');
            expect(html).toContain('meta-tag');
            expect(html).toContain('Attack Speed');
            expect(html).toContain('Damage');
            expect(html).toContain('Range');
        });

        it('should render "Best For" tags', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('Best For');
            expect(html).toContain('Boss Fights');
            expect(html).toContain('AoE Damage');
        });

        it('should render base damage and projectile count', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('Base Damage:');
            expect(html).toContain('100');
            expect(html).toContain('× 3 projectiles');
        });

        it('should render attack pattern', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('Attack Pattern:');
            expect(html).toContain('Wide slash');
        });

        it('should render synergies sections', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('synergies-section');
            expect(html).toContain('synergy-group');
            expect(html).toContain('Items');
            expect(html).toContain('Flame Ring');
            expect(html).toContain('Tomes');
            expect(html).toContain('Power Tome');
            expect(html).toContain('Characters');
            expect(html).toContain('Fire Mage');
        });

        it('should render build tips section', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('build-tips');
            expect(html).toContain('Build Tips');
            expect(html).toContain('Pair with attack speed items');
        });

        it('should render unlock requirement', () => {
            const html = renderWeaponModal(mockWeapon);

            expect(html).toContain('unlock-requirement');
            expect(html).toContain('Unlock:');
            expect(html).toContain('Beat Stage 10');
        });

        it('should handle weapon without optional fields', () => {
            const minimalWeapon = {
                id: 'minimal',
                name: 'Basic Sword',
                tier: 'C',
                base_damage: 10,
                attack_pattern: 'Slash',
            };
            const html = renderWeaponModal(minimalWeapon);

            expect(html).toContain('Basic Sword');
            expect(html).toContain('C Tier');
            expect(html).not.toContain('build-tips');
            expect(html).not.toContain('unlock-requirement');
        });
    });

    // ========================================
    // Character Modal Tests
    // ========================================
    describe('Character Modal (renderCharacterModal)', () => {
        const mockCharacter = {
            id: 'test-char-1',
            name: 'Fire Mage',
            tier: 'S',
            playstyle: 'Ranged',
            passive_ability: 'Flame Shield',
            passive_description: 'Grants a shield that deals fire damage',
            starting_weapon: 'Fire Staff',
            base_hp: 100,
            base_damage: 25,
            unlock_requirement: 'Complete Fire Temple',
            best_for: ['Crowd Control', 'AoE Builds'],
            strengths: ['High AoE damage', 'Good survivability'],
            weaknesses: ['Low single target', 'Slow movement'],
            synergies_weapons: ['Fire Blade'],
            synergies_items: ['Flame Ring', 'Heat Amulet'],
            synergies_tomes: ['Power Tome'],
            build_tips: 'Stack fire damage items',
        };

        it('should render tier badge with correct class', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('badge tier-S');
            expect(html).toContain('S Tier');
        });

        it('should render playstyle badge', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('Ranged');
        });

        it('should render strengths section', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('class="strengths"');
            expect(html).toContain('<h4>Strengths</h4>');
            expect(html).toContain('High AoE damage');
            expect(html).toContain('Good survivability');
        });

        it('should render weaknesses section', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('class="weaknesses"');
            expect(html).toContain('<h4>Weaknesses</h4>');
            expect(html).toContain('Low single target');
            expect(html).toContain('Slow movement');
        });

        it('should render starting weapon', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('Starting Weapon:');
            expect(html).toContain('Fire Staff');
        });

        it('should render unlock requirement', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('Unlock:');
            expect(html).toContain('Complete Fire Temple');
        });

        it('should render passive ability section', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('character-passive');
            expect(html).toContain('Flame Shield');
            expect(html).toContain('Grants a shield that deals fire damage');
        });

        it('should render base stats', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('Base HP:');
            expect(html).toContain('100');
            expect(html).toContain('Base Damage:');
            expect(html).toContain('25');
        });

        it('should render synergies sections', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('synergies-section');
            expect(html).toContain('Weapons');
            expect(html).toContain('Fire Blade');
            expect(html).toContain('Items');
            expect(html).toContain('Flame Ring');
            expect(html).toContain('Tomes');
            expect(html).toContain('Power Tome');
        });

        it('should render "Best For" tags', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('Best For');
            expect(html).toContain('Crowd Control');
            expect(html).toContain('AoE Builds');
        });

        it('should render build tips', () => {
            const html = renderCharacterModal(mockCharacter);

            expect(html).toContain('build-tips');
            expect(html).toContain('Stack fire damage items');
        });

        it('should handle missing strengths/weaknesses gracefully', () => {
            const charNoStrengths = {
                id: 'minimal',
                name: 'Basic Hero',
                tier: 'C',
                playstyle: 'Melee',
                passive_ability: 'None',
                passive_description: 'No special ability',
                starting_weapon: 'Sword',
                base_hp: 100,
                base_damage: 10,
            };
            const html = renderCharacterModal(charNoStrengths);

            expect(html).toContain('None listed');
        });
    });

    // ========================================
    // Tome Modal Tests
    // ========================================
    describe('Tome Modal (renderTomeModal)', () => {
        const mockTome = {
            id: 'test-tome-1',
            name: 'Power Tome',
            tier: 'SS',
            priority: 1,
            stat_affected: 'Attack',
            value_per_level: '+5%',
            description: 'Increases attack power with each level',
            notes: 'Best for damage builds',
            recommended_for: ['DPS Characters', 'Boss Fights'],
        };

        it('should render tier badge with correct class', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('badge tier-SS');
            expect(html).toContain('SS Tier');
        });

        it('should render priority badge', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('Priority:');
            expect(html).toContain('1');
        });

        it('should render per-level formula', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('item-formula');
            expect(html).toContain('Per Level:');
        });

        it('should render scaling graph container', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('modal-graph-container');
            expect(html).toContain('modal-tome-chart-');
        });

        it('should render stat affected', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('tome-effect');
            expect(html).toContain('Stat:');
            expect(html).toContain('Attack');
        });

        it('should render recommended for section', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('Recommended for:');
            expect(html).toContain('DPS Characters, Boss Fights');
        });

        it('should render notes when present', async () => {
            const html = await renderTomeModal(mockTome);

            expect(html).toContain('item-notes');
            expect(html).toContain('Best for damage builds');
        });
    });

    // ========================================
    // Shrine Modal Tests
    // ========================================
    describe('Shrine Modal (renderShrineModal)', () => {
        const mockShrine = {
            id: 'test-shrine-1',
            name: 'Power Shrine',
            icon: '⚡',
            type: 'stat_upgrade',
            description: 'Grants a permanent stat boost',
            reward: '+10 Attack',
            activation: 'Stand on shrine for 3 seconds',
            reusable: false,
            spawn_count: 2,
            best_for: ['Early Game', 'Damage Builds'],
            synergies_items: ['Power Ring', 'Damage Amulet'],
            strategy: 'Prioritize this shrine early',
            notes: 'One of the best shrines',
        };

        it('should render shrine icon', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('shrine-icon-modal');
            expect(html).toContain('⚡');
        });

        it('should render type badge', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('stat upgrade');
        });

        it('should render reusable status', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('One-time');
        });

        it('should render reward section', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('shrine-detail-section');
            expect(html).toContain('Reward');
            expect(html).toContain('+10 Attack');
        });

        it('should render activation instructions', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('Activation');
            expect(html).toContain('Stand on shrine for 3 seconds');
        });

        it('should render spawn rate', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('Spawn Rate');
            expect(html).toContain('2');
        });

        it('should render "Best For" tags', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('Best For');
            expect(html).toContain('Early Game');
            expect(html).toContain('Damage Builds');
        });

        it('should render item synergies', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('Item Synergies');
            expect(html).toContain('Power Ring');
            expect(html).toContain('Damage Amulet');
        });

        it('should render strategy section', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('shrine-strategy');
            expect(html).toContain('Strategy');
            expect(html).toContain('Prioritize this shrine early');
        });

        it('should render notes', () => {
            const html = renderShrineModal(mockShrine);

            expect(html).toContain('item-notes');
            expect(html).toContain('One of the best shrines');
        });

        it('should show Reusable badge for reusable shrines', () => {
            const reusableShrine = { ...mockShrine, reusable: true };
            const html = renderShrineModal(reusableShrine);

            expect(html).toContain('Reusable');
            expect(html).not.toContain('One-time');
        });
    });

    // ========================================
    // CSS Class Consistency Tests
    // ========================================
    describe('CSS Class Structure Consistency', () => {
        it('should use item-badges class for all modals', async () => {
            const itemHtml = renderItemModal({ id: '1', name: 'Test', tier: 'A' });
            const weaponHtml = renderWeaponModal({ id: '2', name: 'Test', tier: 'A' });
            const charHtml = renderCharacterModal({
                id: '3',
                name: 'Test',
                tier: 'A',
                playstyle: 'Test',
                passive_ability: 'Test',
                passive_description: 'Test',
                starting_weapon: 'Test',
                base_hp: 100,
                base_damage: 10,
            });
            const tomeHtml = await renderTomeModal({ id: '4', name: 'Test', tier: 'A', priority: 1 });

            expect(itemHtml).toContain('item-badges');
            expect(weaponHtml).toContain('item-badges');
            expect(charHtml).toContain('item-badges');
            expect(tomeHtml).toContain('item-badges');
        });

        it('should use consistent synergy-tag class across modals', () => {
            const itemHtml = renderItemModal({
                id: '1',
                name: 'Test',
                tier: 'A',
                synergies: ['Test'],
            });
            const weaponHtml = renderWeaponModal({
                id: '2',
                name: 'Test',
                tier: 'A',
                synergies_items: ['Test'],
            });

            expect(itemHtml).toContain('synergy-tag');
            expect(weaponHtml).toContain('synergy-tag');
        });

        it('should use consistent strengths-weaknesses class', () => {
            const weaponHtml = renderWeaponModal({
                id: '1',
                name: 'Test',
                tier: 'A',
                pros: ['Pro'],
                cons: ['Con'],
            });
            const charHtml = renderCharacterModal({
                id: '2',
                name: 'Test',
                tier: 'A',
                playstyle: 'Test',
                passive_ability: 'Test',
                passive_description: 'Test',
                starting_weapon: 'Test',
                base_hp: 100,
                base_damage: 10,
                strengths: ['Str'],
                weaknesses: ['Weak'],
            });

            expect(weaponHtml).toContain('strengths-weaknesses');
            expect(charHtml).toContain('strengths-weaknesses');
        });
    });
});
