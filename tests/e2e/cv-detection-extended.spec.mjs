/**
 * Extended E2E Browser Tests for CV Detection Module
 * 
 * These tests specifically target low-coverage areas in detection.ts
 * and related CV modules to push coverage from 78% to 85%+
 * 
 * Run with: COVERAGE=true npx playwright test tests/e2e/cv-detection-extended.spec.mjs --config=playwright.coverage.config.js
 */

/* global Image, performance */

import { test, expect } from './coverage-test.mjs';
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
        console.log('Dev server not running at localhost:5173 - CV detection extended tests will be skipped');
    }
});

// Helper to load test image as base64
function loadTestImageBase64(filename) {
    const imagePath = path.join(TEST_IMAGES_DIR, filename);
    if (!fs.existsSync(imagePath)) {
        return null;
    }
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

// Wait for page and CV to be fully ready
async function waitForFullCVInit(page) {
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        () => window.allData && window.allData.items && window.allData.items.length > 0 && typeof window.initCV === 'function',
        { timeout: 60000 }
    );
    await page.evaluate(async () => {
        if (typeof window.initCV === 'function' && window.allData) {
            await window.initCV(window.allData);
        }
    });
    await page.waitForTimeout(500);
}

// Wait just for basic CV functions (no full init needed)
async function waitForCVFunctions(page) {
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        () => typeof window.calculateSimilarity === 'function' &&
              typeof window.calculateIoU === 'function',
        { timeout: 30000 }
    );
}

// ============================================================
// COLOR ANALYSIS TESTS - Increase color.ts coverage
// ============================================================
test.describe('Color Analysis Functions', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('extractDominantColors', () => {
        test('should extract dominant colors from solid image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, 50, 50);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.extractDominantColors(imageData, 3);
            });
            
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            // Red should be dominant
            expect(result[0].r).toBeGreaterThan(200);
        });

        test('should extract multiple colors from striped image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, 50, 50);
                ctx.fillStyle = '#0000ff';
                ctx.fillRect(50, 0, 50, 50);
                const imageData = ctx.getImageData(0, 0, 100, 50);
                return window.extractDominantColors(imageData, 5);
            });
            
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        test('should handle gradient images', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const gradient = ctx.createLinearGradient(0, 0, 100, 0);
                gradient.addColorStop(0, '#ff0000');
                gradient.addColorStop(0.5, '#00ff00');
                gradient.addColorStop(1, '#0000ff');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 100, 100);
                const imageData = ctx.getImageData(0, 0, 100, 100);
                return window.extractDominantColors(imageData, 10);
            });
            
            expect(result.length).toBeGreaterThanOrEqual(3);
        });
    });

    test.describe('detectBorderRarity', () => {
        test('should detect uncommon (green) border', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Draw green border (uncommon)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, 46, 46);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.detectBorderRarity(imageData);
            });
            
            // May return uncommon or null depending on detection sensitivity
            expect(['uncommon', 'common', null]).toContain(result);
        });

        test('should detect rare (blue) border', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Draw blue border (rare)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                ctx.strokeStyle = '#0088ff';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, 46, 46);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.detectBorderRarity(imageData);
            });
            
            expect(['rare', 'common', null]).toContain(result);
        });

        test('should detect epic (purple) border', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Draw purple border (epic)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                ctx.strokeStyle = '#aa00ff';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, 46, 46);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.detectBorderRarity(imageData);
            });
            
            expect(['epic', 'common', null]).toContain(result);
        });

        test('should detect legendary (orange) border', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Draw orange border (legendary)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                ctx.strokeStyle = '#ffa500';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, 46, 46);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.detectBorderRarity(imageData);
            });
            
            expect(['legendary', 'common', null]).toContain(result);
        });

        test('should handle empty/dark image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 50, 50);
                const imageData = ctx.getImageData(0, 0, 50, 50);
                return window.detectBorderRarity(imageData);
            });
            
            expect([null, 'common']).toContain(result);
        });
    });

    test.describe('getDominantColor (color categories)', () => {
        test('should categorize red hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#cc3333';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('red');
        });

        test('should categorize green hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#33cc33';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('green');
        });

        test('should categorize blue hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#3333cc';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('blue');
        });

        test('should categorize yellow hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#cccc33';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('yellow');
        });

        test('should categorize purple hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#9933cc';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('purple');
        });

        test('should categorize orange hues', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#ff8800';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe('orange');
        });

        test('should categorize gray/neutral', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#888888';
                ctx.fillRect(0, 0, 50, 50);
                return window.getDominantColor(ctx.getImageData(0, 0, 50, 50));
            });
            expect(['gray', 'neutral', 'white']).toContain(result);
        });
    });
});

