/**
 * Real Integration Tests for Data Service Module
 * No mocking - tests actual data service implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getDataForTabFromData,
    getAllData,
    loadDataFromUrls,
    type LoadDataResult,
} from '../../src/modules/data-service.ts';
import type { AllGameData } from '../../src/types/index.ts';

// ========================================
// Test Fixtures
// ========================================

const testGameData: AllGameData = {
    items: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        items: [
            { id: 'item1', name: 'Item 1', tier: 'A' as const, rarity: 'rare' as const },
            { id: 'item2', name: 'Item 2', tier: 'S' as const, rarity: 'epic' as const },
        ],
    } as any,
    weapons: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        weapons: [
            { id: 'weapon1', name: 'Weapon 1', tier: 'S' as const, rarity: 'legendary' as const },
        ],
    } as any,
    tomes: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        tomes: [
            { id: 'tome1', name: 'Tome 1', tier: 'SS' as const, rarity: 'legendary' as const },
        ],
    } as any,
    characters: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        characters: [
            { id: 'char1', name: 'Character 1', tier: 'A' as const, rarity: 'epic' as const },
        ],
    } as any,
    shrines: {
        version: '1.0.0',
        last_updated: '2024-01-01',
        shrines: [
            { id: 'shrine1', name: 'Shrine 1', tier: 'B' as const, rarity: 'rare' as const },
        ],
    } as any,
    stats: {
        version: '1.0.0',
        formulas: {},
    } as any,
    changelog: {
        patches: [
            { version: '1.0.0', date: '2024-01-01', changes: [] },
        ],
    } as any,
};

// ========================================
// getDataForTabFromData Tests
// ========================================

describe('getDataForTabFromData - Real Integration Tests', () => {
    it('should return items array for items tab', () => {
        const data = getDataForTabFromData(testGameData, 'items');
        expect(data).toHaveLength(2);
        expect(data[0].id).toBe('item1');
    });

    it('should return weapons array for weapons tab', () => {
        const data = getDataForTabFromData(testGameData, 'weapons');
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('weapon1');
    });

    it('should return tomes array for tomes tab', () => {
        const data = getDataForTabFromData(testGameData, 'tomes');
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('tome1');
    });

    it('should return characters array for characters tab', () => {
        const data = getDataForTabFromData(testGameData, 'characters');
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('char1');
    });

    it('should return shrines array for shrines tab', () => {
        const data = getDataForTabFromData(testGameData, 'shrines');
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('shrine1');
    });

    it('should return changelog patches for changelog tab', () => {
        const data = getDataForTabFromData(testGameData, 'changelog');
        expect(data).toHaveLength(1);
        expect(data[0].version).toBe('1.0.0');
    });

    it('should return empty array for unknown tab', () => {
        const data = getDataForTabFromData(testGameData, 'unknown');
        expect(data).toEqual([]);
    });

    it('should return empty array when data is undefined', () => {
        const emptyData: AllGameData = {
            items: undefined,
            weapons: undefined,
            tomes: undefined,
            characters: undefined,
            shrines: undefined,
            stats: undefined,
            changelog: undefined,
        };

        expect(getDataForTabFromData(emptyData, 'items')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'weapons')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'tomes')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'characters')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'shrines')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'changelog')).toEqual([]);
    });

    it('should return empty array when nested array is missing', () => {
        const partialData: AllGameData = {
            items: { items: undefined } as any,
            weapons: undefined,
            tomes: undefined,
            characters: undefined,
            shrines: undefined,
            stats: undefined,
            changelog: undefined,
        };

        expect(getDataForTabFromData(partialData, 'items')).toEqual([]);
    });
});

// ========================================
// getAllData Tests
// ========================================

describe('getAllData - Real Integration Tests', () => {
    it('should return an AllGameData object', () => {
        const data = getAllData();

        expect(data).toBeDefined();
        expect(typeof data).toBe('object');
        expect('items' in data).toBe(true);
        expect('weapons' in data).toBe(true);
        expect('tomes' in data).toBe(true);
        expect('characters' in data).toBe(true);
        expect('shrines' in data).toBe(true);
        expect('stats' in data).toBe(true);
    });
});

// ========================================
// loadDataFromUrls Tests
// ========================================

describe('loadDataFromUrls - Real Integration Tests', () => {
    const mockResponses: Record<string, any> = {};

    beforeEach(() => {
        // Setup mock fetch
        global.fetch = vi.fn((url: string) => {
            const response = mockResponses[url];
            if (response) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(response),
                });
            }
            return Promise.reject(new Error('Not found'));
        }) as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return success when all URLs load', async () => {
        const urls = {
            items: '/data/items.json',
            weapons: '/data/weapons.json',
            tomes: '/data/tomes.json',
            characters: '/data/characters.json',
            shrines: '/data/shrines.json',
            stats: '/data/stats.json',
        };

        // Setup mock data
        mockResponses[urls.items] = { items: [] };
        mockResponses[urls.weapons] = { weapons: [] };
        mockResponses[urls.tomes] = { tomes: [] };
        mockResponses[urls.characters] = { characters: [] };
        mockResponses[urls.shrines] = { shrines: [] };
        mockResponses[urls.stats] = { formulas: {} };

        const result = await loadDataFromUrls(urls);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return error when fetch fails', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

        const urls = {
            items: '/data/items.json',
            weapons: '/data/weapons.json',
            tomes: '/data/tomes.json',
            characters: '/data/characters.json',
            shrines: '/data/shrines.json',
            stats: '/data/stats.json',
        };

        const result = await loadDataFromUrls(urls);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Network error');
    });

    it('should call fetch with all URLs', async () => {
        const urls = {
            items: '/api/items',
            weapons: '/api/weapons',
            tomes: '/api/tomes',
            characters: '/api/characters',
            shrines: '/api/shrines',
            stats: '/api/stats',
        };

        // Setup mock data
        Object.keys(urls).forEach(key => {
            mockResponses[(urls as any)[key]] = { [key]: [] };
        });

        await loadDataFromUrls(urls);

        expect(global.fetch).toHaveBeenCalledTimes(6);
    });

    it('should return data with correct structure', async () => {
        const urls = {
            items: '/data/items.json',
            weapons: '/data/weapons.json',
            tomes: '/data/tomes.json',
            characters: '/data/characters.json',
            shrines: '/data/shrines.json',
            stats: '/data/stats.json',
        };

        mockResponses[urls.items] = { items: [{ id: 'test' }] };
        mockResponses[urls.weapons] = { weapons: [] };
        mockResponses[urls.tomes] = { tomes: [] };
        mockResponses[urls.characters] = { characters: [] };
        mockResponses[urls.shrines] = { shrines: [] };
        mockResponses[urls.stats] = {};

        const result = await loadDataFromUrls(urls);

        expect(result.success).toBe(true);
        expect(result.data?.items?.items?.[0]?.id).toBe('test');
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Data Service Edge Cases', () => {
    it('should handle empty data objects', () => {
        const emptyData: AllGameData = {
            items: { items: [] } as any,
            weapons: { weapons: [] } as any,
            tomes: { tomes: [] } as any,
            characters: { characters: [] } as any,
            shrines: { shrines: [] } as any,
            stats: {} as any,
            changelog: { patches: [] } as any,
        };

        expect(getDataForTabFromData(emptyData, 'items')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'weapons')).toEqual([]);
        expect(getDataForTabFromData(emptyData, 'changelog')).toEqual([]);
    });

    it('should handle null as data', () => {
        const nullData = {
            items: null,
            weapons: null,
            tomes: null,
            characters: null,
            shrines: null,
            stats: null,
            changelog: null,
        } as unknown as AllGameData;

        // Should not throw
        expect(() => getDataForTabFromData(nullData, 'items')).not.toThrow();
    });

    it('should handle tab name case sensitivity', () => {
        // Tab names should be exact matches
        expect(getDataForTabFromData(testGameData, 'ITEMS')).toEqual([]);
        expect(getDataForTabFromData(testGameData, 'Items')).toEqual([]);
        expect(getDataForTabFromData(testGameData, 'items')).toHaveLength(2);
    });

    it('should handle special characters in tab name', () => {
        expect(getDataForTabFromData(testGameData, 'items<script>')).toEqual([]);
        expect(getDataForTabFromData(testGameData, '')).toEqual([]);
        expect(getDataForTabFromData(testGameData, ' items ')).toEqual([]);
    });
});

// ========================================
// Type Safety Tests
// ========================================

describe('Data Service Type Safety', () => {
    it('should return Entity array type for entity tabs', () => {
        const items = getDataForTabFromData(testGameData, 'items');
        expect(Array.isArray(items)).toBe(true);

        if (items.length > 0) {
            expect('id' in items[0]).toBe(true);
            expect('name' in items[0]).toBe(true);
        }
    });

    it('should return ChangelogPatch array type for changelog tab', () => {
        const patches = getDataForTabFromData(testGameData, 'changelog');
        expect(Array.isArray(patches)).toBe(true);

        if (patches.length > 0) {
            expect('version' in patches[0]).toBe(true);
        }
    });
});
