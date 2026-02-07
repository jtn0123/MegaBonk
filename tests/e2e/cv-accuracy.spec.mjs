/**
 * E2E Accuracy Tests for Image Recognition
 * Tests CV detection accuracy against ground truth data
 */

/* global Image, performance */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-screenshots');
const GROUND_TRUTH_PATH = path.join(__dirname, '../../test-images/gameplay/ground-truth.json');

// Load ground truth data
let groundTruth = {};
try {
    const content = fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8');
    groundTruth = JSON.parse(content);
} catch (e) {
    console.error('Failed to load ground truth:', e.message);
}

/**
 * Calculate accuracy metrics
 * @param {string[]} detected - Detected items
 * @param {string[]} expected - Ground truth items
 * @returns {object} Metrics object
 */
function calculateAccuracyMetrics(detected, expected) {
    // Count duplicates properly
    const detectedCounts = {};
    const expectedCounts = {};

    detected.forEach(item => {
        const key = item.toLowerCase().trim();
        detectedCounts[key] = (detectedCounts[key] || 0) + 1;
    });

    expected.forEach(item => {
        const key = item.toLowerCase().trim();
        expectedCounts[key] = (expectedCounts[key] || 0) + 1;
    });

    // Calculate true positives (correctly detected items with correct count)
    let truePositives = 0;
    let totalDetectedItems = 0;
    let totalExpectedItems = expected.length;

    // For each expected item, check if detected
    for (const [item, expectedCount] of Object.entries(expectedCounts)) {
        const detectedCount = detectedCounts[item] || 0;
        const matchedCount = Math.min(detectedCount, expectedCount);
        truePositives += matchedCount;
    }

    // False positives: detected but not in ground truth, or too many copies
    let falsePositives = 0;
    for (const [item, detectedCount] of Object.entries(detectedCounts)) {
        const expectedCount = expectedCounts[item] || 0;
        if (detectedCount > expectedCount) {
            falsePositives += detectedCount - expectedCount;
        }
    }
    totalDetectedItems = detected.length;

    // False negatives: in ground truth but not detected, or too few copies
    let falseNegatives = totalExpectedItems - truePositives;

    // Metrics
    const precision = totalDetectedItems > 0 ? truePositives / totalDetectedItems : 0;
    const recall = totalExpectedItems > 0 ? truePositives / totalExpectedItems : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy =
        totalExpectedItems + totalDetectedItems > 0
            ? truePositives / Math.max(totalExpectedItems, totalDetectedItems)
            : 0;

    // Detailed breakdown
    const correctItems = [];
    const missedItems = [];
    const extraItems = [];

    for (const [item, expectedCount] of Object.entries(expectedCounts)) {
        const detectedCount = detectedCounts[item] || 0;
        if (detectedCount === expectedCount) {
            correctItems.push(`${item} (x${expectedCount})`);
        } else if (detectedCount < expectedCount) {
            missedItems.push(`${item} (expected ${expectedCount}, got ${detectedCount})`);
        }
    }

    for (const [item, detectedCount] of Object.entries(detectedCounts)) {
        const expectedCount = expectedCounts[item] || 0;
        if (expectedCount === 0) {
            extraItems.push(`${item} (x${detectedCount})`);
        } else if (detectedCount > expectedCount) {
            extraItems.push(`${item} (expected ${expectedCount}, got ${detectedCount})`);
        }
    }

    return {
        truePositives,
        falsePositives,
        falseNegatives,
        precision: Math.round(precision * 1000) / 10, // percentage with 1 decimal
        recall: Math.round(recall * 1000) / 10,
        f1Score: Math.round(f1Score * 1000) / 10,
        accuracy: Math.round(accuracy * 1000) / 10,
        totalDetected: totalDetectedItems,
        totalExpected: totalExpectedItems,
        correctItems,
        missedItems,
        extraItems,
    };
}

// Check if dev server is running before all tests
let serverAvailable = false;
test.beforeAll(async () => {
    try {
        const response = await fetch('http://localhost:5173', { method: 'HEAD' });
        serverAvailable = response.ok || response.status === 200 || response.status === 304;
    } catch {
        serverAvailable = false;
        console.log('Dev server not running at localhost:5173 - CV accuracy tests will be skipped');
    }
});