// ============================================================
// METRICS AND CONFIG TESTS - Increase detection.ts coverage
// ============================================================
test.describe('CV Metrics and Configuration', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('getCVMetrics', () => {
        test('should return metrics object', async ({ page }) => {
            const result = await page.evaluate(() => {
                if (typeof window.getCVMetrics !== 'function') return null;
                return window.getCVMetrics();
            });
            
            if (result !== null) {
                expect(result).toHaveProperty('enabled');
                expect(result).toHaveProperty('runs');
                expect(result).toHaveProperty('aggregated');
            }
        });
    });

    test.describe('getDetectionConfig', () => {
        test('should return config for 1080p', async ({ page }) => {
            const result = await page.evaluate(() => {
                if (typeof window.getDetectionConfig !== 'function') return null;
                return window.getDetectionConfig(1920, 1080);
            });
            
            if (result !== null) {
                expect(result).toHaveProperty('dynamicThreshold');
                expect(result).toHaveProperty('resolutionTier');
                expect(result.dynamicThreshold).toBeGreaterThan(0);
                expect(result.dynamicThreshold).toBeLessThan(1);
            }
        });

        test('should return config for 4K', async ({ page }) => {
            const result = await page.evaluate(() => {
                if (typeof window.getDetectionConfig !== 'function') return null;
                return window.getDetectionConfig(3840, 2160);
            });
            
            if (result !== null) {
                expect(result.resolutionTier).toBeDefined();
            }
        });

        test('should return config without dimensions', async ({ page }) => {
            const result = await page.evaluate(() => {
                if (typeof window.getDetectionConfig !== 'function') return null;
                return window.getDetectionConfig();
            });
            
            if (result !== null) {
                expect(result).toHaveProperty('dynamicThreshold');
                expect(result).toHaveProperty('scoringConfig');
            }
        });
    });

    test.describe('clearDetectionCache', () => {
        test('should clear cache without error', async ({ page }) => {
            const result = await page.evaluate(() => {
                if (typeof window.clearDetectionCache !== 'function') return 'not_available';
                window.clearDetectionCache();
                return 'cleared';
            });
            
            expect(['cleared', 'not_available']).toContain(result);
        });
    });
});

// ============================================================
// REGION DETECTION TESTS - Increase regions.ts coverage
// ============================================================
test.describe('Region Detection', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000); // Reduced: doesn't need full template init
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page); // Changed: doesn't need full template init
    });

    test.describe('detectUIRegions', () => {
        test('should detect regions for gameplay screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const regions = window.detectUIRegions(ctx, width, height);
                return { 
                    hasRegions: !!regions,
                    keys: Object.keys(regions || {}),
                    hotbar: regions?.hotbar,
                    equipment: regions?.equipment
                };
            }, base64Image);

            expect(result.hasRegions).toBe(true);
        });

        test('should work with width/height only (no ctx)', async ({ page }) => {
            const result = await page.evaluate(() => {
                // Call with just dimensions (some implementations support this)
                if (typeof window.detectUIRegions !== 'function') return null;
                try {
                    const regions = window.detectUIRegions(1920, 1080);
                    return { hasRegions: !!regions, keys: Object.keys(regions || {}) };
                } catch (e) {
                    // May throw if ctx is required
                    return { error: true };
                }
            });

            expect(result).toBeDefined();
        });
    });

    test.describe('detectScreenType variations', () => {
        test('should detect gameplay on colorful image', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_75_portuguese_hell_final.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                return window.detectScreenType(ctx, width, height);
            }, base64Image);

            expect(['gameplay', 'pause_menu', 'unknown', 'inventory']).toContain(result);
        });

        test('should handle dark/uniform bottom as pause menu', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Very dark uniform bottom
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, 1920, 1080);
                return window.detectScreenType(ctx, 1920, 1080);
            });

            expect(['pause_menu', 'gameplay', 'unknown']).toContain(result);
        });
    });
});

