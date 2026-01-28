import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock the data service
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'crit_ring',
                    name: 'Critical Ring',
                    tier: 'S',
                    rarity: 'epic',
                    base_effect: 'Increases crit chance by 15%',
                    synergies: ['crit_gloves'],
                    stacks_well: true,
                },
                {
                    id: 'crit_gloves',
                    name: 'Critical Gloves',
                    tier: 'S',
                    rarity: 'epic',
                    base_effect: 'Increases crit damage by 25%',
                    synergies: ['crit_ring'],
                    stacks_well: true,
                },
                {
                    id: 'damage_ring',
                    name: 'Damage Ring',
                    tier: 'A',
                    rarity: 'rare',
                    base_effect: 'Increases damage by 10%',
                    synergies: [],
                    stacks_well: false,
                },
                {
                    id: 'hp_boost',
                    name: 'HP Boost',
                    tier: 'B',
                    rarity: 'common',
                    base_effect: 'Increases HP by 50',
                    synergies: [],
                    one_and_done: true,
                },
            ],
        },
        weapons: {
            weapons: [
                { id: 'sword', name: 'Sword', tier: 'A', playstyle: 'melee', attack_pattern: 'fast melee strikes' },
                { id: 'katana', name: 'Katana', tier: 'S', playstyle: 'melee', attack_pattern: 'quick melee slashes' },
                { id: 'bow', name: 'Bow', tier: 'A', playstyle: 'ranged', attack_pattern: 'ranged projectiles' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'tome_crit', name: 'Tome of Critical', tier: 'S', stat_affected: 'crit', priority: 1 },
                { id: 'tome_damage', name: 'Tome of Damage', tier: 'S', stat_affected: 'damage', priority: 1 },
                { id: 'tome_hp', name: 'Tome of Health', tier: 'A', stat_affected: 'hp', priority: 2 },
            ],
        },
        characters: {
            characters: [
                {
                    id: 'warrior',
                    name: 'Warrior',
                    tier: 'A',
                    playstyle: 'tank',
                    passive_ability: 'Increased HP and armor',
                    passive_description: 'Increased HP and armor',
                },
                {
                    id: 'berserker',
                    name: 'Berserker',
                    tier: 'S',
                    playstyle: 'tank',
                    passive_ability: 'HP increases damage',
                    passive_description: 'HP increases damage',
                },
                {
                    id: 'ranger',
                    name: 'Ranger',
                    tier: 'A',
                    playstyle: 'ranged',
                    passive_ability: 'Increased crit at range',
                    passive_description: 'Increased crit at range',
                },
            ],
        },
    },
}));

import { findSimilarItems, renderSimilarItemsSection } from '../../src/modules/similar-items.ts';

describe('Similar Items Module', () => {
    beforeEach(() => {
        createMinimalDOM();
    });

    describe('findSimilarItems()', () => {
        describe('for items', () => {
            it('should find items with same tier', () => {
                const similar = findSimilarItems('items', 'crit_ring');

                // crit_gloves has same tier (S) and shared synergies
                const critGloves = similar.find(s => s.entity.id === 'crit_gloves');
                expect(critGloves).toBeDefined();
                expect(critGloves.score).toBeGreaterThan(0);
            });

            it('should score items with shared synergies higher', () => {
                const similar = findSimilarItems('items', 'crit_ring');

                const critGloves = similar.find(s => s.entity.id === 'crit_gloves');
                const damageRing = similar.find(s => s.entity.id === 'damage_ring');

                // crit_gloves should score higher due to shared synergies
                expect(critGloves.score).toBeGreaterThan(damageRing?.score || 0);
            });

            it('should not include the source item in results', () => {
                const similar = findSimilarItems('items', 'crit_ring');

                const selfMatch = similar.find(s => s.entity.id === 'crit_ring');
                expect(selfMatch).toBeUndefined();
            });

            it('should return items sorted by score descending', () => {
                const similar = findSimilarItems('items', 'crit_ring');

                for (let i = 1; i < similar.length; i++) {
                    expect(similar[i - 1].score).toBeGreaterThanOrEqual(similar[i].score);
                }
            });

            it('should respect maxResults config', () => {
                const similar = findSimilarItems('items', 'crit_ring', { maxResults: 2 });

                expect(similar.length).toBeLessThanOrEqual(2);
            });

            it('should respect minScore config', () => {
                const similar = findSimilarItems('items', 'crit_ring', { minScore: 0.5 });

                similar.forEach(s => {
                    expect(s.score).toBeGreaterThanOrEqual(0.5);
                });
            });

            it('should include reasons for similarity', () => {
                const similar = findSimilarItems('items', 'crit_ring');

                similar.forEach(s => {
                    expect(s.reasons).toBeDefined();
                    expect(Array.isArray(s.reasons)).toBe(true);
                });
            });
        });

        describe('for weapons', () => {
            it('should find weapons with same playstyle', () => {
                const similar = findSimilarItems('weapons', 'sword');

                const katana = similar.find(s => s.entity.id === 'katana');
                expect(katana).toBeDefined();
                expect(katana.reasons).toContain('Same playstyle');
            });

            it('should score same-tier weapons higher', () => {
                const similar = findSimilarItems('weapons', 'sword');

                // bow has same tier (A) as sword
                const bow = similar.find(s => s.entity.id === 'bow');
                expect(bow).toBeDefined();
            });
        });

        describe('for tomes', () => {
            it('should find tomes with same stat affected', () => {
                const similar = findSimilarItems('tomes', 'tome_crit');

                // tome_damage has same tier and priority
                const tomeDamage = similar.find(s => s.entity.id === 'tome_damage');
                expect(tomeDamage).toBeDefined();
            });
        });

        describe('for characters', () => {
            it('should find characters with same playstyle', () => {
                const similar = findSimilarItems('characters', 'warrior');

                const berserker = similar.find(s => s.entity.id === 'berserker');
                expect(berserker).toBeDefined();
                expect(berserker.reasons).toContain('Same playstyle');
            });
        });

        describe('edge cases', () => {
            it('should return empty array for non-existent item', () => {
                const similar = findSimilarItems('items', 'nonexistent');
                expect(similar).toHaveLength(0);
            });

            it('should return empty array for shrines (not supported)', () => {
                const similar = findSimilarItems('shrines', 'shrine_power');
                expect(similar).toHaveLength(0);
            });
        });
    });

    describe('renderSimilarItemsSection()', () => {
        it('should return empty string when no similar items found', () => {
            const html = renderSimilarItemsSection('shrines', 'nonexistent');
            expect(html).toBe('');
        });

        it('should return HTML with similar items section', () => {
            const html = renderSimilarItemsSection('items', 'crit_ring');

            expect(html).toContain('similar-items-section');
            expect(html).toContain('Items Like This');
            expect(html).toContain('similar-item-card');
        });

        it('should include item names in HTML', () => {
            const html = renderSimilarItemsSection('items', 'crit_ring');

            expect(html).toContain('Critical Gloves');
        });

        it('should include similarity reason in HTML', () => {
            const html = renderSimilarItemsSection('items', 'crit_ring');

            // Should have some reason like "Same tier" or "Shared synergies"
            expect(html).toContain('similar-item-reason');
        });

        it('should include data attributes for click handling', () => {
            const html = renderSimilarItemsSection('items', 'crit_ring');

            expect(html).toContain('data-type="items"');
            expect(html).toContain('data-id=');
        });
    });
});
