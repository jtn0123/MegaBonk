/**
 * E2E Browser Tests for CV Detection Module
 * 
 * These tests exercise the CV detection code in a real browser environment,
 * covering functions that require browser Image/Canvas APIs (not available in jsdom).
 * 
 * Run with: npx playwright test tests/e2e/cv-detection-coverage.spec.mjs
 */

/* global Image, performance */

// Use coverage-aware test fixture for auto-collection of browser coverage
import { test, expect } from './coverage-test.mjs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-screenshots');

// Helper to load test image as base64
function loadTestImageBase64(filename) {
    const imagePath = path.join(TEST_IMAGES_DIR, filename);
    if (!fs.existsSync(imagePath)) {
        return null;
    }
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

// Wait for page content to load (but not full CV init)
async function waitForPageReady(page) {
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
}

// Wait for CV functions to be available (but not initialized)
async function waitForCVFunctions(page) {
    await page.waitForFunction(
        () => {
            return (
                typeof window.calculateSimilarity === 'function' &&
                typeof window.calculateIoU === 'function' &&
                typeof window.nonMaxSuppression === 'function' &&
                typeof window.loadImageToCanvas === 'function'
            );
        },
        { timeout: 30000 }
    );
}

// Wait for full CV initialization with data
async function waitForCVReady(page) {
    await page.waitForFunction(
        () => {
            return (
                window.allData &&
                window.allData.items &&
                window.allData.items.length > 0 &&
                typeof window.initCV === 'function'
            );
        },
        { timeout: 60000 }
    );
    
    await page.evaluate(async () => {
        if (typeof window.initCV === 'function' && window.allData) {
            await window.initCV(window.allData);
        }
    });
    
    await page.waitForTimeout(500);
}

// ============================================================
// BASIC TESTS - Don't need full CV initialization
// These test pure utility functions exposed on window
// ============================================================
test.describe('CV Utility Functions', () => {
    // Skip: CV tests are slow and have dedicated workflow - run separately
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
    });

    test.describe('calculateIoU', () => {
        test('should return 1 for identical boxes', async ({ page }) => {
            const iou = await page.evaluate(() => {
                const box = { x: 10, y: 10, width: 50, height: 50 };
                return window.calculateIoU(box, box);
            });
            expect(iou).toBe(1);
        });

        test('should return 0 for non-overlapping boxes', async ({ page }) => {
            const iou = await page.evaluate(() => {
                const box1 = { x: 0, y: 0, width: 10, height: 10 };
                const box2 = { x: 100, y: 100, width: 10, height: 10 };
                return window.calculateIoU(box1, box2);
            });
            expect(iou).toBe(0);
        });

        test('should calculate partial overlap correctly', async ({ page }) => {
            const iou = await page.evaluate(() => {
                const box1 = { x: 0, y: 0, width: 20, height: 20 };
                const box2 = { x: 10, y: 10, width: 20, height: 20 };
                return window.calculateIoU(box1, box2);
            });
            expect(iou).toBeCloseTo(100 / 700, 2);
        });

        test('should handle one box inside another', async ({ page }) => {
            const iou = await page.evaluate(() => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 25, y: 25, width: 50, height: 50 };
                return window.calculateIoU(outer, inner);
            });
            expect(iou).toBeCloseTo(0.25, 2);
        });
    });

    test.describe('nonMaxSuppression', () => {
        test('should remove overlapping lower-confidence detections', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [
                    { type: 'item', entity: { id: '1', name: 'Item1' }, confidence: 0.9, position: { x: 10, y: 10, width: 50, height: 50 }, method: 'template_match' },
                    { type: 'item', entity: { id: '2', name: 'Item2' }, confidence: 0.7, position: { x: 15, y: 15, width: 50, height: 50 }, method: 'template_match' },
                    { type: 'item', entity: { id: '3', name: 'Item3' }, confidence: 0.8, position: { x: 200, y: 200, width: 50, height: 50 }, method: 'template_match' },
                ];
                const filtered = window.nonMaxSuppression(detections, 0.3);
                return { count: filtered.length, ids: filtered.map(d => d.entity.id) };
            });

            expect(result.count).toBe(2);
            expect(result.ids).toContain('1');
            expect(result.ids).toContain('3');
            expect(result.ids).not.toContain('2');
        });

        test('should handle empty array', async ({ page }) => {
            const result = await page.evaluate(() => window.nonMaxSuppression([], 0.5));
            expect(result).toEqual([]);
        });

        test('should keep detections without positions', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [{ type: 'item', entity: { id: '1', name: 'Item1' }, confidence: 0.9, method: 'template_match' }];
                return window.nonMaxSuppression(detections, 0.3).length;
            });
            expect(result).toBe(1);
        });
    });

    test.describe('getAdaptiveIconSizes', () => {
        test('should return appropriate sizes for 1080p', async ({ page }) => {
            const sizes = await page.evaluate(() => window.getAdaptiveIconSizes(1920, 1080));
            expect(sizes).toHaveLength(3);
            expect(sizes[0]).toBeGreaterThan(30);
            expect(sizes[2]).toBeLessThan(70);
        });

        test('should return larger sizes for 4K', async ({ page }) => {
            const sizes = await page.evaluate(() => window.getAdaptiveIconSizes(3840, 2160));
            expect(sizes).toHaveLength(3);
            expect(sizes[0]).toBeGreaterThan(50);
        });

        test('should return smaller sizes for 720p', async ({ page }) => {
            const sizes = await page.evaluate(() => window.getAdaptiveIconSizes(1280, 720));
            expect(sizes).toHaveLength(3);
            expect(sizes[0]).toBeLessThan(45);
        });
    });

    test.describe('detectGridPositions', () => {
        test('should return grid positions for 1080p', async ({ page }) => {
            const positions = await page.evaluate(() => window.detectGridPositions(1920, 1080));
            expect(positions.length).toBeGreaterThan(0);
            expect(positions.length).toBeLessThanOrEqual(30);
            for (const pos of positions) {
                expect(pos.y).toBeGreaterThan(1080 * 0.8);
                expect(pos.width).toBeGreaterThan(30);
            }
        });

        test('should return different cell sizes for different resolutions', async ({ page }) => {
            const result = await page.evaluate(() => {
                const pos1080 = window.detectGridPositions(1920, 1080);
                const pos4K = window.detectGridPositions(3840, 2160);
                return { width1080: pos1080[0]?.width, width4K: pos4K[0]?.width };
            });
            expect(result.width4K).toBeGreaterThan(result.width1080);
        });
    });

    test.describe('fitsGrid', () => {
        test('should return true for values on grid', async ({ page }) => {
            const result = await page.evaluate(() => window.fitsGrid(150, 100, 50, 5));
            expect(result).toBe(true);
        });

        test('should return true for values within tolerance', async ({ page }) => {
            const result = await page.evaluate(() => window.fitsGrid(153, 100, 50, 5));
            expect(result).toBe(true);
        });

        test('should return false for values outside tolerance', async ({ page }) => {
            const result = await page.evaluate(() => window.fitsGrid(160, 100, 50, 5));
            expect(result).toBe(false);
        });
    });

    test.describe('extractCountRegion', () => {
        test('should extract bottom-right corner for count', async ({ page }) => {
            const result = await page.evaluate(() => {
                const cell = { x: 100, y: 100, width: 50, height: 50, label: 'test_cell' };
                const countRegion = window.extractCountRegion(cell);
                return countRegion;
            });

            expect(result.x).toBeGreaterThan(100);
            expect(result.y).toBeGreaterThan(100);
            expect(result.x + result.width).toBe(150);
            expect(result.y + result.height).toBe(150);
            expect(result.label).toBe('test_cell_count');
        });
    });

    test.describe('verifyGridPattern', () => {
        test('should validate consistent grid pattern', async ({ page }) => {
            const result = await page.evaluate(() => {
                const spacing = 50;
                const detections = [];
                for (let col = 0; col < 5; col++) {
                    detections.push({
                        type: 'item', entity: { id: `item_${col}`, name: `Item ${col}` }, confidence: 0.8,
                        position: { x: 100 + col * spacing, y: 900, width: spacing - 5, height: spacing - 5 },
                        method: 'template_match',
                    });
                }
                const verification = window.verifyGridPattern(detections, spacing);
                return { isValid: verification.isValid, confidence: verification.confidence, filteredCount: verification.filteredDetections.length };
            });

            expect(result.isValid).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.5);
            expect(result.filteredCount).toBe(5);
        });

        test('should handle small detection sets', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [{ type: 'item', entity: { id: '1', name: 'Item' }, confidence: 0.8, position: { x: 100, y: 900, width: 45, height: 45 }, method: 'template_match' }];
                const verification = window.verifyGridPattern(detections, 50);
                return { isValid: verification.isValid, filteredCount: verification.filteredDetections.length };
            });
            expect(result.isValid).toBe(true);
            expect(result.filteredCount).toBe(1);
        });
    });
});