test.describe('CV Accuracy Tests', () => {
    // Skip: CV tests are slow and have dedicated workflow - run separately
    test.skip(true, 'CV tests disabled for main e2e - use cv-testing workflow');
    
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Wait for game data to load
        await page.waitForFunction(
            () => {
                return window.allData && window.allData.items && window.allData.items.length > 0;
            },
            { timeout: 10000 }
        );
    });

    // Test configuration
    const testCases = [
        {
            filename: 'level_33_english_forest_early.jpg',
            expectedAccuracy: 80, // Easy test case
            difficulty: 'Easy',
            key: 'pc-screenshots/level_33_english_forest_early.jpg',
        },
        {
            filename: 'level_21_english_desert_scorpion.jpg',
            expectedAccuracy: 75,
            difficulty: 'Easy',
            key: 'pc-screenshots/level_21_english_desert_scorpion.jpg',
        },
        {
            filename: 'level_52_spanish_ocean.jpg',
            expectedAccuracy: 70,
            difficulty: 'Medium',
            key: 'pc-screenshots/level_52_spanish_ocean.jpg',
        },
        {
            filename: 'level_66_russian_desert.jpg',
            expectedAccuracy: 70,
            difficulty: 'Medium',
            key: 'pc-screenshots/level_66_russian_desert.jpg',
        },
        {
            filename: 'level_75_portuguese_hell_final.jpg',
            expectedAccuracy: 65,
            difficulty: 'Hard',
            key: 'pc-screenshots/level_75_portuguese_hell_final.jpg',
        },
        {
            filename: 'level_108_english_snow_boss.jpg',
            expectedAccuracy: 70,
            difficulty: 'Medium',
            key: 'pc-screenshots/level_108_english_snow_boss.jpg',
        },
        {
            filename: 'level_112_russian_crypt_boss.jpg',
            expectedAccuracy: 65,
            difficulty: 'Hard',
            key: 'pc-screenshots/level_112_russian_crypt_boss.jpg',
        },
        {
            filename: 'level_281_turkish_hell.jpg',
            expectedAccuracy: 60,
            difficulty: 'Very Hard',
            key: 'pc-screenshots/level_281_turkish_hell.jpg',
        },
        {
            filename: 'level_803_russian_stress_test.jpg',
            expectedAccuracy: 55,
            difficulty: 'Extreme',
            key: 'pc-screenshots/level_803_russian_stress_test.jpg',
        },
    ];

    for (const testCase of testCases) {
        test(`should detect items with >${testCase.expectedAccuracy}% accuracy - ${testCase.filename} (${testCase.difficulty})`, async ({
            page,
        }) => {
            const imagePath = path.join(TEST_IMAGES_DIR, testCase.filename);

            // Skip if image doesn't exist
            if (!fs.existsSync(imagePath)) {
                test.skip();
                return;
            }

            // Get ground truth
            const truth = groundTruth[testCase.key];
            if (!truth || !truth.items) {
                test.skip();
                return;
            }

            const expectedItems = truth.items;
            console.log(`\nTesting ${testCase.filename}:`);
            console.log(`Expected ${expectedItems.length} items`);

            // Read image as base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            // Inject test utilities if not available
            await page.evaluate(() => {
                if (!window.testUtils) {
                    window.testUtils = {
                        calculateAccuracyMetrics: (detected, expected) => {
                            // Same calculation logic as above (injected into browser)
                            const detectedCounts = {};
                            const expectedCounts = {};

                            detected.forEach(item => {
                                const key = item.toLowerCase().trim();
                                detectedCounts[key] = (detectedCounts[key] || 0) + 1;
                            });

                            expected.forEach(item => {
                                const key = item.toLowerCase().trim();
                                expectedCounts[key] = (expectedCounts[key] || 0) + 1;
                            });

                            let truePositives = 0;
                            for (const [item, expectedCount] of Object.entries(expectedCounts)) {
                                const detectedCount = detectedCounts[item] || 0;
                                truePositives += Math.min(detectedCount, expectedCount);
                            }

                            const totalDetected = detected.length;
                            const totalExpected = expected.length;
                            const falsePositives = totalDetected - truePositives;
                            const falseNegatives = totalExpected - truePositives;

                            const precision = totalDetected > 0 ? truePositives / totalDetected : 0;
                            const recall = totalExpected > 0 ? truePositives / totalExpected : 0;
                            const f1Score =
                                precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
                            const accuracy =
                                Math.max(totalExpected, totalDetected) > 0
                                    ? truePositives / Math.max(totalExpected, totalDetected)
                                    : 0;

                            return {
                                truePositives,
                                falsePositives,
                                falseNegatives,
                                precision: Math.round(precision * 1000) / 10,
                                recall: Math.round(recall * 1000) / 10,
                                f1Score: Math.round(f1Score * 1000) / 10,
                                accuracy: Math.round(accuracy * 1000) / 10,
                                totalDetected,
                                totalExpected,
                            };
                        },
                    };
                }
            });

            // Run CV detection
            const result = await page.evaluate(async imageDataUrl => {
                // Ensure CV is initialized
                if (typeof window.initCV === 'function' && window.allData) {
                    await window.initCV(window.allData);
                }

                // Load image
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageDataUrl;
                });

                // Run detection
                const cvResult = await window.detectItemsWithCV(img);

                return {
                    items: cvResult.items || [],
                    confidence: cvResult.averageConfidence || 0,
                    detectionTime: cvResult.processingTime || 0,
                };
            }, base64Image);

            const detectedItems = result.items.map(item => item.name || item);

            console.log(`Detected ${detectedItems.length} items`);
            console.log(`Detection time: ${result.detectionTime}ms`);

            // Calculate metrics
            const metrics = calculateAccuracyMetrics(detectedItems, expectedItems);

            console.log(`\nMetrics for ${testCase.filename}:`);
            console.log(`  Accuracy: ${metrics.accuracy}%`);
            console.log(`  Precision: ${metrics.precision}%`);
            console.log(`  Recall: ${metrics.recall}%`);
            console.log(`  F1 Score: ${metrics.f1Score}%`);
            console.log(`  True Positives: ${metrics.truePositives}`);
            console.log(`  False Positives: ${metrics.falsePositives}`);
            console.log(`  False Negatives: ${metrics.falseNegatives}`);

            if (metrics.missedItems.length > 0) {
                console.log(
                    `  Missed items: ${metrics.missedItems.slice(0, 5).join(', ')}${metrics.missedItems.length > 5 ? '...' : ''}`
                );
            }
            if (metrics.extraItems.length > 0) {
                console.log(
                    `  Extra items: ${metrics.extraItems.slice(0, 5).join(', ')}${metrics.extraItems.length > 5 ? '...' : ''}`
                );
            }

            // Assertions
            expect(metrics.accuracy).toBeGreaterThanOrEqual(testCase.expectedAccuracy);
            expect(metrics.precision).toBeGreaterThan(0);
            expect(metrics.recall).toBeGreaterThan(0);
        });
    }

    test('should report aggregate accuracy across all test images', async ({ page }) => {
        const aggregateMetrics = {
            totalTests: 0,
            passedTests: 0,
            averageAccuracy: 0,
            averagePrecision: 0,
            averageRecall: 0,
            averageF1: 0,
            totalItems: 0,
            totalDetected: 0,
            totalCorrect: 0,
        };

        for (const testCase of testCases) {
            const imagePath = path.join(TEST_IMAGES_DIR, testCase.filename);

            if (!fs.existsSync(imagePath)) continue;

            const truth = groundTruth[testCase.key];
            if (!truth || !truth.items) continue;

            const expectedItems = truth.items;
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            try {
                const result = await page.evaluate(async imageDataUrl => {
                    if (typeof window.initCV === 'function' && window.allData) {
                        await window.initCV(window.allData);
                    }

                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = imageDataUrl;
                    });

                    const cvResult = await window.detectItemsWithCV(img);
                    return { items: cvResult.items || [] };
                }, base64Image);

                const detectedItems = result.items.map(item => item.name || item);
                const metrics = calculateAccuracyMetrics(detectedItems, expectedItems);

                aggregateMetrics.totalTests++;
                if (metrics.accuracy >= testCase.expectedAccuracy) {
                    aggregateMetrics.passedTests++;
                }

                aggregateMetrics.averageAccuracy += metrics.accuracy;
                aggregateMetrics.averagePrecision += metrics.precision;
                aggregateMetrics.averageRecall += metrics.recall;
                aggregateMetrics.averageF1 += metrics.f1Score;
                aggregateMetrics.totalItems += metrics.totalExpected;
                aggregateMetrics.totalDetected += metrics.totalDetected;
                aggregateMetrics.totalCorrect += metrics.truePositives;
            } catch (e) {
                console.error(`Failed to process ${testCase.filename}:`, e.message);
            }
        }

        if (aggregateMetrics.totalTests > 0) {
            aggregateMetrics.averageAccuracy /= aggregateMetrics.totalTests;
            aggregateMetrics.averagePrecision /= aggregateMetrics.totalTests;
            aggregateMetrics.averageRecall /= aggregateMetrics.totalTests;
            aggregateMetrics.averageF1 /= aggregateMetrics.totalTests;
        }

        console.log('\n' + '='.repeat(60));
        console.log('AGGREGATE ACCURACY REPORT');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${aggregateMetrics.totalTests}`);
        console.log(
            `Passed Tests: ${aggregateMetrics.passedTests}/${aggregateMetrics.totalTests} (${Math.round((aggregateMetrics.passedTests / aggregateMetrics.totalTests) * 100)}%)`
        );
        console.log(`Average Accuracy: ${Math.round(aggregateMetrics.averageAccuracy * 10) / 10}%`);
        console.log(`Average Precision: ${Math.round(aggregateMetrics.averagePrecision * 10) / 10}%`);
        console.log(`Average Recall: ${Math.round(aggregateMetrics.averageRecall * 10) / 10}%`);
        console.log(`Average F1 Score: ${Math.round(aggregateMetrics.averageF1 * 10) / 10}%`);
        console.log(`Total Items in Ground Truth: ${aggregateMetrics.totalItems}`);
        console.log(`Total Items Detected: ${aggregateMetrics.totalDetected}`);
        console.log(`Total Correct Detections: ${aggregateMetrics.totalCorrect}`);
        console.log('='.repeat(60));

        // Should pass at least 70% of tests
        expect(aggregateMetrics.passedTests).toBeGreaterThanOrEqual(Math.floor(aggregateMetrics.totalTests * 0.7));

        // Overall accuracy should be > 65%
        expect(aggregateMetrics.averageAccuracy).toBeGreaterThanOrEqual(65);
    });
});
