import { describe, it, expect, beforeAll } from 'vitest';
import { calculateSimilarity, calculateNCC, calculateSSD, calculateSSIM } from '../../src/modules/cv-enhanced/similarity.ts';

beforeAll(() => {
    if (typeof globalThis.ImageData === 'undefined') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        (globalThis as any).ImageData = ctx.createImageData(1, 1).constructor;
    }
});

function mkImg(w: number, h: number, fill: number): ImageData {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < d.length; i += 4) { d[i] = fill; d[i+1] = fill; d[i+2] = fill; d[i+3] = 255; }
    return new ImageData(d, w, h);
}

function mkGradient(w: number, h: number, s: number, e: number): ImageData {
    const d = new Uint8ClampedArray(w * h * 4);
    const n = w * h;
    for (let p = 0; p < n; p++) {
        const v = Math.round(s + (e - s) * (p / n));
        const i = p * 4;
        d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
    }
    return new ImageData(d, w, h);
}

describe('cv-enhanced/similarity', () => {
    describe('calculateSimilarity', () => {
        it('dispatches to NCC', () => {
            expect(calculateSimilarity(mkGradient(4,4,50,200), mkGradient(4,4,50,200), 'ncc')).toBeGreaterThan(0.9);
        });
        it('dispatches to SSD', () => {
            expect(calculateSimilarity(mkImg(4,4,100), mkImg(4,4,100), 'ssd')).toBeCloseTo(1, 3);
        });
        it('dispatches to SSIM', () => {
            expect(calculateSimilarity(mkGradient(4,4,50,200), mkGradient(4,4,50,200), 'ssim')).toBeGreaterThan(0.8);
        });
    });

    describe('calculateNCC', () => {
        it('high similarity for identical gradients', () => {
            expect(calculateNCC(mkGradient(8,8,50,200), mkGradient(8,8,50,200))).toBeGreaterThan(0.9);
        });
        it('returns 0 for uniform images', () => {
            expect(calculateNCC(mkImg(4,4,100), mkImg(4,4,200))).toBe(0);
        });
        it('handles different pixel lengths', () => {
            const r = calculateNCC(mkGradient(4,4,0,255), mkGradient(8,8,0,255));
            expect(r).not.toBeNaN();
        });
        it('values between 0 and 1', () => {
            const r = calculateNCC(mkGradient(8,8,0,255), mkGradient(8,8,255,0));
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        });
    });

    describe('calculateSSD', () => {
        it('returns 1 for identical', () => { expect(calculateSSD(mkImg(4,4,128), mkImg(4,4,128))).toBeCloseTo(1, 5); });
        it('low for opposite', () => { expect(calculateSSD(mkImg(4,4,0), mkImg(4,4,255))).toBeLessThan(0.01); });
        it('intermediate for partial diff', () => {
            const r = calculateSSD(mkImg(4,4,100), mkImg(4,4,150));
            expect(r).toBeGreaterThan(0.05);
            expect(r).toBeLessThan(1);
        });
    });

    describe('calculateSSIM', () => {
        it('high for identical gradients', () => { expect(calculateSSIM(mkGradient(8,8,50,200), mkGradient(8,8,50,200))).toBeGreaterThan(0.9); });
        it('lower for reversed', () => { expect(calculateSSIM(mkGradient(8,8,0,200), mkGradient(8,8,200,0))).toBeLessThan(0.9); });
        it('no NaN for uniform', () => { expect(calculateSSIM(mkImg(4,4,128), mkImg(4,4,128))).not.toBeNaN(); });
    });
});
