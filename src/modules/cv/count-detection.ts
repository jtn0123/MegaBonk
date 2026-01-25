// ========================================
// Item Count Detection Module
// ========================================
// Detects stack counts (x2, x3, x5, etc.) on item icons
// Uses digit recognition and pattern matching

import { getCountTextRegion } from './resolution-profiles.ts';

/**
 * Simple image data interface
 */
interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

/**
 * Count detection result
 */
export interface CountDetectionResult {
    /** Detected count (1 = no count detected) */
    count: number;
    /** Confidence in the detection */
    confidence: number;
    /** Raw text detected (if any) */
    rawText: string;
    /** Region where count was found */
    region: { x: number; y: number; width: number; height: number };
    /** Method used for detection */
    method: 'pattern' | 'ocr' | 'none';
}

/**
 * Digit pattern for recognition
 * Uses 5x7 bitmap representation
 */
interface DigitPattern {
    digit: number;
    pattern: number[][];
}

/**
 * Common digit patterns (5 wide x 7 tall)
 * 1 = filled, 0 = empty
 */
const DIGIT_PATTERNS: DigitPattern[] = [
    {
        digit: 1,
        pattern: [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 2,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
        ],
    },
    {
        digit: 3,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 4,
        pattern: [
            [0, 0, 0, 1, 0],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 1, 0],
            [1, 0, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0],
        ],
    },
    {
        digit: 5,
        pattern: [
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 6,
        pattern: [
            [0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 7,
        pattern: [
            [1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0],
        ],
    },
    {
        digit: 8,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 9,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 1, 1, 0, 0],
        ],
    },
    {
        digit: 0,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
];

/**
 * Extract a region from image data
 */
function extractRegion(
    imageData: SimpleImageData,
    x: number,
    y: number,
    width: number,
    height: number
): SimpleImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            const srcX = x + dx;
            const srcY = y + dy;

            if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
                const srcIdx = (srcY * imageData.width + srcX) * 4;
                const dstIdx = (dy * width + dx) * 4;

                data[dstIdx] = imageData.data[srcIdx] ?? 0;
                data[dstIdx + 1] = imageData.data[srcIdx + 1] ?? 0;
                data[dstIdx + 2] = imageData.data[srcIdx + 2] ?? 0;
                data[dstIdx + 3] = imageData.data[srcIdx + 3] ?? 255;
            }
        }
    }

    return { data, width, height };
}

/**
 * Convert region to binary (black/white) image
 * Count text is typically light on dark or white on transparent
 * @internal Reserved for future digit recognition enhancements
 */
export function binarize(imageData: SimpleImageData, threshold: number = 128): boolean[][] {
    const result: boolean[][] = [];

    for (let y = 0; y < imageData.height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < imageData.width; x++) {
            const idx = (y * imageData.width + x) * 4;
            const r = imageData.data[idx] ?? 0;
            const g = imageData.data[idx + 1] ?? 0;
            const b = imageData.data[idx + 2] ?? 0;
            const gray = (r + g + b) / 3;
            row.push(gray > threshold);
        }
        result.push(row);
    }

    return result;
}

/**
 * Find bright (white/yellow) text pixels - typical for count overlays
 */
function findBrightTextPixels(imageData: SimpleImageData): boolean[][] {
    const result: boolean[][] = [];

    for (let y = 0; y < imageData.height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < imageData.width; x++) {
            const idx = (y * imageData.width + x) * 4;
            const r = imageData.data[idx] ?? 0;
            const g = imageData.data[idx + 1] ?? 0;
            const b = imageData.data[idx + 2] ?? 0;

            // Look for white, light gray, yellow, or light text
            const isWhite = r > 200 && g > 200 && b > 200;
            const isYellow = r > 200 && g > 180 && b < 100;
            const isLight = (r + g + b) / 3 > 180;

            row.push(isWhite || isYellow || isLight);
        }
        result.push(row);
    }

    return result;
}

/**
 * Resize binary image to target size using nearest neighbor
 */
function resizeBinary(binary: boolean[][], targetWidth: number, targetHeight: number): boolean[][] {
    const srcHeight = binary.length;
    const srcWidth = binary[0]?.length ?? 0;

    if (srcWidth === 0 || srcHeight === 0) {
        return Array(targetHeight)
            .fill(null)
            .map(() => Array(targetWidth).fill(false));
    }

    const result: boolean[][] = [];

    for (let y = 0; y < targetHeight; y++) {
        const row: boolean[] = [];
        const srcY = Math.floor((y * srcHeight) / targetHeight);

        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor((x * srcWidth) / targetWidth);
            row.push(binary[srcY]?.[srcX] ?? false);
        }
        result.push(row);
    }

    return result;
}

