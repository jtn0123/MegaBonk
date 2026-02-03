/**
 * Visual Regression Tests for CV Debug Overlays
 * Tests that debug visualizations render correctly
 */

/* global Image */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-screenshots');

// Check if dev server is running before all tests
let serverAvailable = false;
test.beforeAll(async () => {
    try {
        const response = await fetch('http://localhost:5173', { method: 'HEAD' });
        serverAvailable = response.ok || response.status === 200 || response.status === 304;
    } catch {
        serverAvailable = false;
        console.log('Dev server not running at localhost:5173 - CV visual regression tests will be skipped');
    }
});

test.describe('CV Debug Overlay Visual Regression', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Skip if server not available
        if (!serverAvailable) {
            testInfo.skip();
            return;
        }

        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');

        await page.waitForFunction(
            () => {
                return window.allData && window.allData.items && window.allData.items.length > 0;
            },
            { timeout: 10000 }
        );
    });

    test('should render debug overlay with grid visualization', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        // Enable debug mode and run detection
        const debugCanvas = await page.evaluate(async imageDataUrl => {
            // Initialize CV
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            // Enable debug mode
            if (window.cvDebug) {
                window.cvDebug.enable();
            }

            // Load image
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            // Run detection
            await window.detectItemsWithCV(img);

            // Create debug overlay
            if (window.createDebugOverlay) {
                const canvas = window.createDebugOverlay(img);
                return {
                    width: canvas.width,
                    height: canvas.height,
                    dataUrl: canvas.toDataURL('image/png'),
                };
            }

            return null;
        }, base64Image);

        expect(debugCanvas).not.toBeNull();
        expect(debugCanvas.width).toBeGreaterThan(0);
        expect(debugCanvas.height).toBeGreaterThan(0);
        expect(debugCanvas.dataUrl).toContain('data:image/png;base64,');

        console.log(`Debug overlay generated: ${debugCanvas.width}x${debugCanvas.height}`);
    });

    test('should render slot grid with correct cell count', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const gridInfo = await page.evaluate(async imageDataUrl => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            // Detect grid positions
            const grid = window.detectGridPositions ? window.detectGridPositions(img.width, img.height) : [];

            return {
                cellCount: grid.length,
                imageWidth: img.width,
                imageHeight: img.height,
                firstCell: grid[0] || null,
            };
        }, base64Image);

        console.log(
            `Grid detection: ${gridInfo.cellCount} cells for ${gridInfo.imageWidth}x${gridInfo.imageHeight} image`
        );

        expect(gridInfo.cellCount).toBeGreaterThan(0);
        expect(gridInfo.cellCount).toBeLessThanOrEqual(30); // Max reasonable cell count
        expect(gridInfo.firstCell).not.toBeNull();
        expect(gridInfo.firstCell.width).toBeGreaterThan(0);
        expect(gridInfo.firstCell.height).toBeGreaterThan(0);
    });

    test('should render detection boxes with confidence labels', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const detectionBoxes = await page.evaluate(async imageDataUrl => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            if (window.cvDebug) {
                window.cvDebug.enable();
            }

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            const result = await window.detectItemsWithCV(img);

            // Get debug logs with detection info
            const logs = window.cvDebug ? window.cvDebug.getLogs() : [];

            return {
                detectionCount: result.items ? result.items.length : 0,
                logsCount: logs.length,
                hasConfidenceScores: result.items
                    ? result.items.every(item => typeof item.confidence === 'number')
                    : false,
            };
        }, base64Image);

        console.log(`Detections: ${detectionBoxes.detectionCount}, Debug logs: ${detectionBoxes.logsCount}`);

        expect(detectionBoxes.detectionCount).toBeGreaterThan(0);
        expect(detectionBoxes.hasConfidenceScores).toBe(true);
    });

    test('should export debug data as JSON', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const exportedData = await page.evaluate(async imageDataUrl => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            if (window.cvDebug) {
                window.cvDebug.enable();
            }

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            await window.detectItemsWithCV(img);

            // Export debug data
            const exported = window.cvDebug ? window.cvDebug.exportLogs() : null;

            return exported;
        }, base64Image);

        expect(exportedData).not.toBeNull();
        expect(typeof exportedData).toBe('object');
        expect(exportedData.timestamp).toBeDefined();
        expect(Array.isArray(exportedData.logs)).toBe(true);

        console.log(`Exported ${exportedData.logs.length} debug log entries`);
    });

    test('should display statistics overlay', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const stats = await page.evaluate(async imageDataUrl => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            if (window.cvDebug) {
                window.cvDebug.enable();
            }

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            const result = await window.detectItemsWithCV(img);

            // Get stats
            const statsData = window.cvDebug ? window.cvDebug.getStats() : null;

            return {
                result: {
                    itemCount: result.items ? result.items.length : 0,
                    processingTime: result.processingTime || 0,
                    averageConfidence: result.averageConfidence || 0,
                },
                stats: statsData,
            };
        }, base64Image);

        expect(stats.result.itemCount).toBeGreaterThan(0);
        expect(stats.result.processingTime).toBeGreaterThan(0);
        expect(stats.result.averageConfidence).toBeGreaterThan(0);

        console.log(`Detection stats:`, stats.result);
        console.log(`Debug stats available:`, stats.stats !== null);
    });
});
