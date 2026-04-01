import { describe, it, expect, beforeAll } from 'vitest';
import { resizeImageData, loadImage, createCanvasFromImage } from '../../src/modules/cv-enhanced/utils.ts';

beforeAll(() => {
    if (typeof globalThis.ImageData === 'undefined') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        (globalThis as any).ImageData = ctx.createImageData(1, 1).constructor;
    }
});

function mkImg(w: number, h: number, v: number = 128): ImageData {
    const d = new Uint8ClampedArray(w * h * 4).fill(v);
    return new ImageData(d, w, h);
}

describe('cv-enhanced/utils', () => {
    describe('resizeImageData', () => {
        it('resizes to target dimensions', () => {
            const r = resizeImageData(mkImg(10, 10), 5, 5);
            expect(r.width).toBe(5);
            expect(r.height).toBe(5);
        });
        it('upscales', () => {
            const r = resizeImageData(mkImg(4, 4), 8, 8);
            expect(r.width).toBe(8);
        });
        it('preserves RGBA format', () => {
            const r = resizeImageData(mkImg(4, 4), 2, 2);
            expect(r.data.length).toBe(2 * 2 * 4);
        });
        it('handles non-square', () => {
            const r = resizeImageData(mkImg(6, 4), 3, 8);
            expect(r.width).toBe(3);
            expect(r.height).toBe(8);
        });
    });

    describe('createCanvasFromImage', () => {
        it('creates canvas with correct dimensions', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;
            const ctx = canvas.getContext('2d')!;
            // Use canvas as a stand-in for Image (drawImage accepts canvas)
            const result = createCanvasFromImage(canvas as any);
            expect(result.canvas.width).toBe(10);
            expect(result.ctx).toBeDefined();
        });
    });
});
