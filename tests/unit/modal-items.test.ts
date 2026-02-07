// ========================================
// Modal Items Module Tests
// ========================================
// Tests for item modal rendering functionality

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn(() => null),
    generateModalImage: vi.fn((data: unknown, name: string, type: string) => `<div class="modal-image" data-type="${type}">${name}</div>`),
    escapeHtml: vi.fn((str: string) => str?.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

vi.mock('../../src/modules/formula-renderer.ts', () => ({
    renderFormulaDisplay: vi.fn((formula: string) => `<span class="formula">${formula}</span>`),
}));

// Mock chart module and modal-core - use inline definitions to avoid hoisting issues
vi.mock('../../src/modules/modal-core.ts', () => {
    const mockTabHandlers = new WeakMap();
    return {
        getChartModule: vi.fn().mockResolvedValue({
            getEffectiveStackCap: vi.fn(() => 100),
            createScalingChart: vi.fn(),
        }),
        getCurrentModalSessionId: vi.fn(() => 1),
        incrementModalSessionId: vi.fn(() => 1),
        tabHandlers: mockTabHandlers,
    };
});

import { renderItemModal } from '../../src/modules/modal-items.ts';
import { escapeHtml, generateModalImage } from '../../src/modules/utils.ts';
import { getChartModule, getCurrentModalSessionId, incrementModalSessionId } from '../../src/modules/modal-core.ts';
import type { Item } from '../../src/types/index.ts';

describe('Modal Items Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset mock implementations
        vi.mocked(getChartModule).mockResolvedValue({
            getEffectiveStackCap: vi.fn(() => 100),
            createScalingChart: vi.fn(),
        } as never);
        vi.mocked(getCurrentModalSessionId).mockReturnValue(1);
        vi.mocked(incrementModalSessionId).mockReturnValue(1);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('renderItemModal', () => {
        const createBaseItem = (overrides: Partial<Item> = {}): Item => ({
            id: 'test-item-1',
            name: 'Test Item',
            description: 'A test item',
            tier: 'S',
            rarity: 'legendary',
            base_effect: 'Does something cool',
            detailed_description: 'This item does many cool things',
            ...overrides,
        });

        describe('Basic Rendering', () => {
            it('should render item with image', () => {
                const item = createBaseItem();
                const html = renderItemModal(item);

                expect(generateModalImage).toHaveBeenCalledWith(item, item.name, 'item');
                expect(html).toContain('modal-image');
            });

            it('should render item badges with tier and rarity', () => {
                const item = createBaseItem({ tier: 'A', rarity: 'epic' });
                const html = renderItemModal(item);

                expect(html).toContain('rarity-epic');
                expect(html).toContain('tier-A');
                expect(html).toContain('epic');
                expect(html).toContain('A Tier');
            });

            it('should render base effect', () => {
                const item = createBaseItem({ base_effect: 'Increases damage by 10%' });
                const html = renderItemModal(item);

                expect(html).toContain('item-effect');
                expect(html).toContain('Increases damage by 10%');
            });

            it('should render detailed description', () => {
                const item = createBaseItem({ detailed_description: 'Full item details here' });
                const html = renderItemModal(item);

                expect(html).toContain('Full item details here');
            });

            it('should escape HTML in description and effects', () => {
                const item = createBaseItem({ 
                    base_effect: '<script>alert("xss")</script>',
                    detailed_description: '<img onerror=alert(1)>',
                });
                renderItemModal(item);

                expect(escapeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
                expect(escapeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
            });

            it('should handle missing optional fields gracefully', () => {
                const item = createBaseItem({
                    base_effect: undefined,
                    detailed_description: undefined,
                });
                const html = renderItemModal(item);

                expect(html).toBeDefined();
                expect(html).toContain('item-effect');
            });
        });

        describe('One-and-Done Items', () => {
            it('should show warning for one-and-done items', () => {
                const item = createBaseItem({ one_and_done: true });
                const html = renderItemModal(item);

                expect(html).toContain('one-and-done-warning');
                expect(html).toContain('One-and-Done');
                expect(html).toContain('no benefit');
            });

            it('should not show warning for regular items', () => {
                const item = createBaseItem({ one_and_done: false });
                const html = renderItemModal(item);

                expect(html).not.toContain('one-and-done-warning');
            });
        });

        describe('Stack Information', () => {
            it('should show stack limit when max_stacks is set', () => {
                const item = createBaseItem({ max_stacks: 10 });
                const html = renderItemModal(item);

                expect(html).toContain('stack-info');
                expect(html).toContain('Stack Limit');
                expect(html).toContain('10 stacks');
            });

            it('should show stack limit when stack_cap is low', () => {
                const item = createBaseItem({ stack_cap: 50 });
                const html = renderItemModal(item);

                expect(html).toContain('stack-info');
                expect(html).toContain('50 stacks');
            });

            it('should not show stack limit for high stack_cap values', () => {
                const item = createBaseItem({ stack_cap: 150 });
                const html = renderItemModal(item);

                expect(html).not.toContain('stack-info');
            });

            it('should prefer max_stacks over stack_cap', () => {
                const item = createBaseItem({ max_stacks: 5, stack_cap: 50 });
                const html = renderItemModal(item);

                expect(html).toContain('5 stacks');
            });
        });

        describe('Hyperbolic Scaling', () => {
            it('should show hyperbolic warning when scaling_formula_type is hyperbolic', () => {
                const item = createBaseItem({ scaling_formula_type: 'hyperbolic' });
                const html = renderItemModal(item);

                expect(html).toContain('hyperbolic-warning');
                expect(html).toContain('Hyperbolic Scaling');
                expect(html).toContain('diminishing returns');
            });

            it('should not show hyperbolic warning for linear scaling', () => {
                const item = createBaseItem({ scaling_formula_type: 'linear' });
                const html = renderItemModal(item);

                expect(html).not.toContain('hyperbolic-warning');
            });
        });

        describe('Hidden Mechanics', () => {
            it('should render hidden mechanics when present', () => {
                const item = createBaseItem({
                    hidden_mechanics: ['Secret effect 1', 'Secret effect 2'],
                });
                const html = renderItemModal(item);

                expect(html).toContain('hidden-mechanics');
                expect(html).toContain('Hidden Mechanics');
                expect(html).toContain('Secret effect 1');
                expect(html).toContain('Secret effect 2');
            });

            it('should not render hidden mechanics section when empty', () => {
                const item = createBaseItem({ hidden_mechanics: [] });
                const html = renderItemModal(item);

                expect(html).not.toContain('hidden-mechanics');
            });

            it('should not render hidden mechanics section when undefined', () => {
                const item = createBaseItem({ hidden_mechanics: undefined });
                const html = renderItemModal(item);

                expect(html).not.toContain('hidden-mechanics');
            });
        });

        describe('Formula Display', () => {
            it('should render formula when present', () => {
                const item = createBaseItem({ formula: '10 + (stacks * 2)' });
                const html = renderItemModal(item);

                expect(html).toContain('item-formula');
                expect(html).toContain('Formula');
            });

            it('should not render formula section when not present', () => {
                const item = createBaseItem({ formula: undefined });
                const html = renderItemModal(item);

                expect(html).not.toContain('item-formula');
            });
        });

        describe('Synergies', () => {
            it('should render synergies when present', () => {
                const item = createBaseItem({
                    synergies: ['Sword of Power', 'Shield of Light'],
                });
                const html = renderItemModal(item);

                expect(html).toContain('synergies-section');
                expect(html).toContain('Synergies');
                expect(html).toContain('synergy-tag');
                expect(html).toContain('Sword of Power');
                expect(html).toContain('Shield of Light');
            });

            it('should not render synergies section when empty', () => {
                const item = createBaseItem({ synergies: [] });
                const html = renderItemModal(item);

                expect(html).not.toContain('synergies-section');
            });
        });

        describe('Anti-Synergies', () => {
            it('should render anti-synergies when present', () => {
                const item = createBaseItem({
                    anti_synergies: ['Cursed Ring', 'Dark Amulet'],
                });
                const html = renderItemModal(item);

                expect(html).toContain('anti-synergies-section');
                expect(html).toContain('Anti-Synergies');
                expect(html).toContain('antisynergy-tag');
                expect(html).toContain('Cursed Ring');
                expect(html).toContain('Dark Amulet');
            });

            it('should not render anti-synergies section when empty', () => {
                const item = createBaseItem({ anti_synergies: [] });
                const html = renderItemModal(item);

                expect(html).not.toContain('anti-synergies-section');
            });
        });

        describe('Scaling Charts', () => {
            it('should render graph container for items with scaling_per_stack', () => {
                const item = createBaseItem({
                    scaling_per_stack: [1, 2, 3, 4, 5],
                    one_and_done: false,
                    graph_type: 'line',
                });
                const html = renderItemModal(item);

                expect(html).toContain('modal-graph-container');
                expect(html).toContain(`modal-chart-${item.id}`);
            });

            it('should not render graph for one-and-done items', () => {
                const item = createBaseItem({
                    scaling_per_stack: [1, 2, 3, 4, 5],
                    one_and_done: true,
                });
                const html = renderItemModal(item);

                expect(html).not.toContain('modal-graph-container');
            });

            it('should not render graph when graph_type is flat', () => {
                const item = createBaseItem({
                    scaling_per_stack: [1, 1, 1, 1, 1],
                    graph_type: 'flat',
                });
                const html = renderItemModal(item);

                expect(html).not.toContain('modal-graph-container');
            });

            it('should render scaling tracks tabs when multiple tracks exist', () => {
                const item = createBaseItem({
                    scaling_tracks: {
                        damage: { stat: 'Damage', values: [1, 2, 3] },
                        health: { stat: 'Health', values: [10, 20, 30] },
                    },
                });
                const html = renderItemModal(item);

                expect(html).toContain('scaling-tracks-container');
                expect(html).toContain('scaling-tabs');
                expect(html).toContain('scaling-tab');
                expect(html).toContain('data-track="damage"');
                expect(html).toContain('data-track="health"');
            });

            it('should set first tab as active by default', () => {
                const item = createBaseItem({
                    scaling_tracks: {
                        damage: { stat: 'Damage', values: [1, 2, 3] },
                        health: { stat: 'Health', values: [10, 20, 30] },
                    },
                });
                const html = renderItemModal(item);

                // First tab should have active class
                expect(html).toMatch(/scaling-tab active.*?data-track="damage"/);
            });

            it('should include ARIA attributes for accessibility', () => {
                const item = createBaseItem({
                    scaling_tracks: {
                        damage: { stat: 'Damage', values: [1, 2, 3] },
                    },
                });
                const html = renderItemModal(item);

                expect(html).toContain('role="tab"');
                expect(html).toContain('role="tablist"');
                expect(html).toContain('role="tabpanel"');
                expect(html).toContain('aria-selected="true"');
            });
        });

        describe('Chart Initialization', () => {
            it('should increment modal session ID for chart tracking', () => {
                const item = createBaseItem({
                    scaling_per_stack: [1, 2, 3],
                    one_and_done: false,
                });

                renderItemModal(item);

                expect(incrementModalSessionId).toHaveBeenCalled();
            });
        });

        describe('XSS Prevention', () => {
            it('should escape name in chart aria-label', () => {
                const item = createBaseItem({
                    name: '<script>xss</script>',
                    scaling_per_stack: [1, 2, 3],
                    one_and_done: false,
                });
                const html = renderItemModal(item);

                // The aria-label should contain escaped content
                expect(html).toContain('aria-label="Scaling chart for &lt;script&gt;xss&lt;/script&gt;"');
            });

            it('should escape hidden mechanics content', () => {
                const item = createBaseItem({
                    hidden_mechanics: ['<img onerror=alert(1)>'],
                });
                renderItemModal(item);

                expect(escapeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
            });

            it('should escape synergy tags', () => {
                const item = createBaseItem({
                    synergies: ['<div onclick=alert(1)>Bad</div>'],
                });
                renderItemModal(item);

                expect(escapeHtml).toHaveBeenCalledWith('<div onclick=alert(1)>Bad</div>');
            });
        });

        describe('Edge Cases', () => {
            it('should handle empty item object', () => {
                const item = createBaseItem({
                    id: 'empty',
                    name: '',
                    description: '',
                    base_effect: '',
                    detailed_description: '',
                });
                const html = renderItemModal(item);

                expect(html).toBeDefined();
                expect(typeof html).toBe('string');
            });

            it('should handle item with all optional fields populated', () => {
                const item = createBaseItem({
                    one_and_done: true,
                    max_stacks: 5,
                    scaling_formula_type: 'hyperbolic',
                    hyperbolic_constant: 1.5,
                    hidden_mechanics: ['Mech 1', 'Mech 2'],
                    formula: 'x * 2',
                    synergies: ['Syn 1'],
                    anti_synergies: ['Anti 1'],
                    scaling_tracks: {
                        track1: { stat: 'Stat1', values: [1, 2, 3] },
                    },
                });
                const html = renderItemModal(item);

                expect(html).toContain('one-and-done-warning');
                expect(html).toContain('hyperbolic-warning');
                expect(html).toContain('hidden-mechanics');
                expect(html).toContain('item-formula');
                expect(html).toContain('synergies-section');
                expect(html).toContain('anti-synergies-section');
            });

            it('should handle undefined rarity gracefully', () => {
                const item = createBaseItem({ rarity: undefined as unknown as Item['rarity'] });
                const html = renderItemModal(item);

                expect(html).toContain('rarity-');
                expect(html).toBeDefined();
            });

            it('should handle undefined tier gracefully', () => {
                const item = createBaseItem({ tier: undefined as unknown as Item['tier'] });
                const html = renderItemModal(item);

                expect(html).toContain('tier-');
                expect(html).toBeDefined();
            });
        });
    });
});
