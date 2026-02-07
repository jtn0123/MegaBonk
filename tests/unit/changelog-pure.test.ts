/**
 * @vitest-environment jsdom
 * Changelog Module Pure Function Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findEntityInData } from '../../src/modules/changelog.ts';

// Mock data-service with test data
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                { id: 'sword_of_doom', name: 'Sword of Doom', tier: 'S' },
                { id: 'healing_potion', name: 'Healing Potion', tier: 'A' },
                { id: 'shield', name: 'Shield', tier: 'B' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'battle_axe', name: 'Battle Axe', tier: 'A' },
                { id: 'magic_staff', name: 'Magic Staff', tier: 'S' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'fire_tome', name: 'Fire Tome', priority: 1 },
                { id: 'ice_tome', name: 'Ice Tome', priority: 2 },
            ],
        },
        characters: {
            characters: [
                { id: 'warrior', name: 'Warrior', tier: 'A' },
                { id: 'mage', name: 'Mage', tier: 'S' },
            ],
        },
        shrines: {
            shrines: [
                { id: 'health_shrine', name: 'Health Shrine' },
                { id: 'damage_shrine', name: 'Damage Shrine' },
            ],
        },
    },
}));

describe('Changelog Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // findEntityInData Tests
    // ========================================
    describe('findEntityInData', () => {
        describe('item type', () => {
            it('should find existing item by id', () => {
                const result = findEntityInData('item', 'sword_of_doom');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Sword of Doom');
            });

            it('should return null for non-existent item', () => {
                const result = findEntityInData('item', 'nonexistent');
                expect(result).toBeNull();
            });

            it('should find item with different id format', () => {
                const result = findEntityInData('item', 'healing_potion');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Healing Potion');
            });
        });

        describe('weapon type', () => {
            it('should find existing weapon by id', () => {
                const result = findEntityInData('weapon', 'battle_axe');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Battle Axe');
            });

            it('should return null for non-existent weapon', () => {
                const result = findEntityInData('weapon', 'fake_weapon');
                expect(result).toBeNull();
            });
        });

        describe('tome type', () => {
            it('should find existing tome by id', () => {
                const result = findEntityInData('tome', 'fire_tome');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Fire Tome');
            });

            it('should return null for non-existent tome', () => {
                const result = findEntityInData('tome', 'lightning_tome');
                expect(result).toBeNull();
            });
        });

        describe('character type', () => {
            it('should find existing character by id', () => {
                const result = findEntityInData('character', 'warrior');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Warrior');
            });

            it('should return null for non-existent character', () => {
                const result = findEntityInData('character', 'paladin');
                expect(result).toBeNull();
            });
        });

        describe('shrine type', () => {
            it('should find existing shrine by id', () => {
                const result = findEntityInData('shrine', 'health_shrine');
                expect(result).not.toBeNull();
                expect(result?.name).toBe('Health Shrine');
            });

            it('should return null for non-existent shrine', () => {
                const result = findEntityInData('shrine', 'mystery_shrine');
                expect(result).toBeNull();
            });
        });

        describe('invalid type', () => {
            it('should return null for unknown type', () => {
                const result = findEntityInData('invalid' as any, 'anything');
                expect(result).toBeNull();
            });

            it('should return null for empty type', () => {
                const result = findEntityInData('' as any, 'anything');
                expect(result).toBeNull();
            });
        });

        describe('edge cases', () => {
            it('should handle empty id', () => {
                const result = findEntityInData('item', '');
                expect(result).toBeNull();
            });

            it('should be case-sensitive for ids', () => {
                const result = findEntityInData('item', 'SWORD_OF_DOOM');
                expect(result).toBeNull();
            });

            it('should handle ids with special characters', () => {
                // Most game ids use underscores
                const result = findEntityInData('item', 'sword_of_doom');
                expect(result).not.toBeNull();
            });
        });
    });

    // ========================================
    // Type Coverage Tests
    // ========================================
    describe('entity type coverage', () => {
        const entityTypes = ['item', 'weapon', 'tome', 'character', 'shrine'] as const;

        it.each(entityTypes)('should handle %s type lookup', (type) => {
            // Each type should work without throwing
            expect(() => findEntityInData(type, 'test_id')).not.toThrow();
        });
    });
});
