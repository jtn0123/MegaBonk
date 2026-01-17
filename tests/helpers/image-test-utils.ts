/**
 * Shared Image Test Utilities
 * Common helper functions for creating test ImageData across CV tests
 */

/**
 * Create ImageData with custom pixel fill function
 */
export function createImageData(
    width: number,
    height: number,
    fillFn: (x: number, y: number) => [number, number, number]
): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = fillFn(x, y);
            const idx = (y * width + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255; // Alpha
        }
    }

    return imageData;
}

/**
 * Create solid color ImageData
 */
export function createSolidColor(
    width: number,
    height: number,
    r: number,
    g: number,
    b: number
): ImageData {
    return createImageData(width, height, () => [r, g, b]);
}

/**
 * Create gradient ImageData from one color to another (horizontal)
 */
export function createGradient(
    width: number,
    height: number,
    from: [number, number, number],
    to: [number, number, number]
): ImageData {
    return createImageData(width, height, (x) => {
        const t = x / (width - 1);
        return [
            Math.floor(from[0] + (to[0] - from[0]) * t),
            Math.floor(from[1] + (to[1] - from[1]) * t),
            Math.floor(from[2] + (to[2] - from[2]) * t),
        ];
    });
}

/**
 * Create bordered image with different border and interior colors
 */
export function createBorderedImage(
    width: number,
    height: number,
    borderColor: [number, number, number],
    innerColor: [number, number, number],
    borderWidth: number = 3
): ImageData {
    return createImageData(width, height, (x, y) => {
        const isBorder =
            x < borderWidth || x >= width - borderWidth || y < borderWidth || y >= height - borderWidth;
        return isBorder ? borderColor : innerColor;
    });
}

/**
 * Add noise to existing ImageData
 */
export function addNoise(imageData: ImageData, strength: number): ImageData {
    const noisy = new ImageData(imageData.width, imageData.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * strength;
        noisy.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
        noisy.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        noisy.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
        noisy.data[i + 3] = 255;
    }

    return noisy;
}

/**
 * Create mock canvas context with pre-filled pattern
 */
export function createMockContext(
    width: number,
    height: number,
    fillFn?: (x: number, y: number) => [number, number, number, number]
): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    if (fillFn) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const [r, g, b, a] = fillFn(x, y);
                const idx = (y * width + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    return ctx;
}
