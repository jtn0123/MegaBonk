// ========================================
// Modal Module Comprehensive Tests
// ========================================
// Tests for the actual modal.ts module functions

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData } from '../helpers/mock-data.js';

// Mock modules before importing
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: { items: [] },
        weapons: { weapons: [] },
        tomes: { tomes: [] },
        characters: { characters: [] },
        shrines: { shrines: [] },
    },
}));

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

vi.mock('../../src/modules/formula-renderer.ts', () => ({
    renderFormulaDisplay: vi.fn((formula: string) => `<span class="formula">${formula}</span>`),
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    generateModalImage: vi.fn((data: any, name: string, type: string) => {
        if (data.image) {
            return `<img src="${data.image}" alt="${name}" class="modal-${type}-image">`;
        }
        return '';
    }),
}));

// Mock charts module for dynamic import
vi.mock('../../src/modules/charts.ts', () => ({
    getEffectiveStackCap: vi.fn(() => 100),
    createScalingChart: vi.fn(),
    calculateTomeProgression: vi.fn(() => [1, 2, 3, 4, 5]),
}));

import { openDetailModal, closeModal } from '../../src/modules/modal.ts';
import { allData } from '../../src/modules/data-service.ts';
import { ToastManager } from '../../src/modules/toast.ts';

