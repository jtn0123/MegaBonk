/**
 * @vitest-environment jsdom
 * Global Search Module Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { globalSearch, type GlobalSearchResult } from '../../src/modules/global-search.ts';
import type { AllGameData, Item, Weapon, Tome, Character, Shrine } from '../../src/types/index.ts';

// ========================================
// Test Fixtures
// ========================================

const createItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'test_item',
    name: 'Test Item',
    tier: 'A',
    rarity: 'common',
    description: 'A test item description',
    effect: 'Test effect',
    ...overrides,
} as Item);

const createWeapon = (overrides: Partial<Weapon> = {}): Weapon => ({
    id: 'test_weapon',
    name: 'Test Weapon',
    tier: 'A',
    rarity: 'common',
    description: 'A test weapon',
    ...overrides,
} as Weapon);

const createTome = (overrides: Partial<Tome> = {}): Tome => ({
    id: 'test_tome',
    name: 'Test Tome',
    tier: 'A',
    rarity: 'common',
    description: 'A test tome',
    ...overrides,
} as Tome);

const createCharacter = (overrides: Partial<Character> = {}): Character => ({
    id: 'test_char',
    name: 'Test Character',
    tier: 'A',
    rarity: 'common',
    description: 'A test character',
    ...overrides,
} as Character);

const createShrine = (overrides: Partial<Shrine> = {}): Shrine => ({
    id: 'test_shrine',
    name: 'Test Shrine',
    tier: 'A',
    rarity: 'common',
    description: 'A test shrine',
    ...overrides,
} as Shrine);

const createAllData = (overrides: Partial<AllGameData> = {}): AllGameData => ({
    items: {
        items: [
            createItem({ id: 'sword', name: 'Sword of Power' }),
            createItem({ id: 'shield', name: 'Shield of Light' }),
            createItem({ id: 'potion', name: 'Healing Potion' }),
        ],
        version: '1.0',
        last_updated: '2024-01-01',
    },
    weapons: {
        weapons: [
            createWeapon({ id: 'axe', name: 'Battle Axe' }),
            createWeapon({ id: 'bow', name: 'Long Bow' }),
        ],
        version: '1.0',
        last_updated: '2024-01-01',
    },
    tomes: {
        tomes: [
            createTome({ id: 'fire', name: 'Fire Tome' }),
            createTome({ id: 'ice', name: 'Ice Tome' }),
        ],
        version: '1.0',
        last_updated: '2024-01-01',
    },
    characters: {
        characters: [
            createCharacter({ id: 'warrior', name: 'Warrior' }),
            createCharacter({ id: 'mage', name: 'Mage' }),
        ],
        version: '1.0',
        last_updated: '2024-01-01',
    },
    shrines: {
        shrines: [
            createShrine({ id: 'health', name: 'Health Shrine' }),
            createShrine({ id: 'damage', name: 'Damage Shrine' }),
        ],
        version: '1.0',
        last_updated: '2024-01-01',
    },
    ...overrides,
});

describe('Global Search Module', () => {
    // ========================================
    // Basic Search Tests
    // ========================================
    describe('globalSearch', () => {
        it('should return empty array for empty query', () => {
            const allData = createAllData();
            const results = globalSearch('', allData);
            expect(results).toEqual([]);
        });

        it('should return empty array for whitespace query', () => {
            const allData = createAllData();
            const results = globalSearch('   ', allData);
            expect(results).toEqual([]);
        });

        it('should find items by name', () => {
            const allData = createAllData();
            const results = globalSearch('Sword', allData);
            
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.item.name === 'Sword of Power')).toBe(true);
        });

        it('should find weapons by name', () => {
            const allData = createAllData();
            const results = globalSearch('Axe', allData);
            
            expect(results.some(r => r.item.name === 'Battle Axe')).toBe(true);
            expect(results.some(r => r.type === 'weapons')).toBe(true);
        });

        it('should find tomes by name', () => {
            const allData = createAllData();
            const results = globalSearch('Fire', allData);
            
            expect(results.some(r => r.item.name === 'Fire Tome')).toBe(true);
            expect(results.some(r => r.type === 'tomes')).toBe(true);
        });

        it('should find characters by name', () => {
            const allData = createAllData();
            const results = globalSearch('Warrior', allData);
            
            expect(results.some(r => r.item.name === 'Warrior')).toBe(true);
            expect(results.some(r => r.type === 'characters')).toBe(true);
        });

        it('should find shrines by name', () => {
            const allData = createAllData();
            const results = globalSearch('Health', allData);
            
            expect(results.some(r => r.item.name === 'Health Shrine')).toBe(true);
            expect(results.some(r => r.type === 'shrines')).toBe(true);
        });

        it('should be case insensitive', () => {
            const allData = createAllData();
            
            const lower = globalSearch('sword', allData);
            const upper = globalSearch('SWORD', allData);
            const mixed = globalSearch('SwOrD', allData);
            
            expect(lower.length).toBe(upper.length);
            expect(lower.length).toBe(mixed.length);
        });

        it('should return results sorted by score', () => {
            const allData = createAllData();
            const results = globalSearch('Sword', allData);
            
            // Results should be sorted by score (descending)
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });

    // ========================================
    // Return Type Tests
    // ========================================
    describe('result structure', () => {
        it('should return results with correct structure', () => {
            const allData = createAllData();
            const results = globalSearch('Sword', allData);
            
            expect(results.length).toBeGreaterThan(0);
            
            const result = results[0];
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('item');
            expect(result).toHaveProperty('score');
        });

        it('should have valid type for each result', () => {
            const allData = createAllData();
            const results = globalSearch('test', allData);
            
            const validTypes = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
            
            results.forEach(result => {
                expect(validTypes).toContain(result.type);
            });
        });

        it('should have positive scores for matches', () => {
            const allData = createAllData();
            const results = globalSearch('Sword', allData);
            
            results.forEach(result => {
                expect(result.score).toBeGreaterThan(0);
            });
        });
    });

    // ========================================
    // Cross-type Search Tests
    // ========================================
    describe('cross-type search', () => {
        it('should search across all types', () => {
            const allData: AllGameData = {
                items: {
                    items: [createItem({ name: 'Alpha Item' })],
                    version: '1.0',
                    last_updated: '',
                },
                weapons: {
                    weapons: [createWeapon({ name: 'Alpha Weapon' })],
                    version: '1.0',
                    last_updated: '',
                },
                tomes: {
                    tomes: [createTome({ name: 'Alpha Tome' })],
                    version: '1.0',
                    last_updated: '',
                },
                characters: {
                    characters: [createCharacter({ name: 'Alpha Character' })],
                    version: '1.0',
                    last_updated: '',
                },
                shrines: {
                    shrines: [createShrine({ name: 'Alpha Shrine' })],
                    version: '1.0',
                    last_updated: '',
                },
            };
            
            const results = globalSearch('Alpha', allData);
            
            // Should find matches in all 5 types
            const types = new Set(results.map(r => r.type));
            expect(types.size).toBe(5);
        });

        it('should prioritize exact matches', () => {
            const allData: AllGameData = {
                items: {
                    items: [
                        createItem({ id: 'exact', name: 'Sword' }),
                        createItem({ id: 'partial', name: 'Sword of Power' }),
                    ],
                    version: '1.0',
                    last_updated: '',
                },
            };
            
            const results = globalSearch('Sword', allData);
            
            // Exact match should have higher score
            const exactMatch = results.find(r => r.item.name === 'Sword');
            const partialMatch = results.find(r => r.item.name === 'Sword of Power');
            
            if (exactMatch && partialMatch) {
                expect(exactMatch.score).toBeGreaterThanOrEqual(partialMatch.score);
            }
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle undefined data sources', () => {
            const allData: AllGameData = {
                items: undefined,
                weapons: undefined,
                tomes: undefined,
                characters: undefined,
                shrines: undefined,
            };
            
            const results = globalSearch('test', allData);
            expect(results).toEqual([]);
        });

        it('should handle empty data arrays', () => {
            const allData: AllGameData = {
                items: { items: [], version: '1.0', last_updated: '' },
                weapons: { weapons: [], version: '1.0', last_updated: '' },
                tomes: { tomes: [], version: '1.0', last_updated: '' },
                characters: { characters: [], version: '1.0', last_updated: '' },
                shrines: { shrines: [], version: '1.0', last_updated: '' },
            };
            
            const results = globalSearch('test', allData);
            expect(results).toEqual([]);
        });

        it('should handle special characters in query', () => {
            const allData = createAllData();
            
            // Should not throw
            expect(() => globalSearch('test!@#$%', allData)).not.toThrow();
            expect(() => globalSearch('[regex]', allData)).not.toThrow();
        });

        it('should handle very long queries', () => {
            const allData = createAllData();
            const longQuery = 'a'.repeat(1000);
            
            // Should not throw and return empty (no match)
            const results = globalSearch(longQuery, allData);
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle partial data', () => {
            const allData: AllGameData = {
                items: {
                    items: [createItem({ name: 'Found Item' })],
                    version: '1.0',
                    last_updated: '',
                },
                // Other types undefined
            };
            
            const results = globalSearch('Found', allData);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle query with leading/trailing whitespace', () => {
            const allData = createAllData();
            
            const normal = globalSearch('Sword', allData);
            const padded = globalSearch('  Sword  ', allData);
            
            expect(normal.length).toBe(padded.length);
        });
    });

    // ========================================
    // No Match Tests
    // ========================================
    describe('no matches', () => {
        it('should return empty array when nothing matches', () => {
            const allData = createAllData();
            const results = globalSearch('xyznonexistent', allData);
            expect(results).toEqual([]);
        });

        it('should return empty array for single character that matches nothing', () => {
            const allData: AllGameData = {
                items: {
                    items: [createItem({ name: 'Test' })],
                    version: '1.0',
                    last_updated: '',
                },
            };
            
            // 'z' doesn't appear in 'Test'
            const results = globalSearch('z', allData);
            expect(results).toEqual([]);
        });
    });
});
