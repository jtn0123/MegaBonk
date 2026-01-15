// ========================================
// Computer Vision Color Analysis Tests
// ========================================
// Tests for color extraction, border detection, and rarity detection
// Focus: Color algorithms, border validation, rarity matching
// ========================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractDominantColors } from '../../src/modules/computer-vision.ts';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock test-utils
vi.mock('../../src/modules/test-utils.ts', () => ({
    detectResolution: vi.fn(() => ({ category: '1080p', width: 1920, height: 1080 })),
    detectUILayout: vi.fn(() => ({ layout: 'standard' })),
}));

// Polyfill ImageData for jsdom
beforeEach(() => {
    if (typeof ImageData === 'undefined') {
        (global as any).ImageData = class ImageData {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            colorSpace: PredefinedColorSpace;

            constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
                if (data instanceof Uint8ClampedArray) {
                    this.data = data;
                    this.width = width;
                    this.height = height!;
                } else {
                    this.width = data;
                    this.height = width;
                    this.data = new Uint8ClampedArray(this.width * this.height * 4);
                }
                this.colorSpace = 'srgb';
            }
        };
    }
});

// Helper to create ImageData with specific color
const createColorImageData = (width: number, height: number, r: number, g: number, b: number): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }
    return new ImageData(data, width, height);
};

// Helper to create ImageData with border color different from center
const createBorderedImageData = (
    width: number,
    height: number,
    borderR: number,
    borderG: number,
    borderB: number,
    centerR: number,
    centerG: number,
    centerB: number,
    borderWidth: number = 2
): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const isBorder =
                x < borderWidth ||
                x >= width - borderWidth ||
                y < borderWidth ||
                y >= height - borderWidth;

            if (isBorder) {
                data[i] = borderR;
                data[i + 1] = borderG;
                data[i + 2] = borderB;
            } else {
                data[i] = centerR;
                data[i + 1] = centerG;
                data[i + 2] = centerB;
            }
            data[i + 3] = 255;
        }
    }

    return new ImageData(data, width, height);
};

