// ========================================
// MegaBonk Async Utilities Module
// ========================================
// Shared async patterns: mutex locks, race condition prevention
// ========================================

/**
 * Simple mutex lock for preventing race conditions
 * Usage:
 *   const lock = createMutex('myOperation');
 *   if (!lock.tryAcquire()) return; // Already running
 *   try { await doWork(); } finally { lock.release(); }
 */
export interface Mutex {
    /** Check if lock is currently held */
    isLocked: () => boolean;
    /** Try to acquire lock. Returns true if acquired, false if already held. */
    tryAcquire: () => boolean;
    /** Release the lock */
    release: () => void;
    /** Execute function with lock, returning null if lock unavailable */
    withLock: <T>(fn: () => Promise<T>) => Promise<T | null>;
}

/**
 * Create a mutex lock for race condition prevention
 * @param _name - Optional name for debugging (reserved for future use)
 * @returns Mutex interface
 */
export function createMutex(_name?: string): Mutex {
    let locked = false;

    return {
        isLocked: () => locked,

        tryAcquire: () => {
            if (locked) return false;
            locked = true;
            return true;
        },

        release: () => {
            locked = false;
        },

        withLock: async <T>(fn: () => Promise<T>): Promise<T | null> => {
            if (locked) return null;
            locked = true;
            try {
                return await fn();
            } finally {
                locked = false;
            }
        },
    };
}

/**
 * Create a debounced async function that tracks pending operations
 * Prevents race conditions from rapid calls by ignoring stale results
 * @param fn - Async function to wrap
 * @param delayMs - Debounce delay in milliseconds
 * @returns Wrapped function and cancel method
 */
export function createDebouncedAsync<T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>,
    delayMs: number
): {
    call: (...args: Args) => Promise<T | null>;
    cancel: () => void;
} {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingId = 0;

    return {
        call: async (...args: Args): Promise<T | null> => {
            // Cancel any pending call
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Increment ID to track this specific call
            pendingId++;
            const currentId = pendingId;

            return new Promise((resolve) => {
                timeoutId = setTimeout(async () => {
                    // Check if this call is still current
                    if (currentId !== pendingId) {
                        resolve(null);
                        return;
                    }

                    try {
                        const result = await fn(...args);
                        // Double-check after async work
                        if (currentId === pendingId) {
                            resolve(result);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        // Only propagate if still current
                        if (currentId === pendingId) {
                            throw error;
                        }
                        resolve(null);
                    }
                }, delayMs);
            });
        },

        cancel: () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            pendingId++;
        },
    };
}

/**
 * Create a session tracker for canceling stale async operations
 * Useful for modal/UI state that can change during async work
 * @returns Session tracker interface
 */
export interface SessionTracker {
    /** Get current session ID */
    getCurrentId: () => number;
    /** Start a new session, invalidating previous */
    startNew: () => number;
    /** Check if given ID is still the current session */
    isCurrent: (id: number) => boolean;
    /** Reset to initial state */
    reset: () => void;
}

export function createSessionTracker(): SessionTracker {
    let currentSessionId = 0;

    return {
        getCurrentId: () => currentSessionId,
        startNew: () => ++currentSessionId,
        isCurrent: (id: number) => id === currentSessionId,
        reset: () => {
            currentSessionId = 0;
        },
    };
}
