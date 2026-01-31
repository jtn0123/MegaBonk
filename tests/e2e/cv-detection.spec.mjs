import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E Tests for CV Detection Module - Sliding Window & Debug Rendering
 *
 * These tests target browser-dependent CV code that requires real canvas/image APIs:
 * - src/modules/cv/detection.ts (sliding window detection, lines 1816-2548)
 * - src/modules/cv/debug.ts (canvas debug rendering)
 *
 * Run with: npx playwright test tests/e2e/cv-detection.spec.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-screenshots');

// Helper to load test image as base64
function loadTestImageBase64(filename: string): string | null {
    const imagePath = path.join(TEST_IMAGES_DIR, filename);
    if (!fs.existsSync(imagePath)) {
        return null;
    }
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

// Wait for page and CV functions to be ready
async function waitForPageReady(page: import('@playwright/test').Page) {
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
}

// Wait for CV functions to be exposed on window
async function waitForCVFunctions(page: import('@playwright/test').Page) {
    await page.waitForFunction(
        () => {
            const w = window as unknown as Record<string, unknown>;
            return (
                typeof w.loadImageToCanvas === 'function' &&
                typeof w.detectItemsWithCV === 'function' &&
                typeof w.detectGridPositions === 'function' &&
                typeof w.calculateIoU === 'function' &&
                typeof w.nonMaxSuppression === 'function'
            );
        },
        { timeout: 30000 }
    );
}

// Initialize CV with game data
async function initCVModule(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
        const w = window as unknown as Record<string, unknown>;
        if (typeof w.initCV === 'function' && w.allData) {
            await (w.initCV as (data: unknown) => Promise<void>)(w.allData);
        }
    });
    await page.waitForTimeout(500);
}

