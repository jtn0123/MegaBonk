import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockCharacter, createMockWeapon, createMockItem } from '../helpers/mock-data.js';

/**
 * Standalone synergy detection implementation for testing
 * This mirrors the logic from script.js updateBuildAnalysis()
 */
function detectSynergies(currentBuild) {
  const synergies = [];

  // Character-Weapon synergies
  if (currentBuild.character && currentBuild.weapon) {
    if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
      synergies.push({
        type: 'character-weapon',
        message: `${currentBuild.character.name} synergizes with ${currentBuild.weapon.name}!`,
        source: currentBuild.character.name,
        target: currentBuild.weapon.name
      });
    }
  }

  // Item-Weapon synergies
  if (currentBuild.weapon) {
    currentBuild.items.forEach(item => {
      if (item.synergies_weapons?.includes(currentBuild.weapon.name)) {
        synergies.push({
          type: 'item-weapon',
          message: `${item.name} works great with ${currentBuild.weapon.name}`,
          source: item.name,
          target: currentBuild.weapon.name
        });
      }
    });
  }

  // Item-Character synergies
  if (currentBuild.character) {
    currentBuild.items.forEach(item => {
      if (currentBuild.character.synergies_items?.includes(item.id)) {
        synergies.push({
          type: 'item-character',
          message: `${item.name} synergizes with ${currentBuild.character.name}`,
          source: item.name,
          target: currentBuild.character.name
        });
      }
    });
  }

  // Item-Item synergies
  currentBuild.items.forEach((item, index) => {
    currentBuild.items.slice(index + 1).forEach(otherItem => {
      if (item.synergies?.includes(otherItem.name) || item.synergies?.includes(otherItem.id)) {
        synergies.push({
          type: 'item-item',
          message: `${item.name} synergizes with ${otherItem.name}`,
          source: item.name,
          target: otherItem.name
        });
      }
    });
  });

  return synergies;
}

/**
 * Detects anti-synergies in a build
 */
function detectAntiSynergies(currentBuild) {
  const antiSynergies = [];

  currentBuild.items.forEach(item => {
    if (item.anti_synergies && item.anti_synergies.length > 0) {
      currentBuild.items.forEach(otherItem => {
        if (item.id !== otherItem.id) {
          if (item.anti_synergies.includes(otherItem.name) || item.anti_synergies.includes(otherItem.id)) {
            antiSynergies.push({
              type: 'item-item',
              message: `${item.name} conflicts with ${otherItem.name}`,
              source: item.name,
              target: otherItem.name
            });
          }
        }
      });
    }
  });

  return antiSynergies;
}