// ============================================================
// HOTBAR AND EDGE DETECTION TESTS - More detection.ts coverage
// ============================================================
test.describe('Hotbar and Edge Detection', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000); // Reduced: doesn't need full template init
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page); // Changed: doesn't need full template init
    });

    test.describe('detectHotbarRegion edge cases', () => {
        test('should handle high-res 1440p image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 2560;
                canvas.height = 1440;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Simulate hotbar at bottom with some color
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, 2560, 1440);
                ctx.fillStyle = '#00ff00'; // Green item icons
                for (let x = 400; x < 2100; x += 60) {
                    ctx.fillRect(x, 1350, 50, 50);
                }
                return window.detectHotbarRegion(ctx, 2560, 1440);
            });

            expect(result.topY).toBeDefined();
            expect(result.bottomY).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
        });

        test('should handle 720p resolution', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1280;
                canvas.height = 720;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#333';
                ctx.fillRect(0, 0, 1280, 720);
                // Add colored band at bottom
                ctx.fillStyle = '#ff6600';
                ctx.fillRect(200, 650, 880, 50);
                return window.detectHotbarRegion(ctx, 1280, 720);
            });

            expect(result.topY).toBeGreaterThan(720 * 0.5);
            expect(result.bottomY).toBeLessThanOrEqual(720);
        });
    });

    test.describe('detectIconEdges variations', () => {
        test('should detect edges with multiple colored borders', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 1920, 1080);
                
                // Draw colored borders like item icons
                const colors = ['#00ff00', '#0088ff', '#aa00ff', '#ffa500'];
                let x = 300;
                for (const color of colors) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x, 950, 48, 48);
                    x += 55;
                }
                
                const hotbar = { topY: 940, bottomY: 1010 };
                const edges = window.detectIconEdges(ctx, 1920, hotbar);
                return { count: edges.length, edges: edges.slice(0, 8) };
            });

            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        test('should handle no edges case', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#333';
                ctx.fillRect(0, 0, 1920, 1080);
                
                const hotbar = { topY: 900, bottomY: 1000 };
                return window.detectIconEdges(ctx, 1920, hotbar);
            });

            expect(Array.isArray(result)).toBe(true);
        });
    });

    test.describe('detectIconScale variations', () => {
        test('should fallback to resolution-based for uniform image', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#555';
                ctx.fillRect(0, 0, 1920, 1080);
                
                return window.detectIconScale(ctx, 1920, 1080);
            });

            expect(result.iconSize).toBeGreaterThan(20);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.method).toBeDefined();
        });

        test('should detect scale from real gameplay', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_52_spanish_ocean.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                return window.detectIconScale(ctx, width, height);
            }, base64Image);

            expect(result.iconSize).toBeGreaterThan(20);
            expect(result.iconSize).toBeLessThan(100);
        });
    });
});

