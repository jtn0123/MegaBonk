import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    createMockItem,
    createMockWeapon,
    createMockCharacter,
    createMockTome,
    createMockShrine,
    createMockAllData,
} from '../helpers/mock-data.js';

// Import the global search function
import { globalSearch, fuzzyMatchScore } from '../../src/modules/filters.ts';

describe('Global Search Functionality', () => {
    let mockAllData;

    beforeEach(() => {
        createMinimalDOM();
        mockAllData = createMockAllData();
    });

    describe('globalSearch()', () => {
        it('should return empty array for empty query', () => {
            const results = globalSearch('', mockAllData);
            expect(results).toEqual([]);
        });

        it('should return empty array for whitespace-only query', () => {
            const results = globalSearch('   ', mockAllData);
            expect(results).toEqual([]);
        });

        it('should find items by name', () => {
            const results = globalSearch('gym', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.type === 'items' && r.item.name === 'Gym Sauce')).toBe(true);
        });

        it('should find weapons by name', () => {
            const results = globalSearch('revolver', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.type === 'weapons' && r.item.name === 'Revolver')).toBe(true);
        });

        it('should find tomes by name', () => {
            const results = globalSearch('precision', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.type === 'tomes' && r.item.name === 'Precision Tome')).toBe(true);
        });

        it('should find characters by name', () => {
            const results = globalSearch('cl4nk', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.type === 'characters' && r.item.name === 'CL4NK')).toBe(true);
        });

        it('should find shrines by name', () => {
            const results = globalSearch('charge', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.type === 'shrines' && r.item.name === 'Charge Shrine')).toBe(true);
        });

        it('should search across all data types simultaneously', () => {
            // Add items with 'test' in their names
            mockAllData.items.items = [
                createMockItem({ id: 'test_item', name: 'Test Item', base_effect: 'Testing effect' }),
            ];
            mockAllData.weapons.weapons = [createMockWeapon({ id: 'test_weapon', name: 'Test Weapon' })];
            mockAllData.tomes.tomes = [createMockTome({ id: 'test_tome', name: 'Test Tome' })];
            mockAllData.characters.characters = [createMockCharacter({ id: 'test_character', name: 'Test Character' })];
            mockAllData.shrines.shrines = [createMockShrine({ id: 'test_shrine', name: 'Test Shrine' })];

            const results = globalSearch('test', mockAllData);

            // Should find results from all types
            expect(results.some(r => r.type === 'items')).toBe(true);
            expect(results.some(r => r.type === 'weapons')).toBe(true);
            expect(results.some(r => r.type === 'tomes')).toBe(true);
            expect(results.some(r => r.type === 'characters')).toBe(true);
            expect(results.some(r => r.type === 'shrines')).toBe(true);
        });

        it('should be case insensitive', () => {
            const lowerResults = globalSearch('gym', mockAllData);
            const upperResults = globalSearch('GYM', mockAllData);
            const mixedResults = globalSearch('Gym', mockAllData);

            expect(lowerResults.length).toBe(upperResults.length);
            expect(lowerResults.length).toBe(mixedResults.length);
        });

        it('should sort results by score (highest first)', () => {
            const results = globalSearch('test', mockAllData);

            // Verify scores are in descending order
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });

        it('should include score in results', () => {
            const results = globalSearch('test', mockAllData);

            results.forEach(result => {
                expect(result.score).toBeDefined();
                expect(typeof result.score).toBe('number');
                expect(result.score).toBeGreaterThan(0);
            });
        });

        it('should include type in results', () => {
            const results = globalSearch('test', mockAllData);
            const validTypes = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

            results.forEach(result => {
                expect(validTypes).toContain(result.type);
            });
        });

        it('should include the item/entity in results', () => {
            const results = globalSearch('test', mockAllData);

            results.forEach(result => {
                expect(result.item).toBeDefined();
                expect(result.item.id).toBeDefined();
                expect(result.item.name).toBeDefined();
            });
        });

        it('should search item descriptions', () => {
            mockAllData.items.items = [
                createMockItem({
                    id: 'unique_item',
                    name: 'Basic Item',
                    description: 'uniquedescription123',
                }),
            ];

            const results = globalSearch('uniquedescription123', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.item.id === 'unique_item')).toBe(true);
        });

        it('should search item base_effect field', () => {
            mockAllData.items.items = [
                createMockItem({
                    id: 'effect_item',
                    name: 'Normal Item',
                    base_effect: 'uniqueeffect789',
                }),
            ];

            const results = globalSearch('uniqueeffect789', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.item.id === 'effect_item')).toBe(true);
        });

        it('should search character passive ability', () => {
            mockAllData.characters.characters = [
                createMockCharacter({
                    id: 'passive_char',
                    name: 'Normal Character',
                    passive_ability: 'uniquepassive456',
                }),
            ];

            const results = globalSearch('uniquepassive456', mockAllData);

            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.item.id === 'passive_char')).toBe(true);
        });

        it('should handle missing data gracefully', () => {
            const partialData = {
                items: { items: [createMockItem()] },
                // weapons, tomes, characters, shrines are undefined
            };

            const results = globalSearch('test', partialData);

            // Should not throw and should return results from available data
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle null data gracefully', () => {
            const nullData = {
                items: null,
                weapons: null,
                tomes: null,
                characters: null,
                shrines: null,
            };

            const results = globalSearch('test', nullData);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });

        it('should return no results for non-matching query', () => {
            const results = globalSearch('xyznonexistent123', mockAllData);

            expect(results.length).toBe(0);
        });
    });

    describe('fuzzyMatchScore()', () => {
        // Note: 'name' field gets +1000 bonus, use 'description' for base scores
        it('should give exact match highest score (base)', () => {
            // Use 'description' to test base score without name bonus
            const result = fuzzyMatchScore('test', 'test', 'description');
            expect(result.score).toBe(2000);
            expect(result.matchType).toBe('exact');
        });

        it('should give exact match with name bonus', () => {
            const result = fuzzyMatchScore('test', 'test', 'name');
            expect(result.score).toBe(3000); // 2000 base + 1000 name bonus
            expect(result.matchType).toBe('exact');
        });

        it('should give starts_with high score (base)', () => {
            // Use 'description' to test base score without name bonus
            const result = fuzzyMatchScore('test', 'testing', 'description');
            expect(result.score).toBe(1500);
            expect(result.matchType).toBe('starts_with');
        });

        it('should give starts_with with name bonus', () => {
            const result = fuzzyMatchScore('test', 'testing', 'name');
            expect(result.score).toBe(2500); // 1500 base + 1000 name bonus
            expect(result.matchType).toBe('starts_with');
        });

        it('should give contains medium score (base)', () => {
            // Use 'description' to test base score without name bonus
            const result = fuzzyMatchScore('test', 'a test case', 'description');
            expect(result.score).toBe(1000);
            expect(result.matchType).toBe('contains');
        });

        it('should give contains with name bonus', () => {
            const result = fuzzyMatchScore('test', 'a test case', 'name');
            expect(result.score).toBe(2000); // 1000 base + 1000 name bonus
            expect(result.matchType).toBe('contains');
        });

        it('should give fuzzy match lower score', () => {
            const result = fuzzyMatchScore('tst', 'testing', 'name');
            expect(result.score).toBeGreaterThan(0);
            expect(result.score).toBeLessThan(1000);
            expect(result.matchType).toBe('fuzzy');
        });

        it('should return 0 score for no match', () => {
            const result = fuzzyMatchScore('xyz', 'abc', 'name');
            expect(result.score).toBe(0);
            expect(result.matchType).toBe('none');
        });

        it('should be case insensitive', () => {
            const lower = fuzzyMatchScore('TEST', 'test', 'name');
            const upper = fuzzyMatchScore('test', 'TEST', 'name');

            expect(lower.score).toBe(upper.score);
        });

        it('should handle empty search term', () => {
            const result = fuzzyMatchScore('', 'test', 'name');
            expect(result.score).toBe(0);
        });

        it('should handle empty text', () => {
            const result = fuzzyMatchScore('test', '', 'name');
            expect(result.score).toBe(0);
        });
    });

    describe('GlobalSearchResult structure', () => {
        it('should have correct structure for each result', () => {
            const results = globalSearch('test', mockAllData);

            results.forEach(result => {
                // Check required properties
                expect(result).toHaveProperty('type');
                expect(result).toHaveProperty('item');
                expect(result).toHaveProperty('score');

                // Check types
                expect(typeof result.type).toBe('string');
                expect(typeof result.item).toBe('object');
                expect(typeof result.score).toBe('number');
            });
        });
    });
});