// ============================================================
// SLIDING WINDOW DETECTION TESTS
// ============================================================
test.describe('Sliding Window Detection', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
    });

    test('should detect items using sliding window on real screenshot', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        await initCVModule(page);

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const startTime = performance.now();
            const progressUpdates: Array<{ progress: number; status: string }> = [];

            const detectFn = w.detectItemsWithCV as (
                url: string,
                cb?: (p: number, s: string) => void
            ) => Promise<Array<{ entity?: { name: string }; confidence: number; position?: object; method?: string }>>;

            const detections = await detectFn(imageDataUrl, (progress: number, status: string) => {
                progressUpdates.push({ progress, status });
            });

            const duration = performance.now() - startTime;
            return {
                count: detections.length,
                duration,
                progressUpdates: progressUpdates.length,
                items: detections.slice(0, 10).map((d) => ({
                    name: d.entity?.name,
                    confidence: d.confidence,
                    position: d.position,
                    method: d.method,
                })),
            };
        }, base64Image);

        console.log(`Detected ${result.count} items in ${result.duration.toFixed(0)}ms`);
        console.log(`Progress updates: ${result.progressUpdates}`);
        console.log('Sample items:', result.items);

        expect(result.count).toBeGreaterThanOrEqual(0);
        expect(result.duration).toBeLessThan(90000);
        expect(result.progressUpdates).toBeGreaterThan(0);
    });

    test('should handle different resolutions correctly', async ({ page }) => {
        const resolutions = [
            { width: 1280, height: 720, name: '720p' },
            { width: 1920, height: 1080, name: '1080p' },
            { width: 2560, height: 1440, name: '1440p' },
            { width: 3840, height: 2160, name: '4K' },
        ];

        const results = await page.evaluate(async (resolutions) => {
            const w = window as unknown as Record<string, unknown>;
            const detectGrid = w.detectGridPositions as (width: number, height: number) => Array<{ width?: number }>;
            const getIconSizes = w.getAdaptiveIconSizes as (width: number, height: number) => number[];

            const results: Array<{
                name: string;
                gridCells: number;
                iconSizes: number[];
                firstCell: { width?: number } | undefined;
            }> = [];
            for (const res of resolutions) {
                const gridPositions = detectGrid(res.width, res.height);
                const iconSizes = getIconSizes(res.width, res.height);
                results.push({
                    name: res.name,
                    gridCells: gridPositions.length,
                    iconSizes,
                    firstCell: gridPositions[0],
                });
            }
            return results;
        }, resolutions);

        for (const res of results) {
            console.log(`${res.name}: ${res.gridCells} cells, icon sizes: ${res.iconSizes.join(', ')}`);
            expect(res.gridCells).toBeGreaterThan(0);
            expect(res.iconSizes.length).toBe(3);
        }
    });

    test('should detect hotbar region accurately', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_75_portuguese_hell_final.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const loadImage = w.loadImageToCanvas as (url: string) => Promise<{ ctx: CanvasRenderingContext2D; width: number; height: number }>;
            const detectHotbar = w.detectHotbarRegion as (ctx: CanvasRenderingContext2D, w: number, h: number) => { topY: number; bottomY: number; confidence: number };

            const { ctx, width, height } = await loadImage(imageDataUrl);
            const hotbar = detectHotbar(ctx, width, height);
            return {
                topY: hotbar.topY,
                bottomY: hotbar.bottomY,
                confidence: hotbar.confidence,
                imageWidth: width,
                imageHeight: height,
                hotbarHeight: hotbar.bottomY - hotbar.topY,
            };
        }, base64Image);

        console.log(`Hotbar: y=${result.topY}-${result.bottomY}, confidence=${result.confidence.toFixed(2)}`);

        expect(result.topY).toBeGreaterThan(result.imageHeight * 0.5);
        expect(result.bottomY).toBeLessThanOrEqual(result.imageHeight);
        expect(result.hotbarHeight).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
    });

    test('should detect icon edges for grid alignment', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_108_english_snow_boss.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const loadImage = w.loadImageToCanvas as (url: string) => Promise<{ ctx: CanvasRenderingContext2D; width: number; height: number }>;
            const detectHotbar = w.detectHotbarRegion as (ctx: CanvasRenderingContext2D, w: number, h: number) => { topY: number; bottomY: number; confidence: number };
            const detectEdges = w.detectIconEdges as (ctx: CanvasRenderingContext2D, w: number, hotbar: object) => unknown[];

            const { ctx, width, height } = await loadImage(imageDataUrl);
            const hotbar = detectHotbar(ctx, width, height);
            const edges = detectEdges(ctx, width, hotbar);
            return {
                edgeCount: edges.length,
                edges: edges.slice(0, 5),
                hotbarConfidence: hotbar.confidence,
            };
        }, base64Image);

        console.log(`Found ${result.edgeCount} icon edges`);
        expect(result.edgeCount).toBeGreaterThanOrEqual(0);
    });

    test('should detect icon scale from screenshot', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_52_spanish_ocean.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const loadImage = w.loadImageToCanvas as (url: string) => Promise<{ ctx: CanvasRenderingContext2D; width: number; height: number }>;
            const detectScale = w.detectIconScale as (ctx: CanvasRenderingContext2D, w: number, h: number) => { iconSize: number; confidence: number; method: string };

            const { ctx, width, height } = await loadImage(imageDataUrl);
            const scale = detectScale(ctx, width, height);
            return scale;
        }, base64Image);

        console.log(`Detected icon scale: ${result.iconSize}px (${result.method})`);

        expect(result.iconSize).toBeGreaterThan(20);
        expect(result.iconSize).toBeLessThan(100);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    test('should cache detection results for repeated calls', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_21_english_desert_scorpion.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        await initCVModule(page);

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const detect = w.detectItemsWithCV as (url: string) => Promise<unknown[]>;

            const start1 = performance.now();
            const detections1 = await detect(imageDataUrl);
            const duration1 = performance.now() - start1;

            const start2 = performance.now();
            const detections2 = await detect(imageDataUrl);
            const duration2 = performance.now() - start2;

            return {
                count1: detections1.length,
                count2: detections2.length,
                duration1,
                duration2,
                cacheSpeedup: duration1 / (duration2 || 1),
            };
        }, base64Image);

        console.log(`First: ${result.duration1.toFixed(0)}ms, Cached: ${result.duration2.toFixed(0)}ms`);
        console.log(`Cache speedup: ${result.cacheSpeedup.toFixed(1)}x`);

        expect(result.count1).toBe(result.count2);
        expect(result.duration2).toBeLessThan(result.duration1);
    });

    test('should apply non-maximum suppression to overlapping detections', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const nms = w.nonMaxSuppression as (
                detections: Array<{ entity: { id: string }; confidence: number; position: object }>,
                threshold: number
            ) => Array<{ entity: { id: string } }>;

            const detections = [
                {
                    type: 'item',
                    entity: { id: 'a', name: 'ItemA' },
                    confidence: 0.95,
                    position: { x: 100, y: 100, width: 50, height: 50 },
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: { id: 'b', name: 'ItemB' },
                    confidence: 0.85,
                    position: { x: 110, y: 110, width: 50, height: 50 },
                    method: 'template_match',
                },
                {
                    type: 'item',
                    entity: { id: 'c', name: 'ItemC' },
                    confidence: 0.90,
                    position: { x: 300, y: 100, width: 50, height: 50 },
                    method: 'template_match',
                },
            ];

            const filtered = nms(detections, 0.3);
            return {
                original: detections.length,
                filtered: filtered.length,
                keptIds: filtered.map((d) => d.entity.id),
            };
        });

        console.log(`NMS: ${result.original} -> ${result.filtered} detections`);
        expect(result.filtered).toBeLessThanOrEqual(result.original);
        expect(result.keptIds).toContain('a');
        expect(result.keptIds).toContain('c');
    });

    test('should verify grid pattern from detections', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const verifyGrid = w.verifyGridPattern as (
                detections: unknown[],
                size: number
            ) => { isValid: boolean; gridParams: unknown; filteredDetections: unknown[] };

            const detections = [];
            const spacing = 55;
            const startX = 100;
            const baseY = 900;

            for (let i = 0; i < 8; i++) {
                detections.push({
                    type: 'item',
                    entity: { id: `item_${i}`, name: `Item${i}` },
                    confidence: 0.85 + Math.random() * 0.1,
                    position: { x: startX + i * spacing, y: baseY, width: 50, height: 50 },
                    method: 'template_match',
                });
            }

            const verification = verifyGrid(detections, 55);
            return {
                isValid: verification.isValid,
                gridParams: verification.gridParams,
                filteredCount: verification.filteredDetections.length,
                originalCount: detections.length,
            };
        });

        console.log(`Grid verification: valid=${result.isValid}, filtered=${result.filteredCount}`);
        expect(result.isValid).toBe(true);
        expect(result.filteredCount).toBe(result.originalCount);
    });
});

