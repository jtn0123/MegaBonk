import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/modules/cv-strategy.ts', () => ({
    getConfidenceThresholds: vi.fn(() => ({ pass1: 0.8, pass2: 0.6, pass3: 0.4 })),
    compareColorProfiles: vi.fn(() => 0.8),
    getSimilarityPenalty: vi.fn(() => 0),
    extractColorProfile: vi.fn(() => ({ dominant: 'red', secondary: 'blue', average: [128, 64, 64] })),
}));

vi.mock('../../src/modules/cv/color.ts', () => ({
    isEmptyCell: vi.fn(() => false),
    detectBorderRarity: vi.fn(() => 'common'),
}));

vi.mock('../../src/modules/cv-enhanced/similarity.ts', () => ({
    calculateSimilarity: vi.fn(() => 0.85),
}));

vi.mock('../../src/modules/cv-enhanced/utils.ts', () => ({
    resizeImageData: vi.fn((imageData: any, w: number, h: number) => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        return ctx.createImageData(w, h);
    }),
}));

vi.mock('../../src/modules/cv-enhanced/templates.ts', () => {
    return {
        getEnhancedTemplate: vi.fn((id: string) => {
            if (id === 'missing') return null;
            const c = document.createElement('canvas');
            c.width = 48;
            c.height = 48;
            const ctx = c.getContext('2d')!;
            return { ctx, width: 48, height: 48, colorProfile: { dominant: 'red' } };
        }),
        getTemplatesByRarity: vi.fn(() => [{ id: 'item1', name: 'Item 1', rarity: 'common' }]),
        getTemplatesByColor: vi.fn(() => [{ id: 'item2', name: 'Item 2', rarity: 'uncommon' }]),
    };
});

import {
    filterValidCells,
    filterCandidates,
    matchCell,
    multiPassMatching,
    singlePassMatching,
} from '../../src/modules/cv-enhanced/matching.ts';
import { isEmptyCell } from '../../src/modules/cv/color.ts';
import { calculateSimilarity } from '../../src/modules/cv-enhanced/similarity.ts';
import { getTemplatesByRarity } from '../../src/modules/cv-enhanced/templates.ts';
import type { CVStrategy } from '../../src/modules/cv-strategy.ts';

beforeAll(() => {
    if (typeof globalThis.ImageData === 'undefined') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        (globalThis as any).ImageData = ctx.createImageData(1, 1).constructor;
    }
});

function mkStrategy(o: Partial<CVStrategy> = {}): CVStrategy {
    return {
        useEmptyCellDetection: true,
        colorFiltering: 'none',
        colorAnalysis: 'none',
        matchingAlgorithm: 'ncc',
        useFeedbackLoop: false,
        useContextBoosting: false,
        useBorderValidation: false,
        ...o,
    } as CVStrategy;
}

function mkImgData(w = 10, h = 10): ImageData {
    return new ImageData(new Uint8ClampedArray(w * h * 4).fill(128), w, h);
}

