// ========================================
// MegaBonk Collection Utilities Module
// ========================================
// Shared array/collection manipulation patterns
// ========================================

/**
 * Group array items by a key
 * @param items - Array to group
 * @param keyFn - Function to extract key from item
 * @returns Map of key to items array
 */
export function groupBy<T, K>(
    items: T[],
    keyFn: (item: T) => K
): Map<K, T[]> {
    const map = new Map<K, T[]>();

    for (const item of items) {
        const key = keyFn(item);
        const existing = map.get(key) || [];
        existing.push(item);
        map.set(key, existing);
    }

    return map;
}

/**
 * Count occurrences in array by a key
 * @param items - Array to count
 * @param keyFn - Function to extract key from item
 * @returns Map of key to count
 */
export function countBy<T, K>(
    items: T[],
    keyFn: (item: T) => K
): Map<K, number> {
    const map = new Map<K, number>();

    for (const item of items) {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
    }

    return map;
}

/**
 * Deduplicate array by a key, keeping first occurrence
 * @param items - Array to deduplicate
 * @param keyFn - Function to extract unique key
 * @returns Deduplicated array
 */
export function uniqueBy<T, K>(
    items: T[],
    keyFn: (item: T) => K
): T[] {
    const seen = new Set<K>();
    const result: T[] = [];

    for (const item of items) {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }

    return result;
}

/**
 * Partition array into two based on predicate
 * @param items - Array to partition
 * @param predicate - Function returning true for first partition
 * @returns Tuple of [matching, non-matching] arrays
 */
export function partition<T>(
    items: T[],
    predicate: (item: T) => boolean
): [T[], T[]] {
    const matching: T[] = [];
    const nonMatching: T[] = [];

    for (const item of items) {
        if (predicate(item)) {
            matching.push(item);
        } else {
            nonMatching.push(item);
        }
    }

    return [matching, nonMatching];
}

/**
 * Filter and map in single pass for performance
 * @param items - Array to process
 * @param filterMapFn - Function returning undefined to filter, or mapped value
 * @returns Filtered and mapped array
 */
export function filterMap<T, U>(
    items: T[],
    filterMapFn: (item: T, index: number) => U | undefined
): U[] {
    const result: U[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item !== undefined) {
            const mapped = filterMapFn(item, i);
            if (mapped !== undefined) {
                result.push(mapped);
            }
        }
    }

    return result;
}

/**
 * Find item in nested data structure
 * @param collections - Object with array properties
 * @param collectionKey - Key of the collection to search
 * @param id - ID to find
 * @param idKey - Property name for ID (default: 'id')
 * @returns Found item or undefined
 */
export function findInCollection<T extends { [K in IdKey]: string }, IdKey extends string = 'id'>(
    collections: Record<string, { [key: string]: T[] } | undefined> | undefined | null,
    collectionKey: string,
    id: string,
    idKey: IdKey = 'id' as IdKey
): T | undefined {
    const collection = collections?.[collectionKey];
    const items = collection?.[collectionKey] as T[] | undefined;
    return items?.find(item => item[idKey] === id);
}

/**
 * Safe array access with default
 * @param array - Array to access
 * @param index - Index to access
 * @param defaultValue - Value to return if index out of bounds
 * @returns Item at index or default
 */
export function safeGet<T>(
    array: T[] | undefined | null,
    index: number,
    defaultValue: T
): T {
    if (!array || index < 0 || index >= array.length) {
        return defaultValue;
    }
    const item = array[index];
    return item !== undefined ? item : defaultValue;
}

/**
 * Take first N items from array
 * @param items - Array to slice
 * @param count - Max items to take
 * @returns First N items
 */
export function take<T>(items: T[], count: number): T[] {
    return items.slice(0, Math.max(0, count));
}

/**
 * Calculate sum of numeric values
 * @param items - Array of items
 * @param valueFn - Function to extract numeric value
 * @returns Sum of values
 */
export function sumBy<T>(
    items: T[],
    valueFn: (item: T) => number
): number {
    return items.reduce((sum, item) => sum + valueFn(item), 0);
}

/**
 * Calculate average of numeric values
 * @param items - Array of items
 * @param valueFn - Function to extract numeric value
 * @returns Average or 0 if empty
 */
export function avgBy<T>(
    items: T[],
    valueFn: (item: T) => number
): number {
    if (items.length === 0) return 0;
    return sumBy(items, valueFn) / items.length;
}

/**
 * Find item with maximum value
 * @param items - Array of items
 * @param valueFn - Function to extract numeric value
 * @returns Item with max value or undefined if empty
 */
export function maxBy<T>(
    items: T[],
    valueFn: (item: T) => number
): T | undefined {
    if (items.length === 0) return undefined;

    const firstItem = items[0];
    if (firstItem === undefined) return undefined;

    let maxItem: T = firstItem;
    let maxValue = valueFn(maxItem);

    for (let i = 1; i < items.length; i++) {
        const item = items[i];
        if (item === undefined) continue;
        const value = valueFn(item);
        if (value > maxValue) {
            maxValue = value;
            maxItem = item;
        }
    }

    return maxItem;
}

/**
 * Build a lookup map from array
 * @param items - Array of items
 * @param keyFn - Function to extract key
 * @returns Map for O(1) lookups
 */
export function buildLookup<T, K>(
    items: T[],
    keyFn: (item: T) => K
): Map<K, T> {
    const map = new Map<K, T>();

    for (const item of items) {
        map.set(keyFn(item), item);
    }

    return map;
}

/**
 * Build a Set from array for O(1) existence checks
 * @param items - Array of items
 * @param keyFn - Optional function to extract key (default: identity)
 * @returns Set for O(1) lookups
 */
export function buildSet<T, K = T>(
    items: T[],
    keyFn?: (item: T) => K
): Set<K> {
    const set = new Set<K>();

    for (const item of items) {
        set.add(keyFn ? keyFn(item) : (item as unknown as K));
    }

    return set;
}
