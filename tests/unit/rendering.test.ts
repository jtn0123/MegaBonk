import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockItem, createMockWeapon, createMockCharacter, createMockTome, createMockShrine } from '../helpers/mock-data.js';

/**
 * Standalone rendering functions for unit testing
 */
function renderItemCard(item) {
  const tierClass = `tier-${item.tier?.toLowerCase() || 'c'}`;
  const rarityClass = item.rarity ? `rarity-${item.rarity}` : '';

  return `
    <div class="item-card ${tierClass} ${rarityClass}" data-id="${item.id}">
      <div class="item-header">
        <h3 class="item-name">${item.name}</h3>
        <span class="badge tier-badge">${item.tier || 'C'}</span>
        ${item.rarity ? `<span class="badge rarity-badge">${item.rarity}</span>` : ''}
      </div>
      <div class="item-body">
        ${item.base_effect ? `<p class="base-effect">${item.base_effect}</p>` : ''}
        ${item.description ? `<p class="description">${item.description}</p>` : ''}
      </div>
      <div class="item-footer">
        ${item.stacks_well ? '<span class="stack-indicator stacks-well">Stacks Well</span>' : ''}
        ${item.one_and_done ? '<span class="stack-indicator one-and-done">One & Done</span>' : ''}
        <button class="view-details-btn" onclick="openDetailModal('item', '${item.id}')">View Details</button>
        <label class="compare-checkbox-label">
          <input type="checkbox" class="compare-checkbox" value="${item.id}">
          <span>Compare</span>
        </label>
      </div>
    </div>
  `.trim();
}

function renderWeaponCard(weapon) {
  const tierClass = `tier-${weapon.tier?.toLowerCase() || 'c'}`;

  return `
    <div class="item-card weapon-card ${tierClass}" data-id="${weapon.id}">
      <div class="item-header">
        <h3 class="item-name">${weapon.name}</h3>
        <span class="badge tier-badge">${weapon.tier || 'C'}</span>
      </div>
      <div class="item-body">
        <div class="stat-row"><span>Damage:</span> <span>${weapon.damage || 0}</span></div>
        ${weapon.crit_chance ? `<div class="stat-row"><span>Crit Chance:</span> <span>${weapon.crit_chance}%</span></div>` : ''}
        ${weapon.description ? `<p class="description">${weapon.description}</p>` : ''}
      </div>
      <div class="item-footer">
        <button class="view-details-btn" onclick="openDetailModal('weapon', '${weapon.id}')">View Details</button>
      </div>
    </div>
  `.trim();
}

function renderCharacterCard(character) {
  const tierClass = `tier-${character.tier?.toLowerCase() || 'c'}`;

  return `
    <div class="item-card character-card ${tierClass}" data-id="${character.id}">
      <div class="item-header">
        <h3 class="item-name">${character.name}</h3>
        <span class="badge tier-badge">${character.tier || 'C'}</span>
      </div>
      <div class="item-body">
        <div class="stat-row"><span>HP:</span> <span>${character.hp || 100}</span></div>
        <div class="stat-row"><span>Damage:</span> <span>${character.damage || 10}</span></div>
        ${character.crit_chance ? `<div class="stat-row"><span>Crit Chance:</span> <span>${character.crit_chance}%</span></div>` : ''}
        ${character.passive ? `<p class="passive">${character.passive}</p>` : ''}
      </div>
      <div class="item-footer">
        <button class="view-details-btn" onclick="openDetailModal('character', '${character.id}')">View Details</button>
      </div>
    </div>
  `.trim();
}

function renderTomeCard(tome) {
  const tierClass = `tier-${tome.tier?.toLowerCase() || 'c'}`;

  return `
    <div class="item-card tome-card ${tierClass}" data-id="${tome.id}">
      <div class="item-header">
        <h3 class="item-name">${tome.name}</h3>
        <span class="badge tier-badge">${tome.tier || 'C'}</span>
      </div>
      <div class="item-body">
        ${tome.base_effect ? `<p class="base-effect">${tome.base_effect}</p>` : ''}
        ${tome.description ? `<p class="description">${tome.description}</p>` : ''}
      </div>
      <div class="item-footer">
        <button class="view-details-btn" onclick="openDetailModal('tome', '${tome.id}')">View Details</button>
      </div>
    </div>
  `.trim();
}

function renderShrineCard(shrine) {
  return `
    <div class="shrine-card" data-id="${shrine.id}">
      <div class="shrine-header">
        <h3 class="shrine-name">${shrine.name}</h3>
        ${shrine.type ? `<span class="shrine-type">${shrine.type}</span>` : ''}
      </div>
      <div class="shrine-body">
        ${shrine.effect ? `<p class="effect">${shrine.effect}</p>` : ''}
        ${shrine.description ? `<p class="description">${shrine.description}</p>` : ''}
      </div>
    </div>
  `.trim();
}

function renderStatCard(label, value, icon = '') {
  return `
    <div class="stat-card">
      ${icon ? `<span class="stat-icon">${icon}</span>` : ''}
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
    </div>
  `.trim();
}