describe('detectSynergies()', () => {
  let currentBuild;

  beforeEach(() => {
    createMinimalDOM();
    currentBuild = {
      character: null,
      weapon: null,
      tomes: [],
      items: []
    };
  });

  describe('character-weapon synergies', () => {
    it('should detect synergy between CL4NK and Revolver', () => {
      currentBuild.character = createMockCharacter({
        id: 'cl4nk',
        name: 'CL4NK',
        synergies_weapons: ['Revolver', 'Sniper Rifle']
      });
      currentBuild.weapon = createMockWeapon({
        id: 'revolver',
        name: 'Revolver'
      });

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].type).toBe('character-weapon');
      expect(synergies[0].message).toContain('CL4NK synergizes with Revolver');
    });

    it('should not detect synergy for non-matching character-weapon pair', () => {
      currentBuild.character = createMockCharacter({
        id: 'cl4nk',
        name: 'CL4NK',
        synergies_weapons: ['Sniper Rifle']
      });
      currentBuild.weapon = createMockWeapon({
        id: 'bow',
        name: 'Bow'
      });

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });

    it('should handle character without synergies_weapons', () => {
      currentBuild.character = createMockCharacter({
        id: 'test',
        name: 'Test',
        synergies_weapons: undefined
      });
      currentBuild.weapon = createMockWeapon({
        id: 'revolver',
        name: 'Revolver'
      });

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });
  });

  describe('item-weapon synergies', () => {
    it('should detect item-weapon synergies', () => {
      currentBuild.weapon = createMockWeapon({
        id: 'revolver',
        name: 'Revolver'
      });
      currentBuild.items = [
        createMockItem({
          id: 'forbidden_juice',
          name: 'Forbidden Juice',
          synergies_weapons: ['Revolver', 'Sniper Rifle']
        })
      ];

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].type).toBe('item-weapon');
      expect(synergies[0].message).toContain('Forbidden Juice works great with Revolver');
    });

    it('should detect multiple item-weapon synergies', () => {
      currentBuild.weapon = createMockWeapon({
        id: 'revolver',
        name: 'Revolver'
      });
      currentBuild.items = [
        createMockItem({
          id: 'item1',
          name: 'Item 1',
          synergies_weapons: ['Revolver']
        }),
        createMockItem({
          id: 'item2',
          name: 'Item 2',
          synergies_weapons: ['Revolver']
        })
      ];

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(2);
    });

    it('should not detect synergies when no weapon selected', () => {
      currentBuild.weapon = null;
      currentBuild.items = [
        createMockItem({
          id: 'item1',
          name: 'Item 1',
          synergies_weapons: ['Revolver']
        })
      ];

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });
  });

  describe('item-character synergies', () => {
    it('should detect item-character synergies', () => {
      currentBuild.character = createMockCharacter({
        id: 'cl4nk',
        name: 'CL4NK',
        synergies_items: ['forbidden_juice', 'precision_tonic']
      });
      currentBuild.items = [
        createMockItem({
          id: 'forbidden_juice',
          name: 'Forbidden Juice'
        })
      ];

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].type).toBe('item-character');
      expect(synergies[0].message).toContain('Forbidden Juice synergizes with CL4NK');
    });
  });

  describe('combined synergies', () => {
    it('should detect multiple types of synergies', () => {
      currentBuild.character = createMockCharacter({
        id: 'cl4nk',
        name: 'CL4NK',
        synergies_weapons: ['Revolver'],
        synergies_items: ['forbidden_juice']
      });
      currentBuild.weapon = createMockWeapon({
        id: 'revolver',
        name: 'Revolver'
      });
      currentBuild.items = [
        createMockItem({
          id: 'forbidden_juice',
          name: 'Forbidden Juice',
          synergies_weapons: ['Revolver']
        })
      ];

      const synergies = detectSynergies(currentBuild);

      // Should have: char-weapon, item-weapon, item-char
      expect(synergies).toHaveLength(3);
      expect(synergies.map(s => s.type)).toContain('character-weapon');
      expect(synergies.map(s => s.type)).toContain('item-weapon');
      expect(synergies.map(s => s.type)).toContain('item-character');
    });
  });

  describe('empty build', () => {
    it('should return empty array for empty build', () => {
      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });

    it('should return empty array with only character selected', () => {
      currentBuild.character = createMockCharacter();

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });

    it('should return empty array with only weapon selected', () => {
      currentBuild.weapon = createMockWeapon();

      const synergies = detectSynergies(currentBuild);

      expect(synergies).toHaveLength(0);
    });
  });
});

describe('detectAntiSynergies()', () => {
  let currentBuild;

  beforeEach(() => {
    createMinimalDOM();
    currentBuild = {
      character: null,
      weapon: null,
      tomes: [],
      items: []
    };
  });

  it('should detect anti-synergies between items', () => {
    currentBuild.items = [
      createMockItem({
        id: 'beer',
        name: 'Beer',
        anti_synergies: ['Beefy Ring']
      }),
      createMockItem({
        id: 'beefy_ring',
        name: 'Beefy Ring',
        anti_synergies: []
      })
    ];

    const antiSynergies = detectAntiSynergies(currentBuild);

    expect(antiSynergies).toHaveLength(1);
    expect(antiSynergies[0].message).toContain('Beer conflicts with Beefy Ring');
  });

  it('should not detect anti-synergies when items are compatible', () => {
    currentBuild.items = [
      createMockItem({
        id: 'gym_sauce',
        name: 'Gym Sauce',
        anti_synergies: []
      }),
      createMockItem({
        id: 'beer',
        name: 'Beer',
        anti_synergies: ['Beefy Ring']
      })
    ];

    const antiSynergies = detectAntiSynergies(currentBuild);

    expect(antiSynergies).toHaveLength(0);
  });

  it('should return empty array for empty items', () => {
    const antiSynergies = detectAntiSynergies(currentBuild);

    expect(antiSynergies).toHaveLength(0);
  });
});

describe('synergy message formatting', () => {
  let currentBuild;

  beforeEach(() => {
    currentBuild = {
      character: null,
      weapon: null,
      tomes: [],
      items: []
    };
  });

  it('should include source and target in synergy objects', () => {
    currentBuild.character = createMockCharacter({
      id: 'cl4nk',
      name: 'CL4NK',
      synergies_weapons: ['Revolver']
    });
    currentBuild.weapon = createMockWeapon({
      id: 'revolver',
      name: 'Revolver'
    });

    const synergies = detectSynergies(currentBuild);

    expect(synergies[0].source).toBe('CL4NK');
    expect(synergies[0].target).toBe('Revolver');
  });
});
