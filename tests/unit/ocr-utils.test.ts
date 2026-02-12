/**
 * OCR Utilities Unit Tests
 * Tests pure logic functions from the OCR module
 * No tesseract.js or canvas dependencies - just business logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    withTimeout,
    sleep,
    splitIntoSegments,
    extractItemCounts,
    OCR_TIMEOUT_MS,
    OCR_MAX_RETRIES,
} from '../../src/modules/ocr/utils.ts';

// ========================================
// Constants Tests
// ========================================

describe('OCR Constants', () => {
    it('should export OCR_TIMEOUT_MS as 60000ms (1 minute)', () => {
        expect(OCR_TIMEOUT_MS).toBe(60000);
    });

    it('should export OCR_MAX_RETRIES as 2', () => {
        expect(OCR_MAX_RETRIES).toBe(2);
    });
});

// ========================================
// withTimeout Tests
// ========================================

describe('withTimeout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('successful resolution', () => {
        it('should resolve when promise completes before timeout', async () => {
            const promise = new Promise<string>(resolve => {
                setTimeout(() => resolve('success'), 50);
            });

            const resultPromise = withTimeout(promise, 100, 'test-operation');
            
            await vi.advanceTimersByTimeAsync(50);
            
            const result = await resultPromise;
            expect(result).toBe('success');
        });

        it('should resolve immediately for instant promises', async () => {
            const promise = Promise.resolve('instant');
            
            const result = await withTimeout(promise, 1000, 'instant-op');
            
            expect(result).toBe('instant');
        });

        it('should pass through complex return values', async () => {
            const complexValue = { items: [1, 2, 3], nested: { data: 'test' } };
            const promise = Promise.resolve(complexValue);
            
            const result = await withTimeout(promise, 1000, 'complex-op');
            
            expect(result).toEqual(complexValue);
        });

        it('should clear timeout after successful resolution', async () => {
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            const promise = Promise.resolve('done');
            
            await withTimeout(promise, 1000, 'clear-test');
            
            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });
    });

    describe('timeout behavior', () => {
        it('should reject with timeout error when promise takes too long', async () => {
            // Use real timers for this test to avoid fake timer issues
            vi.useRealTimers();
            
            const slowPromise = new Promise<string>(resolve => {
                setTimeout(() => resolve('too late'), 200);
            });

            // Short timeout - the promise won't resolve in time
            await expect(withTimeout(slowPromise, 50, 'slow-operation'))
                .rejects.toThrow('slow-operation timed out after 50ms');
            
            // Restore fake timers for other tests
            vi.useFakeTimers();
        });

        it('should include operation name in timeout error message', async () => {
            vi.useRealTimers();
            
            const neverResolves = new Promise<void>(() => {});
            
            await expect(withTimeout(neverResolves, 10, 'OCR recognition'))
                .rejects.toThrow('OCR recognition timed out after 10ms');
            
            vi.useFakeTimers();
        });

        it('should handle very short timeouts', async () => {
            vi.useRealTimers();
            
            const neverResolves = new Promise<void>(() => {});
            
            await expect(withTimeout(neverResolves, 5, 'tiny-timeout'))
                .rejects.toThrow('tiny-timeout timed out after 5ms');
            
            vi.useFakeTimers();
        });

        it('should timeout at specified time (not before)', async () => {
            vi.useRealTimers();
            
            // Create a promise that resolves just after the timeout
            const resolvesAt60ms = new Promise<string>(resolve => {
                setTimeout(() => resolve('resolved'), 60);
            });
            
            // Timeout at 30ms - should timeout before the promise resolves
            await expect(withTimeout(resolvesAt60ms, 30, 'exact-timing'))
                .rejects.toThrow('exact-timing timed out after 30ms');
            
            vi.useFakeTimers();
        });
    });

    describe('error propagation', () => {
        it('should propagate promise rejection errors', async () => {
            // Create a promise that will reject
            let rejectFn: (err: Error) => void;
            const failingPromise = new Promise<void>((_, reject) => {
                rejectFn = reject;
            });

            const resultPromise = withTimeout(failingPromise, 100, 'failing-op');
            
            // Reject the promise directly (no setTimeout needed with fake timers)
            rejectFn!(new Error('original error'));
            
            await expect(resultPromise).rejects.toThrow('original error');
        });

        it('should clear timeout on promise rejection', async () => {
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            const failingPromise = Promise.reject(new Error('fail'));
            
            await expect(withTimeout(failingPromise, 1000, 'reject-clear')).rejects.toThrow();
            
            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });

        it('should propagate non-Error rejection values', async () => {
            const failingPromise = Promise.reject('string error');
            
            await expect(withTimeout(failingPromise, 1000, 'non-error')).rejects.toBe('string error');
        });
    });

    describe('type safety', () => {
        it('should preserve return type of wrapped promise', async () => {
            const numberPromise = Promise.resolve(42);
            const result = await withTimeout(numberPromise, 1000, 'number');
            
            // TypeScript should infer result as number
            expect(typeof result).toBe('number');
            expect(result).toBe(42);
        });

        it('should work with array return types', async () => {
            const arrayPromise = Promise.resolve([1, 2, 3]);
            const result = await withTimeout(arrayPromise, 1000, 'array');
            
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([1, 2, 3]);
        });

        it('should work with null and undefined', async () => {
            const nullPromise = Promise.resolve(null);
            const undefinedPromise = Promise.resolve(undefined);
            
            const nullResult = await withTimeout(nullPromise, 1000, 'null');
            const undefinedResult = await withTimeout(undefinedPromise, 1000, 'undefined');
            
            expect(nullResult).toBeNull();
            expect(undefinedResult).toBeUndefined();
        });
    });
});

// ========================================
// sleep Tests
// ========================================

describe('sleep', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should resolve after specified delay', async () => {
        const sleepPromise = sleep(100);
        
        // Should not resolve immediately
        let resolved = false;
        sleepPromise.then(() => { resolved = true; });
        
        expect(resolved).toBe(false);
        
        await vi.advanceTimersByTimeAsync(100);
        
        // Now should be resolved
        await sleepPromise;
    });

    it('should resolve with void/undefined', async () => {
        const sleepPromise = sleep(50);
        
        await vi.advanceTimersByTimeAsync(50);
        
        const result = await sleepPromise;
        expect(result).toBeUndefined();
    });

    it('should handle 0ms delay', async () => {
        const sleepPromise = sleep(0);
        
        await vi.advanceTimersByTimeAsync(0);
        
        const result = await sleepPromise;
        expect(result).toBeUndefined();
    });

    it('should handle very long delays', async () => {
        const sleepPromise = sleep(10000);
        
        await vi.advanceTimersByTimeAsync(10000);
        
        const result = await sleepPromise;
        expect(result).toBeUndefined();
    });

    it('should be usable in async/await patterns', async () => {
        let counter = 0;
        
        const incrementAfterSleep = async () => {
            await sleep(50);
            counter++;
            await sleep(50);
            counter++;
        };
        
        const promise = incrementAfterSleep();
        
        expect(counter).toBe(0);
        
        await vi.advanceTimersByTimeAsync(50);
        expect(counter).toBe(1);
        
        await vi.advanceTimersByTimeAsync(50);
        expect(counter).toBe(2);
        
        await promise;
    });

    it('should work with Promise.all', async () => {
        const results: number[] = [];
        
        const tasks = [
            sleep(100).then(() => results.push(1)),
            sleep(200).then(() => results.push(2)),
            sleep(150).then(() => results.push(3)),
        ];
        
        const allPromise = Promise.all(tasks);
        
        await vi.advanceTimersByTimeAsync(100);
        expect(results).toContain(1);
        
        await vi.advanceTimersByTimeAsync(50);
        expect(results).toContain(3);
        
        await vi.advanceTimersByTimeAsync(50);
        expect(results).toContain(2);
        
        await allPromise;
        expect(results).toHaveLength(3);
    });
});

// ========================================
// splitIntoSegments Tests
// ========================================

describe('splitIntoSegments', () => {
    describe('basic splitting', () => {
        it('should split text by newlines', () => {
            const text = 'First line\nSecond line\nThird line';
            const segments = splitIntoSegments(text);
            
            expect(segments).toEqual(['First line', 'Second line', 'Third line']);
        });

        it('should trim whitespace from each segment', () => {
            const text = '  padded start  \n  middle pad  \n  end pad  ';
            const segments = splitIntoSegments(text);
            
            expect(segments).toEqual(['padded start', 'middle pad', 'end pad']);
        });

        it('should filter out very short segments (<=2 chars)', () => {
            const text = 'OK\nHi\nAB\nHello\nXY\nWorld';
            const segments = splitIntoSegments(text);
            
            // "OK", "Hi", "AB", "XY" are <= 2 chars, should be filtered
            expect(segments).toEqual(['Hello', 'World']);
        });

        it('should return empty array for empty text', () => {
            const segments = splitIntoSegments('');
            expect(segments).toEqual([]);
        });

        it('should return empty array for whitespace-only text', () => {
            const segments = splitIntoSegments('   \n  \n   ');
            expect(segments).toEqual([]);
        });
    });

    describe('long line handling', () => {
        it('should split long lines (>50 chars) by delimiters', () => {
            const longLine = 'Item One, Item Two, Item Three, Item Four, Item Five, Item Six';
            const segments = splitIntoSegments(longLine);
            
            expect(segments).toContain('Item One');
            expect(segments).toContain('Item Two');
            expect(segments).toContain('Item Three');
            expect(segments).toContain('Item Four');
            expect(segments).toContain('Item Five');
            expect(segments).toContain('Item Six');
        });

        it('should split by semicolons', () => {
            const longLine = 'Alpha; Beta; Gamma; Delta; Epsilon; Zeta; Eta; Theta';
            const segments = splitIntoSegments(longLine);
            
            expect(segments).toContain('Alpha');
            expect(segments).toContain('Beta');
            expect(segments).toContain('Theta');
        });

        it('should split by pipes', () => {
            const longLine = 'First Value | Second Value | Third Value | Fourth Value';
            const segments = splitIntoSegments(longLine);
            
            expect(segments).toContain('First Value');
            expect(segments).toContain('Second Value');
            expect(segments).toContain('Fourth Value');
        });

        it('should split by tabs', () => {
            const longLine = 'Column One\tColumn Two\tColumn Three\tColumn Four\tColumn Five';
            const segments = splitIntoSegments(longLine);
            
            expect(segments).toContain('Column One');
            expect(segments).toContain('Column Two');
            expect(segments).toContain('Column Five');
        });

        it('should handle mixed delimiters in long lines', () => {
            const longLine = 'A, B; C | D, E; F | G, H; I | J, K; L, M, N';
            const segments = splitIntoSegments(longLine);
            
            // All should be extracted
            expect(segments.length).toBeGreaterThan(0);
            expect(segments.every(s => s.length > 2)).toBe(true);
        });

        it('should not split short lines by delimiters', () => {
            const shortLine = 'A, B, C';
            const segments = splitIntoSegments(shortLine);
            
            // Short line (< 50 chars) stays together
            expect(segments).toEqual(['A, B, C']);
        });

        it('should filter short sub-segments from long line splits', () => {
            // Long line with some very short items
            const longLine = 'A, BB, CCC, DDDD, E, FF, Long Item Name, Another Long Name';
            const segments = splitIntoSegments(longLine);
            
            // A, BB, E, FF are <= 2 chars, should be filtered
            expect(segments).toContain('CCC');
            expect(segments).toContain('DDDD');
            expect(segments).toContain('Long Item Name');
            expect(segments).toContain('Another Long Name');
            expect(segments).not.toContain('A');
            expect(segments).not.toContain('BB');
            expect(segments).not.toContain('E');
            expect(segments).not.toContain('FF');
        });
    });

    describe('OCR-realistic scenarios', () => {
        it('should handle typical OCR output with item names', () => {
            const ocrText = `
                Power Crystal
                Lightning Shard
                Fire Gem
                Health Potion
            `;
            const segments = splitIntoSegments(ocrText);
            
            expect(segments).toContain('Power Crystal');
            expect(segments).toContain('Lightning Shard');
            expect(segments).toContain('Fire Gem');
            expect(segments).toContain('Health Potion');
        });

        it('should handle OCR text with noise and artifacts', () => {
            const ocrText = `
                ||
                Power Crystal
                ..
                --
                Lightning Shard
                ##
            `;
            const segments = splitIntoSegments(ocrText);
            
            // Noise items like "||", "..", "--", "##" are <= 2 chars, filtered
            expect(segments).toEqual(['Power Crystal', 'Lightning Shard']);
        });

        it('should handle game inventory list format', () => {
            const inventoryText = `
                Inventory:
                Sword of Fire x3
                Shield of Ice x1
                Health Potion x5
                Mana Elixir x2
            `;
            const segments = splitIntoSegments(inventoryText);
            
            expect(segments).toContain('Inventory:');
            expect(segments).toContain('Sword of Fire x3');
            expect(segments).toContain('Shield of Ice x1');
            expect(segments).toContain('Health Potion x5');
            expect(segments).toContain('Mana Elixir x2');
        });

        it('should handle comma-separated item list in summary', () => {
            // Long line typical of game summary screens
            const summaryLine = 'Items collected: Power Crystal, Fire Shard, Ice Gem, Thunder Stone, Water Drop, Earth Core';
            const segments = splitIntoSegments(summaryLine);
            
            expect(segments).toContain('Items collected: Power Crystal');
            expect(segments).toContain('Fire Shard');
            expect(segments).toContain('Ice Gem');
            expect(segments).toContain('Thunder Stone');
            expect(segments).toContain('Water Drop');
            expect(segments).toContain('Earth Core');
        });
    });

    describe('edge cases', () => {
        it('should handle single long line', () => {
            const singleLongLine = 'This is a very long line of text that exceeds fifty characters in length';
            const segments = splitIntoSegments(singleLongLine);
            
            // No delimiters, so stays as one segment
            expect(segments).toEqual([singleLongLine]);
        });

        it('should handle multiple empty lines', () => {
            const text = 'First\n\n\n\nSecond\n\n\nThird';
            const segments = splitIntoSegments(text);
            
            expect(segments).toEqual(['First', 'Second', 'Third']);
        });

        it('should handle Windows-style line endings (\\r\\n)', () => {
            // Windows line endings get split on \n, leaving \r which gets trimmed
            const text = 'First\r\nSecond\r\nThird';
            const segments = splitIntoSegments(text);
            
            expect(segments).toEqual(['First', 'Second', 'Third']);
        });

        it('should handle consecutive delimiters in long lines', () => {
            const text = 'A,,,,B;;;;C||||D\t\t\t\tE,F,G,H,I,J,K,L,M,N,O,P,Q';
            const segments = splitIntoSegments(text);
            
            // Consecutive delimiters create empty strings which get filtered
            // All remaining items should have length > 2
            expect(segments.every(s => s.length > 2)).toBe(true);
        });

        it('should handle unicode characters', () => {
            const text = 'Épée de Feu\nBouclier Glacé\n火の剣\n氷の盾';
            const segments = splitIntoSegments(text);
            
            expect(segments).toContain('Épée de Feu');
            expect(segments).toContain('Bouclier Glacé');
            expect(segments).toContain('火の剣');
            expect(segments).toContain('氷の盾');
        });
    });
});

// ========================================
// extractItemCounts Tests
// ========================================

describe('extractItemCounts', () => {
    describe('pattern: item x3 / item ×3', () => {
        it('should extract counts with lowercase x', () => {
            const text = 'Power Crystal x3';
            const counts = extractItemCounts(text);
            
            expect(counts.get('power crystal')).toBe(3);
        });

        it('should extract counts with multiplication sign ×', () => {
            const text = 'Fire Shard ×5';
            const counts = extractItemCounts(text);
            
            expect(counts.get('fire shard')).toBe(5);
        });

        it('should extract counts with uppercase X', () => {
            const text = 'Ice Gem X2';
            const counts = extractItemCounts(text);
            
            expect(counts.get('ice gem')).toBe(2);
        });

        it('should handle spaces around x', () => {
            const text = 'Lightning Stone x 7';
            const counts = extractItemCounts(text);
            
            expect(counts.get('lightning stone')).toBe(7);
        });

        it('should handle no space before x', () => {
            const text = 'Earth Corexx4';
            // Pattern expects some chars between name and count
            // This won't match cleanly, but let's see
            const counts = extractItemCounts(text);
            
            // The regex .+? is non-greedy, so "Earth Corex" x 4
            expect(counts.has('earth corex')).toBe(true);
        });
    });

    describe('pattern: item (count)', () => {
        it('should extract counts in parentheses', () => {
            const text = 'Health Potion (10)';
            const counts = extractItemCounts(text);
            
            expect(counts.get('health potion')).toBe(10);
        });

        it('should handle space before parenthesis', () => {
            const text = 'Mana Elixir (5)';
            const counts = extractItemCounts(text);
            
            expect(counts.get('mana elixir')).toBe(5);
        });
    });

    describe('pattern: item: count', () => {
        it('should extract counts with colon separator', () => {
            const text = 'Sword of Fire: 3';
            const counts = extractItemCounts(text);
            
            expect(counts.get('sword of fire')).toBe(3);
        });

        it('should handle spaces around colon', () => {
            const text = 'Shield of Ice : 2';
            const counts = extractItemCounts(text);
            
            expect(counts.get('shield of ice')).toBe(2);
        });
    });

    describe('multiple items', () => {
        it('should extract multiple items from multi-line text', () => {
            const text = `
                Power Crystal x3
                Fire Shard ×2
                Ice Gem (5)
                Health Potion: 10
            `;
            const counts = extractItemCounts(text);
            
            expect(counts.get('power crystal')).toBe(3);
            expect(counts.get('fire shard')).toBe(2);
            expect(counts.get('ice gem')).toBe(5);
            expect(counts.get('health potion')).toBe(10);
        });

        it('should extract multiple items from single line', () => {
            const text = 'Item A x1, Item B x2, Item C x3';
            const counts = extractItemCounts(text);
            
            // The patterns should match these
            expect(counts.size).toBeGreaterThanOrEqual(3);
        });
    });

    describe('count validation', () => {
        it('should handle single digit counts', () => {
            const text = 'Item x1';
            const counts = extractItemCounts(text);
            
            expect(counts.get('item')).toBe(1);
        });

        it('should handle double digit counts', () => {
            const text = 'Item x99';
            const counts = extractItemCounts(text);
            
            expect(counts.get('item')).toBe(99);
        });

        it('should handle large counts', () => {
            const text = 'Item x999';
            const counts = extractItemCounts(text);
            
            expect(counts.get('item')).toBe(999);
        });

        it('should ignore zero counts', () => {
            const text = 'Item x0';
            const counts = extractItemCounts(text);
            
            // count > 0 check should filter this
            expect(counts.has('item')).toBe(false);
        });

        it('should ignore negative-like patterns', () => {
            const text = 'Item x-5';
            const counts = extractItemCounts(text);
            
            // Pattern \d+ won't match -5
            expect(counts.has('item')).toBe(false);
        });
    });

    describe('case sensitivity', () => {
        it('should store item names as lowercase', () => {
            const text = 'POWER CRYSTAL x3';
            const counts = extractItemCounts(text);
            
            expect(counts.has('POWER CRYSTAL')).toBe(false);
            expect(counts.has('power crystal')).toBe(true);
        });

        it('should normalize mixed case names', () => {
            const text = 'PoWeR CrYsTaL x5';
            const counts = extractItemCounts(text);
            
            expect(counts.get('power crystal')).toBe(5);
        });
    });

    describe('edge cases', () => {
        it('should return empty Map for empty text', () => {
            const counts = extractItemCounts('');
            expect(counts.size).toBe(0);
        });

        it('should return empty Map for text without counts', () => {
            const counts = extractItemCounts('Just some text without any item counts');
            expect(counts.size).toBe(0);
        });

        it('should handle text with only count patterns (no names)', () => {
            const text = 'x5 ×3 (10)';
            const counts = extractItemCounts(text);
            
            // Should not crash, might extract weird things or nothing
            // Main point is it shouldn't error
            expect(counts).toBeInstanceOf(Map);
        });

        it('should handle overlapping patterns', () => {
            // Same item might match multiple patterns
            const text = 'Item x3: 5 (7)';
            const counts = extractItemCounts(text);
            
            // Multiple matches for same name - behavior depends on pattern order
            // Just ensure no crash and reasonable output
            expect(counts.size).toBeGreaterThan(0);
        });

        it('should trim whitespace from item names', () => {
            const text = '  Spaced Item   x3';
            const counts = extractItemCounts(text);
            
            expect(counts.get('spaced item')).toBe(3);
        });

        it('should handle special characters in item names', () => {
            const text = "Fire's Gem x2";
            const counts = extractItemCounts(text);
            
            expect(counts.get("fire's gem")).toBe(2);
        });

        it('should handle hyphenated item names', () => {
            const text = 'Super-Power-Crystal x4';
            const counts = extractItemCounts(text);
            
            expect(counts.get('super-power-crystal')).toBe(4);
        });
    });

    describe('OCR-realistic scenarios', () => {
        it('should handle typical game inventory OCR', () => {
            const ocrText = `
                Inventory:
                Health Potion x5
                Mana Potion x3
                Antidote ×2
                Revival Stone (1)
                Gold Coins: 1500
            `;
            const counts = extractItemCounts(ocrText);
            
            expect(counts.get('health potion')).toBe(5);
            expect(counts.get('mana potion')).toBe(3);
            expect(counts.get('antidote')).toBe(2);
            expect(counts.get('revival stone')).toBe(1);
            expect(counts.get('gold coins')).toBe(1500);
        });

        it('should handle noisy OCR output', () => {
            const noisyOcr = `
                Pow3r Crystal x3
                F1re Shard x2
                |ce Gem x5
            `;
            const counts = extractItemCounts(noisyOcr);
            
            // OCR errors in names but count extraction should still work
            expect(counts.get('pow3r crystal')).toBe(3);
            expect(counts.get('f1re shard')).toBe(2);
            expect(counts.get('|ce gem')).toBe(5);
        });

        it('should handle stacked item format from MegaBonk', () => {
            const megabonkOcr = `
                Big Bonk x2
                Tiny Bonk x5
                Mega Bonk ×1
            `;
            const counts = extractItemCounts(megabonkOcr);
            
            expect(counts.get('big bonk')).toBe(2);
            expect(counts.get('tiny bonk')).toBe(5);
            expect(counts.get('mega bonk')).toBe(1);
        });
    });
});

// ========================================
// Integration-style Tests
// ========================================

describe('OCR Utils Integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should use withTimeout with sleep for retry logic', async () => {
        let attempts = 0;
        
        const unreliableOperation = async (): Promise<string> => {
            attempts++;
            if (attempts < 3) {
                throw new Error('temporary failure');
            }
            return 'success';
        };
        
        const retryWithBackoff = async (maxRetries: number): Promise<string> => {
            let lastError: Error | null = null;
            
            for (let i = 0; i <= maxRetries; i++) {
                try {
                    return await withTimeout(unreliableOperation(), 1000, 'operation');
                } catch (error) {
                    lastError = error as Error;
                    if (i < maxRetries) {
                        await sleep(100 * Math.pow(2, i));
                    }
                }
            }
            throw lastError;
        };
        
        const resultPromise = retryWithBackoff(3);
        
        // First attempt fails immediately
        await vi.advanceTimersByTimeAsync(0);
        
        // Wait for first backoff (100ms)
        await vi.advanceTimersByTimeAsync(100);
        
        // Second attempt fails
        await vi.advanceTimersByTimeAsync(0);
        
        // Wait for second backoff (200ms)
        await vi.advanceTimersByTimeAsync(200);
        
        // Third attempt succeeds
        const result = await resultPromise;
        
        expect(result).toBe('success');
        expect(attempts).toBe(3);
    });

    it('should combine splitIntoSegments with extractItemCounts for full OCR processing', () => {
        // Use multi-line format for items (more realistic OCR output)
        const ocrOutput = `
            === Run Summary ===
            Items Collected:
            Power Crystal x3
            Fire Shard x2
            Ice Gem x5
            
            Character: Hero
            Weapon: Sword
            
            Total Gold: 1500
        `;
        
        // Split into segments for entity matching
        const segments = splitIntoSegments(ocrOutput);
        
        // Extract item counts from full text
        const counts = extractItemCounts(ocrOutput);
        
        // Segments should include meaningful lines
        expect(segments).toContain('=== Run Summary ===');
        expect(segments).toContain('Items Collected:');
        expect(segments).toContain('Power Crystal x3');
        expect(segments).toContain('Fire Shard x2');
        expect(segments).toContain('Ice Gem x5');
        expect(segments).toContain('Character: Hero');
        expect(segments).toContain('Weapon: Sword');
        
        // Counts should be extracted
        expect(counts.get('power crystal')).toBe(3);
        expect(counts.get('fire shard')).toBe(2);
        expect(counts.get('ice gem')).toBe(5);
        expect(counts.get('total gold')).toBe(1500);
    });
});
