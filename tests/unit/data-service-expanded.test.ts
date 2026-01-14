/**
 * Expanded tests for data-service.ts - Data Service Module
 * Additional tests to expand coverage beyond existing tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getDataForTab,
    getDataForTabFromData,
    getAllData,
    allData,
    type LoadDataResult,
} from '../../src/modules/data-service.ts';
import type { AllGameData, Item, Weapon, Tome, Character, Shrine } from '../../src/types/index.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Data Service Module - Expanded Tests', () => {
    let mockData: AllGameData;

    beforeEach(() => {
        mockData = {
            items: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [
                    { id: 'item1', name: 'Item 1', tier: 'A', rarity: 'rare' } as Item,
                    { id: 'item2', name: 'Item 2', tier: 'S', rarity: 'epic' } as Item,
                ],
            },
            weapons: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [
                    { id: 'wpn1', name: 'Weapon 1', tier: 'A' } as Weapon,
                ],
            },
            tomes: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [
                    { id: 'tome1', name: 'Tome 1', tier: 'S' } as Tome,
                ],
            },
            characters: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [
                    { id: 'char1', name: 'Character 1', tier: 'S' } as Character,
                ],
            },
            shrines: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [
                    { id: 'shrine1', name: 'Shrine 1' } as Shrine,
                ],
            },
            stats: null,
        };
    });

    describe('getDataForTab', () => {
        it('should return items for items tab', () => {
            const result = getDataForTab('items');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0); // allData is not populated in test
        });

        it('should return weapons for weapons tab', () => {
            const result = getDataForTab('weapons');

            expect(Array.isArray(result)).toBe(true);
        });

        it('should return tomes for tomes tab', () => {
            const result = getDataForTab('tomes');

            expect(Array.isArray(result)).toBe(true);
        });

        it('should return characters for characters tab', () => {
            const result = getDataForTab('characters');

            expect(Array.isArray(result)).toBe(true);
        });

        it('should return shrines for shrines tab', () => {
            const result = getDataForTab('shrines');

            expect(Array.isArray(result)).toBe(true);
        });

        it('should return empty array for unknown tab', () => {
            const result = getDataForTab('unknown-tab');

            expect(result).toEqual([]);
        });

        it('should return empty array for null tab', () => {
            const result = getDataForTab(null as any);

            expect(result).toEqual([]);
        });

        it('should return empty array for undefined tab', () => {
            const result = getDataForTab(undefined as any);

            expect(result).toEqual([]);
        });

        it('should return empty array for empty string tab', () => {
            const result = getDataForTab('');

            expect(result).toEqual([]);
        });
    });

    describe('getDataForTabFromData', () => {
        it('should return items from provided data', () => {
            const result = getDataForTabFromData(mockData, 'items');

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('name', 'Item 1');
        });

        it('should return weapons from provided data', () => {
            const result = getDataForTabFromData(mockData, 'weapons');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('name', 'Weapon 1');
        });

        it('should return tomes from provided data', () => {
            const result = getDataForTabFromData(mockData, 'tomes');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('name', 'Tome 1');
        });

        it('should return characters from provided data', () => {
            const result = getDataForTabFromData(mockData, 'characters');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('name', 'Character 1');
        });

        it('should return shrines from provided data', () => {
            const result = getDataForTabFromData(mockData, 'shrines');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('name', 'Shrine 1');
        });

        it('should return empty array for unknown tab', () => {
            const result = getDataForTabFromData(mockData, 'unknown');

            expect(result).toEqual([]);
        });

        it('should return empty array when data is null', () => {
            const nullData: AllGameData = {
                items: null,
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            const result = getDataForTabFromData(nullData, 'items');

            expect(result).toEqual([]);
        });

        it('should return empty array when data array is null', () => {
            const dataWithNullItems: AllGameData = {
                ...mockData,
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: null as any,
                },
            };

            const result = getDataForTabFromData(dataWithNullItems, 'items');

            expect(result).toEqual([]);
        });

        it('should return empty array when data array is undefined', () => {
            const dataWithUndefinedItems: AllGameData = {
                ...mockData,
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: undefined as any,
                },
            };

            const result = getDataForTabFromData(dataWithUndefinedItems, 'items');

            expect(result).toEqual([]);
        });

        it('should handle empty data arrays', () => {
            const emptyData: AllGameData = {
                items: { version: '1.0.0', last_updated: '2024-01-01', items: [] },
                weapons: { version: '1.0.0', last_updated: '2024-01-01', weapons: [] },
                tomes: { version: '1.0.0', last_updated: '2024-01-01', tomes: [] },
                characters: { version: '1.0.0', last_updated: '2024-01-01', characters: [] },
                shrines: { version: '1.0.0', last_updated: '2024-01-01', shrines: [] },
                stats: null,
            };

            expect(getDataForTabFromData(emptyData, 'items')).toEqual([]);
            expect(getDataForTabFromData(emptyData, 'weapons')).toEqual([]);
            expect(getDataForTabFromData(emptyData, 'tomes')).toEqual([]);
            expect(getDataForTabFromData(emptyData, 'characters')).toEqual([]);
            expect(getDataForTabFromData(emptyData, 'shrines')).toEqual([]);
        });

        it('should handle large datasets', () => {
            const largeItems = Array.from({ length: 1000 }, (_, i) => ({
                id: `item${i}`,
                name: `Item ${i}`,
                tier: 'A' as const,
                rarity: 'rare' as const,
            })) as Item[];

            const largeData: AllGameData = {
                ...mockData,
                items: { version: '1.0.0', last_updated: '2024-01-01', items: largeItems },
            };

            const result = getDataForTabFromData(largeData, 'items');

            expect(result).toHaveLength(1000);
        });

        it('should return original array reference (not copy)', () => {
            const result1 = getDataForTabFromData(mockData, 'items');
            const result2 = getDataForTabFromData(mockData, 'items');

            expect(result1).toBe(result2);
        });

        it('should handle all tab types', () => {
            const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

            tabs.forEach(tab => {
                const result = getDataForTabFromData(mockData, tab);
                expect(Array.isArray(result)).toBe(true);
            });
        });

        it('should preserve item properties', () => {
            const result = getDataForTabFromData(mockData, 'items');

            expect(result[0]).toHaveProperty('id', 'item1');
            expect(result[0]).toHaveProperty('name', 'Item 1');
            expect(result[0]).toHaveProperty('tier', 'A');
            expect(result[0]).toHaveProperty('rarity', 'rare');
        });

        it('should handle null tab name', () => {
            const result = getDataForTabFromData(mockData, null as any);

            expect(result).toEqual([]);
        });

        it('should handle undefined tab name', () => {
            const result = getDataForTabFromData(mockData, undefined as any);

            expect(result).toEqual([]);
        });

        it('should handle empty string tab name', () => {
            const result = getDataForTabFromData(mockData, '');

            expect(result).toEqual([]);
        });
    });

    describe('getAllData', () => {
        it('should return allData object', () => {
            const result = getAllData();

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should have expected properties', () => {
            const result = getAllData();

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('weapons');
            expect(result).toHaveProperty('tomes');
            expect(result).toHaveProperty('characters');
            expect(result).toHaveProperty('shrines');
            expect(result).toHaveProperty('stats');
        });

        it('should return same reference on multiple calls', () => {
            const result1 = getAllData();
            const result2 = getAllData();

            expect(result1).toBe(result2);
        });

        it('should return reference to allData export', () => {
            const result = getAllData();

            expect(result).toBe(allData);
        });
    });

    describe('Data Structure Validation', () => {
        it('should handle data with extra properties', () => {
            const dataWithExtra: AllGameData & { extra: string } = {
                ...mockData,
                extra: 'extra property',
            };

            const result = getDataForTabFromData(dataWithExtra, 'items');

            expect(result).toHaveLength(2);
        });

        it('should handle items with minimal properties', () => {
            const minimalData: AllGameData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'item1', name: 'Item', tier: 'A', rarity: 'common' } as Item,
                    ],
                },
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            const result = getDataForTabFromData(minimalData, 'items');

            expect(result).toHaveLength(1);
        });

        it('should handle items with all optional properties', () => {
            const fullItem: Item = {
                id: 'item1',
                name: 'Full Item',
                tier: 'SS',
                rarity: 'legendary',
                description: 'Description',
                base_effect: 'Effect',
                scaling_per_stack: [10, 20],
                one_and_done: true,
                stacks_well: false,
                synergies: ['item2'],
                anti_synergies: ['item3'],
                image: 'image.png',
            } as Item;

            const fullData: AllGameData = {
                items: { version: '1.0.0', last_updated: '2024-01-01', items: [fullItem] },
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            const result = getDataForTabFromData(fullData, 'items');

            expect(result[0]).toHaveProperty('synergies');
            expect(result[0]).toHaveProperty('one_and_done');
        });
    });

    describe('Edge Cases', () => {
        it('should handle very nested data structures', () => {
            const nestedItem = {
                id: 'item1',
                name: 'Nested',
                tier: 'A',
                rarity: 'rare',
                nested: {
                    level1: {
                        level2: {
                            value: 'deep',
                        },
                    },
                },
            } as any;

            const nestedData: AllGameData = {
                items: { version: '1.0.0', last_updated: '2024-01-01', items: [nestedItem] },
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            const result = getDataForTabFromData(nestedData, 'items');

            expect(result).toHaveLength(1);
        });

        it('should handle mixed valid and invalid items', () => {
            const mixedData: AllGameData = {
                items: {
                    version: '1.0.0',
                    last_updated: '2024-01-01',
                    items: [
                        { id: 'item1', name: 'Valid', tier: 'A', rarity: 'rare' } as Item,
                        null as any,
                        { id: 'item2', name: 'Also Valid', tier: 'B', rarity: 'common' } as Item,
                    ],
                },
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            const result = getDataForTabFromData(mixedData, 'items');

            expect(result).toHaveLength(3); // Returns array as-is, including null
        });

        it('should handle data with circular references', () => {
            const circularData: any = {
                items: { version: '1.0.0', last_updated: '2024-01-01', items: [] },
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
                stats: null,
            };

            circularData.items.self = circularData;

            expect(() => {
                getDataForTabFromData(circularData, 'items');
            }).not.toThrow();
        });

        it('should handle extremely long tab names', () => {
            const longTabName = 'a'.repeat(10000);

            const result = getDataForTabFromData(mockData, longTabName);

            expect(result).toEqual([]);
        });

        it('should handle special characters in tab names', () => {
            const specialTabs = ['items!', 'weapons?', 'tomes#', '<script>alert(1)</script>'];

            specialTabs.forEach(tab => {
                const result = getDataForTabFromData(mockData, tab);
                expect(result).toEqual([]);
            });
        });

        it('should handle case-sensitive tab names', () => {
            const result1 = getDataForTabFromData(mockData, 'Items');
            const result2 = getDataForTabFromData(mockData, 'ITEMS');
            const result3 = getDataForTabFromData(mockData, 'items');

            expect(result1).toEqual([]);
            expect(result2).toEqual([]);
            expect(result3).toHaveLength(2); // Only exact match works
        });
    });

    describe('Performance Considerations', () => {
        it('should handle repeated calls efficiently', () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                getDataForTabFromData(mockData, 'items');
            }

            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
        });

        it('should handle all tab types in sequence', () => {
            const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

            tabs.forEach(tab => {
                const result = getDataForTabFromData(mockData, tab);
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });
});