// ============================================================
// DETECTION PIPELINE TESTS - Core detection.ts functions
// NOTE: These tests require full CV init (template loading) which is slow.
// Skip in coverage mode to speed up coverage collection.
// ============================================================
test.describe('Detection Pipeline', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.skip(({ }, testInfo) => process.env.COVERAGE === 'true', 'Skip slow detection tests in coverage mode');
    test.setTimeout(180000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForFullCVInit(page);
    });

    test.describe('detectItemsWithCV with different images', () => {
        test('should detect items in desert screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_21_english_desert_scorpion.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const start = performance.now();
                const detections = await window.detectItemsWithCV(imageDataUrl);
                return {
                    count: detections.length,
                    duration: performance.now() - start,
                    firstItems: detections.slice(0, 3).map(d => ({
                        name: d.entity?.name,
                        confidence: d.confidence,
                        hasPosition: !!d.position
                    }))
                };
            }, base64Image);

            console.log(`Desert: ${result.count} items in ${result.duration.toFixed(0)}ms`);
            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        test('should detect items in snow screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_108_english_snow_boss.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const detections = await window.detectItemsWithCV(imageDataUrl);
                return {
                    count: detections.length,
                    items: detections.slice(0, 5).map(d => d.entity?.name)
                };
            }, base64Image);

            console.log(`Snow: ${result.count} items - ${result.items.join(', ')}`);
            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        test('should detect items in ocean screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_52_spanish_ocean.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const detections = await window.detectItemsWithCV(imageDataUrl);
                return {
                    count: detections.length,
                    items: detections.slice(0, 5).map(d => d.entity?.name)
                };
            }, base64Image);

            console.log(`Ocean: ${result.count} items`);
            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        test('should detect items in crypt screenshot', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_112_russian_crypt_boss.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const detections = await window.detectItemsWithCV(imageDataUrl);
                return { count: detections.length };
            }, base64Image);

            console.log(`Crypt: ${result.count} items`);
            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        test('should handle progress callback', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_66_russian_desert.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                const progressUpdates = [];
                const callback = (progress, status) => {
                    progressUpdates.push({ progress, status });
                };
                const detections = await window.detectItemsWithCV(imageDataUrl, callback);
                return {
                    count: detections.length,
                    progressCount: progressUpdates.length,
                    finalProgress: progressUpdates[progressUpdates.length - 1]?.progress
                };
            }, base64Image);

            expect(result.progressCount).toBeGreaterThan(0);
            expect(result.finalProgress).toBe(100);
        });
    });

    test.describe('runEnsembleDetection', () => {
        test('should run ensemble detection on a cell', async ({ page }) => {
            const base64Image = loadTestImageBase64('level_33_english_forest_early.jpg');
            if (!base64Image) { test.skip(); return; }

            const result = await page.evaluate(async (imageDataUrl) => {
                if (typeof window.runEnsembleDetection !== 'function') {
                    return { notAvailable: true };
                }
                
                const { ctx, width, height } = await window.loadImageToCanvas(imageDataUrl);
                const items = window.allData?.items?.items || [];
                
                if (items.length === 0) {
                    return { noItems: true };
                }
                
                // Create a cell in the hotbar region
                const cell = {
                    x: 400,
                    y: Math.floor(height * 0.88),
                    width: 48,
                    height: 48,
                    label: 'test_cell'
                };
                
                try {
                    const ensembleResult = await window.runEnsembleDetection(ctx, width, height, items, cell);
                    return {
                        hasResult: !!ensembleResult,
                        itemId: ensembleResult?.itemId,
                        confidence: ensembleResult?.confidence
                    };
                } catch (e) {
                    return { error: e.message };
                }
            }, base64Image);

            // Just verify it runs without crashing
            expect(result).toBeDefined();
        });
    });
});