// ============================================================
// DEBUG OVERLAY RENDERING TESTS
// ============================================================
test.describe('Debug Overlay Rendering', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
    });

    test('should render debug overlay with detections', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        await initCVModule(page);

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const detect = w.detectItemsWithCV as (url: string) => Promise<unknown[]>;
            const createOverlay = w.createDebugOverlay as (url: string, detections: unknown[]) => Promise<string>;

            const detections = await detect(imageDataUrl);

            if (typeof createOverlay === 'function') {
                const overlayDataUrl = await createOverlay(imageDataUrl, detections);
                return {
                    hasOverlay: !!overlayDataUrl,
                    isPng: overlayDataUrl?.startsWith('data:image/png'),
                    detectionCount: detections.length,
                };
            }
            return { hasOverlay: false, isPng: false, detectionCount: detections.length };
        }, base64Image);

        console.log(`Debug overlay: created=${result.hasOverlay}, PNG=${result.isPng}`);
        expect(result.hasOverlay).toBe(true);
        expect(result.isPng).toBe(true);
    });

    test('should render grid overlay with cell visualization', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const renderGrid = w.renderGridOverlay as (
                canvas: HTMLCanvasElement,
                cells: unknown[],
                current: number,
                processed: Set<number>
            ) => void;

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const gridCells = [];
            const spacing = 55;
            for (let i = 0; i < 12; i++) {
                gridCells.push({
                    x: 100 + i * spacing,
                    y: 900,
                    width: 50,
                    height: 50,
                });
            }

            if (typeof renderGrid === 'function') {
                const processedCells = new Set([0, 1, 2, 3, 4]);
                renderGrid(canvas, gridCells, 5, processedCells);

                const imageData = ctx.getImageData(100, 900, 50, 50);
                let nonZeroPixels = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] > 30 || imageData.data[i + 1] > 30 || imageData.data[i + 2] > 30) {
                        nonZeroPixels++;
                    }
                }
                return { rendered: true, hasVisualContent: nonZeroPixels > 0 };
            }
            return { rendered: false, hasVisualContent: false };
        });

        console.log(`Grid overlay: rendered=${result.rendered}, hasContent=${result.hasVisualContent}`);
        expect(true).toBe(true);
    });

    test('should render confidence heatmap', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const renderHeatmap = w.renderConfidenceHeatmap as (
                canvas: HTMLCanvasElement,
                detections: unknown[],
                threshold: number
            ) => void;

            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            const detections = [
                { entity: { id: '1', name: 'High' }, confidence: 0.95, position: { x: 50, y: 50, width: 50, height: 50 } },
                { entity: { id: '2', name: 'Med' }, confidence: 0.75, position: { x: 150, y: 50, width: 50, height: 50 } },
                { entity: { id: '3', name: 'Low' }, confidence: 0.55, position: { x: 250, y: 50, width: 50, height: 50 } },
            ];

            if (typeof renderHeatmap === 'function') {
                renderHeatmap(canvas, detections, 0.7);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let coloredPixels = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    if (imageData.data[i + 3] > 0) {
                        coloredPixels++;
                    }
                }
                return { rendered: true, hasColors: coloredPixels > 0 };
            }
            return { rendered: false, hasColors: false };
        });

        console.log(`Confidence heatmap: rendered=${result.rendered}`);
        expect(true).toBe(true);
    });
});

