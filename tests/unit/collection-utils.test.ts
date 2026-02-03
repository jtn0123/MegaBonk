/**
 * Collection Utilities Tests
 * Tests for array/collection manipulation patterns
 */

import { describe, it, expect } from 'vitest';
import {
    groupBy,
    countBy,
    uniqueBy,
    partition,
    filterMap,
    findInCollection,
    safeGet,
    take,
    sumBy,
    avgBy,
    maxBy,
    buildLookup,
    buildSet,
} from '../../src/modules/collection-utils.ts';

// ========================================
// Test Data
// ========================================

interface TestItem {
    id: string;
    name: string;
    category: string;
    value: number;
    active: boolean;
}

const testItems: TestItem[] = [
    { id: '1', name: 'Alpha', category: 'A', value: 10, active: true },
    { id: '2', name: 'Beta', category: 'B', value: 20, active: true },
    { id: '3', name: 'Gamma', category: 'A', value: 30, active: false },
    { id: '4', name: 'Delta', category: 'B', value: 40, active: true },
    { id: '5', name: 'Epsilon', category: 'A', value: 50, active: false },
];

// ========================================
// groupBy Tests
// ========================================

describe('groupBy', () => {
    it('should group items by a key function', () => {
        const grouped = groupBy(testItems, item => item.category);

        expect(grouped.size).toBe(2);
        expect(grouped.get('A')?.length).toBe(3);
        expect(grouped.get('B')?.length).toBe(2);
    });

    it('should handle empty arrays', () => {
        const grouped = groupBy([], (item: TestItem) => item.category);

        expect(grouped.size).toBe(0);
    });

    it('should group by boolean values', () => {
        const grouped = groupBy(testItems, item => item.active);

        expect(grouped.get(true)?.length).toBe(3);
        expect(grouped.get(false)?.length).toBe(2);
    });

    it('should group by numeric values', () => {
        const items = [
            { tier: 1, name: 'a' },
            { tier: 2, name: 'b' },
            { tier: 1, name: 'c' },
        ];
        const grouped = groupBy(items, item => item.tier);

        expect(grouped.get(1)?.length).toBe(2);
        expect(grouped.get(2)?.length).toBe(1);
    });

    it('should preserve order within groups', () => {
        const grouped = groupBy(testItems, item => item.category);
        const groupA = grouped.get('A')!;

        expect(groupA[0].name).toBe('Alpha');
        expect(groupA[1].name).toBe('Gamma');
        expect(groupA[2].name).toBe('Epsilon');
    });
});

// ========================================
// countBy Tests
// ========================================

describe('countBy', () => {
    it('should count occurrences by a key', () => {
        const counts = countBy(testItems, item => item.category);

        expect(counts.get('A')).toBe(3);
        expect(counts.get('B')).toBe(2);
    });

    it('should handle empty arrays', () => {
        const counts = countBy([], (item: TestItem) => item.category);

        expect(counts.size).toBe(0);
    });

    it('should count by boolean values', () => {
        const counts = countBy(testItems, item => item.active);

        expect(counts.get(true)).toBe(3);
        expect(counts.get(false)).toBe(2);
    });

    it('should count unique values correctly', () => {
        const items = [{ x: 'a' }, { x: 'a' }, { x: 'a' }];
        const counts = countBy(items, item => item.x);

        expect(counts.get('a')).toBe(3);
        expect(counts.size).toBe(1);
    });
});

// ========================================
// uniqueBy Tests
// ========================================

