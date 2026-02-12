// ========================================
// Image Preprocessing for OCR
// ========================================
// Functions to prepare images for better OCR accuracy

/**
 * Preprocess image for digit OCR
 * Applies high contrast and thresholding for better digit recognition
 */
export function preprocessForDigits(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error('Failed to get 2D context for preprocessing');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and apply high contrast
    for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminosity method
        const gray = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);

        // Apply contrast enhancement
        const contrast = 2.0;
        const adjusted = Math.round(((gray / 255 - 0.5) * contrast + 0.5) * 255);
        const clamped = Math.max(0, Math.min(255, adjusted));

        // Threshold to binary (white text on dark background or vice versa)
        const threshold = 128;
        const binary = clamped > threshold ? 255 : 0;

        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Load an image from a data URL into an Image element
 */
export function loadImage(imageDataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageDataUrl;
    });
}

/**
 * Create a canvas from an image element
 */
export function createCanvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
        ctx.drawImage(img, 0, 0);
    }
    return canvas;
}