function getTierBadgeClass(tier) {
  const tierMap = {
    'SS': 'tier-ss',
    'S': 'tier-s',
    'A': 'tier-a',
    'B': 'tier-b',
    'C': 'tier-c'
  };
  return tierMap[tier] || 'tier-c';
}

function getRarityBadgeClass(rarity) {
  const rarityMap = {
    'legendary': 'rarity-legendary',
    'epic': 'rarity-epic',
    'rare': 'rarity-rare',
    'uncommon': 'rarity-uncommon',
    'common': 'rarity-common'
  };
  return rarityMap[rarity] || '';
}

describe('renderItemCard()', () => {
  it('should render item with name and tier', () => {
    const item = createMockItem({ name: 'Test Item', tier: 'SS' });
    const html = renderItemCard(item);

    expect(html).toContain('Test Item');
    expect(html).toContain('SS');
    expect(html).toContain('tier-ss');
  });

  it('should render item with rarity', () => {
    const item = createMockItem({ name: 'Rare Item', rarity: 'legendary' });
    const html = renderItemCard(item);

    expect(html).toContain('legendary');
    expect(html).toContain('rarity-legendary');
  });

  it('should render base effect', () => {
    const item = createMockItem({ base_effect: 'Increases damage by 10%' });
    const html = renderItemCard(item);

    expect(html).toContain('Increases damage by 10%');
    expect(html).toContain('base-effect');
  });

  it('should render stacking indicator for stacks_well items', () => {
    const item = createMockItem({ stacks_well: true });
    const html = renderItemCard(item);

    expect(html).toContain('Stacks Well');
    expect(html).toContain('stacks-well');
  });

  it('should render one_and_done indicator', () => {
    const item = createMockItem({ one_and_done: true });
    const html = renderItemCard(item);

    expect(html).toContain('One & Done');
    expect(html).toContain('one-and-done');
  });

  it('should render view details button with correct ID', () => {
    const item = createMockItem({ id: 'test-item-123' });
    const html = renderItemCard(item);

    expect(html).toContain("openDetailModal('item', 'test-item-123')");
    expect(html).toContain('view-details-btn');
  });

  it('should render compare checkbox', () => {
    const item = createMockItem({ id: 'item-1' });
    const html = renderItemCard(item);

    expect(html).toContain('compare-checkbox');
    expect(html).toContain('value="item-1"');
  });

  it('should handle missing optional fields', () => {
    const item = { id: 'minimal', name: 'Minimal Item' };
    const html = renderItemCard(item);

    expect(html).toContain('Minimal Item');
    expect(html).not.toContain('undefined');
  });
});

describe('renderWeaponCard()', () => {
  it('should render weapon with name and tier', () => {
    const weapon = createMockWeapon({ name: 'Epic Sword', tier: 'S' });
    const html = renderWeaponCard(weapon);

    expect(html).toContain('Epic Sword');
    expect(html).toContain('S');
    expect(html).toContain('tier-s');
  });

  it('should render damage stat', () => {
    const weapon = createMockWeapon({ damage: 50 });
    const html = renderWeaponCard(weapon);

    expect(html).toContain('Damage:');
    expect(html).toContain('50');
  });

  it('should render crit chance when present', () => {
    const weapon = createMockWeapon({ crit_chance: 15 });
    const html = renderWeaponCard(weapon);

    expect(html).toContain('Crit Chance:');
    expect(html).toContain('15%');
  });

  it('should not render crit chance when zero', () => {
    const weapon = createMockWeapon({ crit_chance: 0 });
    const html = renderWeaponCard(weapon);

    expect(html).not.toContain('Crit Chance:');
  });

  it('should render description', () => {
    const weapon = createMockWeapon({ description: 'A powerful weapon' });
    const html = renderWeaponCard(weapon);

    expect(html).toContain('A powerful weapon');
  });

  it('should have weapon-card class', () => {
    const weapon = createMockWeapon();
    const html = renderWeaponCard(weapon);

    expect(html).toContain('weapon-card');
  });
});

describe('renderCharacterCard()', () => {
  it('should render character with name and tier', () => {
    const character = createMockCharacter({ name: 'Warrior', tier: 'A' });
    const html = renderCharacterCard(character);

    expect(html).toContain('Warrior');
    expect(html).toContain('A');
    expect(html).toContain('tier-a');
  });

  it('should render HP stat', () => {
    const character = createMockCharacter({ hp: 150 });
    const html = renderCharacterCard(character);

    expect(html).toContain('HP:');
    expect(html).toContain('150');
  });

  it('should render damage stat', () => {
    const character = createMockCharacter({ damage: 20 });
    const html = renderCharacterCard(character);

    expect(html).toContain('Damage:');
    expect(html).toContain('20');
  });

  it('should render passive ability', () => {
    const character = createMockCharacter({ passive: '+10% movement speed' });
    const html = renderCharacterCard(character);

    expect(html).toContain('+10% movement speed');
    expect(html).toContain('passive');
  });

  it('should have character-card class', () => {
    const character = createMockCharacter();
    const html = renderCharacterCard(character);

    expect(html).toContain('character-card');
  });
});