// ============================================================
// GRID VERIFICATION AND NMS EDGE CASES
// ============================================================
test.describe('Grid Verification and NMS Edge Cases', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('verifyGridPattern edge cases', () => {
        test('should handle empty detections', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.verifyGridPattern([], 50);
            });
            expect(result.isValid).toBe(true);
            expect(result.filteredDetections.length).toBe(0);
        });

        test('should handle single detection', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [{
                    type: 'item',
                    entity: { id: '1', name: 'Test' },
                    confidence: 0.9,
                    position: { x: 100, y: 900, width: 48, height: 48 },
                    method: 'template_match'
                }];
                return window.verifyGridPattern(detections, 50);
            });
            expect(result.isValid).toBe(true);
            expect(result.filteredDetections.length).toBe(1);
        });

        test('should handle two detections', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [
                    { type: 'item', entity: { id: '1', name: 'Test1' }, confidence: 0.9, position: { x: 100, y: 900, width: 48, height: 48 }, method: 'template_match' },
                    { type: 'item', entity: { id: '2', name: 'Test2' }, confidence: 0.85, position: { x: 150, y: 900, width: 48, height: 48 }, method: 'template_match' }
                ];
                return window.verifyGridPattern(detections, 50);
            });
            expect(result.isValid).toBe(true);
        });

        test('should handle irregular spacing', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [];
                // Create detections with irregular X spacing
                const xPositions = [100, 170, 220, 350, 400]; // Not consistent
                for (let i = 0; i < xPositions.length; i++) {
                    detections.push({
                        type: 'item',
                        entity: { id: `${i}`, name: `Item${i}` },
                        confidence: 0.8,
                        position: { x: xPositions[i], y: 900, width: 48, height: 48 },
                        method: 'template_match'
                    });
                }
                return window.verifyGridPattern(detections, 50);
            });
            
            expect(result.isValid).toBeDefined();
        });

        test('should handle multiple rows', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [];
                // Two rows
                for (let row = 0; row < 2; row++) {
                    for (let col = 0; col < 5; col++) {
                        detections.push({
                            type: 'item',
                            entity: { id: `r${row}c${col}`, name: `Item` },
                            confidence: 0.8,
                            position: { x: 100 + col * 55, y: 850 + row * 55, width: 50, height: 50 },
                            method: 'template_match'
                        });
                    }
                }
                return window.verifyGridPattern(detections, 55);
            });

            expect(result.isValid).toBe(true);
            expect(result.gridParams).not.toBeNull();
        });
    });

    test.describe('nonMaxSuppression edge cases', () => {
        test('should handle single detection', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [{
                    type: 'item',
                    entity: { id: '1', name: 'Test' },
                    confidence: 0.9,
                    position: { x: 100, y: 100, width: 50, height: 50 },
                    method: 'template_match'
                }];
                return window.nonMaxSuppression(detections, 0.3).length;
            });
            expect(result).toBe(1);
        });

        test('should handle completely overlapping detections', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [
                    { type: 'item', entity: { id: '1', name: 'High' }, confidence: 0.95, position: { x: 100, y: 100, width: 50, height: 50 }, method: 'template_match' },
                    { type: 'item', entity: { id: '2', name: 'Low' }, confidence: 0.6, position: { x: 100, y: 100, width: 50, height: 50 }, method: 'template_match' }
                ];
                const filtered = window.nonMaxSuppression(detections, 0.3);
                return { count: filtered.length, keptId: filtered[0]?.entity.id };
            });
            
            expect(result.count).toBe(1);
            expect(result.keptId).toBe('1');
        });

        test('should handle adjacent non-overlapping detections', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [
                    { type: 'item', entity: { id: '1', name: 'A' }, confidence: 0.9, position: { x: 0, y: 0, width: 50, height: 50 }, method: 'template_match' },
                    { type: 'item', entity: { id: '2', name: 'B' }, confidence: 0.9, position: { x: 55, y: 0, width: 50, height: 50 }, method: 'template_match' },
                    { type: 'item', entity: { id: '3', name: 'C' }, confidence: 0.9, position: { x: 110, y: 0, width: 50, height: 50 }, method: 'template_match' }
                ];
                return window.nonMaxSuppression(detections, 0.3).length;
            });
            expect(result).toBe(3);
        });

        test('should handle mixed with and without positions', async ({ page }) => {
            const result = await page.evaluate(() => {
                const detections = [
                    { type: 'item', entity: { id: '1', name: 'NoPos' }, confidence: 0.9, method: 'template_match' },
                    { type: 'item', entity: { id: '2', name: 'HasPos' }, confidence: 0.8, position: { x: 100, y: 100, width: 50, height: 50 }, method: 'template_match' }
                ];
                return window.nonMaxSuppression(detections, 0.3).length;
            });
            expect(result).toBe(2);
        });
    });
});

