/**
 * Shared test helpers for CV tests
 */

/**
 * Polyfill ImageData for jsdom environments where it's not available
 */
export function polyfillImageData(): void {
    if (typeof globalThis.ImageData === 'undefined') {
        (globalThis as any).ImageData = class ImageData {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
                if (dataOrWidth instanceof Uint8ClampedArray) {
                    this.data = dataOrWidth;
                    this.width = widthOrHeight;
                    this.height = height ?? (dataOrWidth.length / 4 / widthOrHeight);
                } else {
                    this.width = dataOrWidth;
                    this.height = widthOrHeight;
                    this.data = new Uint8ClampedArray(this.width * this.height * 4);
                }
            }
        };
    }
}

/**
 * Create a mock ImageData object with pixel data from a fill function
 */
export function createImageData(
    width: number,
    height: number,
    fillFn?: (x: number, y: number) => [number, number, number, number]
): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const [r, g, b, a] = fillFn ? fillFn(x, y) : [128, 128, 128, 255];
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    return new ImageData(data, width, height);
}