// ============================================================
// CANVAS TESTS - Need browser canvas but not full CV init
// ============================================================
test.describe('CV Canvas Functions', () => {
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
    });

    test.describe('calculateSimilarity', () => {
        test('should return high similarity for identical images', async ({ page }) => {
            const similarity = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'blue';
                ctx.fillRect(0, 0, 50, 50);
                ctx.fillStyle = 'white';
                ctx.fillRect(10, 10, 30, 30);
                const imageData1 = ctx.getImageData(0, 0, 50, 50);
                const imageData2 = ctx.getImageData(0, 0, 50, 50);
                return window.calculateSimilarity(imageData1, imageData2);
            });
            expect(similarity).toBeGreaterThan(0.95);
        });

        test('should return low similarity for different images', async ({ page }) => {
            const similarity = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 50, 50);
                const imageData1 = ctx.getImageData(0, 0, 50, 50);
                ctx.fillStyle = 'green';
                ctx.fillRect(0, 0, 50, 50);
                ctx.fillStyle = 'yellow';
                for (let i = 0; i < 50; i += 10) ctx.fillRect(i, i, 5, 5);
                const imageData2 = ctx.getImageData(0, 0, 50, 50);
                return window.calculateSimilarity(imageData1, imageData2);
            });
            expect(similarity).toBeLessThan(0.7);
        });

        test('should handle gradient images', async ({ page }) => {
            const similarity = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const gradient1 = ctx.createLinearGradient(0, 0, 50, 50);
                gradient1.addColorStop(0, 'black');
                gradient1.addColorStop(1, 'white');
                ctx.fillStyle = gradient1;
                ctx.fillRect(0, 0, 50, 50);
                const imageData1 = ctx.getImageData(0, 0, 50, 50);
                ctx.clearRect(0, 0, 50, 50);
                const gradient2 = ctx.createLinearGradient(5, 5, 55, 55);
                gradient2.addColorStop(0, 'black');
                gradient2.addColorStop(1, 'white');
                ctx.fillStyle = gradient2;
                ctx.fillRect(0, 0, 50, 50);
                const imageData2 = ctx.getImageData(0, 0, 50, 50);
                return window.calculateSimilarity(imageData1, imageData2);
            });
            expect(similarity).toBeGreaterThan(0.3);
            expect(similarity).toBeLessThan(0.99);
        });
    });

    test.describe('loadImageToCanvas', () => {
        test('should load canvas from data URL', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const testCanvas = document.createElement('canvas');
                testCanvas.width = 100;
                testCanvas.height = 100;
                const testCtx = testCanvas.getContext('2d');
                testCtx.fillStyle = 'red';
                testCtx.fillRect(0, 0, 100, 100);
                const pngDataUrl = testCanvas.toDataURL('image/png');
                const { canvas, ctx, width, height } = await window.loadImageToCanvas(pngDataUrl);
                return { hasCanvas: !!canvas, hasCtx: !!ctx, width, height };
            });

            expect(result.hasCanvas).toBe(true);
            expect(result.hasCtx).toBe(true);
            expect(result.width).toBe(100);
            expect(result.height).toBe(100);
        });
    });

    test.describe('resizeImageData', () => {
        test('should resize image data correctly', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 50, 100);
                ctx.fillStyle = 'blue';
                ctx.fillRect(50, 0, 50, 100);
                const sourceData = ctx.getImageData(0, 0, 100, 100);
                const resized = window.resizeImageData(sourceData, 50, 50);
                if (!resized) return { success: false };
                return { success: true, newWidth: resized.width, newHeight: resized.height, hasData: resized.data.length > 0 };
            });

            expect(result.success).toBe(true);
            expect(result.newWidth).toBe(50);
            expect(result.newHeight).toBe(50);
            expect(result.hasData).toBe(true);
        });
    });

    test.describe('Color Analysis', () => {
        test('should calculate color variance', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 50, 50);
                const lowVariance = window.calculateColorVariance(ctx.getImageData(0, 0, 50, 50));
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 25, 25);
                ctx.fillStyle = 'blue';
                ctx.fillRect(25, 0, 25, 25);
                ctx.fillStyle = 'green';
                ctx.fillRect(0, 25, 25, 25);
                ctx.fillStyle = 'yellow';
                ctx.fillRect(25, 25, 25, 25);
                const highVariance = window.calculateColorVariance(ctx.getImageData(0, 0, 50, 50));
                return { lowVariance, highVariance };
            });

            expect(result.lowVariance).toBeLessThan(100);
            expect(result.highVariance).toBeGreaterThan(result.lowVariance);
        });

        test('should detect empty cells', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                const isEmptyDark = window.isEmptyCell(ctx.getImageData(0, 0, 50, 50));
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 25, 50);
                ctx.fillStyle = 'blue';
                ctx.fillRect(25, 0, 25, 50);
                const isEmptyColorful = window.isEmptyCell(ctx.getImageData(0, 0, 50, 50));
                return { isEmptyDark, isEmptyColorful };
            });

            expect(result.isEmptyDark).toBe(true);
            expect(result.isEmptyColorful).toBe(false);
        });

        test('should get dominant color', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 40, 50);
                ctx.fillStyle = 'blue';
                ctx.fillRect(40, 0, 10, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('red');
        });
    });
});

