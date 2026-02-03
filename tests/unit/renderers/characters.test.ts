/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/characters.ts
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
        { id: '1', name: 'Suggested Character', tier: 'S' },
        { id: '2', name: 'Another Character', tier: 'A' },
    ]),
}));

// Mock store
vi.mock('../../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('characters'),
    setState: vi.fn(),
}));

// Mock favorites
vi.mock('../../../src/modules/favorites.ts', () => ({
    getFavorites: vi.fn().mockReturnValue([]),
    isFavorite: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import { renderCharacters } from '../../../src/modules/renderers/characters.ts';

describe('renderers/characters.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('renderCharacters()', () => {
        const mockCharacter = {
            id: 'char-1',
            name: 'CL4NK',
            tier: 'S',
            passive_ability: 'Critical Mastery',
            passive_description: 'Gains +5% critical hit chance for each stack of armor',
            starting_weapon: 'Rusty Sword',
            playstyle: 'Aggressive',
        };

        it('should render character cards in container', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.querySelectorAll('.character-card').length).toBe(1);
        });

        it('should include item-card class for consistent styling', () => {
            renderCharacters([mockCharacter] as any);

            const card = document.querySelector('.character-card');
            expect(card?.classList.contains('item-card')).toBe(true);
        });

        it('should include character name', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('CL4NK');
        });

        it('should set entity data attributes', () => {
            renderCharacters([mockCharacter] as any);

            const card = document.querySelector('.character-card') as HTMLElement;
            expect(card?.dataset.entityType).toBe('character');
            expect(card?.dataset.entityId).toBe('char-1');
        });

        it('should include passive ability name', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('Critical Mastery');
        });

        it('should include passive description', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('Gains +5% critical hit chance');
        });

        it('should generate tier label', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('tier-label');
            expect(container?.innerHTML).toContain('S Tier');
        });

        it('should include starting weapon as meta tag', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            const metaTags = container?.querySelectorAll('.meta-tag');
            expect(metaTags?.length).toBeGreaterThan(0);
            expect(container?.innerHTML).toContain('Rusty Sword');
        });

        it('should include playstyle as meta tag', () => {
            renderCharacters([mockCharacter] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('Aggressive');
        });

        it('should include clickable-card class', () => {
            renderCharacters([mockCharacter] as any);

            const card = document.querySelector('.character-card');
            expect(card?.classList.contains('clickable-card')).toBe(true);
        });

        it('should render empty state when no characters', () => {
            renderCharacters([]);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should render multiple characters', () => {
            const characters = [
                mockCharacter,
                { ...mockCharacter, id: 'char-2', name: 'Mage' },
                { ...mockCharacter, id: 'char-3', name: 'Rogue' },
            ];
            renderCharacters(characters as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.querySelectorAll('.character-card').length).toBe(3);
        });

        it('should escape HTML in character names', () => {
            const xssChar = { ...mockCharacter, name: '<script>alert("xss")</script>' };
            renderCharacters([xssChar] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in passive ability', () => {
            const xssChar = { ...mockCharacter, passive_ability: '<img onerror="alert(1)" src="x">' };
            renderCharacters([xssChar] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).not.toContain('<img onerror');
        });

        it('should escape HTML in passive description', () => {
            const xssChar = { ...mockCharacter, passive_description: '<div onclick="evil()">Click me</div>' };
            renderCharacters([xssChar] as any);

            const container = document.getElementById('charactersContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;div');
            expect(container?.innerHTML).toContain('&gt;');
            // Verify no actual onclick handler can execute
            const descElement = container?.querySelector('.item-description');
            expect(descElement?.querySelector('div[onclick]')).toBeNull();
        });

        it('should escape HTML in starting weapon', () => {
            const xssChar = { ...mockCharacter, starting_weapon: '<a href="javascript:evil()">Evil Link</a>' };
            renderCharacters([xssChar] as any);

            const container = document.getElementById('charactersContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;a');
            // Verify no actual href attribute can execute javascript
            const metaTags = container?.querySelectorAll('.meta-tag');
            metaTags?.forEach(tag => {
                expect(tag.querySelector('a[href^="javascript:"]')).toBeNull();
            });
        });

        it('should escape HTML in playstyle', () => {
            const xssChar = { ...mockCharacter, playstyle: '<b onmouseover="alert(1)">Bold</b>' };
            renderCharacters([xssChar] as any);

            const container = document.getElementById('charactersContainer');
            // The < and > should be escaped to prevent XSS
            expect(container?.innerHTML).toContain('&lt;b');
            // Verify no actual onmouseover handler can execute
            const metaTags = container?.querySelectorAll('.meta-tag');
            metaTags?.forEach(tag => {
                expect(tag.querySelector('b[onmouseover]')).toBeNull();
            });
        });

        it('should handle missing container gracefully', () => {
            document.getElementById('charactersContainer')?.remove();
            expect(() => renderCharacters([mockCharacter] as any)).not.toThrow();
        });

        it('should clear container before rendering', () => {
            const container = document.getElementById('charactersContainer');
            if (container) {
                container.innerHTML = '<div class="old-content">Old content</div>';
            }

            renderCharacters([mockCharacter] as any);

            expect(container?.querySelector('.old-content')).toBeNull();
            expect(container?.innerHTML).toContain('CL4NK');
        });

        it('should handle characters with missing optional fields', () => {
            const minimalChar = {
                id: 'minimal',
                name: 'Minimal Character',
                tier: 'C',
                passive_ability: '',
                passive_description: '',
                starting_weapon: '',
                playstyle: '',
            };
            expect(() => renderCharacters([minimalChar] as any)).not.toThrow();
        });

        it('should handle characters with special characters in names', () => {
            const specialChar = {
                ...mockCharacter,
                name: "Sir Knight's Honor (Tier III)",
            };
            renderCharacters([specialChar] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.innerHTML).toContain('Sir');
            expect(container?.innerHTML).toContain('Knight');
        });

        it('should render all tier types correctly', () => {
            const tiers = ['SS', 'S', 'A', 'B', 'C'];
            const characters = tiers.map((tier, i) => ({
                ...mockCharacter,
                id: `char-${i}`,
                tier,
            }));
            renderCharacters(characters as any);

            const container = document.getElementById('charactersContainer');
            for (const tier of tiers) {
                expect(container?.innerHTML).toContain(`${tier} Tier`);
            }
        });

        it('should generate entity image if character has image', () => {
            const charWithImage = {
                ...mockCharacter,
                image: '/assets/characters/cl4nk.png',
            };
            renderCharacters([charWithImage] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.querySelector('picture')).not.toBeNull();
        });

        it('should handle character without image', () => {
            const charNoImage = {
                ...mockCharacter,
                image: undefined,
            };
            renderCharacters([charNoImage] as any);

            const container = document.getElementById('charactersContainer');
            expect(container?.querySelector('.character-card')).not.toBeNull();
        });

        it('should render item-effect class for passive ability', () => {
            renderCharacters([mockCharacter] as any);

            const effect = document.querySelector('.item-effect');
            expect(effect).not.toBeNull();
            expect(effect?.textContent).toContain('Critical Mastery');
        });

        it('should render item-description class for passive description', () => {
            renderCharacters([mockCharacter] as any);

            const desc = document.querySelector('.item-description');
            expect(desc).not.toBeNull();
            expect(desc?.textContent).toContain('Gains +5%');
        });

        it('should render item-meta class for weapon and playstyle', () => {
            renderCharacters([mockCharacter] as any);

            const meta = document.querySelector('.item-meta');
            expect(meta).not.toBeNull();
            expect(meta?.querySelectorAll('.meta-tag').length).toBe(2);
        });

        it('should render different playstyles correctly', () => {
            const playstyles = ['Aggressive', 'Defensive', 'Balanced', 'Support', 'Glass Cannon'];
            const characters = playstyles.map((playstyle, i) => ({
                ...mockCharacter,
                id: `char-${i}`,
                playstyle,
            }));
            renderCharacters(characters as any);

            const container = document.getElementById('charactersContainer');
            for (const playstyle of playstyles) {
                expect(container?.innerHTML).toContain(playstyle);
            }
        });

        it('should render different starting weapons correctly', () => {
            const weapons = ['Rusty Sword', 'Magic Staff', 'Crossbow', 'Daggers', 'War Hammer'];
            const characters = weapons.map((weapon, i) => ({
                ...mockCharacter,
                id: `char-${i}`,
                starting_weapon: weapon,
            }));
            renderCharacters(characters as any);

            const container = document.getElementById('charactersContainer');
            for (const weapon of weapons) {
                expect(container?.innerHTML).toContain(weapon);
            }
        });

        it('should handle empty strings for passive fields', () => {
            const emptyPassiveChar = {
                ...mockCharacter,
                passive_ability: '',
                passive_description: '',
            };
            expect(() => renderCharacters([emptyPassiveChar] as any)).not.toThrow();

            const effect = document.querySelector('.item-effect');
            const desc = document.querySelector('.item-description');
            expect(effect).not.toBeNull();
            expect(desc).not.toBeNull();
        });
    });
});
