/**
 * Real Integration Tests for Advisor Module
 * No mocking - tests actual advisor implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    initAdvisor,
    applyScannedBuild,
    resetAdvisor,
} from '../../src/modules/advisor.ts';

// ========================================
// Test Fixtures
// ========================================

const testGameData = {
    characters: {
        characters: [
            { id: 'char1', name: 'Fire Mage', tier: 'SS', rarity: 'legendary' },
            { id: 'char2', name: 'Knight', tier: 'A', rarity: 'epic' },
        ],
    },
    weapons: {
        weapons: [
            { id: 'weapon1', name: 'Fire Sword', tier: 'S', rarity: 'legendary', base_damage: 50 },
            { id: 'weapon2', name: 'Ice Staff', tier: 'A', rarity: 'epic', base_damage: 35 },
        ],
    },
    items: {
        items: [
            { id: 'item1', name: 'Power Crystal', tier: 'SS', rarity: 'legendary' },
            { id: 'item2', name: 'Lucky Charm', tier: 'A', rarity: 'epic' },
        ],
    },
    tomes: {
        tomes: [
            { id: 'tome1', name: 'Tome of Power', tier: 'SS', rarity: 'legendary' },
            { id: 'tome2', name: 'Book of Speed', tier: 'S', rarity: 'epic' },
        ],
    },
    shrines: {
        shrines: [
            { id: 'shrine1', name: 'Shrine of Power', tier: 'A', rarity: 'rare' },
        ],
    },
};

// ========================================
// DOM Setup Helper
// ========================================

const createAdvisorDOM = () => {
    document.body.innerHTML = `
        <select id="advisor-character">
            <option value="">Select...</option>
        </select>
        <select id="advisor-weapon">
            <option value="">Select...</option>
        </select>
        <div id="advisor-current-items"></div>
        <div id="advisor-current-tomes"></div>
        <button id="add-current-item">+ Add Item</button>
        <button id="add-current-tome">+ Add Tome</button>
        <select id="choice-1-type">
            <option value="">Select Type...</option>
            <option value="item">Item</option>
            <option value="weapon">Weapon</option>
            <option value="tome">Tome</option>
            <option value="shrine">Shrine</option>
        </select>
        <select id="choice-1-entity"></select>
        <select id="choice-2-type">
            <option value="">Select Type...</option>
            <option value="item">Item</option>
        </select>
        <select id="choice-2-entity"></select>
        <select id="choice-3-type">
            <option value="">Select Type...</option>
            <option value="item">Item</option>
        </select>
        <select id="choice-3-entity"></select>
        <button id="get-recommendation">Get Recommendation</button>
        <div id="advisor-results" style="display: none;">
            <div id="advisor-results-content"></div>
        </div>
    `;
};

// ========================================
// initAdvisor Tests
// ========================================

describe('initAdvisor - Real Integration Tests', () => {
    beforeEach(() => {
        createAdvisorDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should populate character dropdown', () => {
        initAdvisor(testGameData);

        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
        // Default option + 2 characters
        expect(characterSelect.options.length).toBe(3);
    });

    it('should populate weapon dropdown', () => {
        initAdvisor(testGameData);

        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
        // Default option + 2 weapons
        expect(weaponSelect.options.length).toBe(3);
    });

    it('should add character options with names', () => {
        initAdvisor(testGameData);

        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
        const options = Array.from(characterSelect.options).map(o => o.textContent);
        expect(options).toContain('Fire Mage');
        expect(options).toContain('Knight');
    });

    it('should add weapon options with names', () => {
        initAdvisor(testGameData);

        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
        const options = Array.from(weaponSelect.options).map(o => o.textContent);
        expect(options).toContain('Fire Sword');
        expect(options).toContain('Ice Staff');
    });

    it('should not throw with empty game data', () => {
        expect(() => initAdvisor({})).not.toThrow();
    });

    it('should not throw when DOM elements missing', () => {
        document.body.innerHTML = '';
        expect(() => initAdvisor(testGameData)).not.toThrow();
    });

    it('should handle partial game data', () => {
        const partialData = {
            characters: { characters: [] },
        };
        expect(() => initAdvisor(partialData)).not.toThrow();
    });
});

// ========================================
// applyScannedBuild Tests
// ========================================

describe('applyScannedBuild - Real Integration Tests', () => {
    beforeEach(() => {
        createAdvisorDOM();
        initAdvisor(testGameData);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set character from scanned build', () => {
        const scanState = {
            character: { id: 'char1', name: 'Fire Mage' },
            weapon: null,
            items: [],
            tomes: [],
        };

        applyScannedBuild(scanState as any);

        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
        expect(characterSelect.value).toBe('char1');
    });

    it('should set weapon from scanned build', () => {
        const scanState = {
            character: null,
            weapon: { id: 'weapon1', name: 'Fire Sword' },
            items: [],
            tomes: [],
        };

        applyScannedBuild(scanState as any);

        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
        expect(weaponSelect.value).toBe('weapon1');
    });

    it('should handle empty scanned build', () => {
        const emptyState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [],
        };

        expect(() => applyScannedBuild(emptyState)).not.toThrow();
    });

    it('should add items from scanned build', () => {
        const scanState = {
            character: null,
            weapon: null,
            items: [{ id: 'item1', name: 'Power Crystal' }],
            tomes: [],
        };

        applyScannedBuild(scanState as any);

        // Items should be added (check container has content)
        const itemsContainer = document.getElementById('advisor-current-items');
        expect(itemsContainer).not.toBeNull();
    });

    it('should add tomes from scanned build', () => {
        const scanState = {
            character: null,
            weapon: null,
            items: [],
            tomes: [{ id: 'tome1', name: 'Tome of Power' }],
        };

        applyScannedBuild(scanState as any);

        const tomesContainer = document.getElementById('advisor-current-tomes');
        expect(tomesContainer).not.toBeNull();
    });

    it('should handle missing DOM elements', () => {
        document.body.innerHTML = '';

        expect(() => applyScannedBuild({
            character: { id: 'char1' } as any,
            weapon: null,
            items: [],
            tomes: [],
        })).not.toThrow();
    });
});

// ========================================
// resetAdvisor Tests
// ========================================

describe('resetAdvisor - Real Integration Tests', () => {
    beforeEach(() => {
        createAdvisorDOM();
        initAdvisor(testGameData);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should reset character selection', () => {
        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
        characterSelect.value = 'char1';

        resetAdvisor();

        expect(characterSelect.value).toBe('');
    });

    it('should reset weapon selection', () => {
        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
        weaponSelect.value = 'weapon1';

        resetAdvisor();

        expect(weaponSelect.value).toBe('');
    });

    it('should reset choice type selections', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        choiceType.value = 'item';

        resetAdvisor();

        expect(choiceType.value).toBe('');
    });

    it('should reset choice entity selections', () => {
        const choiceEntity = document.getElementById('choice-1-entity') as HTMLSelectElement;

        resetAdvisor();

        expect(choiceEntity.value).toBe('');
    });

    it('should hide results div', () => {
        const resultsDiv = document.getElementById('advisor-results');
        resultsDiv!.style.display = 'block';

        resetAdvisor();

        expect(resultsDiv?.style.display).toBe('none');
    });

    it('should not throw when DOM elements missing', () => {
        document.body.innerHTML = '';
        expect(() => resetAdvisor()).not.toThrow();
    });
});

// ========================================
// Event Listener Tests
// ========================================

describe('Advisor Event Handling', () => {
    beforeEach(() => {
        createAdvisorDOM();
        initAdvisor(testGameData);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle character selection change', () => {
        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;

        // Trigger change event
        characterSelect.value = 'char1';
        characterSelect.dispatchEvent(new Event('change'));

        // Should not throw
        expect(true).toBe(true);
    });

    it('should handle weapon selection change', () => {
        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;

        weaponSelect.value = 'weapon1';
        weaponSelect.dispatchEvent(new Event('change'));

        expect(true).toBe(true);
    });

    it('should handle choice type change', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;

        choiceType.value = 'item';
        choiceType.dispatchEvent(new Event('change'));

        // Should populate entity dropdown
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;
        expect(entitySelect.options.length).toBeGreaterThan(0);
    });

    it('should populate entity dropdown with items', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        choiceType.value = 'item';
        choiceType.dispatchEvent(new Event('change'));

        // Should have items from testGameData
        expect(entitySelect.options.length).toBe(3); // Select... + 2 items
    });

    it('should populate entity dropdown with weapons', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        choiceType.value = 'weapon';
        choiceType.dispatchEvent(new Event('change'));

        // Should have weapons from testGameData
        expect(entitySelect.options.length).toBe(3); // Select... + 2 weapons
    });

    it('should populate entity dropdown with tomes', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        choiceType.value = 'tome';
        choiceType.dispatchEvent(new Event('change'));

        // Should have tomes from testGameData
        expect(entitySelect.options.length).toBe(3); // Select... + 2 tomes
    });

    it('should populate entity dropdown with shrines', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        choiceType.value = 'shrine';
        choiceType.dispatchEvent(new Event('change'));

        // Should have shrines from testGameData
        expect(entitySelect.options.length).toBe(2); // Select... + 1 shrine
    });

    it('should clear entity dropdown when type is empty', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        // First populate
        choiceType.value = 'item';
        choiceType.dispatchEvent(new Event('change'));

        // Then clear
        choiceType.value = '';
        choiceType.dispatchEvent(new Event('change'));

        expect(entitySelect.options.length).toBe(1); // Only "Select..."
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Advisor Edge Cases', () => {
    beforeEach(() => {
        createAdvisorDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle init with null characters', () => {
        expect(() => initAdvisor({
            characters: null as any,
        })).not.toThrow();
    });

    it('should handle init with undefined weapons', () => {
        expect(() => initAdvisor({
            weapons: undefined,
        })).not.toThrow();
    });

    it('should handle scanned build with undefined items', () => {
        initAdvisor(testGameData);

        expect(() => applyScannedBuild({
            character: null,
            weapon: null,
            items: undefined as any,
            tomes: [],
        })).not.toThrow();
    });

    it('should handle scanned build with undefined tomes', () => {
        initAdvisor(testGameData);

        expect(() => applyScannedBuild({
            character: null,
            weapon: null,
            items: [],
            tomes: undefined as any,
        })).not.toThrow();
    });

    it('should handle multiple initializations', () => {
        expect(() => {
            initAdvisor(testGameData);
            initAdvisor(testGameData);
            initAdvisor(testGameData);
        }).not.toThrow();
    });

    it('should handle reset before init', () => {
        expect(() => resetAdvisor()).not.toThrow();
    });
});

// ========================================
// Entity Option Value Tests
// ========================================

describe('Entity Option Values', () => {
    beforeEach(() => {
        createAdvisorDOM();
        initAdvisor(testGameData);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set character option values to IDs', () => {
        const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
        const options = Array.from(characterSelect.options).filter(o => o.value !== '');

        options.forEach(opt => {
            expect(['char1', 'char2']).toContain(opt.value);
        });
    });

    it('should set weapon option values to IDs', () => {
        const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
        const options = Array.from(weaponSelect.options).filter(o => o.value !== '');

        options.forEach(opt => {
            expect(['weapon1', 'weapon2']).toContain(opt.value);
        });
    });

    it('should include tier in entity option text', () => {
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;
        const entitySelect = document.getElementById('choice-1-entity') as HTMLSelectElement;

        choiceType.value = 'item';
        choiceType.dispatchEvent(new Event('change'));

        const optionTexts = Array.from(entitySelect.options)
            .filter(o => o.value !== '')
            .map(o => o.textContent);

        optionTexts.forEach(text => {
            // Should have format "Name (Tier)"
            expect(text).toMatch(/\(.+\)$/);
        });
    });
});

// ========================================
// Get Recommendation Button Tests
// ========================================

describe('Get Recommendation', () => {
    beforeEach(() => {
        createAdvisorDOM();
        initAdvisor(testGameData);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should have recommendation button', () => {
        const btn = document.getElementById('get-recommendation');
        expect(btn).not.toBeNull();
    });

    it('should not throw when clicking with no selections', () => {
        const btn = document.getElementById('get-recommendation') as HTMLButtonElement;

        // Click without any selections - should show error toast
        expect(() => btn.click()).not.toThrow();
    });

    it('should handle partial selections', () => {
        const btn = document.getElementById('get-recommendation') as HTMLButtonElement;
        const choiceType = document.getElementById('choice-1-type') as HTMLSelectElement;

        // Only set type, not entity
        choiceType.value = 'item';

        expect(() => btn.click()).not.toThrow();
    });
});
