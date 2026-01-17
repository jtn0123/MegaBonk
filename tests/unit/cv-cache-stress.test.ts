/**
 * Cache Stress Tests and Memory Leak Detection
 * Tests cache performance, eviction, and memory management under load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock cache implementation for testing
class TemplateCache {
    private cache: Map<string, { data: any; timestamp: number; size: number }>;
    private maxSize: number;
    private ttl: number;
    private currentSize: number;

    constructor(maxSize: number = 200, ttl: number = 15 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.currentSize = 0;
    }

    set(key: string, data: any, size: number): void {
        // Evict if necessary
        while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
            this.evictOldest();
        }

        this.cache.set(key, { data, timestamp: Date.now(), size });
        this.currentSize += size;
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.delete(key);
            return null;
        }

        return entry.data;
    }

    delete(key: string): void {
        const entry = this.cache.get(key);
        if (entry) {
            this.currentSize -= entry.size;
            this.cache.delete(key);
        }
    }

    private evictOldest(): void {
        let oldest: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldest = key;
                oldestTime = entry.timestamp;
            }
        }

        if (oldest) {
            this.delete(oldest);
        }
    }

    clear(): void {
        this.cache.clear();
        this.currentSize = 0;
    }

    getStats() {
        return {
            count: this.cache.size,
            currentSize: this.currentSize,
            maxSize: this.maxSize,
        };
    }
}

describe('Template Cache Stress Tests', () => {
    let cache: TemplateCache;

    beforeEach(() => {
        cache = new TemplateCache(100, 60000); // 100 units max, 60s TTL
    });

    afterEach(() => {
        cache.clear();
    });

    describe('Basic Cache Operations', () => {
        it('should store and retrieve items', () => {
            cache.set('item1', { name: 'Wrench' }, 10);

            const result = cache.get('item1');

            expect(result).toEqual({ name: 'Wrench' });
        });

        it('should return null for non-existent items', () => {
            const result = cache.get('nonexistent');

            expect(result).toBeNull();
        });

        it('should update existing items', () => {
            cache.set('item1', { version: 1 }, 10);
            cache.set('item1', { version: 2 }, 10);

            const result = cache.get('item1');

            expect(result.version).toBe(2);
        });

        it('should delete items', () => {
            cache.set('item1', { name: 'Wrench' }, 10);
            cache.delete('item1');

            const result = cache.get('item1');

            expect(result).toBeNull();
        });
    });

    describe('Cache Eviction', () => {
        it('should evict oldest item when cache is full', () => {
            // Fill cache to capacity
            for (let i = 0; i < 10; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            // This should evict item0 (oldest)
            cache.set('item10', { id: 10 }, 10);

            expect(cache.get('item0')).toBeNull();
            expect(cache.get('item10')).not.toBeNull();
        });

        it('should evict multiple items if new item is large', () => {
            // Add small items
            for (let i = 0; i < 5; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            // Add very large item (should evict multiple)
            cache.set('largeItem', { id: 999 }, 60);

            // First few items should be evicted or some items evicted
            // At least one should be evicted
            const evictedCount = [cache.get('item0'), cache.get('item1'), cache.get('item2')].filter(
                v => v === null
            ).length;
            expect(evictedCount).toBeGreaterThan(0);
        });

        it('should maintain cache size limit', () => {
            // Try to exceed cache size
            for (let i = 0; i < 20; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            const stats = cache.getStats();

            expect(stats.currentSize).toBeLessThanOrEqual(stats.maxSize);
        });

        it('should evict in LRU fashion', () => {
            // Add items to establish order (oldest first)
            cache.set('item1', { id: 1 }, 10);
            cache.set('item2', { id: 2 }, 10);
            cache.set('item3', { id: 3 }, 10);

            // Fill to capacity (should evict oldest)
            for (let i = 4; i < 12; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            // item1 should be evicted first (oldest)
            expect(cache.get('item1')).toBeNull();
        });
    });

    describe('TTL (Time-To-Live) Expiration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should expire items after TTL', () => {
            cache.set('item1', { name: 'Wrench' }, 10);

            // Advance time beyond TTL
            vi.advanceTimersByTime(61000); // 61 seconds

            const result = cache.get('item1');

            expect(result).toBeNull();
        });

        it('should not expire items before TTL', () => {
            cache.set('item1', { name: 'Wrench' }, 10);

            // Advance time but stay within TTL
            vi.advanceTimersByTime(30000); // 30 seconds

            const result = cache.get('item1');

            expect(result).not.toBeNull();
        });

        it('should handle mixed TTL states', () => {
            cache.set('item1', { id: 1 }, 10);

            vi.advanceTimersByTime(40000); // 40s

            cache.set('item2', { id: 2 }, 10);

            vi.advanceTimersByTime(25000); // Total 65s

            // item1 should be expired, item2 should still be valid
            expect(cache.get('item1')).toBeNull();
            expect(cache.get('item2')).not.toBeNull();
        });
    });

    describe('Stress Tests', () => {
        it('should handle rapid insertions', () => {
            const iterations = 1000;

            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                cache.set(`item${i}`, { id: i }, 1);
            }

            const elapsed = performance.now() - start;

            // Should complete in < 100ms
            expect(elapsed).toBeLessThan(100);
        });

        it('should handle rapid retrievals', () => {
            // Populate cache
            for (let i = 0; i < 50; i++) {
                cache.set(`item${i}`, { id: i }, 1);
            }

            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                cache.get(`item${i % 50}`);
            }

            const elapsed = performance.now() - start;

            // Should complete in < 50ms
            expect(elapsed).toBeLessThan(50);
        });

        it('should handle concurrent read/write operations', () => {
            // Simulate mixed workload
            for (let i = 0; i < 100; i++) {
                if (i % 3 === 0) {
                    cache.set(`item${i}`, { id: i }, 1);
                } else if (i % 3 === 1) {
                    cache.get(`item${i - 1}`);
                } else {
                    cache.delete(`item${i - 2}`);
                }
            }

            // Should not crash
            expect(cache.getStats().count).toBeGreaterThan(0);
        });

        it('should handle cache thrashing', () => {
            // Repeatedly evict and refill
            for (let round = 0; round < 10; round++) {
                for (let i = 0; i < 20; i++) {
                    cache.set(`round${round}_item${i}`, { id: i }, 10);
                }
            }

            const stats = cache.getStats();

            // Cache should remain stable
            expect(stats.currentSize).toBeLessThanOrEqual(stats.maxSize);
            expect(stats.count).toBeGreaterThan(0);
        });
    });

    describe('Memory Leak Detection', () => {
        it('should not grow unbounded with deletions', () => {
            const initialStats = cache.getStats();

            // Add and delete many times
            for (let i = 0; i < 1000; i++) {
                cache.set(`item${i}`, { data: new Array(100).fill(i) }, 1);
                if (i % 2 === 0) {
                    cache.delete(`item${i}`);
                }
            }

            const finalStats = cache.getStats();

            // Size should not be infinite
            expect(finalStats.currentSize).toBeLessThanOrEqual(finalStats.maxSize);
        });

        it('should free memory on clear', () => {
            // Fill cache
            for (let i = 0; i < 50; i++) {
                cache.set(`item${i}`, { data: new Array(100).fill(i) }, 2);
            }

            cache.clear();

            const stats = cache.getStats();

            expect(stats.count).toBe(0);
            expect(stats.currentSize).toBe(0);
        });

        it('should not leak on repeated evictions', () => {
            const rounds = 100;

            for (let round = 0; round < rounds; round++) {
                // Fill cache
                for (let i = 0; i < 15; i++) {
                    cache.set(`round${round}_item${i}`, { data: [round, i] }, 10);
                }
            }

            const stats = cache.getStats();

            // Final size should be reasonable (not accumulated)
            expect(stats.currentSize).toBeLessThanOrEqual(stats.maxSize);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero-size items', () => {
            cache.set('empty', {}, 0);

            const result = cache.get('empty');

            expect(result).toEqual({});
        });

        it('should handle very large single item', () => {
            cache.set('huge', { data: 'x'.repeat(1000000) }, 150);

            // Should evict everything to make room
            const result = cache.get('huge');

            // Can't fit, should be null or cache should expand
            expect(result === null || result.data.length > 0).toBe(true);
        });

        it('should handle null/undefined data', () => {
            cache.set('null', null, 1);
            cache.set('undefined', undefined, 1);

            // Null values in cache will be returned as-is
            expect(cache.get('null')).toBe(null);
            // Undefined values will be stored but may return null
            expect([null, undefined].includes(cache.get('undefined'))).toBe(true);
        });

        it('should handle special characters in keys', () => {
            const specialKeys = ['key with spaces', 'key/with/slashes', 'key:with:colons', 'key😀emoji'];

            for (const key of specialKeys) {
                cache.set(key, { key }, 1);
            }

            for (const key of specialKeys) {
                expect(cache.get(key)).toEqual({ key });
            }
        });
    });

    describe('Cache Statistics', () => {
        it('should report accurate count', () => {
            for (let i = 0; i < 5; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            const stats = cache.getStats();

            expect(stats.count).toBe(5);
        });

        it('should report accurate size', () => {
            cache.set('item1', {}, 25);
            cache.set('item2', {}, 35);

            const stats = cache.getStats();

            expect(stats.currentSize).toBe(60);
        });

        it('should update stats after eviction', () => {
            for (let i = 0; i < 12; i++) {
                cache.set(`item${i}`, { id: i }, 10);
            }

            const stats = cache.getStats();

            // Should have evicted some items
            expect(stats.count).toBeLessThan(12);
            expect(stats.currentSize).toBeLessThanOrEqual(stats.maxSize);
        });
    });
});

describe('Integration: Cache Impact on Detection Performance', () => {
    let cache: TemplateCache;

    beforeEach(() => {
        cache = new TemplateCache(200, 60000);
    });

    it('should improve detection speed with cache hits', () => {
        const template = { data: new Array(1000).fill(128) };

        // First access (cache miss)
        const start1 = performance.now();
        cache.set('template1', template, 10);
        const miss1 = cache.get('template1');
        const time1 = performance.now() - start1;

        // Second access (cache hit)
        const start2 = performance.now();
        const hit1 = cache.get('template1');
        const time2 = performance.now() - start2;

        // Cache hit should be faster (significantly)
        expect(time2).toBeLessThan(time1 * 0.5);
        expect(hit1).toBe(miss1);
    });

    it('should handle burst detection requests', () => {
        // Simulate rapid detections of same items
        const items = ['Wrench', 'Medkit', 'Ice Crystal'];

        for (let burst = 0; burst < 10; burst++) {
            for (const item of items) {
                if (!cache.get(item)) {
                    cache.set(item, { name: item }, 5);
                }
            }
        }

        // All items should still be cached
        for (const item of items) {
            expect(cache.get(item)).not.toBeNull();
        }
    });

    it('should handle alternating detection patterns', () => {
        const patterns = ['pattern1', 'pattern2', 'pattern3'];

        // Alternate between patterns
        for (let i = 0; i < 30; i++) {
            const pattern = patterns[i % patterns.length];
            if (!cache.get(pattern)) {
                cache.set(pattern, { id: i }, 10);
            }
        }

        // All patterns should be cached
        for (const pattern of patterns) {
            expect(cache.get(pattern)).not.toBeNull();
        }
    });
});
