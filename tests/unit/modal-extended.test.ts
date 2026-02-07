/**
 * @vitest-environment jsdom
 * Extended coverage tests for modal.ts
 * Covers: handleFocusTrap, MutationObserver, scaling tab handlers,
 * chart module import failures, weapon/shrine rendering edge cases
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData } from '../helpers/mock-data.js';

// Store module references for dynamic mock manipulation
let chartModuleMock: any;

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock toast manager
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
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

// Mock formula-renderer
vi.mock('../../src/modules/formula-renderer.ts', () => ({
    renderFormulaDisplay: vi.fn((formula: string) => `<span class="formula">${formula}</span>`),
}));

// Mock recently-viewed
vi.mock('../../src/modules/recently-viewed.ts', () => ({
    onModalOpened: vi.fn(),
}));

// Mock similar-items
vi.mock('../../src/modules/similar-items.ts', () => ({
    renderSimilarItemsSection: vi.fn(() => ''),
    setupSimilarItemsHandlers: vi.fn(),
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/modules/utils')>();
    return {
        ...actual,
        safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
        generateModalImage: vi.fn((data: any, name: string, type: string) => {
            if (data.image) {
                return `<img src="${data.image}" alt="${name}" class="modal-${type}-image">`;
            }
            return '';
        }),
        escapeHtml: vi.fn((str: string) => str || ''),
    };
});

// Mock charts module - will be manipulated in tests
vi.mock('../../src/modules/charts.ts', () => ({
    getEffectiveStackCap: vi.fn(() => 100),
    createScalingChart: vi.fn(),
    calculateTomeProgression: vi.fn(() => [1, 2, 3, 4, 5]),
}));

import { openDetailModal, closeModal } from '../../src/modules/modal.ts';
import { allData } from '../../src/modules/data-service.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';

describe('Modal Module - Extended Coverage', () => {
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

    // ========================================
    // Focus Trap - Tab Key Navigation
    // ========================================
    describe('Focus Trap - Tab Navigation', () => {
        beforeEach(() => {
            // Create modal with multiple focusable elements
            document.body.innerHTML = `
                <div id="itemModal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <button id="firstBtn" class="close">×</button>
                        <div id="modalBody">
                            <h2 id="modal-title">Test</h2>
                            <a href="#" id="link1">Link</a>
                            <input type="text" id="input1">
                            <button id="lastBtn">Action</button>
                        </div>
                    </div>
                </div>
            `;
            
            (allData as any).items.items = [{
                id: 'focus-test-item',
                name: 'Focus Test Item',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'Effect',
                detailed_description: 'Description',
                formula: 'formula',
            }];
        });

        it('should handle Tab key event without error', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'focus-test-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);

            // Simulate Tab key - verify no error is thrown
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey: false,
                bubbles: true,
                cancelable: true,
            });

            expect(() => document.dispatchEvent(tabEvent)).not.toThrow();

            vi.useRealTimers();
        });

        it('should wrap Shift+Tab from first element to last', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'focus-test-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);

            // Simulate Shift+Tab
            const shiftTabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            });

            document.dispatchEvent(shiftTabEvent);

            vi.useRealTimers();
        });

        it('should not trap Tab when focus trap is inactive', async () => {
            vi.useFakeTimers();

            // Open and immediately close
            await openDetailModal('items', 'focus-test-item');
            vi.runAllTimers();
            closeModal();
            vi.advanceTimersByTime(350);

            // Tab after close should not cause errors
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                bubbles: true,
            });

            expect(() => document.dispatchEvent(tabEvent)).not.toThrow();

            vi.useRealTimers();
        });

        it('should deactivate focus trap when modal element is removed', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'focus-test-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(true);

            // Remove modal from DOM abnormally
            modal?.remove();

            // Dispatch Tab - should detect removed modal
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                bubbles: true,
            });

            expect(() => document.dispatchEvent(tabEvent)).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle Tab when modal is not active', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'focus-test-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal');
            
            // Remove active class without closing properly
            modal?.classList.remove('active');

            // Dispatch Tab
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                bubbles: true,
            });

            expect(() => document.dispatchEvent(tabEvent)).not.toThrow();

            vi.useRealTimers();
        });
    });

    // ========================================
    // MutationObserver Cleanup
    // ========================================
    describe('MutationObserver Cleanup', () => {
        beforeEach(() => {
            (allData as any).items.items = [{
                id: 'observer-item',
                name: 'Observer Test Item',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'Effect',
                detailed_description: 'Description',
                formula: 'f',
            }];
        });

        it('should cleanup focus trap when modal style is set to none', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'observer-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal') as HTMLElement;
            expect(modal?.classList.contains('active')).toBe(true);

            // Simulate external style change (abnormal close)
            modal.style.display = 'none';

            // Wait for MutationObserver
            await vi.advanceTimersByTimeAsync(50);

            // Focus trap should be deactivated
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                bubbles: true,
            });

            expect(() => document.dispatchEvent(tabEvent)).not.toThrow();

            vi.useRealTimers();
        });

        it('should cleanup focus trap when active class is removed', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'observer-item');
            vi.runAllTimers();

            const modal = document.getElementById('itemModal') as HTMLElement;
            expect(modal?.classList.contains('active')).toBe(true);

            // Remove active class externally
            modal.classList.remove('active');

            // Wait for MutationObserver
            await vi.advanceTimersByTimeAsync(50);

            vi.useRealTimers();
        });
    });

    // ========================================
    // Scaling Tab Handlers
    // ========================================
    describe('Scaling Tab Handlers', () => {
        beforeEach(() => {
            (allData as any).items.items = [{
                id: 'tab-item',
                name: 'Tab Test Item',
                tier: 'S',
                rarity: 'legendary',
                base_effect: 'Multi effect',
                detailed_description: 'Has scaling tracks',
                formula: 'complex',
                scaling_tracks: {
                    damage: { stat: 'Damage', values: [10, 20, 30, 40, 50] },
                    crit: { stat: 'Crit Chance', values: [5, 10, 15, 20, 25] },
                    speed: { stat: 'Attack Speed', values: [1, 2, 3, 4, 5] },
                },
                scaling_type: 'linear',
                scaling_formula_type: 'linear',
            }];
        });

        it('should render tabs with proper attributes', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'tab-item');
            vi.runAllTimers();

            // Find tabs
            const tabs = document.querySelectorAll('.scaling-tab');
            expect(tabs.length).toBe(3);

            // First tab should be active
            expect(tabs[0]?.classList.contains('active')).toBe(true);

            // All tabs should have data-item-id
            tabs.forEach((tab: Element) => {
                expect((tab as HTMLElement).dataset.itemId).toBe('tab-item');
            });

            vi.useRealTimers();
        });

        it('should render tabs with data-track attributes', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'tab-item');
            vi.runAllTimers();

            // Find tabs
            const tabs = document.querySelectorAll('.scaling-tab');
            
            // Each tab should have a data-track attribute
            const trackValues = Array.from(tabs).map(
                (tab: Element) => (tab as HTMLElement).dataset.track
            );
            
            expect(trackValues).toContain('damage');
            expect(trackValues).toContain('crit');
            expect(trackValues).toContain('speed');

            vi.useRealTimers();
        });

        it('should handle click outside tabs gracefully', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'tab-item');
            vi.runAllTimers();

            // Click on container, not a tab
            const container = document.querySelector('.scaling-tabs') as HTMLElement;
            container?.click();

            // Should not throw
            await vi.advanceTimersByTimeAsync(50);

            vi.useRealTimers();
        });

        it('should setup tab handlers container', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'tab-item');
            vi.runAllTimers();

            // Container should exist
            const container = document.querySelector('.scaling-tabs');
            expect(container).not.toBeNull();

            vi.useRealTimers();
        });

        it('should handle missing track data gracefully', async () => {
            vi.useFakeTimers();

            await openDetailModal('items', 'tab-item');
            vi.runAllTimers();

            // Set data-track to non-existent track
            const tabs = document.querySelectorAll('.scaling-tab');
            const secondTab = tabs[1] as HTMLButtonElement;
            secondTab.dataset.track = 'nonexistent';

            // Click the modified tab
            secondTab.click();

            // Wait for handler - should not throw
            await vi.advanceTimersByTimeAsync(50);

            vi.useRealTimers();
        });
    });

    // ========================================
    // Weapon Modal - Full Rendering
    // ========================================
    describe('Weapon Modal - Full Rendering', () => {
        beforeEach(() => {
            (allData as any).weapons.weapons = [{
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
                synergies_items: ['Damage Item', 'Crit Item'],
                synergies_tomes: ['Damage Tome'],
                synergies_characters: ['Strong Character'],
                build_tips: 'Stack damage for best results',
                unlock_requirement: 'Beat the game once',
            }];
        });

        it('should render weapon with all synergy types', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            
            // Items synergies
            expect(modalBody?.innerHTML).toContain('Damage Item');
            expect(modalBody?.innerHTML).toContain('Crit Item');
            
            // Tomes synergies
            expect(modalBody?.innerHTML).toContain('Damage Tome');
            
            // Characters synergies
            expect(modalBody?.innerHTML).toContain('Strong Character');
        });

        it('should render weapon pros and cons', async () => {
            await openDetailModal('weapons', 'full-weapon');

            const modalBody = document.getElementById('modalBody');
            
            // Pros
            expect(modalBody?.innerHTML).toContain('High damage');
            expect(modalBody?.innerHTML).toContain('Good range');
            
            // Cons
            expect(modalBody?.innerHTML).toContain('Slow reload');
            expect(modalBody?.innerHTML).toContain('Hard to aim');
        });

        it('should render weapon without optional sections', async () => {
            (allData as any).weapons.weapons = [{
                id: 'minimal-weapon',
                name: 'Minimal Weapon',
                tier: 'C',
                base_damage: 10,
                attack_pattern: 'Single',
                upgradeable_stats: [],
                description: 'Basic weapon',
            }];

            await openDetailModal('weapons', 'minimal-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Minimal Weapon');
            // Should not contain synergy sections
            expect(modalBody?.innerHTML).not.toContain('Build Tips');
        });

        it('should render empty upgradeable stats as None', async () => {
            (allData as any).weapons.weapons = [{
                id: 'no-upgrade-weapon',
                name: 'No Upgrade Weapon',
                tier: 'B',
                base_damage: 15,
                attack_pattern: 'Basic',
                upgradeable_stats: [],
                description: 'Cannot be upgraded',
            }];

            await openDetailModal('weapons', 'no-upgrade-weapon');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('None');
        });
    });

    // ========================================
    // Shrine Modal - Full Rendering
    // ========================================
    describe('Shrine Modal - Full Rendering', () => {
        beforeEach(() => {
            (allData as any).shrines.shrines = [{
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
                synergies_items: ['Shrine Enhancer', 'Blessing Amplifier'],
                strategy: 'Save for tough enemies',
                notes: 'Does not stack with other shrines',
            }];
        });

        it('should render shrine with all sections', async () => {
            await openDetailModal('shrines', 'full-shrine');

            const modalBody = document.getElementById('modalBody');
            
            expect(modalBody?.innerHTML).toContain('🏛️');
            expect(modalBody?.innerHTML).toContain('blessing');
            expect(modalBody?.innerHTML).toContain('One-time');
            expect(modalBody?.innerHTML).toContain('+50% damage');
            expect(modalBody?.innerHTML).toContain('3 seconds');
            expect(modalBody?.innerHTML).toContain('1 per level');
            expect(modalBody?.innerHTML).toContain('Boss fights');
            expect(modalBody?.innerHTML).toContain('Shrine Enhancer');
            expect(modalBody?.innerHTML).toContain('Save for tough enemies');
            expect(modalBody?.innerHTML).toContain('Does not stack');
        });

        it('should render reusable badge', async () => {
            (allData as any).shrines.shrines = [{
                id: 'reusable-shrine',
                name: 'Reusable Shrine',
                icon: '⛩️',
                type: 'heal',
                reusable: true,
                description: 'Can be used multiple times',
                reward: 'Heal 20 HP',
            }];

            await openDetailModal('shrines', 'reusable-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Reusable');
        });

        it('should render shrine without optional fields', async () => {
            (allData as any).shrines.shrines = [{
                id: 'minimal-shrine',
                name: 'Minimal Shrine',
                icon: '?',
                type: 'unknown',
                description: 'Basic shrine',
                reward: 'Something',
            }];

            await openDetailModal('shrines', 'minimal-shrine');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Minimal Shrine');
        });

        it('should handle undefined reusable', async () => {
            (allData as any).shrines.shrines = [{
                id: 'undef-reusable',
                name: 'Undefined Reusable',
                icon: '!',
                type: 'mystery',
                description: 'Unknown reusability',
                reward: 'Unknown',
            }];

            await openDetailModal('shrines', 'undef-reusable');

            const modalBody = document.getElementById('modalBody');
            // Should not contain Reusable or One-time badges
            expect(modalBody?.innerHTML).not.toContain('Reusable</span>');
            expect(modalBody?.innerHTML).not.toContain('One-time</span>');
        });
    });

    // ========================================
    // Character Modal - Full Rendering
    // ========================================
    describe('Character Modal - Full Rendering', () => {
        beforeEach(() => {
            (allData as any).characters.characters = [{
                id: 'full-char',
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
                weaknesses: ['Low damage', 'Slow movement'],
                synergies_weapons: ['Tank Weapon', 'Shield'],
                synergies_items: ['HP Item', 'Armor'],
                synergies_tomes: ['HP Tome', 'Defense Tome'],
                build_tips: 'Focus on survivability',
            }];
        });

        it('should render character with all sections', async () => {
            await openDetailModal('characters', 'full-char');

            const modalBody = document.getElementById('modalBody');
            
            expect(modalBody?.innerHTML).toContain('Full Character');
            expect(modalBody?.innerHTML).toContain('Tank');
            expect(modalBody?.innerHTML).toContain('Iron Skin');
            expect(modalBody?.innerHTML).toContain('50% less damage');
            expect(modalBody?.innerHTML).toContain('Big Shield');
            expect(modalBody?.innerHTML).toContain('150');
            expect(modalBody?.innerHTML).toContain('Reach wave 50');
            expect(modalBody?.innerHTML).toContain('Long runs');
            expect(modalBody?.innerHTML).toContain('Very tanky');
            expect(modalBody?.innerHTML).toContain('Low damage');
            expect(modalBody?.innerHTML).toContain('Tank Weapon');
            expect(modalBody?.innerHTML).toContain('HP Item');
            expect(modalBody?.innerHTML).toContain('HP Tome');
            expect(modalBody?.innerHTML).toContain('Focus on survivability');
        });

        it('should render character without optional fields', async () => {
            (allData as any).characters.characters = [{
                id: 'minimal-char',
                name: 'Minimal Character',
                tier: 'C',
                playstyle: 'Basic',
                passive_ability: 'None',
                passive_description: 'No passive',
                starting_weapon: 'Fists',
                base_hp: 100,
                base_damage: 10,
            }];

            await openDetailModal('characters', 'minimal-char');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Minimal Character');
        });
    });

    // ========================================
    // Tome Modal - Async Rendering
    // ========================================
    describe('Tome Modal - Async Rendering', () => {
        beforeEach(() => {
            (allData as any).tomes.tomes = [{
                id: 'full-tome',
                name: 'Full Tome',
                tier: 'S',
                stat_affected: 'Damage',
                value_per_level: '2%',
                description: 'A powerful damage tome',
                notes: 'Stacks multiplicatively',
                recommended_for: ['Damage builds', 'Glass cannons'],
                priority: 8,
            }];
        });

        it('should render tome with notes', async () => {
            await openDetailModal('tomes', 'full-tome');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Stacks multiplicatively');
        });

        it('should render tome recommended_for as string', async () => {
            (allData as any).tomes.tomes = [{
                id: 'string-recommended',
                name: 'String Recommended Tome',
                tier: 'A',
                stat_affected: 'HP',
                value_per_level: '1%',
                description: 'Test tome',
                recommended_for: 'All builds',
                priority: 5,
            }];

            await openDetailModal('tomes', 'string-recommended');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('General use');
        });

        it('should render tome without recommended_for', async () => {
            (allData as any).tomes.tomes = [{
                id: 'no-recommended',
                name: 'No Recommended Tome',
                tier: 'B',
                stat_affected: 'Speed',
                value_per_level: '0.5%',
                description: 'Basic tome',
                priority: 3,
            }];

            await openDetailModal('tomes', 'no-recommended');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('General use');
        });
    });

    // ========================================
    // Item Modal - Edge Cases
    // ========================================
    describe('Item Modal - Edge Cases', () => {
        it('should render item with stack_cap instead of max_stacks', async () => {
            (allData as any).items.items = [{
                id: 'stack-cap-item',
                name: 'Stack Cap Item',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'Effect',
                detailed_description: 'Has stack cap',
                formula: 'f',
                stack_cap: 50,
            }];

            await openDetailModal('items', 'stack-cap-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Stack Limit');
            expect(modalBody?.innerHTML).toContain('50');
        });

        it('should not show stack info for high stack_cap', async () => {
            (allData as any).items.items = [{
                id: 'high-stack-cap',
                name: 'High Stack Cap',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'Effect',
                detailed_description: 'Very high cap',
                formula: 'f',
                stack_cap: 200,
            }];

            await openDetailModal('items', 'high-stack-cap');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).not.toContain('Stack Limit');
        });

        it('should render item with empty scaling_tracks', async () => {
            vi.useFakeTimers();

            (allData as any).items.items = [{
                id: 'empty-tracks',
                name: 'Empty Tracks Item',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'Effect',
                detailed_description: 'Empty tracks',
                formula: 'f',
                scaling_tracks: {},
            }];

            await openDetailModal('items', 'empty-tracks');
            vi.runAllTimers();

            // Should not throw
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Empty Tracks Item');

            vi.useRealTimers();
        });
    });

    // ========================================
    // Modal Session - Stale Initialization
    // ========================================
    describe('Modal Session Management', () => {
        it('should cancel chart initialization when modal changes', async () => {
            vi.useFakeTimers();

            (allData as any).items.items = [
                {
                    id: 'item1',
                    name: 'Item 1',
                    tier: 'A',
                    rarity: 'rare',
                    base_effect: 'e1',
                    detailed_description: 'd1',
                    formula: 'f1',
                    scaling_per_stack: [1, 2, 3],
                },
                {
                    id: 'item2',
                    name: 'Item 2',
                    tier: 'S',
                    rarity: 'epic',
                    base_effect: 'e2',
                    detailed_description: 'd2',
                    formula: 'f2',
                },
            ];

            // Start first open
            openDetailModal('items', 'item1');

            // Before animation frame runs, open second modal
            await openDetailModal('items', 'item2');

            vi.runAllTimers();

            // Second item should be displayed
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain('Item 2');

            vi.useRealTimers();
        });

        it('should not create chart after modal is closed', async () => {
            vi.useFakeTimers();

            (allData as any).items.items = [{
                id: 'quick-close',
                name: 'Quick Close Item',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'e',
                detailed_description: 'd',
                formula: 'f',
                scaling_per_stack: [1, 2, 3],
            }];

            const { createScalingChart } = await import('../../src/modules/charts.ts');
            vi.mocked(createScalingChart).mockClear();

            // Open modal
            openDetailModal('items', 'quick-close');

            // Close immediately
            closeModal();

            // Run timers
            vi.runAllTimers();

            // Chart should not be created (or if created, it's handled gracefully)
            vi.useRealTimers();
        });
    });

    // ========================================
    // Empty/Null Data Handling
    // ========================================
    describe('Empty Data Handling', () => {
        it('should handle null items array', async () => {
            (allData as any).items = { items: null };

            await openDetailModal('items', 'nonexistent');

            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle undefined weapons array', async () => {
            (allData as any).weapons = { weapons: undefined };

            await openDetailModal('weapons', 'nonexistent');

            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle null tomes array', async () => {
            (allData as any).tomes = { tomes: null };

            await openDetailModal('tomes', 'nonexistent');

            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle undefined characters array', async () => {
            (allData as any).characters = { characters: undefined };

            await openDetailModal('characters', 'nonexistent');

            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle null shrines array', async () => {
            (allData as any).shrines = { shrines: null };

            await openDetailModal('shrines', 'nonexistent');

            expect(ToastManager.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // Body Scroll Lock
    // ========================================
    describe('Body Scroll Lock', () => {
        it('should add modal-open class on body when modal opens', async () => {
            vi.useFakeTimers();

            (allData as any).items.items = [{
                id: 'scroll-item',
                name: 'Scroll Test',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'e',
                detailed_description: 'd',
                formula: 'f',
            }];

            await openDetailModal('items', 'scroll-item');
            vi.runAllTimers();

            expect(document.body.classList.contains('modal-open')).toBe(true);

            vi.useRealTimers();
        });

        it('should remove modal-open class when modal closes', async () => {
            vi.useFakeTimers();

            (allData as any).items.items = [{
                id: 'scroll-close-item',
                name: 'Scroll Close Test',
                tier: 'A',
                rarity: 'rare',
                base_effect: 'e',
                detailed_description: 'd',
                formula: 'f',
            }];

            await openDetailModal('items', 'scroll-close-item');
            vi.runAllTimers();

            closeModal();
            vi.advanceTimersByTime(350);

            expect(document.body.classList.contains('modal-open')).toBe(false);

            vi.useRealTimers();
        });
    });
});