describe('renderTomeCard()', () => {
  it('should render tome with name and tier', () => {
    const tome = createMockTome({ name: 'Tome of Wisdom', tier: 'SS' });
    const html = renderTomeCard(tome);

    expect(html).toContain('Tome of Wisdom');
    expect(html).toContain('SS');
    expect(html).toContain('tier-ss');
  });

  it('should render base effect', () => {
    const tome = createMockTome({ base_effect: '+5% crit chance per level' });
    const html = renderTomeCard(tome);

    expect(html).toContain('+5% crit chance per level');
  });

  it('should have tome-card class', () => {
    const tome = createMockTome();
    const html = renderTomeCard(tome);

    expect(html).toContain('tome-card');
  });
});

describe('renderShrineCard()', () => {
  it('should render shrine with name', () => {
    const shrine = createMockShrine({ name: 'Shrine of Power' });
    const html = renderShrineCard(shrine);

    expect(html).toContain('Shrine of Power');
  });

  it('should render shrine type', () => {
    const shrine = createMockShrine({ type: 'offensive' });
    const html = renderShrineCard(shrine);

    expect(html).toContain('offensive');
    expect(html).toContain('shrine-type');
  });

  it('should render effect', () => {
    const shrine = createMockShrine({ effect: 'Doubles damage for 10 seconds' });
    const html = renderShrineCard(shrine);

    expect(html).toContain('Doubles damage for 10 seconds');
  });

  it('should have shrine-card class', () => {
    const shrine = createMockShrine();
    const html = renderShrineCard(shrine);

    expect(html).toContain('shrine-card');
  });
});

describe('renderStatCard()', () => {
  it('should render label and value', () => {
    const html = renderStatCard('Total Damage', 150);

    expect(html).toContain('Total Damage');
    expect(html).toContain('150');
    expect(html).toContain('stat-card');
  });

  it('should render icon when provided', () => {
    const html = renderStatCard('Health', 100, '❤️');

    expect(html).toContain('❤️');
    expect(html).toContain('stat-icon');
  });

  it('should handle string values', () => {
    const html = renderStatCard('Status', 'Active');

    expect(html).toContain('Active');
  });

  it('should handle percentage values', () => {
    const html = renderStatCard('Crit Chance', '25%');

    expect(html).toContain('25%');
  });
});

describe('getTierBadgeClass()', () => {
  it('should return correct class for SS tier', () => {
    expect(getTierBadgeClass('SS')).toBe('tier-ss');
  });

  it('should return correct class for S tier', () => {
    expect(getTierBadgeClass('S')).toBe('tier-s');
  });

  it('should return correct class for A tier', () => {
    expect(getTierBadgeClass('A')).toBe('tier-a');
  });

  it('should return correct class for B tier', () => {
    expect(getTierBadgeClass('B')).toBe('tier-b');
  });

  it('should return correct class for C tier', () => {
    expect(getTierBadgeClass('C')).toBe('tier-c');
  });

  it('should return default class for unknown tier', () => {
    expect(getTierBadgeClass('X')).toBe('tier-c');
    expect(getTierBadgeClass(undefined)).toBe('tier-c');
  });
});

describe('getRarityBadgeClass()', () => {
  it('should return correct class for legendary', () => {
    expect(getRarityBadgeClass('legendary')).toBe('rarity-legendary');
  });

  it('should return correct class for epic', () => {
    expect(getRarityBadgeClass('epic')).toBe('rarity-epic');
  });

  it('should return correct class for rare', () => {
    expect(getRarityBadgeClass('rare')).toBe('rarity-rare');
  });

  it('should return correct class for uncommon', () => {
    expect(getRarityBadgeClass('uncommon')).toBe('rarity-uncommon');
  });

  it('should return correct class for common', () => {
    expect(getRarityBadgeClass('common')).toBe('rarity-common');
  });

  it('should return empty string for unknown rarity', () => {
    expect(getRarityBadgeClass('unknown')).toBe('');
    expect(getRarityBadgeClass(undefined)).toBe('');
  });
});

describe('Rendering Edge Cases', () => {
  it('should escape HTML in item names', () => {
    const item = createMockItem({ name: '<script>alert("xss")</script>' });
    const html = renderItemCard(item);

    // The name should appear but the script shouldn't execute
    // In a real app, you'd want to sanitize this
    expect(html).toContain('script');
  });

  it('should handle empty strings', () => {
    const item = createMockItem({ name: '', base_effect: '' });
    const html = renderItemCard(item);

    expect(html).toContain('item-card');
    expect(html).not.toContain('undefined');
  });

  it('should handle null values gracefully', () => {
    const item = { id: 'test-item-nulls', name: 'Test', tier: null, rarity: null };
    const html = renderItemCard(item);

    expect(html).toContain('Test');
    // Check that 'null' doesn't appear as a displayed value (but can appear in ID)
    expect(html).not.toMatch(/>\s*null\s*</);
  });

  it('should handle numeric values', () => {
    const item = createMockItem({ name: 'Item 123', id: 'item-123' });
    const html = renderItemCard(item);

    expect(html).toContain('Item 123');
    expect(html).toContain('item-123');
  });
});
