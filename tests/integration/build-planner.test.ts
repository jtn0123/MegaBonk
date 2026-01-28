import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockCharacter, createMockWeapon, createMockTome, createMockItem } from '../helpers/mock-data.js';

/**
 * Build planner state and functions for integration testing
 */
let currentBuild = {
  character: null,
  weapon: null,
  tomes: [],
  items: []
};

let allData = {};

function setupBuildPlannerData() {
  allData = {
    characters: {
      characters: [
        createMockCharacter({ id: 'knight', name: 'Knight', hp: 100, damage: 10, crit_chance: 5 }),
        createMockCharacter({ id: 'mage', name: 'Mage', hp: 60, damage: 15, crit_chance: 10, crit_damage: 200 }),
        createMockCharacter({ id: 'rogue', name: 'Rogue', hp: 70, damage: 12, crit_chance: 20, speed: 15 }),
      ]
    },
    weapons: {
      weapons: [
        createMockWeapon({ id: 'sword', name: 'Sword', damage: 20, crit_chance: 5 }),
        createMockWeapon({ id: 'staff', name: 'Staff', damage: 25, crit_chance: 15 }),
        createMockWeapon({ id: 'dagger', name: 'Dagger', damage: 15, crit_chance: 25 }),
      ]
    },
    tomes: {
      tomes: [
        createMockTome({ id: 'power', name: 'Tome of Power', damage_boost: 10 }),
        createMockTome({ id: 'health', name: 'Tome of Health', hp_boost: 20 }),
        createMockTome({ id: 'crit', name: 'Tome of Crits', crit_boost: 5 }),
      ]
    },
    items: {
      items: [
        createMockItem({ id: 'ring', name: 'Power Ring', damage: 5 }),
        createMockItem({ id: 'amulet', name: 'Health Amulet', hp: 10 }),
        createMockItem({ id: 'gloves', name: 'Crit Gloves', crit_chance: 3 }),
      ]
    }
  };
}

function calculateBuildStats() {
  if (!currentBuild.character || !currentBuild.weapon) {
    return null;
  }

  const char = currentBuild.character;
  const weapon = currentBuild.weapon;

  const stats = {
    total_damage: (char.damage || 0) + (weapon.damage || 0),
    max_hp: char.hp || 100,
    crit_chance: (char.crit_chance || 0) + (weapon.crit_chance || 0),
    crit_damage: char.crit_damage || 150,
    speed: char.speed || 0,
    evasion: 0,
  };

  // Apply tome bonuses
  currentBuild.tomes.forEach(tome => {
    if (tome.damage_boost) stats.total_damage += tome.damage_boost;
    if (tome.hp_boost) stats.max_hp += tome.hp_boost;
    if (tome.crit_boost) stats.crit_chance += tome.crit_boost;
  });

  // Apply item bonuses
  currentBuild.items.forEach(item => {
    if (item.damage) stats.total_damage += item.damage;
    if (item.hp) stats.max_hp += item.hp;
    if (item.crit_chance) stats.crit_chance += item.crit_chance;
  });

  return stats;
}

function setBuildCharacter(characterId) {
  currentBuild.character = allData.characters.characters.find(c => c.id === characterId) || null;
}

function setBuildWeapon(weaponId) {
  currentBuild.weapon = allData.weapons.weapons.find(w => w.id === weaponId) || null;
}

function addTome(tomeId) {
  const tome = allData.tomes.tomes.find(t => t.id === tomeId);
  if (tome && !currentBuild.tomes.find(t => t.id === tomeId)) {
    currentBuild.tomes.push(tome);
  }
}

function removeTome(tomeId) {
  currentBuild.tomes = currentBuild.tomes.filter(t => t.id !== tomeId);
}

function addItem(itemId) {
  const item = allData.items.items.find(i => i.id === itemId);
  if (item && !currentBuild.items.find(i => i.id === itemId)) {
    currentBuild.items.push(item);
  }
}

function removeItem(itemId) {
  currentBuild.items = currentBuild.items.filter(i => i.id !== itemId);
}

function clearBuild() {
  currentBuild = {
    character: null,
    weapon: null,
    tomes: [],
    items: []
  };
}

function exportBuild() {
  if (!currentBuild.character || !currentBuild.weapon) {
    return null;
  }

  return {
    character: currentBuild.character.id,
    weapon: currentBuild.weapon.id,
    tomes: currentBuild.tomes.map(t => t.id),
    items: currentBuild.items.map(i => i.id),
  };
}

function importBuild(buildCode) {
  clearBuild();

  if (buildCode.character) {
    setBuildCharacter(buildCode.character);
  }
  if (buildCode.weapon) {
    setBuildWeapon(buildCode.weapon);
  }
  if (buildCode.tomes) {
    buildCode.tomes.forEach(id => addTome(id));
  }
  if (buildCode.items) {
    buildCode.items.forEach(id => addItem(id));
  }

  return currentBuild;
}