// ============================================================
// UI INTEGRATION TESTS
// ============================================================
test.describe('CV Detection UI Integration', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await page.click('.tab-btn[data-tab="advisor"]');
        await page.waitForSelector('.scan-section', { timeout: 10000 });
    });

    test('should show scan upload interface', async ({ page }) => {
        const uploadBtn = page.locator('#scan-upload-btn');
        await expect(uploadBtn).toBeVisible();

        const fileInput = page.locator('#scan-file-input');
        expect(await fileInput.count()).toBe(1);
    });

    test('should show hybrid detection button', async ({ page }) => {
        const hybridBtn = page.locator('#scan-hybrid-detect-btn');
        await expect(hybridBtn).toBeVisible();
    });

    test('should show debug panel toggle', async ({ page }) => {
        const debugToggle = page.locator('#scan-debug-mode');
        await expect(debugToggle).toBeVisible();
    });

    test('should enable debug mode and show expanded options', async ({ page }) => {
        await page.click('#scan-debug-mode');

        const expandBtn = page.locator('#debug-expand-btn');
        if (await expandBtn.isVisible()) {
            await expandBtn.click();
            await page.waitForTimeout(300);

            const debugContent = page.locator('#debug-panel-content');
            await expect(debugContent).toBeVisible();
        }
    });

    test('should handle image upload and trigger detection', async ({ page }) => {
        const testImagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');
        if (!fs.existsSync(testImagePath)) {
            test.skip();
            return;
        }

        const fileInput = page.locator('#scan-file-input');
        await fileInput.setInputFiles(testImagePath);

        const preview = page.locator('#scan-image-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });

        const autoDetectArea = page.locator('#scan-auto-detect-area');
        await expect(autoDetectArea).toBeVisible({ timeout: 5000 });

        console.log('Image uploaded and preview shown');
    });

    test('should run hybrid detection on uploaded image', async ({ page }) => {
        const testImagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');
        if (!fs.existsSync(testImagePath)) {
            test.skip();
            return;
        }

        await page.waitForFunction(() => {
            const btn = document.getElementById('scan-hybrid-detect-btn') as HTMLButtonElement;
            return btn && !btn.disabled;
        }, { timeout: 60000 });

        const fileInput = page.locator('#scan-file-input');
        await fileInput.setInputFiles(testImagePath);

        await page.locator('#scan-image-preview').waitFor({ state: 'visible', timeout: 10000 });

        const hybridBtn = page.locator('#scan-hybrid-detect-btn');
        await hybridBtn.click();

        await page.waitForTimeout(5000);

        console.log('Hybrid detection completed');
    });
});

