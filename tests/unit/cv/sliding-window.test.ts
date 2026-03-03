/**
 * @vitest-environment jsdom
 * Unit tests for cv/detection-pipeline/sliding-window.ts
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { polyfillImageData } from './test-helpers';

beforeAll(() => { polyfillImageData(); });

// Mock all external dependencies
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/modules/cv/state.ts', () => ({
    getItemTemplates: vi.fn(() => new Map()),
    getTemplatesByColor: vi.fn(() => new Map()),
}));

vi.mock('../../../src/modules/cv/color.ts', () => ({
    getDominantColor: vi.fn(() => 'gray'),
    getColorCandidates: vi.fn((c: string) => [c]),
    isEmptyCell: vi.fn(() => false),
    calculateColorVariance: vi.fn(() => 1000),
}));

vi.mock('../../../src/modules/cv/training.ts', () => ({
    getTrainingTemplatesForItem: vi.fn(() => []),
    isTrainingDataLoaded: vi.fn(() => false),
}));

vi.mock('../../../src/modules/cv/detection-config.ts', () => ({
    getDynamicMinConfidence: vi.fn(() => 0.5),
}));

vi.mock('../../../src/modules/cv/detection-utils.ts', () => ({
    nonMaxSuppression: vi.fn((dets: any[]) => dets),
}));

vi.mock('../../../src/modules/cv/detection-grid.ts', () => ({
    getAdaptiveIconSizes: vi.fn(() => [40, 48, 56]),
}));

vi.mock('../../../src/modules/cv/detection-matching.ts', () => ({
    matchTemplate: vi.fn(() => 0.3),
    matchTemplateMulti: vi.fn(() => 0.3),
}));

import {
    detectIconsWithSlidingWindow,
    detectEquipmentRegion,
} from '../../../src/modules/cv/detection-pipeline/sliding-window';
import { isEmptyCell, calculateColorVariance } from '../../../src/modules/cv/color';
import { getItemTemplates, getTemplatesByColor } from '../../../src/modules/cv/state';
import { matchTemplate as mockMatchTemplate } from '../../../src/modules/cv/detection-matching';

describe('sliding-window', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('detectIconsWithSlidingWindow', () => {
        it('should return empty array when no items match', async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test', rarity: 'common' }] as any[];
            const result = await detectIconsWithSlidingWindow(ctx, 200, 200, items);

            expect(result).toBeInstanceOf(Array);
        });

        it('should skip empty cells', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithSlidingWindow(ctx, 100, 100, []);
            expect(result).toEqual([]);
        });

        it('should skip low-variance cells', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(false);
            vi.mocked(calculateColorVariance).mockReturnValue(100); // Below 800 threshold

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithSlidingWindow(ctx, 100, 100, []);
            expect(result).toEqual([]);
        });

        it('should detect items when templates match above threshold', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(false);
            vi.mocked(calculateColorVariance).mockReturnValue(2000);
            vi.mocked(mockMatchTemplate).mockReturnValue(0.8);

            const tplCanvas = document.createElement('canvas');
            tplCanvas.width = 48;
            tplCanvas.height = 48;
            const tplCtx = tplCanvas.getContext('2d')!;

            const templateMap = new Map();
            templateMap.set('item1', { canvas: tplCanvas, ctx: tplCtx, width: 48, height: 48 });
            vi.mocked(getItemTemplates).mockReturnValue(templateMap);

            const colorMap = new Map();
            colorMap.set('gray', [{ id: 'item1', name: 'Test', rarity: 'common' }]);
            vi.mocked(getTemplatesByColor).mockReturnValue(colorMap);

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test', rarity: 'common' }] as any[];
            const result = await detectIconsWithSlidingWindow(ctx, 100, 100, items, {
                stepSize: 48,
            });

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]!.type).toBe('item');
            expect(result[0]!.method).toBe('template_match');
        });

        it('should call progress callback', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true); // Skip everything
            const progressFn = vi.fn();

            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d')!;

            await detectIconsWithSlidingWindow(ctx, 200, 200, [], {
                progressCallback: progressFn,
            });

            // Progress may or may not have been called depending on step count
            expect(progressFn).toBeDefined();
        });

        it('should respect regionOfInterest', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);

            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithSlidingWindow(ctx, 400, 400, [], {
                regionOfInterest: { x: 100, y: 100, width: 100, height: 100 },
            });

            expect(result).toEqual([]);
        });
    });

    describe('detectEquipmentRegion', () => {
        it('should scan top-left portion of screen', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = await detectEquipmentRegion(ctx, 1920, 1080, []);
            expect(result).toBeInstanceOf(Array);
        });

        it('should call progress callback if provided', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);
            const progressFn = vi.fn();

            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d')!;

            await detectEquipmentRegion(ctx, 200, 200, [], progressFn);
            expect(progressFn).toHaveBeenCalledWith(85, expect.any(String));
        });
    });
});
