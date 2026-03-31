/**
 * @vitest-environment jsdom
 * Unit tests for cv/detection-matching.ts
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { polyfillImageData } from './test-helpers';

beforeAll(() => {
    polyfillImageData();
});

// Mock heavy dependencies
vi.mock('../../../src/modules/cv/state.ts', () => ({
    getItemTemplates: vi.fn(() => new Map()),
    getResizedTemplate: vi.fn(() => undefined),
    setResizedTemplate: vi.fn(),
    getMultiScaleTemplate: vi.fn(() => undefined),
    hasMultiScaleTemplates: vi.fn(() => false),
}));

vi.mock('../../../src/modules/cv/similarity.ts', () => ({
    calculateEnhancedSimilarity: vi.fn((_a: ImageData, _b: ImageData) => 0.75),
}));

vi.mock('../../../src/modules/cv/training.ts', () => ({
    getTrainingTemplatesForItem: vi.fn(() => []),
}));

vi.mock('../../../src/modules/cv/voting.ts', () => ({
    combineVotes: vi.fn((votes: Array<{ confidence: number }>) => {
        if (!votes || votes.length === 0) return null;
        const avg = votes.reduce((s: number, v: { confidence: number }) => s + v.confidence, 0) / votes.length;
        return { confidence: avg, itemId: 'test' };
    }),
}));

vi.mock('../../../src/modules/cv/template-ranking.ts', () => ({
    shouldSkipTemplate: vi.fn(() => false),
    getTemplateRanking: vi.fn(() => null),
}));

vi.mock('../../../src/modules/cv/detection-utils.ts', () => ({
    resizeImageData: vi.fn((_src: ImageData, w: number, h: number) => {
        return new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
    }),
    extractIconRegion: vi.fn((_ctx: unknown, cell: { x: number; y: number; width: number; height: number }) => {
        return new ImageData(new Uint8ClampedArray(cell.width * cell.height * 4), cell.width, cell.height);
    }),
    findClosestTemplateSize: vi.fn((size: number) => size),
}));

import {
    calculateSimilarity,
    shouldUseTemplate,
    matchTemplate,
    findBestTemplateMatch,
} from '../../../src/modules/cv/detection-matching';
import { shouldSkipTemplate, getTemplateRanking } from '../../../src/modules/cv/template-ranking';
import { getItemTemplates } from '../../../src/modules/cv/state';

describe('detection-matching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateSimilarity', () => {
        it('should return similarity score from enhanced similarity', () => {
            const img1 = new ImageData(new Uint8ClampedArray(16), 2, 2);
            const img2 = new ImageData(new Uint8ClampedArray(16), 2, 2);
            const result = calculateSimilarity(img1, img2);
            expect(result).toBe(0.75);
        });
    });

    describe('shouldUseTemplate', () => {
        it('should return true for normal templates', () => {
            expect(shouldUseTemplate('item1_primary', 'item1')).toBe(true);
        });

        it('should return false if template is in skip list', () => {
            vi.mocked(shouldSkipTemplate).mockReturnValueOnce(true);
            expect(shouldUseTemplate('item1_primary', 'item1')).toBe(false);
        });

        it('should return false for very low success rate', () => {
            vi.mocked(getTemplateRanking).mockReturnValueOnce({
                templateId: 'test',
                successRate: 0.2,
                totalAttempts: 20,
                successfulMatches: 4,
                averageConfidence: 0.5,
                shouldSkip: false,
            });
            expect(shouldUseTemplate('test', 'item1')).toBe(false);
        });

        it('should return true for adequate success rate', () => {
            vi.mocked(getTemplateRanking).mockReturnValueOnce({
                templateId: 'test',
                successRate: 0.6,
                totalAttempts: 20,
                successfulMatches: 12,
                averageConfidence: 0.7,
                shouldSkip: false,
            });
            expect(shouldUseTemplate('test', 'item1')).toBe(true);
        });
    });

    describe('matchTemplate', () => {
        it('should return 0 when template should be skipped', () => {
            vi.mocked(shouldSkipTemplate).mockReturnValueOnce(true);

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const template = {
                canvas: document.createElement('canvas'),
                ctx: (() => {
                    const c = document.createElement('canvas');
                    c.width = 40;
                    c.height = 40;
                    return c.getContext('2d')!;
                })(),
                width: 40,
                height: 40,
            };

            const result = matchTemplate(ctx, { x: 0, y: 0, width: 40, height: 40 }, template, 'item1');
            expect(result).toBe(0);
        });

        it('should return similarity score when template matches', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const template = {
                canvas: document.createElement('canvas'),
                ctx: (() => {
                    const c = document.createElement('canvas');
                    c.width = 40;
                    c.height = 40;
                    return c.getContext('2d')!;
                })(),
                width: 40,
                height: 40,
            };

            const result = matchTemplate(ctx, { x: 0, y: 0, width: 40, height: 40 }, template, 'item1');
            expect(result).toBe(0.75); // From mocked calculateEnhancedSimilarity
        });
    });

    describe('findBestTemplateMatch', () => {
        it('should return null when no templates loaded', () => {
            vi.mocked(getItemTemplates).mockReturnValue(new Map());

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test Item', rarity: 'common' }] as any[];
            const result = findBestTemplateMatch(ctx, { x: 0, y: 0, width: 40, height: 40 }, items, 0.5);
            expect(result).toBeNull();
        });

        it('should return best match above threshold', () => {
            const tplCanvas = document.createElement('canvas');
            tplCanvas.width = 40;
            tplCanvas.height = 40;
            const tplCtx = tplCanvas.getContext('2d')!;

            const templateMap = new Map();
            templateMap.set('item1', { canvas: tplCanvas, ctx: tplCtx, width: 40, height: 40 });
            vi.mocked(getItemTemplates).mockReturnValue(templateMap);

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test Item', rarity: 'common' }] as any[];
            const result = findBestTemplateMatch(ctx, { x: 0, y: 0, width: 40, height: 40 }, items, 0.5);

            expect(result).not.toBeNull();
            expect(result!.similarity).toBe(0.75);
            expect(result!.item.id).toBe('item1');
        });

        it('should return null when similarity below threshold', () => {
            const tplCanvas = document.createElement('canvas');
            tplCanvas.width = 40;
            tplCanvas.height = 40;
            const tplCtx = tplCanvas.getContext('2d')!;

            const templateMap = new Map();
            templateMap.set('item1', { canvas: tplCanvas, ctx: tplCtx, width: 40, height: 40 });
            vi.mocked(getItemTemplates).mockReturnValue(templateMap);

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test Item', rarity: 'common' }] as any[];
            // Threshold higher than mock similarity
            const result = findBestTemplateMatch(ctx, { x: 0, y: 0, width: 40, height: 40 }, items, 0.9);
            expect(result).toBeNull();
        });
    });
});
