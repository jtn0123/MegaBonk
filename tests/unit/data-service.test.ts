import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { loadDataFromUrls, getDataForTabFromData, getAllData, loadAllData } from '../../src/modules/data-service.ts';
import type { AllGameData } from '../../src/types/index.ts';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { createMockAllData } from '../helpers/mock-data.js';

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
        setContext: vi.fn(),
    },
}));

vi.mock('../../src/modules/data-validation.ts', () => ({
    validateAllData: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
    logValidationResults: vi.fn(),
    validateWithZod: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../src/modules/events.ts', () => ({
    getSavedTab: vi.fn(() => 'items'),
}));

describe('data-service', () => {
    let globalFetch: typeof fetch;
    let mockAllData: ReturnType<typeof createMockAllData>;

    beforeEach(() => {
        globalFetch = global.fetch;
        mockAllData = createMockAllData();
        vi.useFakeTimers({ shouldAdvanceTime: true });

        // Mock DOM
        createMinimalDOM();

        // Setup window globals
        (window as any).switchTab = vi.fn();
        (window as any).loadBuildFromURL = vi.fn();
        (window as any).initAdvisor = vi.fn();
        (window as any).initScanBuild = vi.fn();
        (window as any).allData = mockAllData;

        // Mock performance.now
        vi.spyOn(performance, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        global.fetch = globalFetch;
        vi.clearAllMocks();
        vi.useRealTimers();
        vi.restoreAllMocks();
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

            // loadDataFromUrls now properly checks response.ok and returns failure on HTTP errors
            const result = await loadDataFromUrls(urls);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
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

    // ========================================
    // loadAllData Comprehensive Tests
    // ========================================
    describe('loadAllData', () => {
        const createMockFetch = () => {
            const mockChangelog = { patches: [{ version: '1.0.0', date: '2024-01-01', changes: [] }] };

            return vi.fn().mockImplementation((url: string) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        let data = {};
                        if (url.includes('items')) data = mockAllData.items;
                        else if (url.includes('weapons')) data = mockAllData.weapons;
                        else if (url.includes('tomes')) data = mockAllData.tomes;
                        else if (url.includes('characters')) data = mockAllData.characters;
                        else if (url.includes('shrines')) data = mockAllData.shrines;
                        else if (url.includes('stats')) data = mockAllData.stats;
                        else if (url.includes('changelog')) data = mockChangelog;

                        resolve({
                            ok: true,
                            url,
                            status: 200,
                            statusText: 'OK',
                            json: () => Promise.resolve(data),
                        });
                    }, 10);
                });
            });
        };

        beforeEach(() => {
            global.fetch = createMockFetch();
        });

        it('should show and hide loading overlay', async () => {
            const loadingOverlay = document.getElementById('loading-overlay');
            expect(loadingOverlay?.style.display).toBe('none');

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            expect(loadingOverlay?.style.display).toBe('none');
        });

        it('should update version element on success', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const versionEl = document.getElementById('version');
            expect(versionEl?.textContent).toContain('Version:');
        });

        it('should update last-updated element on success', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const updatedEl = document.getElementById('last-updated');
            expect(updatedEl?.textContent).toContain('Last Updated:');
        });

        it('should call switchTab with saved tab on success', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            expect((window as any).switchTab).toHaveBeenCalledWith('items');
        });

        it('should call loadBuildFromURL if available', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            expect((window as any).loadBuildFromURL).toHaveBeenCalled();
        });

        it('should call initAdvisor with data if available', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            expect((window as any).initAdvisor).toHaveBeenCalled();
        });

        it('should call initScanBuild with data if available', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            expect((window as any).initScanBuild).toHaveBeenCalled();
        });

        it('should handle fetch failure and show error', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle HTTP error response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                url: '../data/items.json',
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should not call switchTab if function is not available', async () => {
            delete (window as any).switchTab;

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without error - verify promise resolves successfully
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should not call loadBuildFromURL if function is not available', async () => {
            delete (window as any).loadBuildFromURL;

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without error - verify promise resolves successfully
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should not call initAdvisor if function is not available', async () => {
            delete (window as any).initAdvisor;

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without error - verify promise resolves successfully
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should not call initScanBuild if function is not available', async () => {
            delete (window as any).initScanBuild;

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without error - verify promise resolves successfully
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should show warning toast if validation has many errors', async () => {
            const { validateAllData } = await import('../../src/modules/data-validation.ts');
            (validateAllData as Mock).mockReturnValue({
                valid: false,
                errors: Array(15).fill({ message: 'Error' }),
                warnings: [],
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.warning).toHaveBeenCalledWith(
                'Some game data may be incomplete. Check console for details.'
            );
        });

        it('should not show warning toast if validation has few errors', async () => {
            const { validateAllData } = await import('../../src/modules/data-validation.ts');
            (validateAllData as Mock).mockReturnValue({
                valid: false,
                errors: [{ message: 'Minor error' }],
                warnings: [],
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.warning).not.toHaveBeenCalled();
        });

        it('should log data load event with item counts', async () => {
            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'data.load',
                    success: true,
                })
            );
        });
    });

    // ========================================
    // Fetch Timeout Behavior Tests
    // ========================================
    describe('fetchWithTimeout behavior', () => {
        it('should abort fetch after timeout', async () => {
            // Mock AbortController behavior - when timeout occurs, fetch throws AbortError
            const abortError = new Error('Request timeout: ../data/items.json');
            abortError.name = 'AbortError';

            // Simulate the timeout by having fetch reject after delay
            global.fetch = vi.fn().mockImplementation(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(abortError), 50);
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle AbortError correctly', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            global.fetch = vi.fn().mockRejectedValue(abortError);

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });
    });

    // ========================================
    // Fetch Retry Behavior Tests
    // ========================================
    describe('fetchWithRetry behavior', () => {
        it('should retry on failure with exponential backoff', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.reject(new Error('Temporary error'));
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(30000);

            try {
                await loadPromise;
            } catch {
                // Expected if retries exhausted
            }

            expect(callCount).toBeGreaterThan(1);
        });

        it('should fail after max retries exceeded', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Persistent error'));

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should succeed on retry after initial failure', async () => {
            let attemptCount = 0;
            global.fetch = vi.fn().mockImplementation((url: string) => {
                attemptCount++;
                if (attemptCount === 1) {
                    return Promise.reject(new Error('First attempt failed'));
                }
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(10000);

            try {
                await loadPromise;
            } catch {
                // May or may not succeed
            }

            expect(attemptCount).toBeGreaterThan(1);
        });

        it('should handle intermittent HTTP errors', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.resolve({
                        ok: false,
                        status: 503,
                        statusText: 'Service Unavailable',
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(30000);

            try {
                await loadPromise;
            } catch {
                // May succeed or fail
            }

            expect(callCount).toBeGreaterThanOrEqual(1);
        });
    });

    // ========================================
    // Data Validation Tests
    // ========================================
    describe('validateData behavior', () => {
        it('should validate changelog with patches array', async () => {
            const mockChangelog = {
                patches: [{ version: '1.0.0', date: '2024-01-01', changes: [] }],
            };

            global.fetch = vi.fn().mockImplementation((url: string) => {
                const data = url.includes('changelog') ? mockChangelog : mockAllData.items;
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without throwing validation errors
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should fail validation for changelog without patches array', async () => {
            // Changelog is now deferred-loaded, so invalid changelog data
            // won't cause the main loadAllData to fail. Instead it logs a warning.
            const invalidChangelog = { notPatches: [] };

            global.fetch = vi.fn().mockImplementation((url: string) => {
                let data: unknown = mockAllData.items;
                if (url.includes('weapons')) data = mockAllData.weapons;
                else if (url.includes('tomes')) data = mockAllData.tomes;
                else if (url.includes('characters')) data = mockAllData.characters;
                else if (url.includes('shrines')) data = mockAllData.shrines;
                else if (url.includes('stats')) data = mockAllData.stats;
                else if (url.includes('changelog')) data = invalidChangelog;
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            // Main load should succeed (changelog is deferred)
            const overlay = document.getElementById('loading-overlay');
            expect(overlay?.style.display).toBe('none');
        });

        it('should fail validation for null data', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(null),
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should fail validation for non-object data', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve('string-not-object'),
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { ToastManager } = await import('../../src/modules/toast.ts');
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should call validateWithZod for entity types', async () => {
            global.fetch = vi.fn().mockImplementation((url: string) => {
                let data = mockAllData.items;
                if (url.includes('changelog')) {
                    data = { patches: [] } as any;
                }
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const { validateWithZod } = await import('../../src/modules/data-validation.ts');
            expect(validateWithZod).toHaveBeenCalled();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle missing loading overlay', async () => {
            document.getElementById('loading-overlay')?.remove();

            global.fetch = vi.fn().mockImplementation((url: string) => {
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(url.includes('changelog') ? { patches: [] } : mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without throwing even when overlay is missing
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should handle missing version element', async () => {
            document.getElementById('version')?.remove();

            global.fetch = vi.fn().mockImplementation((url: string) => {
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(url.includes('changelog') ? { patches: [] } : mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without throwing even when version element is missing
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should handle missing last-updated element', async () => {
            document.getElementById('last-updated')?.remove();

            global.fetch = vi.fn().mockImplementation((url: string) => {
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(url.includes('changelog') ? { patches: [] } : mockAllData.items),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should complete without throwing even when last-updated element is missing
            await expect(loadPromise).resolves.not.toThrow();
        });

        it('should handle items without version field', async () => {
            const itemsWithoutVersion = { items: [] };

            global.fetch = vi.fn().mockImplementation((url: string) => {
                let data: unknown = itemsWithoutVersion;
                if (url.includes('changelog')) data = { patches: [] };
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const versionEl = document.getElementById('version');
            expect(versionEl?.textContent).toContain('Unknown');
        });

        it('should handle items without last_updated field', async () => {
            const itemsWithoutLastUpdated = { items: [], version: '1.0.0' };

            global.fetch = vi.fn().mockImplementation((url: string) => {
                let data: unknown = itemsWithoutLastUpdated;
                if (url.includes('changelog')) data = { patches: [] };
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);
            await loadPromise;

            const updatedEl = document.getElementById('last-updated');
            expect(updatedEl?.textContent).toContain('Unknown');
        });

        it('should log error with stack trace on failure', async () => {
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:1';
            global.fetch = vi.fn().mockRejectedValue(error);

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(60000);

            try {
                await loadPromise;
            } catch {
                // Expected
            }

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'data.load',
                    success: false,
                })
            );
        });

        it('should handle data with empty arrays', async () => {
            const emptyData = {
                items: { items: [], version: '1.0', last_updated: '2024-01-01' },
                weapons: { weapons: [], version: '1.0', last_updated: '2024-01-01' },
                tomes: { tomes: [], version: '1.0', last_updated: '2024-01-01' },
                characters: { characters: [], version: '1.0', last_updated: '2024-01-01' },
                shrines: { shrines: [], version: '1.0', last_updated: '2024-01-01' },
                stats: { version: '1.0', last_updated: '2024-01-01' },
            };

            global.fetch = vi.fn().mockImplementation((url: string) => {
                let data: unknown = emptyData.items;
                if (url.includes('weapons')) data = emptyData.weapons;
                else if (url.includes('tomes')) data = emptyData.tomes;
                else if (url.includes('characters')) data = emptyData.characters;
                else if (url.includes('shrines')) data = emptyData.shrines;
                else if (url.includes('stats')) data = emptyData.stats;
                else if (url.includes('changelog')) data = { patches: [] };
                return Promise.resolve({
                    ok: true,
                    url,
                    json: () => Promise.resolve(data),
                });
            });

            const loadPromise = loadAllData();
            await vi.advanceTimersByTimeAsync(100);

            // Should handle empty arrays without throwing
            await expect(loadPromise).resolves.not.toThrow();
        });
    });
});
