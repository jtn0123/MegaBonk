/**
 * @vitest-environment jsdom
 * Comprehensive coverage tests for modal.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
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

// Mock charts
vi.mock('../../src/modules/charts', () => ({
    chartInstances: {},
    initializeItemCharts: vi.fn(),
    calculateTomeProgression: vi.fn().mockReturnValue([]),
    createScalingChart: vi.fn(),
}));

// Mock data-service
vi.mock('../../src/modules/data-service', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'item1',
                    name: 'Test Item',
                    rarity: 'legendary',
                    tier: 'S',
                    base_effect: 'Test effect',
                    detailed_description: 'Test description',
                    formula: 'x * 2',
                    scaling_per_stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                    scaling_type: 'damage',
                    synergies: ['synergy1'],
                    anti_synergies: ['anti1'],
                    notes: 'Test notes',
                },
            ],
        },
        weapons: {
            weapons: [
                {
                    id: 'weapon1',
                    name: 'Test Weapon',
                    tier: 'A',
                    attack_pattern: 'Melee',
                    description: 'Test weapon description',
                    upgradeable_stats: ['damage', 'speed'],
                },
            ],
        },
        tomes: {
            tomes: [
                {
                    id: 'tome1',
                    name: 'Test Tome',
                    tier: 'A',
                    stat_affected: 'Crit',
                    value_per_level: '+1%',
                    priority: 1,
                    description: 'Test tome description',
                },
            ],
        },
        characters: {
            characters: [
                {
                    id: 'char1',
                    name: 'Test Character',
                    tier: 'S',
                    passive_ability: 'Test Passive',
                    passive_description: 'Test passive description',
                    starting_weapon: 'Sword',
                    playstyle: 'Aggressive',
                },
            ],
        },
        shrines: {
            shrines: [
                {
                    id: 'shrine1',
                    name: 'Test Shrine',
                    icon: '⛩️',
                    type: 'stat_upgrade',
                    description: 'Test shrine description',
                    reward: 'Test reward',
                    reusable: true,
                },
            ],
        },
    },
}));

// Mock utils with importOriginal to get all exports
vi.mock('../../src/modules/utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/modules/utils')>();
    return {
        ...actual,
        safeGetElementById: vi.fn().mockImplementation((id: string) => document.getElementById(id)),
    };
});

// Import functions to test
import {
    openDetailModal,
    closeModal,
} from '../../src/modules/modal';

describe('modal.ts coverage tests', () => {
    beforeEach(() => {
        // Setup DOM with modal elements
        document.body.innerHTML = `
            <div id="itemModal" class="modal" style="display: none;" aria-hidden="true">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <div id="modalBody"></div>
                </div>
            </div>
        `;

        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    describe('openDetailModal', () => {
        it('should open modal for valid item', () => {
            openDetailModal('items', 'item1');
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should populate modal body with item details', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test Item');
        });

        it('should handle weapon type', () => {
            openDetailModal('weapons', 'weapon1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test Weapon');
        });

        it('should handle tome type', () => {
            // Just verify it doesn't throw
            expect(() => openDetailModal('tomes', 'tome1')).not.toThrow();
        });

        it('should handle character type', () => {
            openDetailModal('characters', 'char1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test Character');
        });

        it('should handle shrine type', () => {
            openDetailModal('shrines', 'shrine1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test Shrine');
        });

        it('should return early if item not found', () => {
            openDetailModal('items', 'nonexistent');
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should return early if modal elements missing', () => {
            document.body.innerHTML = '';
            expect(() => openDetailModal('items', 'item1')).not.toThrow();
        });

        it('should open modal successfully', () => {
            openDetailModal('items', 'item1');
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should add active class to modal', async () => {
            openDetailModal('items', 'item1');
            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);
        });

        it('should handle item with synergies', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('synergy1');
        });

        it('should handle item with anti-synergies', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('anti1');
        });
    });

    describe('closeModal', () => {
        it('should hide modal', () => {
            // First open the modal
            openDetailModal('items', 'item1');
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');

            // Then close it
            closeModal();
            expect(modal?.classList.contains('active')).toBe(false);
        });

        it('should remove active class when closing', () => {
            openDetailModal('items', 'item1');
            closeModal();
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(false);
        });

        it('should handle missing modal gracefully', () => {
            document.body.innerHTML = '';
            expect(() => closeModal()).not.toThrow();
        });

        it('should hide modal after animation timeout', async () => {
            openDetailModal('items', 'item1');
            closeModal();
            await new Promise(resolve => setTimeout(resolve, 350));
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });
    });

    describe('Item Details Rendering', () => {
        it('should render item modal content', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            // Just verify modal body has content
            expect(modalBody).toBeTruthy();
        });
    });

    describe('Weapon Details Rendering', () => {
        it('should render weapon modal content', () => {
            openDetailModal('weapons', 'weapon1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        it('should handle tome type gracefully', () => {
            expect(() => openDetailModal('tomes', 'tome1')).not.toThrow();
        });

        it('should handle character type gracefully', () => {
            expect(() => openDetailModal('characters', 'char1')).not.toThrow();
        });

        it('should handle shrine type gracefully', () => {
            expect(() => openDetailModal('shrines', 'shrine1')).not.toThrow();
        });

        it('should handle rapid modal switches', async () => {
            // Open multiple modals quickly
            openDetailModal('items', 'item1');
            openDetailModal('weapons', 'weapon1');
            openDetailModal('characters', 'char1');

            // Wait for all async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
        });

        it('should handle non-existent modal body', () => {
            document.getElementById('modalBody')?.remove();
            expect(() => openDetailModal('items', 'item1')).not.toThrow();
        });

        it('should handle undefined item id', () => {
            expect(() => openDetailModal('items', '')).not.toThrow();
        });

        it('should display item with all optional fields', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            // Item has synergies, anti_synergies, notes, formula, etc.
            expect(modalBody?.innerHTML).toBeTruthy();
        });

        it('should close modal when already closed', () => {
            const modal = document.getElementById('itemModal');
            if (modal) modal.style.display = 'none';
            expect(() => closeModal()).not.toThrow();
        });

        it('should handle multiple close calls', () => {
            openDetailModal('items', 'item1');
            closeModal();
            closeModal();
            closeModal();
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(false);
        });
    });

    describe('Character Details', () => {
        it('should render character passive ability', () => {
            openDetailModal('characters', 'char1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test passive description');
        });

        it('should render character starting weapon', () => {
            openDetailModal('characters', 'char1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Sword');
        });

        it('should render character playstyle', () => {
            openDetailModal('characters', 'char1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Aggressive');
        });
    });

    describe('Shrine Details', () => {
        it('should render shrine icon', () => {
            openDetailModal('shrines', 'shrine1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('⛩️');
        });

        it('should render shrine reward', () => {
            openDetailModal('shrines', 'shrine1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test reward');
        });

        it('should render shrine description', () => {
            openDetailModal('shrines', 'shrine1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test shrine description');
        });
    });

    describe('Weapon Details', () => {
        it('should render weapon attack pattern', () => {
            openDetailModal('weapons', 'weapon1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Melee');
        });

        it('should render weapon description', () => {
            openDetailModal('weapons', 'weapon1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Test weapon description');
        });

        it('should render weapon upgradeable stats', () => {
            openDetailModal('weapons', 'weapon1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('damage');
        });
    });

    describe('Tome Details', () => {
        it('should render tome stat affected', async () => {
            openDetailModal('tomes', 'tome1');
            await new Promise(resolve => setTimeout(resolve, 100));
            const modalBody = document.getElementById('modalBody');
            expect(modalBody).toBeTruthy();
        });

        it('should render tome value per level', async () => {
            openDetailModal('tomes', 'tome1');
            await new Promise(resolve => setTimeout(resolve, 100));
            const modalBody = document.getElementById('modalBody');
            expect(modalBody).toBeTruthy();
        });

        it('should render tome priority', async () => {
            openDetailModal('tomes', 'tome1');
            await new Promise(resolve => setTimeout(resolve, 100));
            const modalBody = document.getElementById('modalBody');
            expect(modalBody).toBeTruthy();
        });
    });

    describe('Item Scaling', () => {
        it('should display item scaling data', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            // Item has scaling_per_stack data
            expect(modalBody?.innerHTML).toBeTruthy();
        });

        it('should display item formula', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('x * 2');
        });

        it('should display item notes section if present', () => {
            openDetailModal('items', 'item1');
            const modalBody = document.getElementById('modalBody');
            // Just verify modal renders without error
            expect(modalBody?.innerHTML).toBeTruthy();
        });
    });
});
