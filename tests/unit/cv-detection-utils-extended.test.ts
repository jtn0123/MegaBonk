import { describe, it, expect, beforeAll } from 'vitest';
import {
    calculateIoU,
    nonMaxSuppression,
    extractCountRegion,
    hashImageDataUrl,
    findClosestTemplateSize,
    resizeImageData,
    extractIconRegion,
} from '../../src/modules/cv/detection-utils.ts';

beforeAll(() => {
    if (typeof globalThis.ImageData === 'undefined') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        (globalThis as any).ImageData = ctx.createImageData(1, 1).constructor;
    }
});

describe('cv/detection-utils extended', () => {
    describe('calculateIoU', () => {
        it('returns 1 for identical boxes', () => {
            expect(
                calculateIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })
            ).toBeCloseTo(1);
        });
        it('returns 0 for non-overlapping', () => {
            expect(calculateIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(
                0
            );
        });
        it('correct for partial overlap', () => {
            expect(
                calculateIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })
            ).toBeCloseTo(25 / 175, 3);
        });
        it('handles zero-area', () => {
            expect(calculateIoU({ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(0);
        });
        it('handles contained box', () => {
            expect(
                calculateIoU({ x: 0, y: 0, width: 20, height: 20 }, { x: 5, y: 5, width: 5, height: 5 })
            ).toBeCloseTo(25 / 400, 3);
        });
    });

    describe('nonMaxSuppression', () => {
        it('empty for empty input', () => {
            expect(nonMaxSuppression([])).toEqual([]);
        });
        it('keeps single detection', () => {
            const d = [
                {
                    type: 'item' as const,
                    entity: { id: 'a' } as any,
                    confidence: 0.9,
                    position: { x: 0, y: 0, width: 10, height: 10 },
                    method: 'template_match' as const,
                },
            ];
            expect(nonMaxSuppression(d)).toHaveLength(1);
        });
        it('removes overlapping lower-confidence', () => {
            const d = [
                {
                    type: 'item' as const,
                    entity: { id: 'a' } as any,
                    confidence: 0.5,
                    position: { x: 0, y: 0, width: 10, height: 10 },
                    method: 'template_match' as const,
                },
                {
                    type: 'item' as const,
                    entity: { id: 'b' } as any,
                    confidence: 0.9,
                    position: { x: 2, y: 2, width: 10, height: 10 },
                    method: 'template_match' as const,
                },
            ];
            const r = nonMaxSuppression(d, 0.3);
            expect(r).toHaveLength(1);
            expect(r[0]!.confidence).toBe(0.9);
        });
        it('keeps non-overlapping', () => {
            const d = [
                {
                    type: 'item' as const,
                    entity: { id: 'a' } as any,
                    confidence: 0.9,
                    position: { x: 0, y: 0, width: 10, height: 10 },
                    method: 'template_match' as const,
                },
                {
                    type: 'item' as const,
                    entity: { id: 'b' } as any,
                    confidence: 0.8,
                    position: { x: 100, y: 100, width: 10, height: 10 },
                    method: 'template_match' as const,
                },
            ];
            expect(nonMaxSuppression(d)).toHaveLength(2);
        });
        it('handles no positions', () => {
            const d = [
                {
                    type: 'item' as const,
                    entity: { id: 'a' } as any,
                    confidence: 0.9,
                    method: 'template_match' as const,
                },
            ];
            expect(nonMaxSuppression(d as any)).toHaveLength(1);
        });
    });

    describe('extractCountRegion', () => {
        it('extracts bottom-right', () => {
            const r = extractCountRegion({ x: 10, y: 20, width: 100, height: 100 });
            expect(r.x).toBe(85);
            expect(r.y).toBe(95);
            expect(r.width).toBe(25);
        });
        it('caps at 25', () => {
            expect(extractCountRegion({ x: 0, y: 0, width: 200, height: 200 }).width).toBe(25);
        });
        it('uses 25% for small cells', () => {
            expect(extractCountRegion({ x: 0, y: 0, width: 40, height: 40 }).width).toBe(10);
        });
        it('includes label suffix', () => {
            expect(extractCountRegion({ x: 0, y: 0, width: 50, height: 50, label: 'g' }).label).toBe('g_count');
        });
        it('defaults label', () => {
            expect(extractCountRegion({ x: 0, y: 0, width: 50, height: 50 }).label).toBe('cell_count');
        });
    });

    describe('hashImageDataUrl', () => {
        it('starts with img_', () => {
            expect(hashImageDataUrl('data:image/png;base64,abc')).toMatch(/^img_/);
        });
        it('includes length', () => {
            const s = 'data:image/png;base64,abc';
            expect(hashImageDataUrl(s)).toContain(`_${s.length}`);
        });
        it('different for different inputs', () => {
            expect(hashImageDataUrl('aaa')).not.toBe(hashImageDataUrl('bbb'));
        });
        it('deterministic', () => {
            expect(hashImageDataUrl('x')).toBe(hashImageDataUrl('x'));
        });
        it('handles empty', () => {
            expect(hashImageDataUrl('')).toMatch(/^img_/);
        });
        it('handles long strings', () => {
            expect(hashImageDataUrl('x'.repeat(100000))).toContain('_100000');
        });
    });

    describe('findClosestTemplateSize', () => {
        it('finds exact 48', () => {
            expect(findClosestTemplateSize(48)).toBe(48);
        });
        it('returns number for non-exact', () => {
            expect(typeof findClosestTemplateSize(50)).toBe('number');
        });
        it('handles small', () => {
            expect(findClosestTemplateSize(1)).toBeGreaterThan(0);
        });
        it('handles large', () => {
            expect(typeof findClosestTemplateSize(1000)).toBe('number');
        });
    });

    describe('resizeImageData', () => {
        it('resizes', () => {
            const img = new ImageData(new Uint8ClampedArray(4 * 4 * 4).fill(128), 4, 4);
            const r = resizeImageData(img, 8, 8);
            expect(r).not.toBeNull();
            expect(r!.width).toBe(8);
        });
        it('downscales', () => {
            const img = new ImageData(new Uint8ClampedArray(10 * 10 * 4).fill(200), 10, 10);
            const r = resizeImageData(img, 3, 3);
            expect(r!.width).toBe(3);
        });
    });

    describe('extractIconRegion', () => {
        it('extracts 80% of cell', () => {
            const c = document.createElement('canvas');
            c.width = 200;
            c.height = 200;
            const ctx = c.getContext('2d')!;
            const r = extractIconRegion(ctx, { x: 10, y: 10, width: 50, height: 50 });
            expect(r.width).toBe(40);
        });
        it('handles edge cells', () => {
            const c = document.createElement('canvas');
            c.width = 20;
            c.height = 20;
            const ctx = c.getContext('2d')!;
            const r = extractIconRegion(ctx, { x: 15, y: 15, width: 50, height: 50 });
            expect(r.width).toBeLessThanOrEqual(20);
        });
        it('ensures minimum size', () => {
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            const ctx = c.getContext('2d')!;
            const r = extractIconRegion(ctx, { x: 0, y: 0, width: 1, height: 1 });
            expect(r.width).toBeGreaterThanOrEqual(1);
        });
    });
});
