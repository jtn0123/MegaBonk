// ========================================
// Enhanced CV Utilities
// ========================================
// Utility functions for image manipulation

/**
 * Resize ImageData to target dimensions
 */
export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(imageData, 0, 0);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })!;
    outputCtx.drawImage(canvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    return outputCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Load an image from a data URL
 */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/**
 * Create canvas from image
 */
export function createCanvasFromImage(img: HTMLImageElement): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx };
}
