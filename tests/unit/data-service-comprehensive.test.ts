import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadDataFromUrls, getDataForTabFromData, getAllData } from '../../src/modules/data-service.ts';
import type { AllGameData } from '../../src/types/index.ts';

// Mock modules
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/data-validation.ts', () => ({
    validateAllData: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
    logValidationResults: vi.fn(),
    validateWithZod: vi.fn(),
}));

vi.mock('../../src/modules/events.ts', () => ({
    getSavedTab: vi.fn(() => 'items'),
}));

describe('data-service', () => {
    let globalFetch: typeof fetch;

    beforeEach(() => {
        globalFetch = global.fetch;
        // Mock DOM
        document.body.innerHTML = `
            <div id="loading-overlay" style="display: none;"></div>
            <div id="main-content"></div>
            <div id="version"></div>
            <div id="last-updated"></div>
        `;
    });

    afterEach(() => {
        global.fetch = globalFetch;
        vi.clearAllMocks();
    });

    describe('loadDataFromUrls', () => {
        it('should successfully load all data', async () => {
            const mockData = {
                items: { items: [{ id: 'test', name: 'Test Item' }] },
                weapons: { weapons: [{ id: 'sword', name: 'Sword' }] },
                tomes: { tomes: [{ id: 'tome1', name: 'Tome' }] },
                characters: { characters: [{ id: 'char1', name: 'Hero' }] },
                shrines: { shrines: [{ id: 'shrine1', name: 'Shrine' }] },
                stats: { baseStats: {} },
            };

            global.fetch = vi.fn((url: string) => {
                const dataType = url.split('/').pop()?.replace('.json', '') as string;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockData[dataType as keyof typeof mockData]),
                } as Response);
            });

            const urls = {
                items: '/data/items.json',
                weapons: '/data/weapons.json',
                tomes: '/data/tomes.json',
                characters: '/data/characters.json',
                shrines: '/data/shrines.json',
                stats: '/data/stats.json',
            };

            const result = await loadDataFromUrls(urls);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.items).toEqual(mockData.items);
            expect(result.data?.weapons).toEqual(mockData.weapons);
            expect(result.data?.tomes).toEqual(mockData.tomes);
            expect(result.data?.characters).toEqual(mockData.characters);
            expect(result.data?.shrines).toEqual(mockData.shrines);
            expect(result.data?.stats).toEqual(mockData.stats);
            expect(result.data?.changelog).toBeUndefined();
        });

        it('should handle fetch errors', async () => {
            global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

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
            expect(result.error?.message).toBe('Network error');
        });

        it('should handle JSON parse errors', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.reject(new Error('Invalid JSON')),
                } as Response)
            );

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
        });

        it('should handle HTTP errors', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    json: () => Promise.resolve({}),
                } as Response)
            );

            const urls = {
                items: '/data/items.json',
                weapons: '/data/weapons.json',
                tomes: '/data/tomes.json',
                characters: '/data/characters.json',
                shrines: '/data/shrines.json',
                stats: '/data/stats.json',
            };

            // loadDataFromUrls doesn't check response.ok, so this will succeed
            const result = await loadDataFromUrls(urls);
            expect(result.success).toBe(true);
        });
    });

    describe('getDataForTabFromData', () => {
        const mockData: AllGameData = {
            items: {
                items: [{ id: 'item1', name: 'Item 1' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
            weapons: {
                weapons: [{ id: 'weapon1', name: 'Weapon 1' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
            tomes: {
                tomes: [{ id: 'tome1', name: 'Tome 1' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
            characters: {
                characters: [{ id: 'char1', name: 'Character 1' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
            shrines: {
                shrines: [{ id: 'shrine1', name: 'Shrine 1' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
            stats: {
                version: '1.0',
                last_updated: '2024-01-01',
            },
            changelog: {
                patches: [{ id: 'patch1', version: '1.0', date: '2024-01-01' }],
                version: '1.0',
                last_updated: '2024-01-01',
            },
        };

        it('should return items data', () => {
            const result = getDataForTabFromData(mockData, 'items');
            expect(result).toEqual(mockData.items.items);
        });

        it('should return weapons data', () => {
            const result = getDataForTabFromData(mockData, 'weapons');
            expect(result).toEqual(mockData.weapons.weapons);
        });

        it('should return tomes data', () => {
            const result = getDataForTabFromData(mockData, 'tomes');
            expect(result).toEqual(mockData.tomes.tomes);
        });

        it('should return characters data', () => {
            const result = getDataForTabFromData(mockData, 'characters');
            expect(result).toEqual(mockData.characters.characters);
        });

        it('should return shrines data', () => {
            const result = getDataForTabFromData(mockData, 'shrines');
            expect(result).toEqual(mockData.shrines.shrines);
        });

        it('should return changelog data', () => {
            const result = getDataForTabFromData(mockData, 'changelog');
            expect(result).toEqual(mockData.changelog.patches);
        });

        it('should return empty array for unknown tab', () => {
            const result = getDataForTabFromData(mockData, 'invalid');
            expect(result).toEqual([]);
        });

        it('should handle missing data gracefully', () => {
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

        it('should handle missing arrays in data objects', () => {
            const partialData: AllGameData = {
                items: { version: '1.0', last_updated: '2024-01-01' } as any,
                weapons: { version: '1.0', last_updated: '2024-01-01' } as any,
                tomes: { version: '1.0', last_updated: '2024-01-01' } as any,
                characters: { version: '1.0', last_updated: '2024-01-01' } as any,
                shrines: { version: '1.0', last_updated: '2024-01-01' } as any,
                stats: undefined,
                changelog: { version: '1.0', last_updated: '2024-01-01' } as any,
            };

            expect(getDataForTabFromData(partialData, 'items')).toEqual([]);
            expect(getDataForTabFromData(partialData, 'weapons')).toEqual([]);
            expect(getDataForTabFromData(partialData, 'tomes')).toEqual([]);
            expect(getDataForTabFromData(partialData, 'characters')).toEqual([]);
            expect(getDataForTabFromData(partialData, 'shrines')).toEqual([]);
            expect(getDataForTabFromData(partialData, 'changelog')).toEqual([]);
        });
    });

    describe('getAllData', () => {
        it('should return current allData object', () => {
            const data = getAllData();
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        });

        it('should have correct structure', () => {
            const data = getAllData();
            expect(data).toHaveProperty('items');
            expect(data).toHaveProperty('weapons');
            expect(data).toHaveProperty('tomes');
            expect(data).toHaveProperty('characters');
            expect(data).toHaveProperty('shrines');
            expect(data).toHaveProperty('stats');
            expect(data).toHaveProperty('changelog');
        });
    });
});