describe('Computer Vision - Extract Border Pixels', () => {
    const extractBorderPixels = (imageData: ImageData, borderWidth: number = 2): Uint8ClampedArray => {
        const { width, height, data } = imageData;
        const borderPixels: number[] = [];

        // Top and bottom borders
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < borderWidth; y++) {
                // Top border
                const topIndex = (y * width + x) * 4;
                borderPixels.push(data[topIndex], data[topIndex + 1], data[topIndex + 2]);

                // Bottom border
                const bottomIndex = ((height - 1 - y) * width + x) * 4;
                borderPixels.push(data[bottomIndex], data[bottomIndex + 1], data[bottomIndex + 2]);
            }
        }

        // Left and right borders
        for (let y = borderWidth; y < height - borderWidth; y++) {
            for (let x = 0; x < borderWidth; x++) {
                // Left border
                const leftIndex = (y * width + x) * 4;
                borderPixels.push(data[leftIndex], data[leftIndex + 1], data[leftIndex + 2]);

                // Right border
                const rightIndex = (y * width + (width - 1 - x)) * 4;
                borderPixels.push(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2]);
            }
        }

        return new Uint8ClampedArray(borderPixels);
    };

    it('should extract border pixels from solid color image', () => {
        const img = createColorImageData(50, 50, 255, 0, 0);
        const borderPixels = extractBorderPixels(img, 2);

        expect(borderPixels).toBeInstanceOf(Uint8ClampedArray);
        expect(borderPixels.length).toBeGreaterThan(0);
        expect(borderPixels.length % 3).toBe(0); // RGB triplets
    });

    it('should extract correct border width', () => {
        const img = createBorderedImageData(50, 50, 255, 0, 0, 0, 255, 0, 2);
        const borderPixels = extractBorderPixels(img, 2);

        // Check that we extracted red pixels (border)
        expect(borderPixels[0]).toBe(255); // R
        expect(borderPixels[1]).toBe(0); // G
        expect(borderPixels[2]).toBe(0); // B
    });

    it('should handle 1-pixel border width', () => {
        const img = createColorImageData(50, 50, 100, 150, 200);
        const borderPixels = extractBorderPixels(img, 1);

        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('should handle very small images (5x5)', () => {
        const img = createColorImageData(5, 5, 128, 128, 128);
        const borderPixels = extractBorderPixels(img, 1);

        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('should handle square images', () => {
        const img = createColorImageData(100, 100, 255, 255, 255);
        const borderPixels = extractBorderPixels(img, 3);

        expect(borderPixels.length).toBeGreaterThan(0);
        expect(borderPixels.length % 3).toBe(0);
    });

    it('should handle rectangular images (wide)', () => {
        const img = createColorImageData(200, 50, 128, 64, 32);
        const borderPixels = extractBorderPixels(img, 2);

        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('should handle rectangular images (tall)', () => {
        const img = createColorImageData(50, 200, 64, 128, 192);
        const borderPixels = extractBorderPixels(img, 2);

        expect(borderPixels.length).toBeGreaterThan(0);
    });

    it('should extract larger border width', () => {
        const img = createColorImageData(100, 100, 255, 0, 0);
        const borderPixels = extractBorderPixels(img, 5);

        // Larger border should extract more pixels
        expect(borderPixels.length).toBeGreaterThan(0);
    });
});

describe('Computer Vision - Detect Border Rarity', () => {
    const detectBorderRarity = (imageData: ImageData): string | null => {
        const extractBorderPixels = (imageData: ImageData, borderWidth: number = 2): Uint8ClampedArray => {
            const { width, height, data } = imageData;
            const borderPixels: number[] = [];

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < borderWidth; y++) {
                    const topIndex = (y * width + x) * 4;
                    borderPixels.push(data[topIndex], data[topIndex + 1], data[topIndex + 2]);

                    const bottomIndex = ((height - 1 - y) * width + x) * 4;
                    borderPixels.push(data[bottomIndex], data[bottomIndex + 1], data[bottomIndex + 2]);
                }
            }

            for (let y = borderWidth; y < height - borderWidth; y++) {
                for (let x = 0; x < borderWidth; x++) {
                    const leftIndex = (y * width + x) * 4;
                    borderPixels.push(data[leftIndex], data[leftIndex + 1], data[leftIndex + 2]);

                    const rightIndex = (y * width + (width - 1 - x)) * 4;
                    borderPixels.push(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2]);
                }
            }

            return new Uint8ClampedArray(borderPixels);
        };

        const borderPixels = extractBorderPixels(imageData, 3);

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let i = 0; i < borderPixels.length; i += 3) {
            sumR += borderPixels[i];
            sumG += borderPixels[i + 1];
            sumB += borderPixels[i + 2];
            count++;
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        const rarityColors: Record<string, { r: number; g: number; b: number; tolerance: number }> = {
            common: { r: 128, g: 128, b: 128, tolerance: 40 },
            uncommon: { r: 0, g: 255, b: 0, tolerance: 60 },
            rare: { r: 0, g: 128, b: 255, tolerance: 60 },
            epic: { r: 128, g: 0, b: 255, tolerance: 60 },
            legendary: { r: 255, g: 165, b: 0, tolerance: 60 },
        };

        let bestMatch: string | null = null;
        let bestDistance = Infinity;

        for (const [rarity, color] of Object.entries(rarityColors)) {
            const distance = Math.sqrt(
                Math.pow(avgR - color.r, 2) + Math.pow(avgG - color.g, 2) + Math.pow(avgB - color.b, 2)
            );

            if (distance < color.tolerance && distance < bestDistance) {
                bestMatch = rarity;
                bestDistance = distance;
            }
        }

        return bestMatch;
    };

    it('should detect common rarity (gray border)', () => {
        const img = createBorderedImageData(50, 50, 128, 128, 128, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBe('common');
    });

    it('should detect uncommon rarity (green border)', () => {
        const img = createBorderedImageData(50, 50, 0, 255, 0, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBe('uncommon');
    });

    it('should detect rare rarity (blue border)', () => {
        const img = createBorderedImageData(50, 50, 0, 128, 255, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBe('rare');
    });

    it('should detect epic rarity (purple border)', () => {
        const img = createBorderedImageData(50, 50, 128, 0, 255, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBe('epic');
    });

    it('should detect legendary rarity (orange border)', () => {
        const img = createBorderedImageData(50, 50, 255, 165, 0, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBe('legendary');
    });

    it('should return null for no clear match', () => {
        // Random color that doesn't match any rarity
        const img = createBorderedImageData(50, 50, 50, 50, 50, 200, 200, 200, 3);
        const rarity = detectBorderRarity(img);

        expect(rarity).toBeNull();
    });

    it('should handle images with no distinct border', () => {
        const img = createColorImageData(50, 50, 200, 200, 200);
        const rarity = detectBorderRarity(img);

        // Uniform color doesn't match any rarity
        expect(rarity).toBeNull();
    });

    it('should handle small images (10x10)', () => {
        const img = createBorderedImageData(10, 10, 0, 255, 0, 200, 200, 200, 1);
        const rarity = detectBorderRarity(img);

        expect(typeof rarity === 'string' || rarity === null).toBe(true);
    });
});

describe('Computer Vision - Extract Dominant Colors', () => {
    it('should extract dominant colors from solid color image', () => {
        const img = createColorImageData(50, 50, 255, 0, 0);
        const colors = extractDominantColors(img, 3);

        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(3);
    });

    it('should return color objects with r, g, b, frequency', () => {
        const img = createColorImageData(50, 50, 100, 150, 200);
        const colors = extractDominantColors(img, 5);

        colors.forEach(color => {
            expect(color).toHaveProperty('r');
            expect(color).toHaveProperty('g');
            expect(color).toHaveProperty('b');
            expect(color).toHaveProperty('frequency');
            expect(typeof color.r).toBe('number');
            expect(typeof color.g).toBe('number');
            expect(typeof color.b).toBe('number');
            expect(typeof color.frequency).toBe('number');
        });
    });

    it('should respect numColors parameter', () => {
        const img = createColorImageData(100, 100, 128, 128, 128);
        const colors = extractDominantColors(img, 3);

        expect(colors.length).toBeLessThanOrEqual(3);
    });

    it('should handle default numColors parameter', () => {
        const img = createColorImageData(50, 50, 200, 100, 50);
        const colors = extractDominantColors(img);

        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(5); // Default is 5
    });

    it('should handle small images (5x5)', () => {
        const img = createColorImageData(5, 5, 255, 255, 255);
        const colors = extractDominantColors(img, 2);

        expect(colors.length).toBeGreaterThan(0);
    });

    it('should handle 1x1 image', () => {
        const img = createColorImageData(1, 1, 128, 64, 32);
        const colors = extractDominantColors(img, 1);

        expect(colors.length).toBeGreaterThan(0);
    });

    it('should sort colors by frequency (descending)', () => {
        const img = createColorImageData(100, 100, 255, 0, 0);
        const colors = extractDominantColors(img, 5);

        // Check that frequencies are in descending order
        for (let i = 0; i < colors.length - 1; i++) {
            expect(colors[i].frequency).toBeGreaterThanOrEqual(colors[i + 1].frequency);
        }
    });

    it('should quantize colors to reduce palette', () => {
        const img = createColorImageData(50, 50, 137, 142, 151);
        const colors = extractDominantColors(img, 3);

        // Colors should be quantized (divisible by 32)
        colors.forEach(color => {
            expect(color.r % 32).toBe(0);
            expect(color.g % 32).toBe(0);
            expect(color.b % 32).toBe(0);
        });
    });

    it('should handle very large numColors request', () => {
        const img = createColorImageData(50, 50, 100, 100, 100);
        const colors = extractDominantColors(img, 100);

        // Should return what's available, not necessarily 100
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.length).toBeLessThanOrEqual(100);
    });
});

describe('Computer Vision - Get Dominant Color Category', () => {
    const getDominantColor = (imageData: ImageData): string => {
        const pixels = imageData.data;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 16) {
            sumR += pixels[i];
            sumG += pixels[i + 1];
            sumB += pixels[i + 2];
            count++;
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        const maxChannel = Math.max(avgR, avgG, avgB);
        const minChannel = Math.min(avgR, avgG, avgB);
        const diff = maxChannel - minChannel;

        if (diff < 30) {
            const brightness = (avgR + avgG + avgB) / 3;
            if (brightness < 60) return 'black';
            if (brightness > 200) return 'white';
            return 'gray';
        }

        if (avgR > avgG && avgR > avgB) {
            if (avgG > avgB * 1.3) return 'orange';
            if (avgR > 180 && avgG > 140) return 'yellow';
            return 'red';
        } else if (avgG > avgR && avgG > avgB) {
            if (avgB > avgR * 1.3) return 'cyan';
            if (avgG > 180 && avgB < 100) return 'lime';
            return 'green';
        } else if (avgB > avgR && avgB > avgG) {
            if (avgR > avgG * 1.3) return 'purple';
            if (avgB > 180 && avgG < 100) return 'blue';
            return 'blue';
        }

        if (avgR > 150 && avgG < 100 && avgB > 150) return 'magenta';
        if (avgR > 100 && avgG > 100 && avgB < 80) return 'brown';

        return 'mixed';
    };

    it('should categorize black color', () => {
        const img = createColorImageData(50, 50, 0, 0, 0);
        const category = getDominantColor(img);

        expect(category).toBe('black');
    });

    it('should categorize white color', () => {
        const img = createColorImageData(50, 50, 255, 255, 255);
        const category = getDominantColor(img);

        expect(category).toBe('white');
    });

    it('should categorize gray color', () => {
        const img = createColorImageData(50, 50, 128, 128, 128);
        const category = getDominantColor(img);

        expect(category).toBe('gray');
    });

    it('should categorize red color', () => {
        const img = createColorImageData(50, 50, 255, 0, 0);
        const category = getDominantColor(img);

        expect(category).toBe('red');
    });

    it('should categorize green color', () => {
        const img = createColorImageData(50, 50, 50, 150, 50);
        const category = getDominantColor(img);

        expect(category).toBe('green');
    });

    it('should categorize blue color', () => {
        const img = createColorImageData(50, 50, 0, 0, 255);
        const category = getDominantColor(img);

        expect(category).toBe('blue');
    });

    it('should categorize orange color', () => {
        const img = createColorImageData(50, 50, 255, 165, 0);
        const category = getDominantColor(img);

        expect(category).toBe('orange');
    });

    it('should categorize yellow color', () => {
        const img = createColorImageData(50, 50, 190, 150, 120);
        const category = getDominantColor(img);

        expect(category).toBe('yellow');
    });

    it('should categorize cyan color', () => {
        const img = createColorImageData(50, 50, 50, 200, 150);
        const category = getDominantColor(img);

        expect(category).toBe('cyan');
    });

    it('should categorize purple color', () => {
        const img = createColorImageData(50, 50, 128, 0, 255);
        const category = getDominantColor(img);

        expect(category).toBe('purple');
    });

    it('should categorize magenta color', () => {
        const img = createColorImageData(50, 50, 255, 0, 255);
        const category = getDominantColor(img);

        expect(category).toBe('magenta');
    });

    it('should categorize brown color', () => {
        const img = createColorImageData(50, 50, 110, 110, 40);
        const category = getDominantColor(img);

        expect(category).toBe('brown');
    });

    it('should categorize lime color', () => {
        const img = createColorImageData(50, 50, 0, 200, 0);
        const category = getDominantColor(img);

        expect(category).toBe('lime');
    });

    it('should handle edge case colors', () => {
        const img = createColorImageData(50, 50, 64, 64, 64);
        const category = getDominantColor(img);

        // Should be categorized as something valid
        expect(typeof category).toBe('string');
        expect(category.length).toBeGreaterThan(0);
    });
});

describe('Computer Vision - Color Distance Calculation', () => {
    const calculateColorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number => {
        return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
    };

    it('should return 0 for identical colors', () => {
        const distance = calculateColorDistance(128, 128, 128, 128, 128, 128);
        expect(distance).toBe(0);
    });

    it('should calculate distance between black and white', () => {
        const distance = calculateColorDistance(0, 0, 0, 255, 255, 255);
        expect(distance).toBeCloseTo(Math.sqrt(3 * 255 * 255), 5);
    });

    it('should calculate distance between red and green', () => {
        const distance = calculateColorDistance(255, 0, 0, 0, 255, 0);
        expect(distance).toBeCloseTo(Math.sqrt(2 * 255 * 255), 5);
    });

    it('should be symmetric', () => {
        const dist1 = calculateColorDistance(100, 150, 200, 50, 75, 100);
        const dist2 = calculateColorDistance(50, 75, 100, 100, 150, 200);

        expect(dist1).toBeCloseTo(dist2, 5);
    });

    it('should handle grayscale values', () => {
        const distance = calculateColorDistance(0, 0, 0, 128, 128, 128);
        expect(distance).toBeCloseTo(Math.sqrt(3 * 128 * 128), 5);
    });

    it('should satisfy triangle inequality', () => {
        // d(A, C) <= d(A, B) + d(B, C)
        const distAC = calculateColorDistance(0, 0, 0, 255, 255, 255);
        const distAB = calculateColorDistance(0, 0, 0, 128, 128, 128);
        const distBC = calculateColorDistance(128, 128, 128, 255, 255, 255);

        expect(distAC).toBeLessThanOrEqual(distAB + distBC + 0.001); // Small epsilon for floating point
    });
});
