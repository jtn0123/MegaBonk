/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/tomes.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../../helpers/dom-setup.ts';

// Mock logger
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock charts
vi.mock('../../../src/modules/charts.ts', () => ({
    initializeItemCharts: vi.fn(),
    initializeTomeCharts: vi.fn(),
}));

// Mock data-service for empty state detection
vi.mock('../../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockReturnValue([
        { id: '1', name: 'Suggested Tome', tier: 'S' },
        { id: '2', name: 'Another Tome', tier: 'A' },
    ]),
}));

// Mock store
vi.mock('../../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('tomes'),
    setState: vi.fn(),
}));

// Mock favorites
vi.mock('../../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn().mockReturnValue([]),
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import { renderTomes } from '../../../src/modules/renderers/tomes.ts';

describe('renderers/tomes.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderTomes()', () => {
        const mockTome = {
            id: 'tome-1',
            name: 'Precision Tome',
            tier: 'A',
            priority: 2,
            stat_affected: 'Critical Hit Chance',
            value_per_level: '+1.5%',
            description: 'Increases your critical hit chance per level',
        };

        it('should render tome cards in container', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelectorAll('.tome-card').length).toBe(1);
        });

        it('should include item-card class for consistent styling', () => {
            renderTomes([mockTome] as any);

            const card = document.querySelector('.tome-card');
            expect(card?.classList.contains('item-card')).toBe(true);
        });

        it('should include tome name', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Precision Tome');
        });

        it('should set entity data attributes', () => {
            renderTomes([mockTome] as any);

            const card = document.querySelector('.tome-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('tome');
            expect(card?.dataset.entityId).toBe('tome-1');
        });

        it('should include stat affected', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Critical Hit Chance');
        });

        it('should include value per level', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('+1.5%');
        });

        it('should include description', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Increases your critical hit chance');
        });

        it('should include tier and priority in label', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('A Tier');
            expect(container?.innerHTML).toContain('Priority 2');
        });

        it('should render graph container for tomes with valid numeric value_per_level', () => {
            renderTomes([mockTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-container')).not.toBeNull();
            expect(container?.querySelector(`#tome-chart-${mockTome.id}`)).not.toBeNull();
        });

        it('should show placeholder for tomes without value_per_level', () => {
            const noValueTome = {
                ...mockTome,
                value_per_level: null,
            };
            renderTomes([noValueTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-placeholder')).not.toBeNull();
            expect(container?.innerHTML).toContain('No progression data');
        });

        it('should show placeholder for tomes with non-numeric value_per_level', () => {
            const textValueTome = {
                ...mockTome,
                value_per_level: 'Variable effect based on luck',
            };
            renderTomes([textValueTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-placeholder')).not.toBeNull();
        });

        it('should render graph for tomes with numeric string value', () => {
            const numericStringTome = {
                ...mockTome,
                value_per_level: '+10 damage per level',
            };
            renderTomes([numericStringTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-container')).not.toBeNull();
        });

        it('should render graph for tomes with numeric value_per_level', () => {
            const numericTome = {
                ...mockTome,
                value_per_level: 5,
            };
            renderTomes([numericTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-container')).not.toBeNull();
        });

        it('should render graph for tomes with negative numeric value', () => {
            const negativeTome = {
                ...mockTome,
                value_per_level: '-5% cooldown',
            };
            renderTomes([negativeTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-container')).not.toBeNull();
        });

        it('should render graph for tomes with decimal value', () => {
            const decimalTome = {
                ...mockTome,
                value_per_level: '+0.5% per level',
            };
            renderTomes([decimalTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-graph-container')).not.toBeNull();
        });

        it('should include clickable-card class', () => {
            renderTomes([mockTome] as any);

            const card = document.querySelector('.tome-card');
            expect(card?.classList.contains('clickable-card')).toBe(true);
        });

        it('should render empty state when no tomes', () => {
            renderTomes([]);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should render multiple tomes', () => {
            const tomes = [
                mockTome,
                { ...mockTome, id: 'tome-2', name: 'Power Tome' },
                { ...mockTome, id: 'tome-3', name: 'Speed Tome' },
            ];
            renderTomes(tomes as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelectorAll('.tome-card').length).toBe(3);
        });

        it('should escape HTML in tome names', () => {
            const xssTome = { ...mockTome, name: '<script>alert("xss")</script>' };
            renderTomes([xssTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in stat_affected', () => {
            const xssTome = { ...mockTome, stat_affected: '<img onerror="alert(1)" src="x">' };
            renderTomes([xssTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should escape HTML in description', () => {
            const xssTome = { ...mockTome, description: '<div onclick="evil()">Click me</div>' };
            renderTomes([xssTome] as any);

            const container = document.getElementById('tomesContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;div');
            expect(container?.innerHTML).toContain('&gt;');
            // Verify no actual onclick handler can execute
            const descElement = container?.querySelector('.item-description');
            expect(descElement?.querySelector('div[onclick]')).toBeNull();
        });

        it('should handle missing container gracefully', () => {
            document.getElementById('tomesContainer')?.remove();
            expect(() => renderTomes([mockTome] as any)).not.toThrow();
        });

        it('should clear container before rendering', () => {
            const container = document.getElementById('tomesContainer');
            if (container) {
                container.innerHTML = '<div class="old-content">Old content</div>';
            }

            renderTomes([mockTome] as any);

            expect(container?.querySelector('.old-content')).toBeNull();
            expect(container?.innerHTML).toContain('Precision Tome');
        });

        it('should handle tomes with missing optional fields', () => {
            const minimalTome = {
                id: 'minimal',
                name: 'Minimal Tome',
                tier: 'C',
                priority: 5,
                stat_affected: 'Unknown',
                value_per_level: '',
                description: '',
            };
            expect(() => renderTomes([minimalTome] as any)).not.toThrow();
        });

        it('should handle tomes with special characters in names', () => {
            const specialTome = {
                ...mockTome,
                name: "Ancient Scholar's Grimoire (Vol. III)",
            };
            renderTomes([specialTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Ancient');
            expect(container?.innerHTML).toContain('Scholar');
        });

        it('should render all tier types correctly', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];
            const tomes = tiers.map((tier, i) => ({
                ...mockTome,
                id: `tome-${i}`,
                tier,
            }));
            renderTomes(tomes as any);

            const container = document.getElementById('tomesContainer');
            for (const tier of tiers) {
                expect(container?.innerHTML).toContain(`${tier} Tier`);
            }
        });

        it('should render priority 1 correctly', () => {
            const priority1Tome = { ...mockTome, priority: 1 };
            renderTomes([priority1Tome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Priority 1');
        });

        it('should render high priority numbers', () => {
            const highPriorityTome = { ...mockTome, priority: 10 };
            renderTomes([highPriorityTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('Priority 10');
        });

        it('should generate entity image if tome has image', () => {
            const tomeWithImage = {
                ...mockTome,
                image: '/assets/tomes/precision.png',
            };
            renderTomes([tomeWithImage] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('picture')).not.toBeNull();
        });

        it('should handle tome without image', () => {
            const tomeNoImage = {
                ...mockTome,
                image: undefined,
            };
            renderTomes([tomeNoImage] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.querySelector('.tome-card')).not.toBeNull();
        });

        it('should render item-effect class for stat+value display', () => {
            renderTomes([mockTome] as any);

            const effect = document.querySelector('.item-effect');
            expect(effect).not.toBeNull();
            expect(effect?.textContent).toContain('Critical Hit Chance');
            expect(effect?.textContent).toContain('+1.5%');
        });

        it('should render item-description class for description', () => {
            renderTomes([mockTome] as any);

            const desc = document.querySelector('.item-description');
            expect(desc).not.toBeNull();
            expect(desc?.textContent).toContain('Increases your critical hit chance');
        });

        it('should convert numeric value_per_level to string for display', () => {
            const numericValueTome = {
                ...mockTome,
                value_per_level: 10,
            };
            renderTomes([numericValueTome] as any);

            const container = document.getElementById('tomesContainer');
            expect(container?.innerHTML).toContain('10');
        });
    });
});
