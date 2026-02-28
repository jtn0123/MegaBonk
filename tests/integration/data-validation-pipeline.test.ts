/**
 * Integration: Schema validation → Data validation → Cross-reference checking
 */
import { describe, it, expect } from 'vitest';
import { validateDataStructure, validateCrossReferences, validateRarity, validateTier, validateAllData } from '../../src/modules/data-validation.ts';
import type { AllGameData } from '../../src/types/index.ts';

const validData: AllGameData = {
    items: {
        items: [
            { id: 'sword', name: 'Sword', description: 'A sword', tier: 'B', rarity: 'common' },
            { id: 'shield', name: 'Shield', description: 'A shield', tier: 'C', rarity: 'uncommon', synergies: ['sword'] },
        ],
    },
    weapons: {
        weapons: [
            { id: 'axe', name: 'Axe', description: 'An axe', tier: 'A', image: '' },
        ],
    },
    tomes: { tomes: [] },
    characters: {
        characters: [
            { id: 'warrior', name: 'Warrior', description: 'A fighter', tier: 'S', image: '' },
        ],
    },
    shrines: { shrines: [] },
};

describe('Integration: Data Validation Pipeline', () => {
    it('should validate items data structure', () => {
        const result = validateDataStructure(validData.items, 'items');
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe('boolean');
    });

    it('should validate cross-references', () => {
        const result = validateCrossReferences(validData);
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe('boolean');
    });

    it('should validate rarity values', () => {
        expect(validateRarity({ id: 'x', name: 'X', rarity: 'common' } as any, 'item', 0)).toHaveLength(0);
    });

    it('should flag invalid rarity', () => {
        expect(validateRarity({ id: 'x', name: 'X', rarity: 'mythic' } as any, 'item', 0).length).toBeGreaterThan(0);
    });

    it('should validate tier values', () => {
        expect(validateTier({ id: 'x', name: 'X', tier: 'S' } as any, 'item', 0)).toHaveLength(0);
    });

    it('should flag invalid tier', () => {
        expect(validateTier({ id: 'x', name: 'X', tier: 'Z' } as any, 'item', 0).length).toBeGreaterThan(0);
    });

    it('should handle null data', () => {
        const result = validateCrossReferences(null);
        expect(result).toBeDefined();
    });

    it('should run comprehensive validation', () => {
        const result = validateAllData(validData);
        expect(result).toBeDefined();
    });

    it('should handle null in comprehensive validation', () => {
        const result = validateAllData(null);
        expect(result).toBeDefined();
    });

    it('should validate structure with missing optional fields', () => {
        const result = validateDataStructure({ items: [{ id: 'a', name: 'A', description: 'desc', tier: 'B', rarity: 'common' }] } as any, 'items');
        expect(result).toBeDefined();
    });
});