describe('Modal Module - Actual Implementation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMinimalDOM();

        // Setup mock data
        const mockData = createMockAllData();
        (allData as any).items = mockData.items;
        (allData as any).weapons = mockData.weapons;
        (allData as any).tomes = mockData.tomes;
        (allData as any).characters = mockData.characters;
        (allData as any).shrines = mockData.shrines;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('openDetailModal', () => {
        it('should open modal for valid item', async () => {
            await openDetailModal('items', 'test-item');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should open modal for valid weapon', async () => {
            await openDetailModal('weapons', 'test-weapon');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should open modal for valid character', async () => {
            await openDetailModal('characters', 'test-character');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should open modal for valid tome', async () => {
            await openDetailModal('tomes', 'test-tome');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should open modal for valid shrine', async () => {
            await openDetailModal('shrines', 'test-shrine');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should show error toast for invalid ID', async () => {
            await openDetailModal('items', 'nonexistent-item');

            expect(ToastManager.error).toHaveBeenCalledWith(
                expect.stringContaining('Could not find')
            );
        });

        it('should populate modal body with entity name', async () => {
            await openDetailModal('items', 'test-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test Item');
        });

        it('should add active class to modal', async () => {
            // Use fake timers for requestAnimationFrame
            vi.useFakeTimers();

            await openDetailModal('items', 'test-item');

            // Run requestAnimationFrame
            vi.runAllTimers();

            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);

            vi.useRealTimers();
        });

        it('should handle missing modal element gracefully', async () => {
            document.getElementById('itemModal')?.remove();

            // Should not throw
            await expect(openDetailModal('items', 'test-item')).resolves.not.toThrow();
        });

        it('should handle missing modalBody element gracefully', async () => {
            document.getElementById('modalBody')?.remove();

            // Should not throw
            await expect(openDetailModal('items', 'test-item')).resolves.not.toThrow();
        });
    });

    describe('closeModal', () => {
        it('should hide modal', async () => {
            // First open the modal
            await openDetailModal('items', 'test-item');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');

            // Use fake timers for setTimeout
            vi.useFakeTimers();

            closeModal();

            // Modal should remove active class immediately
            expect(modal?.classList.contains('active')).toBe(false);

            // After timeout, display should be none
            vi.advanceTimersByTime(350);
            expect(modal?.style.display).toBe('none');

            vi.useRealTimers();
        });

        it('should handle missing modal element gracefully', () => {
            document.getElementById('itemModal')?.remove();

            // Should not throw
            expect(() => closeModal()).not.toThrow();
        });

        it('should be callable multiple times without error', () => {
            closeModal();
            closeModal();
            closeModal();

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('Focus Trap', () => {
        it('should activate focus trap when modal opens', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'test-item');
            vi.runAllTimers();

            // Modal should have active class and focus trap should be enabled
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);

            vi.useRealTimers();
        });

        it('should deactivate focus trap when modal closes', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'test-item');
            vi.runAllTimers();

            closeModal();
            vi.advanceTimersByTime(350);

            // Modal should no longer have active class
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('Item Modal Content', () => {
        beforeEach(() => {
            // Add items with various properties
            (allData as any).items.items = [
                {
                    id: 'basic-item',
                    name: 'Basic Item',
                    tier: 'A',
                    rarity: 'rare',
                    base_effect: '+10 damage',
                    detailed_description: 'A basic item description',
                    formula: 'damage * 1.1',
                },
                {
                    id: 'one-and-done-item',
                    name: 'One And Done Item',
                    tier: 'S',
                    rarity: 'legendary',
                    base_effect: 'Special effect',
                    detailed_description: 'One and done description',
                    formula: 'x',
                    one_and_done: true,
                },
                {
                    id: 'hyperbolic-item',
                    name: 'Hyperbolic Item',
                    tier: 'SS',
                    rarity: 'legendary',
                    base_effect: 'Scaling effect',
                    detailed_description: 'Has diminishing returns',
                    formula: 'y / (1 + y/k)',
                    scaling_formula_type: 'hyperbolic',
                    hyperbolic_constant: 50,
                },
                {
                    id: 'synergy-item',
                    name: 'Synergy Item',
                    tier: 'A',
                    rarity: 'epic',
                    base_effect: '+5% crit',
                    detailed_description: 'Has synergies',
                    formula: 'crit * 1.05',
                    synergies: ['Other Item', 'Special Weapon'],
                    anti_synergies: ['Bad Item'],
                },
                {
                    id: 'max-stack-item',
                    name: 'Max Stack Item',
                    tier: 'B',
                    rarity: 'uncommon',
                    base_effect: '+1% per stack',
                    detailed_description: 'Has stack limit',
                    formula: 'stacks * 0.01',
                    max_stacks: 25,
                },
                {
                    id: 'hidden-mechanics-item',
                    name: 'Hidden Mechanics Item',
                    tier: 'S',
                    rarity: 'legendary',
                    base_effect: 'Complex effect',
                    detailed_description: 'Has hidden mechanics',
                    formula: 'complex',
                    hidden_mechanics: ['Also applies to summons', 'Stacks with similar effects'],
                },
                {
                    id: 'scaling-item',
                    name: 'Scaling Item',
                    tier: 'A',
                    rarity: 'rare',
                    base_effect: 'Scales per stack',
                    detailed_description: 'Shows scaling graph',
                    formula: 'linear',
                    scaling_per_stack: [10, 20, 30, 40, 50],
                    graph_type: 'linear',
                },
            ];
        });

        it('should render basic item content', async () => {
            await openDetailModal('items', 'basic-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Basic Item');
            expect(modalBody?.innerHTML).toContain('+10 damage');
            expect(modalBody?.innerHTML).toContain('A basic item description');
        });

        it('should show one-and-done warning', async () => {
            await openDetailModal('items', 'one-and-done-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('One-and-Done');
            expect(modalBody?.innerHTML).toContain('no benefit');
        });

        it('should show hyperbolic warning', async () => {
            await openDetailModal('items', 'hyperbolic-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Hyperbolic Scaling');
            expect(modalBody?.innerHTML).toContain('diminishing returns');
        });

        it('should render synergies section', async () => {
            await openDetailModal('items', 'synergy-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Synergies');
            expect(modalBody?.innerHTML).toContain('Other Item');
            expect(modalBody?.innerHTML).toContain('Special Weapon');
        });

        it('should render anti-synergies section', async () => {
            await openDetailModal('items', 'synergy-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Anti-Synergies');
            expect(modalBody?.innerHTML).toContain('Bad Item');
        });

        it('should show stack limit info', async () => {
            await openDetailModal('items', 'max-stack-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Stack Limit');
            expect(modalBody?.innerHTML).toContain('25');
        });

        it('should show hidden mechanics section', async () => {
            await openDetailModal('items', 'hidden-mechanics-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Hidden Mechanics');
            expect(modalBody?.innerHTML).toContain('Also applies to summons');
            expect(modalBody?.innerHTML).toContain('Stacks with similar effects');
        });

        it('should create graph container for scaling items', async () => {
            await openDetailModal('items', 'scaling-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('modal-graph-container');
            expect(modalBody?.innerHTML).toContain('canvas');
        });
    });

    describe('Weapon Modal Content', () => {
        beforeEach(() => {
            (allData as any).weapons.weapons = [
                {
                    id: 'basic-weapon',
                    name: 'Basic Weapon',
                    tier: 'A',
                    base_damage: 25,
                    attack_pattern: 'Single shot',
                    upgradeable_stats: ['Damage', 'Crit Chance'],
                    description: 'A basic weapon for testing',
                },
                {
                    id: 'full-weapon',
                    name: 'Full Weapon',
                    tier: 'SS',
                    base_damage: 50,
                    base_projectile_count: 3,
                    attack_pattern: 'Triple burst',
                    upgradeable_stats: ['Damage', 'Projectiles', 'Fire Rate'],
                    description: 'A fully-featured weapon',
                    playstyle: 'Aggressive',
                    best_for: ['Boss killing', 'Clearing rooms'],
                    pros: ['High damage', 'Good range'],
                    cons: ['Slow reload', 'Hard to aim'],
                    synergies_items: ['Damage Item'],
                    synergies_tomes: ['Damage Tome'],
                    synergies_characters: ['Strong Character'],
                    build_tips: 'Stack damage for best results',
                    unlock_requirement: 'Beat the game once',
                },
            ];
        });

        it('should render basic weapon content', async () => {
            await openDetailModal('weapons', 'basic-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Basic Weapon');
            expect(modalBody?.innerHTML).toContain('25');
            expect(modalBody?.innerHTML).toContain('Single shot');
        });

        it('should show weapon projectile count', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('3 projectiles');
        });

        it('should show weapon best for section', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Best For');
            expect(modalBody?.innerHTML).toContain('Boss killing');
        });

        it('should show weapon pros and cons', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Pros');
            expect(modalBody?.innerHTML).toContain('High damage');
            expect(modalBody?.innerHTML).toContain('Cons');
            expect(modalBody?.innerHTML).toContain('Slow reload');
        });

        it('should show weapon synergies by category', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Items');
            expect(modalBody?.innerHTML).toContain('Tomes');
            expect(modalBody?.innerHTML).toContain('Characters');
        });

        it('should show weapon build tips', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Build Tips');
            expect(modalBody?.innerHTML).toContain('Stack damage');
        });

        it('should show weapon unlock requirement', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Unlock');
            expect(modalBody?.innerHTML).toContain('Beat the game');
        });
    });

    describe('Character Modal Content', () => {
        beforeEach(() => {
            (allData as any).characters.characters = [
                {
                    id: 'full-character',
                    name: 'Full Character',
                    tier: 'S',
                    playstyle: 'Tank',
                    passive_ability: 'Iron Skin',
                    passive_description: 'Takes 50% less damage',
                    starting_weapon: 'Big Shield',
                    base_hp: 150,
                    base_damage: 8,
                    unlock_requirement: 'Reach wave 50',
                    best_for: ['Long runs', 'New players'],
                    strengths: ['Very tanky', 'Easy to play'],
                    weaknesses: ['Low damage', 'Slow'],
                    synergies_weapons: ['Tank Weapon'],
                    synergies_items: ['HP Item'],
                    synergies_tomes: ['HP Tome'],
                    build_tips: 'Focus on survivability',
                },
            ];
        });

        it('should render character content', async () => {
            await openDetailModal('characters', 'full-character');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Full Character');
            expect(modalBody?.innerHTML).toContain('Tank');
        });

        it('should show character passive ability', async () => {
            await openDetailModal('characters', 'full-character');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Iron Skin');
            expect(modalBody?.innerHTML).toContain('50% less damage');
        });

        it('should show character base stats', async () => {
            await openDetailModal('characters', 'full-character');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('150');
            expect(modalBody?.innerHTML).toContain('8');
        });

        it('should show character strengths and weaknesses', async () => {
            await openDetailModal('characters', 'full-character');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Strengths');
            expect(modalBody?.innerHTML).toContain('Very tanky');
            expect(modalBody?.innerHTML).toContain('Weaknesses');
            expect(modalBody?.innerHTML).toContain('Low damage');
        });

        it('should show character synergies', async () => {
            await openDetailModal('characters', 'full-character');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Synergies');
            expect(modalBody?.innerHTML).toContain('Tank Weapon');
            expect(modalBody?.innerHTML).toContain('HP Item');
        });
    });

    describe('Shrine Modal Content', () => {
        beforeEach(() => {
            (allData as any).shrines.shrines = [
                {
                    id: 'full-shrine',
                    name: 'Full Shrine',
                    icon: '🏛️',
                    type: 'blessing',
                    reusable: false,
                    description: 'A powerful shrine',
                    reward: 'Gain +50% damage for 60 seconds',
                    activation: 'Stand near for 3 seconds',
                    spawn_count: '1 per level',
                    best_for: ['Boss fights', 'Hard mode'],
                    synergies_items: ['Shrine Enhancer'],
                    strategy: 'Save for tough enemies',
                    notes: 'Does not stack with other shrines',
                },
            ];
        });

        it('should render shrine content', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Full Shrine');
        });

        it('should show shrine icon', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('🏛️');
        });

        it('should show shrine reward', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Reward');
            expect(modalBody?.innerHTML).toContain('+50% damage');
        });

        it('should show shrine activation', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Activation');
            expect(modalBody?.innerHTML).toContain('3 seconds');
        });

        it('should show shrine strategy', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Strategy');
            expect(modalBody?.innerHTML).toContain('Save for tough enemies');
        });
    });

    describe('Tome Modal Content', () => {
        beforeEach(() => {
            (allData as any).tomes.tomes = [
                {
                    id: 'full-tome',
                    name: 'Full Tome',
                    tier: 'S',
                    stat_affected: 'Damage',
                    value_per_level: '2%',
                    description: 'A powerful damage tome',
                    notes: 'Stacks multiplicatively',
                    recommended_for: ['Damage builds', 'Glass cannons'],
                    priority: 8,
                },
            ];
        });

        it('should render tome content', async () => {
            await openDetailModal('tomes', 'full-tome');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Full Tome');
        });

        it('should show tome stat affected', async () => {
            await openDetailModal('tomes', 'full-tome');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Damage');
        });

        it('should show tome priority', async () => {
            await openDetailModal('tomes', 'full-tome');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Priority');
            expect(modalBody?.innerHTML).toContain('8');
        });

        it('should show tome recommended for', async () => {
            await openDetailModal('tomes', 'full-tome');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Recommended for');
            expect(modalBody?.innerHTML).toContain('Damage builds');
        });
    });

    describe('Modal Session Management', () => {
        it('should handle modal close during open animation gracefully', async () => {
            vi.useFakeTimers();

            // Start opening modal
            const openPromise = openDetailModal('items', 'basic-item');

            // Close immediately
            closeModal();

            // Complete open
            await openPromise;
            vi.runAllTimers();

            // Should handle gracefully (no throw)
            vi.useRealTimers();
        });

        it('should not throw when opening modal with missing data', async () => {
            // Clear all items
            (allData as any).items.items = [];

            // Should not throw
            await expect(openDetailModal('items', 'nonexistent')).resolves.not.toThrow();
        });
    });
});