describe('uniqueBy', () => {
    it('should deduplicate by id', () => {
        const items = [
            { id: '1', name: 'First' },
            { id: '2', name: 'Second' },
            { id: '1', name: 'Duplicate' },
        ];
        const unique = uniqueBy(items, item => item.id);

        expect(unique.length).toBe(2);
        expect(unique[0].name).toBe('First'); // Keeps first occurrence
    });

    it('should handle empty arrays', () => {
        const unique = uniqueBy([], (item: TestItem) => item.id);

        expect(unique.length).toBe(0);
    });

    it('should handle all unique items', () => {
        const unique = uniqueBy(testItems, item => item.id);

        expect(unique.length).toBe(5);
    });

    it('should deduplicate by category (keeping first of each)', () => {
        const unique = uniqueBy(testItems, item => item.category);

        expect(unique.length).toBe(2);
        expect(unique[0].name).toBe('Alpha'); // First 'A'
        expect(unique[1].name).toBe('Beta'); // First 'B'
    });

    it('should work with numeric keys', () => {
        const items = [
            { value: 10, data: 'a' },
            { value: 20, data: 'b' },
            { value: 10, data: 'c' },
        ];
        const unique = uniqueBy(items, item => item.value);

        expect(unique.length).toBe(2);
    });
});

// ========================================
// partition Tests
// ========================================

describe('partition', () => {
    it('should partition by predicate', () => {
        const [active, inactive] = partition(testItems, item => item.active);

        expect(active.length).toBe(3);
        expect(inactive.length).toBe(2);
    });

    it('should handle empty arrays', () => {
        const [matching, nonMatching] = partition([], () => true);

        expect(matching.length).toBe(0);
        expect(nonMatching.length).toBe(0);
    });

    it('should handle all matching', () => {
        const [matching, nonMatching] = partition(testItems, () => true);

        expect(matching.length).toBe(5);
        expect(nonMatching.length).toBe(0);
    });

    it('should handle none matching', () => {
        const [matching, nonMatching] = partition(testItems, () => false);

        expect(matching.length).toBe(0);
        expect(nonMatching.length).toBe(5);
    });

    it('should partition by numeric threshold', () => {
        const [high, low] = partition(testItems, item => item.value >= 30);

        expect(high.length).toBe(3); // 30, 40, 50
        expect(low.length).toBe(2); // 10, 20
    });

    it('should preserve order in partitions', () => {
        const [active] = partition(testItems, item => item.active);

        expect(active[0].name).toBe('Alpha');
        expect(active[1].name).toBe('Beta');
        expect(active[2].name).toBe('Delta');
    });
});

// ========================================
// filterMap Tests
// ========================================

describe('filterMap', () => {
    it('should filter and map in single pass', () => {
        const result = filterMap(testItems, item =>
            item.active ? item.name.toUpperCase() : undefined
        );

        expect(result).toEqual(['ALPHA', 'BETA', 'DELTA']);
    });

    it('should handle empty arrays', () => {
        const result = filterMap([], () => 'value');

        expect(result).toEqual([]);
    });

    it('should handle all filtered out', () => {
        const result = filterMap(testItems, () => undefined);

        expect(result).toEqual([]);
    });

    it('should handle all mapped', () => {
        const result = filterMap(testItems, item => item.value * 2);

        expect(result).toEqual([20, 40, 60, 80, 100]);
    });

    it('should provide index to callback', () => {
        const result = filterMap([10, 20, 30], (item, index) =>
            index % 2 === 0 ? item : undefined
        );

        expect(result).toEqual([10, 30]); // Items at even indices
    });

    it('should handle 0 and false as valid mapped values', () => {
        const result = filterMap([1, 2, 3], item => (item === 2 ? 0 : undefined));

        expect(result).toEqual([0]);
    });

    it('should filter undefined items in source array', () => {
        const sparseArray = [1, undefined, 3];
        const result = filterMap(sparseArray as number[], item => item);

        expect(result).toEqual([1, 3]);
    });
});

// ========================================
// findInCollection Tests
// ========================================