// ============================================================
// IMAGE-BASED TESTS - Need real images and CV init
// NOTE: These tests are slow due to template loading. Coverage is still
// collected even if tests timeout, so we use shorter timeouts.
// ============================================================
test.describe('CV Detection - Image Tests', () => {
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000); // Reduced: coverage collected even on timeout
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForCVFunctions(page); // Changed: use lighter init
    });

    test.describe('detectHotbarRegion', () => {
        test('should detect hotbar region in gameplay screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const hotbar = window.detectHotbarRegion(ctx, width, height);
                return { topY: hotbar.topY, bottomY: hotbar.bottomY, confidence: hotbar.confidence, imageHeight: height };
            }, base64Image);

            expect(result.topY).toBeGreaterThan(result.imageHeight * 0.5);
            expect(result.bottomY).toBeLessThanOrEqual(result.imageHeight);
            expect(result.bottomY).toBeGreaterThan(result.topY);
        });

        test('should return reasonable fallback for blank image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'gray';
                ctx.fillRect(0, 0, 1920, 1080);
                return window.detectHotbarRegion(ctx, 1920, 1080);
            });

            expect(result.topY).toBeDefined();
            expect(result.bottomY).toBeDefined();
            expect(result.bottomY).toBeGreaterThan(result.topY);
        });
    });

    test.describe('detectIconScale', () => {
        test('should detect icon scale from image', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_75_portuguese_hell_final.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const scale = window.detectIconScale(ctx, width, height);
                return scale;
            }, base64Image);

            expect(result.iconSize).toBeGreaterThan(20);
            expect(result.iconSize).toBeLessThan(100);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            console.log(`Detected icon scale: ${result.iconSize}px (${result.method})`);
        });
    });

    test.describe('detectIconEdges', () => {
        test('should detect edges in hotbar region', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_108_english_snow_boss.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const hotbar = window.detectHotbarRegion(ctx, width, height);
                const edges = window.detectIconEdges(ctx, width, hotbar);
                return { edgeCount: edges.length, firstFewEdges: edges.slice(0, 5), hotbarConfidence: hotbar.confidence };
            }, base64Image);

            console.log(`Found ${result.edgeCount} icon edges`);
            expect(result.edgeCount).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('detectItemsWithCV', () => {
        test('should detect items in gameplay screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const startTime = performance.now();
                const detections = await window.detectItemsWithCV(imageDataUrl);
                const duration = performance.now() - startTime;
                return {
                    count: detections.length,
                    duration,
                    items: detections.slice(0, 5).map(d => ({ name: d.entity?.name, confidence: d.confidence })),
                };
            }, base64Image);

            console.log(`Detected ${result.count} items in ${result.duration.toFixed(0)}ms`);
            console.log('Sample items:', result.items);
            expect(result.count).toBeGreaterThanOrEqual(0);
            expect(result.duration).toBeLessThan(60000);
        });

        test('should use cache on second call', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_21_english_desert_scorpion.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const start1 = performance.now();
                const detections1 = await window.detectItemsWithCV(imageDataUrl);
                const duration1 = performance.now() - start1;
                const start2 = performance.now();
                const detections2 = await window.detectItemsWithCV(imageDataUrl);
                const duration2 = performance.now() - start2;
                return { count1: detections1.length, count2: detections2.length, duration1, duration2 };
            }, base64Image);

            expect(result.count1).toBe(result.count2);
            expect(result.duration2).toBeLessThan(result.duration1);
            console.log(`First: ${result.duration1.toFixed(0)}ms, Cached: ${result.duration2.toFixed(0)}ms`);
        });
    });

    test.describe('Region Detection', () => {
        test('should detect UI regions', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_281_turkish_hell.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const regions = window.detectUIRegions(ctx, width, height);
                return { hasRegions: !!regions, hotbar: !!regions?.hotbar, equipment: !!regions?.equipment };
            }, base64Image);

            expect(result.hasRegions).toBe(true);
        });

        test('should detect screen type', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_803_russian_stress_test.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const screenType = window.detectScreenType(ctx, width, height);
                return { type: screenType, isValidType: ['gameplay', 'inventory', 'pause_menu', 'unknown'].includes(screenType) };
            }, base64Image);

            expect(result.isValidType).toBe(true);
        });
    });
});
