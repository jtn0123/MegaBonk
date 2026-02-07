// ========================================
// Modal Entities Module Tests
// ========================================
// Tests for tome and shrine modal rendering functionality

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../src/modules/utils.ts', () => ({
    escapeHtml: vi.fn((str: string) => str?.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''),
}));

vi.mock('../../src/modules/formula-renderer.ts', () => ({
    renderFormulaDisplay: vi.fn((formula: string) => `<span class="formula">${formula}</span>`),
}));

// Mock chart module and modal-core
const mockGetChartModule = vi.fn();
const mockGetCurrentModalSessionId = vi.fn(() => 1);
const mockIncrementModalSessionId = vi.fn(() => 1);

vi.mock('../../src/modules/modal-core.ts', () => ({
    getChartModule: () => mockGetChartModule(),
    getCurrentModalSessionId: () => mockGetCurrentModalSessionId(),
    incrementModalSessionId: () => mockIncrementModalSessionId(),
}));

import { renderTomeModal, renderShrineModal } from '../../src/modules/modal-entities.ts';
import { escapeHtml } from '../../src/modules/utils.ts';
import type { Tome, Shrine } from '../../src/types/index.ts';

describe('Modal Entities Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        document.body.innerHTML = '';

        // Reset mock implementations
        mockGetChartModule.mockResolvedValue({
            calculateTomeProgression: vi.fn((tome) => tome.value_per_level ? [1, 2, 3, 4, 5] : null),
            createScalingChart: vi.fn(),
        });
        mockGetCurrentModalSessionId.mockReturnValue(1);
        mockIncrementModalSessionId.mockReturnValue(1);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('renderTomeModal', () => {
        const createBaseTome = (overrides: Partial<Tome> = {}): Tome => ({
            id: 'test-tome-1',
            name: 'Test Tome',
            description: 'A magical tome',
            tier: 'S',
            priority: 5,
            stat_affected: 'Damage',
            value_per_level: 10,
            ...overrides,
        });

        describe('Basic Rendering', () => {
            it('should render tome with tier badge', async () => {
                const tome = createBaseTome({ tier: 'A' });
                const html = await renderTomeModal(tome);

                expect(html).toContain('tier-A');
                expect(html).toContain('A Tier');
            });

            it('should render priority badge', async () => {
                const tome = createBaseTome({ priority: 8 });
                const html = await renderTomeModal(tome);

                expect(html).toContain('Priority: 8');
            });

            it('should render description', async () => {
                const tome = createBaseTome({ description: 'Increases your power' });
                const html = await renderTomeModal(tome);

                expect(html).toContain('Increases your power');
            });

            it('should render stat affected', async () => {
                const tome = createBaseTome({ stat_affected: 'Attack Speed' });
                const html = await renderTomeModal(tome);

                expect(html).toContain('tome-effect');
                expect(html).toContain('Stat');
                expect(html).toContain('Attack Speed');
            });
        });

        describe('Value Per Level', () => {
            it('should render value per level with formula', async () => {
                const tome = createBaseTome({ value_per_level: 15 });
                const html = await renderTomeModal(tome);

                expect(html).toContain('item-formula');
                expect(html).toContain('Per Level');
            });

            it('should handle string value_per_level', async () => {
                const tome = createBaseTome({ value_per_level: '5%' });
                const html = await renderTomeModal(tome);

                expect(html).toContain('Per Level');
            });
        });

        describe('Notes', () => {
            it('should render notes when present', async () => {
                const tome = createBaseTome({ notes: 'Works well with melee builds' });
                const html = await renderTomeModal(tome);

                expect(html).toContain('item-notes');
                expect(html).toContain('Works well with melee builds');
            });

            it('should not render notes section when absent', async () => {
                const tome = createBaseTome({ notes: undefined });
                const html = await renderTomeModal(tome);

                // Should only have the recommended_for notes section
                const notesCount = (html.match(/item-notes/g) || []).length;
                expect(notesCount).toBe(1); // Only recommended_for section
            });
        });

        describe('Recommended For', () => {
            it('should render recommended_for as comma-separated list', async () => {
                const tome = createBaseTome({
                    recommended_for: ['Warriors', 'Knights', 'Tanks'],
                });
                const html = await renderTomeModal(tome);

                expect(html).toContain('Recommended for');
                expect(html).toContain('Warriors, Knights, Tanks');
            });

            it('should show empty string when recommended_for is empty array', async () => {
                const tome = createBaseTome({ recommended_for: [] });
                const html = await renderTomeModal(tome);

                // Empty array joins to empty string, not "General use"
                // Only undefined/not-an-array triggers "General use"
                expect(html).toContain('Recommended for:');
            });

            it('should show "General use" when recommended_for is undefined', async () => {
                const tome = createBaseTome({ recommended_for: undefined });
                const html = await renderTomeModal(tome);

                expect(html).toContain('General use');
            });
        });

        describe('Chart Rendering', () => {
            it('should render graph container when progression exists', async () => {
                const tome = createBaseTome({ value_per_level: 10 });
                const html = await renderTomeModal(tome);

                expect(html).toContain('modal-graph-container');
                expect(html).toContain(`modal-tome-chart-${tome.id}`);
            });

            it('should increment modal session ID', async () => {
                const tome = createBaseTome();
                await renderTomeModal(tome);

                expect(mockIncrementModalSessionId).toHaveBeenCalled();
            });

            it('should not render graph when progression is null', async () => {
                mockGetChartModule.mockResolvedValue({
                    calculateTomeProgression: vi.fn(() => null),
                    createScalingChart: vi.fn(),
                });

                const tome = createBaseTome({ value_per_level: undefined });
                const html = await renderTomeModal(tome);

                expect(html).not.toContain('modal-graph-container');
            });
        });

        describe('Chart Module Failure', () => {
            it('should render basic content when chart module fails', async () => {
                mockGetChartModule.mockResolvedValue(null);

                const tome = createBaseTome();
                const html = await renderTomeModal(tome);

                expect(html).toContain('item-badges');
                expect(html).toContain('tier-S');
                expect(html).toContain('Charts unavailable');
            });
        });

        describe('Session ID Stale Check', () => {
            it('should return empty string when modal session changes during load', async () => {
                // Increment modal session after getChartModule is called
                mockGetChartModule.mockImplementation(async () => {
                    mockGetCurrentModalSessionId.mockReturnValue(2); // Session changed!
                    return {
                        calculateTomeProgression: vi.fn(() => [1, 2, 3]),
                        createScalingChart: vi.fn(),
                    };
                });
                mockIncrementModalSessionId.mockReturnValue(1);

                const tome = createBaseTome();
                const html = await renderTomeModal(tome);

                expect(html).toBe('');
            });
        });

        describe('XSS Prevention', () => {
            it('should escape tome tier', async () => {
                const tome = createBaseTome({ tier: 'S' });
                await renderTomeModal(tome);

                expect(escapeHtml).toHaveBeenCalledWith('S');
            });

            it('should escape description', async () => {
                const tome = createBaseTome({
                    description: '<script>alert("xss")</script>',
                });
                await renderTomeModal(tome);

                expect(escapeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
            });

            it('should escape stat_affected', async () => {
                const tome = createBaseTome({
                    stat_affected: '<img onerror=alert(1)>',
                });
                await renderTomeModal(tome);

                expect(escapeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
            });

            it('should escape notes', async () => {
                const tome = createBaseTome({
                    notes: '<div onclick=evil()>Click me</div>',
                });
                await renderTomeModal(tome);

                expect(escapeHtml).toHaveBeenCalledWith('<div onclick=evil()>Click me</div>');
            });

            it('should escape id in canvas element', async () => {
                const tome = createBaseTome({ id: '<script>bad</script>' });
                await renderTomeModal(tome);

                expect(escapeHtml).toHaveBeenCalledWith('<script>bad</script>');
            });
        });

        describe('Edge Cases', () => {
            it('should handle tome with minimal data', async () => {
                const tome: Tome = {
                    id: 'minimal',
                    name: 'Basic Tome',
                    description: '',
                    tier: 'C',
                };
                const html = await renderTomeModal(tome);

                expect(html).toBeDefined();
                expect(typeof html).toBe('string');
            });

            it('should handle zero priority', async () => {
                const tome = createBaseTome({ priority: 0 });
                const html = await renderTomeModal(tome);

                // Note: String(data.priority || '') returns '' for 0
                // This is current behavior - test documents it
                expect(html).toContain('Priority:');
            });

            it('should handle undefined priority', async () => {
                const tome = createBaseTome({ priority: undefined });
                const html = await renderTomeModal(tome);

                expect(html).toContain('Priority:');
            });

            it('should handle empty string values', async () => {
                const tome = createBaseTome({
                    description: '',
                    stat_affected: '',
                });
                const html = await renderTomeModal(tome);

                expect(html).toBeDefined();
            });
        });
    });

    describe('renderShrineModal', () => {
        const createBaseShrine = (overrides: Partial<Shrine> = {}): Shrine => ({
            id: 'test-shrine-1',
            name: 'Test Shrine',
            description: 'A mysterious shrine',
            tier: 'A',
            icon: '⛩️',
            ...overrides,
        });

        describe('Basic Rendering', () => {
            it('should render shrine with icon', () => {
                const shrine = createBaseShrine({ icon: '🏛️' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('shrine-icon-modal');
                expect(html).toContain('🏛️');
            });

            it('should render description', () => {
                const shrine = createBaseShrine({ description: 'Grants power' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('shrine-description-full');
                expect(html).toContain('Grants power');
            });
        });

        describe('Type Badge', () => {
            it('should render type badge with underscores replaced', () => {
                const shrine = createBaseShrine({ type: 'stat_upgrade' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('stat upgrade');
            });

            it('should not render type badge when absent', () => {
                const shrine = createBaseShrine({ type: undefined });
                const html = renderShrineModal(shrine);

                // Should not have type in the badge area
                expect(html).not.toContain('stat_upgrade');
            });
        });

        describe('Reusable Badge', () => {
            it('should show "Reusable" badge when reusable is true', () => {
                const shrine = createBaseShrine({ reusable: true });
                const html = renderShrineModal(shrine);

                expect(html).toContain('Reusable');
            });

            it('should show "One-time" badge when reusable is false', () => {
                const shrine = createBaseShrine({ reusable: false });
                const html = renderShrineModal(shrine);

                expect(html).toContain('One-time');
            });

            it('should not show reusable badge when undefined', () => {
                const shrine = createBaseShrine({ reusable: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Reusable');
                expect(html).not.toContain('One-time');
            });
        });

        describe('Reward Section', () => {
            it('should render reward when present', () => {
                const shrine = createBaseShrine({ reward: '+10% Damage' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('shrine-detail-section');
                expect(html).toContain('Reward');
                expect(html).toContain('+10% Damage');
            });

            it('should not render reward section when absent', () => {
                const shrine = createBaseShrine({ reward: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('>Reward<');
            });
        });

        describe('Activation Section', () => {
            it('should render activation when present', () => {
                const shrine = createBaseShrine({ activation: 'Press E to activate' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('Activation');
                expect(html).toContain('Press E to activate');
            });

            it('should not render activation section when absent', () => {
                const shrine = createBaseShrine({ activation: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Activation');
            });
        });

        describe('Spawn Count Section', () => {
            it('should render spawn count when present', () => {
                const shrine = createBaseShrine({ spawn_count: '1-3 per map' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('Spawn Rate');
                expect(html).toContain('1-3 per map');
            });

            it('should not render spawn count section when absent', () => {
                const shrine = createBaseShrine({ spawn_count: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Spawn Rate');
            });
        });

        describe('Best For Section', () => {
            it('should render best_for tags when present', () => {
                const shrine = createBaseShrine({
                    best_for: ['Tank builds', 'Support builds'],
                });
                const html = renderShrineModal(shrine);

                expect(html).toContain('Best For');
                expect(html).toContain('meta-tag');
                expect(html).toContain('Tank builds');
                expect(html).toContain('Support builds');
            });

            it('should not render best_for section when empty', () => {
                const shrine = createBaseShrine({ best_for: [] });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Best For');
            });
        });

        describe('Item Synergies Section', () => {
            it('should render item synergies when present', () => {
                const shrine = createBaseShrine({
                    synergies_items: ['Health Ring', 'Shield'],
                });
                const html = renderShrineModal(shrine);

                expect(html).toContain('Item Synergies');
                expect(html).toContain('synergy-tag');
                expect(html).toContain('Health Ring');
                expect(html).toContain('Shield');
            });

            it('should not render synergies section when empty', () => {
                const shrine = createBaseShrine({ synergies_items: [] });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Item Synergies');
            });
        });

        describe('Strategy Section', () => {
            it('should render strategy when present', () => {
                const shrine = createBaseShrine({
                    strategy: 'Save this for boss fights',
                });
                const html = renderShrineModal(shrine);

                expect(html).toContain('shrine-strategy');
                expect(html).toContain('Strategy');
                expect(html).toContain('Save this for boss fights');
            });

            it('should not render strategy section when absent', () => {
                const shrine = createBaseShrine({ strategy: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('Strategy');
            });
        });

        describe('Notes Section', () => {
            it('should render notes when present', () => {
                const shrine = createBaseShrine({
                    notes: 'Can only appear in dungeons',
                });
                const html = renderShrineModal(shrine);

                expect(html).toContain('item-notes');
                expect(html).toContain('Can only appear in dungeons');
            });

            it('should not render notes section when absent', () => {
                const shrine = createBaseShrine({ notes: undefined });
                const html = renderShrineModal(shrine);

                expect(html).not.toContain('item-notes');
            });
        });

        describe('XSS Prevention', () => {
            it('should escape icon', () => {
                const shrine = createBaseShrine({
                    icon: '<script>alert("xss")</script>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
            });

            it('should escape description', () => {
                const shrine = createBaseShrine({
                    description: '<img onerror=alert(1)>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
            });

            it('should escape type', () => {
                const shrine = createBaseShrine({
                    type: 'stat_upgrade' as Shrine['type'],
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalled();
            });

            it('should escape reward', () => {
                const shrine = createBaseShrine({
                    reward: '<div onclick=evil()>Click</div>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<div onclick=evil()>Click</div>');
            });

            it('should escape activation', () => {
                const shrine = createBaseShrine({
                    activation: '<a href="javascript:void(0)">Activate</a>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<a href="javascript:void(0)">Activate</a>');
            });

            it('should escape spawn_count', () => {
                const shrine = createBaseShrine({
                    spawn_count: '<b onmouseover=alert(1)>Spawn</b>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<b onmouseover=alert(1)>Spawn</b>');
            });

            it('should escape best_for items', () => {
                const shrine = createBaseShrine({
                    best_for: ['<script>bad</script>'],
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<script>bad</script>');
            });

            it('should escape synergies_items', () => {
                const shrine = createBaseShrine({
                    synergies_items: ['<iframe src="evil.com">'],
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<iframe src="evil.com">');
            });

            it('should escape strategy', () => {
                const shrine = createBaseShrine({
                    strategy: '<style>body{display:none}</style>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<style>body{display:none}</style>');
            });

            it('should escape notes', () => {
                const shrine = createBaseShrine({
                    notes: '<marquee>Annoying</marquee>',
                });
                renderShrineModal(shrine);

                expect(escapeHtml).toHaveBeenCalledWith('<marquee>Annoying</marquee>');
            });
        });

        describe('Edge Cases', () => {
            it('should handle shrine with minimal data', () => {
                const shrine: Shrine = {
                    id: 'minimal',
                    name: 'Basic Shrine',
                    description: '',
                    tier: 'C',
                };
                const html = renderShrineModal(shrine);

                expect(html).toBeDefined();
                expect(typeof html).toBe('string');
            });

            it('should handle shrine with all optional fields', () => {
                const shrine = createBaseShrine({
                    type: 'stat_upgrade_legendary',
                    reusable: true,
                    reward: 'Legendary stat boost',
                    activation: 'Auto-activate',
                    spawn_count: 'Rare',
                    best_for: ['Everyone'],
                    synergies_items: ['All items'],
                    strategy: 'Always activate',
                    notes: 'Very powerful',
                });
                const html = renderShrineModal(shrine);

                // Note: .replace('_', ' ') only replaces first underscore
                expect(html).toContain('stat upgrade_legendary');
                expect(html).toContain('Reusable');
                expect(html).toContain('Legendary stat boost');
                expect(html).toContain('Auto-activate');
                expect(html).toContain('Rare');
                expect(html).toContain('Everyone');
                expect(html).toContain('All items');
                expect(html).toContain('Always activate');
                expect(html).toContain('Very powerful');
            });

            it('should handle empty icon', () => {
                const shrine = createBaseShrine({ icon: '' });
                const html = renderShrineModal(shrine);

                expect(html).toContain('shrine-icon-modal');
            });

            it('should handle empty string values gracefully', () => {
                const shrine = createBaseShrine({
                    description: '',
                    reward: '',
                    activation: '',
                    strategy: '',
                    notes: '',
                });
                const html = renderShrineModal(shrine);

                expect(html).toBeDefined();
            });
        });
    });
});