describe('findInCollection', () => {
    const collections = {
        items: {
            items: [
                { id: 'sword', name: 'Sword' },
                { id: 'shield', name: 'Shield' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'bow', name: 'Bow' },
            ],
        },
    };

    it('should find item by id', () => {
        const found = findInCollection(collections, 'items', 'sword');

        expect(found?.name).toBe('Sword');
    });

    it('should return undefined for missing item', () => {
        const found = findInCollection(collections, 'items', 'missing');

        expect(found).toBeUndefined();
    });

    it('should return undefined for missing collection', () => {
        const found = findInCollection(collections, 'nonexistent', 'any');

        expect(found).toBeUndefined();
    });

    it('should handle null/undefined collections', () => {
        expect(findInCollection(null, 'items', 'any')).toBeUndefined();
        expect(findInCollection(undefined, 'items', 'any')).toBeUndefined();
    });

    it('should support custom id key', () => {
        const customCollections = {
            custom: {
                custom: [
                    { customId: 'x', name: 'X' },
                    { customId: 'y', name: 'Y' },
                ],
            },
        };
        const found = findInCollection(customCollections, 'custom', 'x', 'customId');

        expect(found?.name).toBe('X');
    });
});

// ========================================
// safeGet Tests
// ========================================

describe('safeGet', () => {
    const array = ['a', 'b', 'c'];

    it('should return item at valid index', () => {
        expect(safeGet(array, 0, 'default')).toBe('a');
        expect(safeGet(array, 1, 'default')).toBe('b');
        expect(safeGet(array, 2, 'default')).toBe('c');
    });

    it('should return default for out of bounds index', () => {
        expect(safeGet(array, 3, 'default')).toBe('default');
        expect(safeGet(array, 100, 'default')).toBe('default');
    });

    it('should return default for negative index', () => {
        expect(safeGet(array, -1, 'default')).toBe('default');
    });

    it('should return default for undefined array', () => {
        expect(safeGet(undefined, 0, 'default')).toBe('default');
    });

    it('should return default for null array', () => {
        expect(safeGet(null, 0, 'default')).toBe('default');
    });

    it('should return default for empty array', () => {
        expect(safeGet([], 0, 'default')).toBe('default');
    });

    it('should handle undefined values in array', () => {
        const sparseArray = ['a', undefined, 'c'];
        expect(safeGet(sparseArray, 1, 'default')).toBe('default');
    });
});

// ========================================
// take Tests
// ========================================