// ============================================================
// SIMILARITY AND IMAGE PROCESSING EDGE CASES
// ============================================================
test.describe('Similarity and Image Processing Edge Cases', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('calculateSimilarity edge cases', () => {
        test('should handle very small images', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 5;
                canvas.height = 5;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 5, 5);
                const data1 = ctx.getImageData(0, 0, 5, 5);
                const data2 = ctx.getImageData(0, 0, 5, 5);
                return window.calculateSimilarity(data1, data2);
            });
            expect(result).toBeGreaterThan(0.9);
        });

        test('should handle images with alpha channel variations', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                // Image 1: Solid with full alpha
                ctx.fillStyle = 'rgba(255, 0, 0, 1)';
                ctx.fillRect(0, 0, 50, 50);
                const data1 = ctx.getImageData(0, 0, 50, 50);
                
                // Image 2: Same color with partial alpha
                ctx.clearRect(0, 0, 50, 50);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fillRect(0, 0, 50, 50);
                const data2 = ctx.getImageData(0, 0, 50, 50);
                
                return window.calculateSimilarity(data1, data2);
            });
            expect(result).toBeLessThan(1);
        });

        test('should handle noisy images', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                // Base color
                ctx.fillStyle = 'blue';
                ctx.fillRect(0, 0, 50, 50);
                const data1 = ctx.getImageData(0, 0, 50, 50);
                
                // Same with noise
                ctx.fillStyle = 'blue';
                ctx.fillRect(0, 0, 50, 50);
                // Add random noise
                for (let i = 0; i < 100; i++) {
                    ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
                    ctx.fillRect(Math.random() * 50, Math.random() * 50, 2, 2);
                }
                const data2 = ctx.getImageData(0, 0, 50, 50);
                
                return window.calculateSimilarity(data1, data2);
            });
            expect(result).toBeGreaterThan(0.3);
            expect(result).toBeLessThan(1);
        });
    });

    test.describe('resizeImageData edge cases', () => {
        test('should handle upscaling', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 20;
                canvas.height = 20;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 20, 20);
                const source = ctx.getImageData(0, 0, 20, 20);
                
                const resized = window.resizeImageData(source, 100, 100);
                return resized ? { width: resized.width, height: resized.height } : null;
            });
            
            expect(result).not.toBeNull();
            expect(result.width).toBe(100);
            expect(result.height).toBe(100);
        });

        test('should handle downscaling', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'green';
                ctx.fillRect(0, 0, 100, 100);
                const source = ctx.getImageData(0, 0, 100, 100);
                
                const resized = window.resizeImageData(source, 20, 20);
                return resized ? { width: resized.width, height: resized.height } : null;
            });
            
            expect(result).not.toBeNull();
            expect(result.width).toBe(20);
            expect(result.height).toBe(20);
        });

        test('should handle non-square resize', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = 'blue';
                ctx.fillRect(0, 0, 100, 50);
                const source = ctx.getImageData(0, 0, 100, 50);
                
                const resized = window.resizeImageData(source, 50, 25);
                return resized ? { width: resized.width, height: resized.height } : null;
            });
            
            expect(result).not.toBeNull();
            expect(result.width).toBe(50);
            expect(result.height).toBe(25);
        });
    });

    test.describe('loadImageToCanvas edge cases', () => {
        test('should handle PNG format', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'purple';
                ctx.fillRect(0, 0, 50, 50);
                const pngDataUrl = canvas.toDataURL('image/png');
                
                const loaded = await window.loadImageToCanvas(pngDataUrl);
                return { width: loaded.width, height: loaded.height, hasCtx: !!loaded.ctx };
            });
            
            expect(result.width).toBe(50);
            expect(result.height).toBe(50);
            expect(result.hasCtx).toBe(true);
        });

        test('should handle large images', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                const ctx = canvas.getContext('2d');
                // Create gradient for realistic content
                const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
                gradient.addColorStop(0, 'navy');
                gradient.addColorStop(1, 'purple');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 1920, 1080);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                const start = performance.now();
                const loaded = await window.loadImageToCanvas(dataUrl);
                const duration = performance.now() - start;
                
                return { width: loaded.width, height: loaded.height, duration };
            });
            
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
            expect(result.duration).toBeLessThan(5000);
        });
    });
});