/**
 * Calculate match score between binary image and digit pattern
 */
function matchPattern(binary: boolean[][], pattern: number[][]): number {
    const patternHeight = pattern.length;
    const patternWidth = pattern[0]?.length ?? 0;

    // Resize binary to pattern size
    const resized = resizeBinary(binary, patternWidth, patternHeight);

    let matches = 0;
    let total = 0;

    for (let y = 0; y < patternHeight; y++) {
        for (let x = 0; x < patternWidth; x++) {
            const expected = (pattern[y]?.[x] ?? 0) === 1;
            const actual = resized[y]?.[x] ?? false;

            if (expected === actual) {
                matches++;
            }
            total++;
        }
    }

    return matches / total;
}

/**
 * Find connected components in binary image (for digit segmentation)
 */
function findComponents(binary: boolean[][]): { x: number; y: number; width: number; height: number }[] {
    const height = binary.length;
    const width = binary[0]?.length ?? 0;
    const visited = Array(height)
        .fill(null)
        .map(() => Array(width).fill(false));
    const components: { x: number; y: number; width: number; height: number }[] = [];

    for (let startY = 0; startY < height; startY++) {
        for (let startX = 0; startX < width; startX++) {
            if (binary[startY]?.[startX] && !visited[startY]?.[startX]) {
                // BFS to find component bounds
                let minX = startX,
                    maxX = startX;
                let minY = startY,
                    maxY = startY;
                const queue: [number, number][] = [[startX, startY]];
                const visitedRow = visited[startY];
                if (visitedRow) visitedRow[startX] = true;

                while (queue.length > 0) {
                    const coord = queue.shift()!;
                    const x = coord[0];
                    const y = coord[1];

                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);

                    // Check neighbors
                    const neighbors = [
                        [-1, 0],
                        [1, 0],
                        [0, -1],
                        [0, 1],
                    ] as const;
                    for (const delta of neighbors) {
                        const nx = x + delta[0];
                        const ny = y + delta[1];

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (binary[ny]?.[nx] && !visited[ny]?.[nx]) {
                                if (visited[ny]) visited[ny][nx] = true;
                                queue.push([nx, ny]);
                            }
                        }
                    }
                }

                const compWidth = maxX - minX + 1;
                const compHeight = maxY - minY + 1;

                // Filter out noise (too small or too large)
                if (compWidth >= 3 && compHeight >= 5 && compWidth <= width / 2) {
                    components.push({ x: minX, y: minY, width: compWidth, height: compHeight });
                }
            }
        }
    }

    // Sort left to right
    components.sort((a, b) => a.x - b.x);

    return components;
}

/**
 * Extract sub-region from binary image
 */
function extractBinaryRegion(binary: boolean[][], x: number, y: number, width: number, height: number): boolean[][] {
    const result: boolean[][] = [];

    for (let dy = 0; dy < height; dy++) {
        const row: boolean[] = [];
        for (let dx = 0; dx < width; dx++) {
            row.push(binary[y + dy]?.[x + dx] ?? false);
        }
        result.push(row);
    }

    return result;
}

/**
 * Recognize a digit from binary image
 */
function recognizeDigit(binary: boolean[][]): { digit: number; confidence: number } | null {
    let bestMatch = -1;
    let bestScore = 0;

    for (const { digit, pattern } of DIGIT_PATTERNS) {
        const score = matchPattern(binary, pattern);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = digit;
        }
    }

    if (bestScore < 0.5) {
        return null;
    }

    return { digit: bestMatch, confidence: bestScore };
}

/**
 * Check if region contains an "x" prefix (as in "x3")
 */
function hasXPrefix(binary: boolean[][]): boolean {
    const height = binary.length;
    const width = binary[0]?.length ?? 0;

    if (width < 5 || height < 5) return false;

    // Look for diagonal patterns characteristic of "x"
    let diagonalCount = 0;
    const midY = Math.floor(height / 2);
    const midX = Math.floor(width / 2);

    // Check for \ diagonal
    for (let i = -2; i <= 2; i++) {
        const y = midY + i;
        const x = midX + i;
        if (y >= 0 && y < height && x >= 0 && x < width) {
            if (binary[y]?.[x]) diagonalCount++;
        }
    }

    // Check for / diagonal
    for (let i = -2; i <= 2; i++) {
        const y = midY + i;
        const x = midX - i;
        if (y >= 0 && y < height && x >= 0 && x < width) {
            if (binary[y]?.[x]) diagonalCount++;
        }
    }

    return diagonalCount >= 6;
}

