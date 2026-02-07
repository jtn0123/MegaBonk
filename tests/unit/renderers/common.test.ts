/**
 * @vitest-environment jsdom
 * Unit tests for src/modules/renderers/common.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../../helpers/dom-setup.ts';

// Mock logger
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock data-service
vi.mock('../../../src/modules/data-service.ts', () => ({
    getDataForTab: vi.fn().mockImplementation((tabName: string) => {
        const mockData: Record<string, unknown[]> = {
            items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
            weapons: [{ id: '1' }, { id: '2' }, { id: '3' }],
            tomes: [{ id: '1' }, { id: '2' }],
            characters: [{ id: '1' }],
            shrines: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
        };
        return mockData[tabName] || [];
    }),
}));

// Mock charts module for initChartsAsync tests
vi.mock('../../../src/modules/charts.ts', () => ({
    initializeItemCharts: vi.fn(),
    initializeTomeCharts: vi.fn(),
}));

// Import after mocks
import { updateStats, initChartsAsync } from '../../../src/modules/renderers/common.ts';
import { getDataForTab } from '../../../src/modules/data-service.ts';
import { logger } from '../../../src/modules/logger.ts';

describe('renderers/common.ts', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('updateStats()', () => {
        it('should update item count with correct number', () => {
            const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
            updateStats(items as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('3');
        });

        it('should show plural "items" for multiple items', () => {
            const items = [{ id: '1' }, { id: '2' }];
            updateStats(items as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('items');
        });

        it('should show singular "item" for single item', () => {
            vi.mocked(getDataForTab).mockReturnValueOnce([{ id: '1' }]);
            const items = [{ id: '1' }];
            updateStats(items as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('item');
            expect(itemCount?.textContent).not.toContain('items');
        });

        it('should show filtered count as X/Y when filtered', () => {
            // getDataForTab returns 5 items total
            const filtered = [{ id: '1' }, { id: '2' }];
            updateStats(filtered as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('2/5');
        });

        it('should use correct label for weapons tab', () => {
            const weapons = [{ id: '1' }, { id: '2' }];
            updateStats(weapons as any, 'weapons');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('weapons');
        });

        it('should use correct label for tomes tab', () => {
            const tomes = [{ id: '1' }];
            updateStats(tomes as any, 'tomes');

            const itemCount = document.getElementById('item-count');
            // Singular: "tome" not "tomes"
            expect(itemCount?.textContent).toMatch(/\btome\b/);
        });

        it('should use correct label for characters tab', () => {
            const chars = [{ id: '1' }];
            updateStats(chars as any, 'characters');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toMatch(/\bcharacter\b/);
        });

        it('should use correct label for shrines tab', () => {
            const shrines = [{ id: '1' }, { id: '2' }];
            updateStats(shrines as any, 'shrines');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('shrines');
        });

        it('should default to "items" for empty tabName', () => {
            updateStats([], '');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('items');
        });

        it('should hide badge for calculator tab', () => {
            updateStats([], 'calculator');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.style.display).toBe('none');
        });

        it('should hide badge for advisor tab', () => {
            updateStats([], 'advisor');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.style.display).toBe('none');
        });

        it('should hide badge for about tab', () => {
            updateStats([], 'about');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.style.display).toBe('none');
        });

        it('should hide badge for build-planner tab', () => {
            updateStats([], 'build-planner');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.style.display).toBe('none');
        });

        it('should show badge for data tabs', () => {
            updateStats([{ id: '1' }] as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.style.display).toBe('');
        });

        it('should handle missing item-count element gracefully', () => {
            document.getElementById('item-count')?.remove();
            expect(() => updateStats([], 'items')).not.toThrow();
        });

        it('should show 0 items when empty array', () => {
            vi.mocked(getDataForTab).mockReturnValueOnce([]);
            updateStats([], 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('0');
        });

        it('should not show X/Y format when showing all items', () => {
            // Return exactly the same count from getDataForTab as filtered
            vi.mocked(getDataForTab).mockReturnValueOnce([{ id: '1' }, { id: '2' }]);
            const items = [{ id: '1' }, { id: '2' }];
            updateStats(items as any, 'items');

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toBe('2 items');
            expect(itemCount?.textContent).not.toContain('/');
        });
    });

    describe('initChartsAsync()', () => {
        it('should call initializeItemCharts via requestAnimationFrame', async () => {
            const { initializeItemCharts } = await import('../../../src/modules/charts.ts');
            
            initChartsAsync('initializeItemCharts', 'test_context');

            // Wait for requestAnimationFrame and async import
            await new Promise(resolve => requestAnimationFrame(() => {
                setTimeout(resolve, 50);
            }));

            expect(initializeItemCharts).toHaveBeenCalled();
        });

        it('should call initializeTomeCharts via requestAnimationFrame', async () => {
            const { initializeTomeCharts } = await import('../../../src/modules/charts.ts');
            
            initChartsAsync('initializeTomeCharts', 'test_context');

            // Wait for requestAnimationFrame and async import
            await new Promise(resolve => requestAnimationFrame(() => {
                setTimeout(resolve, 50);
            }));

            expect(initializeTomeCharts).toHaveBeenCalled();
        });

        it('should log warning on chart init failure', async () => {
            // Create a module that throws
            vi.doMock('../../../src/modules/charts.ts', () => ({
                initializeItemCharts: vi.fn().mockImplementation(() => {
                    throw new Error('Chart init failed');
                }),
                initializeTomeCharts: vi.fn(),
            }));

            // Re-import to get new mock
            vi.resetModules();
            const { initChartsAsync: freshInitChartsAsync } = await import('../../../src/modules/renderers/common.ts');
            
            freshInitChartsAsync('initializeItemCharts', 'error_test');

            // Wait for requestAnimationFrame and async import
            await new Promise(resolve => requestAnimationFrame(() => {
                setTimeout(resolve, 100);
            }));

            // Logger should have been called with warning
            expect(logger.warn).toHaveBeenCalled();
        });
    });
});