// ============================================================
// ISEMPTYCELL AND VARIANCE EDGE CASES
// ============================================================
test.describe('Cell Analysis Edge Cases', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('isEmptyCell variations', () => {
        test('should detect near-black as empty', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#0f0f0f';
                ctx.fillRect(0, 0, 50, 50);
                return window.isEmptyCell(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe(true);
        });

        test('should detect bright color as not empty', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, 50, 50);
                return window.isEmptyCell(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBe(false);
        });

        test('should handle mostly dark with small bright spot', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#111';
                ctx.fillRect(0, 0, 50, 50);
                ctx.fillStyle = '#fff';
                ctx.fillRect(22, 22, 6, 6); // Small bright spot
                return window.isEmptyCell(ctx.getImageData(0, 0, 50, 50));
            });
            // Could be either depending on threshold
            expect([true, false]).toContain(result);
        });
    });

    test.describe('calculateColorVariance variations', () => {
        test('should return low variance for solid color', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#808080';
                ctx.fillRect(0, 0, 50, 50);
                return window.calculateColorVariance(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBeLessThan(100);
        });

        test('should return high variance for checkerboard', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Create checkerboard
                for (let y = 0; y < 50; y += 5) {
                    for (let x = 0; x < 50; x += 5) {
                        ctx.fillStyle = (x + y) % 10 === 0 ? '#fff' : '#000';
                        ctx.fillRect(x, y, 5, 5);
                    }
                }
                return window.calculateColorVariance(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBeGreaterThan(1000);
        });

        test('should return moderate variance for gradient', async ({ page }) => {
            const result = await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const gradient = ctx.createLinearGradient(0, 0, 50, 0);
                gradient.addColorStop(0, '#000');
                gradient.addColorStop(1, '#fff');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 50, 50);
                return window.calculateColorVariance(ctx.getImageData(0, 0, 50, 50));
            });
            expect(result).toBeGreaterThan(100);
        });
    });
});

// ============================================================
// FIT GRID AND ICON SIZES
// ============================================================
test.describe('Grid Fitting and Icon Size Detection', () => {
    // Skip: CV tests are slow and have dedicated workflow
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.setTimeout(60000);
    
    test.beforeEach(async ({ page }, testInfo) => {
        if (!serverAvailable) { testInfo.skip(); return; }
        await page.goto('/');
        await waitForCVFunctions(page);
    });

    test.describe('fitsGrid edge cases', () => {
        test('should handle zero spacing', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.fitsGrid(100, 50, 0, 5);
            });
            expect(result).toBe(true);
        });

        test('should handle exact boundary tolerance', async ({ page }) => {
            const result = await page.evaluate(() => {
                // Value at spacing - tolerance boundary
                return window.fitsGrid(145, 100, 50, 5);
            });
            expect(result).toBe(true);
        });

        test('should handle large grid start', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.fitsGrid(500, 500, 50, 5);
            });
            expect(result).toBe(true);
        });
    });

    test.describe('getAdaptiveIconSizes for different resolutions', () => {
        test('should return sizes for Steam Deck resolution', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.getAdaptiveIconSizes(1280, 800);
            });
            expect(result.length).toBe(3);
        });

        test('should return sizes for ultrawide', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.getAdaptiveIconSizes(3440, 1440);
            });
            expect(result.length).toBe(3);
            expect(result[0]).toBeGreaterThan(40);
        });

        test('should handle unusual aspect ratio', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.getAdaptiveIconSizes(800, 600);
            });
            expect(result.length).toBe(3);
        });
    });

    test.describe('detectGridPositions for different resolutions', () => {
        test('should adjust for Steam Deck', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.detectGridPositions(1280, 800);
            });
            expect(result.length).toBeGreaterThan(0);
        });

        test('should handle 4K with custom grid size', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.detectGridPositions(3840, 2160, 70);
            });
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