/**
 * Detect item count in a cell
 */
export function detectCount(
    imageData: SimpleImageData,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    screenHeight: number = 1080
): CountDetectionResult {
    // Get the count text region
    const region = getCountTextRegion(cellX, cellY, cellWidth, cellHeight, screenHeight);

    // Make sure region is within image bounds
    const clampedRegion = {
        x: Math.max(0, Math.min(region.x, imageData.width - 1)),
        y: Math.max(0, Math.min(region.y, imageData.height - 1)),
        width: Math.min(region.width, imageData.width - region.x),
        height: Math.min(region.height, imageData.height - region.y),
    };

    if (clampedRegion.width < 3 || clampedRegion.height < 3) {
        return {
            count: 1,
            confidence: 0,
            rawText: '',
            region: clampedRegion,
            method: 'none',
        };
    }

    // Extract the region
    const regionData = extractRegion(
        imageData,
        clampedRegion.x,
        clampedRegion.y,
        clampedRegion.width,
        clampedRegion.height
    );

    // Find bright text pixels
    const binary = findBrightTextPixels(regionData);

    // Find connected components (potential digits)
    const components = findComponents(binary);

    if (components.length === 0) {
        return {
            count: 1,
            confidence: 0,
            rawText: '',
            region: clampedRegion,
            method: 'none',
        };
    }

    // Try to recognize digits
    let digits: number[] = [];
    let totalConfidence = 0;
    let hasX = false;

    for (const comp of components) {
        const compBinary = extractBinaryRegion(binary, comp.x, comp.y, comp.width, comp.height);

        // Check for "x" prefix
        if (!hasX && hasXPrefix(compBinary)) {
            hasX = true;
            continue;
        }

        // Try to recognize as digit
        const result = recognizeDigit(compBinary);
        if (result) {
            digits.push(result.digit);
            totalConfidence += result.confidence;
        }
    }

    if (digits.length === 0) {
        return {
            count: 1,
            confidence: 0,
            rawText: hasX ? 'x?' : '',
            region: clampedRegion,
            method: 'none',
        };
    }

    // Combine digits into number
    let count = 0;
    for (const d of digits) {
        count = count * 10 + d;
    }

    // Sanity check - counts are typically 1-99
    if (count < 1 || count > 99) {
        count = 1;
        totalConfidence = 0;
    }

    const avgConfidence = totalConfidence / digits.length;

    return {
        count,
        confidence: avgConfidence,
        rawText: (hasX ? 'x' : '') + digits.join(''),
        region: clampedRegion,
        method: 'pattern',
    };
}

/**
 * Quick check if a cell likely has a count overlay
 * Faster than full detection, useful for filtering
 */
export function hasCountOverlay(
    imageData: SimpleImageData,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    screenHeight: number = 1080
): boolean {
    const region = getCountTextRegion(cellX, cellY, cellWidth, cellHeight, screenHeight);

    // Check for bright pixels in count region
    let brightCount = 0;
    const threshold = 0.1; // 10% bright pixels suggests text

    for (let y = region.y; y < region.y + region.height && y < imageData.height; y++) {
        for (let x = region.x; x < region.x + region.width && x < imageData.width; x++) {
            const idx = (y * imageData.width + x) * 4;
            const r = imageData.data[idx] ?? 0;
            const g = imageData.data[idx + 1] ?? 0;
            const b = imageData.data[idx + 2] ?? 0;

            if (r > 200 && g > 200 && b > 200) {
                brightCount++;
            }
        }
    }

    const regionSize = region.width * region.height;
    return brightCount / regionSize > threshold;
}

/**
 * Batch detect counts for multiple cells
 */
export function detectCounts(
    imageData: SimpleImageData,
    cells: Array<{ x: number; y: number; width: number; height: number }>,
    screenHeight: number = 1080
): CountDetectionResult[] {
    return cells.map(cell => detectCount(imageData, cell.x, cell.y, cell.width, cell.height, screenHeight));
}

/**
 * Common stack sizes in the game
 * Used to validate and correct detected counts
 */
export const COMMON_STACK_SIZES = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 99];

/**
 * Correct potentially misread count to nearest common stack size
 */
export function correctToCommonStack(count: number, confidence: number): number {
    // High confidence - trust the detection
    if (confidence > 0.8) return count;

    // Low confidence - check if close to common value
    for (const common of COMMON_STACK_SIZES) {
        if (Math.abs(count - common) <= 1) {
            return common;
        }
    }

    return count;
}
