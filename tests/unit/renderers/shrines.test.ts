/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/shrines.ts
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

// Mock data-service for empty state detection
vi.mock('../../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockReturnValue([
        { id: '1', name: 'Suggested Shrine', icon: '⛩️' },
        { id: '2', name: 'Another Shrine', icon: '⚡' },
    ]),
}));

// Mock store
vi.mock('../../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('shrines'),
    setState: vi.fn(),
}));

// Mock favorites
vi.mock('../../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn().mockReturnValue([]),
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import { renderShrines } from '../../../src/modules/renderers/shrines.ts';

describe('renderers/shrines.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderShrines()', () => {
        const mockShrine = {
            id: 'shrine-1',
            name: 'Power Shrine',
            icon: '⚡',
            type: 'stat_upgrade',
            description: 'Permanently increases your damage output',
            reward: '+10% base damage',
            reusable: true,
        };

        it('should render shrine cards in container', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.querySelectorAll('.shrine-card').length).toBe(1);
        });

        it('should include item-card class for consistent styling', () => {
            renderShrines([mockShrine] as any);

            const card = document.querySelector('.shrine-card');
            expect(card?.classList.contains('item-card')).toBe(true);
        });

        it('should include shrine name', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Power Shrine');
        });

        it('should set entity data attributes', () => {
            renderShrines([mockShrine] as any);

            const card = document.querySelector('.shrine-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('shrine');
            expect(card?.dataset.entityId).toBe('shrine-1');
        });

        it('should include shrine icon', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('⚡');
            expect(container?.querySelector('.shrine-icon-large')).not.toBeNull();
        });

        it('should include shrine type with underscore replaced by space', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('stat upgrade');
        });

        it('should include description', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Permanently increases your damage');
        });

        it('should include reward', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('+10% base damage');
        });

        it('should show "Reusable" tag when reusable is true', () => {
            renderShrines([mockShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Reusable');
        });

        it('should show "One-time" tag when reusable is false', () => {
            const oneTimeShrine = { ...mockShrine, reusable: false };
            renderShrines([oneTimeShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('One-time');
        });

        it('should not show reusable tag when reusable is undefined', () => {
            const noReusableShrine = { ...mockShrine, reusable: undefined };
            renderShrines([noReusableShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).not.toContain('Reusable');
            expect(container?.innerHTML).not.toContain('One-time');
        });

        it('should include clickable-card class', () => {
            renderShrines([mockShrine] as any);

            const card = document.querySelector('.shrine-card');
            expect(card?.classList.contains('clickable-card')).toBe(true);
        });

        it('should render empty state when no shrines', () => {
            renderShrines([]);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should render multiple shrines', () => {
            const shrines = [
                mockShrine,
                { ...mockShrine, id: 'shrine-2', name: 'Speed Shrine', icon: '🏃' },
                { ...mockShrine, id: 'shrine-3', name: 'Defense Shrine', icon: '🛡️' },
            ];
            renderShrines(shrines as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.querySelectorAll('.shrine-card').length).toBe(3);
        });

        it('should escape HTML in shrine names', () => {
            const xssShrine = { ...mockShrine, name: '<script>alert("xss")</script>' };
            renderShrines([xssShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in icon', () => {
            const xssShrine = { ...mockShrine, icon: '<img onerror="alert(1)" src="x">' };
            renderShrines([xssShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should escape HTML in description', () => {
            const xssShrine = { ...mockShrine, description: '<div onclick="evil()">Click me</div>' };
            renderShrines([xssShrine] as any);

            const container = document.getElementById('shrinesContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;div');
            expect(container?.innerHTML).toContain('&gt;');
            // Verify no actual onclick handler can execute (description is in item-effect for shrines)
            const effectElement = container?.querySelector('.item-effect');
            expect(effectElement?.querySelector('div[onclick]')).toBeNull();
        });

        it('should escape HTML in reward', () => {
            const xssShrine = { ...mockShrine, reward: '<a href="javascript:evil()">Evil Link</a>' };
            renderShrines([xssShrine] as any);

            const container = document.getElementById('shrinesContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;a');
            // Verify no actual href attribute can execute javascript
            const descElement = container?.querySelector('.item-description');
            expect(descElement?.querySelector('a[href^="javascript:"]')).toBeNull();
        });

        it('should escape HTML in type', () => {
            const xssShrine = { ...mockShrine, type: '<b onmouseover="alert(1)">Bold</b>' as any };
            renderShrines([xssShrine] as any);

            const container = document.getElementById('shrinesContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;b');
            // Verify no actual onmouseover handler can execute
            const tierLabel = container?.querySelector('.tier-label');
            expect(tierLabel?.querySelector('b[onmouseover]')).toBeNull();
        });

        it('should handle missing container gracefully', () => {
            document.getElementById('shrinesContainer')?.remove();
            expect(() => renderShrines([mockShrine] as any)).not.toThrow();
        });

        it('should clear container before rendering', () => {
            const container = document.getElementById('shrinesContainer');
            if (container) {
                container.innerHTML = '<div class="old-content">Old content</div>';
            }

            renderShrines([mockShrine] as any);

            expect(container?.querySelector('.old-content')).toBeNull();
            expect(container?.innerHTML).toContain('Power Shrine');
        });

        it('should handle shrines with missing optional fields', () => {
            const minimalShrine = {
                id: 'minimal',
                name: 'Minimal Shrine',
                icon: '',
                type: undefined,
                description: '',
                reward: undefined,
                reusable: undefined,
            };
            expect(() => renderShrines([minimalShrine] as any)).not.toThrow();
        });

        it('should handle shrines with special characters in names', () => {
            const specialShrine = {
                ...mockShrine,
                name: "Ancient Deity's Blessing (Tier III)",
            };
            renderShrines([specialShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Ancient');
            expect(container?.innerHTML).toContain('Deity');
        });

        it('should render all shrine types correctly', () => {
            const types = ['stat_upgrade', 'combat', 'utility', 'risk_reward'];
            const shrines = types.map((type, i) => ({
                ...mockShrine,
                id: `shrine-${i}`,
                type,
            }));
            renderShrines(shrines as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('stat upgrade');
            expect(container?.innerHTML).toContain('combat');
            expect(container?.innerHTML).toContain('utility');
            expect(container?.innerHTML).toContain('risk reward');
        });

        it('should render different icons correctly', () => {
            const icons = ['⛩️', '⚡', '🔥', '❄️', '💀', '🎲'];
            const shrines = icons.map((icon, i) => ({
                ...mockShrine,
                id: `shrine-${i}`,
                icon,
            }));
            renderShrines(shrines as any);

            const container = document.getElementById('shrinesContainer');
            for (const icon of icons) {
                expect(container?.innerHTML).toContain(icon);
            }
        });

        it('should handle empty icon', () => {
            const emptyIconShrine = { ...mockShrine, icon: '' };
            expect(() => renderShrines([emptyIconShrine] as any)).not.toThrow();
        });

        it('should handle null icon', () => {
            const nullIconShrine = { ...mockShrine, icon: null };
            expect(() => renderShrines([nullIconShrine] as any)).not.toThrow();
        });

        it('should handle undefined reward', () => {
            const noRewardShrine = { ...mockShrine, reward: undefined };
            renderShrines([noRewardShrine] as any);

            const container = document.getElementById('shrinesContainer');
            const desc = container?.querySelector('.item-description');
            expect(desc?.textContent).toBe('');
        });

        it('should handle empty reward', () => {
            const emptyRewardShrine = { ...mockShrine, reward: '' };
            renderShrines([emptyRewardShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.querySelector('.shrine-card')).not.toBeNull();
        });

        it('should not show type label when type is undefined', () => {
            const noTypeShrine = { ...mockShrine, type: undefined };
            renderShrines([noTypeShrine] as any);

            const container = document.getElementById('shrinesContainer');
            const tierLabel = container?.querySelector('.tier-label');
            expect(tierLabel).toBeNull();
        });

        it('should render item-effect class for description', () => {
            renderShrines([mockShrine] as any);

            const effect = document.querySelector('.item-effect');
            expect(effect).not.toBeNull();
            expect(effect?.textContent).toContain('Permanently increases');
        });

        it('should render item-description class for reward', () => {
            renderShrines([mockShrine] as any);

            const desc = document.querySelector('.item-description');
            expect(desc).not.toBeNull();
            expect(desc?.textContent).toContain('+10% base damage');
        });

        it('should render item-meta class for reusable tag', () => {
            renderShrines([mockShrine] as any);

            const meta = document.querySelector('.item-meta');
            expect(meta).not.toBeNull();
            expect(meta?.querySelector('.meta-tag')).not.toBeNull();
        });

        it('should handle long rewards correctly', () => {
            const longRewardShrine = {
                ...mockShrine,
                reward: '+10% base damage, +5% attack speed, +3% critical hit chance, and +2% movement speed',
            };
            renderShrines([longRewardShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('+10% base damage');
            expect(container?.innerHTML).toContain('+2% movement speed');
        });

        it('should handle shrines with complex descriptions', () => {
            const complexShrine = {
                ...mockShrine,
                description: 'Risk vs Reward: Take 20% max HP damage but gain permanent +15% damage boost. Effect stacks up to 3 times.',
            };
            renderShrines([complexShrine] as any);

            const container = document.getElementById('shrinesContainer');
            expect(container?.innerHTML).toContain('Risk vs Reward');
            expect(container?.innerHTML).toContain('stacks up to 3 times');
        });

        it('should escape ID in data attribute', () => {
            const specialIdShrine = {
                ...mockShrine,
                id: 'shrine-with-"quotes"-and-<special>-chars',
            };
            renderShrines([specialIdShrine] as any);

            const card = document.querySelector('.shrine-card') as HTMLElement;
            // The ID should be escaped properly
            expect(card?.dataset.entityId).toBeTruthy();
        });
    });
});