describe('take', () => {
    const array = [1, 2, 3, 4, 5];

    it('should take first N items', () => {
        expect(take(array, 3)).toEqual([1, 2, 3]);
    });

    it('should return all items if count exceeds length', () => {
        expect(take(array, 10)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return empty array for count 0', () => {
        expect(take(array, 0)).toEqual([]);
    });

    it('should return empty array for negative count', () => {
        expect(take(array, -5)).toEqual([]);
    });

    it('should handle empty array', () => {
        expect(take([], 5)).toEqual([]);
    });

    it('should not mutate original array', () => {
        const original = [1, 2, 3];
        take(original, 2);
        expect(original).toEqual([1, 2, 3]);
    });
});

// ========================================
// sumBy Tests
// ========================================

describe('sumBy', () => {
    it('should sum numeric values', () => {
        const sum = sumBy(testItems, item => item.value);

        expect(sum).toBe(150); // 10 + 20 + 30 + 40 + 50
    });

    it('should return 0 for empty array', () => {
        const sum = sumBy([], () => 10);

        expect(sum).toBe(0);
    });

    it('should handle negative values', () => {
        const items = [{ v: 10 }, { v: -5 }, { v: -3 }];
        const sum = sumBy(items, item => item.v);

        expect(sum).toBe(2);
    });

    it('should handle floating point values', () => {
        const items = [{ v: 1.5 }, { v: 2.5 }, { v: 3.0 }];
        const sum = sumBy(items, item => item.v);

        expect(sum).toBe(7);
    });
});

// ========================================
// avgBy Tests
// ========================================

describe('avgBy', () => {
    it('should calculate average', () => {
        const avg = avgBy(testItems, item => item.value);

        expect(avg).toBe(30); // 150 / 5
    });

    it('should return 0 for empty array', () => {
        const avg = avgBy([], () => 10);

        expect(avg).toBe(0);
    });

    it('should handle single item', () => {
        const avg = avgBy([{ value: 42 }], item => item.value);

        expect(avg).toBe(42);
    });

    it('should handle floating point results', () => {
        const items = [{ v: 1 }, { v: 2 }];
        const avg = avgBy(items, item => item.v);

        expect(avg).toBe(1.5);
    });
});

// ========================================
// maxBy Tests
// ========================================

describe('maxBy', () => {
    it('should find item with max value', () => {
        const max = maxBy(testItems, item => item.value);

        expect(max?.name).toBe('Epsilon'); // value: 50
    });

    it('should return undefined for empty array', () => {
        const max = maxBy([], () => 10);

        expect(max).toBeUndefined();
    });

    it('should handle single item', () => {
        const max = maxBy([{ name: 'only', value: 10 }], item => item.value);

        expect(max?.name).toBe('only');
    });

    it('should return first item when all values equal', () => {
        const items = [
            { name: 'first', value: 10 },
            { name: 'second', value: 10 },
        ];
        const max = maxBy(items, item => item.value);

        expect(max?.name).toBe('first');
    });

    it('should handle negative values', () => {
        const items = [
            { name: 'a', value: -10 },
            { name: 'b', value: -5 },
            { name: 'c', value: -20 },
        ];
        const max = maxBy(items, item => item.value);

        expect(max?.name).toBe('b'); // -5 is max
    });

    it('should skip undefined items during iteration', () => {
        // Note: maxBy uses first defined item as initial max
        const items = [
            { name: 'low', value: 5 },
            undefined,
            { name: 'high', value: 10 },
        ] as Array<{ name: string; value: number } | undefined>;
        const max = maxBy(items, item => item?.value ?? 0);

        expect(max?.name).toBe('high');
    });
});

// ========================================
// buildLookup Tests
// ========================================

describe('buildLookup', () => {
    it('should build lookup map by id', () => {
        const lookup = buildLookup(testItems, item => item.id);

        expect(lookup.size).toBe(5);
        expect(lookup.get('1')?.name).toBe('Alpha');
        expect(lookup.get('3')?.name).toBe('Gamma');
    });

    it('should handle empty array', () => {
        const lookup = buildLookup([], (item: TestItem) => item.id);

        expect(lookup.size).toBe(0);
    });

    it('should overwrite duplicates (last wins)', () => {
        const items = [
            { id: '1', value: 'first' },
            { id: '1', value: 'second' },
        ];
        const lookup = buildLookup(items, item => item.id);

        expect(lookup.get('1')?.value).toBe('second');
    });

    it('should support any key type', () => {
        const lookup = buildLookup(testItems, item => item.value);

        expect(lookup.get(10)?.name).toBe('Alpha');
        expect(lookup.get(50)?.name).toBe('Epsilon');
    });
});

// ========================================
// buildSet Tests
// ========================================

describe('buildSet', () => {
    it('should build set from values', () => {
        const set = buildSet([1, 2, 3, 2, 1]);

        expect(set.size).toBe(3);
        expect(set.has(1)).toBe(true);
        expect(set.has(4)).toBe(false);
    });

    it('should build set from extracted keys', () => {
        const set = buildSet(testItems, item => item.category);

        expect(set.size).toBe(2);
        expect(set.has('A')).toBe(true);
        expect(set.has('B')).toBe(true);
        expect(set.has('C')).toBe(false);
    });

    it('should handle empty array', () => {
        const set = buildSet([]);

        expect(set.size).toBe(0);
    });

    it('should deduplicate with key function', () => {
        const set = buildSet(testItems, item => item.active);

        expect(set.size).toBe(2);
        expect(set.has(true)).toBe(true);
        expect(set.has(false)).toBe(true);
    });

    it('should work with strings without key function', () => {
        const set = buildSet(['a', 'b', 'a', 'c']);

        expect(set.size).toBe(3);
        expect(set.has('a')).toBe(true);
    });
});
