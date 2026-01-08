import { describe, it, expect, beforeEach } from 'vitest';
import { createMockItem, createMockWeapon, createMockCharacter, createMockTome, createMockShrine } from '../helpers/mock-data.js';

/**
 * Data validation functions for testing data integrity
 */
const VALID_TIERS = ['SS', 'S', 'A', 'B', 'C'];
const VALID_RARITIES = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
const VALID_SHRINE_TYPES = ['offensive', 'defensive', 'utility', 'special'];
const VALID_SCALING_TYPES = ['linear', 'hyperbolic', 'diminishing', 'one_and_done', 'fixed'];

function validateItem(item) {
  const errors = [];

  // Required fields
  if (!item.id) errors.push('Missing id');
  if (!item.name) errors.push('Missing name');

  // Type validation
  if (typeof item.id !== 'string') errors.push('id must be a string');
  if (typeof item.name !== 'string') errors.push('name must be a string');

  // Tier validation
  if (item.tier && !VALID_TIERS.includes(item.tier)) {
    errors.push(`Invalid tier: ${item.tier}`);
  }

  // Rarity validation
  if (item.rarity && !VALID_RARITIES.includes(item.rarity)) {
    errors.push(`Invalid rarity: ${item.rarity}`);
  }

  // Scaling type validation
  if (item.scaling_type && !VALID_SCALING_TYPES.includes(item.scaling_type)) {
    errors.push(`Invalid scaling_type: ${item.scaling_type}`);
  }

  // Numeric field validation
  if (item.stack_cap !== undefined && item.stack_cap !== null) {
    if (typeof item.stack_cap !== 'number' || item.stack_cap < 1) {
      errors.push('stack_cap must be a positive number');
    }
  }

  // Boolean field validation
  if (item.stacks_well !== undefined && typeof item.stacks_well !== 'boolean') {
    errors.push('stacks_well must be a boolean');
  }
  if (item.one_and_done !== undefined && typeof item.one_and_done !== 'boolean') {
    errors.push('one_and_done must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateWeapon(weapon) {
  const errors = [];

  // Required fields
  if (!weapon.id) errors.push('Missing id');
  if (!weapon.name) errors.push('Missing name');

  // Type validation
  if (typeof weapon.id !== 'string') errors.push('id must be a string');
  if (typeof weapon.name !== 'string') errors.push('name must be a string');

  // Tier validation
  if (weapon.tier && !VALID_TIERS.includes(weapon.tier)) {
    errors.push(`Invalid tier: ${weapon.tier}`);
  }

  // Numeric validation
  if (weapon.damage !== undefined && (typeof weapon.damage !== 'number' || weapon.damage < 0)) {
    errors.push('damage must be a non-negative number');
  }
  if (weapon.crit_chance !== undefined && (typeof weapon.crit_chance !== 'number' || weapon.crit_chance < 0 || weapon.crit_chance > 100)) {
    errors.push('crit_chance must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateCharacter(character) {
  const errors = [];

  // Required fields
  if (!character.id) errors.push('Missing id');
  if (!character.name) errors.push('Missing name');

  // Type validation
  if (typeof character.id !== 'string') errors.push('id must be a string');
  if (typeof character.name !== 'string') errors.push('name must be a string');

  // Tier validation
  if (character.tier && !VALID_TIERS.includes(character.tier)) {
    errors.push(`Invalid tier: ${character.tier}`);
  }

  // Numeric validation
  if (character.hp !== undefined && (typeof character.hp !== 'number' || character.hp <= 0)) {
    errors.push('hp must be a positive number');
  }
  if (character.damage !== undefined && (typeof character.damage !== 'number' || character.damage < 0)) {
    errors.push('damage must be a non-negative number');
  }
  if (character.crit_chance !== undefined && (typeof character.crit_chance !== 'number' || character.crit_chance < 0)) {
    errors.push('crit_chance must be a non-negative number');
  }
  if (character.crit_damage !== undefined && (typeof character.crit_damage !== 'number' || character.crit_damage < 100)) {
    errors.push('crit_damage must be at least 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateTome(tome) {
  const errors = [];

  // Required fields
  if (!tome.id) errors.push('Missing id');
  if (!tome.name) errors.push('Missing name');

  // Type validation
  if (typeof tome.id !== 'string') errors.push('id must be a string');
  if (typeof tome.name !== 'string') errors.push('name must be a string');

  // Tier validation
  if (tome.tier && !VALID_TIERS.includes(tome.tier)) {
    errors.push(`Invalid tier: ${tome.tier}`);
  }

  // Max level validation
  if (tome.max_level !== undefined && (typeof tome.max_level !== 'number' || tome.max_level < 1)) {
    errors.push('max_level must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateShrine(shrine) {
  const errors = [];

  // Required fields
  if (!shrine.id) errors.push('Missing id');
  if (!shrine.name) errors.push('Missing name');

  // Type validation
  if (typeof shrine.id !== 'string') errors.push('id must be a string');
  if (typeof shrine.name !== 'string') errors.push('name must be a string');

  // Type validation (shrine type)
  if (shrine.type && !VALID_SHRINE_TYPES.includes(shrine.type)) {
    errors.push(`Invalid shrine type: ${shrine.type}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateDataSet(data, type) {
  const results = {
    total: data.length,
    valid: 0,
    invalid: 0,
    errors: []
  };

  const validators = {
    item: validateItem,
    weapon: validateWeapon,
    character: validateCharacter,
    tome: validateTome,
    shrine: validateShrine
  };

  const validator = validators[type];
  if (!validator) {
    return { ...results, errors: [`Unknown type: ${type}`] };
  }

  data.forEach((entry, index) => {
    const result = validator(entry);
    if (result.valid) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push({
        index,
        id: entry.id || `unknown-${index}`,
        errors: result.errors
      });
    }
  });

  return results;
}

describe('Item Validation', () => {
  describe('validateItem()', () => {
    it('should validate correct item', () => {
      const item = createMockItem({
        id: 'valid-item',
        name: 'Valid Item',
        tier: 'SS',
        rarity: 'legendary'
      });

      const result = validateItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject item without id', () => {
      const item = { name: 'No ID Item' };

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing id');
    });

    it('should reject item without name', () => {
      const item = { id: 'no-name' };

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing name');
    });

    it('should reject invalid tier', () => {
      const item = createMockItem({ tier: 'X' });

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid tier'))).toBe(true);
    });

    it('should reject invalid rarity', () => {
      const item = createMockItem({ rarity: 'mythic' });

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid rarity'))).toBe(true);
    });

    it('should reject invalid stack_cap', () => {
      const item = createMockItem({ stack_cap: -1 });

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stack_cap'))).toBe(true);
    });

    it('should reject invalid stacks_well type', () => {
      const item = createMockItem({ stacks_well: 'yes' });

      const result = validateItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stacks_well'))).toBe(true);
    });

    it('should accept all valid tiers', () => {
      VALID_TIERS.forEach(tier => {
        const item = createMockItem({ tier });
        const result = validateItem(item);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept all valid rarities', () => {
      VALID_RARITIES.forEach(rarity => {
        const item = createMockItem({ rarity });
        const result = validateItem(item);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept all valid scaling types', () => {
      VALID_SCALING_TYPES.forEach(scaling_type => {
        const item = createMockItem({ scaling_type });
        const result = validateItem(item);
        expect(result.valid).toBe(true);
      });
    });
  });
});

describe('Weapon Validation', () => {
  describe('validateWeapon()', () => {
    it('should validate correct weapon', () => {
      const weapon = createMockWeapon({
        id: 'valid-weapon',
        name: 'Valid Weapon',
        tier: 'S',
        damage: 50,
        crit_chance: 10
      });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(true);
    });

    it('should reject weapon without id', () => {
      const weapon = { name: 'No ID' };

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing id');
    });

    it('should reject negative damage', () => {
      const weapon = createMockWeapon({ damage: -10 });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('damage'))).toBe(true);
    });

    it('should reject crit_chance over 100', () => {
      const weapon = createMockWeapon({ crit_chance: 150 });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('crit_chance'))).toBe(true);
    });

    it('should reject negative crit_chance', () => {
      const weapon = createMockWeapon({ crit_chance: -5 });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(false);
    });

    it('should accept zero damage', () => {
      const weapon = createMockWeapon({ damage: 0 });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(true);
    });

    it('should accept zero crit_chance', () => {
      const weapon = createMockWeapon({ crit_chance: 0 });

      const result = validateWeapon(weapon);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Character Validation', () => {
  describe('validateCharacter()', () => {
    it('should validate correct character', () => {
      const character = createMockCharacter({
        id: 'valid-char',
        name: 'Valid Character',
        tier: 'A',
        hp: 100,
        damage: 10,
        crit_chance: 5,
        crit_damage: 150
      });

      const result = validateCharacter(character);
      expect(result.valid).toBe(true);
    });

    it('should reject character without id', () => {
      const character = { name: 'No ID' };

      const result = validateCharacter(character);
      expect(result.valid).toBe(false);
    });

    it('should reject zero hp', () => {
      const character = createMockCharacter({ hp: 0 });

      const result = validateCharacter(character);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('hp'))).toBe(true);
    });

    it('should reject negative hp', () => {
      const character = createMockCharacter({ hp: -10 });

      const result = validateCharacter(character);
      expect(result.valid).toBe(false);
    });

    it('should reject crit_damage below 100', () => {
      const character = createMockCharacter({ crit_damage: 50 });

      const result = validateCharacter(character);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('crit_damage'))).toBe(true);
    });

    it('should accept crit_damage of exactly 100', () => {
      const character = createMockCharacter({ crit_damage: 100 });

      const result = validateCharacter(character);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Tome Validation', () => {
  describe('validateTome()', () => {
    it('should validate correct tome', () => {
      const tome = createMockTome({
        id: 'valid-tome',
        name: 'Valid Tome',
        tier: 'SS',
        max_level: 10
      });

      const result = validateTome(tome);
      expect(result.valid).toBe(true);
    });

    it('should reject tome without id', () => {
      const tome = { name: 'No ID' };

      const result = validateTome(tome);
      expect(result.valid).toBe(false);
    });

    it('should reject zero max_level', () => {
      const tome = createMockTome({ max_level: 0 });

      const result = validateTome(tome);
      expect(result.valid).toBe(false);
    });

    it('should reject negative max_level', () => {
      const tome = createMockTome({ max_level: -5 });

      const result = validateTome(tome);
      expect(result.valid).toBe(false);
    });
  });
});

describe('Shrine Validation', () => {
  describe('validateShrine()', () => {
    it('should validate correct shrine', () => {
      const shrine = createMockShrine({
        id: 'valid-shrine',
        name: 'Valid Shrine',
        type: 'offensive'
      });

      const result = validateShrine(shrine);
      expect(result.valid).toBe(true);
    });

    it('should reject shrine without id', () => {
      const shrine = { name: 'No ID' };

      const result = validateShrine(shrine);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid shrine type', () => {
      const shrine = createMockShrine({ type: 'invalid' });

      const result = validateShrine(shrine);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid shrine type'))).toBe(true);
    });

    it('should accept all valid shrine types', () => {
      VALID_SHRINE_TYPES.forEach(type => {
        const shrine = createMockShrine({ type });
        const result = validateShrine(shrine);
        expect(result.valid).toBe(true);
      });
    });
  });
});

describe('Dataset Validation', () => {
  describe('validateDataSet()', () => {
    it('should validate array of items', () => {
      const items = [
        createMockItem({ id: 'item-1', name: 'Item 1' }),
        createMockItem({ id: 'item-2', name: 'Item 2' }),
        createMockItem({ id: 'item-3', name: 'Item 3' }),
      ];

      const result = validateDataSet(items, 'item');

      expect(result.total).toBe(3);
      expect(result.valid).toBe(3);
      expect(result.invalid).toBe(0);
    });

    it('should report invalid entries', () => {
      const items = [
        createMockItem({ id: 'valid', name: 'Valid' }),
        { name: 'No ID' }, // Invalid
        createMockItem({ id: 'also-valid', name: 'Also Valid' }),
      ];

      const result = validateDataSet(items, 'item');

      expect(result.total).toBe(3);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });

    it('should handle empty dataset', () => {
      const result = validateDataSet([], 'item');

      expect(result.total).toBe(0);
      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(0);
    });

    it('should handle unknown type', () => {
      const result = validateDataSet([{ id: 'test' }], 'unknown');

      expect(result.errors).toContain('Unknown type: unknown');
    });

    it('should validate mixed valid/invalid dataset', () => {
      const weapons = [
        createMockWeapon({ id: 'w1', name: 'Weapon 1', damage: 50 }),
        createMockWeapon({ id: 'w2', name: 'Weapon 2', damage: -10 }), // Invalid
        createMockWeapon({ id: 'w3', name: 'Weapon 3', crit_chance: 200 }), // Invalid
        createMockWeapon({ id: 'w4', name: 'Weapon 4' }),
      ];

      const result = validateDataSet(weapons, 'weapon');

      expect(result.total).toBe(4);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(2);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle null values', () => {
    const item = { id: null, name: null };

    const result = validateItem(item);
    expect(result.valid).toBe(false);
  });

  it('should handle undefined values', () => {
    const item = { id: undefined, name: undefined };

    const result = validateItem(item);
    expect(result.valid).toBe(false);
  });

  it('should handle empty strings', () => {
    const item = { id: '', name: '' };

    const result = validateItem(item);
    expect(result.valid).toBe(false);
  });

  it('should handle numeric id', () => {
    const item = { id: 123, name: 'Test' };

    const result = validateItem(item);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id must be a string'))).toBe(true);
  });

  it('should handle array as name', () => {
    const item = { id: 'test', name: ['Test'] };

    const result = validateItem(item);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name must be a string'))).toBe(true);
  });
});
