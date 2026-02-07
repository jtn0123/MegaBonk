/**
 * @vitest-environment jsdom
 * Registry Module - Comprehensive Coverage Tests
 * Target: >60% coverage for registry.ts
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
    type TabName,
} from '../../src/modules/registry.ts';

describe('Registry Module - Comprehensive Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRegistry();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearRegistry();
    });

    // ========================================
    // All Registry Keys Tests
    // ========================================
    describe('All Registry Function Keys', () => {
        it('should register and retrieve switchTab', () => {
            const fn = vi.fn();
            registerFunction('switchTab', fn);
            expect(getFunction('switchTab')).toBe(fn);
        });

        it('should register and retrieve renderTabContent', () => {
            const fn = vi.fn();
            registerFunction('renderTabContent', fn);
            expect(getFunction('renderTabContent')).toBe(fn);
        });

        it('should register and retrieve initAdvisor', () => {
            const fn = vi.fn();
            registerFunction('initAdvisor', fn);
            expect(getFunction('initAdvisor')).toBe(fn);
        });

        it('should register and retrieve applyScannedBuild', () => {
            const fn = vi.fn();
            registerFunction('applyScannedBuild', fn);
            expect(getFunction('applyScannedBuild')).toBe(fn);
        });

        it('should register and retrieve initScanBuild', () => {
            const fn = vi.fn();
            registerFunction('initScanBuild', fn);
            expect(getFunction('initScanBuild')).toBe(fn);
        });

        it('should register and retrieve initCV', () => {
            const fn = vi.fn();
            registerFunction('initCV', fn);
            expect(getFunction('initCV')).toBe(fn);
        });

        it('should register and retrieve initOCR', () => {
            const fn = vi.fn();
            registerFunction('initOCR', fn);
            expect(getFunction('initOCR')).toBe(fn);
        });

        it('should register and retrieve initEnhancedCV', () => {
            const fn = vi.fn().mockResolvedValue(undefined);
            registerFunction('initEnhancedCV', fn);
            expect(getFunction('initEnhancedCV')).toBe(fn);
        });

        it('should register and retrieve detectItemsWithEnhancedCV', () => {
            const fn = vi.fn().mockResolvedValue([]);
            registerFunction('detectItemsWithEnhancedCV', fn);
            expect(getFunction('detectItemsWithEnhancedCV')).toBe(fn);
        });

        it('should register and retrieve initEnhancedScanBuild', () => {
            const fn = vi.fn();
            registerFunction('initEnhancedScanBuild', fn);
            expect(getFunction('initEnhancedScanBuild')).toBe(fn);
        });

        it('should register and retrieve handleEnhancedHybridDetect', () => {
            const fn = vi.fn().mockResolvedValue(undefined);
            registerFunction('handleEnhancedHybridDetect', fn);
            expect(getFunction('handleEnhancedHybridDetect')).toBe(fn);
        });

        it('should register and retrieve compareStrategiesOnImage', () => {
            const fn = vi.fn().mockResolvedValue({});
            registerFunction('compareStrategiesOnImage', fn);
            expect(getFunction('compareStrategiesOnImage')).toBe(fn);
        });
    });

    // ========================================
    // callFunction with all keys
    // ========================================
    describe('callFunction with various keys', () => {
        it('should call switchTab with TabName argument', () => {
            const fn = vi.fn();
            registerFunction('switchTab', fn);
            callFunction('switchTab', 'items' as TabName);
            expect(fn).toHaveBeenCalledWith('items');
        });

        it('should call renderTabContent with string argument', () => {
            const fn = vi.fn();
            registerFunction('renderTabContent', fn);
            callFunction('renderTabContent', 'weapons');
            expect(fn).toHaveBeenCalledWith('weapons');
        });

        it('should call initScanBuild with gameData and optional callback', () => {
            const callback = vi.fn();
            const initFn = vi.fn((data, cb) => {
                if (cb) cb({ character: null, weapon: null, items: [], tomes: [] });
            });
            registerFunction('initScanBuild', initFn);
            
            const gameData = { items: { items: [] }, weapons: { weapons: [] } } as any;
            callFunction('initScanBuild', gameData, callback);
            
            expect(initFn).toHaveBeenCalledWith(gameData, callback);
            expect(callback).toHaveBeenCalledWith({
                character: null,
                weapon: null,
                items: [],
                tomes: [],
            });
        });

        it('should call applyScannedBuild with BuildState', () => {
            const fn = vi.fn();
            registerFunction('applyScannedBuild', fn);
            
            const buildState: BuildState = {
                character: { id: 'char1', name: 'Hero' } as any,
                weapon: { id: 'wpn1', name: 'Sword' } as any,
                items: [],
                tomes: [],
            };
            callFunction('applyScannedBuild', buildState);
            
            expect(fn).toHaveBeenCalledWith(buildState);
        });

        it('should return undefined when calling unregistered function', () => {
            const result = callFunction('switchTab', 'items' as TabName);
            expect(result).toBeUndefined();
        });

        it('should handle async functions with detectItemsWithEnhancedCV', async () => {
            const mockResult = [{ id: 'item1', confidence: 0.95 }];
            const fn = vi.fn().mockResolvedValue(mockResult);
            registerFunction('detectItemsWithEnhancedCV', fn);
            
            const imageData = { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;
            const result = callFunction('detectItemsWithEnhancedCV', imageData);
            
            expect(fn).toHaveBeenCalledWith(imageData);
            await expect(result).resolves.toEqual(mockResult);
        });

        it('should handle compareStrategiesOnImage async function', async () => {
            const mockResult = { strategy1: 0.9, strategy2: 0.85 };
            const fn = vi.fn().mockResolvedValue(mockResult);
            registerFunction('compareStrategiesOnImage', fn);
            
            const imageData = { width: 50, height: 50, data: new Uint8ClampedArray(10000) } as ImageData;
            const result = callFunction('compareStrategiesOnImage', imageData);
            
            await expect(result).resolves.toEqual(mockResult);
        });
    });

    // ========================================
    // isRegistered comprehensive tests
    // ========================================
    describe('isRegistered for all keys', () => {
        it('should return false for all keys initially', () => {
            expect(isRegistered('switchTab')).toBe(false);
            expect(isRegistered('renderTabContent')).toBe(false);
            expect(isRegistered('initAdvisor')).toBe(false);
            expect(isRegistered('applyScannedBuild')).toBe(false);
            expect(isRegistered('initScanBuild')).toBe(false);
            expect(isRegistered('initCV')).toBe(false);
            expect(isRegistered('initOCR')).toBe(false);
            expect(isRegistered('initEnhancedCV')).toBe(false);
            expect(isRegistered('detectItemsWithEnhancedCV')).toBe(false);
            expect(isRegistered('initEnhancedScanBuild')).toBe(false);
            expect(isRegistered('handleEnhancedHybridDetect')).toBe(false);
            expect(isRegistered('compareStrategiesOnImage')).toBe(false);
        });

        it('should return true after registration', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('initCV', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());
            
            expect(isRegistered('switchTab')).toBe(true);
            expect(isRegistered('initCV')).toBe(true);
            expect(isRegistered('initEnhancedCV')).toBe(true);
            // Others should still be false
            expect(isRegistered('initOCR')).toBe(false);
        });
    });

    // ========================================
    // unregisterFunction comprehensive tests
    // ========================================
    describe('unregisterFunction for all keys', () => {
        it('should unregister switchTab', () => {
            registerFunction('switchTab', vi.fn());
            unregisterFunction('switchTab');
            expect(isRegistered('switchTab')).toBe(false);
        });

        it('should unregister CV-related functions', () => {
            registerFunction('initCV', vi.fn());
            registerFunction('initOCR', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());
            
            unregisterFunction('initCV');
            expect(isRegistered('initCV')).toBe(false);
            expect(isRegistered('initOCR')).toBe(true);
            expect(isRegistered('initEnhancedCV')).toBe(true);
        });

        it('should be safe to unregister already unregistered function', () => {
            unregisterFunction('initCV');
            expect(() => unregisterFunction('initCV')).not.toThrow();
        });
    });

    // ========================================
    // clearRegistry comprehensive tests
    // ========================================
    describe('clearRegistry clears all keys', () => {
        it('should clear all registered functions', () => {
            // Register all function types
            registerFunction('switchTab', vi.fn());
            registerFunction('renderTabContent', vi.fn());
            registerFunction('initAdvisor', vi.fn());
            registerFunction('applyScannedBuild', vi.fn());
            registerFunction('initScanBuild', vi.fn());
            registerFunction('initCV', vi.fn());
            registerFunction('initOCR', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());
            registerFunction('detectItemsWithEnhancedCV', vi.fn());
            registerFunction('initEnhancedScanBuild', vi.fn());
            registerFunction('handleEnhancedHybridDetect', vi.fn());
            registerFunction('compareStrategiesOnImage', vi.fn());
            
            expect(getRegisteredFunctions().length).toBe(12);
            
            clearRegistry();
            
            expect(getRegisteredFunctions().length).toBe(0);
            expect(isRegistered('switchTab')).toBe(false);
            expect(isRegistered('initEnhancedCV')).toBe(false);
        });
    });

    // ========================================
    // getRegisteredFunctions comprehensive tests
    // ========================================
    describe('getRegisteredFunctions returns correct list', () => {
        it('should return all registered function names', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('initCV', vi.fn());
            registerFunction('initEnhancedCV', vi.fn());
            
            const registered = getRegisteredFunctions();
            
            expect(registered).toContain('switchTab');
            expect(registered).toContain('initCV');
            expect(registered).toContain('initEnhancedCV');
            expect(registered.length).toBe(3);
        });

        it('should not include null entries', () => {
            registerFunction('switchTab', vi.fn());
            registerFunction('initCV', null);
            
            const registered = getRegisteredFunctions();
            
            expect(registered).toContain('switchTab');
            expect(registered).not.toContain('initCV');
        });
    });

    // ========================================
    // Edge cases and error handling
    // ========================================
    describe('Edge cases', () => {
        it('should handle function that throws synchronously', () => {
            const errorFn = vi.fn(() => {
                throw new Error('Sync error');
            });
            registerFunction('switchTab', errorFn);
            
            expect(() => callFunction('switchTab', 'items' as TabName)).toThrow('Sync error');
        });

        it('should handle function that rejects', async () => {
            const rejectFn = vi.fn().mockRejectedValue(new Error('Async error'));
            registerFunction('initEnhancedCV', rejectFn);
            
            const result = callFunction('initEnhancedCV');
            await expect(result).rejects.toThrow('Async error');
        });

        it('should handle function returning undefined', () => {
            const undefinedFn = vi.fn(() => undefined);
            registerFunction('switchTab', undefinedFn);
            
            const result = callFunction('switchTab', 'items' as TabName);
            expect(result).toBeUndefined();
        });

        it('should handle function returning null', () => {
            const nullFn = vi.fn(() => null);
            registerFunction('initAdvisor', nullFn as any);
            
            const result = callFunction('initAdvisor', {} as any);
            expect(result).toBeNull();
        });

        it('should handle multiple rapid registrations', () => {
            for (let i = 0; i < 100; i++) {
                registerFunction('switchTab', vi.fn());
            }
            expect(isRegistered('switchTab')).toBe(true);
        });

        it('should handle function with no arguments', () => {
            const noArgFn = vi.fn(() => 'result');
            registerFunction('initEnhancedCV', noArgFn as any);
            
            callFunction('initEnhancedCV');
            expect(noArgFn).toHaveBeenCalledTimes(1);
        });
    });
});
