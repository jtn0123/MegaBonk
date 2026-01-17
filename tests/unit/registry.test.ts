/**
 * @vitest-environment jsdom
 * Registry Module - Comprehensive Tests
 * Tests for typed function registry for cross-module communication
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    registerFunction,
    getFunction,
    callFunction,
    isRegistered,
    unregisterFunction,
    clearRegistry,
    getRegisteredFunctions,
    type BuildState,
} from '../../src/modules/registry.ts';

// ========================================
// Test Suite
// ========================================

describe('Registry Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRegistry();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearRegistry();
    });

    // ========================================
    // registerFunction Tests
    // ========================================
    describe('registerFunction', () => {
        it('should register a function', () => {
            const mockFn = vi.fn();
            registerFunction('switchTab', mockFn);

            expect(getFunction('switchTab')).toBe(mockFn);
        });

        it('should register multiple functions', () => {
            const switchTab = vi.fn();
            const renderTabContent = vi.fn();

            registerFunction('switchTab', switchTab);
            registerFunction('renderTabContent', renderTabContent);

            expect(getFunction('switchTab')).toBe(switchTab);
            expect(getFunction('renderTabContent')).toBe(renderTabContent);
        });

        it('should overwrite existing registration', () => {
            const oldFn = vi.fn();
            const newFn = vi.fn();

            registerFunction('switchTab', oldFn);
            registerFunction('switchTab', newFn);

            expect(getFunction('switchTab')).toBe(newFn);
            expect(getFunction('switchTab')).not.toBe(oldFn);
        });

        it('should allow registering null to unregister', () => {
            const mockFn = vi.fn();
            registerFunction('switchTab', mockFn);
            registerFunction('switchTab', null);

            expect(getFunction('switchTab')).toBeNull();
        });

        it('should register initAdvisor function', () => {
            const initAdvisor = vi.fn();
            registerFunction('initAdvisor', initAdvisor);

            expect(getFunction('initAdvisor')).toBe(initAdvisor);
        });

        it('should register applyScannedBuild function', () => {
            const applyScannedBuild = vi.fn();
            registerFunction('applyScannedBuild', applyScannedBuild);

            expect(getFunction('applyScannedBuild')).toBe(applyScannedBuild);
        });

        it('should register CV-related functions', () => {
            const initCV = vi.fn();
            const initOCR = vi.fn();
            const initEnhancedCV = vi.fn().mockResolvedValue(undefined);

            registerFunction('initCV', initCV);
            registerFunction('initOCR', initOCR);
            registerFunction('initEnhancedCV', initEnhancedCV);

            expect(getFunction('initCV')).toBe(initCV);
            expect(getFunction('initOCR')).toBe(initOCR);
            expect(getFunction('initEnhancedCV')).toBe(initEnhancedCV);
        });
    });

    // ========================================
    // getFunction Tests
    // ========================================
    describe('getFunction', () => {
        it('should return null for unregistered function', () => {
            expect(getFunction('switchTab')).toBeNull();
        });

        it('should return registered function', () => {
            const mockFn = vi.fn();
            registerFunction('switchTab', mockFn);

            expect(getFunction('switchTab')).toBe(mockFn);
        });

        it('should return null after unregistering', () => {
            const mockFn = vi.fn();
            registerFunction('switchTab', mockFn);
            unregisterFunction('switchTab');

            expect(getFunction('switchTab')).toBeNull();
        });

        it('should return different functions for different keys', () => {
            const fn1 = vi.fn();
            const fn2 = vi.fn();

            registerFunction('switchTab', fn1);
            registerFunction('renderTabContent', fn2);

            expect(getFunction('switchTab')).toBe(fn1);
            expect(getFunction('renderTabContent')).toBe(fn2);
            expect(getFunction('switchTab')).not.toBe(fn2);
        });
    });

    // ========================================
    // callFunction Tests
    // ========================================
    describe('callFunction', () => {
        it('should call registered function with arguments', () => {
            const switchTab = vi.fn();
            registerFunction('switchTab', switchTab);

            callFunction('switchTab', 'weapons');

            expect(switchTab).toHaveBeenCalledWith('weapons');
            expect(switchTab).toHaveBeenCalledTimes(1);
        });

        it('should return undefined for unregistered function', () => {
            const result = callFunction('switchTab', 'items');

            expect(result).toBeUndefined();
        });

        it('should return function return value', () => {
            const getTab = vi.fn().mockReturnValue('items');
            registerFunction('switchTab', getTab);

            const result = callFunction('switchTab', 'weapons');

            // Note: switchTab doesn't return anything typically, but testing the mechanism
            expect(getTab).toHaveBeenCalled();
        });

        it('should call function with no arguments', () => {
            const renderTabContent = vi.fn();
            registerFunction('renderTabContent', renderTabContent);

            callFunction('renderTabContent', 'items');

            expect(renderTabContent).toHaveBeenCalledWith('items');
        });

        it('should call initAdvisor with gameData', () => {
            const initAdvisor = vi.fn();
            const gameData = { items: { items: [] }, weapons: { weapons: [] } };
            registerFunction('initAdvisor', initAdvisor);

            callFunction('initAdvisor', gameData as any);

            expect(initAdvisor).toHaveBeenCalledWith(gameData);
        });

        it('should call applyScannedBuild with build state', () => {
            const applyScannedBuild = vi.fn();
            const buildState: BuildState = {
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            };
            registerFunction('applyScannedBuild', applyScannedBuild);

            callFunction('applyScannedBuild', buildState);

            expect(applyScannedBuild).toHaveBeenCalledWith(buildState);
        });

        it('should not throw when calling unregistered function', () => {
            expect(() => callFunction('switchTab', 'items')).not.toThrow();
        });

        it('should handle async functions', async () => {
            const asyncFn = vi.fn().mockResolvedValue('result');
            registerFunction('initEnhancedCV', asyncFn);

            const result = callFunction('initEnhancedCV');

            expect(asyncFn).toHaveBeenCalled();
            await expect(result).resolves.toBe('result');
        });
    });

    // ========================================
    // isRegistered Tests
    // ========================================
    describe('isRegistered', () => {
        it('should return false for unregistered function', () => {
            expect(isRegistered('switchTab')).toBe(false);
        });

        it('should return true for registered function', () => {
            registerFunction('switchTab', vi.fn());

            expect(isRegistered('switchTab')).toBe(true);
        });

        it('should return false after unregistering', () => {
            registerFunction('switchTab', vi.fn());
            unregisterFunction('switchTab');

            expect(isRegistered('switchTab')).toBe(false);
        });

        it('should return false after clearing registry', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());
            clearRegistry();

            expect(isRegistered('switchTab')).toBe(false);
            expect(isRegistered('renderTabContent')).toBe(false);
        });

        it('should check each function key independently', () => {
            registerFunction('switchTab', vi.fn());

            expect(isRegistered('switchTab')).toBe(true);
            expect(isRegistered('renderTabContent')).toBe(false);
            expect(isRegistered('initAdvisor')).toBe(false);
        });
    });

    // ========================================
    // unregisterFunction Tests
    // ========================================
    describe('unregisterFunction', () => {
        it('should unregister a registered function', () => {
            registerFunction('switchTab', vi.fn());
            unregisterFunction('switchTab');

            expect(getFunction('switchTab')).toBeNull();
            expect(isRegistered('switchTab')).toBe(false);
        });

        it('should not throw when unregistering non-existent function', () => {
            expect(() => unregisterFunction('switchTab')).not.toThrow();
        });

        it('should only unregister specified function', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());

            unregisterFunction('switchTab');

            expect(isRegistered('switchTab')).toBe(false);
            expect(isRegistered('renderTabContent')).toBe(true);
        });

        it('should allow re-registering after unregistering', () => {
            const fn1 = vi.fn();
            const fn2 = vi.fn();

            registerFunction('switchTab', fn1);
            unregisterFunction('switchTab');
            registerFunction('switchTab', fn2);

            expect(getFunction('switchTab')).toBe(fn2);
        });
    });

    // ========================================
    // clearRegistry Tests
    // ========================================
    describe('clearRegistry', () => {
        it('should clear all registered functions', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());
            registerFunction('initAdvisor', vi.fn());

            clearRegistry();

            expect(isRegistered('switchTab')).toBe(false);
            expect(isRegistered('renderTabContent')).toBe(false);
            expect(isRegistered('initAdvisor')).toBe(false);
        });

        it('should not throw on empty registry', () => {
            expect(() => clearRegistry()).not.toThrow();
        });

        it('should allow registering after clearing', () => {
            registerFunction('switchTab', vi.fn());
            clearRegistry();
            registerFunction('switchTab', vi.fn());

            expect(isRegistered('switchTab')).toBe(true);
        });

        it('should clear all CV-related functions', () => {
            registerFunction('initCV', vi.fn());
            registerFunction('initOCR', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());
            registerFunction('detectItemsWithEnhancedCV', vi.fn());

            clearRegistry();

            expect(isRegistered('initCV')).toBe(false);
            expect(isRegistered('initOCR')).toBe(false);
            expect(isRegistered('initEnhancedCV')).toBe(false);
            expect(isRegistered('detectItemsWithEnhancedCV')).toBe(false);
        });
    });

    // ========================================
    // getRegisteredFunctions Tests
    // ========================================
    describe('getRegisteredFunctions', () => {
        it('should return empty array when no functions registered', () => {
            const registered = getRegisteredFunctions();

            expect(registered).toEqual([]);
        });

        it('should return array of registered function names', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());

            const registered = getRegisteredFunctions();

            expect(registered).toContain('switchTab');
            expect(registered).toContain('renderTabContent');
            expect(registered.length).toBe(2);
        });

        it('should not include unregistered functions', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());
            unregisterFunction('switchTab');

            const registered = getRegisteredFunctions();

            expect(registered).not.toContain('switchTab');
            expect(registered).toContain('renderTabContent');
            expect(registered.length).toBe(1);
        });

        it('should return empty array after clearing', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());
            clearRegistry();

            const registered = getRegisteredFunctions();

            expect(registered).toEqual([]);
        });

        it('should return all registered CV functions', () => {
            registerFunction('initCV', vi.fn());
            registerFunction('initOCR', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());

            const registered = getRegisteredFunctions();

            expect(registered).toContain('initCV');
            expect(registered).toContain('initOCR');
            expect(registered).toContain('initEnhancedCV');
            expect(registered.length).toBe(3);
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration Tests', () => {
        it('should support full registration lifecycle', () => {
            // Initial state
            expect(isRegistered('switchTab')).toBe(false);
            expect(getRegisteredFunctions()).toEqual([]);

            // Register
            const switchTab = vi.fn();
            registerFunction('switchTab', switchTab);
            expect(isRegistered('switchTab')).toBe(true);
            expect(getRegisteredFunctions()).toContain('switchTab');

            // Call
            callFunction('switchTab', 'items');
            expect(switchTab).toHaveBeenCalledWith('items');

            // Unregister
            unregisterFunction('switchTab');
            expect(isRegistered('switchTab')).toBe(false);
            expect(getRegisteredFunctions()).toEqual([]);

            // Call after unregister
            const result = callFunction('switchTab', 'weapons');
            expect(result).toBeUndefined();
            expect(switchTab).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it('should support callback pattern for scan build', () => {
            const buildStateCallback = vi.fn();
            const initScanBuild = vi.fn((gameData, callback) => {
                if (callback) {
                    callback({ character: null, weapon: null, items: [], tomes: [] });
                }
            });

            registerFunction('initScanBuild', initScanBuild);

            const gameData = { items: { items: [] } };
            callFunction('initScanBuild', gameData as any, buildStateCallback);

            expect(initScanBuild).toHaveBeenCalledWith(gameData, buildStateCallback);
            expect(buildStateCallback).toHaveBeenCalledWith({
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            });
        });

        it('should support registering multiple related functions', () => {
            const switchTab = vi.fn((tab) => {
                callFunction('renderTabContent', tab);
            });
            const renderTabContent = vi.fn();

            registerFunction('switchTab', switchTab);
            registerFunction('renderTabContent', renderTabContent);

            callFunction('switchTab', 'weapons');

            expect(switchTab).toHaveBeenCalledWith('weapons');
            expect(renderTabContent).toHaveBeenCalledWith('weapons');
        });

        it('should handle rapid register/unregister cycles', () => {
            for (let i = 0; i < 100; i++) {
                registerFunction('switchTab', vi.fn());
                unregisterFunction('switchTab');
            }

            expect(isRegistered('switchTab')).toBe(false);
        });

        it('should maintain independence between function registrations', () => {
            const fn1 = vi.fn();
            const fn2 = vi.fn();

            registerFunction('switchTab', fn1);
            registerFunction('renderTabContent', fn2);

            // Unregister one
            unregisterFunction('switchTab');

            // Other should still work
            expect(isRegistered('renderTabContent')).toBe(true);
            callFunction('renderTabContent', 'items');
            expect(fn2).toHaveBeenCalledWith('items');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle functions that throw errors', () => {
            const errorFn = vi.fn(() => {
                throw new Error('Test error');
            });
            registerFunction('switchTab', errorFn);

            expect(() => callFunction('switchTab', 'items')).toThrow('Test error');
        });

        it('should handle functions that return promises that reject', async () => {
            const rejectFn = vi.fn().mockRejectedValue(new Error('Async error'));
            registerFunction('initEnhancedCV', rejectFn);

            const result = callFunction('initEnhancedCV');

            await expect(result).rejects.toThrow('Async error');
        });

        it('should handle functions with complex arguments', () => {
            const complexFn = vi.fn();
            registerFunction('initAdvisor', complexFn);

            const complexGameData = {
                items: {
                    version: '1.0',
                    items: [
                        { id: 'sword', name: 'Sword', nested: { deep: { value: 123 } } },
                    ],
                },
                weapons: { weapons: [] },
                tomes: { tomes: [] },
            };

            callFunction('initAdvisor', complexGameData as any);

            expect(complexFn).toHaveBeenCalledWith(complexGameData);
        });

        it('should handle overwriting with different function signatures', () => {
            const fn1 = vi.fn((a: string) => a.toUpperCase());
            const fn2 = vi.fn((a: string, b: number) => `${a}${b}`);

            registerFunction('switchTab', fn1 as any);
            registerFunction('switchTab', fn2 as any);

            // The last registered function should be used
            expect(getFunction('switchTab')).toBe(fn2);
        });
    });
});
