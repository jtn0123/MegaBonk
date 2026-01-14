/**
 * Real Integration Tests for Renderers Module
 * No mocking - tests actual rendering implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    renderItems,
    renderWeapons,
    renderTomes,
    renderCharacters,
    renderShrines,
    updateStats,
} from '../../src/modules/renderers.ts';

// ========================================
// Test Data Fixtures
// ========================================

const testItems = [
    {
        id: 'item1',
        name: 'Power Crystal',
        tier: 'SS' as const,
        rarity: 'legendary' as const,
        description: 'A powerful crystal',
        base_effect: '+10% damage',
        detailed_description: 'This crystal increases damage by 10% per stack. Very effective.',
        one_and_done: false,
        stacks_well: true,
        scaling_per_stack: [10, 20, 30],
        image: 'images/power.png',
    },
    {
        id: 'item2',
        name: 'Lucky Charm',
        tier: 'A' as const,
        rarity: 'epic' as const,
        description: 'Increases luck',
        base_effect: '+5% crit chance',
        detailed_description: 'A charm that increases critical hit chance.',
        one_and_done: true,
        stacks_well: false,
        image: 'images/charm.png',
    },
];

const testWeapons = [
    {
        id: 'weapon1',
        name: 'Fire Sword',
        tier: 'S' as const,
        rarity: 'legendary' as const,
        description: 'A sword engulfed in flames',
        base_damage: 50,
        attack_pattern: 'Wide sweeping attacks',
        upgradeable_stats: ['damage', 'speed'],
        image: 'images/sword.png',
    },
    {
        id: 'weapon2',
        name: 'Ice Staff',
        tier: 'A' as const,
        rarity: 'epic' as const,
        description: 'A staff that shoots ice',
        base_damage: 35,
        attack_pattern: 'Ranged projectiles',
        upgradeable_stats: ['damage'],
        image: 'images/staff.png',
    },
];

const testTomes = [
    {
        id: 'tome1',
        name: 'Tome of Power',
        tier: 'SS' as const,
        rarity: 'legendary' as const,
        description: 'Increases all stats',
        stat_affected: 'All',
        value_per_level: '+2%',
        priority: 1,
        image: 'images/tome.png',
    },
    {
        id: 'tome2',
        name: 'Book of Speed',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Increases movement speed',
        stat_affected: 'Speed',
        value_per_level: '+5%',
        priority: 2,
        image: 'images/book.png',
    },
];

const testCharacters = [
    {
        id: 'char1',
        name: 'Fire Mage',
        tier: 'SS' as const,
        rarity: 'legendary' as const,
        description: 'Master of fire magic',
        passive_ability: 'Inferno',
        passive_description: 'Attacks have 20% chance to ignite',
        starting_weapon: 'Fire Staff',
        playstyle: 'Ranged DPS',
        image: 'images/mage.png',
    },
    {
        id: 'char2',
        name: 'Knight',
        tier: 'A' as const,
        rarity: 'epic' as const,
        description: 'Armored warrior',
        passive_ability: 'Iron Will',
        passive_description: '+10% damage reduction',
        starting_weapon: 'Longsword',
        playstyle: 'Tank',
        image: 'images/knight.png',
    },
];

const testShrines = [
    {
        id: 'shrine1',
        name: 'Shrine of Power',
        tier: 'A' as const,
        rarity: 'rare' as const,
        description: 'Grants a permanent damage boost',
        icon: '⚔️',
        type: 'stat_upgrade' as const,
        reward: '+10% damage',
        reusable: false,
    },
    {
        id: 'shrine2',
        name: 'Combat Arena',
        tier: 'S' as const,
        rarity: 'epic' as const,
        description: 'Fight waves of enemies',
        icon: '🏟️',
        type: 'combat' as const,
        reward: 'Random item',
        reusable: true,
    },
];

// ========================================
// renderItems Tests
// ========================================

describe('renderItems - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="itemsContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render items to container', () => {
        renderItems(testItems as any);

        const container = document.getElementById('itemsContainer');
        const cards = container?.querySelectorAll('.item-card');
        expect(cards?.length).toBe(2);
    });

    it('should display item names', () => {
        renderItems(testItems as any);

        const container = document.getElementById('itemsContainer');
        expect(container?.textContent).toContain('Power Crystal');
        expect(container?.textContent).toContain('Lucky Charm');
    });

    it('should apply rarity class', () => {
        renderItems(testItems as any);

        const cards = document.querySelectorAll('.item-card');
        expect(cards[0].classList.contains('rarity-legendary')).toBe(true);
        expect(cards[1].classList.contains('rarity-epic')).toBe(true);
    });

    it('should set entity data attributes', () => {
        renderItems(testItems as any);

        const card = document.querySelector('.item-card');
        expect(card?.getAttribute('data-entity-type')).toBe('item');
        expect(card?.getAttribute('data-entity-id')).toBe('item1');
    });

    it('should display base effect', () => {
        renderItems(testItems as any);

        const container = document.getElementById('itemsContainer');
        expect(container?.textContent).toContain('+10% damage');
        expect(container?.textContent).toContain('+5% crit chance');
    });

    it('should show stacking info', () => {
        renderItems(testItems as any);

        const container = document.getElementById('itemsContainer');
        expect(container?.textContent).toContain('Stacks Well');
        expect(container?.textContent).toContain('One-and-Done');
    });

    it('should show empty state when no items', () => {
        renderItems([]);

        const container = document.getElementById('itemsContainer');
        expect(container?.querySelector('.empty-state')).not.toBeNull();
    });

    it('should include view details button', () => {
        renderItems(testItems as any);

        const buttons = document.querySelectorAll('.view-details-btn');
        expect(buttons.length).toBe(2);
        expect(buttons[0].getAttribute('data-type')).toBe('items');
        expect(buttons[0].getAttribute('data-id')).toBe('item1');
    });

    it('should include favorite button', () => {
        renderItems(testItems as any);

        const favBtns = document.querySelectorAll('.favorite-btn');
        expect(favBtns.length).toBe(2);
    });

    it('should include compare checkbox', () => {
        renderItems(testItems as any);

        const checkboxes = document.querySelectorAll('.compare-checkbox');
        expect(checkboxes.length).toBe(2);
    });

    it('should not throw when container missing', () => {
        document.body.innerHTML = '';

        expect(() => renderItems(testItems as any)).not.toThrow();
    });
});

// ========================================
// renderWeapons Tests
// ========================================

describe('renderWeapons - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="weaponsContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render weapons to container', () => {
        renderWeapons(testWeapons as any);

        const container = document.getElementById('weaponsContainer');
        const cards = container?.querySelectorAll('.weapon-card');
        expect(cards?.length).toBe(2);
    });

    it('should display weapon names', () => {
        renderWeapons(testWeapons as any);

        const container = document.getElementById('weaponsContainer');
        expect(container?.textContent).toContain('Fire Sword');
        expect(container?.textContent).toContain('Ice Staff');
    });

    it('should apply item-card and weapon-card classes', () => {
        renderWeapons(testWeapons as any);

        const cards = document.querySelectorAll('.weapon-card');
        // Weapons use item-card weapon-card classes
        expect(cards[0].classList.contains('item-card')).toBe(true);
        expect(cards[0].classList.contains('weapon-card')).toBe(true);
    });

    it('should show empty state when no weapons', () => {
        renderWeapons([]);

        const container = document.getElementById('weaponsContainer');
        expect(container?.querySelector('.empty-state')).not.toBeNull();
    });

    it('should not throw when container missing', () => {
        document.body.innerHTML = '';

        expect(() => renderWeapons(testWeapons as any)).not.toThrow();
    });
});

// ========================================
// renderTomes Tests
// ========================================

describe('renderTomes - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="tomesContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render tomes to container', () => {
        renderTomes(testTomes as any);

        const container = document.getElementById('tomesContainer');
        const cards = container?.querySelectorAll('.tome-card');
        expect(cards?.length).toBe(2);
    });

    it('should display tome names', () => {
        renderTomes(testTomes as any);

        const container = document.getElementById('tomesContainer');
        expect(container?.textContent).toContain('Tome of Power');
        expect(container?.textContent).toContain('Book of Speed');
    });

    it('should show empty state when no tomes', () => {
        renderTomes([]);

        const container = document.getElementById('tomesContainer');
        expect(container?.querySelector('.empty-state')).not.toBeNull();
    });

    it('should not throw when container missing', () => {
        document.body.innerHTML = '';

        expect(() => renderTomes(testTomes as any)).not.toThrow();
    });
});

// ========================================
// renderCharacters Tests
// ========================================

describe('renderCharacters - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="charactersContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render characters to container', () => {
        renderCharacters(testCharacters as any);

        const container = document.getElementById('charactersContainer');
        const cards = container?.querySelectorAll('.character-card');
        expect(cards?.length).toBe(2);
    });

    it('should display character names', () => {
        renderCharacters(testCharacters as any);

        const container = document.getElementById('charactersContainer');
        expect(container?.textContent).toContain('Fire Mage');
        expect(container?.textContent).toContain('Knight');
    });

    it('should show empty state when no characters', () => {
        renderCharacters([]);

        const container = document.getElementById('charactersContainer');
        expect(container?.querySelector('.empty-state')).not.toBeNull();
    });

    it('should not throw when container missing', () => {
        document.body.innerHTML = '';

        expect(() => renderCharacters(testCharacters as any)).not.toThrow();
    });
});

// ========================================
// renderShrines Tests
// ========================================

describe('renderShrines - Real Integration Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="shrinesContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render shrines to container', () => {
        renderShrines(testShrines as any);

        const container = document.getElementById('shrinesContainer');
        const cards = container?.querySelectorAll('.shrine-card');
        expect(cards?.length).toBe(2);
    });

    it('should display shrine names', () => {
        renderShrines(testShrines as any);

        const container = document.getElementById('shrinesContainer');
        expect(container?.textContent).toContain('Shrine of Power');
        expect(container?.textContent).toContain('Combat Arena');
    });

    it('should show empty state when no shrines', () => {
        renderShrines([]);

        const container = document.getElementById('shrinesContainer');
        expect(container?.querySelector('.empty-state')).not.toBeNull();
    });

    it('should not throw when container missing', () => {
        document.body.innerHTML = '';

        expect(() => renderShrines(testShrines as any)).not.toThrow();
    });
});

// ========================================
// updateStats Tests
// ========================================

describe('updateStats - Real Integration Tests', () => {
    beforeEach(() => {
        // updateStats uses 'item-count' element
        document.body.innerHTML = `<div id="item-count">0</div>`;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should update item count text', () => {
        updateStats(testItems as any, 'items');

        const itemCount = document.getElementById('item-count');
        // Shows "X items" or "X/Y items"
        expect(itemCount?.textContent).toContain('2');
    });

    it('should handle empty array', () => {
        updateStats([], 'items');

        const itemCount = document.getElementById('item-count');
        expect(itemCount?.textContent).toContain('0');
    });

    it('should not throw when elements missing', () => {
        document.body.innerHTML = '';

        expect(() => updateStats(testItems as any, 'items')).not.toThrow();
    });
});

// ========================================
// XSS Prevention Tests
// ========================================

describe('Renderer XSS Prevention', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="itemsContainer"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should escape HTML in item names', () => {
        const maliciousItem = [{
            id: 'xss',
            name: '<script>alert("xss")</script>',
            tier: 'A' as const,
            rarity: 'common' as const,
            description: 'Test',
            base_effect: 'Test',
            detailed_description: 'Test',
            one_and_done: false,
            stacks_well: false,
        }];

        renderItems(maliciousItem as any);

        const container = document.getElementById('itemsContainer');
        expect(container?.querySelector('script')).toBeNull();
    });

    it('should escape HTML in base_effect', () => {
        const maliciousItem = [{
            id: 'xss',
            name: 'Test Item',
            tier: 'A' as const,
            rarity: 'common' as const,
            description: 'Normal description',
            base_effect: '<b>Bold</b> effect',
            detailed_description: 'Normal',
            one_and_done: false,
            stacks_well: false,
        }];

        renderItems(maliciousItem as any);

        const container = document.getElementById('itemsContainer');
        // base_effect is escaped via escapeHtml
        const effectElement = container?.querySelector('.item-effect');
        expect(effectElement?.querySelector('b')).toBeNull();
        expect(effectElement?.textContent).toContain('Bold');
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Renderer Edge Cases', () => {
    it('should handle items with missing optional fields', () => {
        document.body.innerHTML = '<div id="itemsContainer"></div>';

        const minimalItem = [{
            id: 'minimal',
            name: 'Minimal Item',
            tier: 'C' as const,
            rarity: 'common' as const,
            description: '',
            base_effect: '',
            detailed_description: '',
        }];

        expect(() => renderItems(minimalItem as any)).not.toThrow();

        const container = document.getElementById('itemsContainer');
        expect(container?.textContent).toContain('Minimal Item');
    });

    it('should handle very long item names', () => {
        document.body.innerHTML = '<div id="itemsContainer"></div>';

        const longNameItem = [{
            id: 'long',
            name: 'A'.repeat(200),
            tier: 'A' as const,
            rarity: 'rare' as const,
            description: '',
            base_effect: '',
            detailed_description: '',
        }];

        expect(() => renderItems(longNameItem as any)).not.toThrow();
    });

    it('should handle items with unicode characters', () => {
        document.body.innerHTML = '<div id="itemsContainer"></div>';

        const unicodeItem = [{
            id: 'unicode',
            name: '日本語アイテム 🔥',
            tier: 'S' as const,
            rarity: 'epic' as const,
            description: 'Contains émojis and 日本語',
            base_effect: '魔法 +10%',
            detailed_description: 'More unicode: café ñ',
        }];

        expect(() => renderItems(unicodeItem as any)).not.toThrow();

        const container = document.getElementById('itemsContainer');
        expect(container?.textContent).toContain('🔥');
        expect(container?.textContent).toContain('日本語');
    });
});