describe('Build Planner Integration', () => {
  beforeEach(() => {
    setupBuildPlannerData();
    clearBuild();
  });

  describe('Character and Weapon Selection', () => {
    it('should set character correctly', () => {
      setBuildCharacter('knight');

      expect(currentBuild.character).not.toBeNull();
      expect(currentBuild.character.name).toBe('Knight');
    });

    it('should set weapon correctly', () => {
      setBuildWeapon('sword');

      expect(currentBuild.weapon).not.toBeNull();
      expect(currentBuild.weapon.name).toBe('Sword');
    });

    it('should allow changing character', () => {
      setBuildCharacter('knight');
      expect(currentBuild.character.name).toBe('Knight');

      setBuildCharacter('mage');
      expect(currentBuild.character.name).toBe('Mage');
    });

    it('should handle invalid character ID', () => {
      setBuildCharacter('nonexistent');

      expect(currentBuild.character).toBeNull();
    });

    it('should handle invalid weapon ID', () => {
      setBuildWeapon('nonexistent');

      expect(currentBuild.weapon).toBeNull();
    });
  });

  describe('Stats Calculation', () => {
    it('should return null without character', () => {
      setBuildWeapon('sword');

      const stats = calculateBuildStats();
      expect(stats).toBeNull();
    });

    it('should return null without weapon', () => {
      setBuildCharacter('knight');

      const stats = calculateBuildStats();
      expect(stats).toBeNull();
    });

    it('should calculate base stats correctly', () => {
      setBuildCharacter('knight');
      setBuildWeapon('sword');

      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(30); // 10 (char) + 20 (weapon)
      expect(stats.max_hp).toBe(100);
      expect(stats.crit_chance).toBe(10); // 5 (char) + 5 (weapon)
    });

    it('should apply character-specific stats', () => {
      setBuildCharacter('mage');
      setBuildWeapon('staff');

      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(40); // 15 + 25
      expect(stats.max_hp).toBe(60);
      expect(stats.crit_chance).toBe(25); // 10 + 15
      expect(stats.crit_damage).toBe(200); // Mage has higher crit damage
    });

    it('should calculate stats for rogue build', () => {
      setBuildCharacter('rogue');
      setBuildWeapon('dagger');

      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(27); // 12 + 15
      expect(stats.crit_chance).toBe(45); // 20 + 25
      expect(stats.speed).toBe(15);
    });
  });

  describe('Tome Integration', () => {
    beforeEach(() => {
      setBuildCharacter('knight');
      setBuildWeapon('sword');
    });

    it('should add tome to build', () => {
      addTome('power');

      expect(currentBuild.tomes.length).toBe(1);
      expect(currentBuild.tomes[0].name).toBe('Tome of Power');
    });

    it('should not add duplicate tomes', () => {
      addTome('power');
      addTome('power');

      expect(currentBuild.tomes.length).toBe(1);
    });

    it('should add multiple different tomes', () => {
      addTome('power');
      addTome('health');
      addTome('crit');

      expect(currentBuild.tomes.length).toBe(3);
    });

    it('should remove tome from build', () => {
      addTome('power');
      addTome('health');
      removeTome('power');

      expect(currentBuild.tomes.length).toBe(1);
      expect(currentBuild.tomes[0].name).toBe('Tome of Health');
    });

    it('should apply tome bonuses to stats', () => {
      const baseStats = calculateBuildStats();

      addTome('power');
      const statsWithPower = calculateBuildStats();

      expect(statsWithPower.total_damage).toBe(baseStats.total_damage + 10);
    });

    it('should apply all tome bonuses cumulatively', () => {
      const baseStats = calculateBuildStats();

      addTome('power');
      addTome('health');
      addTome('crit');

      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(baseStats.total_damage + 10);
      expect(stats.max_hp).toBe(baseStats.max_hp + 20);
      expect(stats.crit_chance).toBe(baseStats.crit_chance + 5);
    });
  });

  describe('Item Integration', () => {
    beforeEach(() => {
      setBuildCharacter('knight');
      setBuildWeapon('sword');
    });

    it('should add item to build', () => {
      addItem('ring');

      expect(currentBuild.items.length).toBe(1);
      expect(currentBuild.items[0].name).toBe('Power Ring');
    });

    it('should not add duplicate items', () => {
      addItem('ring');
      addItem('ring');

      expect(currentBuild.items.length).toBe(1);
    });

    it('should remove item from build', () => {
      addItem('ring');
      addItem('amulet');
      removeItem('ring');

      expect(currentBuild.items.length).toBe(1);
      expect(currentBuild.items[0].name).toBe('Health Amulet');
    });

    it('should apply item bonuses to stats', () => {
      const baseStats = calculateBuildStats();

      addItem('ring');
      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(baseStats.total_damage + 5);
    });

    it('should combine tome and item bonuses', () => {
      const baseStats = calculateBuildStats();

      addTome('power');
      addItem('ring');

      const stats = calculateBuildStats();

      expect(stats.total_damage).toBe(baseStats.total_damage + 15); // 10 (tome) + 5 (item)
    });
  });

  describe('Full Build Workflow', () => {
    it('should create complete build from scratch', () => {
      setBuildCharacter('rogue');
      setBuildWeapon('dagger');
      addTome('crit');
      addItem('gloves');

      const stats = calculateBuildStats();

      expect(currentBuild.character.name).toBe('Rogue');
      expect(currentBuild.weapon.name).toBe('Dagger');
      expect(currentBuild.tomes.length).toBe(1);
      expect(currentBuild.items.length).toBe(1);
      expect(stats.crit_chance).toBe(53); // 20 + 25 + 5 + 3
    });

    it('should clear build completely', () => {
      setBuildCharacter('knight');
      setBuildWeapon('sword');
      addTome('power');
      addItem('ring');

      clearBuild();

      expect(currentBuild.character).toBeNull();
      expect(currentBuild.weapon).toBeNull();
      expect(currentBuild.tomes.length).toBe(0);
      expect(currentBuild.items.length).toBe(0);
    });
  });

  describe('Build Export/Import', () => {
    it('should export build correctly', () => {
      setBuildCharacter('mage');
      setBuildWeapon('staff');
      addTome('power');
      addTome('crit');
      addItem('ring');

      const exported = exportBuild();

      expect(exported).toEqual({
        character: 'mage',
        weapon: 'staff',
        tomes: ['power', 'crit'],
        items: ['ring'],
      });
    });

    it('should return null when exporting incomplete build', () => {
      setBuildCharacter('mage');

      const exported = exportBuild();
      expect(exported).toBeNull();
    });

    it('should import build correctly', () => {
      const buildCode = {
        character: 'rogue',
        weapon: 'dagger',
        tomes: ['crit'],
        items: ['gloves'],
      };

      importBuild(buildCode);

      expect(currentBuild.character.id).toBe('rogue');
      expect(currentBuild.weapon.id).toBe('dagger');
      expect(currentBuild.tomes.length).toBe(1);
      expect(currentBuild.items.length).toBe(1);
    });

    it('should maintain stats after export/import cycle', () => {
      setBuildCharacter('mage');
      setBuildWeapon('staff');
      addTome('power');
      addItem('ring');

      const statsBefore = calculateBuildStats();
      const exported = exportBuild();

      clearBuild();
      importBuild(exported);

      const statsAfter = calculateBuildStats();

      expect(statsAfter).toEqual(statsBefore);
    });

    it('should handle import with missing fields', () => {
      const partialBuild = {
        character: 'knight',
        weapon: 'sword',
      };

      importBuild(partialBuild);

      expect(currentBuild.character).not.toBeNull();
      expect(currentBuild.weapon).not.toBeNull();
      expect(currentBuild.tomes.length).toBe(0);
      expect(currentBuild.items.length).toBe(0);
    });
  });

  describe('Build Comparison Scenarios', () => {
    it('should compare knight vs mage damage builds', () => {
      setBuildCharacter('knight');
      setBuildWeapon('sword');
      const knightStats = calculateBuildStats();

      clearBuild();
      setBuildCharacter('mage');
      setBuildWeapon('staff');
      const mageStats = calculateBuildStats();

      expect(mageStats.total_damage).toBeGreaterThan(knightStats.total_damage);
      expect(knightStats.max_hp).toBeGreaterThan(mageStats.max_hp);
    });

    it('should compare crit-focused builds', () => {
      setBuildCharacter('rogue');
      setBuildWeapon('dagger');
      addTome('crit');
      addItem('gloves');

      const stats = calculateBuildStats();

      expect(stats.crit_chance).toBeGreaterThan(50);
    });
  });
});

describe('Build State Integrity', () => {
  beforeEach(() => {
    setupBuildPlannerData();
    clearBuild();
  });

  it('should not mutate original data when building', () => {
    const originalCharacter = { ...allData.characters.characters[0] };

    setBuildCharacter('knight');
    addTome('power');

    // Original data should be unchanged
    expect(allData.characters.characters[0]).toEqual(originalCharacter);
  });

  it('should handle rapid build modifications', () => {
    for (let i = 0; i < 10; i++) {
      setBuildCharacter(['knight', 'mage', 'rogue'][i % 3]);
      setBuildWeapon(['sword', 'staff', 'dagger'][i % 3]);
      addTome('power');
      removeTome('power');
    }

    // Build should be in valid state
    expect(currentBuild.character).not.toBeNull();
    expect(currentBuild.weapon).not.toBeNull();
    expect(currentBuild.tomes.length).toBe(0);
  });
});