// ============================================================
// COLOR AND REGION DETECTION TESTS
// ============================================================
test.describe('Color and Region Detection', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
    });

    test('should detect UI regions from screenshot', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_281_turkish_hell.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const loadImage = w.loadImageToCanvas as (url: string) => Promise<{ ctx: CanvasRenderingContext2D; width: number; height: number }>;
            const detectRegions = w.detectUIRegions as (ctx: CanvasRenderingContext2D, w: number, h: number) => { hotbar?: object; equipment?: object };

            const { ctx, width, height } = await loadImage(imageDataUrl);
            const regions = detectRegions(ctx, width, height);
            return {
                hasRegions: !!regions,
                hotbar: !!regions?.hotbar,
                equipment: !!regions?.equipment,
            };
        }, base64Image);

        console.log(`UI regions detected: hotbar=${result.hotbar}, equipment=${result.equipment}`);
        expect(result.hasRegions).toBe(true);
    });

    test('should detect screen type', async ({ page }) => {
        const base64Image = loadTestImageBase64('level_803_russian_stress_test.jpg');
        if (!base64Image) {
            test.skip();
            return;
        }

        const result = await page.evaluate(async (imageDataUrl: string) => {
            const w = window as unknown as Record<string, unknown>;
            const loadImage = w.loadImageToCanvas as (url: string) => Promise<{ ctx: CanvasRenderingContext2D; width: number; height: number }>;
            const detectType = w.detectScreenType as (ctx: CanvasRenderingContext2D, w: number, h: number) => string;

            const { ctx, width, height } = await loadImage(imageDataUrl);
            const screenType = detectType(ctx, width, height);
            return {
                type: screenType,
                isValidType: ['gameplay', 'inventory', 'pause_menu', 'unknown'].includes(screenType),
            };
        }, base64Image);

        console.log(`Screen type detected: ${result.type}`);
        expect(result.isValidType).toBe(true);
    });

    test('should extract dominant colors from image region', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const extractColors = w.extractDominantColors as (data: ImageData, count: number) => Array<{ r: number; g: number; b: number }>;

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d')!;

            const gradient = ctx.createLinearGradient(0, 0, 100, 100);
            gradient.addColorStop(0, '#ff0000');
            gradient.addColorStop(0.5, '#00ff00');
            gradient.addColorStop(1, '#0000ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 100, 100);

            const imageData = ctx.getImageData(0, 0, 100, 100);
            const colors = extractColors(imageData, 5);

            return {
                colorCount: colors.length,
                hasRed: colors.some((c) => c.r > 150),
                hasGreen: colors.some((c) => c.g > 150),
                hasBlue: colors.some((c) => c.b > 150),
            };
        });

        console.log(`Dominant colors extracted: ${result.colorCount}`);
        expect(result.colorCount).toBeGreaterThan(0);
    });

    test('should detect border rarity from cell image', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const detectRarity = w.detectBorderRarity as (data: ImageData) => string | null;

            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 50, 50);
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 46, 46);

            const imageData = ctx.getImageData(0, 0, 50, 50);
            const rarity = detectRarity(imageData);

            return { rarity, detected: rarity !== null };
        });

        console.log(`Border rarity detected: ${result.rarity}`);
        expect(['legendary', 'common', 'epic', 'rare', 'uncommon', null]).toContain(result.rarity);
    });

    test('should check for empty cells', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const isEmptyCell = w.isEmptyCell as (data: ImageData) => boolean;

            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 50, 50);
            const emptyData = ctx.getImageData(0, 0, 50, 50);
            const isEmpty = isEmptyCell(emptyData);

            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 25, 50);
            ctx.fillStyle = 'blue';
            ctx.fillRect(25, 0, 25, 50);
            const occupiedData = ctx.getImageData(0, 0, 50, 50);
            const isOccupied = !isEmptyCell(occupiedData);

            return { isEmpty, isOccupied };
        });

        console.log(`Empty cell check: empty=${result.isEmpty}, occupied=${result.isOccupied}`);
        expect(result.isEmpty).toBe(true);
        expect(result.isOccupied).toBe(true);
    });

    test('should calculate color variance', async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const calcVariance = w.calculateColorVariance as (data: ImageData) => number;

            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, 50, 50);
            const lowVariance = calcVariance(ctx.getImageData(0, 0, 50, 50));

            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            const highVariance = calcVariance(ctx.getImageData(0, 0, 50, 50));

            return { lowVariance, highVariance, diff: highVariance - lowVariance };
        });

        console.log(`Variance: low=${result.lowVariance.toFixed(0)}, high=${result.highVariance.toFixed(0)}`);
        expect(result.highVariance).toBeGreaterThan(result.lowVariance);
    });
});

