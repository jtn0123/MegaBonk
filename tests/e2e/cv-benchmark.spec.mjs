/**
 * Benchmark Tests for CV Detection Performance
 * Measures detection speed across resolutions and strategies
 */

/* global Image, performance */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-1080p');

test.describe('CV Performance Benchmarks', () => {
    // Skip: CV tests are slow and have dedicated workflow - run separately
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.waitForFunction(
            () => {
                return window.allData && window.allData.items && window.allData.items.length > 0;
            },
            { timeout: 10000 }
        );
    });

    const resolutionTests = [
        { filename: 'level_33_english_forest_early.jpg', expectedRes: '720p', maxTime: 5000 },
        { filename: 'level_21_english_desert_scorpion.jpg', expectedRes: '800p', maxTime: 5000 },
        { filename: 'level_112_russian_crypt_boss.jpg', expectedRes: '800p', maxTime: 6000 },
    ];

    for (const resTest of resolutionTests) {
        test(`should detect items within ${resTest.maxTime}ms for ${resTest.expectedRes} - ${resTest.filename}`, async ({
            page,
        }) => {
            const imagePath = path.join(TEST_IMAGES_DIR, resTest.filename);

            if (!fs.existsSync(imagePath)) {
                test.skip();
                return;
            }

            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            const benchmark = await page.evaluate(async imageDataUrl => {
                if (typeof window.initCV === 'function' && window.allData) {
                    await window.initCV(window.allData);
                }

                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageDataUrl;
                });

                const startTime = performance.now();
                const result = await window.detectItemsWithCV(img);
                const endTime = performance.now();

                return {
                    totalTime: Math.round(endTime - startTime),
                    reportedTime: result.processingTime || 0,
                    itemCount: result.items ? result.items.length : 0,
                    resolution: `${img.width}x${img.height}`,
                    averageConfidence: result.averageConfidence || 0,
                };
            }, base64Image);

            console.log(`\nBenchmark for ${resTest.filename}:`);
            console.log(`  Resolution: ${benchmark.resolution}`);
            console.log(`  Total Time: ${benchmark.totalTime}ms`);
            console.log(`  Detection Time: ${benchmark.reportedTime}ms`);
            console.log(`  Items Detected: ${benchmark.itemCount}`);
            console.log(`  Avg Confidence: ${benchmark.averageConfidence.toFixed(2)}`);

            expect(benchmark.totalTime).toBeLessThan(resTest.maxTime);
            expect(benchmark.itemCount).toBeGreaterThan(0);
        });
    }

    test('should benchmark all strategies', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const strategies = ['current', 'optimized', 'fast', 'accurate', 'balanced'];
        const results = [];

        for (const strategy of strategies) {
            const benchmark = await page.evaluate(
                async ({ imageDataUrl, strategyName }) => {
                    if (typeof window.initCV === 'function' && window.allData) {
                        await window.initCV(window.allData);
                    }

                    // Set strategy
                    if (window.setActiveStrategy) {
                        window.setActiveStrategy(strategyName);
                    }

                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = imageDataUrl;
                    });

                    const startTime = performance.now();
                    const result = await window.detectItemsWithCV(img);
                    const endTime = performance.now();

                    return {
                        strategy: strategyName,
                        totalTime: Math.round(endTime - startTime),
                        itemCount: result.items ? result.items.length : 0,
                        averageConfidence: result.averageConfidence || 0,
                    };
                },
                { imageDataUrl: base64Image, strategyName: strategy }
            );

            results.push(benchmark);
        }

        console.log('\n' + '='.repeat(60));
        console.log('STRATEGY PERFORMANCE COMPARISON');
        console.log('='.repeat(60));
        console.log('Strategy      | Time (ms) | Items | Confidence');
        console.log('-'.repeat(60));

        for (const result of results) {
            const strategyPadded = result.strategy.padEnd(13);
            const timePadded = String(result.totalTime).padStart(9);
            const itemsPadded = String(result.itemCount).padStart(5);
            const confPadded = result.averageConfidence.toFixed(2).padStart(10);

            console.log(`${strategyPadded} | ${timePadded} | ${itemsPadded} | ${confPadded}`);
        }
        console.log('='.repeat(60));

        // All strategies should detect items
        for (const result of results) {
            expect(result.itemCount).toBeGreaterThan(0);
            expect(result.totalTime).toBeLessThan(10000); // Max 10 seconds
        }

        // Fast strategy should be fastest
        const fastStrategy = results.find(r => r.strategy === 'fast');
        const accurateStrategy = results.find(r => r.strategy === 'accurate');

        if (fastStrategy && accurateStrategy) {
            expect(fastStrategy.totalTime).toBeLessThanOrEqual(accurateStrategy.totalTime);
        }
    });

    test('should benchmark detection speed scaling with item count', async ({ page }) => {
        const testImages = [
            { filename: 'level_33_english_forest_early.jpg', expectedItems: 19, category: 'Small' },
            { filename: 'level_66_russian_desert.jpg', expectedItems: 24, category: 'Medium' },
            { filename: 'level_112_russian_crypt_boss.jpg', expectedItems: 29, category: 'Large' },
            { filename: 'level_803_russian_stress_test.jpg', expectedItems: 49, category: 'Extreme' },
        ];

        const scalingResults = [];

        for (const testImg of testImages) {
            const imagePath = path.join(TEST_IMAGES_DIR, testImg.filename);

            if (!fs.existsSync(imagePath)) {
                continue;
            }

            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            const benchmark = await page.evaluate(async imageDataUrl => {
                if (typeof window.initCV === 'function' && window.allData) {
                    await window.initCV(window.allData);
                }

                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageDataUrl;
                });

                const startTime = performance.now();
                const result = await window.detectItemsWithCV(img);
                const endTime = performance.now();

                return {
                    totalTime: Math.round(endTime - startTime),
                    itemCount: result.items ? result.items.length : 0,
                };
            }, base64Image);

            scalingResults.push({
                category: testImg.category,
                expectedItems: testImg.expectedItems,
                detectedItems: benchmark.itemCount,
                time: benchmark.totalTime,
                timePerItem: Math.round(benchmark.totalTime / Math.max(benchmark.itemCount, 1)),
            });
        }

        console.log('\n' + '='.repeat(70));
        console.log('DETECTION SPEED SCALING WITH ITEM COUNT');
        console.log('='.repeat(70));
        console.log('Category | Expected | Detected | Time (ms) | Time/Item (ms)');
        console.log('-'.repeat(70));

        for (const result of scalingResults) {
            const catPadded = result.category.padEnd(8);
            const expPadded = String(result.expectedItems).padStart(8);
            const detPadded = String(result.detectedItems).padStart(8);
            const timePadded = String(result.time).padStart(9);
            const tpiPadded = String(result.timePerItem).padStart(14);

            console.log(`${catPadded} | ${expPadded} | ${detPadded} | ${timePadded} | ${tpiPadded}`);
        }
        console.log('='.repeat(70));

        // Should handle extreme case within reasonable time
        const extremeCase = scalingResults.find(r => r.category === 'Extreme');
        if (extremeCase) {
            expect(extremeCase.time).toBeLessThan(15000); // Max 15 seconds for 50+ items
        }
    });

    test('should measure template loading and caching performance', async ({ page }) => {
        const benchmark = await page.evaluate(async () => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            // Measure template loading time
            const startLoad = performance.now();

            if (window.loadAllTemplates) {
                await window.loadAllTemplates();
            }

            const endLoad = performance.now();
            const loadTime = Math.round(endLoad - startLoad);

            // Get template cache stats
            const cacheStats = window.getTemplateCacheStats ? window.getTemplateCacheStats() : null;

            return {
                templateLoadTime: loadTime,
                cacheStats: cacheStats,
            };
        });

        console.log(`\nTemplate Loading Performance:`);
        console.log(`  Load Time: ${benchmark.templateLoadTime}ms`);

        if (benchmark.cacheStats) {
            console.log(`  Cached Templates: ${benchmark.cacheStats.count || 0}`);
            console.log(`  Cache Size: ${benchmark.cacheStats.size || 'N/A'}`);
        }

        // Template loading should be fast (< 2 seconds)
        expect(benchmark.templateLoadTime).toBeLessThan(2000);
    });

    test('should benchmark memory usage during detection', async ({ page }) => {
        const imagePath = path.join(TEST_IMAGES_DIR, 'level_803_russian_stress_test.jpg');

        if (!fs.existsSync(imagePath)) {
            test.skip();
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const memoryBenchmark = await page.evaluate(async imageDataUrl => {
            if (typeof window.initCV === 'function' && window.allData) {
                await window.initCV(window.allData);
            }

            // Measure memory before
            const memBefore = performance.memory
                ? {
                      usedJSHeapSize: performance.memory.usedJSHeapSize,
                      totalJSHeapSize: performance.memory.totalJSHeapSize,
                  }
                : null;

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataUrl;
            });

            await window.detectItemsWithCV(img);

            // Measure memory after
            const memAfter = performance.memory
                ? {
                      usedJSHeapSize: performance.memory.usedJSHeapSize,
                      totalJSHeapSize: performance.memory.totalJSHeapSize,
                  }
                : null;

            if (memBefore && memAfter) {
                return {
                    memoryIncrease:
                        Math.round(((memAfter.usedJSHeapSize - memBefore.usedJSHeapSize) / 1024 / 1024) * 10) / 10,
                    totalHeapSize: Math.round(memAfter.totalJSHeapSize / 1024 / 1024),
                    supported: true,
                };
            }

            return { supported: false };
        }, base64Image);

        if (memoryBenchmark.supported) {
            console.log(`\nMemory Usage:`);
            console.log(`  Memory Increase: ${memoryBenchmark.memoryIncrease} MB`);
            console.log(`  Total Heap Size: ${memoryBenchmark.totalHeapSize} MB`);

            // Memory increase should be reasonable (< 100 MB)
            expect(memoryBenchmark.memoryIncrease).toBeLessThan(100);
        } else {
            console.log('\nMemory benchmarking not supported in this browser');
        }
    });
});
