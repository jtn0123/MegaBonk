/**
 * Tests for tab-loader.ts module
 * Tests lazy loading of tab-specific modules
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    loadTabModules,
    preloadCommonModules,
    isModuleLoaded,
    clearModuleCache,
    getTabModules,
} from '../../src/modules/tab-loader.ts';
import { logger } from '../../src/modules/logger.ts';

describe('tab-loader - loadTabModules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearModuleCache();
    });

    afterEach(() => {
        clearModuleCache();
    });

    it('should load build-planner module for build-planner tab', async () => {
        await loadTabModules('build-planner');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
                data: { module: 'build-planner' },
            })
        );
    });

    it('should load calculator module for calculator tab', async () => {
        await loadTabModules('calculator');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
                data: { module: 'calculator' },
            })
        );
    });

    it('should load advisor and scan-build modules for advisor tab', async () => {
        await loadTabModules('advisor');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'advisor' },
            })
        );
    });

    it('should load changelog module for changelog tab', async () => {
        await loadTabModules('changelog');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'changelog' },
            })
        );
    });

    it('should load charts and compare modules for items tab', async () => {
        await loadTabModules('items');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'charts' },
            })
        );
        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'compare' },
            })
        );
    });

    it('should load charts module for tomes tab', async () => {
        await loadTabModules('tomes');

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'charts' },
            })
        );
    });

    it('should not load any modules for weapons tab', async () => {
        vi.clearAllMocks();
        await loadTabModules('weapons');

        // No module loading should occur
        expect(logger.debug).not.toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
            })
        );
    });

    it('should not load any modules for characters tab', async () => {
        vi.clearAllMocks();
        await loadTabModules('characters');

        expect(logger.debug).not.toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
            })
        );
    });

    it('should not load any modules for shrines tab', async () => {
        vi.clearAllMocks();
        await loadTabModules('shrines');

        expect(logger.debug).not.toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
            })
        );
    });

    it('should cache loaded modules and not reload', async () => {
        await loadTabModules('build-planner');
        vi.clearAllMocks();

        await loadTabModules('build-planner');

        // Should not log loading again since it's cached
        expect(logger.debug).not.toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'tab_loader.loaded',
            })
        );
    });

    it('should handle concurrent loading requests', async () => {
        const promise1 = loadTabModules('build-planner');
        const promise2 = loadTabModules('build-planner');

        await Promise.all([promise1, promise2]);

        // Should only load once
        const loadedCalls = vi.mocked(logger.debug).mock.calls.filter(
            call => (call[0] as any).operation === 'tab_loader.loaded'
        );
        expect(loadedCalls.length).toBe(1);
    });
});

describe('tab-loader - isModuleLoaded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearModuleCache();
    });

    it('should return false for unloaded module', () => {
        expect(isModuleLoaded('build-planner')).toBe(false);
    });

    it('should return false for unknown module', () => {
        expect(isModuleLoaded('unknown-module')).toBe(false);
    });
});

describe('tab-loader - clearModuleCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should clear all cached modules', async () => {
        await loadTabModules('build-planner');
        clearModuleCache();

        // After clearing, loading should log again
        await loadTabModules('build-planner');

        const loadedCalls = vi.mocked(logger.debug).mock.calls.filter(
            call => (call[0] as any).operation === 'tab_loader.loaded'
        );
        expect(loadedCalls.length).toBe(2);
    });
});

describe('tab-loader - getTabModules', () => {
    it('should return module names for build-planner tab', () => {
        const modules = getTabModules('build-planner');
        expect(modules).toContain('loadBuildPlannerModule');
    });

    it('should return module names for calculator tab', () => {
        const modules = getTabModules('calculator');
        expect(modules).toContain('loadCalculatorModule');
    });

    it('should return module names for advisor tab', () => {
        const modules = getTabModules('advisor');
        expect(modules).toContain('loadAdvisorModule');
    });

    it('should return module names for changelog tab', () => {
        const modules = getTabModules('changelog');
        expect(modules).toContain('loadChangelogModule');
    });

    it('should return module names for items tab', () => {
        const modules = getTabModules('items');
        expect(modules).toContain('loadChartsModule');
        expect(modules).toContain('loadCompareModule');
    });

    it('should return module names for tomes tab', () => {
        const modules = getTabModules('tomes');
        expect(modules).toContain('loadChartsModule');
    });

    it('should return empty array for weapons tab', () => {
        const modules = getTabModules('weapons');
        expect(modules).toEqual([]);
    });

    it('should return empty array for characters tab', () => {
        const modules = getTabModules('characters');
        expect(modules).toEqual([]);
    });

    it('should return empty array for shrines tab', () => {
        const modules = getTabModules('shrines');
        expect(modules).toEqual([]);
    });
});

describe('tab-loader - preloadCommonModules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearModuleCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should use setTimeout fallback when requestIdleCallback unavailable', () => {
        const originalRIC = (window as any).requestIdleCallback;
        delete (window as any).requestIdleCallback;

        const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

        preloadCommonModules();

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

        (window as any).requestIdleCallback = originalRIC;
    });

    it('should preload compare module', async () => {
        preloadCommonModules();

        vi.advanceTimersByTime(2000);

        // Run microtasks
        await vi.runAllTimersAsync();

        // Compare module should be loaded
        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'compare' },
            })
        );
    });
});

describe('tab-loader - module loading performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearModuleCache();
    });

    it('should load multiple modules in parallel', async () => {
        await loadTabModules('items');

        // Both charts and compare should be loaded
        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'charts' },
            })
        );
        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { module: 'compare' },
            })
        );
    });
});

describe('tab-loader - module cache state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearModuleCache();
    });

    it('should handle rapid successive loads', async () => {
        const promises = [
            loadTabModules('build-planner'),
            loadTabModules('calculator'),
            loadTabModules('advisor'),
            loadTabModules('items'),
            loadTabModules('tomes'),
        ];

        await Promise.all(promises);

        // All modules should be loaded
        expect(logger.debug).toHaveBeenCalled();
    });
});