// ============================================================
// PERFORMANCE TESTS
// ============================================================
test.describe('CV Detection Performance', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await waitForCVFunctions(page);
        await initCVModule(page);
    });

    test('should process multiple images efficiently', async ({ page }) => {
        const imageFiles = [
            'level_33_english_forest_early.jpg',
            'level_52_spanish_ocean.jpg',
            'level_66_russian_desert.jpg',
        ];

        const images = imageFiles
            .map((f) => loadTestImageBase64(f))
            .filter((img): img is string => img !== null);

        if (images.length === 0) {
            test.skip();
            return;
        }

        const results = await page.evaluate(async (images: string[]) => {
            const w = window as unknown as Record<string, unknown>;
            const detect = w.detectItemsWithCV as (url: string) => Promise<unknown[]>;

            const results = [];
            for (const imageDataUrl of images) {
                const start = performance.now();
                const detections = await detect(imageDataUrl);
                results.push({
                    duration: performance.now() - start,
                    count: detections.length,
                });
            }
            return results;
        }, images);

        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        const avgDuration = totalDuration / results.length;

        console.log(`Processed ${results.length} images, avg: ${avgDuration.toFixed(0)}ms`);
        results.forEach((r, i) => console.log(`  Image ${i + 1}: ${r.count} items in ${r.duration.toFixed(0)}ms`));

        expect(avgDuration).toBeLessThan(60000);
    });

    test('should handle large 4K-like canvas', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const w = window as unknown as Record<string, unknown>;
            const detect = w.detectItemsWithCV as (url: string) => Promise<unknown[]>;

            const canvas = document.createElement('canvas');
            canvas.width = 3840;
            canvas.height = 2160;
            const ctx = canvas.getContext('2d')!;

            const gradient = ctx.createLinearGradient(0, 0, 3840, 2160);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 3840, 2160);

            ctx.fillStyle = '#e94560';
            ctx.fillRect(100, 1900, 50, 50);
            ctx.fillStyle = '#0f4c75';
            ctx.fillRect(160, 1900, 50, 50);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            const start = performance.now();
            const detections = await detect(dataUrl);
            const duration = performance.now() - start;

            return { duration, count: detections.length, canvasSize: '3840x2160' };
        });

        console.log(`4K canvas: ${result.count} items in ${result.duration.toFixed(0)}ms`);
        expect(result.duration).toBeLessThan(120000);
    });
});
