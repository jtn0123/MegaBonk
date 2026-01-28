/* eslint-env node */
/* global global, alert, setTimeout */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { setupFetchMocks, createMockAllData } from '../helpers/mock-data.js';
import { loadDataFromUrls, getDataForTabFromData } from '../../src/modules/data-service.ts';

// Standard URLs used for testing
const DATA_URLS = {
    items: '../data/items.json',
    weapons: '../data/weapons.json',
    tomes: '../data/tomes.json',
    characters: '../data/characters.json',
    shrines: '../data/shrines.json',
    stats: '../data/stats.json',
};

/**
 * Wrapper around loadDataFromUrls that updates DOM elements like the original test expected
 * This bridges the pure function to match the original test expectations
 */
async function loadAllData(allData) {
    const result = await loadDataFromUrls(DATA_URLS);

    if (result.success && result.data) {
        // Copy data to allData object (mimics original mutation behavior)
        allData.items = result.data.items;
        allData.weapons = result.data.weapons;
        allData.tomes = result.data.tomes;
        allData.characters = result.data.characters;
        allData.shrines = result.data.shrines;
        allData.stats = result.data.stats;

        // Update version info if elements exist
        const versionEl = document.getElementById('version');
        const lastUpdatedEl = document.getElementById('last-updated');
        if (versionEl && allData.items?.version) {
            versionEl.textContent = `Version: ${allData.items.version}`;
        }
        if (lastUpdatedEl && allData.items?.last_updated) {
            lastUpdatedEl.textContent = `Last Updated: ${allData.items.last_updated}`;
        }

        return { success: true, allData };
    } else {
        console.error('Error loading data:', result.error);
        alert('Failed to load data files. Please check that all JSON files exist.');
        return { success: false, error: result.error };
    }
}

// Use real implementation from data-service.ts
const getDataForTab = getDataForTabFromData;

describe('loadAllData()', () => {
    let allData;

    beforeEach(() => {
        createMinimalDOM();
        allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };
    });

    describe('successful loading', () => {
        it('should fetch all 6 JSON files in parallel', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            expect(fetch).toHaveBeenCalledTimes(6);
            expect(fetch).toHaveBeenCalledWith('../data/items.json');
            expect(fetch).toHaveBeenCalledWith('../data/weapons.json');
            expect(fetch).toHaveBeenCalledWith('../data/tomes.json');
            expect(fetch).toHaveBeenCalledWith('../data/characters.json');
            expect(fetch).toHaveBeenCalledWith('../data/shrines.json');
            expect(fetch).toHaveBeenCalledWith('../data/stats.json');
        });

        it('should populate allData with loaded content', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            const result = await loadAllData(allData);

            expect(result.success).toBe(true);
            expect(allData.items).toBeDefined();
            expect(allData.items.items).toHaveLength(4);
            expect(allData.weapons.weapons).toHaveLength(3);
            expect(allData.tomes.tomes).toHaveLength(3);
            expect(allData.characters.characters).toHaveLength(3);
            expect(allData.shrines.shrines).toHaveLength(2);
        });

        it('should update version display element', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            const versionEl = document.getElementById('version');
            expect(versionEl.textContent).toBe('Version: 1.0.0');
        });

        it('should update last-updated display element', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            const lastUpdatedEl = document.getElementById('last-updated');
            expect(lastUpdatedEl.textContent).toBe('Last Updated: 2024-01-01');
        });
    });

    describe('error handling', () => {
        it('should show alert on fetch failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await loadAllData(allData);

            expect(result.success).toBe(false);
            expect(global.alert).toHaveBeenCalledWith(
                'Failed to load data files. Please check that all JSON files exist.'
            );
        });

        it('should log error to console on failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            await loadAllData(allData);

            expect(console.error).toHaveBeenCalled();
        });

        it('should return error object on failure', async () => {
            const error = new Error('Network error');
            global.fetch = vi.fn().mockRejectedValue(error);

            const result = await loadAllData(allData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('data integrity', () => {
        it('should preserve item structure', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            const item = allData.items.items[0];
            expect(item.id).toBeDefined();
            expect(item.name).toBeDefined();
            expect(item.tier).toBeDefined();
            expect(item.rarity).toBeDefined();
        });

        it('should preserve weapon structure', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            const weapon = allData.weapons.weapons[0];
            expect(weapon.id).toBeDefined();
            expect(weapon.name).toBeDefined();
            expect(weapon.tier).toBeDefined();
            expect(weapon.base_damage).toBeDefined();
        });

        it('should preserve character structure', async () => {
            const mockData = createMockAllData();
            setupFetchMocks(mockData);

            await loadAllData(allData);

            const character = allData.characters.characters[0];
            expect(character.id).toBeDefined();
            expect(character.name).toBeDefined();
            expect(character.passive_ability).toBeDefined();
        });
    });
});

