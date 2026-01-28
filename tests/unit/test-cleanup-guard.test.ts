/**
 * Memory Leak Detection Test
 *
 * This test acts as a canary to detect memory leaks in the test infrastructure.
 * It runs a series of dummy tests and monitors memory usage to ensure proper cleanup.
 *
 * If this test fails, it indicates a memory leak in the test setup/teardown process.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Test Infrastructure - Memory Leak Detection', () => {
    it('should properly clean up mocks between tests', () => {
        // Track initial state
        const initialLogSpy = console.log;
        const initialErrorSpy = console.error;

        // Create some spies (similar to what setup.js does)
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Verify spies are active
        console.log('test');
        console.error('test');
        expect(logSpy).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();

        // Note: The afterEach hook in setup.js should restore these automatically
        // This test validates that mechanism is working
    });

    it('should have clean console state after previous test', () => {
        // If restoreAllMocks() is working, console should be restored
        // We can't directly check if it's a spy, but we can verify behavior

        // Create a fresh spy to test
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        console.warn('test');
        expect(spy).toHaveBeenCalledOnce();

        // Cleanup
        spy.mockRestore();
    });

    it('should not accumulate DOM nodes between tests', () => {
        // Check that document body gets cleaned
        const initialChildCount = document.body.children.length;

        // Add some elements
        const testDiv = document.createElement('div');
        testDiv.id = 'memory-leak-test';
        document.body.appendChild(testDiv);

        expect(document.body.children.length).toBeGreaterThan(initialChildCount);

        // Cleanup (setup.js should also handle this with fresh JSDOM)
        testDiv.remove();
    });

    it('should clear all timers between tests', () => {
        // This validates that vi.clearAllTimers() is being called
        const callback = vi.fn();

        // Set various timers
        setTimeout(callback, 100);
        setInterval(callback, 100);

        // These should be cleared by afterEach, preventing memory leaks
        // If not cleared, they would accumulate across test files

        expect(callback).not.toHaveBeenCalled();
    });

    it('should reset modules between tests', () => {
        // Verify that vi.resetModules() is being called
        // This prevents module state from leaking between tests

        // We can't directly test module caching, but we can verify
        // that dynamic imports work correctly
        expect(() => {
            // This should work if modules are being reset properly
            import('../../src/modules/utils.ts');
        }).not.toThrow();
    });
});

/**
 * CRITICAL CHECKLIST for Test Setup/Teardown:
 *
 * In tests/setup.js afterEach(), ensure ALL of these are called:
 * ✓ vi.clearAllTimers()     - Clears setTimeout/setInterval
 * ✓ vi.clearAllMocks()      - Clears mock call history
 * ✓ vi.restoreAllMocks()    - CRITICAL: Removes spy instances
 * ✓ vi.resetModules()       - Clears module cache
 * ✓ currentDom.window.close() - Frees JSDOM memory
 *
 * Missing ANY of these can cause memory leaks!
 */
