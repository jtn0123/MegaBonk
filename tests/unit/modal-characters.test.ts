// ========================================
// Modal Characters Module Tests
// ========================================
// Tests for character modal rendering functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../src/modules/utils.ts', () => ({
    generateModalImage: vi.fn((data, name, type) => `<div class="modal-image" data-type="${type}">${name}</div>`),
    escapeHtml: vi.fn((str: string) => str?.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''),
}));

import { renderCharacterModal } from '../../src/modules/modal-characters.ts';
import { escapeHtml, generateModalImage } from '../../src/modules/utils.ts';
import type { Character } from '../../src/types/index.ts';

describe('Modal Characters Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('renderCharacterModal', () => {
        const createBaseCharacter = (overrides: Partial<Character> = {}): Character => ({
            id: 'test-char-1',
            name: 'Test Hero',
            tier: 'S',
            playstyle: 'Aggressive',
            passive_ability: 'Berserker Rage',
            passive_description: 'Gain damage when low health',
            starting_weapon: 'Iron Sword',
            base_hp: 100,
            base_damage: 10,
            ...overrides,
        });

        describe('Basic Rendering', () => {
            it('should render character with image', () => {
                const character = createBaseCharacter();
                const html = renderCharacterModal(character);

                expect(generateModalImage).toHaveBeenCalledWith(character, character.name, 'character');
                expect(html).toContain('modal-image');
            });

            it('should render tier badge', () => {
                const character = createBaseCharacter({ tier: 'A' });
                const html = renderCharacterModal(character);

                expect(html).toContain('tier-A');
                expect(html).toContain('A Tier');
            });

            it('should render playstyle badge', () => {
                const character = createBaseCharacter({ playstyle: 'Defensive' });
                const html = renderCharacterModal(character);

                expect(html).toContain('Defensive');
            });
        });

        describe('Passive Ability', () => {
            it('should render passive ability name', () => {
                const character = createBaseCharacter({
                    passive_ability: 'Shadow Step',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('character-passive');
                expect(html).toContain('Shadow Step');
            });

            it('should render passive ability description', () => {
                const character = createBaseCharacter({
                    passive_description: 'Dash through enemies to deal damage',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Dash through enemies to deal damage');
            });

            it('should handle missing passive ability', () => {
                const character = createBaseCharacter({
                    passive_ability: undefined,
                    passive_description: undefined,
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('character-passive');
            });
        });

        describe('Character Stats', () => {
            it('should render starting weapon', () => {
                const character = createBaseCharacter({
                    starting_weapon: 'Dragon Slayer',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('character-meta');
                expect(html).toContain('Starting Weapon');
                expect(html).toContain('Dragon Slayer');
            });

            it('should render base HP', () => {
                const character = createBaseCharacter({ base_hp: 150 });
                const html = renderCharacterModal(character);

                expect(html).toContain('Base HP');
                expect(html).toContain('150');
            });

            it('should render base damage', () => {
                const character = createBaseCharacter({ base_damage: 25 });
                const html = renderCharacterModal(character);

                expect(html).toContain('Base Damage');
                expect(html).toContain('25');
            });

            it('should handle zero base stats', () => {
                const character = createBaseCharacter({
                    base_hp: 0,
                    base_damage: 0,
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Base HP');
                expect(html).toContain('Base Damage');
            });
        });

        describe('Unlock Requirement', () => {
            it('should render unlock requirement when present', () => {
                const character = createBaseCharacter({
                    unlock_requirement: 'Complete Chapter 5',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Unlock');
                expect(html).toContain('Complete Chapter 5');
            });

            it('should not render unlock requirement when absent', () => {
                const character = createBaseCharacter({
                    unlock_requirement: undefined,
                });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('>Unlock:<');
            });

            it('should not render unlock requirement when null', () => {
                const character = createBaseCharacter({
                    unlock_requirement: null,
                });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('>Unlock:<');
            });
        });

        describe('Best For Section', () => {
            it('should render best_for tags when present', () => {
                const character = createBaseCharacter({
                    best_for: ['Boss fights', 'Speed runs'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('character-section');
                expect(html).toContain('Best For');
                expect(html).toContain('meta-tag');
                expect(html).toContain('Boss fights');
                expect(html).toContain('Speed runs');
            });

            it('should not render best_for section when empty', () => {
                const character = createBaseCharacter({ best_for: [] });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('Best For');
            });

            it('should not render best_for section when undefined', () => {
                const character = createBaseCharacter({ best_for: undefined });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('Best For');
            });
        });

        describe('Strengths and Weaknesses', () => {
            it('should render strengths list', () => {
                const character = createBaseCharacter({
                    strengths: ['High damage', 'Fast movement'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('strengths-weaknesses');
                expect(html).toContain('strengths');
                expect(html).toContain('Strengths');
                expect(html).toContain('High damage');
                expect(html).toContain('Fast movement');
            });

            it('should render weaknesses list', () => {
                const character = createBaseCharacter({
                    weaknesses: ['Low HP', 'Slow cooldowns'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('weaknesses');
                expect(html).toContain('Weaknesses');
                expect(html).toContain('Low HP');
                expect(html).toContain('Slow cooldowns');
            });

            it('should show "None listed" when strengths are empty', () => {
                const character = createBaseCharacter({ strengths: [] });
                const html = renderCharacterModal(character);

                // The strengths section should show "None listed"
                expect(html).toContain('None listed');
            });

            it('should show "None listed" when weaknesses are empty', () => {
                const character = createBaseCharacter({ weaknesses: [] });
                const html = renderCharacterModal(character);

                // The weaknesses section should show "None listed"
                expect(html).toContain('None listed');
            });

            it('should show "None listed" when strengths are undefined', () => {
                const character = createBaseCharacter({ strengths: undefined });
                const html = renderCharacterModal(character);

                expect(html).toContain('None listed');
            });

            it('should show "None listed" when weaknesses are undefined', () => {
                const character = createBaseCharacter({ weaknesses: undefined });
                const html = renderCharacterModal(character);

                expect(html).toContain('None listed');
            });
        });

        describe('Synergies', () => {
            it('should render weapon synergies', () => {
                const character = createBaseCharacter({
                    synergies_weapons: ['Bow', 'Crossbow'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('synergies-section');
                expect(html).toContain('Weapons');
                expect(html).toContain('synergy-tag');
                expect(html).toContain('Bow');
                expect(html).toContain('Crossbow');
            });

            it('should render item synergies', () => {
                const character = createBaseCharacter({
                    synergies_items: ['Speed Boots', 'Power Ring'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Items');
                expect(html).toContain('Speed Boots');
                expect(html).toContain('Power Ring');
            });

            it('should render tome synergies', () => {
                const character = createBaseCharacter({
                    synergies_tomes: ['Tome of Speed', 'Tome of Power'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Tomes');
                expect(html).toContain('Tome of Speed');
                expect(html).toContain('Tome of Power');
            });

            it('should render all synergy types together', () => {
                const character = createBaseCharacter({
                    synergies_weapons: ['Weapon 1'],
                    synergies_items: ['Item 1'],
                    synergies_tomes: ['Tome 1'],
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Weapons');
                expect(html).toContain('Items');
                expect(html).toContain('Tomes');
            });

            it('should not render empty synergy sections', () => {
                const character = createBaseCharacter({
                    synergies_weapons: [],
                    synergies_items: [],
                    synergies_tomes: [],
                });
                const html = renderCharacterModal(character);

                // Synergies section is always present (h3), but individual groups should not be
                expect(html).toContain('synergies-section');
                expect(html).not.toContain('synergy-group');
            });
        });

        describe('Build Tips', () => {
            it('should render build tips when present', () => {
                const character = createBaseCharacter({
                    build_tips: 'Focus on speed items for mobility',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('build-tips');
                expect(html).toContain('Build Tips');
                expect(html).toContain('Focus on speed items for mobility');
            });

            it('should not render build tips section when absent', () => {
                const character = createBaseCharacter({ build_tips: undefined });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('build-tips');
            });

            it('should not render build tips section when empty', () => {
                const character = createBaseCharacter({ build_tips: '' });
                const html = renderCharacterModal(character);

                expect(html).not.toContain('build-tips');
            });
        });

        describe('XSS Prevention', () => {
            it('should escape tier', () => {
                const character = createBaseCharacter({ tier: 'S' });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('S');
            });

            it('should escape playstyle', () => {
                const character = createBaseCharacter({
                    playstyle: '<script>alert("xss")</script>',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
            });

            it('should escape passive ability', () => {
                const character = createBaseCharacter({
                    passive_ability: '<img onerror=alert(1)>',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
            });

            it('should escape passive description', () => {
                const character = createBaseCharacter({
                    passive_description: '<div onclick=evil()>Click</div>',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<div onclick=evil()>Click</div>');
            });

            it('should escape starting weapon', () => {
                const character = createBaseCharacter({
                    starting_weapon: '<a href="javascript:void(0)">Weapon</a>',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<a href="javascript:void(0)">Weapon</a>');
            });

            it('should escape unlock requirement', () => {
                const character = createBaseCharacter({
                    unlock_requirement: '<style>body{display:none}</style>',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<style>body{display:none}</style>');
            });

            it('should escape best_for items', () => {
                const character = createBaseCharacter({
                    best_for: ['<script>bad</script>'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<script>bad</script>');
            });

            it('should escape strengths', () => {
                const character = createBaseCharacter({
                    strengths: ['<iframe src="evil.com">'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<iframe src="evil.com">');
            });

            it('should escape weaknesses', () => {
                const character = createBaseCharacter({
                    weaknesses: ['<marquee>Annoying</marquee>'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<marquee>Annoying</marquee>');
            });

            it('should escape synergy weapons', () => {
                const character = createBaseCharacter({
                    synergies_weapons: ['<b onmouseover=alert(1)>Hover</b>'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<b onmouseover=alert(1)>Hover</b>');
            });

            it('should escape synergy items', () => {
                const character = createBaseCharacter({
                    synergies_items: ['<form action=evil.com>Form</form>'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<form action=evil.com>Form</form>');
            });

            it('should escape synergy tomes', () => {
                const character = createBaseCharacter({
                    synergies_tomes: ['<input onfocus=alert(1)>'],
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<input onfocus=alert(1)>');
            });

            it('should escape build tips', () => {
                const character = createBaseCharacter({
                    build_tips: '<object data="evil.swf">',
                });
                renderCharacterModal(character);

                expect(escapeHtml).toHaveBeenCalledWith('<object data="evil.swf">');
            });
        });

        describe('Edge Cases', () => {
            it('should handle character with minimal data', () => {
                const character: Character = {
                    id: 'minimal',
                    name: 'Basic Hero',
                    tier: 'C',
                };
                const html = renderCharacterModal(character);

                expect(html).toBeDefined();
                expect(typeof html).toBe('string');
                expect(html).toContain('Basic Hero');
            });

            it('should handle character with all optional fields', () => {
                const character = createBaseCharacter({
                    description: 'A mighty hero',
                    playstyle: 'Tank',
                    passive_ability: 'Shield Wall',
                    passive_description: 'Block all damage',
                    starting_weapon: 'Shield',
                    base_hp: 200,
                    base_damage: 5,
                    unlock_requirement: 'Complete game',
                    best_for: ['Survival'],
                    strengths: ['Tanky'],
                    weaknesses: ['Slow'],
                    synergies_weapons: ['Shield'],
                    synergies_items: ['Armor'],
                    synergies_tomes: ['Health Tome'],
                    build_tips: 'Stack health',
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Tank');
                expect(html).toContain('Shield Wall');
                expect(html).toContain('Block all damage');
                expect(html).toContain('Shield');
                expect(html).toContain('200');
                expect(html).toContain('5');
                expect(html).toContain('Complete game');
                expect(html).toContain('Survival');
                expect(html).toContain('Tanky');
                expect(html).toContain('Slow');
                expect(html).toContain('Armor');
                expect(html).toContain('Health Tome');
                expect(html).toContain('Stack health');
            });

            it('should handle empty string playstyle', () => {
                const character = createBaseCharacter({ playstyle: '' });
                const html = renderCharacterModal(character);

                expect(html).toBeDefined();
            });

            it('should handle undefined stats', () => {
                const character = createBaseCharacter({
                    base_hp: undefined,
                    base_damage: undefined,
                    starting_weapon: undefined,
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Starting Weapon');
                expect(html).toContain('Base HP');
                expect(html).toContain('Base Damage');
            });

            it('should handle character with very long synergy lists', () => {
                const character = createBaseCharacter({
                    synergies_weapons: Array(20).fill('Weapon'),
                    synergies_items: Array(20).fill('Item'),
                    synergies_tomes: Array(20).fill('Tome'),
                });
                const html = renderCharacterModal(character);

                expect(html).toContain('Weapons');
                expect(html).toContain('Items');
                expect(html).toContain('Tomes');
            });
        });
    });
});