describe('getDataForTab()', () => {
    let allData;

    beforeEach(async () => {
        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        await loadAllData(allData);
    });

    it('should return items array for items tab', () => {
        const data = getDataForTab(allData, 'items');

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].name).toBeDefined();
    });

    it('should return weapons array for weapons tab', () => {
        const data = getDataForTab(allData, 'weapons');

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
    });

    it('should return tomes array for tomes tab', () => {
        const data = getDataForTab(allData, 'tomes');

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
    });

    it('should return characters array for characters tab', () => {
        const data = getDataForTab(allData, 'characters');

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
    });

    it('should return shrines array for shrines tab', () => {
        const data = getDataForTab(allData, 'shrines');

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown tab', () => {
        const data = getDataForTab(allData, 'unknown');

        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0);
    });

    it('should return empty array for build-planner tab', () => {
        const data = getDataForTab(allData, 'build-planner');

        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0);
    });

    it('should return empty array for calculator tab', () => {
        const data = getDataForTab(allData, 'calculator');

        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0);
    });

    it('should handle null allData gracefully', () => {
        const emptyData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        const data = getDataForTab(emptyData, 'items');

        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(0);
    });
});

describe('edge cases and error scenarios', () => {
    let allData;

    beforeEach(() => {
        createMinimalDOM();
        allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };
    });

    it('should handle network timeout gracefully', async () => {
        global.fetch = vi
            .fn()
            .mockImplementation(
                () => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
            );

        const result = await loadAllData(allData);

        expect(result.success).toBe(false);
        expect(global.alert).toHaveBeenCalled();
    });

    it('should handle malformed JSON response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.reject(new SyntaxError('Unexpected token')),
        });

        const result = await loadAllData(allData);

        expect(result.success).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });

    it('should handle 404 response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: () => Promise.reject(new Error('Not Found')),
        });

        const result = await loadAllData(allData);

        expect(result.success).toBe(false);
    });

    it('should handle 500 server error', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error('Internal Server Error')),
        });

        const result = await loadAllData(allData);

        expect(result.success).toBe(false);
    });

    it('should handle empty JSON response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        const result = await loadAllData(allData);

        // Should succeed but with empty data
        expect(result.success).toBe(true);
        expect(allData.items).toEqual({});
    });

    it('should handle partial data loading failure', async () => {
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 3) {
                return Promise.reject(new Error('Third file failed'));
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ items: [], version: '1.0.0', last_updated: '2024-01-01' }),
            });
        });

        const result = await loadAllData(allData);

        expect(result.success).toBe(false);
    });

    it('should handle missing version element gracefully', async () => {
        document.getElementById('version')?.remove();

        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        // Should not throw
        const result = await loadAllData(allData);
        expect(result.success).toBe(true);
    });

    it('should handle missing last-updated element gracefully', async () => {
        document.getElementById('last-updated')?.remove();

        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        // Should not throw
        const result = await loadAllData(allData);
        expect(result.success).toBe(true);
    });
});

describe('data validation', () => {
    it('should validate items have required fields', async () => {
        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        const allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        await loadAllData(allData);

        allData.items.items.forEach(item => {
            expect(item.id).toBeDefined();
            expect(item.name).toBeDefined();
            expect(item.tier).toBeDefined();
            expect(item.base_effect).toBeDefined();
        });
    });

    it('should validate items have scaling_per_stack array', async () => {
        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        const allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        await loadAllData(allData);

        allData.items.items.forEach(item => {
            expect(Array.isArray(item.scaling_per_stack)).toBe(true);
            expect(item.scaling_per_stack).toHaveLength(10);
        });
    });

    it('should validate weapons have required fields', async () => {
        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        const allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        await loadAllData(allData);

        allData.weapons.weapons.forEach(weapon => {
            expect(weapon.id).toBeDefined();
            expect(weapon.name).toBeDefined();
            expect(weapon.tier).toBeDefined();
            expect(weapon.attack_pattern).toBeDefined();
        });
    });

    it('should validate characters have required fields', async () => {
        const mockData = createMockAllData();
        setupFetchMocks(mockData);

        const allData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
        };

        await loadAllData(allData);

        allData.characters.characters.forEach(character => {
            expect(character.id).toBeDefined();
            expect(character.name).toBeDefined();
            expect(character.passive_ability).toBeDefined();
            expect(character.starting_weapon).toBeDefined();
        });
    });
});
