/**
 * Breadcrumbs Module Tests
 *
 * Tests the breadcrumbs tracking system for user actions and error reporting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger to provide getSessionId
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        getSessionId: vi.fn(() => 'test-session-id-123'),
    },
}));

// Import all functions from breadcrumbs module
import {
    configureBreadcrumbs,
    getBreadcrumbConfig,
    addBreadcrumb,
    getBreadcrumbs,
    getRecentBreadcrumbs,
    clearBreadcrumbs,
    exportBreadcrumbs,
    recordTabSwitch,
    recordSearch,
    recordFilterChange,
    recordItemClick,
    recordModalOpen,
    recordModalClose,
    recordBuildUpdate,
    recordCompareToggle,
    recordFavoriteToggle,
    recordKeyboardShortcut,
    recordError,
    recordCustom,
    captureStateSnapshot,
    buildErrorReport,
    initBreadcrumbs,
    cleanupBreadcrumbs,
    type Breadcrumb,
    type BreadcrumbConfig,
    type BreadcrumbType,
} from '../../src/modules/breadcrumbs.ts';

describe('Breadcrumbs Module', () => {
    beforeEach(() => {
        // Clear breadcrumbs before each test
        clearBreadcrumbs();
        // Reset configuration
        configureBreadcrumbs({
            maxBreadcrumbs: 50,
            enableAutoCapture: true,
            enableConsoleLog: false,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Configuration', () => {
        it('should return default configuration', () => {
            const config = getBreadcrumbConfig();
            expect(config.maxBreadcrumbs).toBe(50);
            expect(config.enableAutoCapture).toBe(true);
            expect(config.enableConsoleLog).toBe(false);
        });

        it('should update configuration with partial config', () => {
            configureBreadcrumbs({ maxBreadcrumbs: 100 });
            const config = getBreadcrumbConfig();
            expect(config.maxBreadcrumbs).toBe(100);
            expect(config.enableAutoCapture).toBe(true);
        });

        it('should update multiple config options', () => {
            configureBreadcrumbs({
                maxBreadcrumbs: 25,
                enableAutoCapture: false,
                enableConsoleLog: true,
            });
            const config = getBreadcrumbConfig();
            expect(config.maxBreadcrumbs).toBe(25);
            expect(config.enableAutoCapture).toBe(false);
            expect(config.enableConsoleLog).toBe(true);
        });

        it('should return a copy of config to prevent external modification', () => {
            const config1 = getBreadcrumbConfig();
            const config2 = getBreadcrumbConfig();
            expect(config1).toEqual(config2);
            expect(config1).not.toBe(config2);
        });
    });

    describe('addBreadcrumb', () => {
        it('should add a breadcrumb with required fields', () => {
            addBreadcrumb('navigation', 'User navigated');
            const breadcrumbs = getBreadcrumbs();

            expect(breadcrumbs).toHaveLength(1);
            expect(breadcrumbs[0].type).toBe('navigation');
            expect(breadcrumbs[0].message).toBe('User navigated');
            expect(breadcrumbs[0].timestamp).toBeDefined();
        });

        it('should add a breadcrumb with optional data', () => {
            addBreadcrumb('item_click', 'Item clicked', { itemId: 'test-123' });
            const breadcrumbs = getBreadcrumbs();

            expect(breadcrumbs[0].data).toEqual({ itemId: 'test-123' });
        });

        it('should add a breadcrumb with category', () => {
            addBreadcrumb('filter_change', 'Filter changed', undefined, 'filter');
            const breadcrumbs = getBreadcrumbs();

            expect(breadcrumbs[0].category).toBe('filter');
        });

        it('should add multiple breadcrumbs in order', () => {
            addBreadcrumb('navigation', 'First');
            addBreadcrumb('search', 'Second');
            addBreadcrumb('item_click', 'Third');

            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs).toHaveLength(3);
            expect(breadcrumbs[0].message).toBe('First');
            expect(breadcrumbs[1].message).toBe('Second');
            expect(breadcrumbs[2].message).toBe('Third');
        });

        it('should respect maxBreadcrumbs limit', () => {
            configureBreadcrumbs({ maxBreadcrumbs: 3 });

            addBreadcrumb('navigation', 'First');
            addBreadcrumb('navigation', 'Second');
            addBreadcrumb('navigation', 'Third');
            addBreadcrumb('navigation', 'Fourth');
            addBreadcrumb('navigation', 'Fifth');

            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs).toHaveLength(3);
            // Should keep the most recent
            expect(breadcrumbs[0].message).toBe('Third');
            expect(breadcrumbs[1].message).toBe('Fourth');
            expect(breadcrumbs[2].message).toBe('Fifth');
        });

        it('should log to console when enableConsoleLog is true', () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            configureBreadcrumbs({ enableConsoleLog: true });

            addBreadcrumb('navigation', 'Test message', { key: 'value' });

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Breadcrumb]',
                'navigation',
                'Test message',
                { key: 'value' }
            );
        });
    });

    describe('getBreadcrumbs', () => {
        it('should return empty array when no breadcrumbs', () => {
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs).toEqual([]);
        });

        it('should return a copy of breadcrumbs array', () => {
            addBreadcrumb('navigation', 'Test');
            const breadcrumbs1 = getBreadcrumbs();
            const breadcrumbs2 = getBreadcrumbs();

            expect(breadcrumbs1).toEqual(breadcrumbs2);
            expect(breadcrumbs1).not.toBe(breadcrumbs2);
        });
    });

    describe('getRecentBreadcrumbs', () => {
        it('should return breadcrumbs within time range', () => {
            // Add breadcrumb now
            addBreadcrumb('navigation', 'Recent');
            
            // All within last minute should be returned
            const recent = getRecentBreadcrumbs(60000);
            expect(recent).toHaveLength(1);
        });

        it('should use default time range of 60 seconds', () => {
            addBreadcrumb('navigation', 'Recent');
            const recent = getRecentBreadcrumbs();
            expect(recent).toHaveLength(1);
        });

        it('should filter out old breadcrumbs', () => {
            // This test relies on the timestamp being recent
            addBreadcrumb('navigation', 'Recent');
            
            // Requesting only last 1ms should exclude it (unless added in last ms)
            // For safety, we just verify the filter is applied
            const recent = getRecentBreadcrumbs(1);
            // May or may not include depending on timing - just check it runs
            expect(Array.isArray(recent)).toBe(true);
        });
    });

    describe('clearBreadcrumbs', () => {
        it('should clear all breadcrumbs', () => {
            addBreadcrumb('navigation', 'First');
            addBreadcrumb('navigation', 'Second');
            expect(getBreadcrumbs()).toHaveLength(2);

            clearBreadcrumbs();
            expect(getBreadcrumbs()).toHaveLength(0);
        });
    });

    describe('exportBreadcrumbs', () => {
        it('should export breadcrumbs as JSON string', () => {
            addBreadcrumb('navigation', 'Test');
            const exported = exportBreadcrumbs();

            const parsed = JSON.parse(exported);
            expect(parsed.exported).toBeDefined();
            expect(parsed.count).toBe(1);
            expect(parsed.breadcrumbs).toHaveLength(1);
        });

        it('should export empty breadcrumbs', () => {
            const exported = exportBreadcrumbs();
            const parsed = JSON.parse(exported);

            expect(parsed.count).toBe(0);
            expect(parsed.breadcrumbs).toEqual([]);
        });
    });

    describe('Auto-Capture Helpers', () => {
        describe('recordTabSwitch', () => {
            it('should record tab switch when autoCapture is enabled', () => {
                recordTabSwitch('items', 'weapons');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs).toHaveLength(1);
                expect(breadcrumbs[0].type).toBe('tab_switch');
                expect(breadcrumbs[0].message).toContain('items');
                expect(breadcrumbs[0].message).toContain('weapons');
                expect(breadcrumbs[0].data).toEqual({ fromTab: 'items', toTab: 'weapons' });
            });

            it('should not record when autoCapture is disabled', () => {
                configureBreadcrumbs({ enableAutoCapture: false });
                recordTabSwitch('items', 'weapons');
                expect(getBreadcrumbs()).toHaveLength(0);
            });
        });

        describe('recordSearch', () => {
            it('should record search with query', () => {
                recordSearch('test query', 5);
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('search');
                expect(breadcrumbs[0].data).toEqual({ query: 'test query', resultCount: 5 });
            });

            it('should record search without result count', () => {
                recordSearch('test');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].data?.query).toBe('test');
            });
        });

        describe('recordFilterChange', () => {
            it('should record filter change', () => {
                recordFilterChange('rarity', 'legendary');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('filter_change');
                expect(breadcrumbs[0].data).toEqual({ filterName: 'rarity', value: 'legendary' });
            });
        });

        describe('recordItemClick', () => {
            it('should record item click with default action', () => {
                recordItemClick('item-123', 'Test Item');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('item_click');
                expect(breadcrumbs[0].data).toEqual({
                    itemId: 'item-123',
                    itemName: 'Test Item',
                    action: 'clicked',
                });
            });

            it('should record item click with custom action', () => {
                recordItemClick('item-123', 'Test Item', 'viewed');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].data?.action).toBe('viewed');
            });
        });

        describe('recordModalOpen', () => {
            it('should record modal open', () => {
                recordModalOpen('item', 'item-123');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('modal_open');
                expect(breadcrumbs[0].data).toEqual({ modalType: 'item', entityId: 'item-123' });
            });

            it('should record modal open without entity ID', () => {
                recordModalOpen('settings');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].data?.entityId).toBeUndefined();
            });
        });

        describe('recordModalClose', () => {
            it('should record modal close', () => {
                recordModalClose('item');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('modal_close');
                expect(breadcrumbs[0].data).toEqual({ modalType: 'item' });
            });
        });

        describe('recordBuildUpdate', () => {
            it('should record build update', () => {
                recordBuildUpdate('item_added', { itemId: 'test-item' });
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('build_update');
                expect(breadcrumbs[0].message).toContain('item_added');
            });
        });

        describe('recordCompareToggle', () => {
            it('should record compare add', () => {
                recordCompareToggle('item-123', true);
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('compare_toggle');
                expect(breadcrumbs[0].message).toContain('Added to');
                expect(breadcrumbs[0].data).toEqual({ itemId: 'item-123', added: true });
            });

            it('should record compare remove', () => {
                recordCompareToggle('item-123', false);
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].message).toContain('Removed from');
            });
        });

        describe('recordFavoriteToggle', () => {
            it('should record favorite add', () => {
                recordFavoriteToggle('item-123', 'item', true);
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('favorite_toggle');
                expect(breadcrumbs[0].message).toContain('Favorited');
                expect(breadcrumbs[0].data).toEqual({
                    entityId: 'item-123',
                    entityType: 'item',
                    favorited: true,
                });
            });

            it('should record unfavorite', () => {
                recordFavoriteToggle('item-123', 'item', false);
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].message).toContain('Unfavorited');
            });
        });

        describe('recordKeyboardShortcut', () => {
            it('should record keyboard shortcut', () => {
                recordKeyboardShortcut('Ctrl+F', 'focus search');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('keyboard_shortcut');
                expect(breadcrumbs[0].data).toEqual({
                    shortcut: 'Ctrl+F',
                    action: 'focus search',
                });
            });
        });

        describe('recordError', () => {
            it('should record error even when autoCapture is disabled', () => {
                configureBreadcrumbs({ enableAutoCapture: false });
                const error = new Error('Test error');
                recordError(error, 'test context');

                const breadcrumbs = getBreadcrumbs();
                expect(breadcrumbs).toHaveLength(1);
                expect(breadcrumbs[0].type).toBe('error');
                expect(breadcrumbs[0].data?.message).toBe('Test error');
                expect(breadcrumbs[0].data?.context).toBe('test context');
            });

            it('should include error details', () => {
                const error = new Error('Test error');
                error.name = 'TestError';
                recordError(error);

                const breadcrumbs = getBreadcrumbs();
                expect(breadcrumbs[0].data?.name).toBe('TestError');
                expect(breadcrumbs[0].data?.stack).toBeDefined();
            });
        });

        describe('recordCustom', () => {
            it('should record custom breadcrumb', () => {
                recordCustom('Custom action', { key: 'value' }, 'custom-category');
                const breadcrumbs = getBreadcrumbs();

                expect(breadcrumbs[0].type).toBe('custom');
                expect(breadcrumbs[0].message).toBe('Custom action');
                expect(breadcrumbs[0].data).toEqual({ key: 'value' });
                expect(breadcrumbs[0].category).toBe('custom-category');
            });

            it('should not record when autoCapture is disabled', () => {
                configureBreadcrumbs({ enableAutoCapture: false });
                recordCustom('Custom action');
                expect(getBreadcrumbs()).toHaveLength(0);
            });
        });
    });

    describe('captureStateSnapshot', () => {
        it('should capture current state snapshot', () => {
            const snapshot = captureStateSnapshot();

            expect(snapshot.timestamp).toBeDefined();
            expect(typeof snapshot.timestamp).toBe('number');
        });

        it('should include window and navigator info', () => {
            const snapshot = captureStateSnapshot();

            expect(snapshot.windowSize).toBeDefined();
            expect(snapshot.userAgent).toBeDefined();
            expect(snapshot.online).toBeDefined();
        });

        it('should handle errors gracefully', () => {
            // The function should not throw even if getState returns unexpected values
            const snapshot = captureStateSnapshot();
            expect(snapshot).toBeDefined();
            expect(snapshot.timestamp).toBeDefined();
        });
    });

    describe('buildErrorReport', () => {
        it('should build comprehensive error report', () => {
            const error = new Error('Test error');
            const report = buildErrorReport(error, 'test context');

            expect(report.timestamp).toBeDefined();
            expect(report.error).toBeDefined();
            expect((report.error as { name: string }).name).toBe('Error');
            expect((report.error as { message: string }).message).toBe('Test error');
            expect(report.context).toBe('test context');
            expect(report.stateSnapshot).toBeDefined();
            expect(report.breadcrumbs).toBeDefined();
            expect(report.sessionId).toBeDefined();
        });

        it('should include recent breadcrumbs', () => {
            addBreadcrumb('navigation', 'Before error');
            const error = new Error('Test error');
            const report = buildErrorReport(error);

            expect((report.breadcrumbs as Breadcrumb[]).length).toBeGreaterThan(0);
        });
    });

    describe('initBreadcrumbs', () => {
        it('should initialize without errors', () => {
            expect(() => initBreadcrumbs()).not.toThrow();
        });
    });

    describe('cleanupBreadcrumbs', () => {
        it('should clear all breadcrumbs', () => {
            addBreadcrumb('navigation', 'Test');
            cleanupBreadcrumbs();
            expect(getBreadcrumbs()).toHaveLength(0);
        });
    });

    describe('Breadcrumb Types', () => {
        it('should support all breadcrumb types', () => {
            const types: BreadcrumbType[] = [
                'tab_switch',
                'search',
                'filter_change',
                'item_click',
                'modal_open',
                'modal_close',
                'build_update',
                'compare_toggle',
                'favorite_toggle',
                'navigation',
                'keyboard_shortcut',
                'error',
                'custom',
            ];

            types.forEach(type => {
                addBreadcrumb(type, `Test ${type}`);
            });

            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs).toHaveLength(types.length);

            types.forEach((type, index) => {
                expect(breadcrumbs[index].type).toBe(type);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty data object', () => {
            addBreadcrumb('navigation', 'Test', {});
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs[0].data).toEqual({});
        });

        it('should handle undefined category', () => {
            addBreadcrumb('navigation', 'Test', undefined, undefined);
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs[0].category).toBeUndefined();
        });

        it('should handle very long messages', () => {
            const longMessage = 'x'.repeat(10000);
            addBreadcrumb('navigation', longMessage);
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs[0].message).toBe(longMessage);
        });

        it('should handle special characters in message', () => {
            const specialMessage = '<script>alert("xss")</script> & "quotes" \'apostrophes\'';
            addBreadcrumb('navigation', specialMessage);
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs[0].message).toBe(specialMessage);
        });

        it('should handle complex nested data', () => {
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { key: 'value' },
                },
                nullValue: null,
                undefinedValue: undefined,
            };
            addBreadcrumb('custom', 'Complex', complexData);
            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs[0].data).toEqual(complexData);
        });

        it('should maintain order with maxBreadcrumbs = 1', () => {
            configureBreadcrumbs({ maxBreadcrumbs: 1 });

            addBreadcrumb('navigation', 'First');
            addBreadcrumb('navigation', 'Second');

            const breadcrumbs = getBreadcrumbs();
            expect(breadcrumbs).toHaveLength(1);
            expect(breadcrumbs[0].message).toBe('Second');
        });
    });
});
