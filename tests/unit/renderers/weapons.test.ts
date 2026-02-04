/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/weapons.ts
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
        { id: '1', name: 'Suggested Weapon', tier: 'S' },
        { id: '2', name: 'Another Weapon', tier: 'A' },
    ]),
}));

// Mock store
vi.mock('../../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('weapons'),
    setState: vi.fn(),
}));

// Mock favorites
vi.mock('../../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn().mockReturnValue([]),
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import { renderWeapons } from '../../../src/modules/renderers/weapons.ts';

describe('renderers/weapons.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderWeapons()', () => {
        const mockWeapon = {
            id: 'weapon-1',
            name: 'Katana',
            tier: 'S',
            attack_pattern: 'Melee slash with high crit chance',
            description: 'A fast and deadly blade from the east',
            upgradeable_stats: ['damage', 'speed', 'crit'],
        };

        it('should render weapon cards in container', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.querySelectorAll('.weapon-card').length).toBe(1);
        });

        it('should include item-card class for consistent styling', () => {
            renderWeapons([mockWeapon] as any);

            const card = document.querySelector('.weapon-card');
            expect(card?.classList.contains('item-card')).toBe(true);
        });

        it('should include weapon name', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('Katana');
        });

        it('should set entity data attributes', () => {
            renderWeapons([mockWeapon] as any);

            const card = document.querySelector('.weapon-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('weapon');
            expect(card?.dataset.entityId).toBe('weapon-1');
        });

        it('should include attack pattern', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('Melee slash with high crit chance');
        });

        it('should include description', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('A fast and deadly blade');
        });

        it('should generate tier label', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('tier-label');
            expect(container?.innerHTML).toContain('S Tier');
        });

        it('should render upgradeable stats as meta tags', () => {
            renderWeapons([mockWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            const metaTags = container?.querySelectorAll('.meta-tag');
            expect(metaTags?.length).toBeGreaterThan(0);
            expect(container?.innerHTML).toContain('damage');
            expect(container?.innerHTML).toContain('speed');
            expect(container?.innerHTML).toContain('crit');
        });

        it('should handle upgradeable_stats as string (not array)', () => {
            const weaponWithStringStat = {
                ...mockWeapon,
                upgradeable_stats: 'damage',
            };
            renderWeapons([weaponWithStringStat] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('damage');
        });

        it('should handle missing upgradeable_stats', () => {
            const weaponNoStats = {
                ...mockWeapon,
                upgradeable_stats: undefined,
            };
            expect(() => renderWeapons([weaponNoStats] as any)).not.toThrow();
        });

        it('should handle null upgradeable_stats', () => {
            const weaponNullStats = {
                ...mockWeapon,
                upgradeable_stats: null,
            };
            expect(() => renderWeapons([weaponNullStats] as any)).not.toThrow();
        });

        it('should handle empty upgradeable_stats array', () => {
            const weaponEmptyStats = {
                ...mockWeapon,
                upgradeable_stats: [],
            };
            expect(() => renderWeapons([weaponEmptyStats] as any)).not.toThrow();
        });

        it('should include clickable-card class', () => {
            renderWeapons([mockWeapon] as any);

            const card = document.querySelector('.weapon-card');
            expect(card?.classList.contains('clickable-card')).toBe(true);
        });

        it('should render empty state when no weapons', () => {
            renderWeapons([]);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should render multiple weapons', () => {
            const weapons = [
                mockWeapon,
                { ...mockWeapon, id: 'weapon-2', name: 'Longsword' },
                { ...mockWeapon, id: 'weapon-3', name: 'Crossbow' },
            ];
            renderWeapons(weapons as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.querySelectorAll('.weapon-card').length).toBe(3);
        });

        it('should escape HTML in weapon names', () => {
            const xssWeapon = { ...mockWeapon, name: '<script>alert("xss")</script>' };
            renderWeapons([xssWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in attack pattern', () => {
            const xssWeapon = { ...mockWeapon, attack_pattern: '<img onerror="alert(1)" src="x">' };
            renderWeapons([xssWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should escape HTML in description', () => {
            const xssWeapon = { ...mockWeapon, description: '<div onclick="evil()">Click me</div>' };
            renderWeapons([xssWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;div');
            expect(container?.innerHTML).toContain('&gt;');
            // Should NOT contain an actual div tag with onclick inside a data field
            const descElement = container?.querySelector('.item-description');
            // The textContent should contain the raw string since it's text, not parsed HTML
            expect(descElement?.textContent).toContain('onclick');
            // But we should verify that no actual onclick handler can execute
            expect(descElement?.querySelector('div[onclick]')).toBeNull();
        });

        it('should handle missing container gracefully', () => {
            document.getElementById('weaponsContainer')?.remove();
            expect(() => renderWeapons([mockWeapon] as any)).not.toThrow();
        });

        it('should clear container before rendering', () => {
            const container = document.getElementById('weaponsContainer');
            if (container) {
                container.innerHTML = '<div class="old-content">Old content</div>';
            }

            renderWeapons([mockWeapon] as any);

            expect(container?.querySelector('.old-content')).toBeNull();
            expect(container?.innerHTML).toContain('Katana');
        });

        it('should handle weapons with missing optional fields', () => {
            const minimalWeapon = {
                id: 'minimal',
                name: 'Minimal Weapon',
                tier: 'C',
                attack_pattern: '',
                description: '',
            };
            expect(() => renderWeapons([minimalWeapon] as any)).not.toThrow();
        });

        it('should handle weapons with special characters in names', () => {
            const specialWeapon = {
                ...mockWeapon,
                name: "Dragon's Fang & Fire (Mk. II)",
            };
            renderWeapons([specialWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            expect(container?.innerHTML).toContain('Dragon');
            expect(container?.innerHTML).toContain('Fang');
        });

        it('should render all tier types correctly', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];
            const weapons = tiers.map((tier, i) => ({
                ...mockWeapon,
                id: `weapon-${i}`,
                tier,
            }));
            renderWeapons(weapons as any);

            const container = document.getElementById('weaponsContainer');
            for (const tier of tiers) {
                expect(container?.innerHTML).toContain(`${tier} Tier`);
            }
        });

        it('should limit meta tags if specified', () => {
            const manyStatsWeapon = {
                ...mockWeapon,
                upgradeable_stats: ['stat1', 'stat2', 'stat3', 'stat4', 'stat5', 'stat6'],
            };
            renderWeapons([manyStatsWeapon] as any);

            const container = document.getElementById('weaponsContainer');
            const metaTags = container?.querySelectorAll('.meta-tag');
            // Should limit to 4 (based on generateMetaTags call)
            expect(metaTags?.length).toBeLessThanOrEqual(4);
        });

        it('should generate entity image if weapon has image', () => {
            const weaponWithImage = {
                ...mockWeapon,
                image: '/assets/weapons/katana.png',
            };
            renderWeapons([weaponWithImage] as any);

            const container = document.getElementById('weaponsContainer');
            // Should have picture element for responsive image
            expect(container?.querySelector('picture')).not.toBeNull();
        });

        it('should handle weapon without image', () => {
            const weaponNoImage = {
                ...mockWeapon,
                image: undefined,
            };
            renderWeapons([weaponNoImage] as any);

            // Should not throw and should still render the card
            const container = document.getElementById('weaponsContainer');
            expect(container?.querySelector('.weapon-card')).not.toBeNull();
        });

        it('should render item-effect class for attack pattern', () => {
            renderWeapons([mockWeapon] as any);

            const effect = document.querySelector('.item-effect');
            expect(effect).not.toBeNull();
            expect(effect?.textContent).toContain('Melee slash');
        });

        it('should render item-description class for description', () => {
            renderWeapons([mockWeapon] as any);

            const desc = document.querySelector('.item-description');
            expect(desc).not.toBeNull();
            expect(desc?.textContent).toContain('A fast and deadly blade');
        });

        it('should render item-meta class for stats', () => {
            renderWeapons([mockWeapon] as any);

            const meta = document.querySelector('.item-meta');
            expect(meta).not.toBeNull();
        });
    });
});
