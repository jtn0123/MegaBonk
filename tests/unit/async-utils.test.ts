/**
 * Async Utilities Tests
 * Tests for mutex locks, debounced async functions, and session tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createMutex,
    createDebouncedAsync,
    createSessionTracker,
    type Mutex,
    type SessionTracker,
} from '../../src/modules/async-utils.ts';

// ========================================
// Mutex Tests
// ========================================

describe('createMutex', () => {
    let mutex: Mutex;

    beforeEach(() => {
        mutex = createMutex('test-mutex');
    });

    describe('isLocked', () => {
        it('should return false initially', () => {
            expect(mutex.isLocked()).toBe(false);
        });

        it('should return true after acquiring lock', () => {
            mutex.tryAcquire();
            expect(mutex.isLocked()).toBe(true);
        });

        it('should return false after releasing lock', () => {
            mutex.tryAcquire();
            mutex.release();
            expect(mutex.isLocked()).toBe(false);
        });
    });

    describe('tryAcquire', () => {
        it('should return true on first acquire', () => {
            expect(mutex.tryAcquire()).toBe(true);
        });

        it('should return false if already locked', () => {
            mutex.tryAcquire();
            expect(mutex.tryAcquire()).toBe(false);
        });

        it('should allow re-acquire after release', () => {
            mutex.tryAcquire();
            mutex.release();
            expect(mutex.tryAcquire()).toBe(true);
        });
    });

    describe('release', () => {
        it('should release the lock', () => {
            mutex.tryAcquire();
            mutex.release();
            expect(mutex.isLocked()).toBe(false);
        });

        it('should be safe to call multiple times', () => {
            mutex.tryAcquire();
            mutex.release();
            mutex.release(); // Should not throw
            expect(mutex.isLocked()).toBe(false);
        });

        it('should be safe to call when not locked', () => {
            mutex.release(); // Should not throw
            expect(mutex.isLocked()).toBe(false);
        });
    });

    describe('withLock', () => {
        it('should execute function when lock available', async () => {
            const result = await mutex.withLock(async () => 'success');
            expect(result).toBe('success');
        });

        it('should return null when lock unavailable', async () => {
            mutex.tryAcquire();
            const result = await mutex.withLock(async () => 'should not run');
            expect(result).toBeNull();
        });

        it('should release lock after function completes', async () => {
            await mutex.withLock(async () => 'done');
            expect(mutex.isLocked()).toBe(false);
        });

        it('should release lock even on error', async () => {
            try {
                await mutex.withLock(async () => {
                    throw new Error('test error');
                });
            } catch {
                // Expected
            }
            expect(mutex.isLocked()).toBe(false);
        });

        it('should pass through async result', async () => {
            const result = await mutex.withLock(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 42;
            });
            expect(result).toBe(42);
        });

        it('should prevent concurrent execution', async () => {
            const order: number[] = [];

            // First call acquires lock
            const promise1 = mutex.withLock(async () => {
                order.push(1);
                await new Promise(resolve => setTimeout(resolve, 50));
                order.push(2);
                return 'first';
            });

            // Small delay to ensure first is started
            await new Promise(resolve => setTimeout(resolve, 10));

            // Second call should return null immediately
            const promise2 = mutex.withLock(async () => {
                order.push(3);
                return 'second';
            });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1).toBe('first');
            expect(result2).toBeNull();
            expect(order).toEqual([1, 2]); // 3 never runs
        });
    });

    describe('multiple mutex instances', () => {
        it('should be independent', () => {
            const mutex1 = createMutex('mutex1');
            const mutex2 = createMutex('mutex2');

            mutex1.tryAcquire();

            expect(mutex1.isLocked()).toBe(true);
            expect(mutex2.isLocked()).toBe(false);
            expect(mutex2.tryAcquire()).toBe(true);
        });
    });
});

// ========================================
// Debounced Async Tests
// ========================================

describe('createDebouncedAsync', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should debounce rapid calls', async () => {
        const fn = vi.fn().mockResolvedValue('result');
        const { call } = createDebouncedAsync(fn, 100);

        // Make 3 rapid calls - only the last one matters
        call('a'); // Will be cancelled
        call('b'); // Will be cancelled
        const promise3 = call('c'); // This one will execute

        // Function shouldn't be called yet
        expect(fn).not.toHaveBeenCalled();

        // Fast-forward time
        await vi.advanceTimersByTimeAsync(100);

        // Only test the last promise
        const result = await promise3;

        // Function called only once with last args
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('c');

        // Last call returns result
        expect(result).toBe('result');
    });

    it('should execute after delay', async () => {
        const fn = vi.fn().mockResolvedValue('done');
        const { call } = createDebouncedAsync(fn, 50);

        const promise = call();

        // Not called immediately
        expect(fn).not.toHaveBeenCalled();

        // Advance time
        await vi.advanceTimersByTimeAsync(50);

        const result = await promise;
        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('done');
    });

    it('should cancel previous calls', async () => {
        const fn = vi.fn().mockResolvedValue('result');
        const { call } = createDebouncedAsync(fn, 100);

        call('first');

        // Advance partially
        await vi.advanceTimersByTimeAsync(50);

        // Make another call
        const secondPromise = call('second');

        // Advance past first debounce time but not second
        await vi.advanceTimersByTimeAsync(50);

        // First call should have been cancelled
        expect(fn).not.toHaveBeenCalled();

        // Advance to complete second
        await vi.advanceTimersByTimeAsync(50);

        const result = await secondPromise;
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('second');
        expect(result).toBe('result');
    });

    it('should cancel via cancel method', async () => {
        const fn = vi.fn().mockResolvedValue('result');
        const { call, cancel } = createDebouncedAsync(fn, 100);

        call();
        cancel();

        await vi.advanceTimersByTimeAsync(200);

        expect(fn).not.toHaveBeenCalled();
    });

    it('should handle async function that takes time', async () => {
        const fn = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'async-result';
        });
        const { call } = createDebouncedAsync(fn, 100);

        const promise = call();

        // Advance past debounce
        await vi.advanceTimersByTimeAsync(100);

        // Advance past async work
        await vi.advanceTimersByTimeAsync(50);

        const result = await promise;
        expect(result).toBe('async-result');
    });

    it('should return null if superseded during async work', async () => {
        const fn = vi.fn().mockImplementation(async (value: string) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return value;
        });
        const { call } = createDebouncedAsync(fn, 100);

        // First call
        const promise1 = call('first');

        // Wait for debounce
        await vi.advanceTimersByTimeAsync(100);

        // While async work is happening, make another call
        const promise2 = call('second');

        // Advance past first async work
        await vi.advanceTimersByTimeAsync(50);

        // Wait for second debounce
        await vi.advanceTimersByTimeAsync(100);

        // Advance past second async work
        await vi.advanceTimersByTimeAsync(50);

        const [result1, result2] = await Promise.all([promise1, promise2]);

        // First was superseded by second call during its async work
        expect(result1).toBeNull();
        expect(result2).toBe('second');
    });

    it('should pass multiple arguments', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const { call } = createDebouncedAsync(fn, 50);

        const promise = call('a', 'b', 123);
        await vi.advanceTimersByTimeAsync(50);
        await promise;

        expect(fn).toHaveBeenCalledWith('a', 'b', 123);
    });
});

// ========================================
// Session Tracker Tests
// ========================================

describe('createSessionTracker', () => {
    let tracker: SessionTracker;

    beforeEach(() => {
        tracker = createSessionTracker();
    });

    describe('getCurrentId', () => {
        it('should return 0 initially', () => {
            expect(tracker.getCurrentId()).toBe(0);
        });

        it('should return current session id after startNew', () => {
            tracker.startNew();
            expect(tracker.getCurrentId()).toBe(1);

            tracker.startNew();
            expect(tracker.getCurrentId()).toBe(2);
        });
    });

    describe('startNew', () => {
        it('should increment and return new session id', () => {
            expect(tracker.startNew()).toBe(1);
            expect(tracker.startNew()).toBe(2);
            expect(tracker.startNew()).toBe(3);
        });

        it('should invalidate previous session', () => {
            const session1 = tracker.startNew();
            expect(tracker.isCurrent(session1)).toBe(true);

            tracker.startNew();
            expect(tracker.isCurrent(session1)).toBe(false);
        });
    });

    describe('isCurrent', () => {
        it('should return true for current session', () => {
            const id = tracker.startNew();
            expect(tracker.isCurrent(id)).toBe(true);
        });

        it('should return false for old session', () => {
            const oldId = tracker.startNew();
            tracker.startNew();
            expect(tracker.isCurrent(oldId)).toBe(false);
        });

        it('should return true for id 0 initially', () => {
            expect(tracker.isCurrent(0)).toBe(true);
        });

        it('should return false for future ids', () => {
            expect(tracker.isCurrent(100)).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset session id to 0', () => {
            tracker.startNew();
            tracker.startNew();
            tracker.reset();

            expect(tracker.getCurrentId()).toBe(0);
        });

        it('should invalidate all previous sessions', () => {
            const session1 = tracker.startNew();
            const session2 = tracker.startNew();
            tracker.reset();

            expect(tracker.isCurrent(session1)).toBe(false);
            expect(tracker.isCurrent(session2)).toBe(false);
            expect(tracker.isCurrent(0)).toBe(true);
        });
    });

    describe('use case: stale async operations', () => {
        it('should detect stale operations', async () => {
            const results: string[] = [];

            // Simulate async operation that checks session
            const doAsyncWork = async (sessionId: number, value: string) => {
                await new Promise(resolve => setTimeout(resolve, 10));

                if (tracker.isCurrent(sessionId)) {
                    results.push(value);
                }
            };

            // Start first session
            const session1 = tracker.startNew();
            const promise1 = doAsyncWork(session1, 'first');

            // Start second session while first is pending
            const session2 = tracker.startNew();
            const promise2 = doAsyncWork(session2, 'second');

            await Promise.all([promise1, promise2]);

            // Only second should complete (first is stale)
            expect(results).toEqual(['second']);
        });
    });

    describe('multiple tracker instances', () => {
        it('should be independent', () => {
            const tracker1 = createSessionTracker();
            const tracker2 = createSessionTracker();

            tracker1.startNew();
            tracker1.startNew();

            expect(tracker1.getCurrentId()).toBe(2);
            expect(tracker2.getCurrentId()).toBe(0);
        });
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Async Utils Integration', () => {
    it('should combine mutex and session tracker for modal state', async () => {
        const mutex = createMutex('modal');
        const tracker = createSessionTracker();

        const openModal = async (modalId: string) => {
            const sessionId = tracker.startNew();

            const result = await mutex.withLock(async () => {
                // Check if this modal is still current (no delay needed for this test)
                if (!tracker.isCurrent(sessionId)) {
                    return null;
                }

                return modalId;
            });

            return result;
        };

        // Open modal
        const result = await openModal('modal-1');
        expect(result).toBe('modal-1');
    });

    describe('with fake timers', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should debounce and track sessions together', async () => {
        const tracker = createSessionTracker();
        const processed: string[] = [];

        const fetchData = async (query: string) => {
            const sessionId = tracker.startNew();
            await new Promise(resolve => setTimeout(resolve, 100));

            if (tracker.isCurrent(sessionId)) {
                processed.push(query);
            }
            return query;
        };

        const { call } = createDebouncedAsync(fetchData, 50);

        // Rapid calls
        call('a');
        call('b');
        const lastPromise = call('c');

        // Advance past debounce
        await vi.advanceTimersByTimeAsync(50);

        // Advance past fetch
        await vi.advanceTimersByTimeAsync(100);

        await lastPromise;

        // Only 'c' should be processed
        expect(processed).toEqual(['c']);
        });
    });
});