describe('cv-enhanced/matching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('filterValidCells', () => {
        it('keeps non-empty cells', () => {
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            const ctx = c.getContext('2d')!;
            const r = filterValidCells(
                ctx,
                [
                    { x: 0, y: 0, width: 10, height: 10 },
                    { x: 20, y: 20, width: 10, height: 10 },
                ],
                mkStrategy()
            );
            expect(r).toHaveLength(2);
        });

        it('skips empty cells', () => {
            vi.mocked(isEmptyCell).mockReturnValueOnce(true);
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            const ctx = c.getContext('2d')!;
            const r = filterValidCells(
                ctx,
                [
                    { x: 0, y: 0, width: 10, height: 10 },
                    { x: 20, y: 20, width: 10, height: 10 },
                ],
                mkStrategy()
            );
            expect(r).toHaveLength(1);
        });

        it('extracts rarity for rarity-first', () => {
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            const ctx = c.getContext('2d')!;
            const r = filterValidCells(
                ctx,
                [{ x: 0, y: 0, width: 10, height: 10 }],
                mkStrategy({ colorFiltering: 'rarity-first' })
            );
            expect(r[0]!.rarity).toBeDefined();
        });

        it('extracts color profile for multi-region', () => {
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            const ctx = c.getContext('2d')!;
            const r = filterValidCells(
                ctx,
                [{ x: 0, y: 0, width: 10, height: 10 }],
                mkStrategy({ colorAnalysis: 'multi-region' })
            );
            expect(r[0]!.colorProfile).toBeDefined();
        });
    });

    describe('filterCandidates', () => {
        const items = [
            { id: 'i1', name: 'I1', rarity: 'common' },
            { id: 'i2', name: 'I2', rarity: 'uncommon' },
        ] as any[];

        it('returns all for none filtering', () => {
            expect(filterCandidates(items, mkStrategy())).toEqual(items);
        });

        it('filters by rarity', () => {
            const r = filterCandidates(items, mkStrategy({ colorFiltering: 'rarity-first' }), 'common');
            expect(r.length).toBeGreaterThan(0);
        });

        it('filters by color', () => {
            const r = filterCandidates(items, mkStrategy({ colorFiltering: 'color-first' }), undefined, {
                dominant: 'red',
            } as any);
            expect(r.length).toBeGreaterThan(0);
        });

        it('falls back when rarity filter empty', () => {
            vi.mocked(getTemplatesByRarity).mockReturnValueOnce([]);
            const r = filterCandidates(items, mkStrategy({ colorFiltering: 'rarity-first' }), 'legendary');
            expect(r).toEqual(items);
        });
    });

    describe('matchCell', () => {
        const items = [{ id: 'item1', name: 'I1', rarity: 'common' }] as any[];

        it('returns best match', () => {
            const r = matchCell(mkImgData(), items, mkStrategy());
            expect(r).not.toBeNull();
            expect(r!.item.id).toBe('item1');
        });

        it('returns null for missing template', () => {
            expect(matchCell(mkImgData(), [{ id: 'missing', name: 'M' }] as any[], mkStrategy())).toBeNull();
        });

        it('applies context boosting', () => {
            vi.mocked(calculateSimilarity).mockReturnValue(0.5);
            const r = matchCell(
                mkImgData(),
                [{ id: 'item1', name: 'C', rarity: 'legendary' }] as any[],
                mkStrategy({ useContextBoosting: true })
            );
            expect(r).not.toBeNull();
            expect(r!.similarity).toBeCloseTo(0.53, 1);
        });

        it('applies feedback loop', () => {
            const r = matchCell(mkImgData(), items, mkStrategy({ useFeedbackLoop: true }));
            expect(r).not.toBeNull();
        });

        it('applies border validation', () => {
            const r = matchCell(mkImgData(), items, mkStrategy({ useBorderValidation: true }));
            expect(r).not.toBeNull();
        });

        it('rejects below similarity floor', () => {
            vi.mocked(calculateSimilarity).mockReturnValue(0.1);
            expect(matchCell(mkImgData(), items, mkStrategy())).toBeNull();
        });

        it('clamps similarity to 0.99', () => {
            vi.mocked(calculateSimilarity).mockReturnValue(1.5);
            const r = matchCell(mkImgData(), items, mkStrategy());
            expect(r!.similarity).toBeLessThanOrEqual(0.99);
        });
    });

    describe('multiPassMatching', () => {
        const items = [{ id: 'item1', name: 'I1', rarity: 'common' }] as any[];
        it('handles empty cells', () => {
            expect(multiPassMatching([], items, mkStrategy())).toEqual([]);
        });
        it('calls progress', () => {
            const cb = vi.fn();
            multiPassMatching(
                [{ cell: { x: 0, y: 0, width: 10, height: 10 }, imageData: mkImgData() }] as any,
                items,
                mkStrategy(),
                cb
            );
            expect(cb).toHaveBeenCalled();
        });
    });

    describe('singlePassMatching', () => {
        const items = [{ id: 'item1', name: 'I1', rarity: 'common' }] as any[];
        it('handles empty', () => {
            expect(singlePassMatching([], items, mkStrategy())).toEqual([]);
        });
        it('calls progress', () => {
            const cells = Array.from({ length: 10 }, (_, i) => ({
                cell: { x: i * 10, y: 0, width: 10, height: 10 },
                imageData: mkImgData(),
            }));
            const cb = vi.fn();
            singlePassMatching(cells as any, items, mkStrategy(), cb);
            expect(cb).toHaveBeenCalled();
        });
    });
});
